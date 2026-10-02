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
assert.strictEqual(m.s.over.text.indexOf('Nine times you sent a poor sinner home'), 0, 'the Merciful Judge counts the ones sent home, in words: ' + m.s.over.text);
assert.ok(m.s.over.text.indexOf('and two of them are citizens now') > 0, 'and the reformed');
assert.ok(m.s.over.text.indexOf('{') < 0, 'nothing left unfilled');
// A save from before the count of those sent home: never fewer sent home than reformed.
var m2 = game(14);
delete m2.s.stats.sentHome;
for (var cj = 0; cj < 3; cj++) m2.criminalFor('Burgher ' + cj, null).status = 'reformed';
m2.gameOver('merciful');
assert.strictEqual(m2.s.over.text.indexOf('Three times you sent a poor sinner home'), 0, 'an old save counts the reformed as sent home: ' + m2.s.over.text);
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
  assert.strictEqual(g.s.over.text.indexOf('Three times you sent a poor sinner home'), 0, 'reformed and spared both went home: ' + g.s.over.text);
  assert.ok(g.s.over.text.indexOf('and one of them is a citizen now') > 0, 'one is a citizen');
  console.log('an old save\'s mercy counted: ok');
})();

console.log('choices: all OK');

// ---- Endings say what happened: who struck the last blow, a list without purses, the names -----
(function endingsName() {
  function over(seed, id, set) { var g = game(seed); if (set) set(g); g.gameOver(id); return g.s.over.text; }
  var bys = { order: /Order of the Mountain warned you once/, court: /Court of Miracles threw you in the ditch/, cover: /borrowed name slipped/ };
  Object.keys(bys).forEach(function (by, i) {
    var t = over(40 + i, 'death', function (g) { g.s.stats.killedBy = by; g.s.stats.attacks = 3; });
    assert.ok(bys[by].test(t) && !/cellar by the Harbour/.test(t), by + ': ' + t);
  });
  assert.ok(/cellar by the Harbour/.test(over(43, 'death', function (g) { g.s.stats.killedBy = 'stair'; })), 'the cudgel on the stair keeps the plain telling');
  // Never a purse and hardly a cruelty: the list is of doors and pardons.
  var clean = over(44, 'corruption', function (g) { g.s.counts.purse = 0; g.s.counts.cruelty = 1; g.s.stats.convictions = 2; });
  assert.ok(/You never took a purse/.test(clean) && !/the purses/.test(clean), clean);
  var dirty = over(45, 'corruption', function (g) { g.s.counts.purse = 2; g.s.stats.convictions = 2; });
  assert.ok(/the purses/.test(dirty), dirty);
  // The King of Thunes, by name, when the run crowned one.
  var crowned = over(46, 'crusader', function (g) { g.s.meters.scrutiny = 0; var k = g.criminalFor('Jost Krumm', null); k.king = true; });
  assert.ok(/King of Thunes, Jost Krumm, hangs on the Ravenstone/.test(crowned), crowned);
  assert.ok(/King of Thunes hangs on the Ravenstone/.test(over(47, 'crusader', function (g) { g.s.meters.scrutiny = 0; })), 'no King crowned: unnamed');
  // The Architect, with what they were to the city.
  var arch = over(48, 'master', function (g) {
    var c = g.spawnCase('architect', { quiet: true }), rec = g.caseRec(c.caseId);
    rec.status = 'closed';
  });
  assert.ok(/sentenced on a grey Tuesday: [^,]+, (the respected doctor of laws|a retired judge of the Blood Court|the great benefactor), who always asked so kindly after your cases\./.test(arch), arch);
  assert.ok(/rub them out with your thumb\./.test(arch));
  assert.strictEqual(arch.indexOf('{'), -1, 'nothing left unfilled');
  assert.ok(/sentenced on a grey Tuesday\./.test(over(49, 'master')), 'no Architect on file: unnamed');
  // Counts in words: one to twelve, digits past a dozen.
  assert.strictEqual(CF.Story.words(7, true), 'Seven');
  assert.strictEqual(CF.Story.words(12), 'twelve');
  assert.strictEqual(CF.Story.words(15, true), '15');
  console.log('endings name what happened: ok');
})();

// ---- An answer's return, read before it is given (choicePreview) ---------------------------
// The answer is given on a copy: the live game does not move, hears nothing, and the copy's
// return is the one the real answer then gives (the same dice).
(function preview() {
  var p = game(61); p.s.week = 9; p.s.meters.retaliation = 4;
  p.offerChoice(spec('upright'));
  var heard = [];
  p.on(function (type) { heard.push(type); });
  var ret0 = p.s.meters.retaliation, coins0 = p.cardsOf('funds', true).length, n0 = p.s.journal.length, save0 = p.save();
  var pv = p.choicePreview(0);
  assert.ok(pv && pv.meters.retaliation === -3 && pv.cards.funds === 1, 'the upright man\'s answer: the Vendetta eases, a Coin: ' + JSON.stringify(pv));
  assert.deepStrictEqual(heard, [], 'the copy tells the live game nothing');
  assert.ok(p.s.choice && p.s.meters.retaliation === ret0 && p.cardsOf('funds', true).length === coins0 && p.s.journal.length === n0, 'and nothing moved');
  assert.strictEqual(p.save(), save0, 'not a byte of the save');
  assert.ok(p.choose(0));
  assert.strictEqual(p.s.meters.retaliation - ret0, pv.meters.retaliation, 'the real answer gives what the preview said');
  assert.strictEqual(p.cardsOf('funds', true).length - coins0, pv.cards.funds);
  assert.strictEqual(p.choicePreview(0), null, 'no question, no preview');
  // An answer paid with Wit: one Wit less, one spent Wit more.
  var q = game(62); q.s.week = 9;
  q.offerChoice(spec('swan'));
  var opt = spec('swan').options.map(function (o, i) { return o.cost === 'focus' ? i : -1; }).filter(function (i) { return i >= 0; })[0];
  if (opt !== undefined && q.canChoose(opt)) {
    var pw = q.choicePreview(opt);
    assert.ok(pw.cards.focus === -1 && pw.cards.spent_focus === 1, 'Wit spent, not lost: ' + JSON.stringify(pw.cards));
  }
  console.log('choice preview: ok');
})();

// ---- A thread on the Rival goes cold after three weeks -------------------------------------
(function rivalFade() {
  var g = game(63); g.s.week = 9;
  var r = g.create('rival', { label: 'The Rival: Piet Wieland', data: { name: 'Piet Wieland', heat: 0, stalled: 0 } });
  g.tableCards().filter(function (c) { return c.def === 'clue' || c.def === 'evidence' || c.def === 'witness'; }).forEach(function (c) { g.remove(c); });
  r.data.heat = 1; r.data.ways = { focus: true };
  g.rivalWeek();
  assert.strictEqual(r.data.heatWeek, 9, 'a thread found is dated at the next Bell, if the finding did not date it');
  g.s.week = 11; g.rivalWeek();
  assert.strictEqual(r.data.heat, 1, 'two weeks on, it holds');
  g.s.week = 12;
  var lines = g.rivalWeek();
  assert.ok(r.data.heat === 0 && !r.data.ways && r.data.heatWeek === undefined, 'three weeks on, it is gone');
  assert.ok(lines.indexOf('The thread on Piet Wieland has gone cold.') >= 0, 'the Bell says so: ' + lines);
  assert.ok(g.s.journal.some(function (j) { return j.title === CF.RIVAL_FADE.title && j.text.indexOf('Piet Wieland') === 0; }));
  // A finding dated when it was made is counted from then.
  r.data.heat = 1; r.data.heatWeek = 10; g.s.week = 13; g.rivalWeek();
  assert.strictEqual(r.data.heat, 0, 'found in week 10, cold by week 13');
  // The arrival says the rule: two different ways.
  var a = game(64); a.s.week = 8;
  while (!a.cardsOf('rival', true).length) a.rivalWeek();
  assert.ok(a.s.journal.some(function (j) { return j.title === 'The Harbourmaster\'s Examiner' && /two different ways/.test(j.text); }), 'the first examiner is told with the rule');
  console.log('the rival\'s thread fades: ok');
})();

// ---- The needs' second and third beats: each its own, and Stress owes nobody ----------------
(function needBeats() {
  function runOut(seed, need, take) {
    var g = game(seed);
    while (g.cardsOf(take, true).length > 1) g.remove(g.cardsOf(take, true)[0]);
    g.create(need, { lifetime: 2 }); g.tick(2.01);
    var first = g.s.journal.filter(function (j) { return /Deepens$/.test(j.title); })[0];
    var d0 = g.s.counts.debt || 0, p0 = g.s.meters.pressure;
    var again = g.cardsOf(need)[0]; again.life = 1; g.tick(1.01);
    var second = g.s.journal.filter(function (j) { return /Deepens$/.test(j.title); })[0];
    return { first: first.text, second: second.text, debt: (g.s.counts.debt || 0) - d0, crowd: g.s.meters.pressure - p0 };
  }
  var h = runOut(80, 'hunger', 'health');
  assert.ok(h.first.indexOf(CF.NEEDS.hunger.deepen) === 0 && !/took what it wanted/.test(h.first), 'Hunger deepens without contradicting itself: ' + h.first);
  assert.ok(/only one Health to your name, Hunger cannot take it/.test(h.first), h.first);
  assert.strictEqual(h.second, CF.NEEDS.hunger.debt); assert.strictEqual(h.debt, 1, 'the cookshop is owed');
  var k = runOut(81, 'sickness', 'instinct');
  assert.strictEqual(k.second, CF.NEEDS.sickness.debt); assert.ok(/barber-surgeon/.test(k.second) && !/cookshop/.test(k.second));
  var t = runOut(82, 'stress', 'focus');
  assert.ok(/sergeant/.test(t.first) && /sergeant/.test(t.second) && !/cookshop|barber/.test(t.first + t.second), 'Stress talks of the sergeant: ' + t.second);
  assert.strictEqual(t.debt, 0, 'Stress owes nobody');
  assert.strictEqual(t.crowd, 1, 'but the Watch-house talks');
  assert.ok(!/heat behind the eyes/.test(CF.NEEDS.sickness.arrive), 'Sickness is a cough, not a fever');
  console.log('need beats: ok');
})();

// ---- The Harbourmaster's Books: no examiner while it is open, none after his fall ------------
(function harbourmaster() {
  var g = game(83); g.s.week = 8;
  var rec = g.openCases()[0];
  rec.template = CF.HARBOURMASTER.template; rec.special = true;
  for (var i = 0; i < 40; i++) g.rivalWeek();
  assert.strictEqual(g.cardsOf('rival', true).length, 0, 'no examiner while the books are open');
  // The case goes cold: the next one has friends behind him, said once for that case.
  g.goCold(rec.id); g.s.meters.pressure = 0;
  var lines = [];
  for (var j = 0; j < 40 && !g.cardsOf('rival', true).length; j++) lines = g.rivalWeek();
  var r = g.cardsOf('rival', true)[0];
  assert.ok(r, 'a case gone cold lets him send another');
  assert.deepStrictEqual(lines, [CF.HARBOURMASTER.line]);
  var told = g.s.journal.filter(function (x) { return x.title === CF.HARBOURMASTER.friends.title; });
  assert.ok(told.length === 1 && told[0].text.indexOf(r.data.name) > 0, 'He Has Friends, with the name');
  assert.strictEqual(g.s.flags.harbourFriends, rec.id);
  g.remove(r); g.s.flags.rivalGone = 0;
  for (var k = 0; k < 40 && !g.cardsOf('rival', true).length; k++) lines = g.rivalWeek();
  assert.deepStrictEqual(lines, ['The Harbourmaster has sent another examiner.'], 'the next one is plain again');
  // His clerk convicted leaves him at his desk; the Harbourmaster himself convicted ends it.
  var books = { id: 'hb', template: CF.HARBOURMASTER.template, title: CF.HARBOURMASTER.title, status: 'closed',
    suspects: [{ name: 'Gerolt Hase', role: 'the Harbourmaster\'s clerk', guilty: true }, { name: 'Diederik Kolbe', role: 'the Harbourmaster' }] };
  assert.strictEqual(g.harbourmasterFalls(books, { name: 'Gerolt Hase', guilty: true }), false, 'the clerk is not the man');
  books.suspects[0].guilty = false; books.suspects[1].guilty = true;
  assert.strictEqual(g.harbourmasterFalls(books, { name: 'Gerolt Hase', guilty: false }), false, 'the wrong neck is not his fall');
  var rep = g.s.meters.reputation, council = g.favour().council;
  assert.strictEqual(g.harbourmasterFalls(books, { name: 'Diederik Kolbe', guilty: true }), true);
  assert.ok(g.s.flags.harbourmasterFallen && !g.cardsOf('rival', true).length, 'fallen, and his examiner with him');
  assert.strictEqual(g.s.meters.reputation, Math.min(g.meterMax('reputation'), rep + 3), 'Standing +3');
  assert.strictEqual(g.favour().council, council - 2, 'the Council liked him better than it says');
  assert.ok(g.s.journal[0].title === CF.HARBOURMASTER.falls.title);
  assert.strictEqual(g.harbourmasterFalls(books, { name: 'Diederik Kolbe', guilty: true }), false, 'once');
  g.s.flags.rivalGone = 0;
  for (var m = 0; m < 60; m++) g.rivalWeek();
  assert.strictEqual(g.cardsOf('rival', true).length, 0, 'nobody is left who wants to send one');
  console.log('the harbourmaster\'s books: ok');
})();

// ---- The Abbey takes a new examiner in, once; the end paper says what would have saved you ----
(function abbey() {
  function strained(g) { g.create('burnout'); g.create('fatigue'); g.create('fatigue'); g.create('fatigue'); g.checkThresholds(); }
  var g = game(84);
  g.s.meters.reputation = 2; g.s.flags.bellSilent = false; g.s.weekT = 10;
  var coins0 = g.cardsOf('funds', true).length, week0 = g.s.week;
  assert.ok(coins0 > 0, 'a Coin to pay the infirmarian');
  strained(g);
  assert.ok(!g.s.over, 'the first collapse, new to the desk: not the end');
  assert.ok(g.s.flags.abbey && !g.countOf('burnout') && !g.countOf('fatigue'), 'the strain is gone');
  assert.strictEqual(g.s.meters.reputation, 1, 'a Standing for the empty desk');
  assert.strictEqual(g.cardsOf('funds', true).length, coins0 - 1, 'and a Coin for the bed');
  assert.strictEqual(g.s.journal[0].title, CF.ABBEY.title);
  assert.ok(/Not twice\.$/.test(g.s.journal[0].text), 'it says it is once');
  g.tick(0.01);
  assert.strictEqual(g.s.week, week0 + 1, 'a week passes: the Bell rings');
  strained(g);
  assert.ok(g.s.over && g.s.over.id === 'collapse', 'the second time it is the end');
  // No Coin: the bed is owed. A Fever run out goes the same way, while the Bell is silent.
  var o = game(85);
  o.cardsOf('funds', true).forEach(function (c) { o.remove(c); });
  o.s.flags.bellSilent = true; o.s.weekT = 5;
  var debt0 = o.s.counts.debt || 0, wk = o.s.week;
  o.create('burnout', { lifetime: 1 }); o.tick(1.01);
  assert.ok(!o.s.over && o.s.flags.abbey, 'the Fever run out, taken in');
  assert.strictEqual(o.s.counts.debt, debt0 + 1, 'the bed is owed');
  assert.strictEqual(o.s.journal.filter(function (j) { return j.title === CF.ABBEY.title; })[0].text, CF.ABBEY.owed);
  assert.ok(o.s.week === wk && o.s.weekT < CF.WEEK, 'a silent Bell does not ring for it');
  // Not after the first four weeks, not with an office, and never for another ending.
  var late = game(86); late.s.week = 5; strained(late);
  assert.ok(late.s.over && late.s.over.id === 'collapse', 'week five: the end');
  var ranked = game(87); ranked.s.rank = 1; strained(ranked);
  assert.ok(ranked.s.over && ranked.s.over.id === 'collapse', 'an officer: the end');
  var dis = game(88); dis.gameOver('dismissed');
  assert.ok(dis.s.over && dis.s.over.id === 'dismissed' && !dis.s.flags.abbey, 'the Crowd is not the Abbey\'s to stop');
  // A save from before the Abbey loads and is taken in once.
  var old = JSON.parse(game(89).save()); delete old.flags.abbey;
  var ld = CF.Engine.load(JSON.stringify(old));
  strained(ld);
  assert.ok(!ld.s.over && ld.s.flags.abbey, 'an old save gets its one reprieve');
  // The lessons.
  ['burnout', 'collapse', 'consumed', 'dismissed', 'corruption', 'death'].forEach(function (id) {
    var l = CF.Story.lesson(ld, id);
    assert.ok(l && l.icon && l.text && !CF.ENDINGS[id].win, id + ' has a lesson');
  });
  assert.strictEqual(CF.Story.lesson(ld, 'master'), null, 'a won run needs none');
  assert.ok(/Rest/.test(CF.Story.lesson(ld, 'burnout').text));
  ld.s.over = { id: 'burnout', cause: { fever: 90, restIdle: true } };
  assert.strictEqual(CF.Story.lesson(ld, 'burnout').text.indexOf(CF.ENDING_REST_IDLE), 0, 'Rest stood empty: said first');
  console.log('the abbey and the lessons: ok');
})();

// ---- The Council Elects -------------------------------------------------------------
// The week before, the seat is a question; the week of it, the count is told, and each answer
// gives what it said. Unanswered, the count goes as it always did.
(function election() {
  function voter(seed, council, answer, lose) {
    var e = game(seed);
    e.favour().council = council;
    e.create('funds');
    assert.ok(e.offerElection(), 'the question is put');
    assert.strictEqual(e.s.choice.id, 'election');
    if (answer !== null) assert.ok(e.choose(answer), 'answered ' + answer);
    else e.s.choice = null;
    var rng = e.rng; e.rng = function () { return lose ? 0.01 : 0.99; };
    var lines = e.councilCount(); e.rng = rng;
    return { e: e, lines: lines };
  }
  var el = spec('election');
  assert.ok(!el.when(game(1)), 'never put by the clock');
  var r = voter(120, 3, 0, false);
  assert.strictEqual(r.e.favour().council, 5, 'stood with him, and he holds: +2');
  assert.deepStrictEqual(r.lines, [CF.ELECTION.holds]);
  r = voter(121, 3, 0, true);
  assert.strictEqual(r.e.favour().council, 0); assert.strictEqual(r.e.s.meters.scrutiny, 3, 'stood with him, and he loses: his favour as Suspicion');
  assert.deepStrictEqual(r.lines, [CF.ELECTION.loses]);
  r = voter(122, 3, 1, true);
  assert.strictEqual(r.e.favour().council, 1); assert.strictEqual(r.e.s.meters.scrutiny, 0, 'kept your distance: favour halved, no Suspicion');
  r = voter(123, 3, 2, false);
  assert.strictEqual(r.e.favour().council, 1); assert.strictEqual(r.e.favour().bishop, -1, 'dined with the other side: favour 1, the Bishop cools');
  assert.strictEqual(r.e.s.meters.scrutiny, 0);
  assert.ok(r.e.s.journal.some(function (j) { return j.title === CF.ELECTION.title; }), 'the count is told');
  // Unanswered: as before, lost and read aloud; held, and nothing said.
  r = voter(124, 2, null, true);
  assert.strictEqual(r.e.s.meters.scrutiny, 2); assert.strictEqual(r.e.favour().council, 0);
  assert.ok(/goes against your patron/.test(r.lines[0]));
  r = voter(125, 2, null, false);
  assert.deepStrictEqual(r.lines, []); assert.strictEqual(r.e.favour().council, 2);
  // Not put with no patron, or over another question.
  var e = game(126); e.favour().council = 0;
  assert.ok(!e.offerElection());
  e.favour().council = 2; e.offerChoice(spec('beggar'));
  assert.ok(!e.offerElection() && e.s.choice.id === 'beggar', 'another question is open');
  // A save with the question open loads and is answered; an old save without the flag counts as before.
  var sv = game(127); sv.favour().council = 2; sv.offerElection();
  var ld = CF.Engine.load(sv.save());
  assert.ok(ld.s.choice && ld.s.choice.id === 'election' && ld.choose(1) && ld.s.flags.election === 'distance', 'answered after a load');
  var old = JSON.parse(game(128).save()); delete old.flags.election; old.favour = { council: 1, bishop: 0, guild: 0 };
  var ol = CF.Engine.load(JSON.stringify(old)), orng = ol.rng; ol.rng = function () { return 0.01; };
  assert.ok(/goes against your patron/.test(ol.councilCount()[0]), 'an old save counts as it always did'); ol.rng = orng;
  console.log('the council elects: ok');
})();

// ---- Gone: how a card leaves -------------------------------------------------------------
// An ability taken for good and a Coin paid say so before they go, for the table to show.
(function gone() {
  var e = game(130), seen = [];
  e.on(function (type, p) { if (type === 'gone') seen.push(p.why + ':' + p.uid); });
  e.create('funds');
  e.spend(1);
  assert.ok(seen.some(function (x) { return /^spent:/.test(x); }), 'a Coin paid is spent');
  e.create('health'); e.create('health');
  var hunger = e.create('hunger', { lifetime: 1 });
  seen.length = 0;
  e.needExpired(hunger);
  assert.ok(seen.length === 1 && /^lost:/.test(seen[0]), 'a Health taken for good is lost: ' + seen.join(','));
  e.create('funds');
  e.offerChoice(spec('beggar'));
  seen.length = 0;
  assert.ok(e.choose(0));
  assert.ok(seen.length === 1 && /^spent:/.test(seen[0]), 'the beggar\'s Coin is spent');
  console.log('gone: ok');
})();

// ---- The late questions --------------------------------------------------------------------
// Each is put only when its system is on the table, and every answer gives what its gain says.
(function late() {
  function ready(seed) {
    var e = game(seed);
    e.s.flags.firstCase = true; if (e.s.intro) e.s.intro.finished = true;
    for (var i = 0; i < 3; i++) { e.create('funds'); e.create('focus'); e.create('health'); }
    return e;
  }
  // Answer option i on a copy of e, and return the copy.
  function answer(e, id, i) {
    var t = CF.Engine.load(e.save());
    t.offerChoice(spec(id));
    assert.ok(t.canChoose(i), id + ': answer ' + i + ' can be paid');
    assert.ok(t.choose(i), id + ': answer ' + i);
    return t;
  }
  var late = ['harbourtable', 'wrongmother', 'kingswine', 'inquisitorlist', 'hangmansdaughter', 'executioner', 'heir', 'kingletter', 'portrait', 'thirdmother', 'ravenstone', 'guildhall', 'pulpit', 'hilldinner'];
  late.forEach(function (id) {
    var c = spec(id);
    assert.ok(c && !c.after, id + ' is on the clock');
    assert.ok(!c.when(ready(140)), id + ' is not put at the start');
    c.options.forEach(function (o) { assert.ok(o.gain, id + ': ' + o.label + ' says what it gives'); });
  });

  // The Rival at the Harbourmaster's table: a thread, a lost week, or Standing.
  var e = ready(141);
  e.create('rival', { label: 'The Rival: Lucia Brenner', data: { name: 'Lucia Brenner', heat: 0, stalled: 0 } });
  assert.ok(e.choiceOpenFor(spec('harbourtable')));
  var t = answer(e, 'harbourtable', 0);
  assert.strictEqual(t.cardsOf('rival', true)[0].data.heat, 1, 'a thread on the Rival');
  e.cardsOf('rival', true)[0].data.heat = 1;
  t = answer(e, 'harbourtable', 0);
  assert.strictEqual(t.cardsOf('rival', true).length, 0, 'the second thread exposes them');
  assert.ok(t.s.flags.rivalGone > t.s.week);
  t = answer(e, 'harbourtable', 1);
  assert.ok(t.cardsOf('rival', true)[0].data.stalled > t.s.week - 1 && !t.choiceOpenFor(spec('harbourtable')), 'the Rival loses a week');

  // A wrong name surfaced: its mother at the door, the case named.
  e = ready(142);
  e.s.criminals.x1 = { id: 'x1', name: 'Hans Vos', wrongfulTitle: 'The Eel at the Crane', traits: [], history: [] };
  assert.ok(e.choiceOpenFor(spec('wrongmother')));
  e.offerChoice(spec('wrongmother'));
  assert.ok(e.s.choice.text.indexOf('The Eel at the Crane') >= 0, 'the case is named');
  e.s.choice = null;
  var m0 = (e.s.counts || {}).mercy || 0;
  t = answer(e, 'wrongmother', 0);
  assert.strictEqual(t.s.counts.mercy, m0 + 1);
  e.s.criminals.x1.hidden = true;
  assert.ok(!e.choiceOpenFor(spec('wrongmother')), 'not while the ballad has not been sung');

  // The Treaty's wine: a token that names a name in an open case.
  e = ready(143);
  var card = e.spawnCase('burglary', {});
  e.s.court = { stance: 'treaty', king: null, inside: false };
  assert.ok(e.choiceOpenFor(spec('kingswine')));
  var clues = e.cardsOf('clue', true).length;
  t = answer(e, 'kingswine', 0);
  assert.strictEqual(t.cardsOf('clue', true).length, clues + 1, 'the King\'s name');
  assert.ok(t.cardsOf('clue', true).some(function (c) { return c.data && c.data.points; }), 'it names a name');

  // The Inquisitor's list: an Unanswered case goes into the Fire.
  e = ready(144);
  e.s.flags.inquisitor = true;
  assert.ok(!e.choiceOpenFor(spec('inquisitorlist')), 'nothing unanswered, nothing asked');
  e.create('coldcase');
  assert.ok(e.choiceOpenFor(spec('inquisitorlist')));
  t = answer(e, 'inquisitorlist', 0);
  assert.strictEqual(t.countOf('coldcase'), 0); assert.strictEqual(t.favour().bishop, 2);

  // The Seat is empty: the canvass, and the Crowd and Suspicion the vote reads.
  e = ready(145);
  e.create('chair');
  ['guildhall', 'pulpit', 'hilldinner'].forEach(function (id) { assert.ok(e.choiceOpenFor(spec(id)), id + ' while the Seat is empty'); });
  t = answer(e, 'guildhall', 0);
  assert.strictEqual(t.favour().guild, 2); assert.strictEqual(t.s.meters.pressure, e.s.meters.pressure + 1, 'the Market promised, the Crowd stirs');
  t = answer(e, 'hilldinner', 0);
  assert.strictEqual(t.favour().council, e.favour().council + 2); assert.strictEqual(t.s.meters.scrutiny, e.s.meters.scrutiny + 1);

  // The King's letter: a front named, or the Treaty without a Disguise.
  e = ready(146);
  e.s.rank = 2;
  e.spawnSyndicate('The Coquille.');
  assert.ok(e.choiceOpenFor(spec('kingletter')));
  t = answer(e, 'kingletter', 1);
  assert.strictEqual(t.cardsOf('front', true).length, 1, 'a front of the Coquille named');
  t = answer(e, 'kingletter', 2);
  assert.strictEqual(t.court().stance, 'treaty', 'the Treaty');

  // The Ravenstone: a pardon from the stone sends the condemned home.
  e = ready(147);
  e.s.meters.dread = 5;
  var rec = e.caseRec(e.spawnCase('burglary', {}).caseId);
  var g = rec.suspects.filter(function (x) { return x.guilty; })[0];
  e.condemn(rec, { name: g.name, trait: g.trait, guilty: true, role: g.role }, null);
  assert.ok(e.cardsOf('condemned').length === 1 && e.choiceOpenFor(spec('ravenstone')));
  t = answer(e, 'ravenstone', 2);
  assert.strictEqual(t.cardsOf('condemned').length, 0, 'pardoned before the crowd');
  assert.ok(t.s.counts.mercy >= 2);

  // The Pattern's third door: a witness on that case.
  e = ready(148);
  var pc = e.caseRec(e.spawnCase('pattern', {}).caseId);
  pc.victims = 3;
  assert.ok(e.choiceOpenFor(spec('thirdmother')));
  t = answer(e, 'thirdmother', 0);
  assert.ok(t.cardsOf('witness', true).some(function (w) { return w.caseId === pc.id; }), 'a witness on the Pattern');

  // Late in rank and Standing: the heir, the portrait, the executioner.
  e = ready(149);
  e.s.rank = 3; e.s.week = 16; e.s.meters.reputation = 12; e.s.counts = { cruelty: 4, mercy: 0, purse: 0, debt: 0 };
  e.spawnCase('burglary', {});
  ['heir', 'portrait', 'executioner', 'hangmansdaughter'].forEach(function (id) { assert.ok(e.choiceOpenFor(spec(id)), id); });
  t = answer(e, 'executioner', 0);
  assert.ok(t.cardsOf('clue', true).some(function (c) { return CF.aspectsOf(c).forensic >= 2; }), 'a Body token');
  // Asked once: these have no second wording.
  e.offerChoice(spec('heir')); e.choose(2);
  assert.ok(!e.choiceOpenFor(spec('heir')), 'asked once');
  // The after-verb questions come back, ten weeks on, in other words.
  ['lamplighter', 'pawnbroker', 'confessor', 'tapster'].forEach(function (id) { assert.ok(spec(id).again, id + ' has a second wording'); });
  console.log('the late questions: ok');
})();

// ---- The Year: seasons, the Assize, the Long Service ----------------------------------------
(function year() {
  var S = CF.Story;
  // A quarter of fifty-two weeks to a season, the Bell's line on each season's first week.
  [[1, 'lent'], [13, 'lent'], [14, 'fair'], [26, 'fair'], [27, 'plague'], [39, 'plague'], [40, 'winter'], [52, 'winter'], [53, 'lent']].forEach(function (p) {
    assert.strictEqual(S.season(p[0]).id, p[1], 'week ' + p[0]);
  });
  assert.strictEqual(S.season(53).year, 2);
  var bells = [];
  for (var w = 1; w <= 60; w++) if (S.seasonBell(w)) bells.push(w);
  assert.deepStrictEqual(bells, [1, 14, 27, 40, 53]);
  assert.strictEqual(S.seasonBell(27), 'Week 27. The Plague Summer: the Abbey cart goes round twice a day.');

  function ready(seed) { var e = game(seed); if (e.s.intro) e.s.intro.finished = true; e.s.choice = null; return e; }
  // The Assize: put once a year, from week 26, never over another question, never by the clock.
  var as = spec('assize');
  assert.ok(!as.when(game(1)), 'never put by the clock');
  var e = ready(150);
  e.s.week = 25; assert.ok(!e.offerAssize(), 'not before week 26');
  e.s.week = 26; e.offerChoice(spec('beggar'));
  assert.ok(!e.offerAssize() && e.s.choice.id === 'beggar', 'another question is open');
  e.s.choice = null; e.s.week = 27;
  e.s.stats.cases = 9; e.s.stats.convictions = 5; e.s.stats.wrongful = 1;
  var lines = e.yearWeek();
  assert.deepStrictEqual(lines, [S.seasonBell(27)], 'the season first');
  assert.strictEqual(e.s.choice.id, 'assize', 'asked at the next Bell');
  assert.ok(/9 cases/.test(e.s.choice.text) && /5 ended in a conviction/.test(e.s.choice.text) && /wrong one/.test(e.s.choice.text), 'the year read from the stats');
  e.choose(2);
  assert.ok(!e.offerAssize(), 'once a year');
  e.s.week = 78; assert.ok(e.offerAssize(), 'and again the next year'); e.s.choice = null;
  e = ready(151); e.s.week = 40; assert.ok(!e.offerAssize(), 'not after its window');
  // Each answer gives what it says.
  function answered(i) { var g = ready(152); g.s.week = 26; g.offerAssize(); var pv = g.choicePreview(i); g.choose(i); return { g: g, pv: pv }; }
  var a = answered(0); assert.strictEqual(a.pv.cards.funds, 2, 'a pension: two Coin');
  a = answered(1); assert.strictEqual(a.pv.cards.personnel, 1, 'more men: a Letter of Service');
  a = answered(2); assert.strictEqual(a.pv.meters.reputation, 2, 'nothing: Standing +2');
  // The told year, by its shape.
  function told(st) { var g = ready(153); for (var k in st) g.s.stats[k] = st[k]; return S.assize(g); }
  assert.ok(/Not one has ended/.test(told({ cases: 1, convictions: 0 })) && /one case with your name on it/.test(told({ cases: 1 })));
  assert.ok(/applause/.test(told({ cases: 8, convictions: 5 })), 'a clean year is applauded');
  assert.ok(/benches are quiet/.test(told({ cases: 8, convictions: 1, cold: 4 })) && /4 gone cold/.test(told({ cases: 8, convictions: 1, cold: 4 })));
  assert.ok(/stair twice/.test(told({ cases: 8, convictions: 4, attacks: 2 })) && /sent 4 home/.test(told({ cases: 8, convictions: 4, sentHome: 4 })));
  // An old save with no year in its flags is asked at its next Bell in the window; a save with the Assize open is answered after a load.
  var old = JSON.parse(ready(154).save()); delete old.flags.assize; delete old.flags.pension; old.week = 30;
  var ol = CF.Engine.load(JSON.stringify(old)); ol.yearWeek();
  assert.ok(ol.s.choice && ol.s.choice.id === 'assize', 'an old save is asked');
  var ld = CF.Engine.load(ol.save());
  assert.ok(ld.s.choice.id === 'assize' && ld.choose(2) && ld.s.flags.assize === 1, 'answered after a load');

  // The Long Service: at the rank cap, told four weeks before, then the pension.
  e = ready(155); e.s.week = 48; e.s.flags.assize = 1;
  assert.deepStrictEqual(e.yearWeek(), [], 'below the cap: no pension');
  e.s.rank = CF.TOP_RANK;
  assert.deepStrictEqual(e.yearWeek(), [CF.LONG_SERVICE.warnText], 'told four weeks before');
  assert.strictEqual(e.s.flags.pension, 52);
  e.s.week = 51; assert.ok(!e.longServiceDue() && !e.s.over);
  e.s.week = 52; assert.ok(e.longServiceDue(), 'pensioned at week 52');
  assert.ok(e.s.over.id === 'longservice' && e.s.over.win && e.s.over.title === 'The Long Service');
  assert.ok(e.s.over.text.indexOf(CF.ENDINGS.longservice.text) === 0, 'the plain telling');
  // Reached late, still four weeks of warning; the hangman's cap is lower.
  e = ready(156); e.s.flags.assize = 1; e.s.rank = CF.TOP_RANK; e.s.week = 60; e.yearWeek();
  assert.strictEqual(e.s.flags.pension, 64);
  e = ready(157); e.s.flags.assize = 1; e.s.who = 'hangman'; e.s.rank = 2; e.s.week = 49; e.yearWeek();
  assert.strictEqual(e.s.flags.pension, 53, 'the hangman is at his cap');
  e.s.week = 53; e.s.stats.wrongful = 1; e.longServiceDue();
  assert.ok(/One name in your casebook/.test(e.s.over.text), 'a wrong name goes to the Close with you');

  // Every word of it in Arabic.
  fs.readdirSync(path.join(__dirname, '..', 'js/lang/ar')).forEach(function (f) { vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js/lang/ar', f), 'utf8'), { filename: f }); });
  CF.setLang('ar');
  var texts = [told({ cases: 1 }), told({ cases: 9, convictions: 5, wrongful: 3 }), told({ cases: 12, convictions: 2, cold: 5 }), told({ cases: 20, convictions: 9, sentHome: 4 }), told({ cases: 7, convictions: 4, attacks: 3 }), told({ cases: 7, convictions: 4, attacks: 2 }), CF.LONG_SERVICE.warnText, CF.LONG_SERVICE.title, CF.LONG_SERVICE.warnTitle, CF.ASSIZE.title];
  CF.SEASON_WORDS.forEach(function (sw) { texts.push(sw.name); });
  bells.forEach(function (bw) { texts.push(S.seasonBell(bw)); });
  CF.ENDING_VARIANTS.longservice.forEach(function (v) { texts.push(v.text); });
  as.options.forEach(function (o) { texts.push(o.label, o.gain, o.text); });
  texts.forEach(function (t) { assert.ok(!/[A-Za-z]{2}/.test(CF.T(t)), 'Arabic for: ' + t + ' => ' + CF.T(t)); });
  CF.setLang('en');
  console.log('the year: ok');
})();
