# 動画書き出しツール

各デモ（オフライン版 HTML）を1フレームずつ描画して MP4 に書き出します。音声（ドローン・風・砲声）もオフラインで合成して入れます。

```sh
npm i playwright            # Chromium が必要
node tools/render-video.mjs waterloo/waterloo-offline.html waterloo.mp4 24 video
```

引数：`<HTML> <出力.mp4> [fps=24] [画質 video|low|std|high] [開始秒] [終了秒]`（開始・終了を指定すると音声なしで一部分だけ書き出します）。`ffmpeg`（libx264）が必要で、場所は環境変数 `FFMPEG` でも指定できます。

HTML を `#render` 付きで開くと動画書き出し用のモードになり、操作バーが消えて `window.__render.frame(t)` で任意の時刻を描画できます。

もっと手軽に録画したい場合は、PC 版の Chrome / Edge で HTML を開き、操作バーの「録画」を押して共有画面に「このタブ」を選ぶと、最初から最後まで再生しながら動画ファイル（MP4 または WebM）に保存できます。
