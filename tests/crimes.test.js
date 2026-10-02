// Part II, Phase H: new crimes. The Scriptorium (a locked room in the
// Abbey, and the Inquisitor's interest), the Witch Mark (an accused
// midwife and a Council that wants a burning), the Highway (the roads,
// once the Court is scattered) and the Contract (a paid hand).
// Run: node tests/crimes.test.js
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
  return { out: out, story: story, recipe: v.recipe, preview: pv };
}

// ---- Every new crime is a whole crime -----------------------------------------
(function whole() {
  ['scriptorium', 'witch', 'highway', 'contract', 'weights', 'searchers', 'mint', 'gloryhand'].forEach(function (tid) {
    var T = CF.CASE_TEMPLATES[tid];
    assert.ok(T && T.lesser && T.items.length >= 4 && T.witnesses.length >= 3 && T.hints.length >= 3 && T.roles.length >= 3, tid + ' is complete');
    assert.ok(CF.STRUCTURES[tid] && CF.STRUCTURES[tid].length >= 1, tid + ' has structures');
    assert.ok(CF.LADDERS[tid], tid + ' has a ladder');
    for (var i = 0; i < 6; i++) {
      var e = game(700 + i);
      var rec = e.caseRec(e.spawnCase(tid, { quiet: true }).caseId);
      assert.strictEqual(rec.template, tid);
      assert.ok(!/\{/.test(rec.title) && !/\{/.test(e.caseCard(rec.id).desc), tid + ': every variable filled: ' + e.caseCard(rec.id).desc);
      rec.items.forEach(function (it) { assert.ok(!/\{/.test(it.label) && !/\{/.test(it.text), tid + ' item: ' + it.label); });
      // Searching the scene gives tokens, and Study reads the raw proof.
      var kase = e.caseCard(rec.id);
      var r = run(e, 'investigate', [kase]);
      assert.ok(r.out.some(function (c) { return c.def === 'clue' || c.def === 'evidence'; }), tid + ': the scene gives something');
    }
  });
  assert.ok(CF.ORDINARY_CASES.indexOf('scriptorium') >= 0 && CF.ORDINARY_CASES.indexOf('witch') >= 0 && CF.ORDINARY_CASES.indexOf('contract') >= 0);
  assert.ok(CF.ORDINARY_CASES.indexOf('highway') < 0, 'the highway is not an ordinary crime');
  // The new crimes sit in their offices' tiers, with a ladder and three structures each.
  assert.ok(CF.CASE_TIERS[0].indexOf('weights') >= 0 && CF.CASE_TIERS[1].indexOf('searchers') >= 0, 'false weights for an Examiner, the searchers for a Sworn Examiner');
  assert.ok(CF.CASE_TIERS[3].indexOf('mint') >= 0 && CF.CASE_TIERS[3].indexOf('gloryhand') >= 0, 'the Mint and the Hand of Glory for a Magistrate');
  assert.ok(CF.CASE_TEMPLATES.mint.council && CF.CASE_TEMPLATES.gloryhand.heresy, 'the Council wants the Mint quiet; the Dominicans smell the Hand of Glory');
  assert.ok(CF.LADDERS.mint.wheel === 'The Fire' && CF.LADDERS.weights.custom === 'pillory', 'coiners burn; short measure stands in the pillory');
  console.log('whole: ok');
})();

// ---- A written mystery with one answer comes once a run ----------------------------
(function onceARun() {
  var e = game(31);
  e.s.rank = 3;
  CF.ONCE_CASES.forEach(function (tid) { assert.ok(e.casePool().indexOf(tid) >= 0, tid + ' is in a Magistrate\'s pool before it is sent'); });
  var rec = e.caseRec(e.spawnCase('threedays', { quiet: true }).caseId);
  assert.strictEqual(rec.template, 'threedays');
  assert.deepStrictEqual(e.s.flags.seenCases, ['threedays'], 'the Apple in the Chest is remembered');
  assert.ok(e.casePool().indexOf('threedays') < 0, 'and not sent again');
  assert.ok(e.casePool().indexOf('scriptorium') >= 0 && e.casePool().indexOf('mint') >= 0, 'the rest of the pool stands');
  for (var i = 0; i < 60; i++) { var c = e.spawnCase(null, { quiet: true }); assert.notStrictEqual(e.caseRec(c.caseId).template, 'threedays', 'never twice'); e.goCold(c.caseId); }
  // An older save has seen the mysteries on its record.
  var old = JSON.parse(e.save());
  delete old.flags.seenCases;
  var g = CF.Engine.load(old);
  assert.deepStrictEqual(g.s.flags.seenCases.filter(function (t) { return t === 'threedays'; }), ['threedays'], 'an older save remembers from its cases');
  assert.ok(g.casePool().indexOf('threedays') < 0);
  var fresh = JSON.parse(game(32).save());
  delete fresh.flags.seenCases;
  assert.deepStrictEqual(CF.Engine.load(fresh).s.flags.seenCases, [], 'and a save with none has seen none');
  // The harbour's body is found at its own scene.
  assert.ok(/\{scene\}/.test(CF.CASE_TEMPLATES.harbor.title));
  console.log('once a run: ok');
})();

// ---- The Witch Mark is always the Council's; the Fire waits at the top ----------
(function witch() {
  var e = game(11);
  var rec = e.caseRec(e.spawnCase('witch', { quiet: true }).caseId);
  assert.ok(rec.commission && rec.commission.from === 'council' && rec.commission.ofCouncil === null, 'the Council wants a burning by Friday');
  assert.ok(rec.suspects.some(function (x) { return /midwife/.test(x.role); }), 'the midwife is accused');
  assert.strictEqual(CF.Sentence.rungLabel('witch', 'wheel'), 'The Fire');
  console.log('witch: ok');
})();

// ---- The Scriptorium: the Inquisitor takes what is left open ------------------------
(function scriptorium() {
  var e = game(12);
  e.favour().bishop = -2;
  e.patronsWeek();
  assert.ok(e.s.flags.inquisitor);
  var rec = e.caseRec(e.spawnCase('scriptorium', { quiet: true }).caseId);
  e.patronsWeek();
  assert.strictEqual(rec.status, 'open', 'not yet: two weeks');
  // A week on, the Dominican asks for the file (the warning comes a week before the seizure).
  e.s.week += 1;
  assert.ok(e.patronsWeek().some(function (l) { return /A Dominican has asked the Rolls/.test(l); }), 'warned at a week');
  assert.strictEqual(rec.status, 'open');
  e.s.week += 1;
  e.patronsWeek();
  assert.strictEqual(rec.status, 'inquisitor', 'the Inquisitor takes a heresy case left open two weeks');
  assert.ok(!e.caseCard(rec.id));
  assert.ok(e.s.journal.some(function (j) { return /Inquisitor/.test(j.title) && /heretic/.test(j.text); }));
  console.log('scriptorium: ok');
})();

// ---- The Highway comes once the Court is scattered ------------------------------------
(function highway() {
  var e = game(13);
  e.s.rank = 2;
  var seen = false;
  for (var w = 0; w < 30 && !seen; w++) { e.weekTick(); seen = e.openCases().some(function (r) { return r.template === 'highway'; }); if (e.s.over) break; }
  assert.ok(!seen, 'no highwaymen while the Court stands or has not formed');
  var f = game(14);
  f.s.rank = 2; f.s.flags.syndicateFallen = true;
  var got = false;
  for (var w2 = 0; w2 < 30 && !got; w2++) { f.s.meters.pressure = 0; f.s.meters.scrutiny = 0; f.weekTick(); got = f.openCases().some(function (r) { return r.template === 'highway'; }); if (f.s.over) break; }
  assert.ok(got, 'the roads fill once the Court is scattered');
  console.log('highway: ok');
})();

// ---- A case the story hands in: its own title, brief, roles and guilty role ---------
(function opts() {
  var e = game(800);
  var roles = [{ role: 'the miller', motive: 'The mill was failing.', sex: 'm' }, { role: 'the miller\'s wife', motive: 'The jointure.', sex: 'f' }, { role: 'a carter', motive: 'He knew the road.' }];
  var card = e.spawnCase('burglary', { quiet: true, title: 'The {last} Matter', brief: 'A brief of its own for {victim}.', roles: roles, guiltyRole: 'the miller\'s wife' });
  var rec = e.caseRec(card.caseId);
  assert.strictEqual(rec.title, 'The ' + rec.vars.last + ' Matter', 'the title is honoured');
  assert.strictEqual(card.desc.indexOf('A brief of its own for ' + rec.victim + '.'), 0, 'the brief is honoured over the structure: ' + card.desc);
  assert.deepStrictEqual(rec.suspects.map(function (x) { return x.role; }), roles.map(function (r) { return r.role; }), 'the roles, in order');
  var cul = rec.suspects.filter(function (x) { return x.guilty; })[0];
  assert.strictEqual(cul.role, 'the miller\'s wife', 'the guilty role is honoured');
  assert.ok(CF.NAMES.f.indexOf(cul.name.split(' ')[0]) >= 0, 'a woman\'s name for a wife: ' + cul.name);
  assert.ok(CF.NAMES.m.indexOf(rec.suspects[0].name.split(' ')[0]) >= 0, 'a man\'s name for the miller: ' + rec.suspects[0].name);
  // The band's upright man and the King of Thunes are the ones to break.
  for (var i = 0; i < 5; i++) {
    var f = game(810 + i);
    assert.strictEqual(f.caseRec(f.spawnCase('gang', { quiet: true, gangName: 'the Quiet Men' }).caseId).suspects.filter(function (x) { return x.guilty; })[0].role, 'the band\'s upright man');
    assert.strictEqual(f.caseRec(f.spawnCase('syndicate', { quiet: true }).caseId).suspects.filter(function (x) { return x.guilty; })[0].role, 'the King of Thunes');
  }
  console.log('opts: ok');
})();

// ---- The brief's own items are always at the scene ----------------------------------------
(function sceneItems() {
  Object.keys(CF.STRUCTURES).forEach(function (tid) {
    for (var i = 0; i < 50; i++) {
      var e = game(900 + i);
      var rec = e.caseRec(e.spawnCase(tid, { quiet: true }).caseId);
      var st = CF.STRUCTURES[tid].filter(function (x) { return x.id === rec.structure; })[0];
      assert.ok(st, tid + ': a structure');
      assert.ok(rec.items.length <= 4, tid + ': four things at most');
      st.items.forEach(function (it) {
        var lab = CF.util.fill(it.label, rec.vars);
        lab = lab.charAt(0).toUpperCase() + lab.slice(1);
        assert.ok(rec.items.some(function (x) { return x.label === lab; }), tid + '/' + st.id + ' seed ' + i + ': the brief\'s item is at the scene: ' + lab + ' in ' + rec.items.map(function (x) { return x.label; }).join(' | '));
      });
      var cul = rec.suspects.filter(function (x) { return x.guilty; })[0];
      assert.ok(rec.items.some(function (x) { return x.trait === cul.trait; }), tid + ': the trait token is at the scene');
    }
  });
  console.log('scene items: ok');
})();

// ---- Names fit roles ---------------------------------------------------------------------------
(function names() {
  for (var i = 0; i < 30; i++) {
    var e = game(950 + i);
    var fraud = e.caseRec(e.spawnCase('fraud', { quiet: true }).caseId);
    assert.ok(CF.NAMES.f.indexOf(fraud.victim.split(' ')[0]) >= 0, 'the widow of the Market has a woman\'s name: ' + fraud.victim);
    var three = e.caseRec(e.spawnCase('threedays', { quiet: true }).caseId);
    var husband = three.suspects.filter(function (x) { return x.role === 'the husband'; })[0];
    assert.ok(husband && CF.NAMES.m.indexOf(husband.name.split(' ')[0]) >= 0, 'the husband has a man\'s name: ' + husband.name);
    var w1 = e.witnessSpec(fraud, 'the woman at the casement opposite'), w2 = e.witnessSpec(fraud, 'a porter on the late gang');
    assert.ok(CF.NAMES.f.indexOf(w1.label.replace('Witness: ', '').split(' ')[0]) >= 0, 'a woman witness: ' + w1.label);
    assert.ok(CF.NAMES.m.indexOf(w2.label.replace('Witness: ', '').split(' ')[0]) >= 0, 'a man witness: ' + w2.label);
  }
  assert.strictEqual(CF.NAMES.first.length, CF.NAMES.m.length + CF.NAMES.f.length);
  console.log('names: ok');
})();

// ---- A crier-sung case brings a witness to the door ---------------------------------
(function crierWitness() {
  var e = game(970);
  e.s.rank = 3; // the city watches a Magistrate's cases most
  var sung = null, plain = 0;
  for (var i = 0; i < 80 && !sung; i++) {
    var before = byDef(e, 'witness').length;
    var card = e.spawnCase('burglary', {});
    var rec = e.caseRec(card.caseId);
    var w = byDef(e, 'witness').filter(function (c) { return c.caseId === rec.id; });
    if (rec.highProfile) {
      assert.strictEqual(w.length, 1, 'the crier brings one witness');
      assert.strictEqual(w[0].data.stake, 'reward');
      assert.ok(/Came to the Watch-house door with the broadsheet in their hand/.test(w[0].desc), w[0].desc);
      assert.ok(/\(Witness in: /.test(w[0].desc));
      var j = e.s.journal[0];
      assert.ok(/The crier's song brings the first of them to your door before the ink is dry\./.test(j.text), j.text);
      assert.strictEqual(rec.witnesses.length, CF.CASE_TEMPLATES.burglary.witnesses.length - 1, 'one fewer left to find');
      sung = rec;
    } else { assert.strictEqual(w.length, 0, 'no witness for an ordinary case'); plain++; }
    e.goCold(rec.id); e.s.meters.pressure = 0; e.s.over = null;
    byDef(e, 'atlarge').forEach(function (c) { e.remove(c); });
  }
  assert.ok(sung, 'a case the crier sang');
  // A quiet case (the Court's, the story's) and a case the crier was paid to sing bring none this way.
  var q = game(971); q.s.rank = 3;
  for (var k = 0; k < 40; k++) { var qc = q.spawnCase('burglary', { quiet: true }); assert.strictEqual(byDef(q, 'witness').length, 0, 'quiet: no witness'); q.goCold(qc.caseId); q.s.meters.pressure = 0; q.s.over = null; }
  console.log('crier witness: ok');
})();

// ---- Four marks that are heard, sealed or owed -----------------------------------------
(function marks() {
  ['stammer', 'seal', 'shell', 'lombard'].forEach(function (id) {
    var t = CF.TRAITS.filter(function (x) { return x.id === id; })[0];
    assert.ok(t && t.desc && t.clue.label && t.clue.text && Object.keys(t.clue.aspects).length, id + ' is a whole mark');
    assert.ok(CF.TRAIT_SEEN[id], id + ' can be seen');
  });
  assert.strictEqual(CF.clueAspects({ def: 'clue', aspects: CF.TRAITS.filter(function (x) { return x.id === 'seal'; })[0].clue.aspects }).digital, 2);
  var e = game(972);
  var rec = e.caseRec(e.spawnCase('burglary', { quiet: true, culpritTrait: 'stammer' }).caseId);
  var cul = rec.suspects.filter(function (x) { return x.guilty; })[0];
  assert.strictEqual(cul.trait, 'stammer');
  assert.ok(rec.items.some(function (it) { return it.trait === 'stammer' && it.label === 'What the Child Heard'; }), 'the stammer leaves its token at the scene');
  console.log('marks: ok');
})();

console.log('crimes: whole, witch, scriptorium, highway, opts, scene items, names, crier witness, marks all OK');

// ---- Every mark has an icon, and the icon is cut -----------------------------------------
(function icons() {
  var css = fs.readFileSync(path.join(__dirname, '..', 'css/art/cm-icons.css'), 'utf8');
  CF.TRAITS.forEach(function (t) {
    assert.ok(t.icon && /^[a-z0-9]+-\d\d$/.test(t.icon), t.id + ' has an icon');
    assert.ok(css.indexOf('--art-' + t.icon + ':') >= 0, t.id + ': --art-' + t.icon + ' is in cm-icons.css');
  });
  console.log('icons: ok');
})();

// ---- What a witness heard has a target ----------------------------------------------------
(function hintTargets() {
  for (var tid in CF.CASE_TEMPLATES) {
    var T = CF.CASE_TEMPLATES[tid];
    T.hints.forEach(function (h) {
      assert.ok(h && typeof h.text === 'string' && h.text.length, tid + ': a hint is { text }');
      if (h.role) assert.ok(T.roles.some(function (r) { return r.role === h.role; }), tid + ': hint role is one of the accused: ' + h.role);
    });
  }
  // The card says whether they saw or heard.
  var e0 = game(990), rec0 = e0.caseRec(e0.spawnCase('burglary', { quiet: true }).caseId), saw = 0, heard = 0;
  for (var k = 0; k < 40; k++) {
    var ws = e0.witnessSpec(rec0, 'a baker lighting the ovens');
    if (ws.data.knows) { saw++; assert.ok(/Was at their casement and saw somebody near /.test(ws.desc), ws.desc); }
    else { heard++; assert.ok(/Heard something near /.test(ws.desc), ws.desc); }
  }
  assert.ok(saw && heard, 'both kinds of witness');

  // One hearing from a saved state: the clock does not move between them,
  // so neither the rival nor the case's own clock can take the case away.
  function hearing(saved, state, rec, who, stake) {
    var g = CF.Engine.load(saved);
    g.rng.setState(state);
    var w = g.create('witness', g.witnessSpec(g.caseRec(rec.id), who));
    w.data.knows = false; w.data.stake = stake;
    var r = run(g, 'interrogate', [w, g.create('focus')]);
    var dep = r.out.filter(function (c) { return /^Deposition/.test(g.labelOf(c)); })[0];
    assert.ok(dep, 'a deposition: ' + JSON.stringify(r.story));
    return dep;
  }
  // The highway: the Warrens voice is about the upright man, the taught rider about a gentleman who is not accused.
  var T = CF.CASE_TEMPLATES.highway;
  var rider = T.hints.filter(function (h) { return h.role === 'a gentleman of the Hill in debt'; })[0];
  var voice = T.hints.filter(function (h) { return h.role === 'a former upright man'; })[0];
  assert.ok(rider && voice && T.hints.some(function (h) { return !h.role && /polite/.test(h.text); }), 'the highway hints have targets');
  var e = game(991);
  e.s.rank = 3;
  var rec = e.caseRec(e.spawnCase('highway', { quiet: true, roles: T.roles.slice(0, 3), guiltyRole: 'a former upright man' }).caseId);
  var cul = rec.suspects.filter(function (x) { return x.guilty; })[0];
  assert.strictEqual(cul.role, 'a former upright man');
  var saved = e.save(), voices = 0;
  for (var i = 0; i < 40; i++) {
    var dep = hearing(saved, (i + 1) * 7919, rec, 'a shepherd on the road', 'none');
    assert.ok(dep.desc.indexOf(rider.text) < 0, 'a hint about nobody in the case is never heard');
    if (dep.desc.indexOf(voice.text) >= 0) { voices++; assert.strictEqual(dep.data.points, cul.key, 'the voice from the Warrens points at the upright man'); }
    else assert.ok(!dep.data.points, 'a hint about nobody points at nobody');
  }
  assert.ok(voices > 0, 'the voice is heard sometimes');

  // Protection: the sergeant's hint is about an innocent, heard only from a witness with a reason.
  var X = CF.CASE_TEMPLATES.extortion;
  var sgt = X.hints.filter(function (h) { return h.role === 'a sergeant of the Watch'; })[0];
  var e2 = game(992);
  e2.s.rank = 3;
  var rec2 = e2.caseRec(e2.spawnCase('extortion', { quiet: true, roles: [X.roles[2], X.roles[0], X.roles[1]], guiltyRole: 'a bravo of the Stews' }).caseId);
  var sergeant = rec2.suspects.filter(function (x) { return x.role === 'a sergeant of the Watch'; })[0];
  assert.ok(sergeant && !sergeant.guilty);
  var saved2 = e2.save(), j;
  for (j = 0; j < 30; j++) assert.ok(hearing(saved2, (j + 1) * 7919, rec2, 'a carrier\'s boy', 'hates').desc.indexOf(sgt.text) < 0, 'nobody names a sergeant who is not in the casebook');
  e2.revealSuspect(rec2, null, { key: sergeant.key });
  saved2 = e2.save();
  for (j = 0; j < 30; j++) assert.ok(hearing(saved2, (j + 1) * 7919, rec2, 'a carrier\'s boy', 'none').desc.indexOf(sgt.text) < 0, 'nobody without a reason names the sergeant');
  for (j = 0; j < 30; j++) assert.ok(hearing(saved2, (j + 1) * 7919, rec2, 'a carrier\'s boy', 'kin').desc.indexOf(sgt.text) < 0, 'kin do not name the sergeant');
  var grudge = 0;
  for (j = 0; j < 40; j++) {
    var d2 = hearing(saved2, (j + 1) * 7919, rec2, 'a carrier\'s boy', j % 2 ? 'hates' : 'reward');
    if (d2.desc.indexOf(sgt.text) >= 0) { grudge++; assert.strictEqual(d2.data.points, sergeant.key, 'a grudge points at the sergeant'); }
  }
  assert.ok(grudge > 0, 'a grudge or the reward names the sergeant sometimes');
  console.log('hint targets: ok');
})();

// ---- Opening an Unanswered case again opens the same book --------------------------------
(function sameBook() {
  var e = game(993);
  e.s.rooms.archive = true;
  var rec = e.caseRec(e.spawnCase('burglary', { quiet: true }).caseId);
  var kase = e.caseCard(rec.id);
  rec.found = 2;
  var unfound = rec.items.slice(2).map(function (it) { return it.label; });
  var names = rec.suspects.map(function (x) { return x.name; });
  rec.suspects[0].revealed = true;
  var innocent = rec.suspects.filter(function (x) { return !x.guilty; })[0];
  innocent.cleared = true;
  e.goCold(rec.id);
  assert.ok(!e.card(kase.uid), 'the case card is gone');
  var cold = byDef(e, 'coldcase')[0];
  assert.ok(cold && cold.data.from && cold.data.from.id === rec.id, 'the Unanswered card remembers the case');
  assert.deepStrictEqual(cold.data.from.items.map(function (it) { return it.label; }), unfound, 'and what was never found');
  // Read the Old Book: one unfound item becomes a token that keeps.
  var r = run(e, 'reflect', [cold]);
  assert.strictEqual(r.recipe, 'ref_cold');
  assert.strictEqual(r.preview.label, 'Read the Old Book');
  var leaf = r.out.filter(function (c) { return c.def === 'clue'; })[0];
  assert.ok(leaf, 'a token from the old book');
  assert.ok(!leaf.life, 'it keeps');
  assert.ok(unfound.indexOf(e.labelOf(leaf)) >= 0 || rec.items.slice(2).some(function (it) { return it.result && it.result.label === e.labelOf(leaf); }), 'it is one of the unfound: ' + e.labelOf(leaf));
  assert.strictEqual(leaf.caseId, rec.id);
  assert.strictEqual(cold.data.from.items.length, unfound.length - 1, 'the leaf is read');
  var r2 = run(e, 'reflect', [cold]);
  assert.strictEqual(r2.preview.label, 'Regret', 'once per book');
  assert.ok(!r2.out.some(function (c) { return c.def === 'clue'; }));
  // Open it again: the same victim, scene, title and names; nobody in the casebook, the cleared stay cleared.
  var r3 = run(e, 'analyze', [cold]);
  assert.strictEqual(r3.recipe, 'an_reopen');
  var card2 = r3.out.filter(function (c) { return c.def === 'case'; })[0];
  assert.ok(card2, 'the case is open again');
  var rec2 = e.caseRec(card2.caseId);
  assert.notStrictEqual(rec2.id, rec.id);
  assert.strictEqual(rec2.victim, rec.victim);
  assert.strictEqual(rec2.scene, rec.scene);
  assert.strictEqual(rec2.title, rec.title);
  assert.strictEqual(rec2.district, rec.district);
  assert.strictEqual(rec2.structure, rec.structure);
  assert.deepStrictEqual(rec2.suspects.map(function (x) { return x.name; }), names);
  assert.ok(rec2.suspects.every(function (x) { return !x.revealed; }), 'nobody is in the casebook yet');
  assert.ok(rec2.suspects.filter(function (x) { return x.key === innocent.key; })[0].cleared, 'the cleared stay cleared');
  assert.strictEqual(rec2.culprit, rec.culprit);
  assert.ok(rec2.items.length >= 2, 'at least two things to find');
  var labels2 = rec2.items.map(function (it) { return it.label; });
  cold.data.from.items.forEach(function (it) { assert.ok(labels2.indexOf(it.label) >= 0, 'the unfound are still there: ' + it.label); });
  assert.ok(/^The book opens where you closed it\. /.test(card2.desc), card2.desc);
  assert.strictEqual(leaf.caseId, rec2.id, 'the leaf belongs to the case again');
  // A fresh cold case with nothing left unread has only Regret.
  var rec3 = e.caseRec(e.spawnCase('burglary', { quiet: true }).caseId);
  rec3.found = rec3.items.length;
  e.goCold(rec3.id);
  var cold3 = byDef(e, 'coldcase').filter(function (c) { return c.data.from && c.data.from.id === rec3.id; })[0];
  assert.ok(cold3 && !cold3.data.from.items.length);
  var r4 = run(e, 'reflect', [cold3]);
  assert.strictEqual(r4.preview.label, 'Regret');
  console.log('same book: ok');
})();

// ---- Words that describe a mark --------------------------------------------------
// A token whose words describe one of the marks (a key, pipe ash, a cut hand,
// a left-handed letter, a Lombard's chit, attar) never points at an innocent:
// no innocent of the case carries that mark, and on the culprit it is a mark.
(function echoes() {
  var tids = ['burglary', 'extortion', 'highway', 'pattern'];
  var hits = 0, marked = 0;
  for (var seed = 1; seed <= 300; seed++) {
    var e = game(seed);
    var tid = tids[seed % tids.length];
    var rec = e.caseRec(e.spawnCase(tid, { quiet: true }).caseId);
    var T = CF.CASE_TEMPLATES[tid];
    var st = (CF.STRUCTURES[tid] || []).filter(function (x) { return x.id === rec.structure; })[0] || null;
    var echoed = CF.caseEchoes(T, st);
    assert.ok(echoed.length, tid + ' has words that describe a mark');
    var ids = rec.suspects.map(function (x) { return x.trait; });
    assert.strictEqual(ids.filter(function (t, i) { return ids.indexOf(t) === i; }).length, ids.length, 'every accused has their own mark');
    rec.suspects.forEach(function (x) {
      if (!x.guilty) assert.ok(echoed.indexOf(x.trait) < 0, 'seed ' + seed + ' ' + tid + ': innocent ' + x.name + ' carries ' + x.trait + ', which a token of the case describes');
    });
    var cul = rec.suspects.filter(function (x) { return x.guilty; })[0];
    rec.items.forEach(function (it) {
      if (!it.echoes) return;
      hits++;
      if (it.echoes === cul.trait) { marked++; assert.strictEqual(it.trait, cul.trait, 'on the culprit the words are a mark: ' + it.label); }
      else assert.ok(!it.trait, 'otherwise the token marks nobody: ' + it.label);
    });
  }
  assert.ok(hits > 20, 'the echoing tokens turn up (' + hits + ')');
  // A culprit whose mark the case describes: the scene item and the raw proof read from it carry it.
  var e2 = game(5);
  var rec2 = e2.caseRec(e2.spawnCase('extortion', { quiet: true, culpritTrait: 'lefty' }).caseId);
  // The letter is the written case's (the stall's lead gives it).
  var XT = CF.CASE_TEMPLATES.extortion, xgives = XT.items.slice();
  (XT.leads || []).forEach(function (l) { xgives = xgives.concat(l.gives || []); });
  var letter = xgives.filter(function (it) { return it.echoes === 'lefty'; })[0];
  assert.ok(letter, 'the threatening letter echoes a left hand');
  rec2.suspects.forEach(function (x) { if (!x.guilty) assert.notStrictEqual(x.trait, 'lefty'); });
  e2.s.verbs.analyze.unlocked = true;
  var item = JSON.parse(JSON.stringify(letter));
  item.trait = 'lefty';
  var ev = e2.create('evidence', { label: item.label, caseId: rec2.id, data: { item: item } });
  var read = run(e2, 'analyze', [ev]).out.filter(function (c) { return c.def === 'clue'; })[0];
  assert.ok(read && read.data.trait === 'lefty', 'the letter read carries the left hand');
  console.log('words that describe a mark: ok (' + hits + ' tokens, ' + marked + ' on the culprit)');
})();

// ---- The accused are nobody's kin by accident, and one desk holds no two cases of one title ----------
(function namesAndTitles() {
  var share = 0, scene = 0, total = 0, sameTitle = 0;
  for (var seed = 900; seed < 960; seed++) {
    var e = CF.Engine.newGame({ seed: seed, calling: 'master' });
    e.s.rank = 3;
    for (var k = 0; k < 4; k++) {
      var c = e.spawnCase(null, { quiet: true });
      var rec = e.caseRec(c.caseId);
      if (rec.special) continue;
      var vp = CF.nameParts(rec.victim);
      rec.suspects.forEach(function (x) {
        var np = CF.nameParts(x.name);
        total++;
        if (np[0] === vp[0] || np[1] === vp[1]) share++;
        if (rec.vars.last && np[1] === rec.vars.last) scene++;
      });
    }
    var titles = e.openCases().map(function (r) { return r.title; });
    titles.forEach(function (t, i) { if (titles.indexOf(t) !== i) sameTitle++; });
  }
  assert.ok(total > 500, 'enough accused: ' + total);
  assert.ok(share <= total * 0.01, 'the accused rarely share the victim\'s names: ' + share + ' of ' + total);
  assert.ok(scene <= total * 0.01, 'nor the scene\'s surname: ' + scene + ' of ' + total);
  assert.strictEqual(sameTitle, 0, 'no two open cases share a title');
  // A fixed title twice on one desk: the second is told apart.
  var f = CF.Engine.newGame({ seed: 961, calling: 'master' }); f.s.rank = 3;
  var a = f.caseRec(f.spawnCase('scriptorium', { quiet: true }).caseId), b = f.caseRec(f.spawnCase('scriptorium', { quiet: true }).caseId);
  assert.ok(a.title !== b.title && b.title === a.title + ', Again', b.title);
  // The harbour's body is found at its own scene.
  var h = f.caseRec(f.spawnCase('harbor', { quiet: true }).caseId);
  assert.strictEqual(h.title, 'The Body at ' + h.scene);
  console.log('the accused nobody\'s kin, one title per desk: ok');
})();
