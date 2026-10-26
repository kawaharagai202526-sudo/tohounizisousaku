'use strict';
// ============================================================
//  2面：虫食いの空き家 ― 中ボス：瑠璃（名前は出さない）／ボス：喰代 守子（家守）
// ============================================================

// 中ボス：瑠璃（鹿の角と瑠璃色の蝶の羽、一冊の本を持つ子。名前は出さない）
// 前のゲーム『東方星降夜』の4面ボスの攻撃を、2面に合わせてやさしくしたもの
const stopCurl = frames => function* (bl) { yield frames; bl.angVel = 0; };
const RURI_MID_PHASES = [
  {
    // 回りながら広がる蝶の輪と、自機狙いの札
    type: 'non', hp: 1000, time: 25,
    *script(b) {
      yield 30;
      for (let loop = 0; ; loop++) {
        const dir = loop % 2 ? 1 : -1;
        fireRing({ x: b.x, y: b.y, n: dv(8, 12, 16, 22), angle: rand(TAU), speed: 2.0, accel: -0.02, minSpeed: 1.0, angVel: dir * 0.006, type: 'butterfly', color: dir > 0 ? 'blue' : 'cyan', script: stopCurl(90) });
        yield 34;
        fireFan({ x: b.x - 16, y: b.y, n: dv(1, 3, 3, 5), spread: 0.3, angle: b.aim(), speed: 2.0, type: 'amulet', color: 'blue' });
        yield 24;
        if (loop % 2) b.wander(60, 60);
      }
    },
  },
  {
    // 大きな蝶が舞いながら、鱗粉（小さな弾）をこぼしていく
    type: 'spell', name: '蝶符「瑠璃色の鱗粉」', hp: 1000, time: 30,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      for (;;) {
        const n = dv(4, 5, 7, 9);
        const off = rand(TAU);
        for (let i = 0; i < n; i++) {
          const dir = i % 2 ? 1 : -1;
          fire({
            x: b.x, y: b.y, angle: off + (i * TAU) / n, speed: 1.5, angVel: dir * 0.012,
            type: 'butterfly', color: 'blue', scale: 1.5, hitR: 4.5,
            script: function* (bl) {
              for (let f = 0; f < 240; f++) {
                if (f % dv(14, 12, 10, 8) === 0) fire({ x: bl.x, y: bl.y, angle: rand(TAU), speed: rand(0.2, 0.6), type: 'dot', color: 'cyan', silent: true, delay: 6, life: 300 });
                if (f === 90) bl.angVel = 0;
                yield;
              }
            },
          });
        }
        yield dv(96, 80, 66, 54);
        b.wander(60, 50);
      }
    },
  },
];

// ------------------------------------------------------------
//  ボス：喰代 守子（家を守るやもり。虫が大好物）
// ------------------------------------------------------------
const KURAISHIRO_PHASES = [
  // 2.8.0 で資料「化物屋敷異変 スペルカード・弾幕案」をもとに作りかえた
  //   弾の見た目：虫の形の小粒弾（群れで動く）、尻尾の形の曲がるレーザー（弾をつないだ尻尾）、灯りの光弾
  //   壁や天井を這い回る動きと、自機に寄ってくる虫の群れが特徴
  //   流れ：通常1 → スペル1 → 通常2 → スペル2 → 通常3 → スペル3（Hard/Lunatic：→ スペル4）
  {
    // 通常1：画面の左右の端（壁）に張り付いて移動しながら、横向きに虫弾の列を撃つ
    type: 'non', hp: 1000, time: 30,
    *script(b) {
      for (let loop = 0; ; loop++) {
        const side = loop % 2 ? 1 : -1;
        const wx = side < 0 ? 26 : FIELD_W - 26;
        yield* b.moveTo(wx, rand(60, 110), 50);
        for (let k = 0; k < dv(5, 6, 7, 8); k++) {
          b.move(wx, clamp(b.y + rand(-50, 70), 50, 230), 30);
          const a = (side < 0 ? 0 : Math.PI) + rand(-0.12, 0.12);
          for (let i = 0; i < dv(4, 5, 6, 7); i++) {
            fire({ x: b.x, y: b.y, angle: a, speed: 1.4 + i * 0.32, type: 'bug', color: 'yellow', silent: i > 0 });
          }
          if (DIFF >= 2) fire({ x: b.x, y: b.y, angle: b.aim(), speed: 2.2, type: 'small', color: 'orange', silent: true });
          yield dv(34, 30, 24, 20);
        }
      }
    },
  },
  {
    // ボスが画面の端を一周するように這い回り、通った壁から内側へ向けて弾が伸びてくる。一周ごとに伸びる弾の列が増える。
    // ボスと反対側の端は安全になりやすい。Hard/Lunatic では二周目から逆回りも混ざる
    type: 'spell', name: '守符「家守の夜回り」', hp: 1300, time: 45,
    *script(b) {
      const m = 24, W = FIELD_W - m * 2, H = FIELD_H - m * 2;
      const per = (W + H) * 2;
      const at = d => {
        d = ((d % per) + per) % per;
        if (d < W) return [m + d, m, Math.PI / 2];
        d -= W;
        if (d < H) return [FIELD_W - m, m + d, Math.PI];
        d -= H;
        if (d < W) return [FIELD_W - m - d, FIELD_H - m, -Math.PI / 2];
        d -= W;
        return [m, FIELD_H - m - d, 0];
      };
      yield* b.moveTo(m, m, 50);
      let d = 0;
      const speed = dv(3.0, 3.4, 3.8, 4.2);
      for (let f = 0; ; f++) {
        const lap = Math.floor(f * speed / per);
        const dir = DIFF >= 2 && lap % 2 === 1 ? -1 : 1;
        d += speed * dir;
        const [x, y, inward] = at(d);
        b.x = x; b.y = y;
        if (f % dv(12, 10, 8, 7) === 0) {
          const rows = Math.min(1 + lap, dv(3, 3, 4, 5));
          for (let i = 0; i < rows; i++) {
            fire({ x, y, angle: inward + rand(-0.05, 0.05), speed: 0.9 + i * 0.35, type: 'bug', color: i % 2 ? 'green' : 'yellow', silent: true });
          }
          if (f % 40 === 0) Sound.se('tan');
        }
        yield;
      }
    },
  },
  {
    // 通常2：画面の上端（天井）を這いながら、真下に虫弾を雨のように落とす
    type: 'non', hp: 1000, time: 30,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 28, 40);
      for (let f = 0; ; f++) {
        if (f % 120 === 0) b.move(rand(50, FIELD_W - 50), 28, 110);
        if (f % dv(8, 6, 5, 4) === 0) {
          fire({ x: b.x + rand(-30, 30), y: b.y + 6, angle: Math.PI / 2 + rand(-0.25, 0.25), speed: rand(1.3, 2.2), type: 'bug', color: 'orange', silent: true });
        }
        if (f % dv(70, 60, 48, 40) === 0) fireFan({ x: b.x, y: b.y, n: dv(3, 3, 5, 5), spread: 0.5, angle: b.aim(), speed: 2.4, type: 'small', color: 'yellow' });
        yield;
      }
    },
  },
  {
    // 天井から虫の群れの弾がばらばらと湧いて降ってくる。群れは途中でばらけて、ゆっくり自機の方へ寄ってくる。
    // 寄ってくる性質を利用して、大きく動いて群れをまとめてから切り返す（誘導して避ける）
    type: 'spell', name: '虫符「湧き放題の天井裏」', hp: 1200, time: 40,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 60, 40);
      const home = dv(1.0, 1.2, 1.5, 1.8);
      for (let f = 0; ; f++) {
        if (f % dv(44, 36, 28, 22) === 0) {
          const cx = rand(30, FIELD_W - 30), n = dv(5, 6, 7, 8);
          for (let i = 0; i < n; i++) {
            fire({
              x: cx + rand(-12, 12), y: -6 + rand(-8, 8), angle: Math.PI / 2, speed: 1.5, type: 'bug', color: 'green', silent: true,
              script: function* (bl) {
                yield randInt(50, 80);
                // 途中でばらける
                bl.angle = rand(TAU); bl.speed = 1.0; bl.accel = -0.02; bl.minSpeed = 0.2;
                yield 40;
                // ゆっくり自機の方へ寄ってくる
                bl.angle = aimAt(bl.x, bl.y); bl.accel = 0.02; bl.maxSpeed = home;
              },
            });
          }
          Sound.se('tan');
        }
        if (f % 120 === 90) b.wander(60, 60);
        yield;
      }
    },
  },
  {
    // 通常3：中央に戻り、虫弾の群れを放射状に撃つ。群れは少し遅れて自機の方へ寄ってくる
    type: 'non', hp: 1100, time: 30,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 100, 40);
      for (let loop = 0; ; loop++) {
        const k = dv(5, 6, 7, 8), off = rand(TAU);
        for (let j = 0; j < k; j++) {
          const a = off + (j * TAU) / k;
          for (let i = 0; i < 3; i++) {
            fire({
              x: b.x, y: b.y, angle: a + rand(-0.12, 0.12), speed: 2.2 + i * 0.2, accel: -0.04, minSpeed: 0.3, type: 'bug', color: 'yellow', silent: true,
              script: function* (bl) { yield 70; bl.angle = aimAt(bl.x, bl.y) + rand(-0.15, 0.15); bl.accel = 0.025; bl.maxSpeed = dv(1.1, 1.3, 1.6, 1.9); },
            });
          }
        }
        Sound.se('tan');
        yield dv(100, 90, 76, 64);
      }
    },
  },
  {
    // ボスの尻尾が、曲がるレーザー（弾をつないだ尻尾）で画面をなぎ払う。ボスに一定のダメージを与えると尻尾が「切れて」独立し、
    // 画面を跳ね回りながら撃ってくる。ボスは新しい尻尾を生やして同じ攻撃を続ける。切れた尻尾は一定時間で消える。
    // 撃ちこみすぎると尻尾が増えるので、攻撃の手加減が攻略になる。Hard/Lunatic は切れた尻尾が残る時間が長い
    type: 'spell', name: '尾符「トカゲの尻尾切り」', hp: 1400, time: 45,
    *script(b, g) {
      yield* b.moveTo(FIELD_W / 2, 80, 40);
      const SEG = 16, gap = 13;
      const makeTail = () => {
        const segs = [];
        for (let i = 0; i < SEG; i++) segs.push(fire({ x: b.x, y: b.y, speed: 0, type: i === SEG - 1 ? 'ball' : 'small', color: 'green', silent: true, delay: 20 }));
        return segs;
      };
      let tail = makeTail();
      let lastHp = b.hp;
      const cutAt = b.maxHp * 0.18;
      for (let f = 0; ; f++) {
        // 尻尾のつけ根から、しなるように振る
        const sw = Math.sin(f * dv(0.018, 0.022, 0.026, 0.03));
        let a = Math.PI / 2, x = b.x, y = b.y + 10;
        tail.forEach((bl, i) => {
          a = Math.PI / 2 + sw * 1.25 * (0.3 + (i / SEG) * 0.9) + Math.sin(f * 0.05 - i * 0.35) * 0.08 * i / SEG;
          x += Math.cos(a) * gap; y += Math.sin(a) * gap;
          if (bl.alive) { bl.x = x; bl.y = y; }
        });
        // 切れる：一定のダメージを受けたら、尻尾が独立して跳ね回る
        if (lastHp - b.hp >= cutAt) {
          lastHp = b.hp;
          const segs = tail.filter(bl => bl.alive);
          g.tasks.add(cutTail(segs, dv(300, 360, 480, 560)));
          Sound.se('kira');
          tail = makeTail();
        }
        if (f % dv(70, 56, 46, 38) === 0) fireFan({ x: b.x, y: b.y, n: dv(3, 3, 5, 5), spread: 0.35, angle: b.aim(), speed: 2.4, type: 'bug', color: 'yellow' });
        yield;
      }
    },
  },
  {
    // 画面の中央に「灯り」の光弾が置かれ、虫弾が四方から灯りに向かって集まってくる。集まりきると灯りが弾けて、虫弾が一斉に飛び散る。
    // 灯りから離れた位置で虫の流れを見て、弾ける直前に、虫が通り過ぎたあとの灯りの近くへ入る
    type: 'spell', name: '灯符「軒下の誘蛾灯」', hp: 1400, time: 45, minDiff: 2,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 60, 40);
      const lx = FIELD_W / 2, ly = 210;
      for (let loop = 0; ; loop++) {
        const light = fire({ x: lx, y: ly, speed: 0, type: 'large', color: 'yellow', delay: 30 });
        const moths = [];
        for (let f = 0; f < 150; f++) {
          if (f < 110 && f % dv(6, 5, 4, 3) === 0) {
            const side = randInt(0, 3);
            const [sx, sy] = [[rand(0, FIELD_W), -6], [FIELD_W + 6, rand(0, FIELD_H)], [rand(0, FIELD_W), FIELD_H + 6], [-6, rand(0, FIELD_H)]][side];
            const d = dist(sx, sy, lx, ly);
            moths.push(fire({
              x: sx, y: sy, angle: angleTo(sx, sy, lx, ly), speed: d / 120, type: 'bug', color: 'orange', silent: true,
              script: function* (bl) { while (dist(bl.x, bl.y, lx, ly) > rand(18, 40)) yield; bl.speed = 0; },
            }));
          }
          yield;
        }
        // 弾ける
        light.alive = false;
        Fx.explosion(lx, ly, 'rgba(255,230,120,0.8)', 1.4);
        Sound.se('kira');
        for (const bl of moths) {
          if (!bl.alive) continue;
          bl.script = null;
          bl.angle = angleTo(lx, ly, bl.x, bl.y) + rand(-0.3, 0.3);
          bl.speed = 0.5; bl.accel = 0.04; bl.maxSpeed = dv(1.6, 1.9, 2.2, 2.6);
        }
        fireRing({ x: lx, y: ly, n: dv(12, 16, 20, 24), angle: rand(TAU), speed: 1.6, type: 'small', color: 'yellow', silent: true });
        yield 70;
      }
    },
  },
];

// 切れた尻尾：つないだ弾が、頭を先にして画面を跳ね回りながら撃ってくる。life フレームで消える
function* cutTail(segs, life) {
  if (!segs.length) return;
  let hx = segs[segs.length - 1].x, hy = segs[segs.length - 1].y;
  let a = rand(TAU), sp = 2.4;
  const trail = segs.map(bl => [bl.x, bl.y]).reverse();
  for (let f = 0; f < life; f++) {
    hx += Math.cos(a) * sp; hy += Math.sin(a) * sp;
    if (hx < 10 || hx > FIELD_W - 10) { a = Math.PI - a; hx = clamp(hx, 10, FIELD_W - 10); }
    if (hy < 10 || hy > FIELD_H - 60) { a = -a; hy = clamp(hy, 10, FIELD_H - 60); }
    a += Math.sin(f * 0.07) * 0.03;
    trail.unshift([hx, hy]);
    trail.length = Math.min(trail.length, segs.length * 5);
    segs.forEach((bl, i) => {
      const p = trail[Math.min(trail.length - 1, i * 5)];
      if (bl.alive) { bl.x = p[0]; bl.y = p[1]; }
    });
    if (f % 50 === 25 && segs.some(bl => bl.alive)) fire({ x: hx, y: hy, angle: aimAt(hx, hy), speed: 1.8, type: 'small', color: 'green', silent: true });
    if (!segs.some(bl => bl.alive)) return;
    yield;
  }
  for (const bl of segs) if (bl.alive) { bl.alive = false; Fx.cancel(bl.x, bl.y, bl.color); }
}

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
    { id: 'ruri', phases: RURI_MID_PHASES, mid: true, def: { spellBg: 'ruri', circleColor: '90,140,255' } },
    { id: 'kuraishiro', phases: KURAISHIRO_PHASES, bgm: 'boss2', def: { spellBg: 'yamori', circleColor: '110,200,255' } },
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

    // 中ボス：瑠璃（名前は出さない）
    const mid = g.spawnStageBoss('ruri', { x: -40, y: 60 });
    yield* mid.moveTo(FIELD_W / 2, 100, 60);
    yield* g.fight(mid, RURI_MID_PHASES);
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
    const boss = g.spawnStageBoss('kuraishiro', { x: FIELD_W / 2, y: -50 });
    yield* boss.moveTo(FIELD_W / 2, 100, 60);
    yield* g.talk(STORY.stage2[g.charId].before);
    yield* g.fight(boss, KURAISHIRO_PHASES);
    yield* g.bossDown(boss);
    yield* g.talk(STORY.stage2[g.charId].after);
  },
});
