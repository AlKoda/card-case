// Part II, Phase E: origins (docs/CITY.md §2). Each sets the starting
// cards, bends one rule and shuts one door; each has its own first morning.
// Run: node tests/origins.test.js
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

function game(who, seed) { return CF.Engine.newGame({ seed: seed || 1, calling: 'master', who: who }); }
function byDef(e, d) { return e.tableCards().filter(function (c) { return c.def === d; }); }
function dur(e, verb, cards) {
  cards.forEach(function (c) { assert.ok(e.autoSlot(verb, c.uid), verb + ' refused ' + e.labelOf(c)); });
  var pv = e.preview(verb);
  e.clearSlots(verb);
  return pv.duration;
}

// ---- Starting cards and the first morning -----------------------------------
(function starts() {
  var none = game(null);
  assert.strictEqual(byDef(none, 'focus').length, 1);
  CF.ORIGIN_ORDER.forEach(function (who) {
    var e = game(who);
    assert.strictEqual(e.s.who, who);
    assert.strictEqual(e.s.journal[0].title, CF.OPENINGS_WHO[who].title, who + ' opens with its own morning');
  });
  // Before the office, the first morning is told in the origin's own words, then where you stand.
  CF.ORIGIN_ORDER.forEach(function (who) {
    var o = CF.Engine.newGame({ seed: 5, calling: 'master', who: who, opening: true });
    var sc = o.openingScene(), first = o.s.journal.filter(function (j) { return j.title === 'Before the Office'; })[0];
    assert.ok(sc.first && first, who + ' has a first morning');
    assert.strictEqual(first.text.indexOf(sc.first), 0, who + ' begins with it');
    assert.strictEqual(first.text, sc.first + ' ' + CF.OPENING_TEXT.startTold, who + ' says its lodging and trade once');
  });
  var a = game('advocate');
  assert.strictEqual(byDef(a, 'focus').length, 2, 'the Advocate: Wit ×2');
  assert.strictEqual(a.s.meters.reputation, 1, 'and the Council\'s ear');
  var h = game('hangman');
  assert.strictEqual(byDef(h, 'health').length, 2, 'the Hangman: Health ×2');
  assert.ok(byDef(h, 'kit').length === 1 && h.s.rooms.suite, 'a Physician\'s Case and the Hole');
  assert.strictEqual(h.s.meters.dread, 2, 'feared from the first day');
  assert.ok(!byDef(h, 'order').some(function (c) { return c.data.order === 'kit' || c.data.order === 'suite'; }), 'no petitions for what you own');
  var m = game('monk');
  assert.ok(byDef(m, 'kit').length === 1 && byDef(m, 'labpass').length === 1, 'the Monk: case and key');
  var w = game('watchman');
  assert.strictEqual(byDef(w, 'health').length, 3, 'the Watchman: Health ×3');
  assert.strictEqual(byDef(w, 'teammate').length, 1, 'and a Beadle');
  var c = game('clerk');
  assert.strictEqual(byDef(c, 'focus').length, 2);
  assert.strictEqual(byDef(c, 'funds').length, byDef(none, 'funds').length + 2, 'the Clerk: Coin ×2 more');
  console.log('starts: ok');
})();

// ---- The rule that bends, the door that shuts ----------------------------------
(function rules() {
  var none = game(null, 4), monk = game('monk', 4), hang = game('hangman', 4), watch = game('watchman', 4), clerk = game('clerk', 4), adv = game('advocate', 4);
  function ev(e) { var k = byDef(e, 'case')[0]; return e.create('evidence', { caseId: k.caseId, data: { item: { label: 'x', text: 'x', result: { label: 'y', text: 'y', aspects: { forensic: 1 } } } } }); }
  var d0 = dur(none, 'analyze', [ev(none)]);
  assert.ok(dur(monk, 'analyze', [ev(monk)]) <= Math.ceil(d0 / 2), 'the Monk reads at a glance');
  assert.ok(dur(hang, 'analyze', [ev(hang)]) < d0, 'the Hangman reads bodies quicker');
  assert.ok(dur(watch, 'analyze', [ev(watch)]) >= d0 * 2 - 1, 'the Watchman cannot read');
  watch.create('teammate', watch.teammateSpec('analyst'));
  assert.ok(dur(watch, 'analyze', [ev(watch)]) <= d0, 'until a Clerk is in service');
  // The Monk may not carry the sword.
  function sc(e) { var k = byDef(e, 'case')[0], r = e.caseRec(k.caseId); return e.revealSuspect(r, null, { key: r.culprit }); }
  assert.ok(dur(monk, 'arrest', [sc(monk)]) > dur(none, 'arrest', [sc(none)]), 'the Watch is slow');
  // The Watchman walks quicker; the Clerk cannot walk at all, yet.
  var pn = dur(none, 'investigate', [byDef(none, 'health')[0]]);
  assert.ok(dur(watch, 'investigate', [byDef(watch, 'health')[0]]) < pn, 'the Watchman knows the round');
  function street(e) { e.autoSlot('investigate', byDef(e, 'instinct')[0].uid); var p = e.preview('investigate'); e.clearSlots('investigate'); return p.blocked; }
  assert.ok(/watchman/.test(street(clerk)), 'the Clerk has no street: ' + street(clerk));
  clerk.create('teammate', clerk.teammateSpec('rookie'));
  assert.strictEqual(street(clerk), null, 'until a watchman serves');
  // The Clerk's petitions cost less.
  clerk.addOrdersForRank(0); none.addOrdersForRank(0);
  var o = byDef(clerk, 'order')[0], on = byDef(none, 'order').filter(function (c) { return c.data.order === o.data.order; })[0];
  assert.strictEqual(CF.costOf(o), CF.costOf(on) - 1, 'one Coin less');
  // The Hangman rises no higher than Bailiff.
  assert.strictEqual(hang.rankCap(), 2);
  hang.s.rank = 2; hang.s.meters.reputation = 99;
  hang.checkThresholds();
  assert.strictEqual(hang.cardsWith('promotion').length, 0, 'no letter for the Hangman');
  none.s.rank = 2; none.s.meters.reputation = 99;
  none.checkThresholds();
  assert.strictEqual(none.cardsWith('promotion').length, 1, 'the letter comes for anyone else');
  // The Advocate reads the file: the first search turns up the culprit's mark.
  var k = byDef(adv, 'case')[0], rec = adv.caseRec(k.caseId);
  rec.leads = { scene: true, prints: true, canvass: true, timing: true };
  adv.autoSlot('investigate', k.uid); adv.start('investigate'); adv.tick(adv.verb('investigate').duration + 0.01);
  var out = adv.verb('investigate').out.map(function (u) { return adv.card(u); });
  assert.ok(out.some(function (c) { return c.data && c.data.trait === rec.suspects.filter(function (x) { return x.guilty; })[0].trait; }), 'the mark of the culprit');
  assert.ok(/read the file/.test(adv.verb('investigate').story.text));
  // and heals slowly.
  adv.hurtYou('a blow');
  none.hurtYou('a blow');
  assert.strictEqual(byDef(adv, 'wound')[0].life, byDef(none, 'wound')[0].life * 1.5, 'a Wound takes half again as long');
  // Saves keep the origin; old saves have none.
  var again = CF.Engine.load(monk.save());
  assert.strictEqual(again.s.who, 'monk');
  var old = JSON.parse(none.save()); delete old.who;
  assert.strictEqual(CF.Engine.load(old).s.who, null);
  console.log('rules: ok');
})();

// ---- The opening case, in the origin's voice -------------------------------------
(function opening() {
  function tbl(g, d) { return g.tableCards().filter(function (c) { return c.def === d; }); }
  function run(g, vid, cards) { cards.forEach(function (c) { g.autoSlot(vid, c.uid); }); assert.ok(g.start(vid), vid + ' starts'); g.tick(g.verb(vid).duration + 0.01); g.collect(vid); g.tick(0.1); }
  CF.ORIGIN_ORDER.concat(['none']).forEach(function (who) {
    var sc = CF.OPENING_SCENES[who];
    assert.ok(sc.roles && sc.roles.length === 3 && sc.roles.every(function (r) { return r.role && r.motive; }), who + ' has three suspects of its own');
    assert.ok(sc.roles.every(function (r) { return /^(the|a|her) /.test(r.role); }), who + ': roles read as the case would name them');
  });
  var e = CF.Engine.newGame({ seed: 7, who: 'watchman', name: 'Opening', opening: true });
  var sc = e.openingScene();
  run(e, 'duty', [tbl(e, 'health')[0]]); e.tick(41);
  run(e, 'duty', [tbl(e, 'health')[0]]);
  assert.strictEqual(e.s.flags.stage, 'search');
  var rec = e.openCases()[0];
  assert.strictEqual(rec.title, 'The Vanishing of Old Bartel', 'the notice names him');
  assert.deepStrictEqual(rec.suspects.map(function (x) { return x.role; }), sc.roles.map(function (r) { return r.role; }), 'the suspects are the origin\'s own');
  assert.ok(rec.suspects.every(function (x, i) { return x.motive === sc.roles[i].motive; }), 'with their motives');
  assert.ok(rec.suspects.some(function (x) { return x.guilty; }), 'one of them did it');
  var card = e.caseCard(rec.id);
  assert.ok(card.desc.indexOf(sc.notice) === 0, 'the notice is the brief: ' + card.desc.slice(0, 40));
  assert.strictEqual(card.label, rec.title);
  // The body found: the case takes its true name, on the record and on every card of it.
  e.tick(e.verb('investigate').duration + 0.01);
  e.collect('investigate'); e.tick(0.1);
  assert.strictEqual(e.s.flags.stage, 'questioned');
  assert.strictEqual(rec.title, 'The Death of Old Bartel', 'retitled when the body is found');
  assert.strictEqual(e.caseCard(rec.id).label, 'The Death of Old Bartel', 'the card is relabelled');
  var ofCase = e.tableCards().filter(function (c) { return c.caseId === rec.id && c.def !== 'case'; });
  assert.ok(ofCase.length >= 1 && ofCase.every(function (c) { return !/Vanishing/.test(c.desc || '') && !/Vanishing/.test(c.label || ''); }), 'its tokens follow the name');
  assert.ok(ofCase.some(function (c) { return /The Death of Old Bartel/.test(c.desc || ''); }), 'and say which case they belong to');
  // A plain spawn is untouched by the opening's hooks.
  var plain = CF.Engine.newGame({ seed: 8, calling: 'master' });
  var pc = plain.spawnCase('missing', { quiet: true }), pr = plain.caseRec(pc.caseId);
  assert.ok(/^The Vanishing of /.test(pr.title) && pr.suspects.every(function (x) { return CF.CASE_TEMPLATES.missing.roles.some(function (r) { return r.role === x.role; }); }));
  console.log('opening: ok');
})();

console.log('origins: starts, rules, opening all OK');
