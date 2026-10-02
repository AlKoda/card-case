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
  // Their prose may reach the journal as a quiet aside (intro.js ASIDES), never as a lesson told again.
  assert.ok(!e.s.journal.some(function (j) { return (j.title === 'What the Scene Gives' || j.title === 'People' || j.title === 'The Casebook') && j.kind !== 'minor'; }), 'no lesson told twice');
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
  // It points at the move that names someone (the case with its tokens in Rest), and a Wit on the table means questioning now.
  assert.ok(/the case and its tokens together in Rest/.test(h.introHint()), 'the hint points at the case in Rest: ' + h.introHint());
  assert.ok(h.introHint().indexOf('question ' + named.name + ' with Wit') >= 0, 'the hint names the suspect: ' + h.introHint());
  // The sergeant has had the only Wit: the hint says it comes back, instead of asking for it.
  var h2 = CF.Engine.newGame({ seed: 23, who: 'monk', name: 'Named', opening: true, guided: true });
  h2.s.flags.stage = 'questioned';
  var hc2 = h2.spawnCase('missing', { quiet: true, roles: h2.openingScene().roles }), hr2 = h2.caseRec(hc2.caseId);
  hr2.opening = true;
  h2.revealSuspect(hr2, null);
  h2.cardsOf('focus', true).forEach(function (c) { h2.remove(c); });
  h2.s.intro.stash = h2.s.intro.stash.filter(function (it) { return it.def !== 'focus'; });
  h2.openingHired();
  assert.ok(/When your Wit comes back from the sergeant, question /.test(h2.introHint()), 'no Wit to hand: ' + h2.introHint());
  assert.ok(!/with Wit\./.test(h2.introHint()), 'and it does not ask for one now');
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

// ---- The first keep remembers whose death began it; a won ending looks back -----------------
(function firstVictim() {
  CF.ORIGIN_ORDER.concat(['none']).forEach(function (who, i) {
    var e = CF.Engine.newGame({ seed: 40 + i, who: who, name: 'Kept', opening: true, guided: true });
    var sc = e.openingScene();
    assert.ok(sc.kept && sc.kept.length > 20, who + ' has a line for the burial');
    e.s.flags.stage = 'hired';
    e.openingKeep();
    assert.strictEqual(e.s.flags.firstVictim, sc.missing, who + ': the first victim is kept');
    var keep = e.s.journal.filter(function (j) { return j.title === CF.OPENING_TEXT.keep; })[0];
    assert.ok(keep && keep.text.indexOf(sc.kept) === 0 && keep.text.indexOf(CF.OPENING_TEXT.keepText) > 0, who + ': the keep tells of the burial first: ' + (keep && keep.text));
  });
  // A won run ends with the death it began with; a lost one does not.
  var w = CF.Engine.newGame({ seed: 50, who: 'clerk', name: 'Won', opening: true, guided: true });
  w.s.flags.stage = 'hired'; w.openingKeep();
  var won = CF.Engine.load(w.save()); won.gameOver('commissioner');
  assert.ok(/The first case in your casebook is still the death of Endres\./.test(won.s.over.text), 'the Seat looks back: ' + won.s.over.text);
  var lost = CF.Engine.load(w.save()); lost.gameOver('dismissed');
  assert.ok(!/first case in your casebook/.test(lost.s.over.text), 'a dismissal does not');
  // A save from before the flag, past the first keep, still knows the name from its origin.
  var old = JSON.parse(w.save()); delete old.flags.firstVictim;
  var o = CF.Engine.load(old);
  assert.strictEqual(o.firstVictim(), 'Endres', 'an older save derives the first victim');
  o.gameOver('master');
  assert.ok(/still the death of Endres/.test(o.s.over.text), 'and its ending looks back too');
  // A run with no opening (the guided desk) has nobody to look back to.
  var p = CF.Engine.newGame({ seed: 51, calling: 'master' }); p.gameOver('master');
  assert.strictEqual(p.firstVictim(), null);
  assert.ok(!/first case in your casebook/.test(p.s.over.text), 'no opening, no look back');
  console.log('first victim: ok');
})();

// ---- The Reformer hears of the Coquille before he can touch it -------------------------------
(function coquilleForetold() {
  function at(rank, week, synd) {
    var e = CF.Engine.newGame({ seed: 60, calling: 'crusader' });
    e.introFinish && e.introFinish();
    e.s.rank = rank; e.s.week = week;
    e.cardsOf('syndicate', true).forEach(function (c) { e.remove(c); });
    if (synd) e.create('syndicate');
    e.rivalWeek();
    return e.s.journal.filter(function (j) { return j.title === CF.COQUILLE_FORETOLD.title && j.text === CF.COQUILLE_FORETOLD.text; }).length;
  }
  assert.strictEqual(at(0, 6), 1, 'week six, below the white staff: the word is said');
  assert.strictEqual(at(1, 9), 1, 'a Sworn Examiner hears it too');
  assert.strictEqual(at(0, 5), 0, 'not before week six');
  assert.strictEqual(at(2, 6), 0, 'a Bailiff can go among them: no foretelling');
  assert.strictEqual(at(0, 6, true), 0, 'the Coquille already formed: no foretelling');
  var e = CF.Engine.newGame({ seed: 61, calling: 'crusader' });
  e.s.week = 6; e.cardsOf('syndicate', true).forEach(function (c) { e.remove(c); });
  var meters = JSON.stringify(e.s.meters);
  e.rivalWeek(); e.rivalWeek();
  assert.strictEqual(e.s.journal.filter(function (j) { return j.title === CF.COQUILLE_FORETOLD.title && j.text === CF.COQUILLE_FORETOLD.text; }).length, 1, 'once');
  assert.strictEqual(JSON.stringify(e.s.meters), meters, 'a story only: no meter moves');
  var m = CF.Engine.newGame({ seed: 62, calling: 'master' }); m.s.week = 6; m.rivalWeek();
  assert.ok(!m.s.flags.coquilleForetold, 'only the Reformer');
  var l = CF.Engine.load(JSON.parse(e.save()));
  l.rivalWeek();
  assert.strictEqual(l.s.journal.filter(function (j) { return j.title === CF.COQUILLE_FORETOLD.title && j.text === CF.COQUILLE_FORETOLD.text; }).length, 1, 'a loaded save does not say it twice');
  console.log('coquille foretold: ok');
})();

// ---- The Court's first lesson says what Indicia does ------------------------------------------
(function courtLesson() {
  var step = CF.Engine.prototype.introSteps().filter(function (st) { return st.beat === 3; })[0];
  var e = CF.Engine.newGame({ seed: 70, calling: 'master', guided: true });
  var res = step.run(e);
  assert.ok(/Indicia/.test(res.hint) && /walk free/.test(res.hint), 'the Charge hint warns of Indicia: ' + res.hint);
  console.log('court lesson: ok');
})();

// ---- The opening case lost in the Court: the keep comes all the same, and the beats fit ------
// An acquittal (or the case gone unanswered) clears the opening: the Bell, one Coin, a new case
// soon; the guided start tells the sworn men's word, not the Ladder, and the Desk only after the
// keep. After a conviction the keep's Bell lesson outlives the Ladder's hint.
(function openingLost() {
  function tbl(g, d) { return g.tableCards().filter(function (c) { return c.def === d; }); }
  function titles(g) { return g.s.journal.map(function (j) { return j.title; }).reverse(); }
  // Any question the city puts (the calling, a choice) is answered at once: the clock waits for it.
  function tick(g, dt) { if (g.s.choice) g.choose(0); g.tick(dt); if (g.s.choice) g.choose(0); }
  // A hired examiner with the opening case, its accused and a token, at the Court.
  function atCourt(seed, who) {
    var e = CF.Engine.newGame({ seed: seed, who: who, name: 'Lost', opening: true, guided: true });
    e.s.flags.stage = 'questioned';
    var c = e.spawnCase('missing', { quiet: true, roles: e.openingScene().roles }), rec = e.caseRec(c.caseId);
    rec.opening = true;
    e.openingHired();
    if (e.s.choice) e.choose(0);
    e.introUnlock(['arrest']);
    e.s.intro.step = 4; e.s.intro.lastBeatT = -100;
    var sus = tbl(e, 'suspect')[0] || e.revealSuspect(rec, null);
    var clue = e.create('clue', { label: 'x', caseId: rec.id, aspects: { testimony: 1 } });
    assert.ok(e.autoSlot('arrest', sus.uid) && e.autoSlot('arrest', clue.uid) && e.start('arrest'), 'the charge starts');
    tick(e, e.verb('arrest').duration + 0.01); e.collect('arrest');
    assert.strictEqual(rec.status, 'trial');
    tick(e, 0.1);
    assert.ok(e.s.flags.opening, 'a case at trial does not end the opening');
    e.s.intro.lastBeatT = -100; // the sworn men are out a while: the next beat is not held back
    return { e: e, rec: rec, trial: tbl(e, 'trial')[0] };
  }
  // The sworn men acquit (the dice held high for the verdict).
  var a = atCourt(70, 'clerk'), e = a.e, rng = e.rng;
  var coin = e.cardsOf('funds', true).length;
  e.rng = function () { return 0.995; }; e.verdict(a.trial); e.rng = rng;
  assert.strictEqual(a.rec.status, 'acquitted');
  tick(e, 0.1);
  assert.strictEqual(e.s.flags.stage, 'keep', 'the keep comes after an acquittal');
  assert.ok(!e.s.flags.opening && !e.s.flags.bellSilent && e.verb('time').unlocked, 'the Bell rings from now on');
  assert.strictEqual(e.cardsOf('funds', true).length, coin + 1, 'one Coin, not two');
  var keep = e.s.journal.filter(function (j) { return j.title === CF.OPENING_TEXT.keep; })[0];
  assert.ok(keep && keep.text.indexOf(CF.OPENING_TEXT.keepAcquitted) > 0, 'the keep says the sworn men did not convict: ' + (keep && keep.text));
  var told = e.s.journal.filter(function (j) { return /Council has seen you work/.test(j.text || ''); });
  assert.strictEqual(told.length, 1, 'the desk kept after an acquittal is said once, by the verdict: ' + told.map(function (j) { return j.title; }).join(' | '));
  assert.strictEqual(e.s.intro.keepWeek, e.s.week, 'the keep\'s week is kept for the Bell\'s lesson');
  assert.ok(titles(e).indexOf('The Sworn Men Acquit') >= 0 && titles(e).indexOf('The Ladder') < 0, 'the sworn men\'s word, not the Ladder: ' + titles(e).join(' | '));
  tick(e, 0.1);
  assert.ok(e.s.intro.finished, 'the desk arrives once the keep is made');
  assert.ok(titles(e).indexOf('The Desk') > titles(e).indexOf(CF.OPENING_TEXT.keep), 'the Desk after the keep, never while the Bell is silent');
  assert.ok(/^The Bell rings from now on/.test(e.introHint() || ''), 'the Bell lesson is shown: ' + e.introHint());
  for (var t = 0; t < 120 && !e.openCases().length; t++) tick(e, 1);
  assert.ok(e.openCases().length >= 1, 'a new case within two minutes of the acquittal: ' + t + 's');
  tick(e, 60);
  assert.strictEqual(e.introHint(), null, 'the Bell lesson goes in time');
  // A save stuck in the old limbo (acquitted, no keep) recovers on its first tick.
  var b = atCourt(71, 'monk'), old;
  b.e.rng = function () { return 0.995; }; b.e.verdict(b.trial); b.e.rng = rng;
  old = JSON.parse(b.e.save());
  // The verdict keeps the desk at once now (engine.js); an older build left the opening open, as here.
  old.flags.opening = true; old.flags.stage = 'hired'; old.flags.bellSilent = true;
  assert.ok(old.flags.opening && old.flags.stage === 'hired', 'saved in the limbo');
  var l = CF.Engine.load(old);
  tick(l, 0.1);
  assert.strictEqual(l.s.flags.stage, 'keep', 'a loaded limbo save gets its keep');
  // The case gone unanswered: the keep, with its own words.
  var c = atCourt(72, 'none');
  c.e.remove(c.trial); c.rec.status = 'cold';
  tick(c.e, 0.1);
  var ck = c.e.s.journal.filter(function (j) { return j.title === CF.OPENING_TEXT.keep; })[0];
  assert.ok(ck && ck.text.indexOf(CF.OPENING_TEXT.keepCold) > 0, 'an unanswered first case: ' + (ck && ck.text));
  // A conviction: the Ladder's hint first, then the Bell's once the Condemned is sentenced.
  var d = atCourt(73, 'watchman'), g = d.e;
  g.rng = function () { return 0; }; g.verdict(d.trial); g.rng = rng;
  assert.strictEqual(g.s.flags.stage, 'keep');
  tick(g, 0.1);
  var cond = tbl(g, 'condemned')[0];
  assert.ok(cond, 'a Condemned');
  assert.ok(/^A conviction\./.test(g.introHint() || ''), 'the Ladder is taught: ' + g.introHint());
  assert.ok(titles(g).indexOf('The Ladder') >= 0 && titles(g).indexOf('The Sworn Men Acquit') < 0);
  g.remove(cond); tick(g, 0.1);
  assert.ok(g.s.intro.finished);
  assert.ok(/^The Bell rings from now on/.test(g.introHint() || ''), 'then the Bell, which was overwritten before: ' + g.introHint());
  console.log('opening lost: ok');
})();

// ---- A strain card never sits without its cure: Rest opens with the first one -------------------
(function strainOpensRest() {
  var e = CF.Engine.newGame({ seed: 74, who: 'clerk', name: 'Strained', opening: true, guided: true });
  e.s.flags.stage = 'search';
  assert.ok(!e.verb('reflect').unlocked, 'Rest is shut before the hire');
  e.create('obsession');
  e.tick(0.1);
  assert.ok(e.verb('reflect').unlocked, 'Obsession opens Rest');
  assert.ok(/^Rest is open: put Obsession in it/.test(e.introHint() || ''), 'and the hint says what to do: ' + e.introHint());
  var f = CF.Engine.newGame({ seed: 75, calling: 'master', guided: true });
  assert.ok(!f.verb('reflect').unlocked);
  f.create('fatigue'); f.tick(0.1);
  assert.ok(f.verb('reflect').unlocked, 'Weariness opens Rest in the plain guided start too');
  console.log('strain opens rest: ok');
})();

// ---- The Rival's next move, once foreseen, is the move made ----------------------------------
(function rivalForeseen() {
  function setup(seed, cases) {
    var e = CF.Engine.newGame({ seed: seed, calling: 'master' });
    e.s.week = 7;
    e.tableCards().forEach(function (c) { if (c.def === 'clue' || c.def === 'evidence' || c.def === 'witness') e.remove(c); });
    e.openCases().forEach(function (r) { r.searches = 0; });
    var recs = [];
    for (var i = 0; i < cases; i++) {
      var r = e.openCases()[i] || e.caseRec(e.spawnCase(null, { quiet: true }).caseId);
      r.searches = 1; r.week = 5; recs.push(r);
    }
    e.create('rival', { label: 'The Rival: Piet Wieland', data: { name: 'Piet Wieland', heat: 0, stalled: 0 } });
    return { e: e, recs: recs };
  }
  var hits = 0;
  for (var k = 0; k < 6; k++) {
    var o = setup(80 + k, 2), e = o.e;
    var line = e.rivalForesee();
    var next = e.cardsOf('rival', true)[0].data.next;
    assert.ok(next && next.act === 'poach', 'the only move is a case to race: ' + JSON.stringify(next));
    var aim = e.caseRec(next.id);
    assert.ok(line.indexOf('Piet Wieland means to take up ' + aim.title) === 0, 'the line names the case: ' + line);
    var l = CF.Engine.load(e.save()); // a save keeps the foreseen move
    l.rivalWeek();
    assert.ok(l.caseRec(next.id).rival, 'the case foreseen is the case taken');
    assert.ok(!l.cardsOf('rival', true)[0].data.next, 'the move is spent');
    if (o.recs.filter(function (r) { return l.caseRec(r.id).rival; }).length === 1) hits++;
  }
  assert.strictEqual(hits, 6, 'one case taken each time, the foreseen one');
  var n = setup(90, 0);
  assert.ok(/has nothing of yours in hand yet/.test(n.e.rivalForesee()), 'nothing to take: it says so');
  // The first thread named the case they are after (data.eyes): when they take up a case, it is that one.
  var named = 0;
  for (var q = 0; q < 8; q++) {
    var p = setup(100 + q, 3), r = p.e.cardsOf('rival', true)[0];
    r.data.eyes = p.recs[2].id;
    p.e.rivalWeek();
    var taken = p.recs.filter(function (x) { return x.rival; });
    assert.strictEqual(taken.length, 1, 'one case taken up');
    if (taken[0] === p.recs[2]) named++;
  }
  assert.strictEqual(named, 8, 'the case they were asking about is the one they take');
  console.log('rival foreseen: ok');
})();

// ---- Harm is told apart from bad news ----------------------------------------------------------
(function harmKind() {
  var e = CF.Engine.newGame({ seed: 95, calling: 'master' });
  while (e.cardsOf('health', true).length < 2) e.create('health');
  var need = e.create('hunger', { lifetime: 1 });
  e.needExpired(need);
  var lost = e.s.journal.filter(function (j) { return /^Lost: /.test(j.title); })[0];
  assert.ok(lost && lost.kind === 'harm', 'an ability lost for good is harm: ' + (lost && lost.kind));
  console.log('harm kind: ok');
})();

// ---- A successor's desk: told once it is yours, never as nobody's dead man's ------------------
(function successorDesk() {
  var old = CF.Engine.newGame({ seed: 96, calling: 'master' });
  old.s.detective = 'Kessler';
  old.gameOver('dismissed');
  var L = JSON.parse(JSON.stringify(old.s.legacy));
  var e = CF.Engine.newGame({ seed: 97, who: 'clerk', name: 'Heir', opening: true, guided: true, legacy: L });
  var texts = function () { return e.s.journal.map(function (j) { return j.title + ': ' + j.text; }).join('\n'); };
  assert.ok(!/Inherited/.test(texts()), 'no inheritance before the desk is yours:\n' + texts());
  assert.ok(!/when he died/.test(texts()) && /when they went/.test(texts()), 'the clerk\'s last Examiner went, not died:\n' + texts());
  assert.ok(e.cardsOf('coldcase', true).length === L.cold.slice(0, 4).length, 'the cold cases are kept for later');
  // A save from the opening carries the flag through load.
  e = CF.Engine.load(JSON.stringify(e.s));
  e.s.flags.stage = 'questioned';
  var c = e.spawnCase('missing', { quiet: true, roles: e.openingScene().roles });
  e.caseRec(c.caseId).opening = true;
  e.openingHired();
  var drawer = e.s.journal.filter(function (j) { return j.title === 'The Last Examiner\'s Drawer'; });
  assert.strictEqual(drawer.length, 1, 'the drawer is told at the hire');
  assert.ok(/was Kessler's, until the Council took the letter back/.test(drawer[0].text), drawer[0].text);
  assert.strictEqual(/King's compliments/.test(drawer[0].text), !!L.syndicate, 'the King writes only if his Court came down with the desk');
  // A save from before the flag (its inheritance already told) hires without a second telling.
  var p = CF.Engine.newGame({ seed: 98, who: 'none', name: 'Plain', opening: true, guided: true });
  var saved = JSON.parse(JSON.stringify(p.s)); delete saved.flags.legacy;
  p = CF.Engine.load(saved);
  p.s.flags.stage = 'questioned';
  p.openingHired();
  assert.ok(!p.s.journal.some(function (j) { return j.title === 'The Last Examiner\'s Drawer'; }), 'no legacy, no drawer');
  // Without the opening the inheritance is told at once, as before.
  var q = CF.Engine.newGame({ seed: 99, calling: 'master', legacy: L });
  assert.ok(q.s.journal.some(function (j) { return j.title === 'Inherited'; }), 'a start without the opening inherits at once');
  console.log('successor desk: ok');
})();

// ---- An opening case taken out of your hands (settled for a purse, the Court, the Rival) ------
// The keep comes all the same, and a new case within two weeks: no desk left without the Bell.
(function openingTakenAway() {
  ['settled', 'court', 'inquisitor', 'rival'].forEach(function (status, i) {
    var e = CF.Engine.newGame({ seed: 120 + i, who: 'clerk', name: 'Away', opening: true, guided: true });
    e.s.flags.stage = 'questioned';
    var c = e.spawnCase('missing', { quiet: true, roles: e.openingScene().roles }), rec = e.caseRec(c.caseId);
    rec.opening = true;
    e.openingHired();
    if (e.s.choice) e.choose(0);
    e.remove(c); rec.status = status;
    for (var t = 0; t < 2 * CF.WEEK && (e.s.flags.stage !== 'keep' || !e.openCases().length); t++) {
      if (e.s.choice) e.choose(0);
      e.tick(1);
    }
    assert.strictEqual(e.s.flags.stage, 'keep', status + ': the keep comes');
    assert.ok(!e.s.flags.opening && e.verb('time').unlocked, status + ': the Bell rings');
    assert.ok(e.openCases().length >= 1, status + ': a new case within two weeks (' + t + 's)');
    var keep = e.s.journal.filter(function (j) { return j.title === CF.OPENING_TEXT.keep; })[0];
    assert.ok(keep && keep.text.indexOf(CF.OPENING_TEXT.keepCold) > 0, status + ': the keep says it went unanswered by you: ' + (keep && keep.text));
  });
  console.log('opening taken away: ok');
})();

// ---- A first case lost out of your hands is told once: the Desk All the Same, then the burial ----
(function openingLostOnce() {
  var e = CF.Engine.newGame({ seed: 131, who: 'watchman', name: 'Once', opening: true, guided: true });
  e.s.flags.stage = 'questioned';
  var c = e.spawnCase('missing', { quiet: true, roles: e.openingScene().roles }), rec = e.caseRec(c.caseId);
  rec.opening = true;
  e.openingHired();
  if (e.s.choice) e.choose(0);
  e.goCold(rec.id);
  var titles = e.s.journal.map(function (j) { return j.title; });
  assert.ok(titles.indexOf('The Desk All the Same') >= 0, 'the desk is kept all the same');
  var keep = e.s.journal.filter(function (j) { return j.title === CF.OPENING_TEXT.keep; })[0];
  assert.strictEqual(keep && keep.text, e.openingScene().kept, 'the keep is the burial, not the Bell said twice: ' + (keep && keep.text));
  assert.strictEqual(e.s.intro.keepWeek, e.s.week, 'its week is kept');
  // A save from before intro.keepWeek reads the week from the journal.
  var old = JSON.parse(e.save());
  delete old.intro.keepWeek;
  var l = CF.Engine.load(old);
  if (l.s.choice) l.choose(0);
  l.tick(0.1);
  assert.strictEqual(l.s.intro.keepWeek, e.s.week, 'an older save finds the keep\'s week in the journal');
  console.log('opening lost, told once: ok');
})();

// ---- A Fever outranks the lesson: the hint names it until it is slept off ----------------------
(function feverOverLesson() {
  var e = CF.Engine.newGame({ seed: 130, calling: 'master', guided: true });
  var lesson = e.introHint();
  assert.ok(lesson && !/Fever/.test(lesson), 'a lesson to begin with: ' + lesson);
  var f = e.create('burnout');
  assert.strictEqual(e.introHint(), 'Pressing: Fever. Into Rest now, or the file ends.', 'the Fever comes first');
  e.remove(f);
  assert.strictEqual(e.introHint(), lesson, 'and the lesson comes back');
  // A Fixation has no clock: it does not take the lesson's place.
  e.create('tunnel');
  assert.strictEqual(e.introHint(), lesson, 'Fixation leaves the lesson');
  // No lesson showing: nothing is said in its place (the advisor speaks then).
  e.s.intro.finished = true; e.s.intro.tailT = 0;
  e.create('burnout');
  assert.strictEqual(e.introHint(), null, 'after the guided start, the hint is the advisor\'s');
  console.log('fever over the lesson: ok');
})();

// ---- The opening case's own Quarter comes with the hire, and only that one ------------------
(function openingQuarter() {
  var e = CF.Engine.newGame({ seed: 71, who: 'watchman', name: 'Door', opening: true, guided: true });
  e.s.flags.stage = 'questioned';
  var c = e.spawnCase('missing', { quiet: true, district: 'warrens', roles: e.openingScene().roles }), rec = e.caseRec(c.caseId);
  rec.opening = true;
  assert.strictEqual(byDef(e, 'district').length, 0, 'no Quarter before the hire');
  e.openingHired();
  var q = byDef(e, 'district');
  assert.ok(q.length === 1 && q[0].data.district === 'warrens', 'the hire gives the case\'s own Quarter');
  assert.ok(!e.s.flags.marketOpen && !(e.s.flags.districts || {}).market, 'the rest of the city waits for the keep');
  var hired = e.s.journal.filter(function (j) { return j.title === CF.OPENING_TEXT.hired; })[0];
  assert.ok(hired && hired.text.indexOf('You have the run of The Warrens. Go door to door') > 0, 'the hire says so: ' + (hired && hired.text));
  assert.strictEqual(e.introHint(), CF.OPENING_TEXT.doorHint, 'nobody named: the hint sends you door to door');
  // Door to door now works on the first case: the people who saw.
  e.introUnlock(['investigate']);
  var found = run(e, 'investigate', [byDef(e, 'case')[0], q[0]]);
  assert.ok(found.some(function (x) { return x && x.def === 'witness'; }), 'door to door finds who saw: ' + found.map(function (x) { return x && x.def; }));
  // A save from before, hired with no Quarter: it comes on the next tick, once, with a word.
  var o = CF.Engine.newGame({ seed: 72, who: 'monk', name: 'Old', opening: true, guided: true });
  o.s.flags.stage = 'questioned';
  var oc = o.spawnCase('missing', { quiet: true, district: 'warrens', roles: o.openingScene().roles });
  o.caseRec(oc.caseId).opening = true;
  o.openingHired();
  o.cardsOf('district', true).forEach(function (d) { o.remove(d); });
  delete o.s.flags.districts;
  var old = CF.Engine.load(o.save());
  old.tick(0.1);
  assert.strictEqual(byDef(old, 'district').length, 1, 'an old hired save gets its Quarter');
  assert.ok(old.s.journal.some(function (j) { return j.title === CF.OPENING_TEXT.door; }));
  old.tick(0.1);
  assert.strictEqual(old.cardsOf('district', true).length, 1, 'once');
  console.log('the opening quarter: ok');
})();

// ---- The labour's hint tells the truth: Health laid in Attend is not yet Winded -------------
(function workHintTruth() {
  var e = CF.Engine.newGame({ seed: 21, who: 'clerk', name: 'Plate', opening: true, guided: true });
  var hp = byDef(e, 'health')[0];
  assert.ok(e.autoSlot('duty', hp.uid), 'Health goes into Attend');
  assert.strictEqual(e.verb('duty').status, 'idle', 'and the plate is not pressed');
  e.tick(0.1);
  assert.strictEqual(e.introHint(), 'Now press A Day\'s Labour.', 'not started: press it, not Winded: ' + e.introHint());
  assert.ok(e.start('duty'));
  e.tick(0.1);
  assert.ok(/^Winded\. Health comes back/.test(e.introHint()), 'started: Winded: ' + e.introHint());
  // The labour done, Wit laid in Attend and not pressed: the same word, with its own plate.
  e.tick(e.verb('duty').duration); e.collect('duty'); e.tick(0.1);
  assert.ok(e.autoSlot('duty', byDef(e, 'focus')[0].uid), 'Wit goes into Attend');
  e.tick(0.1);
  assert.strictEqual(e.introHint(), 'Now press ' + e.preview('duty').label + '.', 'Wit unpressed: ' + e.introHint());
  assert.ok(e.start('duty'));
  e.tick(0.1);
  assert.ok(/^Both spent\./.test(e.introHint()), 'both at work: ' + e.introHint());
  console.log('work hint truth: ok');
})();

// ---- The plain start's first beats come back on the opening path as asides, each once --------
(function openingAsides() {
  function hired(seed, who) {
    var g = CF.Engine.newGame({ seed: seed, who: who, name: 'Aside', opening: true, guided: true });
    g.s.flags.stage = 'hired'; g.s.flags.firstCase = true; g.s.intro.step = 3;
    g.introUnlock(['interrogate', 'analyze', 'reflect']);
    g.introReveal(['health', 'instinct']);
    var c = g.spawnCase('missing', { quiet: true }), rec = g.caseRec(c.caseId);
    rec.opening = true;
    g.s.intro.lastBeatT = g.s.t - 31; g.s.intro.lastBeatVerbs = 0;
    return { e: g, rec: rec };
  }
  function told(g, title) { return g.s.journal.filter(function (j) { return j.title === title; }); }
  function noWit(g) {
    g.cardsOf('focus', true).forEach(function (c) { g.remove(c); });
    g.s.intro.stash = g.s.intro.stash.filter(function (it) { return it.def !== 'focus'; });
  }
  // A hire with Health and no Wit: once an accused is on the table, the question is named before it is used.
  var a = hired(81, 'watchman'), e = a.e;
  noWit(e);
  e.tick(0.1);
  assert.notStrictEqual(e.introHint(), CF.INTRO_ASIDE_QUESTION, 'nobody to question yet');
  e.revealSuspect(a.rec, null);
  assert.ok(byDef(e, 'health').length && byDef(e, 'suspect').length && !byDef(e, 'focus').length);
  e.tick(0.1);
  assert.strictEqual(e.introHint(), CF.INTRO_ASIDE_QUESTION, 'the question is named: ' + e.introHint());
  e.tick(0.1);
  var people = told(e, 'People');
  assert.ok(people.length === 1 && people[0].kind === 'minor', 'the beat\'s prose goes to the journal, quietly');
  assert.strictEqual(e.introHint(), CF.INTRO_ASIDE_QUESTION, 'the quiet prose leaves the hint alone');
  // A token too: the Charge waits its pace behind the aside, then comes.
  e.create('clue', { label: 'x', caseId: a.rec.id, aspects: { testimony: 1 } });
  e.tick(0.1);
  assert.ok(!e.verb('arrest').unlocked, 'the Charge waits its turn behind the aside');
  e.tick(31);
  assert.ok(e.verb('arrest').unlocked, 'and then follows');
  e.revealSuspect(a.rec, null);
  e.tick(31);
  assert.strictEqual(told(e, 'People').length, 1, 'once');
  assert.notStrictEqual(e.introHint(), CF.INTRO_ASIDE_QUESTION, 'the warning is not given twice');
  // Two tokens of one case: the Casebook's prose in the journal, the hint left alone.
  assert.strictEqual(told(e, 'The Casebook').length, 0, 'one token is not yet a casebook');
  var hint = e.introHint();
  e.create('clue', { label: 'y', caseId: a.rec.id, aspects: { testimony: 1 } });
  e.tick(0.1);
  assert.ok(told(e, 'The Casebook').length === 1 && told(e, 'The Casebook')[0].kind === 'minor', 'the Casebook, quietly');
  assert.strictEqual(e.introHint(), hint, 'a quiet aside does not take the hint');
  // With a Wit to hand the question is not pressed on anyone, but the prose still reaches the journal.
  var b = hired(82, 'clerk'), g = b.e;
  g.revealSuspect(b.rec, null);
  assert.ok(byDef(g, 'focus').length, 'a Wit on the table');
  g.tick(0.1); g.tick(0.1);
  assert.notStrictEqual(g.introHint(), CF.INTRO_ASIDE_QUESTION, 'a Wit to listen with: no warning');
  assert.strictEqual(told(g, 'People').length, 1, 'the prose is not lost');
  // An old save in the middle of the opening (no record of asides) loads and hears them.
  var o = hired(83, 'watchman'), oe = o.e;
  noWit(oe);
  oe.revealSuspect(o.rec, null);
  var raw = JSON.parse(oe.save()); delete raw.intro.asides;
  var l = CF.Engine.load(raw);
  l.tick(0.1);
  assert.strictEqual(l.introHint(), CF.INTRO_ASIDE_QUESTION, 'an old save hears it too');
  assert.ok(l.s.intro.asides && l.s.intro.asides.question, 'and keeps the record from then on');
  // A plain start is taught by its own steps: no asides there.
  var p = CF.Engine.newGame({ seed: 84, who: 'clerk', name: 'Plain', guided: true });
  assert.ok(!p.s.flags.opening && !p.s.flags.stage);
  for (var i = 0; i < 20; i++) p.tick(1);
  assert.strictEqual(Object.keys(p.s.intro.asides || {}).length, 0, 'no asides on a plain start');
  console.log('opening asides: ok');
})();

// ---- The plain how-to line is for a plain start: the opening taught the table as it went -----
(function controlsTaught() {
  var e = CF.Engine.newGame({ seed: 85, who: 'clerk', name: 'Taught', opening: true, guided: true });
  assert.strictEqual(e.introTaughtControls(), true, 'the opening teaches the handling');
  var p = CF.Engine.newGame({ seed: 85, who: 'clerk', name: 'Plain', guided: true });
  assert.strictEqual(p.introTaughtControls(), false, 'a plain start keeps the how-to line');
  assert.strictEqual(CF.Engine.load(e.save()).introTaughtControls(), true, 'and a save keeps it');
  console.log('controls taught: ok');
})();
