"""BGM 制作用の小さな DSP / シンセ部品 (numpy + scipy + pedalboard)。

音はすべて float32 のステレオ配列 shape=(n, 2)、サンプルレート SR で扱う。
"""
import os
import subprocess
import tempfile

import numpy as np
import pretty_midi
import scipy.signal as ss
import soundfile as sf
from pedalboard import Compressor, HighpassFilter, LowpassFilter, Pedalboard, Reverb

SR = 44100
SF2 = "/usr/share/sounds/sf2/FluidR3_GM.sf2"
_rng = np.random.default_rng(20261025)


# ---------------------------------------------------------------- 基本

def db(x):
    return 10 ** (x / 20.0)


def stereo(x):
    x = np.asarray(x, dtype=np.float32)
    return np.stack([x, x], axis=1) if x.ndim == 1 else x


def silence(sec):
    return np.zeros((int(round(sec * SR)), 2), dtype=np.float32)


def noise(n):
    return _rng.standard_normal(n).astype(np.float32)


def t_axis(n):
    return np.arange(n, dtype=np.float32) / SR


def butter(x, kind, f, order=4):
    sos = ss.butter(order, f, btype=kind, fs=SR, output="sos")
    return ss.sosfilt(sos, x, axis=0).astype(np.float32)


def fade(x, fin=0.0, fout=0.0):
    x = x.copy()
    n_in, n_out = int(fin * SR), int(fout * SR)
    if n_in > 0:
        x[:n_in] *= np.sin(np.linspace(0, np.pi / 2, n_in))[:, None] ** 2
    if n_out > 0:
        x[-n_out:] *= np.cos(np.linspace(0, np.pi / 2, n_out))[:, None] ** 2
    return x


def pan(x, p):
    """p: -1 (左) .. +1 (右)。等パワー。"""
    m = x.mean(axis=1) if x.ndim == 2 else x
    a = (p + 1) * np.pi / 4
    return np.stack([m * np.cos(a), m * np.sin(a)], axis=1).astype(np.float32) * np.sqrt(2)


def board(x, plugins):
    return Pedalboard(plugins)(x.T.astype(np.float32), SR).T.astype(np.float32)


def reverb(x, room=0.6, damp=0.5, width=1.0, pre=0.0):
    """100% wet のリバーブ (センド用)。"""
    y = board(np.vstack([x, silence(3.0)]), [Reverb(room_size=room, damping=damp, wet_level=1.0,
                                                     dry_level=0.0, width=width)])
    if pre > 0:
        y = np.vstack([silence(pre), y])[:len(y)]
    return y


class Track:
    """秒単位でクリップを足し込んでいくだけのミックス用バッファ。"""

    def __init__(self, sec):
        self.x = np.zeros((int(sec * SR) + SR, 2), dtype=np.float32)

    def add(self, clip, at, gain_db=0.0):
        clip = stereo(clip)
        i = int(round(at * SR))
        if i < 0:
            clip, i = clip[-i:], 0
        n = min(len(clip), len(self.x) - i)
        if n > 0:
            self.x[i:i + n] += clip[:n] * db(gain_db)


# ---------------------------------------------------------------- ドラム (シンセ)

def kick(tail_hz=60.0, punch=1.0):
    """タイトなキック。P2 は超低域が控えめなので、余韻を短くしてアタックで聞かせる。"""
    n = int(0.35 * SR)
    t = t_axis(n)
    f = tail_hz + (200 - tail_hz) * np.exp(-t / 0.026)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.11)
    knock = butter(noise(n), "band", [900, 4500], 2) * np.exp(-t / 0.006) * 0.5
    click = butter(noise(n), "high", 3000) * np.exp(-t / 0.002) * 0.6 * punch
    x = np.tanh(1.7 * (body + knock + click)) * 0.85
    x = butter(x, "high", 48, 2)
    return stereo(fade(stereo(x), 0.0005, 0.05))


def snare(tone=190.0):
    n = int(0.45 * SR)
    t = t_axis(n)
    body = (np.sin(2 * np.pi * tone * t) * np.exp(-t / 0.055)
            + 0.5 * np.sin(2 * np.pi * tone * 1.74 * t) * np.exp(-t / 0.035))
    nz = butter(noise(n), "band", [1400, 9500], 2) * np.exp(-t / 0.13)
    x = 0.55 * body + 0.9 * nz
    x = np.tanh(1.4 * x) * 0.8
    return stereo(fade(stereo(x), 0.0005, 0.08))


def clap():
    n = int(0.4 * SR)
    t = t_axis(n)
    env = np.zeros(n, dtype=np.float32)
    for k, d in enumerate([0.0, 0.009, 0.018, 0.026]):
        i = int(d * SR)
        env[i:] += np.exp(-(t[: n - i]) / (0.006 if k < 3 else 0.11)) * (1.0 if k < 3 else 0.9)
    x = butter(noise(n), "band", [900, 4200], 2) * env
    return stereo(fade(stereo(x * 0.9), 0.0003, 0.06))


def _metal(n):
    t = t_axis(n)
    fr = np.array([205.3, 304.4, 369.6, 522.7, 540.0, 800.0]) * 1.6
    sq = sum(np.sign(np.sin(2 * np.pi * f * t + _rng.uniform(0, 6.28))) for f in fr) / 6.0
    return sq.astype(np.float32)


def hat(open_=False):
    n = int((0.42 if open_ else 0.09) * SR)
    t = t_axis(n)
    tau = 0.16 if open_ else 0.022
    x = (0.6 * butter(_metal(n), "band", [7000, 13000], 2) + 0.5 * butter(noise(n), "high", 8000)) * np.exp(-t / tau)
    return stereo(fade(stereo(x * (0.55 if open_ else 0.5)), 0.0003, 0.02))


# ---------------------------------------------------------------- FluidR3 (GM) から生音の単発を作る

_gm_cache = {}


def gm_render(notes, program=0, is_drum=False, sec=None, gain=1.0):
    """notes: [(pitch, start_sec, dur_sec, velocity)] を FluidR3_GM で鳴らした音を返す。"""
    key = (tuple(notes), program, is_drum, sec, gain)
    if key in _gm_cache:
        return _gm_cache[key]
    pm = pretty_midi.PrettyMIDI(initial_tempo=120)
    inst = pretty_midi.Instrument(program=program, is_drum=is_drum)
    end = 0.0
    for p, s, d, v in notes:
        inst.notes.append(pretty_midi.Note(velocity=int(v), pitch=int(p), start=s, end=s + d))
        end = max(end, s + d)
    pm.instruments.append(inst)
    with tempfile.TemporaryDirectory() as td:
        mid, wav = os.path.join(td, "a.mid"), os.path.join(td, "a.wav")
        pm.write(mid)
        subprocess.run(["fluidsynth", "-ni", "-q", "-g", str(gain), "-r", str(SR), "-F", wav, SF2, mid],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        x, sr = sf.read(wav, dtype="float32")
    assert sr == SR
    x = stereo(x)
    # fluidsynth は先頭にごく僅かな無音を入れることがあるので、最初の立ち上がりに揃える
    lead = int(np.argmax(np.abs(x).max(axis=1) > 1e-4))
    x = x[lead:]
    if sec is not None:
        x = fade(x[: int(sec * SR)], 0, min(0.3, sec / 4))
    _gm_cache[key] = x
    return x


def crash(which=49, vel=110):
    return gm_render([(which, 0.0, 0.1, vel)], is_drum=True, sec=3.2, gain=1.2)


def ride(vel=90):
    return gm_render([(51, 0.0, 0.1, vel)], is_drum=True, sec=1.2, gain=1.0)


def tom(pitch, vel=105):
    return gm_render([(pitch, 0.0, 0.1, vel)], is_drum=True, sec=0.8, gain=1.1)


def reverse_crash(length_sec):
    c = crash(57, 120)
    c = c[: int(length_sec * SR)]
    c = fade(c, 0, 0.0)[::-1].copy()
    return fade(c, min(0.4, length_sec / 3), 0.004)


# ---------------------------------------------------------------- 効果音

def _stft_sweep(n, f_from, f_to, bw_oct=0.7, curve=1.0):
    """白色雑音を時間とともに中心周波数が動く帯域通過マスクで削った音。"""
    x = noise(n + 4096)
    f, t, Z = ss.stft(x, fs=SR, nperseg=2048, noverlap=1536)
    pos = np.clip(t / (n / SR), 0, 1) ** curve
    fc = f_from * (f_to / f_from) ** pos
    lf = np.log2(np.maximum(f, 1.0))[:, None]
    mask = np.exp(-0.5 * ((lf - np.log2(fc)[None, :]) / bw_oct) ** 2)
    _, y = ss.istft(Z * mask, fs=SR, nperseg=2048, noverlap=1536)
    y = y[:n].astype(np.float32)
    return y / (np.abs(y).max() + 1e-9)


def riser(sec, f_from=250, f_to=9000):
    n = int(sec * SR)
    y = _stft_sweep(n, f_from, f_to, 0.6, 1.4)
    env = np.linspace(0, 1, n) ** 2.2
    l = y * env
    r = np.roll(_stft_sweep(n, f_from * 1.1, f_to * 1.05, 0.6, 1.4), 7) * env
    return fade(np.stack([l, r], 1).astype(np.float32) * 0.5, 0.05, 0.01)


def downlifter(sec, f_from=7000, f_to=180):
    n = int(sec * SR)
    y = _stft_sweep(n, f_from, f_to, 0.6, 0.6)
    env = (1 - np.linspace(0, 1, n)) ** 1.8
    return fade(stereo(y * env * 0.45), 0.003, 0.2)


def impact(sec=2.2):
    n = int(sec * SR)
    t = t_axis(n)
    f = 31 + (95 - 31) * np.exp(-t / 0.09)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.75)
    hit = butter(noise(n), "low", 1800) * np.exp(-t / 0.06) * 0.5
    x = stereo(np.tanh(1.5 * (boom + hit)) * 0.8)
    wet = reverb(x * 0.5, room=0.85, damp=0.6)[:n]
    y = fade(x + wet, 0.0005, 0.6)
    return y / (np.abs(y).max() + 1e-9) * db(-1.0)


def snare_roll(bar_sec, bars=2, start_div=8, end_div=32, accel_curve=1.6):
    """だんだん細かく・大きくなるスネアロール (区切りは小節の 8分 -> 32分)。"""
    total = bar_sec * bars
    sn = snare(205)
    out = np.zeros((int(total * SR) + len(sn), 2), dtype=np.float32)
    t = 0.0
    while t < total - 1e-6:
        pos = t / total
        div = start_div * (end_div / start_div) ** (pos ** accel_curve)
        step = bar_sec / max(start_div, min(end_div, 2 ** round(np.log2(div))))
        g = db(-22 + 20 * pos ** 1.3)
        i = int(t * SR)
        out[i:i + len(sn)] += sn * g
        t += step
    return out[: int(total * SR) + int(0.3 * SR)]


# ---------------------------------------------------------------- 処理

def compress(x, thr=-20, ratio=3.0, att=8, rel=140):
    return board(x, [Compressor(threshold_db=thr, ratio=ratio, attack_ms=att, release_ms=rel)])


def _release_smooth(g, coef):
    out = np.empty_like(g)
    prev = 1.0
    for i in range(len(g)):
        v = g[i]
        if v < prev:
            prev = v
        else:
            prev = prev + (v - prev) * coef
            if prev > v:
                prev = v
        out[i] = prev
    return out


try:
    from numba import njit
    _release_smooth = njit(cache=True)(_release_smooth)
except Exception:  # numba が無ければ遅いが同じ結果
    pass


def limit(x, ceiling_db=-1.0, rel=120, look_ms=5.0):
    """先読み型のピークリミッター。ceiling を超える所だけ下げ、それ以外は一切触らない
    (pedalboard の Limiter は全体を圧縮して持ち上げるので使わない)。"""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    ceil = db(ceiling_db)
    pk = np.abs(x).max(axis=1)
    req = np.minimum(1.0, ceil / np.maximum(pk, 1e-9)).astype(np.float64)
    if req.min() >= 1.0:
        return x
    L = max(1, int(look_ms * SR / 1000))
    g = minimum_filter1d(req, size=2 * L + 1, mode="nearest")
    g = uniform_filter1d(g, size=L, mode="nearest")
    g = np.minimum(g, minimum_filter1d(req, size=L, mode="nearest"))
    coef = 1.0 - np.exp(-1.0 / (rel / 1000.0 * SR))
    g = _release_smooth(g, coef)
    g = np.minimum(g, req)  # 念のため: どのサンプルも ceiling を超えない
    return (x * g[:, None]).astype(np.float32)


def hp(x, f):
    return board(x, [HighpassFilter(cutoff_frequency_hz=f)])


def lp(x, f):
    return board(x, [LowpassFilter(cutoff_frequency_hz=f)])


def ltas_db(x, nfft=8192):
    """長時間平均スペクトル (dB)。"""
    m = x.mean(axis=1) if x.ndim == 2 else x
    f, p = ss.welch(m, fs=SR, nperseg=nfft)
    return f, 10 * np.log10(p + 1e-14)


def smooth_oct(f, v, frac=3):
    out = np.empty_like(v)
    for i, fc in enumerate(f):
        if fc <= 0:
            out[i] = v[i]
            continue
        lo, hi = fc * 2 ** (-0.5 / frac), fc * 2 ** (0.5 / frac)
        sel = (f >= lo) & (f <= hi)
        out[i] = np.mean(v[sel])
    return out


def match_eq(x, ref, amount=0.6, max_db=6.0, lo=40, hi=15000, taps=4097, max_boost=None):
    """x の周波数バランスを ref に寄せる線形位相 FIR。"""
    f, a = ltas_db(x)
    _, b = ltas_db(ref)
    d = smooth_oct(f, b - a, 3)
    d -= np.average(d[(f > 200) & (f < 4000)])  # 音量差ではなく「形」だけ合わせる
    d = np.clip(d * amount, -max_db, max_db if max_boost is None else max_boost)
    d[(f < lo) | (f > hi)] = 0.0
    d = ss.savgol_filter(d, 31, 2)
    h = ss.firwin2(taps, f / (SR / 2), db(d))
    y = ss.fftconvolve(x, h[:, None], mode="full")[taps // 2: taps // 2 + len(x)]
    return y.astype(np.float32), (f, d)


def duck_env(n, hits_sec, depth_db=-4.0, release=0.16, attack=0.004):
    """キックの位置で一瞬音量を下げる (サイドチェイン風のうねり) ゲイン曲線。"""
    g = np.zeros(n, dtype=np.float32)
    t = t_axis(int((release * 5 + attack) * SR))
    shape = np.where(t < attack, t / attack, np.exp(-(t - attack) / release)).astype(np.float32)
    for h in hits_sec:
        i = int(h * SR)
        m = min(len(shape), n - i)
        if m > 0:
            g[i:i + m] = np.maximum(g[i:i + m], shape[:m])
    return db(depth_db * g)[:, None]
