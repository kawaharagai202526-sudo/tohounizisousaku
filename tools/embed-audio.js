#!/usr/bin/env node
// もらった音声ファイル（MP3 など）を、曲として js/bgmfiles.js に埋めこむ
//   node tools/embed-audio.js 曲ID 音声ファイル [ループの終わりの秒] [ループの始まりの秒]
//   node tools/embed-audio.js --remove 曲ID
// file:// で開いても読めるように、音声は base64 の文字にして JS に入れる（fetch は file:// では使えないため）。
// 曲として鳴らすには、js/music.js の SONGS に { title, comment, audio: '曲ID' } を書く。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'js', 'bgmfiles.js');
const MIME = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.wav': 'audio/wav' };

function load() {
  if (!fs.existsSync(out)) return {};
  const ctx = {};
  vm.runInNewContext(fs.readFileSync(out, 'utf8') + '\nthis.BGM_FILES = BGM_FILES;', ctx);
  return ctx.BGM_FILES || {};
}

function save(files) {
  const lines = [
    "'use strict';",
    '// ============================================================',
    '//  音声ファイルの曲（MML ではなく、もらった音をそのまま鳴らす曲）',
    '//  tools/embed-audio.js で作る（手で書きかえない）。file:// でも読めるように、音声を base64 で埋めこんである。',
    '//  { mime, name: もとのファイル名, loopStart / loopEnd: ループする範囲（秒。loopEnd が 0 なら最後まで）, data }',
    '//  鳴らすときに、前後の無音を切り、つなぎ目を 0.03 秒重ねてループする（js/audio.js の makeLoopBuffer）',
    '// ============================================================',
    '',
    'const BGM_FILES = {',
  ];
  for (const [id, f] of Object.entries(files)) {
    lines.push(`  ${id}: {`);
    lines.push(`    mime: '${f.mime}', name: '${f.name.replace(/[\\']/g, '\\$&')}', loopStart: ${f.loopStart}, loopEnd: ${f.loopEnd},`);
    lines.push(`    data: '${f.data}',`);
    lines.push('  },');
  }
  lines.push('};', '');
  fs.writeFileSync(out, lines.join('\n'));
}

const args = process.argv.slice(2);
const files = load();
if (args[0] === '--remove') {
  delete files[args[1]];
  save(files);
  console.log(`${args[1]} を js/bgmfiles.js から消しました`);
} else {
  const [id, src, loopEnd = '0', loopStart = '0'] = args;
  if (!id || !src) {
    console.error('使い方: node tools/embed-audio.js 曲ID 音声ファイル [ループの終わりの秒] [ループの始まりの秒]');
    process.exit(1);
  }
  const mime = MIME[path.extname(src).toLowerCase()];
  if (!mime) { console.error(`この形式は使えません: ${src}（mp3 / ogg / m4a / wav）`); process.exit(1); }
  const data = fs.readFileSync(src).toString('base64');
  files[id] = { mime, name: path.basename(src), loopStart: +loopStart, loopEnd: +loopEnd, data };
  save(files);
  console.log(`${id}: ${path.basename(src)}（${(data.length / 1024 / 1024).toFixed(2)} MB）を js/bgmfiles.js に入れました`);
}
