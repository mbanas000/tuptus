'use strict';
// Pora dnia: trzy pory (zachód → noc → świt → zachód) płynnie przechodzące jedna w drugą,
// albo stała, wybrana pora. Klatki kluczowe opisują światło, niebo, mgłę, wodę, kurz i nocne dodatki.
G.daytime = (() => {
  const C = (h) => new THREE.Color(h);
  const DAY_LEN = 600; // pełna doba w sekundach (10 minut)

  // az: kierunek słońca w poziomie (+ prawo, − lewo), el: wysokość światła, visEl: wysokość tarczy na niebie.
  // dust: barwa obłoczków kurzu (cząsteczki są nieoświetlone, więc dostają kolor światła).
  const K = {
    night: { az: 0.25, el: 0.65, visEl: 0.2, sun: C(0xa9bdff), sunI: 0.9, hSky: C(0x3e4e84), hGround: C(0x221d30), hI: 0.65, fill: 0.25,
      top: C(0x0a1230), mid: C(0x172250), hor: C(0x2f3b6c), vis: C(0xd4e0ff), fog: C(0x1b2446), fogN: 40, fogF: 160,
      env: 0.16, exp: 1.12, bloom: 0.55, water: C(0x7488bc), dust: C(0x7584b0), night: 1 },
    dawn: { az: 0.9, el: 0.26, visEl: 0.05, sun: C(0xffb6a0), sunI: 2.2, hSky: C(0xc9bbea), hGround: C(0x8a7062), hI: 1.0, fill: 0.45,
      top: C(0x7488c8), mid: C(0xe4b4c8), hor: C(0xffc6a6), vis: C(0xffe2c8), fog: C(0xe6bfc4), fogN: 46, fogF: 170,
      env: 0.32, exp: 1.05, bloom: 0.35, water: C(0xd0c4de), dust: C(0xf2dede), night: 0.15 },
    dusk: { az: -0.95, el: 0.2, visEl: 0.03, sun: C(0xff9070), sunI: 2.2, hSky: C(0x968cc8), hGround: C(0x6e4e56), hI: 1.0, fill: 0.4,
      top: C(0x34448a), mid: C(0xae78a8), hor: C(0xff9c7a), vis: C(0xffb894), fog: C(0xb48a9c), fogN: 42, fogF: 165,
      env: 0.28, exp: 1.08, bloom: 0.4, water: C(0xa894bc), dust: C(0xf0c8b8), night: 0.35 },
  };
  // Oś doby (0..1): noc → świt → (słońce przechodzi po niebie) → zachód → noc.
  const TRACK = [[0.0, K.night], [0.08, K.night], [0.2, K.dawn], [0.36, K.dawn], [0.56, K.dusk], [0.72, K.dusk], [0.86, K.night], [1.0, K.night]];
  const PRESETS = [
    { id: 'dawn', name: 'Świt', t: 0.28 },
    { id: 'dusk', name: 'Zachód', t: 0.64 },
    { id: 'night', name: 'Noc', t: 0.97 },
  ];

  let t = 0.64, cycle = true;
  let scene, renderer, bloom, stars, moon;
  const cur = { sun: C(0), hSky: C(0), hGround: C(0), top: C(0), mid: C(0), hor: C(0), vis: C(0), fog: C(0), water: C(0), dust: C(0) };
  const lightDir = new THREE.Vector3(), visDir = new THREE.Vector3(), moonDir = new THREE.Vector3(0.45, 0.2, -1).normalize();

  function sample(tt) {
    let i = 0;
    while (i < TRACK.length - 2 && tt > TRACK[i + 1][0]) i++;
    const [ta, A] = TRACK[i], [tb, B] = TRACK[i + 1];
    let k = (tt - ta) / (tb - ta || 1);
    k = k * k * (3 - 2 * k);
    for (const key of ['az', 'el', 'visEl', 'sunI', 'hI', 'fill', 'fogN', 'fogF', 'env', 'exp', 'bloom', 'night']) cur[key] = A[key] + (B[key] - A[key]) * k;
    for (const key of ['sun', 'hSky', 'hGround', 'top', 'mid', 'hor', 'vis', 'fog', 'water', 'dust']) cur[key].copy(A[key]).lerp(B[key], k);
  }

  function save() {
    try { localStorage.setItem('tuptus-daytime', JSON.stringify({ t, cycle })); } catch (e) { /* bez zapisu */ }
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem('tuptus-daytime') || 'null');
      if (s && typeof s.t === 'number') { t = ((s.t % 1) + 1) % 1; cycle = !!s.cycle; }
    } catch (e) { /* domyślne */ }
  }

  function makeNightSky() {
    const n = 700, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      let x, y, z;
      do { x = Math.random() * 2 - 1; y = Math.random(); z = Math.random() * 2 - 1; } while (x * x + y * y + z * z > 1 || y < 0.04);
      const l = Math.hypot(x, y, z);
      pos.set([(x / l) * 380, (y / l) * 380, (z / l) * 380], i * 3);
      const b = 0.6 + Math.random() * 0.4;
      col.set([b, b, b * (0.9 + Math.random() * 0.2)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    stars.frustumCulled = false;
    stars.renderOrder = -9;
    scene.add(stars);
    const tex = G.tex.canvas(128, 128, (g2, w) => {
      const gr = g2.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.28, 'rgba(240,245,255,1)');
      gr.addColorStop(0.33, 'rgba(200,215,255,0.45)'); gr.addColorStop(1, 'rgba(160,180,255,0)');
      g2.fillStyle = gr; g2.fillRect(0, 0, w, w);
      g2.fillStyle = 'rgba(190,200,225,0.55)';
      for (const [cx, cy, r] of [[56, 52, 6], [72, 68, 4], [60, 74, 3]]) { g2.beginPath(); g2.arc(cx, cy, r, 0, Math.PI * 2); g2.fill(); }
    });
    moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
    moon.scale.setScalar(46);
    moon.renderOrder = -8;
    scene.add(moon);
  }

  function apply() {
    sample(t);
    const W = G.world, U = G.water.uniforms;
    // Światło: kierunek (cienie przesuwają się ze słońcem), kolor i siła.
    lightDir.set(cur.az * 0.75, cur.el, 0.48).normalize();
    W.SUN_DIR.copy(lightDir);
    W.sun.color.copy(cur.sun);
    W.sun.intensity = cur.sunI;
    W.hemi.color.copy(cur.hSky);
    W.hemi.groundColor.copy(cur.hGround);
    W.hemi.intensity = cur.hI;
    W.fill.intensity = cur.fill;
    // Niebo i tarcza słońca (w nocy księżyca).
    const n = cur.night;
    visDir.set(cur.az * 0.55, cur.visEl, -1).normalize().lerp(moonDir, n > 0.5 ? 1 : 0).normalize();
    const su = W.sky.material.uniforms;
    su.top.value.copy(cur.top); su.mid.value.copy(cur.mid); su.horizon.value.copy(cur.hor);
    su.sunDir.value.copy(visDir); su.sunCol.value.copy(cur.vis).multiplyScalar(1 - n * 0.6);
    // Mgła, otoczenie, ekspozycja, poświata.
    scene.fog.color.copy(cur.fog); scene.fog.near = cur.fogN; scene.fog.far = cur.fogF;
    scene.environmentIntensity = cur.env;
    renderer.toneMappingExposure = cur.exp;
    if (bloom) bloom.strength = cur.bloom;
    // Woda: barwa toni, odbite niebo i blask (w nocy srebrzysty).
    G.water.setTint(cur.water);
    U.uSkyTop.value.copy(cur.top); U.uSkyHorizon.value.copy(cur.hor);
    U.uSunDir.value.copy(visDir);
    U.uSunCol.value.copy(cur.vis).multiplyScalar(n > 0.5 ? 0.7 : 1);
    // Gwiazdy i księżyc.
    stars.material.opacity = Math.max(0, (n - 0.35) / 0.65);
    moon.material.opacity = Math.max(0, (n - 0.4) / 0.6);
  }

  function nameOf(tt) {
    if (tt >= 0.79 || tt < 0.14) return 'Noc';
    if (tt < 0.46) return 'Świt';
    return 'Zachód';
  }

  return {
    PRESETS,
    init(o) {
      scene = o.scene; renderer = o.renderer; bloom = o.bloom;
      load();
      makeNightSky();
      apply();
    },
    // advance = false podczas pauzy (pora stoi, ale wybór w panelu działa od razu).
    update(dt, camera, advance) {
      if (cycle && advance) t = (t + dt / DAY_LEN) % 1;
      apply();
      stars.position.copy(camera.position);
      moon.position.copy(camera.position).addScaledVector(moonDir, 340);
    },
    setTime(tt) { t = ((tt % 1) + 1) % 1; apply(); save(); },
    setCycle(on) { cycle = !!on; save(); },
    // Następna pora z listy (klawisz T).
    next() {
      const i = PRESETS.findIndex((p) => p.name === nameOf(t));
      const p = PRESETS[(i + 1) % PRESETS.length];
      this.setTime(p.t);
      return p;
    },
    get t() { return t; },
    get cycle() { return cycle; },
    get night() { return cur.night || 0; },
    get dust() { return cur.dust; },
    get name() { return nameOf(t); },
  };
})();
