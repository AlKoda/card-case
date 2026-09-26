// Phases 14–15: the crime network (cases that quietly connect) and
// procedural case structures (structure first, prose second).
// Run: node tests/network.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

['js/util.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/data/structures.js', 'js/data/story.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/systems/informants.js', 'js/systems/criminals.js', 'js/systems/network.js', 'js/systems/callings.js', 'js/systems/intro.js', 'js/core/recipes.js', 'js/data/recipes.js'].forEach(function (f) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), { filename: f });
});
var CF = globalThis.CF;
console.error = function (err) { throw err; };

function game(seed, calling) { return CF.Engine.newGame({ seed: seed, calling: calling || 'master' }); }
function byDef(e, d) { return e.tableCards().filter(function (c) { return c.def === d; }); }
function run(e, verb, cards) {
  cards.forEach(function (c) { assert.ok(e.autoSlot(verb, c.uid), verb + ' refused ' + e.labelOf(c)); });
  var pv = e.preview(verb);
  assert.ok(pv && !pv.blocked, verb + ' blocked: ' + (pv && pv.blocked));
  assert.ok(e.start(verb));
  e.tick(e.verb(verb).duration + 0.01);
  assert.ok(!e.s.over, 'the game ended: ' + (e.s.over && e.s.over.title));
  var v = e.verb(verb), out = v.out.map(function (u) { return e.card(u); }), story = v.story, id = v.recipe;
  if (v.status === 'done') e.collect(verb);
  return { out: out, story: story, id: id };
}
function gangUp(e) {
  for (var i = 0; i < 3; i++) {
    var c = e.criminalEscapes({ title: 'old case ' + i }, { name: 'Crook ' + i, trait: 'limp' }, 'cold');
    c.traits = []; // no Violent records: Retaliation would kill the detective mid-test
    e.create('atlarge', { label: 'At Large: Crook ' + i, data: { name: 'Crook ' + i, trait: 'limp', criminalId: c.id } });
  }
  e.organise();
  return byDef(e, 'gang')[0];
}

// ---- Structures ------------------------------------------------------------------
(function structures() {
  CF.ORDINARY_CASES.forEach(function (tid) {
    var list = CF.STRUCTURES[tid];
    assert.ok(list && list.length >= 3, tid + ' has at least three structures');
    list.forEach(function (st) {
      assert.ok(st.id && st.brief && st.items.length >= 2, tid + '/' + st.id);
      Object.keys(st.vars).forEach(function (k) { assert.ok(st.vars[k].length >= 3, tid + '/' + st.id + ' pool ' + k); });
    });
  });
  // Every variable fills; the same template reads differently on different seeds.
  var seen = {}, briefs = {};
  for (var i = 0; i < 40; i++) {
    var e = game(600 + i);
    var card = e.spawnCase('burglary', { quiet: true });
    var rec = e.caseRec(card.caseId);
    assert.ok(rec.structure, 'a structure was chosen');
    seen[rec.structure] = true;
    briefs[card.desc] = true;
    assert.ok(!/\{\w+\}/.test(card.desc), 'brief fully filled: ' + card.desc);
    rec.items.forEach(function (it) {
      assert.ok(!/\{\w+\}/.test(it.label + it.text + (it.result ? it.result.label + it.result.text : '')), 'item filled: ' + it.label);
    });
  }
  assert.ok(Object.keys(seen).length >= 3, 'several burglary structures over 40 cases: ' + Object.keys(seen));
  assert.ok(Object.keys(briefs).length >= 20, 'the prose varies');
  // Structure items join the scene pool; the written leads still run first.
  var g = game(61);
  var k = byDef(g, 'case')[0], r = g.caseRec(k.caseId);
  var res = run(g, 'investigate', [k]);
  assert.strictEqual(res.id, 'lead_burglary_scene');
  assert.ok(r.items.length >= 4, 'generic + structure + trait items: ' + r.items.length);
  console.log('structures: ok');
})();

// ---- The network ---------------------------------------------------------------------
(function network() {
  var e = game(62);
  assert.strictEqual(e.frontsFor().length, 0);
  var gang = gangUp(e);
  // A gang on the board feeds Retaliation every week and its attacks would end the career mid-test.
  e.attack = function () {}; e.create('health');
  var fronts = e.frontsFor(gang.data.name);
  assert.strictEqual(fronts.length, 1, 'a gang gets a front');
  var front = fronts[0];
  assert.ok(front.name && CF.DISTRICTS[front.district] && !front.known);
  assert.strictEqual(gang.data.front, front.id);

  // A case by one of the gang's people carries a clue that points at the front.
  var member = e.criminalByName('Crook 1');
  var c1 = e.spawnCase('burglary', { quiet: true, culpritName: member.name, culpritTrait: member.trait, criminalId: member.id });
  var r1 = e.caseRec(c1.caseId);
  assert.strictEqual(r1.front, front.id);
  var link1 = r1.items.filter(function (it) { return it.link === front.id; })[0];
  assert.ok(link1 && /\S/.test(link1.label) && link1.text.indexOf(front.name) >= 0, 'a linked scene item');
  // Ordinary cases sometimes touch it too.
  var touched = 0;
  for (var i = 0; i < 40; i++) { var cx = e.spawnCase('arson', { quiet: true }); if (e.caseRec(cx.caseId).front) touched++; e.goCold(cx.caseId); }
  assert.ok(touched > 3 && touched < 25, 'some ordinary cases pass through the front: ' + touched);
  // Forty cold cases would end the career and fill the streets with criminals; clear the side effects.
  e.s.meters.pressure = 0; e.s.meters.retaliation = 0; e.s.over = null;
  byDef(e, 'atlarge').concat(byDef(e, 'coldcase')).forEach(function (c) { e.remove(c); });

  // Two linked clues from different cases, in Reflect: the cases are connected.
  var c2 = e.spawnCase('missing', { quiet: true, culpritName: 'Crook 2', culpritTrait: 'limp', criminalId: e.criminalByName('Crook 2').id });
  var r2 = e.caseRec(c2.caseId);
  var link2 = r2.items.filter(function (it) { return it.link === front.id; })[0];
  assert.ok(link2);
  var a = e.create('clue', e.clueSpec(r1, link1, []));
  var b = e.create('clue', e.clueSpec(r2, link2, []));
  assert.strictEqual(a.data.link, front.id);
  var before = byDef(e, 'suspect').length;
  var res = run(e, 'reflect', [a, b]);
  assert.strictEqual(res.id, 'ref_deduce');
  assert.strictEqual(res.story.title, 'These Cases Are Connected');
  assert.strictEqual(res.story.kind, 'major');
  var thread = res.out.filter(function (c) { return c.def === 'thread'; })[0];
  assert.ok(thread && thread.data.front === front.id && thread.data.cases.length === 2);
  assert.ok(res.out.indexOf(a) >= 0 && res.out.indexOf(b) >= 0, 'the clues still belong to their cases');
  assert.ok(front.known);
  var fc = byDef(e, 'front')[0];
  assert.ok(fc && fc.data.front === front.id, 'the Front is on the table');
  assert.ok(byDef(e, 'suspect').length > before, 'the Master Detective gets a name in each connected case');
  // Two clues from the same case do not connect, and unrelated clues never do.
  var a2 = e.create('clue', e.clueSpec(r1, link1, []));
  var a3 = e.create('clue', e.clueSpec(r1, link1, []));
  e.autoSlot('reflect', a2.uid); e.autoSlot('reflect', a3.uid);
  assert.notStrictEqual((e.currentRecipe('reflect') || { recipe: {} }).recipe.id === 'ref_deduce' && CF.Deduce.find([a2, a3]).id, 'connect', 'same case is not a connection');
  e.clearSlots('reflect');

  // The Front can be staked out: something for every open case that passes through.
  e.s.verbs.stakeout.unlocked = true;
  var open = e.casesAtFront(front.id).length;
  assert.ok(open >= 2);
  var st = run(e, 'stakeout', [fc, byDef(e, 'instinct')[0]]);
  assert.strictEqual(st.id, 'stakeout_front');
  var seenClues = st.out.filter(function (c) { return c.def === 'clue' && /^Seen at/.test(e.labelOf(c)); });
  assert.strictEqual(seenClues.length, open);
  assert.ok(front.watched);

  // The Thread with the Gang in Reflect: close in (a Loose End for the Master Detective).
  var le = byDef(e, 'looseend').length;
  var ci = run(e, 'reflect', [thread, gang]);
  assert.strictEqual(ci.id, 'ref_thread');
  assert.strictEqual(byDef(e, 'looseend').length, le + 1);

  // Undercover through the Front: it stands in for the gang, and a watched front is safer.
  e.s.verbs.undercover.unlocked = true;
  var uc = run(e, 'undercover', [fc, byDef(e, 'instinct')[0]]);
  assert.strictEqual(uc.id, 'undercover_op');
  assert.ok(uc.out.some(function (c) { return c.def === 'case' && e.caseRec(c.caseId).template === 'gang'; }), 'the operation opens: ' + JSON.stringify(uc.story) + ' over=' + JSON.stringify(e.s.over && e.s.over.title) + ' status=' + e.verb('undercover').status + ' journal=' + e.s.journal.slice(0, 3).map(function (j) { return j.title; }) + ' ' + uc.out.map(function (c) { return e.labelOf(c); }));

  // Fronts survive the save.
  var e2 = CF.Engine.load(e.save());
  assert.strictEqual(e2.fronts()[front.id].name, front.name);
  console.log('network: ok');
})();
