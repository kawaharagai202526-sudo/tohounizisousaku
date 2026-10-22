'use strict';
// ============================================================
//  共通の道中パターン（どの面でも使う）
// ============================================================

// 一晩で古びた屋根から、瓦やがれきが降ってくる
// big のときは、ときどき大きな瓦（一撃で倒せる回転する敵）が混ざる。type は降ってくる弾の種類
function* tileShower(frames, count, colors = ['blue', 'purple', 'white'], big = false, type = 'rice') {
  const interval = Math.max(1, Math.floor(frames / count));
  for (let i = 0; i < count; i++) {
    const x = rand(8, FIELD_W - 8), color = pick(colors), maxFall = rand(1.2, 1.6) + Math.min(DIFF, 3) * 0.3;
    if (big && rng.next() < 0.3) tileObject(x, maxFall);
    else {
      fire({
        x, y: -12, speed: 0, ax: rand(-0.004, 0.004), ay: 0.025, evx: rand(-0.4, 0.4), maxFall,
        type, color, silent: true, delay: 4,
      });
    }
    yield interval;
  }
}

// 道中の大きな瓦。弾ではなく回転する敵で、体力がとても少なく一撃で倒せる
function tileObject(x, maxFall) {
  return spawnEnemy({
    x, y: -16, kind: 'tileobj', hp: 0.4, r: 12, score: 300,
    drops: rng.next() < 0.3 ? { point: 1 } : {},
    angle: Math.PI / 2 + rand(-0.2, 0.2),
    script: function* (e) {
      for (;;) {
        e.speed = Math.min(e.speed + 0.025, maxFall * bulletSpeedK());
        yield;
      }
    },
  });
}

// 横から弧を描いて横切る妖精の列
function* sideSweep(side, n, o = {}) {
  for (let i = 0; i < n; i++) {
    spawnEnemy({
      x: side < 0 ? -12 : FIELD_W + 12, y: (o.y ?? 40) + i * 5, hp: o.hp ?? 8, kind: 'foot', color: o.color || 'purple',
      drops: i % 2 ? { point: 1 } : { power: 1 },
      score: 800,
      script: function* (e) {
        e.setMove(o.speed ?? 2.6, side < 0 ? (o.angle ?? 22) * DEG : (180 - (o.angle ?? 22)) * DEG, 0, side < 0 ? 0.0045 : -0.0045);
        yield 28 + i * 2;
        if (DIFF > 0 || i % 2 === 0) {
          fireFan({ x: e.x, y: e.y, n: dv(1, 1, 3, 5), spread: 0.32, angle: e.aim(), speed: dv(2, 2.4, 2.9, 3.4), type: o.type || 'small', color: o.bcolor || 'blue' });
        }
        if (DIFF >= 2) {
          yield 30;
          fireFan({ x: e.x, y: e.y, n: 3, spread: 0.4, angle: e.aim(), speed: 2.4, type: 'rice', color: o.bcolor || 'blue' });
        }
      },
    });
    yield o.gap ?? 10;
  }
}

// 上から降りてきて止まり、リング弾を撃って帰る妖精
function ringFairy(x, o = {}) {
  return spawnEnemy({
    x, y: -16, hp: o.hp ?? 30, color: o.color || 'red', drops: o.drops || { power: 2, point: 1 }, score: 2000,
    script: function* (e) {
      yield* e.moveTo(x, o.stopY ?? 100, 50);
      for (let k = 0; k < (o.times ?? 3); k++) {
        const n = o.n ?? dv(6, 10, 14, 20);
        fireRing({ x: e.x, y: e.y, n, angle: e.aim() + (k % 2) * (Math.PI / n), speed: (o.speed ?? 1.8) + k * 0.2, type: o.type || 'ball', color: o.bcolor || 'red' });
        yield o.gap ?? 35;
      }
      yield 20;
      e.setMove(0, -Math.PI / 2, 0.06);
    },
  });
}

function* kedamaRain(frames, count, color = 'white') {
  const interval = Math.max(1, Math.floor(frames / count));
  for (let i = 0; i < count; i++) {
    const x = rand(20, FIELD_W - 20);
    spawnEnemy({
      x, y: -12, kind: 'kedama', color, hp: 5, r: 10, score: 500, drops: rng.next() < 0.5 ? { point: 1 } : { power: 1 },
      speed: rand(1.4, 2.4), angle: Math.PI / 2 + rand(-0.15, 0.15),
      script: function* (e) {
        yield randInt(40, 90);
        if (DIFF >= 1 && e.onScreen) fire({ x: e.x, y: e.y, angle: e.aim(), speed: dv(2, 2.4, 2.8, 3.2), type: 'dot', color: 'white' });
        if (DIFF >= 3) fireFan({ x: e.x, y: e.y, n: 3, spread: 0.5, angle: e.aim(), speed: 2, type: 'dot', color: 'purple' });
      },
    });
    yield interval;
  }
}

// 上から斜めに交互に流れてくる妖精
function* zigzag(n, color = 'blue', bcolor = 'cyan', type = 'rice') {
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    spawnEnemy({
      x: FIELD_W / 2 + side * rand(10, 60), y: -12, hp: 10, color, score: 1000, drops: { power: 1 },
      script: function* (e) {
        e.setMove(2.2, Math.PI / 2 - side * 0.5);
        yield 40;
        fireFan({ x: e.x, y: e.y, n: dv(1, 1, 3, 5), spread: 0.35, angle: e.aim(), speed: dv(2, 2.3, 2.8, 3.2), type, color: bcolor });
        yield 30;
        e.angVel = side * 0.01;
      },
    });
    yield 18;
  }
}

// 緑の手（道中のザコ。3面以降は面の zako の絵になる）。降りてきて、5本の指に合わせて5方向の弾を撃つ
function handEnemy(x, o = {}) {
  return spawnEnemy({
    x, y: -20, kind: 'hand', hp: o.hp ?? 24, r: 14, color: 'green', score: 2000, drops: { power: 2, point: 1 },
    script: function* (e) {
      yield* e.moveTo(x, o.stopY ?? 100, 50);
      for (let k = 0; k < (o.times ?? dv(1, 2, 2, 3)); k++) {
        fireFan({ x: e.x, y: e.y + 8, n: 5, spread: dv(0.8, 0.9, 1.0, 1.1), angle: e.aim(), speed: dv(1.8, 2.1, 2.5, 2.9), type: 'kunai', color: 'red' });
        if (DIFF >= 2) {
          yield 8;
          fireFan({ x: e.x, y: e.y + 8, n: 5, spread: 1.0, angle: e.aim(), speed: 1.6, type: 'kunai', color: 'red' });
        }
        yield 50;
      }
      e.setMove(0, -Math.PI / 2, 0.06);
    },
  });
}

function* waitClear(timeout = 1200) {
  yield* waitUntil(() => G.enemies.length === 0, timeout);
}

// ============================================================
//  1面：一夜で古びた里 ― ボス：軒端 鬼乃（屋根の付喪神。本人は鬼のつもり）
// ============================================================

const NOKIBA_PHASES = [
  {
    // 瓦を放り投げる：上へ投げた弾が、放物線を描いて落ちてくる
    type: 'non', hp: 900, time: 30,
    *script(b) {
      yield 40;
      for (let loop = 0; ; loop++) {
        const n = dv(4, 5, 7, 9);
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + (i - (n - 1) / 2) * dv(0.32, 0.28, 0.24, 0.2) + rand(-0.05, 0.05);
          fire({
            x: b.x, y: b.y, angle: a, speed: rand(2.4, 3.1), accel: -0.05, minSpeed: 0, ay: 0.045, maxFall: dv(1.9, 2.3, 2.7, 3.1),
            type: 'rice', color: 'blue', silent: i > 0,
          });
        }
        yield 36;
        fireRing({ x: b.x, y: b.y, n: dv(10, 14, 20, 26), angle: rand(TAU), speed: dv(1.4, 1.7, 2.0, 2.3), type: 'small', color: 'orange' });
        yield 30;
        fireFan({ x: b.x, y: b.y, n: dv(3, 3, 5, 5), spread: 0.4, angle: b.aim(), speed: 2.6, type: 'ball', color: 'red' });
        b.wander(60);
        yield 50;
      }
    },
  },
  {
    // 焼きたての鬼瓦：大きな弾が止まって、火の粉の輪に割れる
    type: 'spell', name: '瓦符「焼きたての鬼瓦」', hp: 1100, time: 40,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      for (let loop = 0; ; loop++) {
        const n = dv(2, 2, 3, 4), base = b.aim();
        for (let i = 0; i < n; i++) {
          fire({
            x: b.x, y: b.y, angle: base + (i - (n - 1) / 2) * 0.55, speed: 3.2, accel: -0.06, minSpeed: 0, type: 'large', color: 'orange',
            script: function* (bl) {
              yield 50;
              fireRing({ x: bl.x, y: bl.y, n: dv(8, 10, 14, 18), angle: rand(TAU), speed: dv(1.3, 1.6, 1.9, 2.2), type: 'small', color: 'red', silent: true });
              if (DIFF >= 2) fireRing({ x: bl.x, y: bl.y, n: 8, angle: rand(TAU), speed: 1.1, type: 'rice', color: 'orange', silent: true });
              Sound.se('tan');
              bl.alive = false;
            },
          });
        }
        // 合間に舞う火の粉
        for (let k = 0; k < 45; k++) {
          if (k % dv(12, 9, 6, 5) === 0) fire({ x: b.x + rand(-20, 20), y: b.y, angle: Math.PI / 2 + rand(-0.7, 0.7), speed: rand(1.2, 2), type: 'dot', color: 'orange', silent: true });
          yield;
        }
        if (loop % 2) b.wander(50, 60);
        yield dv(54, 42, 32, 24);
      }
    },
  },
  {
    // 軒のしずく：上から弾の雨が降る。すき間はゆっくり左右に動く
    type: 'non', hp: 1000, time: 30,
    *script(b) {
      yield 30;
      for (let f = 0; ; f++) {
        const gapX = FIELD_W / 2 + Math.sin(f * 0.012) * 120;
        if (f % dv(44, 36, 30, 24) === 0) {
          for (let x = 12; x < FIELD_W; x += 32) {
            if (Math.abs(x - gapX) < dv(84, 72, 60, 52)) continue;
            fire({ x: x + rand(-4, 4), y: -6, angle: Math.PI / 2, speed: dv(1.4, 1.6, 1.8, 2.0), type: 'kunai', color: 'cyan', silent: true });
          }
          Sound.se('tan');
        }
        if (f % 70 === 35) fireFan({ x: b.x, y: b.y, n: dv(3, 5, 5, 7), spread: 0.6, angle: b.aim(), speed: 2.2, type: 'ball', color: 'blue' });
        if (f % 140 === 139) b.wander(60, 50);
        yield;
      }
    },
  },
  {
    // 反逆児：外へ飛んだ弾が、逆らうように向きを変えて戻ってくる
    type: 'spell', name: '鬼符「軒下の反逆児」', hp: 1300, time: 45,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 110, 40);
      for (let loop = 0; ; loop++) {
        const n = dv(12, 16, 22, 30), off = rand(TAU), dir = loop % 2 ? 1 : -1;
        Sound.se('kira');
        for (let i = 0; i < n; i++) {
          fire({
            x: b.x, y: b.y, angle: off + (i * TAU) / n, speed: 3.4, accel: -0.08, minSpeed: 0,
            type: 'ball', color: loop % 2 ? 'red' : 'dark', silent: true,
            script: function* (bl) {
              yield 45;
              bl.angle += Math.PI + dir * 0.35;
              bl.accel = 0.03;
              bl.maxSpeed = dv(1.2, 1.5, 1.9, 2.3);
            },
          });
        }
        yield 24;
        for (let k = 0; k < dv(1, 2, 2, 3); k++) {
          fireFan({ x: b.x, y: b.y, n: 3, spread: 0.3, angle: b.aim(), speed: 2.8, type: 'rice', color: 'orange' });
          yield 12;
        }
        yield dv(84, 68, 54, 42);
        b.wander(60, 60);
      }
    },
  },
];

STAGES.push({
  name: '一夜で古びた里',
  nameEn: 'The Village that Aged Overnight',
  bg: VillageRoofBG,
  bgm: 'stage1',
  // この面のボス（管理者ページの一覧・ボスの攻撃を試す機能・テストが使う。ボスを増やしたらここにも書く）
  //   id: CHARA_INFO のID  phases: 攻撃の配列  mid: 中ボスなら true（名前を出さない）  bgm: ボス戦の曲  def: 見た目（スペルカードの背景・魔法陣の色など）
  bosses: [
    { id: 'nokiba', phases: NOKIBA_PHASES, bgm: 'boss1', def: { spellBg: 'kawara', circleColor: '255,150,80' } },
  ],
  // 1面はほかの面よりやさしくする（2.1.0。弾速・全方位弾の数・ボスの体力）
  speedScale: 0.88,
  densityScale: 0.8,
  hpScale: 0.85,
  *script(g) {
    yield 160;
    yield* sideSweep(-1, 8);
    yield 50;
    yield* sideSweep(1, 8);
    yield 60;
    [70, 314, 150, 234].forEach((x, i) => ringFairy(x, { stopY: 90 + i * 12 }));
    yield 280;
    g.tasks.add(kedamaRain(300, dv(8, 12, 16, 20)));
    yield 120;
    g.tasks.add(tileShower(240, dv(8, 12, 18, 28)));
    yield 260;
    yield* zigzag(12);
    yield 120;
    g.tasks.add(sideSweep(-1, 6, { y: 60 }));
    yield* sideSweep(1, 6, { y: 60 });
    yield* waitClear(240);

    // 中ボス（見た目は img/midboss1.png。ザコと同じしくみで動き、名前は出さない）
    spawnEnemy({
      x: FIELD_W / 2, y: -40, kind: 'midboss1', color: 'green', hp: 450, r: 22, score: 30000,
      drops: { power: 6, point: 6, bomb: DIFF <= 1 ? 1 : 0 },
      script: function* (e) {
        yield* e.moveTo(FIELD_W / 2, 120, 60);
        let a = 0;
        const colors = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple'];
        for (let f = 0; f < 900; f++) {
          if (f % dv(11, 9, 6, 5) === 0) {
            const arms = dv(3, 3, 4, 5);
            for (let k = 0; k < arms; k++) fire({ x: e.x, y: e.y, angle: a + (k * TAU) / arms, speed: 2, type: 'rice', color: colors[(f >> 3) % colors.length], silent: k > 0 });
            a += 0.21;
          }
          if (f % 90 === 45) fireFan({ x: e.x, y: e.y, n: dv(3, 3, 5, 7), spread: 0.6, angle: e.aim(), speed: 2.6, type: 'ball', color: 'white' });
          yield;
        }
        e.setMove(0, -Math.PI / 2, 0.05);
      },
    });
    yield* waitClear(1000);
    yield 60;
    g.tasks.add(tileShower(360, dv(10, 16, 26, 40), ['blue', 'purple', 'white'], true));
    g.tasks.add(kedamaRain(360, dv(8, 10, 14, 18)));
    yield 200;
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? 1 : -1;
      spawnEnemy({
        x: side < 0 ? -14 : FIELD_W + 14, y: 70 + i * 20, hp: 20, color: 'yellow', score: 1500, drops: { power: 2, point: 2 },
        script: function* (e) {
          e.setMove(1.6, side < 0 ? 0 : Math.PI);
          for (let f = 0; ; f++) {
            if (f % dv(30, 24, 16, 12) === 0 && e.onScreen) {
              fireFan({ x: e.x, y: e.y, n: dv(1, 1, 2, 3), spread: 0.3, angle: Math.PI / 2, speed: 2.2, type: 'rice', color: 'yellow' });
            }
            yield;
          }
        },
      });
      yield 60;
    }
    yield 200;
    [96, 288].forEach(x => ringFairy(x, { color: 'blue', bcolor: 'blue', type: 'small', times: 4, n: dv(8, 12, 18, 24) }));
    yield 60;
    [192].forEach(x => ringFairy(x, { stopY: 70, times: 4 }));
    yield* waitClear(900);
    yield 90;
  },
  // ボス戦（キー「V」のときはここから始まる）
  *boss(g) {
    const boss = g.spawnStageBoss('nokiba', { x: FIELD_W + 40, y: 40 });
    yield* boss.moveTo(FIELD_W / 2, 100, 70);
    yield* g.talk(STORY.stage1[g.charId].before);
    yield* g.fight(boss, NOKIBA_PHASES);
    yield* g.bossDown(boss);
    yield* g.talk(STORY.stage1[g.charId].after);
  },
});
