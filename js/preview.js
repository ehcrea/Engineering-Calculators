/*
 * Geometry previews: dimensioned SVG sketches generated from a calculator's inputs.
 * Each preview receives the SI inputs, the calculation result and a colour set, and returns
 * {svg, notes}. Thin features and deformations are exaggerated so they stay visible; the
 * sketch says so whenever that happens.
 */
(function (root) {
  'use strict';
  var PEC = root.PEC, PI = Math.PI;
  var uid = 0;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // "F_z" → F with a lowered, smaller z (SVG has no portable subscript).
  function subs(s) {
    return s.replace(/_([A-Za-z0-9]+)/g, '<tspan font-size="0.75em" dy="0.3em">$1</tspan><tspan dy="-0.3em">\u200b</tspan>');
  }
  function n(v) { return Math.round(v * 10) / 10; }
  function attrs(a) {
    return Object.keys(a || {}).map(function (k) { return a[k] === undefined || a[k] === null ? '' : ' ' + k + '="' + esc(a[k]) + '"'; }).join('');
  }
  // "value unit" label for an SI value, in the current unit system (`unit` is the metric unit).
  function qty(v, unit) { return PEC.units.q(v, unit, 3); }
  // Format a length (SI metres) in mm (or inches) for labels.
  function mm(v) { return qty(v, 'mm'); }
  // Translate sketch text (notes stay in English here and are translated where they are shown).
  function T(str, vars) { return PEC.t(str, vars); }

  // Small SVG builder bound to one colour set and one id namespace.
  function Sketch(W, H, c) {
    var id = 'pv' + (++uid);
    var parts = [];
    var s = {
      W: W, H: H, c: c, id: id,
      add: function (str) { parts.push(str); return s; },
      line: function (x1, y1, x2, y2, a) {
        return s.add('<line' + attrs(Object.assign({ x1: n(x1), y1: n(y1), x2: n(x2), y2: n(y2), stroke: c.fg, 'stroke-width': 1.5 }, a)) + '/>');
      },
      rect: function (x, y, w, h, a) {
        return s.add('<rect' + attrs(Object.assign({ x: n(x), y: n(y), width: n(Math.max(w, 0)), height: n(Math.max(h, 0)), fill: c.fill, stroke: c.fg, 'stroke-width': 1.5 }, a)) + '/>');
      },
      path: function (d, a) { return s.add('<path' + attrs(Object.assign({ d: d, fill: 'none', stroke: c.fg, 'stroke-width': 1.5 }, a)) + '/>'); },
      circle: function (x, y, r, a) { return s.add('<circle' + attrs(Object.assign({ cx: n(x), cy: n(y), r: n(r), fill: c.fill, stroke: c.fg, 'stroke-width': 1.5 }, a)) + '/>'); },
      text: function (x, y, str, a) {
        return s.add('<text' + attrs(Object.assign({ x: n(x), y: n(y), fill: c.fg, 'font-size': 12, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, a)) + '>' + subs(esc(str)) + '</text>');
      },
      // Hatched fixed support.
      ground: function (x, y, w, h) { return s.rect(x, y, w, h, { fill: 'url(#' + id + 'h)' }); },
      arrow: function (x1, y1, x2, y2, a) {
        return s.line(x1, y1, x2, y2, Object.assign({ stroke: c.accent, 'stroke-width': 2, 'marker-end': 'url(#' + id + 'a)' }, a));
      },
      // Dimension between two points, drawn at a perpendicular offset `off` (px).
      dim: function (x1, y1, x2, y2, label, off, a) {
        a = a || {};
        var dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx * dx + dy * dy) || 1;
        var ux = -dy / L, uy = dx / L, e = off >= 0 ? 1 : -1;
        var ax = x1 + ux * off, ay = y1 + uy * off, bx = x2 + ux * off, by = y2 + uy * off;
        if (Math.abs(off) > 1) {
          s.line(x1, y1, ax + ux * 4 * e, ay + uy * 4 * e, { stroke: c.muted, 'stroke-width': 0.8 });
          s.line(x2, y2, bx + ux * 4 * e, by + uy * 4 * e, { stroke: c.muted, 'stroke-width': 0.8 });
        }
        var inner = L > 22;
        s.line(ax, ay, bx, by, { stroke: c.muted, 'stroke-width': 1, 'marker-start': inner ? 'url(#' + id + 'd)' : null, 'marker-end': inner ? 'url(#' + id + 'd)' : null });
        var ang = Math.atan2(dy, dx) * 180 / PI;
        if (ang > 90) ang -= 180;
        if (ang <= -90) ang += 180;
        var tx = (ax + bx) / 2 + ux * 9 * e, ty = (ay + by) / 2 + uy * 9 * e;
        if (a.labelAt) { tx = a.labelAt[0]; ty = a.labelAt[1]; ang = 0; }
        return s.text(tx, ty, label, { transform: 'rotate(' + n(ang) + ' ' + n(tx) + ' ' + n(ty) + ')', fill: c.muted, 'font-size': 11 });
      },
      toString: function () {
        var defs = '<defs>' +
          '<pattern id="' + id + 'h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="' + c.bg + '"/><line x1="0" y1="0" x2="0" y2="6" stroke="' + c.muted + '" stroke-width="1.2"/></pattern>' +
          '<marker id="' + id + 'a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="' + c.accent + '"/></marker>' +
          '<marker id="' + id + 'd" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 1L10 5L0 9z" fill="' + c.muted + '"/></marker>' +
          '</defs>';
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" font-family="system-ui, -apple-system, Segoe UI, sans-serif">' +
          '<rect width="' + W + '" height="' + H + '" fill="' + c.bg + '"/>' + defs + parts.join('') + '</svg>';
      }
    };
    return s;
  }

  // Animation: `anim` is the cycle phase in [0, 1). Static sketches (anim undefined) show full load;
  // animated ones ramp the load up and back down so the motion is visible.
  function loadOf(anim) { return anim === undefined ? 1 : Math.sin(PI * anim); }
  function resItem(res, sym) { return ((res && res.results) || []).filter(function (r) { return r.sym === sym; })[0]; }
  // "sym = value unit" for a result, with its value scaled by `f` (the current load fraction).
  function resText(res, sym, f) {
    var r = resItem(res, sym);
    if (!r || typeof r.value !== 'number') return '';
    var v = (f === undefined ? 1 : f) * r.value;
    return sym + ' = ' + PEC.fmt(r.unit && r.unit !== '-' ? PEC.fromSI(v, r.unit) : v, 3) + (r.unit && r.unit !== '-' ? ' ' + r.unit : '');
  }
  function caption(f, parts) {
    return [T('load {p} %', { p: Math.round(f * 100) })].concat(parts.filter(Boolean)).join(' · ');
  }
  function rotPt(p, o, deg) {
    var a = deg * PI / 180, cs = Math.cos(a), sn = Math.sin(a), dx = p[0] - o[0], dy = p[1] - o[1];
    return [o[0] + dx * cs - dy * sn, o[1] + dx * sn + dy * cs];
  }

  function polyline(pts) {
    return pts.map(function (p, k) { return (k ? 'L' : 'M') + n(p[0]) + ' ' + n(p[1]); }).join(' ');
  }

  // Visual size of a thin feature: true scale, but never thinner than `min` px.
  function vis(v, scale, min) { return Math.max(v * scale, min); }

  // ---------------------------------------------------------------- cross-sections
  // Draws a section centred at (cx, cy) inside a box of size `box`. Returns notes.
  function drawSection(s, i, cx, cy, box, opts) {
    opts = opts || {};
    var c = s.c, notes = [];
    var dims = { rect: [i.w, i.h], hollowRect: [i.wo, i.ho], circle: [i.d, i.d], tube: [i.do, i.do], ibeam: [i.w, i.h], triangle: [i.w, i.h], ellipse: [2 * i.r1, 2 * i.r2] }[i.shape];
    if (!dims || !(dims[0] > 0) || !(dims[1] > 0)) return notes;
    var k = box / Math.max(dims[0], dims[1]);
    var W = dims[0] * k, H = dims[1] * k, x0 = cx - W / 2, y0 = cy - H / 2;
    var thin = function (v) { var p = v * k; if (p < 2.5) { notes.push('section walls drawn thicker than scale'); } return Math.max(p, 2.5); };
    switch (i.shape) {
      case 'rect':
        s.rect(x0, y0, Math.max(W, 2.5), Math.max(H, 2.5));
        if (W < 2.5 || H < 2.5) notes.push('thin section drawn thicker than scale');
        break;
      case 'hollowRect': {
        var tw = thin((i.wo - i.wi) / 2), th = thin((i.ho - i.hi) / 2);
        s.path('M' + n(x0) + ' ' + n(y0) + 'h' + n(W) + 'v' + n(H) + 'h' + n(-W) + 'z M' + n(x0 + tw) + ' ' + n(y0 + th) + 'v' + n(H - 2 * th) + 'h' + n(W - 2 * tw) + 'v' + n(-(H - 2 * th)) + 'z', { fill: c.fill, 'fill-rule': 'evenodd' });
        break;
      }
      case 'circle': s.circle(cx, cy, W / 2); break;
      case 'tube': {
        var ri = Math.min(i.di * k / 2, W / 2 - 2.5);
        s.path('M' + n(cx - W / 2) + ' ' + n(cy) + 'a' + n(W / 2) + ' ' + n(W / 2) + ' 0 1 0 ' + n(W) + ' 0a' + n(W / 2) + ' ' + n(W / 2) + ' 0 1 0 ' + n(-W) + ' 0z' +
          'M' + n(cx - ri) + ' ' + n(cy) + 'a' + n(ri) + ' ' + n(ri) + ' 0 1 0 ' + n(2 * ri) + ' 0a' + n(ri) + ' ' + n(ri) + ' 0 1 0 ' + n(-2 * ri) + ' 0z', { fill: c.fill, 'fill-rule': 'evenodd' });
        if (i.di * k / 2 > W / 2 - 2.5) notes.push('tube wall drawn thicker than scale');
        break;
      }
      case 'ibeam': {
        var tf = thin(i.t1), tw2 = thin(i.t2);
        s.path(polyline([[x0, y0], [x0 + W, y0], [x0 + W, y0 + tf], [cx + tw2 / 2, y0 + tf], [cx + tw2 / 2, y0 + H - tf], [x0 + W, y0 + H - tf], [x0 + W, y0 + H], [x0, y0 + H], [x0, y0 + H - tf], [cx - tw2 / 2, y0 + H - tf], [cx - tw2 / 2, y0 + tf], [x0, y0 + tf]]) + 'z', { fill: c.fill });
        break;
      }
      case 'triangle':
        s.path(polyline([[x0, y0 + H], [x0 + W, y0 + H], [cx, y0]]) + 'z', { fill: c.fill });
        break;
      case 'ellipse':
        s.add('<ellipse' + attrs({ cx: n(cx), cy: n(cy), rx: n(W / 2), ry: n(H / 2), fill: c.fill, stroke: c.fg, 'stroke-width': 1.5 }) + '/>');
        break;
    }
    // Neutral axes
    var cyN = i.shape === 'triangle' ? y0 + H * 2 / 3 : cy;
    s.line(x0 - 10, cyN, x0 + W + 10, cyN, { stroke: c.accent, 'stroke-width': 0.8, 'stroke-dasharray': '6 3 1 3' });
    s.line(cx, y0 - 10, cx, y0 + H + 10, { stroke: c.accent, 'stroke-width': 0.8, 'stroke-dasharray': '6 3 1 3' });
    s.text(x0 + W + 16, cyN, 'x', { fill: c.accent, 'font-size': 11, 'font-style': 'italic' });
    s.text(cx, y0 - 16, 'y', { fill: c.accent, 'font-size': 11, 'font-style': 'italic' });
    if (opts.dims !== false) {
      var lab = { rect: ['w', 'h'], hollowRect: ['wₒ', 'hₒ'], circle: ['d', null], tube: ['dₒ', null], ibeam: ['w', 'h'], triangle: ['w', 'h'], ellipse: ['2r₁', '2r₂'] }[i.shape];
      s.dim(x0, y0 + H, x0 + W, y0 + H, lab[0] + ' = ' + mm(dims[0]), 16);
      if (lab[1]) s.dim(x0, y0, x0, y0 + H, lab[1] + ' = ' + mm(dims[1]), 16);
      if (i.shape === 'tube') s.text(cx, y0 + H + 42, 'dᵢ = ' + mm(i.di), { fill: c.muted, 'font-size': 11 });
      if (i.shape === 'hollowRect') s.text(cx, y0 + H + 42, 'wᵢ × hᵢ = ' + PEC.fmt(PEC.units.toDisplay(i.wi * 1e3, 'mm'), 3) + ' × ' + mm(i.hi), { fill: c.muted, 'font-size': 11 });
      if (i.shape === 'ibeam') s.text(cx, y0 + H + 42, 't₁ = ' + mm(i.t1) + ', t₂ = ' + mm(i.t2), { fill: c.muted, 'font-size': 11 });
    }
    return notes;
  }

  function sectionPreview(i, res, c) {
    var s = Sketch(360, 250, c);
    var notes = drawSection(s, i, 180, 115, 140);
    return { svg: s.toString(), notes: notes };
  }

  // ---------------------------------------------------------------- leaf / rod spring
  function springPreview(i, res, c, rod, anim) {
    var s = Sketch(440, 320, c), notes = [], lf = loadOf(anim);
    var L = i.L, thick = rod ? i.d : i.t, S = i.shape === 'S';
    var k = 210 / L, xc = 120, yb = 270, yt = yb - L * k;
    var tp = vis(thick, k, 3);
    if (thick * k < 3) notes.push(rod ? 'diameter drawn thicker than scale' : 'thickness drawn thicker than scale');
    // Exaggerated deflection for visibility
    var uxFull = Math.min(Math.max(i.ux * k, 18), 55), uxPx = uxFull * lf;
    if (Math.abs(uxFull - i.ux * k) > 0.5) notes.push(i.ux * k < uxFull ? 'deflection exaggerated for clarity' : 'deflection reduced for clarity');
    var shapeFn = S ? function (z) { return 3 * z * z - 2 * z * z * z; } : function (z) { return (3 * z * z - z * z * z) / 2; };

    s.ground(xc - 60, yb, 120, 22);
    s.rect(xc - tp / 2, yt, tp, yb - yt);
    if (S) s.rect(xc - 45, yt - 22, 90, 22, { fill: c.fill2 });
    // Deformed shape
    var pts = [];
    for (var q = 0; q <= 40; q++) { var z = q / 40; pts.push([xc + uxPx * shapeFn(z), yb - z * (yb - yt)]); }
    s.path(polyline(pts), { stroke: c.accent, 'stroke-dasharray': '5 4', 'stroke-width': 1.5 });
    if (S) s.rect(xc - 45 + uxPx, yt - 22, 90, 22, { fill: 'none', stroke: c.accent, 'stroke-dasharray': '5 4' });
    // Force
    var fy = S ? yt - 11 : yt, fx = xc + uxPx + (S ? 45 : 0) + 8;
    if (lf > 0.05) s.arrow(fx, fy, fx + 40 * lf, fy);
    s.text(fx + 22, fy - 12, 'Fₓ', { fill: c.accent, 'font-style': 'italic' });
    // Dimensions
    s.dim(xc - tp / 2, yb, xc - tp / 2, yt, 'L = ' + mm(L), -42);
    s.dim(xc, S ? yt - 30 : yt - 8, xc + uxFull, S ? yt - 30 : yt - 8, 'uₓ = ' + mm(i.ux), -14);
    s.text(xc, yb + 34, T(S ? 'S-shape (end guided)' : 'C-shape (end free)'), { fill: c.muted, 'font-size': 11 });

    // Cross-section (view from above)
    var sx = 330, sy = 120;
    s.text(sx, 30, T('Cross-section'), { 'font-weight': 600 });
    if (rod) {
      s.circle(sx, sy, 34);
      s.dim(sx - 34, sy + 34, sx + 34, sy + 34, 'd = ' + mm(i.d), 18);
    } else {
      var bw = 140, kk = bw / i.b, tt = vis(i.t, kk, 3);
      if (i.t * kk < 3) notes.push('section thickness drawn thicker than scale');
      s.rect(sx - tt / 2, sy - bw / 2, tt, bw);
      s.dim(sx + tt / 2, sy - bw / 2, sx + tt / 2, sy + bw / 2, 'b = ' + mm(i.b), -16);
      s.dim(sx - tt / 2, sy + bw / 2, sx + tt / 2, sy + bw / 2, 't = ' + mm(i.t), 14, { labelAt: [sx, sy + bw / 2 + 32] });
    }
    s.arrow(sx - 70, sy + 130, sx - 30, sy + 130, { stroke: c.muted, 'stroke-width': 1 });
    s.text(sx - 20, sy + 130, 'x', { fill: c.muted, 'font-style': 'italic' });
    return { svg: s.toString(), notes: notes, caption: caption(lf, ['uₓ = ' + mm(lf * i.ux), resText(res, 'Fₓ', lf), resText(res, 'σ_max', lf)]) };
  }

  // ---------------------------------------------------------------- folded leaf spring
  function foldedPreview(i, res, c, anim) {
    var s = Sketch(420, 320, c), notes = [], lf = loadOf(anim);
    var k = 200 / Math.max(i.L1, i.L2), x0 = 90, y0 = 270;
    var tp = vis(i.t, k, 3);
    if (i.t * k < 3) notes.push('thickness drawn thicker than scale');
    var xe = x0 + i.L2 * k, yt = y0 - i.L1 * k;
    s.ground(x0 - 40, y0, 80, 20);
    s.rect(x0 - tp / 2, yt - tp / 2, tp, y0 - yt + tp / 2);
    s.rect(x0 - tp / 2, yt - tp / 2, xe - x0 + tp / 2, tp);
    s.rect(xe, yt - 14, 26, 28, { fill: c.fill2 });
    // Force at angle θ (x to the right, y up)
    var fx = Math.cos(i.theta), fy = Math.sin(i.theta), px = xe + 13, py = yt;
    s.arrow(px + fx * 12, py - fy * 12, px + fx * 62, py - fy * 62);
    s.text(px + fx * 74, py - fy * 74, 'F, θ = ' + PEC.fmt(i.theta * 180 / PI, 3) + '°', { fill: c.accent, 'font-size': 11 });
    // Displacement direction φ
    var dxs = res.results.filter(function (r) { return r.sym === 'φ'; })[0];
    if (dxs) {
      var ph = dxs.value;
      s.line(px, py, px + Math.cos(ph) * 40, py - Math.sin(ph) * 40, { stroke: c.muted, 'stroke-dasharray': '4 3', 'marker-end': 'url(#' + s.id + 'd)' });
      s.text(px + Math.cos(ph) * 50, py - Math.sin(ph) * 50 + 10, 'δs', { fill: c.muted, 'font-size': 11, 'font-style': 'italic' });
      if (anim !== undefined) {
        // Deflected legs (exaggerated): the corner follows part of the end displacement.
        var ddx = Math.cos(ph) * 30 * lf, ddy = -Math.sin(ph) * 30 * lf;
        var cpts = [], q;
        for (q = 0; q <= 20; q++) { var z = q / 20; cpts.push([x0 + ddx * 0.5 * z * z, y0 - (y0 - yt) * z + ddy * 0.5 * z * z]); }
        for (q = 1; q <= 20; q++) { var w = q / 20; cpts.push([x0 + ddx * 0.5 + (xe - x0) * w + ddx * 0.5 * w, yt + ddy * (0.5 + 0.5 * w)]); }
        s.path(polyline(cpts), { stroke: c.accent, 'stroke-dasharray': '5 4' });
        s.rect(xe + ddx, yt - 14 + ddy, 26, 28, { fill: 'none', stroke: c.accent, 'stroke-dasharray': '5 4' });
      }
    }
    s.dim(x0, y0, x0, yt, 'L₁ = ' + mm(i.L1), 30);
    s.dim(x0, yt, xe, yt, 'L₂ = ' + mm(i.L2), -34);
    s.text(xe - (xe - x0) / 2, y0 + 34, T('width b = {b}, thickness t = {t}', { b: mm(i.b), t: mm(i.t) }), { fill: c.muted, 'font-size': 11 });
    s.arrow(330, 290, 370, 290, { stroke: c.muted, 'stroke-width': 1 }); s.text(380, 290, 'x', { fill: c.muted, 'font-style': 'italic' });
    s.arrow(330, 290, 330, 250, { stroke: c.muted, 'stroke-width': 1 }); s.text(330, 240, 'y', { fill: c.muted, 'font-style': 'italic' });
    if (anim !== undefined) notes.push('deflection exaggerated for clarity');
    return { svg: s.toString(), notes: notes, caption: caption(lf, [resText(res, 'δs_abs', lf), resText(res, 'σ_max', lf)]) };
  }

  // ---------------------------------------------------------------- notch hinge
  function hingeNotch(s, cx, cy, h, r1, r2, half, c) {
    // Body edges at cx ± (h/2 + r); circular cuts centred on the edges, a flat side has no cut.
    var xl = cx - h / 2 - r1, xr = cx + h / 2 + (isFinite(r2) ? r2 : 0);
    s.rect(xl, cy - half, xr - xl, 2 * half, { stroke: 'none' });
    s.line(xl, cy - half, xl, cy + half); s.line(xr, cy - half, xr, cy + half);
    if (r1 > 0) s.path('M' + n(xl) + ' ' + n(cy - r1) + 'A' + n(r1) + ' ' + n(r1) + ' 0 0 1 ' + n(xl) + ' ' + n(cy + r1), { fill: c.bg });
    if (isFinite(r2) && r2 > 0) s.path('M' + n(xr) + ' ' + n(cy - r2) + 'A' + n(r2) + ' ' + n(r2) + ' 0 0 0 ' + n(xr) + ' ' + n(cy + r2), { fill: c.bg });
    return { xl: xl, xr: xr };
  }

  // Draws a notch block whose upper half is rotated by `rot` degrees about the neck centre (cx, cy):
  // the rotation is concentrated in the thin neck and both halves stay rigid. Returns the body edges.
  function bentNotch(s, cx, cy, h, r1, r2, half, c, rot) {
    var w = h + r1 + (isFinite(r2) ? r2 : 0);
    var top = s.id + 'ct' + (++uid), bot = s.id + 'cb' + uid;
    s.add('<clipPath id="' + bot + '"><rect x="' + n(cx - w - 50) + '" y="' + n(cy - 0.6) + '" width="' + n(2 * w + 100) + '" height="' + n(half + 50) + '"/></clipPath>'); // small overlap hides the seam
    s.add('<clipPath id="' + top + '"><rect x="' + n(cx - w - 50) + '" y="' + n(cy - half - 50) + '" width="' + n(2 * w + 100) + '" height="' + n(half + 50) + '"/></clipPath>');
    s.add('<g clip-path="url(#' + bot + ')">');
    var out = hingeNotch(s, cx, cy, h, r1, r2, half, c);
    s.add('</g><g transform="rotate(' + n(rot) + ' ' + n(cx) + ' ' + n(cy) + ')"><g clip-path="url(#' + top + ')">');
    hingeNotch(s, cx, cy, h, r1, r2, half, c);
    s.add('</g></g>');
    return out;
  }

  function hingePreview(i, res, c, anim) {
    var s = Sketch(460, 320, c), notes = [], lf = loadOf(anim), rot = anim === undefined ? 0 : 6 * lf;
    var d1 = PEC.inf(i.d1), d2 = PEC.inf(i.d2);
    var r1 = isFinite(d1) ? d1 / 2 : 0, r2 = isFinite(d2) ? d2 / 2 : Infinity;
    // Overview: base, hinge at A, lever of length L to point B.
    var k = 200 / (i.L + Math.max(r1, isFinite(r2) ? r2 : 0) * 2), cx = 110, yA = 240;
    var hp = vis(i.h, k, 2.5), rp1 = r1 * k, rp2 = isFinite(r2) ? r2 * k : Infinity;
    if (i.h * k < 2.5) notes.push('overview: hinge thickness drawn thicker than scale');
    var half = Math.max(rp1, isFinite(rp2) ? rp2 : 0, 6) + 6;
    var e = rot ? bentNotch(s, cx, yA, hp, rp1, rp2, half, c, rot) : hingeNotch(s, cx, yA, hp, rp1, rp2, half, c);
    s.ground(e.xl - 20, yA + half, e.xr - e.xl + 40, 18);
    var yB = yA - i.L * k;
    // The lever is rigid and turns with the upper half of the notch about the neck at A.
    if (rot) s.add('<g transform="rotate(' + n(rot) + ' ' + n(cx) + ' ' + n(yA) + ')">');
    s.rect(e.xl, yB, e.xr - e.xl, yA - half - yB, { stroke: 'none' });
    s.line(e.xl, yB, e.xl, yA - half); s.line(e.xr, yB, e.xr, yA - half); s.line(e.xl, yB, e.xr, yB);
    s.circle(cx, yB, 3, { fill: c.accent, stroke: 'none' });
    s.text(cx - 26, yB + 2, 'B', { 'font-weight': 600 });
    s.arrow(e.xr + 6, yB + 8, e.xr + 46, yB + 8);
    s.text(e.xr + 30, yB - 4, 'F_z', { fill: c.accent, 'font-style': 'italic' });
    if (rot) s.add('</g>');
    s.circle(cx, yA, 3, { fill: c.accent, stroke: 'none' });
    s.text(cx - 26, yA, 'A', { 'font-weight': 600 });
    s.path('M' + n(cx + 28) + ' ' + n(yA - 34) + 'A 44 44 0 0 1 ' + n(cx + 40) + ' ' + n(yA - 14), { stroke: c.accent, 'marker-end': 'url(#' + s.id + 'a)' });
    s.text(cx + 54, yA - 36, 'R_y', { fill: c.accent, 'font-style': 'italic', 'font-size': 11 });
    s.dim(e.xl, yA, e.xl, yB, 'L = ' + mm(i.L), -22);

    // Detail of the notch at its own scale.
    var dx = 340, dy = 150, span = 2 * r1 + i.h + (isFinite(r2) ? 2 * r2 : r1);
    var kd = 170 / span, hd = vis(i.h, kd, 2.5), rd1 = r1 * kd, rd2 = isFinite(r2) ? r2 * kd : Infinity;
    if (i.h * kd < 2.5) notes.push('detail: hinge thickness drawn thicker than scale');
    s.text(dx, 24, T('Notch detail'), { 'font-weight': 600 });
    var hf = Math.max(rd1, isFinite(rd2) ? rd2 : 0) + 20;
    var ed = rot ? bentNotch(s, dx, dy, hd, rd1, rd2, hf, c, rot) : hingeNotch(s, dx, dy, hd, rd1, rd2, hf, c);
    s.line(dx - hd / 2, dy, dx + hd / 2, dy, { stroke: c.accent, 'stroke-width': 1.5 });
    if (rot) s.text(dx, dy + hf + 46, T('rotation happens in the thin neck'), { fill: c.accent, 'font-size': 11 });
    s.line(dx, dy + 2, dx, dy + hf + 6, { stroke: c.muted, 'stroke-width': 0.8, 'stroke-dasharray': '3 2' });
    s.text(dx, dy + hf + 14, 'h = ' + mm(i.h), { fill: c.muted, 'font-size': 11 });
    if (r1 > 0) s.dim(ed.xl, dy - rd1, ed.xl, dy + rd1, 'd₁ = ' + mm(2 * r1), 14);
    if (isFinite(r2) && r2 > 0) s.dim(ed.xr, dy - rd2, ed.xr, dy + rd2, 'd₂ = ' + mm(2 * r2), -14);
    else s.text(ed.xr + 16, dy, T('flat'), { fill: c.muted, 'font-size': 11, transform: 'rotate(90 ' + n(ed.xr + 16) + ' ' + n(dy) + ')' });
    s.text(dx, dy + hf + 30, T('width t = {t} (into page)', { t: mm(i.t) }), { fill: c.muted, 'font-size': 11 });
    if (rot) notes.push('rotation exaggerated for clarity');
    return { svg: s.toString(), notes: notes, caption: caption(lf, [resText(res, 'F_z', lf), 'R_y = ' + PEC.fmt(lf * i.Ry * 1e3, 3) + ' mrad', resText(res, 'σ_max', lf)]) };
  }

  // ---------------------------------------------------------------- cross spring pivot
  function pivotPreview(i, res, c, anim) {
    var s = Sketch(400, 320, c), notes = [], lf = loadOf(anim), rot = anim === undefined ? 0 : 8 * lf;
    var k = 190 / i.L, Lp = i.L * k, a = i.a, cx = 200, yb = 260;
    var tp = vis(i.t, k, 3);
    if (i.t * k < 3) notes.push('thickness drawn thicker than scale');
    var cs = Math.cos(PI / 4), sn = Math.sin(PI / 4);
    // Spring 1 starts left-bottom going up-right; spring 2 mirrored. They cross at a·L.
    var p1 = [cx - a * Lp * cs, yb], p2 = [cx + a * Lp * cs, yb];
    var e1 = [p1[0] + Lp * cs, yb - Lp * sn], e2 = [p2[0] - Lp * cs, yb - Lp * sn];
    var pole = [cx, yb - a * Lp * sn];
    // Animated: the top body rotates about the pole and the springs follow (approximately).
    var yTop = e1[1];
    if (rot) { e1 = rotPt(e1, pole, rot); e2 = rotPt(e2, pole, rot); }
    var xs = [p1[0], p2[0], e1[0], e2[0]];
    var gx = Math.min.apply(null, xs) - 20, gw = Math.max.apply(null, xs) - gx + 20;
    s.ground(gx, yb, gw, 18);
    if (rot) s.add('<g transform="rotate(' + n(rot) + ' ' + n(pole[0]) + ' ' + n(pole[1]) + ')">');
    s.rect(gx, yTop - 20, gw, 20, { fill: c.fill2 });
    if (rot) s.add('</g>');
    if (rot) {
      // Bent springs: a cubic that leaves the base at the original angle and meets the body at the rotated one.
      [[p1, e1, 1], [p2, e2, -1]].forEach(function (sp) {
        var b = sp[0], e = sp[1], raw = [sp[2] * Lp * cs / 3, -Lp * sn / 3], rr = rotPt(raw, [0, 0], rot);
        var c1 = [b[0] + raw[0], b[1] + raw[1]], c2 = [e[0] - rr[0], e[1] - rr[1]];
        s.path('M' + n(b[0]) + ' ' + n(b[1]) + 'C' + n(c1[0]) + ' ' + n(c1[1]) + ' ' + n(c2[0]) + ' ' + n(c2[1]) + ' ' + n(e[0]) + ' ' + n(e[1]), { 'stroke-width': tp, stroke: c.fg });
      });
    } else {
      s.line(p1[0], p1[1], e1[0], e1[1], { 'stroke-width': tp, stroke: c.fg, 'stroke-linecap': 'butt' });
      s.line(p2[0], p2[1], e2[0], e2[1], { 'stroke-width': tp, stroke: c.fg, 'stroke-linecap': 'butt' });
    }
    if (a < 0 || a > 1) {
      var end1 = a < 0 ? p1 : e1, end2 = a < 0 ? p2 : e2;
      s.line(end1[0], end1[1], pole[0], pole[1], { stroke: c.muted, 'stroke-dasharray': '4 3' });
      s.line(end2[0], end2[1], pole[0], pole[1], { stroke: c.muted, 'stroke-dasharray': '4 3' });
    }
    s.circle(pole[0], pole[1], 4, { fill: c.accent, stroke: 'none' });
    s.text(pole[0] + 40, pole[1], T('pole, a = {a}', { a: PEC.fmt(a, 3) }), { fill: c.accent, 'font-size': 11 });
    s.dim(p1[0], p1[1], e1[0], e1[1], 'L = ' + mm(i.L), -28);
    s.text(cx, yb + 36, T('w = {w}, t = {t} per leaf spring', { w: mm(i.w), t: mm(i.t) }), { fill: c.muted, 'font-size': 11 });
    if (pole[1] < 20 || pole[1] > 300) notes.push('pole lies outside the drawing');
    if (rot) notes.push('rotation exaggerated for clarity');
    return { svg: s.toString(), notes: notes, caption: caption(lf, ['θ = ' + PEC.fmt(lf * i.theta * 1e3, 3) + ' mrad', resText(res, 'M', lf), resText(res, 'σ', lf)]) };
  }

  // ---------------------------------------------------------------- beam bending
  function support(s, kind, x, y, side) {
    var c = s.c;
    if (kind === 'clamp') {
      s.ground(side < 0 ? x - 18 : x, y - 30, 18, 60);
    } else if (kind === 'pin' || kind === 'roller') {
      s.path(polyline([[x, y], [x - 10, y + 16], [x + 10, y + 16]]) + 'z', { fill: c.fill });
      if (kind === 'roller') { s.circle(x - 6, y + 21, 4, { fill: c.bg }); s.circle(x + 6, y + 21, 4, { fill: c.bg }); s.ground(x - 16, y + 25, 32, 6); }
      else s.ground(x - 16, y + 16, 32, 8);
    } else if (kind === 'guide') {
      s.rect(x, y - 30, 8, 60, { fill: c.fill2 });
      s.circle(x + 12, y - 18, 4, { fill: c.bg }); s.circle(x + 12, y + 18, 4, { fill: c.bg });
      s.ground(x + 16, y - 30, 12, 60);
    }
  }

  function bendingPreview(i, res, c, anim) {
    var s = Sketch(460, 300, c), notes = [], lf = loadOf(anim);
    var x0 = 50, x1 = 330, y = 120, Lp = x1 - x0;
    var sup = {
      'cant-F': ['clamp', null], 'cant-M': ['clamp', null], 'cant-q': ['clamp', null],
      'ss-F': ['pin', 'roller'], 'ss-M': ['pin', 'roller'], 'ss-q': ['pin', 'roller'],
      'ff-q': ['clamp', 'clamp'], 'fg-F': ['clamp', 'guide']
    }[i.case] || ['clamp', null];
    s.rect(x0, y - 5, Lp, 10);
    support(s, sup[0], x0, sup[0] === 'clamp' ? y : y + 5, -1);
    if (sup[1]) support(s, sup[1], x1, sup[1] === 'roller' ? y + 5 : y, 1);
    s.text(x0, y - 44, 'A', { 'font-weight': 600 });
    s.text(/-F$/.test(i.case) && i.case !== 'ss-F' ? x1 + 16 : x1, y - 44, 'B', { 'font-weight': 600 });
    // Loads
    if (/-F$/.test(i.case)) {
      var xf = i.case === 'ss-F' ? x0 + Lp * Math.min(Math.max(i.a / i.L, 0), 1) : x1;
      if (lf > 0.05) s.arrow(xf, y - 8 - 40 * lf, xf, y - 8);
      s.text(xf === x1 ? xf - 14 : xf + 12, y - 40, 'F', { fill: c.accent, 'font-style': 'italic' });
      if (i.case === 'ss-F') s.dim(x0, y, xf, y, 'a = ' + mm(i.a), -60);
    } else if (/-M$/.test(i.case)) {
      s.path('M' + n(x1 - 14) + ' ' + n(y - 24) + 'A 22 22 0 1 1 ' + n(x1 + 12) + ' ' + n(y + 20), { stroke: c.accent, 'stroke-width': 2, 'marker-end': 'url(#' + s.id + 'a)', opacity: n(0.25 + 0.75 * lf) });
      s.text(x1 + 30, y - 26, 'M', { fill: c.accent, 'font-style': 'italic' });
    } else {
      var qh = 26 * lf;
      if (lf > 0.05) for (var q = 0; q <= 10; q++) { var xq = x0 + Lp * q / 10; s.arrow(xq, y - 8 - qh, xq, y - 8, { 'stroke-width': 1.3 }); }
      s.line(x0, y - 8 - qh, x1, y - 8 - qh, { stroke: c.accent, 'stroke-width': 1.3 });
      s.text((x0 + x1) / 2, y - 46, 'q', { fill: c.accent, 'font-style': 'italic' });
    }
    // Deflection curve (exaggerated)
    var ch = res.chart;
    if (ch) {
      var vals = ch.series[0].values, mx = Math.max.apply(null, vals.map(Math.abs)) || 1;
      var pts = vals.map(function (v, k) { return [x0 + Lp * k / (vals.length - 1), y + v / mx * 40 * lf]; });
      s.path(polyline(pts), { stroke: c.accent, 'stroke-dasharray': '5 4' });
      s.text((x0 + x1) / 2, y + 58, T('deflected shape (exaggerated)'), { fill: c.accent, 'font-size': 11 });
    }
    s.dim(x0, y + 60, x1, y + 60, 'L = ' + mm(i.L), 26);
    // Section inset
    s.text(400, 190, T('Section'), { 'font-weight': 600, 'font-size': 11 });
    notes = notes.concat(drawSection(s, i, 400, 245, 50, { dims: false }));
    s.text(400, 290, T(i.axis === 'y' ? 'bending about y' : 'bending about x'), { fill: c.muted, 'font-size': 10 });
    return { svg: s.toString(), notes: notes, schematic: true, caption: caption(lf, [resText(res, 'δy_max', lf), resText(res, 'σ_max', lf)]) };
  }

  // ---------------------------------------------------------------- buckling
  function modeShape(k) {
    // Normalised lateral buckling shape along ζ ∈ [0, 1] (ζ = 0 at the lower support).
    if (k === '2') return function (z) { return 1 - Math.cos(PI * z / 2); };
    if (k === '1') return function (z) { return Math.sin(PI * z); };
    if (k === '1g') return function (z) { return (1 - Math.cos(PI * z)) / 2; };
    if (k === '2p') return function (z) { return Math.sin(PI * z / 2); };
    if (k === '0.5') return function (z) { return (1 - Math.cos(2 * PI * z)) / 2; };
    // Clamped (ζ = 0) – pinned (ζ = 1): w = A(1 − cos βz) + B(sin βz − βz), βL = 4.4934.
    var b = 4.4934, A = Math.tan(b), f = function (z) { return A * (1 - Math.cos(b * z)) + (Math.sin(b * z) - b * z); };
    var m = 0; for (var q = 0; q <= 100; q++) m = Math.max(m, Math.abs(f(q / 100)));
    return function (z) { return f(z) / m; };
  }

  function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

  function bucklingPreview(i, res, c, anim) {
    var s = Sketch(420, 340, c), notes = [], k = String(i.k);
    var ends = { '2': ['clamp', 'free'], '1': ['pin', 'pin'], '1g': ['clamp', 'guide'], '2p': ['pin', 'guide'], '0.7': ['clamp', 'pin'], '0.5': ['clamp', 'clamp'] }[k];
    // Part of the column that bends like one half sine wave of length L_b = k·L (the pinned–pinned equivalent).
    // For k = 2 the whole column is only half of that wave.
    var seg = { '2': [0, 1], '1': [0, 1], '1g': [0, 1], '2p': [0, 1], '0.7': [1 - PI / 4.4934, 1], '0.5': [0.25, 0.75] }[k];
    var bLab = { '2': '½·L_b', '1': 'L_b = L', '1g': 'L_b = L', '2p': '½·L_b', '0.7': 'L_b = 0.7·L', '0.5': 'L_b = 0.5·L' }[k];
    var cx = 120, yb = 296, Lp = 196, yt = yb - Lp;

    // Animation: load F ramps up to F_b with the column straight, it buckles at F_b, then the load is removed.
    var fr = 1, bow = 1, cap = '', fb = resItem(res, 'F_b');
    if (anim !== undefined) {
      if (anim < 0.4) { fr = smooth(anim / 0.4); bow = 0; cap = T('F < F_b: the column stays straight'); }
      else if (anim < 0.7) { fr = 1; bow = smooth((anim - 0.4) / 0.15); cap = T('F = F_b: the column buckles sideways in this mode'); }
      else { fr = 1 - smooth((anim - 0.7) / 0.25); bow = fr; cap = T('load removed: the column springs back (elastic)'); }
      if (fb) cap = T('F = {F} ({p} % of F_b)', { F: qty(fr * fb.value, 'N'), p: Math.round(fr * 100) }) + ' · ' + cap;
    }
    var amp = 30 * bow, f = modeShape(k), tip = amp * f(1), q, z, pts = [];

    // Straight reference axis and the (deflected) column, drawn as a solid outlined bar.
    s.line(cx, yb + 4, cx, yt - 4, { stroke: c.muted, 'stroke-width': 0.8, 'stroke-dasharray': '6 3 1 3' });
    for (q = 0; q <= 40; q++) { z = q / 40; pts.push([cx + amp * f(z), yb - z * Lp]); }
    s.path(polyline(pts), { stroke: c.fg, 'stroke-width': 9, 'stroke-linecap': 'butt' });
    s.path(polyline(pts), { stroke: c.fill2, 'stroke-width': 6, 'stroke-linecap': 'butt' });

    function end(kind, x, y, top) {
      if (!top) {
        if (kind === 'clamp') s.ground(x - 30, y, 60, 16);
        else { s.path(polyline([[x, y], [x - 10, y + 16], [x + 10, y + 16]]) + 'z', { fill: c.fill }); s.ground(x - 18, y + 16, 36, 8); }
        return 0;
      }
      // Top end: the load acts on it, so it must be free to move down; walls show what is restrained sideways.
      var wall = function () { s.ground(x - 26, y - 34, 8, 34); s.ground(x + 18, y - 34, 8, 34); };
      if (kind === 'pin') { s.circle(x, y - 6, 6, { fill: c.bg }); wall(); return 12; }
      if (kind === 'clamp') { s.rect(x - 18, y - 16, 36, 16, { fill: c.fill2 }); wall(); return 16; }
      if (kind === 'guide') {
        s.rect(x - 18, y - 16, 36, 16, { fill: c.fill2 });
        s.text(x - 24, y - 8, T('guided'), { fill: c.muted, 'font-size': 10, 'text-anchor': 'end', x: x - 24 });
        return 16;
      }
      return 0;
    }
    end(ends[0], cx, yb, false);
    var topY = yt - end(ends[1], cx + tip, yt, true);
    // Axial load on the top end; it moves with the end when the end can move sideways.
    var al = 12 + 30 * fr, ax = cx + tip;
    s.arrow(ax, topY - 4 - al, ax, topY - 4);
    s.text(ax + 12, topY - al + 2, 'F', { fill: c.accent, 'font-style': 'italic' });

    // Dimensions: column length L and the buckling length L_b = k·L (one half sine wave).
    s.dim(cx - 5, yb, cx - 5, yt, 'L = ' + mm(i.L), -40);
    var bx = cx + 74, y0 = yb - seg[0] * Lp, y1 = yb - seg[1] * Lp;
    s.dim(bx, y0, bx, y1, bLab, -14, { labelAt: [bx + 36, (y0 + y1) / 2] });
    if (seg[0] > 0) s.line(cx, y0, bx + 4, y0, { stroke: c.muted, 'stroke-width': 0.6, 'stroke-dasharray': '2 2' });
    if (seg[1] < 1) s.line(cx, y1, bx + 4, y1, { stroke: c.muted, 'stroke-width': 0.6, 'stroke-dasharray': '2 2' });
    if (k === '2' || k === '2p') s.text(bx + 36, (y0 + y1) / 2 + 16, 'L_b = 2·L', { fill: c.muted, 'font-size': 11 });

    s.text(320, 60, T('Section'), { 'font-weight': 600, 'font-size': 11 });
    notes = notes.concat(drawSection(s, i, 320, 140, 90));
    if (anim !== undefined) notes.push('sideways deflection exaggerated');
    return { svg: s.toString(), notes: notes, schematic: true, caption: cap };
  }

  // ---------------------------------------------------------------- Hertz contact
  function hertzView(s, cx, cy, rTop, rBot, label, kpx, dz, flat) {
    var c = s.c, w = 70;
    function body(r, top) {
      var d = top ? -1 : 1; // direction away from the contact
      if (!isFinite(r) || r === 0) {
        s.rect(cx - w, top ? cy - 40 : cy, 2 * w, 40, { fill: top ? c.fill2 : c.fill });
        return;
      }
      var R = Math.abs(r) * kpx;
      if (r > 0) {
        // Convex: circle (or arc) touching the contact point.
        if (R < w) s.circle(cx, cy + d * R, R, { fill: top ? c.fill2 : c.fill });
        else {
          var sag = R - Math.sqrt(R * R - w * w);
          s.path('M' + n(cx - w) + ' ' + n(cy + d * sag) + 'A' + n(R) + ' ' + n(R) + ' 0 0 ' + (top ? 0 : 1) + ' ' + n(cx + w) + ' ' + n(cy + d * sag) + 'L' + n(cx + w) + ' ' + n(cy + d * 40) + 'L' + n(cx - w) + ' ' + n(cy + d * 40) + 'z', { fill: top ? c.fill2 : c.fill });
        }
      } else {
        // Concave: block with a circular cavity of radius R opening towards the contact.
        var hw = Math.min(R, w), sg = R - Math.sqrt(Math.max(R * R - hw * hw, 0));
        s.path('M' + n(cx - w) + ' ' + n(cy - d * sg) + 'L' + n(cx - hw) + ' ' + n(cy - d * sg) + 'A' + n(R) + ' ' + n(R) + ' 0 0 ' + (top ? 1 : 0) + ' ' + n(cx + hw) + ' ' + n(cy - d * sg) + 'L' + n(cx + w) + ' ' + n(cy - d * sg) + 'L' + n(cx + w) + ' ' + n(cy + d * 40) + 'L' + n(cx - w) + ' ' + n(cy + d * 40) + 'z', { fill: top ? c.fill2 : c.fill });
      }
    }
    body(rBot, false);
    // Animated: the top body moves down by the (exaggerated) approach and the contact flattens.
    if (dz) s.add('<g transform="translate(0 ' + n(dz) + ')">');
    body(rTop, true);
    if (dz) s.add('</g>');
    if (flat) s.line(cx - flat, cy + (dz || 0) / 2, cx + flat, cy + (dz || 0) / 2, { stroke: c.accent, 'stroke-width': 3 });
    s.text(cx, cy + 100, label, { fill: c.muted, 'font-size': 11 });
  }

  function hertzPreview(i, res, c, anim) {
    var s = Sketch(460, 300, c), notes = [], lf = loadOf(anim);
    var dz = anim === undefined ? 0 : 6 * Math.pow(lf, 2 / 3), fl = anim === undefined ? 0 : 10 * Math.cbrt(lf);
    var rs = [i.r1x, i.r1y, i.r2x, i.r2y].map(PEC.inf).filter(isFinite).map(Math.abs);
    var kpx = rs.length ? 40 / Math.min.apply(null, rs) : 1;
    function lab(r) { r = PEC.inf(r); return isFinite(r) ? mm(r) : T('flat'); }
    hertzView(s, 110, 140, PEC.inf(i.r1x), PEC.inf(i.r2x), 'x–z: r₁ₓ = ' + lab(i.r1x) + ', r₂ₓ = ' + lab(i.r2x), kpx, dz, fl);
    hertzView(s, 300, 140, PEC.inf(i.r1y), PEC.inf(i.r2y), 'y–z: r₁ᵧ = ' + lab(i.r1y) + ', r₂ᵧ = ' + lab(i.r2y), kpx, dz, fl);
    if (lf > 0.05) s.arrow(205, 80 - 40 * lf, 205, 80);
    s.text(218, 40, 'F', { fill: c.accent, 'font-style': 'italic' });
    s.text(110, 18, T('body 1 (top), body 2 (bottom)'), { fill: c.muted, 'font-size': 11, 'text-anchor': 'start', x: 20 });
    if (Math.abs(i.theta) > 1e-9) notes.push('views drawn without the misalignment angle θ');
    notes.push('contact ellipse enlarged');
    // Contact ellipse
    var A = res.results.filter(function (r) { return r.sym === 'a'; })[0], B = res.results.filter(function (r) { return r.sym === 'b'; })[0];
    if (A && B && A.value > 0) {
      var ex = 410, ey = 140, ka = 30 / A.value, ce = Math.cbrt(lf);
      s.text(ex, 60, T('Contact'), { 'font-weight': 600, 'font-size': 11 });
      s.add('<ellipse' + attrs({ cx: ex, cy: ey, rx: n(30 * ce), ry: n(Math.max(B.value * ka * ce, 1.5)), fill: c.accentSoft, stroke: c.accent, 'stroke-width': 1.5 }) + '/>');
      s.text(ex, ey + 50, '2a = ' + qty(2 * A.value, 'µm'), { fill: c.muted, 'font-size': 10 });
      s.text(ex, ey + 64, '2b = ' + qty(2 * B.value, 'µm'), { fill: c.muted, 'font-size': 10 });
    }
    if (dz) notes.push('approach exaggerated for clarity');
    // Hertz: δ ∝ F^(2/3), contact size ∝ F^(1/3), pressure ∝ F^(1/3).
    var dl = resItem(res, 'δ'), pm = resItem(res, 'σ_max');
    return { svg: s.toString(), notes: notes, caption: caption(lf, [
      'F = ' + qty(lf * i.F, 'N'),
      dl ? 'δ = ' + qty(Math.pow(lf, 2 / 3) * dl.value, 'µm') : '',
      pm ? 'σ_max = ' + qty(Math.cbrt(lf) * pm.value, 'MPa') : ''
    ]) };
  }

  // ---------------------------------------------------------------- springs, impact, bolt stack
  function zigzag(x1, y1, x2, y2, coils) {
    var dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx * dx + dy * dy), ux = dx / L, uy = dy / L, px = -uy, py = ux;
    var pts = [[x1, y1], [x1 + ux * 8, y1 + uy * 8]], seg = (L - 16) / (coils * 2);
    for (var q = 1; q <= coils * 2; q++) {
      var t = 8 + seg * (q - 0.5), sgn = q % 2 ? 1 : -1;
      pts.push([x1 + ux * t + px * 8 * sgn, y1 + uy * t + py * 8 * sgn]);
    }
    pts.push([x2 - ux * 8, y2 - uy * 8], [x2, y2]);
    return polyline(pts);
  }

  function stiffnessPreview(i, res, c, anim) {
    var cs = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map(function (k, q) { return { v: i[k], name: 'C' + '₁₂₃₄₅₆'[q] }; })
      .filter(function (o) { return o.v !== null && !isNaN(o.v) && o.v !== 0; });
    if (!cs.length) return null;
    var s = Sketch(420, 260, c);
    s.ground(30, 20, 360, 16);
    var mass = i.m > 0;
    // Animated: free vibration of the mass on the springs (amplitude exaggerated).
    var off = anim === undefined ? 0 : 14 * Math.sin(2 * PI * anim);
    if (i.mode === 'series') {
      var top = 36, seg = (150 + off) / cs.length, x = 210;
      cs.forEach(function (o, q) {
        var y1 = top + q * seg, y2 = y1 + seg - 6;
        s.path(zigzag(x, y1, x, y2, 4), { 'stroke-width': 1.5 });
        s.text(x + 60, (y1 + y2) / 2, o.name + ' = ' + qty(o.v, 'N/µm'), { 'font-size': 11, 'text-anchor': 'start', x: x + 20 });
        if (q < cs.length - 1) s.rect(x - 14, y2, 28, 6, { fill: c.fill2 });
      });
      s.rect(x - 50, top + 150 + off - 6, 100, 34, { fill: mass ? c.fill2 : c.fill });
      if (mass) s.text(x, top + 161 + off, 'm = ' + qty(i.m, 'kg'), { 'font-size': 11 });
    } else {
      var w = 300 / cs.length;
      cs.forEach(function (o, q) {
        var xq = 60 + w * (q + 0.5);
        s.path(zigzag(xq, 36, xq, 170 + off, 5), { 'stroke-width': 1.5 });
        s.text(xq, 216, o.name, { 'font-size': 11 });
        s.text(xq, 230, qty(o.v, 'N/µm'), { 'font-size': 10, fill: c.muted });
      });
      s.rect(40, 170 + off, 340, 26, { fill: mass ? c.fill2 : c.fill });
      if (mass) s.text(210, 183 + off, 'm = ' + qty(i.m, 'kg'), { 'font-size': 11 });
    }
    var f0 = resText(res, 'f₀');
    return { svg: s.toString(), notes: [], schematic: true, caption: anim === undefined ? '' : (f0 ? T('free vibration at {f} (slowed down, amplitude exaggerated)', { f: f0 }) : T('enter a mass m to get the eigenfrequency')) };
  }

  function impactPreview(i, res, c, anim) {
    var s = Sketch(420, 170, c);
    var rigid = !isFinite(PEC.inf(i.C2));
    // Animated: approach (0–0.4), contact as a half sine (0.4–0.6, compression exaggerated), rebound (0.6–1).
    var xm = 40, u = 0, dir = 1, cap = '';
    if (anim !== undefined) {
      var Fm = resItem(res, 'F'), fr = 0;
      if (anim < 0.4) { xm = 60 * anim / 0.4; cap = T('approach at v₀'); }
      else if (anim < 0.6) { fr = Math.sin(PI * (anim - 0.4) / 0.2); xm = 60; u = 45 * fr; cap = T('contact: the spring decelerates the mass'); dir = anim < 0.5 ? 1 : -1; }
      else { xm = 60 * (1 - (anim - 0.6) / 0.4); dir = -1; cap = T('rebound at −v₀ (no damping)'); }
      if (Fm) cap += ' · F = ' + qty(fr * Fm.value, 'N');
    }
    var C = rigid ? i.C1 : 1 / (1 / i.C1 + 1 / i.C2), u2 = rigid ? 0 : u * C / i.C2;
    s.rect(xm + u, 50, 80, 60, { fill: c.fill2 });
    s.text(xm + u + 40, 80, 'm = ' + qty(i.m, 'kg'), { 'font-size': 11 });
    if (anim === undefined || u < 40) {
      var ax = xm + u + 20;
      if (dir > 0) s.arrow(ax, 130, ax + 60, 130); else s.arrow(ax + 60, 130, ax, 130);
      s.text(ax + 30, 146, (anim !== undefined && dir < 0 ? '−' : '') + 'v₀ = ' + qty(i.v0, 'mm/s'), { fill: c.accent, 'font-size': 11 });
    }
    s.path(zigzag(140 + u, 80, rigid ? 360 : 250 + u2, 80, 5));
    s.text(rigid ? 250 : 195, 58, 'C₁ = ' + qty(i.C1, 'N/µm'), { 'font-size': 11 });
    if (!rigid) {
      s.rect(250 + u2, 70, 8, 20, { fill: c.fill2 });
      s.path(zigzag(258 + u2, 80, 360, 80, 4));
      s.text(309, 58, 'C₂ = ' + qty(i.C2, 'N/µm'), { 'font-size': 11 });
    }
    s.ground(360, 30, 20, 100);
    return { svg: s.toString(), notes: [], schematic: true, caption: cap };
  }

  // ---------------------------------------------------------------- motion profile (animated carriage)
  function motionPreview(i, res, c, anim) {
    if (!(i.s > 0 && i.v > 0 && i.a > 0 && i.j > 0)) return null;
    var m = PEC.motionProfile(i.s, i.v, i.a, i.j), T = m.T[7];
    // The move takes 80 % of the cycle, then the carriage rests at the end.
    var t = anim === undefined ? T : Math.min(anim / 0.8, 1) * T, st = m.at(t);
    var s = Sketch(440, 190, c), x0 = 60, x1 = 340, w = 60;
    var xp = x0 + (x1 - x0) * Math.min(Math.max(st.p / i.s, 0), 1);
    s.rect(x0 - 10, 110, x1 - x0 + w + 20, 10, { fill: c.fill });
    s.ground(x0 - 10, 120, x1 - x0 + w + 20, 10);
    s.line(x0 + w / 2, 70, x0 + w / 2, 132, { stroke: c.muted, 'stroke-dasharray': '3 3', 'stroke-width': 1 });
    s.line(x1 + w / 2, 70, x1 + w / 2, 132, { stroke: c.muted, 'stroke-dasharray': '3 3', 'stroke-width': 1 });
    s.rect(xp, 74, w, 36, { fill: c.fill2 });
    s.circle(xp + w / 2, 92, 3, { fill: c.accent, stroke: 'none' });
    var vl = 60 * st.v / i.v;
    if (vl > 3) s.arrow(xp + w / 2, 58, xp + w / 2 + vl, 58);
    s.text(xp + w / 2, 44, 'v', { fill: c.accent, 'font-style': 'italic' });
    s.dim(x0 + w / 2, 150, x1 + w / 2, 150, 's = ' + mm(i.s), 14);
    var cap = anim === undefined ? '' : 't = ' + PEC.fmt(t * 1e3, 3) + ' ms · p = ' + qty(st.p, 'mm') + ' · v = ' + qty(st.v, 'mm/s') + ' · a = ' + qty(Math.abs(st.a) < 1e-9 * i.a ? 0 : st.a, 'm/s²');
    return { svg: s.toString(), notes: anim === undefined ? [] : ['slowed down to about 2.5 s per move'], schematic: true, caption: cap };
  }

  function boltPreview(i, res, c) {
    var Ls = i.Lc * (i.rB - i.rC) / (i.rS - i.rB);
    if (!(Ls > 0) || !isFinite(Ls)) return null;
    var s = Sketch(380, 330, c), notes = ['widths schematic, lengths to scale'];
    var k = 200 / (i.Lc + Ls), x = 150, top = 50, hS = Ls * k, hC = i.Lc * k;
    s.rect(x - 60, top + hS + hC, 120, 40, { fill: 'url(#' + s.id + 'h)' });
    s.text(x, top + hS + hC + 54, T('base (thread)'), { fill: c.muted, 'font-size': 11 });
    s.rect(x - 45, top, 90, hS, { fill: c.accentSoft });
    s.rect(x - 60, top + hS, 120, hC, { fill: c.fill });
    s.rect(x - 7, top - 4, 14, hS + hC + 30, { fill: c.fill2 });
    s.rect(x - 22, top - 18, 44, 14, { fill: c.fill2 });
    s.text(x + 110, top + hS / 2, T('spacer'), { fill: c.muted, 'font-size': 11 });
    s.text(x + 110, top + hS + hC / 2, T('clamped part'), { fill: c.muted, 'font-size': 11 });
    s.dim(x - 45, top, x - 45, top + hS, 'L_S = ' + mm(Ls), 26);
    s.dim(x - 60, top + hS, x - 60, top + hS + hC, 'L_C = ' + mm(i.Lc), 14);
    return { svg: s.toString(), notes: notes };
  }

  var PREVIEWS = {
    'leaf-spring': function (i, r, c, a) { return springPreview(i, r, c, false, a); },
    'rod-spring': function (i, r, c, a) { return springPreview(i, r, c, true, a); },
    'folded-leaf-spring': foldedPreview,
    'flexure-hinge': hingePreview,
    'cross-spring-pivot': pivotPreview,
    'cross-section': sectionPreview,
    'tension-shear': sectionPreview,
    'torsion': sectionPreview,
    'beam-bending': bendingPreview,
    'buckling': bucklingPreview,
    'hertz-contact': hertzPreview,
    'equivalent-stiffness': stiffnessPreview,
    'impact-force': impactPreview,
    'thermal-bolt-compensation': boltPreview,
    'motion-profile': motionPreview
  };
  // Calculators whose sketch can be animated (render with an `anim` phase).
  var ANIMATED = ['leaf-spring', 'rod-spring', 'folded-leaf-spring', 'flexure-hinge', 'cross-spring-pivot', 'beam-bending',
    'buckling', 'hertz-contact', 'equivalent-stiffness', 'impact-force', 'motion-profile'];

  // Returns {svg, notes, caption?} or null when the calculator has no preview or the inputs can't be drawn.
  // `anim` (optional) is the animation phase in [0, 1); leave it out for the static sketch.
  function render(calcId, si, res, colors, anim) {
    var fn = PREVIEWS[calcId];
    if (!fn) return null;
    if (anim !== undefined && ANIMATED.indexOf(calcId) < 0) anim = undefined;
    try {
      var out = fn(si, res, colors, anim);
      if (!out) return null;
      out.notes = out.notes.filter(function (v, k, a) { return a.indexOf(v) === k; });
      return out;
    } catch (e) {
      return null;
    }
  }

  // Rasterise an SVG string to a JPEG data URL (for the PDF report).
  function toImage(svg, width, height, scale) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement('canvas');
        cv.width = width * scale; cv.height = height * scale;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = function () { reject(new Error('Could not render the geometry preview')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  function size(svg) {
    var m = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
    return m ? { w: +m[1], h: +m[2] } : { w: 400, h: 300 };
  }

  PEC.preview = { render: render, toImage: toImage, size: size, has: function (id) { return !!PREVIEWS[id]; },
    animates: function (id) { return ANIMATED.indexOf(id) >= 0; } };
})(typeof window !== 'undefined' ? window : globalThis);
