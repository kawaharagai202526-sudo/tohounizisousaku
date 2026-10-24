# 作った曲（ゲームの音源で鳴らしたもの）と元の曲を、部分ごとに小節単位でくらべる
import sys, json, numpy as np
FPS = 22050 / 256
meta = json.load(open(sys.argv[1])); an = json.load(open(sys.argv[2])); o = np.load(sys.argv[3])['note']; r = np.load(sys.argv[4])['note']
parts = meta['parts']; n = meta['nBars']
bpm = []
k = 0
for b in range(n):
    while k + 1 < len(parts) and parts[k + 1]['bar'] <= b: k += 1
    bpm.append(parts[k]['bpm'])
for k, p in enumerate(parts):
    if k and p.get('ramp'):
        f = parts[k - 1]['bpm']
        for i in range(1, p['ramp'] + 1):
            b = p['bar'] - p['ramp'] - 1 + i
            bpm[b] = f + (p['bpm'] - f) * i / (p['ramp'] + 1)
start = [0.05]
for b in range(n): start.append(start[-1] + 240 / bpm[b])
def chroma(note, a, b):
    v = np.zeros(12); s = note[int(a * FPS):max(int(a * FPS) + 1, int(b * FPS))].mean(0)
    for kk in range(88): v[(kk + 21) % 12] += s[kk]
    v = v - v.mean()  # 平均を引いて、形の近さ（相関）でくらべる
    return v / (np.linalg.norm(v) + 1e-9)
allsim, allrnd = [], []
for sg in meta['segs']:
    sec = next(s for s in an if s['name'] == sg['sec'])
    sims, rnd = [], []
    for i in range(sg['n']):
        bar = sec['bars'][i]
        t0 = bar['t']; t1 = sec['bars'][i + 1]['t'] if i + 1 < len(sec['bars']) else t0 + 240 / sec['bpm']
        co = np.roll(chroma(o, t0, t1), sg['shift'])
        cr = chroma(r, start[sg['bar'] + i], start[sg['bar'] + i + 1])
        sims.append(co @ cr); rnd.append(np.mean([np.roll(co, kk) @ cr for kk in (3, 4, 5, 7, 8, 9)]))
    allsim += sims; allrnd += rnd
    print(f"  {sg['sec']:3s} 小節 {sg['bar']:3d}〜  近さ {np.mean(sims):.2f}（ずらすと {np.mean(rnd):.2f}）")
print(f'  全体 {np.mean(allsim):.2f}（ずらすと {np.mean(allrnd):.2f}）  長さ {start[-1]:.1f}秒')
