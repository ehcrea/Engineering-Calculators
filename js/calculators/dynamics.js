/*
 * Contact, dynamics, motion and thermal calculators.
 */
(function (root) {
  'use strict';
  var PEC = root.PEC, r = PEC.r, h = PEC.h, PI = Math.PI;
  var BASE = 'https://www.jpe-innovations.com/precision-point/';

  // ---------------------------------------------------------------- Hertz contact
  // Ellipticity corrections f2/f3 follow from the exact elliptic-contact solution (Johnson 1985, §4.2),
  // normalised so that f2 = f3 = 1 for circular contact (the JPE base equations).

  // Complete elliptic integrals K(m), E(m) of parameter m = e² by the arithmetic-geometric mean.
  function ellipticKE(m) {
    var a = 1, b = Math.sqrt(1 - m), c2sum = m / 2, p = 1;
    for (var n = 0; n < 40 && Math.abs(a - b) > 1e-15 * a; n++) {
      var c = (a - b) / 2, an = (a + b) / 2;
      b = Math.sqrt(a * b); a = an; p *= 2;
      c2sum += p * c * c / 2;
    }
    var K = Math.PI / (2 * a);
    return { K: K, E: K * (1 - c2sum) };
  }

  // Ellipse aspect ratio k = a/b ≥ 1 for a curvature ratio eps = r_y'/r_x' ≥ 1, with K(e), E(e).
  function ellipse(eps) {
    function curvRatio(k) {
      var m = 1 - 1 / (k * k), ke = ellipticKE(m);
      return { r: (ke.E / (1 - m) - ke.K) / (ke.K - ke.E), K: ke.K, E: ke.E };
    }
    if (eps <= 1 + 1e-9) return { k: 1, K: Math.PI / 2, E: Math.PI / 2 };
    var lo = 1 + 1e-9, hi = 2 * Math.pow(eps, 2 / Math.PI) + 2;
    while (curvRatio(hi).r < eps) hi *= 2;
    for (var n = 0; n < 200 && hi - lo > 1e-12 * hi; n++) {
      var mid = 0.5 * (lo + hi);
      if (curvRatio(mid).r < eps) lo = mid; else hi = mid;
    }
    var k = 0.5 * (lo + hi), c = curvRatio(k);
    return { k: k, K: c.K, E: c.E };
  }

  function hertz(i) {
    var r1x = PEC.inf(i.r1x), r1y = PEC.inf(i.r1y), r2x = PEC.inf(i.r2x), r2y = PEC.inf(i.r2y);
    var P = 0.5 * (1 / r1x + 1 / r1y + 1 / r2x + 1 / r2y);
    var a = 1 / r1x - 1 / r1y, b = 1 / r2x - 1 / r2y;
    var Q = 0.5 * Math.sqrt(Math.max(0, a * a + b * b + 2 * a * b * Math.cos(2 * i.theta)));
    var rx = 1 / (P + Q), ry = 1 / (P - Q);
    var Er = 1 / ((1 - i.nu1 * i.nu1) / (2 * i.E1) + (1 - i.nu2 * i.nu2) / (2 * i.E2));
    var out = { P: P, Q: Q, rx: rx, ry: ry, Er: Er };
    if (!(P + Q > 0) || !(P - Q > 0) || !isFinite(ry)) { out.invalid = true; return out; }
    var Re = Math.sqrt(rx * ry), eps = ry / rx, F = i.F;
    var R = 1 / (1 / rx + 1 / ry);
    var el = ellipse(eps), k = el.k, Ek = el.E, Fk = el.K;
    var semiA = Math.cbrt(6 * k * k * Ek * F * R / (PI * Er));
    var semiB = Math.cbrt(6 * Ek * F * R / (PI * k * Er));
    var delta = Fk * Math.cbrt(9 / (2 * Ek * R) * Math.pow(F / (PI * k * Er), 2));
    var pmax = 3 * F / (2 * PI * semiA * semiB);
    var deltaC = Math.cbrt(9 * F * F / (4 * Er * Er * Re));
    var pmaxC = Math.cbrt(3 * F * Er * Er / (2 * Math.pow(PI, 3) * Re * Re));
    return Object.assign(out, { Re: Re, eps: eps, semiA: semiA, semiB: semiB, delta: delta, pmax: pmax, f2: delta / deltaC, f3: pmax / pmaxC });
  }

  PEC.register({
    id: 'hertz-contact',
    title: 'Hertz contact',
    category: 'Contact & dynamics',
    source: BASE + 'hertz-contact-universal-point/',
    description: 'Approach, contact pressure, contact ellipse and stiffness for two curved bodies (sphere–plane, sphere–sphere, ball–groove, crossed cylinders…).',
    corrections: [
      { text: 'JPE reads the ellipticity factors f₂ and f₃ from a graph. The calculator computes them from the exact elliptical Hertz solution with complete elliptic integrals, which replaces the earlier Brewe–Hamrock curve fit (that fit underestimated the approach by up to 12 % near ε_rr = 800).', refs: ['johnson', 'hamrock'] }
    ],
    inputs: [
      { type: 'heading', label: 'Body 1 radii (+ convex, − concave, 0 = flat)' },
      { id: 'r1x', label: 'Smallest radius', sym: 'r₁ₓ', unit: 'mm', value: 5 },
      { id: 'r1y', label: 'Largest radius', sym: 'r₁ᵧ', unit: 'mm', value: 5 },
      { id: 'mat1', type: 'material', label: 'Body 1 material', map: { E: 'E1', nu: 'nu1' }, value: 'Steel (carbon)' },
      { id: 'E1', label: "Young's modulus body 1", sym: 'E₁', unit: 'GPa', value: 210 },
      { id: 'nu1', label: "Poisson's ratio body 1", sym: 'ν₁', unit: '-', value: 0.3 },
      { type: 'heading', label: 'Body 2 radii (+ convex, − concave, 0 = flat)' },
      { id: 'r2x', label: 'Smallest radius', sym: 'r₂ₓ', unit: 'mm', value: 0, optional: true },
      { id: 'r2y', label: 'Largest radius', sym: 'r₂ᵧ', unit: 'mm', value: 0, optional: true },
      { id: 'mat2', type: 'material', label: 'Body 2 material', map: { E: 'E2', nu: 'nu2' }, value: 'Steel (carbon)' },
      { id: 'E2', label: "Young's modulus body 2", sym: 'E₂', unit: 'GPa', value: 210 },
      { id: 'nu2', label: "Poisson's ratio body 2", sym: 'ν₂', unit: '-', value: 0.3 },
      { type: 'heading', label: 'Load' },
      { id: 'theta', label: 'Angle between body x-axes', sym: 'θ', unit: 'deg', value: 0 },
      { id: 'F', label: 'Normal force', sym: 'F', unit: 'N', value: 100 }
    ],
    formulas: [
      'E_r = ((1 − ν₁²)/(2E₁) + (1 − ν₂²)/(2E₂))⁻¹',
      'P = ½·(1/r₁ₓ + 1/r₁ᵧ + 1/r₂ₓ + 1/r₂ᵧ)',
      'a = 1/r₁ₓ − 1/r₁ᵧ,  b = 1/r₂ₓ − 1/r₂ᵧ,  Q = ½·√(a² + b² + 2ab·cos 2θ)',
      "rₓ' = 1/(P + Q),  r_y' = 1/(P − Q),  R_e = √(rₓ'·r_y'),  ε_rr = r_y'/rₓ'",
      'δ = ∛(9F² / (4E_r²·R_e))·f₂',
      'σ_max = ∛(3F·E_r² / (2π³·R_e²))·f₃',
      'C_avg = F/δ,  C_local = dF/dδ = 3/(2f₂)·∛(F·4E_r²·R_e/9)',
      'f₂, f₃ from the exact elliptic-integral solution (f₂ = f₃ = 1 for circular contact)',
      'Valid for ε_rr < 800; above that use line-contact equations'
    ],
    compute: function (i) {
      var o = hertz(i);
      var res = { results: [], warnings: [] };
      res.results.push(
        h('Equivalent geometry & material'),
        r('Equivalent Young\'s modulus', 'E_r', o.Er, 'GPa')
      );
      if (o.invalid) {
        res.warnings.push('No point contact: the combined curvature is zero or negative in one direction (line contact or conforming surfaces).');
        return res;
      }
      res.results.push(
        r('Principal relative radius (small)', "rₓ'", o.rx, 'mm'),
        r('Principal relative radius (large)', "r_y'", o.ry, 'mm'),
        r('Equivalent radius', 'R_e', o.Re, 'mm'),
        r('Ratio of curvature radii', 'ε_rr', o.eps, '-'),
        r('Ellipticity correction (approach)', 'f₂', o.f2, '-'),
        r('Ellipticity correction (stress)', 'f₃', o.f3, '-'),
        h('Contact'),
        r('Approach (deformation)', 'δ', o.delta, 'µm'),
        r('Maximum contact pressure', 'σ_max', o.pmax, 'MPa'),
        r('Contact ellipse semi-axis (large)', 'a', o.semiA, 'µm'),
        r('Contact ellipse semi-axis (small)', 'b', o.semiB, 'µm'),
        h('Stiffness'),
        r('Average stiffness', 'C_avg', i.F / o.delta, 'N/µm'),
        r('Local (tangent) stiffness', 'C_local', 1.5 * i.F / o.delta, 'N/µm')
      );
      if (o.eps > 800) res.warnings.push('ε_rr > 800: approaching line contact, use rectangular-contact equations.');
      return res;
    }
  });

  // ---------------------------------------------------------------- Impact
  PEC.register({
    id: 'impact-force',
    title: 'Impact force',
    category: 'Contact & dynamics',
    source: BASE + 'impact-force/',
    description: 'Peak force, approach, duration and deceleration when a mass hits a spring (undamped collision).',
    inputs: [
      { type: 'heading', label: 'Collision' },
      { id: 'm', label: 'Moving mass', sym: 'm', unit: 'kg', value: 0.5 },
      { id: 'v0', label: 'Impact velocity', sym: 'v₀', unit: 'mm/s', value: 100 },
      { id: 'C1', label: 'Stiffness body 1', sym: 'C₁', unit: 'N/µm', value: 10 },
      { id: 'C2', label: 'Stiffness body 2 (0 = rigid)', sym: 'C₂', unit: 'N/µm', value: 0, optional: true }
    ],
    formulas: [
      'c = C₁·C₂ / (C₁ + C₂)  (use local Hertz stiffness if both bodies are rigid)',
      'F = v₀·√(m·c)',
      'u = v₀·√(m/c)',
      't = (π/2)·√(m/c)  (time to decelerate to v = 0)',
      'a_max = −v₀·√(c/m),  a_ave = −(2/π)·v₀·√(c/m)',
      'x(t) = v₀·√(m/c)·sin(√(c/m)·t)'
    ],
    compute: function (i) {
      var C2 = PEC.inf(i.C2);
      var c = isFinite(C2) ? i.C1 * C2 / (i.C1 + C2) : i.C1;
      var m = i.m, v0 = i.v0, w = Math.sqrt(c / m);
      var F = v0 * Math.sqrt(m * c), t = PI / 2 / w;
      var res = { results: [], warnings: [] };
      res.results.push(
        r('Collision stiffness', 'c', c, 'N/µm'),
        r('Maximum collision force', 'F', F, 'N'),
        r('Maximum approach', 'u', v0 / w, 'µm'),
        r('Deceleration time', 't', t, 'ms'),
        r('Maximum deceleration', 'a_max', -v0 * w, 'm/s²'),
        r('Maximum deceleration', 'a_max', -v0 * w, 'g₀'),
        r('Average deceleration', 'a_ave', -2 / PI * v0 * w, 'm/s²')
      );
      var ts = [], fs = [];
      for (var k = 0; k <= 200; k++) { var tt = 2 * t * k / 200; ts.push(tt); fs.push(c * v0 / w * Math.sin(w * tt)); }
      res.chart = { title: 'Contact force during collision', x: { label: 't', unit: 'ms', values: ts }, series: [{ label: 'F', unit: 'N', values: fs }] };
      return res;
    }
  });

  // ---------------------------------------------------------------- Equivalent stiffness
  PEC.register({
    id: 'equivalent-stiffness',
    title: 'Equivalent stiffness & eigenfrequency',
    category: 'Contact & dynamics',
    source: BASE + 'equivalent-stiffness/',
    description: 'Combine up to six springs in series or parallel and compute the eigenfrequency of a mass on the result.',
    inputs: [
      { type: 'heading', label: 'Springs (leave blank to ignore)' },
      { id: 'mode', label: 'Arrangement', type: 'select', value: 'series', options: [
        { v: 'series', label: 'Series: 1/C = Σ 1/Cᵢ' }, { v: 'parallel', label: 'Parallel: C = Σ Cᵢ' }
      ] },
      { id: 'c1', label: 'Stiffness 1', sym: 'C₁', unit: 'N/µm', value: 50 },
      { id: 'c2', label: 'Stiffness 2', sym: 'C₂', unit: 'N/µm', value: 20, optional: true },
      { id: 'c3', label: 'Stiffness 3', sym: 'C₃', unit: 'N/µm', value: '', optional: true },
      { id: 'c4', label: 'Stiffness 4', sym: 'C₄', unit: 'N/µm', value: '', optional: true },
      { id: 'c5', label: 'Stiffness 5', sym: 'C₅', unit: 'N/µm', value: '', optional: true },
      { id: 'c6', label: 'Stiffness 6', sym: 'C₆', unit: 'N/µm', value: '', optional: true },
      { type: 'heading', label: 'Mass (for eigenfrequency)' },
      { id: 'm', label: 'Suspended mass', sym: 'm', unit: 'kg', value: 1, optional: true }
    ],
    formulas: ['Series: 1/C = 1/C₁ + 1/C₂ + …', 'Parallel: C = C₁ + C₂ + …', 'f₀ = (1/2π)·√(C/m)'],
    compute: function (i) {
      var cs = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map(function (k) { return i[k]; }).filter(function (v) { return v !== null && !isNaN(v) && v !== 0; });
      var res = { results: [], warnings: [] };
      if (!cs.length) { res.warnings.push('Enter at least one stiffness.'); return res; }
      var C = i.mode === 'series' ? 1 / cs.reduce(function (s, c) { return s + 1 / c; }, 0) : cs.reduce(function (s, c) { return s + c; }, 0);
      res.results.push(r('Number of springs', 'n', cs.length, '-'), r('Equivalent stiffness', 'C', C, 'N/µm'));
      if (i.m) {
        res.results.push(r('Eigenfrequency', 'f₀', Math.sqrt(C / i.m) / (2 * PI), 'Hz'));
        res.results.push(r('Static sag under gravity', 'δ', i.m * 9.80665 / C, 'µm'));
      }
      return res;
    }
  });

  // ---------------------------------------------------------------- Third order motion profile
  function motionProfile(s, v, a, j) {
    var tj, ta, tv, shape;
    if (v * j < a * a) {
      // Acceleration limit cannot be reached before the velocity limit.
      tj = Math.sqrt(v / j);
      if (s >= 2 * v * tj) { ta = tj; tv = s / v; shape = 'v_max reached, a_max not reached (I/III)'; }
      else { tj = Math.cbrt(s / (2 * j)); ta = tj; tv = 2 * tj; shape = 'neither v_max nor a_max reached (II/IV)'; }
    } else {
      var sv = v * (v / a + a / j), sa = 2 * a * a * a / (j * j);
      if (s >= sv) { tj = a / j; ta = v / a; tv = s / v; shape = 'v_max and a_max reached (V)'; }
      else if (s >= sa) { tj = a / j; ta = 0.5 * (Math.sqrt((4 * s * j * j + a * a * a) / (a * j * j)) - a / j); tv = ta + tj; shape = 'a_max reached, v_max not reached (VI)'; }
      else { tj = Math.cbrt(s / (2 * j)); ta = tj; tv = 2 * tj; shape = 'neither v_max nor a_max reached (II/IV)'; }
    }
    var T = [0, tj, ta, ta + tj, tv, tv + tj, tv + ta, tv + ta + tj];
    var J = [j, 0, -j, 0, -j, 0, j];
    // Integrate the piecewise-constant jerk exactly.
    var state = [{ a: 0, v: 0, p: 0 }];
    for (var k = 0; k < 7; k++) {
      var d = T[k + 1] - T[k], st = state[k];
      state.push({
        a: st.a + J[k] * d,
        v: st.v + st.a * d + J[k] * d * d / 2,
        p: st.p + st.v * d + st.a * d * d / 2 + J[k] * d * d * d / 6
      });
    }
    function at(t) {
      var k = 0;
      while (k < 6 && t > T[k + 1]) k++;
      var d = t - T[k], st = state[k];
      return { j: J[k], a: st.a + J[k] * d, v: st.v + st.a * d + J[k] * d * d / 2, p: st.p + st.v * d + st.a * d * d / 2 + J[k] * d * d * d / 6 };
    }
    return { tj: tj, ta: ta, tv: tv, T: T, shape: shape, at: at, end: state[7] };
  }

  PEC.register({
    id: 'motion-profile',
    title: 'Third order motion profile',
    category: 'Motion & control',
    source: BASE + 'third-order-point-to-point-motion-profile/',
    description: 'Jerk-limited point-to-point move: phase times, move time and position/velocity/acceleration profiles.',
    inputs: [
      { type: 'heading', label: 'Move' },
      { id: 's', label: 'Distance', sym: 's', unit: 'mm', value: 10 },
      { id: 'v', label: 'Maximum velocity', sym: 'v_max', unit: 'mm/s', value: 50 },
      { id: 'a', label: 'Maximum acceleration', sym: 'a_max', unit: 'm/s²', value: 1 },
      { id: 'j', label: 'Maximum jerk', sym: 'j_max', unit: 'm/s³', value: 50 }
    ],
    formulas: [
      'v_a = a_max²/j_max,  s_a = 2·a_max³/j_max²',
      's_v = v_max·(2√(v_max/j_max)) if v_max·j_max < a_max², else v_max·(v_max/a_max + a_max/j_max)',
      'I/III: t_j = √(v_max/j_max), t_a = t_j, t_v = s/v_max',
      'II/IV: t_j = ∛(s/(2j_max)), t_a = t_j, t_v = 2t_j',
      'V: t_j = a_max/j_max, t_a = v_max/a_max, t_v = s/v_max',
      'VI: t_j = a_max/j_max, t_a = ½(√((4s·j_max² + a_max³)/(a_max·j_max²)) − a_max/j_max), t_v = t_a + t_j',
      't₁ = t_j, t₂ = t_a, t₃ = t_a + t_j, t₄ = t_v, t₅ = t_v + t_j, t₆ = t_v + t_a, t₇ = t_v + t_j + t_a (move time)'
    ],
    compute: function (i) {
      var res = { results: [], warnings: [] };
      if (!(i.s > 0 && i.v > 0 && i.a > 0 && i.j > 0)) { res.warnings.push('All inputs must be positive.'); return res; }
      var m = motionProfile(i.s, i.v, i.a, i.j);
      var n = 300, ts = [], ps = [], vs = [], as = [];
      var vp = 0, ap = 0;
      for (var k = 0; k <= n; k++) {
        var t = m.T[7] * k / n, st = m.at(t);
        ts.push(t); ps.push(st.p); vs.push(st.v); as.push(st.a);
        vp = Math.max(vp, st.v); ap = Math.max(ap, Math.abs(st.a));
      }
      res.results.push(
        r('Profile shape', '', m.shape, ''),
        h('Characteristic times'),
        r('Jerk time', 't_j', m.tj, 'ms'),
        r('Acceleration time', 't_a', m.ta, 'ms'),
        r('Velocity time', 't_v', m.tv, 'ms'),
        r('Total move time', 't₇', m.T[7], 'ms'),
        h('Achieved'),
        r('Peak velocity', 'v_peak', vp, 'mm/s'),
        r('Peak acceleration', 'a_peak', ap, 'm/s²'),
        r('Final position (check)', 'p(t₇)', m.end.p, 'mm')
      );
      res.charts = [
        { title: 'Position', x: { label: 't', unit: 'ms', values: ts }, series: [{ label: 'p', unit: 'mm', values: ps }] },
        { title: 'Velocity', x: { label: 't', unit: 'ms', values: ts }, series: [{ label: 'v', unit: 'mm/s', values: vs }] },
        { title: 'Acceleration', x: { label: 't', unit: 'ms', values: ts }, series: [{ label: 'a', unit: 'm/s²', values: as }] }
      ];
      return res;
    }
  });

  // ---------------------------------------------------------------- Thermal shrinkage compensation
  PEC.register({
    id: 'thermal-bolt-compensation',
    title: 'Thermal shrinkage in bolted joints',
    category: 'Thermal',
    source: BASE + 'compensating-thermal-shrinkage-bolted-connections/',
    description: 'Spacer length that makes the clamped stack shrink exactly as much as the bolt, keeping preload at cryogenic or elevated temperatures.',
    inputs: [
      { type: 'heading', label: 'Clamped stack' },
      { id: 'Lc', label: 'Length of clamped part', sym: 'L_C', unit: 'mm', value: 10 },
      { id: 'rC', label: 'Relative change clamped part', sym: 'r_C', unit: '‰', value: -3.89, hint: 'Alu-6061, 293 K → 77 K' },
      { id: 'rS', label: 'Relative change spacer', sym: 'r_S', unit: '‰', value: -1.62, hint: 'Ti-6Al-4V, 293 K → 77 K' },
      { id: 'rB', label: 'Relative change bolt', sym: 'r_B', unit: '‰', value: -2.80, hint: 'SS-304, 293 K → 77 K' }
    ],
    formulas: [
      '(L_C·r_C + L_S·r_S) / (L_C + L_S) = r_B',
      'L_S = L_C·(r_B − r_C) / (r_S − r_B)'
    ],
    compute: function (i) {
      var res = { results: [], warnings: [] };
      var Ls = i.Lc * (i.rB - i.rC) / (i.rS - i.rB);
      if (!(Ls > 0) || !isFinite(Ls)) {
        res.warnings.push('No positive spacer length: the bolt\'s relative change must lie between those of the clamped part and the spacer.');
        return res;
      }
      res.results.push(
        r('Required spacer length', 'L_S', Ls, 'mm'),
        r('Length ratio L_C : L_S', '', '1 : ' + PEC.fmt(Ls / i.Lc, 3), ''),
        r('Bolt grip length', 'L_C + L_S', i.Lc + Ls, 'mm'),
        r('Stack length change', 'ΔL', (i.Lc + Ls) * i.rB, 'µm')
      );
      return res;
    }
  });

  PEC.register({
    id: 'thermal-expansion',
    title: 'Thermal expansion',
    category: 'Thermal',
    source: BASE + 'common-materials-selection-properties/',
    description: 'Linear thermal expansion of a part and the mismatch between two materials.',
    inputs: [
      { type: 'heading', label: 'Part' },
      { id: 'L', label: 'Length', sym: 'L', unit: 'mm', value: 100 },
      { id: 'dT', label: 'Temperature change', sym: 'ΔT', unit: 'K', value: 1 },
      { id: 'mat1', type: 'material', label: 'Material 1', map: { alpha: 'a1' }, value: 'Aluminum 6082-T6' },
      { id: 'a1', label: 'Expansion coefficient 1', sym: 'α₁', unit: 'µm/m·K', value: 23.1 },
      { id: 'mat2', type: 'material', label: 'Material 2', map: { alpha: 'a2' }, value: 'Steel (stainless)' },
      { id: 'a2', label: 'Expansion coefficient 2', sym: 'α₂', unit: 'µm/m·K', value: 17 }
    ],
    formulas: ['ΔL = α·L·ΔT', 'Mismatch = (α₁ − α₂)·L·ΔT'],
    compute: function (i) {
      return {
        results: [
          r('Expansion material 1', 'ΔL₁', i.a1 * i.L * i.dT, 'µm'),
          r('Expansion material 2', 'ΔL₂', i.a2 * i.L * i.dT, 'µm'),
          r('Mismatch', 'ΔL₁ − ΔL₂', (i.a1 - i.a2) * i.L * i.dT, 'µm')
        ]
      };
    }
  });

  PEC.motionProfile = motionProfile;
  PEC.hertz = hertz;
  PEC.ellipticKE = ellipticKE;
})(typeof window !== 'undefined' ? window : globalThis);
