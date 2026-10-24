'use strict';
// ============================================================
//  自動テスト：ブラウザ（Chromium）でゲームを実際に動かして確かめる
//
//  使い方:
//    node tools/test.js            ふつうのテスト（1〜2分）
//    node tools/test.js --full     自動操縦で全ステージを通しでプレイするテストも行う（数分）
//    node tools/test.js --dist     1ファイル版（dist/zashiki.html）を対象にする
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
const TARGET = DIST ? path.join(root, 'dist', 'zashiki.html') : path.join(root, 'index.html');
const GAME_URL = pathToFileURL(TARGET).href;

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
async function openGame(browser, contextOptions = {}, query = '', setup = null) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...contextOptions });
  if (setup) await setup(context);
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
  await page.goto(GAME_URL + query);
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
  assert(r.items.join() === 'start,extra,practice,music,manual,option', `タイトルの項目: ${r.items}`);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert(r.version === pkg.version, `GAME_VERSION（${r.version}）と package.json の version（${pkg.version}）がちがう`);
  assert(r.save === r.saveLatest, `保存データの形式が最新になっていない: ${r.save}`);
});

test('メニュー画面をひととおり表示できる', async ({ page }) => {
  const r = await page.evaluate(() => {
    const scenes = [
      () => new DifficultyScene('game'), () => new DifficultyScene('practice'), () => new CharacterScene('game', 1),
      () => new StageSelectScene(1, PLAYER_IDS[0]), () => new MusicRoomScene(), () => new ManualScene(), () => new OptionScene(),
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
    // ステージとボス（本編とエキストラ）
    if (STAGES.length > MAIN_STAGE_COUNT) out.push(`STAGES が ${STAGES.length} 面あり、MAIN_STAGE_COUNT（${MAIN_STAGE_COUNT}）より多い`);
    allStages().forEach(({ st, short: w }) => {
      song(st.bgm, w);
      if (typeof st.script !== 'function' || typeof st.boss !== 'function') out.push(`${w}: script か boss がない`);
      if (!st.bosses || !st.bosses.length) out.push(`${w}: bosses がない`);
      for (const b of st.bosses || []) {
        chara(b.id);
        // 名前が決まっているボスには読み仮名をつける（ボスの名前が出るときと会話で使う）
        const info = CHARA_INFO[b.id];
        if (info && !b.mid && info.name !== '？？？' && !info.kana) out.push(`${w} ${b.id}: 読み仮名（CHARA_INFO の kana）がない`);
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
    // テンポが途中で変わる曲（parts）：音が時刻の順に並び、曲の長さが小節ごとのテンポの合計になる
    for (const [id, def] of Object.entries(SONGS)) {
      if (!def.parts) continue;
      const c = compileSong(def);
      const tm = songParts(def, def.chords.length);
      if (c.events.some((e, i) => i && e.time < c.events[i - 1].time)) out.push(`曲 ${id}: 音が時刻の順に並んでいない`);
      const total = tm.barBpm.reduce((a, b) => a + 240 / b, 0);
      if (Math.abs(c.lengthSec - total) > 1e-6 || !(c.lengthSec > 0)) out.push(`曲 ${id}: 曲の長さがおかしい（${c.lengthSec}）`);
      if (def.parts.some(p => p.bar < 0 || p.bar >= def.chords.length || !DRUM_PATTERNS[p.drums] && p.drums)) out.push(`曲 ${id}: parts の小節かドラムがおかしい`);
    }
    // 会話の読み仮名は、登場したとき（最初の台詞）だけ出る。同じ名前のキャラクターは面が変わっても一度だけ
    const fakeGame = { charId: 'reimu', showBgmTitle() {} };
    const kanas = [];
    for (const lines of [STORY.stage5.reimu.before, STORY.stage6mid.reimu.before]) {
      const d = new Dialogue(lines, fakeGame);
      while (!d.done) { if (d.who && d.who.startsWith('yanari')) kanas.push(d.kana); d.next(); }
    }
    if (kanas[0] !== CHARA_INFO.yanari.kana || kanas.slice(1).some(k => k)) out.push(`会話の読み仮名が最初の台詞だけになっていない: ${JSON.stringify(kanas)}`);
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
    for (const { st } of allStages()) {
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

test('本編6面とエキストラステージのしくみ', async ({ page }) => {
  const r = await page.evaluate(() => {
    const out = {};
    const scene = () => Game.scene.constructor.name;
    const press = () => { Input.just.shot = true; T.step(2); };
    const run = (max = 8000) => { const g = Game.scene; let f = 0; while (Game.scene === g && f < max) { Game.update(); f++; } Game.draw(); return scene(); };
    // テスト用の小さな面（道中はすぐ終わり、ボスは3秒の攻撃が1つだけ。ボスの見た目は1面のボスを借りる）
    const bossId = STAGES[0].bosses.filter(bs => !bs.mid).pop().id;
    const mini = name => ({
      name, nameEn: name, bg: STAGES[0].bg, bgm: STAGES[0].bgm,
      bosses: [{ id: bossId, phases: [{ type: 'non', hp: 50, time: 3, *script() { for (;;) yield; } }] }],
      *script() { yield 30; },
      *boss(g) {
        const b = g.spawnStageBoss(bossId, { x: FIELD_W / 2, y: -50 });
        yield* b.moveTo(FIELD_W / 2, 100, 20);
        yield* g.fight(b, this.bosses[0].phases);
        yield* g.bossDown(b);
      },
    });
    out.real = { stages: STAGES.length, main: MAIN_STAGE_COUNT, extra: EXTRA_STAGES.length };
    // エキストラの面がないうちは、URL の ?stage=extra（startBossTest）は何もしない
    out.bossTestNoExtra = startBossTest({ stage: 'extra' });
    // プラクティス：最後の面（6面）は、面があれば始まり、まだなければ選べない
    Game.setScene(new StageSelectScene(1, PLAYER_IDS[0]));
    T.step(12);
    Game.scene.sel = MAIN_STAGE_COUNT - 1;
    press();
    out.practiceLast = scene() === (STAGES[MAIN_STAGE_COUNT - 1] ? 'GameScene' : 'StageSelectScene');
    // タイトル：エキストラスタートは選べない
    Game.setScene(new TitleScene('extra'));
    T.step(12);
    out.titleLocked = Game.scene.items[1].disabled;
    press();
    out.titleLockedScene = scene();
    // 6面までそろっていないうちは、いまある最後の面をクリアするとエンディングで、エキストラは解放しない
    out.lastClear = 'EndingScene';
    out.unlockedEarly = false;
    if (STAGES.length < MAIN_STAGE_COUNT) {
      Game.setScene(new GameScene({ difficulty: 1, character: PLAYER_IDS[0], stage: STAGES.length - 1 }));
      G.tasks.clear();
      G.tasks.add(G.stageClear());
      out.lastClear = run();
      out.unlockedEarly = Store.get('extraUnlocked', false);
    }

    // まだない面があれば仮に足して、解放の条件を確かめる
    while (STAGES.length < MAIN_STAGE_COUNT) STAGES.push(mini(`仮の${STAGES.length + 1}面`));
    const tryUnlock = (diff, mod) => {
      Store.remove('extraUnlocked');
      Game.setScene(new GameScene({ difficulty: diff, character: PLAYER_IDS[0], stage: MAIN_STAGE_COUNT - 1, practice: false }));
      if (mod) mod(G);
      G.unlockExtra();
      return Store.get('extraUnlocked', false);
    };
    out.cond = {
      easy: tryUnlock(0), normal: tryUnlock(1), lunatic: tryUnlock(3),
      continued: tryUnlock(1, g => { g.continues = 1; }), keys: tryUnlock(1, g => { g.usedKeys = true; }),
      practice: tryUnlock(1, g => { g.practice = true; }),
    };
    Store.remove('extraUnlocked');
    // 最後の面（6面）をクリア → エンディング → リザルトに「解放」と出る
    Game.setScene(new GameScene({ difficulty: 1, character: PLAYER_IDS[0], stage: MAIN_STAGE_COUNT - 1 }));
    const g6 = G;
    G.tasks.clear();
    G.tasks.add(G.stageClear());
    out.fullClear = run();
    out.reached = g6.stageIndex + 1;
    out.unlocked = Store.get('extraUnlocked', false);
    out.unlockedNow = g6.extraUnlockedNow;
    Game.setScene(new ResultScene(g6, 'clear'));
    T.step(5);
    // 解放ずみでも、エキストラの面がまだなければ選べない
    Game.setScene(new TitleScene('extra'));
    T.step(12);
    out.titleNoStage = Game.scene.items[1].disabled;

    // エキストラの面を足したつもりで、タイトル → キャラクター選択 → エキストラ → リザルト
    EXTRA_STAGES.push(mini('仮のエキストラ'));
    Game.setScene(new TitleScene('extra'));
    T.step(12);
    out.titleReady = !Game.scene.items[1].disabled;
    press();
    out.afterTitle = `${scene()}:${Game.scene.mode}`;
    T.step(12);
    press();
    const gx = G;
    out.extraGame = { scene: scene(), extra: gx.extra, diff: DIFF, label: gx.stageLabel, power: gx.power, hiKey: gx.hiKey };
    out.extraEnd = `${run()}:${Game.scene.kind}`;
    out.extraHi = Store.get(gx.hiKey, 0) > 0;
    // エキストラはコンティニューできない
    Game.setScene(new GameScene({ difficulty: EXTRA_DIFF, character: PLAYER_IDS[0], stage: 0, extra: true }));
    G.onOutOfLives();
    out.extraOut = `${scene()}:${Game.scene.kind}`;
    // ボスの攻撃を試す機能もエキストラに使える
    out.bossTestExtra = startBossTest({ stage: 'extra' }) && G.extra && DIFF === EXTRA_DIFF;
    // 管理者ページの一覧もエキストラを含めて作れる
    out.all = allStages().map(x => x.short).join(',');
    return out;
  });
  const want = {
    bossTestNoExtra: false, practiceLast: true, titleLocked: true, titleLockedScene: 'TitleScene',
    lastClear: 'EndingScene', unlockedEarly: false,
    fullClear: 'EndingScene', reached: 6, unlocked: true, unlockedNow: true, titleNoStage: true,
    titleReady: true, afterTitle: 'CharacterScene:extra', extraEnd: 'ResultScene:extra', extraHi: true,
    extraOut: 'ResultScene:gameover', bossTestExtra: true,
  };
  for (const [k, v] of Object.entries(want)) assert(r[k] === v, `${k} が ${JSON.stringify(r[k])}（予定 ${JSON.stringify(v)}）\n${JSON.stringify(r)}`);
  assert(r.real.main === 6 && r.real.stages <= 6, `本編の面の数: ${JSON.stringify(r.real)}`);
  const c = r.cond;
  assert(!c.easy && c.normal && c.lunatic && !c.continued && !c.keys && !c.practice, `解放の条件がおかしい: ${JSON.stringify(c)}`);
  const x = r.extraGame;
  assert(x.scene === 'GameScene' && x.extra && x.diff === 4 && x.label === 'Extra Stage' && x.power === 400 && x.hiKey.startsWith('hi_4_'), `エキストラの始まり方: ${JSON.stringify(x)}`);
  assert(r.all.endsWith(',5面,6面,Extra'), `面の一覧: ${r.all}`);
});

test('管理者ページ（PIN・キー・各ページ）', async ({ page }) => {
  await page.mouse.click(20, 12);
  await page.waitForSelector('#adminPin');
  // PIN は2段階。まちがいは1つ目・2つ目を合わせて3回でロック（まちがいのPINは、正しいPINの1けた目を変えたもの）
  const pins = await page.evaluate(() => ADMIN_PINS);
  assert(pins.join() === '114514,810', `PIN: ${pins}`);
  const wrong = pin => (pin[0] === '9' ? '0' : '9') + pin.slice(1);
  const title = () => page.$eval('.admin-title', e => e.textContent);
  const typePin = async v => { await page.focus('#adminPin'); await page.keyboard.type(v); };
  await typePin(wrong(pins[0]));
  await typePin(wrong(pins[0]));
  await typePin(pins[0]);
  assert((await title()).includes('2/2'), `1つ目が合っても2つ目にならない: ${await title()}`);
  await typePin(wrong(pins[1]));
  assert((await title()).includes('1/2'), `2つ目をまちがえても1つ目に戻らない: ${await title()}`);
  assert(await page.evaluate(() => document.getElementById('adminPin').disabled), 'PINを3回まちがえてもロックされない');
  await page.evaluate(() => { Store.remove('adminLock'); Admin.memLock = 0; });
  await page.waitForFunction(() => !document.getElementById('adminPin').disabled, null, { polling: 100, timeout: 3000 });
  await typePin(pins[0]);
  await page.waitForFunction(() => document.querySelector('.admin-title').textContent.includes('2/2'), null, { polling: 50, timeout: 3000 });
  await typePin(pins[1]);
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
  assert(menu.join() === 'データベース,キャラクター一覧,プログラム,（未実装）', `メニュー: ${menu}`);
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
  await page.click('.admin-back');
  await page.keyboard.press('Escape');
  assert(await page.evaluate(() => document.getElementById('adminOverlay').hidden && !Input.suspended), 'Escで管理者ページが閉じない');
});

test('ハイスコアの保存（キー・コンティニュー・プラクティスは保存しない）', async ({ page }) => {
  const r = await page.evaluate(() => {
    const play = (opts, score, setup) => {
      Game.setScene(new GameScene({ difficulty: 1, character: PLAYER_IDS[0], stage: 0, ...opts }));
      T.step(3);
      if (setup) setup(G);
      G.score = score;
      G.finish(opts.practice ? 'practice' : 'gameover');
      T.step(3);
      return [G.hiscoreSaved, Store.get(`hi_1_${PLAYER_IDS[0]}`, 0)];
    };
    const res = {};
    res.normal = play({}, 123450);
    res.cont = play({}, 999990, g => { g.continues = 1; });
    res.practice = play({ stage: 1, practice: true }, 999990);
    Cheats.set('lives', true);
    res.keys = play({}, 999990);
    Cheats.set('lives', false);
    res.lower = play({}, 1000);
    // アカウントの記録は残っていない（保存データの形式 2 で消した）
    res.oldData = ['accounts', 'currentUser', 'onlineSession', 'onlineMe', 'onlinePlayers'].filter(k => localStorage.getItem(Store.prefix + k) !== null);
    return res;
  });
  assert(r.normal[0] === true && r.normal[1] === 123450, `ふつうのプレイ: ${r.normal}`);
  for (const k of ['cont', 'practice', 'keys', 'lower']) assert(r[k][0] === false && r[k][1] === 123450, `${k}: ${r[k]}`);
  assert(!r.oldData.length, `アカウントの記録が残っている: ${r.oldData}`);
});

test('前のゲーム（東方星降夜）の記録は消さず、設定だけを写す', async ({ browser }) => {
  // 前のゲームは 'hoshifuru.'、いまのゲームは 'zashiki.' で保存する
  const { page, context, errors } = await openGame(browser, {}, '', ctx => ctx.addInitScript(() => {
    if (localStorage.getItem('hoshifuru.saveVersion') === null) {
      localStorage.setItem('hoshifuru.saveVersion', '2');
      localStorage.setItem('hoshifuru.bgmVol', '0.3');
      localStorage.setItem('hoshifuru.lives', '5');
      localStorage.setItem('hoshifuru.hi_1_reimu', '5000');
      localStorage.setItem('hoshifuru.extraUnlocked', 'true');
    }
  }));
  try {
    const r = await page.evaluate(() => ({
      prefix: Store.prefix, bgm: Store.get('bgmVol', null), lives: Settings.lives,
      hi: Store.get('hi_1_reimu', 0), extra: Store.get('extraUnlocked', false), version: Store.get('saveVersion', 0),
      oldHi: localStorage.getItem('hoshifuru.hi_1_reimu'), oldVol: localStorage.getItem('hoshifuru.bgmVol'),
    }));
    assert(r.prefix === 'zashiki.' && r.version === 3, `保存の頭か形式がおかしい: ${JSON.stringify(r)}`);
    assert(r.bgm === 0.3 && r.lives === 5, `設定が写っていない: ${JSON.stringify(r)}`);
    assert(r.hi === 0 && r.extra === false, `前のゲームの記録が写っている: ${JSON.stringify(r)}`);
    assert(r.oldHi === '5000' && r.oldVol === '0.3', `前のゲームの記録が消えた: ${JSON.stringify(r)}`);
    assert(!errors.length, errors.join('\n'));
  } finally { await context.close(); }
}, { noPage: true });

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
    // E：はじめからエキストラ（面があるときだけ遊べる。解放したことは保存しない）
    const realExtra = EXTRA_STAGES.length;
    EXTRA_STAGES.push({ name: '仮', nameEn: 'test', bg: STAGES[0].bg, bgm: STAGES[0].bgm, bosses: [], *script() {}, *boss() {} });
    res.e0 = extraPlayable();
    Cheats.toggle('E');
    res.e1 = extraPlayable();
    res.eSaved = Store.get('extraUnlocked', false);
    Cheats.toggle('E');
    res.e2 = extraPlayable();
    EXTRA_STAGES.length = realExtra;
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
  assert(!r.e0 && r.e1 && !r.e2 && !r.eSaved, `E: ${[r.e0, r.e1, r.e2, r.eSaved]}`);
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
  assert(fs.existsSync(out) && fs.readFileSync(out, 'utf8') === build(), 'dist/zashiki.html が古い。node tools/build-single.js を実行してください');
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
