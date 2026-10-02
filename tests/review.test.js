// Regressions from the full code review: things that looked right and were not.
// Run: node tests/review.test.js
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

function game(seed, calling) { return CF.Engine.newGame({ seed: seed, calling: calling || 'master' }); }
function byDef(e, d) { return e.tableCards().filter(function (c) { return c.def === d; }); }
function run(e, verb, cards) {
  cards.forEach(function (c) { assert.ok(e.autoSlot(verb, c.uid), verb + ' refused ' + e.labelOf(c)); });
  var pv = e.preview(verb);
  assert.ok(pv && !pv.blocked, verb + ' blocked: ' + (pv && pv.blocked));
  assert.ok(e.start(verb));
  e.tick(e.verb(verb).duration + 0.01);
  var v = e.verb(verb), out = v.out.map(function (u) { return e.card(u); }), story = v.story, id = v.recipe;
  if (v.status === 'done') e.collect(verb);
  return { out: out, story: story, id: id };
}

// A save from before Delegate / Major Crimes existed still loads and promotes.
(function oldSave() {
  var e = game(91);
  var s = JSON.parse(e.save());
  delete s.verbs.delegate; delete s.verbs.majorcrimes; delete s.rooms; delete s.paths; delete s.origin; delete s.criminals; delete s.network;
  var e2 = CF.Engine.load(JSON.stringify(s));
  assert.ok(e2.verb('duty') && e2.verb('duty').unlocked);
  e2.s.rank = 1; e2.promote();
  assert.ok(e2.powerOpen('stakeout'), 'promotion works on the migrated save');
  e2.tick(65);
  assert.ok(!e2.s.over, 'it plays on');
  console.log('old save: ok');
})();

// A conviction takes the criminal's At Large card off the table; escapes never duplicate it.
(function atLarge() {
  var e = game(92);
  var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
  var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
  kase.life = 0.1; e.tick(1);
  var crim = e.criminalByName(culprit.name);
  assert.strictEqual(byDef(e, 'atlarge').length, 1);
  // A second escape (a "Name again" case going cold) refreshes the card instead of adding one.
  var again = e.spawnCase('burglary', { quiet: true, culpritName: culprit.name, culpritTrait: culprit.trait, criminalId: crim.id });
  again.life = 0.1; e.tick(1);
  assert.strictEqual(byDef(e, 'atlarge').length, 1, 'one card per person');
  assert.ok(/^Old Offender/.test(e.labelOf(byDef(e, 'atlarge')[0])), 'and it follows the record');
  // A conviction on a later case with no atLargeUid still removes the card.
  var third = e.spawnCase('burglary', { quiet: true, culpritName: culprit.name, culpritTrait: culprit.trait, criminalId: crim.id });
  var r3 = e.caseRec(third.caseId);
  var t = e.create('trial', { data: { caseId: r3.id, name: culprit.name, guilty: true, solid: true, tier: 'strong', real: 9, need: 6, coerced: 0, planted: 0, illegal: 0, contradictions: 0 } });
  var saved = e.save(), done = false;
  for (var i = 0; i < 8 && !done; i++) {
    var g = CF.Engine.load(saved); g.rng.setState(i * 13 + 5); g.verdict(g.card(t.uid));
    if (g.caseRec(r3.id).status === 'closed') { done = true; assert.strictEqual(byDef(g, 'atlarge').length, 0, 'their name comes off the wall'); assert.strictEqual(g.criminalByName(culprit.name).status, 'jailed'); }
  }
  assert.ok(done);
  console.log('at large: ok');
})();

// An informant's Warning waits for room on the caseload instead of being thrown away.
(function warningWaits() {
  var e = game(93, 'crusader');
  while (e.openCases().length < e.maxOpenCases()) e.spawnCase(null, { quiet: true });
  e.s.nextCase = { template: 'arson', district: 'canal' };
  e.s.dispatchT = 1;
  e.tick(2);
  assert.ok(e.s.nextCase && e.s.nextCase.template === 'arson', 'still waiting');
  e.openCases().forEach(function (r) { e.goCold(r.id); });
  e.s.meters.pressure = 0;
  e.s.dispatchT = 1;
  e.tick(2);
  assert.ok(e.openCases().some(function (r) { return r.template === 'arson'; }), 'and it arrives when there is room');
  console.log('warning waits: ok');
})();

// Rent comes out before the salary lands: with nothing on the table you sleep in the car.
(function rent() {
  var e = game(94);
  byDef(e, 'funds').forEach(function (c) { e.remove(c); });
  var fat = e.countOf('fatigue');
  e.tick(CF.WEEK + 0.01);
  assert.strictEqual(e.countOf('fatigue'), fat + 2, 'missed the rent');
  assert.strictEqual(byDef(e, 'funds').length, CF.RANK_DEFS[0].salary, 'salary still lands');
  console.log('rent: ok');
})();

// The partial print does not name the culprit without the kit.
(function print() {
  var e = game(95);
  var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
  var prints = e.create('prints');
  run(e, 'investigate', [kase]);
  run(e, 'investigate', [kase, prints]);
  var partial = e.tableCards().filter(function (c) { return /Half a Hand/.test(e.labelOf(c)); })[0];
  e.remove(prints);
  var r = run(e, 'analyze', [partial]);
  var clue = r.out.filter(function (c) { return c.def === 'clue'; })[0];
  var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
  assert.ok(clue && e.labelOf(clue).indexOf(culprit.name) < 0 && clue.desc.indexOf(culprit.name) < 0, 'no spoiler: ' + e.labelOf(clue));
  // And the scene pool does not repeat the written leads.
  assert.ok(!rec.items.some(function (it) { return /Pried Shutter|The Inventory|Pawnbroker's Chit|The Hours/.test(it.label); }));
  console.log('print: ok');
})();

// Dead ends now say why.
(function deadEnds() {
  var e = game(96);
  var clue = e.create('clue', { label: 'x', caseId: byDef(e, 'case')[0].caseId, aspects: { forensic: 1 } });
  e.autoSlot('analyze', clue.uid);
  assert.ok(/Apothecary/.test(e.preview('analyze').blocked || ''), 'a token in Study without the apothecary');
  e.clearSlots('analyze');
  var warn = e.create('intel', { label: 'Warning: x', data: { kind: 'warning', template: 'arson', district: 'canal' } });
  e.autoSlot('reflect', warn.uid);
  assert.ok(/Keep this on the table/.test(e.preview('reflect').blocked || ''), 'a warning in Reflect');
  e.clearSlots('reflect');
  e.autoSlot('duty', byDef(e, 'focus')[0].uid); e.autoSlot('duty', byDef(e, 'funds')[0].uid);
  assert.ok(e.preview('duty') && !e.preview('duty').blocked, 'Focus with Funds still works a desk shift');
  e.clearSlots('duty');
  // Template items are variable-filled.
  for (var i = 0; i < 30; i++) {
    var g = game(700 + i), c = g.spawnCase('extortion', { quiet: true });
    g.caseRec(c.caseId).items.forEach(function (it) { assert.ok(!/\{\w+\}/.test(it.label + it.text), it.label); });
  }
  console.log('dead ends: ok');
})();

// What became of them: the run's late story under the ending, from state alone (round 8).
(function epilogue() {
  function lateRun(seed) {
    var e = game(seed, 'crusader');
    var pat = e.caseRec(e.spawnCase('pattern', { quiet: true, headline: 'The Pattern: ' }).caseId);
    pat.victims = 3;
    e.create('syndicate');
    e.s.court = { king: { name: 'Gerd Thune' }, stance: null, since: 0, inside: false, insideWeeks: 0, quietWeeks: 0, handed: 0 };
    e.s.stats.rivalExposed = 2;
    var b = e.caseRec(e.spawnCase('burglary', { quiet: true }).caseId);
    var cul = b.suspects.filter(function (x) { return x.guilty; })[0];
    e.criminalEscapes(b, cul, 'cold');
    e.criminalEscapes(b, cul, 'acquitted');
    var t = e.create('teammate', e.teammateSpec('veteran'));
    t.data.level = 3;
    return { e: e, pat: pat, b: b, cul: cul, t: t };
  }
  var r = lateRun(140), lines = r.e.epilogue();
  assert.strictEqual(lines.length, 4, 'four lines at most');
  assert.deepStrictEqual(lines.map(function (l) { return l.id; }), ['pattern', 'coquille', 'rival', 'abroad'], 'in their order');
  assert.strictEqual(lines[0].text, 'The girls of ' + r.pat.scene + ': never answered. He still walks the lanes.');
  assert.ok(/still sits on his barrel\.$/.test(lines[1].text), lines[1].text);
  assert.strictEqual(lines[2].text, 'Two examiners sent home to the Customs House.');
  assert.strictEqual(lines[3].text, r.cul.name + ', who walked from you twice, was last seen near ' + r.b.scene + '.');
  // Answered at the third door; the King hanged; the watchman sergeant once there is room.
  r.pat.status = 'closed';
  r.e.s.flags.syndicateFallen = true;
  r.e.s.stats.rivalExposed = 0;
  lines = r.e.epilogue();
  assert.strictEqual(lines[0].text, 'The girls of ' + r.pat.scene + ': answered at the third door.');
  assert.ok(/hangs on the Ravenstone\.$/.test(lines[1].text));
  assert.ok(lines.some(function (l) { return l.id === 'watch' && l.text === r.t.data.name + ' is sergeant of the Watch now.'; }), 'the watchman drilled hardest');
  // Deterministic: the same seed and the same play give the same lines; reading them draws no dice.
  var a = lateRun(141), b = lateRun(141), rng = a.e.rng.getState();
  assert.deepStrictEqual(a.e.epilogue(), b.e.epilogue(), 'the same run, the same epilogue');
  assert.strictEqual(a.e.rng.getState(), rng, 'no dice drawn');
  // Kept with the ending, and told for a file finished before it existed.
  a.e.gameOver('dismissed', { meter: 'pressure' });
  assert.deepStrictEqual(a.e.s.over.epilogue, b.e.epilogue(), 'gameOver keeps it in s.over');
  var old = JSON.parse(a.e.save()); delete old.over.epilogue;
  assert.deepStrictEqual(CF.Engine.load(old).s.over.epilogue, a.e.s.over.epilogue, 'an older finished file is told it on load');
  // A quiet run: nothing to tell, nothing made up.
  assert.deepStrictEqual(game(142).epilogue(), [], 'nothing to tell');
  console.log('epilogue (engine): ok');
})();

// What Became of Them: the ending's epilogue is read from state alone, so one seed played one
// way tells one epilogue, at most four lines, each with an icon and a filled template.
(function epilogue() {
  var bot = require('./bot.test.js');
  function played(seed) {
    var e = CF.Engine.newGame({ seed: seed, calling: 'crusader' });
    bot.play(e, 60 * 26, 'brutal');
    if (!e.s.over) e.gameOver('burnout');
    return e;
  }
  [311, 312].forEach(function (seed) {
    var a = CF.Story.epilogue(played(seed)), b = CF.Story.epilogue(played(seed));
    assert.deepStrictEqual(a, b, 'the same seed, the same epilogue');
    assert.ok(a.length <= 4);
    a.forEach(function (l) { assert.ok(CF.CARDS[l.icon] && l.text && !/\{\w+\}/.test(l.text), 'a line: ' + JSON.stringify(l)); });
  });
  // Each line from the state that tells it.
  var e = game(313), s = e.s;
  assert.deepStrictEqual(CF.Story.epilogue(e), [], 'a fresh desk has nothing to tell');
  var rec = e.caseRec(byDef(e, 'case')[0].caseId);
  rec.template = 'pattern'; rec.victims = 3; rec.status = 'closed'; rec.scene = 'the Tanners\' Lane';
  e.court().king = { name: 'Klaus Rott', criminalId: null };
  s.journal.unshift({ title: 'The Rival Exposed', text: '' }, { title: 'The Rival Exposed', text: '' });
  s.criminals.k1 = { id: 'k1', name: 'Jan Pauw', crimes: 3, status: 'at_large', traits: [], district: 'warrens',
    history: [{ week: 2, title: 'Burglary at the Red Ox', how: 'cold' }, { week: 4, title: rec.title, how: 'acquitted' }, { week: 6, how: 'jailed' }, { week: 7, title: rec.title, how: 'acquitted' }] };
  var t = e.create('teammate', e.teammateSpec('rookie'));
  var lines = CF.Story.epilogue(e).map(function (l) { return l.text; });
  assert.deepStrictEqual(lines, [
    'The girls of the Tanners\' Lane: answered at the third door.',
    'Klaus Rott still sits on his barrel.',
    'Two examiners sent home to the Customs House.',
    'Jan Pauw, who walked from you three times, was last seen near the Tanners\' Lane.',
  ], 'four lines, in order: ' + lines.join(' | '));
  // The fifth waits for room; the Pattern's man Abroad was never answered; the King fallen.
  rec.suspects.filter(function (x) { return x.guilty; })[0].name = 'Jan Pauw';
  s.flags.syndicateFallen = true;
  s.journal = [];
  lines = CF.Story.epilogue(e).map(function (l) { return l.text; });
  assert.ok(/never answered/.test(lines[0]), lines[0]);
  assert.strictEqual(lines[1], 'The Court of Miracles is scattered, and Klaus Rott hangs on the Ravenstone.');
  assert.strictEqual(lines[3], t.data.name + ' is sergeant of the Watch now.', 'the watchman, once there is room');
  // A Clerk drilled harder is still not made sergeant of the Watch; with no Watchman, no line.
  var clerk = e.create('teammate', e.teammateSpec('analyst')); clerk.data.level = 5;
  assert.strictEqual(CF.Story.epilogue(e).map(function (l) { return l.text; })[3], t.data.name + ' is sergeant of the Watch now.', 'the Watch\'s own man');
  e.remove(t);
  assert.ok(!CF.Story.epilogue(e).some(function (l) { return l.id === 'watch'; }), 'a Clerk alone keeps no Watch');
  console.log('epilogue: ok');
})();
