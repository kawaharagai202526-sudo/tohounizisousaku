// 使い方: node tools/render-video.mjs <htmlファイル> <出力mp4> [fps] [品質 std|low|high] [開始秒] [終了秒]
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
const [, , file, out, fpsArg = '24', q = 'std', t0Arg, t1Arg] = process.argv;
const FPS = +fpsArg, FF = process.env.FFMPEG || 'ffmpeg';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
p.on('pageerror', e => console.error('pageerror', e.message));
await p.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
await p.goto('file://' + (await import('path')).resolve(file) + '#render-' + q);
await p.waitForFunction(() => window.__render, null, { timeout: 600000 });
const T_END = await p.evaluate(() => __render.T_END);
const t0 = t0Arg ? +t0Arg : 0, t1 = t1Arg ? +t1Arg : T_END;
const wav = out.replace(/\.mp4$/, '.wav');
if (process.env.AUDIO_ONLY) { const b64 = await p.evaluate(() => __render.audio(22050)); fs.writeFileSync(out, Buffer.from(b64, 'base64')); await b.close(); console.log('audio done'); process.exit(0); }
if (!t0Arg) { const b64 = await p.evaluate(() => __render.audio(22050)); fs.writeFileSync(wav, Buffer.from(b64, 'base64')); }
const args = ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-'];
if (!t0Arg) args.push('-i', wav);
args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
if (!t0Arg) args.push('-c:a', 'aac', '-b:a', '128k', '-shortest');
args.push(out);
const ff = spawn(FF, args, { stdio: ['pipe', 'ignore', 'inherit'] });
const N = Math.round((t1 - t0) * FPS), start = Date.now();
// 最初の数フレームは表示の立ち上がり用に空回し
for (let i = 0; i < 3; i++) await p.evaluate(t => __render.frame(t, 1 / 30), t0);
for (let i = 0; i < N; i++) {
  const t = t0 + i / FPS;
  await p.evaluate(([t, dt]) => __render.frame(t, dt), [t, 1 / FPS]);
  const img = await p.screenshot({ type: 'jpeg', quality: 92 });
  if (!ff.stdin.write(img)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 50 === 0) { const el = (Date.now() - start) / 1000; console.log(`${i}/${N} t=${t.toFixed(1)} ${(el / (i + 1)).toFixed(2)}s/frame ETA ${((N - i) * el / (i + 1) / 60).toFixed(0)}min`); }
}
ff.stdin.end(); await new Promise(r => ff.on('close', r));
await b.close(); console.log('done', out);
