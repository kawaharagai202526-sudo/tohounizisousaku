'use strict';
// ============================================================
//  オンラインのアカウント・ランキング（Firebase）の設定
//  apiKey と projectId が空のままなら、今までどおりアカウントとスコアはこのブラウザの中だけに保存する。
//  入れ方は docs/ONLINE_SETUP.md を見ること。
//  apiKey は公開してよい値（守りは Firebase のルール firebase/firestore.rules で行う）。
// ============================================================

const ONLINE_CONFIG = {
  apiKey: '',      // Firebase の「ウェブ API キー」
  projectId: '',   // Firebase の「プロジェクト ID」
  // 管理者にするユーザー名（管理者ページのプレイヤー管理で、ほかの人の記録を消したりリセットしたりできる）。
  // 変えたら node tools/firestore-rules.js でルールを作り直し、Firebase に貼り直す
  admins: [],
};
