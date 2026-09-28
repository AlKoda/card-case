// Part II, Phase D: the purse (docs/CITY.md §7). Fees are the job;
// corruption is when the fee decides the answer. A sold writ, the
// Thief-takers' cut, a frame convicted for blood money, and the two ends
// of the corrupt road: the Thief-taker General and the Old Bailey.
// Run: node tests/purse.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

['js/util.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/data/structures.js', 'js/data/story.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/systems/informants.js', 'js/systems/criminals.js', 'js/systems/sentence.js', 'js/systems/purse.js', 'js/systems/origins.js', 'js/systems/coquille.js', 'js/systems/patrons.js', 'js/systems/societies.js', 'js/systems/network.js', 'js/systems/callings.js', 'js/systems/intro.js', 'js/systems/life.js', 'js/core/recipes.js', 'js/data/recipes.js'].forEach(function (f) {
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

// ---- Selling a writ ---------------------------------------------------------
(function writ() {
  var e = game(3);
  assert.strictEqual(e.offerWritSale(), null, 'no letters for a plain Examiner');
  e.s.rank = 1;
  var letter = e.offerWritSale();
  assert.ok(letter && letter.def === 'writsale');
  assert.strictEqual(e.offerWritSale(), null, 'one letter at a time');
  var funds = byDef(e, 'funds').length;
  var r = run(e, 'duty', [letter]);
  assert.strictEqual(r.recipe, 'duty_writsale');
  assert.strictEqual(byDef(e, 'funds').length - funds, 3, 'three Coin');
  assert.strictEqual(e.s.counts.purse, 1, 'Purse +1');
  assert.ok(e.s.meters.scrutiny >= 1, 'and the Council hears of it');
  console.log('writ: ok');
})();

// ---- The Thief-takers' Office ------------------------------------------------
(function thieftakers() {
  var e = game(5);
  var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
  assert.ok(CF.ORDERS.thieftakers && CF.ROOMS.thieftakers, 'the petition and the room exist');
  e.autoSlot('duty', kase.uid);
  var pv = e.preview('duty');
  assert.ok(/Petition for the Thief-takers/.test(pv.blocked), 'blocked without the office: ' + pv.blocked);
  e.clearSlots('duty');
  e.s.rooms.thieftakers = true;
  e.create('funds'); e.create('funds');
  var settled = 0, frames = 0, nothing = 0;
  for (var i = 0; i < 30; i++) {
    var g = game(100 + i);
    g.s.rooms.thieftakers = true;
    g.create('funds'); g.create('funds');
    var k = byDef(g, 'case')[0], r = g.caseRec(k.caseId);
    var res = run(g, 'duty', [k, byDef(g, 'funds')[0], byDef(g, 'funds')[1]]);
    assert.strictEqual(res.recipe, 'duty_thieftakers');
    assert.strictEqual(g.s.counts.debt, 1, 'Underworld Debt +1');
    if (r.status === 'settled') {
      settled++;
      assert.strictEqual(g.s.counts.purse, 1, 'the cut: Purse +1');
      assert.ok(!byDef(g, 'case').length, 'the case leaves the table');
      assert.ok(byDef(g, 'atlarge').length >= 1, 'the culprit is named and walks');
      assert.strictEqual(g.s.stats.convictions, 0, 'no conviction');
    } else if (byDef(g, 'clue').some(function (c) { return c.data.frame; })) {
      frames++;
      var fr = byDef(g, 'clue').filter(function (c) { return c.data.frame; })[0];
      var sus = byDef(g, 'suspect').filter(function (c) { return c.data.key === fr.data.points; })[0];
      assert.ok(sus && !g.suspectOf(sus).guilty, 'the frame names an innocent');
      var a = g.assessCharge(sus, [fr]);
      assert.strictEqual(a.framed, 1);
    } else nothing++;
  }
  assert.ok(settled >= 10 && frames >= 3 && nothing >= 1, 'settled ' + settled + ', frames ' + frames + ', nothing ' + nothing);
  console.log('thief-takers: ok');
})();

// ---- Blood money: a frame convicted pays, and counts ---------------------------
(function bloodMoney() {
  var paid = null;
  for (var i = 0; i < 20 && !paid; i++) {
    var e = game(200 + i);
    var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
    var innocent = rec.suspects.filter(function (x) { return !x.guilty; })[0];
    e.remove(kase);
    var funds = byDef(e, 'funds').length;
    var t = e.create('trial', { data: { caseId: rec.id, name: innocent.name, guilty: false, solid: false, tier: 'strong', real: 8, need: 6, coerced: 0, planted: 0, illegal: 0, contradictions: 0, framed: 1 } });
    e.rng.setState(7 * (i + 1));
    e.verdict(t);
    if (rec.status === 'closed') paid = { e: e, funds: funds };
  }
  assert.ok(paid, 'a frame convicts sometimes');
  assert.strictEqual(paid.e.s.stats.wrongful, 1, 'it is wrongful');
  assert.strictEqual(paid.e.s.stats.frames, 1);
  assert.strictEqual(paid.e.s.counts.purse, 2, 'blood money: Purse +2');
  assert.ok(byDef(paid.e, 'funds').length - paid.funds >= 3, 'and three Coin');
  console.log('blood money: ok');
})();

// ---- The two ends of the road ---------------------------------------------------
(function endings() {
  var e = game(9);
  e.s.counts.purse = 6; e.s.stats.wrongful = 1; e.s.meters.reputation = 7; e.s.rank = 2;
  e.checkPurseEndings();
  assert.ok(e.s.over && e.s.over.id === 'thieftaker' && e.s.over.win, 'corrupt and working: the Thief-taker General');
  var f = game(10);
  f.s.counts.purse = 6; f.s.stats.wrongful = 3;
  f.checkPurseEndings();
  assert.ok(f.s.over && f.s.over.id === 'oldbailey' && !f.s.over.win, 'lost to greed: the Old Bailey');
  var g = game(11);
  g.s.counts.purse = 6; g.s.counts.debt = 4;
  g.checkPurseEndings();
  assert.strictEqual(g.s.over.id, 'oldbailey', 'or the debt does it');
  var h = game(12);
  h.s.counts.purse = 3; h.s.stats.wrongful = 3;
  h.checkPurseEndings();
  assert.ok(!h.s.over, 'without the purse it is only bad work');
  // The weekly letter and the debt.
  var w = game(13);
  w.s.rank = 1; w.s.counts.debt = 2;
  var letters = 0, talk = 0;
  for (var i = 0; i < 30; i++) { var lines = w.purseWeek(); if (w.countOf('writsale')) { letters++; w.remove(byDef(w, 'writsale')[0]); } if (lines.some(function (l) { return /owes them/.test(l); })) talk++; }
  assert.ok(letters >= 1 && talk >= 5, 'letters ' + letters + ', talk ' + talk);
  console.log('endings: ok');
})();

console.log('purse: writ, thief-takers, blood money, endings all OK');
