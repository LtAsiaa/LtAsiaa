/* Pong vs CPU (TaboLore Minigierki)
   Sterowanie:
   - Gracz: W/S lub ↑/↓ (albo przeciąganie paletki palcem/myszką)
   - Start: Enter / Space
   - Pauza: P
   - Restart: R
   - Zmiana trudności: 1=Easy, 2=Normal, 3=Hard, 4=Insane (lub select#pgDifficulty jeśli istnieje)
   Wymagane ID w HTML (rekomendowane):
   canvas:      pg
   HUD:         pgPL, pgCPU, pgBest, pgDiff, pgState
*/
(() => {
  const canvas = document.getElementById('pg') || document.getElementById('pong');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const uiPL   = document.getElementById('pgPL');
  const uiCPU  = document.getElementById('pgCPU');
  const uiBest = document.getElementById('pgBest');
  const uiDiff = document.getElementById('pgDiff');
  const uiState= document.getElementById('pgState');
  const selDiff= document.getElementById('pgDifficulty');

  const LS_KEY = 'tabolore_pong_best_wins';

  const DIFFS = [
    { key:'easy',   label:'EASY',   aiMaxSpeed: 4.0,  aiReaction: 0.18, aiDeadZone: 26 },
    { key:'normal', label:'NORMAL', aiMaxSpeed: 5.4,  aiReaction: 0.28, aiDeadZone: 18 },
    { key:'hard',   label:'HARD',   aiMaxSpeed: 6.6,  aiReaction: 0.42, aiDeadZone: 12 },
    { key:'insane', label:'INSANE', aiMaxSpeed: 8.2,  aiReaction: 0.60, aiDeadZone:  6 },
  ];

  let diffIdx = 1;

  // Physics / sizes
  const paddleW = 14;
  const paddleH = Math.max(64, Math.floor(H * 0.18));
  const ballR   = 7;
  const netW    = 2;

  // Game state
  let running = false;
  let paused  = false;
  let gameOver= false;

  let plScore = 0;
  let cpuScore = 0;
  let bestWins = Number(localStorage.getItem(LS_KEY) || 0);

  // Entities
  const player = { x: 18, y: (H - paddleH) / 2, vy: 0 };
  const cpu    = { x: W - 18 - paddleW, y: (H - paddleH) / 2, vy: 0 };
  const ball   = { x: W / 2, y: H / 2, vx: 0, vy: 0 };

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function rndSign(){ return Math.random() < 0.5 ? -1 : 1; }

  function setState(text){
    if (uiState) uiState.textContent = text;
  }

  function setDiff(i){
    diffIdx = clamp(i, 0, DIFFS.length - 1);
    const d = DIFFS[diffIdx];
    if (uiDiff) uiDiff.textContent = d.label;
    if (selDiff) selDiff.value = d.key;
  }

  function syncHUD(){
    if (uiPL) uiPL.textContent = String(plScore);
    if (uiCPU) uiCPU.textContent = String(cpuScore);
    if (uiBest) uiBest.textContent = String(bestWins);
    if (uiDiff) uiDiff.textContent = DIFFS[diffIdx].label;
  }

  function resetBall(toLeft){
    ball.x = W / 2;
    ball.y = H / 2 + (Math.random() * 80 - 40);
    const base = 5.2;
    const angle = (Math.random() * 0.7 - 0.35); // ~-20..20 deg
    ball.vx = (toLeft ? -1 : 1) * base;
    ball.vy = base * angle * 1.6;
  }

  function resetAll(){
    running = false;
    paused = false;
    gameOver = false;

    plScore = 0;
    cpuScore = 0;

    player.y = (H - paddleH)/2;
    cpu.y    = (H - paddleH)/2;
    player.vy = 0;
    cpu.vy = 0;

    resetBall(Math.random() < 0.5);
    setState('READY');
    syncHUD();
  }

  function start(){
    if (gameOver) return;
    running = true;
    paused = false;
    setState('PLAY');
  }

  function togglePause(){
    if (!running || gameOver) return;
    paused = !paused;
    setState(paused ? 'PAUSE' : 'PLAY');
  }

  function endRound(){
    // first to 10
    if (plScore >= 10 || cpuScore >= 10){
      running = false;
      gameOver = true;
      const win = plScore > cpuScore;
      if (win){
        bestWins = Math.max(bestWins, 1);
        localStorage.setItem(LS_KEY, String(bestWins));
      }
      setState(win ? 'YOU WIN' : 'CPU WINS');
      syncHUD();
    } else {
      running = false;
      setState('READY');
    }
  }

  function scorePoint(playerScored){
    if (playerScored) plScore += 1;
    else cpuScore += 1;
    syncHUD();
    resetBall(!playerScored);
    endRound();
  }

  function paddleHit(p, isPlayer){
    // reflect
    const rel = ((ball.y - (p.y + paddleH/2)) / (paddleH/2)); // -1..1
    const maxBounce = 1.15; // vy multiplier range
    ball.vy = clamp(rel, -1, 1) * (6.2 * maxBounce);

    // speed up slightly
    const speed = Math.min(9.8, Math.hypot(ball.vx, ball.vy) + 0.25);
    const dir = isPlayer ? 1 : -1;
    const angle = Math.atan2(ball.vy, Math.abs(ball.vx));
    ball.vx = dir * Math.cos(angle) * speed;

    // nudge out of paddle to avoid sticking
    ball.x = isPlayer ? (p.x + paddleW + ballR + 0.5) : (p.x - ballR - 0.5);
  }

  function updatePlayer(dt, keys){
    const speed = 7.4;
    let dir = 0;
    if (keys.up) dir -= 1;
    if (keys.down) dir += 1;

    player.y = clamp(player.y + dir * speed * dt, 8, H - paddleH - 8);
  }

  function updateCPU(dt){
    const d = DIFFS[diffIdx];

    // desired target: follow ball, but with a deadzone to feel human
    const target = ball.y - paddleH/2;
    const center = cpu.y + paddleH/2;
    const dy = ball.y - center;

    // reaction smoothing
    const desire = clamp(dy, -80, 80) * d.aiReaction;

    // deadzone
    let move = 0;
    if (Math.abs(dy) > d.aiDeadZone) move = desire;

    cpu.y = clamp(cpu.y + clamp(move, -d.aiMaxSpeed, d.aiMaxSpeed) * dt, 8, H - paddleH - 8);
  }

  function updateBall(dt){
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // walls
    if (ball.y - ballR <= 0){
      ball.y = ballR;
      ball.vy *= -1;
    }
    if (ball.y + ballR >= H){
      ball.y = H - ballR;
      ball.vy *= -1;
    }

    // score
    if (ball.x + ballR < 0) scorePoint(false);
    if (ball.x - ballR > W) scorePoint(true);

    // collision with paddles
    // player
    if (ball.vx < 0){
      const hitX = ball.x - ballR <= player.x + paddleW && ball.x > player.x;
      const hitY = ball.y + ballR >= player.y && ball.y - ballR <= player.y + paddleH;
      if (hitX && hitY) paddleHit(player, true);
    } else {
      const hitX = ball.x + ballR >= cpu.x && ball.x < cpu.x + paddleW;
      const hitY = ball.y + ballR >= cpu.y && ball.y - ballR <= cpu.y + paddleH;
      if (hitX && hitY) paddleHit(cpu, false);
    }
  }

  function draw(){
    // background
    ctx.clearRect(0,0,W,H);

    // court
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let y=10; y<H; y+=24){
      ctx.fillRect(W/2 - netW/2, y, netW, 12);
    }

    // paddles & ball
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(player.x, player.y, paddleW, paddleH);
    ctx.fillRect(cpu.x, cpu.y, paddleW, paddleH);

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ballR, 0, Math.PI*2);
    ctx.fill();

    // overlays
    if (!running || paused || gameOver){
      const msg = gameOver ? 'R — restart' : (!running ? 'Enter/Space — start • 1-4 — AI' : 'P — resume');
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = '16px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.textAlign = 'center';
      ctx.fillText(msg, W/2, H/2);
      ctx.textAlign = 'left';
    }
  }

  // Input
  const keys = { up:false, down:false };
  function onKey(e, down){
    const k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') { keys.up = down; e.preventDefault(); }
    if (k === 'arrowdown' || k === 's') { keys.down = down; e.preventDefault(); }

    if (!down) return;

    if (k === 'p') togglePause();
    if (k === 'r') { resetAll(); }
    if (k === 'enter' || k === ' ') { if (!running) start(); }

    if (k === '1') setDiff(0);
    if (k === '2') setDiff(1);
    if (k === '3') setDiff(2);
    if (k === '4') setDiff(3);

    syncHUD();
  }
  window.addEventListener('keydown', (e)=>onKey(e,true), { passive:false });
  window.addEventListener('keyup',   (e)=>onKey(e,false), { passive:false });

  // Touch / mouse drag (move player's paddle to pointer Y)
  let dragging = false;

  function pointerY(ev){
    const rect = canvas.getBoundingClientRect();
    const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
    const y = (clientY - rect.top) * (H / rect.height);
    return y;
  }
  function setPlayerTo(y){
    player.y = clamp(y - paddleH/2, 8, H - paddleH - 8);
  }

  canvas.addEventListener('mousedown', (e)=>{ dragging=true; setPlayerTo(pointerY(e)); if(!running) start(); }, {passive:true});
  window.addEventListener('mouseup', ()=>dragging=false, {passive:true});
  window.addEventListener('mousemove', (e)=>{ if(!dragging) return; setPlayerTo(pointerY(e)); }, {passive:true});

  canvas.addEventListener('touchstart', (e)=>{ dragging=true; setPlayerTo(pointerY(e)); if(!running) start(); }, {passive:true});
  canvas.addEventListener('touchmove', (e)=>{ if(!dragging) return; setPlayerTo(pointerY(e)); }, {passive:true});
  canvas.addEventListener('touchend', ()=>dragging=false, {passive:true});
  canvas.addEventListener('touchcancel', ()=>dragging=false, {passive:true});

  if (selDiff){
    // allow select values: easy/normal/hard/insane
    selDiff.addEventListener('change', () => {
      const idx = DIFFS.findIndex(d => d.key === selDiff.value);
      setDiff(idx >= 0 ? idx : 1);
      syncHUD();
    });
  }

  // Main loop
  let last = performance.now();
  function loop(t){
    const dt = Math.min(1.6, (t - last) / 16.6667); // normalize to ~60fps units
    last = t;

    if (running && !paused && !gameOver){
      updatePlayer(dt, keys);
      updateCPU(dt);
      updateBall(dt);
    }
    draw();
    requestAnimationFrame(loop);
  }

  // init
  setDiff(diffIdx);
  resetAll();
  requestAnimationFrame(loop);
})();