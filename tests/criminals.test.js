// Phases 12–13: informants bring intelligence on their own time and can be
// burned; criminals who get away keep a record and keep working.
// Run: node tests/criminals.test.js
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
  assert.strictEqual(cases[cases.length - 1].maxLife, Math.round(CF.CASE_TEMPLATES[newRec.template].lifetime * w.caseClock()) + CF.INFORMANT.warningExtraTime);
  assert.ok(newRec.suspects.some(function (x) { return x.revealed; }), 'a first name on the board');
  assert.strictEqual(winf.data.trust, trust0 + 1, 'a warning that came true earns trust');

  // A warning whose card runs out while its case still waits (the desk was
  // full) keeps its promise: the case comes with the time and the name.
  var w2 = game(43, 'crusader');
  var winf2 = byDef(w2, 'informant')[0];
  var k2; for (var m2 = 0; m2 < 30 && k2 !== 'warning'; m2++) { w2.rng.setState(m2 * 17 + 3); k2 = w2.informantTip(winf2); }
  assert.strictEqual(k2, 'warning');
  var warn2 = byDef(w2, 'intel')[0], trust2 = winf2.data.trust;
  w2.s.nextCase.extraTime = 0;
  w2.s.dispatchT = 1e9; // the case does not come yet
  w2.expire(warn2);
  assert.ok(!w2.card(warn2.uid), 'the card is gone');
  assert.ok(w2.s.nextCase && w2.s.nextCase.warned && w2.s.nextCase.warned.informant === winf2.uid, 'its promise rides the queued case');
  assert.strictEqual(winf2.data.trust, trust2, 'no trust lost for a full desk');
  w2.s.dispatchT = 0.1;
  var n2 = byDef(w2, 'case').length;
  w2.tick(1);
  var cases2 = byDef(w2, 'case');
  assert.strictEqual(cases2.length, n2 + 1, 'the warned-of case arrived later');
  var rec2 = w2.caseRec(cases2[cases2.length - 1].caseId);
  assert.strictEqual(rec2.template, warn2.data.template);
  assert.strictEqual(cases2[cases2.length - 1].maxLife, Math.round(CF.CASE_TEMPLATES[rec2.template].lifetime * w2.caseClock()) + CF.INFORMANT.warningExtraTime, 'with the extra time');
  assert.ok(rec2.suspects.some(function (x) { return x.revealed; }), 'and the name');
  assert.strictEqual(winf2.data.trust, trust2 + 1, 'and the informer is thanked');

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
  assert.ok(/^Informer: /.test(h.labelOf(hinf)), 'the label says Informer: ' + h.labelOf(hinf));
  // Crossing to Compromised is told once, by name; cooling and more heat on a marked informer are not.
  var m = game(48, 'crusader');
  var minf = byDef(m, 'informant')[0];
  var marked = function () { return m.s.journal.filter(function (j) { return j.title === 'Marked: ' + minf.data.name; }).length; };
  m.heatInformant(minf, 2);
  assert.strictEqual(marked(), 0, 'warm is not marked');
  m.heatInformant(minf, 1);
  assert.strictEqual(marked(), 1, 'told on crossing');
  assert.ok(/asked, by name, who .*friend at the Watch-house is/.test(m.s.journal[0].text) && m.s.journal[0].kind === 'danger');
  m.heatInformant(minf, 1);
  assert.strictEqual(marked(), 1, 'not told twice');
  m.heatInformant(minf, -4);
  m.heatInformant(minf, 3);
  assert.strictEqual(marked(), 2, 'told again after a Protect and a new crossing');

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

// ---- A paid meeting says what the informer has, and costs nothing when they have nothing ----
(function informerOffer() {
  var e = game(49, 'crusader');
  var inf = byDef(e, 'informant')[0];
  var coin = function () { return byDef(e, 'funds').length; };
  while (coin() < 3) e.create('funds');
  e.s.flags.marketOpen = true;
  // An unnamed case on the desk: they have heard talk of it.
  var open = e.openCases().filter(function (r) { return !r.special; });
  open.slice(1).forEach(function (r) { r.identified = r.suspects[0].key; });
  e.cardsOf('atlarge', true).forEach(function (c) { e.remove(c); });
  e.autoSlot('investigate', inf.uid); e.autoSlot('investigate', byDef(e, 'funds')[0].uid);
  var pv = e.preview('investigate');
  assert.strictEqual(e.currentRecipe('investigate').recipe.id, 'patrol_informant');
  assert.ok(pv.text.indexOf(inf.data.name + ' has heard talk of ' + open[0].title + '.') === 0, pv.text);
  e.clearSlots('investigate');
  // Every case named and a warning queued: where it will come from, once.
  open[0].identified = open[0].suspects[0].key;
  e.s.nextCase = { template: 'arson', district: 'canal', extraTime: 0 };
  var heat0 = inf.data.heat, coin0 = coin();
  e.autoSlot('investigate', inf.uid); e.autoSlot('investigate', byDef(e, 'funds')[0].uid);
  assert.ok(/knows where the next case will come from\./.test(e.preview('investigate').text));
  var r = run(e, 'investigate', []);
  assert.strictEqual(r.story.title, 'The Next Door');
  assert.ok(r.story.text.indexOf(CF.DISTRICTS.canal.label) >= 0, r.story.text);
  assert.ok(e.s.nextCase.told && e.s.nextCase.district === 'canal');
  assert.strictEqual(coin(), coin0 - 1, 'the Coin was paid for a real answer');
  assert.ok(e.hasDistrict('canal'), 'and the Quarter is yours to walk');
  // Nothing more to give: the meeting is refused before anything is spent.
  heat0 = inf.data.heat; coin0 = coin();
  e.autoSlot('investigate', inf.uid); e.autoSlot('investigate', byDef(e, 'funds')[0].uid);
  var none = e.preview('investigate');
  assert.strictEqual(none.blocked, inf.data.name + ' has nothing for you this week. Keep your Coin.');
  assert.ok(!e.start('investigate'));
  e.clearSlots('investigate');
  assert.strictEqual(coin(), coin0); assert.strictEqual(inf.data.heat, heat0);
  // Someone Abroad and room on the desk: a sighting is certain when it is all they have.
  var al = e.create('atlarge', { label: 'Abroad: Vance Zorn', data: { name: 'Vance Zorn', trait: 'limp' } });
  e.autoSlot('investigate', inf.uid); e.autoSlot('investigate', byDef(e, 'funds')[0].uid);
  assert.ok(/may know where someone Abroad sleeps\./.test(e.preview('investigate').text));
  assert.ok(e.roomForCase(1), 'room on the desk');
  assert.strictEqual(run(e, 'investigate', []).story.title, 'A Sighting');
  void al;
  // An older save's queued case has not been told.
  var old = JSON.parse(e.save()); old.nextCase = { template: 'arson', district: 'canal', extraTime: 0 };
  assert.strictEqual(CF.Engine.load(old).s.nextCase.told, false);
  console.log('informer offer: ok');
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
  // (An Examiner's Court wants two of anything at most; the offender's record adds one on top.)
  assert.strictEqual(again.charge[T.keyAspects[0]], Math.min(2, T.charge[T.keyAspects[0]] + (again.highProfile && !T.highProfile ? 1 : 0)) + 1);

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
  // The sworn keep their Abroad cards, marked with the band, and do not count as loose.
  var band = byDef(g, 'gang')[0];
  var sworn = byDef(g, 'atlarge');
  assert.strictEqual(sworn.length, 3, 'the three stay on the table');
  assert.ok(sworn.every(function (c) { return c.data.band === band.data.name && /^Sworn of a Band: /.test(g.labelOf(c)); }), 'marked as sworn');
  g.organise();
  assert.strictEqual(g.countOf('gang'), 1, 'the sworn do not form a second band');
  // The court asks one more point a rung, but an Examiner's court at most one.
  member.crimes = 4;
  assert.strictEqual(CF.Criminals.rankOf(member).label, 'Upright Man');
  assert.strictEqual(g.caseRankBonus(member.id), 1, 'capped at rank 0');
  g.s.rank = 1;
  assert.strictEqual(g.caseRankBonus(member.id), CF.Criminals.rankIndex(member));
  assert.strictEqual(g.caseRankBonus(null), 0, 'nothing without a record');
  g.s.rank = 0;
  // Post the Watch: a watchman on the stair cools the Vendetta, and may follow one of them home.
  g.s.rank = 0;
  var officer = g.create('teammate', g.teammateSpec('rookie'));
  g.meter('retaliation', 3);
  var ret0 = g.s.meters.retaliation;
  var titles = {};
  for (var pw = 0; pw < 12 && !titles['Followed Home']; pw++) {
    g.rng.setState(pw * 13 + 5);
    var pr = run(g, 'duty', [band, officer]);
    assert.strictEqual(pr.id, 'duty_post_watch');
    titles[pr.story.title] = true;
    if (pw === 0) assert.strictEqual(g.s.meters.retaliation, ret0 - 1, 'the Vendetta cools');
    g.openCases().filter(function (r) { return r.template === 'manhunt'; }).forEach(function (r) { r.status = 'cold'; });
  }
  assert.ok(titles['Followed Home'], 'a sighting from the stair: ' + JSON.stringify(titles));
  assert.ok(sworn.some(function (c) { return c.data.hunted; }), 'one of the sworn is hunted');
  // The band broken: the rest scatter, smaller men, and are plain Abroad again.
  var gangRec = g.spawnCase('gang', { quiet: true, gangName: band.data.name, gangUid: band.uid });
  var grec = g.caseRec(gangRec.caseId);
  g.onConviction(grec, { guilty: true, solid: true, name: 'Crook 0' }, []);
  assert.strictEqual(g.countOf('gang'), 0);
  assert.strictEqual(g.criminalByName('Crook 1').organization, 'none');
  assert.strictEqual(g.criminalByName('Crook 1').crimes, 0, 'crimes halved');
  assert.ok(g.criminalByName('Crook 1').history.some(function (h) { return h.how === 'scattered'; }));
  assert.ok(byDef(g, 'atlarge').every(function (c) { return !c.data.band && !/^Sworn/.test(g.labelOf(c)); }), 'plain Abroad again');
  byDef(g, 'atlarge').forEach(function (c) { c.data.band = 'the Old Band'; });
  g.criminalJoins('Crook 0', 'gang'); g.criminalJoins('Crook 1', 'gang'); g.criminalJoins('Crook 2', 'gang');
  member.crimes = 4;
  g.spawnSyndicate('x');
  assert.strictEqual(CF.Criminals.rankOf(member).label, 'Of the Coquille');
  assert.ok(g.caseRankBonus(member.id) >= 1);
  // The Coquille broken: every record of it is nobody's again, and the rank bonus goes.
  var kase = g.spawnCase('syndicate', { quiet: true });
  var krec = g.caseRec(kase.caseId);
  g.onConviction(krec, { guilty: false, solid: true, name: 'Nobody' }, []);
  assert.ok(g.s.flags.syndicateFallen);
  assert.strictEqual(g.criminalByName('Crook 2').organization, 'none');
  assert.ok(byDef(g, 'atlarge').every(function (c) { return !c.data.band; }));
  member.organization = 'syndicate';
  assert.strictEqual(g.caseRankBonus(member.id), 0, 'no bonus for the fallen Coquille');
  member.organization = 'none';
  g.criminalJoins('Crook 1', 'syndicate');

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

// ---- A wrongful conviction surfaces later ---------------------------------------------
(function wrongful() {
  var p0 = CF.Criminals.WEEKLY_CRIME;
  CF.Criminals.WEEKLY_CRIME = 0; // no new crime: the ballad tells it
  var e = game(61);
  var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
  var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
  var innocent = rec.suspects.filter(function (x) { return !x.guilty; })[0];
  innocent.alibi = 'a wedding, and forty guests who remember the dancing'; // the story they gave in Question
  e.remove(kase);
  var t = e.create('trial', { data: { caseId: rec.id, name: innocent.name, guilty: false, solid: false, tier: 'reasonable', real: 6, need: 6, coerced: 0, planted: 1, illegal: 0, contradictions: 0 } });
  var saved = e.save(), g = null;
  for (var i = 0; i < 40 && !g; i++) {
    var gg = CF.Engine.load(saved);
    gg.rng.setState(i * 77 + 3);
    gg.verdict(gg.card(t.uid));
    if (gg.caseRec(rec.id).status === 'closed') g = gg;
  }
  assert.ok(g, 'a wrongful conviction');
  var guilty = g.s.journal.filter(function (j) { return /^Guilty: /.test(j.title); })[0];
  assert.ok(guilty && /down to the Hole/.test(guilty.text) && !/staff/.test(guilty.text), 'the staff waits for the sentence');
  var crim = g.criminalByName(culprit.name);
  assert.ok(crim && crim.hidden && crim.surfaceWeek >= g.s.week + 2 && crim.surfaceWeek <= g.s.week + 4, 'hidden for a few weeks');
  assert.strictEqual(byDef(g, 'atlarge').length, 0, 'no Abroad card the same tick');
  g.criminalsAct();
  assert.strictEqual(byDef(g, 'atlarge').length, 0, 'nor the same week');
  // The wrong name's end goes on the real culprit's record: nothing yet, then the rung.
  assert.strictEqual(crim.wrongfulHow, null, 'no sentence yet');
  var hidden = g.save();
  var cond = byDef(g, 'condemned')[0];
  assert.ok(cond && cond.data.caseId === rec.id && !cond.data.guilty, 'the innocent waits in the Hole');
  g.passSentence(cond, 'rope', null, {});
  assert.strictEqual(crim.wrongfulHow, 'rope', 'the rope, on the record');
  var pr0 = g.s.meters.pressure;
  for (var wk = 0; wk < 4; wk++) { g.s.week++; g.criminalsAct(); }
  assert.ok(!crim.hidden, 'surfaced');
  var al = byDef(g, 'atlarge')[0];
  assert.ok(al && al.data.criminalId === crim.id && al.desc.indexOf('Someone else hanged for ' + rec.title + '.') > 0, 'the Abroad card, after four weeks: ' + al.desc);
  assert.strictEqual(g.s.meters.pressure, pr0 + 1, 'the Crowd hears the ballad');
  var story = g.s.journal.filter(function (j) { return j.title === 'The Wrong Name'; })[0];
  assert.ok(story && story.text.indexOf(culprit.name) === 0 && story.text.indexOf(rec.title) > 0 && /the one you sent down/.test(story.text), 'the ballad names them');
  // The ballad tells where the wrong name really was: their own alibi, true after all.
  assert.strictEqual(crim.wrongfulAlibi, innocent.alibi, 'the wrong name\'s own alibi is kept');
  assert.ok(/the one you sent down was dancing at a wedding before forty guests that night/.test(story.text), 'the true alibi: ' + story.text);
  assert.ok(!/drunkenness/.test(story.text), 'not the same verse every time');
  // Pardoned, nobody hanged, and the ballad does not say so.
  var g2 = CF.Engine.load(hidden), crim2 = g2.criminalByName(culprit.name);
  g2.passSentence(byDef(g2, 'condemned')[0], 'pardon', null, {});
  assert.strictEqual(crim2.wrongfulHow, 'pardon');
  for (var wk2 = 0; wk2 < 4; wk2++) { g2.s.week++; g2.criminalsAct(); }
  var al2 = byDef(g2, 'atlarge').filter(function (c) { return c.data.criminalId === crim2.id; })[0];
  assert.ok(al2 && al2.desc.indexOf('Someone else answered for ' + rec.title + '.') > 0, 'pardoned: answered for, not hanged: ' + al2.desc);
  // Taken by the Inquisitor: the wrong one burned, and the player sent nobody down.
  var inq = null;
  for (var k = 0; k < 20 && !inq; k++) {
    var gi = CF.Engine.load(saved); gi.s.flags.inquisitor = true; gi.rng.setState(k * 13 + 1);
    gi.inquisitorSeizes(gi.caseRec(rec.id));
    var ci = gi.criminalByName(culprit.name);
    if (ci && ci.hidden) inq = gi;
  }
  assert.ok(inq, 'the Inquisitor names the wrong one');
  var crim3 = inq.criminalByName(culprit.name);
  assert.strictEqual(crim3.wrongfulHow, 'burned');
  for (var wk3 = 0; wk3 < 4; wk3++) { inq.s.week++; inq.criminalsAct(); }
  var al3 = byDef(inq, 'atlarge').filter(function (c) { return c.data.criminalId === crim3.id; })[0];
  var story3 = inq.s.journal.filter(function (j) { return j.title === 'The Wrong Name'; })[0];
  assert.ok(al3 && al3.desc.indexOf('Someone else burned for ' + rec.title + '.') > 0, 'burned: ' + al3.desc);
  assert.ok(story3 && /the one the Inquisitor burned/.test(story3.text) && !/sent down/.test(story3.text), 'the ballad does not blame you: ' + story3.text);
  assert.ok(CF.PROSE.alibis.indexOf(crim3.wrongfulAlibi) >= 0 && story3.text.indexOf(' was ' + CF.PROSE.alibiTrue[crim3.wrongfulAlibi] + ' that night') > 0, 'an alibi from the pool: ' + story3.text);
  // Every alibi has its true telling, and a save from before keeps a hidden record's alibi steady.
  CF.PROSE.alibis.forEach(function (a) { assert.ok(CF.PROSE.alibiTrue[a], 'a true telling for ' + a); });
  var old = JSON.parse(hidden);
  Object.keys(old.criminals).forEach(function (k) { delete old.criminals[k].wrongfulAlibi; });
  var ol1 = CF.Engine.load(JSON.parse(JSON.stringify(old))), ol2 = CF.Engine.load(JSON.parse(JSON.stringify(old)));
  var oc = ol1.criminalByName(culprit.name);
  assert.ok(CF.PROSE.alibis.indexOf(oc.wrongfulAlibi) >= 0 && oc.wrongfulAlibi === ol2.criminalByName(culprit.name).wrongfulAlibi, 'an old save gets one alibi, the same each load');
  // The staff: a death sentence breaks it.
  CF.Criminals.WEEKLY_CRIME = p0;
  console.log('wrongful: ok');
})();

// ---- Criminals keep their trade; a spared man owes a debt --------------------------
(function trade() {
  var same = 0;
  for (var i = 0; i < 10; i++) {
    var e = game(70 + i);
    byDef(e, 'case').forEach(function (c) { e.remove(c); });
    var c = e.criminalEscapes({ title: 'x', template: 'burglary' }, { name: 'Crook ' + i, trait: 'limp' }, 'cold');
    assert.strictEqual(c.role, 'burglary');
    var again = null;
    for (var wk = 0; wk < 40 && !again; wk++) { e.criminalsAct(); again = e.openCases().filter(function (r) { return r.criminalId === c.id; })[0]; }
    assert.ok(again, 'a new crime');
    if (again.template === 'burglary') same++;
  }
  assert.ok(same >= 5, 'a burglar burgles: ' + same + '/10');
  // Spared records never join a band.
  var g = game(81);
  for (var k = 0; k < 3; k++) {
    var r = g.criminalEscapes({ title: 'y' + k }, { name: 'Spared ' + k, trait: 'limp' }, 'cold');
    r.traits.push('spared');
    g.create('atlarge', { label: 'Abroad: Spared ' + k, data: { name: 'Spared ' + k, trait: 'limp', criminalId: r.id } });
  }
  g.organise();
  assert.strictEqual(g.countOf('gang'), 0, 'a spared man is sworn to nobody');
  // A spared man's crime roll is, half the time, a warning instead.
  var warned = false;
  for (var s = 0; s < 40 && !warned; s++) {
    var h = game(90 + s);
    byDef(h, 'case').forEach(function (c) { h.remove(c); });
    var sp = h.criminalEscapes({ title: 'z', template: 'burglary' }, { name: 'Debtor', trait: 'limp' }, 'cold');
    sp.traits.push('spared');
    var lines = h.criminalsAct();
    var warn = byDef(h, 'intel').filter(function (c) { return c.data.kind === 'warning' && c.data.spared === sp.id; })[0];
    if (warn) {
      warned = true;
      assert.ok(h.s.nextCase && h.s.nextCase.template === warn.data.template, 'the warned-of case is coming');
      assert.ok(/pays a debt/.test(lines.join(' ')) && /One you spared pays a debt/.test(warn.desc));
      assert.strictEqual(sp.crimes, 1, 'a warning, not a crime');
    }
  }
  assert.ok(warned, 'a spared man pays his debt');
  console.log('trade: ok');
})();

// ---- The Rival answers a case: not a case gone cold ------------------------------------
(function rivalCloses() {
  var p0 = CF.Criminals.WEEKLY_CRIME;
  CF.Criminals.WEEKLY_CRIME = 0;
  var right = null, wrong = null;
  for (var i = 0; i < 40 && !(right && wrong); i++) {
    var e = game(300 + i);
    var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
    var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
    var pr0 = e.s.meters.pressure, rep0 = e.s.meters.reputation, cold0 = e.s.stats.cold, events = [];
    e.on(function (type, p) { if (type === 'resolved') events.push(p); });
    var res = e.rivalCloses(rec, 'Jost Ammann');
    assert.ok(res, 'the case was open');
    assert.strictEqual(rec.status, 'rival', 'answered by the Rival');
    assert.ok(!e.caseCard(rec.id), 'the case card leaves');
    assert.strictEqual(e.s.meters.pressure, pr0, 'the Crowd does not rise');
    assert.strictEqual(e.s.meters.reputation, Math.max(0, rep0 - 1), 'Standing -1');
    assert.strictEqual(e.s.stats.cold, cold0, 'not counted cold');
    assert.strictEqual(byDef(e, 'coldcase').length, 0, 'no Unanswered card');
    assert.strictEqual(byDef(e, 'atlarge').length, 0, 'nobody walks laughing');
    assert.ok(events.length === 1 && events[0].outcome === 'rival', 'the journal hears it as the Rival\'s');
    var story = e.s.journal.filter(function (j) { return j.title === 'Answered by the Rival'; })[0];
    assert.ok(story && story.text.indexOf('Jost Ammann has closed ' + rec.title) === 0, 'told once: ' + (story && story.text));
    assert.ok(!e.s.journal.some(function (j) { return j.title === 'The Trail Goes Cold'; }), 'and not as a cold trail');
    assert.strictEqual(e.rivalCloses(rec), null, 'a closed case cannot be closed twice');
    var crim = e.criminalByName(culprit.name);
    if (res.right) {
      assert.strictEqual(res.hanged, culprit.name);
      assert.ok(!crim || crim.status === 'dead', 'the culprit leaves the game');
      right = e;
    } else {
      assert.ok(res.hanged && res.hanged !== culprit.name, 'a wrong name hangs');
      assert.ok(crim && crim.hidden && crim.wrongfulHow === 'rival', 'the culprit lies low');
      wrong = { e: e, crim: crim, rec: rec };
    }
  }
  assert.ok(right && wrong, 'both ends happen');
  // The wrong name's ballad blames the Harbourmaster's examiner, not you.
  var w = wrong.e;
  w.s.meters.pressure = 0;
  for (var wk = 0; wk < 4; wk++) { w.s.week++; w.criminalsAct(); }
  var ballad = w.s.journal.filter(function (j) { return j.title === 'The Wrong Name'; })[0];
  assert.ok(ballad && /the one the Harbourmaster's examiner hanged was /.test(ballad.text) && !/sent down/.test(ballad.text), 'the Rival\'s wrong name: ' + (ballad && ballad.text));
  var al = byDef(w, 'atlarge').filter(function (c) { return c.data.criminalId === wrong.crim.id; })[0];
  assert.ok(al && al.desc.indexOf('Someone else hanged for ' + wrong.rec.title + '.') > 0, 'hanged, on the Abroad card');
  // A culprit already Abroad, hanged by the Rival: the card goes.
  var a = game(360), ak = byDef(a, 'case')[0], ar = a.caseRec(ak.caseId), ac = ar.suspects.filter(function (x) { return x.guilty; })[0];
  var rcd = a.criminalEscapes({ title: 'an old case' }, ac, 'cold');
  a.create('atlarge', { label: 'Abroad: ' + ac.name, data: { name: ac.name, criminalId: rcd.id } });
  var gone = false;
  for (var j = 0; j < 30 && !gone; j++) {
    var b = CF.Engine.load(a.save()); b.rng.setState(j * 7 + 1);
    var r2 = b.rivalCloses(b.caseRec(ar.id));
    if (r2.right) { assert.strictEqual(byDef(b, 'atlarge').length, 0, 'the Abroad card goes with the hanged'); assert.strictEqual(b.criminalByName(ac.name).status, 'dead'); gone = true; }
  }
  assert.ok(gone, 'the Rival hangs the right one in time');
  CF.Criminals.WEEKLY_CRIME = p0;
  console.log('rival closes: ok');
})();

// ---- An innocent acquitted is nobody to hunt; one name hangs once ----------------------
(function innocentAbroad() {
  var e = game(301), rec = e.openCases()[0];
  var innocent = rec.suspects.filter(function (x) { return !x.guilty; })[0];
  rec.status = 'trial';
  var cc = e.caseCard(rec.id); if (cc) e.remove(cc);
  var acquitted = false;
  for (var i = 0; i < 20 && !acquitted; i++) {
    var g = CF.Engine.load(e.save()); g.rng.setState(i * 13 + 5);
    g.verdict(g.create('trial', { data: { caseId: rec.id, name: innocent.name, guilty: false, solid: false, tier: 'weak', real: 1, need: 6, coerced: 0, planted: 0, contradictions: 0 } }));
    if (g.caseRec(rec.id).status === 'acquitted') { acquitted = true; e = g; }
  }
  assert.ok(acquitted, 'the innocent walked');
  var al = e.cardsOf('atlarge', true).filter(function (c) { return c.data.name === innocent.name; })[0];
  assert.ok(al && al.data.innocent && al.life > 0, 'their Abroad card is marked innocent, and leaves in time');
  assert.ok(!e.huntable(al), 'nobody to hunt');
  // No informer sees them, and a sighting brought anyway raises no hue and cry.
  var inf = e.create('informant', e.informantSpec('market'));
  for (var k = 0; k < 30; k++) e.informantTip(inf);
  assert.ok(!e.cardsOf('intel', true).some(function (c) { return c.data.kind === 'sighting' && c.data.criminal === innocent.name; }), 'no sighting of an innocent');
  assert.strictEqual(e.informerOffer().atlarge.indexOf(al), -1, 'a paid informer has no sighting of them');
  var sight = e.create('intel', { label: 'Sighting: ' + innocent.name, data: { kind: 'sighting', criminal: innocent.name } });
  e.autoSlot('reflect', sight.uid); e.autoSlot('reflect', al.uid);
  assert.strictEqual(e.preview('reflect').blocked, CF.INNOCENT_NO_HUNT, 'a sighting of an innocent is blocked: ' + e.preview('reflect').blocked);
  e.clearSlots('reflect');
  var before = e.openCases().filter(function (r) { return r.template === 'manhunt'; }).length;
  for (var w = 0; w < 6; w++) e.weekTick();
  assert.strictEqual(e.openCases().filter(function (r) { return r.template === 'manhunt' && r.suspects.some(function (x) { return x.guilty && x.name === innocent.name; }); }).length, 0, 'no hue and cry for them');
  void before;
  // They leave the city in the end.
  e.tick(al.life + 1);
  assert.ok(!e.card(al.uid), 'gone after their weeks');
  assert.ok(e.s.journal.some(function (j) { return j.title === 'Gone from the City'; }), 'and told');

  // Two hunts for one name: a hunt at trial still counts, and a conviction calls off the other.
  var h = game(302), cr = h.openCases()[0], cul = cr.suspects.filter(function (x) { return x.guilty; })[0];
  var crim = h.criminalEscapes(cr, cul, 'cold');
  var ab = h.create('atlarge', { label: 'Abroad: ' + cul.name, data: { name: cul.name, trait: cul.trait, criminalId: crim.id } });
  var A = h.spawnCase('manhunt', { culpritName: cul.name, culpritTrait: cul.trait, atLargeUid: ab.uid, criminalId: crim.id, headline: 'Hue and Cry: ' + cul.name });
  ab.data.hunted = A.caseId;
  var recA = h.caseRec(A.caseId);
  recA.status = 'trial';
  assert.ok(h.huntRunning(ab) && !h.huntable(ab), 'a hunt before the Court is still a hunt');
  var s2 = h.create('intel', { label: 'Sighting: ' + cul.name, data: { kind: 'sighting', criminal: cul.name } });
  h.autoSlot('reflect', s2.uid); h.autoSlot('reflect', ab.uid);
  assert.ok(/already hunting/.test(h.preview('reflect').blocked || ''), 'no second hue and cry while the first is at trial: ' + h.preview('reflect').blocked);
  h.clearSlots('reflect');
  // A second hunt raised all the same (an older save): the conviction in the first calls it off.
  var B = h.spawnCase('manhunt', { culpritName: cul.name, culpritTrait: cul.trait, criminalId: crim.id, headline: 'Sighting: ' + cul.name });
  var recB = h.caseRec(B.caseId);
  h.onConviction(recA, { name: cul.name, guilty: true, solid: true }, []);
  assert.strictEqual(recB.status, 'dropped', 'the other hue and cry is called off');
  assert.ok(!h.caseCard(recB.id), 'its card goes');
  assert.ok(h.s.journal.some(function (j) { return /^Called Off: /.test(j.title) && j.text.indexOf(cul.name + ' is already in the Hole') === 0; }), 'and it is told');
  // An older save's innocent Abroad card is marked on load.
  var o = game(303);
  var oc = o.create('atlarge', { label: 'Abroad: Old Name', desc: 'Old Name walked out of the Blood Court smiling. They were innocent, and now they hate you.', data: { name: 'Old Name', careful: true, criminalId: null } });
  var raw = JSON.parse(o.save()); delete raw.cards[oc.uid].data.innocent;
  var ol = CF.Engine.load(raw), olc = ol.card(oc.uid);
  assert.ok(olc.data.innocent === true && olc.life > 0, 'an older save: the innocent is marked, with weeks to leave');
  console.log('innocent abroad, one hunt per name: ok');
})();

// A hue and cry that goes cold sets the name loose again: at large, hotter,
// working again, and sightable by an informer again. An older save's stale
// 'hunted' record heals itself at the Bell.
(function huntEnds() {
  var g = game(311), cr = g.openCases()[0], cul = cr.suspects.filter(function (x) { return x.guilty; })[0];
  var crim = g.criminalEscapes(cr, cul, 'cold');
  var al = g.create('atlarge', { label: 'Abroad: ' + cul.name, data: { name: cul.name, trait: cul.trait, criminalId: crim.id, sighted: true } });
  var sight = g.create('intel', { label: 'Sighting: ' + cul.name, data: { kind: 'sighting', criminal: cul.name } });
  assert.ok(g.sightingOut(al), 'a sighting in hand: no second one for that name');
  var res = run(g, 'reflect', [sight, al]);
  assert.strictEqual(res.id, 'ref_sighting');
  var hunt = res.out.filter(function (c) { return c && c.def === 'case'; })[0];
  assert.ok(hunt, 'the hue and cry is raised');
  assert.strictEqual(crim.status, 'hunted', 'the record is hunted while it runs');
  var heat = crim.heat || 0;
  g.goCold(hunt.caseId);
  assert.strictEqual(crim.status, 'at_large', 'a cold hunt leaves them at large, not hunted for good');
  assert.strictEqual(crim.heat, heat + 1, 'and hotter');
  assert.ok(crim.traits.indexOf('slipped') >= 0 && /Slipped the hue and cry once\./.test(al.desc), 'the Abroad card says they slipped it');
  assert.ok(!al.data.sighted && !g.sightingOut(al) && g.huntable(al), 'and an informer can sight them again');
  assert.ok(crim.history.some(function (h) { return h.how === 'slipped'; }), 'on the record');
  // Every road that raises the hue and cry marks the record the same way.
  var h2 = game(312), cr2 = h2.openCases()[0], cul2 = cr2.suspects.filter(function (x) { return x.guilty; })[0];
  var crim2 = h2.criminalEscapes(cr2, cul2, 'cold');
  var al2 = h2.create('atlarge', { label: 'Abroad: ' + cul2.name, data: { name: cul2.name, trait: cul2.trait } });
  h2.huntBegins(al2, 'c999');
  assert.strictEqual(crim2.status, 'hunted', 'found by name when the card has no record id');
  assert.ok(h2.huntStale(crim2), 'no such hunt running: stale');
  h2.criminalsAct();
  assert.strictEqual(crim2.status, 'at_large', 'a stale hunted record is at large again at the Bell');
  console.log('a cold hue and cry sets them loose: ok');
})();

// ---- Turn the Watch's Eyes waits for a case already on its way; Old Ghosts pairs a case with its own; a hunt is tried for the crime ----------
(function queuedAndGhosts() {
  var e = game(71); e.s.rank = 3;
  var kase = byDef(e, 'case')[0], rec = e.caseRec(kase.caseId);
  var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
  kase.life = 0.1; e.tick(1);
  var crim = e.criminalByName(culprit.name);
  // The criminal's next crime is queued; the Quarter in Attend cannot overwrite it.
  e.s.nextCase = { template: e.criminalTrade(crim), culpritName: crim.name, culpritTrait: crim.trait, criminalId: crim.id, district: 'market', extraTime: 0, told: false };
  var queued = e.s.nextCase;
  var q = e.giveDistrict('market');
  assert.ok(e.autoSlot('duty', q.uid), 'a Quarter in Attend');
  var pv = e.preview('duty');
  assert.ok(pv && pv.label === 'Turn the Watch\'s Eyes', 'the Proclamation offers itself: ' + (pv && pv.label));
  assert.strictEqual(pv.blocked, 'Something is already on its way to your desk.');
  assert.ok(!e.start('duty'), 'and does not start');
  assert.strictEqual(e.s.nextCase, queued, 'the queued case is untouched');
  e.clearSlots('duty');
  e.s.dispatchT = 0; e.s.cases[rec.id].status = 'cold';
  e.openCases().forEach(function (r) { r.status = 'closed'; });
  for (var i = 0; i < 400 && e.s.nextCase; i++) e.tick(1);
  assert.ok(e.openCases().some(function (r) { return r.criminalId === crim.id; }), 'the criminal\'s case arrives');
  // With nothing queued it runs.
  e.s.nextCase = null;
  assert.ok(e.autoSlot('duty', q.uid) && !e.preview('duty').blocked && e.start('duty'), 'nothing queued: the Watch turns its eyes');

  // Old Ghosts: the Abroad card must be the one who walked from that case.
  var g = game(72);
  var gk = byDef(g, 'case')[0], grec = g.caseRec(gk.caseId), gcul = grec.suspects.filter(function (x) { return x.guilty; })[0];
  gk.life = 0.1; g.tick(1);
  var cold = byDef(g, 'coldcase')[0], own = byDef(g, 'atlarge')[0];
  assert.ok(cold && own && own.data.name === gcul.name);
  var other = g.create('atlarge', { label: 'Abroad: Somebody Else', data: { name: 'Somebody Else', trait: gcul.trait } });
  var ghosts = CF.RECIPES_BY_ID.ref_cold_atlarge;
  var ctxOf = function (al) { return { e: g, first: function (k) { return k === 'coldcase' ? cold : k === 'atlarge' ? al : null; } }; };
  assert.strictEqual(ghosts.blocked(ctxOf(other)), 'That is not the one who walked from this case.');
  assert.strictEqual(ghosts.blocked(ctxOf(own)), null, 'the one who walked: open');
  assert.ok(CF.walkedFrom({ data: {} }, other), 'a cold case that kept no name takes anyone');
  g.remove(other);
  var title = cold.data.title;
  var res = run(g, 'reflect', [cold, own]);
  var hunt = res.out.filter(function (c) { return c.def === 'case'; })[0];
  var hrec = g.caseRec(hunt.caseId);
  assert.strictEqual(hrec.template, 'manhunt');
  assert.strictEqual(hrec.crimeTitle, title, 'the hunt remembers the crime');
  assert.strictEqual(g.convictedOf(hrec), title, 'and is tried for it');
  var t = g.create('trial', { data: { caseId: hrec.id, name: gcul.name, guilty: true, solid: true, tier: 'strong', real: 9, need: 4, coerced: 0, planted: 0, illegal: 0, contradictions: 0 } });
  hrec.status = 'trial';
  g.verdict(t);
  var guilty = g.s.journal.filter(function (j) { return /^Guilty: /.test(j.title); })[0];
  assert.ok(guilty, 'a conviction');
  assert.ok(guilty.text.indexOf('is convicted of ' + title) >= 0 && !/convicted of Hue and Cry/.test(guilty.text), 'convicted of the crime: ' + guilty.text);
  assert.ok(/The hue and cry brought them in\./.test(guilty.text));
  var cond = byDef(g, 'condemned')[0];
  assert.ok(!cond || cond.desc.indexOf('convicted of ' + title) >= 0, 'the Condemned card names the crime');
  // Without a cold case the record gives the crime; an older save's hunt finds it on load.
  assert.strictEqual(g.walkedFromTitle({ culpritName: gcul.name }), title);
  var old = JSON.parse(g.save());
  delete old.cases[hrec.id].crimeTitle;
  assert.strictEqual(CF.Engine.load(old).s.cases[hrec.id].crimeTitle, title, 'backfilled from the record');
  console.log('a queued case kept, Old Ghosts paired, the hunt tried for the crime: ok');
})();
