"""3 部構成の原曲 (assets/bgm/source/medley3_original.mp3, 1:55, モノラル) を解析して medley3_analysis.json を書き出す。

  A   0.00-35.33s  165 BPM, Gm (Gmaj7/Gm → E♭ → F → Gm)。24 小節 (0.40s が 0 小節目)
  B  35.33-80.25s  178 BPM, E♭-F-Am7-Gm7 の 4 小節ループ × 8。35.67s から 1 小節の助走、37.01s が 0 小節目
  Ad 80.25-114.6s  165 BPM, A と同じ曲。G のペダル音のブレイク 8 小節 → A の 8-23 小節とほぼ同じ内容
                   (別テイク: 波形の相関 0.5-0.8)。23 小節目の途中で切れている

小節線: この曲は 16 分の裏が強く、回帰では位相が 16 分ずれることがあるので、
8 分のグリッドの位相は「グリッド上のオンセット強度の平均が最大」になる位置で決め、
その中から構造上の目印 (A: 最初の一打 / B: 本編の頭 / Ad: ブレイクの頭) に一番近い点を 0 小節目にした。
A の終わり (35.31s)、E♭ (17.85s)・Gm (23.67s) への変化、Ad の 8 小節目 = A の 8 小節目 の対応がこれと一致する。

使い方: python3 tools/bgm/analyze_medley3.py
"""
import json
import os
import subprocess
import tempfile

import librosa
import numpy as np

import analyze_source as an

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(ROOT, "assets", "bgm", "source", "medley3_original.mp3")
OUT = os.path.join(HERE, "medley3_analysis.json")
SR = an.SR

SEGMENTS = {"A": (0.0, 35.33), "B": (35.33, 80.25), "Ad": (80.25, 114.62)}
# (解析区間, 初期 BPM, 初期位相, 0 小節目の目印)
SEEDS = {"A": ((0.4, 35.2), 165.0, 0.2, 0.40),
         "B": ((37.0, 80.0), 178.0, 37.1, 37.0),
         "Ad": ((80.3, 114.4), 165.0, 80.4, 80.28)}


def comb_phase(oenv, a, b, bpm, fps):
    per = 30.0 / bpm
    best = (-1.0, a)
    for ph in np.arange(a, a + per, 0.001):
        ks = np.arange(0, int((b - ph) / per))
        v = oenv[((ph + ks * per) * fps).astype(int)].mean()
        if v > best[0]:
            best = (v, ph)
    return best[1]


def main():
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "m.wav")
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", SRC,
                        "-ac", "1", "-ar", str(SR), wav], check=True)
        y, _ = librosa.load(wav, sr=SR, mono=True)
    oenv = librosa.onset.onset_strength(y=y, sr=SR, hop_length=an.HOP)
    o64 = librosa.onset.onset_strength(y=y, sr=SR, hop_length=64)
    res = {"sample_rate": SR, "segments": SEGMENTS, "songs": {}}
    for k, ((a, b), bpm0, ph0, anchor) in SEEDS.items():
        bpm, _, r = an.fit_grid(oenv, a, b, bpm0, ph0)
        ph = comb_phase(o64, a, b, bpm, SR / 64)
        per8 = 30.0 / bpm
        bar0 = ph + round((anchor - ph) / per8) * per8
        res["songs"][k] = {"bpm": bpm, "bar0": bar0, "fit_residual_ms": r,
                           "tuning_cents": an.tuning_cents(y, SEGMENTS[k][0] + 0.2, SEGMENTS[k][1] - 0.2)}
        print(f"{k}: {bpm:.3f} BPM bar0={bar0:.4f}s tuning={res['songs'][k]['tuning_cents']:+.0f}c")
    with open(OUT, "w") as f:
        json.dump(res, f, indent=1, ensure_ascii=False)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
