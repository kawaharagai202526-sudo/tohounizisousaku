'use strict';
// ============================================================
//  3面：星降る大樹 ― 中ボス／ボス：スターサファイア
// ============================================================

// 星座のかたち（座標は -1〜1、edges は結ぶ星の番号）
const CONSTELLATIONS = [
  { name: '北斗七星', pts: [[-1, -0.3], [-0.6, -0.36], [-0.25, -0.2], [0.05, 0], [0.2, 0.45], [0.78, 0.55], [0.88, 0.05]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
  { name: 'カシオペヤ', pts: [[-1, -0.4], [-0.5, 0.4], [0, -0.1], [0.5, 0.4], [1, -0.4]], edges: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  { name: 'オリオン', pts: [[-0.5, -1], [0.5, -0.9], [-0.22, 0], [0, 0.05], [0.22, 0.1], [-0.55, 0.95], [0.5, 1]], edges: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]] },
  { name: '夏の大三角', pts: [[-0.85, -0.5], [0.85, -0.7], [0.1, 0.85]], edges: [[0, 1], [1, 2], [2, 0]] },
];

const STAR_MID_PHASES = [
  {
    type: 'non', hp: 1300, time: 28,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        const n = dv(12, 16, 22, 28);
        const off = rand(TAU);
        for (let i = 0; i < n; i++) {
          fire({
            x: b.x, y: b.y, angle: off + (i * TAU) / n, speed: 3, accel: -0.08, minSpeed: 0, type: 'star', color: 'yellow',
            script: function* (bl) {
              yield 40;
              bl.angle = aimAt(bl.x, bl.y) + rand(-0.3, 0.3);
              bl.accel = 0.04;
              bl.maxSpeed = dv(1.6, 2, 2.4, 2.8);
              bl.setColor('white');
            },
          });
        }
        yield 50;
        b.wander(50, 70);
        yield dv(50, 40, 30, 24);
      }
    },
  },
];

const STAR_PHASES = [
  {
    type: 'non', hp: 1200, time: 30,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        const n = dv(16, 24, 30, 38);
        const dir = loop % 2 ? 1 : -1;
        const off = rand(TAU);
        fireRing({ x: b.x, y: b.y, n, angle: off, speed: 1.9, angVel: dir * 0.004, type: 'star', color: loop % 2 ? 'yellow' : 'blue' });
        yield 18;
        fireRing({ x: b.x, y: b.y, n, angle: off + Math.PI / n, speed: 1.35, angVel: -dir * 0.004, type: 'star', color: loop % 2 ? 'blue' : 'yellow' });
        if (loop % 3 === 2) fireFan({ x: b.x, y: b.y, n: dv(1, 3, 3, 5), spread: 0.5, angle: b.aim(), speed: 2.4, type: 'bigstar', color: 'white' });
        yield 40;
        if (loop % 2) b.wander(60, 60);
      }
    },
  },
  {
    type: 'spell', name: '星符「メテオシャワー」', hp: 1400, time: 40,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      for (let f = 0; ; f++) {
        if (f % dv(40, 28, 20, 15) === 0) {
          fire({
            x: rand(20, FIELD_W - 20), y: -24, angle: Math.PI / 2 + rand(-0.45, 0.45), speed: rand(2.6, 3.6), delay: 0, margin: 60,
            type: 'large', color: pick(['yellow', 'orange']),
            script: function* (m) {
              for (;;) {
                yield dv(7, 6, 5, 4);
                fire({ x: m.x, y: m.y, angle: rand(TAU), speed: rand(0.3, 0.9), type: 'star', color: pick(['yellow', 'white']), silent: true, delay: 4 });
              }
            },
          });
        }
        if (f % 90 === 45) fireRing({ x: b.x, y: b.y, n: dv(10, 16, 20, 26), angle: b.aim(), speed: 1.7, type: 'star', color: 'blue' });
        if (f % 150 === 149) b.wander(60, 50);
        yield;
      }
    },
  },
  {
    type: 'non', hp: 1300, time: 30,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        const a = b.aim();
        const n = dv(3, 5, 5, 7);
        const gap = dv(0.55, 0.42, 0.34, 0.28);
        for (let k = 0; k < n; k++) {
          fireLaser({ x: b.x, y: b.y, angle: a + (k - (n - 1) / 2) * gap, width: 16, warn: 45, dur: 40, color: 'blue' });
        }
        Sound.se('charge');
        yield 30;
        for (let r = 0; r < 3; r++) {
          fireRing({ x: b.x, y: b.y, n: dv(10, 14, 18, 22), angle: rand(TAU), speed: 1.6 + r * 0.25, type: 'star', color: 'yellow' });
          yield 16;
        }
        yield 60;
        b.wander(60, 70);
        yield 50;
      }
    },
  },
  {
    type: 'spell', name: '星座「コンステレーション・ドロー」', hp: 1600, time: 50,
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
  {
    type: 'non', hp: 1300, time: 30,
    *script(b) {
      yield 30;
      let a = 0;
      for (let f = 0; ; f++) {
        if (f % dv(4, 3, 3, 2) === 0) {
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
    type: 'spell', name: '星願「流れ星に願いを」', time: 40, survival: true, bonus: 5000000,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 110, 40);
      let a = 0;
      for (let f = 0; ; f++) {
        const heat = Math.min(1, f / 1800);
        if (f % Math.max(2, dv(6, 5, 4, 3) - Math.floor(heat * 2)) === 0) {
          fire({
            x: rand(0, FIELD_W), y: -10, speed: 0, ay: 0.03, evx: rand(-0.5, 0.5), maxFall: rand(1.3, 2.1) + DIFF * 0.25,
            type: rng.next() < 0.15 ? 'bigstar' : 'star', color: pick(['yellow', 'white', 'cyan', 'pink']), silent: true, delay: 4,
          });
        }
        if (f % dv(12, 10, 8, 7) === 0) {
          const n = dv(3, 4, 5, 6);
          for (let k = 0; k < n; k++) fire({ x: b.x, y: b.y, angle: a + (k * TAU) / n, speed: 1.3, type: 'ball', color: 'blue', silent: k > 0 });
          a += 0.17;
        }
        if (f % 120 === 60) fireFan({ x: b.x, y: b.y, n: dv(1, 3, 3, 5), spread: 0.45, angle: b.aim(), speed: 2.2, type: 'bigstar', color: 'yellow' });
        yield;
      }
    },
  },
];

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
        fireFan({ x: e.x, y: e.y, n: dv(1, 3, 3, 5), spread: 0.3, angle: e.aim(), speed: dv(2.2, 2.6, 3, 3.4), type: 'star', color: 'yellow' });
        yield 60;
        e.angVel = 0;
      },
    });
    yield 12;
  }
}

STAGES.push({
  name: '星降る大樹',
  nameEn: 'The Great Tree beneath the Falling Stars',
  bg: SkyBG,
  bgm: 'stage3',
  *script(g) {
    yield 160;
    g.tasks.add(swirlWave(-1, 8));
    yield 160;
    g.tasks.add(swirlWave(1, 8));
    yield 200;
    [96, 288].forEach(x => laserFairy(x, 90));
    yield 120;
    laserFairy(192, 70);
    yield 150;
    g.tasks.add(starShower(360, dv(34, 50, 70, 90), ['yellow', 'white', 'pink', 'cyan'], true));
    yield* zigzag(14, 'yellow', 'yellow', 'star');
    yield* waitClear(300);

    // 中ボス：スターサファイア（顔見せ）
    const mid = g.spawnBoss('star', { circleColor: '140,160,255', x: FIELD_W / 2, y: -50 });
    yield* mid.moveTo(FIELD_W / 2, 100, 60);
    yield* g.fight(mid, STAR_MID_PHASES);
    if (mid.hp <= 0) dropItems(mid.x, mid.y, { power: 5, point: 8, bomb: 1 });
    yield* g.bossDown(mid, true);
    yield 60;

    [70, 314].forEach(x => laserFairy(x, 110));
    g.tasks.add(sideSweep(-1, 8, { color: 'purple', bcolor: 'purple', type: 'star', y: 40 }));
    yield 100;
    g.tasks.add(sideSweep(1, 8, { color: 'purple', bcolor: 'purple', type: 'star', y: 40 }));
    yield 200;
    for (const side of [-1, 1]) {
      spawnEnemy({
        x: FIELD_W / 2 + side * 100, y: -20, kind: 'bigfairy', color: 'yellow', hp: 320, r: 18, score: 20000, drops: { power: 4, point: 5 },
        script: function* (e) {
          yield* e.moveTo(e.x, 100, 50);
          for (let k = 0; k < 6; k++) {
            fireRing({ x: e.x, y: e.y, n: dv(10, 14, 18, 24), angle: rand(TAU), speed: 1.7, angVel: side * 0.006, type: 'star', color: k % 2 ? 'yellow' : 'orange' });
            yield 50;
          }
          e.setMove(0, -Math.PI / 2, 0.05);
        },
      });
    }
    yield* waitClear(700);
    g.tasks.add(starShower(480, dv(40, 60, 84, 110), ['yellow', 'white', 'pink', 'cyan'], true));
    g.tasks.add(swirlWave(-1, 10));
    g.tasks.add(swirlWave(1, 10));
    yield 240;
    [80, 192, 304].forEach(x => laserFairy(x, 80));
    yield 120;
    [120, 264].forEach(x => ringFairy(x, { color: 'blue', bcolor: 'yellow', type: 'star', stopY: 120, times: 4, n: dv(10, 14, 20, 26) }));
    yield* waitClear(900);
    yield 120;

    const boss = g.spawnBoss('star', { spellBg: 'star', circleColor: '140,160,255', x: FIELD_W / 2, y: -50, finalDrops: { power: 10, point: 20, bigpower: 1 } });
    yield* boss.moveTo(FIELD_W / 2, 100, 60);
    yield* g.talk(STORY.stage3[g.charId].before);
    yield* g.fight(boss, STAR_PHASES);
    yield* g.bossDown(boss);
    yield* g.talk(STORY.stage3[g.charId].after);
  },
});
