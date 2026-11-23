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
  var MATERIALS_VIEW = 'materials', ABOUT_VIEW = 'about';
  var AUTHOR_URL = 'https://ehcrea.com', PATREON_URL = 'https://www.patreon.com/ehcrea', REPO_URL = 'https://github.com/ehcrea/Engineering-Calculators';
  var INSTAGRAM_URL = 'https://www.instagram.com/ehcrea.studio', FACEBOOK_URL = 'https://www.facebook.com/ehcrea.studio';
  var INSTAGRAM_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.3" fill="currentColor"/></svg>';
  var FACEBOOK_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H7.9v3h2.6V21h3z"/></svg>';

  var state = { def: null, values: null, snapshotId: null, snapshotName: null, lastResult: null, anim: null };

  // Every calculator has its own page (leaf-spring/, de/leaf-spring/, …) so search engines can list it.
  // The loaded page says where it sits: <html data-page="de" data-calc="leaf-spring">.
  var PAGE_LANG = document.documentElement.dataset.page || '';
  var PAGE_CALC = document.documentElement.dataset.calc || '';
  var SITE_ROOT = (function () {
    var up = (PAGE_LANG && PAGE_LANG !== 'en' ? 1 : 0) + (PAGE_CALC ? 1 : 0);
    try { return new URL(new Array(up + 1).join('../'), location.href).href.split('#')[0]; } catch (e) { return ''; }
  })();
  var HOME_TITLE = document.title;

  function langRoot(lang) { return SITE_ROOT + (lang === 'en' ? '' : lang + '/'); }
  function pageUrl(calcId) { return langRoot(PAGE_LANG || 'en') + (calcId ? calcId + '/' : ''); }

  // Put the view in the URL: the calculator's own page plus the inputs in the hash.
  function setUrl(hash) {
    if (!history.replaceState) return;
    var path = PAGE_LANG && SITE_ROOT ? pageUrl(state.def ? state.def.id : '') : '';
    try { history.replaceState(null, '', path + hash); } catch (e) { history.replaceState(null, '', hash); }
  }

  function setTitle(name) {
    document.title = name ? name + ' | ' + t('Precision Engineering Calculators') : HOME_TITLE;
  }

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
    var cur = state.def ? state.def.id : [MATERIALS_VIEW, ABOUT_VIEW].filter(function (v) { return location.hash === '#/' + v; })[0] || '';
    var navItem = function (id, title) {
      return '<button class="nav-item' + (id === cur ? ' active" aria-current="page' : '') + '" data-calc="' + id + '">' + esc(title) + '</button>';
    };
    var html = Object.keys(groups).map(function (g) {
      return '<div class="nav-group"><h2>' + esc(t(g)) + '</h2>' + groups[g].map(function (d) {
        return '<button class="nav-item' + (d.id === cur ? ' active" aria-current="page' : '') + '" data-calc="' + d.id + '">' + esc(t(d.title)) + '</button>';
      }).join('') + '</div>';
    }).join('');
    var ref = '';
    if (!f || ['materials properties reference', t('Reference'), t('Material properties')].join(' ').toLowerCase().indexOf(f) >= 0) ref += navItem(MATERIALS_VIEW, t('Material properties'));
    if (!f || ['about license author', t('About')].join(' ').toLowerCase().indexOf(f) >= 0) ref += navItem(ABOUT_VIEW, t('About'));
    if (ref) html += '<div class="nav-group"><h2>' + esc(t('Reference')) + '</h2>' + ref + '</div>';
    $('#nav').innerHTML = html || '<p class="empty">' + esc(t('No calculator matches.')) + '</p>';
    var about = $('#btnAbout');
    if (about) { if (cur === ABOUT_VIEW) about.setAttribute('aria-current', 'page'); else about.removeAttribute('aria-current'); }
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
    if (id === ABOUT_VIEW) return openAbout();
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
    setTitle(t('{name} calculator', { name: t(def.title) }));
    root.scrollTo(0, 0);
  }

  function renderCalc() {
    var def = state.def, v = state.values;
    var form = def.inputs.map(function (inp) { return fieldHtml(inp, v); }).join('');
    $('#main').innerHTML =
      '<div class="calc-head"><div class="title-row">' + helpHtml(def) + '<h2>' + esc(t(def.title)) + '</h2></div><p>' + esc(t(def.description || '')) + '</p>' +
      '<div class="meta">' + (def.source ? esc(t('Source:')) + ' <a href="' + esc(def.source) + '" target="_blank" rel="noopener">JPE Precision Point – ' + esc(def.title) + '</a>' : esc(t('Based on:')) + ' ' + esc(t(def.basis || ''))) +
      '<span id="loadedName"></span></div></div>' +
      '<div class="calc-actions toolbar">' +
      '<button class="btn primary" id="btnSave">' + esc(t('Save')) + '</button>' +
      '<button class="btn secondary" id="btnSaveAs">' + esc(t('Save as…')) + '</button>' +
      '<button class="btn" id="btnPdf">' + esc(t('Export PDF')) + '</button>' +
      '<button class="btn more-toggle" id="btnMore" type="button" aria-expanded="false" aria-controls="moreActions">' + esc(t('More…')) + '</button>' +
      '<span class="more-actions secondary" id="moreActions">' +
      '<button class="btn" id="btnPrint">' + esc(t('Print')) + '</button>' +
      '<button class="btn" id="btnLink">' + esc(t('Copy link')) + '</button>' +
      '<button class="btn" id="btnJson">' + esc(t('Download JSON')) + '</button>' +
      '<button class="btn" id="btnReset">' + esc(t('Reset')) + '</button>' +
      '</span>' +
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
      '<p class="disclaimer">' + (def.source ? t('Formulas from the free {link} resource. This is an independent tool, not affiliated with JPE. Check results before relying on them for critical designs.', { link: '<a href="https://www.jpe-innovations.com/precision-point/" target="_blank" rel="noopener">JPE Precision Point</a>' }) : esc(t('Check results before relying on them for critical designs.'))) + '</p></div>' +
      correctionsHtml(PEC.common.citations(def.corrections), t('Differences from the JPE article')) + '</div>' +
      '</div>';

    stopAnim(true);
    bindHelp();
    if ($('#btnAnim')) $('#btnAnim').onclick = function () { if (state.anim) stopAnim(); else startAnim(); };
    $('#form').addEventListener('input', onInput);
    $('#form').addEventListener('change', onInput);
    $('#btnSave').onclick = save;
    $('#btnMore').onclick = function () {
      var bar = $('.calc-actions'), open = !bar.classList.contains('open');
      bar.classList.toggle('open', open);
      this.setAttribute('aria-expanded', String(open));
    };
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
    setUrl(store.toHash(state.def.id, state.values));
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
      (def.source ? '<p class="help-src"><a href="' + esc(def.source) + '" target="_blank" rel="noopener">' + esc(PEC.t('Full article on JPE Precision Point')) + '</a></p>' : '') +
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
      setUrl(store.toHash(s.calc, state.values));
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
      source: def.source || t(def.basis || ''),
      jpe: !!def.source
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
    setUrl('#/' + MATERIALS_VIEW);
    setTitle(t('Material properties'));
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

  // ------------------------------------------------------------------ About
  function openAbout() {
    stopAnim(true);
    state.def = null;
    store.setLastCalc(ABOUT_VIEW);
    document.body.classList.remove('nav-open');
    setUrl('#/' + ABOUT_VIEW);
    setTitle(t('About'));
    renderNav($('#search').value);
    var link = function (href, text) { return '<a href="' + href + '" target="_blank" rel="noopener">' + esc(text) + '</a>'; };
    $('#main').innerHTML = '<div class="calc-head"><h2>' + esc(t('About')) + '</h2>' +
      '<p>' + esc(t('Precision Engineering Calculators is a free set of web calculators for precision mechanical design: flexures, beams, contact, dynamics and thermal effects. It is built on the formulas of the free JPE Precision Point articles and runs entirely in your browser; your calculations are stored only on your own device.')) + '</p></div>' +
      '<div class="card about" style="margin-top:16px">' +
      '<h3>' + esc(t('Author')) + '</h3><p>E. Tozlu · ' + link(AUTHOR_URL, 'ehcrea.com') + '</p>' +
      '<h3>' + esc(t('Follow ehcrea.studio')) + '</h3><p class="about-social">' +
      '<a class="social-link" href="' + INSTAGRAM_URL + '" target="_blank" rel="noopener" aria-label="' + esc(t('ehcrea.studio on Instagram (opens in a new tab)')) + '">' + INSTAGRAM_ICON + '<span>Instagram</span></a>' +
      '<a class="social-link" href="' + FACEBOOK_URL + '" target="_blank" rel="noopener" aria-label="' + esc(t('ehcrea.studio on Facebook (opens in a new tab)')) + '">' + FACEBOOK_ICON + '<span>Facebook</span></a></p>' +
      '<h3>' + esc(t('License')) + '</h3><p>' + esc(t('Open source under the MIT License: you may use, copy, modify and share it freely, as long as the copyright and license notice are kept.')) + ' ' + link(REPO_URL + '/blob/main/LICENSE', t('Read the license')) + ' · ' + link(REPO_URL, t('Source code on GitHub')) + '</p>' +
      '<div class="about-support"><h3>' + esc(t('Support this project')) + '</h3><p>' + esc(t('These calculators are free, and I build and maintain them in my spare time. If they save you time or help your work, I would be very grateful for your support on Patreon. It helps me keep improving the tools and add new calculators. Thank you!')) + '</p>' +
      '<a class="btn-support" href="' + PATREON_URL + '" target="_blank" rel="noopener"><span aria-hidden="true">♥</span> ' + esc(t('Support me on Patreon')) + '</a></div>' +
      '<h3>' + esc(t('Disclaimer')) + '</h3><p>' + esc(t('This is an independent tool and is not affiliated with or endorsed by JPE. Verify results before using them in critical designs.')) + '</p>' +
      '</div>';
  }

  // ------------------------------------------------------------------ Language
  // Static texts in index.html carry their English source text in data-i18n* attributes.
  function applyStaticTexts() {
    document.documentElement.lang = PEC.i18n.lang();
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.dataset.i18n); });
    [['data-i18n-title', 'title'], ['data-i18n-placeholder', 'placeholder'], ['data-i18n-aria-label', 'aria-label']].forEach(function (p) {
      document.querySelectorAll('[' + p[0] + ']').forEach(function (el) { el.setAttribute(p[1], t(el.getAttribute(p[0]))); });
    });
  }

  function rerender() {
    if (state.def) {
      renderNav($('#search').value);
      renderCalc();
    } else if (location.hash === '#/' + ABOUT_VIEW) {
      openAbout();
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
    sel.onchange = function () {
      // Each language has its own page (/, /de/, /nl/, …); keep the calculator in the hash.
      var page = PAGE_LANG;
      if (page && sel.value !== page) {
        PEC.i18n.setLang(sel.value);
        location.href = langRoot(sel.value) + (state.def ? state.def.id + '/' : '') + location.hash;
        return;
      }
      setLanguage(sel.value);
    };
    applyStaticTexts();
  }

  // ------------------------------------------------------------------ Boot
  function routeFromHash() {
    var h = store.fromHash(location.hash);
    if (h && h.calc === MATERIALS_VIEW) { openMaterials(); return true; }
    if (h && h.calc === ABOUT_VIEW) { openAbout(); return true; }
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
      if (b.dataset.calc === ABOUT_VIEW) { openAbout(); return; }
      openCalc(b.dataset.calc);
      setUrl(store.toHash(state.def.id, state.values));
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
    $('#btnAbout').onclick = openAbout;
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
      try { localStorage.setItem('ehcrea.theme', next); } catch (e) { /* ignore */ }
      drawCharts();
      drawPreview();
    };
    root.addEventListener('hashchange', function () { routeFromHash(); });
    var resizeT;
    root.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(drawCharts, 150); });

    if (!routeFromHash()) {
      var last = store.lastCalc();
      if (PAGE_CALC && PEC.get(PAGE_CALC)) last = PAGE_CALC;
      if (last === MATERIALS_VIEW) openMaterials();
      else if (last === ABOUT_VIEW) openAbout();
      else openCalc(last && PEC.get(last) ? last : PEC.list[0].id);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);

// Offline support: register the service worker (sw.js, next to the web manifest) so the
// calculator keeps working without a connection and can be installed as an app.
(function () {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  var local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (location.protocol !== 'https:' && !local) return;
  var link = document.querySelector('link[rel="manifest"]');
  var sw = new URL('sw.js', link ? link.href : location.href).href;
  function register() { navigator.serviceWorker.register(sw).catch(function () {}); }
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
})();

// "Install app": a toolbar button (where the browser can install directly, e.g. Chrome/Edge)
// and an "Install as an app" section on the About page with an install button or, where the
// browser has no install prompt (Safari, Firefox), short instructions. Texts in EN/DE/NL/TR/ES.
(function () {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  var TEXT = {
    en: { title: 'Install as an app', body: 'This calculator also works offline. Install it as an app to open it in its own window from the Dock, Start menu or home screen, with or without an internet connection. Updates arrive automatically when you are online.', button: 'Install app', installed: 'You are using the installed app.', done: 'Installed. You can now open it from your apps.', mac: 'In Safari on a Mac: choose File › Add to Dock.', ios: 'On iPhone or iPad: tap Share, then Add to Home Screen.', other: 'In Chrome or Edge: click the install icon in the address bar, or open the browser menu and choose Install. In Safari on a Mac: File › Add to Dock. On iPhone or iPad: Share › Add to Home Screen.' },
    de: { title: 'Als App installieren', body: 'Dieser Rechner funktioniert auch offline. Installieren Sie ihn als App, um ihn in einem eigenen Fenster aus dem Dock, dem Startmenü oder vom Startbildschirm zu öffnen, mit oder ohne Internetverbindung. Updates kommen automatisch, sobald Sie online sind.', button: 'App installieren', installed: 'Sie verwenden die installierte App.', done: 'Installiert. Sie können sie jetzt aus Ihren Apps öffnen.', mac: 'In Safari auf dem Mac: Ablage › Zum Dock hinzufügen.', ios: 'Auf iPhone oder iPad: Teilen tippen, dann Zum Home-Bildschirm.', other: 'In Chrome oder Edge: auf das Installationssymbol in der Adressleiste klicken oder im Browsermenü Installieren wählen. In Safari auf dem Mac: Ablage › Zum Dock hinzufügen. Auf iPhone oder iPad: Teilen › Zum Home-Bildschirm.' },
    nl: { title: 'Installeren als app', body: 'Deze calculator werkt ook offline. Installeer hem als app om hem in een eigen venster te openen vanuit het Dock, het Startmenu of het beginscherm, met of zonder internetverbinding. Updates komen automatisch binnen zodra je online bent.', button: 'App installeren', installed: 'Je gebruikt de geïnstalleerde app.', done: 'Geïnstalleerd. Je kunt hem nu openen vanuit je apps.', mac: 'In Safari op een Mac: kies Archief › Voeg toe aan Dock.', ios: 'Op iPhone of iPad: tik op Deel en daarna op Zet op beginscherm.', other: 'In Chrome of Edge: klik op het installatiepictogram in de adresbalk of kies Installeren in het browsermenu. In Safari op een Mac: Archief › Voeg toe aan Dock. Op iPhone of iPad: Deel › Zet op beginscherm.' },
    tr: { title: 'Uygulama olarak yükle', body: 'Bu hesaplayıcı çevrimdışı da çalışır. Dock, Başlat menüsü veya ana ekrandan kendi penceresinde, internet bağlantısı olsun ya da olmasın açmak için uygulama olarak yükleyin. Çevrimiçi olduğunuzda güncellemeler otomatik olarak gelir.', button: 'Uygulamayı yükle', installed: 'Yüklü uygulamayı kullanıyorsunuz.', done: 'Yüklendi. Artık uygulamalarınızdan açabilirsiniz.', mac: 'Mac’te Safari’de: Dosya › Dock’a Ekle.', ios: 'iPhone veya iPad’de: Paylaş’a, ardından Ana Ekrana Ekle’ye dokunun.', other: 'Chrome veya Edge’de: adres çubuğundaki yükleme simgesine tıklayın ya da tarayıcı menüsünden Yükle’yi seçin. Mac’te Safari’de: Dosya › Dock’a Ekle. iPhone veya iPad’de: Paylaş › Ana Ekrana Ekle.' },
    es: { title: 'Instalar como aplicación', body: 'Esta calculadora también funciona sin conexión. Instálala como aplicación para abrirla en su propia ventana desde el Dock, el menú Inicio o la pantalla de inicio, con o sin conexión a internet. Las actualizaciones llegan solas cuando estás en línea.', button: 'Instalar aplicación', installed: 'Estás usando la aplicación instalada.', done: 'Instalada. Ya puedes abrirla desde tus aplicaciones.', mac: 'En Safari en un Mac: Archivo › Añadir al Dock.', ios: 'En iPhone o iPad: toca Compartir y luego Añadir a pantalla de inicio.', other: 'En Chrome o Edge: haz clic en el icono de instalación de la barra de direcciones o elige Instalar en el menú del navegador. En Safari en un Mac: Archivo › Añadir al Dock. En iPhone o iPad: Compartir › Añadir a pantalla de inicio.' }
  };
  // Toolbar order in every ehcrea calculator: … Install app, Help, About, theme.
  var ABOUT_BUTTONS = '#btnAbout, #about-open, #aboutOpen, [data-dialog="about"]';
  var HELP_BUTTONS = '#btnHelp, #help-open, #helpOpen, [data-dialog="help"]';
  var ICON = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 2v8M4.5 6.8 8 10.3l3.5-3.5M3 13.5h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var prompt = null, justInstalled = false;

  function lang() { var l = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase(); return TEXT[l] ? l : 'en'; }
  function tx(k) { return TEXT[lang()][k]; }
  function installed() {
    return justInstalled || window.navigator.standalone === true ||
      (window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches));
  }
  function platform() {
    var ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox|OPR/.test(ua)) return 'mac';
    return 'other';
  }
  function install() {
    if (!prompt) return;
    var p = prompt; prompt = null;
    p.prompt();
    (p.userChoice || Promise.resolve({})).then(function (c) { if (c && c.outcome !== 'accepted') prompt = p; render(); });
    render();
  }

  function addStyle() {
    if (document.getElementById('pwa-install-style')) return;
    var s = document.createElement('style');
    s.id = 'pwa-install-style';
    s.textContent =
      '.pwa-install{margin:1rem 0;padding:.85rem 1rem;border:1px solid var(--border, var(--line, #c9ced6));border-radius:var(--radius, 10px)}' +
      '.pwa-install h3{margin:0 0 .4rem;font-size:1rem}.pwa-install p{margin:.35rem 0}' +
      '.pwa-install .pwa-install-cta{display:inline-flex;align-items:center;gap:.45rem;margin-top:.35rem;padding:.5rem .95rem;border:0;border-radius:999px;font:inherit;font-weight:600;cursor:pointer;background:var(--accent);color:var(--accent-ink, var(--bg, #fff))}' +
      '.pwa-install .pwa-install-cta:hover{filter:brightness(1.08)}.pwa-install .pwa-install-cta:focus-visible{outline:2px solid var(--accent);outline-offset:2px}' +
      '.pwa-install-btn{display:inline-flex;align-items:center;gap:.35rem}.pwa-install-btn svg{flex:none}' +
      '@media (max-width:760px){.pwa-install-btn .pwa-label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}}';
    document.head.appendChild(s);
  }

  function renderToolbar() {
    var btn = document.querySelector('.pwa-install-btn');
    if (!prompt || installed()) { if (btn) btn.remove(); return; }
    var about = document.querySelector(HELP_BUTTONS) || document.querySelector(ABOUT_BUTTONS);
    if (!about) return;
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = (about.className + ' pwa-install-btn').trim();
      btn.addEventListener('click', install);
      about.parentNode.insertBefore(btn, about);
    }
    if (btn.dataset.lang !== lang()) {
      btn.dataset.lang = lang();
      btn.innerHTML = ICON + '<span class="pwa-label">' + tx('button') + '</span>';
      btn.title = tx('button');
      btn.setAttribute('aria-label', tx('button'));
    }
  }

  function renderAbout() {
    var anchor = document.querySelector('.about-support');
    if (!anchor) return;
    var state = lang() + '|' + (installed() ? 'installed' : prompt ? 'prompt' : platform());
    var box = anchor.parentNode.querySelector(':scope > .pwa-install');
    if (box && box.dataset.state === state) return;
    if (!box) { box = document.createElement('section'); box.className = 'pwa-install'; anchor.parentNode.insertBefore(box, anchor); }
    box.dataset.state = state;
    var html = '<h3>' + tx('title') + '</h3><p>' + tx('body') + '</p>';
    if (installed()) html += '<p><strong>' + tx(justInstalled ? 'done' : 'installed') + '</strong></p>';
    else if (prompt) html += '<button type="button" class="pwa-install-cta">' + ICON + '<span>' + tx('button') + '</span></button>';
    else html += '<p>' + tx(platform()) + '</p>';
    box.innerHTML = html;
    var cta = box.querySelector('.pwa-install-cta');
    if (cta) cta.addEventListener('click', install);
  }

  var busy = false;
  function render() {
    if (busy) return;
    busy = true;
    try { addStyle(); renderToolbar(); renderAbout(); } finally { busy = false; }
  }

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); prompt = e; render(); });
  window.addEventListener('appinstalled', function () { prompt = null; justInstalled = true; render(); });
  function start() {
    render();
    // The About content and the page language are re-rendered by the app: keep up with it.
    new MutationObserver(function () { if (!busy) render(); })
      .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['lang'] });
    new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

// Google Analytics 4 (one property and stream for all ehcrea calculators on ehcrea.github.io)
// plus a short "Privacy" section on the About page with an off switch. Texts in EN/DE/NL/TR/ES.
// - Loads only on ehcrea.github.io, and never when the browser sends Do Not Track / Global
//   Privacy Control or the visitor turned analytics off (localStorage "ehcrea.analytics" = "off").
// - Only origin + path is reported: ?query and #hash can hold saved inputs and share links.
// - Offline the gtag request simply fails; the service worker does not handle it.
(function () {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  var ID = 'G-0SRRQJ1BBN', KEY = 'ehcrea.analytics';
  var TEXT = {
    en: { title: 'Privacy', body: 'This site uses Google Analytics to count visits and see which calculators are used. Only the page address is sent, without your inputs or results, which stay on your device. Advertising features are off, and Google Analytics does not store IP addresses. Analytics is skipped when your browser sends Do Not Track or Global Privacy Control.', off: 'Turn off analytics on this device', on: 'Turn analytics back on', isOff: 'Analytics is off on this device.', browser: 'Your browser asks not to be tracked, so analytics is off.' },
    de: { title: 'Datenschutz', body: 'Diese Seite verwendet Google Analytics, um Besuche zu zählen und zu sehen, welche Rechner genutzt werden. Gesendet wird nur die Seitenadresse, ohne Ihre Eingaben oder Ergebnisse; diese bleiben auf Ihrem Gerät. Werbefunktionen sind ausgeschaltet, und Google Analytics speichert keine IP-Adressen. Sendet Ihr Browser „Do Not Track“ oder „Global Privacy Control“, wird Analytics nicht geladen.', off: 'Analytics auf diesem Gerät ausschalten', on: 'Analytics wieder einschalten', isOff: 'Analytics ist auf diesem Gerät ausgeschaltet.', browser: 'Ihr Browser bittet darum, nicht verfolgt zu werden, daher ist Analytics ausgeschaltet.' },
    nl: { title: 'Privacy', body: 'Deze site gebruikt Google Analytics om bezoeken te tellen en te zien welke calculators worden gebruikt. Alleen het paginaadres wordt verstuurd, zonder je invoer of resultaten; die blijven op je apparaat. Advertentiefuncties staan uit en Google Analytics slaat geen IP-adressen op. Als je browser Do Not Track of Global Privacy Control meestuurt, wordt Analytics niet geladen.', off: 'Analytics uitzetten op dit apparaat', on: 'Analytics weer aanzetten', isOff: 'Analytics staat uit op dit apparaat.', browser: 'Je browser vraagt om niet gevolgd te worden, dus Analytics staat uit.' },
    tr: { title: 'Gizlilik', body: 'Bu site, ziyaretleri saymak ve hangi hesaplayıcıların kullanıldığını görmek için Google Analytics kullanır. Yalnızca sayfa adresi gönderilir; girdileriniz ve sonuçlarınız gönderilmez, cihazınızda kalır. Reklam özellikleri kapalıdır ve Google Analytics IP adreslerini saklamaz. Tarayıcınız Do Not Track veya Global Privacy Control gönderirse Analytics yüklenmez.', off: 'Bu cihazda analitiği kapat', on: 'Analitiği yeniden aç', isOff: 'Bu cihazda analitik kapalı.', browser: 'Tarayıcınız izlenmemeyi istediği için analitik kapalı.' },
    es: { title: 'Privacidad', body: 'Este sitio usa Google Analytics para contar visitas y ver qué calculadoras se usan. Solo se envía la dirección de la página, sin tus datos ni resultados, que se quedan en tu dispositivo. Las funciones publicitarias están desactivadas y Google Analytics no almacena direcciones IP. Si tu navegador envía Do Not Track o Global Privacy Control, Analytics no se carga.', off: 'Desactivar la analítica en este dispositivo', on: 'Volver a activar la analítica', isOff: 'La analítica está desactivada en este dispositivo.', browser: 'Tu navegador pide no ser rastreado, así que la analítica está desactivada.' }
  };
  function lang() { var l = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase(); return TEXT[l] ? l : 'en'; }
  function tx(k) { return TEXT[lang()][k]; }
  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function store(v) { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) { /* private mode */ } }
  function browserOptOut() { return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1'; }
  function url() { return location.origin + location.pathname; }

  var loaded = false, lastPath = null;
  function pageView() {
    if (!loaded || window['ga-disable-' + ID] || location.pathname === lastPath) return;
    lastPath = location.pathname;
    window.gtag('set', { page_location: url() });
    window.gtag('event', 'page_view', { page_location: url(), page_title: document.title });
  }
  function load() {
    if (loaded || location.hostname !== 'ehcrea.github.io' || stored() === 'off' || browserOptOut()) return;
    loaded = true;
    window['ga-disable-' + ID] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', ID, { send_page_view: false, page_location: url(), allow_google_signals: false, allow_ad_personalization_signals: false });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(s);
    // The apps move between calculator pages with history.pushState/replaceState.
    ['pushState', 'replaceState'].forEach(function (m) {
      var orig = history[m];
      if (typeof orig !== 'function') return;
      history[m] = function () { var r = orig.apply(this, arguments); setTimeout(pageView, 0); return r; };
    });
    window.addEventListener('popstate', pageView);
    pageView();
  }
  function setOff(off) {
    store(off ? 'off' : null);
    window['ga-disable-' + ID] = off;
    if (!off) { if (loaded) { lastPath = null; pageView(); } else load(); }
    render();
  }

  function addStyle() {
    if (document.getElementById('privacy-note-style')) return;
    var s = document.createElement('style');
    s.id = 'privacy-note-style';
    s.textContent =
      '.privacy-note{margin:1rem 0;padding:.85rem 1rem;border:1px solid var(--border, var(--line, #c9ced6));border-radius:var(--radius, 10px)}' +
      '.privacy-note h3{margin:0 0 .4rem;font-size:1rem}.privacy-note p{margin:.35rem 0}' +
      '.privacy-note .privacy-toggle{margin-top:.25rem;padding:.4rem .85rem;border:1px solid var(--border-strong, var(--border, var(--line, #8a929e)));border-radius:999px;font:inherit;cursor:pointer;background:transparent;color:inherit}' +
      '.privacy-note .privacy-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:2px}';
    document.head.appendChild(s);
  }
  function render() {
    var anchor = document.querySelector('.about-support');
    if (!anchor) return;
    var off = stored() === 'off', browser = browserOptOut();
    var state = lang() + '|' + (browser ? 'browser' : off ? 'off' : 'on');
    var box = anchor.parentNode.querySelector(':scope > .privacy-note');
    if (box && box.dataset.state === state) return;
    addStyle();
    if (!box) { box = document.createElement('section'); box.className = 'privacy-note'; anchor.parentNode.insertBefore(box, anchor.nextSibling); }
    box.dataset.state = state;
    var html = '<h3>' + tx('title') + '</h3><p>' + tx('body') + '</p>';
    if (browser) html += '<p>' + tx('browser') + '</p>';
    else html += (off ? '<p>' + tx('isOff') + '</p>' : '') + '<button type="button" class="privacy-toggle">' + tx(off ? 'on' : 'off') + '</button>';
    box.innerHTML = html;
    var btn = box.querySelector('.privacy-toggle');
    if (btn) btn.addEventListener('click', function () { setOff(!off); var b = box.querySelector('.privacy-toggle'); if (b) b.focus(); });
  }
  function start() {
    load();
    render();
    new MutationObserver(render).observe(document.body, { childList: true, subtree: true });
    new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
