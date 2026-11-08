"""3 部構成の原曲 (medley3_original.mp3) から、曲調を統一した完成版を 5 パターン作る。

原曲: A (165 BPM, Gm, 24 小節) → B (178 BPM, E♭-F-Am7-Gm7, 助走 + 32 小節) → A' (A と同じ曲の別テイク:
G のペダル音のブレイク 8 小節 + A の 8-23 小節。最後の小節の途中で切れている)。キーは全部 Gm 系で揃っている。

基準は A (始まりと終わりに出てくる「家」の曲)。A / A' の音は加工しない (v3 だけは B を基準にした速い版)。
  * テンポ: B を 178 → 165 BPM に揃える (v3 は逆に A / A' を 178 に)
  * 音量・周波数バランス: B (A より 4.6dB 大きい) を A に寄せる
  * A' の途中で切れた最後の小節は、最初の A の同じ位置 (23 小節目, E♭) と差し替える。
    A の 23 小節目 → B の助走 という継ぎ目が原曲にあるので、ループ版はここで完全に繋がる
  * 最後は E♭ → G の着地。着地音は曲の最初の一打 (A の 0 小節目, Gmaj7)

使い方: python3 tools/bgm/build_medley3.py [v1 v2 ...]
出力: assets/bgm/medley3/*.ogg と build/bgm/medley3/*.wav, *.mp3
"""
import json
import os
import sys

import soundfile as sf

import build_bgm as bb
import dsp
from dsp import SR, Track, db
from medley import Medley, Plan

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(bb.OUT_DIR, "medley3")
BUILD = os.path.join(bb.BUILD, "medley3")
SRC = os.path.join(bb.ROOT, "assets", "bgm", "source", "medley3_original.mp3")

M = json.load(open(os.path.join(HERE, "medley3_analysis.json")))
SONG = M["songs"]

# 基準 A: A / A' はそのまま、B を A の音量・音色に寄せる
MD_A = Medley("m3", SRC, M, ref="A", target={"B": -14.0}, eq_amount={"B": 0.5})
# 原曲重視: EQ は控えめ
MD_A_SOFT = Medley("m3", SRC, M, ref="A", target={"B": -14.0}, eq_amount={"B": 0.25})
# 基準 B (疾走版): B はそのまま、A / A' を B の音圧・音色に寄せる
MD_B = Medley("m3", SRC, M, ref="B", target={"A": -13.0, "Ad": -13.0}, eq_amount={"A": 0.5, "Ad": 0.5})


def build(version, *, ref="A", a_bars=None, ad_break=range(0, 8), ad_main=range(8, 23), ending="land",
          style="standard", original_tempo=False):
    """a_bars: 使う A の小節 (既定 0-23), ad_break / ad_main: 使う A' の小節。
    A' の 23 小節目は原曲で切れているので、代わりに A の 23 小節目を最後に置く。"""
    md = MD_B if ref == "B" else (MD_A_SOFT if style == "faithful" else MD_A)
    bpm = SONG[ref]["bpm"]
    BEAT = 60.0 / bpm
    BAR = 4 * BEAT
    bar_of = {k: (4 * 60.0 / SONG[k]["bpm"] if original_tempo else BAR) for k in SONG}
    a_bars = list(range(0, 24) if a_bars is None else a_bars)
    ad_break, ad_main = list(ad_break), list(ad_main)

    kit = bb.Kit()
    P = Plan(BAR)
    g_a = P.add("A", len(a_bars), bar_of["A"])
    g_b = P.add("B", 33, bar_of["B"])                  # 助走 1 小節 + 32 小節
    g_br = P.add("Ad_break", len(ad_break), bar_of["Ad"])
    P.add("Ad_main", len(ad_main) + 1, bar_of["Ad"])   # +1 = A の 23 小節目
    g_end = len(P.durs)
    L = P.layout(24)
    total = L.gt(g_end + 24) + 8.0
    n = int(total * SR)
    music, fx, dr = Track(total), Track(total), bb.Drums(total, kit)
    soft = style == "faithful"

    def put_run(song, bars, g0, **kw):
        """連続した小節ごとにまとめて置く (飛ばした所は短いクロスフェードで繋ぐ)。"""
        runs, cur = [], [bars[0]]
        for b in bars[1:]:
            if b == cur[-1] + 1:
                cur.append(b)
            else:
                runs.append(cur)
                cur = [b]
        runs.append(cur)
        g = g0
        for i, r in enumerate(runs):
            first, last = i == 0, i == len(runs) - 1
            md.place(music, L, song, r, g, head=kw.get("head", 0.03) if first else 0.03,
                     tail=kw.get("tail", 0.03) if last else 0.03,
                     fin=kw.get("fin", 0.0) if first else 0.06, fout=kw.get("fout", 0.03) if last else 0.06)
            g += len(r)

    # ---------------- 配置
    put_run("A", a_bars, g_a, head=0.03, fout=0.03)
    md.place(music, L, "B", range(-1, 32), g_b, head=0.03, tail=0.03, fin=0.02, fout=0.04)
    put_run("Ad", ad_break, g_br, head=0.02, fin=0.02, fout=0.06)
    put_run("Ad", ad_main, g_br + len(ad_break), fin=0.06, fout=0.06)
    md.place(music, L, "A", [23], g_end - 1, head=0.03, tail=0.03, fin=0.06, fout=0.04)

    # ---------------- 繋ぎ
    # A → B: B の助走 (高い和音の伸ばし) の頭にクラッシュ、逆再生シンバルで B の本編へ
    dr.hit("crash", L.gt(g_b), -4 if soft else -1)
    fx.add(dsp.reverse_crash(BEAT), L.gt(g_b + 1) - BEAT, -9 if soft else -6)
    dr.hit("crash", L.gt(g_b + 1), 0 if soft else 2)
    if not soft:
        dr.hit("kick", L.gt(g_b + 1), 0)
        fx.add(dsp.impact(), L.gt(g_b + 1), -9)
    if style == "drive":
        for g in range(g_b + 1 + 8, g_b + 33, 8):
            dr.hit("crash2", L.gt(g), -3)
    # B → A' のブレイク (G のペダル音): いったん落とす
    dr.hit("crash", L.gt(g_br), -2 if soft else 1)
    if not soft:
        fx.add(dsp.impact(3.0), L.gt(g_br), -9)
        fx.add(dsp.downlifter(2 * BAR), L.gt(g_br), -12)
    # ブレイク → A' の本編: 盛り上げて戻る
    g_main = g_br + len(ad_break)
    nb = len(ad_break)
    if soft:
        fx.add(dsp.reverse_crash(BAR / 2), L.gt(g_main) - BAR / 2, -9)
    else:
        if style == "cinematic":
            for b in range(g_main - min(4, nb), g_main):
                for s in (0, 8):
                    dr.tr["tom"].add(kit.toms[41], L.step(b, s), -6)
            fx.add(dsp.riser(L.gt(g_main) - L.gt(g_main - min(4, nb)), 200, 7000), L.gt(g_main - min(4, nb)), -13)
            fx.add(dsp.snare_roll(BAR, 2, 4, 16), L.gt(g_main - 2), -16)
        else:
            fx.add(dsp.riser(L.gt(g_main) - L.gt(g_main - 2), 250, 8000), L.gt(g_main - 2), -12)
            fx.add(dsp.snare_roll(BAR, 1, 8, 32), L.gt(g_main - 1), -15)
        fx.add(dsp.reverse_crash(2 * BEAT), L.gt(g_main) - 2 * BEAT, -7)
        fx.add(dsp.impact(), L.gt(g_main), -10)
    dr.hit("crash", L.gt(g_main), 1 if not soft else -2)

    # ---------------- 終わり方
    loop_pts = None
    tail_fade = None
    if ending in ("land", "short", "outro"):
        dr.fill(L, g_end - 1, "toms", gain=-3)
        if ending == "short":
            hit, at = md.landing(L, g_end, "A", 0, 0, 1, tail_sec=2.2, wet_db=-8, room=0.75)
            tail_fade = (L.gt(g_end) + 2 * BEAT, 2.4)
        else:
            hit, at = md.landing(L, g_end, "A", 0, 0, 2)
        # この曲は全体に -16 LUFS 前後と控えめなので、着地も少し抑える
        music.add(hit, at, -2.0)
        dr.hit("crash", L.gt(g_end), -2)
        dr.hit("crash2", L.gt(g_end), -9)
        dr.hit("kick", L.gt(g_end), -2)
        fx.add(dsp.impact(3.0), L.gt(g_end), -12 if ending != "short" else -10)
        if ending == "outro":
            # 着地の後、A' のブレイク (G のペダル音) を静かに戻して締める
            put_run("Ad", list(range(0, 4)), g_end + 1, head=0.02, fin=BAR, fout=1.5 * BAR)
            tail_fade = (L.gt(g_end + 3), 2 * BAR)
    elif ending == "fade":
        # A の 16-23 小節 (Gm-F-E♭) をもう一度流しながら消えていく
        put_run("A", list(range(16, 24)), g_end, head=0.03, fin=0.06, fout=0.04)
        tail_fade = (L.gt(g_end + 2), L.gt(g_end + 8) - L.gt(g_end + 2))
    elif ending == "loop":
        # A の 23 小節目 → B の助走 は原曲どおりの継ぎ目。B の助走からをループする
        loop_pts = (L.gt(g_b) - 0.03, L.gt(g_end) - 0.03)

    # ---------------- ミックス
    drums = dr.mix(n) * db(-2.5)
    fxm = fx.x[:n] + dsp.reverb(fx.x[:n], room=0.7, damp=0.5)[:n] * db(-12)
    mus = music.x[:n]
    if not soft:
        mus = mus + dsp.reverb(mus, room=0.35, damp=0.6)[:n] * db(-24)
    mix = mus + drums + fxm
    if os.environ.get("BGM_DEBUG"):
        for nm, xx in (("music", mus), ("drums", drums), ("fx", fxm)):
            sf.write(os.path.join(BUILD, f"{version}_stem_{nm}.wav"), xx, SR, subtype="FLOAT")
    dirs = dict(out_dir=OUT_DIR, build_dir=BUILD)
    if loop_pts:
        ls, le = int(round(loop_pts[0] * SR)), int(round(loop_pts[1] * SR))
        info = bb.finish(mix, version, loop=(ls, le), loop_xfade=2 * BAR, loop_add=True, **dirs)
    else:
        info = bb.finish(mix, version, tail_fade=tail_fade, **dirs)
    info["layout"] = {k: round(L.gt(v), 3) for k, v in P.at.items()}
    info["layout"]["end"] = round(L.gt(g_end), 3)
    return info


VERSIONS = {
    # 1: 標準。A の 165 BPM に統一。A → B → A' (ブレイク → 本編) → G で「ジャーン」
    "medley3_v1_standard": dict(ref="A", ending="land", style="standard"),
    # 2: 原曲重視。テンポは各曲のまま (伸縮なし)。足す音はシンバル程度、最後はフェードアウト
    "medley3_v2_faithful": dict(ref="A", ending="fade", style="faithful", original_tempo=True),
    # 3: 疾走。B の 178 BPM に統一して全体を速く。A とブレイクを縮め、短い「キメ」で終わる
    "medley3_v3_drive": dict(ref="B", a_bars=list(range(0, 8)) + list(range(16, 24)), ad_break=range(4, 8),
                             ad_main=range(16, 23), ending="short", style="drive"),
    # 4: ドラマチック。ブレイクで大きく盛り上げ、着地の後に G のペダル音で静かに締める
    "medley3_v4_cinematic": dict(ref="A", ending="outro", style="cinematic"),
    # 5: ゲーム用ループ。A をイントロにして、B → A' → B … とループ
    "medley3_v5_loop": dict(ref="A", ending="loop", style="standard"),
}


def main():
    names = sys.argv[1:] or list(VERSIONS)
    os.makedirs(bb.CACHE, exist_ok=True)
    os.makedirs(BUILD, exist_ok=True)
    infos = []
    for name in names:
        key = name if name in VERSIONS else next(k for k in VERSIONS if k.split("_")[1] == name)
        print("building", key, flush=True)
        infos.append(build(key, **VERSIONS[key]))
    with open(os.path.join(BUILD, "build_info.json"), "w") as f:
        json.dump(infos, f, indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
