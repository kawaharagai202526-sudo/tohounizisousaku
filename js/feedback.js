'use strict';
// ============================================================
//  フィードバック（開発者へのアドバイス・感想）の送り先：開発者の Google フォーム
//  タイトルの「フィードバック」を選ぶと、このフォームを新しいタブで開く（js/menus.js の FeedbackScene）。
//  届いた文は、フォームを作った Google アカウントで、フォームの編集画面の「回答」で読む。
//
//  これまで：2.12.0 はゲームの中の入力欄から claude.ai の共有ページのデータベースに送り、
//  2.12.1〜2.12.2 は入力欄に書いた文を、フォームに入れて（またはコピーして）開いていた。
//  2.12.3 でユーザーの指定「フィードバックの箱を削除するかわり、ホームを自動で開くようにする」により、入力欄をなくし、
//  すぐにフォームを開くようにした（「ホーム」はフォームのこと）
// ============================================================

// ユーザーが作った Google フォーム（2.12.2 でもらった共有リンク）。空にすると、タイトルの「フィードバック」は選べなくなる
const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfDBNbPbbizDXSobJ0g4-6htzpTe1XkT0u8hS-oSG8SIoxtrg/viewform?usp=publish-editor';

const Feedback = {
  formUrl: FEEDBACK_FORM_URL, // テストで入れかえられるように、ここから読む

  // 開くリンク（https のリンクだけ）。ないときは null
  get link() {
    const url = String(this.formUrl || '').trim();
    return /^https:\/\/[^\s]+$/.test(url) ? url : null;
  },
  get hasForm() { return !!this.link; },

  // フォームを新しいタブで開く。開けたら true（ブラウザがポップアップを止めたときなどは false）
  open() {
    const url = this.link;
    if (!url) return false;
    let w = null;
    try { w = window.open(url, '_blank'); } catch (e) { w = null; }
    if (!w) return false;
    try { w.opener = null; } catch (e) { /* 開いたページから、このページを触れないようにする（できなくても続ける） */ }
    return true;
  },
};

// 2.12.0〜2.12.2 の入力欄の書きかけ（もう使わない）
Store.remove('feedbackDraft');
