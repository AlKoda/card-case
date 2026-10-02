// Languages: every English string the game can show has an entry in each
// language file, the lookup handles templates, and a bot-played game in
// Arabic leaves no card, journal entry or case untranslated.
// Run: node tests/i18n.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var bot = require('./bot.test.js');
var extract = require('../tools/i18n_extract.js');
var CF = globalThis.CF;
var root = path.join(__dirname, '..');

Object.keys(CF.LANGS).forEach(function (lang) {
  if (lang === 'en') return;
  var r = extract.missing(lang);
  var list = [];
  Object.keys(r.missing).forEach(function (f) { r.missing[f].forEach(function (k) { list.push(f + ': ' + k); }); });
  assert.strictEqual(r.count, 0, lang + ': ' + r.count + ' of ' + r.total + ' strings have no entry:\n  ' + list.slice(0, 60).join('\n  '));
  console.log('i18n: ' + lang + ' covers all ' + r.total + ' extracted strings');
  var dir = path.join(root, 'js/lang', lang);
  fs.readdirSync(dir).forEach(function (f) {
    var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert.ok(html.indexOf('js/lang/' + lang + '/' + f) >= 0, 'index.html loads js/lang/' + lang + '/' + f);
    assert.ok(sw.indexOf('js/lang/' + lang + '/' + f) >= 0, 'sw.js caches js/lang/' + lang + '/' + f);
  });
});

// The lookup: exact, template, trailing stop, sentence run, list, name.
CF.setLang('ar');
var d = CF.I18N.dicts.ar;
assert.ok(d['Wit'] && d['Wit'] !== 'Wit', 'Wit is translated');
assert.notStrictEqual(CF.T('Wit.'), 'Wit.', 'a trailing stop is kept');
assert.notStrictEqual(CF.T('Wit, Instinct'), 'Wit, Instinct', 'a list is split');
assert.notStrictEqual(CF.T('Hans Schmidt'), 'Hans Schmidt', 'a name is transliterated word by word');
assert.strictEqual(CF.T('1:23'), '1:23', 'a time stays');
assert.notStrictEqual(CF.T('Body 1, Word 2'), 'Body 1, Word 2', 'an aspect with its count: the Court\'s gaps');
assert.ok(!/[A-Za-z]/.test(CF.T('Body 1, Word 2')), 'and nothing of it stays English: ' + CF.T('Body 1, Word 2'));
assert.ok(!/[A-Za-z]/.test(CF.T('Wit and Instinct')) && /\sو\S/.test(CF.T('Health and Wit and Instinct')), '\'and\' joins a list');
assert.strictEqual(CF.T('Week {n}', { n: 4 }).indexOf('{'), -1, 'placeholders are filled');
CF.setLang('en');
assert.strictEqual(CF.T('Wit'), 'Wit', 'English is the identity');

// A played game, read in Arabic: nothing the player could see stays English.
CF.setLang('ar');
CF.I18N.track = true;
CF.I18N.missing = {};
function read(s) { if (s) CF.T(s); }
[0, 1, 2].forEach(function (g) {
  var e = CF.Engine.newGame({ seed: 900 + g, calling: ['master', 'commissioner', 'crusader'][g], who: CF.ORIGIN_ORDER[g] });
  bot.play(e, 60 * 22, ['custom', 'merciful', 'brutal'][g]);
  Object.keys(e.s.cards).forEach(function (uid) {
    var c = e.s.cards[uid];
    read(e.labelOf(c)); read(e.descOf(c));
    if (c.loc && c.loc.t === 'table') read(e.unavailableReason(c));
  });
  e.s.journal.forEach(function (j) { read(j.title); read(j.text); });
  Object.keys(e.s.cases).forEach(function (id) { var r = e.s.cases[id]; read(r.title); read(r.short); read(r.scene); read(r.victim); });
  CF.VERB_ORDER.forEach(function (vid) { read(e.lockReason(vid)); });
  if (e.s.over) { read(e.s.over.title); read(e.s.over.text); }
});
var miss = Object.keys(CF.I18N.missing).filter(function (s) { return /[A-Za-z]{3}/.test(s); });
CF.I18N.track = false;
CF.setLang('en');
assert.strictEqual(miss.length, 0, miss.length + ' strings from a played game stay English:\n  ' + miss.slice(0, 80).join('\n  '));
console.log('i18n: a bot-played game reads fully in Arabic');
