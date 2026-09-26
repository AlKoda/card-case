// Phase 1 contract: the tabletop as a generic card system.
// Checks the card data schema and every board capability the design fixes
// (docs/DESIGN.md, "The tabletop"): spawn, move, stack, consume, transform,
// create-by-recipe, positions surviving save/load, compatibility, decay.
// Run: node tests/board.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

['js/util.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/core/recipes.js', 'js/data/recipes.js'].forEach(function (f) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), { filename: f });
});
var CF = globalThis.CF;
var T = CF.TABLE;
console.error = function (err) { throw err; };

// ---- Cards are data ---------------------------------------------------------
(function schema() {
  var slotAspects = {};
  Object.keys(CF.VERBS).forEach(function (vid) {
    CF.VERBS[vid].slots.forEach(function (sl) { sl.accepts.forEach(function (a) { slotAspects[a] = true; }); });
  });
  Object.keys(CF.CARDS).forEach(function (id) {
    var d = CF.CARDS[id];
    assert.strictEqual(d.id, id, id + ': id');
    assert.ok(d.label && typeof d.label === 'string', id + ': label');
    assert.ok(CF.KINDS[d.kind], id + ': unknown kind ' + d.kind);
    assert.ok(d.aspects && typeof d.aspects === 'object', id + ': aspects');
    assert.ok(Array.isArray(d.tags), id + ': tags');
    assert.ok(typeof d.desc === 'string', id + ': desc');
    if (d.decay !== undefined) {
      assert.strictEqual(d.decay, d.lifetime, id + ': decay/lifetime agree');
      assert.ok(d.onExpire, id + ': a decaying card must say what happens when it expires');
    }
    if (d.image) assert.ok(/^(icon|aspect|pic|prop|ev)-/.test(d.image), id + ': image is an art key');
    var known = CF.CLUE_ASPECTS.concat(Object.keys(CF.KINDS));
    Object.keys(d.aspects).forEach(function (a) {
      assert.ok(typeof d.aspects[a] === 'number', id + ': aspect ' + a + ' is numeric');
    });
    void known;
  });
  // Every slot aspect is something a card can carry (a kind, a clue aspect or a def aspect).
  var carried = {};
  Object.keys(CF.KINDS).forEach(function (k) { carried[k] = true; });
  Object.keys(CF.CARDS).forEach(function (id) { Object.keys(CF.CARDS[id].aspects).forEach(function (a) { carried[a] = true; }); });
  CF.CLUE_ASPECTS.forEach(function (a) { carried[a] = true; });
  Object.keys(slotAspects).forEach(function (a) { assert.ok(carried[a], 'slot accepts aspect nobody carries: ' + a); });
  console.log('schema: ' + Object.keys(CF.CARDS).length + ' card definitions valid');
})();

// ---- The board ---------------------------------------------------------------
(function board() {
  var e = CF.Engine.newGame({ seed: 7, calling: 'master' });
  var byDef = function (d) { return e.tableCards().filter(function (c) { return c.def === d; }); };

  // Spawn: a card goes onto a free spot, never over another card or a verb.
  var n0 = e.tableCards().length;
  var clue = e.create('clue', { label: 'Test Clue', aspects: { forensic: 2 }, tags: ['test'], image: 'prop-fingerprint' });
  assert.strictEqual(e.tableCards().length, n0 + 1);
  assert.strictEqual(clue.loc.t, 'table');
  assert.ok(clue.life === 300 && clue.maxLife === 300, 'decay from the definition');
  assert.deepStrictEqual(CF.tagsOf(clue), ['casework', 'proof', 'test']);
  assert.ok(CF.hasTag(clue, 'proof') && !CF.hasTag(clue, 'money'));
  assert.strictEqual(CF.imageOf(clue), 'prop-fingerprint');
  assert.strictEqual(CF.imageOf(byDef('health')[0]), 'icon-health');
  var decayed = e.create('clue', { decay: 10 });
  assert.strictEqual(decayed.life, 10, 'decay can be set per instance');

  // Move: a card lands where dropped when the spot is free, else nearby.
  e.moveCard(clue.uid, 700, 700);
  assert.deepStrictEqual({ x: clue.loc.x, y: clue.loc.y }, { x: 700, y: 700 });
  var other = e.create('clue', { label: 'Other' });
  e.moveCard(other.uid, 700, 700);
  assert.ok(other.loc.x !== 700 || other.loc.y !== 700, 'a different card does not land on top');

  // Stack: identical stackable cards dropped together become one pile.
  var funds = byDef('funds');
  assert.ok(funds.length >= 2);
  var pile = e.stackOf(funds[0]);
  assert.strictEqual(pile.length, funds.length, 'starting funds are one stack');
  e.moveCard(funds[0].uid, 900, 200);
  assert.strictEqual(e.stackOf(funds[0]).length, 1, 'one card can be taken off a stack');
  e.moveCard(funds[0].uid, funds[1].loc.x, funds[1].loc.y);
  assert.strictEqual(e.stackOf(funds[1]).length, funds.length, 'dropping it back rejoins the stack');
  e.moveCard(clue.uid, funds[1].loc.x, funds[1].loc.y);
  assert.ok(clue.loc.x !== funds[1].loc.x || clue.loc.y !== funds[1].loc.y, 'a clue never stacks on funds');

  // Consume: removing a card leaves no trace anywhere.
  e.remove(other);
  assert.ok(!e.card(other.uid));

  // Transform: a card becomes another card in the same place with the same uid.
  var pos = { x: clue.loc.x, y: clue.loc.y };
  e.transform(clue, 'evidence', { label: 'Raw Print', aspects: { forensic: 1 }, decay: 5000 });
  assert.strictEqual(clue.def, 'evidence');
  assert.strictEqual(e.labelOf(clue), 'Raw Print');
  assert.deepStrictEqual({ x: clue.loc.x, y: clue.loc.y }, pos);
  assert.strictEqual(clue.life, 5000);
  assert.ok(!clue.image && !clue.tags, 'old instance data is cleared');

  // Create by another card: a recipe turns Health in Duty into Funds.
  var hp = byDef('health')[0];
  var before = byDef('funds').length;
  assert.ok(e.autoSlot('duty', hp.uid));
  assert.ok(e.start('duty'));
  e.tick(500);
  assert.strictEqual(e.verb('duty').status, 'done');
  e.collect('duty');
  assert.ok(byDef('funds').length > before, 'Duty produced Funds');

  // Compatibility: slots accept by aspect, and "usable" respects verb state.
  var investigate = CF.VERBS.investigate.slots[0];
  var kase = byDef('case')[0];
  assert.ok(e.slotAccepts(investigate, kase));
  assert.ok(!e.slotAccepts(investigate, hp));
  assert.ok(e.usableIn(kase).indexOf('investigate') >= 0);
  assert.ok(e.fitsAny(kase));
  var room = e.create('room', { data: { room: 'locker' } });
  assert.ok(!e.fitsAny(room) && !e.unavailableReason(room), 'a card nothing takes is not "unavailable", just inert');

  // Unavailable: burnout locks the street verbs. The case can still go to
  // Reflect, but Instinct (Patrol only, for now) has nowhere to go.
  var instinct = byDef('instinct')[0];
  assert.ok(!e.unavailableReason(instinct));
  e.create('burnout');
  assert.ok(e.lockReason('investigate'));
  assert.ok(e.usableIn(kase).indexOf('investigate') < 0 && e.usableIn(kase).indexOf('reflect') >= 0);
  assert.ok(!e.unavailableReason(kase), 'still usable somewhere');
  assert.ok(/burnt out/i.test(e.unavailableReason(instinct) || ''), 'the reason names the lock');
  e.cardsOf('burnout').forEach(function (c) { e.remove(c); });
  assert.ok(!e.unavailableReason(instinct));

  // Decay: lifetimes count down with time and expiry runs the def's rule.
  var brief = e.create('clue', { decay: 5 });
  e.tick(2);
  assert.ok(brief.life < 5 && brief.life > 2);
  e.tick(10);
  assert.ok(!e.card(brief.uid), 'an expired clue vanishes');

  // Saved in position: every table card and verb comes back where it was.
  var snapshot = e.tableCards().map(function (c) { return [c.uid, c.loc.x, c.loc.y]; });
  var verbs = CF.VERB_ORDER.map(function (v) { return [v, e.verb(v).x, e.verb(v).y]; });
  var e2 = CF.Engine.load(e.save());
  snapshot.forEach(function (s) {
    var c = e2.card(s[0]);
    assert.ok(c && c.loc.x === s[1] && c.loc.y === s[2], 'card ' + s[0] + ' moved on load');
  });
  verbs.forEach(function (v) { assert.ok(e2.verb(v[0]).x === v[1] && e2.verb(v[0]).y === v[2], 'verb ' + v[0] + ' moved on load'); });
  assert.deepStrictEqual(CF.tagsOf(e2.card(clue.uid)), CF.tagsOf(clue));
  console.log('board: spawn, move, stack, consume, transform, create, compatibility, unavailable, decay, save all OK');
})();
