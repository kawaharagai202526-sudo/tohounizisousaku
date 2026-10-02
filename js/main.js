'use strict';
// ============================================================
//  起動・メインループ
// ============================================================

const Game = {
  canvas: null,
  ctx: null,
  scene: null,
  frame: 0,
  fps: 60,
  fade: 0,
  scale: 1,

  setScene(s) {
    if (this.scene && this.scene.exit) this.scene.exit();
    this.scene = s;
    this.fade = 1;
    if (s.enter) s.enter();
  },

  update() {
    this.step();
    // キー「S」：ゲーム中は1フレームに2回進める
    if (Cheats.on.speed && this.scene instanceof GameScene) this.step();
    Party.update();
  },
  step() {
    Input.update();
    this.scene.update();
    Sound.flush();
    this.frame++;
    if (this.fade > 0) this.fade = Math.max(0, this.fade - 0.06);
  },

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.scene.draw(ctx);
    Party.draw(ctx);
    if (this.fade > 0) {
      ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      ctx.fillStyle = `rgba(0,0,0,${this.fade})`;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    }
  },

  resize() {
    const wrap = this.canvas.parentElement;
    const availW = wrap.clientWidth, availH = wrap.clientHeight;
    const s = Math.min(availW / SCREEN_W, availH / SCREEN_H);
    const cssW = Math.floor(SCREEN_W * s), cssH = Math.floor(SCREEN_H * s);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const k = Math.min(s * dpr, 2.5);
    this.canvas.width = Math.round(SCREEN_W * k);
    this.canvas.height = Math.round(SCREEN_H * k);
    this.scale = this.canvas.width / SCREEN_W;
  },
};

function bootGame() {
  document.title = GAME_INFO.title;
  const canvas = document.getElementById('game');
  canvas.setAttribute('aria-label', `${GAME_INFO.title}のゲーム画面`);
  Game.canvas = canvas;
  Game.ctx = canvas.getContext('2d');
  Game.resize();
  window.addEventListener('resize', () => Game.resize());
  Input.init(canvas);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && Game.scene instanceof GameScene && !Game.scene.paused && !Game.scene.continueMenu) Game.scene.openPause();
  });

  const start = document.getElementById('start');
  const begin = () => {
    if (start) start.hidden = true;
    Sound.unlock();
    canvas.focus();
  };
  if (start) {
    start.addEventListener('click', begin);
    Input.onFirstInput = begin;
  }

  Game.setScene(new TitleScene());

  // 開発用：URL に ?boss=boss4&phase=3 などを付けると、そのボスの攻撃からすぐ始まる（startBossTest）
  const q = new URLSearchParams(location.search);
  if (q.has('boss') || q.has('stage')) {
    startBossTest({
      boss: q.get('boss'), stage: Number(q.get('stage')) || 0, phase: Number(q.get('phase')) || 1,
      diff: q.has('diff') ? Number(q.get('diff')) : 1, char: q.get('char'), only: q.get('only') === '1',
    });
  }

  const STEP = 1000 / 60;
  let last = performance.now(), acc = 0, fpsT = last, fpsN = 0, errShown = false;
  function loop(now) {
    requestAnimationFrame(loop);
    acc += Math.min(now - last, 100);
    last = now;
    let n = 0;
    try {
      while (acc >= STEP - 0.5 && n < 4) {
        Game.update();
        acc -= STEP;
        n++;
      }
      if (acc < -STEP) acc = 0;
      Game.draw();
      Sound.schedule();
    } catch (e) {
      // 1回の例外でループ全体が止まらないようにする
      if (!errShown) { console.error(e); errShown = true; }
      acc = 0;
    }
    fpsN += n;
    if (now - fpsT >= 1000) {
      Game.fps = (fpsN * 1000) / (now - fpsT);
      fpsN = 0;
      fpsT = now;
    }
  }
  requestAnimationFrame(loop);
}

// 公開ページで再読み込みされた時にも安全に起動する
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(bootGame);
else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootGame);
else bootGame();
