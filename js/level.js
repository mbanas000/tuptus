'use strict';
// Jedyny, dopracowany poziom: łąka → wysepki nad wodą → trampolina i płaskowyż →
// ścieżka z chmurek → ogród marchewkowy → norka Tuptusia.
G.level = (() => {
  const P = G.PAL;
  const k = (t) => `<span class="k">${t}</span>`;

  // Strefy z podpowiedziami: „card” = karta z ruchem w rogu (raz na rozgrywkę), „text” = napis na dole.
  const hints = [
    { x0: -1.8, x1: 2.6, z0: -5.4, z1: -2.3, y1: 2.5, card: 'smash' },
    { x0: 10, x1: 13.2, z0: 0, z1: 3.2, y1: 2.5, card: 'qblock' },
    { x0: 13.5, x1: 20, z0: -7, z1: -1.2, y1: 3.5, card: 'highjump' },
    { x0: 44.5, x1: 49.5, z0: -6, z1: -1.5, y1: 3, text: `Wskocz na trampolinę. Trzymaj ${k('Spacja')}, by wybić się wyżej` },
    { x0: 61, x1: 69, z0: -4.5, z1: 1, y0: 5.5, card: 'glide' },
    { x0: 82, x1: 88, z0: 1, z1: 5, card: 'roll' },
    { x0: 98, x1: 104, z0: -2.5, z1: 5, y1: 3, card: 'longjump' },
    { x0: 86.8, x1: 90, z0: -7, z1: -3.5, y1: 3, text: 'Wsiądź na ruchomą platformę i jedź w górę' },
  ];
  const inZone = (h, p) => !(p.x < h.x0 || p.x > h.x1 || p.z < h.z0 || p.z > h.z1 ||
    (h.y0 !== undefined && p.y < h.y0) || (h.y1 !== undefined && p.y > h.y1));

  function scatter(B, x0, x1, z0, z1, y, n, fn, avoid = []) {
    for (let i = 0; i < n; i++) {
      const x = G.u.rand(x0, x1), z = G.u.rand(z0, z1);
      if (avoid.some(([ax, az, r]) => (x - ax) ** 2 + (z - az) ** 2 < r * r)) continue;
      fn(x, z);
    }
  }
  const flowerColor = () => G.u.pick([P.flowerWhite, P.flowerWhite, P.flowerWhite, P.flowerPink, P.flowerBlue, P.flowerPurple]);

  // Łąka: niska trawa, koniczynki i kwiaty (pojedynczo i w kępkach). Wszystko niżej niż grzbiet
  // Tuptusia, żeby nie ginął w zieleni; wysokie rośliny tylko przy tylnych krawędziach (edgeGrass).
  function meadowDecor(B, x0, x1, z0, z1, y, density, avoid) {
    const area = (x1 - x0) * (z1 - z0);
    const R = G.u.rand;
    scatter(B, x0, x1, z0, z1, y, Math.floor(area * 0.14 * density), (x, z) => G.props.flower(B, x, y, z, flowerColor(), R(0.95, 1.2)), avoid);
    scatter(B, x0, x1, z0, z1, y, Math.floor(area * 0.045 * density), (x, z) => {
      const c = flowerColor();
      for (let i = 0; i < 5; i++) G.props.flower(B, x + R(-0.5, 0.5), y, z + R(-0.4, 0.4), c, R(0.9, 1.15));
    }, avoid);
    scatter(B, x0, x1, z0, z1, y, Math.floor(area * 0.38 * density), (x, z) => G.plants.tuft(B, x, y, z, R(0.22, 0.38), 7 + Math.floor(Math.random() * 4)), avoid);
    scatter(B, x0, x1, z0, z1, y, Math.floor(area * 0.13 * density), (x, z) => G.plants.clover(B, x, y, z, R(0.9, 1.3)), avoid);
  }
  // Bujniejsza trawa i paprotki wzdłuż tylnej krawędzi wyspy (za postacią, więc jej nie zasłaniają).
  function edgeGrass(B, x0, x1, z, y, avoid = []) {
    const R = G.u.rand;
    for (let x = x0; x <= x1; x += R(0.55, 0.95)) {
      const zz = z + R(0, 0.45);
      if (avoid.some(([ax, az, r]) => (x - ax) ** 2 + (zz - az) ** 2 < r * r)) continue;
      if (Math.random() < 0.18) G.plants.fern(B, x, y, zz + 0.2, R(0.8, 1.05));
      else G.plants.tuft(B, x, y, zz, R(0.45, 0.75), 9);
    }
  }
  // Średnia trawa wzdłuż bocznej krawędzi.
  function sideGrass(B, x, z0, z1, y) {
    for (let z = z0; z <= z1; z += G.u.rand(0.7, 1.2)) G.plants.tuft(B, x + G.u.rand(-0.2, 0.2), y, z, G.u.rand(0.3, 0.45), 7);
  }

  function build(scene) {
    const B = new G.Batcher(34);
    const E = G.ent, X = G.enemies, T = G.treasure, props = G.props;

    // ---------- 1. Łąka startowa ----------
    props.block(B, 7, -1, 26, 12, 1.0);
    props.block(B, 9, -3, 3, 3, 2.3);
    props.stump(B, 17.5, 1, -4, 0.8, 3.2);
    props.tree(B, -3.5, 1, -5, 1.1);
    props.tree(B, 14, 1, -5.6, 1.0);
    props.bush(B, 0.8, 1, 4.2, 1.0);
    props.bush(B, 5.2, 1, -5.8, 1.2);
    props.bush(B, 19, 1, 3.8, 0.9);
    props.bush(B, 1.5, 1, -6, 0.9);
    props.fence(B, -1, -6.6, 4.4, -6.6, 1);
    props.sign(B, -1, 1, -2.4, 0.15);
    props.rock(B, 6.5, 1, 3.8, 0.9);
    props.rock(B, -5, 1, -1.5, 0.8);
    meadowDecor(B, -5.5, 19.5, -6.5, 4.5, 1, 1, [[9, -3, 2.2], [17.5, -4, 1.2], [14, -5.6, 1], [-3.5, -5, 1]]);
    edgeGrass(B, -5.7, 19.7, -6.95, 1, [[-3.5, -5, 0.9], [14, -5.6, 0.8], [5.2, -5.8, 1.2], [1.5, -6, 1]]);
    sideGrass(B, -5.75, -6, 4.2, 1);
    for (const [x, z] of [[-2.2, -5.9], [12.7, -6.3], [15.3, -6.2], [18.9, -5.4], [-5.2, 0.6]]) G.plants.fern(B, x, 1, z, 0.95);
    E.star(2, 1.7, 1.5); E.star(3.6, 1.7, 1.5); E.star(5.2, 1.7, 1.5);
    E.star(9, 2.95, -3);
    E.qblock(11.5, 3.45, 1.5);
    E.star(14, 5.6, -5.6);
    X.turtle([[13, 2.6], [18.6, 2.6]], 1, { speed: 1.1 });
    T.pot(0.4, 1, -3.5); T.pot(1.35, 1, -4.1, 'heart'); T.pot(-0.3, 1, -4.5);
    T.crate(6.6, 1, -3.4);
    // Złota marchewka nad wodą za łąką: szybowanie z korony drzewa (albo wysoki skok z wysepki).
    T.gold(21.5, 4.6, -8.6);
    E.friend('Pusia', 17.5, 4.2, -4, { body: 0xf8f5f0, accent: 0xb9b8c8, iris: 0x4f7fc2, acc: 'bow', line: 'Tuptuś! Jesteś!' });

    // ---------- 2. Wysepki nad wodą ----------
    props.island(B, 23.5, 0, 1.6, 1.3);
    props.island(B, 28, -1.5, 1.5, 1.7);
    props.island(B, 32.5, 0.5, 1.4, 1.3);
    props.island(B, 27.5, 7.2, 1.15, 0.6);
    props.bush(B, 28.4, 1.7, -2.4, 0.7);
    props.grass(B, 23, 1.3, -0.8); props.grass(B, 32.9, 1.3, 1.2);
    props.flower(B, 24.2, 1.3, 0.6, P.flowerPink); props.flower(B, 32, 1.3, -0.2, P.flowerWhite);
    props.flower(B, 27.1, 0.6, 7.6, P.flowerBlue); props.grass(B, 28, 0.6, 6.8);
    for (const [x, z, s, f] of [[21, 4.5, 1, true], [25.5, 3.2, 0.8, false], [30.5, 4, 1.1, true], [34.5, 3.5, 0.9, false], [24, 8.5, 0.9, false], [31, 7.8, 1, true], [20.6, -5, 1, true], [35.5, -4, 0.8, false]]) props.lily(B, x, z, s, f);
    props.rock(B, 20.8, -0.15, 3.2, 1.3, true);
    props.rock(B, 34, -0.2, -3, 1.2, true);
    E.arc(19.6, 1.6, 0, 22.4, 1.9, 0, 2, 1.0);
    E.star(25.9, 3.2, -0.8);
    E.arc(29.6, 2.3, -1, 31.3, 2.0, 0.2, 2, 1.0);
    E.star(24.6, 0.45, 3.9);
    E.star(26.2, 0.45, 5.6);
    E.friend('Bąbel', 27.5, 0.6, 7.2, { body: 0xeeecf3, accent: 0x9a98ad, iris: 0x4f9a5c, acc: 'scarf', line: 'Hurra, ratunek!' });

    // ---------- 3. Ruchoma kładka, trampolina i płaskowyż ----------
    E.mover([36, 1.6, 0], [39.2, 1.6, 0], 2.4, 2.4, 4.5);
    E.star(37.6, 2.6, 0);
    props.block(B, 48, -1, 14, 10, 1.2);
    props.block(B, 53, -3.75, 6, 5.5, 5.2);
    E.tramp(47, 1.2, -3.8);
    E.qblock(43.5, 3.6, 1.0);
    E.qblock(45.2, 3.6, 1.0);
    props.sign(B, 45.2, 1.2, -5.4, -0.2);
    props.bush(B, 41.8, 1.2, -5.2, 1.0);
    props.bush(B, 54.2, 1.2, 3.2, 1.1);
    props.bush(B, 51, 5.2, -5.8, 0.8);
    props.rock(B, 42.2, 1.2, 3.3, 0.8);
    props.fence(B, 50.5, 3.4, 53, 3.4, 1.2);
    meadowDecor(B, 41.5, 49.5, -5.5, 3.5, 1.2, 0.9, [[47, -3.8, 1.2]]);
    meadowDecor(B, 50.4, 55.6, -6.2, -1.3, 5.2, 0.8, []);
    edgeGrass(B, 41.2, 49.6, -5.95, 1.2, [[41.8, -5.2, 1], [45.2, -5.4, 0.7], [47, -3.8, 1.4]]);
    edgeGrass(B, 50.3, 55.7, -6.45, 5.2, [[51, -5.8, 1]]);
    sideGrass(B, 41.25, -5.2, 3.6, 1.2);
    G.plants.fern(B, 49.5, 1.2, -5.5, 1); G.plants.fern(B, 54.7, 1.2, 0.2, 0.9);
    E.star(51.8, 5.85, -3.2);
    T.pot(54.4, 5.2, -4.4, 'star');
    T.pot(42.5, 1.2, -1.6, 'heart'); T.pot(43.3, 1.2, -2.5);
    T.crate(52.6, 1.2, 1.6);
    // Złota marchewka wysoko nad rogiem płaskowyżu: wysoki skok.
    T.gold(55.2, 9.2, -5.8);
    X.spiky([[42.5, 2.5], [49.5, 2.5]], 1.2, { speed: 1.3 });

    // ---------- 4. Ścieżka z chmurek ----------
    E.cloud(58.6, 5.6, -3.5, 1.25);
    E.cloud(62.2, 6.3, -2.6, 1.2);
    E.cloud(66.5, 6.8, -1.4, 1.35, { dx: 1.0, period: 5 });
    E.cloud(69.5, 10.6, -4.2, 1.4);
    E.cloud(75.2, 6.0, -1.5, 1.3);
    E.cloud(79.4, 4.4, -1.0, 1.25);
    E.star(62.2, 7.1, -2.6);
    E.star(66.5, 7.7, -1.4);
    E.arc(69.4, 7.8, -1.5, 72.8, 7.2, -1.5, 2, 0.4);
    E.friend('Fasolka', 69.5, 10.6, -4.2, { body: 0xffffff, accent: 0xe8b7c4, pink: 0xf6a2b6, iris: 0x8a62c8, acc: 'flower', line: 'Dziękuję!' });
    X.soot([[71.8, -4.2], [74.2, -4.2]], 10.2, { speed: 0.9, bob: 0.3 });
    // Złota marchewka nad najwyższą chmurką: wysoki skok z kołyszącej się chmurki.
    T.gold(69.5, 13.4, -4.2);

    // ---------- 5. Ogród marchewkowy ----------
    props.block(B, 93, -1, 22, 12, 1.3);
    props.block(B, 84.8, -5.5, 3.6, 3, 5.0);
    E.mover([88.2, 1.32, -5.5], [88.2, 5.0, -5.5], 2.2, 2.2, 7);
    E.friend('Ciapek', 84.6, 5.0, -5.6, { body: 0xf9f3ea, accent: 0x8f6a52, iris: 0x7a6a2a, acc: 'leaf', line: 'Już się nie boję!' });
    for (const z of [-3.4, -1.6]) {
      props.soilRow(B, 93, 1.3, z, 7.2);
      for (let x = 90; x <= 96.2; x += 0.9) props.carrot(B, x + G.u.rand(-0.1, 0.1), 1.45, z + G.u.rand(-0.12, 0.12), G.u.rand(0.85, 1.1));
    }
    props.giantCarrot(B, 97.2, 1.3, -3.2, 1.3);
    props.giantCarrot(B, 99.4, 1.3, -4.6, 2.7);
    props.giantCarrot(B, 101.6, 1.3, -5.6, 4.1);
    props.fence(B, 90, -6.8, 104, -6.8, 1.3);
    props.fence(B, 82.4, 4.6, 86, 4.6, 1.3, false);
    T.crate(103, 1.3, 3.9, 'heart');
    T.crate(102.6, 1.3, -1.2);
    T.crate(97.6, 1.3, -0.6, 'star');
    // Złota marchewka zawieszona nad przepaścią: tylko daleki skok z rozpędu (albo szybowanie).
    T.gold(106.8, 3.2, -2.0);
    props.sign(B, 83.2, 1.3, 3.2, 0.2);
    props.bush(B, 82.8, 1.3, -1.5, 1.0);
    props.bush(B, 96.5, 1.3, 4.4, 0.9);
    props.bush(B, 84.6, 5.0, -6.5, 0.6, true);
    meadowDecor(B, 82.5, 103.5, 0, 4.5, 1.3, 0.55, [[103, 3.9, 1]]);
    meadowDecor(B, 82.5, 89, -4, 0, 1.3, 0.5, []);
    edgeGrass(B, 90.2, 103.8, -6.97, 1.3, [[101.6, -5.6, 1.1]]);
    sideGrass(B, 82.25, -3.6, 4.2, 1.3);
    for (const [x, z] of [[83.6, -6.4], [85.4, -4.6], [86.2, -6.5]]) G.plants.flower(B, x, 5.0, z, G.u.pick([P.flowerPink, P.flowerWhite]), 1.1);
    G.plants.tuft(B, 83.5, 5.0, -4.5, 0.35, 8); G.plants.clover(B, 85.9, 5.0, -5.2, 1.2);
    for (const x of [89, 91, 93]) E.qblock(x, 3.7, 2.4);
    E.star(91, 1.95, -3.4);
    E.star(101.6, 6.2, -5.6);
    X.turtle([[85, 3.2], [99, 3.2]], 1.3, { speed: 1.0 });
    X.spiky([[87.5, 0.6], [95, 0.6]], 1.3, { speed: 1.1 });

    // ---------- 6. Norka Tuptusia ----------
    props.block(B, 115.25, -1.5, 13.5, 11, 1.3);
    props.burrow(B, 117.5, 1.3, -4.8);
    props.tree(B, 121, 1.3, -5.5, 1.1);
    props.tree(B, 110, 1.3, -5.8, 0.9);
    props.bush(B, 121.2, 1.3, 2.8, 1.1);
    props.bush(B, 109.6, 1.3, 3, 0.8);
    props.sign(B, 109.4, 1.3, -2.4, 0.3);
    meadowDecor(B, 109, 121.5, -2.2, 3.5, 1.3, 1.2, [[117.5, -4.8, 2.4]]);
    meadowDecor(B, 109, 115, -6.4, -2.4, 1.3, 0.8, [[110, -5.8, 1], [117.5, -4.8, 2.6]]);
    edgeGrass(B, 108.7, 121.8, -6.95, 1.3, [[117.5, -4.8, 2.6], [121, -5.5, 0.9], [110, -5.8, 0.8]]);
    sideGrass(B, 121.75, -4.2, 3.6, 1.3);
    for (const [x, z] of [[108.9, -6.4], [122, -6.6], [119.6, -6.7], [112.6, -6.6], [114.6, -5.6]]) G.plants.fern(B, x, 1.3, z, 0.95);
    props.pier(B, 116.5, 3.6, 8.8, 1.3);
    E.boat(113.9, 7.4, 0.25);
    E.star(112.2, 1.95, 0);
    T.pot(119.5, 1.3, 1.5, 'star');
    T.pot(115.9, 1.3, -2.4); T.pot(119.2, 1.3, -2.5, 'heart');
    // Złota marchewka nad dachem norki: wysoki skok z kopczyka.
    T.gold(117.5, 5.6, -4.8);
    X.soot([[110.5, -2.4], [114, -2.4], [114, 2.4], [110.5, 2.4]], 1.4, { speed: 1.2, bob: 0.2 });

    // Woda: kamyki i lilie wokół wysp.
    for (const [x, z, s] of [[-7, 5.5, 1.2], [21, -6.5, 1], [40, 4.8, 0.9], [57, 2.5, 1.1], [81, 5, 1], [106, 5.5, 1.2], [106, -6, 1], [123.5, 3, 1]]) props.rock(B, x, -0.2, z, s);
    // Większe kamienie przy brzegach, do połowy w wodzie.
    for (const [x, z, s] of [[20.4, -3.6, 1.4], [-6.9, -6.6, 1.6], [55.9, 4.5, 1.3], [81.8, -7.3, 1.5], [104.6, -7.3, 1.3], [122.7, -7.2, 1.5], [33.6, 2.6, 1.1], [-6.6, 2.2, 1.2]]) props.rock(B, x, -0.3, z, s);
    for (const [x, z, s] of [[-7.5, -3, 1], [38, -4.5, 0.9], [56.5, -7, 1.1], [62, 3.5, 1], [70, 4.5, 1.2], [77, 1.5, 0.9], [105.5, 0, 1], [124, -4, 1]]) props.lily(B, x, z, s, Math.random() < 0.5);

    // Niewidzialne ściany dookoła dioramy.
    G.phys.addBox(-10, -6, -14, -9, 40, 14);
    G.phys.addBox(125, -6, -14, 126, 40, 14);
    G.phys.addBox(-10, -6, -12.5, 126, 40, -11.5);
    G.phys.addBox(-10, -6, 11, 126, 40, 12);

    B.build(scene);
  }

  return {
    spawn: new THREE.Vector3(-2, 1.0, 1.5),
    timeTarget: 420,
    hints,
    build,
    hintAt(p) {
      for (const h of hints) if (h.text && inZone(h, p)) return h.text;
      return null;
    },
    cardAt(p) {
      for (const h of hints) if (h.card && inZone(h, p)) return h.card;
      return null;
    },
  };
})();
