'use strict';
// Rzeczy do rozbijania i zbierania: dzbanki i skrzynki (z serduszkiem albo ukrytą gwiazdką w środku),
// serduszka leczące Tuptusia oraz złote marchewki schowane w trudno dostępnych miejscach.
G.treasure = (() => {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const S = G.GEO;
  const list = { breakables: [], hearts: [], golds: [] };
  let scene;

  // ---------- Dzbanek / skrzynka ----------
  const POTS = [
    { body: 0xd9824f, rim: 0xe89a66, band: 0xf3dcc0, shards: [0xd9824f, 0xc8703f, 0xe89a66] },
    { body: 0x6aa9d8, rim: 0x86bde6, band: 0xffffff, shards: [0x6aa9d8, 0x5893c2, 0xffffff] },
    { body: 0xf0dcc0, rim: 0xf7e8d4, band: 0xf796b4, shards: [0xf0dcc0, 0xe3c9a6, 0xf796b4] },
  ];
  class Breakable {
    constructor(kind, x, y, z, content) {
      this.kind = kind;
      this.content = content;
      this.pos = V(x, y, z);
      this.g = new THREE.Group();
      this.g.position.copy(this.pos);
      this.inner = new THREE.Group();
      this.g.add(this.inner);
      if (kind === 'pot') {
        this.look = POTS[Math.floor(Math.random() * POTS.length)];
        const L = this.look;
        G.part(this.inner, S.sphereHi, G.charMat(L.body, 0.6), 0, 0.38, 0, 0.4, 0.38, 0.4);
        G.part(this.inner, S.cyl, G.charMat(L.body, 0.6), 0, 0.74, 0, 0.2, 0.18, 0.2);
        G.part(this.inner, new THREE.TorusGeometry(0.22, 0.06, 10, 24), G.charMat(L.rim, 0.55), 0, 0.84, 0, 1, 1, 1, Math.PI / 2, 0, 0);
        G.part(this.inner, new THREE.TorusGeometry(0.395, 0.035, 8, 32), G.charMat(L.band, 0.6), 0, 0.43, 0, 1, 1, 1, Math.PI / 2, 0, 0);
        this.col = G.phys.addCyl(x, z, 0.4, y, y + 0.86, 'break');
      } else {
        const wood = G.charMat(G.PAL.wood, 0.75), dark = G.charMat(G.PAL.woodDark, 0.8);
        G.part(this.inner, new ADDONS.RoundedBoxGeometry(0.9, 0.9, 0.9, 3, 0.08), wood, 0, 0.45, 0);
        const plank = new ADDONS.RoundedBoxGeometry(1.08, 0.13, 0.05, 2, 0.02);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          for (const d of [1, -1]) {
            const m = G.part(this.inner, plank, dark, Math.sin(a) * 0.46, 0.45, Math.cos(a) * 0.46, 1, 1, 1, 0, a, d * Math.PI / 4);
            m.castShadow = false;
          }
        }
        this.col = G.phys.addBox(x - 0.45, y, z - 0.45, x + 0.45, y + 0.9, z + 0.45, 'break');
      }
      this.col.ref = this;
      this.g.rotation.y = Math.random() * Math.PI * 2;
      scene.add(this.g);
      this.wob = 0; this.wobV = 0; this.broken = false;
      if (content === 'star') this.star = G.ent.hiddenStar(x, y + 1.6, z);
    }
    nudge(k = 6) { if (Math.abs(this.wobV) < 2) this.wobV += k; }
    smash() {
      if (this.broken) return;
      this.broken = true;
      G.phys.remove(this.col);
      scene.remove(this.g);
      const c = this.pos.clone().add(V(0, 0.45, 0));
      if (this.kind === 'pot') { G.fx.debris(c, 'pot', this.look.shards); G.sfx.play('crack'); }
      else { G.fx.debris(c, 'crate', [G.PAL.wood, G.PAL.woodDark, G.PAL.woodLight]); G.sfx.play('wood'); }
      G.fx.poof(c, 8, 0xf5ead8);
      G.fx.flash(c, 0xfff0c0, 1.6, 0.2);
      G.emit('juice', { shake: 0.14, stop: 0.05 });
      if (this.content === 'star' && this.star) this.star.reveal(c);
      else if (this.content === 'heart') addHeart(c.x, c.y + 0.3, c.z, true);
      else { G.fx.petals(c, 8); G.fx.sparkle(c, 8); }
    }
    update(dt, player) {
      [this.wob, this.wobV] = G.u.spring(this.wob, this.wobV, 0, 220, 7, dt);
      this.inner.rotation.z = this.wob * 0.06;
      this.inner.rotation.x = this.wob * 0.03;
      // Lekkie zderzenie (bez rozbijania) wprawia dzbanek w kołysanie.
      const d = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
      const near = d < 0.95 && player.pos.y < this.pos.y + 0.8 && player.pos.y > this.pos.y - 0.5;
      if (near && !this.touching) this.nudge(Math.min(8, 2 + Math.hypot(player.vel.x, player.vel.z)));
      this.touching = near;
    }
  }

  // ---------- Serduszko ----------
  let heartGeo = null;
  function getHeartGeo() {
    if (heartGeo) return heartGeo;
    const s = new THREE.Shape();
    s.moveTo(0, -0.32);
    s.bezierCurveTo(-0.42, -0.02, -0.38, 0.3, -0.18, 0.3);
    s.bezierCurveTo(-0.06, 0.3, 0, 0.2, 0, 0.14);
    s.bezierCurveTo(0, 0.2, 0.06, 0.3, 0.18, 0.3);
    s.bezierCurveTo(0.38, 0.3, 0.42, -0.02, 0, -0.32);
    heartGeo = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 4, curveSegments: 10 });
    heartGeo.center();
    return heartGeo;
  }
  function addHeart(x, y, z, pop = false) {
    const m = new THREE.Mesh(getHeartGeo(), G.mat(0xf2566b, { rough: 0.35, emissive: 0xb0203a, ei: 0.35 }));
    m.castShadow = true;
    m.position.set(x, y, z);
    m.scale.setScalar(pop ? 0.2 : 1);
    scene.add(m);
    const h = { m, home: V(x, y + (pop ? 0.6 : 0), z), t: Math.random() * 6, taken: false, grow: pop ? 0 : 1 };
    list.hearts.push(h);
    return h;
  }
  function updateHearts(dt, player) {
    for (const h of list.hearts) {
      if (h.taken) continue;
      h.t += dt;
      h.grow = Math.min(1, h.grow + dt * 3);
      h.m.scale.setScalar(0.2 + 0.8 * (1 - (1 - h.grow) ** 3));
      h.m.position.set(h.home.x, G.u.lerp(h.m.position.y, h.home.y + Math.sin(h.t * 2.5) * 0.1, Math.min(1, dt * 6)), h.home.z);
      h.m.rotation.y = h.t * 2;
      if (h.grow > 0.6 && player.center.distanceTo(h.m.position) < 0.9) {
        h.taken = true;
        scene.remove(h.m);
        if (player.hearts < player.maxHearts) {
          player.hearts++;
          G.emit('hearts', { hearts: player.hearts });
        }
        G.sfx.play('heal');
        G.fx.hearts(h.m.position, 4);
        G.fx.sparkle(h.m.position, 10, 0xffb0c0);
      }
    }
  }

  // ---------- Złota marchewka ----------
  class Gold {
    constructor(x, y, z) {
      this.home = V(x, y, z);
      this.g = new THREE.Group();
      this.g.position.copy(this.home);
      const gold = new THREE.MeshStandardMaterial({ color: 0xffc531, metalness: 0.85, roughness: 0.22, emissive: 0x6a4300, emissiveIntensity: 0.6 });
      const leafM = new THREE.MeshStandardMaterial({ color: 0xd6e25a, metalness: 0.7, roughness: 0.3, emissive: 0x3a4a00, emissiveIntensity: 0.5 });
      G.part(this.g, S.cone, gold, 0, -0.05, 0, 0.17, 0.62, 0.17, Math.PI, 0, 0);
      G.part(this.g, S.sphereMid, gold, 0, 0.26, 0, 0.17, 0.07, 0.17);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        G.part(this.g, S.sphereLow, leafM, Math.cos(a) * 0.05, 0.46, Math.sin(a) * 0.05, 0.05, 0.2, 0.03, Math.sin(a) * 0.4, -a, -Math.cos(a) * 0.4);
      }
      for (let i = 0; i < 3; i++) G.part(this.g, new THREE.TorusGeometry(0.15 - i * 0.03, 0.012, 6, 20), leafM, 0, 0.12 - i * 0.14, 0, 1, 1, 1, Math.PI / 2, 0, 0);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.glow(), color: 0xffd36a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.setScalar(1.8);
      this.g.add(halo);
      this.halo = halo;
      this.g.rotation.z = 0.35;
      scene.add(this.g);
      this.t = Math.random() * 6;
      this.taken = false;
    }
    update(dt, player) {
      if (this.taken) return;
      this.t += dt;
      this.g.position.y = this.home.y + Math.sin(this.t * 2) * 0.14;
      this.g.rotation.y = this.t * 1.8;
      this.halo.material.opacity = 0.45 + Math.sin(this.t * 3.3) * 0.15;
      if (Math.random() < dt * 4) G.fx.twinkle(this.g.position.clone().add(V(G.u.rand(-0.4, 0.4), G.u.rand(-0.4, 0.5), G.u.rand(-0.3, 0.3))), 0xffe27a);
      if (player.center.distanceTo(this.g.position) < 1.15) this.collect();
    }
    collect() {
      this.taken = true;
      scene.remove(this.g);
      const p = this.g.position;
      G.fx.flash(p, 0xffd970, 4, 0.45);
      G.fx.sparkle(p, 28, 0xffe27a, 4.5);
      G.fx.confetti(p, 30);
      G.sfx.play('gold');
      G.emit('juice', { shake: 0.2, stop: 0.12 });
      G.emit('gold', this);
    }
  }

  return {
    list,
    init(sc) { scene = sc; },
    pot: (x, y, z, content = null) => { const b = new Breakable('pot', x, y, z, content); list.breakables.push(b); return b; },
    crate: (x, y, z, content = null) => { const b = new Breakable('crate', x, y, z, content); list.breakables.push(b); return b; },
    heart: (x, y, z) => addHeart(x, y, z),
    gold: (x, y, z) => { const g = new Gold(x, y, z); list.golds.push(g); return g; },
    // Kulka rozbija wszystko, czego dotknie.
    breakNear(center, r) {
      let hit = false;
      for (const b of list.breakables) {
        if (b.broken) continue;
        const dy = center.y - (b.pos.y + 0.45);
        if (Math.abs(dy) > 0.9) continue;
        if (Math.hypot(center.x - b.pos.x, center.z - b.pos.z) < r + 0.45) { b.smash(); hit = true; }
      }
      return hit;
    },
    update(dt, player) {
      for (const b of list.breakables) if (!b.broken) b.update(dt, player);
      updateHearts(dt, player);
      for (const g of list.golds) g.update(dt, player);
    },
  };
})();
