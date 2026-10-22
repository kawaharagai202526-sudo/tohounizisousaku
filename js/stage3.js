'use strict';
// ============================================================
//  3面：上がり込みの裏通り ― 中ボス：？？？（提供画像のキャラクター。名前は未定）／ボス：滑沢 瓢
//  ボスを倒したあとの会話で、隠れていた屋敷が姿を現す（背景の event('mansion')）
// ============================================================

// ------------------------------------------------------------
//  中ボス：？？？（よその家でくつろいでいた、正体不明の子。名前は出さない）
// ------------------------------------------------------------
const MIDBOSS3_PHASES = [
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
    // 気づいたら部屋の中にいる弾：あちこちに現れてから、自機へゆっくり寄ってくる
    type: 'spell', name: '隠符「勝手知ったる他人の家」', hp: 1000, time: 30,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      for (let loop = 0; ; loop++) {
        const n = dv(6, 8, 11, 14);
        Sound.se('kira');
        for (let i = 0; i < n; i++) {
          let x, y, tries = 0;
          do { x = rand(20, FIELD_W - 20); y = rand(30, FIELD_H - 120); tries++; } while (dist(x, y, G.player.x, G.player.y) < 110 && tries < 20);
          fire({
            x, y, speed: 0, type: 'ball', color: 'purple', delay: 50, silent: true,
            script: function* (bl) { yield 60; bl.angle = aimAt(bl.x, bl.y); bl.accel = 0.03; bl.maxSpeed = dv(1.2, 1.5, 1.8, 2.1); },
          });
        }
        yield 50;
        fireRing({ x: b.x, y: b.y, n: dv(10, 14, 18, 24), angle: rand(TAU), speed: 1.6, type: 'small', color: 'blue' });
        yield dv(80, 66, 54, 44);
      }
    },
  },
];

// ------------------------------------------------------------
//  ボス：滑沢 瓢（よその家にするりと上がりこむ。湯のみと瓢箪）
// ------------------------------------------------------------
const NAMESAWA_PHASES = [
  {
    // すべる弾：輪がゆっくり止まりかけて、横へすべり出す
    type: 'non', hp: 1000, time: 30,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        const n = dv(14, 18, 24, 30), off = rand(TAU), dir = loop % 2 ? 1 : -1;
        for (let i = 0; i < n; i++) {
          fire({
            x: b.x, y: b.y, angle: off + (i * TAU) / n, speed: 2.6, accel: -0.05, minSpeed: 0.4, type: 'rice', color: 'blue', silent: i > 0,
            script: function* (bl) { yield 40; bl.angle += (dir * Math.PI) / 2; bl.accel = 0.03; bl.maxSpeed = dv(1.6, 2, 2.4, 2.8); },
          });
        }
        yield 50;
        fireFan({ x: b.x, y: b.y, n: dv(3, 3, 5, 5), spread: 0.4, angle: b.aim(), speed: 2.4, type: 'ball', color: 'white' });
        b.wander(60, 60);
        yield 40;
      }
    },
  },
  {
    // ぬらりくらり：大玉が左右に揺れながら進み、つるのように小さな弾を残していく
    type: 'spell', name: '瓢符「ぬらりくらりの瓢箪」', hp: 1300, time: 40,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      for (let loop = 0; ; loop++) {
        const n = dv(3, 4, 5, 6), base = b.aim();
        for (let i = 0; i < n; i++) {
          const a0 = base + (i - (n - 1) / 2) * 0.5, ph = rand(TAU);
          fire({
            x: b.x, y: b.y, angle: a0, speed: dv(1.3, 1.5, 1.7, 1.9), type: 'large', color: 'purple', silent: i > 0,
            script: function* (bl) {
              let side = 1;
              for (let k = 0; ; k++) {
                bl.angle = a0 + Math.sin(k * 0.05 + ph) * 0.7;
                if (k % dv(14, 12, 10, 8) === 0) {
                  side = -side;
                  fire({ x: bl.x, y: bl.y, angle: bl.angle + (side * Math.PI) / 2, speed: 0.7, type: 'small', color: 'pink', silent: true });
                }
                yield;
              }
            },
          });
        }
        Sound.se('kira');
        yield dv(80, 66, 56, 46);
        if (loop % 2) b.wander(60, 50);
      }
    },
  },
  {
    // お茶のしぶき：上へはねた弾が、ぱらぱらと落ちてくる
    type: 'non', hp: 1100, time: 30,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        const n = dv(10, 14, 18, 24);
        for (let i = 0; i < n; i++) {
          fire({
            x: b.x, y: b.y, angle: -Math.PI / 2 + rand(-1.1, 1.1), speed: rand(2, 3.2), accel: -0.05, minSpeed: 0, ay: 0.04, maxFall: dv(1.8, 2.1, 2.4, 2.7),
            type: 'small', color: pick(['cyan', 'white']), silent: i > 0,
          });
        }
        yield 30;
        fireFan({ x: b.x, y: b.y, n: dv(5, 5, 7, 9), spread: 0.9, angle: b.aim(), speed: 2, type: 'rice', color: 'green' });
        yield 30;
        b.wander(50, 70);
        yield 20;
      }
    },
  },
  {
    // 一服：少し休んでから、すき間のある湯気の輪を何重にも。椿の花びらも舞い落ちる
    type: 'spell', name: '茶符「上がり込みの一服」', hp: 1400, time: 45,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 100, 40);
      let off = 0;
      for (let loop = 0; ; loop++) {
        yield dv(40, 34, 28, 22);
        for (let r = 0; r < dv(3, 4, 5, 6); r++) {
          const n = dv(14, 18, 24, 30);
          for (let i = 0; i < n; i++) {
            if (i % 6 === 0) continue;
            fire({ x: b.x, y: b.y, angle: off + (i * TAU) / n, speed: 1.5 + r * 0.15, type: 'ball', color: r % 2 ? 'white' : 'cyan', silent: true });
          }
          Sound.se('tan');
          off += 0.12;
          yield 10;
        }
        for (let i = 0; i < dv(6, 8, 10, 12); i++) {
          const ph = rand(TAU);
          fire({
            x: rand(10, FIELD_W - 10), y: -8, angle: Math.PI / 2, speed: rand(1, 1.6), type: 'rice', color: 'red', silent: true,
            script: function* (bl) { for (let k = 0; ; k++) { bl.angle = Math.PI / 2 + Math.sin(k * 0.06 + ph) * 0.6; yield; } },
          });
        }
        yield 30;
      }
    },
  },
  {
    // すれ違いざまに置いていった弾が、あとで一斉に自機へ向かう
    type: 'spell', name: '暴露「すれ違いざまの暴露」', hp: 1300, time: 45,
    *script(b) {
      for (let loop = 0; ; loop++) {
        const dir = loop % 2 ? -1 : 1;
        yield* b.moveTo(dir > 0 ? 30 : FIELD_W - 30, rand(70, 150), 40);
        const tag = {};
        const dropped = [];
        for (let f = 0; f < 50; f++) {
          b.x += (dir * (FIELD_W - 60)) / 50;
          if (f % dv(5, 4, 3, 3) === 0) dropped.push(fire({ x: b.x, y: b.y, speed: 0, type: 'kunai', color: 'purple', silent: true, delay: 10, data: tag }));
          if (DIFF >= 2 && f % 10 === 0) fire({ x: b.x, y: b.y, angle: Math.PI / 2, speed: 2, type: 'small', color: 'blue', silent: true });
          yield;
        }
        yield 20;
        Sound.se('kira');
        for (const bl of dropped) {
          // 弾は使い回されるので、まだこの弾のままか（data）を確かめる
          if (!bl.alive || bl.data !== tag) continue;
          bl.angle = aimAt(bl.x, bl.y);
          bl.accel = 0.04;
          bl.maxSpeed = dv(2, 2.4, 2.8, 3.2);
        }
        yield dv(70, 60, 50, 40);
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
    { id: 'midboss3', phases: MIDBOSS3_PHASES, mid: true, def: { circleColor: '170,170,230' } },
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

    // 中ボス：？？？（よその家でくつろいでいた。会話のあと、逃げていく）
    const mid = g.spawnStageBoss('midboss3', { x: FIELD_W / 2, y: -50 });
    yield* mid.moveTo(FIELD_W / 2, 100, 60);
    yield* g.talk(STORY.stage3mid[g.charId].before);
    yield* g.fight(mid, MIDBOSS3_PHASES);
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
