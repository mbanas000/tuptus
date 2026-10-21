'use strict';
// Główna pętla: renderer z bloomem i winietą, kamera dioramy, „soczystość” (wstrząsy, hit-stop),
// stany gry (menu → gra → pauza → finał).
G.start = () => {
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  // Telefony mają gęste ekrany, ale słabsze karty graficzne: zaczynamy od nieco niższej rozdzielczości.
  const dpr = Math.min(window.devicePixelRatio || 1, G.input.touchMode ? 1.25 : 1.5);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.02;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.layers.enable(2); // warstwa 2: drobne dekoracje i cząsteczki (bez odbić w wodzie)

  const rt = new THREE.WebGLRenderTarget(window.innerWidth * dpr, window.innerHeight * dpr, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new ADDONS.EffectComposer(renderer, rt);
  composer.addPass(new ADDONS.RenderPass(scene, camera));
  const bloom = new ADDONS.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.3, 0.5, 0.9);
  composer.addPass(bloom);
  // Ciepła winieta + różowy błysk przy oberwaniu.
  const vignette = new ADDONS.ShaderPass({
    uniforms: { tDiffuse: { value: null }, uStrength: { value: 0.42 }, uFlash: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uStrength, uFlash; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        vec2 d = (vUv - 0.5) * vec2(1.15, 1.0);
        float v = smoothstep(0.82, 0.28, length(d));
        vec3 tint = mix(vec3(0.62, 0.48, 0.5), vec3(1.0), v);
        c.rgb *= mix(vec3(1.0), tint, uStrength);
        c.rgb = mix(c.rgb, vec3(1.0, 0.32, 0.42), uFlash * (1.0 - v) * 0.55);
        gl_FragColor = c;
      }`,
  });
  composer.addPass(vignette);
  composer.addPass(new ADDONS.OutputPass());

  // Na ekranie pionowym (telefon) poszerzamy kadr, żeby widać było więcej poziomu na boki,
  // a na małym ekranie kamera podjeżdża bliżej, żeby Tuptuś nie był malutki.
  let camZoom = 1;
  const fitCamera = () => {
    camZoom = Math.min(window.innerWidth, window.innerHeight) < 540 ? 0.82 : 1;
    camera.aspect = window.innerWidth / window.innerHeight;
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(18)) * Math.max(camera.aspect, 1.15));
    camera.fov = G.u.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / camera.aspect)), 36, 64);
    camera.updateProjectionMatrix();
  };
  fitCamera();
  window.addEventListener('resize', () => {
    fitCamera();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    G.water.resize();
  });

  G.fx.init(scene);
  G.ent.init(scene);
  G.treasure.init(scene);
  G.enemies.init(scene);
  G.world.init(scene, renderer);
  G.level.build(scene);
  G.water.buildShore();
  G.ambient.init(scene);
  G.daytime.init({ scene, renderer, bloom });
  const player = new G.Player(scene);
  G.player = player;
  const sp = G.level.spawn;
  player.spawn(sp.x, sp.y, sp.z);

  const L = G.ent.list;
  const S = { state: 'menu', time: 0, stars: 0, shownStars: 0, friends: 0, golds: 0, t: 0, finishT: 0, menuHop: 3, blend: 0, swamOnce: false,
    introT: 0, yawTarget: 0, rotHint: false };
  const J = { shake: 0, stop: 0, flash: 0 };
  const starsTotal = L.stars.length, friendsTotal = L.friends.length, goldsTotal = G.treasure.list.golds.length;
  G.camYaw = 0;
  // Podpowiedzi na czas; tekst to funkcja, bo plakietki zależą od sterowania (klawiatura / dotyk).
  let timedHint = null;
  const K = G.keys;

  // ---------- Zdarzenia ----------
  G.on('juice', (e) => {
    if (e.shake) J.shake = Math.min(0.6, J.shake + e.shake);
    if (e.stop) J.stop = Math.max(J.stop, e.stop);
    if (e.flash) J.flash = Math.max(J.flash, e.flash);
  });
  G.on('star', (s) => {
    S.stars++;
    const v = s.mesh.position.clone().project(camera);
    G.ui.flyStar((v.x + 1) / 2 * window.innerWidth, (1 - v.y) / 2 * window.innerHeight, () => {
      S.shownStars++;
      G.ui.setStars(S.shownStars, starsTotal, true);
      G.sfx.play('pop');
    });
    const left = starsTotal - S.stars;
    if (left > 0 && left <= 3) {
      L.stars.forEach((st) => !st.taken && st.setBeacon(true));
      if (left === 3) G.ui.toast('Zostały 3 gwiazdki. Wypatruj świetlnych słupów!', 3200);
    }
    player.rabbit.setExpr('joy', 0.7);
    L.friends.forEach((f) => f.found && f.cheer());
    if (S.stars >= starsTotal) finish();
  });
  G.on('friend', (f) => {
    S.friends++;
    G.ui.friendFound(f);
    G.ui.toast(`Odnaleziono: ${f.name}! (${S.friends}/${friendsTotal})`, 2800, true);
  });
  G.on('hearts', (e) => G.ui.setHearts(e.hearts, e.lost));
  G.on('gold', () => {
    S.golds++;
    G.ui.setGolds(S.golds, goldsTotal, true);
    G.ui.toast(`Złota marchewka! (${S.golds}/${goldsTotal})`, 2800);
    player.rabbit.setExpr('joy', 1.2);
    L.friends.forEach((f) => f.found && f.cheer());
  });

  // ---------- Przelot kamery nad poziomem ----------
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const INTRO_T = 9.5;
  const introCam = new THREE.CatmullRomCurve3([
    V3(127, 12, 18), V3(101, 10, 15), V3(75, 15, 14), V3(51, 11, 14), V3(30, 8, 13), V3(sp.x, sp.y + 7.8, sp.z + 14.5)]);
  const introLook = new THREE.CatmullRomCurve3([
    V3(117, 2, -3), V3(93, 2, -2), V3(68, 8, -3), V3(48, 3, -2), V3(27, 1, 1), V3(sp.x, sp.y + 0.9, sp.z - 1.5)]);
  function startIntro() {
    G.sfx.init();
    G.touch.enterFullscreen();
    G.input.clear();
    G.ui.menu(false);
    S.state = 'intro';
    S.introT = 0;
    G.ui.intro(true);
    G.sfx.play('whoosh');
  }
  function endIntro() {
    if (S.state !== 'intro') return;
    G.ui.intro(false);
    S.blend = 1;
    play();
  }

  // ---------- Stany ----------
  function play() {
    G.sfx.init();
    G.input.clear();
    G.ui.menu(false);
    G.ui.hud(true);
    S.state = 'play';
    player.frozen = false;
    if (player.grounded) { player.vel.y = 8; player.grounded = false; }
    player.rabbit.setExpr('joy', 1);
    G.ui.toast(`Zbierz ${starsTotal} gwiazdek i odnajdź ${friendsTotal} przyjaciół!`, 3400);
    timedHint = { text: () => `${K.move()}: bieg  ·  ${K.jump()}: skok`, until: 8 };
  }
  function pause(on) {
    if (on && S.state === 'play') { S.state = 'paused'; G.ui.pause(true); G.input.clear(); }
    else if (!on && S.state === 'paused') { S.state = 'play'; G.ui.pause(false); G.input.clear(); }
  }
  function restart() {
    try { sessionStorage.setItem('tuptus-skip-menu', '1'); } catch (e) { /* tryb prywatny */ }
    location.reload();
  }
  function finish() {
    S.state = 'finish';
    S.finishT = 0;
    player.frozen = true;
    player.rabbit.setExpr('joy');
    G.ui.hint(null);
    G.ui.toast('Wszystkie gwiazdki zebrane!', 2600);
    G.sfx.play('allstars');
    const p = player.center.clone();
    G.fx.flash(p, 0xfff0b0, 6, 0.6);
    G.fx.confetti(p.clone().add(new THREE.Vector3(0, 1, 0)), 60);
    G.fx.sparkle(p, 30, 0xfff2a8, 5);
    J.shake = 0.3;
  }

  G.ui.init({ play: startIntro, resume: () => pause(false), restart });
  G.ui.setupFriends(L.friends);
  G.tips.init();
  // Przeglądarki odblokowują dźwięk dopiero po geście użytkownika.
  window.addEventListener('pointerdown', () => G.sfx.init());
  window.addEventListener('keydown', () => G.sfx.init());
  // ---------- Pora dnia: panel w menu i w pauzie ----------
  const openDay = () => { G.sfx.init(); G.sfx.play('click'); G.ui.dayPanel(true); };
  document.getElementById('btn-day-menu').addEventListener('click', openDay);
  document.getElementById('btn-day-pause').addEventListener('click', openDay);
  document.getElementById('btn-day-close').addEventListener('click', () => { G.sfx.play('click'); G.ui.dayPanel(false); });
  document.getElementById('day-cycle').addEventListener('click', () => {
    G.daytime.setCycle(!G.daytime.cycle);
    G.sfx.play('click');
    G.ui.syncDay();
  });
  document.querySelectorAll('.day-tile').forEach((b) => b.addEventListener('click', () => {
    const p = G.daytime.PRESETS.find((x) => x.id === b.dataset.id);
    G.daytime.setTime(p.t);
    G.sfx.play('pop');
    G.ui.syncDay();
  }));

  window.addEventListener('keydown', (e) => {
    if (G.ui.isDayOpen() && (e.code === 'Escape' || e.code === 'Enter')) { G.ui.dayPanel(false); return; }
    if (S.state === 'intro' && ['Space', 'Enter', 'Escape'].includes(e.code)) { endIntro(); G.input.clear(); return; }
    if (e.code === 'Escape') {
      if (G.ui.isHelpOpen()) { G.ui.help(false); return; }
      if (S.state === 'play') pause(true); else if (S.state === 'paused') pause(false);
    }
    if ((e.code === 'Enter' || e.code === 'Space') && S.state === 'menu' && !G.ui.isHelpOpen() && !G.ui.isDayOpen()) startIntro();
    // T: następna pora dnia.
    if (e.code === 'KeyT' && !e.repeat && S.state !== 'intro') {
      const p = G.daytime.next();
      G.ui.toast(`Pora dnia: ${p.name}`, 1800);
      if (G.ui.isDayOpen()) G.ui.syncDay();
    }
    // Obrót kamery co 45°.
    if ((e.code === 'KeyQ' || e.code === 'KeyE') && !e.repeat) rotateCam(e.code === 'KeyQ' ? -1 : 1);
  });
  function rotateCam(dir) {
    if (S.state !== 'play') return;
    S.yawTarget += dir * (Math.PI / 4);
    S.rotHint = true;
    G.sfx.play('whoosh');
  }
  // Przyciski dotykowe: obrót kamery i pauza.
  G.on('camRotate', rotateCam);
  G.on('pauseToggle', () => { if (S.state === 'play') pause(true); else if (S.state === 'paused') pause(false); });
  window.addEventListener('pointerdown', () => { if (S.state === 'intro') endIntro(); });

  G.ui.setStars(0, starsTotal);
  G.ui.setGolds(0, goldsTotal);
  G.ui.setHearts(player.hearts);

  // ---------- Kamera ----------
  const look = new THREE.Vector3(sp.x, sp.y, sp.z);
  let focusY = sp.y;
  const camPlay = new THREE.Vector3(), lookPlay = new THREE.Vector3();
  const camMenu = new THREE.Vector3(), lookMenu = new THREE.Vector3();
  const lk = new THREE.Vector3(), shakeV = new THREE.Vector3();

  function updateCamera(dt) {
    const p = player.pos;
    const steady = player.grounded || player.swimming;
    let ty = steady ? p.y : focusY;
    if (p.y < focusY - 1.8) ty = p.y + 1.8;
    if (p.y > focusY + 2.6) ty = p.y - 2.6;
    focusY = G.u.damp(focusY, ty, steady ? 3 : 2, dt);
    look.x = G.u.damp(look.x, p.x + player.vel.x * 0.25, 3.5, dt);
    look.z = G.u.damp(look.z, p.z + player.vel.z * 0.18, 3, dt);
    look.y = focusY;
    // Obrót kamery wokół Tuptusia (co 45°, płynnie).
    G.camYaw = G.u.damp(G.camYaw, S.yawTarget, 7, dt);
    const sy = Math.sin(G.camYaw), cy = Math.cos(G.camYaw);
    const high = G.u.clamp((focusY - 3) / 6, 0, 1);
    let dist = (14.5 + high * 3) * camZoom, height = (7.8 + high * 2) * camZoom;
    if (S.state === 'finish') { const f = Math.min(1, S.finishT / 1.5); dist -= f * 6; height -= f * 3.5; }
    camPlay.set(look.x + sy * dist, look.y + height, look.z + cy * dist);
    lookPlay.set(look.x - sy * 1.5, look.y + 0.9, look.z - cy * 1.5);

    const mt = S.t;
    camMenu.set(p.x - 3.2 + Math.sin(mt * 0.12) * 1.2, p.y + 2.6 + Math.sin(mt * 0.09) * 0.4, p.z + 7.6);
    lookMenu.set(p.x - 2.6, p.y + 1.25, p.z - 0.5);

    if (S.state === 'intro') {
      // Przelot nad poziomem: od norki z powrotem do Tuptusia, z łagodnym wejściem z kamery menu.
      const k = Math.min(1, S.introT / INTRO_T);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      introCam.getPoint(e, camPlay);
      introLook.getPoint(e, lookPlay);
      const w = Math.min(1, S.introT / 0.9);
      const bw = w * w * (3 - 2 * w);
      camera.position.lerpVectors(camMenu, camPlay, bw);
      lk.lerpVectors(lookMenu, lookPlay, bw);
    } else {
      S.blend = G.u.damp(S.blend, S.state === 'menu' ? 0 : 1, 1.8, dt);
      const b = S.blend * S.blend * (3 - 2 * S.blend);
      camera.position.lerpVectors(camMenu, camPlay, b);
      lk.lerpVectors(lookMenu, lookPlay, b);
    }
    // Wstrząs kamery (kwadrat „traumy” daje miękkie wygaszanie).
    const a = J.shake * J.shake * 0.55;
    shakeV.set((Math.sin(mt * 47) + Math.sin(mt * 31.7)) * 0.5 * a, (Math.sin(mt * 39.1) + Math.sin(mt * 23.3)) * 0.5 * a, 0);
    camera.position.add(shakeV);
    lk.add(shakeV);
    camera.lookAt(lk);
    // Podgląd do testów: kamera ustawiona ręcznie (nieużywane w grze).
    if (typeof G._camOverride === 'function') G._camOverride(camera);
    else if (G._camOverride) { camera.position.copy(G._camOverride.pos); camera.lookAt(G._camOverride.look); }
  }

  // ---------- Pętla ----------
  let last = performance.now();
  // Jeśli komputer nie nadąża, stopniowo obniżamy jakość: najpierw rozdzielczość,
  // potem poświatę (bloom) i wygładzanie krawędzi.
  const perf = { acc: 0, n: 0, level: 0 };
  function lowerQuality() {
    perf.level++;
    if (perf.level === 1 && renderer.getPixelRatio() > 1) {
      renderer.setPixelRatio(1);
      composer.setPixelRatio(1);
      G.water.setQuality(1);
    } else {
      perf.level = 2;
      bloom.enabled = false;
      for (const t of [composer.renderTarget1, composer.renderTarget2]) { t.samples = 0; t.dispose(); }
      G.water.setQuality(2);
    }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const raw = (now - last) / 1000;
    const dt = Math.max(0, Math.min(0.05, raw));
    last = now;
    if (perf.level < 2 && raw > 0 && raw < 0.5 && !document.hidden) {
      perf.acc += raw; perf.n++;
      if (perf.n >= 180) {
        if (perf.acc / perf.n > 1 / 42) lowerQuality();
        perf.acc = 0; perf.n = 0;
      }
    }
    tick(dt);
  }
  // Ręczny krok symulacji (przydatny do testów, gdy karta jest w tle).
  G._tick = (dt = 1 / 60, n = 1) => { for (let i = 0; i < n; i++) tick(dt); };

  let shownState = null;
  function tick(dt) {
    if (dt <= 0) return;
    // Stan gry na <body>: CSS pokazuje przyciski dotykowe tylko w trakcie rozgrywki.
    if (S.state !== shownState) {
      shownState = S.state;
      document.body.dataset.state = S.state;
      G.touch.reset();
    }
    // Hit-stop: na ułamek sekundy świat prawie staje (uderzenie „czuć”).
    let sdt = dt;
    if (J.stop > 0) { J.stop -= dt; sdt = dt * 0.08; }
    J.shake = Math.max(0, J.shake - dt * 1.8);
    J.flash = Math.max(0, J.flash - dt * 2.5);
    vignette.uniforms.uFlash.value = J.flash;

    if (S.state !== 'paused') {
      S.t += sdt;
      G.ent.updateMovers(sdt, S.t);
      if (S.state === 'menu') {
        S.menuHop -= sdt;
        if (S.menuHop <= 0 && player.grounded) {
          S.menuHop = G.u.rand(9, 14);
          player.vel.y = 8.5; player.grounded = false;
          player.rabbit.setExpr('joy', 0.8);
        }
        player.yaw = G.u.angleDamp(player.yaw, -0.3, 3, sdt);
      }
      if (S.state === 'intro') {
        S.introT += dt;
        player.yaw = G.u.angleDamp(player.yaw, 0, 3, dt);
        if (S.introT >= INTRO_T) endIntro();
      }
      player.update(sdt, G.input);
      G.ent.update(sdt, S.t, player);
      G.treasure.update(sdt, player);
      if (S.state === 'play') {
        S.time += dt;
        G.ui.setTime(S.time);
        if (player.swimming && !S.swamOnce) {
          S.swamOnce = true;
          timedHint = { text: () => `Tuptuś świetnie pływa! ${K.jump()}: wyskok z wody`, until: S.time + 5 };
        }
        if (S.time > 9 && !S.rotHintShown && !S.rotHint) {
          S.rotHintShown = true;
          timedHint = { text: () => `${K.cam()}: obracaj kamerę, żeby lepiej widzieć`, until: S.time + 5 };
        }
        const zone = G.level.hintAt(player.pos);
        G.ui.hint(zone || (timedHint && S.time < timedHint.until ? timedHint.text() : null));
        // Karta z nowym ruchem w lewym dolnym rogu (każda raz na rozgrywkę).
        const card = G.level.cardAt(player.pos);
        if (card) G.tips.show(card);
      }
      if (S.state === 'play') G.tips.update(dt);
      else if (G.tips.active) G.tips.hide();
      if (S.state === 'finish') {
        S.finishT += dt;
        L.friends.forEach((f, i) => f.found && f.celebrate(S.t, i));
        if (Math.random() < dt * 3) G.fx.confetti(player.pos.clone().add(new THREE.Vector3(G.u.rand(-2, 2), 2.5, G.u.rand(-1, 1))), 12);
        if (player.grounded && Math.random() < dt * 1.5) { player.vel.y = 7; player.grounded = false; }
        player.yaw = G.u.angleDamp(player.yaw, G.camYaw, 4, dt);
        if (S.finishT > 2.8 && !S.resultsShown) {
          S.resultsShown = true;
          G.ui.results({ stars: S.stars, starsTotal, friends: S.friends, friendsTotal, time: S.time, target: G.level.timeTarget,
            golds: S.golds, goldsTotal });
        }
      }
      G.ambient.update(sdt, S.state === 'intro' ? lk : look, player);
      G.fx.update(sdt);
    }
    updateCamera(dt);
    // Pora dnia płynie, gdy gra nie jest zapauzowana (wybór w panelu działa od razu).
    G.daytime.update(dt, camera, S.state !== 'paused');
    if (G.ui.isDayOpen()) { S.daySync = (S.daySync || 0) - dt; if (S.daySync <= 0) { S.daySync = 0.5; G.ui.syncDay(); } }
    // Podczas przelotu cienie i życie świata podążają za kamerą, a nie za Tuptusiem.
    G.world.update(dt, S.state === 'intro' ? lk : player.pos, camera);
    composer.render();
    G.input.endFrame();
  }

  let skip = false;
  try { skip = sessionStorage.getItem('tuptus-skip-menu') === '1'; sessionStorage.removeItem('tuptus-skip-menu'); } catch (e) { /* brak dostępu */ }
  player.frozen = true;
  if (skip) { S.blend = 1; play(); } else G.ui.menu(true);
  G.ui.loaded();
  G._state = S;
  G._play = play;
  G._intro = startIntro;
  G._lower = lowerQuality;
  requestAnimationFrame(frame);
};
