'use strict';
// Wrogowie z arkusza: żółw (można na niego skoczyć), czerwony kolczak i czarny sadzik (trzeba omijać).
G.enemies = (() => {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const S = G.GEO;
  let scene;

  function eyes(parent, y, z, spread, size, angry, white) {
    const eyeM = G.mat(G.PAL.eye, { rough: 0.2 });
    const shine = G.mat(0xffffff, { rough: 0.3, emissive: 0xffffff, ei: 0.5 });
    for (const s of [-1, 1]) {
      if (white) {
        G.part(parent, S.sphereMid, G.mat(0xffffff, { rough: 0.4 }), s * spread, y, z, size * 1.25, size * 1.4, size * 0.6, 0, s * 0.3, 0);
        G.part(parent, S.sphereMid, eyeM, s * spread * 0.92, y - size * 0.15, z + size * 0.42, size * 0.6, size * 0.75, size * 0.4, 0, s * 0.3, 0);
      } else {
        G.part(parent, S.sphereMid, eyeM, s * spread, y, z, size, size * 1.3, size * 0.6, 0, s * 0.3, 0);
        G.part(parent, S.sphereLow, shine, s * spread + size * 0.3, y + size * 0.45, z + size * 0.5, size * 0.32);
      }
      if (angry) G.part(parent, S.sphereLow, eyeM, s * spread * 0.95, y + size * 1.6, z + size * 0.2, size * 1.1, size * 0.3, size * 0.4, 0, s * 0.25, s * 0.45);
    }
  }

  class Enemy {
    constructor(kind, path, y, o = {}) {
      this.kind = kind;
      this.path = path.map(([x, z]) => V(x, y, z));
      this.y = y;
      this.speed = o.speed ?? 1.1;
      this.seg = 0; this.k = 0;
      this.g = new THREE.Group();
      this.body = new THREE.Group();
      this.g.add(this.body);
      this.g.position.copy(this.path[0]);
      scene.add(this.g);
      this.center = V();
      this.dead = false; this.deadT = 0;
      this.t = Math.random() * 10;
      this.yaw = 0;
    }
    move(dt) {
      if (this.path.length < 2) { this.g.position.copy(this.path[0]); return; }
      const a = this.path[this.seg], b = this.path[(this.seg + 1) % this.path.length];
      const len = a.distanceTo(b) || 1;
      this.k += (this.speed * dt) / len;
      if (this.k >= 1) { this.k = 0; this.seg = (this.seg + 1) % this.path.length; }
      const p = this.g.position;
      p.lerpVectors(a, b, this.k);
      this.yaw = G.u.angleDamp(this.yaw, Math.atan2(b.x - a.x, b.z - a.z), 6, dt);
      this.g.rotation.y = this.yaw;
    }
    touch(player) {
      const d = player.center.distanceTo(this.center);
      if (d > this.r + player.R - 0.05) return;
      if (this.stompable && player.vel.y < 1 && player.center.y > this.center.y + 0.12) {
        this.defeat();
        player.bounce(10.5);
        G.sfx.play('stomp');
        G.emit('juice', { shake: 0.22, stop: 0.07 });
        G.fx.flash(this.center, 0xffffff, 1.8, 0.22);
      } else if (this.stompable && player.mode === 'roll') {
        this.defeat();
        G.sfx.play('stomp');
        G.emit('juice', { shake: 0.25, stop: 0.07 });
        G.fx.flash(this.center, 0xffffff, 1.8, 0.22);
      } else player.hurt(this.center);
    }
    defeat() {
      this.dead = true; this.deadT = 0;
      G.fx.ring(this.g.position, 12, 0xffffff);
    }
    update(dt, t, player) {
      if (this.dead) {
        this.deadT += dt;
        this.body.scale.set(1 + this.deadT * 0.8, Math.max(0.15, 1 - this.deadT * 3), 1 + this.deadT * 0.8);
        if (this.deadT > 0.45 && this.g.parent) {
          scene.remove(this.g);
          const p = this.g.position.clone().add(V(0, 0.4, 0));
          G.fx.poof(p, 12);
          G.fx.petals(p, 10);
          G.fx.sparkle(p, 8);
          G.sfx.play('poof');
        }
        return;
      }
      this.t += dt;
      this.animate(dt, t);
      this.center.set(this.g.position.x, this.g.position.y + this.cy, this.g.position.z);
      if (player.respawnT <= 0) this.touch(player);
    }
  }

  class Turtle extends Enemy {
    constructor(path, y, o) {
      super('turtle', path, y, o);
      this.r = 0.62; this.cy = 0.42; this.stompable = true;
      const shell = G.charMat(0x2f9e78, 0.6), shellL = G.charMat(0x6fcf9c, 0.7), skin = G.charMat(0x7fd89c, 0.7);
      const b = this.body;
      G.part(b, S.sphereHi, shell, 0, 0.36, -0.05, 0.6, 0.48, 0.66);
      G.part(b, S.cyl, shellL, 0, 0.18, -0.05, 0.62, 0.12, 0.68);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2, v = i === 0 ? 1 : 0.55;
        const nx = i === 0 ? 0 : Math.cos(a) * 0.62, nz = i === 0 ? 0 : Math.sin(a) * 0.68;
        G.part(b, S.sphereMid, shellL, nx * 0.6, 0.36 + v * 0.42, -0.05 + nz * 0.6, 0.15, 0.06, 0.15, nz * 0.9, 0, -nx * 0.9);
      }
      this.head = new THREE.Group();
      this.head.position.set(0, 0.42, 0.62);
      b.add(this.head);
      G.part(this.head, S.sphereHi, skin, 0, 0, 0, 0.28, 0.26, 0.27);
      eyes(this.head, 0.06, 0.22, 0.11, 0.055, false, false);
      G.part(this.head, new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), G.mat(G.PAL.eye, { rough: 0.2 }), 0, -0.05, 0.26, 1, 1, 1, 0.2, 0, Math.PI);
      this.legs = [[-0.38, 0.38], [0.38, 0.38], [-0.38, -0.42], [0.38, -0.42]].map(([x, z]) => G.part(b, S.sphereMid, skin, x, 0.1, z, 0.17, 0.13, 0.19));
    }
    animate(dt) {
      this.move(dt);
      const s = Math.sin(this.t * 7);
      this.body.position.y = Math.abs(s) * 0.04;
      this.legs.forEach((l, i) => { l.position.y = 0.1 + Math.max(0, Math.sin(this.t * 7 + (i % 3 ? 0 : Math.PI))) * 0.06; });
      this.head.rotation.y = Math.sin(this.t * 1.3) * 0.25;
    }
    defeat() {
      super.defeat();
      this.head.visible = false;
      this.legs.forEach((l) => (l.visible = false));
    }
  }

  class Spiky extends Enemy {
    constructor(path, y, o) {
      super('spiky', path, y, o);
      this.r = 0.58; this.cy = 0.5; this.stompable = false;
      const red = G.charMat(0xe9535c, 0.6);
      const b = this.body;
      G.part(b, S.sphereHi, red, 0, 0.5, 0, 0.55, 0.5, 0.55);
      for (let i = 0; i < 16; i++) {
        const v = 0.15 + ((i * 0.618) % 1) * 0.8;
        const a = i * 2.4;
        const n = V(Math.cos(a) * Math.sqrt(1 - v * v), v, Math.sin(a) * Math.sqrt(1 - v * v));
        if (n.z > 0.75 && n.y < 0.6) continue;
        const m = G.part(b, S.cone, red, n.x * 0.5, 0.5 + n.y * 0.46, n.z * 0.5, 0.13, 0.3, 0.13);
        m.quaternion.setFromUnitVectors(V(0, 1, 0), n);
      }
      eyes(b, 0.55, 0.47, 0.17, 0.065, true, false);
      G.part(b, new THREE.TorusGeometry(0.06, 0.014, 6, 12, Math.PI), G.mat(G.PAL.eye, { rough: 0.2 }), 0, 0.36, 0.52, 1, 1, 1, 0.3, 0, 0);
    }
    animate(dt) {
      this.move(dt);
      const h = Math.abs(Math.sin(this.t * 5));
      this.body.position.y = h * 0.3;
      this.body.scale.set(1 + (1 - h) * 0.08, 1 - (1 - h) * 0.1, 1 + (1 - h) * 0.08);
    }
  }

  class Soot extends Enemy {
    constructor(path, y, o) {
      super('soot', path, y, o);
      this.r = 0.55; this.cy = 0.5; this.stompable = false;
      this.bob = o?.bob ?? 0.5;
      const dark = G.charMat(0x3b3550, 0.75);
      const b = this.body;
      G.part(b, S.sphereHi, dark, 0, 0.5, 0, 0.45);
      for (let i = 0; i < 26; i++) {
        const v = -0.9 + ((i * 0.618) % 1) * 1.8;
        const a = i * 2.4;
        const n = V(Math.cos(a) * Math.sqrt(1 - v * v), v, Math.sin(a) * Math.sqrt(1 - v * v));
        if (n.z > 0.7 && Math.abs(n.y) < 0.5) continue;
        const m = G.part(b, S.coneLow, dark, n.x * 0.42, 0.5 + n.y * 0.42, n.z * 0.42, 0.1, 0.32, 0.1);
        m.quaternion.setFromUnitVectors(V(0, 1, 0), n);
      }
      eyes(b, 0.55, 0.36, 0.15, 0.08, true, true);
    }
    animate(dt) {
      this.move(dt);
      this.g.position.y += Math.sin(this.t * 2.2) * this.bob;
      this.body.rotation.z = Math.sin(this.t * 3) * 0.12;
    }
  }

  const add = (Cls) => (path, y, o) => { const e = new Cls(path, y, o); G.ent.list.enemies.push(e); return e; };
  return {
    init(sc) { scene = sc; },
    turtle: add(Turtle),
    spiky: add(Spiky),
    soot: add(Soot),
  };
})();
