'use strict';
// ============================================================
//  3面：星降る大樹 ― 中ボス：？？？（コウモリ羽の子）／ボス：？？？（羊の角の子）
// ============================================================

// ------------------------------------------------------------
//  3面中ボス（提供画像のコウモリ羽の子。名前は未定）
//  紅魔郷の小悪魔を参考に、大玉の壁と赤クナイのまとまりを撃つ。スペルカードは無し
// ------------------------------------------------------------
const MIDBOSS3_PHASES = [
  {
    type: 'non', hp: 1300, time: 28,
    *script(b) {
      yield 30;
      for (let wave = 0; ; wave++) {
        // 大玉の壁。自機の方向がすき間になり、近づかれるほどすき間は狭い
        const n = dv(8, 10, 12, 14);
        const off = b.aim() + Math.PI / n;
        for (let r = 0; r < 2; r++) {
          fireRing({ x: b.x, y: b.y, n, angle: off, speed: 1.5 + r * 0.4, type: 'large', color: wave % 2 ? 'purple' : 'pink' });
        }
        yield 24;
        // 2波目からは赤クナイのまとまり（細長い1本の弾のように飛ぶ）
        if (wave >= 1) {
          const m = dv(3, 4, 5, 6);
          for (let i = 0; i < m; i++) {
            const a = b.aim() + (i - (m - 1) / 2) * 0.42;
            for (let k = 0; k < dv(3, 4, 5, 5); k++) {
              fire({ x: b.x, y: b.y, angle: a, speed: 2.0 + k * 0.22, type: 'kunai', color: 'red', silent: k > 0 });
            }
          }
        }
        yield 30;
        // 動き回り、ときどき下のほうまで詰め寄ってくる
        const low = wave % 3 === 2;
        b.move(clamp(G.player.x + rand(-80, 80), 60, FIELD_W - 60), low ? rand(150, dv(170, 190, 210, 220)) : rand(70, 120), 50);
        yield 50;
      }
    },
  },
];

// ------------------------------------------------------------
//  3面ボス（提供画像のキャラクター。名前は未定）
//  羊の角と片方だけの蝶の羽から、「眠り」と「夢」をテーマにした弾幕
//  スペルカード名は仮のもの
// ------------------------------------------------------------

// 羊毛のかたまり：中心の玉のまわりに小玉を並べ、同じ動きで飛ばす
function fireWool(x, y, o) {
  const out = [fire({ ...o, x, y, type: 'ball', color: o.color || 'white' })];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    out.push(fire({ ...o, x: x + Math.cos(a) * 8, y: y + Math.sin(a) * 8, type: 'small', color: o.rim || 'pink', silent: true }));
  }
  return out;
}

const BOSS3_PHASES = [
  {
    type: 'non', hp: 1000, time: 30,
    *script(b) {
      yield 30;
      for (;;) {
        const a = b.aim();
        const n = dv(3, 3, 5, 7);
        for (let i = 0; i < n; i++) fireWool(b.x, b.y, { angle: a + (i - (n - 1) / 2) * 0.34, speed: 1.6 });
        yield 30;
        fireRing({ x: b.x, y: b.y, n: dv(12, 16, 22, 28), angle: rand(TAU), speed: 1.3, type: 'small', color: 'pink' });
        yield 40;
        b.wander(60, 60);
        yield 20;
      }
    },
  },
  {
    type: 'spell', name: '夢符「カウンティングシープ」', hp: 1200, time: 40,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 80, 40);
      let count = 0;
      for (let f = 0; ; f++) {
        // 羊（羊毛のかたまり）が左右から交互に跳んでくる
        if (f % dv(56, 44, 34, 26) === 0) {
          const side = count % 2 ? 1 : -1;
          count++;
          fireWool(side < 0 ? -8 : FIELD_W + 8, rand(200, 300), {
            angle: side < 0 ? 0 : Math.PI, speed: dv(1.6, 1.9, 2.2, 2.4), evy: -dv(2.6, 2.8, 3, 3.2), ay: 0.045, margin: 60, delay: 0,
          });
          Fx.text(b.x, b.y + 34, `ひつじが${count}匹`, '#fff0f8', 10, 50);
        }
        if (DIFF >= 1 && f % 70 === 35) fireFan({ x: b.x, y: b.y, n: 3, spread: 0.3, angle: b.aim(), speed: 1.8, type: 'rice', color: 'purple' });
        yield;
      }
    },
  },
  {
    type: 'non', hp: 1100, time: 30,
    *script(b) {
      yield 30;
      for (;;) {
        // 指さした方向にレーザー、そのあと指先から扇状に弾
        const a = b.aim();
        const n = dv(1, 1, 3, 3);
        for (let k = 0; k < n; k++) fireLaser({ x: b.x - 14, y: b.y + 4, angle: a + (k - (n - 1) / 2) * 0.35, width: 12, warn: 50, dur: 30, color: 'pink' });
        Sound.se('charge');
        yield 55;
        for (let k = 0; k < dv(2, 3, 3, 4); k++) {
          fireFan({ x: b.x - 14, y: b.y + 4, n: dv(5, 7, 9, 11), spread: 1.2, angle: a, speed: 1.6 + k * 0.4, type: 'rice', color: 'pink' });
          yield 6;
        }
        yield 30;
        b.wander(60, 70);
        yield 40;
      }
    },
  },
  {
    type: 'spell', name: '蝶符「片羽の胡蝶」', hp: 1300, time: 45,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      for (let loop = 0; ; loop++) {
        // 片方の羽だけで羽ばたくように、左右交互に扇状の蝶弾
        const side = loop % 2 ? 1 : -1;
        const n = dv(10, 14, 18, 22);
        for (let i = 0; i < n; i++) {
          const a = Math.PI / 2 - side * (-0.4 + (i / (n - 1)) * 2.2);
          fire({
            x: b.x + side * 14, y: b.y, angle: a, speed: 1.2 + (i % 3) * 0.35, angVel: side * 0.008,
            type: 'butterfly', color: side > 0 ? 'purple' : 'pink', silent: i > 0,
            script: function* (bl) { yield 80; bl.angVel = 0; },
          });
          yield 2;
        }
        yield 20;
        if (DIFF >= 1) fireFan({ x: b.x, y: b.y, n: dv(3, 3, 5, 5), spread: 0.4, angle: b.aim(), speed: 2, type: 'ball', color: 'white' });
        yield dv(50, 40, 30, 24);
        if (loop % 2) b.wander(50, 50);
      }
    },
  },
  {
    type: 'spell', name: '眠符「スリーピングウール」', hp: 1300, time: 40,
    *script(b, g) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      for (let f = 0; ; f++) {
        // 上から羊毛がふわふわ降ってくる
        if (f % dv(30, 24, 18, 14) === 0) {
          fireWool(rand(20, FIELD_W - 20), -10, { angle: Math.PI / 2 + rand(-0.3, 0.3), speed: rand(0.9, 1.4), margin: 60, delay: 0 });
        }
        if (f % 20 === 0) fireRing({ x: b.x, y: b.y, n: dv(8, 10, 14, 18), angle: f * 0.05, speed: 1.4, type: 'small', color: 'purple', silent: true });
        // ときどき画面の弾がみんな「眠る」（ゆっくりになる）
        if (f % 240 === 200) {
          Fx.text(b.x, b.y - 40, 'Zzz…', '#e0d0ff', 14, 60);
          Sound.se('freeze');
          for (const bl of g.bullets.list) {
            bl.data = bl.data || {};
            bl.data.sleepSpeed = bl.speed;
            bl.speed *= 0.25;
          }
          fireFan({ x: b.x, y: b.y, n: dv(3, 5, 5, 7), spread: 0.6, angle: b.aim(), speed: 2, type: 'rice', color: 'pink' });
        }
        if (f % 240 === 20) {
          for (const bl of g.bullets.list) {
            if (bl.data && bl.data.sleepSpeed !== undefined) {
              bl.speed = bl.data.sleepSpeed;
              delete bl.data.sleepSpeed;
            }
          }
        }
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
        fireFan({ x: e.x, y: e.y, n: dv(1, 1, 3, 5), spread: 0.3, angle: e.aim(), speed: dv(2, 2.3, 2.8, 3.2), type: 'star', color: 'yellow' });
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
  // この面のボス（管理者ページの一覧・ボスの攻撃を試す機能・テストが使う。ボスを増やしたらここにも書く）
  //   id: CHARA_INFO のID  phases: 攻撃の配列  mid: 中ボスなら true  bgm: ボス戦の曲  def: 見た目（スペルカードの背景・魔法陣の色など）
  bosses: [
    { id: 'midboss3', phases: MIDBOSS3_PHASES, mid: true, def: { circleColor: '255,150,210' } },
    { id: 'boss3', phases: BOSS3_PHASES, bgm: 'boss3', def: { spellBg: 'dream', circleColor: '255,200,235' } },
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
    g.tasks.add(starShower(360, dv(24, 36, 54, 74), ['yellow', 'white', 'pink', 'cyan'], true));
    yield* zigzag(14, 'yellow', 'yellow', 'star');
    yield* waitClear(300);

    // 中ボス（コウモリ羽の子）
    const mid = g.spawnStageBoss('midboss3', { x: FIELD_W / 2, y: -50 });
    yield* mid.moveTo(FIELD_W / 2, 100, 60);
    yield* g.fight(mid, MIDBOSS3_PHASES);
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
    g.tasks.add(starShower(480, dv(28, 44, 64, 88), ['yellow', 'white', 'pink', 'cyan'], true));
    g.tasks.add(swirlWave(-1, 10));
    g.tasks.add(swirlWave(1, 10));
    yield 240;
    [80, 192, 304].forEach(x => laserFairy(x, 80));
    yield 60;
    [130, 254].forEach(x => handEnemy(x, { stopY: 140 }));
    yield 60;
    [120, 264].forEach(x => ringFairy(x, { color: 'blue', bcolor: 'yellow', type: 'star', stopY: 120, times: 4, n: dv(10, 14, 20, 26) }));
    yield* waitClear(900);
    yield 120;
  },
  // ボス戦（キー「V」のときはここから始まる）
  *boss(g) {
    // ボス（会話はあとで追加する）
    const boss = g.spawnStageBoss('boss3', { x: FIELD_W / 2, y: -50 });
    Sound.playBgm('boss3');
    g.showBgmTitle('boss3');
    yield* boss.moveTo(FIELD_W / 2, 100, 70);
    yield 30;
    yield* g.fight(boss, BOSS3_PHASES);
    yield* g.bossDown(boss);
  },
});
