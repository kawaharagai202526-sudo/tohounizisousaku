'use strict';
// ============================================================
//  共通の道中パターン
// ============================================================

// 空から星が降ってくる（異変そのもの）
// big のときは、ときどき大きな星（一撃で倒せる回転する敵）が混ざる
function* starShower(frames, count, colors = ['yellow', 'cyan', 'pink', 'white'], big = false) {
  const interval = Math.max(1, Math.floor(frames / count));
  for (let i = 0; i < count; i++) {
    const x = rand(8, FIELD_W - 8), color = pick(colors), maxFall = rand(1.2, 1.6) + DIFF * 0.3;
    if (big && rng.next() < 0.3) starObject(x, color, maxFall);
    else {
      fire({
        x, y: -12, speed: 0, ax: rand(-0.004, 0.004), ay: 0.025, evx: rand(-0.4, 0.4), maxFall,
        type: 'star', color, silent: true, delay: 4,
      });
    }
    yield interval;
  }
}

// 道中の大きな星。弾ではなく回転する敵で、体力がとても少なく一撃で倒せる
function starObject(x, color, maxFall) {
  return spawnEnemy({
    x, y: -16, kind: 'starobj', color, hp: 0.4, r: 12, score: 300,
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

// 緑の手（2面以降の道中のザコ）。降りてきて、5本の指に合わせて5方向の弾を撃つ
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
//  1面：宵闇の流星 ― ボス：ルーミア
// ============================================================

const RUMIA_PHASES = [
  {
    type: 'non', hp: 900, time: 30,
    *script(b) {
      yield 40;
      for (let loop = 0; ; loop++) {
        const a = b.aim();
        for (let k = 0; k < dv(1, 2, 3, 4); k++) {
          fireFan({ x: b.x, y: b.y, n: dv(5, 5, 7, 9), spread: dv(0.9, 1.1, 1.3, 1.5), angle: a, speed: 1.8 + k * 0.55, type: 'rice', color: 'blue' });
        }
        yield 40;
        const off = rand(TAU), n = dv(12, 18, 26, 34);
        fireRing({ x: b.x, y: b.y, n, angle: off, speed: dv(1.5, 1.9, 2.3, 2.6), type: 'small', color: 'red' });
        yield 16;
        fireRing({ x: b.x, y: b.y, n, angle: off + Math.PI / n, speed: dv(1.2, 1.5, 1.8, 2.1), type: 'small', color: 'red' });
        b.wander(60);
        yield 60;
      }
    },
  },
  {
    type: 'spell', name: '夜符「ミッドナイトバード」', hp: 1100, time: 40,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      for (let loop = 0; ; loop++) {
        const dir = loop % 2 ? 1 : -1;
        const n = dv(12, 15, 20, 24);
        const aim = b.aim();
        for (let i = 0; i < n; i++) {
          const a = aim + dir * (-1.25 + (2.5 * i) / (n - 1));
          for (let k = 0; k < dv(2, 2, 3, 3); k++) {
            fire({ x: b.x, y: b.y, angle: a, speed: 1.5 + k * 0.7 + i * 0.035, type: 'ball', color: loop % 2 ? 'blue' : 'purple' });
          }
          yield 2;
        }
        yield dv(52, 40, 28, 20);
        if (loop % 2 === 1) {
          if (DIFF >= 2) fireRing({ x: b.x, y: b.y, n: dv(0, 0, 18, 26), angle: rand(TAU), speed: 1.4, type: 'small', color: 'white' });
          b.wander(50, 60);
          yield 40;
        }
      }
    },
  },
  {
    type: 'non', hp: 1000, time: 30,
    *script(b) {
      yield 30;
      let a = rand(TAU);
      for (let f = 0; ; f++) {
        const arms = dv(3, 4, 5, 6);
        for (let k = 0; k < arms; k++) {
          fire({ x: b.x, y: b.y, angle: a + (k * TAU) / arms, speed: 1.9, type: 'ball', color: 'dark' });
          if (DIFF >= 2 && f % 2 === 0) fire({ x: b.x, y: b.y, angle: -a * 1.2 + (k * TAU) / arms, speed: 1.4, type: 'small', color: 'red', silent: true });
        }
        a += 0.13;
        yield dv(11, 9, 7, 5);
        if (f % 70 === 69) {
          fireFan({ x: b.x, y: b.y, n: 3, spread: 0.3, angle: b.aim(), speed: 2.6, type: 'large', color: 'red' });
          b.wander(60, 50);
        }
      }
    },
  },
  {
    type: 'spell', name: '闇符「ムーンレスサークル」', hp: 1300, time: 45,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 110, 40);
      for (let loop = 0; ; loop++) {
        const n = dv(16, 22, 30, 40);
        const dir = loop % 2 ? 1 : -1;
        const off = rand(TAU);
        Sound.se('kira');
        for (let i = 0; i < n; i++) {
          fire({
            x: b.x, y: b.y, angle: off + (i * TAU) / n, speed: 3.2, accel: -0.07, minSpeed: 0,
            type: 'ball', color: dir > 0 ? 'dark' : 'purple',
            script: function* (bl) {
              yield 55;
              bl.angle += dir * Math.PI * 0.42;
              bl.accel = 0.025;
              bl.maxSpeed = dv(1.3, 1.7, 2.1, 2.5);
            },
          });
        }
        yield 30;
        for (let k = 0; k < dv(1, 1, 2, 3); k++) {
          fireFan({ x: b.x, y: b.y, n: 3, spread: 0.25, angle: b.aim(), speed: 3, type: 'rice', color: 'red' });
          yield 10;
        }
        yield dv(80, 60, 50, 40);
        b.wander(60, 60);
      }
    },
  },
];

STAGES.push({
  name: '宵闇の流星',
  nameEn: 'Shooting Stars in the Dusk',
  bg: ForestBG,
  bgm: 'stage1',
  *script(g) {
    yield 160;
    yield* sideSweep(-1, 8);
    yield 50;
    yield* sideSweep(1, 8);
    yield 60;
    [70, 314, 150, 234].forEach((x, i) => ringFairy(x, { stopY: 90 + i * 12 }));
    yield 280;
    g.tasks.add(kedamaRain(300, dv(12, 16, 20, 24)));
    yield 120;
    g.tasks.add(starShower(240, dv(10, 16, 24, 34)));
    yield 260;
    yield* zigzag(12);
    yield 120;
    g.tasks.add(sideSweep(-1, 6, { y: 60 }));
    yield* sideSweep(1, 6, { y: 60 });
    yield* waitClear(240);

    // 中ボス（見た目は img/midboss1.png）
    spawnEnemy({
      x: FIELD_W / 2, y: -40, kind: 'midboss1', color: 'green', hp: 450, r: 22, score: 30000,
      drops: { power: 6, point: 6, bomb: DIFF <= 1 ? 1 : 0 },
      script: function* (e) {
        yield* e.moveTo(FIELD_W / 2, 120, 60);
        let a = 0;
        const colors = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple'];
        for (let f = 0; f < 900; f++) {
          if (f % dv(9, 7, 5, 4) === 0) {
            const arms = dv(3, 4, 5, 6);
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
    g.tasks.add(starShower(360, dv(14, 22, 34, 48), ['yellow', 'orange', 'white'], true));
    g.tasks.add(kedamaRain(360, dv(10, 14, 18, 22)));
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

    // ボス
    const boss = g.spawnBoss('rumia', { spellBg: 'rumia', circleColor: '255,80,120', aura: 'rgba(0,0,0,0.5)', pose: 'spread', x: FIELD_W + 40, y: 40 });
    yield* boss.moveTo(FIELD_W / 2, 100, 70);
    yield* g.talk(STORY.stage1[g.charId].before);
    yield* g.fight(boss, RUMIA_PHASES);
    yield* g.bossDown(boss);
    yield* g.talk(STORY.stage1[g.charId].after);
  },
});
