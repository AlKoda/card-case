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

console.log('choices: all OK');
