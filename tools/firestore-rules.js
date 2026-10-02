'use strict';
// Firebase（Cloud Firestore）に貼るルールを作る → firebase/firestore.rules
// 使い方: node tools/firestore-rules.js
//   js/online-config.js の admins（管理者のユーザー名）から、管理者のログイン用アドレスを計算して書きこむ。
//   できたファイルの中身を、Firebase の画面の「Firestore Database → ルール」に貼って「公開」する。
//
// ルールの考え方
//   ・players/<ユーザーID> がプレイヤー1人の記録。だれでも読める（ランキングを見るため）
//   ・書けるのは本人（ログインしている人のIDと同じ文書）と、管理者だけ
//   ・本人が書くときは、項目と形を確かめる（js/online.js の recordBody と同じ形）
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const EMAIL_DOMAIN = 'hoshifuru.example.com'; // js/online.js の ONLINE_EMAIL_DOMAIN と同じ

// js/online.js の onlineEmail と同じ作り方
function emailOf(name) {
  const key = name.normalize('NFKC').toLowerCase();
  return `p${crypto.createHash('sha256').update(key, 'utf8').digest('hex').slice(0, 40)}@${EMAIL_DOMAIN}`;
}

function loadConfig() {
  const src = fs.readFileSync(path.join(root, 'js', 'online-config.js'), 'utf8');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(`${src}\nthis.ONLINE_CONFIG = ONLINE_CONFIG;`, ctx);
  return ctx.ONLINE_CONFIG;
}

function makeRules(admins) {
  const list = admins.map(n => `'${emailOf(n)}'`).join(', ');
  const names = admins.length ? admins.join('、') : '（なし）';
  return `rules_version = '2';
// 東方星降夜のオンラインのアカウント・ランキング用のルール
// tools/firestore-rules.js で作ったもの。管理者：${names}
service cloud.firestore {
  match /databases/{database}/documents {
    // 管理者（js/online-config.js の admins のユーザー名から作ったログイン用アドレス）
    function isAdmin() {
      return request.auth != null && request.auth.token.email in [${list}];
    }
    // プレイヤーの記録の形（js/online.js の recordBody と同じ）
    function validPlayer() {
      let d = request.resource.data;
      return d.keys().hasOnly(['name', 'nameKey', 'created', 'lastLogin', 'plays', 'best', 'history', 'v'])
        && d.name is string && d.name.size() > 0 && d.name.size() <= 24
        && d.nameKey is string && d.nameKey.size() <= 48
        && d.plays is int && d.plays >= 0
        && d.best is map && d.best.size() <= 8
        && d.history is list && d.history.size() <= 20;
    }
    match /players/{uid} {
      allow read: if true;
      allow create, update: if request.auth != null
        && ((request.auth.uid == uid && validPlayer()) || isAdmin());
      allow delete: if request.auth != null && (request.auth.uid == uid || isAdmin());
    }
  }
}
`;
}

if (require.main === module) {
  const cfg = loadConfig();
  const out = path.join(root, 'firebase', 'firestore.rules');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, makeRules(cfg.admins || []));
  console.log(`${path.relative(root, out)} を作りました（管理者：${(cfg.admins || []).join('、') || 'なし'}）`);
  console.log('中身を Firebase の「Firestore Database → ルール」に貼って「公開」してください。');
}

module.exports = { emailOf, makeRules };
