'use strict';
// ============================================================
//  管理者ページ（画面左上の隠しボタンから開く）
//  PIN入力 → キー入力（1文字で特別な機能を切り替え。js/cheats.js）
//  → 管理者ページ（データベース／キャラクター／プログラム／未実装）
//  ※ PINはこのプログラムの中に書いてあるので、ページのソースを読めば分かる。
//    本当に守りたいものを置く場所ではない。
// ============================================================

const ADMIN_PIN = '114514810';
const ADMIN_MAX_TRIES = 3;               // この回数まちがえると
const ADMIN_LOCK_MS = 5 * 60 * 1000;     // この時間は入力できない

const Admin = {
  root: null,
  timer: null,
  zoom: null,     // キャラクターの拡大表示
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
      if (this.root.hidden) return;
      if (this.zoom && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        this.stepZoom(e.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation(); // 閉じたEscでポーズが解けないように
      if (this.zoom) this.closeZoom(); // 拡大表示中なら拡大だけ閉じる
      else this.close();
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
    this.closeZoom();
    clearInterval(this.timer);
    this.timer = null;
    this.root.hidden = true;
    this.root.textContent = '';
    Input.suspended = false;
    if (Game.canvas) Game.canvas.focus();
  },

  // 表示中のパネルを作り直す
  panel(cls) {
    this.closeZoom();
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
    const slots = domEl('div', 'admin-slots', '_'.repeat(ADMIN_PIN.length));
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
    // キーの説明は出さず、入れた文字の ON / OFF と、ON になっている文字だけを表示する
    const msg = domEl('p', 'admin-msg admin-keymsg');
    msg.setAttribute('aria-live', 'polite');
    const active = domEl('p', 'admin-msg admin-keymsg');
    const renderActive = () => {
      const keys = Cheats.activeLetters();
      active.textContent = keys ? `ON：${keys.split('').join(' ')}` : '';
    };
    // 1文字入れるたびに、その文字のキーを ON / OFF する（日本語入力の全角文字も受け付ける）
    const handle = () => {
      const ch = key.value.normalize('NFKC').toUpperCase();
      if (!ch) return;
      const r = Cheats.toggle(ch);
      msg.textContent = r ? `${ch}：${r.on ? 'ON' : 'OFF'}` : '';
      renderActive();
      key.select();
    };
    key.addEventListener('input', e => { if (!e.isComposing) handle(); });
    key.addEventListener('compositionend', handle);
    renderActive();
    p.append(key, msg, active);
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
    const todo = domButton('admin-btn', '（未実装）');
    todo.disabled = true;
    menu.append(todo);
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
    this.table(body, 'ハイスコア', ['難易度', ...PLAYER_IDS.map(name)],
      DIFF_NAMES.map((d, i) => [d, ...PLAYER_IDS.map(id => padScore(Store.get(`hi_${i}_${id}`, 0)))]));
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
      ['最後に選んだキャラクター', name(Store.get('lastChar', PLAYER_IDS[0]))],
      ['ゲームの版', GAME_VERSION],
      ['保存データの形式', `${Store.get('saveVersion', 0)}（最新：${SAVE_VERSION}）`],
      ['使用中のキー', Cheats.activeLetters() || 'なし'],
    ]);

    body.append(domEl('h3', 'admin-group', 'キー'));
    this.table(body, 'キーの一覧（もう一度入れるとOFF。使ったプレイはスコアが保存されない）',
      ['キー', '名前', '内容', '状態'],
      [
        ...Object.entries(CHEAT_KEYS).map(([k, d]) => [k, d.label, d.desc, Cheats.on[d.id] ? 'ON' : 'OFF']),
        [CHEAT_ALL_KEY.letter, CHEAT_ALL_KEY.label, CHEAT_ALL_KEY.desc, Cheats.allOn() ? 'ON' : 'OFF'],
      ]);

    body.append(domEl('h3', 'admin-group', 'ゲームのデータ'));
    this.table(body, 'ステージ', ['面', '名前', '英語名', 'BGM'],
      STAGES.map((s, i) => [`Stage ${i + 1}`, s.name, s.nameEn, SONGS[s.bgm] ? SONGS[s.bgm].title : s.bgm]));
    const bosses = STAGES.flatMap((st, i) => (st.bosses || []).map(b => [`${i + 1}面${b.mid ? ' 中ボス' : ''}`, b.id, b.phases]));
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

  // ---------------- キャラクター一覧 ----------------
  // 描く関数は (ctx, t) を受け取る。t はフレーム数で、拡大表示のときだけ動かす
  showCharacters() {
    const body = this.subPage('キャラクター一覧');
    body.append(domEl('p', 'admin-empty', 'キャラクターを選ぶと拡大して表示します（←→で切り替え、Escで戻る）'));
    const info = id => CHARA_INFO[id] || { name: id, title: '' };
    const chibi = (id, x, y, s, pose) => (c, t) => { c.save(); c.translate(x, y); c.scale(s, s); drawChibi(c, id, { t, pose }); c.restore(); };
    const image = (key, x, y, h, crisp) => c => {
      const img = Images.get(key);
      if (!img) return;
      const w = (h * img.naturalWidth) / img.naturalHeight;
      c.imageSmoothingEnabled = !crisp;
      c.drawImage(img, x - w / 2, y - h / 2, w, h);
      c.imageSmoothingEnabled = true;
    };
    const both = (...fns) => (c, t) => fns.forEach(f => f(c, t));
    const at = (x, y, s, fn) => (c, t) => { c.save(); c.translate(x, y); c.scale(s, s); fn(c, t); c.restore(); };
    const dotH = key => (Images.get(key) ? Images.get(key).naturalHeight : 74);
    const imageChara = id => both(image(CHARA_INFO[id].image, -26, 0, 120), image(CHARA_INFO[id].dot, 46, 0, dotH(CHARA_INFO[id].dot), true));

    // 自機は PLAYER_TYPES、ボスは各ステージの bosses から自動で並べる
    const crisp = fn => (c, t) => { c.imageSmoothingEnabled = false; fn(c, t); c.imageSmoothingEnabled = true; };
    const bossPreview = (id, def) => (CHARA_INFO[id] && CHARA_INFO[id].image
      ? (CHARA_INFO[id].dot ? imageChara(id) : image(CHARA_INFO[id].image, 0, 0, 120))
      : chibi(id, 0, 16, 2, def && def.pose));
    const groups = [
      ['自機', PLAYER_IDS.map(id => ({
        ...info(id), note: '右はゲーム中の自機',
        draw: both(chibi(PLAYER_TYPES[id].portrait || id, -30, 16, 1.8), at(46, 8, 1.8, crisp((c, t) => drawPlayerSprite(c, id, t)))),
      }))],
      ['ボス・中ボス', STAGES.flatMap((st, i) => (st.bosses || []).map(b => ({
        ...info(b.id),
        note: `${i + 1}面${b.mid ? '中ボス' : 'ボス'}` + (CHARA_INFO[b.id] && CHARA_INFO[b.id].dot ? '（右はゲーム中のドット絵）' : ''),
        draw: bossPreview(b.id, b.def),
      })))],
      ['ザコ・その他', [
        { name: '？？？', title: '1面の中ボス', note: '1面中ボス（ザコと同じしくみで動く）', draw: image('midboss1', 0, 0, 120) },
        { name: '妖精', title: '', note: '1〜4面', draw: both(at(-44, 6, 2, (c, t) => drawFairy(c, 'blue', t)), at(0, 6, 2, (c, t) => drawFairy(c, 'red', t)), at(44, 6, 2, (c, t) => drawFairy(c, 'yellow', t))) },
        { name: '大妖精（ザコ）', title: '', note: '1〜4面', draw: at(0, 10, 2, (c, t) => drawFairy(c, 'purple', t, true)) },
        { name: '毛玉', title: '', note: '1・2面', draw: both(at(-30, 0, 2.4, (c, t) => drawKedama(c, 'white', t)), at(30, 0, 2.4, (c, t) => drawKedama(c, 'blue', t))) },
        { name: '足の妖精', title: '', note: '各面でいちばん弱い妖精', draw: image('footFairy', 0, 0, 110) },
        { name: '緑の手', title: '', note: '2面以降', draw: image('hand', 0, 0, 100) },
        { name: '青い蝶', title: '', note: '4面（弾は撃たない）', draw: at(0, 0, 3, (c, t) => drawBlueButterfly(c, 4 + t, 0, -Math.PI / 2)) },
        { name: '回転する星', title: '', note: '道中（一撃で倒せる）', draw: at(0, 0, 2.6, (c, t) => { const s = BTYPES.bigstar.size; c.rotate(t * 0.05); c.drawImage(getBulletSprite('bigstar', 'yellow'), -s / 2, -s / 2, s, s); }) },
        { name: '水晶', title: '', note: '4面の壁', draw: at(-6, 0, 2.4, (c, t) => drawCrystal(c, t, 1)) },
      ]],
    ];

    const all = groups.flatMap(([, items]) => items);
    for (const [label, items] of groups) {
      body.append(domEl('h3', 'admin-group', label));
      const grid = domEl('div', 'admin-chars');
      for (const it of items) {
        const card = domButton('admin-card', '', () => this.openZoom(all, all.indexOf(it)));
        card.setAttribute('aria-label', `${it.name}を拡大`);
        const cv = this.charaCanvas(it, 180, 150, 1, 0);
        const cap = domEl('span', 'admin-cardcap');
        cap.append(domEl('strong', '', it.name));
        if (it.title && it.title !== '？？？') cap.append(domEl('span', 'admin-sub', it.title));
        cap.append(domEl('span', 'admin-note', it.note));
        card.append(cv, cap);
        grid.append(card);
      }
      body.append(grid);
    }
  },

  // キャラクターを描いたキャンバス（W×H の大きさに、k 倍で描く）
  charaCanvas(it, W, H, k, t, cv) {
    cv = cv || domEl('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    c.translate(W / 2, H / 2);
    c.scale(k, k);
    try { it.draw(c, t); } catch (e) { /* 描けないものは空欄のまま */ }
    return cv;
  },

  // ---------------- 拡大表示 ----------------
  openZoom(list, index) {
    this.closeZoom();
    const wrap = domEl('div', 'admin-zoom');
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.addEventListener('click', e => { if (e.target === wrap) this.closeZoom(); });
    const box = domEl('div', 'admin-zoombox');
    const x = domButton('admin-close', '×', () => this.closeZoom());
    x.setAttribute('aria-label', '拡大表示を閉じる');
    const cv = domEl('canvas', 'admin-zoomcanvas');
    const cap = domEl('div', 'admin-zoomcap');
    const nav = domEl('div', 'admin-zoomnav');
    const prev = domButton('admin-mini', '← 前', () => this.stepZoom(-1));
    const count = domEl('span', 'admin-sub');
    const next = domButton('admin-mini', '次 →', () => this.stepZoom(1));
    nav.append(prev, count, next);
    box.append(x, cv, cap, nav);
    wrap.append(box);
    this.root.append(wrap);
    this.zoom = { wrap, cv, cap, count, list, index, t: 0, raf: 0 };
    this.renderZoomInfo();
    const loop = () => {
      const z = this.zoom;
      if (!z) return;
      z.t++;
      this.charaCanvas(z.list[z.index], 540, 450, 3, z.t, z.cv);
      z.raf = requestAnimationFrame(loop);
    };
    loop();
    next.focus();
  },
  stepZoom(d) {
    const z = this.zoom;
    if (!z) return;
    z.index = (z.index + d + z.list.length) % z.list.length;
    this.renderZoomInfo();
  },
  renderZoomInfo() {
    const z = this.zoom, it = z.list[z.index];
    z.cap.textContent = '';
    z.cap.append(domEl('strong', 'admin-zoomname', it.name));
    if (it.title && it.title !== '？？？') z.cap.append(domEl('span', 'admin-sub', it.title));
    z.cap.append(domEl('span', 'admin-note', it.note));
    z.count.textContent = `${z.index + 1} / ${z.list.length}`;
  },
  closeZoom() {
    if (!this.zoom) return;
    cancelAnimationFrame(this.zoom.raf);
    this.zoom.wrap.remove();
    this.zoom = null;
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
