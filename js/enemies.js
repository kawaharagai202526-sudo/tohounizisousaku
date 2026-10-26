'use strict';
// ============================================================
//  ザコ敵・ボス
// ============================================================

// 面ごとのザコの見た目：STAGES に zako: '種類' を書くと、その面の妖精と緑の手がその種類の絵になる
const ZAKO_KINDS = new Set(['fairy', 'hand']);

class Enemy {
  constructor(o) {
    this.x = o.x;
    this.y = o.y;
    this.hp = this.maxHp = o.hp ?? 12;
    this.kind = o.kind || 'fairy';
    const zako = G && G.stage && G.stage.zako;
    if (zako && ZAKO_KINDS.has(this.kind)) this.kind = zako;
    this.color = o.color || 'blue';
    this.r = o.r ?? (this.kind === 'bigfairy' ? 18 : this.kind === 'kedama' ? 10 : 12);
    this.speed = o.speed || 0;
    this.angle = o.angle ?? Math.PI / 2;
    this.accel = o.accel || 0;
    this.angVel = o.angVel || 0;
    this.drops = o.drops ?? { power: 1 };
    this.score = o.score ?? 1000;
    this.frame = 0;
    this.alive = true;
    this.flash = 0;
    this.entered = false;
    this.untouchable = false;
    this.invincible = 0;
    this.keep = !!o.keep;
    this.noBody = !!o.noBody;
    this.onDeath = o.onDeath || null;
    this.side = o.side ?? 1;
    this.phase = frand(TAU);
    this.tasks = new TaskRunner();
    if (o.script) this.tasks.add(o.script(this));
  }
  update() {
    this.frame++;
    if (this.flash > 0) this.flash--;
    if (this.invincible > 0) this.invincible--;
    this.tasks.update();
    if (!this.alive) return;
    if (this.accel) this.speed = clamp(this.speed + this.accel, 0, 20);
    if (this.angVel) this.angle += this.angVel;
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
    const inside = this.x > -8 && this.x < FIELD_W + 8 && this.y > -8 && this.y < FIELD_H + 8;
    if (inside) this.entered = true;
    else if (!this.keep && (this.entered || this.frame > 900)) {
      const m = 48;
      if (this.x < -m || this.x > FIELD_W + m || this.y < -m || this.y > FIELD_H + m) {
        this.alive = false;
        this.tasks.clear();
      }
    }
  }
  setMove(speed, angle, accel = 0, angVel = 0) {
    this.speed = speed;
    this.angle = angle;
    this.accel = accel;
    this.angVel = angVel;
  }
  *moveTo(x, y, frames, ease = Ease.outQuad) {
    const sx = this.x, sy = this.y;
    this.speed = 0;
    this.accel = 0;
    for (let i = 1; i <= frames; i++) {
      const t = ease(i / frames);
      this.x = lerp(sx, x, t);
      this.y = lerp(sy, y, t);
      yield;
    }
  }
  aim() { return aimAt(this.x, this.y); }
  get onScreen() { return this.x > 0 && this.x < FIELD_W && this.y > 0 && this.y < FIELD_H; }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    switch (this.kind) {
      case 'bigfairy': drawFairy(ctx, this.color, this.frame, true); break;
      case 'kedama': drawKedama(ctx, this.color, this.frame); break;
      case 'foot':
        ctx.rotate(Math.sin(this.frame * 0.12) * 0.12);
        if (!drawImageSprite(ctx, 'footFairy', 30, 0.35, 0.5)) drawFairy(ctx, this.color, this.frame, false);
        break;
      case 'midboss1':
        ctx.translate(0, Math.sin(this.frame * 0.05) * 2);
        if (!drawImageSprite(ctx, 'midboss1', 76)) drawFairy(ctx, this.color, this.frame, true);
        break;
      case 'tileobj': {
        // 回転しながら降ってくる大きな瓦（一撃で倒せる）。弾と見分けられるよう細い輪を付ける
        ctx.rotate(this.frame * 0.09);
        drawRoofTile(ctx);
        ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.25 * Math.sin(this.frame * 0.2)})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case 'bug': drawBeetle(ctx, this.frame, this.angle, this.phase); break;
      // 2.8.0：撃ち落とせる弾のような敵（4面の餅・5面の子分の家鳴）と、6面の瓦礫の陰
      case 'mochi': ctx.drawImage(getBulletSprite('mochi', this.color), -20, -20, 40, 40); break;
      case 'kobun':
        ctx.translate(0, Math.abs(Math.sin(this.frame * 0.15)) * -3);
        ctx.drawImage(getBulletSprite('kobun', this.color), -15, -15, 30, 30);
        break;
      case 'decoy': drawRubblePile(ctx, 0); break;
      case 'pillar': drawPillar(ctx, this.frame, this.side || 1); break;
      case 'paper': drawPaperScrap(ctx, this.frame, this.phase, this.angle); break;
      case 'hand':
        ctx.rotate(Math.sin(this.frame * 0.08 + this.phase) * 0.15);
        if (!drawImageSprite(ctx, 'hand', 34)) drawFairy(ctx, 'green', this.frame, false);
        break;
      case 'handEye':
        // 一つ目の手（3面以降のザコ）。ゆらゆら揺れながら少し伸び縮みする
        ctx.rotate(Math.sin(this.frame * 0.08 + this.phase) * 0.18);
        ctx.scale(1, 1 + Math.sin(this.frame * 0.15 + this.phase) * 0.04);
        if (!drawImageSprite(ctx, 'handEye', 30)) drawFairy(ctx, 'green', this.frame, false);
        break;
      default: drawFairy(ctx, this.color, this.frame, false);
    }
    if (this.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }
}

// 大きな瓦（1面などの道中で、回転しながら降ってくる）
function drawRoofTile(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(2, 3, 13, 9, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#4a5468';
  ctx.beginPath();
  ctx.moveTo(-12, -8); ctx.quadraticCurveTo(0, -13, 12, -8); ctx.lineTo(12, 8); ctx.quadraticCurveTo(0, 3, -12, 8);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7a86a0';
  ctx.beginPath();
  ctx.moveTo(-10, -7); ctx.quadraticCurveTo(0, -11, 10, -7); ctx.lineTo(10, -3); ctx.quadraticCurveTo(0, -7, -10, -3);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(20,24,34,0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-4, -9); ctx.lineTo(-5, 6); ctx.moveTo(4, -9); ctx.lineTo(5, 6); ctx.stroke();
}

// 瓦礫の山（6面の隠れ鬼で、ボスが陰に隠れる。ボスと見分けがつかないように、どれも同じ形）
function drawRubblePile(ctx, seed) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(2, 10, 24, 7, 0, 0, TAU); ctx.fill();
  const r = k => 0.5 + 0.5 * Math.sin(seed * 7.1 + k * 3.7);
  ctx.fillStyle = '#5a4a3e';
  ctx.beginPath(); ctx.moveTo(-24, 10); ctx.lineTo(-16, -6 - r(1) * 6); ctx.lineTo(-4, -12 - r(2) * 6); ctx.lineTo(8, -8 - r(3) * 6); ctx.lineTo(20, -2); ctx.lineTo(24, 10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7a6656';
  ctx.beginPath(); ctx.moveTo(-14, 6); ctx.lineTo(-8, -6 - r(4) * 4); ctx.lineTo(4, -4); ctx.lineTo(10, 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4a5468';
  ctx.save(); ctx.translate(12, -2); ctx.rotate(0.4 + r(5)); ctx.fillRect(-7, -3, 14, 6); ctx.restore();
  ctx.strokeStyle = '#3a2a1e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(6, -16 - r(6) * 4); ctx.stroke();
}

// 空き家の虫（2面）。脚を動かしながら進む
function drawBeetle(ctx, t, angle, phase) {
  ctx.save();
  ctx.rotate(angle);
  ctx.strokeStyle = '#1a120a';
  ctx.lineWidth = 1.4;
  for (let k = -1; k <= 1; k++) {
    const sw = Math.sin(t * 0.5 + phase + k * 2) * 2;
    ctx.beginPath();
    ctx.moveTo(k * 4, -3); ctx.lineTo(k * 4 + sw, -9);
    ctx.moveTo(k * 4, 3); ctx.lineTo(k * 4 - sw, 9);
    ctx.stroke();
  }
  ctx.fillStyle = '#3a2410';
  ell(ctx, 0, 0, 8, 5.5); ctx.fill();
  ctx.fillStyle = '#5c3a18';
  ell(ctx, -1, 0, 6.5, 4.5); ctx.fill();
  ctx.strokeStyle = 'rgba(20,10,4,0.8)';
  ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(5, 0); ctx.stroke();
  ctx.fillStyle = 'rgba(255,230,180,0.35)';
  ell(ctx, -2, -2, 3, 1.4); ctx.fill();
  ctx.fillStyle = '#1a120a';
  ell(ctx, 8.5, 0, 3, 2.6); ctx.fill();
  ctx.strokeStyle = '#1a120a';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(10, -1); ctx.lineTo(14, -5); ctx.moveTo(10, 1); ctx.lineTo(14, 5); ctx.stroke();
  ctx.restore();
}

// 破れたふすまの紙きれ（4面）。ひらひら舞いながら進む。弾は撃たないが、ぶつかると被弾する
function drawPaperScrap(ctx, t, phase, angle) {
  const flap = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.2 + phase));
  ctx.save();
  ctx.rotate(angle + Math.sin(t * 0.07 + phase) * 0.6);
  ctx.scale(1, flap);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-7 + 2, -5 + 3, 14, 10);
  ctx.fillStyle = '#efe6cc';
  ctx.beginPath();
  ctx.moveTo(-8, -5); ctx.lineTo(6, -6); ctx.lineTo(8, 1); ctx.lineTo(5, 6); ctx.lineTo(-7, 5); ctx.lineTo(-5, 0);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(70,90,140,0.7)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 3, 4, Math.PI, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(120,90,50,0.8)';
  ctx.beginPath(); ctx.moveTo(-8, -5); ctx.lineTo(6, -6); ctx.stroke();
  ctx.restore();
}

// 部屋の柱（4・5面の壁ぎわ）。年輪の目が光り、自機を狙ってレーザーを撃つ
function drawPillar(ctx, t, side) {
  const glow = 0.5 + 0.3 * Math.sin(t * 0.1);
  ctx.save();
  ctx.scale(side, 1);
  const g = ctx.createRadialGradient(4, 0, 2, 4, 0, 20);
  g.addColorStop(0, `rgba(255,190,110,${glow * 0.6})`);
  g.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(4, 0, 20, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-12 + 3, -22 + 3, 18, 44);
  ctx.fillStyle = '#6a4424';
  ctx.fillRect(-12, -22, 18, 44);
  ctx.fillStyle = 'rgba(255,220,170,0.18)';
  ctx.fillRect(-12, -22, 4, 44);
  ctx.strokeStyle = 'rgba(40,24,10,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-6, -22); ctx.lineTo(-6, 22); ctx.moveTo(1, -22); ctx.lineTo(1, 22); ctx.stroke();
  for (const rr of [6, 4, 2]) {
    ctx.strokeStyle = `rgba(255,200,120,${glow})`;
    ctx.beginPath(); ctx.ellipse(-3, 0, rr, rr * 1.4, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

function spawnEnemy(o) {
  const e = new Enemy(o);
  G.enemies.push(e);
  return e;
}

// ------------------------------------------------------------
//  ボス
// ------------------------------------------------------------
class Boss {
  constructor(id, def = {}) {
    this.id = id;
    this.def = def;
    this.name = CHARA_INFO[id].name;
    this.isBoss = true;
    this.x = def.x ?? FIELD_W / 2;
    this.y = def.y ?? -50;
    this.r = 22;
    this.hp = 1;
    this.maxHp = 1;
    this.alive = true;
    this.frame = 0;
    this.flash = 0;
    this.invincible = 0;
    this.untouchable = true;
    this.timer = 0;
    this.phase = null;
    this.tasks = new TaskRunner();
    this.moveTask = null;
    this.prevX = this.x;
    this.tilt = 0;
    this.pose = def.pose || null;
    this.circleColor = def.circleColor || '160,180,255';
    this.alpha = 1;
  }
  update() {
    this.frame++;
    if (this.flash > 0) this.flash--;
    if (this.invincible > 0) this.invincible--;
    this.tasks.update();
    if (this.moveTask) {
      const r = this.moveTask.next();
      if (r.done) this.moveTask = null;
    }
    const vx = this.x - this.prevX;
    this.tilt += (clamp(vx, -3, 3) / 3 - this.tilt) * 0.15;
    this.prevX = this.x;
  }
  *moveTo(x, y, frames, ease = Ease.inOutSine) {
    const sx = this.x, sy = this.y;
    for (let i = 1; i <= frames; i++) {
      const t = ease(i / frames);
      this.x = lerp(sx, x, t);
      this.y = lerp(sy, y, t);
      yield;
    }
  }
  // 移動を別枠で走らせる（攻撃と並行して動く）
  move(x, y, frames, ease) { this.moveTask = this.moveTo(x, y, frames, ease); }
  wander(frames = 50, range = 70) {
    const p = G.player;
    let dir = Math.sign(p.x - this.x) || randSign();
    if (rng.next() < 0.35) dir = -dir;
    const tx = clamp(this.x + dir * rand(range * 0.5, range), 56, FIELD_W - 56);
    const ty = clamp(rand(70, 130), 50, 150);
    this.move(tx, ty, frames);
  }
  get moving() { return !!this.moveTask; }
  aim() { return aimAt(this.x, this.y); }

  draw(ctx) {
    if (!this.alive) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = this.alpha;
    if (this.disguise) {
      // 瓦礫の陰に隠れている（隠れ鬼）。ほかの瓦礫と見分けがつかないように、魔法陣も出さない
      drawRubblePile(ctx, 0);
      if (this.flash > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.fill();
      }
      ctx.restore();
      return;
    }
    // 魔法陣
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pr = 44 + Math.sin(this.frame * 0.05) * 4;
    ctx.strokeStyle = `rgba(${this.circleColor},0.45)`;
    ctx.lineWidth = 1.5;
    ctx.rotate(this.frame * 0.03);
    ctx.beginPath(); ctx.arc(0, 0, pr, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, pr - 6, 0, TAU); ctx.stroke();
    for (let k = 0; k < 2; k++) {
      ctx.rotate(Math.PI / 4);
      ctx.strokeRect(-pr * 0.68, -pr * 0.68, pr * 1.36, pr * 1.36);
    }
    ctx.fillStyle = `rgba(${this.circleColor},0.6)`;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ctx.fillRect(Math.cos(a) * (pr - 3) - 1, Math.sin(a) * (pr - 3) - 1, 2, 2);
    }
    ctx.restore();
    if (this.def.aura) {
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 40);
      g.addColorStop(0, this.def.aura);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.fill();
    }
    ctx.rotate(this.tilt * 0.12);
    const dot = CHARA_INFO[this.id].dot;
    if (dot) {
      // ドット絵のボス（拡大してもぼやけないように補間を切る）
      const img = Images.get(dot);
      if (img) {
        ctx.translate(0, Math.sin(this.frame * 0.06) * 1.5);
        const smooth = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        drawImageSprite(ctx, dot, img.naturalHeight, 0.5, 0.52);
        ctx.imageSmoothingEnabled = smooth;
      }
    } else {
      ctx.scale(1.1, 1.1);
      drawChibi(ctx, this.id, { t: this.frame, pose: this.pose || undefined, face: this.face || 'normal' });
    }
    if (this.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.arc(0, -6, 22, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}
