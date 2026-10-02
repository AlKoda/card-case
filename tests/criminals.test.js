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
      assert.ok(/pays a debt/.test(lines.join(' ')) && /A spared man pays his debt/.test(warn.desc));
      assert.strictEqual(sp.crimes, 1, 'a warning, not a crime');
    }
  }
  assert.ok(warned, 'a spared man pays his debt');
  console.log('trade: ok');
})();
