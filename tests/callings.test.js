// Phase 18: callings as drift. Every ending is reachable from every start.
// Run: node tests/callings.test.js
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

function game(seed, calling) { return CF.Engine.newGame({ seed: seed, calling: calling }); }
function byDef(e, d) { return e.tableCards().filter(function (c) { return c.def === d; }); }
// The work has changed you: the city asks, and the answer takes the new road (1) or keeps the old (0).
function answerDrift(e, i) { return !!(e.s.choice && e.s.choice.id === 'drift') && e.choose(i); }
function callingCards(e) { return e.tableCards().filter(function (c) { return CF.CARDS[c.def].kind === 'calling'; }); }

// The chosen calling is a leaning with a head start.
var e = game(81, 'master');
assert.strictEqual(e.s.origin, 'master');
assert.deepStrictEqual(e.s.paths, { commissioner: 0, master: CF.Callings.SEED, crusader: 0 });
assert.strictEqual(callingCards(e)[0].def, 'calling_master');

// Play the Commissioner's game: the run drifts, and the card follows.
var flipped = false, journal0 = e.s.journal.length, asked = null;
for (var i = 0; i < 10 && !flipped; i++) {
  assert.strictEqual(e.pathGain('commissioner', 1, 'test'), false, 'the calling never turns by itself');
  if (e.s.choice && e.s.choice.id === 'drift') { asked = e.s.choice; flipped = answerDrift(e, 1) && e.s.calling === 'commissioner'; }
}
assert.ok(asked && asked.title === 'The Work Has Changed You' && asked.options.length === 2, 'the city asks first');
assert.ok(/^You meant to be the Scholar\. /.test(asked.text), asked.text);
assert.ok(flipped, 'the calling changed');
assert.strictEqual(e.s.calling, 'commissioner');
assert.strictEqual(e.s.origin, 'master', 'where you started is remembered');
assert.strictEqual(e.s.paths.commissioner, CF.Callings.SEED + CF.Callings.MARGIN, 'it takes a clear lead');
assert.strictEqual(callingCards(e).length, 1);
assert.strictEqual(callingCards(e)[0].def, 'calling_commissioner', 'the Calling card on the table changed');
assert.ok(e.s.journal.slice(0, e.s.journal.length - journal0).some(function (j) { return j.title === 'Your Calling Changes'; }));
// The Chair now convenes for a drifted Commissioner.
e.s.rank = CF.TOP_RANK; e.s.meters.reputation = CF.COMMISSIONER_REP;
e.checkThresholds();
assert.strictEqual(e.countOf('chair'), 1, 'the Commissioner ending is open');

// A Commissioner who breaks gangs becomes the Crusader, and the Syndicate's fall ends the game as one.
var c = game(82, 'commissioner');
assert.strictEqual(e.meterMax('scrutiny'), 10);
c.pathGain('crusader', 2, 'a gang'); c.pathGain('crusader', 2, 'a gang'); c.pathGain('crusader', 3, 'the syndicate');
assert.ok(answerDrift(c, 1));
assert.strictEqual(c.s.calling, 'crusader');
assert.strictEqual(c.meterMax('scrutiny'), 10, 'the starting bonus belongs to the origin, not the drift');
var k = byDef(c, 'case')[0], rec = c.caseRec(k.caseId);
rec.template = 'syndicate'; rec.special = true;
c.onConviction(rec, { guilty: true, solid: true }, []);
assert.ok(c.s.over && c.s.over.id === 'crusader', 'the Crusader ending');
assert.strictEqual(c.s.over.origin, 'commissioner');
assert.strictEqual(c.s.over.calling, 'crusader');

// A Crusader who reasons becomes the Master Detective, and may chase the Architect.
var m = game(83, 'crusader');
assert.strictEqual(m.meterMax('scrutiny'), 12, 'the Crusader keeps their starting bonus');
for (var j = 0; j < 3; j++) m.create('looseend');
m.autoSlot('reflect', byDef(m, 'looseend')[0].uid);
assert.ok(/not yours/.test(m.preview('reflect').blocked || ''), 'not yet');
m.clearSlots('reflect');
m.pathGain('master', 2, 'a connection'); m.pathGain('master', 2, 'a connection'); m.pathGain('master', 2, 'a connection'); m.pathGain('master', 1, 'an identification');
assert.ok(answerDrift(m, 1));
assert.strictEqual(m.s.calling, 'master');
assert.strictEqual(m.meterMax('scrutiny'), 12, 'still the origin\'s bonus');
byDef(m, 'looseend').forEach(function (le) { m.autoSlot('reflect', le.uid); });
assert.ok(!m.preview('reflect').blocked, 'the Architect is open to a drifted Master Detective: ' + m.preview('reflect').blocked);
m.clearSlots('reflect');

// Play feeds the paths.
var g = game(84, 'master');
g.s.meters.reputation = CF.RANK_REP[1]; g.s.stats.convictions = CF.RANK_RECORD[1]; g.checkThresholds();
var board = byDef(g, 'promotion')[0];
g.autoSlot('duty', board.uid); g.start('duty'); g.tick(46);
assert.strictEqual(g.s.paths.commissioner, 0, 'a promotion is not Power for a Master Detective');
assert.strictEqual(g.s.paths.master, CF.Callings.SEED + 1, 'it feeds the path the calling walks');
g.s.rooms.locker = false;
g.addOrdersForRank(0);
var order = byDef(g, 'order').filter(function (o) { return o.data.order === 'locker'; })[0];
g.autoSlot('duty', order.uid); byDef(g, 'funds').slice(0, 4).forEach(function (f) { g.autoSlot('duty', f.uid); });
for (var f = byDef(g, 'funds').length; f < 4; f++) g.autoSlot('duty', g.create('funds').uid);
if (!g.preview('duty').blocked) { g.start('duty'); g.tick(11); assert.strictEqual(g.s.paths.commissioner, 1, 'a room is Power'); }
g.s.rank = 1; g.s.meters.pressure = 0; g.s.meters.scrutiny = 0;
var pw = g.s.paths.commissioner;
g.tick(CF.WEEK); g.tick(CF.WEEK);
assert.strictEqual(g.s.paths.commissioner, pw, 'calm weeks are not Power for one who does not want it');
var b = game(87, 'commissioner');
b.s.rank = 1; b.s.meters.pressure = 0; b.s.meters.scrutiny = 0;
var bw = b.s.paths.commissioner;
b.tick(CF.WEEK); b.tick(CF.WEEK);
assert.strictEqual(b.s.paths.commissioner, bw + 1, 'two calm weeks under a senior officer are the Burgomaster\'s Power');
// A Crusader promoted: Justice, not Power.
var cr = game(88, 'crusader');
cr.promote();
assert.strictEqual(cr.s.paths.crusader, CF.Callings.SEED + 1, 'the office serves what you want');
assert.strictEqual(cr.s.paths.commissioner, 0);
// Justice in the everyday loop: a culprit who walked before, and a violent one.
var justice = null;
for (var jx = 0; jx < 10 && !justice; jx++) {
  var jg = game(89, 'crusader'), jk = byDef(jg, 'case')[0], jr = jg.caseRec(jk.caseId);
  var jc = jr.suspects.filter(function (x) { return x.guilty; })[0];
  var rec0 = jg.criminalEscapes(jr, jc, 'acquitted');
  rec0.traits = ['violent'];
  var j0 = jg.s.paths.crusader;
  jr.status = 'trial';
  var jt = jg.create('trial', { data: { caseId: jr.id, name: jc.name, guilty: true, solid: true, tier: 'strong', real: 9, need: 5, coerced: 0, planted: 0, illegal: 0, contradictions: 0 } });
  jg.rng.setState(11 * (jx + 1));
  jg.verdict(jt);
  if (jr.status === 'closed') justice = jg.s.paths.crusader - j0;
}
assert.strictEqual(justice, 2, 'a culprit with a record, and a violent one: Justice +2');
// A purse left to lie: Justice, once a month at most.
var pg = game(90, 'crusader'), p0 = pg.s.paths.crusader;
pg.expire(pg.create('bribe')); pg.expire(pg.create('bribe'));
assert.strictEqual(pg.s.paths.crusader, p0 + 1, 'a purse left to lie is Justice, once');
assert.ok(pg.s.journal.some(function (j) { return j.title === 'The Purse Is Gone' && /Justice \+1\./.test(j.text); }), 'and the story says so');
pg.s.week += 4; pg.expire(pg.create('bribe'));
assert.strictEqual(pg.s.paths.crusader, p0 + 2, 'and again a month on');

// A Crusader nudged toward the Chair by promotions still ends as the Crusader when the Syndicate falls.
var n = game(85, 'crusader');
n.pathGain('commissioner', 4, 'promotions'); n.pathGain('commissioner', 3, 'calm');
assert.ok(answerDrift(n, 1));
assert.strictEqual(n.s.calling, 'commissioner', 'drifted');
assert.ok(n.pathOpen('crusader'), 'Justice is not clearly behind');
var nk = byDef(n, 'case')[0], nr = n.caseRec(nk.caseId);
nr.template = 'syndicate'; nr.special = true;
n.onConviction(nr, { guilty: true, solid: true }, []);
assert.ok(n.s.over && n.s.over.id === 'crusader', 'the Syndicate\'s fall is still the Crusader\'s ending');
var far = game(86, 'master');
far.pathGain('commissioner', 12, 'a career');
assert.ok(answerDrift(far, 1));
assert.ok(!far.pathOpen('crusader'), 'but not for someone who never walked that path');

// Saves keep the drift; the bot's summary of the three paths reads.
var s2 = CF.Engine.load(c.save());
assert.strictEqual(s2.s.calling, 'crusader');
assert.strictEqual(s2.s.origin, 'commissioner');
assert.ok(/Power \d+ · Knowledge \d+ · Justice \d+/.test(CF.Callings.summary(s2)));
console.log('callings: drift, card, endings from any start, origin bonus kept, play feeds paths, save OK');

// ---- The turn of a calling says what was done, not the score ----------------
(function deeds() {
  var d = game(91, 'master');
  d.pathGain('commissioner', 1, 'a calm fortnight');
  d.pathGain('commissioner', 1, 'a calm fortnight');
  d.pathGain('commissioner', 1, 'built the Belfry');
  d.pathGain('commissioner', 1, 'promoted');
  d.pathGain('commissioner', 3, 'reopened a cold case');
  assert.ok(/: a cold case opened again; a letter of office; masons in the Belfry\. Keep to your road/.test(d.s.choice.text), 'the question names the deeds: ' + d.s.choice.text);
  assert.ok(answerDrift(d, 1));
  assert.strictEqual(d.s.calling, 'commissioner', 'the calling turned');
  var j = d.s.journal.filter(function (x) { return x.title === 'Your Calling Changes'; })[0];
  assert.ok(j, 'told');
  assert.ok(!/\d/.test(j.text), 'no numbers in the telling: ' + j.text);
  assert.ok(/^You meant to be the Scholar\. /.test(j.text) && /you are the Burgomaster now/.test(j.text), 'the article in lower case mid-sentence: ' + j.text);
  assert.ok(/: a cold case opened again; a letter of office; masons in the Belfry\./.test(j.text), 'the last three deeds, newest first: ' + j.text);
  var card = callingCards(d)[0];
  assert.ok(/\(You set out as the Scholar; the work has changed you\.\)$/.test(d.descOf(card)), d.descOf(card));
  // A repeated deed reads as many; with no deed recorded, the line still reads.
  assert.strictEqual(CF.Callings.deed('a calm fortnight', true), 'calm fortnight after calm fortnight');
  var q = game(92, 'crusader');
  q.s.paths.master = 20; q.checkDrift();
  assert.ok(answerDrift(q, 1));
  var qj = q.s.journal.filter(function (x) { return x.title === 'Your Calling Changes'; })[0];
  assert.ok(qj && /The work had other ideas\./.test(qj.text), qj && qj.text);
  console.log('calling deeds: ok');
})();

// ---- Each calling names the ending it is for -------------------------------------
(function callingWins() {
  var ends = { commissioner: /Council's Seat/, master: /Architect sentenced/, crusader: /Coquille broken/ };
  Object.keys(ends).forEach(function (k) {
    var w = CF.CALLINGS[k].win;
    assert.ok(/^Your ending: /.test(w) && ends[k].test(w), k + ': ' + w);
  });
  console.log('calling wins: ok');
})();

// ---- The work has changed you: a question with a visible return, never a silent turn ----
(function keepRoad() {
  var k = game(93, 'crusader');
  for (var i = 0; i < 8 && !k.s.choice; i++) k.pathGain('commissioner', 1, 'a calm fortnight');
  assert.ok(k.s.choice && k.s.choice.id === 'drift', 'asked');
  assert.strictEqual(k.s.calling, 'crusader', 'not turned while asked');
  // The question survives a save.
  var kl = CF.Engine.load(k.save());
  assert.ok(kl.s.choice && kl.s.choice.id === 'drift' && kl.s.choice.options.length === 2, 'kept in the save');
  var rep = kl.s.meters.reputation;
  assert.ok(kl.choose(0), 'keep to your road');
  assert.strictEqual(kl.s.calling, 'crusader', 'the calling holds');
  assert.strictEqual(kl.s.meters.reputation, rep + 1, 'Standing +1');
  assert.ok(kl.s.paths.commissioner <= kl.s.paths.crusader, 'the other road falls back level');
  assert.ok(!kl.s.journal.some(function (j) { return j.title === 'Your Calling Changes'; }), 'no turn told');
  assert.ok(kl.s.journal.some(function (j) { return j.title === 'The Work Has Changed You: Keep to your road'; }), 'the answer is told');
  // Asked again only after as much again of the other work.
  kl.pathGain('commissioner', 1, 'a calm fortnight');
  assert.ok(!kl.s.choice, 'not at the next deed');
  console.log('keep to your road: ok');
})();
