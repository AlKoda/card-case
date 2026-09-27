// Part II, Phase C: Sentence, the mercy ladder (docs/CITY.md §6). A
// conviction makes a Condemned card with the rungs the crime allows and
// pleas; each rung has its price; the Council sentences by custom when you
// say nothing; pardoned, banished and branded men come back in their own ways.
// Run: node tests/sentence.test.js
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

function game(seed) { return CF.Engine.newGame({ seed: seed, calling: 'master' }); }
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
// Convict the culprit of the first case on full proof and return the Condemned.
function convict(seed, tier, template) {
  var e = game(seed);
  var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
  if (template && rec.template !== template) { e.remove(kase); rec = e.caseRec(e.spawnCase(template, { quiet: true }).caseId); }
  var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
  e.remove(e.caseCard(rec.id));
  var t = e.create('trial', { data: { caseId: rec.id, name: culprit.name, guilty: true, solid: tier === 'strong', tier: tier, real: 9, need: 6, coerced: 0, planted: 0, illegal: 0, contradictions: 0 } });
  e.rng.setState(1);
  e.verdict(t);
  var cond = byDef(e, 'condemned')[0];
  return { e: e, rec: rec, culprit: culprit, cond: cond };
}
function rungs(e) { return byDef(e, 'rung').map(function (c) { return c.data.rung; }); }
function rung(e, id) { return byDef(e, 'rung').filter(function (c) { return c.data.rung === id; })[0]; }

// ---- A conviction lays the ladder on the table --------------------------------
(function ladder() {
  var g = null;
  for (var i = 0; i < 20 && !(g && g.cond); i++) g = convict(10 + i, 'strong');
  assert.ok(g.cond, 'a conviction makes a Condemned card');
  assert.strictEqual(g.rec.status, 'closed', 'the case is answered in the Rolls');
  assert.deepStrictEqual(rungs(g.e).sort(), CF.LADDERS.burglary.rungs.slice().sort(), 'the burglary ladder: ' + rungs(g.e));
  assert.strictEqual(g.cond.data.custom, 'banish', 'custom for a first burglary is banishment');
  assert.ok(g.e.s.journal.some(function (j) { return /^Condemned:/.test(j.title); }));
  assert.ok(g.e.labelOf(g.cond) === g.culprit.name, 'the card is just the name; the dossier carries the rest');
  // Half proof: the lesser crime, and nothing past banishment.
  var h = null;
  for (var j = 0; j < 20 && !(h && h.cond); j++) h = convict(40 + j, 'reasonable');
  assert.ok(h.cond && h.cond.data.lesser);
  assert.ok(rungs(h.e).indexOf('rope') < 0 && rungs(h.e).indexOf('brand') < 0, 'no rope for the lesser crime: ' + rungs(h.e));
  console.log('ladder: ok');
})();

// ---- Each rung has its price -------------------------------------------------
(function prices() {
  function pass(id, extra) {
    var g = null;
    for (var i = 0; i < 20 && !(g && g.cond && rung(g.e, id)); i++) g = convict(100 + i, 'strong');
    assert.ok(g.cond && rung(g.e, id), 'a condemned burglar with ' + id);
    var e = g.e, before = { m: JSON.parse(JSON.stringify(e.s.meters)), c: JSON.parse(JSON.stringify(e.s.counts)), funds: byDef(e, 'funds').length };
    var cards = [g.cond, rung(e, id)].concat(extra ? extra(e, g) : []);
    var r = run(e, 'arrest', cards);
    assert.strictEqual(r.recipe, 'sen_pass');
    assert.strictEqual(byDef(e, 'condemned').length, 0, 'the Condemned leaves');
    assert.strictEqual(byDef(e, 'rung').length, 0, 'the ladder leaves with them');
    assert.strictEqual(byDef(e, 'plea').length, 0, 'and the pleas');
    return { e: e, g: g, before: before, story: r.story, crim: e.criminalByName(g.culprit.name) };
  }
  var p = pass('pardon');
  assert.strictEqual(p.e.s.counts.mercy - p.before.c.mercy, 2, 'Pardon: Mercy +2');
  assert.strictEqual(p.e.s.meters.scrutiny - p.before.m.scrutiny, 1, 'a pardon without a reason: Suspicion +1');
  assert.ok(p.crim && (p.crim.status === 'reformed' || p.crim.traits.indexOf('spared') >= 0), 'reformed or spared: ' + p.crim.status);
  var f = pass('fine');
  assert.strictEqual(f.e.s.counts.mercy - f.before.c.mercy, 1);
  assert.strictEqual(byDef(f.e, 'funds').length - f.before.funds, 1, 'a fee to the Watch-house');
  var pi = pass('pillory');
  assert.ok(pi.crim.traits.indexOf('pilloried') >= 0);
  var b = pass('banish');
  assert.strictEqual(b.crim.status, 'banished');
  assert.ok(b.crim.returnWeek > b.e.s.week);
  assert.strictEqual(b.e.s.meters.dread - b.before.m.dread, 1);
  var br = pass('brand');
  assert.ok(br.crim.traits.indexOf('branded') >= 0 && br.crim.organization === 'gang', 'a branded man joins a band');
  assert.strictEqual(br.e.s.counts.cruelty - br.before.c.cruelty, 1);
  assert.ok(byDef(br.e, 'atlarge').length >= 1, 'and is Abroad');
  var ro = pass('rope');
  assert.strictEqual(ro.crim.status, 'dead');
  assert.strictEqual(ro.e.s.counts.cruelty - ro.before.c.cruelty, 1);
  assert.strictEqual(ro.e.s.meters.retaliation - ro.before.m.retaliation, 1);
  assert.ok(/Ravenstone/.test(ro.story.text));
  // A plea is a reason; a purse inside it is a bribe.
  var pl = pass('pardon', function (e, g) {
    var plea = e.create('plea', { label: 'A Family\'s Plea', caseId: g.rec.id, data: { from: 'family', purse: true, condemned: g.cond.uid } });
    return [plea];
  });
  assert.strictEqual(pl.e.s.meters.scrutiny - pl.before.m.scrutiny, 0, 'with a plea the Council does not ask why');
  assert.strictEqual(pl.e.s.counts.purse - pl.before.c.purse, 1, 'the purse in the letter: Purse +1');
  assert.strictEqual(byDef(pl.e, 'funds').length - pl.before.funds, 2);
  console.log('prices: ok');
})();

// ---- Murder: the Sword commutes the Wheel; the Wheel is the spectacle -----------
(function capital() {
  var g = null;
  for (var i = 0; i < 30 && !(g && g.cond); i++) g = convict(200 + i, 'strong', 'harbor');
  assert.ok(g.cond, 'a condemned murderer');
  assert.deepStrictEqual(rungs(g.e).sort(), ['pardon', 'rope', 'sword', 'wheel']);
  var e = g.e, m0 = e.s.meters.dread, c0 = e.s.counts.cruelty;
  run(e, 'arrest', [g.cond, rung(e, 'wheel')]);
  assert.strictEqual(e.s.counts.cruelty - c0, 2, 'the Wheel: Cruelty +2');
  assert.strictEqual(e.s.meters.dread - m0, 2, 'and Dread +2');
  var h = null;
  for (var j = 0; j < 30 && !(h && h.cond); j++) h = convict(300 + j, 'strong', 'arson');
  assert.ok(h.cond && h.cond.data.custom === 'wheel');
  assert.ok(byDef(h.e, 'rung').some(function (c) { return h.e.labelOf(c) === 'The Fire'; }), 'arson burns');
  var mm = h.e.s.counts.mercy;
  var r = run(h.e, 'sentence', [h.cond, rung(h.e, 'sword')]);
  assert.strictEqual(h.e.s.counts.mercy - mm, 1, 'the Sword instead of the Fire is a commutation: Mercy +1');
  assert.ok(/Commuted/.test(r.story.text));
  console.log('capital: ok');
})();

// ---- Say nothing and the Council speaks; banished men come back ---------------
(function council() {
  var g = null;
  for (var i = 0; i < 20 && !(g && g.cond); i++) g = convict(400 + i, 'strong');
  var e = g.e;
  e.tick(g.cond.life + 1);
  assert.strictEqual(byDef(e, 'condemned').length, 0, 'the sand runs out');
  assert.strictEqual(byDef(e, 'rung').length, 0);
  var crim = e.criminalByName(g.culprit.name);
  assert.strictEqual(crim.status, 'banished', 'the Council banished by custom');
  assert.ok(e.s.journal.some(function (j) { return /said nothing/.test(j.text); }));
  // The banished return.
  crim.returnWeek = e.s.week;
  var back = false;
  for (var k = 0; k < 8 && !back; k++) { e.banishedReturn(); back = crim.status === 'at_large'; if (!back) crim.returnWeek = e.s.week; }
  assert.ok(back, 'a banished man comes back');
  assert.ok(byDef(e, 'atlarge').some(function (c) { return c.data.name === g.culprit.name; }), 'and is Abroad');
  // Old saves without counts still load and a game with a Condemned saves and loads.
  var g2 = null;
  for (var i2 = 0; i2 < 20 && !(g2 && g2.cond); i2++) g2 = convict(500 + i2, 'strong');
  var again = CF.Engine.load(g2.e.save());
  assert.strictEqual(byDef(again, 'condemned').length, 1);
  assert.strictEqual(byDef(again, 'rung').length, byDef(g2.e, 'rung').length);
  console.log('council: ok');
})();

console.log('sentence: ladder, prices, capital, council all OK');
