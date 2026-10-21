'use strict';
// Karty z podpowiedziami ruchów: mała scena 3D w lewym dolnym rogu, w której Tuptuś pokazuje ruch w pętli.
// Każda karta pojawia się raz na rozgrywkę, w miejscu, gdzie ruch jest potrzebny, i znika po kilku sekundach.
G.tips = (() => {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const S = G.GEO;
  const P = G.PAL;
  const SHOW_TIME = 8;
  // Opisy to funkcje: plakietki zależą od sterowania (klawiatura albo przyciski dotykowe).
  const J = () => G.keys.jump(), A = () => G.keys.act();
  const touch = () => G.input.touchMode;

  const CARDS = {
    highjump: { title: 'Wysoki skok', keys: () => (touch() ? `Stój, przytrzymaj ${A()} i przesuń kciuk na ${J()}` : `${A()} w miejscu, potem ${J()}`), dur: 2.8 },
    glide: { title: 'Szybowanie na uszach', keys: () => `W powietrzu naciśnij i trzymaj ${J()}`, dur: 3.2 },
    roll: { title: 'Turlanie się w kulkę', keys: () => `${A()} w biegu`, dur: 2.7 },
    longjump: { title: 'Daleki skok', keys: () => (touch() ? `W biegu ${A()}, potem przesuń kciuk na ${J()}` : `Turlaj się (${A()}) i skocz ${J()}`), dur: 3.0 },
    smash: { title: 'Rozbijanie dzbanków', keys: () => `Skocz na dzbanek ${J()} albo wtocz się w niego`, dur: 2.6 },
    qblock: { title: 'Bloki „?”', keys: () => `Uderz głową od spodu ${J()}`, dur: 2.5 },
  };

  let renderer, scene, camera, rabbit, shadow, el, canvas;
  let current = null, t = 0, showT = 0, hiding = false;
  const shown = new Set();
  const props = {};
  const W = 236, H = 150;

  // ---------- Małe rekwizyty ----------
  function ledge(x0, x1, top) {
    const g = new THREE.Group();
    const w = x1 - x0, cx = (x0 + x1) / 2;
    G.part(g, new ADDONS.RoundedBoxGeometry(w, top + 0.6, 1.4, 3, 0.14), G.mat(P.dirt, { rough: 0.9 }), cx, (top - 0.6) / 2, 0);
    G.part(g, new ADDONS.RoundedBoxGeometry(w + 0.1, 0.24, 1.5, 3, 0.11), G.mat(P.grass, { rough: 0.85 }), cx, top - 0.1, 0);
    scene.add(g);
    return g;
  }
  function potMesh() {
    const g = new THREE.Group();
    G.part(g, S.sphereHi, G.charMat(0xd9824f, 0.6), 0, 0.38, 0, 0.4, 0.38, 0.4);
    G.part(g, S.cyl, G.charMat(0xd9824f, 0.6), 0, 0.74, 0, 0.2, 0.18, 0.2);
    G.part(g, new THREE.TorusGeometry(0.22, 0.06, 10, 24), G.charMat(0xe89a66, 0.55), 0, 0.84, 0, 1, 1, 1, Math.PI / 2, 0, 0);
    G.part(g, new THREE.TorusGeometry(0.395, 0.035, 8, 32), G.charMat(0xf3dcc0, 0.6), 0, 0.43, 0, 1, 1, 1, Math.PI / 2, 0, 0);
    return g;
  }
  function shards(color) {
    const list = [];
    for (let i = 0; i < 8; i++) {
      const m = G.part(scene, new ADDONS.RoundedBoxGeometry(0.16, 0.06, 0.12, 1, 0.02), G.charMat(color, 0.6));
      m.visible = false;
      list.push({ m, v: V(), spin: V() });
    }
    return list;
  }
  function burst(list, at) {
    for (const s of list) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2;
      s.m.position.copy(at);
      s.v.set(Math.cos(a) * sp, 3 + Math.random() * 3, Math.sin(a) * sp * 0.4);
      s.spin.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
      s.m.visible = true;
    }
  }
  function updateShards(list, dt) {
    for (const s of list) {
      if (!s.m.visible) continue;
      s.v.y -= 16 * dt;
      s.m.position.addScaledVector(s.v, dt);
      s.m.rotation.x += s.spin.x * dt; s.m.rotation.y += s.spin.y * dt;
      if (s.m.position.y < 0.03) { s.m.position.y = 0.03; s.v.set(s.v.x * 0.5, 0, s.v.z * 0.5); s.spin.multiplyScalar(0.5); }
    }
  }
  function starMesh() {
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.36 : 0.17, a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      i === 0 ? sh.moveTo(Math.cos(a) * r, Math.sin(a) * r) : sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3 });
    geo.center();
    const m = new THREE.Mesh(geo, G.mat(P.star, { rough: 0.35, emissive: 0xffb000, ei: 0.55 }));
    scene.add(m);
    return m;
  }
  function qblockMesh() {
    const tex = G.tex.canvas(128, 128, (g, w) => {
      g.fillStyle = '#ffbe2e'; g.fillRect(0, 0, w, w);
      g.fillStyle = '#ffd45e'; g.fillRect(8, 8, w - 16, w - 16);
      g.font = '800 96px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 12; g.strokeStyle = '#e8931c'; g.strokeText('?', w / 2, w / 2 + 6);
      g.fillStyle = '#ffffff'; g.fillText('?', w / 2, w / 2 + 6);
    });
    const m = new THREE.Mesh(new ADDONS.RoundedBoxGeometry(0.95, 0.95, 0.95, 4, 0.16), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }));
    scene.add(m);
    return m;
  }

  // Każda karta buduje swoją małą dioramę.
  function build(id) {
    for (const key of Object.keys(props)) delete props[key];
    for (let i = scene.children.length - 1; i >= 0; i--) {
      const o = scene.children[i];
      if (o.userData.keep) continue;
      scene.remove(o);
      o.traverse((c) => { if (c.isMesh && !Object.values(S).includes(c.geometry)) c.geometry.dispose(); });
    }
    if (id === 'glide') { ledge(-3.4, -1.1, 1.3); ledge(1.5, 3.4, 0.5); }
    else if (id === 'longjump') { ledge(-3.4, -0.5, 0.6); ledge(1.4, 3.4, 0.6); }
    else ledge(-3.4, 3.4, 0);
    if (id === 'highjump') { props.star = starMesh(); props.star.position.set(0.2, 2.45, 0); }
    if (id === 'roll' || id === 'smash') {
      props.pot = potMesh(); props.pot.position.set(id === 'roll' ? 1.2 : 0.4, 0, 0); scene.add(props.pot);
      props.shards = shards(0xd9824f);
    }
    if (id === 'qblock') {
      props.block = qblockMesh(); props.block.position.set(0.2, 2.15, 0);
      props.star = starMesh(); props.star.visible = false;
    }
  }
  // Początek każdej pętli: dzbanek wraca na miejsce, odłamki znikają.
  function reset() {
    if (props.pot) props.pot.visible = true;
    if (props.shards) props.shards.forEach((s) => (s.m.visible = false));
  }

  // ---------- Choreografie: położenie i tryb animacji królika w czasie pętli ----------
  const arc = (a, b, h, k01) => a + (b - a) * k01 + Math.sin(Math.PI * k01) * h;
  function pose(id, tt, dt) {
    const r = { x: 0, y: 0, yaw: Math.PI / 2, mode: 'idle', speed: 0, vy: 0, flip: 0, charged: false };
    if (id === 'highjump') {
      r.x = 0.2; r.yaw = 0.35;
      if (tt < 0.25) r.mode = 'idle';
      else if (tt < 1.0) { r.mode = 'crouch'; r.charged = tt > 0.5; }
      else if (tt < 2.0) {
        const j = (tt - 1.0) / 1.0;
        r.y = Math.sin(Math.PI * j) * 2.0;
        r.mode = j < 0.5 ? 'jump' : 'fall'; r.vy = j < 0.5 ? 8 : -8;
        r.flip = j < 0.62 ? Math.min(0.999, j / 0.62) : 0;
      }
      props.star.rotation.y += dt * 2.4;
      props.star.visible = !(tt > 1.45 && tt < 2.6);
      if (tt > 1.45 && tt - dt <= 1.45) G.sfx.play('star');
    } else if (id === 'glide') {
      if (tt < 0.4) { r.x = -3.0 + tt * 4.2; r.y = 1.3; r.mode = 'run'; r.speed = 4.2; }
      else {
        // Wybicie, szybowanie nad przepaścią i lądowanie na drugim brzegu (x ≈ 1.78).
        const a = Math.min(tt - 0.4, 2.0);
        r.x = -1.32 + a * 1.55;
        if (a < 0.4) { r.y = 1.3 + Math.sin((a / 0.4) * Math.PI * 0.5) * 0.9; r.mode = 'jump'; r.vy = 5; }
        else { r.y = Math.max(0.5, 2.2 - (a - 0.4) * 1.06); r.mode = a < 2.0 ? 'glide' : 'idle'; }
      }
    } else if (id === 'roll') {
      if (tt < 0.5) { r.x = -3.0 + tt * 3.6; r.mode = 'run'; r.speed = 3.6; }
      else if (tt < 1.15) { r.x = -1.2 + (tt - 0.5) * 5.85; r.mode = 'roll'; r.speed = 9; }
      else { r.x = 2.6; r.mode = 'idle'; }
      if (tt >= 0.91 && tt - dt < 0.91) { props.pot.visible = false; burst(props.shards, V(1.2, 0.5, 0)); G.sfx.play('crack'); }
    } else if (id === 'longjump') {
      if (tt < 0.35) { r.x = -3.1 + tt * 3.8; r.y = 0.6; r.mode = 'run'; r.speed = 4; }
      else if (tt < 0.8) { r.x = -1.77 + (tt - 0.35) * 2.6; r.y = 0.6; r.mode = 'roll'; r.speed = 9; }
      else if (tt < 1.45) { const j = (tt - 0.8) / 0.65; r.x = -0.6 + j * 2.9; r.y = arc(0.6, 0.6, 1.0, j); r.mode = 'roll'; r.speed = 9; }
      else { r.x = 2.3; r.y = 0.6; r.mode = 'idle'; }
    } else if (id === 'smash') {
      if (tt < 0.4) { r.x = -1.4; r.mode = 'idle'; }
      else if (tt < 1.0) { const j = (tt - 0.4) / 0.6; r.x = -1.4 + j * 1.8; r.y = arc(0, 0.86, 1.5, j); r.mode = j < 0.5 ? 'jump' : 'fall'; r.vy = j < 0.5 ? 6 : -6; }
      else if (tt < 1.55) { const j = (tt - 1.0) / 0.55; r.x = 0.4 + j * 0.6; r.y = arc(0.86, 0, 0.9, j); r.mode = j < 0.4 ? 'jump' : 'fall'; }
      else { r.x = 1.0; r.mode = 'idle'; }
      if (tt >= 1.0 && tt - dt < 1.0) { props.pot.visible = false; burst(props.shards, V(0.4, 0.5, 0)); G.sfx.play('crack'); }
    } else if (id === 'qblock') {
      r.x = 0.2; r.yaw = 0.35;
      if (tt >= 0.4 && tt < 1.2) { const j = (tt - 0.4) / 0.8; r.y = Math.sin(Math.PI * j) * 0.8; r.mode = j < 0.5 ? 'jump' : 'fall'; r.vy = j < 0.5 ? 7 : -7; }
      const hit = tt - 0.8;
      props.block.position.y = 2.15 + (hit > 0 && hit < 0.2 ? Math.sin((hit / 0.2) * Math.PI) * 0.25 : 0);
      if (hit > 0 && hit < 1.0) {
        props.star.visible = true;
        props.star.position.set(0.2, 2.8 + Math.min(1, hit * 3) * 0.7, 0);
        props.star.rotation.y += dt * 8;
        props.star.scale.setScalar(1 - Math.max(0, hit - 0.6) * 2.5);
      } else props.star.visible = false;
      if (hit > 0 && hit - dt <= 0) G.sfx.play('block');
    }
    return r;
  }

  return {
    init() {
      el = document.getElementById('tipcard');
      canvas = document.getElementById('tip-canvas');
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W, H, false);
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.NeutralToneMapping;
      scene = new THREE.Scene();
      const hemi = new THREE.HemisphereLight(0xdfeaff, 0xb59570, 1.6);
      const sun = new THREE.DirectionalLight(0xffe2bf, 2.6);
      sun.position.set(-2, 5, 4);
      for (const o of [hemi, sun]) { o.userData.keep = true; scene.add(o); }
      camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
      camera.position.set(0, 1.85, 7.0);
      camera.lookAt(0, 1.2, 0);
      rabbit = new G.Rabbit();
      rabbit.root.userData.keep = true;
      scene.add(rabbit.root);
      shadow = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24), new THREE.MeshBasicMaterial({ color: 0x3a2a40, transparent: true, opacity: 0.25, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2;
      shadow.userData.keep = true;
      scene.add(shadow);
    },
    // Zwraca true, jeśli karta się pojawiła.
    show(id) {
      if (!CARDS[id] || shown.has(id) || current) return false;
      shown.add(id);
      current = id; t = 0; showT = 0; hiding = false;
      build(id);
      document.getElementById('tip-title').textContent = CARDS[id].title;
      document.getElementById('tip-keys').innerHTML = CARDS[id].keys();
      el.classList.remove('hidden', 'out');
      G.sfx.play('pop');
      // Na telefonie oba skoki robi się przesunięciem kciuka z Kulki na Skok: pokazujemy ten gest na przyciskach.
      if (id === 'highjump' || id === 'longjump') G.touch.slideHint(true);
      return true;
    },
    hide() {
      if (!current || hiding) return;
      hiding = true;
      G.touch.slideHint(false);
      el.classList.add('out');
      setTimeout(() => { el.classList.add('hidden'); current = null; hiding = false; }, 450);
    },
    update(dt) {
      if (!current) return;
      showT += dt;
      if (showT > SHOW_TIME) this.hide();
      const card = CARDS[current];
      const prevT = t;
      t = (t + dt) % card.dur;
      if (t < prevT) reset();
      const r = pose(current, t, dt);
      rabbit.root.position.set(r.x, r.y, 0);
      rabbit.root.rotation.y = r.yaw;
      rabbit.update(dt, { mode: r.mode, speed: r.speed, vy: r.vy, flip: r.flip, charged: r.charged, noIdle: true });
      const ground = current === 'glide' ? (r.x < -1.1 ? 1.3 : r.x > 1.5 ? 0.5 : -5) : current === 'longjump' ? (r.x < -0.5 || r.x > 1.4 ? 0.6 : -5) : 0;
      shadow.visible = ground > -1;
      shadow.position.set(r.x, ground + 0.02, 0);
      shadow.scale.setScalar(Math.max(0.4, 1 - (r.y - ground) * 0.2));
      if (props.shards) updateShards(props.shards, dt);
      renderer.render(scene, camera);
    },
    get active() { return current; },
  };
})();
