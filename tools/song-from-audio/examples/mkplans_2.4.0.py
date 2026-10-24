import json, sys
SP = sys.argv[1]  # 作業フォルダ（an1.json などがあるところ）
def drums(sec):
    return 'drive' if sec['rms'] >= 0.2 else 'rock' if sec['rms'] >= 0.12 else 'light'
plans = {
  'boss6': dict(an='an1.json', title='座敷わらしの家運隆盛', key={'tonic': 3, 'mode': 'maj'}, flat=True,
                comment='6面ボス・座敷 宿美のテーマ（曲名は仮）。\nユーザーが選んだ曲をつなぎ、調をそろえたアレンジです。',
                lead='trumpet', double="{ inst: 'bell', vol: 0.04, shift: 12 }",
                backing="{ arp: '16updown', arpInst: 'piano', arpVol: 0.045, bass: 'drive', pad: true }",
                order=['A', 'B1', 'B2', 'C', 'E'], bpm={'A': 162, 'B1': 164, 'B2': 164, 'C': 162, 'E': 160}, oct={'A': 1}),
  'boss5': dict(an='an2.json', title='家鳴りの狂詩曲', key={'tonic': 5, 'mode': 'min'}, flat=True,
                comment='5面ボス・家鳴 鳴音のテーマ（曲名は仮）。\nユーザーが選んだ曲をつなぎ、調をそろえたアレンジです。',
                lead='trumpet', double="{ inst: 'lead', vol: 0.05, shift: -12 }",
                backing="{ arp: '16updown', arpInst: 'piano', arpVol: 0.045, bass: 'drive', pad: true }",
                order=['A', 'B', 'C', 'D'], bpm={}),
  'boss4': dict(an='an3.json', title='朽ち果てぬ大黒柱', key={'tonic': 5, 'mode': 'maj'}, flat=True,
                comment='4面ボス・栂尾 芯のテーマ（曲名は仮）。\nユーザーが選んだ曲をつなぎ、調をそろえたアレンジです。',
                lead='trumpet', double="{ inst: 'lead', vol: 0.05, shift: -12 }",
                backing="{ arp: '16updown', arpInst: 'piano', arpVol: 0.045, bass: 'drive', pad: true }",
                order=['A', 'B', 'C', 'E', 'F', 'G', 'H'], bpm={}, oct={'A': 1}),
  'stage6': dict(an='an4.json', title='瓦礫の空に鈴が鳴る', key={'tonic': 5, 'mode': 'min'}, flat=True,
                comment='6面のテーマ（曲名は仮）。\nユーザーが選んだ曲をもとにしたアレンジです。',
                lead='lead', double="{ inst: 'bell', vol: 0.04, shift: 12 }",
                backing="{ arp: '16up', arpInst: 'bell', arpVol: 0.04, bass: 'oct8', pad: true }",
                order=['A'], bpm={}, oct={'A': 0}),
}
for pid, p in plans.items():
    an = json.load(open(f'{SP}/{p["an"]}'))
    secs = {s['name']: s for s in an}
    segs = []
    for n in p['order']:
        sg = {'an': 'x', 'sec': n, 'drums': drums(secs[n])}
        if n in p['bpm']: sg['bpm'] = p['bpm'][n]
        if 'oct' in p and n in p['oct']: sg['oct'] = p['oct'][n]
        segs.append(sg)
    plan = {'id': pid, 'title': p['title'], 'comment': p['comment'], 'lead': p['lead'], 'leadVol': 0.14 if p['lead'] == 'trumpet' else 0.13,
            'double': p['double'], 'backing': p['backing'], 'analyses': {'x': f'{SP}/{p["an"]}'}, 'key': p['key'], 'flat': p['flat'],
            'center': 74, 'segments': segs}
    json.dump(plan, open(f'{SP}/plan_{pid}.json', 'w'), ensure_ascii=False, indent=1)
