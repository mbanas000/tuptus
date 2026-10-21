'use strict';
// Efekty cząsteczkowe: pyłek spod łapek, płatki, konfetti, iskierki, plusk, serduszka i „zzz”.
G.fx = (() => {
  const dummy = new THREE.Object3D();
  const tmpC = new THREE.Color();
  let puffs, confetti, sparks, sprites;

  class Instanced {
    constructor(scene, geo, mat, max) {
      this.mesh = new THREE.InstancedMesh(geo, mat, max);
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
      this.mesh.frustumCulled = false;
      this.mesh.count = 0;
      scene.add(this.mesh);
      this.max = max;
      this.ps = [];
    }
    spawn(p) {
      if (this.ps.length >= this.max) this.ps.shift();
      p.age = 0;
      p.rot ||= new THREE.Euler(Math.random() * 6, Math.random() * 6, 0);
      p.spin ||= new THREE.Vector3();
      p.sx ??= 1; p.sy ??= 1; p.sz ??= 1;
      this.ps.push(p);
    }
    update(dt) {
      let n = 0;
      this.ps = this.ps.filter((p) => (p.age += dt) < p.life);
      for (const p of this.ps) {
        p.vel.y += p.g * dt;
        p.vel.multiplyScalar(Math.exp(-p.drag * dt));
        p.pos.addScaledVector(p.vel, dt);
        if (p.floor !== undefined && p.pos.y < p.floor) { p.pos.y = p.floor; p.vel.set(p.vel.x * 0.6, -p.vel.y * 0.25, p.vel.z * 0.6); }
        if (p.flutter) p.pos.x += Math.sin(p.age * 6 + p.flutter) * dt * 0.6;
        p.rot.x += p.spin.x * dt; p.rot.y += p.spin.y * dt; p.rot.z += p.spin.z * dt;
        const t = p.age / p.life;
        const s = p.size * (p.grow ? (t < 0.15 ? 0.4 + (t / 0.15) * 0.6 : 1 - ((t - 0.15) / 0.85) ** 2) : 1 - t ** 3);
        dummy.position.copy(p.pos);
        dummy.rotation.copy(p.rot);
        dummy.scale.set(s * p.sx, s * p.sy, s * p.sz);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(n, dummy.matrix);
        this.mesh.setColorAt(n, p.color);
        n++;
      }
      this.mesh.count = n;
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  class Sparks {
    constructor(scene, max) {
      this.max = max;
      this.geo = new THREE.BufferGeometry();
      this.pos = new Float32Array(max * 3);
      this.col = new Float32Array(max * 3);
      this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
      const mat = new THREE.PointsMaterial({
        size: 0.42, map: G.tex.sparkle(), vertexColors: true, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      });
      this.points = new THREE.Points(this.geo, mat);
      this.points.frustumCulled = false;
      scene.add(this.points);
      this.ps = [];
    }
    spawn(p) { if (this.ps.length >= this.max) this.ps.shift(); p.age = 0; this.ps.push(p); }
    update(dt) {
      this.ps = this.ps.filter((p) => (p.age += dt) < p.life);
      let n = 0;
      for (const p of this.ps) {
        p.vel.multiplyScalar(Math.exp(-3 * dt));
        p.vel.y += (p.g || 0) * dt;
        p.pos.addScaledVector(p.vel, dt);
        const t = p.age / p.life;
        const fade = p.soft ? Math.sin(t * Math.PI) * p.soft : (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8);
        const f = fade * (p.soft ? 1 : 0.7 + 0.3 * Math.sin(p.age * 30 + p.seed));
        if (p.wander) { p.pos.x += Math.sin(p.age * 1.3 + p.seed) * dt * 0.25; p.pos.z += Math.cos(p.age * 1.1 + p.seed) * dt * 0.2; }
        this.pos.set([p.pos.x, p.pos.y, p.pos.z], n * 3);
        this.col.set([p.color.r * f, p.color.g * f, p.color.b * f], n * 3);
        n++;
      }
      this.geo.setDrawRange(0, n);
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
    }
  }

  // Kilka sprite'ów z rysunkiem (serce, „z”), z płynnym zanikaniem.
  class SpritePool {
    constructor(scene) { this.scene = scene; this.items = []; this.tex = {}; }
    texture(kind) {
      if (this.tex[kind]) return this.tex[kind];
      this.tex[kind] = G.tex.canvas(64, 64, (g, w) => {
        if (kind === 'heart') {
          g.fillStyle = '#f2607a';
          g.beginPath();
          g.moveTo(32, 54);
          g.bezierCurveTo(4, 34, 8, 8, 32, 20);
          g.bezierCurveTo(56, 8, 60, 34, 32, 54);
          g.fill();
          g.fillStyle = 'rgba(255,255,255,0.6)';
          g.beginPath(); g.ellipse(21, 24, 6, 4, -0.6, 0, Math.PI * 2); g.fill();
        } else {
          g.font = '800 48px "Baloo 2", sans-serif';
          g.textAlign = 'center'; g.textBaseline = 'middle';
          g.lineWidth = 8; g.strokeStyle = '#7d8fb0'; g.strokeText('z', w / 2, w / 2 + 2);
          g.fillStyle = '#ffffff'; g.fillText('z', w / 2, w / 2 + 2);
        }
      });
      return this.tex[kind];
    }
    spawn(kind, pos, vel, life, size, o = {}) {
      const tex = o.tex || this.texture(kind);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, color: o.color ?? 0xffffff,
        blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthTest: o.depthTest ?? true,
      }));
      sp.position.copy(pos);
      sp.renderOrder = o.renderOrder ?? 0;
      sp.layers.set(2);
      this.scene.add(sp);
      const it = { sp, vel, life, age: 0, size, aspect: o.aspect || 1, mode: o.mode || 'float', peak: o.peak ?? 1 };
      this._apply(it);
      this.items.push(it);
      return it;
    }
    _apply(it) {
      const t = it.age / it.life;
      let s, a;
      if (it.mode === 'flash') { s = 0.25 + (1 - (1 - t) ** 3) * 0.75; a = (1 - t) ** 2; }
      else if (it.mode === 'bubble') {
        s = t < 0.12 ? 0.4 + (t / 0.12) * 0.7 - Math.sin((t / 0.12) * Math.PI) * 0.1 : 1.1 - Math.min(0.1, (t - 0.12) * 2);
        a = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
      } else { s = 0.6 + Math.min(1, t * 4) * 0.4; a = t > 0.6 ? 1 - (t - 0.6) / 0.4 : Math.min(1, t * 6); }
      it.sp.material.opacity = a * it.peak;
      it.sp.scale.set(it.size * s * it.aspect, it.size * s, 1);
    }
    update(dt) {
      this.items = this.items.filter((it) => {
        it.age += dt;
        if (it.age >= it.life) { this.scene.remove(it.sp); it.sp.material.dispose(); return false; }
        it.sp.position.addScaledVector(it.vel, dt);
        if (it.mode === 'float') it.sp.position.x += Math.sin(it.age * 4) * dt * 0.3;
        this._apply(it);
        return true;
      });
    }
  }

  // Dymek z tekstem (np. podziękowanie przyjaciela).
  const bubbleCache = {};
  function bubbleTex(text) {
    if (bubbleCache[text]) return bubbleCache[text];
    return (bubbleCache[text] = G.tex.canvas(512, 160, (g, w, h) => {
      g.font = '700 52px "Baloo 2", sans-serif';
      const tw = Math.min(w - 40, g.measureText(text).width + 70);
      const x0 = (w - tw) / 2, y0 = 14, bh = 104, r = 46;
      g.fillStyle = 'rgba(90,60,80,0.18)';
      g.beginPath(); g.roundRect(x0 + 4, y0 + 8, tw, bh, r); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.roundRect(x0, y0, tw, bh, r); g.fill();
      g.beginPath(); g.moveTo(w / 2 - 18, y0 + bh - 2); g.lineTo(w / 2, y0 + bh + 30); g.lineTo(w / 2 + 16, y0 + bh - 2); g.fill();
      g.fillStyle = '#e2557a';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, w / 2, y0 + bh / 2 + 3);
    }));
  }

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const R = G.u.rand;
  const col = (hex) => new THREE.Color(hex);

  // Smuga powietrza: wstęga między koniuszkiem ucha a punktem niżej, zanikająca z wiekiem próbek.
  class EarTrail {
    constructor(scene, life = 0.26, max = 14) {
      this.life = life; this.max = max; this.samples = [];
      this.geo = new THREE.BufferGeometry();
      this.pos = new Float32Array(max * 2 * 3);
      this.col = new Float32Array(max * 2 * 4);
      this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
      const idx = [];
      for (let i = 0; i < max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      this.geo.setIndex(idx);
      this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      this.mesh.frustumCulled = false;
      this.mesh.renderOrder = 3;
      this.mesh.layers.set(2);
      scene.add(this.mesh);
    }
    push(a, b, strength = 1) {
      this.samples.unshift({ a: a.clone(), b: b.clone(), age: 0, k: strength });
      if (this.samples.length > this.max) this.samples.pop();
    }
    update(dt) {
      for (const s of this.samples) s.age += dt;
      this.samples = this.samples.filter((s) => s.age < this.life);
      const n = this.samples.length;
      for (let i = 0; i < this.max; i++) {
        const s = this.samples[Math.min(i, Math.max(0, n - 1))];
        const o = i * 6, c = i * 8;
        if (!s) { this.col.fill(0, c, c + 8); continue; }
        // Wstęga zwęża się ku końcowi (punkt b zbliża się do koniuszka).
        const w = n > 1 ? 1 - i / n : 1;
        this.pos[o] = s.a.x; this.pos[o + 1] = s.a.y; this.pos[o + 2] = s.a.z;
        this.pos[o + 3] = s.a.x + (s.b.x - s.a.x) * w; this.pos[o + 4] = s.a.y + (s.b.y - s.a.y) * w; this.pos[o + 5] = s.a.z + (s.b.z - s.a.z) * w;
        const al = i < n ? (1 - s.age / this.life) * w * 0.6 * s.k : 0;
        this.col.set([1, 1, 1, al, 1, 1, 1, al * 0.15], c);
      }
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
    }
  }

  // Odłamki (skorupy dzbanków, deski skrzynek): podskakują na ziemi i znikają.
  let debris;
  class Debris extends Instanced {
    update(dt) {
      for (const p of this.ps) {
        p.ground = G.phys.groundBelow(p.pos.x, p.pos.z, p.pos.y + 0.3);
        if (p.ground < G.WATER_Y) continue; // nad wodą: odłamek po prostu wpada i tonie
        if (p.pos.y + p.vel.y * dt < p.ground + p.half && p.vel.y < 0) {
          p.vel.y = p.vel.y < -1.2 ? -p.vel.y * 0.35 : 0;
          p.vel.x *= 0.6; p.vel.z *= 0.6;
          p.spin.multiplyScalar(0.5);
          p.pos.y = p.ground + p.half;
          if (p.vel.y === 0) p.g = 0;
        }
      }
      super.update(dt);
    }
  }

  // Półprzezroczyste obłoczki kurzu: miękkie, nieregularne chmurki zawsze zwrócone do kamery.
  // Rosną i rzedną z czasem; kolor biorą od pory dnia (cząsteczki nie są oświetlane).
  let soft;
  function dustTexture() {
    return G.tex.canvas(128, 128, (g) => {
      const blob = (x, y, r, a) => {
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(255,255,255,${a})`);
        gr.addColorStop(0.5, `rgba(255,255,255,${a * 0.7})`);
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      };
      blob(64, 64, 46, 0.75);
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2, d = 6 + Math.random() * 24;
        blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 14 + Math.random() * 16, 0.4 + Math.random() * 0.35);
      }
    });
  }
  class SoftDust {
    constructor(scene, max) {
      this.max = max;
      this.ps = [];
      const geo = new THREE.PlaneGeometry(1, 1);
      this.aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
      this.aRot = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
      this.aAlpha.setUsage(THREE.DynamicDrawUsage);
      this.aRot.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aAlpha', this.aAlpha);
      geo.setAttribute('aRot', this.aRot);
      const mat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, uTint: { value: new THREE.Color(1, 1, 1) } }]),
        vertexShader: `
          #include <fog_pars_vertex>
          attribute float aAlpha;
          attribute float aRot;
          varying vec2 vUv;
          varying float vAlpha;
          varying vec3 vCol;
          void main() {
            vUv = uv;
            vAlpha = aAlpha;
            #ifdef USE_INSTANCING_COLOR
              vCol = instanceColor;
            #else
              vCol = vec3(1.0);
            #endif
            vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            float s = length(instanceMatrix[0].xyz);
            // Lekko przysuwamy obłoczek do kamery, żeby ziemia nie ucinała go ostrą krawędzią.
            c.xyz += normalize(-c.xyz) * s * 0.45;
            float cr = cos(aRot), sr = sin(aRot);
            vec2 q = vec2(position.x * cr - position.y * sr, position.x * sr + position.y * cr) * s;
            vec4 mvPosition = c + vec4(q, 0.0, 0.0);
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: `
          #include <fog_pars_fragment>
          uniform sampler2D map;
          uniform vec3 uTint;
          varying vec2 vUv;
          varying float vAlpha;
          varying vec3 vCol;
          void main() {
            vec4 t = texture2D(map, vUv);
            float a = t.a * vAlpha;
            if (a < 0.003) discard;
            gl_FragColor = vec4(vCol * uTint, a);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            #include <fog_fragment>
          }`,
        transparent: true, depthWrite: false, fog: true,
      });
      mat.uniforms.map.value = dustTexture();
      this.mesh = new THREE.InstancedMesh(geo, mat, max);
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
      this.mesh.frustumCulled = false;
      this.mesh.count = 0;
      this.mesh.renderOrder = 2;
      this.mesh.layers.set(2);
      scene.add(this.mesh);
      this.dummy = new THREE.Object3D();
    }
    spawn(p) {
      if (this.ps.length >= this.max) this.ps.shift();
      p.age = 0; p.rot = Math.random() * Math.PI * 2; p.spin = R(-1.2, 1.2);
      this.ps.push(p);
    }
    update(dt) {
      this.lastUpdate = performance.now();
      this.ps = this.ps.filter((p) => (p.age += dt) < p.life);
      let n = 0;
      for (const p of this.ps) {
        p.vel.multiplyScalar(Math.exp(-p.drag * dt));
        p.vel.y += p.g * dt;
        p.pos.addScaledVector(p.vel, dt);
        const t = p.age / p.life;
        const size = p.size * (0.55 + 0.9 * (1 - (1 - t) ** 2));
        const alpha = p.alpha * (t < 0.12 ? t / 0.12 : Math.pow(1 - (t - 0.12) / 0.88, 1.6));
        this.dummy.position.copy(p.pos);
        this.dummy.scale.setScalar(size);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(n, this.dummy.matrix);
        this.mesh.setColorAt(n, p.color);
        this.aAlpha.array[n] = alpha;
        this.aRot.array[n] = p.rot + p.spin * p.age;
        n++;
      }
      this.mesh.count = n;
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.instanceColor.needsUpdate = true;
      this.aAlpha.needsUpdate = true;
      this.aRot.needsUpdate = true;
      if (G.daytime && G.daytime.dust) this.mesh.material.uniforms.uTint.value.copy(G.daytime.dust);
    }
  }

  return {
    EarTrail,
    init(scene) {
      puffs = new Instanced(scene, G.GEO.sphereLow, new THREE.MeshStandardMaterial({ roughness: 1, color: 0xffffff }), 500);
      puffs.mesh.castShadow = false;
      confetti = new Instanced(scene, new THREE.BoxGeometry(1, 0.22, 0.7), new THREE.MeshStandardMaterial({ roughness: 0.7, color: 0xffffff, side: THREE.DoubleSide }), 400);
      sparks = new Sparks(scene, 500);
      sprites = new SpritePool(scene);
      debris = new Debris(scene, new ADDONS.RoundedBoxGeometry(1, 1, 1, 2, 0.18), new THREE.MeshStandardMaterial({ roughness: 0.8, color: 0xffffff }), 160);
      debris.mesh.castShadow = true;
      soft = new SoftDust(scene, 360);
      // Cząsteczki na warstwie 2: widać je normalnie, ale nie odbijają się w wodzie.
      for (const o of [puffs.mesh, confetti.mesh, sparks.points]) o.layers.set(2);
    },
    update(dt) {
      puffs.update(dt); confetti.update(dt); sparks.update(dt); sprites.update(dt); debris.update(dt); soft.update(dt);
    },
    // Rozprysk odłamków: kind 'pot' (skorupy) albo 'crate' (deski).
    debris(p, kind, colors) {
      const n = kind === 'crate' ? 9 : 11;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = R(1.2, 3.2);
        const size = kind === 'crate' ? R(0.16, 0.24) : R(0.12, 0.2);
        const shape = kind === 'crate' ? [R(1.6, 2.4), 0.3, 0.55] : [1, R(0.3, 0.45), R(0.7, 1)];
        debris.spawn({ pos: p.clone().add(V(R(-0.25, 0.25), R(0, 0.5), R(-0.25, 0.25))), vel: V(Math.cos(a) * s, R(3, 6.5), Math.sin(a) * s),
          g: -18, drag: 0.4, life: R(1.4, 2.0), size, spin: V(R(-10, 10), R(-10, 10), R(-10, 10)),
          sx: shape[0], sy: shape[1], sz: shape[2], half: size * shape[1] * 0.5, color: col(G.u.pick(colors)) });
      }
    },
    // Kurz spod łapek: półprzezroczyste obłoczki, które rosną i rzedną.
    dust(p, n = 2, color = 0xf5ead8) {
      for (let i = 0; i < n; i++) {
        soft.spawn({ pos: V(p.x + R(-0.2, 0.2), p.y + 0.16, p.z + R(-0.2, 0.2)), vel: V(R(-0.6, 0.6), R(0.25, 0.7), R(-0.6, 0.6)),
          g: 0.15, drag: 2.6, life: R(0.6, 0.95), size: R(0.34, 0.52), alpha: R(0.5, 0.68), color: col(color).offsetHSL(0, 0, R(-0.04, 0.02)) });
      }
    },
    // Pierścień kurzu przy lądowaniu (na wodzie – mgiełka bryzgów).
    ring(p, n = 12, color = 0xf5ead8, speed = 2.4) {
      const m = Math.max(5, Math.round(n * 0.7));
      for (let i = 0; i < m; i++) {
        const a = (i / m) * Math.PI * 2 + R(-0.2, 0.2);
        const s = speed * R(0.7, 1.1);
        soft.spawn({ pos: V(p.x + Math.cos(a) * 0.25, p.y + 0.14, p.z + Math.sin(a) * 0.25), vel: V(Math.cos(a) * s, R(0.15, 0.5), Math.sin(a) * s),
          g: 0.1, drag: 3.6, life: R(0.55, 0.85), size: R(0.36, 0.56), alpha: R(0.45, 0.62), color: col(color) });
      }
    },
    poof(p, n = 14, color = 0xffffff) {
      for (let i = 0; i < n; i++) {
        const d = V(R(-1, 1), R(-0.3, 1), R(-1, 1)).normalize();
        puffs.spawn({ pos: p.clone().addScaledVector(d, 0.2), vel: d.multiplyScalar(R(1.5, 3)), g: 0.5, drag: 4,
          life: R(0.5, 0.8), size: R(0.2, 0.36), grow: true, color: col(color).offsetHSL(0, 0, R(-0.04, 0)) });
      }
    },
    splash(p, big = true) {
      const n = big ? 18 : 6;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = R(0.6, 2.2);
        puffs.spawn({ pos: V(p.x, 0.05, p.z), vel: V(Math.cos(a) * s, R(2.5, big ? 6 : 3), Math.sin(a) * s), g: -16, drag: 0.5,
          life: R(0.5, 0.8), size: R(0.07, 0.13), color: col(i % 3 ? 0xd8f3ff : 0xffffff) });
      }
      if (big) this.ring(V(p.x, 0, p.z), 14, 0xf4fbff, 2.8);
    },
    petals(p, n = 3) {
      const cs = [0xfffcf4, 0xf796b4, 0xffd0de, 0xfffcf4];
      for (let i = 0; i < n; i++) {
        confetti.spawn({ pos: V(p.x + R(-0.3, 0.3), p.y + R(0.1, 0.3), p.z + R(-0.3, 0.3)), vel: V(R(-0.8, 0.8), R(1.2, 2.2), R(-0.8, 0.8)),
          g: -2.2, drag: 2.2, life: R(0.9, 1.4), size: R(0.07, 0.1), spin: V(R(-6, 6), R(-6, 6), R(-6, 6)), flutter: R(0, 6),
          sx: 1, sy: 0.25, sz: 0.8, color: col(G.u.pick(cs)) });
      }
    },
    confetti(p, n = 30) {
      const cs = [0xffcd2e, 0xf796b4, 0x72b9f2, 0x86cf4f, 0xb48cf0, 0xffffff, 0xff9a5a];
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = R(1, 3.2);
        confetti.spawn({ pos: p.clone(), vel: V(Math.cos(a) * s, R(3.5, 7), Math.sin(a) * s), g: -9, drag: 1.6,
          life: R(1.1, 1.7), size: R(0.09, 0.14), spin: V(R(-12, 12), R(-12, 12), R(-12, 12)), flutter: R(0, 6), color: col(G.u.pick(cs)) });
      }
    },
    sparkle(p, n = 10, color = 0xfff2a8, speed = 2.5) {
      for (let i = 0; i < n; i++) {
        const d = V(R(-1, 1), R(-0.5, 1), R(-1, 1)).normalize();
        sparks.spawn({ pos: p.clone(), vel: d.multiplyScalar(R(0.5, 1) * speed), life: R(0.4, 0.8), color: col(color), seed: Math.random() * 10 });
      }
    },
    twinkle(p, color = 0xfff2a8) {
      sparks.spawn({ pos: p.clone(), vel: V(R(-0.2, 0.2), R(0.2, 0.6), R(-0.2, 0.2)), life: R(0.5, 0.9), color: col(color), seed: Math.random() * 10 });
    },
    hearts(p, n = 5) {
      for (let i = 0; i < n; i++) {
        setTimeout(() => sprites.spawn('heart', V(p.x + R(-0.4, 0.4), p.y + R(0, 0.3), p.z + R(-0.2, 0.2)), V(R(-0.3, 0.3), R(1.0, 1.6), 0), 1.4, R(0.35, 0.5)), i * 110);
      }
    },
    zzz(p) { sprites.spawn('z', V(p.x + 0.2, p.y, p.z), V(0.25, 0.55, 0), 2.2, 0.32); },
    // Mgiełka u podstawy wodospadu.
    mist(p) {
      // Bez mgiełki podczas pauzy (nie rozpływałaby się) i z zapasem miejsca na kurz spod łapek.
      if (performance.now() - soft.lastUpdate > 250 || soft.ps.length > soft.max - 80) return;
      soft.spawn({ pos: p.clone(), vel: V(R(-0.8, 0.8), R(0.6, 1.4), R(0, 1.0)), g: 0.2, drag: 1.2,
        life: R(1.3, 2.0), size: R(0.8, 1.5), alpha: R(0.28, 0.4), color: col(0xffffff) });
    },
    // Krótki rozbłysk światła (zbieranie gwiazdki, trafienie w blok).
    flash(p, color = 0xfff0a0, size = 2.2, life = 0.32) {
      sprites.spawn('glow', p.clone(), V(0, 0, 0), life, size, { tex: G.tex.glow(), additive: true, color, mode: 'flash', peak: 0.9 });
    },
    bubble(p, text, life = 2.6) {
      sprites.spawn('bubble', p.clone(), V(0, 0.25, 0), life, 0.62, { tex: bubbleTex(text), aspect: 3.2, mode: 'bubble', renderOrder: 5 });
    },
    // Unoszący się złoty pyłek w świetle złotej godziny.
    mote(p, color = null, glow = 0) {
      sparks.spawn({ pos: p.clone(), vel: V(R(-0.15, 0.15), R(0.05, 0.25), R(-0.1, 0.1)), life: R(2.5, 4.5),
        color: col(color ?? G.u.pick([0xffe7a8, 0xfff4d6, 0xffd9a0])),
        seed: Math.random() * 10, soft: glow || R(0.35, 0.7), wander: true });
    },
    // Płatek powoli opadający z drzewa.
    drift(p) {
      const c = G.u.pick([0xffffff, 0xffd0de, 0xf796b4, 0xfff6c8]);
      confetti.spawn({ pos: p.clone(), vel: V(R(0.2, 0.6), R(-0.2, 0), R(-0.2, 0.2)), g: -0.5, drag: 1.2, life: R(3.5, 5), size: R(0.07, 0.1),
        spin: V(R(-3, 3), R(-3, 3), R(-3, 3)), flutter: R(0, 6), sx: 1, sy: 0.25, sz: 0.8, color: col(c), floor: 0.02 });
    },
    // Smuga iskierek za kulką.
    trail(p, color = 0xffffff) {
      sparks.spawn({ pos: p.clone().add(V(R(-0.2, 0.2), R(0, 0.4), R(-0.2, 0.2))), vel: V(0, R(0.2, 0.6), 0), life: R(0.3, 0.5), color: col(color), seed: Math.random() * 10 });
    },
  };
})();
