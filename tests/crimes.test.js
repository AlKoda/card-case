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
  return { out: out, story: story, recipe: v.recipe };
}

// ---- Every new crime is a whole crime -----------------------------------------
(function whole() {
  ['scriptorium', 'witch', 'highway', 'contract'].forEach(function (tid) {
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
  console.log('whole: ok');
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
  e.s.week += 2;
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

console.log('crimes: whole, witch, scriptorium, highway, opts, scene items, names all OK');
