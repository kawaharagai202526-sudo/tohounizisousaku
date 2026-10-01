'use strict';
// ============================================================
//  入力（キーボード / タッチ / ゲームパッド）
// ============================================================

const KEYMAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyZ: 'shot', Space: 'shot', Enter: 'shot',
  KeyX: 'bomb', Backspace: 'bomb',
  ShiftLeft: 'focus', ShiftRight: 'focus',
  Escape: 'pause', KeyP: 'pause',
  ControlLeft: 'skip', ControlRight: 'skip',
};
const ACTIONS = ['up', 'down', 'left', 'right', 'shot', 'bomb', 'focus', 'pause', 'skip'];

const Input = {
  keys: {},          // 押されている物理キー
  just: {},          // 前回の update 以降に押された操作
  held: {},          // 今フレームで押されている操作
  prevHeld: {},
  pressedMap: {},
  heldFrames: {},
  virtual: {},       // タッチボタンによる押下
  pad: {},           // ゲームパッドによる押下
  debugHold: new Set(),
  suspended: false,
  pointers: new Map(),
  touchButtons: [],
  moveDX: 0,
  moveDY: 0,
  taps: [],
  tapQueue: [],
  isTouch: false,
  canvas: null,
  onFirstInput: null,

  init(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', e => {
      if (this.suspended) return; // 管理者ページなどで文字を入力している間はゲームに渡さない
      this.firstInput();
      if (e.code === 'KeyM' && !e.repeat) { Sound.toggleMute(); return; }
      const a = KEYMAP[e.code];
      if (!a) return;
      e.preventDefault();
      if (!this.keys[e.code] && !e.repeat) this.just[a] = true;
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', e => {
      if (this.suspended) return;
      if (KEYMAP[e.code]) { this.keys[e.code] = false; e.preventDefault(); }
    });
    window.addEventListener('blur', () => { this.keys = {}; this.virtual = {}; });

    canvas.addEventListener('pointerdown', e => this.onPointerDown(e));
    canvas.addEventListener('pointermove', e => this.onPointerMove(e));
    const up = e => this.onPointerUp(e);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  },

  firstInput() {
    if (this.onFirstInput) { const f = this.onFirstInput; this.onFirstInput = null; f(); }
    Sound.unlock();
  },

  toLogical(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * SCREEN_W / r.width,
      y: (e.clientY - r.top) * SCREEN_H / r.height,
    };
  },

  onPointerDown(e) {
    this.firstInput();
    const p = this.toLogical(e);
    // メニューの選択や会話送りなどのクリック（タップ）はマウスでも受け付ける
    this.tapQueue.push(p);
    // 自機の操作（ドラッグで移動・画面のボム／低速／ポーズボタン）はマウスでは不可
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    this.isTouch = true;
    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* 無視 */ }
    const btn = this.touchButtons.find(b => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
    if (btn) {
      if (btn.toggle) this.virtual[btn.action] = !this.virtual[btn.action];
      else { this.virtual[btn.action] = true; this.just[btn.action] = true; }
      this.pointers.set(e.pointerId, { role: 'button', btn });
    } else {
      this.pointers.set(e.pointerId, { role: 'move', lx: p.x, ly: p.y });
    }
  },

  onPointerMove(e) {
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr || ptr.role !== 'move') return;
    e.preventDefault();
    const p = this.toLogical(e);
    this.moveDX += p.x - ptr.lx;
    this.moveDY += p.y - ptr.ly;
    ptr.lx = p.x;
    ptr.ly = p.y;
  },

  onPointerUp(e) {
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) return;
    if (ptr.role === 'button' && !ptr.btn.toggle) this.virtual[ptr.btn.action] = false;
    this.pointers.delete(e.pointerId);
  },

  // タッチで自機を動かしている最中か
  get dragging() {
    for (const p of this.pointers.values()) if (p.role === 'move') return true;
    return false;
  },

  setTouchButtons(list) {
    this.touchButtons = list;
    for (const b of list) if (b.toggle) this.virtual[b.action] = false;
  },

  consumeMove() {
    const d = { x: this.moveDX, y: this.moveDY };
    this.moveDX = 0;
    this.moveDY = 0;
    return d;
  },

  pollGamepad() {
    this.pad = {};
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const b = i => gp.buttons[i] && gp.buttons[i].pressed;
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (b(12) || ay < -0.45) this.pad.up = true;
      if (b(13) || ay > 0.45) this.pad.down = true;
      if (b(14) || ax < -0.45) this.pad.left = true;
      if (b(15) || ax > 0.45) this.pad.right = true;
      if (b(0)) this.pad.shot = true;
      if (b(1)) this.pad.bomb = true;
      if (b(2) || b(4) || b(5) || b(6) || b(7)) this.pad.focus = true;
      if (b(9)) this.pad.pause = true;
      if (b(3)) this.pad.skip = true;
      if (gp.buttons.some(x => x.pressed)) this.firstInput();
    }
  },

  update() {
    this.pollGamepad();
    const kb = {};
    for (const code in this.keys) if (this.keys[code]) kb[KEYMAP[code]] = true;
    for (const a of ACTIONS) {
      this.prevHeld[a] = this.held[a];
      this.held[a] = !!(kb[a] || this.virtual[a] || this.pad[a] || this.debugHold.has(a));
      this.pressedMap[a] = !!(this.just[a] || (this.held[a] && !this.prevHeld[a]));
      this.just[a] = false;
      this.heldFrames[a] = this.held[a] ? (this.heldFrames[a] || 0) + 1 : 0;
    }
    this.taps = this.tapQueue;
    this.tapQueue = [];
  },

  down(a) { return !!this.held[a]; },
  pressed(a) { return !!this.pressedMap[a]; },
  // メニュー用のキーリピート
  repeat(a) {
    if (this.pressedMap[a]) return true;
    const f = this.heldFrames[a] || 0;
    return f > 20 && f % 5 === 0;
  },
  tapIn(x, y, w, h) {
    return this.taps.some(t => t.x >= x && t.x <= x + w && t.y >= y && t.y <= y + h);
  },
  anyTap() { return this.taps.length > 0; },
};
