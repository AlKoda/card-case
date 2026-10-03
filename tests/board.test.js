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

['js/util.js', 'js/i18n.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/data/structures.js', 'js/data/story.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/systems/informants.js', 'js/systems/criminals.js', 'js/systems/sentence.js', 'js/systems/purse.js', 'js/systems/origins.js', 'js/systems/coquille.js', 'js/systems/patrons.js', 'js/systems/societies.js', 'js/systems/network.js', 'js/systems/callings.js', 'js/systems/intro.js', 'js/systems/life.js', 'js/systems/growth.js', 'js/core/recipes.js', 'js/data/recipes.js'].forEach(function (f) {
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
  CF.TOKEN_ASPECTS.forEach(function (a) { carried[a] = true; }); // set on a single token (the Next Door token)
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
  e.moveCard(clue.uid, 1500, 700);
  assert.deepStrictEqual({ x: clue.loc.x, y: clue.loc.y }, CF.snapGrid(1500, 700), 'a card settles on the grid cell it was dropped in');
  T.snap = false;
  e.moveCard(clue.uid, 1500, 700);
  assert.deepStrictEqual({ x: clue.loc.x, y: clue.loc.y }, { x: 1500, y: 700 }, 'without the setting it lands where it was dropped');
  T.snap = true;
  e.moveCard(clue.uid, 99999, -99999);
  assert.ok(clue.loc.x + T.CW <= T.BOUNDS.x + T.BOUNDS.w && clue.loc.y >= T.BOUNDS.y, 'but never off the table');
  e.moveCard(clue.uid, 700, 700);
  var other = e.create('clue', { label: 'Other' });
  e.moveCard(other.uid, 700, 700);
  assert.ok(other.loc.x !== clue.loc.x || other.loc.y !== clue.loc.y, 'a different card does not land on top');

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
  assert.ok(!e.slotAccepts(investigate, byDef('funds')[0]));
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
  assert.ok(/fever/i.test(e.unavailableReason(instinct) || ''), 'the reason names the lock');
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

// ---- Table tools: stack like cards, remember and restore positions --------
(function tableTools() {
  var e = CF.Engine.newGame({ calling: 'crusader', name: 'Tools' });
  var funds = e.cardsOf('funds').filter(function (c) { return c.loc.t === 'table'; });
  assert.ok(funds.length >= 2, 'a new game has funds to stack');
  // Pull one fund away from its stack, then stack everything again.
  var loose = funds[0];
  e.moveCard(loose.uid, loose.loc.x + 3 * (T.CW + T.GAP), loose.loc.y + 2 * (T.CH + T.GAP));
  assert.ok(e.stackOf(loose).length === 1, 'the fund is on its own');
  var before = e.snapshotTable();
  var moved = e.mergeStacks();
  assert.ok(moved.length >= 1, 'stacking moved the loose fund');
  assert.strictEqual(e.stackOf(loose).length, funds.length, 'every fund is in one stack again');
  assert.deepStrictEqual(e.mergeStacks(), [], 'a second stack has nothing to do');
  // Undo puts it back exactly.
  var n = e.restoreTable(before);
  assert.ok(n >= funds.length, 'restore touched the table cards');
  assert.strictEqual(e.stackOf(loose).length, 1, 'the fund is loose again after the undo');
  assert.strictEqual(loose.loc.x, before[loose.uid].x, 'restored x');
  assert.strictEqual(loose.loc.y, before[loose.uid].y, 'restored y');
  // Cards that left the table since the snapshot are ignored, not resurrected.
  var fake = {}; fake[999999] = { x: 0, y: 0 };
  assert.strictEqual(e.restoreTable(fake), 0, 'unknown uids are skipped');
  console.log('table tools: stack, snapshot and restore');
})();

// ---- A fading clue warns once, half a minute out ------------------------------
(function fadeWarning() {
  var e = CF.Engine.newGame({ calling: 'crusader', name: 'Fade' });
  var seen = [];
  e.on(function (type, p) { if (type === 'expiring') seen.push(p); });
  var clue = e.create('clue', { label: 'Muddy Print', lifetime: 40 });
  assert.ok(clue.loc && clue.loc.t === 'table', 'the clue is on the table');
  e.tick(5);
  assert.strictEqual(seen.length, 0, 'no warning at 35s');
  e.tick(6);
  assert.strictEqual(seen.length, 1, 'one warning under 30s');
  assert.strictEqual(seen[0].uid, clue.uid, 'the warning names the clue');
  e.tick(5);
  assert.strictEqual(seen.length, 1, 'the warning is not repeated');
  console.log('fade warning: once, at 30s');
})();

// A card at work in a running verb keeps its time; one left in an idle
// verb's slot keeps aging, warns naming the verb, and frees the slot when it goes.
(function fadeInVerb() {
  var e = CF.Engine.newGame({ calling: 'crusader', name: 'FadeSlot' });
  var seen = [];
  e.on(function (type, p) { if (type === 'expiring') seen.push(p); });
  var w = e.create('witness', { label: 'Nervous Clerk', lifetime: 35 });
  var main = CF.VERBS.interrogate.slots[0].key;
  assert.ok(e.slotCard('interrogate', main, w.uid), 'the witness goes into Interrogate');
  assert.ok(e.autoSlot('interrogate', e.cardsOf('focus')[0].uid) && e.start('interrogate'), 'the hearing starts');
  e.tick(8);
  assert.strictEqual(w.life, 35, 'the clock waits while the card is at work in a verb');
  assert.strictEqual(seen.length, 0);
  e.tick(e.verb('interrogate').duration);
  e.collect('interrogate');
  // Idle: the witness waits in the slot, and the clock does not.
  var f = CF.Engine.newGame({ calling: 'crusader', name: 'IdleSlot' });
  var seen2 = [];
  f.on(function (type, p) { if (type === 'expiring') seen2.push(p); });
  var w2 = f.create('witness', { label: 'Nervous Clerk', lifetime: 35 });
  assert.ok(f.slotCard('interrogate', main, w2.uid));
  f.tick(8);
  assert.strictEqual(w2.life, 27, 'a card in an idle verb\'s slot keeps aging');
  assert.strictEqual(seen2.length, 1, 'warned once in the slot');
  assert.strictEqual(seen2[0].verb, 'interrogate', 'the warning names the verb');
  f.tick(30);
  assert.ok(!f.card(w2.uid), 'the witness has gone');
  assert.deepStrictEqual(f.verb('interrogate').slots, {}, 'the slot is empty, and the verb\'s secondaries with it');
  console.log('fade warning: at work the clock waits; idle in a slot it does not');
})();

// Coin left in an idle verb's slot still pays the Bell: the table first, then the slot.
(function duesFromSlot() {
  var e = CF.Engine.newGame({ seed: 3, calling: 'crusader', name: 'SlotCoin' });
  var letter = e.tableCards().filter(function (c) { return c.def === 'personnel'; })[0];
  var funds = e.cardsOf('funds');
  assert.ok(e.slotCard('duty', 'main', letter.uid) && e.slotCard('duty', 'f1', funds[0].uid), 'a Coin waits in Attend');
  funds.slice(1).forEach(function (c) { e.remove(c); });
  var seen = null; e.on(function (t, p) { if (t === 'dues') seen = p; });
  e.weekTick();
  assert.deepStrictEqual(seen, { uids: [funds[0].uid] }, 'the Coin in the slot pays the dues');
  assert.strictEqual(e.countOf('fatigue'), 0, 'no night on the bench');
  assert.strictEqual(e.verb('duty').slots.f1, undefined, 'the slot is empty');
  console.log('dues from a slot: ok');
})();

// Catch Your Breath brings back every spent faculty on the table at once.
(function spentAll() {
  var e = CF.Engine.newGame({ seed: 5, calling: 'crusader', name: 'Breath' });
  var a = e.create('spent_health'), b = e.create('spent_focus'), c = e.create('spent_instinct');
  assert.ok(e.autoSlot('reflect', a.uid));
  assert.strictEqual(e.currentRecipe('reflect').recipe.id, 'ref_spent');
  assert.ok(e.start('reflect')); e.tick(e.verb('reflect').duration + 0.01);
  e.collect('reflect');
  var defs = e.tableCards().map(function (x) { return x.def; });
  assert.ok(defs.indexOf('spent_health') < 0 && defs.indexOf('spent_focus') < 0 && defs.indexOf('spent_instinct') < 0, 'nothing spent is left: ' + defs);
  assert.ok(defs.indexOf('health') >= 0 && defs.indexOf('focus') >= 0 && defs.indexOf('instinct') >= 0, 'all three are back: ' + defs);
  assert.deepStrictEqual([b.def, c.def], ['focus', 'instinct'], 'the ones on the table were restored in place');
  void a;
  console.log('catch your breath: every spent card');
})();

// A spent card left in Rest's slot recovers with time, and the whole card
// comes back to the table: the slot took Winded, not Health.
(function restoreInSlot() {
  var e = CF.Engine.newGame({ seed: 5, calling: 'crusader', name: 'SlotRest' });
  var sp = e.create('spent_health');
  assert.ok(e.slotCard('reflect', 'main', sp.uid), 'Winded goes into Rest');
  assert.strictEqual(e.currentRecipe('reflect').recipe.id, 'ref_spent');
  e.tick(41);
  assert.strictEqual(sp.def, 'health', 'recovered');
  assert.strictEqual(sp.loc.t, 'table', 'and back on the table: ' + JSON.stringify(sp.loc));
  assert.deepStrictEqual(e.verb('reflect').slots, {}, 'the slot is empty');
  assert.strictEqual(e.currentRecipe('reflect'), null, 'nothing is waiting in Rest');
  console.log('restore in a slot: the faculty returns to the table');
})();

// The round hears things: a watchman on the round brings the fee, now and then a word about an open case, now and then Weariness.
(function roundHears() {
  var words = 0, tired = 0;
  for (var i = 0; i < 40 && !(words && tired); i++) {
    var e = CF.Engine.newGame({ seed: 100 + i, calling: 'commissioner', name: 'Round' });
    var t = e.cardsOf('teammate')[0];
    assert.ok(e.autoSlot('duty', t.uid));
    assert.strictEqual(e.currentRecipe('duty').recipe.id, 'duty_team');
    var before = e.cardsOf('funds').length;
    assert.ok(e.start('duty')); e.tick(e.verb('duty').duration + 0.01);
    var out = e.verb('duty').out.map(function (u) { return e.card(u); });
    assert.strictEqual(out.filter(function (c) { return c.def === 'funds'; }).length, 1, 'one Coin');
    var word = out.filter(function (c) { return c.def === 'clue'; })[0];
    if (word) { words++; assert.strictEqual(e.labelOf(word), 'Heard on the Round'); assert.ok(word.caseId && word.data.trait, 'about an open case, with the culprit\'s trait'); }
    if (out.some(function (c) { return c.def === 'fatigue'; })) tired++;
    e.collect('duty');
    assert.strictEqual(e.cardsOf('funds').length, before + 1);
  }
  assert.ok(words && tired, 'a word and a tired desk in 40 rounds: ' + words + '/' + tired);
  console.log('the round hears things: ok');
})();

// The week's story turns: three lines by the week, and the band named when there is one.
(function weekStory() {
  var e = CF.Engine.newGame({ seed: 8, calling: 'master', name: 'Week' });
  e.create('atlarge', { label: 'At Large: Some One', data: { name: 'Some One', trait: 'limp' } });
  var seen = {};
  for (var w = 0; w < 3; w++) { e.s.week = 1 + w; e.s.meters.retaliation = 0; e.weekTick(); e.s.journal.slice(0, 3).forEach(function (j) { if (/walls|Red Ox|Stews/.test(j.text)) seen[j.text.match(/(walls|Red Ox|Stews)/)[1]] = 1; }); }
  assert.ok(Object.keys(seen).length >= 2, 'the line changes with the week: ' + Object.keys(seen));
  e.create('gang', { label: 'Band: the Lanternless', data: { name: 'the Lanternless', members: [] } });
  e.s.meters.retaliation = 0;
  e.weekTick();
  assert.ok(e.s.journal.slice(0, 3).some(function (j) { return /the Lanternless keep a cellar now, and a tally\./.test(j.text); }), 'the band is named');
  console.log('week story: ok');
})();

// The magnet: a verb with its subject pulls in what its open slots take; the Bell's dues grow with the Watch.
(function magnet() {
  var e = CF.Engine.newGame({ calling: 'crusader', name: 'Magnet' });
  var kase = e.tableCards().filter(function (c) { return c.def === 'case'; })[0];
  assert.deepStrictEqual(e.magnetCandidates('investigate'), [], 'nothing to pull before the subject is in');
  e.giveDistrict('market');
  e.autoSlot('investigate', kase.uid);
  var pulled = e.magnet('investigate');
  assert.ok(pulled.length >= 1, 'the Quarter is pulled in');
  var d = e.card(pulled[0].uid);
  assert.strictEqual(d.def, 'district');
  assert.strictEqual(d.loc.t, 'slot');
  assert.deepStrictEqual(e.magnet('investigate'), [], 'nothing left to pull');
  assert.strictEqual(e.dues(), 1);
  e.create('teammate', e.teammateSpec('rookie')); e.create('teammate', e.teammateSpec('rookie'));
  assert.strictEqual(e.dues(), 2, 'a Coin for every two watchmen');
  var seen = null; e.on(function (t, p) { if (t === 'dues') seen = p; });
  var before = e.cardsOf('funds').length;
  e.weekTick();
  assert.ok(seen && seen.uids.length === 2, 'the Bell draws the dues: ' + JSON.stringify(seen));
  assert.strictEqual(e.cardsOf('funds').length, before - 2 + ((CF.RANK_DEFS[0] || {}).salary || 1));
  console.log('magnet and dues: ok');
})();

// The magnet keeps to the case on the bench: with two cases open, the Court
// pulls only the Accused's own token, and the token that points at them first.
(function magnetSameCase() {
  var e = CF.Engine.newGame({ seed: 31, calling: 'master' });
  e.s.rank = 2;
  var a = e.caseRec(e.spawnCase('burglary', { quiet: true }).caseId);
  var b = e.caseRec(e.spawnCase('fraud', { quiet: true }).caseId);
  var sc = e.revealSuspect(a, null, { key: a.culprit });
  var other = e.create('clue', e.clueSpec(b, { label: 'Other Token', text: 'x', aspects: { testimony: 2 } }, []));
  var stray = e.create('clue', e.clueSpec(a, { label: 'Stray Token', text: 'x', aspects: { testimony: 1 } }, []));
  var aimed = e.create('clue', e.clueSpec(a, { label: 'Aimed Token', text: 'x', aspects: { testimony: 1 } }, [], { points: a.culprit, noMisread: true }));
  assert.ok(other.uid < stray.uid && stray.uid < aimed.uid);
  assert.ok(e.autoSlot('arrest', sc.uid));
  var list = e.magnetCandidates('arrest');
  assert.ok(list.length >= 2 && list.every(function (it) { return e.card(it.uid).caseId === a.id; }), 'only the own case: ' + JSON.stringify(list));
  assert.strictEqual(list[0].uid, aimed.uid, 'the token that points at the Accused first');
  assert.strictEqual(list[1].uid, stray.uid);
  e.magnet('arrest');
  assert.strictEqual(other.loc.t, 'table', 'the other case\'s token stays on the table');
  console.log('magnet keeps to the case: ok');
})();

// Losing or moving a subject frees its hidden secondaries: a case moved from
// Rest to Explore with a token in slot a; a Need removed from Rest with Coin in pay.
(function primaryGoes() {
  var e = CF.Engine.newGame({ seed: 32, calling: 'master' });
  var kase = e.tableCards().filter(function (c) { return c.def === 'case'; })[0];
  var rec = e.caseRec(kase.caseId);
  var tok = e.create('clue', e.clueSpec(rec, { label: 'A Token', text: 'x', aspects: { testimony: 1 } }, []));
  assert.ok(e.slotCard('reflect', 'main', kase.uid) && e.slotCard('reflect', 'a', tok.uid));
  assert.strictEqual(tok.loc.t, 'slot');
  assert.ok(e.autoSlot('investigate', kase.uid), 'the case moves to Explore');
  assert.strictEqual(kase.loc.verb, 'investigate');
  assert.deepStrictEqual(e.verb('reflect').slots, {}, 'Rest is empty');
  assert.strictEqual(tok.loc.t, 'table', 'the token is back on the table');
  var need = e.create('hunger');
  var coin = e.create('funds');
  assert.ok(e.slotCard('reflect', 'main', need.uid) && e.slotCard('reflect', 'pay', coin.uid));
  e.remove(need);
  assert.deepStrictEqual(e.verb('reflect').slots, {}, 'the Coin is not left in a slot nobody can see');
  assert.strictEqual(coin.loc.t, 'table');
  console.log('a subject gone frees its secondaries: ok');
})();

// Mid-work asks: part-way through a search the verb wants one more card;
// answering it finishes the search, and the card comes back out.
(function asks() {
  var e = CF.Engine.newGame({ calling: 'crusader', name: 'Asks' });
  var kase = e.tableCards().filter(function (c) { return c.def === 'case'; })[0];
  assert.ok(e.autoSlot('investigate', kase.uid) && e.start('investigate'));
  var v = e.verb('investigate');
  e.tick(v.duration * 0.2);
  assert.ok(!v.ask, 'nothing asked yet');
  e.tick(v.duration * 0.15);
  assert.ok(v.ask && !v.ask.filled && v.ask.label === 'A locked door', 'the search asks part-way: ' + JSON.stringify(v.ask));
  var inst = e.tableCards().filter(function (c) { return c.def === 'instinct'; })[0];
  var coin = e.tableCards().filter(function (c) { return c.def === 'funds'; })[0];
  assert.ok(e.askAccepts('investigate', inst) && !e.askAccepts('investigate', coin));
  assert.ok(e.askCandidates('investigate').indexOf(inst) >= 0);
  // With every other verb that takes Instinct busy, the ask still counts it as usable.
  var wit0 = e.create('witness', { label: 'Witness: Bran', caseId: kase.caseId, data: { name: 'Bran', knows: 1 } });
  var hp = e.tableCards().filter(function (c) { return c.def === 'health'; })[0];
  e.autoSlot('interrogate', wit0.uid); e.autoSlot('interrogate', hp.uid);
  assert.ok(e.start('interrogate'), 'Question is busy too');
  assert.strictEqual(e.unavailableReason(inst), null, 'a card that answers an open ask is never "busy"');
  assert.ok(e.askCandidates('investigate').indexOf(inst) >= 0, 'and the ask still offers it');
  assert.ok(e.answerAsk('investigate', inst.uid));
  assert.strictEqual(inst.loc.t, 'held');
  assert.ok(!e.askAccepts('investigate', e.create('instinct')), 'answered once');
  e.tick(0.01);
  assert.strictEqual(v.status, 'running', 'answering does not finish the work early');
  e.tick(v.duration);
  assert.strictEqual(v.status, 'done');
  assert.ok(v.out.indexOf(inst.uid) >= 0 && !v.ask, 'and Instinct comes back');
  assert.ok(/door gave/.test(v.story.text), v.story.text);
  // Ignored, the ask costs the result.
  var g2 = CF.Engine.newGame({ calling: 'crusader', name: 'Asks3' });
  var k2 = g2.tableCards().filter(function (c) { return c.def === 'case'; })[0];
  g2.autoSlot('investigate', k2.uid); g2.start('investigate');
  var v2 = g2.verb('investigate'); g2.tick(v2.duration + 0.01);
  assert.ok(/stayed locked/.test(v2.story.text), 'the miss is told: ' + v2.story.text);
  // Coin asked for is spent.
  var f = CF.Engine.newGame({ calling: 'crusader', name: 'Asks2' });
  var w = f.create('witness', { label: 'Witness: Anna', caseId: Object.keys(f.s.cases)[0], data: { name: 'Anna', knows: 1 } });
  var wit = f.tableCards().filter(function (c) { return c.def === 'focus'; })[0];
  f.autoSlot('interrogate', w.uid); f.autoSlot('interrogate', wit.uid);
  if (f.start('interrogate')) {
    var iv = f.verb('interrogate'), coins = f.cardsOf('funds').length;
    f.tick(iv.duration * 0.5);
    if (iv.ask) { assert.ok(f.answerAsk('interrogate', f.cardsOf('funds')[0].uid)); f.tick(iv.duration); assert.strictEqual(f.cardsOf('funds').length, coins - 1, 'the Coin is spent'); }
  }
  console.log('asks: ok');
})();

// The opening: no office. Work for bread, a missing neighbour opens Explore,
// the Watch's questions open Question with Wit, reasoning wins the desk, the
// Court opens with the first charge and the Bell only after the first keep.
(function life() {
  function tbl(g, d) { return g.tableCards().filter(function (c) { return c.def === d; }); }
  function run(g, vid, cards) { cards.forEach(function (c) { g.autoSlot(vid, c.uid); }); assert.ok(g.start(vid), vid + ' starts: ' + JSON.stringify(g.preview(vid))); g.tick(g.verb(vid).duration + 0.01); g.collect(vid); g.tick(0.1); }
  var e = CF.Engine.newGame({ who: 'clerk', name: 'Life', opening: true });
  assert.deepStrictEqual(CF.VERB_ORDER.filter(function (v) { return e.verb(v).unlocked; }), ['duty'], 'only Attend at the start');
  assert.ok(tbl(e, 'health').length === 1 && tbl(e, 'focus').length === 1 && !tbl(e, 'funds').length, 'one Health and one Wit on the table');
  assert.ok(e.s.flags.callingOpen && !tbl(e, 'calling_crusader').length, 'no calling yet');
  assert.strictEqual(e.openCases().length, 0, 'no case yet');
  run(e, 'duty', [tbl(e, 'health')[0]]); e.tick(41);
  run(e, 'duty', [tbl(e, 'health')[0]]);
  assert.strictEqual(e.s.flags.stage, 'search');
  assert.ok(e.verb('investigate').unlocked && e.openCases().length === 1 && /Endres/.test(e.openCases()[0].title), 'the notice opens Explore: ' + e.openCases().map(function (r) { return r.title; }));
  assert.strictEqual(e.verb('investigate').status, 'running', 'and the search starts by itself');
  assert.ok(tbl(e, 'funds').length >= 2, 'labour paid');
  e.tick(e.verb('investigate').duration + 0.01); e.collect('investigate'); e.tick(0.1);
  assert.strictEqual(e.s.flags.stage, 'questioned');
  assert.ok(e.verb('interrogate').unlocked && e.verb('interrogate').status === 'running', 'the sergeant sits you down by himself');
  e.tick(e.verb('interrogate').duration + 0.01); e.collect('interrogate'); e.tick(0.1);
  assert.strictEqual(e.s.flags.stage, 'hired');
  assert.ok(e.s.choice && e.s.choice.id === 'calling', 'the desk asks what you want');
  assert.ok(e.choose(2)); assert.strictEqual(e.s.calling, 'crusader'); assert.ok(tbl(e, 'calling_crusader').length === 1 && !e.s.flags.callingOpen, 'the calling is chosen in play');
  assert.ok(e.verb('analyze').unlocked && e.verb('reflect').unlocked && !e.verb('arrest').unlocked && !e.verb('time').unlocked, 'the desk, but no Court and no Bell yet');
  e.tick(200);
  assert.strictEqual(e.s.weekT, 0, 'the Bell is silent');
  assert.strictEqual(e.openCases().length, 1, 'no other cases come');
  // A charge: the Court opens; a conviction: the first keep, and the Bell.
  var rec = e.openCases()[0];
  var sus = tbl(e, 'suspect')[0] || e.revealSuspect(rec, null, { key: rec.suspects.filter(function (x) { return x.guilty; })[0].key });
  e.create('clue', { label: 'y', caseId: rec.id, aspects: { testimony: 2, motive: 2 } }); e.create('clue', { label: 'z', caseId: rec.id, aspects: { digital: 2, testimony: 1 } });
  e.tick(0.1); e.tick(0.1);
  assert.ok(e.verb('arrest').unlocked, 'an accused and a token open the Court');
  run(e, 'arrest', [sus].concat(tbl(e, 'clue')));
  var trial = tbl(e, 'trial')[0];
  assert.ok(trial, 'the sworn men are out');
  e.tick(trial.life + 0.5);
  assert.ok(e.s.stats.convictions + e.s.stats.acquittals === 1, 'a verdict');
  if (e.s.stats.convictions === 1) {
    assert.strictEqual(e.s.flags.stage, 'keep');
    assert.ok(e.verb('time').unlocked && !e.s.flags.bellSilent, 'the first keep rings the Bell');
  }
  var seen = {};
  for (var k = 0; k < 5; k++) { var g = CF.Engine.newGame({ seed: 900 + k, calling: 'master', who: CF.ORIGIN_ORDER[k], opening: true }); seen[g.openingScene().missing] = true; }
  assert.strictEqual(Object.keys(seen).length, 5, 'every origin has its own missing person');
  e.openingKeep();
  // Needs: hunger takes a Health for good when there is a spare, else strength.
  e.create('health');
  var hp = e.cardsOf('health', true).length;
  var hunger = e.create('hunger', { lifetime: 5 });
  e.tick(5.01);
  assert.strictEqual(e.cardsOf('health', true).length, hp - 1, 'a spare Health is lost for good');
  assert.strictEqual(e.countOf('hunger'), 0);
  while (e.cardsOf('health', true).length > 1) e.remove(e.cardsOf('health', true)[0]);
  var one = e.cardsOf('health', true).length;
  var fat = e.countOf('fatigue');
  e.create('hunger', { lifetime: 5 }); e.tick(5.01);
  assert.strictEqual(e.cardsOf('health', true).length, one, 'the last Health is never taken');
  assert.ok(e.countOf('fatigue') > fat && e.countOf('hunger') === 1, 'it takes strength and stays');
  var h2 = e.cardsOf('hunger')[0];
  e.autoSlot('reflect', h2.uid);
  assert.ok(/Coin/.test(e.preview('reflect').blocked), 'eating wants Coin');
  e.autoSlot('reflect', e.cardsOf('funds')[0].uid);
  assert.ok(!e.preview('reflect').blocked && e.start('reflect'));
  e.tick(e.verb('reflect').duration + 0.01);
  assert.strictEqual(e.countOf('hunger'), 0, 'fed');
  // Choices: the clock waits, and the answer bends the city.
  var spec = CF.CHOICES.filter(function (c) { return c.id === 'beggar'; })[0];
  e.offerChoice(spec);
  var t0 = e.s.t; e.tick(10); assert.strictEqual(e.s.t, t0, 'time stops while the city waits');
  var d0 = e.s.meters.dread; e.s.meters.dread = 3;
  assert.ok(e.choose(1));
  assert.strictEqual(e.s.meters.dread, 4, 'turning her away is remembered');
  assert.ok(!e.s.choice); e.tick(1); assert.ok(e.s.t > t0, 'and the clock runs again');
  void d0;
  var e2 = CF.Engine.load(e.save()); assert.ok(!e2.s.choice && e2.s.choicesSeen.beggar === e.s.week, 'the choice is remembered, with the week it was asked');
  // A question that follows a verb, about its case, with a return you can point to.
  var e4 = CF.Engine.newGame({ seed: 3, calling: 'master', name: 'Hodge Ebner' });
  e4.s.flags.firstCase = true; if (e4.s.intro) e4.s.intro.finished = true;
  var k4 = e4.tableCards().filter(function (c) { return c.def === 'case'; })[0];
  var rec4 = e4.caseRec(k4.caseId);
  e4.autoSlot('investigate', k4.uid); assert.ok(e4.start('investigate'), 'a search starts');
  e4.tick(e4.verb('investigate').duration + 0.01);
  assert.ok(e4.s.choiceHook && e4.s.choiceHook.verb === 'investigate' && e4.s.choiceHook.caseId === rec4.id, 'a finished search invites a question about its case');
  var lamp = CF.CHOICES.filter(function (c) { return c.id === 'lamplighter'; })[0];
  assert.ok(lamp.after === 'investigate' && lamp.when(e4, { caseId: rec4.id }), 'the tiler has a word about an unsolved case');
  e4.create('funds');
  e4.offerChoice(lamp, { caseId: rec4.id });
  assert.ok(e4.s.choice && e4.s.choice.options[0].gain && e4.s.choice.options[0].cost === 'funds', 'the answer says what it gives and what it takes');
  var w0 = e4.cardsOf('witness').length, f0 = e4.cardsOf('funds').length;
  assert.ok(e4.choose(0));
  assert.strictEqual(e4.cardsOf('witness').length, w0 + 1, 'a Coin buys a witness for the case');
  assert.strictEqual(e4.cardsOf('funds').length, f0 - 1, 'and the Coin is gone');
  var wit = e4.cardsOf('witness').filter(function (c) { return /Tiler/.test(c.label); })[0];
  assert.ok(wit && wit.caseId === rec4.id && wit.data.knows, 'it is the tiler, who knows');
  assert.ok(e4.s.journal.some(function (j) { return /A Witness who saw it/.test(j.text || ''); }), 'the journal says what the answer gave');
  assert.ok(!e4.s.choiceHook || e4.s.choiceHook.verb !== 'x', 'the hook is state, not a choice');
  // Growth: each ability lists its ways and how far along they are.
  var ways = CF.growthWays(e4, 'health');
  assert.ok(ways.length === 2 && ways.every(function (w) { return w.state === 'open' && w.n === 0 && w.need > 0 && w.how; }), 'Health has two ways to grow, both open and explained');
  e4.s.stats.recipes = { duty_beat: 2 };
  assert.strictEqual(CF.growthWays(e4, 'health').filter(function (w) { return w.id === 'fencing'; })[0].n, 2, 'two rounds walked of three');
  e4.growthTick(); assert.ok(!e4.s.insights.fencing, 'not yet earned');
  e4.s.stats.recipes.duty_beat = 3; e4.growthTick();
  assert.ok(e4.s.insights.fencing && CF.growthWays(e4, 'health').filter(function (w) { return w.id === 'fencing'; })[0].state === 'waiting', 'the third round earns the Insight, which waits on the table');
  // In play: three hard rounds walked through Attend earn the Insight by themselves.
  var e6 = CF.Engine.newGame({ seed: 61, calling: 'master' });
  for (var round = 0; round < 3; round++) {
    e6.tableCards().filter(function (c) { return c.def === 'fatigue'; }).forEach(function (c) { e6.remove(c); });
    var hp6 = e6.tableCards().filter(function (c) { return c.def === 'health'; })[0] || e6.create('health');
    assert.strictEqual(e6.autoSlot('duty', hp6.uid), 'main');
    assert.strictEqual(e6.currentRecipe('duty').recipe.id, 'duty_beat');
    assert.ok(e6.start('duty'));
    for (var tk = 0; tk < 200 && e6.verb('duty').status === 'running'; tk++) e6.tick(1);
    assert.strictEqual(e6.verb('duty').status, 'done', 'round ' + round + ' finished');
    e6.collect('duty');
  }
  var insight = e6.tableCards().filter(function (c) { return c.def === 'insight'; })[0];
  assert.ok(insight && insight.data.insight === 'fencing', 'the Fencing-master arrives on the third round');
  assert.ok(e6.s.journal.some(function (j) { return /^An Insight: /.test(j.title); }), 'and the journal says so');
  // An old save: the cards below the verb row move down with the taller verbs.
  var old = JSON.parse(e4.save()); old.version = 1;
  var y0 = e4.tableCards()[0].loc.y, uid0 = e4.tableCards()[0].uid;
  var e5 = CF.Engine.load(old);
  assert.strictEqual(e5.card(uid0).loc.y, y0 >= 200 ? y0 + CF.TABLE.TOP - 200 : y0, 'an old save is moved down once');
  assert.strictEqual(CF.Engine.load(e5.save()).card(uid0).loc.y, e5.card(uid0).loc.y, 'and only once');
  console.log('life: opening, needs, choices ok');
})();

// A save from another day: a way renamed, a card gone from a slot, a question the city no longer asks.
(function reconcile() {
  var e = CF.Engine.newGame({ seed: 11, calling: 'crusader', name: 'Load' });
  var hp = e.tableCards().filter(function (c) { return c.def === 'health'; })[0] || e.create('health');
  assert.strictEqual(e.autoSlot('duty', hp.uid), 'main');
  assert.ok(e.start('duty'));
  var saved = e.save().replace('"recipe":"duty_beat"', '"recipe":"duty_old_name"');
  assert.ok(/duty_old_name/.test(saved));
  // A renamed way: the alias carries the running verb to the new name and it finishes there.
  CF.RECIPE_ALIAS.duty_old_name = 'duty_beat';
  var e2 = CF.Engine.load(saved);
  delete CF.RECIPE_ALIAS.duty_old_name;
  assert.strictEqual(e2.verb('duty').recipe, 'duty_beat', 'the old name follows the alias');
  assert.strictEqual(e2.verb('duty').status, 'running');
  e2.tick(e2.verb('duty').duration + 0.01);
  assert.strictEqual(e2.verb('duty').status, 'done', 'and the round finishes under it');
  // A way gone for good: the verb gives its cards back and goes idle.
  var e3 = CF.Engine.load(saved);
  assert.strictEqual(e3.verb('duty').status, 'idle', 'an unknown way stops the verb');
  assert.ok(!e3.verb('duty').held.length && e3.card(hp.uid).loc.t === 'table', 'and its cards are on the table again');
  // The recipe gone mid-run: no crash, an interruption.
  var e3b = CF.Engine.load(saved); e3b.verb('duty').status = 'running'; e3b.verb('duty').recipe = 'duty_old_name'; e3b.verb('duty').held = [hp.uid]; e3b.card(hp.uid).loc = { t: 'held', verb: 'duty' };
  e3b.complete('duty');
  assert.strictEqual(e3b.s.journal[0].title, 'Interrupted');
  // A card deleted from under a slot, and one a verb forgot.
  var e4 = CF.Engine.newGame({ seed: 12, calling: 'crusader', name: 'Load' });
  var clue = e4.create('clue'), wit = e4.create('instinct');
  assert.ok(e4.autoSlot('reflect', clue.uid));
  var s4 = JSON.parse(e4.save());
  delete s4.cards[clue.uid];
  s4.cards[wit.uid].loc = { t: 'slot', verb: 'reflect', slot: 'aid' };
  var e5 = CF.Engine.load(s4);
  assert.ok(!Object.keys(e5.verb('reflect').slots).some(function (k) { return e5.verb('reflect').slots[k] === clue.uid; }), 'the deleted card leaves its slot');
  assert.strictEqual(e5.card(wit.uid).loc.t, 'table', 'a card the verb never held comes back to the table');
  assert.ok(e5.tableCards().every(function (c) { var q = e5.clampToTable(c.loc.x, c.loc.y, T.CW, T.CH); return q.x === c.loc.x && q.y === c.loc.y; }), 'every card on the table');
  // A stale choice and an old hook are dropped; a live choice is kept.
  var s6 = JSON.parse(e4.save());
  s6.choice = { id: 'no_such_choice', title: 'x', text: 'x', options: [] };
  s6.choiceHook = { verb: 'duty', t: s6.t - 30 };
  var e6 = CF.Engine.load(s6);
  assert.ok(!e6.s.choice && !e6.s.choiceHook, 'a question the city no longer asks is dropped');
  var t6 = e6.s.t; e6.tick(1); assert.ok(e6.s.t > t6, 'and the clock runs');
  var spec = CF.CHOICES.filter(function (c) { return c.id === 'beggar'; })[0];
  e6.offerChoice(spec);
  var e7 = CF.Engine.load(e6.save());
  assert.ok(e7.s.choice && e7.s.choice.id === 'beggar', 'a live question survives the load');
  // A verb pushed off the table comes back onto it; one in its place stays.
  var s8 = JSON.parse(e4.save()), dx = s8.verbs.duty.x, dy = s8.verbs.duty.y;
  s8.verbs.duty.x = 99999; s8.verbs.duty.y = -99999;
  var e8 = CF.Engine.load(s8);
  var q8 = e8.clampToTable(e8.verb('duty').x, e8.verb('duty').y, T.VW, T.VH);
  assert.ok(q8.x === e8.verb('duty').x && q8.y === e8.verb('duty').y, 'the verb is on the table');
  assert.ok(e8.verb('reflect').x === s8.verbs.reflect.x && e8.verb('reflect').y === s8.verbs.reflect.y, 'the others did not move');
  void dx; void dy;
  // The counts carry the debt even from a save without it.
  var s9 = JSON.parse(e4.save()); delete s9.counts;
  var e9 = CF.Engine.load(s9); e9.count('debt');
  assert.strictEqual(e9.s.counts.debt, 1);
  console.log('reconcile: renamed recipe, lost cards, stale choice, verb positions ok');
})();

// Ways around the needs, and the Rival.
(function rivalry() {
  var e = CF.Engine.newGame({ calling: 'crusader', name: 'Rival' });
  // A watchman feeds you: no Coin needed.
  var hunger = e.create('hunger'), tm = e.create('teammate', e.teammateSpec('rookie'));
  e.autoSlot('reflect', hunger.uid); e.autoSlot('reflect', tm.uid);
  var pv = e.preview('reflect');
  assert.strictEqual(e.currentRecipe('reflect').recipe.id, 'ref_hunger_pot', pv && pv.label);
  assert.ok(e.start('reflect')); e.tick(e.verb('reflect').duration + 0.01);
  assert.strictEqual(e.countOf('hunger'), 0, 'fed from the pot');
  assert.ok(e.verb('reflect').out.indexOf(tm.uid) >= 0, 'the watchman comes back');
  e.collect('reflect');
  var stress = e.create('stress'), inst = e.tableCards().filter(function (c) { return c.def === 'instinct'; })[0];
  e.autoSlot('reflect', stress.uid); e.autoSlot('reflect', inst.uid);
  assert.strictEqual(e.currentRecipe('reflect').recipe.id, 'ref_stress_walk');
  e.clearSlots('reflect');
  // The Rival arrives in the middle of the game and acts every week.
  e.s.week = 8; e.s.rng = 7; e.rng.setState && e.rng.setState(7);
  var seen = 0;
  for (var w = 0; w < 6 && !e.cardsOf('rival', true).length; w++) { e.rivalWeek(); }
  var r = e.cardsOf('rival', true)[0];
  assert.ok(r, 'the Harbourmaster sends an examiner');
  // They race you only on a case you have opened and held a week: an untouched desk gives them nothing.
  assert.deepStrictEqual(e.rivalWeek(), [], 'nothing to race you on yet');
  e.openCases().forEach(function (x) { x.searches = 1; });
  var before = e.openCases().length, lines = e.rivalWeek();
  assert.ok(lines.length === 1, 'they act: ' + lines);
  void before; void seen;
  // Exposure is a short hunt: one thread a week, the second by the other road.
  if (!e.openCases().some(function (x) { return !x.rival; })) e.spawnCase('burglary', { quiet: true });
  var wit = e.tableCards().filter(function (c) { return c.def === 'focus'; })[0];
  e.autoSlot('interrogate', r.uid); e.autoSlot('interrogate', wit.uid);
  assert.strictEqual(e.currentRecipe('interrogate').recipe.id, 'int_rival_weakness');
  assert.ok(e.start('interrogate')); e.tick(e.verb('interrogate').duration + 0.01);
  assert.strictEqual(r.data.heat, 1);
  assert.ok(!(r.data.stalled >= e.s.week), 'the first thread does not stall them');
  assert.strictEqual(r.data.heatHow, 'question');
  var found = e.verb('interrogate').story;
  assert.strictEqual(found.title, 'A Weakness Found');
  var eyed = r.data.eyes && e.caseRec(r.data.eyes);
  assert.ok(eyed && found.text.indexOf('They have been asking about ' + eyed.title + '.') >= 0, 'the first thread says what they are after: ' + found.text);
  assert.ok(/catch them at it/.test(found.text), 'and what is left to do: ' + found.text);
  e.collect('interrogate');
  assert.strictEqual(wit.def, 'spent_focus', 'Wit comes back spent');
  // The same week, by either road: they are careful. Nothing is spent.
  var inst = e.tableCards().filter(function (c) { return c.def === 'instinct'; })[0] || e.create('instinct');
  e.autoSlot('investigate', r.uid); e.autoSlot('investigate', inst.uid);
  assert.strictEqual(e.currentRecipe('investigate').recipe.id, 'inv_rival_shadow');
  assert.ok(/careful this week/.test(e.preview('investigate').blocked), 'careful for a week: ' + e.preview('investigate').blocked);
  assert.ok(!e.start('investigate'));
  e.clearSlots('investigate');
  // They act at the Bell all the same.
  e.s.week++;
  e.openCases().forEach(function (x) { x.searches = 1; x.week = Math.min(x.week || 0, e.s.week - 1); });
  assert.ok(e.rivalWeek().length >= 1, 'they act before they can be exposed');
  // A second thread by either road teaches them nothing: they must be caught at it.
  wit = e.create('focus');
  e.autoSlot('interrogate', r.uid); e.autoSlot('interrogate', wit.uid);
  assert.strictEqual(e.preview('interrogate').blocked, CF.RIVAL_CATCH, 'Wit alone: ' + e.preview('interrogate').blocked);
  // Only their own work goes in the slot: an honest token is refused, a spoiled one taken.
  var honest = e.create('clue', { label: 'A Boot-print', aspects: { forensic: 1 } });
  assert.strictEqual(e.autoSlot('interrogate', honest.uid), null, 'an honest token is not their work');
  e.clearSlots('interrogate');
  e.autoSlot('investigate', r.uid); e.autoSlot('investigate', inst.uid);
  assert.strictEqual(e.preview('investigate').blocked, CF.RIVAL_CATCH, 'Instinct alone: the same');
  e.clearSlots('investigate');
  var spoiled = e.create('clue', { label: 'A Muddled Print', aspects: { forensic: 1 }, data: { tampered: true } });
  var rep = e.s.meters.reputation;
  e.favour().council = 5;
  e.autoSlot('interrogate', r.uid); e.autoSlot('interrogate', wit.uid);
  assert.strictEqual(e.autoSlot('interrogate', spoiled.uid), 'theirs', 'their spoiled token goes in Their Work');
  assert.strictEqual(e.currentRecipe('interrogate').recipe.id, 'int_rival_expose');
  assert.ok(!e.preview('interrogate').blocked);
  var wkBefore = e.s.week;
  assert.ok(e.start('interrogate')); e.tick(e.verb('interrogate').duration + 0.01);
  assert.strictEqual(e.cardsOf('rival', true).length, 0, 'exposed and sent home');
  assert.strictEqual(e.verb('interrogate').story.title, 'The Rival Exposed');
  assert.strictEqual(e.s.meters.reputation, rep + 1, 'the Rival exposed: Standing +1');
  assert.strictEqual(e.favour().council, 5, 'the Council\'s favour is held to its bounds');
  assert.ok(e.s.flags.rivalGone >= wkBefore + CF.RIVAL_GONE_WEEKS && e.s.flags.rivalGone <= e.s.week + CF.RIVAL_GONE_WEEKS, 'gone ten weeks: ' + e.s.flags.rivalGone);
  e.collect('interrogate');
  assert.ok(spoiled.loc && spoiled.loc.t === 'table', 'the token comes back');
  // An older save's examiner carries no week or road yet.
  var oe = CF.Engine.newGame({ calling: 'crusader', name: 'Old Rival' });
  oe.create('rival', { label: 'The Rival: Piet Wieland', data: { name: 'Piet Wieland', heat: 1, stalled: 0 } });
  var osv = JSON.parse(oe.save());
  Object.keys(osv.cards).forEach(function (u) { var od = osv.cards[u].def === 'rival' && osv.cards[u].data; if (od) { delete od.heatWeek; delete od.heatHow; delete od.eyes; } });
  var ol = CF.Engine.load(osv);
  var or = ol.cardsOf('rival', true)[0];
  assert.ok(or.data.heatWeek === -1 && or.data.heatHow === null && or.data.eyes === null, 'an older examiner is defaulted');
  // The next one needs no introduction, and is not the same person.
  var sent = e.s.flags.rivalName;
  e.s.week = e.s.flags.rivalGone + 1;
  var again = [];
  for (var w2 = 0; w2 < 40 && !e.cardsOf('rival', true).length; w2++) again = e.rivalWeek();
  var r2 = e.cardsOf('rival', true)[0];
  assert.ok(r2 && r2.data.name !== sent, 'another examiner, with another name');
  assert.deepStrictEqual(again, ['The Harbourmaster has sent another examiner.']);
  var told = e.s.journal.filter(function (j) { return j.title === 'Another Examiner'; })[0];
  assert.ok(told && told.text.indexOf(r2.data.name) > 0 && !/wants the Council to see/.test(told.text), 'told as the second, not the first');
  assert.strictEqual(e.s.journal.filter(function (j) { return j.title === 'The Harbourmaster\'s Examiner'; }).length, 1, 'the first story is told once');
  console.log('rivalry: ok');
})();

// A save from another edition: ids the code no longer knows (a verb, a recipe,
// a choice) load without a throw, and the game goes on from there.
(function loadTolerance() {
  var e = CF.Engine.newGame({ seed: 11, calling: 'master' });
  var s = JSON.parse(e.save());
  var orphan = e.create('focus');
  s = JSON.parse(e.save());
  s.cards[orphan.uid].loc = { t: 'verb', verb: 'nowhere' };
  s.verbs.nowhere = { id: 'nowhere', status: 'idle', slots: { main: orphan.uid }, held: [], ctxSlots: {}, out: [], recipe: null, elapsed: 0, duration: 0, story: null, unlocked: true };
  var vid = CF.VERB_ORDER[0];
  s.verbs[vid].status = 'running'; s.verbs[vid].recipe = 'no_such_recipe'; s.verbs[vid].recipeLabel = 'Lost'; s.verbs[vid].duration = 3; s.verbs[vid].elapsed = 0;
  s.choice = { id: 'no_such_choice', title: 'Gone', text: 'A question from an older edition.', options: [{ label: 'Yes', text: '' }] };
  var e2 = CF.Engine.load(JSON.stringify(s));
  assert.ok(!e2.s.verbs.nowhere && e2.card(orphan.uid).loc.t === 'table', 'an unknown verb is dropped and its cards come back to the table');
  assert.strictEqual(e2.choose(0), false, 'an unknown choice cannot be answered');
  e2.s.choice = null; // the clock waits on a choice: cleared here, the running verb runs out
  var errors = [], ce = console.error;
  console.error = function (err) { errors.push(err); };
  try { for (var i = 0; i < 10; i++) e2.tick(1); } finally { console.error = ce; }
  assert.strictEqual(e2.s.verbs[vid].status, 'idle', 'a verb whose recipe is gone ends instead of hanging');
  assert.ok(!e2.s.over, 'and the game goes on');
  CF.Engine.load(e2.save());
  console.log('load tolerance: unknown verb, recipe and choice ids ok' + (errors.length ? ' (the lost recipe was reported: ' + errors.length + ')' : ''));
})();

// An ask on work that never happened: no miss line, no penalty; the answer comes back out.
(function interruptedAsk() {
  var e = CF.Engine.newGame({ calling: 'crusader', name: 'Gone', seed: 61 });
  var kase = e.tableCards().filter(function (c) { return c.def === 'case'; })[0];
  assert.ok(e.autoSlot('investigate', kase.uid) && e.start('investigate'));
  var v = e.verb('investigate');
  e.tick(v.duration * 0.35);
  assert.ok(v.ask && !v.ask.filled, 'asked');
  var fat0 = e.cardsOf('fatigue', true).length;
  e.remove(e.card(v.ctxSlots[e.primaryKey('investigate')]));
  e.tick(v.duration);
  assert.strictEqual(v.story.title, 'Interrupted');
  assert.ok(!/back room|wore you|legs know/.test(v.story.text), 'no miss line: ' + v.story.text);
  assert.strictEqual(e.cardsOf('fatigue', true).length, fat0, 'no penalty for work that did not happen');
  assert.ok(!v.ask, 'the ask is gone');
  console.log('interrupted ask: ok');
})();

// How loud bad news lands: a body hurt, a need, the verdict's own word, the rest.
(function storyCues() {
  var e = CF.Engine.newGame({ calling: 'master', name: 'Cues', seed: 62 });
  e.hurtYou('A cudgel on the stair.');
  assert.strictEqual(e.s.journal[0].title, 'Wounded');
  assert.strictEqual(e.s.journal[0].cue, 'harm');
  var need = Object.keys(CF.NEEDS)[0];
  assert.strictEqual(e.story(CF.CARDS[need].label, 'x', 'danger').cue, 'need', 'a need arriving');
  assert.strictEqual(e.story('Lost: Wit', 'x', 'danger').cue, 'harm', 'an ability lost');
  assert.strictEqual(e.story('The Rival Boasts', 'x', 'danger').cue, undefined, 'a boast is an omen, not a blow');
  assert.strictEqual(e.story('A Day', 'x', 'major').cue, undefined);
  assert.strictEqual(e.story('Not Guilty: X', 'x', 'danger', { cue: 'quiet' }).cue, 'quiet');
  for (var i = 0; i < 3; i++) e.create('fatigue');
  e.checkThresholds();
  assert.ok(e.s.journal[0].title === 'Fever' && e.s.journal[0].cue === 'harm', 'the fever is a blow');
  // Saved and loaded, the journal keeps its cues and an old entry without one still reads.
  var l = CF.Engine.load(e.save());
  assert.strictEqual(l.s.journal[0].cue, 'harm');
  // An instrument's boost reads in words.
  assert.deepStrictEqual(CF.tagLabels(['biology', 'physical']), ['Bodies and traces']);
  assert.deepStrictEqual(CF.tagLabels(['records']), ['Papers']);
  console.log('story cues: ok');
})();

// A token changed inside its stack (the Rival's people at it) leaves the stack.
(function settleStacks() {
  var e = CF.Engine.newGame({ calling: 'master', name: 'Twins', seed: 63 });
  var a = e.create('clue', { label: 'Rumour from Rattle', caseId: 'c1', aspects: { testimony: 1 } });
  var b = e.create('clue', { label: 'Rumour from Rattle', caseId: 'c1', aspects: { testimony: 1 } });
  assert.ok(a.loc.x === b.loc.x && a.loc.y === b.loc.y, 'twins stack');
  b.aspects = {};
  e.settleStacks();
  assert.ok(a.loc.x !== b.loc.x || a.loc.y !== b.loc.y, 'the changed one moves out');
  var c = e.create('clue', { label: 'Rumour from Rattle', caseId: 'c1', aspects: { testimony: 1 } });
  e.settleStacks();
  assert.ok(c.loc.x === a.loc.x && c.loc.y === a.loc.y, 'true twins stay together');
  console.log('settled stacks: ok');
})();

// Known to the Watch: one who walked strikes again, and their Abroad card laid
// beside the new case in Rest names them and gives their old record (once).
(function knownToTheWatch() {
  var e = CF.Engine.newGame({ calling: 'master', name: 'Known', seed: 71 });
  var rec0 = e.openCases()[0];
  e.goCold(rec0.id);
  var al = e.cardsOf('atlarge')[0];
  assert.ok(al && al.data.criminalId, 'the one who walked is Abroad');
  var crim = e.criminal(al.data.criminalId);
  var kc = e.spawnCase(e.criminalTrade(crim), { culpritName: crim.name, culpritTrait: crim.trait, criminalId: crim.id, headline: crim.name + ' Again: ', lead: 'The hand is familiar.' });
  var rec = e.caseRec(kc.caseId);
  assert.ok(e.autoSlot('reflect', kc.uid) && e.autoSlot('reflect', al.uid), 'the case and the Abroad card go into Rest');
  var pv = e.preview('reflect');
  assert.strictEqual(e.currentRecipe('reflect').recipe.id, 'ref_known', 'not Mull It Over: ' + pv.label);
  assert.ok(!pv.blocked && pv.label === 'Known to the Watch');
  assert.ok(e.start('reflect'));
  e.tick(e.verb('reflect').duration + 0.1);
  var out = e.verb('reflect').out.map(function (u) { return e.card(u); });
  var sc = out.filter(function (c) { return c.def === 'suspect'; })[0];
  assert.ok(sc && sc.data.key === rec.culprit, 'the culprit is named');
  var rc = out.filter(function (c) { return c.def === 'clue' && e.labelOf(c) === 'Their Old Record'; })[0];
  assert.ok(rc && rc.data.points === rec.culprit && !rc.data.misread && rc.data.trait === crim.trait, 'the old record points at them');
  assert.deepStrictEqual(rc.aspects, { testimony: 1, opportunity: 1 }, 'a name, not a proof');
  assert.ok(e.card(al.uid), 'the Abroad card stays until the conviction');
  e.collect('reflect');
  // Once a case.
  e.autoSlot('reflect', e.caseCard(rec.id).uid); e.autoSlot('reflect', al.uid);
  assert.notStrictEqual(e.currentRecipe('reflect').recipe.id, 'ref_known', 'the record is read once');
  e.clearSlots('reflect');
  // Another one's Abroad card does nothing for this case.
  var other = e.create('atlarge', { label: 'Abroad: Somebody Else', data: { name: 'Somebody Else', trait: 'lefty', criminalId: 'k999' } });
  var kc2 = e.spawnCase(e.criminalTrade(crim), { culpritName: crim.name, culpritTrait: crim.trait, criminalId: crim.id });
  e.autoSlot('reflect', kc2.uid); e.autoSlot('reflect', other.uid);
  assert.notStrictEqual(e.currentRecipe('reflect').recipe.id, 'ref_known', 'a stranger\'s record names nobody');
  console.log('known to the watch: ok');
})();

// A charge clears its case from the verbs at work on it: the Court says so before, and the verb says what went.
(function chargeEndsWork() {
  var e = CF.Engine.newGame({ calling: 'master', name: 'Busy', seed: 73 });
  var rec = e.openCases()[0], kase = e.caseCard(rec.id);
  e.autoSlot('investigate', kase.uid);
  assert.ok(e.start('investigate'), 'Explore works the case');
  e.verb('investigate').duration = 200;   // a long search: the charge lands first
  assert.deepStrictEqual(e.busyOnCase(rec.id), ['investigate']);
  var sus = e.revealSuspect(rec, null, { key: rec.culprit });
  e.autoSlot('arrest', sus.uid);
  e.autoSlot('arrest', e.create('clue', { caseId: rec.id, aspects: { forensic: 1 }, data: {} }).uid); // never a name alone
  var pv = e.preview('arrest');
  assert.ok(/Still at work on this case: Explore\. A charge now ends that work\./.test(pv.text), 'the Court warns: ' + pv.text);
  assert.ok(e.start('arrest'));
  e.tick(e.verb('arrest').duration + 0.1);
  var v = e.verb('investigate');
  assert.ok(v.lost && v.lost.caseId === rec.id, 'Explore knows what it lost');
  e.tick(v.duration);
  assert.strictEqual(v.story.title, 'Interrupted');
  assert.strictEqual(v.story.text, rec.title + ' went to the Court while you were at it.');
  assert.ok(!v.lost, 'and forgets it');
  // Work gone for another reason names the card, else the way.
  var g = CF.Engine.newGame({ calling: 'master', name: 'Gone2', seed: 74 });
  var w = g.create('witness', { label: 'Witness: Anna', data: { name: 'Anna', knows: 1 } });
  g.autoSlot('interrogate', w.uid); g.autoSlot('interrogate', g.cardsOf('focus')[0].uid);
  assert.ok(g.start('interrogate'));
  g.remove(w);
  g.tick(g.verb('interrogate').duration + 0.1);
  assert.strictEqual(g.verb('interrogate').story.text, 'Witness: Anna was gone before you finished. The city does not wait.');
  console.log('charge ends work: ok');
})();

// Asks are rationed: the same question from the same verb once a game week.
(function askRation() {
  var e = CF.Engine.newGame({ calling: 'crusader', name: 'Ration', seed: 75 });
  var kase = e.tableCards().filter(function (c) { return c.def === 'case'; })[0];
  var v = e.verb('investigate');
  e.autoSlot('investigate', kase.uid); e.start('investigate');
  e.tick(v.duration * 0.4);
  assert.ok(v.ask && v.ask.label === 'A locked door', 'the first search asks');
  assert.strictEqual(e.s.askSeen['A locked door|investigate'], e.s.week);
  e.tick(v.duration); e.collect('investigate');
  // Wit in the Manner: a search that would find two, so the door is worth asking (a one-find search never is).
  e.autoSlot('investigate', e.caseCard(kase.caseId).uid); e.autoSlot('investigate', e.create('focus').uid);
  assert.ok(e.start('investigate'));
  e.tick(v.duration * 0.4);
  assert.ok(!v.ask && v.askSkipped, 'not twice in one week');
  e.tick(v.duration); e.collect('investigate');
  assert.ok(!/stayed locked|wore you out/.test(v.story ? v.story.text : ''), 'and no miss for a question not put');
  // A new week asks again.
  e.s.week++;
  e.autoSlot('investigate', e.caseCard(kase.caseId).uid); e.autoSlot('investigate', e.create('focus').uid);
  assert.ok(e.start('investigate'));
  e.tick(v.duration * 0.4);
  assert.ok(v.ask, 'a week on, the door is locked again');
  // An older save has asked nothing yet.
  var old = JSON.parse(e.save()); delete old.askSeen;
  assert.deepStrictEqual(CF.Engine.load(old).s.askSeen, {});
  console.log('ask ration: ok');
})();

// An old save: the question on the table shows today's answers (the free one added since),
// and the Merciful count backfills from the criminal records.
(function oldSaveQuestionAndSentHome() {
  var e = CF.Engine.newGame({ calling: 'master', name: 'Swan', seed: 76, life: true });
  var swan = CF.CHOICES.filter(function (c) { return c.id === 'swan'; })[0];
  e.offerChoice(swan);
  var old = JSON.parse(e.save());
  old.choice.options = old.choice.options.slice(0, 2);   // written before 'Sleep at the desk'
  old.stats.sentHome = 0; delete old.askSeen;
  old.criminals.kA = { id: 'kA', name: 'Anna Pardoned', trait: 'lefty', crimes: 1, heat: 0, organization: 'none', traits: [], status: 'reformed', history: [{ week: 2, how: 'sentence:pardon' }] };
  old.criminals.kB = { id: 'kB', name: 'Bart Fined', trait: 'lefty', crimes: 1, heat: 0, organization: 'none', traits: [], status: 'reformed', history: [{ week: 3, how: 'sentence:fine' }] };
  old.criminals.kC = { id: 'kC', name: 'Cas Spared', trait: 'lefty', crimes: 2, heat: 0, organization: 'none', traits: ['spared'], status: 'at_large', history: [{ week: 3, how: 'sentence:pardon' }] };
  old.criminals.kD = { id: 'kD', name: 'Dirk Reformed', trait: 'lefty', crimes: 1, heat: 0, organization: 'none', traits: [], status: 'reformed', history: [] };
  var l = CF.Engine.load(old);
  assert.deepStrictEqual(l.s.choice.options.map(function (o) { return o.label; }), swan.options.map(function (o) { return o.label; }), 'the stored answers follow the question as asked now');
  assert.ok(l.s.choice.options.some(function (o, i) { return !o.cost && l.canChoose(i); }), 'a free answer is shown');
  assert.strictEqual(l.s.choice.title, e.s.choice.title, 'the wording asked is kept');
  assert.strictEqual(l.s.stats.sentHome, 4, 'two pardons, a fine and a citizen with no record: four sent home');
  // A live count already higher is kept; the ending never counts fewer sent than reformed.
  old.stats.sentHome = 9;
  assert.strictEqual(CF.Engine.load(old).s.stats.sentHome, 9);
  var m = CF.Engine.load(old); m.s.stats.sentHome = 0; m.s.choice = null;
  m.gameOver('merciful');
  assert.ok(m.s.stats.sentHome >= m.s.stats.reformed && m.s.stats.reformed === 3, 'sent ' + m.s.stats.sentHome + ', reformed ' + m.s.stats.reformed);
  console.log('old save question and sent home: ok');
})();

// ---- Lane 1, items 49-56: the opening never strands you; the Fever is told; a story in parts ----
(function openingLostAndFever() {
  function tbl(g, d) { return g.tableCards().filter(function (c) { return c.def === d; }); }
  function run(g, vid, cards) { cards.forEach(function (c) { g.autoSlot(vid, c.uid); }); assert.ok(g.start(vid), vid + ' starts: ' + JSON.stringify(g.preview(vid))); g.tick(g.verb(vid).duration + 0.01); g.collect(vid); g.tick(0.1); }
  // To the desk, the opening's case still open.
  function toDesk(seed) {
    var e = CF.Engine.newGame({ seed: seed, who: 'clerk', name: 'Lost', opening: true });
    run(e, 'duty', [tbl(e, 'health')[0]]); e.tick(41);
    run(e, 'duty', [tbl(e, 'health')[0]]);
    e.tick(e.verb('investigate').duration + 0.01); e.collect('investigate'); e.tick(0.1);
    e.tick(e.verb('interrogate').duration + 0.01); e.collect('interrogate'); e.tick(0.1);
    assert.strictEqual(e.s.flags.stage, 'hired');
    if (e.s.choice) e.choose(0);
    return e;
  }
  // The opening's case goes cold: the desk, the Bell and a new case within two weeks.
  var e = toDesk(31);
  var rec = e.openCases().filter(function (r) { return r.opening; })[0];
  e.goCold(rec.id);
  assert.strictEqual(rec.status, 'cold');
  assert.ok(!e.s.flags.opening && e.s.flags.stage === 'keep' && !e.s.flags.bellSilent && e.verb('time').unlocked, 'the desk and the Bell all the same');
  assert.strictEqual(e.s.flags.openingLost, 'cold');
  assert.ok(e.s.journal.some(function (j) { return j.title === 'The Desk All the Same'; }), 'and it is told');
  var at = null;
  for (var t = 0; t < 2 * CF.WEEK && at === null; t++) { e.tick(1); if (e.openCases().length) at = t; }
  assert.ok(at !== null, 'a new case within two weeks of the opening gone cold');
  // Lost to the Rival or settled by the thief-takers: the same.
  var r2 = toDesk(32), rr = r2.openCases().filter(function (r) { return r.opening; })[0];
  r2.rivalCloses(rr, 'Piet Wieland');
  assert.ok(!r2.s.flags.opening && r2.s.flags.stage === 'keep' && r2.s.flags.openingLost === 'rival', 'closed by the Rival: the desk is kept');
  var r3 = toDesk(33), sr = r3.openCases().filter(function (r) { return r.opening; })[0], settled = false;
  for (var k = 0; k < 20 && !settled; k++) { var c3 = CF.Engine.load(r3.save()); c3.rng.setState(k * 7 + 1); c3.thieftakersSettle(c3.caseRec(sr.id)); if (c3.caseRec(sr.id).status === 'settled') { settled = true; assert.ok(!c3.s.flags.opening && c3.s.flags.stage === 'keep', 'settled: the desk is kept'); } }
  assert.ok(settled, 'a settlement came in twenty tries');
  // A save already stranded (the case cold, the desk never kept): load gives the desk.
  var st = toDesk(34), srec = st.openCases().filter(function (r) { return r.opening; })[0];
  var old = JSON.parse(st.save()); old.cases[srec.id].status = 'cold';
  Object.keys(old.cards).forEach(function (u) { if (old.cards[u].caseId === srec.id && old.cards[u].def === 'case') delete old.cards[u]; });
  var lo = CF.Engine.load(old);
  assert.ok(!lo.s.flags.opening && lo.s.flags.stage === 'keep' && !lo.s.flags.bellSilent, 'a stranded save is given the desk on load');
  var at2 = null;
  for (var t2 = 0; t2 < 2 * CF.WEEK && at2 === null; t2++) { lo.tick(1); if (lo.openCases().length) at2 = t2; }
  assert.ok(at2 !== null, 'and a case comes');
  // A save mid-opening with its case open is left alone.
  var ok = CF.Engine.load(toDesk(35).save());
  assert.ok(ok.s.flags.opening && ok.s.flags.stage === 'hired', 'an opening still under way is not touched');

  // The Fever: told on arrival with its card, and half a minute before it ends the file.
  var f = CF.Engine.newGame({ seed: 36, calling: 'master' }), events = [];
  f.on(function (type, p) { if (type === 'strain' || type === 'pressing') events.push({ type: type, p: p }); });
  for (var i = 0; i < 3; i++) f.create('fatigue');
  f.checkThresholds();
  var fever = f.cardsOf('burnout', true)[0];
  assert.ok(fever, 'three Weariness: the Fever');
  var told = f.s.journal.filter(function (j) { return j.title === 'Fever'; })[0];
  assert.strictEqual(told.uid, fever.uid, 'the story carries the card, for the toast to take you there');
  assert.ok(events.some(function (x) { return x.type === 'strain' && x.p.uid === fever.uid && x.p.ends; }), 'and the interface is told: ' + JSON.stringify(events));
  f.tick(fever.life - 29);
  var warn = f.s.journal.filter(function (j) { return j.title === 'The Fever Worsens'; });
  assert.ok(warn.length === 1 && warn[0].uid === fever.uid && warn[0].kind === 'danger', 'half a minute before: a danger story with the card');
  assert.ok(events.some(function (x) { return x.type === 'pressing' && x.p.uid === fever.uid && x.p.ends; }), 'and pressing is emitted');
  f.tick(1);
  assert.strictEqual(f.s.journal.filter(function (j) { return j.title === 'The Fever Worsens'; }).length, 1, 'told once');

  // A story in parts: each sentence kept whole, the text their join.
  var p = CF.Engine.newGame({ seed: 37, calling: 'master' });
  var en = p.story('Week 9', ['Lodging and dues take 2.', '', 'The Council\'s stipend: 1 Coin.'], 'week');
  assert.deepStrictEqual(en.parts, ['Lodging and dues take 2.', 'The Council\'s stipend: 1 Coin.']);
  assert.strictEqual(en.text, 'Lodging and dues take 2. The Council\'s stipend: 1 Coin.');
  assert.strictEqual(p.story('Plain', 'One text.').parts, undefined, 'a plain story has no parts');
  p.tick(CF.WEEK - p.s.weekT + 0.01);
  var wk = p.s.journal.filter(function (j) { return j.kind === 'week'; })[0];
  assert.ok(wk && wk.parts && wk.parts.length >= 2 && wk.text === wk.parts.join(' '), 'the Bell tells its week in parts');
  assert.ok(wk.parts.some(function (x) { return /^The ledger: /.test(x); }), 'the ledger is one part');
  console.log('opening lost, the Fever told, a story in parts: ok');
})();

// ---- Tidy closes up empty zones ---------------------------------------------
(function tidyCollapses() {
  function g_label(e, c) { return e.labelOf(c); }
  [3, 11, 29].forEach(function (seed) {
    var e = CF.Engine.newGame({ seed: seed, calling: 'master' });
    e.tidy();
    var deep = T.TOP + 3 * (T.CH + T.GAP);
    e.tableCards().forEach(function (c) {
      assert.ok(c.loc.y <= deep, 'seed ' + seed + ': ' + g_label(e, c) + ' at y ' + c.loc.y + ' (deepest row ' + deep + ')');
    });
  });
  // The order of the zones is kept: a district opens its row above the kit.
  var g = CF.Engine.newGame({ seed: 5, calling: 'master' });
  var d = g.create('district', { label: 'The Harbour' });
  var kit = g.tableCards().filter(function (c) { return g.kindOf(c) === 'personnel' || g.kindOf(c) === 'equipment'; });
  g.tidy();
  assert.ok(g.zoneRow('district') < g.zoneRow('personnel'), 'districts stay above the kit');
  kit.forEach(function (c) { assert.ok(c.loc.y > d.loc.y, g_label(g, c) + ' below the district'); });
  console.log('tidy closes up empty zones: ok');
})();

// ---- Round 8, lane 1, items 57-64 ------------------------------------------------
(function round8Late() {
  // The verdict says where it happened: the trial card's uid and spot, and a cold case's card.
  var e = CF.Engine.newGame({ seed: 61, calling: 'master' });
  var events = [];
  e.on(function (type, p) { if (type === 'resolved') events.push(p); });
  var cc = e.spawnCase('burglary', { quiet: true }), rec = e.caseRec(cc.caseId);
  var cul = rec.suspects.filter(function (x) { return x.guilty; })[0];
  rec.status = 'trial'; e.remove(cc);
  var trial = e.create('trial', { data: { caseId: rec.id, name: cul.name, guilty: true, solid: true, tier: 'strong', real: 9, need: 6, coerced: 0, planted: 0, contradictions: 0 } });
  var at = { x: trial.loc.x, y: trial.loc.y };
  e.verdict(trial);
  assert.strictEqual(events[0].uid, trial.uid, 'the verdict names the trial card');
  assert.deepStrictEqual(events[0].at, at, 'and where it lay');
  var cc2 = e.spawnCase('burglary', { quiet: true });
  e.goCold(cc2.caseId);
  assert.strictEqual(events[1].outcome, 'cold');
  assert.strictEqual(events[1].uid, cc2.uid, 'a case gone cold names its own card, not the Court');

  // Who struck the last blow, and an ending that can name it.
  var d = CF.Engine.newGame({ seed: 62, calling: 'master' });
  d.cardsOf('health', true).concat(d.cardsOf('spent_health', true)).forEach(function (c) { d.remove(c); });
  d.create('wound');
  d.hurtYou('A blade under the ribs.', 'order');
  assert.ok(d.s.over && d.s.over.id === 'death');
  assert.strictEqual(d.s.stats.killedBy, 'order');
  assert.ok(d.s.journal.some(function (j) { return j.title === 'The Last Blow'; }), 'the blow is told as itself');
  assert.ok(!d.s.journal.some(function (j) { return j.title === 'In the Council\'s Service'; }), 'and not as a second ending title');
  // One number helper: the engine's counts in words are the chronicle's (Story.words).
  assert.strictEqual(CF.numberWord(0), CF.Story.words(0));
  assert.strictEqual(CF.numberWord(7, true), 'Seven');
  assert.strictEqual(CF.numberWord(15), '15');

  // The locked door is the scene's own.
  var a = CF.Engine.newGame({ seed: 65, calling: 'master' });
  var hc = a.spawnCase('harbor', { quiet: true }), bc = a.spawnCase('burglary', { quiet: true });
  var hs = a.askSpec({ id: 'investigate', recipe: 'inv_search', ctxSlots: { main: hc.uid } });
  assert.strictEqual(hs.label, 'A battened hatch');
  assert.ok(/hatch/.test(hs.miss) && hs.accepts.indexOf('instinct') >= 0 && hs.penalty === 'thin', 'the rest of the ask is kept');
  assert.strictEqual(hs.base, 'A locked door', 'rationed as the one question');
  assert.strictEqual(a.askSpec({ id: 'investigate', recipe: 'inv_search', ctxSlots: { main: bc.uid } }).label, 'A locked door', 'a house keeps its back room');

  // Sleep: paid at the Swan; unpaid, one of the nights.
  var sl = CF.Engine.newGame({ seed: 66, calling: 'master' });
  var fat = sl.create('fatigue'), coin = sl.cardsOf('funds')[0] || sl.create('funds');
  sl.autoSlot('reflect', fat.uid); sl.autoSlot('reflect', coin.uid);
  assert.strictEqual(sl.currentRecipe('reflect').recipe.id, 'ref_fatigue');
  assert.ok(sl.start('reflect')); sl.tick(sl.verb('reflect').duration + 0.01);
  assert.ok(/the Swan/.test(sl.verb('reflect').story.text), sl.verb('reflect').story.text);
  sl.collect('reflect');
  var fat2 = sl.create('fatigue');
  sl.autoSlot('reflect', fat2.uid);
  assert.ok(sl.start('reflect')); sl.tick(sl.verb('reflect').duration + 0.01);
  assert.ok(/sleep|Ten hours/.test(sl.verb('reflect').story.text) && !/the Swan/.test(sl.verb('reflect').story.text));

  // A faded token goes into the week's ledger; one that named the culprit is told on its own.
  var f = CF.Engine.newGame({ seed: 67, calling: 'master' });
  f.s.flags.firstCase = true;
  var fr = f.caseRec(f.spawnCase('burglary', { quiet: true }).caseId), fcul = fr.suspects.filter(function (x) { return x.guilty; })[0];
  var plain = f.create('clue', f.clueSpec(fr, { label: 'A Smudge', text: 'A smudge.', aspects: { forensic: 1 } }, [], { noMisread: true }));
  var mark = f.create('clue', f.clueSpec(fr, { label: 'The Ring Mark', text: 'A ring.', aspects: { forensic: 1 }, trait: fcul.trait }, [], { noMisread: true }));
  plain.life = 0.5; mark.life = 0.5;
  f.tick(1);
  assert.ok(!f.card(plain.uid) && !f.card(mark.uid), 'both faded');
  var told = f.s.journal.filter(function (j) { return j.title === 'The Trail Fades'; });
  assert.strictEqual(told.length, 1, 'only the token that named the culprit is a story');
  assert.ok(told[0].text.indexOf('The Ring Mark') === 0);
  assert.deepStrictEqual(f.s.weekFaded, ['A Smudge']);
  f.tick(CF.WEEK - f.s.weekT + 0.01);
  var fw = f.s.journal.filter(function (j) { return j.kind === 'week'; })[0];
  assert.ok(fw.parts.indexOf('Gone stale this week: A Smudge.') >= 0, fw.text);
  assert.deepStrictEqual(f.s.weekFaded, [], 'and the list starts again');

  // Where proof comes from: only the ways open to this desk today.
  var w = CF.Engine.newGame({ seed: 68, calling: 'master' });
  var wr = w.caseRec(w.spawnCase('burglary', { quiet: true }).caseId);
  w.cardsOf('district', true).forEach(function (c) { w.remove(c); });
  w.s.rank = 0; w.s.rooms.archive = false;
  assert.deepStrictEqual(w.aspectSources('digital', wr), ['ledgers and papers read in Study'], 'no Writ and no Rolls for a junior without them');
  assert.deepStrictEqual(w.aspectSources('testimony', wr.id), ['the accused confronted with a token in Question']);
  w.giveDistrict(wr.district);
  assert.ok(w.aspectSources('testimony', wr).indexOf('door to door with ' + CF.DISTRICTS[wr.district].label) >= 0, 'the Quarter on the table opens door to door');
  w.s.rank = 1; w.s.rooms.archive = true;
  assert.strictEqual(w.aspectSources('digital', wr).length, 3);
  // The opening case's own Quarter at the hire: from the stash if it waits there, once.
  var o = CF.Engine.newGame({ seed: 69, calling: 'master' });
  o.cardsOf('district', true).forEach(function (c) { o.remove(c); });
  var orc = o.caseRec(o.spawnCase('burglary', { quiet: true }).caseId);
  orc.opening = true; o.s.flags.stage = 'hired';
  o.s.intro = { stash: [{ def: 'district', spec: { label: CF.DISTRICTS[orc.district].label, desc: '', data: { district: orc.district } } }, { def: 'informant', spec: {} }] };
  var q = o.openingQuarter();
  assert.ok(q && q.data.district === orc.district, 'the case\'s own Quarter');
  assert.deepStrictEqual(o.s.intro.stash.map(function (x) { return x.def; }), ['informant'], 'only that card leaves the stash');
  assert.strictEqual(o.openingQuarter(), null, 'once');

  // The Rival: a thread goes slack; a case they took answered first is a thread, then the end of them.
  var r = CF.Engine.newGame({ seed: 70, calling: 'master' });
  r.s.week = 6;
  var rv = r.create('rival', { label: 'The Rival: Piet Wieland', data: { name: 'Piet Wieland', heat: 1, stalled: 0, heatWeek: r.s.week - 2, heatHow: 'question' } });
  assert.deepStrictEqual(r.rivalFade(), [], 'two weeks: still taut');
  rv.data.heatWeek = r.s.week - CF.RIVAL_THREAD_WEEKS;
  assert.deepStrictEqual(r.rivalFade(), ['The thread on Piet Wieland has gone slack. Find another.']);
  assert.strictEqual(rv.data.heat, 0);
  // An older save's thread (no week) starts its clock at the next Bell, not slack at once.
  var oldThread = r.create('rival', { label: 'The Rival: Jan Smit', data: { name: 'Jan Smit', heat: 1, stalled: 0, heatWeek: -1 } });
  r.remove(rv);
  assert.deepStrictEqual(r.rivalFade(), [], 'an old thread is not slack at once');
  assert.strictEqual(oldThread.data.heatWeek, r.s.week);
  r.remove(oldThread);
  rv = r.create('rival', { label: 'The Rival: Piet Wieland', data: { name: 'Piet Wieland', heat: 0, stalled: 0, heatWeek: null } });
  var rr = r.caseRec(r.spawnCase('burglary', { quiet: true }).caseId), rcul = rr.suspects.filter(function (x) { return x.guilty; })[0];
  rr.rival = true;
  assert.ok(r.rivalWork(r.caseCard(rr.id)), 'the case they took is their work');
  var bw = r.create('witness', { label: 'Witness: the Tiler', data: { bribed: true } });
  assert.ok(r.rivalWork(bw) && !r.rivalWork(r.create('witness', { label: 'Witness: the Cooper', data: {} })), 'a paid witness is, an honest one is not');
  r.onConviction(rr, { name: rcul.name, guilty: true }, []);
  assert.strictEqual(rv.data.heat, 1, 'beaten on their case: a thread');
  assert.ok(r.s.journal.some(function (j) { return j.title === 'Quicker than the Customs House'; }));
  var rep = r.s.meters.reputation;
  var rr2 = r.caseRec(r.spawnCase('burglary', { quiet: true }).caseId); rr2.rival = true;
  r.onConviction(rr2, { name: rr2.suspects[0].name, guilty: true }, []);
  assert.strictEqual(r.cardsOf('rival', true).length, 0, 'a second time: exposed');
  assert.strictEqual(r.s.meters.reputation, rep + 1);
  assert.strictEqual(r.s.stats.rivalExposed, 1);

  // An older save: the new fields default.
  var old = JSON.parse(CF.Engine.newGame({ seed: 71 }).save());
  delete old.weekFaded; delete old.stats.killedBy; if (old.weekSnap) delete old.weekSnap.favour;
  var ol = CF.Engine.load(old);
  assert.deepStrictEqual(ol.s.weekFaded, []);
  assert.strictEqual(ol.s.stats.killedBy, null);
  assert.ok(ol.s.weekSnap.favour && ol.s.weekSnap.favour.council === 0);
  console.log('round 8 late: the verdict\'s seat, the last blow, the scene\'s own door, faded trails, open ways, the Rival caught: ok');
})();

// ---- A render pass's memo (round 8): slot reach and verb locks asked once per pass --------------
(function renderMemo() {
  var bot = require('./bot.test.js');
  var g = CF.Engine.newGame({ seed: 2, calling: 'master' });
  bot.play(g, 60 * 12);
  var cards = g.tableCards();
  var plain = cards.map(function (c) { return g.unavailableReason(c); });
  var calls = 0, orig = g.slotReachableNow;
  g.slotReachableNow = function (vid, sl) { calls++; return orig.call(this, vid, sl); };
  var memoed = g.withMemo(function () { return cards.map(function (c) { return g.unavailableReason(c); }); });
  assert.deepStrictEqual(memoed, plain, 'the memo gives the same answers');
  var keys = {};
  CF.VERB_ORDER.forEach(function (vid) { CF.VERBS[vid].slots.forEach(function (sl) { keys[vid + '|' + sl.key] = true; }); });
  assert.ok(calls <= Object.keys(keys).length, 'each slot reached once a pass: ' + calls);
  assert.strictEqual(g._memo, null, 'cleared after the pass');
  calls = 0;
  cards.forEach(function (c) { g.unavailableReason(c); });
  assert.ok(calls > 0, 'without a pass, nothing is remembered');
  // Cleared even when the pass throws.
  try { g.withMemo(function () { throw new Error('x'); }); } catch (err) { /* expected */ }
  assert.strictEqual(g._memo, null, 'cleared after a throw');
  assert.ok(g.save().indexOf('_memo') < 0, 'never saved');
  console.log('render memo: ok (' + cards.length + ' cards)');
})();

// ---- One Petition per room, at the Clerk's price --------------------------------
// The Watch-house board and the Petitions the second conviction opens share
// one spec and one rule: never two Petitions for the same thing.
(function onePetition() {
  var e = CF.Engine.newGame({ seed: 812, calling: 'master', who: 'clerk' });
  var spec = e.orderSpec('locker');
  assert.strictEqual(spec.data.discount, 1, 'the Clerk\'s discount is on the spec');
  assert.strictEqual(CF.costOf(spec), CF.ORDERS.locker.cost - 1, 'and on its price');
  var first = e.petition('locker');
  assert.ok(first && first.data.discount === 1, 'a Petition from the board keeps the discount');
  assert.strictEqual(e.petition('locker'), null, 'a second one is refused');
  e.s.stats.convictions = 2;
  e.openTheCity();
  var lockers = e.cardsOf('order', true).filter(function (c) { return c.data.order === 'locker'; });
  assert.strictEqual(lockers.length, 1, 'the Petitions opened later do not repeat it');
  assert.ok(e.cardsOf('order', true).some(function (c) { return c.data.order === 'prints'; }), 'the others arrive');
  e.removeOrder('kit');
  assert.strictEqual(e.petition('kit'), null, 'nothing already granted');
  var plain = CF.Engine.newGame({ seed: 813, calling: 'master' });
  assert.strictEqual(plain.orderSpec('locker').data.discount, 0, 'no discount for other origins');
  console.log('one petition per room: ok');
})();

// ---- The Bell's week tells whether it was paid, and which Coin is the stipend ----------
(function bellWeek() {
  var e = CF.Engine.newGame({ seed: 814, calling: 'master' });
  e.s.flags.bellSilent = false;
  e.cardsOf('funds', true).forEach(function (c) { e.remove(c); });
  var heard = [];
  e.on(function (type, p) { if (type === 'salary') heard.push(p); });
  e.weekTick();
  var wk = e.s.journal.filter(function (j) { return j.kind === 'week'; })[0];
  assert.ok(wk && wk.paid === false, 'an unpaid week says so');
  assert.ok(wk.uids.length >= 1 && wk.uids.every(function (u) { return e.card(u) && e.card(u).def === 'funds'; }), 'and names the stipend Coin');
  assert.ok(heard.length === 1 && heard[0].paid === false && heard[0].uids.join() === wk.uids.join(), 'the salary event carries them');
  for (var i = 0; i < e.dues(); i++) e.create('funds');
  e.weekTick();
  wk = e.s.journal.filter(function (j) { return j.kind === 'week'; })[0];
  assert.strictEqual(wk.paid, true, 'a paid week says so');
  // The verb window's first look: the basics, and the powers by office.
  var info = e.verbInfo('investigate');
  assert.ok(info.basics && info.basics.indexOf('Disguise') < 0, 'a junior reads only what a junior can do');
  assert.ok(info.powers.length >= 3 && info.powers.every(function (p) { return p.open === false && p.rankLabel; }), 'the office powers are listed, shut, with their office');
  e.s.rank = 2;
  assert.ok(e.verbInfo('investigate').powers.every(function (p) { return p.open; }), 'and open at their rank');
  assert.strictEqual(e.verbInfo('reflect').basics, CF.VERBS.reflect.desc, 'a verb with no basics shows its description');
  console.log('the Bell\'s week, the verb\'s first look: ok');
})();

// ---- A blow takes the idle Health first; a Mark stays through what the card becomes ----------
(function blowAndMark() {
  var e = CF.Engine.newGame({ seed: 4, calling: 'master', life: true });
  e.create('health'); // a second Health, on the table
  var walking = e.cardsOf('health').filter(function (c) { return c.loc.t === 'table'; })[0];
  assert.ok(e.autoSlot('duty', walking.uid) && e.start('duty'), 'one Health walks the round');
  var idle = e.cardsOf('health').filter(function (c) { return c.uid !== walking.uid; })[0];
  assert.ok(idle, 'another waits');
  e.hurtYou('A cudgel on the stair.');
  assert.ok(e.card(walking.uid) && walking.loc.t === 'held', 'the round keeps its Health');
  assert.ok(!e.card(idle.uid), 'the blow takes the one lying idle');
  var guard = 0;
  while (e.verb('duty').status === 'running' && guard++ < 400) e.tick(1);
  assert.notStrictEqual(e.verb('duty').story && e.verb('duty').story.title, 'Interrupted', 'the round is not interrupted');

  // The player's Mark on a Health: spent by the round, and back again, still marked.
  var m = CF.Engine.newGame({ seed: 5, calling: 'master', life: true });
  var hp = m.cardsOf('health').filter(function (c) { return c.loc.t === 'table'; })[0];
  hp.data = hp.data || {}; hp.data.mark = true;
  var shared = { kind: 'x' };
  assert.ok(m.autoSlot('duty', hp.uid) && m.start('duty'));
  guard = 0;
  while (m.verb('duty').status === 'running' && guard++ < 400) m.tick(1);
  assert.notStrictEqual(hp.def, 'health', 'spent by the round: ' + hp.def);
  assert.ok(hp.data.mark, 'the spent card keeps its Mark');
  m.transform(hp, 'health', { data: shared });
  assert.ok(hp.data.mark && hp.data.kind === 'x', 'restored, still marked, with the new data');
  assert.ok(shared.mark === undefined, 'a shared spec is copied, not marked');
  var plainHp = m.create('health');
  m.transform(plainHp, 'evidence', {});
  assert.ok(!plainHp.data.mark, 'an unmarked card stays unmarked');
  console.log('the blow takes the idle Health, the Mark stays: ok');
})();

// ---- The second ring of Insights: each office's own work teaches ----------------------------
(function secondRing() {
  var g = CF.Engine.newGame({ seed: 71, calling: 'master' });
  function ids(ab) { return CF.growthWays(g, ab).map(function (w) { return w.id; }); }
  assert.deepStrictEqual(ids('health'), ['fencing', 'iron'], 'an Examiner sees only the first ring');
  ['writ', 'nightdoor', 'whitestaff', 'crier', 'eyes', 'muster'].forEach(function (id) {
    var sp = CF.INSIGHTS[id];
    assert.ok(sp.rank >= 1 && sp.how && sp.perk && sp.perkText && sp.lesson && sp.faster.every(function (r) { return CF.RECIPES_BY_ID[r]; }), id + ': opens with an office, says how, and speeds real work');
    assert.ok(g.perkId(id), id + ': a perk');
  });
  g.s.stats.recipes = { undercover_op: 2, warrant_search: 2 };
  g.s.rank = 1; g.growthTick();
  assert.ok(g.s.insights.writ && !g.s.insights.whitestaff, 'the Writ teaches a Sworn Examiner; Disguise waits for the Bailiff');
  assert.ok(ids('focus').indexOf('writ') >= 0 && ids('health').indexOf('whitestaff') < 0);
  g.s.rank = 2; g.growthTick();
  assert.ok(g.s.insights.whitestaff, 'the staff, and the Insight it was owed');
  // Kept as a trick: that work goes a third quicker.
  var R = CF.RECIPES_BY_ID.taskforce_run;
  var d0 = g.durationOf(R, { verb: 'duty' });
  g.s.perks = { column: true };
  assert.strictEqual(g.perkPace('taskforce_run'), 2 / 3);
  assert.strictEqual(g.perkPace('duty_beat'), 1, 'only its own work');
  assert.ok(g.durationOf(R, { verb: 'duty' }) < d0, 'Calling Out the Watch is quicker');
  // The promotion says the office's lessons.
  var p = CF.Engine.newGame({ seed: 72, calling: 'master' });
  p.s.rank = 1; p.promote();
  var told = p.s.journal.filter(function (j) { return j.title === 'The Office Teaches'; })[0];
  assert.ok(told && told.text.indexOf('The Night Door') >= 0 && told.text.indexOf('The White Staff') >= 0, 'the Bailiff is told what his office teaches');
  console.log('the second ring of Insights: ok');
})();

// ---- Informers: no two of a name; the Bench cools them and seats a new one; their Quarter counts ----
(function informers() {
  var g = CF.Engine.newGame({ seed: 73, calling: 'master' });
  g.cardsOf('informant', true).forEach(function (c) { g.remove(c); });
  var names = [];
  for (var i = 0; i < 9; i++) names.push(g.create('informant', g.informantSpec('market')).data.name);
  assert.strictEqual(names.slice(0, 8).filter(function (n, k) { return names.indexOf(n) === k; }).length, 8, 'eight nicknames, no two alike: ' + names.join(', '));
  assert.ok(/ the Younger$/.test(names[8]) && names.indexOf(names[8]) === 8, 'the ninth is somebody\'s junior: ' + names[8]);
  // The Bench: heat falls at the Bell, and a Compromised informer comes back.
  var b = CF.Engine.newGame({ seed: 74, calling: 'master' });
  b.cardsOf('informant', true).forEach(function (c) { b.remove(c); });
  var inf = b.create('informant', b.informantSpec('market'));
  b.heatInformant(inf, 3);
  assert.strictEqual(b.informantStatus(inf), 'compromised');
  assert.deepStrictEqual(b.benchWeek(), [], 'no Bench, nothing');
  b.s.rooms.intel = true;
  b.s.week = 5;
  var lines = b.benchWeek();
  assert.ok(inf.data.heat === 2 && b.informantStatus(inf) === 'safe' && /^Informer: /.test(inf.label) && lines.length === 1, 'the Bench cools them');
  b.s.week = 8;
  b.benchWeek();
  assert.strictEqual(b.cardsOf('informant', true).length, 2, 'every fourth week, a new face on the Bench');
  assert.ok(b.s.journal.some(function (j) { return j.title === 'A New Face on the Bench'; }));
  assert.deepStrictEqual(b.roomUseText('intel'), { text: 'One front named or informer seated', vars: { n: 1 }, n: 1 }, 'the Bench is credited');
  b.create('informant', b.informantSpec('market')); b.s.week = 12; b.benchWeek();
  assert.strictEqual(b.cardsOf('informant', true).length, 3, 'three seated: no more');
  assert.ok(/cool off here every week/.test(CF.ROOMS.intel.desc) && !/Coquille/.test(CF.ROOMS.intel.desc), 'the Bench says what it does');
  // A rumour is three times as likely from the informer's own Quarter.
  var own = 0, cases = [{ district: 'docks' }, { district: 'market' }];
  for (var r = 0; r < 400; r++) if (b.pickByQuarter(cases, 'docks').district === 'docks') own++;
  assert.ok(own > 260 && own < 340, 'their own Quarter weighs three to one: ' + own + ' of 400');
  // Met in their own Quarter: Word +1, and no heat.
  var m = CF.Engine.newGame({ seed: 75, calling: 'master' });
  m.cardsOf('informant', true).forEach(function (c) { m.remove(c); });
  var rec = m.caseRec(m.spawnCase('burglary', { quiet: true }).caseId);
  var mi = m.create('informant', m.informantSpec('docks'));
  var dk = m.giveDistrict('docks'), coin = m.create('funds');
  m.verb('investigate').unlocked = true;
  [mi, coin, dk].forEach(function (c) { assert.ok(m.autoSlot('investigate', c.uid), 'slots ' + m.labelOf(c)); });
  assert.strictEqual(m.currentRecipe('investigate').recipe.id, 'patrol_informant');
  assert.ok(/In their own Quarter/.test(m.preview('investigate').text || JSON.stringify(m.preview('investigate'))));
  assert.ok(m.start('investigate'));
  for (var t = 0; t < 100 && m.verb('investigate').status === 'running'; t++) m.tick(1);
  assert.strictEqual(mi.data.heat, 0, 'no heat met at home');
  var word = m.verb('investigate').out.map(function (u) { return m.card(u); }).filter(function (c) { return c && c.def === 'clue' && c.caseId === rec.id; })[0];
  assert.ok(word, 'a word about the case'); assert.strictEqual(CF.clueAspects(word).testimony, 3, 'and their word is worth more');
  console.log('informers: one of each name, the Bench, the Quarter: ok');
})();

// ---- What the rooms did for you: counted where they work, kept in the save -------------------
(function roomUse() {
  var g = CF.Engine.newGame({ seed: 76, calling: 'master' });
  g.roomUsed('suite');
  assert.strictEqual(g.roomUseText('suite'), null, 'a room not built is not credited');
  g.s.rooms.suite = true;
  var rec = g.caseRec(g.spawnCase('burglary', { quiet: true }).caseId);
  var w = g.create('witness', g.witnessSpec(rec)), wit = g.create('focus');
  g.verb('interrogate').unlocked = true;
  assert.ok(g.autoSlot('interrogate', w.uid) && g.autoSlot('interrogate', wit.uid) && g.start('interrogate'));
  for (var t = 0; t < 100 && g.verb('interrogate').status === 'running'; t++) g.tick(1);
  assert.deepStrictEqual(g.roomUseText('suite'), { text: 'One questioning with more Word', vars: { n: 1 }, n: 1 }, 'the Hole: a questioning with more Word');
  g.roomUsed('suite', 5);
  assert.strictEqual(g.roomUseText('suite').text, '{n} questionings with more Word');
  CF.ROOM_ORDER.forEach(function (k) { assert.ok(CF.ROOM_USE[k] && CF.ROOM_USE[k].length === 2, k + ': one and many'); });
  var old = JSON.parse(g.save()); delete old.roomUse;
  assert.deepStrictEqual(CF.Engine.load(old).s.roomUse, {}, 'an older save counts from now');
  console.log('what the rooms did: ok');
})();

// ---- How a card leaves: the engine says why, for the table to show it (round 8) ----
(function goneWhy() {
  var e = CF.Engine.newGame({ seed: 180, calling: 'master' });
  var seen = {};
  e.on(function (type, p) { if (type === 'gone') seen[p.uid] = p.why; });
  // A Health taken for good by a need run out: lost.
  e.create('health');
  var hp = e.cardsOf('health').map(function (c) { return c.uid; });
  var need = e.create('hunger', { lifetime: 1 });
  e.needExpired(need);
  var gone = hp.filter(function (u) { return !e.card(u); })[0];
  assert.ok(gone && seen[gone] === 'lost', 'a Health lost for good burns: ' + seen[gone]);
  // A token gone stale: faded. A witness leaving the city: left. A purse taken back: left.
  var rec = e.openCases()[0];
  var clue = e.create('clue', { label: 'A Thread', caseId: rec.id, aspects: { opportunity: 1 } });
  var wit = e.create('witness', e.witnessSpec(rec));
  var purse = e.create('bribe');
  e.expire(clue); e.expire(wit); e.expire(purse);
  assert.strictEqual(seen[clue.uid], 'faded');
  assert.strictEqual(seen[wit.uid], 'left');
  assert.strictEqual(seen[purse.uid], 'left');
  // Coin paid at the Bell: spent. A blow: wounded.
  var coins = e.cardsOf('funds').map(function (c) { return c.uid; });
  e.s.flags.firstCase = true; e.weekTick();
  assert.ok(coins.some(function (u) { return seen[u] === 'spent'; }), 'the Bell\'s dues are spent');
  var h2 = e.cardsOf('health')[0];
  e.hurtYou('A blow.', 'test');
  assert.strictEqual(seen[h2.uid], 'wounded');
  // A case card cleared, or a token taken by a recipe, says nothing.
  var plain = e.create('clue', { label: 'Plain', caseId: rec.id, aspects: { motive: 1 } });
  e.remove(plain);
  assert.strictEqual(seen[plain.uid], undefined, 'an ordinary removal is silent');
  console.log('how a card leaves: ok');
})();

// ---- A name to match the role: a nephew is a man, a niece a woman, whose they are does not count (round 8) ----
(function namesByRole() {
  var P = CF.Engine.prototype;
  assert.strictEqual(P.sexOf('a nephew of the house'), 'm');
  assert.strictEqual(P.sexOf('the victim\'s brother'), 'm');
  assert.strictEqual(P.sexOf('a wool-merchant\'s son'), 'm');
  assert.strictEqual(P.sexOf('a journeyman turned off'), 'm');
  assert.strictEqual(P.sexOf('the widow\'s son'), 'm', 'the widow is whose he is');
  assert.strictEqual(P.sexOf('the miller\'s wife'), 'f');
  assert.strictEqual(P.sexOf('the child\'s older sister'), 'f');
  assert.strictEqual(P.sexOf('a niece of the Bishop'), 'f');
  assert.strictEqual(P.sexOf('the midwife'), 'f');
  assert.strictEqual(P.sexOf('a person of no account'), null, 'a person is either');
  assert.strictEqual(P.sexOf('the mason'), null, 'a mason is not a son');
  // Every accused named for a role that says its sex gets a name of that sex, and keeps it on the record.
  for (var i = 0; i < 30; i++) {
    var e = CF.Engine.newGame({ seed: 190 + i, calling: 'master' });
    var rec = e.caseRec(e.spawnCase('burglary', { quiet: true }).caseId);
    rec.suspects.forEach(function (x) {
      var want = P.sexOf(x.role);
      if (want) assert.strictEqual(e.sexOfName(x.name), want, x.name + ', ' + x.role);
      assert.ok(x.sex === want || (!want && x.sex === e.sexOfName(x.name)), 'the record keeps the sex: ' + x.name);
    });
  }
  // An older save's accused are given theirs on load.
  var g = CF.Engine.newGame({ seed: 221, calling: 'master' }), old = JSON.parse(g.save());
  Object.keys(old.cases).forEach(function (k) { old.cases[k].suspects.forEach(function (x) { delete x.sex; }); });
  var l = CF.Engine.load(old);
  l.openCases().forEach(function (r) { r.suspects.forEach(function (x) { assert.ok(x.sex !== undefined, 'migrated'); }); });
  console.log('names by role: ok');
})();

// ---- The engine says it the way the table reads it (round 8 handoffs) ------------------------
(function handoffs() {
  // The Council's count, as the Bell's pane reads it.
  var e = CF.Engine.newGame({ seed: 171, calling: 'master' });
  assert.strictEqual(e.councilQuota(), null, 'nothing counted of an Examiner');
  e.s.rank = 2; e.councilCountWeek(); e.s.stats.convictions += 1;
  var ex = e.councilExpects(), q = e.councilQuota();
  assert.deepStrictEqual([q.closed, q.expect], [ex.n, ex.m], 'the quota is the count: ' + JSON.stringify(q));
  // A road carries its line in the journal's own field.
  e.s.counts.mercy = 2;
  var roads = e.roads();
  assert.ok(roads.length >= 1, 'a mercy opens a road');
  roads.forEach(function (r) { assert.ok(typeof r.text === 'string' && r.text === r.want, 'the road says what it wants: ' + JSON.stringify(r)); });
  // Harm is marked as harm.
  var hurt = e.story('Wounded', 'A blow.', 'danger', { cue: 'harm' }), omen = e.story('An Omen', 'A crow.', 'danger');
  assert.ok(hurt.harm === true && !omen.harm, 'harm, and only harm, is marked');
  // A verdict names its case.
  var rec = e.openCases()[0], record = e.caseRecord(rec, 'cold', null);
  assert.strictEqual(record.caseId, rec.id, 'the record keeps the case id');
  // The opening's pile sits a row higher; a plain start keeps it where it was.
  var op = CF.Engine.newGame({ seed: 172, who: 'clerk', opening: true });
  assert.strictEqual(op.pile().y, T.TOP, 'the opening pile: the first row under the verbs');
  op.tableCards().forEach(function (c) { assert.strictEqual(c.loc.y, T.TOP, c.def + ' within the short table'); });
  assert.strictEqual(e.pile().y, T.TOP + 2 * T.PY, 'a plain start: as before');
  // An older opening save without its asides gets an empty set.
  var old = JSON.parse(op.save());
  delete old.intro.asides;
  assert.deepStrictEqual(CF.Engine.load(old).s.intro.asides, {}, 'asides migrated');
  // A weakness found tells the move the Bell will see them make.
  var g = CF.Engine.newGame({ seed: 173, calling: 'master' });
  g.s.week = 8;
  for (var w = 0; w < 8 && !g.cardsOf('rival', true).length; w++) g.rivalWeek();
  var r = g.cardsOf('rival', true)[0];
  assert.ok(r, 'a Rival to find');
  g.openCases().forEach(function (x) { x.searches = 1; x.week = g.s.week - 2; x.rival = false; });
  var wit = g.tableCards().filter(function (c) { return c.def === 'focus'; })[0] || g.create('focus');
  g.autoSlot('interrogate', r.uid); g.autoSlot('interrogate', wit.uid);
  assert.strictEqual(g.currentRecipe('interrogate').recipe.id, 'int_rival_weakness');
  assert.ok(g.start('interrogate')); g.tick(g.verb('interrogate').duration + 0.01);
  var next = r.data.next, found = g.verb('interrogate').story;
  assert.ok(next && next.act, 'a move foreseen: ' + JSON.stringify(next));
  assert.ok(/ at the next Bell/.test(found.text), 'and told: ' + found.text);
  console.log('handoffs: ok');
})();

// ---- The verbs check-up: what an ask's words promise, the work keeps; what the Rival's desk gives is a find.
(function verbsCheckup() {
  function leadsDone(rec) { (CF.CASE_TEMPLATES[rec.template].leads || []).forEach(function (l) { rec.leads = rec.leads || {}; rec.leads[l.id] = true; }); }
  function outOf(e, v, defs) { return v.out.map(function (u) { return e.card(u); }).filter(function (c) { return c && defs.indexOf(c.def) >= 0; }); }
  // A door left shut on a search: the last find stays behind it (not lost: the next search finds it), and the story
  // does not name it. Answered, the search keeps it.
  function search(seed, answer) {
    var e = CF.Engine.newGame({ seed: seed, calling: 'master' });
    var kase = e.tableCards().filter(function (c) { return c.def === 'case'; })[0], rec = e.caseRec(kase.caseId);
    leadsDone(rec);
    var f0 = rec.found;
    assert.ok(e.autoSlot('investigate', kase.uid) && e.start('investigate'));
    var v = e.verb('investigate');
    assert.strictEqual(v.recipe, 'inv_search');
    e.tick(v.duration * 0.35);
    assert.ok(v.ask && e.askSpec(v).penalty === 'thin', 'the search asks at the door');
    if (answer) assert.ok(e.answerAsk('investigate', e.askCandidates('investigate')[0].uid));
    e.tick(v.duration);
    return { e: e, rec: rec, v: v, finds: outOf(e, v, ['clue', 'evidence']), drawn: rec.found - f0 };
  }
  var kept = search(41, true), left = search(41, false);
  assert.ok(kept.finds.length >= 2, 'the first search finds two or more');
  assert.strictEqual(left.finds.length, kept.finds.length - 1, 'ignored, one find fewer');
  assert.strictEqual(left.drawn, kept.drawn - 1, 'and it stays where it was');
  var behind = left.rec.items[left.rec.found];
  assert.ok(behind && kept.v.story.text.indexOf(behind.label) >= 0 && left.v.story.text.indexOf(behind.label) < 0, 'the story names only what came away: ' + left.v.story.text);
  assert.ok(/stayed locked|stayed battened|stayed barred|kept its own|books with it/.test(left.v.story.text), 'and says the door stayed shut');
  left.e.collect('investigate');
  var k2 = left.e.caseCard(left.rec.id);
  assert.ok(left.e.autoSlot('investigate', k2.uid) && left.e.start('investigate'));
  left.e.tick(left.e.verb('investigate').duration * 0.35);
  var ask2 = left.e.verb('investigate').ask;
  if (ask2 && !ask2.filled) { var cand = left.e.askCandidates('investigate')[0]; if (cand) left.e.answerAsk('investigate', cand.uid); }
  left.e.tick(left.e.verb('investigate').duration);
  assert.ok(outOf(left.e, left.e.verb('investigate'), ['clue', 'evidence']).some(function (c) { return c.label === behind.label || (c.data && c.data.item && c.data.item.label === behind.label) || left.e.verb('investigate').story.text.indexOf(behind.label) >= 0; }), 'the next search finds what was left behind the door');

  // A search that would find one thing at most is not asked about the door: ignoring it could cost nothing.
  var one = CF.Engine.newGame({ seed: 41, calling: 'master' });
  var ok1 = one.tableCards().filter(function (c) { return c.def === 'case'; })[0], or1 = one.caseRec(ok1.caseId);
  leadsDone(or1); or1.searches = 1;
  assert.ok(one.autoSlot('investigate', ok1.uid) && one.start('investigate'));
  one.tick(one.verb('investigate').duration * 0.5);
  assert.ok(!one.verb('investigate').ask && one.verb('investigate').askSkipped, 'a one-find search: no door');
  // A shut door on the round: the house's witness is not met (they stay for another round); a Coin opens it.
  function canvass(seed, answer) {
    var e = CF.Engine.newGame({ seed: seed, calling: 'master' });
    e.s.flags.marketOpen = true;
    var kase = e.tableCards().filter(function (c) { return c.def === 'case'; })[0], rec = e.caseRec(kase.caseId);
    leadsDone(rec); rec.searches = 1;
    e.giveDistrict(rec.district);
    var q0 = rec.witnesses.length, coins = e.cardsOf('funds').length;
    var d = e.tableCards().filter(function (c) { return c.def === 'district'; })[0];
    assert.ok(e.autoSlot('investigate', kase.uid) && e.autoSlot('investigate', d.uid) && e.start('investigate'));
    var v = e.verb('investigate');
    assert.strictEqual(v.recipe, 'inv_canvass');
    e.tick(v.duration * 0.35);
    assert.ok(v.ask && v.ask.label === 'A shut door', 'the round asks for a Coin at a door');
    if (answer) assert.ok(e.answerAsk('investigate', e.askCandidates('investigate')[0].uid));
    e.tick(v.duration);
    return { e: e, rec: rec, v: v, met: outOf(e, v, ['witness']).length, queued: rec.witnesses.length, q0: q0, coinsSpent: coins - e.cardsOf('funds').length };
  }
  var paid = canvass(43, true), shut = canvass(43, false);
  assert.ok(paid.q0 >= 1 && paid.met >= 1, 'the paid round meets a witness');
  assert.strictEqual(shut.met, paid.met - 1, 'the shut door: one witness fewer');
  assert.strictEqual(shut.queued, paid.queued + 1, 'and they are still there to be met');
  assert.strictEqual(paid.coinsSpent, 1, 'the Coin is spent');
  assert.strictEqual(shut.coinsSpent, 0, 'unpaid, none');
  assert.ok(/talked less/.test(shut.v.story.text) && /whole street talked/.test(paid.v.story.text), 'each says so');

  // A brawl with a watchman at your side does not wear you out; alone, it does.
  for (var s = 50; s < 62; s++) {
    [true, false].forEach(function (answer) {
      var g = CF.Engine.newGame({ seed: s, calling: 'master' });
      g.create('teammate');
      var hp = g.tableCards().filter(function (c) { return c.def === 'health'; })[0];
      assert.ok(g.autoSlot('duty', hp.uid) && g.start('duty'));
      var dv = g.verb('duty');
      assert.strictEqual(dv.recipe, 'duty_beat');
      g.tick(dv.duration * 0.35);
      assert.ok(dv.ask && dv.ask.label === 'A brawl', 'the round asks for a watchman');
      if (answer) assert.ok(g.answerAsk('duty', g.askCandidates('duty')[0].uid));
      g.tick(dv.duration);
      var tired = outOf(g, dv, ['fatigue']).length;
      if (answer) assert.ok(!tired && !/feet ache/.test(dv.story.text) && /Two of you/.test(dv.story.text), 'two of you, and not worn out: ' + dv.story.text);
      else assert.ok(tired >= 1 && /wore you out/.test(dv.story.text), 'alone, worn out');
    });
  }

  // The Rival exposed: the leaf from their desk is one of Question's finds, face down in the window.
  var x = CF.Engine.newGame({ seed: 3, calling: 'master' });
  var xr = x.openCases()[0];
  var rv = x.create('rival', { label: 'The Rival: Anselm Vogt', data: { name: 'Anselm Vogt', heat: 1, stalled: 0 } });
  var tok = x.create('clue', { label: 'A Spoiled Token', caseId: xr.id, aspects: { forensic: 1 }, data: { tampered: true } });
  var wit = x.tableCards().filter(function (c) { return c.def === 'focus'; })[0];
  [rv, wit, tok].forEach(function (c) { assert.ok(x.autoSlot('interrogate', c.uid), 'slotted ' + c.def); });
  assert.strictEqual(x.currentRecipe('interrogate').recipe.id, 'int_rival_expose');
  assert.ok(x.start('interrogate')); x.tick(x.verb('interrogate').duration + 0.01);
  var leaf = outOf(x, x.verb('interrogate'), ['customsleaf'])[0];
  assert.ok(leaf && leaf.hidden && leaf.loc.t === 'out', 'the leaf is a find, face down: ' + JSON.stringify(leaf && leaf.loc));
  assert.ok(!x.tableCards().some(function (c) { return c.def === 'customsleaf'; }), 'not dropped on the table');
  // Without the work (the Rival answered in the Court), it still comes to the table.
  var y = CF.Engine.newGame({ seed: 3, calling: 'master' });
  var yr = y.create('rival', { label: 'The Rival', data: { name: 'Anselm Vogt', heat: 1 } });
  assert.ok(y.rivalThread(yr, 'case').exposed && y.cardsOf('customsleaf', true).length === 1, 'a thread closed in the Court gives the leaf to the table');
  console.log('verbs check-up: ok');
})();
