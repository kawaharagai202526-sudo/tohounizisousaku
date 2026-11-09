'use strict';
// ============================================================
//  サウンド：効果音シンセ と BGM シーケンサ（MML＋コード進行から自動伴奏）
//  ほとんどの音は Web Audio でその場で合成する。もらった音声ファイルの曲（js/bgmfiles.js）と、
//  もらった音（audio/a-o の a〜o。js/sefiles.js）の効果音（SE_SAMPLE。2.17.0）だけは、埋めこんだ音をそのまま鳴らす。
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
  pending: new Map(), // このフレームに鳴らす効果音（名前 → オプション）
  song: null,
  songId: null,
  wantSong: null,
  compiled: {},
  decoded: new Map(), // 音声ファイルの曲（BGM_FILES）をデコードして、ループ用に整えたもの（メモリを使うので最近の数曲だけ）

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
      this.loadSeFiles();
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
    this.bgmBus.gain.value = this.muted ? 0 : this.bgmVolume * BGM_BUS_LEVEL;
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
  // name：SE_SAMPLE（もらった音）か SE_DEFS（合成音）の名前。opt.dur：その秒数で小さくして止める（チャージの音など）
  se(name, opt = null) {
    if (name === 'graze') this.grazeN++; // グレイズは重なった数だけ大きく鳴らす（playGraze）
    if (opt || !this.pending.has(name)) this.pending.set(name, opt);
  },
  grazeN: 0, // 前にグレイズの音を鳴らしてから、たまったグレイズの数
  // 1フレームに同じ効果音は1回だけ鳴らす
  flush() {
    if (!this.ctx || this.ctx.state !== 'running') { this.pending.clear(); this.grazeN = 0; return; }
    const t = this.ctx.currentTime + 0.005;
    // 同じ音の連打を止める間隔（SE_GAP）は、実際の時間で測る（2.19.1。重くて音の処理が詰まり、音の時計が進まないあいだも、
    // 効果音がまとめて捨てられないように。前は音の時計で測っていた）
    const real = performance.now() / 1000;
    let grazeLater = false;
    for (const [name, opt] of this.pending) {
      const gap = SE_GAP[name] || 0;
      if (gap && real - (this.lastPlayed[name] ?? -1e9) < gap) {
        // グレイズは捨てずに、間があいたらまとめて（重なった数だけ大きく）鳴らす
        if (name === 'graze') grazeLater = true;
        continue;
      }
      if (name === 'graze') { this.lastPlayed[name] = real; this.playGraze(t); continue; }
      const smp = SE_SAMPLE[name];
      if (smp && this.seBuf[smp[0]]) {
        this.lastPlayed[name] = real;
        this.playSample(name, smp, t, opt);
        continue;
      }
      // もらった音がまだデコードできていないとき（読みこんだ直後など）は、前の合成音で代わりに鳴らす
      const f = SE_DEFS[smp ? SE_FALLBACK[name] || name : name];
      if (!f) continue;
      this.lastPlayed[name] = real;
      f(this, t, this.seBus);
    }
    this.pending.clear();
    if (grazeLater) this.pending.set('graze', null);
  },
  lastPlayed: {}, // 名前 → 最後に鳴らした実際の時間（秒。performance.now）
  seBuf: {},    // もらった音をデコードしたもの（文字 → AudioBuffer）
  seVoices: {}, // 鳴っているもらった音（名前 → [{ src, g, end }]）。SE_SAMPLE の数より多くは重ねない

  // もらった音（SE_FILES）をデコードしておく（最初に音を出せるようになったとき。数十ミリ秒で終わる）
  loadSeFiles() {
    if (typeof SE_FILES === 'undefined') return;
    for (const [k, f] of Object.entries(SE_FILES)) {
      const bin = atob(f.data), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      this.ctx.decodeAudioData(bytes.buffer, buf => { this.seBuf[k] = trimSilence(this.ctx, buf); }, () => {});
    }
  },
  // グレイズの音（2.19.0 でユーザーの指定）：アイテムの「カッ」と同じ音を GRAZE_SE.base 倍の大きさで鳴らす。
  // 前に鳴らしてから重なったグレイズが多いほど大きくする（同じフレームのグレイズや、SE_GAP で鳴らさなかったあいだのグレイズ）
  playGraze(t) {
    const n = Math.max(1, this.grazeN);
    this.grazeN = 0;
    const g = this.ctx.createGain();
    g.gain.value = GRAZE_SE.base * Math.min(GRAZE_SE.max, 1 + GRAZE_SE.step * (n - 1));
    g.connect(this.seBus);
    SE_DEFS.item(this, t, g);
  },
  playSample(name, [k, vol, max], t, opt) {
    const ctx = this.ctx, buf = this.seBuf[k];
    const voices = this.seVoices[name] || (this.seVoices[name] = []);
    for (let i = voices.length - 1; i >= 0; i--) if (voices[i].end <= t) voices.splice(i, 1);
    // 重ねられる数をこえたら、いちばん古い音をすぐ小さくして止める
    while (voices.length >= max) {
      const v = voices.shift();
      v.g.gain.cancelScheduledValues(t);
      v.g.gain.setTargetAtTime(0, t, 0.012);
      v.src.stop(t + 0.08);
    }
    const level = vol * (SE_SAMPLE_BOOST_BY[k] || SE_SAMPLE_BOOST) * ((SE_FILES[k] && SE_FILES[k].norm) || 1) * ((opt && opt.vol) || 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    src.connect(g);
    g.connect(this.seBus);
    src.start(t);
    let end = t + buf.duration;
    if (opt && opt.dur && opt.dur < buf.duration) {
      g.gain.setValueAtTime(level, t + opt.dur);
      g.gain.linearRampToValueAtTime(0, t + opt.dur + 0.08);
      src.stop(t + opt.dur + 0.1);
      end = t + opt.dur + 0.1;
    }
    voices.push({ src, g, end });
  },

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
    if (def.audio) { this.playAudioBgm(id, def); return; }
    if (!this.compiled[id]) this.compiled[id] = compileSong(def);
    const gain = this.ctx.createGain();
    gain.connect(this.bgmBus);
    this.song = { c: this.compiled[id], gain, t0: this.ctx.currentTime + 0.08, idx: 0 };
    this.songId = id;
    this.schedule();
  },
  // 音声ファイルの曲（def.audio が BGM_FILES のID）：デコードしてから、ループで鳴らす
  playAudioBgm(id, def) {
    const gain = this.ctx.createGain();
    gain.gain.value = def.vol ?? 1;
    gain.connect(this.bgmBus);
    const song = { audio: true, gain, src: null, c: { bpm: def.bpm || 120, events: [] }, t0: this.ctx.currentTime + 0.08, idx: 0 };
    this.song = song;
    this.songId = id;
    this.decodeAudio(def.audio).then(buf => {
      if (!buf || this.song !== song) return;
      // buf はループする範囲だけを切り出したもの（makeLoopBuffer）なので、全体をくり返す。
      // 入りのある曲（BGM_FILES の intro）は、はじめから流して、loopStart〜loopEnd をくり返す（2.18.0）
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      if (buf.introLoop) { src.loopStart = buf.introLoop.start; src.loopEnd = buf.introLoop.end; }
      src.connect(gain);
      song.t0 = this.ctx.currentTime + 0.03;
      src.start(song.t0);
      song.src = src;
    });
  },
  // 音声ファイルの曲を、鳴らす前にデコードしておく（少しあとで。いま鳴っている曲のじゃまをしないように）
  prefetch(id) {
    const def = SONGS[id];
    if (def && def.audio && this.ctx) setTimeout(() => this.decodeAudio(def.audio), 2000);
  },
  decodeAudio(key) {
    const cache = this.decoded;
    if (!cache.has(key)) {
      const f = typeof BGM_FILES !== 'undefined' && BGM_FILES[key];
      if (!f || !this.ctx) return Promise.resolve(null);
      const bin = atob(f.data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      cache.set(key, new Promise(res => this.ctx.decodeAudioData(bytes.buffer, buf => res(makeLoopBuffer(this.ctx, buf, f)), () => res(null))));
      // 古いものから捨てる（1曲で数MB〜数十MBのメモリを使うため）
      while (cache.size > 3) cache.delete(cache.keys().next().value);
    } else {
      const p = cache.get(key);
      cache.delete(key);
      cache.set(key, p);
    }
    return cache.get(key);
  },
  stopBgm(fade = 1.0) {
    this.wantSong = null;
    if (!this.song) { this.songId = null; return; }
    const g = this.song.gain;
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + fade);
    if (this.song.src) this.song.src.stop(t + fade + 0.05);
    setTimeout(() => g.disconnect(), fade * 1000 + 3000);
    this.song = null;
    this.songId = null;
  },

  schedule() {
    const s = this.song;
    if (!s || !this.ctx || s.audio) return;
    const c = s.c;
    if (!c.events.length) return;
    const now = this.ctx.currentTime;
    const horizon = now + BGM_LOOKAHEAD;
    let guard = 0;
    while (guard++ < 2000) {
      if (s.idx >= c.events.length) {
        // ループ：ループの始まり（loopSec）を曲の終端の時刻に合わせ直す
        s.t0 += c.lengthSec - c.loopSec;
        s.idx = c.loopIndex;
        continue;
      }
      const ev = c.events[s.idx];
      const t = s.t0 + ev.time;
      if (t > horizon) break;
      if (t >= now - 0.03) playInstrument(this, ev.inst, ev.midi, t, ev.durSec, ev.vol, s.gain);
      s.idx++;
    }
  },
};

function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

// 音声ファイルの曲をループ用に整える：前後の無音を切り（f.trim が false なら切らない）、loopStart〜loopEnd の範囲だけにして、
// 終わりの f.crossfade 秒（ふつう 0.03 秒）を始まりに重ねる。くり返したときに「プツッ」と鳴らず、なめらかにつながる
function makeLoopBuffer(ctx, buf, f) {
  if (f.intro) return makeIntroLoopBuffer(ctx, buf, f);
  const sr = buf.sampleRate, nch = buf.numberOfChannels;
  const chs = Array.from({ length: nch }, (_, c) => buf.getChannelData(c));
  let a = Math.max(0, Math.floor((f.loopStart || 0) * sr));
  let b = f.loopEnd ? Math.min(buf.length, Math.floor(f.loopEnd * sr)) : buf.length;
  if (f.trim !== false) {
    const loud = i => chs.some(ch => Math.abs(ch[i]) > 0.003);
    while (a < b && !loud(a)) a++;
    while (b > a && !loud(b - 1)) b--;
  }
  const xf = Math.min(Math.floor((f.crossfade ?? 0.03) * sr), (b - a) >> 2);
  const len = b - a - xf;
  if (len <= 0) return buf;
  const out = ctx.createBuffer(nch, len, sr);
  chs.forEach((src, c) => {
    const dst = out.getChannelData(c);
    dst.set(src.subarray(a, a + len));
    for (let i = 0; i < xf; i++) {
      const t = (i / xf) * Math.PI / 2;
      dst[i] = src[a + i] * Math.sin(t) + src[a + len + i] * Math.cos(t);
    }
  });
  return out;
}

// 効果音の前後の無音を切る（AAC は始まりに少し無音が入ることがあるので、鳴らしたときに遅れないように）
function trimSilence(ctx, buf, th = 0.002) {
  const chs = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  const loud = i => chs.some(ch => Math.abs(ch[i]) > th);
  let a = 0, b = buf.length;
  while (a < b && !loud(a)) a++;
  while (b > a && !loud(b - 1)) b--;
  if (b - a < 64 || (a === 0 && b === buf.length)) return buf;
  const out = ctx.createBuffer(chs.length, b - a, buf.sampleRate);
  chs.forEach((ch, c) => out.getChannelData(c).set(ch.subarray(a, b)));
  return out;
}

// ------------------------------------------------------------
//  もらった音（audio/a-o の a〜o。js/sefiles.js）で鳴らす効果音（2.17.0 でユーザーの指定）
//  名前: [音の文字, 大きさ, 重ねて鳴らせる数]。大きさは、いちばん大きいところの 50ms の音量（行の終わりの dB）で決めた。
//  前の合成音の音量（弾 -33・スペル宣言 -28・被弾 -27・ボム -13・ボス撃破 -11dB など）と同じくらいか、少し大きめ。
//  音は js/sefiles.js の norm で -14dB にそろえてあるので、大きさ＝10^((dB+14)/20)。
//  鳴らすときは、さらに SE_SAMPLE_BOOST 倍にする（行の終わりの dB は、その前の値。1.5 倍なので実際は +3.5dB）
//  どの場面でどの名前を鳴らすかは、それぞれのコードに書いてある（Sound.se('名前')。弾の音は fire() の se。ふつうは 'fire'）
// ------------------------------------------------------------
// もらった音を、表の大きさの何倍で鳴らすか。2.19.1 でユーザーの指定「3倍したもの、２倍したものをすべて１．５倍に変更する」で 1.5
// （2.17.1 でユーザーの指定「音は２倍」で 2 にし、2.18.1 で o・c・f だけ 3 にしていた）
const SE_SAMPLE_BOOST = 1.5;
// 音の文字ごとの倍率（書いていない文字は SE_SAMPLE_BOOST）。2.18.1〜2.19.0 は o・c・f が 3。2.19.1 からはすべて SE_SAMPLE_BOOST なので空
const SE_SAMPLE_BOOST_BY = {};
const SE_SAMPLE = {
  fire:       ['m', 0.126, 4], // 弾を撃つ（ボス・中ボス・体力がほどほどの敵。弱くて数の多い敵の弾は鳴らさない）（-32dB）
  needle:     ['n', 0.126, 3], // 針のような細い弾を撃つ（3面・エキストラ）（-32dB）
  oni:        ['k', 0.178, 2], // 1面：鬼面の弾を撃つ（-29dB）
  burst:      ['k', 0.251, 2], // 6面：手鞠がはじける・集めた弾が散らばる（-26dB）
  appear:     ['o', 0.158, 3], // 出てくる（火の玉・しっぽ・瞬間移動・弾を撃つ影や板や家・黄色の球など）（-30dB）
  charge:     ['c', 0.224, 1], // チャージ（6面）・1面「鬼の視線」のレーザーの点滅（-27dB）
  powerup:    ['c', 0.158, 1], // パワーアップ（-30dB）
  laserHand:  ['h', 0.158, 3], // 手・柱のレーザー（-30dB）
  laserBoss4: ['f', 0.178, 2], // 4面のボス（栂尾）のレーザー（-29dB）
  spread:     ['f', 0.178, 2], // 6面：惹きつけた弾が花のように開く（「誰もが振り向く福の神」と最後のスペル。2.19.0 でユーザーの指定）（-29dB）
  summon:     ['g', 0.200, 2], // 4面「百間継ぎの建て増し」の四角が建つ（-28dB）
  bonus:      ['a', 0.251, 1], // ボーナス（スペルカード取得・面のクリア）（-26dB）
  spell:      ['b', 0.316, 1], // スペルカードの宣言（-24dB）
  bossdie:    ['d', 1.000, 1], // ボスを倒した（エキストラで栂尾が撃ち落とされたときも。逃げていく中ボスは鳴らさない）（-14dB）
  extend:     ['e', 0.200, 1], // 1UP（-28dB）
  bomb:       ['i', 0.398, 2], // ボム（-22dB。2.19.2 でユーザーの指定「ボムの音を下げる」で半分（-6dB）にした。前は 0.794・-16dB）
  pichuun:    ['j', 0.398, 1], // 被弾（-22dB）
};
// もらった音がまだデコードできていないときに、代わりに鳴らす合成音（書いていない名前は、同じ名前の合成音）
const SE_FALLBACK = { fire: 'tan', needle: 'tan', oni: 'tan', burst: 'kira', appear: 'kira', laserHand: 'laser', laserBoss4: 'laser', spread: 'kira', summon: 'kira' };

// 入りのある曲（BGM_FILES の intro。2.18.0）：はじめから loopEnd までを1回流し、そのあとは loopStart〜loopEnd をくり返す。
// loopStart / loopEnd は、はじめの無音を切ったあとの秒（AAC のはじめに入る無音の扱いがブラウザでちがっても、ずれないように）。
// つなぎ目：loopEnd の手前 crossfade 秒を、loopStart の手前の音へなめらかに移していく（くり返しの部分は同じ曲の同じところなので、そのまま続いて聞こえる）
// fadeOut: [始まり, 終わり]（2.18.1）：もとの音声に入っているフェードアウト（振幅が「始まり」の 1 から「終わり」の 0 へ直線で下がる。秒は loopStart と同じ）。
// ループの中では、下がった分だけ大きくして打ち消す（ループのたびに曲が小さくなって消えていかないように）
function makeIntroLoopBuffer(ctx, buf, f) {
  const sr = buf.sampleRate, nch = buf.numberOfChannels;
  const chs = Array.from({ length: nch }, (_, c) => buf.getChannelData(c));
  const loud = i => chs.some(ch => Math.abs(ch[i]) > 0.003);
  let a = 0;
  while (a < buf.length && !loud(a)) a++;
  const ls = a + Math.round(f.loopStart * sr);
  const le = Math.min(buf.length, a + Math.round(f.loopEnd * sr));
  const xf = Math.min(Math.round((f.crossfade ?? 0.03) * sr), ls - a, (le - ls) >> 2);
  if (le - ls < sr || xf < 0) return buf; // ループの位置がおかしいときは、そのまま全体をくり返す
  // フェードアウトを打ち消す倍率（サンプルの位置 i ごと。フェードのないところは 1。打ち消すのは 20 倍まで）
  const [f0, f1] = f.fadeOut || [Infinity, Infinity];
  const unfade = i => { const t = (i - a) / sr; return t <= f0 ? 1 : 1 / Math.max(0.05, 1 - (t - f0) / (f1 - f0)); };
  const out = ctx.createBuffer(nch, le - a, sr);
  chs.forEach((src, c) => {
    const dst = out.getChannelData(c);
    dst.set(src.subarray(a, le));
    if (f.fadeOut) for (let i = Math.max(a, a + Math.ceil(f0 * sr)); i < le; i++) dst[i - a] = src[i] * unfade(i);
    for (let i = 0; i < xf; i++) {
      const t = (i / xf) * Math.PI / 2, j = le - xf + i, k = ls - xf + i;
      dst[j - a] = src[j] * unfade(j) * Math.cos(t) + src[k] * unfade(k) * Math.sin(t);
    }
  });
  out.introLoop = { start: (ls - a) / sr, end: (le - a) / sr };
  return out;
}

// ------------------------------------------------------------
//  効果音定義
// ------------------------------------------------------------
// BGM の大きさ（オプションの BGM 音量にかける倍率）。2.19.0 でユーザーの指定「背景ＢＧＭの音量は効果音以下にする」により 0.85 → 0.28（-9.6dB）。
// 曲はならした大きさ（RMS）が 0.15 くらいにそろえてあり（SONGS の vol）、いちばんよく鳴る弾の音「m」はいちばん大きいところが
// 0.126 × SE_SAMPLE_BOOST × -14dB × 0.9（効果音のバス）。2.19.1 で効果音の倍率を 2 → 1.5 にしたので、BGM も同じ割合で 0.28 → 0.21 にした
// （0.126 × 1.5 × 0.2 × 0.9 ＝ 0.034、0.15 × 0.21 ＝ 0.0315 で、BGM がそれ以下になる。オプションの音量が同じとき）
const BGM_BUS_LEVEL = 0.21;
// MML の曲を何秒先まで予約しておくか（2.19.1 でユーザーの指定「重くなった時に音が消える問題を解決」で 0.2 → 1.0。
// 処理が重くてメインの処理がしばらく止まると、予約より先に進んだ音は鳴らせずに抜けていた。0.3 秒止まると 8 秒で 26 音ほど抜けた）
const BGM_LOOKAHEAD = 1.0;
// グレイズの音（2.19.0 でユーザーの指定「グレイズがたまるとき、他の効果音より２割減少させた”カッ”という音を導入する。
// ただし、グレイズ音に限り、グレイズが重なった場合、音も大きくなる」）：アイテムの「カッ」の 0.8 倍。重なったグレイズ1つごとに +30%、2倍まで
const GRAZE_SE = { base: 0.8, step: 0.3, max: 2.0 };

// 連続で鳴りやすい音の最短間隔（秒）
const SE_GAP = {
  tan: 0.05, hit: 0.06, graze: 0.035, shot: 0.07, item: 0.03, kill: 0.03, kira: 0.08,
  fire: 0.07, needle: 0.06, oni: 0.08, burst: 0.08, appear: 0.06, laserHand: 0.08, laserBoss4: 0.08, spread: 0.08, summon: 0.05, temari: 0.05,
};

const SE_DEFS = {
  shot: (S, t, d) => S.noise(t, 0.04, 0.035, d, 'highpass', 5000),
  // 前の弾の音。2.17.0 からは、もらった音がデコードできていないときの代わりにだけ使う
  tan: (S, t, d) => { S.osc('sine', 1500, 520, t, 0.07, 0.09, d); S.noise(t, 0.03, 0.04, d, 'bandpass', 3200, 0, 1); },
  // 手鞠（6面）：前の弾の音「ピヨン」を大きくしたもの（2.17.0 でユーザーの指定）
  temari: (S, t, d) => { S.osc('sine', 1500, 520, t, 0.08, 0.2, d); S.noise(t, 0.03, 0.085, d, 'bandpass', 3200, 0, 1); },
  hit: (S, t, d) => S.noise(t, 0.045, 0.06, d, 'bandpass', 1700, 0, 0.9),
  kill: (S, t, d) => { S.noise(t, 0.3, 0.2, d, 'lowpass', 3500, 180); S.osc('square', 520, 80, t, 0.18, 0.05, d); },
  // アイテムを取ったときの「カッ」（2.18.0 でユーザーの指定）：ごく短い、乾いた硬い音（はじめの「カ」の雑音と、すぐ消える低めの四角い音）
  item: (S, t, d) => { S.noise(t, 0.024, 0.17, d, 'bandpass', 3200, 0, 1.2); S.osc('square', 1400, 900, t, 0.045, 0.05, d, 0.001); },
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
  // 家がきしむ「ギシッ」（5面の家鳴）
  gishi: (S, t, d) => { S.noise(t, 0.3, 0.14, d, 'bandpass', 900, 280, 7); S.osc('sawtooth', 76, 52, t, 0.32, 0.05, d); },
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

// 曲の途中でテンポやドラムを変える（def.parts）。
//   parts: [{ bar: 何小節目から（0〜）, bpm, drums, ramp: 前の何小節でテンポをなめらかに変えるか }]
//   書かなければ、曲全体が def.bpm と def.drums
function songParts(def, nBars) {
  const parts = (def.parts && def.parts.length ? def.parts : [{ bar: 0 }]).map(p => ({ bpm: def.bpm, drums: def.drums, ...p }));
  const barBpm = [], barPart = [];
  for (let b = 0, k = 0; b < nBars; b++) {
    while (k + 1 < parts.length && parts[k + 1].bar <= b) k++;
    barBpm.push(parts[k].bpm);
    barPart.push(k);
  }
  // ramp：つなぎ目の前の数小節で、次のテンポへ少しずつ近づける
  parts.forEach((p, k) => {
    if (!k || !p.ramp) return;
    const from = parts[k - 1].bpm;
    for (let i = 1; i <= p.ramp; i++) {
      const b = p.bar - p.ramp - 1 + i;
      if (b >= 0 && b < nBars) barBpm[b] = from + ((p.bpm - from) * i) / (p.ramp + 1);
    }
  });
  const barStart = [0];
  for (let b = 0; b < nBars; b++) barStart.push(barStart[b] + (4 * 60) / barBpm[b]);
  return { parts, barBpm, barPart, barStart };
}

function compileSong(def) {
  const ev = [];
  const L = def.label || def.title;
  const nBars = def.chords.length;
  const tm = songParts(def, nBars);
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
    // ドラム（parts ごとに変えられる。次の part の前の小節はフィル）
    const part = tm.parts[tm.barPart[b]];
    const partStart = b === part.bar;
    const nextPart = tm.barPart[b + 1] !== undefined && tm.barPart[b + 1] !== tm.barPart[b];
    if (part.drums) {
      const pat = DRUM_PATTERNS[part.drums];
      const fill = ((b - part.bar) % 8 === 7 || nextPart || b === nBars - 1) && def.fills !== false;
      for (const [inst, str] of Object.entries(pat)) {
        let s = str;
        if (fill && inst === 'snare') s = '....x...x.x.xxxx';
        for (let k = 0; k < 16; k++) {
          if (s[k] !== 'x') continue;
          const v = inst === 'kick' ? 0.42 : inst === 'snare' ? 0.16 : (k % 4 === 0 ? 0.05 : 0.03);
          ev.push({ beat: b * 4 + k * 0.25, dur: 0.2, midi: 60, inst, vol: v * (def.drumVol ?? 1) });
        }
      }
      if ((b - part.bar) % 8 === 0 || partStart) ev.push({ beat: b * 4, dur: 1, midi: 60, inst: 'crash', vol: 0.05 * (def.drumVol ?? 1) });
    }
  }
  // 拍 → 秒（テンポが変わる曲のため。音の長さも、その小節のテンポで秒にする）
  for (const e of ev) {
    const b = Math.min(nBars - 1, Math.max(0, Math.floor(e.beat / 4 + 1e-9)));
    const spb = 60 / tm.barBpm[b];
    e.time = tm.barStart[b] + (e.beat - b * 4) * spb;
    e.durSec = e.dur * spb;
  }
  ev.sort((a, b) => a.time - b.time);
  const loopBar = def.loopBar || 0;
  return {
    events: ev,
    bpm: tm.barBpm[0],
    lengthBeats: nBars * 4,
    lengthSec: tm.barStart[nBars],
    loopSec: tm.barStart[loopBar],
    loopIndex: Math.max(0, ev.findIndex(e => e.time >= tm.barStart[loopBar] - 1e-6)),
  };
}
