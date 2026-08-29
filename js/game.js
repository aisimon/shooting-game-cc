(() => {
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ---------- State ----------
const STATE = { START: 'start', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' };
let state = STATE.START;

const BEST_KEY = 'neon-blitz-best';
let best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
document.getElementById('best').textContent = best;

let score = 0;
let lives = 3;
let wave = 1;
let waveTimer = 0;
let spawnQueue = [];
let spawnTimer = 0;

const player = {
  x: 0, y: 0, tx: 0, ty: 0, r: 16,
  cooldown: 0, invuln: 0, power: 0
};

let bullets = [];       // player bullets
let enemyBullets = [];
let enemies = [];
let particles = [];
let powerups = [];
let stars = [];

function resetGame() {
  score = 0; lives = 3; wave = 0;
  bullets = []; enemyBullets = []; enemies = []; particles = []; powerups = [];
  player.x = W / 2; player.y = H - H * 0.18;
  player.tx = player.x; player.ty = player.y;
  player.cooldown = 0; player.invuln = 2; player.power = 0;
  spawnQueue = [];
  waveTimer = 0;
  nextWave();
  updateHud();
}

for (let i = 0; i < 120; i++) {
  stars.push({
    x: Math.random(), y: Math.random(),
    z: 0.3 + Math.random() * 1.2,
    r: Math.random() * 1.6 + 0.4
  });
}

// ---------- Input (unified pointer for mouse + touch) ----------
let pointerActive = false;
canvas.addEventListener('pointerdown', (e) => {
  SFX.unlock();
  pointerActive = true;
  setTargetFromEvent(e);
});
canvas.addEventListener('pointermove', (e) => {
  if (pointerActive) setTargetFromEvent(e);
});
window.addEventListener('pointerup', () => { pointerActive = false; });
window.addEventListener('pointercancel', () => { pointerActive = false; });

function setTargetFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  player.tx = e.clientX - rect.left;
  player.ty = e.clientY - rect.top - 40; // offset so finger doesn't cover ship
}

// ---------- UI wiring ----------
const startScreen = document.getElementById('start-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const pauseScreen = document.getElementById('pause-screen');
const waveBanner = document.getElementById('wave-banner');

document.getElementById('start-btn').addEventListener('click', () => {
  SFX.unlock();
  startScreen.classList.add('hidden');
  resetGame();
  state = STATE.PLAYING;
  SFX.startMusic();
});

document.getElementById('retry-btn').addEventListener('click', () => {
  gameoverScreen.classList.add('hidden');
  resetGame();
  state = STATE.PLAYING;
  SFX.startMusic();
});

document.getElementById('pause-btn').addEventListener('click', () => {
  if (state === STATE.PLAYING) {
    state = STATE.PAUSED;
    pauseScreen.classList.remove('hidden');
  }
});
document.getElementById('resume-btn').addEventListener('click', () => {
  if (state === STATE.PAUSED) {
    state = STATE.PLAYING;
    pauseScreen.classList.add('hidden');
  }
});

const muteBtn = document.getElementById('mute-btn');
muteBtn.addEventListener('click', () => {
  const m = !SFX.isMuted();
  SFX.setMuted(m);
  muteBtn.textContent = m ? '🔇' : '🔊';
});

function updateHud() {
  document.getElementById('score').textContent = score;
  document.getElementById('best').textContent = best;
  const livesEl = document.getElementById('lives');
  livesEl.innerHTML = '';
  for (let i = 0; i < lives; i++) {
    const s = document.createElement('span');
    s.textContent = '♥';
    s.style.color = '#ff5c8a';
    livesEl.appendChild(s);
  }
}

function flashWave(text) {
  waveBanner.textContent = text;
  waveBanner.classList.add('show');
  clearTimeout(flashWave._t);
  flashWave._t = setTimeout(() => waveBanner.classList.remove('show'), 1400);
}

// ---------- Enemy definitions ----------
const ENEMY_TYPES = {
  grunt:  { r: 14, hp: 1, speed: 90,  color: '#7cf7ff', score: 10, shoots: false },
  shooter:{ r: 16, hp: 2, speed: 70,  color: '#ffd76c', score: 20, shoots: true  },
  tank:   { r: 24, hp: 5, speed: 45,  color: '#ff5c8a', score: 40, shoots: true  }
};

function nextWave() {
  wave++;
  flashWave('WAVE ' + wave);
  SFX.waveStart();
  const count = 5 + wave * 2;
  spawnQueue = [];
  for (let i = 0; i < count; i++) {
    let type = 'grunt';
    const r = Math.random();
    if (wave >= 2 && r > 0.6) type = 'shooter';
    if (wave >= 4 && r > 0.85) type = 'tank';
    spawnQueue.push(type);
  }
  spawnTimer = 0.6;
  waveTimer = 0;
}

function spawnEnemy(type) {
  const def = ENEMY_TYPES[type];
  enemies.push({
    type, x: 30 + Math.random() * (W - 60), y: -30,
    hp: def.hp, maxHp: def.hp, r: def.r, speed: def.speed,
    color: def.color, score: def.score, shoots: def.shoots,
    phase: Math.random() * Math.PI * 2, shootTimer: 1 + Math.random() * 1.5,
    vxAmp: 40 + Math.random() * 40
  });
}

// ---------- Particles ----------
function burst(x, y, color, n, speedMax) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = Math.random() * speedMax;
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.4 + Math.random() * 0.4, maxLife: 0.4 + Math.random() * 0.4,
      color, r: 1.5 + Math.random() * 2.5
    });
  }
}

function spawnPowerup(x, y) {
  if (Math.random() < 0.18) {
    powerups.push({ x, y, vy: 70, r: 12 });
  }
}

// ---------- Game logic ----------
function playerShoot(dt) {
  player.cooldown -= dt;
  if (player.cooldown <= 0) {
    const spread = player.power > 0 ? [-0.18, 0, 0.18] : [0];
    for (const a of spread) {
      bullets.push({
        x: player.x + Math.sin(a) * 6, y: player.y - player.r,
        vx: Math.sin(a) * 260, vy: -560, r: 3
      });
    }
    SFX.shoot();
    player.cooldown = player.power > 0 ? 0.14 : 0.22;
  }
}

function damagePlayer() {
  if (player.invuln > 0) return;
  lives--;
  player.invuln = 1.6;
  SFX.playerHit();
  burst(player.x, player.y, '#38e6ff', 20, 160);
  updateHud();
  if (lives <= 0) {
    endGame();
  }
}

function endGame() {
  state = STATE.GAMEOVER;
  SFX.stopMusic();
  SFX.gameOver();
  document.getElementById('final-score').textContent = score;
  const msg = document.getElementById('new-best-msg');
  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, String(best));
    msg.textContent = 'NEW BEST!';
  } else {
    msg.textContent = '';
  }
  updateHud();
  gameoverScreen.classList.remove('hidden');
}

function update(dt) {
  // starfield always drifts, even on menus
  for (const s of stars) {
    s.y += dt * 0.05 * s.z;
    if (s.y > 1) s.y -= 1;
  }

  if (state !== STATE.PLAYING) return;

  // player movement (smooth follow toward pointer target)
  const followSpeed = 14;
  player.x += (player.tx - player.x) * Math.min(1, followSpeed * dt);
  player.y += (player.ty - player.y) * Math.min(1, followSpeed * dt);
  player.x = Math.max(player.r, Math.min(W - player.r, player.x));
  player.y = Math.max(player.r, Math.min(H - player.r, player.y));

  if (player.invuln > 0) player.invuln -= dt;
  if (player.power > 0) player.power -= dt;

  playerShoot(dt);

  // spawn queue
  if (spawnQueue.length) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnEnemy(spawnQueue.shift());
      spawnTimer = Math.max(0.25, 0.9 - wave * 0.05);
    }
  } else if (enemies.length === 0) {
    waveTimer += dt;
    if (waveTimer > 1.2) nextWave();
  }

  // bullets
  for (const b of bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
  bullets = bullets.filter(b => b.y > -20 && b.x > -20 && b.x < W + 20);

  for (const b of enemyBullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
  enemyBullets = enemyBullets.filter(b => b.y < H + 20);

  // enemies
  for (const e of enemies) {
    e.phase += dt;
    e.y += e.speed * dt;
    e.x += Math.sin(e.phase) * e.vxAmp * dt;
    e.x = Math.max(e.r, Math.min(W - e.r, e.x));

    if (e.shoots) {
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && e.y > 0 && e.y < H * 0.8) {
        const dx = player.x - e.x, dy = player.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        enemyBullets.push({ x: e.x, y: e.y, vx: dx / d * 200, vy: dy / d * 200, r: 4 });
        SFX.enemyShoot();
        e.shootTimer = 1.4 + Math.random();
      }
    }

    if (e.y - e.r > H) e.dead = true; // escaped
  }

  // player bullets vs enemies
  for (const b of bullets) {
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = b.x - e.x, dy = b.y - e.y;
      if (dx * dx + dy * dy < (e.r + b.r) * (e.r + b.r)) {
        e.hp--;
        b.dead = true;
        burst(b.x, b.y, e.color, 4, 60);
        if (e.hp <= 0) {
          e.dead = true;
          score += e.score;
          burst(e.x, e.y, e.color, 18, 180);
          spawnPowerup(e.x, e.y);
          e.big ? SFX.explosionBig() : SFX.explosionSmall();
          updateHud();
        }
        break;
      }
    }
  }
  bullets = bullets.filter(b => !b.dead);
  enemies = enemies.filter(e => !e.dead);

  // enemy bullets vs player
  for (const b of enemyBullets) {
    const dx = b.x - player.x, dy = b.y - player.y;
    if (dx * dx + dy * dy < (player.r * 0.7 + b.r) * (player.r * 0.7 + b.r)) {
      b.dead = true;
      damagePlayer();
    }
  }
  enemyBullets = enemyBullets.filter(b => !b.dead);

  // enemies vs player (collision)
  for (const e of enemies) {
    const dx = e.x - player.x, dy = e.y - player.y;
    if (dx * dx + dy * dy < (e.r + player.r * 0.7) * (e.r + player.r * 0.7)) {
      e.dead = true;
      burst(e.x, e.y, e.color, 14, 140);
      damagePlayer();
    }
  }
  enemies = enemies.filter(e => !e.dead);

  // powerups
  for (const p of powerups) p.y += p.vy * dt;
  for (const p of powerups) {
    const dx = p.x - player.x, dy = p.y - player.y;
    if (dx * dx + dy * dy < (p.r + player.r) * (p.r + player.r)) {
      p.dead = true;
      player.power = 6;
      score += 5;
      SFX.powerup();
      updateHud();
    }
  }
  powerups = powerups.filter(p => !p.dead && p.y < H + 20);

  // particles
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.92; p.vy *= 0.92;
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);
}

// ---------- Render ----------
function drawStars() {
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, W, H);
  for (const s of stars) {
    const y = s.y * H;
    const x = s.x * W;
    ctx.globalAlpha = 0.4 + 0.5 * s.z;
    ctx.fillStyle = '#bfe9ff';
    ctx.beginPath();
    ctx.arc(x, y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawShip(x, y, r, color, invuln) {
  ctx.save();
  ctx.translate(x, y);
  if (invuln > 0 && Math.floor(invuln * 10) % 2 === 0) ctx.globalAlpha = 0.4;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.8, r * 0.9);
  ctx.lineTo(0, r * 0.5);
  ctx.lineTo(-r * 0.8, r * 0.9);
  ctx.closePath();
  ctx.fill();
  // engine flame
  const flick = 6 + Math.random() * 6;
  ctx.fillStyle = 'rgba(255,180,80,0.85)';
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, r * 0.6);
  ctx.lineTo(0, r * 0.6 + flick);
  ctx.lineTo(r * 0.3, r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEnemy(e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.shadowColor = e.color;
  ctx.shadowBlur = 12;
  ctx.fillStyle = e.color;
  if (e.type === 'grunt') {
    ctx.beginPath();
    ctx.moveTo(0, e.r);
    ctx.lineTo(e.r, -e.r * 0.6);
    ctx.lineTo(-e.r, -e.r * 0.6);
    ctx.closePath();
    ctx.fill();
  } else if (e.type === 'shooter') {
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#05060f';
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.rect(-e.r, -e.r, e.r * 2, e.r * 2);
    ctx.fill();
  }
  ctx.restore();

  if (e.hp < e.maxHp) {
    const w = e.r * 2;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w, 3);
    ctx.fillStyle = '#7cf7ff';
    ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w * (e.hp / e.maxHp), 3);
  }
}

function render() {
  drawStars();

  if (state === STATE.PLAYING || state === STATE.PAUSED) {
    // powerups
    for (const p of powerups) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.shadowColor = '#7cffa0';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#7cffa0';
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#05060f';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('P', 0, 1);
      ctx.restore();
    }

    for (const e of enemies) drawEnemy(e);

    ctx.fillStyle = '#38e6ff';
    ctx.shadowColor = '#38e6ff';
    ctx.shadowBlur = 8;
    for (const b of bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#ff8a5c';
    ctx.shadowColor = '#ff8a5c';
    for (const b of enemyBullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    drawShip(player.x, player.y, player.r, player.power > 0 ? '#7cffa0' : '#38e6ff', player.invuln);
  }
}

// ---------- Main loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

})();
