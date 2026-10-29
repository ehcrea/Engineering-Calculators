/*
 * PDF report export using jsPDF + AutoTable (vendored, loaded on first use).
 * A subset of DejaVu Sans is embedded so Greek letters, sub/superscripts and math symbols render.
 */
(function (root) {
  'use strict';
  var PEC = root.PEC, t = PEC.t;
  var loading = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error(t('Could not load {src}', { src: src }))); };
      document.head.appendChild(s);
    });
  }

  function ensureLibs() {
    if (!loading) {
      loading = loadScript('vendor/jspdf.umd.min.js')
        .then(function () { return loadScript('vendor/jspdf.plugin.autotable.min.js'); })
        .then(function () { return loadScript('vendor/dejavu-sans-subset.js'); });
    }
    return loading;
  }

  // report: {title, subtitle, source, project, notes, date, inputs:[{label,sym,value,unit}|{heading}],
  //          results:[...same...], warnings:[], formulas:[], corrections:{items, refs}, charts:[{dataUrl, w, h}]}
  function build(report) {
    var jsPDF = root.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.addFileToVFS('DejaVuSans.ttf', root.PEC_FONTS.regular);
    doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
    doc.addFileToVFS('DejaVuSans-Bold.ttf', root.PEC_FONTS.bold);
    doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold');
    doc.setFont('DejaVu', 'normal');

    var M = 15, W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    var y = M;
    var accent = [31, 94, 168];

    doc.setFont('DejaVu', 'bold'); doc.setFontSize(17); doc.setTextColor(20, 24, 31);
    doc.text(report.title, M, y + 5);
    y += 11;
    doc.setFont('DejaVu', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 98, 110);
    doc.text(report.subtitle, M, y); y += 5;
    doc.text(t('Generated {date}', { date: report.date }), M, y); y += 5;
    if (report.project) { doc.setTextColor(20, 24, 31); doc.text(t('Project: {project}', { project: report.project }), M, y); y += 5; }
    if (report.notes) {
      doc.setTextColor(20, 24, 31);
      var lines = doc.splitTextToSize(t('Notes: {notes}', { notes: report.notes }), W - 2 * M);
      doc.text(lines, M, y); y += lines.length * 4.2 + 1;
    }
    doc.setDrawColor(accent[0], accent[1], accent[2]); doc.setLineWidth(0.5);
    doc.line(M, y, W - M, y); y += 4;

    function table(title, rows) {
      var body = rows.map(function (r) {
        if (r.heading) return [{ content: r.heading, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [236, 241, 248], textColor: [31, 94, 168] } }];
        return [r.label, r.sym || '', r.value, r.unit || ''];
      });
      doc.autoTable({
        startY: y,
        head: [[title, t('Symbol'), t('Value'), t('Unit')]],
        body: body,
        margin: { left: M, right: M },
        styles: { font: 'DejaVu', fontSize: 8.5, cellPadding: 1.6, textColor: [20, 24, 31], lineColor: [220, 224, 230], lineWidth: 0.1 },
        headStyles: { font: 'DejaVu', fontStyle: 'bold', fillColor: accent, textColor: 255 },
        columnStyles: { 0: { cellWidth: 82 }, 1: { cellWidth: 32 }, 2: { cellWidth: 40, halign: 'right' }, 3: { cellWidth: 26 } }
      });
      y = doc.lastAutoTable.finalY + 6;
    }

    function ensure(space) { if (y + space > H - M) { doc.addPage(); y = M; } }

    if (report.preview) {
      var pv = report.preview, pw = Math.min(W - 2 * M, 150), ph = pw * pv.h / pv.w;
      if (ph > 85) { ph = 85; pw = ph * pv.w / pv.h; }
      doc.setFont('DejaVu', 'bold'); doc.setFontSize(10); doc.setTextColor(20, 24, 31);
      doc.text(t('Geometry'), M, y + 3); y += 6;
      doc.addImage(pv.dataUrl, 'JPEG', M, y, pw, ph);
      y += ph + 2;
      doc.setFont('DejaVu', 'normal'); doc.setFontSize(7.5); doc.setTextColor(110, 116, 126);
      doc.text(pv.note, M, y + 2); y += 7;
    }

    table(t('Input'), report.inputs);
    table(t('Result'), report.results);

    if (report.warnings.length) {
      ensure(10 + report.warnings.length * 5);
      doc.setFont('DejaVu', 'bold'); doc.setFontSize(10); doc.setTextColor(170, 60, 20);
      doc.text(t('Warnings'), M, y); y += 5;
      doc.setFont('DejaVu', 'normal'); doc.setFontSize(8.5);
      report.warnings.forEach(function (w) {
        var l = doc.splitTextToSize('• ' + w, W - 2 * M);
        doc.text(l, M, y); y += l.length * 4;
      });
      y += 3;
    }

    report.charts.forEach(function (c) {
      var w = W - 2 * M, hh = w * c.h / c.w;
      ensure(hh + 4);
      doc.addImage(c.dataUrl, 'JPEG', M, y, w, hh);
      y += hh + 4;
    });

    if (report.formulas.length) {
      ensure(14);
      doc.setFont('DejaVu', 'bold'); doc.setFontSize(10); doc.setTextColor(20, 24, 31);
      doc.text(t('Formulas'), M, y); y += 5;
      doc.setFont('DejaVu', 'normal'); doc.setFontSize(8.5); doc.setTextColor(50, 56, 66);
      report.formulas.forEach(function (f) {
        var l = doc.splitTextToSize(f, W - 2 * M - 4);
        ensure(l.length * 4);
        doc.text(l, M + 2, y); y += l.length * 4;
      });
      y += 3;
    }

    var corr = report.corrections;
    if (corr && corr.items.length) {
      ensure(14);
      doc.setFont('DejaVu', 'bold'); doc.setFontSize(10); doc.setTextColor(20, 24, 31);
      doc.text(t('Differences from the JPE article'), M, y); y += 5;
      doc.setFont('DejaVu', 'normal'); doc.setFontSize(8.5); doc.setTextColor(50, 56, 66);
      corr.items.forEach(function (it) {
        var l = doc.splitTextToSize('• ' + t(it.text) + (it.nums.length ? ' [' + it.nums.join(', ') + ']' : ''), W - 2 * M - 4);
        ensure(l.length * 4);
        doc.text(l, M + 2, y); y += l.length * 4 + 1;
      });
      if (corr.refs.length) {
        y += 2; ensure(10);
        doc.setFont('DejaVu', 'bold'); doc.setFontSize(9);
        doc.text(t('References'), M, y); y += 4.5;
        doc.setFont('DejaVu', 'normal'); doc.setFontSize(7.5);
        corr.refs.forEach(function (ref, n) {
          var l = doc.splitTextToSize('[' + (n + 1) + '] ' + ref, W - 2 * M - 4);
          ensure(l.length * 3.6);
          doc.text(l, M + 2, y); y += l.length * 3.6;
        });
      }
      y += 3;
    }

    ensure(14);
    doc.setFontSize(7.5); doc.setTextColor(110, 116, 126);
    var foot = doc.splitTextToSize(t('Source:') + ' ' + report.source + '\n' + t('Formulas from the free JPE Precision Point resource. This report is generated by an independent tool and is not affiliated with JPE; verify results for critical designs.'), W - 2 * M);
    doc.text(foot, M, y);

    var pages = doc.internal.getNumberOfPages();
    for (var p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFontSize(7.5); doc.setTextColor(140, 146, 156);
      doc.text(report.title + ' · ' + t('page {p} / {n}', { p: p, n: pages }), W - M, H - 7, { align: 'right' });
    }
    return doc;
  }

  function exportPdf(report, filename) {
    return ensureLibs().then(function () {
      var doc = build(report);
      doc.save(filename);
      return doc;
    });
  }

  PEC.pdf = { exportPdf: exportPdf, ensureLibs: ensureLibs, build: build };
})(typeof window !== 'undefined' ? window : globalThis);
