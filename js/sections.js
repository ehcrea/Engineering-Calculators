/*
 * Cross-section properties (JPE Precision Point "Area moment of inertia" and "Beam theory: Torsion").
 * Bending about x uses the "h" (height) direction; e = distance from neutral axis to outer fibre.
 */
(function (root) {
  'use strict';
  var PI = Math.PI;

  var SHAPES = {
    rect: 'Rectangle (w × h)',
    hollowRect: 'Hollow rectangle',
    circle: 'Solid circle (Ø d)',
    tube: 'Tube (Ø do / Ø di)',
    ibeam: 'I-beam',
    triangle: 'Triangle (w × h)',
    ellipse: 'Ellipse (semi-axes r₁, r₂)'
  };

  // Torsion constant of a solid rectangle (JPE, w ≥ h is enforced by swapping).
  function rectTorsion(w, h) {
    var a = Math.max(w, h), b = Math.min(w, h), q = b / a;
    var J = (1 / 16) * a * b * b * b * (16 / 3 - 3.36 * q * (1 - Math.pow(q, 4) / 12));
    var tauFactor = (3 / (a * b * b)) * (1 + 0.6095 * q + 0.8865 * q * q - 1.8023 * Math.pow(q, 3) + 0.9100 * Math.pow(q, 4));
    return { J: J, tauFactor: tauFactor };
  }

  // Returns {A, Ix, Iy, ex, ey, J, tauFactor} in SI. tauFactor: τmax = tauFactor·T.
  function props(s) {
    var o;
    switch (s.shape) {
      case 'rect': {
        var t = rectTorsion(s.w, s.h);
        o = { A: s.w * s.h, Ix: s.w * Math.pow(s.h, 3) / 12, Iy: Math.pow(s.w, 3) * s.h / 12, ex: s.h / 2, ey: s.w / 2, J: t.J, tauFactor: t.tauFactor };
        break;
      }
      case 'hollowRect': {
        var tw = (s.wo - s.wi) / 2, th = (s.ho - s.hi) / 2;
        o = {
          A: s.wo * s.ho - s.wi * s.hi,
          Ix: (s.wo * Math.pow(s.ho, 3) - s.wi * Math.pow(s.hi, 3)) / 12,
          Iy: (Math.pow(s.wo, 3) * s.ho - Math.pow(s.wi, 3) * s.hi) / 12,
          ex: s.ho / 2, ey: s.wo / 2
        };
        // JPE thin-walled formula assumes a uniform wall thickness t.
        if (Math.abs(tw - th) <= 1e-9 * Math.max(s.wo, s.ho)) {
          var tt = tw, w = s.wo, h = s.ho;
          o.J = 2 * tt * tt * Math.pow(w - tt, 2) * Math.pow(h - tt, 2) / ((w + h) * tt - 2 * tt * tt);
          o.tauFactor = 1 / (2 * tt * (w - tt) * (h - tt));
          o.tauNote = 'average shear stress (thin-walled); inner corners are higher without fillets';
        }
        break;
      }
      case 'circle': {
        var r = s.d / 2;
        o = { A: PI * r * r, Ix: PI / 4 * Math.pow(r, 4), Iy: PI / 4 * Math.pow(r, 4), ex: r, ey: r, J: PI / 2 * Math.pow(r, 4), tauFactor: 2 / (PI * Math.pow(r, 3)) };
        break;
      }
      case 'tube': {
        var ro = s.do / 2, ri = s.di / 2, d4 = Math.pow(ro, 4) - Math.pow(ri, 4);
        o = { A: PI * (ro * ro - ri * ri), Ix: PI / 4 * d4, Iy: PI / 4 * d4, ex: ro, ey: ro, J: PI / 2 * d4, tauFactor: 2 * ro / (PI * d4) };
        break;
      }
      case 'ibeam': {
        var hw = s.h - 2 * s.t1;
        o = {
          A: 2 * s.w * s.t1 + s.t2 * hw,
          Ix: s.w * Math.pow(s.h, 3) / 12 - (s.w - s.t2) * Math.pow(hw, 3) / 12,
          Iy: Math.pow(s.t2, 3) * hw / 12 + 2 * Math.pow(s.w, 3) * s.t1 / 12,
          ex: s.h / 2, ey: s.w / 2
        };
        break;
      }
      case 'triangle':
        // Isosceles triangle, base w, height h; centroid at h/3 from the base.
        o = { A: s.w * s.h / 2, Ix: s.w * Math.pow(s.h, 3) / 36, Iy: Math.pow(s.w, 3) * s.h / 48, ex: 2 * s.h / 3, ey: s.w / 2 };
        break;
      case 'ellipse':
        o = { A: PI * s.r1 * s.r2, Ix: PI / 4 * s.r1 * Math.pow(s.r2, 3), Iy: PI / 4 * Math.pow(s.r1, 3) * s.r2, ex: s.r2, ey: s.r1 };
        break;
      default:
        throw new Error('Unknown shape ' + s.shape);
    }
    o.Wx = o.Ix / o.ex;
    o.Wy = o.Iy / o.ey;
    return o;
  }

  function validate(s) {
    var w = [];
    if (s.shape === 'hollowRect' && (s.wi >= s.wo || s.hi >= s.ho)) w.push('Inner dimensions must be smaller than outer dimensions.');
    if (s.shape === 'tube' && s.di >= s.do) w.push('Inner diameter must be smaller than outer diameter.');
    if (s.shape === 'ibeam' && (2 * s.t1 >= s.h || s.t2 >= s.w)) w.push('Flange/web thickness too large for the given w and h.');
    return w;
  }

  // Input field definitions for a section selector, to be spread into a calculator's inputs.
  function inputs(defaultShape, shapes) {
    shapes = shapes || Object.keys(SHAPES);
    var opts = shapes.map(function (k) { return { v: k, label: SHAPES[k] }; });
    function on(list) { return { field: 'shape', values: list }; }
    return [
      { type: 'heading', label: 'Cross-section' },
      { id: 'shape', label: 'Shape', type: 'select', options: opts, value: defaultShape || 'rect' },
      { id: 'w', label: 'Width', sym: 'w', unit: 'mm', value: 10, showIf: on(['rect', 'ibeam', 'triangle']) },
      { id: 'h', label: 'Height (bending direction)', sym: 'h', unit: 'mm', value: 2, showIf: on(['rect', 'ibeam', 'triangle']) },
      { id: 'wo', label: 'Outer width', sym: 'wₒ', unit: 'mm', value: 20, showIf: on(['hollowRect']) },
      { id: 'ho', label: 'Outer height', sym: 'hₒ', unit: 'mm', value: 20, showIf: on(['hollowRect']) },
      { id: 'wi', label: 'Inner width', sym: 'wᵢ', unit: 'mm', value: 16, showIf: on(['hollowRect']) },
      { id: 'hi', label: 'Inner height', sym: 'hᵢ', unit: 'mm', value: 16, showIf: on(['hollowRect']) },
      { id: 'd', label: 'Diameter', sym: 'd', unit: 'mm', value: 5, showIf: on(['circle']) },
      { id: 'do', label: 'Outer diameter', sym: 'dₒ', unit: 'mm', value: 10, showIf: on(['tube']) },
      { id: 'di', label: 'Inner diameter', sym: 'dᵢ', unit: 'mm', value: 8, showIf: on(['tube']) },
      { id: 't1', label: 'Flange thickness', sym: 't₁', unit: 'mm', value: 1, showIf: on(['ibeam']) },
      { id: 't2', label: 'Web thickness', sym: 't₂', unit: 'mm', value: 1, showIf: on(['ibeam']) },
      { id: 'r1', label: 'Semi-axis (width direction)', sym: 'r₁', unit: 'mm', value: 5, showIf: on(['ellipse']) },
      { id: 'r2', label: 'Semi-axis (bending direction)', sym: 'r₂', unit: 'mm', value: 3, showIf: on(['ellipse']) }
    ];
  }

  var FORMULAS = [
    'Rectangle: Iₓ = w·h³/12, I_y = w³·h/12',
    'Hollow rectangle: Iₓ = (wₒ·hₒ³ − wᵢ·hᵢ³)/12',
    'Circle: Iₓ = I_y = π/4·r⁴',
    'Tube: Iₓ = I_y = π/4·(rₒ⁴ − rᵢ⁴)',
    'I-beam: Iₓ = w·h³/12 − (w − t₂)(h − 2t₁)³/12, I_y = t₂³(h − 2t₁)/12 + 2w³t₁/12',
    'Triangle: Iₓ = w·h³/36, I_y = w³·h/48',
    'Ellipse: Iₓ = π/4·r₁·r₂³, I_y = π/4·r₁³·r₂',
    'Section modulus W = I/e (e = distance to outer fibre)'
  ];

  root.PEC = root.PEC || {};
  root.PEC.sections = { SHAPES: SHAPES, props: props, inputs: inputs, validate: validate, rectTorsion: rectTorsion, FORMULAS: FORMULAS };
})(typeof window !== 'undefined' ? window : globalThis);
