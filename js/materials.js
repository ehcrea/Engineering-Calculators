/*
 * Material properties from JPE Precision Point "Common materials: Selection and properties".
 * Where JPE lists a range, the lower bound is used for strength and the midpoint for E/α/λ.
 * Poisson's ratio (nu) is NOT in the JPE table; typical handbook values are used.
 * Fatigue values marked "est." are estimated by JPE as σ0.2 / 3.
 */
(function (root) {
  'use strict';
  // name, E [GPa], ρ [kg/m³], σ0.2 [MPa], σmax [MPa], σfatigue [MPa], fatigue note, α [µm/m·K], c [J/kg·K], λ [W/m·K], ν (typical)
  var rows = [
    ['Aluminum 6082-T6', 70, 2710, 260, 310, 70, '5·10⁸ cycles', 23.1, 894, 172, 0.33],
    ['Aluminum 7075-T6', 72, 2800, 460, 525, 160, '5·10⁸ cycles', 23.6, 960, 129, 0.33],
    ['Aluminum oxide', 355, 3800, 352, 352, 88, 'est.', 7.7, 880, 23.5, 0.22],
    ['Brass', 110, 8700, 250, 430, 62, 'est.', 21, 380, 122, 0.34],
    ['Copper', 117, 8900, 55, 230, 18, 'est.', 16.8, 385, 390, 0.34],
    ['Diamond', 1200, 3500, 1600, 2800, 533, 'est.', 1.3, 508, 165, 0.07],
    ['Glue (Araldite 2030)', 2, 1050, 20, 20, 6, 'est.', 50, null, 0.22, 0.38],
    ['Granite', 75, 2700, 70, 70, 23, 'est.', 7.4, 800, 3.2, 0.25],
    ['Inconel 718 (annealed and aged)', 214, 8200, 1200, 1400, 225, '5·10⁸ cycles', 13.2, 435, 11.1, 0.29],
    ['Invar', 145, 8100, 300, 450, 100, 'est.', 1, 500, 16, 0.26],
    ['Macor', 66.9, 2520, 94, 94, 31, 'est.', 7.4, 790, 1.46, 0.29],
    ['Magnesium', 45, 1800, 90, 165, 30, 'est.', 25.6, 1000, 150, 0.35],
    ['Molybdenum (Alloy 362)', 320, 10200, 825, 895, 275, 'est.', 5.2, 254, 142, 0.31],
    ['N-BK7', 81, 2510, 70, 70, 23, 'est.', 7.1, 858, 1.1, 0.21],
    ['Nickel', 196, 8880, 59, 317, 19, 'est.', 12.7, 460, 92, 0.31],
    ['PA-6.6 (Nylon)', 1.8, 1130, 55, 55, 18, 'est.', 85, 1700, 0.2, 0.39],
    ['PEEK', 3.7, 1300, 90, 90, 30, 'est.', 45, 2200, 0.25, 0.40],
    ['Phosphor bronze', 117, 8890, 76, 276, 114, '5·10⁸ cycles', 17.8, 380, 208, 0.34],
    ['POM (Delrin)', 4.5, 1420, 65, 65, 21, 'est.', 120, 3100, 0.29, 0.35],
    ['PP Polypropylene', 1.4, 900, 20, 20, 11, '10⁷ cycles', 180, 1870, 0.15, 0.42],
    ['PTFE (Teflon)', 0.5, 2170, 23, 31.5, 7, 'est.', 13, 1400, 0.124, 0.46],
    ['Quartz (crystal)', 80, 2300, 72, 72, 24, 'est.', 10, 710, 10, 0.17],
    ['Silicon', 130, 2329, 195, 195, 65, 'est.', 2.6, 713, 115, 0.28],
    ['Silicon carbide', 410, 3200, 200, 390, 66, 'est.', 4.6, 670, 110, 0.14],
    ['Silicon nitride', 300, 3260, 350, 350, 116, 'est.', 3.2, 700, 35, 0.27],
    ['Stavax', 210, 7750, 1290, 1780, 430, 'est.', 10.5, 460, 20, 0.30],
    ['Steel (carbon)', 210, 7850, 300, 550, 207, '10⁷ cycles', 12, 470, 52, 0.30],
    ['Steel (spring)', 210, 7800, 669, 550, 223, 'est.', 16, 500, 16, 0.30],
    ['Steel (stainless)', 210, 7900, 200, 450, 200, '10⁶ cycles', 17, 450, 16, 0.30],
    ['Ti-6Al-4V (grade 5)', 114, 4430, 880, 950, 510, '10⁷ cycles', 9.0, 580, 6.6, 0.34],
    ['Titanium (grade 2)', 110, 4600, 340, 430, 280, '10⁷ cycles', 8.7, 500, 16.4, 0.34],
    ['Tungsten', 411, 19400, 800, 990, 266, 'est.', 4.5, 134, 173, 0.28],
    ['Tungsten carbide', 650, 15600, 600, 344, 200, 'est.', 5.8, 210, 84, 0.24],
    ['Zerodur', 91, 2530, 90, 90, 30, 'est.', 0.05, 821, 1.64, 0.24]
  ];

  var MATERIALS = rows.map(function (m) {
    return {
      name: m[0], E: m[1], rho: m[2], sy: m[3], su: m[4], sf: m[5], sfNote: m[6],
      alpha: m[7], c: m[8], lambda: m[9], nu: m[10]
    };
  });

  root.PEC = root.PEC || {};
  root.PEC.MATERIALS = MATERIALS;
  root.PEC.material = function (name) {
    for (var i = 0; i < MATERIALS.length; i++) if (MATERIALS[i].name === name) return MATERIALS[i];
    return null;
  };
})(typeof window !== 'undefined' ? window : globalThis);
