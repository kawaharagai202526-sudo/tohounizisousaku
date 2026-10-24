# つなぎ目の候補：コードの響き（クロマ）の自己類似行列に市松模様のカーネルをかけた新しさの山
import os, sys, numpy as np, scipy.signal as ss
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ana import *
FPS = SR / HOP
d = np.load(sys.argv[1]); note = d['note']
x = load(sys.argv[2])
# 0.5 秒ごとのクロマ
step = int(FPS * 0.5)
T = note.shape[0] // step
C = np.zeros((T, 12))
for i in range(T):
    seg = note[i * step:(i + 1) * step].sum(0)
    for k in range(88): C[i, (k + 21) % 12] += seg[k]
C /= (np.linalg.norm(C, axis=1, keepdims=True) + 1e-9)
S = C @ C.T
K = 16
g = np.outer(np.r_[-np.ones(K), np.ones(K)], np.r_[-np.ones(K), np.ones(K)])
nov = np.zeros(T)
for i in range(K, T - K):
    nov[i] = (S[i - K:i + K, i - K:i + K] * g).sum()
nov = np.maximum(nov, 0); nov /= nov.max() + 1e-9
# 音量の急な変化も見る
rms = np.array([np.sqrt((x[int(i * 0.5 * SR):int((i + 1) * 0.5 * SR)] ** 2).mean()) for i in range(T)])
pk, _ = ss.find_peaks(nov, height=0.25, distance=8)
for p in pk:
    print(f'{p * 0.5:7.1f}s  novelty {nov[p]:.2f}  rms {rms[max(0,p-2)]:.3f}->{rms[min(T-1,p+2)]:.3f}')
