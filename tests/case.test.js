// Phase 3: the written burglary case plays start to conviction, and can be
// solved by each of its three threads (docs/DESIGN.md, "The first playable
// case"): the window, the witness, and the money.
// Run: node tests/case.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

['js/util.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/core/recipes.js', 'js/data/recipes.js'].forEach(function (f) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), { filename: f });
});
var CF = globalThis.CF;
console.error = function (err) { throw err; };

// A detective: slots the given cards into a verb, runs it, and takes the output.
function Detective(seed) {
  this.e = CF.Engine.newGame({ seed: seed, calling: 'master' });
  this.log = [];
}
Detective.prototype.cards = function (pred) { return this.e.tableCards().filter(pred); };
Detective.prototype.byDef = function (d) { return this.cards(function (c) { return c.def === d; }); };
Detective.prototype.byLabel = function (re) { return this.cards(function (c) { return re.test(CF.Engine.prototype.labelOf.call(this.e, c)); }.bind(this)); };
Detective.prototype.run = function (verb, cards) {
  var e = this.e;
  cards.forEach(function (c) { assert.ok(c, verb + ': missing card'); assert.ok(e.autoSlot(verb, c.uid), verb + ' refused ' + e.labelOf(c)); });
  var pv = e.preview(verb);
  assert.ok(pv && !pv.blocked, verb + ' blocked: ' + (pv && pv.blocked));
  assert.ok(e.start(verb), verb + ' did not start');
  e.tick(e.verb(verb).duration + 0.01);
  var v = e.verb(verb);
  assert.ok(v.status === 'done' || v.status === 'idle', verb + ' did not finish');
  var out = v.out.map(function (u) { return e.card(u); });
  this.log.push(verb + ': ' + (v.story ? v.story.title : '') + ' -> ' + out.map(function (c) { return e.labelOf(c); }).join(', '));
  if (v.status === 'done') e.collect(verb);
  return out;
};
Detective.prototype.give = function (def) { return this.e.create(def); };
Detective.prototype.rec = function () { return this.e.caseRec(this.byDef('case')[0].caseId); };
Detective.prototype.suspectCard = function (key) {
  return this.cards(function (c) { return c.def === 'suspect' && c.data.key === key; })[0];
};
Detective.prototype.charge = function (clues) {
  var e = this.e, rec = this.rec();
  var sc = this.suspectCard(rec.culprit);
  if (!sc) { e.revealSuspect(rec, null, { key: rec.culprit }); sc = this.suspectCard(rec.culprit); }
  var a = e.assessCharge(sc, clues);
  this.run('arrest', [sc].concat(clues));
  var trial = this.byDef('trial')[0];
  assert.ok(trial, 'no trial');
  assert.strictEqual(trial.data.guilty, true, 'charged the culprit');
  assert.strictEqual(trial.data.solid, true, 'the charge is solid: real ' + a.real + '/' + a.need + ' ' + JSON.stringify(a.have));
  assert.strictEqual(trial.data.tier, 'strong');
  // A strong charge convicts 92% of the time; the jury still rolls dice, so
  // try the verdict from a few different RNG states rather than one seed.
  var saved = e.save(), convicted = false;
  for (var i = 0; i < 6 && !convicted; i++) {
    var g = CF.Engine.load(saved);
    g.rng.setState((i + 1) * 7919);
    g.tick(trial.life + 1);
    convicted = g.caseRec(rec.id).status === 'closed';
  }
  assert.ok(convicted, 'a strong charge convicts');
  return a;
};

function fresh(seed) {
  var d = new Detective(seed);
  assert.strictEqual(d.rec().template, 'burglary', 'the first case is the burglary');
  return d;
}

// ---- Route 1: the window (forensic) --------------------------------------------
(function forensicRoute() {
  var d = fresh(11), e = d.e;
  var kase = d.byDef('case')[0];
  d.give('kit'); d.give('prints');
  var out = d.run('investigate', [kase]);
  assert.ok(out.some(function (c) { return /Pried Window/.test(e.labelOf(c)); }), 'the scene gives the window frame');
  assert.ok(out.some(function (c) { return /Inventory/.test(e.labelOf(c)); }), 'and the inventory discrepancy');
  assert.ok(d.byDef('suspect').length >= 1, 'a first suspect');
  var toolmark = d.run('analyze', [d.byLabel(/Pried Window/)[0], d.byDef('kit')[0]]);
  assert.strictEqual(e.labelOf(toolmark[0]), 'Tool Mark Analysis');
  assert.ok(!d.byLabel(/Pried Window/).length, 'the evidence was consumed');
  d.run('investigate', [kase, d.byDef('prints')[0]]);
  var print = d.byLabel(/Partial Fingerprint/)[0];
  assert.ok(print, 'dusting gives a partial print');
  // Prints only match once there is somebody to match them to.
  d.rec().suspects.forEach(function (x) { x.revealed = false; });
  d.byDef('suspect').forEach(function (c) { e.remove(c); });
  var none = d.run('analyze', [print, d.byDef('prints')[0]]);
  assert.ok(none.indexOf(print) >= 0 && e.verb('analyze').recipe === 'lead_burglary_print_nomatch', 'the print comes back unmatched');
  e.revealSuspect(d.rec(), null, { key: d.rec().culprit });
  var matched = d.run('analyze', [d.byLabel(/Partial Fingerprint/)[0], d.byDef('prints')[0]]);
  assert.ok(/Matched Print/.test(e.labelOf(matched[0])), 'the print matches the culprit');
  assert.strictEqual(matched[0].data.points, d.rec().culprit);
  // The mind palace agrees.
  var th = d.run('reflect', [kase, d.byLabel(/Tool Mark/)[0]]);
  assert.strictEqual(d.rec().identified, d.rec().culprit, 'Hands and Hours names the culprit');
  void th;
  // Forensics alone pile up on one aspect; the timing gives the charge its second leg.
  assert.notStrictEqual(e.assessCharge(d.suspectCard(d.rec().culprit), [d.byLabel(/Tool Mark/)[0], d.byLabel(/Matched Print/)[0]]).tier, 'strong');
  d.run('investigate', [kase]);
  d.charge([d.byLabel(/Tool Mark/)[0], d.byLabel(/Matched Print/)[0], d.byLabel(/The Timing/)[0]]);
  console.log('forensic route: convicted\n  ' + d.log.join('\n  '));
})();

// ---- Route 2: the witness (testimony → opportunity) ----------------------------
(function humanRoute() {
  var d = fresh(23), e = d.e;
  var kase = d.byDef('case')[0];
  d.run('investigate', [kase]);
  var district = d.cards(function (c) { return c.def === 'district' && c.data.district === d.rec().district; })[0];
  assert.ok(district, 'the scene hands you its district');
  d.run('investigate', [kase, district]);
  var w = d.byDef('witness')[0];
  assert.ok(w && w.data.knows, 'the neighbour saw the culprit');
  d.run('interrogate', [w, d.byDef('focus')[0]]);
  var statement = d.byLabel(/^Statement/)[0];
  assert.ok(statement && statement.data.trait === d.rec().suspects.filter(function (x) { return x.guilty; })[0].trait, 'the statement carries the culprit\'s trait');
  d.run('investigate', [kase]); // the timing
  var timing = d.byLabel(/The Timing/)[0];
  assert.ok(timing);
  d.run('reflect', [statement, timing]);
  // The sighting and the alarm log reconstruct the night (a deduction), and the
  // result keeps the witness's description of the culprit.
  var corr = d.byLabel(/Reconstructed Timeline/)[0];
  assert.ok(corr && CF.clueAspects(corr).opportunity >= 3 && corr.data.corroborated, 'the sighting and the timing become a timeline');
  assert.strictEqual(corr.data.trait, statement.data.trait);
  var sc = d.suspectCard(d.rec().culprit) || (e.revealSuspect(d.rec(), null, { key: d.rec().culprit }), d.suspectCard(d.rec().culprit));
  // Confront the culprit with the corroborated sighting until they crack (a chance roll).
  var confession = null;
  for (var i = 0; i < 12 && !confession; i++) {
    d.run('interrogate', [sc, d.byDef('focus')[0], corr]);
    confession = d.byLabel(/^Confession/)[0];
    corr = d.byLabel(/Reconstructed Timeline/)[0];
  }
  assert.ok(confession, 'the culprit cracks when confronted');
  d.charge([corr, confession, d.byLabel(/Inventory/)[0]]);
  console.log('human route: convicted\n  ' + d.log.join('\n  '));
})();

// ---- Route 3: the money (financial → motive) -------------------------------------
(function moneyRoute() {
  var d = fresh(37), e = d.e;
  var kase = d.byDef('case')[0];
  d.run('investigate', [kase]);
  var district = d.cards(function (c) { return c.def === 'district' && c.data.district === d.rec().district; })[0];
  d.run('investigate', [kase, district]);
  var ticket = d.byLabel(/Pawn Ticket/)[0];
  assert.ok(ticket, 'the canvass turns up the pawn ticket');
  var pawned = d.run('analyze', [ticket])[0];
  assert.ok(/Pawned Goods/.test(e.labelOf(pawned)) && /"/.test(pawned.desc), 'the clerk describes the culprit');
  assert.strictEqual(pawned.data.trait, d.rec().suspects.filter(function (x) { return x.guilty; })[0].trait);
  var sc = d.suspectCard(d.rec().culprit) || (e.revealSuspect(d.rec(), null, { key: d.rec().culprit }), d.suspectCard(d.rec().culprit));
  d.run('interrogate', [sc, d.byDef('focus')[0]]);
  var motive = d.byLabel(/^Motive/)[0];
  assert.ok(motive, 'a gentle interview gives the motive');
  d.run('investigate', [kase]);
  d.charge([pawned, d.byLabel(/Inventory/)[0], motive, d.byLabel(/The Timing/)[0]]);
  console.log('money route: convicted\n  ' + d.log.join('\n  '));
})();

// ---- Once the script is spent, the generic rules take over ---------------------
(function fallthrough() {
  var d = fresh(5), e = d.e;
  var kase = d.byDef('case')[0];
  d.run('investigate', [kase]);
  d.run('investigate', [kase]);
  var n = d.byDef('clue').length + d.byDef('evidence').length;
  d.run('investigate', [kase]);
  assert.ok(d.byDef('clue').length + d.byDef('evidence').length > n, 'the generic search still draws from the scene pool');
  assert.strictEqual(e.verb('investigate').recipe, 'inv_search');
  console.log('fallthrough: ok');
})();
