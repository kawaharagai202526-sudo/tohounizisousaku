"""5 曲つなぎの原曲 (medley5_original.mp3) から、曲調を統一した完成版を 5 パターン作る。

基準は 5 曲目 (S5: 168 BPM, C-D-Bm-Em の王道進行, 最も長い本命の曲)。S5 の音は加工しない。
  * テンポ: S3 (177) / S4 (170) を 168 に。S1・S2 (110) は 168 のちょうど 2/3 = 112 にし、
    112 の 3 連符 = 168 の 8 分 を使ったフィルで 168 へ切り替える (メトリック・モジュレーション)
  * キー: S1 のパッド (E) だけ半音上げて F にし、S2 の B♭ へ「F → B♭」と解決させる。
    ほかの継ぎ目は元から B♭ → B♭m, A♭ → A♭m, E♭ → C と自然に繋がる
  * 音量・周波数バランス・ステレオ感を S5 に寄せる
  * 最後は S5 の F (G# 入り) → E の「スパニッシュ終止」。着地音は S5 の 15 小節目頭の E

使い方: python3 tools/bgm/build_medley5.py [v1 v2 ...]
出力: assets/bgm/medley5/*.ogg と build/bgm/medley5/*.wav, *.mp3
"""
import json
import os
import sys

import numpy as np
import scipy.signal as ss
import soundfile as sf

import build_bgm as bb
import dsp
from dsp import SR, Track, db, fade

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(bb.OUT_DIR, "medley5")
BUILD = os.path.join(bb.BUILD, "medley5")
bb.SOURCES["m5"] = os.path.join(bb.ROOT, "assets", "bgm", "source", "medley5_original.mp3")

M = json.load(open(os.path.join(HERE, "medley5_analysis.json")))
SEG = {k: tuple(v) for k, v in M["segments"].items()}
SONG = M["songs"]

BPM = SONG["S5"]["bpm"]          # 全体のテンポ = S5
BEAT = 60.0 / BPM
BAR = 4 * BEAT
BAR_SLOW = 1.5 * BAR             # 112 BPM の 1 小節 (= 168 BPM の 6 拍)

# 曲ごとの処理: 目標ラウドネス (LUFS), EQ を S5 に寄せる量, ステレオの横幅 (side の倍率)
TARGET = {"S1": -15.5, "S2": -14.0, "S3": -14.0, "S4": -14.0, "S5": None}
EQ_AMOUNT = {"S1": 0.0, "S2": 0.8, "S3": 0.6, "S4": 0.6, "S5": 0.0}
EQ_MAXCUT = {"S2": 10.0}          # S2 は低音が S5 より 10dB 多いので大きめに削る
WIDTH = {"S1": 0.55, "S2": 0.7, "S3": 1.0, "S4": 1.0, "S5": 1.0}

S1_PITCH_INTRO = 1.0 - SONG["S1"]["tuning_cents"] / 100.0    # E → F (+チューニング補正)
S1_PITCH_OUTRO = -SONG["S1"]["tuning_cents"] / 100.0         # E のまま (補正のみ)
LAND_E = (15, 0, 2)      # S5 の 15 小節目 1-2 拍目 (E メジャー) を最後の着地音に使う


def beat_time(song, j):
    s = SONG[song]
    return s["bar0"] + np.asarray(j, dtype=float) * 60.0 / s["bpm"]


# ======================================================================= 曲ごとの音作り

_proc = {}


def song_processor(song, amount=None):
    """S5 に寄せる EQ (FIR) とゲインを、原曲の区間全体から 1 回だけ決める。"""
    amount = EQ_AMOUNT[song] if amount is None else amount
    key = (song, amount)
    if key in _proc:
        return _proc[key]
    a, b = SEG[song]
    raw = bb.cut(a + 0.2, b - 0.2, "m5")
    ref = bb.cut(SEG["S5"][0] + 0.7, SEG["S5"][1] - 0.2, "m5")
    h = None
    if amount > 0:
        _, (f, d) = dsp.match_eq(raw, ref, amount=amount, max_db=EQ_MAXCUT.get(song, 6.0), max_boost=3.0,
                                 lo=20)
        h = ss.firwin2(4097, f / (SR / 2), db(d))
    y = apply_fir(raw, h)
    gain = 0.0 if TARGET[song] is None else TARGET[song] - bb.lufs(y)
    _proc[key] = (h, gain)
    return _proc[key]


def apply_fir(x, h):
    if h is None:
        return x
    n = len(h)
    return ss.fftconvolve(x, h[:, None], mode="full")[n // 2: n // 2 + len(x)].astype(np.float32)


def process(song, y, eq_amount=None, width=None):
    h, gain = song_processor(song, eq_amount)
    y = apply_fir(y, h) * db(gain)
    w = WIDTH[song] if width is None else width
    if w != 1.0:
        mid = (y[:, 0] + y[:, 1]) / 2
        side = (y[:, 0] - y[:, 1]) / 2 * w
        y = np.stack([mid + side, mid - side], axis=1).astype(np.float32)
    return y


# ======================================================================= 配置

def place_song(tr, L, song, bars, g0, head=0.03, tail=0.03, fin=0.0, fout=0.03,
               end_beat=None, keep_tempo=False, **proc):
    """song の小節 bars を全体の小節 g0.. に合わせて伸縮して置く。
    end_beat: 最後の小節の何拍目で切るか (None = 小節の終わり)。区間の終わりを越える分は自動で切る。"""
    bars = list(bars)
    j0 = bars[0] * 4
    j1 = (bars[-1] + 1) * 4 if end_beat is None else bars[-1] * 4 + end_beat
    js = np.arange(j0, int(np.ceil(j1)) + 1, dtype=float)
    js[-1] = min(js[-1], j1)
    s = beat_time(song, js)
    seg_end = SEG[song][1]
    keep = s <= seg_end - 0.01
    js, s = js[keep], s[keep]
    tail = min(tail, max(0.0, seg_end - s[-1])) if keep.all() else max(0.0, seg_end - 0.01 - s[-1])
    d = np.array([L.gt(g0 + int((j - j0) // 4), (j - j0) % 4) for j in js])
    head = max(0.0, min(head, s[0] - (SEG[song][0] - 0.15)))   # 区間の頭より 0.15 秒以上前は使わない
    ratio = np.diff(d) / np.diff(s)
    if np.max(np.abs(ratio - 1.0)) < 1e-4:
        # テンポを変えない場合 (S5 / 原曲重視版) は伸縮処理を通さず原音をそのまま使う
        y, d0 = bb.cut(s[0] - head, s[-1] + tail, "m5"), d[0] - head
    else:
        y, d0 = bb.warp(s, d, head, tail, 0.0, name="m5")
    tr.add(fade(process(song, y, **proc), fin, fout), d0)


def place_pad(tr, L, g0, n_bars, bar_dur, pitch, src_len=13.0, fin=0.0, fout=None, gain_db=0.0):
    """S1 のパッド (テンポ無し) を全体の小節 g0 から n_bars 分 (+1 小節の余韻) に収める。"""
    total = (n_bars + 1) * bar_dur
    src_len = min(src_len, total)
    t0 = L.gt(g0)
    y, d0 = bb.warp([0.0, src_len], [t0, t0 + total], 0.0, 0.0, pitch, name="m5")
    y = process("S1", y)
    tr.add(fade(y, fin, bar_dur if fout is None else fout), d0, gain_db)


def landing(L, g, tail_sec=5.5, wet_db=-3.0, room=0.95, beats=2):
    """S5 の E の和音を最後の「ジャーン」に。頭は原音、後ろは残響で伸ばす。"""
    bar, beat, _ = LAND_E
    s0 = beat_time("S5", bar * 4 + beat) - 0.01
    s1 = beat_time("S5", bar * 4 + beat + beats)
    dry = fade(bb.cut(s0, s1, "m5"), 0.0, (s1 - s0) * 0.6)
    wet = dsp.reverb(dsp.lp(dry, 7000), room=room, damp=0.45)
    n = len(dry) + int(tail_sec * SR)
    out = np.zeros((n, 2), dtype=np.float32)
    out[:len(dry)] += dry
    m = min(n, len(wet))
    out[:m] += wet[:m] * db(wet_db)
    return fade(out, 0.0, tail_sec * 0.85), L.gt(g) - 0.01


def triplet_fill(dr, kit, L, gbar, gain=0.0):
    """112 BPM の小節の 3-4 拍目に 3 連符のフィル。112 の 3 連 8 分 = 168 の 8 分 なので、
    そのまま 168 BPM の S3 へ拍が繋がる。"""
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

    def __init__(self):
        self.durs, self.at = [], {}

    def add(self, name, n, bar_dur):
        self.at[name] = len(self.durs)
        self.durs += [bar_dur] * n
        return self.at[name]

    def layout(self, extra=16):
        return bb.Layout(self.durs + [BAR] * extra)


# ======================================================================= バージョン

def build(version, *, s1_bars=4, s2_bars=4, s3_mode="full", s5_end="land", style="standard",
          original_tempo=False):
    kit = bb.Kit()
    P = Plan()
    t_slow = BAR_SLOW
    t_s2 = 4 * 60.0 / SONG["S2"]["bpm"] if original_tempo else BAR_SLOW
    t_s3 = 4 * 60.0 / SONG["S3"]["bpm"] if original_tempo else BAR
    t_s4 = 4 * 60.0 / SONG["S4"]["bpm"] if original_tempo else BAR
    g_s1 = P.add("S1", s1_bars, t_s2 if original_tempo else t_slow)
    g_s2 = P.add("S2", s2_bars, t_s2)
    n_s3 = 10 if s3_mode == "full" else 8
    g_s3 = P.add("S3", n_s3, t_s3)
    g_s4 = P.add("S4", 16, t_s4)
    # フェードアウト版は、原曲が途中で切れている 32 小節目を使わず 31 小節目 (F) から繰り返しに入る
    g_s5 = P.add("S5", 31 if s5_end == "fade" else 32, BAR)
    g_end = len(P.durs)
    L = P.layout(24)
    total = L.gt(g_end + 24) + 8.0
    n = int(total * SR)
    music, fx, dr = Track(total), Track(total), bb.Drums(total, kit)
    eqa = {"S2": 0.3, "S3": 0.3, "S4": 0.3} if style == "faithful" else {}

    def put(song, bars, g0, **kw):
        if song in eqa:
            kw.setdefault("eq_amount", eqa[song])
        place_song(music, L, song, bars, g0, **kw)

    # ---------------- S1 (パッド, E → F)
    place_pad(music, L, g_s1, s1_bars, L.durs[g_s1], S1_PITCH_INTRO, fin=0.02)
    # ---------------- S2 (B♭)。先頭の助走 (0.64 秒) は S1 の最後に重なる
    put("S2", range(0, s2_bars), g_s2, head=SONG["S2"]["bar0"] - SEG["S2"][0], fin=0.02, fout=0.03)
    # ---------------- S3 (B♭m → A♭)。8 小節目 = ビルド, 9 小節目 = 和音を伸ばすブレイク
    if s3_mode == "full":
        put("S3", range(0, 9), g_s3, head=0.005, tail=0.03, fout=0.06)
        # 9 小節目 (ブレイクで和音を伸ばす所) は原曲が 2.5 拍で切れているので、伸ばして 1 小節を埋める
        s0, s1 = beat_time("S3", 36) - 0.03, SEG["S3"][1] - 0.01
        y, d0 = bb.warp([s0 + 0.03, s1], [L.gt(g_s3 + 9), L.gt(g_s4) - 0.02], 0.03, 0.0, name="m5")
        music.add(fade(process("S3", y, eq_amount=eqa.get("S3")), 0.06, 0.15), d0)
    else:
        put("S3", range(0, 8), g_s3, head=0.005, fout=0.03)
    # ---------------- S4 (A♭m → … → E♭)。最後の小節は前半だけ使い、後半は S5 の助走に渡す
    put("S4", range(0, 16), g_s4, head=0.12, end_beat=2.0, tail=0.0, fin=0.03, fout=0.03)
    # ---------------- S5 (基準, 無加工)。助走 2 拍 + 32 小節 (最後の小節は 3 拍目で原曲が切れる)
    put("S5", range(0, g_end - g_s5), g_s5, head=2 * BEAT, tail=0.0 if s5_end != "fade" else 0.03,
        fin=0.04, fout=0.03)

    # ---------------- 繋ぎ
    soft = style == "faithful"
    # S1 → S2
    fx.add(dsp.reverse_crash(L.durs[g_s2 - 1] / 4), L.gt(g_s2) - L.durs[g_s2 - 1] / 4, -10)
    dr.hit("crash", L.gt(g_s2), -6 if soft else -3)
    # S2 → S3: 3 連符でテンポを 112 → 168 に切り替える
    g_t = g_s3 - 1
    if soft:
        fx.add(dsp.reverse_crash(L.durs[g_t] / 2), L.gt(g_t, 2), -9)
        dr.hit("crash", L.gt(g_s3), 0)
    else:
        if style == "cinematic":
            for b in range(max(g_s2, g_s3 - 2), g_s3):
                for s in (0, 8):
                    dr.tr["tom"].add(kit.toms[41], L.step(b, s), -6)
        fx.add(dsp.riser(L.gt(g_s3) - L.gt(max(g_s2, g_s3 - 2)), 250, 8000), L.gt(max(g_s2, g_s3 - 2)), -12)
        triplet_fill(dr, kit, L, g_t, gain=-1 if style != "drive" else 1)
        dr.hit("crash", L.gt(g_s3), 2)
        dr.hit("kick", L.gt(g_s3), 0)
        fx.add(dsp.impact(), L.gt(g_s3), -9)
    # S3 → S4
    if s3_mode == "full":
        # ブレイクの和音は 2.5 拍目あたりで原曲が切れるので、逆再生シンバルとライザーで S4 へ繋ぐ
        fx.add(dsp.reverse_crash(2 * BEAT), L.gt(g_s4) - 2 * BEAT, -5 if not soft else -7)
        fx.add(dsp.riser(L.gt(g_s4) - L.gt(g_s4 - 2), 300, 7000), L.gt(g_s4 - 2), -14 if not soft else -17)
    else:
        dr.fill(L, g_s4 - 1, "snare16", gain=-2)
    dr.hit("crash", L.gt(g_s4), 1 if not soft else -1)
    if not soft:
        fx.add(dsp.impact(), L.gt(g_s4), -11)
    # S4 → S5 (S4 の最後の小節の後半が S5 の助走)
    if style == "cinematic":
        fx.add(dsp.snare_roll(BAR, 2, 4, 16), L.gt(g_s5 - 2), -17)
        fx.add(dsp.riser(2 * BAR, 200, 7000), L.gt(g_s5 - 2), -13)
    dr.hit("crash", L.gt(g_s5), 2 if not soft else 0)
    if not soft:
        fx.add(dsp.impact(), L.gt(g_s5), -9)
    if style == "drive":
        for g in (g_s4 + 8, g_s5 + 8, g_s5 + 16, g_s5 + 24):
            dr.hit("crash2", L.gt(g), -3)

    # ---------------- 終わり方
    loop_pts = None
    tail_fade = None
    post = []
    if s5_end in ("land", "short", "outro"):
        # S5 の最後の小節は 3 拍目で原曲が切れているので、タムのフィルで埋めて E に着地
        dr.fill(L, g_end - 1, "toms", gain=-2)
        if s5_end == "short":
            hit, at = landing(L, g_end, tail_sec=2.2, wet_db=-8, room=0.75, beats=1)
            tail_fade = (L.gt(g_end) + 2 * BEAT, 2.4)
        else:
            hit, at = landing(L, g_end)
        music.add(hit, at)
        dr.hit("crash", L.gt(g_end), 0)
        dr.hit("crash2", L.gt(g_end), -7)
        dr.hit("kick", L.gt(g_end), 0)
        fx.add(dsp.impact(3.0), L.gt(g_end), -10 if s5_end != "short" else -8)
        if s5_end == "outro":
            # 最初のパッドを元の E のまま戻して締めくくる (ブックエンド)
            place_pad(music, L, g_end, 4, BAR, S1_PITCH_OUTRO, fin=BAR, fout=2.5 * BAR, gain_db=-2)
            fx.add(dsp.downlifter(2 * BAR), L.gt(g_end), -14)
            tail_fade = (L.gt(g_end + 3), 2 * BAR + 1.0)
    elif s5_end == "fade":
        # 最後に S5 の 8-15 小節 (C-D-Bm-Em-C-D-Emaj7-E) をもう一度流しながら消えていく
        fx.add(dsp.reverse_crash(BEAT), L.gt(g_end) - BEAT, -10)
        put("S5", range(8, 16), g_end, head=0.03, tail=0.0, fin=0.06, fout=0.03)
        tail_fade = (L.gt(g_end + 2), L.gt(g_end + 8) - L.gt(g_end + 2))
    elif s5_end == "loop":
        # S5 の最後 (F) → S3 の頭 (B♭m) は「属和音 → 主和音」。S3 からをループする
        dr.fill(L, g_end - 1, "toms", gain=-2)
        fx.add(dsp.reverse_crash(2 * BEAT), L.gt(g_end - 1, 2), -8)
        loop_pts = (L.gt(g_s3) - 0.005, L.gt(g_end) - 0.005)

    # ---------------- ミックス
    drums = dr.mix(n) * db(-2.5)
    fxm = fx.x[:n] + dsp.reverb(fx.x[:n], room=0.7, damp=0.5)[:n] * db(-12)
    mus = music.x[:n]
    if not soft:
        # 薄い残響で曲同士の空気感を揃える (S3-S5 はモノラルなので、ここで少し広がりが出る)
        mus = mus + dsp.reverb(mus, room=0.35, damp=0.6)[:n] * db(-24)
    mix = mus + drums + fxm
    for t0, t1 in post:
        bb.tail_reverb(mix, t0, t1)
    if os.environ.get("BGM_DEBUG"):
        for nm, xx in (("music", mus), ("drums", drums), ("fx", fxm)):
            sf.write(os.path.join(BUILD, f"{version}_stem_{nm}.wav"), xx, SR, subtype="FLOAT")
    dirs = dict(out_dir=OUT_DIR, build_dir=BUILD)
    if loop_pts:
        ls, le = int(round(loop_pts[0] * SR)), int(round(loop_pts[1] * SR))
        info = bb.finish(mix, version, loop=(ls, le), loop_xfade=2 * BAR, loop_add=True, **dirs)
    else:
        info = bb.finish(mix, version, tail_fade=tail_fade, **dirs)
    info["layout"] = {k: round(L.gt(v), 3) for k, v in P.at.items()}
    info["layout"]["end"] = round(L.gt(g_end), 3)
    return info


VERSIONS = {
    # 1: 標準。112 → 168 へ 3 連符で切り替え、5 曲を通して E で「ジャーン」と着地
    "medley5_v1_standard": dict(s1_bars=4, s2_bars=4, s3_mode="full", s5_end="land", style="standard"),
    # 2: 原曲重視。テンポは各曲のまま (伸縮なし)。足す音は控えめ、最後はフェードアウト
    "medley5_v2_faithful": dict(s1_bars=4, s2_bars=4, s3_mode="full", s5_end="fade", style="faithful",
                                original_tempo=True),
    # 3: 疾走。イントロと S2 を短くし、S3 のブレイクも飛ばして一気に。短い「キメ」で終わる
    "medley5_v3_drive": dict(s1_bars=2, s2_bars=2, s3_mode="short", s5_end="short", style="drive"),
    # 4: ドラマチック。イントロを長めに取り、最後に S1 のパッドを元の E で戻して締める
    "medley5_v4_cinematic": dict(s1_bars=6, s2_bars=4, s3_mode="full", s5_end="outro", style="cinematic"),
    # 5: ゲーム用ループ。S1・S2 をイントロにして、S3 → S4 → S5 → S3 … とループ
    "medley5_v5_loop": dict(s1_bars=4, s2_bars=4, s3_mode="full", s5_end="loop", style="standard"),
}


def main():
    names = sys.argv[1:] or list(VERSIONS)
    os.makedirs(bb.CACHE, exist_ok=True)
    os.makedirs(BUILD, exist_ok=True)
    infos = []
    for name in names:
        key = name if name in VERSIONS else next(k for k in VERSIONS if k.split("_")[1] == name)
        print("building", key, flush=True)
        infos.append(build(key, **VERSIONS[key]))
    with open(os.path.join(BUILD, "build_info.json"), "w") as f:
        json.dump(infos, f, indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
