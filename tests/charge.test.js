// Phases 4–5: the aspect system and charge quality. A charge is scored as
// strength + diversity + corroboration − contradictions − illegal evidence
// against the case's charge profile (docs/DESIGN.md, "Charges").
// Run: node tests/charge.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

['js/util.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/data/structures.js', 'js/data/story.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/systems/informants.js', 'js/systems/criminals.js', 'js/systems/network.js', 'js/systems/callings.js', 'js/systems/intro.js', 'js/core/recipes.js', 'js/data/recipes.js'].forEach(function (f) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), { filename: f });
});
var CF = globalThis.CF;
console.error = function (err) { throw err; };

// Every template has a charge profile that agrees with its key aspects.
Object.keys(CF.CASE_TEMPLATES).forEach(function (tid) {
  var T = CF.CASE_TEMPLATES[tid];
  assert.ok(T.charge, tid + ': charge profile');
  assert.deepStrictEqual(Object.keys(T.charge).sort(), T.keyAspects.slice().sort(), tid + ': profile matches key aspects');
  Object.keys(T.charge).forEach(function (k) { assert.ok(CF.ASPECTS[k] && T.charge[k] > 0, tid + ': ' + k); });
});
CF.CLUE_ASPECTS.forEach(function (k) { assert.ok(CF.ASPECTS[k].meaning, k + ' has a meaning'); });

var e = CF.Engine.newGame({ seed: 3, calling: 'master' });
var kase = e.tableCards().filter(function (c) { return c.def === 'case'; })[0];
var rec = e.caseRec(kase.caseId);
assert.strictEqual(rec.template, 'burglary');
assert.deepStrictEqual(rec.charge, { forensic: 2, opportunity: 2, financial: 2 });
var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
var other = rec.suspects.filter(function (x) { return !x.guilty; })[0];
var sc = e.make('suspect', { caseId: rec.id, data: { key: culprit.key } });
function clue(aspects, data) { return e.make('clue', { caseId: rec.id, aspects: aspects, data: data || {} }); }
function assess(clues) { return e.assessCharge(sc, clues); }

// Diversity beats a pile of one aspect.
var pile = assess([clue({ forensic: 4 }), clue({ forensic: 4 }), clue({ forensic: 3 }), clue({ forensic: 2 })]);
var spread = assess([clue({ forensic: 3 }), clue({ testimony: 2 }), clue({ motive: 2 }), clue({ opportunity: 2 })]);
assert.ok(spread.score > pile.score, 'spread ' + spread.score + ' beats pile ' + pile.score);
assert.notStrictEqual(pile.tier, 'strong', 'thirteen points of forensic alone is not a strong charge');
assert.strictEqual(spread.tier, 'strong');

// Aspects the case does not turn on count for little.
var offKey = assess([clue({ digital: 4 }), clue({ motive: 4 })]);
assert.strictEqual(offKey.tier, 'weak', 'eight off-profile points: ' + offKey.score);

// Tiers.
assert.strictEqual(assess([]).tier, 'weak');
assert.strictEqual(assess([clue({ forensic: 2 }), clue({ opportunity: 2 })]).tier, 'reasonable');
assert.strictEqual(assess([clue({ forensic: 2 }), clue({ opportunity: 2 }), clue({ financial: 2 })]).tier, 'strong');

// Corroboration and evidence that names the accused help.
var plain = assess([clue({ forensic: 2 }), clue({ opportunity: 2 })]);
var named = assess([clue({ forensic: 2 }, { points: culprit.key }), clue({ opportunity: 2 }, { corroborated: true })]);
assert.ok(named.score > plain.score && named.tier === 'strong');

// Contradictions: a clue that describes somebody else counts against you.
var contra = assess([clue({ forensic: 2 }), clue({ opportunity: 2 }), clue({ financial: 2 }, { trait: other.trait })]);
assert.strictEqual(contra.contradictions, 1);
assert.strictEqual(contra.contradicting.length, 1);
assert.notStrictEqual(contra.tier, 'strong', 'a contradiction is never strong');
var pointsElse = assess([clue({ forensic: 2 }), clue({ opportunity: 2 }), clue({ financial: 2 }, { points: other.key })]);
assert.strictEqual(pointsElse.contradictions, 1);
var agrees = assess([clue({ forensic: 2 }), clue({ opportunity: 2 }), clue({ financial: 2 }, { trait: culprit.trait })]);
assert.strictEqual(agrees.contradictions, 0);
assert.ok(agrees.score > assess([clue({ forensic: 2 }), clue({ opportunity: 2 }), clue({ financial: 2 })]).score, 'a matching trait corroborates');

// Illegal evidence costs, and is remembered for court.
var dirty = assess([clue({ forensic: 2 }), clue({ opportunity: 2 }, { coerced: true }), clue({ financial: 2 }, { planted: true })]);
assert.strictEqual(dirty.illegal, 2);
assert.strictEqual(dirty.coerced, 1);
assert.strictEqual(dirty.planted, 1);
assert.ok(dirty.score < agrees.score);

// Misread clues look good and are not.
var mis = assess([clue({ forensic: 2 }, { misread: true }), clue({ opportunity: 2 }), clue({ financial: 2 })]);
assert.strictEqual(mis.tier, 'strong');
assert.notStrictEqual(mis.realTier, 'strong');
assert.ok(!mis.solid);

// Foreign clues are ignored and reported.
var otherCase = e.make('clue', { caseId: 'nope', aspects: { forensic: 9 } });
var f = assess([clue({ forensic: 2 }), otherCase]);
assert.strictEqual(f.foreign, 1);
assert.ok(!f.have.forensic || f.have.forensic === 2);

// The description the Arrest window shows.
var d = CF.Charge.describe(contra);
assert.strictEqual(d.rows.length, 3);
assert.ok(d.notes.some(function (n) { return n.kind === 'bad' && /somebody else/.test(n.text); }));
assert.strictEqual(d.tierLabel, CF.Charge.TIERS[contra.tier].label);

// The court reacts to the tier: a weak charge on an innocent person rarely convicts,
// a strong one on the culprit nearly always does.
function trialOutcome(tier, guilty, real, need, n) {
  var wins = 0;
  for (var i = 0; i < n; i++) {
    var g = CF.Engine.newGame({ seed: 100 + i, calling: 'master' });
    var k = g.tableCards().filter(function (c) { return c.def === 'case'; })[0];
    var r = g.caseRec(k.caseId);
    var t = g.create('trial', { data: { caseId: r.id, name: 'X', guilty: guilty, solid: tier === 'strong', tier: tier, real: real, need: need, coerced: 0, planted: 0, contradictions: 0 } });
    g.verdict(t);
    if (r.status === 'closed') wins++;
  }
  return wins / n;
}
assert.ok(trialOutcome('strong', true, 7, 6, 60) > 0.85, 'strong charges convict');
assert.ok(trialOutcome('weak', true, 2, 6, 60) < 0.5, 'weak charges mostly fail');
assert.ok(trialOutcome('weak', false, 2, 6, 60) < 0.3, 'weak charges on the innocent fail');
console.log('charge: profiles, diversity, corroboration, contradictions, illegal evidence, tiers, court all OK');
