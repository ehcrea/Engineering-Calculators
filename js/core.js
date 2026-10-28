/*
 * Core: calculator registry, unit conversion, number formatting and shared helpers.
 * All calculators compute in SI units; the UI converts inputs/outputs using UNITS.
 */
(function (root) {
  'use strict';

  // Factor to convert a value in the given unit to SI.
  var UNITS = {
    '-': 1, '%': 0.01, '‰': 1e-3, 'ppm': 1e-6,
    'm': 1, 'mm': 1e-3, 'µm': 1e-6, 'nm': 1e-9,
    'm²': 1, 'mm²': 1e-6, 'mm³': 1e-9, 'mm⁴': 1e-12, 'm⁴': 1,
    'N': 1, 'kN': 1e3, 'mN': 1e-3,
    'N/m': 1, 'N/mm': 1e3, 'N/µm': 1e6,
        'Nm': 1, 'Nmm': 1e-3, 'mNm': 1e-3,
    'Nm²': 1, 'Nm/rad': 1, 'Nmm/rad': 1e-3, 'Nm/mrad': 1e3,
    'Pa': 1, 'MPa': 1e6, 'GPa': 1e9,
    'rad': 1, 'mrad': 1e-3, 'µrad': 1e-6, 'deg': Math.PI / 180,
    'kg': 1, 'g': 1e-3, 'kg/m³': 1,
    'Hz': 1, 's': 1, 'ms': 1e-3, 'µs': 1e-6,
    'm/s': 1, 'mm/s': 1e-3,
    'm/s²': 1, 'mm/s²': 1e-3, 'g₀': 9.80665,
    'm/s³': 1, 'mm/s³': 1e-3,
    'K': 1, '1/K': 1, 'µm/m·K': 1e-6, 'J/kg·K': 1, 'W/m·K': 1,
    // US customary
    'in': 0.0254, 'ft': 0.3048, 'mil': 2.54e-5, 'µin': 2.54e-8,
    'in²': 6.4516e-4, 'in³': 1.6387064e-5, 'in⁴': 4.162314256e-7,
    'lbf': 4.4482216152605, 'lbf/in': 175.126835246476,
    'lbf·in': 0.112984829027617, 'lbf·in/rad': 0.112984829027617, 'lbf·in²': 0.00286981465730147,
    'psi': 6894.75729316836, 'ksi': 6894757.29316836, 'Msi': 6894757293.16836,
    'lb': 0.45359237, 'lb/in³': 27679.9047102031,
    'in/s': 0.0254, 'in/s²': 0.0254, 'in/s³': 0.0254,
    '°F': 5 / 9, 'µin/in·°F': 1.8e-6, 'Btu/lb·°F': 4186.8, 'Btu/h·ft·°F': 1.73073466637139
  };

  // Unit systems: calculators declare metric units; in the US system each one is shown in its
  // US customary counterpart. Units without an entry (ratios, angles, time, frequency) stay as they are.
  var US_UNITS = {
    'mm': 'in', 'm': 'ft', 'µm': 'µin', 'nm': 'µin',
    'mm²': 'in²', 'm²': 'in²', 'mm³': 'in³', 'mm⁴': 'in⁴', 'm⁴': 'in⁴',
    'N': 'lbf', 'kN': 'lbf', 'mN': 'lbf',
    'N/m': 'lbf/in', 'N/mm': 'lbf/in', 'N/µm': 'lbf/in',
    'Nm': 'lbf·in', 'Nmm': 'lbf·in', 'mNm': 'lbf·in', 'Nm²': 'lbf·in²',
    'Nm/rad': 'lbf·in/rad', 'Nmm/rad': 'lbf·in/rad', 'Nm/mrad': 'lbf·in/rad',
    'Pa': 'psi', 'MPa': 'ksi', 'GPa': 'Msi',
    'kg': 'lb', 'g': 'lb', 'kg/m³': 'lb/in³',
    'm/s': 'in/s', 'mm/s': 'in/s', 'm/s²': 'in/s²', 'mm/s²': 'in/s²', 'm/s³': 'in/s³', 'mm/s³': 'in/s³',
    'K': '°F', 'µm/m·K': 'µin/in·°F', 'J/kg·K': 'Btu/lb·°F', 'W/m·K': 'Btu/h·ft·°F'
  };
  var SYSTEMS = ['metric', 'us'];
  var UNITS_KEY = 'pec:v1:units';
  var system = 'metric';

  function setSystem(s, persist) {
    system = SYSTEMS.indexOf(s) >= 0 ? s : 'metric';
    if (persist !== false) { try { root.localStorage.setItem(UNITS_KEY, system); } catch (e) { /* ignore */ } }
    return system;
  }
  try { if (root.localStorage) setSystem(root.localStorage.getItem(UNITS_KEY), false); } catch (e) { /* ignore */ }

  // Unit shown for a declared (metric) unit in the current system.
  function du(unit) { return system === 'us' && US_UNITS[unit] ? US_UNITS[unit] : unit; }

  // Convert between a value in a declared unit and the same value in its display unit.
  function toDisplay(value, unit) { return du(unit) === unit ? value : fromSI(toSI(value, unit), du(unit)); }
  function fromDisplay(value, unit) { return du(unit) === unit ? value : fromSI(toSI(value, du(unit)), unit); }

  // "value unit" text for an SI value, in the display unit of `unit`.
  function q(si, unit, digits) { return fmt(fromSI(si, du(unit)), digits) + ' ' + du(unit); }

  function toSI(value, unit) {
    var f = UNITS[unit];
    if (f === undefined) throw new Error('Unknown unit: ' + unit);
    return value * f;
  }

  function fromSI(value, unit) {
    var f = UNITS[unit];
    if (f === undefined) throw new Error('Unknown unit: ' + unit);
    return value / f;
  }

  // Format a number with ~4 significant digits, switching to exponent notation for extremes.
  function fmt(v, digits) {
    digits = digits || 4;
    if (v === null || v === undefined || (typeof v === 'number' && isNaN(v))) return '–';
    if (typeof v !== 'number') return String(v);
    if (!isFinite(v)) return v > 0 ? '∞' : '−∞';
    if (v === 0) return '0';
    var a = Math.abs(v);
    if (a >= 1e6 || a < 1e-3) {
      var s = v.toExponential(digits - 1);
      var parts = s.split('e');
      var exp = parseInt(parts[1], 10);
      return parts[0].replace(/\.?0+$/, '') + '·10' + superscript(exp);
    }
    var p = Number(v.toPrecision(digits));
    return p.toLocaleString('en-US', { maximumFractionDigits: 10, useGrouping: false });
  }

  function superscript(n) {
    var map = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
    return String(n).split('').map(function (c) { return map[c] || c; }).join('');
  }

  var registry = [];
  function register(def) {
    if (!def.id || !def.compute) throw new Error('Calculator needs id and compute');
    registry.push(def);
  }

  function get(id) {
    for (var i = 0; i < registry.length; i++) if (registry[i].id === id) return registry[i];
    return null;
  }

  // Default input values of a calculator, keyed by input id (in display units).
  function defaults(def) {
    var o = {};
    def.inputs.forEach(function (inp) {
      if (inp.type === 'heading') return;
      o[inp.id] = inp.value;
    });
    return o;
  }

  // Convert display-unit input values to SI for compute(). Selects pass through unchanged.
  function inputsToSI(def, values) {
    var si = {};
    def.inputs.forEach(function (inp) {
      if (inp.type === 'heading' || inp.type === 'material') return;
      var v = values[inp.id];
      if (inp.type === 'select' || inp.type === 'text') { si[inp.id] = v; return; }
      if (v === '' || v === null || v === undefined) { si[inp.id] = inp.optional ? null : NaN; return; }
      var n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
      si[inp.id] = inp.unit ? toSI(n, inp.unit) : n;
    });
    return si;
  }

  // Run a calculator with display-unit values. Returns {results, warnings, notes, chart}.
  function run(def, values) {
    var si = inputsToSI(def, values);
    var res = def.compute(si, values) || {};
    res.results = (res.results || []).map(function (r) {
      if (r.type === 'heading') return r;
      var out = Object.assign({}, r);
      // `value` stays SI; `unit` and `display` follow the current unit system.
      out.unit = du(r.unit);
      if (typeof r.value === 'number' && r.unit) out.display = fromSI(r.value, out.unit);
      else out.display = r.value;
      return out;
    });
    res.warnings = res.warnings || [];
    return res;
  }

  // Treat 0, blank or non-finite radius as "flat / infinite".
  function inf(x) {
    return (x === null || x === undefined || x === 0 || isNaN(x)) ? Infinity : x;
  }

  function shearModulus(E, nu) { return E / (2 * (1 + nu)); }

  // Helper used by calculators to declare a result row.
  function r(label, sym, value, unit, extra) {
    return Object.assign({ label: label, sym: sym, value: value, unit: unit || '' }, extra || {});
  }
  function h(label) { return { type: 'heading', label: label }; }

  root.PEC = Object.assign(root.PEC || {}, {
    UNITS: UNITS, toSI: toSI, fromSI: fromSI, fmt: fmt,
    units: { US: US_UNITS, set: setSystem, system: function () { return system; }, du: du, toDisplay: toDisplay, fromDisplay: fromDisplay, q: q },
    register: register, get: get, list: registry,
    defaults: defaults, inputsToSI: inputsToSI, run: run,
    inf: inf, G: shearModulus, r: r, h: h
  });
})(typeof window !== 'undefined' ? window : globalThis);
