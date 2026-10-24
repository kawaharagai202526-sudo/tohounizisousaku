# 拍の検出（Ellis の動的計画法）
import numpy as np
from ana import *
FPS = SR / HOP

def beat_track(env, bpm, tight=100.0):
    period = 60 * FPS / bpm
    n = len(env)
    score = env.copy().astype(float)
    back = -np.ones(n, int)
    lo, hi = int(period * 0.5), int(period * 2)
    taus = np.arange(lo, hi + 1)
    pen = -tight * (np.log(taus / period)) ** 2
    for t in range(hi, n):
        cand = score[t - taus] + pen
        k = cand.argmax()
        score[t] += cand[k]
        back[t] = t - taus[k]
    # 終わりの近くで一番よいところから戻る
    tail = np.arange(max(0, n - int(period)), n)
    t = tail[score[tail].argmax()]
    beats = []
    while t >= 0:
        beats.append(t)
        t = back[t]
    return np.array(beats[::-1]) / FPS

def refine_bpm(env, lo, hi):
    return tempo(env, lo, hi)
