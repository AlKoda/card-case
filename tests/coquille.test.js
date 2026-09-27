// Part II, Phase G: the Court of Miracles (docs/CITY.md §8). The King of
// Thunes is crowned when the Coquille forms; a Treaty quiets the Stews and
// hands you culprits at the price of a blind eye and the Justice path; the
// Court's trial lets you inside, and after four weeks, with Purse and
// Cruelty enough, the throne.
// Run: node tests/coquille.test.js
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

function game(seed) {
  var e = CF.Engine.newGame({ seed: seed, calling: 'master' });
  e.s.rank = 2;
  e.spawnSyndicate('test');
  return e;
}
function byDef(e, d) { return e.tableCards().filter(function (c) { return c.def === d; }); }
function run(e, verb, cards) {
  cards.forEach(function (c) { assert.ok(e.autoSlot(verb, c.uid), verb + ' refused ' + e.labelOf(c)); });
  var pv = e.preview(verb);
  assert.ok(pv && !pv.blocked, verb + ' blocked: ' + (pv && pv.blocked));
  assert.ok(e.start(verb));
  e.tick(e.verb(verb).duration + 0.01);
  var v = e.verb(verb), out = v.out.map(function (u) { return e.card(u); }), story = v.story;
  if (v.status === 'done') e.collect(verb);
  return { out: out, story: story, preview: pv, recipe: v.recipe };
}

// ---- The King ---------------------------------------------------------------
(function king() {
  var e = game(1);
  var court = e.court();
  assert.ok(court.king && court.king.name, 'the Coquille has a King');
  var k = e.criminal(court.king.criminalId);
  assert.ok(k.king && k.organization === 'syndicate');
  assert.ok(/King of Thunes/.test(byDef(e, 'syndicate')[0].desc), 'the card names him');
  assert.ok(/King of Thunes/.test(e.criminalDesc(k)));
  var c = e.criminalEscapes({ title: 'x', template: 'burglary' }, { name: 'Test Name', trait: 'scar' }, 'cold');
  assert.ok(/crocheteur/.test(e.criminalDesc(c)), 'a burglar is a crocheteur: ' + e.criminalDesc(c));
  console.log('king: ok');
})();

// ---- Treaty -------------------------------------------------------------------
(function treaty() {
  var e = game(2);
  var r = run(e, 'investigate', [byDef(e, 'syndicate')[0], byDef(e, 'focus')[0]]);
  assert.strictEqual(r.recipe, 'undercover_parley');
  assert.strictEqual(e.court().stance, 'treaty');
  var j0 = e.s.paths.crusader;
  e.pathGain('crusader', 3, 'test');
  assert.strictEqual(e.s.paths.crusader, j0, 'Justice scores nothing under a Treaty');
  e.pathGain('commissioner', 1, 'test');
  // Weeks under the Treaty: quiet, a culprit handed over, the Court's own closings, tribute.
  var open0 = e.openCases().length;
  e.s.meters.pressure = 3;
  var lines = e.coquilleWeek();
  assert.ok(lines.some(function (l) { return /quiet/.test(l); }));
  assert.ok(e.openCases().length > open0, 'the Court hands over a case');
  assert.ok(byDef(e, 'clue').some(function (c) { return /Court's Word/.test(e.labelOf(c)); }), 'with the Court\'s word');
  assert.strictEqual(byDef(e, 'tribute').length, 1, 'tribute waits');
  var f0 = byDef(e, 'funds').length;
  var t = run(e, 'duty', [byDef(e, 'tribute')[0]]);
  assert.strictEqual(t.recipe, 'duty_tribute');
  assert.strictEqual(byDef(e, 'funds').length - f0, 2);
  assert.strictEqual(e.s.counts.purse, 1);
  // Two weeks in, a case arrives closed by the Court.
  e.s.week = e.court().since + 2;
  e.coquilleWeek();
  assert.ok((e.s.stats.byCourt || 0) >= 1, 'closed by the Court');
  // Twelve quiet weeks: the Treaty City.
  e.court().quietWeeks = 11; e.s.meters.pressure = 2;
  e.coquilleWeek();
  assert.ok(e.s.over && e.s.over.id === 'treatycity' && e.s.over.win, 'the Treaty City');
  // Indicting the Coquille breaks a treaty.
  var g = game(3);
  run(g, 'investigate', [byDef(g, 'syndicate')[0], byDef(g, 'focus')[0]]);
  g.breakTreaty('test');
  assert.strictEqual(g.court().stance, null);
  console.log('treaty: ok');
})();

// ---- Rule ---------------------------------------------------------------------
(function rule() {
  var inside = null;
  for (var i = 0; i < 20 && !inside; i++) {
    var e = game(10 + i);
    e.create('funds'); e.create('funds');
    var r = run(e, 'investigate', [byDef(e, 'syndicate')[0], byDef(e, 'instinct')[0], byDef(e, 'funds')[0], byDef(e, 'funds')[1]]);
    assert.strictEqual(r.recipe, 'undercover_trial', r.recipe);
    if (e.court().inside) inside = e;
  }
  assert.ok(inside, 'the Court\'s trial can be passed');
  var e2 = inside;
  assert.ok(!e2.canTakeThrone());
  assert.ok(/does not crown the honest|weeks/.test(e2.throneReason()));
  e2.autoSlot('investigate', byDef(e2, 'syndicate')[0].uid); e2.autoSlot('investigate', byDef(e2, 'instinct')[0].uid);
  var pv = e2.preview('investigate');
  assert.ok(/Not yet/.test(pv.blocked || pv.text), 'the throne is not yet yours: ' + (pv.blocked || pv.text));
  e2.clearSlots('investigate');
  for (var w = 0; w < 4; w++) e2.coquilleWeek();
  assert.ok(e2.court().insideWeeks >= 4, 'four weeks inside: ' + e2.court().insideWeeks);
  assert.ok(byDef(e2, 'clue').some(function (c) { return /Court's Word/.test(e2.labelOf(c)); }), 'from inside you feed the Watch-house');
  e2.s.counts.purse = 4; e2.s.counts.cruelty = 2;
  assert.ok(e2.canTakeThrone());
  var th = run(e2, 'investigate', [byDef(e2, 'syndicate')[0], byDef(e2, 'instinct')[0]]);
  assert.strictEqual(th.recipe, 'undercover_throne');
  assert.ok(e2.s.over && e2.s.over.id === 'kingofthunes' && e2.s.over.win, 'the King of Thunes');
  console.log('rule: ok');
})();

// ---- Eradicate still works, and costs Dread; saves keep the court ---------------
(function eradicate() {
  var e = game(30);
  e.create('ledger'); e.create('ledger');
  var r = run(e, 'investigate', [byDef(e, 'syndicate')[0], byDef(e, 'instinct')[0]]);
  assert.strictEqual(r.recipe, 'undercover_op');
  assert.ok(e.s.flags.syndicateCase, 'the case against the Coquille opens');
  var d0 = e.s.meters.dread;
  e.coquilleFalls();
  assert.strictEqual(e.s.meters.dread - d0, 2, 'raiding the Warrens costs Dread');
  var again = CF.Engine.load(e.save());
  assert.ok(again.s.court && again.s.court.king.name === e.court().king.name);
  var old = JSON.parse(CF.Engine.newGame({ seed: 5, calling: 'master' }).save()); delete old.court;
  assert.strictEqual(CF.Engine.load(old).court().stance, null);
  console.log('eradicate: ok');
})();

console.log('coquille: king, treaty, rule, eradicate all OK');
