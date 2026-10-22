'use strict';
// ============================================================
//  会話
//  行の書式: [話者ID, 表情, 台詞]
//  ト書き:   { narration: '文' }（話者なし。名前を出さずに文だけ出す）
//  演出:     { bgm: '曲ID' } / { title: 'キャラID' } / { event: '名前' }（背景の event(名前) を呼ぶ）
// ============================================================

// 立ち絵の大きさ（drawPortrait の scale。高さはおよそ scale×56px。会話の枠の後ろに足もとが隠れる）
const DIALOGUE_PORTRAIT_SCALE = 5;

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
    while (this.i < this.lines.length && !Array.isArray(this.lines[this.i]) && !this.lines[this.i].narration) {
      const a = this.lines[this.i];
      if (a.bgm) { Sound.playBgm(a.bgm); this.g.showBgmTitle(a.bgm); }
      if (a.title) this.g.bossTitle = { id: a.title, frame: 0 };
      if (a.event && this.g.bg && this.g.bg.event) this.g.bg.event(a.event);
      this.i++;
    }
    if (this.i >= this.lines.length) { this.done = true; return; }
    const line = this.lines[this.i];
    if (!Array.isArray(line)) {
      // ト書き：話者はいないので、立ち絵はどちらも少し暗くする
      this.who = null;
      this.text = line.narration;
      this.chars = 0;
      this.lineFrame = 0;
      return;
    }
    const [who, face, text] = line;
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
      drawPortrait(ctx, id, x + slide, active ? 296 : 304, DIALOGUE_PORTRAIT_SCALE, this.faces[id] || 'normal', t, flip);
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
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    if (this.who) {
      const info = CHARA_INFO[this.who] || { name: this.who, color: '#fff' };
      ctx.font = `bold 13px ${FONT_JP}`;
      strokeText(ctx, info.name, bx + 12, by + 8, info.color, 'rgba(0,0,0,0.9)', 3);
      // 読み仮名は名前の右に小さく
      if (info.kana) {
        const w = ctx.measureText(info.name).width;
        ctx.font = `10px ${FONT_JP}`;
        strokeText(ctx, `（${info.kana}）`, bx + 14 + w, by + 10, '#d8d0f0', 'rgba(0,0,0,0.9)', 2);
      }
    }
    ctx.font = `15px ${FONT_JP}`;
    ctx.fillStyle = this.who ? '#f4f0ff' : '#e8d8b0';
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
