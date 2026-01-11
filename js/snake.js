/* Snake – Nokia vibes (TaboLore)
   Sterowanie: WASD/Strzałki, P pauza, R restart, Enter start
   Touch: swipe kierunek
*/
(() => {
  const canvas = document.getElementById('sn');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const uiScore = document.getElementById('snScore');
  const uiBest  = document.getElementById('snBest');
  const uiSpeed = document.getElementById('snSpeed');
  const uiState = document.getElementById('snState');

  const COL = {
    bg: '#07090b',
    grid: 'rgba(57,255,136,.10)',
    neon: '#39ff88',
    neon2: 'rgba(57,255,136,.35)',
    text: 'rgba(232,240,236,.92)',
    muted: 'rgba(159,179,170,.75)',
    food: 'rgba(57,255,136,.85)',
    bad: 'rgba(255,120,120,.95)'
  };

  // plansza w kratkach (dopasowana do canvasu)
  const CELL = 16;                        // im większe tym bardziej "nokia"
  const COLS = Math.floor(W / CELL);
  const ROWS = Math.floor(H / CELL);

  // margines, żeby nie rysować po krawędziach
  const OFFSET_X = Math.floor((W - COLS * CELL) / 2);
  const OFFSET_Y = Math.floor((H - ROWS * CELL) / 2);

  let running = false;
  let paused = false;

  let score = 0;
  let best = Number(localStorage.getItem('snBest') || '0');
  let speedTier = 1;          // 1..n
  let stepEvery = 10;         // im mniejsze tym szybciej (frames na krok)
  let frame = 0;

  // kierunek: (dx, dy)
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };

  // snake jako lista segmentów (x,y w kratkach)
  /** @type {{x:number,y:number}[]} */
  let snake = [];
  let grow = 0;

  // jedzenie
  let food = { x: 0, y: 0 };
  let foodPulse = 0;

  const keys = new Set();

  function setState(txt){
    if (uiState) uiState.textContent = txt;
  }

  function setUI(){
    if (uiScore) uiScore.textContent = String(score);
    if (uiBest) uiBest.textContent = String(best);
    if (uiSpeed) uiSpeed.textContent = String(speedTier);
  }

  function randCell(){
    return {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS),
    };
  }

  function placeFood(){
    // losuj aż trafisz na wolne pole
    for (let tries = 0; tries < 2000; tries++){
      const p = randCell();
      if (!snake.some(s => s.x === p.x && s.y === p.y)){
        food.x = p.x;
        food.y = p.y;
        return;
      }
    }
  }

  function reset(){
    running = true;
    paused = false;
    score = 0;
    speedTier = 1;
    stepEvery = 10;
    frame = 0;

    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };

    const sx = Math.floor(COLS * 0.3);
    const sy = Math.floor(ROWS * 0.5);

    snake = [
      { x: sx - 2, y: sy },
      { x: sx - 1, y: sy },
      { x: sx,     y: sy },
    ];
    grow = 0;
    placeFood();

    setState('PLAY');
    setUI();
  }

  function togglePause(){
    if (!running) return;
    paused = !paused;
    setState(paused ? 'PAUSE' : 'PLAY');
  }

  function gameOver(){
    running = false;
    setState('GAME OVER (R)');
    if (score > best){
      best = score;
      localStorage.setItem('snBest', String(best));
    }
    setUI();
  }

  function canTurn(nd){
    // blokada zawrotki 180°
    return !(nd.x === -dir.x && nd.y === -dir.y);
  }

  function handleInput(){
    if (keys.has('p')) { keys.delete('p'); togglePause(); }
    if (keys.has('r')) { keys.delete('r'); reset(); }
    if (keys.has('enter') && !running) { keys.delete('enter'); reset(); }
    if (paused || !running) return;

    // kierunki
    if ((keys.has('arrowup') || keys.has('w')) && canTurn({x:0,y:-1})) nextDir = {x:0,y:-1};
    if ((keys.has('arrowdown') || keys.has('s')) && canTurn({x:0,y: 1})) nextDir = {x:0,y: 1};
    if ((keys.has('arrowleft') || keys.has('a')) && canTurn({x:-1,y:0})) nextDir = {x:-1,y:0};
    if ((keys.has('arrowright') || keys.has('d')) && canTurn({x: 1,y:0})) nextDir = {x: 1,y:0};
  }

  function step(){
    dir = nextDir;

    const head = snake[snake.length - 1];
    const nx = head.x + dir.x;
    const ny = head.y + dir.y;

    // ściany
    // przechodzenie przez ściany (wrap)
    let wx = nx;
    let wy = ny;

    if (wx < 0) wx = COLS - 1;
    else if (wx >= COLS) wx = 0;

    if (wy < 0) wy = ROWS - 1;
    else if (wy >= ROWS) wy = 0;


    // ogon (self hit) – sprawdzamy wszystko oprócz ewentualnie znikającego segmentu
    const tailWillMove = grow === 0;
    const bodyToCheck = tailWillMove ? snake.slice(1) : snake;
    if (bodyToCheck.some(s => s.x === wx && s.y === wy)) {
      gameOver();
      return;
    }

    // dodaj głowę
    snake.push({ x: wx, y: wy });

    // jedzenie
    if (wx === food.x && wy === food.y){
      score += 1;
      grow += 2; // rośnij "nokiowo" (szybciej czuć progres)
      // prędkość rośnie co 5 punktów
      const newTier = 1 + Math.floor(score / 5);
      if (newTier !== speedTier){
        speedTier = newTier;
        // krok co 10 -> 9 -> 8 -> ... ale nie szybciej niż 5
        stepEvery = Math.max(5, 10 - (speedTier - 1));
      }
      placeFood();
      setUI();
    } else {
      // usuń ogon jeśli nie rośniemy
      if (grow > 0) {
        grow -= 1;
      } else {
        snake.shift();
      }
    }
  }

  function update(){
    handleInput();
    if (!running || paused) return;

    frame++;
    foodPulse = (foodPulse + 1) % 60;

    if (frame % stepEvery === 0){
      step();
    }
  }

  function drawGrid(){
    ctx.strokeStyle = COL.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= COLS; x++){
      const px = OFFSET_X + x * CELL;
      ctx.moveTo(px, OFFSET_Y);
      ctx.lineTo(px, OFFSET_Y + ROWS * CELL);
    }
    for (let y = 0; y <= ROWS; y++){
      const py = OFFSET_Y + y * CELL;
      ctx.moveTo(OFFSET_X, py);
      ctx.lineTo(OFFSET_X + COLS * CELL, py);
    }
    ctx.stroke();
  }

  function drawScanlines(){
    ctx.fillStyle = "rgba(0,0,0,.22)";
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  }

  function cellRect(x,y, pad=2){
    return {
      x: OFFSET_X + x * CELL + pad,
      y: OFFSET_Y + y * CELL + pad,
      w: CELL - pad*2,
      h: CELL - pad*2
    };
  }

  function draw(){
    // bg
    ctx.fillStyle = COL.bg;
    ctx.fillRect(0,0,W,H);

    // scanlines + grid (retro)
    drawScanlines();
    drawGrid();

    // border
    ctx.strokeStyle = "rgba(57,255,136,.22)";
    ctx.lineWidth = 2;
    ctx.strokeRect(OFFSET_X, OFFSET_Y, COLS*CELL, ROWS*CELL);

    // food (pulsujący “punkt”)
    const fp = cellRect(food.x, food.y, 4);
    const pulse = 0.75 + 0.25 * Math.sin((foodPulse/60) * Math.PI * 2);
    ctx.fillStyle = `rgba(57,255,136,${0.55 + 0.35*pulse})`;
    ctx.fillRect(fp.x, fp.y, fp.w, fp.h);
    ctx.strokeStyle = "rgba(57,255,136,.65)";
    ctx.strokeRect(fp.x, fp.y, fp.w, fp.h);

    // snake
    for (let i=0; i<snake.length; i++){
      const s = snake[i];
      const r = cellRect(s.x, s.y, 2);

      const isHead = (i === snake.length - 1);
      ctx.fillStyle = isHead ? "rgba(57,255,136,.40)" : "rgba(57,255,136,.20)";
      ctx.strokeStyle = isHead ? "rgba(57,255,136,.85)" : "rgba(57,255,136,.55)";
      ctx.lineWidth = 2;

      // segment
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeRect(r.x, r.y, r.w, r.h);

      // “oczy” na głowie
      if (isHead){
        ctx.fillStyle = "rgba(232,240,236,.85)";
        const ex = r.x + (dir.x >= 0 ? r.w*0.65 : r.w*0.25);
        const ey1 = r.y + r.h*0.30;
        const ey2 = r.y + r.h*0.70;
        ctx.fillRect(ex, ey1, 2, 2);
        ctx.fillRect(ex, ey2, 2, 2);
      }
    }

    // overlay start/gameover
    if (!running){
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fillRect(0,0,W,H);
      ctx.textAlign = "center";
      ctx.fillStyle = COL.text;
      ctx.font = "700 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText("SNAKE", W/2, H/2 - 18);
      ctx.font = "500 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillStyle = COL.muted;
      ctx.fillText("Enter aby zacząć • R restart • P pauza", W/2, H/2 + 10);
      ctx.fillText("WASD/Strzałki: ruch (bez zawrotki)", W/2, H/2 + 30);
    } else if (paused){
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(0,0,W,H);
      ctx.textAlign = "center";
      ctx.fillStyle = COL.text;
      ctx.font = "700 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText("PAUZA", W/2, H/2);
    }
  }

  function loop(){
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // keyboard
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === ' ') e.preventDefault();
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

  // touch swipe
  let touchStart = null;

  function pt(ev){
    const rect = canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left),
      y: (ev.clientY - rect.top)
    };
  }

  canvas.addEventListener('pointerdown', (ev) => {
    canvas.setPointerCapture(ev.pointerId);
    if (!running) reset();
    touchStart = pt(ev);
  });

  canvas.addEventListener('pointerup', (ev) => {
    if (!touchStart) return;
    const end = pt(ev);
    const dx = end.x - touchStart.x;
    const dy = end.y - touchStart.y;

    const ax = Math.abs(dx), ay = Math.abs(dy);
    const TH = 14;

    if (ax < TH && ay < TH) return;

    if (ax > ay){
      if (dx > 0 && canTurn({x:1,y:0})) nextDir = {x:1,y:0};
      if (dx < 0 && canTurn({x:-1,y:0})) nextDir = {x:-1,y:0};
    } else {
      if (dy > 0 && canTurn({x:0,y:1})) nextDir = {x:0,y:1};
      if (dy < 0 && canTurn({x:0,y:-1})) nextDir = {x:0,y:-1};
    }

    touchStart = null;
  });

  // init UI
  setState('READY');
  setUI();
  loop();
})();
