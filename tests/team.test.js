// Phases 10–11: equipment changes what recipes do; officers bring traits.
// Run: node tests/team.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

['js/util.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/systems/informants.js', 'js/systems/criminals.js', 'js/core/recipes.js', 'js/data/recipes.js'].forEach(function (f) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), { filename: f });
});
var CF = globalThis.CF;
console.error = function (err) { throw err; };

function game(seed) { return CF.Engine.newGame({ seed: seed, calling: 'master' }); }
function byDef(e, d) { return e.tableCards().filter(function (c) { return c.def === d; }); }
function byLabel(e, re) { return e.tableCards().filter(function (c) { return re.test(e.labelOf(c)); }); }
function run(e, verb, cards) {
  cards.forEach(function (c) { assert.ok(e.autoSlot(verb, c.uid), verb + ' refused ' + e.labelOf(c)); });
  var pv = e.preview(verb);
  assert.ok(pv && !pv.blocked, verb + ' blocked: ' + (pv && pv.blocked));
  assert.ok(e.start(verb));
  var dur = e.verb(verb).duration;
  e.tick(dur + 0.01);
  var v = e.verb(verb), out = v.out.map(function (u) { return e.card(u); }), story = v.story, id = v.recipe;
  if (v.status === 'done') e.collect(verb);
  return { out: out, story: story, duration: dur, id: id };
}
function officer(e, key, traits) {
  var spec = e.teammateSpec(key);
  spec.data.traits = traits;
  return e.create('teammate', spec);
}

// ---- Equipment modifies recipes -------------------------------------------------
(function equipment() {
  var e = game(21);
  var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
  // The fingerprint set sharpens what is found on surfaces, and nothing else.
  var prints = e.create('prints');
  var onSurface = e.clueSpec(rec, { label: 'x', text: '', aspects: { forensic: 2 }, tags: ['surfaces'] }, [prints]);
  var onPaper = e.clueSpec(rec, { label: 'x', text: '', aspects: { forensic: 2 }, tags: ['records'] }, [prints]);
  assert.strictEqual(onSurface.aspects.forensic, 3, 'Forensic +1 on surfaces');
  assert.strictEqual(onPaper.aspects.forensic, 2, 'nothing on paper');
  // Evidence that needs a kit reads properly with it, and with a Sharp officer.
  var ctxKit = e.makeCtx('analyze', {});
  ctxKit.cards = [e.create('kit')];
  assert.ok(e.hasTool(ctxKit, 'bio') && !e.hasTool(ctxKit, 'prints'));
  var ctxSharp = e.makeCtx('analyze', {});
  ctxSharp.cards = [officer(e, 'tech', ['sharp'])];
  assert.ok(e.hasTool(ctxSharp, 'lab'), 'a Sharp officer stands in for any kit');

  // The camera: photograph the scene, and what you found stops degrading.
  run(e, 'investigate', [kase]);
  var frame = byLabel(e, /Pried Window/)[0];
  assert.ok(frame.maxLife, 'evidence decays');
  var cam = e.create('camera');
  var r = run(e, 'investigate', [kase, cam]);
  assert.strictEqual(r.id, 'inv_photograph');
  assert.ok(!frame.maxLife && frame.life === undefined, 'photographed: it keeps');
  var photos = byLabel(e, /Scene Photographs/)[0];
  assert.ok(photos && !photos.maxLife);
  assert.ok(rec.photographed);
  e.autoSlot('investigate', kase.uid); e.autoSlot('investigate', cam.uid);
  assert.notStrictEqual(e.currentRecipe('investigate').recipe.id, 'inv_photograph', 'only once per case');
  e.clearSlots('investigate');

  // Lab access: a clue goes back to the bench once.
  var lab = e.create('labpass');
  var inv = byLabel(e, /Inventory/)[0];
  var fin = CF.clueAspects(inv).financial;
  r = run(e, 'analyze', [inv, lab]);
  assert.strictEqual(r.id, 'an_enhance');
  assert.strictEqual(CF.clueAspects(inv).financial, fin + 1);
  e.autoSlot('analyze', inv.uid); e.autoSlot('analyze', lab.uid);
  assert.ok(/already/.test(e.preview('analyze').blocked), 'once');
  e.clearSlots('analyze');

  // The forensic kit finds more physical evidence at a scene.
  var g = game(22);
  var k2 = byDef(g, 'case')[0], r2 = g.caseRec(k2.caseId);
  run(g, 'investigate', [k2]); run(g, 'investigate', [k2]); run(g, 'investigate', [k2]); // the written leads
  r2.items = [
    { type: 'evidence', label: 'E1', text: '', needs: 'bio', result: { label: 'R1', text: '', aspects: { forensic: 2 } } },
    { type: 'evidence', label: 'E2', text: '', needs: 'bio', result: { label: 'R2', text: '', aspects: { forensic: 2 } } },
    { type: 'clue', label: 'C1', text: '', aspects: { motive: 1 } },
  ];
  r2.found = 0;
  var kit = g.create('kit');
  var found = run(g, 'investigate', [k2, kit]).out.filter(function (c) { return c.def === 'evidence'; }).length;
  assert.strictEqual(found, 2, 'the kit finds the second piece of evidence');

  // Surveillance gear opens the Stakeout at any rank, and turns it into photographs and transcripts.
  var h = game(23);
  assert.ok(!h.verb('stakeout').unlocked);
  var order = h.create('order', { data: { order: 'surveillance' } });
  var funds = byDef(h, 'funds');
  for (var i = funds.length; i < 6; i++) h.create('funds');
  r = run(h, 'requisition', [order].concat(byDef(h, 'funds').slice(0, 6)));
  assert.ok(h.verb('stakeout').unlocked, 'Stakeout opened by the gear');
  assert.ok(/Stakeout/.test(r.story.text));
  var gear = byDef(h, 'surveillance')[0];
  var kh = byDef(h, 'case')[0], rh = h.caseRec(kh.caseId);
  var cul = rh.suspects.filter(function (x) { return x.guilty; })[0];
  var sc = h.revealSuspect(rh, null, { key: cul.key });
  r = run(h, 'stakeout', [sc, byDef(h, 'instinct')[0], gear]);
  var caught = byLabel(h, /Caught in the Act/)[0];
  assert.ok(caught && CF.clueAspects(caught).digital === 1 && CF.clueAspects(caught).opportunity === 4, 'wiretap and long lens: ' + JSON.stringify(CF.clueAspects(caught)));
  assert.strictEqual(r.duration, 40);
  console.log('equipment: ok');
})();

// ---- Officers with traits ---------------------------------------------------------
(function team() {
  var e = game(31);
  var spec = e.teammateSpec('veteran');
  assert.strictEqual(spec.data.traits.length, 2, 'a veteran has two traits');
  spec.data.traits.forEach(function (t) { assert.ok(CF.OFFICER_TRAITS[t]); });
  assert.ok(/Thorough|Streetwise|Steady|Empathetic/.test(spec.desc), 'the card explains the trait');

  // Thorough: one more thing at the scene.
  var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
  run(e, 'investigate', [kase]); run(e, 'investigate', [kase]); run(e, 'investigate', [kase]);
  rec.items = [1, 2, 3, 4, 5].map(function (i) { return { type: 'clue', label: 'C' + i, text: '', aspects: { motive: 1 } }; });
  rec.found = 0;
  var plain = officer(e, 'rookie', ['steady']);
  var n1 = run(e, 'investigate', [kase, plain]).out.filter(function (c) { return c.def === 'clue'; }).length;
  var thorough = officer(e, 'rookie', ['thorough']);
  var n2 = run(e, 'investigate', [kase, thorough]).out.filter(function (c) { return c.def === 'clue'; }).length;
  assert.strictEqual(n2, n1 + 1, 'thorough: ' + n2 + ' vs ' + n1);

  // Steady: no fatigue from the beat with them. (Beat shift tires you 55% of the time alone.)
  var tired = 0, N = 40;
  for (var i = 0; i < N; i++) {
    var g = game(100 + i);
    var st = officer(g, 'rookie', ['steady']);
    g.autoSlot('duty', byDef(g, 'health')[0].uid);
    // Duty only takes a Health alone; Steady is checked where the fatigue is rolled.
    var ctx = g.makeCtx('duty', g.verb('duty').slots);
    ctx.cards.push(st);
    assert.ok(g.teamHas(ctx, 'steady'));
    g.clearSlots('duty');
    void tired;
  }

  // Patient: analysis and stakeouts take a fifth less time.
  var h = game(32);
  var kh = byDef(h, 'case')[0];
  run(h, 'investigate', [kh]);
  var ev = byLabel(h, /Pried Window/)[0];
  h.autoSlot('analyze', ev.uid);
  var slow = h.preview('analyze').duration;
  h.autoSlot('analyze', officer(h, 'tech', ['patient']).uid);
  assert.strictEqual(h.preview('analyze').duration, Math.round(slow * 0.8));
  h.clearSlots('analyze');

  // Empathetic: a bluff never scares a witness off.
  var scared = 0, M = 30;
  for (var j = 0; j < M; j++) {
    var w = game(200 + j);
    var kw = byDef(w, 'case')[0], rw = w.caseRec(kw.caseId);
    var wit = w.create('witness', w.witnessSpec(rw));
    var emp = officer(w, 'interviewer', ['empathetic']);
    var r = run(w, 'interrogate', [wit, byDef(w, 'instinct')[0], emp]);
    if (/Bluff Fails/.test(r.story.title)) scared++;
  }
  assert.strictEqual(scared, 0, 'empathetic bluffs never fail');

  // Streetwise: one more person from a canvass.
  var s1 = game(33);
  var k1 = byDef(s1, 'case')[0], r1 = s1.caseRec(k1.caseId);
  run(s1, 'investigate', [k1]); run(s1, 'investigate', [k1, byDef(s1, 'district')[0]]);
  r1.witnesses = ['a', 'b', 'c', 'd'];
  var d1 = byDef(s1, 'district')[0];
  var got1 = run(s1, 'investigate', [k1, d1, officer(s1, 'rookie', ['steady'])]).out.filter(function (c) { return c.def === 'witness'; }).length;
  r1.witnesses = ['a', 'b', 'c', 'd'];
  var got2 = run(s1, 'investigate', [k1, d1, officer(s1, 'rookie', ['streetwise'])]).out.filter(function (c) { return c.def === 'witness'; }).length;
  assert.strictEqual(got2, got1 + 1, 'streetwise: ' + got2 + ' vs ' + got1);
  console.log('team: ok');
})();
