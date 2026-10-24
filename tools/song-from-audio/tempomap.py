import os, sys, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from beats import *
x = load(sys.argv[1])
env = onset_env(x)
win, hop = int(6 * FPS), int(1 * FPS)
for s in range(0, len(env) - win, hop):
    e = env[s:s + win]
    b = tempo(e, 90, 200)
    print(f'{s / FPS:6.1f} {b:6.2f}', end=' |')
    if (s // hop) % 6 == 5: print()
print()
