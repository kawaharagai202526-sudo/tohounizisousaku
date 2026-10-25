"""曲3 を曲2 の曲調に寄せる処理.

1. 内部の継ぎ目 (236〜240 秒の 4 秒減衰 + 無音 → 続き) を
   1 小節ブレイク + 逆再生スウェルに置き換えて小節グリッドに揃える
2. 115 BPM → 113.1 BPM (曲3 の 3 拍 = 曲2 の 1 小節) に微調整
3. 打撃成分を少し下げ、残響を足し、長時間平均スペクトルを曲2 に半分寄せる
4. 曲2 風のデチューン・ノコギリ波パッド (ルート + 5 度) をベース進行に沿って重ねる
"""
import json
import os
import sys

import numpy as np

import dsp
from chords import pad_events, root_segments

# ---- 原曲 (結合動画) 上の時刻 [秒]
S3_HIT = 161.3434        # 曲3 冒頭の打点 (小節 0 の頭)
S3_BEAT = 0.52185        # 曲3 前半の拍周期 (114.98 BPM)
S3_B_HIT = 240.4395      # 後半 (再開部) の最初の打点
S3_FINAL = 269.37        # 最後の小節頭 (クラッシュ). 原曲はここでフェードアウト
S2_BEAT = 0.39791        # 曲2 の拍周期 (150.8 BPM)

TARGET_BEAT = S2_BEAT * 4 / 3   # 曲3 の 3 拍 = 曲2 の 1 小節
SPEED = S3_BEAT / TARGET_BEAT   # < 1 : 少しゆっくり
PRE = 0.004                     # 打点前の余白


def assemble(orig):
    """継ぎ目を直した曲3 (原曲テンポ) と、各打点の区間内時刻を返す."""
    bar = 4 * S3_BEAT
    restart = S3_HIT + 37 * bar  # ブレイク (1 小節) 明けの 37 小節目頭
    a = dsp.cut(orig, S3_HIT - PRE, restart + 0.10)
    a[: dsp.n(PRE)] *= dsp.ramp(dsp.n(PRE), "in")
    fo0 = dsp.n(restart - 0.35 - (S3_HIT - PRE))
    a[fo0:] *= dsp.ramp(len(a) - fo0, "out")
    # 最後の小節頭の響き (Gm 系) は切らずに残し、終曲の C 和音と重ねて減衰させる
    b = dsp.cut(orig, S3_B_HIT - PRE, S3_FINAL + 1.2)
    b[: dsp.n(PRE)] *= dsp.ramp(dsp.n(PRE), "in")
    b[-dsp.n(0.6):] *= dsp.ramp(dsp.n(0.6), "out")
    tl = dsp.Timeline(0)
    tl.add(a, 0.0)
    b_at = restart - (S3_HIT - PRE)
    tl.add(b, b_at)
    return tl.buf, dict(hit0=PRE, restart=b_at + PRE, final=b_at + PRE + (S3_FINAL - S3_B_HIT))


def make_pad(H, groove_start):
    events, log = pad_events(root_segments(H))
    pad = np.zeros_like(H)
    for m, t_on, t_off in events:
        L = dsp.n(t_off - t_on + 0.9)
        note = dsp.supersaw(440 * 2 ** ((m - 69) / 12), L) * dsp.adsr(L, a=0.35, r=0.9)
        s0 = dsp.n(t_on)
        e0 = min(s0 + L, len(pad))
        pad[s0:e0] += note[: e0 - s0] * (0.8 if m >= 69 else 1.0)
    pad = dsp.butter_f(pad, 2800, "low", 2)
    pad = dsp.butter_f(pad, 160, "high", 2)
    pad = pad + dsp.reverb(pad, room=0.9, damping=0.5, wet=1.0, dry=0.0) * 0.7
    t_end = len(pad) / dsp.SR
    # 疎なイントロ 4 小節では前に出し、グルーヴ中は控えめに
    pad = dsp.gain_curve(pad, [0, groove_start - 1.0, groove_start + 1.0, t_end], [3, 3, -5, -5])
    return pad, log


def build(orig, song2_ref, cache_dir=None):
    k = 1 / SPEED
    raw, marks = assemble(orig)
    cache = cache_dir and os.path.join(cache_dir, f"song3_stretched_{len(raw)}.wav")
    if cache and os.path.exists(cache):
        st = dsp.load(cache)
    else:
        st = dsp.stretch(raw, speed=SPEED)
        if cache:
            dsp.save(cache, st)
    meta = {key: v * k for key, v in marks.items()}
    bar_out = 4 * TARGET_BEAT
    meta["groove_start"] = meta["hit0"] + 4 * bar_out
    meta["target_bpm"] = 60 / TARGET_BEAT
    meta["speed"] = SPEED

    H, P = dsp.hpss(st, margin=1.0)
    body = H + P * 0.78                                     # 打撃成分 -2.2 dB
    send = dsp.butter_f(H, 350, "high", 2)
    body = body + dsp.reverb(send, room=0.82, damping=0.45, wet=1.0, dry=0.0) * 0.16
    f, d = dsp.match_eq_curve(song2_ref, body, amount=0.65, limit_db=7.0)
    body = dsp.apply_eq_curve(body, f, d)
    meta["eq_db_at"] = {str(hz): round(float(np.interp(hz, f, d)), 2) for hz in (60, 120, 250, 500, 1000, 2000, 4000, 8000, 12000)}

    # 再開部の打点へ吸い込む逆再生スウェル (ブレイクを意図的に聞かせる)
    t_r = meta["restart"]
    sw = dsp.reverse_swell(st[dsp.n(t_r):dsp.n(t_r + 0.4)], 1.4, peak_db=-17.0)
    tl = dsp.Timeline(0)
    tl.add(body, 0.0)
    tl.add(sw, t_r - 1.4)
    body = tl.buf

    pad, log = make_pad(H, meta["groove_start"])
    pad = np.concatenate([pad, np.zeros((len(body) - len(pad), 2), np.float32)])
    g0 = dsp.n(meta["groove_start"])
    pad *= 10 ** ((dsp.db(body[g0:]) - 21.0 - dsp.db(pad[g0:])) / 20)
    f0 = dsp.n(meta["final"])
    pad[f0:f0 + dsp.n(0.4)] *= dsp.ramp(dsp.n(0.4), "out")[: len(pad) - f0]
    pad[f0 + dsp.n(0.4):] = 0.0  # 終曲に入ったらパッドは退く
    return body + pad, pad, meta, log


if __name__ == "__main__":
    src, outdir = sys.argv[1], sys.argv[2]
    orig = dsp.load(src)
    ref = dsp.cut(orig, 106.0, 146.0)
    out, pad, meta, log = build(orig, ref, cache_dir=outdir)
    dsp.save(f"{outdir}/song3_adapted.wav", out)
    dsp.save(f"{outdir}/song3_pad.wav", pad)
    json.dump(dict(meta=meta, roots=log), open(f"{outdir}/song3_meta.json", "w"), indent=1, ensure_ascii=False)
    print(json.dumps(meta, indent=1))
    for row in log:
        print(row)
