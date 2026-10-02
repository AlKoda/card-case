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
