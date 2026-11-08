#!/usr/bin/env node
// audio/a-o の音（a〜o）を、効果音として js/sefiles.js に埋めこむ（2.17.0）
//   node tools/embed-se.js
// それぞれの音を ffmpeg でモノラルの AAC（.m4a）にし、base64 の文字にして JS に入れる（file:// で開いても読めるように）。
// 音の大きさをそろえる倍率（norm：いちばん大きいところの 50ms の音量を -14dB にする）も書く。
// どの場面でどの音を鳴らすか・音ごとの大きさは js/audio.js の SE_SAMPLE。使わない文字（いまは l）は入れない
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'audio', 'a-o');
const out = path.join(root, 'js', 'sefiles.js');
const LETTERS = 'abcdefghijkmno'.split('');
const SR = 44100;
const REF = Math.pow(10, -14 / 20);

function ffmpeg(args, opts = {}) {
  return execFileSync('ffmpeg', ['-v', 'error', ...args], { maxBuffer: 256 << 20, ...opts });
}

// いちばん大きいところの 50ms の音量（RMS）
function peakRms(file) {
  const pcm = ffmpeg(['-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-']);
  const x = new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 4));
  const w = Math.round(SR * 0.05);
  let sum = 0, best = 0;
  for (let i = 0; i < x.length; i++) {
    sum += x[i] * x[i];
    if (i >= w) sum -= x[i - w] * x[i - w];
    if (i >= w - 1) best = Math.max(best, sum / w);
  }
  return { rms: Math.sqrt(best), sec: x.length / SR };
}

const lines = [
  "'use strict';",
  '// ============================================================',
  '//  効果音にする音（audio/a-o の a〜o。2.17.0 でユーザーの指定）',
  '//  tools/embed-se.js で作る（手で書きかえない）。file:// でも読めるように、モノラルの AAC を base64 で埋めこんである。',
  '//  { name: もとのファイル, sec: 長さ（秒）, norm: 音の大きさをそろえる倍率, data }',
  '//  どの場面でどの音を鳴らすか・音ごとの大きさは js/audio.js の SE_SAMPLE',
  '// ============================================================',
  '',
  'const SE_FILES = {',
];
let total = 0;
for (const l of LETTERS) {
  const file = ['wav', 'm4a'].map(e => path.join(srcDir, `${l}.${e}`)).find(f => fs.existsSync(f));
  if (!file) { console.error(`audio/a-o/${l}.wav（または .m4a）がありません`); process.exit(1); }
  const tmp = path.join(os.tmpdir(), `zashiki_se_${process.pid}_${l}.m4a`);
  ffmpeg(['-y', '-i', file, '-ac', '1', '-ar', String(SR), '-c:a', 'aac', '-b:a', '160k', '-map_metadata', '-1', '-fflags', '+bitexact', '-movflags', '+faststart', tmp]);
  const data = fs.readFileSync(tmp).toString('base64');
  fs.unlinkSync(tmp);
  const { rms, sec } = peakRms(file);
  const norm = REF / rms;
  total += data.length;
  lines.push(`  ${l}: { name: '${path.basename(file)}', sec: ${sec.toFixed(3)}, norm: ${norm.toFixed(3)}, data: '${data}' },`);
  console.log(`${l}: ${path.basename(file)}  ${sec.toFixed(2)}秒  norm ${norm.toFixed(3)}  ${(data.length / 1024).toFixed(0)} KB`);
}
lines.push('};', '');
fs.writeFileSync(out, lines.join('\n'));
console.log(`js/sefiles.js を書きました（${LETTERS.length} 個、${(total / 1024).toFixed(0)} KB）`);
