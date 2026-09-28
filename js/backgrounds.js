'use strict';
// ============================================================
//  背景（ステージ背景・スペルカード背景）
//  フィールド座標 (0,0)-(384,448) に描く
// ============================================================

function makeFogTile(w, h, count, alpha, seed) {
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  const r = new RNG(seed);
  for (let i = 0; i < count; i++) {
    const px = r.next() * w, py = r.next() * h, rad = 40 + r.next() * 90;
    for (const oy of [-h, 0, h]) {
      const g = x.createRadialGradient(px, py + oy, 0, px, py + oy, rad);
      g.addColorStop(0, `rgba(220,230,255,${alpha})`);
      g.addColorStop(1, 'rgba(220,230,255,0)');
      x.fillStyle = g;
      x.fillRect(px - rad, py + oy - rad, rad * 2, rad * 2);
    }
  }
  return c;
}

function drawScrollingTile(ctx, tile, scroll, alpha = 1) {
  const h = tile.height;
  const y = scroll % h;
  ctx.globalAlpha = alpha;
  ctx.drawImage(tile, 0, y - h, FIELD_W, h);
  ctx.drawImage(tile, 0, y, FIELD_W, h);
  ctx.globalAlpha = 1;
}

// 流れ星（背景演出）
class Meteors {
  constructor(rate) { this.list = []; this.rate = rate; }
  update() {
    if (Math.random() < this.rate) {
      const fromLeft = Math.random() < 0.5;
      const sp = frand(5, 9);
      const a = fromLeft ? frand(20, 50) * DEG : frand(130, 160) * DEG;
      this.list.push({ x: fromLeft ? frand(-40, 200) : frand(184, 424), y: frand(-30, 150), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: frand(30, 60), max: 0, hue: pick(['255,255,220', '200,230,255', '255,210,240']) });
      this.list[this.list.length - 1].max = this.list[this.list.length - 1].life;
    }
    for (const m of this.list) { m.x += m.vx; m.y += m.vy; m.life--; }
    this.list = this.list.filter(m => m.life > 0);
  }
  draw(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const m of this.list) {
      const a = Math.min(1, m.life / 15) * 0.9;
      const tx = m.x - m.vx * 8, ty = m.y - m.vy * 8;
      const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
      g.addColorStop(0, `rgba(${m.hue},${a})`);
      g.addColorStop(1, `rgba(${m.hue},0)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, 1.8, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ------------------------------------------------------------
//  1面：夜の森
// ------------------------------------------------------------
class ForestBG {
  constructor() {
    this.t = 0;
    this.scroll = 0;
    this.tile = ForestBG.makeTile();
    this.fog = makeFogTile(FIELD_W, 448, 14, 0.07, 7);
    this.meteors = new Meteors(1 / 70);
    this.flies = [];
    for (let i = 0; i < 18; i++) this.flies.push({ x: frand(FIELD_W), y: frand(FIELD_H), p: frand(TAU), s: frand(0.3, 0.8) });
  }
  static pathX(y, h) { return FIELD_W / 2 + Math.sin((y / h) * TAU) * 60 + Math.sin((y / h) * TAU * 2) * 20; }
  static makeTile() {
    const w = FIELD_W, h = 640;
    const c = makeCanvas(w, h);
    const x = c.getContext('2d');
    const r = new RNG(12345);
    x.fillStyle = '#08130f';
    x.fillRect(0, 0, w, h);
    // 小道
    for (let y = -20; y < h + 20; y += 3) {
      const px = ForestBG.pathX(y, h);
      x.fillStyle = 'rgba(58,48,36,0.18)';
      x.beginPath(); x.arc(px, y, 28, 0, TAU); x.fill();
    }
    // 木々
    const trees = [];
    for (let i = 0; i < 120; i++) {
      const ty = r.next() * h;
      const tr = 16 + r.next() * 28;
      let tx = r.next() * (w + 40) - 20;
      const px = ForestBG.pathX(ty, h);
      if (Math.abs(tx - px) < tr * 0.5 + 34) tx = px + (tx < px ? -1 : 1) * (tr * 0.5 + 34 + r.next() * 30);
      trees.push({ x: tx, y: ty, r: tr, shade: r.next() });
    }
    trees.sort((a, b) => a.r - b.r);
    for (const oy of [-h, 0, h]) {
      for (const t of trees) {
        const cx = t.x, cy = t.y + oy;
        x.fillStyle = 'rgba(0,0,0,0.45)';
        x.beginPath(); x.arc(cx + 6, cy + 8, t.r, 0, TAU); x.fill();
        const g = x.createRadialGradient(cx - t.r * 0.35, cy - t.r * 0.35, t.r * 0.1, cx, cy, t.r);
        const lit = 40 + t.shade * 30;
        g.addColorStop(0, `rgb(${24 + t.shade * 10},${lit + 20},${lit})`);
        g.addColorStop(0.7, `rgb(12,${30 + t.shade * 15},24)`);
        g.addColorStop(1, 'rgb(6,16,12)');
        x.fillStyle = g;
        x.beginPath(); x.arc(cx, cy, t.r, 0, TAU); x.fill();
        x.fillStyle = 'rgba(120,170,200,0.06)';
        for (let k = 0; k < 4; k++) {
          const a = k * 1.7 + t.shade * 5;
          x.beginPath(); x.arc(cx + Math.cos(a) * t.r * 0.45, cy + Math.sin(a) * t.r * 0.45, t.r * 0.35, 0, TAU); x.fill();
        }
      }
    }
    return c;
  }
  update() {
    this.t++;
    this.scroll += 0.9;
    this.meteors.update();
    for (const f of this.flies) {
      f.p += 0.03;
      f.x += Math.cos(f.p * 0.7) * 0.3;
      f.y += f.s * 0.9 + Math.sin(f.p) * 0.2;
      if (f.y > FIELD_H + 10) { f.y = -10; f.x = frand(FIELD_W); }
    }
  }
  draw(ctx) {
    drawScrollingTile(ctx, this.tile, this.scroll);
    drawScrollingTile(ctx, this.fog, this.scroll * 1.6, 0.9);
    const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
    g.addColorStop(0, 'rgba(20,20,60,0.55)');
    g.addColorStop(0.5, 'rgba(10,10,40,0.15)');
    g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.flies) {
      const a = 0.3 + 0.3 * Math.sin(f.p * 3);
      ctx.fillStyle = `rgba(200,255,140,${a})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, 1.6, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(200,255,140,${a * 0.2})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, 5, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    this.meteors.draw(ctx);
  }
}

// ------------------------------------------------------------
//  2面：霧の湖
// ------------------------------------------------------------
class LakeBG {
  constructor() {
    this.t = 0;
    this.scroll = 0;
    this.tile = LakeBG.makeTile();
    this.fog1 = makeFogTile(FIELD_W, 448, 16, 0.11, 21);
    this.fog2 = makeFogTile(FIELD_W, 560, 10, 0.08, 33);
    this.meteors = new Meteors(1 / 50);
    this.glints = [];
    for (let i = 0; i < 40; i++) this.glints.push({ x: frand(FIELD_W), y: frand(FIELD_H), p: frand(TAU) });
  }
  static makeTile() {
    const w = FIELD_W, h = 512;
    const c = makeCanvas(w, h);
    const x = c.getContext('2d');
    const r = new RNG(999);
    x.fillStyle = '#0b2442';
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const px = r.next() * w, py = r.next() * h, len = 10 + r.next() * 40;
      for (const oy of [-h, 0, h]) {
        x.strokeStyle = `rgba(110,170,240,${0.05 + r.next() * 0.08})`;
        x.lineWidth = 1 + r.next();
        x.beginPath();
        x.moveTo(px - len / 2, py + oy);
        x.quadraticCurveTo(px, py + oy - 3, px + len / 2, py + oy);
        x.stroke();
      }
    }
    for (let i = 0; i < 70; i++) {
      const px = r.next() * w, py = r.next() * h;
      for (const oy of [-h, 0, h]) {
        x.fillStyle = `rgba(230,240,255,${0.2 + r.next() * 0.3})`;
        x.fillRect(px, py + oy, 1.4, 1.4);
      }
    }
    return c;
  }
  update() {
    this.t++;
    this.scroll += 1.1;
    this.meteors.update();
    for (const g of this.glints) {
      g.p += 0.05;
      g.y += 1.1;
      if (g.y > FIELD_H) { g.y -= FIELD_H; g.x = frand(FIELD_W); }
    }
  }
  draw(ctx) {
    drawScrollingTile(ctx, this.tile, this.scroll);
    ctx.globalCompositeOperation = 'lighter';
    for (const g of this.glints) {
      const a = Math.max(0, Math.sin(g.p)) * 0.5;
      ctx.fillStyle = `rgba(200,230,255,${a})`;
      ctx.fillRect(g.x - 3, g.y, 6 + Math.sin(g.p * 2) * 2, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
    drawScrollingTile(ctx, this.fog2, this.scroll * 0.7, 1);
    drawScrollingTile(ctx, this.fog1, this.scroll * 1.8, 1);
    const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
    g.addColorStop(0, 'rgba(30,40,80,0.35)');
    g.addColorStop(1, 'rgba(0,10,30,0.3)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    this.meteors.draw(ctx);
  }
}

// ------------------------------------------------------------
//  3面：星空
// ------------------------------------------------------------
class SkyBG {
  constructor() {
    this.t = 0;
    this.scroll = 0;
    this.milky = SkyBG.makeMilky();
    this.cloud = makeFogTile(FIELD_W, 700, 9, 0.13, 55);
    this.meteors = new Meteors(1 / 22);
    this.layers = [0.4, 0.9, 1.8].map((sp, li) => {
      const arr = [];
      for (let i = 0; i < 40 - li * 8; i++) arr.push({ x: frand(FIELD_W), y: frand(FIELD_H), p: frand(TAU), s: 0.6 + li * 0.5 });
      return { sp, arr };
    });
  }
  static makeMilky() {
    const w = FIELD_W, h = 900;
    const c = makeCanvas(w, h);
    const x = c.getContext('2d');
    const r = new RNG(4242);
    const bandX = y => w * 0.5 + Math.sin((y / h) * TAU) * 110;
    for (let i = 0; i < 90; i++) {
      const py = r.next() * h;
      const px = bandX(py) + (r.next() - 0.5) * 140;
      const rad = 30 + r.next() * 60;
      const hue = pick(['140,110,255', '90,140,255', '255,120,220', '120,200,255']);
      for (const oy of [-h, 0, h]) {
        const g = x.createRadialGradient(px, py + oy, 0, px, py + oy, rad);
        g.addColorStop(0, `rgba(${hue},0.08)`);
        g.addColorStop(1, `rgba(${hue},0)`);
        x.fillStyle = g;
        x.fillRect(px - rad, py + oy - rad, rad * 2, rad * 2);
      }
    }
    for (let i = 0; i < 900; i++) {
      const py = r.next() * h;
      const near = r.next() < 0.6;
      const px = near ? bandX(py) + (r.next() - 0.5) * 160 : r.next() * w;
      x.fillStyle = `rgba(255,255,255,${0.15 + r.next() * 0.5})`;
      const s = r.next() < 0.1 ? 1.6 : 0.9;
      x.fillRect(px, py, s, s);
      if (py < 10) x.fillRect(px, py + h, s, s);
      if (py > h - 10) x.fillRect(px, py - h, s, s);
    }
    return c;
  }
  update() {
    this.t++;
    this.scroll += 0.5;
    this.meteors.update();
    for (const L of this.layers) {
      for (const s of L.arr) {
        s.y += L.sp;
        s.p += 0.06;
        if (s.y > FIELD_H) { s.y -= FIELD_H; s.x = frand(FIELD_W); }
      }
    }
  }
  draw(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
    g.addColorStop(0, '#0a0620');
    g.addColorStop(1, '#1d1044');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    drawScrollingTile(ctx, this.milky, this.scroll);
    ctx.globalCompositeOperation = 'lighter';
    for (const L of this.layers) {
      for (const s of L.arr) {
        const a = 0.35 + 0.35 * Math.sin(s.p);
        ctx.fillStyle = `rgba(230,235,255,${a})`;
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    drawScrollingTile(ctx, this.cloud, this.scroll * 4, 0.8);
    this.meteors.draw(ctx);
  }
}

// ------------------------------------------------------------
//  4面：洞窟
// ------------------------------------------------------------
class CaveBG {
  constructor() {
    this.t = 0;
    this.scroll = 0;
    const made = CaveBG.makeTile();
    this.tile = made.canvas;
    this.crystals = made.crystals;
    this.dust = [];
    for (let i = 0; i < 40; i++) this.dust.push({ x: frand(FIELD_W), y: frand(FIELD_H), p: frand(TAU), s: frand(0.2, 0.7) });
  }
  static wallW(y, h, side) {
    const k = (y / h) * TAU;
    return side < 0
      ? 46 + Math.sin(k * 2) * 16 + Math.sin(k * 5 + 1) * 7
      : 46 + Math.sin(k * 3 + 2) * 18 + Math.sin(k * 7) * 5;
  }
  static makeTile() {
    const w = FIELD_W, h = 768;
    const c = makeCanvas(w, h);
    const x = c.getContext('2d');
    const r = new RNG(2024);
    x.fillStyle = '#17121e';
    x.fillRect(0, 0, w, h);
    // 岩肌の床
    for (let i = 0; i < 260; i++) {
      const px = r.next() * w, py = r.next() * h, rad = 6 + r.next() * 22, shade = r.next();
      for (const oy of [-h, 0, h]) {
        x.fillStyle = `rgb(${28 + shade * 16},${22 + shade * 12},${34 + shade * 16})`;
        x.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU + shade;
          const rr = rad * (0.7 + ((k * 7 + i) % 5) * 0.08);
          const vx = px + Math.cos(a) * rr, vy = py + oy + Math.sin(a) * rr * 0.8;
          if (k === 0) x.moveTo(vx, vy); else x.lineTo(vx, vy);
        }
        x.closePath();
        x.fill();
        x.strokeStyle = 'rgba(120,100,140,0.12)';
        x.stroke();
      }
    }
    // 水たまり
    for (let i = 0; i < 6; i++) {
      const px = 90 + r.next() * (w - 180), py = r.next() * h, rw = 20 + r.next() * 30;
      for (const oy of [-h, 0, h]) {
        x.fillStyle = 'rgba(30,50,90,0.55)';
        x.beginPath(); x.ellipse(px, py + oy, rw, rw * 0.45, 0, 0, TAU); x.fill();
        x.strokeStyle = 'rgba(140,180,255,0.18)';
        x.beginPath(); x.ellipse(px - rw * 0.2, py + oy - 2, rw * 0.5, rw * 0.15, 0, 0, TAU); x.stroke();
      }
    }
    // 左右の壁
    for (const side of [-1, 1]) {
      x.fillStyle = '#0a080e';
      x.beginPath();
      x.moveTo(side < 0 ? 0 : w, 0);
      for (let y = 0; y <= h; y += 6) {
        const ww = CaveBG.wallW(y, h, side);
        x.lineTo(side < 0 ? ww : w - ww, y);
      }
      x.lineTo(side < 0 ? 0 : w, h);
      x.closePath();
      x.fill();
      x.strokeStyle = 'rgba(150,120,170,0.35)';
      x.lineWidth = 2;
      x.beginPath();
      for (let y = 0; y <= h; y += 6) {
        const ww = CaveBG.wallW(y, h, side);
        if (y === 0) x.moveTo(side < 0 ? ww : w - ww, y); else x.lineTo(side < 0 ? ww : w - ww, y);
      }
      x.stroke();
    }
    // 水晶
    const crystals = [];
    for (let i = 0; i < 22; i++) {
      const py = r.next() * h;
      const side = r.next() < 0.5 ? -1 : 1;
      const px = side < 0 ? CaveBG.wallW(py, h, -1) + 4 : w - CaveBG.wallW(py, h, 1) - 4;
      const hue = r.next() < 0.7 ? '120,200,255' : '190,150,255';
      crystals.push({ x: px, y: py, hue, p: r.next() * TAU });
      for (const oy of [-h, 0, h]) {
        for (let k = 0; k < 3; k++) {
          const a = (side < 0 ? 0 : Math.PI) + (k - 1) * 0.5 + (r.next() - 0.5) * 0.3;
          const len = 8 + r.next() * 10;
          x.save();
          x.translate(px, py + oy);
          x.rotate(a);
          x.fillStyle = `rgba(${hue},0.75)`;
          x.beginPath(); x.moveTo(0, -3); x.lineTo(len - 3, -3); x.lineTo(len, 0); x.lineTo(len - 3, 3); x.lineTo(0, 3); x.closePath();
          x.fill();
          x.restore();
        }
      }
    }
    return { canvas: c, crystals };
  }
  update() {
    this.t++;
    this.scroll += 1.0;
    for (const d of this.dust) {
      d.p += 0.02;
      d.y += d.s;
      d.x += Math.sin(d.p) * 0.2;
      if (d.y > FIELD_H) { d.y = 0; d.x = frand(FIELD_W); }
    }
  }
  draw(ctx) {
    drawScrollingTile(ctx, this.tile, this.scroll);
    const h = this.tile.height, off = this.scroll % h;
    ctx.globalCompositeOperation = 'lighter';
    for (const c of this.crystals) {
      const a = 0.25 + 0.2 * Math.sin(this.t * 0.05 + c.p);
      for (const y of [c.y + off, c.y + off - h]) {
        if (y < -30 || y > FIELD_H + 30) continue;
        const g = ctx.createRadialGradient(c.x, y, 0, c.x, y, 26);
        g.addColorStop(0, `rgba(${c.hue},${a})`);
        g.addColorStop(1, `rgba(${c.hue},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(c.x, y, 26, 0, TAU); ctx.fill();
      }
    }
    for (const d of this.dust) {
      ctx.fillStyle = `rgba(200,220,255,${0.15 + 0.15 * Math.sin(d.p * 3)})`;
      ctx.fillRect(d.x, d.y, 1.5, 1.5);
    }
    ctx.globalCompositeOperation = 'source-over';
    // 洞窟の暗さ：自機のまわりだけ少し明るい
    const p = G && G.player ? G.player : { x: FIELD_W / 2, y: FIELD_H - 48 };
    const v = ctx.createRadialGradient(p.x, p.y, 60, p.x, p.y, 420);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  }
}

// ------------------------------------------------------------
//  スペルカード背景
// ------------------------------------------------------------
function drawSpellBG(ctx, kind, t) {
  ctx.save();
  switch (kind) {
    case 'rumia': {
      ctx.fillStyle = '#0c0008';
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
      const mg = ctx.createRadialGradient(192, 140, 10, 192, 140, 140);
      mg.addColorStop(0, 'rgba(160,20,40,0.55)');
      mg.addColorStop(0.45, 'rgba(90,0,30,0.35)');
      mg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
      ctx.translate(192, 180);
      for (let i = 0; i < 7; i++) {
        ctx.save();
        ctx.rotate(t * 0.006 + (i * TAU) / 7);
        ctx.fillStyle = 'rgba(70,0,40,0.28)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(160, -60, 330, 40);
        ctx.quadraticCurveTo(170, -10, 0, 30);
        ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = 'rgba(255,60,90,0.18)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(0, 0, 60 + k * 50 + Math.sin(t * 0.03 + k) * 6, 0, TAU);
        ctx.stroke();
      }
      break;
    }
    case 'cirno': {
      const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
      g.addColorStop(0, '#08234a');
      g.addColorStop(1, '#0d4478');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
      ctx.strokeStyle = 'rgba(200,240,255,0.2)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const cx = (i * 97 + 40) % FIELD_W, cy = ((i * 173 + t * 0.6) % (FIELD_H + 160)) - 80;
        const rad = 30 + (i % 3) * 18;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 0.004 * (i % 2 ? 1 : -1) + i);
        for (let k = 0; k < 6; k++) {
          ctx.rotate(TAU / 6);
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.lineTo(rad, 0);
          ctx.moveTo(rad * 0.55, 0); ctx.lineTo(rad * 0.75, rad * 0.18);
          ctx.moveTo(rad * 0.55, 0); ctx.lineTo(rad * 0.75, -rad * 0.18);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 60; i++) {
        const x = (i * 61.7 + Math.sin(t * 0.02 + i) * 12) % FIELD_W;
        const y = (i * 37.3 + t * (0.8 + (i % 5) * 0.3)) % FIELD_H;
        ctx.fillRect(x, y, 2, 2);
      }
      break;
    }
    case 'star': {
      ctx.fillStyle = '#060320';
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
      const ng = ctx.createRadialGradient(192, 200, 20, 192, 200, 260);
      ng.addColorStop(0, 'rgba(90,70,200,0.35)');
      ng.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ng;
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
      ctx.translate(192, 200);
      for (let ring = 0; ring < 4; ring++) {
        const rad = 50 + ring * 55;
        const n = 8 + ring * 6;
        ctx.save();
        ctx.rotate(t * 0.003 * (ring % 2 ? -1 : 1) * (1 + ring * 0.3));
        ctx.strokeStyle = 'rgba(150,170,255,0.14)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, rad, 0, TAU); ctx.stroke();
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          const tw = 0.4 + 0.4 * Math.sin(t * 0.05 + i * 1.3 + ring);
          ctx.fillStyle = `rgba(220,230,255,${tw})`;
          ctx.fillRect(Math.cos(a) * rad - 1.2, Math.sin(a) * rad - 1.2, 2.4, 2.4);
        }
        ctx.restore();
      }
      ctx.rotate(-t * 0.002);
      ctx.fillStyle = 'rgba(160,180,255,0.07)';
      starPath(ctx, 190, 70, 6);
      ctx.fill();
      break;
    }
    case 'dream': {
      // 3面ボス：羊毛の雲と片羽の蝶が漂う夢
      const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
      g.addColorStop(0, '#1c1036');
      g.addColorStop(0.6, '#3a2152');
      g.addColorStop(1, '#4c2a4c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
      for (let i = 0; i < 7; i++) {
        const cx = (i * 83 + 40) % FIELD_W;
        const cy = FIELD_H + 80 - ((t * 0.4 + i * 97) % (FIELD_H + 160));
        ctx.fillStyle = 'rgba(255,238,250,0.07)';
        for (let k = 0; k < 5; k++) {
          ctx.beginPath();
          ctx.arc(cx + Math.cos(k * 1.3) * 20, cy + Math.sin(k * 1.7) * 10, 16 + (k % 3) * 6, 0, TAU);
          ctx.fill();
        }
      }
      for (let i = 0; i < 5; i++) {
        const x = ((i * 131 + t * 0.3) % (FIELD_W + 40)) - 20;
        const y = 60 + i * 80 + Math.sin(t * 0.02 + i) * 20;
        const flap = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.08 + i));
        ctx.fillStyle = 'rgba(230,180,255,0.13)';
        ctx.beginPath(); ctx.ellipse(x + 8 * flap, y - 5, 12 * flap, 8, 0.5, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + 6 * flap, y + 6, 8 * flap, 5, -0.5, 0, TAU); ctx.fill();
      }
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.15 * Math.sin(t * 0.05 + i)})`;
        ctx.fillRect((i * 57.3) % FIELD_W, (i * 91.7) % FIELD_H, 1.6, 1.6);
      }
      break;
    }
    case 'lapis': {
      // 4面ボス：瑠璃色の夜、舞う頁と蝶
      const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
      g.addColorStop(0, '#020a2c');
      g.addColorStop(1, '#0c1e5e');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
      ctx.save();
      ctx.translate(192, 190);
      for (let i = 0; i < 18; i++) {
        const a = t * 0.004 * (i % 2 ? 1 : -1) + (i * TAU) / 18;
        const rr = 70 + (i % 4) * 45;
        ctx.save();
        ctx.translate(Math.cos(a) * rr, Math.sin(a) * rr);
        ctx.rotate(a + t * 0.01);
        ctx.fillStyle = 'rgba(190,210,255,0.07)';
        ctx.strokeStyle = 'rgba(190,210,255,0.16)';
        ctx.fillRect(-11, -15, 22, 30);
        ctx.strokeRect(-11, -15, 22, 30);
        ctx.restore();
      }
      ctx.restore();
      for (let i = 0; i < 6; i++) {
        const x = ((i * 97 + t * 0.5) % (FIELD_W + 60)) - 30;
        const y = FIELD_H - ((t * 0.6 + i * 83) % (FIELD_H + 40));
        const flap = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.1 + i * 2));
        ctx.fillStyle = 'rgba(80,150,255,0.18)';
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.ellipse(x + s * 7 * flap, y - 3, 8 * flap, 6, s * 0.4, 0, TAU); ctx.fill();
        }
      }
      break;
    }
    default: {
      ctx.fillStyle = '#100820';
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    }
  }
  ctx.restore();
}
