// Part II, Phase H: new crimes. The Scriptorium (a locked room in the
// Abbey, and the Inquisitor's interest), the Witch Mark (an accused
// midwife and a Council that wants a burning), the Highway (the roads,
// once the Court is scattered) and the Contract (a paid hand).
// Run: node tests/crimes.test.js
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
  return { out: out, story: story, recipe: v.recipe };
}

// ---- Every new crime is a whole crime -----------------------------------------
(function whole() {
  ['scriptorium', 'witch', 'highway', 'contract'].forEach(function (tid) {
    var T = CF.CASE_TEMPLATES[tid];
    assert.ok(T && T.lesser && T.items.length >= 4 && T.witnesses.length >= 3 && T.hints.length >= 3 && T.roles.length >= 3, tid + ' is complete');
    assert.ok(CF.STRUCTURES[tid] && CF.STRUCTURES[tid].length >= 1, tid + ' has structures');
    assert.ok(CF.LADDERS[tid], tid + ' has a ladder');
    for (var i = 0; i < 6; i++) {
      var e = game(700 + i);
      var rec = e.caseRec(e.spawnCase(tid, { quiet: true }).caseId);
      assert.strictEqual(rec.template, tid);
      assert.ok(!/\{/.test(rec.title) && !/\{/.test(e.caseCard(rec.id).desc), tid + ': every variable filled: ' + e.caseCard(rec.id).desc);
      rec.items.forEach(function (it) { assert.ok(!/\{/.test(it.label) && !/\{/.test(it.text), tid + ' item: ' + it.label); });
      // Searching the scene gives tokens, and Study reads the raw proof.
      var kase = e.caseCard(rec.id);
      var r = run(e, 'investigate', [kase]);
      assert.ok(r.out.some(function (c) { return c.def === 'clue' || c.def === 'evidence'; }), tid + ': the scene gives something');
    }
  });
  assert.ok(CF.ORDINARY_CASES.indexOf('scriptorium') >= 0 && CF.ORDINARY_CASES.indexOf('witch') >= 0 && CF.ORDINARY_CASES.indexOf('contract') >= 0);
  assert.ok(CF.ORDINARY_CASES.indexOf('highway') < 0, 'the highway is not an ordinary crime');
  console.log('whole: ok');
})();

// ---- The Witch Mark is always the Council's; the Fire waits at the top ----------
(function witch() {
  var e = game(11);
  var rec = e.caseRec(e.spawnCase('witch', { quiet: true }).caseId);
  assert.ok(rec.commission && rec.commission.from === 'council' && rec.commission.ofCouncil === null, 'the Council wants a burning by Friday');
  assert.ok(rec.suspects.some(function (x) { return /midwife/.test(x.role); }), 'the midwife is accused');
  assert.strictEqual(CF.Sentence.rungLabel('witch', 'wheel'), 'The Fire');
  console.log('witch: ok');
})();

// ---- The Scriptorium: the Inquisitor takes what is left open ------------------------
(function scriptorium() {
  var e = game(12);
  e.favour().bishop = -2;
  e.patronsWeek();
  assert.ok(e.s.flags.inquisitor);
  var rec = e.caseRec(e.spawnCase('scriptorium', { quiet: true }).caseId);
  e.patronsWeek();
  assert.strictEqual(rec.status, 'open', 'not yet: two weeks');
  e.s.week += 2;
  e.patronsWeek();
  assert.strictEqual(rec.status, 'inquisitor', 'the Inquisitor takes a heresy case left open two weeks');
  assert.ok(!e.caseCard(rec.id));
  assert.ok(e.s.journal.some(function (j) { return /Inquisitor/.test(j.title) && /heretic/.test(j.text); }));
  console.log('scriptorium: ok');
})();

// ---- The Highway comes once the Court is scattered ------------------------------------
(function highway() {
  var e = game(13);
  e.s.rank = 2;
  var seen = false;
  for (var w = 0; w < 30 && !seen; w++) { e.weekTick(); seen = e.openCases().some(function (r) { return r.template === 'highway'; }); if (e.s.over) break; }
  assert.ok(!seen, 'no highwaymen while the Court stands or has not formed');
  var f = game(14);
  f.s.rank = 2; f.s.flags.syndicateFallen = true;
  var got = false;
  for (var w2 = 0; w2 < 30 && !got; w2++) { f.s.meters.pressure = 0; f.s.meters.scrutiny = 0; f.weekTick(); got = f.openCases().some(function (r) { return r.template === 'highway'; }); if (f.s.over) break; }
  assert.ok(got, 'the roads fill once the Court is scattered');
  console.log('highway: ok');
})();

console.log('crimes: whole, witch, scriptorium, highway all OK');
