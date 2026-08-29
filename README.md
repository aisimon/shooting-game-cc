# Iron Frontier

A mobile-friendly, retro pixel-art side-scrolling run-and-gun, built with plain HTML5 Canvas and the Web Audio API — no build step, no external assets, no dependencies. Styled after CRT-era Contra/Metal Slug-style action: scanlines, vignette, a soldier with a gun and a melee slash, flying drone enemies, and a giant mech-dragon boss fight.

## Play

Open `index.html` in a browser, or serve the folder statically:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Best experienced in landscape. Add it to your phone's home screen for a fullscreen, app-like experience (it ships a `manifest.json`).

## Controls

- **Touch**: left stick to move, `A` to jump, `B` to slash
- **Keyboard**: Arrow keys / WASD to move, Space/Up/W to jump, K/J/Shift to slash
- The gun auto-fires in the direction you're facing
- Pause with the `❚❚` button, toggle sound with the speaker icon

## Tech

- `index.html` / `style.css` — layout, HUD, CRT scanline/vignette overlay, and menu screens
- `js/sprites.js` — every character is a hand-authored grid of characters mapped to colors, drawn as chunky pixel-art blocks on the canvas (no image files)
- `js/game.js` — side-scrolling physics (gravity/jump), camera-follow scrolling, parallax retro background, enemy waves, gun + melee combat, and a multi-attack boss fight
- `js/audio.js` — every sound effect and the background music loop are synthesized in real time with the Web Audio API (oscillators + filtered noise), so there are no audio files to load
- `icon.svg` / `manifest.json` — installable PWA icon and metadata

## Gameplay

- Run and gun through waves of flying drones and ground walkers, picking off enemies with your auto-firing gun or a short-range melee slash
- Score (XP) and best-score tracking (saved in `localStorage`)
- Clear enough waves and **DRAKO-9**, a mechanical dragon boss with claw swipes, projectile bursts, and a fire-breath hazard, blocks your path — defeat it to win the run
