// Part II, Phase B: the law of proof (docs/CITY.md §4–5). Witnesses carry
// a stake; the Fingerpost rule decides what two of them prove; the question
// always gets a confession and only the guilty confess the truth; on half
// proof the Court convicts of the lesser crime; a frightened city shuts its
// doors, and at ten Dread the crowd turns.
// Run: node tests/court.test.js
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
function setup(seed) {
  var e = game(seed);
  var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
  var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
  var innocent = rec.suspects.filter(function (x) { return !x.guilty; })[0];
  return { e: e, kase: kase, rec: rec, culprit: culprit, innocent: innocent,
    scG: e.revealSuspect(rec, null, { key: culprit.key }), scI: e.revealSuspect(rec, null, { key: innocent.key }) };
}

// ---- Witnesses have a stake, and their depositions carry it -----------------
(function stakes() {
  var g = setup(11), e = g.e;
  var w = e.create('witness', e.witnessSpec(g.rec));
  assert.ok(CF.STAKES[w.data.stake], 'a witness has a stake: ' + w.data.stake);
  assert.ok(/, and /.test(w.desc), 'the dossier says why they talk');
  w.data.stake = 'loves'; w.data.knows = true;
  var r = run(e, 'interrogate', [w, byDef(e, 'focus')[0]]);
  var dep = r.out.filter(function (c) { return /^Deposition/.test(e.labelOf(c)); })[0];
  assert.ok(dep, 'a deposition');
  assert.strictEqual(dep.data.stake, 'loves');
  assert.strictEqual(dep.data.againstInterest, true, 'a witness fond of the accused who names them speaks against interest');
  assert.ok(!dep.data.coerced);
  // Beaten out of them: not credible, and the quarter is frightened.
  var w2 = e.create('witness', e.witnessSpec(g.rec));
  w2.data.stake = 'reward';
  var dread0 = e.s.meters.dread;
  var r2 = run(e, 'interrogate', [w2, byDef(e, 'health')[0]]);
  var dep2 = r2.out.filter(function (c) { return /^Deposition/.test(e.labelOf(c)); })[0];
  assert.ok(dep2 && dep2.data.coerced && dep2.data.stake === 'reward');
  assert.strictEqual(e.s.meters.dread, dread0 + 1, 'a beaten witness: Dread +1');
  console.log('stakes: ok');
})();

// ---- The Fingerpost rule ----------------------------------------------------
(function fingerpost() {
  var g = setup(3), e = g.e;
  function dep(stake, extra) { return e.make('clue', { caseId: g.rec.id, aspects: { testimony: 2, opportunity: 1 }, data: Object.assign({ stake: stake, trait: g.culprit.trait }, extra || {}) }); }
  var agree = e.assessCharge(g.scG, [dep('reward'), dep('hates')]);
  assert.ok(agree.fingerpost, 'two witnesses with different stakes establish a fact');
  assert.strictEqual(agree.tier, 'strong', 'two credible witnesses are full proof: ' + agree.score);
  var same = e.assessCharge(g.scG, [dep('reward'), dep('reward')]);
  assert.ok(same.sameStake && !same.fingerpost, 'two witnesses who want the same thing');
  assert.notStrictEqual(same.tier, 'strong');
  assert.ok(same.score < agree.score, 'and they count for less: ' + same.score + ' < ' + agree.score);
  var beaten = e.assessCharge(g.scG, [dep('reward'), dep('hates', { coerced: true })]);
  assert.ok(!beaten.fingerpost, 'a beaten witness is not credible, so does not corroborate');
  var against = e.assessCharge(g.scG, [dep('kin', { againstInterest: true })]);
  assert.strictEqual(against.againstInterest, 1);
  assert.ok(against.score > e.assessCharge(g.scG, [dep('kin')]).score, 'against interest counts extra');
  var d = CF.Charge.describe(agree);
  assert.ok(d.notes.some(function (n) { return /different reasons/.test(n.text); }), 'the Indict window explains it');
  console.log('fingerpost: ok');
})();

// ---- The question: everybody confesses; only the guilty confess the truth -----
(function theQuestion() {
  // Without sufficient indicia it is a crime the Council can charge you with.
  var g = setup(7), e = g.e;
  var pv0 = (function () { e.autoSlot('interrogate', g.scI.uid); e.autoSlot('interrogate', byDef(e, 'health')[0].uid); var p = e.preview('interrogate'); e.clearSlots('interrogate'); return p; })();
  assert.ok(/not sufficient/.test(pv0.text), 'the preview says the indicia are not sufficient');
  var r = run(e, 'interrogate', [g.scI, byDef(e, 'health')[0]]);
  var conf = r.out.filter(function (c) { return c.data.confession === 'question'; })[0];
  assert.ok(conf, 'the innocent confess too');
  assert.strictEqual(conf.data.falseConfession, true);
  assert.strictEqual(conf.data.illegal, true, 'taken without indicia: unlawful');
  assert.strictEqual(e.s.meters.scrutiny, 2, 'Suspicion +2');
  assert.strictEqual(e.s.meters.dread, 2, 'Dread +2');
  assert.strictEqual(e.s.counts.cruelty, 1, 'Cruelty +1');
  // With indicia (two kinds of proof on the table) it is lawful.
  var h = setup(8), f = h.e;
  f.create('clue', { caseId: h.rec.id, aspects: { forensic: 2 } });
  f.create('clue', { caseId: h.rec.id, aspects: { opportunity: 2 } });
  assert.ok(f.indiciaOf(h.rec).sufficient);
  var r2 = run(f, 'interrogate', [h.scG, byDef(f, 'health')[0]]);
  var conf2 = r2.out.filter(function (c) { return c.data.confession === 'question'; })[0];
  assert.ok(conf2 && !conf2.data.falseConfession && !conf2.data.illegal, 'the guilty confess the truth, lawfully');
  assert.strictEqual(f.s.meters.scrutiny, 0, 'no Suspicion when the Carolina allows it');
  // Checked against Body, a true confession is full proof; unchecked it is half.
  var checked = f.assessCharge(h.scG, [conf2, byDef(f, 'clue').filter(function (c) { return CF.clueAspects(c).forensic; })[0]]);
  assert.strictEqual(checked.confession, 'question');
  assert.ok(checked.checked && checked.tier === 'strong', 'confession + Body: full proof');
  var alone = f.assessCharge(h.scG, [conf2]);
  assert.ok(!alone.checked && alone.tier === 'reasonable', 'confession alone: half proof, ' + alone.tier);
  // A free confession is the king of proofs.
  var free = f.assessCharge(h.scG, [f.make('clue', { caseId: h.rec.id, aspects: { testimony: 3, motive: 1 }, data: { confession: 'free' } })]);
  assert.strictEqual(free.tier, 'strong');
  console.log('the question: ok');
})();

// ---- The Court: false confessions convict; half proof convicts of less ---------
(function court() {
  function trial(seed, data) {
    var g = setup(seed), e = g.e;
    var t = e.create('trial', { data: Object.assign({ caseId: g.rec.id, name: g.innocent.name, guilty: false, solid: false, tier: 'reasonable', real: 3, need: 6, coerced: 0, planted: 0, illegal: 0, contradictions: 0 }, data) });
    e.verdict(t);
    return { e: e, rec: g.rec };
  }
  var wrongful = 0, checkedWrong = 0;
  for (var i = 0; i < 40; i++) {
    if (trial(200 + i, { confession: 'question', checked: false }).rec.status === 'closed') wrongful++;
    if (trial(300 + i, { confession: 'question', checked: true }).rec.status === 'closed') checkedWrong++;
  }
  assert.ok(wrongful >= 24, 'an unchecked false confession usually convicts: ' + wrongful + '/40');
  assert.ok(checkedWrong <= 12, 'checked against the body of the thing, it usually fails: ' + checkedWrong + '/40');
  // Half proof on the guilty: the lesser crime.
  var lesser = null;
  for (var j = 0; j < 30 && !lesser; j++) {
    var g = setup(400 + j), e = g.e;
    var t = e.create('trial', { data: { caseId: g.rec.id, name: g.culprit.name, guilty: true, solid: false, tier: 'reasonable', real: 4, need: 6, coerced: 0, planted: 0, illegal: 0, contradictions: 0 } });
    e.verdict(t);
    if (g.rec.status === 'closed') lesser = e.s.journal[0];
  }
  assert.ok(lesser && /theft, not burglary/.test(lesser.text), 'convicted of the lesser crime: ' + (lesser && lesser.text));
  console.log('court: ok');
})();

// ---- Dread: doors shut, the Stews go quiet, and at ten the crowd turns --------
(function dread() {
  var g = setup(5), e = g.e;
  e.s.meters.dread = 9;
  var shut = 0, seen = 0;
  for (var i = 0; i < 12; i++) {
    var h = setup(500 + i), f = h.e;
    f.s.meters.dread = 9;
    h.rec.leads = { scene: true, prints: true, canvass: true, timing: true }; // past the scripted leads, into the generic rule
    var district = f.tableCards().filter(function (c) { return c.def === 'district' && c.data.district === h.rec.district; })[0] || f.create('district', { data: { district: h.rec.district } });
    var r = run(f, 'investigate', [h.kase, district]);
    if (/Doors Shut|door stayed shut/.test(r.story.text + r.story.title)) shut++;
    seen++;
  }
  assert.ok(shut >= 3, 'a frightened quarter shuts its doors sometimes: ' + shut + '/' + seen);
  e.meter('dread', 1);
  e.checkThresholds();
  assert.ok(e.s.over && e.s.over.id === 'riot', 'at ten Dread the crowd turns');
  assert.ok(/Ravenstone/.test(e.s.over.text));
  // Old saves load with the new meter and counts.
  var old = JSON.parse(game(1).save());
  delete old.meters.dread; delete old.counts;
  var loaded = CF.Engine.load(old);
  assert.strictEqual(loaded.s.meters.dread, 0);
  assert.deepStrictEqual(loaded.s.counts, { cruelty: 0, mercy: 0, purse: 0, debt: 0 });
  console.log('dread: ok');
})();

console.log('court: stakes, fingerpost, the question, verdicts, dread all OK');
