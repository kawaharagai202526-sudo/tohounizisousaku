# 解析結果（arrange.py の出力）から、音符の列と MML を作る
import json, numpy as np

LEN = {16: '1', 12: '2.', 8: '2', 6: '4.', 4: '4', 3: '8.', 2: '8', 1: '16'}
NOTE = ['c', 'c+', 'd', 'd+', 'e', 'f', 'f+', 'g', 'g+', 'a', 'a+', 'b']
NOTE_FLAT = ['c', 'd-', 'd', 'e-', 'e', 'f', 'g-', 'g', 'a-', 'a', 'b-', 'b']


def slots_to_notes(slots, on_th=0.5, min_strength=0.12):
    """16個の升目 → [(開始, 長さ, MIDI or None)]"""
    notes = []
    for i, (p, on, st) in enumerate(slots):
        if p is not None and st < min_strength and not on > on_th:
            # 弱すぎる音は前の音の続きか休符にする
            p = notes[-1][2] if notes and notes[-1][2] is not None and notes[-1][0] + notes[-1][1] == i else None
            on = 0
        if notes and notes[-1][2] == p and notes[-1][0] + notes[-1][1] == i and not (p is not None and on > on_th):
            s, l, q = notes[-1]
            notes[-1] = (s, l + 1, q)
        else:
            notes.append((i, 1, p))
    return notes


def split_len(n):
    """升目の数 → MML の音長の並び（タイでつなぐ）"""
    out = []
    for k in (16, 12, 8, 6, 4, 3, 2, 1):
        while n >= k:
            out.append(LEN[k]); n -= k
    return out


def bar_mml(notes, flat=False):
    names = NOTE_FLAT if flat else NOTE
    toks, oct = [], None
    for s, l, p in notes:
        lens = split_len(l)
        if p is None:
            toks.append(' '.join('r' + x for x in lens))
            continue
        o = p // 12 - 1
        pre = '' if o == oct else f'o{o} '
        oct = o
        nm = names[p % 12]
        toks.append(pre + '&'.join(nm + x for x in lens))
    return ' '.join(toks)


def transpose_chord(name, k, flat=False):
    names = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] if flat else ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
    root = name.rstrip('m') if name.endswith('m') else name
    q = 'm' if name.endswith('m') else ''
    allnames = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B', 'Db', 'Gb']
    idx = {n: i for i, n in enumerate(['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'])}
    idx.update({'Db': 1, 'Gb': 6, 'D#': 3, 'G#': 8, 'A#': 10})
    return names[(idx[root] + k) % 12] + q


def tidy(notes, fill=2):
    """短い休符を前の音でうめ、前後と同じ高さにはさまれた1升の音をならす"""
    out = []
    for n in notes:
        s, l, p = n
        if p is None and out and out[-1][2] is not None and l <= fill:
            ps, pl, pp = out[-1]
            out[-1] = (ps, pl + l, pp)
            continue
        out.append(n)
    res = []
    for i, (s, l, p) in enumerate(out):
        if 0 < i < len(out) - 1 and l == 1 and p is not None and out[i - 1][2] == out[i + 1][2] and out[i - 1][2] is not None and res and res[-1][2] == out[i - 1][2]:
            ps, pl, pp = res[-1]
            res[-1] = (ps, pl + 1, pp)
            continue
        if res and res[-1][2] == p and p is not None and res[-1][0] + res[-1][1] == s and l == 1 and res[-1][1] == 1:
            pass
        res.append((s, l, p))
    return res
