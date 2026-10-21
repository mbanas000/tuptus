'use strict';
// Sterowanie dotykowe (telefon, tablet): pływający joystick pod lewym kciukiem, przyciski Skok i Kulka
// pod prawym, obrót kamery i pauza. Włącza się po dotknięciu ekranu, a klawiatura działa dalej –
// naciśnięcie klawisza chowa przyciski z powrotem.
G.touch = (() => {
  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const layer = $('touch'), base = $('stick'), knob = base.querySelector('.knob');
  const BTNS = [
    { el: $('tb-jump'), code: 'TouchJump', pad: 1.35 },
    { el: $('tb-act'), code: 'TouchAct', pad: 1.3 },
  ];
  const RADIUS = 52;   // pełne wychylenie joysticka w pikselach
  const DEAD = 0.14;   // martwa strefa w środku
  // pointerId → { kind: 'stick' } albo { kind: 'btn', home: kod przycisku, over: kod pod palcem }
  const ptrs = new Map();
  const stick = { id: null, ox: 0, oy: 0 };
  let on = false;

  const playing = () => body.dataset.state === 'play';
  const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) { /* bez wibracji */ } };

  function setMode(t) {
    if (t === on) return;
    on = t;
    G.input.touchMode = on;
    body.classList.toggle('touch', on);
    if (!on) releaseAll();
  }

  // Który przycisk jest pod palcem (z zapasem wokół, bo kciuk jest gruby). Wygrywa najbliższy środek.
  function hit(x, y) {
    let best = null, bestD = 1;
    for (const b of BTNS) {
      const r = b.el.getBoundingClientRect();
      const rad = (r.width / 2) * b.pad;
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) / rad;
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  // Palec trzyma przycisk, na którym zaczął, oraz ten, nad którym jest teraz.
  // Dzięki temu przesunięcie kciuka z Kulki na Skok daje wysoki albo daleki skok.
  function sync() {
    const want = new Set();
    for (const p of ptrs.values()) if (p.kind === 'btn') { want.add(p.home); if (p.over) want.add(p.over); }
    for (const b of BTNS) {
      const down = want.has(b.code);
      if (down !== b.el.classList.contains('down')) {
        b.el.classList.toggle('down', down);
        G.input.virt(b.code, down);
        if (down) buzz();
      }
    }
  }

  function moveStick(x, y) {
    let dx = x - stick.ox, dy = y - stick.oy;
    let d = Math.hypot(dx, dy);
    // Gdy kciuk ucieknie daleko, podstawa joysticka podąża za nim.
    const far = RADIUS * 1.35;
    if (d > far) {
      stick.ox += (dx / d) * (d - far); stick.oy += (dy / d) * (d - far);
      dx = x - stick.ox; dy = y - stick.oy; d = far;
      base.style.transform = `translate(${stick.ox}px, ${stick.oy}px)`;
    }
    const n = d / RADIUS;
    const len = n < DEAD ? 0 : Math.min(1, ((n - DEAD) / (1 - DEAD)) * 1.12);
    // Ekran w dół = w stronę kamery (jak klawisz S).
    G.input.setStick(d > 0 ? (dx / d) * len : 0, d > 0 ? (dy / d) * len : 0);
    const kd = Math.min(d, RADIUS);
    knob.style.transform = d > 0 ? `translate(${(dx / d) * kd}px, ${(dy / d) * kd}px)` : '';
  }

  function endStick() {
    stick.id = null;
    G.input.setStick(0, 0);
    base.classList.remove('active');
    base.style.transform = '';
    knob.style.transform = '';
  }

  function releaseAll() {
    ptrs.clear();
    endStick();
    sync();
  }

  layer.addEventListener('contextmenu', (e) => e.preventDefault());
  layer.addEventListener('pointerdown', (e) => {
    if (!playing()) return;
    e.preventDefault();
    // Obrót kamery: osobne, małe przyciski.
    const cam = e.target.closest('.tb-cam');
    if (cam) {
      G.emit('camRotate', Number(cam.dataset.dir));
      cam.classList.add('down');
      setTimeout(() => cam.classList.remove('down'), 160);
      buzz();
      return;
    }
    const b = hit(e.clientX, e.clientY);
    if (b) {
      ptrs.set(e.pointerId, { kind: 'btn', home: b.code, over: b.code });
      sync();
      return;
    }
    // Lewa część ekranu: joystick pojawia się tam, gdzie położysz kciuk.
    if (e.clientX < window.innerWidth * 0.55 && stick.id === null) {
      stick.id = e.pointerId;
      stick.ox = e.clientX; stick.oy = e.clientY;
      ptrs.set(e.pointerId, { kind: 'stick' });
      base.classList.add('active');
      base.style.transform = `translate(${stick.ox}px, ${stick.oy}px)`;
      moveStick(e.clientX, e.clientY);
    }
  });
  window.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    if (p.kind === 'stick') moveStick(e.clientX, e.clientY);
    else {
      const b = hit(e.clientX, e.clientY);
      const over = b ? b.code : null;
      if (over !== p.over) { p.over = over; sync(); }
    }
  });
  const up = (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    ptrs.delete(e.pointerId);
    if (p.kind === 'stick') endStick();
    else sync();
  };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  window.addEventListener('blur', releaseAll);

  // Tryb wybiera ostatnio użyte urządzenie: dotyk pokazuje przyciski, klawisz gry je chowa.
  window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') setMode(true); }, true);
  window.addEventListener('keydown', (e) => {
    if (/^(Key|Arrow|Digit)/.test(e.code) || ['Space', 'ShiftLeft', 'ShiftRight', 'Escape', 'Enter'].includes(e.code)) setMode(false);
  }, true);
  // Telefon albo tablet bez myszy: od razu tryb dotykowy (również w menu i w opisie sterowania).
  const mq = (q) => window.matchMedia && window.matchMedia(q).matches;
  if (mq('(pointer: coarse)') && !mq('(any-pointer: fine)')) setMode(true);

  // Przycisk pauzy w HUD (tylko w trybie dotykowym).
  $('btn-pause-touch').addEventListener('click', () => { G.sfx.init(); G.sfx.play('click'); G.emit('pauseToggle'); });

  // Ekran pionowy: prośba o obrócenie telefonu (można zostać w pionie).
  $('btn-rotate-skip').addEventListener('click', () => { G.sfx.init(); G.sfx.play('click'); $('rotate').classList.add('dismissed'); });

  return {
    get on() { return on; },
    // Wołane przy zmianie stanu gry: poza rozgrywką żaden palec niczego nie trzyma.
    reset: releaseAll,
    // Na telefonie gra startuje na pełnym ekranie i w poziomie (tam, gdzie przeglądarka na to pozwala).
    enterFullscreen() {
      if (!on) return;
      const el = document.documentElement;
      try {
        if (!document.fullscreenElement && el.requestFullscreen) {
          el.requestFullscreen({ navigationUI: 'hide' })
            .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
            .catch(() => {});
        }
      } catch (e) { /* przeglądarka bez pełnego ekranu */ }
    },
  };
})();
