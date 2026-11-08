"""何曲かを繋いだ原曲 (メドレー) から完成版を作るための共通部品。

Medley は 1 つの原曲ファイルと、その解析結果 (曲ごとの区間・テンポ・小節頭) を持ち、
曲ごとの音作り (基準曲に寄せる EQ・音量・ステレオ幅) と、全体の小節割りへの配置を受け持つ。
build_medley5.py / build_medley3.py から使う。
"""
import numpy as np
import scipy.signal as ss

import build_bgm as bb
import dsp
from dsp import SR, db, fade


def apply_fir(x, h):
    if h is None:
        return x
    n = len(h)
    return ss.fftconvolve(x, h[:, None], mode="full")[n // 2: n // 2 + len(x)].astype(np.float32)


class Medley:
    """target: 曲ごとの目標ラウドネス (None = 基準曲として音量を変えない)
    eq_amount: 基準曲の周波数バランスへ寄せる量, eq_maxcut: 削る量の上限 (dB), width: side の倍率"""

    def __init__(self, key, path, analysis, ref, target, eq_amount, eq_maxcut=None, width=None,
                 ref_trim=(0.7, 0.2)):
        bb.SOURCES[key] = path
        self.key = key
        self.seg = {k: tuple(v) for k, v in analysis["segments"].items()}
        self.song = analysis["songs"]
        self.ref = ref
        self.target = target
        self.eq_amount = eq_amount
        self.eq_maxcut = eq_maxcut or {}
        self.width = width or {}
        self.ref_trim = ref_trim
        self._proc = {}

    def beat_time(self, song, j):
        s = self.song[song]
        return s["bar0"] + np.asarray(j, dtype=float) * 60.0 / s["bpm"]

    def cut(self, s0, s1):
        return bb.cut(s0, s1, self.key)

    # ------------------------------------------------------------------ 曲ごとの音作り

    def processor(self, song, amount=None):
        """基準曲に寄せる EQ (FIR) とゲインを、原曲の区間全体から 1 回だけ決める。"""
        amount = self.eq_amount.get(song, 0.0) if amount is None else amount
        key = (song, amount)
        if key in self._proc:
            return self._proc[key]
        a, b = self.seg[song]
        raw = self.cut(a + 0.2, b - 0.2)
        ra, rb = self.seg[self.ref]
        ref = self.cut(ra + self.ref_trim[0], rb - self.ref_trim[1])
        h = None
        if amount > 0:
            _, (f, d) = dsp.match_eq(raw, ref, amount=amount, max_db=self.eq_maxcut.get(song, 6.0),
                                     max_boost=3.0, lo=20)
            h = ss.firwin2(4097, f / (SR / 2), db(d))
        y = apply_fir(raw, h)
        tgt = self.target.get(song)
        gain = 0.0 if tgt is None else tgt - bb.lufs(y)
        self._proc[key] = (h, gain)
        return self._proc[key]

    def process(self, song, y, eq_amount=None, width=None):
        h, gain = self.processor(song, eq_amount)
        y = apply_fir(y, h) * db(gain)
        w = self.width.get(song, 1.0) if width is None else width
        if w != 1.0:
            mid = (y[:, 0] + y[:, 1]) / 2
            side = (y[:, 0] - y[:, 1]) / 2 * w
            y = np.stack([mid + side, mid - side], axis=1).astype(np.float32)
        return y

    # ------------------------------------------------------------------ 配置

    def place(self, tr, L, song, bars, g0, head=0.03, tail=0.03, fin=0.0, fout=0.03,
              end_beat=None, gain_db=0.0, **proc):
        """song の小節 bars を全体の小節 g0.. に合わせて伸縮して置く。
        end_beat: 最後の小節の何拍目で切るか (None = 小節の終わり)。区間の終わりを越える分は自動で切る。"""
        bars = list(bars)
        j0 = bars[0] * 4
        j1 = (bars[-1] + 1) * 4 if end_beat is None else bars[-1] * 4 + end_beat
        js = np.arange(j0, int(np.ceil(j1)) + 1, dtype=float)
        js[-1] = min(js[-1], j1)
        s = self.beat_time(song, js)
        seg_start, seg_end = self.seg[song]
        keep = s <= seg_end - 0.01
        js, s = js[keep], s[keep]
        tail = min(tail, max(0.0, seg_end - s[-1])) if keep.all() else max(0.0, seg_end - 0.01 - s[-1])
        d = np.array([L.gt(g0 + int((j - j0) // 4), (j - j0) % 4) for j in js])
        head = max(0.0, min(head, s[0] - (seg_start - 0.15)))   # 区間の頭より 0.15 秒以上前は使わない
        ratio = np.diff(d) / np.diff(s)
        if np.max(np.abs(ratio - 1.0)) < 1e-4:
            # テンポを変えない場合 (基準曲 / 原曲重視版) は伸縮処理を通さず原音をそのまま使う
            y, d0 = self.cut(s[0] - head, s[-1] + tail), d[0] - head
        else:
            y, d0 = bb.warp(s, d, head, tail, 0.0, name=self.key)
        tr.add(fade(self.process(song, y, **proc), fin, fout), d0, gain_db)

    def place_stretch(self, tr, L, song, s0, s1, t0, t1, head=0.0, fin=0.0, fout=0.0, pitch=0.0,
                      gain_db=0.0, **proc):
        """原曲の s0..s1 秒を、出力の t0..t1 秒にそのまま伸び縮みさせて置く (テンポの無いパッド等)。"""
        y, d0 = bb.warp([s0, s1], [t0, t1], head, 0.0, pitch, name=self.key)
        tr.add(fade(self.process(song, y, **proc), fin, fout), d0, gain_db)

    def landing(self, L, g, song, bar, beat=0, beats=2, tail_sec=5.5, wet_db=-3.0, room=0.95):
        """song の bar 小節 beat 拍目からの和音を最後の「ジャーン」に。頭は原音、後ろは残響で伸ばす。"""
        s0 = self.beat_time(song, bar * 4 + beat) - 0.01
        s1 = self.beat_time(song, bar * 4 + beat + beats)
        dry = fade(self.cut(s0, s1), 0.0, (s1 - s0) * 0.6)
        wet = dsp.reverb(dsp.lp(dry, 7000), room=room, damp=0.45)
        n = len(dry) + int(tail_sec * SR)
        out = np.zeros((n, 2), dtype=np.float32)
        out[:len(dry)] += dry
        m = min(n, len(wet))
        out[:m] += wet[:m] * db(wet_db)
        return fade(out, 0.0, tail_sec * 0.85), L.gt(g) - 0.01


def triplet_fill(dr, kit, L, gbar, gain=0.0):
    """小節の 3-4 拍目に 3 連符のフィル (例: 112 BPM の 3 連 8 分 = 168 BPM の 8 分)。"""
    step = (L.durs[gbar] / 4) / 3
    t0 = L.gt(gbar, 2.0)
    seq = [("snare", None), ("snare", None), ("tom", 48), ("tom", 45), ("tom", 43), ("tom", 41)]
    for k, (inst, p) in enumerate(seq):
        g = -11 + 1.8 * k + gain
        if inst == "snare":
            dr.hit("snare", t0 + k * step, g)
        else:
            dr.tr["tom"].add(kit.toms[p], t0 + k * step, g + 3)


class Plan:
    """曲の並び (小節単位)。各区間の開始小節を名前で引けるようにする。"""

    def __init__(self, tail_bar):
        self.durs, self.at = [], {}
        self.tail_bar = tail_bar

    def add(self, name, n, bar_dur):
        self.at[name] = len(self.durs)
        self.durs += [bar_dur] * n
        return self.at[name]

    def layout(self, extra=16):
        return bb.Layout(self.durs + [self.tail_bar] * extra)
