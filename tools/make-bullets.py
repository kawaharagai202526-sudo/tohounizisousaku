#!/usr/bin/env python3
"""
弾のスプライト（試験用。2.19.0 でユーザーの指定「弾のスプライトを導入してみる（試験用）」）の画像 img/bullets.png を作る

  オプションの「弾の見た目」を「スプライト（試験）」にすると、ゲームはこの画像から弾の絵を切り出して使う（js/sprites.js の BULLET_SHEET）。
  「標準」のときは、いままでどおりコードで描いた絵を使う。この画像にない弾（瓦・虫・湯呑み・手鞠・小判など、その面だけの弾）は、いつもコードの絵。

  画像の並び（js/sprites.js の BULLET_SHEET と同じにする。テストで大きさを確かめている）
    行：弾の形（TYPES の順）。行の高さは、その弾の大きさ（js/sprites.js の BTYPES の size）× 2 ピクセル
    列：色（COLORS の順。BCOL と同じ13色）。マスは正方形（行の高さと同じ幅）
    向きのある弾（米粒・クナイ・針・札・蝶・氷・お札）は右向きに描く（ゲームが進む向きに回す）
  自分で描いた絵に差しかえるときも、同じ並びと大きさで描けばよい（背景は透明）

使い方:
  python3 tools/make-bullets.py [出力ファイル]   （書かなければ img/bullets.png）
  --preview 出力先   確認用に、暗い背景に置いて拡大した画像も保存する

必要なもの: Python 3、Pillow、numpy、scipy（pip install pillow numpy scipy）
"""
import sys
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt

SPR = 2   # ゲームと同じ、事前描画の解像度倍率（1 単位 = 2 ピクセル）
SS = 4    # なめらかにするため、4 倍の大きさで描いてから縮める

# js/sprites.js の BCOL と同じ（rim：外側の色、core：芯の色）
COLORS = [
    ('red', '#ff3434', '#ffffff'), ('orange', '#ff9a28', '#ffffff'), ('yellow', '#ffe03a', '#ffffff'),
    ('green', '#38ee68', '#ffffff'), ('cyan', '#34e2ff', '#ffffff'), ('blue', '#4a68ff', '#ffffff'),
    ('purple', '#b84cff', '#ffffff'), ('pink', '#ff5ad2', '#ffffff'), ('white', '#c8c8e0', '#ffffff'),
    ('dark', '#e8286e', '#14000a'), ('gold', '#ffc828', '#fffbe2'), ('brown', '#b27a42', '#fff0d8'),
    ('soot', '#8c8498', '#16121c'),
]
# 弾の形と大きさ（js/sprites.js の BTYPES の size。ここを変えたら BULLET_SHEET も直す）
TYPES = [
    ('small', 14), ('ball', 22), ('large', 46), ('dot', 10), ('rice', 18), ('kunai', 20),
    ('needle', 22), ('card', 22), ('star', 20), ('butterfly', 24), ('amulet', 20),
]


def hex_rgb(h):
    n = int(h[1:], 16)
    return np.array([(n >> 16) & 255, (n >> 8) & 255, n & 255], dtype=np.float64)


def mix(a, b, t):
    t = np.clip(t, 0, 1)[..., None] if np.ndim(t) else np.clip(t, 0, 1)
    return a * (1 - t) + b * t


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


class Cell:
    """1 マス（size 単位の正方形）を、4 倍の解像度で描く。座標は単位（中心が 0,0、右が +x、下が +y）"""

    def __init__(self, size):
        self.size = size
        self.n = size * SPR * SS
        k = self.n / size
        ys, xs = np.mgrid[0:self.n, 0:self.n] + 0.5
        self.x = xs / k - size / 2
        self.y = ys / k - size / 2
        self.k = k
        self.rgb = np.zeros((self.n, self.n, 3))
        self.a = np.zeros((self.n, self.n))

    def over(self, rgb, alpha):
        """上に重ねて塗る（alpha は 0〜1 の配列か数）"""
        alpha = np.clip(alpha, 0, 1) * np.ones_like(self.a)
        out_a = alpha + self.a * (1 - alpha)
        w = np.where(out_a > 0, alpha / np.maximum(out_a, 1e-9), 0)[..., None]
        self.rgb = self.rgb * (1 - w) + np.asarray(rgb, dtype=np.float64) * w
        self.a = out_a

    def mask(self, draw_fn):
        """PIL で形を描いたマスク（中なら 1）と、ふちからの距離（単位）を返す"""
        img = Image.new('L', (self.n, self.n), 0)
        d = ImageDraw.Draw(img)
        draw_fn(d, lambda x, y: ((x + self.size / 2) * self.k, (y + self.size / 2) * self.k))
        m = np.asarray(img, dtype=np.float64) / 255
        inside = distance_transform_edt(m > 0.5) / self.k
        outside = distance_transform_edt(m <= 0.5) / self.k
        return m, inside, outside

    def image(self):
        arr = np.dstack([np.clip(self.rgb, 0, 255), np.clip(self.a * 255, 0, 255)]).astype(np.uint8)
        im = Image.fromarray(arr, 'RGBA')
        return im.resize((self.size * SPR, self.size * SPR), Image.LANCZOS)


def orb(c, r, rim, core, core_ratio=0.45, outline=True, glow=1.4, soft=False):
    """丸い弾：外の光、濃い縁取り、色の帯、白い芯、つや"""
    d = np.hypot(c.x, c.y)
    dark = rim * 0.42
    light = mix(rim, np.array([255, 255, 255.0]), 0.45)
    # 外の光（縁の外へ glow 単位かけて消える）
    c.over(rim, 0.55 * (1 - smooth(r, r + glow, d)) * (d > r - 0.5))
    if outline and not soft:
        c.over(dark, 1 - smooth(r - 0.15, r + 0.35, d))
    # 色の帯：外側ほど濃く、内側ほど明るい
    body_r = r - (0.85 if outline and not soft else 0)
    t = d / max(body_r, 1e-6)
    col = mix(light, rim, smooth(core_ratio, 1.0, t))
    c.over(col, 1 - smooth(body_r - 0.3, body_r + 0.2, d))
    # 芯
    cr = r * core_ratio
    c.over(core, 1 - smooth(cr - 0.6, cr + 0.4, d))
    # つや（芯が明るい弾だけ）
    if core.mean() > 128:
        hx, hy = -r * 0.32, -r * 0.36
        e = np.hypot((c.x - hx) / (r * 0.30), (c.y - hy) / (r * 0.19))
        c.over(np.array([255, 255, 255.0]), 0.75 * (1 - smooth(0.6, 1.0, e)))


def ellipse_bullet(c, a, b, rim, core):
    """米粒：だ円の縁取り・色・白い芯"""
    e = np.hypot(c.x / a, c.y / b)
    dark = rim * 0.42
    light = mix(rim, np.array([255, 255, 255.0]), 0.4)
    c.over(rim, 0.5 * (1 - smooth(1.0, 1.35, e)) * (e > 0.9))
    c.over(dark, 1 - smooth(0.98, 1.06, e))
    c.over(mix(light, rim, smooth(0.4, 1.0, e)), 1 - smooth(0.82, 0.9, e))
    c.over(core, 1 - smooth(0.42, 0.52, e))


def polygon_bullet(c, pts, rim, core, core_fn=None, edge=0.75):
    """多角形の弾：ふちを濃く縁取り、中を色、core_fn で芯（白い線など）を描く"""
    m, inside, outside = c.mask(lambda d, P: d.polygon([P(x, y) for x, y in pts], fill=255))
    dark = rim * 0.42
    light = mix(rim, np.array([255, 255, 255.0]), 0.35)
    c.over(rim, 0.5 * (1 - smooth(0, 1.2, outside)) * (m < 0.5))
    c.over(dark, m)
    c.over(mix(rim, light, smooth(edge, edge + 2.0, inside)), smooth(edge - 0.25, edge + 0.25, inside))
    if core_fn:
        core_fn(c, core)


def line_core(c, core, x0, x1, w):
    """芯の白い線（x0〜x1、太さ w 単位）"""
    dx = np.clip(c.x, x0, x1) - c.x
    d = np.hypot(dx, c.y)
    c.over(core, 1 - smooth(w / 2 - 0.25, w / 2 + 0.25, d))


def star_points(outer, inner, n=5, rot=-np.pi / 2):
    return [((outer if i % 2 == 0 else inner) * np.cos(rot + i * np.pi / n), (outer if i % 2 == 0 else inner) * np.sin(rot + i * np.pi / n)) for i in range(n * 2)]


def draw(kind, size, rim, core):
    c = Cell(size)
    white = np.array([255, 255, 255.0])
    if kind == 'small':
        orb(c, 5.6, rim, core, 0.42)
    elif kind == 'ball':
        orb(c, 8.8, rim, core, 0.5)
    elif kind == 'large':
        # 大玉（ゲームでは光を足して描く）：縁取りなしで、やわらかく光る
        orb(c, 19.5, rim, core, 0.42, soft=True, glow=2.5)
    elif kind == 'dot':
        orb(c, 3.8, rim, core, 0.38, glow=0.9)
    elif kind == 'rice':
        ellipse_bullet(c, 7.6, 3.7, rim, core)
    elif kind == 'kunai':
        pts = [(9, 0), (0, -3.9), (-6.6, -2.3), (-9, -4.1), (-7.4, 0), (-9, 4.1), (-6.6, 2.3), (0, 3.9)]
        polygon_bullet(c, pts, rim, core, lambda c, core: line_core(c, core, -5, 6, 1.5))
    elif kind == 'needle':
        pts = [(10.4, 0), (-8, -1.8), (-9.8, 0), (-8, 1.8)]
        polygon_bullet(c, pts, rim, core, lambda c, core: line_core(c, core, -6.5, 8, 0.9), edge=0.5)
    elif kind == 'card':
        # 表札の札：木の板に色の枠
        pts = [(-9, -5.6), (9, -5.6), (9, 5.6), (-9, 5.6)]
        polygon_bullet(c, pts, rim, core)
        wood = np.array([214, 168, 112.0])
        inner = (np.abs(c.x) < 6.9) & (np.abs(c.y) < 3.6)
        c.over(mix(wood, wood * 0.82, (c.y + 3.6) / 7.2), inner * 1.0)
        for x in (-3.6, 0, 3.6):
            c.over(np.array([60, 36, 16.0]), ((np.abs(c.x - x) < 1.0) & (np.abs(c.y) < 0.9)) * 0.9)
    elif kind == 'star':
        polygon_bullet(c, star_points(9.2, 4.0), rim, core)
        m, inside, _ = c.mask(lambda d, P: d.polygon([P(x, y) for x, y in star_points(4.0, 1.8)], fill=255))
        c.over(core, m)
    elif kind == 'butterfly':
        for side in (-1, 1):
            for (cx, cy, rx, ry, rot) in ((2, side * 5.6, 5.6, 4.1, side * 0.55), (-4, side * 4.0, 4.0, 2.8, -side * 0.5)):
                ca, sa = np.cos(rot), np.sin(rot)
                xr = (c.x - cx) * ca + (c.y - cy) * sa
                yr = -(c.x - cx) * sa + (c.y - cy) * ca
                e = np.hypot(xr / rx, yr / ry)
                c.over(rim * 0.42, 1 - smooth(0.96, 1.06, e))
                c.over(mix(mix(rim, white, 0.4), rim, smooth(0.2, 1.0, e)), 1 - smooth(0.8, 0.88, e))
        line_core(c, core, -6, 6, 1.5)
    elif kind == 'amulet':
        # お札：白い紙に色の枠と印
        pts = [(-8, -5), (8, -5), (8, 5), (-8, 5)]
        polygon_bullet(c, pts, rim, core)
        paper = np.array([250, 246, 236.0])
        c.over(paper, ((np.abs(c.x) < 6.6) & (np.abs(c.y) < 3.6)) * 1.0)
        c.over(rim, ((np.abs(c.x) < 3.8) & (np.abs(c.y) < 1.5)) * 1.0)
    return c.image()


def main():
    args = sys.argv[1:]
    preview = None
    if '--preview' in args:
        i = args.index('--preview')
        preview = args[i + 1]
        del args[i:i + 2]
    out = args[0] if args else 'img/bullets.png'
    widths = [s * SPR * len(COLORS) for _, s in TYPES]
    W, H = max(widths), sum(s * SPR for _, s in TYPES)
    sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    y = 0
    for kind, size in TYPES:
        for i, (name, rim, core) in enumerate(COLORS):
            sheet.paste(draw(kind, size, hex_rgb(rim), hex_rgb(core)), (i * size * SPR, y))
        y += size * SPR
    sheet.save(out, optimize=True)
    print(f'{out}: {W}×{H}（{len(TYPES)} 種類 × {len(COLORS)} 色）')
    if preview:
        bg = Image.new('RGBA', (W, H), (16, 14, 34, 255))
        bg.alpha_composite(sheet)
        bg.resize((W * 2, H * 2), Image.NEAREST).save(preview)
        print(f'確認用: {preview}')


if __name__ == '__main__':
    main()
