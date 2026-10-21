'use strict';
// Rośliny z większą ilością detali: kępki wygiętych źdźbeł, stokrotki z wieloma płatkami, koniczynki,
// paprotki, krzaki obsypane liśćmi i rozgałęzione drzewa z „poduszkami” liści.
// Geometrie powstają raz; atrybut 'color' to mnożnik jasności (ciemna nasada, jasny czubek).
G.plants = (() => {
  const P = G.PAL;
  const TAU = Math.PI * 2;
  const R = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const UP = new THREE.Vector3(0, 1, 0);

  const GRASS = [0x5cb84a, 0x74c950, 0x8fd65a, 0x4aa63f, 0xa3dd62];
  const LEAVES = [0x47a956, 0x55b65c, 0x66c466, 0x7fd36f];
  const CANOPY = [0x4fb35a, 0x5abd5e, 0x67c765];
  const CLOVER = [0xb7e15c, 0x9fd858, 0xd3e65a, 0x8acf55, 0xf0d84e];

  function tint(geo, fn) {
    const pos = geo.attributes.position;
    const a = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const k = fn(pos.getX(i), pos.getY(i), pos.getZ(i));
      a[i * 3] = a[i * 3 + 1] = a[i * 3 + 2] = k;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return geo;
  }
  function stripGeo(pos, idx) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // Źdźbło: zwężający się pasek wygięty do przodu (+Z), wysokość 1.
  function blade(bend, width = 0.09, segs = 5) {
    const pos = [], idx = [];
    for (let j = 0; j <= segs; j++) {
      const t = j / segs;
      const hw = j === segs ? 0 : width * Math.pow(1 - t, 0.75) * (0.85 + 0.3 * Math.sin(Math.PI * t));
      pos.push(-hw, t * (1 - bend * 0.25 * t), bend * t * t, hw, t * (1 - bend * 0.25 * t), bend * t * t);
    }
    for (let j = 0; j < segs; j++) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    return tint(stripGeo(pos, idx), (x, y) => 0.6 + 0.6 * y);
  }

  // Liść: spiczasta elipsa z uniesionymi brzegami; długość wzdłuż +Z, opada ku czubkowi.
  function leaf(width = 0.42, droop = 0.25, fold = 0.18, segs = 6) {
    const pos = [], idx = [];
    for (let j = 0; j <= segs; j++) {
      const u = j / segs;
      const hw = width * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08)), 0.8);
      const y = -droop * u * u;
      pos.push(-hw, y + fold * hw, u, 0, y, u, hw, y + fold * hw, u);
    }
    for (let j = 0; j < segs; j++) {
      const a = j * 3;
      idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
    }
    return tint(stripGeo(pos, idx), (x, y, z) => 0.72 + 0.36 * z + (Math.abs(x) < 0.01 ? 0.06 : 0));
  }

  // Główka kwiatu: tarcza z n płatkami, lekko wygięta jak miseczka; leży w płaszczyźnie XZ.
  function petals(n, inner = 0.3, cup = 0.22) {
    const shape = new THREE.Shape();
    const steps = n * 10;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * TAU;
      const r = inner + (1 - inner) * Math.pow(Math.abs(Math.cos((a * n) / 2)), 0.55);
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const g = new THREE.ShapeGeometry(shape, 1);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, cup * (pos.getX(i) ** 2 + pos.getZ(i) ** 2));
    g.computeVertexNormals();
    return tint(g, (x, y, z) => 0.8 + 0.25 * Math.min(1, Math.hypot(x, z)));
  }

  // Szum wartości 3D do „grudkowatych” brył (korony drzew, krzaki).
  function hash3(x, y, z) {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function noise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const L = (a, b, t) => a + (b - a) * t;
    const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
    return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v),
      L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
  }
  function blob(seed, amp = 0.11, freq = 2.3) {
    const g = new THREE.SphereGeometry(1, 26, 18);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const n1 = noise3(x * freq + seed, y * freq, z * freq) - 0.5;
      const n2 = noise3(x * freq * 2.7 + seed * 1.7, y * freq * 2.7, z * freq * 2.7) - 0.5;
      const s = 1 + n1 * amp * 2 + n2 * amp * 0.9;
      pos.setXYZ(i, x * s, y * s, z * s);
    }
    g.computeVertexNormals();
    return tint(g, (x, y) => 0.78 + 0.32 * (y * 0.5 + 0.5));
  }

  const GEO = {
    blades: [blade(0.15), blade(0.32), blade(0.5, 0.075)],
    leaf: leaf(),
    leafLong: leaf(0.2, 0.42, 0.25, 7),
    clover: leaf(0.62, 0.04, 0.12, 4),
    daisy: petals(14, 0.28, 0.2),
    cosmos: petals(8, 0.32, 0.26),
    blobs: [blob(1.3, 0.14, 2.6), blob(7.9, 0.13, 2.3), blob(4.2, 0.16, 3.0)],
  };

  // Kwaternion liścia na powierzchni: „wierzch” wzdłuż normalnej, liść odstaje pod kątem lift.
  function leafQuat(n, lift = 0.5) {
    const r = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    const t = r.sub(n.clone().multiplyScalar(r.dot(n))).normalize();
    const zA = t.multiplyScalar(Math.cos(lift)).add(n.clone().multiplyScalar(Math.sin(lift))).normalize();
    const yA = n.clone().sub(zA.clone().multiplyScalar(n.dot(zA))).normalize();
    const xA = new THREE.Vector3().crossVectors(yA, zA);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, yA, zA));
  }
  // Losowy kierunek na półkuli (bardziej ku górze).
  function upperDir(minY = -0.3) {
    for (;;) {
      const d = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
      const l = d.length();
      if (l > 0.2 && l <= 1 && d.y / l > minY) return d.divideScalar(l);
    }
  }
  // Obsypuje grudkę liśćmi.
  function leafCover(B, cx, cy, cz, rx, ry, rz, count, size, colors, minY = -0.3) {
    for (let i = 0; i < count; i++) {
      const d = upperDir(minY);
      const s = size * R(0.8, 1.2);
      B.add(GEO.leaf, pick(colors), cx + d.x * rx * 0.93, cy + d.y * ry * 0.93, cz + d.z * rz * 0.93, s, s, s * 1.15, 0, 0, 0,
        { kind: 'leaf', quat: leafQuat(d, R(0.35, 0.75)) });
    }
  }

  // ---------- Trawa ----------
  function tuft(B, x, y, z, h = 0.3, n = 7) {
    B.push(x, y, z);
    const base = Math.random() * TAU;
    for (let i = 0; i < n; i++) {
      const a = base + (i / n) * TAU + R(-0.3, 0.3);
      const r = R(0, 0.06);
      const hh = h * R(0.65, 1.15);
      B.add(GEO.blades[i % 3], pick(GRASS), Math.cos(a) * r, 0, Math.sin(a) * r, R(1.1, 1.6), hh, hh,
        R(0.12, 0.5), Math.PI / 2 - a, 0, { kind: 'deco', order: 'YXZ' });
    }
    B.pop();
  }

  // ---------- Kwiaty ----------
  function head(B, x, y, z, color, r, tilt, spin, kind = 'deco') {
    const many = color === P.flowerWhite || Math.random() < 0.3;
    const geo = many ? GEO.daisy : GEO.cosmos;
    B.add(geo, color, x, y, z, r, r, r, tilt, spin, 0, { kind });
    const inner = new THREE.Color(color).offsetHSL(0, 0.05, color === P.flowerWhite ? -0.04 : 0.06);
    B.add(geo, inner, x, y + 0.012 * (r / 0.1), z, r * 0.62, r * 0.62, r * 0.62, tilt, spin + Math.PI / (many ? 14 : 8), 0, { kind });
    B.add(G.GEO.sphereTiny, P.flowerYellow, x, y + 0.015 * (r / 0.1), z, r * 0.3, r * 0.2, r * 0.3, tilt, 0, 0, { kind });
  }
  function flower(B, x, y, z, color, s = 1) {
    const hs = R(0.28, 0.42) * s;
    B.push(x, y, z);
    B.add(G.GEO.coneLow, P.leafDark, 0, hs / 2, 0, 0.022, hs, 0.022, 0, 0, 0, { kind: 'deco' });
    const la = Math.random() * TAU;
    for (let i = 0; i < 3; i++) {
      B.add(GEO.leaf, pick(LEAVES), 0, 0.015, 0, 0.15, 0.15, 0.2 * s, R(-0.6, -0.3), la + (i / 3) * TAU + R(-0.4, 0.4), 0, { kind: 'deco', order: 'YXZ' });
    }
    head(B, 0, hs, 0, color, R(0.12, 0.155) * s, R(0.2, 0.5), Math.random() * TAU);
    B.pop();
  }
  // Sam kwiatek (na krzaku, na norce, na liściu lilii).
  function blossom(B, x, y, z, color, s = 1, tilt = 0, ry = 0) {
    head(B, x, y, z, color, 0.1 * s, tilt, ry, 'leaf');
  }

  // Kępka koniczynek (3–5 roślinek tuż przy ziemi).
  function clover(B, x, y, z, s = 1) {
    const c = pick(CLOVER);
    const n = 3 + Math.floor(Math.random() * 3);
    for (let j = 0; j < n; j++) {
      B.push(x + R(-0.3, 0.3) * s, y + 0.012, z + R(-0.25, 0.25) * s, Math.random() * TAU, s * R(0.8, 1.15));
      const h = R(0.03, 0.08);
      for (let k = 0; k < 3; k++) {
        B.add(GEO.clover, c, 0, h, 0, 0.15, 0.15, 0.15, -0.28, (k / 3) * TAU, 0, { kind: 'deco', order: 'YXZ' });
      }
      B.pop();
    }
  }

  // Paprotka: rozeta długich, łukowato opadających liści.
  function fern(B, x, y, z, s = 1) {
    B.push(x, y, z, Math.random() * TAU, s);
    const n = 7 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const len = R(0.45, 0.7);
      B.add(GEO.leafLong, pick(LEAVES), 0, 0.02, 0, len * 0.9, len, len, R(-1.0, -0.55), (i / n) * TAU + R(-0.2, 0.2), 0, { kind: 'deco', order: 'YXZ' });
    }
    B.pop();
  }

  // ---------- Krzak ----------
  function bush(B, x, y, z, s = 1, flowers = true) {
    B.push(x, y, z, Math.random() * TAU, s);
    const parts = [[0, 0.38, 0, 0.58, 0.48, 0.54, P.leaf], [-0.46, 0.27, 0.08, 0.42, 0.35, 0.4, P.leafLight],
      [0.47, 0.27, -0.05, 0.43, 0.36, 0.41, P.leaf], [0.1, 0.6, 0.14, 0.36, 0.3, 0.34, P.leafLight]];
    parts.forEach(([px, py, pz, rx, ry, rz, c], i) => {
      B.add(GEO.blobs[i % 3], c, px, py, pz, rx, ry, rz, 0, Math.random() * TAU, 0);
      leafCover(B, px, py, pz, rx, ry, rz, Math.round(8 + rx * 14), 0.2, LEAVES, -0.1);
    });
    B.pop();
    if (flowers) {
      blossom(B, x + 0.15 * s, y + 0.66 * s, z + 0.4 * s, P.flowerWhite, 1.05 * s, 1.0);
      if (Math.random() < 0.7) blossom(B, x - 0.42 * s, y + 0.5 * s, z + 0.34 * s, P.flowerWhite, 0.85 * s, 1.1, 0.4);
    }
  }

  // ---------- Drzewo ----------
  const _q = new THREE.Quaternion();
  // Gałąź / pień: stożkowy walec od punktu `from` w kierunku `dir`.
  function limb(B, from, dir, len, r0, r1, color) {
    _q.setFromUnitVectors(UP, dir);
    const c = from.clone().addScaledVector(dir, len / 2);
    B.add(new THREE.CylinderGeometry(r1, r0, len, 10, 1), color, c.x, c.y, c.z, 1, 1, 1, 0, 0, 0, { owned: true, quat: _q.clone() });
    B.sphere(color, from.x + dir.x * len, from.y + dir.y * len, from.z + dir.z * len, r1, r1, r1, 0, 0, 0, { detail: 'low' });
    return from.clone().addScaledVector(dir, len);
  }

  function tree(B, x, y, z, s = 1, o = {}) {
    const bark = 0xa8714a;
    B.push(x, y, z, Math.random() * TAU, s);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      B.sphere(bark, Math.cos(a) * 0.34, 0.06, Math.sin(a) * 0.34, 0.22, 0.13, 0.22);
    }
    const lean = R(-0.12, 0.12);
    const p0 = new THREE.Vector3(0, 0, 0);
    const p1 = limb(B, p0, new THREE.Vector3(Math.sin(lean), 1, 0).normalize(), 1.25, 0.38, 0.29, bark);
    const p2 = limb(B, p1, new THREE.Vector3(-Math.sin(lean) * 1.4, 1, R(-0.1, 0.1)).normalize(), 1.0, 0.29, 0.22, bark);
    const crowns = [[p2.x, p2.y + 0.72, p2.z, 1.2, 1.0, 1.15]];
    const nb = o.simple ? 2 : 3;
    const a0 = Math.random() * TAU;
    for (let k = 0; k < nb; k++) {
      const a = a0 + (k / nb) * TAU + R(-0.3, 0.3);
      const from = p1.clone().lerp(p2, R(0.3, 0.8));
      const end = limb(B, from, new THREE.Vector3(Math.cos(a) * 0.85, 0.75, Math.sin(a) * 0.85).normalize(), R(0.85, 1.05), 0.14, 0.07, bark);
      crowns.push([end.x, end.y + 0.3, end.z, R(0.7, 0.85), R(0.6, 0.72), R(0.7, 0.85)]);
    }
    crowns.push([p2.x + R(-0.3, 0.3), p2.y + 1.3, p2.z + R(-0.3, 0.3), 0.75, 0.6, 0.75]);
    crowns.forEach(([cx, cy, cz, rx, ry, rz], i) => {
      B.add(GEO.blobs[i % 3], CANOPY[i % 3], cx, cy, cz, rx, ry, rz, 0, Math.random() * TAU, 0, { exact: false });
      if (!o.simple) leafCover(B, cx, cy, cz, rx, ry, rz, Math.round(rx * rz * 30), 0.34, [P.canopy, P.canopyLight, 0x7fd36f, 0x5cbf60], -0.35);
    });
    B.pop();
    // Trawa i paprotka u stóp drzewa.
    if (!o.simple && y > 0.5) {
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * TAU, r = R(0.55, 0.8) * s;
        tuft(B, x + Math.cos(a) * r, y, z + Math.sin(a) * r, R(0.3, 0.45), 8);
      }
      const a = Math.random() * TAU;
      fern(B, x + Math.cos(a) * 0.75 * s, y, z + Math.sin(a) * 0.75 * s, 0.85);
    }
    G.props.treeSpots.push([x, y + 2.6 * s, z, s]);
    G.phys.addCyl(x, z, 0.36 * s, y, y + 1.9 * s);
    G.phys.addCyl(x, z, 1.25 * s, y + 2.2 * s, y + 3.95 * s);
  }

  return { GEO, tuft, flower, blossom, clover, fern, bush, tree, GRASS };
})();
