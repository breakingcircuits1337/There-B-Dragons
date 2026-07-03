// ============================================================
// There Be Dragons — sound
// Fully synthesized Web Audio: no asset files.
// Ambient wind/ocean scales with speed; the Mist hums.
// ============================================================
'use strict';

const SFX = (() => {
  let ctx = null, master = null, noiseBuf = null;
  let windGain = null, windFilter = null, mistGain = null;
  let started = false, muted = false;

  // Browsers require a user gesture before audio starts;
  // call this from the first keydown.
  function ensure() {
    if (started || muted) return started;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);

      // shared white-noise buffer for wind, cannon, splashes
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

      // looping wind/ocean bed
      const windSrc = ctx.createBufferSource();
      windSrc.buffer = noiseBuf;
      windSrc.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 350;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSrc.connect(windFilter).connect(windGain).connect(master);
      windSrc.start();

      // the Mist's hum: detuned low drone, "like a hive, like a hymn"
      mistGain = ctx.createGain();
      mistGain.gain.value = 0;
      mistGain.connect(master);
      for (const f of [55, 55.7, 82.5, 110.6]) {
        const o = ctx.createOscillator();
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = 0.22;
        o.connect(g).connect(mistGain);
        o.start();
      }
      started = true;
    } catch (e) { /* no audio available — play silent */ }
    return started;
  }

  function tone(freq, dur, { type = 'sine', vol = 0.2, delay = 0, slide = null } = {}) {
    if (!started || muted) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function burst(dur, { freq = 800, type = 'lowpass', vol = 0.3, delay = 0 } = {}) {
    if (!started || muted) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  const ONESHOTS = {
    cannon()    { burst(0.5, { freq: 300, vol: 0.5 }); tone(70, 0.4, { vol: 0.4, slide: 40 }); },
    cannonFar() { burst(0.4, { freq: 160, vol: 0.14 }); },
    splash()    { burst(0.22, { freq: 1200, type: 'bandpass', vol: 0.2 }); },
    damage()    { burst(0.3, { freq: 250, vol: 0.3 }); tone(55, 0.35, { vol: 0.35, slide: 35 }); },
    sink()      { burst(0.9, { freq: 200, vol: 0.5 }); tone(50, 0.9, { vol: 0.4, slide: 25 }); },
    sword()     { burst(0.07, { freq: 2500, type: 'highpass', vol: 0.22 }); },
    bomb()      { burst(0.6, { freq: 350, vol: 0.5 }); },
    heal()      { tone(523, 0.25, { vol: 0.18 }); tone(784, 0.35, { vol: 0.18, delay: 0.12 }); },
    buff()      { tone(392, 0.3, { type: 'triangle', vol: 0.16 }); tone(494, 0.3, { type: 'triangle', vol: 0.16, delay: 0.1 }); },
    levelup()   { [392, 494, 587, 784].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.2, delay: i * 0.11 })); },
    coin()      { tone(1200, 0.07, { type: 'square', vol: 0.07 }); tone(1600, 0.1, { type: 'square', vol: 0.07, delay: 0.06 }); },
    dock()      { [330, 415, 494].forEach((f, i) => tone(f, 0.4, { type: 'triangle', vol: 0.14, delay: i * 0.15 })); },
    rumor()     { tone(220, 0.5, { vol: 0.14 }); tone(233, 0.6, { vol: 0.11, delay: 0.25 }); },
    fragment()  { [440, 554, 659, 880].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.2, delay: i * 0.13 })); },
    siren()     { tone(880, 1.3, { vol: 0.16, slide: 620 }); tone(1108, 1.5, { vol: 0.1, delay: 0.35, slide: 700 }); },
    ending()    { [220, 277, 330, 440].forEach((f, i) => tone(f, 1.2, { vol: 0.16, delay: i * 0.3 })); },
  };

  function play(name) {
    try { if (ONESHOTS[name]) ONESHOTS[name](); } catch (e) { /* never break gameplay for a sound */ }
  }

  // called every frame: settle ambient gains toward the world state
  function ambient() {
    if (!started) return;
    try {
      const t = ctx.currentTime;
      const sailing = G.mode === 'sail';
      const windTarget = sailing
        ? clamp(G.ship.speed / 160, 0, 1) * 0.22 + G.wind.strength * 0.05
        : 0.02;
      windGain.gain.setTargetAtTime(muted ? 0 : windTarget, t, 0.4);
      windFilter.frequency.setTargetAtTime(300 + G.ship.speed * 4, t, 0.4);
      const depth = clamp((WORLD.MIST_Y - G.ship.y) / WORLD.MIST_Y, 0, 1);
      const humTarget = inMist() && !muted ? 0.15 + depth * 0.4 : 0;
      mistGain.gain.setTargetAtTime(humTarget, t, 1.2);
    } catch (e) { /* ignore */ }
  }

  function toggleMute() {
    muted = !muted;
    if (!muted) ensure();
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  return { ensure, play, ambient, toggleMute };
})();
