'use strict';
// ============================================================
//  ゲーム本編シーン
// ============================================================

const STAGES = [];
const EXTEND_POINTS = [50, 125, 250, 400, 600];
const Settings = { lives: Store.get('lives', 3) };
const PRACTICE_POWER = [100, 250, 400, 400]; // プラクティス開始時の霊力

// スペルカード取得履歴
const SpellHistory = {
  data: Store.get('spells', {}),
  key(name) { return `${DIFF}:${G.charId}:${name}`; },
  get(name) { return this.data[this.key(name)] || { got: 0, tried: 0 }; },
  bump(name, field) {
    const k = this.key(name);
    const d = this.data[k] || { got: 0, tried: 0 };
    d[field]++;
    this.data[k] = d;
    Store.set('spells', this.data);
  },
};

let G = null;

class GameScene {
  constructor(opts) {
    G = this;
    DIFF = opts.difficulty;
    rng.seed(opts.seed ?? Date.now());
    this.opts = opts;
    this.charId = opts.character;
    this.practice = !!opts.practice;
    this.score = 0;
    this.hiKey = `hi_${DIFF}_${this.charId}`;
    this.hiScore = Math.max(Store.get(this.hiKey, 0), 1000000);
    this.initialLives = Settings.lives;
    this.lives = this.initialLives;
    this.bombs = 3;
    const startStage = opts.stage || 0;
    this.power = this.practice ? PRACTICE_POWER[startStage] : 100;
    this.graze = 0;
    this.pointItems = 0;
    this.extendIdx = 0;
    this.continues = 0;
    this.misses = 0;
    this.bombsUsed = 0;
    this.spellsGot = 0;
    this.spellsSeen = 0;
    this.player = new Player(this.charId);
    this.pendingStage = null;
    this.paused = false;
    this.pauseSel = 0;
    this.continueMenu = null;
    this.frame = 0;
    this.messages = [];
    this.cheat = false;
    // 描画が update より先に呼ばれても大丈夫なように、ここでステージを組み立てる
    this.startStage(startStage);
  }

  enter() { Input.setTouchButtons(TOUCH_BUTTONS); }
  exit() { Input.setTouchButtons([]); }

  resetStageState() {
    this.bullets = new BulletManager();
    this.lasers = [];
    this.enemies = [];
    this.shots = [];
    this.items = [];
    Fx.reset();
    this.boss = null;
    this.bossPhases = null;
    this.bossPhaseIdx = 0;
    this.dialogue = null;
    this.cutin = null;
    this.spell = null;
    this.spellFailed = false;
    this.spellBonus = 0;
    this.spellBgKind = null;
    this.spellBgAlpha = 0;
    this.lastSpellBg = null;
    this.stageTitle = null;
    this.bossTitle = null;
    this.bgmTitle = null;
    this.bombName = null;
    this.clearInfo = null;
    this.shake = 0;
    this.flash = null;
    this.tasks = new TaskRunner();
  }

  startStage(i) {
    this.stageIndex = i;
    this.stage = STAGES[i];
    this.resetStageState();
    this.bg = new this.stage.bg();
    this.stageFrame = 0;
    this.player.x = FIELD_W / 2;
    this.player.y = FIELD_H - 48;
    this.player.invuln = Math.max(this.player.invuln, 60);
    this.tasks.add(this.stageFlow());
  }

  *stageFlow() {
    Sound.playBgm(this.stage.bgm);
    this.showBgmTitle(this.stage.bgm);
    this.stageTitle = { frame: 0 };
    yield* this.stage.script(this);
    yield* this.stageClear();
  }

  *stageClear() {
    this.clearLasers();
    this.bullets.cancelAll(true);
    for (const it of this.items) it.auto = true;
    yield 60;
    const bonus = (this.stageIndex + 1) * 1000000 + this.power * 1000 + this.graze * 500;
    this.score += bonus;
    this.clearInfo = { bonus, frame: 0 };
    Sound.se('bonus');
    yield 240;
    this.clearInfo = null;
    if (this.practice) this.finish('practice');
    else if (this.stageIndex >= STAGES.length - 1) this.finish('clear');
    else this.pendingStage = this.stageIndex + 1;
  }

  finish(kind) {
    this.saveHiScore();
    Sound.stopBgm(1.5);
    if (kind === 'clear') Game.setScene(new EndingScene(this));
    else Game.setScene(new ResultScene(this, kind));
  }

  saveHiScore() {
    if (this.practice || this.cheat) return;
    if (this.score > Store.get(this.hiKey, 0)) Store.set(this.hiKey, Math.floor(this.score));
  }

  // ---------------- 更新 ----------------
  update() {
    if (this.pendingStage !== null) {
      const i = this.pendingStage;
      this.pendingStage = null;
      this.startStage(i);
    }
    if (this.continueMenu) { this.updateContinue(); return; }
    if (this.paused) { this.updatePause(); return; }
    if (Input.pressed('pause') || (Input.isTouch && document.hidden)) { this.openPause(); return; }

    this.frame++;
    this.stageFrame++;
    this.tasks.update();
    if (this.dialogue) this.dialogue.update();
    this.player.update(this);
    if (this.continueMenu) return;

    // 自機ショット
    const boss = this.boss;
    for (const s of this.shots) {
      s.update();
      if (!s.alive) continue;
      for (const e of this.enemies) {
        if (!e.alive || e.untouchable || e.y < -6) continue;
        const r = e.r + s.r;
        if (dist2(s.x, s.y, e.x, e.y) < r * r) {
          this.damageEnemy(e, s.dmg);
          s.alive = false;
          if (s.kind === 'missile') Fx.explosion(s.x, s.y, 'rgba(120,255,150,0.6)', 0.6);
          else Fx.hit(s.x, s.y);
          break;
        }
      }
      if (s.alive && boss && boss.alive && !boss.untouchable) {
        const r = boss.r + s.r;
        if (dist2(s.x, s.y, boss.x, boss.y) < r * r) {
          this.damageEnemy(boss, s.dmg);
          s.alive = false;
          if (s.kind === 'missile') Fx.explosion(s.x, s.y, 'rgba(120,255,150,0.6)', 0.6);
          else Fx.hit(s.x, s.y);
        }
      }
    }
    this.shots = this.shots.filter(s => s.alive);

    for (const e of this.enemies) if (e.alive) e.update();
    this.enemies = this.enemies.filter(e => e.alive);
    if (this.boss) this.boss.update();
    this.bullets.update();
    for (const l of this.lasers) l.update();
    this.lasers = this.lasers.filter(l => l.alive);
    this.checkPlayerCollision();
    for (const it of this.items) if (it.alive) it.update(this.player);
    this.items = this.items.filter(it => it.alive);
    Fx.update();
    this.bg.update();

    // 演出タイマー
    const target = this.spellBgKind ? 1 : 0;
    this.spellBgAlpha = clamp(this.spellBgAlpha + (target ? 0.03 : -0.03), 0, 1);
    if (this.spellBgKind) this.lastSpellBg = this.spellBgKind;
    for (const m of this.messages) m.frame++;
    this.messages = this.messages.filter(m => m.frame < m.life);
    if (this.stageTitle) this.stageTitle.frame++;
    if (this.bossTitle) this.bossTitle.frame++;
    if (this.bgmTitle) this.bgmTitle.frame++;
    if (this.bombName) this.bombName.frame++;
    if (this.clearInfo) this.clearInfo.frame++;
    if (this.spell) this.spell.frame++;
    if (this.cutin && ++this.cutin.frame > 90) this.cutin = null;
    if (this.shake > 0) this.shake--;
    if (this.flash && (this.flash.a -= 0.03) <= 0) this.flash = null;
    if (this.score > this.hiScore) this.hiScore = this.score;
  }

  canShoot() { return !this.dialogue; }

  checkPlayerCollision() {
    const p = this.player;
    if (p.state !== 'normal') return;
    const canHit = p.invuln === 0 && !this.cheat;
    const canGraze = p.invuln === 0;
    const hr = p.hitR;
    for (const b of this.bullets.list) {
      if (!b.alive || b.delay > 0) continue;
      const dx = b.x - p.x, dy = b.y - p.y;
      const d2 = dx * dx + dy * dy;
      const gr = p.grazeR + b.hitR;
      if (d2 > gr * gr) continue;
      const r = hr + b.hitR;
      if (d2 < r * r) {
        if (canHit) { p.hit(this); return; }
      } else if (!b.grazed && canGraze) {
        b.grazed = true;
        this.addGraze(b.x, b.y);
      }
    }
    for (const l of this.lasers) {
      if (l.hits(p.x, p.y, hr)) {
        if (canHit) { p.hit(this); return; }
      } else if (canGraze && l.on && l.grazeCd === 0 && l.distTo(p.x, p.y) < l.width * 0.5 + 16) {
        l.grazeCd = 5;
        this.addGraze(p.x, p.y);
      }
    }
    if (!canHit) return;
    for (const e of this.enemies) {
      if (!e.alive || e.noBody) continue;
      const r = e.r * 0.6 + hr;
      if (dist2(e.x, e.y, p.x, p.y) < r * r) { p.hit(this); return; }
    }
    const b = this.boss;
    if (b && b.alive && this.bossPhases && dist2(b.x, b.y, p.x, p.y) < (14 + hr) * (14 + hr)) p.hit(this);
  }

  addGraze(x, y) {
    this.graze++;
    this.score += 500;
    Sound.se('graze');
    Fx.graze(x, y);
  }

  damageEnemy(e, dmg, isBomb = false, sound = true) {
    if (!e.alive || e.untouchable || e.invincible > 0) return;
    if (e.isBoss) {
      if (isBomb && this.spell) dmg *= 0.3;
      e.hp -= dmg;
      e.flash = 2;
      this.score += 10;
      if (sound) Sound.se('hit');
      return;
    }
    e.hp -= dmg;
    e.flash = 2;
    this.score += 10;
    if (sound) Sound.se('hit');
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    e.alive = false;
    e.tasks.clear();
    this.score += e.score;
    dropItems(e.x, e.y, e.drops);
    const col = { blue: 'rgba(120,160,255,0.8)', red: 'rgba(255,120,120,0.8)', green: 'rgba(120,255,150,0.8)', yellow: 'rgba(255,230,120,0.8)', purple: 'rgba(210,140,255,0.8)' }[e.color] || 'rgba(255,255,255,0.8)';
    Fx.explosion(e.x, e.y, col, e.r >= 18 ? 1.8 : 1);
    Sound.se('kill');
    if (e.onDeath) e.onDeath(e);
  }

  areaDamage(x, y, r, dmg, isBomb) {
    for (const e of this.enemies) {
      if (e.alive && dist2(e.x, e.y, x, y) < (r + e.r) * (r + e.r)) this.damageEnemy(e, dmg, isBomb);
    }
    const b = this.boss;
    if (b && b.alive && dist2(b.x, b.y, x, y) < (r + b.r) * (r + b.r)) this.damageEnemy(b, dmg, isBomb);
  }

  nearestTarget(x, y) {
    let best = null, bd = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || e.untouchable || e.y < 0 || e.y > FIELD_H || e.x < 0 || e.x > FIELD_W) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    const b = this.boss;
    if (b && b.alive && !b.untouchable) {
      const d = dist2(x, y, b.x, b.y);
      if (d < bd) best = b;
    }
    return best;
  }

  clearLasers() { this.lasers = []; }

  collectItem(it) {
    switch (it.type) {
      case 'power': this.addPower(5); break;
      case 'bigpower': this.addPower(100); break;
      case 'full': this.addPower(400); break;
      case 'point': {
        const maxV = Math.min(10000 + this.graze * 20, 100000);
        const v = it.auto ? maxV : Math.floor(maxV * clamp(1 - ((it.y - POC_LINE) / (FIELD_H - POC_LINE)) * 0.6, 0.3, 1) / 10) * 10;
        this.score += v;
        this.pointItems++;
        Fx.text(it.x, it.y - 10, String(v), v >= maxV ? '#ffe070' : '#ffffff', 10, 40);
        const need = EXTEND_POINTS[this.extendIdx];
        if (need && this.pointItems >= need) { this.extendIdx++; this.extend(); }
        break;
      }
      case 'bomb':
        this.bombs = Math.min(this.bombs + 1, 8);
        this.msg('Spell Card Get!', '#80ffa0');
        break;
      case 'life': this.extend(); break;
      case 'star': this.score += 1500; break;
    }
    Sound.se('item');
  }

  addPower(n) {
    if (this.power >= 400) { this.score += 5000; return; }
    const before = Math.floor(this.power / 100);
    this.power = Math.min(400, this.power + n);
    if (Math.floor(this.power / 100) > before) {
      Sound.se('powerup');
      if (this.power >= 400) {
        this.msg('Full Power Mode!!', '#ffd060');
        this.bullets.cancelAll(true);
      } else Fx.text(this.player.x, this.player.y - 30, 'Power Up', '#ffb0b0', 12, 50);
    }
  }

  extend() {
    this.lives = Math.min(this.lives + 1, 8);
    this.msg('Extend!!', '#ff9ad8');
    Sound.se('extend');
  }

  msg(text, color = '#ffffff', sub = null, life = 150) {
    this.messages.push({ text, color, sub, frame: 0, life });
    if (this.messages.length > 3) this.messages.shift();
  }
  showBgmTitle(id) { if (SONGS[id]) this.bgmTitle = { text: SONGS[id].title, frame: 0 }; }
  showBombName(text) { this.bombName = { text, frame: 0 }; }

  onPlayerDeath(x, y) {
    this.misses++;
    this.lives--;
    this.spellFailed = true;
    this.bombs = 3;
    const lost = Math.min(this.power, 50);
    this.power -= lost;
    this.bullets.cancelAll(false);
    this.clearLasers();
    this.shake = 16;
    for (let i = 0; i < 7; i++) {
      const it = spawnItem(i === 3 && this.lives < 0 ? 'full' : 'power', x + frand(-16, 16), Math.min(y, FIELD_H - 60));
      it.vy = -frand(4, 6);
      it.vx = frand(-2.2, 2.2);
    }
  }

  onOutOfLives() {
    this.continueMenu = { sel: 0, frame: 0 };
    Sound.se('pause');
  }

  updateContinue() {
    const m = this.continueMenu;
    m.frame++;
    if (Input.repeat('up') || Input.repeat('down')) { m.sel = 1 - m.sel; Sound.se('cursor'); }
    const tap = fieldMenuTap(2);
    if (tap >= 0) m.sel = tap;
    if ((Input.pressed('shot') || tap >= 0) && m.frame > 20) {
      Sound.se('ok');
      if (m.sel === 0) {
        this.continues++;
        this.score = this.continues;
        this.lives = this.initialLives;
        this.bombs = 3;
        this.continueMenu = null;
        const p = this.player;
        p.state = 'respawn';
        p.timer = 40;
        p.x = FIELD_W / 2;
        p.y = FIELD_H + 30;
        p.invuln = 220;
      } else {
        this.finish('gameover');
      }
    }
  }

  openPause() {
    this.paused = true;
    this.pauseSel = 0;
    this.pauseFrame = 0;
    Sound.se('pause');
    if (Sound.ctx && Sound.bgmBus) Sound.bgmBus.gain.value = Sound.muted ? 0 : Sound.bgmVolume * 0.3;
  }
  closePause() {
    this.paused = false;
    Sound.applyVolume();
  }
  updatePause() {
    this.pauseFrame++;
    const n = 3;
    if (Input.repeat('up')) { this.pauseSel = (this.pauseSel + n - 1) % n; Sound.se('cursor'); }
    if (Input.repeat('down')) { this.pauseSel = (this.pauseSel + 1) % n; Sound.se('cursor'); }
    const tap = fieldMenuTap(n);
    if (tap >= 0) this.pauseSel = tap;
    if (Input.pressed('pause') || Input.pressed('bomb')) { this.closePause(); return; }
    if ((Input.pressed('shot') || tap >= 0) && this.pauseFrame > 5) {
      Sound.se('ok');
      if (this.pauseSel === 0) this.closePause();
      else if (this.pauseSel === 1) {
        Sound.applyVolume();
        Game.setScene(new GameScene({ ...this.opts, seed: undefined }));
      } else {
        this.saveHiScore();
        Sound.applyVolume();
        Game.setScene(new TitleScene());
      }
    }
  }

  // ---------------- ボス戦 ----------------
  spawnBoss(id, def) {
    const b = new Boss(id, def);
    this.boss = b;
    return b;
  }

  *talk(lines) {
    this.bullets.cancelAll(true);
    this.dialogue = new Dialogue(lines, this);
    while (!this.dialogue.done) yield;
    this.dialogue = null;
  }

  *fight(boss, phases) {
    this.bossPhases = phases.filter(ph => DIFF >= (ph.minDiff || 0));
    for (let i = 0; i < this.bossPhases.length; i++) {
      this.bossPhaseIdx = i;
      yield* this.runPhase(boss, this.bossPhases[i], i, this.bossPhases.length);
    }
    this.bossPhases = null;
    boss.phase = null;
  }

  *runPhase(boss, ph, index, total) {
    const spell = ph.type === 'spell';
    boss.hp = boss.maxHp = Math.round((ph.hp ?? 1000) * dv(0.75, 0.9, 1, 1.05));
    boss.phase = ph;
    boss.timer = Math.round((ph.time ?? 30) * 60);
    const totalTime = boss.timer;
    boss.untouchable = !!ph.survival;
    boss.invincible = spell ? 60 : 30;
    this.spellFailed = false;
    const base = ph.bonus ?? (this.stageIndex + 1) * 1000000 + index * 200000;
    if (spell) {
      this.spellsSeen++;
      this.spellBonus = base;
      this.spell = { name: ph.name, frame: 0, history: SpellHistory.get(ph.name) };
      SpellHistory.bump(ph.name, 'tried');
      Sound.se('spell');
      this.cutin = { id: boss.id, frame: 0 };
      this.spellBgKind = boss.def.spellBg || null;
    } else {
      this.spell = null;
      this.spellBgKind = null;
    }
    boss.tasks.clear();
    boss.tasks.add(ph.script(boss, this));
    let result = 'timeout';
    for (;;) {
      yield;
      boss.timer--;
      if (spell && !this.spellFailed) {
        this.spellBonus = Math.floor((base * (0.5 + 0.5 * boss.timer / totalTime)) / 10) * 10;
      }
      if (boss.timer > 0 && boss.timer <= 600 && boss.timer % 60 === 0) Sound.se(boss.timer <= 180 ? 'timeoutLow' : 'timeout');
      if (!ph.survival && boss.hp <= 0) { result = 'defeated'; break; }
      if (boss.timer <= 0) break;
    }
    boss.tasks.clear();
    boss.moveTask = null;
    boss.untouchable = true;
    this.clearLasers();
    this.bullets.cancelAll(true);
    const last = index === total - 1;
    if (result === 'defeated') {
      this.score += 100000;
      Sound.se('kill');
      Fx.explosion(boss.x, boss.y, 'rgba(255,220,255,0.8)', 2.5);
      if (!last) dropItems(boss.x, boss.y, spell ? { power: 6, point: 8 } : { power: 4, point: 4 });
    } else {
      Sound.se('clear');
    }
    if (spell) {
      const captured = !this.spellFailed && (result === 'defeated' || ph.survival);
      if (captured) {
        this.score += this.spellBonus;
        this.spellsGot++;
        SpellHistory.bump(ph.name, 'got');
        this.msg('Get Spell Card Bonus!!', '#ffe070', padScore(this.spellBonus, 8));
        Sound.se('bonus');
      } else {
        this.msg('Bonus Failed', '#a0a8c0');
      }
    }
    this.spell = null;
    this.spellBgKind = null;
    if (!last) {
      yield* boss.moveTo(clamp(boss.x, 96, FIELD_W - 96), 100, 40);
      yield 20;
    }
  }

  // ボス撃破（逃げるだけの中ボスは flee=true）
  *bossDown(boss, flee = false) {
    if (flee) {
      yield* boss.moveTo(boss.x + (boss.x < FIELD_W / 2 ? -1 : 1) * 60, -80, 40, Ease.inQuad);
      boss.alive = false;
      this.boss = null;
      return;
    }
    Sound.se('bossdie');
    Fx.bossExplosion(boss.x, boss.y);
    this.shake = 40;
    this.flash = { color: '255,255,255', a: 0.9 };
    dropItems(boss.x, boss.y, boss.def.finalDrops || { power: 10, point: 14, bigpower: 1 });
    this.score += 1000000;
    boss.alive = false;
    this.boss = null;
    yield 80;
    for (const it of this.items) it.auto = true;
    yield 60;
  }

  // ---------------- 描画 ----------------
  draw(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
    ctx.clip();
    const sh = this.shake > 0 ? Math.min(this.shake, 8) * 0.5 : 0;
    ctx.translate(FIELD_X + (sh ? frand(-sh, sh) : 0), FIELD_Y + (sh ? frand(-sh, sh) : 0));
    this.bg.draw(ctx);
    if (this.spellBgAlpha > 0 && this.lastSpellBg) {
      ctx.globalAlpha = this.spellBgAlpha;
      drawSpellBG(ctx, this.lastSpellBg, this.frame);
      ctx.globalAlpha = 1;
    }
    if (this.boss) this.boss.draw(ctx);
    for (const e of this.enemies) e.draw(ctx);
    for (const it of this.items) it.draw(ctx);
    for (const s of this.shots) s.draw(ctx);
    if (this.player.bomb) this.player.bomb.draw(ctx);
    this.player.draw(ctx);
    for (const l of this.lasers) l.draw(ctx);
    this.bullets.draw(ctx);
    this.player.drawHitbox(ctx);
    Fx.draw(ctx);
    drawCutin(ctx, this);
    drawBossHud(ctx, this);
    drawSpellName(ctx, this);
    if (this.dialogue) this.dialogue.draw(ctx);
    drawStageTitle(ctx, this);
    drawBossTitle(ctx, this);
    drawMessages(ctx, this);
    if (this.flash) {
      ctx.fillStyle = `rgba(${this.flash.color},${Math.max(0, this.flash.a)})`;
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    }
    if (this.paused) drawFieldMenu(ctx, '一時停止', ['ゲームを再開', '最初からやり直す', 'タイトルに戻る'], this.pauseSel, 'Esc / X で再開');
    if (this.continueMenu) drawFieldMenu(ctx, '満身創痍', ['コンティニューする', 'あきらめる'], this.continueMenu.sel, `コンティニュー回数 ${this.continues}`);
    ctx.restore();
    drawSidePanel(ctx, this);
  }
}
