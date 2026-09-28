'use strict';
// ============================================================
//  自機
// ============================================================

const PLAYER_TYPES = {
  reimu: {
    speed: 4.5, focusSpeed: 2.0, hitR: 2.2, deathbomb: 15,
    shotDesc: ['高速移動：ホーミングアミュレット', '低速移動：パスウェイジョンニードル'],
    bombName: '霊符「夢想封印」',
    desc: '誘導弾で敵を自動で狙う、扱いやすいタイプ。\nボムは画面中の敵を追いかける光の玉。',
  },
  marisa: {
    speed: 5.0, focusSpeed: 2.2, hitR: 2.4, deathbomb: 12,
    shotDesc: ['高速移動：マジックミサイル', '低速移動：イリュージョンレーザー'],
    bombName: '恋符「マスタースパーク」',
    desc: '攻撃力と移動速度に優れたパワータイプ。\nボムは前方を焼き払う極太レーザー。',
  },
};

const OPT_LAYOUT = {
  un: [[], [[0, -30]], [[-26, -6], [26, -6]], [[-30, -2], [0, -32], [30, -2]], [[-34, 4], [-16, -24], [16, -24], [34, 4]]],
  fo: [[], [[0, -24]], [[-10, -22], [10, -22]], [[-14, -18], [0, -28], [14, -18]], [[-18, -14], [-7, -26], [7, -26], [18, -14]]],
};

// ------------------------------------------------------------
//  自機ショット
// ------------------------------------------------------------
class PShot {
  constructor(kind, x, y, vx, vy, dmg) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.dmg = dmg;
    this.alive = true;
    this.r = kind === 'missile' ? 7 : 6;
    this.frame = 0;
    this.target = null;
  }
  update() {
    this.frame++;
    if (this.kind === 'homing') {
      if (!this.target || !this.target.alive || this.target.untouchable) this.target = G.nearestTarget(this.x, this.y);
      const sp = 11;
      let a = Math.atan2(this.vy, this.vx);
      if (this.target) {
        const want = angleTo(this.x, this.y, this.target.x, this.target.y);
        a += clamp(normAngle(want - a), -0.22, 0.22);
      }
      this.vx = Math.cos(a) * sp;
      this.vy = Math.sin(a) * sp;
    }
    if (this.kind === 'missile') this.vy -= 0.4;
    this.x += this.vx;
    this.y += this.vy;
    if (this.y < -24 || this.y > FIELD_H + 24 || this.x < -24 || this.x > FIELD_W + 24) this.alive = false;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(this.vy, this.vx) + Math.PI / 2);
    switch (this.kind) {
      case 'amulet':
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#fff';
        ctx.fillRect(-3.5, -7, 7, 14);
        ctx.fillStyle = '#e03040';
        ctx.fillRect(-2, -4, 4, 8);
        break;
      case 'homing':
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = '#f4e8ff';
        ctx.fillRect(-3, -5, 6, 10);
        ctx.fillStyle = '#a050ff';
        ctx.fillRect(-1.5, -3, 3, 6);
        break;
      case 'needle':
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#ffd0e0';
        ctx.fillRect(-1.5, -12, 3, 24);
        ctx.fillStyle = '#ff4060';
        ctx.fillRect(-0.7, -12, 1.4, 24);
        break;
      case 'star':
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#fff0a0';
        starPath(ctx, 6, 2.6);
        ctx.fill();
        break;
      case 'missile':
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = '#80ff90';
        ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(3, 2); ctx.lineTo(-3, 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(160,255,200,0.4)';
        ctx.fillRect(-2, 2, 4, 8);
        break;
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------
//  ボム：霊符「夢想封印」
// ------------------------------------------------------------
class FantasySeal {
  constructor(p) {
    this.p = p;
    this.frame = 0;
    this.done = false;
    this.slow = false;
    const colors = ['#ff5060', '#ffa040', '#ffe050', '#60f070', '#50d8ff', '#6070ff', '#c060ff', '#ff70d0'];
    this.orbs = colors.map((c, i) => ({ c, a: (i * TAU) / 8, r: 0, x: p.x, y: p.y, vx: 0, vy: 0, alive: true, target: null }));
  }
  update(g) {
    this.frame++;
    const f = this.frame;
    if (f < 150) { g.bullets.cancelAll(true); g.clearLasers(); }
    for (const o of this.orbs) {
      if (!o.alive) continue;
      if (f < 40) {
        o.a += 0.14;
        o.r = 56 * Ease.outCubic(f / 40);
        o.x = this.p.x + Math.cos(o.a) * o.r;
        o.y = this.p.y + Math.sin(o.a) * o.r;
        o.vx = Math.cos(o.a + Math.PI / 2) * 3;
        o.vy = Math.sin(o.a + Math.PI / 2) * 3 - 2;
        continue;
      }
      if (!o.target || !o.target.alive) o.target = g.nearestTarget(o.x, o.y);
      const tx = o.target ? o.target.x : o.x, ty = o.target ? o.target.y : -60;
      const a = angleTo(o.x, o.y, tx, ty);
      o.vx = o.vx * 0.9 + Math.cos(a) * 1.1;
      o.vy = o.vy * 0.9 + Math.sin(a) * 1.1;
      o.x += o.vx;
      o.y += o.vy;
      const hitTarget = o.target && dist(o.x, o.y, o.target.x, o.target.y) < (o.target.r || 16) + 12;
      if (hitTarget || f > 40 + 100 + this.orbs.indexOf(o) * 6 || o.y < -40) {
        o.alive = false;
        g.areaDamage(o.x, o.y, 80, 45, true);
        Fx.explosion(o.x, o.y, hexA(o.c, 0.8), 2.2);
        g.shake = Math.max(g.shake, 8);
        Sound.se('kill');
      }
    }
    if (f > 60 && this.orbs.every(o => !o.alive)) this.done = true;
  }
  draw(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    for (const o of this.orbs) {
      if (!o.alive) continue;
      const pulse = 22 + Math.sin(this.frame * 0.4) * 3;
      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, pulse);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.35, hexA(o.c, 0.8));
      g.addColorStop(1, hexA(o.c, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(o.x, o.y, pulse, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ------------------------------------------------------------
//  ボム：恋符「マスタースパーク」
//  紅魔郷のマスタースパークにならい、魔理沙から上へ扇状に広がる極太の光線。
//  根元の幅は約64px、画面の上端では画面幅の7割ほどを覆う。
// ------------------------------------------------------------
const MS_BASE_HW = 32;   // 根元の半幅
const MS_SPREAD = 0.26;  // 上へ1px進むごとに増える半幅

class MasterSpark {
  constructor(p) {
    this.p = p;
    this.frame = 0;
    this.done = false;
    this.slow = true;
    this.duration = 210;
  }
  // 出力（0〜1）。出始めと終わりは細くなる
  power() {
    const f = this.frame;
    if (f < 20) return Ease.outCubic(f / 20);
    if (f > this.duration - 30) return Math.max(0, (this.duration - f) / 30);
    return 1 + Math.sin(f * 0.8) * 0.04;
  }
  // 根元から上に d 離れた位置での半幅
  halfWidth(d) { return this.power() * (MS_BASE_HW + Math.max(0, d) * MS_SPREAD); }
  // (x, y) が光線の中か（margin は相手の大きさ）
  inBeam(x, y, margin) {
    const ox = this.p.x, oy = this.p.y - 16;
    if (y > oy + margin) return false;
    return Math.abs(x - ox) < this.halfWidth(oy - y) + margin;
  }
  update(g) {
    this.frame++;
    if (this.frame === 1) { g.bullets.cancelAll(true); g.clearLasers(); }
    g.bullets.cancelIn(b => this.inBeam(b.x, b.y, 12));
    if (this.frame % 2 === 0 && this.frame > 10) {
      for (const e of g.enemies) {
        if (e.alive && this.inBeam(e.x, e.y, e.r)) g.damageEnemy(e, 3.4, true);
      }
      const b = g.boss;
      if (b && b.alive && this.inBeam(b.x, b.y, b.r)) g.damageEnemy(b, 3.4, true);
    }
    g.shake = Math.max(g.shake, 3);
    if (this.frame >= this.duration) this.done = true;
  }
  draw(ctx) {
    const k = this.power();
    if (k <= 0.01) return;
    const x = this.p.x, y = this.p.y - 16;
    const top = -24, d = y - top;
    const hue = (this.frame * 6) % 360;
    ctx.globalCompositeOperation = 'lighter';
    // 外側ほど色が濃く、中心ほど白い扇形を重ねる
    const layers = [
      [1.0, `hsla(${hue},100%,60%,0.3)`],
      [0.8, `hsla(${(hue + 90) % 360},100%,65%,0.32)`],
      [0.58, `hsla(${(hue + 180) % 360},100%,75%,0.38)`],
      [0.36, 'rgba(255,255,255,0.5)'],
      [0.16, 'rgba(255,255,255,0.8)'],
    ];
    const hb0 = this.halfWidth(0), ht0 = this.halfWidth(d);
    for (const [s, color] of layers) {
      const hb = hb0 * s, ht = ht0 * s;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x - hb, y); ctx.lineTo(x - ht, top); ctx.lineTo(x + ht, top); ctx.lineTo(x + hb, y);
      ctx.closePath();
      ctx.fill();
    }
    const r = hb0 * 1.7;
    const og = ctx.createRadialGradient(x, y, 0, x, y, r);
    og.addColorStop(0, 'rgba(255,255,255,0.95)');
    og.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 18; i++) {
      const sy = y - ((this.frame * 14 + i * 53) % d);
      const sx = x + Math.sin(i * 12.9 + this.frame * 0.2) * this.halfWidth(y - sy) * 0.85;
      ctx.fillRect(sx - 1, sy, 2, 12);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ------------------------------------------------------------
//  自機本体
// ------------------------------------------------------------
function drawYinYang(ctx, x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d82030';
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.arc(0, r / 2, r / 2, Math.PI / 2, -Math.PI / 2, true);
  ctx.arc(0, -r / 2, r / 2, Math.PI / 2, -Math.PI / 2, false);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(0, r / 2, r / 6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d82030';
  ctx.beginPath(); ctx.arc(0, -r / 2, r / 6, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.restore();
}

class Player {
  constructor(id) {
    this.id = id;
    this.type = PLAYER_TYPES[id];
    this.hitR = this.type.hitR;
    this.grazeR = 20;
    this.x = FIELD_W / 2;
    this.y = FIELD_H - 48;
    this.state = 'normal';
    this.timer = 0;
    this.invuln = 0;
    this.frame = 0;
    this.tilt = 0;
    this.focused = false;
    this.focusT = 0;
    this.shotFrame = 0;
    this.bomb = null;
    this.opts = [];
    this.lasers = [];
  }

  get visible() { return this.state !== 'dead'; }

  update(g) {
    this.frame++;
    const move = Input.consumeMove();
    if (this.invuln > 0) this.invuln--;
    if (this.bomb) {
      this.bomb.update(g);
      if (this.bomb.done) this.bomb = null;
    }
    this.lasers = [];
    switch (this.state) {
      case 'hit':
        this.timer--;
        if (Input.pressed('bomb') && g.bombs > 0) {
          this.state = 'normal';
          this.useBomb(g);
        } else if (this.timer <= 0) this.die(g);
        return;
      case 'dead':
        this.timer--;
        if (this.timer <= 0) {
          if (g.lives < 0) { g.onOutOfLives(); return; }
          this.state = 'respawn';
          this.timer = 40;
          this.x = FIELD_W / 2;
          this.y = FIELD_H + 30;
          this.invuln = 220;
        }
        return;
      case 'respawn':
        this.timer--;
        this.y = lerp(FIELD_H + 30, FIELD_H - 48, Ease.outCubic(1 - this.timer / 40));
        if (this.timer <= 0) this.state = 'normal';
        this.updateOptions(g);
        return;
    }

    this.focused = Input.down('focus');
    this.focusT += ((this.focused ? 1 : 0) - this.focusT) * 0.3;
    let dx = (Input.down('right') ? 1 : 0) - (Input.down('left') ? 1 : 0);
    let dy = (Input.down('down') ? 1 : 0) - (Input.down('up') ? 1 : 0);
    let sp = this.focused ? this.type.focusSpeed : this.type.speed;
    if (this.bomb && this.bomb.slow) sp *= 0.5;
    if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
    this.x += dx * sp;
    this.y += dy * sp;
    if (move.x || move.y) {
      const s = this.focused ? 0.75 : 1.25;
      this.x += move.x * s;
      this.y += move.y * s;
      dx = clamp(move.x, -1, 1);
    }
    this.x = clamp(this.x, 8, FIELD_W - 8);
    this.y = clamp(this.y, 16, FIELD_H - 16);
    this.tilt += (dx - this.tilt) * 0.2;

    const shooting = (Input.down('shot') || Input.dragging) && g.canShoot();
    if (shooting) this.shoot(g); else this.shotFrame = 0;
    if (Input.pressed('bomb') && g.canShoot()) this.useBomb(g);
    this.updateOptions(g);
    if (shooting && this.id === 'marisa' && this.focused) this.fireLasers(g);
  }

  updateOptions(g) {
    const n = Math.min(4, Math.floor(g.power / 100));
    while (this.opts.length < n) this.opts.push({ x: this.x, y: this.y });
    this.opts.length = n;
    const un = OPT_LAYOUT.un[n], fo = OPT_LAYOUT.fo[n];
    for (let i = 0; i < n; i++) {
      const tx = this.x + lerp(un[i][0], fo[i][0], this.focusT);
      const ty = this.y + lerp(un[i][1], fo[i][1], this.focusT);
      const o = this.opts[i];
      o.x += (tx - o.x) * 0.4;
      o.y += (ty - o.y) * 0.4;
    }
  }

  shoot(g) {
    const f = this.shotFrame++;
    if (f % 5 === 0) Sound.se('shot');
    const shots = g.shots;
    if (this.id === 'reimu') {
      if (f % 4 === 0) {
        shots.push(new PShot('amulet', this.x - 6, this.y - 10, 0, -16, 1));
        shots.push(new PShot('amulet', this.x + 6, this.y - 10, 0, -16, 1));
      }
      if (this.focused) {
        if (f % 4 === 0) for (const o of this.opts) shots.push(new PShot('needle', o.x, o.y - 8, 0, -20, 1.8));
      } else if (f % 8 === 0) {
        this.opts.forEach((o, i) => {
          const a = -Math.PI / 2 + (i - (this.opts.length - 1) / 2) * 0.35;
          const s = new PShot('homing', o.x, o.y, Math.cos(a) * 11, Math.sin(a) * 11, 2);
          shots.push(s);
        });
      }
    } else {
      if (f % 4 === 0) {
        shots.push(new PShot('star', this.x - 6, this.y - 10, 0, -17, 1.2));
        shots.push(new PShot('star', this.x + 6, this.y - 10, 0, -17, 1.2));
      }
      if (!this.focused && f % 10 === 0) {
        this.opts.forEach((o, i) => {
          const a = -Math.PI / 2 + (i - (this.opts.length - 1) / 2) * 0.14;
          shots.push(new PShot('missile', o.x, o.y - 6, Math.cos(a) * 6, Math.sin(a) * 6, 4.5));
        });
      }
    }
  }

  // 魔理沙の低速レーザー：一番手前の敵で止まる
  fireLasers(g) {
    for (const o of this.opts) {
      let best = null, bestY = -Infinity;
      const consider = e => {
        if (!e || !e.alive || e.untouchable || e.y > o.y || e.y < -20) return;
        if (Math.abs(e.x - o.x) < e.r + 4 && e.y > bestY) { best = e; bestY = e.y; }
      };
      for (const e of g.enemies) consider(e);
      consider(g.boss);
      const endY = best ? best.y + 4 : -20;
      if (best) {
        g.damageEnemy(best, 0.42, false, this.frame % 2 === 0);
        if (this.frame % 3 === 0) Fx.hit(o.x, best.y + 6);
      }
      this.lasers.push({ x: o.x, y0: o.y - 6, y1: endY });
    }
  }

  useBomb(g) {
    if (this.bomb || g.bombs <= 0) return;
    g.bombs--;
    g.bombsUsed++;
    g.spellFailed = true;
    this.invuln = Math.max(this.invuln, this.id === 'reimu' ? 250 : 270);
    this.bomb = this.id === 'reimu' ? new FantasySeal(this) : new MasterSpark(this);
    g.showBombName(this.type.bombName);
    g.flash = { color: '255,255,255', a: 0.5 };
    Sound.se('bomb');
  }

  hit(g) {
    if (this.state !== 'normal' || this.invuln > 0) return;
    this.state = 'hit';
    this.timer = this.type.deathbomb;
    Sound.se('pichuun');
    Fx.flash(this.x, this.y, 'rgba(255,120,200,0.8)', 24, 12);
  }

  die(g) {
    this.state = 'dead';
    this.timer = 60;
    this.bomb = null;
    Fx.playerDeath(this.x, this.y);
    g.onPlayerDeath(this.x, this.y);
  }

  draw(ctx) {
    if (!this.visible) return;
    const blink = this.invuln > 0 && (this.frame % 6 < 3);
    // オプション
    for (let i = 0; i < this.opts.length; i++) {
      const o = this.opts[i];
      if (this.id === 'reimu') drawYinYang(ctx, o.x, o.y, 6, this.frame * 0.12 * (i % 2 ? 1 : -1));
      else {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, 9);
        g.addColorStop(0, 'rgba(255,255,220,0.95)');
        g.addColorStop(0.4, 'rgba(120,255,140,0.7)');
        g.addColorStop(1, 'rgba(60,200,100,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(o.x, o.y, 9, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#fff8c0';
        ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(this.frame * 0.08); starPath(ctx, 4, 1.8); ctx.fill(); ctx.restore();
      }
    }
    // 魔理沙のレーザー
    if (this.lasers.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const l of this.lasers) {
        const w = 5 + Math.sin(this.frame * 0.9) * 1;
        const g = ctx.createLinearGradient(l.x - w, 0, l.x + w, 0);
        g.addColorStop(0, 'rgba(80,255,120,0)');
        g.addColorStop(0.5, 'rgba(230,255,200,0.75)');
        g.addColorStop(1, 'rgba(80,255,120,0)');
        ctx.fillStyle = g;
        ctx.fillRect(l.x - w, l.y1, w * 2, l.y0 - l.y1);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (blink) ctx.globalAlpha = 0.35;
    ctx.save();
    ctx.translate(this.x, this.y + Math.sin(this.frame * 0.1) * 0.6);
    if (this.id === 'reimu' && Images.get('player')) {
      // 霊夢は画像の自機（高さ30px）。移動方向に少し傾ける
      ctx.transform(1, 0, -this.tilt * 0.12, 1, 0, 0);
      drawImageSprite(ctx, 'player', 30, 0.3, 0.52);
    } else {
      // 図形で描く自機（小さめに縮小）
      ctx.scale(0.65, 0.65);
      ctx.translate(0, 3);
      drawPlayerBack(ctx, this.id, this.frame, this.tilt);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // 当たり判定表示（弾より手前に描く）
  drawHitbox(ctx) {
    if (!this.visible || this.focusT < 0.05) return;
    const a = this.focusT;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = a * 0.8;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1;
    ctx.rotate(this.frame * 0.04);
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      ctx.rotate(TAU / 8);
      ctx.fillStyle = i % 2 ? 'rgba(255,160,200,0.9)' : 'rgba(255,255,255,0.9)';
      ctx.fillRect(24, -1.5, 5, 3);
    }
    ctx.rotate(-this.frame * 0.08);
    ctx.strokeStyle = 'rgba(255,190,220,0.6)';
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.stroke();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#e03050';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, this.hitR + 1.2, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
