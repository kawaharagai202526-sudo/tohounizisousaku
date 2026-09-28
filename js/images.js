'use strict';
// ============================================================
//  画像（img/ フォルダのPNG）
//  PNGを差し替えれば見た目を変えられる。
//  読み込みが終わるまで get() は null を返すので、呼び出し側は図形で代わりに描く。
// ============================================================

const IMAGE_FILES = {
  footFairy: 'img/foot_fairy.png', // 各面でいちばん弱い妖精
  player: 'img/player.png',        // ゲーム中の霊夢
  midboss1: 'img/midboss1.png',    // 1面の中ボス
  boss3: 'img/boss3.png',          // 3面ボス（カットイン用の原画）
  boss3Dot: 'img/boss3_dot.png',   // 3面ボス（ゲーム中のドット絵）
  boss4: 'img/boss4.png',          // 4面ボス（カットイン用の原画）
  boss4Dot: 'img/boss4_dot.png',   // 4面ボス（ゲーム中のドット絵）
};

const Images = {
  list: {},
  load() {
    for (const [key, src] of Object.entries(IMAGE_FILES)) {
      const img = new Image();
      img.src = src;
      this.list[key] = img;
    }
  },
  get(key) {
    const img = this.list[key];
    return img && img.complete && img.naturalWidth > 0 ? img : null;
  },
};
Images.load();

// 画像を高さ h で描く。(ax, ay) は画像内の基準点（0〜1の割合）で、ここが原点に来る
function drawImageSprite(ctx, key, h, ax = 0.5, ay = 0.5) {
  const img = Images.get(key);
  if (!img) return false;
  const w = (h * img.naturalWidth) / img.naturalHeight;
  ctx.drawImage(img, -w * ax, -h * ay, w, h);
  return true;
}
