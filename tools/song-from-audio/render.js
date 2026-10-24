// ゲームの音源で曲をオフライン再生して WAV にする（耳で聞く・元の曲とくらべるため）
//   node render.js 曲ID 出力.wav [曲データ.js（SONGS に足す・差しかえる。- なら今の曲）] [最長の秒数]
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { execSync } = require('child_process');
function loadPlaywright() {
  const c = ['playwright'];
  try { c.push(path.join(execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(), 'playwright')); } catch (e) { /* npm が無い */ }
  for (const x of c) { try { return require(x); } catch (e) { /* 次を試す */ } }
  console.error('Playwright が見つかりません'); process.exit(2);
}
const { chromium } = loadPlaywright();
(async () => {
  const [id, out, songFile, secs] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', e => console.log('pageerror', e.message));
  p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.log(m.type(), m.text()); });
  await p.goto(pathToFileURL(path.resolve(__dirname, '../../index.html')).href);
  await p.waitForFunction(() => typeof SONGS !== 'undefined');
  if (songFile && songFile !== '-') {
    const src = fs.readFileSync(songFile, 'utf8');
    await p.evaluate(src => { const o = eval('({' + src + '})'); Object.assign(SONGS, o); }, src);
  }
  const b64 = await p.evaluate(async ([id, secs]) => {
    const c = compileSong(SONGS[id]);
    const len = Math.min(c.lengthSec + 1, secs ? +secs : 600);
    const sr = 22050;
    const ctx = new OfflineAudioContext(1, Math.ceil(len * sr), sr);
    const S = Object.create(Sound);
    S.ctx = ctx;
    const nlen = sr;
    S.noiseBuf = ctx.createBuffer(1, nlen, sr);
    const d = S.noiseBuf.getChannelData(0);
    for (let i = 0; i < nlen; i++) d[i] = Math.random() * 2 - 1;
    const N = 32, re = new Float32Array(N), im = new Float32Array(N);
    for (let n = 1; n < N; n++) im[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25) * 1.2;
    S.pulseWave = ctx.createPeriodicWave(re, im);
    const g = ctx.createGain(); g.gain.value = 0.8; g.connect(ctx.destination);
    S.echoIn = g;
    for (const ev of c.events) if (ev.time < len) playInstrument(S, ev.inst, ev.midi, ev.time + 0.05, ev.durSec, ev.vol, g);
    const buf = await ctx.startRendering();
    const x = buf.getChannelData(0);
    let peak = 0; for (const v of x) peak = Math.max(peak, Math.abs(v));
    const pcm = new Int16Array(x.length);
    for (let i = 0; i < x.length; i++) pcm[i] = Math.max(-32767, Math.min(32767, (x[i] / (peak || 1)) * 30000));
    const head = new ArrayBuffer(44), v = new DataView(head);
    const w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true);
    v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, pcm.length * 2, true);
    const all = new Uint8Array(44 + pcm.length * 2);
    all.set(new Uint8Array(head), 0); all.set(new Uint8Array(pcm.buffer), 44);
    let s = ''; for (let i = 0; i < all.length; i += 0x8000) s += String.fromCharCode.apply(null, all.subarray(i, i + 0x8000));
    return [btoa(s), c.lengthSec];
  }, [id, secs]);
  fs.writeFileSync(out, Buffer.from(b64[0], 'base64'));
  console.log(`${out}: ${b64[1].toFixed(1)}秒`);
  await b.close();
})();
