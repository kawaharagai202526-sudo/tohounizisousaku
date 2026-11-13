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
   `mid: true` の中ボスは、戦っているあいだ名前を出さない。`minDiff` を書くと、その難易度からボスとして出る（1面の中ボスは Hard から。Easy/Normal はザコ）
   ドット絵のない絵をゲーム中にも使うときは、`CHARA_INFO` の `dot` に同じ絵、`dotH` に高さを書く（なめらかに縮めて描く。1面の中ボス）
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
線画が黒ではなく灰色の絵は、ドット絵で顔や線が消えやすいので、`--line 150` のように線画とみなす暗さを上げる（ふだんは 85）。
まず `--preview 確認用フォルダ` を付けて仕上がりを見るとよい。

```
# 2.15.0 で使ったもの（白いキャンバスの左に灰色の帯、下のふちに線があるので、--crop で絵のまわりだけ。ドット絵の高さは前の2面ボスと同じ）
python3 tools/make-sprite.py もらった絵.jpg kuraishiro --crop 70,170,1080,1480 --dot 76   # 2面ボス 喰代 守子
# 2.10.0 で使ったもの（キャンバスにかかるボタンと絵が重ならないので、--crop だけ）
python3 tools/make-sprite.py もらった画面写真.jpg konjin --crop 118,236,962,1296 --dot 80 --line 150   # エキストラのボス 八重 神世羅（ID konjin）
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
- 全方位ワインダー `omniWinder(b, { way, every, swing, period, speed, type, color })` と、回る全方位弾 `omniRings(b, { n, every, speed, type, color })`（2.19.0）は、
  攻撃の始めに `b.tasks.add(...)` で重ねる（攻撃が終わると止まる。途中で止めるときは `b.layersOff = true`）。
  2.19.0 でユーザーの指定により、多くのスペルカードと通常攻撃に足し、指定された攻撃では自機狙いの弾（ユーザーの言葉では「追尾弾」）をなくした
- 弾の形は js/sprites.js の `BTYPES`、色は `BCOL`。2.8.0 で資料「化物屋敷異変 スペルカード・弾幕案」に合わせて
  瓦 `tile`・鬼の顔 `oni`・虫 `bug`・湯呑み `cup`・針 `needle`・札 `card`・小判 `koban`・手鞠 `temari`・足跡 `foot`・餅 `mochi`・小鬼 `kobun`・
  瓦礫 `rubble`・十二支の印 `zodiac0`〜`zodiac11` と、色 `gold`・`brown`・`soot` を足した
- 弾の絵をコードではなく画像にする試験（2.19.0）：`img/bullets.png`（`tools/make-bullets.py` で作る）。オプションの「弾の見た目」を
  「スプライト（試験）」にすると、js/sprites.js の `BULLET_SHEET` の並び（行が弾の形、列が色）で切り出して使う。画像にない弾はコードの絵のまま。
  自分で描いた絵に差しかえるときは、同じ並び・同じ大きさで描く（マスの大きさは `BTYPES` の size × 2 ピクセル。向きのある弾は右向き）
- 弾は使い回さない（2.8.0）。攻撃の中で弾を覚えておき、あとで `alive` を見て動かしたり消したりしてよい
- 1〜6面のボスとエキストラのスペルカードは、資料「化物屋敷異変 スペルカード・弾幕案」をもとにしている（2.8.0）。
  それぞれの攻撃のコメントに、資料の「弾幕」「避け方」「テーマ」を短く書いてある
- スペルカードの背景は js/backgrounds.js の `drawSpellBG`（ボスの `def.spellBg` で選ぶ）
- ステージの背景は js/backgrounds.js のクラス（1面 `VillageRoofBG`・2面 `BugHouseBG`・3面 `BackstreetBG`・4面 `RoomsBG`・5面 `CollapseBG`・6面 `RubbleSkyBG`・エキストラ `CompassRealmBG`）。
  `update()` と `draw(ctx)` を持ち、ステージの `bg` に書く。会話の `{ event }` を受けるときは `event(名前)` も書く
- ちょこっとプレイ（2.22.0）：道中の長さは js/game.js の `CHOKOTTO_ROAD`、ボス戦で省く攻撃は `CHOKOTTO_CUT`（ボスの ID ごとに、
  Normal で数えた n 回目の通常弾幕 `{ non: n }` と、スペルカードの名前の一部 `{ spell: '名前' }`）。ボスの攻撃を足したり並べかえたりしたら、ここも見なおす。
  道中を飛ばしているあいだは `G.roadSkip` が立ち、`spawnEnemy`・`fire`・`fireLaser` は何も出さない（倒れた敵・消えた弾を返す）。会話は演出の行（曲・ボスの名前・背景）だけ起こす
- 背景と弾の見分けやすさ（2.21.0）：背景（とスペルカードの背景）を描いたあと、弾を描く前に `drawBgVeil` で色をうすくして暗くする。
  強さは js/backgrounds.js の `BG_VEIL`（クラスの名前ごと）と `SPELL_BG_VEIL`（`spellBg` ごと）。背景を足したり変えたりしたら、ここに書いて、
  テスト「2.21.0：背景は暗く色がうすい」が通るようにする（明るさの平均 0.16 以下・明るいところ 0.27 以下・色の濃さ 0.34 以下など）。
  背景には、弾に似たもの（小さく明るい粒・丸い光・白い紙のかけら・金色の札・赤い花びらなど、動くものは特に）を置かない。置くならごくうすく
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

本編は全6面＋エキストラステージ。本編の6面はそろっている（2.1.0）。エキストラの面は 2.8.0 で作った（js/extra.js。ボスは八重 神世羅。ID は `konjin`）。

| もの | 場所 | ひとこと |
| --- | --- | --- |
| 本編の面の数 | js/game.js の `MAIN_STAGE_COUNT`（6） | プラクティスはこの数だけ並び、まだない面は「準備中」で選べない |
| 本編の面 | `STAGES`（js/stage1〜6.js） | 最後の面（6面）をクリアするとエンディング |
| エキストラステージ | js/game.js の `EXTRA_STAGES`（js/extra.js が足す） | 本編の面と同じ形。難易度は Extra、コンティニューはできない |
| 解放の条件 | js/game.js の `EXTRA_UNLOCK` | 2.19.0 から `open: true` で、はじめから遊べる（ユーザーの指定「ノーマルクリアしなくても、ＥＸに挑戦できるようにする」）。`open: false` にすると、Normal 以上・コンティニューなしで本編の最後（6面）をクリアしたときに解放（2.18.x まで） |
| 解放したかどうか | 保存データ `extraUnlocked` | 管理者ページのデータベースで見られる |

### 本編の面を足すとき（参考）

1. `js/stageN.js` を作り、ほかの面と同じように `STAGES.push({ name, nameEn, bg, bgm, bosses, *script(g), *boss(g) })` と書く
2. `index.html` の最後の面の次に `<script src="js/stageN.js"></script>` を足す（1ファイル版は自動で入る）
3. `js/story.js` に `STORY.stageN`、`README.md` のステージの表を書く
4. 面の数を変えるときは `MAIN_STAGE_COUNT` も直す。最後の面をクリアするとエンディングになる（`EXTRA_UNLOCK.open` が false なら、条件を満たせばエキストラが解放される）

### エキストラステージを作るとき

1. `js/extra.js` を作り、`EXTRA_STAGES.push({ name, nameEn, bg, bgm, bosses, *script(g), *boss(g) })` と書く
   （`index.html` で `game.js` より後に読む）。会話は `STORY.extra` を作って `g.talk(STORY.extra[g.charId].before)` のように使う
2. 弾の値は `dv(Easy, Normal, Hard, Lunatic, Extra)` の5つ目に書ける（書かなければ Lunatic と同じ）。
   全体の倍率は `BULLET_SPEED_SCALE` / `RING_DENSITY_SCALE` の5つ目
3. 面ができると、タイトルの「エキストラスタート」が選べるようになる（`EXTRA_UNLOCK.open` が false なら解放ずみのときだけ。キャラクター選択 → エキストラ → リザルト）
4. ボスの攻撃は `index.html?stage=extra&phase=2` か、`?boss=ボスのID` ですぐ試せる
5. エキストラのハイスコアは難易度 4（Extra）として `hi_4_自機のID` に保存される

テストの「本編6面とエキストラステージのしくみ」は、本物のエキストラの面をいったん外し、仮の面を足して、解放の条件（`open` を切って）と流れ、はじめから遊べることを確かめている。

### エキストラの方違え（凶方）

js/extra.js の `setKyou(g, 方角, { next, power })` で凶方を決める。方角は八方の番号（0 北・1 北東・2 東 … 7 北西。北が画面の上）、
`'boss'`（ボスのいる方角）、`'all'`（四方塞がり。どこへ動いても凶）、`null`（なし）。`next` は次の凶方（方位盤で予告する）。
`g.kyou` があると、毎フレーム `updateKyou` が自機の動きを見て祟り（`meter`）をため、凶方の画面の端から祟りの弾を撃つ。
画面の左下の方位盤（`drawKyouDial`）と、凶方の端の赤い光（`drawKyouEdge`）で知らせる。面が終わるとき `g.kyou = null` にする。
資料では凶方へ動くと家運ゲージも減ることになっているが、家運システムはまだ作っていない

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
  （2.4.0 の4面ボス・5面ボスの曲）。ループは曲の最後から `loopBar`（書かなければ最初）へ戻る
- 動画や音声から曲データ（MML）を作るときは `tools/song-from-audio`（手順はその中の README。自動の耳コピなので音はおおよそ）
- 入り（はじめに1回だけ流す部分）のある曲は `--intro` を付ける：はじめからループの終わりまでを流し、そのあとはループの始まり〜終わりをくり返す
  （2.18.0 の4〜6面とエキストラのボスの曲）。このときループの秒は、はじめの無音を切ったあとの秒。くり返しの部分の音が録音ごとに少しちがう曲は、
  `--xf 0.5` でつなぎ目を 0.5 秒重ねる（書かなければ 0.03 秒）。ループの終わりより後は使わないので、切ってから入れると小さくなる。
  もとの音声の終わりがフェードアウトしていて、ループの中にかかるときは `--fade 始まり,終わり`（振幅が「始まり」の 1 から「終わり」の 0 へ
  直線で下がるとして、ループの中ではその分を大きくして打ち消す。秒はループの秒と同じ。`--intro` のときだけ。2.18.1 の1面・5面の道中の曲）。
  フェードの始まりと終わりは、曲の中のくり返し（同じ部分）の1周まえとの大きさの比を測って、直線に合わせて決める。
  共有ページは 16MB までなので、大きい曲は AAC（`ffmpeg -c:a aac -b:a 80k`。モノラルなら `-ac 1`）にしなおす
- 音声ファイルをそのまま曲にするときは `node tools/embed-audio.js 曲ID ファイル [ループの終わりの秒] [ループの始まりの秒] [--intro] [--xf 秒] [--fade 始まり,終わり]`。
  `js/bgmfiles.js` に base64 で入り（file:// でも読める）、`SONGS` に `{ title, comment, audio: '曲ID', bpm }` と書けば鳴る
  （`bpm` はキーの演出が拍を合わせるのに使うだけ。`vol` で音量。ほかの曲とそろえるなら、ならした大きさ（RMS）が 0.15 くらいになるように）。
  鳴らすときに前後の無音を自動で切り、つなぎ目を 0.03 秒重ねてループする（`makeLoopBuffer`）。動画（mp4）の音声は
  `ffmpeg -i 動画.mp4 -vn -c:a copy 音声.m4a` で変換せずに取り出せる。
  デコードしたものはメモリを使うので最近の3曲だけ覚えておく。MML の曲は `BGM_LOOKAHEAD`（1 秒）先まで予約する（2.19.1。短いと、重くて処理が止まったときに音が抜ける）。ボスの曲は、その面が始まったときに先にデコードしておく（`Sound.prefetch`）。
  音声は1ファイル版にもそのまま入るので、大きいほど dist が重くなる。
  消すときは `node tools/embed-audio.js --remove 曲ID`
- 曲を使う場所：ステージの `bgm`、`bosses` の `bgm`、会話の `{ bgm }`、タイトルは `'title'`
- 難易度でちがう曲にするときは、もとの曲に `byDiff: { 難易度: '曲ID' }`（0=Easy〜3=Lunatic）。ゲーム中は `songForDiff(曲ID)` で選ぶ
  （2.9.0〜2.17.x の6面ボスは、Lunatic のとき別の曲だった。いまは使っていない）。ミュージックルームでは選ばれないので、両方を `MUSIC_ROOM` に入れる
- ミュージックルームの並びは `MUSIC_ROOM`

## 効果音

- 2.17.0 から、効果音の多くは、ユーザーがくれた音（`audio/a-o` の a〜o。一覧は `audio/README.md`）をそのまま鳴らす。
  ほかの音（アイテム・敵を倒した音・メニューの音など）は、前のとおり `js/audio.js` の `SE_DEFS` で合成する
- グレイズの音（2.19.0）：アイテムの「カッ」（`SE_DEFS.item`）と同じ音を `GRAZE_SE.base`（0.8）倍で鳴らす。重なったグレイズが多いほど大きい
  （1つ増えるごとに `GRAZE_SE.step`（+30%）、`GRAZE_SE.max`（2倍）まで。`Sound.playGraze`）
- BGM の大きさ：`BGM_BUS_LEVEL`（0.21）をオプションの BGM 音量にかける（2.19.0〜）
- 効果音の大きさ（2.20.1 でユーザーの指定）：BGM の大きさ（曲のならした大きさ `BGM_LOUD` 0.133 × `BGM_BUS_LEVEL`）を 1 として、
  効果音のいちばん大きいところ（50ms の RMS）を `SE_TO_BGM`（0.8）にそろえる。音の文字ごとの例外は `SE_TO_BGM_BY`（いまは c・k・o・f が 1.3）。
  もらった音は `norm` で -14dB にそろえてあるので計算で決まる。合成音は測った大きさ `SE_SYNTH_PEAK` を使う（合成音を作ったり変えたりしたら、
  測って書き足す。書いていない合成音は 0.03 とみなす）。実際に鳴らして測るテストがある（「2.20.1：BGM を 1 として…」）。
  曲を足して大きさが変わったら `BGM_LOUD` も見なおす
- どの場面でどの音を鳴らすか：コードでは名前で `Sound.se('名前')` と書き、名前と音の文字の対応は `js/audio.js` の `SE_SAMPLE`
  （`名前: [音の文字, 重ねて鳴らせる数]`）。たとえば「弾を撃つ音を o にする」なら `fire: ['o', …]` にするだけ。
  いまの対応：`fire`（弾）m、`needle`（針）n、`oni`（1面の鬼面）k、`burst`（弾ける・散らばる。6面・2面「軒下の誘蛾灯」）k、`spread`（6面の惹きつけた弾が開く）f、`appear`（出てくる）o、
  `charge`（チャージ・1面のレーザーの点滅・3面「勝手口からお暇」）c、`laserHand`（手・柱のレーザー・5面の道中の落ちてくる梁）h、`laserBoss4`（4面のボスのレーザー・エキストラの方位盤の光線）f、
  `summon`（4面の四角）g、`bonus` a、`spell` b、`bossdie` d、`extend` e、`bomb` i、`pichuun` j
- 大きさは上の「効果音の大きさ」の決まりで決まる。ある場面の音だけ大きさを変えたいときは、名前ごとの倍率 `SE_NAME_MUL` に書く（もらった音にも合成音にも使える。いまはアイテム・敵を倒した音・自機の弾が 0.7。2.20.5）。
  同じ音は1フレームに1回、`SE_GAP` の秒数より短い間隔では鳴らさない
- 弾の音：`fire()` はふつう `fire`（m）を鳴らす。`se: '名前'` で音を選び、`silent: true` で鳴らさない（同時に撃つ弾は1つだけ鳴らす）。
  弱くて数の多いザコ（体力が `QUIET_HP`＝18 より少ない。js/enemies.js）が撃つ弾は鳴らさない（`spawnEnemy` の `quiet` で決めることもできる）
- レーザーの音：`fireLaser` の `sound`（光るとき。書かなければ合成音の `'laser'`）と `warnSound`（予告の線が出たとき）
- 音を差しかえたら `node tools/embed-se.js` で `js/sefiles.js` を作り直す（ffmpeg でモノラルの AAC にして埋めこむ。使わない文字は入れない）。
  埋めこむ前に音の調整をかけたい音は、`tools/embed-se.js` の `SE_EQ` に ffmpeg の `-af` を書く（いまは o：低すぎて小さなスピーカーで鳴らないので、500Hz より上を +12dB。2.20.5）。
  もらった音がまだデコードできていないあいだは、`SE_FALLBACK` の合成音で代わりに鳴らす

## 古い内容を消すとき

- 使わなくなったキャラクターは `CHARA_INFO`・`CHARA`・`IMAGE_FILES` と `img/` の画像を消す
- 使わなくなった曲は `SONGS` と `MUSIC_ROOM` から消す
- 消したIDがどこかに残っていると、データのテストが知らせる（会話の話者、曲のID、ボスのIDなど）
- 管理者ページ（js/admin.js）・キー（js/cheats.js）は中身の入れかえと関係なく動く
