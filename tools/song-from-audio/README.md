# 音から曲データを作る道具（song-from-audio）

ユーザーがくれた音（動画や音声）から、主旋律・コード・テンポ・調を取り出して、
ゲームの曲データ（`js/music.js` の `SONGS` の1曲）を作る。2.4.0 で、4面ボス・5面ボス・6面・6面ボスの曲を作るのに使った
（6面ボスは 2.5.0、6面道中は 2.6.0 で、もらった音声をそのまま流すように変えた。音声ファイルをそのまま使うなら `tools/embed-audio.js`）。

自動で耳コピするので、**音はおおよそ**になる（伴奏が厚いところでは、旋律の代わりに伴奏の音を拾うこともある）。
和音の流れはかなり元どおりになる（2.4.0 の4曲で、小節ごとの響きの相関が 0.68〜0.90。ずらしたときは 0.05 前後）。
作ったあとは、ゲームのミュージックルームで聞いて確かめてもらう。

## 必要なもの

- ffmpeg（動画から音を取り出す）
- Python 3.11 と、`pip install basic-pitch numpy scipy matplotlib`（basic-pitch は TensorFlow も入れる。モデルは同梱でネットは不要）
- Node.js と Playwright（`render.js` でゲームの音源を鳴らす。テストと同じ）

## 手順

作業用のフォルダで行う（音の大きなファイルはリポジトリに入れない）。

```sh
# 1. 音を取り出す（モノラル 22050Hz）
ffmpeg -i もらった.mp4 -ac 1 -ar 22050 clip1.wav
# 2. Basic Pitch で「どの音が鳴っているか」を出す（数分かかる）
python transcribe.py clip1.wav bp1.npz
# 3. つなぎ目・テンポ・拍を調べて、部分（section）を決める
python seams.py bp1.npz clip1.wav           # 響きが変わる場所
python tempomap.py clip1.wav                # 1秒ごとのテンポ
python beatcheck.py clip1.wav 33.6 79.5 166 # その範囲の拍がそろっているか（std が小さいほどよい）
# 4. 部分ごとに、拍・小節・主旋律（16分の升目）・コード（半小節）・調を取り出す
python arrange.py cfg1.json an1.json
python overlay.py an1.json bp1.npz 30 60 check.png   # 取り出した旋律を元の音の図に重ねて見る
# 5. 計画（並べる部分・合わせる調・テンポ・ドラム）から曲データを作る
python build.py plan.json boss6.js           # boss6.js と boss6.js.meta.json ができる
# 6. ゲームの音源で鳴らして、元の曲とくらべる
node render.js boss6 r_boss6.wav boss6.js
python transcribe.py r_boss6.wav rbp_boss6.npz
python compare_all.py boss6.js.meta.json an1.json bp1.npz rbp_boss6.npz
```

できた `boss6.js` の中身を `js/music.js` の同じIDの曲と入れかえる。

## 設定（cfg）

`{ "wav", "npz", "sections": [{ "name", "start", "end", "bpm", "lo", "hi", "prior", "phase" }] }`

- `start` / `end`：その部分の秒。つなぎ目のすぐ近くは少し外す
- `bpm`：だいたいのテンポ（±5% の中で合わせ直す）
- `lo` / `hi`：主旋律を探す音域（MIDI。60 = ド）。前奏の低いリフなどは下げる
- `prior`：高い音を少し好む度合い（主旋律は上にあることが多い）。0 で好みなし
- `phase`：小節の頭の位置（0〜3）。書かなければ、ベースとコードの変わり目から決める

## 計画（plan）

`examples/mkplans_2.4.0.py` が 2.4.0 で使ったもの。
- `key`：合わせる調（`{ tonic: 0〜11, mode: 'maj' か 'min' }`）。
  部分ごとの調がちがうときは、主音か調号がそろうように移調する（同じ主音の長調・短調と、調号が1つ違うだけの近い調はそのまま）
- `segments`：並べる部分。`drums`（rock / drive / light / march）、`bpm`（テンポを変えるとき）、`oct`（旋律のオクターブ）
- 部分と部分のあいだには1小節のつなぎを入れる（前の音をのばし、次の最初の音へ音階で駆け上がる。コードは次のコードの属和音、
  テンポは次の部分へ近づける）。最後にも、最初へ戻るつなぎを入れてループする
