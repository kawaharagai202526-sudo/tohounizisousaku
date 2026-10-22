'use strict';
// ============================================================
//  4面：借りものの間 ― 中ボス：？？？（赤いパーカーの子。名前は未定）／ボス：栂尾 芯
//  人里の家から借りてきた部屋を次々に突き抜けて進む（背景 RoomsBG）
//  道中は紺珠伝（狙いを定めた弾・レーザー）と妖々夢（弱い妖精の大群）を参考にしている
// ============================================================

// ------------------------------------------------------------
//  中ボス：？？？（ぶかぶかの赤いパーカーの子。2.1.0 では3面の中ボスだった。名前は出さない）
// ------------------------------------------------------------
const MIDBOSS4_PHASES = [
  {
    // ぶかぶかの袖：左右の袖口から、振り子のように弾がこぼれ出す。ときどき自機を狙う
    type: 'non', hp: 1000, time: 25,
    *script(b) {
      yield 30;
      for (let f = 0; ; f++) {
        if (f % dv(6, 5, 4, 3) === 0) {
          const sway = Math.sin(f * 0.03) * 0.8;
          for (const side of [-1, 1]) {
            fire({ x: b.x + side * 16, y: b.y + 8, angle: Math.PI / 2 + side * (0.45 + sway), speed: dv(1.8, 2.1, 2.4, 2.7), type: 'rice', color: side < 0 ? 'red' : 'pink', silent: true });
          }
        }
        if (f % 20 === 0) Sound.se('tan');
        if (f % dv(90, 75, 60, 50) === 40) fireFan({ x: b.x, y: b.y, n: dv(3, 5, 5, 7), spread: 0.45, angle: b.aim(), speed: 2.6, type: 'ball', color: 'green' });
        if (f % 240 === 200) b.wander(60, 50);
        yield;
      }
    },
  },
  {
    // 市松模様（チェックの柄）の弾が上から降りてくる。ひとマスおきのすき間を抜ける
    type: 'spell', name: '間符「市松の間取り」', hp: 1100, time: 32,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 80, 40);
      const cell = dv(48, 42, 38, 34), speed = dv(1.1, 1.3, 1.5, 1.6);
      const cols = Math.ceil(FIELD_W / cell);
      for (let row = 0; ; row++) {
        // Hard 以上は2段ごとに斜めに流れる
        const drift = DIFF >= 2 ? (row % 4 < 2 ? 0.22 : -0.22) : 0;
        for (let i = 0; i < cols; i++) {
          if ((i + row) % 2) continue;
          fire({ x: (i + 0.5) * cell, y: -6, angle: Math.PI / 2 + drift, speed, type: 'ball', color: row % 2 ? 'red' : 'white', silent: true });
        }
        if (row % 3 === 2) fireRing({ x: b.x, y: b.y, n: dv(8, 12, 16, 20), angle: b.aim(), speed: 1.9, type: 'rice', color: 'green' });
        else Sound.se('tan');
        // 1マス分進んだら次の段（市松になる）
        yield Math.round(cell / (speed * bulletSpeedK()));
      }
    },
  },
];

// ------------------------------------------------------------
//  ボス：栂尾 芯（屋敷を支える柱のような子。大きな掛矢を持つ）
//  柱（縦のレーザー）・梁（横のレーザー）・年輪・掛矢の一撃
// ------------------------------------------------------------
const TOGANOO_PHASES = [
  {
    // 柱を立てる：上から弾の柱が何本も降りてくる
    type: 'non', hp: 1100, time: 30,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        const cols = dv(3, 4, 5, 6);
        const xs = [];
        for (let i = 0; i < cols; i++) xs.push(((i + 0.5) / cols) * FIELD_W + rand(-20, 20));
        for (let k = 0; k < dv(8, 10, 12, 14); k++) {
          for (const x of xs) fire({ x, y: -6, angle: Math.PI / 2, speed: dv(2.2, 2.6, 3, 3.4), type: 'rice', color: 'orange', silent: true });
          Sound.se('tan');
          yield 4;
        }
        yield 20;
        fireFan({ x: b.x, y: b.y, n: dv(5, 7, 9, 11), spread: 1.2, angle: b.aim(), speed: 2.2, type: 'ball', color: 'red' });
        yield 30;
        b.wander(60, 60);
        yield 20;
      }
    },
  },
  {
    // 大黒柱：縦のレーザーが立ち、合間に米粒弾の輪
    type: 'spell', name: '柱符「大黒柱の意地」', hp: 1500, time: 45,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 80, 40);
      for (let loop = 0; ; loop++) {
        const n = dv(2, 3, 4, 4);
        for (let i = 0; i < n; i++) {
          const x = i === 0 ? clamp(G.player.x + rand(-30, 30), 20, FIELD_W - 20) : rand(20, FIELD_W - 20);
          fireLaser({ x, y: -10, angle: Math.PI / 2, length: FIELD_H + 20, width: 22, warn: 50, dur: 60, color: 'orange' });
        }
        for (let f = 0; f < 110; f++) {
          if (f % dv(36, 30, 24, 20) === 0) fireRing({ x: b.x, y: b.y, n: dv(10, 14, 18, 22), angle: rand(TAU), speed: dv(1.4, 1.7, 2, 2.3), type: 'rice', color: 'yellow' });
          yield;
        }
        if (loop % 2) b.wander(60, 50);
      }
    },
  },
  {
    // 年輪：回る向きの違う三重の輪
    type: 'non', hp: 1200, time: 30,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        const n = dv(18, 24, 30, 36), off = rand(TAU);
        for (let r = 0; r < 3; r++) {
          const dir = r % 2 ? 1 : -1;
          for (let i = 0; i < n; i++) fire({ x: b.x, y: b.y, angle: off + (i * TAU) / n, speed: 1.3 + r * 0.35, angVel: dir * 0.004, type: 'rice', color: ['orange', 'yellow', 'red'][r], silent: true });
          Sound.se('tan');
          yield 8;
        }
        yield dv(60, 48, 40, 32);
        fireFan({ x: b.x, y: b.y, n: 3, spread: 0.25, angle: b.aim(), speed: 3, type: 'large', color: 'orange' });
        b.wander(60, 50);
        yield 30;
      }
    },
  },
  {
    // 渡り廊下の梁：横のレーザーが段々に渡され、梁からほこりが落ちる
    type: 'spell', name: '梁符「渡り廊下の梁」', hp: 1500, time: 45,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 70, 40);
      for (let loop = 0; ; loop++) {
        const rows = dv(2, 3, 3, 4);
        const gap = dv(90, 80, 72, 64);
        const top = rand(140, 200) - (rows - 1) * 30;
        for (let i = 0; i < rows; i++) {
          const fromLeft = (loop + i) % 2 === 0;
          fireLaser({ x: fromLeft ? -10 : FIELD_W + 10, y: top + i * gap, angle: fromLeft ? 0 : Math.PI, length: FIELD_W + 20, width: 16, warn: 55, dur: 50, color: 'yellow' });
        }
        for (let f = 0; f < 120; f++) {
          if (f % dv(8, 6, 5, 4) === 0) fire({ x: rand(10, FIELD_W - 10), y: -6, angle: Math.PI / 2, speed: rand(1.2, 2), type: 'dot', color: 'white', silent: true });
          if (f % 60 === 30) fireFan({ x: b.x, y: b.y, n: dv(3, 3, 5, 5), spread: 0.4, angle: b.aim(), speed: 2.4, type: 'ball', color: 'orange' });
          yield;
        }
      }
    },
  },
  {
    // 掛矢の一撃：振りかぶって打ちおろし、衝撃が広がる
    type: 'spell', name: '槌符「掛矢の大一番」', hp: 1600, time: 45,
    *script(b) {
      for (let loop = 0; ; loop++) {
        yield* b.moveTo(clamp(G.player.x, 60, FIELD_W - 60), 60, 40);
        yield 20;
        yield* b.moveTo(b.x, 150, 12, Ease.inQuad);
        Sound.se('kill');
        G.shake = 16;
        const n = dv(20, 26, 34, 42), off = rand(TAU);
        fireRing({ x: b.x, y: b.y, n, angle: off, speed: 2.4, type: 'ball', color: 'orange', silent: true });
        fireRing({ x: b.x, y: b.y, n: Math.round(n * 0.6), angle: off, speed: 1.5, type: 'large', color: 'red', silent: true });
        for (const s of [-1, 1]) {
          for (let k = 0; k < dv(4, 5, 6, 8); k++) fire({ x: b.x, y: b.y + 10, angle: s > 0 ? 0.25 : Math.PI - 0.25, speed: 1.2 + k * 0.35, type: 'rice', color: 'yellow', silent: true });
        }
        yield 40;
        yield* b.moveTo(b.x, 90, 30);
        yield dv(40, 30, 20, 14);
      }
    },
  },
  {
    // 朽ち果てぬ年輪：うずまきが続き、時間がたつほど輪が増える
    type: 'spell', name: '木符「朽ち果てぬ年輪」', hp: 1800, time: 50,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 120, 40);
      let a = 0;
      for (let f = 0; ; f++) {
        const arms = dv(4, 5, 6, 7);
        if (f % dv(8, 6, 5, 4) === 0) {
          for (let k = 0; k < arms; k++) {
            fire({ x: b.x, y: b.y, angle: a + (k * TAU) / arms, speed: 1.9, type: 'rice', color: 'orange', silent: true });
            if (DIFF >= 1) fire({ x: b.x, y: b.y, angle: -a * 0.8 + (k * TAU) / arms, speed: 1.5, type: 'small', color: 'yellow', silent: true });
          }
          a += 0.11;
        }
        const ringEvery = Math.max(dv(70, 60, 50, 40) - Math.floor(f / 300) * 6, 26);
        if (f % ringEvery === 0) fireRing({ x: b.x, y: b.y, n: dv(12, 16, 22, 28), angle: rand(TAU), speed: 1.3, type: 'ball', color: 'red' });
        if (f % 20 === 0) Sound.se('tan');
        yield;
      }
    },
  },
];

// ------------------------------------------------------------
//  道中の敵（5面でも使う）
// ------------------------------------------------------------

// 妖々夢風：とても弱い妖精が大群で弧を描いて流れてくる
function* swarmStream(side, n, o = {}) {
  for (let i = 0; i < n; i++) {
    spawnEnemy({
      x: side < 0 ? -10 : FIELD_W + 10, y: o.y ?? 30, hp: 4, color: o.color || 'blue', score: 300,
      drops: i % 4 === 0 ? { power: 1 } : i % 4 === 2 ? { point: 1 } : {},
      script: function* (e) {
        e.setMove(3.2, side < 0 ? 0.35 : Math.PI - 0.35, 0, side < 0 ? 0.012 : -0.012);
        yield 36;
        if (DIFF >= 1 && (DIFF >= 2 || i % 3 === 0) && e.onScreen) {
          fireFan({ x: e.x, y: e.y, n: dv(1, 1, 1, 3), spread: 0.3, angle: e.aim(), speed: dv(1.8, 2.1, 2.5, 2.9), type: 'small', color: 'cyan' });
        }
        yield 40;
        e.angVel = 0;
      },
    });
    yield o.gap ?? 7;
  }
}

// 紺珠伝風：リング弾をいったん止めてから、自機へ向けて飛ばす妖精
function sniperFairy(x, stopY = 90) {
  return spawnEnemy({
    x, y: -16, hp: 36, color: 'purple', score: 3000, drops: { power: 2, point: 2 },
    script: function* (e) {
      yield* e.moveTo(x, stopY, 50);
      for (let v = 0; v < 2; v++) {
        const n = dv(8, 12, 16, 22), off = rand(TAU);
        for (let i = 0; i < n; i++) {
          fire({
            x: e.x, y: e.y, angle: off + (i * TAU) / n, speed: 2.6, accel: -0.07, minSpeed: 0, type: 'rice', color: 'purple', silent: i > 0,
            script: function* (bl) {
              yield 45;
              bl.angle = aimAt(bl.x, bl.y);
              bl.accel = 0.04;
              bl.maxSpeed = dv(1.6, 2, 2.4, 2.8);
              bl.setColor('pink');
            },
          });
        }
        yield 70;
      }
      e.setMove(0, -Math.PI / 2, 0.05);
    },
  });
}

// 壁ぎわの柱。背景と一緒に流れながら、年輪の目から自機を狙ってレーザーを撃つ
function wallPillar(side, wait = 0) {
  return spawnEnemy({
    x: side < 0 ? 22 : FIELD_W - 22, y: -24, kind: 'pillar', side: side < 0 ? 1 : -1, hp: 24, r: 14, noBody: true, score: 2500,
    drops: { point: 2 }, speed: 1.0, angle: Math.PI / 2,
    script: function* (e) {
      yield 70 + wait;
      for (let k = 0; k < dv(1, 1, 2, 2); k++) {
        fireLaser({ x: e.x, y: e.y, angle: e.aim(), width: 10, warn: 50, dur: 28, color: 'orange', follow: l => { if (e.alive) { l.x = e.x; l.y = e.y; } } });
        yield 110;
      }
    },
  });
}

// 破れたふすまの紙きれ：弾は撃たないが、ぶつかると被弾する。一撃で倒せる
function paperScrap(x, y, angle, speed, o = {}) {
  const ph = rand(TAU);
  return spawnEnemy({
    x, y, kind: 'paper', hp: 0.4, r: 10, score: 200, speed, angle,
    drops: rng.next() < 0.12 ? { point: 1 } : {},
    script: function* (e) {
      // ひらひらと進行方向を揺らしながら舞う
      for (;;) {
        e.angle = angle + Math.sin(e.frame * (o.freq ?? 0.1) + ph) * (o.amp ?? 0.7);
        yield;
      }
    },
  });
}

// 上から紙きれが舞い落ちてくる
function* paperRain(frames, count) {
  const interval = Math.max(1, Math.floor(frames / count));
  for (let i = 0; i < count; i++) {
    paperScrap(rand(16, FIELD_W - 16), -12, Math.PI / 2 + rand(-0.3, 0.3), rand(1.0, 1.6));
    yield interval;
  }
}

// 横から紙きれの群れが波打ちながら横切る
function* paperStream(side, n, y = 120) {
  for (let i = 0; i < n; i++) {
    paperScrap(side < 0 ? -12 : FIELD_W + 12, y + rand(-30, 30), side < 0 ? 0.2 : Math.PI - 0.2, 1.8, { amp: 0.5, freq: 0.08 });
    yield 8;
  }
}

// 横一列に並んだ妖精が真下へ弾を流し、弾の間が通り道になる
function fairyLine(n = 7, y = 60) {
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) * FIELD_W) / n;
    spawnEnemy({
      x, y: -16 - i * 6, hp: 18, color: 'blue', score: 1500, drops: i % 2 ? { point: 1 } : { power: 1 },
      script: function* (e) {
        yield* e.moveTo(x, y, 50);
        for (let f = 0; f < 200; f++) {
          if (f % dv(24, 18, 12, 9) === 0) fire({ x: e.x, y: e.y, angle: Math.PI / 2, speed: 2.2, type: 'kunai', color: 'cyan' });
          if (DIFF >= 2 && f % 60 === 30 && i % 2 === 0) fire({ x: e.x, y: e.y, angle: e.aim(), speed: 2.4, type: 'ball', color: 'blue' });
          yield;
        }
        e.setMove(0, -Math.PI / 2, 0.05);
      },
    });
  }
}

// 大玉を撃ち、しばらくすると大玉が小玉のリングに割れる大妖精
function splitterFairy(x) {
  return spawnEnemy({
    x, y: -24, kind: 'bigfairy', color: 'blue', hp: 260, r: 18, score: 20000, drops: { power: 4, point: 4 },
    script: function* (e) {
      yield* e.moveTo(x, 110, 60);
      for (let k = 0; k < 5; k++) {
        const n = dv(2, 3, 4, 5);
        for (let i = 0; i < n; i++) {
          fire({
            x: e.x, y: e.y, angle: e.aim() + (i - (n - 1) / 2) * 0.45, speed: 2.2, accel: -0.03, minSpeed: 0.6, type: 'large', color: 'blue',
            script: function* (bl) {
              yield 50;
              fireRing({ x: bl.x, y: bl.y, n: dv(6, 8, 10, 12), angle: rand(TAU), speed: 1.4, type: 'small', color: 'cyan', silent: true });
              bl.alive = false;
            },
          });
        }
        yield 70;
      }
      e.setMove(0, -Math.PI / 2, 0.04);
    },
  });
}


STAGES.push({
  name: '借りものの間',
  nameEn: 'A Mansion of Borrowed Rooms',
  bg: RoomsBG,
  bgm: 'stage4',
  zako: 'handEye', // 道中の妖精と緑の手は「一つ目の手」の絵にする
  // この面のボス（管理者ページの一覧・ボスの攻撃を試す機能・テストが使う。ボスを増やしたらここにも書く）
  //   id: CHARA_INFO のID  phases: 攻撃の配列  mid: 中ボスなら true（名前を出さない）  bgm: ボス戦の曲  def: 見た目（スペルカードの背景・魔法陣の色など）
  bosses: [
    { id: 'midboss4', phases: MIDBOSS4_PHASES, mid: true, def: { spellBg: 'ichimatsu', circleColor: '230,110,150' } },
    { id: 'toganoo', phases: TOGANOO_PHASES, bgm: 'boss4', def: { spellBg: 'hashira', circleColor: '255,190,110' } },
  ],
  // 4面からは全難易度で前の面より難しい（弾速・全方位弾の数・ボスの体力）
  speedScale: 1.08,
  densityScale: 1.2,
  hpScale: 1.1,
  *script(g) {
    yield 160;
    // 前半：大群 → 狙撃 → 柱のレーザー
    g.tasks.add(swarmStream(-1, 18));
    yield 50;
    g.tasks.add(swarmStream(1, 18));
    yield 120;
    g.tasks.add(paperRain(300, dv(30, 42, 56, 70)));
    yield 200;
    [96, 288].forEach(x => sniperFairy(x, 90));
    yield 150;
    sniperFairy(192, 70);
    yield 60;
    [100, 284].forEach(x => handEnemy(x, { stopY: 130 }));
    yield 60;
    for (let i = 0; i < 4; i++) { wallPillar(i % 2 ? 1 : -1, i * 10); yield 50; }
    yield 100;
    g.tasks.add(swarmStream(-1, 14, { y: 80, color: 'green' }));
    g.tasks.add(swarmStream(1, 14, { y: 80, color: 'green' }));
    yield 120;
    g.tasks.add(paperStream(-1, dv(10, 14, 18, 22), 200));
    yield 120;
    fairyLine(7, 60);
    yield 320;
    yield* waitClear(300);

    // 中ボス：？？？（赤いパーカーの子。名前は出さない）
    const mid = g.spawnStageBoss('midboss4', { x: FIELD_W / 2, y: -50 });
    yield* mid.moveTo(FIELD_W / 2, 100, 60);
    yield* g.fight(mid, MIDBOSS4_PHASES);
    if (mid.hp <= 0) dropItems(mid.x, mid.y, { power: 6, point: 8, bomb: 1 });
    yield* g.bossDown(mid, true);
    yield 60;

    // 後半：大玉の大妖精 → 降ってくる紙片と柱 → 紙きれの大群 → 大群
    splitterFairy(110);
    yield 40;
    splitterFairy(274);
    yield 200;
    g.tasks.add(tileShower(420, dv(20, 30, 44, 60), ['white', 'orange', 'yellow'], false));
    for (let i = 0; i < 6; i++) { wallPillar(i % 2 ? 1 : -1); yield 45; }
    yield* waitClear(500);
    g.tasks.add(paperRain(480, dv(50, 74, 98, 124)));
    g.tasks.add(paperStream(-1, dv(12, 16, 20, 24), 150));
    yield 160;
    g.tasks.add(paperStream(1, dv(12, 16, 20, 24), 230));
    yield 280;
    for (let w = 0; w < 3; w++) {
      g.tasks.add(swarmStream(-1, 12, { y: 30 + w * 30, color: w % 2 ? 'red' : 'blue' }));
      g.tasks.add(swarmStream(1, 12, { y: 30 + w * 30, color: w % 2 ? 'red' : 'blue' }));
      yield 110;
    }
    [80, 304].forEach(x => sniperFairy(x, 100));
    [150, 234].forEach(x => handEnemy(x, { stopY: 150 }));
    yield 160;
    fairyLine(6, 50);
    yield* waitClear(900);
    yield 120;
  },
  // ボス戦（キー「V」のときはここから始まる）
  *boss(g) {
    const boss = g.spawnStageBoss('toganoo', { x: FIELD_W / 2, y: -50 });
    yield* boss.moveTo(FIELD_W / 2, 100, 70);
    yield* g.talk(STORY.stage4[g.charId].before);
    yield* g.fight(boss, TOGANOO_PHASES);
    yield* g.bossDown(boss);
    yield* g.talk(STORY.stage4[g.charId].after);
  },
});
