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
  assert(r.items.join() === 'start,extra,practice,music,manual,option,feedback', `タイトルの項目: ${r.items}`);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert(r.version === pkg.version, `GAME_VERSION（${r.version}）と package.json の version（${pkg.version}）がちがう`);
  assert(r.save === r.saveLatest, `保存データの形式が最新になっていない: ${r.save}`);
});

test('メニュー画面をひととおり表示できる', async ({ page }) => {
  const r = await page.evaluate(() => {
    const scenes = [
      () => new DifficultyScene('game'), () => new DifficultyScene('practice'), () => new CharacterScene('game', 1),
      () => new StageSelectScene(1, PLAYER_IDS[0]), () => new MusicRoomScene(), () => new ManualScene(), () => new OptionScene(),
      () => new FeedbackScene(),
    ];
    window.open = () => null; // フィードバックの画面は Google フォームを開くので、テストでは開かない
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
    // 本編の面（プラクティス）とエキストラの面
    const runs = [...STAGES.map((st, i) => ({ st, i, extra: false })), ...EXTRA_STAGES.map((st, i) => ({ st, i, extra: true }))];
    for (const { st: stage, i: st, extra } of runs) {
      for (const [ch, bossOnly] of PLAYER_IDS.flatMap(id => [[id, false], [id, true]])) {
        Cheats.on.bossOnly = bossOnly;
        Game.setScene(extra
          ? new GameScene({ difficulty: EXTRA_DIFF, character: ch, stage: st, extra: true })
          : new GameScene({ difficulty: 1, character: ch, stage: st, practice: true }));
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
        const expected = stage.bosses.filter(bs => !(bossOnly && bs.mid) && DIFF >= (bs.minDiff || 0))
          .reduce((n, bs) => n + bs.phases.filter(ph => DIFF >= (ph.minDiff || 0)).length, 0);
        out.push({ st: extra ? 'Extra' : `${st + 1}面`, ch, bossOnly, end: Game.scene.constructor.name, frames: f, phases: seen.size, expected, kyou: g.kyou, holdFire: g.holdFire });
      }
    }
    Cheats.on.bossOnly = false;
    return out;
  });
  assert(r.some(x => x.st === 'Extra'), 'エキストラの面がない');
  for (const x of r) {
    const label = `${x.st} ${x.ch}${x.bossOnly ? '（ボス戦のみ）' : ''}`;
    assert(x.end === 'ResultScene', `${label}：最後まで進まなかった（${x.end}、${x.frames}フレーム）`);
    assert(x.phases === x.expected, `${label}：ボスの攻撃の数 ${x.phases}（予定 ${x.expected}）`);
    assert(x.kyou === null, `${label}：面が終わっても凶方が残っている`);
    assert(x.holdFire === false, `${label}：自機の弾を止めたまま終わった`);
  }
});

test('1面（2.14.0）：足の妖精は撃たない・中ボスは Hard から スペルカード・火の玉は10秒ごとに増える', async ({ page }) => {
  const r = await page.evaluate(() => {
    const out = {};
    // 道中のはじめ（足の妖精の列だけが出るところ）で、弾が1つも出ない
    Game.setScene(new GameScene({ difficulty: 3, character: PLAYER_IDS[0], stage: 0, practice: true }));
    G.cheat = true;
    let feet = new Set(), bullets = 0;
    for (let f = 0; f < 470; f++) {
      Game.update();
      for (const e of G.enemies) if (e.kind === 'foot') feet.add(e);
      bullets = Math.max(bullets, G.bullets.list.filter(b => b.alive).length);
    }
    out.feet = feet.size;
    out.footBullets = bullets;
    // Hard：中ボスがボスとして出て、通常の攻撃のあとにスペルカード。火の玉ははじめ1つ、10秒たつと2つ
    const run = diff => {
      Game.setScene(new GameScene({ difficulty: diff, character: PLAYER_IDS[0], stage: 0, practice: true }));
      const g = G;
      g.cheat = true;
      const res = { phases: [], fire: [], zako: false };
      let spellStart = -1;
      for (let f = 0; f < 30000 && Game.scene === g; f++) {
        if (g.dialogue && f % 6 === 0) Input.just.shot = true;
        const b = g.boss;
        if (g.enemies.some(e => e.kind === 'midboss1')) res.zako = true;
        if (b && b.id === 'nokiba') break;
        if (b && b.id === 'midboss1' && b.phase) {
          if (!res.phases.includes(b.phase.name || 'non')) res.phases.push(b.phase.name || 'non');
          if (b.phase.type === 'non') b.hp = 0;
          else {
            if (spellStart < 0) spellStart = f;
            const n = g.bullets.list.filter(x => x.alive && x.type === 'fireball').length;
            if (f - spellStart === 300 || f - spellStart === 1000) res.fire.push(n);
            if (f - spellStart === 1000) b.hp = 0;
          }
        }
        Game.update();
      }
      res.reachedBoss = !!(g.boss && g.boss.id === 'nokiba');
      return res;
    };
    out.hard = run(2);
    out.normal = run(1);
    // 1面ボスのスペルカード「鬼の視線」：レーザーの点滅（当たらない予告）は2秒
    startBossTest({ stage: 0, boss: 'nokiba', phase: 2, only: true });
    for (let f = 0; f < 400 && !G.lasers.length; f++) Game.update();
    out.glare = { name: G.boss && G.boss.phase && G.boss.phase.name, warn: G.lasers[0] && G.lasers[0].warn };
    return out;
  });
  assert(r.feet >= 16 && r.footBullets === 0, `1面の足の妖精が弾を撃った: ${JSON.stringify(r)}`);
  assert(r.hard.phases.join() === 'non,炎符「かきちぃー大炎上」' && r.hard.reachedBoss && !r.hard.zako, `Hard の中ボス: ${JSON.stringify(r.hard)}`);
  assert(r.hard.fire.join() === '1,2', `火の玉の数（はじめ1つ、10秒で2つ）: ${JSON.stringify(r.hard.fire)}`);
  assert(r.normal.phases.length === 0 && r.normal.zako && r.normal.reachedBoss, `Normal の中ボス（ザコのまま）: ${JSON.stringify(r.normal)}`);
  assert(r.glare.name === '瓦符「鬼の視線」' && r.glare.warn === 120, `鬼の視線: ${JSON.stringify(r.glare)}`);
});

test('コンティニューは3回まで・自機の弾は1.3倍太く・魔理沙の弾は1.5倍の威力（2.14.0）', async ({ page }) => {
  const r = await page.evaluate(() => {
    const out = {};
    Game.setScene(new GameScene({ difficulty: 1, character: PLAYER_IDS[0], stage: 0 }));
    const g = G;
    g.continues = 2;
    g.onOutOfLives();
    out.menuAt2 = !!g.continueMenu;
    Game.draw();
    g.continueMenu = null;
    g.continues = 3;
    g.onOutOfLives();
    out.menuAt3 = !!g.continueMenu;
    for (let f = 0; f < 600 && Game.scene === g; f++) Game.update();
    out.after3 = Game.scene.constructor.name;
    out.max = MAX_CONTINUES;
    // 自機の弾
    const shots = id => {
      Game.setScene(new GameScene({ difficulty: 1, character: id, stage: 0 }));
      const n0 = G.shots.length;
      G.player.shotFrame = 0;
      G.player.shoot(G);
      return G.shots.slice(n0).map(s => ({ kind: s.kind, dmg: Math.round(s.dmg * 100) / 100, r: Math.round(s.r * 100) / 100 }));
    };
    out.reimu = shots('reimu');
    out.marisa = shots('marisa');
    return out;
  });
  assert(r.max === 3 && r.menuAt2 && !r.menuAt3 && r.after3 === 'ResultScene', `コンティニューの上限: ${JSON.stringify(r)}`);
  assert(r.reimu.length && r.reimu.every(s => s.r === 7.8 && s.dmg === 1), `霊夢の弾: ${JSON.stringify(r.reimu)}`);
  assert(r.marisa.length && r.marisa.every(s => s.r === 7.8 && s.dmg === 1.8), `魔理沙の弾（1.2 の 1.5 倍）: ${JSON.stringify(r.marisa)}`);
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
        // 音声ファイルの曲は、BGM_FILES に音が入っていればよい（デコードは別のテストで確かめる）
        if (def.audio) { if (!(typeof BGM_FILES !== 'undefined' && BGM_FILES[def.audio] && BGM_FILES[def.audio].data)) out.push(`曲 ${id}: 音声 ${def.audio} が BGM_FILES にない`); continue; }
        try { compileSong(def); } catch (e) { out.push(`曲 ${id}: ${e.message}`); }
      }
    } finally { console.warn = warn; }
    for (const id of MUSIC_ROOM) song(id, 'MUSIC_ROOM');
    // 難易度で変わる曲（byDiff）の行き先がある
    for (const [id, def] of Object.entries(SONGS)) for (const [d, to] of Object.entries(def.byDiff || {})) if (!SONGS[to]) out.push(`曲 ${id}: 難易度 ${d} の曲 ${to} がない`);
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

test('ユーザーが書いた会話・エキストラのボスの名前と背景（2.13.0）', async ({ page }) => {
  const r = await page.evaluate(() => {
    const texts = arr => arr.filter(Array.isArray).map(l => `${l[0]}:${l[2]}`);
    return {
      name: CHARA_INFO.konjin.name, kana: CHARA_INFO.konjin.kana,
      exReimu: texts(STORY.extra.reimu.after), exMarisa: texts(STORY.extra.marisa.after), exMid: texts(STORY.extraMid.reimu.before),
      s2: texts(STORY.stage2.marisa.after), s3: texts(STORY.stage3.reimu.before), s4: texts(STORY.stage4.reimu.before),
      bg: (() => { const b = new CompassRealmBG(); return b.rubble instanceof DuskRubbleBG; })(),
    };
  });
  assert(r.name === '八重 神世羅' && r.kana === 'やえ かよら', `エキストラのボスの名前と読み: ${r.name}（${r.kana}）`);
  assert(r.exReimu.join('|') === [
    'konjin:人間のくせに、なかなかやるではないか……', 'reimu:気は済んだ？', 'konjin:済むものか。だが、筋を通すなら話は聞いてやる',
    'reimu:……方位除けの祈祷でいい？', 'konjin:供え物も付けろ', 'reimu:うちの神社に、そんな余裕ないわよ',
  ].join('|'), `エキストラの戦ったあと（霊夢）: ${r.exReimu}`);
  assert(r.exMarisa.join('|') === [
    'marisa:熱は収まったか？', 'konjin:祟るだけで許してやる', 'marisa:冗談だろ', 'konjin:冗談だ、今回は神として許そう', 'konjin:だが次はないぞ',
  ].join('|'), `エキストラの戦ったあと（魔理沙）: ${r.exMarisa}`);
  // エキストラの中ボスの戦う前（霊夢）。2.16.0 でユーザーが書きかえた（最後の行の誤字は直した）
  assert(r.exMid.join('|') === [
    'reimu:あんたまだいたのね', 'toganooEx:今すぐ去った方がいい', 'reimu:再建するつもりじゃないでしょうね',
    'toganooEx:違う！', 'toganooEx:私はお前と戦っている暇はないんだ！', 'reimu:その様子誰と戦っているのよ',
    'toganooEx:邪神、とでも言おうか...', 'reimu:馬鹿ねー私は巫女よ？', 'reimu:その邪神、鎮められないわけないでしょ',
  ].join('|'), `エキストラの中ボスの戦う前（霊夢）: ${r.exMid}`);
  assert(r.s2.includes('kuraishiro:そんなのどうでもいいわ、虫さえいれば私は幸せよ') && !r.s2.some(t => t.includes('全部食べちゃう')), `2面: ${r.s2}`);
  assert(r.s3.includes('reimu:そんなの見えないし、ますます怪しいわ') && !r.s3.includes('reimu:そんなの見えないわ。ますます怪しいわ'), `3面: ${r.s3}`);
  const i = r.s4.indexOf('toganoo:客人かい？誰かを呼んだ覚えはないんだけど');
  assert(i >= 0 && r.s4.slice(i, i + 4).join('|') === [
    'toganoo:客人かい？誰かを呼んだ覚えはないんだけど', 'reimu:この屋敷、やけに人里と似た雰囲気ね',
    'toganoo:当たり前よ、この屋敷はこの辺の古びた家を再生させてつくったものだからな', 'reimu:人の部屋を引っこ抜いて何のためにこんな屋敷を建てたのよ',
  ].join('|'), `4面: ${r.s4}`);
  assert(r.bg, 'エキストラの方位盤の異界より前の背景が、西日の人里と瓦礫（DuskRubbleBG）ではない');
});

test('エンディングのあとにエンドロールが流れ、リザルトへ進む（2.16.0）', async ({ page }) => {
  const r = await page.evaluate(() => {
    const out = {};
    out.roll = STAFF_ROLL.sections.map(sec => `${sec.role}:${sec.names.join('/')}`);
    out.thanks = STAFF_ROLL.thanks;
    Game.setScene(new GameScene({ difficulty: 1, character: PLAYER_IDS[0], stage: 0 }));
    const g = G;
    Game.setScene(new EndingScene(g));
    // エンディングのページを最後まで送る
    for (let f = 0; f < 3000 && Game.scene instanceof EndingScene; f++) { if (f % 40 === 39) Input.just.shot = true; Game.update(); }
    out.afterEnding = Game.scene.constructor.name;
    // Z を押しているあいだは速く流れる。止まったら Z でリザルト
    Input.debugHold.add('shot');
    let f = 0;
    for (; f < 4000 && !Game.scene.done; f++) Game.update();
    Input.debugHold.delete('shot');
    out.fastFrames = f;
    out.done = Game.scene.done;
    for (let k = 0; k < 70; k++) Game.update();
    Game.draw();
    Input.just.shot = true;
    Game.update();
    out.after = Game.scene.constructor.name;
    return out;
  });
  assert(r.roll.join('|') === [
    '制作:Claude', 'グラフィック:あるるちんちん/はるひ/Me', 'ＢＧＭ:たにゴリラ/はるひ', 'シナリオ:はるひ/Me',
    'システム:はるひ', '原案:はるひ/Me', '原作:東方Project',
  ].join('|') && r.thanks === '遊んでくれてありがとう', `エンドロールの内容: ${JSON.stringify(r)}`);
  assert(r.afterEnding === 'StaffRollScene', `エンディングのあとがエンドロールではない: ${r.afterEnding}`);
  assert(r.done && r.fastFrames < 700, `早送りで最後まで流れない: ${JSON.stringify(r)}`);
  assert(r.after === 'ResultScene', `エンドロールのあとがリザルトではない: ${r.after}`);
});

test('音声ファイルの曲をデコードしてループで鳴らせる', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const out = [];
    const ids = Object.keys(SONGS).filter(id => SONGS[id].audio);
    if (!ids.length) return out;
    Sound.unlock();
    for (const id of ids) {
      Sound.playBgm(id);
      const buf = await Sound.decodeAudio(SONGS[id].audio);
      if (!buf || !(buf.duration > 1)) { out.push(`曲 ${id}: 音声をデコードできない`); continue; }
      // ループ用に整えたもの：前後の無音が切れている
      const ch = buf.getChannelData(0), n = Math.floor(buf.sampleRate * 0.05);
      const quiet = arr => arr.every(v => Math.abs(v) < 0.003);
      if (quiet(Array.from(ch.subarray(0, n))) || quiet(Array.from(ch.subarray(ch.length - n)))) out.push(`曲 ${id}: ループの前後に無音が残っている`);
      await new Promise(res => setTimeout(res, 50));
      const s = Sound.song;
      if (!s || !s.src || !s.src.loop || Sound.songId !== id) out.push(`曲 ${id}: ループで鳴っていない`);
      Sound.stopBgm(0.05);
    }
    return out;
  });
  assert(!r.length, r.join('\n    '));
});

test('効果音（2.17.0）：もらった音 a〜o の割り当て・弱いザコは無音・6面のチャージ・6面は中ボスのあとすぐボス戦', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const out = {};
    // ユーザーの指定した割り当て（名前 → 音の文字）
    out.map = Object.fromEntries(Object.entries(SE_SAMPLE).map(([k, v]) => [k, v[0]]));
    out.boost = SE_SAMPLE_BOOST; // 2.19.1 でユーザーの指定「3倍したもの、２倍したものをすべて１．５倍に変更する」（2.17.1〜2.19.0 は 2、o・c・f は 3）
    out.boostBy = Object.fromEntries('abcdefghijkmno'.split('').map(k => [k, SE_SAMPLE_BOOST_BY[k] || SE_SAMPLE_BOOST]));
    // もらった音がすべてデコードでき、始まりに無音がない（鳴らしたときに遅れない）
    Sound.unlock();
    const want = Object.keys(SE_FILES).length;
    for (let i = 0; i < 200 && Object.keys(Sound.seBuf).length < want; i++) await new Promise(res => setTimeout(res, 25));
    out.decoded = Object.keys(Sound.seBuf).sort().join('');
    out.files = Object.keys(SE_FILES).sort().join('');
    out.lateStart = Object.entries(Sound.seBuf)
      .filter(([, b]) => !Array.from({ length: b.numberOfChannels }, (_, c) => b.getChannelData(c)).some(ch => Math.abs(ch[0]) > 0.002))
      .map(([k]) => k);
    // 鳴らした効果音を記録する
    const log = [], all = new Set();
    const se = Sound.se;
    Sound.se = function (name, opt) { log.push([G ? G.frame : 0, name]); all.add(name); return se.call(this, name, opt); };
    const names = () => [...new Set(log.map(x => x[1]))];
    const at = n => (log.find(x => x[1] === n) || [null])[0];
    // 弾の音：ふつうは「m」（fire）、se で選べる、silent は鳴らさない。弱いザコ（体力 18 より少ない）の弾は鳴らさない
    Game.setScene(new GameScene({ difficulty: 1, character: PLAYER_IDS[0], stage: 0, practice: true }));
    T.step(5);
    G.cheat = true;
    const shooter = (hp, extra = {}) => {
      log.length = 0;
      spawnEnemy({ x: 100, y: 100, hp, keep: true, drops: {}, ...extra, script: function* (e) { fire({ x: e.x, y: e.y, angle: 1, speed: 1 }); for (;;) yield; } });
      T.step(2);
      return names();
    };
    out.weak = shooter(10);
    out.moderate = shooter(30);
    out.forced = shooter(10, { quiet: false });
    log.length = 0;
    G.tasks.add(swarmStream(-1, 3)); // 4面などの、とても弱い妖精の大群
    T.step(60);
    out.swarm = names();
    log.length = 0;
    fire({ x: 50, y: 50, angle: 1, speed: 1 });
    fire({ x: 50, y: 50, angle: 1, speed: 1, se: 'needle' });
    fire({ x: 50, y: 50, angle: 1, speed: 1, silent: true });
    out.direct = names();
    log.length = 0;
    fireLaser({ x: 100, y: 0, angle: Math.PI / 2, warn: 10, dur: 10, sound: 'laserHand', warnSound: 'charge' });
    T.step(1);
    out.laserWarn = names();
    T.step(10);
    out.laserOn = names();
    // 手・柱のレーザーは「h」
    log.length = 0;
    laserFairy(100, 90);
    wallPillar(1);
    T.step(130);
    out.handPillar = names();
    // ボスの攻撃ごとに、鳴る音を確かめる（Lunatic。攻撃の番号は 1 から。自機は無敵）
    const atk = (boss, phase, frames, stage) => {
      startBossTest({ boss, phase, diff: 3, only: true, ...(stage ? { stage } : {}) });
      G.cheat = true;
      log.length = 0;
      T.step(frames, 30);
      return names();
    };
    out.atk = {
      '1面 通常1（鬼面 k・瓦 m）': [atk('nokiba', 1, 200), ['oni', 'fire']],
      '1面 鬼の視線（点滅 c・発射 m・鬼面 k）': [atk('nokiba', 2, 320), ['charge', 'fire', 'oni']],
      '1面 かきちぃー大炎上（火の玉 o）': [atk('midboss1', 2, 200), ['appear', 'fire']],
      '2面 トカゲの尻尾切り（しっぽ o）': [atk('kuraishiro', 6, 200), ['appear', 'fire']],
      '3面 中ボスの瞬間移動（o）': [atk('namesawaMask', 1, 200), ['appear', 'fire']],
      '3面 主人顔の一服（針 n）': [atk('namesawaMask', 2, 600), ['needle', 'fire']],
      '3面 通常1（現れる小弾 o）': [atk('namesawa', 1, 200), ['appear', 'fire']],
      '3面 通常3（弾を撃つ影 o）': [atk('namesawa', 5, 200), ['appear', 'fire']],
      '4面 通常1（ボスのレーザー f）': [atk('toganoo', 1, 200), ['laserBoss4', 'fire']],
      '4面 玄関から入れ（板 o）': [atk('toganoo', 4, 200), ['appear']],
      '4面 百間継ぎの建て増し（四角 g）': [atk('toganoo', 6, 200), ['summon']],
      '4面 家を支える者の意地（板 o）': [atk('toganoo', 9, 200), ['appear', 'fire']],
      '6面 通常1（手鞠 ピヨン）': [atk('zashiki', 1, 200), ['temari']],
      '6面 隠れ鬼（家 o・家の弾 m）': [atk('zashiki', 9, 200), ['appear', 'fire']],
    };
    // 6面 手鞠唄の数え歌：弾ける前にチャージ（c）、弾けるときは k。チャージのあいだに手鞠はゆっくり止まる
    startBossTest({ boss: 'zashiki', phase: 2, diff: 3, only: true });
    G.cheat = true;
    log.length = 0;
    let speedAtCharge = null, speedBeforeBurst = null;
    for (let f = 0; f < 800 && !log.some(x => x[1] === 'burst'); f++) {
      T.step(1, 30);
      const balls = G.bullets.list.filter(bl => bl.alive && bl.data === 'temari');
      const sp = balls.reduce((s, bl) => s + Math.hypot(bl.evx, bl.evy), 0) / Math.max(1, balls.length);
      if (speedAtCharge === null && log.some(x => x[1] === 'charge')) speedAtCharge = sp;
      if (speedAtCharge !== null && !log.some(x => x[1] === 'burst')) speedBeforeBurst = sp;
    }
    out.temari = { names: names(), charge: at('charge'), burst: at('burst'), speedAtCharge, speedBeforeBurst };
    // 6面 惹符：集めたあとにチャージ（c）、散らばるときは f（2.19.0 でユーザーの指定。2.17.0〜2.18.x は k）
    startBossTest({ boss: 'zashiki', phase: 6, diff: 3, only: true });
    G.cheat = true;
    log.length = 0;
    for (let f = 0; f < 800 && !log.some(x => x[1] === 'spread'); f++) T.step(1, 30);
    out.attract = { names: names(), charge: at('charge'), spread: at('spread'), burst: at('burst') };
    // エキストラ：栂尾が撃たれるとき、上に現れる黄色の球は o、その球が撃つと m、倒されると d
    startBossTest({ stage: 'extra', boss: 'toganooEx', phase: 2, only: true });
    G.cheat = true;
    T.step(160, 30);
    G.boss.hp = G.boss.maxHp * 0.29;
    log.length = 0;
    for (let f = 0; f < 400 && G.bossPhases; f++) T.step(1, 30);
    out.strike = log.map(x => x[1]).filter((n, i, a) => ['appear', 'fire', 'bossdie'].includes(n) && a.indexOf(n) === i);
    // 6面：中ボスを倒すと、すぐボス戦（中ボスのあとに道中の敵は出ない）
    Game.setScene(new GameScene({ difficulty: 1, character: PLAYER_IDS[0], stage: 5, practice: true }));
    const g = G;
    g.cheat = true;
    const spawn = window.spawnEnemy;
    let sawMid = false, midGone = null, bossAt = null, spawnedAfterMid = 0, f = 0;
    window.spawnEnemy = o => { if (midGone !== null) spawnedAfterMid++; return spawn(o); };
    while (Game.scene === g && f < 20000 && bossAt === null) {
      if (g.dialogue && f % 6 === 0) Input.just.shot = true;
      const b = g.boss;
      if (b && b.id === 'yanari6') sawMid = true;
      if (b && b.phase && !b.phase.survival && !b.untouchable && b.invincible <= 0) b.hp = 0;
      // 中ボスがいなくなった（逃げ終わると、同じフレームでボスに入れかわる）
      if (sawMid && midGone === null && !(g.boss && g.boss.id === 'yanari6')) midGone = f;
      if (midGone !== null && g.boss && g.boss.id === 'zashiki') bossAt = f;
      Game.update();
      f++;
    }
    window.spawnEnemy = spawn;
    out.stage6 = { sawMid, midGone, bossAt, spawnedAfterMid };
    out.tanUsed = all.has('tan'); // 前の弾の音「tan」は、もう名前では鳴らさない（デコード前の代わりだけ）
    Sound.se = se;
    return out;
  });
  const mapWant = {
    fire: 'm', needle: 'n', oni: 'k', burst: 'k', appear: 'o', charge: 'c', powerup: 'c', laserHand: 'h', laserBoss4: 'f',
    summon: 'g', bonus: 'a', spell: 'b', bossdie: 'd', extend: 'e', bomb: 'i', pichuun: 'j',
  };
  for (const [k, v] of Object.entries(mapWant)) assert(r.map[k] === v, `効果音 ${k} が「${r.map[k]}」（予定「${v}」）`);
  assert(r.boost === 1.5, `もらった音の大きさの倍率が ${r.boost}（予定 1.5。2.19.1 でユーザーの指定）`);
  const boostBad = Object.entries(r.boostBy).filter(([, v]) => v !== 1.5).map(([k, v]) => `${k}=${v}`);
  assert(!boostBad.length, `音ごとの倍率がちがう：${boostBad.join(' ')}（予定 すべて 1.5。2.19.1 でユーザーの指定）`);
  assert(r.decoded === r.files && r.files.length === 14, `デコードできない音がある: ${r.decoded}（予定 ${r.files}）`);
  assert(!r.lateStart.length, `始まりに無音が残っている音: ${r.lateStart}`);
  assert(!r.weak.includes('fire') && !r.swarm.includes('fire'), `弱いザコの弾が鳴る: ${r.weak} / ${r.swarm}`);
  assert(r.moderate.includes('fire') && r.forced.includes('fire'), `体力がほどほどのザコの弾が鳴らない: ${r.moderate} / ${r.forced}`);
  assert(r.direct.includes('fire') && r.direct.includes('needle') && r.direct.length === 2, `弾の音（se・silent）がちがう: ${r.direct}`);
  assert(r.laserWarn.join() === 'charge' && r.laserOn.includes('laserHand'), `レーザーの音がちがう: ${r.laserWarn} / ${r.laserOn}`);
  assert(r.handPillar.includes('laserHand') && !r.handPillar.includes('laser'), `手・柱のレーザーが「h」にならない: ${r.handPillar}`);
  for (const [label, [got, want]] of Object.entries(r.atk)) {
    assert(want.every(n => got.includes(n)), `${label}：鳴った音 ${got}（予定 ${want}）`);
  }
  assert(r.temari.charge !== null && r.temari.burst !== null && Math.abs(r.temari.burst - r.temari.charge - 60) <= 3,
    `手鞠唄の数え歌：チャージ（c）のあとに弾けない（k）: ${JSON.stringify(r.temari)}`);
  assert(r.temari.speedAtCharge > 1 && r.temari.speedBeforeBurst < r.temari.speedAtCharge * 0.1, `手鞠唄の数え歌：チャージのあいだに手鞠が止まらない: ${JSON.stringify(r.temari)}`);
  assert(r.attract.charge !== null && r.attract.spread !== null && r.attract.burst === null && Math.abs(r.attract.spread - r.attract.charge - 60) <= 3,
    `惹符：集めたあとにチャージ（c）して散らばらない（f）: ${JSON.stringify(r.attract)}`);
  assert(r.strike.join() === 'appear,fire,bossdie', `エキストラ：黄色の球の音の順番がちがう: ${r.strike}（予定 appear,fire,bossdie）`);
  assert(r.stage6.sawMid && r.stage6.bossAt !== null && r.stage6.bossAt - r.stage6.midGone <= 5 && r.stage6.spawnedAfterMid === 0,
    `6面：中ボスのあと、すぐボス戦にならない: ${JSON.stringify(r.stage6)}`);
  assert(!r.tanUsed, '前の弾の音「tan」を名前で鳴らしているところがある');
});

test('4〜6面とエキストラのボスの曲（2.18.0）：もらった曲を入りのあとループ・6面ボスはどの難易度も同じ曲', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const out = { diff: {} };
    // 6面ボスの曲は、すべての難易度で同じ（2.18.0 でユーザーの指定。前は Lunatic だけ別の曲）
    for (const diff of [0, 1, 2, 3]) {
      startBossTest({ boss: 'zashiki', diff });
      for (let i = 0; i < 5; i++) Game.update();
      out.diff[diff] = Sound.songId;
    }
    out.lunaticSong = 'boss6lunatic' in SONGS || ('boss6lunatic' in BGM_FILES);
    // 曲ごと：音声ファイルで、入り（はじめから流す）のあと loopStart〜loopEnd をくり返す
    Sound.unlock();
    out.songs = {};
    for (const id of ['boss4', 'boss5', 'boss6', 'bossEx']) {
      const def = SONGS[id], f = BGM_FILES[def.audio];
      const buf = await Sound.decodeAudio(def.audio);
      const il = buf && buf.introLoop;
      Sound.playBgm(id);
      await new Promise(res => setTimeout(res, 80));
      const src = Sound.song && Sound.song.src;
      out.songs[id] = {
        audio: def.audio, intro: !!f.intro, len: f.loopEnd - f.loopStart,
        loop: il && [+il.start.toFixed(3), +il.end.toFixed(3), +(il.end - il.start).toFixed(3)], dur: buf && +buf.duration.toFixed(3),
        playing: !!src && src.loop && Math.abs(src.loopStart - il.start) < 0.001 && Math.abs(src.loopEnd - il.end) < 0.001,
      };
      Sound.stopBgm(0.05);
    }
    out.musicRoom = MUSIC_ROOM.join();
    return out;
  });
  assert(Object.values(r.diff).every(id => id === 'boss6'), `6面ボスの曲が難易度で変わる: ${JSON.stringify(r.diff)}`);
  assert(!r.lunaticSong, 'Lunatic だけの6面ボスの曲が残っている');
  for (const [id, s] of Object.entries(r.songs)) {
    assert(s.audio === id && s.intro, `${id}：入りのある音声ファイルの曲ではない: ${JSON.stringify(s)}`);
    assert(s.loop && s.loop[0] > 1 && Math.abs(s.loop[2] - s.len) < 0.01 && Math.abs(s.loop[1] - s.dur) < 0.01, `${id}：ループの範囲がおかしい: ${JSON.stringify(s)}`);
    assert(s.playing, `${id}：入りのあとループするように鳴っていない: ${JSON.stringify(s)}`);
  }
  assert(!r.musicRoom.includes('boss6lunatic') && r.musicRoom.includes('bossEx'), `ミュージックルーム: ${r.musicRoom}`);
});

test('道中の曲（2.18.1）：ループのあいだに小さくならない（もとの音声のフェードアウトはループに入れないか打ち消す）', async ({ page }) => {
  const r = await page.evaluate(async () => {
    Sound.unlock();
    const out = {};
    for (let n = 1; n <= 6; n++) {
      const id = `stage${n}`, def = SONGS[id], f = BGM_FILES[def.audio];
      const buf = await Sound.decodeAudio(def.audio);
      const sr = buf.sampleRate, il = buf.introLoop || { start: 0, end: buf.duration };
      const s = Math.round(il.start * sr), e = Math.round(il.end * sr);
      const chs = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
      // 区間の音の大きさ（dB。ループの中の秒）
      const db = (a, b) => {
        let q = 0;
        for (let i = s + Math.round(a * sr); i < s + Math.round(b * sr); i++) for (const ch of chs) q += ch[i] * ch[i];
        return 10 * Math.log10(q / ((b - a) * sr * chs.length) + 1e-12);
      };
      const len = (e - s) / sr;
      const all = db(0, len);
      out[id] = { fade: f.fadeOut || null, intro: !!f.intro, len: +len.toFixed(2),
        first: +(db(0, 1) - all).toFixed(1), last: +(db(len - 2, len) - all).toFixed(1), lastQ: +(db(len - 0.5, len) - all).toFixed(1) };
    }
    return out;
  });
  for (const [id, s] of Object.entries(r)) {
    // 終わりの 2 秒・最後の 0.5 秒・始まりの 1 秒が、ループ全体より大きく下がらない（2.18.0 までの1面は終わりの2秒が -15dB ほど）
    assert(s.last > -3 && s.lastQ > -6 && s.first > -3, `${id}：ループの終わりか始まりで小さくなる: ${JSON.stringify(s)}`);
  }
  // フェードアウトの入っていた1面・5面は、打ち消してループする。6面は小さいはじめと終わりをループに入れない
  for (const id of ['stage1', 'stage5']) assert(r[id].intro && r[id].fade, `${id}：フェードアウトを打ち消していない: ${JSON.stringify(r[id])}`);
  assert(r.stage6.intro, `stage6：入りのあとループしていない: ${JSON.stringify(r.stage6)}`);
});

test('2.19.0：タイトル・BGM と効果音の大きさ・グレイズの音・攻撃ごとの音・追尾弾をなくした攻撃', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const out = {};
    // タイトル（ユーザーの指定「東方座神鄭」。「鄭」は「邸」の変換ちがいと読んだ）
    out.title = GAME_INFO.title;
    out.docTitle = document.title;
    // BGM は効果音以下：ならした曲の大きさ（RMS 0.15）× BGM の倍率 ≦ 弾の音「m」のいちばん大きいところ（-14dB にそろえた音 × 大きさ × 倍率 × 効果音のバス 0.9）
    out.bgm = 0.15 * BGM_BUS_LEVEL;
    out.fire = SE_SAMPLE.fire[1] * (SE_SAMPLE_BOOST_BY.m || SE_SAMPLE_BOOST) * Math.pow(10, -14 / 20) * 0.9;
    // グレイズの音：アイテムの「カッ」の 0.8 倍。重なると大きくなる（2倍まで）
    Sound.unlock();
    const gains = [];
    const cg = Sound.ctx.createGain.bind(Sound.ctx);
    Sound.ctx.createGain = () => { const g = cg(); gains.push(g); return g; };
    const level = n => { gains.length = 0; Sound.grazeN = n; Sound.playGraze(Sound.ctx.currentTime + 0.01); return +gains[0].gain.value.toFixed(3); };
    out.graze = [level(1), level(2), level(3), level(10)];
    Sound.ctx.createGain = cg;
    Sound.grazeN = 0;
    Sound.se('graze'); Sound.se('graze'); Sound.se('graze');
    out.grazeCount = Sound.grazeN;
    Sound.pending.clear(); Sound.grazeN = 0;
    out.oldGraze = 'graze' in SE_DEFS;
    // 攻撃ごとの音：鳴らした効果音を記録する
    const log = [];
    const se = Sound.se;
    Sound.se = function (name, opt) { log.push([G ? G.frame : 0, name]); return se.call(this, name, opt); };
    const run = (id, name, diff, frames, each) => {
      const meta = allStages().flatMap(({ st }) => st.bosses).find(x => x.id === id);
      const k = meta.phases.filter(ph => diff >= (ph.minDiff || 0)).findIndex(ph => ph.name === name) + 1;
      startBossTest({ boss: id, phase: k, diff, only: true });
      G.cheat = true;
      log.length = 0;
      for (let f = 0; f < frames; f++) { Game.update(); if (each) each(f); }
      return log.map(x => x[1]);
    };
    // 2面「軒下の誘蛾灯」：弾ける前に「k」、弾けたときの黄色の円は Hard 4・Lunatic 5
    const ringOrig = window.fireRing;
    for (const diff of [2, 3]) {
      // 弾けたときに灯りの位置から撃つ黄色のリング弾を数える（最初に弾けたときだけ）
      let rings = 0, firstAt = -1;
      window.fireRing = o => {
        if (o.type === 'small' && o.color === 'yellow' && o.x === FIELD_W / 2 && o.y === 210 && (firstAt < 0 || firstAt === G.frame)) { firstAt = G.frame; rings++; }
        return ringOrig(o);
      };
      const names = run('kuraishiro', '灯符「軒下の誘蛾灯」', diff, 420);
      const burstAt = (log.find(x => x[1] === 'burst') || [-1])[0];
      out['yuga' + diff] = { rings, kBefore: burstAt > 0 && burstAt < firstAt, kira: names.includes('kira') };
    }
    window.fireRing = ringOrig;
    // 3面「勝手口からお暇」：移動するたびにチャージ（c）してから撃つ
    out.katte = run('namesawa', '逃符「勝手口からお暇」', 1, 600).filter(n => n === 'charge').length;
    // 6面「誰もが振り向く福の神」：チャージは c、弾が広がるときは f（spread）
    const fuku = run('zashiki', '惹符「誰もが振り向く福の神」', 1, 600);
    out.fuku = { charge: fuku.includes('charge'), spread: fuku.includes('spread'), burst: fuku.includes('burst'), f: SE_SAMPLE.spread[0] };
    Sound.se = se;
    // 追尾弾（自機狙いの弾）を削除した攻撃：台本に自機狙い（aim・aimAt）がなく、全方位弾かワインダーがある
    const phaseOf = (id, name) => allStages().flatMap(({ st }) => st.bosses).find(x => x.id === id).phases.find(ph => ph.name === name);
    const nonOf = (id, n, diff = 3) => allStages().flatMap(({ st }) => st.bosses).find(x => x.id === id).phases.filter(ph => ph.type === 'non' && diff >= (ph.minDiff || 0))[n - 1];
    const noAim = {
      'トカゲの尻尾切り': phaseOf('kuraishiro', '尾符「トカゲの尻尾切り」').script.toString() + cutTail.toString(),
      '3面の通常1': nonOf('namesawa', 1).script.toString(),
      '百鬼夜行の先頭': phaseOf('namesawa', '総大将「百鬼夜行の先頭」').script.toString(),
      '大黒柱の屋台骨': phaseOf('toganoo', '柱符「大黒柱の屋台骨」').script.toString(),
      '家を支える者の意地': phaseOf('toganoo', '家符「家を支える者の意地」').script.toString(),
      '天井裏の大行進の前の通常': nonOf('yanari', 3).script.toString(),
      '天井裏の大行進の後の通常': nonOf('yanari', 4).script.toString(),
      '6面の最初の通常': nonOf('zashiki', 1).script.toString(),
      '足音の次の通常': nonOf('zashiki', 3).script.toString(),
      '座敷童子のいる家': phaseOf('zashiki', '家符「座敷童子のいる家」').script.toString(),
      '艮の鬼門封じ': phaseOf('konjin', '鬼門「艮の鬼門封じ」').script.toString(),
      '金神の遊行の次の通常': nonOf('konjin', 3).script.toString(),
      '八将神の行列': phaseOf('konjin', '遊符「八将神の行列」').script.toString(),
    };
    out.aimLeft = Object.entries(noAim).filter(([, src]) => /\baim\(\)|aimAt\(/.test(src)).map(([k]) => k);
    out.noOmni = Object.entries(noAim).filter(([, src]) => !/omniWinder|omniRings|fireRing/.test(src)).map(([k]) => k);
    // 「全方位弾やワインダーを追加」した攻撃（追尾弾はそのまま）
    const addOmni = {
      '屋根の上から失礼': phaseOf('nokiba', '屋符「屋根の上から失礼」'), '湧き放題の天井裏': phaseOf('kuraishiro', '虫符「湧き放題の天井裏」'),
      '表札の掛け替え': phaseOf('namesawa', '札符「表札の掛け替え」'), '玄関から入れ': phaseOf('toganoo', '戸符「玄関から入れ」'),
      '座敷わらしの足音': phaseOf('zashiki', '福符「座敷わらしの足音」'), '去りゆく家の没落': phaseOf('zashiki', '傾符「去りゆく家の没落」'),
    };
    out.noOmni2 = Object.entries(addOmni).filter(([, ph]) => !/omniWinder|omniRings|ways/.test(ph.script.toString())).map(([k]) => k);
    // 2面の通常3（湧き放題の次）：円に広がったあと、自機を追わない
    out.non3Aim = /aimAt\(/.test(nonOf('kuraishiro', 3).script.toString());
    // 表札の掛け替えは全方位（自機の向きで撃たない）
    out.hyosatsuAim = /\baim\(\)/.test(phaseOf('namesawa', '札符「表札の掛け替え」').script.toString());
    return out;
  });
  assert(r.title === '東方座神邸' && r.docTitle === '東方座神邸', `タイトル: ${JSON.stringify([r.title, r.docTitle])}`);
  assert(r.bgm <= r.fire, `BGM（${r.bgm.toFixed(4)}）が弾の音「m」（${r.fire.toFixed(4)}）より大きい`);
  assert(JSON.stringify(r.graze) === JSON.stringify([0.8, 1.04, 1.28, 1.6]) && r.grazeCount === 3 && !r.oldGraze, `グレイズの音: ${JSON.stringify(r)}`);
  assert(r.yuga2.rings === 4 && r.yuga3.rings === 5 && r.yuga2.kBefore && r.yuga3.kBefore && !r.yuga3.kira, `誘蛾灯: ${JSON.stringify([r.yuga2, r.yuga3])}`);
  assert(r.katte >= 2, `勝手口からお暇：移動のたびのチャージが ${r.katte} 回`);
  assert(r.fuku.charge && r.fuku.spread && !r.fuku.burst && r.fuku.f === 'f', `福の神の音: ${JSON.stringify(r.fuku)}`);
  assert(!r.aimLeft.length, `自機狙いが残っている: ${r.aimLeft.join('・')}`);
  assert(!r.noOmni.length && !r.noOmni2.length, `全方位弾・ワインダーがない: ${[...r.noOmni, ...r.noOmni2].join('・')}`);
  assert(!r.non3Aim && !r.hyosatsuAim, `2面の通常3か表札の掛け替えが自機を狙う: ${JSON.stringify(r)}`);
});

test('弾のスプライト（試験用。2.19.0）：オプションの「弾の見た目」で img/bullets.png の絵に切りかわる', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const out = {};
    for (let i = 0; i < 200 && !Images.get('bullets'); i++) await new Promise(res => setTimeout(res, 25));
    const img = Images.get('bullets');
    out.loaded = !!img;
    // 画像の大きさが BULLET_SHEET の並びと合っている（行：弾の形、列：色）
    const sizes = BULLET_SHEET.types.map(t => BTYPES[t].size * SPR);
    out.want = [Math.max(...sizes) * BULLET_SHEET.colors.length, sizes.reduce((a, b) => a + b, 0)];
    out.got = img ? [img.naturalWidth, img.naturalHeight] : null;
    // オプション：弾の見た目を Z で切りかえると保存される
    Settings.bulletSprites = false;
    Game.setScene(new OptionScene());
    T.step(5);
    Game.scene.sel = 3;
    Input.just.shot = true;
    T.step(2);
    out.toggled = Settings.bulletSprites;
    out.saved = Store.get('bulletSprites', false);
    // スプライトのときは画像から切り出した絵、標準のときはコードの絵。画像にない弾（瓦など）はいつもコードの絵
    Settings.bulletSprites = false;
    const off = getBulletSprite('ball', 'red'), tileOff = getBulletSprite('tile', 'blue');
    Settings.bulletSprites = true;
    const on = getBulletSprite('ball', 'red'), tileOn = getBulletSprite('tile', 'blue');
    out.differs = off !== on && on.width === off.width;
    out.tileSame = tileOff === tileOn;
    out.sheetKey = spriteCache.has('sheet:ball:red');
    // 撃った弾も切りかわる
    Game.setScene(new GameScene({ difficulty: 1, character: PLAYER_IDS[0], stage: 0, practice: true }));
    T.step(3);
    out.bulletUsesSheet = fire({ x: 100, y: 100, angle: 1, speed: 1, type: 'rice', color: 'blue', silent: true }).sprite === spriteCache.get('sheet:rice:blue');
    Settings.bulletSprites = false;
    Store.remove('bulletSprites');
    return out;
  });
  assert(r.loaded, 'img/bullets.png が読めない');
  assert(JSON.stringify(r.got) === JSON.stringify(r.want), `img/bullets.png の大きさ ${JSON.stringify(r.got)}（並びから ${JSON.stringify(r.want)}）`);
  assert(r.toggled && r.saved, `オプションで切りかわらない: ${JSON.stringify(r)}`);
  assert(r.differs && r.tileSame && r.sheetKey && r.bulletUsesSheet, `弾の絵が切りかわらない: ${JSON.stringify(r)}`);
});

test('2.19.1：重くて処理が止まっても曲の音が抜けない（MML の曲を1秒先まで予約）・効果音の連打の間隔は実際の時間で測る', async ({ page }) => {
  const r = await page.evaluate(() => {
    const out = {};
    Sound.unlock();
    // MML の曲（1〜3面のボス・タイトル・エキストラの道中）は、いまの時刻から BGM_LOOKAHEAD 秒先までの音を予約する
    const times = [];
    const pi = window.playInstrument;
    window.playInstrument = (S, inst, midi, t, ...rest) => { times.push(t); return pi(S, inst, midi, t, ...rest); };
    Sound.stopBgm(0);
    Sound.playBgm('boss1');
    Sound.schedule();
    window.playInstrument = pi;
    out.lookahead = BGM_LOOKAHEAD;
    out.ahead = times.length ? +(Math.max(...times) - Sound.ctx.currentTime).toFixed(2) : -1;
    Sound.stopBgm(0);
    // 効果音の連打の間隔：音の時計ではなく実際の時間（performance.now）
    out.gapReal = /performance\.now\(\)/.test(Sound.flush.toString()) && !/t - \(this\.lastPlayed/.test(Sound.flush.toString());
    return out;
  });
  assert(r.lookahead >= 1 && r.ahead >= 0.85, `MML の曲の予約が短い（${r.ahead} 秒先まで。予定 ${r.lookahead} 秒）`);
  assert(r.gapReal, '効果音の連打の間隔を、実際の時間で測っていない');
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
    // 本物のエキストラの面は、しくみを確かめるあいだ外しておく（最後に戻す）
    const realExtra = EXTRA_STAGES.splice(0);
    // 2.19.0 からエキストラははじめから遊べる（EXTRA_UNLOCK.open）。解放の条件のしくみは、open を切って確かめる（最後に戻す）
    const openWas = EXTRA_UNLOCK.open;
    EXTRA_UNLOCK.open = false;
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
    // はじめから遊べる（2.19.0）：解放していなくてもタイトルで選べ、6面をクリアしても「遊べるようになりました」は出ない
    EXTRA_UNLOCK.open = openWas;
    Store.remove('extraUnlocked');
    Game.setScene(new TitleScene('extra'));
    T.step(12);
    out.openTitle = !Game.scene.items[1].disabled;
    Game.setScene(new GameScene({ difficulty: 1, character: PLAYER_IDS[0], stage: MAIN_STAGE_COUNT - 1 }));
    out.openNotice = G.unlockExtra() || G.extraUnlockedNow;
    out.openFlag = EXTRA_UNLOCK.open;
    EXTRA_STAGES.splice(0, EXTRA_STAGES.length, ...realExtra);
    return out;
  });
  const want = {
    bossTestNoExtra: false, practiceLast: true, titleLocked: true, titleLockedScene: 'TitleScene',
    lastClear: 'EndingScene', unlockedEarly: false,
    fullClear: 'EndingScene', reached: 6, unlocked: true, unlockedNow: true, titleNoStage: true,
    titleReady: true, afterTitle: 'CharacterScene:extra', extraEnd: 'ResultScene:extra', extraHi: true,
    extraOut: 'ResultScene:gameover', bossTestExtra: true,
    openFlag: true, openTitle: true, openNotice: false,
  };
  for (const [k, v] of Object.entries(want)) assert(r[k] === v, `${k} が ${JSON.stringify(r[k])}（予定 ${JSON.stringify(v)}）\n${JSON.stringify(r)}`);
  assert(r.real.main === 6 && r.real.stages <= 6, `本編の面の数: ${JSON.stringify(r.real)}`);
  const c = r.cond;
  assert(!c.easy && c.normal && c.lunatic && !c.continued && !c.keys && !c.practice, `解放の条件がおかしい: ${JSON.stringify(c)}`);
  const x = r.extraGame;
  assert(x.scene === 'GameScene' && x.extra && x.diff === 4 && x.label === 'Extra Stage' && x.power === 400 && x.hiKey.startsWith('hi_4_'), `エキストラの始まり方: ${JSON.stringify(x)}`);
  assert(r.all.endsWith(',5面,6面,Extra'), `面の一覧: ${r.all}`);
});

test('霊夢の誘導弾が目標のまわりを回り続けない', async ({ page }) => {
  // 2.8.0 までは小回りが利かず、目標のすぐ横を通った誘導弾が、そのまわりを何秒も回り続けていた
  const r = await page.evaluate(() => {
    Game.setScene(new GameScene({ difficulty: 1, character: 'reimu', stage: 0, practice: true }));
    const g = G;
    g.tasks.clear(); // 道中は止めておく
    g.cheat = true;
    // 目標：画面の中央にいる、ボスと同じ大きさ（r 22）の倒れない敵（6面で座敷のまわりを回っていたときと同じ形）
    const e = spawnEnemy({ x: FIELD_W / 2, y: 120, hp: 1e9, r: 22, keep: true, drops: {}, script: function* () { for (;;) yield; } });
    // 目標から 50〜60px 離れたところを、目標のまわりを回る向き（右回り・左回り）に飛ぶ誘導弾
    for (let i = 0; i < 24; i++) {
      const a = (i / 12) * TAU, d = 50 + (i % 3) * 5, dir = i < 12 ? 1 : -1;
      const s = new PShot('homing', e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, Math.cos(a + dir * Math.PI / 2) * 11, Math.sin(a + dir * Math.PI / 2) * 11, 0);
      s.target = e;
      g.shots.push(s);
    }
    let maxAge = 0;
    for (let f = 0; f < 300; f++) {
      Game.update();
      for (const s of g.shots) if (s.kind === 'homing') maxAge = Math.max(maxAge, s.frame);
    }
    return { maxAge, left: g.shots.filter(s => s.kind === 'homing').length };
  });
  assert(r.left === 0 && r.maxAge < 150, `誘導弾が回り続けている（いちばん長く残った弾 ${r.maxAge} フレーム、残り ${r.left} 発）`);
});

test('エキストラの中ボス（栂尾）は、体力が30%を切ると金神の弾で倒される', async ({ page }) => {
  const r = await page.evaluate(() => {
    // 家符（中ボスの2つ目の攻撃）だけを試す。自機は無敵
    startBossTest({ stage: 'extra', boss: 'toganooEx', phase: 2, only: true });
    const g = G;
    g.cheat = true;
    T.step(160);
    const b = g.boss, out = { name: b.phase && b.phase.name };
    // 体力が 31% のあいだは、金神の弾は来ない
    b.hp = b.maxHp * 0.31;
    T.step(60);
    out.beforeLow = { struck: !!b.struck, shots: g.enemies.filter(e => e.kind === 'konjinShot').length };
    // 29% にすると、金神の弾が飛んできて倒される（自機には当たらず、自機の弾も効かない）。
    // そのあいだ自機は撃てず（撃つキーを押していても）、画面の敵の弾も消える
    b.hp = b.maxHp * 0.29;
    let sawShot = false, shotHits = true, f = 0, playerShots = 0, enemyBullets = 0, holding = true;
    Input.debugHold.add('shot');
    while (g.bossPhases && f < 400) {
      Game.update(); f++;
      if (f >= 2) {
        playerShots += g.shots.length;
        enemyBullets += g.bullets.list.filter(bl => bl.alive).length;
        holding = holding && g.holdFire && !g.canShoot();
      }
      for (const e of g.enemies) if (e.kind === 'konjinShot') { sawShot = true; shotHits = shotHits && e.noBody && e.untouchable; }
    }
    Input.debugHold.delete('shot');
    out.after = { struck: !!b.struck, sawShot, safe: shotHits, ended: !g.bossPhases, frames: f, hp: b.hp, playerShots, enemyBullets, holding };
    return out;
  });
  assert(r.name === '家符「家を支える者の意地」', `中ボスの攻撃がちがう: ${JSON.stringify(r)}`);
  assert(!r.beforeLow.struck && r.beforeLow.shots === 0, `体力が 30% より多いのに金神の弾が来た: ${JSON.stringify(r)}`);
  assert(r.after.struck && r.after.sawShot && r.after.safe && r.after.ended && r.after.hp <= 0, `金神の弾で倒されない: ${JSON.stringify(r)}`);
  assert(r.after.holding && r.after.playerShots === 0, `金神の弾が飛んでいるあいだに自機が撃てる: ${JSON.stringify(r)}`);
  assert(r.after.enemyBullets === 0, `金神の弾が飛んでいるあいだに敵の弾が残っている: ${JSON.stringify(r)}`);
});

test('エキストラの方違え（凶方へ動くと祟りがたまる）', async ({ page }) => {
  const r = await page.evaluate(() => {
    // 金神の「方違え知らず」で、凶方へ動く／反対へ動く／動かない
    const katatagae = KONJIN_PHASES.findIndex(ph => ph.name === '祟符「方違え知らず」') + 1;
    const run = sign => {
      startBossTest({ stage: 'extra', boss: 'konjin', phase: katatagae, only: true });
      G.cheat = true;
      T.step(120);
      let maxM = 0, n = 0;
      const seen = new Set(G.bullets.list);
      for (let i = 0; i < 240; i++) {
        const k = G.kyou, d = KYOU_DIRS[k.cur ?? 0], p = G.player;
        const s = sign * (Math.floor(i / 60) % 2 ? -1 : 1); // 画面の中で行ったり来たり
        p.x = clamp(p.x + d.x * 2.5 * s, 20, FIELD_W - 20);
        p.y = clamp(p.y + d.y * 2.5 * s, 120, FIELD_H - 20);
        Game.update();
        maxM = Math.max(maxM, G.kyou.meter);
        for (const bl of G.bullets.list) if (!seen.has(bl)) { seen.add(bl); n++; }
      }
      return { maxM, n };
    };
    const still = (() => {
      startBossTest({ stage: 'extra', boss: 'konjin', phase: katatagae, only: true });
      G.cheat = true;
      T.step(360);
      return G.kyou.meter;
    })();
    // 四方塞がり（耐久スペル）では、どこへ動いても祟りがたまる
    const all = (() => {
      const n = KONJIN_PHASES.findIndex(ph => (ph.name || '').includes('四方塞がり')) + 1;
      startBossTest({ stage: 'extra', boss: 'konjin', phase: n, only: true });
      G.cheat = true;
      T.step(100);
      let m = 0;
      for (let i = 0; i < 160; i++) { G.player.x = 100 + (i % 80) * 2; Game.update(); m = Math.max(m, G.kyou.meter); }
      return { cur: G.kyou.cur, m };
    })();
    // 金神のいる方角（'boss'）は、自機から見たボスの向き
    const dirs = [dirIndexOf(-Math.PI / 2), dirIndexOf(0), dirIndexOf(Math.PI / 2), dirIndexOf(Math.PI), dirIndexOf(-Math.PI / 4)];
    return { toward: run(1), still, all, dirs };
  });
  assert(r.toward.maxM > 0.4, `凶方へ動いても祟りがたまらない: ${JSON.stringify(r)}`);
  assert(r.still === 0, `動かないのに祟りがたまった: ${JSON.stringify(r)}`);
  assert(r.all.cur === -1 && r.all.m > 0.4, `四方塞がりで祟りがたまらない: ${JSON.stringify(r)}`);
  assert(r.dirs.join() === '0,2,4,6,1', `方角の番号がおかしい: ${r.dirs}`);
});

test('フィードバック（タイトルで選ぶと Google フォームを新しいタブで開く。入力欄はない）', async ({ page }) => {
  // 開いたリンクは window.open を差しかえて受け取る（開けたときは、開いたページのかわりのものを返す）
  const pick = () => page.evaluate(() => { Game.setScene(new TitleScene('feedback')); T.step(20); Input.just.shot = true; T.step(2); });
  await page.evaluate(() => {
    window.__opened = [];
    window.__win = null;
    window.__blocked = false;
    window.open = (url, target) => { window.__opened.push({ url, target }); if (window.__blocked) return null; window.__win = { opener: 'game' }; return window.__win; };
  });
  await pick();
  let r = await page.evaluate(() => ({
    scene: Game.scene.constructor.name, opened: Game.scene.opened, calls: window.__opened.slice(), opener: window.__win && window.__win.opener,
    form: FEEDBACK_FORM_URL, textarea: !!document.querySelector('#feedbackUI textarea'), buttons: [...document.querySelectorAll('#feedbackUI .feedback-btn')].map(e => e.textContent),
  }));
  assert(r.scene === 'FeedbackScene', `タイトルからフィードバックの画面にならない: ${r.scene}`);
  assert(r.form.startsWith('https://docs.google.com/forms/d/e/1FAIpQLSfDBNbPbbizDXSobJ0g4-6htzpTe1XkT0u8hS-oSG8SIoxtrg/viewform'), `フォームのリンク: ${r.form}`);
  assert(r.calls.length === 1 && r.calls[0].url === r.form && r.calls[0].target === '_blank' && r.opened === true, `選んだときにフォームを開いていない: ${JSON.stringify(r)}`);
  assert(r.opener === null, '開いたページから、このページを触れるままになっている');
  assert(!r.textarea && r.buttons.join() === 'フォームを開く,戻る', `入力欄が残っているか、ボタンがちがう: ${JSON.stringify(r)}`);
  // ブラウザがポップアップを止めたとき：知らせを出し、「フォームを開く」ボタンで開きなおせる
  await page.evaluate(() => { window.__blocked = true; T.step(12); });
  await page.click('#feedbackUI .feedback-btn:nth-of-type(1)');
  r = await page.evaluate(() => { T.step(1); return { opened: Game.scene.opened, calls: window.__opened.length }; });
  assert(r.opened === false && r.calls === 2, `止められたとき: ${JSON.stringify(r)}`);
  await page.evaluate(() => { window.__blocked = false; });
  await page.click('#feedbackUI .feedback-btn:nth-of-type(1)');
  r = await page.evaluate(() => { T.step(1); return { opened: Game.scene.opened, calls: window.__opened.length }; });
  assert(r.opened === true && r.calls === 3, `ボタンで開きなおせない: ${JSON.stringify(r)}`);
  // キャンバスでは Z でもう一度開き、X で戻る
  await page.evaluate(() => Game.canvas.focus());
  await page.keyboard.press('KeyZ');
  r = await page.evaluate(() => { T.step(2); return window.__opened.length; });
  assert(r === 4, `Z で開きなおせない: ${r}`);
  await page.keyboard.press('KeyX');
  r = await page.evaluate(() => { T.step(2); return { scene: Game.scene.constructor.name, ui: !!document.getElementById('feedbackUI') }; });
  assert(r.scene === 'TitleScene' && !r.ui, `X で戻らない: ${JSON.stringify(r)}`);
  // ボタンを選んでいるときは Esc で戻る
  await pick();
  await page.focus('#feedbackUI .feedback-btn:nth-of-type(2)');
  await page.keyboard.press('Escape');
  r = await page.evaluate(() => { T.step(2); return Game.scene.constructor.name; });
  assert(r === 'TitleScene', `Esc で戻らない: ${r}`);
  // フォームのリンクがないとき（または https でないとき）は、タイトルの「フィードバック」を選べない
  r = await page.evaluate(() => {
    const before = window.__opened.length;
    const bad = u => { Feedback.formUrl = u; return Feedback.hasForm; };
    const res = { empty: bad(''), js: bad('javascript:alert(1)'), http: bad('http://example.com/') };
    Game.setScene(new TitleScene('feedback'));
    T.step(20);
    Input.just.shot = true;
    T.step(2);
    res.scene = Game.scene.constructor.name;
    res.disabled = Game.scene.items[TITLE_ITEMS.findIndex(it => it.id === 'feedback')].disabled;
    res.calls = window.__opened.length - before;
    Feedback.formUrl = FEEDBACK_FORM_URL;
    return res;
  });
  assert(!r.empty && !r.js && !r.http && r.scene === 'TitleScene' && r.disabled && r.calls === 0, `リンクがないとき: ${JSON.stringify(r)}`);
});

test('管理者ページ（PIN・キー・各ページ）', async ({ page }) => {
  await page.mouse.click(20, 12);
  await page.waitForSelector('#adminPin');
  // PIN は3段階（2.20.0）。まちがいは1つ目〜3つ目を合わせて3回でロック（まちがいのPINは、正しいPINの1けた目を変えたもの）
  const pins = await page.evaluate(() => ADMIN_PINS);
  assert(pins.join() === '114514,810,4545', `PIN: ${pins}`);
  const wrong = pin => (pin[0] === '9' ? '0' : '9') + pin.slice(1);
  const title = () => page.$eval('.admin-title', e => e.textContent);
  const typePin = async v => { await page.focus('#adminPin'); await page.keyboard.type(v); };
  await typePin(wrong(pins[0]));
  await typePin(wrong(pins[0]));
  await typePin(pins[0]);
  assert((await title()).includes('2/3'), `1つ目が合っても2つ目にならない: ${await title()}`);
  await typePin(wrong(pins[1]));
  assert((await title()).includes('1/3'), `2つ目をまちがえても1つ目に戻らない: ${await title()}`);
  assert(await page.evaluate(() => document.getElementById('adminPin').disabled), 'PINを3回まちがえてもロックされない');
  await page.evaluate(() => { Store.remove('adminLock'); Admin.memLock = 0; });
  await page.waitForFunction(() => !document.getElementById('adminPin').disabled, null, { polling: 100, timeout: 3000 });
  const waitTitle = t => page.waitForFunction(t => document.querySelector('.admin-title').textContent.includes(t), t, { polling: 50, timeout: 3000 });
  await typePin(pins[0]);
  await waitTitle('2/3');
  await typePin(pins[1]);
  await waitTitle('3/3');
  // 3つ目をまちがえても1つ目からやり直し（まちがいは1回目なのでロックしない）
  await typePin(wrong(pins[2]));
  await waitTitle('1/3');
  assert(!(await page.evaluate(() => document.getElementById('adminPin').disabled)), '3つ目を1回まちがえただけでロックされた');
  await typePin(pins[0]);
  await waitTitle('2/3');
  await typePin(pins[1]);
  await waitTitle('3/3');
  assert(!(await page.$('#adminKey')), '3つ目を入れる前にキー入力になった');
  await typePin(pins[2]);
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
  assert(menu.join() === 'データベース,キャラクター一覧,プログラム,フィードバック', `メニュー: ${menu}`);
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
  // フィードバック（Google フォームのリンクと、届いた文の読みかた）
  await page.click('.admin-back');
  await page.click('.admin-menu button:nth-child(4)');
  const fb = await page.evaluate(() => ({ text: document.querySelector('.admin-body').textContent, href: (document.querySelector('.admin-body a.admin-link') || {}).href, form: FEEDBACK_FORM_URL }));
  assert(fb.text.includes('Google フォーム') && fb.text.includes('「回答」') && fb.href === fb.form, `フィードバックのページ: ${JSON.stringify(fb)}`);
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
      hi: Store.get('hi_1_reimu', 0), extra: Store.get('extraUnlocked', false), version: Store.get('saveVersion', 0), latest: SAVE_VERSION,
      oldHi: localStorage.getItem('hoshifuru.hi_1_reimu'), oldVol: localStorage.getItem('hoshifuru.bgmVol'),
    }));
    assert(r.prefix === 'zashiki.' && r.version === r.latest, `保存の頭か形式がおかしい: ${JSON.stringify(r)}`);
    assert(r.bgm === 0.3 && r.lives === 5, `設定が写っていない: ${JSON.stringify(r)}`);
    assert(r.hi === 0 && r.extra === false, `前のゲームの記録が写っている: ${JSON.stringify(r)}`);
    assert(r.oldHi === '5000' && r.oldVol === '0.3', `前のゲームの記録が消えた: ${JSON.stringify(r)}`);
    assert(!errors.length, errors.join('\n'));
  } finally { await context.close(); }
}, { noPage: true });

test('スペルカードの名前を変えても、取得履歴は新しい名前に写る（保存データの形式 4・5）', async ({ browser }) => {
  // 2.12.0 で名前を変えた3枚と、2.14.0 で名前を変えた1枚。'難易度:自機:スペル名' の名前だけが変わり、ほかの履歴はそのまま
  const { page, context, errors } = await openGame(browser, {}, '', ctx => ctx.addInitScript(() => {
    if (localStorage.getItem('zashiki.saveVersion') === null) {
      localStorage.setItem('zashiki.saveVersion', '3');
      localStorage.setItem('zashiki.spells', JSON.stringify({
        '3:reimu:ラストスペル「座敷童子のいる家」': { got: 2, tried: 5 },
        '4:marisa:耐久スペル「四方塞がり」': { got: 1, tried: 1 },
        '4:reimu:ラストスペル「金神七殺」': { got: 0, tried: 3 },
        '1:reimu:瓦符「鬼瓦の睨み」': { got: 1, tried: 3 },
        '2:marisa:屋符「屋根の上から失礼」': { got: 2, tried: 2 },
      }));
    }
  }));
  try {
    const r = await page.evaluate(() => ({ spells: Store.get('spells', {}), version: Store.get('saveVersion', 0), latest: SAVE_VERSION }));
    const want = {
      '3:reimu:家符「座敷童子のいる家」': { got: 2, tried: 5 },
      '4:marisa:末符「四方塞がり」': { got: 1, tried: 1 },
      '4:reimu:神罰「七殺」': { got: 0, tried: 3 },
      '1:reimu:瓦符「鬼の視線」': { got: 1, tried: 3 },
      '2:marisa:屋符「屋根の上から失礼」': { got: 2, tried: 2 },
    };
    assert(JSON.stringify(Object.keys(r.spells).sort()) === JSON.stringify(Object.keys(want).sort()), `履歴の名前が写っていない: ${JSON.stringify(r)}`);
    for (const [k, v] of Object.entries(want)) assert(r.spells[k].got === v.got && r.spells[k].tried === v.tried, `履歴の数がちがう: ${k} ${JSON.stringify(r.spells[k])}`);
    assert(r.version === r.latest, `保存データの形式が最新になっていない: ${JSON.stringify(r)}`);
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
    // K：自機の攻撃の威力が2倍（ボムは変わらない）
    const dealt = () => {
      g = start();
      const e = spawnEnemy({ x: 100, y: 100, hp: 1000, keep: true, drops: {}, script: function* () { for (;;) yield; } });
      g.damageEnemy(e, 5);
      g.damageEnemy(e, 5, true);
      return 1000 - e.hp;
    };
    const k0 = dealt();
    Cheats.toggle('K');
    const k1 = dealt();
    Cheats.toggle('K');
    res.k = [k0, k1];
    // Y：無敵。弾・レーザー・敵の体を自機に重ねても被弾しない（キーなしなら同じ置き方で被弾することも確かめる）
    const touched = kind => {
      g = start();
      const p = g.player;
      p.invuln = 0;
      if (kind === 'bullet') fire({ x: p.x, y: p.y, speed: 0, delay: 0, silent: true });
      if (kind === 'laser') fireLaser({ x: p.x, y: p.y - 120, angle: Math.PI / 2, warn: 0, dur: 600, silent: true });
      if (kind === 'enemy') spawnEnemy({ x: p.x, y: p.y, hp: 100000, keep: true, drops: {}, script: function* () { for (;;) yield; } });
      T.step(40);
      return p.state !== 'normal' || g.misses > 0;
    };
    const kinds = ['bullet', 'laser', 'enemy'];
    res.y0 = kinds.map(touched);
    Cheats.toggle('Y');
    res.y1 = kinds.map(touched);
    Cheats.toggle('Y');
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
    // E：はじめからエキストラ（面があるときだけ遊べる。解放したことは保存しない）。
    // 2.19.0 からエキストラははじめから遊べる（EXTRA_UNLOCK.open）ので、キーの効果は open を切って確かめる
    const openWas = EXTRA_UNLOCK.open;
    EXTRA_UNLOCK.open = false;
    const realExtra = EXTRA_STAGES.length;
    EXTRA_STAGES.push({ name: '仮', nameEn: 'test', bg: STAGES[0].bg, bgm: STAGES[0].bgm, bosses: [], *script() {}, *boss() {} });
    res.e0 = extraPlayable();
    Cheats.toggle('E');
    res.e1 = extraPlayable();
    res.eSaved = Store.get('extraUnlocked', false);
    Cheats.toggle('E');
    res.e2 = extraPlayable();
    EXTRA_STAGES.length = realExtra;
    EXTRA_UNLOCK.open = openWas;
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
  assert(r.k[0] === 10 && r.k[1] === 15, `K: 威力が2倍にならない（ショット5＋ボム5の合計 ${r.k}。予定 10 → 15）`);
  assert(r.y0.every(Boolean), `Y: キーなしで弾・レーザー・敵に重ねても被弾しない（テストの置き方の誤り）: ${r.y0}`);
  assert(!r.y1.some(Boolean), `Y: 無敵なのに被弾した（弾・レーザー・敵）: ${r.y1}`);
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
      // 2.8.0 でボスの攻撃が長くなった（自動操縦では時間切れまでかかるスペルもある）ので、上限は 150000 フレーム
      while (Game.scene instanceof GameScene && f < 150000) {
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
