"""原曲 (assets/bgm/source/original.m4a) を解析して source_analysis.json を書き出す。

原曲は 3 曲を繋いだもので、境目は動画の場面転換 (32.25s / 80.17s) と一致する。
  P1: 0.00 - 32.25s  162 BPM 付近, D#m (D#-E-F#-E のループ) + D#sus4 のブレイク
  P2: 32.25 - 80.17s 166 BPM 付近, F#m -> Gm (57.0s で半音上へ転調)  ※全体の基準
  P3: 80.17 - 153.8s 160 BPM 前後で揺れる, Eb/Bb 系, チューニングが約 +17 セント高い

P1/P2 はテンポが一定なので「拍グリッド (BPM と 1 拍目の時刻)」を回帰で求める。
P3 はテンポが揺れるので拍を個別に追跡し、平滑化した拍時刻の列を保存する。

使い方: python3 tools/bgm/analyze_source.py               # 原曲
      python3 tools/bgm/analyze_source.py --new-part1   # 差し替え用の新しい 1 曲目
"""
import json
import os
import subprocess
import sys
import tempfile

import librosa
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(ROOT, "assets", "bgm", "source", "original.m4a")
OUT = os.path.join(HERE, "source_analysis.json")

SR = 44100
HOP = 128
FPS = SR / HOP

# 区間の境目 (秒)。動画の場面転換とノベルティ解析の両方で確認した値。
P1_RANGE = (1.0, 32.25)
P2_RANGE = (32.25, 80.17)
P3_RANGE = (80.17, 153.78)


def load_mono():
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "src.wav")
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", SRC,
                        "-ac", "1", "-ar", str(SR), wav], check=True)
        y, _ = librosa.load(wav, sr=SR, mono=True)
    return y


def fit_grid(oenv, a, b, bpm, phase, div=2):
    """おおよその BPM/位相から、拍 (div 分割) 付近のオンセットに直線を当てはめて精密化する。"""
    per = 60.0 / bpm / div
    k0 = int(np.ceil((a - phase) / per))
    k1 = int((b - phase) / per)
    thr = np.percentile(oenv[int(a * FPS):int(b * FPS)], 80)
    ts, ks = [], []
    for k in range(k0, k1):
        i = int((phase + k * per) * FPS)
        w = int(0.035 * FPS)
        seg = oenv[max(0, i - w):i + w]
        if len(seg) == 0:
            continue
        j = int(np.argmax(seg))
        if seg[j] > thr:
            ts.append((max(0, i - w) + j) / FPS)
            ks.append(k)
    ts, ks = np.array(ts), np.array(ks, dtype=float)
    A = np.vstack([ks, np.ones_like(ks)]).T
    for _ in range(3):
        sol = np.linalg.lstsq(A, ts, rcond=None)[0]
        r = ts - A @ sol
        keep = np.abs(r) < 2.5 * np.std(r) + 1e-4
        A, ts, ks = A[keep], ts[keep], ks[keep]
    per2, ph2 = sol
    return 60.0 / per2 / div, float(ph2), float(np.std(ts - A @ sol) * 1000)


def smooth_beats(bt, half_window=8):
    """拍時刻の揺れ (検出誤差) を局所一次回帰でならす。テンポの緩やかな揺れは残す。"""
    idx = np.arange(len(bt), dtype=float)
    out = np.empty_like(bt)
    for i in range(len(bt)):
        lo, hi = max(0, i - half_window), min(len(bt), i + half_window + 1)
        x, t = idx[lo:hi], bt[lo:hi]
        w = 1.0 - np.abs(x - i) / (half_window + 1)
        W = np.sqrt(w)
        A = np.vstack([x, np.ones_like(x)]).T * W[:, None]
        sol = np.linalg.lstsq(A, t * W, rcond=None)[0]
        out[i] = sol[0] * i + sol[1]
    return out


def tuning_cents(y, a, b):
    ys = y[int(a * SR):int(b * SR)]
    ys = librosa.resample(ys, orig_sr=SR, target_sr=22050)
    p, m = librosa.piptrack(y=ys, sr=22050, n_fft=8192, hop_length=1024, fmin=80, fmax=2000, threshold=0.1)
    f = p[m > np.percentile(m[m > 0], 70)]
    f = f[f > 0]
    return float(librosa.pitch_tuning(f, resolution=0.01) * 100)


NEW_P1_SRC = os.path.join(ROOT, "assets", "bgm", "source", "new_part1.m4a")
NEW_P1_OUT = os.path.join(HERE, "new_part1_analysis.json")


def analyze_new_part1():
    """差し替え用の新しい 1 曲目 (new_part1.m4a, 約 21 秒) を解析する。
    前半 8 小節は 159BPM、9 小節目 (ブレイク) から 152BPM に変わる。
      0-7 小節: 本編 / 8-9 小節: ブレイク (低音なし) / 10-12 小節: 再開 / 13 小節目は途中で切れている"""
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "p1.wav")
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", NEW_P1_SRC,
                        "-ac", "1", "-ar", str(SR), wav], check=True)
        y, _ = librosa.load(wav, sr=SR, mono=True)
    oenv = librosa.onset.onset_strength(y=y, sr=SR, hop_length=HOP)
    bpm1, beat0, res1 = fit_grid(oenv, 1.8, 13.8, 159.0, 1.811)
    change = beat0 + 32 * 60.0 / bpm1          # 8 小節目の頭でテンポが変わる

    def score(bpm):
        per = 60.0 / bpm / 4
        ks = np.arange(1, int((21.8 - change) / per))
        return oenv[((change + ks * per) * FPS).astype(int)].mean()
    cands = np.arange(148.0, 156.0, 0.02)
    bpm2 = float(cands[int(np.argmax([score(b) for b in cands]))])
    res = {"sample_rate": SR, "bpm1": bpm1, "beat0": beat0, "fit_residual_ms": res1,
           "change_beat": 32, "bpm2": bpm2, "bars_complete": 13,
           "sections": {"main": [0, 8], "break": [8, 10], "return": [10, 13]},
           "tuning_cents": tuning_cents(y, 1.8, 22.8)}
    with open(NEW_P1_OUT, "w") as f:
        json.dump(res, f, indent=1, ensure_ascii=False)
    print(f"new P1: {bpm1:.3f} BPM (bars 0-7) beat0={beat0:.4f} resid={res1:.1f}ms, "
          f"{bpm2:.2f} BPM from {change:.3f}s, tuning={res['tuning_cents']:+.0f}c")


def main():
    if "--new-part1" in sys.argv:
        analyze_new_part1()
        return
    y = load_mono()
    oenv = librosa.onset.onset_strength(y=y, sr=SR, hop_length=HOP)

    p1_bpm, p1_beat0, p1_res = fit_grid(oenv, 1.0, 24.8, 162.0, 1.062)
    p2_bpm, p2_beat0, p2_res = fit_grid(oenv, 33.7, 80.1, 166.0, 33.873)

    # P3: 拍追跡 (テンポ可変)。最初の拍から 1 拍後が小節頭 (コード変化の位相解析より)。
    a = P3_RANGE[0]
    ys = y[int(a * SR):]
    o3 = librosa.onset.onset_strength(y=ys, sr=SR, hop_length=HOP)
    _, beats = librosa.beat.beat_track(onset_envelope=o3, sr=SR, hop_length=HOP, start_bpm=160, tightness=800)
    bt = beats / FPS + a
    bt_s = smooth_beats(bt)
    # 前後を外挿して P3 区間全体を拍で覆う (前: イントロ, 後: 余韻)
    p_head = np.median(np.diff(bt_s[:8]))
    p_tail = np.median(np.diff(bt_s[-8:]))
    head = [bt_s[0] - p_head * i for i in range(5, 0, -1)]
    tail = []
    t = bt_s[-1]
    while t < P3_RANGE[1] + 2 * p_tail:
        t += p_tail
        tail.append(t)
    beats_all = np.r_[head, bt_s, tail]
    first_bar_beat = 5 + 1  # head(5拍) + 追跡1拍目の次 = P3 の 0 小節目の頭

    res = {
        "sample_rate": SR,
        "segments": {"P1": P1_RANGE, "P2": P2_RANGE, "P3": P3_RANGE},
        "P1": {"bpm": p1_bpm, "beat0": p1_beat0, "fit_residual_ms": p1_res,
               "bars_main": 16, "bars_breakdown": 5,
               "tuning_cents": tuning_cents(y, 1.0, 32.0)},
        "P2": {"bpm": p2_bpm, "beat0": p2_beat0, "fit_residual_ms": p2_res,
               "pickup_bar": -1, "bars": 32, "modulation_bar": 16,
               "tuning_cents": tuning_cents(y, 33.0, 80.0)},
        "P3": {"beats": [round(float(b), 5) for b in beats_all], "bar0_beat_index": first_bar_beat,
               "tracked_beats": int(len(bt)), "local_bpm_range": [
                   float(60 / np.max(np.diff(bt_s))), float(60 / np.min(np.diff(bt_s)))],
               "tuning_cents": tuning_cents(y, 80.2, 153.0)},
    }
    with open(OUT, "w") as f:
        json.dump(res, f, indent=1, ensure_ascii=False)
    print(f"P1 {p1_bpm:.3f} BPM beat0={p1_beat0:.4f} resid={p1_res:.1f}ms tuning={res['P1']['tuning_cents']:+.0f}c")
    print(f"P2 {p2_bpm:.3f} BPM beat0={p2_beat0:.4f} resid={p2_res:.1f}ms tuning={res['P2']['tuning_cents']:+.0f}c")
    print(f"P3 beats={len(beats_all)} bar0={beats_all[first_bar_beat]:.3f}s "
          f"local BPM {res['P3']['local_bpm_range'][0]:.1f}-{res['P3']['local_bpm_range'][1]:.1f} "
          f"tuning={res['P3']['tuning_cents']:+.0f}c")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
