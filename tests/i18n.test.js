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

// A lowercase sentence the player reads is a key, not a piece: the coverage sees it.
assert.ok(!extract.fragment('or drop a card on the token. Ignore it and the work still finishes, but it finds less.'), 'a lowercase sentence is a key');
assert.ok(extract.fragment('the lane behind the Red Ox'), 'a lowercase phrase is a piece');
assert.ok(extract.fragment('and {n} more'), 'a short lowercase piece stays a piece');
assert.ok(!extract.fragment('Ask the Watch.'), 'a capitalised sentence is a key');

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
// The face of a token shows the head of its label, the part before ': ', and looks through a
// status (Kept, Matched, Partial, Corroborated) to the token under it: every head is collected.
var heads = {};
function headsOf(e, c) {
  var kind = CF.CARDS[c.def] && CF.CARDS[c.def].kind;
  if (kind !== 'clue' && kind !== 'evidence' && kind !== 'paper') return;
  var parts = e.labelOf(c).split(': ');
  if (parts.length < 2) return;
  heads[parts[0]] = 1;
  if (/^(Kept|Matched|Partial|Corroborated)$/.test(parts[0]) && parts.length > 2) heads[parts[1]] = 1;
}
[0, 1, 2].forEach(function (g) {
  var e = CF.Engine.newGame({ seed: 900 + g, calling: ['master', 'commissioner', 'crusader'][g], who: CF.ORIGIN_ORDER[g] });
  var temper = ['custom', 'merciful', 'brutal'][g];
  for (var t = 0; t < 60 * 22 && !e.s.over; t++) {
    bot.step(e, temper); e.tick(1);
    if (t % 5 === 0) Object.keys(e.s.cards).forEach(function (uid) { headsOf(e, e.s.cards[uid]); });
  }
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
CF.setLang('ar');
var bare = Object.keys(heads).filter(function (h) { return /[A-Za-z]{3}/.test(CF.T(h)); });
CF.setLang('en');
assert.ok(Object.keys(heads).length >= 4, 'token heads were seen: ' + Object.keys(heads).join(', '));
assert.strictEqual(bare.length, 0, 'token faces stay English in Arabic: ' + bare.join(', '));
console.log('i18n: every token face (' + Object.keys(heads).length + ' heads) reads in Arabic');

// Every ending, in each of its tellings, reads in Arabic with the run's words and names filled
// in: counts told in words ('Seven', 'four'), the King of Thunes and the Architect by name.
(function endingsInArabic() {
  CF.setLang('ar');
  var vars = { sentHome: 'Seven', reformed: 'four', king: 'Hans Schmidt', architect: 'Hans Schmidt', architectRole: 'the great benefactor' };
  var bad = [];
  Object.keys(CF.ENDING_VARIANTS).forEach(function (id) {
    CF.ENDING_VARIANTS[id].forEach(function (v) {
      [v.text, v.named].forEach(function (t) {
        if (!t) return;
        var ar = CF.T(CF.util.fill(t, vars));
        if (/[A-Za-z]{3}/.test(ar)) bad.push(id + ': ' + ar);
      });
    });
  });
  ['one', 'Two', 'Twelve'].forEach(function (w) { if (/[A-Za-z]/.test(CF.T(w))) bad.push(w); });
  var fever = CF.T(CF.util.fill(CF.INTRO_FEVER, { card: 'Fever' }));
  if (/[A-Za-z]/.test(fever)) bad.push(fever);
  CF.setLang('en');
  assert.strictEqual(bad.length, 0, 'endings that stay English in Arabic:\n  ' + bad.join('\n  '));
  console.log('i18n: every ending reads in Arabic, names and counts filled');
})();

// The house terms (docs/GLOSSARY.md, 'Checked in every entry'): an entry whose English names the
// term carries its Arabic, so 'Examiner' is never the coroner and 'Dominican' has one spelling.
(function glossary() {
  var md = fs.readFileSync(path.join(root, 'docs/GLOSSARY.md'), 'utf8');
  var sec = md.split(/^## /m).filter(function (s) { return /^Checked in every entry/.test(s); })[0];
  assert.ok(sec, 'docs/GLOSSARY.md has its checked terms');
  var terms = sec.split('\n').map(function (l) { return /^- (.+?) → (\S.*)$/.exec(l.trim()); }).filter(Boolean);
  assert.ok(terms.length >= 10, 'the checked terms are read: ' + terms.length);
  var d = CF.I18N.dicts.ar, bad = [];
  terms.forEach(function (m) {
    var re = new RegExp('\\b' + m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
    // A plural entry carries the term in every form.
    Object.keys(d).forEach(function (k) {
      var forms = typeof d[k] === 'string' ? [d[k]] : Object.keys(d[k]).filter(function (f) { return f !== 'by'; }).map(function (f) { return d[k][f]; });
      forms.forEach(function (v) { if (re.test(k) && v.indexOf(m[2]) < 0) bad.push(m[1] + ' (' + m[2] + '): ' + k.slice(0, 80) + ' => ' + v.slice(0, 80)); });
    });
  });
  assert.strictEqual(bad.length, 0, 'entries that drift from the glossary:\n  ' + bad.join('\n  '));
  console.log('i18n: ' + terms.length + ' house terms hold in every entry');
})();

// A deposition with its stake reads whole, in guillemets; the will's and the wage-roll's verdicts
// read after a partial result; the harbour's case named for its scene; a second informer's nickname.
(function composedLeftovers() {
  CF.setLang('ar');
  var dep = CF.T('"They were rolling a die over their knuckles." (Wants the reward.)');
  assert.ok(dep.indexOf('«' + CF.T('They were rolling a die over their knuckles.') + '»') === 0 && dep.indexOf(CF.T('Wants the reward')) > 0 && !/[A-Za-z]/.test(dep), 'a deposition and its stake: ' + dep);
  Object.keys(CF.STAKES).forEach(function (k) {
    var t = CF.T('"They were rolling a die over their knuckles." (' + CF.STAKES[k].label + '.)');
    assert.ok(!/[A-Za-z]/.test(t), 'every stake: ' + t);
  });
  var will = CF.T('Without the apothecary\'s key, you only get part of it. A signature that leans the wrong way. The clerk is certain: it was not signed by the person it says it was.');
  assert.ok(!/[A-Za-z]{3}/.test(will), 'a partial will reads whole: ' + will);
  var roll = CF.T('Without the apothecary\'s key, you only get part of it. A ghost on the wage-roll. The clerk finds the thread and pulls it: one signature, over and over.');
  assert.ok(!/[A-Za-z]{3}/.test(roll), 'a partial wage-roll reads whole: ' + roll);
  ['The Body at Berth 4', 'The Body at the Harbour Steps', 'Informer: Moth the Younger', 'Now press A Day\'s Labour.'].forEach(function (s) {
    assert.ok(!/[A-Za-z]{3}/.test(CF.T(s)), s + ' => ' + CF.T(s));
  });
  assert.ok(!/[A-Za-z]{3}/.test(CF.T(CF.INTRO_ASIDE_QUESTION)), 'the question\'s warning reads in Arabic');
  CF.setLang('en');
  console.log('i18n: depositions, partial verdicts and new names read whole');
})();

// The ending's epilogue, the Council's count and an instrument's boost read whole in Arabic,
// both as their own key filled and as the English line the engine wrote.
(function epilogueAndCount() {
  CF.setLang('ar');
  var E = CF.EPILOGUE, vars = { scene: 'the Stews', king: 'Hans Schmidt', n: 'Three', name: 'Hans Schmidt', where: 'the Warrens', k: 'three' };
  var keys = [E.title, E.pattern.never, E.king.sits, E.king.treaty, E.king.hangs, E.king.fallen, E.king.kneels, E.rival.one, E.rival.two, E.rival.many, E.rival.sealed,
    E.abroad.once, E.abroad.twice, E.abroad.many, E.watch.text].concat(E.pattern.doors);
  var El = CF.ELECTION;
  keys = keys.concat([El.title, El.holds, El.loses]);
  Object.keys(El.told).forEach(function (h) { keys.push(El.told[h].holds, El.told[h].loses); });
  keys.forEach(function (k) {
    var a = CF.T(k, vars), b = CF.T(CF.util.fill(k, vars));
    assert.ok(!/[A-Za-z]{3}/.test(a) && !/[A-Za-z]{3}/.test(b), k + ' => ' + a + ' / ' + b);
  });
  [{ tags: ['biology', 'physical'], aspects: { forensic: 1 } }, { tags: ['watching'], aspects: { opportunity: 1, digital: 1 } }, { tags: ['records'], aspects: { digital: 1 } }, { tags: ['surfaces'], aspects: { forensic: 1 } }].forEach(function (b) {
    var line = CF.T(CF.Story.boostLine(b));
    assert.ok(!/[A-Za-z]/.test(line), 'a boost reads whole: ' + line);
  });
  assert.strictEqual(CF.T(', '), '، ', 'the list comma');
  CF.setLang('en');
  console.log('i18n: the epilogue, the count and the boosts read whole');
})();

// Counts in Arabic agree with their number: a plural entry is an object of forms, picked by the
// count the string carries (1 and 2 their own words, 3-10 the plural, 11-99 the singular in the
// accusative, 100 and 0 the singular), both from a filled English string and from a key and vars.
(function plurals() {
  CF.setLang('ar');
  assert.strictEqual(CF.pluralForm(0), 'zero');
  assert.strictEqual(CF.pluralForm(1), 'one');
  assert.strictEqual(CF.pluralForm(2), 'two');
  assert.strictEqual(CF.pluralForm(7), 'few');
  assert.strictEqual(CF.pluralForm(103), 'few');
  assert.strictEqual(CF.pluralForm(12), 'many');
  assert.strictEqual(CF.pluralForm(100), 'other');
  assert.strictEqual(CF.T('12 days for the Council'), '12 يومًا للمجلس');
  assert.strictEqual(CF.T('3 days for the Council'), '3 أيام للمجلس');
  assert.strictEqual(CF.T('2 days for the Council'), 'يومان للمجلس');
  assert.strictEqual(CF.T('11 cards'), '11 بطاقةً');
  assert.strictEqual(CF.T('{n} days', { n: 63 }), '63 يومًا');
  assert.strictEqual(CF.T('{n} days', { n: 4 }), '4 أيام');
  assert.strictEqual(CF.T('{n} Coin', { n: 1 }), 'قطعة نقد واحدة');
  // The count may sit in a placeholder other than {n} ('by'), and the entry still reads whole.
  var eel = CF.T('The Eel has 14 days left. Charge Hans Schmidt with what you have, or let it go.');
  assert.ok(eel.indexOf('14 يومًا') >= 0 && !/ أيام|undefined|object/.test(eel), eel);
  // A stop-less twin keeps its forms.
  assert.strictEqual(CF.T('Costs 2 Coin'), 'تكلّف قطعتي نقد');
  // Every plural entry has the forms it needs, and fills the same placeholders in each.
  var d = CF.I18N.dicts.ar, bad = [];
  Object.keys(d).forEach(function (k) {
    var v = d[k];
    if (typeof v === 'string') return;
    var ph = (k.match(/\{\w+\}/g) || []).sort().join();
    ['one', 'two', 'few', 'many', 'other'].forEach(function (f) { if (typeof v[f] !== 'string') bad.push(k + ': no ' + f); });
    Object.keys(v).forEach(function (f) {
      if (f === 'by') { if (k.indexOf('{' + v.by + '}') < 0) bad.push(k + ': counts by a missing {' + v.by + '}'); return; }
      if (!/^(zero|one|two|few|many|other)$/.test(f)) bad.push(k + ': unknown form ' + f);
      var got = (v[f].match(/\{\w+\}/g) || []).filter(function (p, i, a) { return a.indexOf(p) === i; });
      got.forEach(function (p) { if (k.indexOf(p) < 0) bad.push(k + ' (' + f + '): ' + p + ' is not in the key'); });
    });
    if (!ph) bad.push(k + ': a plural entry with no count');
  });
  assert.strictEqual(bad.length, 0, 'plural entries:\n  ' + bad.join('\n  '));
  assert.ok(Object.keys(d).filter(function (k) { return typeof d[k] !== 'string'; }).length >= 40, 'the count keys are plural entries');
  CF.setLang('en');
  console.log('i18n: counts agree with their number in Arabic');
})();

// A woman reads as a woman: a person template whose first person is a woman ('Margery Tanner',
// a name from CF.NAMES.f) reads its 'key#f' wording, a man the base; every '#f' has its base.
(function women() {
  CF.setLang('ar');
  var d = CF.I18N.dicts.ar;
  var fs2 = Object.keys(d).filter(function (k) { return /#f$/.test(k); });
  assert.ok(fs2.length >= 30, 'women\'s wordings: ' + fs2.length);
  fs2.forEach(function (k) { assert.ok(d[k.slice(0, -2)] !== undefined, 'a woman\'s wording without its key: ' + k); });
  assert.ok(CF.I18N.woman('Margery Tanner') && CF.I18N.woman('the laundress') && !CF.I18N.woman('Hans Tanner') && !CF.I18N.woman('the Tiler'), 'who is a woman');
  assert.strictEqual(CF.T('Margery Tanner has done it again: The Brass Hands.').indexOf('فعلتها'), CF.T('Margery Tanner').length + 1);
  assert.ok(CF.T('Hans Tanner has done it again: The Brass Hands.').indexOf('فعلها') > 0, 'a man keeps the base');
  var w = CF.T('Margery Bicker talks for an hour. Most of it is about their late husband. Then, almost as an afterthought: "Ask the Watch."');
  assert.ok(w.indexOf('تتحدث') === 0 && w.indexOf('زوجها') > 0, 'the widow talks of her husband: ' + w);
  var m = CF.T('Gregory Bicker talks for an hour. Most of it is about their late husband. Then, almost as an afterthought: "Ask the Watch."');
  assert.ok(m.indexOf('يتحدث') === 0 && m.indexOf('زوجته') > 0, 'the widower of his wife: ' + m);
  assert.strictEqual(CF.T('Guilty: {name}', { name: 'Margery Tanner' }), CF.T('Guilty: Margery Tanner'), 'a key with vars reads the woman\'s wording too');
  CF.setLang('en');
  console.log('i18n: ' + fs2.length + ' person templates read as a woman for a woman');
})();
