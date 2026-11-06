// Settings for tools/build-pages.js (language pages, SEO tags, sitemap).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Load the browser scripts that hold the translations and the calculator list.
const ROOT = path.join(__dirname, '..');
const ctx = vm.createContext({ console });
ctx.window = ctx; ctx.globalThis = ctx;
['js/core.js', 'js/i18n.js', 'js/i18n/de.js', 'js/i18n/es.js', 'js/i18n/nl.js', 'js/i18n/tr.js', 'js/materials.js', 'js/sections.js', 'js/common.js',
  'js/calculators/flexures.js', 'js/calculators/beams.js', 'js/calculators/dynamics.js',
].forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const PEC = ctx.PEC;
const LANGS = ['en', 'de', 'nl', 'tr', 'es'];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const meta = {
  title: {
    en: 'Precision Engineering Calculators: flexures, beams, Hertz contact and thermal design',
    de: 'Rechner für Präzisionstechnik: Festkörpergelenke, Balken, Hertzsche Pressung und Wärme',
    nl: 'Rekenmodules voor precisietechniek: flexures, balken, Hertz-contact en thermisch ontwerp',
    tr: 'Hassas Mühendislik Hesaplayıcıları: esnek mafsallar, kirişler, Hertz teması ve ısıl tasarım',
    es: 'Calculadoras de ingeniería de precisión: flexiones, vigas, contacto de Hertz y diseño térmico',
  },
  description: {
    en: 'Free online calculators for precision mechanical design, based on the JPE Precision Point formulas: leaf springs, notch hinges and other flexures, beam bending, torsion and buckling, Hertz contact, eigenfrequency, motion profiles and thermal effects. Metric or US units, PDF reports.',
    de: 'Kostenlose Online-Rechner für die präzisionsmechanische Konstruktion nach den Formeln von JPE Precision Point: Blattfedern, Festkörpergelenke, Balkenbiegung, Torsion und Knickung, Hertzsche Pressung, Eigenfrequenz, Bewegungsprofile und thermische Effekte. Metrische oder US-Einheiten, PDF-Berichte.',
    nl: 'Gratis online rekenmodules voor precisiemechanisch ontwerp, gebaseerd op de formules van JPE Precision Point: bladveren, scharnieren en andere flexures, buiging, torsie en knik van balken, Hertz-contact, eigenfrequentie, bewegingsprofielen en thermische effecten. Metrische of Amerikaanse eenheden, PDF-rapporten.',
    tr: 'JPE Precision Point formüllerine dayanan, hassas mekanik tasarım için ücretsiz çevrim içi hesaplayıcılar: yaprak yaylar, çentikli mafsallar ve diğer esnek mafsallar, kiriş eğilmesi, burulma ve burkulma, Hertz teması, doğal frekans, hareket profilleri ve ısıl etkiler. Metrik veya ABD birimleri, PDF raporları.',
    es: 'Calculadoras gratuitas en línea para diseño mecánico de precisión, basadas en las fórmulas de JPE Precision Point: ballestas, bisagras elásticas y otras flexiones, flexión, torsión y pandeo de vigas, contacto de Hertz, frecuencia propia, perfiles de movimiento y efectos térmicos. Unidades métricas o de EE. UU., informes PDF.',
  },
};

/** Crawlable list of all calculators, shown until the app replaces it with a calculator. */
function intro(l) {
  PEC.i18n.setLang(l, false);
  const t = PEC.t;
  const groups = [];
  for (const def of PEC.list) {
    let g = groups.find((x) => x.name === def.category);
    if (!g) groups.push(g = { name: def.category, items: [] });
    g.items.push(def);
  }
  const html = '<div class="calc-head"><h2>' + esc(t('Precision Engineering Calculators')) + '</h2><p class="calc-desc">' + esc(meta.description[l]) + '</p></div>' +
    groups.map((g) => '<h3>' + esc(t(g.name)) + '</h3><ul>' +
      g.items.map((d) => '<li><a href="#/' + d.id + '">' + esc(t(d.title)) + '</a>: ' + esc(t(d.description)) + '</li>').join('') + '</ul>').join('');
  PEC.i18n.setLang('en', false);
  return html;
}

module.exports = {
  base: 'https://ehcrea.github.io/Engineering-Calculators/',
  repo: 'https://github.com/ehcrea/Engineering-Calculators',
  name: 'Precision Engineering Calculators',
  ogImage: 'icons/og-image.png',
  langs: LANGS,
  meta,
  featureList: ['Flexures: leaf spring, wire flexure, folded leaf spring, notch hinge, cross spring pivot', 'Beam theory: area moment of inertia, bending, torsion, Euler buckling', 'Hertz contact, impact force, stiffness and eigenfrequency', 'Third order motion profiles', 'Thermal expansion and thermal shrinkage in bolted joints', 'PDF reports', 'English, German, Dutch, Turkish and Spanish'],
  dict: (l) => PEC.i18n.dict(l),
  blocks: () => ({ intro: Object.fromEntries(LANGS.map((l) => [l, intro(l)])) }),
  assets: /\b(href|src)="(favicon\.ico|icons\/|css\/|js\/|site\.webmanifest)/g,
};
