(() => {
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

let W = 0, H = 0, DPR = 1, GROUND_Y = 0;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = false;
  GROUND_Y = H * 0.8;

  const hint = document.getElementById('rotate-hint');
  if (H > W && W < 900) hint.classList.remove('hidden'); else hint.classList.add('hidden');
}
window.addEventListener('resize', resize);
resize();

// ---------- Constants ----------
const GRAVITY = 2000;
const JUMP_VEL = -680;
const MOVE_SPEED = 230;
const BULLET_SPEED = 700;
const ENEMY_BULLET_SPEED = 260;
const SHOOT_COOLDOWN = 0.26;
const MELEE_COOLDOWN = 0.5;
const MELEE_ACTIVE = 0.15;
const MELEE_RANGE = 36;
const PX = 4; // pixel-art scale
const BOSS_WAVE = 5;

// ---------- State ----------
const STATE = { START: 'start', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover', WIN: 'win' };
let state = STATE.START;

const BEST_KEY = 'iron-frontier-best';
let best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);

let score = 0, lives = 3, maxLives = 3, wave = 0;
let spawnQueue = [], spawnTimer = 0, waveTimer = 0;
let bossActive = false, bossDefeated = false, boss = null;

const camera = { x: 0, targetX: 0, locked: false, lockX: 0 };

const player = {
  x: 100, y: 0, vx: 0, vy: 0, onGround: true, facing: 1,
  runTimer: 0, shootCooldown: 0, meleeCooldown: 0, meleeTimer: 0,
  invuln: 0, shootFlash: 0, r: 15
};

let bullets = [], enemyBullets = [], enemies = [], particles = [], hazards = [];

function resetGame() {
  score = 0; lives = 3; wave = 0;
  bullets = []; enemyBullets = []; enemies = []; particles = []; hazards = [];
  bossActive = false; bossDefeated = false; boss = null;
  camera.x = 0; camera.targetX = 0; camera.locked = false;
  player.x = 100; player.y = GROUND_Y; player.vx = 0; player.vy = 0;
  player.onGround = true; player.facing = 1; player.invuln = 2;
  player.shootCooldown = 0; player.meleeCooldown = 0; player.meleeTimer = 0;
  spawnQueue = []; spawnTimer = 0; waveTimer = 0;
  updateHud();
  nextWave();
}

// ---------- Input ----------
let stickX = 0, keyLeft = false, keyRight = false;
let jumpQueued = false, meleeQueued = false;

const stickZone = document.getElementById('stick-zone');
const stickBase = document.getElementById('stick-base');
const stickNub = document.getElementById('stick-nub');
let stickPointerId = null, stickCenter = { x: 0, y: 0 };

function stickStart(e) {
  SFX.unlock();
  stickPointerId = e.pointerId;
  const rect = stickBase.getBoundingClientRect();
  stickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  stickMove(e);
}
function stickMove(e) {
  if (e.pointerId !== stickPointerId) return;
  const radius = 40;
  let dx = e.clientX - stickCenter.x;
  let dy = e.clientY - stickCenter.y;
  const d = Math.hypot(dx, dy);
  if (d > radius) { dx = dx / d * radius; dy = dy / d * radius; }
  stickNub.style.transform = `translate(${dx}px, ${dy}px)`;
  stickX = dx / radius;
}
function stickEnd(e) {
  if (e.pointerId !== stickPointerId) return;
  stickPointerId = null;
  stickX = 0;
  stickNub.style.transform = 'translate(0,0)';
}
stickZone.addEventListener('pointerdown', stickStart);
window.addEventListener('pointermove', stickMove);
window.addEventListener('pointerup', stickEnd);
window.addEventListener('pointercancel', stickEnd);

document.getElementById('btn-jump').addEventListener('pointerdown', (e) => {
  e.preventDefault(); SFX.unlock(); jumpQueued = true;
});
document.getElementById('btn-slash').addEventListener('pointerdown', (e) => {
  e.preventDefault(); SFX.unlock(); meleeQueued = true;
});

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keyLeft = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keyRight = true;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') jumpQueued = true;
  if (e.code === 'KeyK' || e.code === 'ShiftLeft' || e.code === 'KeyJ') meleeQueued = true;
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keyLeft = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keyRight = false;
});

// ---------- UI wiring ----------
const startScreen = document.getElementById('start-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const winScreen = document.getElementById('win-screen');
const pauseScreen = document.getElementById('pause-screen');
const waveBanner = document.getElementById('wave-banner');
const bossHud = document.getElementById('boss-hud');
const bossBar = document.getElementById('boss-bar');

function beginRun() {
  SFX.unlock();
  startScreen.classList.add('hidden');
  gameoverScreen.classList.add('hidden');
  winScreen.classList.add('hidden');
  resetGame();
  state = STATE.PLAYING;
  SFX.startMusic();
}

document.getElementById('start-btn').addEventListener('click', beginRun);
document.getElementById('retry-btn').addEventListener('click', beginRun);
document.getElementById('win-retry-btn').addEventListener('click', beginRun);

document.getElementById('pause-btn').addEventListener('click', () => {
  if (state === STATE.PLAYING) { state = STATE.PAUSED; pauseScreen.classList.remove('hidden'); }
});
document.getElementById('resume-btn').addEventListener('click', () => {
  if (state === STATE.PAUSED) { state = STATE.PLAYING; pauseScreen.classList.add('hidden'); }
});

const muteBtn = document.getElementById('mute-btn');
muteBtn.addEventListener('click', () => {
  const m = !SFX.isMuted();
  SFX.setMuted(m);
  muteBtn.textContent = m ? '🔇' : '🔊';
});

function updateHud() {
  document.getElementById('score').textContent = String(score).padStart(6, '0');
  const livesEl = document.getElementById('lives');
  livesEl.innerHTML = '';
  for (let i = 0; i < maxLives; i++) {
    const s = document.createElement('span');
    s.textContent = '♥';
    if (i >= lives) s.classList.add('empty');
    livesEl.appendChild(s);
  }
  if (bossActive && boss) {
    bossHud.classList.remove('hidden');
    bossBar.style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%';
  } else {
    bossHud.classList.add('hidden');
  }
}

function flashWave(text) {
  waveBanner.textContent = text;
  waveBanner.classList.add('show');
  clearTimeout(flashWave._t);
  flashWave._t = setTimeout(() => waveBanner.classList.remove('show'), 1500);
}

// ---------- Enemy definitions ----------
const ENEMY_TYPES = {
  drone: { r: 16, hp: 1, speed: 80, score: 15 },
  walker: { r: 16, hp: 2, speed: 60, score: 20 }
};

function nextWave() {
  wave++;
  if (wave === BOSS_WAVE) { startBossFight(); return; }
  flashWave('WAVE ' + wave);
  SFX.waveStart();
  const count = 4 + wave * 2;
  spawnQueue = [];
  for (let i = 0; i < count; i++) {
    spawnQueue.push(Math.random() < 0.55 ? 'drone' : 'walker');
  }
  spawnTimer = 0.7;
  waveTimer = 0;
}

function spawnEnemy(type) {
  const def = ENEMY_TYPES[type];
  const x = camera.x + W + 40 + Math.random() * 80;
  const y = type === 'drone' ? GROUND_Y - 140 - Math.random() * 100 : GROUND_Y;
  enemies.push({
    type, x, y, baseY: y, hp: def.hp, maxHp: def.hp, r: def.r,
    speed: def.speed, score: def.score, phase: Math.random() * Math.PI * 2,
    shootTimer: 1 + Math.random() * 1.5, stepTimer: 0
  });
}

function startBossFight() {
  flashWave('WARNING: DRAKO-9');
  SFX.bossRoar();
  camera.locked = true;
  camera.lockX = camera.x;
  bossActive = true;
  boss = {
    x: camera.x + W - 120, y: GROUND_Y - 40, baseY: GROUND_Y - 40,
    hp: 34, maxHp: 34, phase: 0, attackTimer: 1.6, attackState: 'idle',
    telegraph: 0, attackKind: null
  };
  updateHud();
}

// ---------- Particles & hazards ----------
function burst(x, y, color, n, speedMax) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = Math.random() * speedMax;
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
      life: 0.4 + Math.random() * 0.4, maxLife: 0.5,
      color, r: 1.5 + Math.random() * 2.5
    });
  }
}

// ---------- Combat ----------
function playerShoot(dt) {
  player.shootCooldown -= dt;
  if (player.shootCooldown <= 0) {
    bullets.push({
      x: player.x + player.facing * 14, y: player.y - 30,
      vx: player.facing * BULLET_SPEED, r: 4
    });
    SFX.shoot();
    player.shootCooldown = SHOOT_COOLDOWN;
    player.shootFlash = 0.06;
  }
}

function doMelee() {
  if (player.meleeCooldown > 0) return;
  player.meleeTimer = MELEE_ACTIVE;
  player.meleeCooldown = MELEE_COOLDOWN;
  SFX.meleeWhoosh();
}

function damagePlayer(amount) {
  if (player.invuln > 0) return;
  lives -= amount;
  player.invuln = 1.4;
  SFX.playerHit();
  burst(player.x, player.y - 24, '#7cf0ff', 16, 150);
  updateHud();
  if (lives <= 0) endGame();
}

function endGame() {
  state = STATE.GAMEOVER;
  SFX.stopMusic();
  SFX.gameOver();
  document.getElementById('final-score').textContent = String(score).padStart(6, '0');
  const msg = document.getElementById('new-best-msg');
  if (score > best) { best = score; localStorage.setItem(BEST_KEY, String(best)); msg.textContent = 'NEW BEST!'; }
  else msg.textContent = '';
  gameoverScreen.classList.remove('hidden');
}

function winGame() {
  state = STATE.WIN;
  SFX.stopMusic();
  SFX.victory();
  document.getElementById('win-score').textContent = String(score).padStart(6, '0');
  if (score > best) { best = score; localStorage.setItem(BEST_KEY, String(best)); }
  winScreen.classList.remove('hidden');
}

// ---------- Update ----------
function update(dt) {
  if (state !== STATE.PLAYING) return;

  const moveInput = stickX !== 0 ? stickX : (keyRight ? 1 : 0) - (keyLeft ? 1 : 0);
  player.vx = moveInput * MOVE_SPEED;
  if (Math.abs(moveInput) > 0.05) player.facing = moveInput > 0 ? 1 : -1;
  // during a boss fight, always face the boss so shots/melee land regardless of input
  if (bossActive && boss) player.facing = boss.x >= player.x ? 1 : -1;

  if (jumpQueued) {
    jumpQueued = false;
    if (player.onGround) { player.vy = JUMP_VEL; player.onGround = false; SFX.jump(); }
  }
  if (meleeQueued) { meleeQueued = false; doMelee(); }

  player.vy += GRAVITY * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  if (player.y >= GROUND_Y) { player.y = GROUND_Y; player.vy = 0; player.onGround = true; }

  if (player.invuln > 0) player.invuln -= dt;
  if (player.shootFlash > 0) player.shootFlash -= dt;
  if (player.meleeCooldown > 0) player.meleeCooldown -= dt;
  if (player.meleeTimer > 0) player.meleeTimer -= dt;
  player.runTimer += dt;

  playerShoot(dt);

  // camera
  camera.targetX = camera.locked ? camera.lockX : Math.max(0, player.x - W * 0.35);
  camera.x += (camera.targetX - camera.x) * Math.min(1, 8 * dt);

  // keep player within view (stay short of the boss so it's never behind them)
  const minX = camera.x + 30;
  const maxX = bossActive && boss ? Math.min(camera.x + W - 50, boss.x - 70) : camera.x + W - 50;
  player.x = Math.max(minX, Math.min(maxX, player.x));

  // spawns
  if (!bossActive) {
    if (spawnQueue.length) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) { spawnEnemy(spawnQueue.shift()); spawnTimer = Math.max(0.35, 0.85 - wave * 0.04); }
    } else if (enemies.length === 0) {
      waveTimer += dt;
      if (waveTimer > 1.2) nextWave();
    }
  }

  // bullets
  for (const b of bullets) b.x += b.vx * dt;
  bullets = bullets.filter(b => b.x > camera.x - 40 && b.x < camera.x + W + 40);

  for (const b of enemyBullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
  enemyBullets = enemyBullets.filter(b => b.x > camera.x - 60 && b.x < camera.x + W + 60);

  // melee hitbox
  if (player.meleeTimer > 0) {
    const mx0 = player.facing > 0 ? player.x : player.x - MELEE_RANGE;
    const mx1 = player.facing > 0 ? player.x + MELEE_RANGE : player.x;
    for (const e of enemies) {
      if (e.dead || e.meleeHit) continue;
      if (e.x > mx0 && e.x < mx1 && Math.abs(e.y - player.y) < 60) {
        e.hp -= 3; e.meleeHit = true;
        burst(e.x, e.y, '#ffffff', 6, 100);
      }
    }
    if (bossActive && boss && !boss.meleeHit) {
      if (boss.x > mx0 - 40 && boss.x < mx1 + 40 && Math.abs(boss.y - player.y) < 90) {
        boss.hp -= 3; boss.meleeHit = true;
        burst(boss.x, boss.y, '#ffffff', 8, 120);
      }
    }
  } else {
    for (const e of enemies) e.meleeHit = false;
    if (boss) boss.meleeHit = false;
  }

  // enemy update
  for (const e of enemies) {
    e.phase += dt;
    if (e.type === 'drone') {
      e.x -= e.speed * dt;
      e.y = e.baseY + Math.sin(e.phase * 2) * 12;
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && e.x < camera.x + W && e.x > camera.x) {
        const dx = player.x - e.x, dy = (player.y - 20) - e.y;
        const d = Math.hypot(dx, dy) || 1;
        enemyBullets.push({ x: e.x, y: e.y, vx: dx / d * ENEMY_BULLET_SPEED, vy: dy / d * ENEMY_BULLET_SPEED, r: 4 });
        SFX.enemyShoot();
        e.shootTimer = 1.6 + Math.random();
      }
    } else {
      e.x -= e.speed * dt;
      e.stepTimer += dt;
    }
    if (e.x < camera.x - 80) e.dead = true;
  }

  // player bullets vs enemies
  for (const b of bullets) {
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = b.x - e.x, dy = b.y - (e.y - 12);
      if (dx * dx + dy * dy < (e.r + b.r) * (e.r + b.r)) {
        e.hp--; b.dead = true;
        burst(b.x, b.y, '#7cf0ff', 4, 60);
        break;
      }
    }
    if (bossActive && boss && !b.dead) {
      const dx = b.x - boss.x, dy = b.y - boss.y;
      if (Math.abs(dx) < 60 && Math.abs(dy) < 80) { boss.hp--; b.dead = true; burst(b.x, b.y, '#3fae9e', 4, 60); }
    }
  }
  bullets = bullets.filter(b => !b.dead);

  for (const e of enemies) {
    if (!e.dead && e.hp <= 0) {
      e.dead = true; score += e.score;
      burst(e.x, e.y, e.type === 'drone' ? '#ff5c9e' : '#8a4fd6', 16, 160);
      SFX.explosionSmall();
      updateHud();
    }
  }
  enemies = enemies.filter(e => !e.dead);

  // enemy bullets vs player
  for (const b of enemyBullets) {
    const dx = b.x - player.x, dy = b.y - (player.y - 24);
    if (dx * dx + dy * dy < (player.r + b.r) * (player.r + b.r)) { b.dead = true; damagePlayer(1); }
  }
  enemyBullets = enemyBullets.filter(b => !b.dead);

  // enemies contact vs player
  for (const e of enemies) {
    const dx = e.x - player.x, dy = (e.y - 16) - (player.y - 24);
    if (dx * dx + dy * dy < (e.r + player.r) * (e.r + player.r)) {
      e.dead = true; burst(e.x, e.y, '#ff5c9e', 12, 140); damagePlayer(1);
    }
  }
  enemies = enemies.filter(e => !e.dead);

  // boss logic
  if (bossActive && boss) {
    boss.phase += dt;
    boss.y = boss.baseY + Math.sin(boss.phase) * 8;
    if (boss.hp <= 0 && !bossDefeated) {
      bossDefeated = true; bossActive = false;
      burst(boss.x, boss.y, '#3fae9e', 40, 220);
      burst(boss.x, boss.y, '#8a4fd6', 30, 180);
      SFX.explosionBig();
      score += 500;
      updateHud();
      winGame();
    } else if (boss.hp > 0) {
      boss.attackTimer -= dt;
      if (boss.attackState === 'idle' && boss.attackTimer <= 0) {
        boss.attackState = 'telegraph';
        boss.attackKind = Math.random() < 0.5 ? 'burst' : (Math.random() < 0.5 ? 'claw' : 'fire');
        boss.telegraph = 0.5;
      } else if (boss.attackState === 'telegraph') {
        boss.telegraph -= dt;
        if (boss.telegraph <= 0) {
          resolveBossAttack(boss.attackKind);
          boss.attackState = 'idle';
          boss.attackTimer = 1.5 + Math.random() * 1.2;
        }
      }
    }
    updateHud();
  }

  // hazards (fire breath)
  for (const h of hazards) {
    h.life -= dt;
    if (h.life > 0) {
      const dx = player.x - h.x, dy = (player.y - 20) - h.y;
      if (Math.abs(dx) < h.w / 2 && Math.abs(dy) < h.h / 2) damagePlayer(1);
    }
  }
  hazards = hazards.filter(h => h.life > 0);

  // particles
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.92; p.vy = p.vy * 0.92 + 120 * dt;
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);
}

function resolveBossAttack(kind) {
  if (!boss) return;
  if (kind === 'burst') {
    SFX.enemyShoot();
    for (let i = -1; i <= 1; i++) {
      const dx = (player.x - boss.x), dy = (player.y - 20 - boss.y) + i * 30;
      const d = Math.hypot(dx, dy) || 1;
      enemyBullets.push({ x: boss.x, y: boss.y, vx: dx / d * ENEMY_BULLET_SPEED, vy: dy / d * ENEMY_BULLET_SPEED, r: 6 });
    }
  } else if (kind === 'claw') {
    const dx = Math.abs(player.x - boss.x);
    if (dx < 100) damagePlayer(1);
    burst(boss.x - 40, boss.y, '#d9c4ff', 14, 160);
  } else if (kind === 'fire') {
    SFX.bossFire();
    hazards.push({ x: boss.x - 140, y: GROUND_Y - 20, w: 260, h: 90, life: 0.9 });
  }
}

// ---------- Render ----------
function skyColor() {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  g.addColorStop(0, '#3a2b52');
  g.addColorStop(0.45, '#8a4f6b');
  g.addColorStop(0.8, '#e08a5c');
  g.addColorStop(1, '#f2b06a');
  return g;
}

function drawBackground() {
  ctx.fillStyle = skyColor();
  ctx.fillRect(0, 0, W, H);

  // moon
  const moonX = W * 0.22 - camera.x * 0.03;
  ctx.fillStyle = 'rgba(230,235,245,0.85)';
  ctx.beginPath(); ctx.arc(((moonX % (W * 1.4)) + W * 1.4) % (W * 1.4) - W * 0.2, H * 0.22, 60, 0, Math.PI * 2); ctx.fill();

  drawBuildingLayer(camera.x * 0.15, '#3a2a48', 260, 90, 0.55);
  drawBuildingLayer(camera.x * 0.35, '#241a30', 220, 140, 0.85);

  // ground
  const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
  groundGrad.addColorStop(0, '#3fae9e');
  groundGrad.addColorStop(0.15, '#1f6f63');
  groundGrad.addColorStop(1, '#12312c');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  const tileW = 60;
  const offset = ((camera.x % tileW) + tileW) % tileW;
  for (let x = -offset; x < W; x += tileW) {
    ctx.fillRect(x, GROUND_Y, 3, H - GROUND_Y);
  }
}

function drawBuildingLayer(offsetX, color, patternW, maxH, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  const off = ((offsetX % patternW) + patternW) % patternW;
  for (let x = -off - patternW; x < W + patternW; x += patternW) {
    const seed = Math.floor((x + offsetX) / patternW);
    const h = maxH * (0.4 + 0.6 * ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) / 2);
    ctx.fillRect(x, GROUND_Y - h, patternW * 0.7, h);
  }
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  const sx = player.x - camera.x;
  const sy = player.y;
  let grid;
  if (!player.onGround) grid = PLAYER_JUMP;
  else if (Math.abs(player.vx) > 10) grid = (Math.floor(player.runTimer * 8) % 2 === 0) ? PLAYER_RUN1 : PLAYER_RUN2;
  else grid = PLAYER_STAND;

  const flicker = player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 0;
  ctx.save();
  if (flicker) ctx.globalAlpha = 0.4;
  ctx.shadowColor = 'rgba(124,240,255,0.5)';
  ctx.shadowBlur = 6;
  drawPixelSprite(ctx, grid, PLAYER_PALETTE, sx - (6 * PX), sy - (16 * PX), PX, player.facing < 0);
  ctx.restore();

  if (player.shootFlash > 0) {
    drawPixelSprite(ctx, MUZZLE_FLASH, MUZZLE_FLASH_PALETTE, sx + player.facing * 14 - 6, sy - 32, PX * 0.8, player.facing < 0);
  }

  if (player.meleeTimer > 0) {
    const a = player.meleeTimer / MELEE_ACTIVE;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${0.8 * a})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    const cx = sx + player.facing * 24, cy = sy - 20;
    ctx.arc(cx, cy, 26, player.facing > 0 ? -0.9 : Math.PI - 0.9, player.facing > 0 ? 0.9 : Math.PI + 0.9);
    ctx.stroke();
    ctx.restore();
  }
}

function drawEnemy(e) {
  const sx = e.x - camera.x, sy = e.y;
  if (e.type === 'drone') {
    drawPixelSprite(ctx, DRONE, DRONE_PALETTE, sx - 5 * PX, sy - 4 * PX, PX, false);
  } else {
    const grid = (Math.floor(e.stepTimer * 6) % 2 === 0) ? WALKER_STAND : WALKER_STEP;
    drawPixelSprite(ctx, grid, WALKER_PALETTE, sx - 4 * PX, sy - 7 * PX, PX, false);
  }
  if (e.hp < e.maxHp) {
    const w = e.r * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(sx - w / 2, sy - e.r - 14, w, 3);
    ctx.fillStyle = '#7cf0ff'; ctx.fillRect(sx - w / 2, sy - e.r - 14, w * (e.hp / e.maxHp), 3);
  }
}

function drawBoss() {
  if (!boss) return;
  const sx = boss.x - camera.x, sy = boss.y;
  const grid = boss.attackState === 'telegraph' ? BOSS_ATTACK : BOSS_IDLE;
  ctx.save();
  ctx.shadowColor = 'rgba(138,79,214,0.6)';
  ctx.shadowBlur = 14;
  drawPixelSprite(ctx, grid, BOSS_PALETTE, sx - 13 * PX, sy - 20 * PX, PX, true);
  ctx.restore();
}

function render() {
  drawBackground();

  for (const h of hazards) {
    const sx = h.x - camera.x;
    ctx.fillStyle = `rgba(255,92,60,${Math.min(0.7, h.life)})`;
    ctx.fillRect(sx - h.w / 2, h.y - h.h, h.w, h.h);
  }

  for (const e of enemies) drawEnemy(e);
  if (boss && !bossDefeated) drawBoss();

  ctx.fillStyle = '#7cf0ff';
  ctx.shadowColor = '#7cf0ff'; ctx.shadowBlur = 6;
  for (const b of bullets) { ctx.beginPath(); ctx.arc(b.x - camera.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#ff5c9e';
  ctx.shadowColor = '#ff5c9e';
  for (const b of enemyBullets) { ctx.beginPath(); ctx.arc(b.x - camera.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); }
  ctx.shadowBlur = 0;

  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x - camera.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawPlayer();
}

// ---------- Main loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  if (state === STATE.PLAYING || state === STATE.PAUSED) render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

})();
