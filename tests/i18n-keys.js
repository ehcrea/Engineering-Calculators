/*
 * Collects every English text the app can show, for the translation coverage test.
 * Combines a walk over the calculator definitions (labels, options, formulas, results of every
 * select variant, theory notes, previews over the animation cycle) with a scan of the sources for
 * literal texts that only appear under some conditions (warnings, sketch notes, UI messages).
 */
'use strict';
var fs = require('fs');
var path = require('path');

function unquote(lit) {
  return lit.slice(1, -1).replace(/\\'/g, '\'').replace(/\\"/g, '"').replace(/\\n/g, '\n');
}

module.exports = function collect(PEC, ROOT) {
  var keys = {};
  function add(s) { if (typeof s === 'string' && s && PEC.i18n.hasWords(s)) keys[s] = true; }
  var read = function (f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); };
  // A complete string literal (not the start of a concatenation).
  var STR = /'(?:[^'\\\n]|\\.)*'(?!\s*\+)/;

  // Literal texts passed to t()/T()/PEC.t() and in data-i18n attributes.
  ['js/app.js', 'js/pdf.js', 'js/preview.js', 'js/chart.js'].forEach(function (f) {
    var src = read(f), m, re = new RegExp('\\b(?:t|T|PEC\\.t)\\((' + STR.source + ')', 'g');
    while ((m = re.exec(src))) add(unquote(m[1]));
    // Ternaries inside a call: t(cond ? 'a' : 'b').
    re = new RegExp('\\b(?:t|T)\\([^()\\n]*?\\? (' + STR.source + ') : (' + STR.source + ')\\)', 'g');
    while ((m = re.exec(src))) { add(unquote(m[1])); add(unquote(m[2])); }
  });
  var html = read('index.html'), hm, hre = /data-i18n(?:-[a-z-]+)?="([^"]+)"/g;
  while ((hm = hre.exec(html))) add(hm[1]);

  // Conditional texts: warnings, sketch notes, error messages.
  ['js/calculators/flexures.js', 'js/calculators/beams.js', 'js/calculators/dynamics.js', 'js/sections.js', 'js/common.js', 'js/preview.js', 'js/storage.js', 'js/app.js'].forEach(function (f) {
    var src = read(f), m;
    var re = new RegExp('(?:warnings\\.push|w\\.push|notes\\.push|new Error)\\((' + STR.source + ')', 'g');
    while ((m = re.exec(src))) add(unquote(m[1]));
    re = new RegExp('notes\\.push\\([^()\\n]*?\\? (' + STR.source + ') : (' + STR.source + ')\\)', 'g');
    while ((m = re.exec(src))) { add(unquote(m[1])); add(unquote(m[2])); }
    re = new RegExp('notes(?: = |: )[^\\n]*?\\[(' + STR.source + ')\\]', 'g');
    while ((m = re.exec(src))) add(unquote(m[1]));
    re = new RegExp('(?:shape|tauNote) = (' + STR.source + ')', 'g');
    while ((m = re.exec(src))) add(unquote(m[1]));
  });

  // Calculator definitions and everything they produce for each select option.
  PEC.list.forEach(function (def) {
    add(def.title); add(def.category); add(def.description);
    def.inputs.forEach(function (inp) {
      add(inp.label); add(inp.hint);
      (inp.options || []).forEach(function (o) { add(o.label); });
    });
    var variants = [PEC.defaults(def)];
    def.inputs.filter(function (inp) { return inp.type === 'select'; }).forEach(function (sel) {
      sel.options.forEach(function (o) { var v = PEC.defaults(def); v[sel.id] = o.v; variants.push(v); });
    });
    variants.forEach(function (v) {
      (typeof def.formulas === 'function' ? def.formulas(v) : def.formulas || []).forEach(add);
      var res = PEC.run(def, v);
      res.results.forEach(function (r) { add(r.label); if (typeof r.value === 'string') add(r.value); });
      res.warnings.forEach(add);
      (res.charts || (res.chart ? [res.chart] : [])).forEach(function (c) { add(c.title); });
    });
    var th = PEC.THEORY[def.id];
    if (th) { add(th.intro); th.points.forEach(add); th.assumptions.forEach(add); }
  });
  PEC.MATERIALS.forEach(function (m) { add(m.name); add(m.sfNote); });
  Object.keys(PEC.sections.SHAPES).forEach(function (k) { add(PEC.sections.SHAPES[k]); });
  return Object.keys(keys);
};
