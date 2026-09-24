'use strict';
// ============================================================
//  BGM データ（すべてオリジナル曲）
//  melody: MML（1小節ごとに | で区切る）
//  chords: 1小節ごとのコード（空白区切りで半小節ずつ）
//  backing: 自動伴奏の設定
// ============================================================

const SONGS = {
  title: {
    title: '星降る夜の幻想郷',
    comment: 'タイトル画面のテーマです。\n星がゆっくりと降ってくる夜の、静かな始まりをイメージしました。',
    bpm: 108,
    lead: 'piano', leadVol: 0.2,
    chords: ['Am', 'F', 'G', 'Em', 'F', 'G', 'Am', 'Am', 'Dm', 'G', 'C', 'Am', 'Dm', 'E', 'Am', 'E7'],
    melody: `
      o5 e4. d8 c4 o4 a4 |
      o5 c4 d8 e8 f4 e8 d8 |
      o5 d4. c8 o4 b4 g4 |
      o4 b4 o5 c8 d8 e2 |
      o5 f4. e8 d4 c4 |
      o5 d4 e8 f8 g4 f8 e8 |
      o5 e4 c8 o4 a8 o5 e4 d8 c8 |
      o4 a2. r4 |
      o5 f4. e8 d4 a4 |
      o5 g4. f8 e4 d4 |
      o5 e4 g8 o6 c8 o5 b4 g4 |
      o5 a2 e4 c4 |
      o5 d4. e8 f4 a4 |
      o5 g+4. f8 e4 d4 |
      o5 c4 o4 b8 o5 c8 e4 o4 a4 |
      o4 b2 g+4 b4 |`,
    backing: { arp: '8updown', arpInst: 'bell', arpVol: 0.05, bass: 'whole', bassVol: 0.11, pad: true, padVol: 0.03 },
  },

  stage1: {
    title: '宵闇に落ちる流れ星',
    comment: '1面のテーマ。\n暗い森の小道に、流れ星がぽつぽつと落ちてくる感じ。\n軽快に、でも少しだけ不穏に。',
    bpm: 152,
    lead: 'trumpet', leadVol: 0.15,
    chords: ['Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'A', 'Gm', 'C', 'F', 'Dm', 'Gm', 'A', 'Dm', 'A'],
    melody: `
      o5 a4 f8 d8 e8 f8 g8 a8 |
      o5 b-4. a8 g4 f4 |
      o5 g8 a8 g8 f8 e4 c4 |
      o5 d4 e8 f8 a2 |
      o5 a4 f8 d8 e8 f8 g8 a8 |
      o5 b-4. o6 c8 d4 c4 |
      o5 b-8 a8 g8 a8 b-4 o6 c4 |
      o5 a2 c+4 e4 |
      o5 b-4 a8 g8 d4 g4 |
      o5 c4 d8 e8 g4 e4 |
      o5 f4 g8 a8 o6 c4 o5 a4 |
      o5 d2 f4 a4 |
      o5 b-4. a8 g4 b-4 |
      o5 a4. g8 f4 e4 |
      o5 f8 e8 d8 e8 f4 a4 |
      o5 e2 c+4 o4 a4 |`,
    backing: { arp: '16up', arpInst: 'piano', arpVol: 0.05, bass: 'oct8', pad: true },
    drums: 'rock',
  },

  boss1: {
    title: '月の見えない夜に',
    comment: 'ルーミアのテーマ。\n闇の中から何かが飛び出してくるような、\nちょっと怖くて、ちょっとお茶目な曲です。',
    bpm: 160,
    lead: 'trumpet', leadVol: 0.14,
    double: { inst: 'lead', vol: 0.05, shift: -12 },
    chords: ['Em', 'C', 'D', 'B7', 'Em', 'C', 'Am', 'B', 'C', 'D', 'Bm', 'Em', 'Am', 'D', 'C', 'B7'],
    melody: `
      o5 e8 g8 b8 e8 f+8 g8 a8 b8 |
      o6 c4. o5 b8 a8 g8 e4 |
      o5 f+8 g8 a8 f+8 d4 a4 |
      o5 d+4 f+4 b4 a4 |
      o5 e8 g8 b8 e8 f+8 g8 a8 b8 |
      o6 c4. d8 e4 d8 c8 |
      o5 b4 a8 g8 a4 c4 |
      o5 b2 d+4 f+4 |
      o5 g4 e8 g8 o6 c4 o5 b8 a8 |
      o5 a4 f+8 a8 o6 d4 c8 o5 b8 |
      o5 b4. a8 f+4 d4 |
      o5 e4 g4 b4 o6 e4 |
      o6 c4. o5 b8 a4 e4 |
      o5 f+4. g8 a4 d4 |
      o5 e8 f+8 g8 a8 b4 o6 c4 |
      o5 b4 a4 g4 f+4 |`,
    backing: { arp: '16updown', arpInst: 'piano', arpVol: 0.05, bass: 'drive', pad: true },
    drums: 'drive',
  },

  stage2: {
    title: '湖上の星影',
    comment: '2面のテーマ。\n霧の湖に映る星の影。\n水面の揺らぎをアルペジオで表現してみました。',
    bpm: 140,
    lead: 'lead', leadVol: 0.12,
    double: { inst: 'strings', vol: 0.05, shift: -12 },
    chords: ['Gm', 'Eb', 'F', 'Dm', 'Gm', 'Eb', 'Cm', 'D', 'Eb', 'F', 'Dm', 'Gm', 'Cm', 'F', 'Eb', 'D'],
    melody: `
      o5 d4 g8 a8 b-4 a8 g8 |
      o5 g4. f8 e-4 d4 |
      o5 c4 d8 e-8 f4 a4 |
      o5 d2 o4 a4 o5 d4 |
      o5 d4 g8 a8 b-4 o6 d4 |
      o6 e-4. d8 c4 o5 b-4 |
      o5 g4 e-8 g8 o6 c4 o5 b-8 a8 |
      o5 f+2 a4 d4 |
      o5 b-8 a8 g8 f8 e-4 g4 |
      o5 a8 g8 f8 e-8 d4 f4 |
      o5 d4 f4 a4 o6 d4 |
      o6 d4. c8 o5 b-4 g4 |
      o5 g4. f8 e-4 c4 |
      o5 f4. g8 a4 o6 c4 |
      o5 b-4. a8 g4 e-4 |
      o5 d4 f+4 a4 o6 c4 |`,
    backing: { arp: '16up', arpInst: 'bell', arpVol: 0.045, bass: 'oct8', pad: true },
    drums: 'light',
  },

  boss2: {
    title: '氷精のスターダストダンス',
    comment: 'チルノのテーマ。\n元気いっぱい、だけどちょっとおバカ。\n最強を目指す氷の妖精に捧げます。',
    bpm: 168,
    lead: 'lead', leadVol: 0.12,
    chords: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'F', 'E', 'F', 'G', 'Em', 'Am', 'F', 'G', 'Am', 'E'],
    melody: `
      o5 a8 a16 b16 o6 c8 o5 a8 e8 a8 o6 c8 e8 |
      o6 d8 c8 o5 b8 a8 g8 a8 b8 g8 |
      o5 a8 a16 b16 o6 c8 o5 a8 f8 a8 o6 c8 f8 |
      o6 e8 d8 c8 o5 b8 g4 b4 |
      o5 a8 a16 b16 o6 c8 o5 a8 e8 a8 o6 c8 e8 |
      o6 d8 c8 o5 b8 a8 b8 o6 c8 d8 e8 |
      o6 f4 e8 d8 c4 o5 a4 |
      o5 g+4 b4 o6 e4 o5 b4 |
      o6 c8 o5 a8 f8 a8 o6 c8 f8 e8 c8 |
      o5 b8 g8 d8 g8 b8 o6 d8 c8 o5 b8 |
      o5 g8 e8 b8 e8 g8 b8 o6 e8 d8 |
      o6 c4 o5 a8 e8 a2 |
      o5 a8 b8 o6 c8 d8 e8 f8 e8 d8 |
      o6 d8 c8 o5 b8 a8 g8 a8 b8 o6 d8 |
      o6 e4 c8 o5 a8 o6 c4 e4 |
      o5 b4 g+8 e8 g+4 b4 |`,
    backing: { arp: '16up', arpInst: 'bell', arpVol: 0.05, bass: 'oct8', pad: true },
    drums: 'rock',
  },

  stage3: {
    title: '天の川を登って',
    comment: '3面のテーマ。\n大樹を登り、天の川へと近づいていく高揚感を。\nここまで来たらあと一息です。',
    bpm: 146,
    lead: 'trumpet', leadVol: 0.15,
    chords: ['Cm', 'Ab', 'Bb', 'Gm', 'Cm', 'Ab', 'Fm', 'G', 'Ab', 'Bb', 'Eb', 'Cm', 'Ab', 'Bb', 'Cm', 'G'],
    melody: `
      o5 c4 e-8 g8 o6 c4 o5 b-8 g8 |
      o5 a-4. g8 e-4 c4 |
      o5 d4 f8 b-8 o6 d4 c8 o5 b-8 |
      o5 g2 d4 g4 |
      o5 c4 e-8 g8 o6 c4 d8 e-8 |
      o6 e-4. d8 c4 o5 a-4 |
      o5 f4 a-8 o6 c8 f4 e-8 d8 |
      o6 d2 o5 b4 g4 |
      o5 e-8 f8 g8 a-8 o6 c4 o5 a-4 |
      o5 f8 g8 a-8 b-8 o6 d4 o5 b-4 |
      o5 g4 b-4 o6 e-4 d4 |
      o6 c2. o5 g4 |
      o5 a-4. b-8 o6 c4 e-4 |
      o6 d4. c8 o5 b-4 f4 |
      o5 g4 o6 c4 e-4 c4 |
      o5 b2 g4 d4 |`,
    backing: { arp: '16up', arpInst: 'piano', arpVol: 0.05, bass: 'oct8', pad: true },
    drums: 'march',
  },

  boss3: {
    title: 'スターサファイア 〜 Starlight Wish',
    comment: 'スターサファイアのテーマ。\n星の光の妖精。今回の異変の犯人です。\n流れ星に願いを込めた、ラストバトルの曲。',
    bpm: 156,
    lead: 'trumpet', leadVol: 0.15,
    double: { inst: 'lead', vol: 0.05, shift: -12 },
    chords: ['Bm', 'G', 'A', 'F#', 'Bm', 'G', 'Em', 'F#7', 'G', 'A', 'D', 'Bm', 'Em', 'A', 'G', 'F#'],
    melody: `
      o5 f+4 b8 o6 c+8 d4 c+8 o5 b8 |
      o5 a4. g8 f+4 d4 |
      o5 e4 f+8 g8 a4 o6 c+4 |
      o5 a+2 f+4 c+4 |
      o5 f+4 b8 o6 c+8 d4 e8 f+8 |
      o6 g4. f+8 e4 d4 |
      o6 e4 d8 c+8 o5 b4 g4 |
      o5 f+2 a+4 o6 c+4 |
      o6 d4 o5 b8 g8 b4 o6 d4 |
      o6 c+4 o5 a8 e8 a4 o6 c+4 |
      o6 d4. e8 f+4 d4 |
      o5 b2. f+4 |
      o5 g4. a8 b4 e4 |
      o5 a4. b8 o6 c+4 e4 |
      o6 d4 c+8 o5 b8 a4 g4 |
      o5 f+4 a+4 o6 c+4 o5 a+4 |`,
    backing: { arp: '16updown', arpInst: 'piano', arpVol: 0.05, bass: 'drive', pad: true },
    drums: 'drive',
  },
};

const MUSIC_ROOM = ['title', 'stage1', 'boss1', 'stage2', 'boss2', 'stage3', 'boss3'];
