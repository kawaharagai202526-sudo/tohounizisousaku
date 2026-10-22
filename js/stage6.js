'use strict';
// ============================================================
//  6面：瓦礫の空 ― 中ボス：家鳴 鳴音（名前は出さない）／ボス：座敷 宿美（座敷わらし）
//  崩れた屋敷のがれきが浮かぶ、夜明け前の空（背景 RubbleSkyBG）
//  道中の敵はほかの面と共通のもの（js/stage1.js・stage3.js・stage4.js）も使う
// ============================================================

// ------------------------------------------------------------
//  座敷 宿美の攻撃の部品（最後のスペルカードでもまとめて使う）
// ------------------------------------------------------------

// 鈴の音：輪と、少し遅れて響く二つ目の輪
function* zashikiBell(b, colors = ['yellow', 'orange']) {
  const n = dv(16, 20, 26, 32), off = rand(TAU);
  fireRing({ x: b.x, y: b.y, n, angle: off, speed: 1.9, type: 'ball', color: colors[0] });
  Sound.se('kira');
  yield 18;
  fireRing({ x: b.x, y: b.y, n, angle: off + Math.PI / n, speed: 1.4, type: 'ball', color: colors[1], silent: true });
}

// お客さん：画面のふち（左右と下）から、座敷のいるところへ向かってくる弾。座敷に着くと消える
function zashikiGuest(b, colors = ['pink', 'yellow', 'green', 'cyan', 'orange']) {
  let x, y;
  const side = rng.next();
  if (side < 0.4) { x = -8; y = rand(120, FIELD_H - 20); }
  else if (side < 0.8) { x = FIELD_W + 8; y = rand(120, FIELD_H - 20); }
  else {
    x = rand(20, FIELD_W - 20);
    y = FIELD_H + 8;
    if (Math.abs(x - G.player.x) < 90) x = (x + FIELD_W / 2) % FIELD_W;
  }
  return fire({
    x, y, angle: angleTo(x, y, b.x, b.y), speed: dv(1.1, 1.3, 1.6, 1.9), type: 'ball', color: pick(colors), delay: 30, margin: 30, silent: true,
    script: function* (bl) {
      for (;;) {
        if (dist(bl.x, bl.y, b.x, b.y) < 26) { bl.alive = false; return; }
        yield;
      }
    },
  });
}

// 梅の花：5枚の花びらがまとまって飛び、しばらくすると花びらが散る
function zashikiFlowers(b, count, base) {
  for (let i = 0; i < count; i++) {
    const a = base + (i - (count - 1) / 2) * 0.5;
    for (let k = 0; k < 5; k++) {
      const pa = (k / 5) * TAU + i;
      fire({
        x: b.x + Math.cos(pa) * 9, y: b.y + Math.sin(pa) * 9, angle: a, speed: 1.9, type: 'ball', color: 'pink', silent: true,
        script: function* (bl) { yield 50; bl.angle = pa; bl.speed = dv(1.0, 1.2, 1.4, 1.6); },
      });
    }
    fire({ x: b.x, y: b.y, angle: a, speed: 1.9, type: 'small', color: 'yellow', silent: true });
  }
  Sound.se('tan');
}

// 三日月：まん中ほど速い米粒弾の弧（三日月の形）
function zashikiCrescent(b, base) {
  const m = dv(9, 11, 13, 15);
  for (let i = 0; i < m; i++) {
    const o = (i / (m - 1) - 0.5) * 2;
    fire({ x: b.x, y: b.y, angle: base + o * 1.0, speed: 2.4 - Math.abs(o) * 0.9, type: 'rice', color: 'yellow', silent: true });
  }
  Sound.se('tan');
}

// ------------------------------------------------------------
//  中ボス：家鳴 鳴音（座敷様を守るため、最後の力で立ちふさがる。名前は出さない）
// ------------------------------------------------------------
const YANARI6_PHASES = [
  {
    type: 'non', hp: 1100, time: 25,
    *script(b) {
      yield 30;
      for (let beat = 0; ; beat++) {
        if (beat % 2 === 0) fireRing({ x: b.x, y: b.y, n: dv(14, 18, 24, 30), angle: rand(TAU), speed: dv(1.6, 1.9, 2.2, 2.5), type: 'ball', color: beat % 4 ? 'purple' : 'pink' });
        else {
          const n = dv(8, 10, 12, 16), off = rand(TAU);
          for (let i = 0; i < n; i++) fire({ x: b.x, y: b.y, angle: off + (i * TAU) / n, speed: 2.0, type: 'rice', color: 'white', silent: true, script: creakScript(beat % 4 === 1 ? 0.3 : -0.3, 4) });
        }
        if (beat % 8 === 7) b.wander(50, 60);
        yield 26;
      }
    },
  },
  {
    // かたむきながら、きしむ弾の輪
    type: 'spell', name: '鳴符「最後の家鳴り」', hp: 1200, time: 30,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      const tilt = () => Math.sin(G.frame * 0.015) * dv(0.7, 0.9, 1.1, 1.3);
      for (let loop = 0; ; loop++) {
        const n = dv(12, 16, 20, 26), off = rand(TAU), turn = (loop % 2 ? 1 : -1) * 0.3;
        for (let i = 0; i < n; i++) {
          fire({
            x: b.x, y: b.y, angle: off + (i * TAU) / n, speed: 2.0, type: 'rice', color: loop % 2 ? 'pink' : 'purple', silent: true,
            script: function* (bl) {
              // 進む → 止まる → 向きを変える、を4回。そのあいだも屋敷のかたむきで横に流される
              for (let k = 0; k < 4; k++) {
                for (let f = 0; f < 22; f++) { bl.evx = tilt(); yield; }
                const sp = bl.speed;
                bl.speed = 0;
                for (let f = 0; f < 14; f++) { bl.evx = tilt(); yield; }
                bl.angle += turn;
                bl.speed = Math.max(sp, dv(1.6, 1.9, 2.2, 2.5));
              }
              for (;;) { bl.evx = tilt(); yield; }
            },
          });
        }
        Sound.se('tan');
        yield dv(46, 38, 30, 25);
      }
    },
  },
];

// ------------------------------------------------------------
//  ボス：座敷 宿美（住処を追われた愛しき災難）
//  鈴・お客さん（千客万来）・家運・梅・三日月・百の部屋・家がかたむく／栄える
// ------------------------------------------------------------
const ZASHIKI_PHASES = [
  {
    // 鈴の音と、自機狙いの札
    type: 'non', hp: 1300, time: 30,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        yield* zashikiBell(b);
        yield 26;
        fireFan({ x: b.x, y: b.y, n: dv(3, 3, 5, 5), spread: 0.35, angle: b.aim(), speed: 2.6, type: 'amulet', color: 'red' });
        yield 30;
        if (loop % 2) b.wander(60, 60);
      }
    },
  },
  {
    // お客さんが四方から座敷のもとへやってくる
    type: 'spell', name: '福符「千客万来」', hp: 1700, time: 45,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      for (let f = 0; ; f++) {
        if (f % dv(7, 5, 4, 3) === 0) zashikiGuest(b);
        if (f % dv(90, 75, 60, 50) === 0) fireRing({ x: b.x, y: b.y, n: dv(8, 12, 16, 20), angle: rand(TAU), speed: 1.3, type: 'rice', color: 'white' });
        if (f % 20 === 0) Sound.se('tan');
        if (f % 300 === 299) b.wander(60, 40);
        yield;
      }
    },
  },
  {
    // 梅の花が飛んできて、花びらが散る
    type: 'non', hp: 1400, time: 30,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        zashikiFlowers(b, dv(3, 4, 5, 6), b.aim());
        yield dv(54, 44, 36, 30);
        if (loop % 2) b.wander(60, 50);
      }
    },
  },
  {
    // 家運隆盛：床で跳ねた弾が、ふたつに増えて上っていく
    type: 'spell', name: '運符「家運隆盛」', hp: 1800, time: 45,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 80, 40);
      for (let loop = 0; ; loop++) {
        const n = dv(12, 16, 20, 26), off = rand(TAU);
        for (let i = 0; i < n; i++) {
          fire({
            x: b.x, y: b.y, angle: off + (i * TAU) / n, speed: dv(1.6, 1.8, 2.1, 2.4), type: 'ball', color: 'yellow', silent: true,
            script: function* (bl) {
              while (bl.y < FIELD_H - 12) yield;
              for (const s of [-1, 1]) {
                fire({ x: bl.x, y: bl.y, angle: -Math.PI / 2 + s * 0.35 + rand(-0.1, 0.1), speed: dv(1.0, 1.2, 1.4, 1.6), accel: 0.01, maxSpeed: 2.6, type: 'rice', color: 'orange', silent: true });
              }
              bl.alive = false;
            },
          });
        }
        Sound.se('kira');
        yield dv(62, 50, 42, 34);
        if (loop % 3 === 2) b.wander(60, 50);
      }
    },
  },
  {
    // 三日月の弧を、左右から交互に
    type: 'non', hp: 1400, time: 30,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        zashikiCrescent(b, b.aim() + (loop % 2 ? 0.25 : -0.25));
        yield dv(24, 20, 16, 12);
        if (loop % 4 === 3) {
          fireRing({ x: b.x, y: b.y, n: dv(10, 14, 18, 24), angle: rand(TAU), speed: 1.5, type: 'small', color: 'blue' });
          b.wander(50, 60);
          yield 20;
        }
      }
    },
  },
  {
    // 百の部屋に積もった福：四角い部屋のような弾のまとまりが、だんだん重く（速く）降ってくる
    type: 'spell', name: '重符「百の部屋に積もった福」', hp: 1800, time: 45,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 70, 40);
      for (let loop = 0; ; loop++) {
        const rooms = dv(3, 4, 5, 6);
        const grav = Math.min(0.02 + loop * 0.002, 0.04);
        const maxFall = dv(1.6, 1.9, 2.2, 2.5);
        for (let r = 0; r < rooms; r++) {
          const cx = ((r + 0.5) / rooms) * FIELD_W + rand(-20, 20);
          for (const [dx, dy] of [[-10, -10], [0, -10], [10, -10], [-10, 0], [10, 0], [-10, 10], [0, 10], [10, 10]]) {
            fire({ x: cx + dx, y: -20 + dy, speed: 0, ay: grav, maxFall, type: 'small', color: 'yellow', silent: true, delay: 20 });
          }
          fire({ x: cx, y: -20, speed: 0, ay: grav, maxFall, type: 'ball', color: 'orange', silent: true, delay: 20 });
        }
        Sound.se('kira');
        for (let f = 0; f < dv(70, 60, 50, 42); f++) {
          if (f === 20) fireFan({ x: b.x, y: b.y, n: dv(3, 5, 5, 7), spread: 0.6, angle: b.aim(), speed: 2.2, type: 'amulet', color: 'red' });
          yield;
        }
      }
    },
  },
  {
    // 座敷が去った方とは反対へ家がかたむく：弾は座敷のいない方へ流されていく
    type: 'spell', name: '去符「わたしが去れば家は傾き」', hp: 1900, time: 50,
    *script(b) {
      for (let loop = 0; ; loop++) {
        const side = loop % 2 ? 1 : -1;
        yield* b.moveTo(FIELD_W / 2 + side * 120, 80, 50);
        for (let k = 0; k < 4; k++) {
          const n = dv(12, 16, 20, 26), off = rand(TAU);
          for (let i = 0; i < n; i++) {
            fire({
              x: b.x, y: b.y, angle: off + (i * TAU) / n, speed: dv(1.2, 1.4, 1.6, 1.8), type: 'ball', color: side > 0 ? 'blue' : 'purple', silent: true,
              script: function* (bl) {
                for (let f = 0; ; f++) {
                  bl.evx = clamp(-(b.x - FIELD_W / 2) / 120, -1, 1) * Math.min(1, f / 60) * dv(0.8, 1.0, 1.2, 1.4);
                  yield;
                }
              },
            });
          }
          Sound.se('tan');
          yield dv(36, 30, 25, 21);
        }
      }
    },
  },
  {
    // 座敷が留まっているあいだ、福の玉がだんだん増え、輪を撒く
    type: 'spell', name: '栄符「留まれば家は栄える」', hp: 2000, time: 50,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 100, 40);
      const tag = {};
      const orbs = [];
      for (let f = 0; ; f++) {
        if (f % 150 === 0 && orbs.filter(o => o.alive && o.data === tag).length < dv(4, 5, 6, 7)) {
          const a = rand(TAU), r = rand(70, 130);
          orbs.push(fire({
            x: clamp(b.x + Math.cos(a) * r, 30, FIELD_W - 30), y: clamp(b.y + Math.sin(a) * r * 0.6, 40, 240), speed: 0,
            type: 'large', color: 'yellow', delay: 40, silent: true, data: tag,
            script: function* (bl) {
              for (;;) {
                yield dv(90, 75, 62, 52);
                fireRing({ x: bl.x, y: bl.y, n: dv(8, 10, 12, 14), angle: rand(TAU), speed: 1.3, type: 'small', color: 'orange', silent: true });
              }
            },
          }));
        }
        if (f % dv(54, 44, 36, 30) === 30) fireFan({ x: b.x, y: b.y, n: dv(3, 5, 5, 7), spread: 0.5, angle: b.aim(), speed: 2.4, type: 'rice', color: 'pink' });
        if (f % 20 === 0) Sound.se('tan');
        yield;
      }
    },
  },
  {
    // 最後のスペルカード：鈴・お客さん・梅・三日月を順番に
    type: 'spell', name: '「あなたの家運、ここで尽きぬよう」', hp: 2400, time: 60,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 100, 40);
      for (let loop = 0; ; loop++) {
        const m = loop % 4;
        if (m === 0) yield* zashikiBell(b, ['pink', 'yellow']);
        if (m === 1) for (let i = 0; i < dv(10, 14, 18, 22); i++) zashikiGuest(b);
        if (m === 2) zashikiFlowers(b, dv(3, 4, 5, 6), b.aim());
        if (m === 3) {
          for (let k = 0; k < 3; k++) { zashikiCrescent(b, b.aim() + (k - 1) * 0.3); yield 16; }
        }
        yield dv(54, 44, 36, 30);
        if (m === 3) b.wander(50, 50);
      }
    },
  },
];

// ------------------------------------------------------------
//  道中の敵
// ------------------------------------------------------------

// 鈴を鳴らす妖精：降りてきて止まり、輪と、少し遅れて響く輪を撃つ
function bellFairy(x, stopY = 90) {
  return spawnEnemy({
    x, y: -16, hp: 40, color: 'yellow', score: 3000, drops: { power: 2, point: 2 },
    script: function* (e) {
      yield* e.moveTo(x, stopY, 50);
      for (let k = 0; k < dv(2, 2, 3, 3); k++) {
        const n = dv(8, 12, 16, 20), off = rand(TAU);
        fireRing({ x: e.x, y: e.y, n, angle: off, speed: 1.7, type: 'ball', color: 'yellow' });
        Sound.se('kira');
        yield 16;
        fireRing({ x: e.x, y: e.y, n, angle: off + Math.PI / n, speed: 1.3, type: 'small', color: 'orange', silent: true });
        yield 60;
      }
      e.setMove(0, -Math.PI / 2, 0.05);
    },
  });
}

STAGES.push({
  name: '瓦礫の空',
  nameEn: 'The Sky above the Rubble',
  bg: RubbleSkyBG,
  bgm: 'stage6',
  zako: 'handEye', // 道中の妖精と緑の手は「一つ目の手」の絵にする
  // この面のボス（管理者ページの一覧・ボスの攻撃を試す機能・テストが使う。ボスを増やしたらここにも書く）
  //   id: CHARA_INFO のID  phases: 攻撃の配列  mid: 中ボスなら true（名前を出さない）  bgm: ボス戦の曲  def: 見た目（スペルカードの背景・魔法陣の色など）
  bosses: [
    { id: 'yanari6', phases: YANARI6_PHASES, mid: true, def: { spellBg: 'yanari', circleColor: '220,140,255' } },
    { id: 'zashiki', phases: ZASHIKI_PHASES, bgm: 'boss6', def: { spellBg: 'zashiki', circleColor: '255,220,150', finalDrops: { power: 10, point: 24, bigpower: 1 } } },
  ],
  // 最後の面なので、いちばん難しい
  speedScale: 1.2,
  densityScale: 1.45,
  hpScale: 1.25,
  *script(g) {
    yield 160;
    // 前半：大群 → 降ってくるがれき → 鈴の妖精 → 紙きれと狙撃
    g.tasks.add(swarmStream(-1, 16, { color: 'blue' }));
    yield 50;
    g.tasks.add(swarmStream(1, 16, { color: 'blue' }));
    yield 120;
    g.tasks.add(tileShower(420, dv(20, 30, 42, 56), ['purple', 'blue', 'white'], true));
    yield 100;
    [96, 288].forEach(x => bellFairy(x, 90));
    yield 160;
    g.tasks.add(paperRain(300, dv(30, 42, 56, 70)));
    yield 60;
    [80, 192, 304].forEach(x => sniperFairy(x, 100));
    yield 160;
    [100, 284].forEach(x => handEnemy(x, { stopY: 120 }));
    yield 160;
    yield* waitClear(300);

    // 中ボス：家鳴 鳴音（名前は出さない。会話のあと戦い、奥へ逃げる）
    const mid = g.spawnStageBoss('yanari6', { x: FIELD_W / 2, y: -50 });
    yield* mid.moveTo(FIELD_W / 2, 100, 60);
    yield* g.talk(STORY.stage6mid[g.charId].before);
    yield* g.fight(mid, YANARI6_PHASES);
    if (mid.hp <= 0) dropItems(mid.x, mid.y, { power: 6, point: 10, bomb: 1 });
    if (STORY.stage6mid[g.charId].after.length) yield* g.talk(STORY.stage6mid[g.charId].after);
    yield* g.bossDown(mid, true);
    yield 60;

    // 後半：大妖精 → 鈴の妖精とうずまき → レーザー → 大群 → 一列の妖精
    splitterFairy(110);
    yield 40;
    splitterFairy(274);
    yield 200;
    for (let k = 0; k < 3; k++) { bellFairy(rand(60, FIELD_W - 60), 80 + k * 20); yield 70; }
    g.tasks.add(swirlWave(-1, 10));
    g.tasks.add(swirlWave(1, 10));
    yield 200;
    [70, 314].forEach(x => laserFairy(x, 110));
    yield 120;
    g.tasks.add(tileShower(480, dv(30, 44, 60, 80), ['purple', 'blue', 'white'], true));
    for (let w = 0; w < 3; w++) {
      g.tasks.add(swarmStream(-1, 12, { y: 30 + w * 30, color: w % 2 ? 'red' : 'blue' }));
      g.tasks.add(swarmStream(1, 12, { y: 30 + w * 30, color: w % 2 ? 'red' : 'blue' }));
      yield 110;
    }
    [80, 304].forEach(x => sniperFairy(x, 100));
    yield 160;
    fairyLine(7, 50);
    yield* waitClear(900);
    yield 120;
  },
  // ボス戦（キー「V」のときはここから始まる）
  *boss(g) {
    const boss = g.spawnStageBoss('zashiki', { x: FIELD_W / 2, y: -50 });
    yield* boss.moveTo(FIELD_W / 2, 100, 70);
    yield* g.talk(STORY.stage6[g.charId].before);
    yield* g.fight(boss, ZASHIKI_PHASES);
    yield* g.bossDown(boss);
    yield* g.talk(STORY.stage6[g.charId].after);
  },
});
