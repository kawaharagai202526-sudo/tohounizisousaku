#!/usr/bin/env python3
"""
キャラクターの画像から、ゲームで使うPNGを作る（3面・4面のボスの絵はこれで作った）

  原画      img/<名前>.png      背景を透明にして高さ440pxにしたもの（スペルカードのカットインと会話の立ち絵）
  ドット絵  img/<名前>_dot.png  縮小して減色・縁取りしたもの（ゲーム中に表示する絵）

使い方:
  python3 tools/make-sprite.py 画像ファイル 名前 [オプション]

  --crop x0,y0,x1,y1  画像の一部だけ使う（ピクセルで指定）
  --art 440           原画の高さ（0 なら原画を作らない）
  --dot 78            ドット絵の高さ（0 ならドット絵を作らない）。ボスは 72〜82 くらい
  --dark 0.28         ドット絵で線画を残す強さ（小さいほど線が太く残る）
  --colors 16         ドット絵の色数
  --keep-alpha        背景がすでに透明な PNG のとき（背景の切り抜きをしない）
  --preview 出力先     確認用に拡大した画像（暗い背景・緑の背景）も保存する

背景は「白っぽく、画像のふちとつながっている部分」を透明にする。白い背景の絵に向いている。
ほかの背景の絵は、あらかじめ背景を透明にした PNG を用意して --keep-alpha を付ける。

作ったあとは js/images.js の IMAGE_FILES に登録し、js/characters.js の CHARA_INFO に
image（原画のキー）と dot（ドット絵のキー）を書く。

必要なもの: Python 3、Pillow、numpy、scipy（pip install pillow numpy scipy）
"""
import argparse
import os

import numpy as np
from PIL import Image, ImageEnhance
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def cutout(rgb, gap=2):
    """白い背景のうち、画像のふちとつながっている部分を透明にする（髪のすき間などの白は残す）"""
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    bgpred = (rgb.min(axis=2) >= 238) & (sat < 16)
    # 線のすき間から背景が中へ流れ込まないよう、いったん細らせてからつながりを調べる
    seed = ndimage.binary_erosion(bgpred, iterations=gap, border_value=1)
    lab, _ = ndimage.label(seed)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = ndimage.binary_dilation(np.isin(lab, list(border)), iterations=gap) & bgpred
    alpha = np.where(bg, 0.0, 1.0)
    # ふちの白っぽい色はなめらかに透かす
    near = ndimage.binary_dilation(bg, iterations=3) & ~bg
    soft = near & (sat < 40)
    a = np.clip((240 - lum) / (240 - 150), 0, 1)
    alpha[soft] = np.minimum(alpha[soft], a[soft])
    return alpha


def drop_specks(alpha, min_area=40):
    """切り抜いたあとに残った小さなごみを消す"""
    lab, n = ndimage.label(alpha > 0.05)
    if n == 0:
        return alpha
    sizes = ndimage.sum(np.ones_like(alpha), lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= min_area])
    return np.where(keep, alpha, 0.0)


def crop_rgba(rgb, alpha, pad=4):
    """見えている部分だけを切り出す"""
    ys, xs = np.where(alpha > 0.05)
    y0, y1 = max(ys.min() - pad, 0), ys.max() + pad + 1
    x0, x1 = max(xs.min() - pad, 0), xs.max() + pad + 1
    return Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8)[y0:y1, x0:x1], 'RGBA')


def resize(im, h):
    w = round(im.width * h / im.height)
    return im.convert('RGBa').resize((w, h), Image.LANCZOS).convert('RGBA')


def pixelize(im, h, colors=16, outline=(20, 16, 36), k=6, dark_thresh=0.28):
    """縮小 → 線画を残す → 減色 → 1px の縁取りで、簡略化したドット絵にする"""
    w = round(im.width * h / im.height)
    big = np.array(im.convert('RGBa').resize((w * k, h * k), Image.LANCZOS).convert('RGBA')).astype(float)
    A = big[:, :, 3] / 255
    rgb = big[:, :, :3]

    def blk(x):
        return x.reshape(h, k, w, k, -1)

    rb, ab = blk(rgb), blk(A[..., None])
    wsum = ab.sum(axis=(1, 3))
    mean = (rb * ab).sum(axis=(1, 3)) / np.maximum(wsum, 1e-6)
    alpha = wsum[..., 0] / (k * k)
    # 暗い線が多いマスは、平均ではなく一番暗い色にして線を残す
    dark = ((rgb.mean(axis=2) < 85) & (A > 0.5)).astype(float)
    darkfrac = blk(dark[..., None]).mean(axis=(1, 3))[..., 0]
    mn = np.where(ab > 0.5, rb, 255).min(axis=(1, 3))
    col = np.where(darkfrac[..., None] > dark_thresh, mn, mean)
    a = alpha >= 0.45
    img = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8), 'RGB')
    img = ImageEnhance.Color(img).enhance(1.25)
    img = ImageEnhance.Contrast(img).enhance(1.12)
    q = img.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    arr = np.array(q)
    a = np.pad(a, 1)
    arr = np.pad(arr, ((1, 1), (1, 1), (0, 0)))
    edge = ndimage.binary_dilation(a, structure=[[0, 1, 0], [1, 1, 1], [0, 1, 0]]) & ~a
    out = np.zeros((arr.shape[0], arr.shape[1], 4), np.uint8)
    out[a, :3] = arr[a]
    out[a, 3] = 255
    out[edge, :3] = outline
    out[edge, 3] = 255
    return Image.fromarray(out, 'RGBA')


def save_preview(im, path, zoom):
    for bgc, tag in [((20, 14, 50), 'dark'), ((40, 90, 60), 'green')]:
        big = im.resize((im.width * zoom, im.height * zoom), Image.NEAREST)
        canvas = Image.new('RGBA', big.size, bgc + (255,))
        canvas.alpha_composite(big)
        canvas.save(f'{path}_{tag}.png')


def main():
    ap = argparse.ArgumentParser(description='キャラクターの画像から原画とドット絵のPNGを作る')
    ap.add_argument('src', help='元の画像ファイル')
    ap.add_argument('name', help='出力する名前（img/<名前>.png と img/<名前>_dot.png）')
    ap.add_argument('--crop', help='x0,y0,x1,y1')
    ap.add_argument('--art', type=int, default=440)
    ap.add_argument('--dot', type=int, default=78)
    ap.add_argument('--dark', type=float, default=0.28)
    ap.add_argument('--colors', type=int, default=16)
    ap.add_argument('--keep-alpha', action='store_true')
    ap.add_argument('--preview')
    ap.add_argument('--out', default=os.path.join(ROOT, 'img'))
    o = ap.parse_args()

    src = Image.open(o.src)
    if o.crop:
        x0, y0, x1, y1 = (int(v) for v in o.crop.split(','))
        src = src.crop((x0, y0, x1, y1))
    if o.keep_alpha:
        rgba = np.array(src.convert('RGBA')).astype(float)
        rgb, alpha = rgba[:, :, :3], rgba[:, :, 3] / 255
    else:
        rgb = np.array(src.convert('RGB')).astype(float)
        alpha = cutout(rgb)
    full = crop_rgba(rgb, drop_specks(alpha))
    os.makedirs(o.out, exist_ok=True)
    if o.art:
        art = resize(full, o.art)
        path = os.path.join(o.out, f'{o.name}.png')
        art.save(path, optimize=True)
        print(f'原画     {path}  {art.width}x{art.height}')
        if o.preview:
            os.makedirs(o.preview, exist_ok=True)
            save_preview(art, os.path.join(o.preview, o.name), 1)
    if o.dot:
        dot = pixelize(full, o.dot, colors=o.colors, dark_thresh=o.dark)
        path = os.path.join(o.out, f'{o.name}_dot.png')
        dot.save(path, optimize=True)
        print(f'ドット絵 {path}  {dot.width}x{dot.height}')
        if o.preview:
            os.makedirs(o.preview, exist_ok=True)
            save_preview(dot, os.path.join(o.preview, f'{o.name}_dot'), 5)


if __name__ == '__main__':
    main()
