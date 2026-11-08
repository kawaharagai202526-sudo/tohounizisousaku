'use strict';
// ============================================================
//  BGM データ
//  melody: MML（1小節ごとに | で区切る）
//  chords: 1小節ごとのコード（空白区切りで半小節ずつ）
//  backing: 自動伴奏の設定
//  parts: 曲の途中でテンポとドラムを変える（[{ bar: 何小節目から, bpm, drums, ramp: 前の何小節で近づけるか }]）
//  audio: 音声ファイルの曲（js/bgmfiles.js の BGM_FILES のID）。MML ではなく、もらった音をそのままループで鳴らす
//         （1〜6面の道中は 2.6.0、4〜6面とエキストラのボスは 2.18.0）。vol で音の大きさ
//  byDiff: 難易度でちがう曲にする（{ 3: '曲ID' } なら Lunatic のときその曲。songForDiff。いまは使っていない）
//  ほかの曲はオリジナル（エキストラの道中の曲は 2.8.0 で作った仮のもの）
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
    comment: '4面ボス・栂尾 芯のテーマ（曲名は仮）。\nユーザーがくれた曲をそのまま流しています。',
    // 音声ファイルの曲（2.18.0 でユーザーの指定。2.4.0〜2.17.x は、もらった動画から作ったアレンジだった）。
    // はじめの入りを1回流してから、くり返しの部分をループする（js/bgmfiles.js の intro。ループの位置は Claude が拍に合わせて決めた）
    audio: 'boss4',
    bpm: 117.5, vol: 0.8, // vol：ほかの曲と音の大きさをそろえる
  },

  stage5: {
    title: '崩れゆく借りものの屋敷',
    comment: '5面のテーマ（曲名は仮）。\nユーザーがくれた曲をそのまま流しています。',
    audio: 'stage5', // js/bgmfiles.js の音声（2.6.0 でユーザーの指定）
    bpm: 160, vol: 2.9, // vol：ほかの曲と音の大きさをそろえる
  },

  boss5: {
    title: '家鳴りの狂詩曲',
    comment: '5面ボス・家鳴 鳴音のテーマ（曲名は仮）。\nユーザーがくれた曲をそのまま流しています。',
    // 音声ファイルの曲（2.18.0 でユーザーの指定。2.4.0〜2.17.x は、もらった動画から作ったアレンジだった）。入りのあとループする
    audio: 'boss5',
    bpm: 107.7, vol: 1.4, // vol：ほかの曲と音の大きさをそろえる
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
    // 音声ファイルの曲（2.18.0 でユーザーの指定。すべての難易度でこの曲。入りのあとループする）。
    // 2.9.0〜2.17.x は、Lunatic だけ別の曲（boss6lunatic）だった
    audio: 'boss6',
    bpm: 166.7, vol: 1.3, // vol：ほかの曲と音の大きさをそろえる
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
    comment: 'エキストラボス・八重 神世羅のテーマ（曲名は仮）。\nユーザーがくれた曲をそのまま流しています。',
    // 音声ファイルの曲（2.18.0 でユーザーの指定。2.8.0〜2.17.x は Claude が作った仮の曲だった）。入りのあとループする
    audio: 'bossEx',
    bpm: 132.5, vol: 1.1, // vol：ほかの曲と音の大きさをそろえる
  },
};

const MUSIC_ROOM = ['title', 'stage1', 'boss1', 'stage2', 'boss2', 'stage3', 'boss3', 'stage4', 'boss4', 'stage5', 'boss5', 'stage6', 'boss6', 'stageEx', 'bossEx'];

// 難易度で曲を変える（SONGS の byDiff: { 難易度: 曲ID }）。ゲーム中だけ使う（ミュージックルームでは、それぞれの曲がそのまま鳴る）
function songForDiff(id, diff = DIFF) {
  const v = SONGS[id] && SONGS[id].byDiff;
  return (v && v[diff]) || id;
}
