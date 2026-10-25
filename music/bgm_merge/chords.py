"""ベース音 (ルート) の推定と、パッド用の 5 度ボイシング.

曲3 は半音階的なリフが多く 3 和音の判定が不安定なため、
長調/短調に依存しない「ルート + 5 度 + オクターブ」で持続音を作る.
誤検出による不協和を避けるため、中音域のクロマで裏付けの取れた音だけを鳴らす.
"""
import numpy as np
import librosa

from dsp import SR

NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]


def root_segments(x, hop=2048, self_prob=0.985, min_len=0.8):
    """x: 調波成分 (samples,2). 戻り値: [(t0, t1, root_pc, chroma(12,))]"""
    m = x.mean(1)
    Q = np.abs(librosa.cqt(m, sr=SR, hop_length=hop, fmin=librosa.note_to_hz("C1"), n_bins=36))
    w = np.repeat([1.0, 0.8, 0.5], 12)[:, None]  # 低い音ほど重視
    B = (Q * w).reshape(3, 12, -1).sum(0)
    B /= B.sum(0, keepdims=True) + 1e-9
    C = librosa.feature.chroma_cqt(y=m, sr=SR, hop_length=hop, fmin=librosa.note_to_hz("C3"), n_octaves=4)
    L = min(B.shape[1], C.shape[1])
    B, C = B[:, :L], C[:, :L]
    prob = B ** 2
    prob /= prob.sum(0, keepdims=True) + 1e-12
    path = librosa.sequence.viterbi(prob, librosa.sequence.transition_loop(12, self_prob))
    times = librosa.frames_to_time(np.arange(L + 1), sr=SR, hop_length=hop)
    segs, s = [], 0
    for i in range(1, L + 1):
        if i == L or path[i] != path[s]:
            segs.append([times[s], times[i], int(path[s]), s, i])
            s = i
    merged = []
    for seg in segs:
        if merged and (seg[1] - seg[0] < min_len or seg[2] == merged[-1][2]):
            merged[-1][1], merged[-1][4] = seg[1], seg[4]
        else:
            merged.append(seg)
    out = []
    for t0, t1, r, f0, f1 in merged:
        c = C[:, f0:f1].mean(1)
        out.append((float(t0), float(t1), r, c / (c.max() + 1e-9)))
    return out


def _supported(pc, c, floor=0.3):
    """その音が十分鳴っていて、半音隣の音に負けていないか."""
    return c[pc] >= floor and c[pc] >= 0.9 * max(c[(pc - 1) % 12], c[(pc + 1) % 12])


def pad_events(segs, lo=57):
    """ルート区間列 → [(midi, t_on, t_off)]. 共通音は切らずに持続させる."""
    active = {}   # midi -> t_on
    events = []
    log = []
    for t0, t1, r, c in segs:
        notes = set()
        if c[r] >= 0.45 and _supported(r, c):
            root = lo + (r - lo) % 12
            notes = {root, root + 12}
            if _supported((r + 7) % 12, c):
                notes.add(root + 7)
        else:
            # 裏付けのない区間: 直前の音のうち、この区間でも鳴っているものだけ残す
            notes = {m for m in active if _supported(m % 12, c, floor=0.4)}
        for m in list(active):
            if m not in notes:
                events.append((m, active.pop(m), t0))
        for m in notes:
            active.setdefault(m, t0)
        log.append((round(t0, 2), round(t1, 2), NAMES[r], sorted(notes)))
    end = segs[-1][1] if segs else 0.0
    events += [(m, t, end) for m, t in active.items()]
    return sorted(events, key=lambda e: e[1]), log
