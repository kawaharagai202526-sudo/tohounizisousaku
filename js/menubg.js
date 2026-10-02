'use strict';
// ============================================================
//  メインメニュー（タイトル・各メニュー・エンディング・リザルト）の背景
//  背景を変えるときは、このファイルの MenuBG を書きかえる。
//  update() で動かし、draw(ctx) で 640×480 の画面全体を塗る。menuBG() で全画面が同じものを共有する。
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
