"""3 曲が連結された原曲から、繋ぎ目を整えた 1 曲を組み立てる.

使い方: python3 build.py <原曲 wav/mp4 から抽出した wav> <作業ディレクトリ>

構成 (原曲の時刻):
  曲1   2.30 〜 83.3  ほぼそのまま. 末尾の急なカットを、最後の Dm 和音の残響 + ダウンリフターに置換
  曲2  83.38 〜 147.42 イントロ〜本編〜加速ロールのクライマックスまで (全体の基準)
  曲3 161.34 〜 269.37 ロールの着地点 (曲2 の小節頭) に曲3 の一打目を合わせてドロップ.
                       曲2 に寄せる加工は song3.py
  終曲  曲2 のアウトロ (147.42〜161.3) を +2 半音 (F→G) 移調し、曲3 の最後の小節頭から接続
"""
import json
import sys

import numpy as np

import dsp
import song3

OFF = 2.30               # 冒頭の無音を詰める量
S1_END = 83.33           # 曲1 のドライ音を消し切る位置 (原曲はここで急に切れる)
S2_START = 83.38         # 曲2 の開始
S2_DROP = 147.4176       # 曲2 のクライマックス後の小節頭 (原曲では B♭ の打点)
S2_OUTRO_END = 161.30

G_SONG2 = 2.5            # 曲2 は他より 5dB ほど小さいので持ち上げる
LUFS_SONG3 = -13.0       # 曲3 本編の目標ラウドネス (曲1 本編は -12.1)


def t(orig_time):
    """原曲時刻 → 出力時刻 (曲2 まで)."""
    return orig_time - OFF


def song1_tail(orig):
    """曲1 最後の Dm 和音を残響で伸ばし、ローパスで閉じていく (約 5 秒)."""
    chord = dsp.cut(orig, 82.58, 83.15)
    frz = dsp.spectral_freeze(chord, 5.0, decay_s=1.5)
    frz *= 10 ** ((dsp.db(chord) - 3.0 - dsp.db(frz[: dsp.n(0.3)])) / 20)
    src = dsp.fades(dsp.cut(orig, 82.0, 83.30), fout=0.15)
    rev = dsp.reverb(src, room=0.92, damping=0.4, wet=1.0, dry=0.0, tail=5.5)[dsp.n(1.05):]
    rev = rev[: len(frz)]
    rev *= 10 ** ((dsp.db(chord) - 6.0 - dsp.db(rev[: dsp.n(0.3)])) / 20)
    tail = frz + rev
    tail = dsp.lowpass_sweep(tail, 0.1, 4.0, 9000, 300)
    tail[: dsp.n(0.25)] *= dsp.ramp(dsp.n(0.25), "in")
    return dsp.fades(tail, fout=2.0)


def coda(orig, gain_db):
    """曲2 のアウトロを G へ移調して終曲に. 戻り値の 0 秒 = 打点."""
    pre = 0.02
    x = dsp.cut(orig, S2_DROP - pre, S2_OUTRO_END)
    x = dsp.stretch(x, speed=1.0, semitones=2.0)
    x = x * 10 ** (gain_db / 20)
    x = x + dsp.reverb(dsp.butter_f(x, 250, "high", 2), room=0.9, damping=0.45, wet=1.0, dry=0.0, tail=5.0)[: len(x)] * 0.22
    rev = dsp.reverb(x[-dsp.n(3.0):], room=0.93, damping=0.5, wet=1.0, dry=0.0, tail=6.0)[dsp.n(3.0):] * 0.35
    x = np.concatenate([x, np.zeros((len(rev), 2), np.float32)])
    x[-len(rev):] += rev
    # 最後の和音が自然に消えるところ (-60 dBFS) で切り、末尾 2 秒だけフェード
    hop = dsp.n(0.05)
    rms = np.array([dsp.db(x[i:i + hop]) for i in range(0, len(x) - hop, hop)])
    last = (np.nonzero(rms > -60.0)[0].max() + 1) * hop
    return dsp.fades(x[:last], fout=2.0), pre


def drop_impact():
    """ドロップに薄くクラッシュ風ノイズを足す (低域は曲3 自身の 808 に任せる)."""
    L = dsp.n(2.2)
    tt = np.arange(L) / dsp.SR
    crash = dsp.butter_f(dsp.noise(L), 3500, "high", 2) * np.exp(-tt / 0.55)[:, None]
    crash *= 10 ** (-24.0 / 20) / (np.abs(crash).max() + 1e-9)
    return crash + dsp.reverb(crash, room=0.85, wet=1.0, dry=0.0)[:L] * 0.5


def main(src, work):
    orig = dsp.load(src)
    tl = dsp.Timeline(330)
    marks = {}

    # ---- 曲1 (そのまま) + 残響テール
    s1 = dsp.cut(orig, OFF, S1_END)
    k = dsp.n(S1_END - 83.05)
    s1[-k:] *= dsp.ramp(k, "out")
    tl.add(s1, 0.0)
    tl.add(song1_tail(orig), t(83.05))
    tl.add(dsp.downlifter(2.8, peak_db=-27.0), t(83.25))
    marks["song1_end"] = t(83.3)

    # ---- 曲2 (イントロ〜クライマックス)
    s2 = dsp.cut(orig, S2_START, S2_DROP - 0.002)
    s2 = dsp.fades(s2, fin=0.06, fout=0.015)
    # 本編は +2.5dB、元々大きいクライマックス (136.6〜) は持ち上げない
    s2 = dsp.gain_curve(s2, [0, 135.6 - S2_START, 136.5 - S2_START, len(s2) / dsp.SR], [G_SONG2, G_SONG2, 0.3, 0.3])
    tl.add(s2, t(S2_START))
    marks["song2_start"] = t(S2_START)
    drop = t(S2_DROP)
    marks["drop"] = drop

    # ---- 曲3 (曲2 の曲調へ)
    ref = dsp.cut(orig, 106.0, 146.0)
    s3, _pad, meta, _log = song3.build(orig, ref, cache_dir=work)
    body = s3[dsp.n(meta["groove_start"]):dsp.n(meta["restart"] - 3.0)]
    g3 = LUFS_SONG3 - dsp.lufs(body)
    s3_at = drop - meta["hit0"]
    gs = meta["groove_start"]
    s3 = dsp.gain_curve(s3, [0, gs - 0.6, gs + 0.4, len(s3) / dsp.SR], [2.0, 2.0, 0, 0])  # 疎なイントロを少し前へ
    tl.add(s3, s3_at, gain_db=g3)
    tl.add(drop_impact(), drop)
    marks.update(song3_restart=s3_at + meta["restart"], song3_final=s3_at + meta["final"], song3_gain_db=g3)

    # ---- 終曲 (曲2 アウトロを G に移調)
    cd, pre = coda(orig, G_SONG2 + 1.0)
    final = s3_at + meta["final"]
    tl.add(dsp.reverse_swell(cd[dsp.n(pre):], 1.2, peak_db=-20.0), final - 1.2)
    tl.add(cd, final - pre)
    end = final - pre + len(cd) / dsp.SR
    marks["end"] = end

    mix = tl.buf[: dsp.n(end)]
    pre_peak = 20 * np.log10(np.abs(mix).max())
    master = dsp.limiter(mix)
    marks.update(pre_limiter_peak_db=pre_peak, lufs=dsp.lufs(master), seconds=len(master) / dsp.SR)
    dsp.save(f"{work}/final.wav", master)
    json.dump(dict(marks=marks, song3=meta), open(f"{work}/final_marks.json", "w"), indent=1, default=float)
    print(json.dumps(marks, indent=1, default=float))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
