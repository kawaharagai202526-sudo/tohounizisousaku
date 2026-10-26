'use strict';
// ============================================================
//  4面：借りものの間 ― 中ボス：？？？（赤いパーカーの子。名前は未定）／ボス：栂尾 芯
//  人里の家から借りてきた部屋を次々に突き抜けて進む（背景 RoomsBG）
//  道中は紺珠伝（狙いを定めた弾・レーザー）と妖々夢（弱い妖精の大群）を参考にしている
// ============================================================

// ------------------------------------------------------------
//  中ボス：？？？（ぶかぶかの赤いパーカーの子。2.1.0 では3面の中ボスだった。名前は出さない）
// ------------------------------------------------------------
const MIDBOSS4_PHASES = [
  {
    // ぶかぶかの袖：左右の袖口から、振り子のように弾がこぼれ出す。ときどき自機を狙う
    type: 'non', hp: 1000, time: 25,
    *script(b) {
      yield 30;
      for (let f = 0; ; f++) {
        if (f % dv(6, 5, 4, 3) === 0) {
          const sway = Math.sin(f * 0.03) * 0.8;
          for (const side of [-1, 1]) {
            fire({ x: b.x + side * 16, y: b.y + 8, angle: Math.PI / 2 + side * (0.45 + sway), speed: dv(1.8, 2.1, 2.4, 2.7), type: 'rice', color: side < 0 ? 'red' : 'pink', silent: true });
          }
        }
        if (f % 20 === 0) Sound.se('tan');
        if (f % dv(90, 75, 60, 50) === 40) fireFan({ x: b.x, y: b.y, n: dv(3, 5, 5, 7), spread: 0.45, angle: b.aim(), speed: 2.6, type: 'ball', color: 'green' });
        if (f % 240 === 200) b.wander(60, 50);
        yield;
      }
    },
  },
  {
    // 市松模様（チェックの柄）の弾が上から降りてくる。ひとマスおきのすき間を抜ける
    type: 'spell', name: '間符「市松の間取り」', hp: 1100, time: 32,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 80, 40);
      const cell = dv(48, 42, 38, 34), speed = dv(1.1, 1.3, 1.5, 1.6);
      const cols = Math.ceil(FIELD_W / cell);
      for (let row = 0; ; row++) {
        // Hard 以上は2段ごとに斜めに流れる
        const drift = DIFF >= 2 ? (row % 4 < 2 ? 0.22 : -0.22) : 0;
        for (let i = 0; i < cols; i++) {
          if ((i + row) % 2) continue;
          fire({ x: (i + 0.5) * cell, y: -6, angle: Math.PI / 2 + drift, speed, type: 'ball', color: row % 2 ? 'red' : 'white', silent: true });
        }
        if (row % 3 === 2) fireRing({ x: b.x, y: b.y, n: dv(8, 12, 16, 20), angle: b.aim(), speed: 1.9, type: 'rice', color: 'green' });
        else Sound.se('tan');
        // 1マス分進んだら次の段（市松になる）
        yield Math.round(cell / (speed * bulletSpeedK()));
      }
    },
  },
];

// ------------------------------------------------------------
//  ボス：栂尾 芯（屋敷を支える柱のような子。大きな掛矢を持つ）
//  柱（縦のレーザー）・梁（横のレーザー）・年輪・掛矢の一撃
// ------------------------------------------------------------
const TOGANOO_PHASES = [
  // 2.8.0 で資料「化物屋敷異変 スペルカード・弾幕案」をもとに作りかえた
  //   弾の見た目：柱や梁の形の太いレーザー、木組みの格子、部屋の形の囲い弾、上棟式の餅（白い大玉）
  //   家を「建てる」弾幕。画面が柱や壁で区切られ、決められた通り道を進ませる
  //   流れ：通常1 → スペル1 → 通常2 → スペル2 → 通常3 → スペル3（Hard/Lunatic：→ スペル4）→ 通常4 → 最後のスペル
  {
    // 通常1：梁のレーザーを横に渡し、その間に小弾を流す
    type: 'non', hp: 1100, time: 30,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 70, 40);
      for (let loop = 0; ; loop++) {
        const py = clamp(G.player.y, 200, FIELD_H - 40);
        const ys = [py - dv(80, 74, 66, 60), py + dv(80, 74, 66, 60)].filter(y => y > 120 && y < FIELD_H - 8);
        for (const y of ys) fireLaser({ x: -10, y, angle: 0, length: FIELD_W + 20, width: 18, warn: 50, dur: 100, color: 'orange' });
        yield 50;
        for (let f = 0; f < 100; f++) {
          if (f % dv(12, 10, 8, 7) === 0) {
            const side = f % 2 ? 1 : -1;
            const y = py + rand(-50, 50);
            fire({ x: side < 0 ? -6 : FIELD_W + 6, y, angle: side < 0 ? 0 : Math.PI, speed: dv(1.4, 1.6, 1.9, 2.2), type: 'small', color: 'yellow', silent: true });
          }
          if (f % 40 === 20) fireFan({ x: b.x, y: b.y, n: dv(3, 3, 5, 5), spread: 0.4, angle: b.aim(), speed: 2.2, type: 'rice', color: 'orange' });
          yield;
        }
        yield 40;
      }
    },
  },
  {
    // ボスを中心に、柱（縦のレーザー）と梁（横のレーザー）が組み上がり、画面が格子に区切られる。格子の中を、小弾が跳ね返りながら飛び交う。
    // 格子が組み上がる前に出る予告線を見て、広いマスに入る。Hard/Lunatic は格子が細かく、途中で組み替えが入る
    type: 'spell', name: '柱符「大黒柱の屋台骨」', hp: 1500, time: 45,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 60, 40);
      for (let loop = 0; ; loop++) {
        const cw = dv(128, 112, 96, 88), ch = dv(130, 116, 104, 96);
        const ox = rand(0, cw), oy = 90 + rand(0, ch);
        const xs = [], ys = [];
        for (let x = ox; x < FIELD_W; x += cw) xs.push(x);
        for (let y = oy; y < FIELD_H; y += ch) ys.push(y);
        const hold = DIFF >= 2 ? 200 : 300;
        for (const x of xs) fireLaser({ x, y: -10, angle: Math.PI / 2, length: FIELD_H + 20, width: 12, warn: 70, dur: hold, color: 'brown' });
        for (const y of ys) fireLaser({ x: -10, y, angle: 0, length: FIELD_W + 20, width: 12, warn: 70, dur: hold, color: 'brown' });
        yield 76;
        // 格子の中を跳ね返る小弾
        const cellOf = v => {
          const bx = [0, ...xs, FIELD_W], by = [0, ...ys, FIELD_H];
          let x0 = 0, x1 = FIELD_W, y0 = 0, y1 = FIELD_H;
          for (let i = 0; i < bx.length - 1; i++) if (v[0] >= bx[i] && v[0] < bx[i + 1]) { x0 = bx[i]; x1 = bx[i + 1]; }
          for (let i = 0; i < by.length - 1; i++) if (v[1] >= by[i] && v[1] < by[i + 1]) { y0 = by[i]; y1 = by[i + 1]; }
          return [x0 + 6, x1 - 6, y0 + 6, y1 - 6];
        };
        for (let f = 0; f < hold - 10; f++) {
          if (f % dv(30, 24, 18, 14) === 0) {
            const x = rand(10, FIELD_W - 10), y = rand(100, FIELD_H - 20);
            if (dist(x, y, G.player.x, G.player.y) > 70) {
              const [x0, x1, y0, y1] = cellOf([x, y]);
              fire({
                x, y, angle: rand(TAU), speed: dv(1.2, 1.4, 1.7, 1.9), type: 'ball', color: 'yellow', delay: 20, silent: true, life: hold - f,
                script: function* (bl) {
                  for (;;) {
                    if (bl.x < x0 || bl.x > x1) { bl.angle = Math.PI - bl.angle; bl.x = clamp(bl.x, x0, x1); }
                    if (bl.y < y0 || bl.y > y1) { bl.angle = -bl.angle; bl.y = clamp(bl.y, y0, y1); }
                    yield;
                  }
                },
              });
            }
          }
          if (f % 50 === 0) fireFan({ x: b.x, y: b.y, n: 3, spread: 0.5, angle: b.aim(), speed: 2, type: 'rice', color: 'orange' });
          // Hard/Lunatic：途中で組み替え（予告線から始め直す）
          if (DIFF >= 2 && f === Math.floor(hold / 2)) break;
          yield;
        }
        // 残っている柱と梁を消してから、次の格子を組む
        for (const l of G.lasers) if (l.frame < l.warn + l.dur) l.dur = Math.max(1, l.frame - l.warn);
        yield 30;
      }
    },
  },
  {
    // 通常2：柱を中心に、木組みの格子状に弾を広げる
    type: 'non', hp: 1100, time: 30,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 110, 40);
      for (let loop = 0; ; loop++) {
        const rot = (loop % 2) * (Math.PI / 4) + rand(-0.1, 0.1);
        const k = dv(2, 3, 3, 4);
        for (let d = 0; d < 4; d++) {
          const a = rot + (d * Math.PI) / 2;
          for (let j = -k; j <= k; j++) {
            fire({ x: b.x + Math.cos(a + Math.PI / 2) * j * 18, y: b.y + Math.sin(a + Math.PI / 2) * j * 18, angle: a, speed: dv(1.3, 1.5, 1.7, 1.9), type: 'rice', color: d % 2 ? 'brown' : 'orange', silent: true });
          }
        }
        Sound.se('tan');
        yield dv(40, 34, 28, 24);
        if (loop % 4 === 3) b.wander(50, 50);
      }
    },
  },
  {
    // 画面の上から下へ、弾でできた壁が何枚も迫ってくる。壁にはそれぞれ一か所だけ「玄関」（通り抜けられる隙間）がある。
    // 玄関以外の場所を撃って壁を抜こうとすると、壁から弾が撃ち返される。Hard/Lunatic は壁が速く玄関が狭い。Lunatic は玄関の位置が途中で一度ずれる
    type: 'spell', name: '戸符「玄関から入れ」', hp: 1500, time: 45,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 40, 40);
      const walls = [];
      let lastGap = FIELD_W / 2;
      for (let f = 0; ; f++) {
        if (f % dv(140, 120, 100, 90) === 0) {
          const gw = dv(74, 66, 58, 52);
          const gx = clamp(lastGap + rand(-130, 130), gw / 2 + 8, FIELD_W - gw / 2 - 8);
          lastGap = gx;
          const w = { y: 10, gx, gw, bullets: [], shifted: false, cd: 0 };
          for (let x = 7; x < FIELD_W; x += 14) {
            if (Math.abs(x - gx) < gw / 2) continue;
            w.bullets.push(fire({ x, y: w.y, speed: 0, type: 'card', angle: 0, color: 'brown', silent: true, delay: 16, data: x, noRotate: true }));
          }
          walls.push(w);
          Sound.se('kira');
        }
        for (const w of walls) {
          w.y += dv(0.9, 1.0, 1.2, 1.35);
          // Lunatic：玄関の位置が途中で一度ずれる
          let shift = 0;
          if (DIFF >= 3 && w.y > 150 && !w.shifted) { w.shifted = true; w.target = clamp(w.gx + randSign() * 70, w.gw / 2 + 8, FIELD_W - w.gw / 2 - 8); }
          if (w.target !== undefined && Math.abs(w.target - w.gx) > 0.5) shift = Math.sign(w.target - w.gx) * 1.2;
          w.gx += shift;
          for (const bl of w.bullets) {
            if (!bl.alive) continue;
            bl.y = w.y;
            if (shift) bl.x += shift; // 壁ごと少し動いて玄関をずらす
          }
          // 玄関以外を撃っていると、壁から撃ち返される
          if (w.cd > 0) w.cd--;
          const p = G.player;
          if (w.y < p.y - 20 && Input.down('shot') && Math.abs(p.x - w.gx) > w.gw / 2 && w.cd === 0 && w.bullets.some(bl => bl.alive)) {
            w.cd = dv(18, 14, 10, 8);
            fire({ x: p.x, y: w.y + 6, angle: Math.PI / 2 + rand(-0.15, 0.15), speed: 2.6, type: 'small', color: 'red', silent: true });
          }
        }
        for (let i = walls.length - 1; i >= 0; i--) if (walls[i].y > FIELD_H + 20) { for (const bl of walls[i].bullets) bl.alive = false; walls.splice(i, 1); }
        yield;
      }
    },
  },
  {
    // 通常3：部屋の形の囲い弾をいくつか置き、囲いの中から弾を撃つ
    type: 'non', hp: 1200, time: 30,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 70, 40);
      for (let loop = 0; ; loop++) {
        const rooms = [];
        for (let i = 0; i < dv(2, 2, 3, 3); i++) {
          const cx = rand(60, FIELD_W - 60), cy = rand(130, 260);
          rooms.push([cx, cy]);
          roomOutline(cx, cy, 70, 52, 'brown', 200);
        }
        yield 30;
        for (let k = 0; k < 4; k++) {
          for (const [cx, cy] of rooms) fireFan({ x: cx, y: cy, n: dv(3, 3, 5, 5), spread: 0.6, angle: aimAt(cx, cy), speed: dv(1.6, 1.8, 2.1, 2.3), type: 'small', color: 'yellow', silent: true });
          Sound.se('tan');
          yield dv(36, 30, 26, 22);
        }
        yield 30;
      }
    },
  },
  {
    // 部屋の形をした弾の囲いが、ボスのまわりから次々に「建て増し」されて画面を埋めていく。画面がいっぱいになりかけると、古い部屋から順に崩れて小弾になる。
    // 建て増しの順番は決まっている。最後に建つ場所（いちばん遅く埋まる場所）で待つ。Hard/Lunatic は建て増しが速く、崩れたときの小弾が増える
    type: 'spell', name: '建符「百間継ぎの建て増し」', hp: 1600, time: 50,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 50, 40);
      const cols = 4, rows = 5, cw = FIELD_W / cols, ch = 84;
      // ボスに近い部屋から、外へ外へと建て増す（決まった順番）
      const slots = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) slots.push([c, r]);
      slots.sort((p, q) => (Math.abs(p[0] - 1.5) + p[1] * 1.3) - (Math.abs(q[0] - 1.5) + q[1] * 1.3));
      const keep = dv(11, 12, 13, 14);
      const built = [];
      for (let i = 0; ; i++) {
        const [c, r] = slots[i % slots.length];
        const cx = (c + 0.5) * cw, cy = 40 + (r + 0.5) * ch;
        built.push({ cx, cy, bullets: roomOutline(cx, cy, cw - 10, ch - 10, i % 2 ? 'brown' : 'orange', 0) });
        Sound.se('kira');
        if (built.length > keep) {
          // いちばん古い部屋が崩れて小弾になる
          const old = built.shift();
          for (const bl of old.bullets) {
            if (!bl.alive) continue;
            bl.angle = angleTo(old.cx, old.cy, bl.x, bl.y) + rand(-0.4, 0.4);
            bl.speed = 0.4; bl.accel = 0.03; bl.maxSpeed = dv(1.3, 1.5, 1.8, 2.1);
            bl.setType('small');
          }
          if (DIFF >= 2) fireRing({ x: old.cx, y: old.cy, n: 8, angle: rand(TAU), speed: 1.4, type: 'small', color: 'yellow', silent: true });
        }
        yield dv(44, 38, 30, 26);
      }
    },
  },
  {
    // 上棟式の餅撒きのように、白い大玉の餅弾が山なりの軌道で四方にばら撒かれる。餅は落ちると小さく割れて広がる。
    // 山なりなので、落ちる位置を見て入れ替わるように避ける。餅弾を撃ち落とすと得点アイテムが出る（資料では家運システムの福アイテム）
    type: 'spell', name: '棟符「棟上げの餅撒き」', hp: 1500, time: 45, minDiff: 2,
    *script(b) {
      yield* b.moveTo(FIELD_W / 2, 80, 40);
      for (let loop = 0; ; loop++) {
        for (let i = 0; i < dv(4, 5, 6, 7); i++) {
          const vx = rand(-2.6, 2.6), floor = rand(240, FIELD_H - 20);
          let vy = rand(-4.2, -2.6);
          spawnEnemy({
            x: b.x, y: b.y, kind: 'mochi', color: i % 3 ? 'white' : 'pink', hp: 8, r: 12, score: 3000, drops: { point: 3 },
            script: function* (e) {
              for (;;) {
                e.x += vx; e.y += vy; vy += 0.06;
                if (e.x < 10 || e.x > FIELD_W - 10) { e.x = clamp(e.x, 10, FIELD_W - 10); }
                if (vy > 0 && e.y >= floor) break;
                yield;
              }
              // 落ちて割れる
              fireRing({ x: e.x, y: e.y, n: dv(5, 6, 8, 9), angle: rand(TAU), speed: 1.5, type: 'small', color: 'white', silent: true });
              Sound.se('tan');
              e.alive = false;
            },
          });
        }
        yield dv(70, 60, 50, 44);
        if (loop % 2) b.wander(60, 60);
      }
    },
  },
  {
    // 通常4：軋ませながら、四方へ太い梁のレーザーを順に振る
    type: 'non', hp: 1200, time: 30,
    *script(b, g) {
      yield* b.moveTo(FIELD_W / 2, 120, 40);
      for (let loop = 0; ; loop++) {
        const base = rand(TAU);
        for (let d = 0; d < 4; d++) {
          const a = base + (d * Math.PI) / 2;
          fireLaser({ x: b.x, y: b.y, angle: a - 0.5, length: 640, width: 22, warn: 44, dur: 60, angVel: dv(0.012, 0.014, 0.016, 0.018), angVelWarn: 0, color: 'orange' });
          g.shake = 10;
          Sound.se('kira');
          yield 26;
          fireRing({ x: b.x, y: b.y, n: dv(8, 10, 12, 14), angle: rand(TAU), speed: 1.5, type: 'rice', color: 'brown', silent: true });
        }
        yield dv(60, 50, 40, 34);
      }
    },
  },
  {
    // 画面全体が軋み、頭上に梁の形の弾が並ぶ。ボスが力を緩めるたびに、梁が一斉に落ちてくる。体力が減るほど梁の数が増え、落ちる間隔が短くなる。
    // 梁は落ちる前に震える。震えている梁の真下から離れる。Hard/Lunatic は落ちた梁が床で跳ね、もう一度小弾を撒く
    type: 'spell', name: '家符「家を支える者の意地」', hp: 1900, time: 55,
    *script(b, g) {
      yield* b.moveTo(FIELD_W / 2, 60, 40);
      for (let loop = 0; ; loop++) {
        const lost = 1 - b.hp / b.maxHp;
        const n = Math.round(dv(2, 3, 3, 4) + lost * dv(2, 3, 4, 4));
        g.shake = 20;
        Sound.se('charge');
        const beams = [];
        for (let i = 0; i < n; i++) {
          const cx = rand(40, FIELD_W - 40), y = rand(26, 70);
          const parts = [];
          for (let k = -3; k <= 3; k++) parts.push(fire({ x: cx + k * 13, y, speed: 0, angle: 0, type: 'card', color: 'brown', silent: true, delay: 20, data: cx + k * 13, noRotate: true }));
          beams.push(parts);
        }
        // 落ちる前に震える
        for (let f = 0; f < 50; f++) {
          for (const parts of beams) for (const bl of parts) if (bl.alive) bl.x = bl.data + Math.sin(f * 1.3) * 2;
          yield;
        }
        for (const parts of beams) {
          for (const bl of parts) {
            if (!bl.alive) continue;
            bl.ay = 0.09; bl.maxFall = dv(3.0, 3.4, 3.8, 4.2); bl.speed = 0;
            if (DIFF >= 2) {
              bl.script = (function* (bl) {
                while (bl.y < FIELD_H - 10) yield;
                // 床で跳ねて小弾を撒く
                fire({ x: bl.x, y: FIELD_H - 12, angle: -Math.PI / 2 + rand(-0.7, 0.7), speed: rand(1.8, 2.6), ay: 0.04, maxFall: 2.2, type: 'small', color: 'orange', silent: true });
                bl.alive = false;
              })(bl);
            }
          }
        }
        Sound.se('tan');
        fireFan({ x: b.x, y: b.y, n: dv(3, 5, 5, 7), spread: 0.8, angle: b.aim(), speed: 2.2, type: 'rice', color: 'orange' });
        yield Math.max(30, dv(90, 80, 70, 60) - lost * 30);
      }
    },
  },
];

// 部屋の形の囲い弾（cx, cy を中心に w×h の四角。life フレームで消える。0 なら消えない）
function roomOutline(cx, cy, w, h, color, life) {
  const out = [], step = 13;
  const add = (x, y) => out.push(fire({ x, y, speed: 0, type: 'small', color, silent: true, delay: 20, life }));
  for (let x = cx - w / 2; x <= cx + w / 2 + 0.1; x += w / Math.round(w / step)) { add(x, cy - h / 2); add(x, cy + h / 2); }
  for (let y = cy - h / 2 + h / Math.round(h / step); y < cy + h / 2 - 0.1; y += h / Math.round(h / step)) { add(cx - w / 2, y); add(cx + w / 2, y); }
  return out;
}

// ------------------------------------------------------------
//  道中の敵（5面でも使う）
// ------------------------------------------------------------

// 妖々夢風：とても弱い妖精が大群で弧を描いて流れてくる
function* swarmStream(side, n, o = {}) {
  for (let i = 0; i < n; i++) {
    spawnEnemy({
      x: side < 0 ? -10 : FIELD_W + 10, y: o.y ?? 30, hp: 4, color: o.color || 'blue', score: 300,
      drops: i % 4 === 0 ? { power: 1 } : i % 4 === 2 ? { point: 1 } : {},
      script: function* (e) {
        e.setMove(3.2, side < 0 ? 0.35 : Math.PI - 0.35, 0, side < 0 ? 0.012 : -0.012);
        yield 36;
        if (DIFF >= 1 && (DIFF >= 2 || i % 3 === 0) && e.onScreen) {
          fireFan({ x: e.x, y: e.y, n: dv(1, 1, 1, 3), spread: 0.3, angle: e.aim(), speed: dv(1.8, 2.1, 2.5, 2.9), type: 'small', color: 'cyan' });
        }
        yield 40;
        e.angVel = 0;
      },
    });
    yield o.gap ?? 7;
  }
}

// 紺珠伝風：リング弾をいったん止めてから、自機へ向けて飛ばす妖精
function sniperFairy(x, stopY = 90) {
  return spawnEnemy({
    x, y: -16, hp: 36, color: 'purple', score: 3000, drops: { power: 2, point: 2 },
    script: function* (e) {
      yield* e.moveTo(x, stopY, 50);
      for (let v = 0; v < 2; v++) {
        const n = dv(8, 12, 16, 22), off = rand(TAU);
        for (let i = 0; i < n; i++) {
          fire({
            x: e.x, y: e.y, angle: off + (i * TAU) / n, speed: 2.6, accel: -0.07, minSpeed: 0, type: 'rice', color: 'purple', silent: i > 0,
            script: function* (bl) {
              yield 45;
              bl.angle = aimAt(bl.x, bl.y);
              bl.accel = 0.04;
              bl.maxSpeed = dv(1.6, 2, 2.4, 2.8);
              bl.setColor('pink');
            },
          });
        }
        yield 70;
      }
      e.setMove(0, -Math.PI / 2, 0.05);
    },
  });
}

// 壁ぎわの柱。背景と一緒に流れながら、年輪の目から自機を狙ってレーザーを撃つ
function wallPillar(side, wait = 0) {
  return spawnEnemy({
    x: side < 0 ? 22 : FIELD_W - 22, y: -24, kind: 'pillar', side: side < 0 ? 1 : -1, hp: 24, r: 14, noBody: true, score: 2500,
    drops: { point: 2 }, speed: 1.0, angle: Math.PI / 2,
    script: function* (e) {
      yield 70 + wait;
      for (let k = 0; k < dv(1, 1, 2, 2); k++) {
        fireLaser({ x: e.x, y: e.y, angle: e.aim(), width: 10, warn: 50, dur: 28, color: 'orange', follow: l => { if (e.alive) { l.x = e.x; l.y = e.y; } } });
        yield 110;
      }
    },
  });
}

// 破れたふすまの紙きれ：弾は撃たないが、ぶつかると被弾する。一撃で倒せる
function paperScrap(x, y, angle, speed, o = {}) {
  const ph = rand(TAU);
  return spawnEnemy({
    x, y, kind: 'paper', hp: 0.4, r: 10, score: 200, speed, angle,
    drops: rng.next() < 0.12 ? { point: 1 } : {},
    script: function* (e) {
      // ひらひらと進行方向を揺らしながら舞う
      for (;;) {
        e.angle = angle + Math.sin(e.frame * (o.freq ?? 0.1) + ph) * (o.amp ?? 0.7);
        yield;
      }
    },
  });
}

// 上から紙きれが舞い落ちてくる
function* paperRain(frames, count) {
  const interval = Math.max(1, Math.floor(frames / count));
  for (let i = 0; i < count; i++) {
    paperScrap(rand(16, FIELD_W - 16), -12, Math.PI / 2 + rand(-0.3, 0.3), rand(1.0, 1.6));
    yield interval;
  }
}

// 横から紙きれの群れが波打ちながら横切る
function* paperStream(side, n, y = 120) {
  for (let i = 0; i < n; i++) {
    paperScrap(side < 0 ? -12 : FIELD_W + 12, y + rand(-30, 30), side < 0 ? 0.2 : Math.PI - 0.2, 1.8, { amp: 0.5, freq: 0.08 });
    yield 8;
  }
}

// 横一列に並んだ妖精が真下へ弾を流し、弾の間が通り道になる
function fairyLine(n = 7, y = 60) {
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) * FIELD_W) / n;
    spawnEnemy({
      x, y: -16 - i * 6, hp: 18, color: 'blue', score: 1500, drops: i % 2 ? { point: 1 } : { power: 1 },
      script: function* (e) {
        yield* e.moveTo(x, y, 50);
        for (let f = 0; f < 200; f++) {
          if (f % dv(24, 18, 12, 9) === 0) fire({ x: e.x, y: e.y, angle: Math.PI / 2, speed: 2.2, type: 'kunai', color: 'cyan' });
          if (DIFF >= 2 && f % 60 === 30 && i % 2 === 0) fire({ x: e.x, y: e.y, angle: e.aim(), speed: 2.4, type: 'ball', color: 'blue' });
          yield;
        }
        e.setMove(0, -Math.PI / 2, 0.05);
      },
    });
  }
}

// 大玉を撃ち、しばらくすると大玉が小玉のリングに割れる大妖精
function splitterFairy(x) {
  return spawnEnemy({
    x, y: -24, kind: 'bigfairy', color: 'blue', hp: 260, r: 18, score: 20000, drops: { power: 4, point: 4 },
    script: function* (e) {
      yield* e.moveTo(x, 110, 60);
      for (let k = 0; k < 5; k++) {
        const n = dv(2, 3, 4, 5);
        for (let i = 0; i < n; i++) {
          fire({
            x: e.x, y: e.y, angle: e.aim() + (i - (n - 1) / 2) * 0.45, speed: 2.2, accel: -0.03, minSpeed: 0.6, type: 'large', color: 'blue',
            script: function* (bl) {
              yield 50;
              fireRing({ x: bl.x, y: bl.y, n: dv(6, 8, 10, 12), angle: rand(TAU), speed: 1.4, type: 'small', color: 'cyan', silent: true });
              bl.alive = false;
            },
          });
        }
        yield 70;
      }
      e.setMove(0, -Math.PI / 2, 0.04);
    },
  });
}


STAGES.push({
  name: '借りものの間',
  nameEn: 'A Mansion of Borrowed Rooms',
  bg: RoomsBG,
  bgm: 'stage4',
  zako: 'handEye', // 道中の妖精と緑の手は「一つ目の手」の絵にする
  // この面のボス（管理者ページの一覧・ボスの攻撃を試す機能・テストが使う。ボスを増やしたらここにも書く）
  //   id: CHARA_INFO のID  phases: 攻撃の配列  mid: 中ボスなら true（名前を出さない）  bgm: ボス戦の曲  def: 見た目（スペルカードの背景・魔法陣の色など）
  bosses: [
    { id: 'midboss4', phases: MIDBOSS4_PHASES, mid: true, def: { spellBg: 'ichimatsu', circleColor: '230,110,150' } },
    { id: 'toganoo', phases: TOGANOO_PHASES, bgm: 'boss4', def: { spellBg: 'hashira', circleColor: '255,190,110' } },
  ],
  // 4面からは全難易度で前の面より難しい（弾速・全方位弾の数・ボスの体力）
  speedScale: 1.08,
  densityScale: 1.2,
  hpScale: 1.1,
  *script(g) {
    yield 160;
    // 前半：大群 → 狙撃 → 柱のレーザー
    g.tasks.add(swarmStream(-1, 18));
    yield 50;
    g.tasks.add(swarmStream(1, 18));
    yield 120;
    g.tasks.add(paperRain(300, dv(30, 42, 56, 70)));
    yield 200;
    [96, 288].forEach(x => sniperFairy(x, 90));
    yield 150;
    sniperFairy(192, 70);
    yield 60;
    [100, 284].forEach(x => handEnemy(x, { stopY: 130 }));
    yield 60;
    for (let i = 0; i < 4; i++) { wallPillar(i % 2 ? 1 : -1, i * 10); yield 50; }
    yield 100;
    g.tasks.add(swarmStream(-1, 14, { y: 80, color: 'green' }));
    g.tasks.add(swarmStream(1, 14, { y: 80, color: 'green' }));
    yield 120;
    g.tasks.add(paperStream(-1, dv(10, 14, 18, 22), 200));
    yield 120;
    fairyLine(7, 60);
    yield 320;
    yield* waitClear(300);

    // 中ボス：？？？（赤いパーカーの子。名前は出さない）
    const mid = g.spawnStageBoss('midboss4', { x: FIELD_W / 2, y: -50 });
    yield* mid.moveTo(FIELD_W / 2, 100, 60);
    yield* g.fight(mid, MIDBOSS4_PHASES);
    if (mid.hp <= 0) dropItems(mid.x, mid.y, { power: 6, point: 8, bomb: 1 });
    yield* g.bossDown(mid, true);
    yield 60;

    // 後半：大玉の大妖精 → 降ってくる紙片と柱 → 紙きれの大群 → 大群
    splitterFairy(110);
    yield 40;
    splitterFairy(274);
    yield 200;
    g.tasks.add(tileShower(420, dv(20, 30, 44, 60), ['white', 'orange', 'yellow'], false));
    for (let i = 0; i < 6; i++) { wallPillar(i % 2 ? 1 : -1); yield 45; }
    yield* waitClear(500);
    g.tasks.add(paperRain(480, dv(50, 74, 98, 124)));
    g.tasks.add(paperStream(-1, dv(12, 16, 20, 24), 150));
    yield 160;
    g.tasks.add(paperStream(1, dv(12, 16, 20, 24), 230));
    yield 280;
    for (let w = 0; w < 3; w++) {
      g.tasks.add(swarmStream(-1, 12, { y: 30 + w * 30, color: w % 2 ? 'red' : 'blue' }));
      g.tasks.add(swarmStream(1, 12, { y: 30 + w * 30, color: w % 2 ? 'red' : 'blue' }));
      yield 110;
    }
    [80, 304].forEach(x => sniperFairy(x, 100));
    [150, 234].forEach(x => handEnemy(x, { stopY: 150 }));
    yield 160;
    fairyLine(6, 50);
    yield* waitClear(900);
    yield 120;
  },
  // ボス戦（キー「V」のときはここから始まる）
  *boss(g) {
    const boss = g.spawnStageBoss('toganoo', { x: FIELD_W / 2, y: -50 });
    yield* boss.moveTo(FIELD_W / 2, 100, 70);
    yield* g.talk(STORY.stage4[g.charId].before);
    yield* g.fight(boss, TOGANOO_PHASES);
    yield* g.bossDown(boss);
    yield* g.talk(STORY.stage4[g.charId].after);
  },
});
