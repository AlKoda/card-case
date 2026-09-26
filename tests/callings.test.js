// Phase 18: callings as drift. Every ending is reachable from every start.
// Run: node tests/callings.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

['js/util.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/data/structures.js', 'js/data/story.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/systems/informants.js', 'js/systems/criminals.js', 'js/systems/sentence.js', 'js/systems/purse.js', 'js/systems/origins.js', 'js/systems/coquille.js', 'js/systems/patrons.js', 'js/systems/network.js', 'js/systems/callings.js', 'js/systems/intro.js', 'js/core/recipes.js', 'js/data/recipes.js'].forEach(function (f) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), { filename: f });
});
var CF = globalThis.CF;
console.error = function (err) { throw err; };

function game(seed, calling) { return CF.Engine.newGame({ seed: seed, calling: calling }); }
function byDef(e, d) { return e.tableCards().filter(function (c) { return c.def === d; }); }
function callingCards(e) { return e.tableCards().filter(function (c) { return CF.CARDS[c.def].kind === 'calling'; }); }

// The chosen calling is a leaning with a head start.
var e = game(81, 'master');
assert.strictEqual(e.s.origin, 'master');
assert.deepStrictEqual(e.s.paths, { commissioner: 0, master: CF.Callings.SEED, crusader: 0 });
assert.strictEqual(callingCards(e)[0].def, 'calling_master');

// Play the Commissioner's game: the run drifts, and the card follows.
var flipped = false, journal0 = e.s.journal.length;
for (var i = 0; i < 10 && !flipped; i++) flipped = e.pathGain('commissioner', 1, 'test');
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
assert.strictEqual(m.s.calling, 'master');
assert.strictEqual(m.meterMax('scrutiny'), 12, 'still the origin\'s bonus');
byDef(m, 'looseend').forEach(function (le) { m.autoSlot('reflect', le.uid); });
assert.ok(!m.preview('reflect').blocked, 'the Architect is open to a drifted Master Detective: ' + m.preview('reflect').blocked);
m.clearSlots('reflect');

// Play feeds the paths.
var g = game(84, 'master');
g.s.meters.reputation = CF.RANK_REP[1]; g.checkThresholds();
var board = byDef(g, 'promotion')[0];
g.autoSlot('duty', board.uid); g.start('duty'); g.tick(31);
assert.strictEqual(g.s.paths.commissioner, 1, 'a promotion is Power');
g.s.rooms.locker = false;
var order = byDef(g, 'order').filter(function (o) { return o.data.order === 'locker'; })[0];
g.autoSlot('requisition', order.uid); byDef(g, 'funds').slice(0, 4).forEach(function (f) { g.autoSlot('requisition', f.uid); });
for (var f = byDef(g, 'funds').length; f < 4; f++) g.autoSlot('requisition', g.create('funds').uid);
if (!g.preview('requisition').blocked) { g.start('requisition'); g.tick(11); assert.strictEqual(g.s.paths.commissioner, 2, 'a room is Power'); }
g.s.rank = 1; g.s.meters.pressure = 0; g.s.meters.scrutiny = 0;
var pw = g.s.paths.commissioner;
g.tick(CF.WEEK); g.tick(CF.WEEK);
assert.strictEqual(g.s.paths.commissioner, pw + 1, 'two calm weeks under a senior officer are Power');

// A Crusader nudged toward the Chair by promotions still ends as the Crusader when the Syndicate falls.
var n = game(85, 'crusader');
n.pathGain('commissioner', 4, 'promotions'); n.pathGain('commissioner', 3, 'calm');
assert.strictEqual(n.s.calling, 'commissioner', 'drifted');
assert.ok(n.pathOpen('crusader'), 'Justice is not clearly behind');
var nk = byDef(n, 'case')[0], nr = n.caseRec(nk.caseId);
nr.template = 'syndicate'; nr.special = true;
n.onConviction(nr, { guilty: true, solid: true }, []);
assert.ok(n.s.over && n.s.over.id === 'crusader', 'the Syndicate\'s fall is still the Crusader\'s ending');
var far = game(86, 'master');
far.pathGain('commissioner', 12, 'a career');
assert.ok(!far.pathOpen('crusader'), 'but not for someone who never walked that path');

// Saves keep the drift; the bot's summary of the three paths reads.
var s2 = CF.Engine.load(c.save());
assert.strictEqual(s2.s.calling, 'crusader');
assert.strictEqual(s2.s.origin, 'commissioner');
assert.ok(/Power \d+ · Knowledge \d+ · Justice \d+/.test(CF.Callings.summary(s2)));
console.log('callings: drift, card, endings from any start, origin bonus kept, play feeds paths, save OK');
