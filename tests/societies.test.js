// Part II, Phase I: endings from the counts, the Order of the Mountain and
// the Eumenides (docs/CITY.md §8, §10).
// Run: node tests/societies.test.js
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

function game(seed, calling) { return CF.Engine.newGame({ seed: seed, calling: calling || 'master' }); }
function byDef(e, d) { return e.tableCards().filter(function (c) { return c.def === d; }); }
function run(e, verb, cards) {
  cards.forEach(function (c) { assert.ok(e.autoSlot(verb, c.uid), verb + ' refused ' + e.labelOf(c)); });
  var pv = e.preview(verb);
  assert.ok(pv && !pv.blocked, verb + ' blocked: ' + (pv && pv.blocked));
  assert.ok(e.start(verb));
  e.tick(e.verb(verb).duration + 0.01);
  var v = e.verb(verb), out = v.out.map(function (u) { return e.card(u); }), story = v.story;
  if (v.status === 'done') e.collect(verb);
  return { out: out, story: story, recipe: v.recipe };
}

// ---- Endings from the counts ----------------------------------------------------
(function endings() {
  // Every count ending is told first: the warning and the ending never share a tick.
  var e = game(1);
  e.s.counts.mercy = 10; e.s.counts.cruelty = 1;
  for (var i = 0; i < 3; i++) { var c = e.criminalFor('Citizen ' + i, null); c.status = 'reformed'; }
  e.checkCountEndings();
  assert.ok(!e.s.over && e.s.flags.mercifulWarned, 'within two pardons: the warning');
  assert.strictEqual(e.s.journal[0].title, 'The Merciful Judge');
  e.s.counts.mercy = 12; e.criminalFor('Citizen 3', null).status = 'reformed';
  e.checkCountEndings();
  assert.ok(e.s.over && e.s.over.id === 'merciful' && e.s.over.win, 'the Merciful Judge');
  var e2 = game(11); e2.s.counts.mercy = 12; e2.s.counts.cruelty = 1;
  for (var i2 = 0; i2 < 4; i2++) e2.criminalFor('Citizen ' + i2, null).status = 'reformed';
  e2.checkCountEndings();
  assert.ok(!e2.s.over && e2.s.flags.mercifulWarned, 'the thresholds met at once: still the warning first');
  e2.checkCountEndings();
  assert.strictEqual(e2.s.over.id, 'merciful');
  var f = game(2); f.s.counts.cruelty = 14; f.s.meters.dread = 5; f.checkCountEndings();
  assert.ok(!f.s.over && f.s.flags.hangmanWarned && f.s.journal[0].title === 'The Executioner\'s Table', 'the executioner\'s table first');
  f.checkCountEndings();
  assert.strictEqual(f.s.over.id, 'hangmans', 'the Hangman\'s Examiner');
  var h = game(3, 'master'); h.s.who = 'hangman'; h.s.counts.cruelty = 14; h.s.meters.dread = 5; h.checkCountEndings(); h.checkCountEndings();
  assert.ok(/began outside the walls/.test(h.s.over.text), 'the Hangman\'s own variant');
  var g = game(4); g.favour().bishop = -4; g.s.flags.inquisitor = true; g.s.stats.wrongful = 1;
  g.checkCountEndings();
  assert.ok(!g.s.over && g.s.flags.stakeWarned && g.s.journal[0].title === 'The Inquisitor Asks for Your Name', 'the Inquisitor asks first');
  var burned = false;
  for (var j = 0; j < 40 && !burned; j++) { g.checkCountEndings(); burned = !!g.s.over; }
  assert.ok(burned && g.s.over.id === 'stake', 'the Stake');
  var n = game(5); n.s.counts.mercy = 12; n.checkCountEndings(); n.checkCountEndings();
  assert.ok(!n.s.over, 'mercy without reformed citizens is not yet the ending');
  console.log('endings: ok');
})();

// ---- The Order of the Mountain ---------------------------------------------------
(function mountain() {
  var e = game(6, 'commissioner');
  e.s.rank = 2; e.s.week = 8;
  var warned = false;
  for (var i = 0; i < 60 && !warned; i++) { e.mountainWeek(); warned = e.countOf('dagger') > 0; }
  assert.ok(warned, 'a dagger on the pillow');
  var d = byDef(e, 'dagger')[0];
  e.create('funds'); e.create('funds');
  var r = run(e, 'reflect', [d, byDef(e, 'funds')[0], byDef(e, 'funds')[1]]);
  assert.strictEqual(r.recipe, 'ref_dagger');
  assert.ok(/Paid/.test(r.story.title));
  assert.ok(e.s.flags.mountainPaidUntil > e.s.week, 'a season bought');
  var before = e.s.week;
  e.s.week = before + 1;
  for (var k = 0; k < 20; k++) e.mountainWeek();
  assert.strictEqual(e.countOf('dagger'), 0, 'no daggers while paid');
  // Endured, or ignored.
  var f = game(7, 'commissioner'); f.s.rank = 2; f.s.week = 8;
  for (var i2 = 0; i2 < 60 && !f.countOf('dagger'); i2++) f.mountainWeek();
  var r2 = run(f, 'reflect', [byDef(f, 'dagger')[0]]);
  assert.ok(/Endured|Came Anyway/.test(r2.story.title));
  var struck = 0, dead = 0;
  // The coin is tossed from spread RNG states: twenty neighbouring seeds at one draw land correlated.
  for (var m = 0; m < 20; m++) { var g = game(100 + m, 'commissioner'); g.s.rank = 2; g.rng.setState((m + 1) * 7919); var dg = g.create('dagger'); g.expire(dg); if (g.s.over) dead++; else if (g.countOf('wound')) struck++; }
  assert.ok(dead >= 3 && struck >= 3, 'ignored: death or a wound: ' + dead + '/' + struck);
  var q = game(8, 'master'); q.s.rank = 3; q.s.week = 20;
  for (var i3 = 0; i3 < 40; i3++) q.mountainWeek();
  assert.strictEqual(q.countOf('dagger'), 0, 'the Order only meets those on the way to the Seat');
  console.log('mountain: ok');
})();

// ---- The Eumenides --------------------------------------------------------------
(function eumenides() {
  var e = game(9, 'master');
  e.s.week = 8;
  var torso = null;
  for (var i = 0; i < 60 && !torso; i++) { e.eumenidesWeek(); torso = e.openCases().filter(function (r) { return r.society === 'eumenides'; })[0]; }
  assert.ok(torso, 'a torso at the Harbour');
  var front = e.eumenidesFront();
  assert.ok(torso.items.some(function (it) { return it.link === front.id; }), 'the case points at the hospital door');
  assert.ok(/ring-mark/.test(e.caseCard(torso.id).desc));
  // A second torso comes by itself once the first is a week old; never a third.
  var second = null;
  e.s.rank = 2; // a desk with room for it
  for (var w = 0; w < 20 && !second; w++) { e.eumenidesWeek(); second = e.openCases().filter(function (r) { return r.society === 'eumenides' && r.id !== torso.id; })[0]; }
  assert.ok(!second, 'not in the first week');
  e.s.week++;
  for (var w2 = 0; w2 < 40 && !second; w2++) { e.eumenidesWeek(); second = e.openCases().filter(function (r) { return r.society === 'eumenides' && r.id !== torso.id; })[0]; }
  assert.ok(second, 'a second torso');
  assert.ok(e.s.journal.some(function (j) { return j.title === 'Another Torso'; }));
  e.s.week++;
  for (var w3 = 0; w3 < 40; w3++) e.eumenidesWeek();
  assert.strictEqual(e.openCases().filter(function (r) { return r.society === 'eumenides'; }).length, 2, 'never a third');
  // A clue that names the hospital door outlives its case.
  var c1 = e.create('clue', { caseId: torso.id, aspects: { testimony: 1 }, data: { link: front.id } });
  var c2 = e.create('clue', { caseId: second.id, aspects: { testimony: 1 }, data: { link: front.id } });
  var plain = e.create('clue', { caseId: torso.id, aspects: { testimony: 1 }, data: {} });
  e.clearCaseCards(torso.id);
  assert.ok(e.card(c1.uid) && c1.data.kept && /^Kept: /.test(c1.label) && c1.life === 400, 'the ring-mark clue is kept');
  assert.ok(!e.card(plain.uid), 'the rest of the case goes');
  // Two of them, connected: the thread opens the case against the Brotherhood.
  var r = run(e, 'reflect', [c1, c2]);
  var thread = byDef(e, 'thread')[0];
  assert.ok(thread && thread.data.front === front.id, 'a Thread: ' + (r.story && r.story.title));
  var r2 = run(e, 'reflect', [thread]);
  assert.strictEqual(r2.recipe, 'ref_eumenides');
  var big = e.openCases().filter(function (x) { return x.template === 'eumenides'; })[0];
  assert.ok(big && e.s.flags.eumenidesCase === big.id, 'the case against the Brotherhood');
  // Breaking them: Knowledge scores, the Council does not thank you.
  var cul = big.suspects.filter(function (x) { return x.guilty; })[0];
  e.remove(e.caseCard(big.id));
  var t = e.create('trial', { data: { caseId: big.id, name: cul.name, guilty: true, solid: true, tier: 'strong', real: 12, need: 9, coerced: 0, planted: 0, illegal: 0, contradictions: 0 } });
  var m0 = e.s.paths.master;
  var done = false;
  for (var j = 0; j < 20 && !done; j++) { var g = CF.Engine.load(e.save()); g.rng.setState(j * 13 + 1); g.verdict(g.card(t.uid)); if (g.caseRec(big.id).status === 'closed') { done = true; assert.ok(g.s.flags.eumenidesBroken); assert.ok(g.s.paths.master >= m0 + 3, 'Knowledge +3'); assert.strictEqual(g.favour().council, -2, 'the Council will not thank you'); } }
  assert.ok(done);
  console.log('eumenides: ok');
})();

console.log('societies: endings, mountain, eumenides all OK');
