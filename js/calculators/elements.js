/*
 * Mass moment of inertia, kinematic coupling, bolt preload and press-fit calculators.
 * Calculators without a JPE article give `basis` (the standard or textbook they follow) instead of `source`.
 */
(function (root) {
  'use strict';
  var PEC = root.PEC, r = PEC.r, h = PEC.h, PI = Math.PI;
  var BASE = 'https://www.jpe-innovations.com/precision-point/';

  // ---------------------------------------------------------------- Mass moment of inertia
  PEC.register({
    id: 'mass-moment-of-inertia',
    title: 'Mass moment of inertia',
    category: 'Contact & dynamics',
    source: BASE + 'mass-moment-inertia/',
    description: 'Mass and mass moments of inertia of a cylinder, tube, block or sphere about its centre axes and about a parallel axis.',
    inputs: [
      { type: 'heading', label: 'Shape' },
      { id: 'shape', label: 'Body', type: 'select', value: 'cyl', options: [
        { v: 'cyl', label: 'Solid cylinder (rod, disc)' },
        { v: 'tube', label: 'Hollow cylinder (tube, ring)' },
        { v: 'block', label: 'Rectangular block' },
        { v: 'sphere', label: 'Solid sphere' }
      ] },
      { id: 'D', label: 'Outer diameter', sym: 'D', unit: 'mm', value: 50, showIf: { field: 'shape', values: ['cyl', 'tube', 'sphere'] } },
      { id: 'di', label: 'Inner diameter', sym: 'd', unit: 'mm', value: 30, showIf: { field: 'shape', values: ['tube'] } },
      { id: 'w', label: 'Width (along x)', sym: 'w', unit: 'mm', value: 40, showIf: { field: 'shape', values: ['block'] } },
      { id: 'hh', label: 'Height (along y)', sym: 'h', unit: 'mm', value: 20, showIf: { field: 'shape', values: ['block'] } },
      { id: 'L', label: 'Length (along z)', sym: 'L', unit: 'mm', value: 100, showIf: { field: 'shape', values: ['cyl', 'tube', 'block'] } },
      { type: 'heading', label: 'Mass' },
      { id: 'material', type: 'material', label: 'Preset (JPE table)', map: { rho: 'rho' }, value: 'Steel (carbon)' },
      { id: 'rho', label: 'Density', sym: 'ρ', unit: 'kg/m³', value: 7850 },
      { id: 'm', label: 'Mass (blank = from density)', sym: 'm', unit: 'kg', value: '', optional: true },
      { type: 'heading', label: 'Parallel axis' },
      { id: 'dp', label: 'Distance to a parallel axis (0 = none)', sym: 'd_p', unit: 'mm', value: 0, optional: true }
    ],
    formulas: function (v) {
      var f = {
        cyl: ['V = π·D²·L/4', 'J_z = m·D²/8', 'J_x = J_y = m·(3D²/4 + L²)/12'],
        tube: ['V = π·(D² − d²)·L/4', 'J_z = m·(D² + d²)/8', 'J_x = J_y = m·(3(D² + d²)/4 + L²)/12'],
        block: ['V = w·h·L', 'J_z = m·(w² + h²)/12', 'J_x = m·(h² + L²)/12', 'J_y = m·(w² + L²)/12'],
        sphere: ['V = π·D³/6', 'J_x = J_y = J_z = m·D²/10']
      }[v.shape] || [];
      return ['m = ρ·V (or the mass you enter)'].concat(f, ['Radius of gyration: k = √(J/m)', 'Parallel axis (Steiner): J\' = J + m·d_p²']);
    },
    compute: function (i) {
      var res = { results: [], warnings: [] }, s = i.shape, V, Jz, Jx, Jy;
      var D = i.D, d = i.di, L = i.L;
      if (s === 'tube' && !(d < D)) { res.warnings.push('The inner diameter must be smaller than the outer diameter.'); return res; }
      if (s === 'cyl') V = PI * D * D * L / 4;
      else if (s === 'tube') V = PI * (D * D - d * d) * L / 4;
      else if (s === 'block') V = i.w * i.hh * L;
      else V = PI * D * D * D / 6;
      var m = i.m > 0 ? i.m : i.rho * V;
      if (s === 'cyl') { Jz = m * D * D / 8; Jx = Jy = m * (3 * D * D / 4 + L * L) / 12; }
      else if (s === 'tube') { Jz = m * (D * D + d * d) / 8; Jx = Jy = m * (3 * (D * D + d * d) / 4 + L * L) / 12; }
      else if (s === 'block') { Jz = m * (i.w * i.w + i.hh * i.hh) / 12; Jx = m * (i.hh * i.hh + L * L) / 12; Jy = m * (i.w * i.w + L * L) / 12; }
      else Jz = Jx = Jy = m * D * D / 10;
      res.results.push(
        h('Mass'),
        r('Volume', 'V', V, 'cm³'),
        r('Mass', 'm', m, 'kg'),
        h('About the centre axes'),
        r('Moment of inertia about the z-axis', 'J_z', Jz, 'kg·mm²'),
        r('Moment of inertia about the x-axis', 'J_x', Jx, 'kg·mm²')
      );
      if (s === 'block') res.results.push(r('Moment of inertia about the y-axis', 'J_y', Jy, 'kg·mm²'));
      res.results.push(
        r('Radius of gyration about z', 'k_z', Math.sqrt(Jz / m), 'mm'),
        r('Radius of gyration about x', 'k_x', Math.sqrt(Jx / m), 'mm')
      );
      if (i.dp > 0) {
        res.results.push(
          h('About a parallel axis'),
          r('Parallel to the z-axis', "J_z'", Jz + m * i.dp * i.dp, 'kg·mm²'),
          r('Parallel to the x-axis', "J_x'", Jx + m * i.dp * i.dp, 'kg·mm²')
        );
      }
      if (i.m > 0) res.warnings.push('The mass you entered is used instead of density × volume.');
      return res;
    }
  });

  // ---------------------------------------------------------------- Kinematic coupling
  PEC.register({
    id: 'kinematic-coupling',
    title: 'Kinematic coupling preload',
    category: 'Contact & dynamics',
    basis: 'Hertz contact (K. L. Johnson, Contact Mechanics, 1985) applied to a three-groove kinematic coupling (A. H. Slocum, Precision Engineering 14, 1992).',
    description: 'Contact forces, Hertz pressure and stiffness of a three-ball, three-V-groove kinematic coupling under a vertical preload.',
    inputs: [
      { type: 'heading', label: 'Geometry' },
      { id: 'Db', label: 'Ball diameter', sym: 'D_b', unit: 'mm', value: 10 },
      { id: 'theta', label: 'Contact angle from vertical (45° for a 90° V-groove)', sym: 'θ', unit: 'deg', value: 45 },
      { id: 'Rc', label: 'Radius of the ball circle', sym: 'R_c', unit: 'mm', value: 50 },
      { type: 'heading', label: 'Materials' },
      { id: 'mat1', type: 'material', label: 'Ball material', map: { E: 'E1', nu: 'nu1' }, value: 'Steel (carbon)' },
      { id: 'E1', label: "Young's modulus ball", sym: 'E₁', unit: 'GPa', value: 210 },
      { id: 'nu1', label: "Poisson's ratio ball", sym: 'ν₁', unit: '-', value: 0.3 },
      { id: 'mat2', type: 'material', label: 'Groove material', map: { E: 'E2', nu: 'nu2' }, value: 'Steel (carbon)' },
      { id: 'E2', label: "Young's modulus groove", sym: 'E₂', unit: 'GPa', value: 210 },
      { id: 'nu2', label: "Poisson's ratio groove", sym: 'ν₂', unit: '-', value: 0.3 },
      { id: 'pAllow', label: 'Allowable contact pressure (blank = no check)', sym: 'p_allow', unit: 'MPa', value: '', optional: true },
      { type: 'heading', label: 'Load' },
      { id: 'F', label: 'Total vertical preload', sym: 'F', unit: 'N', value: 300 }
    ],
    formulas: [
      'E* = ((1 − ν₁²)/E₁ + (1 − ν₂²)/E₂)⁻¹,  R = D_b/2 (ball on a flat flank)',
      'Normal force per contact: N = F / (6·cos θ)',
      'a = ∛(3N·R / (4E*)),  p_max = 3N / (2π·a²),  δ = a²/R',
      'Contact stiffness: k_n = dN/dδ = 2E*·a',
      'Vertical: K_z = 6·k_n·cos²θ,  δ_z = δ / cos θ',
      'Horizontal (any direction): K_xy = 3·k_n·sin²θ',
      'Tilt: K_tilt = 3·k_n·cos²θ·R_c²,  rotation about z: K_rz = 6·k_n·sin²θ·R_c²'
    ],
    compute: function (i) {
      var res = { results: [], warnings: [] };
      var th = i.theta;
      if (!(th > 0 && th < PI / 2)) { res.warnings.push('The contact angle must lie between 0° and 90°.'); return res; }
      var c = Math.cos(th), s = Math.sin(th);
      var Es = 1 / ((1 - i.nu1 * i.nu1) / i.E1 + (1 - i.nu2 * i.nu2) / i.E2);
      var R = i.Db / 2, N = i.F / (6 * c);
      var a = Math.cbrt(3 * N * R / (4 * Es)), p = 3 * N / (2 * PI * a * a), d = a * a / R, kn = 2 * Es * a;
      res.results.push(
        h('Each contact'),
        r('Contact modulus', 'E*', Es, 'GPa'),
        r('Normal force per contact', 'N', N, 'N'),
        r('Contact radius', 'a', a, 'µm'),
        r('Maximum contact pressure', 'p_max', p, 'MPa'),
        r('Approach per contact', 'δ', d, 'µm'),
        r('Contact stiffness', 'k_n', kn, 'N/µm'),
        h('Coupling'),
        r('Vertical settling under preload', 'δ_z', d / c, 'µm'),
        r('Vertical stiffness', 'K_z', 6 * kn * c * c, 'N/µm'),
        r('Horizontal stiffness', 'K_xy', 3 * kn * s * s, 'N/µm'),
        r('Tilt stiffness', 'K_tilt', 3 * kn * c * c * i.Rc * i.Rc, 'Nm/mrad'),
        r('Rotational stiffness about z', 'K_rz', 6 * kn * s * s * i.Rc * i.Rc, 'Nm/mrad')
      );
      if (i.pAllow > 0) {
        res.results.push(r('Pressure utilisation', 'p_max/p_allow', p / i.pAllow, '%', { highlight: p > i.pAllow ? 'bad' : 'good' }));
        if (p > i.pAllow) res.warnings.push('The contact pressure exceeds the allowable pressure: use larger balls, a lower preload or harder materials.');
      }
      return res;
    }
  });

  // ---------------------------------------------------------------- Bolt preload and tightening torque
  // ISO 724 coarse threads: d, P, d2, d3 [mm]; socket head (ISO 4762) and hex head (ISO 4017) bearing
  // diameters and medium clearance holes (ISO 273) [mm].
  var THREADS = {
    M3: [3, 0.5, 2.675, 2.387, 5.5, 4.57, 3.4],
    M4: [4, 0.7, 3.545, 3.141, 7, 5.88, 4.5],
    M5: [5, 0.8, 4.480, 4.019, 8.5, 6.88, 5.5],
    M6: [6, 1, 5.350, 4.773, 10, 8.88, 6.6],
    M8: [8, 1.25, 7.188, 6.466, 13, 11.63, 9],
    M10: [10, 1.5, 9.026, 8.160, 16, 14.63, 11],
    M12: [12, 1.75, 10.863, 9.853, 18, 16.63, 13.5],
    M16: [16, 2, 14.701, 13.546, 24, 22.49, 17.5],
    M20: [20, 2.5, 18.376, 16.933, 30, 28.19, 22],
    M24: [24, 3, 22.051, 20.319, 36, 33.61, 26]
  };
  // Minimum yield strength R_p0.2 [MPa] per ISO 898-1 (8.8: 640 up to M16, 660 above).
  function yieldOf(cls, d) { return cls === '12.9' ? 1100 : cls === '10.9' ? 940 : (d > 16e-3 ? 660 : 640); }

  PEC.register({
    id: 'bolt-preload',
    title: 'Bolt preload & tightening torque',
    category: 'Joints & fasteners',
    basis: 'VDI 2230 Part 1 (2015), ISO 898-1 (property classes) and ISO 724 (thread dimensions).',
    description: 'Maximum assembly preload and tightening torque of a metric bolt, or the preload and stress from a given torque.',
    inputs: [
      { type: 'heading', label: 'Bolt' },
      { id: 'size', label: 'Thread (ISO metric coarse)', type: 'select', value: 'M8', options: Object.keys(THREADS).map(function (k) { return { v: k, label: k + ' × ' + THREADS[k][1] }; }) },
      { id: 'cls', label: 'Property class', type: 'select', value: '8.8', options: [
        { v: '8.8', label: '8.8' }, { v: '10.9', label: '10.9' }, { v: '12.9', label: '12.9' }
      ] },
      { id: 'head', label: 'Head', type: 'select', value: 'socket', options: [
        { v: 'socket', label: 'Socket head cap screw (ISO 4762)' },
        { v: 'hex', label: 'Hex head (ISO 4017)' }
      ] },
      { id: 'DKm', label: 'Head friction diameter (blank = from head and medium clearance hole)', sym: 'D_Km', unit: 'mm', value: '', optional: true },
      { type: 'heading', label: 'Friction & tightening' },
      { id: 'muG', label: 'Thread friction', sym: 'µ_G', unit: '-', value: 0.12 },
      { id: 'muK', label: 'Head friction', sym: 'µ_K', unit: '-', value: 0.12 },
      { id: 'util', label: 'Utilisation of the yield strength', sym: 'ν', unit: '%', value: 90 },
      { id: 'T', label: 'Tightening torque to check (optional)', sym: 'M_A', unit: 'Nm', value: '', optional: true }
    ],
    formulas: [
      'd_s = (d₂ + d₃)/2,  A_s = π·d_s²/4',
      'F_M,zul = A_s·ν·R_p0.2 / √(1 + 3·[3/2·(d₂/d_s)·(P/(π·d₂) + 1.155·µ_G)]²)',
      'M_A = F_M·(0.16·P + 0.58·d₂·µ_G + µ_K·D_Km/2)',
      'D_Km = (d_w + d_h)/2 (head bearing diameter and clearance hole)',
      'For a given torque: F_M = M_A / (0.16·P + 0.58·d₂·µ_G + µ_K·D_Km/2)',
      'σ_M = F_M/A_s,  τ_M = F_M·d₂/2·(P/(π·d₂) + 1.155·µ_G) / (π·d_s³/12),  σ_red = √(σ_M² + 3τ_M²)'
    ],
    compute: function (i) {
      var res = { results: [], warnings: [] };
      var t = THREADS[i.size] || THREADS.M8;
      var d = t[0] * 1e-3, P = t[1] * 1e-3, d2 = t[2] * 1e-3, d3 = t[3] * 1e-3;
      var dw = (i.head === 'hex' ? t[5] : t[4]) * 1e-3, dh = t[6] * 1e-3;
      var DKm = i.DKm > 0 ? i.DKm : (dw + dh) / 2;
      // Torsion with the plastic section modulus π·d_s³/12, as in the VDI 2230 F_M,zul formula (factor 3/2).
      var ds = (d2 + d3) / 2, As = PI * ds * ds / 4, Wp = PI * ds * ds * ds / 12;
      var Rp = yieldOf(i.cls, d) * 1e6;
      var g = P / (PI * d2) + 1.155 * i.muG;
      var Fm = As * i.util * Rp / Math.sqrt(1 + 3 * Math.pow(1.5 * d2 / ds * g, 2));
      var kP = 0.16 * P, kG = 0.58 * d2 * i.muG, kK = i.muK * DKm / 2, k = kP + kG + kK;
      res.results.push(
        h('Bolt data'),
        r('Pitch diameter', 'd₂', d2, 'mm'),
        r('Tensile stress area', 'A_s', As, 'mm²'),
        r('Minimum yield strength', 'Rp₀.₂', Rp, 'MPa'),
        r('Head friction diameter', 'D_Km', DKm, 'mm'),
        h('At the chosen yield utilisation'),
        r('Maximum assembly preload', 'F_Mzul', Fm, 'kN'),
        r('Tightening torque', 'M_A', Fm * k, 'Nm'),
        r('Share of torque: thread pitch', 'M_P', kP / k, '%'),
        r('Share of torque: thread friction', 'M_G', kG / k, '%'),
        r('Share of torque: head friction', 'M_K', kK / k, '%')
      );
      if (i.T > 0) {
        var F = i.T / k, sig = F / As, tau = F * d2 / 2 * g / Wp, red = Math.sqrt(sig * sig + 3 * tau * tau);
        res.results.push(
          h('At the torque to check'),
          r('Preload', 'F_M', F, 'kN'),
          r('Tensile stress', 'σ_M', sig, 'MPa'),
          r('Torsional stress', 'τ_M', tau, 'MPa'),
          r('Equivalent stress', 'σ_red', red, 'MPa'),
          r('Utilisation of the yield strength', 'σ_red/Rp₀.₂', red / Rp, '%', { highlight: red > Rp ? 'bad' : 'good' })
        );
        if (red > Rp) res.warnings.push('The bolt yields during tightening at this torque.');
      }
      if (i.util > 1) res.warnings.push('A utilisation above 100 % tightens the bolt past its yield strength.');
      if (i.muG < 0.08 || i.muK < 0.08) res.warnings.push('Friction below 0.08 is unusual without special lubricants; check the value.');
      return res;
    }
  });

  // ---------------------------------------------------------------- Press fit
  PEC.register({
    id: 'press-fit',
    title: 'Press fit (interference fit)',
    category: 'Joints & fasteners',
    basis: 'DIN 7190-1 (2017) and the thick-walled cylinder (Lamé) equations, elastic range.',
    description: 'Joint pressure, stresses, transmissible torque and axial force of a shaft pressed into a hub.',
    inputs: [
      { type: 'heading', label: 'Geometry' },
      { id: 'DF', label: 'Joint diameter', sym: 'D_F', unit: 'mm', value: 30 },
      { id: 'Di', label: 'Shaft bore diameter (0 = solid shaft)', sym: 'D_i', unit: 'mm', value: 0, optional: true },
      { id: 'Da', label: 'Hub outer diameter', sym: 'D_a', unit: 'mm', value: 60 },
      { id: 'L', label: 'Joint length', sym: 'L_F', unit: 'mm', value: 30 },
      { type: 'heading', label: 'Interference' },
      { id: 'U', label: 'Diametral interference (measured)', sym: 'U', unit: 'µm', value: 40 },
      { id: 'RzI', label: 'Shaft roughness', sym: 'Rz_i', unit: 'µm', value: 4 },
      { id: 'RzA', label: 'Hub bore roughness', sym: 'Rz_a', unit: 'µm', value: 4 },
      { id: 'mu', label: 'Friction coefficient (slip)', sym: 'µ', unit: '-', value: 0.12 },
      { type: 'heading', label: 'Shaft material' },
      { id: 'matI', type: 'material', label: 'Shaft preset (JPE table)', map: { E: 'Ei', nu: 'nui', sy: 'syi' }, value: 'Steel (carbon)' },
      { id: 'Ei', label: "Young's modulus shaft", sym: 'E_i', unit: 'GPa', value: 210 },
      { id: 'nui', label: "Poisson's ratio shaft", sym: 'ν_i', unit: '-', value: 0.3 },
      { id: 'syi', label: 'Yield strength shaft', sym: 'R_ei', unit: 'MPa', value: 300 },
      { type: 'heading', label: 'Hub material' },
      { id: 'matA', type: 'material', label: 'Hub preset (JPE table)', map: { E: 'Ea', nu: 'nua', sy: 'sya' }, value: 'Aluminum 7075-T6' },
      { id: 'Ea', label: "Young's modulus hub", sym: 'E_a', unit: 'GPa', value: 72 },
      { id: 'nua', label: "Poisson's ratio hub", sym: 'ν_a', unit: '-', value: 0.33 },
      { id: 'sya', label: 'Yield strength hub', sym: 'R_ea', unit: 'MPa', value: 460 }
    ],
    formulas: [
      'Effective interference (smoothing): Z = U − 0.8·(Rz_i + Rz_a)',
      'Q_a = D_F/D_a,  Q_i = D_i/D_F',
      'p = Z / (D_F·[(1/E_a)·((1 + Q_a²)/(1 − Q_a²) + ν_a) + (1/E_i)·((1 + Q_i²)/(1 − Q_i²) − ν_i)])',
      'Hub bore: σ_t = p·(1 + Q_a²)/(1 − Q_a²),  σ_r = −p,  σ_v = 2p/(1 − Q_a²)',
      'Hub outside: σ_t = 2p·Q_a²/(1 − Q_a²),  ΔD_a = D_a·σ_t/E_a',
      'Shaft: σ_v = p (solid) or 2p/(1 − Q_i²) at the bore (hollow)',
      'M_t = µ·p·π·D_F²·L_F/2,  F_ax = µ·p·π·D_F·L_F'
    ],
    compute: function (i) {
      var res = { results: [], warnings: [] };
      var DF = i.DF, Di = i.Di > 0 ? i.Di : 0;
      if (!(i.Da > DF) || !(Di < DF)) { res.warnings.push('The diameters must satisfy D_i < D_F < D_a.'); return res; }
      var Z = i.U - 0.8 * (i.RzI + i.RzA);
      var Qa = DF / i.Da, Qi = Di / DF;
      var K = ((1 + Qa * Qa) / (1 - Qa * Qa) + i.nua) / i.Ea + ((1 + Qi * Qi) / (1 - Qi * Qi) - i.nui) / i.Ei;
      var p = Math.max(Z, 0) / (DF * K);
      var svA = 2 * p / (1 - Qa * Qa), stOut = 2 * p * Qa * Qa / (1 - Qa * Qa);
      var svI = Di > 0 ? 2 * p / (1 - Qi * Qi) : p;
      res.results.push(
        h('Joint'),
        r('Effective interference', 'Z', Z, 'µm'),
        r('Joint pressure', 'p', p, 'MPa'),
        r('Transmissible torque', 'M_t', i.mu * p * PI * DF * DF * i.L / 2, 'Nm'),
        r('Transmissible axial force', 'F_ax', i.mu * p * PI * DF * i.L, 'kN'),
        h('Hub'),
        r('Tangential stress at the bore', 'σ_ta', p * (1 + Qa * Qa) / (1 - Qa * Qa), 'MPa'),
        r('Equivalent stress at the bore', 'σ_va', svA, 'MPa'),
        r('Utilisation of the hub yield strength', 'σ_va/R_ea', svA / i.sya, '%', { highlight: svA > i.sya ? 'bad' : 'good' }),
        r('Growth of the outer diameter', 'ΔD_a', i.Da * stOut / i.Ea, 'µm'),
        h('Shaft'),
        r('Equivalent stress', 'σ_vi', svI, 'MPa'),
        r('Utilisation of the shaft yield strength', 'σ_vi/R_ei', svI / i.syi, '%', { highlight: svI > i.syi ? 'bad' : 'good' })
      );
      if (Z <= 0) res.warnings.push('The roughness smoothing uses up all of the interference: the joint has no pressure.');
      if (svA > i.sya || svI > i.syi) res.warnings.push('Above the yield strength: the joint deforms plastically and the elastic equations no longer hold.');
      return res;
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
