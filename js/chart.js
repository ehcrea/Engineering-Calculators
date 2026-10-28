/*
 * Minimal canvas line chart. Values are SI; they are converted to the series/axis display units.
 */
(function (root) {
  'use strict';
  var PEC = root.PEC;

  function niceStep(range, target) {
    var raw = range / target, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  }
  function ticks(min, max, target) {
    if (min === max) { min -= 1; max += 1; }
    var step = niceStep(max - min, target), out = [];
    for (var v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return out;
  }

  // spec: {title, x:{label,unit,values}, series:[{label,unit,values}], invertY}
  // opts: {width, height, colors:{fg, muted, grid, line, bg}, scale}
  function draw(canvas, spec, opts) {
    var scale = opts.scale || root.devicePixelRatio || 1;
    var W = opts.width, H = opts.height, c = opts.colors;
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, W, H);

    var du = PEC.units.du, xu = du(spec.x.unit), ser = spec.series[0], yu = du(ser.unit);
    var xs = spec.x.values.map(function (v) { return PEC.fromSI(v, xu); });
    var ys = ser.values.map(function (v) { return PEC.fromSI(v, yu); });
    var xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs);
    var ymin = Math.min(0, Math.min.apply(null, ys)), ymax = Math.max(0, Math.max.apply(null, ys));
    var pad = (ymax - ymin) * 0.08 || 1;
    ymin -= ymin < 0 ? pad : 0; ymax += ymax > 0 ? pad : 0;

    var font = '12px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.font = font;
    var yt = ticks(ymin, ymax, 5), xt = ticks(xmin, xmax, 6);
    var labelW = Math.max.apply(null, yt.map(function (v) { return ctx.measureText(PEC.fmt(v, 3)).width; }));
    var L = Math.max(44, labelW + 14), R = 14, T = 30, B = 40;
    var pw = W - L - R, ph = H - T - B;
    var inv = !!spec.invertY;
    function X(v) { return L + (v - xmin) / (xmax - xmin || 1) * pw; }
    function Y(v) { var f = (v - ymin) / (ymax - ymin || 1); return inv ? T + f * ph : T + ph - f * ph; }

    // Title
    ctx.fillStyle = c.fg;
    ctx.font = '600 13px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(PEC.t(spec.title) + '  (' + ser.label + ' [' + yu + '])', L, 18);

    // Grid + ticks
    ctx.font = font;
    ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
    ctx.fillStyle = c.muted;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    yt.forEach(function (v) {
      var y = Math.round(Y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(L + pw, y); ctx.stroke();
      ctx.fillText(PEC.fmt(v, 3), L - 6, y);
    });
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    xt.forEach(function (v) {
      var x = Math.round(X(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, T + ph); ctx.stroke();
      ctx.fillText(PEC.fmt(v, 3), x, T + ph + 6);
    });
    ctx.fillText(spec.x.label + ' [' + xu + ']', L + pw / 2, T + ph + 22);

    // Zero line
    if (ymin < 0 && ymax > 0) {
      ctx.strokeStyle = c.muted;
      ctx.beginPath(); ctx.moveTo(L, Y(0)); ctx.lineTo(L + pw, Y(0)); ctx.stroke();
    }

    // Series
    ctx.strokeStyle = c.line; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    xs.forEach(function (x, k) { if (k) ctx.lineTo(X(x), Y(ys[k])); else ctx.moveTo(X(x), Y(ys[k])); });
    ctx.stroke();

    // Text alternative for screen readers: what is plotted and over which range.
    var ylo = Math.min.apply(null, ys), yhi = Math.max.apply(null, ys);
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', PEC.t('Chart: {title}. {y} from {y0} to {y1} {yu} over {x} from {x0} to {x1} {xu}.', {
      title: PEC.t(spec.title), y: ser.label, y0: PEC.fmt(ylo, 3), y1: PEC.fmt(yhi, 3), yu: yu,
      x: spec.x.label, x0: PEC.fmt(xmin, 3), x1: PEC.fmt(xmax, 3), xu: xu
    }));
  }

  PEC.chart = { draw: draw };
})(typeof window !== 'undefined' ? window : globalThis);
