'use strict';
// ============================================================
//  オンラインのアカウント・ランキング（Firebase）
//  ライブラリは使わず、Firebase のウェブ API を fetch で直接呼ぶ（1ファイル版を直接開いても動く）。
//   ・ログイン：Firebase Authentication（メール／パスワード）。ユーザー名から作ったアドレスを使う
//     （本物のメールアドレスではない。パスワードは Firebase が守り、ゲームのデータには入らない）
//   ・記録：Cloud Firestore の players/<ユーザーID>。だれでも読めて、本人と管理者だけが書ける
//     （firebase/firestore.rules）
//  通信できないときは、記録をこのブラウザに取っておき、つながったときに送る。
//  設定は js/online-config.js。設定が空なら使われない（js/accounts.js の LocalAccounts を使う）。
// ============================================================

const ONLINE_EMAIL_DOMAIN = 'hoshifuru.example.com';
const ONLINE_REFRESH_MS = 15000;   // ランキングを開いているあいだ、この間隔で読み直す
const ONLINE_RETRY_MS = 60000;     // 送れていない記録があるとき、この間隔で送り直す

// 設定（テストでは window.HOSHIFURU_ONLINE で差しかえる）
function onlineConfig() {
  const c = (typeof window !== 'undefined' && window.HOSHIFURU_ONLINE) || ONLINE_CONFIG;
  return c && c.apiKey && c.projectId ? c : null;
}

// ユーザー名からログイン用のアドレスを作る（大文字・小文字や全角・半角のちがいは同じ名前）
// tools/firestore-rules.js も同じ作り方で管理者のアドレスを作る
function onlineEmail(name) {
  return `p${sha256(Accounts.keyOf(name)).slice(0, 40)}@${ONLINE_EMAIL_DOMAIN}`;
}

class OnlineError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

function onlineErrorText(e, ctx) {
  const admins = ((onlineConfig() || {}).admins || []).join('、') || '未設定';
  switch (e.code) {
    case 'NETWORK': return '通信できませんでした。インターネットの接続を確かめてください';
    case 'EMAIL_EXISTS': return 'そのユーザー名はもう使われています';
    case 'EMAIL_NOT_FOUND':
    case 'INVALID_PASSWORD':
    case 'INVALID_LOGIN_CREDENTIALS': return 'ユーザー名かパスワードがちがいます';
    case 'WEAK_PASSWORD': return `パスワードは${PASS_MIN}文字以上にしてください`;
    case 'TOO_MANY_ATTEMPTS_TRY_LATER': return '何度もまちがえたため、しばらくログインできません。時間をおいてください';
    case 'USER_DISABLED': return 'このアカウントは使えなくなっています';
    case 'OPERATION_NOT_ALLOWED':
    case 'PASSWORD_LOGIN_DISABLED': return '（設定）Firebase でメール／パスワードのログインが有効になっていません';
    case 'API_KEY_INVALID': return '（設定）Firebase の API キーがちがいます';
    case 'NOT_FOUND':
    case 'FAILED_PRECONDITION': return '（設定）Firebase のデータベース（Firestore）が作られていません';
    case 'RESOURCE_EXHAUSTED': return 'Firebase の無料で使える量の上限に達しました。時間をおいてください';
    case 'PERMISSION_DENIED':
      return ctx === 'admin' ? `管理者のアカウントでログインしてください（管理者：${admins}）` : '（設定）Firebase のルールで書きこみが止められています';
    case 'DELETED': return 'このアカウントの記録は管理者に消されました。もう一度ログインすると、新しく記録を始められます';
    case 'SESSION_EXPIRED': return 'ログインの期限が切れました。もう一度ログインしてください';
    case 'NO_SESSION':
      return ctx === 'admin' ? `管理者のアカウントでログインしてください（管理者：${admins}）` : 'ログインしてください';
    default: return `通信でエラーが起きました（${e.code}）`;
  }
}

// ---------------- Firestore の値の形 ↔ ふつうの値 ----------------
function fsValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsValue) } };
  return { mapValue: { fields: fsFields(v) } };
}
function fsFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = fsValue(v);
  return out;
}
function fsParse(x) {
  if (!x || typeof x !== 'object') return null;
  if ('stringValue' in x) return x.stringValue;
  if ('integerValue' in x) return Number(x.integerValue);
  if ('doubleValue' in x) return Number(x.doubleValue);
  if ('booleanValue' in x) return x.booleanValue;
  if ('timestampValue' in x) return Date.parse(x.timestampValue);
  if ('arrayValue' in x) return (x.arrayValue.values || []).map(fsParse);
  if ('mapValue' in x) return fsParseFields(x.mapValue.fields || {});
  return null;
}
function fsParseFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = fsParse(v);
  return out;
}

// ---------------- Firebase のウェブ API ----------------
const FirebaseApi = {
  cfg: null,

  async request(url, opts) {
    let res;
    try { res = await fetch(url, opts); } catch (e) { throw new OnlineError('NETWORK'); }
    let body = null;
    try { body = await res.json(); } catch (e) { /* 中身のない返事 */ }
    return { ok: res.ok, status: res.status, body: body || {} };
  },

  // ログインまわり（identitytoolkit）。エラーは message に「EMAIL_EXISTS」などの形で入る
  async auth(method, payload) {
    const r = await this.request(`https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${encodeURIComponent(this.cfg.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (r.ok) return r.body;
    const msg = (r.body.error && r.body.error.message) || '';
    throw new OnlineError(/API key/i.test(msg) ? 'API_KEY_INVALID' : (msg.split(/[\s:]/)[0] || `HTTP_${r.status}`), msg);
  },

  async refreshToken(refreshToken) {
    const r = await this.request(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(this.cfg.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    });
    if (r.ok) return r.body;
    const msg = (r.body.error && r.body.error.message) || '';
    throw new OnlineError(msg.split(/[\s:]/)[0] || `HTTP_${r.status}`, msg);
  },

  // データベース（Firestore）。見つからない文書は null を返す
  async fs(method, path, { token, body, query } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(this.cfg.projectId)}/databases/(default)/documents/${path}${query || ''}`;
    const r = await this.request(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (r.ok) return r.body;
    const err = r.body.error || {};
    // 文書がないときの 404 は null。データベース自体がないとき（「… does not exist …」）はエラー
    if (r.status === 404 && !/does not exist/i.test(err.message || '')) return null;
    throw new OnlineError(err.status || `HTTP_${r.status}`, err.message);
  },
};

// 2つの記録をまとめる（難易度ごとに良いほう、プレイ記録は日時で合わせる）
function mergeRecords(a, b) {
  const best = { ...(a.best || {}) };
  for (const [d, e] of Object.entries(b.best || {})) if (e && (!best[d] || e.score > best[d].score)) best[d] = e;
  const seen = new Set();
  const history = [];
  for (const e of [...(a.history || []), ...(b.history || [])].sort((x, y) => y.date - x.date)) {
    const k = `${e.date}:${e.score}`;
    if (seen.has(k)) continue;
    seen.add(k);
    history.push(e);
  }
  return {
    ...a,
    name: a.name || b.name,
    nameKey: a.nameKey || b.nameKey,
    created: Math.min(a.created || Infinity, b.created || Infinity, Date.now()),
    lastLogin: Math.max(a.lastLogin || 0, b.lastLogin || 0),
    plays: Math.max(a.plays || 0, b.plays || 0),
    best,
    history: history.slice(0, HISTORY_MAX),
  };
}

// Firestore に書く形（players/<ユーザーID>）。項目を増やしたら firebase/firestore.rules も直す
function recordBody(r) {
  return { name: r.name, nameKey: r.nameKey, created: r.created, lastLogin: r.lastLogin, plays: r.plays || 0, best: r.best || {}, history: r.history || [], v: 1 };
}

// ------------------------------------------------------------
//  オンラインのアカウント（Accounts から使う。js/accounts.js の LocalAccounts と同じ形の関数を持つ）
// ------------------------------------------------------------
const OnlineAccounts = {
  session: null,     // { uid, idToken, refreshToken, expiresAt }（このブラウザに保存）
  me: null,          // 自分の記録（Firestore と同じ形 + uid と dirty。dirty はまだ送っていない変更があるか）
  players: [],       // ランキング用に読んだ全員の記録 [{ key: ユーザーID, name, best, ... }]
  state: 'connecting', // connecting / online / offline / error
  message: '',
  lastSync: 0,
  busy: 0,
  queue: Promise.resolve(),
  refreshing: null,
  refreshAgain: false,

  init(cfg) {
    FirebaseApi.cfg = cfg;
    this.session = Store.get('onlineSession', null);
    this.me = Store.get('onlineMe', null);
    if (!this.session || !this.me || this.me.uid !== this.session.uid) { this.session = null; this.me = null; }
    this.players = Store.get('onlinePlayers', []);
    window.addEventListener('online', () => this.refresh());
    // 送れていない記録があれば、ときどき送り直す
    setInterval(() => {
      if (!document.hidden && this.current() && (this.me.dirty || this.state === 'offline')) this.refresh();
    }, ONLINE_RETRY_MS);
    this.refresh();
  },
  saveCache() {
    Store.set('onlineSession', this.session);
    Store.set('onlineMe', this.me);
  },
  setState(state, message = '') {
    this.state = state;
    this.message = message;
  },
  // 通信の失敗を状態に出す
  fail(e) {
    if (e.code === 'NETWORK') this.setState('offline');
    else this.setState('error', onlineErrorText(e));
  },
  statusText() {
    if (this.state === 'error') return this.message;
    if (this.state === 'offline') return this.me && this.me.dirty ? 'オフライン（記録はつながったら送ります）' : 'オフライン';
    if (this.state === 'connecting' || this.busy) return '通信中…';
    return 'オンライン';
  },

  currentKey() { return this.session && this.me ? this.session.uid : null; },
  current() { return this.currentKey() ? this.me : null; },
  get(key) {
    if (key && this.current() && key === this.me.uid) return this.me;
    return this.players.find(p => p.key === key) || null;
  },
  all() {
    const mine = this.current();
    const list = this.players.filter(p => !mine || p.key !== mine.uid);
    if (mine) list.push({ ...mine, key: mine.uid });
    return list;
  },

  // ログインのしるし（idToken）。期限が近ければ取り直す
  async token() {
    const s = this.session;
    if (!s) throw new OnlineError('NO_SESSION');
    if (s.idToken && s.expiresAt - 60000 > Date.now()) return s.idToken;
    try {
      const r = await FirebaseApi.refreshToken(s.refreshToken);
      s.idToken = r.id_token;
      s.refreshToken = r.refresh_token || s.refreshToken;
      s.expiresAt = Date.now() + Number(r.expires_in || 3600) * 1000;
      this.saveCache();
      return s.idToken;
    } catch (e) {
      if (e.code !== 'NETWORK') {
        this.logout();
        throw new OnlineError('SESSION_EXPIRED');
      }
      throw e;
    }
  },
  startSession(r) {
    this.session = { uid: r.localId, idToken: r.idToken, refreshToken: r.refreshToken, expiresAt: Date.now() + Number(r.expiresIn || 3600) * 1000 };
  },

  // 通信を1つずつ順番に行う。失敗しても投げずに、そのエラーを返す（成功なら null）
  run(fn) {
    this.queue = this.queue.then(async () => {
      this.busy++;
      try {
        await fn();
        return null;
      } catch (e) {
        return e;
      } finally {
        this.busy--;
      }
    });
    return this.queue;
  },

  // 自分の記録をサーバーと合わせる（ほかの端末で遊んだ分を取りこみ、まだ送っていない分を送る）
  async syncMe() {
    if (!this.current()) return;
    const uid = this.me.uid;
    const token = await this.token();
    const doc = await FirebaseApi.fs('GET', `players/${uid}`, { token });
    if (!this.current() || this.me.uid !== uid) return; // 通信のあいだにログアウトした
    const server = doc ? fsParseFields(doc.fields) : null;
    // 一度は送れていた記録がサーバーにない＝管理者に消された。送り直さずにログアウトする
    if (!server && this.me.synced) {
      this.logout();
      throw new OnlineError('DELETED');
    }
    const merged = server ? mergeRecords(server, this.me) : this.me;
    Object.assign(this.me, merged);
    const body = recordBody(this.me);
    if (!server || JSON.stringify(body) !== JSON.stringify(recordBody(server))) {
      await FirebaseApi.fs('PATCH', `players/${uid}`, { token, body: { fields: fsFields(body) } });
    }
    this.me.dirty = false;
    this.me.synced = true;
    this.saveCache();
  },

  // ランキング用に全員の記録を読む（読むだけならログインはいらない）
  async loadPlayers() {
    const list = [];
    let pageToken = '';
    do {
      const q = `?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
      const r = await FirebaseApi.fs('GET', 'players', { query: q });
      for (const d of (r && r.documents) || []) list.push({ ...fsParseFields(d.fields), key: d.name.split('/').pop() });
      pageToken = r && r.nextPageToken;
    } while (pageToken && list.length < 3000);
    this.players = list;
    Store.set('onlinePlayers', list);
  },

  // 自分の記録を送り、ランキングを読み直す。通信中にまた呼ばれたら、終わったあともう一度行う
  refresh() {
    if (this.refreshing) { this.refreshAgain = true; return this.refreshing; }
    this.refreshing = (async () => {
      do {
        this.refreshAgain = false;
        const e = (this.current() ? await this.run(() => this.syncMe()) : null) || await this.run(() => this.loadPlayers());
        if (e) this.fail(e);
        else { this.setState('online'); this.lastSync = Date.now(); }
      } while (this.refreshAgain);
    })().finally(() => { this.refreshing = null; });
    return this.refreshing;
  },

  // このブラウザに保存されていた同じ名前・同じパスワードのアカウントの記録を取りこむ
  importLocal(name, pw) {
    const acc = LocalAccounts.get(Accounts.keyOf(name));
    if (!acc || acc.migrated || hashPassword(pw, acc.salt) !== acc.hash) return false;
    const plays = (this.me.plays || 0) + (acc.plays || 0);
    Object.assign(this.me, mergeRecords(this.me, acc), { plays, dirty: true });
    acc.migrated = true;
    LocalAccounts.commit();
    return true;
  },

  async register(name, pw) {
    let r;
    try {
      r = await FirebaseApi.auth('signUp', { email: onlineEmail(name), password: pw, returnSecureToken: true });
    } catch (e) {
      if (e.code === 'NETWORK') this.setState('offline');
      return { error: onlineErrorText(e) };
    }
    this.startSession(r);
    const now = Date.now();
    this.me = { uid: r.localId, name, nameKey: Accounts.keyOf(name), created: now, lastLogin: now, plays: 0, best: {}, history: [], dirty: true };
    const imported = this.importLocal(name, pw);
    this.saveCache();
    await this.refresh();
    return { ok: true, name, imported, warning: this.state === 'error' ? this.message : '' };
  },

  async login(name, pw) {
    let r;
    try {
      r = await FirebaseApi.auth('signInWithPassword', { email: onlineEmail(name), password: pw, returnSecureToken: true });
    } catch (e) {
      if (e.code === 'NETWORK') this.setState('offline');
      return { error: onlineErrorText(e) };
    }
    this.startSession(r);
    let server = null;
    try {
      const doc = await FirebaseApi.fs('GET', `players/${r.localId}`, { token: r.idToken });
      server = doc ? fsParseFields(doc.fields) : null;
    } catch (e) { this.fail(e); }
    const now = Date.now();
    this.me = { ...(server || { name, nameKey: Accounts.keyOf(name), created: now, plays: 0, best: {}, history: [] }), uid: r.localId, lastLogin: now, dirty: true, synced: false };
    const imported = this.importLocal(name, pw);
    this.saveCache();
    await this.refresh();
    return { ok: true, name: this.me.name, imported, warning: this.state === 'error' ? this.message : '' };
  },

  logout() {
    this.session = null;
    this.me = null;
    this.saveCache();
  },

  // 記録を足したあとに呼ぶ（このブラウザにすぐ保存し、通信して送る）
  saved() {
    this.me.dirty = true;
    this.saveCache();
    this.refresh();
  },

  // ---------- 管理者ページから使う（Firebase のルールで、管理者か本人だけができる） ----------
  async admin(fn) {
    try {
      await fn(await this.token());
    } catch (e) {
      return onlineErrorText(e, 'admin');
    }
    await this.refresh();
    return null;
  },
  remove(key) {
    return this.admin(async token => {
      await FirebaseApi.fs('DELETE', `players/${key}`, { token });
      if (this.current() && key === this.me.uid) this.logout();
    });
  },
  removeAll() {
    return this.admin(async token => {
      await this.loadPlayers();
      const mine = this.current() && this.me.uid;
      // 自分の記録は最後に消す（先に消すとログアウトしてしまう）
      for (const p of this.players.filter(x => x.key !== mine)) await FirebaseApi.fs('DELETE', `players/${p.key}`, { token });
      if (mine) { await FirebaseApi.fs('DELETE', `players/${mine}`, { token }); this.logout(); }
    });
  },
  resetScores(key) {
    return this.admin(async token => {
      const doc = await FirebaseApi.fs('GET', `players/${key}`, { token });
      if (!doc) return;
      const body = { ...recordBody(fsParseFields(doc.fields)), plays: 0, best: {}, history: [] };
      await FirebaseApi.fs('PATCH', `players/${key}`, { token, body: { fields: fsFields(body) } });
      if (this.current() && key === this.me.uid) Object.assign(this.me, { plays: 0, best: {}, history: [], dirty: false });
    });
  },
  // パスワードは本人しか変えられない（Firebase の決まり）
  async setPassword(key, pw) {
    if (!this.current() || key !== this.me.uid) return 'オンラインのアカウントのパスワードは、本人がログインしているときだけ変えられます';
    return this.admin(async token => {
      const r = await FirebaseApi.auth('update', { idToken: token, password: pw, returnSecureToken: true });
      this.startSession(r.localId ? r : { ...r, localId: key });
      this.saveCache();
    });
  },
  isAdmin() {
    const cfg = onlineConfig();
    return !!(this.current() && cfg && (cfg.admins || []).some(n => Accounts.keyOf(n) === this.me.nameKey));
  },
};
