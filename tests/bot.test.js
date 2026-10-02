// A heuristic bot that plays like a sensible detective. Used to exercise the
// late game (ranks, undercover, victories) and to sanity-check balance.
// Run: node tests/bot.test.js [games]
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

function table(e, pred) { return e.tableCards().filter(pred); }
function of(e, def) { return table(e, function (c) { return c.def === def; }); }
function asp(c) { return CF.aspectsOf(c); }
function clueWeight(c) { var a = CF.clueAspects(c), w = 0; for (var k in a) w += a[k]; return w; }
// Word behind a token: a confession, a witness, a name, corroboration. Full proof wants one.
function wordOf(c) { var d = c.data || {}; return (d.confession ? 3 : 0) + (d.stake && !d.coerced ? 2 : 0) + (d.points ? 2 : 0) + (d.corroborated ? 1 : 0); }
function namesOne(c) { var d = c.data || {}; return !d.alibi && (d.points || d.trait) ? 1 : 0; }

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

// The city has asked something: the first answer the table can pay for. The
// clock waits until it is given, so an idle verb's slots are emptied to pay.
function answerChoice(e) {
  var c = e.s.choice;
  if (!c) return false;
  for (var i = 0; i < c.options.length; i++) if (e.canChoose(i)) return e.choose(i);
  CF.VERB_ORDER.forEach(function (vid) { if (e.verb(vid).status === 'idle') e.clearSlots(vid); });
  for (var j = 0; j < c.options.length; j++) if (e.canChoose(j)) return e.choose(j);
  return false;
}

function step(e, temper) {
  var s = e.s;
  temper = temper || 'custom';
  answerChoice(e);
  CF.VERB_ORDER.forEach(function (vid) { if (e.verb(vid).status === 'done') e.collect(vid); });
  var fatigue = of(e, 'fatigue').length;
  var funds = of(e, 'funds');
  var team = of(e, 'teammate');
  // A need goes into Rest with whatever the table has for it: Coin, a watchman, a Quarter or Health.
  ['hunger', 'sickness', 'stress'].forEach(function (need) {
    var card = of(e, need)[0];
    if (card) tryRun(e, 'reflect', [card, funds[0] || team[0] || of(e, 'district')[0] || of(e, 'health')[0]]);
  });

  // Rest first.
  var restCard = of(e, 'burnout')[0] || of(e, 'tunnel')[0] || (fatigue >= 1 ? of(e, 'fatigue')[0] : null) || (of(e, 'obsession').length >= 2 ? of(e, 'obsession')[0] : null);
  if (restCard) tryRun(e, 'reflect', [restCard]);
  // Spent Health, Wit or Instinct: a moment in Rest brings it back.
  var spent = of(e, 'spent_focus')[0] || of(e, 'spent_health')[0] || of(e, 'spent_instinct')[0];
  if (spent && !of(e, spent.def === 'spent_focus' ? 'focus' : spent.def === 'spent_health' ? 'health' : 'instinct').length) tryRun(e, 'reflect', [spent]);
  if (of(e, 'looseend').length >= 3) tryRun(e, 'reflect', of(e, 'looseend').slice(0, 3));
  // The Provost's Examiner: find their weakness with Wit, twice, and the Council sends them home.
  var rival = of(e, 'rival')[0];
  if (rival && of(e, 'focus')[0]) tryRun(e, 'interrogate', [rival, of(e, 'focus')[0]]);

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
    // The charge: the heaviest tokens, the ones with Word behind them first.
    var proof = clues.slice().sort(function (a, b) { return (clueWeight(b) + wordOf(b)) - (clueWeight(a) + wordOf(a)); });
    var suspects = table(e, function (c) { return c.def === 'suspect' && c.caseId === rec.id; });
    var prime = suspects.filter(function (c) { return /^Prime/.test(c.label); })[0];
    // Arrest when solid or out of time.
    var target = prime || (cc.life < 40 ? suspects[0] : null);
    if (target) {
      var a = e.assessCharge(target, proof.slice(0, 4));
      if (a.tier === 'strong' || cc.life < 40) { tryRun(e, 'arrest', [target].concat(proof.slice(0, 4))); return; }
    }
    // A hand with no name yet: hold it against the accused, one at a time.
    var hand = clues.filter(function (c) { return c.data.names && !c.data.points; })[0];
    if (hand && suspects.length) tryRun(e, 'analyze', [hand, suspects[Math.floor(s.t) % suspects.length]]);
    // An alibi laid beside the hours in Rest: check the night.
    var alibi = clues.filter(function (c) { return c.data.alibi; })[0];
    var hours = clues.filter(function (c) { return !c.data.alibi && CF.clueAspects(c).opportunity; })[0];
    if (alibi && hours) tryRun(e, 'reflect', [alibi, hours]);
    // Theory once there are a few clues (a story to check is not a reason); the tokens that name someone first.
    var reasons = clues.filter(function (c) { return !c.data.alibi; }).sort(function (a, b) { return namesOne(b) - namesOne(a); });
    if (!rec.identified && reasons.length >= 2) tryRun(e, 'reflect', [cc].concat(reasons.slice(0, 3)));
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
  // Below Bailiff a band is fought from the Watch-house: a watchman on its stair, hired if need be.
  var band = of(e, 'gang')[0];
  if (band && s.rank < 2) {
    if (team.length) tryRun(e, 'duty', [band, team[0]]);
    else { var letter = of(e, 'personnel')[0]; if (letter && funds.length >= CF.costOf(letter)) tryRun(e, 'duty', [letter].concat(funds.slice(0, CF.costOf(letter)))); }
  }
  // A sighting of someone Abroad: raise the hue and cry.
  var sighting = of(e, 'intel').filter(function (c) { return c.data.kind === 'sighting'; })[0];
  var seenAl = sighting && of(e, 'atlarge').filter(function (c) { return c.data.name === sighting.data.criminal; })[0];
  if (sighting && seenAl) tryRun(e, 'reflect', [sighting, seenAl]);
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
var insights = 0, bands = [], rank2By20 = 0, needsMet = 0, lost = 0, choices = 0;
var earlyCoquille = 0;
for (var g = 0; g < GAMES; g++) {
  var calling = ['commissioner', 'master', 'crusader'][g % 3];
  var who = CF.ORIGIN_ORDER[g % 5];
  var temper = TEMPERS[Math.floor(g / 3) % 4];
  // The whole city: the needs and the choices run from the first day.
  var e = CF.Engine.newGame({ seed: 500 + g, calling: calling, who: who, life: true });
  e.on(function (type, p) { if (type === 'story' && /^Lost: /.test(p.title)) lost++; if (type === 'chosen') choices++; });
  var band = null, reached2 = false, below = 0, early = false;
  for (var t = 0; t < 60 * 40 && !e.s.over; t++) {
    step(e, temper);
    CF.VERB_ORDER.forEach(function (vid) { var v = e.s.verbs[vid]; if (v.status === 'running') seen[v.recipe] = true; });
    e.tick(1);
    if (!band && e.countOf('gang')) band = { week: e.s.week, rank: e.s.rank };
    if (band && e.s.rank < 2 && e.countOf('gang')) below++; // ticks the band sat on the table below Bailiff
    if (e.s.rank >= 2 && e.s.week <= 20) reached2 = true;
    if (calling === 'crusader' && e.s.rank < 2 && !early && e.countOf('syndicate') &&
      !e.s.journal.some(function (j) { return j.title === 'The Coquille' && /^The bands have stopped/.test(j.text); })) early = true;
  }
  if (early) earlyCoquille++;
  insights += Object.keys(e.s.insights || {}).length;
  needsMet += e.s.stats.needsMet || 0;
  if (reached2) rank2By20++;
  if (band) bands.push({ week: band.week, rank: band.rank, below: below, ending: e.s.over ? e.s.over.id : 'survived', endWeek: e.s.week });
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
// The opening, played by the bot from the first morning for every origin: the labour, the notice,
// the sergeant (whose questioning starts again by itself when the one Wit comes back from the
// day-book), the hire and the calling. Each must reach the desk and answer the calling in time.
CF.ORIGIN_ORDER.forEach(function (who, i) {
  var o = CF.Engine.newGame({ seed: 900 + i, who: who, name: 'Opening', opening: true, guided: true });
  var hiredAt = null, answered = null;
  for (var t = 0; t < 600 && !o.s.over && answered === null; t++) {
    step(o, 'custom');
    CF.VERB_ORDER.forEach(function (vid) { var v = o.s.verbs[vid]; if (v.status === 'running') seen[v.recipe] = true; });
    o.tick(1);
    if (hiredAt === null && (o.s.flags.stage === 'hired' || o.s.flags.stage === 'keep')) hiredAt = t;
    if (hiredAt !== null && !o.s.flags.callingDue && !o.s.choice) answered = t;
  }
  assert.ok(hiredAt !== null && hiredAt < 400, who + ' reaches the desk in the opening: stage ' + o.s.flags.stage + ', hint: ' + o.introHint());
  assert.ok(o.s.stats.verbs.interrogate >= 1 && !o.cardsOf('watchq', true).length, who + ': the sergeant was answered');
  assert.ok(answered !== null && o.s.journal.some(function (j) { return /^What You Want: /.test(j.title); }), who + ': the calling was put and answered');
});
console.log('bot: ' + GAMES + ' games, and the opening for every origin');
console.log('endings', JSON.stringify(endings));
console.log('final rank [Det, Senior, Insp, ChiefInsp]', JSON.stringify(ranks), 'avg week', (weeks.reduce(function (a, b) { return a + b; }, 0) / GAMES).toFixed(1));
console.log('convictions', convictions, 'acquittals', acquittals, 'wrongful', wrongful);
console.log('by temper', JSON.stringify(byTemper));
console.log('by origin', JSON.stringify(byWho));
console.log('counts per game', JSON.stringify(Object.keys(counts).reduce(function (o, k) { o[k] = +(counts[k] / GAMES).toFixed(2); return o; }, {})));
console.log('recipes never run:', CF.RECIPES.map(function (r) { return r.id; }).filter(function (id) { return !seen[id]; }).join(', ') || 'none');
console.log('insights earned', insights, '| bands formed', bands.length, '| Bailiff by week 20 in', rank2By20, 'games');
console.log('per game: needs met', (needsMet / GAMES).toFixed(2), '| abilities lost', (lost / GAMES).toFixed(2), '| choices answered', (choices / GAMES).toFixed(2));
assert.ok(convictions > 0, 'the bot should be able to convict someone');
// The city teaches: Insights are earned in play.
assert.ok(insights >= 1, 'somebody earned an Insight');
// The needs are met in Rest with what the table has, and the choices answered: the city rarely takes an ability for good.
assert.ok(needsMet >= 1, 'a need was met in Rest');
assert.ok(choices >= 1, 'a choice was answered');
assert.ok(lost / GAMES < 1.5, 'abilities lost per game: ' + (lost / GAMES).toFixed(2));
// A band formed under an Examiner or a Sworn Examiner can be fought from the Watch-house (the Watch posted on its
// stair, its sworn hunted one by one): the bot does so, and such a band is not a quick death. The Vendetta itself is
// still uncapped (a later item), so a stray death stays possible; it must not be the rule.
// A band promoted away within the length of one Attend (the Council's own summons runs 45s) never gave the bot a turn.
var lowBands = bands.filter(function (b) { return b.rank <= 1 && b.below >= 60; });
var earlyBandDeaths = lowBands.filter(function (b) { return b.ending === 'death' && b.endWeek - b.week <= 4; });
if (lowBands.length) assert.ok(seen.duty_post_watch, 'the Watch is posted on a band below Bailiff');
assert.ok(earlyBandDeaths.length <= lowBands.length / 4, 'a band at low rank is a quick death: ' + earlyBandDeaths.length + ' of ' + lowBands.length + ' ' + JSON.stringify(earlyBandDeaths));
// The ladder is reachable: a fair share of games make Bailiff, and the Crowd does not end most of them.
var dismissed = Object.keys(endings).reduce(function (n, k) { return n + (/:dismissed$/.test(k) ? endings[k] : 0); }, 0);
assert.ok(ranks[2] + ranks[3] >= GAMES / 4, 'Bailiff or better in ' + (ranks[2] + ranks[3]) + ' of ' + GAMES);
assert.ok(dismissed < GAMES / 2, 'dismissed in ' + dismissed + ' of ' + GAMES);
// No calling is a handicap. The Crusader's Coquille waits for the Bailiff's Disguise (unless the
// bands build it themselves), and no calling is dismissed by the Crowd in most of its games. The
// bot never goes in Disguise, so the bound is a loose one.
assert.strictEqual(earlyCoquille, 0, 'a Crusader met the Coquille below Bailiff in ' + earlyCoquille + ' games');
['comm', 'mast', 'crus'].forEach(function (cl) {
  var played = Object.keys(endings).reduce(function (n, k) { return n + (k.indexOf(cl + ':') === 0 ? endings[k] : 0); }, 0);
  var out = endings[cl + ':dismissed'] || 0;
  assert.ok(out <= Math.ceil(played / 2), cl + ' dismissed in ' + out + ' of ' + played);
});
