'use strict';
// ============================================================
//  HUD（右側パネル・フィールド内表示）
// ============================================================

const TOUCH_BUTTONS = [
  { id: 'bomb', action: 'bomb', x: 432, y: 372, w: 92, h: 84, label: 'ボム' },
  { id: 'focus', action: 'focus', x: 532, y: 372, w: 92, h: 84, label: '低速', toggle: true },
  { id: 'pause', action: 'pause', x: 596, y: 22, w: 34, h: 30, label: 'II' },
];

let frameCanvas = null;
function getFrameCanvas() {
  if (frameCanvas) return frameCanvas;
  const S = 2;
  const c = makeCanvas(SCREEN_W * S, SCREEN_H * S);
  const x = c.getContext('2d');
  x.scale(S, S);
  const g = x.createLinearGradient(0, 0, SCREEN_W, SCREEN_H);
  g.addColorStop(0, '#1a1236');
  g.addColorStop(1, '#0d0a20');
  x.fillStyle = g;
  x.fillRect(0, 0, SCREEN_W, SCREEN_H);
  // 麻の葉文様
  const s = 26, h = s * Math.sqrt(3) / 2;
  x.strokeStyle = 'rgba(190,160,255,0.09)';
  x.lineWidth = 0.8;
  for (let row = -1; row < SCREEN_H / h + 1; row++) {
    for (let col = -1; col < SCREEN_W / s + 2; col++) {
      const ox = col * s + (row % 2 ? s / 2 : 0), oy = row * h;
      const tris = [
        [[ox, oy], [ox + s, oy], [ox + s / 2, oy + h]],
        [[ox + s / 2, oy + h], [ox + s, oy], [ox + s * 1.5, oy + h]],
      ];
      for (const t of tris) {
        const cx = (t[0][0] + t[1][0] + t[2][0]) / 3, cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
        x.beginPath();
        x.moveTo(t[0][0], t[0][1]); x.lineTo(t[1][0], t[1][1]); x.lineTo(t[2][0], t[2][1]); x.closePath();
        for (const v of t) { x.moveTo(cx, cy); x.lineTo(v[0], v[1]); }
        x.stroke();
      }
    }
  }
  x.clearRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
  x.strokeStyle = 'rgba(214,186,120,0.85)';
  x.lineWidth = 1.5;
  x.strokeRect(FIELD_X - 1, FIELD_Y - 1, FIELD_W + 2, FIELD_H + 2);
  x.strokeStyle = 'rgba(214,186,120,0.35)';
  x.lineWidth = 1;
  x.strokeRect(FIELD_X - 4.5, FIELD_Y - 4.5, FIELD_W + 9, FIELD_H + 9);
  frameCanvas = c;
  return c;
}

// 数字を等幅で描く
function drawDigits(ctx, str, x, y, cw, align = 'left') {
  const total = str.length * cw;
  let sx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
  ctx.textAlign = 'center';
  for (const ch of str) {
    ctx.fillText(ch, sx + cw / 2, y);
    sx += cw;
  }
}

function drawStarIcons(ctx, n, x, y, color, max = 8) {
  const shown = Math.min(n, max);
  for (let i = 0; i < max; i++) {
    ctx.fillStyle = i < shown ? color : 'rgba(255,255,255,0.08)';
    ctx.save();
    ctx.translate(x + i * 17, y);
    starPath(ctx, 7, 3);
    ctx.fill();
    if (i < shown) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawLogo(ctx, x, y, size = 30) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${size}px ${FONT_JP}`;
  ctx.shadowColor = 'rgba(160,140,255,0.9)';
  ctx.shadowBlur = 12;
  const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#c8b8ff');
  ctx.fillStyle = g;
  ctx.fillText('東方星降夜', x, y);
  ctx.shadowBlur = 0;
  ctx.font = `italic 600 ${Math.round(size * 0.46)}px ${FONT_EN}`;
  ctx.fillStyle = '#e8d8a8';
  ctx.fillText('〜 Night of Falling Stars.', x, y + size * 0.8);
  ctx.restore();
}

function drawSidePanel(ctx, g) {
  ctx.drawImage(getFrameCanvas(), 0, 0, SCREEN_W, SCREEN_H);
  const x0 = 434, vx = 626;
  ctx.textBaseline = 'middle';

  // 難易度
  ctx.font = `italic 700 22px ${FONT_EN}`;
  ctx.textAlign = 'center';
  strokeText(ctx, DIFF_NAMES[DIFF], 522, 38, DIFF_COLORS[DIFF], 'rgba(0,0,0,0.8)', 3);
  if (g.practice) {
    ctx.font = `12px ${FONT_JP}`;
    ctx.fillStyle = '#b8a8e0';
    ctx.fillText('― プラクティス ―', 522, 58);
  }

  const label = (t, y) => {
    ctx.font = `600 14px ${FONT_JP}`;
    ctx.textAlign = 'left';
    strokeText(ctx, t, x0, y, '#e8e0ff', 'rgba(0,0,0,0.8)', 3);
  };
  const value = (t, y, color = '#ffffff') => {
    ctx.font = `700 18px ${FONT_EN}`;
    ctx.fillStyle = color;
    drawDigits(ctx, t, vx, y, 10.5, 'right');
  };

  label('ハイスコア', 88); value(padScore(g.hiScore), 88, '#d8d0ff');
  label('スコア', 112); value(padScore(g.score), 112);

  label('残り人数', 150);
  drawStarIcons(ctx, Math.max(0, g.lives), 500, 150, '#ff6fb8');
  label('ボム', 176);
  drawStarIcons(ctx, g.bombs, 500, 176, '#6af09a');

  label('霊力', 214);
  if (g.power >= 400) {
    ctx.font = `italic 700 18px ${FONT_EN}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffe070';
    ctx.fillText('MAX', vx, 214);
  } else value(`${(g.power / 100).toFixed(2)}/4.00`, 214, '#ffb0b0');
  label('グレイズ', 238); value(String(g.graze), 238);
  label('点', 262);
  const next = EXTEND_POINTS[g.extendIdx];
  value(next ? `${g.pointItems}/${next}` : String(g.pointItems), 262, '#b0c8ff');

  if (Input.isTouch) {
    drawLogo(ctx, 528, 318, 22);
    for (const b of TOUCH_BUTTONS) {
      const on = b.toggle ? Input.virtual[b.action] : Input.held[b.action];
      ctx.fillStyle = on ? 'rgba(255,220,150,0.35)' : 'rgba(255,255,255,0.08)';
      ctx.strokeStyle = 'rgba(214,186,120,0.8)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(b.x, b.y, b.w, b.h, 8) : ctx.rect(b.x, b.y, b.w, b.h);
      ctx.fill(); ctx.stroke();
      ctx.font = `700 ${b.id === 'pause' ? 14 : 18}px ${FONT_JP}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
    }
  } else {
    drawLogo(ctx, 528, 404, 30);
  }

  ctx.font = `12px ${FONT_EN}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(220,210,255,0.6)';
  ctx.fillText(`${Game.fps.toFixed(1)}fps`, 634, 470);
  if (Sound.muted) {
    ctx.textAlign = 'left';
    ctx.fillText('♪ミュート中 (M)', 434, 470);
  }
}

// ------------------------------------------------------------
//  フィールド内
// ------------------------------------------------------------
function drawBossHud(ctx, g) {
  const b = g.boss;
  if (!b || !b.alive || !g.bossPhases) return;
  const ph = b.phase;
  ctx.textBaseline = 'middle';
  ctx.font = `bold 13px ${FONT_JP}`;
  ctx.textAlign = 'left';
  strokeText(ctx, b.name, 6, 10, '#ffffff', 'rgba(0,0,0,0.9)', 3);
  // 残りの攻撃数
  const remain = g.bossPhases.length - g.bossPhaseIdx - 1;
  const nameW = ctx.measureText(b.name).width;
  for (let i = 0; i < remain; i++) {
    ctx.fillStyle = '#ffd070';
    ctx.save(); ctx.translate(14 + nameW + i * 11, 10); starPath(ctx, 4.5, 2); ctx.fill(); ctx.restore();
  }
  // 体力
  if (ph && !ph.survival) {
    const w = FIELD_W - 60;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(6, 20, w, 4);
    const k = clamp(b.hp / b.maxHp, 0, 1);
    const grad = ctx.createLinearGradient(6, 0, 6 + w, 0);
    grad.addColorStop(0, '#ff8a8a');
    grad.addColorStop(1, '#ffffff');
    ctx.fillStyle = grad;
    ctx.fillRect(6, 20, w * k, 4);
  }
  // 残り時間
  if (ph) {
    const sec = Math.max(0, Math.ceil(b.timer / 60));
    ctx.font = `700 22px ${FONT_EN}`;
    ctx.textAlign = 'right';
    strokeText(ctx, String(sec).padStart(2, '0'), FIELD_W - 6, 18, sec <= 5 ? '#ff7070' : sec <= 10 ? '#ffd0a0' : '#ffffff', 'rgba(0,0,0,0.9)', 3);
  }
  // 敵の位置
  ctx.font = `bold 9px ${FONT_EN}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,60,90,0.85)';
  ctx.fillRect(b.x - 16, FIELD_H - 10, 32, 10);
  ctx.fillStyle = '#fff';
  ctx.fillText('ENEMY', b.x, FIELD_H - 4.5);
}

function drawSpellName(ctx, g) {
  const sp = g.spell;
  if (!sp) return;
  const f = sp.frame;
  // 中央下から右上へ移動
  const t = clamp((f - 50) / 40, 0, 1);
  const y = lerp(300, 40, Ease.inOutSine(t));
  ctx.font = `bold 14px ${FONT_JP}`;
  const w = ctx.measureText(sp.name).width;
  const x = FIELD_W - 8;
  // ボスや自機が重なっている時は薄くする
  const b = g.boss, p = g.player;
  const covered = t >= 1 && ((b && b.y < 118 && b.x > x - w - 70) || (p.y < 90 && p.x > x - w - 50));
  ctx.globalAlpha = Math.min(1, f / 15) * (covered ? 0.4 : 1);
  const grad = ctx.createLinearGradient(x - w - 40, 0, x, 0);
  grad.addColorStop(0, 'rgba(40,20,80,0)');
  grad.addColorStop(0.3, 'rgba(40,20,80,0.75)');
  grad.addColorStop(1, 'rgba(90,40,140,0.85)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - w - 40, y - 11, w + 46, 22);
  ctx.fillStyle = 'rgba(255,230,160,0.8)';
  ctx.fillRect(x - w - 20, y + 10, w + 26, 1);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  strokeText(ctx, sp.name, x, y, '#ffffff', 'rgba(60,0,60,0.9)', 3);
  if (t >= 1) {
    ctx.font = `600 11px ${FONT_EN}`;
    const bonus = g.spellFailed ? 'Failed' : padScore(g.spellBonus, 8);
    const hist = `History ${sp.history.got}/${sp.history.tried}`;
    strokeText(ctx, `Bonus ${bonus}   ${hist}`, x, y + 20, g.spellFailed ? '#a0a0b8' : '#ffe8b0', 'rgba(0,0,0,0.9)', 2.5);
  }
  ctx.globalAlpha = 1;
}

function drawCutin(ctx, g) {
  const c = g.cutin;
  if (!c) return;
  const f = c.frame;
  const a = f < 15 ? f / 15 : f > 70 ? Math.max(0, (90 - f) / 20) : 1;
  const x = lerp(FIELD_W + 60, 120, Ease.outCubic(Math.min(1, f / 30))) - Math.max(0, f - 30) * 0.6;
  ctx.save();
  ctx.globalAlpha = a * 0.3;
  ctx.fillStyle = `rgba(${CHARA_CUTIN_COLOR[c.id] || '200,200,255'},1)`;
  ctx.beginPath();
  ctx.moveTo(0, 120); ctx.lineTo(FIELD_W, 40); ctx.lineTo(FIELD_W, 300); ctx.lineTo(0, 380); ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = a * 0.85;
  drawPortrait(ctx, c.id, x + 100, 250, 4.2, 'smug', f);
  ctx.restore();
}
const CHARA_CUTIN_COLOR = { rumia: '120,20,60', cirno: '60,140,255', star: '90,90,230', daiyousei: '60,200,110' };

function drawStageTitle(ctx, g) {
  const st = g.stageTitle;
  if (!st || st.frame > 300) return;
  const f = st.frame;
  const a = f < 40 ? f / 40 : f > 240 ? (300 - f) / 60 : 1;
  ctx.globalAlpha = Math.max(0, a);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `italic 700 30px ${FONT_EN}`;
  strokeText(ctx, `Stage ${g.stageIndex + 1}`, FIELD_W / 2, 150, '#ffffff', 'rgba(40,20,90,0.9)', 4);
  ctx.font = `700 22px ${FONT_JP}`;
  strokeText(ctx, g.stage.name, FIELD_W / 2, 188, '#ffe8b0', 'rgba(40,20,90,0.9)', 4);
  ctx.font = `italic 600 15px ${FONT_EN}`;
  strokeText(ctx, g.stage.nameEn, FIELD_W / 2, 214, '#d8d0ff', 'rgba(0,0,0,0.8)', 3);
  ctx.globalAlpha = 1;
}

function drawBossTitle(ctx, g) {
  const bt = g.bossTitle;
  if (!bt || bt.frame > 200) return;
  const f = bt.frame;
  const a = f < 20 ? f / 20 : f > 160 ? (200 - f) / 40 : 1;
  const info = CHARA_INFO[bt.id];
  ctx.globalAlpha = Math.max(0, a);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = `600 13px ${FONT_JP}`;
  strokeText(ctx, info.title, FIELD_W - 18, 232, '#e0d8ff', 'rgba(0,0,0,0.9)', 3);
  ctx.font = `800 26px ${FONT_JP}`;
  strokeText(ctx, info.name, FIELD_W - 18, 260, info.color, 'rgba(0,0,0,0.9)', 4);
  ctx.globalAlpha = 1;
}

function drawMessages(ctx, g) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  g.messages.forEach((m, i) => {
    const a = m.frame < 10 ? m.frame / 10 : m.frame > m.life - 20 ? (m.life - m.frame) / 20 : 1;
    ctx.globalAlpha = Math.max(0, a);
    const y = 120 + i * 44;
    ctx.font = `italic 700 20px ${FONT_EN}`;
    strokeText(ctx, m.text, FIELD_W / 2, y, m.color, 'rgba(0,0,0,0.85)', 4);
    if (m.sub) {
      ctx.font = `700 16px ${FONT_EN}`;
      strokeText(ctx, m.sub, FIELD_W / 2, y + 20, '#ffffff', 'rgba(0,0,0,0.85)', 3);
    }
  });
  ctx.globalAlpha = 1;

  if (g.bgmTitle && g.bgmTitle.frame < 300) {
    const f = g.bgmTitle.frame;
    ctx.globalAlpha = f < 20 ? f / 20 : f > 240 ? (300 - f) / 60 : 1;
    ctx.font = `600 12px ${FONT_JP}`;
    ctx.textAlign = 'right';
    strokeText(ctx, '♪ ' + g.bgmTitle.text, FIELD_W - 8, g.dialogue ? 338 : FIELD_H - 20, '#e8e0ff', 'rgba(0,0,0,0.9)', 3);
    ctx.globalAlpha = 1;
  }
  if (g.bombName && g.bombName.frame < 150) {
    const f = g.bombName.frame;
    ctx.globalAlpha = f > 110 ? (150 - f) / 40 : Math.min(1, f / 10);
    ctx.font = `bold 14px ${FONT_JP}`;
    ctx.textAlign = 'left';
    const y = lerp(FIELD_H - 30, FIELD_H - 60, Ease.outCubic(Math.min(1, f / 20)));
    strokeText(ctx, g.bombName.text, 10, y, '#ffffff', 'rgba(120,20,80,0.9)', 3);
    ctx.globalAlpha = 1;
  }
  if (g.clearInfo) {
    const f = g.clearInfo.frame;
    ctx.globalAlpha = Math.min(1, f / 20);
    ctx.fillStyle = 'rgba(0,0,20,0.55)';
    ctx.fillRect(40, 150, FIELD_W - 80, 110);
    ctx.textAlign = 'center';
    ctx.font = `italic 700 28px ${FONT_EN}`;
    strokeText(ctx, 'Stage Clear!!', FIELD_W / 2, 182, '#ffe080', 'rgba(0,0,0,0.9)', 4);
    ctx.font = `600 14px ${FONT_JP}`;
    strokeText(ctx, 'クリアボーナス', FIELD_W / 2, 214, '#e0d8ff', 'rgba(0,0,0,0.9)', 3);
    ctx.font = `700 20px ${FONT_EN}`;
    ctx.fillStyle = '#fff';
    drawDigits(ctx, padScore(g.clearInfo.bonus), FIELD_W / 2, 238, 12, 'center');
    ctx.globalAlpha = 1;
  }
}

// 簡易メニュー（ポーズ・コンティニュー）
function drawFieldMenu(ctx, title, items, sel, sub) {
  ctx.fillStyle = 'rgba(0,0,10,0.78)';
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 24px ${FONT_JP}`;
  strokeText(ctx, title, FIELD_W / 2, 150, '#ffffff', 'rgba(60,20,120,0.9)', 4);
  if (sub) {
    ctx.font = `14px ${FONT_JP}`;
    ctx.fillStyle = '#d0c8f0';
    ctx.fillText(sub, FIELD_W / 2, 180);
  }
  items.forEach((it, i) => {
    const on = i === sel;
    ctx.font = `${on ? 700 : 500} 18px ${FONT_JP}`;
    strokeText(ctx, it, FIELD_W / 2 + (on ? 0 : 0), 226 + i * 36, on ? '#ffe8a0' : '#9890b8', 'rgba(0,0,0,0.9)', 3);
    if (on) {
      ctx.fillStyle = '#ffe8a0';
      const w = ctx.measureText(it).width;
      ctx.save(); ctx.translate(FIELD_W / 2 - w / 2 - 16, 226 + i * 36); starPath(ctx, 5, 2); ctx.fill(); ctx.restore();
    }
  });
}
// メニュー項目のタップ判定（フィールド座標で配置した項目を画面座標で判定）
function fieldMenuTap(count) {
  for (let i = 0; i < count; i++) {
    if (Input.tapIn(FIELD_X + 60, FIELD_Y + 226 + i * 36 - 16, FIELD_W - 120, 32)) return i;
  }
  return -1;
}
