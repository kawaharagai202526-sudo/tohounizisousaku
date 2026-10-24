# 解析結果から、ゲームの曲データ（SONGS の1曲分の JS）を組み立てる
#   python build.py 計画.json 出力.js
#   計画: { id, title, comment, lead, leadVol, double, backing, analyses: { 名前: 解析.json },
#          key: { tonic, mode }, segments: [{ an, sec, from, to, drums, oct }], loop: true }
import sys, json, numpy as np
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from assemble import slots_to_notes, bar_mml, transpose_chord, tidy

ROOT = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
MAJOR = [0, 2, 4, 5, 7, 9, 11]


def rel_major(tonic, mode):
    return tonic % 12 if mode == 'maj' else (tonic + 3) % 12


def fifths(tonic, mode):
    """調号の位置（五度圏。C=0, G=1, F=-1 …）"""
    p = (rel_major(tonic, mode) * 7) % 12
    return p - 12 if p > 6 else p


def shift_to(key, target):
    """主音か調号が target と同じになる、いちばん近い移調（半音）。
    同じ主音の長調・短調と、調号が1つ違うだけの近い調はそのまま"""
    d5 = abs(fifths(key['tonic'], key['mode']) - fifths(target['tonic'], target['mode']))
    if key['tonic'] == target['tonic'] or min(d5, 12 - d5) <= 1:
        return 0
    best = None
    for d in ((target['tonic'] - key['tonic']) % 12, (rel_major(target['tonic'], target['mode']) - rel_major(key['tonic'], key['mode'])) % 12):
        d = d - 12 if d > 6 else d
        if best is None or abs(d) < abs(best): best = d
    return best


def chord_root(name):
    r = name[:-1] if name.endswith('m') else name
    return ROOT[r]


def scale_notes(key):
    rm = rel_major(key['tonic'], key['mode'])
    return sorted({(rm + i) % 12 for i in MAJOR})


def step_down(p, k, scale):
    """音 p から音階で k 段下（p は音階になくてもよい）"""
    q = p
    for _ in range(k):
        q -= 1
        while q % 12 not in scale: q -= 1
    return q


def build(plan):
    ans = {k: json.load(open(v)) for k, v in plan['analyses'].items()}
    key = plan['key']
    flat = plan.get('flat', False)
    scale = scale_notes(key)
    segs = []
    for sg in plan['segments']:
        sec = next(s for s in ans[sg['an']] if s['name'] == sg['sec'])
        bars = sec['bars'][sg.get('from', 0):sg.get('to', len(sec['bars']))]
        k = sg['shift'] if 'shift' in sg else shift_to(sec['key'], key)
        notes = [[(s, l, None if p is None else p + k) for s, l, p in tidy(slots_to_notes(b["slots"]))] for b in bars]
        ps = [p for bn in notes for _, l, p in bn if p is not None for _ in range(l)]
        med = float(np.median(ps)) if ps else 74
        oct = sg['oct'] if 'oct' in sg else int(round((plan.get('center', 75) - med) / 12))
        notes = [[(s, l, None if p is None else p + 12 * oct) for s, l, p in bn] for bn in notes]
        chords = [[transpose_chord(c, k, flat) for c in b['chords']] for b in bars]
        segs.append({'sg': sg, 'sec': sec, 'notes': notes, 'chords': chords, 'shift': k, 'oct': oct, 'bpm': sg.get('bpm', round(sec['bpm'], 1))})

    out_bars, out_chords, parts = [], [], []

    def bridge(prev, nxt, bpm):
        # つなぎの1小節：前の最後の音をのばし、次の最初の音へ音階で駆け上がる。コードは次の最初のコードの属和音
        last = next((p for bn in reversed(prev['notes']) for _, _, p in reversed(bn) if p is not None), 72)
        first = next((p for bn in nxt['notes'] for _, _, p in bn if p is not None), 72)
        run = [step_down(first, k, scale) for k in (4, 3, 2, 1)]
        notes = [(0, 8, last), (8, 4, None)] + [(12 + i, 1, q) for i, q in enumerate(run)]
        c0 = nxt['chords'][0][0]
        v = (chord_root(c0) + 7) % 12
        vname = ['C', 'Db' if flat else 'C#', 'D', 'Eb', 'E', 'F', 'Gb' if flat else 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][v]
        return notes, [prev['chords'][-1][-1], vname]

    for i, sg in enumerate(segs):
        if i > 0:
            n, c = bridge(segs[i - 1], sg, sg['bpm'])
            out_bars.append(n); out_chords.append(c)
        parts.append({'bar': len(out_bars), 'bpm': sg['bpm'], 'drums': sg['sg'].get('drums', 'rock'), **({'ramp': 1} if i > 0 else {})})
        out_bars += sg['notes']; out_chords += sg['chords']
    if plan.get('loop', True) and len(segs) > 0:
        n, c = bridge(segs[-1], segs[0], segs[0]['bpm'])
        parts.append({'bar': len(out_bars), 'bpm': round((segs[-1]['bpm'] + segs[0]['bpm']) / 2, 1), 'drums': segs[-1]['sg'].get('drums', 'rock')})
        out_bars.append(n); out_chords.append(c)
    mml = [bar_mml(bn, flat) for bn in out_bars]
    return mml, out_chords, parts, segs


def js(plan, mml, chords, parts):
    ind = '    '
    lines = [f"  {plan['id']}: {{",
             f"{ind}title: '{plan['title']}',",
             f"{ind}comment: '" + plan['comment'].replace(chr(10), '\\n') + "',",
             f"{ind}bpm: {parts[0]['bpm']},",
             f"{ind}lead: '{plan.get('lead', 'trumpet')}', leadVol: {plan.get('leadVol', 0.14)},"]
    if plan.get('double'): lines.append(f"{ind}double: {plan['double']},")
    lines.append(f"{ind}// 途中でテンポとドラムが変わる（つなぎ目の小節で次のテンポへ近づける）")
    lines.append(f"{ind}parts: [")
    for p in parts:
        extra = f", ramp: {p['ramp']}" if p.get('ramp') else ''
        dr = f"'{p['drums']}'" if p['drums'] else 'null'
        lines.append(f"{ind}  {{ bar: {p['bar']}, bpm: {p['bpm']}, drums: {dr}{extra} }},")
    lines.append(f"{ind}],")
    lines.append(f"{ind}chords: [")
    for i in range(0, len(chords), 8):
        lines.append(f"{ind}  " + ', '.join("'" + ' '.join(c) + "'" for c in chords[i:i + 8]) + ',')
    lines.append(f"{ind}],")
    lines.append(f"{ind}melody: `")
    for i, m in enumerate(mml):
        lines.append(f"{ind}  {m} |")
    lines[-1] = lines[-1] + '`,'
    lines.append(f"{ind}backing: {plan.get('backing', '{}')},")
    lines.append('  },')
    return '\n'.join(lines)


if __name__ == '__main__':
    plan = json.load(open(sys.argv[1]))
    mml, chords, parts, segs = build(plan)
    for s in segs:
        print(f"{s['sg']['an']}:{s['sg']['sec']} bars {len(s['notes'])} key {s['sec']['key']['name']} shift {s['shift']:+d} oct {s['oct']:+d} bpm {s['bpm']}")
    print('全体の小節数', len(mml))
    open(sys.argv[2], 'w').write(js(plan, mml, chords, parts) + '\n')
    # くらべるための情報：部分ごとの最初の小節
    starts, b = [], 0
    for i, s in enumerate(segs):
        if i > 0: b += 1
        starts.append({'an': s['sg']['an'], 'sec': s['sg']['sec'], 'bar': b, 'n': len(s['notes']), 'shift': s['shift']})
        b += len(s['notes'])
    json.dump({'parts': parts, 'segs': starts, 'nBars': len(mml)}, open(sys.argv[2] + '.meta.json', 'w'))
