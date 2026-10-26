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

// 1面ボス：軒端 鬼乃（鬼瓦の付喪神）。2.8.0 で資料「化物屋敷異変 スペルカード・弾幕案」をもとに作りかえた
//   弾の見た目：瓦の欠片の弾（tile）、鬼の顔の大玉（鬼面弾 oni）、睨みの細いレーザー
//   1面なので、ちょん避けと誘導の基本を覚える弾幕。生まれたてらしく、弾の間隔が少し不揃い
//   流れ：通常1 → スペル1 → 通常2 → スペル2（Hard/Lunatic：→ 通常3 → スペル3）
const NOKIBA_PHASES = [
  {
    // 通常1：鬼面弾をゆっくり自機狙いで撃ち、そのまわりに瓦の小弾をばら撒く
    type: 'non', hp: 900, time: 30,
    *script(b) {
      yield 40;
      for (let loop = 0; ; loop++) {
        const a = b.aim();
        fire({ x: b.x, y: b.y, angle: a, speed: dv(1.3, 1.5, 1.8, 2.0), type: 'oni', color: 'orange' });
        const n = dv(6, 8, 12, 16);
        for (let i = 0; i < n; i++) {
          fire({
            x: b.x, y: b.y, angle: a + rand(-1.0, 1.0), speed: rand(1.2, 2.2) * dv(0.85, 1, 1.1, 1.2),
            type: 'tile', color: pick(['blue', 'purple', 'white']), silent: true, delay: randInt(6, 14),
          });
        }
        // 生まれたてらしく、間隔が少し不揃い
        yield dv(70, 56, 44, 36) + randInt(-8, 8);
        if (loop % 2) b.wander(60, 60);
      }
    },
  },
  {
    // 自機を「睨む」と細いレーザーで狙いの線が引かれ、一拍おいてその方向へ鬼面弾と瓦の弾の扇が飛ぶ。
    // 横に少しずらすだけで避けられる（ちょん避けの練習）。Hard は2連続、Lunatic は3連続で、ときどき目を逸らすふりをして逆方向にも撃つ
    type: 'spell', name: '瓦符「鬼瓦の睨み」', hp: 1000, time: 40,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      for (let loop = 0; ; loop++) {
        const glares = dv(1, 1, 2, 3);
        for (let k = 0; k < glares; k++) {
          const a = b.aim();
          fireLaser({ x: b.x, y: b.y, angle: a, length: 720, width: 4, warn: 34, dur: 8, color: 'red' });
          yield 42;
          const feint = DIFF >= 3 && loop % 3 === 2 && k === glares - 1;
          for (const d of feint ? [a, a + Math.PI] : [a]) {
            fire({ x: b.x, y: b.y, angle: d, speed: 2.4, type: 'oni', color: 'red' });
            fireFan({ x: b.x, y: b.y, n: dv(5, 7, 9, 9), spread: dv(0.9, 0.8, 0.75, 0.7), angle: d, speed: 2.1, type: 'tile', color: 'orange', silent: true });
          }
          yield dv(30, 24, 18, 14);
        }
        yield dv(60, 50, 40, 34);
        b.wander(50, 50);
      }
    },
  },
  {
    // 通常2：左右に揺れながら、瓦の弾を扇状に3連射する
    type: 'non', hp: 1000, time: 30,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        b.move(FIELD_W / 2 + (loop % 2 ? 1 : -1) * dv(60, 70, 80, 90), 90 + rand(-15, 15), 50);
        yield 20;
        for (let k = 0; k < 3; k++) {
          fireFan({ x: b.x, y: b.y, n: dv(5, 7, 9, 11), spread: dv(1.0, 1.1, 1.2, 1.3), angle: b.aim(), speed: dv(1.8, 2.1, 2.4, 2.6) - k * 0.15, type: 'tile', color: ['blue', 'cyan', 'white'][k] });
          yield dv(12, 10, 8, 7) + randInt(0, 4);
        }
        yield dv(50, 40, 32, 26);
      }
    },
  },
  {
    // 画面の上から瓦が降ってきて、下の端（地面）に落ちると割れ、小弾になって上向きに跳ね返る。
    // 降ってくる瓦より、割れたあとの跳ね返りに注意（下に張り付きすぎない）
    type: 'spell', name: '屋符「屋根の上から失礼」', hp: 1100, time: 40,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 70, 40);
      for (let f = 0; ; f++) {
        if (f % dv(26, 20, 15, 12) === 0) {
          fire({
            x: rand(16, FIELD_W - 16), y: -10, angle: Math.PI / 2, speed: 0.6, ay: 0.03, maxFall: dv(2.2, 2.6, 3.0, 3.3),
            type: 'tile', color: 'purple', scale: 1.6, hitR: 4.2, silent: true,
            script: function* (bl) {
              while (bl.y < FIELD_H - 6) yield;
              const n = dv(3, 4, 6, 7);
              for (let i = 0; i < n; i++) {
                fire({ x: bl.x, y: FIELD_H - 8, angle: -Math.PI / 2 + rand(-0.9, 0.9), speed: rand(2.0, 3.0), ay: 0.05, maxFall: 2.4, type: 'small', color: 'blue', silent: true });
              }
              Sound.se('tan');
              bl.alive = false;
            },
          });
        }
        if (f % dv(100, 90, 70, 60) === 50) fireFan({ x: b.x, y: b.y, n: dv(1, 3, 3, 5), spread: 0.45, angle: b.aim(), speed: 2.2, type: 'ball', color: 'red' });
        if (f % 240 === 200) b.wander(60, 50);
        yield;
      }
    },
  },
  {
    // 通常3（Hard/Lunatic）：鬼面弾を左右から交互に撃ち、間を瓦の小弾で埋める
    type: 'non', hp: 1000, time: 30, minDiff: 2,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        const sx = FIELD_W / 2 + (loop % 2 ? 1 : -1) * 150, sy = 40;
        fire({ x: sx, y: sy, angle: aimAt(sx, sy), speed: 1.9, type: 'oni', color: 'red', delay: 24 });
        for (let k = 0; k < dv(6, 8, 10, 14); k++) {
          fire({ x: b.x, y: b.y, angle: Math.PI / 2 + rand(-1.1, 1.1), speed: rand(1.4, 2.4), type: 'tile', color: 'blue', silent: true });
          if (k % 2) yield 3;
        }
        yield dv(44, 40, 34, 28);
      }
    },
  },
  {
    // 瓦の弾を並べて画面に「境界線」を引く。線は少しずつ自機の側へ迫り、いられる範囲がだんだん狭くなる。
    // 線の向こうからは鬼面弾が撃ちこまれる。線の継ぎ目は一定間隔で開くので、そこを抜けて向こう側へ出ると楽になる
    type: 'spell', name: '縄符「ここから先は私の縄張り」', hp: 1200, time: 45, minDiff: 2,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 60, 40);
      const step = 16, xs = [];
      for (let x = step / 2; x < FIELD_W; x += step) xs.push(x);
      const line = xs.map(() => null);
      let lineY = 120, gap = -1, gapUntil = 0;
      for (let f = 0; ; f++) {
        lineY = Math.min(FIELD_H - 110, lineY + dv(0.12, 0.14, 0.16, 0.2));
        // 継ぎ目：一定間隔で、どこか1か所が開く
        if (f % 150 === 0) { gap = randInt(2, xs.length - 5); gapUntil = f + dv(90, 80, 70, 60); }
        if (f >= gapUntil) gap = -1;
        xs.forEach((x, i) => {
          const open = gap >= 0 && i >= gap && i < gap + 3;
          const bl = line[i];
          if (open) {
            if (bl && bl.alive) { bl.alive = false; Fx.cancel(bl.x, bl.y, bl.color); }
            line[i] = null;
            return;
          }
          if (!bl || !bl.alive) line[i] = fire({ x, y: lineY, speed: 0, type: 'tile', color: 'orange', silent: true, delay: 10 });
          else bl.y = lineY + Math.sin(f * 0.08 + i * 0.6) * 1.5;
        });
        // 線の向こうから鬼面弾を撃ちこむ
        if (f % dv(80, 70, 56, 44) === 30) {
          const sx = rand(40, FIELD_W - 40);
          fire({ x: sx, y: lineY - 50, angle: aimAt(sx, lineY - 50), speed: 1.7, type: 'oni', color: 'red', delay: 20 });
        }
        if (f % 60 === 0) fireFan({ x: b.x, y: b.y, n: 5, spread: 1.2, angle: Math.PI / 2, speed: 1.6, type: 'tile', color: 'blue', silent: true });
        yield;
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
