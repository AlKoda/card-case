// Headless tests: load the game scripts into Node, then (1) check a few
// scripted mechanics and (2) let a random bot play many games, asserting the
// engine never throws and card bookkeeping stays consistent.
// Run: node tests/sim.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

['js/util.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/data/structures.js', 'js/data/story.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/systems/informants.js', 'js/systems/criminals.js', 'js/systems/sentence.js', 'js/systems/network.js', 'js/systems/callings.js', 'js/systems/intro.js', 'js/core/recipes.js', 'js/data/recipes.js'].forEach(function (f) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), { filename: f });
});
var CF = globalThis.CF;
console.error = function (err) { throw err; }; // recipe errors must fail the test

function checkInvariants(e) {
  var s = e.s;
  var groups = {};
  Object.keys(s.cards).forEach(function (k) {
    var c = s.cards[k];
    assert.ok(c.loc, 'card ' + c.def + ' has no location');
    var v = c.loc.verb && s.verbs[c.loc.verb];
    if (c.loc.t === 'slot') assert.strictEqual(v.slots[c.loc.slot], c.uid, 'slot mismatch');
    if (c.loc.t === 'held') assert.ok(v.held.indexOf(c.uid) >= 0 && v.status === 'running', 'held mismatch');
    if (c.loc.t === 'out') assert.ok(v.out.indexOf(c.uid) >= 0, 'out mismatch');
    if (c.loc.t === 'table') {
      assert.ok(isFinite(c.loc.x) && isFinite(c.loc.y) && c.loc.x >= 0 && c.loc.y >= 0, 'bad position');
      var pk = c.loc.x + ',' + c.loc.y;
      var key = e.stackKey(c) || ('u' + c.uid);
      assert.ok(!groups[pk] || (groups[pk] === key && e.stackKey(c)), 'two different cards share a position');
      groups[pk] = key;
    }
  });
  // Nothing on the board covers anything else.
  var T = CF.TABLE, rects = [];
  Object.keys(groups).forEach(function (pk) { var xy = pk.split(','); rects.push({ x: +xy[0], y: +xy[1], w: T.CW, h: T.CH, n: 'stack ' + pk }); });
  // Verbs live in the dock, not on the felt, so only cards can overlap.
  for (var i = 0; i < rects.length; i++) for (var j = i + 1; j < rects.length; j++) {
    var a = rects[i], b = rects[j];
    assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h), 'overlap: ' + a.n + ' / ' + b.n);
  }
  Object.keys(s.verbs).forEach(function (id) {
    var v = s.verbs[id];
    Object.keys(v.slots).forEach(function (k) { assert.ok(s.cards[v.slots[k]], 'dangling slot ' + id + '.' + k); });
    v.held.forEach(function (u) { assert.ok(s.cards[u], 'dangling held'); });
    v.out.forEach(function (u) { assert.ok(s.cards[u], 'dangling out'); });
  });
}

// ---- Scripted checks ------------------------------------------------------
(function scripted() {
  var e = CF.Engine.newGame({ seed: 42, calling: 'master' });
  var byDef = function (d) { return e.tableCards().filter(function (c) { return c.def === d; }); };
  assert.strictEqual(byDef('case').length, 1, 'starts with one case');
  assert.strictEqual(byDef('funds').length, 3);

  // Duty with Health earns 2 Funds.
  var hp = byDef('health')[0];
  assert.strictEqual(e.autoSlot('duty', hp.uid), 'main');
  assert.ok(e.preview('duty').label === 'Walk the Hard Round');
  assert.ok(e.start('duty'));
  for (var i = 0; i < 31; i++) e.tick(1);
  assert.strictEqual(e.verb('duty').status, 'done');
  e.collect('duty');
  assert.ok(byDef('funds').length >= 4, 'beat shift paid (rent may have been taken)');

  // Search the scene: yields cards and a first suspect.
  var cs = byDef('case')[0];
  assert.strictEqual(e.autoSlot('investigate', cs.uid), 'main');
  assert.ok(e.start('investigate'));
  for (i = 0; i < 31; i++) e.tick(1);
  var outDefs = e.verb('investigate').out.map(function (u) { return e.card(u).def; });
  assert.ok(outDefs.indexOf('suspect') >= 0, 'first search reveals a suspect: ' + outDefs);
  e.collect('investigate');
  checkInvariants(e);

  // Charge assessment: the real culprit with enough key clues is solid.
  var rec = e.caseRec(cs.caseId);
  var sus = e.make('suspect', { caseId: rec.id, data: { key: rec.culprit } });
  var clues = rec.keyAspects.slice(0, 2).map(function (k) {
    var a = {}; a[k] = rec.charge[k] + 2; return e.make('clue', { caseId: rec.id, aspects: a });
  });
  var a = e.assessCharge(sus, clues);
  assert.ok(a.solid && a.tier === 'strong', 'strong charge is solid');
  clues[0].data.misread = true; clues[1].data.misread = true;
  a = e.assessCharge(sus, clues);
  assert.ok(!a.solid && a.tier === 'strong', 'misread clues look strong but are not');
  [sus].concat(clues).forEach(function (c) { delete e.s.cards[c.uid]; });

  // Three Fatigue become Burnout, which locks Duty.
  e.create('fatigue'); e.create('fatigue'); e.create('fatigue');
  e.checkThresholds();
  assert.strictEqual(e.countOf('burnout'), 1);
  assert.ok(e.lockReason('duty'));

  // Letting a case expire makes a Cold Case and someone At Large.
  var cc = e.caseCard(rec.id);
  cc.life = 0.5;
  e.tick(1);
  assert.strictEqual(rec.status, 'cold');
  assert.ok(e.countOf('coldcase') === 1 && e.countOf('atlarge') === 1);

  // Stackable cards join one stack; dropping one elsewhere moves only it.
  var funds = e.tableCards().filter(function (c) { return c.def === 'funds'; });
  assert.ok(funds.length >= 2 && funds.every(function (c) { return c.loc.x === funds[0].loc.x && c.loc.y === funds[0].loc.y; }), 'funds stack together');
  var p = e.moveCard(funds[0].uid, 900, 900);
  assert.ok(p.x !== funds[1].loc.x || p.y !== funds[1].loc.y, 'one card leaves the stack');
  e.moveCard(funds[0].uid, funds[1].loc.x + 20, funds[1].loc.y + 10);
  assert.ok(funds[0].loc.x === funds[1].loc.x && funds[0].loc.y === funds[1].loc.y, 'dropping it back rejoins the stack');

  // Old grid saves load onto the free board.
  var old = JSON.parse(e.save());
  Object.keys(old.cards).forEach(function (k, i) { var c = old.cards[k]; if (c.loc.t === 'table') c.loc = { t: 'table', cell: i }; });
  Object.keys(old.verbs).forEach(function (k) { delete old.verbs[k].x; delete old.verbs[k].y; });
  checkInvariants(CF.Engine.load(old));

  // Save / load round trip.
  var e2 = CF.Engine.load(e.save());
  assert.deepStrictEqual(Object.keys(e2.s.cards).sort(), Object.keys(e.s.cards).sort());
  checkInvariants(e2);
  console.log('scripted checks: ok');
})();

// ---- Random play ------------------------------------------------------------
function botStep(e, rng) {
  var s = e.s;
  CF.VERB_ORDER.forEach(function (vid) {
    var v = s.verbs[vid];
    if (!v.unlocked || CF.VERBS[vid].auto) return;
    if (v.status === 'done') { e.collect(vid); return; }
    if (v.status !== 'idle') return;
    if (rng() < 0.5) return;
    var table = e.tableCards();
    for (var tries = 0; tries < 4 && table.length; tries++) {
      var c = table[Math.floor(rng() * table.length)];
      if (e.autoSlot(vid, c.uid)) table = e.tableCards();
    }
    // Occasionally pour the right kind of cards into open slots.
    e.visibleSlots(vid).forEach(function (sl) {
      if (v.slots[sl.key] || rng() < 0.3) return;
      var fit = e.tableCards().filter(function (c) { return e.slotAccepts(sl, c); });
      if (fit.length) e.slotCard(vid, sl.key, fit[Math.floor(rng() * fit.length)].uid);
    });
    var p = e.preview(vid);
    if (p && !p.blocked) e.start(vid);
    else if (rng() < 0.5) e.clearSlots(vid);
  });
  if (rng() < 0.1) {
    var t = e.tableCards();
    if (t.length) e.moveCard(t[Math.floor(rng() * t.length)].uid, rng() * 1400, rng() * 1200, rng() < 0.3);
  }
  if (rng() < 0.03) {
    var vids = CF.VERB_ORDER.filter(function (v) { return e.verb(v).unlocked; });
    e.moveVerb(vids[Math.floor(rng() * vids.length)], rng() * 1400, rng() * 1000);
  }
}

var endings = {};
var GAMES = 60;
var maxWeek = 0;
var stats = { convictions: 0, cases: 0, cold: 0 };
var recipesSeen = {};
for (var g = 0; g < GAMES; g++) {
  var callings = ['commissioner', 'master', 'crusader'];
  var e = CF.Engine.newGame({ seed: 1000 + g, calling: callings[g % 3] });
  var rng = CF.makeRng(7 + g);
  e.on(function (type) { });
  for (var step = 0; step < 3600 && !e.s.over; step++) {
    botStep(e, rng);
    CF.VERB_ORDER.forEach(function (vid) { var v = e.s.verbs[vid]; if (v.status === 'running') recipesSeen[v.recipe] = true; });
    e.tick(1);
    if (step % 50 === 0) checkInvariants(e);
    if (step % 900 === 0) e = CF.Engine.load(e.save());
  }
  checkInvariants(e);
  var end = e.s.over ? e.s.over.id : 'survived';
  endings[end] = (endings[end] || 0) + 1;
  maxWeek = Math.max(maxWeek, e.s.week);
  stats.convictions += e.s.stats.convictions;
  stats.cases += e.s.stats.cases;
  stats.cold += e.s.stats.cold;
}
console.log('random play: ' + GAMES + ' games ok', JSON.stringify(endings), 'max week', maxWeek, JSON.stringify(stats));
var unseen = CF.RECIPES.map(function (r) { return r.id; }).filter(function (id) { return !recipesSeen[id]; });
console.log('recipes never run by the bot:', unseen.join(', ') || 'none');
