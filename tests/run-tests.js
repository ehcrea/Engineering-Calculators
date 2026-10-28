/*
 * Plain Node test runner (no dependencies): node tests/run-tests.js
 * Loads the browser scripts into the global scope and checks calculators against hand calculations.
 */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
['js/core.js', 'js/i18n.js', 'js/i18n/de.js', 'js/i18n/nl.js', 'js/i18n/tr.js', 'js/materials.js', 'js/sections.js', 'js/common.js',
  'js/calculators/flexures.js', 'js/calculators/beams.js', 'js/calculators/dynamics.js', 'js/theory.js', 'js/preview.js'
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

// Geometry previews render for every option of every calculator that has one.
var COLORS = { fg: '#000', muted: '#666', accent: '#00f', accentSoft: '#eef', fill: '#ddd', fill2: '#ccc', bg: '#fff' };
PEC.list.filter(function (d) { return PEC.preview.has(d.id); }).forEach(function (def) {
  var variants = [PEC.defaults(def)];
  def.inputs.filter(function (inp) { return inp.type === 'select'; }).forEach(function (sel) {
    sel.options.forEach(function (o) { var v = PEC.defaults(def); v[sel.id] = o.v; variants.push(v); });
  });
  variants.forEach(function (v) {
    var res = PEC.run(def, v);
    var p = PEC.preview.render(def.id, PEC.inputsToSI(def, v), res, COLORS);
    var tag = def.id + ' ' + JSON.stringify(v).slice(0, 60);
    ok(p && /^<svg[\s\S]*<\/svg>$/.test(p.svg), 'preview renders: ' + tag);
    ok(p && !/NaN|Infinity|undefined/.test(p.svg), 'preview has no NaN/Infinity: ' + tag);
  });
});
// Edge geometry: flat-sided notch hinge, concave Hertz groove, pivot pole outside the springs.
[['flexure-hinge', { d2: 0 }], ['hertz-contact', { r1x: 5, r1y: 5, r2x: -5.2, r2y: 30 }], ['cross-spring-pivot', { a: 1.3 }], ['cross-spring-pivot', { a: -0.2 }]].forEach(function (c) {
  var def = PEC.get(c[0]), v = Object.assign(PEC.defaults(def), c[1]);
  var p = PEC.preview.render(def.id, PEC.inputsToSI(def, v), PEC.run(def, v), COLORS);
  ok(p && !/NaN|Infinity|undefined/.test(p.svg), 'edge preview ' + c[0] + ' ' + JSON.stringify(c[1]));
});

// Animated sketches render cleanly over the whole cycle, including the edge geometries above.
var ANIM_CASES = PEC.list.filter(function (d) { return PEC.preview.animates(d.id); }).map(function (d) { return [d.id, {}]; })
  .concat([['flexure-hinge', { d2: 0 }], ['cross-spring-pivot', { a: 1.3 }], ['impact-force', { C2: 0 }], ['equivalent-stiffness', { m: 0 }]]);
ANIM_CASES.forEach(function (c) {
  var def = PEC.get(c[0]), v = Object.assign(PEC.defaults(def), c[1]), res = PEC.run(def, v);
  [0, 0.1, 0.25, 0.45, 0.5, 0.55, 0.75, 0.9, 0.999].forEach(function (ph) {
    var p = PEC.preview.render(def.id, PEC.inputsToSI(def, v), res, COLORS, ph);
    var tag = c[0] + ' ' + JSON.stringify(c[1]) + ' @' + ph;
    ok(p && /^<svg[\s\S]*<\/svg>$/.test(p.svg), 'animated preview renders: ' + tag);
    ok(p && !/NaN|Infinity|undefined/.test(p.svg + (p.caption || '')), 'animated preview has no NaN/Infinity: ' + tag);
  });
});
ok(PEC.preview.render('cross-section', PEC.inputsToSI(PEC.get('cross-section'), PEC.defaults(PEC.get('cross-section'))), PEC.run(PEC.get('cross-section'), PEC.defaults(PEC.get('cross-section'))), COLORS, 0.5) !== null, 'non-animated preview ignores the phase');

// Every calculator has a theory note for the help icon.
PEC.list.forEach(function (d) {
  var t = PEC.THEORY[d.id];
  ok(t && t.intro && t.points && t.points.length && t.assumptions, 'theory note: ' + d.id);
});

// Translations: every text the app can show exists in each language, with the same placeholders.
var I18N_KEYS = require('./i18n-keys.js')(PEC, ROOT);
ok(I18N_KEYS.length > 500, 'collected ' + I18N_KEYS.length + ' translatable texts');
PEC.i18n.LANGS.filter(function (l) { return l.code !== 'en'; }).forEach(function (l) {
  var dict = PEC.i18n.dict(l.code);
  var missing = I18N_KEYS.filter(function (k) { return dict[k] === undefined; });
  ok(!missing.length, l.code + ' has every text; missing: ' + missing.slice(0, 5).join(' | '));
  var ph = function (s) { return (s.match(/\{\w+\}/g) || []).sort().join(); };
  var bad = Object.keys(dict).filter(function (k) { return ph(k) !== ph(dict[k]); });
  ok(!bad.length, l.code + ' keeps placeholders: ' + bad.join(' | '));
  var unused = Object.keys(dict).filter(function (k) { return I18N_KEYS.indexOf(k) < 0; });
  ok(!unused.length, l.code + ' has no stale texts: ' + unused.slice(0, 5).join(' | '));

  // Render everything in this language and record any text that is shown untranslated.
  PEC.i18n.setLang(l.code, false);
  PEC.i18n.track(true);
  PEC.list.forEach(function (def) {
    var variants = [PEC.defaults(def)];
    def.inputs.filter(function (inp) { return inp.type === 'select'; }).forEach(function (sel) {
      sel.options.forEach(function (o) { var v = PEC.defaults(def); v[sel.id] = o.v; variants.push(v); });
    });
    variants.forEach(function (v) {
      var res = PEC.run(def, v);
      res.results.forEach(function (r) { PEC.t(r.label); if (typeof r.value === 'string') PEC.t(r.value); });
      res.warnings.forEach(function (w) { PEC.t(w); });
      [undefined, 0, 0.25, 0.5, 0.8].forEach(function (ph) {
        var p = PEC.preview.render(def.id, PEC.inputsToSI(def, v), res, COLORS, ph);
        if (p) p.notes.forEach(function (n) { PEC.t(n); });
      });
    });
  });
  var shown = PEC.i18n.missing();
  ok(!shown.length, l.code + ' shows no untranslated text: ' + shown.slice(0, 5).join(' | '));
  ok(PEC.preview.render('leaf-spring', PEC.inputsToSI(PEC.get('leaf-spring'), PEC.defaults(PEC.get('leaf-spring'))), PEC.run(PEC.get('leaf-spring'), PEC.defaults(PEC.get('leaf-spring'))), COLORS).svg.indexOf(PEC.t('Cross-section')) > 0, l.code + ' sketch labels are translated');
  PEC.i18n.track(false);
});
PEC.i18n.setLang('en', false);
ok(PEC.t('Saved "{name}"', { name: 'X' }) === 'Saved "X"', 'English fallback fills placeholders');

// Formatting
ok(PEC.fmt(0.0000125) === '1.25·10⁻⁵', 'fmt small: ' + PEC.fmt(0.0000125));
ok(PEC.fmt(123.456) === '123.5', 'fmt normal: ' + PEC.fmt(123.456));

console.log(passes + ' passed, ' + failures + ' failed');
process.exit(failures ? 1 : 0);
