'use strict';
// ============================================================
//  フィードバック（開発者へのアドバイス・感想）の送り先（2.12.0）
//  タイトルの「フィードバック」の画面（js/menus.js の FeedbackScene）から送り、管理者ページの「フィードバック」で読む。
//
//  claude.ai の共有ページで開いているときは、そのページのデータベース（db）に入れる：
//    feedback/<見ている人のID> の文書の entries に足していく（1人1文書。新しいものから FEEDBACK_KEEP 件まで）。
//    共有ページを公開するときに、capabilities で db の rules と user を宣言する（CLAUDE.md の「フィードバック」）：
//      { path: 'feedback', read: 'admin', write: 'admin' }（持ち主と編集者は全部を読めて、消せる）
//      { path: 'feedback/{self}', read: 'view', write: 'interact' }（本人は自分の文書だけを読み書きできる。ほかの人のものは見えない）
//    送れるのは、共有ページに書きこめる人だけ（持ち主・編集者として招待した人・Team などで同じ組織の人）。
//    公開リンクで見ている人は送れない（claude.ai のしくみ）。
//  それ以外（ダウンロードした1ファイル版を開いたときなど）は送り先がないので送れない。書いた文はこのブラウザに残し、コピーできるようにする。
//
//  Google フォーム（2.12.1 でユーザーの指定「GOOGLEホームを作る」。2.12.2 でユーザーが作ったフォームのリンクを入れた）：
//  FEEDBACK_FORM_URL にフォームのリンクがあると、「送信」でそのフォームを開く（送るのはフォームの「送信」。だれでも送れる）。
//    「事前入力したURL」（答えの欄 entry.数字 がある）なら、書いた文を欄に入れた状態で開く。
//    ふつうの共有リンク（欄の番号がない）なら、書いた文をコピーしてから開き、欄に貼りつけてもらう。
//  このときは共有ページのデータベースには送らない（届く場所を1つにする）。届いた文は、フォームの編集画面の「回答」で読む。
// ============================================================

const FEEDBACK_MAX_CHARS = 1000; // 1回に送れる文字数
const FEEDBACK_KEEP = 50;        // 1人の文書に残す件数（1000文字×50件でも、1文書の上限 256 KiB に収まる）
const FEEDBACK_TIMEOUT_MS = 20000; // 送り先が答えないときに、あきらめるまでの時間

// Google フォームのリンク。いちばんよいのは「事前入力したURL」：段落の質問を1つだけ作り、右上の︙ →「事前入力したURLを取得」→
// 欄に何か書いて「リンクを取得」→「リンクをコピー」したものを、そのまま入れる（欄に書いた文は、遊んだ人の文に入れかわる）。
// ふつうの共有リンク（…/viewform?usp=publish-editor など）でも動く（そのときは文をコピーして貼りつけてもらう）。
// 空にすると、claude.ai の共有ページのデータベースに送る
// 2.12.2：ユーザーが作ったフォーム（「作った」。もらったのは共有リンクなので、欄の番号はない）
const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfDBNbPbbizDXSobJ0g4-6htzpTe1XkT0u8hS-oSG8SIoxtrg/viewform?usp=publish-editor';
const FEEDBACK_FORM_MAX_URL = 7000; // フォームを開くリンクの長さの上限（長すぎると開けないので、文は入るところまで入れる）

// 時間のかかる呼び出しを、ms で打ち切る（打ち切ったら code 'timeout' で断る）
function withTimeout(promise, ms) {
  let timer;
  const limit = new Promise((_, reject) => { timer = setTimeout(() => reject({ code: 'timeout' }), ms); });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

const Feedback = {
  db: null,
  uid: null,
  canWrite: null,  // 共有ページに書きこめるか（true / false / null＝わからない）
  host: false,     // claude.ai の共有ページの中で開いているか
  ready: false,    // 送り先を確かめ終わったか
  whenReady: Promise.resolve(), // 確かめ終わると解決する
  formUrl: FEEDBACK_FORM_URL,   // Google フォームのリンク（テストで入れかえられるように、ここから読む）

  // 起動したときに一度だけ。claude.use は、すぐには答えない（最大 10 秒）ので、待たずに先へ進む
  init() {
    const c = window.claude;
    if (!c || typeof c.use !== 'function') { this.ready = true; return; }
    this.host = true;
    this.whenReady = (async () => {
      try {
        const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
        if (db && user) {
          const uid = await user.id();
          if (uid) {
            this.db = db;
            this.uid = uid;
            this.canWrite = typeof user.can === 'function' ? await user.can('data.write') : null;
          }
        }
      } catch (e) { this.db = null; }
      this.ready = true;
    })();
  },

  // いま送れるか：'yes' / 'unknown'（確かめている途中）/ 'nohost'（共有ページの外）/ 'denied'（共有ページだが書きこめない）
  get state() {
    if (!this.ready) return 'unknown';
    if (!this.host) return 'nohost';
    return this.db && this.uid && this.canWrite !== false ? 'yes' : 'denied';
  },

  // 送る。{ ok: true } か { ok: false, reason: 'empty' | 'nohost' | 'denied' | 'full' | 'error' }
  async send(text) {
    text = String(text || '').trim().slice(0, FEEDBACK_MAX_CHARS);
    if (!text) return { ok: false, reason: 'empty' };
    await this.whenReady; // 送り先を確かめている途中なら、終わるのを待つ
    const st = this.state;
    if (st === 'nohost' || st === 'denied') return { ok: false, reason: st };
    if (st !== 'yes') return { ok: false, reason: 'error' };
    const ref = this.db.doc('feedback/' + this.uid);
    try {
      await withTimeout((async () => {
        const snap = await ref.get();
        const body = snap.exists ? snap.data() : null;
        const old = body && Array.isArray(body.entries) ? body.entries : [];
        const now = new Date().toISOString();
        const entries = [...old, { text, at: now, version: GAME_VERSION }].slice(-FEEDBACK_KEEP);
        await ref.set({ entries, updatedAt: now });
      })(), FEEDBACK_TIMEOUT_MS);
      return { ok: true };
    } catch (e) {
      const code = e && e.code;
      // 書きこめない人の書きこみは invalid_argument で断られる（claude.ai のしくみ）
      if (code === 'invalid_argument') { this.canWrite = false; return { ok: false, reason: 'denied' }; }
      return { ok: false, reason: code === 'quota_exceeded' ? 'full' : 'error' };
    }
  },

  // 届いたフィードバック（読めるものだけ。新しい順）。共有ページの外では null。
  // 送った人は名前を出さず、番号（1, 2, …）で分ける
  async list() {
    await this.whenReady;
    if (!this.db) return null;
    const snap = await withTimeout(this.db.collection('feedback').get(), FEEDBACK_TIMEOUT_MS);
    const out = [];
    snap.docs.forEach((d, i) => {
      const body = d.data() || {};
      for (const e of Array.isArray(body.entries) ? body.entries : []) {
        out.push({ text: String((e && e.text) || ''), at: String((e && e.at) || ''), version: String((e && e.version) || ''), from: i + 1 });
      }
    });
    return out.sort((a, b) => (b.at > a.at ? 1 : b.at < a.at ? -1 : 0));
  },

  // Google フォームのリンクを読む：{ page（フォームのページ）, entry（答えの欄 'entry.数字'。ないときは null） }。
  // リンクがないか、Google フォームのリンクでないときは null
  formInfo() {
    const url = String(this.formUrl || '').trim();
    if (/^https:\/\/forms\.gle\/[\w-]+$/.test(url)) return { page: url, entry: null }; // 短いリンク
    const m = url.match(/^(https:\/\/docs\.google\.com\/forms\/(?:u\/\d+\/)?d\/(?:e\/)?[\w-]+\/viewform)(?:\?(.*))?$/);
    if (!m) return null;
    const entry = (m[2] || '').split('&').map(p => p.split('=')[0]).find(k => /^entry\.\d+$/.test(k));
    return { page: m[1], entry: entry || null };
  },
  get hasForm() { return !!this.formInfo(); },
  get formPrefill() { const f = this.formInfo(); return !!(f && f.entry); }, // 書いた文を欄に入れた状態で開けるか

  // 開く Google フォームのリンク：{ url, prefilled（文を欄に入れたか）, cut（長すぎて途中までしか入らなかった） }。フォームがないときは null
  formLink(text) {
    const f = this.formInfo();
    if (!f) return null;
    if (!f.entry) return { url: f.page, prefilled: false, cut: false };
    const base = `${f.page}?usp=pp_url&${f.entry}=`;
    // 1文字ずつに分ける（絵文字を途中で切らないように）。対になっていないサロゲートは encodeURIComponent が受けつけないので置きかえる
    const chars = [...String(text || '').trim()].map(c => (c.length === 1 && c >= '\uD800' && c <= '\uDFFF' ? '\uFFFD' : c)).slice(0, FEEDBACK_MAX_CHARS);
    const enc = n => encodeURIComponent(chars.slice(0, n).join(''));
    let n = chars.length;
    if (base.length + enc(n).length > FEEDBACK_FORM_MAX_URL) {
      let lo = 0, hi = n;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (base.length + enc(mid).length <= FEEDBACK_FORM_MAX_URL) lo = mid; else hi = mid - 1;
      }
      n = lo;
    }
    return { url: base + enc(n), prefilled: true, cut: n < chars.length };
  },

  // 書きかけの文（このブラウザにだけ残す）
  get draft() { return Store.get('feedbackDraft', ''); },
  set draft(v) { Store.set('feedbackDraft', v); },
};
Feedback.init();
