'use strict';
// Życie w tle: motyle, złoty pyłek w powietrzu i płatki opadające z drzew.
G.ambient = (() => {
  const flies = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  let moteT = 0;

  function butterfly(color) {
    const g = new THREE.Group();
    const wing = new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.18 });
    const wing2 = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, -0.08), roughness: 0.6, side: THREE.DoubleSide });
    G.part(g, G.GEO.sphereLow, G.mat(0x4a3a4a, { rough: 0.6 }), 0, 0, 0, 0.03, 0.03, 0.12).castShadow = false;
    const wings = [-1, 1].map((s) => {
      const pv = new THREE.Group();
      g.add(pv);
      G.part(pv, G.GEO.sphereLow, wing, s * 0.12, 0, 0.03, 0.12, 0.01, 0.1).castShadow = false;
      G.part(pv, G.GEO.sphereLow, wing2, s * 0.08, 0, -0.07, 0.08, 0.008, 0.065).castShadow = false;
      return { pv, s };
    });
    g.scale.setScalar(1.25);
    return { g, wings };
  }

  // ---------- Rybki: pływają pod taflą i co jakiś czas wyskakują łukiem nad wodę ----------
  const fishes = [];
  const FISH = [[0xff9a4a, 0xffffff], [0x5fb4ef, 0xd8f0ff], [0xffd04a, 0xff9a4a], [0xf58aa0, 0xffffff]];
  function fishModel(body, accent) {
    const g = new THREE.Group();
    const S = G.GEO;
    const bm = G.charMat(body, 0.5), am = G.charMat(accent, 0.55);
    G.part(g, S.sphereMid, bm, 0, 0, 0, 0.15, 0.14, 0.3);
    G.part(g, S.sphereLow, am, 0, -0.035, 0.02, 0.12, 0.09, 0.24);
    const tail = new THREE.Group();
    tail.position.z = -0.28;
    g.add(tail);
    G.part(tail, S.sphereLow, bm, 0, 0.07, -0.1, 0.03, 0.11, 0.09, -0.6, 0, 0);
    G.part(tail, S.sphereLow, bm, 0, -0.07, -0.1, 0.03, 0.11, 0.09, 0.6, 0, 0);
    G.part(g, S.sphereLow, am, 0, 0.14, -0.04, 0.025, 0.08, 0.12, 0.3, 0, 0);
    for (const s of [-1, 1]) {
      G.part(g, S.sphereLow, G.mat(0xffffff, { rough: 0.3 }), s * 0.1, 0.04, 0.17, 0.045);
      G.part(g, S.sphereLow, G.mat(G.PAL.eye, { rough: 0.2 }), s * 0.125, 0.045, 0.19, 0.026);
      G.part(g, S.sphereLow, am, s * 0.14, -0.04, 0.02, 0.02, 0.05, 0.08, 0, s * 0.5, s * 0.6);
    }
    g.scale.setScalar(1.35);
    return { g, tail };
  }
  function addFish(scene, x, z, i) {
    const [b, a] = FISH[i % FISH.length];
    const f = fishModel(b, a);
    f.home = V(x, -0.5, z);
    f.ang = Math.random() * Math.PI * 2;
    f.r = G.u.rand(0.8, 1.6);
    f.spd = G.u.rand(0.5, 0.9) * (Math.random() < 0.5 ? 1 : -1);
    f.pos = V(x, -0.5, z);
    f.vel = V();
    f.state = 'swim';
    f.timer = G.u.rand(2, 7);
    f.t = Math.random() * 10;
    f.g.position.copy(f.pos);
    scene.add(f.g);
    fishes.push(f);
  }
  function updateFish(dt, focus, player) {
    for (const f of fishes) {
      const far = Math.abs(f.home.x - focus.x) > 34;
      f.g.visible = !far;
      if (far) continue;
      f.t += dt;
      f.tail.rotation.y = Math.sin(f.t * (f.state === 'jump' ? 22 : 9)) * 0.45;
      const dp = Math.hypot(player.pos.x - f.pos.x, player.pos.z - f.pos.z);
      if (f.state === 'swim') {
        // Spłoszona rybka przyspiesza (i czasem wyskakuje), gdy Tuptuś podpływa.
        const scared = player.swimming && dp < 2.2;
        f.ang += f.spd * dt * (scared ? 3.5 : 1) / f.r;
        const tx = f.home.x + Math.cos(f.ang) * f.r, tz = f.home.z + Math.sin(f.ang) * f.r;
        const dx = tx - f.pos.x, dz = tz - f.pos.z;
        f.pos.set(tx, -0.5 + Math.sin(f.t * 1.3) * 0.08, tz);
        if (dx * dx + dz * dz > 1e-7) f.g.rotation.set(0, Math.atan2(dx, dz), 0);
        f.timer -= dt * (scared ? 4 : 1);
        if (f.timer <= 0) {
          f.timer = G.u.rand(3, 8);
          const h = f.g.rotation.y, hs = G.u.rand(1.8, 2.8), vy = G.u.rand(6, 7.5);
          const land = V(f.pos.x + Math.sin(h) * hs * (2 * vy / 14), 0, f.pos.z + Math.cos(h) * hs * (2 * vy / 14));
          if (G.water.shoreAt(f.pos.x, f.pos.z) > 0.6 && G.water.shoreAt(land.x, land.z) > 0.8) {
            f.state = 'jump';
            f.vel.set(Math.sin(h) * hs, vy, Math.cos(h) * hs);
            f.pos.y = -0.1;
            f.flip = Math.random() < 0.35;
            G.fx.splash(f.pos, false);
            G.fx.ring(V(f.pos.x, 0, f.pos.z), 8, 0xf4fbff, 1.4);
          }
        }
      } else {
        f.vel.y -= 14 * dt;
        f.pos.addScaledVector(f.vel, dt);
        const pitch = Math.atan2(-f.vel.y, Math.hypot(f.vel.x, f.vel.z));
        f.g.rotation.set(pitch, Math.atan2(f.vel.x, f.vel.z), f.flip ? f.t * 9 : 0, 'YXZ');
        if (Math.random() < dt * 10) G.fx.twinkle(f.pos.clone(), 0xffffff);
        if (f.pos.y < -0.1 && f.vel.y < 0) {
          f.state = 'swim';
          G.fx.splash(f.pos, false);
          G.fx.ring(V(f.pos.x, 0, f.pos.z), 10, 0xf4fbff, 1.8);
          f.home.set(f.pos.x - Math.cos(f.ang) * f.r, -0.5, f.pos.z - Math.sin(f.ang) * f.r);
        }
      }
      f.g.position.copy(f.pos);
    }
  }

  return {
    init(scene) {
      const fishSpots = [[21.4, 3.2], [30.2, 3.6], [25.6, -4.6], [35.6, -3.4], [40.2, 6.8], [58.5, 0.6], [63.5, 3.2], [72, 2], [80.4, 3.6],
        [106.2, 2.4], [124, -1.5], [-8.4, 2.2], [-8.3, -4.8], [111.5, 9.2], [12, 7.5], [47, 7]];
      fishSpots.forEach(([x, z], i) => addFish(scene, x, z, i));
      const colors = [0xf7a8c4, 0xffe07a, 0x8fc8f5, 0xfff8ee, 0xc6a6f2, 0xffbf8f];
      const spots = [[3, 1.9, -1], [10, 2.1, 2.5], [-3, 2, -2.5], [27, 2.2, 3.5], [46, 2.4, 0], [53, 6.2, -3.5],
        [90, 2.3, -0.5], [98, 2.4, 1.8], [113, 2.4, 0], [119, 2.3, -1.5], [16, 2.2, 1], [85, 2.2, 2.5]];
      spots.forEach(([x, y, z], i) => {
        const b = butterfly(colors[i % colors.length]);
        b.home = V(x, y, z);
        b.a = G.u.rand(0.35, 0.6); b.b = G.u.rand(0.9, 1.4); b.c = G.u.rand(0.3, 0.55);
        b.rx = G.u.rand(1.5, 3); b.rz = G.u.rand(1, 2.2);
        b.t = Math.random() * 20; b.flee = 0; b.prev = b.home.clone();
        scene.add(b.g);
        flies.push(b);
      });
    },
    update(dt, focus, player) {
      updateFish(dt, focus, player);
      for (const b of flies) {
        const far = Math.abs(b.home.x - focus.x) > 32;
        b.g.visible = !far;
        if (far) continue;
        b.t += dt;
        const d = player.pos.distanceTo(b.g.position);
        b.flee = d < 2 ? Math.min(2.2, b.flee + dt * 5) : Math.max(0, b.flee - dt * 0.4);
        const t = b.t;
        b.g.position.set(
          b.home.x + Math.sin(t * b.a) * b.rx + Math.sin(t * 1.7) * 0.15,
          b.home.y + Math.sin(t * b.b) * 0.3 + b.flee,
          b.home.z + Math.cos(t * b.c) * b.rz);
        const dx = b.g.position.x - b.prev.x, dz = b.g.position.z - b.prev.z;
        if (dx * dx + dz * dz > 1e-6) b.g.rotation.y = G.u.angleDamp(b.g.rotation.y, Math.atan2(dx, dz), 6, dt);
        b.prev.copy(b.g.position);
        const flap = 0.15 + Math.abs(Math.sin(t * (b.flee > 0.1 ? 26 : 15))) * 1.15;
        for (const w of b.wings) w.pv.rotation.z = w.s * flap;
      }

      // Złoty pyłek wokół kamery.
      moteT -= dt;
      // Nocą robi się więcej świetlików (i rzadziej zwykłego pyłku).
      const night = G.daytime ? G.daytime.night : 0;
      if (moteT <= 0) {
        moteT = 0.16 - night * 0.08;
        const p = V(focus.x + G.u.rand(-13, 13), focus.y + G.u.rand(0.3, 4.5), focus.z + G.u.rand(-7, 5));
        // Część pyłków to świetliki: jaśniejsze, żółte, nisko nad trawą (łapią poświatę).
        if (Math.random() < 0.25 + night * 0.6) G.fx.mote(V(p.x, focus.y + G.u.rand(0.6, 2.2), p.z), 0xfff07a, 1.5 + night * 0.8);
        else G.fx.mote(p);
      }
      // Płatki z pobliskich drzew.
      for (const [x, y, z, s] of G.props.treeSpots) {
        if (Math.abs(x - focus.x) > 22 || Math.abs(z - focus.z) > 14 || Math.random() > dt * 0.7) continue;
        G.fx.drift(V(x + G.u.rand(-1.2, 1.2) * s, y + G.u.rand(-0.3, 0.6), z + G.u.rand(-0.6, 1.4) * s));
      }
    },
  };
})();
