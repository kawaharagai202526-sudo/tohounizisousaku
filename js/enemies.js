'use strict';
// ============================================================
//  ザコ敵・ボス
// ============================================================

class Enemy {
  constructor(o) {
    this.x = o.x;
    this.y = o.y;
    this.hp = this.maxHp = o.hp ?? 12;
    this.kind = o.kind || 'fairy';
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
    ctx.scale(1.1, 1.1);
    drawChibi(ctx, this.id, { t: this.frame, pose: this.pose || undefined, face: this.face || 'normal' });
    if (this.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.arc(0, -6, 22, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}
