// Part II, Phase G: the Court of Miracles (docs/CITY.md §8). The King of
// Thunes is crowned when the Coquille forms; a Treaty quiets the Stews and
// hands you culprits at the price of a blind eye and the Justice path; the
// Court's trial lets you inside, and after four weeks, with Purse and
// Cruelty enough, the throne.
// Run: node tests/coquille.test.js
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

function game(seed) {
  var e = CF.Engine.newGame({ seed: seed, calling: 'master' });
  e.s.rank = 2;
  e.spawnSyndicate('test');
  return e;
}
function byDef(e, d) { return e.tableCards().filter(function (c) { return c.def === d; }); }
function run(e, verb, cards) {
  cards.forEach(function (c) { assert.ok(e.autoSlot(verb, c.uid), verb + ' refused ' + e.labelOf(c)); });
  var pv = e.preview(verb);
  assert.ok(pv && !pv.blocked, verb + ' blocked: ' + (pv && pv.blocked));
  assert.ok(e.start(verb));
  e.tick(e.verb(verb).duration + 0.01);
  var v = e.verb(verb), out = v.out.map(function (u) { return e.card(u); }), story = v.story;
  if (v.status === 'done') e.collect(verb);
  return { out: out, story: story, preview: pv, recipe: v.recipe };
}

// ---- The King ---------------------------------------------------------------
(function king() {
  var e = game(1);
  var court = e.court();
  assert.ok(court.king && court.king.name, 'the Coquille has a King');
  var k = e.criminal(court.king.criminalId);
  assert.ok(k.king && k.organization === 'syndicate');
  assert.ok(/King of Thunes/.test(byDef(e, 'syndicate')[0].desc), 'the card names him');
  assert.ok(/King of Thunes/.test(e.criminalDesc(k)));
  var c = e.criminalEscapes({ title: 'x', template: 'burglary' }, { name: 'Test Name', trait: 'scar' }, 'cold');
  assert.ok(/crocheteur/.test(e.criminalDesc(c)), 'a burglar is a crocheteur: ' + e.criminalDesc(c));
  // The King is never a jailed man: the record abroad is crowned over the one in the Hole, and gets a card.
  var e2 = CF.Engine.newGame({ seed: 3, calling: 'master' });
  e2.s.rank = 2;
  var jailed = e2.criminalEscapes({ title: 'The Mint Robbery', template: 'coining' }, { name: 'Jailed Man', trait: 'scar' }, 'cold');
  jailed.crimes = 9; e2.criminalCaught('Jailed Man');
  var loose = e2.criminalEscapes({ title: 'The Fire at the Tannery', template: 'arson' }, { name: 'Loose Man', trait: 'limp' }, 'cold');
  loose.crimes = 2;
  e2.spawnSyndicate('test');
  var king2 = e2.criminal(e2.court().king.criminalId);
  assert.strictEqual(king2.name, 'Loose Man', 'the man abroad is crowned, not the one in the Hole');
  assert.strictEqual(jailed.status, 'jailed');
  assert.strictEqual(king2.status, 'at_large');
  var kc = e2.atLargeCardFor(king2);
  assert.ok(kc && /^The King of Thunes: Loose Man$/.test(kc.label), 'the King has an Abroad card under his crown: ' + (kc && kc.label));
  var told = e2.s.journal.filter(function (j) { return j.title === 'The Coquille'; })[0];
  assert.ok(told && /It is Loose Man, who walked from The Fire at the Tannery in week/.test(told.text), 'the story names the king: ' + (told && told.text));
  // With nobody on the Rolls, the King is a new name, and the story says so.
  var e3 = CF.Engine.newGame({ seed: 4, calling: 'master' });
  e3.s.rank = 2;
  for (var kk in e3.s.criminals) delete e3.s.criminals[kk];
  e3.spawnSyndicate('test');
  var k3 = e3.criminal(e3.court().king.criminalId), told3 = e3.s.journal.filter(function (j) { return j.title === 'The Coquille'; })[0];
  assert.ok(k3 && e3.atLargeCardFor(k3), 'a new King still gets a card');
  assert.ok(/The name is .*\. It is not in your Rolls\. It will be\./.test(told3.text), told3.text);
  // The King is not sworn into a band: three more abroad, and he keeps his crown and his shell.
  var e4 = CF.Engine.newGame({ seed: 3, calling: 'master' });
  e4.s.rank = 2;
  function abroad(n) {
    var c = e4.criminalEscapes({ title: 'Case ' + n, template: 'burglary' }, { name: 'Thief ' + n, trait: 'limp' }, 'cold');
    e4.create('atlarge', { label: 'Abroad: ' + c.name, data: { name: c.name, trait: c.trait, criminalId: c.id } });
    return c;
  }
  var boss = abroad(0); boss.crimes = 9;
  e4.spawnSyndicate('test');
  var king4 = e4.criminal(e4.court().king.criminalId);
  assert.strictEqual(king4.name, 'Thief 0');
  abroad(1); abroad(2);
  e4.organise();
  assert.strictEqual(king4.organization, 'syndicate', 'the King keeps the Coquille');
  assert.ok(!e4.atLargeCardFor(king4).data.band, 'his card wears no band');
  assert.ok(!byDef(e4, 'gang').length, 'two men do not make a band without him');
  abroad(3);
  e4.organise();
  var band = byDef(e4, 'gang')[0];
  assert.ok(band && band.data.members.indexOf('Thief 0') < 0, 'three others do, and he is not of it: ' + (band && band.data.members));
  console.log('king: ok');
})();

// ---- Treaty -------------------------------------------------------------------
(function treaty() {
  var e = game(2);
  var r = run(e, 'investigate', [byDef(e, 'syndicate')[0], byDef(e, 'focus')[0]]);
  assert.strictEqual(r.recipe, 'undercover_parley');
  assert.strictEqual(e.court().stance, 'treaty');
  var j0 = e.s.paths.crusader;
  e.pathGain('crusader', 3, 'test');
  assert.strictEqual(e.s.paths.crusader, j0, 'Justice scores nothing under a Treaty');
  e.pathGain('commissioner', 1, 'test');
  // Weeks under the Treaty: quiet, a culprit handed over, the Court's own closings, tribute.
  var open0 = e.openCases().length;
  e.s.meters.pressure = 3;
  var lines = e.coquilleWeek();
  assert.ok(lines.some(function (l) { return /quiet/.test(l); }));
  assert.ok(e.openCases().length > open0, 'the Court hands over a case');
  assert.ok(byDef(e, 'clue').some(function (c) { return /Court's Word/.test(e.labelOf(c)); }), 'with the Court\'s word');
  assert.strictEqual(byDef(e, 'tribute').length, 1, 'tribute waits');
  var f0 = byDef(e, 'funds').length;
  var t = run(e, 'duty', [byDef(e, 'tribute')[0]]);
  assert.strictEqual(t.recipe, 'duty_tribute');
  assert.strictEqual(byDef(e, 'funds').length - f0, 2);
  assert.strictEqual(e.s.counts.purse, 1);
  // A tribute left to lie is counted; twice, and the Court's boy stops bringing names until it is taken.
  var open1 = e.openCases().length;
  e.expire(e.create('tribute'));
  assert.strictEqual(e.court().ignoredTribute, 1, 'the King counts a purse that came back');
  e.expire(e.create('tribute'));
  assert.strictEqual(e.court().ignoredTribute, 2);
  e.openCases().forEach(function (r) { e.goCold(r.id); });
  e.s.meters.pressure = 3; e.s.week = e.court().since + 1;
  var l2 = e.coquilleWeek();
  assert.strictEqual(e.openCases().length, 0, 'no name comes up from the Warrens while the purse lies');
  assert.ok(l2.some(function (l) { return /stops bringing names/.test(l); }), 'and the week says so once');
  e.s.week++;
  var l3 = e.coquilleWeek();
  assert.ok(!l3.some(function (l) { return /stops bringing names/.test(l); }), 'said once');
  assert.strictEqual(e.openCases().length, 0, 'still no names');
  var t2 = run(e, 'duty', [byDef(e, 'tribute')[0]]);
  assert.strictEqual(t2.recipe, 'duty_tribute');
  assert.strictEqual(e.court().ignoredTribute, 0, 'taking the tribute makes it good');
  e.s.meters.pressure = 3; e.s.week++;
  e.coquilleWeek();
  assert.ok(e.openCases().length >= 1, 'and the names come back');
  void open1;
  // Two weeks in, a case arrives closed by the Court.
  e.s.week = e.court().since + 2;
  e.coquilleWeek();
  assert.ok((e.s.stats.byCourt || 0) >= 1, 'closed by the Court');
  // Twelve quiet weeks: the Treaty City.
  e.court().quietWeeks = 11; e.s.meters.pressure = 2;
  e.coquilleWeek();
  assert.ok(e.s.over && e.s.over.id === 'treatycity' && e.s.over.win, 'the Treaty City');
  // Indicting the Coquille breaks a treaty.
  var g = game(3);
  run(g, 'investigate', [byDef(g, 'syndicate')[0], byDef(g, 'focus')[0]]);
  g.breakTreaty('test');
  assert.strictEqual(g.court().stance, null);
  console.log('treaty: ok');
})();

// ---- Rule ---------------------------------------------------------------------
(function rule() {
  var inside = null;
  for (var i = 0; i < 20 && !inside; i++) {
    var e = game(10 + i);
    e.create('funds'); e.create('funds');
    var r = run(e, 'investigate', [byDef(e, 'syndicate')[0], byDef(e, 'instinct')[0], byDef(e, 'funds')[0], byDef(e, 'funds')[1]]);
    assert.strictEqual(r.recipe, 'undercover_trial', r.recipe);
    if (e.court().inside) inside = e;
  }
  assert.ok(inside, 'the Court\'s trial can be passed');
  var e2 = inside;
  assert.ok(!e2.canTakeThrone());
  assert.ok(/does not crown the honest|weeks/.test(e2.throneReason()));
  e2.autoSlot('investigate', byDef(e2, 'syndicate')[0].uid); e2.autoSlot('investigate', (byDef(e2, 'instinct')[0] || e2.create('instinct')).uid);
  var pv = e2.preview('investigate');
  assert.ok(/Not yet/.test(pv.blocked || pv.text), 'the throne is not yet yours: ' + (pv.blocked || pv.text));
  e2.clearSlots('investigate');
  for (var w = 0; w < 4; w++) e2.coquilleWeek();
  assert.ok(e2.court().insideWeeks >= 4, 'four weeks inside: ' + e2.court().insideWeeks);
  assert.ok(byDef(e2, 'clue').some(function (c) { return /Court's Word/.test(e2.labelOf(c)); }), 'from inside you feed the Watch-house');
  e2.s.counts.purse = 4; e2.s.counts.cruelty = 2;
  assert.ok(e2.canTakeThrone());
  var th = run(e2, 'investigate', [byDef(e2, 'syndicate')[0], byDef(e2, 'instinct')[0]]);
  assert.strictEqual(th.recipe, 'undercover_throne');
  assert.ok(e2.s.over && e2.s.over.id === 'kingofthunes' && e2.s.over.win, 'the King of Thunes');
  console.log('rule: ok');
})();

// ---- Eradicate still works, and costs Dread; saves keep the court ---------------
(function eradicate() {
  var e = game(30);
  e.create('ledger'); e.create('ledger');
  var r = run(e, 'investigate', [byDef(e, 'syndicate')[0], byDef(e, 'instinct')[0]]);
  assert.strictEqual(r.recipe, 'undercover_op');
  assert.ok(e.s.flags.syndicateCase, 'the case against the Coquille opens');
  var d0 = e.s.meters.dread;
  e.coquilleFalls();
  assert.strictEqual(e.s.meters.dread - d0, 2, 'raiding the Warrens costs Dread');
  var again = CF.Engine.load(e.save());
  assert.ok(again.s.court && again.s.court.king.name === e.court().king.name);
  var old = JSON.parse(CF.Engine.newGame({ seed: 5, calling: 'master' }).save()); delete old.court;
  assert.strictEqual(CF.Engine.load(old).court().stance, null);
  console.log('eradicate: ok');
})();

// ---- The Crusader's Coquille waits for the Bailiff's Disguise ---------------------
(function crusaderWaits() {
  var e = CF.Engine.newGame({ seed: 41, calling: 'crusader' });
  e.s.week = 6; e.s.rank = 0;
  e.organise();
  assert.strictEqual(e.countOf('syndicate'), 0, 'no Coquille at week 6 below Bailiff: nothing could touch it');
  var word = e.s.journal.filter(function (j) { return j.title === 'The Same Door'; });
  assert.strictEqual(word.length, 1, 'the city says its name instead');
  e.s.week = 12; e.s.rank = 1;
  e.organise();
  assert.strictEqual(e.countOf('syndicate'), 0, 'still none under a Sworn Examiner');
  assert.strictEqual(e.s.journal.filter(function (j) { return j.title === 'The Same Door'; }).length, 1, 'said once');
  e.s.rank = 2; e.s.week = 9;
  e.organise();
  assert.strictEqual(e.countOf('syndicate'), 0, 'a new Bailiff gets a week or two first');
  e.s.week = 10;
  e.organise();
  assert.strictEqual(e.countOf('syndicate'), 1, 'at Bailiff from week ten the Coquille is there, and Disguise with it');
  // The broadsheet's tally: the Coquille counts one, and nothing while you are inside it.
  var t0 = e.abroadTally();
  assert.strictEqual(t0.n, e.cardsOf('atlarge').filter(function (c) { return !c.data.band; }).length + e.countOf('gang') * 2 + 1);
  assert.strictEqual(t0.at, 4);
  assert.strictEqual(t0.every, 1, 'every week under a Bailiff');
  // An older save past week six has had its warning; a newer one keeps what it has.
  var old = JSON.parse(CF.Engine.newGame({ seed: 42, calling: 'crusader' }).save());
  delete old.flags.coquilleWord; old.week = 9;
  assert.strictEqual(CF.Engine.load(old).s.flags.coquilleWord, true, 'an old save past week six is not warned late');
  var young = JSON.parse(CF.Engine.newGame({ seed: 43, calling: 'crusader' }).save());
  delete young.flags.coquilleWord;
  var ly = CF.Engine.load(young);
  assert.strictEqual(ly.s.flags.coquilleWord, false, 'an old save before week six will hear it');
  ly.s.week = 6; ly.organise();
  assert.ok(ly.s.journal.some(function (j) { return j.title === 'The Same Door'; }));
  console.log('crusader waits: ok');
})();

// ---- The broadsheet's tally names its count ----------------------------------------
(function tally() {
  var e = CF.Engine.newGame({ seed: 44, calling: 'master' });
  e.s.week = 8;
  for (var i = 0; i < 3; i++) e.create('atlarge', { label: 'Abroad: N' + i, data: { name: 'N' + i } });
  assert.strictEqual(e.abroadTally().n, 3);
  assert.strictEqual(e.abroadTally().every, 2, 'every other week below Bailiff');
  e.spawnSyndicate('test');
  var names = e.cardsOf('atlarge').filter(function (c) { return !c.data.band; }).length; // the King may walk abroad too
  assert.strictEqual(e.abroadTally().n, names + 1, 'the Coquille counts one: its sworn feed the Vendetta, not the broadsheet');
  e.s.cases.inside = { id: 'inside', template: 'syndicate', status: 'open', suspects: [], witnesses: [] };
  assert.strictEqual(e.abroadTally().n, names, 'and nothing while a case against it is open');
  console.log('tally: ok');
})();

console.log('coquille: king, treaty, rule, eradicate all OK');
