'use strict';
// ============================================================
//  敵弾・レーザー
// ============================================================

// 全体の難しさの調整（Easy / Normal / Hard / Lunatic / Extra）
// 敵弾の移動速度と、リング弾（全方位弾）の数にこの倍率を掛ける
// さらにステージごとの倍率（STAGES の speedScale / densityScale）も掛かる
const BULLET_SPEED_SCALE = [0.78, 0.86, 1.0, 1.12, 1.12];
const RING_DENSITY_SCALE = [0.72, 0.8, 1.05, 1.25, 1.25];
function bulletSpeedK() { return BULLET_SPEED_SCALE[DIFF] * ((G && G.stage && G.stage.speedScale) || 1); }
function ringDensityK() { return RING_DENSITY_SCALE[DIFF] * ((G && G.stage && G.stage.densityScale) || 1); }

class Bullet {
  init(o) {
    this.x = o.x;
    this.y = o.y;
    this.speed = o.speed ?? 2;
    this.angle = o.angle ?? Math.PI / 2;
    this.accel = o.accel || 0;
    this.angVel = o.angVel || 0;
    this.minSpeed = o.minSpeed ?? -99;
    this.maxSpeed = o.maxSpeed ?? 99;
    this.ax = o.ax || 0;
    this.ay = o.ay || 0;
    this.evx = o.evx || 0;
    this.evy = o.evy || 0;
    this.maxFall = o.maxFall ?? 99;
    this.type = o.type || 'small';
    this.color = o.color || 'red';
    const def = BTYPES[this.type];
    this.def = def;
    this.hitR = o.hitR ?? def.hitR;
    this.sprite = getBulletSprite(this.type, this.color);
    this.size = def.size * (o.scale || 1);
    this.additive = !!def.additive;
    // noRotate：進行方向を向く弾でも、最初の向き（angle）のまま回さない（落ちてくる梁など）
    this.rotates = !!def.rotate && !o.noRotate;
    this.spin = def.spin ? def.spin * (Math.random() < 0.5 ? -1 : 1) : 0;
    this.rot = def.rotate ? this.angle : Math.random() * TAU;
    this.delay = this.delayMax = o.delay ?? 8;
    this.frame = 0;
    this.life = o.life || 0;
    this.alive = true;
    this.grazed = false;
    this.noCancel = !!o.noCancel;
    this.margin = o.margin ?? 40;
    this.data = o.data || null;
    this.wait = 0;
    this.script = o.script ? o.script(this) : null;
    this.vx = 0;
    this.vy = 0;
    return this;
  }

  setColor(color) {
    this.color = color;
    this.sprite = getBulletSprite(this.type, color);
  }
  setType(type) {
    this.type = type;
    this.def = BTYPES[type];
    this.hitR = this.def.hitR;
    this.size = this.def.size;
    this.additive = !!this.def.additive;
    this.rotates = !!this.def.rotate;
    this.sprite = getBulletSprite(type, this.color);
  }

  update(k) {
    this.frame++;
    if (this.script) {
      if (this.wait > 0) this.wait--;
      else {
        const r = this.script.next();
        if (r.done) this.script = null;
        else this.wait = (typeof r.value === 'number' ? Math.max(1, r.value) : 1) - 1;
      }
      if (!this.alive) return;
    }
    if (this.accel) this.speed = clamp(this.speed + this.accel, this.minSpeed, this.maxSpeed);
    if (this.angVel) this.angle += this.angVel;
    if (this.ax || this.ay) {
      this.evx += this.ax;
      this.evy = Math.min(this.evy + this.ay, this.maxFall);
    }
    this.vx = Math.cos(this.angle) * this.speed + this.evx;
    this.vy = Math.sin(this.angle) * this.speed + this.evy;
    this.x += this.vx * k;
    this.y += this.vy * k;
    if (this.rotates) {
      if (this.vx || this.vy) this.rot = Math.atan2(this.vy, this.vx);
    } else if (this.spin) this.rot += this.spin;
    if (this.delay > 0) this.delay--;
    if (this.life && this.frame >= this.life) this.alive = false;
    const m = this.margin;
    if (this.x < -m || this.x > FIELD_W + m || this.y < -m || this.y > FIELD_H + m) this.alive = false;
  }
}

class BulletManager {
  constructor() {
    this.list = [];
  }
  // 弾は使い回さない（2.8.0）。攻撃のなかで弾を覚えておいて、あとで alive を見て動かすことが多いので、
  // 消えた弾が別の弾として生き返ると、関係のない弾を動かしてしまう
  spawn(o) {
    const b = new Bullet().init(o);
    this.list.push(b);
    return b;
  }
  update() {
    const list = this.list;
    const k = bulletSpeedK();
    for (let i = 0; i < list.length; i++) if (list[i].alive) list[i].update(k);
    let j = 0;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (b.alive) list[j++] = b;
      else b.script = null;
    }
    list.length = j;
  }
  // 弾消し（toItem なら得点アイテムに変える）
  cancelAll(toItem = true, force = false) {
    for (const b of this.list) {
      if (!b.alive || (b.noCancel && !force)) continue;
      b.alive = false;
      Fx.cancel(b.x, b.y, b.color);
      if (toItem) spawnItem('star', b.x, b.y, true);
    }
  }
  cancelIn(fn, toItem = true) {
    for (const b of this.list) {
      if (!b.alive || b.noCancel || !fn(b)) continue;
      b.alive = false;
      Fx.cancel(b.x, b.y, b.color);
      if (toItem) spawnItem('star', b.x, b.y, true);
    }
  }
  draw(ctx) {
    const m = ctx.getTransform();
    const k = m.a;
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 1) ctx.globalCompositeOperation = 'lighter';
      for (const b of this.list) {
        if (b.additive !== (pass === 1)) continue;
        const s = b.size;
        if (b.delay > 0) {
          const p = b.delay / b.delayMax;
          const gs = s * (1 + p * 1.4) + 8;
          ctx.setTransform(k, 0, 0, k, m.e + k * b.x, m.f + k * b.y);
          ctx.globalAlpha = 0.9 * p;
          ctx.drawImage(getGlowSprite(b.color), -gs / 2, -gs / 2, gs, gs);
          ctx.globalAlpha = 1 - p;
        }
        if (b.rot) {
          const c = Math.cos(b.rot) * k, sn = Math.sin(b.rot) * k;
          ctx.setTransform(c, sn, -sn, c, m.e + k * b.x, m.f + k * b.y);
        } else {
          ctx.setTransform(k, 0, 0, k, m.e + k * b.x, m.f + k * b.y);
        }
        ctx.drawImage(b.sprite, -s / 2, -s / 2, s, s);
        ctx.globalAlpha = 1;
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(m);
  }
}

// ------------------------------------------------------------
//  レーザー（予告線 → 照射 → 消滅）
// ------------------------------------------------------------
class Laser {
  constructor(o) {
    this.x = o.x;
    this.y = o.y;
    this.angle = o.angle ?? Math.PI / 2;
    this.length = o.length ?? 640;
    this.width = o.width ?? 14;
    this.color = o.color || 'blue';
    this.warn = o.warn ?? 50;
    this.dur = o.dur ?? 60;
    this.fadeOut = 14;
    this.angVel = o.angVel || 0;
    this.angVelWarn = o.angVelWarn ?? this.angVel;
    this.follow = o.follow || null;
    this.silent = !!o.silent; // 光るときの音を鳴らさない（通り道の予告の線など）
    // 音（2.17.0）：sound は光るとき（ふつうは合成音 'laser'。手・柱は 'laserHand'、4面のボスは 'laserBoss4'）、warnSound は予告の線が出たとき
    this.sound = o.sound === undefined ? 'laser' : o.sound;
    this.warnSound = o.warnSound || null;
    this.frame = 0;
    this.alive = true;
    this.grazeCd = 0;
  }
  get on() { return this.frame >= this.warn + 6 && this.frame < this.warn + this.dur; }
  widthNow() {
    const f = this.frame - this.warn;
    if (f < 0) return 1.5;
    if (f < this.dur) return this.width * Math.min(1, f / 8);
    return this.width * Math.max(0, 1 - (f - this.dur) / this.fadeOut);
  }
  update() {
    this.frame++;
    this.angle += this.frame < this.warn ? this.angVelWarn : this.angVel;
    if (this.follow) this.follow(this);
    if (this.frame === 1 && this.warnSound && !this.silent) Sound.se(this.warnSound);
    if (this.frame === this.warn && this.sound && !this.silent) Sound.se(this.sound);
    if (this.frame >= this.warn + this.dur + this.fadeOut) this.alive = false;
    if (this.grazeCd > 0) this.grazeCd--;
  }
  // 点と線分の距離
  distTo(px, py) {
    const dx = Math.cos(this.angle), dy = Math.sin(this.angle);
    const t = clamp((px - this.x) * dx + (py - this.y) * dy, 0, this.length);
    return Math.hypot(this.x + dx * t - px, this.y + dy * t - py);
  }
  hits(px, py, r) { return this.on && this.distTo(px, py) < this.width * 0.36 + r; }
  draw(ctx) {
    const w = this.widthNow();
    const rim = (BCOL[this.color] || BCOL.white).rim;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    if (this.frame < this.warn) {
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(this.frame * 0.5);
      ctx.fillStyle = rim;
      ctx.fillRect(0, -0.8, this.length, 1.6);
    } else {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
      g.addColorStop(0, hexA(rim, 0));
      g.addColorStop(0.25, hexA(rim, 0.8));
      g.addColorStop(0.5, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.75, hexA(rim, 0.8));
      g.addColorStop(1, hexA(rim, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, -w / 2, this.length, w);
      ctx.fillStyle = hexA(rim, 0.6);
      ctx.beginPath(); ctx.arc(0, 0, w * 0.7, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------
//  弾幕ヘルパー
// ------------------------------------------------------------
// いま台本を動かしているザコ（Enemy.update が入れる）。弱くて数の多いザコ（quiet）が撃つ弾は鳴らさない
let SHOOTER = null;

// 弾を撃つ。o.silent なら音を鳴らさない。o.se で音を選べる（ふつうは 'fire'＝もらった音「m」。針は 'needle'、鬼面は 'oni' など。2.17.0）
function fire(o) {
  // ちょこっとプレイで飛ばしている道中は撃たない（台本が使えるように、消えた弾を返す。2.22.0）
  if (G.roadSkip) { const b = new Bullet().init(o); b.alive = false; return b; }
  if (!o.silent && !(SHOOTER && SHOOTER.quiet)) Sound.se(o.se || 'fire');
  return G.bullets.spawn(o);
}
function fireRing(o) {
  const out = [];
  const n = Math.max(3, Math.round(o.n * ringDensityK())), base = o.angle ?? 0;
  for (let i = 0; i < n; i++) out.push(fire({ ...o, angle: base + (i * TAU) / n }));
  return out;
}
function fireFan(o) {
  const out = [];
  let n = o.n, sp = o.spread ?? 0.5;
  const base = o.angle ?? Math.PI / 2;
  // Lunatic は扇の両端に1発ずつ足す（弾どうしの間隔はそのまま）
  if (DIFF >= 3 && n >= 3) {
    sp = (sp * (n + 1)) / (n - 1);
    n += 2;
  }
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? base : base - sp / 2 + (sp * i) / (n - 1);
    out.push(fire({ ...o, angle: a }));
  }
  return out;
}
function fireLaser(o) {
  const l = new Laser(o);
  if (G.roadSkip) { l.alive = false; return l; } // ちょこっとプレイで飛ばしている道中（2.22.0）
  G.lasers.push(l);
  return l;
}
function aimAt(x, y) { return angleTo(x, y, G.player.x, G.player.y); }

// ------------------------------------------------------------
//  全方位ワインダーと、回る全方位弾（2.19.0 でユーザーの指定「全方位弾やワインダーを追加し、弾幕を構成」で足した）
//  どちらもボスの tasks に入れて、もとの攻撃に重ねる（b.tasks.add(omniWinder(b, {...}))）。攻撃が終わると止まる。
//  攻撃の途中で止めるときは src.layersOff = true（エキストラで栂尾が金神の弾に撃たれるところ）
// ------------------------------------------------------------
// 全方位ワインダー：way 本の弾の流れを src（ボスなど）のまわりに等間隔に並べ、向きを振り子のように左右に振りながら撃ち続ける。
//   way：流れの数（リング弾と同じく難易度と面の密度の倍率がかかる）  every：何フレームごとに撃つか
//   swing：振れ幅（ラジアン）  period：一往復のフレーム  spin：全体を回す速さ（1フレームのラジアン）  wait：始めるまでのフレーム
//   speed・type・color・accel・maxSpeed：弾。音はボスから直接撃つ弾なので「m」（何回かに1回）
function* omniWinder(src, o) {
  if (o.wait) yield o.wait;
  const way = Math.max(2, Math.round(o.way * ringDensityK()));
  const base = o.angle ?? rand(TAU), swing = o.swing ?? 0.5, period = o.period || 150, every = o.every || 10;
  for (let f = 0; !src.layersOff; f++) {
    if (f % every === 0) {
      const a0 = base + (o.spin || 0) * f + swing * Math.sin((f / period) * TAU);
      for (let i = 0; i < way; i++) {
        fire({ x: src.x, y: src.y, angle: a0 + (i * TAU) / way, speed: o.speed ?? 1.6, accel: o.accel, maxSpeed: o.maxSpeed, type: o.type || 'small', color: o.color || 'white', silent: true });
      }
      if (f % (every * 3) === 0) Sound.se(o.se || 'fire');
    }
    yield;
  }
}
// 回る全方位弾：every フレームごとに n 発のリング弾を撃ち、撃つたびに step（ラジアン。書かなければ弾の間の半分）ずつ回す
function* omniRings(src, o) {
  if (o.wait) yield o.wait;
  let a = o.angle ?? rand(TAU);
  for (let k = 0; !src.layersOff; k++) {
    const ring = fireRing({ x: src.x, y: src.y, n: o.n, angle: a, speed: o.speed ?? 1.4, type: o.type || 'small', color: Array.isArray(o.color) ? o.color[k % o.color.length] : o.color || 'white', silent: true });
    Sound.se(o.se || 'fire');
    a += o.step ?? Math.PI / Math.max(3, ring.length);
    yield o.every || 60;
  }
}
