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
  assert.strictEqual(d.rec().structure, 'rear_window', 'this house was broken into');
  var out = d.run('investigate', [kase]);
  assert.ok(out.some(function (c) { return /Forced Frame/.test(e.labelOf(c)); }), 'the scene gives the forced way in');
  assert.ok(out.some(function (c) { return /Inventory/.test(e.labelOf(c)); }), 'and the inventory');
  var told = e.s.journal.filter(function (j) { return j.title === 'At the Scene'; })[0].text;
  assert.ok(told.indexOf('They came in by ' + d.rec().vars.entry) >= 0, 'the scene names the way in the brief gave: ' + told);
  assert.ok(d.byDef('suspect').length >= 1, 'a first suspect');
  var toolmark = d.run('analyze', [d.byLabel(/Forced Frame/)[0], d.byDef('kit')[0]]);
  assert.strictEqual(e.labelOf(toolmark[0]), 'The Blade Read');
  assert.ok(!d.byLabel(/Forced Frame/).length, 'the raw proof was consumed');
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

// ---- The way in follows the structure: a house opened with a key shows no forcing --
(function keyedEntry() {
  [7, 8].forEach(function (seed) {
    var d = fresh(seed), e = d.e, rec = d.rec();
    assert.ok(['inside_key', 'quiet_safe'].indexOf(rec.structure) >= 0, 'seed ' + seed + ' was opened, not forced: ' + rec.structure);
    d.give('kit');
    var kase = d.byDef('case')[0];
    var out = d.run('investigate', [kase]);
    var story = e.s.journal.filter(function (j) { return j.title === 'At the Scene'; })[0];
    assert.strictEqual(e.verb('investigate').recipe, 'lead_burglary_scene_key');
    assert.ok(!/forced with|shutter/i.test(story.text) && /Nothing at .* was forced/.test(story.text), 'no forced shutter in a house opened with a key: ' + story.text);
    assert.ok(out.some(function (c) { return e.labelOf(c) === 'The Lock Unmarked'; }) && !out.some(function (c) { return /Forced Frame/.test(e.labelOf(c)); }), 'the lock, not a forced frame');
    assert.ok(rec.leads.scene && rec.leads.scene_key, 'the keyed scene stands in for the scene');
    // The forced search never follows it, and the leads after the scene open.
    kase = d.byDef('case')[0];
    e.autoSlot('investigate', kase.uid);
    assert.ok(['lead_burglary_scene', 'lead_burglary_scene_key'].indexOf(e.currentRecipe('investigate').recipe.id) < 0, 'searched once');
    e.clearSlots('investigate');
    var wards = d.run('analyze', [d.byLabel(/Lock Unmarked/)[0], d.byDef('kit')[0]]);
    assert.strictEqual(e.labelOf(wards[0]), 'The Wards Read');
    assert.strictEqual(e.verb('analyze').recipe, 'lead_burglary_wards');
    var hours = d.run('investigate', [d.byDef('case')[0]]);
    var h = hours.filter(function (c) { return /The Hours/.test(e.labelOf(c)); })[0];
    assert.ok(h && h.desc.indexOf('come in by ' + rec.vars.entry) >= 0 && !/shutter/.test(h.desc), 'the hours name the same way in: ' + (h && h.desc));
  });
  // A burglary from before the structures still searches as it was written.
  var o = fresh(11), orec = o.rec();
  orec.structure = null; delete orec.vars.entry;
  var oo = o.run('investigate', [o.byDef('case')[0]]);
  assert.ok(oo.some(function (c) { return /Forced Frame/.test(o.e.labelOf(c)); }) && /by the back shutter/.test(o.e.s.journal.filter(function (j) { return j.title === 'At the Scene'; })[0].text), 'an old case keeps its shutter');
  console.log('keyed entry: the lock, the wards and the hours agree with the brief');
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
  // A crime with no written leads: the Quarter goes door to door at once.
  var rec = e.caseRec(e.spawnCase('fraud', { quiet: true }).caseId), card = e.caseCard(rec.id);
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

// ---- The Vanished: a written thread to Writ without the Apothecary, and the twist ----------
(function vanished() {
  var d = new Detective(5), e = d.e;
  e.s.rank = 1; e.s.flags.marketOpen = true;
  var rec = d.rec0 = e.caseRec(e.spawnCase('missing', { quiet: true }).caseId);
  var kase = e.caseCard(rec.id);
  assert.ok(!e.s.rooms.lab, 'no Apothecary');
  // The Ferryman's Book: the case with the Harbour's Quarter.
  d.run('investigate', [kase]);
  var harbour = e.giveDistrict('docks');
  assert.strictEqual((e.autoSlot('investigate', kase.uid), e.autoSlot('investigate', harbour.uid), e.currentRecipe('investigate').recipe.id), 'lead_missing_ferry');
  e.clearSlots('investigate');
  d.run('investigate', [kase, harbour]);
  var ferry = d.byLabel(/^Crossed at Dusk$/)[0];
  assert.ok(ferry && CF.clueAspects(ferry).digital === 2, 'the ferry gives Writ 2');
  // The Parish Register: the case with Wit, once the scene is searched.
  d.run('investigate', [kase, d.give('focus')]);
  var banns = d.byLabel(/^The Banns Struck$/)[0];
  assert.ok(banns && CF.clueAspects(banns).digital === 1 && CF.clueAspects(banns).motive === 1, 'the register gives Writ and Motive');
  // A witness from the Quarter, and their word.
  var home = d.cards(function (c) { return c.def === 'district' && c.data.district === rec.district; })[0] || e.giveDistrict(rec.district);
  d.run('investigate', [kase, home]);
  var w = d.cards(function (c) { return c.def === 'witness' && c.caseId === rec.id; })[0];
  assert.ok(w, 'a witness from door to door');
  d.run('interrogate', [w, d.give('focus')]);
  var dep = d.byLabel(/^Deposition: /)[0];
  assert.ok(dep && /^The witness says: "/.test(e.descOf(dep)) && e.descOf(dep).indexOf('(') < 0, 'the deposition is the witness\'s words; the stake is the dossier\'s own line');
  // Without the cellars (they are dead in this one, or not found), Instinct searches as ever.
  rec.alive = false;
  var ins = d.give('instinct');
  e.autoSlot('investigate', kase.uid); e.autoSlot('investigate', ins.uid);
  assert.notStrictEqual(e.currentRecipe('investigate').recipe.id, 'lead_missing_cellars', 'the cellars never open on a victim who is dead');
  e.clearSlots('investigate'); e.remove(ins);
  // A fourth token from the scene, then the charge: Writ from the ferry, not the Apothecary.
  var sc5 = d.suspectCard(rec.culprit);
  if (!sc5) { e.revealSuspect(rec, null, { key: rec.culprit }); sc5 = d.suspectCard(rec.culprit); }
  var fourth = d.cards(function (c) { return c.def === 'clue' && c.caseId === rec.id && [ferry, dep, banns].indexOf(c) < 0 && e.assessCharge(sc5, [ferry, dep, banns, c]).tier === 'strong'; })[0];
  assert.ok(fourth, 'a fourth token from the scene makes it full proof');
  var a = d.charge([ferry, dep, banns, fourth]);
  assert.ok(a.have.digital >= 2, 'Writ from the ferry and the register');
  console.log('the Vanished by the ferry: ok (' + d.log.slice(-6).map(function (l) { return l.split(' -> ')[0]; }).join('; ') + ')');

  // The twist: alive, behind a cellar door, after both threads.
  var d2 = new Detective(9), e2 = d2.e;
  e2.s.rank = 1; e2.s.flags.marketOpen = true;
  var r2 = d2.rec0 = e2.caseRec(e2.spawnCase('missing', { quiet: true }).caseId);
  r2.alive = true;
  var k2 = e2.caseCard(r2.id);
  d2.run('investigate', [k2]);
  d2.run('investigate', [k2, e2.giveDistrict('docks')]);
  d2.run('investigate', [k2, d2.give('focus')]);
  d2.run('investigate', [k2, d2.give('instinct')]);
  assert.ok(r2.foundAlive, 'found alive');
  var vic = d2.cards(function (c) { return c.def === 'witness' && c.data.victim; })[0];
  assert.ok(vic && vic.label === 'Witness: ' + r2.victim && vic.data.stake === 'none' && vic.data.knows, 'the Vanished is a witness with nothing to gain');
  assert.ok(d2.suspectCard(r2.culprit), 'and the one who took them is in the casebook');
  d2.run('interrogate', [vic, d2.give('focus')]);
  var vd = d2.byLabel(/^Deposition: /)[0];
  assert.ok(vd.data.points === r2.culprit && vd.data.againstInterest, 'their word names the culprit, and counts double');
  assert.strictEqual(e2.convictedOf(r2), 'the abduction of ' + r2.victim, 'the charge is the lesser crime');
  // An older save: every Vanished as dead as it was written.
  var old = JSON.parse(e2.save());
  delete old.cases[r2.id].alive; delete old.cases[r2.id].foundAlive;
  var l = CF.Engine.load(old);
  assert.ok(l.caseRec(r2.id).alive === false && l.caseRec(r2.id).foundAlive === false, 'an older save loads with nobody alive');
  // Only where they left or never got home, about one in four.
  var alive = 0, wrong = 0;
  for (var i = 0; i < 80; i++) {
    var g = CF.Engine.newGame({ seed: 500 + i, calling: 'master' });
    var gr = g.caseRec(g.spawnCase('missing', { quiet: true }).caseId);
    if (gr.alive) { alive++; if (gr.structure === 'walked_out') wrong++; }
  }
  assert.ok(alive > 5 && alive < 30 && !wrong, 'alive in ' + alive + ' of 80, never where they walked out');
  console.log('the Vanished alive: ok (' + alive + ' of 80)');
})();

// ---- The first crimes are written cases too: coining, protection, fire ---------------
// Each has three threads; any two make a full proof before an Examiner's Court.
function written(seed, tid, tools) {
  var d = new Detective(seed), e = d.e;
  e.s.flags.marketOpen = true;
  d.byDef('case').forEach(function (c) { e.goCold(c.caseId); });
  e.s.meters.pressure = 0; e.s.meters.retaliation = 0;
  d.byDef('atlarge').forEach(function (c) { e.remove(c); });
  var kase = e.spawnCase(tid, { quiet: true, lifetime: 900 });
  d.rec0 = e.caseRec(kase.caseId);
  d.kase = kase;
  (tools || []).forEach(function (t) { d.give(t); });
  var out = d.run('investigate', [kase]);
  assert.strictEqual(e.verb('investigate').recipe, 'lead_' + tid + '_scene', tid + ': the scene is written');
  d.found = out;
  return d;
}
function tok(d, re) { var c = d.byLabel(re)[0]; assert.ok(c, 'no token ' + re + ' among ' + d.e.tableCards().map(function (x) { return d.e.labelOf(x); }).join(', ')); return c; }
function named(d) { var rec = d.rec(); if (!d.suspectCard(rec.culprit)) d.e.revealSuspect(rec, null, { key: rec.culprit }); }
function deposition(d) {
  var e = d.e, w = d.cards(function (c) { return c.def === 'witness' && c.caseId === d.rec().id && c.data.knows; })[0];
  assert.ok(w, 'a witness who saw');
  d.run('interrogate', [w, d.byDef('focus')[0] || d.give('focus')]);
  return tok(d, /^Deposition/);
}
function homeQuarter(d) { var rec = d.rec(); return d.cards(function (c) { return c.def === 'district' && c.data.district === rec.district; })[0] || d.e.giveDistrict(rec.district); }

// Coining: the Coin (assayed with the kit, or weighed without it), the Charcoal, the Market.
function coinAssayed(d) { var r = d.run('analyze', [tok(d, /^The Bad Coin$/), d.byDef('kit')[0]]); var t = r.filter(function (c) { return /Coin Assayed/.test(d.e.labelOf(c)); })[0]; assert.ok(t && CF.clueAspects(t).forensic === 3, 'the acid finds lead'); return t; }
function coinWeighed(d) {
  var r = d.run('analyze', [tok(d, /^The Bad Coin$/)]);
  assert.strictEqual(d.e.verb('analyze').recipe, 'lead_coining_weigh', 'without the kit, the scale');
  var t = r.filter(function (c) { return /^Short Weight$/.test(d.e.labelOf(c)); })[0];
  assert.ok(t && CF.clueAspects(t).financial === 2 && CF.clueAspects(t).digital === 1, 'a grain and a half light');
  return t;
}
function charcoal(d) {
  d.run('investigate', [d.kase]);
  assert.strictEqual(d.e.verb('investigate').recipe, 'lead_coining_charcoal');
  var t = tok(d, /^Sacks After Curfew$/);
  assert.ok(CF.clueAspects(t).opportunity === 2 && /kindling boy/.test(d.cards(function (c) { return c.def === 'witness' && c.caseId === d.rec().id; })[0].desc), 'the boy and his sacks');
  return t;
}
function thumb(d, re, recipe) {
  d.run('investigate', [d.kase, homeQuarter(d)]);
  named(d);
  var r = d.run('analyze', [tok(d, re), d.byDef('prints')[0]]);
  assert.strictEqual(d.e.verb('analyze').recipe, recipe);
  var t = r.filter(function (c) { return c.data && c.data.points === d.rec().culprit; })[0];
  assert.ok(t && CF.clueAspects(t).forensic === 3, 'the thumb names the culprit');
  return t;
}
(function coiningCoinAndMould() {
  var d = written(71, 'coining', ['kit', 'prints']);
  assert.ok(d.found.some(function (c) { return /Bad Coin/.test(d.e.labelOf(c)); }) && d.byLabel(/^Who Paid It In$/).length, 'the takings give the coin and the slate');
  var a = coinAssayed(d), m = thumb(d, /^A Plaster Mould$/, 'lead_coining_clippings');
  d.charge([a, m, tok(d, /^Who Paid It In$/)]);
  console.log('coining, the Coin and the Mould: convicted');
})();
(function coiningMouldAndCharcoal() {
  var d = written(73, 'coining', ['prints']);
  var s = charcoal(d), m = thumb(d, /^A Plaster Mould$/, 'lead_coining_clippings');
  d.charge([m, s, tok(d, /^Who Paid It In$/)]);
  console.log('coining, the Mould and the Charcoal: convicted');
})();
(function coiningCoinAndCharcoal() {
  var d = written(79, 'coining', []);
  var w = coinWeighed(d), s = charcoal(d), dep = deposition(d);
  d.charge([w, s, dep]);
  console.log('coining, the Coin weighed and the Charcoal: convicted');
})();

// Protection: the Collector's Round, the Cookshop, the Hand on the Letter.
function purse(d) {
  var r = d.run('analyze', [tok(d, /^The Collector's Round$/)]);
  assert.strictEqual(d.e.verb('analyze').recipe, 'lead_extortion_round');
  var t = r.filter(function (c) { return /^Whose Purse It Fills$/.test(d.e.labelOf(c)); })[0];
  assert.ok(t && t.data.trait === d.rec().suspects.filter(function (x) { return x.guilty; })[0].trait, 'the purse-bearer is described');
  return t;
}
function cookshop(d) {
  d.run('investigate', [d.kase]);
  assert.strictEqual(d.e.verb('investigate').recipe, 'lead_extortion_cookshop');
  return tok(d, /^The Cookshop Count$/);
}
(function extortionRoundAndCookshop() {
  var d = written(81, 'extortion', []);
  assert.ok(d.byLabel(/^A Threatening Letter$/).length, 'the stall gives the letter');
  var p = purse(d), c = cookshop(d), dep = deposition(d);
  d.charge([p, c, dep]);
  console.log('protection, the Round and the Cookshop: convicted');
})();
(function extortionRoundAndHand() {
  var d = written(83, 'extortion', ['prints']);
  var p = purse(d), h = thumb(d, /^A Threatening Letter$/, 'lead_extortion_hand');
  d.charge([p, h]);
  console.log('protection, the Round and the Hand: convicted');
})();
(function extortionHandAndCookshop() {
  var d = written(87, 'extortion', ['prints']);
  var c = cookshop(d), dep = deposition(d), h = thumb(d, /^A Threatening Letter$/, 'lead_extortion_hand');
  d.charge([h, c, dep]);
  console.log('protection, the Hand and the Cookshop: convicted');
})();

// Fire: the Fire-warden's Count and the oil, the Lender on the Hill, the Bucket-chain.
function oil(d) {
  var r = d.run('analyze', [tok(d, /^The Smell Under the Smoke$/), d.byDef('kit')[0]]);
  assert.strictEqual(d.e.verb('analyze').recipe, 'lead_arson_oil');
  var t = r.filter(function (c) { return /^The Chandler's Book$/.test(d.e.labelOf(c)); })[0];
  assert.ok(t && CF.clueAspects(t).forensic === 2 && t.data.trait, 'the chandler remembers the buyer');
  return t;
}
function buckets(d) {
  d.run('investigate', [d.kase]);
  assert.strictEqual(d.e.verb('investigate').recipe, 'lead_arson_buckets');
  return tok(d, /^The Side Door$/);
}
function lender(d) {
  d.run('investigate', [d.kase, d.byDef('focus')[0] || d.give('focus')]);
  assert.strictEqual(d.e.verb('investigate').recipe, 'lead_arson_lender');
  var r = d.run('analyze', [tok(d, /^A Bond on the Building$/)]);
  assert.strictEqual(d.e.verb('analyze').recipe, 'lead_arson_profit');
  var t = r.filter(function (c) { return /^Who Profits by the Fire$/.test(d.e.labelOf(c)); })[0];
  assert.ok(t && CF.clueAspects(t).financial === 2, 'the bond read');
  return t;
}
(function arsonOilAndBuckets() {
  var d = written(91, 'arson', ['kit']);
  assert.ok(d.byLabel(/^The Fire-warden's Count$/).length, 'three seats of fire');
  var o = oil(d), s = buckets(d), dep = deposition(d);
  d.charge([o, tok(d, /^The Fire-warden's Count$/), dep, s]);
  console.log('fire, the Count and the Bucket-chain: convicted');
})();
(function arsonOilAndLender() {
  var d = written(93, 'arson', ['kit']);
  var o = oil(d), l = lender(d);
  d.charge([o, l, tok(d, /^The Fire-warden's Count$/)]);
  console.log('fire, the Count and the Lender: convicted');
})();
(function arsonLenderAndBuckets() {
  var d = written(97, 'arson', []);
  var s = buckets(d), dep = deposition(d), l = lender(d);
  d.charge([l, s, dep]);
  console.log('fire, the Lender and the Bucket-chain: convicted');
})();
