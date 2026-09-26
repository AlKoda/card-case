// Regressions from the full code review: things that looked right and were not.
// Run: node tests/review.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

['js/util.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/data/structures.js', 'js/data/story.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/systems/informants.js', 'js/systems/criminals.js', 'js/systems/sentence.js', 'js/systems/purse.js', 'js/systems/network.js', 'js/systems/callings.js', 'js/systems/intro.js', 'js/core/recipes.js', 'js/data/recipes.js'].forEach(function (f) {
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
  var v = e.verb(verb), out = v.out.map(function (u) { return e.card(u); }), story = v.story, id = v.recipe;
  if (v.status === 'done') e.collect(verb);
  return { out: out, story: story, id: id };
}

// A save from before Delegate / Major Crimes existed still loads and promotes.
(function oldSave() {
  var e = game(91);
  var s = JSON.parse(e.save());
  delete s.verbs.delegate; delete s.verbs.majorcrimes; delete s.rooms; delete s.paths; delete s.origin; delete s.criminals; delete s.network;
  var e2 = CF.Engine.load(JSON.stringify(s));
  assert.ok(e2.verb('delegate') && !e2.verb('delegate').unlocked);
  e2.s.rank = 1; e2.promote();
  assert.ok(e2.verb('delegate').unlocked, 'promotion works on the migrated save');
  e2.tick(65);
  assert.ok(!e2.s.over, 'it plays on');
  console.log('old save: ok');
})();

// A conviction takes the criminal's At Large card off the table; escapes never duplicate it.
(function atLarge() {
  var e = game(92);
  var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
  var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
  kase.life = 0.1; e.tick(1);
  var crim = e.criminalByName(culprit.name);
  assert.strictEqual(byDef(e, 'atlarge').length, 1);
  // A second escape (a "Name again" case going cold) refreshes the card instead of adding one.
  var again = e.spawnCase('burglary', { quiet: true, culpritName: culprit.name, culpritTrait: culprit.trait, criminalId: crim.id });
  again.life = 0.1; e.tick(1);
  assert.strictEqual(byDef(e, 'atlarge').length, 1, 'one card per person');
  assert.ok(/^Old Offender/.test(e.labelOf(byDef(e, 'atlarge')[0])), 'and it follows the record');
  // A conviction on a later case with no atLargeUid still removes the card.
  var third = e.spawnCase('burglary', { quiet: true, culpritName: culprit.name, culpritTrait: culprit.trait, criminalId: crim.id });
  var r3 = e.caseRec(third.caseId);
  var t = e.create('trial', { data: { caseId: r3.id, name: culprit.name, guilty: true, solid: true, tier: 'strong', real: 9, need: 6, coerced: 0, planted: 0, illegal: 0, contradictions: 0 } });
  var saved = e.save(), done = false;
  for (var i = 0; i < 8 && !done; i++) {
    var g = CF.Engine.load(saved); g.rng.setState(i * 13 + 5); g.verdict(g.card(t.uid));
    if (g.caseRec(r3.id).status === 'closed') { done = true; assert.strictEqual(byDef(g, 'atlarge').length, 0, 'their name comes off the wall'); assert.strictEqual(g.criminalByName(culprit.name).status, 'jailed'); }
  }
  assert.ok(done);
  console.log('at large: ok');
})();

// An informant's Warning waits for room on the caseload instead of being thrown away.
(function warningWaits() {
  var e = game(93, 'crusader');
  while (e.openCases().length < e.maxOpenCases()) e.spawnCase(null, { quiet: true });
  e.s.nextCase = { template: 'arson', district: 'canal' };
  e.s.dispatchT = 1;
  e.tick(2);
  assert.ok(e.s.nextCase && e.s.nextCase.template === 'arson', 'still waiting');
  e.openCases().forEach(function (r) { e.goCold(r.id); });
  e.s.meters.pressure = 0;
  e.s.dispatchT = 1;
  e.tick(2);
  assert.ok(e.openCases().some(function (r) { return r.template === 'arson'; }), 'and it arrives when there is room');
  console.log('warning waits: ok');
})();

// Rent comes out before the salary lands: with nothing on the table you sleep in the car.
(function rent() {
  var e = game(94);
  byDef(e, 'funds').forEach(function (c) { e.remove(c); });
  var fat = e.countOf('fatigue');
  e.tick(CF.WEEK + 0.01);
  assert.strictEqual(e.countOf('fatigue'), fat + 2, 'missed the rent');
  assert.strictEqual(byDef(e, 'funds').length, CF.RANK_DEFS[0].salary, 'salary still lands');
  console.log('rent: ok');
})();

// The partial print does not name the culprit without the kit.
(function print() {
  var e = game(95);
  var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
  var prints = e.create('prints');
  run(e, 'investigate', [kase]);
  run(e, 'investigate', [kase, prints]);
  var partial = e.tableCards().filter(function (c) { return /Half a Hand/.test(e.labelOf(c)); })[0];
  e.remove(prints);
  var r = run(e, 'analyze', [partial]);
  var clue = r.out.filter(function (c) { return c.def === 'clue'; })[0];
  var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
  assert.ok(clue && e.labelOf(clue).indexOf(culprit.name) < 0 && clue.desc.indexOf(culprit.name) < 0, 'no spoiler: ' + e.labelOf(clue));
  // And the scene pool does not repeat the written leads.
  assert.ok(!rec.items.some(function (it) { return /Pried Shutter|The Inventory|Pawnbroker's Chit|The Hours/.test(it.label); }));
  console.log('print: ok');
})();

// Dead ends now say why.
(function deadEnds() {
  var e = game(96);
  var clue = e.create('clue', { label: 'x', caseId: byDef(e, 'case')[0].caseId, aspects: { forensic: 1 } });
  e.autoSlot('analyze', clue.uid);
  assert.ok(/Apothecary/.test(e.preview('analyze').blocked || ''), 'a token in Study without the apothecary');
  e.clearSlots('analyze');
  var warn = e.create('intel', { label: 'Warning: x', data: { kind: 'warning', template: 'arson', district: 'canal' } });
  e.autoSlot('reflect', warn.uid);
  assert.ok(/Keep this on the table/.test(e.preview('reflect').blocked || ''), 'a warning in Reflect');
  e.clearSlots('reflect');
  e.autoSlot('duty', byDef(e, 'focus')[0].uid); e.autoSlot('duty', byDef(e, 'funds')[0].uid);
  assert.ok(e.preview('duty') && !e.preview('duty').blocked, 'Focus with Funds still works a desk shift');
  e.clearSlots('duty');
  // Template items are variable-filled.
  for (var i = 0; i < 30; i++) {
    var g = game(700 + i), c = g.spawnCase('extortion', { quiet: true });
    g.caseRec(c.caseId).items.forEach(function (it) { assert.ok(!/\{\w+\}/.test(it.label + it.text), it.label); });
  }
  console.log('dead ends: ok');
})();
