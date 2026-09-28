// Part II, Phase F: patrons (docs/CITY.md §9). Commissions carry a desired
// verdict; delivering it raises Favour, delivering the truth lowers it;
// Favour opens and shuts doors; the Council can turn; the Bishop's
// displeasure brings the Inquisitor.
// Run: node tests/patrons.test.js
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

function game(seed) { return CF.Engine.newGame({ seed: seed, calling: 'master' }); }
function byDef(e, d) { return e.tableCards().filter(function (c) { return c.def === d; }); }
function convictOn(e, rec, who, tier, off) {
  e.remove(e.caseCard(rec.id));
  var t = e.create('trial', { data: { caseId: rec.id, name: who.name, guilty: who.guilty, solid: tier === 'strong', tier: tier || 'strong', real: 9, need: 6, coerced: 0, planted: 0, illegal: 0, contradictions: 0 } });
  for (var i = 0; i < 20; i++) { var saved = e.save(); var g = CF.Engine.load(saved); g.rng.setState(i * 31 + 5 + (off || 0)); g.verdict(g.card(t.uid)); if (g.caseRec(rec.id).status === 'closed') return g; }
  throw new Error('never convicted');
}
function commission(seed, from) {
  for (var i = 0; i < 200; i++) {
    var e = game(seed + i);
    var rec = e.caseRec(e.spawnCase(from === 'guild' ? 'fraud' : from === 'bishop' ? 'harbor' : 'burglary', { quiet: true }).caseId);
    if (rec.commission && rec.commission.from === from) return { e: e, rec: rec };
  }
  throw new Error('no commission from ' + from);
}

// ---- Commissions arrive, and the dossier says what is wanted ----------------------
(function arrive() {
  var seen = { council: 0, bishop: 0, guild: 0 }, n = 0;
  for (var i = 0; i < 80; i++) {
    var e = game(300 + i);
    var rec = e.caseRec(e.spawnCase(null, { quiet: true }).caseId);
    if (rec.commission) { seen[rec.commission.from]++; n++; assert.ok(/wants|asks|want/.test(CF.Patrons.describe(rec))); }
  }
  assert.ok(n >= 10 && seen.council >= 1 && seen.bishop >= 1 && seen.guild >= 1, JSON.stringify(seen));
  var c = commission(1, 'council');
  assert.ok(c.rec.commission.ofCouncil && c.rec.commission.deadline > c.e.s.t);
  assert.ok(/Council/.test(c.e.caseCard(c.rec.id).desc), 'the case says who wants what');
  console.log('arrive: ok');
})();

// ---- The Council: quiet and quick, or the truth against a Council family ----------
(function council() {
  var c = commission(20, 'council'), e = c.e, rec = c.rec;
  var family = rec.suspects.filter(function (x) { return x.key === rec.commission.ofCouncil; })[0];
  var other = rec.suspects.filter(function (x) { return x.key !== rec.commission.ofCouncil; })[0];
  var f0 = byDef(e, 'funds').length;
  var g = convictOn(e, rec, other);
  assert.strictEqual(g.favour().council, 1, 'delivered as desired: Favour +1');
  assert.ok(byDef(g, 'funds').length >= f0 + 2, 'and two Coin');
  if (!other.guilty) assert.ok(g.s.stats.protected >= 1, 'a wrongful conviction under the Council\'s protection');
  var c2 = commission(60, 'council'), e2 = c2.e, rec2 = c2.rec;
  var fam2 = rec2.suspects.filter(function (x) { return x.key === rec2.commission.ofCouncil; })[0];
  var j0 = e2.s.paths.crusader, r0 = e2.s.meters.reputation;
  var g2 = convictOn(e2, rec2, fam2);
  assert.strictEqual(g2.favour().council, -1, 'the truth against a Council family: Favour −1');
  assert.ok(g2.s.paths.crusader >= j0 + 2, 'Justice scores it double');
  assert.ok(g2.s.journal.some(function (j) { return /Council family in the dock/.test(j.text); }), 'and the Hill will not forgive it');
  void r0;
  // Left to go cold, the patron is displeased.
  var c3 = commission(90, 'council');
  c3.e.goCold(c3.rec.id);
  assert.strictEqual(c3.e.favour().council, -1);
  console.log('council: ok');
})();

// ---- The Bishop and the Guilds want a sentence ------------------------------------
(function sentences() {
  var b = commission(120, 'bishop'), e = b.e, rec = b.rec;
  var cul = rec.suspects.filter(function (x) { return x.guilty; })[0];
  var g = convictOn(e, rec, cul);
  g.s.counts.cruelty = 2;
  var cond = byDef(g, 'condemned')[0];
  assert.ok(cond, 'condemned');
  var res = g.passSentence(cond, 'pardon', null, { quiet: true });
  assert.strictEqual(g.favour().bishop, 1, 'mercy for the Bishop: Favour +1');
  assert.strictEqual(g.s.counts.cruelty, 1, 'and absolution, once per rank');
  assert.ok(/absolves/.test(res.text));
  var b2 = commission(160, 'bishop');
  var g2 = convictOn(b2.e, b2.rec, b2.rec.suspects.filter(function (x) { return x.guilty; })[0]);
  g2.passSentence(byDef(g2, 'condemned')[0], 'rope', null, { quiet: true });
  assert.strictEqual(g2.favour().bishop, -1, 'the rope for the Bishop\'s penitent: Favour −1');
  var gu = commission(200, 'guild');
  var g3 = convictOn(gu.e, gu.rec, gu.rec.suspects.filter(function (x) { return x.guilty; })[0]);
  var f0 = byDef(g3, 'funds').length;
  g3.passSentence(byDef(g3, 'condemned')[0], 'pillory', null, { quiet: true });
  assert.strictEqual(g3.favour().guild, 1, 'the square for the Guilds: Favour +1');
  assert.strictEqual(byDef(g3, 'funds').length - f0, 1, 'and a fee');
  var gu2 = commission(240, 'guild');
  var g4 = convictOn(gu2.e, gu2.rec, gu2.rec.suspects.filter(function (x) { return x.guilty; })[0]);
  g4.passSentence(byDef(g4, 'condemned')[0], 'brand', null, { quiet: true });
  assert.strictEqual(g4.favour().guild, -1);
  assert.ok(g4.s.flags.marketQuietUntil >= g4.s.week, 'the Market goes quiet');
  console.log('sentences: ok');
})();

// ---- Favour, elections and the Inquisitor ----------------------------------------
(function favour() {
  var e = game(7);
  e.favour().council = 3; e.s.meters.scrutiny = 2;
  e.patronsWeek();
  assert.strictEqual(e.s.meters.scrutiny, 1, 'a patron on the Council covers you');
  e.favour().council = -2; e.s.rank = 0; e.s.meters.reputation = 99;
  e.checkThresholds();
  assert.strictEqual(e.cardsWith('promotion').length, 0, 'no letters while the Council is against you');
  // The election turns.
  var turned = false;
  for (var i = 0; i < 30 && !turned; i++) { var g = game(400 + i); g.favour().council = 3; g.s.week = 12; g.patronsWeek(); if (g.favour().council === 0) { turned = true; assert.strictEqual(g.s.meters.scrutiny, 3, 'Favour becomes Suspicion'); } }
  assert.ok(turned, 'the Council can turn');
  // The Inquisitor.
  var h = game(9);
  h.favour().bishop = -2;
  var lines = h.patronsWeek();
  assert.ok(h.s.flags.inquisitor && lines.some(function (l) { return /Inquisitor/.test(l); }));
  var taken = false;
  for (var j = 0; j < 30 && !taken; j++) {
    var k = game(500 + j); k.s.flags.inquisitor = true;
    var rec = k.caseRec(byDef(k, 'case')[0].caseId);
    var cul = rec.suspects.filter(function (x) { return x.guilty; })[0];
    var g5 = convictOn(k, rec, cul, 'strong', j * 7);
    if (!byDef(g5, 'condemned').length && g5.s.stats.inquisitor) { taken = true; assert.strictEqual(g5.criminalByName(cul.name).status, 'dead'); assert.strictEqual(g5.s.counts.cruelty, 0, 'the Inquisitor\'s cruelty is not yours'); }
  }
  assert.ok(taken, 'the Inquisitor takes the Condemned sometimes');
  h.favour().bishop = 0;
  h.patronsWeek();
  assert.ok(!h.s.flags.inquisitor, 'and is recalled');
  var old = JSON.parse(game(1).save()); delete old.favour;
  assert.deepStrictEqual(CF.Engine.load(old).favour(), { council: 0, bishop: 0, guild: 0 });
  console.log('favour: ok');
})();

console.log('patrons: arrive, council, sentences, favour all OK');
