/*
 * Shared input groups for calculators: material selection and allowable stress.
 */
(function (root) {
  'use strict';
  var PEC = root.PEC;

  // opts: {E, nu, strength} booleans; defaults to all.
  function materialInputs(opts, defaultMaterial) {
    opts = opts || {};
    var useNu = opts.nu !== false, useStrength = opts.strength !== false;
    var m = PEC.material(defaultMaterial || 'Steel (spring)');
    var map = { E: 'E' };
    if (useNu) map.nu = 'nu';
    if (useStrength) { map.sy = 'sy'; map.sf = 'sf'; }
    var list = [
      { type: 'heading', label: 'Material' },
      { id: 'material', type: 'material', label: 'Preset (JPE table)', map: map, value: m.name },
      { id: 'E', label: "Young's modulus", sym: 'E', unit: 'GPa', value: m.E }
    ];
    if (useNu) list.push({ id: 'nu', label: "Poisson's ratio", sym: 'ν', unit: '-', value: m.nu });
    if (useStrength) {
      list.push(
        { id: 'sy', label: 'Yield strength', sym: 'σ₀.₂', unit: 'MPa', value: m.sy },
        { id: 'sf', label: 'Fatigue strength', sym: 'σ_fatigue', unit: 'MPa', value: m.sf },
        { id: 'loadType', label: 'Stress criterion', type: 'select', value: 'dynamic', options: [
          { v: 'dynamic', label: 'Dynamic movement → fatigue limit' },
          { v: 'static', label: 'Static deformation → yield limit' }
        ] },
        { id: 'SF', label: 'Safety factor', sym: 'SF', unit: '-', value: 1 }
      );
    }
    return list;
  }

  function allowable(i) {
    var limit = i.loadType === 'static' ? i.sy : i.sf;
    return limit / (i.SF > 0 ? i.SF : 1);
  }

  // Standard result rows + warning for a stress check.
  function stressCheck(sigma, i, res) {
    var sa = allowable(i);
    res.results.push(PEC.r('Allowable stress (' + (i.loadType === 'static' ? 'yield' : 'fatigue') + ' / SF)', 'σ_allow', sa, 'MPa'));
    res.results.push(PEC.r('Stress utilisation', 'σ/σ_allow', sigma / sa, '%', { highlight: sigma > sa ? 'bad' : 'good' }));
    if (sigma > sa) res.warnings.push('Maximum stress exceeds the allowable stress.');
  }

  PEC.common = { materialInputs: materialInputs, allowable: allowable, stressCheck: stressCheck };
})(typeof window !== 'undefined' ? window : globalThis);
