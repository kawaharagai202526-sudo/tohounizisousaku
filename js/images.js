'use strict';
// ============================================================
//  画像（img/ フォルダのPNG）
//  PNGを差し替えれば見た目を変えられる。
//  読み込みが終わるまで get() は null を返すので、呼び出し側は図形で代わりに描く。
// ============================================================

const IMAGE_FILES = {
  footFairy: 'img/foot_fairy.png', // 各面でいちばん弱い妖精
  player: 'img/player.png',        // ゲーム中の霊夢
  reimu: 'img/reimu.png',          // 霊夢の原画（キャラクター選択・ボムのカットイン・会話・エンディング）
  marisaPlayer: 'img/marisa_player.png', // ゲーム中の魔理沙
  marisa: 'img/marisa.png',        // 魔理沙の原画（キャラクター選択・ボムのカットイン・会話・エンディング）
  midboss1: 'img/midboss1.png',    // 1面の中ボス
  ruri: 'img/boss4.png',           // 2面中ボス 瑠璃（原画。前のゲームの4面ボスと同じ絵）
  ruriDot: 'img/boss4_dot.png',    // 2面中ボス 瑠璃（ゲーム中のドット絵）
  hand: 'img/hand.png',            // 2面の道中のザコ（緑の手）
  handEye: 'img/hand_eye.png',     // 3面以降の道中のザコ（一つ目の手。面の zako で指定）
  // ボス（原画はスペルカードのカットインと会話、_dot はゲーム中のドット絵）
  nokiba: 'img/nokiba.png',        // 1面ボス 軒端 鬼乃
  nokibaDot: 'img/nokiba_dot.png',
  kuraishiro: 'img/kuraishiro.png',  // 2面ボス 喰代 守子
  kuraishiroDot: 'img/kuraishiro_dot.png',
  namesawa: 'img/namesawa.png',    // 3面中ボス・ボス 滑沢 瓢
  namesawaDot: 'img/namesawa_dot.png',
  midboss4: 'img/midboss4.png',    // 4面中ボス ？？？（赤いパーカーの子。2.1.0 では3面の中ボス）
  midboss4Dot: 'img/midboss4_dot.png',
  toganoo: 'img/toganoo.png',      // 4面ボス 栂尾 芯
  toganooDot: 'img/toganoo_dot.png',
  yanari: 'img/yanari.png',        // 5面中ボス・ボス、6面中ボス 家鳴 鳴音
  yanariDot: 'img/yanari_dot.png',
  zashiki: 'img/zashiki.png',      // 6面ボス 座敷 宿美
  zashikiDot: 'img/zashiki_dot.png',
};
// 使っていない絵（ファイルだけ残して読み込まない）：前のゲーム『東方星降夜』の img/boss3・midboss3（と _dot）、
// 2.0.0 まで2面中ボスだった img/midboss2（と _dot）

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
