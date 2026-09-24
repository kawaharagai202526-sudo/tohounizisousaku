'use strict';
// ============================================================
//  弾・アイテムのスプライト（起動時にオフスクリーンへ描いてキャッシュ）
// ============================================================

const SPR = 2; // 事前描画の解像度倍率

const BCOL = {
  red: { rim: '#ff3434', core: '#ffffff' },
  orange: { rim: '#ff9a28', core: '#ffffff' },
  yellow: { rim: '#ffe03a', core: '#ffffff' },
  green: { rim: '#38ee68', core: '#ffffff' },
  cyan: { rim: '#34e2ff', core: '#ffffff' },
  blue: { rim: '#4a68ff', core: '#ffffff' },
  purple: { rim: '#b84cff', core: '#ffffff' },
  pink: { rim: '#ff5ad2', core: '#ffffff' },
  white: { rim: '#c8c8e0', core: '#ffffff' },
  dark: { rim: '#e8286e', core: '#14000a' },
};
const BCOLOR_NAMES = Object.keys(BCOL);

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function radialOrb(ctx, r, col, coreStop = 0.35) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, col.core);
  g.addColorStop(coreStop, col.core);
  g.addColorStop(coreStop + 0.2, col.rim);
  g.addColorStop(0.82, hexA(col.rim, 0.55));
  g.addColorStop(1, hexA(col.rim, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
}

function starPath(ctx, outer, inner, points = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / points;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// size: 描画サイズ(px), hitR: 当たり判定半径, rotate: 進行方向に回転, spin: 自転速度
const BTYPES = {
  small: { size: 14, hitR: 2.6, draw: (c, col) => radialOrb(c, 6.5, col, 0.36) },
  ball: { size: 22, hitR: 4.4, draw: (c, col) => radialOrb(c, 10, col, 0.42) },
  large: { size: 46, hitR: 10, additive: true, draw: (c, col) => radialOrb(c, 22, col, 0.34) },
  dot: { size: 10, hitR: 2.0, draw: (c, col) => radialOrb(c, 4.5, col, 0.3) },
  rice: {
    size: 18, hitR: 2.4, rotate: true,
    draw: (c, col) => {
      c.fillStyle = hexA(col.rim, 0.35);
      c.beginPath(); c.ellipse(0, 0, 8.5, 4.6, 0, 0, TAU); c.fill();
      c.fillStyle = col.rim;
      c.beginPath(); c.ellipse(0, 0, 7.2, 3.6, 0, 0, TAU); c.fill();
      c.fillStyle = col.core;
      c.beginPath(); c.ellipse(0, 0, 4.4, 1.7, 0, 0, TAU); c.fill();
    },
  },
  kunai: {
    size: 20, hitR: 2.4, rotate: true,
    draw: (c, col) => {
      c.fillStyle = col.rim;
      c.beginPath();
      c.moveTo(9, 0); c.lineTo(0, -3.8); c.lineTo(-7, -2.4); c.lineTo(-9, -4); c.lineTo(-7.5, 0);
      c.lineTo(-9, 4); c.lineTo(-7, 2.4); c.lineTo(0, 3.8); c.closePath(); c.fill();
      c.strokeStyle = col.core; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(-5, 0); c.lineTo(6, 0); c.stroke();
    },
  },
  amulet: {
    size: 20, hitR: 2.8, rotate: true,
    draw: (c, col) => {
      c.fillStyle = '#fbf6ec';
      c.fillRect(-7.5, -4.6, 15, 9.2);
      c.strokeStyle = col.rim; c.lineWidth = 1.6;
      c.strokeRect(-7.5, -4.6, 15, 9.2);
      c.fillStyle = col.rim;
      c.fillRect(-4, -1.6, 8, 3.2);
    },
  },
  star: {
    size: 20, hitR: 3.2, spin: 0.12,
    draw: (c, col) => {
      c.fillStyle = hexA(col.rim, 0.4); starPath(c, 9, 4); c.fill();
      c.fillStyle = col.rim; starPath(c, 7.5, 3.3); c.fill();
      c.fillStyle = col.core; starPath(c, 3.8, 1.7); c.fill();
    },
  },
  bigstar: {
    size: 38, hitR: 7, spin: 0.05,
    draw: (c, col) => {
      c.fillStyle = hexA(col.rim, 0.3); starPath(c, 18, 8); c.fill();
      c.fillStyle = col.rim; starPath(c, 15, 6.6); c.fill();
      c.fillStyle = col.core; starPath(c, 8, 3.4); c.fill();
    },
  },
  ice: {
    size: 22, hitR: 2.6, rotate: true,
    draw: (c, col) => {
      c.fillStyle = hexA(col.rim, 0.4);
      c.beginPath(); c.moveTo(10.5, 0); c.lineTo(0, -4.6); c.lineTo(-10.5, 0); c.lineTo(0, 4.6); c.closePath(); c.fill();
      c.fillStyle = col.rim;
      c.beginPath(); c.moveTo(9, 0); c.lineTo(0, -3.4); c.lineTo(-9, 0); c.lineTo(0, 3.4); c.closePath(); c.fill();
      c.strokeStyle = col.core; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(-6, 0); c.lineTo(7, 0); c.stroke();
    },
  },
};

const spriteCache = new Map();
function getBulletSprite(type, color) {
  const key = type + ':' + color;
  let c = spriteCache.get(key);
  if (!c) {
    const def = BTYPES[type];
    c = makeCanvas(def.size * SPR, def.size * SPR);
    const x = c.getContext('2d');
    x.scale(SPR, SPR);
    x.translate(def.size / 2, def.size / 2);
    def.draw(x, BCOL[color] || BCOL.white);
    spriteCache.set(key, c);
  }
  return c;
}

// 弾が出現するときの光
function getGlowSprite(color) {
  const key = 'glow:' + color;
  let c = spriteCache.get(key);
  if (!c) {
    const size = 32;
    c = makeCanvas(size * SPR, size * SPR);
    const x = c.getContext('2d');
    x.scale(SPR, SPR);
    x.translate(size / 2, size / 2);
    const rim = (BCOL[color] || BCOL.white).rim;
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 15);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.3, hexA(rim, 0.7));
    g.addColorStop(1, hexA(rim, 0));
    x.fillStyle = g;
    x.beginPath(); x.arc(0, 0, 15, 0, TAU); x.fill();
    spriteCache.set(key, c);
  }
  return c;
}

// ------------------------------------------------------------
//  アイテム
// ------------------------------------------------------------
const ITEM_DEFS = {
  power: { size: 12, color: '#e03030', label: 'P' },
  bigpower: { size: 18, color: '#e03030', label: 'P' },
  point: { size: 12, color: '#3050e0', label: '点' },
  bomb: { size: 16, color: '#22a848', label: 'B' },
  life: { size: 18, color: '#e03aa0', label: '★' },
  full: { size: 16, color: '#e0a020', label: 'F' },
  star: { size: 10 },
};

function getItemSprite(type) {
  const key = 'item:' + type;
  let c = spriteCache.get(key);
  if (!c) {
    const d = ITEM_DEFS[type];
    const pad = 4, size = d.size + pad * 2;
    c = makeCanvas(size * SPR, size * SPR);
    const x = c.getContext('2d');
    x.scale(SPR, SPR);
    x.translate(size / 2, size / 2);
    if (type === 'star') {
      x.fillStyle = 'rgba(200,255,140,0.45)'; starPath(x, 6.5, 2.8); x.fill();
      x.fillStyle = '#e8ffb0'; starPath(x, 4.5, 2); x.fill();
    } else {
      const s = d.size / 2;
      const g = x.createLinearGradient(0, -s, 0, s);
      g.addColorStop(0, hexA(d.color, 0.75));
      g.addColorStop(1, d.color);
      x.fillStyle = g;
      x.beginPath();
      x.roundRect ? x.roundRect(-s, -s, s * 2, s * 2, 2.5) : x.rect(-s, -s, s * 2, s * 2);
      x.fill();
      x.strokeStyle = 'rgba(255,255,255,0.9)';
      x.lineWidth = 1.2;
      x.stroke();
      x.fillStyle = '#fff';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.font = `bold ${Math.round(d.size * 0.72)}px ${FONT_JP}`;
      x.fillText(d.label, 0, 0.5);
    }
    spriteCache.set(key, c);
  }
  return c;
}
