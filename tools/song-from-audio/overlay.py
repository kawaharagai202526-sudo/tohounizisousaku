# 取り出した旋律（16分の升目にそろえたもの）を、元の音の出やすさの図に重ねる
import os, sys, json, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from assemble import *
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
FPS = 22050 / 256
an = json.load(open(sys.argv[1])); d = np.load(sys.argv[2]); a, b = float(sys.argv[3]), float(sys.argv[4])
note = d['note']
fig, ax = plt.subplots(figsize=(22, 7))
ax.imshow(note[int(a * FPS):int(b * FPS), 40 - 21:96 - 21].T, aspect='auto', origin='lower', extent=[a, b, 40, 96], cmap='magma')
for sec in an:
    bars = sec['bars']
    for bi, bar in enumerate(bars):
        t0 = bar['t']; t1 = bars[bi + 1]['t'] if bi + 1 < len(bars) else t0 + 240 / sec['bpm']
        if t1 < a or t0 > b: continue
        ax.axvline(t0, color='w', lw=0.6, alpha=0.6)
        ax.text(t0, 94, ' '.join(bar['chords']), color='w', fontsize=8)
        sl = (t1 - t0) / 16
        for s, l, p in tidy(slots_to_notes(bar["slots"])):
            if p is None: continue
            ax.add_patch(plt.Rectangle((t0 + s * sl, p - 0.4), l * sl * 0.95, 0.8, fill=False, ec='cyan', lw=1.3))
ax.set_xlim(a, b); ax.set_yticks(range(40, 96, 2)); ax.grid(alpha=0.15)
plt.tight_layout(); plt.savefig(sys.argv[5], dpi=60)
