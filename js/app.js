/*
 * UI: navigation, input form, live results, charts, saving/restoring and PDF export.
 */
(function (root) {
  'use strict';
  var PEC = root.PEC, store = PEC.store;
  var $ = function (sel, el) { return (el || document).querySelector(sel); };

  // Units of the properties in PEC.MATERIALS.
  var MAT_UNITS = { E: 'GPa', nu: '-', sy: 'MPa', sf: 'MPa', su: 'MPa', rho: 'kg/m³', alpha: 'µm/m·K' };
  var MATERIALS_VIEW = 'materials';

  var state = { def: null, values: null, snapshotId: null, snapshotName: null, lastResult: null };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  // Display symbols with real subscripts: "C_Ax" → C<sub>Ax</sub>.
  function symHtml(s) {
    return esc(s || '').replace(/_([^\s,()=/·+]+)/g, '<sub>$1</sub>');
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
      if (f && (d.title + ' ' + d.category + ' ' + d.description).toLowerCase().indexOf(f) < 0) return;
      (groups[d.category] = groups[d.category] || []).push(d);
    });
    var cur = state.def ? state.def.id : (location.hash === '#/' + MATERIALS_VIEW ? MATERIALS_VIEW : '');
    var html = Object.keys(groups).map(function (g) {
      return '<div class="nav-group"><h3>' + esc(g) + '</h3>' + groups[g].map(function (d) {
        return '<button class="nav-item' + (d.id === cur ? ' active' : '') + '" data-calc="' + d.id + '">' + esc(d.title) + '</button>';
      }).join('') + '</div>';
    }).join('');
    if (!f || 'materials properties reference'.indexOf(f) >= 0) {
      html += '<div class="nav-group"><h3>Reference</h3><button class="nav-item' + (cur === MATERIALS_VIEW ? ' active' : '') + '" data-calc="' + MATERIALS_VIEW + '">Material properties</button></div>';
    }
    $('#nav').innerHTML = html || '<p class="empty">No calculator matches.</p>';
  }

  // ------------------------------------------------------------------ Form
  function visible(inp, values) {
    if (!inp.showIf) return true;
    return inp.showIf.values.indexOf(values[inp.showIf.field]) >= 0;
  }

  function fieldHtml(inp, values) {
    var hidden = visible(inp, values) ? '' : ' hidden';
    if (inp.type === 'heading') return '<div class="form-section">' + esc(inp.label) + '</div>';
    var v = values[inp.id];
    var id = 'f_' + inp.id;
    if (inp.type === 'select' || inp.type === 'material') {
      var opts = inp.type === 'material'
        ? [{ v: '', label: 'Custom values' }].concat(PEC.MATERIALS.map(function (m) { return { v: m.name, label: m.name }; }))
        : inp.options;
      return '<div class="field wide" data-field="' + inp.id + '"' + hidden + '><label for="' + id + '">' + esc(inp.label) + '</label>' +
        '<select id="' + id + '" data-id="' + inp.id + '">' + opts.map(function (o) {
          return '<option value="' + esc(o.v) + '"' + (String(o.v) === String(v) ? ' selected' : '') + '>' + esc(o.label) + '</option>';
        }).join('') + '</select></div>';
    }
    return '<div class="field" data-field="' + inp.id + '"' + hidden + '>' +
      '<label for="' + id + '">' + esc(inp.label) + (inp.sym ? '<span class="sym">' + symHtml(inp.sym) + '</span>' : '') + '</label>' +
      '<input id="' + id + '" data-id="' + inp.id + '" type="text" inputmode="decimal" autocomplete="off" value="' + esc(v === undefined || v === null ? '' : v) + '"' + (inp.optional ? ' placeholder="—"' : '') + '>' +
      '<span class="unit">' + esc(inp.unit === '-' ? '' : inp.unit || '') + '</span>' +
      (inp.hint ? '<span class="hint">' + esc(inp.hint) + '</span>' : '') + '</div>';
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
      if (el) el.value = v;
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
      '<div class="calc-head"><h2>' + esc(def.title) + '</h2><p>' + esc(def.description || '') + '</p>' +
      '<div class="meta">Source: <a href="' + esc(def.source) + '" target="_blank" rel="noopener">JPE Precision Point – ' + esc(def.title) + '</a>' +
      '<span id="loadedName"></span></div></div>' +
      '<div class="calc-actions toolbar">' +
      '<button class="btn primary" id="btnSave">Save</button>' +
      '<button class="btn" id="btnSaveAs">Save as…</button>' +
      '<button class="btn" id="btnPdf">Export PDF</button>' +
      '<button class="btn" id="btnPrint">Print</button>' +
      '<button class="btn" id="btnLink">Copy link</button>' +
      '<button class="btn" id="btnJson">Download JSON</button>' +
      '<button class="btn" id="btnReset">Reset</button>' +
      '</div>' +
      '<div class="grid">' +
      '<form class="card" id="form" autocomplete="off" onsubmit="return false">' + form +
      '<div class="project"><div class="form-section">Report</div>' +
      '<input id="f__project" data-id="_project" placeholder="Project / reference" value="' + esc(v._project || '') + '">' +
      '<textarea id="f__notes" data-id="_notes" placeholder="Notes (included in the PDF)">' + esc(v._notes || '') + '</textarea></div>' +
      '</form>' +
      '<div><div class="card preview" id="previewCard" hidden><h3>Geometry</h3><div id="preview"></div><p class="preview-notes" id="previewNotes"></p></div>' +
      '<div class="card"><h3>Results</h3><div id="warnings"></div><table class="results"><tbody id="results"></tbody></table><div class="charts" id="charts"></div></div>' +
      '<div class="card formulas"><h3>Formulas</h3><ul id="formulas"></ul>' +
      '<p class="disclaimer">Formulas from the free <a href="https://www.jpe-innovations.com/precision-point/" target="_blank" rel="noopener">JPE Precision Point</a> resource. This is an independent tool, not affiliated with JPE. Check results before relying on them for critical designs.</p></div></div>' +
      '</div>';

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
      if (!confirm('Reset all inputs of this calculator to their defaults?')) return;
      store.clearCurrent(def.id);
      openCalc(def.id, PEC.defaults(def));
    };
    updateLoaded();
    recompute();
  }

  function updateLoaded() {
    var el = $('#loadedName');
    if (el) el.innerHTML = state.snapshotName ? ' · Loaded: <span class="loaded">' + esc(state.snapshotName) + '</span>' : '';
  }

  function onInput(e) {
    var id = e.target.dataset.id;
    if (!id) return;
    state.values[id] = e.target.value;
    var inp = state.def.inputs.filter(function (x) { return x.id === id; })[0];
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
      var num = parseFloat(String(raw).replace(',', '.'));
      var invalid = visible(inp, state.values) && ((empty && !inp.optional) || (!empty && (!isFinite(num) || !/^\s*[-+]?(\d+[.,]?\d*|[.,]\d+)([eE][-+]?\d+)?\s*$/.test(String(raw)))));
      var el = $('#f_' + inp.id);
      if (el) el.classList.toggle('invalid', invalid);
      if (invalid) bad.push(inp.label);
    });
    return bad;
  }

  function recompute() {
    var def = state.def, res;
    var bad = invalidFields();
    var formulas = typeof def.formulas === 'function' ? def.formulas(state.values) : (def.formulas || []);
    $('#formulas').innerHTML = formulas.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('');
    if (bad.length) {
      state.lastResult = null;
      $('#warnings').innerHTML = '<div class="warnings">Enter a valid number for: ' + esc(bad.join(', ')) + '</div>';
      $('#results').innerHTML = '';
      $('#charts').innerHTML = '';
      drawPreview();
      return;
    }
    try {
      res = PEC.run(def, state.values);
    } catch (err) {
      state.lastResult = null;
      $('#warnings').innerHTML = '<div class="warnings">Calculation error: ' + esc(err.message) + '</div>';
      $('#results').innerHTML = '';
      return;
    }
    state.lastResult = res;
    $('#warnings').innerHTML = res.warnings.length ? '<div class="warnings"><ul>' + res.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>' : '';
    $('#results').innerHTML = res.results.map(function (r) {
      if (r.type === 'heading') return '<tr class="section"><td colspan="4">' + esc(r.label) + '</td></tr>';
      return '<tr class="' + (r.highlight || '') + '"><td>' + esc(r.label) + '</td><td class="sym">' + symHtml(r.sym) + '</td>' +
        '<td class="val">' + esc(PEC.fmt(r.display)) + '</td><td class="unit">' + esc(r.unit === '-' ? '' : r.unit) + '</td></tr>';
    }).join('');
    drawCharts();
    drawPreview();
  }

  var LIGHT_SKETCH = { fg: '#14181f', muted: '#5a626e', accent: '#1f5ea8', accentSoft: '#e6eef8', fill: '#dfe6ef', fill2: '#c3d0e0', bg: '#ffffff' };

  function sketchColors() {
    var cs = getComputedStyle(document.documentElement);
    var g = function (n) { return cs.getPropertyValue(n).trim(); };
    return { fg: g('--fg'), muted: g('--muted'), accent: g('--accent'), accentSoft: g('--accent-soft'), fill: g('--sketch-fill'), fill2: g('--sketch-fill-2'), bg: g('--surface') };
  }

  function previewFor(colors) {
    if (!state.lastResult || !PEC.preview.has(state.def.id)) return null;
    return PEC.preview.render(state.def.id, PEC.inputsToSI(state.def, state.values), state.lastResult, colors);
  }

  function previewNote(p) {
    if (p.schematic) return 'Schematic sketch, not to scale' + (p.notes.length ? '; ' + p.notes.join('; ') : '') + '.';
    return p.notes.length ? 'Not to scale: ' + p.notes.join('; ') + '.' : 'Drawn to scale from the inputs.';
  }

  function drawPreview() {
    var card = $('#previewCard');
    if (!card) return;
    var p = previewFor(sketchColors());
    card.hidden = !p;
    if (!p) return;
    $('#preview').innerHTML = p.svg;
    $('#previewNotes').textContent = previewNote(p);
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
      toast('Saved "' + state.snapshotName + '"');
      return;
    }
    var suggestion = state.values._project || state.def.title + ' ' + new Date().toLocaleDateString();
    var name = prompt('Name for this calculation:', suggestion);
    if (!name) return;
    var snap = store.addSnapshot(state.def.id, name.trim(), Object.assign({}, state.values));
    state.snapshotId = snap.id;
    state.snapshotName = snap.name;
    updateLoaded();
    toast('Saved "' + snap.name + '"');
  }

  function renderLibrary() {
    var all = $('#libAll').checked;
    var list = store.snapshots().filter(function (s) { return all || !state.def || s.calc === state.def.id; });
    $('#libList').innerHTML = list.length ? list.map(function (s) {
      var d = PEC.get(s.calc);
      return '<div class="snap"><div><div class="name">' + esc(s.name) + '</div><div class="info">' + esc(d ? d.title : s.calc) + ' · ' + esc(new Date(s.savedAt).toLocaleString()) + '</div></div>' +
        '<div class="acts"><button class="btn small primary" data-load="' + s.id + '">Open</button>' +
        '<button class="btn small" data-export="' + s.id + '">JSON</button>' +
        '<button class="btn small danger" data-del="' + s.id + '">Delete</button></div></div>';
    }).join('') : '<p class="empty">No saved calculations' + (all ? '' : ' for this calculator') + ' yet. Use “Save” on a calculator, or import a JSON file.</p>';
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
      toast('Opened "' + s.name + '"');
    } else if (b.dataset.export) {
      var x = find(b.dataset.export);
      download(slug(x.name) + '.json', store.exportDoc([x]));
    } else if (b.dataset.del) {
      var d = find(b.dataset.del);
      if (!confirm('Delete "' + d.name + '"?')) return;
      store.deleteSnapshot(d.id);
      if (state.snapshotId === d.id) { state.snapshotId = null; state.snapshotName = null; updateLoaded(); }
      renderLibrary();
    }
  }

  function exportLibrary() {
    var all = $('#libAll').checked;
    var list = store.snapshots().filter(function (s) { return all || !state.def || s.calc === state.def.id; });
    if (!list.length) { toast('Nothing to export'); return; }
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
        toast('Imported ' + snaps.length + ' calculation' + (snaps.length > 1 ? 's' : ''));
      } catch (err) {
        alert('Import failed: ' + err.message);
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
    var done = function () { toast('Link copied – it contains all inputs'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { prompt('Copy this link:', url); });
    else prompt('Copy this link:', url);
  }

  // ------------------------------------------------------------------ PDF
  function displayValue(inp, v) {
    if (inp.type === 'select') {
      var o = inp.options.filter(function (x) { return String(x.v) === String(v); })[0];
      return o ? o.label : String(v);
    }
    if (inp.type === 'material') return v || 'Custom values';
    return v === '' || v === null || v === undefined ? '—' : String(v);
  }

  function exportPdf() {
    if (!state.lastResult) { toast('Fix the inputs first'); return; }
    var def = state.def, v = state.values, res = state.lastResult;
    var inputs = [];
    def.inputs.forEach(function (inp) {
      if (inp.type === 'heading') { inputs.push({ heading: inp.label }); return; }
      if (!visible(inp, v)) return;
      inputs.push({ label: inp.label, sym: inp.sym || '', value: displayValue(inp, v[inp.id]), unit: inp.unit === '-' ? '' : (inp.unit || '') });
    });
    // Drop headings with no rows after them.
    inputs = inputs.filter(function (row, k) { return !row.heading || (inputs[k + 1] && !inputs[k + 1].heading); });
    var results = res.results.map(function (r) {
      if (r.type === 'heading') return { heading: r.label };
      return { label: r.label, sym: r.sym, value: PEC.fmt(r.display), unit: r.unit === '-' ? '' : r.unit };
    });
    var colors = { fg: '#14181f', muted: '#5a626e', grid: '#e6e9ee', line: '#1f5ea8', bg: '#ffffff' };
    var charts = chartsOf(res).map(function (spec) {
      var c = document.createElement('canvas');
      PEC.chart.draw(c, spec, { width: 720, height: 240, colors: colors, scale: 2 });
      return { dataUrl: c.toDataURL('image/jpeg', 0.9), w: 720, h: 240 };
    });
    var btn = $('#btnPdf');
    btn.disabled = true; btn.textContent = 'Preparing…';
    var sketch = previewFor(LIGHT_SKETCH);
    var sketchImg = sketch ? PEC.preview.toImage(sketch.svg, PEC.preview.size(sketch.svg).w, PEC.preview.size(sketch.svg).h, 3).then(function (url) {
      var sz = PEC.preview.size(sketch.svg);
      return { dataUrl: url, w: sz.w, h: sz.h, note: previewNote(sketch) };
    }, function () { return null; }) : Promise.resolve(null);
    sketchImg.then(function (preview) { return PEC.pdf.exportPdf({
      preview: preview,
      title: def.title,
      subtitle: 'Precision Engineering Calculators · ' + def.category,
      date: new Date().toLocaleString(),
      project: v._project || state.snapshotName || '',
      notes: v._notes || '',
      inputs: inputs, results: results, warnings: res.warnings, charts: charts,
      formulas: typeof def.formulas === 'function' ? def.formulas(v) : (def.formulas || []),
      source: def.source
    }, fileBase() + '.pdf'); }).then(function () {
      toast('PDF downloaded');
    }, function (err) {
      alert('PDF export failed: ' + err.message);
    }).then(function () { btn.disabled = false; btn.textContent = 'Export PDF'; });
  }

  // ------------------------------------------------------------------ Materials reference
  function openMaterials() {
    state.def = null;
    store.setLastCalc(MATERIALS_VIEW);
    document.body.classList.remove('nav-open');
    renderNav($('#search').value);
    history.replaceState(null, '', '#/' + MATERIALS_VIEW);
    var rows = PEC.MATERIALS.map(function (m) {
      return '<tr><td>' + esc(m.name) + '</td><td>' + m.E + '</td><td>' + m.rho + '</td><td>' + m.sy + '</td><td>' + m.su + '</td><td>' + m.sf + ' <small>(' + esc(m.sfNote) + ')</small></td><td>' + m.alpha + '</td><td>' + (m.c === null ? '–' : m.c) + '</td><td>' + m.lambda + '</td><td>' + m.nu + '</td></tr>';
    }).join('');
    $('#main').innerHTML = '<div class="calc-head"><h2>Material properties</h2>' +
      '<p>Used as presets in the calculators. Where JPE gives a range, the lower bound is used for strength and the midpoint for stiffness and thermal values. Poisson\'s ratio is not part of the JPE table; typical handbook values are shown.</p>' +
      '<div class="meta">Source: <a href="https://www.jpe-innovations.com/precision-point/common-materials-selection-properties/" target="_blank" rel="noopener">JPE Precision Point – Common materials: Selection and properties</a></div></div>' +
      '<div class="card table-wrap" style="margin-top:16px"><table class="materials"><thead><tr><th>Material</th><th>E [GPa]</th><th>ρ [kg/m³]</th><th>σ₀.₂ [MPa]</th><th>σ_max [MPa]</th><th>σ_fatigue [MPa]</th><th>α [µm/m·K]</th><th>c [J/kg·K]</th><th>λ [W/m·K]</th><th>ν (typ.)</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
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
    renderNav('');
    $('#nav').addEventListener('click', function (e) {
      var b = e.target.closest('[data-calc]');
      if (!b) return;
      if (b.dataset.calc === MATERIALS_VIEW) { openMaterials(); return; }
      openCalc(b.dataset.calc);
      history.replaceState(null, '', store.toHash(state.def.id, state.values));
    });
    $('#search').addEventListener('input', function (e) { renderNav(e.target.value); });
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
