'use strict';
// index.html と js/*.js、img/*.png を1つのHTMLファイル（dist/hoshifuru.html）にまとめる
// 使い方: node tools/build-single.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const code = fs.readFileSync(path.join(root, src), 'utf8');
  if (code.includes('</script')) throw new Error(`${src} に </script が含まれているため埋め込めません`);
  return `<script>\n${code}\n</script>`;
});
// 'img/xxx.png' という文字列を data URI に置き換えて画像も埋め込む
html = html.replace(/(['"])img\/([\w.-]+\.png)\1/g, (m, q, file) => {
  const data = fs.readFileSync(path.join(root, 'img', file)).toString('base64');
  return `${q}data:image/png;base64,${data}${q}`;
});
const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'hoshifuru.html');
fs.writeFileSync(out, html);
console.log(`${path.relative(root, out)} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
