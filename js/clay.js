'use strict';
// Paleta, materiały „plasteliny”, wspólne geometrie i Batcher scalający statyczne dekoracje.

G.PAL = {
  bunny: 0xfdf0dc, bunnyGray: 0xb98a62, bunnyPink: 0xf5b3c1, eye: 0x1c1a22,
  bunnyFluff: 0xfff8ee, bunnyNose: 0xf0899f, bunnyPad: 0xf3a5b5, bunnyIris: 0xa8682f,
  grass: 0x86cf4f, grassLight: 0xa6df6a, grassDark: 0x5cae43,
  leaf: 0x46a957, leafLight: 0x67c26a, leafDark: 0x2f8a48, canopy: 0x4fb35a, canopyLight: 0x75cd6e,
  dirt: 0xcd8a5c, dirtLight: 0xe0a57a, dirtDark: 0xab6b45, soil: 0x9a5f3d, soilDark: 0x7d4a2e,
  wood: 0xcf9258, woodDark: 0xa3683a, woodLight: 0xe2ad72,
  stone: 0x9a96a6, stoneDark: 0x7e7a8c, stoneLight: 0xb6b3c1,
  star: 0xffcd2e, carrot: 0xf58a24, carrotDark: 0xd96e14,
  flowerWhite: 0xfffcf4, flowerPink: 0xf796b4, flowerBlue: 0x72b9f2, flowerPurple: 0xb48cf0, flowerYellow: 0xffd84a,
  cloud: 0xffffff, water: 0x5cc8ec, foam: 0xf4fbff, hill: 0x7cc46a, hillFar: 0x9fcf98,
};

// ---------- Wspólne geometrie (jednostkowe, skalowane przy użyciu) ----------
G.GEO = {
  sphereHi: new THREE.SphereGeometry(1, 40, 30),
  sphereMid: new THREE.SphereGeometry(1, 22, 16),
  sphereLow: new THREE.SphereGeometry(1, 12, 9),
  sphereTiny: new THREE.SphereGeometry(1, 8, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 28, 1),
  cylLow: new THREE.CylinderGeometry(1, 1, 1, 12, 1),
  cone: new THREE.ConeGeometry(1, 1, 18, 1),
  coneLow: new THREE.ConeGeometry(1, 1, 8, 1),
};

// ---------- Materiały ----------
const _matCache = new Map();
G.mat = (color, o = {}) => {
  const key = `${color}|${o.rough ?? ''}|${o.emissive ?? ''}|${o.ei ?? ''}|${o.map ? o.map.uuid : ''}|${o.transparent ? 1 : 0}`;
  if (!_matCache.has(key)) {
    _matCache.set(key, new THREE.MeshStandardMaterial({
      color, roughness: o.rough ?? 0.82, metalness: 0,
      emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1,
      map: o.map || null, transparent: !!o.transparent,
    }));
  }
  return _matCache.get(key);
};
// Materiał postaci: lekki „meszek” (sheen) daje miękki, aksamitny wygląd plasteliny.
G.charMat = (color, rough = 0.7) => {
  const key = `char|${color}|${rough}`;
  if (!_matCache.has(key)) {
    _matCache.set(key, new THREE.MeshPhysicalMaterial({
      color, roughness: rough, metalness: 0, sheen: 0.55, sheenRoughness: 0.5, sheenColor: 0xffffff,
    }));
  }
  return _matCache.get(key);
};
// Futerko: mocny „meszek” (sheen) na krawędziach + drobny szum normalnych i jasności,
// dzięki czemu powierzchnia wygląda puszyście, a nie jak gładki plastik.
G.furMat = (color, rough = 0.8, vc = false) => {
  const key = `fur|${color}|${rough}|${vc ? 1 : 0}`;
  if (!_matCache.has(key)) {
    const c = new THREE.Color(color);
    const m = new THREE.MeshPhysicalMaterial({
      color, roughness: rough, metalness: 0, sheen: 1.0, sheenRoughness: 0.42, vertexColors: vc,
      sheenColor: vc ? new THREE.Color(0xfff6ea) : c.clone().lerp(new THREE.Color(0xffffff), 0.6),
    });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFurP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFurP = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vFurP;
          float furH(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
          float furN(vec3 p) {
            vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(furH(i), furH(i + vec3(1.0, 0.0, 0.0)), f.x), mix(furH(i + vec3(0.0, 1.0, 0.0)), furH(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                       mix(mix(furH(i + vec3(0.0, 0.0, 1.0)), furH(i + vec3(1.0, 0.0, 1.0)), f.x), mix(furH(i + vec3(0.0, 1.0, 1.0)), furH(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
          }`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          { vec3 q = vFurP * 26.0;
            vec3 nn = vec3(furN(q), furN(q + 11.3), furN(q + 23.7)) - 0.5;
            normal = normalize(normal + nn * 0.16); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.rgb *= 0.95 + 0.1 * furN(vFurP * 9.0);`);
    };
    m.customProgramCacheKey = () => 'fur';
    _matCache.set(key, m);
  }
  return _matCache.get(key);
};

// Wspólny zegar dla animacji w shaderach (wiatr, piana).
G.timeU = { value: 0 };

// Materiał z animacją wierzchołków: dopisuje kod GLSL na końcu <begin_vertex>.
function animatedMat(params, name, glsl, attrs = '') {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = G.timeU;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\n${attrs}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${glsl}`);
  };
  m.customProgramCacheKey = () => name;
  return m;
}

G.kindMat = (kind) => {
  const key = `kind|${kind}`;
  if (!_matCache.has(key)) {
    let m;
    if (kind === 'deco') {
      // Kwiatki i trawa kołyszą się na wietrze (siła zależy od wysokości nad ziemią).
      m = animatedMat({ vertexColors: true, roughness: 0.8, metalness: 0, side: THREE.DoubleSide }, 'wind', `
        float ph = uTime * 1.9 + position.x * 0.45 + position.z * 0.3;
        float w = sin(ph) * 0.7 + sin(ph * 2.3 + 1.7) * 0.3;
        transformed.x += w * 0.07 * sway;
        transformed.z += cos(ph * 0.8) * 0.03 * sway;`, 'attribute float sway;');
    } else if (kind === 'leaf') {
      // Liście na krzakach i drzewach: dwustronne, lekko drżą.
      m = animatedMat({ vertexColors: true, roughness: 0.75, metalness: 0, side: THREE.DoubleSide }, 'leaf', `
        float lp = uTime * 2.6 + position.x * 1.9 + position.z * 1.4 + position.y * 1.1;
        transformed += vec3(sin(lp), sin(lp * 1.3) * 0.5, cos(lp * 0.9)) * 0.018;`);
    } else if (kind === 'foam') {
      m = animatedMat({ vertexColors: true, roughness: 1, metalness: 0, emissive: 0x3c4c54 }, 'foam', `
        transformed.y += sin(uTime * 2.2 + position.x * 1.7 + position.z * 1.3) * 0.035;`);
    } else if (kind === 'soft') m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, emissive: 0x2a2a30 });
    else if (kind === 'glossy') m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0 });
    else if (kind === 'basic') m = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
    else {
      // Glina; to, co pod wodą, nabiera niebieskiego odcienia (jak zanurzone skały na referencji).
      m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
          .replace('#include <color_fragment>', `#include <color_fragment>
            // Trawnik: łagodne plamy jaśniejszej, „słonecznej” i ciemniejszej zieleni.
            float isGrass = step(diffuseColor.r * 1.15, diffuseColor.g) * step(diffuseColor.b * 1.4, diffuseColor.g);
            float nz = sin(vWP.x * 0.9 + sin(vWP.z * 0.7) * 1.5) * sin(vWP.z * 1.1 + sin(vWP.x * 0.5) * 1.3);
            float nz2 = sin(vWP.x * 3.1 + vWP.z * 2.3) * sin(vWP.z * 2.9 - vWP.x * 1.7);
            diffuseColor.rgb *= 1.0 + isGrass * (nz * 0.1 + nz2 * 0.04);
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.07, 0.74), isGrass * smoothstep(0.3, 0.95, nz) * 0.7);
            // Pod wodą: niebieski odcień jak zanurzone skały na referencji.
            float uw = clamp((0.04 - vWP.y) * 0.55 + 0.3, 0.0, 0.88) * step(vWP.y, 0.04);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.28, 0.5), uw);`);
      };
      m.customProgramCacheKey = () => 'clay-uw2';
    }
    _matCache.set(key, m);
  }
  return _matCache.get(key);
};

// Pojedyncza część dynamicznego obiektu (postacie, wrogowie, gwiazdki).
G.part = (parent, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
};

// ---------- Tekstury generowane w canvasie ----------
G.tex = {
  _c: {},
  canvas(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  },
  glow() {
    return (this._c.glow ||= this.canvas(128, 128, (g, w) => {
      const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    }));
  },
  sparkle() {
    return (this._c.sparkle ||= this.canvas(64, 64, (g, w) => {
      g.translate(w / 2, w / 2);
      g.fillStyle = '#fff';
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? w * 0.48 : w * 0.1;
        const a = (i / 8) * Math.PI * 2;
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath(); g.fill();
    }));
  },
};

// ---------- Batcher: scala statyczne bryły w kilka dużych siatek (kolory w wierzchołkach) ----------
G.Batcher = class {
  constructor(chunk = 34) {
    this.chunk = chunk;
    this.buckets = new Map();
    this.stack = [new THREE.Matrix4()];
    this.jitter = 0.03;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }
  top() { return this.stack[this.stack.length - 1]; }
  push(x = 0, y = 0, z = 0, ry = 0, s = 1, rx = 0) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')),
      new THREE.Vector3(s, s, s));
    this.stack.push(this.top().clone().multiply(m));
    return this;
  }
  pop() { if (this.stack.length > 1) this.stack.pop(); return this; }

  add(geo, color, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, o = {}) {
    if (o.quat) this._q.copy(o.quat);
    else { this._e.set(rx, ry, rz, o.order || 'XYZ'); this._q.setFromEuler(this._e); }
    this._addQ(geo, color, x, y, z, sx, sy, sz, o);
  }
  _addQ(geo, color, x, y, z, sx, sy, sz, o) {
    this._m.compose(this._p.set(x, y, z), this._q, this._s.set(sx, sy, sz));
    const m = this.top().clone().multiply(this._m);
    const kind = o.kind || 'clay';
    const key = `${kind}|${Math.floor(m.elements[12] / this.chunk)}`;
    const c = new THREE.Color(color);
    if (!o.exact && this.jitter) c.offsetHSL(0, 0, (Math.random() - 0.5) * this.jitter);
    if (!this.buckets.has(key)) this.buckets.set(key, []);
    // baseY = wysokość „korzenia” rekwizytu (pierwszy poziom stosu), od niej liczymy siłę wiatru.
    const baseY = (this.stack[1] || this.top()).elements[13];
    this.buckets.get(key).push({ geo, c, m, owned: !!o.owned, baseY });
  }
  sphere(color, x, y, z, sx, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0, o = {}) {
    const geo = { hi: G.GEO.sphereHi, low: G.GEO.sphereLow, tiny: G.GEO.sphereTiny }[o.detail] || G.GEO.sphereMid;
    this.add(geo, color, x, y, z, sx, sy, sz, rx, ry, rz, o);
  }
  box(color, x, y, z, w, h, d, r = 0.12, rx = 0, ry = 0, rz = 0, o = {}) {
    const rr = Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
    const geo = new ADDONS.RoundedBoxGeometry(w, h, d, o.seg || 3, rr);
    this.add(geo, color, x, y, z, 1, 1, 1, rx, ry, rz, { ...o, owned: true });
  }
  cyl(color, x, y, z, r, h, rx = 0, ry = 0, rz = 0, o = {}) {
    this.add(o.low ? G.GEO.cylLow : G.GEO.cyl, color, x, y, z, r, h, o.rz2 ?? r, rx, ry, rz, o);
  }
  taper(color, x, y, z, rTop, rBot, h, rx = 0, ry = 0, rz = 0, o = {}) {
    const geo = new THREE.CylinderGeometry(rTop, rBot, h, o.seg || 16, 1);
    this.add(geo, color, x, y, z, 1, 1, 1, rx, ry, rz, { ...o, owned: true });
  }
  cone(color, x, y, z, r, h, rx = 0, ry = 0, rz = 0, o = {}) {
    this.add(o.low ? G.GEO.coneLow : G.GEO.cone, color, x, y, z, r, h, r, rx, ry, rz, o);
  }
  torus(color, x, y, z, R, tube, rx = 0, ry = 0, rz = 0, o = {}) {
    const geo = new THREE.TorusGeometry(R, tube, 10, 28, o.arc || Math.PI * 2);
    this.add(geo, color, x, y, z, 1, 1, 1, rx, ry, rz, { ...o, owned: true });
  }

  build(parent) {
    const group = new THREE.Group();
    for (const [key, items] of this.buckets) {
      const kind = key.split('|')[0];
      const geos = items.map((it) => {
        const g = it.geo.clone();
        // Atrybut 'color' w geometrze rośliny to mnożnik (np. ciemniejsza nasada, jaśniejszy czubek).
        const tint = g.attributes.color;
        for (const name of Object.keys(g.attributes)) {
          if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
        }
        if (!g.index) {
          const n = g.attributes.position.count;
          const idx = new Uint32Array(n);
          for (let i = 0; i < n; i++) idx[i] = i;
          g.setIndex(new THREE.BufferAttribute(idx, 1));
        }
        g.applyMatrix4(it.m);
        const n = g.attributes.position.count;
        const col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          const k = tint ? tint.getX(i) : 1;
          const kg = tint ? tint.getY(i) : 1;
          col[i * 3] = it.c.r * k; col[i * 3 + 1] = it.c.g * kg; col[i * 3 + 2] = it.c.b * (tint ? tint.getZ(i) : 1);
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        if (kind === 'deco') {
          const pos = g.attributes.position;
          const sway = new Float32Array(n);
          for (let i = 0; i < n; i++) sway[i] = Math.min(1, Math.max(0, (pos.getY(i) - it.baseY) * 3.2));
          g.setAttribute('sway', new THREE.BufferAttribute(sway, 1));
        }
        if (it.owned) it.geo.dispose();
        return g;
      });
      const merged = ADDONS.mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, G.kindMat(kind));
      // Drobne dekoracje (kwiatki, trawka) nie rzucają cieni: to oszczędza sporo rysowania.
      mesh.castShadow = kind !== 'basic' && kind !== 'deco' && kind !== 'foam';
      mesh.receiveShadow = kind !== 'basic';
      // Drobnica (warstwa 2) nie trafia do odbicia w wodzie: oszczędzamy rysowanie.
      if (kind === 'deco' || kind === 'foam') mesh.layers.set(2);
      group.add(mesh);
    }
    this.buckets.clear();
    if (parent) parent.add(group);
    return group;
  }
};
