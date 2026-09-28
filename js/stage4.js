'use strict';
// ============================================================
//  4面：星屑の洞窟 ― 中ボス：スターサファイア／ボス：瑠璃
//  道中は紺珠伝（狙いを定めた弾・レーザー）と
//  妖々夢（弱い妖精の大群）を参考にしている
// ============================================================

// 星座のかたち（座標は -1〜1、edges は結ぶ星の番号）
const CONSTELLATIONS = [
  { name: '北斗七星', pts: [[-1, -0.3], [-0.6, -0.36], [-0.25, -0.2], [0.05, 0], [0.2, 0.45], [0.78, 0.55], [0.88, 0.05]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
  { name: 'カシオペヤ', pts: [[-1, -0.4], [-0.5, 0.4], [0, -0.1], [0.5, 0.4], [1, -0.4]], edges: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  { name: 'オリオン', pts: [[-0.5, -1], [0.5, -0.9], [-0.22, 0], [0, 0.05], [0.22, 0.1], [-0.55, 0.95], [0.5, 1]], edges: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]] },
  { name: '夏の大三角', pts: [[-0.85, -0.5], [0.85, -0.7], [0.1, 0.85]], edges: [[0, 1], [1, 2], [2, 0]] },
];

// 中ボス：スターサファイア
const STAR_MID4_PHASES = [
  {
    type: 'non', hp: 900, time: 25,
    *script(b) {
      yield 30;
      let a = 0;
      for (let f = 0; ; f++) {
        if (f % dv(5, 4, 3, 2) === 0) {
          for (const arm of [0, Math.PI]) {
            const curl = function* (bl) { yield 70; bl.angVel = 0; };
            fire({ x: b.x, y: b.y, angle: a + arm, speed: 2.4, accel: -0.02, minSpeed: 1.2, angVel: 0.012, type: 'small', color: 'purple', silent: true, script: curl });
            if (DIFF >= 1) fire({ x: b.x, y: b.y, angle: -a + arm + 0.5, speed: 2.4, accel: -0.02, minSpeed: 1.2, angVel: -0.012, type: 'small', color: 'blue', silent: true, script: curl });
          }
          a += 0.19;
        }
        if (f % 100 === 50) fireFan({ x: b.x, y: b.y, n: dv(1, 3, 3, 5), spread: 0.5, angle: b.aim(), speed: 2.2, type: 'bigstar', color: 'yellow' });
        if (f % 20 === 0) Sound.se('tan');
        yield;
      }
    },
  },
  {
    type: 'spell', name: '星座「コンステレーション・ドロー」', hp: 1100, time: 35,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 70, 40);
      for (let loop = 0; ; loop++) {
        const c = CONSTELLATIONS[loop % CONSTELLATIONS.length];
        const cx = rand(120, FIELD_W - 120), cy = rand(150, 240), sc = rand(75, 105), rot = rand(-0.5, 0.5);
        const cs = Math.cos(rot), sn = Math.sin(rot);
        const nodes = c.pts.map(([px, py]) => {
          const x = cx + (px * cs - py * sn) * sc, y = cy + (px * sn + py * cs) * sc;
          return fire({ x, y, speed: 0, type: 'bigstar', color: 'yellow', delay: 20 });
        });
        Sound.se('kira');
        yield 30;
        for (const [i, j] of c.edges) {
          const p = nodes[i], q = nodes[j];
          fireLaser({ x: p.x, y: p.y, angle: angleTo(p.x, p.y, q.x, q.y), length: dist(p.x, p.y, q.x, q.y), width: 10, warn: 50, dur: 45, color: 'cyan' });
        }
        for (let f = 0; f < 100; f++) {
          if (f % dv(40, 30, 24, 20) === 0) fireFan({ x: b.x, y: b.y, n: dv(1, 3, 3, 5), spread: 0.4, angle: b.aim(), speed: 2, type: 'star', color: 'white' });
          yield;
        }
        for (const nd of nodes) {
          if (!nd.alive) continue;
          fireRing({ x: nd.x, y: nd.y, n: dv(6, 8, 10, 12), angle: rand(TAU), speed: dv(1.2, 1.5, 1.8, 2.1), type: 'star', color: 'blue', silent: true });
          nd.alive = false;
        }
        Sound.se('tan');
        yield dv(70, 50, 40, 30);
      }
    },
  },
];

// ------------------------------------------------------------
//  4面ボス：瑠璃（提供画像のキャラクター）
//  鹿の角・瑠璃色の蝶の羽・本から、蝶・頁・枝分かれする角の弾幕
//  スペルカード名は仮のもの
// ------------------------------------------------------------

// 鹿の角のように、一定時間ごとに2つに枝分かれする弾
function antler(depth, spread) {
  return function* (bl) {
    yield 26;
    if (depth > 0 && bl.alive) {
      for (const s of [-1, 1]) {
        fire({ x: bl.x, y: bl.y, angle: bl.angle + s * spread, speed: bl.speed, type: 'rice', color: depth > 1 ? 'orange' : 'yellow', silent: true, delay: 4, script: antler(depth - 1, spread) });
      }
      bl.alive = false;
    }
  };
}
const stopCurl = frames => function* (bl) { yield frames; bl.angVel = 0; };

const BOSS4_PHASES = [
  {
    type: 'non', hp: 1100, time: 30,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        const dir = loop % 2 ? 1 : -1;
        fireRing({ x: b.x, y: b.y, n: dv(10, 14, 18, 24), angle: rand(TAU), speed: 2.2, accel: -0.02, minSpeed: 1.1, angVel: dir * 0.006, type: 'butterfly', color: dir > 0 ? 'blue' : 'cyan', script: stopCurl(90) });
        yield 30;
        fireFan({ x: b.x - 16, y: b.y, n: dv(1, 3, 3, 5), spread: 0.3, angle: b.aim(), speed: 2.2, type: 'amulet', color: 'blue' });
        yield 20;
        if (loop % 2) b.wander(60, 60);
      }
    },
  },
  {
    type: 'spell', name: '蝶符「瑠璃色の鱗粉」', hp: 1300, time: 40,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      for (;;) {
        // 大きな蝶が舞いながら鱗粉（小さな弾）をこぼしていく
        const n = dv(5, 6, 8, 10);
        const off = rand(TAU);
        for (let i = 0; i < n; i++) {
          const dir = i % 2 ? 1 : -1;
          fire({
            x: b.x, y: b.y, angle: off + (i * TAU) / n, speed: 1.6, angVel: dir * 0.012,
            type: 'butterfly', color: 'blue', scale: 1.5, hitR: 4.5,
            script: function* (bl) {
              for (let f = 0; f < 240; f++) {
                if (f % dv(12, 10, 8, 6) === 0) fire({ x: bl.x, y: bl.y, angle: rand(TAU), speed: rand(0.2, 0.6), type: 'dot', color: 'cyan', silent: true, delay: 6, life: 300 });
                if (f === 90) bl.angVel = 0;
                yield;
              }
            },
          });
        }
        yield dv(90, 75, 60, 50);
        b.wander(60, 50);
      }
    },
  },
  {
    type: 'non', hp: 1200, time: 30,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        // 本の頁をめくるように、左右へ扇状に札弾
        const dir = loop % 2 ? 1 : -1;
        const n = dv(10, 14, 18, 22);
        for (let i = 0; i < n; i++) {
          const a = Math.PI / 2 + dir * (-1.2 + (2.4 * i) / (n - 1));
          fire({ x: b.x - 16, y: b.y + 4, angle: a, speed: 1.7, type: 'amulet', color: 'blue', silent: i > 0 });
          if (DIFF >= 2) fire({ x: b.x - 16, y: b.y + 4, angle: a, speed: 1.2, type: 'amulet', color: 'white', silent: true });
          yield 2;
        }
        yield 16;
        fireRing({ x: b.x, y: b.y, n: dv(10, 14, 18, 22), angle: rand(TAU), speed: 1.4, type: 'small', color: 'cyan' });
        yield dv(40, 32, 24, 18);
        if (loop % 2) b.wander(60, 60);
      }
    },
  },
  {
    type: 'spell', name: '書符「めくれる頁の回廊」', hp: 1400, time: 45,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 70, 40);
      for (let row = 0; ; row++) {
        // 頁の列が上から降りてくる。すき間（通り道）は少しずつ動く
        const gapX = clamp(FIELD_W / 2 + Math.sin(row * 0.45) * 120 + Math.sin(row * 0.17) * 40, 50, FIELD_W - 50);
        const gap = dv(96, 80, 68, 58);
        for (let x = 8; x < FIELD_W; x += 16) {
          if (Math.abs(x - gapX) < gap / 2) continue;
          fire({ x, y: -8, angle: Math.PI / 2, speed: 1.3, type: 'amulet', color: row % 2 ? 'blue' : 'white', silent: true, delay: 0, margin: 30 });
        }
        Sound.se('tan');
        if (DIFF >= 1 && row % 3 === 2) fireFan({ x: b.x, y: b.y, n: dv(1, 1, 3, 3), spread: 0.3, angle: b.aim(), speed: 1.8, type: 'butterfly', color: 'cyan' });
        yield dv(46, 40, 34, 30);
      }
    },
  },
  {
    type: 'non', hp: 1200, time: 30,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        const n = dv(3, 4, 5, 6);
        const a = b.aim();
        for (let i = 0; i < n; i++) {
          fire({ x: b.x, y: b.y - 20, angle: a + (i - (n - 1) / 2) * 0.5, speed: 2, type: 'rice', color: 'orange', script: antler(dv(1, 2, 2, 3), 0.38) });
        }
        yield dv(70, 55, 45, 36);
        if (loop % 2) b.wander(60, 60);
      }
    },
  },
  {
    type: 'spell', name: '角符「森の王冠」', hp: 1500, time: 45,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 100, 40);
      for (let loop = 0; ; loop++) {
        // 頭の角から、枝分かれする弾を全方向へ
        const n = dv(5, 6, 7, 8);
        const off = loop * 0.3;
        for (let i = 0; i < n; i++) {
          fire({ x: b.x, y: b.y - 24, angle: off + (i * TAU) / n, speed: 1.8, type: 'kunai', color: 'orange', script: antler(dv(2, 2, 3, 3), 0.45) });
        }
        yield 40;
        fireFan({ x: b.x, y: b.y, n: dv(3, 3, 5, 5), spread: 0.5, angle: b.aim(), speed: 1.8, type: 'butterfly', color: 'blue' });
        yield dv(70, 56, 46, 38);
      }
    },
  },
  {
    type: 'spell', name: '「瑠璃蝶の夜想曲」', hp: 2200, time: 60, bonus: 5000000,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 100, 40);
      let a = 0;
      for (let f = 0; ; f++) {
        const heat = Math.min(1, f / 1800);
        // 蝶の渦
        if (f % Math.max(4, dv(10, 8, 7, 6) - Math.floor(heat * 2)) === 0) {
          for (const s of [0, Math.PI]) fire({ x: b.x, y: b.y, angle: a + s, speed: 1.5, type: 'butterfly', color: s ? 'cyan' : 'blue', silent: true });
          a += 0.23;
        }
        // 角の枝分かれ
        if (f % 150 === 75) {
          for (let i = 0; i < 3; i++) fire({ x: b.x, y: b.y - 24, angle: b.aim() + (i - 1) * 0.6, speed: 1.8, type: 'rice', color: 'orange', script: antler(dv(1, 1, 2, 2), 0.4) });
        }
        // 後半は頁の列も降ってくる（自機のいた場所が通り道）
        if (f > 900 && f % 120 === 0) {
          const safe = dv(70, 60, 50, 44);
          for (let x = 8; x < FIELD_W; x += 24) {
            if (Math.abs(x - G.player.x) > safe) fire({ x, y: -8, angle: Math.PI / 2, speed: 1.1, type: 'amulet', color: 'white', silent: true, delay: 0, margin: 30 });
          }
        }
        if (f % 20 === 0) Sound.se('tan');
        yield;
      }
    },
  },
];

// ------------------------------------------------------------
//  道中の敵
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

// 洞窟の壁に生えた水晶。背景と一緒に流れながら、自機を狙ってレーザーを撃つ
function wallCrystal(side, wait = 0) {
  return spawnEnemy({
    x: side < 0 ? 24 : FIELD_W - 24, y: -20, kind: 'crystal', side: side < 0 ? 1 : -1, hp: 24, r: 14, noBody: true, score: 2500,
    drops: { point: 2 }, speed: 1.0, angle: Math.PI / 2,
    script: function* (e) {
      yield 70 + wait;
      for (let k = 0; k < dv(1, 1, 2, 2); k++) {
        fireLaser({ x: e.x, y: e.y, angle: e.aim(), width: 10, warn: 50, dur: 28, color: 'cyan', follow: l => { if (e.alive) { l.x = e.x; l.y = e.y; } } });
        yield 110;
      }
    },
  });
}

// 瑠璃の青い蝶：弾は撃たないが、ぶつかると被弾する。毛玉と同じ大きさで一撃で倒せる
function blueButterfly(x, y, angle, speed, o = {}) {
  const ph = rand(TAU);
  return spawnEnemy({
    x, y, kind: 'butterfly', hp: 0.4, r: 10, score: 200, speed, angle,
    drops: rng.next() < 0.12 ? { point: 1 } : {},
    script: function* (e) {
      // ひらひらと進行方向を揺らしながら飛ぶ
      for (;;) {
        e.angle = angle + Math.sin(e.frame * (o.freq ?? 0.1) + ph) * (o.amp ?? 0.7);
        yield;
      }
    },
  });
}

// 上から蝶が舞い降りてくる
function* butterflyRain(frames, count) {
  const interval = Math.max(1, Math.floor(frames / count));
  for (let i = 0; i < count; i++) {
    blueButterfly(rand(16, FIELD_W - 16), -12, Math.PI / 2 + rand(-0.3, 0.3), rand(1.0, 1.6));
    yield interval;
  }
}

// 横から蝶の群れが波打ちながら横切る
function* butterflyStream(side, n, y = 120) {
  for (let i = 0; i < n; i++) {
    blueButterfly(side < 0 ? -12 : FIELD_W + 12, y + rand(-30, 30), side < 0 ? 0.2 : Math.PI - 0.2, 1.8, { amp: 0.5, freq: 0.08 });
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
  name: '星屑の洞窟',
  nameEn: 'The Grotto of Stardust',
  bg: CaveBG,
  bgm: 'stage4',
  *script(g) {
    yield 160;
    // 前半：妖精の大群 → 狙撃妖精 → 水晶のレーザー
    g.tasks.add(swarmStream(-1, 18));
    yield 50;
    g.tasks.add(swarmStream(1, 18));
    yield 120;
    g.tasks.add(butterflyRain(300, dv(24, 34, 44, 54)));
    yield 200;
    [96, 288].forEach(x => sniperFairy(x, 90));
    yield 150;
    sniperFairy(192, 70);
    yield 120;
    for (let i = 0; i < 4; i++) { wallCrystal(i % 2 ? 1 : -1, i * 10); yield 50; }
    yield 100;
    g.tasks.add(swarmStream(-1, 14, { y: 80, color: 'green' }));
    g.tasks.add(swarmStream(1, 14, { y: 80, color: 'green' }));
    yield 120;
    g.tasks.add(butterflyStream(-1, dv(10, 14, 18, 22), 200));
    yield 120;
    fairyLine(7, 60);
    yield 320;
    yield* waitClear(300);

    // 中ボス：スターサファイア
    const mid = g.spawnBoss('star', { spellBg: 'star', circleColor: '140,160,255', x: FIELD_W / 2, y: -50 });
    yield* mid.moveTo(FIELD_W / 2, 100, 60);
    yield* g.fight(mid, STAR_MID4_PHASES);
    if (mid.hp <= 0) dropItems(mid.x, mid.y, { power: 6, point: 8, bomb: 1 });
    yield* g.bossDown(mid, true);
    yield 60;

    // 後半：大玉の大妖精 → 星の雨と水晶 → 妖精の大群
    splitterFairy(110);
    yield 40;
    splitterFairy(274);
    yield 200;
    g.tasks.add(starShower(420, dv(20, 30, 44, 60), ['cyan', 'blue', 'white', 'purple'], true));
    for (let i = 0; i < 6; i++) { wallCrystal(i % 2 ? 1 : -1); yield 45; }
    yield* waitClear(500);
    // 青い蝶の大群
    g.tasks.add(butterflyRain(480, dv(40, 60, 80, 100)));
    g.tasks.add(butterflyStream(-1, dv(12, 16, 20, 24), 150));
    yield 160;
    g.tasks.add(butterflyStream(1, dv(12, 16, 20, 24), 230));
    yield 280;
    for (let w = 0; w < 3; w++) {
      g.tasks.add(swarmStream(-1, 12, { y: 30 + w * 30, color: w % 2 ? 'red' : 'blue' }));
      g.tasks.add(swarmStream(1, 12, { y: 30 + w * 30, color: w % 2 ? 'red' : 'blue' }));
      yield 110;
    }
    [80, 304].forEach(x => sniperFairy(x, 100));
    yield 160;
    fairyLine(6, 50);
    yield* waitClear(900);
    yield 120;

    // ボス：瑠璃（ボス曲は会話の途中で始まる）
    const boss = g.spawnBoss('boss4', { spellBg: 'lapis', circleColor: '90,140,255', x: FIELD_W / 2, y: -50, finalDrops: { power: 10, point: 20, bigpower: 1 } });
    yield* boss.moveTo(FIELD_W / 2, 100, 70);
    yield* g.talk(STORY.stage4[g.charId].before);
    yield* g.fight(boss, BOSS4_PHASES);
    yield* g.bossDown(boss);
    yield* g.talk(STORY.stage4[g.charId].after);
  },
});
