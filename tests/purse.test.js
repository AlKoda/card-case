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

['js/util.js', 'js/i18n.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/data/structures.js', 'js/data/story.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/systems/informants.js', 'js/systems/criminals.js', 'js/systems/sentence.js', 'js/systems/purse.js', 'js/systems/origins.js', 'js/systems/coquille.js', 'js/systems/patrons.js', 'js/systems/societies.js', 'js/systems/network.js', 'js/systems/callings.js', 'js/systems/intro.js', 'js/systems/life.js', 'js/systems/growth.js', 'js/core/recipes.js', 'js/data/recipes.js'].forEach(function (f) {
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
  // The Thief-taker General is a road: a Magistrate, a name in the chamber, the thief-takers'
  // settlements walked twice. The old counts (Purse 6 and a Bailiff) no longer make one.
  var old = game(8);
  old.s.counts.purse = 6; old.s.stats.wrongful = 1; old.s.meters.reputation = 7; old.s.rank = 2;
  old.checkPurseEndings(); old.checkPurseEndings();
  assert.ok(!old.s.over && !old.s.flags.thieftakerWarned, 'six purses and a Bailiff are not the General');
  var e = game(9);
  e.s.counts.purse = 9; e.s.stats.wrongful = 1; e.s.meters.reputation = 12; e.s.rank = 3; e.s.stats.settled = 1;
  e.checkPurseEndings();
  assert.ok(!e.s.over && !e.s.flags.thieftakerWarned, 'the road has to be walked: two settlements');
  e.s.stats.settled = 2;
  e.checkPurseEndings();
  assert.ok(!e.s.over && e.s.flags.thieftakerWarned, 'told a week before it lands');
  assert.ok(e.s.journal.some(function (j) { return /call you General/.test(j.text); }), 'the fences call you General');
  e.checkPurseEndings();
  assert.ok(e.s.over && e.s.over.id === 'thieftaker' && e.s.over.win, 'corrupt and working: the Thief-taker General');
  // Warned, and the counts no longer hold: no ending.
  var e2 = game(14);
  e2.s.counts.purse = 9; e2.s.stats.wrongful = 1; e2.s.meters.reputation = 12; e2.s.rank = 3; e2.s.stats.settled = 2;
  e2.checkPurseEndings();
  e2.s.stats.wrongful = 2;
  e2.checkPurseEndings();
  assert.ok(!e2.s.over, 'the ending waits on the counts still holding');
  // The Old Bailey is told first too (the Brother's Ledger), and lands on a later Bell.
  var f = game(10);
  f.s.counts.purse = 6; f.s.stats.wrongful = 3;
  f.checkPurseEndings();
  assert.ok(!f.s.over && f.s.flags.oldbaileyWarned && f.s.journal[0].title === 'The Brother\'s Ledger', 'the Old Bailey is told before it lands');
  // Told already past the counts, the warning still holds: nothing done, nothing lands (check-up; this
  // test once ended the run at the next check with no step taken, against what the warning says).
  f.checkPurseEndings(); f.checkPurseEndings();
  assert.ok(!f.s.over, 'past the counts when told: another step is still needed');
  f.s.counts.purse = 7;
  f.checkPurseEndings();
  assert.ok(f.s.over && f.s.over.id === 'oldbailey' && !f.s.over.win, 'lost to greed: the Old Bailey');
  var g = game(11);
  g.s.counts.purse = 6; g.s.counts.debt = 4;
  g.checkPurseEndings(); g.checkPurseEndings();
  assert.ok(!g.s.over, 'the debt past the line when told: still a step to refuse');
  g.s.counts.debt = 5; g.checkPurseEndings();
  assert.strictEqual(g.s.over.id, 'oldbailey', 'or the debt does it');
  // A save warned before the steps were kept: the next step after loading ends it, none before.
  var og = game(18); og.s.counts.purse = 6; og.s.stats.wrongful = 3; og.s.flags.oldbaileyWarned = true;
  var ogs = JSON.parse(og.save()); delete ogs.flags.oldbaileySteps;
  var ol = CF.Engine.load(JSON.stringify(ogs));
  ol.checkPurseEndings();
  assert.ok(!ol.s.over, 'an older warned save is not ended with no step taken');
  ol.s.stats.wrongful = 4; ol.checkPurseEndings();
  assert.strictEqual(ol.s.over && ol.s.over.id, 'oldbailey', 'and a step after it lands');
  // A step short (a debt away): told while it can still be refused, and the refusal holds.
  var near = game(15);
  near.s.counts.purse = 6; near.s.counts.debt = 3;
  near.checkPurseEndings();
  assert.ok(!near.s.over && near.s.flags.oldbaileyWarned, 'one step short: the warning');
  assert.ok(/Another purse, another wrong name or another debt to the thief-takers/.test(near.s.journal[0].text), 'it says what to refuse: ' + near.s.journal[0].text);
  near.checkPurseEndings(); near.checkPurseEndings();
  assert.ok(!near.s.over, 'refused, the Old Bailey does not come');
  near.s.counts.debt = 4;
  near.checkPurseEndings();
  assert.strictEqual(near.s.over && near.s.over.id, 'oldbailey', 'one more debt after the warning, and it lands');
  var far = game(17);
  far.s.counts.purse = 4; far.s.counts.debt = 3;
  far.checkPurseEndings();
  assert.ok(!far.s.flags.oldbaileyWarned, 'two purses short: no warning yet');
  // An older save starts with no warning given.
  var ob = JSON.parse(game(16).save()); delete ob.flags.oldbaileyWarned;
  assert.strictEqual(CF.Engine.load(ob).s.flags.oldbaileyWarned, false, 'an older save: no warning yet');
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

// ---- The upright man's Coin comes every week, while his band stands -------------------
(function upright() {
  var e = game(71);
  var band = e.create('gang', { label: 'Band: The Lamplighters', data: { name: 'the Lamplighters', members: [] } });
  e.s.meters.retaliation = 5;
  var coin0 = e.countOf('funds'), purse0 = e.s.counts.purse || 0;
  assert.strictEqual(e.takeUpright(), 'the Lamplighters');
  assert.strictEqual(e.countOf('funds'), coin0 + 1, 'a Coin now');
  assert.strictEqual(e.s.counts.purse, purse0 + 1, 'Purse +1');
  assert.strictEqual(e.s.meters.retaliation, 2, 'Vendetta eases');
  assert.strictEqual(e.s.flags.uprightPaid, 'the Lamplighters');
  var c1 = e.countOf('funds'), p1 = e.s.counts.purse;
  var weeks = 4, lines = [];
  for (var w = 0; w < weeks; w++) { e.s.week++; lines = lines.concat(e.uprightWeek()); }
  assert.strictEqual(e.countOf('funds'), c1 + weeks, 'a Coin every week');
  assert.strictEqual(e.s.counts.purse, p1 + weeks / 2, 'Purse every other week');
  assert.strictEqual(lines.filter(function (l) { return /brings the week's Coin/.test(l); }).length, weeks);
  // Broken by your Court: the boy does not come, and says why.
  var saved = e.save();
  e.s.flags.uprightBroken = true; e.remove(band);
  var l2 = e.uprightWeek();
  assert.ok(/His upright man is in the Hole/.test(l2[0]) && e.s.flags.uprightPaid === null, 'the Hole: ' + l2);
  assert.deepStrictEqual(e.uprightWeek(), [], 'and says so once');
  // Sworn to the Coquille: the boy does not come either.
  var f = CF.Engine.load(saved);
  f.remove(f.cardsOf('gang', true)[0]);
  assert.ok(/answers to the Coquille/.test(f.uprightWeek()[0]));
  // The Bell pays it.
  var g = CF.Engine.load(saved);
  g.weekTick();
  assert.ok(g.s.journal.some(function (j) { return /brings the week's Coin/.test(j.text); }), 'the Bell brings the boy');
  // A save from before: no Coin owed.
  var old = JSON.parse(saved); delete old.flags.uprightPaid; delete old.flags.uprightBroken;
  var o = CF.Engine.load(old);
  assert.strictEqual(o.s.flags.uprightPaid, null);
  assert.strictEqual(o.s.flags.uprightBroken, false);
  assert.deepStrictEqual(o.uprightWeek(), []);
  console.log('upright: ok');
})();

// ---- The purse's note names one of your cases; who left it may be of the Hill ---------
(function purseNote() {
  var e = game(72);
  var rec = e.openCases()[0];
  var n = e.purseNote();
  assert.ok(n && n.caseId === rec.id && n.title === rec.title, 'the note names an open case');
  rec.suspects[0].role = 'a gentleman of the Hill in debt';
  var card = e.purseSender(rec.id);
  assert.ok(card && card.def === 'suspect' && card.data.key === rec.suspects[0].key, 'a suspect of the Hill, revealed');
  assert.strictEqual(e.purseSender(rec.id).uid, card.uid, 'the same card, not a second');
  rec.suspects.forEach(function (x) { x.role = 'a porter of the Market'; });
  assert.strictEqual(e.purseSender(rec.id), null, 'nobody of the Hill: the informer instead');
  e.openCases().forEach(function (r) { r.status = 'closed'; });
  assert.strictEqual(e.purseNote(), null, 'no case open, no name on the note');
  console.log('purse note: ok');
})();

console.log('purse: writ, thief-takers, blood money, endings all OK');
