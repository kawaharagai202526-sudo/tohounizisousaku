# 差し替えガイド（ストーリー・キャラクター・弾幕・背景・自機・音楽・名前）

大規模な変更で入れかえる予定のものについて、「どこを書きかえればよいか」と「どう確かめるか」をまとめたもの。
ゲームのしくみ（当たり判定・スコア・メニュー・管理者ページなど）はそのまま使い、中身だけを入れかえる想定。

変更したら `node tools/test.js` を実行する。データの書き忘れ（会話の話者がいない、曲のIDがまちがっている、
自機のエンディングがない、など）は「ストーリー・曲・キャラクターのデータがそろっている」のテストが見つける。

## 変えないもの（基本スタイル）

ユーザーの希望で、遊んだときの手ざわりは今のままにする。変えるときはユーザーに確認する。

| もの | 今の値 | 場所 |
| --- | --- | --- |
| 画面 | 640×480、弾幕のフィールド 384×448（左上 (32,16)）、右側に情報のパネル | js/util.js、js/hud.js |
| 自機の大きさ | 画像の自機は高さ30px、図形で描く自機は0.65倍 | `PLAYER_TYPES` の `sprite`、`drawPlayerSprite` |
| 当たり判定・グレイズ | 半径 2.2〜2.4（自機ごと）、グレイズは半径20 | `PLAYER_TYPES` の `hitR`、`Player.grazeR` |
| 移動の速さ | 高速 4.5〜5.0、低速 2.0〜2.2 | `PLAYER_TYPES` の `speed` / `focusSpeed` |
| オプションの位置 | 霊力に応じて1〜4個 | js/player.js の `OPT_LAYOUT` |
| 弾の種類と大きさ | small / ball / large / rice / kunai など | js/sprites.js の `BTYPES` |
| 操作・システム | 低速移動、ボム、喰らいボム、グレイズ、アイテム自動回収、エクステンド | js/player.js、js/game.js |
| 難易度の倍率 | 弾の速さ・全方位弾の数 | js/bullets.js の `BULLET_SPEED_SCALE` / `RING_DENSITY_SCALE` |

## 名前（ゲームの名前）

- `js/util.js` の `GAME_INFO`（`title` 名前、`subtitle` 英語の副題、`genre` タイトル上の小さな文字）。
  タイトル画面・ゲーム中の右下のロゴ・ブラウザのタブはここから出る
- ほかに同じ名前が書いてあるところ：`index.html` の `<title>`（読み込み中に一瞬出る）、`README.md`、
  `package.json` の `description`、`CLAUDE.md`、`CHANGELOG.md`
- ステージの名前は各ステージの `name` / `nameEn`、キャラクターの名前は `CHARA_INFO`、
  スペルカードの名前はボスの攻撃の `name`、曲名は `SONGS` の `title`

## メインメニューの背景

- `js/menubg.js` の `MenuBG` を書きかえる。`update()`（毎フレーム）と `draw(ctx)`（640×480 全体を塗る）があればよい
- タイトル・難易度選択・キャラクター選択・ミュージックルーム・エンディング・リザルトがこの背景を共有する
- タイトルの文字やメニューの位置は `js/menus.js` の `TitleScene.draw`。背景の明るさを変えたら、文字が読めるか確かめる
- いま（2.2.0）は、青空と古びた人里の家々、その向こうにそびえたつ屋敷の影。
  タイトルの文字とメニューが屋敷の影の上に来るようにして、画面の下（操作の説明）は手前の暗い家並みの上にしてある

## 自機

1. `js/player.js` の `PLAYER_TYPES` に1人分を書く（書く項目はファイルの先頭のコメントにある）。
   並び順がキャラクター選択の順になる。ショットは `shoot(p, g, f)`、ボムは `makeBomb(p)` で作るクラス
   （`FantasySeal` / `MasterSpark` が例）
2. `js/characters.js` の `CHARA_INFO` に名前・肩書き・色を書く。
   絵は `CHARA`（キャンバスで描くちびキャラ）か、画像（`image`）。
   `PLAYER_TYPES` の `portrait` に書いたキャラクターの絵が、キャラクター選択・ボムのカットイン・エンディングに出る
   （会話は `CHARA_INFO` の同じIDの絵）。いまは霊夢・魔理沙とも原画（`img/reimu.png` / `img/marisa.png`）
3. ゲーム中の絵を画像にするなら `sprite: { image: 'キー', h: 30, ax: 0.5, ay: 0.5 }`（高さ30pxは変えない）。
   `ax` / `ay` は当たり判定の中心が絵のどこに来るか（0〜1の割合）
4. `js/story.js` の `STORY` の全ステージと `ENDINGS` に、その自機の分を書く（テストが書き忘れを見つける）
5. 自機の人数が2人でなくなると、キャラクター選択の枠の幅が変わる（`charaPanelRect`）。中の文字の配置を確かめる

自機のIDを変えると、前のIDのハイスコア（`hi_難易度_ID`）は使われなくなる。
古い記録を消すかどうかはユーザーに確認し、消すなら `SAVE_VERSION` を上げて `migrateSave()` に書く。

## キャラクター（ボス・中ボス）

1. `CHARA_INFO` に名前・読み仮名（`kana`）・肩書き・色を書く。読み仮名はボスの名前が出るときと、会話でそのキャラクターが最初に話すとき（登場したとき）だけ出る
   （名前が決まっているボスには必ず書く。テストが書き忘れを見つける）。
   会話・カットインの絵を小さくしたいときは `portraitScale`（例：座敷は 0.8）。ゲーム中の大きさはドット絵の高さで決まる。
   全員の大きさは、会話が `DIALOGUE_PORTRAIT_SCALE`（js/dialogue.js）、カットインが `CUTIN_SCALE`（js/hud.js）
2. 絵を用意する
   - キャンバスで描くちびキャラなら `CHARA` に色や髪形を書く（既存のキャラクターをまねる）
   - 画像なら `tools/make-sprite.py` で原画（`img/<名前>.png`）とドット絵（`img/<名前>_dot.png`）を作り、
     `js/images.js` の `IMAGE_FILES` に登録して、`CHARA_INFO` に `image` と `dot` を書く。
     ゲーム中はドット絵、スペルカードのカットインと会話は原画を使う
   ```
   python3 tools/make-sprite.py もらった画像.jpg boss5 --dot 78 --preview 確認用フォルダ
   ```
3. ステージの `bosses` に `{ id, phases, mid, bgm, def }` を書く（`def` はスペルカードの背景 `spellBg`・魔法陣の色 `circleColor` など）。
   `mid: true` の中ボスは、戦っているあいだ名前を出さない
4. ステージの `boss(g)`（中ボスは `script(g)` の中）で `g.spawnStageBoss('ID', { x, y })` → `g.fight(boss, 攻撃)` → `g.bossDown(boss)`
5. 同じキャラクターが何度も出るときは、出る面ごとに `CHARA_INFO` に別のIDを作る
   （例：家鳴は5面中ボス `yanariMid`・5面ボス `yanari`・6面中ボス `yanari6`）。ボスの攻撃を試す機能がIDで面を探すため
6. 前に作った絵を使い回すときは、`IMAGE_FILES` に別のキーで同じファイルを書けばよい（例：2面中ボス `ruri` は `img/boss4.png`）

管理者ページの「キャラクター一覧」には、自機は `PLAYER_TYPES`、ボスは `bosses` から自動で並ぶ。
ザコの一覧は `js/admin.js` の `showCharacters()` に手で書いてある。

### お絵かきアプリの画面写真から作るとき

アプリのボタンや広告が絵の上にかかっているときは、`--crop` で絵のまわりだけを使い、
キャンバスの上にかかっているボタンは `--mask` で白くぬりつぶす（座標は元の画像のもの）。
胸から上の絵のように、絵が画面のふちで切れているときは `--fade` でふちをなめらかに透明にする。
まず `--preview 確認用フォルダ` を付けて仕上がりを見るとよい。

```
# 2.1.0〜2.2.0 で使ったもの（4面中ボスの絵は、2.1.0 では3面中ボス `midboss3b` だった）
python3 tools/make-sprite.py 23.jpg zashiki --crop 0,0,1050,1337 --fade 30 --dot 60                         # 6面ボス（座敷わらしなので小さく）
python3 tools/make-sprite.py 24.jpg midboss4 --crop 330,320,780,1410 --mask 645,1290,1067,1440 --dot 74   # 4面中ボス
# 2.0.0 で使ったもの（ボス）
python3 tools/make-sprite.py 22.jpg nokiba --crop 125,136,942,1313 --mask 720,980,945,1240 --mask 395,185,460,255 --dot 76
python3 tools/make-sprite.py 21.jpg kuraishiro --crop 150,200,830,1295 --mask 630,160,780,226 --fade 60 --dot 76
python3 tools/make-sprite.py 19.jpg namesawa --crop 300,440,640,1150 --dot 78
python3 tools/make-sprite.py 18.jpg toganoo --fade 40 --dot 76
python3 tools/make-sprite.py 20.jpg yanari --crop 280,222,882,1380 --mask 645,255,890,305 --fade 50 --dot 80
# 1.3.0 で使ったもの
python3 tools/make-sprite.py 13.jpg marisa_player --crop 125,136,942,1313 --art 96 --dot 0       # ゲーム中の魔理沙（小さい絵）
python3 tools/make-sprite.py 14.jpg marisa --crop 95,158,943,1330 --mask 630,158,780,228 --mask 645,1290,943,1330 --dot 0
python3 tools/make-sprite.py 15.jpg hand_eye --crop 125,136,942,1313 --art 100 --dot 0            # ザコ
python3 tools/make-sprite.py 16.jpg midboss2 --crop 78,230,940,1296 --fade 70 --dot 70             # 中ボス（原画とドット絵）
python3 tools/make-sprite.py 17.jpg reimu --crop 125,136,942,1313 --dot 0
```

## ザコの見た目

- ザコの絵は `js/enemies.js` の `Enemy.draw` にある（`kind` ごと）。画像なら `drawImageSprite(ctx, '画像のキー', 高さ)`
- 面のデータに `zako: '種類'` を書くと、その面の妖精（`fairy`）と緑の手（`hand`）がその種類の絵になる。
  いまは3〜5面が `zako: 'handEye'`（一つ目の手）。足の妖精・大妖精・毛玉・虫などはそのまま
- 新しい種類を足したら、Lunatic の撃ち返し弾を出すかどうか（`js/game.js` の `REVENGE_KINDS`）と、
  管理者ページのザコの一覧（`showCharacters()`）も直す

## 弾幕

- ボスの攻撃は、各ステージのファイルにある `〜_PHASES` の配列。1つの攻撃は
  `{ type: 'non' か 'spell', name, hp, time, survival, minDiff, *script(b, g) }`
  - `type: 'spell'` がスペルカード（名前とカットインが出る）、`survival: true` は時間切れまで耐える攻撃
  - `minDiff` を付けると、その難易度以上だけに出る（例：`minDiff: 2` は Hard と Lunatic）
- 弾は `fire` / `fireRing` / `fireFan`（js/bullets.js）。難易度ごとの値は `dv(Easy, Normal, Hard, Lunatic)`
- スペルカードの背景は js/backgrounds.js の `drawSpellBG`（ボスの `def.spellBg` で選ぶ）
- ステージの背景は js/backgrounds.js のクラス（1面 `VillageRoofBG`・2面 `BugHouseBG`・3面 `BackstreetBG`・4面 `RoomsBG`・5面 `CollapseBG`）。
  `update()` と `draw(ctx)` を持ち、ステージの `bg` に書く。会話の `{ event }` を受けるときは `event(名前)` も書く
- 道中の敵の出し方は各ステージの `script(g)`。`yield n` で n フレーム待つ

### 攻撃をすぐ試す

URL のうしろに付けて開くと、会話なしでそのボスの攻撃から始まる（プラクティス扱いで、記録は残らない）。

```
index.html?boss=toganoo&phase=3&diff=3&char=marisa
index.html?stage=2&phase=1&only=1
```

| 項目 | 意味 |
| --- | --- |
| `boss` | ボスのID（`bosses` の `id`）。中ボスも指定できる |
| `stage` | 面（1〜）。`boss` を書かないときは、その面のボス |
| `phase` | 何番目の攻撃から始めるか（1〜）。その難易度で出る攻撃だけを数える |
| `diff` | 難易度 0〜3（Easy〜Lunatic）。書かないと Normal |
| `char` | 自機のID。書かないと最初の自機 |
| `only` | `1` ならその攻撃だけで終わる |

テストの「ボスの攻撃をひとつずつ動かせる」は、すべてのボスの攻撃を Lunatic で1つずつ動かして、エラーが出ないか確かめる。

## 面の数とエキストラステージ

本編は全6面＋エキストラステージ。本編の6面はそろっている（2.1.0）。エキストラのしくみはあるが、面はまだない。

| もの | 場所 | ひとこと |
| --- | --- | --- |
| 本編の面の数 | js/game.js の `MAIN_STAGE_COUNT`（6） | プラクティスはこの数だけ並び、まだない面は「準備中」で選べない |
| 本編の面 | `STAGES`（js/stage1〜6.js） | 最後の面（6面）をクリアするとエンディング |
| エキストラステージ | js/game.js の `EXTRA_STAGES`（いまは空） | 本編の面と同じ形。難易度は Extra、コンティニューはできない |
| 解放の条件 | js/game.js の `EXTRA_UNLOCK` | いまは Normal 以上・コンティニューなしで、本編の最後（6面）をクリア |
| 解放したかどうか | 保存データ `extraUnlocked` | 管理者ページのデータベースで見られる |

### 本編の面を足すとき（参考）

1. `js/stageN.js` を作り、ほかの面と同じように `STAGES.push({ name, nameEn, bg, bgm, bosses, *script(g), *boss(g) })` と書く
2. `index.html` の最後の面の次に `<script src="js/stageN.js"></script>` を足す（1ファイル版は自動で入る）
3. `js/story.js` に `STORY.stageN`、`README.md` のステージの表を書く
4. 面の数を変えるときは `MAIN_STAGE_COUNT` も直す。最後の面をクリアするとエンディングになり、条件を満たせばエキストラが解放される

### エキストラステージを作るとき

1. `js/extra.js` を作り、`EXTRA_STAGES.push({ name, nameEn, bg, bgm, bosses, *script(g), *boss(g) })` と書く
   （`index.html` で `game.js` より後に読む）。会話は `STORY.extra` を作って `g.talk(STORY.extra[g.charId].before)` のように使う
2. 弾の値は `dv(Easy, Normal, Hard, Lunatic, Extra)` の5つ目に書ける（書かなければ Lunatic と同じ）。
   全体の倍率は `BULLET_SPEED_SCALE` / `RING_DENSITY_SCALE` の5つ目
3. 面ができると、タイトルの「エキストラスタート」が解放ずみのときだけ選べるようになる（キャラクター選択 → エキストラ → リザルト）
4. ボスの攻撃は `index.html?stage=extra&phase=2` か、`?boss=ボスのID` ですぐ試せる
5. エキストラのハイスコアは難易度 4（Extra）として `hi_4_自機のID` に保存される

テストの「本編6面とエキストラステージのしくみ」は、まだない面（いまは6面）とエキストラを仮に足して、解放の条件と流れを確かめている。

## ストーリー

- `js/story.js`
  - `INTRO_TEXT`：「操作説明とお話」に出るあらすじ
  - `STORY.stageN[自機のID].before / after`：ボス戦の前と後の会話。1行は `[話者のID, 表情, 台詞]`。
    表情は normal / happy / angry / surprised / sad / smug。
    `{ bgm: '曲ID' }` でその場で曲が変わり、`{ title: 'キャラID' }` でボスの名前が出る。
    `{ narration: '文' }` は話者のいないト書き、`{ event: '名前' }` は背景の `event(名前)` を呼ぶ（3面の `'mansion'` で屋敷が姿を現す）
  - 中ボスの前後の会話は `STORY.stage3mid` のように別に作り、ステージの `script(g)` の中で `g.talk(...)` する
  - `ENDINGS[自機のID]`：エンディングの題名とページ。`guest` で右側にほかのキャラクターを出せる
- 会話を流すのは各ステージの `boss(g)` の中の `g.talk(...)`
- 話者は `CHARA_INFO` にいる必要がある（名前と絵を使う）

## 音楽

- `js/music.js` の `SONGS`。1曲は `{ title, comment, bpm, lead, chords, melody, backing }`。
  メロディは MML（`o5 e4. d8 c4 |` のように書く。`|` は小節線で、長さのずれをテストが見つける）
- 曲の途中でテンポとドラムを変えるときは `parts: [{ bar: 何小節目から, bpm, drums, ramp: 前の何小節で次のテンポへ近づけるか }]`
  （2.4.0 の4面ボス・5面ボス・6面・6面ボスの曲）。ループは曲の最後から `loopBar`（書かなければ最初）へ戻る
- 動画や音声から曲データ（MML）を作るときは `tools/song-from-audio`（手順はその中の README。自動の耳コピなので音はおおよそ）
- 音声ファイルをそのまま曲にするときは `node tools/embed-audio.js 曲ID ファイル [ループの終わりの秒] [ループの始まりの秒]`。
  `js/bgmfiles.js` に base64 で入り（file:// でも読める）、`SONGS` に `{ title, comment, audio: '曲ID', bpm }` と書けば鳴る
  （`bpm` はキーの演出が拍を合わせるのに使うだけ。`vol` で音量。ほかの曲とそろえるなら、ならした大きさ（RMS）が 0.15 くらいになるように）。
  鳴らすときに前後の無音を自動で切り、つなぎ目を 0.03 秒重ねてループする（`makeLoopBuffer`）。動画（mp4）の音声は
  `ffmpeg -i 動画.mp4 -vn -c:a copy 音声.m4a` で変換せずに取り出せる。
  デコードしたものはメモリを使うので最近の3曲だけ覚えておく。ボスの曲は、その面が始まったときに先にデコードしておく（`Sound.prefetch`）。
  音声は1ファイル版にもそのまま入るので、大きいほど dist が重くなる。
  消すときは `node tools/embed-audio.js --remove 曲ID`
- 曲を使う場所：ステージの `bgm`、`bosses` の `bgm`、会話の `{ bgm }`、タイトルは `'title'`
- ミュージックルームの並びは `MUSIC_ROOM`

## 古い内容を消すとき

- 使わなくなったキャラクターは `CHARA_INFO`・`CHARA`・`IMAGE_FILES` と `img/` の画像を消す
- 使わなくなった曲は `SONGS` と `MUSIC_ROOM` から消す
- 消したIDがどこかに残っていると、データのテストが知らせる（会話の話者、曲のID、ボスのIDなど）
- 管理者ページ（js/admin.js）・キー（js/cheats.js）は中身の入れかえと関係なく動く
