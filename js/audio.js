// Procedural sound engine — everything is synthesized, no audio files needed.
const SFX = (() => {
  let ctx = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function envGain(t0, attack, decay, peak) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + attack + decay);
    return g;
  }

  function tone(freqStart, freqEnd, dur, type, peak, delay = 0) {
    if (muted) return;
    const c = ensureCtx();
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + dur);
    const g = envGain(t0, 0.005, dur, peak);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, peak, filterFreq = 1200, delay = 0) {
    if (muted) return;
    const c = ensureCtx();
    const t0 = c.currentTime + delay;
    const bufferSize = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t0);
    filter.frequency.exponentialRampToValueAtTime(80, t0 + dur);
    const g = envGain(t0, 0.005, dur, peak);
    src.connect(filter).connect(g).connect(c.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  return {
    setMuted(v) { muted = v; },
    isMuted() { return muted; },
    unlock() { ensureCtx(); },

    shoot() { tone(880, 440, 0.08, 'square', 0.06); },
    enemyShoot() { tone(320, 180, 0.12, 'sawtooth', 0.05); },
    explosionSmall() { noiseBurst(0.22, 0.22, 1800); },
    explosionBig() {
      noiseBurst(0.5, 0.35, 2200);
      tone(140, 40, 0.4, 'sawtooth', 0.15, 0.02);
    },
    playerHit() { tone(300, 90, 0.35, 'sawtooth', 0.22); },
    powerup() {
      tone(520, 1040, 0.09, 'triangle', 0.15);
      tone(660, 1320, 0.12, 'triangle', 0.12, 0.07);
    },
    waveStart() {
      tone(220, 440, 0.18, 'triangle', 0.14);
      tone(330, 660, 0.18, 'triangle', 0.1, 0.09);
    },
    gameOver() {
      tone(400, 60, 0.9, 'sawtooth', 0.2);
    },

    startMusic() {
      if (musicTimer) return;
      const notesA = [110, 130.8, 164.8, 130.8];
      const notesB = [98, 116.5, 146.8, 116.5];
      let bar = 0;
      musicTimer = setInterval(() => {
        if (muted) return;
        const notes = bar % 8 < 4 ? notesA : notesB;
        const n = notes[musicStep % notes.length];
        tone(n, n, 0.3, 'triangle', 0.035);
        musicStep++;
        if (musicStep % 4 === 0) bar++;
      }, 260);
    },
    stopMusic() {
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; musicStep = 0; }
    }
  };
})();
