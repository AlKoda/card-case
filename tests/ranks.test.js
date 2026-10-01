// Phases 16–17: ranks that change the game, and the precinct as a second board.
// Run: node tests/ranks.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

['js/util.js', 'js/i18n.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/data/structures.js', 'js/data/story.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/systems/informants.js', 'js/systems/criminals.js', 'js/systems/sentence.js', 'js/systems/purse.js', 'js/systems/origins.js', 'js/systems/coquille.js', 'js/systems/patrons.js', 'js/systems/societies.js', 'js/systems/network.js', 'js/systems/callings.js', 'js/systems/intro.js', 'js/systems/life.js', 'js/systems/growth.js', 'js/core/recipes.js', 'js/data/recipes.js'].forEach(function (f) {
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
  // The ladder is within reach: Standing 3, 7 and 12, the Seat at 18.
  assert.deepStrictEqual(CF.RANK_REP, [0, 3, 7, 12]);
  assert.strictEqual(CF.COMMISSIONER_REP, 18);
  // Standing comes from the Court: a conviction, someone Abroad put away, a sentence passed yourself on a case the city watched.
  var st = game(70);
  var sk = byDef(st, 'case')[0], srec = st.caseRec(sk.caseId);
  var alc = st.create('atlarge', { label: 'Abroad: X', data: { name: 'X', trait: 'limp' } });
  srec.atLargeUid = alc.uid;
  var rep0 = st.s.meters.reputation;
  st.onConviction(srec, { guilty: true, solid: false, name: 'X' }, []);
  assert.strictEqual(st.s.meters.reputation, rep0 + 1, 'someone Abroad put away is Standing');
  var cond = st.create('condemned', { data: { caseId: srec.id, template: srec.template, name: 'Y', trait: 'limp', guilty: true, custom: 'banish', highProfile: true, crimes: 1 } });
  rep0 = st.s.meters.reputation;
  st.passSentence(cond, 'banish', null, { quiet: true });
  assert.strictEqual(st.s.meters.reputation, rep0 + 1, 'a sentence passed yourself on a cried case is Standing');
  cond = st.create('condemned', { data: { caseId: srec.id, template: srec.template, name: 'Z', trait: 'limp', guilty: true, custom: 'banish', highProfile: true, crimes: 1 } });
  rep0 = st.s.meters.reputation;
  st.passSentence(cond, 'banish', null, { quiet: true, byCouncil: true });
  assert.strictEqual(st.s.meters.reputation, rep0, 'not when the Council said it for you');
  // Which verbs each rank brings.
  var byRank = {};
  Object.keys(CF.POWERS).forEach(function (v) { (byRank[CF.POWERS[v].rank] = byRank[CF.POWERS[v].rank] || []).push(v); });
  assert.deepStrictEqual(byRank[1], ['warrant']);
  assert.deepStrictEqual(byRank[2].sort(), ['delegate', 'stakeout', 'undercover']);
  assert.deepStrictEqual(byRank[3].sort(), ['majorcrimes', 'taskforce']);
  assert.strictEqual(CF.VERB_ORDER.length, 7, 'six verbs and the bell');

  var e = game(71);
  assert.strictEqual(e.maxOpenCases(), 2, 'an Examiner gets two cases at once');
  assert.ok(!e.powerOpen('warrant'), 'no Writ for an Examiner');
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
  assert.ok(e.powerOpen('warrant') && !e.powerOpen('stakeout'));
  assert.strictEqual(e.maxOpenCases(), 3);
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
  Object.keys(CF.POWERS).forEach(function (v) { assert.ok(e.powerOpen(v), v); });
  assert.strictEqual(e.maxOpenCases(), 4);
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
  e.s.rank = 2;
  var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
  var officer = e.create('teammate', e.teammateSpec('rookie'));
  var r = run(e, 'duty', [kase, officer]);
  assert.strictEqual(r.id, 'delegate_case');
  assert.ok(!e.card(officer.uid), 'the officer is out working');
  assert.ok(rec.delegate && rec.delegate.card.label === officer.label);
  var found0 = rec.found, clues0 = byDef(e, 'clue').length + byDef(e, 'evidence').length;
  e.tick(CF.DELEGATE_EVERY + 0.5);
  assert.strictEqual(rec.found, found0 + 1, 'something from the scene every half minute');
  assert.ok(byDef(e, 'clue').length + byDef(e, 'evidence').length > clues0);
  // Cannot delegate twice.
  e.autoSlot('duty', kase.uid); e.autoSlot('duty', e.create('teammate', e.teammateSpec('rookie')).uid);
  assert.ok(/already/.test(e.preview('duty').blocked));
  e.clearSlots('duty');
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
  e.s.rank = 3;
  var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
  var life = kase.life;
  var money = byDef(e, 'funds');
  var r = run(e, 'duty', [kase, byDef(e, 'focus')[0], money[0], money[1]]);
  assert.strictEqual(r.id, 'major_declare');
  assert.ok(rec.major && rec.highProfile);
  assert.ok(kase.life > life + 100, 'two more minutes');
  assert.ok(/^★/.test(e.labelOf(kase)));
  assert.ok(byDef(e, 'suspect').length >= 1 && byDef(e, 'witness').length >= 1);
  assert.strictEqual(byDef(e, 'funds').length, money.length - 2);
  e.autoSlot('duty', kase.uid); e.autoSlot('duty', (byDef(e, 'focus')[0] || e.create('focus')).uid);
  assert.ok(/already/.test(e.preview('duty').blocked));
  e.clearSlots('duty');
  // Focus the division on a district.
  var d = byDef(e, 'district')[0] || e.giveDistrict('market');
  r = run(e, 'duty', [d]);
  assert.strictEqual(r.id, 'major_focus');
  assert.ok(e.s.nextCase && e.s.nextCase.district === d.data.district && e.s.nextCase.extraTime === 60);
  assert.ok(e.s.dispatchT <= 30);
  var n = byDef(e, 'case').length;
  e.tick(31);
  var latest = byDef(e, 'case').filter(function (c) { return e.caseRec(c.caseId).district === d.data.district && c !== kase; })[0];
  assert.ok(byDef(e, 'case').length === n + 1 && latest, 'the next case came from there');
  assert.strictEqual(latest.maxLife, Math.round(CF.CASE_TEMPLATES[e.caseRec(latest.caseId).template].lifetime * e.caseClock()) + 60);
  console.log('major crimes: ok');
})();

// ---- The precinct ----------------------------------------------------------------
(function precinct() {
  CF.ROOM_ORDER.forEach(function (k) { assert.ok(CF.ROOMS[k] && CF.ORDERS[CF.ROOMS[k].order] && CF.ORDERS[CF.ROOMS[k].order].room === k, k); });
  var e = game(75);
  e.addOrdersForRank(0);
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
  h.s.rank = 2;
  var hk = byDef(h, 'case')[0], hr = h.caseRec(hk.caseId);
  var sc = h.revealSuspect(hr, null);
  h.autoSlot('investigate', sc.uid); h.autoSlot('investigate', byDef(h, 'instinct')[0].uid);
  var slow = h.preview('investigate').duration;
  h.s.rooms.survroom = true;
  assert.ok(h.preview('investigate').duration < slow / 1.5, 'half the night');
  h.clearSlots('investigate');

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
