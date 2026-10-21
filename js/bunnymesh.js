'use strict';
// „Rzeźbienie” królika: tułów, okrągły zadek, pierś, głowa i pyszczek jako jedna gładka bryła
// (miękka suma elipsoid, jak wygładzone palcem łączenia plasteliny). Z tej samej funkcji odległości
// liczymy też, gdzie przykleić oczy, nosek, usta i uszy. Wymiary w przestrzeni „pivota” królika.
G.bunnyGeo = (() => {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // Przybliżona odległość od elipsoidy (Inigo Quilez) i miękkie minimum.
  function sdE(px, py, pz, cx, cy, cz, rx, ry, rz) {
    const x = (px - cx) / rx, y = (py - cy) / ry, z = (pz - cz) / rz;
    const k0 = Math.sqrt(x * x + y * y + z * z);
    const k1 = Math.sqrt((x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2);
    return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
  }
  function smin(a, b, k) {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
  }

  // Kształt: tułów, zadek, pierś, głowa, dwie poduszeczki pyszczka (z rowkiem między nimi) i bródka.
  const HEAD = V(0, 0.15, 0.27);
  const MUZZLE = V(0, 0.03, 0.54);
  function sdf(x, y, z) {
    let d = sdE(x, y, z, 0, -0.02, -0.2, 0.43, 0.36, 0.44);
    d = smin(d, sdE(x, y, z, 0, 0.04, -0.4, 0.4, 0.37, 0.32), 0.15);
    d = smin(d, sdE(x, y, z, 0, 0.0, 0.08, 0.32, 0.3, 0.3), 0.18);
    d = smin(d, sdE(x, y, z, 0, 0.15, 0.27, 0.37, 0.35, 0.33), 0.16);
    d = smin(d, sdE(x, y, z, -0.072, 0.03, 0.55, 0.105, 0.09, 0.1), 0.05);
    d = smin(d, sdE(x, y, z, 0.072, 0.03, 0.55, 0.105, 0.09, 0.1), 0.05);
    d = smin(d, sdE(x, y, z, 0, -0.04, 0.5, 0.085, 0.06, 0.08), 0.05);
    return d;
  }
  const sdfV = (p) => sdf(p.x, p.y, p.z);

  // Punkt powierzchni na promieniu z wnętrza bryły (from) w kierunku dir; normal = gradient.
  function surf(from, dir, outP = V(), outN = V()) {
    const d = dir.clone().normalize();
    let a = 0, b = 0.02;
    const p = V();
    while (b < 2.5) {
      p.copy(from).addScaledVector(d, b);
      if (sdfV(p) > 0) break;
      a = b; b += 0.02;
    }
    for (let i = 0; i < 18; i++) {
      const m = (a + b) / 2;
      p.copy(from).addScaledVector(d, m);
      if (sdfV(p) > 0) b = m; else a = m;
    }
    outP.copy(from).addScaledVector(d, (a + b) / 2);
    const e = 0.002, q = outP;
    outN.set(
      sdf(q.x + e, q.y, q.z) - sdf(q.x - e, q.y, q.z),
      sdf(q.x, q.y + e, q.z) - sdf(q.x, q.y - e, q.z),
      sdf(q.x, q.y, q.z + e) - sdf(q.x, q.y, q.z - e)).normalize();
    return { p: outP, n: outN };
  }

  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // Bryła ciała (wspólna dla wszystkich królików): pozycje, normalne, kości (tułów/głowa) i „odcień futra”.
  let bodyCache = null;
  function body() {
    if (bodyCache) return bodyCache;
    let g = new THREE.SphereGeometry(1, 96, 72);
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    g = ADDONS.mergeVertices(g, 1e-4);
    const pos = g.attributes.position;
    const C = V(0, 0.06, 0.02);
    const dir = V(), out = V(), n = V();
    for (let i = 0; i < pos.count; i++) {
      dir.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      surf(C, dir, out, n);
      pos.setXYZ(i, out.x, out.y, out.z);
    }
    g.computeVertexNormals();
    const cnt = pos.count;
    const skinIndex = new Uint16Array(cnt * 4), skinWeight = new Float32Array(cnt * 4), shade = new Float32Array(cnt);
    for (let i = 0; i < cnt; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      // Waga kości głowy: przód i góra szyi należą do głowy, pierś i tułów – do ciała.
      const w = smooth(0.04, 0.28, z + (y - 0.05) * 0.6);
      skinIndex.set([0, 1, 0, 0], i * 4);
      skinWeight.set([1 - w, w, 0, 0], i * 4);
      // Odcień futra: jasny brzuszek, pierś i pyszczek; ciemniejszy grzbiet.
      let f = smooth(0.1, -0.24, y);
      f = Math.max(f, smooth(0.22, 0.08, Math.hypot(x - MUZZLE.x, y - MUZZLE.y, z - MUZZLE.z)));
      f = Math.max(f, smooth(-0.05, 0.22, z) * smooth(0.12, -0.12, y) * 0.85);
      f = Math.max(f, smooth(0.24, 0.12, Math.hypot(x, y - 0.0, z - 0.28)) * 0.6);
      shade[i] = f;
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
    g.setAttribute('shade', new THREE.BufferAttribute(shade, 1));
    bodyCache = g;
    return g;
  }

  // Kopia bryły z kolorami futra danego królika (grzbiet → brzuszek).
  function coloredBody(bodyColor) {
    const g = body().clone();
    const back = new THREE.Color(bodyColor).multiplyScalar(0.84);
    back.offsetHSL(0.005, 0.04, 0);
    const belly = new THREE.Color(bodyColor).lerp(new THREE.Color(0xffffff), 0.5);
    const shade = g.attributes.shade;
    const col = new Float32Array(shade.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < shade.count; i++) {
      c.copy(back).lerp(belly, shade.getX(i));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }

  // Ucho: spłaszczona elipsoida z wklęsłą „miseczką” z przodu i grubszym brzegiem.
  // Kolory w wierzchołkach (różowe wnętrze, futro na brzegu i z tyłu), dwie kości: nasada i koniuszek.
  function ear(accent, pink) {
    let g = new THREE.SphereGeometry(1, 22, 28);
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    g = ADDONS.mergeVertices(g, 1e-4);
    const pos = g.attributes.position;
    const W = 0.13, L = 0.34, T = 0.08;
    const cA = new THREE.Color(accent), cP = new THREE.Color(pink), c = new THREE.Color();
    const col = new Float32Array(pos.count * 3);
    const skinIndex = new Uint16Array(pos.count * 4), skinWeight = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      const ux = pos.getX(i), uy = pos.getY(i), uz = pos.getZ(i);
      const t = (uy + 1) / 2; // 0 nasada … 1 koniuszek
      // Węższa nasada, zaokrąglony czubek.
      const wMul = 0.7 + 0.3 * Math.sin(Math.PI * Math.min(1, t * 1.25));
      let x = ux * W * wMul, y = uy * L + L - 0.02, z = uz * T;
      // Miseczka: przednia ścianka cofnięta w głąb (wnętrze), brzeg zostaje gruby.
      const inside = Math.max(0, 1 - (ux * ux) * 1.35) * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.06) / 0.86)));
      if (uz > 0) z -= uz * T * 1.55 * inside;
      pos.setXYZ(i, x, y, z);
      const p = uz > 0 ? smooth(0.15, 0.55, inside) : 0;
      c.copy(cA).lerp(cP, p);
      col.set([c.r, c.g, c.b], i * 3);
      const w1 = smooth(0.2, 0.46, y);
      skinIndex.set([0, 1, 0, 0], i * 4);
      skinWeight.set([1 - w1, w1, 0, 0], i * 4);
    }
    g.computeVertexNormals();
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
    return g;
  }

  return { sdf, surf, body, coloredBody, ear, HEAD, MUZZLE, NECK: V(0, 0.1, 0.12) };
})();
