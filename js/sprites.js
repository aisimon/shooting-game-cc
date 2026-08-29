// Everything below is procedural pixel art: each sprite is a grid of characters,
// each character mapped to a color in that sprite's palette. Nothing is loaded
// from an image file — sprites are drawn as blocks of rects, nearest-neighbor
// style, so they read as chunky retro pixel art at any scale.

function drawPixelSprite(ctx, grid, palette, x, y, px, flip) {
  const h = grid.length;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  for (let row = 0; row < h; row++) {
    const line = grid[row];
    const w = line.length;
    for (let col = 0; col < w; col++) {
      const ch = line[col];
      if (ch === '.' || ch === ' ') continue;
      const color = palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      const drawX = flip ? -(col + 1) * px : col * px;
      ctx.fillRect(drawX, row * px, px + 0.5, px + 0.5);
    }
  }
  ctx.restore();
}

const PLAYER_PALETTE = {
  H: '#16294a', h: '#2f6fb3', v: '#ffb84d', V: '#ffe08a',
  b: '#3a7fc9', B: '#1c4685', g: '#9aa6b8', G: '#4a5568',
  w: '#eef3fb', k: '#20232b', m: '#ffffff'
};

// 12 wide, 18 tall. Facing right.
const PLAYER_HEAD_TORSO = [
  '....HHHH....',
  '...HhhhhH...',
  '...HvvvvH...',
  '...HVVVVH...',
  '....HHHH....',
  '...bbbbbbG..',
  '..bbbbbbbGG.',
  '..bBbbbbGGg.',
  '..bBbbbb....',
  '...bbbb.....',
  '...bBbb.....',
];

const PLAYER_STAND = [
  ...PLAYER_HEAD_TORSO,
  '...ww..ww...',
  '...ww..ww...',
  '...ww..ww...',
  '...kk..kk...',
  '............',
  '............'
];

const PLAYER_RUN1 = [
  ...PLAYER_HEAD_TORSO,
  '..ww....ww..',
  '.ww......ww.',
  'ww........w.',
  'kk........k.',
  '............',
  '............'
];

const PLAYER_RUN2 = [
  ...PLAYER_HEAD_TORSO,
  '....wwww....',
  '....wwww....',
  '...wwwwww...',
  '...kkkkkk...',
  '............',
  '............'
];

const PLAYER_JUMP = [
  ...PLAYER_HEAD_TORSO,
  '..ww......ww',
  '.ww........w',
  'ww..........',
  'k...........',
  '............',
  '............'
];

const MUZZLE_FLASH_PALETTE = { m: '#fff6d6', y: '#ffd76c', o: '#ff9a3c' };
const MUZZLE_FLASH = [
  '.oy.',
  'omyo',
  'oym.',
  '.o..'
];

const DRONE_PALETTE = {
  g: '#7c8598', G: '#4a5568', P: '#ff5c9e', p: '#ffb0d4', r: '#4be8ff'
};
const DRONE = [
  '..gggggg..',
  '.gggggggg.',
  'gg.gPpg.gg',
  'GGGGGGGGGG',
  '.gggggggg.',
  '..gggggg..',
  '.r..gg..r.',
  '..r....r..'
];

const WALKER_PALETTE = {
  G: '#5a3a6b', g: '#7a52a0', P: '#ff5c9e', k: '#2a1f33', w: '#c9a7ff'
};
const WALKER_STAND = [
  '..GGGG..',
  '.GgPPgG.',
  '.Gg gg G',
  '..gggg..',
  '.wgggg..',
  'ww.gg.ww',
  'kk.gg.kk'
];
const WALKER_STEP = [
  '..GGGG..',
  '.GgPPgG.',
  '.Gg gg G',
  '..gggg..',
  '.wggg...',
  'w..gg..w',
  'k..gg..k'
];

const BOSS_PALETTE = {
  T: '#2e8f82', t: '#3fae9e', D: '#123230', P: '#8a4fd6', p: '#b083e8',
  E: '#ff5c9e', e: '#ffb0d4', W: '#12312c', c: '#d9c4ff'
};
// 28 wide, 20 tall — facing left toward the player.
const BOSS_IDLE = [
  '.........PPP................',
  '........Pp.pP...............',
  '.......Pp...pP..............',
  '......TTTTT.................',
  '.....TtEEtT.................',
  '....TtEeeEtTP...............',
  '...TtEeeeEtTPp..............',
  '...TTtEEEEtTTPp....PPP......',
  '..TTTTtttttTTTT...Pp.pP.....',
  '.TTTTTTTTTTTTTTT.Pp...pP....',
  '.TtttTTTTTTTtttT.TTTTTT.....',
  '.TtWWttttttWWtT.TtttttT.....',
  '..TWWttttttWWT..TtttttT.....',
  '...TTtttttTT....TtttttT.....',
  '....TTTTTTTT.....TTTTTT.....',
  '....TT.TT.TT.......TT.......',
  '...TT...TT.TT......TT.......',
  '..DD....DD..DD.....DD.......',
  '............................',
  '............................'
];
const BOSS_ATTACK = [
  '.........PPP................',
  '........Pp.pP...............',
  '.......Pp...pP..............',
  '......TTTTT.................',
  '.....TtEEtT.................',
  'ccc.TtEeeEtTP...............',
  '.ccTtEeeeEtTPp..............',
  '..cTTtEEEEtTTPp....PPP......',
  '..TTTTtttttTTTT...Pp.pP.....',
  '.TTTTTTTTTTTTTTT.Pp...pP....',
  '.TtttTTTTTTTtttT.TTTTTT.....',
  '.TtWWttttttWWtT.TtttttT.....',
  '..TWWttttttWWT..TtttttT.....',
  '...TTtttttTT....TtttttT.....',
  '....TTTTTTTT.....TTTTTT.....',
  '....TT.TT.TT.......TT.......',
  '...TT...TT.TT......TT.......',
  '..DD....DD..DD.....DD.......',
  '............................',
  '............................'
];
