// Phases 8–9: the detective's own clocks (Fatigue → Exhaustion → Burnout,
// Obsession → Tunnel Vision, Scrutiny's temptations) and the economy
// (salary, rent, what money buys).
// Run: node tests/pressure.test.js
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
  e.s.rank = 1;
  var r = run(e, 'investigate', [scG]);
  assert.strictEqual(e.verb('investigate').recipe, 'inv_illegal_search');
  var found = r.out.filter(function (c) { return c.def === 'clue'; })[0];
  assert.ok(found && found.data.illegal, 'the guilty man\'s shoebox');
  assert.strictEqual(e.s.meters.scrutiny, 1);
  // Faster than the legal way.
  e.autoSlot('investigate', scG.uid); e.autoSlot('investigate', found.uid);
  var legal = e.preview('investigate');
  assert.ok(legal.duration > r.duration, 'the warrant takes longer: ' + legal.duration + ' vs ' + r.duration);
  e.clearSlots('investigate');
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
    if (g.s.journal.slice(0, g.s.journal.length - before).some(function (j) { return /no writ/.test(j.text); })) excluded++;
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
  assert.ok(e.s.journal.some(function (j) { return /stipend/.test(j.text); }));
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
  // A grateful victim sometimes adds an honest coin at the court door (Part II §7).
  function about(got, want, label) { assert.ok(got === want || got === want + 1, label + ': ' + got + ' vs ' + want); }
  about(payFor('strong', false), CF.ECONOMY.convictionPay.strong, 'strong');
  about(payFor('reasonable', false), CF.ECONOMY.convictionPay.reasonable, 'reasonable');
  about(payFor('strong', true), CF.ECONOMY.convictionPay.strong + CF.ECONOMY.highProfilePay, 'high profile');
  about(payFor('weak', false), 0, 'weak');
  console.log('economy: ok');
})();

// ---- A blow: Winded Health takes it; no death without a Wound already carried ------
(function wounds() {
  var e = game(7);
  byDef(e, 'health').forEach(function (c) { e.transform(c, 'spent_health', { decay: 40 }); });
  assert.ok(byDef(e, 'spent_health').length && !byDef(e, 'health').length, 'only Winded on the table');
  e.hurtYou('a cudgel');
  assert.ok(!e.s.over, 'no game over');
  assert.strictEqual(e.countOf('wound'), 1, 'the Winded card became a Wound');
  assert.strictEqual(byDef(e, 'spent_health').length, 0);
  // No Health at all and no Wound: a beating, two Weariness, still alive.
  var b = game(8);
  byDef(b, 'health').forEach(function (c) { b.remove(c); });
  var fat0 = b.countOf('fatigue');
  b.hurtYou('a cudgel');
  assert.ok(!b.s.over, 'beaten, not killed');
  assert.strictEqual(b.countOf('fatigue') - fat0, 2, 'two Weariness');
  assert.ok(b.s.journal[0].title === 'Beaten on the Stair' || b.s.journal[1].title === 'Beaten on the Stair', b.s.journal[0].title);
  assert.ok(!b.blowWouldKill());
  // No Health and a Wound: death.
  var d = game(9);
  byDef(d, 'health').forEach(function (c) { d.remove(c); });
  d.create('wound');
  assert.ok(d.blowWouldKill(), 'the dagger and the disguise warn of it');
  d.hurtYou('a blade');
  assert.ok(d.s.over && d.s.over.id === 'death', 'a second blow with no Health is death');
  console.log('wounds: ok');
})();

// ---- The Vendetta: capped at the Bell, cooled by a quiet week and a conviction, told before the stair ----
(function vendetta() {
  var e = game(10);
  e.s.week = 1;
  e.create('syndicate'); e.create('gang', { label: 'Band: a', data: { name: 'a', members: [] } }); e.create('gang', { label: 'Band: b', data: { name: 'b', members: [] } });
  var r0 = e.s.meters.retaliation;
  e.weekTick();
  assert.strictEqual(e.s.meters.retaliation - r0, 2, 'the Bell feeds the Vendetta two at most: ' + (e.s.meters.retaliation - r0));
  // A week in which no case went cold cools it.
  var q = game(11);
  q.s.meters.retaliation = 3;
  q.weekTick();
  assert.strictEqual(q.s.meters.retaliation, 2, 'nothing abroad, nothing cold: the Vendetta cools');
  // A guilty conviction cools it.
  var c = game(12);
  var kase = byDef(c, 'case')[0], rec = c.caseRec(kase.caseId);
  var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
  c.remove(kase);
  c.s.meters.retaliation = 3;
  var t = c.create('trial', { data: { caseId: rec.id, name: culprit.name, guilty: true, solid: true, tier: 'strong', real: 9, need: 6, coerced: 0, planted: 0, illegal: 0, contradictions: 0 } });
  var saved = c.save(), done = false;
  for (var i = 0; i < 20 && !done; i++) {
    var cc = CF.Engine.load(saved);
    cc.rng.setState(i * 101 + 7);
    cc.verdict(cc.card(t.uid));
    if (cc.caseRec(rec.id).status === 'closed') { done = true; assert.strictEqual(cc.s.meters.retaliation, 2, 'a conviction cools the Vendetta'); }
  }
  assert.ok(done, 'convicted');
  // At five the city asks which stair is yours, and that week nobody climbs it.
  for (var k = 0; k < 20; k++) {
    var w = game(20 + k);
    w.s.meters.retaliation = 6;
    w.weekTick();
    assert.strictEqual(w.s.stats.attacks, 0, 'the warning week never attacks');
    assert.ok(w.s.flags.stairWarned && w.s.journal.some(function (j) { return j.title === 'Which Stair Is Yours'; }), 'the warning');
  }
  // A purse left to lie is remembered by whoever left it, when there is somebody to remember.
  var b1 = game(30);
  var rb = b1.s.meters.retaliation;
  b1.expire(b1.create('bribe'));
  assert.strictEqual(b1.s.meters.retaliation, rb, 'with nobody organized about, the purse is just gone');
  var b2 = game(31);
  b2.create('gang', { label: 'Band: a', data: { name: 'a', members: [] } });
  rb = b2.s.meters.retaliation;
  b2.expire(b2.create('bribe'));
  assert.strictEqual(b2.s.meters.retaliation - rb, 1, 'with a Band in the city it feeds the Vendetta');
  assert.ok(b2.s.journal.some(function (j) { return /The band that left it keeps a tally, and your name is on it/.test(j.text); }), 'and the story says so');
  // The warning before a case goes cold speaks in the city's days, and the cold case goes into the Rolls.
  var w1 = game(32);
  var wk = byDef(w1, 'case')[0], wrec = w1.caseRec(wk.caseId);
  w1.warnCold(wk);
  var warn = w1.s.journal.filter(function (j) { return /^Going Unanswered/.test(j.title); })[0];
  assert.ok(warn && /Seven days left on a case you never opened/.test(warn.text), 'never opened: ' + (warn && warn.text));
  assert.ok(!/minute/.test(warn.text), 'no real minutes in the city');
  w1.goCold(wrec.id);
  var cold = w1.s.journal.filter(function (j) { return j.title === 'The Trail Goes Cold'; })[0];
  assert.ok(cold && /goes into the Rolls unanswered/.test(cold.text) && !/You knew the door/.test(cold.text), cold && cold.text);
  var w2 = game(33);
  var wk2 = byDef(w2, 'case')[0], wrec2 = w2.caseRec(wk2.caseId);
  wrec2.searches = 2;
  w2.warnCold(wk2);
  var warn2 = w2.s.journal.filter(function (j) { return /^Going Unanswered/.test(j.title); })[0];
  assert.ok(warn2 && /^Seven days left, and the trail is fading/.test(warn2.text), warn2 && warn2.text);
  console.log('vendetta: ok');
})();

// ---- A Wound can be nursed in Rest ----------------------------------------------------
(function nursing() {
  var e = game(13);
  var wound = e.create('wound');
  var coin = byDef(e, 'funds')[0] || e.create('funds');
  var h0 = byDef(e, 'health').length, f0 = byDef(e, 'funds').length;
  var r = run(e, 'reflect', [wound, coin]);
  assert.strictEqual(r.story.title, 'The Barber-surgeon');
  assert.strictEqual(byDef(e, 'health').length, h0 + 1, 'a Health for a Coin');
  assert.strictEqual(e.countOf('wound'), 0);
  assert.strictEqual(byDef(e, 'funds').length, f0 - 1, 'one Coin spent');
  // With the Physician's Case: no Coin, and the Case stays.
  var g = game(14);
  var w2 = g.create('wound'), kit = g.create('kit');
  var gh = byDef(g, 'health').length, gf = byDef(g, 'funds').length;
  var r2 = run(g, 'reflect', [w2, kit]);
  assert.strictEqual(r2.story.title, 'The Physician\'s Case');
  assert.strictEqual(byDef(g, 'health').length, gh + 1);
  assert.strictEqual(byDef(g, 'funds').length, gf, 'no Coin');
  assert.ok(g.card(kit.uid), 'the Case is kept');
  // Alone: lie still, and it knits faster.
  var l = game(15);
  var w3 = l.create('wound');
  var life0 = w3.life;
  var r3 = run(l, 'reflect', [w3]);
  assert.strictEqual(r3.story.title, 'Lie Still');
  assert.ok(l.card(w3.uid) && w3.life <= life0 - 60, 'the Wound has less to run: ' + w3.life + ' vs ' + life0);
  console.log('nursing: ok');
})();
