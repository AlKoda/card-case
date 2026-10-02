// The guided start and the narrative content: a new detective meets the
// table one thing at a time, openings vary, endings say what happened.
// Run: node tests/intro.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

['js/util.js', 'js/i18n.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/data/structures.js', 'js/data/story.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/systems/informants.js', 'js/systems/criminals.js', 'js/systems/sentence.js', 'js/systems/purse.js', 'js/systems/origins.js', 'js/systems/coquille.js', 'js/systems/patrons.js', 'js/systems/societies.js', 'js/systems/network.js', 'js/systems/callings.js', 'js/systems/intro.js', 'js/systems/life.js', 'js/systems/growth.js', 'js/core/recipes.js', 'js/data/recipes.js'].forEach(function (f) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), { filename: f });
});
var CF = globalThis.CF;
console.error = function (err) { throw err; };
function byDef(e, d) { return e.tableCards().filter(function (c) { return c.def === d; }); }
function unlocked(e) { return CF.VERB_ORDER.filter(function (v) { return e.verb(v).unlocked; }); }
function run(e, verb, cards) {
  cards.forEach(function (c) { assert.ok(e.autoSlot(verb, c.uid), verb + ' refused ' + e.labelOf(c)); });
  assert.ok(e.start(verb), verb + ' did not start: ' + JSON.stringify(e.preview(verb)));
  e.tick(e.verb(verb).duration + 0.01);
  var v = e.verb(verb), out = v.out.map(function (u) { return e.card(u); });
  if (v.status === 'done') e.collect(verb);
  return out;
}

// ---- Story content ------------------------------------------------------------------
Object.keys(CF.CALLINGS).forEach(function (c) { assert.ok(CF.OPENINGS[c] && CF.OPENINGS[c].length >= 3, c + ' has three openings'); });
Object.keys(CF.ENDINGS).forEach(function (id) { assert.ok(CF.ENDING_VARIANTS[id] && CF.ENDING_VARIANTS[id].length >= 1, id + ' has ending text'); });
['dismissed', 'commissioner', 'master', 'crusader', 'corruption'].forEach(function (id) { assert.ok(CF.ENDING_VARIANTS[id].length >= 2, id + ' varies'); });
// Two seeds, same calling, different opening.
var titles = {};
for (var i = 0; i < 6; i++) { var g = CF.Engine.newGame({ seed: i, calling: 'master' }); titles[g.s.journal[0].text.slice(0, 40)] = true; }
assert.ok(Object.keys(titles).length >= 2, 'openings vary by seed');
// The ending reads the run: a wrongful conviction changes the dismissal.
var w = CF.Engine.newGame({ seed: 3, calling: 'master' }); w.s.stats.wrongful = 1; w.gameOver('dismissed');
assert.ok(/wrong name/.test(w.s.over.text));
var d = CF.Engine.newGame({ seed: 3, calling: 'master' }); d.s.stats.cold = 7; d.gameOver('dismissed');
assert.ok(/Rolls|Watch-house/.test(d.s.over.text));
var x = CF.Engine.newGame({ seed: 5, calling: 'master' }); x.s.calling = 'commissioner'; x.gameOver('commissioner');
assert.ok(/did not set out/.test(x.s.over.text), 'a drifted ending says so');
console.log('story: ok');

// ---- The guided start ---------------------------------------------------------------
var e = CF.Engine.newGame({ seed: 11, calling: 'commissioner', guided: true });
assert.deepStrictEqual(unlocked(e).sort(), ['investigate', 'time']);
assert.strictEqual(byDef(e, 'health').length, 0, 'Health waits');
assert.strictEqual(byDef(e, 'funds').length, 0, 'money waits');
assert.strictEqual(byDef(e, 'teammate').length, 0, 'the Commissioner\'s officer waits');
assert.ok(byDef(e, 'focus').length === 1 && byDef(e, 'case').length === 1);
assert.ok(e.introHint() && /Explore/.test(e.introHint()));
assert.ok(e.s.intro.stash.length >= 8, 'the rest is stashed: ' + e.s.intro.stash.length);
var plain = CF.Engine.newGame({ seed: 11, calling: 'commissioner' });
assert.ok(unlocked(plain).length >= 6 && byDef(plain, 'funds').length >= 3, 'an unguided game starts whole');

var kase = byDef(e, 'case')[0];
run(e, 'investigate', [kase]);
assert.ok(e.s.intro.step >= 1, 'the scene search advances the intro');
assert.ok(e.verb('analyze').unlocked && byDef(e, 'instinct').length === 1);
assert.ok(e.s.journal.some(function (j) { return j.title === 'What the Scene Gives'; }));
// A suspect from the scene: people. One step per tick.
assert.ok(byDef(e, 'suspect').length >= 1);
e.tick(0.1);
assert.strictEqual(e.s.intro.step, 2);
assert.ok(e.verb('interrogate').unlocked && byDef(e, 'health').length === 1);
// Two clues: the wall. Then arrest.
while (byDef(e, 'clue').length < 2) e.create('clue', { label: 'x', caseId: kase.caseId, aspects: { forensic: 1 } });
e.tick(0.1); assert.strictEqual(e.s.intro.step, 3); assert.ok(e.verb('reflect').unlocked);
e.tick(0.1); assert.strictEqual(e.s.intro.step, 4); assert.ok(e.verb('arrest').unlocked);
assert.ok(!e.verb('duty').unlocked && byDef(e, 'funds').length === 0, 'the desk has not arrived yet');
// The week turns before an arrest: the desk arrives anyway, before rent is due.
e.tick(CF.WEEK - e.s.weekT + 0.01);
assert.ok(e.s.intro.finished);
assert.ok(e.verb('duty').unlocked && e.verb('investigate').unlocked && e.verb('duty').unlocked);
assert.ok(byDef(e, 'funds').length >= 3, 'money arrived: ' + byDef(e, 'funds').length);
assert.ok(byDef(e, 'teammate').length === 1, 'the rookie is on the desk');
// The Market and the Petitions come with the first answered cases, not the tutorial.
assert.strictEqual(byDef(e, 'district').length, e.s.stats.convictions >= 1 ? 1 : 0, 'the Market only after a conviction');
e.s.stats.convictions = 1; e.openTheCity();
assert.strictEqual(byDef(e, 'district').length, 1, 'the Market after the first conviction');
e.s.stats.convictions = 2; e.openTheCity();
assert.ok(byDef(e, 'order').length >= 1, 'the Petitions after the second');
assert.strictEqual(e.countOf('fatigue'), 0, 'rent was paid from the revealed money');
assert.strictEqual(e.s.intro.stash.length, 0);
assert.ok(!e.introHint());
assert.ok(e.s.journal.some(function (j) { return j.title === 'The Desk'; }));
// An arrest finishes the intro too.
var f = CF.Engine.newGame({ seed: 12, calling: 'crusader', guided: true });
var fk = byDef(f, 'case')[0], fr = f.caseRec(fk.caseId);
run(f, 'investigate', [fk]); f.tick(0.1);
var sc = byDef(f, 'suspect')[0] || f.revealSuspect(fr, null);
f.tick(0.1); f.create('clue', { label: 'y', caseId: fr.id, aspects: { forensic: 2 } }); f.create('clue', { label: 'z', caseId: fr.id, aspects: { opportunity: 2 } });
f.tick(0.1); f.tick(0.1);
assert.ok(f.verb('arrest').unlocked);
f.s.weekT = 0; // the charge takes half a week now; the bell must not end the lesson
run(f, 'arrest', [sc, byDef(f, 'clue')[0]]);
f.tick(0.1);
assert.ok(f.verb('duty').unlocked && /Attend/.test(f.introHint() || ''), 'the trial opens Attend: ' + f.introHint());
assert.ok(!f.s.intro.finished, 'the tutorial runs through the Court');
var ft = byDef(f, 'trial')[0];
f.tick(ft.life + 1);
var cond = byDef(f, 'condemned')[0];
if (cond) { assert.ok(/Condemned/.test(f.introHint() || ''), 'the ladder is explained'); f.tick(cond.life + 1); }
f.tick(0.1);
assert.ok(f.s.intro.finished && byDef(f, 'informant').length === 1, 'the Crusader\'s informant arrives with the desk');
// Saves keep the intro state; tidy keeps stacks together.
var s2 = CF.Engine.load(e.save());
assert.ok(s2.s.intro.finished);
s2.tidy();
var funds = byDef(s2, 'funds');
assert.ok(funds.every(function (c) { return c.loc.x === funds[0].loc.x && c.loc.y === funds[0].loc.y; }), 'tidy keeps the stack');
console.log('intro: ok');

// ---- The opening: the hint follows the table, nobody is stranded, the hire comes one beat at a time ----
(function opening() {
  function tbl(g, d) { return g.tableCards().filter(function (c) { return c.def === d; }); }
  var e = CF.Engine.newGame({ seed: 21, who: 'clerk', name: 'Beats', opening: true, guided: true });
  assert.ok(/Health onto Attend/.test(e.introHint()), 'work for bread: ' + e.introHint());
  assert.ok(/so does Wit, more slowly/.test(e.s.journal[0].text), 'the start says Wit earns too');
  // Health at work, Wit on the table: the hint turns to Wit.
  var hp = tbl(e, 'health')[0];
  assert.ok(e.autoSlot('duty', hp.uid) && e.start('duty'));
  e.tick(0.1);
  assert.ok(/^Winded\. Health comes back/.test(e.introHint()), 'Wit meanwhile: ' + e.introHint());
  e.tick(e.verb('duty').duration); e.collect('duty'); e.tick(0.1);
  assert.strictEqual(tbl(e, 'spent_health').length, 1);
  assert.ok(/^Winded\./.test(e.introHint()));
  // Wit at the day-book too: both spent.
  assert.ok(e.autoSlot('duty', tbl(e, 'focus')[0].uid) && e.start('duty'), 'Wit keeps the day-book');
  e.tick(0.1);
  assert.ok(/^Both spent\./.test(e.introHint()), 'both spent: ' + e.introHint());
  e.tick(e.verb('duty').duration); e.collect('duty'); e.tick(0.1);
  // Two days' work: the notice, and Explore runs by itself.
  assert.strictEqual(e.s.flags.stage, 'search');
  assert.strictEqual(e.verb('investigate').status, 'running');
  assert.ok(/Explore/.test(e.introHint()));
  e.tick(e.verb('investigate').duration + 0.01); e.tick(0.1);
  assert.strictEqual(e.verb('investigate').status, 'done');
  // Explore done but never opened: the Watch does not come, and the hint says what to do.
  e.tick(30);
  assert.strictEqual(e.s.flags.stage, 'search', 'the stage waits for the finds to be taken');
  assert.ok(/^Explore is done\. Open it/.test(e.introHint()) && /Take all/.test(e.introHint()), 'the hint names Explore: ' + e.introHint());
  e.collect('investigate'); e.tick(0.1);
  assert.strictEqual(e.s.flags.stage, 'questioned', 'taken: the Watch has a body');
  assert.ok(/^The Death of /.test(e.openCases()[0].title));
  // The sergeant: the hire. From here, one beat at a time.
  assert.strictEqual(e.verb('interrogate').status, 'running');
  e.tick(e.verb('interrogate').duration + 0.01); e.collect('interrogate'); e.tick(0.1);
  assert.strictEqual(e.s.flags.stage, 'hired');
  assert.ok(e.s.choice && e.s.choice.id === 'calling', 'the calling is asked once Explore is idle');
  assert.ok(e.choose(1));
  var hireT = e.s.intro.lastBeatT, journalAt = e.s.journal.length; // the hire itself: the calling is put a tick after its answer is taken
  assert.strictEqual(e.s.intro.step, 3, 'the lessons the opening gave are skipped: ' + e.s.intro.step);
  assert.ok(!e.s.journal.some(function (j) { return j.title === 'What the Scene Gives' || j.title === 'People' || j.title === 'The Casebook'; }), 'no lesson told twice');
  // The table is ripe for the Charge; the beat still waits eight seconds and a verb.
  var rec = e.openCases()[0];
  if (!tbl(e, 'suspect').length) e.revealSuspect(rec, null);
  if (!tbl(e, 'clue').length) e.create('clue', { label: 'x', caseId: rec.id, aspects: { testimony: 1 } });
  var majors = [];
  for (var t = 0; t < 60; t++) {
    if (t === 4) { assert.ok(e.autoSlot('duty', tbl(e, 'focus')[0].uid) && e.start('duty'), 'the day-book after the hire'); }
    if (t === 2) assert.ok(!e.verb('arrest').unlocked, 'the Charge does not come on the heels of the hire');
    e.tick(0.5);
    e.s.journal.slice(journalAt).forEach(function (j) { if (j.kind === 'major') majors.push(e.s.t - hireT); });
    journalAt = e.s.journal.length;
  }
  assert.ok(e.verb('arrest').unlocked && e.s.journal.some(function (j) { return j.title === 'The Charge'; }), 'the Charge came in time');
  var charge = majors[0];
  assert.ok(charge >= 8, 'eight seconds at least after the hire: ' + charge);
  for (var w = 0; w < 30; w += 5) assert.ok(majors.filter(function (x) { return x >= w && x < w + 5; }).length <= 1, 'at most one beat per five seconds: ' + JSON.stringify(majors));
  // Without a verb run since, a beat waits half a minute before it comes anyway.
  var f = CF.Engine.newGame({ seed: 22, who: 'none', name: 'Idle', opening: true, guided: true });
  f.s.flags.stage = 'hired'; f.s.flags.firstCase = true; f.s.intro.step = 3; f.s.intro.lastBeatT = f.s.t; f.s.intro.lastBeatVerbs = 0;
  f.introUnlock(['analyze', 'reflect']);
  var fc = f.spawnCase('missing', { quiet: true }), fr = f.caseRec(fc.caseId);
  fr.opening = true; f.revealSuspect(fr, null); f.create('clue', { label: 'x', caseId: fr.id, aspects: { testimony: 1 } });
  f.tick(10); assert.ok(!f.verb('arrest').unlocked, 'no verb run: the beat waits');
  f.tick(21); assert.ok(f.verb('arrest').unlocked, 'but not for ever');
  // The hire's hint reads the table: a name already known and no raw proof left, it says whom to question.
  var h = CF.Engine.newGame({ seed: 23, who: 'monk', name: 'Named', opening: true, guided: true });
  h.s.flags.stage = 'questioned';
  var hc = h.spawnCase('missing', { quiet: true, roles: h.openingScene().roles }), hr = h.caseRec(hc.caseId);
  hr.opening = true;
  h.revealSuspect(hr, null);
  var named = hr.suspects.filter(function (x) { return x.revealed; })[0];
  h.openingHired();
  assert.strictEqual(h.s.flags.stage, 'hired');
  assert.ok(h.introHint().indexOf('Question ' + named.name + ' with Wit') >= 0, 'the hint names the suspect: ' + h.introHint());
  assert.ok(h.s.flags.callingDue && !h.s.choice, 'the calling waits for openingTick');
  h.tick(0.1);
  assert.ok(h.s.choice && h.s.choice.id === 'calling', 'Explore idle: asked at once');
  console.log('opening beats: ok');
})();

// ---- The sergeant with no Wit on the table: the questioning starts again by itself ----
// An origin with one Wit, spent on the day-book and never collected: Explore's finds are taken
// first, the Watch comes, and Question has nothing to talk with. The hint names the card instead
// of saying wait; when the Wit comes back (uncollected in Attend, on the table, or parked in an
// idle slot) the sergeant's questioning runs by itself; the calling waits until his answer is taken.
(function sergeantWaits() {
  function tbl(g, d) { return g.tableCards().filter(function (c) { return c.def === d; }); }
  function run(g, vid, cards) { cards.forEach(function (c) { assert.ok(g.autoSlot(vid, c.uid), vid + ' takes ' + c.def); }); assert.ok(g.start(vid), vid + ' starts'); }
  var e = CF.Engine.newGame({ seed: 7, who: 'watchman', name: 'Bartel', opening: true, guided: true });
  assert.strictEqual(e.cardsOf('focus', true).length + e.s.intro.stash.filter(function (it) { return it.def === 'focus'; }).length, 1, 'the watchman has one Wit');
  run(e, 'duty', [tbl(e, 'health')[0]]); e.tick(e.verb('duty').duration + 0.01); e.collect('duty');
  run(e, 'duty', [tbl(e, 'focus')[0]]); e.tick(e.verb('duty').duration + 0.01); // the day-book done, its output (Wits' End) left in Attend
  e.tick(0.1);
  assert.strictEqual(e.s.flags.stage, 'search');
  assert.strictEqual(e.verb('duty').status, 'done', 'the day-book waits uncollected');
  e.tick(e.verb('investigate').duration + 0.01); e.collect('investigate'); e.tick(0.1);
  assert.strictEqual(e.s.flags.stage, 'questioned');
  assert.strictEqual(e.verb('interrogate').status, 'idle', 'no Wit on the table: nothing runs');
  assert.ok(/^The sergeant waits\. When your Wit comes back, put The Sergeant's Questions in Question with it\./.test(e.introHint()), 'the hint names the card: ' + e.introHint());
  assert.strictEqual(tbl(e, 'watchq').length, 1, 'his questions lie on the table');
  // A card waiting in a verb does not recover; the day-book taken, the Wits' End comes back on
  // the table in time, and the sergeant takes it from there.
  e.tick(60);
  assert.strictEqual(e.verb('interrogate').status, 'idle', 'uncollected, the Wit stays spent');
  e.collect('duty');
  for (var t = 0; t < 60 && e.verb('interrogate').status === 'idle'; t++) e.tick(1);
  assert.strictEqual(e.verb('interrogate').status, 'running', 'the questioning started by itself: ' + e.introHint());
  assert.strictEqual(e.verb('interrogate').recipe, 'int_watchq');
  assert.strictEqual(tbl(e, 'watchq').length, 0);
  assert.ok(/Your Wit is doing the talking/.test(e.introHint()), 'and the hint says so');
  e.tick(e.verb('interrogate').duration + 0.01); e.tick(0.1);
  assert.strictEqual(e.s.flags.stage, 'hired');
  // The calling waits until the sergeant's answer is taken out of Question (on a phone its sheet covers the box).
  e.tick(12);
  assert.ok(!e.s.choice, 'no choice while the result waits in Question');
  e.collect('interrogate'); e.tick(0.1);
  assert.ok(e.s.choice && e.s.choice.id === 'calling', 'taken: the calling is asked');
  // Wit parked in an idle verb's slot: pulled from there too.
  var f = CF.Engine.newGame({ seed: 8, who: 'hangman', name: 'Nan', opening: true, guided: true });
  run(f, 'duty', [tbl(f, 'health')[0]]); f.tick(f.verb('duty').duration + 0.01); f.collect('duty');
  for (var u = 0; u < 60 && !tbl(f, 'health').length; u++) f.tick(1);
  run(f, 'duty', [tbl(f, 'health')[0]]); f.tick(f.verb('duty').duration + 0.01); f.collect('duty'); f.tick(0.1);
  assert.strictEqual(f.s.flags.stage, 'search');
  f.tick(f.verb('investigate').duration + 0.01); f.collect('investigate');
  assert.ok(f.autoSlot('duty', tbl(f, 'focus')[0].uid), 'the Wit parked in Attend, never pressed');
  f.tick(0.1);
  assert.strictEqual(f.s.flags.stage, 'questioned');
  assert.strictEqual(f.verb('interrogate').status, 'running', 'the sergeant took the Wit out of Attend: ' + f.introHint());
  assert.deepStrictEqual(f.verb('duty').slots, {}, 'Attend stands empty again');
  // Loading a save from the stall: the retry runs from the loaded state too.
  var g = CF.Engine.newGame({ seed: 9, who: 'monk', name: 'Sebald', opening: true, guided: true });
  run(g, 'duty', [tbl(g, 'health')[0]]); g.tick(g.verb('duty').duration + 0.01); g.collect('duty');
  run(g, 'duty', [tbl(g, 'focus')[0]]); g.tick(g.verb('duty').duration + 0.01); g.tick(0.1);
  g.tick(g.verb('investigate').duration + 0.01); g.collect('investigate'); g.tick(0.1);
  assert.strictEqual(g.verb('interrogate').status, 'idle');
  var g2 = CF.Engine.load(g.save());
  g2.collect('duty');
  for (var w = 0; w < 60 && g2.verb('interrogate').status === 'idle'; w++) g2.tick(1);
  assert.strictEqual(g2.verb('interrogate').status, 'running', 'loaded: the questioning starts when the Wit is back');
  console.log('sergeant waits: ok');
})();

// ---- A successor's desk: the inheritance is told once the desk is yours ----------
(function successor() {
  var L = { predecessor: 'Kessler', ending: 'Dismissed', cold: [{ label: 'Cold: The Mill Fire', desc: 'x', data: {} }], atlarge: [], gangs: [], criminals: [], syndicate: false };
  var g = CF.Engine.newGame({ seed: 41, who: 'clerk', name: 'Heir', opening: true, legacy: L });
  var titles = function () { return g.s.journal.map(function (j) { return j.title; }); };
  assert.ok(titles().indexOf('Inherited') < 0, 'nothing inherited before the desk is yours');
  var owned = function (def) { return g.s.intro.stash.filter(function (it) { return it.def === def; }).length + Object.keys(g.s.cards).filter(function (u) { return g.s.cards[u].def === def; }).length; };
  assert.strictEqual(owned('coldcase'), 1, 'but the drawer is already full (stashed)');
  assert.ok(owned('notes') >= 1);
  g.tick(1);
  assert.ok(titles().indexOf('The Last Examiner\'s Drawer') < 0, 'still nothing during the opening');
  g.s.flags.stage = 'questioned';
  g.openingHired();
  g.checkThresholds();
  var drawer = g.s.journal.filter(function (j) { return j.title === 'The Last Examiner\'s Drawer'; });
  assert.strictEqual(drawer.length, 1, 'told at the hire');
  assert.ok(/was Kessler's, until the Council took the letter back\./.test(drawer[0].text) && !/Rhenish/.test(drawer[0].text), drawer[0].text);
  g.checkThresholds(); g.legacyStory();
  assert.strictEqual(g.s.journal.filter(function (j) { return j.title === 'The Last Examiner\'s Drawer'; }).length, 1, 'once');
  // With the Coquille in the drawer, the King sends his compliments; without the opening, the old telling.
  var k = CF.Engine.newGame({ seed: 42, who: 'watchman', opening: true, legacy: { predecessor: 'Vos', ending: 'Something Else', syndicate: true } });
  k.s.flags.stage = 'questioned'; k.openingHired(); k.legacyStory();
  assert.ok(/until they left it\..*Rhenish/.test(k.s.journal[0].text), k.s.journal[0].text);
  var n = CF.Engine.newGame({ seed: 43, calling: 'master', legacy: L });
  assert.ok(n.s.journal.some(function (j) { return j.title === 'Inherited'; }) && n.s.flags.legacy.told, 'no opening: told at once');
  // Saved mid-opening and loaded: still told at the hire.
  var m = CF.Engine.newGame({ seed: 44, who: 'monk', opening: true, legacy: L });
  var ml = CF.Engine.load(m.save());
  ml.s.flags.stage = 'questioned'; ml.openingHired(); ml.checkThresholds();
  assert.ok(ml.s.journal.some(function (j) { return j.title === 'The Last Examiner\'s Drawer'; }), 'after a load too');
  console.log('successor: ok');
})();
