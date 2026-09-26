// Phases 6–7: the mind palace reasons over clues, and the clock bites.
// Run: node tests/reflect.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

['js/util.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/data/structures.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/systems/informants.js', 'js/systems/criminals.js', 'js/systems/network.js', 'js/core/recipes.js', 'js/data/recipes.js'].forEach(function (f) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), { filename: f });
});
var CF = globalThis.CF;
console.error = function (err) { throw err; };

var e = CF.Engine.newGame({ seed: 8, calling: 'master' });
var kase = e.tableCards().filter(function (c) { return c.def === 'case'; })[0];
var rec = e.caseRec(kase.caseId);
var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
var other = rec.suspects.filter(function (x) { return !x.guilty; })[0];
function clue(label, aspects, data) { return e.create('clue', { label: label, caseId: rec.id, aspects: aspects, data: data || {} }); }
function reflect(cards) {
  cards.forEach(function (c) { assert.ok(e.autoSlot('reflect', c.uid), 'reflect refused ' + e.labelOf(c)); });
  var pv = e.preview('reflect');
  if (!pv || pv.blocked) { var why = pv ? pv.blocked : 'no recipe'; e.clearSlots('reflect'); return { blocked: why }; }
  var id = e.currentRecipe('reflect').recipe.id;
  assert.ok(e.start('reflect'));
  e.tick(e.verb('reflect').duration + 0.01);
  var v = e.verb('reflect');
  var out = v.out.map(function (u) { return e.card(u); });
  var story = v.story;
  if (v.status === 'done') e.collect('reflect');
  return { id: id, out: out, story: story };
}

// Possible identification: two clues describe the same person, nobody on the board fits.
var r = reflect([clue('Sighting', { testimony: 2 }, { trait: culprit.trait }), clue('Paint', { forensic: 1, opportunity: 1 }, { trait: culprit.trait })]);
assert.strictEqual(r.id, 'ref_deduce');
assert.strictEqual(r.out.length, 1, 'the two clues fold into one');
assert.ok(/^Possible Identification/.test(e.labelOf(r.out[0])));
assert.strictEqual(r.out[0].data.trait, culprit.trait);
assert.ok(!r.out[0].data.points);
assert.ok(!rec.identified);
e.remove(r.out[0]);

// Confirmed identification once the suspect is on the board: they become the prime suspect.
var sc = e.revealSuspect(rec, null, { key: culprit.key });
r = reflect([clue('Sighting', { testimony: 2 }, { trait: culprit.trait }), clue('Paint', { forensic: 1, opportunity: 1 }, { trait: culprit.trait })]);
assert.ok(/^Confirmed Identification: /.test(e.labelOf(r.out[0])), e.labelOf(r.out[0]));
assert.strictEqual(r.out[0].data.points, culprit.key);
assert.strictEqual(rec.identified, culprit.key);
assert.ok(/^Prime Suspect/.test(e.labelOf(sc)));
assert.strictEqual(r.story.kind, 'major');
e.remove(r.out[0]);

// Conflicting accounts: two descriptions of different people make nothing, and say so.
r = reflect([clue('Sighting A', { testimony: 2 }, { trait: culprit.trait }), clue('Sighting B', { testimony: 2 }, { trait: other.trait })]);
assert.strictEqual(r.out.length, 2, 'both clues come back');
assert.strictEqual(r.story.title, 'Two Different People');
r.out.forEach(function (c) { e.remove(c); });

// Theories from aspects.
r = reflect([clue('Debts', { financial: 2 }), clue('Letter', { motive: 1, testimony: 1 })]);
assert.strictEqual(e.labelOf(r.out[0]), 'Theory: Financial Motive');
assert.ok(r.out[0].data.corroborated);
e.remove(r.out[0]);
r = reflect([clue('Print', { forensic: 2 }), clue('Timing', { opportunity: 2 })]);
assert.strictEqual(e.labelOf(r.out[0]), 'Placed at the Scene');
e.remove(r.out[0]);

// Three clues in Reflect: the primary and up to three more.
r = reflect([clue('A', { opportunity: 1 }), clue('B', { opportunity: 1 }), clue('C', { opportunity: 1 })]);
assert.strictEqual(e.labelOf(r.out[0]), 'Reconstructed Timeline');
e.remove(r.out[0]);

// Clues with nothing in common: no deduction, and corroboration refuses.
r = reflect([clue('Ledger', { financial: 1 }), clue('Boot', { forensic: 1 })]);
assert.ok(r.blocked && /do not tell the same story/.test(r.blocked), 'unrelated clues: ' + r.blocked);
e.tableCards().filter(function (c) { return c.def === 'clue'; }).forEach(function (c) { e.remove(c); });

// Clues from different cases never combine.
var c1 = clue('One', { forensic: 2 });
var c2 = e.create('clue', { label: 'Two', caseId: 'elsewhere', aspects: { opportunity: 2 } });
r = reflect([c1, c2]);
assert.ok(r.blocked && /different cases/.test(r.blocked));

// The clock: a warning a minute before a case goes cold, then At Large.
var before = e.s.journal.length;
kase.life = 61;
e.tick(2);
var warn = e.s.journal.filter(function (j) { return /^Going Cold/.test(j.title); });
assert.strictEqual(warn.length, 1, 'one warning');
e.tick(2);
assert.strictEqual(e.s.journal.filter(function (j) { return /^Going Cold/.test(j.title); }).length, 1, 'still one warning');
assert.strictEqual(CF.daysLeft(kase.life), 7);
e.tick(70);
assert.strictEqual(rec.status, 'cold');
assert.ok(e.tableCards().some(function (c) { return c.def === 'atlarge'; }), 'the culprit is at large');
void before;
console.log('reflect: identification (possible/confirmed), conflict, theories, three clues, unrelated, foreign; clock warnings OK');
