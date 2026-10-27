/*
 * Plain Node test runner (no dependencies): node tests/run-tests.js
 * Loads the browser scripts into the global scope and checks calculators against hand calculations.
 */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
['js/core.js', 'js/materials.js', 'js/sections.js', 'js/common.js',
  'js/calculators/flexures.js', 'js/calculators/beams.js', 'js/calculators/dynamics.js'
].forEach(function (f) { vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f }); });

var PEC = globalThis.PEC;
var failures = 0, passes = 0;

function close(actual, expected, rel, msg) {
  rel = rel || 1e-3;
  var ok = Math.abs(actual - expected) <= rel * Math.abs(expected) + 1e-15;
  if (ok) passes++; else { failures++; console.error('FAIL ' + msg + ': got ' + actual + ', expected ' + expected); }
}
function ok(cond, msg) { if (cond) passes++; else { failures++; console.error('FAIL ' + msg); } }

function result(calcId, overrides, sym, index) {
  var def = PEC.get(calcId);
  var vals = Object.assign(PEC.defaults(def), overrides || {});
  var res = PEC.run(def, vals);
  var rows = res.results.filter(function (r) { return r.sym === sym; });
  if (!rows.length) throw new Error(calcId + ': no result ' + sym);
  return rows[index || 0].value;
}

// Every calculator runs with its defaults and produces only finite numbers.
PEC.list.forEach(function (def) {
  var res = PEC.run(def, PEC.defaults(def));
  ok(res.results.length > 0, def.id + ' produces results');
  res.results.forEach(function (r) {
    if (typeof r.value === 'number') ok(isFinite(r.value), def.id + ' ' + r.sym + ' finite');
  });
  ok(Array.isArray(typeof def.formulas === 'function' ? def.formulas(PEC.defaults(def)) : def.formulas), def.id + ' formulas');
});

// Leaf spring S-shape: Cx = E b t³ / L³
close(result('leaf-spring', { shape: 'S', E: 210, b: 10, t: 0.3, L: 20 }, 'Cₓ'), 210e9 * 0.01 * Math.pow(3e-4, 3) / Math.pow(0.02, 3), 1e-9, 'leaf Cx S');
close(result('leaf-spring', { shape: 'C', E: 210, b: 10, t: 0.3, L: 20 }, 'Cₓ'), 210e9 * 0.01 * Math.pow(3e-4, 3) / (4 * Math.pow(0.02, 3)), 1e-9, 'leaf Cx C');
// σ for S-shape at ux: Fx L t / (4I) with Fx = Cx ux  →  σ = 3 E t ux / L²
close(result('leaf-spring', { shape: 'S', E: 210, b: 10, t: 0.3, L: 20, ux: 0.5 }, 'σ_max'), 3 * 210e9 * 3e-4 * 5e-4 / Math.pow(0.02, 2), 1e-9, 'leaf sigma S');

// Rod spring C-shape: Cx = 3EI/L³
close(result('rod-spring', { shape: 'C', E: 200, d: 1, L: 10 }, 'Cₓ = C_y'), 3 * 200e9 * Math.PI * 1e-12 / 64 / 1e-6, 1e-9, 'rod Cx C');

// Cantilever: δ = F L³ / (3EI) with rectangle 10 x 5 mm, L = 100 mm, F = 10 N, E = 70 GPa.
var I = 0.01 * Math.pow(0.005, 3) / 12;
close(result('beam-bending', { case: 'cant-F', F: 10, L: 100, w: 10, h: 5, E: 70 }, 'δy_max'), 10 * 1e-3 / (3 * 70e9 * I), 1e-9, 'cantilever deflection');
close(result('beam-bending', { case: 'ss-q', q: 0.1, L: 100, w: 10, h: 5, E: 70 }, 'δy_max'), 5 * 100 * 1e-4 / (384 * 70e9 * I), 1e-4, 'simply supported UDL');
close(result('beam-bending', { case: 'ss-F', F: 10, a: 50, L: 100, w: 10, h: 5, E: 70 }, 'δy_max'), 10 * 1e-3 / (48 * 70e9 * I), 1e-6, 'simply supported mid load');
close(result('beam-bending', { case: 'ss-F', F: 10, a: 50, L: 100, w: 10, h: 5, E: 70 }, 'σ_max'), 10 * 0.1 / 4 * 0.0025 / I, 1e-9, 'ss mid stress');

// Torsion of a round bar: K = G J / L
close(result('torsion', { shape: 'circle', d: 10, L: 100, E: 200, nu: 0.25 }, 'K_z'), 80e9 * Math.PI / 2 * Math.pow(0.005, 4) / 0.1, 1e-9, 'torsion circle K');
// Square section J ≈ 9/64 w⁴
close(result('cross-section', { shape: 'rect', w: 10, h: 10 }, 'J_T'), 9 / 64 * 1e-8, 2e-3, 'square torsion constant');

// Euler, clamped-free: Fb = π² E I / (2L)²
var Itube = Math.PI / 4 * (Math.pow(0.005, 4) - Math.pow(0.004, 4));
close(result('buckling', { shape: 'tube', do: 10, di: 8, L: 200, k: '2', E: 200 }, 'F_b'), Math.PI * Math.PI * 200e9 * Itube / Math.pow(0.4, 2), 1e-9, 'euler');

// Hertz: steel ball R = 5 mm on steel flat, F = 100 N (classical circular contact).
var Estar = 210e9 / (2 * (1 - 0.09));
var aC = Math.cbrt(3 * 100 * 0.005 / (4 * Estar));
close(result('hertz-contact', { r1x: 5, r1y: 5, r2x: 0, r2y: 0, F: 100 }, 'δ'), aC * aC / 0.005, 1e-6, 'hertz approach');
close(result('hertz-contact', { r1x: 5, r1y: 5, r2x: 0, r2y: 0, F: 100 }, 'σ_max'), 3 * 100 / (2 * Math.PI * aC * aC), 1e-6, 'hertz pressure');
close(result('hertz-contact', { r1x: 5, r1y: 5, r2x: 0, r2y: 0, F: 100 }, 'a'), aC, 1e-6, 'hertz contact radius');
// Crossed cylinders of equal radius behave like a sphere of that radius on a flat.
close(result('hertz-contact', { r1x: 5, r1y: 0, r2x: 5, r2y: 0, theta: 90, F: 100 }, 'δ'), aC * aC / 0.005, 1e-6, 'crossed cylinders');
// Elliptical contact: f2 < 1 and f3 < 1 for elongated contact (ball in conforming groove).
var f2 = result('hertz-contact', { r1x: 5, r1y: 5, r2x: -5.2, r2y: 30, F: 100 }, 'f₂');
ok(f2 > 0 && f2 < 1, 'elliptical f2 in (0,1): ' + f2);

// Impact: F = v0 √(m c)
close(result('impact-force', { m: 0.5, v0: 100, C1: 10, C2: 0 }, 'F'), 0.1 * Math.sqrt(0.5 * 1e7), 1e-9, 'impact force');
close(result('impact-force', { m: 0.5, v0: 100, C1: 10, C2: 10 }, 'c'), 5e6, 1e-9, 'impact series stiffness');

// Equivalent stiffness
close(result('equivalent-stiffness', { mode: 'series', c1: 50, c2: 50 }, 'C'), 25e6, 1e-9, 'series');
close(result('equivalent-stiffness', { mode: 'parallel', c1: 50, c2: 50 }, 'C'), 100e6, 1e-9, 'parallel');

// Motion profile: reaches the target and respects limits for each shape.
[[10e-3, 50e-3, 1, 50], [1e-3, 50e-3, 1, 50], [1e-6, 50e-3, 1, 50], [10e-3, 5e-3, 1, 50], [0.1, 0.5, 1, 1000], [0.05, 0.5, 1, 1000], [1e-4, 0.5, 1, 1000]].forEach(function (c) {
  var m = PEC.motionProfile(c[0], c[1], c[2], c[3]);
  close(m.end.p, c[0], 1e-9, 'profile reaches s=' + c[0] + ' (' + m.shape + ')');
  ok(Math.abs(m.end.v) < 1e-9 && Math.abs(m.end.a) < 1e-9, 'profile ends at rest (' + m.shape + ')');
  var vp = 0, ap = 0;
  for (var k = 0; k <= 1000; k++) { var st = m.at(m.T[7] * k / 1000); vp = Math.max(vp, st.v); ap = Math.max(ap, Math.abs(st.a)); }
  ok(vp <= c[1] * (1 + 1e-9) && ap <= c[2] * (1 + 1e-9), 'profile within limits (' + m.shape + ')');
});

// JPE example: Alu clamped part, Ti spacer, SS bolt at 77 K → L_C : L_S = 1 : 0.93
close(result('thermal-bolt-compensation', {}, 'L_S'), 0.010 * (-2.80 + 3.89) / (-1.62 + 2.80), 1e-9, 'bolt spacer');
close(result('thermal-bolt-compensation', { Lc: 1 }, 'L_S'), 0.9237e-3, 1e-3, 'JPE ratio 1:0.93');

// Formatting
ok(PEC.fmt(0.0000125) === '1.25·10⁻⁵', 'fmt small: ' + PEC.fmt(0.0000125));
ok(PEC.fmt(123.456) === '123.5', 'fmt normal: ' + PEC.fmt(123.456));

console.log(passes + ' passed, ' + failures + ' failed');
process.exit(failures ? 1 : 0);
