# Basic Pitch の出力から主旋律を1本取り出す
import numpy as np
FPS = 22050 / 256
def melody_path(note, lo=55, hi=96, jump=0.35, prior=0.02, voice_th=0.25):
    """note: (T, 88)。lo〜hi の範囲で、高めの音と、なめらかなつながりを好む道筋"""
    P = note[:, lo - 21:hi - 21 + 1]  # (T, n)
    n = P.shape[1]
    # 無音（旋律なし）を状態 n として足す
    T = P.shape[0]
    pitch_bonus = prior * np.arange(n)  # 高い音ほど少しだけ有利
    obs = np.log(P + 1e-3) + pitch_bonus
    obs_rest = np.full(T, np.log(voice_th))
    d = np.abs(np.arange(n)[:, None] - np.arange(n)[None, :])
    trans = -jump * np.minimum(d, 12) ** 0.8
    score = np.concatenate([obs[0], [obs_rest[0]]])
    back = np.zeros((T, n + 1), np.int32)
    tr = np.full((n + 1, n + 1), -1.5)
    tr[:n, :n] = trans
    tr[n, n] = 0
    for t in range(1, T):
        cand = score[None, :] + tr
        back[t] = cand.argmax(1)
        score = cand.max(1) + np.concatenate([obs[t], [obs_rest[t]]])
    path = np.zeros(T, np.int32)
    path[-1] = score.argmax()
    for t in range(T - 1, 0, -1):
        path[t - 1] = back[t, path[t]]
    mel = np.where(path < n, path + lo, -1)
    return mel
