/*
 * Translations: English is the source language. Every user-visible string is passed through
 * PEC.t(english, vars); the language files in js/i18n/ map the English text to its translation.
 * Placeholders like {name} are filled from `vars`. Untranslated text falls back to English.
 */
(function (root) {
  'use strict';
  var PEC = root.PEC = root.PEC || {};
  var KEY = 'pec:v1:lang';

  var LANGS = [
    { code: 'en', name: 'English', locale: 'en-GB' },
    { code: 'de', name: 'Deutsch', locale: 'de-DE' },
    { code: 'nl', name: 'Nederlands', locale: 'nl-NL' },
    { code: 'tr', name: 'Türkçe', locale: 'tr-TR' }
  ];
  var dicts = {};
  var lang = 'en';
  var missing = null;

  function supported(code) { return LANGS.some(function (l) { return l.code === code; }); }

  function add(code, dict) { dicts[code] = Object.assign(dicts[code] || {}, dict); }

  function fill(s, vars) {
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined && vars[k] !== null ? vars[k] : m; });
  }

  // Strings without words (pure formulas such as "Cₓ = E·b·t³ / L³") need no translation.
  var MATH_WORDS = /\b(cos|sin|tan|min|max|abs|avg|ave|ref|proj|local|peak|vert|hor)\b/g;
  function hasWords(s) {
    return /[A-Za-z]{3,}/.test(s.replace(/_[^\s,()=/·+;:]+/g, '').replace(MATH_WORDS, ''));
  }

  function t(s, vars) {
    if (s === null || s === undefined || s === '') return s;
    s = String(s);
    if (lang !== 'en') {
      var tr = dicts[lang] && dicts[lang][s];
      if (tr !== undefined) return fill(tr, vars);
      if (missing && hasWords(s)) missing[s] = true;
    }
    return fill(s, vars);
  }

  function setLang(code, persist) {
    lang = supported(code) ? code : 'en';
    if (persist !== false) { try { root.localStorage.setItem(KEY, lang); } catch (e) { /* ignore */ } }
    return lang;
  }

  function stored() {
    try { return root.localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function locale() {
    for (var k = 0; k < LANGS.length; k++) if (LANGS[k].code === lang) return LANGS[k].locale;
    return 'en-GB';
  }

  if (root.localStorage) setLang(stored() || 'en', false);

  PEC.t = t;
  PEC.i18n = {
    LANGS: LANGS, add: add, setLang: setLang, locale: locale, hasWords: hasWords,
    lang: function () { return lang; },
    dict: function (code) { return dicts[code] || {}; },
    // Tests: collect English strings that have no translation in the current language.
    track: function (on) { missing = on ? {} : null; },
    missing: function () { return missing ? Object.keys(missing) : []; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
