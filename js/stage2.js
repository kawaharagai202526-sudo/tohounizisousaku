'use strict';
// ============================================================
//  2面：星影の湖 ― 中ボス：大妖精 / ボス：チルノ
// ============================================================

const DAIYOUSEI_PHASES = [
  {
    type: 'non', hp: 1100, time: 25,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        // 瞬間移動
        Sound.se('kira');
        for (let i = 0; i < 12; i++) { b.alpha = 1 - i / 12; yield; }
        b.x = rand(80, FIELD_W - 80);
        b.y = rand(70, 140);
        for (let i = 0; i < 12; i++) { b.alpha = i / 12; yield; }
        b.alpha = 1;
        const n = dv(14, 20, 28, 36);
        fireRing({ x: b.x, y: b.y, n, angle: rand(TAU), speed: dv(1.6, 2, 2.3, 2.6), type: 'ball', color: 'green' });
        yield 10;
        for (let k = 0; k < dv(3, 5, 6, 8); k++) {
          fireFan({ x: b.x, y: b.y, n: dv(1, 1, 3, 3), spread: 0.2, angle: b.aim(), speed: 3.2 + k * 0.1, type: 'kunai', color: 'green' });
          yield 5;
        }
        yield dv(50, 40, 30, 24);
      }
    },
  },
];

const CIRNO_PHASES = [
  {
    type: 'non', hp: 1000, time: 30,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        const a = b.aim();
        const n = dv(12, 18, 26, 34);
        for (let i = 0; i < n; i++) {
          fire({ x: b.x, y: b.y, angle: a + rand(-1.1, 1.1), speed: rand(1.4, 3.4), type: 'ice', color: pick(['cyan', 'blue', 'white']), silent: i > 0 });
        }
        yield 40;
        fireRing({ x: b.x, y: b.y, n: dv(10, 16, 20, 24), angle: rand(TAU), speed: 1.6, type: 'ball', color: 'blue' });
        b.wander(55, 60);
        yield 45;
      }
    },
  },
  {
    type: 'spell', name: '氷符「アイシクルスターフォール」', hp: 1200, time: 40,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      for (let f = 0; ; f++) {
        if (f % dv(12, 10, 7, 5) === 0) {
          const swing = Math.sin(f * 0.035) * 0.35;
          for (const side of [-1, 1]) {
            const out = side > 0 ? -0.15 + swing : Math.PI + 0.15 - swing;
            fire({
              x: b.x, y: b.y, angle: out, speed: 3.6, accel: -0.1, minSpeed: 0, type: 'ice', color: 'cyan',
              script: function* (bl) {
                yield 34;
                bl.angle = Math.PI / 2 - side * dv(0.55, 0.6, 0.65, 0.7);
                bl.accel = 0.04;
                bl.maxSpeed = dv(1.6, 2.0, 2.3, 2.6);
              },
            });
          }
        }
        if (DIFF >= 1 && f % 70 === 30) fireFan({ x: b.x, y: b.y, n: dv(3, 5, 5, 7), spread: 0.5, angle: b.aim(), speed: 2.2, type: 'ball', color: 'yellow' });
        yield;
      }
    },
  },
  {
    type: 'non', hp: 1100, time: 30,
    *script(b) {
      yield 30;
      let a = 0;
      for (let f = 0; ; f++) {
        for (let k = 0; k < 6; k++) {
          fire({ x: b.x, y: b.y, angle: a + (k * TAU) / 6, speed: 2.1, type: 'ice', color: 'cyan', silent: k > 0 });
          if (f % 3 === 0) fire({ x: b.x, y: b.y, angle: -a + (k * TAU) / 6 + 0.26, speed: dv(1.2, 1.4, 1.6, 1.8), type: 'small', color: 'white', silent: true });
        }
        a += dv(0.09, 0.08, 0.075, 0.07);
        yield dv(9, 7, 6, 5);
        if (f % 80 === 79) b.wander(50, 50);
      }
    },
  },
  {
    type: 'spell', name: '凍符「フリージングスターダスト」', hp: 1400, time: 45,
    *script(b, g) {
      yield* b.moveTo(FIELD_W / 2, 100, 40);
      const colors = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'];
      for (;;) {
        const frozen = [];
        for (let f = 0; f < 100; f++) {
          if (f % 2 === 0) {
            for (let k = 0; k < dv(1, 2, 3, 4); k++) {
              frozen.push(fire({ x: b.x, y: b.y, angle: rand(TAU), speed: rand(1.5, 3.4), type: pick(['small', 'ball']), color: pick(colors), silent: k > 0 }));
            }
          }
          yield;
        }
        yield 20;
        Sound.se('freeze');
        g.flash = { color: '200,240,255', a: 0.35 };
        for (const bl of frozen) {
          if (!bl.alive) continue;
          bl.speed = 0;
          bl.accel = 0;
          bl.setColor('white');
        }
        fireFan({ x: b.x, y: b.y, n: dv(5, 7, 9, 11), spread: 1.0, angle: b.aim(), speed: 2.6, type: 'ice', color: 'blue' });
        fireFan({ x: b.x, y: b.y, n: dv(5, 7, 9, 11), spread: 1.0, angle: b.aim(), speed: 1.8, type: 'ice', color: 'blue' });
        yield 60;
        for (const bl of frozen) {
          if (!bl.alive) continue;
          bl.angle = rand(TAU);
          bl.accel = 0.012;
          bl.maxSpeed = dv(1.0, 1.4, 1.8, 2.1);
        }
        b.wander(60, 50);
        yield 80;
      }
    },
  },
  {
    type: 'spell', name: '雪符「スターダストブリザード」', hp: 1300, time: 40,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      for (let f = 0; ; f++) {
        for (let k = 0; k < dv(1, 1, 2, 3); k++) {
          const a = rand(TAU), r = rand(10, 60);
          fire({ x: b.x + Math.cos(a) * r, y: b.y + Math.sin(a) * r, angle: rand(TAU), speed: rand(0.8, dv(1.8, 2.2, 2.6, 3)), type: 'small', color: pick(['cyan', 'white', 'blue']), silent: true, delay: 12 });
        }
        if (f % dv(60, 45, 36, 30) === 0) {
          const a = b.aim();
          for (let k = 0; k < 5; k++) fire({ x: b.x, y: b.y, angle: a, speed: 2 + k * 0.45, type: 'ice', color: 'blue' });
        }
        if (f % 120 === 119) b.wander(60, 40);
        yield;
      }
    },
  },
];

function iceFairyV(n, color = 'blue') {
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 34;
    spawnEnemy({
      x: FIELD_W / 2 + off, y: -16 - Math.abs(off) * 0.8, hp: 14, color, score: 1200, drops: i % 2 ? { point: 1 } : { power: 1 },
      script: function* (e) {
        e.setMove(1.8, Math.PI / 2);
        yield 50;
        e.accel = -0.04;
        yield 30;
        fireFan({ x: e.x, y: e.y, n: dv(3, 3, 5, 5), spread: 0.4, angle: e.aim(), speed: dv(2.2, 2.6, 3, 3.4), type: 'ice', color: 'cyan' });
        if (DIFF >= 2) { yield 12; fireFan({ x: e.x, y: e.y, n: 5, spread: 0.6, angle: e.aim(), speed: 2, type: 'ice', color: 'blue' }); }
        yield 30;
        e.setMove(0, Math.PI / 2 + (off < 0 ? 0.6 : -0.6) + Math.PI, 0.05);
      },
    });
  }
}

// 止まってから自機に向かう「凍結弾」を撒く妖精
function* freezerWave(side, n) {
  for (let i = 0; i < n; i++) {
    spawnEnemy({
      x: side < 0 ? -12 : FIELD_W + 12, y: 50 + i * 14, hp: 16, color: 'green', score: 1200, drops: { power: 1, point: 1 },
      script: function* (e) {
        e.setMove(2, side < 0 ? 0.25 : Math.PI - 0.25);
        yield 40;
        const cnt = dv(4, 6, 8, 10);
        for (let k = 0; k < cnt; k++) {
          fire({
            x: e.x, y: e.y, angle: (k / cnt) * TAU, speed: 2.4, accel: -0.06, minSpeed: 0, type: 'small', color: 'cyan',
            script: function* (bl) {
              yield 50;
              bl.setColor('white');
              yield 20;
              bl.angle = aimAt(bl.x, bl.y);
              bl.accel = 0.05;
              bl.maxSpeed = dv(1.8, 2.2, 2.6, 3);
            },
          });
        }
      },
    });
    yield 16;
  }
}

STAGES.push({
  name: '星影の湖',
  nameEn: 'Starlight over the Misty Lake',
  bg: LakeBG,
  bgm: 'stage2',
  *script(g) {
    yield 160;
    iceFairyV(5);
    yield 160;
    iceFairyV(7);
    yield 140;
    g.tasks.add(freezerWave(-1, 6));
    yield 120;
    g.tasks.add(freezerWave(1, 6));
    yield 200;
    g.tasks.add(starShower(300, dv(16, 26, 40, 56), ['cyan', 'blue', 'white', 'yellow']));
    g.tasks.add(kedamaRain(300, dv(10, 14, 18, 22), 'blue'));
    yield 320;
    yield* waitClear(200);

    // 中ボス：大妖精
    const dai = g.spawnBoss('daiyousei', { circleColor: '120,255,160', x: -40, y: 60 });
    yield* dai.moveTo(FIELD_W / 2, 100, 60);
    yield* g.fight(dai, DAIYOUSEI_PHASES);
    if (dai.hp <= 0) dropItems(dai.x, dai.y, { power: 5, point: 6, bigpower: DIFF >= 2 ? 1 : 0 });
    yield* g.bossDown(dai, true);
    yield 60;

    yield* sideSweep(-1, 6, { color: 'blue', bcolor: 'cyan', type: 'ice', y: 50 });
    yield* sideSweep(1, 6, { color: 'blue', bcolor: 'cyan', type: 'ice', y: 50 });
    yield 60;
    // 左右の大妖精（ザコ）が渦巻き
    for (const side of [-1, 1]) {
      spawnEnemy({
        x: FIELD_W / 2 + side * 110, y: -20, kind: 'bigfairy', color: 'blue', hp: 280, r: 18, score: 20000, drops: { power: 4, point: 4 },
        script: function* (e) {
          yield* e.moveTo(e.x, 110, 50);
          let a = 0;
          for (let f = 0; f < 480; f++) {
            if (f % dv(8, 6, 5, 4) === 0) {
              for (let k = 0; k < 3; k++) fire({ x: e.x, y: e.y, angle: a * side + (k * TAU) / 3, speed: 1.8, type: 'ice', color: 'cyan', silent: k > 0 });
              a += 0.18;
            }
            yield;
          }
          e.setMove(0, -Math.PI / 2, 0.05);
        },
      });
    }
    yield* waitClear(800);
    g.tasks.add(starShower(420, dv(20, 32, 46, 64), ['cyan', 'blue', 'white', 'yellow'], true));
    yield 60;
    yield* zigzag(14, 'green', 'green', 'ice');
    yield 60;
    iceFairyV(7, 'purple');
    yield 120;
    [80, 304, 192].forEach((x, i) => ringFairy(x, { color: 'blue', bcolor: 'cyan', type: 'ice', stopY: 80 + i * 20, times: 4, n: dv(10, 14, 20, 26) }));
    yield* waitClear(900);
    yield 90;

    const boss = g.spawnBoss('cirno', { spellBg: 'cirno', circleColor: '120,220,255', x: FIELD_W / 2, y: -50 });
    yield* boss.moveTo(FIELD_W / 2, 100, 60);
    yield* g.talk(STORY.stage2[g.charId].before);
    yield* g.fight(boss, CIRNO_PHASES);
    yield* g.bossDown(boss);
    yield* g.talk(STORY.stage2[g.charId].after);
  },
});
