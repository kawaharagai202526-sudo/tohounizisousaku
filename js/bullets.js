'use strict';
// ============================================================
//  敵弾・レーザー
// ============================================================

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
    this.rotates = !!def.rotate;
    this.spin = def.spin ? def.spin * (Math.random() < 0.5 ? -1 : 1) : 0;
    this.rot = this.rotates ? this.angle : Math.random() * TAU;
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

  update() {
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
    this.x += this.vx;
    this.y += this.vy;
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
    this.pool = [];
  }
  spawn(o) {
    const b = (this.pool.pop() || new Bullet()).init(o);
    this.list.push(b);
    return b;
  }
  update() {
    const list = this.list;
    for (let i = 0; i < list.length; i++) if (list[i].alive) list[i].update();
    let j = 0;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (b.alive) list[j++] = b;
      else { b.script = null; this.pool.push(b); }
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
    if (this.frame === this.warn) Sound.se('laser');
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
function fire(o) {
  if (!o.silent) Sound.se('tan');
  return G.bullets.spawn(o);
}
function fireRing(o) {
  const out = [];
  const n = o.n, base = o.angle ?? 0;
  for (let i = 0; i < n; i++) out.push(fire({ ...o, angle: base + (i * TAU) / n }));
  return out;
}
function fireFan(o) {
  const out = [];
  const n = o.n, sp = o.spread ?? 0.5, base = o.angle ?? Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? base : base - sp / 2 + (sp * i) / (n - 1);
    out.push(fire({ ...o, angle: a }));
  }
  return out;
}
function fireLaser(o) {
  const l = new Laser(o);
  G.lasers.push(l);
  return l;
}
function aimAt(x, y) { return angleTo(x, y, G.player.x, G.player.y); }
