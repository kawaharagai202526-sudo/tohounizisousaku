'use strict';
// ============================================================
//  メインメニュー（タイトル・各メニュー・エンディング・リザルト）の背景
//  背景を変えるときは、このファイルの MenuBG を書きかえる。
//  update() で動かし、draw(ctx) で 640×480 の画面全体を塗る。menuBG() で全画面が同じものを共有する。
//
//  青空と、一晩で古びた人里の家々。その向こうに、借りた部屋を積み上げた屋敷の影がそびえたつ。
//  動かないもの（山・屋敷・家並み）は最初に一度だけ別のキャンバスに描いておく。
// ============================================================

class MenuBG {
  constructor() {
    this.t = 0;
    const r = new RNG(20251022); // 見た目が毎回同じになるようにシードを固定する
    this.clouds = [];
    for (let i = 0; i < 7; i++) {
      this.clouds.push({ img: MenuBG.makeCloud(r, 90 + r.next() * 110), x: r.next() * (SCREEN_W + 200) - 100, y: 20 + r.next() * 190, v: 0.06 + r.next() * 0.14 });
    }
    this.birds = [];
    this.far = MenuBG.makeFar(r);
    this.mansion = MenuBG.makeMansion(r);
    this.near = MenuBG.makeVillage(r);
  }

  // もくもくとした雲（下側だけ少し青くかげらせる）
  static makeCloud(r, w) {
    const h = w * 0.5;
    const c = makeCanvas(Math.ceil(w), Math.ceil(h));
    const x = c.getContext('2d');
    const puffs = [];
    for (let i = 0; i < 9; i++) {
      const px = w * (0.15 + 0.7 * (i / 8)) + (r.next() - 0.5) * w * 0.08;
      const pr = w * (0.1 + r.next() * 0.1) * (1 - Math.abs(i / 8 - 0.5) * 0.9);
      puffs.push([px, h * 0.68 - pr * (0.4 + r.next() * 0.6), pr]);
    }
    x.fillStyle = 'rgba(180,205,235,0.9)';
    for (const [px, py, pr] of puffs) { x.beginPath(); x.arc(px, py + pr * 0.25, pr, 0, TAU); x.fill(); }
    x.fillStyle = '#ffffff';
    for (const [px, py, pr] of puffs) { x.beginPath(); x.arc(px, py, pr * 0.92, 0, TAU); x.fill(); }
    x.fillRect(w * 0.15, h * 0.6, w * 0.7, h * 0.08);
    return c;
  }

  // 遠くの山と、かすんだ家並み
  static makeFar(r) {
    const c = makeCanvas(SCREEN_W, SCREEN_H);
    const x = c.getContext('2d');
    x.fillStyle = '#a9c4dc';
    x.beginPath();
    x.moveTo(0, 340);
    for (let px = 0; px <= SCREEN_W; px += 8) x.lineTo(px, 292 + Math.sin(px * 0.009 + 0.6) * 18 + Math.sin(px * 0.027) * 7);
    x.lineTo(SCREEN_W, 340);
    x.fill();
    x.fillStyle = '#93b0c8';
    x.beginPath();
    x.moveTo(0, 350);
    for (let px = 0; px <= SCREEN_W; px += 8) x.lineTo(px, 318 + Math.sin(px * 0.014 + 2) * 10);
    x.lineTo(SCREEN_W, 350);
    x.fill();
    // かすんだ屋根の列
    x.fillStyle = '#86a0b8';
    for (let px = -10; px < SCREEN_W; px += 26 + r.next() * 22) {
      const w = 24 + r.next() * 22, top = 326 + r.next() * 10;
      x.beginPath();
      x.moveTo(px - 4, top + 10);
      x.lineTo(px + w * 0.2, top);
      x.lineTo(px + w * 0.8, top);
      x.lineTo(px + w + 4, top + 10);
      x.lineTo(px + w + 4, 360);
      x.lineTo(px - 4, 360);
      x.fill();
    }
    return c;
  }

  // 反りのある瓦屋根（cx：中心、y：軒の高さ、w：屋根の下の幅、h：屋根の高さ）
  static roof(x, cx, y, w, h, sag = 0) {
    const ew = w / 2 + 10;
    x.beginPath();
    x.moveTo(cx - ew - 6, y - 5);
    x.quadraticCurveTo(cx - ew + 6, y + 1, cx - ew + 18, y + 1);
    x.lineTo(cx + ew - 18, y + 1);
    x.quadraticCurveTo(cx + ew - 6, y + 1, cx + ew + 6, y - 5);
    x.lineTo(cx + w * 0.3, y - h);
    x.quadraticCurveTo(cx, y - h + sag, cx - w * 0.3, y - h);
    x.closePath();
    x.fill();
  }

  // そびえたつ屋敷の影：人里から借りた部屋を、ずれたまま積み上げた塔
  static makeMansion(r) {
    const c = makeCanvas(SCREEN_W, SCREEN_H);
    const x = c.getContext('2d');
    // [中心x, 下の高さ, 幅, 部屋の高さ, 屋根の高さ]
    const rooms = [
      [462, 372, 300, 64, 26], [448, 286, 246, 54, 24], [486, 214, 204, 48, 22], [436, 150, 168, 44, 20],
      [498, 92, 126, 40, 18], [458, 44, 84, 34, 16], [474, 4, 44, 24, 14],
      // 横にはみ出した部屋
      [326, 300, 70, 40, 16], [612, 236, 64, 36, 15], [360, 178, 58, 32, 14], [580, 126, 50, 30, 13],
    ];
    x.fillStyle = '#26284a';
    for (const [cx, by, w, h] of rooms) x.fillRect(cx - w / 2, by - h, w, h);
    // はみ出した部屋を支える柱
    x.fillRect(318, 300, 5, 80); x.fillRect(335, 300, 4, 80);
    x.fillRect(606, 236, 5, 150); x.fillRect(620, 236, 4, 150);
    x.fillRect(356, 178, 4, 30); x.fillRect(578, 126, 4, 40);
    for (const [cx, by, w, h, rh] of rooms) MenuBG.roof(x, cx, by - h + 2, w, rh, r.next() * 4);
    // 障子窓（ほとんど暗い。灯りは draw で揺らす）
    const lit = [];
    for (const [cx, by, w, h] of rooms) {
      const n = Math.max(1, Math.floor(w / 34));
      for (let i = 0; i < n; i++) {
        const wx = cx - w / 2 + (w / n) * (i + 0.5) - 8, wy = by - h * 0.72;
        x.fillStyle = '#34385e';
        x.fillRect(wx, wy, 16, h * 0.42);
        x.fillStyle = '#26284a';
        x.fillRect(wx + 7, wy, 2, h * 0.42);
        if (r.next() < 0.18) lit.push({ x: wx, y: wy, w: 16, h: h * 0.42, p: r.next() * TAU });
      }
    }
    // 上ほど空にかすむ
    x.globalCompositeOperation = 'source-atop';
    const g = x.createLinearGradient(0, 0, 0, 380);
    g.addColorStop(0, 'rgba(120,160,215,0.55)');
    g.addColorStop(0.55, 'rgba(80,100,160,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, SCREEN_W, 380);
    x.globalCompositeOperation = 'source-over';
    c.lit = lit;
    return c;
  }

  // 一晩で古びた人里の家々（奥の列は日なた、手前の列は屋敷の影の中）
  static makeVillage(r) {
    const c = makeCanvas(SCREEN_W, SCREEN_H);
    const x = c.getContext('2d');
    const row = (base, minW, maxW, minH, maxH, col) => {
      for (let px = -40; px < SCREEN_W + 40;) {
        const w = minW + r.next() * (maxW - minW), h = minH + r.next() * (maxH - minH);
        const cx = px + w / 2, tilt = (r.next() - 0.5) * 0.06;
        x.save();
        x.translate(cx, base);
        x.rotate(tilt); // 古びて少し傾いている
        // 壁（板張り）
        x.fillStyle = col.wall;
        x.fillRect(-w / 2, -h, w, h);
        x.strokeStyle = col.board;
        x.lineWidth = 1;
        x.beginPath();
        for (let bx = -w / 2 + 6; bx < w / 2; bx += 6) { x.moveTo(bx, -h + 2); x.lineTo(bx + (r.next() - 0.5) * 2, 0); }
        x.stroke();
        // 戸口と、はがれた板
        x.fillStyle = col.dark;
        x.fillRect(-w * 0.18, -h * 0.62, w * 0.22, h * 0.62);
        if (r.next() < 0.6) { x.fillRect(w * 0.12, -h * 0.75, w * 0.2, h * 0.28); }
        if (r.next() < 0.5) {
          x.fillStyle = col.patch;
          x.save(); x.translate(-w * 0.35, -h * 0.5); x.rotate(0.3); x.fillRect(-6, -2, 14, 4); x.restore();
        }
        // 屋根（たわんで、瓦が欠けている）
        x.fillStyle = col.roof;
        MenuBG.roof(x, 0, -h + 2, w, h * 0.55, 3 + r.next() * 6);
        x.fillStyle = col.gap;
        for (let k = 0; k < 3; k++) {
          if (r.next() < 0.55) {
            const gx = (r.next() - 0.5) * w * 0.6, gy = -h - h * 0.15 - r.next() * h * 0.2;
            x.fillRect(gx, gy, 5 + r.next() * 6, 3);
          }
        }
        // 屋根の上の草
        if (r.next() < 0.4) {
          x.strokeStyle = col.grass;
          x.beginPath();
          const gx = (r.next() - 0.5) * w * 0.3, gy = -h - h * 0.5;
          for (let k = -2; k <= 2; k++) { x.moveTo(gx + k * 2, gy + 2); x.lineTo(gx + k * 3, gy - 6); }
          x.stroke();
        }
        x.restore();
        px += w + 6 + r.next() * 14;
      }
    };
    // 家と家のすき間から空が見えないように、先に地面を塗っておく
    x.fillStyle = '#7a6a50';
    x.fillRect(0, 392, SCREEN_W, SCREEN_H - 392);
    // 奥の列（日なた）
    row(404, 56, 92, 38, 56, { wall: '#a08668', board: 'rgba(80,58,40,0.45)', dark: '#4a3828', patch: '#c4aa82', roof: '#666a78', gap: '#a9c4dc', grass: '#6a8a48' });
    // 手前の地面と、手前の列（屋敷の影に入って暗い。下の文字が読みやすいように）
    const ground = x.createLinearGradient(0, 404, 0, SCREEN_H);
    ground.addColorStop(0, '#5a4c3a');
    ground.addColorStop(1, '#2a2230');
    x.fillStyle = ground;
    x.fillRect(0, 404, SCREEN_W, SCREEN_H - 404);
    row(516, 96, 150, 62, 80, { wall: '#4a3e48', board: 'rgba(16,12,24,0.5)', dark: '#1e1824', patch: '#665468', roof: '#2e2e3c', gap: '#4a4a60', grass: '#3a4a34' });
    // 足もとはさらに暗く
    const g = x.createLinearGradient(0, 400, 0, SCREEN_H);
    g.addColorStop(0, 'rgba(10,8,24,0)');
    g.addColorStop(1, 'rgba(10,8,24,0.75)');
    x.fillStyle = g;
    x.fillRect(0, 400, SCREEN_W, SCREEN_H - 400);
    return c;
  }

  update() {
    this.t++;
    for (const cl of this.clouds) {
      cl.x += cl.v;
      if (cl.x > SCREEN_W + 20) cl.x = -cl.img.width - 20;
    }
    // ときどき鳥（からす）が横切る
    if (Math.random() < 1 / 260) {
      const dir = Math.random() < 0.5 ? 1 : -1, y = frand(40, 220), n = 1 + Math.floor(frand(4));
      for (let i = 0; i < n; i++) this.birds.push({ x: dir > 0 ? -20 - i * 22 : SCREEN_W + 20 + i * 22, y: y + frand(-14, 14), vx: dir * frand(1.1, 1.6), p: frand(TAU) });
    }
    for (const b of this.birds) { b.x += b.vx; b.y += Math.sin(b.p + this.t * 0.05) * 0.2; b.p += 0.25; }
    this.birds = this.birds.filter(b => b.x > -80 && b.x < SCREEN_W + 80);
  }

  draw(ctx) {
    const t = this.t;
    // 青空
    const g = ctx.createLinearGradient(0, 0, 0, 360);
    g.addColorStop(0, '#1f56a8');
    g.addColorStop(0.45, '#4f8fd6');
    g.addColorStop(0.8, '#9fcdef');
    g.addColorStop(1, '#d6ebf6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    // お日さま（左上）
    const sg = ctx.createRadialGradient(96, 70, 8, 96, 70, 150);
    sg.addColorStop(0, 'rgba(255,255,240,0.9)');
    sg.addColorStop(0.2, 'rgba(255,250,220,0.35)');
    sg.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, 260, 230);
    // 雲
    for (const cl of this.clouds) ctx.drawImage(cl.img, cl.x, cl.y);
    ctx.drawImage(this.far, 0, 0);
    // 屋敷の影（窓の灯りがゆらぐ）
    ctx.drawImage(this.mansion, 0, 0);
    for (const w of this.mansion.lit) {
      ctx.fillStyle = `rgba(255,190,110,${0.18 + 0.12 * Math.sin(t * 0.03 + w.p)})`;
      ctx.fillRect(w.x, w.y, w.w, w.h);
    }
    // 鳥
    ctx.strokeStyle = 'rgba(30,30,50,0.8)';
    ctx.lineWidth = 1.5;
    for (const b of this.birds) {
      const f = Math.sin(b.p) * 4;
      ctx.beginPath();
      ctx.moveTo(b.x - 6, b.y - f);
      ctx.quadraticCurveTo(b.x - 2, b.y - 2, b.x, b.y);
      ctx.quadraticCurveTo(b.x + 2, b.y - 2, b.x + 6, b.y - f);
      ctx.stroke();
    }
    ctx.drawImage(this.near, 0, 0);
  }
}

let sharedMenuBG = null;
function menuBG() { return sharedMenuBG || (sharedMenuBG = new MenuBG()); }
