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
  // Wibracja działa dopiero po pierwszym prawdziwym stuknięciu (inaczej przeglądarka zgłasza błąd).
  const buzz = () => {
    try {
      if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(8);
    } catch (e) { /* bez wibracji */ }
  };

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

  // ---------- Bez powiększania strony (iPhone) ----------
  // Safari na iPhonie ignoruje zakaz powiększania w <meta viewport> i nie obsługuje „touch-action: none”,
  // więc szybkie podwójne stuknięcie w przycisk powiększało ekran. Blokujemy te gesty sami.
  const stop = (e) => { if (e.cancelable) e.preventDefault(); };
  for (const type of ['touchstart', 'touchmove', 'touchend']) layer.addEventListener(type, stop, { passive: false });
  for (const type of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) document.addEventListener(type, stop, { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    // Drugie stuknięcie tuż po pierwszym to dla Safari „podwójne stuknięcie = powiększ”.
    if (e.timeStamp - lastTouchEnd < 350 && e.cancelable) e.preventDefault();
    lastTouchEnd = e.timeStamp;
  }, { passive: false });
  // Gdyby strona i tak się powiększyła, wracamy do skali 1 (zmiana <meta viewport> wymusza przeliczenie).
  const vpMeta = document.querySelector('meta[name="viewport"]');
  if (window.visualViewport && vpMeta) {
    const base = vpMeta.content;
    window.visualViewport.addEventListener('resize', () => {
      if (window.visualViewport.scale > 1.01) {
        vpMeta.content = `${base}, minimum-scale=1`;
        setTimeout(() => { vpMeta.content = base; }, 60);
      }
    });
  }

  // ---------- Podpowiedź gestu: kciuk przesuwa się z Kulki na Skok ----------
  // Półprzezroczysta strzałka łukiem od Kulki do Skoku i „duch kciuka”, który ją pokonuje:
  // tak robi się wysoki skok (w miejscu) i daleki skok (w biegu).
  const SVGNS = 'http://www.w3.org/2000/svg';
  const sh = { on: false, t: 0, svg: null, track: null, head: null, trail: null, ghost: null, a: null, b: null, c: null };
  const bez = (t, out = {}) => {
    const u = 1 - t;
    out.x = u * u * sh.a.x + 2 * u * t * sh.c.x + t * t * sh.b.x;
    out.y = u * u * sh.a.y + 2 * u * t * sh.c.y + t * t * sh.b.y;
    return out;
  };
  const line = (t0, t1, n = 24) => {
    let d = '';
    for (let i = 0; i <= n; i++) { const p = bez(t0 + (t1 - t0) * (i / n)); d += `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }
    return d;
  };
  function layoutHint() {
    const ra = $('tb-act').getBoundingClientRect(), rb = $('tb-jump').getBoundingClientRect();
    sh.a = { x: ra.left + ra.width / 2, y: ra.top + ra.height / 2 };
    sh.b = { x: rb.left + rb.width / 2, y: rb.top + rb.height / 2 };
    sh.c = { x: (sh.a.x + sh.b.x) / 2, y: Math.min(sh.a.y, sh.b.y) - 66 };
    // Strzałka zaczyna się i kończy przy krawędziach przycisków, nie w ich środkach.
    const T0 = 0.24, T1 = 0.8;
    sh.track.setAttribute('d', line(T0, T1));
    const e = bez(T1), p = bez(T1 - 0.02);
    const ang = Math.atan2(e.y - p.y, e.x - p.x), L = 17, W = 0.6;
    sh.head.setAttribute('d', `M${e.x + Math.cos(ang) * 4} ${e.y + Math.sin(ang) * 4}` +
      `L${e.x - Math.cos(ang - W) * L} ${e.y - Math.sin(ang - W) * L}` +
      `L${e.x - Math.cos(ang + W) * L} ${e.y - Math.sin(ang + W) * L}Z`);
  }
  function buildHint() {
    sh.svg = document.createElementNS(SVGNS, 'svg');
    sh.svg.setAttribute('class', 'slide-hint');
    sh.svg.innerHTML = '<path class="sh-track"/><path class="sh-trail"/><path class="sh-head"/><circle class="sh-ghost" r="21"/>';
    [sh.track, sh.trail, sh.head, sh.ghost] = sh.svg.children;
    layer.appendChild(sh.svg);
    window.addEventListener('resize', () => { if (sh.on) layoutHint(); });
  }
  function slideHint(show) {
    if (show && !on) return;
    if (show === sh.on) return;
    sh.on = show;
    if (show) {
      if (!sh.svg) buildHint();
      layoutHint();
      sh.t = 0;
      sh.svg.classList.add('show');
    } else if (sh.svg) {
      sh.svg.classList.remove('show');
      for (const b of BTNS) b.el.classList.remove('hint');
    }
  }
  function updateHint(dt) {
    if (!sh.on) return;
    const T = 2.0;
    sh.t = (sh.t + dt) % T;
    const u = sh.t / T;
    // 0–0.15: kciuk „siada” na Kulce, 0.15–0.62: jedzie łukiem, 0.62–0.85: wciska Skok, potem znika.
    let k = 0, op = 1;
    if (u < 0.15) op = u / 0.15;
    else if (u < 0.62) { const s = (u - 0.15) / 0.47; k = s * s * (3 - 2 * s); }
    else { k = 1; if (u > 0.85) op = 1 - (u - 0.85) / 0.15; }
    const p = bez(k);
    const press = u > 0.62 && u < 0.85;
    sh.ghost.setAttribute('cx', p.x.toFixed(1));
    sh.ghost.setAttribute('cy', p.y.toFixed(1));
    sh.ghost.setAttribute('r', (press ? 17 : 21).toString());
    sh.ghost.style.opacity = op.toFixed(2);
    sh.trail.setAttribute('d', k > 0.01 ? line(0, k, 16) : '');
    sh.trail.style.opacity = (op * 0.9).toFixed(2);
    BTNS[1].el.classList.toggle('hint', u < 0.62);
    BTNS[0].el.classList.toggle('hint', press);
  }
  // Gracz zrobił wysoki albo daleki skok: już wie, jak to działa.
  G.on('special', () => slideHint(false));

  return {
    get on() { return on; },
    slideHint,
    update: updateHint,
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
