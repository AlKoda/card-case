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
rv.rivalWeek();
assert.strictEqual(rec.status, 'cold', 'two weeks on they close it');
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

// ---- The ending's own numbers ----------------------------------------------------------
var m = game(13);
m.s.stats.sentHome = 9;
for (var ci = 0; ci < 2; ci++) m.criminalFor('Citizen ' + ci, null).status = 'reformed';
m.gameOver('merciful');
assert.strictEqual(m.s.over.text.indexOf('9 times you sent a poor sinner home'), 0, 'the Merciful Judge counts the ones sent home: ' + m.s.over.text);
assert.ok(m.s.over.text.indexOf('and 2 of them are citizens now') > 0, 'and the reformed');
assert.ok(m.s.over.text.indexOf('{') < 0, 'nothing left unfilled');
CF.ENDING_VARIANTS.master.forEach(function (v) { assert.ok(/your own lintel, and you rub them out with your thumb\.$/.test(v.text), 'the Scholar ends at the lintel'); });
console.log('the ending\'s numbers: ok');

console.log('choices: all OK');
