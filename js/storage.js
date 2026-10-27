/*
 * Persistence: autosave of current inputs, named snapshots, JSON import/export and shareable links.
 * Everything lives in the browser's localStorage; JSON export is the portable backup.
 */
(function (root) {
  'use strict';
  var PEC = root.PEC;
  var KEY_CURRENT = 'pec:v1:current';
  var KEY_SNAPSHOTS = 'pec:v1:snapshots';
  var KEY_LAST = 'pec:v1:last';
  var FORMAT = 'precision-engineering-calculators';

  function read(key, fallback) {
    try {
      var s = root.localStorage.getItem(key);
      return s ? JSON.parse(s) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { root.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  var store = {
    loadCurrent: function (calcId) { return (read(KEY_CURRENT, {}) || {})[calcId] || null; },
    saveCurrent: function (calcId, values) {
      var all = read(KEY_CURRENT, {}) || {};
      all[calcId] = values;
      write(KEY_CURRENT, all);
    },
    clearCurrent: function (calcId) {
      var all = read(KEY_CURRENT, {}) || {};
      delete all[calcId];
      write(KEY_CURRENT, all);
    },
    lastCalc: function () { return read(KEY_LAST, null); },
    setLastCalc: function (id) { write(KEY_LAST, id); },

    snapshots: function () { return read(KEY_SNAPSHOTS, []) || []; },
    addSnapshot: function (calcId, name, values) {
      var list = store.snapshots();
      var snap = { id: uid(), name: name, calc: calcId, values: values, savedAt: new Date().toISOString() };
      list.unshift(snap);
      write(KEY_SNAPSHOTS, list);
      return snap;
    },
    updateSnapshot: function (id, values) {
      var list = store.snapshots();
      list.forEach(function (s) { if (s.id === id) { s.values = values; s.savedAt = new Date().toISOString(); } });
      write(KEY_SNAPSHOTS, list);
    },
    deleteSnapshot: function (id) {
      write(KEY_SNAPSHOTS, store.snapshots().filter(function (s) { return s.id !== id; }));
    },

    // Export document: {format, version, exportedAt, snapshots:[...]}.
    exportDoc: function (snapshots) {
      return { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), snapshots: snapshots };
    },

    // Parse an imported JSON document. Accepts a full export or a single {calc, values} object.
    parseImport: function (text) {
      var doc = JSON.parse(text);
      var snaps;
      if (doc && Array.isArray(doc.snapshots)) snaps = doc.snapshots;
      else if (doc && doc.calc && doc.values) snaps = [doc];
      else throw new Error('Not a calculator export file.');
      return snaps.filter(function (s) { return s && PEC.get(s.calc) && s.values && typeof s.values === 'object'; })
        .map(function (s) {
          return { id: uid(), name: String(s.name || PEC.get(s.calc).title), calc: s.calc, values: s.values, savedAt: s.savedAt || new Date().toISOString() };
        });
    },
    importSnapshots: function (snaps) {
      var list = store.snapshots();
      write(KEY_SNAPSHOTS, snaps.concat(list));
      return snaps.length;
    },

    // Shareable link: #/calc-id?key=value&...
    toHash: function (calcId, values) {
      var parts = Object.keys(values).filter(function (k) { return values[k] !== '' && values[k] !== null && values[k] !== undefined; })
        .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(values[k]); });
      return '#/' + calcId + (parts.length ? '?' + parts.join('&') : '');
    },
    fromHash: function (hash) {
      var m = /^#\/([^?]+)(?:\?(.*))?$/.exec(hash || '');
      if (!m) return null;
      var values = {};
      (m[2] || '').split('&').filter(Boolean).forEach(function (p) {
        var kv = p.split('=');
        values[decodeURIComponent(kv[0])] = decodeURIComponent(kv.slice(1).join('=') || '');
      });
      return { calc: decodeURIComponent(m[1]), values: values };
    }
  };

  PEC.store = store;
})(typeof window !== 'undefined' ? window : globalThis);
