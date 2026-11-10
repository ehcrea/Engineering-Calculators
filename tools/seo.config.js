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
  'js/calculators/flexures.js', 'js/calculators/beams.js', 'js/calculators/dynamics.js', 'js/calculators/elements.js', 'js/theory.js',
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
    en: 'Free online calculators for precision mechanical design by E. Tozlu: leaf springs, notch hinges and other flexures, beam bending, torsion and buckling, Hertz contact, eigenfrequency, motion profiles and thermal effects. Metric or US units, PDF reports. Formulas based on the free JPE Precision Point articles.',
    de: 'Kostenlose Online-Rechner für die präzisionsmechanische Konstruktion von E. Tozlu: Blattfedern, Festkörpergelenke, Balkenbiegung, Torsion und Knickung, Hertzsche Pressung, Eigenfrequenz, Bewegungsprofile und thermische Effekte. Metrische oder US-Einheiten, PDF-Berichte. Formeln nach den frei verfügbaren Artikeln von JPE Precision Point.',
    nl: 'Gratis online rekenmodules voor precisiemechanisch ontwerp door E. Tozlu: bladveren, scharnieren en andere flexures, buiging, torsie en knik van balken, Hertz-contact, eigenfrequentie, bewegingsprofielen en thermische effecten. Metrische of Amerikaanse eenheden, PDF-rapporten. Formules gebaseerd op de gratis artikelen van JPE Precision Point.',
    tr: 'E. Tozlu tarafından hazırlanan, hassas mekanik tasarım için ücretsiz çevrim içi hesaplayıcılar: yaprak yaylar, çentikli mafsallar ve diğer esnek mafsallar, kiriş eğilmesi, burulma ve burkulma, Hertz teması, doğal frekans, hareket profilleri ve ısıl etkiler. Metrik veya ABD birimleri, PDF raporları. Formüller ücretsiz JPE Precision Point makalelerine dayanır.',
    es: 'Calculadoras gratuitas en línea para diseño mecánico de precisión, por E. Tozlu: ballestas, bisagras elásticas y otras flexiones, flexión, torsión y pandeo de vigas, contacto de Hertz, frecuencia propia, perfiles de movimiento y efectos térmicos. Unidades métricas o de EE. UU., informes PDF. Fórmulas basadas en los artículos gratuitos de JPE Precision Point.',
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
      g.items.map((d) => '<li><a href="' + d.id + '/">' + esc(t(d.title)) + '</a>: ' + esc(t(d.description)) + '</li>').join('') + '</ul>').join('');
  PEC.i18n.setLang('en', false);
  return html;
}

/** Title, description and crawlable text of one calculator's own page. */
function calcPage(l, id) {
  PEC.i18n.setLang(l, false);
  const t = PEC.t;
  const def = PEC.get(id);
  const th = (PEC.THEORY || {})[id];
  const site = t('Precision Engineering Calculators');
  const name = t('{name} calculator', { name: t(def.title) });
  const list = (items) => '<ul>' + items.map((x) => '<li>' + esc(t(x)) + '</li>').join('') + '</ul>';
  const html = '<div class="calc-head"><h2>' + esc(name) + '</h2><p class="calc-desc">' + esc(t(def.description)) + '</p></div>' +
    (th ? '<h3>' + esc(t('How it works')) + '</h3><p>' + esc(t(th.intro)) + '</p>' +
      (th.points && th.points.length ? '<h3>' + esc(t('Key points')) + '</h3>' + list(th.points) : '') +
      (th.assumptions && th.assumptions.length ? '<h3>' + esc(t('Assumptions')) + '</h3>' + list(th.assumptions) : '') : '') +
    '<p><a href="../">' + esc(t('All calculators')) + '</a>' + (def.source ? ' · <a href="' + esc(def.source) + '">' + esc(t('Full article on JPE Precision Point')) + '</a>' : ' · ' + esc(t('Based on:')) + ' ' + esc(t(def.basis))) + '</p>';
  const out = { title: name + ' | ' + site, description: t(def.description), name, html };
  PEC.i18n.setLang('en', false);
  return out;
}

module.exports = {
  calcs: () => PEC.list.map((d) => d.id),
  calcPage,
  base: 'https://ehcrea.github.io/Engineering-Calculators/',
  repo: 'https://github.com/ehcrea/Engineering-Calculators',
  name: 'Precision Engineering Calculators',
  ogImage: 'icons/og-image.png',
  langs: LANGS,
  meta,
  featureList: ['Flexures: leaf spring, wire flexure, folded leaf spring, notch hinge, cross spring pivot', 'Beam theory: area moment of inertia, bending, torsion, Euler buckling', 'Hertz contact, impact force, stiffness and eigenfrequency', 'Mass moment of inertia and kinematic coupling preload', 'Bolt preload and tightening torque (VDI 2230), press fits (DIN 7190)', 'Third order motion profiles', 'Thermal expansion and thermal shrinkage in bolted joints', 'PDF reports', 'English, German, Dutch, Turkish and Spanish'],
  dict: (l) => PEC.i18n.dict(l),
  blocks: () => ({ intro: Object.fromEntries(LANGS.map((l) => [l, intro(l)])) }),
  assets: /\b(href|src)="(favicon\.ico|icons\/|css\/|js\/|site\.webmanifest)/g,
};
