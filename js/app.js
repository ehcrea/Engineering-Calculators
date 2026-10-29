/*
 * UI: navigation, input form, live results, charts, saving/restoring and PDF export.
 */
(function (root) {
  'use strict';
  var PEC = root.PEC, store = PEC.store, t = PEC.t;
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var U = PEC.units;

  // Units of the properties in PEC.MATERIALS.
  var MAT_UNITS = { E: 'GPa', nu: '-', sy: 'MPa', sf: 'MPa', su: 'MPa', rho: 'kg/m³', alpha: 'µm/m·K' };
  var MATERIALS_VIEW = 'materials';

  var state = { def: null, values: null, snapshotId: null, snapshotName: null, lastResult: null, anim: null };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  // Display symbols with real subscripts: "C_Ax" → C<sub>Ax</sub>.
  function symHtml(s) {
    return esc(s || '').replace(/_([^\s,()=/·+.;:]+)/g, '<sub>$1</sub>');
  }

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  // ------------------------------------------------------------------ Navigation
  function renderNav(filter) {
    var f = (filter || '').toLowerCase();
    var groups = {};
    PEC.list.forEach(function (d) {
      if (f && [d.title, d.category, d.description, t(d.title), t(d.category), t(d.description)].join(' ').toLowerCase().indexOf(f) < 0) return;
      (groups[d.category] = groups[d.category] || []).push(d);
    });
    var cur = state.def ? state.def.id : (location.hash === '#/' + MATERIALS_VIEW ? MATERIALS_VIEW : '');
    var html = Object.keys(groups).map(function (g) {
      return '<div class="nav-group"><h2>' + esc(t(g)) + '</h2>' + groups[g].map(function (d) {
        return '<button class="nav-item' + (d.id === cur ? ' active" aria-current="page' : '') + '" data-calc="' + d.id + '">' + esc(t(d.title)) + '</button>';
      }).join('') + '</div>';
    }).join('');
    if (!f || ['materials properties reference', t('Reference'), t('Material properties')].join(' ').toLowerCase().indexOf(f) >= 0) {
      html += '<div class="nav-group"><h2>' + esc(t('Reference')) + '</h2><button class="nav-item' + (cur === MATERIALS_VIEW ? ' active" aria-current="page' : '') + '" data-calc="' + MATERIALS_VIEW + '">' + esc(t('Material properties')) + '</button></div>';
    }
    $('#nav').innerHTML = html || '<p class="empty">' + esc(t('No calculator matches.')) + '</p>';
  }

  // ------------------------------------------------------------------ Form
  function visible(inp, values) {
    if (!inp.showIf) return true;
    return inp.showIf.values.indexOf(values[inp.showIf.field]) >= 0;
  }

  function fieldHtml(inp, values) {
    var hidden = visible(inp, values) ? '' : ' hidden';
    if (inp.type === 'heading') return '<div class="form-section">' + esc(t(inp.label)) + '</div>';
    var v = values[inp.id];
    var id = 'f_' + inp.id;
    if (inp.type !== 'select' && inp.type !== 'material') v = shownValue(inp, v);
    if (inp.type === 'select' || inp.type === 'material') {
      var opts = inp.type === 'material'
        ? [{ v: '', label: 'Custom values' }].concat(PEC.MATERIALS.map(function (m) { return { v: m.name, label: m.name }; }))
        : inp.options;
      return '<div class="field wide" data-field="' + inp.id + '"' + hidden + '><label for="' + id + '">' + esc(t(inp.label)) + '</label>' +
        '<select id="' + id + '" data-id="' + inp.id + '">' + opts.map(function (o) {
          return '<option value="' + esc(o.v) + '"' + (String(o.v) === String(v) ? ' selected' : '') + '>' + esc(t(o.label)) + '</option>';
        }).join('') + '</select></div>';
    }
    // Screen readers announce the unit (and hint) together with the label.
    var desc = [unitText(inp.unit) ? id + '_u' : '', inp.hint ? id + '_h' : ''].filter(Boolean).join(' ');
    var described = desc ? ' aria-describedby="' + desc + '"' : '';
    return '<div class="field" data-field="' + inp.id + '"' + hidden + '>' +
      '<label for="' + id + '">' + esc(t(inp.label)) + (inp.sym ? '<span class="sym">' + symHtml(inp.sym) + '</span>' : '') + '</label>' +
      '<input id="' + id + '" data-id="' + inp.id + '" type="text" inputmode="decimal" autocomplete="off" value="' + esc(v === undefined || v === null ? '' : v) + '"' + (inp.optional ? ' placeholder="—"' : '') + described + '>' +
      '<span class="unit" id="' + id + '_u">' + esc(unitText(inp.unit)) + '</span>' +
      (inp.hint ? '<span class="hint" id="' + id + '_h">' + esc(t(inp.hint)) + '</span>' : '') + '</div>';
  }

  function unitText(unit) { return unit === '-' ? '' : U.du(unit || ''); }

  var NUMBER = /^\s*[-+]?(\d+[.,]?\d*|[.,]\d+)([eE][-+]?\d+)?\s*$/;
  function parseNum(raw) {
    return NUMBER.test(String(raw)) ? parseFloat(String(raw).replace(',', '.')) : NaN;
  }

  // Values are stored in the calculator's (metric) units, so saved calculations and links work in
  // either system. In the US system a numeric field shows, and accepts, its US customary value.
  function shownValue(inp, v) {
    if (!inp.unit || U.du(inp.unit) === inp.unit) return v;
    var n = parseNum(v);
    return isFinite(n) ? Number(U.toDisplay(n, inp.unit).toPrecision(6)) : v;
  }

  function storedValue(inp, raw) {
    if (!inp || !inp.unit || U.du(inp.unit) === inp.unit) return raw;
    var n = parseNum(raw);
    return isFinite(n) ? Number(U.fromDisplay(n, inp.unit).toPrecision(12)) : raw;
  }

  function applyVisibility() {
    state.def.inputs.forEach(function (inp) {
      if (!inp.id || !inp.showIf) return;
      var el = document.querySelector('[data-field="' + inp.id + '"]');
      if (el) el.hidden = !visible(inp, state.values);
    });
  }

  function applyMaterial(inp, name) {
    var m = PEC.material(name);
    if (!m) return;
    Object.keys(inp.map).forEach(function (prop) {
      var target = inp.map[prop];
      var field = state.def.inputs.filter(function (x) { return x.id === target; })[0];
      if (!field || m[prop] === null || m[prop] === undefined) return;
      var v = PEC.fromSI(PEC.toSI(m[prop], MAT_UNITS[prop]), field.unit);
      v = Number(v.toPrecision(6));
      state.values[target] = v;
      var el = $('#f_' + target);
      if (el) el.value = shownValue(field, v);
    });
  }

  // Editing a property that a material preset fills switches that preset to "Custom values".
  function detachMaterial(fieldId) {
    state.def.inputs.forEach(function (inp) {
      if (inp.type !== 'material') return;
      var mapped = Object.keys(inp.map).some(function (p) { return inp.map[p] === fieldId; });
      if (mapped && state.values[inp.id]) {
        state.values[inp.id] = '';
        var el = $('#f_' + inp.id);
        if (el) el.value = '';
      }
    });
  }

  // ------------------------------------------------------------------ Calculator page
  function openCalc(id, values, meta) {
    if (id === MATERIALS_VIEW) return openMaterials();
    var def = PEC.get(id) || PEC.list[0];
    state.def = def;
    var base = PEC.defaults(def);
    base._project = ''; base._notes = '';
    state.values = Object.assign(base, values || store.loadCurrent(def.id) || {});
    state.snapshotId = meta ? meta.id : null;
    state.snapshotName = meta ? meta.name : null;
    store.setLastCalc(def.id);
    document.body.classList.remove('nav-open');
    renderNav($('#search').value);
    renderCalc();
    root.scrollTo(0, 0);
  }

  function renderCalc() {
    var def = state.def, v = state.values;
    var form = def.inputs.map(function (inp) { return fieldHtml(inp, v); }).join('');
    $('#main').innerHTML =
      '<div class="calc-head"><div class="title-row">' + helpHtml(def) + '<h2>' + esc(t(def.title)) + '</h2></div><p>' + esc(t(def.description || '')) + '</p>' +
      '<div class="meta">' + esc(t('Source:')) + ' <a href="' + esc(def.source) + '" target="_blank" rel="noopener">JPE Precision Point – ' + esc(def.title) + '</a>' +
      '<span id="loadedName"></span></div></div>' +
      '<div class="calc-actions toolbar">' +
      '<button class="btn primary" id="btnSave">' + esc(t('Save')) + '</button>' +
      '<button class="btn" id="btnSaveAs">' + esc(t('Save as…')) + '</button>' +
      '<button class="btn" id="btnPdf">' + esc(t('Export PDF')) + '</button>' +
      '<button class="btn" id="btnPrint">' + esc(t('Print')) + '</button>' +
      '<button class="btn" id="btnLink">' + esc(t('Copy link')) + '</button>' +
      '<button class="btn" id="btnJson">' + esc(t('Download JSON')) + '</button>' +
      '<button class="btn" id="btnReset">' + esc(t('Reset')) + '</button>' +
      '</div>' +
      '<div class="grid">' +
      '<form class="card" id="form" autocomplete="off" onsubmit="return false">' + form +
      '<div class="project"><div class="form-section">' + esc(t('Report')) + '</div>' +
      '<input id="f__project" data-id="_project" placeholder="' + esc(t('Project / reference')) + '" aria-label="' + esc(t('Project / reference')) + '" value="' + esc(v._project || '') + '">' +
      '<textarea id="f__notes" data-id="_notes" placeholder="' + esc(t('Notes (included in the PDF)')) + '" aria-label="' + esc(t('Notes (included in the PDF)')) + '">' + esc(v._notes || '') + '</textarea></div>' +
      '</form>' +
      '<div><div class="card preview" id="previewCard" hidden><div class="preview-head"><h3>' + esc(t('Geometry')) + '</h3>' +
      (PEC.preview.animates(def.id) ? '<button class="btn small" id="btnAnim" aria-pressed="false" title="' + esc(t('Animate the sketch: load, deflect and release')) + '">' + esc(t('▶ Animate')) + '</button>' : '') +
      '</div><div id="preview" role="img" aria-label="' + esc(t('Geometry sketch: {name}', { name: t(def.title) })) + '" aria-describedby="previewNotes"></div><p class="preview-caption" id="previewCaption" hidden></p><p class="preview-notes" id="previewNotes"></p></div>' +
      '<div class="card"><h3>' + esc(t('Results')) + '</h3><div id="warnings"></div><table class="results"><tbody id="results"></tbody></table><div class="charts" id="charts"></div></div>' +
      '<div class="card formulas"><h3>' + esc(t('Formulas')) + '</h3><ul id="formulas"></ul>' +
      '<p class="disclaimer">' + t('Formulas from the free {link} resource. This is an independent tool, not affiliated with JPE. Check results before relying on them for critical designs.', { link: '<a href="https://www.jpe-innovations.com/precision-point/" target="_blank" rel="noopener">JPE Precision Point</a>' }) + '</p></div>' +
      correctionsHtml(PEC.common.citations(def.corrections), t('Differences from the JPE article')) + '</div>' +
      '</div>';

    stopAnim(true);
    bindHelp();
    if ($('#btnAnim')) $('#btnAnim').onclick = function () { if (state.anim) stopAnim(); else startAnim(); };
    $('#form').addEventListener('input', onInput);
    $('#form').addEventListener('change', onInput);
    $('#btnSave').onclick = save;
    $('#btnSaveAs').onclick = function () { save(true); };
    $('#btnPdf').onclick = exportPdf;
    $('#btnPrint').onclick = function () { root.print(); };
    $('#btnLink').onclick = copyLink;
    $('#btnJson').onclick = function () {
      download(fileBase() + '.json', store.exportDoc([{ name: state.snapshotName || def.title, calc: def.id, values: state.values, savedAt: new Date().toISOString() }]));
    };
    $('#btnReset').onclick = function () {
      if (!confirm(t('Reset all inputs of this calculator to their defaults?'))) return;
      store.clearCurrent(def.id);
      openCalc(def.id, PEC.defaults(def));
    };
    updateLoaded();
    recompute();
  }

  // Card listing where a calculation deliberately differs from JPE, with numbered literature references.
  function correctionsHtml(c, title, intro) {
    if (!c.items.length) return '';
    return '<div class="card corrections"><h3>' + esc(title) + '</h3>' + (intro ? '<p>' + esc(intro) + '</p>' : '') + '<ul>' +
      c.items.map(function (it) { return '<li>' + esc(it.raw ? it.text : t(it.text)) + (it.nums.length ? ' <span class="cite">[' + it.nums.join(', ') + ']</span>' : '') + '</li>'; }).join('') +
      '</ul>' + (c.refs.length ? '<h4>' + esc(t('References')) + '</h4><ol class="refs">' + c.refs.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ol>' : '') + '</div>';
  }

  function updateLoaded() {
    var el = $('#loadedName');
    if (el) el.innerHTML = state.snapshotName ? ' · ' + esc(t('Loaded:')) + ' <span class="loaded">' + esc(state.snapshotName) + '</span>' : '';
  }

  function onInput(e) {
    var id = e.target.dataset.id;
    if (!id) return;
    var inp = state.def.inputs.filter(function (x) { return x.id === id; })[0];
    state.values[id] = storedValue(inp, e.target.value);
    if (inp && inp.type === 'material') applyMaterial(inp, e.target.value);
    else if (e.type === 'input') detachMaterial(id);
    if (inp && inp.type === 'select') applyVisibility();
    store.saveCurrent(state.def.id, state.values);
    if (history.replaceState) history.replaceState(null, '', store.toHash(state.def.id, state.values));
    recompute();
  }

  function invalidFields() {
    var bad = [];
    state.def.inputs.forEach(function (inp) {
      if (!inp.id || inp.type === 'heading' || inp.type === 'select' || inp.type === 'material') return;
      var raw = state.values[inp.id];
      var empty = raw === '' || raw === null || raw === undefined;
      var invalid = visible(inp, state.values) && ((empty && !inp.optional) || (!empty && !isFinite(parseNum(raw))));
      var el = $('#f_' + inp.id);
      if (el) { el.classList.toggle('invalid', invalid); if (invalid) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); }
      if (invalid) bad.push(t(inp.label));
    });
    return bad;
  }

  function recompute() {
    var def = state.def, res;
    var bad = invalidFields();
    var formulas = typeof def.formulas === 'function' ? def.formulas(state.values) : (def.formulas || []);
    $('#formulas').innerHTML = formulas.map(function (f) { return '<li>' + esc(t(f)) + '</li>'; }).join('');
    if (bad.length) {
      state.lastResult = null;
      $('#warnings').innerHTML = '<div class="warnings">' + esc(t('Enter a valid number for: {fields}', { fields: bad.join(', ') })) + '</div>';
      $('#results').innerHTML = '';
      $('#charts').innerHTML = '';
      drawPreview();
      return;
    }
    try {
      res = PEC.run(def, state.values);
    } catch (err) {
      state.lastResult = null;
      $('#warnings').innerHTML = '<div class="warnings">' + esc(t('Calculation error: {msg}', { msg: t(err.message) })) + '</div>';
      $('#results').innerHTML = '';
      return;
    }
    state.lastResult = res;
    $('#warnings').innerHTML = res.warnings.length ? '<div class="warnings"><ul>' + res.warnings.map(function (w) { return '<li>' + esc(t(w)) + '</li>'; }).join('') + '</ul></div>' : '';
    $('#results').innerHTML = res.results.map(function (r) {
      if (r.type === 'heading') return '<tr class="section"><td colspan="4">' + esc(t(r.label)) + '</td></tr>';
      return '<tr class="' + (r.highlight || '') + '"><td>' + esc(t(r.label)) + '</td><td class="sym">' + symHtml(r.sym) + '</td>' +
        '<td class="val">' + esc(valueText(r.display)) + '</td><td class="unit">' + esc(unitText(r.unit)) + '</td></tr>';
    }).join('');
    drawCharts();
    drawPreview();
  }

  // Result values are numbers, or a few descriptive texts (e.g. the motion profile shape).
  function valueText(v) { return typeof v === 'string' ? t(v) : PEC.fmt(v); }

  var LIGHT_SKETCH = { fg: '#14181f', muted: '#5a626e', accent: '#1f5ea8', accentSoft: '#e6eef8', fill: '#dfe6ef', fill2: '#c3d0e0', bg: '#ffffff' };

  function sketchColors() {
    var cs = getComputedStyle(document.documentElement);
    var g = function (n) { return cs.getPropertyValue(n).trim(); };
    return { fg: g('--fg'), muted: g('--muted'), accent: g('--accent'), accentSoft: g('--accent-soft'), fill: g('--sketch-fill'), fill2: g('--sketch-fill-2'), bg: g('--surface') };
  }

  function previewFor(colors, anim) {
    if (!state.lastResult || !PEC.preview.has(state.def.id)) return null;
    return PEC.preview.render(state.def.id, PEC.inputsToSI(state.def, state.values), state.lastResult, colors, anim);
  }

  function previewNote(p) {
    var notes = p.notes.map(function (x) { return t(x); }).join('; ');
    if (p.schematic) return p.notes.length ? t('Schematic sketch, not to scale; {notes}.', { notes: notes }) : t('Schematic sketch, not to scale.');
    return p.notes.length ? t('Not to scale: {notes}.', { notes: notes }) : t('Drawn to scale from the inputs.');
  }

  function drawPreview() {
    var card = $('#previewCard');
    if (!card) return;
    var anim = state.anim ? state.anim.phase : undefined;
    var p = previewFor(sketchColors(), anim);
    card.hidden = !p;
    if (!p) return;
    $('#preview').innerHTML = p.svg;
    var cap = $('#previewCaption');
    cap.hidden = anim === undefined || !p.caption;
    cap.innerHTML = anim === undefined ? '' : symHtml(p.caption || '');
    $('#previewNotes').textContent = previewNote(p);
  }

  // ------------------------------------------------------------------ Sketch animation
  // One load → deflect → release cycle every ANIM_PERIOD ms; the sketch is re-rendered each frame.
  var ANIM_PERIOD = 3000;
  var reducedMotion = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function startAnim() {
    stopAnim();
    var a = state.anim = { phase: 0, start: null, raf: 0 };
    var btn = $('#btnAnim');
    if (btn) { btn.textContent = t('❚❚ Stop'); btn.setAttribute('aria-pressed', 'true'); }
    function frame(ts) {
      if (state.anim !== a) return;
      if (a.start === null) a.start = ts;
      // With reduced motion, step through a few still frames instead of a smooth loop.
      var t = (ts - a.start) % ANIM_PERIOD / ANIM_PERIOD;
      a.phase = reducedMotion.matches ? Math.floor(t * 4) / 4 + 0.125 : t;
      drawPreview();
      a.raf = root.requestAnimationFrame(frame);
    }
    a.raf = root.requestAnimationFrame(frame);
  }

  function stopAnim(noRedraw) {
    var a = state.anim;
    state.anim = null;
    if (a) root.cancelAnimationFrame(a.raf);
    var btn = $('#btnAnim');
    if (btn) { btn.textContent = t('▶ Animate'); btn.setAttribute('aria-pressed', 'false'); }
    if (a && !noRedraw) drawPreview();
  }

  // ------------------------------------------------------------------ Theory help ("?" next to the title)
  function helpHtml(def) {
    var t = PEC.THEORY && PEC.THEORY[def.id];
    if (!t) return '';
    var list = function (items) { return '<ul>' + items.map(function (x) { return '<li>' + symHtml(PEC.t(x)) + '</li>'; }).join('') + '</ul>'; };
    return '<span class="help"><button type="button" class="help-btn" id="helpBtn" aria-label="' + esc(PEC.t('Theory: how it works')) + '" aria-expanded="false" aria-controls="helpPop">?</button>' +
      '<div class="help-pop" id="helpPop" role="region" aria-label="' + esc(PEC.t('Theory')) + '" hidden>' +
      '<h3>' + esc(PEC.t('How it works')) + '</h3><p>' + symHtml(PEC.t(t.intro)) + '</p>' +
      (t.points && t.points.length ? '<h4>' + esc(PEC.t('Key points')) + '</h4>' + list(t.points) : '') +
      (t.assumptions && t.assumptions.length ? '<h4>' + esc(PEC.t('Assumptions')) + '</h4>' + list(t.assumptions) : '') +
      (PEC.preview.animates(def.id) ? '<p class="help-tip">' + esc(PEC.t('Tip: press ▶ Animate on the sketch to see the motion.')) + '</p>' : '') +
      '<p class="help-src"><a href="' + esc(def.source) + '" target="_blank" rel="noopener">' + esc(PEC.t('Full article on JPE Precision Point')) + '</a></p>' +
      '</div></span>';
  }

  function bindHelp() {
    var btn = $('#helpBtn'), pop = $('#helpPop');
    if (!btn) return;
    var wrap = btn.parentNode, timer = 0;
    function show(v) {
      clearTimeout(timer);
      showHelp(v);
    }
    function pinned() { return btn.dataset.pinned === '1'; }
    // Hover opens it (with a short grace period to move the mouse into the panel); a click or tap pins it open.
    wrap.addEventListener('mouseenter', function () { show(true); });
    wrap.addEventListener('mouseleave', function () { if (!pinned() && !wrap.contains(document.activeElement)) timer = setTimeout(function () { show(false); }, 250); });
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (pinned()) show(false); else { show(true); btn.dataset.pinned = '1'; }
    });
    btn.addEventListener('focus', function () { show(true); });
    // Close once keyboard focus leaves the button and the panel, so it never covers what gets focus next.
    wrap.addEventListener('focusout', function () { timer = setTimeout(function () { if (!wrap.contains(document.activeElement) && !wrap.matches(':hover')) show(false); }, 150); });
    pop.addEventListener('click', function (e) { e.stopPropagation(); });
  }

  function showHelp(v) {
    var btn = $('#helpBtn'), pop = $('#helpPop');
    if (!btn) return;
    pop.hidden = !v;
    btn.setAttribute('aria-expanded', v ? 'true' : 'false');
    if (!v) delete btn.dataset.pinned;
  }

  function chartsOf(res) { return res ? (res.charts || (res.chart ? [res.chart] : [])) : []; }

  function cssColors() {
    var cs = getComputedStyle(document.documentElement);
    var g = function (n) { return cs.getPropertyValue(n).trim(); };
    return { fg: g('--fg'), muted: g('--muted'), grid: g('--chart-grid'), line: g('--accent'), bg: g('--surface') };
  }

  function drawCharts() {
    var host = $('#charts');
    if (!host) return;
    var charts = chartsOf(state.lastResult);
    host.innerHTML = '';
    if (!charts.length) return;
    var width = Math.max(260, host.clientWidth || 500);
    var colors = cssColors();
    charts.forEach(function (spec) {
      var c = document.createElement('canvas');
      host.appendChild(c);
      PEC.chart.draw(c, spec, { width: width, height: charts.length > 1 ? 190 : 250, colors: colors });
    });
  }

  // ------------------------------------------------------------------ Save / restore
  function save(asNew) {
    if (state.snapshotId && asNew !== true) {
      store.updateSnapshot(state.snapshotId, state.values);
      toast(t('Saved "{name}"', { name: state.snapshotName }));
      return;
    }
    var suggestion = state.values._project || t(state.def.title) + ' ' + new Date().toLocaleDateString(PEC.i18n.locale());
    var name = prompt(t('Name for this calculation:'), suggestion);
    if (!name) return;
    var snap = store.addSnapshot(state.def.id, name.trim(), Object.assign({}, state.values));
    state.snapshotId = snap.id;
    state.snapshotName = snap.name;
    updateLoaded();
    toast(t('Saved "{name}"', { name: snap.name }));
  }

  function renderLibrary() {
    var all = $('#libAll').checked;
    var list = store.snapshots().filter(function (s) { return all || !state.def || s.calc === state.def.id; });
    $('#libList').innerHTML = list.length ? list.map(function (s) {
      var d = PEC.get(s.calc);
      return '<div class="snap"><div><div class="name">' + esc(s.name) + '</div><div class="info">' + esc(d ? t(d.title) : s.calc) + ' · ' + esc(new Date(s.savedAt).toLocaleString(PEC.i18n.locale())) + '</div></div>' +
        '<div class="acts"><button class="btn small primary" data-load="' + s.id + '">' + esc(t('Open')) + '</button>' +
        '<button class="btn small" data-export="' + s.id + '">JSON</button>' +
        '<button class="btn small danger" data-del="' + s.id + '">' + esc(t('Delete')) + '</button></div></div>';
    }).join('') : '<p class="empty">' + esc(t(all ? 'No saved calculations yet. Use “Save” on a calculator, or import a JSON file.' : 'No saved calculations for this calculator yet. Use “Save” on a calculator, or import a JSON file.')) + '</p>';
  }

  function openLibrary() {
    renderLibrary();
    $('#library').showModal();
  }

  function onLibraryClick(e) {
    var b = e.target.closest('button');
    if (!b) return;
    var snaps = store.snapshots();
    var find = function (id) { return snaps.filter(function (s) { return s.id === id; })[0]; };
    if (b.dataset.load) {
      var s = find(b.dataset.load);
      $('#library').close();
      openCalc(s.calc, Object.assign({}, s.values), s);
      store.saveCurrent(s.calc, state.values);
      history.replaceState(null, '', store.toHash(s.calc, state.values));
      toast(t('Opened "{name}"', { name: s.name }));
    } else if (b.dataset.export) {
      var x = find(b.dataset.export);
      download(slug(x.name) + '.json', store.exportDoc([x]));
    } else if (b.dataset.del) {
      var d = find(b.dataset.del);
      if (!confirm(t('Delete "{name}"?', { name: d.name }))) return;
      store.deleteSnapshot(d.id);
      if (state.snapshotId === d.id) { state.snapshotId = null; state.snapshotName = null; updateLoaded(); }
      renderLibrary();
    }
  }

  function exportLibrary() {
    var all = $('#libAll').checked;
    var list = store.snapshots().filter(function (s) { return all || !state.def || s.calc === state.def.id; });
    if (!list.length) { toast(t('Nothing to export')); return; }
    download('calculations-' + new Date().toISOString().slice(0, 10) + '.json', store.exportDoc(list));
  }

  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var snaps = store.parseImport(reader.result);
        if (!snaps.length) throw new Error('The file contains no calculations for this app.');
        store.importSnapshots(snaps);
        $('#libAll').checked = true;
        renderLibrary();
        toast(t(snaps.length > 1 ? 'Imported {n} calculations' : 'Imported {n} calculation', { n: snaps.length }));
      } catch (err) {
        alert(t('Import failed: {msg}', { msg: t(err.message) }));
      }
    };
    reader.readAsText(file);
  }

  function download(name, obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'calculation'; }
  function fileBase() {
    return slug(state.def.id + (state.values._project ? '-' + state.values._project : '')) + '-' + new Date().toISOString().slice(0, 10);
  }

  function copyLink() {
    var url = location.href.split('#')[0] + store.toHash(state.def.id, state.values);
    var done = function () { toast(t('Link copied – it contains all inputs')); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { prompt(t('Copy this link:'), url); });
    else prompt(t('Copy this link:'), url);
  }

  // ------------------------------------------------------------------ PDF
  function displayValue(inp, v) {
    if (inp.type === 'select') {
      var o = inp.options.filter(function (x) { return String(x.v) === String(v); })[0];
      return o ? t(o.label) : String(v);
    }
    if (inp.type === 'material') return v ? t(v) : t('Custom values');
    return v === '' || v === null || v === undefined ? '—' : String(shownValue(inp, v));
  }

  function exportPdf() {
    if (!state.lastResult) { toast(t('Fix the inputs first')); return; }
    var def = state.def, v = state.values, res = state.lastResult;
    var inputs = [];
    def.inputs.forEach(function (inp) {
      if (inp.type === 'heading') { inputs.push({ heading: t(inp.label) }); return; }
      if (!visible(inp, v)) return;
      inputs.push({ label: t(inp.label), sym: inp.sym || '', value: displayValue(inp, v[inp.id]), unit: unitText(inp.unit) });
    });
    // Drop headings with no rows after them.
    inputs = inputs.filter(function (row, k) { return !row.heading || (inputs[k + 1] && !inputs[k + 1].heading); });
    var results = res.results.map(function (r) {
      if (r.type === 'heading') return { heading: t(r.label) };
      return { label: t(r.label), sym: r.sym, value: valueText(r.display), unit: unitText(r.unit) };
    });
    var colors = { fg: '#14181f', muted: '#5a626e', grid: '#e6e9ee', line: '#1f5ea8', bg: '#ffffff' };
    var charts = chartsOf(res).map(function (spec) {
      var c = document.createElement('canvas');
      PEC.chart.draw(c, spec, { width: 720, height: 240, colors: colors, scale: 2 });
      return { dataUrl: c.toDataURL('image/jpeg', 0.9), w: 720, h: 240 };
    });
    var btn = $('#btnPdf');
    btn.disabled = true; btn.textContent = t('Preparing…');
    var sketch = previewFor(LIGHT_SKETCH);
    var sketchImg = sketch ? PEC.preview.toImage(sketch.svg, PEC.preview.size(sketch.svg).w, PEC.preview.size(sketch.svg).h, 3).then(function (url) {
      var sz = PEC.preview.size(sketch.svg);
      return { dataUrl: url, w: sz.w, h: sz.h, note: previewNote(sketch) };
    }, function () { return null; }) : Promise.resolve(null);
    sketchImg.then(function (preview) { return PEC.pdf.exportPdf({
      preview: preview,
      title: t(def.title),
      subtitle: t('Precision Engineering Calculators') + ' · ' + t(def.category),
      date: new Date().toLocaleString(PEC.i18n.locale()),
      project: v._project || state.snapshotName || '',
      notes: v._notes || '',
      inputs: inputs, results: results, warnings: res.warnings.map(function (w) { return t(w); }), charts: charts,
      formulas: (typeof def.formulas === 'function' ? def.formulas(v) : (def.formulas || [])).map(function (f) { return t(f); }),
      corrections: PEC.common.citations(def.corrections),
      source: def.source
    }, fileBase() + '.pdf'); }).then(function () {
      toast(t('PDF downloaded'));
    }, function (err) {
      alert(t('PDF export failed: {msg}', { msg: t(err.message) }));
    }).then(function () { btn.disabled = false; btn.textContent = t('Export PDF'); });
  }

  // ------------------------------------------------------------------ Materials reference
  function openMaterials() {
    stopAnim(true);
    state.def = null;
    store.setLastCalc(MATERIALS_VIEW);
    document.body.classList.remove('nav-open');
    renderNav($('#search').value);
    history.replaceState(null, '', '#/' + MATERIALS_VIEW);
    var cell = function (v, unit) { return v === null ? '–' : U.du(unit) === unit ? v : PEC.fmt(U.toDisplay(v, unit), 3); };
    // Notes on corrected (†) or questionable (?) JPE values, numbered in table order.
    var notes = [];
    PEC.MATERIALS.forEach(function (m) {
      Object.keys(m.notes).forEach(function (k) { notes.push({ m: m.name, k: k, text: m.notes[k].text, refs: m.notes[k].refs, corrected: m.notes[k].corrected }); });
    });
    var cite = PEC.common.citations(notes);
    var mark = function (m, k) {
      for (var n = 0; n < notes.length; n++) {
        if (notes[n].m === m.name && notes[n].k === k) return ' <sup class="mat-note" title="' + esc(t(notes[n].text)) + '">' + (notes[n].corrected ? '†' : '?') + (n + 1) + '</sup>';
      }
      return '';
    };
    var head = function (sym, unit) { return '<th>' + sym + ' [' + esc(U.du(unit)) + ']</th>'; };
    var rows = PEC.MATERIALS.map(function (m) {
      return '<tr><td>' + esc(t(m.name)) + '</td><td>' + cell(m.E, 'GPa') + '</td><td>' + cell(m.rho, 'kg/m³') + '</td><td>' + cell(m.sy, 'MPa') + mark(m, 'sy') + '</td><td>' + cell(m.su, 'MPa') + '</td><td>' + cell(m.sf, 'MPa') + ' <small>(' + esc(t(m.sfNote)) + ')</small>' + mark(m, 'sf') + '</td><td>' + cell(m.alpha, 'µm/m·K') + mark(m, 'alpha') + '</td><td>' + cell(m.c, 'J/kg·K') + '</td><td>' + cell(m.lambda, 'W/m·K') + mark(m, 'lambda') + '</td><td>' + m.nu + '</td></tr>';
    }).join('');
    $('#main').innerHTML = '<div class="calc-head"><h2>' + esc(t('Material properties')) + '</h2>' +
      '<p>' + esc(t('Used as presets in the calculators. Where JPE gives a range, the lower bound is used for strength and the midpoint for stiffness and thermal values. Poisson\'s ratio is not part of the JPE table; typical handbook values are shown.')) + '</p>' +
      '<div class="meta">' + esc(t('Source:')) + ' <a href="https://www.jpe-innovations.com/precision-point/common-materials-selection-properties/" target="_blank" rel="noopener">JPE Precision Point – Common materials: Selection and properties</a></div></div>' +
      '<div class="card table-wrap" style="margin-top:16px"><table class="materials"><thead><tr><th>' + esc(t('Material')) + '</th>' + head('E', 'GPa') + head('ρ', 'kg/m³') + head('σ₀.₂', 'MPa') + head('σ_max', 'MPa') + head('σ_fatigue', 'MPa') + head('α', 'µm/m·K') + head('c', 'J/kg·K') + head('λ', 'W/m·K') + '<th>ν (' + esc(t('typ.')) + ')</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      correctionsHtml({ items: cite.items.map(function (it, n) { return { text: (notes[n].corrected ? '† ' : '? ') + (n + 1) + ' ' + t(notes[n].m) + ': ' + t(it.text), nums: it.nums, raw: true }; }), refs: cite.refs }, t('Differences from the JPE table'), t('† corrected from the literature, ? JPE value kept but questionable.'));
  }

  // ------------------------------------------------------------------ Language
  // Static texts in index.html carry their English source text in data-i18n* attributes.
  function applyStaticTexts() {
    document.documentElement.lang = PEC.i18n.lang();
    document.title = t('Precision Engineering Calculators');
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.dataset.i18n); });
    [['data-i18n-title', 'title'], ['data-i18n-placeholder', 'placeholder'], ['data-i18n-aria-label', 'aria-label']].forEach(function (p) {
      document.querySelectorAll('[' + p[0] + ']').forEach(function (el) { el.setAttribute(p[1], t(el.getAttribute(p[0]))); });
    });
  }

  function rerender() {
    if (state.def) {
      renderNav($('#search').value);
      renderCalc();
    } else {
      openMaterials();
    }
  }

  function setLanguage(code) {
    PEC.i18n.setLang(code);
    applyStaticTexts();
    if ($('#library').open) renderLibrary();
    rerender();
  }

  // ------------------------------------------------------------------ Unit system
  function initUnits() {
    var btns = document.querySelectorAll('#unitSwitch [data-units]');
    function sync() {
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.units === U.system())); });
    }
    btns.forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.units === U.system()) return;
        U.set(b.dataset.units);
        sync();
        rerender();
      };
    });
    sync();
  }

  function initLanguage() {
    var sel = $('#langSelect'), narrow = root.matchMedia('(max-width: 760px)');
    // Phones show the short language code so the header keeps room for the title.
    function options() {
      sel.innerHTML = PEC.i18n.LANGS.map(function (l) {
        return '<option value="' + l.code + '" lang="' + l.code + '"' + (l.code === PEC.i18n.lang() ? ' selected' : '') + '>' + esc(narrow.matches ? l.code.toUpperCase() : l.name) + '</option>';
      }).join('');
    }
    options();
    if (narrow.addEventListener) narrow.addEventListener('change', options);
    sel.onchange = function () { setLanguage(sel.value); };
    applyStaticTexts();
  }

  // ------------------------------------------------------------------ Boot
  function routeFromHash() {
    var h = store.fromHash(location.hash);
    if (h && h.calc === MATERIALS_VIEW) { openMaterials(); return true; }
    if (h && PEC.get(h.calc)) {
      var hasValues = Object.keys(h.values).length > 0;
      openCalc(h.calc, hasValues ? Object.assign(PEC.defaults(PEC.get(h.calc)), h.values) : null);
      return true;
    }
    return false;
  }

  function init() {
    initLanguage();
    initUnits();
    renderNav('');
    $('#nav').addEventListener('click', function (e) {
      var b = e.target.closest('[data-calc]');
      if (!b) return;
      if (b.dataset.calc === MATERIALS_VIEW) { openMaterials(); return; }
      openCalc(b.dataset.calc);
      history.replaceState(null, '', store.toHash(state.def.id, state.values));
    });
    $('#search').addEventListener('input', function (e) { renderNav(e.target.value); });
    // Skip link: move focus to the calculator without touching the URL hash (it holds the inputs).
    $('.skip-link').addEventListener('click', function (e) { e.preventDefault(); $('#main').focus(); });
    // Close the theory panel on an outside click or Escape.
    document.addEventListener('click', function () { if ($('#helpPop') && !$('#helpPop').hidden) showHelp(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if ($('#helpPop') && !$('#helpPop').hidden) { showHelp(false); $('#helpBtn').focus(); }
      else if (document.body.classList.contains('nav-open')) { document.body.classList.remove('nav-open'); syncMenu(); $('#menuToggle').focus(); }
    });
    // Menu button: on phones it opens the calculator list as an overlay; on wider screens it
    // collapses the list so the calculator gets the full page width (remembered per browser).
    var mobile = root.matchMedia('(max-width: 760px)');
    function syncMenu() {
      var open = mobile.matches ? document.body.classList.contains('nav-open') : !document.body.classList.contains('nav-collapsed');
      $('#menuToggle').setAttribute('aria-expanded', String(open));
    }
    try { if (localStorage.getItem('pec:v1:navCollapsed') === '1') document.body.classList.add('nav-collapsed'); } catch (e) { /* ignore */ }
    $('#menuToggle').onclick = function () {
      if (mobile.matches) document.body.classList.toggle('nav-open');
      else {
        var collapsed = document.body.classList.toggle('nav-collapsed');
        try { localStorage.setItem('pec:v1:navCollapsed', collapsed ? '1' : '0'); } catch (e) { /* ignore */ }
        drawCharts();
      }
      syncMenu();
    };
    if (mobile.addEventListener) mobile.addEventListener('change', syncMenu);
    syncMenu();
    $('#btnLibrary').onclick = openLibrary;
    $('#libClose').onclick = function () { $('#library').close(); };
    $('#libAll').onchange = renderLibrary;
    $('#libList').addEventListener('click', onLibraryClick);
    $('#libExport').onclick = exportLibrary;
    $('#libImport').onclick = function () { $('#libFile').click(); };
    $('#libFile').onchange = function (e) { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ''; };
    $('#btnTheme').onclick = function () {
      var dark = getComputedStyle(document.documentElement).getPropertyValue('color-scheme').trim() === 'dark';
      var next = dark ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('pec:v1:theme', next); } catch (e) { /* ignore */ }
      drawCharts();
      drawPreview();
    };
    root.addEventListener('hashchange', function () { routeFromHash(); });
    var resizeT;
    root.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(drawCharts, 150); });

    if (!routeFromHash()) {
      var last = store.lastCalc();
      if (last === MATERIALS_VIEW) openMaterials();
      else openCalc(last && PEC.get(last) ? last : PEC.list[0].id);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
