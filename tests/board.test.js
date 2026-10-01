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

// A fading card inside a verb warns too, and names the verb.
(function fadeInVerb() {
  var e = CF.Engine.newGame({ calling: 'crusader', name: 'FadeSlot' });
  var seen = [];
  e.on(function (type, p) { if (type === 'expiring') seen.push(p); });
  var w = e.create('witness', { label: 'Nervous Clerk', lifetime: 35 });
  assert.ok(e.slotCard('interrogate', CF.VERBS.interrogate.slots[0].key, w.uid), 'the witness goes into Interrogate');
  e.tick(8);
  assert.strictEqual(w.life, 35, 'the clock waits while the card is in a verb');
  assert.strictEqual(seen.length, 0);
  e.unslot('interrogate', CF.VERBS.interrogate.slots[0].key);
  e.tick(8);
  assert.strictEqual(seen.length, 1, 'warned once back on the table');
  console.log('fade warning: also inside a verb');
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
  var e2 = CF.Engine.load(e.save()); assert.ok(!e2.s.choice && e2.s.choicesSeen.beggar, 'the choice is remembered');
  // A question that follows a verb, about its case, with a return you can point to.
  var e4 = CF.Engine.newGame({ seed: 3, calling: 'master', name: 'Hodge Ebner' });
  e4.s.flags.firstCase = true; if (e4.s.intro) e4.s.intro.finished = true;
  var k4 = e4.tableCards().filter(function (c) { return c.def === 'case'; })[0];
  var rec4 = e4.caseRec(k4.caseId);
  e4.autoSlot('investigate', k4.uid); assert.ok(e4.start('investigate'), 'a search starts');
  e4.tick(e4.verb('investigate').duration + 0.01);
  assert.ok(e4.s.choiceHook && e4.s.choiceHook.verb === 'investigate' && e4.s.choiceHook.caseId === rec4.id, 'a finished search invites a question about its case');
  var lamp = CF.CHOICES.filter(function (c) { return c.id === 'lamplighter'; })[0];
  assert.ok(lamp.after === 'investigate' && lamp.when(e4, { caseId: rec4.id }), 'the lamplighter has a word about an unsolved case');
  e4.create('funds');
  e4.offerChoice(lamp, { caseId: rec4.id });
  assert.ok(e4.s.choice && e4.s.choice.options[0].gain && e4.s.choice.options[0].cost === 'funds', 'the answer says what it gives and what it takes');
  var w0 = e4.cardsOf('witness').length, f0 = e4.cardsOf('funds').length;
  assert.ok(e4.choose(0));
  assert.strictEqual(e4.cardsOf('witness').length, w0 + 1, 'a Coin buys a witness for the case');
  assert.strictEqual(e4.cardsOf('funds').length, f0 - 1, 'and the Coin is gone');
  var wit = e4.cardsOf('witness').filter(function (c) { return /Lamplighter/.test(c.label); })[0];
  assert.ok(wit && wit.caseId === rec4.id && wit.data.knows, 'it is the lamplighter, who knows');
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
  // An old save: the cards below the verb row move down with the taller verbs.
  var old = JSON.parse(e4.save()); old.version = 1;
  var y0 = e4.tableCards()[0].loc.y, uid0 = e4.tableCards()[0].uid;
  var e5 = CF.Engine.load(old);
  assert.strictEqual(e5.card(uid0).loc.y, y0 >= 200 ? y0 + CF.TABLE.TOP - 200 : y0, 'an old save is moved down once');
  assert.strictEqual(CF.Engine.load(e5.save()).card(uid0).loc.y, e5.card(uid0).loc.y, 'and only once');
  console.log('life: opening, needs, choices ok');
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
  assert.ok(r, 'the Provost sends an examiner');
  var before = e.openCases().length, lines = e.rivalWeek();
  assert.ok(lines.length === 1, 'they act: ' + lines);
  void before; void seen;
  // Wit twice: exposed.
  var wit = e.tableCards().filter(function (c) { return c.def === 'focus'; })[0];
  e.autoSlot('interrogate', r.uid); e.autoSlot('interrogate', wit.uid);
  assert.strictEqual(e.currentRecipe('interrogate').recipe.id, 'int_rival_weakness');
  assert.ok(e.start('interrogate')); e.tick(e.verb('interrogate').duration + 0.01);
  assert.strictEqual(r.data.heat, 1); assert.ok(r.data.stalled >= e.s.week, 'they lie low');
  assert.deepStrictEqual(e.rivalWeek(), [], 'nothing while they lie low');
  e.collect('interrogate');
  assert.strictEqual(wit.def, 'spent_focus', 'Wit comes back spent');
  var rep = e.s.meters.reputation;
  wit = e.create('focus');
  e.autoSlot('interrogate', r.uid); e.autoSlot('interrogate', wit.uid);
  assert.ok(e.start('interrogate')); e.tick(e.verb('interrogate').duration + 0.01);
  assert.strictEqual(e.cardsOf('rival', true).length, 0, 'exposed and sent home');
  assert.strictEqual(e.s.meters.reputation, rep + 2);
  assert.ok(e.s.flags.rivalGone > e.s.week);
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
