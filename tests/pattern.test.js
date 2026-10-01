// Part II, Phase H (last two crimes): the Pattern, a serial case that adds a
// door every week until you read it; and the Three Days, the Council's
// ultimatum with two free confessions that are both lies.
// Run: node tests/pattern.test.js
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

// ---- The Pattern ----------------------------------------------------------------
(function pattern() {
  ['pattern', 'threedays'].forEach(function (tid) {
    var T = CF.CASE_TEMPLATES[tid];
    assert.ok(T.lesser && T.items.length >= 4 && T.witnesses.length >= 3 && T.hints.length >= 3 && CF.STRUCTURES[tid].length >= 1 && CF.LADDERS[tid], tid + ' is complete');
  });
  var e = game(21);
  var rec = e.caseRec(e.spawnCase('pattern', { quiet: true }).caseId);
  var kase = e.caseCard(rec.id);
  var doors = function () { return byDef(e, 'clue').filter(function (c) { return c.caseId === rec.id && c.data.pattern; }); };
  for (var k = 0; k < 4 && !doors().length && rec.found < rec.items.length; k++) run(e, 'investigate', [kase]);
  assert.ok(doors().length >= 1, 'the first door is a piece of the pattern');
  var v0 = rec.victims || 1, p0 = e.s.meters.pressure;
  rec.week = e.s.week + 1; // as if she arrived in this very tick
  e.weekTick();
  assert.strictEqual(rec.victims || 1, v0, 'no second girl in the week she arrived');
  e.weekTick();
  assert.strictEqual(rec.victims, v0 + 1, 'another girl every week');
  var p1 = e.s.meters.pressure;
  e.weekTick();
  assert.strictEqual(rec.victims, v0 + 2, 'and another');
  assert.ok(e.s.meters.pressure > p1 && e.s.meters.pressure > p0, 'and the Crowd counts every other door');
  assert.ok(doors().length >= 2);
  var r = run(e, 'reflect', doors().slice(0, 2));
  assert.strictEqual(r.recipe, 'ref_deduce');
  assert.ok(/Pattern Read/.test(r.story.title), r.story.title);
  var next = byDef(e, 'clue').filter(function (c) { return /Next Door/.test(e.labelOf(c)); })[0];
  assert.ok(next && next.data.points === rec.culprit, 'the next door points at him');
  assert.strictEqual(rec.identified, rec.culprit);
  var v1 = rec.victims;
  e.weekTick();
  assert.strictEqual(rec.victims, v1, 'once read, no more girls');
  // 'Be at the next door' has a verb: the Next Door token in Explore, with Instinct or a watchman.
  assert.ok(next.data.nextDoor && CF.aspectsOf(next).nextdoor, 'the Next Door token opens Explore');
  assert.ok(e.autoSlot('investigate', next.uid), 'Explore takes the Next Door');
  var pv = e.preview('investigate');
  assert.ok(pv && /Instinct, or a watchman/.test(pv.blocked), 'somebody has to stand in it: ' + (pv && pv.blocked));
  assert.strictEqual(pv.label, 'Stand in the Doorway');
  e.clearSlots('investigate');
  var before = byDef(e, 'suspect').filter(function (c) { return c.caseId === rec.id && c.data.key === rec.culprit; }).length;
  var door = run(e, 'investigate', [next, byDef(e, 'instinct')[0]]);
  assert.strictEqual(door.recipe, 'inv_next_door');
  assert.strictEqual(door.story.title, 'The Doorway');
  assert.strictEqual(door.story.kind, 'major');
  var taken = door.out.filter(function (c) { return /Taken at the Door/.test(e.labelOf(c)); })[0];
  assert.ok(taken && taken.data.points === rec.culprit && !taken.data.misread, 'taken at the door, and it names him');
  assert.strictEqual(CF.clueAspects(taken).opportunity, 3);
  assert.ok(!e.card(next.uid), 'the Next Door is spent');
  assert.ok(byDef(e, 'suspect').filter(function (c) { return c.caseId === rec.id && c.data.key === rec.culprit; }).length >= Math.max(1, before), 'he is on the board');
  // It comes once a run, from week six.
  var seen = 0;
  for (var i = 0; i < 20; i++) { var g = game(600 + i); g.s.week = 6; g.s.rank = 2; for (var w = 0; w < 10 && !g.s.over; w++) { g.s.meters.pressure = 0; g.weekTick(); } if (g.s.flags.patternSeen) seen++; }
  assert.ok(seen >= 8, 'the Pattern arrives in most runs: ' + seen);
  // It waits for a Bailiff: an Examiner never sees it, a Sworn Examiner not before week twelve.
  [[0, 11], [1, 11]].forEach(function (rw) {
    var g = game(640 + rw[0]); g.s.week = 6; g.s.rank = rw[0];
    for (var w = 0; w < 5 && !g.s.over; w++) { g.s.meters.pressure = 0; g.weekTick(); }
    assert.ok(!g.s.flags.patternSeen, 'rank ' + rw[0] + ' before week twelve: no Pattern');
  });
  var late = 0;
  for (var j = 0; j < 20; j++) { var g2 = game(660 + j); g2.s.week = 12; g2.s.rank = 1; for (var w2 = 0; w2 < 10 && !g2.s.over; w2++) { g2.s.meters.pressure = 0; g2.weekTick(); } if (g2.s.flags.patternSeen) late++; }
  assert.ok(late >= 8, 'a Sworn Examiner sees it from week twelve: ' + late);
  // A Pattern read and then left to go cold says so: you knew the door.
  var pc = game(22);
  var prec = pc.caseRec(pc.spawnCase('pattern', { quiet: true }).caseId);
  prec.patternRead = true;
  pc.goCold(prec.id);
  var coldLine = pc.s.journal.filter(function (j) { return j.title === 'The Trail Goes Cold'; })[0];
  assert.ok(coldLine && /You knew the door, and nobody stood in it/.test(coldLine.text), coldLine && coldLine.text);
  console.log('pattern: ok');
})();

// ---- The Three Days ----------------------------------------------------------------
(function threeDays() {
  var e = game(22);
  var rec = e.caseRec(e.spawnCase('threedays', { quiet: true }).caseId);
  assert.ok(rec.commission && rec.commission.from === 'council', 'the Council\'s ultimatum');
  assert.ok(e.caseCard(rec.id).life <= 210, 'three days');
  assert.strictEqual(rec.suspects.length, 4, 'all four are in it');
  assert.strictEqual(rec.suspects.filter(function (x) { return x.guilty; })[0].role, 'the husband', 'the husband did it');
  var liars = rec.suspects.filter(function (x) { return !x.guilty && (/brother/.test(x.role) || /porter/.test(x.role)); });
  assert.strictEqual(liars.length, 2, 'two innocent men who will confess');
  var liar = liars[0];
  var sc = e.revealSuspect(rec, null, { key: liar.key });
  var r = run(e, 'interrogate', [sc, byDef(e, 'focus')[0]]);
  var conf = r.out.filter(function (c) { return c.data.confession === 'free'; })[0];
  assert.ok(conf && conf.data.falseConfession, 'a free confession, and a lie');
  assert.ok(/steady voice/.test(r.story.text));
  var a = e.assessCharge(sc, [conf]);
  assert.strictEqual(a.tier, 'strong', 'it reads as full proof');
  assert.ok(!liar.cleared, 'and the liar is not cleared by it');
  console.log('three days: ok');
})();

console.log('pattern: the Pattern, the Three Days all OK');
