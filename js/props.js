'use strict';
// Rekwizyty z miękkich brył: wyspy z trawą, kwiaty, krzaki, drzewa, płotki, marchewki…
// Każda funkcja dokłada bryły do Batchera; elementy, po których się chodzi, rejestrują też kolider.
G.props = (() => {
  const P = G.PAL;
  const TAU = Math.PI * 2;
  const treeSpots = [];

  // Kapiąca, falista krawędź trawy jak na kaflach z arkusza.
  function drips(B, pts, y, rnd) {
    for (const [px, pz, ang] of pts) {
      const len = 0.16 + rnd() * 0.16;
      B.sphere(P.grass, px, y - len * 0.6, pz, 0.27, len, 0.17, 0, ang, 0, { detail: 'low' });
    }
  }

  // Kształty przecinające taflę trafiają do mapy brzegu (piana i płycizna liczone w shaderze wody).
  const inWater = (bottom, top, o) => o.foam !== false && bottom < G.WATER_Y && top > G.WATER_Y + 0.2;
  const shoreBox = (x, z, hw, hd, r = 0.3) => G.water.shapes.push({ t: 'b', x, z, hw, hd, r: Math.min(r, hw, hd) });
  const shoreCirc = (x, z, r) => G.water.shapes.push({ t: 'c', x, z, r });

  function block(B, x, z, w, d, top, o = {}) {
    const bottom = o.bottom ?? -2.2;
    const h = top - bottom;
    const rnd = G.u.rng(o.seed ?? Math.floor(Math.abs(x * 31 + z * 17 + top * 7)));
    if (inWater(bottom, top, o)) shoreBox(x, z, w / 2, d / 2);
    B.box(o.dirt ?? P.dirt, x, bottom + (h - 0.2) / 2, z, w, h - 0.2, d, 0.3);
    if (o.grass !== false) {
      B.box(P.grass, x, top - 0.17, z, w + 0.14, 0.36, d + 0.14, 0.17);
      const pts = [];
      const step = 0.5;
      const nx = Math.max(1, Math.round((w - 0.3) / step));
      const nz = Math.max(1, Math.round((d - 0.3) / step));
      for (let i = 0; i <= nx; i++) {
        const px = x - (w - 0.3) / 2 + ((w - 0.3) * i) / nx;
        pts.push([px, z + d / 2 + 0.05, 0], [px, z - d / 2 - 0.05, 0]);
      }
      for (let i = 0; i <= nz; i++) {
        const pz = z - (d - 0.3) / 2 + ((d - 0.3) * i) / nz;
        pts.push([x + w / 2 + 0.05, pz, Math.PI / 2], [x - w / 2 - 0.05, pz, Math.PI / 2]);
      }
      drips(B, pts, top - 0.25, rnd);
    }
    // Jaśniejsze „kropki” w ziemi.
    const spots = Math.floor((w + d) * Math.max(1, top - Math.max(bottom, -0.4)) * 0.45);
    for (let i = 0; i < spots; i++) {
      const sy = G.u.lerp(Math.max(bottom, -0.3) + 0.25, top - 0.7, rnd());
      if (sy > top - 0.6) continue;
      const r = 0.12 + rnd() * 0.14;
      const side = rnd();
      const sc = o.spot ?? P.dirtLight;
      if (side < 0.6) B.sphere(sc, x + (rnd() - 0.5) * (w - 0.6), sy, z + d / 2, r, r, 0.05, 0, 0, 0, { detail: 'low' });
      else if (side < 0.8) B.sphere(sc, x + w / 2, sy, z + (rnd() - 0.5) * (d - 0.6), 0.05, r, r, 0, 0, 0, { detail: 'low' });
      else B.sphere(sc, x - w / 2, sy, z + (rnd() - 0.5) * (d - 0.6), 0.05, r, r, 0, 0, 0, { detail: 'low' });
    }
    if (o.collider !== false) G.phys.addBox(x - w / 2, bottom, z - d / 2, x + w / 2, top, z + d / 2, o.tag);
  }

  function island(B, x, z, r, top, o = {}) {
    const bottom = o.bottom ?? -2.2;
    const h = top - bottom;
    const rnd = G.u.rng(o.seed ?? Math.floor(Math.abs(x * 13 + z * 29 + r * 5)));
    if (inWater(bottom, top, o)) shoreCirc(x, z, r * (0.9 + 0.1 * (-bottom / (h - 0.2))));
    B.taper(P.dirt, x, bottom + (h - 0.2) / 2, z, r, r * 0.9, h - 0.2, 0, 0, 0, { seg: 28 });
    B.cyl(P.grass, x, top - 0.17, z, r + 0.05, 0.3);
    B.torus(P.grass, x, top - 0.17, z, r + 0.04, 0.15, Math.PI / 2, 0, 0);
    const n = Math.max(6, Math.round((TAU * r) / 0.5));
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      pts.push([x + Math.cos(a) * (r + 0.1), z + Math.sin(a) * (r + 0.1), -a + Math.PI / 2]);
    }
    drips(B, pts, top - 0.26, rnd);
    const spots = Math.floor(r * Math.max(1, top + 0.3) * 1.6);
    for (let i = 0; i < spots; i++) {
      const a = rnd() * Math.PI + (rnd() < 0.8 ? 0 : Math.PI);
      const sy = G.u.lerp(-0.1, top - 0.7, rnd());
      if (sy > top - 0.6) continue;
      const s = 0.1 + rnd() * 0.12;
      B.sphere(P.dirtLight, x + Math.cos(a) * r * 0.97, sy, z + Math.sin(a) * r * 0.97, s, s, s * 0.4, 0, -a + Math.PI / 2, 0, { detail: 'low' });
    }
    if (o.collider !== false) G.phys.addCyl(x, z, r, bottom, top, o.tag);
  }

  // Rośliny są w plants.js (więcej detali); tu tylko zachowujemy dotychczasowe nazwy.
  const blossom = (...a) => G.plants.blossom(...a);
  const flower = (...a) => G.plants.flower(...a);
  const grass = (B, x, y, z, s = 1) => G.plants.tuft(B, x, y, z, 0.3 * s, 6 + Math.floor(Math.random() * 3));
  const bush = (...a) => G.plants.bush(...a);
  const tree = (...a) => G.plants.tree(...a);

  // Fasetowany kamień (jak na grafice z wodą): ostre ścianki, miękkie kolory.
  const rockGeo = new THREE.IcosahedronGeometry(1, 1);
  // Trawa u podstawy przedmiotów, żeby nie stały na „gołym” trawniku (tylko na lądzie).
  function groundTufts(B, x, y, z, r, n, h = 0.3) {
    if (y < 0.5) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, rr = r * (0.85 + Math.random() * 0.4);
      G.plants.tuft(B, x + Math.cos(a) * rr, y, z + Math.sin(a) * rr, h * (0.8 + Math.random() * 0.5), 7);
    }
  }

  function rock(B, x, y, z, s = 1, solid = false) {
    groundTufts(B, x, y, z, 0.5 * s, 3);
    B.push(x, y, z, Math.random() * TAU, s);
    B.add(rockGeo, 0xb0aca6, 0, 0.12, 0, 0.5, 0.38, 0.44, 0.1, 0, 0.08);
    B.add(rockGeo, 0xc4c0b8, 0.32, 0.06, 0.18, 0.28, 0.22, 0.26, 0.3, 0.6, 0);
    B.add(rockGeo, 0x96928e, -0.34, 0.02, -0.12, 0.24, 0.17, 0.22, 0, 1.1, 0.2);
    B.pop();
    if (y < 0.25 && y + 0.45 * s > 0) shoreCirc(x, z, 0.44 * s);
    if (solid) G.phys.addCyl(x, z, 0.42 * s, y - 0.5, y + 0.42 * s);
  }

  // Drewniany pomost w głąb wody, wzdłuż osi Z.
  function pier(B, x, z1, z2, y, w = 1.8) {
    const n = Math.ceil((z2 - z1) / 0.42);
    for (let i = 0; i < n; i++) {
      const pz = z1 + 0.21 + i * ((z2 - z1 - 0.42) / Math.max(1, n - 1));
      B.box(i % 3 ? P.wood : P.woodDark, x + (Math.random() - 0.5) * 0.06, y - 0.08, pz, w, 0.14, 0.38, 0.04, 0, 0, (Math.random() - 0.5) * 0.04);
    }
    for (const sx of [-1, 1]) {
      B.box(P.woodDark, x + sx * (w / 2 - 0.2), y - 0.24, (z1 + z2) / 2, 0.16, 0.14, z2 - z1, 0.04);
      for (let pz = z1 + 0.6; pz <= z2; pz += 1.6) {
        B.cyl(0x8a5a35, x + sx * (w / 2 - 0.1), (y - 2.4) / 2, pz, 0.13, y + 2.4, 0, 0, 0, { low: true });
        B.cyl(0x7a4e2e, x + sx * (w / 2 - 0.1), y + 0.04, pz, 0.15, 0.1, 0, 0, 0, { low: true });
        shoreCirc(x + sx * (w / 2 - 0.1), pz, 0.14);
      }
    }
    G.phys.addBox(x - w / 2, y - 0.3, z1, x + w / 2, y, z2);
  }

  // Płotek wzdłuż osi X albo Z.
  function fence(B, x1, z1, x2, z2, y, collider = true) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const ang = -Math.atan2(z2 - z1, x2 - x1);
    const n = Math.max(1, Math.ceil(len / 1.1));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = G.u.lerp(x1, x2, t), pz = G.u.lerp(z1, z2, t);
      B.box(P.wood, px, y + 0.45, pz, 0.22, 0.9, 0.2, 0.07, 0, ang, 0);
      B.cone(P.wood, px, y + 0.98, pz, 0.13, 0.2, 0, ang + Math.PI / 4, 0, { low: true });
      groundTufts(B, px, y, pz, 0.14, 1, 0.38);
    }
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
    B.box(P.woodLight, mx, y + 0.62, mz, len + 0.2, 0.15, 0.09, 0.05, 0, ang, 0);
    B.box(P.woodLight, mx, y + 0.32, mz, len + 0.2, 0.15, 0.09, 0.05, 0, ang, 0);
    if (collider) {
      G.phys.addBox(Math.min(x1, x2) - 0.14, y, Math.min(z1, z2) - 0.14, Math.max(x1, x2) + 0.14, y + 0.95, Math.max(z1, z2) + 0.14);
    }
  }

  function sign(B, x, y, z, ry = 0) {
    groundTufts(B, x, y, z, 0.22, 2, 0.32);
    B.push(x, y, z, ry);
    B.box(P.woodDark, 0, 0.5, 0, 0.16, 1.0, 0.16, 0.05);
    B.box(P.wood, 0, 1.05, 0, 1.0, 0.55, 0.13, 0.1);
    B.box(P.woodLight, -0.07, 1.05, 0.08, 0.42, 0.13, 0.05, 0.04);
    B.cone(P.woodLight, 0.22, 1.05, 0.08, 0.15, 0.22, 0, 0, -Math.PI / 2, { low: true });
    B.pop();
  }

  function carrot(B, x, y, z, s = 1) {
    B.push(x, y, z, Math.random() * TAU, s);
    B.sphere(P.soil, 0, 0, 0, 0.32, 0.12, 0.32, 0, 0, 0, { detail: 'low' });
    B.cone(P.carrot, 0, 0.12, 0, 0.16, 0.36, Math.PI, 0, 0);
    B.sphere(P.carrot, 0, 0.29, 0, 0.16, 0.06, 0.16, 0, 0, 0, { detail: 'low' });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      B.sphere(i % 2 ? P.leaf : P.leafLight, Math.cos(a) * 0.06, 0.52, Math.sin(a) * 0.06, 0.07, 0.24, 0.04,
        Math.sin(a) * 0.3, -a, -Math.cos(a) * 0.3, { detail: 'low' });
    }
    B.pop();
  }

  // Olbrzymia marchewka wystająca z ziemi: można na niej stanąć.
  function giantCarrot(B, x, y, z, h = 1.6, r = 0.9) {
    B.push(x, y, z, Math.random() * TAU);
    B.taper(P.carrot, 0, h / 2, 0, r, r * 0.82, h, 0, 0, 0, { seg: 24 });
    B.sphere(P.carrot, 0, h, 0, r, 0.22, r);
    for (let i = 0; i < 4; i++) B.torus(P.carrotDark, 0, 0.25 + i * (h / 4.5), 0, r * (0.83 + i * 0.03), 0.03, Math.PI / 2, 0, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      B.sphere(i % 2 ? P.leaf : P.leafLight, Math.cos(a) * 0.18, h + 0.62, Math.sin(a) * 0.18, 0.13, 0.5, 0.07,
        Math.sin(a) * 0.35, -a, -Math.cos(a) * 0.35);
    }
    B.sphere(P.soil, 0, 0, 0, r * 1.35, 0.2, r * 1.35, 0, 0, 0, { detail: 'low' });
    B.pop();
    G.phys.addCyl(x, z, r, y - 0.5, y + h + 0.12);
  }

  function soilRow(B, x, y, z, len) {
    B.box(P.soil, x, y + 0.08, z, len, 0.3, 0.95, 0.15);
    for (let i = 0; i < len * 1.5; i++) {
      B.sphere(P.soilDark, x + (Math.random() - 0.5) * (len - 0.3), y + 0.22, z + (Math.random() - 0.5) * 0.7, 0.1, 0.05, 0.1, 0, 0, 0, { detail: 'low' });
    }
  }

  function stump(B, x, y, z, r = 0.6, h = 1.2) {
    groundTufts(B, x, y, z, r * 1.15, 5, 0.35);
    B.taper(0xa86c42, x, y + h / 2, z, r, r * 1.12, h, 0, 0, 0, { seg: 22 });
    B.cyl(P.woodLight, x, y + h, z, r * 0.94, 0.05);
    B.torus(P.wood, x, y + h + 0.025, z, r * 0.55, 0.03, Math.PI / 2, 0, 0);
    B.torus(P.wood, x, y + h + 0.025, z, r * 0.25, 0.025, Math.PI / 2, 0, 0);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.3;
      B.sphere(0xa86c42, x + Math.cos(a) * r * 1.05, y + 0.08, z + Math.sin(a) * r * 1.05, 0.22, 0.14, 0.22);
    }
    G.phys.addCyl(x, z, r, y - 0.5, y + h);
  }

  function crate(B, x, y, z, s = 1, collider = true) {
    B.box(P.wood, x, y + s / 2, z, s, s, s, 0.1);
    for (const fz of [1, -1]) {
      B.box(P.woodDark, x, y + s / 2, z + fz * s / 2, s * 1.12, 0.12, 0.05, 0.03, 0, 0, Math.PI / 4);
      B.box(P.woodDark, x, y + s / 2, z + fz * s / 2, s * 1.12, 0.12, 0.05, 0.03, 0, 0, -Math.PI / 4);
    }
    if (collider) G.phys.addBox(x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2);
  }

  // Drewniany mostek z desek wzdłuż osi X.
  function planks(B, x1, x2, z, y, w = 1.6) {
    const n = Math.ceil((x2 - x1) / 0.5);
    for (let i = 0; i < n; i++) {
      const px = x1 + 0.25 + i * ((x2 - x1 - 0.5) / Math.max(1, n - 1));
      B.box(i % 2 ? P.wood : P.woodLight, px, y - 0.09, z, 0.44, 0.16, w, 0.05, 0, 0, (Math.random() - 0.5) * 0.04);
    }
    B.box(P.woodDark, (x1 + x2) / 2, y - 0.22, z - w / 2 + 0.15, x2 - x1, 0.12, 0.12, 0.05);
    B.box(P.woodDark, (x1 + x2) / 2, y - 0.22, z + w / 2 - 0.15, x2 - x1, 0.12, 0.12, 0.05);
    G.phys.addBox(x1, y - 0.3, z - w / 2, x2, y, z + w / 2);
  }

  function lily(B, x, z, s = 1, withFlower = false) {
    B.cyl(P.leafLight, x, 0.04, z, 0.55 * s, 0.06);
    B.cyl(P.leaf, x, 0.075, z, 0.42 * s, 0.02);
    if (withFlower) blossom(B, x + 0.1 * s, 0.14, z, P.flowerPink, 1.3 * s, 0);
  }

  function hill(B, x, y, z, rx, ry, rz, color) {
    B.sphere(color, x, y, z, rx, ry, rz, 0, 0, 0, { detail: 'hi', exact: true });
  }

  function cloudPuff(B, x, y, z, s = 1) {
    B.push(x, y, z, 0, s);
    const o = { kind: 'soft', exact: true };
    B.sphere(P.cloud, 0, 0, 0, 2.2, 1.6, 1.4, 0, 0, 0, o);
    B.sphere(P.cloud, -2.2, -0.4, 0.2, 1.6, 1.1, 1.1, 0, 0, 0, o);
    B.sphere(P.cloud, 2.3, -0.3, 0, 1.7, 1.2, 1.1, 0, 0, 0, o);
    B.sphere(P.cloud, 0.9, 0.9, 0.1, 1.4, 1.2, 1.0, 0, 0, 0, o);
    B.pop();
  }

  // Norka Tuptusia: trawiasty kopczyk z okrągłymi drzwiami.
  function burrow(B, x, y, z) {
    B.sphere(P.grass, x, y, z, 2.2, 1.7, 1.8, 0, 0, 0, { detail: 'hi' });
    B.cyl(0x5a3a2a, x, y + 0.75, z + 1.62, 0.62, 0.1, Math.PI / 2 - 0.12, 0, 0);
    B.torus(P.wood, x, y + 0.75, z + 1.66, 0.66, 0.1, -0.12, 0, 0);
    B.sphere(P.flowerYellow, x + 0.42, y + 0.68, z + 1.7, 0.06, 0.06, 0.06);
    for (let i = 0; i < 4; i++) blossom(B, x - 1.2 + i * 0.75, y + 1.35 - Math.abs(i - 1.5) * 0.2, z + 1.05, i % 2 ? P.flowerPink : P.flowerWhite, 1.3, 0.8);
    G.phys.addCyl(x, z, 1.9, y - 1, y + 1.45);
  }

  return { treeSpots, shoreBox, shoreCirc, pier, block, island, blossom, flower, grass, bush, tree, rock, fence, sign, carrot, giantCarrot,
    soilRow, stump, crate, planks, lily, hill, cloudPuff, burrow };
})();
