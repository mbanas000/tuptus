'use strict';
// Wspólna przestrzeń nazw gry, narzędzia matematyczne, wejście z klawiatury i prosta szyna zdarzeń.
const G = (window.G = {});

G.WATER_Y = 0;

G.u = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  // Wygładzanie niezależne od liczby klatek.
  damp: (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt)),
  rand: (a, b) => a + Math.random() * (b - a),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  angleDamp(a, b, lambda, dt) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * (1 - Math.exp(-lambda * dt));
  },
  // Deterministyczny generator, żeby dekoracje wyglądały tak samo przy każdym uruchomieniu.
  rng(seed) {
    let s = seed >>> 0;
    const next = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = (a, b) => a + next() * (b - a);
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    return next;
  },
  formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  },
  // Sprężyna krytycznie tłumiona: zwraca nowe [wartość, prędkość].
  spring(x, v, target, k, damping, dt) {
    const a = (target - x) * k - v * damping;
    v += a * dt;
    x += v * dt;
    return [x, v];
  },
};

// ---------- Szyna zdarzeń ----------
G._handlers = {};
G.on = (name, fn) => { (G._handlers[name] ||= []).push(fn); };
G.emit = (name, data) => { (G._handlers[name] || []).forEach((fn) => fn(data)); };

// ---------- Klawiatura ----------
G.input = (() => {
  const held = new Set();
  const pressed = new Set();
  const block = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);

  window.addEventListener('keydown', (e) => {
    if (block.has(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => { held.delete(e.code); });
  window.addEventListener('blur', () => held.clear());

  const any = (set, codes) => codes.some((c) => set.has(c));
  const JUMP = ['Space', 'KeyJ'];
  const ACT = ['ShiftLeft', 'ShiftRight', 'KeyC', 'KeyK'];

  return {
    held: (...codes) => any(held, codes),
    pressed: (...codes) => any(pressed, codes),
    get jumpHeld() { return any(held, JUMP); },
    get jumpPressed() { return any(pressed, JUMP); },
    get actHeld() { return any(held, ACT); },
    get actPressed() { return any(pressed, ACT); },
    // Kierunek ruchu w płaszczyźnie XZ (kamera patrzy wzdłuż -Z).
    move() {
      let x = 0, z = 0;
      if (any(held, ['KeyD', 'ArrowRight'])) x += 1;
      if (any(held, ['KeyA', 'ArrowLeft'])) x -= 1;
      if (any(held, ['KeyS', 'ArrowDown'])) z += 1;
      if (any(held, ['KeyW', 'ArrowUp'])) z -= 1;
      const len = Math.hypot(x, z);
      if (len > 1) { x /= len; z /= len; }
      return { x, z, len: Math.min(1, len) };
    },
    endFrame() { pressed.clear(); },
    clear() { held.clear(); pressed.clear(); },
  };
})();
