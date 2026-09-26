// Phases 8–9: the detective's own clocks (Fatigue → Exhaustion → Burnout,
// Obsession → Tunnel Vision, Scrutiny's temptations) and the economy
// (salary, rent, what money buys).
// Run: node tests/pressure.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

['js/util.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/systems/informants.js', 'js/systems/criminals.js', 'js/core/recipes.js', 'js/data/recipes.js'].forEach(function (f) {
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
  var dur = e.verb(verb).duration;
  e.tick(dur + 0.01);
  var v = e.verb(verb), out = v.out.map(function (u) { return e.card(u); }), story = v.story;
  if (v.status === 'done') e.collect(verb);
  return { out: out, story: story, duration: dur, preview: pv };
}

// ---- Exhaustion slows the street verbs; Burnout closes them --------------------
(function exhaustion() {
  var e = game(1);
  var kase = byDef(e, 'case')[0];
  e.autoSlot('investigate', kase.uid);
  var fresh = e.preview('investigate').duration;
  e.clearSlots('investigate');
  e.create('fatigue');
  assert.ok(!e.exhausted());
  e.create('fatigue');
  assert.ok(e.exhausted(), 'two Fatigue is Exhaustion');
  e.autoSlot('investigate', kase.uid);
  var pv = e.preview('investigate');
  assert.ok(pv.duration > fresh, 'exhausted: ' + pv.duration + ' > ' + fresh);
  assert.ok(/exhausted/.test(pv.strain));
  e.clearSlots('investigate');
  e.autoSlot('analyze', e.create('evidence', { caseId: kase.caseId, data: { item: { key: 'x', needs: null, result: { label: 'R', text: '', aspects: { forensic: 1 } } } } }).uid);
  assert.ok(!e.preview('analyze').strain, 'desk work is unaffected');
  e.clearSlots('analyze');
  e.create('fatigue');
  e.checkThresholds();
  assert.strictEqual(e.countOf('burnout'), 1, 'three Fatigue is Burnout');
  assert.ok(e.lockReason('investigate'));
  assert.ok(!e.lockReason('analyze'));
  console.log('exhaustion: ok');
})();

// ---- Tunnel Vision: slower, and it cannot see a conflict --------------------------
(function tunnel() {
  var e = game(2);
  var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
  var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
  var innocent = rec.suspects.filter(function (x) { return !x.guilty; })[0];
  e.revealSuspect(rec, null, { key: innocent.key });
  var a = e.create('clue', { label: 'A', caseId: rec.id, aspects: { testimony: 2 }, data: { trait: culprit.trait } });
  var b = e.create('clue', { label: 'B', caseId: rec.id, aspects: { testimony: 2 }, data: { trait: innocent.trait } });
  // Clear-headed: two different people.
  var r = run(e, 'reflect', [a, b]);
  assert.strictEqual(r.story.title, 'Two Different People');
  var clear = r.duration;
  a = r.out[0]; b = r.out[1];
  // In Tunnel Vision the same two clues "identify" the suspect on the board.
  e.create('tunnel');
  r = run(e, 'reflect', [a, b]);
  assert.ok(r.duration > clear, 'tunnel vision is slower in Reflect');
  assert.ok(/^Confirmed Identification: /.test(e.labelOf(r.out[0])), e.labelOf(r.out[0]));
  assert.strictEqual(r.out[0].data.points, innocent.key, 'it lands on whoever is on the board');
  assert.ok(r.out[0].data.misread, 'and it is a misreading');
  assert.ok(!rec.identified, 'a misread identification does not mark a prime suspect');
  var sc = byDef(e, 'suspect')[0];
  var assess = e.assessCharge(sc, [r.out[0]]);
  assert.ok(assess.real < assess.apparent, 'the charge looks better than it is');
  console.log('tunnel vision: ok');
})();

// ---- Scrutiny's temptations: the illegal search is fast, and it costs -------------
(function temptation() {
  var e = game(3);
  var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
  var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
  var innocent = rec.suspects.filter(function (x) { return !x.guilty; })[0];
  var scG = e.revealSuspect(rec, null, { key: culprit.key });
  var scI = e.revealSuspect(rec, null, { key: innocent.key });
  e.s.rank = 1; e.s.verbs.warrant.unlocked = true;
  var r = run(e, 'investigate', [scG]);
  assert.strictEqual(e.verb('investigate').recipe, 'inv_illegal_search');
  var found = r.out.filter(function (c) { return c.def === 'clue'; })[0];
  assert.ok(found && found.data.illegal, 'the guilty man\'s shoebox');
  assert.strictEqual(e.s.meters.scrutiny, 1);
  // Faster than the legal way.
  e.autoSlot('warrant', scG.uid); e.autoSlot('warrant', found.uid);
  var legal = e.preview('warrant');
  assert.ok(legal.duration > r.duration, 'the warrant takes longer: ' + legal.duration + ' vs ' + r.duration);
  e.clearSlots('warrant');
  // Innocent: nothing, and a complaint.
  run(e, 'investigate', [scI]);
  assert.strictEqual(e.s.meters.scrutiny, 3);
  // In a charge it counts as illegal, and the court can exclude it.
  var a = e.assessCharge(scG, [found]);
  assert.strictEqual(a.illegal, 1);
  assert.strictEqual(a.unwarranted, 1);
  var excluded = 0, N = 80;
  for (var i = 0; i < N; i++) {
    var g = game(50 + i);
    var k = byDef(g, 'case')[0], rr = g.caseRec(k.caseId);
    var t = g.create('trial', { data: { caseId: rr.id, name: 'X', guilty: true, solid: true, tier: 'strong', real: 8, need: 6, coerced: 0, planted: 0, illegal: 1, contradictions: 0 } });
    var before = g.s.journal.length;
    g.verdict(t);
    if (g.s.journal.slice(0, g.s.journal.length - before).some(function (j) { return /no warrant/.test(j.text); })) excluded++;
  }
  assert.ok(excluded > N * 0.15 && excluded < N * 0.5, 'exclusion happens sometimes: ' + excluded + '/' + N);
  console.log('temptation: ok');
})();

// ---- Economy: salary, rent, conviction pay, money for yourself -------------------
(function economy() {
  var e = game(4);
  var before = byDef(e, 'funds').length;
  e.tick(CF.WEEK + 0.01);
  assert.strictEqual(byDef(e, 'funds').length, before + CF.ECONOMY.salary[0] - CF.ECONOMY.rent, 'week 1: salary in, rent out');
  assert.ok(e.s.journal.some(function (j) { return /Payday/.test(j.text); }));
  e.s.rank = 2;
  before = byDef(e, 'funds').length;
  e.tick(CF.WEEK);
  assert.strictEqual(byDef(e, 'funds').length, before + CF.ECONOMY.salary[2] - CF.ECONOMY.rent, 'a Chief earns more');
  // No money: no rent, and you sleep in the car.
  byDef(e, 'funds').forEach(function (c) { e.remove(c); });
  e.s.rank = 0;
  var fat = e.countOf('fatigue');
  // Salary lands first, so rent is only missed when salary cannot cover it.
  assert.ok(CF.ECONOMY.salary[0] >= CF.ECONOMY.rent, 'salary always covers rent for a working detective');

  // A paid rest is quicker.
  var g = game(5);
  var f1 = g.create('fatigue');
  g.autoSlot('reflect', f1.uid);
  var slow = g.preview('reflect').duration;
  var money = byDef(g, 'funds')[0];
  assert.ok(g.autoSlot('reflect', money.uid), 'Funds go in beside the Fatigue');
  var pv = g.preview('reflect');
  assert.ok(pv.duration < slow, 'paid: ' + pv.duration + ' < ' + slow);
  var nFunds = byDef(g, 'funds').length + 1;
  var r = run(g, 'reflect', []);
  assert.strictEqual(g.countOf('fatigue'), 0);
  assert.strictEqual(byDef(g, 'funds').length, nFunds - 1, 'one Funds spent');
  void r; void fat;

  // Convictions pay by tier.
  function payFor(tier, hp) {
    var h = game(6);
    var k = byDef(h, 'case')[0], rr = h.caseRec(k.caseId);
    rr.highProfile = hp;
    var n0 = byDef(h, 'funds').length;
    var t = h.create('trial', { data: { caseId: rr.id, name: 'X', guilty: true, solid: tier === 'strong', tier: tier, real: 9, need: 6, coerced: 0, planted: 0, illegal: 0, contradictions: 0 } });
    // Force a conviction by trying RNG states until the jury agrees.
    var saved = h.save();
    for (var i = 0; i < 20; i++) {
      var hh = CF.Engine.load(saved);
      hh.rng.setState(i * 101 + 7);
      hh.verdict(hh.card(t.uid));
      if (hh.caseRec(rr.id).status === 'closed') return byDef(hh, 'funds').length - n0 - (hh.s.calling === 'master' && byDef(hh, 'looseend').length ? 0 : 0);
    }
    throw new Error('never convicted');
  }
  assert.strictEqual(payFor('strong', false), CF.ECONOMY.convictionPay.strong);
  assert.strictEqual(payFor('reasonable', false), CF.ECONOMY.convictionPay.reasonable);
  assert.strictEqual(payFor('strong', true), CF.ECONOMY.convictionPay.strong + CF.ECONOMY.highProfilePay);
  assert.strictEqual(payFor('weak', false), 0);
  console.log('economy: ok');
})();
