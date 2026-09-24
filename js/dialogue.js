'use strict';
// ============================================================
//  会話
//  行の書式: [話者ID, 表情, 台詞]
//  演出:     { bgm: '曲ID' } / { title: 'キャラID' }
// ============================================================

class Dialogue {
  constructor(lines, g) {
    this.lines = lines;
    this.g = g;
    this.i = -1;
    this.done = false;
    this.frame = 0;
    this.faces = {};
    this.left = g.charId;
    this.right = null;
    this.alphaL = 0;
    this.alphaR = 0;
    this.next();
  }
  next() {
    this.i++;
    while (this.i < this.lines.length && !Array.isArray(this.lines[this.i])) {
      const a = this.lines[this.i];
      if (a.bgm) { Sound.playBgm(a.bgm); this.g.showBgmTitle(a.bgm); }
      if (a.title) this.g.bossTitle = { id: a.title, frame: 0 };
      this.i++;
    }
    if (this.i >= this.lines.length) { this.done = true; return; }
    const [who, face, text] = this.lines[this.i];
    this.who = who;
    this.text = text;
    this.chars = 0;
    this.lineFrame = 0;
    this.faces[who] = face;
    if (who !== this.left) this.right = who;
  }
  update() {
    if (this.done) return;
    this.frame++;
    this.lineFrame++;
    this.chars = Math.min(this.text.length, this.chars + 1.2);
    this.alphaL = Math.min(1, this.alphaL + 0.08);
    if (this.right) this.alphaR = Math.min(1, this.alphaR + 0.08);
    const skip = Input.down('skip');
    const advance = (Input.pressed('shot') || Input.anyTap()) && this.lineFrame > 6;
    if (advance || (skip && this.lineFrame > 3)) {
      if (this.chars < this.text.length && !skip) this.chars = this.text.length;
      else this.next();
    }
  }
  draw(ctx) {
    if (this.done) return;
    const t = this.frame;
    const drawChar = (id, x, alphaIn, flip) => {
      if (!id) return;
      const active = this.who === id;
      ctx.globalAlpha = alphaIn * (active ? 1 : 0.45);
      const slide = (1 - alphaIn) * 30 * (flip ? 1 : -1);
      drawPortrait(ctx, id, x + slide, active ? 318 : 326, 3.2, this.faces[id] || 'normal', t, flip);
      ctx.globalAlpha = 1;
    };
    // 話していない方を奥に
    if (this.who === this.left) { drawChar(this.right, 300, this.alphaR, true); drawChar(this.left, 84, this.alphaL, false); }
    else { drawChar(this.left, 84, this.alphaL, false); drawChar(this.right, 300, this.alphaR, true); }

    const bx = 14, by = 350, bw = FIELD_W - 28, bh = 86;
    ctx.fillStyle = 'rgba(8,6,24,0.8)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = 'rgba(210,190,140,0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 2.5, by + 2.5, bw - 5, bh - 5);
    const info = CHARA_INFO[this.who] || { name: this.who, color: '#fff' };
    ctx.font = `bold 13px ${FONT_JP}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    strokeText(ctx, info.name, bx + 12, by + 8, info.color, 'rgba(0,0,0,0.9)', 3);
    ctx.font = `15px ${FONT_JP}`;
    ctx.fillStyle = '#f4f0ff';
    const shown = this.text.slice(0, Math.floor(this.chars));
    const lines = wrapText(ctx, shown, bw - 30);
    lines.slice(0, 3).forEach((ln, i) => ctx.fillText(ln, bx + 14, by + 28 + i * 20));
    if (this.chars >= this.text.length) {
      ctx.fillStyle = `rgba(255,230,160,${0.5 + 0.5 * Math.sin(t * 0.2)})`;
      ctx.beginPath();
      ctx.moveTo(bx + bw - 18, by + bh - 16); ctx.lineTo(bx + bw - 10, by + bh - 16); ctx.lineTo(bx + bw - 14, by + bh - 10);
      ctx.fill();
    }
  }
}
