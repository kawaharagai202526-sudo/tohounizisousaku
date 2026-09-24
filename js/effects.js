'use strict';
// ============================================================
//  エフェクト（パーティクル）
// ============================================================

const Fx = {
  list: [],
  reset() { this.list = []; },
  add(p) {
    p.max = p.life;
    p.vx = p.vx || 0;
    p.vy = p.vy || 0;
    p.drag = p.drag ?? 1;
    this.list.push(p);
    if (this.list.length > 1600) this.list.splice(0, this.list.length - 1600);
    return p;
  },
  update() {
    for (const p of this.list) {
      p.life--;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= p.drag;
      p.vy *= p.drag;
      if (p.grow) p.r += p.grow;
    }
    this.list = this.list.filter(p => p.life > 0);
  },
  draw(ctx, layer = 0) {
    for (const p of this.list) {
      if ((p.layer || 0) !== layer) continue;
      const k = p.life / p.max;
      switch (p.type) {
        case 'spark': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = k;
          ctx.lineWidth = p.w || 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
          ctx.stroke();
          break;
        }
        case 'ring': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = k * (p.alpha ?? 1);
          ctx.lineWidth = (p.w || 2) * (0.4 + k * 0.6);
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.1, p.r), 0, TAU);
          ctx.stroke();
          break;
        }
        case 'flash': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = k * (p.alpha ?? 1);
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(1, p.r));
          g.addColorStop(0, 'rgba(255,255,255,0.9)');
          g.addColorStop(0.3, p.color);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1, p.r), 0, TAU);
          ctx.fill();
          break;
        }
        case 'glow': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = k;
          const s = p.r * (0.5 + k * 0.5) * 2;
          ctx.drawImage(getGlowSprite(p.color), p.x - s / 2, p.y - s / 2, s, s);
          break;
        }
        case 'text': {
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = Math.min(1, k * 2);
          ctx.font = `bold ${p.size || 11}px ${FONT_EN}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          strokeText(ctx, p.text, p.x, p.y, p.color, 'rgba(0,0,0,0.7)', 2.5);
          break;
        }
        case 'petal': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = k;
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.life * 0.2);
          starPath(ctx, p.r, p.r * 0.45);
          ctx.fill();
          ctx.restore();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },

  spark(x, y, color, n = 6, speed = 3, life = 18) {
    for (let i = 0; i < n; i++) {
      const a = frand(TAU), s = frand(speed * 0.4, speed);
      this.add({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: frand(life * 0.6, life), color, drag: 0.92 });
    }
  },
  ring(x, y, color, r0, grow, life, w = 2) {
    this.add({ type: 'ring', x, y, r: r0, grow, life, color, w });
  },
  flash(x, y, color, r, life, grow = 0) {
    this.add({ type: 'flash', x, y, r, life, color, grow });
  },
  explosion(x, y, color = 'rgba(255,200,120,0.7)', size = 1) {
    this.flash(x, y, color, 16 * size, 16, 1.2 * size);
    this.ring(x, y, color, 6 * size, 2.2 * size, 18, 2);
    this.spark(x, y, color, Math.round(8 * size), 3.5 * size, 22);
  },
  cancel(x, y, color) {
    this.add({ type: 'glow', x, y, r: 12, life: 16, color });
  },
  hit(x, y) {
    this.add({ type: 'spark', x: x + frand(-6, 6), y: y + frand(-4, 8), vx: frand(-1, 1), vy: frand(-3, -1), life: 8, color: 'rgba(255,255,255,0.8)', w: 1 });
  },
  graze(x, y) {
    const a = frand(TAU);
    this.add({ type: 'spark', x, y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, life: 14, color: 'rgba(255,255,255,0.9)', drag: 0.9, w: 1.2 });
  },
  text(x, y, text, color = '#fff', size = 11, life = 50) {
    this.add({ type: 'text', x, y, vy: -0.5, drag: 0.97, text, color, size, life });
  },
  stars(x, y, n, color, speed = 4) {
    for (let i = 0; i < n; i++) {
      const a = frand(TAU), s = frand(speed * 0.3, speed);
      this.add({ type: 'petal', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: frand(2, 5), life: frand(30, 60), color, drag: 0.95 });
    }
  },
  bossExplosion(x, y) {
    for (let i = 0; i < 5; i++) this.ring(x, y, i % 2 ? 'rgba(255,220,255,0.9)' : 'rgba(160,200,255,0.9)', 4, 3 + i * 1.5, 50 + i * 8, 3);
    this.flash(x, y, 'rgba(255,240,220,0.8)', 40, 60, 4);
    this.spark(x, y, 'rgba(255,230,200,0.9)', 50, 9, 60);
    this.stars(x, y, 40, 'rgba(255,240,160,0.9)', 7);
  },
  playerDeath(x, y) {
    for (let i = 0; i < 3; i++) this.ring(x, y, 'rgba(255,120,200,0.9)', 4, 4 + i * 2.5, 40, 3);
    this.flash(x, y, 'rgba(255,150,220,0.7)', 20, 30, 3);
    this.spark(x, y, 'rgba(255,200,240,0.9)', 30, 7, 40);
  },
};

// ============================================================
//  アイテム
// ============================================================
class Item {
  constructor(type, x, y, auto = false) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.vx = type === 'star' ? 0 : frand(-0.8, 0.8);
    this.vy = type === 'star' ? 0 : -frand(1.8, 3.0);
    this.auto = auto;
    this.frame = 0;
    this.alive = true;
    this.homeSpeed = 0;
    this.rot = type === 'star' ? 0 : frand(-3, 3);
  }
  update(p) {
    this.frame++;
    const playerOk = p.state === 'normal';
    if (playerOk && (this.auto || (this.type !== 'star' && p.y < POC_LINE))) this.auto = true;
    const d = dist(this.x, this.y, p.x, p.y);
    const magnet = p.focused ? 70 : 42;
    if (playerOk && (this.auto || d < magnet) && (this.type !== 'star' || this.frame > 10)) {
      this.homeSpeed = Math.min(this.homeSpeed + 0.6, 9);
      const a = angleTo(this.x, this.y, p.x, p.y);
      this.x += Math.cos(a) * this.homeSpeed;
      this.y += Math.sin(a) * this.homeSpeed;
      if (d < 18) { this.alive = false; G.collectItem(this); }
      return;
    }
    if (this.type === 'star') {
      this.y -= 0.3;
      if (this.frame > 90) this.auto = true;
      return;
    }
    this.vy = Math.min(this.vy + 0.05, 2.2);
    this.vx *= 0.95;
    this.x += this.vx;
    this.y += this.vy;
    this.rot *= 0.94;
    if (this.y > FIELD_H + 20) this.alive = false;
    if (playerOk && d < 18) { this.alive = false; G.collectItem(this); }
  }
  draw(ctx) {
    const spr = getItemSprite(this.type);
    const s = spr.width / SPR;
    if (this.y < -s / 2) {
      // 画面上にあるアイテムの位置表示
      ctx.globalAlpha = 0.7;
      ctx.drawImage(spr, this.x - s / 4, 2, s / 2, s / 2);
      ctx.globalAlpha = 1;
      return;
    }
    if (this.rot) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.drawImage(spr, -s / 2, -s / 2, s, s);
      ctx.restore();
    } else {
      ctx.drawImage(spr, this.x - s / 2, this.y - s / 2, s, s);
    }
  }
}

const POC_LINE = 112; // これより上に行くとアイテムを自動回収

function spawnItem(type, x, y, auto = false) {
  const it = new Item(type, x, y, auto);
  G.items.push(it);
  return it;
}

function dropItems(x, y, spec) {
  for (const [type, n] of Object.entries(spec)) {
    for (let i = 0; i < n; i++) {
      spawnItem(type, x + frand(-14, 14), y + frand(-14, 14));
    }
  }
}
