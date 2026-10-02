'use strict';
// ============================================================
//  アカウント（ユーザー名・パスワード・スコア）とランキング
//  Accounts が窓口。オンラインの設定（js/online-config.js）があれば OnlineAccounts（js/online.js、Firebase）、
//  なければ LocalAccounts（このブラウザの localStorage）にアカウントとスコアを保存する。
//  LocalAccounts はパスワードをそのまま保存せず、ソルトを付けて SHA-256 を繰り返したハッシュだけを保存する。
// ============================================================

const NAME_MAX = 12;
const PASS_MIN = 6;   // Firebase の決まりに合わせる
const PASS_MAX = 32;
const HASH_ROUNDS = 2000;
const HISTORY_MAX = 20; // 1人あたり残すプレイ記録の数

// ------------------------------------------------------------
//  SHA-256（同期で使えるように自前で計算する）
// ------------------------------------------------------------
const sha256 = (() => {
  const K = [], H0 = [];
  for (let n = 2; K.length < 64; n++) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break; }
    if (!prime) continue;
    if (H0.length < 8) H0.push((Math.sqrt(n) % 1) * 4294967296 | 0);
    K.push((Math.cbrt(n) % 1) * 4294967296 | 0);
  }
  const ror = (x, n) => (x >>> n) | (x << (32 - n));
  const w = new Int32Array(64);
  return text => {
    const src = new TextEncoder().encode(text);
    const len = Math.ceil((src.length + 9) / 64) * 64;
    const bytes = new Uint8Array(len);
    bytes.set(src);
    bytes[src.length] = 0x80;
    const bits = src.length * 8;
    for (let i = 0; i < 4; i++) bytes[len - 1 - i] = (bits >>> (i * 8)) & 255;
    const H = H0.slice();
    for (let off = 0; off < len; off += 64) {
      for (let i = 0; i < 16; i++) {
        const j = off + i * 4;
        w[i] = (bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3];
      }
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15], b = w[i - 2];
        const s0 = ror(a, 7) ^ ror(a, 18) ^ (a >>> 3);
        const s1 = ror(b, 17) ^ ror(b, 19) ^ (b >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  };
})();

function hashPassword(pw, salt) {
  let h = sha256(`${salt}:${pw}`);
  for (let i = 1; i < HASH_ROUNDS; i++) h = sha256(h + salt);
  return h;
}
function makeSalt() {
  const a = new Uint8Array(16);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
  else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

function formatDate(t, withTime = false) {
  if (!t) return '―';
  const d = new Date(t);
  const p = n => String(n).padStart(2, '0');
  const s = `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
  return withTime ? `${s} ${p(d.getHours())}:${p(d.getMinutes())}` : s;
}
// 「博麗 霊夢」→「霊夢」
function shortCharaName(id) { return CHARA_INFO[id] ? CHARA_INFO[id].name.split(' ').pop() : id; }

// ------------------------------------------------------------
//  このブラウザだけに保存するアカウント
//  accounts: { [キー]: { name, salt, hash, created, lastLogin, plays,
//              best: { [難易度]: 記録 }, history: [記録...], migrated } }
//  記録: { score, diff, char, charName, stage, clear, date }
//  migrated：オンラインのアカウントに記録を移したもの
// ------------------------------------------------------------
const LocalAccounts = {
  db: Store.get('accounts', {}),
  cur: Store.get('currentUser', null),

  init() {
    // 別のタブで変更されたら読み直す
    window.addEventListener('storage', e => {
      if (e.key === Store.prefix + 'accounts') this.db = Store.get('accounts', {});
      if (e.key === Store.prefix + 'currentUser') this.cur = Store.get('currentUser', null);
    });
  },
  commit() { Store.set('accounts', this.db); },

  // 大文字・小文字や全角・半角の違いは同じ名前として扱う
  keyOf(name) { return name.normalize('NFKC').toLowerCase(); },
  get(key) { return Object.prototype.hasOwnProperty.call(this.db, key) ? this.db[key] : null; },
  all() { return Object.entries(this.db).map(([key, a]) => ({ key, ...a })); },
  currentKey() { return this.cur && this.get(this.cur) ? this.cur : null; },
  current() { const k = this.currentKey(); return k ? this.get(k) : null; },
  setCurrent(key) { this.cur = key; Store.set('currentUser', key); },

  checkName(raw) {
    const name = raw.normalize('NFC').trim();
    if (!name) return { error: 'ユーザー名を入力してください' };
    if ([...name].length > NAME_MAX) return { error: `ユーザー名は${NAME_MAX}文字までです` };
    if (/[\u0000-\u001f\u007f]/.test(name)) return { error: 'ユーザー名に使えない文字が入っています' };
    return { name };
  },
  checkPassword(pw) {
    if (pw.length < PASS_MIN) return `パスワードは${PASS_MIN}文字以上にしてください`;
    if (pw.length > PASS_MAX) return `パスワードは${PASS_MAX}文字までです`;
    return null;
  },

  register(rawName, pw) {
    const { name, error } = this.checkName(rawName);
    if (error) return { error };
    const key = this.keyOf(name);
    if (this.get(key)) return { error: 'そのユーザー名はもう使われています' };
    const pwError = this.checkPassword(pw);
    if (pwError) return { error: pwError };
    const salt = makeSalt();
    const now = Date.now();
    this.db[key] = { name, salt, hash: hashPassword(pw, salt), created: now, lastLogin: now, plays: 0, best: {}, history: [] };
    this.commit();
    this.setCurrent(key);
    return { ok: true, name };
  },

  login(rawName, pw) {
    const { name, error } = this.checkName(rawName);
    if (error) return { error };
    if (!pw) return { error: 'パスワードを入力してください' };
    const key = this.keyOf(name);
    const acc = this.get(key);
    if (!acc || hashPassword(pw, acc.salt) !== acc.hash) return { error: 'ユーザー名かパスワードがちがいます' };
    acc.lastLogin = Date.now();
    this.commit();
    this.setCurrent(key);
    return { ok: true, name: acc.name };
  },

  logout() { this.setCurrent(null); },
  // 記録を書きかえたあとに呼ぶ
  saved() { this.commit(); },

  // ---------- 管理者ページから使う ----------
  remove(key) {
    delete this.db[key];
    this.commit();
    if (this.cur === key) this.logout();
  },
  removeAll() {
    this.db = {};
    this.commit();
    this.logout();
  },
  resetScores(key) {
    const acc = this.get(key);
    if (!acc) return;
    acc.best = {};
    acc.history = [];
    acc.plays = 0;
    this.commit();
  },
  setPassword(key, pw) {
    const acc = this.get(key);
    if (!acc) return 'プレイヤーが見つかりません';
    const err = this.checkPassword(pw);
    if (err) return err;
    acc.salt = makeSalt();
    acc.hash = hashPassword(pw, acc.salt);
    this.commit();
    return null;
  },
};

// 難易度ごとのランキング（1人1件、そのプレイヤーのベスト）
function rankingOf(list, diff) {
  return list
    .filter(a => a.best && a.best[diff])
    .map(a => ({ key: a.key, name: a.name, ...a.best[diff] }))
    .sort((x, y) => y.score - x.score || x.date - y.date);
}

// ------------------------------------------------------------
//  アカウントの窓口（画面やゲームからはこれを使う）
//  ログイン・登録・管理者の操作は通信することがあるので Promise を返す
// ------------------------------------------------------------
const Accounts = {
  backend: LocalAccounts,
  get online() { return this.backend === OnlineAccounts; },

  init() {
    LocalAccounts.init();
    const cfg = onlineConfig();
    if (cfg) {
      this.backend = OnlineAccounts;
      OnlineAccounts.init(cfg);
    }
  },

  keyOf(name) { return LocalAccounts.keyOf(name); },
  checkName(raw) { return LocalAccounts.checkName(raw); },
  checkPassword(pw) { return LocalAccounts.checkPassword(pw); },

  currentKey() { return this.backend.currentKey(); },
  current() { return this.backend.current(); },
  get(key) { return this.backend.get(key); },
  all() { return this.backend.all(); },
  ranking(diff) { return rankingOf(this.all(), diff); },
  rankOf(key, diff) {
    const i = this.ranking(diff).findIndex(r => r.key === key);
    return i < 0 ? null : i + 1;
  },
  // 画面に出す、保存先と通信のようす
  statusText() { return this.online ? OnlineAccounts.statusText() : 'このブラウザに保存'; },
  // 最新の記録を読み直す（オンラインのときだけ通信する）
  refresh() { return this.online ? OnlineAccounts.refresh() : Promise.resolve(); },

  async register(rawName, pw) {
    const { name, error } = this.checkName(rawName);
    if (error) return { error };
    const pwError = this.checkPassword(pw);
    if (pwError) return { error: pwError };
    return this.backend.register(name, pw);
  },
  async login(rawName, pw) {
    const { name, error } = this.checkName(rawName);
    if (error) return { error };
    if (!pw) return { error: 'パスワードを入力してください' };
    return this.backend.login(name, pw);
  },
  logout() { this.backend.logout(); },

  // ゲーム終了時に呼ぶ。ランキングに載せられるプレイかどうかは呼ぶ側（GameScene.rankBlock）で確かめる
  record(g, kind) {
    if (this.online && g.accountKey !== this.currentKey()) return { saved: false, reason: 'ログインし直したため' };
    const acc = this.get(g.accountKey);
    if (!acc) return { saved: false, reason: 'アカウントが見つからないため' };
    if (g.score <= 0) return { saved: false, reason: 'スコアが0のため' };
    // charName も残しておく（あとで自機のIDや名前が変わっても、ランキングに当時の名前が出るように）
    const entry = { score: Math.floor(g.score), diff: DIFF, char: g.charId, charName: shortCharaName(g.charId), stage: g.stageIndex + 1, clear: kind === 'clear', date: Date.now() };
    acc.plays = (acc.plays || 0) + 1;
    acc.history = [entry, ...(acc.history || [])].slice(0, HISTORY_MAX);
    acc.best = acc.best || {};
    const prev = acc.best[DIFF];
    const best = !prev || entry.score > prev.score;
    if (best) acc.best[DIFF] = entry;
    this.backend.saved(g.accountKey);
    return { saved: true, best, diff: DIFF, rank: this.rankOf(g.accountKey, DIFF), total: this.ranking(DIFF).length, online: this.online };
  },

  // ---------- 管理者ページから使う（うまくいかなければ理由の文章を返す） ----------
  get canSetOthersPassword() { return !this.online; },
  async remove(key) { return (await this.backend.remove(key)) || null; },
  async removeAll() { return (await this.backend.removeAll()) || null; },
  async resetScores(key) { return (await this.backend.resetScores(key)) || null; },
  async setPassword(key, pw) {
    const err = this.checkPassword(pw);
    if (err) return err;
    return (await this.backend.setPassword(key, pw)) || null;
  },
};
Accounts.init();

// ------------------------------------------------------------
//  アカウント画面（ログイン・新規登録・ログアウト）
//  文字を入力するので、キャンバスではなくHTMLで画面の上に重ねる
// ------------------------------------------------------------
const AccountDialog = {
  root: null,
  tab: 'login',
  onClose: null,

  init() {
    const root = domEl('div');
    root.id = 'accountOverlay';
    root.hidden = true;
    root.addEventListener('click', e => { if (e.target === root) this.close(); });
    document.body.appendChild(root);
    this.root = root;
    window.addEventListener('keydown', e => {
      if (root.hidden || e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation(); // 閉じたEscでゲーム側が反応しないように
      this.close();
    });
  },

  get isOpen() { return !this.root.hidden; },

  open(onClose) {
    this.onClose = onClose || null;
    Input.suspended = true;
    Input.keys = {};
    this.root.hidden = false;
    this.render();
  },
  close() {
    if (this.root.hidden) return;
    this.root.hidden = true;
    this.root.textContent = '';
    Input.suspended = false;
    Input.keys = {};
    if (Game.canvas) Game.canvas.focus();
    const f = this.onClose;
    this.onClose = null;
    if (f) f();
  },

  panel() {
    this.root.textContent = '';
    const p = domEl('div', 'admin-panel acct-panel');
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-modal', 'true');
    p.setAttribute('aria-labelledby', 'acctTitle');
    const x = domButton('admin-close', '×', () => this.close());
    x.setAttribute('aria-label', '閉じる');
    const h = domEl('h2', 'acct-title', 'アカウント');
    h.id = 'acctTitle';
    p.append(x, h);
    this.root.appendChild(p);
    return p;
  },

  render(welcome, warning) {
    if (Accounts.current()) this.renderUser(welcome, warning);
    else this.renderForm();
  },

  renderForm() {
    const p = this.panel();
    const reg = this.tab === 'register';
    const tabs = domEl('div', 'acct-tabs');
    tabs.setAttribute('role', 'tablist');
    for (const [id, label] of [['login', 'ログイン'], ['register', '新規登録']]) {
      const t = domButton('acct-tab', label, () => { if (this.tab !== id) { this.tab = id; this.renderForm(); } });
      t.setAttribute('role', 'tab');
      t.setAttribute('aria-selected', String(this.tab === id));
      tabs.append(t);
    }
    const form = domEl('form', 'acct-form');
    form.noValidate = true;
    const field = (label, type, auto, max) => {
      const wrap = domEl('label', 'acct-field');
      const input = domEl('input', 'acct-input');
      input.type = type;
      input.autocomplete = auto;
      input.maxLength = max;
      input.spellcheck = false;
      input.autocapitalize = 'off';
      wrap.append(domEl('span', '', label), input);
      form.append(wrap);
      return input;
    };
    const name = field(`ユーザー名（${NAME_MAX}文字まで）`, 'text', 'username', NAME_MAX * 2);
    const pass = field(reg ? `パスワード（${PASS_MIN}文字以上）` : 'パスワード', 'password', reg ? 'new-password' : 'current-password', PASS_MAX);
    const pass2 = reg ? field('パスワード（確認）', 'password', 'new-password', PASS_MAX) : null;
    const msg = domEl('p', 'admin-msg acct-msg');
    msg.setAttribute('aria-live', 'polite');
    const submit = domEl('button', 'admin-btn acct-submit', reg ? '登録してログイン' : 'ログイン');
    submit.type = 'submit';
    form.append(msg, submit);
    let busy = false;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (busy) return;
      if (reg && pass.value !== pass2.value) return this.fail(msg, form, 'パスワード（確認）が一致しません');
      // オンラインのときは通信するので、終わるまで入力できないようにする
      busy = true;
      for (const el of form.elements) el.disabled = true;
      msg.className = 'admin-msg acct-msg';
      msg.textContent = Accounts.online ? '通信中…' : '';
      const r = reg ? await Accounts.register(name.value, pass.value) : await Accounts.login(name.value, pass.value);
      busy = false;
      if (this.root.hidden) return;
      for (const el of form.elements) el.disabled = false;
      if (r.error) return this.fail(msg, form, r.error);
      Sound.se('ok');
      let text = reg ? `登録しました。ようこそ、${r.name} さん` : `おかえりなさい、${r.name} さん`;
      if (r.imported) text += '（このブラウザの記録もオンラインに移しました）';
      this.render(text, r.warning);
    });
    p.append(tabs, form, domEl('p', 'acct-note', Accounts.online
      ? 'アカウントとスコアはインターネット上（Firebase）に保存されます。どのブラウザ・端末からでも、同じユーザー名とパスワードでログインできます。ほかのサイトで使っているパスワードは使わないでください。'
      : 'アカウントとスコアはこのブラウザの中に保存されます。ほかのサイトで使っているパスワードは使わないでください。'));
    if (Accounts.online) p.append(domEl('p', 'acct-note', `通信：${Accounts.statusText()}`));
    setTimeout(() => name.focus(), 0);
  },

  fail(msg, form, text) {
    msg.className = 'admin-msg acct-msg is-error';
    msg.textContent = text;
    form.classList.remove('shake');
    void form.offsetWidth;
    form.classList.add('shake');
    Sound.se('cancel');
  },

  renderUser(welcome, warning, fresh = true) {
    const p = this.panel();
    const key = Accounts.currentKey();
    const acc = Accounts.get(key);
    if (welcome) p.append(domEl('p', 'acct-welcome', welcome));
    if (warning) p.append(domEl('p', 'admin-msg acct-msg is-error', warning));
    // オンラインのときは開いたときに最新の記録を読み直し、表示を作り直す
    if (Accounts.online && fresh) {
      Accounts.refresh().then(() => {
        if (!this.root.hidden && p.isConnected && Accounts.current()) this.renderUser(welcome, warning, false);
      });
    }
    const who = domEl('p', 'acct-who');
    who.append(domEl('span', '', 'ログイン中のプレイヤー'), domEl('strong', 'acct-name', acc.name));
    p.append(who);
    const t = domEl('table', 'admin-table acct-table');
    const head = domEl('tr');
    for (const h of ['難易度', 'ベストスコア', '順位']) head.append(domEl('th', '', h));
    t.append(head);
    DIFF_NAMES.forEach((d, i) => {
      const b = acc.best && acc.best[i];
      const rank = b ? Accounts.rankOf(key, i) : null;
      const tr = domEl('tr');
      tr.append(domEl('td', '', d), domEl('td', 'num', b ? padScore(b.score) : '―'), domEl('td', 'num', rank ? `${rank}位` : '―'));
      t.append(tr);
    });
    p.append(t, domEl('p', 'acct-note', `プレイ回数：${acc.plays || 0}回　登録日：${formatDate(acc.created)}`));
    p.append(domEl('p', 'acct-note', 'コンティニューしたプレイとプラクティスは記録されません。'));
    p.append(domEl('p', 'acct-note', Accounts.online ? `保存先：インターネット上（Firebase）　通信：${Accounts.statusText()}` : '保存先：このブラウザ'));
    const row = domEl('div', 'acct-row');
    row.append(
      domButton('admin-btn acct-submit', 'ログアウト', () => { Accounts.logout(); Sound.se('cancel'); this.tab = 'login'; this.renderForm(); }),
      domButton('admin-btn acct-submit', '閉じる', () => this.close()),
    );
    p.append(row);
    setTimeout(() => row.lastChild.focus(), 0);
  },
};
AccountDialog.init();

// ------------------------------------------------------------
//  ランキング画面
// ------------------------------------------------------------
const RANK_ROWS = 10;

class RankingScene {
  constructor() {
    this.diff = Store.get('lastDiff', 1);
    this.scroll = 0;
    this.frame = 0;
    this.list = Accounts.ranking(this.diff);
  }
  enter() { Accounts.refresh(); }
  tabRect(i) { return { x: 80 + i * 122, y: 88, w: 114, h: 30 }; }
  update() {
    this.frame++;
    menuBG().update();
    const before = this.diff;
    this.diff = menuMove(this.diff, 4, 'left', 'right');
    for (let i = 0; i < 4; i++) {
      const r = this.tabRect(i);
      if (Input.tapIn(r.x, r.y, r.w, r.h) && this.diff !== i) { this.diff = i; Sound.se('cursor'); }
    }
    if (Accounts.online && this.frame % Math.round(ONLINE_REFRESH_MS / (1000 / 60)) === 0) Accounts.refresh();
    if (this.diff !== before || this.frame % 30 === 0) {
      if (this.diff !== before) this.scroll = 0;
      this.list = Accounts.ranking(this.diff);
    }
    const maxScroll = Math.max(0, this.list.length - RANK_ROWS);
    if (Input.repeat('up') || Input.tapIn(596, 156, 36, 60)) this.scroll = Math.max(0, this.scroll - 1);
    if (Input.repeat('down') || Input.tapIn(596, 340, 36, 60)) this.scroll = Math.min(maxScroll, this.scroll + 1);
    if ((backPressed() || Input.pressed('shot')) && this.frame > 10) {
      Sound.se('cancel');
      Game.setScene(new TitleScene('ranking'));
    }
  }
  draw(ctx) {
    menuBG().draw(ctx);
    ctx.fillStyle = 'rgba(6,4,20,0.7)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    drawHeading(ctx, Accounts.online ? 'オンラインランキング' : 'ランキング', 'Ranking');
    // 保存先と通信のようす
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = `11px ${FONT_JP}`;
    ctx.fillStyle = Accounts.online && OnlineAccounts.state !== 'online' && OnlineAccounts.state !== 'connecting' ? '#ff9aa8' : 'rgba(220,210,255,0.8)';
    const sync = Accounts.online && OnlineAccounts.lastSync ? `　最終更新 ${new Date(OnlineAccounts.lastSync).toLocaleTimeString('ja-JP')}` : '';
    ctx.fillText(Accounts.online ? `${Accounts.statusText()}${sync}` : 'このブラウザのランキング', SCREEN_W - 14, 18, 360);
    ctx.textBaseline = 'middle';
    // 難易度のタブ
    for (let i = 0; i < 4; i++) {
      const r = this.tabRect(i), on = i === this.diff;
      ctx.fillStyle = on ? 'rgba(60,40,120,0.85)' : 'rgba(20,14,50,0.6)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = on ? DIFF_COLORS[i] : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = on ? 2 : 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.textAlign = 'center';
      ctx.font = `italic 700 ${on ? 20 : 17}px ${FONT_EN}`;
      strokeText(ctx, DIFF_NAMES[i], r.x + r.w / 2, r.y + r.h / 2, on ? DIFF_COLORS[i] : '#8a84a8', 'rgba(0,0,0,0.8)', 3);
    }
    // 表
    const cols = { rank: 98, name: 112, score: 390, chara: 408, stage: 470, date: 588 };
    const y0 = 140, rowH = 24;
    ctx.font = `600 12px ${FONT_JP}`;
    ctx.fillStyle = '#d8c89a';
    ctx.textAlign = 'right'; ctx.fillText('順位', cols.rank, y0); ctx.fillText('スコア', cols.score, y0); ctx.fillText('日付', cols.date, y0);
    ctx.textAlign = 'left'; ctx.fillText('プレイヤー', cols.name, y0); ctx.fillText('キャラ', cols.chara, y0); ctx.fillText('到達', cols.stage, y0);
    ctx.fillStyle = 'rgba(214,186,120,0.5)';
    ctx.fillRect(48, y0 + 11, 548, 1);
    const me = Accounts.currentKey();
    const list = this.list;
    if (!list.length) {
      ctx.textAlign = 'center';
      ctx.font = `14px ${FONT_JP}`;
      ctx.fillStyle = '#a8a0cc';
      ctx.fillText('まだ記録がありません', SCREEN_W / 2, y0 + 110);
    }
    for (let i = 0; i < RANK_ROWS && this.scroll + i < list.length; i++) {
      const n = this.scroll + i, r = list[n];
      const y = y0 + 26 + i * rowH;
      if (r.key === me) {
        ctx.fillStyle = 'rgba(214,186,120,0.18)';
        ctx.fillRect(48, y - rowH / 2, 548, rowH);
      } else if (n % 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(48, y - rowH / 2, 548, rowH);
      }
      const medal = ['#ffd860', '#d8dcec', '#e0a070'][n];
      ctx.textAlign = 'right';
      ctx.font = `700 15px ${FONT_JP}`;
      ctx.fillStyle = medal || '#ece6ff';
      ctx.fillText(`${n + 1}位`, cols.rank, y);
      ctx.textAlign = 'left';
      ctx.font = `${r.key === me ? 700 : 500} 14px ${FONT_JP}`;
      ctx.fillStyle = r.key === me ? '#fff3c8' : '#ece6ff';
      ctx.save();
      ctx.beginPath(); ctx.rect(cols.name, y - rowH / 2, 180, rowH); ctx.clip();
      ctx.fillText(r.name, cols.name, y);
      ctx.restore();
      ctx.textAlign = 'right';
      ctx.font = `700 16px ${FONT_EN}`;
      ctx.fillStyle = '#ffffff';
      drawDigits(ctx, padScore(r.score), cols.score, y, 10, 'right');
      ctx.textAlign = 'left';
      ctx.font = `13px ${FONT_JP}`;
      ctx.fillStyle = PLAYER_TYPES[r.char] ? PLAYER_TYPES[r.char].color : '#c8c0e8';
      ctx.fillText(r.charName || shortCharaName(r.char), cols.chara, y);
      ctx.font = `italic 600 14px ${FONT_EN}`;
      ctx.fillStyle = r.clear ? '#ffe070' : '#c8c0e8';
      ctx.fillText(r.clear ? 'All Clear' : `Stage ${r.stage}`, cols.stage, y);
      ctx.textAlign = 'right';
      ctx.font = `12px ${FONT_JP}`;
      ctx.fillStyle = '#a8a0cc';
      ctx.fillText(formatDate(r.date), cols.date, y);
    }
    // スクロールの印
    if (list.length > RANK_ROWS) {
      ctx.fillStyle = '#d6ba78';
      ctx.textAlign = 'center';
      ctx.font = `14px ${FONT_JP}`;
      if (this.scroll > 0) ctx.fillText('▲', 614, 186);
      if (this.scroll < list.length - RANK_ROWS) ctx.fillText('▼', 614, 370);
    }
    // 自分の順位
    ctx.textAlign = 'center';
    ctx.font = `600 14px ${FONT_JP}`;
    const acc = Accounts.current();
    let mine;
    if (!acc) mine = Accounts.online ? 'ログインするとランキングに参加できます（タイトルの「アカウント」から）' : 'ログインしていません（タイトルの「アカウント」からログインできます）';
    else {
      const rank = Accounts.rankOf(me, this.diff);
      mine = rank ? `${acc.name} さんの順位：${rank}位 / ${list.length}人` : `${acc.name} さんは ${DIFF_NAMES[this.diff]} の記録がまだありません`;
    }
    strokeText(ctx, mine, SCREEN_W / 2, 412, '#fff3c8', 'rgba(0,0,0,0.8)', 3);
    ctx.font = `11px ${FONT_JP}`;
    ctx.fillStyle = 'rgba(220,210,255,0.75)';
    ctx.fillText('ログインして、コンティニューせずにプレイした記録が載ります（プラクティスは対象外）', SCREEN_W / 2, 438);
    ctx.font = `12px ${FONT_JP}`;
    ctx.fillStyle = 'rgba(220,210,255,0.8)';
    ctx.fillText(Input.isTouch ? '難易度をタップで切り替え　▲▼でスクロール' : '←→：難易度　↑↓：スクロール　X：戻る', SCREEN_W / 2, 462);
    drawBackButton(ctx);
  }
}
