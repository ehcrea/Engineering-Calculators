#!/usr/bin/env node
/*
 * Builds sw.js, the service worker that makes this calculator work offline and lets it be
 * installed as an app (Chrome/Edge "Install", Safari "Add to Dock").
 *
 *   node tools/build-sw.js          write sw.js
 *   node tools/build-sw.js --check  exit 1 if sw.js is out of date (used by the tests)
 *
 * Run it after changing, adding or removing any file of the site. The cache version in sw.js is
 * a hash of every cached file, so any change gives a new version: browsers then download the
 * new files in the background and drop the old cache.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---- Settings for this repository -------------------------------------------------------
const CONFIG = {
  "name": "engineering-calculators"
};
// -----------------------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['.git', '.github', 'node_modules', 'tests', 'tools']);
const SKIP_FILES = new Set(['sw.js', 'sitemap.xml', 'robots.txt', 'CNAME', 'package.json', 'package-lock.json', 'og-image.png']);
const KEEP_EXT = new Set(['.html', '.css', '.js', '.json', '.webmanifest', '.png', '.svg', '.ico', '.jpg', '.jpeg', '.webp', '.gif', '.woff', '.woff2', '.ttf']);

function walk(dir, out) {
  for (const name of fs.readdirSync(dir).sort()) {
    if (name.startsWith('.') || name.startsWith('_')) continue;
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full).split(path.sep).join('/');
    if (fs.statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name) && !(CONFIG.skip || []).includes(rel)) walk(full, out);
    } else if (KEEP_EXT.has(path.extname(name).toLowerCase()) && !SKIP_FILES.has(name) && !(CONFIG.skip || []).includes(rel)) {
      out.push(rel);
    }
  }
  return out;
}

function build() {
  const files = walk(ROOT, []);
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(CONFIG));
  for (const f of files) { hash.update(f + '\0'); hash.update(fs.readFileSync(path.join(ROOT, f))); }
  const version = hash.digest('hex').slice(0, 12);
  // Pages are cached under their folder URL ("de/" rather than "de/index.html").
  const urls = files.map((f) => (f === 'index.html' ? './' : f.replace(/(^|\/)index\.html$/, '$1')));
  const template = fs.readFileSync(path.join(__dirname, 'sw.template.js'), 'utf8');
  return template
    .replace('__VERSION__', JSON.stringify(CONFIG.name + '-' + version))
    .replace('__PREFIX__', JSON.stringify(CONFIG.name + '-'))
    .replace('__FILES__', JSON.stringify(urls, null, 2))
    .replace('__EXTERNAL__', JSON.stringify(CONFIG.external || []))
    .replace('__FONT_CSS__', JSON.stringify(CONFIG.fontCss || []));
}

const out = build();
const target = path.join(ROOT, 'sw.js');
if (process.argv.includes('--check')) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (current !== out) {
    console.error('sw.js is out of date: run `node tools/build-sw.js` and commit the result.');
    process.exit(1);
  }
  console.log('sw.js is up to date.');
} else {
  fs.writeFileSync(target, out);
  console.log('Wrote sw.js (' + (out.match(/^ {2}"/gm) || []).length + ' files).');
}
