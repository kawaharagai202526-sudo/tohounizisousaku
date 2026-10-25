# 6面ボス曲：3つの節を1曲にまとめるアレンジ（MIDI生成）
# テンポは節2（83 BPM）に統一。1拍=四分音符、16分音符=1スロット。
import sys, re, json
import mido

PPQ = 480
S16 = PPQ // 4
BAR = 16  # スロット

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def n2m(s):
    m = re.fullmatch(r'([A-G])(##|#|bb|b|♭|♯)?(-?\d)', s)
    if not m:
        raise ValueError(s)
    pc = NAMES[m.group(1)]
    acc = m.group(2) or ''
    pc += {'': 0, '#': 1, '♯': 1, '##': 2, 'b': -1, '♭': -1, 'bb': -2}[acc]
    return pc + 12 * (int(m.group(3)) + 1)


# ---------------- 和音 ----------------
QUAL = {
    '': [0, 4, 7], 'm': [0, 3, 7], '5': [0, 7], '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11],
    'm7': [0, 3, 7, 10], 'm7b5': [0, 3, 6, 10], 'dim7': [0, 3, 6, 9], 'sus4': [0, 5, 7],
    'sus2': [0, 2, 7], '7sus4': [0, 5, 7, 10], '7sus4(9)': [0, 5, 7, 10, 14], 'add9': [0, 4, 7, 14],
    'madd9': [0, 3, 7, 14], '6': [0, 4, 7, 9], 'maj9': [0, 4, 7, 11, 14], 'maj7#11': [0, 4, 7, 11, 18],
    'aug': [0, 4, 8], '7b13': [0, 4, 7, 10, 20], 'm6': [0, 3, 7, 9], 'add9#11': [0, 4, 7, 14, 18],
    'maj7add9': [0, 4, 7, 11, 14],
}
ROOTS = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6,
         'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11, 'Cb': 11}


def parse_chord(sym):
    bass = None
    if '/' in sym:
        sym, b = sym.split('/')
        bass = ROOTS[b]
    m = re.fullmatch(r'([A-G](?:#|b)?)(.*)', sym)
    root = ROOTS[m.group(1)]
    q = m.group(2)
    ints = QUAL[q]
    return root, ints, (root if bass is None else bass)


def chord_pcs(sym):
    r, ints, b = parse_chord(sym)
    return sorted(set((r + i) % 12 for i in ints)), b, r


def voice(sym, prev, lo=55, hi=79, n=4):
    """前の和音から動きが少ない配置を選ぶ"""
    pcs, bass, root = chord_pcs(sym)
    cands = [p for p in range(lo, hi + 1) if p % 12 in pcs]
    best = None
    import itertools
    for combo in itertools.combinations(cands, n):
        if max(combo) - min(combo) > 16:
            continue
        got = set(p % 12 for p in combo)
        need = set(pcs) if len(pcs) <= n else set(pcs[:n])
        if len(got) < min(len(pcs), n):
            continue
        # 半音でぶつかる配置は避ける（意図的なものは明示指定する）
        if any(b - a == 1 for a, b in zip(combo, combo[1:])):
            continue
        cost = 0 if prev is None else sum(min(abs(c - p) for p in prev) for c in combo)
        cost += abs((sum(combo) / n) - (lo + hi) / 2) * 0.15
        if best is None or cost < best[0]:
            best = (cost, combo)
    return list(best[1])


# ---------------- 楽譜データの組み立て ----------------
class Song:
    def __init__(self):
        self.ev = {}       # track -> [(start_slot, dur_slot, midi, vel)]
        self.marks = []    # (slot, label)
        self.pos = 0       # 現在の小節頭（スロット）
        self.tempo = []    # (slot, bpm)

    def add(self, tr, start, dur, midi, vel):
        self.ev.setdefault(tr, []).append((start, dur, midi, vel))

    def mark(self, label, slot=None):
        self.marks.append((self.pos if slot is None else slot, label))


def line(song, tr, start, text, vel=100, transpose=0, legato=0.95):
    """'B5:2 r:1 C#6:1' 形式。戻り値は長さ（スロット）"""
    t = start
    for tok in text.split():
        if tok == '|':
            continue
        name, d = tok.split(':')
        d = float(d)
        if name != 'r':
            for nm in name.split('+'):
                song.add(tr, t, d * legato, n2m(nm) + transpose, vel)
        t += d
    return t - start


def check_len(text, expect, label):
    tot = sum(float(tok.split(':')[1]) for tok in text.split() if tok != '|')
    if abs(tot - expect) > 1e-6:
        raise ValueError(f'{label}: {tot} != {expect}')


def pad(song, tr, start, dur, notes, vel):
    for p in notes:
        song.add(tr, start, dur, p, vel)


def arp16(song, tr, start, dur, sym, vel, lo=73, hi=88, pattern=(0, 1, 2, 3, 2, 1, 2, 3)):
    pcs, _, root = chord_pcs(sym)
    tones = [p for p in range(lo, hi + 1) if p % 12 in pcs][:5]
    for i in range(int(dur)):
        p = tones[pattern[i % len(pattern)] % len(tones)]
        v = vel + (8 if i % 4 == 0 else 0)
        song.add(tr, start + i, 0.9, p, v)


def bass8(song, tr, start, dur, note, vel, octave_on=(), approach=None):
    for i in range(0, int(dur), 2):
        p = note + (12 if (i // 2) in octave_on else 0)
        if approach is not None and i == int(dur) - 2:
            p = approach
        song.add(tr, start + i, 1.8, p, vel + (6 if i % 4 == 0 else 0))


# ---------------- ドラム ----------------
K, SN, CH, OH, CR, RD, TOM1, TOM2, TOM3, RIM = 36, 38, 42, 46, 49, 51, 50, 47, 43, 37


def drum_bar(song, start, style, vel=100, crash=False, fill=None):
    tr = 'drums'
    if crash:
        song.add(tr, start, 4, CR, vel + 10)
    if style == 'g16':      # 節1：16分のハイハット
        for s in range(16):
            song.add(tr, start + s, 0.5, CH, (vel - 15) if s % 2 == 0 else (vel - 40))
        for s in (0, 3, 6, 10):
            song.add(tr, start + s, 1, K, vel)
        for s in (4, 12):
            song.add(tr, start + s, 1, SN, vel)
    elif style == 'g8':     # 節2（基準）：8分のハイハット
        for s in range(0, 16, 2):
            song.add(tr, start + s, 1, OH if s == 14 else CH, (vel - 12) if s % 4 == 0 else (vel - 25))
        for s in (0, 6, 8, 11):
            song.add(tr, start + s, 1, K, vel if s in (0, 8) else vel - 10)
        for s in (4, 12):
            song.add(tr, start + s, 1, SN, vel)
        song.add(tr, start + 15, 0.5, SN, vel - 55)
    elif style == 'g8ride':  # 節3の盛り上がり：ライド
        for s in range(0, 16, 2):
            song.add(tr, start + s, 1, RD, (vel - 10) if s % 4 == 0 else (vel - 25))
        for s in (0, 6, 8, 11):
            song.add(tr, start + s, 1, K, vel if s in (0, 8) else vel - 10)
        for s in (4, 12):
            song.add(tr, start + s, 1, SN, vel)
    elif style == 'hits2':   # 節3の「2拍ごとの打撃」
        for s in (0, 8):
            song.add(tr, start + s, 1, K, vel)
            song.add(tr, start + s, 1, SN, vel - 10)
            song.add(tr, start + s, 2, CR if s == 0 else OH, vel - 20)
    if fill == 'snare4':     # 最後の1拍を16分のスネア
        for i, s in enumerate(range(12, 16)):
            song.add(tr, start + s, 0.5, SN, vel - 30 + i * 8)
    elif fill == 'toms8':    # 後半2拍をタム回し
        seq = [SN, SN, TOM1, TOM1, TOM2, TOM2, TOM3, TOM3]
        for i, s in enumerate(range(8, 16)):
            song.add(tr, start + s, 0.5, seq[i], vel - 20 + i * 4)
    elif fill == 'roll':     # 1小節かけてスネアロール（クレッシェンド）
        for s in range(0, 13):
            song.add(tr, start + s, 0.5, SN, 45 + s * 5)
        song.add(tr, start + 0, 1, K, vel)
        song.add(tr, start + 8, 1, K, vel)


# =========================================================
song = Song()
LEAD, LEAD2, STR, PADW, PNO, ARP, BASS, BRASS, TIMP = 'lead', 'lead2', 'strings', 'warmpad', 'piano', 'arp', 'bass', 'brass', 'timpani'

# ---------- 弱起（1拍） ----------
song.mark('節1（弱起）')
P0 = 0
pad(song, STR, P0, 4, [59, 63, 64, 68, 71], 60)
song.add(BASS, P0, 4, 40, 85)
for s in range(4):
    song.add('drums', P0 + s, 0.5, CH, 60 if s % 2 == 0 else 40)

# ---------- 節1 本体 8小節（メロディはできるだけ原曲どおり） ----------
S1 = 4  # 1小節目の頭（弱起の後）
SEC1_LEAD = [
    # 弱起の残り（B5の前半は弱起側） → 1小節目
    'B5:1 G#5:1 A#5:4 B5:2 C#6:1 A#5:2 B5:1 C#6:1 D#6:1 C#6:2',
    'B5:1 C#6:2 B5:1 A#5:1 B5:1 A#5:2 G#5:3 A#5:1 G#5:2 B5:1 A#5:1',
    'A#5:2 C#6:2 B5:2 D#6:2 C#6:1 D#6:1 C#6:1 D#6:1 C#6:1 D#6:1 C#6:1 D#6:1',
    'C#6:1 B5:1 C#6:1 B5:1 A#5:2 B5:1 A#5:1 A#5:1 D#6:1 F#5:1 D#6:1 F#5:1 A#5:3',
    'D#5:1 D5:2 D#5:1 D#5:2 D#5:1 D5:1 F#5:1 B5:1 G#5:1 B5:1 D#6:1 F#6:2 B5:1',
    'B5:1 F#5:1 C#6:1 D#5:1 F#5:1 C#6:2 F#5:1 B5:1 D5:1 F#5:1 A#5:4 C#6:1',
    'C#6:1 A#5:1 B5:1 A#5:1 D#6:6 E6:6',
    'D#6:1 F#6:1 D#6:1 B5:1 B5:1 G#5:1 F#5:2 D6:4 D#6:4',
]
for i, b in enumerate(SEC1_LEAD):
    check_len(b, 16, f'sec1 bar{i + 1}')
# 弱起：G#5 A#5 B5（B5は1小節目へタイ）
line(song, LEAD, P0, 'G#5:2 A#5:1', vel=96)
song.add(LEAD, P0 + 3, 1.9, n2m('B5'), 100)
first = SEC1_LEAD[0].split(' ', 1)[1]  # 先頭のB5:1はタイで処理済み
line(song, LEAD, S1 + 1, first, vel=100)
for i, b in enumerate(SEC1_LEAD[1:], start=1):
    line(song, LEAD, S1 + i * BAR, b, vel=100)

# 節1の和音（E と F# の往復。E の上に D# を重ねて原曲の暗い響きを残す）
SEC1_CH = [('E', 'E'), ('F#sus4', 'E'), ('E', 'E'), ('F#', 'E'), ('E', 'E'), ('F#', 'E'), ('E', 'E'), ('F#sus4', 'A#7/G#')]
V_E = [59, 63, 64, 68, 71]          # B3 D#4 E4 G#4 B4
V = {'E': V_E, 'F#': [61, 66, 68, 70, 73], 'F#sus4': [61, 66, 71, 73], 'A#7/G#': [56, 65, 70, 77]}
BASSN = {'E': 40, 'F#': 42, 'F#sus4': 42, 'A#7/G#': 44}
for i, (h1, h2) in enumerate(SEC1_CH):
    st = S1 + i * BAR
    for j, c in enumerate((h1, h2)):
        pad(song, STR, st + 8 * j, 8, V[c], 64)
        pad(song, PADW, st + 8 * j, 8, [p - 12 for p in V[c][:2]], 50)
        # 低音：長い音＋16分のシンコペーション（原曲の低いうなりを残す）
        bn = BASSN[c]
        for s, d, o in ((0, 3, 0), (3, 2, 0), (6, 2, 12)):
            song.add(BASS, st + 8 * j + s, d, bn + o, 92 if s == 0 else 80)
    # ピアノの内声（原曲の中音域の動き：C#5 と D#5/E5）
    inner = 'C#5:8 D#5:4 E5:4' if i % 2 == 0 else 'C#5:4 D#5:4 B4:8'
    line(song, PNO, st, inner, vel=58, legato=1.0)
    drum_bar(song, st, 'g16', vel=96, crash=(i == 0), fill=('snare4' if i == 7 else None))
song.mark('節1 メロディ（8小節）', S1)

# ---------- 節1 ブレイク 2小節（ドラムなし・原曲の和音） ----------
BK = S1 + 8 * BAR
song.mark('節1 ブレイク（2小節）', BK)
pad(song, STR, BK, 16, [61, 68, 80, 82, 89], 66)          # C#4 G#4 G#5 A#5 F6
pad(song, STR, BK + 16, 8, [68, 73, 80, 82, 89], 64)     # G#4 C#5 G#5 A#5 F6
pad(song, STR, BK + 24, 8, [66, 70, 73, 78, 82], 62)     # D#m7 の上部
pad(song, PADW, BK, 32, [51, 58], 60)                     # D#3 A#3
song.add(BASS, BK, 31, 39, 80)                            # D#2
song.add('drums', BK, 4, CR, 70)
line(song, PNO, BK, 'D#5:4 A#5:4 C#6:4 F6:4 G#6:4 F6:4 C#6:4 A#5:4', vel=48, legato=1.0)
# 最後に節1の動機をそっと鳴らす（つなぎ）
line(song, LEAD, BK + 24, 'D#6:1 F#6:1 D#6:1 B5:1 A#5:4', vel=70)

# ---------- つなぎ1（1小節）：B → C#sus4 → C#、最後に一瞬の無音 ----------
T1 = BK + 32
song.mark('つなぎ1（1小節・新規）', T1)
pad(song, STR, T1, 8, [59, 63, 66, 71, 73], 70)           # B(add9)
pad(song, STR, T1 + 8, 4, [61, 66, 68, 73], 74)           # C#sus4
pad(song, STR, T1 + 12, 1.6, [61, 65, 68, 73], 80)        # C#（裏で切る）
pad(song, PADW, T1, 13, [47, 54], 60)
bass8(song, BASS, T1, 8, 35, 88)                           # B1
bass8(song, BASS, T1 + 8, 4, 37, 90)                       # C#2
song.add(BASS, T1 + 12, 1.5, 37, 96)
drum_bar(song, T1, None, vel=100, fill='roll')
line(song, LEAD, T1 + 8, 'C#6:2 D#6:2 E#6:1', vel=88)       # 上行して切る

# ---------- 節2（基準）16小節 ----------
S2 = T1 + BAR
song.mark('節2 F#短調（8小節）', S2)
SEC2 = [  # (前半, 後半) と上声の配置（原曲の聴き取りから）
    (('D', [66, 69, 74, 78, 81]), ('E', [68, 71, 76, 80, 83])),
    (('F#m', [66, 69, 73, 78, 81]), ('F#m', [66, 69, 73, 78, 81])),
    (('F#m/A', [66, 69, 73, 78, 81]), ('E/B', [68, 71, 76, 80, 83])),
    (('F#m', [69, 73, 78, 81, 85]), ('F#m', [69, 73, 78, 81, 85])),
    (('D', [66, 69, 74, 78, 81]), ('E', [68, 71, 76, 80, 83])),
    (('F#m', [66, 69, 73, 78, 81]), ('F#m', [69, 73, 78, 81, 85])),
    (('F#m/A', [66, 69, 73, 78, 81]), ('E/B', [68, 71, 76, 80, 83])),
    (('F#m7', [73, 76, 78, 81, 85]), ('Bsus2', [71, 73, 78, 83, 85])),
    (('Ebmaj7', [63, 70, 74, 79, 82]), ('F', [65, 72, 77, 81, 84])),
    (('Gm', [70, 74, 79, 82, 86]), ('Gm', [70, 74, 79, 82, 86])),
    (('Gm/Bb', [70, 74, 79, 82, 86]), ('Fmaj7', [69, 77, 81, 84, 88])),
    (('Gm', [70, 74, 79, 82, 86]), ('Gm', [70, 74, 79, 82, 86])),
    (('Ebmaj7', [63, 70, 74, 79, 82]), ('F', [65, 72, 77, 81, 84])),
    (('Gm', [70, 74, 79, 82, 86]), ('Gm', [74, 79, 82, 86, 91])),
    (('Gm/Bb', [70, 74, 79, 82, 86]), ('F7', [69, 75, 81, 84, 87])),
    (('G', [74, 79, 83, 86, 91]), ('G7', [71, 74, 77, 83, 86])),
]
SEC2_BASS = [  # 8分で刻むベース（前半, 後半, 後半最後の経過音）
    (38, 40, None), (42, 42, 40), (45, 47, None), (42, 47, 44),
    (38, 40, None), (42, 42, 40), (45, 47, None), (42, 35, None),
    (39, 41, None), (43, 48, 45), (46, 41, None), (43, 48, 50),
    (39, 41, None), (43, 48, 45), (46, 41, None), (43, 43, None),
]
for i, ((c1, v1), (c2, v2)) in enumerate(SEC2):
    st = S2 + i * BAR
    strong = i >= 8
    pv = 72 if strong else 64
    pad(song, STR, st, 8, v1, pv)
    pad(song, STR, st + 8, 8, v2, pv)
    pad(song, PADW, st, 8, [p - 12 for p in v1[:2]], 52)
    pad(song, PADW, st + 8, 8, [p - 12 for p in v2[:2]], 52)
    arp16(song, ARP, st, 8, c1, 54 if not strong else 60)
    arp16(song, ARP, st + 8, 8, c2, 54 if not strong else 60)
    b1, b2, ap = SEC2_BASS[i]
    bass8(song, BASS, st, 8, b1, 90)
    bass8(song, BASS, st + 8, 8, b2, 90, approach=ap)
    fill = 'snare4' if i in (3, 11) else ('toms8' if i == 15 else ('snare4' if i == 7 else None))
    drum_bar(song, st, 'g8', vel=100 if strong else 92, crash=(i in (0, 8, 12)), fill=fill)
song.mark('節2 G短調（8小節）', S2 + 8 * BAR)

# 節2 5〜8小節：上声をなぞる控えめなリード（盛り上げの準備）
line(song, LEAD, S2 + 4 * BAR, 'A5:8 B5:8 | A5:8 C#6:8 | A5:8 B5:6 G#5:2 | A5:4 C#6:4 C#6:8', vel=72)
# 節2 9〜16小節：節1のメロディを半音下（G短調）で再現。和音に合わない音だけ直す
SEC2_LEAD = [
    'Bb5:1 G5:1 A5:4 Bb5:2 C6:1 A5:2 Bb5:1 C6:1 D6:1 C6:2',
    'Bb5:1 C6:2 Bb5:1 A5:1 Bb5:1 A5:2 G5:3 A5:1 G5:2 Bb5:1 A5:1',
    'Bb5:2 C6:2 Bb5:2 D6:2 C6:1 D6:1 C6:1 D6:1 C6:1 D6:1 C6:1 D6:1',
    'C6:1 Bb5:1 C6:1 Bb5:1 G5:2 Bb5:1 A5:1 A5:1 D6:1 F5:1 D6:1 F5:1 A5:3',
    'D5:1 Eb5:2 D5:1 D5:2 D5:1 Eb5:1 F5:1 A5:1 G5:1 A5:1 C6:1 F6:2 A5:1',
    'Bb5:1 F5:1 C6:1 D5:1 F5:1 C6:2 F5:1 Bb5:1 D5:1 F5:1 A5:4 C6:1',
    'C6:1 A5:1 Bb5:1 A5:1 D6:6 Eb6:6',
    'D6:1 F6:1 D6:1 B5:1 B5:1 G5:1 F5:2 B5:4 D6:4',
]
for i, b in enumerate(SEC2_LEAD):
    check_len(b, 16, f'sec2 lead bar{i + 9}')
    line(song, LEAD, S2 + (8 + i) * BAR, b, vel=104)

# ---------- つなぎ2（1小節）：Cm → Ab → 節3のBbへ ----------
T2 = S2 + 16 * BAR
song.mark('つなぎ2（1小節・新規）', T2)
pad(song, STR, T2, 8, [63, 67, 72, 75], 74)
pad(song, STR, T2 + 8, 8, [63, 68, 72, 75], 76)
pad(song, PADW, T2, 16, [48, 55], 56)
arp16(song, ARP, T2, 8, 'Cm', 60)
arp16(song, ARP, T2 + 8, 8, 'Ab', 62)
bass8(song, BASS, T2, 8, 36, 92)
bass8(song, BASS, T2 + 8, 8, 44, 94)
drum_bar(song, T2, 'g8', vel=100, fill='toms8')
line(song, LEAD, T2, 'G6:4 Eb6:4 C6:6 D6:1 Eb6:1', vel=100)

# ---------- 節3 24小節（節2のノリに合わせる） ----------
S3 = T2 + BAR
song.mark('節3 E♭長調（24小節）', S3)
SEC3_CH = [
    ['Bb', 'Bb'], ['Eb/Bb', 'Abmaj7'], ['Eb/Bb', 'Eb/Bb'], ['Fm7/Bb', 'Fm7/Bb'],
    ['Bb6', 'Eb'], ['Bb/A', 'G/B'], ['Bb', 'Eb'], ['Abadd9', 'Ebmaj7', 'Fm/Ab'],
    ['Bb', 'Am7b5'], ['Ab', 'Bb/A'], ['Gm7/A', 'F7/A'], ['Adim7', 'Gm/Bb'],
    ['Ebaug/Ab', 'Cm/G', 'D7sus4/A'], ['Bb', 'Bb'], ['Abm/Cb', 'Abmaj9'], ['G7b13', 'Eb/Bb'],
    ['Abmaj9', 'Abmaj9'], ['Abmaj9', 'Abmaj9'], ['Ebadd9', 'Ebadd9'], ['Ab', 'Eb'],
    ['Ebaug', 'Ebaug'], ['Ebaug', 'Abm'], ['Cbmaj7', 'Abm/Cb', 'Bb7', 'Eb'], ['Eb', 'Eb'],
]
SEC3_LEAD = [
    'F5:4 Bb5:4 D6:8',
    'Eb6:8 G6:8',
    'Eb6:12 D6:1 Eb6:1 F6:2',
    'Ab5:4 C6:4 F6:8',
    'F6:6 G6:1 F6:1 Eb6:8',
    'Bb5:6 A5:2 G5:8',
    'F5:4 Bb5:4 Eb6:8',
    'Bb5:8 D6:4 C6:4',
    'Bb5:8 G5:8',
    'C6:8 Bb5:6 A5:2',
    'F6:8 Eb6:8',
    'Eb6:6 F6:2 G6:8',
    'B5:8 C6:4 D6:4',
    'F6:8 F6:4 Eb6:2 D6:2',
    'Eb6:8 C6:4 Eb6:4',
    'D6:8 Eb6:8',
    'C6:8 Bb5:8',
    'Ab5:4 C6:4 Eb6:4 F6:4',
    'G6:12 F6:2 Eb6:2',
    'F6:8 Eb6:8',
    'D6:8 Eb6:4 F6:4',
    'G6:8 F6:4 Cb6:4',
    # 最後に節1の8小節目の動機（同じ音高）を戻して E♭長調で終える
    'Eb6:1 Gb6:1 Eb6:1 Cb6:1 Cb6:1 Ab5:1 Gb5:2 D6:4 Eb6:4',
    'Eb6:16',
]
DRAMA = set(range(5, 13))   # 原曲で大きな打撃が続く区間（6〜13小節目）
BUILD = (16, 17)            # 2拍ごとの打撃で溜める区間
prev = None
for i, chs in enumerate(SEC3_CH):
    st = S3 + i * BAR
    check_len(SEC3_LEAD[i], 16, f'sec3 lead bar{i + 1}')
    last = (i == len(SEC3_CH) - 1)
    lens = [16 // len(chs)] * len(chs) if len(chs) != 3 else [8, 4, 4]
    if len(chs) == 4:
        lens = [4, 4, 4, 4]
    t = st
    for c, L in zip(chs, lens):
        v = voice(c, prev, lo=58, hi=82, n=4)
        prev = v
        pdur = 16 if last else L
        pad(song, STR, t, pdur, v, 76 if i >= 18 else 70)
        pad(song, PADW, t, pdur, [p - 12 for p in v[:2]], 54)
        _, bpc, _ = chord_pcs(c)
        bn = 36 + (bpc % 12)
        if bn < 38:
            bn += 12
        if last:
            song.add(BASS, t, 16, bn, 96)
            song.add(BASS, t, 16, bn - 12, 80)
        elif i == 0 or i in BUILD:
            for s in range(0, L, 8):
                song.add(BASS, t + s, 3, bn, 100)
        else:
            bass8(song, BASS, t, L, bn, 92)
        if not last:
            arp16(song, ARP, t, L, c, 60 if i < 18 else 66)
        # 和音が変わる所の金管とティンパニ（節3の劇的な打撃を残す）
        if i in DRAMA or i == 0 or i == 18 or last:
            for p in v[-3:]:
                song.add(BRASS, t, 1.6, p, 96)
            song.add(TIMP, t, 2, bn - 12 if bn - 12 >= 40 else bn, 100)
        t += L
    if i in BUILD:
        for s in (0, 8):
            for p in prev[-3:]:
                song.add(BRASS, st + s, 1.6, p, 88 + (i - 16) * 10 + s)
    lv = 104 if i >= 18 else 100
    line(song, LEAD, st, SEC3_LEAD[i], vel=lv)
    # ドラム
    if i == 0:
        song.add('drums', st, 4, CR, 110); song.add('drums', st, 1, K, 110)
        drum_bar(song, st, None, fill='snare4', vel=96)
    elif i in BUILD:
        drum_bar(song, st, 'hits2', vel=96 + (i - 16) * 10, fill=('roll' if i == 17 else None))
    elif last:
        song.add('drums', st, 8, CR, 115); song.add('drums', st, 1, K, 115)
        for s in range(0, 12):   # ティンパニのロール
            song.add(TIMP, st + s, 0.6, 39, 60 + s * 3)
    else:
        style = 'g8ride' if i >= 18 else 'g8'
        drum_bar(song, st, style, vel=100, crash=(i in (1, 5, 13, 18)) or (i in DRAMA and i % 2 == 1),
                 fill=('toms8' if i in (12, 21) else ('snare4' if i in (4, 15) else None)))
song.mark('終わり', S3 + 24 * BAR)
END = S3 + 24 * BAR

# ---------------- テンポ ----------------
song.tempo.append((0, 83.0))
# 最後の2小節でゆっくり（原曲の節3も最後に遅くなる）
for k in range(4):
    song.tempo.append((S3 + 22 * BAR + k * 4, 83.0 - k * 3.0))
song.tempo.append((S3 + 23 * BAR, 68.0))

# ---------------- MIDI 書き出し ----------------
PROG = {LEAD: (0, 81, 100, 64, 45, 30), STR: (1, 48, 92, 50, 80, 20), PADW: (2, 89, 70, 78, 80, 40),
        PNO: (3, 0, 80, 44, 55, 0), ARP: (4, 0, 72, 86, 60, 10), BASS: (5, 38, 105, 64, 20, 0),
        BRASS: (6, 61, 88, 60, 70, 10), TIMP: (7, 47, 95, 64, 60, 0), 'drums': (9, 0, 100, 64, 40, 0)}
NAMES_JA = {LEAD: 'Lead', STR: 'Strings', PADW: 'Warm Pad', PNO: 'Piano (Part1 inner)',
            ARP: 'Arp (16th)', BASS: 'Bass', BRASS: 'Brass (Part3 hits)', TIMP: 'Timpani', 'drums': 'Drums'}
MARK_EN = {'節1（弱起）': 'Part1 pickup', '節1 メロディ（8小節）': 'Part1 melody', '節1 ブレイク（2小節）': 'Part1 break',
           'つなぎ1（1小節・新規）': 'Bridge1', '節2 F#短調（8小節）': 'Part2 F#m', '節2 G短調（8小節）': 'Part2 Gm',
           'つなぎ2（1小節・新規）': 'Bridge2', '節3 E♭長調（24小節）': 'Part3 Eb', '終わり': 'End'}


def write_midi(path):
    mid = mido.MidiFile(type=1, ticks_per_beat=PPQ)
    meta = mido.MidiTrack(); mid.tracks.append(meta)
    meta.append(mido.MetaMessage('track_name', name='Stage6 Boss Theme', time=0))
    ev = []
    ev.append((0, mido.MetaMessage('time_signature', numerator=1, denominator=4, time=0)))
    ev.append((4 * S16, mido.MetaMessage('time_signature', numerator=4, denominator=4, time=0)))
    for s, bpm in song.tempo:
        ev.append((int(s * S16), mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(bpm), time=0)))
    for s, lab in song.marks:
        ev.append((int(s * S16), mido.MetaMessage('marker', text=MARK_EN[lab], time=0)))
    ev.sort(key=lambda x: x[0])
    last = 0
    for t, m in ev:
        m.time = t - last; last = t; meta.append(m)
    for tr, (ch, prog, vol, pan, rev, cho) in PROG.items():
        if tr not in song.ev:
            continue
        track = mido.MidiTrack(); mid.tracks.append(track)
        track.append(mido.MetaMessage('track_name', name=NAMES_JA[tr], time=0))
        msgs = []
        if ch != 9:
            msgs.append((0, 0, mido.Message('program_change', channel=ch, program=prog, time=0)))
        for cc, val in ((7, vol), (10, pan), (91, rev), (93, cho)):
            msgs.append((0, 0, mido.Message('control_change', channel=ch, control=cc, value=val, time=0)))
        for st, du, p, v in song.ev[tr]:
            a = int(round(st * S16)); b = int(round((st + du) * S16))
            if b <= a:
                b = a + 1
            v = max(1, min(127, int(v)))
            msgs.append((a, 1, mido.Message('note_on', channel=ch, note=int(p), velocity=v, time=0)))
            msgs.append((b, 0, mido.Message('note_off', channel=ch, note=int(p), velocity=0, time=0)))
        msgs.sort(key=lambda x: (x[0], x[1]))
        last = 0
        for t, _, m in msgs:
            m.time = t - last; last = t; track.append(m)
    mid.save(path)
    return mid


if __name__ == '__main__':
    out = sys.argv[1]
    mid = write_midi(out)
    # 構成情報（秒）を書き出す
    def slot2sec(slot):
        sec = 0.0; cur = 0; bpm = song.tempo[0][1]
        for s, b in song.tempo[1:] + [(10 ** 9, None)]:
            if slot <= s:
                return sec + (slot - cur) * 15 / bpm
            sec += (s - cur) * 15 / bpm; cur = s; bpm = b
    info = [{'label': lab, 'slot': s, 'bar': (s - 4) / 16 + 1, 'sec': round(slot2sec(s), 2)} for s, lab in sorted(song.marks)]
    json.dump({'marks': info, 'length_sec': round(mid.length, 2)}, open(out.replace('.mid', '_info.json'), 'w'), ensure_ascii=False, indent=1)
    print('length', round(mid.length, 2), 's')
    for m in info:
        print(f"{m['sec']:7.2f}s  bar {m['bar']:5.2f}  {m['label']}")
