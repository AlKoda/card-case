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
  // A Seat held by the vote is still the one Seat; a failed vote waits six weeks.
  c.s.meters.reputation = 30; c.s.meters.pressure = 6;
  var told = function () { return c.s.journal.filter(function (l) { return l.title === 'The Seat Is Empty'; }).length; };
  var empties = told();
  var vote = run(c, 'duty', [byDef(c, 'chair')[0]]);
  assert.strictEqual(vote.id, 'duty_chair');
  assert.strictEqual(told(), empties, 'no second Seat while the first is held');
  assert.ok(/another vote in six weeks/.test(vote.story.text), vote.story.text);
  assert.strictEqual(c.cardsOf('chair', true).length, 0, 'passed over: no Seat waiting');
  var cd = c.s.flags.chairCooldown;
  assert.ok(cd >= c.s.week + 5 && cd <= c.s.week + 6, 'six weeks from the vote: ' + cd + ' at week ' + c.s.week);
  c.checkThresholds();
  assert.strictEqual(c.cardsOf('chair', true).length, 0);
  c.s.week = cd - 1; c.checkThresholds();
  assert.strictEqual(c.cardsOf('chair', true).length, 0, 'not before six weeks');
  c.s.week = cd; c.checkThresholds();
  assert.strictEqual(c.cardsOf('chair', true).length, 1, 'six weeks on, another vote');
  assert.strictEqual(c.s.flags.chairCooldown, 0, 'the wait is over');
  // A Seat waiting in Attend's slot is still the one Seat.
  var seat = byDef(c, 'chair')[0];
  assert.ok(c.autoSlot('duty', seat.uid) && seat.loc.t === 'slot');
  c.checkThresholds();
  assert.strictEqual(c.cardsOf('chair', true).length, 1, 'one Seat, slotted or not');
  // The Council hears only an officer with the Standing for the Seat: Passed Over must earn it back first.
  c.s.meters.reputation = CF.COMMISSIONER_REP - 4;
  var pb = c.preview('duty');
  assert.ok(pb && pb.blocked === 'The Council hears only an officer of Standing ' + CF.COMMISSIONER_REP + '. You have ' + (CF.COMMISSIONER_REP - 4) + '.', 'the gap is named: ' + (pb && pb.blocked));
  assert.ok(!c.start('duty'), 'no vote without the Standing');
  c.s.meters.reputation = CF.COMMISSIONER_REP;
  assert.ok(!c.preview('duty').blocked, 'with it, the vote can be called');
  c.clearSlots('duty');
  // An older save never wrote the wait.
  var old = JSON.parse(c.save()); delete old.flags.chairCooldown;
  var lo = CF.Engine.load(old);
  assert.strictEqual(lo.s.flags.chairCooldown, 0);
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

  // The Belfry: every week, one case through each known front gets a token and a name.
  var b = game(79);
  b.s.rooms.survroom = true;
  var bf = b.newFront('the Tide Rats', 'docks'); bf.known = true;
  var bk = byDef(b, 'case')[0], br = b.caseRec(bk.caseId);
  br.front = bf.id;
  var seen = b.tableCards().filter(function (c) { return c.def === 'suspect'; }).length;
  var bl = b.belfryWeek();
  assert.deepStrictEqual(bl, ['From the Belfry: ' + br.title + '.']);
  var glass = b.tableCards().filter(function (c) { return c.def === 'clue' && c.label === 'Seen from the Belfry'; })[0];
  assert.ok(glass && glass.caseId === br.id && CF.clueAspects(glass).opportunity === 2 && CF.hasTag(glass, 'watching'), 'the belfry\'s token');
  assert.strictEqual(b.tableCards().filter(function (c) { return c.def === 'suspect'; }).length, seen + 1, 'and a name');
  assert.deepStrictEqual(b.belfryWeek(), [], 'once per case');
  assert.deepStrictEqual(game(79).belfryWeek(), [], 'nothing without a known front');

  // The Apothecary: the bench without the Key, and what the body says one point stronger.
  var a = game(80);
  var ak = byDef(a, 'case')[0], ar = a.caseRec(ak.caseId);
  var tok = a.create('clue', a.clueSpec(ar, { label: 'A Token', text: 'x', aspects: { financial: 1 } }, []));
  a.autoSlot('analyze', tok.uid);
  assert.strictEqual(a.currentRecipe('analyze').recipe.id, 'an_clue_none', 'no bench without the Key');
  a.clearSlots('analyze');
  a.s.rooms.lab = true;
  var er = run(a, 'analyze', [tok]);
  assert.strictEqual(er.id, 'an_enhance', 'the room is the Key');
  assert.strictEqual(CF.clueAspects(tok).financial, 2);
  var bio = { type: 'evidence', label: 'Threads', text: 'x', needs: 'bio', result: { label: 'The Threads Matched', text: 'x', aspects: { forensic: 2 } } };
  var ev = a.create('evidence', { label: bio.label, desc: bio.text, caseId: ar.id, data: { item: bio } });
  run(a, 'analyze', [ev]);
  var read = a.tableCards().filter(function (c) { return c.label === 'The Threads Matched'; })[0];
  assert.strictEqual(CF.clueAspects(read).forensic, 3, 'the body reads one point stronger');
  var a2 = game(80); a2.s.rooms.lab = true;
  var ar2 = a2.caseRec(byDef(a2, 'case')[0].caseId);
  var doc = { type: 'evidence', label: 'A Day-Book', text: 'x', needs: 'lab', result: { label: 'The Leaves Parted', text: 'x', aspects: { financial: 2 } } };
  run(a2, 'analyze', [a2.create('evidence', { label: doc.label, desc: doc.text, caseId: ar2.id, data: { item: doc } })]);
  assert.strictEqual(CF.clueAspects(a2.tableCards().filter(function (c) { return c.label === 'The Leaves Parted'; })[0]).forensic || 0, 0, 'paper does not');
  console.log('precinct: ok');
})();

// ---- The Seat told truly: the man chosen instead has a name; the Hangman's door is said aloud ----
(function seatAndCap() {
  var c = game(74, 'commissioner');
  c.s.meters.reputation = 30; c.s.rank = CF.TOP_RANK; c.checkThresholds();
  var seats = function () { return c.s.journal.filter(function (l) { return l.title === 'The Seat Is Empty'; }); };
  assert.ok(/dead of a stone/.test(seats()[0].text), 'the first Seat: a death');
  c.s.meters.pressure = 6;
  var vote = run(c, 'duty', [byDef(c, 'chair')[0]]);
  var chosen = c.s.flags.burgomaster;
  assert.ok(chosen && vote.story.text.indexOf('chooses ' + chosen + ' of the Hill') > 0, 'the Council\'s choice is named: ' + vote.story.text);
  c.s.week = c.s.flags.chairCooldown; c.checkThresholds();
  var second = seats()[0];
  assert.ok(seats().length === 2 && !/dead of a stone/.test(second.text) && second.text.indexOf(chosen + ' has lasted a season') === 0, 'the second Seat is his: ' + second.text);
  // An older save that had already told the Seat does not bury the Burgomaster twice.
  var old = JSON.parse(c.save()); delete old.flags.seatTold; delete old.flags.burgomaster;
  var lo = CF.Engine.load(old);
  assert.strictEqual(lo.s.flags.seatTold, true, 'a Seat on the table: told');
  var fresh = JSON.parse(game(75, 'commissioner').save()); delete fresh.flags.seatTold;
  assert.strictEqual(CF.Engine.load(fresh).s.flags.seatTold, false);
  // The Hangman at Bailiff with the Standing for Magistrate: told once.
  var h = CF.Engine.newGame({ seed: 76, calling: 'master', who: 'hangman' });
  h.s.rank = h.rankCap(); h.s.meters.reputation = CF.RANK_REP[h.rankCap() + 1];
  h.checkThresholds(); h.checkThresholds();
  var cap = h.s.journal.filter(function (l) { return l.title === 'The Letter That Will Not Come'; });
  assert.strictEqual(cap.length, 1, 'told once');
  assert.ok(/Bailiff is as high as the Ravenstone reaches/.test(cap[0].text), cap[0].text);
  var w = CF.Engine.newGame({ seed: 77, calling: 'master', who: 'watchman' });
  w.s.rank = 2; w.s.meters.reputation = CF.RANK_REP[3]; w.checkThresholds();
  assert.ok(!w.s.journal.some(function (l) { return l.title === 'The Letter That Will Not Come'; }), 'only for the shut door');
  // Deputise counts in the city's days.
  var dp = CF.RECIPES_BY_ID.delegate_case.preview;
  var txt = typeof dp === 'function' ? dp({ caseOf: function () { return null; }, primary: null }) : dp;
  assert.ok(new RegExp('every ' + CF.daysLeft(CF.DELEGATE_EVERY) + ' days').test(txt) && !/minute/.test(txt), txt);
  console.log('seat and cap: ok');
})();
