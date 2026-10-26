'use strict';
// ============================================================
//  エキストラステージ：方位の果て ― 中ボス・ボス：金神（方位神）
//  2.8.0 で資料「化物屋敷異変 スペルカード・弾幕案」をもとに作った（名前・二つ名・会話・曲は Claude が考えた仮のもの）
//  前半：崩れた屋敷の瓦礫の上で中ボス（金神）→ 方位盤の異界へ（背景 CompassRealmBG の event('compass')）→ 道中 → 本戦
//  方違えのしくみ（凶方）：画面の左下の方位盤に、凶方（ふつうは金神のいる方角）が光る。
//    凶方へ向かって動くほど「祟り」がたまり、凶方の画面の端から祟りの弾が飛んでくる。凶方はスペルカードごとに移り変わる
//  弾の見た目：金色の札弾（card）、方位盤の光線（レーザー）、十二支の印の大玉（zodiac0〜11）、瓦礫の弾（rubble）、金色の針弾（needle）
// ============================================================

// ------------------------------------------------------------
//  方違えのしくみ（凶方）
// ------------------------------------------------------------

// 八方（北が画面の上、時計回り）。KYOU_DIRS[番号] = { name, x, y }（その方角への向き）
const KYOU_DIRS = [['北', 0, -1], ['北東', 1, -1], ['東', 1, 0], ['南東', 1, 1], ['南', 0, 1], ['南西', -1, 1], ['西', -1, 0], ['北西', -1, -1]]
  .map(([name, x, y]) => ({ name, x: x / Math.hypot(x, y), y: y / Math.hypot(x, y) }));
function dirAngle(i) { return -Math.PI / 2 + (i * Math.PI) / 4; }
// 画面の角度（右が0、下向きが正）→ 八方の番号
function dirIndexOf(a) { return ((Math.round((a + Math.PI / 2) / (Math.PI / 4)) % 8) + 8) % 8; }

// 凶方を決める。dir：八方の番号 / 'boss'（金神のいる方角）/ 'all'（四方塞がり。どこへ動いても凶）/ null（なし）
//   next：次の凶方（方位盤で予告する）  power：祟りの弾の多さ
function setKyou(g, dir, o = {}) {
  if (!g.kyou) g.kyou = { meter: 0, timer: 0, px: g.player.x, py: g.player.y, cur: null };
  Object.assign(g.kyou, { dir, next: o.next ?? null, power: o.power ?? 1 });
}
// 初めて凶方が出るときの説明（1回のプレイで1回だけ）
function kyouHelp(g) {
  if (g.kyouHelped) return;
  g.kyouHelped = true;
  g.msg('方違え', '#ffb070', '光る方角（凶方）へ向かうと祟りの弾が来る', 300);
}

// いまの凶方（八方の番号。'all' は -1、なしは null）
function kyouIndex(g) {
  const k = g.kyou;
  if (!k || k.dir === null) return null;
  if (k.dir === 'all') return -1;
  if (k.dir === 'boss') {
    const b = g.boss;
    return b && b.alive && b.y > -20 ? dirIndexOf(angleTo(g.player.x, g.player.y, b.x, b.y)) : null;
  }
  return k.dir;
}

// 毎フレーム（GameScene.update から）。凶方へ動くと祟りがたまり、たまるほど凶方から弾が来る
function updateKyou(g) {
  const k = g.kyou, p = g.player;
  const dx = p.x - k.px, dy = p.y - k.py;
  k.px = p.x; k.py = p.y;
  k.cur = kyouIndex(g);
  if (p.state !== 'normal' || g.dialogue || k.cur === null || p.bomb) { k.meter = Math.max(0, k.meter - 0.05); k.toward = false; return; }
  const v = Math.hypot(dx, dy);
  let toward = 0;
  if (v > 0.3) toward = k.cur === -1 ? 1 : (dx * KYOU_DIRS[k.cur].x + dy * KYOU_DIRS[k.cur].y) / v;
  k.toward = toward > 0.45;
  if (k.toward) k.meter = Math.min(1, k.meter + 0.012 * Math.min(1, v / 2.5));
  else k.meter = Math.max(0, k.meter - (toward < -0.45 ? 0.016 : 0.007));
  k.timer++;
  const interval = Math.round(lerp(40, 8, k.meter) / k.power);
  if (k.meter > 0.12 && k.timer >= interval) {
    k.timer = 0;
    kyouShot(g, k.cur === -1 ? randInt(0, 7) : k.cur);
  }
}

// 祟りの弾：凶方の画面の端から、自機をねらう
function kyouShot(g, i) {
  const [x, y] = edgeAt(dirAngle(i), rand(-130, 130), 8);
  if (dist(x, y, g.player.x, g.player.y) < 100) return;
  fire({ x, y, angle: aimAt(x, y) + rand(-0.1, 0.1), speed: 1.7 + g.kyou.meter * 1.2, type: 'rice', color: 'red', delay: 16, silent: true });
}

// 画面の中心から角度 a の方へ伸ばした線と、画面の端（inset だけ内側）が交わる点。along で端に沿ってずらす
function edgeAt(a, along = 0, inset = 8) {
  const cx = FIELD_W / 2, cy = FIELD_H / 2, dx = Math.cos(a), dy = Math.sin(a);
  const t = Math.min(Math.abs(dx) > 1e-6 ? (FIELD_W / 2 - inset) / Math.abs(dx) : 1e9, Math.abs(dy) > 1e-6 ? (FIELD_H / 2 - inset) / Math.abs(dy) : 1e9);
  return [clamp(cx + dx * t - dy * along, inset, FIELD_W - inset), clamp(cy + dy * t + dx * along, inset, FIELD_H - inset)];
}
// 画面の端（角度 a の方）から自機へ扇を撃つ。自機に近すぎるときは撃たない
function edgeFan(a, o) {
  const [x, y] = edgeAt(a, rand(-140, 140), 10);
  if (dist(x, y, G.player.x, G.player.y) < 110) return;
  fireFan({ x, y, angle: aimAt(x, y), delay: 18, silent: true, ...o });
}

// 凶方の画面の端を赤く光らせる（弾より下に描く）
function drawKyouEdge(ctx, g) {
  const k = g.kyou;
  if (!k || k.cur === null) return;
  const a = (0.16 + 0.34 * k.meter) * (0.8 + 0.2 * Math.sin(g.frame * 0.15));
  const col = al => `rgba(255,70,30,${al})`;
  const edge = i => {
    const d = KYOU_DIRS[i];
    ctx.save();
    if (d.x && d.y) {
      // 角（北東など）
      const x = d.x > 0 ? FIELD_W : 0, y = d.y > 0 ? FIELD_H : 0;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, 150);
      gr.addColorStop(0, col(a * 1.3)); gr.addColorStop(1, col(0));
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    } else {
      const w = 46;
      const x0 = d.x > 0 ? FIELD_W : d.x < 0 ? 0 : null, y0 = d.y > 0 ? FIELD_H : d.y < 0 ? 0 : null;
      const gr = x0 !== null ? ctx.createLinearGradient(x0, 0, x0 - d.x * w, 0) : ctx.createLinearGradient(0, y0, 0, y0 - d.y * w);
      gr.addColorStop(0, col(a)); gr.addColorStop(1, col(0));
      ctx.fillStyle = gr;
      if (x0 !== null) ctx.fillRect(d.x > 0 ? FIELD_W - w : 0, 0, w, FIELD_H);
      else ctx.fillRect(0, d.y > 0 ? FIELD_H - w : 0, FIELD_W, w);
    }
    ctx.restore();
  };
  if (k.cur === -1) [0, 2, 4, 6].forEach(edge);
  else edge(k.cur);
}

// 画面の左下の方位盤（凶方が赤く光り、次の凶方が金色に点滅する。まわりの弧は祟りのたまり具合）
function drawKyouDial(ctx, g) {
  const k = g.kyou;
  if (!k || (k.cur === null && k.next === null)) return;
  const cx = 30, cy = FIELD_H - 32, r = 21;
  const blink = 0.5 + 0.5 * Math.sin(g.frame * 0.2);
  ctx.save();
  ctx.globalAlpha = dist(g.player.x, g.player.y, cx, cy) < 70 ? 0.3 : 0.92;
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(28,18,8,0.65)';
  ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, TAU); ctx.fill();
  for (let i = 0; i < 8; i++) {
    const a = dirAngle(i), cur = k.cur === -1 || k.cur === i;
    if (cur || k.next === i) {
      ctx.fillStyle = cur ? `rgba(255,${70 + 70 * blink},40,${0.6 + 0.35 * k.meter})` : `rgba(255,220,120,${0.2 + 0.3 * blink})`;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, a - Math.PI / 8, a + Math.PI / 8); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,215,120,0.6)';
    ctx.lineWidth = i % 2 ? 0.8 : 1.4;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,215,120,0.9)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.font = `700 8px ${FONT_JP}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff4d0';
  ['北', '東', '南', '西'].forEach((ch, j) => { const a = dirAngle(j * 2); ctx.fillText(ch, Math.cos(a) * (r - 7), Math.sin(a) * (r - 7) + 0.5); });
  if (k.meter > 0.01) {
    ctx.strokeStyle = `rgba(255,80,40,${0.6 + 0.4 * blink})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, r + 4, -Math.PI / 2, -Math.PI / 2 + TAU * k.meter); ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------
//  金神の攻撃の部品（スペルカードと、ラストスペル「金神七殺」の七つの波で使う）
//  frames：続ける長さ  k：弾の量の倍率（七つ目の波で重ねるときは小さくする）  setK：凶方を決めるか
// ------------------------------------------------------------

// 本戦の攻撃の始め：方位盤の異界にいることにして、凶方を決め、位置につく
function* konjinIn(b, g, kyou, x = FIELD_W / 2, y = 90, o) {
  if (g.bg.event) g.bg.event('compassNow');
  b.zodiacLit = null;
  b.face = 'normal';
  setKyou(g, kyou, o);
  yield* b.moveTo(x, y, 40);
}

// 遊行：方位盤の八方を順に移り、移った先から撃つ。次の行き先は方位盤とその場所の輪で予告する
function* konjinYugyou(b, g, frames, k = 1, setK = true) {
  const spot = i => [FIELD_W / 2 + Math.cos(dirAngle(i)) * 150, 190 + Math.sin(dirAngle(i)) * 120];
  let i = dirIndexOf(angleTo(FIELD_W / 2, 190, b.x, b.y));
  if (setK) setKyou(g, 'boss');
  for (let f = 0; f < frames;) {
    const next = (i + 3) % 8, [nx, ny] = spot(next);
    if (setK) g.kyou.next = next;
    Fx.ring(nx, ny, 'rgba(255,200,80,0.9)', 8, 0.5, 60, 2);
    const n = Math.round((b.y > 240 ? 11 : 16) * k);
    for (let r = 0; r < 3; r++) {
      if (n >= 3) fireRing({ x: b.x, y: b.y, n, angle: rand(TAU), speed: 1.4 + r * 0.3, type: 'card', color: 'gold', silent: r > 0 });
      yield 10;
    }
    if (k >= 0.8) fireFan({ x: b.x, y: b.y, n: 3, spread: 0.3, angle: b.aim(), speed: 2.4, type: 'rice', color: 'red' });
    yield 30;
    i = next;
    yield* b.moveTo(nx, ny, 40);
    f += 110;
  }
}

// 方違え知らず：凶方へ向かって動くほど、降る針と凶方からの弾が増える
function* konjinKatatagae(b, g, frames, k = 1) {
  const order = [6, 2, 0, 5, 3, 7, 1];
  b.zodiacLit = null;
  for (let f = 0, loop = 0; f < frames; loop++) {
    const dir = order[loop % order.length];
    setKyou(g, dir, { next: order[(loop + 1) % order.length], power: 1.5 });
    for (let t = 0; t < 300 && f < frames; t++, f++) {
      const m = g.kyou.meter;
      if (t % Math.max(2, Math.round(lerp(14, 3, m) / k)) === 0) {
        fire({ x: rand(8, FIELD_W - 8), y: -8, angle: Math.PI / 2 + rand(-0.15, 0.15), speed: rand(1.5, 2.3), type: 'needle', color: 'gold', silent: true });
      }
      if (t % Math.round(lerp(44, 12, m)) === 0) edgeFan(dirAngle(dir), { n: 3, spread: 0.4, speed: 1.8 + m, type: 'rice', color: 'red' });
      if (k >= 0.8 && t % 60 === 30) fireRing({ x: b.x, y: b.y, n: 12, angle: rand(TAU), speed: 1.4, type: 'ball', color: 'yellow' });
      yield;
    }
  }
}

// 十二支方位盤：子・丑・寅……と、十二の方角から順に、干支の印の大玉と小弾が撃ち込まれる。一周ごとに速くなる
function* konjinJunishi(b, g, frames, k = 1, setK = true) {
  for (let f = 0, lap = 0; f < frames; lap++) {
    const wait = Math.max(12, Math.round((32 - lap * 6) / Math.min(1, k + 0.3)));
    for (let s = 0; s < 12 && f < frames; s++) {
      const a = -Math.PI / 2 + (s * TAU) / 12;
      b.zodiacLit = s;
      if (setK) setKyou(g, dirIndexOf(a), { next: dirIndexOf(a + TAU / 12) });
      const [x, y] = edgeAt(a, 0, 12);
      if (dist(x, y, G.player.x, G.player.y) > 100) {
        Fx.flash(x, y, 'rgba(255,210,90,0.7)', 20, 24);
        fire({ x, y, angle: aimAt(x, y), speed: 1.5 + Math.min(lap, 4) * 0.15, type: 'zodiac' + s, color: 'gold', delay: 24, margin: 60 });
        if (k >= 0.6) fireFan({ x, y, n: 5, spread: 1.0, angle: aimAt(x, y), speed: 1.2 + Math.min(lap, 4) * 0.12, type: 'small', color: 'orange', delay: 24, silent: true, margin: 60 });
      }
      yield wait;
      f += wait;
    }
    if (k >= 0.8) fireRing({ x: b.x, y: b.y, n: 16, angle: rand(TAU), speed: 1.5, type: 'ball', color: 'gold' });
  }
  b.zodiacLit = null;
}

// 塞がり：side（'W' 西 / 'E' 東 / 'S' 南）の帯を弾の壁で塞ぐ。壁の弾は消されても、しばらくするとまた現れる。
// 戻り値の wall.stop() で壁をなくす
function raiseWall(b, side, depth, skip = () => false) {
  const step = 20, cells = [];
  if (side === 'S') {
    for (let r = 0; r * step < depth; r++) for (let x = 10; x < FIELD_W; x += step) cells.push({ x, y: FIELD_H - 10 - r * step, d0: 40 + r * 12 });
  } else {
    for (let c = 0; c * step < depth; c++) for (let y = 10; y < FIELD_H; y += step) cells.push({ x: side === 'W' ? 10 + c * step : FIELD_W - 10 - c * step, y, d0: 40 + c * 12 });
  }
  const list = cells.filter(c => !skip(c.x, c.y));
  const live = c => c.bl && c.bl.alive;
  const wall = { side, depth, stopped: false, stop() { this.stopped = true; for (const c of list) if (live(c)) { c.bl.alive = false; Fx.cancel(c.bl.x, c.bl.y, 'gold'); } } };
  b.tasks.add((function* () {
    Fx.text(side === 'W' ? 40 : side === 'E' ? FIELD_W - 40 : FIELD_W / 2, side === 'S' ? FIELD_H - 40 : FIELD_H / 2, '塞', '#ffb070', 22, 80);
    for (let first = true; !wall.stopped; first = false) {
      for (const c of list) if (!live(c)) c.bl = fire({ x: c.x, y: c.y, speed: 0, type: 'ball', color: 'gold', delay: first ? c.d0 : 50, silent: true, margin: 60 });
      yield 90;
    }
  })());
  return wall;
}
function inWall(walls, x, y) {
  return walls.some(w => (w.side === 'W' && x < w.depth + 6) || (w.side === 'E' && x > FIELD_W - w.depth - 6) || (w.side === 'S' && y > FIELD_H - w.depth - 6));
}

// 塞がり（ラストスペルの波）：自機から遠い側の壁を立て、残りの方角から撃つ
function* konjinFusagari(b, g, frames) {
  b.zodiacLit = null;
  const side = G.player.x < FIELD_W / 2 ? 'E' : 'W', dir = side === 'E' ? 2 : 6;
  setKyou(g, dir);
  const wall = raiseWall(b, side, 90);
  for (let f = 0; f < frames; f++) {
    if (f % 40 === 0) edgeFan(pick([0, side === 'E' ? 6 : 2].map(dirAngle)), { n: 3, spread: 0.5, speed: 2.0, type: 'rice', color: 'orange' });
    if (f % 50 === 25) fireFan({ x: b.x, y: b.y, n: 5, spread: 0.7, angle: b.aim(), speed: 2.2, type: 'card', color: 'gold' });
    yield;
  }
  wall.stop();
}

// 八将神の行列：八方から、色と速さのちがう弾の列が画面を通り過ぎる。通る道は細い線で予告する
const GYORETSU_COLORS = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'];
const GYORETSU_SPEEDS = [1.5, 2.0, 1.7, 2.3, 1.6, 2.1, 1.8, 2.4];
function* konjinGyoretsu(b, g, frames, k = 1, setK = true) {
  if (setK) b.zodiacLit = null;
  for (let f = 0, c = 0; f < frames; c++) {
    const i = (c * 3) % 8, a = dirAngle(i), travel = a + Math.PI;
    if (setK) setKyou(g, i, { next: ((c + 1) * 3) % 8 });
    const [sx, sy] = edgeAt(a, rand(-100, 100), 6);
    const color = GYORETSU_COLORS[i], speed = GYORETSU_SPEEDS[i];
    fireLaser({ x: sx, y: sy, angle: travel, length: 700, width: 2, warn: 40, dur: 0, color, silent: true });
    b.tasks.add((function* () {
      yield 34;
      const n = Math.round(12 * Math.max(0.6, k));
      for (let j = 0; j < n; j++) {
        fire({ x: sx, y: sy, angle: travel, speed, type: 'ball', color, silent: true, margin: 60 });
        yield 8;
      }
    })());
    const wait = Math.round(46 / Math.max(0.4, k));
    if (k >= 0.8 && c % 2) fireFan({ x: b.x, y: b.y, n: 3, spread: 0.4, angle: b.aim(), speed: 2.0, type: 'small', color: 'white' });
    yield wait;
    f += wait;
  }
}

// 怒髪：金色の針が画面全体に降りそそぎ、落ちる途中で向きを変えて自機をねらう
function* konjinHari(b, g, frames, k = 1) {
  for (let f = 0; f < frames; f++) {
    if (f % Math.max(2, Math.round(4 / k)) === 0) {
      fire({
        x: rand(10, FIELD_W - 10), y: -6, angle: Math.PI / 2, speed: rand(1.2, 1.8), type: 'needle', color: 'gold', silent: true,
        script: function* (bl) {
          yield randInt(40, 100);
          if (bl.y > G.player.y - 50) return; // 自機より下まで来た針は、そのまま落ちる
          bl.speed = 0;
          bl.setColor('red');
          yield 10;
          bl.angle = aimAt(bl.x, bl.y);
          bl.speed = 2.6;
        },
      });
    }
    if (k >= 0.8 && f % 90 === 45) fireFan({ x: b.x, y: b.y, n: 5, spread: 0.8, angle: b.aim(), speed: 2.0, type: 'card', color: 'gold' });
    yield;
  }
}

// ------------------------------------------------------------
//  中ボス：金神（崩れた屋敷の瓦礫の上。名前は出さない）
// ------------------------------------------------------------
const KONJIN_MID_PHASES = [
  {
    // 通常：瓦礫を弾にして投げつけ、金色の札をまく
    type: 'non', hp: 1100, time: 30,
    *script(b, g) {
      setKyou(g, 'boss');
      yield* b.moveTo(FIELD_W / 2, 90, 40);
      for (let loop = 0; ; loop++) {
        fireRing({ x: b.x, y: b.y, n: 12, angle: rand(TAU), speed: 1.5, type: 'card', color: 'gold' });
        yield 20;
        for (let s = 0; s < 3; s++) {
          fireFan({ x: b.x, y: b.y, n: 3, spread: 0.6, angle: b.aim(), speed: 2.3 + s * 0.3, type: 'rubble', color: 'brown', silent: s > 0 });
          yield 8;
        }
        yield 46;
        if (loop % 2) b.wander(50, 60);
      }
    },
  },
  {
    // 吹き飛ばした屋敷の瓦礫を、弾にして撃ち返してくる。大きな瓦礫は途中で割れて破片になり、破片は凶方から吹きつけるように飛ぶ。
    // 凶方の端からも破片が飛んでくる。大きな瓦礫が割れる位置を見極め、凶方を避ける（魔理沙ルートの決め台詞「百部屋の瓦礫など、妾には塵も同然」）
    type: 'spell', name: '瓦符「百間屋敷の置き土産」', hp: 1400, time: 40,
    *script(b, g) {
      yield* b.moveTo(FIELD_W / 2, 80, 40);
      const ways = [1, 7, 2, 6];
      for (let loop = 0; ; loop++) {
        const w = Math.floor(loop / 3), dir = ways[w % ways.length];
        setKyou(g, dir, { next: ways[(w + 1) % ways.length] });
        const away = Math.atan2(-KYOU_DIRS[dir].y, -KYOU_DIRS[dir].x);
        for (let i = 0; i < 3; i++) {
          fire({
            x: b.x, y: b.y, angle: b.aim() + (i - 1) * 0.6, speed: 2.4, accel: -0.03, minSpeed: 0.3, type: 'rubble', color: 'brown', scale: 2.6, hitR: 11, silent: i > 0,
            script: function* (bl) {
              yield randInt(48, 72);
              // 割れる：破片は凶方から吹きつける向きに飛ぶ
              Fx.explosion(bl.x, bl.y, 'rgba(210,170,120,0.7)', 0.7);
              Sound.se('kira');
              for (let k = 0; k < 8; k++) fire({ x: bl.x, y: bl.y, angle: away + rand(-0.75, 0.75), speed: rand(1.3, 2.5), type: 'rubble', color: pick(['brown', 'soot']), silent: true, delay: 4 });
              bl.alive = false;
            },
          });
        }
        yield 40;
        // 凶方の端から、破片の吹きつけ
        for (let k = 0; k < 6; k++) {
          const [x, y] = edgeAt(dirAngle(dir), rand(-170, 170), 8);
          if (dist(x, y, G.player.x, G.player.y) > 90) fire({ x, y, angle: away + rand(-0.25, 0.25), speed: rand(1.6, 2.2), type: 'rubble', color: 'soot', delay: 20, silent: true });
        }
        yield 40;
        if (loop % 2) b.wander(40, 50);
      }
    },
  },
  {
    // 画面の右上（北東＝艮）から、鬼門封じの札が押し寄せる。札は画面に貼り付くように止まり、しばらくすると一斉に剥がれて飛び散る。
    // 札が貼り付いているあいだに、剥がれたあとの軌道（貼り付いた場所から、北東と反対へ広がる）を読んで位置を取る
    type: 'spell', name: '鬼門「艮の鬼門封じ」', hp: 1400, time: 40,
    *script(b, g) {
      setKyou(g, 1);
      yield* b.moveTo(FIELD_W - 90, 70, 50);
      for (let loop = 0; ; loop++) {
        const n = 24, frames = 46;
        for (let i = 0; i < n; i++) {
          const sx = FIELD_W - rand(0, 50), sy = rand(0, 50);
          let tx, ty, tries = 0;
          do { tx = rand(20, FIELD_W - 20); ty = rand(30, FIELD_H - 150); tries++; } while (dist(tx, ty, G.player.x, G.player.y) < 80 && tries < 20);
          const a = angleTo(sx, sy, tx, ty);
          fire({
            x: sx, y: sy, angle: a, speed: 0, type: 'card', color: 'gold', silent: true, margin: 60,
            script: function* (bl) {
              for (let f = 1; f <= frames; f++) { const t = Ease.outQuad(f / frames); bl.x = lerp(sx, tx, t); bl.y = lerp(sy, ty, t); yield; }
              yield 80 - Math.round((i * 30) / n);
              // 剥がれる：一瞬白くなってから、北東と反対の向きへ散る
              bl.setColor('white');
              yield 14;
              bl.setColor('gold');
              bl.angle = Math.PI * 0.75 + rand(-0.7, 0.7);
              bl.speed = 0.4; bl.accel = 0.04; bl.maxSpeed = rand(1.8, 2.6);
            },
          });
          if (i % 6 === 0) Sound.se('tan');
          yield 3;
        }
        for (let f = 0; f < 110; f++) {
          if (f % 30 === 0) fireFan({ x: b.x, y: b.y, n: 3, spread: 0.3, angle: b.aim(), speed: 2.4, type: 'small', color: 'red' });
          yield;
        }
      }
    },
  },
];

// ------------------------------------------------------------
//  ボス：金神（方位盤の異界）
//  流れ：通常1 → スペル1 → 通常2 → スペル2 → 通常3 → スペル3 → 通常4 → スペル4 → スペル5 → スペル6 → スペル7 → 耐久スペル → ラストスペル
// ------------------------------------------------------------
const KONJIN_PHASES = [
  {
    // 通常1：方位盤の八方（ボスのまわりの八つの点）から、金色の札弾を順番に撃つ
    type: 'non', hp: 1300, time: 30,
    *script(b, g) {
      yield* konjinIn(b, g, 'boss');
      for (let loop = 0; ; loop++) {
        for (let i = 0; i < 8; i++) {
          const a = dirAngle(loop % 2 ? 7 - i : i), px = b.x + Math.cos(a) * 56, py = b.y + Math.sin(a) * 56;
          Fx.flash(px, py, 'rgba(255,220,120,0.6)', 10, 14);
          fireFan({ x: px, y: py, n: 3, spread: 0.3, angle: aimAt(px, py), speed: 2.5, type: 'card', color: 'gold', silent: i % 2 > 0 });
          yield 7;
        }
        fireRing({ x: b.x, y: b.y, n: 14, angle: rand(TAU), speed: 1.4, type: 'ball', color: 'orange' });
        yield 40;
        if (loop % 2) b.wander(50, 60);
      }
    },
  },
  {
    // 金神が方位盤の八方を順に移り（遊行）、移った方角から撃つ。凶方は金神のいる方角なので、移るたびに凶方も移る。
    // 次の移動先は方位盤（金色の点滅）と、行き先の光の輪で予告される。移動先と反対側へ回る。Extra の基本を覚えるスペル
    type: 'spell', name: '方符「金神の遊行」', hp: 1700, time: 45,
    *script(b, g) {
      yield* konjinIn(b, g, 'boss', FIELD_W / 2, 70);
      yield* konjinYugyou(b, g, Infinity);
    },
  },
  {
    // 通常2：方位盤の光線（放射状のレーザー）を回転させながら、小弾をばら撒く
    type: 'non', hp: 1300, time: 30,
    *script(b, g) {
      yield* konjinIn(b, g, 'boss', FIELD_W / 2, 110);
      for (let loop = 0; ; loop++) {
        const n = 6, off = rand(TAU), dir = loop % 2 ? 1 : -1;
        for (let k = 0; k < n; k++) fireLaser({ x: b.x, y: b.y, angle: off + (k * TAU) / n, length: 560, width: 12, warn: 50, dur: 130, angVel: dir * 0.0055, color: 'yellow' });
        for (let f = 0; f < 190; f++) {
          if (f % 7 === 0) fire({ x: b.x, y: b.y, angle: rand(TAU), speed: rand(1.1, 2.0), type: 'small', color: 'orange', silent: true });
          if (f % 45 === 30) fireFan({ x: b.x, y: b.y, n: 3, spread: 0.3, angle: b.aim(), speed: 2.4, type: 'card', color: 'gold' });
          yield;
        }
      }
    },
  },
  {
    // 凶方は時々刻々と移る。自機が凶方へ向かって動くほど、降る針と凶方から来る弾が増え、反対へ動くと減る。
    // まっすぐ逃げず、いったん別の方角へ回ってから目的の位置へ向かう（方違え）。方違えを忘れた世の中への怒り
    type: 'spell', name: '祟符「方違え知らず」', hp: 1800, time: 45,
    *script(b, g) {
      yield* konjinIn(b, g, null, FIELD_W / 2, 80);
      yield* konjinKatatagae(b, g, Infinity);
    },
  },
  {
    // 通常3：十二支の印の大玉を、子・丑・寅……の順に時計回りに撃ち出す
    type: 'non', hp: 1300, time: 30,
    *script(b, g) {
      yield* konjinIn(b, g, 'boss');
      for (let loop = 0, s = 0; ; loop++) {
        for (let i = 0; i < 12; i++, s++) {
          const a = -Math.PI / 2 + ((s % 12) * TAU) / 12 + loop * 0.13;
          fire({ x: b.x, y: b.y, angle: a, speed: 1.7, type: 'zodiac' + (s % 12), color: 'gold', silent: i % 3 > 0 });
          fireFan({ x: b.x, y: b.y, n: 2, spread: 0.2, angle: a, speed: 1.2, type: 'small', color: 'orange', silent: true });
          yield 6;
        }
        fireFan({ x: b.x, y: b.y, n: 5, spread: 0.5, angle: b.aim(), speed: 2.6, type: 'rice', color: 'red' });
        yield 30;
        if (loop % 2) b.wander(40, 50);
      }
    },
  },
  {
    // 背景の方位盤が回り、子・丑・寅……と十二の方角から順番に、干支の印の大玉と小弾が撃ち込まれる。一周するごとに速くなる。
    // 次に撃ってくる方角は時計回りに決まっているので、先回りしてその反対側へ動く
    type: 'spell', name: '干支「十二支方位盤」', hp: 1800, time: 50,
    *script(b, g) {
      yield* konjinIn(b, g, null, FIELD_W / 2, 110);
      yield* konjinJunishi(b, g, Infinity);
    },
  },
  {
    // 通常4：金色の針弾を扇状に連射する。凶方（東か西）の側だけ、針の密度が高い
    type: 'non', hp: 1300, time: 30,
    *script(b, g) {
      yield* konjinIn(b, g, 2, FIELD_W / 2, 80);
      for (let loop = 0; ; loop++) {
        const east = loop % 2 === 0;
        setKyou(g, east ? 2 : 6, { next: east ? 6 : 2 });
        for (let v = 0; v < 3; v++) {
          for (let burst = 0; burst < 4; burst++) {
            const base = b.aim();
            fire({ x: b.x, y: b.y, angle: base, speed: 3.0, type: 'needle', color: 'gold', silent: true });
            for (const s of [-1, 1]) {
              // 下へ撃つとき、角度が小さい側（s = -1）が東
              const dense = (s < 0) === east, step = dense ? 0.1 : 0.24, count = dense ? 7 : 3;
              for (let j = 1; j <= count; j++) fire({ x: b.x, y: b.y, angle: base + s * j * step, speed: 3.0, type: 'needle', color: dense ? 'red' : 'gold', silent: true });
            }
            Sound.se('tan');
            yield 8;
          }
          yield 36;
        }
        b.wander(40, 50);
      }
    },
  },
  {
    // 画面の一方向が、弾の壁で丸ごと塞がれる（西 → 南 → 東の順）。塞がった方向は最後まで開かず（三年塞がり）、残りの方向から弾幕が来る。
    // 使える空間がだんだん狭くなるので、最後まで残る真ん中へ早めに移る。陰陽道の方位神・大将軍の「三年塞がり」
    type: 'spell', name: '暦符「大将軍の三年塞がり」', hp: 1900, time: 50,
    *script(b, g) {
      yield* konjinIn(b, g, 6, FIELD_W / 2, 70);
      const plan = [['W', 6, 0], ['S', 4, 840], ['E', 2, 1680]];
      const walls = [];
      for (let f = 0, p = 0; ; f++) {
        if (p < plan.length && f === plan[p][2]) {
          const [side, dir] = plan[p];
          walls.push(raiseWall(b, side, side === 'S' ? 60 : 86, (x, y) => inWall(walls, x, y)));
          setKyou(g, dir, { next: plan[p + 1] ? plan[p + 1][1] : null });
          p++;
        }
        // 残っている方角（北と、まだ塞がっていない東西）から
        if (f % 34 === 0) {
          const open = [0, 2, 6].filter(i => !walls.some(w => (w.side === 'E' && i === 2) || (w.side === 'W' && i === 6)));
          edgeFan(dirAngle(pick(open)), { n: 3, spread: 0.5, speed: 2.0, type: 'rice', color: 'orange' });
        }
        if (f % 50 === 25) fireFan({ x: b.x, y: b.y, n: 5, spread: 0.6, angle: b.aim(), speed: 2.2, type: 'card', color: 'gold' });
        if (f % 120 === 60) fireRing({ x: b.x, y: b.y, n: 14, angle: rand(TAU), speed: 1.3, type: 'ball', color: 'yellow', silent: true });
        yield;
      }
    },
  },
  {
    // 方位を司る八柱の神の行列が、八方から弾の列になって画面を通り過ぎる。八つの列は、それぞれ色と速さが違う。
    // 列の通り道は細い線で予告される。列と列が交差する場所を避け、交差のあとにできる空白へ入る。陰陽道の方位の神々、八将神
    type: 'spell', name: '遊符「八将神の行列」', hp: 1900, time: 45,
    *script(b, g) {
      yield* konjinIn(b, g, null, FIELD_W / 2, 90);
      yield* konjinGyoretsu(b, g, Infinity);
    },
  },
  {
    // 逆立った金色の髪から、針のような弾が画面全体に降り注ぐ。針は落ちる途中で一瞬止まって赤くなり、向きを変えて自機を狙ってくる。
    // 針の向きが変わる瞬間に小さく動く。大きく動くと、別の針に当たる。登場したときのぶち切れ
    type: 'spell', name: '金符「怒髪、金色に燃ゆ」', hp: 1900, time: 45,
    *script(b, g) {
      yield* konjinIn(b, g, 'boss', FIELD_W / 2, 80);
      b.face = 'angry';
      g.shake = 20;
      yield* konjinHari(b, g, Infinity);
    },
  },
  {
    // 東西南北の四方と、天（金神のいる上）と地（画面の下から噴き上がる）から、同時に弾が来る。
    // 方位盤の凶方（東 → 南 → 西 → 北）が順番に光り、光った方角の弾だけが速くなる。凶方から来る速い弾だけに集中し、ほかの弾はゆっくり避ける。
    // 霊夢ルートの決め台詞「東西南北、天地四方。この世に妾の眼の届かぬ方角はない」
    type: 'spell', name: '天地「東西南北、天地四方」', hp: 2000, time: 50,
    *script(b, g) {
      yield* konjinIn(b, g, 2, FIELD_W / 2, 80);
      const order = [2, 4, 6, 0];
      for (let f = 0; ; f++) {
        const cur = order[Math.floor(f / 150) % 4];
        if (f % 150 === 0) setKyou(g, cur, { next: order[(Math.floor(f / 150) + 1) % 4] });
        if (f % 13 === 0) {
          for (const i of order) {
            const fast = i === cur, sp = fast ? 2.4 : 0.95, color = fast ? 'gold' : 'blue';
            const travel = dirAngle(i) + Math.PI;
            let x, y;
            if (i === 0) { x = rand(10, FIELD_W - 10); y = -6; }
            else if (i === 4) { x = rand(10, FIELD_W - 10); y = FIELD_H + 6; if (Math.abs(x - G.player.x) < 70) continue; }
            else { x = i === 2 ? FIELD_W + 6 : -6; y = rand(20, FIELD_H - 20); if (Math.abs(y - G.player.y) < 50) continue; }
            fire({ x, y, angle: travel + rand(-0.2, 0.2), speed: sp, type: fast ? 'rice' : 'small', color, silent: true, delay: 0, margin: 50 });
          }
        }
        // 天：金神から全方位に
        if (f % 70 === 0) fireRing({ x: b.x, y: b.y, n: 14, angle: rand(TAU), speed: cur === 0 ? 2.2 : 1.2, type: 'ball', color: cur === 0 ? 'gold' : 'cyan' });
        // 地：画面の下から噴き上がって、また落ちる
        if (f % 40 === 20) {
          const x = rand(20, FIELD_W - 20);
          if (Math.abs(x - G.player.x) > 60) for (let k = 0; k < 3; k++) fire({ x: x + k * 8 - 8, y: FIELD_H + 6, angle: -Math.PI / 2 + rand(-0.25, 0.25), speed: cur === 4 ? 4.6 : 3.8, ay: 0.05, maxFall: 3, type: 'small', color: cur === 4 ? 'gold' : 'green', silent: true, delay: 0, margin: 60 });
        }
        yield;
      }
    },
  },
  {
    // 四方すべてが凶方になり、どこへ動いても祟りがたまって弾が増える。金神は攻撃を受け付けず、一定時間耐えきれば撃破扱い。
    // 動けば動くほど弾が増える。最小限の動きで避ける、ちょん避けの総決算
    type: 'spell', name: '耐久スペル「四方塞がり」', hp: 1, time: 40, survival: true,
    *script(b, g) {
      yield* konjinIn(b, g, 'all', FIELD_W / 2, 110, { power: 1.2 });
      for (let f = 0; ; f++) {
        if (f % 26 === 0) fireRing({ x: b.x, y: b.y, n: 18, angle: f * 0.037, speed: 1.15, type: 'small', color: 'gold', silent: true });
        if (f % 45 === 10) for (let s = 0; s < 3; s++) fire({ x: b.x, y: b.y, angle: b.aim(), speed: 3.2 + s * 0.4, type: 'needle', color: 'red', silent: s > 0 });
        yield;
      }
    },
  },
  {
    // ラストスペル。七つの波で押し寄せる、祟りの総決算。波ごとに、それまでのスペルの要素（遊行・方違え・十二支・塞がり・行列・針）が一つずつ使われ、
    // 七つ目の波ですべてが重なる。七つの波を数え終えれば撃破（耐えきるスペル）。金神の祟りが家族七人に及ぶという「金神七殺」の言い伝え
    type: 'spell', name: 'ラストスペル「金神七殺」', hp: 1, time: 72, survival: true,
    *script(b, g) {
      yield* konjinIn(b, g, 'boss', FIELD_W / 2, 90);
      const WAVE = 540;
      const NUM = ['一', '二', '三', '四', '五', '六', '七'];
      const waves = [
        () => konjinYugyou(b, g, WAVE),
        () => konjinKatatagae(b, g, WAVE),
        () => konjinJunishi(b, g, WAVE),
        () => konjinFusagari(b, g, WAVE),
        () => konjinGyoretsu(b, g, WAVE),
        () => konjinHari(b, g, WAVE),
      ];
      yield 20;
      for (let w = 0; w < 7; w++) {
        Fx.text(FIELD_W / 2, 150, `${NUM[w]}殺`, '#ffd860', 26, 100);
        Sound.se('kira');
        g.shake = 12;
        if (w < 6) yield* waves[w]();
        else {
          // 七つ目：すべてが重なる（一つ一つは軽くする）
          setKyou(g, 'boss');
          b.face = 'angry';
          b.tasks.add(konjinYugyou(b, g, WAVE, 0.45, false));
          b.tasks.add(konjinHari(b, g, WAVE, 0.3));
          b.tasks.add(konjinGyoretsu(b, g, WAVE, 0.4, false));
          b.tasks.add(konjinJunishi(b, g, WAVE, 0.35, false));
          yield WAVE;
        }
        b.zodiacLit = null;
        yield 20;
      }
      // 七つの波を数え終えたら撃破（残り時間を切り上げる）
      b.timer = Math.min(b.timer, 30);
      for (;;) yield;
    },
  },
];

// ------------------------------------------------------------
//  道中の敵
// ------------------------------------------------------------

// 方位の妖精：降りてきて止まり、八方へ順に金色の札を撃つ
function hoiFairy(x, stopY = 100) {
  return spawnEnemy({
    x, y: -20, kind: 'bigfairy', color: 'yellow', hp: 240, score: 20000, drops: { power: 4, point: 6 },
    script: function* (e) {
      yield* e.moveTo(x, stopY, 60);
      for (let loop = 0; loop < 3; loop++) {
        for (let i = 0; i < 8; i++) {
          fireFan({ x: e.x, y: e.y, n: 3, spread: 0.2, angle: dirAngle(i) + loop * 0.2, speed: 1.8, type: 'card', color: 'gold', silent: i > 0 });
          yield 5;
        }
        yield 40;
      }
      e.setMove(0, -Math.PI / 2, 0.05);
    },
  });
}

// 道中の凶方：八方を順に巡る（遊行）。次の凶方は方位盤で予告する。road.on が false になったら終わる
function* roadKyou(g, road) {
  for (let c = 0; road.on; c++) {
    setKyou(g, (c * 3) % 8, { next: ((c + 1) * 3) % 8 });
    for (let f = 0; f < 480 && road.on; f++) yield;
  }
}

EXTRA_STAGES.push({
  name: '方位の果て',
  nameEn: 'Where All Directions End',
  bg: CompassRealmBG,
  bgm: 'stageEx',
  // この面のボス（管理者ページの一覧・ボスの攻撃を試す機能・テストが使う）
  bosses: [
    { id: 'konjinMid', phases: KONJIN_MID_PHASES, mid: true, def: { spellBg: 'konjin', circleColor: '255,210,110' } },
    { id: 'konjin', phases: KONJIN_PHASES, bgm: 'bossEx', def: { spellBg: 'konjin', circleColor: '255,210,110', aura: 'rgba(255,200,80,0.35)', finalDrops: { power: 10, point: 30, bigpower: 1 } } },
  ],
  *script(g) {
    yield 160;
    // 前半（崩れた屋敷の瓦礫の上）：大群 → 降ってくる瓦礫 → 妖精
    g.tasks.add(swarmStream(-1, 16, { color: 'yellow' }));
    yield 50;
    g.tasks.add(swarmStream(1, 16, { color: 'yellow' }));
    yield 120;
    g.tasks.add(tileShower(360, 50, ['brown', 'soot'], true, 'rubble'));
    yield 100;
    [96, 288].forEach(x => sniperFairy(x, 100));
    yield 160;
    hoiFairy(FIELD_W / 2, 110);
    yield 200;
    yield* waitClear(600);

    // 中ボス：金神（瓦礫の上。名前は出さない）。倒すと方位盤の異界へ
    const mid = g.spawnStageBoss('konjinMid', { x: FIELD_W / 2, y: -50 });
    yield* mid.moveTo(FIELD_W / 2, 100, 60);
    yield* g.talk(STORY.extraMid[g.charId].before);
    kyouHelp(g);
    yield* g.fight(mid, KONJIN_MID_PHASES);
    g.kyou = null;
    if (mid.hp <= 0) dropItems(mid.x, mid.y, { power: 8, point: 12, bomb: 1 });
    yield* g.talk(STORY.extraMid[g.charId].after);
    yield* g.bossDown(mid, true);
    if (g.bg.event) g.bg.event('compass');
    yield 200;

    // 後半（方位盤の異界）：凶方が八方を巡る
    const road = { on: true };
    g.tasks.add(roadKyou(g, road));
    for (let k = 0; k < 2; k++) { hoiFairy(k ? 290 : 94, 100); yield 90; }
    g.tasks.add(swirlWave(-1, 10));
    g.tasks.add(swirlWave(1, 10));
    yield 220;
    [70, 314].forEach(x => laserFairy(x, 110));
    yield 140;
    for (let w = 0; w < 3; w++) {
      g.tasks.add(swarmStream(-1, 12, { y: 30 + w * 30, color: w % 2 ? 'red' : 'yellow' }));
      g.tasks.add(swarmStream(1, 12, { y: 30 + w * 30, color: w % 2 ? 'red' : 'yellow' }));
      yield 110;
    }
    splitterFairy(110);
    yield 40;
    splitterFairy(274);
    yield 200;
    for (let k = 0; k < 3; k++) { hoiFairy(rand(70, FIELD_W - 70), 80 + k * 25); yield 120; }
    fairyLine(7, 50);
    yield* waitClear(900);
    road.on = false;
    g.kyou = null;
    yield 120;
  },
  // ボス戦（キー「V」のときはここから始まる）
  *boss(g) {
    if (g.bg.event) g.bg.event('compassNow');
    g.kyou = null;
    const boss = g.spawnStageBoss('konjin', { x: FIELD_W / 2, y: -50 });
    yield* boss.moveTo(FIELD_W / 2, 100, 70);
    yield* g.talk(STORY.extra[g.charId].before);
    kyouHelp(g);
    yield* g.fight(boss, KONJIN_PHASES);
    g.kyou = null;
    yield* g.bossDown(boss);
    yield* g.talk(STORY.extra[g.charId].after);
  },
});
