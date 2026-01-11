/* Space Impact – retro shooter (TaboLore)
   Sterowanie: WASD/Strzałki, Space strzał, P pauza, R restart, Enter start
   Dotyk: drag = ruch, tap = strzał
*/
(() => {
  const canvas = document.getElementById('si');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const uiScore = document.getElementById('siScore');
  const uiLives = document.getElementById('siLives');
  const uiLevel = document.getElementById('siLevel');
  const uiState = document.getElementById('siState');

  // ========= SETTINGS =========
  // Jeśli chcesz łatwiej celować: ustaw true (mniejszy obszar ruchu)
  const SMALLER_PLAY_AREA = true;

  // Start gry "łagodny"
  const START_LIVES = 3;
  const MAX_LIVES = 9;

  // Pociski / hitboxy (większe = łatwiej trafić)
  const PLAYER_BULLET_R = 3.4;
  const ENEMY_BULLET_R = 2.8;

  // Power-up: life star
  const POWERUP_MIN_T = 650; // minimum odstępu (frames)
  const POWERUP_MAX_T = 950; // maximum odstępu (frames)

  // ========= COLORS (canvas only) =========
  const COL = {
    bg: '#07090b',
    grid: 'rgba(57,255,136,.10)',
    neon: '#39ff88',
    neon2: 'rgba(57,255,136,.45)',
    text: 'rgba(232,240,236,.92)',
    muted: 'rgba(159,179,170,.75)',
  };

  // ========= GAME STATE =========
  let running = false;
  let paused = false;
  let score = 0;
  let lives = START_LIVES;
  let level = 1;      // liczony od wyniku
  let t = 0;

  const keys = new Set();

  const player = {
    x: 70,
    y: H / 2,
    w: 18,
    h: 12,
    speed: 3.2,
    cd: 0
  };

  /** @type {{x:number,y:number,vx:number,vy:number,r:number}[]} */
  let bullets = [];
  /** @type {{x:number,y:number,vx:number,vy:number,w:number,h:number,hp:number,kind:number,cd:number,shootBase:number}[]} */
  let enemies = [];
  /** @type {{x:number,y:number,vx:number,vy:number,r:number}[]} */
  let ebullets = [];
  /** @type {{x:number,y:number,life:number}[]} */
  let sparks = [];
  /** @type {{x:number,y:number,vx:number,vy:number,r:number,kind:'life'}[]} */
  let powerups = [];

  // tło: gwiazdki (2 warstwy dla klimatu)
  const starsA = Array.from({ length: 60 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    s: 0.6 + Math.random() * 1.5,
    v: 0.9 + Math.random() * 1.6
  }));
  const starsB = Array.from({ length: 30 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    s: 1.1 + Math.random() * 2.0,
    v: 0.4 + Math.random() * 0.9
  }));

  // rozkład power-upów
  let nextPowerUpAt = 0;

  // ========= HELPERS =========
  function rectHit(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function circleRectHit(cx, cy, r, rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx, dy = cy - ny;
    return (dx * dx + dy * dy) <= r * r;
  }

  function hitSpark(x, y) {
    for (let i = 0; i < 10; i++) {
      sparks.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        life: 16 + Math.random() * 12
      });
    }
  }

  function setPaused(p) {
    paused = p;
    if (uiState) uiState.textContent = paused ? 'PAUSE' : 'PLAY';
  }

  function reset() {
    running = true;
    paused = false;
    score = 0;
    lives = START_LIVES;
    level = 1;
    t = 0;

    bullets = [];
    enemies = [];
    ebullets = [];
    sparks = [];
    powerups = [];

    player.x = 70;
    player.y = H / 2;
    player.cd = 0;

    nextPowerUpAt = 200 + randInt(POWERUP_MIN_T, POWERUP_MAX_T);

    if (uiState) uiState.textContent = 'PLAY';
    if (uiScore) uiScore.textContent = '0';
    if (uiLives) uiLives.textContent = String(lives);
    if (uiLevel) uiLevel.textContent = String(level);
  }

  function randInt(a, b) {
    return Math.floor(a + Math.random() * (b - a + 1));
  }

  function loseLife() {
    lives -= 1;
    if (uiLives) uiLives.textContent = String(lives);
    hitSpark(player.x, player.y);

    player.x = 70;
    player.y = H / 2;
    bullets = [];

    if (lives <= 0) {
      running = false;
      if (uiState) uiState.textContent = 'GAME OVER (R)';
    }
  }

  function shoot() {
    if (!running || paused) return;
    if (player.cd > 0) return;

    player.cd = 10;
    bullets.push({
      x: player.x + player.w,
      y: player.y,
      vx: 6.6,
      vy: 0,
      r: PLAYER_BULLET_R
    });
  }

  function spawnEnemy(shootBase) {
    const kind = Math.random() < 0.72 ? 0 : 1; // 0=mały, 1=twardszy
    const y = 30 + Math.random() * (H - 60);

    // wolniej na starcie, szybciej z wynikiem
    const baseSpeed = 1.4 + (score / 700) * 1.3;     // rośnie do ok. 2.7
    const speed = Math.min(3.2, baseSpeed + Math.random() * 0.9);

    const e = {
      x: W + 30,
      y,
      vx: -speed,
      vy: (Math.random() - 0.5) * 0.9,
      w: kind === 0 ? 24 : 34,
      h: kind === 0 ? 14 : 20,
      hp: kind === 0 ? 1 : 3,
      kind,
      cd: shootBase + Math.random() * 35,
      shootBase
    };
    enemies.push(e);
  }

  function spawnLifeStar() {
    powerups.push({
      x: W + 20,
      y: 40 + Math.random() * (H - 80),
      vx: -2.2,
      vy: (Math.random() - 0.5) * 0.5,
      r: 9,
      kind: 'life'
    });
  }

  // ========= UPDATE =========
  function update() {
    // klawisze globalne
    if (keys.has('p')) { keys.delete('p'); if (running) setPaused(!paused); }
    if (keys.has('r')) { keys.delete('r'); reset(); }
    if (keys.has('enter') && !running) { keys.delete('enter'); reset(); }

    if (!running || paused) return;

    t++;

    // level od wyniku (czytelne)
    level = 1 + Math.floor(score / 200);
    if (uiLevel) uiLevel.textContent = String(level);

    // trudność od wyniku
    const diff = Math.min(1.0, score / 700);             // 0 -> 1
    const spawnEvery = Math.round(56 - diff * 30);       // start rzadziej, potem częściej
    const enemyShootBase = Math.round(105 - diff * 55);  // start wolno, potem szybciej

    // spawn wrogów
    if (t % spawnEvery === 0) spawnEnemy(enemyShootBase);

    // power-up: gwiazdka na życie (co jakiś czas, trochę losowo)
    if (t >= nextPowerUpAt) {
      spawnLifeStar();
      nextPowerUpAt = t + randInt(POWERUP_MIN_T, POWERUP_MAX_T) - Math.min(250, Math.floor(score / 3));
    }

    // sterowanie
    let sx = 0, sy = 0;
    if (keys.has('arrowup') || keys.has('w')) sy -= 1;
    if (keys.has('arrowdown') || keys.has('s')) sy += 1;
    if (keys.has('arrowleft') || keys.has('a')) sx -= 1;
    if (keys.has('arrowright') || keys.has('d')) sx += 1;

    const boost = keys.has('shift') ? 1.35 : 1.0;
    const sp = player.speed * boost;

    player.x += sx * sp;
    player.y += sy * sp;

    // clamp (opcjonalnie mniejszy obszar)
    const padX = SMALLER_PLAY_AREA ? 60 : 30;
    const padY = SMALLER_PLAY_AREA ? 44 : 28;
    player.x = Math.max(padX, Math.min(player.x, W - 120));
    player.y = Math.max(padY, Math.min(player.y, H - padY));

    if (keys.has(' ')) shoot();
    if (player.cd > 0) player.cd--;

    // tło gwiazd
    const starBoost = 1.2 + (score / 900) * 0.25;
    for (const s of starsA) {
      s.x -= s.v * starBoost;
      if (s.x < -5) { s.x = W + 5; s.y = Math.random() * H; }
    }
    for (const s of starsB) {
      s.x -= s.v * (starBoost * 0.65);
      if (s.x < -5) { s.x = W + 5; s.y = Math.random() * H; }
    }

    // pociski gracza
    bullets.forEach(b => { b.x += b.vx; b.y += b.vy; });
    bullets = bullets.filter(b => b.x < W + 20);

    // wrogowie + ich strzały
    for (const e of enemies) {
      e.x += e.vx;
      e.y += e.vy;
      if (e.y < 22 || e.y > H - 22) e.vy *= -1;

      e.cd -= 1;
      if (e.cd <= 0) {
        e.cd = e.shootBase + Math.random() * 35;
        ebullets.push({
          x: e.x - e.w / 2,
          y: e.y,
          vx: -4.2 - Math.min(1.2, score / 1200),
          vy: (Math.random() - 0.5) * 1.1,
          r: ENEMY_BULLET_R
        });
      }
    }
    enemies = enemies.filter(e => e.x > -80);

    // pociski wroga
    ebullets.forEach(b => { b.x += b.vx; b.y += b.vy; });
    ebullets = ebullets.filter(b => b.x > -30 && b.y > -30 && b.y < H + 30);

    // power-ups ruch
    powerups.forEach(p => { p.x += p.vx; p.y += p.vy; });
    powerups = powerups.filter(p => p.x > -40);

    // kolizje: bullet -> enemy
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        if (circleRectHit(b.x, b.y, b.r, e.x - e.w / 2, e.y - e.h / 2, e.w, e.h)) {
          bullets.splice(j, 1);
          e.hp -= 1;
          hitSpark(b.x, b.y);

          if (e.hp <= 0) {
            enemies.splice(i, 1);
            score += (e.kind === 0 ? 10 : 30);
            if (uiScore) uiScore.textContent = String(score);
            hitSpark(e.x, e.y);
          }
          break;
        }
      }
    }

    // kolizje: enemy -> player
    for (const e of enemies) {
      if (rectHit(player.x - player.w / 2, player.y - player.h / 2, player.w, player.h,
        e.x - e.w / 2, e.y - e.h / 2, e.w, e.h)) {
        loseLife();
        break;
      }
    }

    // kolizje: ebullet -> player
    for (let i = ebullets.length - 1; i >= 0; i--) {
      const b = ebullets[i];
      if (circleRectHit(b.x, b.y, b.r, player.x - player.w / 2, player.y - player.h / 2, player.w, player.h)) {
        ebullets.splice(i, 1);
        loseLife();
        break;
      }
    }

    // kolizje: power-up -> player
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      if (circleRectHit(p.x, p.y, p.r, player.x - player.w / 2, player.y - player.h / 2, player.w, player.h)) {
        powerups.splice(i, 1);
        lives = Math.min(MAX_LIVES, lives + 1);
        if (uiLives) uiLives.textContent = String(lives);
        hitSpark(player.x + player.w / 2, player.y);
      }
    }

    // sparks
    for (const s of sparks) s.life -= 1;
    sparks = sparks.filter(s => s.life > 0);
  }

  // ========= DRAW =========
  function draw() {
    ctx.clearRect(0, 0, W, H);

    // bg
    ctx.fillStyle = COL.bg;
    ctx.fillRect(0, 0, W, H);

    // scanlines
    ctx.fillStyle = "rgba(0,0,0,.22)";
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);

    // grid (delikatne)
    ctx.strokeStyle = COL.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < W; x += 48) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0; y < H; y += 48) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();

    // stars
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "rgba(232,240,236,.95)";
    for (const s of starsB) ctx.fillRect(s.x, s.y, s.s, s.s);
    ctx.globalAlpha = 0.55;
    for (const s of starsA) ctx.fillRect(s.x, s.y, s.s, s.s);
    ctx.globalAlpha = 1;

    // player ship
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = COL.neon2;
    ctx.strokeStyle = COL.neon;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(8, -7);
    ctx.lineTo(12, 0);
    ctx.lineTo(8, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(57,255,136,.18)";
    ctx.beginPath();
    ctx.arc(-14, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // bullets
    ctx.fillStyle = COL.neon;
    for (const b of bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // enemies
    for (const e of enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.strokeStyle = "rgba(57,255,136,.65)";
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.lineWidth = 2;

      ctx.beginPath();
      roundRect(ctx, -e.w / 2, -e.h / 2, e.w, e.h, 7);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(57,255,136,.14)";
      ctx.beginPath();
      ctx.arc(0, 0, (e.kind === 0 ? 5 : 7), 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // enemy bullets
    ctx.fillStyle = "rgba(255,255,255,.85)";
    for (const b of ebullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // power-ups: life star
    for (const p of powerups) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.strokeStyle = "rgba(57,255,136,.85)";
      ctx.fillStyle = "rgba(57,255,136,.18)";
      ctx.lineWidth = 2;
      drawStar(ctx, 0, 0, 5, p.r, p.r * 0.48);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // sparks
    for (const s of sparks) {
      const a = Math.max(0, Math.min(1, s.life / 24));
      ctx.fillStyle = `rgba(57,255,136,${0.10 + a * 0.35})`;
      ctx.fillRect(s.x, s.y, 2, 2);
    }

    // start overlay
    if (!running) {
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = "center";
      ctx.fillStyle = COL.text;
      ctx.font = "700 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText("SPACE IMPACT", W / 2, H / 2 - 18);
      ctx.font = "500 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillStyle = COL.muted;
      ctx.fillText("Enter aby zacząć • R restart • P pauza", W / 2, H / 2 + 10);
      ctx.fillText("WASD/Strzałki ruch • Space strzał", W / 2, H / 2 + 30);
    }
  }

  function drawStar(ctx2, x, y, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let cx = x, cy = y;
    let step = Math.PI / spikes;

    ctx2.beginPath();
    ctx2.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      ctx2.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
      rot += step;
      ctx2.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
      rot += step;
    }
    ctx2.lineTo(cx, cy - outerRadius);
    ctx2.closePath();
  }

  function roundRect(ctx2, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx2.beginPath();
    ctx2.moveTo(x + rr, y);
    ctx2.arcTo(x + w, y, x + w, y + h, rr);
    ctx2.arcTo(x + w, y + h, x, y + h, rr);
    ctx2.arcTo(x, y + h, x, y, rr);
    ctx2.arcTo(x, y, x + w, y, rr);
    ctx2.closePath();
  }

  function loop() {
    // update/draw zawsze, żeby ekran startowy żył
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // init UI
  if (uiState) uiState.textContent = "READY";
  if (uiLives) uiLives.textContent = String(lives);
  if (uiScore) uiScore.textContent = String(score);
  if (uiLevel) uiLevel.textContent = String(level);

  // input: keyboard
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === ' ') e.preventDefault(); // nie scrolluj
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

  // pointer / touch
  function getPt(ev) {
    const rect = canvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left) * (W / rect.width);
    const y = (ev.clientY - rect.top) * (H / rect.height);
    return { x, y };
  }

  let pointerDown = false;

  canvas.addEventListener('pointerdown', (ev) => {
    canvas.setPointerCapture(ev.pointerId);
    pointerDown = true;
    if (!running) reset();
    shoot(); // tap
    const pt = getPt(ev);
    player.x = pt.x;
    player.y = pt.y;
  });

  canvas.addEventListener('pointermove', (ev) => {
    if (!pointerDown) return;
    const pt = getPt(ev);
    player.x = pt.x;
    player.y = pt.y;
  });

  canvas.addEventListener('pointerup', () => { pointerDown = false; });

  // start loop
  loop();
})();
