/* Breakout / Arkanoid (TaboLore Minigierki)
   Sterowanie:
   - Ruch paletki: A/D lub ←/→ (albo przeciąganie palcem/myszką)
   - Start: Enter / Space
   - Pauza: P
   - Restart: R
   Wymagane ID w HTML (rekomendowane):
   canvas:      bo
   HUD:         boScore, boBest, boLives, boLevel, boState
*/
(() => {
  const canvas = document.getElementById('bo') || document.getElementById('breakout');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const uiScore = document.getElementById('boScore');
  const uiBest  = document.getElementById('boBest');
  const uiLives = document.getElementById('boLives');
  const uiLevel = document.getElementById('boLevel');
  const uiState = document.getElementById('boState');

  const LS_KEY = 'tabolore_breakout_best';

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  // Paddle / ball
  const paddle = { w: Math.floor(W*0.18), h: 12, x: W/2, y: H - 26, vx: 0 };
  const ball = { r: 7, x: W/2, y: H - 50, vx: 0, vy: 0, stuck: true };

  // Bricks
  const brick = { rows: 6, cols: 10, pad: 10, top: 64, h: 18 };
  let bricks = [];
  let level = 1;
  let score = 0;
  let best = Number(localStorage.getItem(LS_KEY) || 0);
  let lives = 3;

  let running = false;
  let paused = false;
  let gameOver = false;

  function setState(t){ if (uiState) uiState.textContent = t; }
  function syncHUD(){
    if (uiScore) uiScore.textContent = String(score);
    if (uiBest)  uiBest.textContent  = String(best);
    if (uiLives) uiLives.textContent = String(lives);
    if (uiLevel) uiLevel.textContent = String(level);
  }

  function makeBricks(){
    bricks = [];
    const usableW = W - 40;
    const bw = Math.floor((usableW - (brick.cols-1)*brick.pad) / brick.cols);
    for (let r=0; r<brick.rows; r++){
      for (let c=0; c<brick.cols; c++){
        bricks.push({
          x: 20 + c*(bw + brick.pad),
          y: brick.top + r*(brick.h + 10),
          w: bw,
          h: brick.h,
          hp: 1 + (r >= brick.rows-2 ? 1 : 0) + (level >= 3 && r < 2 ? 1 : 0) // trochę twardsze na później
        });
      }
    }
  }

  function resetBall(stick=true){
    ball.x = paddle.x;
    ball.y = paddle.y - 18;
    ball.vx = 0;
    ball.vy = 0;
    ball.stuck = stick;
  }

  function start(){
    if (gameOver) return;
    running = true;
    paused = false;
    if (ball.stuck){
      const base = 5.2 + Math.min(2.6, level*0.4);
      ball.vx = (Math.random()<0.5 ? -1 : 1) * base;
      ball.vy = -base;
      ball.stuck = false;
    }
    setState('PLAY');
  }

  function togglePause(){
    if (!running || gameOver) return;
    paused = !paused;
    setState(paused ? 'PAUSE' : 'PLAY');
  }

  function restartAll(){
    level = 1;
    score = 0;
    lives = 3;
    gameOver = false;
    running = false;
    paused = false;
    paddle.w = Math.floor(W*0.18);
    paddle.x = W/2;
    makeBricks();
    resetBall(true);
    setState('READY');
    syncHUD();
  }

  function nextLevel(){
    level += 1;
    brick.rows = clamp(6 + Math.floor((level-1)/2), 6, 9);
    brick.cols = 10;
    makeBricks();
    paddle.w = clamp(paddle.w - 6, 80, Math.floor(W*0.22));
    resetBall(true);
    running = false;
    setState('LEVEL ' + level);
    syncHUD();
  }

  function loseLife(){
    lives -= 1;
    if (lives <= 0){
      gameOver = true;
      running = false;
      setState('GAME OVER');
      best = Math.max(best, score);
      localStorage.setItem(LS_KEY, String(best));
    } else {
      running = false;
      resetBall(true);
      setState('READY');
    }
    syncHUD();
  }

  // Input
  const keys = { left:false, right:false };
  function onKey(e, down){
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a'){ keys.left = down; e.preventDefault(); }
    if (k === 'arrowright' || k === 'd'){ keys.right = down; e.preventDefault(); }

    if (!down) return;
    if (k === 'p') togglePause();
    if (k === 'r') restartAll();
    if (k === 'enter' || k === ' ') { if (!running) start(); }
  }
  window.addEventListener('keydown', (e)=>onKey(e,true), {passive:false});
  window.addEventListener('keyup',   (e)=>onKey(e,false), {passive:false});

  // Pointer move paddle
  let dragging = false;
  function pointerX(ev){
    const rect = canvas.getBoundingClientRect();
    const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
    return (clientX - rect.left) * (W / rect.width);
  }
  function setPaddleTo(x){
    paddle.x = clamp(x, paddle.w/2 + 8, W - paddle.w/2 - 8);
  }

  canvas.addEventListener('mousedown', (e)=>{ dragging=true; setPaddleTo(pointerX(e)); if(!running) start(); }, {passive:true});
  window.addEventListener('mouseup', ()=>dragging=false, {passive:true});
  window.addEventListener('mousemove', (e)=>{ if(!dragging) return; setPaddleTo(pointerX(e)); }, {passive:true});

  canvas.addEventListener('touchstart', (e)=>{ dragging=true; setPaddleTo(pointerX(e)); if(!running) start(); }, {passive:true});
  canvas.addEventListener('touchmove',  (e)=>{ if(!dragging) return; setPaddleTo(pointerX(e)); }, {passive:true});
  canvas.addEventListener('touchend',   ()=>dragging=false, {passive:true});
  canvas.addEventListener('touchcancel',()=>dragging=false, {passive:true});

  function circleRectCollide(cx,cy,cr, rx,ry,rw,rh){
    const nx = clamp(cx, rx, rx+rw);
    const ny = clamp(cy, ry, ry+rh);
    const dx = cx - nx, dy = cy - ny;
    return (dx*dx + dy*dy) <= cr*cr;
  }

  function bounceOffPaddle(){
    // bounce angle based on hit position
    const rel = (ball.x - paddle.x) / (paddle.w/2); // -1..1
    const base = 5.4 + Math.min(3.0, level*0.35);
    ball.vx = clamp(rel, -1, 1) * base;
    ball.vy = -Math.max(3.6, base);
  }

  function update(dt){
    // paddle by keys
    const sp = 7.6;
    let dir = 0;
    if (keys.left) dir -= 1;
    if (keys.right) dir += 1;
    if (dir !== 0) setPaddleTo(paddle.x + dir * sp * dt);

    // ball stuck to paddle
    if (ball.stuck){
      ball.x = paddle.x;
      ball.y = paddle.y - 18;
      return;
    }

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // walls
    if (ball.x - ball.r <= 0){ ball.x = ball.r; ball.vx *= -1; }
    if (ball.x + ball.r >= W){ ball.x = W - ball.r; ball.vx *= -1; }
    if (ball.y - ball.r <= 0){ ball.y = ball.r; ball.vy *= -1; }

    // bottom
    if (ball.y - ball.r > H){
      loseLife();
      return;
    }

    // paddle
    if (circleRectCollide(ball.x, ball.y, ball.r, paddle.x - paddle.w/2, paddle.y, paddle.w, paddle.h) && ball.vy > 0){
      bounceOffPaddle();
      ball.y = paddle.y - ball.r - 0.5;
    }

    // bricks
    let remaining = 0;
    for (const b of bricks){
      if (b.hp <= 0) continue;
      remaining++;
      if (circleRectCollide(ball.x, ball.y, ball.r, b.x, b.y, b.w, b.h)){
        b.hp -= 1;
        score += 10;
        // determine bounce direction: compare penetration
        const midX = b.x + b.w/2;
        const midY = b.y + b.h/2;
        const dx = (ball.x - midX) / (b.w/2);
        const dy = (ball.y - midY) / (b.h/2);
        if (Math.abs(dx) > Math.abs(dy)) ball.vx *= -1;
        else ball.vy *= -1;
        break;
      }
    }

    if (remaining === 0){
      best = Math.max(best, score);
      localStorage.setItem(LS_KEY, String(best));
      nextLevel();
    }
  }

  function draw(){
    ctx.clearRect(0,0,W,H);

    // bricks
    for (const b of bricks){
      if (b.hp <= 0) continue;
      ctx.fillStyle = b.hp >= 3 ? 'rgba(255,255,255,0.28)' : (b.hp === 2 ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.14)');
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.strokeRect(b.x+0.5, b.y+0.5, b.w-1, b.h-1);
    }

    // paddle
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(paddle.x - paddle.w/2, paddle.y, paddle.w, paddle.h);

    // ball
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2);
    ctx.fill();

    // overlays
    if (!running || paused || gameOver){
      const msg = gameOver ? 'R — restart' : (!running ? 'Enter/Space — start' : 'P — resume');
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = '16px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.textAlign = 'center';
      ctx.fillText(msg, W/2, H/2);
      ctx.textAlign = 'left';
    }
  }

  // loop
  let last = performance.now();
  function loop(t){
    const dt = Math.min(1.7, (t - last) / 16.6667);
    last = t;

    if (running && !paused && !gameOver){
      update(dt);
    }
    draw();
    requestAnimationFrame(loop);
  }

  makeBricks();
  restartAll();
  requestAnimationFrame(loop);
})();