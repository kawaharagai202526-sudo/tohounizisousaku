# 東方星降夜 開発メモ（Claude 用）

東方Projectの二次創作弾幕シューティング。ブラウザだけで動く（サーバー・ビルド不要）。
遊び方や改造の基本は README.md、変更の記録は CHANGELOG.md を見ること。

- ユーザーは日本語で話す。返事・コミットメッセージ・コード中のコメント・画面の文字は日本語。
- 作業ブランチにコミットしてプッシュする。プルリクエストは頼まれたときだけ作る。

## 変更したら必ずやること

1. `node tools/test.js` … ブラウザで実際に動かすテスト（30秒ほど）。大きな変更なら `--full` も（全面の自動クリア）
2. `node tools/build-single.js` … 1ファイル版 `dist/hoshifuru.html` を作り直す（テストは dist が古いと失敗する）
3. `dist/` も含めてコミットする
4. 共有ページ（https://claude.ai/artifact/3qirwPi7rszo3v572hnNEV ）も更新する。
   dist から `<!DOCTYPE>`・`<html>`・`<head>`・`<body>`・`<meta>` を外したファイルを、同じパスで公開し直す

大きな変更を始める前にも `node tools/test.js` を実行し、すべて成功する状態から始めること。

## 構成の決まり

- `index.html` が `js/*.js` を**普通の `<script>`（モジュールではない）**で順番に読む。
  すべてのファイルは同じグローバルの名前空間を共有する。
  - ファイルの一番外側の `const` / `class` はほかのファイルから名前で使えるが、`window.〜` にはならない
  - 読み込み順が効くのは「読み込んだ瞬間に動くコード」だけ。関数の中から呼ぶものは順番に関係ない
  - ファイルを増やしたら `index.html` に `<script src>` を足す（`tools/build-single.js` は自動で埋め込む）
- ES モジュール・npm のライブラリ・外部の画像や音声ファイルは使わない（`file://` で直接開いても動くようにするため）。
  音楽・効果音・ほとんどの絵はコードで作っている。差し替え用の画像だけ `img/` に置く
- 論理画面は 640×480、弾幕のフィールドは 384×448（左上が (32,16)）。60fps 固定で更新する
- `localStorage` は必ず `Store`（js/util.js）を通す。キーには `hoshifuru.` が付く

## 主な仕組み

| もの | 場所 | ひとこと |
| --- | --- | --- |
| メインループ | js/main.js `Game` | `update()`（1/60秒ごと）と `draw()`。画面は `Game.setScene(シーン)` で切り替える |
| シーン | menus.js / game.js / accounts.js | `update()`・`draw(ctx)` と、あれば `enter()`・`exit()` を持つクラス |
| ゲーム本編 | js/game.js `GameScene` | 当たり判定・スコア・ボス戦。実行中のものはグローバル変数 `G` |
| ステージ | js/stage1〜4.js | `STAGES.push({ name, nameEn, bg, bgm, bosses, *script(g), *boss(g) })`。`script` は道中、`boss` はボス戦 |
| コルーチン | js/util.js `TaskRunner` | ジェネレータ関数で書き、`yield n` で n フレーム待つ |
| ボス | game.js `spawnBoss` / `fight` / `bossDown` | 攻撃は `{ type: 'non' か 'spell', name, hp, time, survival, minDiff, *script(b, g) }` の配列 |
| 弾 | js/bullets.js | `fire` / `fireRing` / `fireFan`。難易度ごとの値は `dv(Easy, Normal, Hard, Lunatic)` |
| キャラクターの絵 | js/characters.js | `CHARA_INFO`（名前・肩書き・画像）、`drawChibi`（キャンバスで描く絵） |
| 画像 | js/images.js `IMAGE_FILES` | `img/` のPNG。読み込み前は `Images.get()` が null なので、描く側で代わりを用意する |
| 会話・エンディング | js/story.js | `STORY.stageN[キャラ].before / after`、`ENDINGS` |
| 曲 | js/music.js | `SONGS`（MML とコード進行）、`MUSIC_ROOM` |
| アカウント・ランキング | js/accounts.js | `Accounts`（保存）、`AccountDialog`（HTMLの画面）、`RankingScene` |
| 管理者ページ | js/admin.js | 画面左上の隠しボタン → PIN → キー入力 → 管理者ページ |
| キー（特別な機能） | js/cheats.js | `CHEAT_KEYS`（キーの一覧と説明）、`Cheats.on`、`Party`（キーの演出の一つ） |

### 保存データ（localStorage、頭に `hoshifuru.` が付く）

`hi_{難易度}_{キャラ}`（ハイスコア）、`spells`（スペルカード履歴）、`lives` `bgmVol` `seVol` `muted` `lastDiff` `lastChar`（設定）、
`accounts` `currentUser`（アカウント）、`adminLock` `adminFails`（管理者ページのPIN）、`saveVersion`（保存データの形式）。

保存データの形を変えるときは、`js/util.js` の `SAVE_VERSION` を上げて `migrateSave()` に古い形からの変換を書く。
変換しないと、前の版で遊んでいた人のスコアやアカウントが読めなくなる。

## 何かを足すときに一緒に直すところ

- **ステージ・ボス**：`STAGES` の `bosses`（管理者ページの一覧とテストが使う）、`STORY`、`README.md` のステージ表
- **キャラクター**：`CHARA_INFO`、管理者ページの `showCharacters()` の一覧
- **画像**：`img/` に置いて `IMAGE_FILES` に登録（背景は透明にする）。README の画像の一覧
- **キー**：`CHEAT_KEYS` に足す（管理者ページのデータベースの一覧に自動で出る）。テストの「キーの効果」
- **版を上げるとき**：`js/util.js` の `GAME_VERSION` と `package.json` の `version` を同じにする（テストで確かめている）。
  `CHANGELOG.md` にも書く

## ユーザーが決めたこと（変えるときは確認する）

- 霊夢はゲーム中は `img/player.png`（小さいドット絵）。キャラクター選択の霊夢は自機に合わせて青
- 魔理沙のマスタースパークの範囲は紅魔郷基準（上へ扇状に広がる）
- 3面・4面のボスと3面中ボスは、ゲーム中はドット絵、スペルカードのカットインと会話は原画（ドット絵にしない）
- 3面ボスは「羊宮 ラム」、4面ボスは「瑠璃」。4面の中ボスはスターサファイア
- 道中の大きな星の弾は使わない（スペルカードは別）。かわりに一撃で倒せる回転する星の敵を出す
- 全体の難易度は低め。Hard と Lunatic（特に Lunatic）と4面は高め
- マウスでは自機を操作できない（メニューのクリックはできる）。管理者ページのキーで許可したときだけ操作できる
- 管理者ページ：PIN は 114514、3回まちがえると5分間入力できない
- **キーについての表記は管理者ページの中だけ**。キー入力画面にも説明は出さず（ON/OFFと文字だけ）、一覧はデータベースにだけ出す。
  タイトル・ゲーム中・リザルトなどには、キーを使ったことも理由も出さない。README などの文書にもキーの一覧や説明は書かない
  （説明はコードの `CHEAT_KEYS` にだけある）
- ランキングに載らない（スコアも保存しない）のは：キーを使ったプレイ、コンティニューしたプレイ、プラクティス、ログインしていないプレイ
- ユーザーが「5面」と言ったときは4面（最後の面）のことだった

## まだできていないこと

- 3面の会話（ボス戦の前後）、3面中ボスの名前（いまは「？？？」）
- 3面・4面のスペルカード名と曲名は仮
- エンディングの文章はまだ4面（瑠璃）の内容に合わせていない（スターサファイアの話のまま）
