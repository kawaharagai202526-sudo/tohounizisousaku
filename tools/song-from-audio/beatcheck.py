import os, sys, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from beats import *
x = load(sys.argv[1]); a, b, bpm = float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
env = onset_env(x)
e = env[int(a * FPS):int(b * FPS)]
bpm2 = tempo(e, bpm * 0.9, bpm * 1.1)
bt = beat_track(e, bpm2) + a
ibi = np.diff(bt)
print(f'bpm {bpm2:.2f}  beats {len(bt)}  ibi mean {ibi.mean():.4f} -> {60/ibi.mean():.2f}bpm  std {ibi.std():.4f}')
bad = np.where(np.abs(ibi / np.median(ibi) - 1) > 0.12)[0]
for i in bad[:20]: print(f'  odd beat at {bt[i]:.2f}s ibi {ibi[i]:.3f}')
