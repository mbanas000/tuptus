'use strict';
// Efekty dźwiękowe syntezowane na żywo przez Web Audio, bez żadnych plików.
G.sfx = (() => {
  let ctx = null, out = null, noiseBuf = null;
  let starCombo = 0, lastStar = 0;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    out = ctx.createGain();
    out.gain.value = 0.55;
    out.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function env(gain, t0, attack, dur, vol) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  function tone(freq, dur, o = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur * (o.slideT || 1));
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = o.vibrato;
      lg.gain.value = freq * 0.04;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    }
    env(g, t0, o.attack || 0.006, dur, o.vol || 0.2);
    osc.connect(g).connect(out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, o = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 800, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    env(g, t0, o.attack || 0.005, dur, o.vol || 0.15);
    src.connect(f).connect(g).connect(out);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  const semis = (base, n) => base * Math.pow(2, n / 12);

  const sounds = {
    jump() { tone(380, 0.16, { to: 760, vol: 0.16, type: 'triangle' }); },
    highjump() { tone(300, 0.32, { to: 1100, vol: 0.18, type: 'triangle' }); tone(1500, 0.2, { delay: 0.12, vol: 0.05 }); },
    longjump() { tone(320, 0.22, { to: 640, vol: 0.14, type: 'triangle' }); noise(0.2, { freq: 600, to: 1800, filter: 'bandpass', vol: 0.06 }); },
    flap() { noise(0.16, { freq: 1300, filter: 'bandpass', q: 2, vol: 0.07 }); },
    land() { noise(0.09, { freq: 500, vol: 0.18 }); tone(150, 0.09, { to: 90, vol: 0.12 }); },
    step() { noise(0.035, { freq: 1400, vol: 0.035 }); },
    star() {
      const now = performance.now();
      starCombo = now - lastStar < 1400 ? Math.min(starCombo + 1, 12) : 0;
      lastStar = now;
      const b = semis(988, starCombo);
      tone(b, 0.12, { vol: 0.13, type: 'triangle' });
      tone(b * 1.5, 0.28, { delay: 0.06, vol: 0.11 });
    },
    allstars() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.35, { delay: i * 0.1, vol: 0.13, type: 'triangle' }));
    },
    stomp() { tone(300, 0.16, { to: 110, vol: 0.18, type: 'square' }); noise(0.12, { freq: 900, vol: 0.1 }); },
    boing() { tone(160, 0.42, { to: 620, vol: 0.22, vibrato: 18 }); },
    block() { tone(520, 0.07, { vol: 0.1, type: 'square' }); tone(1040, 0.16, { delay: 0.05, vol: 0.08, type: 'triangle' }); },
    splash() { noise(0.45, { freq: 2200, to: 400, filter: 'bandpass', q: 0.8, vol: 0.22 }); },
    swim() { noise(0.14, { freq: 900, filter: 'bandpass', q: 1.5, vol: 0.05 }); },
    hurt() { tone(640, 0.28, { to: 240, vol: 0.18, type: 'triangle' }); },
    poof() { noise(0.4, { freq: 1600, to: 300, vol: 0.16 }); },
    friend() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, { delay: i * 0.09, vol: 0.12, type: 'triangle' })); },
    roll() { noise(0.28, { freq: 300, to: 700, vol: 0.1 }); },
    crouch() { tone(260, 0.12, { to: 200, vol: 0.06 }); },
    cloud() { tone(300, 0.16, { to: 460, vol: 0.06 }); noise(0.18, { freq: 1200, vol: 0.04 }); },
    click() { tone(660, 0.06, { vol: 0.08, type: 'triangle' }); },
    pop() { tone(500, 0.08, { to: 900, vol: 0.1 }); },
    resultStar(i = 0) { tone(semis(784, i * 4), 0.4, { vol: 0.14, type: 'triangle' }); tone(semis(1568, i * 4), 0.5, { delay: 0.04, vol: 0.05 }); },
    sad() { tone(520, 0.3, { to: 440, vol: 0.05, type: 'triangle' }); },
    // Rozbity dzbanek: suchy trzask gliny + brzęk skorup.
    crack() {
      noise(0.16, { freq: 2600, to: 900, filter: 'bandpass', q: 1.2, vol: 0.22 });
      noise(0.3, { freq: 700, vol: 0.12, delay: 0.02 });
      [1900, 2400, 1600].forEach((f, i) => tone(f, 0.07, { delay: 0.05 + i * 0.05, vol: 0.035, type: 'triangle' }));
    },
    // Rozbita skrzynka: głuchy łomot drewna.
    wood() {
      tone(180, 0.14, { to: 90, vol: 0.2, type: 'triangle' });
      noise(0.22, { freq: 900, to: 300, vol: 0.18 });
      noise(0.08, { freq: 2000, filter: 'bandpass', vol: 0.08, delay: 0.08 });
    },
    plop() { tone(700, 0.12, { to: 260, vol: 0.09 }); noise(0.15, { freq: 1600, filter: 'bandpass', vol: 0.05 }); },
    heal() { [659, 880, 1318].forEach((f, i) => tone(f, 0.18, { delay: i * 0.07, vol: 0.1, type: 'triangle' })); },
    gold() {
      [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.3, { delay: i * 0.07, vol: 0.12, type: 'triangle' }));
      tone(2637, 0.6, { delay: 0.38, vol: 0.06, vibrato: 7 });
    },
    whoosh() { noise(0.3, { freq: 400, to: 1400, filter: 'bandpass', q: 0.8, vol: 0.06 }); },
  };

  return {
    init,
    play(name, arg) {
      if (!ctx || ctx.state !== 'running') return;
      const s = sounds[name];
      if (s) s(arg);
    },
  };
})();
