'use strict';
// ============================================================
//  共通定数・ユーティリティ
// ============================================================

const SCREEN_W = 640;
const SCREEN_H = 480;
const FIELD_X = 32;
const FIELD_Y = 16;
const FIELD_W = 384;
const FIELD_H = 448;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const FONT_JP = '"Shippori Mincho", "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "IPAMincho", "Noto Serif JP", serif';
const FONT_EN = '"Cormorant Garamond", "Palatino Linotype", Palatino, Georgia, serif';

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
function dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function normAngle(a) { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; }

const Ease = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inOutQuad: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
};

// ゲームプレイ用の乱数（シード固定可能）。演出用は Math.random を使う。
class RNG {
  constructor(seed) { this.seed(seed); }
  seed(s) { this.s = (s >>> 0) || 0x9e3779b9; }
  next() {
    let t = (this.s += 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
const rng = new RNG(Date.now());
function rand(a = 1, b) { if (b === undefined) { b = a; a = 0; } return a + rng.next() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function randSign() { return rng.next() < 0.5 ? -1 : 1; }
function pick(arr) { return arr[Math.floor(rng.next() * arr.length)]; }
function frand(a = 1, b) { if (b === undefined) { b = a; a = 0; } return a + Math.random() * (b - a); }

// ゲームの名前（タイトル画面・右のパネルのロゴ・ブラウザのタブに出る）
// index.html の <title> と README にも同じ名前が書いてあるので、変えるときはそちらも直す
const GAME_INFO = {
  title: '東方星降夜',
  subtitle: '〜 Night of Falling Stars.',
  genre: '東方Project 二次創作弾幕シューティング',
};

// ゲームの版（package.json の version と同じにする。テストで確かめている）
const GAME_VERSION = '1.2.0';

// 難易度 0:Easy 1:Normal 2:Hard 3:Lunatic
let DIFF = 1;
const DIFF_NAMES = ['Easy', 'Normal', 'Hard', 'Lunatic'];
const DIFF_COLORS = ['#7cf29a', '#7cc8ff', '#ffb35c', '#ff6fd8'];
function dv(e, n, h, l) { return [e, n, h, l][DIFF]; }

// localStorage は使えない環境もあるので必ず try で包む
const Store = {
  prefix: 'hoshifuru.',
  get(key, def) {
    try {
      const v = localStorage.getItem(this.prefix + key);
      return v === null ? def : JSON.parse(v);
    } catch (e) { return def; }
  },
  set(key, value) {
    try { localStorage.setItem(this.prefix + key, JSON.stringify(value)); } catch (e) { /* 保存できなくても続行 */ }
  },
  remove(key) {
    try { localStorage.removeItem(this.prefix + key); } catch (e) { /* 消せなくても続行 */ }
  },
};

// 画面に重ねて出すHTMLの部品（管理者ページ・アカウント画面で使う）
function domEl(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function domButton(cls, text, onClick) {
  const b = domEl('button', cls, text);
  b.type = 'button';
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

// 保存データの形式の版。保存データの形を変えたら数字を上げて、migrateSave に古い形からの変換を書く
// （変換しないと、前の版で遊んでいた人のスコアやアカウントが読めなくなる）
const SAVE_VERSION = 2;
function migrateSave() {
  const from = Store.get('saveVersion', 0);
  if (from >= SAVE_VERSION) return;
  // 2：アカウントとランキングをなくしたので、その記録を消す
  if (from < 2) for (const k of ['accounts', 'currentUser', 'onlineSession', 'onlineMe', 'onlinePlayers']) Store.remove(k);
  Store.set('saveVersion', SAVE_VERSION);
}
migrateSave();

function padScore(n, len = 9) {
  const s = String(Math.floor(n));
  return s.length >= len ? s : '0'.repeat(len - s.length) + s;
}

// 行頭に来てはいけない文字（禁則処理）
const NO_LINE_START = '、。，．・：；？！ー）」』】〕〉》ぁぃぅぇぉっゃゅょァィゥェォッャュョ…‥,.!?)]}';

// 日本語テキストを幅で折り返す（1文字単位）
function wrapText(ctx, text, maxW) {
  const lines = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of para) {
      if (ctx.measureText(line + ch).width > maxW && line && !NO_LINE_START.includes(ch)) {
        lines.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    lines.push(line);
  }
  return lines;
}

// 縁取り付きテキスト
function strokeText(ctx, text, x, y, fill = '#fff', stroke = 'rgba(0,0,0,0.85)', lw = 3) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// ============================================================
//  コルーチン（ジェネレータ）によるタスク実行
//  yield      → 1フレーム待つ
//  yield n    → nフレーム待つ
// ============================================================
class TaskRunner {
  constructor() { this.tasks = []; }
  add(gen) {
    const t = { gen, wait: 0, done: false };
    this.tasks.push(t);
    return t;
  }
  clear() { for (const t of this.tasks) t.done = true; this.tasks.length = 0; }
  get empty() { return this.tasks.length === 0; }
  update() {
    const n = this.tasks.length;
    for (let i = 0; i < n; i++) {
      const t = this.tasks[i];
      if (!t || t.done) continue;
      if (t.wait > 0) { t.wait--; continue; }
      const r = t.gen.next();
      if (r.done) t.done = true;
      else t.wait = (typeof r.value === 'number' ? Math.max(1, r.value) : 1) - 1;
    }
    if (this.tasks.some(t => t.done)) this.tasks = this.tasks.filter(t => !t.done);
  }
}

function* waitUntil(cond, timeout = Infinity) {
  let f = 0;
  while (!cond() && f < timeout) { f++; yield; }
}
