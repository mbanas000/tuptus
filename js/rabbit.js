'use strict';
// Królik (Tuptuś i przyjaciele): jedna gładka bryła ciała z kośćmi tułowia i głowy, pyszczek z rozdwojoną
// wargą, uszy-miseczki z dwóch segmentów, królicze łapy. Animacje oparte na sprężynach (z lekkim
// „dobiciem”), do tego naturalne zachowania: ruszanie noskiem, nasłuchiwanie uszami, mycie pyszczka,
// drapanie się za uchem, „słupek” na widok czegoś ciekawego i leżenie na boku z nudów.
// Model patrzy wzdłuż +Z; root = pozycja i obrót, pivot = zgniatanie, przechyły i podskoki.

// Interpolacja po klatkach kluczowych [faza, wartość] z łagodnym przejściem.
function rabbitKeys(ph, kf) {
  for (let i = 0; i < kf.length - 1; i++) {
    const [a, va] = kf[i], [b, vb] = kf[i + 1];
    if (ph >= a && ph <= b) {
      let t = (ph - a) / (b - a || 1);
      t = t * t * (3 - 2 * t);
      return va + (vb - va) * t;
    }
  }
  return kf[kf.length - 1][1];
}
// Jeden „kic” (faza 0..1). rotation.x: biodro + = noga do tyłu, pięta + = palce w dół, przednia łapa − = do przodu.
const HOP = {
  hip: [[0, -0.32], [0.08, -0.42], [0.3, 1.0], [0.62, 0.72], [0.88, -0.62], [1, -0.32]],
  heel: [[0, 0.32], [0.08, 0.42], [0.3, 0.78], [0.62, 0.3], [0.88, 0.56], [1, 0.32]],
  front: [[0, 0.35], [0.14, -0.78], [0.48, -0.55], [0.62, -0.12], [0.9, 0.45], [1, 0.35]],
  pitch: [[0, 0.04], [0.14, -0.15], [0.45, 0.0], [0.62, 0.16], [0.86, 0.05], [1, 0.04]],
};

G.Rabbit = class {
  constructor(o = {}) {
    const P = G.PAL;
    const S = G.GEO;
    const BG = G.bunnyGeo;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    this.root = new THREE.Group();
    this.pivot = new THREE.Group();
    this.pivot.position.y = 0.42;
    this.root.add(this.pivot);
    if (o.scale) this.root.scale.setScalar(o.scale);

    const bodyC = o.body ?? P.bunny;
    const accC = o.accent ?? P.bunnyGray;
    const pinkC = o.pink ?? P.bunnyPink;
    const mb = G.furMat(new THREE.Color(bodyC).multiplyScalar(0.93).getHex());
    const ma = G.furMat(accC, 0.85);
    const mf = G.furMat(new THREE.Color(bodyC).lerp(new THREE.Color(0xffffff), 0.3).getHex());
    const padM = G.charMat(P.bunnyPad, 0.6);
    const noseM = G.charMat(P.bunnyNose, 0.4);
    const irisC = new THREE.Color(o.iris ?? P.bunnyIris);
    const darkM = G.mat(0x20140e, { rough: 0.15 });
    const irisM = G.mat(irisC.getHex(), { rough: 0.18 });
    const irisL = G.mat(irisC.clone().lerp(new THREE.Color(0xffe2a8), 0.45).getHex(), { rough: 0.2, emissive: irisC.getHex(), ei: 0.25 });
    const pupilM = G.mat(0x0e0806, { rough: 0.12 });
    const shineM = G.mat(0xffffff, { rough: 0.3, emissive: 0xffffff, ei: 0.6 });
    const lineM = G.mat(0x3a2418, { rough: 0.35 });
    const noShadow = (m) => { m.castShadow = false; return m; };

    // ---------- Jedna bryła ciała z kośćmi (tułów + głowa) ----------
    this.bodyG = new THREE.Group();
    this.pivot.add(this.bodyG);
    this.body = new THREE.SkinnedMesh(BG.coloredBody(bodyC), G.furMat(0xffffff, 0.8, true));
    this.body.castShadow = this.body.receiveShadow = true;
    const bRoot = new THREE.Bone();
    const bHead = new THREE.Bone();
    bHead.position.copy(BG.NECK);
    bRoot.add(bHead);
    this.body.add(bRoot);
    this.bodyG.add(this.body);
    this.headBone = bHead;
    // Układ „środka głowy” (na akcesoria przyjaciół).
    this.headG = new THREE.Group();
    this.headG.position.copy(BG.HEAD).sub(BG.NECK);
    bHead.add(this.headG);

    // Przyklejanie elementów do powierzchni głowy (pozycja + normalna z funkcji kształtu).
    const Z = V(0, 0, 1);
    const onSurf = (dir, from = BG.HEAD) => {
      const s = BG.surf(from, dir);
      return { p: s.p.clone().sub(BG.NECK), n: s.n.clone() };
    };
    const place = (obj, s, inset = 0) => {
      obj.position.copy(s.p).addScaledVector(s.n, -inset);
      obj.quaternion.setFromUnitVectors(Z, s.n);
      bHead.add(obj);
      return obj;
    };

    // Oczy: duże, z tęczówką, źrenicą i dwoma błyskami; łuki radości ∩ i zamknięte ∪.
    const arcGeo = new THREE.TorusGeometry(0.058, 0.016, 6, 16, Math.PI);
    this.eyes = [-1, 1].map((s) => {
      const g = place(new THREE.Group(), onSurf(V(s * 0.44, 0.2, 0.88)), 0.03);
      const open = new THREE.Group();
      g.add(open);
      noShadow(G.part(open, S.sphereMid, darkM, 0, 0, 0, 0.074, 0.094, 0.045));
      noShadow(G.part(open, S.sphereMid, irisM, 0, -0.012, 0.02, 0.06, 0.074, 0.032));
      noShadow(G.part(open, S.sphereMid, irisL, 0, -0.04, 0.03, 0.044, 0.034, 0.024));
      noShadow(G.part(open, S.sphereMid, pupilM, 0, -0.006, 0.036, 0.032, 0.044, 0.02));
      noShadow(G.part(open, S.sphereLow, shineM, 0.024, 0.036, 0.05, 0.022));
      noShadow(G.part(open, S.sphereLow, shineM, -0.022, -0.036, 0.05, 0.011));
      const happy = G.part(g, arcGeo, lineM, 0, -0.01, 0.035);
      const closed = G.part(g, arcGeo, lineM, 0, 0.02, 0.035, 1, 1, 1, 0, 0, Math.PI);
      happy.visible = closed.visible = false;
      return { g, open, happy, closed };
    });

    // Różowy nosek nad rowkiem pyszczka (grupa, żeby mógł się ruszać).
    this.nose = place(new THREE.Group(), onSurf(V(0, 0.55, 0.85), BG.MUZZLE), 0.008);
    G.part(this.nose, S.sphereMid, noseM, 0, 0, 0, 0.036, 0.025, 0.022);
    noShadow(G.part(this.nose, S.sphereLow, shineM, 0.011, 0.008, 0.017, 0.008));

    // Usta: kreska spod noska i dwa łuki – królicza warga w kształcie „Y”.
    this.mouthG = place(new THREE.Group(), onSurf(V(0, -0.12, 1), BG.MUZZLE), -0.002);
    const lipGeo = new THREE.TorusGeometry(0.026, 0.0075, 6, 14, Math.PI);
    this.mouth = {
      line: noShadow(G.part(this.mouthG, S.cylLow, lineM, 0, 0.016, 0.003, 0.0065, 0.04, 0.0065)),
      lipL: noShadow(G.part(this.mouthG, lipGeo, lineM, -0.025, -0.004, 0.002, 1, 1, 1, 0, 0, Math.PI)),
      lipR: noShadow(G.part(this.mouthG, lipGeo, lineM, 0.025, -0.004, 0.002, 1, 1, 1, 0, 0, Math.PI)),
      o: noShadow(G.part(this.mouthG, S.sphereMid, lineM, 0, -0.03, 0.004, 0.022, 0.028, 0.012)),
    };
    if (o.blush) {
      for (const s of [-1, 1]) {
        const b = place(new THREE.Group(), onSurf(V(s * 0.8, -0.25, 0.6)), 0.01);
        noShadow(G.part(b, S.sphereLow, G.charMat(0xf7a9b8, 0.9), 0, 0, 0, 0.06, 0.035, 0.02));
      }
    }

    // Uszy: miseczki z grubszym brzegiem, dwa segmenty (nasada + koniuszek na osobnej kości).
    this.ears = [-1, 1].map((s) => {
      const es = onSurf(V(s * 0.42, 1, -0.22));
      const pv = new THREE.Group();
      pv.position.copy(es.p).addScaledVector(es.n, -0.05);
      bHead.add(pv);
      const mesh = new THREE.SkinnedMesh(BG.ear(accC, pinkC), G.furMat(0xffffff, 0.8, true));
      mesh.castShadow = mesh.receiveShadow = true;
      const b0 = new THREE.Bone(), b1 = new THREE.Bone();
      b1.position.y = 0.3;
      b0.add(b1);
      mesh.add(b0);
      pv.add(mesh);
      G.part(pv, S.sphereLow, mf, 0, 0.03, 0, 0.085, 0.065, 0.065);
      return { s, pv, mesh, b0, b1, x: -0.25, z: 0.22, vx: 0, vz: 0, tx: 0, tz: 0, tvx: 0, tvz: 0,
        yaw: 0, yawV: 0, yawT: 0, yawTimer: Math.random() * 2 };
    });

    // Puszysty ogonek na okrągłym zadku.
    const ts = BG.surf(V(0, 0.05, -0.4), V(0, 0.35, -1));
    this.tail = new THREE.Group();
    this.tail.position.copy(ts.p).addScaledVector(ts.n, 0.03);
    this.bodyG.add(this.tail);
    G.part(this.tail, S.sphereMid, ma, 0, 0, 0, 0.14);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      G.part(this.tail, S.sphereMid, i % 2 ? mf : ma, Math.cos(a) * 0.075, 0.03 + Math.sin(a) * 0.065, -0.05, 0.09);
    }

    // ---------- Łapy ----------
    this.front = [-1, 1].map((s) => {
      const g = new THREE.Group();
      const rest = V(s * 0.16, -0.27, 0.3);
      g.position.copy(rest);
      this.pivot.add(g);
      G.part(g, S.sphereMid, ma, 0, -0.1, 0.02, 0.085, 0.07, 0.11);
      noShadow(G.part(g, S.sphereLow, padM, 0, -0.163, 0.035, 0.045, 0.012, 0.06));
      return { g, s, a: 0.35, rest };
    });
    this.hind = [-1, 1].map((s) => {
      const hip = new THREE.Group();
      hip.position.set(s * 0.23, -0.1, -0.3);
      this.pivot.add(hip);
      G.part(hip, S.sphereMid, mb, s * 0.01, -0.06, 0.02, 0.14, 0.18, 0.2);
      const heel = new THREE.Group();
      heel.position.set(s * 0.02, -0.2, -0.05);
      hip.add(heel);
      G.part(heel, S.sphereMid, ma, 0, -0.07, 0.12, 0.095, 0.065, 0.24);
      noShadow(G.part(heel, S.sphereLow, padM, 0, -0.128, 0.11, 0.055, 0.014, 0.1));
      for (const k of [-1, 0, 1]) noShadow(G.part(heel, S.sphereLow, padM, k * 0.042, -0.12, 0.31 - Math.abs(k) * 0.02, 0.022, 0.012, 0.025));
      return { hip, heel, s, h: -0.32, e: 0.32 };
    });

    if (o.acc) this._accessory(o.acc, o.accColor);

    // Spinanie szkieletów w pozie spoczynkowej.
    this.root.updateMatrixWorld(true);
    this.body.bind(new THREE.Skeleton([bRoot, bHead]));
    for (const e of this.ears) e.mesh.bind(new THREE.Skeleton([e.b0, e.b1]));

    // ---------- Stan animacji ----------
    this.t = Math.random() * 10;
    this.sq = 0; this.sqV = 0;
    this.ph = 0; this.ball = 0; this.rollAng = 0;
    this.blinkT = 1 + Math.random() * 3; this.blinkLeft = 0;
    this.base = 'smile'; this.expr = ''; this.exprT = 0;
    this.idleT = 0; this.look = 0; this.lookT = 0; this.lookTarget = 0;
    this.prevVy = 0; this.prevYaw = 0; this.prevSpeed = 0;
    this.hy = 0; this.hyV = 0; this.hp = 0; this.hpV = 0; this.hr = 0; this.hrV = 0;
    this.bank = 0; this.bankV = 0; this.sway = 0; this.swayV = 0;
    this.up = 0; this.upV = 0; this.wash = 0; this.washV = 0; this.scr = 0; this.scrV = 0; this.flop = 0; this.flopV = 0;
    this.act = null; this.actT = 0; this.actDur = 0; this.actTimer = 2; this.scrSide = 1; this.flopSide = 1;
    this.noseTimer = 1; this.noseBurst = 0;
    this.onStep = null;
    this.onZzz = null;
    this.onFlap = null; // wywoływane na początku każdego machnięcia uszami w dół
    this.gph = 0; this.glideLift = 0; this.earS = 1; this.earSV = 0; this.prevMode = '';
    this.setExpr('smile');
  }

  // Koniuszek ucha i punkt niżej na uchu w świecie (do smug powietrza za uszami).
  earTip(i, outTip, outMid) {
    const b1 = this.ears[i].b1;
    outTip.set(0, 0.36, 0); b1.localToWorld(outTip);
    outMid.set(0, 0.16, 0); b1.localToWorld(outMid);
  }

  _accessory(kind, color) {
    const S = G.GEO;
    if (kind === 'bow') {
      const m = G.charMat(color ?? 0xf27ea0, 0.6);
      const g = new THREE.Group();
      g.position.set(0.19, 0.3, -0.02);
      g.rotation.z = -0.4;
      this.headG.add(g);
      G.part(g, S.sphereMid, m, -0.09, 0, 0, 0.1, 0.07, 0.05, 0, 0, 0.3);
      G.part(g, S.sphereMid, m, 0.09, 0, 0, 0.1, 0.07, 0.05, 0, 0, -0.3);
      G.part(g, S.sphereLow, m, 0, 0, 0.01, 0.045);
    } else if (kind === 'scarf') {
      const m = G.charMat(color ?? 0x7cc4f0, 0.75);
      G.part(this.bodyG, new THREE.TorusGeometry(0.31, 0.07, 10, 24), m, 0, 0.0, 0.1, 1, 1, 1, Math.PI / 2 - 0.5, 0, 0);
      G.part(this.bodyG, S.sphereMid, m, 0.19, -0.13, 0.27, 0.07, 0.14, 0.05, 0.3, 0, 0.4);
    } else if (kind === 'flower') {
      const g = new THREE.Group();
      g.position.set(-0.15, 0.3, 0.04);
      g.rotation.set(0.3, 0, 0.35);
      this.headG.add(g);
      const pm = G.charMat(color ?? 0xb48cf0, 0.7);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        G.part(g, S.sphereLow, pm, Math.cos(a) * 0.07, 0, Math.sin(a) * 0.07, 0.06, 0.025, 0.045, 0, -a, 0);
      }
      G.part(g, S.sphereLow, G.charMat(G.PAL.flowerYellow), 0, 0.012, 0, 0.04, 0.03, 0.04);
    } else if (kind === 'leaf') {
      const m = G.charMat(color ?? 0x67c26a, 0.7);
      G.part(this.headG, S.sphereMid, m, 0.02, 0.36, -0.04, 0.2, 0.05, 0.14, 0.15, 0.3, -0.2);
      G.part(this.headG, S.cylLow, G.charMat(0x3f8f48), 0.02, 0.42, -0.04, 0.015, 0.1, 0.015);
    }
  }

  // Wyraz twarzy: base = trwały, inny z dur > 0 wraca po czasie do bazowego.
  setExpr(name, dur = 0) {
    if (dur > 0) { this.expr = name; this.exprT = dur; } else { this.base = name; }
    this._applyExpr(dur > 0 ? name : (this.exprT > 0 ? this.expr : name));
  }
  _applyExpr(name) {
    this._shown = name;
    const eyesOpen = !['joy', 'sleep', 'yawn', 'hurt'].includes(name);
    for (const e of this.eyes) {
      e.open.visible = eyesOpen;
      e.happy.visible = name === 'joy';
      e.closed.visible = name === 'sleep' || name === 'yawn' || name === 'hurt';
      const big = name === 'wow' ? 1.12 : name === 'sad' ? 0.92 : 1;
      e.open.scale.set(big, big, 1);
    }
    const M = this.mouth;
    const openMouth = name === 'wow' || name === 'yawn' || name === 'hurt';
    M.lipL.visible = M.lipR.visible = !openMouth;
    const lipZ = name === 'sad' ? 0 : Math.PI;
    M.lipL.rotation.z = M.lipR.rotation.z = lipZ;
    const lipS = name === 'joy' ? 1.3 : name === 'sleep' ? 0.8 : 1;
    M.lipL.scale.setScalar(lipS); M.lipR.scale.setScalar(lipS);
    M.o.visible = openMouth;
    M.o.scale.set(name === 'yawn' ? 0.034 : 0.022, name === 'yawn' ? 0.042 : 0.028, 0.012);
  }

  // Natychmiastowe ściśnięcie (lądowanie, odbicie).
  squash(amount) { this.sqV -= amount * 18; }
  // Wybicie do skoku: błyskawiczne przykucnięcie, które sprężyna od razu zamienia w rozciągnięcie.
  jumpKick() { this.sq = Math.min(this.sq, -0.17); this.sqV = 11; }

  // st: { mode, speed, vy, charged, flip, look, noIdle }
  update(dt, st) {
    const u = G.u;
    const mode = st.mode;
    this.t += dt;
    const rnd = (a, b) => a + Math.random() * (b - a);

    // Czasowe miny.
    if (this.exprT > 0) {
      this.exprT -= dt;
      if (this.exprT <= 0) this._applyExpr(this.base);
    }

    // Ruch ciała jako całości (do bezwładności głowy, przechyłów i bujania).
    const yawNow = this.root.rotation.y;
    let dYaw = yawNow - this.prevYaw;
    dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
    this.prevYaw = yawNow;
    const yawRate = dt > 0 ? dYaw / dt : 0;
    const spd = st.speed || 0;
    const acc = dt > 0 ? u.clamp((spd - this.prevSpeed) / dt, -40, 40) : 0;
    this.prevSpeed = spd;
    const dvy = (st.vy || 0) - this.prevVy;
    this.prevVy = st.vy || 0;

    // ---------- Zachowania w bezczynności ----------
    const canIdle = mode === 'idle' && !st.noIdle;
    if (mode === 'idle') this.idleT += dt;
    else {
      if (this.idleT > 0 && ['sleep', 'yawn'].includes(this._shown)) this._applyExpr(this.base);
      this.idleT = 0;
      this.act = null;
    }
    const sleeping = canIdle && this.idleT > 18;
    const interest = canIdle && !sleeping && st.look != null && this.idleT > 0.5;
    if (canIdle && !interest && !sleeping) {
      if (!this.act && this.idleT > 2.5) {
        this.actTimer -= dt;
        if (this.actTimer <= 0) {
          this.act = Math.random() < 0.55 ? 'wash' : 'scratch';
          this.actT = 0;
          this.actDur = this.act === 'wash' ? 2.6 : 1.9;
          this.scrSide = Math.random() < 0.5 ? -1 : 1;
          this.actTimer = rnd(3, 6);
        }
      }
      if (this.act) { this.actT += dt; if (this.actT > this.actDur) this.act = null; }
    } else this.act = null;
    // Miny: mycie z przymkniętymi oczkami, ziewanie, sen.
    if (this.act === 'wash' && this._shown !== 'joy') this._applyExpr('joy');
    if (this.act !== 'wash' && this._shown === 'joy' && this.exprT <= 0 && this.base !== 'joy') this._applyExpr(this.base);
    if (canIdle && this.idleT > 13 && this.idleT < 14.6 && this._shown !== 'yawn') this._applyExpr('yawn');
    if (canIdle && this.idleT >= 14.6 && this.idleT < 18 && this._shown === 'yawn') this._applyExpr(this.base);
    if (sleeping) {
      if (this._shown !== 'sleep') { this._applyExpr('sleep'); this.flopSide = Math.random() < 0.5 ? -1 : 1; }
      if (this.onZzz && Math.floor(this.t * 0.7) !== Math.floor((this.t - dt) * 0.7)) this.onZzz();
    }
    // Wagi póz (sprężyny): słupek, mycie, drapanie, leżenie na boku (z „plaśnięciem”).
    [this.up, this.upV] = u.spring(this.up, this.upV, interest ? 1 : 0, 150, 13, dt);
    [this.wash, this.washV] = u.spring(this.wash, this.washV, this.act === 'wash' ? 1 : 0, 170, 16, dt);
    [this.scr, this.scrV] = u.spring(this.scr, this.scrV, this.act === 'scratch' ? 1 : 0, 170, 16, dt);
    [this.flop, this.flopV] = u.spring(this.flop, this.flopV, sleeping ? 1 : 0, sleeping ? 60 : 220, sleeping ? 5.5 : 18, dt);
    const up = Math.max(0, this.up), wash = Math.max(0, this.wash), scr = Math.max(0, this.scr), flop = this.flop;

    // ---------- Głowa z bezwładnością ----------
    if (canIdle && this.idleT > 3 && !this.act && !interest && !sleeping) {
      this.lookT -= dt;
      if (this.lookT <= 0) { this.lookTarget = this.lookTarget === 0 ? rnd(-0.5, 0.5) : 0; this.lookT = rnd(1.2, 2.6); }
    } else this.lookTarget = 0;
    const lookT = st.look != null && !sleeping ? st.look : this.lookTarget;
    this.hyV -= dYaw * 9;                 // głowa nie nadąża za skrętem ciała
    this.hpV += dvy * 0.045 - acc * 0.006; // przy lądowaniu kiwa się w dół, przy ruszaniu odchyla
    [this.hy, this.hyV] = u.spring(this.hy, this.hyV, lookT, 150, 11, dt);
    [this.hp, this.hpV] = u.spring(this.hp, this.hpV, up * 0.6 + wash * 0.3 + (mode === 'sad' ? 0.15 : 0), 150, 11, dt);
    [this.hr, this.hrV] = u.spring(this.hr, this.hrV, -lookT * 0.25 + scr * 0.35 * this.scrSide, 150, 11, dt);
    this.headBone.rotation.set(this.hp, this.hy, this.hr, 'YXZ');

    // Mruganie.
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blinkLeft = 0.13; this.blinkT = rnd(1.8, 4.5); }
    if (this.blinkLeft > 0) this.blinkLeft -= dt;
    const blinkS = this.blinkLeft > 0 ? 0.12 : 1;
    for (const e of this.eyes) e.open.scale.y = (this._shown === 'wow' ? 1.12 : this._shown === 'sad' ? 0.92 : 1) * blinkS;

    // Ruszanie noskiem: krótkie serie drgnięć (częściej, gdy coś ciekawego).
    if (mode === 'idle' || mode === 'sad' || up > 0.3) {
      this.noseTimer -= dt * (interest ? 2.5 : 1);
      if (this.noseTimer <= 0) { this.noseBurst = rnd(0.35, 0.7); this.noseTimer = rnd(0.7, 2.4); }
    }
    if (this.noseBurst > 0 && !sleeping) {
      this.noseBurst -= dt;
      const tw = Math.abs(Math.sin(this.t * 34));
      this.nose.scale.set(1 + tw * 0.1, 1 - tw * 0.25, 1);
      this.mouthG.scale.set(1, 1 - tw * 0.12, 1);
    } else { this.nose.scale.set(1, 1, 1); this.mouthG.scale.set(1, 1, 1); }

    // ---------- Szybowanie: zamaszyste machnięcia jak u ptaka ----------
    const gliding = mode === 'glide';
    let gSpread = 0, gPitch = 0;
    if (gliding) {
      if (this.prevMode !== 'glide') { this.gph = 0; if (this.onFlap) this.onFlap(); }
      this.gph += dt * 2.6;
      if (this.gph >= 1) { this.gph -= 1; if (this.onFlap) this.onFlap(); }
      const D = 0.36, gp = this.gph;
      const down = gp < D;
      const k = down ? gp / D : (gp - D) / (1 - D);
      const e = k * k * (3 - 2 * k);
      gSpread = down ? 0.45 + 1.6 * e : 2.05 - 1.6 * e;
      gPitch = down ? -0.05 + 0.3 * e : 0.25 - 0.3 * e;
      this.glideLift = down ? e : 1 - e;
    } else this.glideLift = u.damp(this.glideLift, 0, 8, dt);
    this.prevMode = mode;

    // ---------- Zgniatanie i rozciąganie (sprężyna z wyraźnym dobiciem) ----------
    let target = 0;
    if (mode === 'crouch') target = st.charged ? -0.3 + Math.sin(this.t * 40) * 0.015 : -0.22;
    else if (mode === 'jump') target = Math.min(0.2, Math.max(0, st.vy) * 0.016);
    else if (mode === 'fall') target = 0.05;
    else if (gliding) target = -0.06 + this.glideLift * 0.1;
    else if (this._shown === 'yawn') target = 0.07;
    [this.sq, this.sqV] = u.spring(this.sq, this.sqV, target, 320, 9, dt);
    const breathe = (mode === 'idle' || mode === 'sit' || mode === 'sad')
      ? Math.sin(this.t * (sleeping ? 1.7 : 2.8)) * (sleeping ? 0.03 : 0.016) : 0;
    const sy = 1 + this.sq + breathe;
    const sxz = 1 - this.sq * 0.55 - breathe * 0.4;

    // ---------- Kicanie ----------
    let hopY = 0, pitch = 0;
    const running = mode === 'run';
    let hipT = -0.32, heelT = 0.32, frontT = 0.1, legRate = 16;
    if (running) {
      const prev = this.ph;
      this.ph = (this.ph + dt * (2.2 + spd * 0.3)) % 1;
      const ph = this.ph;
      const air = u.clamp((ph - 0.06) / 0.6, 0, 1);
      hopY = Math.sin(air * Math.PI) * (0.05 + spd * 0.013);
      const k = Math.min(1, spd / 4);
      pitch = rabbitKeys(ph, HOP.pitch) * k;
      hipT = rabbitKeys(ph, HOP.hip) * (0.5 + 0.5 * k);
      heelT = rabbitKeys(ph, HOP.heel);
      frontT = rabbitKeys(ph, HOP.front) * (0.5 + 0.5 * k);
      legRate = 40;
      if (this.onStep && prev < 0.9 && (ph >= 0.9 || ph < prev)) this.onStep();
    } else {
      this.ph = 0;
      if (mode === 'jump') { hipT = 1.0; heelT = 0.75; frontT = -0.7; }
      else if (mode === 'fall') { hipT = -0.15; heelT = 0.1; frontT = -0.35; }
      else if (gliding) { hipT = 0.25 + (1 - this.glideLift) * 0.3; heelT = 0.55; frontT = -0.45 + this.glideLift * 0.2; }
      else if (mode === 'crouch') { hipT = -0.55; heelT = 0.55; frontT = 0.25; }
      else if (mode === 'roll') { hipT = -0.9; heelT = 0.9; frontT = -0.9; }
    }
    // Słupek: tylne łapy płasko na ziemi, przednie przy piersi. Leżenie: łapy wyciągnięte.
    hipT = u.lerp(hipT, 0.2, up); heelT = u.lerp(heelT, 0.68, up); frontT = u.lerp(frontT, -1.35, up);
    hipT = u.lerp(hipT, 0.95, flop); heelT = u.lerp(heelT, 0.15, flop); frontT = u.lerp(frontT, -0.9, flop);

    // ---------- Kulka przy turlaniu ----------
    this.ball = u.damp(this.ball, mode === 'roll' ? 1 : 0, 16, dt);
    if (mode === 'roll') this.rollAng += (spd * dt) / 0.42;
    else {
      const tgt = Math.round(this.rollAng / (Math.PI * 2)) * Math.PI * 2;
      this.rollAng = u.damp(this.rollAng, tgt, 12, dt);
    }
    if (mode === 'swim') hopY = Math.sin(this.t * 4) * 0.03;
    if (gliding) hopY = (this.glideLift - 0.4) * 0.13;

    // ---------- Przechył w zakrętach i bujnięcie przy zatrzymaniu ----------
    const ground = running || mode === 'idle';
    const bankT = u.clamp(-yawRate * 0.05 * Math.min(1, spd / 3), -0.32, 0.32) + scr * 0.2 * this.scrSide;
    [this.bank, this.bankV] = u.spring(this.bank, this.bankV, bankT, 120, 9, dt);
    if (ground) this.swayV -= acc * 0.01;
    [this.sway, this.swayV] = u.spring(this.sway, this.swayV, 0, 110, 7, dt);

    this.bodyG.scale.set(1, 1 + this.ball * 0.04, 1 - this.ball * 0.32);
    const flip = st.flip ? -(1 - (1 - st.flip) ** 2) * Math.PI * 2 : 0;
    const pitchAll = this.rollAng + pitch + (gliding ? 0.1 - (this.glideLift - 0.5) * 0.1 : 0) + flip + this.sway - up * 0.85 - wash * 0.32;
    this.pivot.rotation.set(pitchAll, 0, this.bank + flop * 1.28 * this.flopSide);
    this.pivot.position.y = 0.42 * sy + hopY + this.ball * 0.02 + up * 0.2 + wash * 0.06;
    this.pivot.scale.set(sxz, sy, sxz);

    // ---------- Tylne łapy ----------
    for (const L of this.hind) {
      let h = hipT, e = heelT;
      if (mode === 'swim') {
        const w = this.t * 11 + L.s * 1.3;
        h = 0.3 + Math.sin(w) * 0.7; e = 0.45 + Math.sin(w + 1) * 0.35;
      }
      // Drapanie za uchem: łapa po stronie ucha unosi się i szybko drapie.
      if (scr > 0.01 && L.s === this.scrSide) {
        h = u.lerp(h, -1.5 + Math.sin(this.t * 24) * 0.28, scr);
        e = u.lerp(e, -0.4, scr);
      }
      L.h = u.damp(L.h, h, legRate, dt);
      L.e = u.damp(L.e, e, legRate, dt);
      L.hip.rotation.x = L.h;
      L.heel.rotation.x = L.e;
      L.hip.scale.setScalar(1 - this.ball * 0.7);
    }
    // ---------- Przednie łapki (przy myciu wędrują do pyszczka i kreślą kółka) ----------
    for (const F of this.front) {
      let a = frontT + (running ? F.s * 0.08 : 0);
      if (mode === 'swim') a = Math.sin(this.t * 11 + (F.s > 0 ? Math.PI : 0)) * 0.6;
      F.a = u.damp(F.a, a, legRate, dt);
      const ph = this.t * 9 + (F.s > 0 ? 0 : 1.2);
      F.g.position.set(
        u.lerp(F.rest.x, F.s * 0.08, wash),
        u.lerp(F.rest.y, 0.02 + Math.sin(ph) * 0.035, wash),
        u.lerp(F.rest.z, 0.5 + Math.cos(ph) * 0.03, wash));
      F.g.rotation.x = u.lerp(F.a, -1.7 + Math.sin(ph) * 0.3, wash);
      F.g.scale.setScalar(1 - this.ball * 0.7);
    }
    // Ogonek podskakuje razem z kicaniem, a w spoczynku czasem drgnie.
    this.tail.rotation.x = running ? Math.sin(this.ph * Math.PI * 2) * 0.25 : Math.sin(this.t * 2) * 0.05 + (Math.sin(this.t * 0.7) > 0.97 ? Math.sin(this.t * 30) * 0.2 : 0);
    this.tail.scale.setScalar(1 - this.ball * 0.5);

    // ---------- Uszy: nasada na sprężynach, koniuszek z opóźnieniem, nasłuchiwanie ----------
    let ex = -0.25, ez = 0.22, tipX = 0.08, tipZ = 0;
    if (running) { ex = -0.5 - spd * 0.05; ez = 0.18; tipX = -0.25; }
    else if (mode === 'jump') { ex = -0.75; ez = 0.15; tipX = -0.3; }
    else if (mode === 'fall') { ex = 0.2; ez = 0.4; tipX = 0.35; }
    else if (gliding) { ex = gPitch; ez = gSpread; tipX = 0.12; }
    else if (mode === 'crouch') { ex = -1.1; ez = 0.55; tipX = 0.2; }
    else if (mode === 'roll') { ex = -1.45; ez = 0.06; tipX = 0; }
    else if (mode === 'swim') { ex = -0.1; ez = 0.42; }
    else if (mode === 'sad') { ex = -0.75; ez = 0.95; tipX = 0.25; tipZ = 0.3; }
    ex = u.lerp(ex, 0.02, up); ez = u.lerp(ez, 0.12, up);
    ex = u.lerp(ex, -0.95, wash); ez = u.lerp(ez, 0.4, wash);
    ex = u.lerp(ex, -1.0, flop); ez = u.lerp(ez, 0.85, flop); tipX = u.lerp(tipX, 0.5, flop); tipZ = u.lerp(tipZ, 0.3, flop);
    [this.earS, this.earSV] = u.spring(this.earS, this.earSV, gliding ? 1.35 : 1, 260, 11, dt);
    const ek = gliding ? 900 : 170, ed = gliding ? 26 : 8;
    const listening = (canIdle || mode === 'sad') && !sleeping && !this.act;
    for (const e of this.ears) {
      if (!gliding) e.vx -= dvy * 0.35;
      if (running && this.ph > 0.6 && this.ph < 0.66) e.vx += 1.2;
      // Nasłuchiwanie: każde ucho obraca się osobno; przy czymś ciekawym oba w jego stronę.
      if (interest) e.yawT = u.clamp(st.look * 0.9, -0.8, 0.8);
      else if (listening) {
        e.yawTimer -= dt;
        if (e.yawTimer <= 0) { e.yawT = Math.random() < 0.35 ? 0 : rnd(-0.75, 0.75); e.yawTimer = rnd(1.2, 3.5); if (Math.random() < 0.5) e.vx += rnd(-5, 5); }
      } else e.yawT = 0;
      [e.yaw, e.yawV] = u.spring(e.yaw, e.yawV, e.yawT, 90, 8, dt);
      let ezE = ez;
      if (scr > 0.01 && e.s === this.scrSide) ezE = u.lerp(ez, 0.9, scr);
      [e.x, e.vx] = u.spring(e.x, e.vx, ex, ek, ed, dt);
      [e.z, e.vz] = u.spring(e.z, e.vz, ezE, ek, gliding ? ed : 9, dt);
      e.pv.rotation.set(e.x, e.yaw, -e.s * e.z, 'XZY');
      e.pv.scale.set(1 + (this.earS - 1) * 0.9, this.earS, 1 + (this.earS - 1) * 0.35);
      // Koniuszek: goni nasadę z opóźnieniem i lekko ją „przestrzeliwuje”.
      [e.tx, e.tvx] = u.spring(e.tx, e.tvx, tipX - e.vx * 0.06, 260, 10, dt);
      [e.tz, e.tvz] = u.spring(e.tz, e.tvz, tipZ - e.vz * 0.06, 260, 10, dt);
      e.b1.rotation.set(e.tx, 0, -e.s * e.tz);
    }
  }
};
