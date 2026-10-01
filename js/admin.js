'use strict';
// ============================================================
//  管理者ページ（画面左上の隠しボタンから開く）
//  PIN入力 → キー入力（1文字で特別な機能を切り替え。js/cheats.js）
//  → 管理者ページ（データベース／キャラクター／プログラム／プレイヤー管理）
//  ※ PINはこのプログラムの中に書いてあるので、ページのソースを読めば分かる。
//    本当に守りたいものを置く場所ではない。
// ============================================================

const ADMIN_PIN = '114514';
const ADMIN_MAX_TRIES = 3;               // この回数まちがえると
const ADMIN_LOCK_MS = 5 * 60 * 1000;     // この時間は入力できない

const Admin = {
  root: null,
  timer: null,
  // localStorage が使えないときのための控え
  memFails: 0,
  memLock: 0,

  init() {
    const hot = domButton('', '', () => this.open());
    hot.id = 'adminHotspot';
    hot.setAttribute('aria-label', '管理者用の隠しボタン');
    document.body.appendChild(hot);
    const root = domEl('div');
    root.id = 'adminOverlay';
    root.hidden = true;
    root.addEventListener('click', e => { if (e.target === root) this.close(); });
    document.body.appendChild(root);
    this.root = root;
    window.addEventListener('keydown', e => {
      if (this.root.hidden || e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation(); // 閉じたEscでポーズが解けないように
      this.close();
    });
  },

  open() {
    Input.suspended = true;
    Input.keys = {};
    if (Game.scene instanceof GameScene && !Game.scene.paused && !Game.scene.continueMenu) Game.scene.openPause();
    this.root.hidden = false;
    this.showPin();
  },
  close() {
    clearInterval(this.timer);
    this.timer = null;
    this.root.hidden = true;
    this.root.textContent = '';
    Input.suspended = false;
    if (Game.canvas) Game.canvas.focus();
  },

  // 表示中のパネルを作り直す
  panel(cls) {
    clearInterval(this.timer);
    this.timer = null;
    this.root.textContent = '';
    const p = domEl('div', 'admin-panel ' + cls);
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-modal', 'true');
    const x = domButton('admin-close', '×', () => this.close());
    x.setAttribute('aria-label', '閉じる');
    p.appendChild(x);
    this.root.appendChild(p);
    return p;
  },

  lockUntil() { return Math.max(this.memLock, Store.get('adminLock', 0)); },
  fails() { return Math.max(this.memFails, Store.get('adminFails', 0)); },
  setFails(n) { this.memFails = n; Store.set('adminFails', n); },

  // ---------------- PIN入力 ----------------
  showPin() {
    const p = this.panel('admin-square');
    p.append(domEl('h2', 'admin-title', 'PINを入力'));
    const box = domEl('label', 'admin-pinbox');
    const slots = domEl('div', 'admin-slots', '______');
    const input = domEl('input', 'admin-pininput');
    input.id = 'adminPin';
    input.type = 'password';
    input.inputMode = 'numeric';
    input.maxLength = ADMIN_PIN.length;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'PIN');
    box.append(slots, input);
    const msg = domEl('p', 'admin-msg');
    msg.setAttribute('aria-live', 'polite');
    p.append(box, msg);

    const render = () => {
      const n = input.value.length;
      slots.textContent = '●'.repeat(n) + '_'.repeat(ADMIN_PIN.length - n);
    };
    const lockCheck = () => {
      const left = this.lockUntil() - Date.now();
      if (left > 0) {
        const s = Math.ceil(left / 1000);
        input.disabled = true;
        input.value = '';
        render();
        msg.className = 'admin-msg is-error';
        msg.textContent = `PINを${ADMIN_MAX_TRIES}回まちがえたため、入力できません（あと ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}）`;
        return true;
      }
      if (input.disabled) {
        input.disabled = false;
        msg.className = 'admin-msg';
        msg.textContent = '';
        input.focus();
      }
      return false;
    };
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, ADMIN_PIN.length);
      render();
      if (input.value.length < ADMIN_PIN.length || lockCheck()) return;
      if (input.value === ADMIN_PIN) {
        this.setFails(0);
        this.showKey();
        return;
      }
      const fails = this.fails() + 1;
      input.value = '';
      render();
      box.classList.remove('shake');
      void box.offsetWidth;
      box.classList.add('shake');
      if (fails >= ADMIN_MAX_TRIES) {
        this.setFails(0);
        this.memLock = Date.now() + ADMIN_LOCK_MS;
        Store.set('adminLock', this.memLock);
        lockCheck();
      } else {
        this.setFails(fails);
        msg.className = 'admin-msg is-error';
        msg.textContent = `PINがちがいます（あと${ADMIN_MAX_TRIES - fails}回まちがえると5分間入力できなくなります）`;
      }
    });
    lockCheck();
    this.timer = setInterval(lockCheck, 1000);
    if (!input.disabled) setTimeout(() => input.focus(), 0);
  },

  // ---------------- キー入力 ----------------
  showKey() {
    const p = this.panel('admin-square');
    p.append(domButton('admin-btn admin-btn-top', '管理者ページ', () => this.showMenu()));
    p.append(domEl('p', 'admin-label', 'キーを入力'));
    const key = domEl('input', 'admin-keyinput');
    key.id = 'adminKey';
    key.type = 'text';
    key.maxLength = 1;
    key.autocomplete = 'off';
    key.setAttribute('aria-label', 'キー');
    const msg = domEl('p', 'admin-msg admin-keymsg');
    msg.setAttribute('aria-live', 'polite');
    const list = domEl('ul', 'admin-keys');
    const renderList = () => {
      list.textContent = '';
      for (const [k, def] of Object.entries(CHEAT_KEYS)) {
        const li = domEl('li', Cheats.on[def.id] ? 'is-on' : '');
        li.append(domEl('b', '', k), domEl('span', '', def.label));
        list.append(li);
      }
    };
    // 1文字入れるたびに、その文字のキーを ON / OFF する（日本語入力の全角文字も受け付ける）
    const handle = () => {
      const ch = key.value.normalize('NFKC').toUpperCase();
      if (!ch) return;
      const r = Cheats.toggle(ch);
      msg.className = r ? 'admin-msg admin-keymsg' : 'admin-msg admin-keymsg is-error';
      msg.textContent = r
        ? `${ch}：${r.label}を${r.on ? 'ON' : 'OFF'}にしました` + (r.on ? '（スコアは保存されません）' : '')
        : `「${ch}」には何も割り当てられていません`;
      renderList();
      key.select();
    };
    key.addEventListener('input', e => { if (!e.isComposing) handle(); });
    key.addEventListener('compositionend', handle);
    renderList();
    p.append(key, msg, list);
    setTimeout(() => key.focus(), 0);
  },

  // ---------------- 管理者ページ ----------------
  showMenu() {
    const p = this.panel('admin-wide');
    p.append(domEl('h2', 'admin-heading', '管理者ページ'));
    const menu = domEl('div', 'admin-menu');
    menu.append(
      domButton('admin-btn', 'データベース', () => this.showDatabase()),
      domButton('admin-btn', 'キャラクター一覧', () => this.showCharacters()),
      domButton('admin-btn', 'プログラム', () => this.showProgram()),
    );
    menu.append(domButton('admin-btn', 'プレイヤー管理', () => this.showPlayers()));
    p.append(menu);
  },

  subPage(title) {
    const p = this.panel('admin-wide');
    const head = domEl('div', 'admin-subhead');
    head.append(domButton('admin-back', '← 戻る', () => this.showMenu()), domEl('h2', 'admin-heading', title));
    const body = domEl('div', 'admin-body');
    p.append(head, body);
    return body;
  },

  table(parent, caption, header, rows) {
    const sec = domEl('section', 'admin-section');
    sec.append(domEl('h4', 'admin-caption', caption));
    if (!rows.length) {
      sec.append(domEl('p', 'admin-empty', 'まだ記録はありません'));
      parent.append(sec);
      return;
    }
    const wrap = domEl('div', 'admin-tablewrap');
    const t = domEl('table', 'admin-table');
    const tr = domEl('tr');
    for (const h of header) tr.append(domEl('th', '', h));
    t.append(tr);
    for (const r of rows) {
      const row = domEl('tr');
      for (const c of r) row.append(domEl('td', '', String(c ?? '')));
      t.append(row);
    }
    wrap.append(t);
    sec.append(wrap);
    parent.append(sec);
  },

  // ---------------- データベース ----------------
  showDatabase() {
    const body = this.subPage('データベース');
    const name = id => (CHARA_INFO[id] ? CHARA_INFO[id].name : id);
    body.append(domEl('h3', 'admin-group', '保存データ（このブラウザ）'));
    this.table(body, 'ハイスコア', ['難易度', name('reimu'), name('marisa')],
      DIFF_NAMES.map((d, i) => [d, padScore(Store.get(`hi_${i}_reimu`, 0)), padScore(Store.get(`hi_${i}_marisa`, 0))]));
    const spells = Object.entries(Store.get('spells', {})).map(([k, v]) => {
      const [d, c, ...n] = k.split(':');
      return [n.join(':'), DIFF_NAMES[d] || d, name(c), `${v.got} / ${v.tried}`];
    }).sort((a, b) => a[0].localeCompare(b[0], 'ja'));
    this.table(body, 'スペルカード取得履歴', ['スペルカード', '難易度', 'キャラクター', '取得 / 挑戦'], spells);
    this.table(body, '設定', ['項目', '値'], [
      ['BGM 音量', `${Math.round(Sound.bgmVolume * 100)}%`],
      ['効果音 音量', `${Math.round(Sound.seVolume * 100)}%`],
      ['ミュート', Sound.muted ? 'オン' : 'オフ'],
      ['初期残機', Settings.lives],
      ['最後に選んだ難易度', DIFF_NAMES[Store.get('lastDiff', 1)]],
      ['最後に選んだキャラクター', name(Store.get('lastChar', 'reimu'))],
      ['登録プレイヤー', `${Accounts.all().length}人`],
      ['ログイン中のプレイヤー', Accounts.current() ? Accounts.current().name : 'なし'],
      ['使用中のキー', Cheats.activeLetters() || 'なし'],
    ]);

    body.append(domEl('h3', 'admin-group', 'ゲームのデータ'));
    this.table(body, 'ステージ', ['面', '名前', '英語名', 'BGM'],
      STAGES.map((s, i) => [`Stage ${i + 1}`, s.name, s.nameEn, SONGS[s.bgm] ? SONGS[s.bgm].title : s.bgm]));
    const bosses = [
      ['1面', 'rumia', RUMIA_PHASES], ['2面 中ボス', 'daiyousei', DAIYOUSEI_PHASES], ['2面', 'cirno', CIRNO_PHASES],
      ['3面 中ボス', 'midboss3', MIDBOSS3_PHASES], ['3面', 'boss3', BOSS3_PHASES],
      ['4面 中ボス', 'star', STAR_MID4_PHASES], ['4面', 'boss4', BOSS4_PHASES],
    ];
    const rows = [];
    for (const [where, id, phases] of bosses) {
      phases.forEach((ph, i) => rows.push([
        where, name(id), i + 1,
        ph.type === 'spell' ? (ph.survival ? '耐久スペル' : 'スペルカード') : '通常攻撃',
        ph.name || '―', ph.survival ? '―' : ph.hp, `${ph.time}秒`,
      ]));
    }
    this.table(body, 'ボスの攻撃（体力は Normal・難易度ごとの倍率をかける前）', ['登場', 'ボス', '順番', '種類', '名前', '体力', '制限時間'], rows);
    this.table(body, '曲', ['ID', '曲名', 'テンポ（BPM）'], MUSIC_ROOM.map(id => [id, SONGS[id].title, SONGS[id].bpm]));
    this.table(body, '難易度の倍率', ['', ...DIFF_NAMES], [
      ['弾の速さ', ...BULLET_SPEED_SCALE],
      ['全方位弾の数', ...RING_DENSITY_SCALE],
    ]);
  },

  // ---------------- プレイヤー管理 ----------------
  showPlayers(notice, isError) {
    const body = this.subPage('プレイヤー管理');
    const status = domEl('p', 'admin-status' + (isError ? ' is-error' : ''), notice || '');
    status.setAttribute('aria-live', 'polite');
    body.append(status);
    const players = Accounts.all().sort((a, b) => a.created - b.created);
    const me = Accounts.currentKey();
    body.append(domEl('p', 'admin-empty', `登録プレイヤー：${players.length}人（このブラウザに保存されているアカウント）`));
    if (!players.length) {
      body.append(domEl('p', 'admin-empty', 'まだプレイヤーはいません。タイトル画面の「アカウント」から登録できます。'));
      return;
    }
    const wrap = domEl('div', 'admin-tablewrap');
    const t = domEl('table', 'admin-table');
    const head = domEl('tr');
    for (const h of ['ユーザー名', '登録日 / 最終ログイン', 'プレイ回数', 'ベストスコア（順位）', '操作']) head.append(domEl('th', '', h));
    t.append(head);
    for (const a of players) {
      const tr = domEl('tr');
      const nameTd = domEl('td', '', a.name);
      if (a.key === me) nameTd.append(domEl('span', 'admin-badge', 'ログイン中'));
      const dates = domEl('td', 'admin-lines');
      dates.append(domEl('span', '', formatDate(a.created)), domEl('span', 'admin-sub', formatDate(a.lastLogin, true)));
      const bests = domEl('td', 'admin-lines');
      DIFF_NAMES.forEach((d, i) => {
        const b = a.best && a.best[i];
        if (b) bests.append(domEl('span', '', `${d}　${padScore(b.score)}（${Accounts.rankOf(a.key, i)}位）`));
      });
      if (!bests.childNodes.length) bests.textContent = '―';
      tr.append(nameTd, dates, domEl('td', 'num', String(a.plays || 0)), bests);
      const ops = domEl('td');
      ops.append(this.playerOps(a));
      tr.append(ops);
      t.append(tr);
    }
    wrap.append(t);
    body.append(wrap);
    const foot = domEl('div', 'admin-foot');
    const all = domButton('admin-mini is-danger', '全プレイヤーを削除', () => {
      foot.textContent = '';
      foot.append(
        domEl('span', 'admin-optext', `${players.length}人のプレイヤーとスコアをすべて削除します。元に戻せません。`),
        domButton('admin-mini is-danger', '削除する', () => { Accounts.removeAll(); this.showPlayers('全プレイヤーを削除しました'); }),
        domButton('admin-mini', 'やめる', () => this.showPlayers()),
      );
    });
    foot.append(all);
    body.append(foot);
  },

  // 1人分の操作ボタン（確認やパスワード入力はその場で切り替える）
  playerOps(a) {
    const box = domEl('div', 'admin-ops');
    const reset = () => { box.replaceWith(this.playerOps(a)); };
    const confirm = (text, label, run) => {
      box.textContent = '';
      box.append(domEl('span', 'admin-optext', text), domButton('admin-mini is-danger', label, run), domButton('admin-mini', 'やめる', reset));
    };
    box.append(
      domButton('admin-mini', 'スコアをリセット', () => confirm(`${a.name} のスコアを消しますか？`, 'リセット', () => {
        Accounts.resetScores(a.key);
        this.showPlayers(`${a.name} のスコアをリセットしました`);
      })),
      domButton('admin-mini', 'パスワード変更', () => {
        box.textContent = '';
        const input = domEl('input');
        input.type = 'text';
        input.placeholder = '新しいパスワード';
        input.maxLength = PASS_MAX;
        input.autocomplete = 'off';
        input.setAttribute('aria-label', `${a.name} の新しいパスワード`);
        const save = () => {
          const err = Accounts.setPassword(a.key, input.value);
          if (err) this.showPlayers(err, true);
          else this.showPlayers(`${a.name} のパスワードを変更しました`);
        };
        input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
        box.append(input, domButton('admin-mini', '保存', save), domButton('admin-mini', 'やめる', reset));
        input.focus();
      }),
      domButton('admin-mini is-danger', '削除', () => confirm(`${a.name} を削除しますか？`, '削除する', () => {
        Accounts.remove(a.key);
        this.showPlayers(`${a.name} を削除しました`);
      })),
    );
    return box;
  },

  // ---------------- キャラクター一覧 ----------------
  showCharacters() {
    const body = this.subPage('キャラクター一覧');
    const info = id => CHARA_INFO[id] || { name: id, title: '' };
    const chibi = (id, x, y, s, pose) => c => { c.save(); c.translate(x, y); c.scale(s, s); drawChibi(c, id, { t: 0, pose }); c.restore(); };
    const image = (key, x, y, h, crisp) => c => {
      const img = Images.get(key);
      if (!img) return;
      const w = (h * img.naturalWidth) / img.naturalHeight;
      c.imageSmoothingEnabled = !crisp;
      c.drawImage(img, x - w / 2, y - h / 2, w, h);
      c.imageSmoothingEnabled = true;
    };
    const both = (...fns) => c => fns.forEach(f => f(c));
    const at = (x, y, s, fn) => c => { c.save(); c.translate(x, y); c.scale(s, s); fn(c); c.restore(); };
    const imageChara = id => both(image(CHARA_INFO[id].image, -26, 0, 120), image(CHARA_INFO[id].dot, 46, 0, CHARA_INFO[id].dot ? Images.get(CHARA_INFO[id].dot)?.naturalHeight || 74 : 74, true));

    const groups = [
      ['自機', [
        { ...info('reimu'), note: '右はゲーム中の自機', draw: both(chibi('reimuBlue', -30, 14, 1.8), image('player', 46, 6, 46)) },
        { ...info('marisa'), note: '右はゲーム中の自機', draw: both(chibi('marisa', -30, 18, 1.8), at(46, 10, 1.3, c => drawPlayerBack(c, 'marisa', 0, 0))) },
      ]],
      ['ボス・中ボス', [
        { ...info('rumia'), note: '1面ボス', draw: chibi('rumia', 0, 16, 2, 'spread') },
        { name: '？？？', title: '1面の中ボス', note: '1面中ボス', draw: image('midboss1', 0, 0, 120) },
        { ...info('daiyousei'), note: '2面中ボス', draw: chibi('daiyousei', 0, 16, 2) },
        { ...info('cirno'), note: '2面ボス', draw: chibi('cirno', 0, 16, 2) },
        { ...info('midboss3'), note: '3面中ボス（右はゲーム中のドット絵）', draw: imageChara('midboss3') },
        { ...info('boss3'), note: '3面ボス（右はゲーム中のドット絵）', draw: imageChara('boss3') },
        { ...info('star'), note: '3面・4面中ボス', draw: chibi('star', 0, 16, 2) },
        { ...info('boss4'), note: '4面ボス（右はゲーム中のドット絵）', draw: imageChara('boss4') },
      ]],
      ['ザコ・その他', [
        { name: '妖精', title: '', note: '1〜4面', draw: both(at(-44, 6, 2, c => drawFairy(c, 'blue', 0)), at(0, 6, 2, c => drawFairy(c, 'red', 0)), at(44, 6, 2, c => drawFairy(c, 'yellow', 0))) },
        { name: '大妖精（ザコ）', title: '', note: '1〜4面', draw: at(0, 10, 2, c => drawFairy(c, 'purple', 0, true)) },
        { name: '毛玉', title: '', note: '1・2面', draw: both(at(-30, 0, 2.4, c => drawKedama(c, 'white', 0)), at(30, 0, 2.4, c => drawKedama(c, 'blue', 0))) },
        { name: '足の妖精', title: '', note: '各面でいちばん弱い妖精', draw: image('footFairy', 0, 0, 110) },
        { name: '緑の手', title: '', note: '2面以降', draw: image('hand', 0, 0, 100) },
        { name: '青い蝶', title: '', note: '4面（弾は撃たない）', draw: at(0, 0, 3, c => drawBlueButterfly(c, 4, 0, -Math.PI / 2)) },
        { name: '回転する星', title: '', note: '道中（一撃で倒せる）', draw: at(0, 0, 2.6, c => { const s = BTYPES.bigstar.size; c.drawImage(getBulletSprite('bigstar', 'yellow'), -s / 2, -s / 2, s, s); }) },
        { name: '水晶', title: '', note: '4面の壁', draw: at(-6, 0, 2.4, c => drawCrystal(c, 0, 1)) },
      ]],
    ];

    for (const [label, items] of groups) {
      body.append(domEl('h3', 'admin-group', label));
      const grid = domEl('div', 'admin-chars');
      for (const it of items) {
        const card = domEl('figure', 'admin-card');
        const cv = domEl('canvas');
        const W = 180, H = 150, dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = W * dpr;
        cv.height = H * dpr;
        const c = cv.getContext('2d');
        c.scale(dpr, dpr);
        c.translate(W / 2, H / 2);
        try { it.draw(c); } catch (e) { /* 描けないものは空欄のまま */ }
        const cap = domEl('figcaption');
        cap.append(domEl('strong', '', it.name));
        if (it.title && it.title !== '？？？') cap.append(domEl('span', 'admin-sub', it.title));
        cap.append(domEl('span', 'admin-note', it.note));
        card.append(cv, cap);
        grid.append(card);
      }
      body.append(grid);
    }
  },

  // ---------------- プログラム ----------------
  async loadSources() {
    const files = [];
    for (const s of document.querySelectorAll('script')) {
      if (s.dataset.file) files.push({ name: s.dataset.file, text: s.textContent });
      else if (s.getAttribute('src')) {
        let text = null;
        // ファイルを直接開いているときはブラウザの制限で読めない
        if (location.protocol !== 'file:') try {
          const r = await fetch(s.src);
          if (r.ok) text = await r.text();
        } catch (e) { /* 読めなかったファイルは表示しない */ }
        files.push({ name: s.getAttribute('src'), text });
      }
    }
    return files;
  },

  async showProgram() {
    const body = this.subPage('プログラム');
    body.classList.add('admin-program');
    const list = domEl('div', 'admin-files');
    const view = domEl('div', 'admin-codeview');
    const info = domEl('p', 'admin-codeinfo', '読み込み中…');
    const code = domEl('pre', 'admin-code');
    view.append(info, code);
    body.append(list, view);
    const files = await this.loadSources();
    const show = (f, btn) => {
      for (const b of list.children) b.classList.toggle('is-active', b === btn);
      if (f.text === null) {
        info.textContent = f.name;
        code.textContent = 'このファイルは表示できません。\n\n'
          + 'index.html をファイルとして直接開いているときは、ブラウザの制限で\n'
          + 'ページが自分のプログラムを読み込めません。\n'
          + '1ファイル版（dist/hoshifuru.html）か、GitHub Pages などで開いたページで表示できます。';
        return;
      }
      const lines = f.text.replace(/^\n/, '').replace(/\n+$/, '').split('\n');
      info.textContent = `${f.name}（${lines.length}行）`;
      const w = String(lines.length).length;
      code.textContent = lines.map((l, i) => {
        // 画像を埋め込んだ長い行は途中で省略する
        const t = l.length > 400 ? `${l.slice(0, 160)} …（${l.length - 160}文字省略）` : l;
        return `${String(i + 1).padStart(w)}  ${t}`;
      }).join('\n');
      code.scrollTop = 0;
    };
    list.textContent = '';
    files.forEach((f, i) => {
      const b = domButton('admin-file', f.name.replace(/^js\//, ''), () => show(f, b));
      list.append(b);
      if (i === 0) show(f, b);
    });
    if (!files.length) info.textContent = 'プログラムが見つかりません';
  },
};

Admin.init();
