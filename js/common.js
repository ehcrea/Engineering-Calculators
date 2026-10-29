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

  // Literature cited where a calculator deliberately differs from the JPE article (def.corrections[].refs).
  var REFERENCES = {
    timoshenko: 'S. P. Timoshenko, J. M. Gere, Mechanics of Materials, 4th ed., PWS Publishing, 1997, §9.11 (shear deformation of beams).',
    cowper: 'G. R. Cowper, "The shear coefficient in Timoshenko\'s beam theory", Journal of Applied Mechanics 33 (1966) 335–340.',
    roark: 'W. C. Young, R. G. Budynas, Roark\'s Formulas for Stress and Strain, 7th ed., McGraw-Hill, 2002, §8.10 (shear deflection).',
    johnson: 'K. L. Johnson, Contact Mechanics, Cambridge University Press, 1985, §4.2 (elliptical Hertz contact).',
    hamrock: 'B. J. Hamrock, D. E. Brewe, "Simplified solution for stresses and deformations", Journal of Lubrication Technology 105 (1983) 171–177.',
    wittrick: 'W. H. Wittrick, "The properties of crossed flexure pivots, and the influence of the point at which the strips cross", Aeronautical Quarterly 2 (1951) 272–292.',
    haringx: 'J. A. Haringx, "The cross-spring pivot as a constructional element", Applied Scientific Research A1 (1949) 313–332.',
    ptfe: 'Professional Plastics, Typical Properties of PTFE (unfilled PTFE, ASTM D696: 7.5·10⁻⁵ in/in·°F = 135 µm/m·K).',
    c51000: 'Wieland Concast, C51000 Phosphor Bronze product data sheet (thermal conductivity 69.2 W/m·K at 20 °C).',
    soemers: 'H. Soemers, Design Principles for Precision Mechanisms, T-Pointprint, Enschede, 2010, ch. 5 (leaf springs and cross-spring pivots).'
  };

  // Numbers the references of a list of notes [{text, refs}] in order of first use.
  // Returns {items: [{text, nums}], refs: [citation]}.
  function citations(notes) {
    var keys = [], items = (notes || []).map(function (c) {
      return { text: c.text, nums: (c.refs || []).map(function (k) {
        if (keys.indexOf(k) < 0) keys.push(k);
        return keys.indexOf(k) + 1;
      }) };
    });
    return { items: items, refs: keys.map(function (k) { return REFERENCES[k]; }) };
  }

  PEC.common = { materialInputs: materialInputs, allowable: allowable, stressCheck: stressCheck, citations: citations };
  PEC.REFERENCES = REFERENCES;
})(typeof window !== 'undefined' ? window : globalThis);
