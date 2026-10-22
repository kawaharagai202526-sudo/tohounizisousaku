'use strict';
// ============================================================
//  背景（ステージ背景・スペルカード背景）
//  フィールド座標 (0,0)-(384,448) に描く
//  ステージ背景は update()（毎フレーム）と draw(ctx) を持つクラスで、STAGES の bg に書く。
//  event(名前) があれば、会話の { event: '名前' } で呼ばれる（3面で屋敷が姿を現す演出など）
// ============================================================

function makeFogTile(w, h, count, alpha, seed, rgb = '220,230,255') {
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  const r = new RNG(seed);
  for (let i = 0; i < count; i++) {
    const px = r.next() * w, py = r.next() * h, rad = 40 + r.next() * 90;
    for (const oy of [-h, 0, h]) {
      const g = x.createRadialGradient(px, py + oy, 0, px, py + oy, rad);
      g.addColorStop(0, `rgba(${rgb},${alpha})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
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

// 縦にくり返す絵（高さ h）の中の y が、いま画面のどこに見えるか（見えない位置は除く）
function tileYs(y, scroll, h, m = 40) {
  const a = (((y + scroll) % h) + h) % h;
  return [a, a - h].filter(v => v > -m && v < FIELD_H + m);
}

// ぼんやり光る丸（あかり）。毎フレーム作らないように、色と大きさごとに作っておく
const GLOW_CACHE = {};
function glowSprite(rgb, r) {
  const k = `${rgb}:${r}`;
  if (GLOW_CACHE[k]) return GLOW_CACHE[k];
  const c = makeCanvas(r * 2, r * 2);
  const x = c.getContext('2d');
  const g = x.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, `rgba(${rgb},1)`);
  g.addColorStop(0.35, `rgba(${rgb},0.45)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g;
  x.fillRect(0, 0, r * 2, r * 2);
  return (GLOW_CACHE[k] = c);
}

// ぎざぎざの穴（屋根の穴・床の穴）
function jaggedBlob(x, cx, cy, rad, r, sq = 0.8) {
  x.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU, rr = rad * (0.55 + r.next() * 0.6);
    x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * sq);
  }
  x.closePath();
}

// ------------------------------------------------------------
//  上から見た屋根（瓦・茅葺き）。一晩で古びたので、穴・苔・ずれた瓦がある
//  r は屋根ごとの乱数（同じ屋根を何度描いても同じ形になるように、毎回作り直して渡す）
// ------------------------------------------------------------
function drawRoof(x, rx, ry, rw, rh, kind, r, tone = 0) {
  x.fillStyle = 'rgba(0,0,0,0.45)';
  x.fillRect(rx + 5, ry + 6, rw, rh);
  const mid = ry + rh / 2;
  if (kind === 'kaya') {
    x.fillStyle = '#4e4030';
    x.fillRect(rx, ry, rw, rh / 2);
    x.fillStyle = '#665538';
    x.fillRect(rx, mid, rw, rh / 2);
    x.strokeStyle = 'rgba(28,20,10,0.45)';
    x.lineWidth = 1;
    for (let i = 0; i < (rw * rh) / 36; i++) {
      const px = rx + r.next() * rw, py = ry + r.next() * rh;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r.next() - 0.5) * 2, py + 3 + r.next() * 4); x.stroke();
    }
    x.fillStyle = '#33281a';
    x.fillRect(rx, mid - 5, rw, 10);
    x.fillStyle = 'rgba(255,230,180,0.08)';
    x.fillRect(rx, mid - 5, rw, 2);
  } else {
    const shade = 40 + tone * 14;
    x.fillStyle = `rgb(${shade - 6},${shade},${shade + 12})`;
    x.fillRect(rx, ry, rw, rh / 2);
    x.fillStyle = `rgb(${shade + 10},${shade + 17},${shade + 32})`;
    x.fillRect(rx, mid, rw, rh / 2);
    for (let px = rx + 2; px < rx + rw; px += 6) {
      x.fillStyle = 'rgba(255,255,255,0.05)';
      x.fillRect(px, ry, 2, rh);
      x.fillStyle = 'rgba(0,0,0,0.2)';
      x.fillRect(px + 3, ry, 1, rh);
    }
    for (let py = ry + 5; py < ry + rh; py += 7) {
      x.fillStyle = 'rgba(0,0,0,0.22)';
      x.fillRect(rx, py, rw, 1);
    }
    x.fillStyle = '#181b22';
    x.fillRect(rx - 2, mid - 3, rw + 4, 6);
    x.fillStyle = 'rgba(160,170,200,0.25)';
    x.fillRect(rx - 2, mid - 3, rw + 4, 1.5);
    // 棟の両はしの鬼瓦
    for (const ex of [rx - 1, rx + rw + 1]) {
      x.fillStyle = '#20242c';
      x.beginPath(); x.arc(ex, mid, 6, 0, TAU); x.fill();
      x.fillStyle = 'rgba(160,170,200,0.25)';
      x.beginPath(); x.arc(ex - 1, mid - 1, 2.5, 0, TAU); x.fill();
    }
    x.strokeStyle = 'rgba(0,0,0,0.5)';
    x.lineWidth = 2;
    x.strokeRect(rx, ry, rw, rh);
  }
  // 古びた跡
  const holes = 1 + Math.floor(r.next() * 3);
  for (let i = 0; i < holes; i++) {
    const hx = rx + 8 + r.next() * (rw - 16), hy = ry + 6 + r.next() * (rh - 12), hr = 4 + r.next() * 9;
    x.fillStyle = '#0a0806';
    jaggedBlob(x, hx, hy, hr, r);
    x.fill();
    x.strokeStyle = 'rgba(120,86,52,0.75)';
    x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(hx - hr * 0.8, hy - hr * 0.2); x.lineTo(hx + hr * 0.7, hy + hr * 0.15); x.stroke();
  }
  for (let i = 0; i < 3; i++) {
    x.fillStyle = `rgba(70,110,50,${0.15 + r.next() * 0.2})`;
    jaggedBlob(x, rx + r.next() * rw, ry + r.next() * rh, 3 + r.next() * 7, r, 0.7);
    x.fill();
  }
  if (kind !== 'kaya') {
    for (let i = 0; i < 4; i++) {
      x.save();
      x.translate(rx + 4 + r.next() * (rw - 8), ry + 4 + r.next() * (rh - 8));
      x.rotate((r.next() - 0.5) * 1.2);
      x.fillStyle = 'rgba(120,130,150,0.55)';
      x.fillRect(-3, -2.5, 6, 5);
      x.restore();
    }
  }
}

// ------------------------------------------------------------
//  1面：一夜で古びた里（夜の人里を屋根の上から見下ろす）
// ------------------------------------------------------------
class VillageRoofBG {
  constructor() {
    this.t = 0;
    this.scroll = 0;
    this.lanterns = [];
    this.tile = this.makeTile();
    this.fog = makeFogTile(FIELD_W, 448, 10, 0.05, 11);
    this.dust = [];
    for (let i = 0; i < 22; i++) this.dust.push({ x: frand(FIELD_W), y: frand(FIELD_H), p: frand(TAU), s: frand(0.4, 1.0), leaf: Math.random() < 0.4 });
  }
  static streetX(y, h) { return FIELD_W / 2 + Math.sin((y / h) * TAU) * 26 + Math.sin((y / h) * TAU * 3) * 6; }
  makeTile() {
    const w = FIELD_W, h = 960;
    const c = makeCanvas(w, h);
    const x = c.getContext('2d');
    const r = new RNG(1915);
    x.fillStyle = '#15120e';
    x.fillRect(0, 0, w, h);
    // 大通り（土の道）
    for (let y = 0; y < h; y += 2) {
      const sx = VillageRoofBG.streetX(y, h);
      x.fillStyle = '#2b241b';
      x.fillRect(sx - 36, y, 72, 2);
      x.fillStyle = 'rgba(0,0,0,0.35)';
      x.fillRect(sx - 38, y, 3, 2);
      x.fillRect(sx + 35, y, 3, 2);
    }
    for (let i = 0; i < 160; i++) {
      const y = r.next() * h, sx = VillageRoofBG.streetX(y, h);
      x.fillStyle = `rgba(${r.next() < 0.5 ? '90,80,60' : '20,16,10'},0.5)`;
      x.fillRect(sx - 30 + r.next() * 60, y, 2, 2);
    }
    // 家の屋根（通りの両側に10列）
    const rows = 10, rowH = h / rows;
    for (let i = 0; i < rows; i++) {
      const ry = i * rowH + 7 + r.next() * 4;
      const rh = rowH - 18 + r.next() * 4;
      const sx = VillageRoofBG.streetX(ry + rh / 2, h);
      const sides = [[-8, sx - 44 - r.next() * 8], [sx + 44 + r.next() * 8, w + 8]];
      sides.forEach(([x0, x1], j) => {
        const width = x1 - x0;
        const split = width > 120 && r.next() < 0.6 ? [0.4 + r.next() * 0.2] : [];
        const cuts = [0, ...split, 1];
        for (let k = 0; k < cuts.length - 1; k++) {
          const rx = x0 + width * cuts[k] + (k ? 4 : 0), rw = width * (cuts[k + 1] - cuts[k]) - (k ? 4 : 0);
          const kind = r.next() < 0.3 ? 'kaya' : 'kawara', seed = 100 + i * 10 + j * 3 + k, tone = r.next();
          for (const oy of [-h, 0, h]) drawRoof(x, rx, ry + oy, rw, rh, kind, new RNG(seed), tone);
        }
      });
      // 通りの提灯
      const ly = i * rowH + rowH - 5, lx = VillageRoofBG.streetX(ly, h) + (i % 2 ? 30 : -30);
      this.lanterns.push({ x: lx, y: ly, p: r.next() * TAU });
      for (const oy of [-h, 0, h]) {
        x.fillStyle = '#c0402a';
        x.beginPath(); x.ellipse(lx, ly + oy, 3.5, 4.5, 0, 0, TAU); x.fill();
        x.fillStyle = '#ffd890';
        x.fillRect(lx - 1, ly + oy - 2, 2, 4);
      }
    }
    return c;
  }
  update() {
    this.t++;
    this.scroll += 0.85;
    for (const d of this.dust) {
      d.p += 0.04;
      d.y += d.s;
      d.x += Math.sin(d.p) * (d.leaf ? 0.8 : 0.25);
      if (d.y > FIELD_H + 8) { d.y = -8; d.x = frand(FIELD_W); }
    }
  }
  draw(ctx) {
    drawScrollingTile(ctx, this.tile, this.scroll);
    const g = ctx.createLinearGradient(0, 0, FIELD_W, FIELD_H);
    g.addColorStop(0, 'rgba(110,130,210,0.16)');
    g.addColorStop(0.6, 'rgba(10,10,40,0.12)');
    g.addColorStop(1, 'rgba(0,0,10,0.4)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    ctx.globalCompositeOperation = 'lighter';
    const glow = glowSprite('255,150,70', 28);
    for (const l of this.lanterns) {
      for (const y of tileYs(l.y, this.scroll, this.tile.height)) {
        ctx.globalAlpha = 0.32 + 0.08 * Math.sin(this.t * 0.18 + l.p) + 0.05 * Math.sin(this.t * 0.53 + l.p * 2);
        ctx.drawImage(glow, l.x - 28, y - 28);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawScrollingTile(ctx, this.fog, this.scroll * 1.5, 0.8);
    for (const d of this.dust) {
      if (d.leaf) {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.p);
        ctx.fillStyle = 'rgba(150,110,60,0.6)';
        ctx.beginPath(); ctx.ellipse(0, 0, 3, 1.5, 0, 0, TAU); ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = 'rgba(200,190,170,0.35)';
        ctx.fillRect(d.x, d.y, 1.5, 1.5);
      }
    }
  }
}

// ------------------------------------------------------------
//  2面：虫食いの空き家（床と畳を上から見る。虫がはい回っている）
// ------------------------------------------------------------
function drawPlanks(x, y0, y1, r, w = FIELD_W) {
  for (let y = y0; y < y1; y += 22) {
    const ph = Math.min(22, y1 - y);
    let px = -r.next() * 120;
    while (px < w) {
      const len = 110 + r.next() * 150;
      const v = r.next() * 18 - 9;
      x.fillStyle = `rgb(${88 + v},${66 + v * 0.8},${42 + v * 0.6})`;
      x.fillRect(px, y, len, ph);
      x.strokeStyle = 'rgba(30,20,10,0.35)';
      x.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        const gy = y + 4 + r.next() * (ph - 8);
        x.beginPath(); x.moveTo(px, gy);
        x.bezierCurveTo(px + len * 0.3, gy + (r.next() - 0.5) * 4, px + len * 0.6, gy + (r.next() - 0.5) * 4, px + len, gy);
        x.stroke();
      }
      if (r.next() < 0.3) {
        x.fillStyle = 'rgba(30,18,8,0.6)';
        x.beginPath(); x.ellipse(px + r.next() * len, y + ph / 2, 4, 2.5, 0, 0, TAU); x.fill();
      }
      x.fillStyle = '#1c130b';
      x.fillRect(px, y, 1.5, ph);
      x.fillStyle = 'rgba(40,40,40,0.8)';
      x.fillRect(px + 4, y + 4, 2, 2);
      x.fillRect(px + 4, y + ph - 6, 2, 2);
      px += len;
    }
    x.fillStyle = 'rgba(0,0,0,0.5)';
    x.fillRect(0, y + ph - 1, w, 1);
  }
}
function drawTatami(x, y0, y1, r, w = FIELD_W, base = [140, 136, 84]) {
  let row = 0;
  for (let y = y0; y < y1; y += 48, row++) {
    const th = Math.min(48, y1 - y);
    for (let px = row % 2 ? -48 : 0; px < w; px += 96) {
      const v = r.next() * 20 - 10;
      x.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v * 0.5})`;
      x.fillRect(px, y, 96, th);
      x.fillStyle = 'rgba(0,0,0,0.08)';
      for (let k = 1; k < th; k += 2) x.fillRect(px, y + k, 96, 1);
      x.fillStyle = '#1e2818';
      x.fillRect(px, y, 96, 4);
      x.fillRect(px, y + th - 4, 96, 4);
      x.fillStyle = 'rgba(0,0,0,0.4)';
      x.fillRect(px, y, 1, th);
      if (r.next() < 0.45) {
        x.fillStyle = `rgba(60,40,20,${0.15 + r.next() * 0.25})`;
        jaggedBlob(x, px + 10 + r.next() * 76, y + 8 + r.next() * (th - 16), 5 + r.next() * 10, r, 0.7);
        x.fill();
      }
    }
  }
}
function drawSill(x, y, w = FIELD_W) {
  x.fillStyle = '#24170c';
  x.fillRect(0, y, w, 16);
  x.fillStyle = 'rgba(255,220,170,0.1)';
  x.fillRect(0, y + 1, w, 1);
  x.fillStyle = 'rgba(0,0,0,0.6)';
  x.fillRect(0, y + 5, w, 2);
  x.fillRect(0, y + 10, w, 2);
}
function drawCobweb(x, cx, cy, rad, a0, a1) {
  x.strokeStyle = 'rgba(220,220,230,0.22)';
  x.lineWidth = 0.8;
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); x.stroke();
  }
  for (let k = 1; k <= 4; k++) {
    const rr = (rad * k) / 4.5;
    x.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    x.stroke();
  }
}
function drawBug(ctx, b, t) {
  ctx.save();
  ctx.translate(b.x, b.sy);
  ctx.rotate(b.a);
  const s = b.size;
  ctx.strokeStyle = 'rgba(20,14,8,0.85)';
  ctx.lineWidth = 0.8;
  for (let k = -1; k <= 1; k++) {
    const sw = Math.sin(t * 0.6 + b.p + k) * 1.4;
    ctx.beginPath();
    ctx.moveTo(k * 1.6 * s, -1.5 * s); ctx.lineTo(k * 1.6 * s + sw, -4 * s);
    ctx.moveTo(k * 1.6 * s, 1.5 * s); ctx.lineTo(k * 1.6 * s - sw, 4 * s);
    ctx.stroke();
  }
  ctx.fillStyle = b.color;
  ctx.beginPath(); ctx.ellipse(0, 0, 3.4 * s, 1.9 * s, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(3.6 * s, 0, 1.1 * s, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,200,0.25)';
  ctx.beginPath(); ctx.ellipse(-0.6 * s, -0.6 * s, 1.6 * s, 0.7 * s, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(4.2 * s, -0.5); ctx.lineTo(6.5 * s, -2.2 * s); ctx.moveTo(4.2 * s, 0.5); ctx.lineTo(6.5 * s, 2.2 * s); ctx.stroke();
  ctx.restore();
}

class BugHouseBG {
  constructor() {
    this.t = 0;
    this.scroll = 0;
    this.tile = BugHouseBG.makeTile();
    const h = this.tile.height;
    this.bugs = [];
    for (let i = 0; i < 46; i++) {
      this.bugs.push({
        x: frand(FIELD_W), y: frand(h), a: frand(TAU), s: frand(0.2, 0.75), p: frand(TAU), sy: 0,
        size: Math.random() < 0.2 ? frand(1.2, 1.6) : frand(0.6, 0.9),
        color: pick(['#1a120a', '#22160c', '#2a1e10', '#141a10']),
      });
    }
    this.flies = [];
    for (let i = 0; i < 12; i++) this.flies.push({ x: frand(FIELD_W), y: frand(FIELD_H), vx: 0, vy: 0 });
  }
  static makeTile() {
    const w = FIELD_W, h = 1024;
    const c = makeCanvas(w, h);
    const x = c.getContext('2d');
    const r = new RNG(5150);
    drawPlanks(x, 0, 300, r);
    drawSill(x, 300);
    drawTatami(x, 316, 700, r);
    drawSill(x, 700);
    drawPlanks(x, 716, h, r);
    // 囲炉裏
    x.fillStyle = '#2a1c10';
    x.fillRect(150, 470, 84, 84);
    x.fillStyle = '#5a5650';
    x.fillRect(158, 478, 68, 68);
    x.fillStyle = 'rgba(30,26,24,0.8)';
    x.beginPath(); x.arc(192, 512, 16, 0, TAU); x.fill();
    // 床の穴としみ
    for (let i = 0; i < 9; i++) {
      const y = r.next() * h;
      if (y > 296 && y < 720) continue;
      x.fillStyle = 'rgba(8,5,2,0.95)';
      jaggedBlob(x, r.next() * w, y, 6 + r.next() * 12, r, 0.6);
      x.fill();
    }
    for (let i = 0; i < 26; i++) {
      x.fillStyle = `rgba(20,30,10,${0.12 + r.next() * 0.18})`;
      jaggedBlob(x, r.next() * w, r.next() * h, 8 + r.next() * 20, r, 0.8);
      x.fill();
    }
    // 部屋のすみのクモの巣
    drawCobweb(x, 0, 316, 70, 0, Math.PI / 2);
    drawCobweb(x, w, 316, 60, Math.PI / 2, Math.PI);
    drawCobweb(x, 0, 700, 54, -Math.PI / 2, 0);
    drawCobweb(x, w, 716, 66, Math.PI / 2, Math.PI);
    drawCobweb(x, w, 120, 48, Math.PI / 2, Math.PI * 1.5);
    return c;
  }
  update() {
    this.t++;
    this.scroll += 0.8;
    const h = this.tile.height;
    for (const b of this.bugs) {
      b.a += frand(-0.18, 0.18);
      if (Math.random() < 0.01) b.a += frand(-2, 2);
      b.x += Math.cos(b.a) * b.s;
      b.y += Math.sin(b.a) * b.s;
      if (b.x < 0 || b.x > FIELD_W) { b.a = Math.PI - b.a; b.x = clamp(b.x, 0, FIELD_W); }
      b.y = ((b.y % h) + h) % h;
    }
    for (const f of this.flies) {
      f.vx = clamp(f.vx + frand(-0.5, 0.5), -2.5, 2.5);
      f.vy = clamp(f.vy + frand(-0.5, 0.5), -2.5, 2.5);
      f.x = (f.x + f.vx + FIELD_W) % FIELD_W;
      f.y = (f.y + f.vy + FIELD_H) % FIELD_H;
    }
  }
  draw(ctx) {
    drawScrollingTile(ctx, this.tile, this.scroll);
    const h = this.tile.height;
    for (const b of this.bugs) {
      for (const y of tileYs(b.y, this.scroll, h, 12)) { b.sy = y; drawBug(ctx, b, this.t); }
    }
    // 窓から差しこむ月明かり
    ctx.globalCompositeOperation = 'lighter';
    for (const [x0, wd] of [[40, 70], [230, 50]]) {
      const g = ctx.createLinearGradient(x0, 0, x0 + 160, FIELD_H);
      g.addColorStop(0, 'rgba(150,170,230,0.1)');
      g.addColorStop(1, 'rgba(150,170,230,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0, 0); ctx.lineTo(x0 + wd, 0); ctx.lineTo(x0 + wd + 170, FIELD_H); ctx.lineTo(x0 + 170, FIELD_H);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // 空き家のうす暗さ
    const v = ctx.createRadialGradient(FIELD_W / 2, FIELD_H * 0.55, 80, FIELD_W / 2, FIELD_H * 0.55, 360);
    v.addColorStop(0, 'rgba(10,16,4,0.05)');
    v.addColorStop(1, 'rgba(4,6,0,0.45)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    ctx.fillStyle = 'rgba(10,10,6,0.85)';
    for (const f of this.flies) ctx.fillRect(f.x, f.y, 2, 2);
  }
}

// ------------------------------------------------------------
//  3面：上がり込みの裏通り（夕暮れの裏通り。最後に隠れていた屋敷が姿を現す）
// ------------------------------------------------------------
class BackstreetBG {
  constructor() {
    this.t = 0;
    this.scroll = 0;
    this.lanterns = [];
    this.tile = this.makeTile();
    this.fog = makeFogTile(FIELD_W, 448, 9, 0.05, 31, '255,220,200');
    this.reveal = 0;
    this.sparks = [];
  }
  static pathX(y, h) { return FIELD_W / 2 + Math.sin((y / h) * TAU * 2) * 14; }
  makeTile() {
    const w = FIELD_W, h = 960;
    const c = makeCanvas(w, h);
    const x = c.getContext('2d');
    const r = new RNG(777);
    x.fillStyle = '#2a2018';
    x.fillRect(0, 0, w, h);
    // 裏庭の土
    for (let i = 0; i < 300; i++) {
      x.fillStyle = `rgba(${r.next() < 0.5 ? '80,64,44' : '16,12,8'},0.4)`;
      x.fillRect(r.next() * w, r.next() * h, 2, 2);
    }
    // 路地と飛び石
    for (let y = 0; y < h; y += 2) {
      const px = BackstreetBG.pathX(y, h);
      x.fillStyle = '#463826';
      x.fillRect(px - 34, y, 68, 2);
    }
    for (let y = 10, i = 0; y < h; y += 38, i++) {
      const px = BackstreetBG.pathX(y, h) + (i % 2 ? 12 : -12);
      x.fillStyle = 'rgba(0,0,0,0.4)';
      x.beginPath(); x.ellipse(px + 2, y + 3, 15, 10, 0, 0, TAU); x.fill();
      x.fillStyle = '#7a756a';
      x.beginPath(); x.ellipse(px, y, 15, 10, 0, 0, TAU); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.12)';
      x.beginPath(); x.ellipse(px - 3, y - 3, 8, 4, 0, 0, TAU); x.fill();
    }
    // 板塀（路地の両側）
    for (let y = 0; y < h; y += 4) {
      const px = BackstreetBG.pathX(y, h);
      for (const fx of [px - 46, px + 38]) {
        x.fillStyle = (y / 4) % 2 ? '#3a2614' : '#46301a';
        x.fillRect(fx, y, 8, 4);
      }
    }
    for (let y = 0; y < h; y += 60) {
      const px = BackstreetBG.pathX(y, h);
      for (const fx of [px - 47, px + 37]) {
        x.fillStyle = '#20140a';
        x.fillRect(fx, y, 10, 6);
      }
      this.lanterns.push({ x: px + (y % 120 ? 42 : -42), y: y + 3, p: r.next() * TAU });
    }
    // 裏庭の物（井戸・たる・鉢植え・まき）
    const items = [];
    for (let i = 0; i < 26; i++) {
      const y = r.next() * h, px = BackstreetBG.pathX(y, h);
      const left = r.next() < 0.5;
      const ix = left ? px - 60 - r.next() * 30 : px + 58 + r.next() * 30;
      items.push({ x: ix, y, kind: pick(['well', 'barrel', 'pot', 'pot', 'wood']), seed: i });
    }
    for (const it of items) {
      for (const oy of [-h, 0, h]) {
        const y = it.y + oy, ix = it.x;
        x.fillStyle = 'rgba(0,0,0,0.4)';
        x.beginPath(); x.arc(ix + 3, y + 4, 9, 0, TAU); x.fill();
        if (it.kind === 'well') {
          x.fillStyle = '#6a665e'; x.beginPath(); x.arc(ix, y, 11, 0, TAU); x.fill();
          x.fillStyle = '#0c1418'; x.beginPath(); x.arc(ix, y, 7, 0, TAU); x.fill();
          x.strokeStyle = '#3a2614'; x.lineWidth = 2; x.beginPath(); x.moveTo(ix - 13, y); x.lineTo(ix + 13, y); x.stroke();
        } else if (it.kind === 'barrel') {
          x.fillStyle = '#6a4826'; x.beginPath(); x.arc(ix, y, 8, 0, TAU); x.fill();
          x.strokeStyle = '#2a1a0c'; x.lineWidth = 1.5; x.beginPath(); x.arc(ix, y, 6, 0, TAU); x.stroke();
        } else if (it.kind === 'pot') {
          x.fillStyle = '#5a3a24'; x.beginPath(); x.arc(ix, y, 6, 0, TAU); x.fill();
          x.fillStyle = '#3e6a34'; for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(ix + Math.cos(k * 1.3) * 4, y + Math.sin(k * 1.3) * 4, 3.5, 0, TAU); x.fill(); }
        } else {
          for (let k = 0; k < 4; k++) { x.fillStyle = k % 2 ? '#7a5634' : '#5c3e22'; x.fillRect(ix - 10, y - 6 + k * 3, 20, 3); }
        }
      }
    }
    // 両はしの家の屋根
    for (let y = 0, i = 0; y < h; y += 120, i++) {
      for (const [rx, rw] of [[-10, 74], [w - 64, 74]]) {
        const kind = (i + rx) % 3 === 0 ? 'kaya' : 'kawara';
        for (const oy of [-h, 0, h]) drawRoof(x, rx, y + 10 + oy, rw, 96, kind, new RNG(300 + i * 2 + (rx > 0 ? 1 : 0)), 0.5);
      }
    }
    // 路地の上の物干し
    for (let y = 150; y < h; y += 320) {
      const px = BackstreetBG.pathX(y, h);
      for (const oy of [-h, 0, h]) {
        const yy = y + oy;
        x.strokeStyle = 'rgba(30,20,10,0.9)'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(px - 52, yy); x.lineTo(px + 52, yy + 6); x.stroke();
        ['#a04a4a', '#4a6aa0', '#d8d0b8'].forEach((col, k) => {
          x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(px - 36 + k * 26 + 4, yy + k * 2 + 6, 18, 12);
          x.fillStyle = col; x.fillRect(px - 36 + k * 26, yy + k * 2 + 1, 18, 12);
        });
      }
    }
    return c;
  }
  // 会話の { event: 'mansion' }：隠れていた屋敷が姿を現す
  event(name) { if (name === 'mansion' && this.reveal === 0) this.reveal = 0.001; }
  update() {
    this.t++;
    this.scroll += this.reveal > 0 ? Math.max(0, 0.9 * (1 - this.reveal * 1.5)) : 0.9;
    if (this.reveal > 0 && this.reveal < 1) {
      this.reveal = Math.min(1, this.reveal + 1 / 160);
      for (let i = 0; i < 3; i++) this.sparks.push({ x: frand(FIELD_W), y: frand(0, 260), vy: frand(-0.8, -0.2), life: 60 });
    }
    for (const s of this.sparks) { s.y += s.vy; s.life--; }
    this.sparks = this.sparks.filter(s => s.life > 0);
  }
  draw(ctx) {
    drawScrollingTile(ctx, this.tile, this.scroll);
    // 夕暮れ
    const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
    g.addColorStop(0, 'rgba(255,140,80,0.18)');
    g.addColorStop(0.5, 'rgba(160,70,120,0.12)');
    g.addColorStop(1, 'rgba(30,10,50,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    ctx.globalCompositeOperation = 'lighter';
    const glow = glowSprite('255,170,90', 24);
    for (const l of this.lanterns) {
      for (const y of tileYs(l.y, this.scroll, this.tile.height)) {
        ctx.globalAlpha = 0.3 + 0.1 * Math.sin(this.t * 0.15 + l.p);
        ctx.drawImage(glow, l.x - 24, y - 24);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawScrollingTile(ctx, this.fog, this.scroll * 1.4, 0.7);
    if (this.reveal > 0) this.drawMansion(ctx);
  }
  // 隠れていた屋敷（上から見た大きな屋根と門）
  drawMansion(ctx) {
    const k = Ease.outCubic(this.reveal);
    const t = this.t;
    ctx.save();
    ctx.globalAlpha = k;
    const top = -40 + 20 * k;
    // 大屋根（入母屋）
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-10, top + 18, FIELD_W + 20, 250);
    ctx.fillStyle = '#262a36';
    ctx.beginPath();
    ctx.moveTo(-10, top); ctx.lineTo(FIELD_W + 10, top); ctx.lineTo(FIELD_W + 10, top + 120); ctx.lineTo(-10, top + 120); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#353b4c';
    ctx.beginPath();
    ctx.moveTo(-10, top + 120); ctx.lineTo(FIELD_W + 10, top + 120); ctx.lineTo(FIELD_W + 10, top + 250); ctx.lineTo(-10, top + 250); ctx.closePath(); ctx.fill();
    for (let px = -8; px < FIELD_W + 10; px += 9) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(px, top, 3, 250);
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(px + 5, top, 1.5, 250);
    }
    for (let py = top + 8; py < top + 250; py += 11) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(-10, py, FIELD_W + 20, 1.5); }
    // 棟と金の飾り
    ctx.fillStyle = '#14161c';
    ctx.fillRect(-10, top + 112, FIELD_W + 20, 16);
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(-10, top + 114, FIELD_W + 20, 2);
    for (const ex of [40, FIELD_W - 40]) {
      ctx.fillStyle = '#c9a24a';
      ctx.beginPath(); ctx.arc(ex, top + 120, 12, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7a5a1e';
      ctx.beginPath(); ctx.arc(ex, top + 120, 7, 0, TAU); ctx.fill();
    }
    // 家紋
    ctx.strokeStyle = '#c9a24a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(FIELD_W / 2, top + 190, 22, 0, TAU); ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      ctx.beginPath(); ctx.arc(FIELD_W / 2 + Math.cos(a) * 10, top + 190 + Math.sin(a) * 10, 6, 0, TAU); ctx.stroke();
    }
    // 門
    ctx.fillStyle = '#3a2210';
    ctx.fillRect(FIELD_W / 2 - 46, top + 250, 92, 26);
    ctx.fillStyle = '#5a3a1c';
    const open = 18 * k;
    ctx.fillRect(FIELD_W / 2 - 40, top + 254, 40 - open, 18);
    ctx.fillRect(FIELD_W / 2 + open, top + 254, 40 - open, 18);
    ctx.fillStyle = 'rgba(255,220,160,0.5)';
    ctx.fillRect(FIELD_W / 2 - open, top + 254, open * 2, 18);
    ctx.restore();
    // 姿を現すときのゆらぎと光の粒
    const pulse = Math.sin(this.reveal * Math.PI);
    if (pulse > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(220,190,255,${0.5 * pulse})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        for (let x = 0; x <= FIELD_W; x += 8) ctx.lineTo(x, 40 + i * 60 + Math.sin(x * 0.05 + t * 0.2 + i) * 6);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.sparks) {
      ctx.fillStyle = `rgba(255,220,180,${s.life / 60})`;
      ctx.fillRect(s.x, s.y, 2, 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ------------------------------------------------------------
//  4面：借りものの間（人里の家から借りてきた部屋を、次々に突き抜けて奥へ進む）
//  正面に見える奥へ向かって進む。部屋の境の壁（ふすま・障子）には穴があいていて、
//  壁が目の前を通りすぎるたびに紙と木のかけらが飛び散る
// ------------------------------------------------------------
const ROOM_STYLES = [
  { wall: '#d8cba6', ink: 'rgba(60,90,140,0.55)', floor: [150, 146, 92], ceil: '#3a2a1a', side: '#c8b88e', deco: 'wave' },
  { wall: '#eae4d2', ink: 'rgba(200,60,50,0.7)', floor: [134, 140, 86], ceil: '#33251a', side: '#d8d0b6', deco: 'sun' },
  { wall: '#f2ead6', ink: 'rgba(90,60,30,0.75)', floor: [160, 150, 96], ceil: '#2c2016', side: '#e6dcc0', deco: 'shoji' },
  { wall: '#2a3150', ink: 'rgba(220,190,110,0.8)', floor: [120, 126, 78], ceil: '#241a12', side: '#363e60', deco: 'crest' },
  { wall: '#b58a52', ink: 'rgba(60,40,20,0.6)', floor: [146, 132, 80], ceil: '#30221a', side: '#a07a46', deco: 'scroll' },
  { wall: '#d4c0a0', ink: 'rgba(80,110,70,0.6)', floor: [142, 150, 96], ceil: '#3a2c1c', side: '#c4b090', deco: 'bamboo' },
];
const ROOM_D = 1.5;                  // 壁と壁の間の奥行き
const ROOM_HALF_W = 230, ROOM_CEIL = 160, ROOM_FLOOR = 230; // 奥行き1のときの部屋の大きさ（px）

class RoomsBG {
  constructor() {
    this.t = 0;
    this.z = 0.3;
    this.speed = 0.024;
    this.passed = 0;          // 通りすぎた壁の数
    this.shards = [];
    this.holes = {};
  }
  vp() { return { x: FIELD_W / 2 + Math.sin(this.t * 0.011) * 10, y: 168 + Math.sin(this.t * 0.017) * 6 }; }
  style(k) { return ROOM_STYLES[(k * 7 + (k >> 1)) % ROOM_STYLES.length]; }
  // 壁 k の穴（ぎざぎざの形）。同じ壁はいつも同じ形
  hole(k) {
    if (this.holes[k]) return this.holes[k];
    const r = new RNG(9000 + k);
    const cx = (r.next() - 0.5) * 36, cy = 30 + (r.next() - 0.5) * 24, rx = 150 + r.next() * 24, ry = 146 + r.next() * 22;
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const rr = 0.78 + r.next() * 0.34;
      pts.push([cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr]);
    }
    return (this.holes[k] = pts);
  }
  update() {
    this.t++;
    this.z += this.speed;
    // 目の前の壁を通りすぎたら、かけらを飛ばす
    const nextWall = this.passed + 1;
    if (nextWall * ROOM_D - this.z < 0.22) {
      this.passed = nextWall;
      delete this.holes[nextWall];
      const st = this.style(nextWall);
      const vp = this.vp();
      for (let i = 0; i < 46; i++) {
        const a = frand(TAU);
        const d = frand(120, 260);
        this.shards.push({
          x: vp.x + Math.cos(a) * d, y: vp.y + Math.sin(a) * d * 0.9, vx: Math.cos(a) * frand(3, 8), vy: Math.sin(a) * frand(3, 8),
          rot: frand(TAU), vr: frand(-0.3, 0.3), w: frand(5, 16), h: frand(3, 9), life: 40, color: Math.random() < 0.7 ? st.wall : '#4a3020',
        });
      }
    }
    for (const s of this.shards) { s.x += s.vx; s.y += s.vy; s.vx *= 1.02; s.vy *= 1.02; s.rot += s.vr; s.life--; }
    this.shards = this.shards.filter(s => s.life > 0);
  }
  rect(d, vp) {
    return { l: vp.x - ROOM_HALF_W / d, r: vp.x + ROOM_HALF_W / d, t: vp.y - ROOM_CEIL / d, b: vp.y + ROOM_FLOOR / d };
  }
  quad(ctx, pts, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (const [px, py] of pts) ctx.lineTo(px, py);
    ctx.closePath();
    ctx.fill();
  }
  // 部屋（手前 dn から奥 df まで）の床・天井・左右の壁
  drawRoom(ctx, k, dn, df, vp) {
    const st = this.style(k);
    const n = this.rect(dn, vp), f = this.rect(df, vp);
    const fl = st.floor;
    this.quad(ctx, [[n.l, n.b], [n.r, n.b], [f.r, f.b], [f.l, f.b]], `rgb(${fl[0]},${fl[1]},${fl[2]})`);
    this.quad(ctx, [[n.l, n.t], [n.r, n.t], [f.r, f.t], [f.l, f.t]], st.ceil);
    this.quad(ctx, [[n.l, n.t], [f.l, f.t], [f.l, f.b], [n.l, n.b]], st.side);
    this.quad(ctx, [[n.r, n.t], [f.r, f.t], [f.r, f.b], [n.r, n.b]], st.side);
    ctx.strokeStyle = 'rgba(30,26,14,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // 畳のへり（奥へ向かう線と横の線）
    for (const u of [-1, -0.5, 0, 0.5, 1]) {
      ctx.moveTo(vp.x + (u * ROOM_HALF_W) / dn, n.b); ctx.lineTo(vp.x + (u * ROOM_HALF_W) / df, f.b);
    }
    const dm = (dn + df) / 2;
    ctx.moveTo(vp.x - ROOM_HALF_W / dm, vp.y + ROOM_FLOOR / dm); ctx.lineTo(vp.x + ROOM_HALF_W / dm, vp.y + ROOM_FLOOR / dm);
    // 天井板
    for (const u of [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75]) {
      ctx.moveTo(vp.x + (u * ROOM_HALF_W) / dn, n.t); ctx.lineTo(vp.x + (u * ROOM_HALF_W) / df, f.t);
    }
    ctx.stroke();
    // 左右の壁：長押（横木）と柱
    ctx.strokeStyle = 'rgba(70,46,24,0.9)';
    ctx.lineWidth = 3 / dn + 1;
    ctx.beginPath();
    for (const sx of [-1, 1]) {
      ctx.moveTo(vp.x + (sx * ROOM_HALF_W) / dn, vp.y - (ROOM_CEIL * 0.62) / dn);
      ctx.lineTo(vp.x + (sx * ROOM_HALF_W) / df, vp.y - (ROOM_CEIL * 0.62) / df);
      for (const dd of [dm]) {
        ctx.moveTo(vp.x + (sx * ROOM_HALF_W) / dd, vp.y - ROOM_CEIL / dd);
        ctx.lineTo(vp.x + (sx * ROOM_HALF_W) / dd, vp.y + ROOM_FLOOR / dd);
      }
    }
    ctx.stroke();
    // 奥ほど暗い
    const dark = clamp((dm - 1.2) / 16, 0, 0.7);
    if (dark > 0) {
      ctx.fillStyle = `rgba(0,0,0,${dark})`;
      ctx.fillRect(n.l, n.t, n.r - n.l, n.b - n.t);
    }
  }
  // 壁 k（奥行き d）。穴のあいたふすま・障子
  drawWall(ctx, k, d, vp) {
    const st = this.style(k);
    const s = 1 / d;
    const pts = this.hole(k);
    ctx.save();
    ctx.translate(vp.x, vp.y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.rect(-ROOM_HALF_W, -ROOM_CEIL, ROOM_HALF_W * 2, ROOM_CEIL + ROOM_FLOOR);
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = st.wall;
    ctx.fill('evenodd');
    ctx.save();
    ctx.clip('evenodd');
    this.wallDeco(ctx, st, k);
    // 4枚のふすまの境と引手
    ctx.strokeStyle = 'rgba(40,26,12,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const fx of [-ROOM_HALF_W / 2, 0, ROOM_HALF_W / 2]) { ctx.moveTo(fx, -ROOM_CEIL); ctx.lineTo(fx, ROOM_FLOOR); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(30,20,10,0.7)';
    for (const fx of [-ROOM_HALF_W / 2 - 14, ROOM_HALF_W / 2 + 14]) { ctx.beginPath(); ctx.arc(fx, 30, 5, 0, TAU); ctx.fill(); }
    // 鴨居と敷居
    ctx.fillStyle = '#3a2614';
    ctx.fillRect(-ROOM_HALF_W, -ROOM_CEIL, ROOM_HALF_W * 2, 22);
    ctx.fillRect(-ROOM_HALF_W, ROOM_FLOOR - 10, ROOM_HALF_W * 2, 10);
    const dark = clamp((d - 1.2) / 16, 0, 0.7);
    if (dark > 0) { ctx.fillStyle = `rgba(0,0,0,${dark})`; ctx.fillRect(-ROOM_HALF_W, -ROOM_CEIL, ROOM_HALF_W * 2, ROOM_CEIL + ROOM_FLOOR); }
    ctx.restore();
    // 破れた穴のふち
    ctx.strokeStyle = `rgba(255,250,235,${0.85 * (1 - clamp((d - 1.2) / 16, 0, 0.8))})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (const [px, py] of pts) ctx.lineTo(px, py);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  wallDeco(ctx, st, k) {
    const W = ROOM_HALF_W, C = ROOM_CEIL, F = ROOM_FLOOR;
    ctx.strokeStyle = st.ink;
    ctx.fillStyle = st.ink;
    ctx.lineWidth = 3;
    switch (st.deco) {
      case 'wave':
        for (let row = 0; row < 3; row++) {
          for (let i = -6; i <= 6; i++) {
            const cx = i * 40 + (row % 2) * 20, cy = F - 30 - row * 22;
            for (const rr of [18, 12, 6]) { ctx.beginPath(); ctx.arc(cx, cy, rr, Math.PI, TAU); ctx.stroke(); }
          }
        }
        break;
      case 'sun':
        ctx.beginPath(); ctx.arc(W * 0.45, -C * 0.35, 34, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(210,170,70,0.5)';
        for (let i = 0; i < 4; i++) ctx.fillRect(-W + i * 60, -C * 0.1 + (i % 2) * 18, 150, 16);
        break;
      case 'shoji':
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let gx = -W; gx <= W; gx += 38) { ctx.moveTo(gx, -C); ctx.lineTo(gx, F); }
        for (let gy = -C; gy <= F; gy += 46) { ctx.moveTo(-W, gy); ctx.lineTo(W, gy); }
        ctx.stroke();
        break;
      case 'crest':
        for (const cx of [-W * 0.75, -W * 0.25, W * 0.25, W * 0.75]) {
          ctx.beginPath(); ctx.arc(cx, -C * 0.3, 20, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx - 12, -C * 0.3); ctx.lineTo(cx + 12, -C * 0.3); ctx.moveTo(cx, -C * 0.3 - 12); ctx.lineTo(cx, -C * 0.3 + 12); ctx.stroke();
        }
        break;
      case 'scroll':
        ctx.fillStyle = 'rgba(240,232,210,0.9)';
        ctx.fillRect(-26, -C + 34, 52, 150);
        ctx.strokeStyle = st.ink;
        ctx.beginPath(); ctx.moveTo(-8, -C + 54); ctx.lineTo(-8, -C + 160); ctx.moveTo(8, -C + 64); ctx.lineTo(8, -C + 140); ctx.stroke();
        break;
      case 'bamboo':
        for (let i = -5; i <= 5; i++) {
          const bx = i * 44 + (k % 3) * 9;
          ctx.fillRect(bx, -C, 7, C + F);
          for (let j = 0; j < 6; j++) ctx.fillRect(bx - 2, -C + j * 70 + (i & 1) * 30, 11, 3);
        }
        break;
    }
  }
  draw(ctx) {
    const vp = this.vp();
    ctx.fillStyle = '#050304';
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    const first = this.passed;              // カメラがいる部屋の手前の壁（もう通りすぎた）
    const far = first + 10;
    for (let k = far; k >= first; k--) {
      const dn = Math.max(0.2, k * ROOM_D - this.z), df = (k + 1) * ROOM_D - this.z;
      if (df <= 0.2) continue;
      this.drawRoom(ctx, k, dn, df, vp);
      if (k > first) this.drawWall(ctx, k, k * ROOM_D - this.z, vp);
    }
    // 部屋のあかり（ゆれる行灯の光）
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.16 + 0.04 * Math.sin(this.t * 0.07);
    ctx.drawImage(glowSprite('255,190,110', 180), vp.x - 180, vp.y - 140);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (const s of this.shards) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.globalAlpha = Math.min(1, s.life / 20);
      ctx.fillStyle = s.color;
      ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // 弾が見やすいように、全体を少し暗くする
    ctx.fillStyle = 'rgba(12,8,6,0.38)';
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    const v = ctx.createRadialGradient(vp.x, vp.y, 100, vp.x, vp.y, 380);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  }
}

// ------------------------------------------------------------
//  5面：崩れゆく座敷（屋敷が崩れていく。瓦や梁が降ってきて、床はかたむいてひび割れる）
//  降ってくるものは背景の飾りで、当たり判定はない
// ------------------------------------------------------------
class CollapseBG {
  constructor() {
    this.t = 0;
    this.scroll = 0;
    this.tile = CollapseBG.makeTile();
    this.debris = [];
    this.puffs = [];
    this.dust = [];
    for (let i = 0; i < 40; i++) this.dust.push({ x: frand(FIELD_W), y: frand(FIELD_H), s: frand(0.3, 1.2), p: frand(TAU) });
    this.rumble = 0;
  }
  static makeTile() {
    const w = FIELD_W + 60, h = 1024;
    const c = makeCanvas(w, h);
    const x = c.getContext('2d');
    const r = new RNG(4444);
    drawTatami(x, 0, 380, r, w, [98, 92, 62]);
    drawSill(x, 380, w);
    drawPlanks(x, 396, 640, r, w);
    drawSill(x, 640, w);
    drawTatami(x, 656, h, r, w, [92, 88, 60]);
    // 床が抜けた穴
    for (let i = 0; i < 7; i++) {
      x.fillStyle = 'rgba(4,2,6,0.95)';
      jaggedBlob(x, r.next() * w, r.next() * h, 14 + r.next() * 18, r, 0.7);
      x.fill();
    }
    // 大きなひび割れ
    x.strokeStyle = 'rgba(6,4,2,0.95)';
    for (let i = 0; i < 12; i++) {
      let px = r.next() * w, py = r.next() * h;
      x.lineWidth = 2 + r.next() * 2;
      x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 8; k++) { px += (r.next() - 0.5) * 50; py += 10 + r.next() * 26; x.lineTo(px, py); }
      x.stroke();
    }
    // 落ちて割れた瓦・板・折れた柱
    for (let i = 0; i < 40; i++) {
      x.save();
      x.translate(r.next() * w, r.next() * h);
      x.rotate(r.next() * TAU);
      const board = r.next() < 0.3;
      x.fillStyle = 'rgba(0,0,0,0.4)';
      x.fillRect(-8 + 3, -4 + 3, board ? 40 : 14, board ? 7 : 10);
      x.fillStyle = board ? '#5a3c22' : '#3e4452';
      x.fillRect(-8, -4, board ? 40 : 14, board ? 7 : 10);
      x.restore();
    }
    for (let i = 0; i < 5; i++) {
      const px = r.next() * w, py = r.next() * h;
      x.fillStyle = 'rgba(0,0,0,0.5)';
      x.fillRect(px - 9, py - 9 + 4, 22, 22);
      x.fillStyle = '#4a3018';
      x.fillRect(px - 11, py - 11, 22, 22);
      x.strokeStyle = '#2a1a0c'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(px - 11, py - 11); x.lineTo(px + 11, py + 11); x.stroke();
    }
    // ほこり
    for (let i = 0; i < 30; i++) {
      x.fillStyle = `rgba(150,140,120,${0.08 + r.next() * 0.12})`;
      jaggedBlob(x, r.next() * w, r.next() * h, 10 + r.next() * 24, r, 0.7);
      x.fill();
    }
    return c;
  }
  spawn(kind) {
    this.debris.push({
      kind, x: frand(20, FIELD_W - 20), y: frand(40, FIELD_H - 40), h: 1, vh: kind === 'beam' ? 0.012 : frand(0.012, 0.022),
      rot: frand(TAU), vr: kind === 'beam' ? frand(-0.01, 0.01) : frand(-0.1, 0.1), len: kind === 'beam' ? frand(150, 240) : 0,
    });
  }
  update() {
    this.t++;
    this.scroll += 0.7;
    if (this.t % 18 === 0) this.spawn(Math.random() < 0.7 ? 'tile' : 'board');
    if (this.t % 420 === 200) this.spawn('beam');
    for (const d of this.debris) {
      d.h -= d.vh;
      d.vh *= 1.03;
      d.rot += d.vr;
      if (d.h <= 0) {
        d.dead = true;
        const n = d.kind === 'beam' ? 14 : 4;
        for (let i = 0; i < n; i++) this.puffs.push({ x: d.x + frand(-1, 1) * (d.kind === 'beam' ? 60 : 8), y: d.y + frand(-8, 8), r: frand(6, 14), life: 40 });
        if (d.kind === 'beam') this.rumble = 18;
      }
    }
    this.debris = this.debris.filter(d => !d.dead);
    for (const p of this.puffs) { p.r += 0.4; p.life--; }
    this.puffs = this.puffs.filter(p => p.life > 0);
    for (const d of this.dust) {
      d.p += 0.03;
      d.y += d.s;
      d.x += Math.sin(d.p) * 0.3;
      if (d.y > FIELD_H) { d.y = -4; d.x = frand(FIELD_W); }
    }
    if (this.rumble > 0) this.rumble--;
  }
  draw(ctx) {
    const sh = this.rumble > 0 ? this.rumble * 0.25 : 0;
    ctx.save();
    // 屋敷がかたむいていく：床をゆっくり回す
    const ang = -0.035 + Math.sin(this.t * 0.004) * 0.025;
    ctx.translate(FIELD_W / 2 + frand(-sh, sh), FIELD_H / 2 + frand(-sh, sh));
    ctx.rotate(ang);
    ctx.scale(1.18, 1.18);
    ctx.translate(-FIELD_W / 2 - 30, -FIELD_H / 2);
    const h = this.tile.height, y = this.scroll % h;
    ctx.drawImage(this.tile, 0, y - h);
    ctx.drawImage(this.tile, 0, y);
    ctx.restore();
    // 屋根の穴から差しこむ光
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const x0 = 40 + i * 120 + Math.sin(this.t * 0.01 + i) * 10;
      const a = 0.06 + 0.03 * Math.sin(this.t * 0.05 + i * 2);
      const g = ctx.createLinearGradient(x0, 0, x0 - 80, FIELD_H);
      g.addColorStop(0, `rgba(255,230,200,${a})`);
      g.addColorStop(1, 'rgba(255,230,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + 36, 0); ctx.lineTo(x0 - 40, FIELD_H); ctx.lineTo(x0 - 110, FIELD_H); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // 降ってくる瓦・板・梁（高いほど大きく、影は小さい）
    for (const d of this.debris) {
      const k = 1 + d.h * 0.8;
      ctx.fillStyle = `rgba(0,0,0,${0.45 * (1 - d.h * 0.6)})`;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      if (d.kind === 'beam') ctx.fillRect(-d.len / 2, -7, d.len, 14);
      else ctx.fillRect(-7, -5, 14, 10);
      ctx.restore();
      ctx.save();
      ctx.translate(d.x - d.h * 40, d.y - d.h * 110);
      ctx.rotate(d.rot);
      ctx.scale(k, k);
      if (d.kind === 'beam') {
        ctx.fillStyle = '#4e3218'; ctx.fillRect(-d.len / 2, -7, d.len, 14);
        ctx.fillStyle = 'rgba(255,220,170,0.15)'; ctx.fillRect(-d.len / 2, -7, d.len, 3);
      } else if (d.kind === 'board') {
        ctx.fillStyle = '#6a4828'; ctx.fillRect(-12, -3, 24, 6);
      } else {
        ctx.fillStyle = '#3e4452'; ctx.fillRect(-7, -5, 14, 10);
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-7, -5, 14, 2);
      }
      ctx.restore();
    }
    for (const p of this.puffs) {
      ctx.fillStyle = `rgba(170,160,145,${(p.life / 40) * 0.35})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    }
    for (const d of this.dust) {
      ctx.fillStyle = 'rgba(200,190,170,0.4)';
      ctx.fillRect(d.x, d.y, 1.5, 1.5);
    }
    // 家鳴の気配：むらさきの暗がり
    const v = ctx.createRadialGradient(FIELD_W / 2, FIELD_H / 2, 90, FIELD_W / 2, FIELD_H / 2, 360);
    v.addColorStop(0, 'rgba(40,10,50,0.22)');
    v.addColorStop(1, 'rgba(20,0,30,0.7)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  }
}

// ------------------------------------------------------------
//  6面：瓦礫の空（崩れた屋敷のがれきが、夜明け前の空に浮かんでいる）
//  がれきは遠い・中くらい・近いの3つの層に分かれて、ゆっくり流れていく。当たり判定はない
// ------------------------------------------------------------
function drawRubble(ctx, p) {
  const r = new RNG(p.seed);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.scale(p.k, p.k);
  // 影（空に浮いているので、うすく大きめに）
  ctx.fillStyle = 'rgba(10,6,30,0.25)';
  ctx.fillRect(-22 + 6, -12 + 10, 44, 24);
  switch (p.kind) {
    case 'beam': {
      const len = 60 + r.next() * 50;
      ctx.fillStyle = '#5a3a1e';
      ctx.beginPath();
      ctx.moveTo(-len / 2, -6); ctx.lineTo(len / 2 - 6, -6); ctx.lineTo(len / 2, -2); ctx.lineTo(len / 2 - 4, 6); ctx.lineTo(-len / 2 + 5, 6); ctx.lineTo(-len / 2 - 3, 1);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(30,18,8,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-len / 2 + 4, -2); ctx.lineTo(len / 2 - 8, -1); ctx.moveTo(-len / 2 + 8, 2); ctx.lineTo(len / 2 - 12, 3); ctx.stroke();
      ctx.fillStyle = 'rgba(255,220,180,0.15)';
      ctx.fillRect(-len / 2 + 2, -6, len - 8, 2);
      break;
    }
    case 'tatami': {
      ctx.fillStyle = '#9c9a5c';
      ctx.fillRect(-26, -13, 52, 26);
      ctx.fillStyle = '#26301c';
      ctx.fillRect(-26, -13, 52, 3); ctx.fillRect(-26, 10, 52, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      for (let y = -10; y < 10; y += 2) ctx.fillRect(-26, y, 52, 1);
      ctx.fillStyle = 'rgba(20,14,40,0.9)';
      ctx.beginPath(); ctx.moveTo(26, -13); ctx.lineTo(14, -13); ctx.lineTo(26, -2); ctx.closePath(); ctx.fill();
      break;
    }
    case 'fusuma': {
      ctx.fillStyle = '#e6dcc0';
      ctx.fillRect(-15, -22, 30, 44);
      ctx.strokeStyle = '#4a3018';
      ctx.lineWidth = 2;
      ctx.strokeRect(-15, -22, 30, 44);
      ctx.strokeStyle = 'rgba(70,90,150,0.6)';
      ctx.lineWidth = 1.2;
      for (const yy of [8, 14]) { ctx.beginPath(); ctx.arc(-6, yy, 5, Math.PI, TAU); ctx.arc(6, yy, 5, Math.PI, TAU); ctx.stroke(); }
      ctx.fillStyle = 'rgba(20,14,40,0.9)';
      jaggedBlob(ctx, 2 + r.next() * 4, -8, 6 + r.next() * 3, r, 1);
      ctx.fill();
      break;
    }
    case 'pillar': {
      ctx.fillStyle = '#6a4424';
      ctx.fillRect(-7, -24, 14, 48);
      ctx.fillStyle = 'rgba(255,220,170,0.18)';
      ctx.fillRect(-7, -24, 3, 48);
      ctx.fillStyle = '#3a2410';
      ctx.beginPath(); ctx.moveTo(-7, 24); ctx.lineTo(-3, 18); ctx.lineTo(1, 24); ctx.lineTo(4, 19); ctx.lineTo(7, 24); ctx.closePath(); ctx.fill();
      break;
    }
    default: { // 瓦のついた屋根板
      ctx.fillStyle = '#4a3020';
      ctx.fillRect(-22, -12, 44, 24);
      for (let i = 0; i < 6; i++) {
        if (r.next() < 0.25) continue;
        const tx = -20 + (i % 3) * 14, ty = -10 + Math.floor(i / 3) * 11;
        ctx.fillStyle = '#4a5468';
        ctx.fillRect(tx, ty, 12, 9);
        ctx.fillStyle = 'rgba(200,210,240,0.2)';
        ctx.fillRect(tx, ty, 12, 2);
      }
    }
  }
  ctx.restore();
}

class RubbleSkyBG {
  constructor() {
    this.t = 0;
    this.scroll = 0;
    this.clouds = makeFogTile(FIELD_W, 448, 12, 0.08, 66, '255,200,230');
    this.clouds2 = makeFogTile(FIELD_W, 448, 9, 0.06, 67, '190,180,255');
    this.stars = [];
    for (let i = 0; i < 40; i++) this.stars.push({ x: frand(FIELD_W), y: frand(0, 220), p: frand(TAU) });
    this.pieces = [];
    for (let i = 0; i < 28; i++) this.pieces.push(this.newPiece(true));
    this.glints = [];
  }
  newPiece(anywhere) {
    const layer = Math.random() < 0.45 ? 0 : Math.random() < 0.65 ? 1 : 2;
    return {
      layer, k: [0.45, 0.75, 1.15][layer] * frand(0.85, 1.15),
      x: frand(-20, FIELD_W + 20), y: anywhere ? frand(-60, FIELD_H + 40) : frand(-160, -60),
      vy: [0.45, 0.85, 1.5][layer] * frand(0.85, 1.15), vx: frand(-0.12, 0.12),
      rot: frand(TAU), vr: frand(-0.008, 0.008),
      kind: pick(['tiles', 'tiles', 'beam', 'tatami', 'fusuma', 'pillar']), seed: Math.floor(Math.random() * 1e6),
    };
  }
  update() {
    this.t++;
    this.scroll += 0.6;
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (p.y > FIELD_H + 90) this.pieces[i] = this.newPiece(false);
    }
    // 座敷わらしの鈴のきらめき
    if (this.t % 7 === 0) this.glints.push({ x: frand(FIELD_W), y: frand(FIELD_H), life: 50 });
    for (const g of this.glints) { g.y -= 0.3; g.life--; }
    this.glints = this.glints.filter(g => g.life > 0);
  }
  draw(ctx) {
    // 夜明け前の空
    const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
    g.addColorStop(0, '#0e0c2e');
    g.addColorStop(0.45, '#3a2456');
    g.addColorStop(0.8, '#7a3c5c');
    g.addColorStop(1, '#c0705a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    for (const st of this.stars) {
      ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.25 * Math.sin(this.t * 0.04 + st.p)})`;
      ctx.fillRect(st.x, st.y, 1.5, 1.5);
    }
    // 三日月
    ctx.fillStyle = 'rgba(255,240,190,0.85)';
    ctx.beginPath(); ctx.arc(300, 70, 22, 0, TAU); ctx.fill();
    ctx.fillStyle = '#16123a';
    ctx.beginPath(); ctx.arc(310, 63, 20, 0, TAU); ctx.fill();
    drawScrollingTile(ctx, this.clouds2, this.scroll * 0.6, 0.9);
    const order = [0, 1, 2];
    for (const layer of order) {
      if (layer === 1) drawScrollingTile(ctx, this.clouds, this.scroll, 0.9);
      for (const p of this.pieces) {
        if (p.layer !== layer) continue;
        ctx.globalAlpha = [0.45, 0.75, 1][layer];
        drawRubble(ctx, p);
      }
      ctx.globalAlpha = 1;
      // 遠いがれきほど空の色にとける
      if (layer === 0) { ctx.fillStyle = 'rgba(60,40,100,0.3)'; ctx.fillRect(0, 0, FIELD_W, FIELD_H); }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const gl of this.glints) {
      const a = Math.sin((gl.life / 50) * Math.PI) * 0.7;
      ctx.fillStyle = `rgba(255,230,150,${a})`;
      ctx.fillRect(gl.x - 0.5, gl.y - 3, 1, 6);
      ctx.fillRect(gl.x - 3, gl.y - 0.5, 6, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
    // 弾が見やすいように、少し暗くする
    ctx.fillStyle = 'rgba(8,4,20,0.25)';
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  }
}

// ------------------------------------------------------------
//  スペルカード背景（ボスの bosses の def.spellBg で選ぶ）
// ------------------------------------------------------------
function drawSpellBG(ctx, kind, t) {
  ctx.save();
  switch (kind) {
    case 'kawara': {
      // 1面：焼きたての瓦と、舞い上がる火の粉
      const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
      g.addColorStop(0, '#1a0614');
      g.addColorStop(1, '#3a0e16');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
      ctx.fillStyle = 'rgba(255,230,200,0.12)';
      ctx.beginPath(); ctx.arc(300, 90, 46, 0, TAU); ctx.fill();
      for (let row = 0; row < 9; row++) {
        const y = ((row * 60 + t * 0.5) % (FIELD_H + 60)) - 30;
        const off = (row % 2) * 16 + (t * 0.3 * (row % 2 ? 1 : -1)) % 32;
        ctx.fillStyle = `rgba(${row % 2 ? '90,40,40' : '70,30,40'},0.35)`;
        for (let x = -32 + off; x < FIELD_W + 32; x += 32) { ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI); ctx.fill(); }
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 40; i++) {
        const x = (i * 53.7 + Math.sin(t * 0.03 + i) * 14) % FIELD_W;
        const y = FIELD_H - ((t * (0.7 + (i % 4) * 0.3) + i * 41) % (FIELD_H + 20));
        ctx.fillStyle = `rgba(255,${120 + (i % 3) * 40},60,${0.3 + 0.3 * Math.sin(t * 0.1 + i)})`;
        ctx.fillRect(x, y, 2, 2);
      }
      break;
    }
    case 'yamori': {
      // 2面：月明かりの障子窓と、はい回るやもりの影
      ctx.fillStyle = '#071512';
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
      ctx.fillStyle = 'rgba(200,220,190,0.1)';
      ctx.fillRect(60, 50, 264, 300);
      ctx.strokeStyle = 'rgba(20,30,20,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 60; x <= 324; x += 44) { ctx.moveTo(x, 50); ctx.lineTo(x, 350); }
      for (let y = 50; y <= 350; y += 50) { ctx.moveTo(60, y); ctx.lineTo(324, y); }
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const gx = 100 + i * 90 + Math.sin(t * 0.01 + i) * 30, gy = ((t * 0.4 + i * 140) % 420) - 20;
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(Math.PI / 2 + Math.sin(t * 0.02 + i) * 0.3);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath(); ctx.ellipse(0, 0, 14, 5, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(14, 0, 4, 0, TAU); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.quadraticCurveTo(-24, 6 * Math.sin(t * 0.1 + i), -32, 0); ctx.stroke();
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(10, s * 9); ctx.moveTo(-6, 0); ctx.lineTo(-10, s * 9); ctx.stroke(); }
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(220,240,200,0.5)';
      for (let i = 0; i < 30; i++) ctx.fillRect((i * 61.3 + Math.sin(t * 0.07 + i) * 20) % FIELD_W, (i * 37.9 + Math.cos(t * 0.05 + i) * 20 + FIELD_H) % FIELD_H, 2, 2);
      break;
    }
    case 'nurari': {
      // 3面：湯気と椿の花びら
      const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
      g.addColorStop(0, '#0c1028');
      g.addColorStop(1, '#1e2244');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
      ctx.strokeStyle = 'rgba(230,230,255,0.12)';
      ctx.lineWidth = 6;
      for (let i = 0; i < 5; i++) {
        const bx = 60 + i * 66;
        ctx.beginPath();
        for (let y = FIELD_H; y >= 0; y -= 12) ctx.lineTo(bx + Math.sin(y * 0.03 - t * 0.04 + i) * 18, y);
        ctx.stroke();
      }
      for (let i = 0; i < 18; i++) {
        const x = (i * 71.3 + t * 0.4) % (FIELD_W + 20) - 10;
        const y = (i * 47.1 + t * (0.6 + (i % 3) * 0.2)) % (FIELD_H + 20) - 10;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 0.02 + i);
        ctx.fillStyle = 'rgba(210,40,60,0.45)';
        ctx.beginPath(); ctx.ellipse(0, 0, 6, 3.5, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'hashira': {
      // 4面：年輪と、行き交う柱
      ctx.fillStyle = '#1e140a';
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
      ctx.save();
      ctx.translate(192, 190);
      ctx.rotate(t * 0.002);
      for (let i = 1; i < 16; i++) {
        ctx.strokeStyle = `rgba(200,150,90,${0.08 + (i % 3) * 0.04})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let a = 0; a <= TAU + 0.01; a += 0.2) {
          const rr = i * 18 + Math.sin(a * 3 + i) * 4;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.stroke();
      }
      ctx.restore();
      for (let i = 0; i < 5; i++) {
        const x = ((i * 97 + t * (i % 2 ? 0.5 : -0.5)) % (FIELD_W + 60) + FIELD_W + 60) % (FIELD_W + 60) - 30;
        ctx.fillStyle = 'rgba(90,60,30,0.35)';
        ctx.fillRect(x - 12, 0, 24, FIELD_H);
        ctx.fillStyle = 'rgba(255,220,170,0.08)';
        ctx.fillRect(x - 12, 0, 4, FIELD_H);
      }
      break;
    }
    case 'yanari': {
      // 5面：きしむ屋敷。ひびが脈打ち、音の輪が広がる
      ctx.fillStyle = '#12061c';
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
      const beat = (t % 40) / 40;
      ctx.strokeStyle = `rgba(200,120,255,${0.35 * (1 - beat)})`;
      ctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.arc(192, 170, 30 + (beat + k) * 90, 0, TAU); ctx.stroke();
      }
      const r = new RNG(77);
      ctx.strokeStyle = `rgba(255,170,255,${0.2 + 0.2 * (1 - beat)})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        let x = 192, y = 170;
        const a0 = (i / 9) * TAU;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 0; k < 7; k++) {
          const a = a0 + (r.next() - 0.5) * 0.9;
          x += Math.cos(a) * 34; y += Math.sin(a) * 34;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      for (let i = 0; i < 5; i++) {
        const sx = 40 + i * 76, sw = Math.sin(t * 0.04 + i) * 0.4;
        ctx.save();
        ctx.translate(sx, 0);
        ctx.rotate(sw * 0.3);
        ctx.strokeStyle = 'rgba(160,120,200,0.25)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 70); ctx.stroke();
        ctx.fillStyle = 'rgba(255,150,220,0.25)';
        ctx.beginPath(); ctx.ellipse(0, 80, 8, 11, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'ruri': {
      // 2面中ボス・瑠璃：瑠璃色の夜、舞う頁と蝶
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
    case 'zashiki': {
      // 6面ボス・座敷 宿美：着物の柄（流水・梅・三日月）と、鈴のきらめき
      const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
      g.addColorStop(0, '#141038');
      g.addColorStop(1, '#2c2a66');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
      ctx.strokeStyle = 'rgba(240,220,170,0.16)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const by = 40 + i * 78;
        ctx.beginPath();
        for (let x = -10; x <= FIELD_W + 10; x += 10) ctx.lineTo(x, by + Math.sin(x * 0.025 + t * 0.02 + i) * 14);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,240,170,0.35)';
      ctx.beginPath(); ctx.arc(70, 90, 26, 0, TAU); ctx.fill();
      ctx.fillStyle = '#18143c';
      ctx.beginPath(); ctx.arc(80, 82, 24, 0, TAU); ctx.fill();
      for (let i = 0; i < 16; i++) {
        const x = (i * 67.3 + t * 0.35) % (FIELD_W + 30) - 15;
        const y = (i * 41.7 + t * (0.4 + (i % 3) * 0.15)) % (FIELD_H + 30) - 15;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 0.01 + i);
        ctx.fillStyle = 'rgba(250,230,190,0.32)';
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * TAU;
          ctx.beginPath(); ctx.arc(Math.cos(a) * 4, Math.sin(a) * 4, 3.2, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = 'rgba(200,120,90,0.5)';
        ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 12; i++) {
        const a = 0.3 + 0.3 * Math.sin(t * 0.08 + i * 1.7);
        const x = (i * 97.1) % FIELD_W, y = (i * 53.9 + 30) % FIELD_H;
        ctx.fillStyle = `rgba(255,220,120,${a})`;
        ctx.fillRect(x - 0.5, y - 4, 1, 8);
        ctx.fillRect(x - 4, y - 0.5, 8, 1);
      }
      break;
    }
    case 'ichimatsu': {
      // 4面中ボス：ゆっくり流れる市松模様（チェックの柄）と、ぶかぶかのパーカーの赤
      ctx.fillStyle = '#16080e';
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
      const cell = 32, ox = (t * 0.3) % (cell * 2), oy = (t * 0.2) % (cell * 2);
      ctx.fillStyle = 'rgba(120,30,60,0.32)';
      for (let y = -cell * 2 + oy; y < FIELD_H; y += cell) {
        for (let x = -cell * 2 + ox; x < FIELD_W; x += cell) {
          if ((Math.round((x - ox) / cell) + Math.round((y - oy) / cell)) % 2 === 0) ctx.fillRect(x, y, cell, cell);
        }
      }
      const g = ctx.createRadialGradient(192, 180, 30, 192, 180, 280);
      g.addColorStop(0, 'rgba(200,50,90,0.22)');
      g.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
      // 緑の髪の色をした細い線が横切る
      ctx.strokeStyle = 'rgba(80,220,170,0.18)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const y = (i * 120 + t * 0.6) % (FIELD_H + 40) - 20;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(FIELD_W, y + 30); ctx.stroke();
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
