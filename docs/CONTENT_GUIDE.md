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
- タイトル・難易度選択・キャラクター選択・ランキング・ミュージックルーム・エンディング・リザルトがこの背景を共有する
- タイトルの文字やメニューの位置は `js/menus.js` の `TitleScene.draw`。背景の明るさを変えたら、文字が読めるか確かめる

## 自機

1. `js/player.js` の `PLAYER_TYPES` に1人分を書く（書く項目はファイルの先頭のコメントにある）。
   並び順がキャラクター選択の順になる。ショットは `shoot(p, g, f)`、ボムは `makeBomb(p)` で作るクラス
   （`FantasySeal` / `MasterSpark` が例）
2. `js/characters.js` の `CHARA_INFO` に名前・肩書き・色を書く。
   絵は `CHARA`（キャンバスで描くちびキャラ）か、画像（`image` / `dot`）。キャラクター選択の絵は `portrait` で選べる
3. ゲーム中の絵を画像にするなら `sprite: { image: 'キー', h: 30, ax: 0.5, ay: 0.5 }`（高さ30pxは変えない）
4. `js/story.js` の `STORY` の全ステージと `ENDINGS` に、その自機の分を書く（テストが書き忘れを見つける）
5. 自機の人数が2人でなくなると、キャラクター選択の枠の幅が変わる（`charaPanelRect`）。中の文字の配置を確かめる

自機のIDを変えると、前のIDのハイスコア（`hi_難易度_ID`）は使われなくなる。
ランキングの記録には当時のキャラクター名（`charName`）も残してあるので、IDが変わっても表示はくずれない。
古い記録を消すかどうかはユーザーに確認し、消すなら `SAVE_VERSION` を上げて `migrateSave()` に書く。

## キャラクター（ボス・中ボス）

1. `CHARA_INFO` に名前・肩書き・色を書く
2. 絵を用意する
   - キャンバスで描くちびキャラなら `CHARA` に色や髪形を書く（既存のキャラクターをまねる）
   - 画像なら `tools/make-sprite.py` で原画（`img/<名前>.png`）とドット絵（`img/<名前>_dot.png`）を作り、
     `js/images.js` の `IMAGE_FILES` に登録して、`CHARA_INFO` に `image` と `dot` を書く。
     ゲーム中はドット絵、スペルカードのカットインと会話は原画を使う
   ```
   python3 tools/make-sprite.py もらった画像.jpg boss5 --dot 78 --preview 確認用フォルダ
   ```
3. ステージの `bosses` に `{ id, phases, mid, bgm, def }` を書く（`def` はスペルカードの背景 `spellBg`・魔法陣の色 `circleColor` など）
4. ステージの `boss(g)`（中ボスは `script(g)` の中）で `g.spawnStageBoss('ID', { x, y })` → `g.fight(boss, 攻撃)` → `g.bossDown(boss)`

管理者ページの「キャラクター一覧」には、自機は `PLAYER_TYPES`、ボスは `bosses` から自動で並ぶ。
ザコの一覧は `js/admin.js` の `showCharacters()` に手で書いてある。

## 弾幕

- ボスの攻撃は、各ステージのファイルにある `〜_PHASES` の配列。1つの攻撃は
  `{ type: 'non' か 'spell', name, hp, time, survival, minDiff, *script(b, g) }`
  - `type: 'spell'` がスペルカード（名前とカットインが出る）、`survival: true` は時間切れまで耐える攻撃
  - `minDiff` を付けると、その難易度以上だけに出る（例：`minDiff: 2` は Hard と Lunatic）
- 弾は `fire` / `fireRing` / `fireFan`（js/bullets.js）。難易度ごとの値は `dv(Easy, Normal, Hard, Lunatic)`
- スペルカードの背景は js/backgrounds.js の `drawSpellBG`（ボスの `def.spellBg` で選ぶ）
- 道中の敵の出し方は各ステージの `script(g)`。`yield n` で n フレーム待つ

### 攻撃をすぐ試す

URL のうしろに付けて開くと、会話なしでそのボスの攻撃から始まる（プラクティス扱いで、記録は残らない）。

```
index.html?boss=boss4&phase=3&diff=3&char=marisa
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

## ストーリー

- `js/story.js`
  - `INTRO_TEXT`：「操作説明とお話」に出るあらすじ
  - `STORY.stageN[自機のID].before / after`：ボス戦の前と後の会話。1行は `[話者のID, 表情, 台詞]`。
    表情は normal / happy / angry / surprised / sad / smug。
    `{ bgm: '曲ID' }` でその場で曲が変わり、`{ title: 'キャラID' }` でボスの名前が出る
  - `ENDINGS[自機のID]`：エンディングの題名とページ。`guest` で右側にほかのキャラクターを出せる
- 会話を流すのは各ステージの `boss(g)` の中の `g.talk(...)`
- 話者は `CHARA_INFO` にいる必要がある（名前と絵を使う）

## 音楽

- `js/music.js` の `SONGS`。1曲は `{ title, comment, bpm, lead, chords, melody, backing }`。
  メロディは MML（`o5 e4. d8 c4 |` のように書く。`|` は小節線で、長さのずれをテストが見つける）
- 曲を使う場所：ステージの `bgm`、`bosses` の `bgm`、会話の `{ bgm }`、タイトルは `'title'`
- ミュージックルームの並びは `MUSIC_ROOM`

## 古い内容を消すとき

- 使わなくなったキャラクターは `CHARA_INFO`・`CHARA`・`IMAGE_FILES` と `img/` の画像を消す
- 使わなくなった曲は `SONGS` と `MUSIC_ROOM` から消す
- 消したIDがどこかに残っていると、データのテストが知らせる（会話の話者、曲のID、ボスのIDなど）
- 管理者ページ（js/admin.js）・アカウント（js/accounts.js）・キー（js/cheats.js）は中身の入れかえと関係なく動く
