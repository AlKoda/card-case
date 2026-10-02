// Phase 3: the written burglary case plays start to conviction, and can be
// solved by each of its three threads (docs/DESIGN.md, "The first playable
// case"): the window, the witness, and the money.
// Run: node tests/case.test.js
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

// A detective: slots the given cards into a verb, runs it, and takes the output.
function Detective(seed) {
  this.e = CF.Engine.newGame({ seed: seed, calling: 'master' });
  this.log = [];
}
Detective.prototype.cards = function (pred) { return this.e.tableCards().filter(pred); };
Detective.prototype.byDef = function (d) { return this.cards(function (c) { return c.def === d; }); };
Detective.prototype.byLabel = function (re) { return this.cards(function (c) { return re.test(CF.Engine.prototype.labelOf.call(this.e, c)); }.bind(this)); };
Detective.prototype.run = function (verb, cards) {
  var e = this.e;
  cards.forEach(function (c) { assert.ok(c, verb + ': missing card'); assert.ok(e.autoSlot(verb, c.uid), verb + ' refused ' + e.labelOf(c) + ' loc=' + JSON.stringify(c.loc) + ' reason=' + e.unavailableReason(c) + ' status=' + e.verb(verb).status); });
  var pv = e.preview(verb);
  assert.ok(pv && !pv.blocked, verb + ' blocked: ' + (pv && pv.blocked));
  assert.ok(e.start(verb), verb + ' did not start');
  // A diligent detective answers what the verb asks for part-way, when a card fits.
  var v = e.verb(verb), guard = 0;
  while (v.status === 'running' && guard++ < 400) {
    e.tick(1);
    if (v.ask && !v.ask.filled) { var cand = e.askCandidates(verb)[0]; if (cand) e.answerAsk(verb, cand.uid); }
  }
  assert.ok(v.status === 'done' || v.status === 'idle', verb + ' did not finish');
  var out = v.out.map(function (u) { return e.card(u); });
  this.log.push(verb + ': ' + (v.story ? v.story.title : '') + ' -> ' + out.map(function (c) { return e.labelOf(c); }).join(', '));
  if (v.status === 'done') e.collect(verb);
  // And rests between jobs: spent Health, Wit and Instinct come straight back.
  e.tableCards().filter(function (c) { return /^spent_/.test(c.def); }).forEach(function (c) { e.transform(c, CF.CARDS[c.def].restores); });
  return out;
};
Detective.prototype.give = function (def) { return this.e.create(def); };
Detective.prototype.rec = function () { return this.rec0 || this.e.caseRec(this.byDef('case')[0].caseId); };
Detective.prototype.suspectCard = function (key) {
  return this.cards(function (c) { return c.def === 'suspect' && c.data.key === key; })[0];
};
Detective.prototype.charge = function (clues) {
  var e = this.e, rec = this.rec();
  var sc = this.suspectCard(rec.culprit);
  if (!sc) { e.revealSuspect(rec, null, { key: rec.culprit }); sc = this.suspectCard(rec.culprit); }
  var a = e.assessCharge(sc, clues);
  this.run('arrest', [sc].concat(clues));
  var trial = this.byDef('trial')[0];
  assert.ok(trial, 'no trial');
  assert.strictEqual(trial.data.guilty, true, 'charged the culprit');
  assert.strictEqual(trial.data.solid, true, 'the charge is solid: real ' + a.real + '/' + a.need + ' ' + JSON.stringify(a.have));
  assert.strictEqual(trial.data.tier, 'strong');
  // A strong charge convicts 92% of the time; the jury still rolls dice, so
  // try the verdict from a few different RNG states rather than one seed.
  var saved = e.save(), convicted = false;
  for (var i = 0; i < 6 && !convicted; i++) {
    var g = CF.Engine.load(saved);
    g.rng.setState((i + 1) * 7919);
    g.tick(trial.life + 1);
    convicted = g.caseRec(rec.id).status === 'closed';
  }
  assert.ok(convicted, 'a strong charge convicts');
  return a;
};

function fresh(seed) {
  var d = new Detective(seed);
  assert.strictEqual(d.rec().template, 'burglary', 'the first case is the burglary');
  return d;
}

// ---- Route 1: the window (forensic) --------------------------------------------
(function forensicRoute() {
  var d = fresh(11), e = d.e;
  var kase = d.byDef('case')[0];
  d.give('kit'); d.give('prints');
  var out = d.run('investigate', [kase]);
  assert.ok(out.some(function (c) { return /Pried Shutter/.test(e.labelOf(c)); }), 'the scene gives the shutter');
  assert.ok(out.some(function (c) { return /Inventory/.test(e.labelOf(c)); }), 'and the inventory');
  assert.ok(d.byDef('suspect').length >= 1, 'a first suspect');
  var toolmark = d.run('analyze', [d.byLabel(/Pried Shutter/)[0], d.byDef('kit')[0]]);
  assert.strictEqual(e.labelOf(toolmark[0]), 'The Blade Read');
  assert.ok(!d.byLabel(/Pried Shutter/).length, 'the raw proof was consumed');
  d.run('investigate', [kase, d.byDef('prints')[0]]);
  var print = d.byLabel(/Half a Hand/)[0];
  assert.ok(print, 'dusting gives a partial print');
  // Prints only match once there is somebody to match them to.
  d.rec().suspects.forEach(function (x) { x.revealed = false; });
  d.byDef('suspect').forEach(function (c) { e.remove(c); });
  var none = d.run('analyze', [print, d.byDef('prints')[0]]);
  assert.ok(none.indexOf(print) >= 0 && e.verb('analyze').recipe === 'lead_burglary_print_nomatch', 'the print comes back unmatched');
  e.revealSuspect(d.rec(), null, { key: d.rec().culprit });
  var matched = d.run('analyze', [d.byLabel(/Half a Hand/)[0], d.byDef('prints')[0]]);
  assert.ok(/Hand Matched/.test(e.labelOf(matched[0])), 'the hand matches the culprit');
  assert.strictEqual(matched[0].data.points, d.rec().culprit);
  // The mind palace reasons from the tokens: the blade alone gives a theory, not a name.
  var th = d.run('reflect', [kase, d.byLabel(/Blade Read/)[0]]);
  assert.ok(!d.rec().identified, 'a token that names nobody names nobody');
  assert.ok(th.some(function (c) { return /^Theory: Hands and Hours/.test(e.labelOf(c)); }), 'a theory token: ' + th.map(function (c) { return e.labelOf(c); }));
  var th2 = d.run('reflect', [kase, d.byLabel(/Blade Read/)[0]]);
  assert.ok(!th2.some(function (c) { return /^Theory/.test(e.labelOf(c)); }), 'the same theory is one token');
  e.remove(th.filter(function (c) { return /^Theory/.test(e.labelOf(c)); })[0]);
  d.run('reflect', [kase, d.byLabel(/Blade Read/)[0], d.byLabel(/Hand Matched/)[0]]);
  assert.strictEqual(d.rec().identified, d.rec().culprit, 'Hands and Hours names the culprit the matched hand points at');
  // Forensics alone pile up on one aspect; the timing gives the charge its second leg.
  // (An Examiner's first case asks little, so the Court is told to want the full weight here.)
  d.rec().charge = { forensic: 3, opportunity: 2, financial: 2 };
  assert.notStrictEqual(e.assessCharge(d.suspectCard(d.rec().culprit), [d.byLabel(/Blade Read/)[0], d.byLabel(/Hand Matched/)[0]]).tier, 'strong');
  d.run('investigate', [kase]);
  d.charge([d.byLabel(/Blade Read/)[0], d.byLabel(/Hand Matched/)[0], d.byLabel(/The Hours/)[0]]);
  console.log('forensic route: convicted\n  ' + d.log.join('\n  '));
})();

// ---- Route 2: the witness (testimony → opportunity) ----------------------------
(function humanRoute() {
  var d = fresh(23), e = d.e;
  var kase = d.byDef('case')[0];
  d.e.s.flags.marketOpen = true; // quarters open once the Market has
  d.run('investigate', [kase]);
  var district = d.cards(function (c) { return c.def === 'district' && c.data.district === d.rec().district; })[0];
  assert.ok(district, 'the scene hands you its district');
  d.run('investigate', [kase, district]);
  var w = d.byDef('witness')[0];
  assert.ok(w && w.data.knows, 'the neighbour saw the culprit');
  d.run('interrogate', [w, d.byDef('focus')[0]]);
  var statement = d.byLabel(/^Deposition/)[0];
  assert.ok(statement && statement.data.trait === d.rec().suspects.filter(function (x) { return x.guilty; })[0].trait, 'the statement carries the culprit\'s trait');
  d.run('investigate', [kase]); // the timing
  var timing = d.byLabel(/The Hours/)[0];
  assert.ok(timing);
  d.run('reflect', [statement, timing]);
  // The sighting and the alarm log reconstruct the night (a deduction), and the
  // result keeps the witness's description of the culprit.
  var corr = d.byLabel(/The Night Reckoned/)[0];
  assert.ok(corr && CF.clueAspects(corr).opportunity >= 3 && corr.data.corroborated, 'the sighting and the timing become a timeline');
  assert.strictEqual(corr.data.trait, statement.data.trait);
  var sc = d.suspectCard(d.rec().culprit) || (e.revealSuspect(d.rec(), null, { key: d.rec().culprit }), d.suspectCard(d.rec().culprit));
  // Confront the culprit with the corroborated sighting until they crack (a chance roll).
  var confession = null;
  for (var i = 0; i < 12 && !confession; i++) {
    d.run('interrogate', [sc, d.byDef('focus')[0], corr]);
    confession = d.byLabel(/^Confession/)[0];
    corr = d.byLabel(/The Night Reckoned/)[0];
  }
  assert.ok(confession, 'the culprit cracks when confronted');
  d.charge([corr, confession, d.byLabel(/Inventory/)[0]]);
  console.log('human route: convicted\n  ' + d.log.join('\n  '));
})();

// ---- Route 3: the money (financial → motive) -------------------------------------
(function moneyRoute() {
  var d = fresh(37), e = d.e;
  var kase = d.byDef('case')[0];
  d.e.s.flags.marketOpen = true; // quarters open once the Market has
  d.run('investigate', [kase]);
  var district = d.cards(function (c) { return c.def === 'district' && c.data.district === d.rec().district; })[0];
  d.run('investigate', [kase, district]);
  var ticket = d.byLabel(/Pawnbroker's Chit/)[0];
  assert.ok(ticket, 'the canvass turns up the pawn ticket');
  var pawned = d.run('analyze', [ticket])[0];
  assert.ok(/Pledged Goods/.test(e.labelOf(pawned)) && /"/.test(pawned.desc), 'the Lombard describes the culprit');
  assert.strictEqual(pawned.data.trait, d.rec().suspects.filter(function (x) { return x.guilty; })[0].trait);
  var sc = d.suspectCard(d.rec().culprit) || (e.revealSuspect(d.rec(), null, { key: d.rec().culprit }), d.suspectCard(d.rec().culprit));
  d.run('interrogate', [sc, d.byDef('focus')[0]]);
  var motive = d.byLabel(/^Motive/)[0];
  assert.ok(motive, 'a gentle interview gives the motive');
  // Full proof wants Word behind the coin: the neighbour's deposition.
  var w = d.byDef('witness')[0];
  assert.ok(w && w.data.knows, 'the canvass gives the neighbour');
  d.run('interrogate', [w, d.byDef('focus')[0]]);
  var dep = d.byLabel(/^Deposition/)[0];
  assert.ok(dep && dep.data.stake, 'a deposition with a stake');
  d.run('investigate', [kase]);
  assert.notStrictEqual(e.assessCharge(sc, [pawned, d.byLabel(/Inventory/)[0], motive, d.byLabel(/The Hours/)[0]]).tier, 'strong', 'coin and hours without a witness are half proof');
  d.charge([pawned, dep, motive, d.byLabel(/The Hours/)[0]]);
  console.log('money route: convicted\n  ' + d.log.join('\n  '));
})();

// ---- Once the script is spent, the generic rules take over ---------------------
(function fallthrough() {
  var d = fresh(5), e = d.e;
  var kase = d.byDef('case')[0];
  d.run('investigate', [kase]);
  d.run('investigate', [kase]);
  var n = d.byDef('clue').length + d.byDef('evidence').length;
  d.run('investigate', [kase]);
  assert.ok(d.byDef('clue').length + d.byDef('evidence').length > n, 'the generic search still draws from the scene pool');
  assert.strictEqual(e.verb('investigate').recipe, 'inv_search');
  console.log('fallthrough: ok');
})();

// ---- The poisoning: the Needle, the Book, the Jointure ----------------------------
// Three threads leave the supper table. Any two convict before a Bailiff.
function poisoned(seed) {
  var d = new Detective(seed), e = d.e;
  e.s.rank = 2; e.s.flags.marketOpen = true;
  // The burglary leaves the desk; the poisoning takes it.
  d.byDef('case').forEach(function (c) { e.goCold(c.caseId); });
  e.s.meters.pressure = 0; e.s.meters.retaliation = 0;
  d.byDef('atlarge').forEach(function (c) { e.remove(c); });
  var kase = e.spawnCase('poison', { quiet: true, lifetime: 900 });
  d.rec0 = e.caseRec(kase.caseId);
  d.rec0.charge = { forensic: 4, motive: 2, financial: 1 }; // what a Bailiff's Court asks of a poisoning
  d.kase = kase;
  d.give('kit'); d.give('labpass');
  var out = d.run('investigate', [kase]);
  assert.strictEqual(e.verb('investigate').recipe || 'lead_poison_scene', 'lead_poison_scene');
  assert.ok(out.some(function (c) { return /Supper Cup/.test(e.labelOf(c)); }), 'the scene gives the cup');
  assert.ok(out.some(function (c) { return /The Settlement/.test(e.labelOf(c)); }), 'and the settlement');
  assert.ok(d.byLabel(/Physician's Note/).length, 'and the physician\'s note');
  assert.ok(d.byDef('suspect').length >= 1, 'a first name on the board');
  return d;
}
function needle(d) {
  var e = d.e;
  var cup = d.byLabel(/Supper Cup/)[0];
  var read = d.run('analyze', [cup, d.byDef('kit')[0]]);
  var tok = read.filter(function (c) { return /Needle Blackens/.test(e.labelOf(c)); })[0];
  assert.ok(tok && CF.clueAspects(tok).forensic >= 3, 'the needle blackens: ' + read.map(function (c) { return e.labelOf(c); }));
  assert.ok(!d.byLabel(/Supper Cup/).length, 'the cup was used up');
  return tok;
}
function book(d) {
  var e = d.e, rec = d.rec();
  var district = d.cards(function (c) { return c.def === 'district' && c.data.district === rec.district; })[0];
  assert.ok(district, 'the scene hands you its quarter');
  d.run('investigate', [d.kase, district]);
  var w = d.byDef('witness')[0];
  assert.ok(w && w.data.knows && /apothecary's boy/.test(w.desc), 'the apothecary\'s boy saw who bought what: ' + (w && w.desc));
  var bk = d.byLabel(/Poison Book/)[0];
  assert.ok(bk, 'the canvass turns up the poison book');
  // Half a name matches nobody until there is somebody to hold it against.
  rec.suspects.forEach(function (x) { x.revealed = false; });
  d.byDef('suspect').forEach(function (c) { e.remove(c); });
  var none = d.run('analyze', [bk, d.byDef('labpass')[0]]);
  assert.ok(none.indexOf(bk) >= 0 && e.verb('analyze').recipe === 'lead_poison_leaf_nomatch', 'the book comes back unread');
  e.revealSuspect(rec, null, { key: rec.culprit });
  var leaf = d.run('analyze', [d.byLabel(/Poison Book/)[0], d.byDef('labpass')[0]]);
  var tok = leaf.filter(function (c) { return /Name on the Leaf/.test(e.labelOf(c)); })[0];
  assert.ok(tok && tok.data.points === rec.culprit, 'the leaf names the culprit');
  assert.ok(!d.byLabel(/Poison Book/).length, 'the book was used up');
  return tok;
}
function jointure(d) {
  var e = d.e;
  var read = d.run('analyze', [d.byLabel(/The Settlement/)[0]]);
  var tok = read.filter(function (c) { return /Jointure Read/.test(e.labelOf(c)); })[0];
  assert.ok(tok && CF.clueAspects(tok).financial >= 2, 'the jointure read');
  return tok;
}
(function needleAndBook() {
  var d = poisoned(41), e = d.e;
  var n = needle(d), b = book(d);
  d.run('investigate', [d.kase]); // the kitchen
  var dish = d.byLabel(/^The Pears$/)[0];
  assert.ok(dish && CF.clueAspects(dish).opportunity >= 2, 'the dish nobody else had');
  d.charge([n, b, dish, d.byLabel(/Physician's Note/)[0]]);
  console.log('poison, the Needle and the Book: convicted\n  ' + d.log.join('\n  '));
})();
(function needleAndJointure() {
  var d = poisoned(43), e = d.e;
  var n = needle(d), j = jointure(d);
  d.run('investigate', [d.kase, d.byDef('focus')[0]]); // the kitchen maid
  var who = d.byLabel(/^The Table$/)[0];
  assert.ok(who && who.data.trait === d.rec().suspects.filter(function (x) { return x.guilty; })[0].trait, 'the maid describes the culprit');
  // The jointure beside the physician's note: who profits. Coin with a reason behind it.
  d.run('reflect', [j, d.byLabel(/Physician's Note/)[0]]);
  var theory = d.byLabel(/Who Profits/)[0];
  assert.ok(theory && theory.data.corroborated, 'the coin and the note make a theory');
  d.charge([n, theory, who]);
  console.log('poison, the Needle and the Jointure: convicted\n  ' + d.log.join('\n  '));
})();
(function bookAndJointure() {
  var d = poisoned(47), e = d.e;
  var b = book(d), j = jointure(d);
  d.run('investigate', [d.kase, d.byDef('focus')[0]]); // the kitchen maid
  var who = d.byLabel(/^The Table$/)[0];
  assert.ok(who, 'the maid talks');
  d.charge([b, j, who, d.byLabel(/Physician's Note/)[0]]);
  console.log('poison, the Book and the Jointure: convicted\n  ' + d.log.join('\n  '));
})();

// The first examination is no oracle: from a Sworn Examiner's cases an innocent may give a reason
// first and a culprit their story first, so the kind of answer does not name the guilty. At rank 0
// the early cases stay easy: the innocent's word clears them and the culprit has a reason.
(function firstAnswer() {
  var innocentMotive = 0, culpritAlibi = 0, matched = 0, seen = 0;
  function first(seed, rank) {
    var e = CF.Engine.newGame({ seed: seed, calling: 'master' });
    e.s.rank = rank;
    if (e.s.intro) e.s.intro.finished = true;
    e.s.verbs.interrogate.unlocked = true;
    var kase = e.tableCards().filter(function (c) { return c.def === 'case'; })[0];
    var rec = e.caseRec(kase.caseId);
    var res = [];
    rec.suspects.forEach(function (sus) {
      var sc = e.revealSuspect(rec, null, { key: sus.key });
      if (!sc) return;
      e.tableCards().filter(function (c) { return c.def === 'focus' || c.def === 'spent_focus'; }).forEach(function (c) { e.remove(c); });
      var wit = e.create('focus');
      assert.ok(e.autoSlot('interrogate', sc.uid) && e.autoSlot('interrogate', wit.uid));
      assert.strictEqual(e.currentRecipe('interrogate').recipe.id, 'int_suspect');
      assert.ok(e.start('interrogate'));
      e.tick(e.verb('interrogate').duration + 0.01);
      var v = e.verb('interrogate');
      var out = v.out.map(function (u) { return e.card(u); }).filter(function (c) { return c.def === 'clue'; });
      var title = v.story ? v.story.title : '';
      e.collect('interrogate');
      var kind = out.some(function (c) { return c.data.alibi; }) ? 'alibi' : out.some(function (c) { return /^Motive: /.test(c.label); }) ? 'motive' : /^Cleared/.test(title) ? 'cleared' : 'other';
      res.push({ guilty: sus.guilty, kind: kind });
    });
    return res;
  }
  for (var seed = 0; seed < 40; seed++) {
    first(3000 + seed, 1).forEach(function (r) {
      seen++;
      if (!r.guilty && r.kind === 'motive') innocentMotive++;
      if (r.guilty && r.kind === 'alibi') culpritAlibi++;
      if ((r.guilty && r.kind === 'motive') || (!r.guilty && r.kind === 'alibi')) matched++;
    });
  }
  assert.ok(innocentMotive >= 5, 'an innocent sometimes gives a reason first: ' + innocentMotive + ' of ' + seen);
  assert.ok(culpritAlibi >= 5, 'a culprit sometimes gives a story first: ' + culpritAlibi + ' of ' + seen);
  assert.ok(matched < seen, 'the kind of answer does not match guilt every time');
  // Rank 0: as before.
  for (var s0 = 0; s0 < 10; s0++) first(3100 + s0, 0).forEach(function (r) {
    if (r.guilty) assert.strictEqual(r.kind, 'motive', 'at rank 0 the culprit gives a reason');
    else assert.ok(r.kind === 'cleared' || r.kind === 'other', 'at rank 0 the innocent is taken at their word: ' + r.kind);
  });
  console.log('first examination: innocent reasons ' + innocentMotive + ', culprit stories ' + culpritAlibi + ' of ' + seen + ': ok');
})();

// ---- A dry scene says so, and a strain card never waits without Rest ----------
(function dryAndRest() {
  var e = CF.Engine.newGame({ seed: 61, calling: 'master' });
  var rec = e.caseRec(e.spawnCase('arson', { quiet: true }).caseId), card = e.caseCard(rec.id);
  var d = e.giveDistrict(rec.district);
  e.autoSlot('investigate', card.uid); e.autoSlot('investigate', d.uid);
  assert.strictEqual(e.currentRecipe('investigate').recipe.id, 'inv_canvass');
  var pv = e.preview('investigate');
  assert.ok(!pv.danger && /^Door to door/.test(pv.text), 'a fresh Quarter: ' + JSON.stringify(pv));
  e.clearSlots('investigate');
  rec.witnesses = [];
  rec.suspects.forEach(function (x) { x.revealed = true; });
  assert.ok(e.trailFor(rec).canvassedOut, 'every door knocked');
  e.autoSlot('investigate', card.uid); e.autoSlot('investigate', d.uid);
  pv = e.preview('investigate');
  assert.strictEqual(pv.danger, 'Obsession +1');
  assert.ok(/has been knocked\. Another round only feeds your Obsession\.$/.test(pv.text), pv.text);
  e.clearSlots('investigate');
  // The opening locks Rest until the hire; Weariness or Obsession before it opens it.
  ['fatigue', 'obsession'].forEach(function (def) {
    var o = CF.Engine.newGame({ seed: 62, who: 'clerk', name: 'Strain', opening: true, guided: true });
    assert.ok(!o.verb('reflect').unlocked, 'Rest is shut on the first morning');
    o.create(def);
    o.tick(0.1);
    assert.ok(o.verb('reflect').unlocked, def + ' opens Rest, its cure');
  });
  console.log('dry Quarter and Rest with its strain: ok');
})();

// ---- The case clock runs in a verb's outputs; a verb with nothing left in it is free ---
(function caseClockAndEmptyVerb() {
  var d = fresh(11), e = d.e;
  var kase = d.byDef('case')[0];
  var vid = 'investigate';
  assert.ok(e.autoSlot(vid, kase.uid));
  assert.ok(e.start(vid), vid + ' starts on the case');
  var v = e.verb(vid), guard = 0;
  while (v.status === 'running' && guard++ < 400) e.tick(1);
  assert.strictEqual(v.status, 'done');
  assert.ok(kase.loc.t === 'out' && kase.loc.verb === vid, 'the case waits among the outputs');
  var finds = v.out.map(function (u) { return e.card(u); }).filter(function (c) { return c.def !== 'case' && c.life != null; });
  var life0 = kase.life, finds0 = finds.map(function (c) { return c.life; });
  e.tick(20);
  assert.ok(kase.life < life0 - 19, 'the case\'s clock runs where it sits: ' + life0 + ' -> ' + kase.life);
  finds.forEach(function (c, i) { assert.strictEqual(c.life, finds0[i], 'a find waits to be seen'); });
  // Everything taken from the outputs some other way (spent, paid at the Bell): the verb is idle, not Ready and empty.
  v.out.slice().forEach(function (u) { e.remove(e.card(u)); });
  assert.strictEqual(v.status, 'idle', 'the last output gone, the verb is free');
  assert.strictEqual(v.story, null);
  // Coin among Attend's outputs, paid at the Bell.
  var d2 = new Detective(8), e2 = d2.e, coin = d2.byDef('funds')[0];
  var vbId = Object.keys(e2.s.verbs).filter(function (k) { return e2.s.verbs[k].status === 'idle'; })[0], vb = e2.s.verbs[vbId];
  e2.detach(coin);
  coin.loc = { t: 'out', verb: vbId };
  vb.out.push(coin.uid); vb.status = 'done'; vb.story = { title: 'x', text: '' };
  d2.byDef('funds').forEach(function (c) { e2.remove(c); });
  e2.s.flags.uprightPaid = null;
  assert.ok(e2.dues() <= 1, 'one Coin pays the dues');
  e2.weekTick();
  assert.ok(!e2.card(coin.uid), 'the Coin went to the dues');
  assert.ok(!(vb.status === 'done' && !vb.out.length), 'the verb is not left Ready and empty');
  console.log('case clock in the outputs, empty verb freed: ok');
})();
