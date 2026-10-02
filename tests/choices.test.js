// The city's questions: every one has a free way out, an answer can be paid
// from a card waiting in a verb, and an ability paid is spent, not lost.
// Run: node tests/choices.test.js
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
function spec(id) { return CF.CHOICES.filter(function (c) { return c.id === id; })[0]; }
function game(seed) { return CF.Engine.newGame({ seed: seed, calling: 'master', life: true }); }

// ---- A free way out ---------------------------------------------------------------
CF.CHOICES.forEach(function (c) {
  assert.ok(c.options.some(function (o) { return !o.cost; }), c.id + ' has an answer that costs nothing');
  c.options.forEach(function (o) { assert.ok(typeof o.effect === 'function' && o.label && o.text, c.id + ': ' + o.label); });
});
assert.ok(spec('swan').options.some(function (o) { return o.label === 'Sleep at the desk' && !o.cost; }), 'the Swan can be refused');
console.log('free way out: ok');

// ---- Paying from a verb -------------------------------------------------------------
// Wit spent and the only Coin waiting in Attend's output: the room at the Swan can still be taken, and the clock moves after.
var e = game(3);
e.cardsOf('funds', true).forEach(function (c) { e.remove(c); });
e.cardsOf('focus', true).forEach(function (c) { e.transform(c, 'spent_focus', { decay: 40 }); });
e.create('fatigue');
var duty = e.verb('duty');
var coin = e.make('funds'); coin.loc = { t: 'out', verb: 'duty' }; duty.out.push(coin.uid); duty.status = 'done'; duty.story = { title: 'The Round', text: '' };
assert.strictEqual(e.countOf('funds'), 1);
e.offerChoice(spec('swan'));
assert.ok(e.s.choice && e.s.choice.id === 'swan');
assert.ok(!e.canChoose(1), 'Wit is spent: no working through');
assert.ok(e.canChoose(0), 'the Coin in Attend\'s output pays for the room');
assert.ok(e.canChoose(2), 'and sleeping at the desk costs nothing');
var t0 = e.s.t;
e.tick(1);
assert.strictEqual(e.s.t, t0, 'the clock waits for the answer');
assert.ok(e.choose(0));
assert.strictEqual(e.s.choice, null);
assert.strictEqual(e.cardsOf('funds', true).length, 0, 'the Coin is spent');
assert.strictEqual(duty.status, 'idle', 'Attend is clear once its only output is taken');
assert.strictEqual(e.countOf('fatigue'), 0, 'Weariness lifted');
e.tick(1);
assert.ok(e.s.t > t0, 'the clock moves');
// Coin waiting in an idle verb's slot pays too; the table's own Coin pays first.
var g = game(4);
g.cardsOf('funds', true).forEach(function (c) { g.remove(c); });
var slotCoin = g.create('funds'), letter = g.cardsOf('personnel')[0];
assert.ok(g.slotCard('duty', 'main', letter.uid) && g.slotCard('duty', 'f1', slotCoin.uid), 'a Coin waits in Attend');
assert.strictEqual(slotCoin.loc.t, 'slot');
g.offerChoice(spec('beggar'));
assert.ok(g.canChoose(0), 'the Coin in the slot pays');
var tableCoin = g.create('funds');
assert.strictEqual(g.choicePayment(spec('beggar').options[0]).uid, tableCoin.uid, 'the table pays before the slot');
g.remove(tableCoin);
assert.ok(g.choose(0));
assert.strictEqual(g.cardsOf('funds', true).length, 0, 'the slot\'s Coin was spent');
assert.strictEqual(g.verb('duty').slots.f1, undefined, 'and its slot is empty');
// A running verb keeps what it holds.
var r = game(5);
r.cardsOf('funds', true).forEach(function (c) { r.remove(c); });
var held = r.create('funds'), rl = r.cardsOf('personnel')[0];
r.slotCard('duty', 'main', rl.uid); r.slotCard('duty', 'f1', held.uid);
if (r.start('duty')) {
  r.offerChoice(spec('beggar'));
  assert.ok(!r.canChoose(0), 'a Coin at work in a running verb cannot pay');
  r.choose(1);
}
console.log('paying from a verb: ok');

// ---- Spent, not lost ------------------------------------------------------------------
var h = game(6);
var hp = h.cardsOf('health', true).length;
h.offerChoice(spec('bishop'));
assert.strictEqual(h.s.choice.options[0].forGood, false, 'the offer says whether the card is lost for good');
assert.ok(h.choose(0), 'Go, and be seen');
assert.strictEqual(h.cardsOf('health', true).length, hp - 1, 'the Health is taken');
assert.strictEqual(h.countOf('spent_health'), 1, 'and comes back Winded');
var winded = h.cardsOf('spent_health')[0];
assert.strictEqual(winded.life, CF.CARDS.spent_health.decay, 'with the usual decay');
h.tick(winded.life + 0.1);
assert.strictEqual(h.cardsOf('health', true).length, hp, 'it is back');
// Marked for good, it is gone.
CF.CHOICES.push({ id: 'test_forgood', when: function () { return false; }, title: 'A Test', text: 'x', options: [{ label: 'Pay', cost: 'health', forGood: true, text: 'x', effect: function () {} }, { label: 'No', text: 'x', effect: function () {} }] });
try {
  var f = game(7);
  var fp = f.cardsOf('health', true).length;
  f.offerChoice(spec('test_forgood'));
  assert.strictEqual(f.s.choice.options[0].forGood, true);
  assert.ok(f.choose(0));
  assert.strictEqual(f.cardsOf('health', true).length, fp - 1);
  assert.strictEqual(f.countOf('spent_health'), 0, 'for good: no Winded comes back');
} finally { CF.CHOICES.pop(); }
console.log('spent, not lost: ok');

// ---- The city keeps asking ------------------------------------------------------------
// A question with a second wording comes back ten weeks on, in that wording; the rest are asked once.
var k = game(8);
k.offerChoice(spec('beggar'));
assert.strictEqual(k.s.choicesSeen.beggar, k.s.week, 'the week it was asked is kept');
assert.strictEqual(k.s.choice.text, spec('beggar').text, 'the first time, the first wording');
assert.ok(k.choose(1));
k.s.week += CF.CHOICE_AGAIN_WEEKS - 1;
assert.ok(!k.choiceOpenFor(spec('beggar')), 'nine weeks on it is not asked again');
k.s.week += 1;
assert.ok(k.choiceOpenFor(spec('beggar')), 'ten weeks on it is');
assert.ok(!k.choiceOpenFor(spec('bishop')) || !k.s.choicesSeen.bishop, 'a question with one wording is asked once');
k.offerChoice(spec('bishop')); k.choose(1);
k.s.week += CF.CHOICE_AGAIN_WEEKS;
assert.ok(!k.choiceOpenFor(spec('bishop')), 'and never again');
k.offerChoice(spec('beggar'));
assert.strictEqual(k.s.choice.text, spec('beggar').again, 'the second time, the second wording');
assert.ok(k.s.journal[0].text.indexOf(spec('beggar').again) === 0, 'and the journal has it');
k.choose(1);
// Older saves kept true: asked, and not again.
k.create('fatigue'); k.s.choicesSeen.swan = true; k.s.week += 20;
assert.ok(spec('swan').when(k), 'the Swan would offer');
assert.ok(!k.choiceOpenFor(spec('swan')), 'a save that only remembers it was asked keeps it closed');
['cudgel', 'market', 'upright', 'dinner', 'knock'].forEach(function (id) { assert.ok(spec(id) && spec(id).when && !spec(id).after, id + ' comes on the city\'s clock'); });
// The late questions wait for the city's temper.
var late = game(9);
assert.ok(!spec('cudgel').when(late) && !spec('market').when(late) && !spec('dinner').when(late) && !spec('upright').when(late) && !spec('knock').when(late), 'none of them on the first day');
late.s.meters.retaliation = 5; assert.ok(spec('cudgel').when(late), 'a cudgel at Vendetta 5');
late.s.meters.dread = 6; assert.ok(spec('market').when(late), 'an empty Market at Dread 6');
late.s.meters.reputation = 6; assert.ok(spec('dinner').when(late), 'the Council\'s dinner at Standing 6');
late.create('gang', { label: 'The Lanternless', data: { name: 'The Lanternless' } }); assert.ok(spec('upright').when(late), 'the upright man once a Band is on the table');
var inf = late.create('informant', late.informantSpec('market'));
assert.ok(!spec('knock').when(late), 'a safe informer knocks on nobody\'s door');
late.heatInformant(inf, CF.INFORMANT.compromisedAt);
assert.ok(spec('knock').when(late), 'a compromised one does');
late.offerChoice(spec('knock')); late.create('funds');
assert.ok(late.choose(0), 'put up at the Watch-house');
assert.strictEqual(late.informantStatus(inf), 'safe', 'and safe again');
late.offerChoice(spec('upright')); var ret = late.s.meters.retaliation, fundsN = late.cardsOf('funds', true).length;
assert.ok(late.choose(0)); assert.strictEqual(late.s.meters.retaliation, ret - 3); assert.strictEqual(late.cardsOf('funds', true).length, fundsN + 1); assert.strictEqual(late.s.counts.purse, 1);
late.offerChoice(spec('cudgel')); var hp0 = late.cardsOf('health', true).length + late.countOf('spent_health');
assert.ok(late.choose(2), 'bar the door: free');
assert.ok(late.cardsOf('health', true).length + late.countOf('spent_health') + late.countOf('wound') >= hp0, 'he came back, or he did not');
console.log('the city keeps asking: ok');

// ---- A need that cannot be paid stops re-arming ------------------------------------------
var n = game(10);
while (n.cardsOf('health', true).length > 1) n.remove(n.cardsOf('health', true)[0]);
var debt0 = (n.s.counts && n.s.counts.debt) || 0, press0 = n.s.meters.pressure;
n.create('hunger', { lifetime: 2 }); n.tick(2.01);
var again = n.cardsOf('hunger')[0];
assert.ok(again && again.data.repeat === 1, 'it comes once more, and knows it');
assert.ok(n.s.journal.some(function (j) { return j.title === 'Hunger Deepens' && /It will come again\.$/.test(j.text); }), 'and says so');
again.life = 1; n.tick(1.01);
assert.strictEqual(n.countOf('hunger'), 0, 'the second time it stops asking');
assert.strictEqual(n.s.counts.debt, debt0 + 1, 'the cookshop is owed');
assert.strictEqual(n.s.meters.pressure, press0 + 1, 'and the Market knows');
assert.ok(n.s.journal.some(function (j) { return j.title === 'Hunger Deepens' && /stopped asking/.test(j.text); }));
console.log('a need stops re-arming: ok');

// ---- The Rival races you ------------------------------------------------------------------
var rv = game(11);
rv.s.week = 8;
while (!rv.cardsOf('rival', true).length) rv.rivalWeek();
var rival = rv.cardsOf('rival', true)[0], rec = rv.openCases()[0];
assert.ok(/Harbourmaster/.test(rv.s.journal[0].text), 'sent by the Harbourmaster');
rv.tableCards().filter(function (c) { return c.def === 'clue' || c.def === 'evidence' || c.def === 'witness'; }).forEach(function (c) { rv.remove(c); });
assert.deepStrictEqual(rv.rivalWeek(), [], 'an unopened case is not raced');
rec.searches = 1;
assert.deepStrictEqual(rv.rivalWeek().length, 1, 'opened and a week old: taken up');
assert.ok(rec.rival && rec.rivalSince === rv.s.week, 'the week it was taken is kept');
rv.s.week += 1;
var lines = rv.rivalWeek();
assert.ok(lines.some(function (l) { return /boasting/.test(l); }), 'a week on they boast: ' + lines);
assert.ok(rv.s.journal.some(function (j) { return j.title === 'The Rival Boasts' && j.text.indexOf(rec.title) >= 0; }), 'in the Red Ox, by name');
assert.strictEqual(rec.status, 'open', 'and the case is still yours');
rv.s.week += 1;
var crowd0 = rv.s.meters.pressure, cold0 = rv.s.stats.cold, rep0 = rv.s.meters.reputation, ended = [];
rv.on(function (type, p) { if (type === 'resolved') ended.push(p); });
rv.rivalWeek();
// Answered by the Rival, not gone cold: no Crowd, no Unanswered card, no 'walked'; Standing pays.
assert.strictEqual(rec.status, 'rival', 'two weeks on they close it');
assert.strictEqual(rv.s.meters.pressure, crowd0, 'the Crowd does not rise for a case the Rival answered');
assert.strictEqual(rv.s.stats.cold, cold0, 'not counted unanswered');
assert.strictEqual(rv.s.meters.reputation, Math.max(0, rep0 - 1), 'the Council notes who was quicker');
assert.strictEqual(rv.countOf('coldcase'), 0, 'no Unanswered card');
assert.ok(!rv.s.journal.some(function (j) { return j.title === 'The Trail Goes Cold'; }), 'nobody hears the crier and laughs');
assert.ok(ended.length === 1 && ended[0].outcome === 'rival' && ended[0].charged, 'the archive says the Rival answered it, and whom they hanged');
assert.ok(rv.s.journal.some(function (j) { return j.title === 'Answered by the Rival' && j.text.indexOf(ended[0].charged) >= 0; }), 'the story names the confession');
// Spoiled tokens and bought witnesses carry the mark.
var rv2 = game(12); rv2.s.week = 8;
while (!rv2.cardsOf('rival', true).length) rv2.rivalWeek();
rv2.openCases().forEach(function (x) { x.rival = true; x.rivalSince = rv2.s.week; });
var clue = rv2.create('clue', { label: 'A Boot-print', aspects: { forensic: 2 } });
for (var tries = 0; tries < 40 && !clue.data.tampered; tries++) rv2.rivalWeek();
assert.ok(clue.data.tampered, 'a spoiled token is marked');
rv2.remove(clue);
var wtn = rv2.create('witness', { label: 'Witness: the Tiler', lifetime: 200, data: { knows: true } });
for (var tries2 = 0; tries2 < 40 && !wtn.data.bribed; tries2++) rv2.rivalWeek();
assert.ok(wtn.data.bribed, 'a bought witness is marked');
console.log('the rival races you: ok');

// ---- The Rival's close: the right name, or a wrong one the ballad tells later --------------
(function rivalCloses() {
  var rights = 0, wrongs = 0;
  for (var sd = 30; sd < 50; sd++) {
    var g = game(sd), r = g.openCases()[0], culprit = r.suspects.filter(function (x) { return x.guilty; })[0];
    var res = g.rivalCloses(r, 'Piet Wieland');
    var c = g.criminalByName(culprit.name);
    if (res.right) {
      rights++;
      assert.strictEqual(res.name, culprit.name);
      assert.ok(!c || c.status === 'jailed', 'the right name is done with');
      assert.strictEqual(g.criminalsAtLarge().filter(function (x) { return x.name === culprit.name; }).length, 0);
    } else {
      wrongs++;
      assert.notStrictEqual(res.name, culprit.name, 'a wrong name hanged');
      assert.ok(c && c.hidden && c.wrongfulBy === 'Piet Wieland' && c.wrongfulHow === 'rope', 'the real culprit keeps their head down');
      assert.strictEqual(g.atLargeCardFor(c), null, 'no Abroad card yet');
      g.s.week = c.surfaceWeek;
      g.surfaceCriminal(c, false);
      var told = g.s.journal.filter(function (j) { return j.title === 'The Wrong Name'; })[0];
      assert.ok(told && told.text.indexOf('Piet Wieland') > 0 && told.text.indexOf('you sent down') < 0, 'the ballad blames the Rival: ' + (told && told.text));
      assert.strictEqual(g.s.journal.filter(function (j) { return j.title === 'The Wrong Name'; }).length, 1, 'told once');
      assert.ok(g.atLargeCardFor(c), 'and now they are Abroad');
      assert.ok(!c.wrongfulBy, 'the mark is spent');
    }
    assert.strictEqual(g.countOf('coldcase'), 0);
    assert.strictEqual(g.s.stats.wrongful, 0, 'the Rival\'s wrong name is not counted against you');
  }
  assert.ok(rights > 0 && wrongs > 0, 'both happen: ' + rights + '/' + wrongs);
  // A case of the bands, the Court or the Architect is never theirs to take.
  var sp = game(51); sp.s.week = 8;
  sp.openCases().forEach(function (x) { x.special = true; x.searches = 1; x.week = 0; });
  sp.create('rival', { label: 'The Rival: Piet Wieland', data: { name: 'Piet Wieland', heat: 0, stalled: 0 } });
  sp.tableCards().filter(function (c) { return c.def === 'clue' || c.def === 'evidence' || c.def === 'witness'; }).forEach(function (c) { sp.remove(c); });
  assert.deepStrictEqual(sp.rivalWeek(), [], 'nothing of the bands or the Court to race');
  console.log('the rival closes: ok');
})();

// ---- The upright man's Coin comes every week while the band stands --------------------------
(function upright() {
  var u = game(21);
  u.s.flags.firstCase = true;
  var band = u.create('gang', { label: 'Band: The Lanternless', data: { name: 'the Lanternless' } });
  u.offerChoice(spec('upright'));
  assert.ok(/a week while the band stands/.test(u.s.choice.options[0].gain), 'the gain says it comes weekly');
  assert.ok(u.choose(0));
  assert.strictEqual(u.s.flags.uprightPaid, 'the Lanternless');
  var purse0 = u.s.counts.purse;
  for (var w = 0; w < 2; w++) {
    var f0 = u.cardsOf('funds', true).length, lines = u.rivalWeek();
    assert.ok(lines.indexOf(CF.UPRIGHT_WEEK.paid) >= 0, 'the boy comes: ' + lines);
    assert.strictEqual(u.cardsOf('funds', true).length, f0 + 1, 'with a Coin');
  }
  assert.strictEqual(u.s.counts.purse, purse0 + 1, 'the purse counted every other week');
  u.remove(band);
  var l2 = u.rivalWeek(), f1 = u.cardsOf('funds', true).length;
  assert.ok(l2.indexOf(CF.UPRIGHT_WEEK.broken) >= 0, 'the band broken: the boy stops coming');
  assert.ok(!u.s.flags.uprightPaid);
  assert.ok(u.rivalWeek().indexOf(CF.UPRIGHT_WEEK.broken) < 0, 'and that is said once');
  assert.strictEqual(u.cardsOf('funds', true).length, f1);
  console.log('the upright man pays weekly: ok');
})();

// ---- The note with the purse names a case of yours ---------------------------------------
(function purseNote() {
  var p = game(22);
  var rec = p.openCases()[0];
  p.offerChoice(spec('purse'));
  assert.strictEqual(p.s.choice.title, 'The Note with the Purse');
  assert.notStrictEqual(spec('purse').title, 'A Purse on the Desk', 'not the bribe card\'s words');
  assert.ok(p.s.choice.text.indexOf(rec.title) > 0 && p.s.choice.text.indexOf('{') < 0, 'the note names the case: ' + p.s.choice.text);
  assert.strictEqual(p.s.choice.ctx.caseId, rec.id);
  var unnamed = rec.suspects.filter(function (x) { return !x.revealed; }).length;
  p.create('instinct');
  assert.ok(p.choose(1), 'find who left it');
  assert.strictEqual(rec.suspects.filter(function (x) { return !x.revealed; }).length, unnamed - 1, 'a name in that case');
  var told = p.s.journal.filter(function (j) { return j.title === 'The Note with the Purse: Find who left it'; })[0];
  assert.ok(told && told.text.indexOf(rec.title) > 0, 'told whose door it was: ' + (told && told.text));
  // Nobody left to name: the Informer on the Hill, as before.
  var q = game(23), rq = q.openCases()[0];
  rq.suspects.forEach(function (x) { x.revealed = true; });
  q.offerChoice(spec('purse')); q.create('instinct');
  var inf0 = q.countOf('informant');
  assert.ok(q.choose(1));
  assert.strictEqual(q.countOf('informant'), inf0 + 1, 'an Informer on the Hill');
  // No open case: the note has nothing to name, and the question is not put.
  var z = game(24); z.s.week = 3;
  z.openCases().forEach(function (x) { x.status = 'closed'; });
  assert.ok(!spec('purse').when(z), 'no case, no note');
  console.log('the note with the purse: ok');
})();

// ---- A save from before: an old purse question, a Rival's case, no upright flag ----------
(function oldSave() {
  var o = game(25);
  o.s.flags.firstCase = true;
  var orec = o.openCases()[0];
  var raw = JSON.parse(o.save());
  // As an older build saved it: the old title and words, no case chosen, no new flags.
  raw.choice = { id: 'purse', title: 'A Purse on the Desk', text: 'Nobody saw who left it. Three Coin, good silver, and a note with the name of a case on it and nothing else.', ctx: null,
    options: spec('purse').options.map(function (op) { return { label: op.label, text: op.text, cost: op.cost || null, gain: op.gain || null, forGood: false }; }) };
  delete raw.flags.uprightPaid; delete raw.flags.uprightWeeks; delete raw.stats.byRival;
  var l = CF.Engine.load(JSON.stringify(raw));
  assert.ok(l.s.choice && l.s.choice.id === 'purse', 'the old question is still put');
  assert.ok(l.choose(0), 'and can be answered');
  assert.deepStrictEqual(l.rivalWeek().filter(function (x) { return x === CF.UPRIGHT_WEEK.paid; }), [], 'no boy for an offer never taken');
  l.create('rival', { label: 'The Rival: Piet Wieland', data: { name: 'Piet Wieland', heat: 0, stalled: 0 } });
  var lrec = l.caseRec(orec.id);
  assert.ok(l.rivalCloses(lrec, 'Piet Wieland') && lrec.status === 'rival' && l.s.stats.byRival === 1, 'the Rival closes a case of an old save');
  console.log('an old save loads: ok');
})();

// ---- The calling says which end it is ------------------------------------------------------
(function callingEnds() {
  var cl = spec('calling');
  assert.ok(/end you work toward/.test(cl.text));
  cl.options.forEach(function (o) { assert.ok(/^Your end: /.test(o.gain), o.label + ' names its end'); });
  assert.ok(/Seat/.test(cl.options[0].gain) && /Architect/.test(cl.options[1].gain) && /Coquille/.test(cl.options[2].gain));
  console.log('the calling names its end: ok');
})();

// ---- The ending's own numbers ----------------------------------------------------------
var m = game(13);
m.s.stats.sentHome = 9;
for (var ci = 0; ci < 2; ci++) m.criminalFor('Citizen ' + ci, null).status = 'reformed';
m.gameOver('merciful');
assert.strictEqual(m.s.over.text.indexOf('9 times you sent a poor sinner home'), 0, 'the Merciful Judge counts the ones sent home: ' + m.s.over.text);
assert.ok(m.s.over.text.indexOf('and 2 of them are citizens now') > 0, 'and the reformed');
assert.ok(m.s.over.text.indexOf('{') < 0, 'nothing left unfilled');
// A save from before the count of those sent home: never fewer sent home than reformed.
var m2 = game(14);
delete m2.s.stats.sentHome;
for (var cj = 0; cj < 3; cj++) m2.criminalFor('Burgher ' + cj, null).status = 'reformed';
m2.gameOver('merciful');
assert.strictEqual(m2.s.over.text.indexOf('3 times you sent a poor sinner home'), 0, 'an old save counts the reformed as sent home: ' + m2.s.over.text);
CF.ENDING_VARIANTS.master.forEach(function (v) { assert.ok(/your own lintel, and you rub them out with your thumb\.$/.test(v.text), 'the Scholar ends at the lintel'); });
console.log('the ending\'s numbers: ok');

// ---- A save from before the swan's free answer: the window shows the spec's answers --------
(function oldSwan() {
  var o = game(31);
  o.s.flags.firstCase = true;
  o.offerChoice(spec('swan'));
  // No Coin on the table, and the Wit spent: neither of the old two answers can be paid.
  o.cardsOf('funds', true).forEach(function (c) { o.remove(c); });
  o.cardsOf('focus', true).forEach(function (c) { o.remove(c); });
  var raw = JSON.parse(o.save());
  raw.choice.options = raw.choice.options.slice(0, 2); // as the build before the free answer saved it
  raw.choice.title = 'A Room at the Swan'; raw.choice.text = 'The text the old build wrote.';
  var l = CF.Engine.load(JSON.stringify(raw));
  assert.strictEqual(l.s.choice.options.length, spec('swan').options.length, 'the answers are read again from the spec');
  assert.strictEqual(l.s.choice.options[2].label, 'Sleep at the desk', 'the free way out is shown');
  assert.strictEqual(l.s.choice.text, 'The text the old build wrote.', 'the question keeps its stored words');
  var payable = l.s.choice.options.map(function (op, i) { return l.canChoose(i); });
  assert.ok(payable.indexOf(true) >= 0, 'some shown answer can be taken: ' + JSON.stringify(payable));
  var t0 = l.s.t;
  assert.ok(l.choose(2), 'the free answer is taken');
  for (var i = 0; i < 20; i++) l.tick(0.5);
  assert.ok(l.s.t > t0, 'and the clock moves again');
  // A fresh save is left as it is.
  var f = game(32); f.s.flags.firstCase = true; f.offerChoice(spec('swan'));
  assert.ok(!f.refreshChoice(), 'a question asked by this build needs no refresh');
  console.log('an old swan question loads with its free answer: ok');
})();

// ---- An old save's Merciful ending counts the pardoned rogues as sent home ---------------
(function oldMercy() {
  var g = game(33);
  delete g.s.stats.sentHome;
  g.criminalFor('Citizen A', null).status = 'reformed';
  var sp = g.criminalFor('Rogue B', null); sp.traits.push('spared');
  var sp2 = g.criminalFor('Rogue C', null); sp2.traits.push('spared');
  g.gameOver('merciful');
  assert.strictEqual(g.s.over.text.indexOf('3 times you sent a poor sinner home'), 0, 'reformed and spared both went home: ' + g.s.over.text);
  assert.ok(g.s.over.text.indexOf('and 1 of them are citizens now') > 0, 'one is a citizen');
  console.log('an old save\'s mercy counted: ok');
})();

console.log('choices: all OK');
