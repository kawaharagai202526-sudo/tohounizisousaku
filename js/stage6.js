'use strict';
// ============================================================
//  6面：瓦礫の空 ― 中ボス：家鳴 鳴音（名前は出さない）／ボス：座敷 宿美（座敷わらし）
//  崩れた屋敷のがれきが浮かぶ、夜明け前の空（背景 RubbleSkyBG）
//  道中の敵はほかの面と共通のもの（js/stage1.js・stage3.js・stage4.js）も使う
// ============================================================

// ------------------------------------------------------------
//  座敷 宿美の攻撃の部品（最後のスペル「座敷童子のいる家」でも重ねて使う）
//  2.8.0 で資料「化物屋敷異変 スペルカード・弾幕案」をもとに作りかえた
//  弾の見た目：手鞠（temari）、小判（koban。得点アイテムと見まちがえないよう金色の楕円）、足跡（foot）、金色の光弾
// ------------------------------------------------------------

// 手鞠：床や壁で跳ねる。bounces 回跳ねたら、そのまま落ちていく
function temari(x, y, vx, vy, o = {}) {
  let bounces = o.bounces ?? 2;
  return fire({
    x, y, speed: 0, evx: vx, evy: vy, ay: o.gravity ?? 0.05, maxFall: 6, type: 'temari', color: o.color || 'red', silent: true, margin: 60, data: 'temari',
    script: function* (bl) {
      for (;;) {
        if ((bl.x < 10 && bl.evx < 0) || (bl.x > FIELD_W - 10 && bl.evx > 0)) bl.evx = -bl.evx;
        if (bounces > 0 && bl.y > FIELD_H - 12 && bl.evy > 0) { bl.evy = -bl.evy * 0.82; bounces--; }
        if (o.ceiling && bl.y < 10 && bl.evy < 0) bl.evy = -bl.evy;
        yield;
      }
    },
  });
}

// 足音：見えない足音が畳の上を歩き回る。通り道が先に薄く光り、少し遅れてその道筋に弾が走る
function* footsteps(b, o = {}) {
  let x = o.x ?? rand(60, FIELD_W - 60), y = o.y ?? rand(140, 260), a = rand(TAU);
  const stepLen = 18, glow = o.glow ?? dv(50, 46, 40, 36);
  for (let s = 0; ; s++) {
    if (s % dv(7, 6, 6, 5) === 0) a += randSign() * rand(0.6, 1.4); // 向きが変わる瞬間に注意
    let nx = x + Math.cos(a) * stepLen, ny = y + Math.sin(a) * stepLen;
    if (nx < 20 || nx > FIELD_W - 20) { a = Math.PI - a; nx = clamp(nx, 20, FIELD_W - 20); }
    if (ny < 60 || ny > FIELD_H - 30) { a = -a; ny = clamp(ny, 60, FIELD_H - 30); }
    x = nx; y = ny;
    const side = s % 2 ? 1 : -1, px = x + Math.cos(a + Math.PI / 2) * side * 5, py = y + Math.sin(a + Math.PI / 2) * side * 5;
    const dir = a;
    fire({
      x: px, y: py, angle: dir, speed: 0, type: 'foot', color: o.color || 'pink', delay: glow, silent: true,
      script: function* (bl) { yield 20; bl.speed = 0.2; bl.accel = 0.03; bl.maxSpeed = dv(1.3, 1.5, 1.8, 2.0); },
    });
    if (s % 4 === 0) Sound.se('tan');
    yield o.interval ?? dv(14, 12, 11, 10);
  }
}

// 惹きつけ：画面中に撒かれた弾が、ボスに惹きつけられるように集まり、集まりきると花のように開く
function* attraction(b, o = {}) {
  for (let loop = 0; ; loop++) {
    const pulled = [];
    const n = o.n ?? dv(16, 20, 26, 32);
    for (let i = 0; i < n; i++) {
      let x, y, tries = 0;
      do { x = rand(10, FIELD_W - 10); y = rand(20, FIELD_H - 10); tries++; } while (dist(x, y, G.player.x, G.player.y) < 70 && tries < 20);
      pulled.push(fire({
        x, y, speed: 0, type: 'ball', color: 'gold', delay: 30, silent: true,
        script: function* (bl) {
          yield 20;
          for (;;) {
            const d = dist(bl.x, bl.y, b.x, b.y);
            if (d < 26) { bl.speed = 0; yield; continue; }
            bl.angle = angleTo(bl.x, bl.y, b.x, b.y);
            bl.speed = Math.min(bl.speed + 0.03, o.pull ?? dv(1.3, 1.5, 1.9, 2.2));
            yield;
          }
        },
      }));
    }
    Sound.se('kira');
    yield o.gather ?? dv(180, 170, 150, 130);
    // 花のように開く
    for (const bl of pulled) if (bl.alive) { bl.script = null; bl.angle = angleTo(b.x, b.y, bl.x, bl.y) + rand(-0.3, 0.3); bl.speed = 0.5; bl.accel = 0.03; bl.maxSpeed = 2.0; }
    const petals = dv(5, 5, 6, 7);
    for (let ring = 0; ring < (DIFF >= 2 ? 2 : 1); ring++) {
      for (let p = 0; p < petals; p++) {
        for (let k = 0; k < 5; k++) {
          const a = (p * TAU) / petals + ring * (Math.PI / petals) + (k - 2) * 0.12;
          fire({ x: b.x, y: b.y, angle: a, speed: 1.2 + (2 - Math.abs(k - 2)) * 0.35 + ring * 0.3, type: 'ball', color: ring ? 'pink' : 'gold', silent: true });
        }
      }
    }
    Sound.se('tan');
    yield o.rest ?? 60;
  }
}

// 小判：円形に広げる
function kobanRing(b, n, speed, color = 'gold') {
  fireRing({ x: b.x, y: b.y, n, angle: rand(TAU), speed, type: 'koban', color, silent: true });
  Sound.se('tan');
}

// ------------------------------------------------------------
//  中ボス：家鳴 鳴音（ぼろぼろの5面ボス。座敷様を守るため、最後の力で立ちふさがる。名前は出さない）
// ------------------------------------------------------------
// ぼろぼろの体で撃つ、弱々しい扇状の弾。一度倒しても、一度だけ立ち上がって同じ弾幕を撃ち直してくる
const yanari6Guard = (again) => function* (b) {
  if (again) {
    // 立ち上がる
    for (let i = 0; i < 40; i++) { b.alpha = 0.4 + 0.6 * (i % 8 < 4 ? 1 : 0.3); yield; }
    b.alpha = 1;
    Sound.se('charge');
  }
  yield* b.moveTo(FIELD_W / 2, 90, 30);
  for (let loop = 0; ; loop++) {
    const a = b.aim() + rand(-0.15, 0.15);
    fireFan({ x: b.x, y: b.y, n: dv(5, 7, 9, 11) + (again ? 2 : 0), spread: 1.3, angle: a, speed: dv(1.4, 1.6, 1.8, 2.0) * rand(0.9, 1.05), type: 'rice', color: again ? 'pink' : 'purple' });
    yield dv(36, 30, 26, 22) + randInt(0, 10);
    if (loop % 4 === 3) b.wander(40, 40);
  }
};
const YANARI6_PHASES = [
  { type: 'spell', name: '守符「指一本触れさせない」', hp: 1000, time: 30, script: yanari6Guard(false) },
  { type: 'spell', name: '守符「指一本触れさせない」', hp: 800, time: 25, script: yanari6Guard(true) },
];

// ------------------------------------------------------------
//  ボス：座敷 宿美（住処を追われた愛しき災難）
//  子どもの遊び（手鞠、隠れ鬼）と、福の神としての栄枯盛衰の二本立て
//  流れ：通常1 → スペル1 → 通常2 → スペル2 → 通常3 → スペル3 → 通常4 → スペル4 →（Hard/Lunatic：スペル5 →）スペル6 → ラストスペル
// ------------------------------------------------------------
const ZASHIKI_PHASES = [
  {
    // 通常1：手鞠の弾を、跳ねるような軌道でばら撒く
    type: 'non', hp: 1300, time: 30,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      for (let loop = 0; ; loop++) {
        for (let i = 0; i < dv(3, 4, 5, 6); i++) temari(b.x, b.y, rand(-2.2, 2.2), rand(-3.2, -1.6), { color: pick(['red', 'pink', 'orange']) });
        Sound.se('tan');
        if (loop % 2) fireFan({ x: b.x, y: b.y, n: dv(3, 3, 5, 5), spread: 0.4, angle: b.aim(), speed: 2.2, type: 'small', color: 'pink' });
        yield dv(40, 34, 28, 24);
        if (loop % 4 === 3) b.wander(50, 50);
      }
    },
  },
  {
    // 数え歌の拍子に合わせて、手鞠の弾がひとつずつ増えて画面中を跳ね回る。「ひとつ、ふたつ……」と十まで数えると、手鞠が一斉に弾ける。
    // 数え始めは手鞠が少ない。数が増える前に、跳ね返りの軌道を覚えておく。Hard/Lunatic は手鞠の跳ねる速さが上がり、弾けたときの小弾が増える
    type: 'spell', name: '童符「手鞠唄の数え歌」', hp: 1700, time: 45,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 80, 40);
      const COUNT = ['ひとつ', 'ふたつ', 'みっつ', 'よっつ', 'いつつ', 'むっつ', 'ななつ', 'やっつ', 'ここのつ', 'とお'];
      const sp = dv(1.6, 1.9, 2.2, 2.5);
      for (;;) {
        const balls = [];
        for (let c = 0; c < 10; c++) {
          Fx.text(b.x, b.y - 30, COUNT[c], '#ffd0e0', 13, 50);
          const a = rand(TAU);
          balls.push(temari(b.x, b.y, Math.cos(a) * sp, Math.sin(a) * sp, { gravity: 0, bounces: 9999, ceiling: true, color: c % 2 ? 'pink' : 'red' }));
          Sound.se('kira');
          yield dv(36, 32, 28, 24);
        }
        yield 20;
        for (const bl of balls) {
          if (!bl.alive) continue;
          fireRing({ x: bl.x, y: bl.y, n: dv(5, 6, 8, 10), angle: rand(TAU), speed: 1.4, type: 'small', color: 'pink', silent: true });
          bl.alive = false;
        }
        Sound.se('tan');
        yield 60;
      }
    },
  },
  {
    // 通常2：小判の弾を円形に広げる（得点アイテムと見まちがえないよう、金色の楕円）
    type: 'non', hp: 1300, time: 30,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      for (let loop = 0; ; loop++) {
        kobanRing(b, dv(12, 14, 18, 22), dv(1.4, 1.6, 1.8, 2.0));
        yield 14;
        if (loop % 2) kobanRing(b, dv(8, 10, 12, 14), 1.1, 'orange');
        yield dv(40, 34, 28, 24);
        if (loop % 4 === 3) b.wander(50, 50);
      }
    },
  },
  {
    // 姿の見えない足音だけが、畳の上を歩き回る。足音の通り道が先に薄く光り、少し遅れてその道筋に弾が走る。
    // 光った道筋をまたがない位置で待つ。足音の向きが変わる瞬間に注意する。Hard/Lunatic は足音が二人分になる
    type: 'spell', name: '福符「座敷わらしの足音」', hp: 1800, time: 45,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 50, 40);
      b.tasks.add(footsteps(b, { color: 'pink' }));
      if (DIFF >= 2) b.tasks.add(footsteps(b, { color: 'yellow', x: FIELD_W - 80 }));
      for (let f = 0; ; f++) {
        if (f % dv(90, 80, 70, 60) === 0) fireFan({ x: b.x, y: b.y, n: 3, spread: 0.4, angle: b.aim(), speed: 2.0, type: 'koban', color: 'gold' });
        yield;
      }
    },
  },
  {
    // 通常3：足跡の形の弾を残しながら、画面をゆっくり歩き回る
    type: 'non', hp: 1300, time: 30,
    *script(b) {
      for (let loop = 0; ; loop++) {
        b.move(rand(60, FIELD_W - 60), rand(60, 160), 90, Ease.linear);
        for (let f = 0; f < 90; f++) {
          if (f % dv(10, 9, 8, 7) === 0) {
            const a = angleTo(b.prevX, b.y, b.x, b.y);
            fire({ x: b.x + (f % 20 < 10 ? -5 : 5), y: b.y + 12, angle: Math.PI / 2 + rand(-0.4, 0.4), speed: 0, type: 'foot', color: 'pink', silent: true,
              script: function* (bl) { yield 40; bl.accel = 0.02; bl.maxSpeed = dv(1.2, 1.4, 1.7, 1.9); } });
          }
          yield;
        }
        fireFan({ x: b.x, y: b.y, n: dv(3, 5, 5, 7), spread: 0.6, angle: b.aim(), speed: 2.2, type: 'koban', color: 'gold' });
      }
    },
  },
  {
    // 画面中に撒かれた弾が、ボスに惹きつけられるようにボスの方へ集まっていく。集まりきると、ボスを中心に花のように開く。
    // 集まる途中の弾は、自機の後ろからも来る。ボスに近づくほど巻き込まれやすい。Hard/Lunatic は集まる速さが上がり、開いたあとの弾が二重になる
    type: 'spell', name: '惹符「誰もが振り向く福の神」', hp: 1900, time: 45,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 110, 40);
      yield* attraction(b);
    },
  },
  {
    // 通常4：金色の光弾を花のように開く
    type: 'non', hp: 1400, time: 30,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 100, 40);
      for (let loop = 0; ; loop++) {
        const petals = dv(5, 6, 6, 7), off = rand(TAU);
        for (let p = 0; p < petals; p++) {
          for (let k = 0; k < 5; k++) {
            const a = off + (p * TAU) / petals + (k - 2) * 0.1;
            fire({ x: b.x, y: b.y, angle: a, speed: 1.3 + (2 - Math.abs(k - 2)) * 0.3, accel: -0.01, minSpeed: 1.1, angVel: (loop % 2 ? 1 : -1) * 0.004, type: 'ball', color: 'gold', silent: true });
          }
        }
        Sound.se('tan');
        yield dv(64, 56, 48, 42);
      }
    },
  },
  {
    // 撃ち込むほど弾幕が豪華になっていく。小判の弾が増え、金色の弾が混ざる。ただし弾と一緒に、得点アイテムも大量に出る（資料では家運の福アイテム）。
    // 欲張ってアイテムを取りに行くと危ない。Hard/Lunatic は豪華になる速さが上がる
    type: 'spell', name: '栄符「千客万来・家運隆盛」', hp: 2000, time: 50,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 80, 40);
      for (let loop = 0; ; loop++) {
        const lux = clamp((1 - b.hp / b.maxHp) * dv(1.0, 1.2, 1.5, 1.8), 0, 1);
        kobanRing(b, Math.round(dv(8, 10, 12, 14) + lux * dv(8, 10, 14, 18)), 1.4 + lux * 0.5);
        if (lux > 0.3) fireRing({ x: b.x, y: b.y, n: Math.round(6 + lux * 10), angle: rand(TAU), speed: 1.1 + lux * 0.6, type: 'ball', color: 'gold', silent: true });
        if (lux > 0.6) fireFan({ x: b.x, y: b.y, n: 5, spread: 0.7, angle: b.aim(), speed: 2.4, type: 'koban', color: 'orange' });
        // 弾と一緒に得点アイテムも出る
        if (loop % 2 === 0) dropItems(b.x + rand(-40, 40), b.y + 20, { point: 1 + Math.round(lux * 3) });
        yield Math.round(dv(46, 40, 34, 30) - lux * 10);
        if (loop % 5 === 4) b.wander(50, 50);
      }
    },
  },
  {
    // ボスが姿を消し、画面に並んだ瓦礫の陰のどれかに隠れる。隠れている場所から弾が撃たれ、数秒ごとに隠れ場所が変わる。
    // 本物の隠れ場所を撃つとダメージが入る（外れの瓦礫を撃っても何も起きない）。弾の出どころを見て、隠れ場所を当てる
    type: 'spell', name: '鬼符「座敷童子の隠れ鬼」', hp: 1700, time: 50, minDiff: 2,
    *script(b) {
      const spots = [[60, 90], [192, 70], [324, 90], [110, 180], [274, 180]];
      const decoys = [];
      let hide = randInt(0, spots.length - 1);
      for (let loop = 0; ; loop++) {
        // 隠れる（ほかの場所には瓦礫を置く）
        for (const e of decoys) e.alive = false;
        decoys.length = 0;
        b.disguise = false;
        for (let i = 0; i < 20; i++) { b.alpha = 1 - i / 20; yield; }
        hide = (hide + randInt(1, spots.length - 1)) % spots.length;
        b.x = spots[hide][0]; b.y = spots[hide][1];
        spots.forEach(([x, y], i) => {
          if (i !== hide) decoys.push(spawnEnemy({ x, y, kind: 'decoy', hp: 1e9, r: 18, score: 0, drops: {}, keep: true, noBody: true }));
        });
        b.disguise = true;
        b.alpha = 1;
        for (let f = 0; f < dv(220, 200, 180, 160); f++) {
          if (f % dv(30, 26, 20, 16) === 10) {
            fireFan({ x: b.x, y: b.y, n: dv(3, 3, 5, 5), spread: 0.5, angle: b.aim(), speed: 2.0, type: 'temari', color: 'red' });
          }
          if (f % 60 === 40) fireRing({ x: b.x, y: b.y, n: dv(6, 8, 10, 12), angle: rand(TAU), speed: 1.3, type: 'small', color: 'pink', silent: true });
          yield;
        }
      }
    },
  },
  {
    // 背景の屋敷が傾くのに合わせて、画面の弾がすべて傾いた方向へ流れ落ちていく。ボスが「去る」動きをするたびに、傾きが大きくなる。
    // 流れの上流側を保つ。傾きが戻る瞬間に、位置を立て直す。Hard/Lunatic は傾く向きが左右で入れ替わる
    type: 'spell', name: '傾符「去りゆく家の没落」', hp: 1800, time: 50,
    *script(b, g) {
      yield* b.moveTo(FIELD_W / 2, 70, 40);
      let tilt = 0, target = 0, dir = randSign();
      for (let loop = 0; ; loop++) {
        // 去る：端へ下がると、傾きが大きくなる
        if (DIFF >= 2 && loop % 2 === 1) dir = -dir;
        target = dir * Math.min(1.2, 0.35 + loop * 0.15) * dv(0.6, 0.7, 0.85, 1.0);
        b.move(FIELD_W / 2 - dir * 130, 50, 50);
        for (let f = 0; f < 150; f++) {
          tilt += (target - tilt) * 0.03;
          g.tilt = tilt * 0.14;
          for (const bl of g.bullets.list) if (bl.alive) bl.evx = tilt;
          if (f === 60) b.move(FIELD_W / 2, 80, 60);
          if (f % dv(12, 10, 8, 7) === 0) fire({ x: rand(10, FIELD_W - 10), y: -6, angle: Math.PI / 2, speed: dv(1.3, 1.5, 1.8, 2.0), type: f % 3 ? 'koban' : 'temari', color: f % 3 ? 'gold' : 'red', silent: true });
          if (f % 50 === 25) fireFan({ x: b.x, y: b.y, n: dv(3, 5, 5, 7), spread: 0.7, angle: b.aim(), speed: 2.0, type: 'small', color: 'pink' });
          yield;
        }
        // 傾きが少し戻る瞬間
        target = 0;
        for (let f = 0; f < 40; f++) { tilt += (target - tilt) * 0.06; g.tilt = tilt * 0.14; for (const bl of g.bullets.list) if (bl.alive) bl.evx = tilt; yield; }
      }
    },
  },
  {
    // ラストスペル。屋敷の崩壊が最高潮に達し、それまでのスペルの要素（手鞠、足音、惹きつけ、小判）が順番に重なっていく。
    // 住み着いた家を栄えさせる座敷わらしの総決算。撃破すると、屋敷が完全に崩れ落ち、部屋が光になって人里へ帰っていく
    type: 'spell', name: 'ラストスペル「座敷童子のいる家」', hp: 2600, time: 70,
    *script(b, g) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      g.shake = 30;
      // 手鞠
      b.tasks.add((function* () {
        for (;;) {
          temari(b.x, b.y, rand(-2.2, 2.2), rand(-3.0, -1.6), { color: pick(['red', 'pink']) });
          yield dv(34, 28, 24, 20);
        }
      })());
      yield 420;
      // 足音
      b.tasks.add(footsteps(b, { color: 'pink', interval: dv(16, 14, 12, 11) }));
      yield 420;
      // 惹きつけ
      b.tasks.add(attraction(b, { n: dv(10, 12, 16, 20), gather: 160, rest: 90 }));
      yield 420;
      // 小判
      for (let loop = 0; ; loop++) {
        kobanRing(b, dv(8, 10, 12, 14), 1.5);
        if (loop % 4 === 3) g.shake = 12;
        yield dv(60, 52, 44, 38);
      }
    },
  },
];

// ------------------------------------------------------------
//  道中の敵
// ------------------------------------------------------------

// 鈴を鳴らす妖精：降りてきて止まり、輪と、少し遅れて響く輪を撃つ
function bellFairy(x, stopY = 90) {
  return spawnEnemy({
    x, y: -16, hp: 40, color: 'yellow', score: 3000, drops: { power: 2, point: 2 },
    script: function* (e) {
      yield* e.moveTo(x, stopY, 50);
      for (let k = 0; k < dv(2, 2, 3, 3); k++) {
        const n = dv(8, 12, 16, 20), off = rand(TAU);
        fireRing({ x: e.x, y: e.y, n, angle: off, speed: 1.7, type: 'ball', color: 'yellow' });
        Sound.se('kira');
        yield 16;
        fireRing({ x: e.x, y: e.y, n, angle: off + Math.PI / n, speed: 1.3, type: 'small', color: 'orange', silent: true });
        yield 60;
      }
      e.setMove(0, -Math.PI / 2, 0.05);
    },
  });
}

STAGES.push({
  name: '瓦礫の空',
  nameEn: 'The Sky above the Rubble',
  bg: RubbleSkyBG,
  bgm: 'stage6',
  zako: 'handEye', // 道中の妖精と緑の手は「一つ目の手」の絵にする
  // この面のボス（管理者ページの一覧・ボスの攻撃を試す機能・テストが使う。ボスを増やしたらここにも書く）
  //   id: CHARA_INFO のID  phases: 攻撃の配列  mid: 中ボスなら true（名前を出さない）  bgm: ボス戦の曲  def: 見た目（スペルカードの背景・魔法陣の色など）
  bosses: [
    { id: 'yanari6', phases: YANARI6_PHASES, mid: true, def: { spellBg: 'yanari', circleColor: '220,140,255' } },
    { id: 'zashiki', phases: ZASHIKI_PHASES, bgm: 'boss6', def: { spellBg: 'zashiki', circleColor: '255,220,150', finalDrops: { power: 10, point: 24, bigpower: 1 } } },
  ],
  // 最後の面なので、いちばん難しい
  speedScale: 1.2,
  densityScale: 1.45,
  hpScale: 1.25,
  *script(g) {
    yield 160;
    // 前半：大群 → 降ってくるがれき → 鈴の妖精 → 紙きれと狙撃
    g.tasks.add(swarmStream(-1, 16, { color: 'blue' }));
    yield 50;
    g.tasks.add(swarmStream(1, 16, { color: 'blue' }));
    yield 120;
    g.tasks.add(tileShower(420, dv(20, 30, 42, 56), ['purple', 'blue', 'white'], true));
    yield 100;
    [96, 288].forEach(x => bellFairy(x, 90));
    yield 160;
    g.tasks.add(paperRain(300, dv(30, 42, 56, 70)));
    yield 60;
    [80, 192, 304].forEach(x => sniperFairy(x, 100));
    yield 160;
    [100, 284].forEach(x => handEnemy(x, { stopY: 120 }));
    yield 160;
    yield* waitClear(300);

    // 中ボス：家鳴 鳴音（名前は出さない。会話のあと戦い、奥へ逃げる）
    const mid = g.spawnStageBoss('yanari6', { x: FIELD_W / 2, y: -50 });
    yield* mid.moveTo(FIELD_W / 2, 100, 60);
    yield* g.talk(STORY.stage6mid[g.charId].before);
    yield* g.fight(mid, YANARI6_PHASES);
    if (mid.hp <= 0) dropItems(mid.x, mid.y, { power: 6, point: 10, bomb: 1 });
    if (STORY.stage6mid[g.charId].after.length) yield* g.talk(STORY.stage6mid[g.charId].after);
    yield* g.bossDown(mid, true);
    yield 60;

    // 後半：大妖精 → 鈴の妖精とうずまき → レーザー → 大群 → 一列の妖精
    splitterFairy(110);
    yield 40;
    splitterFairy(274);
    yield 200;
    for (let k = 0; k < 3; k++) { bellFairy(rand(60, FIELD_W - 60), 80 + k * 20); yield 70; }
    g.tasks.add(swirlWave(-1, 10));
    g.tasks.add(swirlWave(1, 10));
    yield 200;
    [70, 314].forEach(x => laserFairy(x, 110));
    yield 120;
    g.tasks.add(tileShower(480, dv(30, 44, 60, 80), ['purple', 'blue', 'white'], true));
    for (let w = 0; w < 3; w++) {
      g.tasks.add(swarmStream(-1, 12, { y: 30 + w * 30, color: w % 2 ? 'red' : 'blue' }));
      g.tasks.add(swarmStream(1, 12, { y: 30 + w * 30, color: w % 2 ? 'red' : 'blue' }));
      yield 110;
    }
    [80, 304].forEach(x => sniperFairy(x, 100));
    yield 160;
    fairyLine(7, 50);
    yield* waitClear(900);
    yield 120;
  },
  // ボス戦（キー「V」のときはここから始まる）
  *boss(g) {
    const boss = g.spawnStageBoss('zashiki', { x: FIELD_W / 2, y: -50 });
    yield* boss.moveTo(FIELD_W / 2, 100, 70);
    yield* g.talk(STORY.stage6[g.charId].before);
    yield* g.fight(boss, ZASHIKI_PHASES);
    yield* g.bossDown(boss);
    yield* g.talk(STORY.stage6[g.charId].after);
  },
});
