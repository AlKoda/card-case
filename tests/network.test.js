// Phases 14–15: the crime network (cases that quietly connect) and
// procedural case structures (structure first, prose second).
// Run: node tests/network.test.js
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
  assert.ok(!a.life && !a.maxLife, 'a link token has no clock: a chit in a drawer keeps');
  assert.ok(/A chit in a drawer keeps\.$/.test(a.desc), a.desc);
  assert.ok(CF.Network.LINK_CHANCE > CF.Network.LINK_CHANCE_KNOWN, 'links are likelier while no front is known');
  var before = byDef(e, 'suspect').length;
  var res = run(e, 'reflect', [a, b]);
  assert.strictEqual(res.id, 'ref_deduce');
  assert.strictEqual(res.story.title, 'These Cases Are One');
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

  var open = e.casesAtFront(front.id).length;
  assert.ok(open >= 2);
  e.s.rank = 2; // the Watch is a Bailiff's power
  var st = run(e, 'investigate', [fc, byDef(e, 'instinct')[0]]);
  assert.strictEqual(e.verb('investigate').recipe || st.id, 'stakeout_front');
  var seenClues = st.out.filter(function (c) { return c.def === 'clue' && /^Seen at/.test(e.labelOf(c)); });
  assert.strictEqual(seenClues.length, open);
  assert.ok(front.watched);

  // The Thread with the Gang in Reflect: close in (a Loose End for the Master Detective).
  var le = byDef(e, 'looseend').length;
  var ci = run(e, 'reflect', [thread, gang]);
  assert.strictEqual(ci.id, 'ref_thread');
  assert.strictEqual(byDef(e, 'looseend').length, le + 1);

  // Undercover through the Front: it stands in for the gang, and a watched front is safer.

  var uc = run(e, 'investigate', [fc, byDef(e, 'focus')[0]]); // a front with Wit is a way in; with Instinct, a watch
  assert.strictEqual(uc.id, 'undercover_op');
  assert.ok(uc.out.some(function (c) { return c.def === 'case' && e.caseRec(c.caseId).template === 'gang'; }), 'the operation opens: ' + JSON.stringify(uc.story) + ' over=' + JSON.stringify(e.s.over && e.s.over.title) + ' status=' + e.verb('investigate').status + ' journal=' + e.s.journal.slice(0, 3).map(function (j) { return j.title; }) + ' ' + uc.out.map(function (c) { return e.labelOf(c); }));

  // Fronts survive the save.
  var e2 = CF.Engine.load(e.save());
  assert.strictEqual(e2.fronts()[front.id].name, front.name);
  console.log('network: ok');
})();

// ---- The receiver of stolen goods: a front with no band, from the first office ------------
(function receiver() {
  var e = game(64);
  assert.ok(!e.fenceFront(), 'no receiver for an Examiner');
  var rng0 = e.rng.getState ? e.rng.getState() : null;
  e.promote();
  var fence = e.fenceFront();
  assert.ok(fence && fence.fence && fence.district === 'market' && !fence.known, 'the first office: a receiver keeps a door in the Market');
  assert.ok(/Pawnshop|Lock-up/.test(fence.name), fence.name);
  if (rng0 !== null) assert.strictEqual(e.rng.getState(), rng0, 'nobody is told, and the dice are not touched');
  assert.ok(!e.s.journal.some(function (j) { return j.text.indexOf(fence.name) >= 0; }), 'nobody is told');
  e.promote();
  assert.strictEqual(Object.keys(e.fronts()).filter(function (k) { return e.fronts()[k].fence; }).length, 1, 'one receiver');
  // The thefts go through his door; the deaths do not.
  var thefts = 0, deaths = 0;
  for (var i = 0; i < 40; i++) {
    var b = e.caseRec(e.spawnCase('burglary', { quiet: true }).caseId); if (b.front === fence.id) thefts++; e.goCold(b.id);
    var h = e.caseRec(e.spawnCase('harbor', { quiet: true }).caseId); if (h.front) deaths++; e.goCold(h.id);
  }
  assert.ok(thefts > 5 && thefts < 30, 'some thefts pass through the receiver: ' + thefts);
  assert.strictEqual(deaths, 0, 'no killing goes through a pawnshop');
  e.s.meters.pressure = 0; e.s.meters.retaliation = 0; e.s.over = null;
  byDef(e, 'atlarge').concat(byDef(e, 'coldcase')).forEach(function (c) { e.remove(c); });
  // Two chits from two cases: the dossier's quiet cue, then the Thread.
  var r1 = null, r2 = null;
  for (var j = 0; j < 60 && !(r1 && r2); j++) {
    var r = e.caseRec(e.spawnCase(['burglary', 'coining', 'extortion', 'fraud'][j % 4], { quiet: true, lifetime: 900 }).caseId);
    if (r.front === fence.id) { if (!r1) r1 = r; else r2 = r; } else e.goCold(r.id);
  }
  e.s.meters.pressure = 0; e.s.meters.retaliation = 0;
  byDef(e, 'atlarge').concat(byDef(e, 'coldcase')).forEach(function (c) { e.remove(c); });
  assert.ok(r1 && r2, 'two thefts through his door');
  var l1 = r1.items.filter(function (it) { return it.link === fence.id; })[0], l2 = r2.items.filter(function (it) { return it.link === fence.id; })[0];
  assert.ok(l1 && l1.text.indexOf(fence.name) >= 0, 'a chit names his door');
  var a = e.create('clue', e.clueSpec(r1, l1, []));
  assert.strictEqual(e.linkTwin(a), null, 'alone, no cue');
  var b2 = e.create('clue', e.clueSpec(r2, l2, []));
  assert.strictEqual(e.linkTwin(a), b2, 'another token on the table names the same door');
  assert.ok(CF.Network.TWIN_LINE, 'the cue has words');
  var res = run(e, 'reflect', [a, b2]);
  var thread = res.out.filter(function (c) { return c.def === 'thread'; })[0];
  assert.ok(thread && thread.data.fence && /A receiver of stolen goods keeps it\. Bring the Thread to Rest alone/.test(thread.desc), thread && thread.desc);
  assert.ok(fence.known && byDef(e, 'front').some(function (c) { return /receiver of stolen goods/.test(c.desc); }), 'his door on the table');
  // The Thread alone, in Rest: a case against the receiver.
  var th = run(e, 'reflect', [thread]);
  assert.strictEqual(th.id, 'ref_thread');
  var rc = e.openCases().filter(function (x) { return x.template === 'receiver'; })[0];
  assert.ok(rc && rc.scene === fence.name && rc.fenceFront === fence.id && rc.title === 'The Receiver at ' + fence.name, rc && rc.title);
  assert.strictEqual(rc.suspects.filter(function (x) { return x.guilty; })[0].role, 'the receiver');
  assert.ok(e.receiverOpen(fence.id));
  // A case closed: its chit stays in the drawer.
  var kept = e.create('clue', e.clueSpec(r1, l1, []));
  e.clearCaseCards(r1.id);
  assert.ok(e.card(kept.uid) && kept.data.kept, 'a chit to the receiver outlives its case');
  // Convicted: his door shuts, and the open cases that went through it get their goods back.
  var notes = [];
  e.onConviction(rc, { guilty: true, name: rc.suspects.filter(function (x) { return x.guilty; })[0].name }, notes);
  assert.ok(fence.fallen && !e.fenceFront(), 'his door is shut');
  var back = byDef(e, 'clue').filter(function (c) { return e.labelOf(c) === 'Recovered Goods'; });
  assert.ok(back.length >= 2 && back.every(function (c) { var rr = e.caseRec(c.caseId); return rr.front === fence.id && c.data.points === rr.culprit; }), 'Recovered Goods on every linked case, and who brought them');
  assert.ok(notes.some(function (n) { return /is shut\. In the back room, goods from \d+ of your cases/.test(n); }), notes.join(' | '));
  var after = 0;
  for (var k = 0; k < 20; k++) { var x = e.caseRec(e.spawnCase('burglary', { quiet: true }).caseId); if (x.front === fence.id) after++; e.goCold(x.id); }
  assert.strictEqual(after, 0, 'no more chits to a shut door');
  // An older save: its fronts are bands', and past its first office the receiver opens his door on load.
  var o = game(65); o.s.rank = 1;
  var old = JSON.parse(o.save());
  var lo = CF.Engine.load(old);
  assert.ok(lo.fenceFront(), 'an older Sworn Examiner finds the receiver');
  var o2 = game(66); o2.newFront('the Lanternless', 'docks');
  var old2 = JSON.parse(o2.save()); Object.keys(old2.network.fronts).forEach(function (k2) { delete old2.network.fronts[k2].fence; delete old2.network.fronts[k2].fallen; });
  var lo2 = CF.Engine.load(old2), fr2 = lo2.frontsFor()[0];
  assert.ok(fr2.fence === false && fr2.fallen === false && !lo2.fenceFront(), 'an older band front stays a band\'s, and an Examiner has no receiver yet');
  console.log('the receiver: ok (' + thefts + ' of 40 thefts through his door)');
})();
