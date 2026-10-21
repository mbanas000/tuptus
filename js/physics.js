'use strict';
// Prosta fizyka kolizji: kula gracza kontra prostopadłościany (AABB) i pionowe walce.
// Platformy „oneWay” (chmurki) zatrzymują tylko od góry.
G.phys = (() => {
  const cols = [];
  const tmp = new THREE.Vector3();
  const n = new THREE.Vector3();

  function base(c, tag) {
    c.tag = tag || null;
    c.oneWay = false;
    c.enabled = true;
    c.moving = false;
    c.delta = new THREE.Vector3();
    c.ref = null;
    cols.push(c);
    return c;
  }
  const addBox = (x0, y0, z0, x1, y1, z1, tag) => base({
    type: 'box', min: new THREE.Vector3(x0, y0, z0), max: new THREE.Vector3(x1, y1, z1),
  }, tag);
  const addCyl = (x, z, r, y0, y1, tag) => base({ type: 'cyl', x, z, r, y0, y1 }, tag);

  function remove(c) {
    const i = cols.indexOf(c);
    if (i >= 0) cols.splice(i, 1);
  }

  // Przesuwa kolider (środek podstawy dla walca / środek dla boxa) i zapamiętuje przesunięcie z tej klatki.
  function moveTo(c, x, y, z) {
    if (c.type === 'box') {
      const cx = (c.min.x + c.max.x) / 2, cy = (c.min.y + c.max.y) / 2, cz = (c.min.z + c.max.z) / 2;
      c.delta.set(x - cx, y - cy, z - cz);
      c.min.add(c.delta); c.max.add(c.delta);
    } else {
      c.delta.set(x - c.x, y - c.y1, z - c.z);
      c.x = x; c.z = z; c.y0 += c.delta.y; c.y1 = y;
    }
    c.moving = true;
  }

  function top(c) { return c.type === 'box' ? c.max.y : c.y1; }

  // Rozwiązuje kolizje kuli (center, r) z całym światem. Modyfikuje center i vel.
  function collideSphere(center, r, vel, info) {
    for (const c of cols) {
      if (!c.enabled) continue;
      let depth = 0;
      if (c.type === 'box') {
        if (center.x + r < c.min.x || center.x - r > c.max.x || center.y + r < c.min.y ||
            center.y - r > c.max.y || center.z + r < c.min.z || center.z - r > c.max.z) continue;
        tmp.set(
          Math.max(c.min.x, Math.min(center.x, c.max.x)),
          Math.max(c.min.y, Math.min(center.y, c.max.y)),
          Math.max(c.min.z, Math.min(center.z, c.max.z)));
        n.subVectors(center, tmp);
        const d = n.length();
        if (d > 1e-5) {
          if (d >= r) continue;
          n.divideScalar(d);
          depth = r - d;
        } else {
          // Środek wewnątrz: wypychamy przez najbliższą ścianę.
          const opts = [
            [c.max.y - center.y, 0, 1, 0], [center.y - c.min.y, 0, -1, 0],
            [c.max.x - center.x, 1, 0, 0], [center.x - c.min.x, -1, 0, 0],
            [c.max.z - center.z, 0, 0, 1], [center.z - c.min.z, 0, 0, -1]];
          opts.sort((a, b) => a[0] - b[0]);
          const o = opts[0];
          n.set(o[1], o[2], o[3]);
          depth = o[0] + r;
        }
      } else {
        if (Math.abs(center.x - c.x) > c.r + r || Math.abs(center.z - c.z) > c.r + r ||
            center.y + r < c.y0 || center.y - r > c.y1) continue;
        const dx = center.x - c.x, dz = center.z - c.z;
        const dh = Math.hypot(dx, dz);
        const inside = dh < c.r && center.y > c.y0 && center.y < c.y1;
        if (!inside) {
          const k = dh > c.r ? c.r / dh : 1;
          tmp.set(c.x + dx * k, Math.max(c.y0, Math.min(center.y, c.y1)), c.z + dz * k);
          n.subVectors(center, tmp);
          const d = n.length();
          if (d >= r || d < 1e-6) continue;
          n.divideScalar(d);
          depth = r - d;
        } else {
          const up = c.y1 - center.y, down = center.y - c.y0, side = c.r - dh;
          if (up <= down && up <= side) { n.set(0, 1, 0); depth = up + r; }
          else if (side <= down) { n.set(dx / (dh || 1), 0, dz / (dh || 1)); depth = side + r; }
          else { n.set(0, -1, 0); depth = down + r; }
        }
      }
      if (c.oneWay) {
        // Tylko lądowanie od góry, gdy stopy były nad powierzchnią.
        if (n.y < 0.5 || vel.y > 0.5 || center.y - r < top(c) - 0.35) continue;
      }
      center.addScaledVector(n, depth);
      const vn = vel.dot(n);
      if (vn < 0) vel.addScaledVector(n, -vn);
      if (n.y > 0.55) { info.ground = c; info.groundN.copy(n); }
      else if (n.y < -0.6) info.ceil = c;
      else info.wall = c;
    }
  }

  // Najwyższa powierzchnia pod punktem (do cienia pod postacią).
  function groundBelow(x, z, yFrom) {
    let best = -Infinity;
    for (const c of cols) {
      if (!c.enabled) continue;
      let t;
      if (c.type === 'box') {
        if (x < c.min.x || x > c.max.x || z < c.min.z || z > c.max.z) continue;
        t = c.max.y;
      } else {
        if ((x - c.x) ** 2 + (z - c.z) ** 2 > c.r * c.r) continue;
        t = c.y1;
      }
      if (t <= yFrom && t > best) best = t;
    }
    return best;
  }

  return { cols, addBox, addCyl, remove, moveTo, collideSphere, groundBelow, top };
})();
