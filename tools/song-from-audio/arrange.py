# 動画の音から、部分ごとに「拍・小節・主旋律（16分音符の升目）・コード（半小節ごと）・調」を取り出す
#   python arrange.py 設定.json 出力.json
#   設定: { "wav": ..., "npz": ..., "sections": [{ "name", "start", "end", "bpm", "lo", "hi", "prior", "phase" }] }
import sys, json, numpy as np
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from beats import *
from mel import melody_path

NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']


def chroma_of(note, a, b, lo=28, hi=96, bass_w=1.5):
    v = np.zeros(12)
    seg = note[a:b]
    if len(seg) == 0: return v
    s = seg.mean(0)
    for k in range(88):
        m = k + 21
        if m < lo or m > hi: continue
        w = bass_w if m < 52 else 1.0
        v[m % 12] += s[k] * w
    return v


def best_chord(v, prev=None):
    best = None
    for r in range(12):
        for q, iv in (('', (0, 4, 7)), ('m', (0, 3, 7))):
            t = np.zeros(12)
            for i, w in zip(iv, (1.0, 0.8, 0.9)): t[(r + i) % 12] = w
            sc = (v / (np.linalg.norm(v) + 1e-9)) @ (t / np.linalg.norm(t))
            name = NAMES[r] + q
            if prev == name: sc += 0.04  # 同じコードが続きやすいように
            if best is None or sc > best[0]: best = (sc, name)
    return best[1]


def key_of_vec(cv):
    best = None
    for k in range(12):
        for mode, prof in (('maj', MAJ), ('min', MIN)):
            r = np.corrcoef(cv, np.roll(prof, k))[0, 1]
            if best is None or r > best[0]: best = (r, k, mode)
    return {'tonic': best[1], 'mode': best[2], 'r': float(best[0]), 'name': NAMES[best[1]] + ('m' if best[2] == 'min' else '')}


def analyse(cfg):
    x = load(cfg['wav'])
    env = onset_env(x)
    d = np.load(cfg['npz'])
    note, onset = d['note'], d['onset']
    out = []
    for sec in cfg['sections']:
        a, b = sec['start'], sec['end']
        e = env[int(a * FPS):int(b * FPS)]
        bpm = tempo(e, sec['bpm'] * 0.95, sec['bpm'] * 1.05)
        bt = beat_track(e, bpm) + a
        # 区切りの前後の端の拍は捨てる
        bt = bt[(bt >= a) & (bt <= b)]
        nb = len(bt) - 1
        # 拍ごとのコードの変わり目（小節の頭を決めるのに使う）
        cv = [chroma_of(note, int(bt[i] * FPS), int(bt[i + 1] * FPS), lo=28, hi=60, bass_w=1.0) for i in range(nb)]
        cv = [c / (np.linalg.norm(c) + 1e-9) for c in cv]
        nov = [0.0] + [1 - float(cv[i] @ cv[i - 1]) for i in range(1, nb)]
        low = onset_env_low(x, bt)
        if 'phase' in sec:
            phase = sec['phase']
        else:
            sc = [sum(nov[i] + 0.5 * low[i] for i in range(p, nb, 4)) / max(1, len(range(p, nb, 4))) for p in range(4)]
            phase = int(np.argmax(sc))
        # 小節（4拍）にそろえる
        starts = list(range(phase, nb - 3, 4))
        # 主旋律
        i0, i1 = int(bt[0] * FPS), int(bt[-1] * FPS) + 1
        mel = melody_path(note[i0:i1], lo=sec.get('lo', 55), hi=sec.get('hi', 96), prior=sec.get('prior', 0.02), jump=sec.get('jump', 0.6), voice_th=sec.get('voice', 0.18))
        bars = []
        prev_chord = None
        for s in starts:
            slots = []
            for j in range(4):
                t0, t1 = bt[s + j], bt[s + j + 1]
                for q in range(4):
                    u0 = t0 + (t1 - t0) * q / 4
                    u1 = t0 + (t1 - t0) * (q + 1) / 4
                    f0, f1 = int(u0 * FPS) - i0, max(int(u0 * FPS) - i0 + 1, int(u1 * FPS) - i0)
                    seg = mel[max(0, f0):max(0, f1)]
                    if len(seg) == 0 or (seg < 0).mean() > 0.55:
                        slots.append([None, 0, 0.0])
                        continue
                    vals, cnt = np.unique(seg[seg >= 0], return_counts=True)
                    p = int(vals[cnt.argmax()])
                    # 出だし：その音の onset が升目の頭あたりで強いか
                    g0, g1 = int(u0 * FPS) - 2, int(u0 * FPS + (u1 - u0) * FPS * 0.5) + 1
                    on = float(onset[max(0, g0):g1, p - 21].max()) if g1 > g0 else 0.0
                    strength = float(note[int(u0 * FPS):max(int(u0 * FPS) + 1, int(u1 * FPS)), p - 21].mean())
                    slots.append([p, on, strength])
            chords = []
            for h in range(2):
                ca, cb = int(bt[s + 2 * h] * FPS), int(bt[s + 2 * h + 2] * FPS)
                prev_chord = best_chord(chroma_of(note, ca, cb), prev_chord)
                chords.append(prev_chord)
            bars.append({'t': float(bt[s]), 'slots': slots, 'chords': chords})
        kv = sum(chroma_of(note, int(bt[0] * FPS), int(bt[-1] * FPS), lo=28, hi=96) for _ in [0])
        rms = float(np.sqrt((x[int(a * SR):int(b * SR)] ** 2).mean()))
        out.append({'name': sec['name'], 'bpm': float(60 / np.median(np.diff(bt))), 'phase': phase, 'key': key_of_vec(kv), 'rms': rms,
                    'start': float(bt[starts[0]]) if starts else a, 'bars': bars})
        print(f"{sec['name']}: {a}-{b}s  bpm {out[-1]['bpm']:.2f}  phase {phase}  bars {len(bars)}  key {out[-1]['key']['name']} ({out[-1]['key']['r']:.2f})  rms {rms:.3f}")
    return out


def onset_env_low(x, bt):
    # 低い音（キック・ベース）の出だしの強さを拍ごとに
    f, t, M = stft_mag(x, nfft=2048, hop=HOP)
    L = np.log1p(100 * M[(f > 30) & (f < 160)]).sum(0)
    d = np.maximum(0, np.diff(L, prepend=L[0]))
    d /= d.max() + 1e-9
    out = []
    for i in range(len(bt) - 1):
        k = int(bt[i] * FPS)
        out.append(float(d[max(0, k - 2):k + 3].max()))
    return out


if __name__ == '__main__':
    cfg = json.load(open(sys.argv[1]))
    res = analyse(cfg)
    json.dump(res, open(sys.argv[2], 'w'))
