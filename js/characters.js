'use strict';
// ============================================================
//  キャラクター描画（すべてキャンバスのパスで描く）
//  原点は胴体の中心。頭の中心は (0,-18)、全高はおよそ 56px。
// ============================================================

const CHARA_INFO = {
  reimu: { name: '博麗 霊夢', title: '楽園の素敵な巫女', color: '#ff5a6a' },
  marisa: { name: '霧雨 魔理沙', title: '普通の魔法使い', color: '#ffd860' },
  rumia: { name: 'ルーミア', title: '宵闇の妖怪', color: '#ffe070' },
  daiyousei: { name: '大妖精', title: '湖に棲む妖精', color: '#7ae08a' },
  cirno: { name: 'チルノ', title: '湖上の氷精', color: '#7ad0ff' },
  star: { name: 'スターサファイア', title: '降り注ぐ星の光', color: '#8aa8ff' },
  // 提供画像のキャラクター（名前は未定なので「？？？」）
  // image：カットイン・立ち絵用の原画、dot：ゲーム中のドット絵
  boss3: { name: '？？？', title: '？？？', color: '#ecdcb8', image: 'boss3', dot: 'boss3Dot' },
  boss4: { name: '？？？', title: '？？？', color: '#7aa0ff', image: 'boss4', dot: 'boss4Dot' },
};

const CHARA = {
  reimu: {
    skin: '#ffe9dc', hair: '#4a2a1e', hairDark: '#361c14', hairHi: '#8a5a42', eye: '#b3262c',
    back: 'long', dress: '#d61f2c', top: '#d61f2c', trim: '#ffffff', collar: '#ffffff', neck: '#f2cf3a',
    sleeve: 'detached', legs: '#ffffff', shoes: '#6a3a24', acc: 'reimuBow', tubes: true,
  },
  marisa: {
    skin: '#ffe9dc', hair: '#f5d65c', hairDark: '#d8b440', hairHi: '#fff4b0', eye: '#d69a1c',
    back: 'long', dress: '#22202c', top: '#22202c', trim: '#ffffff', collar: '#ffffff', apron: '#ffffff',
    neck: '#ffffff', sleeve: 'puff', legs: '#ffffff', shoes: '#3a2a20', acc: 'witchHat', braid: true,
  },
  rumia: {
    skin: '#ffe9dc', hair: '#f5dc6a', hairDark: '#d8bc48', hairHi: '#fff6b8', eye: '#d0202e',
    back: 'short', dress: '#1f1b26', top: '#1f1b26', vest: true, shirt: '#ffffff', trim: '#3a3444',
    collar: '#ffffff', tie: '#d0202e', sleeve: 'long', sleeveColor: '#ffffff', legs: '#1f1b26', shoes: '#3a1a1a',
    acc: 'redRibbon', pose: 'spread',
  },
  cirno: {
    skin: '#ffeee4', hair: '#6cb6ff', hairDark: '#4a90e0', hairHi: '#c8e8ff', eye: '#3264e6',
    back: 'short', dress: '#3572e6', top: '#3572e6', trim: '#ffffff', collar: '#ffffff', neck: '#e02838',
    sleeve: 'puff', legs: '#ffffff', shoes: '#28408a', acc: 'bigBow', wings: 'ice',
  },
  daiyousei: {
    skin: '#ffeee4', hair: '#5ccf6e', hairDark: '#3ea850', hairHi: '#c0f5c8', eye: '#2f8c44',
    back: 'sidetail', dress: '#3a62cc', top: '#3a62cc', trim: '#ffffff', collar: '#ffffff', neck: '#f2d23a',
    sleeve: 'puff', legs: '#ffffff', shoes: '#28408a', acc: 'yellowBow', wings: 'fairy',
  },
  star: {
    skin: '#ffeee4', hair: '#2c2640', hairDark: '#1c182c', hairHi: '#6a5c9a', eye: '#3a5ed6',
    back: 'longStraight', dress: '#2a4cc4', top: '#2a4cc4', trim: '#ffffff', collar: '#ffffff', neck: '#f2d23a',
    sleeve: 'puff', legs: '#ffffff', shoes: '#1c2a6a', acc: 'starRibbon', wings: 'fairy',
  },
};

function ell(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}

function drawBigBow(ctx, x, y, color, edge, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  for (const side of [-1, 1]) {
    ctx.fillStyle = edge;
    ell(ctx, side * 8.5, -1, 10, 6.8, side * -0.35); ctx.fill();
    ctx.fillStyle = color;
    ell(ctx, side * 8.2, -1, 8.6, 5.6, side * -0.35); ctx.fill();
    // たれ
    ctx.beginPath();
    ctx.moveTo(side * 1.5, 1); ctx.lineTo(side * 7, 10); ctx.lineTo(side * 4, 10.5); ctx.lineTo(side * 0.5, 2);
    ctx.fill();
  }
  ctx.fillStyle = edge;
  ell(ctx, 0, 0, 3, 3.2); ctx.fill();
  ctx.fillStyle = color;
  ell(ctx, 0, 0, 2.2, 2.4); ctx.fill();
  ctx.restore();
}

function drawSmallBow(ctx, x, y, color, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(side * 5, -3.5); ctx.lineTo(side * 5.5, 3); ctx.closePath(); ctx.fill();
  }
  ell(ctx, 0, 0, 1.6, 1.8); ctx.fill();
  ctx.restore();
}

function drawFairyWings(ctx, t, color, s = 1) {
  const flap = 0.6 + 0.4 * Math.abs(Math.sin(t * 0.22));
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 0.8;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side * flap * s, s);
    ell(ctx, 11, -12, 11, 5.5, -0.55); ctx.fill(); ctx.stroke();
    ell(ctx, 9, -1, 8, 4, 0.45); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawIceWings(ctx, t) {
  const tw = Math.sin(t * 0.1) * 0.08;
  ctx.save();
  ctx.lineWidth = 0.9;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const bx = side * 6, by = -10 + i * 5;
      const len = 14 - i * 2.5;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(side > 0 ? -0.5 + i * 0.45 + tw : Math.PI + 0.5 - i * 0.45 - tw);
      ctx.fillStyle = 'rgba(170,232,255,0.7)';
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(2, 0); ctx.lineTo(len * 0.55, -3.2); ctx.lineTo(len, 0); ctx.lineTo(len * 0.55, 3.2); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawBackHair(ctx, s) {
  ctx.fillStyle = s.hairDark;
  ctx.beginPath();
  switch (s.back) {
    case 'long':
      ctx.moveTo(-11, -22);
      ctx.bezierCurveTo(-15, -6, -15, 4, -13, 12);
      ctx.quadraticCurveTo(-8.5, 9, -4.5, 12.5);
      ctx.quadraticCurveTo(0, 9.5, 4.5, 12.5);
      ctx.quadraticCurveTo(8.5, 9, 13, 12);
      ctx.bezierCurveTo(15, 4, 15, -6, 11, -22);
      ctx.closePath();
      break;
    case 'longStraight':
      ctx.moveTo(-11, -22);
      ctx.lineTo(-13.5, 17);
      ctx.quadraticCurveTo(0, 20.5, 13.5, 17);
      ctx.lineTo(11, -22);
      ctx.closePath();
      break;
    case 'sidetail':
      ctx.ellipse(0, -17, 12.2, 11.5, 0, 0, TAU);
      ctx.moveTo(-10, -24);
      ctx.bezierCurveTo(-20, -22, -20, -8, -16, 0);
      ctx.quadraticCurveTo(-13, -6, -8, -16);
      ctx.closePath();
      break;
    default:
      ctx.ellipse(0, -16.5, 12.3, 12, 0, 0, TAU);
  }
  ctx.fill();
}

function drawEyes(ctx, s, face) {
  for (const side of [-1, 1]) {
    const x = side * 4;
    if (face === 'happy') {
      ctx.strokeStyle = '#3a2020';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(x, -15.2, 2.2, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      continue;
    }
    const h = face === 'surprised' ? 3.7 : 3.1;
    ctx.fillStyle = '#2a1818';
    ell(ctx, x, -16.2, 2.45, h + 0.4); ctx.fill();
    ctx.fillStyle = s.eye;
    ell(ctx, x, -15.9, 1.9, h - 0.25); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ell(ctx, x, -17.2, 1.9, 1.3); ctx.fill();
    ctx.fillStyle = '#fff';
    ell(ctx, x - side * 0.2 - 0.6, -17.3, 0.85, 1.05); ctx.fill();
    if (face === 'smug') {
      ctx.fillStyle = s.skin;
      ctx.fillRect(x - 2.8, -20.8, 5.6, 3.6);
      ctx.strokeStyle = '#2a1818';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - 2.6, -17.2); ctx.lineTo(x + 2.6, -17.2); ctx.stroke();
    }
  }
  if (face === 'angry' || face === 'sad') {
    ctx.strokeStyle = s.hairDark;
    ctx.lineWidth = 1.2;
    for (const side of [-1, 1]) {
      const inner = face === 'angry' ? -20.4 : -21.8;
      const outer = face === 'angry' ? -22 : -20.6;
      ctx.beginPath();
      ctx.moveTo(side * 1.8, inner);
      ctx.lineTo(side * 6, outer);
      ctx.stroke();
    }
  }
}

function drawMouth(ctx, face) {
  ctx.strokeStyle = '#8a3030';
  ctx.fillStyle = '#b0303c';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  switch (face) {
    case 'happy':
      ctx.arc(0, -12.4, 2, 0, Math.PI); ctx.closePath(); ctx.fill();
      break;
    case 'surprised':
      ell(ctx, 0, -11.8, 1.2, 1.6); ctx.fill();
      break;
    case 'angry':
      ctx.moveTo(-1.8, -11.5); ctx.lineTo(0, -12.1); ctx.lineTo(1.8, -11.5); ctx.stroke();
      break;
    case 'sad':
      ctx.arc(0, -10.6, 1.6, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
      break;
    case 'smug':
      ctx.moveTo(-1.6, -12.2); ctx.quadraticCurveTo(0.5, -11, 2, -12.8); ctx.stroke();
      break;
    default:
      ctx.arc(0, -12.6, 1.5, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
  }
}

function drawArms(ctx, s, pose) {
  const sleeve = s.sleeveColor || '#ffffff';
  for (const side of [-1, 1]) {
    if (pose === 'spread') {
      ctx.strokeStyle = sleeve;
      ctx.lineWidth = 4.2;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(side * 5, -5.5); ctx.lineTo(side * 18, -7); ctx.stroke();
      ctx.fillStyle = s.skin;
      ell(ctx, side * 20.5, -7.2, 2, 2); ctx.fill();
      continue;
    }
    if (s.sleeve === 'detached') {
      ctx.fillStyle = s.skin;
      ell(ctx, side * 6.5, -6, 2.2, 2.4); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#d8d8e6';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(side * 6.5, -4); ctx.lineTo(side * 9.5, -5);
      ctx.lineTo(side * 15, 8); ctx.lineTo(side * 7.5, 8); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#d61f2c';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(side * 6.8, -3.6); ctx.lineTo(side * 9.6, -4.6); ctx.stroke();
      ctx.fillStyle = s.skin;
      ell(ctx, side * 10.5, 8.4, 1.8, 1.8); ctx.fill();
    } else {
      ctx.strokeStyle = s.sleeve === 'long' ? sleeve : s.top;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(side * 6.5, -5); ctx.lineTo(side * 8.5, 4); ctx.stroke();
      if (s.sleeve === 'puff') {
        ctx.fillStyle = sleeve;
        ell(ctx, side * 7, -5.5, 3.3, 3); ctx.fill();
      }
      ctx.fillStyle = s.skin;
      ell(ctx, side * 8.7, 5.5, 1.7, 1.7); ctx.fill();
    }
  }
}

function drawChibi(ctx, id, o = {}) {
  const s = CHARA[id];
  const t = o.t || 0;
  const face = o.face || 'normal';
  const pose = o.pose || s.pose || 'stand';
  ctx.save();
  ctx.translate(0, Math.sin(t * 0.07) * 0.8);

  if (s.wings === 'fairy') drawFairyWings(ctx, t, 'rgba(190,225,255,0.42)');
  if (s.wings === 'ice') drawIceWings(ctx, t);
  drawBackHair(ctx, s);
  if (s.acc === 'reimuBow') drawBigBow(ctx, 0, -31, '#d61f2c', '#ffffff', 1);
  if (s.acc === 'bigBow') drawBigBow(ctx, 0, -30, '#3a6ef0', '#dff4ff', 0.95);

  // 脚
  ctx.fillStyle = s.legs;
  ctx.fillRect(-5, 13, 3, 9);
  ctx.fillRect(2, 13, 3, 9);
  ctx.fillStyle = s.shoes;
  ell(ctx, -3.5, 22.3, 2.6, 1.6); ctx.fill();
  ell(ctx, 3.5, 22.3, 2.6, 1.6); ctx.fill();

  // スカート
  ctx.fillStyle = s.dress;
  ctx.beginPath();
  ctx.moveTo(-5.5, 1);
  ctx.lineTo(5.5, 1);
  ctx.quadraticCurveTo(10, 8, 12.5, 16);
  ctx.quadraticCurveTo(6, 18.6, 0, 17.6);
  ctx.quadraticCurveTo(-6, 18.6, -12.5, 16);
  ctx.quadraticCurveTo(-10, 8, -5.5, 1);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.moveTo(2, 2); ctx.quadraticCurveTo(8, 9, 10, 16.6); ctx.lineTo(5, 17.6); ctx.quadraticCurveTo(5, 9, 2, 2);
  ctx.fill();
  if (s.apron) {
    ctx.fillStyle = s.apron;
    ctx.beginPath();
    ctx.moveTo(-4.8, 2); ctx.lineTo(4.8, 2); ctx.lineTo(7.2, 15.5);
    ctx.quadraticCurveTo(0, 17.5, -7.2, 15.5); ctx.closePath();
    ctx.fill();
  }
  if (s.trim) {
    ctx.strokeStyle = s.trim;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(12.5, 16); ctx.quadraticCurveTo(6, 18.6, 0, 17.6); ctx.quadraticCurveTo(-6, 18.6, -12.5, 16);
    ctx.stroke();
  }

  // 上半身
  ctx.fillStyle = s.top;
  ctx.beginPath();
  ctx.moveTo(-6.5, -7.5); ctx.lineTo(6.5, -7.5); ctx.lineTo(5.5, 2); ctx.lineTo(-5.5, 2); ctx.closePath();
  ctx.fill();
  if (s.vest) {
    ctx.fillStyle = s.shirt;
    ctx.beginPath();
    ctx.moveTo(-3, -7.5); ctx.lineTo(3, -7.5); ctx.lineTo(1.4, 2); ctx.lineTo(-1.4, 2); ctx.closePath();
    ctx.fill();
  }
  drawArms(ctx, s, pose);
  ctx.fillStyle = s.collar;
  ctx.beginPath();
  ctx.moveTo(-5.2, -8.5); ctx.lineTo(5.2, -8.5); ctx.lineTo(3.2, -4); ctx.lineTo(0, -5.6); ctx.lineTo(-3.2, -4);
  ctx.closePath();
  ctx.fill();
  if (s.tie) {
    ctx.fillStyle = s.tie;
    ctx.beginPath(); ctx.moveTo(-1.2, -5.5); ctx.lineTo(1.2, -5.5); ctx.lineTo(1.6, 0.5); ctx.lineTo(0, 2); ctx.lineTo(-1.6, 0.5);
    ctx.closePath(); ctx.fill();
  } else if (s.neck) {
    drawSmallBow(ctx, 0, -5.4, s.neck, 0.6);
  }

  // 頭
  ctx.fillStyle = s.skin;
  ell(ctx, 0, -18, 10, 10.5); ctx.fill();
  ctx.fillStyle = 'rgba(255,120,140,0.33)';
  ell(ctx, -6.4, -13.2, 2.2, 1.2); ctx.fill();
  ell(ctx, 6.4, -13.2, 2.2, 1.2); ctx.fill();
  drawEyes(ctx, s, face);
  drawMouth(ctx, face);

  // 前髪
  ctx.fillStyle = s.hair;
  ctx.beginPath();
  ctx.arc(0, -18.5, 11.5, Math.PI * 0.95, Math.PI * 2.05);
  ctx.lineTo(9, -13); ctx.lineTo(7.5, -18.5); ctx.lineTo(5, -14.2); ctx.lineTo(3, -19.6);
  ctx.lineTo(0.5, -15); ctx.lineTo(-2, -19.6); ctx.lineTo(-4.5, -14.2); ctx.lineTo(-7, -18.5); ctx.lineTo(-9, -13);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = s.hairHi;
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.arc(0, -19, 8.3, Math.PI * 1.15, Math.PI * 1.55); ctx.stroke();
  // もみあげ
  ctx.fillStyle = s.hair;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 9.5, -20);
    ctx.quadraticCurveTo(side * 13, -11, side * 11, -3);
    ctx.quadraticCurveTo(side * 9.5, -8, side * 8.2, -14);
    ctx.closePath();
    ctx.fill();
    if (s.tubes) {
      ctx.fillStyle = '#f6ecc4';
      ctx.fillRect(side * 11.2 - 1.6, -10, 3.2, 4.2);
      ctx.fillStyle = '#d61f2c';
      ctx.fillRect(side * 11.2 - 1.6, -8.4, 3.2, 1);
      ctx.fillStyle = s.hair;
    }
  }
  if (s.braid) {
    ctx.fillStyle = s.hair;
    for (let i = 0; i < 4; i++) { ell(ctx, -11.5 + i * 0.3, -6 + i * 3.2, 2, 1.9); ctx.fill(); }
    drawSmallBow(ctx, -10.6, 7, '#ffffff', 0.45);
  }

  // 頭の飾り
  switch (s.acc) {
    case 'witchHat': drawWitchHat(ctx); break;
    case 'redRibbon': drawSmallBow(ctx, -8.5, -27, '#d0202e', 0.75); break;
    case 'yellowBow': drawSmallBow(ctx, -11, -23, '#f2d23a', 0.8); break;
    case 'starRibbon':
      drawSmallBow(ctx, 0, -29, '#2a4cc4', 0.9);
      ctx.save(); ctx.translate(0, -29); ctx.fillStyle = '#ffe45a'; starPath(ctx, 2.8, 1.2); ctx.fill(); ctx.restore();
      break;
  }
  ctx.restore();
}

function drawWitchHat(ctx) {
  ctx.fillStyle = '#18161e';
  ell(ctx, 0, -27, 18.5, 4.8, -0.06); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-9, -28.5);
  ctx.quadraticCurveTo(-5, -41, 1, -48);
  ctx.quadraticCurveTo(7, -53, 13.5, -47.5);
  ctx.quadraticCurveTo(7.5, -46.5, 5.5, -41);
  ctx.quadraticCurveTo(7.5, -34, 9, -28.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-9, -28.5); ctx.quadraticCurveTo(0, -30, 9, -28.5);
  ctx.lineTo(8.4, -31.6); ctx.quadraticCurveTo(0, -33, -8.4, -31.6); ctx.closePath();
  ctx.fill();
  drawSmallBow(ctx, 8.6, -30, '#ffffff', 0.65);
}

// 自機（後ろ姿）
function drawPlayerBack(ctx, id, t, tilt) {
  ctx.save();
  ctx.transform(1, 0, -tilt * 0.14, 1, 0, 0);
  const sway = Math.sin(t * 0.15);
  if (id === 'reimu') {
    for (const side of [-1, 1]) {
      const out = side * (14 - tilt * side * 2.5);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#cfd0e0';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(side * 5.5, -5); ctx.lineTo(side * 9, -6);
      ctx.lineTo(out, 8 + sway); ctx.lineTo(side * 7, 8); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#d61f2c';
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(side * 5.8, -4.6); ctx.lineTo(side * 9, -5.6); ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-5, 12, 3, 8); ctx.fillRect(2, 12, 3, 8);
    ctx.fillStyle = '#d61f2c';
    ctx.beginPath();
    ctx.moveTo(-5.5, 0); ctx.lineTo(5.5, 0); ctx.lineTo(11, 14);
    ctx.quadraticCurveTo(0, 16.5, -11, 14); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(11, 14); ctx.quadraticCurveTo(0, 16.5, -11, 14); ctx.stroke();
    ctx.fillStyle = '#d61f2c';
    ctx.fillRect(-6, -7, 12, 8);
    // 髪
    ctx.fillStyle = '#3e2218';
    ctx.beginPath();
    ctx.moveTo(-9.5, -18);
    ctx.bezierCurveTo(-12, -8, -12, 0, -10, 7);
    ctx.quadraticCurveTo(-5, 4.5 + sway, 0, 7.5);
    ctx.quadraticCurveTo(5, 4.5 - sway, 10, 7);
    ctx.bezierCurveTo(12, 0, 12, -8, 9.5, -18);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a2a1e';
    ell(ctx, 0, -17, 10, 10); ctx.fill();
    ctx.strokeStyle = '#7a4a36'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, -17, 7.5, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
    drawBigBow(ctx, 0, -24, '#d61f2c', '#ffffff', 0.95);
  } else {
    for (const side of [-1, 1]) {
      ctx.strokeStyle = '#22202c'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(side * 6, -4); ctx.lineTo(side * (9 - tilt * side), 5); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ell(ctx, side * 6.8, -4.5, 3.2, 3); ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-5, 12, 3, 8); ctx.fillRect(2, 12, 3, 8);
    ctx.fillStyle = '#22202c';
    ctx.beginPath();
    ctx.moveTo(-5.5, 0); ctx.lineTo(5.5, 0); ctx.lineTo(11.5, 14);
    ctx.quadraticCurveTo(0, 16.5, -11.5, 14); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(11.5, 14); ctx.quadraticCurveTo(0, 16.5, -11.5, 14); ctx.stroke();
    ctx.fillStyle = '#22202c';
    ctx.fillRect(-6, -7, 12, 8);
    // エプロンのリボン
    ctx.fillStyle = '#ffffff';
    ell(ctx, -4.2, 5.5, 3.4, 2.1); ctx.fill();
    ell(ctx, 4.2, 5.5, 3.4, 2.1); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-1.2, 6); ctx.lineTo(-3.5, 12.5 + sway); ctx.lineTo(-1.8, 12.5 + sway); ctx.lineTo(0, 6.5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(1.2, 6); ctx.lineTo(3.5, 12.5 - sway); ctx.lineTo(1.8, 12.5 - sway); ctx.lineTo(0, 6.5); ctx.fill();
    ell(ctx, 0, 5.8, 1.6, 1.6); ctx.fill();
    // 髪
    ctx.fillStyle = '#e8c850';
    ctx.beginPath();
    ctx.moveTo(-8.5, -18);
    ctx.bezierCurveTo(-11, -8, -10.5, -2, -9, 3);
    ctx.quadraticCurveTo(-4.5, 0.5 + sway, 0, 3.5);
    ctx.quadraticCurveTo(4.5, 0.5 - sway, 9, 3);
    ctx.bezierCurveTo(10.5, -2, 11, -8, 8.5, -18);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,245,190,0.7)';
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(-3, -12); ctx.quadraticCurveTo(-4, -4, -3, 1); ctx.moveTo(3, -12); ctx.quadraticCurveTo(4, -4, 3, 1); ctx.stroke();
    // 三つ編み
    ctx.fillStyle = '#e8c850';
    for (let i = 0; i < 3; i++) { ell(ctx, -9.5 - i * 0.3, -6 + i * 3, 1.8, 1.7); ctx.fill(); }
    // 帽子
    ctx.fillStyle = '#18161e';
    ell(ctx, 0, -21, 18, 6.5, tilt * 0.08); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-8.5, -23);
    ctx.quadraticCurveTo(-4, -35, 2, -41);
    ctx.quadraticCurveTo(8, -45 + sway, 13, -40);
    ctx.quadraticCurveTo(7, -39, 5.5, -34);
    ctx.quadraticCurveTo(7.5, -28, 8.5, -23);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-8.5, -23); ctx.quadraticCurveTo(0, -21, 8.5, -23);
    ctx.lineTo(8, -26); ctx.quadraticCurveTo(0, -24.4, -8, -26); ctx.closePath(); ctx.fill();
    drawSmallBow(ctx, 0, -24.5, '#ffffff', 0.8);
  }
  ctx.restore();
}

// ------------------------------------------------------------
//  ザコ敵
// ------------------------------------------------------------
const FAIRY_COLORS = {
  blue: { hair: '#f2e48a', dress: '#3a66e0' },
  red: { hair: '#f7c08a', dress: '#d8303a' },
  green: { hair: '#e8f0a0', dress: '#2e9e4a' },
  yellow: { hair: '#fff0c0', dress: '#e0a820' },
  purple: { hair: '#f0d8ff', dress: '#8a42d0' },
  white: { hair: '#c8d8ff', dress: '#e8e8f4' },
};

function drawFairy(ctx, color, t, big = false) {
  const c = FAIRY_COLORS[color] || FAIRY_COLORS.blue;
  ctx.save();
  if (big) ctx.scale(1.5, 1.5);
  ctx.translate(0, Math.sin(t * 0.12) * 1.2);
  drawFairyWings(ctx, t, 'rgba(200,230,255,0.45)', 0.62);
  ctx.fillStyle = c.dress;
  ctx.beginPath();
  ctx.moveTo(-3.2, -2); ctx.lineTo(3.2, -2); ctx.lineTo(7, 9); ctx.quadraticCurveTo(0, 11, -7, 9);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(7, 9); ctx.quadraticCurveTo(0, 11, -7, 9); ctx.stroke();
  ctx.fillStyle = '#ffe9dc';
  ell(ctx, -4.6, 2, 1.4, 1.4); ctx.fill();
  ell(ctx, 4.6, 2, 1.4, 1.4); ctx.fill();
  ell(ctx, 0, -7, 5.6, 5.6); ctx.fill();
  ctx.fillStyle = c.hair;
  ctx.beginPath();
  ctx.arc(0, -7.5, 6.4, Math.PI * 0.9, Math.PI * 2.1);
  ctx.lineTo(4, -5.5); ctx.lineTo(2, -8.2); ctx.lineTo(0, -6); ctx.lineTo(-2, -8.2); ctx.lineTo(-4, -5.5);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1a1a2a';
  ell(ctx, -2.2, -5.5, 0.9, 1.3); ctx.fill();
  ell(ctx, 2.2, -5.5, 0.9, 1.3); ctx.fill();
  ctx.restore();
}

const KEDAMA_COLORS = { white: '#f4f0ff', blue: '#8ab8ff', red: '#ff9a9a', green: '#9aeea0', purple: '#d0a0ff' };

function drawKedama(ctx, color, t) {
  const col = KEDAMA_COLORS[color] || KEDAMA_COLORS.white;
  ctx.save();
  ctx.rotate(t * 0.05);
  ctx.fillStyle = col;
  ctx.beginPath();
  const n = 16;
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * TAU;
    const r = i % 2 === 0 ? 10.5 : 7.5;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 9);
  g.addColorStop(0, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(0,0,40,0.25)');
  ctx.fillStyle = g;
  ell(ctx, 0, 0, 8, 8); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ell(ctx, -2.8, -1, 2.2, 2.6); ctx.fill();
  ell(ctx, 2.8, -1, 2.2, 2.6); ctx.fill();
  ctx.fillStyle = '#222';
  ell(ctx, -2.5, -0.6, 1.1, 1.5); ctx.fill();
  ell(ctx, 2.5, -0.6, 1.1, 1.5); ctx.fill();
}

// 立ち絵（会話・カットイン用）
function drawPortrait(ctx, id, x, y, scale, face = 'normal', t = 0, flip = false) {
  ctx.save();
  ctx.translate(x, y);
  const image = CHARA_INFO[id] && CHARA_INFO[id].image;
  if (image) {
    // 画像のキャラクターは原画をそのまま使う（ドット絵にはしない）
    if (flip) ctx.scale(-1, 1);
    drawImageSprite(ctx, image, scale * 56, 0.5, 0.55);
  } else {
    ctx.scale(flip ? -scale : scale, scale);
    drawChibi(ctx, id, { t, face, pose: 'stand' });
  }
  ctx.restore();
}
