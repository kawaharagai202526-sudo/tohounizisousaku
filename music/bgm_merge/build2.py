"""2026-11-08 の原曲 (YouCut_20261108_154314344_1.mp3, 1:55) を 1 曲に仕上げる.

使い方: python3 build2.py <原曲から変換した wav> <作業ディレクトリ>

原曲の構成 (すべて G マイナー):
  曲1  0.35〜35.45  165 BPM. 24 小節 (12 小節の G ペダル + E♭-F-G / Cm-F-D7). 25 小節目の頭で切れている
  曲2 35.45〜80.4   178 BPM. 1 小節のドラムフィル + 8 小節 × 4 = 32 小節 (E♭-F-F#dim-Gm). 全体の基準
  曲3 80.2〜114.6   165 BPM. 8 小節の G ペダルのブレイク + 曲1 の 9〜24 小節目の別テイク. 最終小節の途中で切れている

仕上げ方:
  - 曲1・曲3 を 178 BPM に速め (+7.9%, 音程はそのまま), 小節の長さを曲2 と完全に揃える
  - 曲1・曲3 の音色バランスと音圧を曲2 に合わせる (重い低域を抑え中高域を出す EQ + コンプ + ラウドネス)
  - 曲1 の最後の D7 → 曲2 のフィル → 曲2 の E♭ (偽終止) / 曲2 の最後の Gm → 曲3 の G ペダル を小節頭で接続
  - 曲3 の欠けた最後の 2 拍を曲1 の同じ箇所で補い, わずかにリタルダンドして主和音 Gm の一打 + 残響で終える
"""
import json
import sys

import numpy as np
import pedalboard as pb

import dsp

# ---- 原曲上の時刻 [秒] (拍位置は中域オンセットの平均位置で揃えて測ったもの)
A0, A_P = 0.3667, 0.36365          # 曲1 の 1 小節目 1 拍目 / 拍周期 (164.99 BPM)
B0, B_P = 36.989, 0.33704          # 曲2 の 1 小節目 1 拍目 / 拍周期 (178.02 BPM)
C0 = A0 + 79.8754                  # 曲3 の 1 小節目 (曲1 と同じグリッドで 79.8754 秒後)
B_SPLICE = 35.45                   # 原曲で曲2 が始まる位置 (フィル小節の 8 分 1 個前)
B_TAIL_END = 80.45                 # 曲2 の最後のクラッシュの余韻の終わり

SPEED = A_P / B_P                  # 1.0790: 曲1・曲3 を曲2 のテンポへ
BAR = 4 * B_P                      # 出力の 1 小節 (1.348 秒)
T_A0 = 0.08                        # 出力上の曲1 1 拍目
LUFS_MAIN = -12.3                  # 曲1・曲3 本編の目標 (曲2 は -12.0)
COMP_RATIO = 2.5                   # 曲1・曲3 のコンプ (曲2 のクレストファクタ 11.4 dB に近づける)


def a_beat(k):
    return A0 + k * A_P


def c_beat(k):
    return C0 + k * A_P


def tone_chain(x, curve, comp_db, gain_db):
    """曲2 に寄せる音色・音圧処理 (EQ → コンプ → ゲイン)."""
    y = dsp.apply_eq_curve(x, *curve)
    comp = pb.Compressor(threshold_db=comp_db, ratio=COMP_RATIO, attack_ms=8.0, release_ms=120.0)
    y = comp(y.T.copy(), dsp.SR).T.astype(np.float32)
    return y * np.float32(10 ** (gain_db / 20))


def final_chord(orig, curve, comp_db, gain_db):
    """曲1 冒頭の Gm の一打を終止和音に: 打点 + 和音のフリーズ + 残響 (約 5 秒)."""
    hit = dsp.cut(orig, A0 - 0.05, A0 + 0.40)
    hit = dsp.stretch(hit, speed=SPEED)
    hit = tone_chain(hit, curve, comp_db, gain_db)
    body = dsp.fades(hit, fout=0.25)
    chord = hit[dsp.n(0.12):dsp.n(0.34)]
    frz = dsp.spectral_freeze(chord, 5.0, decay_s=1.4)
    frz = dsp.butter_f(frz, 7000, "low", 2)
    frz *= 10 ** ((dsp.db(chord) - 6.0 - dsp.db(frz[: dsp.n(0.3)])) / 20)
    frz[: dsp.n(0.15)] *= dsp.ramp(dsp.n(0.15), "in")
    rev = dsp.reverb(body, room=0.9, damping=0.45, wet=1.0, dry=0.0, tail=5.0)
    out = np.zeros((dsp.n(5.4), 2), np.float32)
    out[: len(body)] += body
    out[: len(rev)] += rev[: len(out)] * 0.45
    out[dsp.n(0.05): dsp.n(0.05) + len(frz)] += frz[: len(out) - dsp.n(0.05)]
    return dsp.fades(out, fout=2.5)


def main(src, work):
    orig = dsp.load(src)
    ref_b = dsp.cut(orig, B0, B0 + 32 * BAR)
    marks = {}

    # ---- 曲1・曲3 をテンポ合わせ
    a_raw = dsp.cut(orig, A0 - 0.06, a_beat(96) + 0.02)            # 24 小節 (+ 余白)
    c_raw = dsp.cut(orig, C0 - 0.04, c_beat(94) + 0.03)            # 23 小節 + 2 拍
    end_raw = dsp.cut(orig, a_beat(94) - 0.03, a_beat(96) + 0.01)  # 曲3 に欠けている最後の 2 拍
    a_st = dsp.stretch(a_raw, speed=SPEED)
    c_st = dsp.stretch(c_raw, speed=SPEED)
    rit = np.linspace(SPEED, SPEED * 0.88, len(end_raw))  # 最後の 2 拍をわずかに遅く (リタルダンド)
    end_st = dsp.stretch(end_raw, speed=rit)

    # ---- 音色・音圧を曲2 へ
    curve_a = dsp.match_eq_curve(ref_b, a_st[dsp.n(17.5 / SPEED):], amount=0.7, limit_db=9.0)
    curve_c = dsp.match_eq_curve(ref_b, c_st[dsp.n(11.7 / SPEED):], amount=0.7, limit_db=9.0)
    comp_db = -20.0

    def level(x, curve, region):
        y = tone_chain(x[region], curve, comp_db, 0.0)
        return LUFS_MAIN - dsp.lufs(y)
    g_a = level(a_st, curve_a, slice(dsp.n(17.5 / SPEED), None))
    g_c = level(c_st, curve_c, slice(dsp.n(11.7 / SPEED), None))
    a_pr = tone_chain(a_st, curve_a, comp_db, g_a)
    c_pr = tone_chain(c_st, curve_c, comp_db, g_c)
    end_pr = tone_chain(end_st, curve_a, comp_db, g_a)
    marks.update(gain_a_db=g_a, gain_c_db=g_c,
                 eq_a={str(f): round(float(np.interp(f, *curve_a)), 1) for f in (60, 120, 250, 500, 1000, 2000, 4000, 8000)},
                 eq_c={str(f): round(float(np.interp(f, *curve_c)), 1) for f in (60, 120, 250, 500, 1000, 2000, 4000, 8000)})

    tl = dsp.Timeline(130)

    # ---- 曲1: 24 小節
    a_start = T_A0 - 0.06 / SPEED
    t_b_fill = T_A0 + 24 * BAR                        # 曲2 のフィル小節の頭 = 曲1 の 25 小節目
    xf = (B0 - BAR - B_SPLICE)                        # フィル前の 8 分ぶん重ねる
    a_end = dsp.n(t_b_fill - a_start)
    a_pr = a_pr[: a_end + dsp.n(0.01)]
    k = dsp.n(xf)
    a_pr[-k:] *= dsp.ramp(k, "out")
    tl.add(a_pr, a_start)

    # ---- 曲2: フィル + 32 小節 (無加工)
    t_b0 = t_b_fill + BAR
    b = dsp.cut(orig, B_SPLICE, B_TAIL_END)
    b = dsp.fades(b, fin=0.005)
    fo = dsp.n(B_TAIL_END - (B0 + 32 * BAR) - 0.05)
    b[-fo:] *= dsp.ramp(fo, "out")
    tl.add(b, t_b0 - (B0 - B_SPLICE))
    t_c0 = t_b0 + 32 * BAR
    marks.update(song1_end=t_b_fill, song2_downbeat=t_b0, song3_start=t_c0)

    # ---- 曲3: ブレイク 8 小節 + 16 小節 (最後の 2 拍は曲1 から)
    c_pr = dsp.fades(c_pr, fin=0.03)
    t_end94 = t_c0 + 94 * B_P                        # 曲3 の 94 拍目 (= 24 小節目 3 拍目)
    cut94 = dsp.n(t_end94 - (t_c0 - 0.04 / SPEED))
    c_pr = c_pr[: cut94 + dsp.n(0.004)]
    c_pr[-dsp.n(0.03):] *= dsp.ramp(dsp.n(0.03), "out")
    tl.add(c_pr, t_c0 - 0.04 / SPEED)
    end_pr = dsp.fades(end_pr, fin=0.03)
    tl.add(end_pr, t_end94 - 0.03 / SPEED)
    t_final = t_end94 - 0.03 / SPEED + len(end_pr) / dsp.SR - 0.01 / (SPEED * 0.88)

    # ---- 終止和音 (Gm)
    fc = final_chord(orig, curve_a, comp_db, g_a)
    tl.add(fc, t_final - 0.05 / SPEED)
    end = t_final + len(fc) / dsp.SR
    marks.update(song3_last2beats=t_end94, final_chord=t_final, end=end)

    mix = tl.buf[: dsp.n(end)]
    marks["pre_limiter_peak_db"] = float(20 * np.log10(np.abs(mix).max()))
    master = dsp.limiter(mix)
    marks.update(lufs=dsp.lufs(master), seconds=len(master) / dsp.SR)
    dsp.save(f"{work}/final2.wav", master)
    json.dump(marks, open(f"{work}/final2_marks.json", "w"), indent=1, default=float)
    print(json.dumps(marks, indent=1, default=float))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
