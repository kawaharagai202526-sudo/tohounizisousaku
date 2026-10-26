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
  // 2.8.0 で資料「化物屋敷異変 スペルカード・弾幕案」をもとに作りかえた
  //   弾の見た目：煤（黒い煙の粒）、木片や瓦礫の弾、小鬼の形の弾（子分の家鳴）
  //   最後は、座敷わらしを逃がすための時間稼ぎとして耐久スペルで締める
  //   流れ：通常1 → スペル1 → 通常2 → スペル2（Hard/Lunatic：→ 通常3 → スペル3）→ 通常4 → スペル4 → 耐久スペル
  {
    // 通常1：画面を揺らしながら、柱の位置から弾を不規則に伸ばす
    type: 'non', hp: 1200, time: 30,
    *script(b, g) {
      yield* b.moveTo(FIELD_W / 2, 80, 40);
      const pillars = [36, 132, 252, 348];
      for (let f = 0; ; f++) {
        if (f % 120 === 0) { g.shake = 16; Sound.se('gishi'); }
        if (f % dv(16, 13, 10, 8) === 0) {
          const x = pick(pillars), y = rand(60, FIELD_H - 140);
          const a = aimAt(x, y) + rand(-1.2, 1.2);
          for (let i = 0; i < dv(3, 3, 4, 5); i++) fire({ x, y, angle: a, speed: 1.2 + i * 0.35, type: 'rubble', color: 'brown', delay: 14, silent: true });
          if (f % 32 === 0) Sound.se('tan');
        }
        yield;
      }
    },
  },
  {
    // 「ギシッ」という軋みに合わせて画面全体が揺れ、あちこちの柱の位置から弾が不規則に伸びる。軋むたびに、弾の向きが少しずつ変わる。
    // 軋みの音が予告になる。Hard/Lunatic は軋みの間隔が短く、Lunatic では音と揺れがずれることがある
    type: 'spell', name: '鳴符「夜中の家鳴り」', hp: 1600, time: 45,
    *script(b, g) {
      yield* b.moveTo(FIELD_W / 2, 70, 40);
      const pillars = [36, 132, 252, 348];
      let base = rand(TAU);
      for (let loop = 0; ; loop++) {
        g.shake = 20;
        Sound.se('gishi');
        // Lunatic：音と揺れのあと、ときどき弾が遅れて出る
        if (DIFF >= 3 && rng.next() < 0.35) yield 16;
        base += dv(0.35, 0.4, 0.45, 0.5);
        for (const x of pillars) {
          for (let k = 0; k < dv(1, 2, 2, 2); k++) {
            const y = rand(50, FIELD_H - 120), a = base + rand(-0.4, 0.4) + (x < FIELD_W / 2 ? 0 : Math.PI);
            for (let i = 0; i < dv(3, 4, 5, 5); i++) fire({ x, y, angle: a, speed: 1.0 + i * 0.3, type: 'rubble', color: i % 2 ? 'brown' : 'orange', delay: 12, silent: true });
          }
        }
        Sound.se('tan');
        yield dv(80, 70, 56, 46);
      }
    },
  },
  {
    // 通常2：子分の家鳴を左右に呼び出し、子分から小弾を撃たせる
    type: 'non', hp: 1200, time: 30,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 80, 40);
      for (let loop = 0; ; loop++) {
        for (const side of [-1, 1]) {
          const x = FIELD_W / 2 + side * rand(110, 160);
          spawnEnemy({
            x, y: -10, kind: 'kobun', color: 'purple', hp: 18, r: 10, score: 2000, drops: { point: 1 },
            script: function* (e) {
              yield* e.moveTo(x, rand(90, 170), 40);
              for (let k = 0; k < dv(3, 4, 5, 6); k++) {
                fireFan({ x: e.x, y: e.y, n: dv(3, 3, 5, 5), spread: 0.5, angle: aimAt(e.x, e.y), speed: 2.0, type: 'small', color: 'purple' });
                yield dv(40, 34, 28, 24);
              }
              e.setMove(1.5, -Math.PI / 2);
            },
          });
        }
        fireRing({ x: b.x, y: b.y, n: dv(10, 12, 16, 20), angle: rand(TAU), speed: 1.5, type: 'kobun', color: 'purple', silent: true });
        yield dv(150, 130, 110, 100);
      }
    },
  },
  {
    // 撃たれた弾が、時間とともに「古びて」いく。最初は白くて速い弾が、だんだん茶色くて遅い弾になり、最後は黒い煤になって画面に漂う。
    // 新しい白い弾は速いが少ない。古い煤は遅いが残り続けるので、煤の少ない場所を確保しながら避ける。Hard/Lunatic は古びる速さが上がり、煤が残る時間が長い
    type: 'spell', name: '古符「一夜百年の煤払い」', hp: 1600, time: 45,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 80, 40);
      const age = dv(70, 60, 48, 40), soot = dv(200, 260, 340, 420);
      for (let loop = 0; ; loop++) {
        const n = dv(8, 10, 12, 14), off = rand(TAU);
        for (let i = 0; i < n; i++) {
          fire({
            x: b.x, y: b.y, angle: off + (i * TAU) / n, speed: dv(2.4, 2.6, 2.8, 3.0), type: 'ball', color: 'white', silent: true,
            script: function* (bl) {
              yield age;
              bl.setColor('brown'); bl.speed = 1.1;
              yield age;
              bl.setColor('soot'); bl.setType('small'); bl.speed = 0.25; bl.angle = rand(TAU);
              bl.life = bl.frame + soot;
            },
          });
        }
        Sound.se('tan');
        yield dv(50, 42, 34, 28);
        if (loop % 4 === 3) b.wander(50, 50);
      }
    },
  },
  {
    // 通常3（Hard/Lunatic）：煤をばら撒き、視界を少し狭める
    type: 'non', hp: 1200, time: 30, minDiff: 2,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 80, 40);
      for (let f = 0; ; f++) {
        if (f % 8 === 0) fire({ x: b.x, y: b.y, angle: Math.PI / 2 + rand(-1.3, 1.3), speed: rand(0.4, 0.9), type: 'ball', color: 'soot', scale: 1.8, hitR: 6, life: 420, silent: true });
        if (f % dv(50, 44, 36, 30) === 0) fireFan({ x: b.x, y: b.y, n: dv(3, 5, 5, 7), spread: 0.7, angle: b.aim(), speed: 2.3, type: 'rubble', color: 'orange' });
        yield;
      }
    },
  },
  {
    // 子分の家鳴たちが、天井（画面の上）から一斉に降ってくる。着地した子分は、その場で跳ねながら小弾を撒く。
    // 降ってくる子分は撃って減らせる。減らすほど後半が楽になる
    type: 'spell', name: '鳴符「天井裏の大行進」', hp: 1600, time: 45, minDiff: 2,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 50, 40);
      for (let loop = 0; ; loop++) {
        Sound.se('gishi');
        for (let i = 0; i < dv(5, 6, 7, 8); i++) {
          const x = rand(24, FIELD_W - 24), land = rand(230, FIELD_H - 30);
          spawnEnemy({
            x, y: -12 - rand(0, 40), kind: 'kobun', color: i % 2 ? 'purple' : 'red', hp: 14, r: 10, score: 2000, drops: { point: 1 },
            script: function* (e) {
              let vy = 0.5;
              while (e.y < land) { e.y += vy; vy = Math.min(vy + 0.06, 4); yield; }
              // その場で跳ねながら小弾を撒く
              for (let k = 0; k < 4; k++) {
                for (let j = 0; j < 20; j++) { e.y = land - Math.sin((j / 20) * Math.PI) * 18; yield; }
                fireRing({ x: e.x, y: e.y, n: dv(3, 4, 5, 5), angle: rand(TAU), speed: 1.3, type: 'small', color: 'purple', silent: true });
                yield 16;
              }
              e.setMove(1.2, -Math.PI / 2);
            },
          });
        }
        yield 60;
        fireFan({ x: b.x, y: b.y, n: dv(3, 5, 5, 7), spread: 0.6, angle: b.aim(), speed: 2.2, type: 'kobun', color: 'red' });
        yield dv(200, 190, 170, 150);
      }
    },
  },
  {
    // 通常4：崩れかけた廊下を背に、扇状の弾を連射する
    type: 'non', hp: 1300, time: 30,
    *script(b, g) {
      yield* b.moveTo(FIELD_W / 2, 70, 40);
      for (let loop = 0; ; loop++) {
        const a = b.aim();
        for (let k = 0; k < dv(4, 5, 6, 7); k++) {
          fireFan({ x: b.x, y: b.y, n: dv(5, 5, 7, 7), spread: 1.0, angle: a + (k % 2 ? 0.08 : -0.08), speed: 2.0 + k * 0.15, type: 'rubble', color: 'brown' });
          yield dv(9, 8, 7, 6);
        }
        if (loop % 2) g.shake = 10;
        yield dv(50, 44, 36, 30);
        if (loop % 3 === 2) b.wander(50, 50);
      }
    },
  },
  {
    // 屋敷の間取り図のような弾幕。弾でできた壁と部屋が画面に描かれ、その中を弾が走る。崩れかけなので、ところどころ壁が抜けている。
    // 抜けている壁が通り道になる。部屋から部屋へ移りながら避ける。Hard/Lunatic は壁の抜けている場所が、時間とともに移る
    type: 'spell', name: '家符「座敷様の新しいお家」', hp: 1800, time: 50,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 40, 40);
      const xs = [128, 256], ys = [190, 320], top = 80, step = 14;
      const segs = [];
      // 壁の一区切りごとに、抜け（ドア）をひとつ作る
      for (const x of xs) for (const [y0, y1] of [[top, ys[0]], [ys[0], ys[1]], [ys[1], FIELD_H]]) segs.push({ vertical: true, c: x, a: y0, b: y1 });
      for (const y of ys) for (const [x0, x1] of [[0, xs[0]], [xs[0], xs[1]], [xs[1], FIELD_W]]) segs.push({ vertical: false, c: y, a: x0, b: x1 });
      const door = dv(54, 48, 42, 38);
      for (const s of segs) { s.door = rand(s.a + door / 2 + 6, s.b - door / 2 - 6); s.bullets = new Map(); }
      for (let f = 0; ; f++) {
        // Hard/Lunatic：抜けている場所が少しずつ動く
        if (DIFF >= 2) for (const s of segs) s.door = s.a + door / 2 + 6 + ((Math.sin(f * 0.006 + s.c * 0.05 + s.a * 0.03) + 1) / 2) * (s.b - s.a - door - 12);
        for (const s of segs) {
          for (let t = s.a + step / 2; t < s.b; t += step) {
            const open = Math.abs(t - s.door) < door / 2;
            const bl = s.bullets.get(t);
            if (open) { if (bl && bl.alive) bl.alive = false; s.bullets.delete(t); continue; }
            if (!bl || !bl.alive) s.bullets.set(t, fire({ x: s.vertical ? s.c : t, y: s.vertical ? t : s.c, speed: 0, type: 'small', color: 'purple', silent: true, delay: f < 5 ? 30 : 12 }));
          }
        }
        // 部屋の中を弾が走る（廊下に沿って、まっすぐ）
        if (f % dv(30, 26, 20, 16) === 10) {
          if (rng.next() < 0.5) {
            const y = pick([(top + ys[0]) / 2, (ys[0] + ys[1]) / 2, (ys[1] + FIELD_H) / 2]) + rand(-20, 20), side = randSign();
            fire({ x: side < 0 ? -6 : FIELD_W + 6, y, angle: side < 0 ? 0 : Math.PI, speed: dv(1.8, 2.0, 2.3, 2.6), type: 'rubble', color: 'orange', silent: true });
          } else {
            const x = pick([64, 192, 320]) + rand(-24, 24);
            fire({ x, y: top - 6, angle: Math.PI / 2, speed: dv(1.6, 1.8, 2.1, 2.4), type: 'rubble', color: 'orange', silent: true });
          }
        }
        yield;
      }
    },
  },
  {
    // 耐久スペル（5面の最後）。ボスは攻撃を受け付けず、逃げ道を塞ぐように弾を撒き続ける。背景の廊下が崩れ、落下物と床の傾きが最大になる。
    // 制限時間いっぱい耐えれば撃破扱い。傾きで弾が流される方向の上流側にいる。落下物の影（落ちる位置の予告）に注意する
    type: 'spell', name: '崩符「崩れる廊下の時間稼ぎ」', time: 40, survival: true,
    *script(b, g) {
      yield* b.moveTo(FIELD_W / 2, 60, 40);
      const dir = randSign();
      for (let f = 0; ; f++) {
        // 床の傾き：だんだん大きくなり、弾が傾いた方向へ流される
        const tilt = Math.min(1, f / 900) * dv(0.4, 0.5, 0.6, 0.7) * dir;
        g.tilt = tilt * 0.12;
        for (const bl of g.bullets.list) if (bl.alive && !bl.data) bl.evx = tilt;
        if (f % 90 === 0) { g.shake = 14; Sound.se('gishi'); }
        // 落下物：影（予告）のあと、落ちて砕ける
        if (f % dv(50, 42, 34, 28) === 0) {
          const x = rand(20, FIELD_W - 20), y = rand(160, FIELD_H - 20);
          fire({
            x, y, speed: 0, type: 'large', color: 'soot', delay: 50, silent: true, data: 'debris',
            script: function* (bl) {
              yield 18;
              fireRing({ x: bl.x, y: bl.y, n: dv(6, 8, 10, 12), angle: rand(TAU), speed: 1.4, type: 'rubble', color: 'brown', silent: true });
              Sound.se('tan');
              bl.alive = false;
            },
          });
        }
        // 逃げ道を塞ぐ弾
        if (f % dv(26, 22, 18, 15) === 0) {
          const a = b.aim() + rand(-0.8, 0.8);
          fire({ x: b.x, y: b.y, angle: a, speed: dv(1.6, 1.8, 2.0, 2.2), type: 'ball', color: 'purple', silent: true });
        }
        if (f % 120 === 60) b.wander(60, 60);
        yield;
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
