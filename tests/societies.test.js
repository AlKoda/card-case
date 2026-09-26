// Part II, Phase I: endings from the counts, the Order of the Mountain and
// the Eumenides (docs/CITY.md §8, §10).
// Run: node tests/societies.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

['js/util.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/data/structures.js', 'js/data/story.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/systems/informants.js', 'js/systems/criminals.js', 'js/systems/sentence.js', 'js/systems/purse.js', 'js/systems/origins.js', 'js/systems/coquille.js', 'js/systems/patrons.js', 'js/systems/societies.js', 'js/systems/network.js', 'js/systems/callings.js', 'js/systems/intro.js', 'js/core/recipes.js', 'js/data/recipes.js'].forEach(function (f) {
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
  var e = game(1);
  e.s.counts.mercy = 12; e.s.counts.cruelty = 1;
  for (var i = 0; i < 4; i++) { var c = e.criminalFor('Citizen ' + i, null); c.status = 'reformed'; }
  e.checkCountEndings();
  assert.ok(e.s.over && e.s.over.id === 'merciful' && e.s.over.win, 'the Merciful Judge');
  var f = game(2); f.s.counts.cruelty = 14; f.s.meters.dread = 5; f.checkCountEndings();
  assert.strictEqual(f.s.over.id, 'hangmans', 'the Hangman\'s Examiner');
  var h = game(3, 'master'); h.s.who = 'hangman'; h.s.counts.cruelty = 14; h.s.meters.dread = 5; h.checkCountEndings();
  assert.ok(/began outside the walls/.test(h.s.over.text), 'the Hangman\'s own variant');
  var g = game(4); g.favour().bishop = -4; g.s.flags.inquisitor = true; g.s.stats.wrongful = 1;
  var burned = false;
  for (var j = 0; j < 40 && !burned; j++) { g.checkCountEndings(); burned = !!g.s.over; }
  assert.ok(burned && g.s.over.id === 'stake', 'the Stake');
  var n = game(5); n.s.counts.mercy = 12; n.checkCountEndings();
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
  for (var m = 0; m < 20; m++) { var g = game(100 + m, 'commissioner'); g.s.rank = 2; var dg = g.create('dagger'); g.expire(dg); if (g.s.over) dead++; else if (g.countOf('wound')) struck++; }
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
  // Two of them, connected: the thread opens the case against the Brotherhood.
  var second = e.caseRec(e.spawnCase('harbor', { quiet: true, frontId: front.id }).caseId);
  second.society = 'eumenides';
  var c1 = e.create('clue', { caseId: torso.id, aspects: { testimony: 1 }, data: { link: front.id } });
  var c2 = e.create('clue', { caseId: second.id, aspects: { testimony: 1 }, data: { link: front.id } });
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
