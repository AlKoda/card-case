// A heuristic bot that plays like a sensible detective. Used to exercise the
// late game (ranks, undercover, victories) and to sanity-check balance.
// Run: node tests/bot.test.js [games]
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

function table(e, pred) { return e.tableCards().filter(pred); }
function of(e, def) { return table(e, function (c) { return c.def === def; }); }
function asp(c) { return CF.aspectsOf(c); }
function clueWeight(c) { var a = CF.clueAspects(c), w = 0; for (var k in a) w += a[k]; return w; }

function tryRun(e, vid, cards) {
  var v = e.verb(vid);
  if (!v.unlocked || v.status !== 'idle') return false;
  for (var i = 0; i < cards.length; i++) if (cards[i]) e.autoSlot(vid, cards[i].uid);
  var p = e.preview(vid);
  if (p && !p.blocked && e.start(vid)) return true;
  e.clearSlots(vid);
  return false;
}

function bestTool(e, need) {
  var map = { prints: 'kit_prints', bio: 'kit_bio', lab: 'kit_lab' };
  var tools = table(e, function (c) { return asp(c).tool; });
  return tools.filter(function (t) { return need && asp(t)[map[need]]; })[0] || tools[0];
}

function step(e, temper) {
  var s = e.s;
  temper = temper || 'custom';
  CF.VERB_ORDER.forEach(function (vid) { if (e.verb(vid).status === 'done') e.collect(vid); });
  var fatigue = of(e, 'fatigue').length;
  var funds = of(e, 'funds');
  var team = of(e, 'teammate');

  // Rest first.
  var restCard = of(e, 'burnout')[0] || of(e, 'tunnel')[0] || (fatigue >= 1 ? of(e, 'fatigue')[0] : null) || (of(e, 'obsession').length >= 2 ? of(e, 'obsession')[0] : null);
  if (restCard) tryRun(e, 'reflect', [restCard]);
  if (of(e, 'looseend').length >= 3) tryRun(e, 'reflect', of(e, 'looseend').slice(0, 3));

  // Sentence, by temperament: merciful takes the lightest rung, brutal the
  // heaviest, custom what the Council would do, corrupt whatever a purse asks.
  var cond = of(e, 'condemned')[0];
  if (cond) {
    var rungs = of(e, 'rung').filter(function (r) { return r.data.condemned === cond.uid; });
    var order = CF.Sentence.ORDER;
    rungs.sort(function (a, b) { return order.indexOf(a.data.rung) - order.indexOf(b.data.rung); });
    var pleas = of(e, 'plea').filter(function (p) { return p.data.condemned === cond.uid; });
    var pick = null;
    if (temper === 'merciful') pick = rungs[0];
    else if (temper === 'brutal') pick = rungs[rungs.length - 1];
    else if (temper === 'corrupt') pick = pleas.some(function (p) { return p.data.purse; }) ? rungs[0] : rungs.filter(function (r) { return r.data.rung === cond.data.custom; })[0] || rungs[0];
    else pick = rungs.filter(function (r) { return r.data.rung === cond.data.custom; })[0] || rungs[0];
    var purse = pleas.filter(function (p) { return p.data.purse; })[0];
    if (pick) tryRun(e, 'sentence', [cond, pick, temper === 'corrupt' && purse ? purse : pleas[0]]);
  }
  // Temptations.
  if (temper === 'corrupt') {
    if (of(e, 'writsale')[0]) tryRun(e, 'duty', [of(e, 'writsale')[0]]);
    if (of(e, 'tribute')[0]) tryRun(e, 'duty', [of(e, 'tribute')[0]]);
    if (s.rooms.thieftakers && funds.length >= 4) { var urgent = of(e, 'case').sort(function (a, b) { return a.life - b.life; })[0]; if (urgent && urgent.life < 90) tryRun(e, 'duty', [urgent, funds[0], funds[1]]); }
    if (of(e, 'syndicate')[0] && !(s.court && s.court.stance) && s.rank >= 2) tryRun(e, 'investigate', [of(e, 'syndicate')[0], of(e, 'focus')[0]]);
  }
  var dagger = of(e, 'dagger')[0];
  if (dagger) tryRun(e, 'reflect', funds.length >= 4 ? [dagger, funds[0], funds[1]] : [dagger]);

  // Duty: career, then money.
  var career = of(e, 'promotion')[0] || of(e, 'promo_inspector')[0] || of(e, 'promo_chief')[0] || of(e, 'chair')[0];
  if (career) tryRun(e, 'duty', [career]);
  else if (of(e, 'paperwork').length && s.meters.scrutiny > 0) tryRun(e, 'duty', [of(e, 'focus')[0], of(e, 'paperwork')[0]]);
  else if (funds.length < 6 && fatigue === 0 && of(e, 'health')[0]) tryRun(e, 'duty', [of(e, 'health')[0]]);
  else if (funds.length < 4 && of(e, 'focus')[0]) tryRun(e, 'duty', [of(e, 'focus')[0]]);

  // Cases, most urgent first.
  var cases = of(e, 'case').sort(function (a, b) { return a.life - b.life; });
  cases.forEach(function (cc) {
    var rec = e.caseRec(cc.caseId);
    if (!rec || rec.status !== 'open') return;
    var clues = table(e, function (c) { return c.def === 'clue' && c.caseId === rec.id; }).sort(function (a, b) { return clueWeight(b) - clueWeight(a); });
    var suspects = table(e, function (c) { return c.def === 'suspect' && c.caseId === rec.id; });
    var prime = suspects.filter(function (c) { return /^Prime/.test(c.label); })[0];
    // Arrest when solid or out of time.
    var target = prime || (cc.life < 40 ? suspects[0] : null);
    if (target) {
      var a = e.assessCharge(target, clues.slice(0, 4));
      if (a.tier === 'strong' || cc.life < 40) { tryRun(e, 'arrest', [target].concat(clues.slice(0, 4))); return; }
    }
    // Theory once there are a few clues.
    if (!rec.identified && clues.length >= 2) tryRun(e, 'reflect', [cc].concat(clues.slice(0, 3)));
    // Search the scene, then canvass.
    if (rec.found < rec.items.length) tryRun(e, 'investigate', [cc, bestTool(e), team[0], of(e, 'focus')[0]]);
    else {
      var d = of(e, 'district').filter(function (x) { return x.data.district === rec.district; })[0];
      if (d) tryRun(e, 'investigate', [cc, d, team[0]]);
    }
    if (s.rank >= 3 && team.length) tryRun(e, 'duty', [cc].concat(team.slice(0, 3)));
    // Interrogate.
    var wit = table(e, function (c) { return c.def === 'witness' && c.caseId === rec.id; })[0];
    if (wit) tryRun(e, 'interrogate', [wit, of(e, 'focus')[0]]);
    else if (prime && (temper === 'brutal' || temper === 'corrupt') && e.indiciaOf(rec).sufficient && !clues.some(function (c) { return c.data.confession; }) && of(e, 'health').length > 1) tryRun(e, 'interrogate', [prime, of(e, 'health')[0]]);
    else if (prime && clues.length) tryRun(e, 'interrogate', [prime, of(e, 'focus')[0], clues[0]]);
    else if (suspects.length && !rec.identified) tryRun(e, 'interrogate', [suspects[0], of(e, 'focus')[0]]);
    if (prime && clues.length) tryRun(e, 'investigate', [prime, clues[clues.length - 1]]);
    if (prime) tryRun(e, 'investigate', [prime, of(e, 'instinct')[0] || team[0]]);
  });

  // Analyze evidence.
  var ev = of(e, 'evidence')[0];
  if (ev) tryRun(e, 'analyze', [ev, bestTool(e, ev.data.item.needs)]);
  var cold = of(e, 'coldcase')[0];
  if (cold && s.rooms.archive) tryRun(e, 'analyze', [cold]);
  var al = of(e, 'atlarge')[0];
  if (cold && al) tryRun(e, 'reflect', [cold, al]);

  // Buy things.
  var orders = of(e, 'order').concat(of(e, 'personnel')).sort(function (a, b) { return CF.costOf(a) - CF.costOf(b); });
  if (orders[0] && funds.length >= CF.costOf(orders[0]) + 2) tryRun(e, 'duty', [orders[0]].concat(funds.slice(0, CF.costOf(orders[0]))));

  // Streets.
  var inf = of(e, 'informant')[0];
  if (inf && funds.length > 4) tryRun(e, 'investigate', [inf, funds[0]]);
  else if (of(e, 'instinct')[0]) tryRun(e, 'investigate', [of(e, 'instinct')[0]]);
  var ucTarget = of(e, 'syndicate')[0] || of(e, 'gang')[0] || al;
  if (ucTarget && s.rank >= 2 && of(e, 'health').length) tryRun(e, 'investigate', [ucTarget, of(e, 'instinct')[0], team[1] || team[0]]);
  if (of(e, 'bribe')[0] && s.meters.scrutiny < 3) tryRun(e, 'duty', [of(e, 'bribe')[0]]);
  // Idle team earns money.
  of(e, 'teammate').forEach(function (t) { if (funds.length < 8) tryRun(e, 'duty', [t]); });
}

// Other tests borrow the bot: play(engine, ticks, temper) runs it.
module.exports = { step: step, play: function (e, ticks, temper) { for (var t = 0; t < ticks && !e.s.over; t++) { step(e, temper || 'custom'); e.tick(1); } return e; } };
if (require.main !== module) return;
var GAMES = +process.argv[2] || 45;
var TEMPERS = ['custom', 'merciful', 'brutal', 'corrupt'];
var endings = {}, weeks = [], ranks = [0, 0, 0, 0], convictions = 0, acquittals = 0, wrongful = 0, seen = {}, byTemper = {}, byWho = {}, counts = { cruelty: 0, mercy: 0, purse: 0, debt: 0 };
for (var g = 0; g < GAMES; g++) {
  var calling = ['commissioner', 'master', 'crusader'][g % 3];
  var who = CF.ORIGIN_ORDER[g % 5];
  var temper = TEMPERS[Math.floor(g / 3) % 4];
  var e = CF.Engine.newGame({ seed: 500 + g, calling: calling, who: who });
  for (var t = 0; t < 60 * 40 && !e.s.over; t++) {
    step(e, temper);
    CF.VERB_ORDER.forEach(function (vid) { var v = e.s.verbs[vid]; if (v.status === 'running') seen[v.recipe] = true; });
    e.tick(1);
  }
  var end = e.s.over ? calling.slice(0, 4) + ':' + e.s.over.id : calling.slice(0, 4) + ':survived';
  endings[end] = (endings[end] || 0) + 1;
  var eid = e.s.over ? e.s.over.id : 'survived';
  byTemper[temper] = byTemper[temper] || {}; byTemper[temper][eid] = (byTemper[temper][eid] || 0) + 1;
  byWho[who] = byWho[who] || {}; byWho[who][eid] = (byWho[who][eid] || 0) + 1;
  for (var ck in counts) counts[ck] += (e.s.counts || {})[ck] || 0;
  weeks.push(e.s.week);
  ranks[e.s.rank]++;
  convictions += e.s.stats.convictions; acquittals += e.s.stats.acquittals; wrongful += e.s.stats.wrongful;
}
console.log('bot: ' + GAMES + ' games');
console.log('endings', JSON.stringify(endings));
console.log('final rank [Det, Senior, Insp, ChiefInsp]', JSON.stringify(ranks), 'avg week', (weeks.reduce(function (a, b) { return a + b; }, 0) / GAMES).toFixed(1));
console.log('convictions', convictions, 'acquittals', acquittals, 'wrongful', wrongful);
console.log('by temper', JSON.stringify(byTemper));
console.log('by origin', JSON.stringify(byWho));
console.log('counts per game', JSON.stringify(Object.keys(counts).reduce(function (o, k) { o[k] = +(counts[k] / GAMES).toFixed(2); return o; }, {})));
console.log('recipes never run:', CF.RECIPES.map(function (r) { return r.id; }).filter(function (id) { return !seen[id]; }).join(', ') || 'none');
assert.ok(convictions > 0, 'the bot should be able to convict someone');
