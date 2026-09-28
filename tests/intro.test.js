// The guided start and the narrative content: a new detective meets the
// table one thing at a time, openings vary, endings say what happened.
// Run: node tests/intro.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

['js/util.js', 'js/i18n.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/data/structures.js', 'js/data/story.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/systems/informants.js', 'js/systems/criminals.js', 'js/systems/sentence.js', 'js/systems/purse.js', 'js/systems/origins.js', 'js/systems/coquille.js', 'js/systems/patrons.js', 'js/systems/societies.js', 'js/systems/network.js', 'js/systems/callings.js', 'js/systems/intro.js', 'js/systems/life.js', 'js/core/recipes.js', 'js/data/recipes.js'].forEach(function (f) {
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
