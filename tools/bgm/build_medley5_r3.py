"""5 曲つなぎ・採用版 (r2 の v4 ドラマチック) の繋ぎ目を作り直した版 (r3)。

r2 v4 の繋ぎ目を数値で比べると (前後 2.5 秒の音色差・音量差・一番深い落ち込み)、
採用された 3 部構成版より明らかに悪い所が 2 つあった:
  * S1 → S2: 音色差 120 (3 部構成版は 27-72)。こもったパッドから明るいバンドへ急に変わる
  * S3 → S4: ブレイクで -24.8 LUFS まで落ち込む (3 部構成版は -19 程度まで)
数値には出ないが、S2 → S3 は 112 → 168 BPM へ一気に変わり、S4 → S5 は小節を半分で切り貼りしている。

そこで:
  * S1 → S2: パッドの最後の 2 小節で、S2 をローパスでこもらせた小さな音から開きながら重ねていく
  * S2 → S3: 2 小節かけて 112 → 168 BPM へ拍ごとになめらかに加速 (スネアも加速に合わせて細かく)
  * S3 → S4: ブレイクで低音を抜きすぎない。キックの鼓動とスネアを残し、A♭ のパッドとライザーで持ち上げる
  * S4 → S5: S4 を 1 拍長く残して、S5 の助走と 1 拍かけてクロスフェード

使い方: python3 tools/bgm/build_medley5_r3.py
出力: assets/bgm/medley5_r3/*.ogg と build/bgm/medley5_r3/*.wav, *.mp3
"""
import json
import os

import numpy as np

import build_bgm as bb
import build_medley5 as m5
import build_medley5_r2 as r2
import dsp
from dsp import SR, Track, db, fade
from medley import Plan, common_tone, groove, sweep_edges, unify_mix

OUT_DIR = os.path.join(bb.OUT_DIR, "medley5_r3")
BUILD = os.path.join(bb.BUILD, "medley5_r3")
SEG, SONG = m5.SEG, m5.SONG
BEAT, BAR, BAR_SLOW = m5.BEAT, m5.BAR, m5.BAR_SLOW
BPM, BPM_SLOW = m5.BPM, m5.BPM * 2 / 3
MD = r2.MD                     # 音作り (EQ・音量・横幅) は r2 と同じ
F4, AB4, G4, GS4 = r2.F4, r2.AB4, r2.G4, r2.GS4


def build(version, s1_bars=6):
    kit = bb.Kit()
    P = Plan(BAR)
    g_s1 = P.add("S1", s1_bars, BAR_SLOW)
    g_s2 = P.add("S2", 2, BAR_SLOW)
    P.add_ramp("S2_accel", 2, BPM_SLOW, BPM)          # S2 の後半 2 小節で 112 → 168 BPM
    g_s3 = P.add("S3", 10, BAR)
    g_s4 = P.add("S4", 16, BAR)
    g_s5 = P.add("S5", 32, BAR)
    g_end = len(P.durs)
    L = P.layout(24)
    total = L.gt(g_end + 24) + 8.0
    n = int(total * SR)
    music, fx, dr = Track(total), Track(total), bb.Drums(total, kit)
    pad_db = -16.0

    def secs(a, b):
        return L.gt(b) - L.gt(a)

    # ---------------- S1 (E → F のパッド)。最後の 2 小節で S2 をこもった音から重ねて入れる
    t1 = (s1_bars + 1) * BAR_SLOW
    MD.place_stretch(music, L, "S1", 0.0, min(13.0, t1), L.gt(g_s1), L.gt(g_s1) + t1, fin=0.02, fout=BAR_SLOW,
                     pitch=m5.S1_PITCH_INTRO)
    MD.place(music, L, "S2", range(0, 2), g_s2 - 2, head=0.0, tail=0.03, fin=1.8 * BAR_SLOW, fout=0.06,
             lp_in=(secs(g_s2 - 2, g_s2), 220.0), gain_db=-2.0)
    groove(dr, L, g_s2 - 2, 2, "hats", gain=-4, crash_every=0)
    fx.add(dsp.riser(secs(g_s2 - 2, g_s2), 200, 6000), L.gt(g_s2 - 2), -16)
    common_tone(fx, L, F4, L.gt(g_s2 - 2), L.gt(g_s2 + 1), pad_db, attack=0.5)

    # ---------------- S2 (B♭, 112 BPM → 後半 2 小節で 168 BPM へ加速)
    MD.place(music, L, "S2", range(0, 4), g_s2, head=0.03, tail=0.03, fin=0.06, fout=0.03,
             hp_out=(secs(g_s3 - 1, g_s3), 300.0))
    dr.hit("crash", L.gt(g_s2), -3)
    dr.hit("kick", L.gt(g_s2), -1)
    groove(dr, L, g_s2, 3, "drive", gain=-1, crash_every=0)
    dr.bar(L, g_s3 - 1, "kickhat", gain=-1)
    # 加速に合わせたスネアのビルド: 8 分 → 16 分、だんだん大きく
    steps = [s for s in range(0, 8, 2)] + list(range(8, 16))
    for i, s in enumerate(steps):
        dr.hit("snare", L.step(g_s3 - 1, s), -16 + 12 * i / (len(steps) - 1))
    for b in range(g_s3 - 2, g_s3):
        for s in (0, 8):
            dr.tr["tom"].add(kit.toms[41], L.step(b, s), -6)
    fx.add(dsp.riser(secs(g_s3 - 2, g_s3), 250, 8000), L.gt(g_s3 - 2), -12)
    common_tone(fx, L, F4, L.gt(g_s3 - 1), L.gt(g_s3 + 1), pad_db)
    dr.hit("crash", L.gt(g_s3), 2)
    dr.hit("kick", L.gt(g_s3), 0)
    fx.add(dsp.impact(), L.gt(g_s3), -9)

    # ---------------- S3 (B♭m → A♭)。9 小節目のブレイクは低音を抜きすぎず、鼓動とスネアで持ち上げる
    MD.place(music, L, "S3", range(0, 9), g_s3, head=0.005, tail=0.03, fout=0.06)
    # 原曲ではこの和音が 12dB ほど減衰していく。伸ばした分だけ持ち上げて、ブレイクが沈みすぎないようにする
    y, d0 = bb.warp([MD.beat_time("S3", 36), SEG["S3"][1] - 0.01], [L.gt(g_s3 + 9), L.gt(g_s4) - 0.02], 0.03, 0.0,
                    name=MD.key)
    y = sweep_edges(MD.process("S3", y), hp_out=(secs(g_s3 + 9, g_s4), 220.0))
    y = y * db(np.linspace(0.0, 8.0, len(y)))[:, None]
    music.add(fade(y, 0.06, 0.06), d0)
    groove(dr, L, g_s3, 8, "drive")
    dr.bar(L, g_s3 + 8, "kickhat", gain=-2)
    dr.bar(L, g_s3 + 9, "pulse", gain=-1)
    for i, s in enumerate(range(8, 16)):
        dr.hit("snare", L.step(g_s3 + 9, s), -15 + 1.5 * i)
    fx.add(dsp.reverse_crash(2 * BEAT), L.gt(g_s4) - 2 * BEAT, -3)
    fx.add(dsp.riser(secs(g_s4 - 2, g_s4), 300, 7000), L.gt(g_s4 - 2), -9)
    common_tone(fx, L, AB4, L.gt(g_s4 - 2), L.gt(g_s4 + 1), pad_db + 4)
    dr.hit("crash", L.gt(g_s4), 1)
    fx.add(dsp.impact(), L.gt(g_s4), -11)

    # ---------------- S4 (A♭m → … → E♭)。最後の小節は 3 拍目まで残し、S5 の助走と 1 拍重ねる
    MD.place(music, L, "S4", range(0, 16), g_s4, head=0.12, end_beat=3.0, tail=0.0, fin=0.03, fout=BEAT,
             hp_out=(secs(g_s5 - 2, g_s5) - BEAT, 450.0))
    groove(dr, L, g_s4, 16, "drive", last="hats")
    fx.add(dsp.snare_roll(BAR, 2, 4, 16), L.gt(g_s5 - 2), -17)
    fx.add(dsp.riser(2 * BAR, 200, 7000), L.gt(g_s5 - 2), -13)
    common_tone(fx, L, G4, L.gt(g_s5 - 1), L.gt(g_s5 + 1), pad_db)

    # ---------------- S5 (基準)。助走 2 拍を S4 の 3 拍目と重ねる
    MD.place(music, L, "S5", range(0, 32), g_s5, head=2 * BEAT, tail=0.0, fin=0.75 * BEAT, fout=0.03)
    groove(dr, L, g_s5, 32, "drive", last="kickhat")
    dr.hit("crash", L.gt(g_s5), 2)
    fx.add(dsp.impact(), L.gt(g_s5), -9)

    # ---------------- 終わり: F → E に着地して、冒頭のパッドを元の E で戻す
    dr.fill(L, g_end - 1, "toms", gain=-2)
    hit, at = MD.landing(L, g_end, "S5", m5.LAND_E[0], m5.LAND_E[1], 2)
    common_tone(fx, L, GS4, L.gt(g_end - 1), L.gt(g_end) + 3.5, pad_db)
    music.add(hit, at)
    dr.hit("crash", L.gt(g_end), 0)
    dr.hit("crash2", L.gt(g_end), -7)
    dr.hit("kick", L.gt(g_end), 0)
    fx.add(dsp.impact(3.0), L.gt(g_end), -10)
    t = 5 * BAR
    MD.place_stretch(music, L, "S1", 0.0, t, L.gt(g_end), L.gt(g_end) + t, fin=BAR, fout=2.5 * BAR,
                     pitch=m5.S1_PITCH_OUTRO, gain_db=-2)
    fx.add(dsp.downlifter(2 * BAR), L.gt(g_end), -14)
    tail_fade = (L.gt(g_end + 3), 2 * BAR + 1.0)

    # ---------------- ミックス
    fxm = fx.x[:n] + dsp.reverb(fx.x[:n], room=0.7, damp=0.5)[:n] * db(-12)
    mix, dgain = unify_mix(music.x[:n], dr.mix(n), fxm, dr.kicks, (L.gt(g_s3), L.gt(g_end)))
    print(f"  drum layer gain {dgain:+.1f} dB")
    info = bb.finish(mix, version, tail_fade=tail_fade, out_dir=OUT_DIR, build_dir=BUILD)
    info["layout"] = {k: round(L.gt(v), 3) for k, v in P.at.items()}
    info["layout"]["end"] = round(L.gt(g_end), 3)
    return info


def main():
    os.makedirs(bb.CACHE, exist_ok=True)
    os.makedirs(BUILD, exist_ok=True)
    print("building medley5r3_v4_cinematic", flush=True)
    info = build("medley5r3_v4_cinematic")
    with open(os.path.join(BUILD, "build_info.json"), "w") as f:
        json.dump([info], f, indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
