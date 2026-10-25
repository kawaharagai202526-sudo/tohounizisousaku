"""BGM 結合用の小さな DSP ユーティリティ集 (44.1kHz / ステレオ float32, 形状は (samples, 2))."""
import numpy as np
import soundfile as sf
import librosa
import pedalboard as pb
import pyloudnorm as pyln
from numba import njit
from scipy.ndimage import minimum_filter1d, uniform_filter1d
from scipy.signal import butter, sosfilt, sosfiltfilt

SR = 44100
RNG = np.random.default_rng(20261025)


# ---------------------------------------------------------------- 基本操作
def load(path):
    y, sr = sf.read(path, dtype="float32", always_2d=True)
    if sr != SR:
        y = librosa.resample(y.T, orig_sr=sr, target_sr=SR).T
    if y.shape[1] == 1:
        y = np.repeat(y, 2, axis=1)
    return np.ascontiguousarray(y[:, :2])


def save(path, x):
    sf.write(path, x, SR, subtype="PCM_24")


def n(t):
    return int(round(t * SR))


def cut(x, a, b):
    return x[n(a):n(b)].copy()


def ramp(length, kind="in"):
    t = np.linspace(0.0, 1.0, max(length, 1), dtype=np.float32)
    c = np.sin(t * np.pi / 2) if kind == "in" else np.cos(t * np.pi / 2)
    return c[:, None]


def fades(x, fin=0.0, fout=0.0):
    x = x.copy()
    if fin > 0:
        k = n(fin)
        x[:k] *= ramp(k, "in")
    if fout > 0:
        k = n(fout)
        x[-k:] *= ramp(k, "out")
    return x


def gain_curve(x, times, dbs):
    """時刻 times(秒, 区間先頭基準) における dB 値を線形補間したゲインを掛ける."""
    t = np.arange(len(x)) / SR
    g = 10 ** (np.interp(t, times, dbs) / 20)
    return x * g[:, None].astype(np.float32)


class Timeline:
    def __init__(self, seconds):
        self.buf = np.zeros((n(seconds), 2), dtype=np.float32)

    def add(self, src, at, gain_db=0.0):
        s = n(at)
        if s < 0:
            src = src[-s:]
            s = 0
        e = s + len(src)
        if e > len(self.buf):
            self.buf = np.concatenate([self.buf, np.zeros((e - len(self.buf), 2), np.float32)])
        self.buf[s:e] += src * np.float32(10 ** (gain_db / 20))


def db(x):
    return 20 * np.log10(np.sqrt(np.mean(np.square(x))) + 1e-12)


def lufs(x):
    return pyln.Meter(SR).integrated_loudness(x.astype(np.float64))


# ---------------------------------------------------------------- フィルタ
def _stft(x, n_fft, hop):
    return [librosa.stft(x[:, c], n_fft=n_fft, hop_length=hop) for c in range(2)]


def _istft(S, hop, length):
    return np.stack([librosa.istft(s, hop_length=hop, length=length) for s in S], axis=1).astype(np.float32)


def stft_gain(x, gain_fn, n_fft=4096, hop=512):
    """gain_fn(freqs[F], times[T]) -> (F,T) or (F,1) の振幅ゲインを掛ける (ゼロ位相)."""
    S = _stft(x, n_fft, hop)
    f = librosa.fft_frequencies(sr=SR, n_fft=n_fft)
    t = librosa.frames_to_time(np.arange(S[0].shape[1]), sr=SR, hop_length=hop)
    G = gain_fn(f, t)
    return _istft([s * G for s in S], hop, len(x))


def lp_resp(f, fc, order=4):
    return 1.0 / np.sqrt(1.0 + (f / fc) ** (2 * order))


def hp_resp(f, fc, order=4):
    return 1.0 / np.sqrt(1.0 + (fc / np.maximum(f, 1e-3)) ** (2 * order))


def sweep_curve(t, t0, t1, f0, f1):
    """t0→t1 で f0→f1 に指数補間 (範囲外は端の値)."""
    u = np.clip((t - t0) / max(t1 - t0, 1e-6), 0, 1)
    return f0 * (f1 / f0) ** u


def lowpass_sweep(x, t0, t1, f0, f1, order=4):
    return stft_gain(x, lambda f, t: lp_resp(f[:, None], sweep_curve(t, t0, t1, f0, f1)[None, :], order))


def highpass_sweep(x, t0, t1, f0, f1, order=4):
    return stft_gain(x, lambda f, t: hp_resp(f[:, None], sweep_curve(t, t0, t1, f0, f1)[None, :], order))


def butter_f(x, fc, kind="low", order=2, zero_phase=False):
    sos = butter(order, fc, btype=kind, fs=SR, output="sos")
    f = sosfiltfilt if zero_phase else sosfilt
    return f(sos, x, axis=0).astype(np.float32)


def bandpass(x, lo, hi, order=2):
    sos = butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return sosfilt(sos, x, axis=0).astype(np.float32)


# ---------------------------------------------------------------- エフェクト
def reverb(x, room=0.8, damping=0.5, wet=0.33, dry=0.0, width=1.0, tail=0.0):
    """pedalboard の Freeverb. tail 秒ぶん無音を足して残響を出し切る."""
    if tail > 0:
        x = np.concatenate([x, np.zeros((n(tail), 2), np.float32)])
    r = pb.Reverb(room_size=room, damping=damping, wet_level=wet, dry_level=dry, width=width)
    return r(x.T.copy(), SR).T.astype(np.float32)


def stretch(x, speed=1.0, semitones=0.0, transient="crisp"):
    y = pb.time_stretch(x.T.copy(), SR, stretch_factor=speed, pitch_shift_in_semitones=semitones,
                        high_quality=True, transient_mode=transient)
    return y.T.astype(np.float32)


def hpss(x, margin=1.0, n_fft=4096, hop=1024):
    """調波/打撃 分離 (ソフトマスク: H+P は元信号と一致)."""
    S = _stft(x, n_fft, hop)
    H, P = [], []
    for s in S:
        h, p = librosa.decompose.hpss(s, margin=margin)
        H.append(h)
        P.append(p)
    return _istft(H, hop, len(x)), _istft(P, hop, len(x))


def ltas(x, n_fft=8192):
    m = x.mean(1)
    S = np.abs(librosa.stft(m, n_fft=n_fft, hop_length=n_fft // 4)) ** 2
    return librosa.fft_frequencies(sr=SR, n_fft=n_fft), S.mean(1)


def smooth_octave(f, p, frac=3):
    """1/frac オクターブ幅で平滑化したパワースペクトル."""
    out = np.empty_like(p)
    for i, fi in enumerate(f):
        if fi <= 0:
            out[i] = p[i]
            continue
        lo, hi = fi * 2 ** (-0.5 / frac), fi * 2 ** (0.5 / frac)
        m = (f >= lo) & (f <= hi)
        out[i] = p[m].mean()
    return out


def match_eq_curve(ref, src, amount=0.5, limit_db=6.0, fmin=40, fmax=16000):
    """src の長時間平均スペクトルを ref に amount だけ近づける EQ カーブ (dB) を返す."""
    f, pr = ltas(ref)
    _, ps = ltas(src)
    pr, ps = smooth_octave(f, pr), smooth_octave(f, ps)
    d = 10 * np.log10((pr + 1e-12) / (ps + 1e-12))
    band = (f > 200) & (f < 5000)
    d -= np.median(d[band])  # 全体レベル差は除外 (形だけ合わせる)
    d = np.clip(d * amount, -limit_db, limit_db)
    d[(f < fmin) | (f > fmax)] = 0.0
    edge = (f >= fmin) & (f <= fmax)
    d[~edge] = np.interp(f[~edge], f[edge], d[edge])
    return f, d


def apply_eq_curve(x, f_curve, d_curve, n_fft=8192):
    def g(f, t):
        return (10 ** (np.interp(f, f_curve, d_curve) / 20))[:, None]
    return stft_gain(x, g, n_fft=n_fft, hop=n_fft // 4)


@njit(cache=True)
def _release(g, coef):
    out = np.empty_like(g)
    cur = 1.0
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else coef * cur + (1 - coef) * g[i]
        out[i] = cur
    return out


def limiter(x, ceiling_db=-1.2, lookahead_ms=4.0, release_ms=150.0):
    """先読みピークリミッター. 天井を超える瞬間だけゲインを下げる (メイクアップ無し)."""
    c = 10 ** (ceiling_db / 20)
    peak = np.abs(librosa.resample(x.T, orig_sr=SR, target_sr=SR * 4)).max(0)[::4][: len(x)]  # 真のピーク近似
    peak = np.concatenate([peak, np.zeros(len(x) - len(peak))])
    g = np.minimum(1.0, c / np.maximum(peak, 1e-9))
    L = max(n(lookahead_ms / 1000), 1)
    g = minimum_filter1d(g, size=2 * L + 1)
    g = _release(g, np.exp(-1.0 / (SR * release_ms / 1000)))
    g = uniform_filter1d(g, size=L)
    g = minimum_filter1d(g, size=L)  # 平滑化で天井を越えないよう保険
    y = x * g[:, None]
    return np.clip(y, -c, c).astype(np.float32)


# ---------------------------------------------------------------- シンセ
def polyblep_saw(freq, length, phase0=0.0):
    dt = np.full(length, freq / SR) if np.isscalar(freq) else np.asarray(freq) / SR
    ph = (phase0 + np.cumsum(dt)) % 1.0
    y = 2.0 * ph - 1.0
    m = ph < dt
    t = ph[m] / dt[m]
    y[m] -= t + t - t * t - 1.0
    m = ph > 1.0 - dt
    t = (ph[m] - 1.0) / dt[m]
    y[m] -= t * t + t + t + 1.0
    return y


def supersaw(freq, length, voices=6, detune_cents=14.0, vib_hz=4.8, vib_cents=4.0):
    """左右に広げたデチューン・ノコギリ波 (曲2 のシンセパッド風)."""
    t = np.arange(length) / SR
    out = np.zeros((length, 2))
    spread = np.linspace(-1, 1, voices)
    for i, s in enumerate(spread):
        cents = s * detune_cents + vib_cents * np.sin(2 * np.pi * vib_hz * t + RNG.uniform(0, 6.28))
        f = freq * 2 ** (cents / 1200)
        w = polyblep_saw(f, length, RNG.uniform())
        pan = 0.5 + 0.45 * s
        out[:, 0] += w * np.cos(pan * np.pi / 2)
        out[:, 1] += w * np.sin(pan * np.pi / 2)
    return (out / voices).astype(np.float32)


def adsr(length, a=0.3, r=0.6, curve=2.0):
    env = np.ones(length, np.float32)
    ka, kr = min(n(a), length), min(n(r), length)
    if ka:
        env[:ka] = np.linspace(0, 1, ka) ** curve
    if kr:
        env[-kr:] *= np.linspace(1, 0, kr) ** curve
    return env[:, None]


def noise(length, color="white"):
    w = RNG.standard_normal((length, 2)).astype(np.float32)
    if color == "pink":
        w = butter_f(w, 1200, "low", 1) * 2.5 + w * 0.15
    return w


def riser(seconds, f0=300, f1=9000, peak_db=-18.0):
    """ホワイトノイズの上昇スイープ (末尾で最大音量)."""
    L = n(seconds)
    x = noise(L)
    t_end = seconds

    def g(f, t):
        fc = sweep_curve(t, 0, t_end, f0, f1)[None, :]
        bw = 0.9
        return np.exp(-0.5 * (np.log2(np.maximum(f[:, None], 1) / fc) / bw) ** 2)
    x = stft_gain(x, g, n_fft=2048, hop=256)
    env = np.linspace(0, 1, L) ** 2.5
    x *= env[:, None]
    return (x / (np.abs(x).max() + 1e-9) * 10 ** (peak_db / 20)).astype(np.float32)


def downlifter(seconds, f0=8000, f1=250, peak_db=-20.0):
    L = n(seconds)
    x = noise(L)

    def g(f, t):
        fc = sweep_curve(t, 0, seconds, f0, f1)[None, :]
        return np.exp(-0.5 * (np.log2(np.maximum(f[:, None], 1) / fc) / 0.8) ** 2)
    x = stft_gain(x, g, n_fft=2048, hop=256)
    env = (1 - np.linspace(0, 1, L)) ** 1.6
    env[:n(0.02)] *= np.linspace(0, 1, n(0.02))
    x *= env[:, None]
    return (x / (np.abs(x).max() + 1e-9) * 10 ** (peak_db / 20)).astype(np.float32)


def reverse_swell(src, seconds, room=0.9, peak_db=-16.0):
    """src(打点) の残響を逆再生した「吸い込み」音. 末尾が打点直前に来る."""
    wet = reverb(src[:n(0.4)], room=room, damping=0.3, wet=1.0, dry=0.0, tail=seconds + 0.5)
    wet = wet[:n(seconds)][::-1].copy()
    env = np.linspace(0, 1, len(wet)) ** 1.5
    wet *= env[:, None]
    return (wet / (np.abs(wet).max() + 1e-9) * 10 ** (peak_db / 20)).astype(np.float32)


def sub_boom(seconds=1.6, f0=70.0, f1=38.0, peak_db=-10.0):
    L = n(seconds)
    t = np.arange(L) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.12)
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.exp(-t / (seconds / 3.5))
    env[:n(0.004)] *= np.linspace(0, 1, n(0.004))
    y = np.sin(ph) * env
    return (np.stack([y, y], 1) * 10 ** (peak_db / 20)).astype(np.float32)


def spectral_freeze(x, seconds, n_fft=4096, hop=1024, decay_s=1.5):
    """x の平均スペクトルを乱数位相で持続させる (リバーブ・フリーズ風の持続音)."""
    out = []
    frames = int(np.ceil(n(seconds) / hop)) + 4
    t = np.arange(frames) * hop / SR
    env = np.exp(-t / decay_s)
    for c in range(2):
        S = np.abs(librosa.stft(x[:, c], n_fft=n_fft, hop_length=hop)).mean(1, keepdims=True)
        ph = np.exp(1j * RNG.uniform(0, 2 * np.pi, (S.shape[0], frames)))
        out.append(librosa.istft(S * ph * env[None, :], hop_length=hop, length=n(seconds)))
    return np.stack(out, 1).astype(np.float32)
