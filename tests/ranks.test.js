// Phases 16–17: ranks that change the game, and the precinct as a second board.
// Run: node tests/ranks.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

['js/util.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/data/structures.js', 'js/data/story.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/systems/informants.js', 'js/systems/criminals.js', 'js/systems/network.js', 'js/systems/callings.js', 'js/systems/intro.js', 'js/core/recipes.js', 'js/data/recipes.js'].forEach(function (f) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), { filename: f });
});
// The precinct board logic lives with the screens; load it without a DOM.
var screens = fs.readFileSync(path.join(__dirname, '..', 'js/screens.js'), 'utf8');
var start = screens.indexOf('  var Precinct = (CF.Precinct = {});'), end = screens.indexOf('  Precinct.open = function');
vm.runInThisContext('(function () { var CF = globalThis.CF;\n' + screens.slice(start, end) + '})();', { filename: 'js/screens.js (precinct)' });
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
  assert.ok(!e.s.over, 'the game ended: ' + (e.s.over && e.s.over.title));
  var v = e.verb(verb), out = v.out.map(function (u) { return e.card(u); }), story = v.story, id = v.recipe;
  if (v.status === 'done') e.collect(verb);
  return { out: out, story: story, id: id };
}

// ---- Ranks ----------------------------------------------------------------------
(function ranks() {
  assert.strictEqual(CF.RANK_DEFS.length, 4);
  assert.deepStrictEqual(CF.RANKS, ['Examiner', 'Sworn Examiner', 'Bailiff', 'Magistrate']);
  for (var i = 1; i < CF.RANK_DEFS.length; i++) {
    assert.ok(CF.RANK_DEFS[i].rep > CF.RANK_DEFS[i - 1].rep && CF.RANK_DEFS[i].salary > CF.RANK_DEFS[i - 1].salary, 'ranks climb');
  }
  // Which verbs each rank brings.
  var byRank = {};
  CF.VERB_ORDER.forEach(function (v) { (byRank[CF.VERBS[v].rank] = byRank[CF.VERBS[v].rank] || []).push(v); });
  assert.deepStrictEqual(byRank[1], ['warrant']);
  assert.deepStrictEqual(byRank[2].sort(), ['delegate', 'stakeout', 'undercover']);
  assert.deepStrictEqual(byRank[3].sort(), ['majorcrimes', 'taskforce']);

  var e = game(71);
  assert.strictEqual(e.maxOpenCases(), 3, 'a Detective gets three cases at once');
  assert.ok(!e.verb('warrant').unlocked);
  // Reputation convenes a board; attending it promotes.
  e.s.meters.reputation = CF.RANK_REP[1];
  e.checkThresholds();
  var board = byDef(e, 'promotion')[0];
  assert.ok(board && board.data.rank === 1 && /Sworn Examiner/.test(e.labelOf(board)));
  e.checkThresholds();
  assert.strictEqual(byDef(e, 'promotion').length, 1, 'one board at a time');
  var r = run(e, 'duty', [board]);
  assert.strictEqual(r.id, 'duty_promo');
  assert.strictEqual(e.s.rank, 1);
  assert.ok(e.verb('warrant').unlocked && !e.verb('stakeout').unlocked);
  assert.strictEqual(e.maxOpenCases(), 4);
  assert.ok(byDef(e, 'personnel').length >= 1, 'a file to hire comes with the promotion');
  assert.ok(byDef(e, 'order').some(function (c) { return c.data.order === 'suite'; }), 'new requisitions arrive');
  // Salary follows rank.
  var funds = byDef(e, 'funds').length;
  e.tick(CF.WEEK - e.s.weekT + 0.01);
  assert.strictEqual(byDef(e, 'funds').length, funds + CF.RANK_DEFS[1].salary - CF.ECONOMY.rent);
  // All the way up.
  while (e.s.rank < CF.TOP_RANK) {
    e.s.meters.reputation = CF.RANK_REP[e.s.rank + 1];
    e.checkThresholds();
    run(e, 'duty', [byDef(e, 'promotion')[0]]);
  }
  assert.strictEqual(e.s.rank, 3);
  ['stakeout', 'delegate', 'undercover', 'taskforce', 'majorcrimes'].forEach(function (v) { assert.ok(e.verb(v).unlocked, v); });
  assert.strictEqual(e.maxOpenCases(), 5);
  e.s.meters.reputation = 30;
  e.checkThresholds();
  assert.strictEqual(byDef(e, 'promotion').length, 0, 'no board past the top rank');
  // The Commissioner's chair waits for the top rank.
  var c = game(72, 'commissioner');
  c.s.meters.reputation = CF.COMMISSIONER_REP; c.s.rank = 2;
  c.checkThresholds();
  assert.strictEqual(c.countOf('chair'), 0);
  c.s.rank = 3; c.checkThresholds();
  assert.strictEqual(c.countOf('chair'), 1);
  console.log('ranks: ok');
})();

// ---- Delegate: an officer works a case in parallel -------------------------------
(function delegate() {
  var e = game(73);
  e.s.rank = 2; e.s.verbs.delegate.unlocked = true;
  var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
  var officer = e.create('teammate', e.teammateSpec('rookie'));
  var r = run(e, 'delegate', [kase, officer]);
  assert.strictEqual(r.id, 'delegate_case');
  assert.ok(!e.card(officer.uid), 'the officer is out working');
  assert.ok(rec.delegate && rec.delegate.card.label === officer.label);
  var found0 = rec.found, clues0 = byDef(e, 'clue').length + byDef(e, 'evidence').length;
  e.tick(CF.DELEGATE_EVERY + 0.5);
  assert.strictEqual(rec.found, found0 + 1, 'something from the scene every half minute');
  assert.ok(byDef(e, 'clue').length + byDef(e, 'evidence').length > clues0);
  // Cannot delegate twice.
  e.autoSlot('delegate', kase.uid); e.autoSlot('delegate', e.create('teammate', e.teammateSpec('rookie')).uid);
  assert.ok(/already/.test(e.preview('delegate').blocked));
  e.clearSlots('delegate');
  // The officer comes back when the case closes.
  var team = byDef(e, 'teammate').length;
  kase.life = 0.1; e.tick(1);
  assert.strictEqual(rec.status, 'cold');
  assert.ok(!rec.delegate);
  assert.strictEqual(byDef(e, 'teammate').length, team + 1, 'back at their desk');
  console.log('delegate: ok');
})();

// ---- Major Crimes ------------------------------------------------------------------
(function major() {
  var e = game(74);
  e.s.rank = 3; e.s.verbs.majorcrimes.unlocked = true;
  var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
  var life = kase.life;
  var money = byDef(e, 'funds');
  var r = run(e, 'majorcrimes', [kase, money[0], money[1]]);
  assert.strictEqual(r.id, 'major_declare');
  assert.ok(rec.major && rec.highProfile);
  assert.ok(kase.life > life + 100, 'two more minutes');
  assert.ok(/^★/.test(e.labelOf(kase)));
  assert.ok(byDef(e, 'suspect').length >= 1 && byDef(e, 'witness').length >= 1);
  assert.strictEqual(byDef(e, 'funds').length, money.length - 2);
  e.autoSlot('majorcrimes', kase.uid);
  assert.ok(/already/.test(e.preview('majorcrimes').blocked));
  e.clearSlots('majorcrimes');
  // Focus the division on a district.
  var d = byDef(e, 'district')[0];
  r = run(e, 'majorcrimes', [d]);
  assert.strictEqual(r.id, 'major_focus');
  assert.ok(e.s.nextCase && e.s.nextCase.district === d.data.district && e.s.nextCase.extraTime === 60);
  assert.ok(e.s.dispatchT <= 30);
  var n = byDef(e, 'case').length;
  e.tick(31);
  var latest = byDef(e, 'case').filter(function (c) { return e.caseRec(c.caseId).district === d.data.district && c !== kase; })[0];
  assert.ok(byDef(e, 'case').length === n + 1 && latest, 'the next case came from there');
  assert.strictEqual(latest.maxLife, CF.CASE_TEMPLATES[e.caseRec(latest.caseId).template].lifetime + 60);
  console.log('major crimes: ok');
})();

// ---- The precinct ----------------------------------------------------------------
(function precinct() {
  CF.ROOM_ORDER.forEach(function (k) { assert.ok(CF.ROOMS[k] && CF.ORDERS[CF.ROOMS[k].order] && CF.ORDERS[CF.ROOMS[k].order].room === k, k); });
  var e = game(75);
  var tiles = CF.Precinct.tiles(e);
  assert.strictEqual(tiles.length, CF.ROOM_ORDER.length);
  var byKey = {}; tiles.forEach(function (t) { byKey[t.key] = t; });
  assert.strictEqual(byKey.locker.state, 'ordered', 'the locker form starts on the table');
  assert.strictEqual(byKey.suite.state, 'locked');
  assert.strictEqual(byKey.lab.state, 'locked');
  e.s.rank = 2;
  byKey = {}; CF.Precinct.tiles(e).forEach(function (t) { byKey[t.key] = t; });
  assert.strictEqual(byKey.intel.state, 'open');
  assert.ok(CF.Precinct.order(e, 'intel'));
  assert.ok(!CF.Precinct.order(e, 'intel'), 'only one form at a time');
  assert.strictEqual(CF.Precinct.tiles(e).filter(function (t) { return t.key === 'intel'; })[0].state, 'ordered');
  e.s.rooms.intel = true;
  assert.strictEqual(CF.Precinct.tiles(e).filter(function (t) { return t.key === 'intel'; })[0].state, 'owned');

  // Intelligence Office: a linked clue reveals its front at once.
  var g = game(76);
  g.s.rooms.intel = true;
  var f = g.newFront('the Tide Rats', 'docks');
  var kase = byDef(g, 'case')[0], rec = g.caseRec(kase.caseId);
  g.create('clue', g.clueSpec(rec, g.linkItem(f), []));
  assert.ok(!f.known);
  g.tick(0.1);
  assert.ok(f.known && byDef(g, 'front').length === 1, 'the office names the address');

  // Surveillance Room: stakeouts take half the night.
  var h = game(77);
  h.s.rank = 2; h.s.verbs.stakeout.unlocked = true;
  var hk = byDef(h, 'case')[0], hr = h.caseRec(hk.caseId);
  var sc = h.revealSuspect(hr, null);
  h.autoSlot('stakeout', sc.uid); h.autoSlot('stakeout', byDef(h, 'instinct')[0].uid);
  var slow = h.preview('stakeout').duration;
  h.s.rooms.survroom = true;
  assert.ok(h.preview('stakeout').duration < slow / 1.5, 'half the night');
  h.clearSlots('stakeout');

  // Training Room: cheaper, and a new trait at level 3.
  var t = game(78);
  var officer = t.create('teammate', t.teammateSpec('rookie'));
  officer.data.traits = ['steady']; officer.data.level = 2;
  t.autoSlot('duty', officer.uid); t.autoSlot('duty', byDef(t, 'funds')[0].uid);
  assert.ok(/Needs 2 Funds/.test(t.preview('duty').blocked || ''), 'two Funds without the room: ' + JSON.stringify(t.preview('duty')));
  t.clearSlots('duty');
  t.s.rooms.training = true;
  t.autoSlot('duty', officer.uid); t.autoSlot('duty', byDef(t, 'funds')[0].uid);
  assert.strictEqual(t.preview('duty').label, 'Drill a Watchman');
  assert.ok(!t.preview('duty').blocked, 'one Fund with the room');
  var tr = run(t, 'duty', []);
  assert.strictEqual(tr.id, 'duty_train');
  assert.strictEqual(officer.data.level, 3);
  assert.strictEqual(officer.data.traits.length, 2, 'a new trait at level 3');
  console.log('precinct: ok');
})();
