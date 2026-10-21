'use strict';
// Woda: lustrzane odbicia (Reflector) zaburzane falami, kolor płycizny i głębi, błysk słońca,
// migoczące iskierki oraz biała linia piany przy brzegach liczona z mapy odległości od lądu.
// Do tego wodospady z mgiełką.
G.water = (() => {
  const SDF = { x0: -16, z0: -50, sx: 148, sz: 66, res: 5 };
  let water, floor, U, renderer, scene;
  const falls = [];
  let quality = 0;
  const reflScale = [0.5, 0.33];

  const WaterShader = {
    name: 'TuptusWater',
    uniforms: {
      color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
      uTime: { value: 0 }, uReflect: { value: 1 },
      uSdf: { value: null }, uSdfBox: { value: new THREE.Vector4(SDF.x0, SDF.z0, 1 / SDF.sx, 1 / SDF.sz) },
      uDeep: { value: new THREE.Color(0x1648a2) }, uMid: { value: new THREE.Color(0x277ccd) }, uShallow: { value: new THREE.Color(0x4fcde2) },
      uSkyTop: { value: new THREE.Color(0x78acdd) }, uSkyHorizon: { value: new THREE.Color(0xffd9b0) },
      uSunDir: { value: new THREE.Vector3(-0.35, 0.2, -1).normalize() }, uSunCol: { value: new THREE.Color(0xfff1d2) },
      uFogColor: { value: new THREE.Color(0xf2d4b8) }, uFogNear: { value: 48 }, uFogFar: { value: 175 },
    },
    vertexShader: `
      uniform mat4 textureMatrix;
      varying vec4 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = textureMatrix * vec4(position, 1.0);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform sampler2D uSdf;
      uniform vec4 uSdfBox;
      uniform float uTime, uReflect, uFogNear, uFogFar;
      uniform vec3 uDeep, uMid, uShallow, uSkyTop, uSkyHorizon, uSunDir, uSunCol, uFogColor;
      varying vec4 vUv;
      varying vec3 vWorld;

      float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      // Pole wysokości drobnych fal (trzy warstwy płynące w różnych kierunkach).
      float height(vec2 p) {
        float t = uTime;
        return noise(p * 0.8 + vec2(t * 0.25, t * 0.18)) * 0.55
             + noise(p * 1.9 - vec2(t * 0.22, -t * 0.4)) * 0.3
             + noise(p * 4.2 + vec2(-t * 0.5, t * 0.35)) * 0.15;
      }
      float shore(vec2 p) {
        vec2 uv = (p - uSdfBox.xy) * uSdfBox.zw;
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 4.0;
        return texture2D(uSdf, uv).r * 4.0;
      }
      // Migoczące gwiazdki światła na falach.
      float sparkle(vec2 p, float t) {
        vec2 cell = floor(p);
        vec2 f = fract(p);
        float h = hash(cell);
        vec2 c = vec2(hash(cell + 3.1), hash(cell + 7.7)) * 0.7 + 0.15;
        float d = length(f - c);
        float tw = pow(max(0.0, sin(t * (1.2 + h * 2.5) + h * 50.0)), 16.0);
        return smoothstep(0.09, 0.0, d) * tw * step(0.5, h);
      }

      void main() {
        vec2 p = vWorld.xz;
        float e = 0.07;
        float h0 = height(p);
        float hx = height(p + vec2(e, 0.0));
        float hz = height(p + vec2(0.0, e));
        vec3 n = normalize(vec3((h0 - hx) / e * 0.18, 1.0, (h0 - hz) / e * 0.18));
        vec3 toCam = cameraPosition - vWorld;
        float dist = length(toCam);
        vec3 V = toCam / dist;
        float sd = shore(p);
        float wob = (noise(p * 2.5 + uTime * 0.3) - 0.5) * 0.08;

        // Kolor: jasna płycizna przy brzegu, głęboki błękit dalej.
        float shallow = 1.0 - smoothstep(0.0, 2.8, sd + wob);
        vec3 base = mix(uDeep, uMid, 0.3 + 0.4 * h0);
        base = mix(base, uShallow, shallow * 0.75);

        // Odbicie świata i nieba, zaburzone falami. Tam, gdzie tekstura jest pusta, liczymy niebo.
        vec3 R = reflect(-V, n);
        vec3 skyCol = mix(uSkyHorizon, uSkyTop, smoothstep(0.0, 0.6, R.y));
        vec4 ruv = vUv;
        ruv.xy += n.xz * 0.075 * ruv.w;
        vec4 rt = texture2DProj(tDiffuse, ruv);
        vec3 refl = mix(skyCol, rt.rgb, rt.a * uReflect);
        // Woda „pochłania” ciepłe barwy: odbicie przyciemnione i podbarwione na niebiesko.
        refl *= vec3(0.56, 0.8, 1.05);
        float ndv = max(dot(n, V), 0.0);
        float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
        vec3 col = mix(base, refl, clamp(fres * 1.35 + 0.08, 0.0, 0.82));

        // Ścieżka blasku słońca i iskierki.
        float sunAmt = max(dot(R, uSunDir), 0.0);
        col += uSunCol * (pow(sunAmt, 400.0) * 5.0 + pow(sunAmt, 24.0) * 0.14);
        float sp = sparkle(p * 1.3, uTime) + sparkle(p * 2.1 + 17.0, uTime * 1.3) * 0.7;
        col += uSunCol * sp * (2.4 + 3.0 * pow(sunAmt, 3.0)) * (1.0 - smoothstep(30.0, 70.0, dist));

        // Biała linia piany przy brzegu i druga, przerywana, która „oddycha”.
        float s2 = sd + wob;
        float line1 = 1.0 - smoothstep(0.07, 0.13, s2);
        float l2pos = 0.36 + 0.08 * sin(uTime * 1.4 + p.x * 0.6 + p.y * 0.4);
        float line2 = (1.0 - smoothstep(0.025, 0.055, abs(s2 - l2pos))) * step(0.42, noise(p * 1.7 + uTime * 0.15));
        float foam = max(line1, line2 * 0.85) * step(sd, 3.9);
        col = mix(col, vec3(1.0), foam * 0.95);

        // Przezroczystość: w płyciźnie widać zanurzone skały i ściany wysp.
        float alpha = mix(0.6, 0.93, smoothstep(0.0, 2.2, sd));
        alpha = max(alpha, max(foam, clamp(fres * 1.6, 0.0, 1.0)));

        float f = smoothstep(uFogNear, uFogFar, dist);
        col = mix(col, uFogColor, f);
        alpha = mix(alpha, 1.0, f);
        gl_FragColor = vec4(col, alpha);
      }`,
  };

  function reflSize() {
    const s = reflScale[Math.min(quality, 1)];
    const pr = renderer.getPixelRatio();
    return [Math.max(64, Math.round(window.innerWidth * pr * s)), Math.max(64, Math.round(window.innerHeight * pr * s))];
  }

  // ---------- Wodospad ----------
  const fallVS = `
    #include <fog_pars_vertex>
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`;
  const fallFS = `
    #include <fog_pars_fragment>
    uniform float uTime;
    varying vec2 vUv;
    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    void main() {
      vec2 uv = vUv;
      float s1 = noise(vec2(uv.x * 9.0, uv.y * 2.5 + uTime * 2.2));
      float s2 = noise(vec2(uv.x * 23.0 + 3.0, uv.y * 5.0 + uTime * 3.4));
      float streak = s1 * 0.6 + s2 * 0.4;
      vec3 col = mix(vec3(0.12, 0.42, 0.85), vec3(0.5, 0.82, 1.0), smoothstep(0.3, 0.72, streak));
      float edge = smoothstep(0.3, 0.48, abs(uv.x - 0.5));
      float bottom = smoothstep(0.2, 0.0, uv.y);
      float lip = smoothstep(0.88, 1.0, uv.y);
      col = mix(col, vec3(1.0), clamp(smoothstep(0.6, 0.78, streak) + edge * 0.85 + bottom + lip * 0.7, 0.0, 1.0));
      col *= 1.12;
      float alpha = (1.0 - smoothstep(0.44, 0.5, abs(uv.x - 0.5))) * 0.96;
      gl_FragColor = vec4(col, alpha);
      #include <fog_fragment>
    }`;

  function makeFall(x, z, top, width) {
    const h = top + 0.6;
    const geo = new THREE.PlaneGeometry(width, h, 8, 30);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) + h / 2 - 0.3;
      const k = Math.min(1, Math.max(0, (y - (top - 0.8)) / 1.1));
      const lip = k * k * (3 - 2 * k);
      const flare = 1 + Math.max(0, 1.6 - y) * 0.12;
      pos.setXYZ(i, pos.getX(i) * flare, y, 0.35 - lip * 0.8 + Math.max(0, 1.2 - y) * 0.25);
    }
    geo.computeVertexNormals();
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
      vertexShader: fallVS, fragmentShader: fallFS, transparent: true, fog: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0, z);
    mesh.renderOrder = 2;
    scene.add(mesh);
    // Piana i mgiełka u podstawy.
    const foamG = new THREE.Group();
    foamG.position.set(x, 0.05, z + 0.8);
    const fm = G.mat(0xffffff, { rough: 1, emissive: 0x505050 });
    const n = Math.round(width * 3);
    for (let i = 0; i < n; i++) {
      const m = G.part(foamG, G.GEO.sphereMid, fm, (i / (n - 1) - 0.5) * width * 1.25, 0, (i % 2) * 0.4, 0.42, 0.3, 0.42);
      m.castShadow = false;
      m.userData.ph = i * 0.9;
    }
    scene.add(foamG);
    const mist = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.glow(), color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
    mist.position.set(x, 1.0, z + 1.2);
    mist.scale.set(width * 2.6, 2.6, 1);
    scene.add(mist);
    falls.push({ x, z, width, mat, foamG, mist, t: 0 });
    return mesh;
  }

  return {
    // Kształty wysp przy linii wody (zbierane przez rekwizyty) do mapy odległości.
    shapes: [],
    init(sc, rend) {
      scene = sc; renderer = rend;
      renderer.setClearColor(0x000000, 0);
      const [w, h] = reflSize();
      water = new ADDONS.Reflector(new THREE.PlaneGeometry(800, 800), { shader: WaterShader, textureWidth: w, textureHeight: h, clipBias: 0.003, multisample: 0 });
      water.rotation.x = -Math.PI / 2;
      water.position.y = G.WATER_Y;
      water.material.transparent = true;
      water.renderOrder = -1;
      U = water.material.uniforms;
      water._render = water.onBeforeRender;
      scene.add(water);
      // Dno jeziora (prześwituje przez wodę).
      floor = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshStandardMaterial({ color: 0x1b4f7e, roughness: 1 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -2.6;
      scene.add(floor);
    },
    makeFall,
    get uniforms() { return U; },
    // Barwa toni zależna od pory dnia (mnożnik bazowych kolorów).
    setTint(c) {
      if (!this._base) this._base = { d: U.uDeep.value.clone(), m: U.uMid.value.clone(), s: U.uShallow.value.clone() };
      U.uDeep.value.copy(this._base.d).multiply(c);
      U.uMid.value.copy(this._base.m).multiply(c);
      U.uShallow.value.copy(this._base.s).multiply(c);
    },
    // Mapa odległości od brzegu (0–4 jednostki) zapisana w teksturze.
    buildShore() {
      const W = Math.round(SDF.sx * SDF.res), H = Math.round(SDF.sz * SDF.res);
      const data = new Uint8Array(W * H);
      const shapes = this.shapes.map((s) => ({ ...s, ext: s.t === 'c' ? s.r : Math.max(s.hw, s.hd) }));
      for (let j = 0; j < H; j++) {
        const z = SDF.z0 + (j + 0.5) / SDF.res;
        for (let i = 0; i < W; i++) {
          const x = SDF.x0 + (i + 0.5) / SDF.res;
          let d = 4;
          for (const s of shapes) {
            const ax = Math.abs(x - s.x), az = Math.abs(z - s.z);
            if (ax - s.ext > d || az - s.ext > d) continue;
            let v;
            if (s.t === 'c') v = Math.hypot(x - s.x, z - s.z) - s.r;
            else {
              const qx = ax - (s.hw - s.r), qz = az - (s.hd - s.r);
              v = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - s.r;
            }
            if (v < d) d = v;
          }
          data[j * W + i] = Math.round(Math.max(0, Math.min(1, d / 4)) * 255);
        }
      }
      this._shore = { data, W, H };
      const tex = new THREE.DataTexture(data, W, H, THREE.RedFormat, THREE.UnsignedByteType);
      tex.magFilter = tex.minFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      U.uSdf.value = tex;
    },
    // Odległość od najbliższego brzegu (0–4 jednostki) w danym punkcie wody.
    shoreAt(x, z) {
      const s = this._shore;
      if (!s) return 4;
      const i = Math.floor((x - SDF.x0) * SDF.res), j = Math.floor((z - SDF.z0) * SDF.res);
      if (i < 0 || j < 0 || i >= s.W || j >= s.H) return 4;
      return (s.data[j * s.W + i] / 255) * 4;
    },
    // 0 = pełna jakość, 1 = mniejsze odbicia, 2 = bez odbić świata (tylko niebo).
    setQuality(q) {
      quality = q;
      if (q >= 2) { water.onBeforeRender = () => {}; U.uReflect.value = 0; }
      else {
        water.onBeforeRender = water._render; U.uReflect.value = 1;
        const [w, h] = reflSize(); water.getRenderTarget().setSize(w, h);
      }
    },
    resize() { if (quality < 2) { const [w, h] = reflSize(); water.getRenderTarget().setSize(w, h); } },
    update(dt, focus) {
      // Zabezpieczenie: Reflector chowa taflę na czas renderu odbicia; gdyby render przerwano, przywracamy ją.
      water.visible = true;
      U.uTime.value += dt;
      if (scene.fog) { U.uFogColor.value.copy(scene.fog.color); U.uFogNear.value = scene.fog.near; U.uFogFar.value = scene.fog.far; }
      for (const f of falls) {
        f.t += dt;
        f.mat.uniforms.uTime.value = f.t;
        f.foamG.children.forEach((m) => m.scale.set(0.42 + Math.sin(f.t * 5 + m.userData.ph) * 0.09, 0.3, 0.42));
        f.mist.material.opacity = 0.42 + Math.sin(f.t * 1.7) * 0.1;
        if (Math.abs(focus.x - f.x) < 50 && Math.random() < dt * 9) {
          G.fx.mist(new THREE.Vector3(f.x + (Math.random() - 0.5) * f.width, 0.2, f.z + 0.9));
        }
      }
    },
  };
})();
