'use strict';
// ============================================================
//  にせものの Firebase（テストや画面の確認のときに、本物の代わりに通信に答える）
//  ゲームが使う Firebase のウェブ API だけをまねる。書きこみの決まりは firebase/firestore.rules と同じにする。
//  使い方（Playwright）:
//    const fb = new FakeFirebase(ONLINE_TEST);
//    await fb.attach(context);   // その context で開いたページはオンラインの設定になり、通信はここに来る
// ============================================================
const { emailOf } = require('./firestore-rules.js');
const ONLINE_TEST = { apiKey: 'test-key', projectId: 'hoshifuru-test', admins: ['かんりしゃ'] };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

function fsToJs(x) {
  if ('stringValue' in x) return x.stringValue;
  if ('integerValue' in x) return Number(x.integerValue);
  if ('doubleValue' in x) return x.doubleValue;
  if ('booleanValue' in x) return x.booleanValue;
  if ('nullValue' in x) return null;
  if ('arrayValue' in x) return (x.arrayValue.values || []).map(fsToJs);
  if ('mapValue' in x) return Object.fromEntries(Object.entries(x.mapValue.fields || {}).map(([k, v]) => [k, fsToJs(v)]));
  throw new Error(`知らない値の形: ${JSON.stringify(x)}`);
}

class FakeFirebase {
  constructor(cfg) {
    this.cfg = cfg;
    this.users = new Map();   // ログイン用アドレス → { uid, password }
    this.tokens = new Map();  // idToken → { uid, email }
    this.refreshTokens = new Map();
    this.docs = new Map();    // 'players/<uid>' → Firestore の fields
    this.admins = new Set(cfg.admins.map(emailOf));
    this.offline = false;
    this.seq = 0;
  }
  async attach(context) {
    await context.addInitScript(cfg => { window.HOSHIFURU_ONLINE = cfg; }, this.cfg);
    for (const host of ['identitytoolkit', 'securetoken', 'firestore']) await context.route(`https://${host}.googleapis.com/**`, r => this.handle(r));
  }
  reply(route, status, body) { return route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) }); }
  fail(route, status, message, st) { return this.reply(route, status, { error: { code: status, message, status: st } }); }
  issue(uid, email) {
    const n = ++this.seq;
    this.tokens.set(`id-${n}`, { uid, email });
    this.refreshTokens.set(`rt-${n}`, { uid, email });
    return { idToken: `id-${n}`, refreshToken: `rt-${n}`, expiresIn: '3600', localId: uid, email };
  }
  // firebase/firestore.rules の validPlayer と同じ確認
  validPlayer(f) {
    const keys = Object.keys(f);
    const ok = ['name', 'nameKey', 'created', 'lastLogin', 'plays', 'best', 'history', 'v'];
    return keys.every(k => ok.includes(k)) && f.name && f.name.stringValue && f.name.stringValue.length <= 24
      && f.nameKey && 'stringValue' in f.nameKey && f.plays && 'integerValue' in f.plays
      && f.best && 'mapValue' in f.best && f.history && 'arrayValue' in f.history && (f.history.arrayValue.values || []).length <= 20;
  }
  player(name) {
    const key = name.normalize('NFKC').toLowerCase();
    for (const [p, f] of this.docs) {
      const d = fsToJs({ mapValue: { fields: f } });
      if (d.nameKey === key) return { uid: p.split('/')[1], ...d };
    }
    return null;
  }
  async handle(route) {
    if (this.offline) return route.abort('internetdisconnected');
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    const docBase = `projects/${this.cfg.projectId}/databases/(default)/documents/`;
    if (url.hostname !== 'firestore.googleapis.com' && url.searchParams.get('key') !== this.cfg.apiKey) {
      return this.fail(route, 400, 'API key not valid. Please pass a valid API key.', 'INVALID_ARGUMENT');
    }
    if (url.hostname === 'identitytoolkit.googleapis.com') {
      const body = JSON.parse(req.postData() || '{}');
      const action = url.pathname.split(':').pop();
      if (action === 'signUp') {
        if (this.users.has(body.email)) return this.fail(route, 400, 'EMAIL_EXISTS');
        if ((body.password || '').length < 6) return this.fail(route, 400, 'WEAK_PASSWORD : Password should be at least 6 characters');
        const uid = `user${this.users.size + 1}`;
        this.users.set(body.email, { uid, password: body.password });
        return this.reply(route, 200, this.issue(uid, body.email));
      }
      if (action === 'signInWithPassword') {
        const u = this.users.get(body.email);
        if (!u || u.password !== body.password) return this.fail(route, 400, 'INVALID_LOGIN_CREDENTIALS');
        return this.reply(route, 200, { ...this.issue(u.uid, body.email), registered: true });
      }
      if (action === 'update') {
        const t = this.tokens.get(body.idToken);
        if (!t) return this.fail(route, 400, 'INVALID_ID_TOKEN');
        this.users.get(t.email).password = body.password;
        return this.reply(route, 200, this.issue(t.uid, t.email));
      }
      return this.fail(route, 400, 'UNKNOWN_ACTION');
    }
    if (url.hostname === 'securetoken.googleapis.com') {
      const t = this.refreshTokens.get(new URLSearchParams(req.postData() || '').get('refresh_token'));
      if (!t) return this.fail(route, 400, 'INVALID_REFRESH_TOKEN');
      const n = this.issue(t.uid, t.email);
      return this.reply(route, 200, { id_token: n.idToken, refresh_token: n.refreshToken, expires_in: '3600', user_id: t.uid });
    }
    // Firestore
    const path = decodeURIComponent(url.pathname.split('/documents/')[1] || '');
    const segs = path.split('/');
    if (segs[0] !== 'players') return this.fail(route, 403, 'Missing or insufficient permissions.', 'PERMISSION_DENIED');
    if (segs.length === 1) {
      const documents = [...this.docs].map(([p, fields]) => ({ name: docBase + p, fields }));
      return this.reply(route, 200, documents.length ? { documents } : {});
    }
    const uid = segs[1];
    if (req.method() === 'GET') {
      const fields = this.docs.get(path);
      return fields ? this.reply(route, 200, { name: docBase + path, fields }) : this.fail(route, 404, `Document "${docBase + path}" not found.`, 'NOT_FOUND');
    }
    const who = this.tokens.get((req.headers().authorization || '').replace('Bearer ', ''));
    const admin = who && this.admins.has(who.email);
    if (!who || (who.uid !== uid && !admin)) return this.fail(route, 403, 'Missing or insufficient permissions.', 'PERMISSION_DENIED');
    if (req.method() === 'PATCH') {
      const { fields } = JSON.parse(req.postData() || '{}');
      if (!admin && !this.validPlayer(fields)) return this.fail(route, 403, 'Missing or insufficient permissions.', 'PERMISSION_DENIED');
      this.docs.set(path, fields);
      return this.reply(route, 200, { name: docBase + path, fields });
    }
    if (req.method() === 'DELETE') {
      this.docs.delete(path);
      return this.reply(route, 200, {});
    }
    return this.fail(route, 400, 'UNKNOWN', 'INVALID_ARGUMENT');
  }
}

module.exports = { FakeFirebase, ONLINE_TEST, fsToJs };
