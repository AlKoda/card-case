// Phases 12–13: informants bring intelligence on their own time and can be
// burned; criminals who get away keep a record and keep working.
// Run: node tests/criminals.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

['js/util.js', 'js/i18n.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/data/structures.js', 'js/data/story.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/systems/informants.js', 'js/systems/criminals.js', 'js/systems/sentence.js', 'js/systems/purse.js', 'js/systems/origins.js', 'js/systems/coquille.js', 'js/systems/patrons.js', 'js/systems/societies.js', 'js/systems/network.js', 'js/systems/callings.js', 'js/systems/intro.js', 'js/systems/life.js', 'js/core/recipes.js', 'js/data/recipes.js'].forEach(function (f) {
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
  var v = e.verb(verb), out = v.out.map(function (u) { return e.card(u); }), story = v.story, id = v.recipe;
  if (v.status === 'done') e.collect(verb);
  return { out: out, story: story, id: id };
}

// ---- Informants talk on their own time ---------------------------------------------
(function informants() {
  var e = game(41, 'crusader'); // starts with an informant
  var inf = byDef(e, 'informant')[0];
  assert.ok(inf && inf.data.trust === 1 && inf.data.heat === 0);
  assert.strictEqual(e.informantStatus(inf), 'safe');
  var faster = e.informantInterval({ data: { trust: 3 } }), slower = e.informantInterval({ data: { trust: 0 } });
  assert.ok(faster < slower, 'trust makes them talk more often');

  // Each tip is one of three things.
  var kinds = {};
  for (var i = 0; i < 30; i++) {
    var g = game(300 + i, 'crusader');
    if (i % 2) g.create('atlarge', { label: 'At Large: Someone', data: { name: 'Some One', trait: 'limp' } });
    kinds[g.informantTip(byDef(g, 'informant')[0])] = true;
  }
  assert.ok(kinds.rumor && kinds.sighting && kinds.warning, 'rumor, sighting, warning: ' + Object.keys(kinds));

  // A rumor is a clue about an open case that carries the culprit's description.
  var r = game(42, 'crusader');
  var rec = r.caseRec(byDef(r, 'case')[0].caseId);
  var kind; for (var j = 0; j < 20 && kind !== 'rumor'; j++) { r.rng.setState(j * 31 + 1); kind = r.informantTip(byDef(r, 'informant')[0]); }
  var rumor = r.tableCards().filter(function (c) { return /^Rumour/.test(r.labelOf(c)); })[0];
  assert.ok(rumor && rumor.caseId === rec.id && rumor.data.trait === rec.suspects.filter(function (x) { return x.guilty; })[0].trait);

  // A warning foreshadows the next case: it comes sooner, with more time and a name.
  var w = game(43, 'crusader');
  var winf = byDef(w, 'informant')[0];
  var k; for (var m = 0; m < 30 && k !== 'warning'; m++) { w.rng.setState(m * 17 + 3); k = w.informantTip(winf); }
  assert.strictEqual(k, 'warning');
  var warn = byDef(w, 'intel')[0];
  assert.ok(w.s.nextCase && w.s.nextCase.template === warn.data.template);
  assert.ok(w.s.dispatchT <= 70, 'the case is coming sooner');
  var nCases = byDef(w, 'case').length, trust0 = winf.data.trust;
  w.tick(w.s.dispatchT + 0.5);
  var cases = byDef(w, 'case');
  assert.strictEqual(cases.length, nCases + 1);
  var newRec = w.caseRec(cases[cases.length - 1].caseId);
  assert.strictEqual(newRec.template, warn.data.template, 'the warned-of case arrived');
  assert.ok(!w.card(warn.uid), 'the warning was used up');
  assert.strictEqual(cases[cases.length - 1].maxLife, Math.round(CF.CASE_TEMPLATES[newRec.template].lifetime * 1.5) + CF.INFORMANT.warningExtraTime);
  assert.ok(newRec.suspects.some(function (x) { return x.revealed; }), 'a first name on the board');
  assert.strictEqual(winf.data.trust, trust0 + 1, 'a warning that came true earns trust');

  // A sighting plus the At Large card in Reflect starts a manhunt.
  var sg = game(44, 'crusader');
  var al = sg.create('atlarge', { label: 'At Large: Vance Zorn', data: { name: 'Vance Zorn', trait: 'van' } });
  var sight = sg.create('intel', { label: 'Sighting: Vance Zorn', data: { kind: 'sighting', criminal: 'Vance Zorn' } });
  var res = run(sg, 'reflect', [sight, al]);
  assert.strictEqual(res.id, 'ref_sighting');
  assert.ok(res.out.some(function (c) { return c.def === 'case' && sg.caseRec(c.caseId).template === 'manhunt'; }));
  assert.ok(al.data.hunted);

  // Ignored intelligence costs trust; the tip clock runs on the table.
  var ig = game(45, 'crusader');
  var iinf = byDef(ig, 'informant')[0];
  ig.create('intel', { label: 'Warning: x', data: { kind: 'warning', template: 'arson', district: 'canal', informant: iinf.uid }, decay: 2 });
  ig.tick(3);
  assert.strictEqual(iinf.data.trust, 0, 'they notice');
  var tipsBefore = ig.s.journal.length;
  ig.tick(CF.INFORMANT.firstTip + 1);
  assert.ok(ig.s.journal.length > tipsBefore, 'a tip arrived on its own');

  // Heat: meetings warm them up; at three they are compromised and go quiet; Protect resets it.
  var h = game(46, 'crusader');
  var hinf = byDef(h, 'informant')[0];
  h.heatInformant(hinf, 3);
  assert.strictEqual(h.informantStatus(hinf), 'compromised');
  assert.ok(/^Compromised/.test(h.labelOf(hinf)));
  hinf.data.tipT = 1;
  var jn = h.s.journal.length;
  h.tick(2);
  assert.strictEqual(h.s.journal.length, jn, 'compromised informants say nothing');
  var officer = h.create('teammate', h.teammateSpec('rookie'));
  h.autoSlot('duty', hinf.uid);
  assert.ok(/watchman/i.test(h.preview('duty').blocked));
  h.autoSlot('duty', officer.uid);
  var pr = run(h, 'duty', []);
  assert.strictEqual(pr.id, 'duty_protect');
  assert.strictEqual(hinf.data.heat, 0);
  assert.ok(/^Informant/.test(h.labelOf(hinf)));

  // Burned while compromised: a missing person case.
  var b = game(47, 'crusader');
  var binf = byDef(b, 'informant')[0];
  b.heatInformant(binf, 3);
  var open0 = b.openCases().length;
  b.burnInformant(binf, 'gone');
  assert.ok(!b.card(binf.uid));
  var missing = b.openCases().filter(function (r) { return r.template === 'missing'; })[0];
  assert.ok(missing && missing.victim === 'Whistle' || (missing && b.openCases().length === open0 + 1), 'the informant becomes a case');
  assert.strictEqual(missing.victim, binf.data.name);
  console.log('informants: ok');
})();

// ---- Criminals persist -------------------------------------------------------------
(function criminals() {
  var e = game(51);
  var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
  var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
  // Goes cold: a record and a card.
  kase.life = 0.1; e.tick(1);
  assert.strictEqual(rec.status, 'cold');
  var crim = e.criminalByName(culprit.name);
  assert.ok(crim && crim.crimes === 1 && crim.status === 'at_large' && crim.trait === culprit.trait);
  assert.strictEqual(CF.Criminals.rankOf(crim).label, 'Petty Thief');
  var al = byDef(e, 'atlarge')[0];
  assert.strictEqual(al.data.criminalId, crim.id);
  assert.ok(/^Petty Thief: /.test(e.labelOf(al)));
  assert.ok(/1 crime on the record/.test(al.desc));

  // Weeks pass: they commit new crimes that arrive as cases with their name on them.
  var again = null;
  for (var wk = 0; wk < 30 && !again; wk++) {
    e.criminalsAct();
    again = e.openCases().filter(function (r) { return r.criminalId === crim.id; })[0];
  }
  assert.ok(again, 'a new case from the same criminal');
  assert.strictEqual(again.suspects.filter(function (x) { return x.guilty; })[0].name, culprit.name);
  assert.strictEqual(again.suspects.filter(function (x) { return x.guilty; })[0].trait, culprit.trait);
  assert.strictEqual(crim.crimes, 2);
  assert.strictEqual(CF.Criminals.rankOf(crim).label, 'Old Offender');
  assert.ok(/^Old Offender: /.test(e.labelOf(al)), 'the card follows the record');
  // Rank makes the court want more.
  var T = CF.CASE_TEMPLATES[again.template];
  assert.strictEqual(again.charge[T.keyAspects[0]], T.charge[T.keyAspects[0]] + 1 + (again.highProfile && !T.highProfile ? 1 : 0));

  // A conviction jails them; a wrongful conviction puts the real culprit at large.
  e.criminalCaught(culprit.name);
  assert.strictEqual(crim.status, 'jailed');
  assert.strictEqual(e.criminalsAtLarge().length, 0);

  // Acquittal: the guilty walk, careful now.
  var a = game(52);
  var ak = byDef(a, 'case')[0], ar = a.caseRec(ak.caseId);
  var acul = ar.suspects.filter(function (x) { return x.guilty; })[0];
  var t = a.create('trial', { data: { caseId: ar.id, name: acul.name, guilty: true, solid: false, tier: 'weak', real: 0, need: 6, coerced: 0, planted: 0, illegal: 0, contradictions: 0 } });
  a.rng.setState(999);
  var tries = 0;
  while (ar.status !== 'acquitted' && tries++ < 10) { ar.status = 'trial'; if (!a.card(t.uid)) t = a.create('trial', { data: t.data }); a.verdict(t); }
  assert.strictEqual(ar.status, 'acquitted');
  var ac = a.criminalByName(acul.name);
  assert.ok(ac && ac.traits.indexOf('careful') >= 0, 'careful after court');
  var aal = byDef(a, 'atlarge')[0];
  assert.strictEqual(aal.data.trait, acul.trait, 'the card keeps their trait');
  // A careful criminal's next scene gives up less.
  var normal = a.spawnCase('burglary', { quiet: true });
  var careful = a.spawnCase('burglary', { quiet: true, culpritName: acul.name, culpritTrait: acul.trait, criminalId: ac.id });
  assert.ok(a.caseRec(careful.caseId).items.length < a.caseRec(normal.caseId).items.length);

  // Gangs: members join; the ladder continues.
  var g = game(53);
  for (var i = 0; i < 3; i++) {
    var c = g.criminalEscapes({ title: 'x' + i }, { name: 'Crook ' + i, trait: 'limp' }, 'cold');
    g.create('atlarge', { label: 'At Large: Crook ' + i, data: { name: 'Crook ' + i, trait: 'limp', criminalId: c.id } });
  }
  g.organise();
  assert.strictEqual(g.countOf('gang'), 1);
  var member = g.criminalByName('Crook 0');
  assert.strictEqual(member.organization, 'gang');
  assert.strictEqual(CF.Criminals.rankOf(member).label, 'Sworn of a Band');
  member.crimes = 4;
  assert.strictEqual(CF.Criminals.rankOf(member).label, 'Upright Man');
  g.spawnSyndicate('x');
  assert.strictEqual(CF.Criminals.rankOf(member).label, 'Of the Coquille');

  // Records survive save/load and ride the legacy.
  var s2 = CF.Engine.load(g.save());
  assert.strictEqual(s2.criminalByName('Crook 1').organization, 'syndicate');
  var L = g.buildLegacy();
  assert.strictEqual(L.criminals.length, 3);
  var next = game(54);
  next.applyLegacy(L);
  assert.ok(next.criminalByName('Crook 2'), 'the successor inherits the record');
  console.log('criminals: ok');
})();
