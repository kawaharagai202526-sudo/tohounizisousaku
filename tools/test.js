'use strict';
// ============================================================
//  自動テスト：ブラウザ（Chromium）でゲームを実際に動かして確かめる
//
//  使い方:
//    node tools/test.js            ふつうのテスト（1〜2分）
//    node tools/test.js --full     自動操縦で全ステージを通しでプレイするテストも行う（数分）
//    node tools/test.js --dist     1ファイル版（dist/hoshifuru.html）を対象にする
//    node tools/test.js 管理者     名前に「管理者」を含むテストだけ行う
//
//  Playwright が必要（npm install で入るもの、またはグローバルに入っているもの）。
//  大きな変更をしたら、コミットの前に必ず実行する。
// ============================================================
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const FULL = args.includes('--full');
const DIST = args.includes('--dist');
const FILTER = args.find(a => !a.startsWith('--'));
const TARGET = DIST ? path.join(root, 'dist', 'hoshifuru.html') : path.join(root, 'index.html');
const URL = pathToFileURL(TARGET).href;

function loadPlaywright() {
  const candidates = ['playwright'];
  if (process.env.PLAYWRIGHT_PATH) candidates.push(process.env.PLAYWRIGHT_PATH);
  try { candidates.push(path.join(execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(), 'playwright')); } catch (e) { /* npm が無い */ }
  for (const c of candidates) {
    try { return require(c); } catch (e) { /* 次を試す */ }
  }
  console.error('Playwright が見つかりません。リポジトリで npm install を実行してください。');
  process.exit(2);
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ゲームを開く。requestAnimationFrame を止めて、テストからフレームを進める（T.step）
async function openGame(browser, contextOptions = {}, query = '') {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...contextOptions });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    // フォントの読み込み失敗（オフライン）などのネットワークエラーは無視する
    if (m.type() === 'error' && !/Failed to load resource|net::ERR_/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  await page.addInitScript(() => {
    window.__rafPaused = true;
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => orig(t => { if (window.__rafPaused) window.requestAnimationFrame(cb); else cb(t); });
  });
  await page.goto(URL + query);
  // requestAnimationFrame を止めているので、待つときは時間で調べる（polling）
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.scene, null, { polling: 50 });
  await page.evaluate(() => {
    window.T = {
      step(n = 1, drawEvery = 1) {
        for (let i = 1; i <= n; i++) {
          Game.update();
          if (i % drawEvery === 0 || i === n) Game.draw();
        }
      },
    };
  });
  return { page, context, errors };
}

// ------------------------------------------------------------
//  テスト
// ------------------------------------------------------------
const TESTS = [];
const test = (name, fn, opts = {}) => TESTS.push({ name, fn, ...opts });

test('起動してタイトルが出る', async ({ page }) => {
  const r = await page.evaluate(() => {
    T.step(60);
    return { scene: Game.scene.constructor.name, items: TITLE_ITEMS.map(i => i.id), version: GAME_VERSION, save: Store.get('saveVersion', 0), saveLatest: SAVE_VERSION };
  });
  assert(r.scene === 'TitleScene', `最初の画面がタイトルではない: ${r.scene}`);
  assert(r.items.join() === 'start,practice,ranking,music,manual,option,account', `タイトルの項目: ${r.items}`);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert(r.version === pkg.version, `GAME_VERSION（${r.version}）と package.json の version（${pkg.version}）がちがう`);
  assert(r.save === r.saveLatest, `保存データの形式が最新になっていない: ${r.save}`);
});

test('メニュー画面をひととおり表示できる', async ({ page }) => {
  const r = await page.evaluate(() => {
    const scenes = [
      () => new DifficultyScene('game'), () => new DifficultyScene('practice'), () => new CharacterScene('game', 1),
      () => new StageSelectScene(1, PLAYER_IDS[0]), () => new RankingScene(), () => new MusicRoomScene(), () => new ManualScene(), () => new OptionScene(),
    ];
    for (const f of scenes) { Game.setScene(f()); T.step(30); }
    Game.setScene(new GameScene({ difficulty: 1, character: PLAYER_IDS.at(-1), stage: 0 }));
    T.step(30);
    const g = G;
    Game.setScene(new EndingScene(g)); T.step(30);
    Game.setScene(new ResultScene(g, 'gameover')); T.step(30);
    // キーボードでタイトルから難易度選択へ
    Game.setScene(new TitleScene());
    T.step(20);
    Input.just.shot = true;
    T.step(2);
    return Game.scene.constructor.name;
  });
  assert(r === 'DifficultyScene', `タイトルで決定しても難易度選択にならない: ${r}`);
});

test('全ステージを道中からボス撃破まで進められる', async ({ page }) => {
  // 道中は無敵で放置、ボスは攻撃ごとに体力を0にして先へ進める
  const r = await page.evaluate(() => {
    const out = [];
    for (let st = 0; st < STAGES.length; st++) {
      for (const [ch, bossOnly] of PLAYER_IDS.flatMap(id => [[id, false], [id, true]])) {
        Cheats.on.bossOnly = bossOnly;
        Game.setScene(new GameScene({ difficulty: 1, character: ch, stage: st, practice: true }));
        const g = G;
        g.cheat = true;
        const seen = new Set();
        let f = 0;
        while (Game.scene === g && f < 40000) {
          if (g.dialogue && f % 6 === 0) Input.just.shot = true;
          const b = g.boss;
          if (b && b.phase) {
            seen.add(`${b.id}:${g.bossPhaseIdx}`);
            if (!b.phase.survival && !b.untouchable && b.invincible <= 0) b.hp = 0;
          }
          Game.update();
          if (++f % 240 === 0) Game.draw();
        }
        const expected = STAGES[st].bosses.filter(bs => !(bossOnly && bs.mid))
          .reduce((n, bs) => n + bs.phases.filter(ph => DIFF >= (ph.minDiff || 0)).length, 0);
        out.push({ st: st + 1, ch, bossOnly, end: Game.scene.constructor.name, frames: f, phases: seen.size, expected });
      }
    }
    Cheats.on.bossOnly = false;
    return out;
  });
  for (const x of r) {
    const label = `${x.st}面 ${x.ch}${x.bossOnly ? '（ボス戦のみ）' : ''}`;
    assert(x.end === 'ResultScene', `${label}：最後まで進まなかった（${x.end}、${x.frames}フレーム）`);
    assert(x.phases === x.expected, `${label}：ボスの攻撃の数 ${x.phases}（予定 ${x.expected}）`);
  }
});

test('ストーリー・曲・キャラクターのデータがそろっている', async ({ page }) => {
  // 画像の読み込みを待つ（file:// でもすぐ読める）
  await page.waitForFunction(() => Object.keys(IMAGE_FILES).every(k => Images.list[k].complete), null, { polling: 50, timeout: 10000 });
  const problems = await page.evaluate(() => {
    const out = [];
    // 名前が出るキャラクターは CHARA_INFO に、絵は CHARA_INFO の image か CHARA（キャンバスで描く絵）に必要
    const drawable = id => (CHARA_INFO[id] && CHARA_INFO[id].image) || CHARA[id] || out.push(`${id} の絵がない（CHARA_INFO の image か CHARA）`);
    const chara = id => (CHARA_INFO[id] ? drawable(id) : out.push(`CHARA_INFO に ${id} がない`));
    const song = (id, where) => SONGS[id] || out.push(`${where}: 曲 ${id} がない`);
    // 自機
    for (const id of PLAYER_IDS) {
      chara(id);
      const t = PLAYER_TYPES[id];
      for (const k of ['speed', 'focusSpeed', 'hitR', 'color', 'shoot', 'drawOption', 'makeBomb', 'bombName', 'shotDesc', 'desc']) if (t[k] === undefined) out.push(`PLAYER_TYPES.${id}.${k} がない`);
      if (t.portrait) drawable(t.portrait);
      if (t.sprite && !IMAGE_FILES[t.sprite.image]) out.push(`PLAYER_TYPES.${id}.sprite の画像 ${t.sprite.image} がない`);
      const e = ENDINGS[id];
      if (!e || !e.title || !e.pages || !e.pages.length) out.push(`ENDINGS.${id} がない`);
      else if (e.guest) drawable(e.guest.id);
    }
    // ステージとボス
    STAGES.forEach((st, i) => {
      const w = `${i + 1}面`;
      song(st.bgm, w);
      if (typeof st.script !== 'function' || typeof st.boss !== 'function') out.push(`${w}: script か boss がない`);
      if (!st.bosses || !st.bosses.length) out.push(`${w}: bosses がない`);
      for (const b of st.bosses || []) {
        chara(b.id);
        if (b.bgm) song(b.bgm, `${w} ${b.id}`);
        if (!b.phases || !b.phases.length) out.push(`${w} ${b.id}: 攻撃がない`);
        for (const ph of b.phases || []) if (typeof ph.script !== 'function' || !ph.time) out.push(`${w} ${b.id}: 攻撃 ${ph.name || ph.type} に script か time がない`);
      }
    });
    // 会話（[話者, 表情, 台詞] / { bgm } / { title }）
    for (const [key, byChar] of Object.entries(STORY)) {
      for (const id of PLAYER_IDS) {
        const sc = byChar[id];
        if (!sc) { out.push(`STORY.${key}.${id} がない`); continue; }
        for (const part of ['before', 'after']) {
          for (const line of sc[part] || []) {
            if (Array.isArray(line)) {
              if (line.length !== 3 || typeof line[2] !== 'string') out.push(`STORY.${key}.${id}.${part}: 形がおかしい行 ${JSON.stringify(line)}`);
              else chara(line[0]);
            } else if (line.bgm) song(line.bgm, `STORY.${key}.${id}`);
            else if (line.title) chara(line.title);
          }
        }
      }
    }
    // 曲（MML の小節のずれは console.warn で知らせる）
    const warn = console.warn;
    console.warn = m => out.push(String(m));
    try {
      for (const [id, def] of Object.entries(SONGS)) {
        try { compileSong(def); } catch (e) { out.push(`曲 ${id}: ${e.message}`); }
      }
    } finally { console.warn = warn; }
    for (const id of MUSIC_ROOM) song(id, 'MUSIC_ROOM');
    // 画像
    for (const k of Object.keys(IMAGE_FILES)) if (!Images.get(k)) out.push(`画像 ${IMAGE_FILES[k]} が読めない`);
    return out;
  });
  assert(!problems.length, `データの問題:\n    ${problems.join('\n    ')}`);
});

test('ボスの攻撃をひとつずつ動かせる（Lunatic）', async ({ page }) => {
  // 開発用の startBossTest で、すべてのボス・中ボスの攻撃を1つずつ7秒間動かす（無敵）
  const r = await page.evaluate(() => {
    const out = [];
    for (const st of STAGES) {
      for (const b of st.bosses) {
        const n = b.phases.filter(ph => 3 >= (ph.minDiff || 0)).length;
        for (let k = 1; k <= n; k++) {
          startBossTest({ boss: b.id, phase: k, diff: 3, only: true });
          const g = G;
          g.cheat = true;
          let names = new Set();
          for (let f = 0; f < 420 && Game.scene === g; f++) {
            Input.debugHold.add('shot');
            Game.update();
            if (g.boss && g.boss.phase) names.add(g.boss.phase.name || g.boss.phase.type);
            if (f % 20 === 0) Game.draw();
          }
          Input.debugHold.delete('shot');
          const expected = b.phases.filter(ph => 3 >= (ph.minDiff || 0))[k - 1];
          out.push({ boss: b.id, k, ok: names.has(expected.name || expected.type), names: [...names] });
        }
      }
    }
    return out;
  });
  const bad = r.filter(x => !x.ok);
  assert(r.length > 0 && !bad.length, `指定した攻撃が始まらない: ${JSON.stringify(bad)}`);
});

test('URL の ?stage= / ?boss= でボスの攻撃からすぐ始まる', async ({ browser }) => {
  // stage=1 なら1面のボス。2番目の攻撃だけを Lunatic で
  const { page, context, errors } = await openGame(browser, {}, '?stage=1&phase=2&diff=3&only=1');
  try {
    const r = await page.evaluate(() => {
      T.step(200);
      const meta = STAGES[0].bosses.filter(b => !b.mid).pop();
      const second = meta.phases.filter(ph => 3 >= (ph.minDiff || 0))[1];
      return {
        scene: Game.scene.constructor.name, practice: G.practice, diff: DIFF,
        boss: G.boss && G.boss.id, expectedBoss: meta.id,
        phase: G.boss && G.boss.phase && G.boss.phase.name, expectedPhase: second.name, phases: G.bossPhases && G.bossPhases.length,
      };
    });
    assert(r.scene === 'GameScene' && r.practice && r.diff === 3, `始まり方がおかしい: ${JSON.stringify(r)}`);
    assert(r.boss === r.expectedBoss && r.phases === 1 && r.phase === r.expectedPhase, `ボスや攻撃がおかしい: ${JSON.stringify(r)}`);
    assert(!errors.length, errors.join('\n'));
  } finally { await context.close(); }
}, { noPage: true });

test('管理者ページ（PIN・キー・各ページ）', async ({ page }) => {
  await page.mouse.click(20, 12);
  await page.waitForSelector('#adminPin');
  // 3回まちがえるとロック
  for (let i = 0; i < 3; i++) { await page.focus('#adminPin'); await page.keyboard.type('123456'); }
  assert(await page.evaluate(() => document.getElementById('adminPin').disabled), 'PINを3回まちがえてもロックされない');
  await page.evaluate(() => { localStorage.removeItem('hoshifuru.adminLock'); Admin.memLock = 0; });
  await page.waitForFunction(() => !document.getElementById('adminPin').disabled, null, { polling: 100, timeout: 3000 });
  await page.focus('#adminPin');
  await page.keyboard.type('114514');
  await page.waitForSelector('#adminKey');
  const key = async ch => { await page.focus('#adminKey'); await page.keyboard.type(ch); return page.evaluate(() => ({ msg: document.querySelector('.admin-keymsg').textContent, all: Cheats.allOn(), any: Cheats.anyOn() })); };
  let k = await key('f');
  assert(k.all && k.msg === 'F：ON', `F ですべてONにならない: ${JSON.stringify(k)}`);
  k = await key('F');
  assert(!k.any && k.msg === 'F：OFF', `もう一度 F ですべてOFFにならない: ${JSON.stringify(k)}`);
  k = await key('x');
  assert(!k.any && k.msg === '', `割り当てのない文字で何か表示された: ${JSON.stringify(k)}`);
  const leaked = await page.evaluate(() => Object.values(CHEAT_KEYS).some(d => document.getElementById('adminOverlay').textContent.includes(d.label)));
  assert(!leaked, 'キー入力画面にキーの説明が出ている');
  // メニュー
  await page.click('.admin-btn-top');
  const menu = await page.$$eval('.admin-menu button', bs => bs.map(b => b.textContent));
  assert(menu.join() === 'データベース,キャラクター一覧,プログラム,プレイヤー管理', `メニュー: ${menu}`);
  // データベース
  await page.click('.admin-menu button:nth-child(1)');
  const db = await page.evaluate(() => ({ text: document.querySelector('.admin-body').textContent, keys: Object.keys(CHEAT_KEYS).length }));
  assert(db.text.includes('キーの一覧') && db.text.includes('すべて'), 'データベースにキーの一覧がない');
  // キャラクター一覧と拡大表示
  await page.click('.admin-back');
  await page.click('.admin-menu button:nth-child(2)');
  const cards = await page.$$('.admin-card');
  assert(cards.length >= 10, `キャラクターが少ない: ${cards.length}`);
  await cards[2].click();
  const z1 = await page.textContent('.admin-zoomname');
  await page.keyboard.press('ArrowRight');
  const z2 = await page.textContent('.admin-zoomname');
  assert(z1 && z2 && z1 !== z2, `拡大表示で切り替えられない: ${z1} → ${z2}`);
  await page.keyboard.press('Escape');
  const afterEsc = await page.evaluate(() => ({ zoom: !!document.querySelector('.admin-zoom'), admin: !document.getElementById('adminOverlay').hidden }));
  assert(!afterEsc.zoom && afterEsc.admin, 'Escで拡大表示だけが閉じない');
  // プログラム
  await page.click('.admin-back');
  await page.click('.admin-menu button:nth-child(3)');
  await page.waitForFunction(() => document.querySelector('.admin-codeinfo').textContent !== '読み込み中…', null, { polling: 50 });
  const files = await page.$$eval('.admin-file', bs => bs.length);
  const scripts = await page.evaluate(() => document.querySelectorAll('script[src], script[data-file]').length);
  assert(files === scripts, `プログラムのファイル数 ${files}（スクリプト ${scripts}）`);
  // プレイヤー管理
  await page.evaluate(() => { Accounts.register('テスト1', 'abcd'); Accounts.register('テスト2', 'abcd'); });
  await page.click('.admin-back');
  await page.click('.admin-menu button:nth-child(4)');
  const rows = await page.$$eval('.admin-table tr', trs => trs.length - 1);
  assert(rows === 2, `プレイヤー管理の行数: ${rows}`);
  await page.click('tr:nth-child(2) .admin-ops button.is-danger');
  await page.click('tr:nth-child(2) .admin-ops button.is-danger');
  assert((await page.evaluate(() => Accounts.all().length)) === 1, 'プレイヤーを削除できない');
  await page.keyboard.press('Escape');
  assert(await page.evaluate(() => document.getElementById('adminOverlay').hidden && !Input.suspended), 'Escで管理者ページが閉じない');
});

test('アカウントとランキング', async ({ page }) => {
  // タイトルの「アカウント」から登録
  await page.evaluate(() => { Game.setScene(new TitleScene('account')); T.step(20); Input.just.shot = true; T.step(2); });
  assert(await page.evaluate(() => AccountDialog.isOpen && Input.suspended), 'アカウント画面が開かない');
  await page.click('.acct-tab:nth-child(2)');
  await page.fill('.acct-field:nth-of-type(1) input', 'れいむ');
  await page.fill('.acct-field:nth-of-type(2) input', 'abcd');
  await page.fill('.acct-field:nth-of-type(3) input', 'abcx');
  await page.keyboard.press('Enter');
  assert((await page.textContent('.acct-msg')).includes('一致しません'), '確認用パスワードのちがいを見つけられない');
  await page.fill('.acct-field:nth-of-type(3) input', 'abcd');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.acct-welcome');
  const stored = await page.evaluate(() => localStorage.getItem('hoshifuru.accounts'));
  assert(!stored.includes('abcd'), 'パスワードがそのまま保存されている');
  await page.keyboard.press('Escape');
  // 記録の保存のルール
  const r = await page.evaluate(() => {
    const play = (opts, score, setup) => {
      Game.setScene(new GameScene(opts));
      T.step(3);
      if (setup) setup(G);
      G.score = score;
      G.finish(opts.practice ? 'practice' : 'gameover');
      T.step(3);
      return G.records.ranking;
    };
    const res = {};
    res.normal = play({ difficulty: 1, character: PLAYER_IDS[0], stage: 0 }, 123450);
    res.cont = play({ difficulty: 1, character: PLAYER_IDS[0], stage: 0 }, 999990, g => { g.continues = 1; });
    res.practice = play({ difficulty: 1, character: PLAYER_IDS[0], stage: 1, practice: true }, 999990);
    Cheats.set('lives', true);
    res.keys = play({ difficulty: 1, character: PLAYER_IDS[0], stage: 0 }, 999990);
    Cheats.set('lives', false);
    Accounts.register('まりさ', 'abcd');
    res.second = play({ difficulty: 1, character: PLAYER_IDS.at(-1), stage: 0 }, 500000);
    Accounts.logout();
    res.guest = play({ difficulty: 1, character: PLAYER_IDS.at(-1), stage: 0 }, 999990);
    res.ranking = Accounts.ranking(1).map(x => `${x.name}:${x.score}`);
    res.badLogin = !!Accounts.login('れいむ', 'zzzz').error;
    res.goodLogin = !!Accounts.login('れいむ', 'abcd').ok;
    Game.setScene(new RankingScene()); T.step(30);
    return res;
  });
  assert(r.normal.saved && r.normal.rank === 1, `ふつうのプレイが記録されない: ${JSON.stringify(r.normal)}`);
  for (const k of ['cont', 'practice', 'keys', 'guest']) assert(!r[k].saved, `${k} のプレイが記録されてしまう`);
  assert(r.ranking.join() === 'まりさ:500000,れいむ:123450', `ランキングの順番: ${r.ranking}`);
  assert(r.badLogin && r.goodLogin, 'ログインの判定がおかしい');
});

test('キーの効果', async ({ page }) => {
  const r = await page.evaluate(() => {
    const res = {};
    const start = ch => { Game.setScene(new GameScene({ difficulty: 1, character: ch || PLAYER_IDS[0], stage: 0 })); T.step(5); return G; };
    // H・B
    Cheats.set('lives', true); Cheats.set('bombs', true);
    let g = start();
    T.step(3);
    res.hb = [g.lives, g.bombs, g.usedKeys];
    Cheats.set('lives', false); Cheats.set('bombs', false);
    // C：被弾しても残機が減らない
    Cheats.set('noLoss', true);
    g = start();
    const lives = g.lives;
    g.player.invuln = 0;
    g.player.hit(g);
    T.step(120);
    res.c = [g.misses, g.lives === lives];
    Cheats.set('noLoss', false);
    // R：1秒おきにボム（ボムは減らない）。自機ごとに確かめる
    Cheats.set('autoBomb', true);
    res.r = PLAYER_IDS.map(id => {
      g = start(id);
      const bombs = g.bombs;
      T.step(250);
      return g.player.extraBombs.length >= 1 && g.bombs === bombs;
    });
    Cheats.set('autoBomb', false);
    // S：2倍速、I：自機2倍速
    Cheats.set('speed', true); Cheats.set('playerSpeed', true);
    g = start();
    const f0 = g.frame, x0 = g.player.x;
    Input.debugHold.add('left'); T.step(1); Input.debugHold.delete('left');
    res.si = [g.frame - f0, Math.round(x0 - g.player.x)];
    Cheats.set('speed', false); Cheats.set('playerSpeed', false);
    // V：ゲーム中に入れるとボス戦へ
    g = start();
    T.step(600);
    Cheats.toggle('V');
    T.step(120);
    res.v = g.boss ? g.boss.id : null;
    res.vExpected = STAGES[0].bosses.filter(b => !b.mid).pop().id;
    Cheats.toggle('V');
    // D：パリピ
    Cheats.toggle('D'); T.step(3);
    res.d1 = Game.canvas.style.filter !== '';
    Cheats.toggle('D'); T.step(1);
    res.d2 = Game.canvas.style.filter === '';
    // F：すべて
    Cheats.toggle('F');
    res.f1 = Cheats.allOn();
    Cheats.toggle('F');
    res.f2 = !Cheats.anyOn();
    return res;
  });
  assert(r.hb[0] === 8 && r.hb[1] === 8 && r.hb[2], `H・B: ${r.hb}`);
  assert(r.c[0] === 1 && r.c[1], `C: ${r.c}`);
  assert(r.r.every(Boolean), `R: ${r.r}`);
  assert(r.si[0] === 2 && r.si[1] === 18, `S・I: ${r.si}`);
  assert(r.v === r.vExpected, `V: ${r.v}（予定 ${r.vExpected}）`);
  assert(r.d1 && r.d2, 'D: 画面の色が変わらない、または元に戻らない');
  assert(r.f1 && r.f2, 'F: すべてON / OFF にならない');
});

test('マウスはキー「M」のときだけ自機を動かせる', async ({ page }) => {
  const box = await page.evaluate(() => { const b = Game.canvas.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  const L = (lx, ly) => [box.x + lx * box.w / 640, box.y + ly * box.h / 480];
  const drag = async () => {
    await page.evaluate(() => { Game.setScene(new GameScene({ difficulty: 1, character: PLAYER_IDS[0], stage: 0 })); T.step(80); });
    const p0 = await page.evaluate(() => [G.player.x, G.player.y]);
    await page.mouse.move(...L(200, 400));
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(...L(200 - i * 6, 400 - i * 4)); await page.evaluate(() => T.step(1)); }
    await page.mouse.up();
    await page.evaluate(() => T.step(1));
    const p1 = await page.evaluate(() => [G.player.x, G.player.y]);
    return Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  };
  assert((await drag()) === 0, 'キーなしでマウスで自機が動いた');
  await page.evaluate(() => Cheats.toggle('M'));
  assert((await drag()) > 20, 'キー「M」でもマウスで自機が動かない');
  await page.evaluate(() => Cheats.toggle('M'));
});

test('1ファイル版が最新', async () => {
  const { build, out } = require('./build-single.js');
  assert(fs.existsSync(out) && fs.readFileSync(out, 'utf8') === build(), 'dist/hoshifuru.html が古い。node tools/build-single.js を実行してください');
}, { noPage: true });

test('自動操縦で全ステージをクリアできる', async ({ page }) => {
  // 最後の自機は Lunatic、ほかは Normal で通す
  const ids = await page.evaluate(() => PLAYER_IDS);
  for (const [ch, diff] of ids.map((id, i) => [id, i === ids.length - 1 ? 3 : 1])) {
    const r = await page.evaluate(([ch, diff]) => {
      Game.setScene(new GameScene({ difficulty: diff, character: ch, stage: 0, seed: 12345 }));
      let f = 0;
      while (Game.scene instanceof GameScene && f < 100000) {
        const s = Game.scene;
        s.cheat = true;
        Input.debugHold.add('shot');
        if (s.dialogue && s.frame % 8 === 0) Input.just.shot = true;
        const p = s.player, t = s.nearestTarget(p.x, p.y);
        if (t && p.state === 'normal') p.x += clamp(t.x - p.x, -4, 4);
        Game.update();
        if (++f % 600 === 0) Game.draw();
      }
      Input.debugHold.delete('shot');
      return { scene: Game.scene.constructor.name, frames: f };
    }, [ch, diff]);
    assert(r.scene === 'EndingScene', `${ch}（${['Easy', 'Normal', 'Hard', 'Lunatic'][diff]}）で最後まで行けない: ${r.scene}（${r.frames}フレーム）`);
  }
}, { full: true });

// ------------------------------------------------------------
//  実行
// ------------------------------------------------------------
(async () => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const list = TESTS.filter(t => (FULL || !t.full) && (!FILTER || t.name.includes(FILTER)));
  console.log(`テスト対象: ${path.relative(root, TARGET)}（${list.length}件）`);
  let failed = 0;
  for (const t of list) {
    const t0 = Date.now();
    let game = null;
    try {
      if (!t.noPage) game = await openGame(browser);
      await t.fn({ ...(game || {}), browser });
      if (game && game.errors.length) throw new Error(`エラーが出た:\n    ${game.errors.join('\n    ')}`);
      console.log(`  ✔ ${t.name}（${((Date.now() - t0) / 1000).toFixed(1)}秒）`);
    } catch (e) {
      failed++;
      console.log(`  ✘ ${t.name}\n    ${e.message}`);
    } finally {
      if (game) await game.context.close();
    }
  }
  await browser.close();
  console.log(failed ? `\n${failed}件 失敗しました` : '\nすべて成功しました');
  process.exit(failed ? 1 : 0);
})();
