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
// A name first reached deep inside a composed string (past the depth cut-off) is not kept in English: the card
// face, the dossier and the windows still read it in Arabic afterwards.
['Lorem', 'Ipsum', 'Dolor', 'Sitam', 'Ametx', 'Consec', 'Adipis', 'Elitus', 'Quarto'].forEach(function (x, n, all) {
  var colons = all.slice(0, n + 1).join(': ') + ': Hans Schmidt', parens = 'Hans Schmidt';
  for (var i = 0; i <= n; i++) parens = '(' + all[i] + ') ' + parens;
  [colons, parens].forEach(function (deep) {
    CF.setLang('ar');
    CF.T(deep);
    assert.ok(!/[A-Za-z]/.test(CF.T('Hans Schmidt')), 'a name met in \'' + deep + '\' still reads in Arabic: ' + CF.T('Hans Schmidt'));
  });
});
// A sign before a number keeps its place in a right-to-left line: the run is wrapped in invisible isolates.
CF.setLang('ar');
var plus = CF.T('Body +1');
assert.ok(plus.indexOf('\u2066+1\u2069') >= 0, 'Body +1 isolates its +1: ' + JSON.stringify(plus));
assert.strictEqual(CF.T(plus), plus, 'a string read twice is wrapped once');
assert.ok(CF.T('3 / 8').indexOf('\u20663 / 8\u2069') === 0, 'a / b is isolated');
assert.ok(CF.T('×3').indexOf('\u2066×3\u2069') === 0, 'a count is isolated');
assert.strictEqual(CF.bidi('1600-1610'), '1600-1610', 'a range is left be');
// The go plate's seconds are Arabic seconds.
var plate = CF.T('{label} · {n}s', { label: 'Search the Scene', n: 30 });
assert.ok(!/[A-Za-z]/.test(plate) && /30 ث/.test(plate), 'the plate reads its seconds in Arabic: ' + plate);
CF.setLang('en');
assert.strictEqual(CF.T('Body +1'), 'Body +1', 'English is left alone');
assert.strictEqual(CF.T('Wit'), 'Wit', 'English is the identity');

// A token's face says what kind of token it is, and looks through a status it gained later (a seal instead).
(function faces() {
  var f = CF.cardFace({ def: 'clue' }, 'Kept: Warning: The Hook');
  assert.strictEqual(f.text, 'Warning', 'a kept warning still reads Warning on its face');
  assert.deepStrictEqual(f.status, ['Kept'], 'and Kept is its seal');
  assert.strictEqual(CF.cardFace({ def: 'clue' }, 'Matched: Deposition: Anna Weber').text, 'Deposition', 'a matched deposition reads Deposition');
  assert.strictEqual(CF.cardFace({ def: 'clue' }, 'Partial: A Bloody Shoe').text, 'A Bloody Shoe', 'a partial reading shows the token it is');
  assert.strictEqual(CF.cardFace({ def: 'clue' }, 'Kept: Sighting: Jakob Hess').text, 'A Sighting', 'the short names apply under a status');
  assert.strictEqual(CF.cardFace({ def: 'suspect' }, 'Prime Suspect: Jakob Hess').text, '★ Jakob Hess', 'a person is their name');
  CF.setLang('ar');
  ['Partial', 'Deposition', 'Kept', 'Alibi', 'Confession', 'Warning', 'Theory', 'Matched', 'Traced', 'Confirmed Identification', 'False Confession', 'Letter', 'Left Behind', 'A Tavern Token', 'Take On', 'Petition For'].forEach(function (head) {
    assert.ok(!/[A-Za-z]/.test(CF.T(head)), 'the face \'' + head + '\' reads in Arabic: ' + CF.T(head));
  });
  CF.setLang('en');
})();

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
    // The face: the few words a card shows on the table, and its status seal's name.
    if (CF.CARDS[c.def].kind !== 'case') { var face = CF.cardFace(c, e.labelOf(c)); read(face.text); face.status.forEach(read); }
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
