'use strict';
// Sterowanie Tuptusiem: bieg, skok (z coyote time i buforem), szybowanie na uszach,
// turlanie w kulkę, wysoki skok z przykucnięcia, pływanie, obrażenia i powrót na bezpieczny grunt.
G.Player = class {
  constructor(scene) {
    this.rabbit = new G.Rabbit();
    scene.add(this.rabbit.root);
    this.R = 0.42;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.center = new THREE.Vector3();
    this.yaw = 0;
    this.grounded = false; this.groundCol = null;
    this.coyote = 0; this.jumpBuf = 0; this.noCut = false;
    this.gliding = false; this.flapT = 0; this.glideT = 0;
    this.rolling = false; this.rollAir = false; this.longJump = false;
    this.crouching = false; this.crouchT = 0;
    this.swimming = false; this.strokeT = 0;
    this.airT = 0; this.fallT = 0; this.flip = 0; this.mode = 'idle';
    this.hurtT = 0; this.hearts = 3; this.maxHearts = 3; this.respawnT = 0; this.hits = 0;
    this.safe = new THREE.Vector3(); this.safeT = 0;
    this.frozen = false;
    this.trail = []; this.trailT = 0;
    this.info = { ground: null, ceil: null, wall: null, groundN: new THREE.Vector3() };

    const sm = new THREE.MeshBasicMaterial({ color: 0x3a2a40, transparent: true, opacity: 0.3, depthWrite: false });
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.46, 28), sm);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 1;
    this.shadow.layers.set(2);
    scene.add(this.shadow);

    this.rabbit.onStep = () => {
      if (!this.grounded) return;
      G.fx.dust(this.pos, 1);
      if (this.pos.y > 0.8 && Math.random() < 0.18) G.fx.petals(this.pos, 1);
      G.sfx.play('step');
    };
    this.rabbit.onZzz = () => G.fx.zzz(new THREE.Vector3(this.pos.x, this.pos.y + 1.3, this.pos.z));
    // Każde machnięcie uszami w dół: szum skrzydeł i krótkie „podparcie” w powietrzu.
    this.rabbit.onFlap = () => {
      if (!this.gliding) return;
      G.sfx.play('flap');
      this.vel.y = Math.max(this.vel.y, 0.5);
    };
    // Smugi powietrza za koniuszkami uszu.
    this.trails = [new G.fx.EarTrail(scene), new G.fx.EarTrail(scene)];
    this._tipA = new THREE.Vector3(); this._tipB = new THREE.Vector3();
  }

  spawn(x, y, z) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.safe.copy(this.pos);
    this.trail.length = 0;
    this.grounded = false;
    this.swimming = this.gliding = this.rolling = this.rollAir = this.crouching = this.longJump = false;
  }

  bounce(v) {
    this.vel.y = v + (G.input.jumpHeld ? 3 : 0);
    this.grounded = false; this.coyote = 0; this.noCut = true;
    this.gliding = false;
    this.rabbit.squash(-0.6);
  }

  hurt(from) {
    if (this.hurtT > 0 || this.respawnT > 0) return false;
    this.hearts -= 1; this.hits += 1;
    this.hurtT = 1.6;
    const dx = this.pos.x - from.x, dz = this.pos.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    this.vel.set((dx / d) * 6, 7, (dz / d) * 6);
    this.grounded = false; this.noCut = true;
    this.rolling = this.rollAir = this.crouching = this.gliding = this.longJump = false;
    this.rabbit.setExpr('hurt', 0.7);
    G.sfx.play('hurt');
    G.emit('juice', { shake: 0.4, stop: 0.12, flash: 1 });
    G.fx.sparkle(this.center.clone(), 10, 0xffb0c0, 3);
    G.emit('hearts', { hearts: this.hearts, lost: true });
    if (this.hearts <= 0) this.respawnT = 0.7;
    return true;
  }

  // Tuptuś odwraca głowę w stronę najbliższej gwiazdki albo zagubionego przyjaciela.
  _lookAt() {
    if (this.mode === 'roll' || this.mode === 'swim') return null;
    let best = 5 * 5, target = null;
    const consider = (p) => {
      const d = (p.x - this.pos.x) ** 2 + (p.z - this.pos.z) ** 2 + (p.y - this.pos.y - 0.5) ** 2;
      if (d < best) { best = d; target = p; }
    };
    for (const s of G.ent.list.stars) if (!s.taken && s.mesh.visible && !s.auto) consider(s.mesh.position);
    for (const f of G.ent.list.friends) if (!f.found) consider(f.rabbit.root.position);
    if (!target) return null;
    let a = Math.atan2(target.x - this.pos.x, target.z - this.pos.z) - this.yaw;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    return Math.abs(a) > 1.6 ? null : G.u.clamp(a, -0.75, 0.75);
  }

  _respawn() {
    G.fx.poof(this.center.clone(), 16);
    G.sfx.play('poof');
    this.spawn(this.safe.x, this.safe.y + 0.4, this.safe.z);
    this.hearts = this.maxHearts;
    this.hurtT = 1.2;
    G.emit('hearts', { hearts: this.hearts });
    G.emit('respawn');
    G.fx.poof(new THREE.Vector3(this.pos.x, this.pos.y + 0.5, this.pos.z), 10);
    this.rabbit.setExpr('wow', 0.8);
  }

  update(dt, inp) {
    const u = G.u;
    if (this.respawnT > 0) {
      this.respawnT -= dt;
      this.rabbit.root.visible = Math.floor(this.respawnT * 20) % 2 === 0;
      if (this.respawnT <= 0) this._respawn();
      return;
    }
    let mv = this.frozen ? { x: 0, z: 0, len: 0 } : inp.move();
    // Ruch względem kamery (kamerę można obracać co 45°).
    const cy = G.camYaw || 0;
    if (cy && mv.len > 0) {
      const c = Math.cos(cy), s = Math.sin(cy);
      mv = { x: c * mv.x + s * mv.z, z: -s * mv.x + c * mv.z, len: mv.len };
    }
    const jumpPressed = !this.frozen && inp.jumpPressed;
    const jumpHeld = !this.frozen && inp.jumpHeld;
    const act = !this.frozen && inp.actHeld;
    const actPressed = !this.frozen && inp.actPressed;
    const speedH = Math.hypot(this.vel.x, this.vel.z);

    // Platforma ruchoma niesie królika.
    if (this.grounded && this.groundCol && this.groundCol.moving) this.pos.add(this.groundCol.delta);

    this.jumpBuf = jumpPressed ? 0.13 : Math.max(0, this.jumpBuf - dt);
    this.coyote = this.grounded ? 0.12 : Math.max(0, this.coyote - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);

    // Przykucnięcie i turlanie (ten sam klawisz: w biegu kulka, w miejscu kucanie).
    if (this.grounded && !this.swimming && actPressed) {
      if (speedH > 2.2 && mv.len > 0.2) {
        this.rolling = true;
        const s = Math.max(speedH, 9);
        this.vel.x = Math.sin(this.yaw) * s; this.vel.z = Math.cos(this.yaw) * s;
        G.sfx.play('roll');
        G.fx.ring(this.pos, 8);
      } else {
        this.crouching = true; this.crouchT = 0;
        G.sfx.play('crouch');
      }
    }
    if (!act) { this.rolling = false; this.crouching = false; this.rollAir = false; }
    if (this.crouching) this.crouchT += dt;
    if (this.rolling && this.grounded && speedH < 1.2) this.rolling = false;
    const charged = this.crouching && this.crouchT > 0.22;

    // Ruch poziomy.
    let maxSpd = 6.6, acc = this.grounded ? 48 : 26, dec = this.grounded ? 36 : 7;
    if (this.crouching) maxSpd = 1.0;
    if (this.gliding) { maxSpd = 7.0; acc = 20; }
    if (this.swimming) { maxSpd = 3.9; acc = 14; dec = 6; }
    if (this.longJump) { maxSpd = 10.2; acc = 9; dec = 0.6; }
    if (this.rolling) {
      const cur = Math.atan2(this.vel.x, this.vel.z);
      let spd = speedH;
      let dir = cur;
      if (mv.len > 0.1) {
        dir = u.angleDamp(cur, Math.atan2(mv.x, mv.z), 4.5, dt);
        spd = Math.min(10.5, spd + 5 * dt);
      } else spd = Math.max(0, spd - 4 * dt);
      this.vel.x = Math.sin(dir) * spd; this.vel.z = Math.cos(dir) * spd;
      if (Math.random() < dt * 14) G.fx.dust(this.pos, 1);
      if (spd > 8 && Math.random() < dt * 22) G.fx.trail(this.center);
    } else {
      const tx = mv.x * maxSpd, tz = mv.z * maxSpd;
      const dx = tx - this.vel.x, dz = tz - this.vel.z;
      const dl = Math.hypot(dx, dz);
      const rate = (mv.len > 0.05 ? acc : dec) * dt;
      if (dl <= rate || dl < 1e-6) { this.vel.x = tx; this.vel.z = tz; }
      else { this.vel.x += (dx / dl) * rate; this.vel.z += (dz / dl) * rate; }
    }
    const sp2 = Math.hypot(this.vel.x, this.vel.z);
    if (sp2 > 0.3) this.yaw = u.angleDamp(this.yaw, Math.atan2(this.vel.x, this.vel.z), this.rolling ? 30 : 14, dt);

    // Skoki.
    if (this.jumpBuf > 0) {
      if (this.swimming) {
        this.vel.y = 11; this.swimming = false; this.jumpBuf = 0; this.noCut = false;
        G.sfx.play('jump'); G.fx.splash(this.pos, false);
      } else if (this.coyote > 0) {
        if (charged) {
          this.vel.y = 15.4; this.noCut = true; this.flip = 0.001;
          G.sfx.play('highjump');
          G.fx.sparkle(new THREE.Vector3(this.pos.x, this.pos.y + 0.2, this.pos.z), 12, 0xffffff, 3);
          G.fx.ring(this.pos, 14);
          this.crouching = false;
        } else if (this.rolling) {
          this.vel.y = 9.2; this.noCut = true;
          const s = Math.max(sp2, 9.6);
          this.vel.x = Math.sin(this.yaw) * s; this.vel.z = Math.cos(this.yaw) * s;
          this.longJump = true; this.rollAir = true; this.rolling = false;
          G.sfx.play('longjump');
        } else {
          this.vel.y = 10.6; this.noCut = false;
          G.sfx.play('jump');
        }
        this.rabbit.jumpKick();
        G.fx.dust(this.pos, 3);
        this.grounded = false; this.groundCol = null; this.coyote = 0; this.jumpBuf = 0;
      } else if (!this.grounded && jumpPressed && !this.gliding && this.airT > 0.08 && this.glideT < 1.6) {
        this.gliding = true; this.longJump = false; this.rollAir = false;
        G.fx.ring(new THREE.Vector3(this.pos.x, this.pos.y + 0.9, this.pos.z), 10, 0xffffff, 2.2);
      }
    }
    // Uszy się męczą: jedno szybowanie trwa najwyżej ~1,6 s na skok.
    if (this.gliding) this.glideT += dt;
    if (this.gliding && (!jumpHeld || this.grounded || this.swimming || this.glideT >= 1.6)) this.gliding = false;

    // Grawitacja albo wyporność wody.
    if (this.swimming) {
      const target = G.WATER_Y - 0.36;
      this.vel.y += (target - this.pos.y) * 38 * dt;
      this.vel.y *= Math.exp(-6 * dt);
    } else {
      let g = this.vel.y < 0 ? 44 : 30;
      if (this.vel.y > 0 && !jumpHeld && !this.noCut) g = 72;
      this.vel.y -= g * dt;
      if (this.gliding) {
        this.vel.y = Math.max(this.vel.y, -2.4);
      }
      this.vel.y = Math.max(this.vel.y, -24);
    }

    // Kulka (także w dalekim skoku) roztrzaskuje dzbanki i skrzynki, nie zatrzymując się.
    if (this.rolling || this.rollAir) {
      this.center.set(this.pos.x, this.pos.y + this.R, this.pos.z);
      G.treasure.breakNear(this.center, this.R + 0.2);
    }

    // Całkowanie z podkrokami i kolizje.
    const prevVy = this.vel.y;
    const wasGrounded = this.grounded;
    this.grounded = false; this.groundCol = null;
    let ceilCol = null, groundN = 1;
    const maxV = Math.max(Math.abs(this.vel.x), Math.abs(this.vel.y), Math.abs(this.vel.z));
    const steps = Math.min(8, Math.max(1, Math.ceil((maxV * dt) / 0.12)));
    const info = this.info;
    for (let i = 0; i < steps; i++) {
      this.pos.addScaledVector(this.vel, dt / steps);
      this.center.set(this.pos.x, this.pos.y + this.R, this.pos.z);
      info.ground = info.ceil = info.wall = null;
      G.phys.collideSphere(this.center, this.R, this.vel, info);
      this.pos.set(this.center.x, this.center.y - this.R, this.center.z);
      if (info.ground) { this.grounded = true; this.groundCol = info.ground; groundN = info.groundN.y; }
      if (info.ceil) ceilCol = info.ceil;
    }

    // Specjalne powierzchnie.
    const gc = this.groundCol;
    if (gc && gc.tag === 'tramp') {
      G.emit('juice', { shake: 0.22 });
      this.vel.y = G.input.jumpHeld ? 19.5 : 16.5;
      this.grounded = false; this.noCut = true; this.gliding = false; this.longJump = false;
      if (gc.ref) gc.ref.bounce();
      this.rabbit.squash(-0.9);
      this.rabbit.setExpr('joy', 0.6);
    } else if (gc && gc.tag === 'cloud' && !wasGrounded && gc.ref) gc.ref.land();
    if (ceilCol && ceilCol.tag === 'qblock' && ceilCol.ref) {
      ceilCol.ref.hit();
      this.vel.y = Math.min(this.vel.y, -1);
    }
    if (ceilCol && ceilCol.tag === 'break' && ceilCol.ref) {
      ceilCol.ref.smash();
      this.vel.y = Math.min(this.vel.y, -1);
    }

    // Lądowanie.
    if (this.grounded && !wasGrounded) {
      const impact = -prevVy;
      if (impact > 4) {
        this.rabbit.squash(Math.min(1, impact / 16));
        G.fx.ring(this.pos, Math.min(16, 4 + Math.floor(impact)));
        G.sfx.play('land');
      }
      if (impact > 15) {
        G.emit('juice', { shake: Math.min(0.35, (impact - 13) * 0.05) });
        G.fx.dust(this.pos, 6);
      }
      // Skok na dzbanek albo skrzynkę: rozbija ją i lekko podbija Tuptusia.
      if (gc && gc.tag === 'break' && gc.ref && impact > 5) {
        gc.ref.smash();
        this.bounce(7.5);
      }
      this.flip = 0;
      this.gliding = false; this.longJump = false; this.noCut = false;
      if (this.rollAir) { this.rollAir = false; if (act && Math.hypot(this.vel.x, this.vel.z) > 3) this.rolling = true; }
    }
    this.airT = this.grounded ? 0 : this.airT + dt;
    if (this.grounded || this.swimming) this.glideT = 0;
    this.fallT = !this.grounded && this.vel.y < -8 && !this.gliding ? this.fallT + dt : 0;
    if (this.fallT > 0.55 && this.rabbit._shown !== 'wow') this.rabbit.setExpr('wow', 0.5);

    // Woda.
    if (!this.swimming && !this.grounded && this.pos.y < G.WATER_Y - 0.25) {
      this.swimming = true;
      this.vel.y *= 0.25;
      this.gliding = this.rolling = this.rollAir = this.longJump = this.crouching = false;
      G.fx.splash(this.pos, true);
      G.sfx.play('splash');
    }
    if (this.swimming && this.grounded) this.swimming = false;
    if (this.swimming && mv.len > 0.2) {
      this.strokeT -= dt;
      if (this.strokeT <= 0) { this.strokeT = 0.42; G.sfx.play('swim'); G.fx.ring(new THREE.Vector3(this.pos.x, 0, this.pos.z), 6, 0xf4fbff, 1.2); }
    }

    // Za światem: wracamy na ostatni bezpieczny grunt.
    if (this.pos.y < -6) { this.respawnT = 0.01; this.hearts = Math.max(1, this.hearts); }

    // Zapamiętywanie bezpiecznego miejsca.
    if (this.grounded && gc && !gc.moving && !gc.tag && groundN > 0.9) {
      this.safeT += dt;
      if (this.safeT > 0.35) { this.safe.copy(this.pos); this.safeT = 0; }
    }

    // Ślad dla przyjaciół, którzy podążają za Tuptusiem.
    this.trailT += dt;
    if (this.trailT > 0.05) {
      this.trailT = 0;
      this.trail.push({ x: this.pos.x, y: this.pos.y, z: this.pos.z, swim: this.swimming });
      if (this.trail.length > 240) this.trail.shift();
    }

    // Animacja.
    const spd = Math.hypot(this.vel.x, this.vel.z);
    let mode;
    if (this.swimming) mode = 'swim';
    else if (this.rolling || this.rollAir) mode = 'roll';
    else if (this.crouching) mode = 'crouch';
    else if (!this.grounded && this.airT > 0.06) mode = this.gliding ? 'glide' : this.vel.y > 0 ? 'jump' : 'fall';
    else mode = spd > 0.6 ? 'run' : 'idle';
    this.mode = mode;
    if (this.flip > 0) { this.flip += dt / 0.62; if (this.flip >= 1) this.flip = 0; }
    this.rabbit.root.position.copy(this.pos);
    this.rabbit.root.rotation.y = this.yaw;
    this.rabbit.update(dt, { mode, speed: spd, vy: this.vel.y, charged, flip: this.flip, look: this._lookAt() });
    this.rabbit.root.visible = this.hurtT > 0 ? Math.floor(this.hurtT * 14) % 2 === 0 : true;
    // Smugi za uszami tylko podczas szybowania (najmocniejsze przy ruchu w dół).
    if (mode === 'glide') {
      this.rabbit.root.updateMatrixWorld(true);
      for (let i = 0; i < 2; i++) {
        this.rabbit.earTip(i, this._tipA, this._tipB);
        this.trails[i].push(this._tipA, this._tipB, 0.45 + this.rabbit.glideLift * 0.55);
      }
    }
    for (const tr of this.trails) tr.update(dt);

    // Cień pod postacią: kluczowy dla oceny odległości w 3D.
    const gy = Math.max(G.phys.groundBelow(this.pos.x, this.pos.z, this.pos.y + 0.1), G.WATER_Y);
    const h = this.pos.y - gy;
    this.shadow.visible = !this.swimming && this.respawnT <= 0;
    this.shadow.position.set(this.pos.x, gy + 0.03, this.pos.z);
    this.shadow.scale.setScalar(Math.max(0.4, 1 - h * 0.07));
    this.shadow.material.opacity = 0.32 * Math.max(0.3, 1 - h * 0.05);
  }
};
