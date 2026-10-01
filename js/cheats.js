'use strict';
// ============================================================
//  管理者ページの「キー」（1文字で切り替える特別な機能）
//  キーを1つでも使ったプレイは、スコアが保存されずランキングにも載らない。
//  切り替えた状態はページを読み込み直すと元に戻る。
// ============================================================

// label・desc は管理者ページの「データベース」の一覧にだけ出す（キー入力画面には出さない）
const CHEAT_KEYS = {
  M: { id: 'mouse', label: 'マウス操作', desc: 'マウスで自機を操作できる（ドラッグで移動、画面のボム・低速ボタン）' },
  H: { id: 'lives', label: '残機カンスト', desc: '残機が常に最大（8）になる' },
  B: { id: 'bombs', label: 'ボムカンスト', desc: 'ボムが常に最大（8）になる' },
  S: { id: 'speed', label: 'ゲーム速度2倍', desc: 'ゲームの進む速さが2倍になる' },
  V: { id: 'bossOnly', label: 'ボス戦のみ', desc: '道中（中ボスを含む）をとばしてボス戦だけになる。ゲーム中に入れるとすぐボス戦へ' },
  I: { id: 'playerSpeed', label: '自機の速度2倍', desc: '自機の移動の速さが2倍になる' },
  D: { id: 'party', label: 'パリピ', desc: '画面の色が回り、ライト・紙吹雪・ビート・エアホーンで騒々しくなる' },
};
const CHEAT_MAX = 8; // 残機・ボムの上限（画面の星の数）

const Cheats = {
  on: {},

  anyOn() { return Object.values(this.on).some(Boolean); },
  // 使用中のキーの文字（例：'HBS'）
  activeLetters() { return Object.keys(CHEAT_KEYS).filter(k => this.on[CHEAT_KEYS[k].id]).join(''); },

  // 1文字を受け取って切り替える。割り当てのない文字なら null
  toggle(letter) {
    const def = CHEAT_KEYS[letter];
    if (!def) return null;
    const on = !this.on[def.id];
    this.on[def.id] = on;
    const scene = Game.scene;
    const inGame = typeof GameScene !== 'undefined' && scene instanceof GameScene;
    if (on && inGame) scene.usedKeys = true;
    if (def.id === 'mouse' && !on) Input.endMouseControl();
    if (def.id === 'bossOnly' && on && inGame) scene.skipToBoss();
    if (def.id === 'party' && !on) Party.stop();
    return { letter, label: def.label, on };
  },

  // ゲーム中に毎フレーム呼ぶ
  apply(g) {
    if (!this.anyOn()) return;
    g.usedKeys = true;
    if (this.on.lives) g.lives = CHEAT_MAX;
    if (this.on.bombs) g.bombs = CHEAT_MAX;
  },
};

// ------------------------------------------------------------
//  D：パリピ（色が回り、ライトと紙吹雪、ビートとエアホーンが鳴る）
//  画面全体が点滅するような演出はしない
// ------------------------------------------------------------
const Party = {
  active: false,
  t: 0,
  pulse: 0,
  confetti: [],
  beat: 0,
  spb: 0,
  anchor: null,
  lastT: -Infinity,
  freeAnchor: null,
  calm: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,

  piece(top) {
    return {
      x: frand(SCREEN_W), y: top ? frand(-SCREEN_H, 0) : -10,
      vx: frand(-0.6, 0.6), vy: frand(1.2, 2.6), r: frand(TAU), vr: frand(-0.15, 0.15),
      w: frand(4, 7), h: frand(7, 11), hue: Math.floor(frand(360)), ph: frand(100),
    };
  },

  update() {
    if (!Cheats.on.party) { if (this.active) this.stop(); return; }
    this.active = true;
    this.t++;
    while (this.confetti.length < 90) this.confetti.push(this.piece(true));
    for (const p of this.confetti) {
      p.x += p.vx + Math.sin((this.t + p.ph) * 0.05) * 0.7;
      p.y += p.vy;
      p.r += p.vr;
      if (p.y > SCREEN_H + 12) Object.assign(p, this.piece(false));
    }
    this.pulse = Math.exp(-this.beatPhase() * 5);
    const cv = Game.canvas;
    if (cv) {
      cv.style.filter = `hue-rotate(${(this.t * 3) % 360}deg) saturate(1.6)`;
      cv.style.transform = this.calm ? '' : `scale(${(1 + 0.012 * this.pulse).toFixed(4)})`;
    }
    this.scheduleAudio();
  },

  stop() {
    this.active = false;
    this.confetti = [];
    this.anchor = null;
    this.lastT = -Infinity;
    this.freeAnchor = null;
    if (Game.canvas) { Game.canvas.style.filter = ''; Game.canvas.style.transform = ''; }
  },

  // 拍の中のどこにいるか（0〜1）。音が鳴っていないときは128BPM相当
  beatPhase() {
    const S = Sound;
    if (S.ctx && S.ctx.state === 'running' && this.anchor !== null && this.spb) {
      const x = (S.ctx.currentTime - this.anchor) / this.spb;
      return x - Math.floor(x);
    }
    return (this.t % 28) / 28;
  },

  // BGMの拍に合わせて打楽器を重ねる
  scheduleAudio() {
    const S = Sound;
    if (!S.ctx || S.ctx.state !== 'running') return;
    const now = S.ctx.currentTime;
    const spb = 60 / (S.song ? S.song.c.bpm : 128);
    if (!S.song && this.freeAnchor === null) this.freeAnchor = now + 0.05;
    const anchor = S.song ? S.song.t0 : this.freeAnchor;
    if (this.spb !== spb || this.anchor !== anchor) {
      this.spb = spb;
      this.anchor = anchor;
      this.beat = Math.ceil((Math.max(now, this.lastT + 0.05) - anchor) / spb);
    }
    while (anchor + this.beat * spb < now + 0.25) {
      const t = anchor + this.beat * spb;
      if (t >= now - 0.02) this.hit(t, this.beat, spb);
      this.lastT = t;
      this.beat++;
    }
  },

  hit(t, k, spb) {
    const S = Sound, d = S.bgmBus;
    const n = ((k % 16) + 16) % 16;
    S.osc('sine', 160, 42, t, 0.3, 0.55, d);                       // キック（4つ打ち）
    S.noise(t, 0.02, 0.12, d, 'highpass', 3000);
    S.noise(t + spb / 2, 0.08, 0.1, d, 'highpass', 8000);          // 裏拍のハイハット
    if (n % 2 === 1) {                                               // 2・4拍目のクラップ
      for (const dt of [0, 0.011, 0.023]) S.noise(t + dt, 0.14, 0.18, d, 'bandpass', 1500, 0, 1.3);
    }
    if (n === 0) this.horn(t);
    if (n === 6 || n === 14) S.osc('sine', 1800, 3400, t + spb / 2, 0.3, 0.05, d, 0.05); // ホイッスル
  },

  // エアホーン（パッ、パッ、パーー）
  horn(t) {
    const ctx = Sound.ctx;
    for (const [st, len] of [[0, 0.11], [0.15, 0.11], [0.3, 0.55]]) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + st);
      g.gain.linearRampToValueAtTime(0.07, t + st + 0.015);
      g.gain.setValueAtTime(0.07, t + st + len - 0.03);
      g.gain.linearRampToValueAtTime(0, t + st + len);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2600;
      lp.connect(g);
      g.connect(Sound.bgmBus);
      for (const f of [466, 471, 233]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(f, t + st);
        o.frequency.linearRampToValueAtTime(f * 0.96, t + st + len);
        o.connect(lp);
        o.start(t + st);
        o.stop(t + st + len + 0.05);
      }
    }
  },

  draw(ctx) {
    if (!this.active) return;
    ctx.save();
    ctx.setTransform(Game.scale, 0, 0, Game.scale, 0, 0);
    // スポットライト
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const a = Math.sin(this.t * 0.03 + i * 1.7) * 0.55 + (i % 2 ? 0.25 : -0.25);
      const hue = (this.t * 4 + i * 90) % 360;
      ctx.save();
      ctx.translate(60 + i * 173, -20);
      ctx.rotate(a);
      const g = ctx.createLinearGradient(0, 0, 0, 520);
      g.addColorStop(0, `hsla(${hue},100%,65%,${(0.22 + 0.16 * this.pulse).toFixed(3)})`);
      g.addColorStop(1, `hsla(${hue},100%,65%,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.lineTo(70, 520); ctx.lineTo(-70, 520);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    // 紙吹雪
    ctx.globalAlpha = 0.85;
    for (const p of this.confetti) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.scale(1, Math.cos(p.r * 1.7));
      ctx.fillStyle = `hsl(${p.hue},95%,62%)`;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // 虹色の枠
    ctx.lineWidth = 3 + 4 * this.pulse;
    ctx.strokeStyle = `hsl(${(this.t * 6) % 360},100%,60%)`;
    ctx.strokeRect(2, 2, SCREEN_W - 4, SCREEN_H - 4);
    // 文字（ゲーム中は右のパネルのロゴの代わりに出す）
    const inGame = Game.scene instanceof GameScene;
    const [cx, cy, size] = inGame ? [528, Input.isTouch ? 348 : 400, 24] : [SCREEN_W - 92, 24, 18];
    const text = 'PARTY TIME!!';
    ctx.font = `italic 700 ${size}px ${FONT_EN}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    let x = cx - ctx.measureText(text).width / 2;
    [...text].forEach((ch, i) => {
      const y = cy - Math.abs(Math.sin(this.t * 0.12 + i * 0.5)) * 5 - this.pulse * 3;
      strokeText(ctx, ch, x, y, `hsl(${(this.t * 5 + i * 30) % 360},100%,65%)`, 'rgba(0,0,0,0.85)', 3);
      x += ctx.measureText(ch).width;
    });
    ctx.restore();
  },
};
