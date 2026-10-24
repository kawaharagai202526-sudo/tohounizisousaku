# 曲の解析の共通部品（テンポ・調・コード・主旋律）
import numpy as np, scipy.io.wavfile as wf, scipy.signal as ss, sys
SR = 22050
HOP = 256
NFFT = 4096

def load(path):
    sr, x = wf.read(path)
    x = x.astype(np.float32)
    if x.ndim > 1: x = x.mean(1)
    x /= (np.abs(x).max() + 1e-9)
    return x

def stft_mag(x, nfft=NFFT, hop=HOP):
    f, t, Z = ss.stft(x, fs=SR, nperseg=nfft, noverlap=nfft - hop, window='hann', boundary=None, padded=False)
    return f, t, np.abs(Z)

def onset_env(x):
    f, t, M = stft_mag(x, nfft=1024, hop=HOP)
    L = np.log1p(100 * M)
    d = np.maximum(0, np.diff(L, axis=1)).sum(0)
    d = np.concatenate([[0], d])
    d -= ss.medfilt(d, 31)
    d = np.maximum(d, 0)
    return d / (d.max() + 1e-9)

def tempo(env, lo=80, hi=200):
    fps = SR / HOP
    ac = np.correlate(env - env.mean(), env - env.mean(), 'full')[len(env) - 1:]
    best, bb = None, -1
    for bpm in np.arange(lo, hi, 0.25):
        lag = 60 * fps / bpm
        s = 0
        for k in (1, 2, 4):
            l = lag * k
            i = int(l)
            if i + 1 >= len(ac): break
            s += ac[i] * (1 - (l - i)) + ac[i + 1] * (l - i)
        if s > bb: bb, best = s, bpm
    return best

def midi_bins(f):
    # 各 STFT ビンを MIDI ノート番号へ
    with np.errstate(divide='ignore'):
        m = 69 + 12 * np.log2(np.maximum(f, 1e-6) / 440)
    return m

def semitone_spec(M, f, lo=24, hi=108):
    m = np.round(midi_bins(f)).astype(int)
    out = np.zeros((hi - lo, M.shape[1]), np.float32)
    for p in range(lo, hi):
        sel = m == p
        if sel.any(): out[p - lo] = M[sel].sum(0)
    return out

def chroma(S, lo=24):
    C = np.zeros((12, S.shape[1]), np.float32)
    for i in range(S.shape[0]):
        C[(i + lo) % 12] += S[i]
    return C

MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

def key_of(cv):
    best = None
    for k in range(12):
        for mode, prof in (('maj', MAJ), ('min', MIN)):
            r = np.corrcoef(cv, np.roll(prof, k))[0, 1]
            if best is None or r > best[0]: best = (r, k, mode)
    return best

# ---- 主旋律の候補（倍音を足し合わせた「目立ち度」） ----
def salience(x, lo=48, hi=96, res=3):
    """lo〜hi の MIDI 音を 1/res 半音きざみで。戻り値 (pitches, times, Sal)"""
    f, t, M = stft_mag(x, nfft=4096, hop=HOP)
    # スペクトルのピークだけを残して白色化（伴奏の広い成分を弱める）
    L = np.log1p(1000 * M)
    base = ss.medfilt2d(L, (31, 1)) if L.shape[0] < 4000 else L
    W = np.maximum(L - base, 0)
    fm = midi_bins(f)
    pitches = np.arange(lo, hi, 1 / res)
    Sal = np.zeros((len(pitches), W.shape[1]), np.float32)
    weights = [1.0, 0.8, 0.64, 0.5, 0.4, 0.33]
    for h, w in enumerate(weights, start=1):
        target = pitches + 12 * np.log2(h)
        # 各候補の倍音に最も近い周波数ビン
        idx = np.searchsorted(fm, target)
        idx = np.clip(idx, 1, len(fm) - 1)
        left = fm[idx - 1]; right = fm[idx]
        idx = np.where(np.abs(target - left) < np.abs(target - right), idx - 1, idx)
        ok = np.abs(fm[idx] - target) < 0.5
        Sal[ok] += w * W[idx[ok]]
    return pitches, t, Sal

def viterbi_track(Sal, pitches, jump=0.15, res=3):
    """目立ち度の道筋を、音の跳びに罰を与えてつなぐ"""
    n, T = Sal.shape
    S = Sal / (Sal.max(0, keepdims=True) + 1e-9)
    logp = np.log(S + 1e-3)
    d = np.abs(np.arange(n)[:, None] - np.arange(n)[None, :]) / res  # 半音
    trans = -jump * np.minimum(d, 24)
    score = logp[:, 0].copy()
    back = np.zeros((n, T), np.int32)
    for t in range(1, T):
        cand = score[None, :] + trans  # [to, from]
        back[:, t] = cand.argmax(1)
        score = cand.max(1) + logp[:, t]
    path = np.zeros(T, np.int32)
    path[-1] = score.argmax()
    for t in range(T - 1, 0, -1):
        path[t - 1] = back[path[t], t]
    return pitches[path], Sal[path, np.arange(T)]
