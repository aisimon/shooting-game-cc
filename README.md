# Neon Blitz

A mobile-friendly neon space shooter built with plain HTML5 Canvas and the Web Audio API — no build step, no external assets, no dependencies.

## Play

Open `index.html` in a browser, or serve the folder statically:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Add it to your phone's home screen for a fullscreen, app-like experience (it ships a `manifest.json`).

## Controls

- **Touch / mouse drag**: fly your ship anywhere on screen
- Fire is automatic — just focus on dodging and picking up green `P` power-ups for a spread shot
- Pause with the `❚❚` button, toggle sound with the speaker icon

## Tech

- `index.html` / `style.css` — layout, HUD, and menu screens
- `js/game.js` — game loop, enemy waves, collisions, particle effects, all rendered on `<canvas>`
- `js/audio.js` — every sound effect and the background music loop are synthesized in real time with the Web Audio API (oscillators + filtered noise), so there are no audio files to load
- `icon.svg` / `manifest.json` — installable PWA icon and metadata

## Gameplay

- Three enemy types (grunt, shooter, tank) with increasing difficulty across waves
- Score, lives, and best-score tracking (saved in `localStorage`)
- Power-ups drop from destroyed enemies for a temporary triple-shot
