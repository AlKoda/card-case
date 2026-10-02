// Part II, Phase B: the law of proof (docs/CITY.md §4–5). Witnesses carry
// a stake; the Fingerpost rule decides what two of them prove; the question
// always gets a confession and only the guilty confess the truth; on half
// proof the Court convicts of the lesser crime; a frightened city shuts its
// doors, and at ten Dread the crowd turns.
// Run: node tests/court.test.js
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
function run(e, verb, cards) {
  cards.forEach(function (c) { assert.ok(e.autoSlot(verb, c.uid), verb + ' refused ' + e.labelOf(c)); });
  var pv = e.preview(verb);
  assert.ok(pv && !pv.blocked, verb + ' blocked: ' + (pv && pv.blocked));
  assert.ok(e.start(verb));
  e.tick(e.verb(verb).duration + 0.01);
  var v = e.verb(verb), out = v.out.map(function (u) { return e.card(u); }), story = v.story;
  if (v.status === 'done') e.collect(verb);
  return { out: out, story: story, preview: pv, recipe: v.recipe };
}
function setup(seed) {
  var e = game(seed);
  var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
  var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
  var innocent = rec.suspects.filter(function (x) { return !x.guilty; })[0];
  return { e: e, kase: kase, rec: rec, culprit: culprit, innocent: innocent,
    scG: e.revealSuspect(rec, null, { key: culprit.key }), scI: e.revealSuspect(rec, null, { key: innocent.key }) };
}

// ---- Witnesses have a stake, and their depositions carry it -----------------
(function stakes() {
  var g = setup(11), e = g.e;
  var w = e.create('witness', e.witnessSpec(g.rec));
  assert.ok(CF.STAKES[w.data.stake], 'a witness has a stake: ' + w.data.stake);
  assert.ok(/, and /.test(w.desc), 'the dossier says why they talk');
  w.data.stake = 'loves'; w.data.knows = true;
  var r = run(e, 'interrogate', [w, byDef(e, 'focus')[0]]);
  var dep = r.out.filter(function (c) { return /^Deposition/.test(e.labelOf(c)); })[0];
  assert.ok(dep, 'a deposition');
  assert.strictEqual(dep.data.stake, 'loves');
  assert.strictEqual(dep.data.againstInterest, true, 'a witness fond of the accused who names them speaks against interest');
  assert.ok(!dep.data.coerced);
  // Beaten out of them: not credible, and the quarter is frightened.
  var w2 = e.create('witness', e.witnessSpec(g.rec));
  w2.data.stake = 'reward';
  var dread0 = e.s.meters.dread;
  var r2 = run(e, 'interrogate', [w2, byDef(e, 'health')[0]]);
  var dep2 = r2.out.filter(function (c) { return /^Deposition/.test(e.labelOf(c)); })[0];
  assert.ok(dep2 && dep2.data.coerced && dep2.data.stake === 'reward');
  assert.strictEqual(e.s.meters.dread, dread0 + 1, 'a beaten witness: Dread +1');
  console.log('stakes: ok');
})();

// ---- The Fingerpost rule ----------------------------------------------------
(function fingerpost() {
  var g = setup(3), e = g.e;
  function dep(stake, extra) { return e.make('clue', { caseId: g.rec.id, aspects: { testimony: 2, opportunity: 1 }, data: Object.assign({ stake: stake, trait: g.culprit.trait }, extra || {}) }); }
  var agree = e.assessCharge(g.scG, [dep('reward'), dep('hates')]);
  assert.ok(agree.fingerpost, 'two witnesses with different stakes establish a fact');
  assert.strictEqual(agree.tier, 'strong', 'two credible witnesses are full proof: ' + agree.score);
  var same = e.assessCharge(g.scG, [dep('reward'), dep('reward')]);
  assert.ok(same.sameStake && !same.fingerpost, 'two witnesses who want the same thing');
  assert.notStrictEqual(same.tier, 'strong');
  assert.ok(same.score < agree.score, 'and they count for less: ' + same.score + ' < ' + agree.score);
  var beaten = e.assessCharge(g.scG, [dep('reward'), dep('hates', { coerced: true })]);
  assert.ok(!beaten.fingerpost, 'a beaten witness is not credible, so does not corroborate');
  var against = e.assessCharge(g.scG, [dep('kin', { againstInterest: true })]);
  assert.strictEqual(against.againstInterest, 1);
  assert.ok(against.score > e.assessCharge(g.scG, [dep('kin')]).score, 'against interest counts extra');
  var d = CF.Charge.describe(agree);
  assert.ok(d.notes.some(function (n) { return /different reasons/.test(n.text); }), 'the Indict window explains it');
  console.log('fingerpost: ok');
})();

// ---- Full proof wants Word: the scene alone is half proof -----------------------
(function sceneOnly() {
  var g = setup(9), e = g.e;
  function tok(aspects, data) { return e.make('clue', { caseId: g.rec.id, aspects: aspects, data: data || {} }); }
  var prof = CF.Charge.profileOf(g.rec), scene = Object.keys(prof).map(function (k) { var a = {}; a[k] = prof[k] + 1; return tok(a); });
  var a = e.assessCharge(g.scG, scene);
  assert.ok(a.score >= a.need && a.covered >= 2, 'the scene covers the profile: ' + a.score + '/' + a.need);
  assert.strictEqual(a.tier, 'reasonable', 'a scene-only charge is half proof');
  assert.strictEqual(e.assessCharge(g.scG, scene.slice(0, 2).concat([tok({ testimony: 2 }, { stake: 'reward', trait: g.culprit.trait })])).tier, 'strong', 'one witness makes it full');
  assert.strictEqual(e.assessCharge(g.scG, scene.slice(0, 2).concat([tok({ opportunity: 2 }, { points: g.culprit.key })])).tier, 'strong', 'a token that names them makes it full');
  console.log('scene only: ok');
})();

// ---- An alibi is a token to check, not a verdict -----------------------------------
(function alibi() {
  // An Examiner takes the story at its word: the name is struck, and no token is left for a charge to trip on.
  var g0 = setup(31), e0 = g0.e;
  assert.strictEqual(e0.s.rank, 0);
  var r0 = run(e0, 'interrogate', [g0.scI, e0.create('focus')]);
  assert.ok(/^Cleared: /.test(r0.story.title) && g0.innocent.cleared, 'cleared at rank 0: ' + r0.story.title);
  assert.ok(!r0.out.some(function (c) { return c.data.alibi; }) && !byDef(e0, 'clue').some(function (c) { return c.data.alibi; }), 'no Alibi token at rank 0');
  var g = setup(31), e = g.e;
  e.s.rank = 1;
  // The hours in the Hole tire you; a long night of questions needs sleep between.
  function rested() { byDef(e, 'fatigue').concat(byDef(e, 'burnout')).forEach(function (c) { e.remove(c); }); }
  // From rank 1 an innocent may give their own reason first (it is about them, and names nobody else);
  // the story comes on the next examination.
  var r = run(e, 'interrogate', [g.scI, e.create('focus')]);
  if (!r.out.some(function (c) { return c.data.alibi; })) {
    var why = r.out.filter(function (c) { return /^Motive: /.test(c.label); })[0];
    assert.ok(r.story.title === 'A Reason' && why && why.data.about === g.innocent.key, 'the first answer is the alibi or their own reason: ' + r.story.title);
    rested();
    r = run(e, 'interrogate', [g.scI, e.create('focus')]);
  }
  var al = r.out.filter(function (c) { return c.data.alibi; })[0];
  assert.ok(al, 'an innocent questioned with Wit gives an alibi');
  assert.strictEqual(e.labelOf(al), 'Alibi: ' + g.innocent.name);
  assert.strictEqual(al.data.alibi, g.innocent.key);
  assert.strictEqual(al.data.trait, g.innocent.trait);
  assert.ok(CF.PROSE.alibis.some(function (t) { return al.desc.toLowerCase() === t.toLowerCase() + '.'; }), 'the story is one of the alibis: ' + al.desc);
  assert.ok(/^An Alibi$/.test(r.story.title) && r.story.text.indexOf(g.innocent.name) >= 0 && /want checking/.test(r.story.text));
  assert.ok(!g.innocent.cleared && e.card(g.scI.uid), 'not cleared yet: the name stays on the board');
  rested();
  var ra = run(e, 'interrogate', [g.scI, e.create('focus')]);
  assert.ok(ra.story.title === 'An Alibi' && !ra.out.some(function (c) { return c.data.alibi; }), 'the same story twice is one token');
  // Checked against the hours in Rest: the night is accounted for.
  var hours = e.create('clue', { label: 'The Hours', caseId: g.rec.id, aspects: { opportunity: 2 } });
  var r2 = run(e, 'reflect', [al, hours]);
  assert.strictEqual(r2.recipe, 'ref_deduce');
  assert.strictEqual(r2.story.title, 'The Night Accounted For');
  assert.ok(r2.story.text.indexOf(g.innocent.name) === 0);
  assert.ok(g.innocent.cleared, 'cleared');
  assert.ok(!e.card(g.scI.uid), 'the suspect card is gone');
  assert.ok(!e.card(al.uid) && !e.card(hours.uid), 'the tokens fold into the check');
  // The culprit has a story too, told first or when asked again; the bells do not agree.
  rested();
  var r3 = run(e, 'interrogate', [g.scG, e.create('focus')]);
  if (!r3.out.some(function (c) { return c.data.alibi; })) {
    assert.strictEqual(r3.story.title, 'A Reason', 'otherwise the reason comes first');
    rested();
    r3 = run(e, 'interrogate', [g.scG, e.create('focus')]);
  }
  var lie = r3.out.filter(function (c) { return c.data.alibi; })[0];
  assert.ok(lie && lie.data.alibi === g.culprit.key, 'the culprit gives an alibi by the second time');
  var r4 = run(e, 'reflect', [lie, e.create('clue', { label: 'The Tide', caseId: g.rec.id, aspects: { opportunity: 2 } })]);
  assert.strictEqual(r4.story.title, 'A Lie About the Night');
  var made = r4.out.filter(function (c) { return c.def === 'clue'; })[0];
  assert.ok(made && e.labelOf(made) === 'A Lie About the Night' && made.data.points === g.culprit.key && CF.clueAspects(made).opportunity === 2, 'a token against them');
  assert.ok(made.desc.indexOf(CF.PROSE.alibiLies[g.culprit.alibi]) > 0 && r4.story.text === made.desc, 'the lie answers the alibi it refutes: ' + made.desc);
  assert.ok(!g.culprit.cleared && e.card(g.scG.uid));
  rested();
  assert.ok(!run(e, 'interrogate', [g.scG, e.create('focus')]).out.some(function (c) { return c.data.alibi; }), 'the culprit\'s story is told once');
  // An Examiner's first cases take the story at its word.
  var h = setup(32), f = h.e;
  f.s.rank = 0;
  var r5 = run(f, 'interrogate', [h.scI, f.create('focus')]);
  assert.ok(/^Cleared: /.test(r5.story.title) && h.innocent.cleared && !f.card(h.scI.uid), 'cleared on the spot at rank 0');
  assert.ok(!r5.out.some(function (c) { return c.data.alibi; }), 'and no token is left for the magnet to carry into a charge');
  // A bluff on an innocent: the alibi sometimes, the shut door otherwise.
  var got = { alibi: 0, reason: 0, fail: 0 };
  for (var i = 0; i < 20; i++) {
    var k = setup(40 + i), ke = k.e;
    ke.s.rank = 1;
    var rb = run(ke, 'interrogate', [k.scI, ke.create('instinct')]);
    if (rb.out.some(function (c) { return c.data.alibi; })) got.alibi++;
    else if (rb.story.title === 'A Reason' && rb.out.some(function (c) { return c.data.about === k.innocent.key; })) got.reason++;
    else if (rb.story.title === 'Nothing Shaken Loose') got.fail++;
  }
  assert.ok(got.alibi >= 3 && got.reason >= 1 && got.fail >= 6 && got.alibi + got.reason + got.fail === 20, 'bluff: ' + JSON.stringify(got));
  console.log('alibi: ok');
})();

// ---- Evidence that promises a name delivers one --------------------------------------
(function names() {
  var e = game(41);
  var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
  var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
  var innocent = rec.suspects.filter(function (x) { return !x.guilty; })[0];
  var item = CF.GENERIC_SCENE[0];
  assert.ok(item.result.names, 'the hand on the sill promises a name');
  function evidence() { return e.create('evidence', { label: item.label, caseId: rec.id, data: { item: item } }); }
  // Nobody in the casebook yet: a hand to keep.
  var r = run(e, 'analyze', [evidence(), e.create('prints')]);
  var hand = r.out.filter(function (c) { return c.def === 'clue'; })[0];
  assert.ok(hand && hand.data.names && !hand.data.points && hand.data.trait === culprit.trait, 'a hand with no name yet');
  assert.ok(/Keep it\.$/.test(hand.desc));
  // Held against a name.
  var scI = e.revealSuspect(rec, null, { key: innocent.key }), scG = e.revealSuspect(rec, null, { key: culprit.key });
  var no = run(e, 'analyze', [hand, scI]);
  assert.strictEqual(no.recipe, 'an_hold_against');
  assert.strictEqual(no.story.title, 'No Match');
  assert.ok(hand.data.names && !hand.data.points && e.card(hand.uid) && e.card(scI.uid), 'nothing changes on no match');
  var yes = run(e, 'analyze', [hand, scG]);
  assert.strictEqual(yes.story.title, 'A Match');
  assert.ok(yes.story.text.indexOf(culprit.name) >= 0);
  assert.strictEqual(hand.data.points, culprit.key);
  assert.ok(/^Matched: /.test(e.labelOf(hand)));
  assert.ok(e.card(scG.uid), 'the accused stays');
  // With the culprit in the casebook, the bench names them outright.
  var r2 = run(e, 'analyze', [evidence(), e.create('prints')]);
  var named = r2.out.filter(function (c) { return c.def === 'clue'; })[0];
  assert.strictEqual(named.data.points, culprit.key);
  assert.ok(named.desc.indexOf('It belongs to ' + culprit.name + '.') >= 0, named.desc);
  console.log('names: ok');
})();

// ---- The question: everybody confesses; only the guilty confess the truth -----
(function theQuestion() {
  // Without sufficient indicia it is a crime the Council can charge you with.
  var g = setup(7), e = g.e;
  var pv0 = (function () { e.autoSlot('interrogate', g.scI.uid); e.autoSlot('interrogate', byDef(e, 'health')[0].uid); var p = e.preview('interrogate'); e.clearSlots('interrogate'); return p; })();
  assert.ok(/not sufficient/.test(pv0.text), 'the preview says the indicia are not sufficient');
  var r = run(e, 'interrogate', [g.scI, byDef(e, 'health')[0]]);
  var conf = r.out.filter(function (c) { return c.data.confession === 'question'; })[0];
  assert.ok(conf, 'the innocent confess too');
  assert.strictEqual(conf.data.falseConfession, true);
  assert.strictEqual(conf.data.illegal, true, 'taken without indicia: unlawful');
  assert.strictEqual(e.s.meters.scrutiny, 2, 'Suspicion +2');
  assert.strictEqual(e.s.meters.dread, 2, 'Dread +2');
  assert.strictEqual(e.s.counts.cruelty, 1, 'Cruelty +1');
  // With indicia (two kinds of proof on the table) it is lawful.
  var h = setup(8), f = h.e;
  f.create('clue', { caseId: h.rec.id, aspects: { forensic: 2 } });
  f.create('clue', { caseId: h.rec.id, aspects: { opportunity: 2 } });
  assert.ok(f.indiciaOf(h.rec).sufficient);
  var r2 = run(f, 'interrogate', [h.scG, byDef(f, 'health')[0]]);
  var conf2 = r2.out.filter(function (c) { return c.data.confession === 'question'; })[0];
  assert.ok(conf2 && !conf2.data.falseConfession && !conf2.data.illegal, 'the guilty confess the truth, lawfully');
  assert.strictEqual(f.s.meters.scrutiny, 0, 'no Suspicion when the Carolina allows it');
  // Checked against Body, a true confession is full proof; unchecked it is half.
  var checked = f.assessCharge(h.scG, [conf2, byDef(f, 'clue').filter(function (c) { return CF.clueAspects(c).forensic; })[0]]);
  assert.strictEqual(checked.confession, 'question');
  assert.ok(checked.checked && checked.tier === 'strong', 'confession + Body: full proof');
  var alone = f.assessCharge(h.scG, [conf2]);
  assert.ok(!alone.checked && alone.tier === 'reasonable', 'confession alone: half proof, ' + alone.tier);
  // A free confession is the king of proofs.
  var free = f.assessCharge(h.scG, [f.make('clue', { caseId: h.rec.id, aspects: { testimony: 3, motive: 1 }, data: { confession: 'free' } })]);
  assert.strictEqual(free.tier, 'strong');
  console.log('the question: ok');
})();

// ---- The Court: false confessions convict; half proof convicts of less ---------
(function court() {
  function trial(seed, data) {
    var g = setup(seed), e = g.e;
    var t = e.create('trial', { data: Object.assign({ caseId: g.rec.id, name: g.innocent.name, guilty: false, solid: false, tier: 'reasonable', real: 3, need: 6, coerced: 0, planted: 0, illegal: 0, contradictions: 0 }, data) });
    e.verdict(t);
    return { e: e, rec: g.rec };
  }
  var wrongful = 0, checkedWrong = 0;
  for (var i = 0; i < 40; i++) {
    if (trial(200 + i, { confession: 'question', checked: false }).rec.status === 'closed') wrongful++;
    if (trial(300 + i, { confession: 'question', checked: true }).rec.status === 'closed') checkedWrong++;
  }
  assert.ok(wrongful >= 24, 'an unchecked false confession usually convicts: ' + wrongful + '/40');
  assert.ok(checkedWrong <= 12, 'checked against the body of the thing, it usually fails: ' + checkedWrong + '/40');
  // Half proof on the guilty: the lesser crime.
  var lesser = null;
  for (var j = 0; j < 30 && !lesser; j++) {
    var g = setup(400 + j), e = g.e;
    var t = e.create('trial', { data: { caseId: g.rec.id, name: g.culprit.name, guilty: true, solid: false, tier: 'reasonable', real: 4, need: 6, coerced: 0, planted: 0, illegal: 0, contradictions: 0 } });
    e.verdict(t);
    if (g.rec.status === 'closed') lesser = e.s.journal[0];
  }
  assert.ok(lesser && /theft, not burglary/.test(lesser.text), 'convicted of the lesser crime: ' + (lesser && lesser.text));
  console.log('court: ok');
})();

// ---- Dread: doors shut, the Stews go quiet, and at ten the crowd turns --------
(function dread() {
  var g = setup(5), e = g.e;
  e.s.meters.dread = 9;
  var shut = 0, seen = 0;
  for (var i = 0; i < 12; i++) {
    var h = setup(500 + i), f = h.e;
    f.s.meters.dread = 9;
    h.rec.leads = { scene: true, prints: true, canvass: true, timing: true }; // past the scripted leads, into the generic rule
    var district = f.tableCards().filter(function (c) { return c.def === 'district' && c.data.district === h.rec.district; })[0] || f.create('district', { data: { district: h.rec.district } });
    var r = run(f, 'investigate', [h.kase, district]);
    if (/Doors Shut|door stayed shut/.test(r.story.text + r.story.title)) shut++;
    seen++;
  }
  assert.ok(shut >= 3, 'a frightened quarter shuts its doors sometimes: ' + shut + '/' + seen);
  e.meter('dread', 1);
  e.checkThresholds();
  assert.ok(e.s.over && e.s.over.id === 'riot', 'at ten Dread the crowd turns');
  assert.ok(/Ravenstone/.test(e.s.over.text));
  // Old saves load with the new meter and counts.
  var old = JSON.parse(game(1).save());
  delete old.meters.dread; delete old.counts;
  var loaded = CF.Engine.load(old);
  assert.strictEqual(loaded.s.meters.dread, 0);
  assert.deepStrictEqual(loaded.s.counts, { cruelty: 0, mercy: 0, purse: 0, debt: 0 });
  console.log('dread: ok');
})();

// ---- The magnet leaves what speaks for somebody else -------------------------------
// An innocent's alibi, another's confession, a token that names someone else: none of it is pulled
// into the culprit's charge. What fills an empty row of the charge comes before a second of the same.
(function magnetLeavesOthers() {
  var g = setup(21), e = g.e, rec = g.rec;
  e.tableCards().filter(function (c) { return c.def === 'clue'; }).forEach(function (c) { e.remove(c); });
  var alibi = e.create('clue', e.clueSpec(rec, { label: 'Alibi: ' + g.innocent.name, text: 'x', aspects: { testimony: 1 }, trait: g.innocent.trait, alibi: g.innocent.key, about: g.innocent.key }, [], { noMisread: true }));
  var conf = e.create('clue', e.clueSpec(rec, { label: 'Confession Under the Question: ' + g.innocent.name, text: 'x', aspects: { testimony: 4 }, about: g.innocent.key }, [], { confession: 'question', falseConfession: true, noMisread: true }));
  var named = e.create('clue', e.clueSpec(rec, { label: 'Named', text: 'x', aspects: { testimony: 2 } }, [], { points: g.innocent.key, noMisread: true }));
  var profile = CF.Charge.profileOf(rec), rows = Object.keys(profile);
  var first = rows[0], second = rows[1] || rows[0];
  // One token meets the first row whole; a second of that kind would only pile up; a third meets another row.
  var a1 = {}; a1[first] = profile[first]; var a2 = {}; a2[first] = 1; var a3 = {}; a3[second] = 1;
  var t1 = e.create('clue', e.clueSpec(rec, { label: 'One', text: 'x', aspects: a1 }, [], { noMisread: true }));
  var t2 = e.create('clue', e.clueSpec(rec, { label: 'Two', text: 'x', aspects: a2 }, [], { noMisread: true }));
  var t3 = e.create('clue', e.clueSpec(rec, { label: 'Three', text: 'x', aspects: a3 }, [], { noMisread: true }));
  [t1, t2, t3].forEach(function (c) { delete c.data.trait; delete c.data.points; });
  assert.ok(second !== first, 'the case has two rows: ' + JSON.stringify(profile));
  assert.ok(e.autoSlot('arrest', g.scG.uid));
  var list = e.magnetCandidates('arrest').map(function (it) { return it.uid; });
  assert.ok(list.indexOf(alibi.uid) < 0, 'an innocent\'s alibi is not pulled into the culprit\'s charge');
  assert.ok(list.indexOf(conf.uid) < 0, 'nor another\'s confession');
  assert.ok(list.indexOf(named.uid) < 0, 'nor a token that names somebody else');
  assert.deepStrictEqual(list.slice(0, 3), [t1.uid, t3.uid, t2.uid], 'the empty row is filled before a second of the same: ' + JSON.stringify(list));
  e.magnet('arrest');
  assert.strictEqual(alibi.loc.t, 'table', 'the alibi stays on the table');
  // The player may still lay it by hand: the magnet only leaves it.
  e.clearSlots('arrest');
  assert.ok(e.autoSlot('arrest', g.scG.uid) && e.autoSlot('arrest', alibi.uid), 'a hand can still place it');
  e.clearSlots('arrest');
  console.log('magnet leaves others\' tokens: ok');
})();

// ---- The opening case does not gamble -------------------------------------------
// Full proof against the guilty in the first case of the office always holds;
// lost all the same (a weak charge, an innocent), the desk and the Bell are
// kept and a case comes soon.
(function openingVerdict() {
  for (var i = 0; i < 120; i++) {
    var o = CF.Engine.newGame({ seed: 3000 + i, who: 'clerk', name: 'Sure', opening: true, guided: true });
    var r = o.caseRec(o.spawnCase('missing', { quiet: true }).caseId);
    r.opening = true; r.status = 'trial';
    o.verdict(o.create('trial', { data: { caseId: r.id, name: 'X', guilty: true, solid: true, tier: 'strong', real: 6, need: 6, coerced: 0, planted: 0, contradictions: 0 } }));
    assert.strictEqual(r.status, 'closed', 'seed ' + (3000 + i) + ': full proof in the opening holds');
  }
  var lost = null;
  for (var j = 0; j < 20 && !lost; j++) {
    var g = CF.Engine.newGame({ seed: 3200 + j, who: 'clerk', name: 'Lost', opening: true, guided: true });
    var gr = g.caseRec(g.spawnCase('missing', { quiet: true }).caseId);
    gr.opening = true; gr.status = 'trial';
    var gc = g.caseCard(gr.id); if (gc) g.remove(gc);
    g.verdict(g.create('trial', { data: { caseId: gr.id, name: 'Y', guilty: false, solid: false, tier: 'weak', real: 1, need: 6, coerced: 0, planted: 0, contradictions: 0 } }));
    if (gr.status === 'acquitted') lost = g;
  }
  assert.ok(lost, 'a weak charge in the opening can be lost');
  assert.ok(!lost.s.flags.opening && !lost.s.flags.bellSilent && lost.s.flags.stage === 'keep', 'the desk and the Bell are kept');
  assert.ok(lost.s.flags.openingAcquitted, 'the engine says how the opening ended');
  var ng = lost.s.journal.filter(function (j2) { return /^Not Guilty: /.test(j2.title); })[0];
  assert.ok(/the Council has seen you work: the desk is yours, and so is the Bell\.$/.test(ng.text), ng.text);
  assert.ok(lost.s.dispatchT <= 20, 'a case comes soon');
  // An older save starts with the flag down.
  var old = JSON.parse(lost.save()); delete old.flags.openingAcquitted;
  assert.strictEqual(CF.Engine.load(old).s.flags.openingAcquitted, false);
  console.log('the opening verdict: ok');
})();

console.log('court: stakes, fingerpost, scene only, alibi, names, the question, verdicts, dread all OK');

// ---- Not on a name alone; and an acquittal says what was missing (round 8) ----------
(function nameAlone() {
  var g = setup(31), e = g.e;
  assert.ok(e.autoSlot('arrest', g.scG.uid));
  var pv = e.preview('arrest');
  assert.strictEqual(pv.blocked, 'The Court will not hear a name alone: one token at least.', 'a name alone is not a charge');
  assert.ok(!e.start('arrest'), 'and cannot be started');
  e.clearSlots('arrest');
  // One token: the charge goes, and the trial card carries the rows.
  var tok = e.create('clue', { caseId: g.rec.id, aspects: { forensic: 1 }, data: {} });
  var r = run(e, 'arrest', [g.scI, tok]);
  var trial = r.out.filter(function (c) { return c.def === 'trial'; })[0];
  assert.ok(trial && trial.data.rows && trial.data.rows.length === Object.keys(g.rec.charge).length, 'the trial knows what the case asked');
  assert.deepStrictEqual(trial.data.have, { forensic: 1 });
  var line = e.acquittalLine(trial.data);
  var want = trial.data.rows.filter(function (x) { return x.have < x.need; }).map(function (x) { return CF.ASPECTS[x.aspect].label + ' ' + x.need; }).join(', ');
  assert.strictEqual(line, 'The sworn men wanted ' + want + '; you brought Body 1.');
  assert.strictEqual(e.acquittalLine({ rows: trial.data.rows, have: {} }), 'The sworn men wanted ' + want + '; you brought nothing.');
  assert.strictEqual(e.acquittalLine({ rows: [{ aspect: 'forensic', need: 1, have: 2 }], have: { forensic: 2 } }), null, 'every row met: nothing to say');
  assert.strictEqual(e.acquittalLine({ tier: 'weak', real: 1, need: 5 }), null, 'an older trial card says nothing');
  // At the verdict an acquittal tells it.
  var said = false;
  for (var i = 0; i < 12 && !said; i++) {
    var h = setup(60 + i), he = h.e;
    h.rec.status = 'trial';
    he.verdict(he.create('trial', { data: { caseId: h.rec.id, name: h.innocent.name, guilty: false, solid: false, tier: 'weak', real: 1, need: 5, coerced: 0, planted: 0, contradictions: 0,
      rows: [{ aspect: 'financial', need: 2, have: 0 }], have: { forensic: 1 } } }));
    if (h.rec.status === 'acquitted') said = he.s.journal.some(function (j) { return /^Not Guilty: /.test(j.title) && j.text.indexOf('The sworn men wanted Coin 2; you brought Body 1.') >= 0; });
  }
  assert.ok(said, 'the Not Guilty story says what the sworn men wanted');
  console.log('not on a name alone; the acquittal says what was missing: ok');
})();
