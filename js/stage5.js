'use strict';
// ============================================================
//  5面：崩れゆく座敷 ― 中ボス：家鳴 鳴音（名前は出さない）／ボス：家鳴 鳴音
//  崩れていく屋敷（背景 CollapseBG）。瓦や梁が落ちてくる
//  道中の敵は4面（js/stage4.js）と共通のものも使う
// ============================================================

// ガタッと止まり、ピシッと向きを変えて進む弾（家がきしむ音のように）
function creakScript(turn, cycles = 6) {
  return function* (bl) {
    for (let k = 0; k < cycles; k++) {
      yield 22;
      const sp = bl.speed;
      bl.speed = 0;
      yield 14;
      bl.angle += turn;
      bl.speed = Math.max(sp, dv(1.6, 1.9, 2.2, 2.5));
    }
  };
}

// 天井のかけら：上から落ちてきて、途中で砕けて小さな弾の輪になる
function ceilingChunk(x) {
  const breakY = rand(220, FIELD_H - 90);
  return fire({
    x, y: -16, speed: 0, ay: 0.05, maxFall: dv(2.4, 2.8, 3.2, 3.6), type: 'large', color: 'dark', delay: 30, silent: true,
    script: function* (bl) {
      while (bl.y < breakY) yield;
      fireRing({ x: bl.x, y: bl.y, n: dv(8, 10, 12, 16), angle: rand(TAU), speed: 1.6, type: 'small', color: 'purple', silent: true });
      bl.alive = false;
    },
  });
}

// ------------------------------------------------------------
//  中ボス：家鳴 鳴音（名前は出さない。少しだけ戦って奥へ逃げる）
// ------------------------------------------------------------
const YANARI_MID_PHASES = [
  {
    type: 'non', hp: 1000, time: 25,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        fireRing({ x: b.x, y: b.y, n: dv(12, 16, 20, 26), angle: rand(TAU), speed: 1.8, type: 'ball', color: loop % 2 ? 'purple' : 'pink' });
        yield 30;
        fireFan({ x: b.x, y: b.y, n: dv(3, 3, 5, 5), spread: 0.35, angle: b.aim(), speed: 2.6, type: 'rice', color: 'white' });
        yield 30;
        if (loop % 3 === 2) b.wander(50, 60);
      }
    },
  },
  {
    // がたがた震えながら進む弾の輪
    type: 'spell', name: '鳴符「家鳴りの前ぶれ」', hp: 1100, time: 30,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      for (let loop = 0; ; loop++) {
        const n = dv(16, 20, 26, 32), off = rand(TAU);
        for (let i = 0; i < n; i++) {
          fire({
            x: b.x, y: b.y, angle: off + (i * TAU) / n, speed: 1.7, type: 'small', color: 'purple', silent: true,
            script: function* (bl) { const a0 = bl.angle; for (;;) { yield 8; bl.angle = a0 + rand(-0.35, 0.35); } },
          });
        }
        Sound.se('tan');
        yield dv(40, 32, 26, 20);
        if (loop % 4 === 3) b.wander(50, 60);
      }
    },
  },
];

// ------------------------------------------------------------
//  ボス：家鳴 鳴音（家をきしませる妖怪。狂おしき住処のプロデューサー）
//  拍に合わせた輪・止まっては曲がる弾・落ちてくる天井・かたむく屋敷
// ------------------------------------------------------------
const YANARI_PHASES = [
  {
    // 拍に合わせて、輪と扇を交互に
    type: 'non', hp: 1200, time: 30,
    *script(b) {
      yield 30;
      for (let beat = 0; ; beat++) {
        if (beat % 2 === 0) {
          fireRing({ x: b.x, y: b.y, n: dv(14, 18, 24, 30), angle: rand(TAU), speed: dv(1.6, 1.9, 2.2, 2.5), type: 'ball', color: beat % 4 ? 'purple' : 'pink' });
        } else {
          fireFan({ x: b.x, y: b.y, n: dv(5, 5, 7, 9), spread: 0.8, angle: b.aim(), speed: 2.4, type: 'rice', color: 'white' });
          if (DIFF >= 2) fireFan({ x: b.x, y: b.y, n: 5, spread: 1.2, angle: b.aim(), speed: 1.7, type: 'rice', color: 'blue' });
        }
        if (beat % 8 === 7) b.wander(50, 70);
        yield 25;
      }
    },
  },
  {
    // ガタッ（止まる）、ピシッ（向きを変えて進む）をくり返す輪
    type: 'spell', name: '鳴符「ガタピシ・ラプソディ」', hp: 1600, time: 45,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      for (let loop = 0; ; loop++) {
        const n = dv(14, 18, 24, 30), off = rand(TAU), turn = (loop % 2 ? 1 : -1) * 0.25;
        for (let i = 0; i < n; i++) {
          fire({ x: b.x, y: b.y, angle: off + (i * TAU) / n, speed: 2.2, type: 'rice', color: loop % 2 ? 'pink' : 'purple', silent: true, script: creakScript(turn) });
        }
        Sound.se('tan');
        yield dv(56, 46, 38, 30);
        if (loop % 3 === 2) b.wander(50, 60);
      }
    },
  },
  {
    // 回る十字と、ときどき輪
    type: 'non', hp: 1300, time: 30,
    *script(b) {
      yield 30;
      let a = rand(TAU);
      for (let f = 0; ; f++) {
        if (f % dv(5, 4, 3, 3) === 0) {
          for (let k = 0; k < 4; k++) fire({ x: b.x, y: b.y, angle: a + (k * TAU) / 4, speed: 2.4, type: 'rice', color: 'purple', silent: true });
          a += dv(0.07, 0.08, 0.09, 0.1);
        }
        if (f % 50 === 0) fireRing({ x: b.x, y: b.y, n: dv(10, 14, 18, 24), angle: rand(TAU), speed: 1.5, type: 'ball', color: 'pink' });
        if (f % 20 === 0) Sound.se('tan');
        if (f % 200 === 199) b.wander(50, 50);
        yield;
      }
    },
  },
  {
    // 天井落とし：上から天井のかけらが落ちてきて、砕ける
    type: 'spell', name: '崩符「天井落とし」', hp: 1700, time: 45,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 70, 40);
      for (let f = 0; ; f++) {
        if (f % dv(36, 28, 22, 18) === 0) ceilingChunk(rand(20, FIELD_W - 20));
        if (f % 70 === 35) fireFan({ x: b.x, y: b.y, n: dv(3, 5, 5, 7), spread: 0.5, angle: b.aim(), speed: 2.4, type: 'rice', color: 'pink' });
        if (f % 240 === 200) b.wander(60, 40);
        yield;
      }
    },
  },
  {
    // 二重のうずまき
    type: 'non', hp: 1300, time: 30,
    *script(b) {
      yield 30;
      let a = 0;
      for (let f = 0; ; f++) {
        if (f % dv(4, 3, 3, 2) === 0) {
          fire({ x: b.x, y: b.y, angle: a, speed: 2, type: 'ball', color: 'purple', silent: true });
          fire({ x: b.x, y: b.y, angle: -a + Math.PI, speed: 2, type: 'ball', color: 'pink', silent: true });
          if (DIFF >= 1) fire({ x: b.x, y: b.y, angle: a + Math.PI, speed: 1.6, type: 'small', color: 'white', silent: true });
          a += 0.21;
        }
        if (f % 20 === 0) Sound.se('tan');
        if (f % 90 === 45) fireFan({ x: b.x, y: b.y, n: 3, spread: 0.3, angle: b.aim(), speed: 2.8, type: 'large', color: 'purple' });
        yield;
      }
    },
  },
  {
    // 傾く住処：すべての弾が、ゆっくり左右に流される（流れる向きは時間でかわる）
    type: 'spell', name: '震符「傾く住処」', hp: 1800, time: 50,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 100, 40);
      const tilt = () => Math.sin(G.frame * 0.012) * dv(0.9, 1.1, 1.3, 1.5);
      for (let loop = 0; ; loop++) {
        const n = dv(16, 20, 26, 32), off = rand(TAU);
        for (let i = 0; i < n; i++) {
          fire({
            x: b.x, y: b.y, angle: off + (i * TAU) / n, speed: dv(1.3, 1.5, 1.7, 1.9), type: 'ball', color: loop % 2 ? 'purple' : 'blue', silent: true,
            script: function* (bl) { for (;;) { bl.evx = tilt(); yield; } },
          });
        }
        Sound.se('tan');
        yield 30;
        fireFan({ x: b.x, y: b.y, n: dv(3, 3, 5, 5), spread: 0.4, angle: b.aim(), speed: 2.4, type: 'rice', color: 'pink' });
        yield dv(30, 24, 20, 16);
      }
    },
  },
  {
    // 最後のスペルカード：拍ごとに、輪・ガタピシ弾・天井落としを順番に
    type: 'spell', name: '「狂おしき住処のプロデュース」', hp: 2000, time: 55,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      for (let beat = 0; ; beat++) {
        const m = beat % 4;
        if (m === 0) fireRing({ x: b.x, y: b.y, n: dv(16, 20, 26, 32), angle: rand(TAU), speed: dv(1.6, 1.9, 2.2, 2.5), type: 'ball', color: 'pink' });
        if (m === 1 || m === 3) {
          const n = dv(8, 10, 12, 16), off = rand(TAU);
          for (let i = 0; i < n; i++) {
            fire({ x: b.x, y: b.y, angle: off + (i * TAU) / n, speed: 2.2, type: 'rice', color: 'purple', silent: true, script: creakScript(m === 1 ? 0.4 : -0.4, 3) });
          }
        }
        if (m === 2) for (let k = 0; k < dv(1, 2, 2, 3); k++) ceilingChunk(rand(20, FIELD_W - 20));
        if (beat % 8 === 7) b.wander(60, 60);
        Sound.se('tan');
        yield dv(28, 24, 21, 18);
      }
    },
  },
];

// ------------------------------------------------------------
//  道中の敵
// ------------------------------------------------------------

// 落ちてくる梁：横いっぱいの予告線のあと、梁（横のレーザー）が落ちる
function fallingBeam(y, fromLeft = true) {
  return fireLaser({ x: fromLeft ? -10 : FIELD_W + 10, y, angle: fromLeft ? 0 : Math.PI, length: FIELD_W + 20, width: 18, warn: 60, dur: 26, color: 'orange' });
}

STAGES.push({
  name: '崩れゆく座敷',
  nameEn: 'The Crumbling Mansion',
  bg: CollapseBG,
  bgm: 'stage5',
  zako: 'handEye', // 道中の妖精と緑の手は「一つ目の手」の絵にする
  // この面のボス（管理者ページの一覧・ボスの攻撃を試す機能・テストが使う。ボスを増やしたらここにも書く）
  //   id: CHARA_INFO のID  phases: 攻撃の配列  mid: 中ボスなら true（名前を出さない）  bgm: ボス戦の曲  def: 見た目（スペルカードの背景・魔法陣の色など）
  bosses: [
    { id: 'yanariMid', phases: YANARI_MID_PHASES, mid: true, def: { spellBg: 'yanari', circleColor: '220,140,255' } },
    { id: 'yanari', phases: YANARI_PHASES, bgm: 'boss5', def: { spellBg: 'yanari', circleColor: '220,140,255', finalDrops: { power: 10, point: 20, bigpower: 1 } } },
  ],
  // 5面は4面よりさらに難しい
  speedScale: 1.1,
  densityScale: 1.25,
  hpScale: 1.15,
  *script(g) {
    yield 160;
    // 前半：大群 → 崩れて降ってくる瓦 → 狙撃 → 落ちてくる梁
    g.tasks.add(swarmStream(-1, 16, { color: 'purple' }));
    yield 50;
    g.tasks.add(swarmStream(1, 16, { color: 'purple' }));
    yield 120;
    g.tasks.add(tileShower(420, dv(18, 26, 36, 48), ['purple', 'blue', 'white'], true));
    yield 100;
    [96, 288].forEach(x => sniperFairy(x, 90));
    yield 140;
    fallingBeam(rand(230, 300), true);
    yield 90;
    fallingBeam(rand(320, 400), false);
    yield 90;
    for (let i = 0; i < 4; i++) { wallPillar(i % 2 ? 1 : -1, i * 10); yield 50; }
    g.tasks.add(paperRain(300, dv(24, 34, 46, 58)));
    yield 120;
    [100, 284].forEach(x => handEnemy(x, { stopY: 120 }));
    yield 200;
    yield* waitClear(300);

    // 中ボス：家鳴 鳴音（名前は出さない。少し戦って奥へ逃げる）
    const mid = g.spawnStageBoss('yanariMid', { x: FIELD_W / 2, y: -50 });
    yield* mid.moveTo(FIELD_W / 2, 100, 60);
    yield* g.fight(mid, YANARI_MID_PHASES);
    if (mid.hp <= 0) dropItems(mid.x, mid.y, { power: 6, point: 8, bomb: 1 });
    yield* g.bossDown(mid, true);
    yield 60;

    // 後半：大妖精 → 梁と瓦 → 大群と紙きれ → 一列の妖精
    splitterFairy(110);
    yield 40;
    splitterFairy(274);
    yield 160;
    for (let k = 0; k < 3; k++) {
      fallingBeam(rand(200, 400), k % 2 === 0);
      yield 70;
    }
    g.tasks.add(tileShower(480, dv(24, 36, 50, 68), ['purple', 'blue', 'white'], true));
    for (let i = 0; i < 6; i++) { wallPillar(i % 2 ? 1 : -1); yield 45; }
    yield* waitClear(500);
    for (let w = 0; w < 3; w++) {
      g.tasks.add(swarmStream(-1, 12, { y: 30 + w * 30, color: w % 2 ? 'red' : 'purple' }));
      g.tasks.add(swarmStream(1, 12, { y: 30 + w * 30, color: w % 2 ? 'red' : 'purple' }));
      yield 110;
    }
    g.tasks.add(paperStream(-1, dv(12, 16, 20, 24), 160));
    g.tasks.add(paperStream(1, dv(12, 16, 20, 24), 240));
    [80, 304].forEach(x => sniperFairy(x, 100));
    yield 160;
    fairyLine(7, 50);
    yield 200;
    fallingBeam(rand(260, 380), true);
    yield* waitClear(900);
    yield 120;
  },
  // ボス戦（キー「V」のときはここから始まる）
  *boss(g) {
    const boss = g.spawnStageBoss('yanari', { x: FIELD_W / 2, y: -50 });
    yield* boss.moveTo(FIELD_W / 2, 100, 70);
    yield* g.talk(STORY.stage5[g.charId].before);
    yield* g.fight(boss, YANARI_PHASES);
    yield* g.bossDown(boss);
    yield* g.talk(STORY.stage5[g.charId].after);
  },
});
