'use strict';
// Otoczenie: niebo w złotej godzinie, światło, mgiełka, woda, tło (wzgórza, wodospad, chmury).
G.world = (() => {
  const SUN_DIR = new THREE.Vector3(-0.72, 0.52, 0.46).normalize();
  let sky, sun, hemi, fill, scene, skyClouds;

  function makeSky() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x78acdd) },
        mid: { value: new THREE.Color(0xc5d3e4) },
        horizon: { value: new THREE.Color(0xffcf9e) },
        sunDir: { value: new THREE.Vector3(-0.35, 0.16, -1).normalize() },
        sunCol: { value: new THREE.Color(0xfff0c4) },
      },
      vertexShader: `varying vec3 vDir;
        void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform vec3 top, mid, horizon, sunDir, sunCol; varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 c = mix(horizon, mid, smoothstep(-0.02, 0.22, h));
          c = mix(c, top, smoothstep(0.22, 0.7, h));
          float s = max(dot(d, sunDir), 0.0);
          c += sunCol * (pow(s, 6.0) * 0.32 + pow(s, 60.0) * 0.5 + smoothstep(0.9985, 0.9992, s) * 1.6);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), mat);
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    scene.add(sky);
  }

  function makeLights() {
    hemi = new THREE.HemisphereLight(0xd6e4ff, 0xb38d66, 1.2);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffd09c, 3.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera;
    c.left = -18; c.right = 18; c.top = 18; c.bottom = -18; c.near = 1; c.far = 120;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 3;
    scene.add(sun, sun.target);
    fill = new THREE.DirectionalLight(0xa8c6ff, 0.55);
    fill.position.set(30, 20, 30);
    scene.add(fill);
  }

  // Klif z wodospadem w tle (z kamieniami u podnóża).
  function makeWaterfall(B, x, z, top, width, wide = 14) {
    // Skaliste, szare klify jak na referencji.
    const rock = { collider: false, bottom: -2, dirt: 0x938e89, spot: 0xaba6a0 };
    G.props.block(B, x, z, wide, 7, top, rock);
    G.props.block(B, x - wide * 0.68, z + 1, 6, 6, top - 2.5, rock);
    G.props.block(B, x + wide * 0.64, z + 0.5, 5, 6, top - 1.5, rock);
    for (let i = 0; i < 6; i++) {
      const bx = x + (i - 2.5) * wide * 0.2 + (i % 2) * 0.6;
      if (Math.abs(bx - x) < width * 0.9) continue;
      G.props.rock(B, bx, top * (0.25 + (i % 3) * 0.2), z + 3.6, 1.6 + (i % 2) * 0.6);
    }
    for (let i = 0; i < Math.floor(wide / 3); i++) G.props.bush(B, x - wide / 2 + 1 + i * 3, top, z - 1 + (i % 2), 1.4, i % 2 === 0);
    G.props.tree(B, x + wide * 0.32, top, z - 2, 1.3);
    G.props.rock(B, x - width - 0.8, -0.3, z + 4.4, 1.6);
    G.props.rock(B, x + width + 1.1, -0.35, z + 4.2, 1.3);
    G.props.rock(B, x + width * 0.4, -0.5, z + 6.2, 1.0);
    G.water.makeFall(x, z + 3.5, top, width);
  }

  function makeBackdrop() {
    const B = new G.Batcher(80);
    const P = G.PAL;
    const rnd = G.u.rng(7);
    // Wzgórza z tyłu jeziora.
    for (let i = 0; i < 16; i++) {
      const x = -40 + i * 13 + rnd.range(-3, 3);
      const z = -52 - rnd.range(0, 22);
      const r = rnd.range(10, 18);
      G.props.hill(B, x, -3, z, r, rnd.range(7, 13), r * 0.8, i % 3 === 0 ? P.hillFar : rnd.pick([P.hill, 0x8ccd78, 0x6fbb63]));
      if (rnd() < 0.6) G.props.tree(B, x + rnd.range(-4, 4), rnd.range(4, 7), z + r * 0.3, rnd.range(1.6, 2.4), { simple: true });
    }
    // Bliższe, niskie pagórki po bokach.
    for (const [x, z, r] of [[-22, -8, 9], [-24, 6, 8], [-18, -24, 10], [152, -10, 10], [150, 6, 8], [146, -26, 11]]) {
      G.props.hill(B, x, -2.5, z, r, 4.5, r * 0.85, 0x83c96c);
      G.props.bush(B, x + 2, 1.5, z + r * 0.5, 2.2);
    }
    // Chmury na niebie: osobna grupa, która powoli dryfuje.
    const CB = new G.Batcher(1000);
    for (let i = 0; i < 9; i++) {
      G.props.cloudPuff(CB, -40 + i * 24 + rnd.range(-6, 6), rnd.range(22, 34), -120 - rnd.range(0, 30), rnd.range(2.2, 3.4));
    }
    skyClouds = CB.build(scene);
    skyClouds.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = false; });
    makeWaterfall(B, 76, -44, 11, 3.4);
    makeWaterfall(B, 20, -45, 8.5, 2.4, 11);
    // Tło jest daleko od rozgrywki: bez cieni, żeby nie obciążać mapy cieni.
    B.build(scene).traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  }

  return {
    SUN_DIR,
    // Dla modułu pory dnia.
    get sky() { return sky; },
    get sun() { return sun; },
    get hemi() { return hemi; },
    get fill() { return fill; },
    init(sc, renderer) {
      scene = sc;
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new ADDONS.RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.42;
      scene.fog = new THREE.Fog(0xf2d4b8, 48, 175);
      makeSky();
      makeLights();
      G.water.init(scene, renderer);
      makeBackdrop();
    },
    update(dt, focus, camera) {
      G.timeU.value += dt;
      if (skyClouds) skyClouds.position.x = Math.sin(G.timeU.value * 0.012) * 26;
      sky.position.copy(camera.position);
      sun.target.position.copy(focus);
      sun.position.copy(focus).addScaledVector(SUN_DIR, 50);
      G.water.update(dt, focus);
    },
  };
})();
