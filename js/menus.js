'use strict';
// ============================================================
//  タイトル・各種メニュー・エンディング・リザルト
// ============================================================

class MenuBG {
  constructor() {
    this.t = 0;
    this.stars = [];
    for (let i = 0; i < 180; i++) this.stars.push({ x: frand(SCREEN_W), y: frand(SCREEN_H * 0.8), s: frand() < 0.1 ? 2 : 1, p: frand(TAU) });
    this.meteors = [];
    this.land = MenuBG.makeLand();
  }
  static makeLand() {
    const c = makeCanvas(SCREEN_W, 170);
    const x = c.getContext('2d');
    x.fillStyle = '#07051a';
    x.beginPath();
    x.moveTo(0, 170);
    for (let px = 0; px <= SCREEN_W; px += 8) {
      const y = 70 + Math.sin(px * 0.011) * 22 + Math.sin(px * 0.031 + 1) * 8;
      x.lineTo(px, y);
    }
    x.lineTo(SCREEN_W, 170);
    x.closePath();
    x.fill();
    x.fillStyle = '#040310';
    x.beginPath();
    x.moveTo(0, 170);
    for (let px = 0; px <= SCREEN_W; px += 8) x.lineTo(px, 120 + Math.sin(px * 0.017 + 2) * 14);
    x.lineTo(SCREEN_W, 170);
    x.closePath();
    x.fill();
    // 鳥居
    x.fillStyle = '#040310';
    const tx = 520, ty = 72;
    x.fillRect(tx - 34, ty - 6, 68, 6);
    x.fillRect(tx - 28, ty + 4, 56, 4);
    x.fillRect(tx - 24, ty - 2, 5, 50);
    x.fillRect(tx + 19, ty - 2, 5, 50);
    x.beginPath(); x.moveTo(tx - 40, ty - 10); x.quadraticCurveTo(tx, ty - 4, tx + 40, ty - 10); x.lineTo(tx + 38, ty - 5); x.quadraticCurveTo(tx, ty, tx - 38, ty - 5); x.fill();
    // 木々
    for (let i = 0; i < 26; i++) {
      const px = (i * 53) % SCREEN_W, h = 20 + (i * 37) % 30;
      x.beginPath(); x.moveTo(px - 12, 130); x.lineTo(px, 130 - h - 30); x.lineTo(px + 12, 130); x.fill();
    }
    return c;
  }
  update() {
    this.t++;
    for (const s of this.stars) s.p += 0.04;
    if (Math.random() < 1 / 40) {
      const sp = frand(6, 10), a = frand(25, 50) * DEG;
      this.meteors.push({ x: frand(-60, SCREEN_W * 0.7), y: frand(-30, 150), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 50 });
    }
    for (const m of this.meteors) { m.x += m.vx; m.y += m.vy; m.life--; }
    this.meteors = this.meteors.filter(m => m.life > 0);
  }
  draw(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
    g.addColorStop(0, '#060418');
    g.addColorStop(0.6, '#1a1240');
    g.addColorStop(1, '#2a1a50');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    // 月
    const mg = ctx.createRadialGradient(118, 104, 10, 118, 104, 120);
    mg.addColorStop(0, 'rgba(255,250,220,0.35)');
    mg.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(0, 0, 260, 240);
    ctx.fillStyle = '#fffbe6';
    ctx.beginPath(); ctx.arc(118, 104, 42, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(210,200,170,0.35)';
    ctx.beginPath(); ctx.arc(104, 94, 9, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(132, 118, 6, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.stars) {
      ctx.fillStyle = `rgba(230,230,255,${0.3 + 0.35 * Math.sin(s.p)})`;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.lineCap = 'round';
    for (const m of this.meteors) {
      const a = Math.min(1, m.life / 15);
      const gg = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 10, m.y - m.vy * 10);
      gg.addColorStop(0, `rgba(255,250,220,${a})`);
      gg.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.strokeStyle = gg;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 10, m.y - m.vy * 10); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.land, 0, SCREEN_H - 170);
  }
}

let sharedMenuBG = null;
function menuBG() { return sharedMenuBG || (sharedMenuBG = new MenuBG()); }

// 縦並びメニュー。rects を返し、タップ判定に使う
function drawMenuList(ctx, items, sel, x, y, gap, o = {}) {
  const rects = [];
  ctx.textBaseline = 'middle';
  items.forEach((it, i) => {
    const on = i === sel;
    const label = typeof it === 'string' ? it : it.label;
    const disabled = typeof it === 'object' && it.disabled;
    ctx.font = `${on ? 700 : 500} ${o.size || 19}px ${FONT_JP}`;
    ctx.textAlign = o.align || 'left';
    const px = x + (on ? (o.shift ?? 10) : 0);
    const col = disabled ? '#5a5478' : on ? '#fff3c8' : '#a8a0cc';
    if (on) {
      ctx.save();
      ctx.shadowColor = 'rgba(255,220,140,0.9)';
      ctx.shadowBlur = 10;
      strokeText(ctx, label, px, y + i * gap, col, 'rgba(20,10,40,0.9)', 3);
      ctx.restore();
      ctx.fillStyle = '#ffe08a';
      ctx.save();
      const w = ctx.measureText(label).width;
      ctx.translate(o.align === 'center' ? px - w / 2 - 16 : px - 16, y + i * gap);
      ctx.rotate(Game.frame * 0.05);
      starPath(ctx, 6, 2.6);
      ctx.fill();
      ctx.restore();
    } else {
      strokeText(ctx, label, px, y + i * gap, col, 'rgba(20,10,40,0.9)', 3);
    }
    const w = o.hitW || 220;
    rects.push({ x: o.align === 'center' ? x - w / 2 : x - 20, y: y + i * gap - gap / 2, w, h: gap });
  });
  return rects;
}
function menuTapIndex(rects) {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (Input.tapIn(r.x, r.y, r.w, r.h)) return i;
  }
  return -1;
}
function menuMove(sel, n, prevKey = 'up', nextKey = 'down') {
  if (Input.repeat(prevKey)) { Sound.se('cursor'); return (sel + n - 1) % n; }
  if (Input.repeat(nextKey)) { Sound.se('cursor'); return (sel + 1) % n; }
  return sel;
}
// 画面左上の「戻る」ボタン（タッチ用）
function drawBackButton(ctx) {
  if (!Input.isTouch) return;
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.strokeStyle = 'rgba(214,186,120,0.8)';
  ctx.lineWidth = 1;
  ctx.fillRect(10, 10, 70, 30);
  ctx.strokeRect(10, 10, 70, 30);
  ctx.font = `600 14px ${FONT_JP}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText('◀ 戻る', 45, 25);
}
function backPressed() { return Input.pressed('bomb') || Input.tapIn(10, 10, 70, 30); }

function drawHeading(ctx, text, en) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 26px ${FONT_JP}`;
  strokeText(ctx, text, SCREEN_W / 2, 44, '#ffffff', 'rgba(40,20,90,0.9)', 4);
  if (en) {
    ctx.font = `italic 600 14px ${FONT_EN}`;
    ctx.fillStyle = '#d8c89a';
    ctx.fillText(en, SCREEN_W / 2, 70);
  }
}

// ------------------------------------------------------------
//  タイトル
// ------------------------------------------------------------
class TitleScene {
  constructor(sel = 0) {
    this.sel = sel;
    this.frame = 0;
    this.items = ['ゲームスタート', 'プラクティス', 'ミュージックルーム', '操作説明とお話', 'オプション'];
    this.rects = [];
  }
  enter() { Sound.playBgm('title'); }
  update() {
    this.frame++;
    menuBG().update();
    this.sel = menuMove(this.sel, this.items.length);
    const tap = menuTapIndex(this.rects);
    if (tap >= 0) this.sel = tap;
    if ((Input.pressed('shot') || tap >= 0) && this.frame > 10) {
      Sound.se('ok');
      switch (this.sel) {
        case 0: Game.setScene(new DifficultyScene('game')); break;
        case 1: Game.setScene(new DifficultyScene('practice')); break;
        case 2: Game.setScene(new MusicRoomScene()); break;
        case 3: Game.setScene(new ManualScene()); break;
        case 4: Game.setScene(new OptionScene()); break;
      }
    }
  }
  draw(ctx) {
    menuBG().draw(ctx);
    const f = this.frame;
    const a = Math.min(1, f / 40);
    ctx.globalAlpha = a;
    // タイトルロゴ
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 18px ${FONT_JP}`;
    ctx.fillStyle = '#d8c8ff';
    ctx.fillText('東方Project 二次創作弾幕シューティング', 400, 74);
    ctx.font = `800 64px ${FONT_JP}`;
    ctx.shadowColor = 'rgba(150,130,255,0.95)';
    ctx.shadowBlur = 24;
    const g = ctx.createLinearGradient(0, 100, 0, 170);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#c4b2ff');
    ctx.fillStyle = g;
    ctx.fillText('東方星降夜', 400, 134);
    ctx.shadowBlur = 0;
    ctx.font = `italic 600 24px ${FONT_EN}`;
    ctx.fillStyle = '#ecd9a0';
    ctx.fillText('〜 Night of Falling Stars.', 420, 184);
    ctx.restore();
    this.rects = drawMenuList(ctx, this.items, this.sel, 440, 240, 34);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.font = `12px ${FONT_JP}`;
    ctx.fillStyle = 'rgba(220,210,255,0.75)';
    ctx.fillText(Input.isTouch ? 'タップで選択' : '↑↓：選択　Z：決定　X：戻る　M：ミュート', 16, 440);
    ctx.textAlign = 'center';
    ctx.font = `11px ${FONT_JP}`;
    ctx.fillStyle = 'rgba(200,190,240,0.7)';
    ctx.fillText('本作品は上海アリス幻樂団「東方Project」の二次創作です。公式とは関係ありません。', SCREEN_W / 2, 466);
  }
}

// ------------------------------------------------------------
//  難易度選択
// ------------------------------------------------------------
const DIFF_DESC = [
  '弾幕シューティングが初めての方に',
  '普通に遊びたい方に',
  '弾幕に慣れてきた方に',
  '狂気の弾幕に挑みたい方に',
];

class DifficultyScene {
  constructor(mode) {
    this.mode = mode;
    this.sel = Store.get('lastDiff', 1);
    this.frame = 0;
  }
  update() {
    this.frame++;
    menuBG().update();
    this.sel = menuMove(this.sel, 4);
    let tap = -1;
    for (let i = 0; i < 4; i++) if (Input.tapIn(150, 110 + i * 86, 340, 76)) tap = i;
    if (tap >= 0) this.sel = tap;
    if ((Input.pressed('shot') || tap >= 0) && this.frame > 8) {
      Sound.se('ok');
      Store.set('lastDiff', this.sel);
      Game.setScene(new CharacterScene(this.mode, this.sel));
    } else if (backPressed()) {
      Sound.se('cancel');
      Game.setScene(new TitleScene(this.mode === 'game' ? 0 : 1));
    }
  }
  draw(ctx) {
    menuBG().draw(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    drawHeading(ctx, this.mode === 'practice' ? '難易度選択（プラクティス）' : '難易度選択', 'Select Difficulty');
    for (let i = 0; i < 4; i++) {
      const on = i === this.sel;
      const y = 110 + i * 86;
      ctx.fillStyle = on ? 'rgba(60,40,120,0.75)' : 'rgba(20,14,50,0.55)';
      ctx.fillRect(150, y, 340, 76);
      ctx.strokeStyle = on ? DIFF_COLORS[i] : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = on ? 2 : 1;
      ctx.strokeRect(150.5, y + 0.5, 339, 75);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `italic 700 ${on ? 34 : 28}px ${FONT_EN}`;
      strokeText(ctx, DIFF_NAMES[i], SCREEN_W / 2, y + 30, on ? DIFF_COLORS[i] : '#8a84a8', 'rgba(0,0,0,0.8)', 3);
      ctx.font = `13px ${FONT_JP}`;
      ctx.fillStyle = on ? '#f0eaff' : '#8a84a8';
      ctx.fillText(DIFF_DESC[i], SCREEN_W / 2, y + 58);
    }
    drawBackButton(ctx);
  }
}

// ------------------------------------------------------------
//  キャラクター選択
// ------------------------------------------------------------
// キャラクター選択での色（霊夢はゲーム中の自機に合わせて青）
const SELECT_COLOR = { reimu: '#7c9cff', marisa: '#ffd860' };

class CharacterScene {
  constructor(mode, diff) {
    this.mode = mode;
    this.diff = diff;
    this.ids = ['reimu', 'marisa'];
    this.sel = Math.max(0, this.ids.indexOf(Store.get('lastChar', 'reimu')));
    this.frame = 0;
  }
  update() {
    this.frame++;
    menuBG().update();
    this.sel = menuMove(this.sel, 2, 'left', 'right');
    let tap = -1;
    if (Input.tapIn(20, 90, 290, 360)) tap = 0;
    if (Input.tapIn(330, 90, 290, 360)) tap = 1;
    const tapConfirm = tap >= 0 && tap === this.sel;
    if (tap >= 0 && tap !== this.sel) { this.sel = tap; Sound.se('cursor'); }
    if ((Input.pressed('shot') || tapConfirm) && this.frame > 8) {
      Sound.se('ok');
      const id = this.ids[this.sel];
      Store.set('lastChar', id);
      if (this.mode === 'practice') Game.setScene(new StageSelectScene(this.diff, id));
      else Game.setScene(new GameScene({ difficulty: this.diff, character: id, stage: 0 }));
    } else if (backPressed()) {
      Sound.se('cancel');
      Game.setScene(new DifficultyScene(this.mode));
    }
  }
  draw(ctx) {
    menuBG().draw(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    drawHeading(ctx, 'キャラクター選択', 'Select Player');
    this.ids.forEach((id, i) => {
      const on = i === this.sel;
      const x = 20 + i * 310, y = 90, w = 290, h = 360;
      ctx.fillStyle = on ? 'rgba(50,34,110,0.8)' : 'rgba(16,12,40,0.6)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = on ? SELECT_COLOR[id] : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = on ? 2 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.globalAlpha = on ? 1 : 0.5;
      drawPortrait(ctx, id === 'reimu' ? 'reimuBlue' : id, x + 70, y + 150, 3.4, on ? 'happy' : 'normal', this.frame);
      ctx.globalAlpha = 1;
      const tx = x + 132;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `12px ${FONT_JP}`;
      ctx.fillStyle = '#d0c8f0';
      ctx.fillText(CHARA_INFO[id].title, tx, y + 36);
      ctx.font = `800 22px ${FONT_JP}`;
      strokeText(ctx, CHARA_INFO[id].name, tx, y + 62, on ? SELECT_COLOR[id] : '#b0a8d0', 'rgba(0,0,0,0.8)', 3);
      const pt = PLAYER_TYPES[id];
      ctx.font = `12px ${FONT_JP}`;
      ctx.fillStyle = on ? '#f0eaff' : '#9890b8';
      wrapText(ctx, pt.desc, 140).forEach((ln, k) => ctx.fillText(ln, tx, y + 96 + k * 18));
      ctx.font = `12px ${FONT_JP}`;
      ctx.fillStyle = on ? '#ffe8b0' : '#8a84a8';
      ctx.fillText('ショット', x + 20, y + 262);
      ctx.fillStyle = on ? '#f0eaff' : '#9890b8';
      pt.shotDesc.forEach((s, k) => ctx.fillText(s, x + 30, y + 282 + k * 18));
      ctx.fillStyle = on ? '#ffe8b0' : '#8a84a8';
      ctx.fillText('ボム', x + 20, y + 326);
      ctx.fillStyle = on ? '#f0eaff' : '#9890b8';
      ctx.fillText(pt.bombName, x + 30, y + 344);
    });
    ctx.textAlign = 'center';
    ctx.font = `12px ${FONT_JP}`;
    ctx.fillStyle = 'rgba(220,210,255,0.8)';
    ctx.fillText(Input.isTouch ? 'もう一度タップで決定' : '←→：選択　Z：決定　X：戻る', SCREEN_W / 2, 468);
    drawBackButton(ctx);
  }
}

// ------------------------------------------------------------
//  プラクティスのステージ選択
// ------------------------------------------------------------
class StageSelectScene {
  constructor(diff, charId) {
    this.diff = diff;
    this.charId = charId;
    this.sel = 0;
    this.frame = 0;
    this.rects = [];
  }
  update() {
    this.frame++;
    menuBG().update();
    this.sel = menuMove(this.sel, STAGES.length);
    const tap = menuTapIndex(this.rects);
    if (tap >= 0) this.sel = tap;
    if ((Input.pressed('shot') || tap >= 0) && this.frame > 8) {
      Sound.se('ok');
      Game.setScene(new GameScene({ difficulty: this.diff, character: this.charId, stage: this.sel, practice: true }));
    } else if (backPressed()) {
      Sound.se('cancel');
      Game.setScene(new CharacterScene('practice', this.diff));
    }
  }
  draw(ctx) {
    menuBG().draw(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    drawHeading(ctx, 'ステージ選択', 'Stage Practice');
    const items = STAGES.map((s, i) => `Stage ${i + 1}　${s.name}`);
    this.rects = drawMenuList(ctx, items, this.sel, 200, 160, 60, { size: 22, hitW: 340 });
    const st = STAGES[this.sel];
    ctx.textAlign = 'center';
    ctx.font = `italic 600 16px ${FONT_EN}`;
    ctx.fillStyle = '#d8c89a';
    ctx.fillText(st.nameEn, SCREEN_W / 2, 360);
    ctx.font = `12px ${FONT_JP}`;
    ctx.fillStyle = '#c8c0e8';
    ctx.fillText(`開始時の霊力：${(PRACTICE_POWER[this.sel] / 100).toFixed(2)}`, SCREEN_W / 2, 386);
    drawBackButton(ctx);
  }
}

// ------------------------------------------------------------
//  ミュージックルーム
// ------------------------------------------------------------
class MusicRoomScene {
  constructor() {
    this.sel = Math.max(0, MUSIC_ROOM.indexOf(Sound.songId));
    this.frame = 0;
    this.rects = [];
  }
  update() {
    this.frame++;
    menuBG().update();
    this.sel = menuMove(this.sel, MUSIC_ROOM.length);
    const tap = menuTapIndex(this.rects);
    if (tap >= 0) this.sel = tap;
    if (Input.pressed('shot') || tap >= 0) {
      Sound.se('ok');
      Sound.playBgm(MUSIC_ROOM[this.sel]);
    } else if (backPressed()) {
      Sound.se('cancel');
      Game.setScene(new TitleScene(2));
    }
  }
  draw(ctx) {
    menuBG().draw(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    drawHeading(ctx, 'ミュージックルーム', 'Music Room');
    const items = MUSIC_ROOM.map((id, i) => `${String(i + 1).padStart(2, '0')}. ${SONGS[id].title}` + (Sound.songId === id ? '  ♪' : ''));
    this.rects = drawMenuList(ctx, items, this.sel, 70, 110, 30, { size: 16, hitW: 500 });
    const song = SONGS[MUSIC_ROOM[this.sel]];
    ctx.fillStyle = 'rgba(16,10,40,0.75)';
    ctx.fillRect(60, 330, 520, 110);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(214,186,120,0.6)';
    ctx.strokeRect(60.5, 330.5, 519, 109);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `13px ${FONT_JP}`;
    ctx.fillStyle = '#f0eaff';
    song.comment.split('\n').forEach((ln, i) => ctx.fillText(ln, 76, 344 + i * 22));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `12px ${FONT_JP}`;
    ctx.fillStyle = 'rgba(220,210,255,0.8)';
    ctx.fillText(Input.isTouch ? 'タップで再生' : 'Z：再生　X：戻る', SCREEN_W / 2, 462);
    drawBackButton(ctx);
  }
}

// ------------------------------------------------------------
//  操作説明とお話
// ------------------------------------------------------------
class ManualScene {
  constructor() { this.frame = 0; }
  update() {
    this.frame++;
    menuBG().update();
    if ((Input.pressed('shot') || backPressed() || (Input.anyTap() && !Input.tapIn(10, 10, 70, 30))) && this.frame > 10) {
      Sound.se('cancel');
      Game.setScene(new TitleScene(3));
    }
  }
  draw(ctx) {
    menuBG().draw(ctx);
    ctx.fillStyle = 'rgba(6,4,20,0.72)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    drawHeading(ctx, '操作説明とお話', 'How to Play');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `700 15px ${FONT_JP}`;
    ctx.fillStyle = '#ffe8b0';
    ctx.fillText('― お話 ―', 40, 96);
    ctx.font = `13px ${FONT_JP}`;
    ctx.fillStyle = '#ece6ff';
    let y = 122;
    for (const para of INTRO_TEXT) {
      for (const ln of wrapText(ctx, para, 250)) { ctx.fillText(ln, 40, y); y += 20; }
      y += 6;
    }
    ctx.font = `700 15px ${FONT_JP}`;
    ctx.fillStyle = '#ffe8b0';
    ctx.fillText('― 操作 ―', 330, 96);
    const rows = [
      ['↑↓←→', '移動'],
      ['Z', 'ショット／決定'],
      ['X', 'ボム／戻る'],
      ['Shift', '低速移動（当たり判定を表示）'],
      ['Esc', '一時停止'],
      ['Ctrl', '会話スキップ'],
      ['M', '音のオン／オフ'],
      ['タッチ', 'ドラッグで移動・自動ショット'],
    ];
    ctx.font = `13px ${FONT_JP}`;
    rows.forEach(([k, v], i) => {
      ctx.fillStyle = '#b8e0ff';
      ctx.fillText(k, 330, 122 + i * 21);
      ctx.fillStyle = '#ece6ff';
      ctx.fillText(v, 400, 122 + i * 21);
    });
    ctx.font = `700 15px ${FONT_JP}`;
    ctx.fillStyle = '#ffe8b0';
    ctx.fillText('― システム ―', 330, 300);
    ctx.font = `12px ${FONT_JP}`;
    ctx.fillStyle = '#ece6ff';
    const sys = [
      '当たり判定は自機の中心の小さな点だけ。',
      '弾にかすると「グレイズ」で得点が入ります。',
      '被弾直後にボムを押すと、喰らいボムで助かります。',
      '画面上部に行くとアイテムを自動回収。',
      '「点」アイテムを集めると残機が増えます。',
    ];
    sys.forEach((s, i) => ctx.fillText(s, 330, 324 + i * 19));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(220,210,255,0.8)';
    ctx.fillText(Input.isTouch ? 'タップで戻る' : 'Z / X で戻る', SCREEN_W / 2, 462);
  }
}

// ------------------------------------------------------------
//  オプション
// ------------------------------------------------------------
class OptionScene {
  constructor() {
    this.sel = 0;
    this.frame = 0;
    this.rects = [];
  }
  update() {
    this.frame++;
    menuBG().update();
    this.sel = menuMove(this.sel, 4);
    const tap = menuTapIndex(this.rects);
    let delta = 0;
    if (Input.repeat('left')) delta = -1;
    if (Input.repeat('right')) delta = 1;
    if (tap >= 0) {
      const t = Input.taps[0];
      this.sel = tap;
      if (tap < 3) delta = t.x > 400 ? 1 : -1;
    }
    if (delta && this.sel < 3) {
      Sound.se('cursor');
      if (this.sel === 0) Sound.setVolumes(clamp(Math.round((Sound.bgmVolume + delta * 0.1) * 10) / 10, 0, 1), Sound.seVolume);
      if (this.sel === 1) Sound.setVolumes(Sound.bgmVolume, clamp(Math.round((Sound.seVolume + delta * 0.1) * 10) / 10, 0, 1));
      if (this.sel === 2) { Settings.lives = clamp(Settings.lives + delta, 0, 5); Store.set('lives', Settings.lives); }
    }
    if ((this.sel === 3 && (Input.pressed('shot') || tap === 3)) || backPressed()) {
      Sound.se('cancel');
      Game.setScene(new TitleScene(4));
    }
  }
  draw(ctx) {
    menuBG().draw(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    drawHeading(ctx, 'オプション', 'Option');
    const items = ['BGM 音量', '効果音 音量', '初期残機', '戻る'];
    this.rects = drawMenuList(ctx, items, this.sel, 150, 150, 56, { size: 20, hitW: 420 });
    const vals = [`${Math.round(Sound.bgmVolume * 100)}%`, `${Math.round(Sound.seVolume * 100)}%`, `${Settings.lives}`];
    ctx.textAlign = 'center';
    vals.forEach((v, i) => {
      const on = i === this.sel;
      ctx.font = `700 20px ${FONT_EN}`;
      strokeText(ctx, `◀  ${v}  ▶`, 460, 150 + i * 56, on ? '#fff3c8' : '#a8a0cc', 'rgba(0,0,0,0.8)', 3);
    });
    ctx.font = `12px ${FONT_JP}`;
    ctx.fillStyle = 'rgba(220,210,255,0.8)';
    ctx.fillText('←→：変更　X：戻る', SCREEN_W / 2, 462);
    drawBackButton(ctx);
  }
}

// ------------------------------------------------------------
//  エンディング
// ------------------------------------------------------------
class EndingScene {
  constructor(g) {
    this.g = g;
    this.data = ENDINGS[g.charId];
    this.page = 0;
    this.frame = 0;
    this.pageFrame = 0;
  }
  enter() { Sound.playBgm('title'); }
  update() {
    this.frame++;
    this.pageFrame++;
    menuBG().update();
    const total = this.data.pages.length + 1;
    if ((Input.pressed('shot') || Input.anyTap()) && this.pageFrame > 30) {
      this.page++;
      this.pageFrame = 0;
      if (this.page >= total) Game.setScene(new ResultScene(this.g, 'clear'));
    }
  }
  draw(ctx) {
    menuBG().draw(ctx);
    ctx.fillStyle = 'rgba(0,0,10,0.45)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const a = Math.min(1, this.pageFrame / 30);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (this.page < this.data.pages.length) {
      drawPortrait(ctx, this.g.charId, 130, 372, 3, this.page === 2 ? 'smug' : 'normal', this.frame);
      if (this.page >= 1 && this.g.charId === 'marisa') drawPortrait(ctx, 'star', 510, 380, 2.6, this.page >= 3 ? 'happy' : 'normal', this.frame, true);
      ctx.font = `16px ${FONT_JP}`;
      const lines = this.data.pages[this.page].split('\n');
      lines.forEach((ln, i) => strokeText(ctx, ln, SCREEN_W / 2, 150 + (i - (lines.length - 1) / 2) * 32, '#f4f0ff', 'rgba(10,0,30,0.9)', 4));
    } else {
      ctx.font = `italic 700 20px ${FONT_EN}`;
      strokeText(ctx, `Ending No.${this.g.charId === 'reimu' ? 1 : 2}`, SCREEN_W / 2, 150, '#e8d8a8', 'rgba(0,0,0,0.8)', 3);
      ctx.font = `800 30px ${FONT_JP}`;
      strokeText(ctx, `「${this.data.title}」`, SCREEN_W / 2, 196, '#ffffff', 'rgba(60,20,120,0.9)', 4);
      ctx.font = `italic 600 22px ${FONT_EN}`;
      strokeText(ctx, 'Thank you for playing!', SCREEN_W / 2, 262, '#ffe8b0', 'rgba(0,0,0,0.8)', 3);
      ctx.font = `12px ${FONT_JP}`;
      ctx.fillStyle = '#d0c8f0';
      ctx.fillText('原作：東方Project（上海アリス幻樂団）', SCREEN_W / 2, 320);
      ctx.fillText('二次創作：tohounizisousaku', SCREEN_W / 2, 342);
    }
    ctx.globalAlpha = 1;
  }
}

// ------------------------------------------------------------
//  リザルト
// ------------------------------------------------------------
class ResultScene {
  constructor(g, kind) {
    this.g = g;
    this.kind = kind;
    this.frame = 0;
    this.newRecord = !g.practice && !g.cheat && g.score >= Store.get(g.hiKey, 0) && g.score > 0;
  }
  enter() { if (this.kind !== 'clear') Sound.playBgm('title'); }
  update() {
    this.frame++;
    menuBG().update();
    if ((Input.pressed('shot') || Input.anyTap()) && this.frame > 40) {
      Sound.se('ok');
      Game.setScene(new TitleScene());
    }
  }
  draw(ctx) {
    menuBG().draw(ctx);
    ctx.fillStyle = 'rgba(0,0,10,0.6)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const g = this.g;
    const title = { clear: 'All Clear!', practice: 'Practice Result', gameover: 'Game Over' }[this.kind];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `italic 700 36px ${FONT_EN}`;
    strokeText(ctx, title, SCREEN_W / 2, 64, this.kind === 'gameover' ? '#ff9aa8' : '#ffe8a0', 'rgba(0,0,0,0.8)', 4);
    const rows = [
      ['キャラクター', CHARA_INFO[g.charId].name],
      ['難易度', DIFF_NAMES[DIFF]],
      ['スコア', padScore(g.score)],
      ['到達ステージ', `Stage ${g.stageIndex + 1}`],
      ['ミス回数', String(g.misses)],
      ['ボム使用', String(g.bombsUsed)],
      ['スペルカード取得', `${g.spellsGot} / ${g.spellsSeen}`],
      ['グレイズ', String(g.graze)],
      ['コンティニュー', String(g.continues)],
    ];
    rows.forEach(([k, v], i) => {
      const y = 120 + i * 30;
      ctx.textAlign = 'left';
      ctx.font = `14px ${FONT_JP}`;
      ctx.fillStyle = '#d8d0ff';
      ctx.fillText(k, 170, y);
      ctx.textAlign = 'right';
      ctx.font = `700 18px ${FONT_JP}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(v, 470, y);
    });
    if (this.newRecord) {
      ctx.textAlign = 'center';
      ctx.font = `800 18px ${FONT_JP}`;
      strokeText(ctx, '★ ハイスコア更新！ ★', SCREEN_W / 2, 408, '#ffe070', 'rgba(0,0,0,0.8)', 3);
    }
    ctx.textAlign = 'center';
    ctx.font = `12px ${FONT_JP}`;
    ctx.fillStyle = 'rgba(220,210,255,0.8)';
    ctx.fillText(Input.isTouch ? 'タップでタイトルへ' : 'Z でタイトルへ', SCREEN_W / 2, 456);
  }
}
