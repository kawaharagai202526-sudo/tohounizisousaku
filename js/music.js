'use strict';
// ============================================================
//  BGM データ
//  melody: MML（1小節ごとに | で区切る）
//  chords: 1小節ごとのコード（空白区切りで半小節ずつ）
//  backing: 自動伴奏の設定
//  parts: 曲の途中でテンポとドラムを変える（[{ bar: 何小節目から, bpm, drums, ramp: 前の何小節で近づけるか }]）
//  audio: 音声ファイルの曲（js/bgmfiles.js の BGM_FILES のID）。MML ではなく、もらった音をそのままループで鳴らす
//         （1〜6面の道中は 2.6.0、6面ボスは 2.9.0）。vol で音の大きさ
//  byDiff: 難易度でちがう曲にする（{ 3: '曲ID' } なら Lunatic のときその曲。songForDiff）
//  4面ボス・5面ボスの曲は、ユーザーがくれた音（いくつかの曲をつないだもの）から
//  tools/song-from-audio で旋律とコードを取り出し、調とテンポのつなぎ目をそろえてループするようにしたアレンジ（2.4.0）。
//  ほかの曲はオリジナル（エキストラの2曲は 2.8.0 で作った仮のもの）
// ============================================================

const SONGS = {
  title: {
    title: '座敷に灯る夜',
    comment: 'タイトル画面のテーマです（曲名は仮）。\n古びた座敷にぽつんと灯るあかりのような、静かな始まりをイメージしました。',
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
    title: '一夜で古びた里',
    comment: '1面のテーマ（曲名は仮）。\nユーザーがくれた曲をそのまま流しています。',
    audio: 'stage1', // js/bgmfiles.js の音声（2.6.0 でユーザーの指定）
    bpm: 110, vol: 1.43, // vol：ほかの曲と音の大きさをそろえる
  },

  boss1: {
    title: '焼きたての反逆児',
    comment: '1面ボス・軒端 鬼乃のテーマ（曲名は仮）。\n生まれたばかりの屋根の付喪神。本人は鬼のつもり。\nちょっと怖くて、ちょっとお茶目な曲です。',
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
    title: '虫食いの空き家',
    comment: '2面のテーマ（曲名は仮）。\nユーザーがくれた曲をそのまま流しています。',
    audio: 'stage2', // js/bgmfiles.js の音声（2.6.0 でユーザーの指定）
    bpm: 110, vol: 1.4, // vol：ほかの曲と音の大きさをそろえる
  },

  boss2: {
    title: '窓辺のごちそう',
    comment: '2面ボス・喰代 守子のテーマ（曲名は仮）。\n虫が大好物の家守。元気いっぱい、だけどちょっと食いしんぼう。',
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
    title: '夕暮れの裏通り',
    comment: '3面のテーマ（曲名は仮）。\nユーザーがくれた曲をそのまま流しています。',
    audio: 'stage3', // js/bgmfiles.js の音声（2.6.0 でユーザーの指定）
    bpm: 110, vol: 1.51, // vol：ほかの曲と音の大きさをそろえる
  },

  boss3: {
    title: 'ぬらりくらりの上がり込み',
    comment: '3面ボス・滑沢 瓢のテーマ（曲名は仮）。\nよその家にするりと上がりこんで、お茶をすする。\nつかみどころのない、少し切ない曲です。',
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

  stage4: {
    title: '借りものの間',
    comment: '4面のテーマ（曲名は仮）。\nユーザーがくれた曲をそのまま流しています。',
    audio: 'stage4', // js/bgmfiles.js の音声（2.6.0 でユーザーの指定）
    bpm: 110, vol: 0.91, // vol：ほかの曲と音の大きさをそろえる
  },

  boss4: {
    title: '朽ち果てぬ大黒柱',
    comment: '4面ボス・栂尾 芯のテーマ（曲名は仮）。\nユーザーが選んだ曲をつなぎ、調をそろえたアレンジです。',
    bpm: 139.7,
    lead: 'trumpet', leadVol: 0.14,
    double: { inst: 'lead', vol: 0.05, shift: -12 },
    // 途中でテンポとドラムが変わる（つなぎ目の小節で次のテンポへ近づける）
    parts: [
      { bar: 0, bpm: 139.7, drums: 'rock' },
      { bar: 9, bpm: 184.6, drums: 'drive', ramp: 1 },
      { bar: 30, bpm: 184.6, drums: 'drive', ramp: 1 },
      { bar: 55, bpm: 152.0, drums: 'light', ramp: 1 },
      { bar: 66, bpm: 156.6, drums: 'rock', ramp: 1 },
      { bar: 82, bpm: 114.8, drums: 'rock', ramp: 1 },
      { bar: 117, bpm: 123.0, drums: 'rock', ramp: 1 },
      { bar: 136, bpm: 131.3, drums: 'rock' },
    ],
    chords: [
      'Dm Dm', 'Eb Eb', 'Eb Bb', 'Bb Bb', 'C F', 'F F', 'Am Am', 'Am Am',
      'Am Bb', 'Eb Dm', 'Dm Dm', 'Dm Dm', 'F Fm', 'Fm Fm', 'Fm Fm', 'Gbm Gbm',
      'Gbm Gbm', 'Fm Fm', 'Fm Fm', 'Fm Am', 'Dm Dm', 'Dm Dm', 'Dm Fm', 'Fm Fm',
      'Fm Fm', 'Gbm Gbm', 'Gbm Gbm', 'Gbm Fm', 'Fm Fm', 'Fm G', 'C C', 'Dm C',
      'C Bb', 'C Dm', 'Dm Am', 'Bb Bb', 'C C', 'Dm C', 'C Bb', 'C Dm',
      'Dm C', 'Bb Bb', 'C C', 'Dm C', 'C Dm', 'C C', 'Dm Dm', 'Dm Dm',
      'C C', 'Dm C', 'C Dm', 'C C', 'Dm Dm', 'C Dm', 'Dm C', 'F F',
      'F F', 'F Bb', 'Bb Gb', 'Gb G', 'F Am', 'Dm Bb', 'Gm Gm', 'Gm Ab',
      'Ab Ab', 'Ab C', 'Fm Fm', 'Gm E', 'Dbm G', 'Am E', 'Fm Fm', 'Fm Fm',
      'Fm Bb', 'Bb Bb', 'Bb Fm', 'Fm G', 'F F', 'F F', 'F Fm', 'Fm Fm',
      'Fm F', 'F C', 'Fm Fm', 'Fm Fm', 'Db Db', 'Db F', 'F F', 'F Db',
      'Db Db', 'Db Fm', 'Fm Fm', 'C C', 'C C', 'Fm Fm', 'Fm Bbm', 'F Bbm',
      'Fm C', 'Fm Fm', 'Fm Bbm', 'F Bbm', 'Fm C', 'Fm Fm', 'Fm Fm', 'D D',
      'Ebm Ebm', 'G Gm', 'Gm Gm', 'D D', 'D Cm', 'Cm Eb', 'Eb Gm', 'Cm Gm',
      'Gm Gm', 'Gm Gm', 'Cm G', 'Cm Gm', 'Gm D', 'Gm Gm', 'Gm Gm', 'Gm Gm',
      'Gm Gm', 'Gm Gm', 'Gm Gm', 'D D', 'D F', 'Dm Dm', 'Gm Gm', 'Eb Eb',
      'Eb Cm', 'Cm Gm', 'Gm Gm', 'Eb Eb', 'Eb Eb', 'Gm Gm', 'Gm Gm', 'Gm Gm',
      'Gm A',
    ],
    melody: `
      o4 d2 d16 d16 e-8 o3 b-8. o4 e-16 |
      o4 e-16 o3 b-8 b-4.&b-16 o4 e-16 e-16 o3 b-8 b-8 |
      o3 b-4 b-8. b-8 b-8 b-16 o4 f8. f16 |
      o4 f16 e-16 o3 b-16 b-8. o4 e-8 o3 b-8. b-16 o6 f8. f16 |
      o6 e16 e16 o3 b-8 b-8 o5 c16 c16 o6 c8. f8 f8 f16 |
      o6 e8 o3 b-16 b-8 b-8 b-16 b-8 o4 e-16 e-4 o6 e16 |
      o6 e16 e4 d8 e16 e8 o4 a8 e-8 o3 a16 b-16 |
      o3 b-16 a8 b-16 o4 e-8 e-8 d16 o3 b-16 b-8 a16 o6 f16 f8 |
      o6 f2 r4 o5 d16 e16 f16 g16 |
      o5 a-16 a-4 a-16 f8 f8 d4&d16 d16 |
      o5 d4. c16 c8. c8. o4 a16 o5 f16 f16 |
      o5 f16 f8. f8 g16 e8 d16 f16 f16 d8 d8 |
      o5 d16 d16 f16 f8 f8 f8 f8 f8. g8 |
      o5 g16 c16 e-8. a-8 a-8. a-8 a-8. g16 |
      o5 g8 a-16 a-8. f4 g-16 g-8 g-8 g-16 |
      o5 g-16 g-8 g-8 o4 g-8 o5 e4 e16 o4 a16 a16 o5 a16 a16 |
      o5 a4 a8. e8. g-16 g-8. e16 e16 |
      o5 e16 o4 a8 o5 f8. f8. f8. f8 f16 g16 |
      o5 g8. g8. a-16 a-4. a-8. |
      o5 a-8. e16 c4.&c16 d4 d16 |
      o5 d16 d16 o4 a16 a4 o5 c8 o4 a8 o5 c8 o4 a8 o5 f16 |
      o5 f8 f8. f8 g16 g8 f16 f8 d8 d16 |
      o5 d8. f16 f8. f8. f8 f8. g16 |
      o5 g8 c16 e-8 o4 a-8 o5 a-8. a-8. a-8 b-16 |
      o5 b-16 o4 e-8 o5 a-4 f4 g-4 g-16 |
      o5 g-16 g-8 g-8. g-16 e4 e8 o4 a8 o5 a16 |
      o5 a8 a8. a8 a-8 o4 a-16 a-16 o5 g-4 e16 |
      o5 e8. f16 f8. f4 f8 f8 g16 |
      o5 g8. g8. a-8 a-8. a-8 a-16 a-8 |
      o5 a-2 r4 o4 a16 b-16 o5 c16 d16 |
      o5 e8 f16 o4 a16 a16 o5 e8. e16 e8. f8 o4 f16 f16 |
      o4 a8 o5 e16 f16 f4 e16 o4 g8 g16 f16 o5 c8 c16 |
      o5 c4 d8 a8. a8 d16 d4 |
      o5 d16 d8. c8 o4 a8 o5 d4 o4 f4 |
      o4 f16 a8. a4 a4 a4 |
      o4 a8 o5 f16 e16 d4 d2 |
      o5 e16 e16 a8 o6 d8 o5 f8 e16 e8. f4 |
      o5 d16 o4 a8. o5 f16 f4 e16 c4 c8 |
      o5 c16 c8. d8 f16 a8 a8. d8. d16 |
      o5 d8 d8. c8 o4 a16 o5 d16 d4.&d16 |
      o5 d4. d8 d4.&d16 d16 |
      o5 d16 g8. f16 f4 f4 f8 a16 |
      o5 g16 g8 f16 d16 d8 g8 g16 e8. f16 f8 |
      o5 f16 d16 d16 e16 e16 f8 f8 e16 e8 f16 f8 c16 |
      o5 c16 c4 f16 f8 a16 a8. f16 f8 f16 |
      o5 f4 e16 e16 c16 o4 a16 a16 o5 f4 d8. |
      o5 d4 d8. d4.&d16 d8 |
      o5 g8 g16 f8. f8. f4. d16 |
      o5 d16 g8 a8 d8 f8 g4 a16 f8 |
      o5 f16 d8. a16 a16 f4 g8. f16 f8 |
      o5 c8 c8. d8. a16 a4 f8. |
      o5 f16 f8 d8 c16 c8 o4 a16 o5 d4. d16 |
      o5 d8 f8. f8 d8 d8 d8 d8 d16 |
      o5 d8 f16 f16 d16 d8 o4 a2 a16 |
      o4 a2 r4 a16 b-16 o5 c16 d16 |
      o5 e16 c16 d-16 d-16 c16 o4 f8 f8 c4 c8. |
      o4 c16 c16 d8 d8 o3 b-4&b-16 b-8. o4 g16 g16 |
      o4 g16 g16 o5 c8. c16 o3 b-8. b-16 o4 d16 d16 o3 b-8 o4 b-16 b-16 |
      o4 b-8 b-16 o5 c16 c8 o3 b-16 b-8 b-8 o5 c8 o4 b-8 b-16 |
      o4 b-8. o5 e8 e16 a16 a8 a16 d16 o4 a8. f16 f16 |
      o4 f8 f16 a8 a8 a8. b-8. b-16 a16 a16 |
      o4 a8 a8 o5 d8 o4 g16 g8 d4 a16 o5 d8 |
      o5 d16 d16 o4 g16 g4 a8 a16 b-16 b-16 o5 b-16 b-16 o4 g16 g16 |
      o4 g16 g8 a16 b-16 b-8 o5 c16 c8. c16 d-16 d8 d16 |
      o5 c16 c4 c8 o4 b-8 b-16 a-8. a-8 g16 |
      o4 g2 r4 d16 e16 f16 g16 |
      r2 o4 a-2 |
      o3 b-4. o4 b-16 b2&b16 |
      o5 d-16 d-8. d-8 d-16 d8. d8 d4 |
      o4 a4&a16 b16 o5 d-8 o4 a-8 o5 d8 e16 e8. |
      o5 f8 f2. f8 |
      o5 f8 f4. b2 |
      o5 b4&b16 o4 f16 f8. f4 f8. |
      o4 f16 f16 d4 f8. f4. f16 |
      o4 d-8 f16 f8. c16 c16 f8 c4&c16 f16 |
      o4 f8. f4 e-8 f4. f16 |
      o4 f4&f16 f4 o5 f16 f4 f8 |
      o4 g4&g16 g4 g4&g16 g8 |
      o4 g8 o5 g8. f8 o4 a-16 a-8. f8 a-8. |
      o4 a-2.&a-16 a-8. |
      o5 f8 o4 a-8 o5 f8 f16 a2&a16 |
      o5 a2 r4 o3 f16 g16 a16 b-16 |
      o4 c8 d-16 d-8. o3 b-8 b8 b16 o4 f8 o3 b16 o4 c16 c16 |
      o4 c16 c8 d-8 d-16 f8. f16 c16 c8 d-8 d-16 |
      o4 d-16 o3 a-8. a16 b16 b16 o4 f4 f4&f16 |
      o4 f16 d-8 o3 b8 o4 f8 c2 c16 |
      o3 a-8. o4 d-8 d-4 d8 d4 e-16 |
      o4 e-8. e8 f4 d-8 d-8. d-16 e-16 |
      o4 e-8 g8. a-16 a-8 a-8 b-8. b-8 o5 c16 |
      o5 c8. d-8 d-8 f4. g8 a-16 |
      o5 a-8 a-8. o4 f8 o5 a-4 g8 f8 g16 |
      o5 g8. o4 c8 c8 o5 c16 c8 g8. a-8. |
      o5 b-16 b-4 g16 g16 b-8 b-8 a-8. g16 g16 |
      o5 f16 f4&f16 o4 f8 o6 c4 o4 f16 f8. |
      o4 f16 e-8. f8 e-8 o6 d-4 c8 o3 b-16 b-16 |
      o6 c4 o5 f16 f8. f8 o6 d-16 o5 b-16 b-8 o4 b-8 |
      o6 c4. o5 a-8 b-4 a-16 a-16 g8 |
      o5 g16 f4&f16 o6 c8. o4 c8 f4&f16 |
      o4 f16 e-8 e-16 f8. e-16 o5 b-8. o6 d-16 c8 o5 b-16 b-16 |
      o6 c8 c8 o5 f16 o4 f16 f16 o5 f8. b-4 o4 b-8 |
      o6 c4. o5 a-8. b-8 b-16 a-8 g8 |
      o5 g16 o4 c8. c4 c8 c16 o5 f8. o4 c16 c16 |
      o4 c16 g4.&g16 g16 c8. c4 |
      o4 c16 d16 d4 e-8 e-8. o5 e-8 o4 g-16 d8 |
      o4 d16 d8 b-8 b-8 b-16 o5 g-8. o4 a4&a16 |
      o5 g8 g4&g16 o4 a16 b-16 b-4 b-8 g16 |
      o4 b-16 b-4 a16 g8. a16 a8. o5 d8 o4 d16 |
      o6 d8 o4 a16 a8. b-16 b-16 o5 c4&c16 c8 o4 a16 |
      o5 c16 c4 b-8 a8 g16 o6 d4 o5 a16 b-16 |
      o6 c16 d16 o4 d16 d8 e-16 o5 g8 g16 f16 f16 o4 f8 g8 g16 |
      o4 f8 e-8. e-16 o6 d8. d8. o5 b-16 g8. |
      o5 g16 g8 e-8 o6 e-8 c8 o4 d4 o6 d8 o5 b-16 |
      o5 b-16 o6 c4 o5 b-8 a8. g4. |
      o5 g16 d4&d16 g16 g8 f16 f8. g16 g8 |
      o5 f16 e-16 e-16 o6 e-8 d4 d16 o4 d4 g8 |
      o4 g16 c16 c16 o5 e-8 e-8 o6 c16 o5 a16 b-16 b-16 o6 d8. o4 g16 b-16 |
      o4 b-2 r4 e16 f16 g16 a16 |
      o4 b-16 g4 g8 g8. g8. o5 g8. |
      o5 g8 o4 g4 g2&g8 |
      o4 g8 o5 g2.&g8 |
      o5 g2&g16 a8 a8. b-16 b-16 |
      o5 b-2&b-8. g4 b-16 |
      o5 b-8. b-4&b-16 a8. g4 a16 |
      o5 a4. d4 o4 d8 o5 d4 |
      o5 a4.&a16 b-8. o6 c8. c8. |
      o6 c8. o5 a8. o6 c8 c8 c16 o5 b-16 b-16 a8 a16 |
      o5 g2&g8 o6 d8. o5 b-8 o4 g16 |
      o4 g8. f8. f4 f16 f16 o6 e-8. e-16 |
      o6 e-16 d16 c8. d8 o5 b-16 b-16 g8 g4 o6 e-16 |
      o6 e-8. c8 o5 b-4 o6 d8 o5 b-8 o6 c16 c8 |
      o6 c16 o5 b-8 a16 a8 g8 g8. g8 b-8 b-16 |
      o5 b-16 g8 g8 f16 d8. g8 f16 f16 e-16 e-8 |
      o6 d8 c16 c16 d8 o5 b-8 g16 o4 g16 g8. o5 e-16 e-8 |
      o5 e-16 o6 c8 o4 d4&d16 o5 b-8 o6 c8 c16 o5 b-8 a16 |
      o5 a16 g8. g8 g16 g16 o4 g16 g4.&g16 |
      o4 g16 g4.&g16 r4 r16 g8 b-16 |
      o4 b-2 r4 o3 g16 a16 b-16 o4 c16 |`,
    backing: { arp: '16updown', arpInst: 'piano', arpVol: 0.045, bass: 'drive', pad: true },
  },

  stage5: {
    title: '崩れゆく借りものの屋敷',
    comment: '5面のテーマ（曲名は仮）。\nユーザーがくれた曲をそのまま流しています。',
    audio: 'stage5', // js/bgmfiles.js の音声（2.6.0 でユーザーの指定）
    bpm: 160, vol: 2.9, // vol：ほかの曲と音の大きさをそろえる
  },

  boss5: {
    title: '家鳴りの狂詩曲',
    comment: '5面ボス・家鳴 鳴音のテーマ（曲名は仮）。\nユーザーが選んだ曲をつなぎ、調をそろえたアレンジです。',
    bpm: 139.7,
    lead: 'trumpet', leadVol: 0.14,
    double: { inst: 'lead', vol: 0.05, shift: -12 },
    // 途中でテンポとドラムが変わる（つなぎ目の小節で次のテンポへ近づける）
    parts: [
      { bar: 0, bpm: 139.7, drums: 'drive' },
      { bar: 37, bpm: 152.0, drums: 'light', ramp: 1 },
      { bar: 49, bpm: 143.6, drums: 'rock', ramp: 1 },
      { bar: 56, bpm: 120.2, drums: 'rock', ramp: 1 },
      { bar: 88, bpm: 129.9, drums: 'rock' },
    ],
    chords: [
      'Fm Fm', 'Fm Fm', 'Fm Fm', 'Fm Fm', 'Fm Fm', 'Fm Fm', 'Fm Fm', 'Fm Fm',
      'Fm Fm', 'Fm Fm', 'Fm Fm', 'Fm Fm', 'Fm Fm', 'Fm Db', 'Eb Eb', 'C C',
      'Fm Fm', 'Fm Db', 'Ab Eb', 'C C', 'Fm Fm', 'Fm Fm', 'Fm Eb', 'Eb C',
      'Fm Fm', 'Db Db', 'Ab Eb', 'C C', 'Fm Fm', 'Fm Fm', 'Fm Fm', 'Fm Fm',
      'Fm Fm', 'Fm Fm', 'Fm Fm', 'Fm Fm', 'Fm G', 'Cm Cm', 'Cm Fm', 'Cm Cm',
      'Cm Eb', 'Fm Fm', 'Fm Fm', 'Db Db', 'Fm Fm', 'Fm Fm', 'B B', 'B C',
      'C C', 'F F', 'F F', 'B B', 'B Db', 'Db Db', 'Db Db', 'Db C',
      'F F', 'F Cm', 'F F', 'Cm F', 'F F', 'F Cm', 'Cm F', 'Cm F',
      'F F', 'F Cm', 'F F', 'F F', 'F Cm', 'Cm Am', 'Am Bbm', 'Bbm Bbm',
      'F F', 'Gb Cm', 'Cm Cm', 'Cm Cm', 'Cm Cm', 'Gb Cm', 'F F', 'F F',
      'F F', 'F F', 'F F', 'F F', 'F F', 'F F', 'F F', 'F F',
      'F C',
    ],
    melody: `
      r16 o6 c16 o4 a-8. b-8. a-16 a-16 o5 e-8 d8 o4 b-8 |
      o4 a-4&a-16 b-8. a-16 a-16 o5 c8. d16 o4 g16 a-16 |
      o4 a-16 a-8. b-4&b-16 o5 e-8. d8 o4 b-8 |
      o4 a-4&a-16 b-8 r2 r16 |
      r16 o4 a-8 f16 g16 a-16 a-16 o5 c16 o4 g16 a-16 o5 c16 g16 a-4 |
      o5 a-16 f16 f16 c16 c16 o4 a-8 o5 c8 o4 a-8 o5 c16 o4 g16 f16 f8 |
      o4 g16 a-8 f16 f16 g16 a-16 o5 c16 o4 b-16 a-16 o5 c16 g16 a-8 a-8 |
      o5 a-16 f8 f16 o4 a-8. a-8 o5 c16 r8. o4 f16 f8 |
      o4 g16 o5 c8 c8 c8 c16 o4 b-16 a-16 o5 c16 g16 a-16 a-8 a-16 |
      o5 a-16 f8 f8 o4 a-16 f16 f16 o5 c4&c16 c16 o4 f8 |
      o4 g16 a-16 a-4 a-16 o5 c16 o4 b-16 a-16 o5 f16 g16 a-8. a-16 |
      o5 a-16 a-16 f16 f16 c8. c4 f16 f16 c16 o4 f8 |
      o4 g16 a-16 o5 c8 f16 o4 b-4 a-16 a-8 g16 g8 o5 c16 |
      o5 c16 c8. f16 o4 b-8. o5 c16 o4 a-8 g8. g8 |
      o4 e-16 o5 f8. g16 o4 g16 g8 a-8 g8 e-16 e-8 e-16 |
      o4 e-16 e8 e16 o5 f16 o4 g8 o5 c8. o4 g8. e8 e16 |
      o4 e16 o5 c8 c16 f16 f16 o4 b-16 b-16 o5 c8 o4 a-8 g4 |
      o5 f16 f8. f8 g8 a-8 a-4 a-8 |
      o5 a-8 a-8. f16 f8 o4 g8 a-4 a-8 |
      o4 a-8 g4. g4 g4 |
      o4 g16 o5 c16 c8 f16 f16 o4 b-16 b-16 o5 c16 c16 o4 a-8. a-16 g16 o5 f16 |
      o5 c4&c16 c16 o4 b-16 b-16 o5 c16 c16 o4 a-16 a-16 g16 g8. |
      o4 g16 g8 f8 f16 g8 a-8 a-16 g16 g16 a-8 a-16 |
      o4 a-8 e16 e8 f16 g8 o5 c8 o4 g16 g8 f16 e16 e16 |
      o4 e16 e16 o5 c8 c16 f16 o4 b-16 b-16 o5 c8 o4 a-8. g8 o5 f16 |
      o5 f4 f8. g8 a-16 a-4 a-8 |
      o5 a-8. a-16 g8 a-16 a-8 b-8 b-8. b-8 |
      o5 b-16 b-8 e4.&e16 e8 e8 e8 |
      o5 e8 e16 f16 f4&f16 f8. f8 f8 |
      o5 f4 f8. f8 f8. f8. f16 |
      o5 f8 f4.&f16 f4 f8 f16 |
      o5 f16 f8 f8 f4&f16 f8. f8. |
      o5 f16 f2 c16 o4 g16 a-16 o5 f16 g16 a-16 a-16 |
      o5 a-16 a-8 f8 c16 c16 o4 a-16 g16 f16 o5 c16 c8 c16 o4 a-16 g16 |
      o4 f8 g8 a-16 f16 f16 g16 a-16 a-8 a-16 o5 c16 g16 a-16 a-16 |
      o5 a-4 g16 f16 c8 e4&e16 r8. |
      o5 e2 r4 o4 c16 d-16 e-16 f16 |
      o4 g4 g8 g4 g8 a-8. a-16 |
      o4 a-16 a-16 g8 g8 g8 a-4. a-16 g16 |
      o4 g4 g4. g8. g16 o5 g8 |
      o5 g8. g8. g16 o4 g8. g8 b-8 b-8 |
      o4 b-4 a-16 a-8. a-4 a-8 g8 |
      o4 a-16 a-4&a-16 a-8 f8. a-8. a-8 |
      o4 a-16 a-4 a-8 a-16 a-16 b4&b16 b8 |
      o4 b8 b8. b16 o6 c16 c16 o4 f8. o5 c16 o4 b8 o5 c16 c16 |
      o4 b8 o5 c16 c16 o4 b8 b8. b8 o5 c16 d-8 d-16 c16 |
      o5 e-4 e-16 o4 b8 o5 c16 d-8 d-16 c16 g-8 g-8 |
      o5 g-4. g-8 c16 g16 g4 g8 |
      o5 g2 r4 o4 b-16 o5 c16 d-16 e-16 |
      o5 f8. f8 f8. f8 f16 e-16 e-8 f16 f16 |
      o5 f8 f16 o6 c16 c4&c16 o5 f8 f8 f16 o6 c16 c16 |
      o6 c16 c8. o5 e-8 e-8. e-8 e-8. e-8 |
      o5 e-8 e-16 f8. f8. f4. f16 |
      o6 c4&c16 d-16 d-8. d-8 d-4&d-16 |
      o6 d-4. d-16 o5 f8. f8 d8 g-16 g-16 |
      o5 g-2 r4 o4 f16 g16 a-16 b-16 |
      o5 c4. c8 c4 c4 |
      o5 c16 c8. c2&c16 c8 c16 |
      o5 c16 c4&c16 o4 f16 f4. f16 o5 c16 o4 g16 |
      o4 g4. o5 c16 c16 o4 a8. a4&a16 |
      o4 a16 a8. a8. a8 o5 c4. c16 |
      o5 c8. c2 c8 c8 c16 |
      o5 c4.&c16 c16 o4 f8. f8. f8 |
      o4 g16 g4 g8. a4. a8 |
      o4 a4 a8 a4 a16 o5 c8 c8 c16 |
      o5 c16 c8 c8 o4 a8. o5 c8. c16 o4 b-16 b-8. |
      o5 c16 o4 a16 a8 o5 c8 o4 b-16 b-16 o5 c16 c4. c16 |
      o5 c8 c16 o4 f8 f8. f16 o5 c8 c8 c8. |
      o5 c8 o4 g16 g16 o5 c8 o4 a8 o5 c8. c16 o4 b-16 b-16 o5 c8 |
      o5 c8 f4. c16 c8. c4 |
      o5 c8. c8. c4 d-4 d-8 |
      o4 b-8 o5 d-4 d-4.&d-16 c8. |
      o5 c8 c8 o4 a8 o5 c4 d-8 d-8. d-16 |
      o4 b-16 b-16 o5 d-8. d-8 d-8. c8 c4 |
      o5 c8 c4 c8 c8 o4 e-16 e-8. e-8 |
      o4 e-8. e-8 e-8 e-8 f8 e-16 e-8 e-8 |
      o4 e-16 e-8 o5 c16 c2 d-4 |
      o5 d-16 d-4 d-4. c4&c16 |
      o5 c8. c4&c16 c4 c4 |
      o5 c8 c8 c4 c8 c8. c8. |
      o5 c16 c8. c8 c8 c8 c4&c16 c16 |
      o5 c8 c4&c16 c4. c8. |
      o5 d-16 c16 c4.&c16 c8. c8. o4 a16 |
      o4 a16 o5 c4 c4. c4 c16 |
      o5 c16 c8 d-8 o4 a8. o5 c16 c8 c16 c8. c16 |
      o5 c16 c4 c4 c4 c8 c16 |
      o5 c4&c16 c4 c8 c4 c16 |
      o5 c8. c4 c8 c8. c4 |
      o5 c2 r4 f16 g16 a-16 b-16 |`,
    backing: { arp: '16updown', arpInst: 'piano', arpVol: 0.045, bass: 'drive', pad: true },
  },

  stage6: {
    title: '瓦礫の空に鈴が鳴る',
    comment: '6面のテーマ（曲名は仮）。\nユーザーがくれた曲をそのまま流しています。',
    audio: 'stage6', // js/bgmfiles.js の音声（2.6.0 でユーザーの指定）
    bpm: 164, vol: 1.92, // vol：ほかの曲と音の大きさをそろえる
  },

  boss6: {
    title: '座敷わらしの家運隆盛',
    comment: '6面ボス・座敷 宿美のテーマ（曲名は仮）。\nユーザーがくれた曲をそのまま流しています。',
    // 音声ファイルの曲（js/bgmfiles.js の BGM_FILES。tools/embed-audio.js で入れる）。
    // 2.9.0 でユーザーの指定（2.5.0〜2.8.x は Lunatic の曲だった MP3。2.4.0〜2.8.x のほかの難易度は、もらった動画から作ったアレンジだった）
    audio: 'boss6',
    byDiff: { 3: 'boss6lunatic' }, // Lunatic のときは別の曲（2.7.0 でユーザーの指定。曲は 2.9.0 で入れかえた）
    bpm: 120, vol: 0.92, // vol：ほかの曲と音の大きさをそろえる
  },
  boss6lunatic: {
    title: '座敷わらしの家運隆盛（Lunatic）',
    comment: '6面ボス・座敷 宿美のテーマ（難易度 Lunatic のとき。曲名は仮）。\nユーザーがくれた曲をそのまま流しています。',
    // 音声ファイルの曲。2.9.0 でユーザーの指定。93秒のところから最初へ戻る（そのあとの終わりの部分は流さない）
    audio: 'boss6lunatic',
    bpm: 166, vol: 0.83, // vol：ほかの曲と音の大きさをそろえる
  },

  stageEx: {
    title: '方位の果てを巡る',
    comment: 'エキストラステージのテーマ（曲名は仮）。\n崩れた屋敷の瓦礫を越えると、金色の方位盤がゆっくり回る異界。\nどの方角へ進んでも、誰かに見られているような曲です。',
    bpm: 152,
    lead: 'lead', leadVol: 0.13,
    double: { inst: 'bell', vol: 0.05, shift: 12 },
    chords: ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'Gm', 'A', 'F', 'C', 'Dm', 'Am', 'Bb', 'C', 'A', 'A7'],
    melody: `
      o5 d8 f8 a8 d8 e8 f8 g8 a8 |
      o5 b-4. a8 g8 f8 d4 |
      o5 e8 f8 g8 e8 c4 g4 |
      o5 c+4 e4 a4 g4 |
      o5 d8 f8 a8 o6 d8 c8 o5 a8 f8 a8 |
      o5 b-4. o6 c8 d4 o5 b-4 |
      o5 g8 a8 b-8 g8 o6 d4 c8 o5 b-8 |
      o5 a2 c+4 e4 |
      o5 f4 a8 o6 c8 f4 e8 d8 |
      o6 e4 c8 o5 g8 o6 c4 o5 b-8 a8 |
      o5 a4. f8 d4 f4 |
      o5 e2 a4 o6 c4 |
      o6 d4. c8 o5 b-4 a4 |
      o5 g4. f8 e4 g4 |
      o5 a8 b8 o6 c+8 d8 e4 c+4 |
      o5 a2 g4 e4 |`,
    backing: { arp: '16updown', arpInst: 'piano', arpVol: 0.045, bass: 'oct8', pad: true },
    drums: 'drive',
  },

  bossEx: {
    title: '金色の祟り神',
    comment: 'エキストラボス・金神のテーマ（曲名は仮）。\n年ごとに方角を巡り、行く手を塞ぐ者に祟る方位神。\n怒りっぽくて、でもどこか律儀な神様の曲です。',
    bpm: 168,
    lead: 'trumpet', leadVol: 0.15,
    double: { inst: 'lead', vol: 0.05, shift: -12 },
    chords: ['Em', 'C', 'Am', 'B7', 'Em', 'C', 'D', 'B', 'C', 'D', 'G', 'Em', 'Am', 'B7', 'Em', 'B7'],
    melody: `
      o5 e8 b8 g8 e8 o6 e4 d8 o5 b8 |
      o6 c4 o5 b8 a8 g4 e4 |
      o5 a8 o6 c8 e8 c8 d4 c8 o5 b8 |
      o5 b2 d+4 f+4 |
      o5 e8 g8 b8 o6 e8 g4 f+8 e8 |
      o6 e4. d8 c4 o5 g4 |
      o5 a8 b8 o6 c8 d8 f+4 e8 d8 |
      o6 d+2. o5 b4 |
      o6 e4 g8 e8 c4 e4 |
      o6 f+4 a8 f+8 d4 f+4 |
      o6 g4. f+8 e4 d4 |
      o6 e4 o5 b4 g4 e4 |
      o5 a4 o6 c8 e8 a4 g8 f+8 |
      o6 f+4 d+8 o5 b8 o6 d+4 f+4 |
      o6 e8 f+8 g8 a8 b4 g4 |
      o6 f+4 e4 d+4 o5 b4 |`,
    backing: { arp: '16updown', arpInst: 'piano', arpVol: 0.05, bass: 'drive', pad: true },
    drums: 'rock',
  },
};

const MUSIC_ROOM = ['title', 'stage1', 'boss1', 'stage2', 'boss2', 'stage3', 'boss3', 'stage4', 'boss4', 'stage5', 'boss5', 'stage6', 'boss6', 'boss6lunatic', 'stageEx', 'bossEx'];

// 難易度で曲を変える（SONGS の byDiff: { 難易度: 曲ID }）。ゲーム中だけ使う（ミュージックルームでは、それぞれの曲がそのまま鳴る）
function songForDiff(id, diff = DIFF) {
  const v = SONGS[id] && SONGS[id].byDiff;
  return (v && v[diff]) || id;
}
