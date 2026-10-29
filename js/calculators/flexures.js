/*
 * Flexure calculators: leaf spring, rod spring, folded leaf spring, elastic (notch) hinge, cross spring pivot.
 */
(function (root) {
  'use strict';
  var PEC = root.PEC, r = PEC.r, h = PEC.h, PI = Math.PI;
  var BASE = 'https://www.jpe-innovations.com/precision-point/';

  function buckling(E, I, L, shape) {
    var k = shape === 'S' ? 1 : 2;
    return { Lb: k * L, Fb: PI * PI * E * I / Math.pow(k * L, 2) };
  }

  // ---------------------------------------------------------------- Leaf spring
  PEC.register({
    id: 'leaf-spring',
    title: 'Leaf spring',
    category: 'Flexures',
    source: BASE + 'flexure-engineering-fundamental-leaf-spring/',
    description: 'Stiffness in all six directions, stress and stroke of a straight leaf spring in S-shape (guided end) or C-shape (free end) deformation.',
    corrections: [
      { text: 'C_y differs from the JPE article. JPE uses bending only (E·t·b³/L³). In the width direction b is often comparable to L, so shear deformation adds a compliance of 12(1+ν)·L/(5·E·b·t) (Timoshenko beam, shear coefficient κ = 5/6). For a 20 mm long, 10 mm wide spring this lowers C_y to about 56 % of the JPE value. Both values are shown.', refs: ['timoshenko', 'cowper', 'roark'] }
    ],
    inputs: [
      { type: 'heading', label: 'Geometry' },
      { id: 'shape', label: 'Deformation shape', type: 'select', value: 'S', options: [
        { v: 'S', label: 'S-shape (end guided, rotation fixed)' },
        { v: 'C', label: 'C-shape (end free to rotate)' }
      ] },
      { id: 'L', label: 'Length', sym: 'L', unit: 'mm', value: 20 },
      { id: 'b', label: 'Width', sym: 'b', unit: 'mm', value: 10 },
      { id: 't', label: 'Thickness', sym: 't', unit: 'mm', value: 0.3 },
      { id: 'Rx', label: 'Rotation Rₓ of the end (for C_y)', type: 'select', value: 'fixed', options: [
        { v: 'fixed', label: 'Rₓ fixed' }, { v: 'free', label: 'Rₓ free' }
      ], showIf: { field: 'shape', values: ['S'] } }
    ].concat(PEC.common.materialInputs({}, 'Steel (spring)')).concat([
      { type: 'heading', label: 'Load case' },
      { id: 'ux', label: 'Deflection in compliant direction', sym: 'uₓ', unit: 'mm', value: 0.3 }
    ]),
    formulas: function (v) {
      var S = v.shape === 'S';
      return [
        S ? 'Cₓ = E·b·t³ / L³' : 'Cₓ = E·b·t³ / (4L³)',
        S && v.Rx === 'fixed' ? 'C_y = 1 / (L³/(E·t·b³) + 12(1+ν)·L/(5·E·b·t))  (bending + shear, κ = 5/6)' : 'C_y = 1 / (4L³/(E·t·b³) + 12(1+ν)·L/(5·E·b·t))  (bending + shear, κ = 5/6)',
        S && v.Rx === 'fixed' ? 'C_y,JPE = E·t·b³ / L³  (bending only)' : 'C_y,JPE = E·t·b³ / (4L³)  (bending only)',
        'C_z = E·A / L  (uₓ = 0)',
        S ? 'C_z = 700·E·A·I / (L·(700·I + uₓ²·A))  (uₓ ≠ 0)' : null,
        'Kₓ = E·t·b³ / (12L),  K_y = E·b·t³ / (12L)',
        'K_z = G·b·t³ / (3L) = E·b·t³ / (6(1+ν)L)',
        S ? 'σ_max = Fₓ·L·t / (4I)' : 'σ_max = Fₓ·L·t / (2I)',
        S ? 'uₓ,max = (1/3)·L²·σ_max / (E·t)' : 'uₓ,max = (2/3)·L²·σ_max / (E·t)',
        'u_z = (3/5)·uₓ² / L  (parasitic shortening)',
        'F_b = π²·E·I / L_b²,  L_b = ' + (S ? 'L' : '2L') + '  (Beam theory: Buckling)'
      ].filter(Boolean);
    },
    compute: function (i) {
      var S = i.shape === 'S';
      var E = i.E, L = i.L, b = i.b, t = i.t, A = b * t, I = b * t * t * t / 12;
      var Cx = S ? E * b * Math.pow(t, 3) / Math.pow(L, 3) : E * b * Math.pow(t, 3) / (4 * Math.pow(L, 3));
      // Width direction: b is often not small compared with L, so shear deformation is added (Timoshenko, κ = 5/6).
      var CyJPE = (S && i.Rx === 'fixed') ? E * t * Math.pow(b, 3) / Math.pow(L, 3) : E * t * Math.pow(b, 3) / (4 * Math.pow(L, 3));
      var Cy = 1 / (1 / CyJPE + 12 * (1 + i.nu) * L / (5 * E * b * t));
      var Cz0 = E * A / L;
      var Kx = E * t * Math.pow(b, 3) / (12 * L), Ky = E * b * Math.pow(t, 3) / (12 * L), Kz = E * b * Math.pow(t, 3) / (6 * (1 + i.nu) * L);
      var Fx = Cx * i.ux;
      var sigma = S ? Fx * L * t / (4 * I) : Fx * L * t / (2 * I);
      var sa = PEC.common.allowable(i);
      var uxMax = (S ? 1 / 3 : 2 / 3) * L * L * sa / (E * t);
      var bk = buckling(E, I, L, i.shape);
      var res = { results: [], warnings: [] };
      res.results.push(
        h('Stiffness'),
        r('Stiffness in x (compliant)', 'Cₓ', Cx, 'N/mm'),
        r('Stiffness in y (width direction, incl. shear)', 'C_y', Cy, 'N/µm'),
        r('Stiffness in y, JPE formula (bending only)', 'C_y,JPE', CyJPE, 'N/µm'),
        r('Axial stiffness at uₓ = 0', 'C_z', Cz0, 'N/µm')
      );
      if (S) res.results.push(r('Axial stiffness at uₓ', 'C_z(uₓ)', 700 * E * A * I / (L * (700 * I + i.ux * i.ux * A)), 'N/µm'));
      res.results.push(
        r('Rotational stiffness about x', 'Kₓ', Kx, 'Nm/rad'),
        r('Rotational stiffness about y', 'K_y', Ky, 'Nm/rad'),
        r('Torsional stiffness about z', 'K_z', Kz, 'Nm/rad'),
        h('Load case'),
        r('Force for deflection uₓ', 'Fₓ', Fx, 'N'),
        r('Maximum bending stress', 'σ_max', sigma, 'MPa')
      );
      PEC.common.stressCheck(sigma, i, res);
      res.results.push(
        r('Maximum stroke at allowable stress', 'uₓ,max', uxMax, 'mm'),
        r('Parasitic axial shortening', 'u_z', 0.6 * i.ux * i.ux / L, 'µm'),
        h('Buckling (axial compression)'),
        r('Buckling length', 'L_b', bk.Lb, 'mm'),
        r('Euler buckling load', 'F_b', bk.Fb, 'N')
      );
      if (L / t < 10) res.warnings.push('L/t < 10: slender beam theory becomes inaccurate.');
      if (b / L > 0.2) res.warnings.push('b/L > 0.2: shear lowers C_y noticeably below the JPE (bending only) value.');
      if (i.ux > uxMax) res.warnings.push('Deflection exceeds the stroke allowed by the stress limit.');
      return res;
    }
  });

  // ---------------------------------------------------------------- Rod spring
  PEC.register({
    id: 'rod-spring',
    title: 'Rod spring (wire flexure)',
    category: 'Flexures',
    source: BASE + 'rod-spring/',
    description: 'Stiffness, stress and stroke of a round rod (wire) flexure in S-shape or C-shape deformation.',
    inputs: [
      { type: 'heading', label: 'Geometry' },
      { id: 'shape', label: 'Deformation shape', type: 'select', value: 'S', options: [
        { v: 'S', label: 'S-shape (end guided)' }, { v: 'C', label: 'C-shape (end free)' }
      ] },
      { id: 'L', label: 'Length', sym: 'L', unit: 'mm', value: 15 },
      { id: 'd', label: 'Diameter', sym: 'd', unit: 'mm', value: 1 }
    ].concat(PEC.common.materialInputs({}, 'Steel (spring)')).concat([
      { type: 'heading', label: 'Load case' },
      { id: 'ux', label: 'Lateral deflection', sym: 'uₓ', unit: 'mm', value: 0.05 }
    ]),
    formulas: function (v) {
      var S = v.shape === 'S';
      return [
        'I = π·d⁴/64,  A = π·d²/4',
        S ? 'Cₓ = C_y = 12·E·I / L³' : 'Cₓ = C_y = 3·E·I / L³',
        'C_z = E·A / L  (uₓ = 0)',
        S ? 'C_z = 1 / (L/(E·A) + uₓ²·L/(700·E·I))  (uₓ ≠ 0)' : null,
        'Kₓ = K_y = E·I / L',
        'K_z = G·π·d⁴ / (32L) = E·π·d⁴ / (64(1+ν)L)',
        S ? 'σ_max = Fₓ·L·d / (4I)' : 'σ_max = Fₓ·L·d / (2I)',
        S ? 'uₓ,max = (1/3)·L²·σ_max / (E·d)' : 'uₓ,max = (2/3)·L²·σ_max / (E·d)',
        'u_z = (3/5)·uₓ² / L',
        'F_b = π²·E·I / L_b²,  L_b = ' + (S ? 'L' : '2L')
      ].filter(Boolean);
    },
    compute: function (i) {
      var S = i.shape === 'S', E = i.E, L = i.L, d = i.d;
      var I = PI * Math.pow(d, 4) / 64, A = PI * d * d / 4;
      var Cx = (S ? 12 : 3) * E * I / Math.pow(L, 3);
      var Fx = Cx * i.ux;
      var sigma = (S ? 1 / 4 : 1 / 2) * Fx * L * d / I;
      var sa = PEC.common.allowable(i);
      var bk = buckling(E, I, L, i.shape);
      var res = { results: [], warnings: [] };
      res.results.push(
        h('Stiffness'),
        r('Lateral stiffness', 'Cₓ = C_y', Cx, 'N/mm'),
        r('Axial stiffness at uₓ = 0', 'C_z', E * A / L, 'N/µm')
      );
      if (S) res.results.push(r('Axial stiffness at uₓ', 'C_z(uₓ)', 1 / (L / (E * A) + i.ux * i.ux * L / (700 * E * I)), 'N/µm'));
      res.results.push(
        r('Bending stiffness', 'Kₓ = K_y', E * I / L, 'Nm/rad'),
        r('Torsional stiffness', 'K_z', E * PI * Math.pow(d, 4) / (64 * (1 + i.nu) * L), 'Nm/rad'),
        h('Load case'),
        r('Force for deflection uₓ', 'Fₓ', Fx, 'N'),
        r('Maximum bending stress', 'σ_max', sigma, 'MPa')
      );
      PEC.common.stressCheck(sigma, i, res);
      res.results.push(
        r('Maximum stroke at allowable stress', 'uₓ,max', (S ? 1 / 3 : 2 / 3) * L * L * sa / (E * d), 'mm'),
        r('Parasitic axial shortening', 'u_z', 0.6 * i.ux * i.ux / L, 'µm'),
        h('Buckling (axial compression)'),
        r('Euler buckling load', 'F_b', bk.Fb, 'N')
      );
      if (L / d < 10) res.warnings.push('L/d < 10: slender beam theory becomes inaccurate.');
      return res;
    }
  });

  // ---------------------------------------------------------------- Folded leaf spring
  PEC.register({
    id: 'folded-leaf-spring',
    title: 'Folded leaf spring',
    category: 'Flexures',
    source: BASE + 'flexure-engineering-fundamental-folded-leaf-spring/',
    description: 'Displacement, stiffness and stress of an L-shaped (folded) leaf spring loaded at its free end by a force at angle θ.',
    corrections: [
      { text: 'C_z differs from the JPE article. The shear term uses the shear coefficient κ = 5/6 for a rectangular section, where JPE uses the full area (κ = 1), which understates the shear compliance by about 17 %. As in JPE, C_z only holds when the end cannot rotate (for example three folded springs in a tangential arrangement) and torsion of leg 1 is neglected. With a truly free end, an out-of-plane force twists leg 1 and the stiffness is much lower.', refs: ['timoshenko', 'cowper'] }
    ],
    inputs: [
      { type: 'heading', label: 'Geometry' },
      { id: 'L1', label: 'Length of leg 1 (vertical)', sym: 'L₁', unit: 'mm', value: 20 },
      { id: 'L2', label: 'Length of leg 2 (horizontal)', sym: 'L₂', unit: 'mm', value: 20 },
      { id: 'b', label: 'Width', sym: 'b', unit: 'mm', value: 10 },
      { id: 't', label: 'Thickness', sym: 't', unit: 'mm', value: 0.5 }
    ].concat(PEC.common.materialInputs({}, 'Steel (spring)')).concat([
      { type: 'heading', label: 'Load' },
      { id: 'F', label: 'Force at free end', sym: 'F', unit: 'N', value: 2 },
      { id: 'theta', label: 'Force angle (from x-axis)', sym: 'θ', unit: 'deg', value: 0 }
    ]),
    formulas: [
      'Fₓ = F·cos θ,  F_y = F·sin θ,  I = b·t³/12',
      'δsₓ = L₁²/(E·I)·(Fₓ·L₁/3 − F_y·L₂/2)',
      'δs_y = L₂/(E·I)·(F_y·L₂²/3 + F_y·L₁·L₂ − Fₓ·L₁²/2)',
      'δs_abs = √(δsₓ² + δs_y²),  δs_proj = δs_abs·cos(θ − φ)',
      'C_abs = F/δs_abs,  C_proj = F/|δs_proj|',
      'M_vert(y) = Fₓ·L₁ − F_y·L₂ − Fₓ·y,  M_hor(x) = F_y·L₂ − F_y·x',
      'σ_max = |M_max|·(t/2) / I',
      'Guided end, L₁ = L₂ = L: C = (15/2)·E·I/L³,  C(θ) = C·(1 + (3/5)·sin 2θ)',
      'C_z = E·t·b³ / ((L₁+L₂)³ + (12/5)·b²(L₁+L₂)(1+ν))  (guided end, κ = 5/6, torsion of leg 1 neglected)'
    ],
    compute: function (i) {
      var E = i.E, I = i.b * Math.pow(i.t, 3) / 12, L1 = i.L1, L2 = i.L2;
      var Fx = i.F * Math.cos(i.theta), Fy = i.F * Math.sin(i.theta);
      var dx = L1 * L1 / (E * I) * (Fx * L1 / 3 - Fy * L2 / 2);
      var dy = L2 / (E * I) * (Fy * L2 * L2 / 3 + Fy * L1 * L2 - Fx * L1 * L1 / 2);
      var dabs = Math.sqrt(dx * dx + dy * dy);
      var phi = Math.atan2(dy, dx);
      var dproj = dabs * Math.cos(i.theta - phi);
      var Mmax = Math.max(Math.abs(Fx * L1 - Fy * L2), Math.abs(Fy * L2));
      var sigma = Mmax * (i.t / 2) / I;
      var Lt = L1 + L2;
      // Bending + shear of both legs as one plate, shear coefficient κ = 5/6 (JPE uses the full area).
      var Cz = E * i.t * Math.pow(i.b, 3) / (Math.pow(Lt, 3) + 2.4 * i.b * i.b * Lt * (1 + i.nu));
      var res = { results: [], warnings: [] };
      res.results.push(
        h('Displacement of the free end'),
        r('Displacement in x', 'δsₓ', dx, 'µm'),
        r('Displacement in y', 'δs_y', dy, 'µm'),
        r('Absolute displacement', 'δs_abs', dabs, 'µm'),
        r('Direction of displacement', 'φ', phi, 'deg'),
        r('Displacement in force direction', 'δs_proj', dproj, 'µm'),
        h('Stiffness'),
        r('Absolute stiffness (bidirectional)', 'C_abs', i.F / dabs, 'N/mm'),
        r('Projected stiffness (unidirectional)', 'C_proj', i.F / Math.abs(dproj), 'N/mm'),
        r('Stiffness out of plane, guided end (stiff direction)', 'C_z', Cz, 'N/µm')
      );
      if (Math.abs(L1 - L2) < 1e-12) {
        var Cg = 7.5 * E * I / Math.pow(L1, 3);
        res.results.push(r('Guided-end stiffness at θ', 'C(θ)', Cg * (1 + 0.6 * Math.sin(2 * i.theta)), 'N/mm'));
      }
      res.results.push(
        h('Stress'),
        r('Maximum bending moment', '|M_max|', Mmax, 'Nmm'),
        r('Maximum bending stress', 'σ_max', sigma, 'MPa')
      );
      PEC.common.stressCheck(sigma, i, res);
      return res;
    }
  });

  // ---------------------------------------------------------------- Elastic hinge
  PEC.register({
    id: 'flexure-hinge',
    title: 'Elastic (notch) hinge',
    category: 'Flexures',
    source: BASE + 'flexure-hinge-elastic-hinge/',
    description: 'Stiffness of a circular notch hinge at the hinge (A) and at a lever point B, maximum stress and maximum rotation.',
    inputs: [
      { type: 'heading', label: 'Geometry' },
      { id: 'd1', label: 'Notch cutting diameter, side 1', sym: 'd₁', unit: 'mm', value: 5, hint: 'Diameter of the circular cut' },
      { id: 'd2', label: 'Notch cutting diameter, side 2', sym: 'd₂', unit: 'mm', value: 5, hint: '0 = straight (flat) side' },
      { id: 'h', label: 'Minimum hinge thickness', sym: 'h', unit: 'mm', value: 0.3 },
      { id: 't', label: 'Hinge width (depth)', sym: 't', unit: 'mm', value: 10 },
      { id: 'L', label: 'Distance hinge A → point B', sym: 'L', unit: 'mm', value: 20 }
    ].concat(PEC.common.materialInputs({}, 'Aluminum 7075-T6')).concat([
      { type: 'heading', label: 'Load case' },
      { id: 'Ry', label: 'Hinge rotation', sym: 'R_y', unit: 'mrad', value: 10 }
    ]),
    formulas: [
      'D = 2·d₁·d₂ / (d₁ + d₂),  D = 2·d₁ for a straight side (d₂ → ∞),  β = h/D',
      'C_Ax = 0.48·E·t·√(h/D)',
      'C_Ay ≈ G·h·t / D = E·h·t / (2D(1+ν))  (rough estimate)',
      'C_Az = 0.56·E·t·√(h/D) · 1/(1.2 + D/h)',
      'K_Ax = t²·C_Az/12 = 0.047·E·t³·√(h/D)·1/(1.2 + D/h)',
      'K_Ay = 0.093·E·t·h²·√(h/D)',
      'K_Az = t²·C_Ax/12 = 0.04·E·t³·√(h/D)',
      'C_Bx = C_Ax,  1/C_By = 1/C_Ay + L²/K_Az,  1/C_Bz = 1/C_Az + L²/K_Ay',
      'σ_max ≈ 0.58·E·√(h/D)·R_y,  F_z = R_y·K_Ay / L',
      'Realistic range 0.01 < β < 0.5'
    ],
    compute: function (i) {
      var E = i.E, hh = i.h, t = i.t, L = i.L;
      var d1 = PEC.inf(i.d1), d2 = PEC.inf(i.d2);
      var D = !isFinite(d1) && !isFinite(d2) ? Infinity : (!isFinite(d2) ? 2 * d1 : (!isFinite(d1) ? 2 * d2 : 2 * d1 * d2 / (d1 + d2)));
      var beta = hh / D, sb = Math.sqrt(beta);
      var CAx = 0.48 * E * t * sb;
      var CAy = E * hh * t / (2 * D * (1 + i.nu));
      var CAz = 0.56 * E * t * sb / (1.2 + 1 / beta);
      var KAx = t * t * CAz / 12;
      var KAy = 0.093 * E * t * hh * hh * sb;
      var KAz = t * t * CAx / 12;
      var CBy = CAy * KAz / (KAz + CAy * L * L);
      var CBz = CAz * KAy / (KAy + CAz * L * L);
      var sigma = 0.58 * E * sb * i.Ry;
      var sa = PEC.common.allowable(i);
      var res = { results: [], warnings: [] };
      res.results.push(
        h('Geometry'),
        r('Effective hinge length', 'D', D, 'mm'),
        r('Hinge parameter', 'β = h/D', beta, '-'),
        h('Stiffness at hinge A'),
        r('Stiffness in x', 'C_Ax', CAx, 'N/µm'),
        r('Stiffness in y (rough estimate)', 'C_Ay', CAy, 'N/µm'),
        r('Stiffness in z', 'C_Az', CAz, 'N/µm'),
        r('Rotational stiffness about x', 'K_Ax', KAx, 'Nm/rad'),
        r('Rotational stiffness about y (hinge axis)', 'K_Ay', KAy, 'Nm/rad'),
        r('Rotational stiffness about z', 'K_Az', KAz, 'Nm/rad'),
        h('Stiffness at point B'),
        r('Stiffness in x', 'C_Bx', CAx, 'N/µm'),
        r('Stiffness in y', 'C_By', CBy, 'N/µm'),
        r('Stiffness in z (actuation direction)', 'C_Bz', CBz, 'N/mm'),
        h('Load case'),
        r('Force at B for rotation R_y', 'F_z', i.Ry * KAy / L, 'N'),
        r('Displacement of B', 'u_z', i.Ry * L, 'µm'),
        r('Moment at hinge', 'M_y', i.Ry * KAy, 'Nmm'),
        r('Maximum stress', 'σ_max', sigma, 'MPa')
      );
      PEC.common.stressCheck(sigma, i, res);
      res.results.push(r('Maximum rotation at allowable stress', 'R_y,max', sa / (0.58 * E * sb), 'mrad'));
      if (beta < 0.01) res.warnings.push('β < 0.01: limited by manufacturability.');
      if (beta > 0.5) res.warnings.push('β > 0.5: hinge functionality is lost; formulas are outside their range.');
      return res;
    }
  });

  // ---------------------------------------------------------------- Cross spring pivot
  PEC.register({
    id: 'cross-spring-pivot',
    title: 'Cross spring pivot',
    category: 'Flexures',
    source: BASE + 'cross-spring-pivot/',
    description: 'Rotational stiffness, buckling load, rolling radius and maximum angle of a cross spring pivot with the pole at a·L.',
    corrections: [
      { text: 'Stress and maximum angle for the chosen pole position are added; JPE gives them only for the reference a = 0.5. A leaf rotating about a pole at a·L carries end moments (4 − 6a)·E·I·θ/L and (6a − 2)·E·I·θ/L, so the stress is n = max(|4 − 6a|, |6a − 2|) times the reference stress (n = 3.24 at a = 0.5 ± √5/6, which JPE rounds to 3.3).', refs: ['wittrick', 'soemers'] },
      { text: 'JPE writes F_b,ref = 8π²·E·I/L² = π²·E·b·t³/(3L²), but with I = b·t³/12 the two expressions differ by a factor 2. The calculator keeps 8π²·E·I/L², two leaves each buckling with both ends clamped (4π²·E·I/L² per leaf); JPE\'s second expression equals a single leaf.', refs: ['haringx', 'timoshenko'] }
    ],
    inputs: [
      { type: 'heading', label: 'Geometry (per leaf spring)' },
      { id: 'L', label: 'Leaf spring length', sym: 'L', unit: 'mm', value: 20 },
      { id: 'w', label: 'Leaf spring width', sym: 'w', unit: 'mm', value: 10 },
      { id: 't', label: 'Leaf spring thickness', sym: 't', unit: 'mm', value: 0.3 },
      { id: 'a', label: 'Pole location (fraction of L)', sym: 'a', unit: '-', value: 0.5 }
    ].concat(PEC.common.materialInputs({}, 'Steel (spring)')).concat([
      { type: 'heading', label: 'Load case' },
      { id: 'theta', label: 'Rotation angle', sym: 'θ', unit: 'mrad', value: 20 }
    ]),
    formulas: [
      'I = w·t³/12 (single leaf spring)',
      'K_z = 8·(1 − 3a + 3a²)·E·I / L',
      'K_ref = 2·E·I / L = E·w·t³ / (6L)  (a = 0.5)',
      'F_b,ref = 8·π²·E·I / L² = 2π²·E·w·t³ / (3L²)',
      'θ_ref = 2·σ_max·L / (E·t)',
      'n = max(|4 − 6a|, |6a − 2|)  (end moment of a leaf relative to a = 0.5)',
      'σ = n·E·t·θ / (2L),  θ_max = θ_ref / n',
      'ρ/L = −(√2/30)·(36·(a − 0.5)² − 5)  (equivalent rolling radius)',
      'Classical double symmetric (a = 0.5, total width w): K = 0.5·K_ref, F_b = 0.5·F_b,ref, θ_max = θ_ref',
      'Special classical, a = 0.5 ± √5/6 (ρ = 0): K = 2.67·K_ref, F_b = 0.5·F_b,ref, θ_max = θ_ref/3.3',
      '"Haberland" cross spring (ρ/L = −0.047): K = 4·K_ref, F_b = F_b,ref, θ_max = θ_ref/4'
    ],
    compute: function (i) {
      var E = i.E, L = i.L, I = i.w * Math.pow(i.t, 3) / 12, a = i.a;
      var K = 8 * (1 - 3 * a + 3 * a * a) * E * I / L;
      var Kref = 2 * E * I / L;
      var Fb = 8 * PI * PI * E * I / (L * L);
      var sa = PEC.common.allowable(i);
      var thRef = 2 * sa * L / (E * i.t);
      var sigmaRef = i.theta * E * i.t / (2 * L);
      // A leaf rotating about a pole at a·L carries end moments (4 − 6a) and (6a − 2) times E·I·θ/L.
      var n = Math.max(Math.abs(4 - 6 * a), Math.abs(6 * a - 2));
      var res = { results: [], warnings: [] };
      res.results.push(
        h('Pivot with pole at a·L'),
        r('Rotational stiffness', 'K_z', K, 'Nm/rad'),
        r('Torque at θ', 'M', K * i.theta, 'Nmm'),
        r('Equivalent rolling radius', 'ρ', -Math.SQRT2 / 30 * (36 * Math.pow(a - 0.5, 2) - 5) * L, 'mm'),
        r('End moment factor', 'n', n, '-'),
        r('Maximum stress at θ', 'σ', n * sigmaRef, 'MPa'),
        r('Maximum angle at allowable stress', 'θ_max', thRef / n, 'mrad'),
        h('Reference (non-crossing, a = 0.5)'),
        r('Reference stiffness', 'K_ref', Kref, 'Nm/rad'),
        r('Reference buckling load (radial)', 'F_b,ref', Fb, 'N'),
        r('Reference max. angle at allowable stress', 'θ_ref', thRef, 'mrad'),
        r('Stress at θ (reference geometry)', 'σ', sigmaRef, 'MPa'),
        h('Classical double symmetric (a = 0.5)'),
        r('Stiffness', 'K', 0.5 * Kref, 'Nm/rad'),
        r('Buckling load', 'F_b', 0.5 * Fb, 'N'),
        r('Maximum angle', 'θ_max', thRef, 'mrad'),
        h('Special classical (a = 0.5 ± √5/6)'),
        r('Stiffness', 'K', 8 * (2 / 3) * E * I / L, 'Nm/rad'),
        r('Buckling load', 'F_b', 0.5 * Fb, 'N'),
        r('Maximum angle', 'θ_max', thRef / 3.3, 'mrad'),
        h('"Haberland" cross spring'),
        r('Stiffness', 'K', 4 * Kref, 'Nm/rad'),
        r('Buckling load', 'F_b', Fb, 'N'),
        r('Maximum angle', 'θ_max', thRef / 4, 'mrad')
      );
      if (n * sigmaRef > sa) res.warnings.push('Stress at θ exceeds the allowable stress.');
      return res;
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
