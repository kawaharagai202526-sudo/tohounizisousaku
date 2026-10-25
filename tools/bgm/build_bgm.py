"""3 曲が繋がった原曲から、曲調を統一した完成版 BGM を 5 パターン作る。

現行は 3 曲目 (P3) を削除した 2 曲版 (build_two_part)。P2 は原曲で Gsus4 の途中で
切れているので、パターンごとに終わり方 (着地 / キメ / フェード / P1 再現 / ループ) を作る。
3 曲版 (build_common) も --with-part3 で作り直せる。

方針 (ユーザー指定):
  * 1 曲目 (P1) はほぼそのまま残す
  * 2 曲目 (P2) を全体の基準にする (テンポ 166BPM / チューニング / 音量感 / ノリ)
  * 3 曲目 (P3) は P2 の曲調に合わせる (3 曲版のみ)
  * 繋ぎ目を自然にする。音の追加・削除は可

共通処理:
  * P2 の音は一切加工しない。全体のテンポ = P2 のテンポ (165.99BPM)。
  * P3 は拍追跡結果から 166BPM の一定グリッドへ時間伸縮し、+17 セントずれた
    チューニングを P2 と同じ基準ピッチへ直す。音量・周波数バランスを P2 に寄せ、
    P2 と同系統の 4 つ打ちドラムを足して疾走感を揃える。
  * 繋ぎ目には ライザー / スネアロール / 逆再生シンバル / クラッシュ / インパクト /
    フィル を入れて自然に繋ぐ。

使い方:
  python3 tools/bgm/build_bgm.py [v1 v2 ...]                 # 2 曲版 (P3 を削除, 現行)
  python3 tools/bgm/build_bgm.py --with-part3 [v1 v2 ...]    # 3 曲版
出力: assets/bgm/*.ogg (ゲーム用) と build/bgm/*.wav, *.mp3 (試聴・作業用)
      3 曲版は assets/bgm/with_part3/, build/bgm/with_part3/
"""
import hashlib
import json
import os
import subprocess
import sys

import numpy as np
import pyloudnorm as pyln
import scipy.signal as ss
import soundfile as sf

import dsp
from dsp import SR, Track, db, fade, stereo
from pedalboard import HighShelfFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC_M4A = os.path.join(ROOT, "assets", "bgm", "source", "original.m4a")
OUT_DIR = os.path.join(ROOT, "assets", "bgm")
BUILD = os.environ.get("BGM_BUILD_DIR", os.path.join(ROOT, "build", "bgm"))
CACHE = os.path.join(BUILD, "cache")

A = json.load(open(os.path.join(HERE, "source_analysis.json")))
BPM = A["P2"]["bpm"]
BEAT = 60.0 / BPM
BAR = 4 * BEAT
P1_BEAT = 60.0 / A["P1"]["bpm"]
P1_B0 = A["P1"]["beat0"]
P2_B0 = A["P2"]["beat0"]
P3_BEATS = np.array(A["P3"]["beats"])
P3_I0 = A["P3"]["bar0_beat_index"]
P3_PITCH = (A["P2"]["tuning_cents"] - A["P3"]["tuning_cents"]) / 100.0
P3_END = A["segments"]["P3"][1]
P2_END = A["segments"]["P2"][1]

# P3 の構成 (P3 の小節番号)。自己類似度・低域エネルギー解析より。
P3_A = range(0, 9)       # オスティナート
P3_T = 9                 # 3 拍目に大きなヒット → B へ
P3_B = range(10, 26)     # 重いヒットが続く部分
P3_A2 = range(26, 36)    # オスティナート再現
P3_D = 36                # ここからパッドで締めくくる (〜47 小節 + 余韻)
P3_LAST = 47

rng = np.random.default_rng(7)


# ======================================================================= 音源の位置

def p1_beat(j):
    return P1_B0 + j * P1_BEAT


def p2_beat(j):
    return P2_B0 + j * BEAT


def p3_beat(j):
    """P3 の 0 小節目の頭を 0 とした拍番号 j (小数可) の原曲上の時刻。範囲外は外挿。"""
    k = P3_I0 + np.asarray(j, dtype=float)
    idx = np.arange(len(P3_BEATS))
    out = np.interp(k, idx, P3_BEATS)
    lo, hi = k < 0, k > idx[-1]
    p_lo = P3_BEATS[1] - P3_BEATS[0]
    p_hi = P3_BEATS[-1] - P3_BEATS[-2]
    out = np.where(lo, P3_BEATS[0] + k * p_lo, out)
    out = np.where(hi, P3_BEATS[-1] + (k - idx[-1]) * p_hi, out)
    return out


# ======================================================================= 全体の小節割り

class Layout:
    """曲全体の小節の開始時刻。小節ごとに長さを変えられる (P1 を原速で残す版のため)。"""

    def __init__(self, bar_durs, t0=0.06):
        self.durs = np.asarray(bar_durs, dtype=float)
        self.starts = t0 + np.r_[0, np.cumsum(self.durs)]

    def gt(self, bar, beat=0.0):
        bar = int(bar)
        if bar >= len(self.durs):
            return self.starts[-1] + (bar - len(self.durs)) * BAR + beat * BEAT
        return self.starts[bar] + beat * self.durs[bar] / 4.0

    def step(self, bar, s):
        return self.gt(bar, s / 4.0)

    @property
    def end(self):
        return self.starts[-1]


# ======================================================================= 素材

def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def load_source():
    os.makedirs(CACHE, exist_ok=True)
    wav = os.path.join(CACHE, "original.wav")
    if not os.path.exists(wav):
        run(["ffmpeg", "-hide_banner", "-y", "-i", SRC_M4A, "-ac", "2", "-ar", str(SR), "-c:a", "pcm_f32le", wav])
    x, sr = sf.read(wav, dtype="float32")
    assert sr == SR
    return x


SRC = None


def src():
    global SRC
    if SRC is None:
        SRC = load_source()
    return SRC


def cut(s0, s1):
    x = src()
    return x[max(0, int(round(s0 * SR))):int(round(s1 * SR))].copy()


def warp(s_beats, d_beats, head, tail, pitch=0.0):
    """原曲の拍 s_beats を出力の時刻 d_beats に合わせて伸縮 (rubberband R3)。
    戻り値: (音, 出力上の開始時刻)"""
    s_beats, d_beats = np.asarray(s_beats, float), np.asarray(d_beats, float)
    r0 = (d_beats[1] - d_beats[0]) / (s_beats[1] - s_beats[0])
    r1 = (d_beats[-1] - d_beats[-2]) / (s_beats[-1] - s_beats[-2])
    s0, s1 = s_beats[0] - head, s_beats[-1] + tail
    d0, d1 = d_beats[0] - head * r0, d_beats[-1] + tail * r1
    key = hashlib.sha1(np.r_[s_beats, d_beats - d0, head, tail, pitch].tobytes()).hexdigest()[:16]
    out = os.path.join(CACHE, f"warp_{key}.wav")
    if not os.path.exists(out):
        inp = os.path.join(CACHE, f"in_{key}.wav")
        mp = os.path.join(CACHE, f"map_{key}.txt")
        sf.write(inp, cut(s0, s1), SR, subtype="FLOAT")
        with open(mp, "w") as f:
            last = -1
            for s, d in zip(s_beats, d_beats):
                fs_, fd = int(round((s - s0) * SR)), int(round((d - d0) * SR))
                if fs_ > last:
                    f.write(f"{fs_} {fd}\n")
                    last = fs_
        cmd = ["rubberband", "-3", "-q", "-M", mp, "-D", f"{d1 - d0:.6f}"]
        if abs(pitch) > 1e-4:
            cmd += ["-p", f"{pitch:.4f}"]
        run(cmd + [inp, out])
        os.remove(inp)
    y, _ = sf.read(out, dtype="float32")
    return stereo(y), d0


# ======================================================================= ドラム

class Kit:
    def __init__(self):
        self.kick = dsp.kick()
        self.snare = dsp.snare()
        self.clap = dsp.clap()
        self.hatc = dsp.hat(False)
        self.hato = dsp.hat(True)
        self.crash = dsp.crash(49, 115)
        self.crash2 = dsp.crash(57, 110)
        self.toms = {p: dsp.tom(p) for p in (41, 43, 45, 47, 48, 50)}


PATTERNS = {
    # P2 と同じ「4 つ打ち + 2・4 拍のスネア/クラップ + 裏の 8 分ハット」
    "drive": {"kick": [0, 4, 8, 12], "snare": [4, 12], "clap": [4, 12],
              "hatc": [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15], "hato": [2, 6, 10, 14]},
    "drive_turn": {"kick": [0, 4, 8, 12, 14], "snare": [4, 12, 15], "clap": [4, 12],
                   "hatc": [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13], "hato": [2, 6, 10, 14]},
    "half": {"kick": [0, 10], "snare": [8], "clap": [8],
             "hatc": [0, 2, 4, 6, 8, 10, 12, 14], "hato": []},
    "half_turn": {"kick": [0, 6, 10], "snare": [8, 14, 15], "clap": [8],
                  "hatc": [0, 2, 4, 6, 8, 10, 12], "hato": [14]},
    "kickhat": {"kick": [0, 4, 8, 12], "hatc": [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15],
                "hato": [2, 6, 10, 14]},
    "hats": {"hatc": list(range(16)), "hato": [2, 6, 10, 14]},
    "pulse": {"kick": [0, 8], "hatc": [0, 2, 4, 6, 8, 10, 12, 14]},
}

VEL = {"kick": -6.0, "snare": -4.0, "clap": -5.0, "hatc": -24.0, "hato": -23.0}


class Drums:
    """楽器ごとのトラックに打ち込む。キックの時刻はサイドチェイン用に記録。"""

    def __init__(self, sec, kit):
        self.kit = kit
        self.tr = {k: Track(sec) for k in ("kick", "snare", "clap", "hatc", "hato", "crash", "tom")}
        self.kicks = []

    def hit(self, inst, t, g=0.0):
        if inst == "kick":
            self.kicks.append(t)
        if inst == "crash":
            self.tr["crash"].add(self.kit.crash, t, g)
            return
        if inst == "crash2":
            self.tr["crash"].add(self.kit.crash2, t, g)
            return
        self.tr[inst].add(getattr(self.kit, inst), t, g)

    def bar(self, L, gbar, pat, gain=0.0, swing_ms=0.0, skip=()):
        p = PATTERNS[pat]
        for inst, steps in p.items():
            if inst in skip:
                continue
            for s in steps:
                t = L.step(gbar, s)
                if s % 2 == 1 or (inst in ("hatc", "hato") and s % 4 == 2):
                    t += swing_ms / 1000.0 * (1.0 if s % 4 == 2 else 0.5)
                g = VEL[inst] + gain + rng.normal(0, 0.7)
                if inst == "hatc":
                    g += 0.0 if s % 2 == 0 else -5.0
                self.hit(inst, t, g)

    def fill(self, L, gbar, kind, gain=0.0):
        if kind == "snare16":
            for i, s in enumerate(range(12, 16)):
                self.hit("snare", L.step(gbar, s), -8 + 2 * i + gain)
        elif kind == "snare8":
            for i, s in enumerate(range(8, 16)):
                self.hit("snare", L.step(gbar, s), -12 + 1.3 * i + gain)
        elif kind == "toms":
            seq = [50, 50, 48, 48, 47, 45, 43, 41]
            for i, (s, p) in enumerate(zip(range(8, 16), seq)):
                self.tr["tom"].add(self.kit.toms[p], L.step(gbar, s), -1 + 0.6 * i + gain)
                if s in (8, 12):
                    self.hit("kick", L.step(gbar, s), -3 + gain)
        elif kind == "toms_short":
            for i, (s, p) in enumerate(zip(range(12, 16), [48, 45, 43, 41])):
                self.tr["tom"].add(self.kit.toms[p], L.step(gbar, s), 0 + i + gain)

    def mix(self, n, crash_db=-11.0, tom_db=-4.0, rev_db=-15.0):
        out = np.zeros((n, 2), dtype=np.float32)
        for k, t in self.tr.items():
            x = t.x[:n]
            if k == "hatc":
                x = dsp.pan(x, 0.25)
            elif k == "hato":
                x = dsp.pan(x, -0.2)
            elif k == "crash":
                x = x * db(crash_db)
            elif k == "tom":
                x = x * db(tom_db)
            out += x
        out = dsp.compress(out, thr=-14, ratio=3, att=6, rel=90)
        out = dsp.board(out, [HighShelfFilter(cutoff_frequency_hz=5500, gain_db=-5.0)])
        snare_room = dsp.reverb(self.tr["snare"].x[:n] + self.tr["clap"].x[:n] + self.tr["tom"].x[:n],
                                room=0.45, damp=0.55)[:n]
        return out + snare_room * db(rev_db)


# ======================================================================= ミックス用

METER = pyln.Meter(SR)


def lufs(x):
    if len(x) < SR:
        return -70.0
    v = METER.integrated_loudness(x.astype(np.float64))
    return v if np.isfinite(v) else -70.0


def gain_curve(n, points, ramp=0.25):
    """points: [(時刻, dB)] を階段状にし、ramp 秒でなめらかにつないだゲイン列。"""
    g = np.zeros(n, dtype=np.float32)
    pts = sorted(points)
    for i, (t, v) in enumerate(pts):
        a = int(t * SR)
        b = int(pts[i + 1][0] * SR) if i + 1 < len(pts) else n
        g[max(0, a):max(0, b)] = v
    k = max(1, int(ramp * SR))
    win = np.hanning(2 * k + 1)
    win /= win.sum()
    g = ss.fftconvolve(np.pad(g, (k, k), mode="edge"), win, mode="valid")[:n]
    return db(g).astype(np.float32)[:, None]


_p2_ref = None


def p2_reference():
    global _p2_ref
    if _p2_ref is None:
        _p2_ref = cut(p2_beat(0), p2_beat(128))
    return _p2_ref


def p3_bus(p3, L, sections, kicks, duck_db=-2.5, eq_amount=0.8):
    """P3 を P2 の音像に寄せる: 周波数バランス → コンプ → 区間ごとの音量 → うねり。"""
    y, _ = dsp.match_eq(p3, p2_reference(), amount=eq_amount, max_db=6.0, max_boost=3.0)
    y = dsp.hp(y, 28)
    y = dsp.compress(y, thr=-30, ratio=2.5, att=15, rel=160)
    pts = []
    for (t0, t1, target) in sections:
        seg = y[int(t0 * SR):int(t1 * SR)]
        pts.append((t0, target - lufs(seg)))
    y = y * gain_curve(len(y), pts, ramp=0.3)
    if duck_db:
        y = y * dsp.duck_env(len(y), kicks, depth_db=duck_db, release=0.13)
    return y


def detect_accents(x, L, bars, thr_pct=93):
    """P3 (伸縮後) の低域の強い立ち上がり = 大きなヒットを 8 分単位で拾う。"""
    import librosa
    m = x.mean(axis=1)
    lo = dsp.butter(m, "low", 180)
    hop = 256
    env = librosa.onset.onset_strength(y=lo, sr=SR, hop_length=hop, n_mels=24, fmax=500)
    acc = []
    vals = []
    for b in bars:
        for s in range(0, 16, 2):
            t = L.step(b, s)
            i = int(t * SR / hop)
            v = env[max(0, i - 3):i + 4].max() if i < len(env) else 0
            vals.append(v)
            acc.append((b, s, v))
    th = np.percentile(vals, thr_pct)
    return [(b, s) for b, s, v in acc if v >= th]


def finish(mix, name, loop=None, tail_fade=None, loop_xfade=0.0, loop_add=False,
           out_dir=OUT_DIR, build_dir=BUILD):
    """最終段: 安全のためのリミッター (-1dBFS)。P1/P2 の素材はピークが低いので触れない。
    loop=(始点, 終点) のときは、終点の後に続く音 (残響など) を始点に重ねてから終点で切る。"""
    if tail_fade:
        t0, dur = tail_fade
        n0 = int(t0 * SR)
        n1 = min(len(mix), n0 + int(dur * SR))
        mix[n0:n1] *= np.cos(np.linspace(0, np.pi / 2, n1 - n0))[:, None] ** 2
        mix = mix[:n1]
    mix = dsp.limit(mix, -1.0, 80)
    if loop:
        ls, le = loop
        xf = int(loop_xfade * SR)
        w = np.cos(np.linspace(0, np.pi / 2, xf))[:, None] ** 2
        if loop_add:
            # 終点の後ろには「はみ出した残響」だけがある → 始点に足し込む
            mix[ls:ls + xf] += mix[le:le + xf] * w
            mix[:le] = dsp.limit(mix[:le], -1.0, 80)
        else:
            mix[ls:ls + xf] = mix[ls:ls + xf] * (1 - w) + mix[le:le + xf] * w
        mix = mix[:le]
    # 末尾の無音を詰める
    nz = np.where(np.abs(mix).max(axis=1) > db(-70))[0]
    if loop is None and len(nz):
        mix = mix[: nz[-1] + int(0.2 * SR)]
    os.makedirs(build_dir, exist_ok=True)
    os.makedirs(out_dir, exist_ok=True)
    wav = os.path.join(build_dir, f"{name}.wav")
    sf.write(wav, mix, SR, subtype="PCM_16")
    ogg = os.path.join(out_dir, f"{name}.ogg")
    meta = []
    if loop:
        ls, le = loop
        meta = ["-metadata", f"LOOPSTART={ls}", "-metadata", f"LOOPLENGTH={le - ls}"]
    run(["ffmpeg", "-hide_banner", "-y", "-i", wav, "-c:a", "libvorbis", "-q:a", "6", *meta, ogg])
    run(["ffmpeg", "-hide_banner", "-y", "-i", wav, "-c:a", "libmp3lame", "-b:a", "192k",
         os.path.join(build_dir, f"{name}.mp3")])
    info = {"name": name, "seconds": round(len(mix) / SR, 3), "lufs": round(lufs(mix), 2),
            "peak_db": round(float(20 * np.log10(np.abs(mix).max() + 1e-9)), 2)}
    if loop:
        info.update({"loop_start_sample": int(loop[0]), "loop_end_sample": int(loop[1]),
                     "loop_start_sec": round(loop[0] / SR, 4), "loop_end_sec": round(loop[1] / SR, 4)})
    print(json.dumps(info, ensure_ascii=False))
    return info


# ======================================================================= 部品 (配置)

def place_p1_stretched(tr, L, g0=0, bars=range(0, 21), head=0.035, tail=0.06, fin=0.0, fout=0.04):
    """P1 の小節 bars を全体の小節 g0.. に、166BPM へ伸ばして配置。"""
    bars = list(bars)
    js = np.arange(bars[0] * 4, (bars[-1] + 1) * 4 + 1)
    s = p1_beat(js)
    d = np.array([L.gt(g0 + (j - js[0]) // 4, (j - js[0]) % 4) for j in js])
    y, d0 = warp(s, d, head, tail)
    tr.add(fade(y, fin, fout), d0)


def place_p1_original(tr, L, g0=0, bars=range(0, 16), head=0.035, tail=0.06, fin=0.0, fout=0.04):
    bars = list(bars)
    s0 = p1_beat(bars[0] * 4) - head
    s1 = p1_beat((bars[-1] + 1) * 4) + tail
    tr.add(fade(cut(s0, s1), fin, fout), L.gt(g0) - head)


def place_p2(tr, L, g_pickup, fin=0.006, end_pad=0.02, fout=0.012):
    """P2 は加工せずそのまま (ピックアップ小節 + 32 小節)。"""
    s0 = p2_beat(-4)
    s1 = min(p2_beat(128) + end_pad, P2_END)
    tr.add(fade(cut(s0, s1), fin, fout), L.gt(g_pickup))
    return L.gt(g_pickup + 1)


def p3_warped(L, g_intro, first_bar=-1, last_bar=P3_LAST, head=0.03):
    """P3 (小節 first_bar..last_bar と余韻) を全体の小節 g_intro.. に 166BPM で配置した音。"""
    js = np.arange(first_bar * 4, last_bar * 4 + 1)
    s = p3_beat(js)
    keep = s <= P3_END - 0.05
    js, s = js[keep], s[keep]
    d = np.array([L.gt(g_intro + (j - js[0]) // 4, (j - js[0]) % 4) for j in js])
    tail = max(0.0, P3_END - s[-1])
    y, d0 = warp(s, d, head, tail, P3_PITCH)
    return y, d0


def p2_tail_reverb(L, g_end, gain_db=-18.0, dur=1.0):
    """P2 は 80.14 秒で唐突に切れているので、最後の 1 拍の残響を足して余韻を作る。"""
    last = cut(p2_beat(127), p2_beat(128))
    wet = dsp.reverb(dsp.lp(last, 5000), room=0.8, damp=0.6)
    wet = wet[len(last):len(last) + int(dur * SR)]
    return fade(wet, 0.01, dur * 0.8) * db(gain_db), L.gt(g_end)


# ======================================================================= バージョン

def make_layout(n_bars, p1_mode, p1_main, n_bd):
    durs = [BAR] * n_bars
    if p1_mode == "original":
        P1BAR = 4 * P1_BEAT
        for k in range(p1_main):
            durs[k] = P1BAR
        # ブレイク部分で 162 → 166 BPM へなめらかに加速
        for i in range(n_bd):
            a = (i + 1) / (n_bd + 1)
            durs[p1_main + i] = P1BAR * (1 - a) + BAR * a
    return Layout(durs)


def place_p1_t1_p2(L, orig, fx, dr, kit, p1_mode, breakdown, t1, p1_main, n_bd, g_pick, g_p2, p2_kw=None):
    """P1 (+ブレイク) → 繋ぎ (T1) → P2 を配置する。2 曲版・3 曲版で共通。"""
    # ---------------- P1
    if p1_mode == "stretch":
        if breakdown == "as_is":
            place_p1_stretched(orig, L, 0, range(0, 21))
        else:
            # 16≈18, 17≈19 小節なので 18-19 小節をもう一度挟んで 8 小節フレーズにする
            place_p1_stretched(orig, L, 0, range(0, 20), tail=0.03, fout=0.06)
            place_p1_stretched(orig, L, 20, range(18, 21), head=0.03, fin=0.06)
    else:
        place_p1_original(orig, L, 0, range(0, 16), tail=0.04, fout=0.08)
        js = np.arange(16 * 4, 21 * 4 + 1)
        s = p1_beat(js)
        d = np.array([L.gt(16 + (j - js[0]) // 4, (j - js[0]) % 4) for j in js])
        y, d0 = warp(s, d, 0.04, 0.06)
        orig.add(fade(y, 0.08, 0.04), d0)

    # ---------------- T1: P1 → P2
    bd0 = p1_main
    if t1 == "build":
        dr_roll = dsp.snare_roll(BAR, 2)
        fx.add(dr_roll, L.gt(g_pick - 2), -15)
        fx.add(dsp.riser(L.gt(g_pick, 2) - L.gt(g_pick - 2)), L.gt(g_pick - 2), -12)
        fx.add(dsp.reverse_crash(2 * BEAT), L.gt(g_pick, 2), -8)
        fx.add(dsp.impact(), L.gt(g_p2), -9)
        dr.hit("crash", L.gt(g_p2), 2)
        dr.hit("kick", L.gt(g_p2), 0)
    elif t1 == "gentle":
        fx.add(dsp.riser(2 * BAR, 300, 6000), L.gt(g_pick - 1) - 0 * BAR, -10)
        fx.add(dsp.reverse_crash(BAR), L.gt(g_pick), -5)
        dr.hit("crash", L.gt(g_p2), 0)
    elif t1 == "drive":
        # ブレイクの後半からキックを 4 つ打ちで入れて、P2 へ助走をつける
        for b in range(bd0 + n_bd - 2, g_pick):
            dr.bar(L, b, "pulse" if b < g_pick - 1 else "kickhat", gain=-3)
        fx.add(dsp.snare_roll(BAR, 1, 8, 32), L.gt(g_pick - 1), -14)
        fx.add(dsp.riser(L.gt(g_pick, 2) - L.gt(g_pick - 2)), L.gt(g_pick - 2), -11)
        fx.add(dsp.impact(), L.gt(g_p2), -9)
        dr.hit("crash", L.gt(g_p2), 3)
        dr.hit("crash2", L.gt(g_p2 + 16), -1)   # P2 の転調 (F#m→Gm) を強調
    elif t1 == "cinematic":
        for b in range(bd0 + n_bd - 4, g_pick):
            for s in (0, 8):
                dr.tr["tom"].add(kit.toms[41], L.step(b, s), -6)
        fx.add(dsp.snare_roll(BAR, 2, 4, 16), L.gt(g_pick - 2), -16)
        fx.add(dsp.riser(4 * BAR, 200, 7000), L.gt(g_pick - 4) + 0.5 * BAR, -13)
        fx.add(dsp.reverse_crash(2 * BEAT), L.gt(g_pick, 2), -4)
        fx.add(dsp.impact(), L.gt(g_p2), -8)
        dr.hit("crash", L.gt(g_p2), 2)

    # ---------------- P2 (無加工)
    place_p2(orig, L, g_pick, **(p2_kw or {}))



def build_common(version, *, p1_mode="stretch", breakdown="as_is", t1="build", t2="fill",
                 p3_style="standard", ending="natural"):
    """各バージョンの組み立て。引数で繋ぎ方・P3 の寄せ方・終わり方を切り替える。"""
    kit = Kit()

    # ---------------- 小節割り
    p1_main = 16
    bd_bars = [16, 17, 18, 19, 20] if breakdown == "as_is" else [16, 17, 18, 19, 18, 19, 20]
    n_bd = len(bd_bars)
    g_pick = p1_main + n_bd              # P2 のピックアップ小節
    g_p2 = g_pick + 1                    # P2 の 0 小節目
    g_p3i = g_p2 + 32                    # P3 のイントロ小節 (P3 の -1 小節目)
    g_p3 = g_p3i + 1                     # P3 の 0 小節目
    if ending == "short":
        p3_last = P3_D + 2
    elif ending == "loop":
        p3_last = P3_A2.stop             # A2 の終わりで P2 へ戻る
    else:
        p3_last = P3_LAST
    g_end = g_p3 + p3_last
    L = make_layout(g_end + 8, p1_mode, p1_main, n_bd)
    total = L.gt(g_end + 8) + 6.0
    n = int(total * SR)

    orig = Track(total)      # P1 / P2 の原音
    fx = Track(total)        # 効果音
    dr = Drums(total, kit)

    place_p1_t1_p2(L, orig, fx, dr, kit, p1_mode, breakdown, t1, p1_main, n_bd, g_pick, g_p2)

    # ---------------- T2: P2 → P3
    g_last_p2 = g_p3i - 1
    tail, tpos = p2_tail_reverb(L, g_p3i)
    fx.add(tail, tpos)
    if t2 == "fill":
        dr.fill(L, g_last_p2, "toms", gain=-2)
        fx.add(dsp.impact(), L.gt(g_p3i), -10)
        dr.hit("crash", L.gt(g_p3i), 1)
        dr.hit("kick", L.gt(g_p3i), 0)
        fx.add(dsp.reverse_crash(2 * BEAT), L.gt(g_p3i, 2), -6)
    elif t2 == "drop":
        fx.add(dsp.impact(), L.gt(g_p3i), -8)
        dr.hit("crash", L.gt(g_p3i), 1)
        fx.add(dsp.downlifter(BAR * 1.5), L.gt(g_p3i), -6)
    elif t2 == "straight":
        dr.fill(L, g_last_p2, "snare8", gain=-3)
        dr.hit("crash", L.gt(g_p3i), 2)
        fx.add(dsp.impact(), L.gt(g_p3i), -11)
        dr.bar(L, g_p3i, "kickhat", gain=-2)
    elif t2 == "gentle":
        dr.hit("crash", L.gt(g_p3i), -1)
        fx.add(dsp.downlifter(BAR), L.gt(g_p3i), -9)
        fx.add(dsp.reverse_crash(BAR * 0.5), L.gt(g_p3i, 2), -8)

    # ---------------- P3 (166BPM・チューニング補正)
    p3, d0 = p3_warped(L, g_p3i, -1, p3_last + (0 if ending == "natural" else 1))
    p3_track = Track(total)
    p3_track.add(fade(p3, 0.03, 0.0), d0)
    p3x = p3_track.x[:n]
    if ending == "loop":
        # A2 の終わりで P3 を止め、P2 のピックアップ小節へ渡す
        c = int((L.gt(g_p3 + P3_A2.stop) + 0.03) * SR)
        f = int(0.12 * SR)
        p3x[c - f:c] *= np.cos(np.linspace(0, np.pi / 2, f))[:, None] ** 2
        p3x[c:] = 0

    def gb(k):  # P3 の小節番号 → 全体の小節番号
        return g_p3 + k

    accents = detect_accents(p3x, L, [gb(k) for k in P3_B], thr_pct=94)
    acc_bars = sorted({b for b, s in accents if s == 0})
    print("  P3 accents (P3 bar):", [b - g_p3 for b in acc_bars])

    swing = 12.0   # P3 は裏拍がわずかに後ろ → ハットも少しだけ後ろへ (フラム防止)
    if p3_style in ("standard", "drive", "light", "buildup"):
        g_main = {"standard": 0, "drive": 1.5, "light": -3, "buildup": 0}[p3_style]
        # A: 0..8
        for k in P3_A:
            b = gb(k)
            if p3_style == "light":
                pat = "kickhat"
            elif p3_style == "buildup":
                pat = "hats" if k < 4 else ("kickhat" if k < 8 else "drive")
            else:
                pat = "drive_turn" if k % 4 == 3 else "drive"
            dr.bar(L, b, pat, gain=g_main, swing_ms=swing)
        dr.hit("crash", L.gt(gb(0)), 0 if p3_style != "buildup" else -6)
        if p3_style != "buildup":
            dr.hit("crash2", L.gt(gb(4)), -6)
        dr.fill(L, gb(8), "snare16", gain=g_main)
        # T: 9 小節目 (3 拍目に原曲の大きなヒット)
        b = gb(P3_T)
        for s in (0, 4):
            dr.hit("kick", L.step(b, s), g_main)
        dr.hit("kick", L.step(b, 8), g_main + 1)
        dr.hit("crash", L.step(b, 8), 0)
        if p3_style == "buildup":
            fx.add(dsp.snare_roll(BAR, 1, 8, 32), L.gt(gb(8)), -10)
        dr.fill(L, b, "snare16", gain=g_main + 1)
        # B: 重いヒットの部分。drive 以外はハーフタイムで重さを出す
        for k in P3_B:
            b = gb(k)
            if p3_style == "drive":
                pat = "drive_turn" if k % 4 == 1 else "drive"
            else:
                pat = "half_turn" if k % 4 == 1 else "half"
            dr.bar(L, b, pat, gain=g_main, swing_ms=swing)
        dr.hit("crash", L.gt(gb(P3_B.start)), 1)
        last_c = -9
        for b in acc_bars:
            if b - last_c >= 2 and b != gb(P3_B.start):
                dr.hit("crash2", L.gt(b), -3)
                last_c = b
        dr.fill(L, gb(P3_B.stop - 1), "toms", gain=-2 + g_main)
        # A2: 26..35
        for k in P3_A2:
            b = gb(k)
            pat = "drive_turn" if (k - P3_A2.start) % 4 == 3 else "drive"
            if p3_style == "light" and k < P3_A2.start + 4:
                pat = "kickhat"
            dr.bar(L, b, pat, gain=g_main + 0.5, swing_ms=swing)
        dr.hit("crash", L.gt(gb(P3_A2.start)), 2)
        dr.hit("crash2", L.gt(gb(P3_A2.start + 4)), -4)
        dr.hit("crash", L.gt(gb(P3_A2.start + 8)), -2)
        if ending != "loop":
            dr.fill(L, gb(P3_A2.stop - 1), "toms" if p3_style != "light" else "snare16", gain=-1)

    # ---------------- 終わり方
    loop_pts = None
    tail_fade = None
    if ending == "natural":
        # D: パッドで締める。ドラムは 36 小節目のクラッシュで抜ける
        b = gb(P3_D)
        dr.hit("crash", L.gt(b), 2)
        dr.hit("kick", L.gt(b), 0)
        fx.add(dsp.impact(), L.gt(b), -11)
        # 最後の和音に向けて逆シンバル → 静かなクラッシュで着地
        b_last = gb(P3_LAST - 4)
        fx.add(dsp.reverse_crash(BAR), L.gt(b_last - 1), -9)
        dr.hit("crash2", L.gt(b_last), -8)
        tail_fade = (L.gt(gb(P3_LAST)) + 1.5, 4.0)
    elif ending == "short":
        b = gb(P3_D)
        dr.hit("crash", L.gt(b), 3)
        dr.hit("kick", L.gt(b), 1)
        fx.add(dsp.impact(3.5), L.gt(b), -6)
        tail_fade = (L.gt(b) + BEAT * 1.5, BAR * 2.2)
    elif ending == "loop":
        # A2 の後に P2 のピックアップ小節をもう一度置き、P2 の 0 小節目へ戻る
        g_ret = gb(P3_A2.stop)
        fx.add(dsp.snare_roll(BAR, 2), L.gt(g_ret - 2), -13)
        fx.add(dsp.riser(L.gt(g_ret, 2) - L.gt(g_ret - 2)), L.gt(g_ret - 2), -11)
        fx.add(dsp.reverse_crash(2 * BEAT), L.gt(g_ret, 2), -8)
        s0, s1 = p2_beat(-4), p2_beat(8)
        orig.add(fade(cut(s0, s1), 0.006, 0.0), L.gt(g_ret))
        fx.add(dsp.impact(), L.gt(g_ret + 1), -9)
        dr.hit("crash", L.gt(g_ret + 1), 2)
        dr.hit("kick", L.gt(g_ret + 1), 0)
        loop_pts = (L.gt(g_p2), L.gt(g_ret + 1))

    # ---------------- ミックス
    p3_start = L.gt(g_p3i)
    sec = []
    # P3 の音楽部分だけの目標ラウドネス (LUFS)。ここにドラムが乗って P2 (-15.6〜-10.1) と同程度になる
    tgt = {"standard": (-11.5, -11.0, -10.5, -14.0), "drive": (-11.0, -10.8, -10.3, -13.5),
           "light": (-12.0, -11.5, -11.0, -14.5), "buildup": (-12.5, -11.0, -10.5, -14.0)}[p3_style]
    sec.append((p3_start, L.gt(gb(P3_T)), tgt[0]))
    sec.append((L.gt(gb(P3_T)), L.gt(gb(P3_A2.start)), tgt[1]))
    sec.append((L.gt(gb(P3_A2.start)), L.gt(gb(P3_D)), tgt[2]))
    sec.append((L.gt(gb(P3_D)), L.gt(gb(P3_LAST)) + 3, tgt[3]))
    duck = {"standard": -2.5, "drive": -4.0, "light": 0.0, "buildup": -2.5}[p3_style]
    kicks_p3 = [t for t in dr.kicks if t >= p3_start]
    p3m = p3_bus(p3x, L, sec, kicks_p3, duck_db=duck)

    drums = dr.mix(n)
    # ドラムの音量: P3 の A 区間で、P3 の音楽に対して決まった差 (LU) になるように
    a0, a1 = int(L.gt(gb(P3_A2.start + 4)) * SR), int(L.gt(gb(P3_A2.stop)) * SR)
    rel = {"standard": -5.0, "drive": -3.5, "light": -8.0, "buildup": -5.0}[p3_style]
    d_l = lufs(drums[a0:a1])
    m_l = lufs(p3m[a0:a1])
    dgain = (m_l + rel) - d_l if d_l > -60 else 0.0
    drums *= db(dgain)

    if ending == "natural":
        # 原曲 P3 は最後が短くフェードして終わるので、最後の 2 小節の残響で自然に減衰させる
        e1 = int(min(L.gt(gb(P3_LAST)) + 1.1, n / SR) * SR)
        e0 = e1 - int(2 * BAR * SR)
        wet = dsp.reverb(p3m[e0:e1], room=0.85, damp=0.55)
        p3m[e0:e0 + len(wet)] += wet[:n - e0] * db(-9)
    pre = p3m + drums
    p3sum = dsp.limit(pre, -1.5, 60)
    over = np.abs(pre).max(axis=1) > db(-1.5)
    print(f"  P3 bus: limiter active on {over.mean() * 100:.2f}% of samples, "
          f"max overshoot {20 * np.log10(np.abs(pre).max() + 1e-9) + 1.5:.1f} dB, drum gain {dgain:+.1f} dB")
    if os.environ.get("BGM_DEBUG"):
        for nm, xx in (("p3", p3m), ("drums", drums), ("orig", orig.x[:n]), ("fx", fx.x[:n])):
            sf.write(os.path.join(BUILD, f"{version}_stem_{nm}.wav"), xx, SR, subtype="FLOAT")

    fxm = fx.x[:n] + dsp.reverb(fx.x[:n], room=0.7, damp=0.5)[:n] * db(-12)
    mix = orig.x[:n] + p3sum + fxm

    dirs = dict(out_dir=os.path.join(OUT_DIR, "with_part3"), build_dir=os.path.join(BUILD, "with_part3"))
    if loop_pts:
        ls, le = int(round(loop_pts[0] * SR)), int(round(loop_pts[1] * SR))
        info = finish(mix, version, loop=(ls, le), loop_xfade=2 * BAR, **dirs)
    else:
        info = finish(mix, version, tail_fade=tail_fade, **dirs)
    info["layout"] = {"p2_bar0_sec": round(L.gt(g_p2), 3), "p3_bar0_sec": round(L.gt(g_p3), 3),
                      "p3_intro_sec": round(L.gt(g_p3i), 3)}
    return info


# ======================================================================= 2 曲版 (P3 を削除)

def landing(s0, s1, tail_sec, wet_db=-5.0, room=0.9):
    """原曲の一瞬 (s0..s1 秒) を最後の「ジャーン」にする。頭は原音のまま、後ろは残響で伸ばす。"""
    dry = fade(cut(s0, s1), 0.0, (s1 - s0) * 0.6)
    wet = dsp.reverb(dsp.lp(dry, 7000), room=room, damp=0.45)
    n = len(dry) + int(tail_sec * SR)
    out = np.zeros((n, 2), dtype=np.float32)
    out[:len(dry)] += dry
    m = min(n, len(wet))
    out[:m] += wet[:m] * db(wet_db)
    return fade(out, 0.0, tail_sec * 0.85)


def tail_reverb(x, t0, t1, gain_db=-8.0, room=0.88):
    """x の t0..t1 秒の残響 (wet のみ) を t0 から足して、終わりを自然に減衰させる。"""
    seg = x[int(t0 * SR):int(t1 * SR)]
    wet = dsp.reverb(seg, room=room, damp=0.5)
    i = int(t0 * SR)
    m = min(len(wet), len(x) - i)
    x[i:i + m] += wet[:m] * db(gain_db)


# P2 の最後は Gm → F → G/B → Gsus4。30 小節目の頭 (G5) を「Gsus4 → G」の着地音に使う
P2_LAND = 120


def build_two_part(version, *, p1_mode="stretch", breakdown="as_is", t1="build", ending="land"):
    """P1 → P2 の 2 曲構成。P2 は原曲で途中 (Gsus4) のまま切れているので終わり方を作る。"""
    kit = Kit()
    p1_main = 16
    n_bd = 5 if breakdown == "as_is" else 7
    g_pick = p1_main + n_bd
    g_p2 = g_pick + 1
    g_end = g_p2 + 32              # P2 の次の小節 (= 終わり方を置く小節)
    g_last = g_end - 1
    L = make_layout(g_end + 20, p1_mode, p1_main, n_bd)
    total = L.gt(g_end + 20) + 8.0
    n = int(total * SR)
    orig, fx, dr = Track(total), Track(total), Drums(total, kit)

    place_p1_t1_p2(L, orig, fx, dr, kit, p1_mode, breakdown, t1, p1_main, n_bd, g_pick, g_p2,
                   p2_kw=dict(end_pad=0.0, fout=0.01) if ending == "loop" else None)

    loop_pts = None
    tail_fade = None
    post = []   # ミックス後に足す残響 (t0, t1)
    if ending == "land":
        # タムのフィル → Gsus4 が G に解決して「ジャーン」
        dr.fill(L, g_last, "toms", gain=-2)
        orig.add(landing(p2_beat(P2_LAND) - 0.01, p2_beat(P2_LAND + 2), 5.5, wet_db=-1.0, room=0.95),
                 L.gt(g_end) - 0.01)
        dr.hit("crash", L.gt(g_end), 2)
        dr.hit("crash2", L.gt(g_end), -5)
        dr.hit("kick", L.gt(g_end), 1)
        fx.add(dsp.impact(3.0), L.gt(g_end), -8)
    elif ending == "short":
        # スネアで詰めて短い「キメ」で終わる
        dr.fill(L, g_last, "snare8", gain=-2)
        orig.add(landing(p2_beat(P2_LAND) - 0.01, p2_beat(P2_LAND + 1), 2.2, wet_db=-8, room=0.75),
                 L.gt(g_end) - 0.01)
        dr.hit("crash", L.gt(g_end), 3)
        dr.hit("kick", L.gt(g_end), 2)
        fx.add(dsp.impact(2.5), L.gt(g_end), -6)
        tail_fade = (L.gt(g_end) + 2 * BEAT, 2.4)
    elif ending == "fade":
        # 最後の 8 小節 (24-31) をもう一度繰り返し、だんだん小さくして終わる (足す音は無し)
        s0 = p2_beat(96) - 0.025
        orig.add(fade(cut(s0, P2_END), 0.05, 0.012), L.gt(g_end) - 0.025)
        tail_fade = (L.gt(g_end + 2), L.gt(g_end + 8) - L.gt(g_end + 2))
    elif ending == "reprise":
        # P1 のテーマ (8-15 小節) をもう一度。P1 自身のブレイク頭 (D#sus4) の和音で着地
        dr.fill(L, g_last, "toms", gain=-3)
        fx.add(dsp.reverse_crash(2 * BEAT), L.gt(g_last, 2), -6)
        place_p1_stretched(orig, L, g_end, range(8, 20), head=0.03, tail=0.0, fin=0.03, fout=BAR)
        dr.hit("crash", L.gt(g_end), 2)
        fx.add(dsp.impact(), L.gt(g_end), -9)
        g_fin = g_end + 8
        dr.hit("crash", L.gt(g_fin), 1)
        dr.hit("crash2", L.gt(g_fin), -5)
        dr.hit("kick", L.gt(g_fin), 0)
        fx.add(dsp.impact(3.0), L.gt(g_fin), -9)
        post.append((L.gt(g_fin), L.gt(g_fin + 1)))
        tail_fade = (L.gt(g_fin, 2), L.gt(g_fin + 2) - L.gt(g_fin, 2) + 1.0)
    elif ending == "loop":
        # P2 の後に P1 の頭へ戻って曲全体をループ (P1→P2 と同じくクラッシュで着地)
        dr.fill(L, g_last, "toms", gain=-2)
        fx.add(dsp.reverse_crash(2 * BEAT), L.gt(g_last, 2), -8)
        dr.hit("crash", L.gt(0), 0)
        fx.add(dsp.impact(), L.gt(0), -12)
        loop_pts = (L.gt(0) - 0.035, L.gt(g_end) - 0.035)

    drums = dr.mix(n) * db(-2.5)
    fxm = fx.x[:n] + dsp.reverb(fx.x[:n], room=0.7, damp=0.5)[:n] * db(-12)
    mix = orig.x[:n] + drums + fxm
    for t0, t1 in post:
        tail_reverb(mix, t0, t1)
    if os.environ.get("BGM_DEBUG"):
        for nm, xx in (("drums", drums), ("orig", orig.x[:n]), ("fx", fxm)):
            sf.write(os.path.join(BUILD, f"{version}_stem_{nm}.wav"), xx, SR, subtype="FLOAT")

    if loop_pts:
        ls, le = int(round(loop_pts[0] * SR)), int(round(loop_pts[1] * SR))
        info = finish(mix, version, loop=(ls, le), loop_xfade=2 * BAR, loop_add=True)
    else:
        info = finish(mix, version, tail_fade=tail_fade)
    info["layout"] = {"p2_pickup_sec": round(L.gt(g_pick), 3), "p2_bar0_sec": round(L.gt(g_p2), 3),
                      "p2_end_sec": round(L.gt(g_end), 3)}
    return info


# 2 曲版 (P3 を削除)。assets/bgm/ に出力
VERSIONS = {
    # 1: 標準。166BPM に統一、ビルドアップで繋いで、Gsus4 → G の「ジャーン」で終わる
    "bgm_v1_standard": dict(p1_mode="stretch", breakdown="as_is", t1="build", ending="land"),
    # 2: 原曲重視。P1 は原速のまま。最後は P2 の最後の 8 小節を繰り返してフェードアウト
    "bgm_v2_faithful": dict(p1_mode="original", breakdown="as_is", t1="gentle", ending="fade"),
    # 3: 疾走。キックで助走をつけて P2 へ。短い「キメ」で終わる
    "bgm_v3_drive": dict(p1_mode="stretch", breakdown="as_is", t1="drive", ending="short"),
    # 4: ドラマチック。ブレイクを 8 小節に整え、最後に P1 のテーマを再現して締める
    "bgm_v4_cinematic": dict(p1_mode="stretch", breakdown="extend", t1="cinematic", ending="reprise"),
    # 5: ゲーム用ループ。P2 の後に P1 の頭へ戻る (曲全体がループ)
    "bgm_v5_loop": dict(p1_mode="stretch", breakdown="as_is", t1="build", ending="loop"),
}

# 3 曲版 (前回のもの)。assets/bgm/with_part3/ に出力
VERSIONS_3PART = {
    # 1: 標準。全体を 166BPM に統一、王道のビルドアップで繋ぐ
    "bgm_v1_standard": dict(p1_mode="stretch", breakdown="as_is", t1="build", t2="fill",
                            p3_style="standard", ending="natural"),
    # 2: 原曲重視。P1 は完全に原速のまま、ブレイク中に 166BPM へ加速。足す音は控えめ
    "bgm_v2_faithful": dict(p1_mode="original", breakdown="as_is", t1="gentle", t2="gentle",
                            p3_style="light", ending="natural"),
    # 3: 疾走。P2→P3 をドラムを止めずに直結、P3 を一番強く P2 寄せ、短く締める
    "bgm_v3_drive": dict(p1_mode="stretch", breakdown="as_is", t1="drive", t2="straight",
                         p3_style="drive", ending="short"),
    # 4: ドラマチック。ブレイクを 8 小節に整え、P3 はドロップから徐々にドラムが入る
    "bgm_v4_cinematic": dict(p1_mode="stretch", breakdown="extend", t1="cinematic", t2="drop",
                             p3_style="buildup", ending="natural"),
    # 5: ゲーム用ループ。P3 の後に P2 の頭へ戻る (LOOPSTART/LOOPLENGTH 付き)
    "bgm_v5_loop": dict(p1_mode="stretch", breakdown="as_is", t1="build", t2="fill",
                        p3_style="standard", ending="loop"),
}


def main():
    args = sys.argv[1:]
    three = "--with-part3" in args
    args = [a for a in args if a != "--with-part3"]
    table, builder = (VERSIONS_3PART, build_common) if three else (VERSIONS, build_two_part)
    names = args or list(table)
    os.makedirs(CACHE, exist_ok=True)
    infos = []
    for name in names:
        key = next(k for k in table if k == name or k.startswith(name + "_") or k.split("_")[1] == name)
        print("building", key, "(3 曲版)" if three else "(2 曲版)", flush=True)
        infos.append(builder(key, **table[key]))
    out = os.path.join(BUILD, "with_part3" if three else "", "build_info.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as f:
        json.dump(infos, f, indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
