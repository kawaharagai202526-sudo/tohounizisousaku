'use strict';
// ============================================================
//  3面：上がり込みの裏通り ― 中ボス：？？？（正体は滑沢 瓢）／ボス：滑沢 瓢
//  ボスを倒したあとの会話で、隠れていた屋敷が姿を現す（背景の event('mansion')）
// ============================================================

// ------------------------------------------------------------
//  中ボス：？？？（よその家にくつろいでいた正体不明の人。名前は出さない）
// ------------------------------------------------------------
const NAMESAWA_MID_PHASES = [
  {
    // いつの間にか上がりこむ：消えては別の場所に現れて、二重の輪を撃つ
    type: 'non', hp: 900, time: 25,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        for (let i = 0; i < 12; i++) { b.alpha = 1 - i / 12; yield; }
        b.x = rand(80, FIELD_W - 80);
        b.y = rand(70, 140);
        for (let i = 0; i < 12; i++) { b.alpha = i / 12; yield; }
        b.alpha = 1;
        const n = dv(12, 16, 22, 28), off = rand(TAU);
        fireRing({ x: b.x, y: b.y, n, angle: off, speed: 1.8, type: 'ball', color: 'blue' });
        yield 12;
        fireRing({ x: b.x, y: b.y, n, angle: off + Math.PI / n, speed: 1.4, type: 'ball', color: 'purple' });
        yield 30;
        fireFan({ x: b.x, y: b.y, n: dv(3, 5, 5, 7), spread: 0.5, angle: b.aim(), speed: 2.8, type: 'rice', color: 'white' });
        yield dv(50, 40, 30, 24);
      }
    },
  },
  {
    // 中ボス（家主のふり）のスペル。2.8.0 で資料をもとに作りかえた。
    // お茶をすすりながら、湯呑みの形の弾をゆっくり回転させて広げる。ときどき「茶柱が立つ」と、湯呑みから細い針弾がまっすぐ伸びる。
    // 湯呑みの弾は遅い。茶柱の針弾だけ見ていればよい
    type: 'spell', name: '茶符「主人顔の一服」', hp: 1000, time: 30,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 100, 40);
      for (let loop = 0; ; loop++) {
        const n = dv(8, 10, 12, 14), off = rand(TAU), dir = loop % 2 ? 1 : -1;
        for (let i = 0; i < n; i++) {
          const stalk = rng.next() < dv(0.15, 0.2, 0.28, 0.35);
          fire({
            x: b.x, y: b.y, angle: off + (i * TAU) / n, speed: dv(0.8, 0.9, 1.0, 1.1), angVel: dir * 0.006, type: 'cup', color: 'green', silent: true,
            script: stalk ? function* (bl) {
              yield randInt(60, 140);
              // 茶柱が立つ：一瞬光ってから、針がまっすぐ伸びる
              bl.setColor('yellow');
              yield 20;
              const a = aimAt(bl.x, bl.y);
              for (let k = 0; k < dv(1, 2, 3, 3); k++) fire({ x: bl.x, y: bl.y, angle: a, speed: 3.0 + k * 0.4, type: 'needle', color: 'yellow', silent: k > 0 });
              bl.setColor('green');
            } : null,
          });
        }
        Sound.se('tan');
        yield dv(70, 60, 50, 42);
        if (loop % 3 === 2) b.wander(50, 40);
      }
    },
  },
];

// ------------------------------------------------------------
//  ボス：滑沢 瓢（よその家にするりと上がりこむ。湯のみと瓢箪）
// ------------------------------------------------------------
const NAMESAWA_PHASES = [
  // 2.8.0 で資料「化物屋敷異変 スペルカード・弾幕案」をもとに作りかえた
  //   弾の見た目：湯呑みの形の弾（cup）、茶柱のような細い針弾（needle）、表札の形の札弾（card）、妖怪の行列の大玉
  //   いつの間にか現れる弾と、正体のすり替えがテーマ。見た目と動きが一致しない弾で惑わせる
  //   流れ：通常1 → スペル1 → 通常2 → スペル2 → 通常3 → スペル3（Hard/Lunatic：→ スペル4）
  {
    // 通常1：気付くと画面のあちこちに弾が「上がり込んで」いる。前触れなく現れた小弾が、ゆっくり動き出す
    type: 'non', hp: 1000, time: 30,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        for (let i = 0; i < dv(6, 8, 11, 14); i++) {
          let x, y, tries = 0;
          do { x = rand(16, FIELD_W - 16); y = rand(20, FIELD_H - 100); tries++; } while (dist(x, y, G.player.x, G.player.y) < 90 && tries < 20);
          fire({
            x, y, speed: 0, type: 'small', color: 'purple', delay: 4, silent: true,
            script: function* (bl) { yield 40; bl.angle = rand(TAU); bl.accel = 0.015; bl.maxSpeed = dv(0.9, 1.1, 1.3, 1.5); },
          });
        }
        Sound.se('kira');
        yield 30;
        fireFan({ x: b.x, y: b.y, n: dv(3, 3, 5, 5), spread: 0.4, angle: b.aim(), speed: 2.4, type: 'cup', color: 'blue' });
        yield dv(70, 60, 48, 40);
        if (loop % 2) b.wander(50, 60);
      }
    },
  },
  {
    // 弾が「いつの間にか」画面の中に現れる。最初は透けた状態（当たらない）で出現し、一拍おいて実体化してから動き出す。
    // 透けているうちに配置を見て逃げ道を決める。Hard/Lunatic は透けている時間が短く、Lunatic では自機のすぐ近くにも現れる
    type: 'spell', name: '瓢符「ぬらりくらりの上がり框」', hp: 1300, time: 40,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      const ghost = dv(70, 60, 46, 38);
      for (let loop = 0; ; loop++) {
        const n = dv(10, 13, 16, 20);
        for (let i = 0; i < n; i++) {
          let x, y, tries = 0;
          const near = DIFF >= 3 && i < 3;
          do {
            x = near ? G.player.x + rand(-70, 70) : rand(16, FIELD_W - 16);
            y = near ? G.player.y + rand(-80, -30) : rand(20, FIELD_H - 60);
            tries++;
          } while (dist(x, y, G.player.x, G.player.y) < (near ? 46 : 80) && tries < 20);
          const a = aimAt(x, y) + rand(-0.5, 0.5);
          fire({ x: clamp(x, 10, FIELD_W - 10), y: clamp(y, 10, FIELD_H - 10), angle: a, speed: 0, type: 'ball', color: loop % 2 ? 'purple' : 'blue', delay: ghost, silent: true,
            script: function* (bl) { yield ghost; bl.accel = 0.03; bl.maxSpeed = dv(1.2, 1.4, 1.7, 2.0); } });
        }
        Sound.se('kira');
        yield dv(80, 70, 56, 48);
        if (loop % 2) b.wander(50, 50);
      }
    },
  },
  {
    // 通常2：左右へ素早く移動しながら、札弾をばら撒く
    type: 'non', hp: 1100, time: 30,
    *script(b) {
      yield 20;
      for (let loop = 0; ; loop++) {
        const tx = loop % 2 ? FIELD_W - 60 : 60;
        b.move(tx, rand(70, 120), 36, Ease.inOutQuad);
        for (let f = 0; f < 40; f++) {
          if (f % dv(5, 4, 3, 3) === 0) fire({ x: b.x, y: b.y, angle: Math.PI / 2 + rand(-1.2, 1.2), speed: rand(1.4, 2.4), type: 'card', color: pick(['red', 'blue']), silent: true });
          yield;
        }
        Sound.se('tan');
        fireFan({ x: b.x, y: b.y, n: dv(3, 5, 5, 7), spread: 0.6, angle: b.aim(), speed: 2.2, type: 'card', color: 'white' });
        yield dv(30, 24, 18, 14);
      }
    },
  },
  {
    // 表札の形の札弾が、赤と青の二種類飛んでくる（赤はまっすぐ、青は曲がる）。一定時間ごとに表札が「掛け替え」られ、赤と青の動き方が入れ替わる。
    // 掛け替えの合図（札が一瞬裏返る）を見て位置を取る。Hard/Lunatic は間隔が短く、Lunatic では裏返るふりだけして入れ替わらないことがある
    type: 'spell', name: '札符「表札の掛け替え」', hp: 1300, time: 45,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 80, 40);
      let swapped = false;
      const cards = [];
      // 曲がる札は、しばらく曲がってから まっすぐに戻る（画面に残り続けないように）
      const behave = (bl, now) => {
        const curve = (bl.data === 'red') === swapped;
        bl.angVel = curve ? (bl.x < G.player.x ? 0.016 : -0.016) * (bl.angle > Math.PI / 2 ? -1 : 1) : 0;
        bl.curveUntil = now + 45;
      };
      for (let f = 0; ; f++) {
        for (const bl of cards) if (bl.alive && bl.angVel && f > bl.curveUntil) bl.angVel = 0;
        if (f % dv(14, 11, 9, 7) === 0) {
          // 赤と青を1枚ずつ
          for (const red of [true, false]) {
            const bl = fire({ x: b.x, y: b.y, angle: b.aim() + rand(-1.0, 1.0), speed: dv(1.5, 1.7, 1.9, 2.1), type: 'card', color: red ? 'red' : 'blue', data: red ? 'red' : 'blue', silent: true });
            behave(bl, f);
            cards.push(bl);
          }
          if (f % 28 === 0) Sound.se('tan');
        }
        const period = dv(240, 210, 170, 140);
        if (f % period === period - 30) {
          // 合図：札が一瞬裏返る
          for (const bl of cards) if (bl.alive) bl.setColor('white');
        }
        if (f % period === period - 20) {
          const fake = DIFF >= 3 && rng.next() < 0.3;
          if (!fake) swapped = !swapped;
          for (const bl of cards) {
            if (!bl.alive) continue;
            bl.setColor(bl.data === 'red' ? 'red' : 'blue');
            behave(bl, f);
          }
          Sound.se('kira');
        }
        if (f % 300 === 299) { for (let i = cards.length - 1; i >= 0; i--) if (!cards[i].alive) cards.splice(i, 1); b.wander(50, 50); }
        yield;
      }
    },
  },
  {
    // 通常3：妖怪の影を左右に連れて、三方向から交差する弾を撃つ
    type: 'non', hp: 1100, time: 30,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 80, 40);
      for (let loop = 0; ; loop++) {
        const shadows = [[60, 150], [FIELD_W - 60, 150]];
        for (const [sx, sy] of shadows) fire({ x: sx, y: sy, speed: 0, type: 'large', color: 'dark', delay: 30, life: 120, silent: true });
        yield 30;
        for (let k = 0; k < dv(4, 5, 6, 7); k++) {
          const tx = G.player.x, ty = G.player.y;
          for (const [sx, sy] of [[b.x, b.y], ...shadows]) {
            const a = angleTo(sx, sy, tx, ty);
            for (const s of [-1, 1]) fire({ x: sx, y: sy, angle: a + s * dv(0.35, 0.3, 0.26, 0.22), speed: 2.0, type: 'rice', color: 'purple', silent: true });
          }
          Sound.se('tan');
          yield dv(18, 15, 12, 10);
        }
        yield dv(60, 50, 40, 34);
      }
    },
  },
  {
    // ボスが画面の端から端へ逃げ回り、逃げた跡に弾の列が残る。跡の弾は少し遅れて、自機の方へ流れてくる。
    // ボスの逃げる先を先回りしようとせず、跡の弾が流れてくる向きに合わせて動く。Hard/Lunatic は逃げる速さと残る弾の数が増える
    type: 'spell', name: '逃符「勝手口からお暇」', hp: 1300, time: 45,
    *script(b) {
      for (let loop = 0; ; loop++) {
        const tx = loop % 2 ? rand(30, 90) : rand(FIELD_W - 90, FIELD_W - 30), ty = rand(40, 200);
        const sx = b.x, sy = b.y, frames = dv(70, 60, 50, 42);
        for (let i = 1; i <= frames; i++) {
          const t = Ease.inOutQuad(i / frames);
          b.x = lerp(sx, tx, t); b.y = lerp(sy, ty, t);
          if (i % dv(6, 5, 4, 3) === 0) {
            fire({
              x: b.x, y: b.y, speed: 0, type: 'ball', color: 'blue', silent: true, delay: 10,
              script: function* (bl) { yield dv(70, 60, 50, 44); bl.angle = aimAt(bl.x, bl.y) + rand(-0.2, 0.2); bl.accel = 0.025; bl.maxSpeed = dv(1.3, 1.5, 1.8, 2.1); },
            });
          }
          yield;
        }
        Sound.se('kira');
        fireFan({ x: b.x, y: b.y, n: dv(3, 3, 5, 5), spread: 0.5, angle: b.aim(), speed: 2.2, type: 'cup', color: 'green' });
        yield dv(30, 24, 18, 14);
      }
    },
  },
  {
    // ボスの背後に妖怪の行列が現れ、大玉の列になって画面を横切っていく。列と列の間を、ボスの撃つ小弾が埋める。
    // 行列の大玉は決まった道筋を通る。行列の切れ目を待って抜ける
    type: 'spell', name: '総大将「百鬼夜行の先頭」', hp: 1400, time: 45, minDiff: 2,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 60, 40);
      const lanes = [130, 210, 290, 370];
      for (let loop = 0; ; loop++) {
        const lane = lanes[loop % lanes.length] + rand(-15, 15), dir = loop % 2 ? 1 : -1;
        const count = dv(6, 7, 8, 10), gapAt = randInt(2, count - 2);
        for (let i = 0; i < count; i++) {
          if (i === gapAt) continue; // 行列の切れ目
          const x0 = dir > 0 ? -30 - i * 44 : FIELD_W + 30 + i * 44;
          fire({ x: x0, y: lane, angle: dir > 0 ? 0 : Math.PI, speed: dv(1.4, 1.5, 1.7, 1.9), type: 'large', color: i % 3 === 0 ? 'red' : 'purple', silent: true, margin: 520 });
        }
        Sound.se('kira');
        for (let f = 0; f < 70; f++) {
          if (f % dv(14, 12, 10, 8) === 0) fire({ x: b.x, y: b.y, angle: b.aim() + rand(-0.6, 0.6), speed: 1.8, type: 'small', color: 'white', silent: true });
          yield;
        }
      }
    },
  },
];

// ------------------------------------------------------------
//  道中の敵
// ------------------------------------------------------------

// 自機を狙ってレーザーを撃つ妖精
function laserFairy(x, stopY) {
  return spawnEnemy({
    x, y: -16, hp: 40, color: 'purple', score: 3000, drops: { power: 2, point: 2 },
    script: function* (e) {
      yield* e.moveTo(x, stopY, 50);
      for (let k = 0; k < dv(1, 2, 2, 3); k++) {
        fireLaser({ x: e.x, y: e.y, angle: e.aim(), width: 12, warn: 45, dur: 30, color: 'purple', follow: l => { if (e.alive) { l.x = e.x; l.y = e.y; } } });
        yield 90;
      }
      e.setMove(0, -Math.PI / 2, 0.06);
    },
  });
}

// 円を描いて飛ぶ妖精の編隊
function* swirlWave(side, n) {
  for (let i = 0; i < n; i++) {
    spawnEnemy({
      x: side < 0 ? -12 : FIELD_W + 12, y: 60, hp: 12, color: 'yellow', score: 1200, drops: i % 2 ? { point: 1 } : { power: 1 },
      script: function* (e) {
        e.setMove(3, side < 0 ? 0 : Math.PI, 0, side < 0 ? 0.03 : -0.03);
        yield 40;
        fireFan({ x: e.x, y: e.y, n: dv(1, 1, 3, 5), spread: 0.3, angle: e.aim(), speed: dv(2, 2.3, 2.8, 3.2), type: 'rice', color: 'orange' });
        yield 60;
        e.angVel = 0;
      },
    });
    yield 12;
  }
}

STAGES.push({
  name: '上がり込みの裏通り',
  nameEn: 'Backstreets of the Uninvited Guest',
  bg: BackstreetBG,
  bgm: 'stage3',
  zako: 'handEye', // 道中の妖精と緑の手は「一つ目の手」の絵にする
  // この面のボス（管理者ページの一覧・ボスの攻撃を試す機能・テストが使う。ボスを増やしたらここにも書く）
  //   id: CHARA_INFO のID  phases: 攻撃の配列  mid: 中ボスなら true（名前を出さない）  bgm: ボス戦の曲  def: 見た目（スペルカードの背景・魔法陣の色など）
  bosses: [
    { id: 'namesawaMask', phases: NAMESAWA_MID_PHASES, mid: true, def: { circleColor: '170,170,230' } },
    { id: 'namesawa', phases: NAMESAWA_PHASES, bgm: 'boss3', def: { spellBg: 'nurari', circleColor: '200,190,255' } },
  ],
  *script(g) {
    yield 160;
    g.tasks.add(swirlWave(-1, 8));
    yield 160;
    g.tasks.add(swirlWave(1, 8));
    yield 200;
    [96, 288].forEach(x => laserFairy(x, 90));
    yield 120;
    laserFairy(192, 70);
    yield 60;
    [140, 244].forEach(x => handEnemy(x, { stopY: 120 }));
    yield 150;
    g.tasks.add(tileShower(360, dv(24, 36, 54, 74), ['blue', 'purple', 'white'], true));
    yield* zigzag(14, 'yellow', 'orange', 'rice');
    yield* waitClear(300);

    // 中ボス：？？？（正体を隠した滑沢。会話のあと、逃げていく）
    const mid = g.spawnStageBoss('namesawaMask', { x: FIELD_W / 2, y: -50 });
    yield* mid.moveTo(FIELD_W / 2, 100, 60);
    yield* g.talk(STORY.stage3mid[g.charId].before);
    yield* g.fight(mid, NAMESAWA_MID_PHASES);
    if (mid.hp <= 0) dropItems(mid.x, mid.y, { power: 5, point: 8, bomb: 1 });
    yield* g.talk(STORY.stage3mid[g.charId].after);
    yield* g.bossDown(mid, true);
    yield 60;

    [70, 314].forEach(x => laserFairy(x, 110));
    g.tasks.add(sideSweep(-1, 8, { color: 'purple', bcolor: 'purple', type: 'rice', y: 40 }));
    yield 100;
    g.tasks.add(sideSweep(1, 8, { color: 'purple', bcolor: 'purple', type: 'rice', y: 40 }));
    yield 200;
    for (const side of [-1, 1]) {
      spawnEnemy({
        x: FIELD_W / 2 + side * 100, y: -20, kind: 'bigfairy', color: 'yellow', hp: 320, r: 18, score: 20000, drops: { power: 4, point: 5 },
        script: function* (e) {
          yield* e.moveTo(e.x, 100, 50);
          for (let k = 0; k < 6; k++) {
            fireRing({ x: e.x, y: e.y, n: dv(10, 14, 18, 24), angle: rand(TAU), speed: 1.7, angVel: side * 0.006, type: 'ball', color: k % 2 ? 'yellow' : 'orange' });
            yield 50;
          }
          e.setMove(0, -Math.PI / 2, 0.05);
        },
      });
    }
    yield* waitClear(700);
    g.tasks.add(tileShower(480, dv(28, 44, 64, 88), ['blue', 'purple', 'white'], true));
    g.tasks.add(swirlWave(-1, 10));
    g.tasks.add(swirlWave(1, 10));
    yield 240;
    [80, 192, 304].forEach(x => laserFairy(x, 80));
    yield 60;
    [130, 254].forEach(x => handEnemy(x, { stopY: 140 }));
    yield 60;
    [120, 264].forEach(x => ringFairy(x, { color: 'blue', bcolor: 'yellow', type: 'rice', stopY: 120, times: 4, n: dv(10, 14, 20, 26) }));
    yield* waitClear(900);
    yield 120;
  },
  // ボス戦（キー「V」のときはここから始まる）
  *boss(g) {
    const boss = g.spawnStageBoss('namesawa', { x: FIELD_W / 2, y: -50 });
    yield* boss.moveTo(FIELD_W / 2, 100, 70);
    yield* g.talk(STORY.stage3[g.charId].before);
    yield* g.fight(boss, NAMESAWA_PHASES);
    yield* g.bossDown(boss);
    yield* g.talk(STORY.stage3[g.charId].after);
  },
});
