"""5 曲つなぎの原曲 (assets/bgm/source/medley5_original.mp3) を解析して medley5_analysis.json を書き出す。

境目はステレオ幅・明るさ・自己類似度の変化から求めた:
  S1  0.00-13.15s  パッドのみ (E のペダル + Emaj7sus4 系)。L/R が無相関の広いステレオ。+14 セント高い
  S2 13.15-26.00s  110 BPM, B♭ 一発のループ。ステレオ。低音が多い
  S3 26.00-39.05s  177 BPM, B♭m → A♭ 系。8 小節目でビルド、9 小節目は和音を伸ばすブレイク (途中で切れる)
  S4 39.17-62.30s  170 BPM, A♭m から転調を繰り返し E♭ で終わる。16 小節 + 途中で切れた小節
  S5 62.30-108.4s  168 BPM, C-D-Bm-Em (王道進行)。62.30 から助走、62.96 が 0 小節目。32 小節目の途中で切れる
各曲の小節頭は「曲の始まり / ビルド・ブレイクの位置 / 和音の変わり目」が揃う位置を採用した。

使い方: python3 tools/bgm/analyze_medley5.py
"""
import json
import os
import subprocess
import tempfile

import librosa

import analyze_source as an

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(ROOT, "assets", "bgm", "source", "medley5_original.mp3")
OUT = os.path.join(HERE, "medley5_analysis.json")
SR = an.SR

SEGMENTS = {"S1": (0.0, 13.15), "S2": (13.15, 26.0), "S3": (26.0, 39.05), "S4": (39.17, 62.3), "S5": (62.3, 108.4)}
# (fit 区間, 初期 BPM, 初期位相, 8 分の位相から小節頭までのずらし[8 分の数])
GRID_SEEDS = {"S2": ((13.3, 25.9), 110.0, 13.52, 1),
              "S3": ((26.1, 36.5), 177.0, 26.172, -1),
              "S4": ((39.5, 62.6), 170.0, 39.52, -2),
              "S5": ((63.0, 108.3), 168.0, 63.14, -1)}


def main():
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "m.wav")
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", SRC,
                        "-ac", "1", "-ar", str(SR), wav], check=True)
        y, _ = librosa.load(wav, sr=SR, mono=True)
    oenv = librosa.onset.onset_strength(y=y, sr=SR, hop_length=an.HOP)
    res = {"sample_rate": SR, "segments": SEGMENTS, "songs": {}}
    for k, (a, b) in SEGMENTS.items():
        res["songs"][k] = {"tuning_cents": an.tuning_cents(y, a + 0.2, b - 0.2)}
    for k, ((a, b), bpm0, ph0, shift) in GRID_SEEDS.items():
        bpm, ph, r = an.fit_grid(oenv, a, b, bpm0, ph0)
        bar0 = ph + shift * 30.0 / bpm
        res["songs"][k].update({"bpm": bpm, "bar0": bar0, "fit_residual_ms": r})
        print(f"{k}: {bpm:.3f} BPM bar0={bar0:.4f}s resid={r:.1f}ms tuning={res['songs'][k]['tuning_cents']:+.0f}c")
    print(f"S1: tuning={res['songs']['S1']['tuning_cents']:+.0f}c (テンポなし)")
    with open(OUT, "w") as f:
        json.dump(res, f, indent=1, ensure_ascii=False)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
