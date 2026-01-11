/* Ink Ribbon Run (TaboLore Minigierki)
   Cel: NIE DOTKNIJ INK RIBBONA. Przeskakuj przeszkody jak w runnerze.
   Sterowanie:
   - Skok: Space / W / ↑ / Tap
   - Pauza: P
   - Restart: R
   Wymagane ID w HTML (rekomendowane):
   canvas:      ir
   HUD:         irScore, irBest, irSpeed, irState
*/
(() => {
  const canvas = document.getElementById('ir') || document.getElementById('inkrun');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const uiScore = document.getElementById('irScore');
  const uiBest  = document.getElementById('irBest');
  const uiSpeed = document.getElementById('irSpeed');
  const uiState = document.getElementById('irState');

  const LS_KEY = 'tabolore_inkrun_best';

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  // world
  const groundY = H - 56;
  const gravity = 0.95;
  const jumpV   = 14.0;

  // player
  const pl = { x: 90, y: groundY, vy: 0, w: 28, h: 34, onGround: true };

  // obstacles (ink ribbons)
  let obs = [];
  let spawnT = 0;

  // state
  let running = false;
  let paused = false;
  let gameOver = false;

  let score = 0;
  let best = Number(localStorage.getItem(LS_KEY) || 0);
  let speed = 6.0;

  function setState(t){ if (uiState) uiState.textContent = t; }
  function syncHUD(){
    if (uiScore) uiScore.textContent = String(Math.floor(score));
    if (uiBest)  uiBest.textContent = String(best);
    if (uiSpeed) uiSpeed.textContent = String(Math.round(speed * 10) / 10);
  }

  function reset(){
    running = false;
    paused = false;
    gameOver = false;

    score = 0;
    speed = 6.0;

    pl.y = groundY;
    pl.vy = 0;
    pl.onGround = true;

    obs = [];
    spawnT = 35;

    setState('READY');
    syncHUD();
  }

  function start(){
    if (gameOver) return;
    running = true;
    paused = false;
    setState('RUN');
  }

  function togglePause(){
    if (!running || gameOver) return;
    paused = !paused;
    setState(paused ? 'PAUSE' : 'RUN');
  }

  function jump(){
    if (gameOver) return;
    if (!running) start();
    if (paused) return;
    if (pl.onGround){
      pl.vy = -jumpV;
      pl.onGround = false;
    }
  }

  function die(){
    gameOver = true;
    running = false;
    setState('INK RIBBON!');
    best = Math.max(best, Math.floor(score));
    localStorage.setItem(LS_KEY, String(best));
    syncHUD();
  }

  // obstacle types
  function spawn(){
    // 2 typy: niskie i wysokie (do przeskoku / do podskoku w odpowiednim momencie)
    const type = Math.random() < 0.72 ? 'low' : 'high';
    const w = type === 'low' ? 22 : 26;
    const h = type === 'low' ? 26 : 42;
    const y = type === 'low' ? groundY - h : groundY - h;
    obs.push({
      x: W + 30,
      y,
      w,
      h,
      type,
    });

    // odstęp rośnie razem z prędkością, ale z losowością
    const baseGap = 55 + Math.random()*50;
    const speedGap = clamp(130 - speed*6, 58, 120);
    spawnT = baseGap + speedGap;
  }

  function aabb(a,b){
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function update(dt){
    // difficulty scaling
    score += 0.22 * dt * speed;
    speed = Math.min(13.5, speed + 0.0016 * dt * 60);

    // player physics
    pl.vy += gravity * dt;
    pl.y += pl.vy * dt;

    if (pl.y >= groundY){
      pl.y = groundY;
      pl.vy = 0;
      pl.onGround = true;
    }

    // spawn
    spawnT -= dt * 10;
    if (spawnT <= 0) spawn();

    // move obstacles
    const move = speed * dt * 10;
    for (const o of obs) o.x -= move;
    obs = obs.filter(o => o.x + o.w > -40);

    // collision
    const plBox = { x: pl.x, y: pl.y - pl.h, w: pl.w, h: pl.h };
    for (const o of obs){
      if (aabb(plBox, o)){
        die();
        break;
      }
    }

    syncHUD();
  }

  function draw(){
    ctx.clearRect(0,0,W,H);

    // ground
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(0, groundY, W, H - groundY);

    // player (taboret-runner kwadrat)
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(pl.x, pl.y - pl.h, pl.w, pl.h);

    // obstacles (ink ribbons)
    for (const o of obs){
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      // mała "wstążka" – pasek
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(o.x + 2, o.y + 6, o.w - 4, 4);
      ctx.fillRect(o.x + 2, o.y + o.h - 12, o.w - 4, 4);
    }

    // overlay text
    if (!running || paused || gameOver){
      const msg = gameOver ? 'R — restart' : (!running ? 'Tap/Space — jump' : 'P — resume');
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = '16px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.textAlign = 'center';
      ctx.fillText(msg, W/2, H/2);
      ctx.textAlign = 'left';
    }
  }

  // input
  function onKey(e, down){
    if (!down) return;
    const k = e.key.toLowerCase();
    if (k === 'p') { togglePause(); return; }
    if (k === 'r') { reset(); return; }
    if (k === ' ' || k === 'arrowup' || k === 'w' || k === 'enter'){ jump(); e.preventDefault(); }
  }
  window.addEventListener('keydown', (e)=>onKey(e,true), {passive:false});

  // tap / click
  canvas.addEventListener('mousedown', ()=>jump(), {passive:true});
  canvas.addEventListener('touchstart', (e)=>{ jump(); }, {passive:true});

  // loop
  let last = performance.now();
  function loop(t){
    const dt = Math.min(1.8, (t - last) / 16.6667);
    last = t;

    if (running && !paused && !gameOver){
      update(dt);
    }
    draw();
    requestAnimationFrame(loop);
  }

  reset();
  requestAnimationFrame(loop);
})();