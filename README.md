# Precision Engineering Calculators

Web-based calculators for precision mechanical design, built on the formulas of the free
[JPE Precision Point](https://www.jpe-innovations.com/precision-point/) resource.

It is a static site with no build step and no backend. It runs on GitHub Pages, any static host,
or straight from the folder.

## Calculators

| Category | Calculator | JPE article |
|---|---|---|
| Flexures | Leaf spring (S/C-shape) | Flexure engineering fundamental: Leaf spring |
| | Rod spring (wire flexure) | Rod spring |
| | Folded leaf spring | Flexure engineering fundamental: Folded leaf spring |
| | Elastic (notch) hinge | Flexure hinge or elastic hinge |
| | Cross spring pivot | Cross spring pivot |
| Beam theory | Area moment of inertia | Area moment of inertia |
| | Tension, compression & shear | Beam theory: Tension/compression and shear |
| | Beam bending (8 support/load cases, deflection plot) | Beam theory: Bending |
| | Torsion | Beam theory: Torsion |
| | Euler buckling | Beam theory: Buckling |
| Contact & dynamics | Hertz contact (point/elliptical) | Hertz contact: Universal point |
| | Impact force | Impact force |
| | Equivalent stiffness & eigenfrequency | Equivalent stiffness |
| Motion & control | Third order motion profile (with plots) | Third order point-to-point motion profile |
| Thermal | Thermal shrinkage in bolted joints | Compensating thermal shrinkage in bolted connections |
| | Thermal expansion | Common materials: Selection and properties |
| Reference | Material property table (also used as presets) | Common materials: Selection and properties |

Calculators with a physical shape (springs, hinge, pivot, sections, beams, columns, Hertz contact,
spring networks, impact and the bolt stack) show a **live geometry preview**: a dimensioned sketch
redrawn from the inputs, also included in the PDF report. Thin features and deflections are
exaggerated when needed, and the sketch says when it is not to scale.

Most sketches can also be **animated** (▶ Animate): springs, hinges and beams are loaded and released,
the column buckles once the load reaches F_b, the Hertz contact flattens, the mass vibrates on its springs,
the impact mass hits and rebounds, and a carriage follows the motion profile. A live caption shows the
load and the matching results at each moment.

The **?** icon next to each calculator's title explains the theory: how it works, the key design
insights and the assumptions behind the formulas (hover on desktop, tap on touch screens).

The site is available in **English, German, Dutch and Turkish**. Pick a language in the header; the
choice is remembered in the browser. It covers the whole interface, calculator labels and results,
warnings, sketches, the theory notes and the PDF report.

The **Metric / US** switch in the header shows every input and result in metric (SI) or US customary
units (in, µin, lbf, ksi, Msi, lb, °F, …) and converts the values on the spot. Calculations are always
saved in metric units, so saved calculations, JSON files and share links open correctly in either system.

Each calculator links to its source article and lists the formulas it uses. Stress results are checked
against a fatigue (dynamic) or yield (static) limit with an optional safety factor, as JPE recommends.

## Saving, restoring and exporting

- **Autosave:** inputs are kept in the browser (localStorage) for each calculator.
- **Save / Save as…:** stores named calculations. Open, delete or export them from **Saved**.
- **JSON export/import:** back up or move calculations between computers and colleagues.
  **Download JSON** exports the current calculator; **Saved → Export JSON** exports the list.
- **Copy link:** a URL that contains all inputs, for sharing or bookmarking.
- **Export PDF:** a report with project name, notes, inputs, results, warnings, plots and formulas.
  **Print** gives a print-friendly page.

## Run locally

```bash
python3 -m http.server 8000   # then open http://localhost:8000
npm test                      # formula checks against hand calculations (Node, no dependencies)
```

Opening `index.html` directly from disk also works.

## Deploy

`.github/workflows/pages.yml` runs the tests and publishes the site to GitHub Pages on every push to
`main`. One-time setup: *Settings → Pages → Build and deployment → Source: GitHub Actions*.

## Adding a calculator

Calculators are plain objects registered with `PEC.register({...})` in `js/calculators/*.js`:

- `inputs` lists fields with a metric display unit (for example `mm`, `GPa`, `N/µm`). The US counterpart
  of each unit is in `US_UNITS` in `js/core.js`; a new metric unit needs an entry there.
- `compute(i)` receives every value **in SI units** and returns result rows with their display units.

Unit conversion, the form, saving and the PDF are handled for you. Add a theory note to `js/theory.js`,
optionally a sketch to `js/preview.js`, and a check to `tests/run-tests.js`.

## Translations

English is the source language. Texts are written in English in the code, and `js/i18n/de.js`,
`nl.js` and `tr.js` map each English text to its translation (`PEC.t(text, vars)` looks it up and
falls back to English). `npm test` lists any text that has no translation, so when you add or change
a label, warning, theory note or sketch text, add the same English key to each language file.

## Notes on interpretation

- **Elastic hinge:** `d₁`, `d₂` are taken as the diameters of the circular notch cuts. With equal
  notches this reproduces the classic Paros–Weisbord stiffness. Enter `0` for a flat side.
- **Hertz contact:** JPE gives the ellipticity factors `f₂`, `f₃` only as a graph. They are computed
  here from the Brewe & Hamrock elliptic-contact approximations and normalised to 1 for circular contact.
- **Leaf/rod spring buckling:** buckling length is L for the S-shape (guided end) and 2L for the C-shape (free end).
- **Material presets:** Poisson's ratio is not in the JPE table, so typical handbook values are used.

## Disclaimer

This is an independent tool and is not affiliated with or endorsed by JPE. Formulas are reproduced
from their public resource for convenience. Verify results before using them in critical designs.

## Third-party

- [jsPDF](https://github.com/parallax/jsPDF) 2.5.2 and [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) 3.8.4 (MIT), vendored in `vendor/`
- [DejaVu Sans](https://dejavu-fonts.github.io/) (subset, free license) for Unicode symbols in PDFs
