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
var FACE_KINDS = { clue: 1, evidence: 1, intel: 1, paper: 1 }, faces = [];
[0, 1, 2].forEach(function (g) {
  var e = CF.Engine.newGame({ seed: 900 + g, calling: ['master', 'commissioner', 'crusader'][g], who: CF.ORIGIN_ORDER[g] });
  bot.play(e, 60 * 22, ['custom', 'merciful', 'brutal'][g]);
  Object.keys(e.s.cards).forEach(function (uid) {
    var c = e.s.cards[uid];
    read(e.labelOf(c)); read(e.descOf(c));
    // A token's face: the head of its label, read through a status, and the status as a seal.
    if (FACE_KINDS[e.def(c).kind]) { var f = e.cardFace(c); faces.push(f.title); if (f.seal) faces.push(f.seal); }
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
CF.setLang('ar');
var englishFaces = faces.filter(function (t, i) { return faces.indexOf(t) === i && /[A-Za-z]{3}/.test(CF.T(t)); });
CF.setLang('en');
assert.ok(faces.length > 20, 'token faces were read: ' + faces.length);
assert.strictEqual(englishFaces.length, 0, 'token faces that stay English: ' + englishFaces.join(', '));
// A status is read through: a kept Warning shows the Warning, with a seal.
var fg = CF.Engine.newGame({ seed: 5, calling: 'master' });
var kept = fg.create('clue', { label: 'Kept: Warning: Theft', data: {} });
assert.deepStrictEqual(fg.cardFace(kept), { title: 'Warning', seal: 'Kept' });
assert.deepStrictEqual(fg.cardFace(fg.create('clue', { label: 'Partial: The Blade Read', data: {} })), { title: 'The Blade Read', seal: 'Partial' });
assert.deepStrictEqual(fg.cardFace(fg.create('clue', { label: 'Deposition: Hans Schmidt', data: {} })), { title: 'Deposition', seal: null });
// Lane 1, items 33-40: the composed lines read in Arabic.
(function composed() {
  var texts = [];
  var g = CF.Engine.newGame({ seed: 9, calling: 'master' });
  var rec = g.openCases()[0], cul = rec.suspects.filter(function (x) { return x.guilty; })[0];
  CF.PROSE.alibis.forEach(function (al, i) {
    var c = g.criminalEscapes(rec, { name: cul.name, trait: cul.trait }, 'wrongful');
    g.hideCriminal(c, rec, ['rope', 'burned', 'rival'][i % 3], al);
    g.surfaceCriminal(c, false);
    texts.push(g.s.journal[0].text);
  });
  var g2 = CF.Engine.newGame({ seed: 10, calling: 'master' });
  g2.create('rival', { label: 'The Rival: ' + CF.RIVAL_NAMES[0], data: { name: CF.RIVAL_NAMES[0], heat: 0, stalled: 0 } });
  for (var i = 0; i < 6; i++) {
    var gg = CF.Engine.load(g2.save()); gg.rng.setState(i * 11 + 2);
    gg.rivalCloses(gg.openCases()[0]);
    texts.push(gg.s.journal[0].text);
  }
  ['arson', 'poison', 'harbor'].forEach(function (tid) {
    var ladder = CF.Sentence.ladderOf(tid);
    texts.push(CF.Sentence.rungLabel(tid, 'wheel') + '. ' + CF.Sentence.rungDesc(tid, 'wheel') + ' (' + CF.RUNGS.wheel.cost + ')');
    var h = CF.Engine.newGame({ seed: 11, calling: 'master' }), r = h.openCases()[0];
    var cond = h.create('condemned', { label: cul.name, caseId: r.id, data: { name: cul.name, caseId: r.id, guilty: true, custom: ladder.custom, template: tid, crimes: 1 } });
    texts.push(h.passSentence(cond, 'wheel', null, { quiet: true }).text);
  });
  CF.Sentence.REFORMED_PLACES.forEach(function (pl) {
    texts.push(cul.name + ' walks out of the Hole into the Market and does not look back. A year from now they keep ' + pl + ', and a family, and they cross the street when they see you.');
  });
  texts.push(CF.RUNGS.fine.desc, CF.RUNGS.pillory.desc, CF.Charge.tierTitle('weak'), CF.Charge.tierTitle('reasonable'), CF.Charge.tierTitle('strong'));
  Object.keys(CF.CALLINGS).forEach(function (k) { texts.push(CF.CALLINGS[k].win); });
  CF.setLang('ar');
  var bad = texts.filter(function (t) { var a = CF.T(t); return /[A-Za-z]{3}/.test(a) || a.indexOf('{') >= 0; }).map(function (t) { return t + '  =>  ' + CF.T(t); });
  CF.setLang('en');
  assert.strictEqual(bad.length, 0, 'composed lines left English:\n  ' + bad.join('\n  '));
  console.log('i18n: the Fire, the Water, the true alibi and the Rival\'s close read in Arabic');
})();
// Lane 1, items 49-56: the Bell's week is kept in parts, and every part reads in Arabic on its own.
(function weekParts() {
  var bad = [], n = 0;
  [0, 1].forEach(function (g) {
    var e = CF.Engine.newGame({ seed: 960 + g, calling: ['crusader', 'commissioner'][g], who: CF.ORIGIN_ORDER[g + 2], life: true });
    bot.play(e, 60 * 16, ['corrupt', 'custom'][g]);
    CF.setLang('ar');
    e.s.journal.forEach(function (j) {
      if (!j.parts) return;
      assert.strictEqual(j.text, j.parts.join(' '), 'the text is its parts joined');
      j.parts.forEach(function (p) { n++; var a = CF.T(p); if (/[A-Za-z]{3}/.test(a) || a.indexOf('{') >= 0) bad.push(p + '  =>  ' + a); });
    });
    CF.setLang('en');
  });
  assert.ok(n > 20, 'week parts were read: ' + n);
  assert.strictEqual(bad.length, 0, 'week parts left English:\n  ' + bad.slice(0, 30).join('\n  '));
  console.log('i18n: the Bell\'s week reads in Arabic part by part (' + n + ' parts)');
})();
console.log('i18n: a bot-played game reads fully in Arabic, token faces too');
