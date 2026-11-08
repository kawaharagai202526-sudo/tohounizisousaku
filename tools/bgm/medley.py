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
                 ref_trim=(0.7, 0.2), widen=None):
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
        self.widen = widen or {}     # モノラルの曲を広げる量 (dsp.widen)
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
        if self.widen.get(song, 0.0) > 0:
            y = dsp.widen(y, self.widen[song])
        return y

    # ------------------------------------------------------------------ 配置

    def place(self, tr, L, song, bars, g0, head=0.03, tail=0.03, fin=0.0, fout=0.03,
              end_beat=None, gain_db=0.0, hp_out=None, lp_in=None, **proc):
        """song の小節 bars を全体の小節 g0.. に合わせて伸縮して置く。
        end_beat: 最後の小節の何拍目で切るか (None = 小節の終わり)。区間の終わりを越える分は自動で切る。
        hp_out=(秒, Hz): 最後の何秒かで低音をだんだん削る / lp_in=(秒, Hz): 最初の何秒かで高音をだんだん開く"""
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
        y = sweep_edges(self.process(song, y, **proc), hp_out, lp_in)
        tr.add(fade(y, fin, fout), d0, gain_db)

    def place_runs(self, tr, L, song, bars, g0, head=0.03, tail=0.03, fin=0.0, fout=0.03, hp_out=None, lp_in=None,
                   **kw):
        """とびとびの小節 (例: 0-7 と 16-23) を、連続する所ごとに置いて短いクロスフェードで繋ぐ。"""
        runs, cur = [], [bars[0]]
        for b in bars[1:]:
            if b == cur[-1] + 1:
                cur.append(b)
            else:
                runs.append(cur)
                cur = [b]
        runs.append(cur)
        g = g0
        for i, r in enumerate(runs):
            first, last = i == 0, i == len(runs) - 1
            self.place(tr, L, song, r, g, head=head if first else 0.03, tail=tail if last else 0.03,
                       fin=fin if first else 0.06, fout=fout if last else 0.06,
                       hp_out=hp_out if last else None, lp_in=lp_in if first else None, **kw)
            g += len(r)

    def place_stretch(self, tr, L, song, s0, s1, t0, t1, head=0.0, fin=0.0, fout=0.0, pitch=0.0,
                      gain_db=0.0, hp_out=None, lp_in=None, **proc):
        """原曲の s0..s1 秒を、出力の t0..t1 秒にそのまま伸び縮みさせて置く (テンポの無いパッド等)。"""
        y, d0 = bb.warp([s0, s1], [t0, t1], head, 0.0, pitch, name=self.key)
        y = sweep_edges(self.process(song, y, **proc), hp_out, lp_in)
        tr.add(fade(y, fin, fout), d0, gain_db)

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


def sweep_edges(y, hp_out=None, lp_in=None):
    """クリップの終わりをハイパスで抜き、頭をローパスから開く (DJ ミックス風の繋ぎ)。"""
    if hp_out:
        sec, f_to = hp_out
        k = min(len(y), int(sec * SR))
        y = y.copy()
        y[-k:] = dsp.filter_sweep(y[-k:], "hp", 25.0, f_to, curve=1.6)
    if lp_in:
        sec, f_from = lp_in
        k = min(len(y), int(sec * SR))
        y = y.copy()
        y[:k] = dsp.filter_sweep(y[:k], "lp", f_from, 18000.0, curve=0.7)
    return y


def groove(dr, L, g0, n, pat="drive", gain=0.0, crash_every=8, crash_db=-5.0, last=None):
    """全曲共通のドラム層 (同じキット・同じノリ)。4 小節ごとに小さなフィル、8 小節ごとにクラッシュ。
    last: 最後の小節だけ別のパターンにする (繋ぎのフィルとぶつからないように)。"""
    for k in range(n):
        p = pat
        if pat in ("drive", "half") and k % 4 == 3:
            p = pat + "_turn"
        if last is not None and k == n - 1:
            p = last
        if p:
            dr.bar(L, g0 + k, p, gain=gain)
    if crash_every:
        for k in range(crash_every, n, crash_every):
            dr.hit("crash2", L.gt(g0 + k), crash_db)


def common_tone(tr, L, pitch, t0, t1, gain_db=-20.0, attack=0.6):
    """前後の和音に共通する音をパッドで伸ばし、キーの変わり目を自然につなぐ。"""
    tr.add(dsp.pad_note(pitch, t1 - t0, attack=attack), t0, gain_db)


def unify_mix(mus, drums, fxm, kicks, body, duck_db=-2.5, drum_rel=-8.0, space_db=-18.0, target=-13.0):
    """全体の音作りを揃える最終段: ドラム層の音量 → キックに合わせたうねり → 共通の残響 → 全体のコンプ → 音量。"""
    n = len(mus)
    a0, a1 = int(body[0] * SR), int(body[1] * SR)
    d_l, m_l = bb.lufs(drums[a0:a1]), bb.lufs(mus[a0:a1])
    dgain = (m_l + drum_rel) - d_l if d_l > -60 else 0.0
    mus = mus * dsp.duck_env(n, kicks, depth_db=duck_db, release=0.13)
    mus = mus + dsp.reverb(mus, room=0.45, damp=0.55)[:n] * db(space_db)
    mix = mus + drums * db(dgain) + fxm
    rms = 20 * np.log10(np.sqrt(np.mean(mix[a0:a1] ** 2)) + 1e-9)
    mix = dsp.compress(mix, thr=rms + 3.0, ratio=2.0, att=12, rel=160)
    mix = mix * db(target - bb.lufs(mix[a0:a1]))
    return mix, dgain


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


class BeatLayout:
    """拍ごとに長さを持つ小節割り (テンポを途中でなめらかに変えるため)。bb.Layout と同じ使い方。"""

    def __init__(self, beat_durs, t0=0.06):
        self.beats = np.asarray(beat_durs, dtype=float)
        self.bstarts = t0 + np.r_[0, np.cumsum(self.beats)]
        self.durs = [float(self.beats[i:i + 4].sum()) for i in range(0, len(self.beats), 4)]

    def gt(self, bar, beat=0.0):
        pos = int(bar) * 4 + beat
        nb = len(self.beats)
        if pos >= nb:
            return self.bstarts[-1] + (pos - nb) * self.beats[-1]
        i = int(np.floor(pos))
        return self.bstarts[i] + (pos - i) * self.beats[i]

    def step(self, bar, s):
        return self.gt(bar, s / 4.0)

    @property
    def end(self):
        return self.bstarts[-1]


class Plan:
    """曲の並び (小節単位)。各区間の開始小節を名前で引けるようにする。"""

    def __init__(self, tail_bar):
        self.durs, self.at = [], {}
        self.tail_bar = tail_bar
        self.beat_durs = None

    def add(self, name, n, bar_dur):
        self.at[name] = len(self.durs)
        self.durs += [bar_dur] * n
        if self.beat_durs is not None:
            self.beat_durs += [bar_dur / 4] * (4 * n)
        return self.at[name]

    def add_ramp(self, name, n, bpm_from, bpm_to):
        """n 小節かけて bpm_from から bpm_to へ拍ごとになめらかに加速 (減速) する区間。"""
        if self.beat_durs is None:
            self.beat_durs = [d / 4 for d in self.durs for _ in range(4)]
        self.at[name] = len(self.durs)
        k = 4 * n
        bpms = bpm_from + (bpm_to - bpm_from) * (np.arange(k) + 0.5) / k
        beats = list(60.0 / bpms)
        self.beat_durs += beats
        self.durs += [sum(beats[i:i + 4]) for i in range(0, k, 4)]
        return self.at[name]

    def layout(self, extra=16):
        if self.beat_durs is None:
            return bb.Layout(self.durs + [self.tail_bar] * extra)
        return BeatLayout(self.beat_durs + [self.tail_bar / 4] * (4 * extra))
