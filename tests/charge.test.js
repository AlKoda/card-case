// Phases 4–5: the aspect system and charge quality. A charge is scored as
// strength + diversity + corroboration − contradictions − illegal evidence
// against the case's charge profile (docs/DESIGN.md, "Charges").
// Run: node tests/charge.test.js
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

// Every template has a charge profile that agrees with its key aspects.
Object.keys(CF.CASE_TEMPLATES).forEach(function (tid) {
  var T = CF.CASE_TEMPLATES[tid];
  assert.ok(T.charge, tid + ': charge profile');
  assert.deepStrictEqual(Object.keys(T.charge).sort(), T.keyAspects.slice().sort(), tid + ': profile matches key aspects');
  Object.keys(T.charge).forEach(function (k) { assert.ok(CF.ASPECTS[k] && T.charge[k] > 0, tid + ': ' + k); });
});
CF.CLUE_ASPECTS.forEach(function (k) { assert.ok(CF.ASPECTS[k].meaning, k + ' has a meaning'); });

var e = CF.Engine.newGame({ seed: 3, calling: 'master' });
var kase = e.tableCards().filter(function (c) { return c.def === 'case'; })[0];
var rec = e.caseRec(kase.caseId);
assert.strictEqual(rec.template, 'burglary');
assert.deepStrictEqual(rec.charge, { forensic: 2, opportunity: 2, financial: 1 });
var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
var other = rec.suspects.filter(function (x) { return !x.guilty; })[0];
var sc = e.make('suspect', { caseId: rec.id, data: { key: culprit.key } });
function clue(aspects, data) { return e.make('clue', { caseId: rec.id, aspects: aspects, data: data || {} }); }
function assess(clues) { return e.assessCharge(sc, clues); }

// Diversity beats a pile of one aspect.
var pile = assess([clue({ forensic: 4 }), clue({ forensic: 4 }), clue({ forensic: 3 }), clue({ forensic: 2 })]);
var spread = assess([clue({ forensic: 3 }), clue({ testimony: 2 }, { stake: 'reward' }), clue({ motive: 2 }), clue({ opportunity: 2 })]);
assert.ok(spread.score > pile.score, 'spread ' + spread.score + ' beats pile ' + pile.score);
assert.notStrictEqual(pile.tier, 'strong', 'thirteen points of forensic alone is not a strong charge');
assert.strictEqual(spread.tier, 'strong');

// Aspects the case does not turn on count for little.
var offKey = assess([clue({ digital: 4 }), clue({ motive: 4 })]);
assert.strictEqual(offKey.tier, 'weak', 'eight off-profile points: ' + offKey.score);

// Tiers. Enough of the right proof is full proof only with Word behind it:
// a witness, a confession, or a token that names or corroborates.
assert.strictEqual(assess([]).tier, 'weak');
assert.strictEqual(assess([clue({ forensic: 2 }), clue({ opportunity: 2 })]).tier, 'reasonable');
assert.strictEqual(assess([clue({ forensic: 2 }), clue({ opportunity: 2 }), clue({ financial: 2 })]).tier, 'reasonable', 'the scene alone is half proof');
assert.strictEqual(assess([clue({ forensic: 2 }), clue({ opportunity: 2 }), clue({ financial: 2 }, { stake: 'hates' })]).tier, 'strong', 'a witness makes it full');
assert.strictEqual(assess([clue({ forensic: 2 }), clue({ opportunity: 2 }), clue({ financial: 2 }, { corroborated: true })]).tier, 'strong', 'a corroborated token makes it full');
assert.strictEqual(assess([clue({ forensic: 2 }), clue({ opportunity: 2 }), clue({ financial: 2 }, { confession: 'question' })]).tier, 'strong', 'a confession checked against Body makes it full');

// Corroboration and evidence that names the accused help.
var plain = assess([clue({ forensic: 2 }), clue({ opportunity: 2 })]);
var named = assess([clue({ forensic: 2 }, { points: culprit.key }), clue({ opportunity: 2 }, { corroborated: true })]);
assert.ok(named.score > plain.score && named.tier === 'strong');

// Contradictions: a clue that describes somebody else counts against you.
var contra = assess([clue({ forensic: 2 }), clue({ opportunity: 2 }), clue({ financial: 2 }, { trait: other.trait })]);
assert.strictEqual(contra.contradictions, 1);
assert.strictEqual(contra.contradicting.length, 1);
assert.notStrictEqual(contra.tier, 'strong', 'a contradiction is never strong');
var pointsElse = assess([clue({ forensic: 2 }), clue({ opportunity: 2 }), clue({ financial: 2 }, { points: other.key })]);
assert.strictEqual(pointsElse.contradictions, 1);
var agrees = assess([clue({ forensic: 2 }), clue({ opportunity: 2 }), clue({ financial: 2 }, { trait: culprit.trait })]);
assert.strictEqual(agrees.contradictions, 0);
assert.ok(agrees.score > assess([clue({ forensic: 2 }), clue({ opportunity: 2 }), clue({ financial: 2 })]).score, 'a matching trait corroborates');

// Illegal evidence costs, and is remembered for court.
var dirty = assess([clue({ forensic: 2 }), clue({ opportunity: 2 }, { coerced: true }), clue({ financial: 2 }, { planted: true })]);
assert.strictEqual(dirty.illegal, 2);
assert.strictEqual(dirty.coerced, 1);
assert.strictEqual(dirty.planted, 1);
assert.ok(dirty.score < agrees.score);

// Misread clues look good and are not.
var mis = assess([clue({ forensic: 2 }, { misread: true, corroborated: true }), clue({ opportunity: 2 }), clue({ financial: 2 })]);
assert.strictEqual(mis.tier, 'strong');
assert.notStrictEqual(mis.realTier, 'strong');
assert.ok(!mis.solid);

// Foreign clues are ignored and reported.
var otherCase = e.make('clue', { caseId: 'nope', aspects: { forensic: 9 } });
var f = assess([clue({ forensic: 2 }), otherCase]);
assert.strictEqual(f.foreign, 1);
assert.ok(!f.have.forensic || f.have.forensic === 2);

// The description the Arrest window shows: the contradicting token by name,
// the lesser crime half proof convicts of, and what full proof still wants.
var d = CF.Charge.describe(contra);
assert.strictEqual(d.rows.length, 3);
var contraNote = d.notes.filter(function (n) { return n.kind === 'bad' && /somebody else/.test(n.text); })[0];
assert.ok(contraNote && contraNote.text.indexOf(e.labelOf(contra.contradicting[0])) === 0, 'the Court names the token: ' + (contraNote && contraNote.text));
assert.ok(/describes somebody else: −2$/.test(contraNote.text));
assert.deepStrictEqual(d.bad, [contra.contradicting[0].uid], 'the contradicting token for the window');
assert.strictEqual(d.tierLabel, CF.Charge.TIERS[contra.tier].label);
var two = CF.Charge.describe(assess([clue({ forensic: 2 }, { trait: other.trait }), clue({ opportunity: 2 }, { points: other.key })]));
assert.ok(two.notes.some(function (n) { return / and .* describe somebody else: −4$/.test(n.text); }), 'two tokens, joined with and');
assert.strictEqual(two.bad.length, 2);
var half = CF.Charge.describe(assess([clue({ forensic: 2 }), clue({ opportunity: 2 }), clue({ financial: 1 })]));
assert.strictEqual(half.tier, 'reasonable');
assert.ok(half.notes.some(function (n) { return n.kind === 'bad' && /Half proof: the Court would convict of theft, not burglary, and the ladder stops at banishment\./.test(n.text); }), 'the lesser crime is named');
// Every row is met here (Coin 1 of 1): what is wanted is a word behind the rows, and the way to it.
assert.ok(half.notes.some(function (n) { return n.kind === 'dim' && /^Word behind it: a witness's Deposition, two tokens bound in Rest, a hand matched to them, or a free confession\. Confront them in Question with a token of the case\.$/.test(n.text); }), 'what full proof wants: ' + JSON.stringify(half.notes));
var gap = CF.Charge.describe(assess([clue({ forensic: 1 }), clue({ testimony: 2 }, { stake: 'reward' })]));
assert.strictEqual(gap.tier, 'weak');
var want = gap.notes.filter(function (n) { return /^To full proof/.test(n.text); })[0];
assert.ok(want && /Body 1, Presence 2, Coin 1/.test(want.text) && /or a second witness who wants something else/.test(want.text), 'the shortfall and a second witness: ' + (want && want.text));
assert.ok(!CF.Charge.describe(spread).notes.some(function (n) { return /^To full proof|^Half proof/.test(n.text); }), 'full proof wants nothing more');

// The court reacts to the tier: a weak charge on an innocent person rarely convicts,
// a strong one on the culprit nearly always does.
function trialOutcome(tier, guilty, real, need, n) {
  var wins = 0;
  for (var i = 0; i < n; i++) {
    var g = CF.Engine.newGame({ seed: 100 + i, calling: 'master' });
    var k = g.tableCards().filter(function (c) { return c.def === 'case'; })[0];
    var r = g.caseRec(k.caseId);
    var t = g.create('trial', { data: { caseId: r.id, name: 'X', guilty: guilty, solid: tier === 'strong', tier: tier, real: real, need: need, coerced: 0, planted: 0, contradictions: 0 } });
    g.verdict(t);
    if (r.status === 'closed') wins++;
  }
  return wins / n;
}
assert.ok(trialOutcome('strong', true, 7, 6, 60) > 0.85, 'strong charges convict');
assert.ok(trialOutcome('weak', true, 2, 6, 60) < 0.5, 'weak charges mostly fail');
assert.ok(trialOutcome('weak', false, 2, 6, 60) < 0.3, 'weak charges on the innocent fail');

// Whose words they are: a confession, a motive or a story belongs to the one
// who gave it. Laid against somebody else it proves nothing, and another's
// confession is the defence's best friend. Tokens from older saves carry no
// owner and count as they always did.
assert.strictEqual(e.clueSpec(rec, { label: 'Motive: X', aspects: { motive: 2 }, about: culprit.key }, []).data.about, culprit.key, 'the token keeps its owner');
var scInnocent = e.make('suspect', { caseId: rec.id, data: { key: other.key } });
function freeConfession(key) { return clue({ testimony: 3, motive: 1 }, { confession: 'free', about: key }); }
var ownWords = assess([freeConfession(culprit.key)]);
assert.strictEqual(ownWords.tier, 'strong', 'the culprit\'s own free confession against the culprit is full proof');
var strayFree = e.assessCharge(scInnocent, [freeConfession(culprit.key)]);
assert.notStrictEqual(strayFree.tier, 'strong', 'the culprit\'s free confession against an innocent: ' + strayFree.tier);
assert.notStrictEqual(strayFree.realTier, 'strong');
assert.strictEqual(strayFree.confession, null, 'it is not this accused\'s confession');
assert.strictEqual(strayFree.contradictions, 1, 'another\'s confession counts against the charge');
var strayQuestion = assess([clue({ forensic: 2 }), clue({ testimony: 4 }, { confession: 'question', about: other.key })]);
assert.notStrictEqual(strayQuestion.tier, 'strong', 'an innocent\'s confession under the question against the culprit');
assert.strictEqual(strayQuestion.confession, null);
var strayMotive = assess([clue({ forensic: 2 }), clue({ opportunity: 2 }), clue({ financial: 2 }), clue({ motive: 2 }, { about: other.key })]);
assert.strictEqual(strayMotive.contradictions, 0, 'another\'s motive is no contradiction');
assert.ok(!strayMotive.have.motive, 'and adds nothing');
assert.strictEqual(strayMotive.elsewhere.length, 1);
var dStray = CF.Charge.describe(strayMotive);
assert.ok(dStray.notes.some(function (n) { return n.kind === 'bad' && n.text === 'Motive: ' + other.name + ': about ' + other.name + ', not this accused. It counts for nothing here.'; }) || dStray.notes.some(function (n) { return n.kind === 'bad' && /: about .*, not this accused\. It counts for nothing here\.$/.test(n.text); }), 'the Court says whose it is: ' + JSON.stringify(dStray.notes));
assert.ok(dStray.bad.indexOf(strayMotive.elsewhere[0].uid) >= 0, 'the stray token is marked in the window');
var dFree = CF.Charge.describe(strayFree);
assert.ok(dFree.notes.some(function (n) { return /another's confession\. It proves nothing against this accused, and the advocate will use it: −2$/.test(n.text); }), 'another\'s confession is called so');
assert.ok(!dFree.notes.some(function (n) { return /describes? somebody else/.test(n.text); }), 'and is not counted twice');
var oldSave = e.assessCharge(scInnocent, [clue({ testimony: 3, motive: 1 }, { confession: 'free' })]);
assert.strictEqual(oldSave.tier, 'strong', 'a token from an older save, with no owner, counts as before');

// Every row met and still half proof: the Court says what is wanted, and
// how to get it (confront the accused with a token of the case).
var rowsOnly = assess([clue({ forensic: 2 }), clue({ opportunity: 2 }), clue({ financial: 2 })]);
assert.strictEqual(rowsOnly.tier, 'reasonable');
assert.ok(rowsOnly.rowsMet && rowsOnly.wordWanted, 'every row met, a word wanted');
assert.ok(!assess([clue({ forensic: 2 }), clue({ opportunity: 2 })]).wordWanted, 'a row short is not a word wanted');
assert.ok(!spread.wordWanted, 'full proof wants nothing');
var dRows = CF.Charge.describe(rowsOnly);
assert.ok(dRows.wordWanted && dRows.notes.some(function (n) { return n.kind === 'dim' && /^Word behind it: .*Confront them in Question with a token of the case\.$/.test(n.text); }), 'the way to full proof is named');
// The four seals: here three are lit and only the word is dark.
assert.deepStrictEqual(dRows.gates.map(function (g) { return g.id + ':' + g.ok; }), ['enough:true', 'kinds:true', 'word:false', 'clean:true'], 'the seals show the hidden fourth rule');
assert.deepStrictEqual(dRows.gates.map(function (g) { return g.label; }), ['Enough', 'Two kinds', 'Word behind it', 'Nothing against them']);
assert.strictEqual(dRows.fullBy, null, 'half proof is reached by nothing');
assert.ok(spread.gates.every(function (g) { return g.ok; }) && spread.fullBy === 'seals', 'full proof by the seals lights all four');
Object.keys(rowsOnly.standing).forEach(function (u) { assert.strictEqual(rowsOnly.standing[u].id, 'proof', 'plain proof is captioned so'); });
// Each laid token's standing toward the accused.
var stOther = clue({ forensic: 2 }, { trait: other.trait }), stMine = clue({ opportunity: 2 }, { points: culprit.key }), stOff = clue({ digital: 1 });
var stand = assess([stOther, stMine, stOff]).standing;
assert.strictEqual(stand[stOther.uid].id, 'else', 'a mark of someone else');
assert.strictEqual(stand[stMine.uid].label, 'Names them', 'a token that names the accused');
assert.strictEqual(stand[stOff.uid].label, 'Off the case', 'proof the case does not turn on');
assert.strictEqual(stand[stOther.uid].label, 'Someone else');
var cg = CF.Engine.newGame({ seed: 3, calling: 'master' });
var ck = cg.tableCards().filter(function (c) { return c.def === 'case'; })[0], crec = cg.caseRec(ck.caseId);
var ccul = crec.suspects.filter(function (x) { return x.guilty; })[0];
var csus = cg.create('suspect', { caseId: crec.id, data: { key: ccul.key } });
assert.strictEqual(cg.confrontFor(csus), null, 'nothing of the case to show them');
var light = cg.create('clue', { caseId: crec.id, aspects: { opportunity: 1 }, data: {} });
var heavy = cg.create('clue', { caseId: crec.id, aspects: { forensic: 2, opportunity: 1 }, data: {} });
var plan = cg.confrontFor(csus);
assert.ok(plan && plan.suspect === csus.uid && plan.token === heavy.uid, 'the heaviest token of the case: ' + JSON.stringify(plan));
assert.strictEqual(typeof plan.ready, 'boolean');
cg.create('clue', { caseId: crec.id, aspects: { testimony: 3 }, data: { confession: 'free', about: ccul.key } });
assert.strictEqual(cg.confrontFor(csus), null, 'their free confession already lies on the table');
void light;

// Full proof and a true free confession hold; when full proof fails anyway
// the week says why, and the Crowd does not rise: the city saw the proof.
assert.ok(trialOutcome('strong', true, 7, 6, 200) > 0.93, 'full proof on the guilty convicts');
var unlucky = null;
for (var us = 0; us < 400 && !unlucky; us++) {
  var ug = CF.Engine.newGame({ seed: 2000 + us, calling: 'master' });
  var uk = ug.tableCards().filter(function (c) { return c.def === 'case'; })[0], ur = ug.caseRec(uk.caseId);
  var before = ug.s.meters.pressure;
  var ut = ug.create('trial', { data: { caseId: ur.id, name: 'X', guilty: true, solid: true, tier: 'strong', real: 7, need: 6, coerced: 0, planted: 0, contradictions: 0 } });
  ug.verdict(ut);
  if (ur.status === 'acquitted') unlucky = { g: ug, before: before };
}
assert.ok(unlucky, 'a full-proof acquittal happens, rarely');
assert.strictEqual(unlucky.g.s.meters.pressure, unlucky.before, 'the Crowd does not rise on a full-proof acquittal');
var ustory = unlucky.g.s.journal.filter(function (j) { return /^Not Guilty: /.test(j.title); })[0];
assert.ok(ustory && CF.FULL_PROOF_FAILS.some(function (r) { return ustory.text.indexOf(r) >= 0; }), 'the verdict says why: ' + (ustory && ustory.text));
var halfGame = CF.Engine.newGame({ seed: 5, calling: 'master' });
var hk = halfGame.tableCards().filter(function (c) { return c.def === 'case'; })[0], hr = halfGame.caseRec(hk.caseId);
var hb = halfGame.s.meters.pressure;
halfGame.verdict(halfGame.create('trial', { data: { caseId: hr.id, name: 'X', guilty: false, solid: false, tier: 'weak', real: 0, need: 6, coerced: 0, planted: 0, contradictions: 0 } }));
if (hr.status === 'acquitted') assert.strictEqual(halfGame.s.meters.pressure, hb + 1, 'an ordinary acquittal still raises the Crowd');

// The Court repeats what the player has already worked out: the Prime Suspect
// their reasoning named, and a free confession whose words admit the lie.
// The tier stands; only the window speaks.
var pg = CF.Engine.newGame({ seed: 3, calling: 'master' });
var pk = pg.tableCards().filter(function (c) { return c.def === 'case'; })[0], prec = pg.caseRec(pk.caseId);
var pcul = prec.suspects.filter(function (x) { return x.guilty; })[0], pinn = prec.suspects.filter(function (x) { return !x.guilty; })[0];
var pOn = function (key) { return pg.make('suspect', { caseId: prec.id, data: { key: key } }); };
var pClues = [pg.make('clue', { caseId: prec.id, aspects: { forensic: 2 } }), pg.make('clue', { caseId: prec.id, aspects: { opportunity: 2 } })];
assert.strictEqual(pg.assessCharge(pOn(pinn.key), pClues).prime, null, 'nobody named yet');
prec.identified = pcul.key;
var pElse = pg.assessCharge(pOn(pinn.key), pClues);
assert.strictEqual(pElse.prime, pcul.name);
assert.strictEqual(pElse.primeKey, pcul.key);
assert.ok(CF.Charge.describe(pElse).notes.some(function (n) { return n.kind === 'bad' && n.text === 'Your own reasoning named ' + pcul.name + '. This charge names someone else.'; }), 'the Court names the Prime Suspect');
var pSame = pg.assessCharge(pOn(pcul.key), pClues);
assert.strictEqual(pSame.prime, null, 'charging the Prime Suspect says nothing');
assert.ok(!CF.Charge.describe(pSame).notes.some(function (n) { return /Your own reasoning/.test(n.text); }));
var lie = pg.make('clue', { caseId: prec.id, aspects: { testimony: 3, motive: 1 }, data: { confession: 'free', falseConfession: true, about: pinn.key, trait: pinn.trait } });
var pLie = pg.assessCharge(pOn(pinn.key), [lie]);
assert.strictEqual(pLie.tier, 'strong', 'a false confession nothing contradicts is still full proof (Carolina)');
assert.ok(pLie.falseFree);
var dLie = CF.Charge.describe(pLie);
assert.ok(dLie.notes.some(function (n) { return n.kind === 'bad' && n.text === 'This confession says too much: the wrong day, the wrong knife.'; }), 'the Court reads the lie');
assert.ok(!dLie.notes.some(function (n) { return /king of proofs/.test(n.text); }), 'and does not call it the king of proofs');
var truth = pg.make('clue', { caseId: prec.id, aspects: { testimony: 3, motive: 1 }, data: { confession: 'free', about: pcul.key } });
assert.ok(!pg.assessCharge(pOn(pcul.key), [truth]).falseFree, 'a true confession is not flagged');
var qLie = pg.make('clue', { caseId: prec.id, aspects: { testimony: 4 }, data: { confession: 'question', falseConfession: true, about: pinn.key } });
assert.ok(!pg.assessCharge(pOn(pinn.key), [qLie]).falseFree, 'a confession under the question never gives away who is innocent');

// ---- The Court's words are glossed where they are first met ---------------------------
assert.strictEqual(half.tierTitle, 'Half Proof (may hold)', 'half proof, glossed');
assert.strictEqual(gap.tierTitle, 'Indicia (suspicion only)', 'indicia, glossed');
assert.strictEqual(CF.Charge.tierTitle('strong'), 'Full Proof', 'full proof needs no gloss');
assert.strictEqual(gap.tierLabel, 'Indicia', 'the bare name stays for the prose');
var nov = CF.Engine.newGame({ seed: 5, calling: 'master' });
assert.ok(nov.chargeNovice(), 'the first charges are taught');
nov.s.stats.convictions = 1; nov.s.stats.acquittals = 1;
assert.ok(!nov.chargeNovice(), 'after two, the label alone');
assert.ok(/indicia, suspicion that is not yet proof, will not convict alone/.test(CF.VERBS.arrest.desc), 'the Court\'s description glosses indicia');
var q = CF.RECIPES_BY_ID.int_suspect;
['sufficient', 'not'].forEach(function (k) {
  var fake = { has: function (x) { return x === 'health'; }, primary: {}, caseOf: function () { return {}; }, e: { indiciaOf: function () { return { sufficient: k === 'sufficient' }; } } };
  assert.ok(/Carolina, the Emperor's law the Court sits under/.test(q.preview(fake)), 'the question names the Carolina\'s law: ' + k);
});

console.log('charge: profiles, diversity, corroboration, contradictions, illegal evidence, tiers, court all OK');
