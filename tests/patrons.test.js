// Part II, Phase F: patrons (docs/CITY.md §9). Commissions carry a desired
// verdict; delivering it raises Favour, delivering the truth lowers it;
// Favour opens and shuts doors; the Council can turn; the Bishop's
// displeasure brings the Inquisitor.
// Run: node tests/patrons.test.js
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
function convictOn(e, rec, who, tier, off) {
  e.remove(e.caseCard(rec.id));
  var t = e.create('trial', { data: { caseId: rec.id, name: who.name, guilty: who.guilty, solid: tier === 'strong', tier: tier || 'strong', real: 9, need: 6, coerced: 0, planted: 0, illegal: 0, contradictions: 0 } });
  for (var i = 0; i < 20; i++) { var saved = e.save(); var g = CF.Engine.load(saved); g.rng.setState(i * 31 + 5 + (off || 0)); g.verdict(g.card(t.uid)); if (g.caseRec(rec.id).status === 'closed') return g; }
  throw new Error('never convicted');
}
function commission(seed, from) {
  for (var i = 0; i < 200; i++) {
    var e = game(seed + i);
    var rec = e.caseRec(e.spawnCase(from === 'guild' ? 'fraud' : from === 'bishop' ? 'harbor' : 'burglary', { quiet: true }).caseId);
    if (rec.commission && rec.commission.from === from) return { e: e, rec: rec };
  }
  throw new Error('no commission from ' + from);
}

// ---- Commissions arrive, and the dossier says what is wanted ----------------------
(function arrive() {
  var seen = { council: 0, bishop: 0, guild: 0 }, n = 0;
  for (var i = 0; i < 80; i++) {
    var e = game(300 + i);
    var rec = e.caseRec(e.spawnCase(null, { quiet: true }).caseId);
    if (rec.commission) { seen[rec.commission.from]++; n++; assert.ok(/wants|asks|want/.test(CF.Patrons.describe(rec))); }
  }
  assert.ok(n >= 10 && seen.council >= 1 && seen.bishop >= 1 && seen.guild >= 1, JSON.stringify(seen));
  var c = commission(1, 'council');
  assert.ok(c.rec.commission.ofCouncil && c.rec.commission.deadline > c.e.s.t);
  // The Council's commission says what its clock is, in the city's days.
  assert.ok(c.rec.commission.days >= 1, 'the commission carries its days: ' + c.rec.commission.days);
  assert.ok(new RegExp('within ' + c.rec.commission.days + ' days').test(CF.Patrons.describe(c.rec)), CF.Patrons.describe(c.rec));
  assert.strictEqual(c.e.commissionDays(c.rec), c.rec.commission.days, 'the days left, live, for the dossier');
  c.e.tick(60);
  assert.ok(c.e.commissionDays(c.rec) < c.rec.commission.days, 'and they run down');
  assert.ok(/Council/.test(c.e.caseCard(c.rec.id).desc), 'the case says who wants what');
  console.log('arrive: ok');
})();

// ---- The Council: quiet and quick, or the truth against a Council family ----------
(function council() {
  var c = commission(20, 'council'), e = c.e, rec = c.rec;
  var family = rec.suspects.filter(function (x) { return x.key === rec.commission.ofCouncil; })[0];
  var other = rec.suspects.filter(function (x) { return x.key !== rec.commission.ofCouncil; })[0];
  var f0 = byDef(e, 'funds').length;
  var g = convictOn(e, rec, other);
  assert.strictEqual(g.favour().council, 1, 'delivered as desired: Favour +1');
  assert.ok(byDef(g, 'funds').length >= f0 + 2, 'and two Coin');
  if (!other.guilty) assert.ok(g.s.stats.protected >= 1, 'a wrongful conviction under the Council\'s protection');
  var c2 = commission(60, 'council'), e2 = c2.e, rec2 = c2.rec;
  var fam2 = rec2.suspects.filter(function (x) { return x.key === rec2.commission.ofCouncil; })[0];
  var j0 = e2.s.paths.crusader, r0 = e2.s.meters.reputation;
  var g2 = convictOn(e2, rec2, fam2);
  assert.strictEqual(g2.favour().council, -1, 'the truth against a Council family: Favour −1');
  assert.ok(g2.s.paths.crusader >= j0 + 2, 'Justice scores it double');
  assert.ok(g2.s.journal.some(function (j) { return /Council family in the dock/.test(j.text); }), 'and the Hill will not forgive it');
  void r0;
  // Left to go cold, the patron is displeased.
  var c3 = commission(90, 'council');
  c3.e.goCold(c3.rec.id);
  assert.strictEqual(c3.e.favour().council, -1);
  console.log('council: ok');
})();

// ---- The Bishop and the Guilds want a sentence ------------------------------------
(function sentences() {
  var b = commission(120, 'bishop'), e = b.e, rec = b.rec;
  var cul = rec.suspects.filter(function (x) { return x.guilty; })[0];
  var g = convictOn(e, rec, cul);
  g.s.counts.cruelty = 2;
  var cond = byDef(g, 'condemned')[0];
  assert.ok(cond, 'condemned');
  var res = g.passSentence(cond, 'pardon', null, { quiet: true });
  assert.strictEqual(g.favour().bishop, 1, 'mercy for the Bishop: Favour +1');
  assert.strictEqual(g.s.counts.cruelty, 1, 'and absolution, once per rank');
  assert.ok(/absolves/.test(res.text));
  var b2 = commission(160, 'bishop');
  var g2 = convictOn(b2.e, b2.rec, b2.rec.suspects.filter(function (x) { return x.guilty; })[0]);
  g2.passSentence(byDef(g2, 'condemned')[0], 'rope', null, { quiet: true });
  assert.strictEqual(g2.favour().bishop, -1, 'the rope for the Bishop\'s penitent: Favour −1');
  var gu = commission(200, 'guild');
  var g3 = convictOn(gu.e, gu.rec, gu.rec.suspects.filter(function (x) { return x.guilty; })[0]);
  var f0 = byDef(g3, 'funds').length;
  g3.passSentence(byDef(g3, 'condemned')[0], 'pillory', null, { quiet: true });
  assert.strictEqual(g3.favour().guild, 1, 'the square for the Guilds: Favour +1');
  assert.strictEqual(byDef(g3, 'funds').length - f0, 1, 'and a fee');
  var gu2 = commission(240, 'guild');
  var g4 = convictOn(gu2.e, gu2.rec, gu2.rec.suspects.filter(function (x) { return x.guilty; })[0]);
  g4.passSentence(byDef(g4, 'condemned')[0], 'brand', null, { quiet: true });
  assert.strictEqual(g4.favour().guild, -1);
  assert.ok(g4.s.flags.marketQuietUntil >= g4.s.week, 'the Market goes quiet');
  console.log('sentences: ok');
})();

// ---- Favour, elections and the Inquisitor ----------------------------------------
(function favour() {
  var e = game(7);
  e.favour().council = 3; e.s.meters.scrutiny = 2;
  e.patronsWeek();
  assert.strictEqual(e.s.meters.scrutiny, 1, 'a patron on the Council covers you');
  e.favour().council = -2; e.s.rank = 0; e.s.meters.reputation = 99;
  e.checkThresholds();
  assert.strictEqual(e.cardsWith('promotion').length, 0, 'no letters while the Council is against you');
  // The election turns.
  var turned = false;
  for (var i = 0; i < 30 && !turned; i++) { var g = game(400 + i); g.favour().council = 3; g.s.week = 12; g.patronsWeek(); if (g.favour().council === 0) { turned = true; assert.strictEqual(g.s.meters.scrutiny, 3, 'Favour becomes Suspicion'); } }
  assert.ok(turned, 'the Council can turn');
  // The Inquisitor.
  var h = game(9);
  h.favour().bishop = -2;
  var lines = h.patronsWeek();
  assert.ok(h.s.flags.inquisitor && lines.some(function (l) { return /Inquisitor/.test(l); }));
  var taken = false;
  for (var j = 0; j < 30 && !taken; j++) {
    var k = game(500 + j); k.s.flags.inquisitor = true;
    var rec = k.caseRec(byDef(k, 'case')[0].caseId);
    var cul = rec.suspects.filter(function (x) { return x.guilty; })[0];
    var g5 = convictOn(k, rec, cul, 'strong', j * 7);
    if (!byDef(g5, 'condemned').length && g5.s.stats.inquisitor) { taken = true; assert.strictEqual(g5.criminalByName(cul.name).status, 'dead'); assert.strictEqual(g5.s.counts.cruelty, 0, 'the Inquisitor\'s cruelty is not yours'); }
  }
  assert.ok(taken, 'the Inquisitor takes the Condemned sometimes');
  h.favour().bishop = 0;
  h.patronsWeek();
  assert.ok(!h.s.flags.inquisitor, 'and is recalled');
  // A heresy case is asked after at a week, once; without the Inquisitor it is taken only while the Bishop is cold.
  var d = game(11); d.s.rank = 3;
  var hrec = d.caseRec(d.spawnCase('scriptorium', { quiet: true }).caseId);
  hrec.week = d.s.week - 1;
  var dl = d.patronsWeek();
  assert.ok(dl.some(function (l) { return /A Dominican has asked the Rolls/.test(l); }) && d.s.journal[0].title === 'A Dominican at the Rolls', 'a Dominican at the Rolls');
  assert.ok(!d.patronsWeek().some(function (l) { return /Dominican/.test(l); }), 'told once');
  hrec.week = d.s.week - 2; d.favour().bishop = 1;
  for (var q = 0; q < 20; q++) d.patronsWeek();
  assert.strictEqual(hrec.status, 'open', 'the Bishop in favour keeps the Dominican from the file');
  d.favour().bishop = 0;
  var seized = false;
  for (var q2 = 0; q2 < 40 && !seized; q2++) { d.patronsWeek(); seized = hrec.status === 'inquisitor'; }
  assert.ok(seized, 'with the Bishop cold, the file is taken');
  // The week before an election the seat is contested.
  var el = game(12); el.favour().council = 1; el.s.week = 11;
  assert.ok(el.patronsWeek().some(function (l) { return /The Council elects next week/.test(l); }), 'the election is foreshadowed');
  el.favour().council = 0;
  assert.ok(!el.patronsWeek().some(function (l) { return /elects next week/.test(l); }), 'not without a patron');
  var old = JSON.parse(game(1).save()); delete old.favour;
  assert.deepStrictEqual(CF.Engine.load(old).favour(), { council: 0, bishop: 0, guild: 0 });
  console.log('favour: ok');
})();

console.log('patrons: arrive, council, sentences, favour all OK');

// ---- Elections are told whichever way they go; the Dominican only when he can take the file ----
(function elections() {
  var kept = false, lost = false;
  for (var i = 0; i < 30 && !(kept && lost); i++) {
    var e = game(700 + i); e.favour().council = 2; e.s.week = CF.Patrons.ELECTION_EVERY || 12;
    var l = e.patronsWeek().join(' ');
    if (/keeps his seat by four votes/.test(l)) { kept = true; assert.strictEqual(e.favour().council, 2, 'a kept seat keeps the Favour'); }
    if (/goes against your patron/.test(l)) lost = true;
  }
  assert.ok(kept && lost, 'a patron keeps his seat, or loses it, and either is told');
  var n = game(731); n.s.week = 12; n.s.flags.firstCase = true;
  assert.ok(n.patronsWeek().some(function (x) { return /New faces on the bench/.test(x); }), 'with no patron, the election still happens');
  // The Bishop in favour: nobody asks for the file, and nothing is taken.
  var d = game(732); d.s.rank = 3; d.favour().bishop = 1;
  var hrec = d.caseRec(d.spawnCase('scriptorium', { quiet: true }).caseId);
  hrec.week = d.s.week - 1;
  assert.ok(!d.patronsWeek().some(function (x) { return /Dominican/.test(x); }), 'no Dominican while the Bishop is warm');
  hrec.week = d.s.week - 3;
  for (var q = 0; q < 10; q++) d.patronsWeek();
  assert.strictEqual(hrec.status, 'open');
  // The Bishop cools: the warning first, a week before any seizure.
  d.favour().bishop = 0;
  var w = d.patronsWeek();
  assert.ok(w.some(function (x) { return /A Dominican has asked the Rolls/.test(x); }) && hrec.status === 'open', 'warned, not yet taken');
  console.log('elections and the Dominican: ok');
})();

// ---- The Court: one advocate's reading, then 'again'; no thanks for a Council family ----
(function courtWords() {
  var c = commission(60, 'council'), e = c.e, rec = c.rec;
  var fam = rec.suspects.filter(function (x) { return x.key === rec.commission.ofCouncil; })[0];
  var told = null;
  for (var i = 0; i < 40 && !told; i++) {
    var g = CF.Engine.load(e.save());
    var t = g.create('trial', { data: { caseId: rec.id, name: fam.name, guilty: true, solid: true, tier: 'strong', real: 9, need: 6, coerced: 0, planted: 0, illegal: 0, contradictions: 0 } });
    g.rng.setState(i * 17 + 3); g.verdict(g.card(t.uid));
    if (g.caseRec(rec.id).status === 'closed') told = g.s.journal.filter(function (j) { return /^Guilty: /.test(j.title); })[0];
  }
  assert.ok(told, 'convicted');
  assert.ok(/Council family in the dock/.test(told.text) && !/The Council's thanks/.test(told.text), 'no thanks from the Council it angered: ' + told.text);
  assert.ok(/not a penny over/.test(told.text), 'only the fee: ' + told.text);
  // Three contradictions read out: the note once, then 'again', never the same line twice.
  var seen = false;
  for (var k = 0; k < 60 && !seen; k++) {
    var h = game(800 + k), hr = h.caseRec(byDef(h, 'case')[0].caseId), cul = hr.suspects.filter(function (x) { return x.guilty; })[0];
    var tt = h.create('trial', { data: { caseId: hr.id, name: cul.name, guilty: true, solid: false, tier: 'reasonable', real: 5, need: 6, coerced: 0, planted: 0, illegal: 0, contradictions: 4 } });
    h.verdict(h.card(tt.uid));
    var txt = h.s.journal.filter(function (j) { return /^(Not )?Guilty: /.test(j.title); })[0].text;
    var reads = txt.split('The advocate reads your own proof back').length - 1;
    assert.ok(reads <= 1, 'read once: ' + txt);
    if (/Then he does it again/.test(txt)) { seen = true; assert.strictEqual(reads, 1); }
  }
  assert.ok(seen, 'a second contradiction is told as a second reading');
  console.log('court words: ok');
})();

// ---- Every commission speaks (round 8) -----------------------------------------
(function commissionsSpeak() {
  // The Bishop's case: the Condemned card says what he asks, the rungs that please him carry his seal, and he always pleads.
  // On a burglary the ladder holds a Fine and the Pillory as well as a Pardon.
  var b = null;
  for (var bi = 0; bi < 400 && !b; bi++) {
    var be = game(300 + bi), brec = be.caseRec(be.spawnCase('burglary', { quiet: true }).caseId);
    if (brec.commission && brec.commission.from === 'bishop') b = { e: be, rec: brec };
  }
  assert.ok(b, 'a Bishop\'s burglary');
  var g = convictOn(b.e, b.rec, b.rec.suspects.filter(function (x) { return x.guilty; })[0]);
  var cond = byDef(g, 'condemned')[0];
  assert.ok(cond.desc.indexOf('The Bishop asks: a Pardon or a Fine.') > 0, cond.desc);
  assert.strictEqual(cond.data.patron, 'bishop');
  byDef(g, 'rung').forEach(function (r) {
    var pleases = r.data.rung === 'pardon' || r.data.rung === 'fine';
    assert.strictEqual(r.data.patron, pleases ? 'bishop' : null, r.data.rung + ' carries the patron only if it pleases him');
  });
  assert.ok(byDef(g, 'plea').some(function (p) { return p.data.from === 'church'; }), 'the Bishop always pleads on his own case');
  // A middle rung: no favour moved, and a line.
  var mid = byDef(g, 'rung').filter(function (r) { return r.data.rung === 'pillory' || r.data.rung === 'banish'; })[0];
  assert.ok(mid, 'a middle rung: ' + byDef(g, 'rung').map(function (r) { return r.data.rung; }));
  {
    var res = g.passSentence(cond, mid.data.rung, null, { quiet: true });
    assert.strictEqual(g.favour().bishop, 0, 'neither mercy nor the rope: favour unmoved');
    assert.ok(/The Bishop says nothing/.test(res.text), res.text);
    assert.strictEqual(g.caseRec(b.rec.id).commission.delivered, 'half');
  }
  // The Guilds' brother pardoned: neither the square nor the rope.
  var gu = commission(340, 'guild');
  var g2 = convictOn(gu.e, gu.rec, gu.rec.suspects.filter(function (x) { return x.guilty; })[0]);
  var c2 = byDef(g2, 'condemned')[0];
  assert.ok(byDef(g2, 'plea').some(function (p) { return p.data.from === 'guild'; }), 'the Guilds always plead on their own case');
  assert.ok(c2.desc.indexOf('The Guilds ask: the Pillory or a Fine.') > 0);
  assert.ok(byDef(g2, 'rung').some(function (r) { return r.data.rung === 'pardon'; }), 'a fraud can be pardoned');
  {
    var r2 = g2.passSentence(c2, 'pardon', null, { quiet: true });
    assert.ok(/The wardens say nothing/.test(r2.text), r2.text);
    assert.strictEqual(g2.favour().guild, 0);
  }
  // A Guild's case acquitted is told, and its favour is not lost twice when nothing else happens.
  var ga = commission(380, 'guild'), notes = [];
  ga.e.commissionVerdict(ga.rec, { name: 'X', guilty: true }, false, notes);
  assert.ok(notes.some(function (n) { return /he walked/.test(n); }), notes.join(' '));
  assert.strictEqual(ga.rec.commission.delivered, 'acquitted');
  // Gone cold: favour -1 and a word of it.
  var cold = commission(420, 'bishop');
  cold.e.goCold(cold.rec.id);
  assert.strictEqual(cold.e.favour().bishop, -1);
  assert.ok(cold.e.s.journal.some(function (j) { return j.title === 'A Patron Displeased' && j.text.indexOf(cold.rec.title) >= 0; }), 'the patron is displeased, out loud');
  // Settled by the thief-takers: cold to the Council, out loud; the Bishop and the Guilds had nobody to judge.
  var sc = commission(440, 'council'), sb = commission(460, 'bishop');
  var settle = function (x) { var rng = function () { return 0.1; }; return x.e.thieftakersSettle(x.rec, { rng: rng }); };
  settle(sc); settle(sb);
  assert.strictEqual(sc.e.favour().council, -1, 'a Council case settled is not answered');
  assert.strictEqual(sc.rec.commission.delivered, 'lost');
  assert.ok(sc.e.s.journal.some(function (j) { return j.title === 'A Patron Displeased'; }));
  assert.strictEqual(sb.e.favour().bishop, 0, 'the Bishop has no sentence to judge');
  assert.strictEqual(sb.rec.commission.delivered, 'settled', 'and the commission is closed, not kept forever');
  // The Bell says whose favour moved this week.
  var w = game(77);
  w.favourGain('bishop', 1); w.favourGain('guild', -1);
  w.s.flags.firstCase = true;
  w.tick(CF.WEEK - w.s.weekT + 0.01);
  var wk = w.s.journal.filter(function (j) { return j.kind === 'week'; })[0];
  assert.ok(wk && wk.text.indexOf('The Bishop\'s favour rises.') >= 0 && wk.text.indexOf('The Guilds\' favour falls.') >= 0, wk && wk.text);
  assert.ok(wk.text.indexOf('The Council\'s favour') < 0, 'an unmoved patron is not mentioned');
  // An older save counts from its load.
  var old = JSON.parse(game(78).save());
  delete old.weekSnap; old.favour = { council: 2, bishop: 0, guild: 0 };
  var l = CF.Engine.load(old);
  assert.deepStrictEqual(l.s.weekSnap.favour, { council: 2, bishop: 0, guild: 0 }, 'an older save starts counting favour now');
  console.log('every commission speaks: ok');
})();

// ---- What the dossier says of a heresy case: the Inquisitor's week, or the Bishop's protection ----------
(function heresyWatch() {
  var d = game(21); d.s.rank = 3;
  var hrec = d.caseRec(d.spawnCase('scriptorium', { quiet: true }).caseId);
  var plain = d.caseRec(d.spawnCase('burglary', { quiet: true }).caseId);
  assert.strictEqual(d.heresyWatch(plain), null, 'no heresy, nothing to say');
  d.favour().bishop = 1; d.s.flags.inquisitor = false;
  var w = d.heresyWatch(hrec);
  assert.ok(w.kept && w.line === 'The Bishop has kept the Dominicans off this one.', 'a warm Bishop keeps them off');
  // And no Dominican is told of while he does.
  hrec.week = d.s.week - 3;
  assert.ok(!d.patronsWeek().some(function (l) { return /Dominican/.test(l); }) && !hrec.dominican, 'no empty threat under a warm Bishop');
  d.favour().bishop = 0;
  w = d.heresyWatch(hrec);
  assert.ok(!w.kept && !w.asked && w.week === d.s.week + 2 && w.vars.n === w.week, 'cold: not before the week after the asking');
  d.patronsWeek();
  assert.ok(hrec.dominican, 'asked after once the Bishop cools');
  w = d.heresyWatch(hrec);
  assert.ok(w.asked && w.week === d.s.week + 1, 'asked: taken from the next week');
  d.favour().bishop = 2; d.s.flags.inquisitor = true;
  assert.ok(!d.heresyWatch(hrec).kept, 'the Inquisitor here: the Bishop cannot keep him off');
  console.log('the Bishop keeps the Dominicans off: ok');
})();

// ---- A patron's seal: a favour called in once, at the cost of 2 Favour --------------------
(function seals() {
  var g = game(91);
  var steps = g.favourSteps();
  assert.ok(steps.length === 3 && steps.every(function (x) { return x.word === 'Neutral' && x.up && x.icon; }), 'the three patrons, neutral, with the next step up');
  assert.ok(steps[1].down === 'At -2: the Inquisitor comes.' && steps[2].down === null, 'the Bishop has a step down; the Guilds none');
  function seal(k) { return g.cardsOf('seal', true).filter(function (c) { return c.data.patron === k; }); }
  function callIn(card) {
    assert.ok(g.autoSlot('duty', card.uid));
    assert.strictEqual(g.currentRecipe('duty').recipe.id, 'duty_seal');
    assert.ok(g.start('duty'));
    for (var i = 0; i < 100 && g.verb('duty').status === 'running'; i++) g.tick(1);
    var story = g.verb('duty').story;
    g.collect('duty');
    return story;
  }
  g.favourGain('bishop', 2);
  assert.strictEqual(seal('bishop').length, 0, 'no seal below 3');
  g.favourGain('bishop', 1);
  assert.strictEqual(seal('bishop').length, 1, 'the first time the Bishop reaches 3, his seal');
  assert.ok(g.s.journal.some(function (j) { return j.title === 'The Bishop\'s Seal'; }), 'and the journal says so');
  g.favourGain('bishop', 1);
  assert.strictEqual(seal('bishop').length, 1, 'one seal at a time');
  assert.ok(g.favourSteps()[1].word === 'Your patron' && g.favourSteps()[1].up === null && g.favourSteps()[1].seal, 'the Bishop is your patron, and his seal is out');
  g.s.flags.inquisitor = true;
  var st = callIn(seal('bishop')[0]);
  assert.ok(!g.s.flags.inquisitor && /Inquisitor/.test(st.text), 'the Bishop recalls the Inquisitor');
  assert.strictEqual(g.favour().bishop, 2, 'calling it in costs 2 favour');
  assert.strictEqual(seal('bishop').length, 0, 'and the seal is spent');
  g.favourGain('bishop', 1);
  assert.strictEqual(seal('bishop').length, 1, 'climbing back to 3 sends it again');
  // The Guilds: three Coin. The Council: Suspicion -2.
  var coins = g.cardsOf('funds').length;
  g.favourGain('guild', 3);
  callIn(seal('guild')[0]);
  assert.strictEqual(g.cardsOf('funds').length, coins + 3, 'the guild chest: 3 Coin');
  assert.strictEqual(g.favour().guild, 1);
  g.favour().council = 3; g.patronsWeek(); // favour moved by a beat, found at the Bell
  assert.strictEqual(seal('council').length, 1, 'a favour set by a choice is found at the Bell');
  g.s.meters.scrutiny = 4;
  callIn(seal('council')[0]);
  assert.strictEqual(g.s.meters.scrutiny, 2, 'the Council: Suspicion -2');
  // An older save has been sent none.
  var old = JSON.parse(game(92).save()); delete old.seals;
  var l = CF.Engine.load(old);
  assert.deepStrictEqual(l.s.seals, {}, 'an older save loads with no seal sent');
  l.favourGain('council', 3);
  assert.strictEqual(l.cardsOf('seal', true).length, 1, 'and gets one when the Council next reaches 3');
  // Unasked, a sentence of their kind as they would wish it warms a neutral patron, to 1 and no further.
  var u = game(93), urec = u.caseRec(u.spawnCase('fraud', { quiet: true }).caseId), un = [];
  urec.commission = null;
  u.commissionSentence(urec, 'pillory', un);
  assert.ok(u.favour().guild === 1 && un.length === 1, 'a cheat shamed in the square warms the Guilds');
  u.commissionSentence(urec, 'fine', un);
  assert.strictEqual(u.favour().guild, 1, 'but only to 1');
  u.commissionSentence(urec, 'banish', un);
  assert.strictEqual(u.favour().guild, 1, 'a sentence they would not wish is not noticed');
  console.log('a patron\'s seal, called in: ok');
})();

// ---- The Council elects: asked the week before, counted and told at the next Bell (round 8) ----
(function electionChoice() {
  function asked(seed, council) {
    var e = game(seed); e.s.flags.firstCase = true; e.favour().council = council; e.s.week = CF.Patrons.ELECTION_EVERY - 1;
    e.s.choice = null;
    e.patronsWeek();
    return e;
  }
  var e = asked(760, 2);
  assert.ok(e.s.choice && e.s.choice.id === 'election', 'the week before, the city asks how you stand');
  assert.strictEqual(e.s.choice.options.length, 3, 'three answers');
  assert.ok(e.s.choice.options.every(function (o) { return o.gain; }), 'each says what it gives');
  // No patron, no question; a patron of favour 1 has too little at stake to ask, and is only told.
  var none = asked(761, 0);
  assert.ok(!none.s.choice || none.s.choice.id !== 'election', 'no patron, no question');
  var slight = game(762); slight.s.flags.firstCase = true; slight.favour().council = 1; slight.s.week = CF.Patrons.ELECTION_EVERY - 1; slight.s.choice = null;
  // (Round 8: a patron of favour 1 asks only to be seen at his door, the canvass; never how you stand.)
  assert.ok(slight.patronsWeek().some(function (l) { return /elects next week/.test(l); }) && (!slight.s.choice || slight.s.choice.id === 'canvass'), 'favour 1: told, not asked how you stand');
  // Stand with him: Coin paid; the count told the next week, and its return either way.
  var held = false, lost = false;
  for (var i = 0; i < 40 && !(held && lost); i++) {
    var g = asked(770 + i, 2);
    var coins = g.cardsOf('funds').length;
    assert.ok(g.choose(0), 'standing with him costs a Coin');
    assert.strictEqual(g.cardsOf('funds').length, coins - 1);
    assert.ok(g.s.flags.election && g.s.flags.election.stance === 'stand');
    g.s.week++;
    g.s.meters.scrutiny = 0;
    var l = g.patronsWeek().join(' ');
    assert.ok(/The Count in the Chamber: your patron (holds|loses)\./.test(l), 'the count is told');
    assert.strictEqual(g.s.flags.election, null, 'and counted once');
    if (/holds/.test(l)) { held = true; assert.strictEqual(g.favour().council, 4, 'he holds: Council favour +2'); }
    else { lost = true; assert.ok(g.favour().council === 0 && g.s.meters.scrutiny === 2, 'he loses: Suspicion for every favour'); }
  }
  assert.ok(held && lost, 'both counts come');
  // Keep your distance: favour halves now, and no Suspicion whichever way.
  for (var j = 0; j < 10; j++) {
    var d = asked(820 + j, 3);
    d.choose(1);
    assert.strictEqual(d.favour().council, 1, 'distance halves the favour');
    d.s.week++; d.s.meters.scrutiny = 0;
    d.patronsWeek();
    assert.strictEqual(d.s.meters.scrutiny, 0, 'and no Suspicion either way');
  }
  // Dine with the other side: Wit spent, the Bishop cools; the new man gives +1.
  var lostSeen = false;
  for (var k = 0; k < 30 && !lostSeen; k++) {
    var n = asked(840 + k, 2), bishop = n.favour().bishop;
    if (!n.canChoose(2)) continue;
    n.choose(2);
    assert.strictEqual(n.favour().bishop, bishop - 1, 'the Bishop hears whose table');
    n.s.week++;
    var ln = n.patronsWeek().join(' ');
    if (/loses/.test(ln)) { lostSeen = true; assert.strictEqual(n.favour().council, 1, 'Council favour +1 under the new man'); }
    else assert.strictEqual(n.favour().council, 1, 'he holds, and has heard where you dined: favour halves');
  }
  assert.ok(lostSeen, 'the other side wins sometimes');
  // A save from before: the question unanswered loads, and the old roll still runs.
  var old = JSON.parse(game(860).save()); delete old.flags.election;
  var lo = CF.Engine.load(old);
  assert.strictEqual(lo.s.flags.election, null, 'an older save has answered nothing');
  var open = asked(861, 2), saved = CF.Engine.load(open.save());
  assert.ok(saved.s.choice && saved.s.choice.id === 'election', 'a save holds the question open');
  assert.ok(saved.choose(1), 'and it can be answered after loading');
  console.log('the Council elects: ok');
})();

// ---- The calendar: two seasons weigh the crimes, the Assize, the Long Service (round 8) ----
(function calendar() {
  var e = game(901);
  assert.deepStrictEqual([1, 13, 14, 26, 27, 39, 40, 52, 53, 66].map(function (w) { return e.season(w).id; }),
    ['lent', 'lent', 'fair', 'fair', 'plague', 'plague', 'winter', 'winter', 'lent', 'fair'], 'four quarters of thirteen weeks, and the year turns');
  assert.ok(CF.SEASONS.every(function (x) { return x.name && x.line && (x.effect === null || typeof x.effect === 'string'); }), 'each season has a name and a line');
  function share(g, t) { return g.casePool().filter(function (x) { return x === t; }).length; }
  e.s.rank = 1; e.s.rankWeek = -1;
  e.s.week = 5;
  assert.ok(['fraud', 'coining', 'extortion', 'poison', 'missing', 'burglary'].every(function (t) { return share(e, t) === 1; }), 'Lent sends the crimes evenly');
  e.s.week = 20;
  assert.ok(share(e, 'fraud') === 2 && share(e, 'coining') === 2 && share(e, 'extortion') === 2 && share(e, 'burglary') === 1, 'the Fair: fraud, false coin and protection twice as often');
  e.s.week = 30;
  assert.ok(share(e, 'poison') === 2 && share(e, 'missing') === 2 && share(e, 'fraud') === 1, 'the Plague Summer: poison and the missing twice as often');
  e.s.week = 45;
  assert.ok(share(e, 'poison') === 1 && share(e, 'fraud') === 1, 'Winter sends them evenly');
  e.s.rank = 0;
  e.s.week = 20;
  assert.ok(share(e, 'fraud') === 0 && share(e, 'coining') === 2, 'a season weighs only the crimes the office is sent');

  // The Bell says the season the week it turns, first, and keeps it on the week.
  var b = game(902);
  b.s.week = 13; b.weekTick();
  var wk = b.s.journal.filter(function (j) { return j.kind === 'week'; })[0];
  assert.ok(wk && wk.title === 'Week 14' && wk.parts[0] === CF.SEASONS[1].line && wk.season === 'fair', 'the Fair opens the Bell: ' + (wk && wk.parts[0]));
  b.weekTick();
  wk = b.s.journal.filter(function (j) { return j.kind === 'week'; })[0];
  assert.ok(wk.parts.indexOf(CF.SEASONS[1].line) < 0 && wk.season === 'fair', 'told once, kept on the week');

  // The Assize: the half-year read aloud, then a question with three returns.
  function assize(seed) {
    var g = game(seed);
    g.s.stats.cases = 14; g.s.stats.convictions = 8; g.s.stats.acquittals = 2; g.s.stats.cold = 3; g.s.stats.wrongful = 1;
    g.s.week = CF.ASSIZE.week - 1; g.weekTick();
    return g;
  }
  var a = assize(903);
  assert.ok(a.s.flags.assize && a.s.flags.assize.week === 26 && a.s.flags.assize.record.convictions === 8, 'the record kept');
  var read = a.s.journal.filter(function (j) { return j.title === 'The Assize' && /He reads out 14 cases/.test(j.text); });
  assert.ok(read.length === 1 && /Of these, 8 ended in a conviction\./.test(read[0].text) && /One name was the wrong one/.test(read[0].text), 'the half-year, read once from the record');
  assert.ok(/benches murmur/.test(read[0].text) && !/applause/.test(read[0].text), 'a year with a wrong name is not applauded, and the benches give one verdict');
  assert.ok(a.s.choice && a.s.choice.id === 'assize' && a.s.choice.options.length === 3, 'the Council asks what you want');
  assert.ok([0, 1, 2].every(function (i) { return a.canChoose(i); }) && a.s.choice.options.every(function (o) { return o.gain; }), 'every answer is free and says its return');
  var g0 = CF.Engine.load(a.save()), sal0 = (CF.RANK_DEFS[0] || {}).salary || CF.ECONOMY.salary[0] || 1;
  assert.ok(g0.choose(0) && g0.s.flags.pension === true, 'a pension');
  for (var k = 0; k < 6; k++) g0.create('funds');
  g0.weekTick();
  var bell = g0.s.journal.filter(function (j) { return j.kind === 'week'; })[0];
  assert.strictEqual(bell.uids.length, sal0 + 1, 'a Coin more at the Bell');
  var g1 = CF.Engine.load(a.save()), men = g1.cardsOf('personnel', true).length;
  assert.ok(g1.choose(1) && g1.cardsOf('personnel', true).length === men + 1, 'a letter of service');
  var g2 = CF.Engine.load(a.save()), rep = g2.s.meters.reputation;
  assert.ok(g2.choose(2) && g2.s.meters.reputation === rep + 2, 'Standing +2');
  g2.weekTick();
  assert.ok(!g2.s.choice || g2.s.choice.id !== 'assize', 'sat once');
  // A question waiting: the Assize sits at the next Bell, and not after its weeks.
  var w = game(904);
  w.s.week = 25; w.s.choice = { id: 'swan', title: 'x', text: 'x', options: [] };
  assert.deepStrictEqual(w.assizeWeek(), [], 'not over a question');
  w.s.week = 26; assert.deepStrictEqual(w.assizeWeek(), [], 'the clock waits for the answer');
  w.s.choice = null; w.s.week = 27;
  assert.ok(w.assizeWeek().length === 1 && w.s.choice.id === 'assize', 'the next Bell');
  var late = game(905); late.s.week = 30;
  assert.deepStrictEqual(late.assizeWeek(), [], 'not read late');

  // The Long Service: at the cap, told at week 48, pensioned at 52.
  var L = game(906);
  L.s.rank = L.rankCap(); L.s.rankWeek = -1;
  L.s.week = 46; L.weekTick();
  assert.strictEqual(L.s.flags.longService, undefined, 'not told before week 48');
  L.weekTick();
  assert.strictEqual(L.s.flags.longService, 48, 'told at week 48');
  wk = L.s.journal.filter(function (j) { return j.kind === 'week'; })[0];
  assert.ok(wk.parts.indexOf('The Council is drawing up your pension. Four more weeks.') >= 0, 'on the Bell');
  var road = L.roads().filter(function (x) { return x.id === 'longservice'; })[0];
  assert.ok(road && road.want === 'The Council is drawing up your pension.' && road.frac < 1, 'on the Roads');
  for (var i = 0; i < 3 && !L.s.over; i++) { for (var c = 0; c < 4; c++) L.create('funds'); L.weekTick(); }
  assert.ok(!L.s.over && L.s.week === 51, 'not before week 52');
  L.weekTick();
  assert.ok(L.s.over && L.s.over.id === 'longservice' && L.s.over.win && L.s.week === 52, 'pensioned at week 52');
  assert.strictEqual(L.s.over.text, CF.ENDINGS.longservice.text);
  assert.strictEqual(L.buildLegacy().ending, 'The Long Service');
  // Below the cap at week 52: no pension; the cap reached late is told, and ended four weeks on.
  var N = game(907);
  N.s.week = 51; N.weekTick();
  assert.ok(!N.s.over && N.s.flags.longService === undefined && N.longServiceDue() === null, 'below the cap, the year goes on');
  N.s.rank = N.rankCap(); N.s.rankWeek = -1; N.s.week = 59; N.weekTick();
  assert.ok(N.s.flags.longService === 60 && N.longServiceDue() === 64 && !N.s.over, 'told when the cap is reached');
  // A hangman's road tops out at Bailiff.
  var H = CF.Engine.newGame({ seed: 908, calling: 'master', who: 'hangman' });
  H.s.rank = 2; H.s.week = 47; H.weekTick();
  assert.strictEqual(H.s.flags.longService, 48, 'the cap is the road\'s, not the ladder\'s');

  // An older save: nothing asked, the Assize past its weeks had none, the pension untold.
  var old = JSON.parse(game(909).save());
  delete old.flags.pension; delete old.flags.assize; delete old.flags.longService;
  old.week = 40;
  var lo = CF.Engine.load(JSON.stringify(old));
  assert.ok(lo.s.flags.pension === false && lo.s.flags.assize && lo.s.flags.assize.week === null && lo.s.flags.longService === null, 'defaulted');
  assert.deepStrictEqual(lo.assizeWeek(), [], 'not read late in an older save');
  assert.strictEqual(CF.Engine.load(lo.save()).save(), lo.save(), 'round-trips');
  old.week = 20;
  var young = CF.Engine.load(JSON.stringify(old));
  assert.strictEqual(young.s.flags.assize, null, 'a save before the Assize still has it to come');
  console.log('the calendar, the Assize and the Long Service: ok');
})();
