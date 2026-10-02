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

// The extractor reads a lowercase literal as a fragment unless it is a whole sentence of three words or more:
// the ask's hints once started 'or drop a card...' and no test saw they had no Arabic.
assert.strictEqual(extract.literalKind('or drop a card on the token. Ignore it and the work still finishes, but it finds less.'), 'key', 'a lowercase sentence is a key');
assert.strictEqual(extract.literalKind('the {who} says'), 'fragment', 'a piece with a placeholder stays a fragment');
assert.strictEqual(extract.literalKind('and then'), 'fragment', 'two words without a stop stay a fragment');
assert.strictEqual(extract.literalKind('Rest'), 'key', 'a capitalised word is a key');
assert.strictEqual(extract.literalKind('cwax-01'), 'skip', 'an art key is not text');
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
// A count takes the noun's Arabic form: one, two, 3-10, 11-99, 100 and up each read their own way, asked with its
// value or met inside a composed line; no count is dodged with 'من ال...'.
assert.strictEqual(CF.T('{n} days', { n: 1 }), 'يوم واحد', 'one day');
assert.strictEqual(CF.T('{n} days', { n: 2 }), 'يومان', 'two days');
assert.strictEqual(CF.T('{n} days', { n: 5 }), '5 أيام', '3-10 days take the plural');
assert.strictEqual(CF.T('{n} days', { n: 12 }), '12 يومًا', '11-99 days take the singular in the accusative');
assert.strictEqual(CF.T('{n} days', { n: 100 }), '100 يوم', '100 days');
assert.strictEqual(CF.T('12 days for the Council'), '12 يومًا للمجلس', 'a composed line picks its form: ' + CF.T('12 days for the Council'));
assert.strictEqual(CF.T('11 cards'), '11 بطاقةً', '11 cards: ' + CF.T('11 cards'));
assert.strictEqual(CF.T('2 convictions'), 'إدانتان', 'two convictions');
assert.ok(/يومًا/.test(CF.T('The Body at the Crane has 14 days left. Charge Hans Weber with what you have, or let it go.')), 'the count is the {d} it names');
var bellDues = CF.T('Coin on the table: 3. Every week the Council pays 1 in stipend and the Bell draws 1 in dues (lodging 1); miss it and you sleep on the Watch-house bench.');
assert.ok(/راتبًا قدره 1/.test(bellDues) && !/راتباً/.test(bellDues), 'the Bell\'s dues line is Arabic: ' + bellDues);
assert.strictEqual(CF.I18N.pick({ one: 'a', other: 'b' }, 7), 'b', 'a form not written falls to the general one');
(function () {
  var forms = 0, dodges = [];
  ['{n} days', '{n} days left', '{n} cards', '{n} Coin', '{n} sworn', '{n} crimes on the record.', 'Costs {n} Coin.'].forEach(function (k) {
    if (typeof d[k] === 'object') forms++;
    [1, 2, 7, 23, 104].forEach(function (n) { var r = CF.T(k, { n: n }); if (/من ال/.test(r) || r.indexOf('{') >= 0) dodges.push(k + ' ' + n + ': ' + r); });
  });
  assert.strictEqual(forms, 7, 'the counts are written in their forms');
  assert.deepStrictEqual(dodges, [], 'no count is dodged');
  // A key in forms is not undone by a plain value for it loaded later.
  CF.addStrings('ar', { '{n} cards': '{n} من البطاقات' });
  assert.strictEqual(CF.T('{n} cards', { n: 2 }), 'بطاقتان', 'the forms keep their place');
})();
// A woman is written as a woman: the line about her takes its '#f' form; a man's stays the plain one.
assert.ok(/فعلتها/.test(CF.T('Margery Tanner has done it again: The Body at the Crane.')), 'she did it again: ' + CF.T('Margery Tanner has done it again: The Body at the Crane.'));
assert.ok(/فعلها/.test(CF.T('Hans Weber has done it again: The Body at the Crane.')), 'he did it again');
assert.ok(/فعلتها/.test(CF.T('{name} has done it again: {title}.', { name: 'Els Vos', title: 'The Body at the Crane' })), 'asked with her name as a value');
var talks = function (who) { return CF.T(who + ' talks for an hour. Most of it is about their late husband. Then, almost as an afterthought: "{hint}"'); };
assert.ok(/^تتحدث .*زوجها الراحل/.test(talks('Grete Bicker')), 'a widow talks of her late husband: ' + talks('Grete Bicker'));
assert.ok(/^يتحدث .*زوجته الراحلة/.test(talks('Gregory Bicker')), 'a widower of his late wife: ' + talks('Gregory Bicker'));
// Her card's words open on her name, and her mark reads in her form; the same mark on a man's card stays his.
var herDesc = CF.T('Grete Welser, a journeyman turned off. Has ink-black fingers; works a printer\'s press.');
assert.ok(/أصابعها .*تعمل/.test(herDesc), 'her mark: ' + herDesc);
assert.ok(/أصابعه .*يعمل/.test(CF.T('Hans Welser, a journeyman turned off. Has ink-black fingers; works a printer\'s press.')), 'his mark');
assert.ok(/أصابعه /.test(CF.T('Has ink-black fingers; works a printer\'s press.')), 'and the mark alone is read plain, not from her line');
assert.strictEqual(CF.T('Witness: Kathrin Barker'), 'الشاهدة: ' + CF.T('Kathrin Barker'), 'her card names her a witness in the feminine');
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

// Round 8, lane 2, items 25-32: the Bell's week spelled out, the keys kept as their caps, the ask box,
// an instrument's kinds of find, the promotion's note and the city's days in Arabic.
(function round8d() {
  CF.setLang('ar');
  assert.ok(/^أسبوع /.test(CF.T('Wk {n}', { n: 3 })), 'the week spelled out: ' + CF.T('Wk {n}', { n: 3 }));
  assert.ok(/\(Esc\)/.test(CF.T('Close (Esc)')) && /\(Space\)/.test(CF.T('Pause (Space)')) && /\(Tab\)/.test(CF.T('Stack like cards together (Tab)')), 'the keys keep their caps');
  ['Or drop a card on the token. Ignore it and the work still finishes, but wearier.', 'Or drop a card on the token. Ignore it and the work still finishes, but it finds less.',
    'Or drop a card on the token. Ignore it and the work finishes as it would have.'].forEach(function (k) {
    assert.ok(!/[A-Za-z]/.test(CF.T(k)), 'the ask box in Arabic: ' + CF.T(k));
  });
  var boost = CF.T('{boosts} on {tags}', { boosts: CF.T('Body') + ' +1', tags: CF.T('Bodies and traces') });
  assert.ok(!/[A-Za-z]/.test(boost), 'an instrument\'s boost in Arabic: ' + boost);
  var lately = CF.T('Lately: {list}', { list: CF.T('{path} +{n} ({why})', { path: 'Power', n: 1, why: 'promoted' }) });
  assert.ok(!/[A-Za-z]/.test(lately), 'the promotion note in Arabic: ' + lately);
  var fade = CF.T('{left} before it is gone. A card\'s clock stops while a verb works on it.', { left: CF.T('{n} days', { n: 4 }) });
  assert.ok(!/[A-Za-z]/.test(fade), 'the days left in Arabic: ' + fade);
  var origin = CF.T('Once {origin}; set out as {calling}', { origin: 'the physician-monk', calling: 'The Scholar' });
  assert.ok(!/[A-Za-z]/.test(origin), 'the origin line in Arabic: ' + origin);
  CF.setLang('en');
  console.log('i18n: the Bell\'s week, the keys, the ask box, the instruments, the promotion and the days in Arabic');
})();

// The lookup reads a long composed text to its end: a colon after a sentence is not a label's, a number in
// front belongs to its sentence, a quoted saying is read inside its quotes, a list item may hold a comma, a
// pattern that leaves a piece in English gives way to one that reads it whole.
(function lookups() {
  CF.setLang('ar');
  function whole(s) { var r = CF.T(s); assert.ok(!/[A-Za-z]{3}/.test(r), 'read whole: ' + s + '\n  => ' + r); return r; }
  whole('Lodging and dues take 6. The Council\'s stipend: 3 Coin. 2 who walked from you are still inside the walls. The Abbey hospital keeps a bed for you. You sleep a night in it. Another girl in the Warrens. The fifth. There is a purse on your desk. Nobody saw who left it. The ledger: no case closed; 4 open; 3 Coin in hand.');
  whole('"A gold ring. Big, on the little finger. It caught the lantern." (Loves the accused.)');
  whole('You find: The Carrier\'s Chit, The Bad Coin, A ledger in weights, not sums.');
  whole('The blackmailer\'s own hand, on the thing they were most careful about. It is Hal Kramer\'s.');
  whole('A parish beadle with a staff and a loud voice. Knocks on doors without complaining and whips beggars without being asked. Slot them into a verb to help. Known: Doors open for them. A canvass turns up one more person.');
  whole('Around the Claesz Print-shop people are frightened, and frightened people talk. You come away with: Witness: Ursel Bicker; Cicely Hobson (accused); Witness: Lienhard Adornes. One door stayed shut, and the street talked less for it.');
  whole('Without the Apothecary\'s Key, you only get part of it. a ghost on the wage-roll. The clerk finds the thread and pulls it: one signature, over and over. You worked into the dark, and it cost you.');
  // Half a translation is caught: the tracker keeps what came back with English words in it.
  CF.I18N.track = true; CF.I18N.partial = {}; CF.I18N.cache = {};
  CF.T('Wit. Zorblax quintessence.');
  CF.T('Pause (Space)');
  CF.I18N.track = false;
  assert.ok(CF.I18N.partial['Wit. Zorblax quintessence.'], 'a half-English answer is recorded');
  assert.ok(!CF.I18N.partial['Pause (Space)'], 'a key\'s cap is not');
  CF.setLang('en');
  console.log('i18n: long composed texts read to their end');
})();

// Round 8, lane 2, item 57: the house terms hold, and the words a player sees all the time read right.
(function houseTerms() {
  var drift = require('../tools/i18n_glossary.js').drift('ar');
  assert.strictEqual(drift.length, 0, drift.length + ' Arabic entries drift from the glossary:\n  ' + drift.slice(0, 20).map(function (x) { return x.term + ' wants ' + x.want + ': ' + x.key; }).join('\n  '));
  CF.setLang('ar');
  assert.strictEqual(CF.T('Answer with Wit'), 'أجب بالفطنة', 'no stretch before the article: ' + CF.T('Answer with Wit'));
  assert.ok(CF.T('Hold {clue} against {name}.', { clue: 'Wit', name: 'Hans Schmidt' }).indexOf('\u0640') < 0, 'a stretched preposition joins the Arabic name that fills it');
  assert.strictEqual(CF.joinPrefix('بـ7'), 'بـ7', 'before a number the stretch stays');
  assert.strictEqual(CF.T('Mark'), 'ضع علامة', 'Mark is not \'teach\'');
  assert.ok(/^البواكير/.test(CF.T('Firsts: {n} of {total}', { n: 2, total: 9 })), 'the firsts are not the ancients');
  assert.strictEqual(CF.T('Give her a Coin'), 'أعطها قطعة نقد', 'a coin, counted');
  CF.setLang('en');
  console.log('i18n: the house terms hold');
})();

// Played games, read in Arabic: nothing the player could see stays English, not even in part. Three plain
// games and four with the opening and the life of the city (needs, choices, the Bell, the rival).
CF.setLang('ar');
CF.I18N.track = true;
CF.I18N.missing = {};
CF.I18N.partial = {};
CF.I18N.cache = {};
function read(s) { if (s) CF.T(s); }
var FACE_KINDS = { clue: 1, evidence: 1, intel: 1, paper: 1 }, faces = [];
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
function readGame(e) {
  Object.keys(e.s.cards).forEach(function (uid) {
    var c = e.s.cards[uid];
    read(e.labelOf(c)); read(e.descOf(c));
    // The face: the few words a card shows on the table, and its status seal's name.
    if (CF.CARDS[c.def].kind !== 'case') { var face = CF.cardFace(c, e.labelOf(c)); read(face.text); face.status.forEach(read); }
    // A token's face on the engine: the head of its label, read through a status, and the status as a seal.
    if (FACE_KINDS[e.def(c).kind]) { var f = e.cardFace(c); faces.push(f.title); if (f.seal) faces.push(f.seal); }
    headsOf(e, c);
    if (c.loc && c.loc.t === 'table') read(e.unavailableReason(c));
  });
  e.s.journal.forEach(function (j) { read(j.title); read(j.text); });
  Object.keys(e.s.cases).forEach(function (id) { var r = e.s.cases[id]; read(r.title); read(r.short); read(r.scene); read(r.victim); });
  CF.VERB_ORDER.forEach(function (vid) { read(e.lockReason(vid)); var v = e.verb(vid); if (v && v.ask) { read(v.ask.label); read(v.ask.text); } });
  if (e.s.choice) { read(e.s.choice.title); read(e.s.choice.text); (e.s.choice.options || []).forEach(function (o) { read(o.label); read(o.text); read(o.gain); }); }
  if (e.s.over) { read(e.s.over.title); read(e.s.over.text); }
}
var games = [];
[0, 1, 2].forEach(function (g) {
  var e = CF.Engine.newGame({ seed: 900 + g, calling: ['master', 'commissioner', 'crusader'][g], who: CF.ORIGIN_ORDER[g] });
  bot.play(e, 60 * 22, ['custom', 'merciful', 'brutal'][g]);
  readGame(e);
  games.push(e);
});
[0, 1, 2, 3].forEach(function (g) {
  var e = CF.Engine.newGame({ seed: 930 + g, calling: ['master', 'commissioner', 'crusader', 'master'][g], who: CF.ORIGIN_ORDER[g % CF.ORIGIN_ORDER.length], life: true, opening: true, guided: true, name: 'Vogel' });
  bot.play(e, 60 * 25, ['custom', 'merciful', 'brutal', 'corrupt'][g]);
  readGame(e);
  games.push(e);
});
// The dossier of every card on those tables, as js/ui.js composes it (UI.dossierLines, no page needed): the
// conviction profile, an instrument's boosts, the Calling's notes, a witness's word all read whole.
(function dossiers() {
  var stub = { addEventListener: function () {}, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, documentElement: {} };
  var saved = { document: globalThis.document, window: globalThis.window, matchMedia: globalThis.matchMedia, addEventListener: globalThis.addEventListener };
  globalThis.window = globalThis; globalThis.document = stub; globalThis.matchMedia = function () { return { matches: false, addEventListener: function () {} }; }; globalThis.addEventListener = function () {};
  CF.Settings = CF.Settings || { get: function () {}, onChange: function () {} };
  CF.Audio = CF.Audio || { play: function () {} };
  require('vm').runInThisContext(fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8'), { filename: 'js/ui.js' });
  var n = 0;
  games.forEach(function (e) {
    CF.UI.e = e;
    // The lines are composed with tracking off (a template asked with its values is not a line anyone reads), and
    // then read as the player reads them.
    e.tableCards().forEach(function (c) {
      if (c.hidden) return;
      CF.I18N.track = false;
      var lines = CF.UI.dossierLines(c);
      CF.I18N.track = true;
      lines.forEach(function (l) { read(l); n++; });
    });
  });
  CF.UI.e = null;
  Object.keys(saved).forEach(function (k) { if (saved[k] === undefined) delete globalThis[k]; else globalThis[k] = saved[k]; });
  assert.ok(n > 200, 'the dossiers of the played tables were read: ' + n);
})();
// What the interface itself says of the city's life: the asks, the choices, the needs.
(CF.ASKS || []).forEach(function (a) { read(a.label); read(a.text); read(a.thanks); read(a.miss); });
(CF.CHOICES || []).forEach(function (c) { read(c.title); read(c.text); (c.options || []).forEach(function (o) { read(o.label); read(o.text); read(o.gain); }); });
Object.keys(CF.NEEDS || {}).forEach(function (k) { read(CF.NEEDS[k].arrive); read(CF.NEEDS[k].loss); });
var miss = Object.keys(CF.I18N.missing).filter(function (s) { return /[A-Za-z]{3}/.test(s); });
var part = Object.keys(CF.I18N.partial);
CF.I18N.track = false;
CF.setLang('en');
assert.strictEqual(miss.length, 0, miss.length + ' strings from a played game stay English:\n  ' + miss.slice(0, 80).join('\n  '));
assert.strictEqual(part.length, 0, part.length + ' strings from a played game are half English:\n  ' + part.slice(0, 40).map(function (s) { return s + '\n    => ' + CF.I18N.partial[s]; }).join('\n  '));
console.log('i18n: bot-played games, with the opening and the city\'s life, read fully in Arabic');
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
console.log('i18n: token faces, composed lines and the Bell\'s week read in Arabic too');
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
