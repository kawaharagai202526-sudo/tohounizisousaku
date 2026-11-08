"""5 曲つなぎの原曲から、原型より「1 曲としてのまとまり」を優先して作り直した 5 パターン (r2)。

build_medley5.py (テンポ・キー・音量・EQ を揃えただけの版) に加えて:
  * 全曲に同じキット・同じノリのドラム層を重ね、音楽はそのキックに合わせて軽くうねらせる
  * EQ を S5 (基準) にほぼ完全に寄せ、モノラルの曲も同じ横幅に広げ、共通の残響をかけて最後に全体をまとめる
  * 繋ぎ目は、前の曲の低音をハイパスでだんだん抜き (DJ ミックス風)、キーの変わり目には
    前後の和音に共通する音 (F / F / A♭ / G / G#) をパッドで伸ばしてつなぐ

使い方: python3 tools/bgm/build_medley5_r2.py [v1 v2 ...]
出力: assets/bgm/medley5_r2/*.ogg と build/bgm/medley5_r2/*.wav, *.mp3
"""
import json
import os
import sys

import build_bgm as bb
import build_medley5 as m5
import dsp
from dsp import SR, Track, db
from medley import Medley, Plan, common_tone, groove, triplet_fill, unify_mix

OUT_DIR = os.path.join(bb.OUT_DIR, "medley5_r2")
BUILD = os.path.join(bb.BUILD, "medley5_r2")
SEG, SONG = m5.SEG, m5.SONG
BEAT, BAR, BAR_SLOW = m5.BEAT, m5.BAR, m5.BAR_SLOW

MD = Medley("m5", os.path.join(bb.ROOT, "assets", "bgm", "source", "medley5_original.mp3"), m5.M, ref="S5",
            target={"S1": -16.0, "S2": -13.3, "S3": -14.0, "S4": -14.0},
            eq_amount={"S2": 0.95, "S3": 0.9, "S4": 0.9}, eq_maxcut={"S2": 12.0, "S3": 9.0, "S4": 9.0},
            width={"S1": 0.45, "S2": 0.55}, widen={"S3": 0.25, "S4": 0.25, "S5": 0.25})

# 繋ぎ目で伸ばす共通音 (MIDI)
F4, AB4, G4, GS4 = 65, 68, 67, 68


def build(version, *, s1_bars=4, s2_bars=4, s3_mode="full", ending="land", style="unified"):
    nonstop, drive, cine = style == "nonstop", style == "drive", style == "cinematic"
    kit = bb.Kit()
    P = Plan(BAR)
    g_s1 = P.add("S1", s1_bars, BAR_SLOW)
    g_s2 = P.add("S2", s2_bars, BAR_SLOW)
    g_s3 = P.add("S3", 10 if s3_mode == "full" else 8, BAR)
    g_s4 = P.add("S4", 16, BAR)
    g_s5 = P.add("S5", 31 if ending == "fade" else 32, BAR)
    g_end = len(P.durs)
    L = P.layout(24)
    total = L.gt(g_end + 24) + 8.0
    n = int(total * SR)
    music, fx, dr = Track(total), Track(total), bb.Drums(total, kit)
    sw = 4 if nonstop else 2                      # 低音を抜いていく長さ (小節)
    pad_db = -16.0 if cine else -20.0

    def secs(a, b):
        return L.gt(b) - L.gt(a)

    def lp(g):
        return (secs(g, g + 2), 450.0) if nonstop else None

    # ---------------- 曲の配置 (E → F に上げたパッド → B♭ → B♭m … → C/Em)
    t1 = (s1_bars + 1) * BAR_SLOW
    MD.place_stretch(music, L, "S1", 0.0, min(13.0, t1), L.gt(g_s1), L.gt(g_s1) + t1, fin=0.02, fout=BAR_SLOW,
                     pitch=m5.S1_PITCH_INTRO)
    MD.place(music, L, "S2", range(0, s2_bars), g_s2, head=SONG["S2"]["bar0"] - SEG["S2"][0], fin=0.02, fout=0.03,
             hp_out=(secs(g_s3 - min(sw, s2_bars), g_s3), 450.0), lp_in=lp(g_s2))
    if s3_mode == "full":
        MD.place(music, L, "S3", range(0, 9), g_s3, head=0.005, tail=0.03, fout=0.06, lp_in=lp(g_s3))
        MD.place_stretch(music, L, "S3", MD.beat_time("S3", 36), SEG["S3"][1] - 0.01, L.gt(g_s3 + 9),
                         L.gt(g_s4) - 0.02, head=0.03, fin=0.06, fout=0.15, hp_out=(secs(g_s3 + 9, g_s4), 700.0))
    else:
        MD.place(music, L, "S3", range(0, 8), g_s3, head=0.005, fout=0.03, hp_out=(secs(g_s4 - 1, g_s4), 350.0),
                 lp_in=lp(g_s3))
    MD.place(music, L, "S4", range(0, 16), g_s4, head=0.12, end_beat=2.0, tail=0.0, fin=0.03, fout=0.03,
             hp_out=(secs(g_s5 - sw, g_s5) - 2 * BEAT, 500.0), lp_in=lp(g_s4))
    MD.place(music, L, "S5", range(0, g_end - g_s5), g_s5, head=2 * BEAT, tail=0.03 if ending == "fade" else 0.0,
             fin=0.04, fout=0.03, lp_in=lp(g_s5))

    # ---------------- 全曲共通のドラム層
    gg = 1.5 if drive else 0.0
    nh = min(s1_bars, 3 if nonstop else 2)
    groove(dr, L, g_s1 + s1_bars - nh, nh, "hats", gain=gg - 3, crash_every=0)
    groove(dr, L, g_s2, s2_bars, "drive", gain=gg - 1, crash_every=0, last="kickhat")   # 112 BPM
    groove(dr, L, g_s3, 8, "drive", gain=gg)
    if s3_mode == "full":
        dr.bar(L, g_s3 + 8, "kickhat", gain=gg - 2)
        if nonstop:
            dr.bar(L, g_s3 + 9, "pulse", gain=gg - 4)
    groove(dr, L, g_s4, 16, "drive", gain=gg, last="hats")
    groove(dr, L, g_s5, g_end - g_s5, "drive", gain=gg, last=None if ending == "fade" else "kickhat")

    # ---------------- 繋ぎ
    # S1 → S2 (F → B♭)
    fx.add(dsp.reverse_crash(BAR_SLOW / 4), L.gt(g_s2) - BAR_SLOW / 4, -10)
    dr.hit("crash", L.gt(g_s2), -3)
    common_tone(fx, L, F4, L.gt(g_s2 - 1), L.gt(g_s2 + 1), pad_db)
    # S2 → S3: 3 連符で 112 → 168 BPM (B♭ → B♭m)
    g_r = max(g_s2, g_s3 - 2)
    if cine:
        for b in range(g_r, g_s3):
            for s in (0, 8):
                dr.tr["tom"].add(kit.toms[41], L.step(b, s), -6)
    fx.add(dsp.riser(secs(g_r, g_s3), 250, 8000), L.gt(g_r), -12)
    triplet_fill(dr, kit, L, g_s3 - 1, gain=1 if drive else -1)
    dr.hit("crash", L.gt(g_s3), 2)
    dr.hit("kick", L.gt(g_s3), 0)
    fx.add(dsp.impact(), L.gt(g_s3), -9)
    common_tone(fx, L, F4, L.gt(g_s3 - 1), L.gt(g_s3 + 1), pad_db)
    # S3 → S4 (A♭ → A♭m)
    if s3_mode == "full":
        fx.add(dsp.reverse_crash(2 * BEAT), L.gt(g_s4) - 2 * BEAT, -5)
        fx.add(dsp.riser(secs(g_s4 - 2, g_s4), 300, 7000), L.gt(g_s4 - 2), -14)
        common_tone(fx, L, AB4, L.gt(g_s4 - 2), L.gt(g_s4 + 1), pad_db + 1)
    else:
        dr.fill(L, g_s4 - 1, "snare16", gain=-2)
        common_tone(fx, L, AB4, L.gt(g_s4 - 1), L.gt(g_s4 + 1), pad_db)
    dr.hit("crash", L.gt(g_s4), 1)
    fx.add(dsp.impact(), L.gt(g_s4), -11)
    # S4 → S5 (E♭ → C)
    if cine or nonstop:
        fx.add(dsp.snare_roll(BAR, 2, 4, 16), L.gt(g_s5 - 2), -17)
        fx.add(dsp.riser(2 * BAR, 200, 7000), L.gt(g_s5 - 2), -13)
    dr.hit("crash", L.gt(g_s5), 2)
    fx.add(dsp.impact(), L.gt(g_s5), -9)
    common_tone(fx, L, G4, L.gt(g_s5 - 1), L.gt(g_s5 + 1), pad_db)

    # ---------------- 終わり方
    loop_pts = None
    tail_fade = None
    if ending in ("land", "short", "outro"):
        dr.fill(L, g_end - 1, "toms", gain=-2)
        if ending == "short":
            hit, at = MD.landing(L, g_end, "S5", m5.LAND_E[0], m5.LAND_E[1], 1, tail_sec=2.2, wet_db=-8, room=0.75)
            tail_fade = (L.gt(g_end) + 2 * BEAT, 2.4)
        else:
            hit, at = MD.landing(L, g_end, "S5", m5.LAND_E[0], m5.LAND_E[1], 2)
            common_tone(fx, L, GS4, L.gt(g_end - 1), L.gt(g_end) + 3.5, pad_db)   # F → E の G# を伸ばす
        music.add(hit, at)
        dr.hit("crash", L.gt(g_end), 0)
        dr.hit("crash2", L.gt(g_end), -7)
        dr.hit("kick", L.gt(g_end), 0)
        fx.add(dsp.impact(3.0), L.gt(g_end), -10 if ending != "short" else -8)
        if ending == "outro":
            # 冒頭のパッドを元の E のまま戻して締めくくる
            t = 5 * BAR
            MD.place_stretch(music, L, "S1", 0.0, t, L.gt(g_end), L.gt(g_end) + t, fin=BAR, fout=2.5 * BAR,
                             pitch=m5.S1_PITCH_OUTRO, gain_db=-2)
            fx.add(dsp.downlifter(2 * BAR), L.gt(g_end), -14)
            tail_fade = (L.gt(g_end + 3), 2 * BAR + 1.0)
    elif ending == "fade":
        fx.add(dsp.reverse_crash(BEAT), L.gt(g_end) - BEAT, -10)
        MD.place(music, L, "S5", range(8, 16), g_end, head=0.03, tail=0.0, fin=0.06, fout=0.03)
        groove(dr, L, g_end, 8, "drive", gain=gg)
        tail_fade = (L.gt(g_end + 2), secs(g_end + 2, g_end + 8))
    elif ending == "loop":
        dr.fill(L, g_end - 1, "toms", gain=-2)
        fx.add(dsp.reverse_crash(2 * BEAT), L.gt(g_end - 1, 2), -8)
        common_tone(fx, L, F4, L.gt(g_end - 1), L.gt(g_end), pad_db)   # F → B♭m
        loop_pts = (L.gt(g_s3) - 0.005, L.gt(g_end) - 0.005)

    # ---------------- ミックス (全体を同じ音作りに)
    fxm = fx.x[:n] + dsp.reverb(fx.x[:n], room=0.7, damp=0.5)[:n] * db(-12)
    mix, dgain = unify_mix(music.x[:n], dr.mix(n), fxm, dr.kicks, (L.gt(g_s3), L.gt(g_end)),
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
    # 1: 統一。全曲に共通のドラム層・音作りをかけ、フィルターと共通音のパッドで繋ぐ
    "medley5r2_v1_unified": dict(style="unified", ending="land"),
    # 2: ノンストップ。繋ぎは 4 小節かけて抜き、次の曲はこもった音から開く。ドラムは最後まで止めずにフェードアウト
    "medley5r2_v2_nonstop": dict(style="nonstop", ending="fade"),
    # 3: 疾走。短く詰めて、ドラム層とうねりを強めに。短い「キメ」で終わる
    "medley5r2_v3_drive": dict(style="drive", s1_bars=2, s2_bars=2, s3_mode="short", ending="short"),
    # 4: ドラマチック。盛り上げを大きく、共通音のパッドも厚めに。最後は冒頭のパッドで締める
    "medley5r2_v4_cinematic": dict(style="cinematic", s1_bars=6, ending="outro"),
    # 5: ゲーム用ループ。S3 → S4 → S5 → S3 …
    "medley5r2_v5_loop": dict(style="unified", ending="loop"),
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
