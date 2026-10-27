/*
 * Beam theory calculators: cross-section, tension/compression & shear, bending, torsion, buckling.
 */
(function (root) {
  'use strict';
  var PEC = root.PEC, r = PEC.r, h = PEC.h, S = PEC.sections, PI = Math.PI;
  var BASE = 'https://www.jpe-innovations.com/precision-point/';

  function sectionOf(i) {
    return { shape: i.shape, w: i.w, h: i.h, wo: i.wo, ho: i.ho, wi: i.wi, hi: i.hi, d: i.d, do: i.do, di: i.di, t1: i.t1, t2: i.t2, r1: i.r1, r2: i.r2 };
  }

  // ---------------------------------------------------------------- Cross-section
  PEC.register({
    id: 'cross-section',
    title: 'Area moment of inertia',
    category: 'Beam theory',
    source: BASE + 'area-moment-inertia/',
    description: 'Area, second moments of area, section moduli and torsion constant of common cross-sections.',
    inputs: S.inputs('rect'),
    formulas: S.FORMULAS.concat(['Radius of gyration i = √(I/A)', 'Torsion constant J_T: see Beam theory: Torsion']),
    compute: function (i) {
      var s = sectionOf(i), p = S.props(s);
      var res = { results: [], warnings: S.validate(s) };
      res.results.push(
        r('Area', 'A', p.A, 'mm²'),
        r('Second moment of area about x', 'Iₓ', p.Ix, 'mm⁴'),
        r('Second moment of area about y', 'I_y', p.Iy, 'mm⁴'),
        r('Outer fibre distance (x-axis bending)', 'eₓ', p.ex, 'mm'),
        r('Outer fibre distance (y-axis bending)', 'e_y', p.ey, 'mm'),
        r('Section modulus about x', 'Wₓ', p.Wx, 'mm³'),
        r('Section modulus about y', 'W_y', p.Wy, 'mm³'),
        r('Radius of gyration about x', 'iₓ', Math.sqrt(p.Ix / p.A), 'mm'),
        r('Radius of gyration about y', 'i_y', Math.sqrt(p.Iy / p.A), 'mm')
      );
      if (p.J !== undefined) res.results.push(r('Torsion constant', 'J_T', p.J, 'mm⁴'));
      return res;
    }
  });

  // ---------------------------------------------------------------- Tension / compression / shear
  PEC.register({
    id: 'tension-shear',
    title: 'Tension, compression & shear',
    category: 'Beam theory',
    source: BASE + 'beam-theory-tension-compression-shear/',
    description: 'Axial and shear stress, strain, elongation and stiffness of a prismatic bar.',
    inputs: [
      { type: 'heading', label: 'Bar' },
      { id: 'l', label: 'Length', sym: 'l', unit: 'mm', value: 50 }
    ].concat(S.inputs('rect')).concat(PEC.common.materialInputs({ strength: true }, 'Steel (stainless)')).concat([
      { type: 'heading', label: 'Loads' },
      { id: 'Fz', label: 'Axial force (+ tension)', sym: 'F_z', unit: 'N', value: 1000 },
      { id: 'Fy', label: 'Shear force', sym: 'F_y', unit: 'N', value: 100 }
    ]),
    formulas: [
      'σ = F_z / A,  ε = σ / E,  Δl = ε·l',
      'C_z = F_z / Δl = E·A / l',
      'G = E / (2(1 + ν))',
      'τ = F_y / A (average),  γ = τ / G,  δ = γ·l',
      'C_y = F_y / δ = G·A / l'
    ],
    compute: function (i) {
      var s = sectionOf(i), p = S.props(s), E = i.E, G = PEC.G(E, i.nu);
      var sigma = i.Fz / p.A, eps = sigma / E, tau = i.Fy / p.A, gamma = tau / G;
      var res = { results: [], warnings: S.validate(s) };
      res.results.push(
        r('Cross-sectional area', 'A', p.A, 'mm²'),
        h('Tension / compression'),
        r('Normal stress', 'σ', sigma, 'MPa'),
        r('Strain', 'ε', eps, 'ppm'),
        r('Elongation', 'Δl', eps * i.l, 'µm'),
        r('Axial stiffness', 'C_z', E * p.A / i.l, 'N/µm'),
        h('Shear'),
        r('Shear modulus', 'G', G, 'GPa'),
        r('Average shear stress', 'τ', tau, 'MPa'),
        r('Shear strain', 'γ', gamma, 'µrad'),
        r('Shear deformation', 'δ', gamma * i.l, 'µm'),
        r('Shear stiffness', 'C_y', G * p.A / i.l, 'N/µm'),
        h('Stress check'),
        r('Von Mises stress', 'σ_V', Math.sqrt(sigma * sigma + 3 * tau * tau), 'MPa')
      );
      PEC.common.stressCheck(Math.sqrt(sigma * sigma + 3 * tau * tau), i, res);
      return res;
    }
  });

  // ---------------------------------------------------------------- Bending
  // Each case: deflection curve y(z) (positive = sag), slopes, max moment, stiffness.
  var CASES = {
    'cant-F': {
      label: 'Cantilever, point load F at free end', load: 'F',
      y: function (z, c) { return c.F * z * z * (3 * c.L - z) / (6 * c.EI); },
      Mmax: function (c) { return c.F * c.L; },
      thA: function () { return 0; }, thB: function (c) { return c.F * c.L * c.L / (2 * c.EI); },
      stiff: function (c) { return { label: 'Stiffness at free end', sym: 'C = 3EI/L³', v: 3 * c.EI / Math.pow(c.L, 3), unit: 'N/mm' }; },
      f: ['δy(z) = F·z²·(3L − z) / (6EI),  δy_max = F·L³ / (3EI)', 'θ_B = F·L² / (2EI)', 'C = 3EI / L³', 'σ_max = F·L·e / I (at the clamp)']
    },
    'cant-M': {
      label: 'Cantilever, moment M at free end', load: 'M',
      y: function (z, c) { return c.M * z * z / (2 * c.EI); },
      Mmax: function (c) { return c.M; },
      thA: function () { return 0; }, thB: function (c) { return c.M * c.L / c.EI; },
      stiff: function (c) { return { label: 'Rotational stiffness at free end', sym: 'K = EI/L', v: c.EI / c.L, unit: 'Nm/rad' }; },
      f: ['δy(z) = M·z² / (2EI),  δy_max = M·L² / (2EI)', 'θ_B = M·L / (EI)', 'K = EI / L', 'σ_max = M·e / I']
    },
    'cant-q': {
      label: 'Cantilever, uniform load q', load: 'q',
      y: function (z, c) { return c.q * z * z * (6 * c.L * c.L - 4 * c.L * z + z * z) / (24 * c.EI); },
      Mmax: function (c) { return c.q * c.L * c.L / 2; },
      thA: function () { return 0; }, thB: function (c) { return c.q * Math.pow(c.L, 3) / (6 * c.EI); },
      f: ['δy(z) = q·z²·(6L² − 4Lz + z²) / (24EI),  δy_max = q·L⁴ / (8EI)', 'θ_B = q·L³ / (6EI)', 'σ_max = q·L²·e / (2I) (at the clamp)']
    },
    'ss-F': {
      label: 'Simply supported, point load F at distance a', load: 'F', usesA: true,
      y: function (z, c) {
        var a = c.a, b = c.L - c.a, L = c.L;
        return z <= a ? c.F * b * z * (L * L - b * b - z * z) / (6 * c.EI * L)
                      : c.F * a * (L - z) * (L * L - a * a - Math.pow(L - z, 2)) / (6 * c.EI * L);
      },
      Mmax: function (c) { return c.F * c.a * (c.L - c.a) / c.L; },
      thA: function (c) { var b = c.L - c.a; return c.F * c.a * b * (c.L + b) / (6 * c.EI * c.L); },
      thB: function (c) { var b = c.L - c.a; return c.F * c.a * b * (c.L + c.a) / (6 * c.EI * c.L); },
      stiff: function (c) { var b = c.L - c.a; return { label: 'Stiffness at load point', sym: 'C = 3EIL/(a²b²)', v: 3 * c.EI * c.L / (c.a * c.a * b * b), unit: 'N/mm' }; },
      f: ['b = L − a', 'δy(z) = F·b·z·(L² − b² − z²) / (6EIL) for z ≤ a', 'θ_A = F·a·b·(L + b) / (6EIL),  θ_B = F·a·b·(L + a) / (6EIL)', 'C = 3EIL / (a²b²) at z = a', 'σ_max = F·a·b·e / (I·L) at z = a']
    },
    'ss-M': {
      label: 'Simply supported, moment M at end B', load: 'M',
      y: function (z, c) { var x = z / c.L; return c.M * c.L * c.L / (6 * c.EI) * (x - x * x * x); },
      Mmax: function (c) { return c.M; },
      thA: function (c) { return c.M * c.L / (6 * c.EI); }, thB: function (c) { return c.M * c.L / (3 * c.EI); },
      stiff: function (c) { return { label: 'Rotational stiffness at B', sym: 'K = 3EI/L', v: 3 * c.EI / c.L, unit: 'Nm/rad' }; },
      f: ['δy(z) = (M·L² / (6EI))·(z/L − (z/L)³),  δy_max = M·L² / (9√3·EI) at z = L/√3', 'θ_A = M·L / (6EI),  θ_B = M·L / (3EI)', 'K = 3EI / L', 'σ_max = M·e / I at z = L']
    },
    'ss-q': {
      label: 'Simply supported, uniform load q', load: 'q',
      y: function (z, c) { var x = z / c.L; return c.q * Math.pow(c.L, 4) / (24 * c.EI) * (x - 2 * x * x * x + Math.pow(x, 4)); },
      Mmax: function (c) { return c.q * c.L * c.L / 8; },
      thA: function (c) { return c.q * Math.pow(c.L, 3) / (24 * c.EI); }, thB: function (c) { return c.q * Math.pow(c.L, 3) / (24 * c.EI); },
      f: ['δy(z) = (q·L⁴ / (24EI))·(ζ − 2ζ³ + ζ⁴), ζ = z/L', 'δy_max = 5·q·L⁴ / (384EI) at z = L/2', 'θ_A = θ_B = q·L³ / (24EI)', 'σ_max = q·L²·e / (8I) at z = L/2']
    },
    'ff-q': {
      label: 'Both ends clamped, uniform load q', load: 'q',
      y: function (z, c) { var x = z / c.L; return c.q * Math.pow(c.L, 4) / (24 * c.EI) * (x * x - 2 * x * x * x + Math.pow(x, 4)); },
      Mmax: function (c) { return c.q * c.L * c.L / 12; },
      thA: function () { return 0; }, thB: function () { return 0; },
      f: ['δy(z) = (q·L⁴ / (24EI))·(ζ² − 2ζ³ + ζ⁴), ζ = z/L', 'δy_max = q·L⁴ / (384EI) at z = L/2', 'σ_max = q·L²·e / (12I) at the clamps']
    },
    'fg-F': {
      label: 'Clamped / guided end (rotation fixed), point load F', load: 'F',
      y: function (z, c) { return c.F * z * z * (3 * c.L - 2 * z) / (12 * c.EI); },
      Mmax: function (c) { return c.F * c.L / 2; },
      thA: function () { return 0; }, thB: function () { return 0; },
      stiff: function (c) { return { label: 'Stiffness at guided end', sym: 'C = 12EI/L³', v: 12 * c.EI / Math.pow(c.L, 3), unit: 'N/mm' }; },
      f: ['δy(z) = F·z²·(3L − 2z) / (12EI),  δy_max = F·L³ / (12EI)', 'C = 12EI / L³', 'σ_max = F·L·e / (2I) at both ends']
    }
  };

  function bendingCtx(i) {
    var s = sectionOf(i), p = S.props(s);
    var I = i.axis === 'y' ? p.Iy : p.Ix, e = i.axis === 'y' ? p.ey : p.ex;
    return { s: s, p: p, I: I, e: e, EI: i.E * I, L: i.L, F: i.F, M: i.M, q: i.q, a: i.a };
  }

  PEC.register({
    id: 'beam-bending',
    title: 'Beam bending',
    category: 'Beam theory',
    source: BASE + 'beam-theory-bending/',
    description: 'Deflection curve, slopes, stiffness and bending stress for standard support and load cases.',
    inputs: [
      { type: 'heading', label: 'Support & load case' },
      { id: 'case', label: 'Case', type: 'select', value: 'cant-F', options: Object.keys(CASES).map(function (k) { return { v: k, label: CASES[k].label }; }) },
      { id: 'L', label: 'Beam length', sym: 'L', unit: 'mm', value: 100 },
      { id: 'F', label: 'Point load', sym: 'F', unit: 'N', value: 10, showIf: { field: 'case', values: ['cant-F', 'ss-F', 'fg-F'] } },
      { id: 'M', label: 'Moment', sym: 'M', unit: 'Nmm', value: 1000, showIf: { field: 'case', values: ['cant-M', 'ss-M'] } },
      { id: 'q', label: 'Distributed load', sym: 'q', unit: 'N/mm', value: 0.1, showIf: { field: 'case', values: ['cant-q', 'ss-q', 'ff-q'] } },
      { id: 'a', label: 'Load position from A', sym: 'a', unit: 'mm', value: 50, showIf: { field: 'case', values: ['ss-F'] } },
      { id: 'axis', label: 'Bending about', type: 'select', value: 'x', options: [{ v: 'x', label: 'x-axis (deflection along h)' }, { v: 'y', label: 'y-axis (deflection along w)' }] }
    ].concat(S.inputs('rect').map(function (f) {
      // Sensible defaults for a beam rather than a leaf spring.
      var d = { w: 10, h: 5, d: 8 };
      return d[f.id] !== undefined ? Object.assign({}, f, { value: d[f.id] }) : f;
    })).concat(PEC.common.materialInputs({ nu: false }, 'Aluminum 6082-T6')),
    formulas: function (v) {
      var c = CASES[v.case] || CASES['cant-F'];
      return ['Valid for slender beams: L/h > 10 and θ < 5°'].concat(c.f);
    },
    compute: function (i) {
      var c = CASES[i.case], ctx = bendingCtx(i);
      var res = { results: [], warnings: S.validate(ctx.s) };
      if (c.usesA && (i.a <= 0 || i.a >= i.L)) { res.warnings.push('Load position a must lie between 0 and L.'); return res; }
      var n = 400, zs = [], ys = [], ymax = 0, zmax = 0;
      for (var k = 0; k <= n; k++) {
        var z = i.L * k / n, y = c.y(z, ctx);
        zs.push(z); ys.push(y);
        if (Math.abs(y) > Math.abs(ymax)) { ymax = y; zmax = z; }
      }
      var Mmax = c.Mmax(ctx), sigma = Math.abs(Mmax) * ctx.e / ctx.I;
      res.results.push(
        h('Section'),
        r('Second moment of area', 'I', ctx.I, 'mm⁴'),
        r('Outer fibre distance', 'e', ctx.e, 'mm'),
        r('Bending stiffness', 'EI', ctx.EI, 'Nm²'),
        h('Deformation'),
        r('Maximum deflection', 'δy_max', ymax, 'µm'),
        r('Location of maximum deflection', 'z', zmax, 'mm'),
        r('Slope at A', 'θ_A', c.thA(ctx), 'mrad'),
        r('Slope at B', 'θ_B', c.thB(ctx), 'mrad')
      );
      if (c.stiff) { var st = c.stiff(ctx); res.results.push(r(st.label, st.sym, st.v, st.unit)); }
      res.results.push(
        h('Stress'),
        r('Maximum bending moment', 'M_max', Mmax, 'Nmm'),
        r('Maximum bending stress', 'σ_max', sigma, 'MPa')
      );
      PEC.common.stressCheck(sigma, i, res);
      var hdim = 2 * ctx.e;
      if (i.L / hdim < 10) res.warnings.push('L/h < 10: slender beam theory becomes inaccurate (shear deformation not included).');
      if (Math.max(Math.abs(c.thA(ctx)), Math.abs(c.thB(ctx))) > 5 * PI / 180) res.warnings.push('Slope > 5°: small-rotation assumption violated.');
      res.chart = {
        title: 'Deflection curve',
        x: { label: 'z', unit: 'mm', values: zs },
        series: [{ label: 'δy', unit: 'µm', values: ys }],
        invertY: true
      };
      return res;
    }
  });

  // ---------------------------------------------------------------- Torsion
  PEC.register({
    id: 'torsion',
    title: 'Torsion',
    category: 'Beam theory',
    source: BASE + 'beam-theory-torsion/',
    description: 'Torsion constant, torsional stiffness, twist angle and shear stress of shafts and thin-walled sections (free warping).',
    inputs: [
      { type: 'heading', label: 'Shaft' },
      { id: 'L', label: 'Length', sym: 'L', unit: 'mm', value: 50 },
      { id: 'T', label: 'Torque', sym: 'T', unit: 'Nmm', value: 1000 }
    ].concat(S.inputs('circle', ['circle', 'tube', 'rect', 'hollowRect'])).concat(PEC.common.materialInputs({}, 'Steel (stainless)')),
    formulas: [
      'θ = T·L / (G·J_T),  K_z = G·J_T / L,  G = E / (2(1 + ν))',
      'Circle: J_T = π·r⁴/2,  τ_max = 2T / (π·r³)',
      'Tube: J_T = π·(rₒ⁴ − rᵢ⁴)/2,  τ_max = 2T·rₒ / (π·(rₒ⁴ − rᵢ⁴))',
      'Rectangle (w ≥ h): J_T = (1/16)·w·h³·(16/3 − 3.36·(h/w)·(1 − h⁴/(12w⁴)))',
      'Rectangle: τ_max = 3T/(w·h²)·(1 + 0.6095·h/w + 0.8865·(h/w)² − 1.8023·(h/w)³ + 0.9100·(h/w)⁴)',
      'Thin-walled box (uniform t): J_T = 2t²(w − t)²(h − t)² / ((w + h)·t − 2t²),  τ_avg = T / (2t(w − t)(h − t))',
      'Von Mises (pure shear): σ_V = √3·τ_max'
    ],
    compute: function (i) {
      var s = sectionOf(i), p = S.props(s);
      var res = { results: [], warnings: S.validate(s) };
      if (p.J === undefined) {
        res.warnings.push('Hollow rectangle needs a uniform wall thickness ((wₒ − wᵢ) = (hₒ − hᵢ)) for the thin-walled formula.');
        return res;
      }
      var G = PEC.G(i.E, i.nu), tau = p.tauFactor * i.T, sv = Math.sqrt(3) * tau;
      res.results.push(
        r('Shear modulus', 'G', G, 'GPa'),
        r('Torsion constant', 'J_T', p.J, 'mm⁴'),
        r('Torsional stiffness', 'K_z', G * p.J / i.L, 'Nm/rad'),
        r('Angle of twist', 'θ', i.T * i.L / (G * p.J), 'mrad'),
        r(p.tauNote ? 'Average shear stress' : 'Maximum shear stress', 'τ_max', tau, 'MPa'),
        r('Von Mises stress', 'σ_V', sv, 'MPa')
      );
      PEC.common.stressCheck(sv, i, res);
      if (p.tauNote) res.warnings.push('Thin-walled: ' + p.tauNote + '.');
      res.warnings.push('Assumes free warping. For clamped leaf springs see "Torsion of leaf springs: Restrained warping".');
      return res;
    }
  });

  // ---------------------------------------------------------------- Buckling
  var END = [
    { v: '2', label: 'Clamped – free (k = 2)' },
    { v: '1', label: 'Pinned – pinned (k = 1)' },
    { v: '1g', label: 'Clamped – guided, sway allowed (k = 1)' },
    { v: '2p', label: 'Pinned – guided, sway allowed (k = 2)' },
    { v: '0.7', label: 'Clamped – pinned (k = 0.7)' },
    { v: '0.5', label: 'Clamped – clamped (k = 0.5)' }
  ];
  PEC.register({
    id: 'buckling',
    title: 'Euler buckling',
    category: 'Beam theory',
    source: BASE + 'beam-theory-buckling/',
    description: 'Critical Euler buckling load of a column for the standard end conditions.',
    inputs: [
      { type: 'heading', label: 'Column' },
      { id: 'L', label: 'Length', sym: 'L', unit: 'mm', value: 200 },
      { id: 'k', label: 'End conditions', type: 'select', value: '2', options: END },
      { id: 'F', label: 'Applied axial force', sym: 'F', unit: 'N', value: 100 }
    ].concat(S.inputs('tube').map(function (f) {
      var d = { w: 10, h: 5 };
      return d[f.id] !== undefined ? Object.assign({}, f, { value: d[f.id] }) : f;
    })).concat(PEC.common.materialInputs({ nu: false }, 'Steel (stainless)')),
    formulas: [
      'F_b = π²·E·I / L_b²,  L_b = k·L',
      'I = min(Iₓ, I_y) (weakest axis)',
      'σ_b = F_b / A,  slenderness λ = L_b / √(I/A)',
      'Reinforced leaf spring: see Beam theory: Buckling'
    ],
    compute: function (i) {
      var s = sectionOf(i), p = S.props(s);
      var k = parseFloat(i.k), I = Math.min(p.Ix, p.Iy), Lb = k * i.L;
      var Fb = PI * PI * i.E * I / (Lb * Lb), sb = Fb / p.A;
      var res = { results: [], warnings: S.validate(s) };
      res.results.push(
        r('Buckling length', 'L_b', Lb, 'mm'),
        r('Smallest second moment of area', 'I_min', I, 'mm⁴'),
        r('Slenderness ratio', 'λ', Lb / Math.sqrt(I / p.A), '-'),
        r('Euler buckling load', 'F_b', Fb, 'N'),
        r('Stress at buckling load', 'σ_b', sb, 'MPa'),
        r('Safety against buckling', 'F_b / F', Fb / i.F, '-', { highlight: Fb / i.F < 1 ? 'bad' : 'good' }),
        r('Compressive stress at F', 'σ', i.F / p.A, 'MPa')
      );
      PEC.common.stressCheck(i.F / p.A, i, res);
      if (sb > i.sy) res.warnings.push('Stress at the Euler load exceeds the yield strength: the column yields before it buckles (Euler not valid).');
      if (i.F > Fb) res.warnings.push('Applied force exceeds the Euler buckling load.');
      return res;
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
