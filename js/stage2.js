'use strict';
// ============================================================
//  2面：虫食いの空き家 ― 中ボス：提供画像のキャラクター（名前は出さない）／ボス：喰代 守子（家守）
// ============================================================

// 中ボス：消えては別の場所に現れて、輪と自機狙いの弾を撃つ
const MIDBOSS2_PHASES = [
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

// ------------------------------------------------------------
//  ボス：喰代 守子（家を守るやもり。虫が大好物）
// ------------------------------------------------------------
const HAMISHIRO_PHASES = [
  {
    // 虫の群れと、まっすぐ伸びる舌
    type: 'non', hp: 1000, time: 30,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        const n = dv(10, 14, 20, 26);
        for (let i = 0; i < n; i++) {
          fire({
            x: b.x, y: b.y, angle: b.aim() + rand(-1.2, 1.2), speed: rand(1.2, 2.4), type: 'dot', color: pick(['green', 'yellow']), silent: i > 0,
            script: function* (bl) { for (let k = 0; k < 6; k++) { yield 12; bl.angle += rand(-0.5, 0.5); } },
          });
        }
        yield 40;
        const a = b.aim();
        for (let k = 0; k < dv(4, 6, 8, 10); k++) fire({ x: b.x, y: b.y, angle: a, speed: 2.4 + k * 0.35, type: 'kunai', color: 'pink', silent: k > 0 });
        yield 40;
        b.wander(55, 60);
        yield 20;
      }
    },
  },
  {
    // 窓辺に集まる虫：左右から波打って飛ぶ蝶の弾。ときどき舌（レーザー）で狙う
    type: 'spell', name: '虫符「窓辺のごちそう」', hp: 1200, time: 40,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 80, 40);
      let side = 1;
      for (let f = 0; ; f++) {
        if (f % dv(14, 10, 8, 6) === 0) {
          side = -side;
          const ph = rand(TAU);
          fire({
            x: side < 0 ? -8 : FIELD_W + 8, y: rand(40, 250), angle: side < 0 ? 0 : Math.PI, speed: dv(1.3, 1.5, 1.8, 2.0),
            type: 'butterfly', color: pick(['green', 'yellow', 'orange']), margin: 20, silent: true,
            script: function* (bl) { const base = bl.angle; for (let k = 0; ; k++) { bl.angle = base + Math.sin(k * 0.08 + ph) * 0.6; yield; } },
          });
        }
        if (f % dv(150, 120, 100, 80) === 60) {
          fireLaser({ x: b.x, y: b.y, angle: b.aim(), width: 12, warn: 40, dur: 24, color: 'pink', follow: l => { l.x = b.x; l.y = b.y; } });
        }
        if (f % 90 === 0 && DIFF >= 1) fireRing({ x: b.x, y: b.y, n: dv(8, 10, 14, 18), angle: rand(TAU), speed: 1.5, type: 'small', color: 'green' });
        if (f % 240 === 200) b.wander(60, 50);
        yield;
      }
    },
  },
  {
    // しっぽの渦：左右に曲がっていく米粒弾
    type: 'non', hp: 1100, time: 30,
    *script(b) {
      yield 30;
      let a = rand(TAU);
      for (let f = 0; ; f++) {
        if (f % dv(6, 5, 4, 3) === 0) {
          for (const s of [1, -1]) {
            fire({ x: b.x, y: b.y, angle: a * s, speed: 2.2, angVel: s * dv(0.006, 0.008, 0.01, 0.012), type: 'rice', color: s > 0 ? 'cyan' : 'blue', silent: true });
          }
          a += 0.23;
        }
        if (f % 20 === 0) Sound.se('tan');
        if (f % 100 === 50) fireFan({ x: b.x, y: b.y, n: 3, spread: 0.3, angle: b.aim(), speed: 2.6, type: 'ball', color: 'green' });
        if (f % 160 === 159) b.wander(50, 50);
        yield;
      }
    },
  },
  {
    // 夜回り：壁ぞいを下りながら、部屋の反対側へ弾を撃つ
    type: 'spell', name: '守符「家守の夜回り」', hp: 1400, time: 45,
    *script(b) {
      for (let loop = 0; ; loop++) {
        const side = loop % 2 ? 1 : -1;
        yield* b.moveTo(side < 0 ? 36 : FIELD_W - 36, 60, 40);
        for (let f = 0; f < 120; f++) {
          b.y = 60 + f * 1.2;
          if (f % dv(10, 8, 6, 5) === 0) {
            const n = dv(3, 4, 5, 6);
            for (let i = 0; i < n; i++) {
              fire({ x: b.x, y: b.y, angle: (side < 0 ? 0 : Math.PI) + (i - (n - 1) / 2) * 0.22, speed: dv(1.8, 2.1, 2.4, 2.7), type: 'ball', color: 'blue', silent: i > 0 });
            }
          }
          yield;
        }
        fireRing({ x: b.x, y: b.y, n: dv(12, 16, 22, 28), angle: rand(TAU), speed: 1.6, type: 'small', color: 'cyan' });
        yield* b.moveTo(FIELD_W / 2, 90, 50);
        fireFan({ x: b.x, y: b.y, n: dv(5, 7, 9, 11), spread: 1.0, angle: b.aim(), speed: 2.4, type: 'rice', color: 'green' });
        yield 30;
      }
    },
  },
  {
    // しっぽ切り：切って置いていったしっぽが、動きながら弾をまき、最後にはじける
    type: 'spell', name: '尾符「とかげのしっぽ切り」', hp: 1300, time: 40,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      for (let loop = 0; ; loop++) {
        const tails = dv(2, 3, 3, 4);
        for (let i = 0; i < tails; i++) {
          fire({
            x: b.x, y: b.y, angle: b.aim() + (i - (tails - 1) / 2) * 0.7, speed: 1.6, accel: -0.012, minSpeed: 0.3, type: 'large', color: 'cyan',
            script: function* (bl) {
              for (let k = 0; k < 8; k++) {
                yield dv(22, 18, 15, 12);
                bl.angle += Math.sin(k * 1.7) * 0.5;
                fire({ x: bl.x, y: bl.y, angle: aimAt(bl.x, bl.y) + rand(-0.3, 0.3), speed: 1.8, type: 'small', color: 'blue', silent: true });
              }
              fireRing({ x: bl.x, y: bl.y, n: dv(8, 10, 12, 16), angle: rand(TAU), speed: 1.5, type: 'rice', color: 'cyan', silent: true });
              bl.alive = false;
            },
          });
        }
        Sound.se('kira');
        yield 40;
        b.wander(70, 80);
        yield dv(90, 75, 60, 50);
      }
    },
  },
];

// ------------------------------------------------------------
//  道中の敵
// ------------------------------------------------------------

// 床や天井をはい回る虫。上から降りてきて、くねくね進む
function* bugSwarm(frames, count) {
  const interval = Math.max(1, Math.floor(frames / count));
  for (let i = 0; i < count; i++) {
    const x = rand(20, FIELD_W - 20);
    spawnEnemy({
      x, y: -12, kind: 'bug', hp: 5, r: 9, score: 500, drops: rng.next() < 0.5 ? { point: 1 } : { power: 1 },
      speed: rand(1.2, 2.0), angle: Math.PI / 2,
      script: function* (e) {
        const ph = rand(TAU), w = rand(0.4, 0.9);
        for (let f = 0; ; f++) {
          e.angle = Math.PI / 2 + Math.sin(f * 0.06 + ph) * w;
          if (f === 60 && DIFF >= 1 && e.onScreen) fire({ x: e.x, y: e.y, angle: e.aim(), speed: dv(2, 2.3, 2.7, 3.1), type: 'dot', color: 'yellow' });
          yield;
        }
      },
    });
    yield interval;
  }
}

// V字に並んで降りてきて、止まってから撃つ妖精
function fairyV(n, color = 'blue') {
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 34;
    spawnEnemy({
      x: FIELD_W / 2 + off, y: -16 - Math.abs(off) * 0.8, hp: 14, color, score: 1200, drops: i % 2 ? { point: 1 } : { power: 1 },
      script: function* (e) {
        e.setMove(1.8, Math.PI / 2);
        yield 50;
        e.accel = -0.04;
        yield 30;
        fireFan({ x: e.x, y: e.y, n: dv(3, 3, 5, 5), spread: 0.4, angle: e.aim(), speed: dv(2.2, 2.6, 3, 3.4), type: 'rice', color: 'green' });
        if (DIFF >= 2) { yield 12; fireFan({ x: e.x, y: e.y, n: 5, spread: 0.6, angle: e.aim(), speed: 2, type: 'rice', color: 'yellow' }); }
        yield 30;
        e.setMove(0, Math.PI / 2 + (off < 0 ? 0.6 : -0.6) + Math.PI, 0.05);
      },
    });
  }
}

// 止まってから自機に向かう弾（クモの糸にかかった虫のように、いったん止まる）を撒く妖精
function* stickyWave(side, n) {
  for (let i = 0; i < n; i++) {
    spawnEnemy({
      x: side < 0 ? -12 : FIELD_W + 12, y: 50 + i * 14, hp: 16, color: 'green', score: 1200, drops: { power: 1, point: 1 },
      script: function* (e) {
        e.setMove(2, side < 0 ? 0.25 : Math.PI - 0.25);
        yield 40;
        const cnt = dv(4, 6, 8, 10);
        for (let k = 0; k < cnt; k++) {
          fire({
            x: e.x, y: e.y, angle: (k / cnt) * TAU, speed: 2.4, accel: -0.06, minSpeed: 0, type: 'small', color: 'green',
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
  name: '虫食いの空き家',
  nameEn: 'A Vacant House Full of Bugs',
  bg: BugHouseBG,
  bgm: 'stage2',
  // この面のボス（管理者ページの一覧・ボスの攻撃を試す機能・テストが使う。ボスを増やしたらここにも書く）
  //   id: CHARA_INFO のID  phases: 攻撃の配列  mid: 中ボスなら true（名前を出さない）  bgm: ボス戦の曲  def: 見た目（スペルカードの背景・魔法陣の色など）
  bosses: [
    { id: 'midboss2', phases: MIDBOSS2_PHASES, mid: true, def: { circleColor: '150,160,240' } },
    { id: 'hamishiro', phases: HAMISHIRO_PHASES, bgm: 'boss2', def: { spellBg: 'yamori', circleColor: '110,200,255' } },
  ],
  *script(g) {
    yield 160;
    fairyV(5);
    yield 160;
    fairyV(7);
    yield 140;
    g.tasks.add(stickyWave(-1, 6));
    yield 120;
    g.tasks.add(stickyWave(1, 6));
    yield 120;
    [110, 274].forEach(x => handEnemy(x));
    yield 120;
    // 天井から虫が落ちてくる
    g.tasks.add(tileShower(300, dv(16, 26, 40, 56), ['green', 'yellow', 'orange'], false, 'dot'));
    g.tasks.add(bugSwarm(300, dv(10, 14, 18, 22)));
    yield 320;
    yield* waitClear(200);

    // 中ボス（提供画像のキャラクター。名前は出さない）
    const mid = g.spawnStageBoss('midboss2', { x: -40, y: 60 });
    yield* mid.moveTo(FIELD_W / 2, 100, 60);
    yield* g.fight(mid, MIDBOSS2_PHASES);
    if (mid.hp <= 0) dropItems(mid.x, mid.y, { power: 5, point: 6, bigpower: DIFF >= 2 ? 1 : 0 });
    yield* g.bossDown(mid, true);
    yield 60;

    yield* sideSweep(-1, 6, { color: 'blue', bcolor: 'green', type: 'rice', y: 50 });
    yield* sideSweep(1, 6, { color: 'blue', bcolor: 'green', type: 'rice', y: 50 });
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
              for (let k = 0; k < 3; k++) fire({ x: e.x, y: e.y, angle: a * side + (k * TAU) / 3, speed: 1.8, type: 'rice', color: 'green', silent: k > 0 });
              a += 0.18;
            }
            yield;
          }
          e.setMove(0, -Math.PI / 2, 0.05);
        },
      });
    }
    yield* waitClear(800);
    g.tasks.add(bugSwarm(420, dv(16, 22, 30, 38)));
    g.tasks.add(tileShower(420, dv(14, 22, 32, 44), ['green', 'yellow'], false, 'dot'));
    yield 60;
    yield* zigzag(14, 'green', 'green', 'rice');
    [70, 192, 314].forEach((x, i) => handEnemy(x, { stopY: 80 + i * 15 }));
    yield 60;
    fairyV(7, 'purple');
    yield 120;
    [80, 304, 192].forEach((x, i) => ringFairy(x, { color: 'blue', bcolor: 'green', type: 'rice', stopY: 80 + i * 20, times: 4, n: dv(10, 14, 20, 26) }));
    yield* waitClear(900);
    yield 90;
  },
  // ボス戦（キー「V」のときはここから始まる）
  *boss(g) {
    const boss = g.spawnStageBoss('hamishiro', { x: FIELD_W / 2, y: -50 });
    yield* boss.moveTo(FIELD_W / 2, 100, 60);
    yield* g.talk(STORY.stage2[g.charId].before);
    yield* g.fight(boss, HAMISHIRO_PHASES);
    yield* g.bossDown(boss);
    yield* g.talk(STORY.stage2[g.charId].after);
  },
});
