"""3 部構成 (A-B-A') の原曲から、原型より「1 曲としてのまとまり」を優先して作り直した 5 パターン (r2)。

build_medley3.py (テンポ・音量・EQ を揃えただけの版) に加えて:
  * 全編に同じキット・同じノリのドラム層を重ね、音楽はそのキックに合わせて軽くうねらせる
  * B の EQ を A にほぼ完全に寄せ、モノラルの原曲を同じ横幅に広げ、共通の残響をかけて最後に全体をまとめる
  * 繋ぎ目は、前の部分の低音をハイパスでだんだん抜いてから次へ。前後の和音に共通する音
    (A→B: F / B→A': G / ブレイク→本編: G / 着地: G) をパッドで伸ばしてつなぐ

使い方: python3 tools/bgm/build_medley3_r2.py [v1 v2 ...]
出力: assets/bgm/medley3_r2/*.ogg と build/bgm/medley3_r2/*.wav, *.mp3
"""
import json
import os
import sys

import build_bgm as bb
import build_medley3 as m3
import dsp
from dsp import SR, Track, db
from medley import Medley, Plan, common_tone, groove, unify_mix

OUT_DIR = os.path.join(bb.OUT_DIR, "medley3_r2")
BUILD = os.path.join(bb.BUILD, "medley3_r2")
SONG = m3.SONG
WIDEN = {"A": 0.25, "B": 0.25, "Ad": 0.25}
MD_A = Medley("m3", m3.SRC, m3.M, ref="A", target={"B": -15.0}, eq_amount={"B": 0.9}, eq_maxcut={"B": 9.0},
              widen=WIDEN)
MD_B = Medley("m3", m3.SRC, m3.M, ref="B", target={"A": -12.5, "Ad": -12.5}, eq_amount={"A": 0.9, "Ad": 0.9},
              eq_maxcut={"A": 9.0, "Ad": 9.0}, widen=WIDEN)
F4, G4 = 65, 67


def build(version, *, ref="A", a_bars=None, ad_break=range(0, 8), ad_main=range(8, 23), ending="land",
          style="unified"):
    nonstop, drive, cine = style == "nonstop", style == "drive", style == "cinematic"
    md = MD_B if ref == "B" else MD_A
    BEAT = 60.0 / SONG[ref]["bpm"]
    BAR = 4 * BEAT
    a_bars = list(range(0, 24) if a_bars is None else a_bars)
    ad_break, ad_main = list(ad_break), list(ad_main)
    kit = bb.Kit()
    P = Plan(BAR)
    g_a = P.add("A", len(a_bars), BAR)
    g_b = P.add("B", 33, BAR)
    g_br = P.add("Ad_break", len(ad_break), BAR)
    g_m = P.add("Ad_main", len(ad_main) + 1, BAR)          # +1 = A の 23 小節目 (A' の切れた小節の代わり)
    g_end = len(P.durs)
    L = P.layout(24)
    total = L.gt(g_end + 24) + 8.0
    n = int(total * SR)
    music, fx, dr = Track(total), Track(total), bb.Drums(total, kit)
    sw = 4 if nonstop else 2
    pad_db = -16.0 if cine else -20.0

    def secs(a, b):
        return L.gt(b) - L.gt(a)

    def lp(g):
        return (secs(g, g + 2), 450.0) if nonstop else None

    # ---------------- 曲の配置
    # ループ版は「A の 23 小節目 → B」を 1 周目とループ時で同じにするため、抜きは最後の 1 小節だけ
    sw_a = 1 if ending == "loop" else sw
    md.place_runs(music, L, "A", a_bars, g_a, head=0.03, fout=0.03, hp_out=(secs(g_b - sw_a, g_b), 400.0))
    md.place(music, L, "B", range(-1, 32), g_b, head=0.03, tail=0.03, fin=0.02, fout=0.04,
             hp_out=(secs(g_br - sw, g_br), 500.0), lp_in=lp(g_b + 1))
    md.place_runs(music, L, "Ad", ad_break, g_br, head=0.02, fin=0.02, fout=0.06,
                  hp_out=(secs(g_m - min(2, len(ad_break)), g_m), 300.0))
    md.place_runs(music, L, "Ad", ad_main, g_m, fin=0.06, fout=0.06, lp_in=lp(g_m))
    md.place(music, L, "A", [23], g_end - 1, head=0.03, tail=0.03, fin=0.06, fout=0.04,
             hp_out=(secs(g_end - 1, g_end), 400.0) if ending == "loop" else None)

    # ---------------- 全編共通のドラム層
    gg = 1.5 if drive else 0.0
    na = len(a_bars)
    n_intro = min(8, na // 2)
    groove(dr, L, g_a, n_intro, "kickhat", gain=gg - 2, crash_every=0)
    groove(dr, L, g_a + n_intro, na - n_intro, "drive", gain=gg, last="kickhat")
    dr.hit("crash2", L.gt(g_a + n_intro), -4)
    if nonstop:
        dr.bar(L, g_b, "pulse", gain=gg - 4)
    groove(dr, L, g_b + 1, 32, "drive", gain=gg)
    nb = len(ad_break)
    if nonstop:
        groove(dr, L, g_br, nb, "pulse", gain=gg - 3, crash_every=0, last="kickhat")
    elif not cine:
        groove(dr, L, g_br + nb // 2, nb - nb // 2, "hats", gain=gg - 3, crash_every=0, last="kickhat")
    groove(dr, L, g_m, len(ad_main) + 1, "drive", gain=gg,
           last="kickhat" if ending in ("land", "short", "outro", "loop") else None)

    # ---------------- 繋ぎ
    # A → B (A の 23 小節目 → B の助走)
    dr.hit("crash", L.gt(g_b), -1)
    common_tone(fx, L, F4, L.gt(g_b - 1), L.gt(g_b, 2), pad_db)
    fx.add(dsp.reverse_crash(BEAT), L.gt(g_b + 1) - BEAT, -6)
    dr.hit("crash", L.gt(g_b + 1), 2)
    dr.hit("kick", L.gt(g_b + 1), 0)
    fx.add(dsp.impact(), L.gt(g_b + 1), -9)
    if drive:
        for g in range(g_b + 1 + 8, g_b + 33, 8):
            dr.hit("crash2", L.gt(g), -3)
    # B → A' のブレイク (Gm7 → G のペダル音)
    dr.hit("crash", L.gt(g_br), 1)
    fx.add(dsp.impact(3.0), L.gt(g_br), -9)
    fx.add(dsp.downlifter(2 * BAR), L.gt(g_br), -12)
    common_tone(fx, L, G4, L.gt(g_br - 1), L.gt(g_br + 1), pad_db)
    # ブレイク → A' の本編 (G を伸ばしたまま盛り上げる)
    k = min(4, nb)
    if cine:
        for b in range(g_m - k, g_m):
            for s in (0, 8):
                dr.tr["tom"].add(kit.toms[41], L.step(b, s), -6)
        fx.add(dsp.riser(secs(g_m - k, g_m), 200, 7000), L.gt(g_m - k), -13)
        fx.add(dsp.snare_roll(BAR, 2, 4, 16), L.gt(g_m - 2), -16)
        common_tone(fx, L, G4, L.gt(g_br), L.gt(g_m + 1), pad_db, attack=0.8)
    else:
        fx.add(dsp.riser(secs(g_m - 2, g_m), 250, 8000), L.gt(g_m - 2), -12)
        fx.add(dsp.snare_roll(BAR, 1, 8, 32), L.gt(g_m - 1), -15)
        common_tone(fx, L, G4, L.gt(g_m - k), L.gt(g_m + 1), pad_db)
    fx.add(dsp.reverse_crash(2 * BEAT), L.gt(g_m) - 2 * BEAT, -7)
    fx.add(dsp.impact(), L.gt(g_m), -10)
    dr.hit("crash", L.gt(g_m), 1)

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
            common_tone(fx, L, G4, L.gt(g_end - 1), L.gt(g_end) + 3.5, pad_db)
        music.add(hit, at, -2.0)
        dr.hit("crash", L.gt(g_end), -2)
        dr.hit("crash2", L.gt(g_end), -9)
        dr.hit("kick", L.gt(g_end), -2)
        fx.add(dsp.impact(3.0), L.gt(g_end), -12 if ending != "short" else -10)
        if ending == "outro":
            md.place_runs(music, L, "Ad", list(range(0, 4)), g_end + 1, head=0.02, fin=BAR, fout=1.5 * BAR)
            tail_fade = (L.gt(g_end + 3), 2 * BAR)
    elif ending == "fade":
        md.place_runs(music, L, "A", list(range(16, 24)), g_end, head=0.03, fin=0.06, fout=0.04)
        groove(dr, L, g_end, 8, "drive", gain=gg)
        tail_fade = (L.gt(g_end + 2), secs(g_end + 2, g_end + 8))
    elif ending == "loop":
        # A の 23 小節目 → B の助走 は 1 周目と同じ継ぎ目 (F のパッドも同じ位置)
        common_tone(fx, L, F4, L.gt(g_end - 1), L.gt(g_end), pad_db)
        loop_pts = (L.gt(g_b) - 0.03, L.gt(g_end) - 0.03)

    # ---------------- ミックス
    fxm = fx.x[:n] + dsp.reverb(fx.x[:n], room=0.7, damp=0.5)[:n] * db(-12)
    mix, dgain = unify_mix(music.x[:n], dr.mix(n), fxm, dr.kicks, (L.gt(g_b + 1), L.gt(g_end)),
                           duck_db=-4.0 if drive else -2.5, drum_rel=-6.0 if drive else -8.0)
    print(f"  drum layer gain {dgain:+.1f} dB")
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
    # 1: 統一。165 BPM、全編に共通のドラム層・音作り、フィルターと共通音のパッドで繋ぐ
    "medley3r2_v1_unified": dict(ref="A", style="unified", ending="land"),
    # 2: ノンストップ。4 小節かけて抜き、次はこもった音から開く。ブレイク中もドラムを止めずにフェードアウト
    "medley3r2_v2_nonstop": dict(ref="A", style="nonstop", ending="fade"),
    # 3: 疾走。178 BPM に統一して短く詰め、ドラム層とうねりを強めに
    "medley3r2_v3_drive": dict(ref="B", style="drive", a_bars=list(range(0, 8)) + list(range(16, 24)),
                               ad_break=range(4, 8), ad_main=range(16, 23), ending="short"),
    # 4: ドラマチック。ブレイク全体で G のパッドを膨らませ、タム・ライザーで盛り上げ、G のペダル音で締める
    "medley3r2_v4_cinematic": dict(ref="A", style="cinematic", ending="outro"),
    # 5: ゲーム用ループ。A をイントロに、B → A' → B …
    "medley3r2_v5_loop": dict(ref="A", style="unified", ending="loop"),
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
