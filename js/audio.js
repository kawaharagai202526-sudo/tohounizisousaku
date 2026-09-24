'use strict';
// ============================================================
//  サウンド：効果音シンセ と BGM シーケンサ（MML＋コード進行から自動伴奏）
//  音声ファイルは使わず、すべて Web Audio でその場で合成する。
// ============================================================

const Sound = {
  ctx: null,
  master: null,
  bgmBus: null,
  seBus: null,
  echoIn: null,
  noiseBuf: null,
  pulseWave: null,
  bgmVolume: Store.get('bgmVol', 0.7),
  seVolume: Store.get('seVol', 0.7),
  muted: Store.get('muted', false),
  pending: new Set(),
  song: null,
  songId: null,
  wantSong: null,
  compiled: {},

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.connect(comp);
      this.bgmBus = ctx.createGain();
      this.bgmBus.connect(this.master);
      this.seBus = ctx.createGain();
      this.seBus.connect(this.master);
      // 簡易エコー（ピチューン音やスペル宣言に使う）
      this.echoIn = ctx.createGain();
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.13;
      const fb = ctx.createGain();
      fb.gain.value = 0.32;
      const wet = ctx.createGain();
      wet.gain.value = 0.4;
      this.echoIn.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(wet);
      wet.connect(this.seBus);
      this.echoIn.connect(this.seBus);

      const len = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      // デューティ比25%の矩形波
      const N = 32, re = new Float32Array(N), im = new Float32Array(N);
      for (let n = 1; n < N; n++) im[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25) * 1.2;
      this.pulseWave = ctx.createPeriodicWave(re, im);

      this.applyVolume();
      setInterval(() => this.schedule(), 40);
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend();
        else this.ctx.resume();
      });
      if (this.wantSong) { const id = this.wantSong; this.wantSong = null; this.playBgm(id); }
    }
    if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume();
  },

  applyVolume() {
    if (!this.ctx) return;
    this.bgmBus.gain.value = this.muted ? 0 : this.bgmVolume * 0.85;
    this.seBus.gain.value = this.muted ? 0 : this.seVolume * 0.9;
  },
  setVolumes(bgm, se) {
    this.bgmVolume = bgm;
    this.seVolume = se;
    Store.set('bgmVol', bgm);
    Store.set('seVol', se);
    this.applyVolume();
  },
  toggleMute() {
    this.muted = !this.muted;
    Store.set('muted', this.muted);
    this.applyVolume();
  },

  // ---------------- 効果音 ----------------
  se(name) { this.pending.add(name); },
  // 1フレームに同じ効果音は1回だけ鳴らす
  flush() {
    if (!this.ctx || this.ctx.state !== 'running') { this.pending.clear(); return; }
    const t = this.ctx.currentTime + 0.005;
    for (const name of this.pending) {
      const f = SE_DEFS[name];
      if (!f) continue;
      const gap = SE_GAP[name] || 0;
      if (gap && t - (this.lastPlayed[name] || 0) < gap) continue;
      this.lastPlayed[name] = t;
      f(this, t, this.seBus);
    }
    this.pending.clear();
  },
  lastPlayed: {},

  osc(type, f0, f1, t, dur, vol, dest, attack = 0.003) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    if (type === 'pulse') o.setPeriodicWave(this.pulseWave); else o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  },

  noise(t, dur, vol, dest, type = 'lowpass', f0 = 2000, f1 = 0, q = 0.7) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  },

  // ---------------- BGM ----------------
  playBgm(id) {
    if (!this.ctx) { this.wantSong = id; this.songId = id; return; }
    if (this.song && this.songId === id) return;
    this.stopBgm(0.4);
    const def = SONGS[id];
    if (!def) return;
    if (!this.compiled[id]) this.compiled[id] = compileSong(def);
    const gain = this.ctx.createGain();
    gain.connect(this.bgmBus);
    this.song = { c: this.compiled[id], gain, t0: this.ctx.currentTime + 0.08, idx: 0 };
    this.songId = id;
    this.schedule();
  },
  stopBgm(fade = 1.0) {
    this.wantSong = null;
    if (!this.song) { this.songId = null; return; }
    const g = this.song.gain;
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => g.disconnect(), fade * 1000 + 3000);
    this.song = null;
    this.songId = null;
  },

  schedule() {
    const s = this.song;
    if (!s || !this.ctx) return;
    const c = s.c;
    if (!c.events.length) return;
    const spb = 60 / c.bpm;
    const now = this.ctx.currentTime;
    const horizon = now + 0.2;
    let guard = 0;
    while (guard++ < 2000) {
      if (s.idx >= c.events.length) {
        // ループ：loopBeat を曲の終端の時刻に合わせ直す
        s.t0 += (c.lengthBeats - c.loopBeat) * spb;
        s.idx = c.loopIndex;
        continue;
      }
      const ev = c.events[s.idx];
      const t = s.t0 + ev.beat * spb;
      if (t > horizon) break;
      if (t >= now - 0.03) playInstrument(this, ev.inst, ev.midi, t, ev.dur * spb, ev.vol, s.gain);
      s.idx++;
    }
  },
};

function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

// ------------------------------------------------------------
//  効果音定義
// ------------------------------------------------------------
// 連続で鳴りやすい音の最短間隔（秒）
const SE_GAP = { tan: 0.05, hit: 0.06, graze: 0.035, shot: 0.07, item: 0.03, kill: 0.03, kira: 0.08 };

const SE_DEFS = {
  shot: (S, t, d) => S.noise(t, 0.04, 0.035, d, 'highpass', 5000),
  tan: (S, t, d) => { S.osc('sine', 1500, 520, t, 0.07, 0.09, d); S.noise(t, 0.03, 0.04, d, 'bandpass', 3200, 0, 1); },
  hit: (S, t, d) => S.noise(t, 0.045, 0.06, d, 'bandpass', 1700, 0, 0.9),
  kill: (S, t, d) => { S.noise(t, 0.3, 0.2, d, 'lowpass', 3500, 180); S.osc('square', 520, 80, t, 0.18, 0.05, d); },
  graze: (S, t, d) => { S.noise(t, 0.035, 0.09, d, 'highpass', 7000); S.osc('triangle', 3300, 2500, t, 0.03, 0.03, d); },
  item: (S, t, d) => S.osc('triangle', 1900, 0, t, 0.05, 0.06, d),
  powerup: (S, t, d) => [0, 4, 7, 12].forEach((n, i) => S.osc('pulse', 660 * Math.pow(2, n / 12), 0, t + i * 0.045, 0.08, 0.06, d)),
  pichuun: (S, t, d) => {
    S.osc('pulse', 1750, 170, t, 0.5, 0.16, S.echoIn);
    S.osc('sawtooth', 2600, 280, t, 0.38, 0.05, S.echoIn);
    S.noise(t, 0.45, 0.13, d, 'bandpass', 5200, 420, 2);
  },
  bomb: (S, t, d) => {
    S.noise(t, 1.3, 0.3, d, 'lowpass', 1400, 90);
    S.osc('sine', 120, 30, t, 1.1, 0.35, d);
    S.osc('sawtooth', 180, 1400, t, 0.5, 0.04, S.echoIn);
  },
  spell: (S, t, d) => {
    S.osc('sawtooth', 220, 1760, t, 0.55, 0.05, S.echoIn);
    S.osc('sine', 880, 1760, t + 0.08, 0.5, 0.07, S.echoIn);
    S.noise(t, 0.6, 0.07, d, 'bandpass', 900, 7000, 3);
  },
  charge: (S, t, d) => { S.osc('sine', 300, 1600, t, 0.7, 0.08, d, 0.3); S.osc('triangle', 600, 3200, t, 0.7, 0.03, d, 0.3); },
  bossdie: (S, t, d) => {
    S.noise(t, 2.6, 0.4, d, 'lowpass', 3500, 60);
    S.osc('sine', 95, 25, t, 2.0, 0.4, d);
    S.osc('pulse', 420, 40, t, 1.2, 0.07, S.echoIn);
  },
  extend: (S, t, d) => [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => S.osc('pulse', 523 * Math.pow(2, n / 12), 0, t + i * 0.055, 0.14, 0.07, S.echoIn)),
  bonus: (S, t, d) => [0, 7, 12, 16, 19, 24].forEach((n, i) => S.osc('triangle', 698 * Math.pow(2, n / 12), 0, t + i * 0.05, 0.25, 0.08, S.echoIn)),
  cursor: (S, t, d) => S.osc('pulse', 900, 0, t, 0.045, 0.05, d),
  ok: (S, t, d) => S.osc('pulse', 1200, 1800, t, 0.1, 0.06, d),
  cancel: (S, t, d) => S.osc('pulse', 520, 300, t, 0.1, 0.06, d),
  pause: (S, t, d) => { S.osc('triangle', 700, 0, t, 0.12, 0.1, d); S.osc('triangle', 1050, 0, t + 0.08, 0.12, 0.1, d); },
  timeout: (S, t, d) => S.osc('sine', 1400, 0, t, 0.09, 0.12, d),
  timeoutLow: (S, t, d) => S.osc('sine', 1900, 0, t, 0.12, 0.15, d),
  clear: (S, t, d) => S.noise(t, 0.35, 0.1, d, 'bandpass', 2000, 8000, 2),
  laser: (S, t, d) => { S.osc('sawtooth', 150, 90, t, 0.6, 0.05, d); S.noise(t, 0.5, 0.05, d, 'lowpass', 1600); },
  freeze: (S, t, d) => { S.osc('sine', 2400, 3600, t, 0.45, 0.08, S.echoIn); S.osc('triangle', 4800, 0, t, 0.3, 0.04, d); },
  kira: (S, t, d) => S.osc('sine', 2600, 0, t, 0.15, 0.05, S.echoIn),
  spark: (S, t, d) => { S.noise(t, 0.3, 0.12, d, 'highpass', 2000); S.osc('sawtooth', 90, 60, t, 2.4, 0.08, d, 0.02); },
};

// ------------------------------------------------------------
//  楽器
// ------------------------------------------------------------
function playInstrument(S, inst, midi, t, dur, vol, dest) {
  const ctx = S.ctx;
  const f = mtof(midi);
  const env = (g, a, peak, sus, tau, rel) => {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * sus, t + a, tau);
    g.gain.setTargetAtTime(0, t + dur, rel);
  };
  const stopAt = t + dur + 0.6;
  switch (inst) {
    case 'piano': {
      const g = ctx.createGain();
      env(g, 0.004, vol, 0.2, 0.28, 0.07);
      const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = f * 1.002;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(Math.min(f * 6, 9000), t);
      lp.frequency.setTargetAtTime(f * 1.5, t, 0.2);
      const g2 = ctx.createGain(); g2.gain.value = 0.18;
      o1.connect(g); o2.connect(lp); lp.connect(g2); g2.connect(g);
      g.connect(dest);
      o1.start(t); o2.start(t); o1.stop(stopAt); o2.stop(stopAt);
      break;
    }
    case 'bell': {
      const g = ctx.createGain();
      env(g, 0.002, vol, 0.05, 0.35, 0.2);
      [[1, 1], [2.0, 0.35], [3.01, 0.15]].forEach(([m, v]) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
        const og = ctx.createGain(); og.gain.value = v;
        o.connect(og); og.connect(g);
        o.start(t); o.stop(t + dur + 1.2);
      });
      g.connect(dest);
      break;
    }
    case 'lead':
    case 'trumpet': {
      const g = ctx.createGain();
      const o = ctx.createOscillator();
      if (inst === 'lead') o.setPeriodicWave(S.pulseWave); else o.type = 'sawtooth';
      o.frequency.value = f;
      // ビブラート
      const lfo = ctx.createOscillator(); lfo.frequency.value = 5.6;
      const lg = ctx.createGain();
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.35, dur));
      lfo.connect(lg); lg.connect(o.frequency);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = inst === 'trumpet' ? 3 : 0.7;
      if (inst === 'trumpet') {
        lp.frequency.setValueAtTime(f * 1.5, t);
        lp.frequency.linearRampToValueAtTime(Math.min(f * 7, 10000), t + 0.04);
        lp.frequency.setTargetAtTime(Math.min(f * 3.5, 8000), t + 0.04, 0.12);
        env(g, 0.025, vol, 0.8, 0.2, 0.05);
      } else {
        lp.frequency.value = 5200;
        env(g, 0.008, vol, 0.75, 0.15, 0.05);
      }
      o.connect(lp); lp.connect(g); g.connect(dest);
      o.start(t); lfo.start(t); o.stop(stopAt); lfo.stop(stopAt);
      break;
    }
    case 'strings': {
      const g = ctx.createGain();
      env(g, 0.12, vol, 0.85, 0.3, 0.25);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1900;
      [-7, 7].forEach(cents => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = cents;
        o.connect(lp); o.start(t); o.stop(t + dur + 1.2);
      });
      lp.connect(g); g.connect(dest);
      break;
    }
    case 'bass': {
      const g = ctx.createGain();
      env(g, 0.005, vol, 0.65, 0.18, 0.04);
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const sub = ctx.createOscillator(); sub.type = 'triangle'; sub.frequency.value = f;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
      lp.frequency.setValueAtTime(f * 8, t);
      lp.frequency.setTargetAtTime(f * 2.5, t, 0.08);
      o.connect(lp); lp.connect(g); sub.connect(g); g.connect(dest);
      o.start(t); sub.start(t); o.stop(stopAt); sub.stop(stopAt);
      break;
    }
    case 'kick': {
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      o.connect(g); g.connect(dest);
      o.start(t); o.stop(t + 0.25);
      break;
    }
    case 'snare':
      S.noise(t, 0.16, vol, dest, 'bandpass', 1900, 0, 0.6);
      S.osc('triangle', 220, 140, t, 0.08, vol * 0.6, dest);
      break;
    case 'hat':
      S.noise(t, 0.035, vol, dest, 'highpass', 8000);
      break;
    case 'ohat':
      S.noise(t, 0.2, vol, dest, 'highpass', 7000);
      break;
    case 'crash':
      S.noise(t, 1.3, vol, dest, 'highpass', 4500);
      break;
  }
}

// ------------------------------------------------------------
//  MML パーサ
//  o 音域, < > オクターブ上下, l 既定音長, v 音量(0-15)
//  c d e f g a b (+ # で半音上, - で半音下) 音長 付点 . タイ &
//  r 休符, [ ... ]n 繰り返し, | 小節線（ずれ検出用）
// ------------------------------------------------------------
function expandMMLLoops(src) {
  const re = /\[([^\[\]]*)\](\d*)/;
  let guard = 0;
  while (re.test(src) && guard++ < 100) {
    src = src.replace(re, (m, body, n) => body.repeat(Math.max(1, parseInt(n || '2', 10))));
  }
  return src;
}

function parseMML(src, inst, baseVol, out, startBeat = 0, label = '') {
  src = expandMMLLoops(src.toLowerCase());
  const SEMI = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  let i = 0, oct = 4, defLen = 0.5, beat = startBeat, vol = 1, bars = 0;
  const readNum = () => {
    let s = '';
    while (i < src.length && /[0-9]/.test(src[i])) s += src[i++];
    return s ? parseInt(s, 10) : null;
  };
  const readLen = () => {
    const n = readNum();
    let base = n ? 4 / n : defLen;
    let add = base, total = base;
    while (src[i] === '.') { add /= 2; total += add; i++; }
    return total;
  };
  const skipWs = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  while (i < src.length) {
    const ch = src[i++];
    if (/\s/.test(ch)) continue;
    if (ch === '|') {
      bars++;
      const off = (beat - startBeat) % 4;
      if (Math.abs(off) > 1e-6 && Math.abs(off - 4) > 1e-6) {
        console.warn(`MML(${label}): ${bars}小節目の長さがずれています (${(beat - startBeat).toFixed(3)} 拍)`);
      }
      continue;
    }
    if (ch === 'o') { oct = readNum() ?? 4; continue; }
    if (ch === '>') { oct++; continue; }
    if (ch === '<') { oct--; continue; }
    if (ch === 'l') {
      const n = readNum() || 8;
      defLen = 4 / n;
      let add = defLen;
      while (src[i] === '.') { add /= 2; defLen += add; i++; }
      continue;
    }
    if (ch === 'v') { vol = (readNum() ?? 12) / 12; continue; }
    if (ch === 'r') { beat += readLen(); continue; }
    if (SEMI[ch] !== undefined) {
      let semi = SEMI[ch];
      if (src[i] === '+' || src[i] === '#') { semi++; i++; } else if (src[i] === '-') { semi--; i++; }
      let len = readLen();
      // タイ
      for (;;) {
        skipWs();
        if (src[i] !== '&') break;
        i++;
        skipWs();
        if (SEMI[src[i]] !== undefined) {
          i++;
          if (src[i] === '+' || src[i] === '#' || src[i] === '-') i++;
          len += readLen();
        }
      }
      out.push({ beat, dur: len * 0.95, midi: (oct + 1) * 12 + semi, inst, vol: baseVol * vol });
      beat += len;
      continue;
    }
  }
  return beat;
}

// ------------------------------------------------------------
//  コード進行 → 伴奏自動生成
// ------------------------------------------------------------
function parseChord(sym) {
  const m = sym.match(/^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/);
  if (!m) return { root: 0, iv: [0, 4, 7], bass: 0 };
  const BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const acc = a => (a === '#' ? 1 : a === 'b' ? -1 : 0);
  const root = (BASE[m[1]] + acc(m[2]) + 12) % 12;
  const q = m[3] || '';
  let iv;
  if (q.startsWith('dim')) iv = [0, 3, 6];
  else if (q.startsWith('aug')) iv = [0, 4, 8];
  else if (q.startsWith('sus4')) iv = [0, 5, 7];
  else if (q.startsWith('m') && !q.startsWith('maj')) iv = [0, 3, 7];
  else iv = [0, 4, 7];
  if (q.includes('M7') || q.includes('maj7')) iv.push(11);
  else if (q.includes('7')) iv.push(10);
  const bass = m[4] ? (BASE[m[4]] + acc(m[5]) + 12) % 12 : root;
  return { root, iv, bass };
}

const DRUM_PATTERNS = {
  rock: { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
  drive: { kick: 'x.....x.x.....x.', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx' },
  light: { kick: 'x.......x.......', snare: '............x...', hat: '..x...x...x...x.' },
  march: { kick: 'x...x...x...x...', snare: '....x.......x.xx', hat: 'x.xxx.xxx.xxx.xx' },
};

function compileSong(def) {
  const ev = [];
  const L = def.label || def.title;
  const nBars = def.chords.length;
  parseMML(def.melody, def.lead, def.leadVol ?? 0.2, ev, 0, L);
  if (def.double) {
    const dbl = [];
    parseMML(def.melody, def.double.inst, def.double.vol, dbl, 0, L + '(double)');
    for (const e of dbl) { e.midi += def.double.shift || 0; ev.push(e); }
  }
  const bk = def.backing || {};
  for (let b = 0; b < nBars; b++) {
    const segs = def.chords[b].trim().split(/\s+/);
    const segLen = 4 / segs.length;
    segs.forEach((sym, si) => {
      const c = parseChord(sym);
      const start = b * 4 + si * segLen;
      // アルペジオ
      if (bk.arp) {
        const base = 60 + c.root;
        const tones = [];
        for (const o of [0, 12]) for (const v of c.iv.slice(0, 3)) tones.push(base + v + o);
        const seq = bk.arp.endsWith('updown')
          ? [0, 1, 2, 3, 4, 5, 4, 3, 2, 1]
          : [0, 1, 2, 3, 4, 5];
        const step = bk.arp.startsWith('8') ? 0.5 : 0.25;
        let k = 0;
        for (let x = 0; x < segLen - 1e-6; x += step, k++) {
          ev.push({ beat: start + x, dur: step * 0.9, midi: tones[seq[k % seq.length]], inst: bk.arpInst || 'piano', vol: bk.arpVol ?? 0.06 });
        }
      }
      // ベース
      if (bk.bass) {
        const bn = 36 + c.bass;
        if (bk.bass === 'whole') {
          ev.push({ beat: start, dur: segLen * 0.95, midi: bn, inst: 'bass', vol: bk.bassVol ?? 0.14 });
        } else {
          for (let x = 0, k = 0; x < segLen - 1e-6; x += 0.5, k++) {
            const oct = bk.bass === 'oct8' && k % 2 === 1 ? 12 : 0;
            ev.push({ beat: start + x, dur: 0.45, midi: bn + oct, inst: 'bass', vol: bk.bassVol ?? 0.14 });
          }
        }
      }
      // パッド
      if (bk.pad) {
        for (const v of c.iv) {
          ev.push({ beat: start, dur: segLen * 0.98, midi: 55 + ((c.root + v - 7 + 24) % 12), inst: 'strings', vol: bk.padVol ?? 0.035 });
        }
      }
    });
    // ドラム
    if (def.drums) {
      const pat = DRUM_PATTERNS[def.drums];
      const fill = b % 8 === 7 && def.fills !== false;
      for (const [inst, str] of Object.entries(pat)) {
        let s = str;
        if (fill && inst === 'snare') s = '....x...x.x.xxxx';
        for (let k = 0; k < 16; k++) {
          if (s[k] !== 'x') continue;
          const v = inst === 'kick' ? 0.42 : inst === 'snare' ? 0.16 : (k % 4 === 0 ? 0.05 : 0.03);
          ev.push({ beat: b * 4 + k * 0.25, dur: 0.2, midi: 60, inst, vol: v * (def.drumVol ?? 1) });
        }
      }
      if (b % 8 === 0) ev.push({ beat: b * 4, dur: 1, midi: 60, inst: 'crash', vol: 0.05 * (def.drumVol ?? 1) });
    }
  }
  ev.sort((a, b) => a.beat - b.beat);
  const loopBeat = (def.loopBar || 0) * 4;
  return {
    events: ev,
    bpm: def.bpm,
    lengthBeats: nBars * 4,
    loopBeat,
    loopIndex: Math.max(0, ev.findIndex(e => e.beat >= loopBeat - 1e-6)),
  };
}
