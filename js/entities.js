'use strict';
// Obiekty interaktywne: gwiazdki, bloki „?”, trampoliny, ruchome platformy, chmurki i zagubieni przyjaciele.
G.ent = (() => {
  const list = { stars: [], blocks: [], tramps: [], movers: [], clouds: [], friends: [], enemies: [] };
  let scene;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---------- Gwiazdka ----------
  let starGeo = null;
  function getStarGeo() {
    if (starGeo) return starGeo;
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.36 : 0.17;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      i === 0 ? sh.moveTo(Math.cos(a) * r, Math.sin(a) * r) : sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    starGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 4, curveSegments: 4 });
    starGeo.center();
    starGeo.computeVertexNormals();
    return starGeo;
  }
  const starMat = () => G.mat(G.PAL.star, { rough: 0.35, emissive: 0xffb000, ei: 0.55 });

  class Star {
    constructor(x, y, z, hidden = false) {
      this.home = V(x, y, z);
      this.mesh = new THREE.Mesh(getStarGeo(), starMat());
      this.mesh.castShadow = true;
      this.mesh.position.copy(this.home);
      this.phase = Math.random() * 6;
      this.taken = false;
      this.popT = hidden ? -1 : 0;
      this.mesh.visible = !hidden;
      this.beacon = null;
      // Miękka aureola wokół gwiazdki.
      this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.glow(), color: 0xffd36a, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.halo.scale.setScalar(1.5);
      this.mesh.add(this.halo);
      this.pull = 0;
      scene.add(this.mesh);
    }
    // Gwiazdka z bloku „?” wyskakuje w górę i sama trafia do licznika.
    reveal(from) { this.popT = 0.001; this.auto = true; this.mesh.visible = true; this.mesh.position.copy(from); this.from = from.clone(); }
    setBeacon(on) {
      if (on && !this.beacon && !this.taken) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 30, 16, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
        m.position.set(this.home.x, this.home.y + 15, this.home.z);
        this.beacon = m;
        scene.add(m);
      }
    }
    update(dt, t, player) {
      if (this.taken || this.popT < 0) return;
      if (this.popT > 0 && this.popT < 1) {
        this.popT = Math.min(1, this.popT + dt * 2.2);
        const k = this.popT;
        this.mesh.position.lerpVectors(this.from, this.home, 1 - (1 - k) ** 3);
        this.mesh.position.y += Math.sin(k * Math.PI) * 0.8;
      } else if (this.pull > 0) {
        // Magnes: gwiazdka sama podlatuje do Tuptusia, gdy jest blisko.
        this.pull = Math.min(30, this.pull + dt * 40);
        const to = player.center.clone().sub(this.mesh.position);
        this.mesh.position.addScaledVector(to, Math.min(1, (this.pull * dt) / Math.max(0.2, to.length())));
      } else {
        this.mesh.position.y = this.home.y + Math.sin(t * 2.2 + this.phase) * 0.12;
      }
      this.mesh.rotation.y = t * 2.4 + this.phase + this.pull * 0.2;
      this.halo.material.opacity = 0.32 + Math.sin(t * 3.1 + this.phase) * 0.12;
      if (this.beacon) this.beacon.material.opacity = 0.16 + Math.sin(t * 3) * 0.06;
      if (Math.random() < dt * 0.8) G.fx.twinkle(this.mesh.position.clone().add(V(G.u.rand(-0.4, 0.4), G.u.rand(-0.3, 0.3), 0.2)));
      if (this.auto) { if (this.popT >= 1) this.collect(); return; }
      const d = player.center.distanceTo(this.mesh.position);
      if (d < 0.85) this.collect();
      else if (d < 1.9 && this.pull === 0 && player.respawnT <= 0) this.pull = 4;
    }
    collect() {
      this.taken = true;
      scene.remove(this.mesh);
      if (this.beacon) { scene.remove(this.beacon); this.beacon = null; }
      const p = this.mesh.position;
      G.fx.flash(p, 0xffe9a0, 2.6);
      G.fx.sparkle(p, 16, 0xffe38a, 3.4);
      G.fx.confetti(p, 12);
      G.sfx.play('star');
      G.emit('star', this);
    }
  }

  // ---------- Blok „?” ----------
  let qTex = null, usedTex = null;
  function blockTex(q) {
    return G.tex.canvas(128, 128, (g, w) => {
      g.fillStyle = q ? '#ffbe2e' : '#d7a777';
      g.fillRect(0, 0, w, w);
      g.fillStyle = q ? '#ffd45e' : '#e2b88c';
      g.fillRect(8, 8, w - 16, w - 16);
      if (q) {
        g.font = '800 96px "Baloo 2", Arial Rounded MT Bold, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 12; g.strokeStyle = '#e8931c'; g.strokeText('?', w / 2, w / 2 + 6);
        g.fillStyle = '#ffffff'; g.fillText('?', w / 2, w / 2 + 6);
      }
    });
  }
  class QBlock {
    constructor(x, y, z) {
      qTex ||= blockTex(true); usedTex ||= blockTex(false);
      this.mesh = new THREE.Mesh(new ADDONS.RoundedBoxGeometry(0.95, 0.95, 0.95, 4, 0.16), new THREE.MeshStandardMaterial({ map: qTex, roughness: 0.55 }));
      this.mesh.castShadow = this.mesh.receiveShadow = true;
      this.mesh.position.set(x, y, z);
      this.base = y;
      scene.add(this.mesh);
      this.col = G.phys.addBox(x - 0.48, y - 0.48, z - 0.48, x + 0.48, y + 0.48, z + 0.48, 'qblock');
      this.col.ref = this;
      this.used = false; this.bumpT = 0;
      this.sq = 0; this.sqV = 0; this.t = Math.random() * 6;
      this.star = new Star(x, y + 1.25, z, true);
      list.stars.push(this.star);
    }
    hit() {
      if (this.bumpT > 0) return;
      this.bumpT = 0.001;
      this.sqV = 7;
      if (this.used) { G.sfx.play('land'); return; }
      this.used = true;
      this.mesh.material.map = usedTex;
      this.mesh.material.needsUpdate = true;
      G.sfx.play('block');
      const top = this.mesh.position.clone().add(V(0, 0.6, 0));
      G.fx.flash(top, 0xfff3b0, 2.2);
      G.fx.sparkle(top, 12);
      G.fx.ring(this.mesh.position.clone().add(V(0, 0.45, 0)), 10, 0xfff3c8, 2);
      G.emit('juice', { shake: 0.12 });
      this.star.reveal(this.mesh.position.clone());
    }
    update(dt) {
      this.t += dt;
      [this.sq, this.sqV] = G.u.spring(this.sq, this.sqV, 0, 260, 10, dt);
      let y = this.base;
      if (this.bumpT > 0) {
        this.bumpT += dt * 5;
        y += Math.sin(Math.min(1, this.bumpT) * Math.PI) * 0.3;
        if (this.bumpT >= 1) this.bumpT = 0;
      }
      // Nieużyty blok delikatnie „oddycha”, żeby przyciągał wzrok.
      const breathe = this.used ? 0 : Math.sin(this.t * 3) * 0.025;
      this.mesh.position.y = y;
      this.mesh.scale.set(1 + this.sq * 0.5 + breathe, 1 - this.sq + breathe, 1 + this.sq * 0.5 + breathe);
    }
  }

  // ---------- Trampolina ----------
  class Tramp {
    constructor(x, y, z) {
      this.g = new THREE.Group();
      this.g.position.set(x, y, z);
      const blue = G.mat(0x5aaaf0, { rough: 0.5 }), light = G.mat(0x8ccaf8, { rough: 0.5 }), gray = G.mat(0x8a8fa3, { rough: 0.45 });
      G.part(this.g, G.GEO.cyl, blue, 0, 0.09, 0, 0.72, 0.18, 0.72);
      this.coils = [];
      for (let i = 0; i < 3; i++) this.coils.push(G.part(this.g, new THREE.TorusGeometry(0.42, 0.08, 10, 24), gray, 0, 0.26 + i * 0.13, 0, 1, 1, 1, Math.PI / 2, 0, 0));
      this.top = new THREE.Group();
      this.g.add(this.top);
      G.part(this.top, G.GEO.cyl, blue, 0, 0, 0, 0.75, 0.18, 0.75);
      G.part(this.top, G.GEO.cyl, light, 0, 0.1, 0, 0.6, 0.04, 0.6);
      this.top.position.y = 0.62;
      scene.add(this.g);
      this.col = G.phys.addCyl(x, z, 0.75, y, y + 0.72, 'tramp');
      this.col.ref = this;
      this.s = 0; this.v = 0;
    }
    bounce() { this.v = -9; G.sfx.play('boing'); G.fx.ring(this.g.position.clone().add(V(0, 0.7, 0)), 10, 0xffffff); }
    update(dt) {
      [this.s, this.v] = G.u.spring(this.s, this.v, 0, 320, 9, dt);
      this.top.position.y = 0.62 + this.s * 0.35;
      this.coils.forEach((c, i) => { c.position.y = 0.26 + i * 0.13 * (1 + this.s * 0.6); });
    }
  }

  // ---------- Ruchoma platforma (blok z trawą) ----------
  class Mover {
    constructor(a, b, w, d, period = 5, phase = 0) {
      this.a = V(...a); this.b = V(...b); this.period = period; this.phase = phase;
      const B = new G.Batcher(1000);
      G.props.block(B, 0, 0, w, d, 0, { bottom: -0.7, collider: false, seed: 5 });
      this.g = B.build(scene);
      this.g.position.copy(this.a);
      this.col = G.phys.addBox(this.a.x - w / 2, this.a.y - 0.7, this.a.z - d / 2, this.a.x + w / 2, this.a.y, this.a.z + d / 2);
      this.h = 0.7;
    }
    update(dt, t) {
      const k = 0.5 - 0.5 * Math.cos(((t / this.period) + this.phase) * Math.PI * 2);
      this.g.position.lerpVectors(this.a, this.b, k);
      G.phys.moveTo(this.col, this.g.position.x, this.g.position.y - this.h / 2, this.g.position.z);
    }
  }

  // ---------- Chmurka (można na nią wskoczyć od dołu) ----------
  class Cloud {
    constructor(x, y, z, r = 1.2, drift = null) {
      this.home = V(x, y, z); this.r = r; this.drift = drift;
      this.g = new THREE.Group();
      const m = G.mat(0xffffff, { rough: 1, emissive: 0x3a3a44 });
      const p = [[0, 0, 0, 1, 0.55], [-0.75, -0.08, 0.1, 0.62, 0.42], [0.78, -0.06, -0.05, 0.66, 0.44], [0.2, 0.2, -0.35, 0.6, 0.45], [-0.3, 0.12, 0.45, 0.55, 0.4]];
      for (const [px, py, pz, s, sy] of p) G.part(this.g, G.GEO.sphereMid, m, px * r, py * r - 0.15, pz * r, s * r, sy * r, s * r * 0.9);
      this.g.position.copy(this.home);
      scene.add(this.g);
      this.col = G.phys.addCyl(x, z, r * 1.05, y - 0.6, y + 0.1, 'cloud');
      this.col.oneWay = true;
      this.col.ref = this;
      this.s = 0; this.v = 0;
    }
    land() { this.v = -4; G.sfx.play('cloud'); G.fx.ring(this.g.position.clone().add(V(0, 0.1, 0)), 8, 0xffffff, 1.6); }
    update(dt, t) {
      [this.s, this.v] = G.u.spring(this.s, this.v, 0, 120, 6, dt);
      let x = this.home.x, z = this.home.z, y = this.home.y + Math.sin(t * 1.3 + this.home.x) * 0.06;
      if (this.drift) {
        const k = Math.sin((t / this.drift.period) * Math.PI * 2);
        x += this.drift.dx * k; y += (this.drift.dy || 0) * k; z += (this.drift.dz || 0) * k;
      }
      this.g.position.set(x, y + this.s * 0.25, z);
      this.g.scale.set(1 - this.s * 0.15, 1 + this.s * 0.3, 1 - this.s * 0.15);
      G.phys.moveTo(this.col, x, y + 0.1, z);
    }
  }

  // ---------- Łódka przy pomoście (można do niej wskoczyć) ----------
  class Boat {
    constructor(x, z, ry = 0) {
      this.g = new THREE.Group();
      this.g.position.set(x, 0, z);
      this.g.rotation.y = ry;
      this.ry = ry;
      const hull = G.charMat(0xb97a47, 0.75), inner = G.charMat(0x8a5531, 0.85), rim = G.charMat(0x6f4527, 0.7);
      G.part(this.g, G.GEO.sphereHi, hull, 0, 0.02, 0, 0.8, 0.42, 1.62);
      G.part(this.g, new THREE.TorusGeometry(1, 0.07, 10, 40), rim, 0, 0.41, 0, 0.75, 1.54, 1, Math.PI / 2, 0, 0);
      G.part(this.g, G.GEO.cyl, inner, 0, 0.37, 0, 0.7, 0.04, 1.46);
      const seat = new ADDONS.RoundedBoxGeometry(1.25, 0.08, 0.3, 2, 0.03);
      G.part(this.g, seat, rim, 0, 0.44, 0.55);
      G.part(this.g, seat, rim, 0, 0.44, -0.5);
      for (const s of [-1, 1]) G.part(this.g, G.GEO.cylLow, rim, s * 0.72, 0.48, 0, 0.035, 0.12, 0.035);
      scene.add(this.g);
      // Dno łódki jako platforma (lekko poniżej krawędzi).
      this.col = G.phys.addBox(x - 0.62, -0.6, z - 1.3, x + 0.62, 0.4, z + 1.3);
      G.props.shoreBox(x, z, 0.8, 1.62, 0.78);
      this.t = Math.random() * 10;
    }
    update(dt) {
      this.t += dt;
      this.g.position.y = Math.sin(this.t * 1.3) * 0.04;
      this.g.rotation.set(Math.sin(this.t * 0.9) * 0.025, this.ry + Math.sin(this.t * 0.4) * 0.03, Math.sin(this.t * 1.1) * 0.04);
    }
  }

  // ---------- Zagubiony przyjaciel ----------
  class Friend {
    constructor(name, x, y, z, look) {
      this.name = name;
      this.look = look;
      this.rabbit = new G.Rabbit({ scale: 0.68, blush: true, ...look });
      this.rabbit.root.position.set(x, y, z);
      this.rabbit.root.rotation.y = 0.3;
      this.rabbit.setExpr('sad');
      scene.add(this.rabbit.root);
      this.found = false; this.index = 0; this.sobT = 2;
      this.line = look.line || 'Dziękuję!';
      this.called = false; this.hopT = 0;
      this.prev = V(x, y, z);
      this.fpos = V(x, y, z);
      const bubbleTex = G.tex.canvas(128, 128, (g, w) => {
        g.fillStyle = '#ffffff';
        g.beginPath(); g.arc(64, 56, 46, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(48, 92); g.lineTo(64, 122); g.lineTo(74, 94); g.fill();
        g.font = '800 76px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = '#f2607a'; g.fillText('!', 64, 60);
      });
      this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex, transparent: true, depthWrite: false }));
      this.bubble.scale.setScalar(0.7);
      scene.add(this.bubble);
    }
    update(dt, t, player, followIndex) {
      const r = this.rabbit;
      if (!this.found) {
        const d = player.center.distanceTo(r.root.position);
        this.bubble.visible = d < 14 && !this.called;
        this.bubble.position.set(r.root.position.x, r.root.position.y + 1.65 + Math.sin(t * 3) * 0.08, r.root.position.z);
        this.sobT -= dt;
        if (this.sobT < 0) { this.sobT = G.u.rand(2, 4); r.squash(0.3); if (d < 10) G.sfx.play('sad'); }
        const face = Math.atan2(player.pos.x - r.root.position.x, player.pos.z - r.root.position.z);
        if (d < 6) r.root.rotation.y = G.u.angleDamp(r.root.rotation.y, face, 4, dt);
        // Gdy Tuptuś się zbliża, przyjaciel woła i podskakuje.
        if (d < 7.5 && !this.called) {
          this.called = true; this.hopT = 0.001;
          G.fx.bubble(r.root.position.clone().add(V(0, 1.9, 0)), 'Tutaj! Pomocy!', 2.4);
          G.sfx.play('pop');
          this.bubble.visible = false;
        }
        if (this.called && this.hopT === 0 && Math.random() < dt * 0.6 && d < 9) this.hopT = 0.001;
        r.update(dt, { mode: this.hopT > 0 ? 'jump' : 'sad', speed: 0, vy: this.hopT > 0 ? 4 : 0, noIdle: true });
        r.root.position.y = this.fpos.y + this._hop(dt, 0.35);
        if (d < 1.1) this.rescue(followIndex);
        return;
      }
      // Podążanie śladem Tuptusia.
      const tr = player.trail;
      const lag = 9 + this.index * 7;
      const p = tr[Math.max(0, tr.length - 1 - lag)];
      if (p) {
        const target = V(p.x, p.y, p.z);
        const pos = this.fpos;
        // Zachowujemy odstęp, żeby przyjaciele nie wchodzili Tuptusiowi na głowę.
        const dp = Math.hypot(pos.x - player.pos.x, pos.z - player.pos.z);
        if (dp > 1.1 + this.index * 0.75 || Math.abs(pos.y - target.y) > 0.4) pos.lerp(target, 1 - Math.exp(-10 * dt));
        const vx = pos.x - this.prev.x, vz = pos.z - this.prev.z;
        const spd = Math.hypot(vx, vz) / Math.max(dt, 1e-4);
        if (spd > 0.3) r.root.rotation.y = G.u.angleDamp(r.root.rotation.y, Math.atan2(vx, vz), 10, dt);
        const vy = (pos.y - this.prev.y) / Math.max(dt, 1e-4);
        const mode = p.swim ? 'swim' : Math.abs(vy) > 2.5 || this.hopT > 0 ? (vy > 0 || this.hopT > 0 ? 'jump' : 'fall') : spd > 0.6 ? 'run' : 'idle';
        r.update(dt, { mode, speed: spd, vy, noIdle: true });
        this.prev.copy(pos);
      } else r.update(dt, { mode: 'idle', speed: 0, vy: 0, noIdle: true });
      r.root.position.set(this.fpos.x, this.fpos.y + this._hop(dt, 0.5), this.fpos.z);
    }
    // Wysokość radosnego podskoku (0, gdy nie skacze).
    _hop(dt, h) {
      if (this.hopT <= 0) return 0;
      this.hopT += dt * 2.8;
      if (this.hopT >= 1) { this.hopT = 0; this.rabbit.squash(0.5); return 0; }
      return Math.sin(this.hopT * Math.PI) * h;
    }
    cheer() { if (this.hopT === 0) { this.hopT = 0.001; this.rabbit.setExpr('joy'); } }
    rescue(index) {
      this.found = true;
      this.index = index;
      this.bubble.visible = false;
      this.rabbit.setExpr('joy');
      this.rabbit.squash(-0.8);
      this.hopT = 0.001;
      const p = this.rabbit.root.position.clone().add(V(0, 0.7, 0));
      G.fx.hearts(p, 6);
      G.fx.confetti(p, 24);
      G.fx.flash(p, 0xffc0d4, 2.4);
      G.fx.bubble(p.clone().add(V(0, 1.2, 0)), this.line, 2.8);
      G.sfx.play('friend');
      G.emit('juice', { stop: 0.08 });
      G.emit('friend', this);
    }
    celebrate(t, i) {
      this.rabbit.setExpr('joy');
      if (this.hopT === 0 && Math.random() < 0.03) this.hopT = 0.001 + i * 0.01;
    }
  }

  return {
    list,
    init(sc) { scene = sc; },
    star: (x, y, z) => { const s = new Star(x, y, z); list.stars.push(s); return s; },
    // Gwiazdka schowana (np. w dzbanku): pojawia się dopiero po reveal().
    hiddenStar: (x, y, z) => { const s = new Star(x, y, z, true); list.stars.push(s); return s; },
    // Łuk gwiazdek nad przeskokiem.
    arc(x0, y0, z0, x1, y1, z1, n, h = 1.2) {
      for (let i = 0; i < n; i++) {
        const k = n === 1 ? 0.5 : i / (n - 1);
        this.star(G.u.lerp(x0, x1, k), G.u.lerp(y0, y1, k) + Math.sin(k * Math.PI) * h, G.u.lerp(z0, z1, k));
      }
    },
    qblock: (x, y, z) => { const b = new QBlock(x, y, z); list.blocks.push(b); return b; },
    tramp: (x, y, z) => { const t = new Tramp(x, y, z); list.tramps.push(t); return t; },
    mover: (...a) => { const m = new Mover(...a); list.movers.push(m); return m; },
    cloud: (...a) => { const c = new Cloud(...a); list.clouds.push(c); return c; },
    friend: (...a) => { const f = new Friend(...a); list.friends.push(f); return f; },
    boat: (...a) => { const b = new Boat(...a); (list.boats ||= []).push(b); return b; },
    updateMovers(dt, t) {
      for (const m of list.movers) m.update(dt, t);
      for (const c of list.clouds) c.update(dt, t);
    },
    update(dt, t, player) {
      for (const s of list.stars) s.update(dt, t, player);
      for (const b of list.blocks) b.update(dt);
      for (const tr of list.tramps) tr.update(dt);
      for (const b of list.boats || []) b.update(dt);
      let found = 0;
      for (const f of list.friends) if (f.found) found++;
      for (const f of list.friends) f.update(dt, t, player, found);
      for (const e of list.enemies) e.update(dt, t, player);
    },
  };
})();
