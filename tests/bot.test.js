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

// The four tokens that make the strongest charge against the accused: the
// heaviest first, and when those fall short of full proof, every four of the
// best eight (a great case asks for more kinds than four slots hold at once).
var TIER = { weak: 0, reasonable: 1, strong: 2 };
function bestProof(e, target, proof) {
  var first = proof.slice(0, 4), a = e.assessCharge(target, first);
  if (a.tier === 'strong' || proof.length <= 4 || Math.floor(e.s.t) % 5) return { cards: first, a: a };
  var pool = proof.slice(0, 8), best = { cards: first, a: a };
  for (var i = 0; i < pool.length; i++) for (var j = i + 1; j < pool.length; j++) for (var k = j + 1; k < pool.length; k++) for (var l = k + 1; l < pool.length; l++) {
    var set = [pool[i], pool[j], pool[k], pool[l]], b = e.assessCharge(target, set);
    if (TIER[b.tier] > TIER[best.a.tier] || (TIER[b.tier] === TIER[best.a.tier] && b.score > best.a.score)) best = { cards: set, a: b };
  }
  return best;
}

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

// The late arcs a player meets: the Pattern read and its next door, a Thread
// pulled and closed in on, the Coquille gone down to, parleyed with or ruled,
// and a case cried before it goes cold.
function lateArcs(e, temper) {
  var s = e.s, team = of(e, 'teammate'), funds = of(e, 'funds');
  // (a) Two doors of the Pattern in Rest, then the next door with Instinct or a watchman.
  var doors = table(e, function (c) { return c.def === 'clue' && c.data.pattern; });
  if (doors.length >= 2) tryRun(e, 'reflect', doors.slice(0, 2));
  var next = table(e, function (c) { return asp(c).nextdoor; })[0];
  if (next) tryRun(e, 'investigate', [next, of(e, 'instinct')[0] || team[0]]);
  // (b) Two chits naming one door, from two cases, in Rest: a Thread; then close in.
  var byLink = {};
  table(e, function (c) { return c.def === 'clue' && c.data.link; }).forEach(function (c) { (byLink[c.data.link] = byLink[c.data.link] || []).push(c); });
  Object.keys(byLink).some(function (k) {
    var l = byLink[k], other = l.filter(function (c) { return c.caseId !== l[0].caseId; })[0];
    return other && tryRun(e, 'reflect', [l[0], other]);
  });
  var thread = of(e, 'thread')[0];
  if (thread) {
    var front = e.fronts()[thread.data.front] || {};
    tryRun(e, 'reflect', front.fence || front.society ? [thread] : [thread, of(e, 'gang')[0] || of(e, 'syndicate')[0]]);
  }
  var syn = of(e, 'syndicate')[0], court = e.court ? e.court() : {};
  // (c) The Reformer goes down to the Court: a leaf of the ledger at a time, then the case against it.
  if (syn && s.calling === 'crusader' && s.rank >= 2 && temper !== 'schemer' && of(e, 'health').length) tryRun(e, 'investigate', [syn, of(e, 'instinct')[0], team[0]]);
  // (d) The schemer deals with the Court: a parley, or its trial and in time its throne.
  if (syn && temper === 'schemer' && s.rank >= 2) {
    if (court.inside && e.canTakeThrone()) tryRun(e, 'investigate', [syn, of(e, 'instinct')[0]]);
    else if (!court.stance && !court.inside && (s.seed || 0) % 2) tryRun(e, 'investigate', [syn, of(e, 'focus')[0]]);
    else if (!court.stance && !court.inside && funds.length >= 2) tryRun(e, 'investigate', [syn, of(e, 'instinct')[0], funds[0], funds[1]]);
  }
  if (temper === 'schemer' && of(e, 'tribute')[0]) tryRun(e, 'duty', [of(e, 'tribute')[0]]);
  // (e) A case the whole city watches, close to going cold: have it cried.
  if (s.rank >= 3 && funds.length >= 2) {
    var hp = of(e, 'case').filter(function (c) { var r = e.caseRec(c.caseId); return r && r.highProfile && !r.major && c.life < 60; })[0];
    if (hp) tryRun(e, 'duty', [hp, of(e, 'focus')[0], funds[0], funds[1]]);
  }
}

function step(e, temper) {
  var s = e.s;
  temper = temper || 'custom';
  answerChoice(e);
  CF.VERB_ORDER.forEach(function (vid) { if (e.verb(vid).status === 'done') e.collect(vid); });
  var fatigue = of(e, 'fatigue').length;
  var funds = of(e, 'funds');
  var team = of(e, 'teammate');
  // Rest first for what ends the file: a Fever, a Fixation, Weariness or Obsession piling up.
  // A Coin buys the quick night when there is silver to spare, as a player would pay.
  var urgentRest = of(e, 'burnout')[0] || of(e, 'tunnel')[0] || (fatigue >= 2 ? of(e, 'fatigue')[0] : null) || (of(e, 'obsession').length >= 2 ? of(e, 'obsession')[0] : null);
  if (urgentRest) tryRun(e, 'reflect', funds.length >= 3 ? [urgentRest, funds[0]] : [urgentRest]);
  // A need goes into Rest as a player would pay for it: the quick free aid first (Instinct walks
  // off Stress); then Coin while there is silver to spare, since Rest is wanted for the cases;
  // short of silver, the slow free aid (the watchman's pot or remedy or a drink with the Watch, a
  // Quarter's credit for Hunger), then Health (the Abbey dole, or sweating it out), an informer's
  // table, or alone (an evening off). Weary already, or a Fever on the table: Coin first.
  var strained = fatigue > 0 || of(e, 'burnout').length || of(e, 'tunnel').length;
  var quick = { hunger: [], sickness: [], stress: [of(e, 'instinct')[0]] };
  var slow = { hunger: [team[0], of(e, 'district')[0]], sickness: [team[0]], stress: [team[0]] };
  ['hunger', 'sickness', 'stress'].forEach(function (need) {
    var card = of(e, need)[0];
    if (!card) return;
    var coin = funds.length >= 3 || strained ? [funds[0]] : [];
    var tries = (strained ? coin.concat(quick[need]) : quick[need].concat(coin)).concat(slow[need], [funds[0], of(e, 'health')[0], need === 'hunger' ? of(e, 'informant')[0] : null]);
    for (var ai = 0; ai < tries.length; ai++) if (tries[ai] && tryRun(e, 'reflect', [card, tries[ai]])) return;
    tryRun(e, 'reflect', [card]);
  });
  // One Weariness: a night's sleep (the watchman's round, when one is free).
  if (fatigue === 1 && !(team[0] && tryRun(e, 'reflect', [of(e, 'fatigue')[0], team[0]]))) tryRun(e, 'reflect', funds.length >= 3 ? [of(e, 'fatigue')[0], funds[0]] : [of(e, 'fatigue')[0]]);
  // An Insight waiting: into Rest alone to learn it, or (every other game) with its ability to keep the trick.
  var insight = of(e, 'insight')[0];
  if (insight && !strained) {
    var sp = CF.INSIGHTS[insight.data.insight];
    var ability = sp && (s.seed || 0) % 2 ? of(e, sp.trains)[0] : null;
    if (!(ability && tryRun(e, 'reflect', [insight, ability]))) tryRun(e, 'reflect', [insight]);
  }

  // Spent Health, Wit or Instinct: a moment in Rest brings it back.
  var spent = of(e, 'spent_focus')[0] || of(e, 'spent_health')[0] || of(e, 'spent_instinct')[0];
  if (spent && !of(e, spent.def === 'spent_focus' ? 'focus' : spent.def === 'spent_health' ? 'health' : 'instinct').length) tryRun(e, 'reflect', [spent]);
  if (of(e, 'looseend').length >= 3) tryRun(e, 'reflect', of(e, 'looseend').slice(0, 3));
  // Two leaves from the Customs House: open the Harbourmaster's books.
  if (of(e, 'customsleaf').length >= 2) tryRun(e, 'reflect', of(e, 'customsleaf').slice(0, 2));
  // The Harbourmaster's Examiner: a thread with Wit, then caught at it with their own work (a spoiled token,
  // a paid witness, the case they took) in Question, and the Council sends them home.
  var rival = of(e, 'rival')[0];
  if (rival && (rival.data.heat || 0) >= 1) {
    var work = table(e, function (c) { return e.rivalWork(c); })[0];
    if (work && of(e, 'focus')[0]) tryRun(e, 'interrogate', [rival, of(e, 'focus')[0], work]);
  } else if (rival && of(e, 'focus')[0]) tryRun(e, 'interrogate', [rival, of(e, 'focus')[0]]);
  lateArcs(e, temper);

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
    else if (temper === 'corrupt' || temper === 'schemer') pick = pleas.some(function (p) { return p.data.purse; }) ? rungs[0] : rungs.filter(function (r) { return r.data.rung === cond.data.custom; })[0] || rungs[0];
    else pick = rungs.filter(function (r) { return r.data.rung === cond.data.custom; })[0] || rungs[0];
    // One who wants the Seat answers the Bishop's and the Guilds' commissions as they wish: their seals vote.
    var crec = e.caseRec(cond.data.caseId || cond.caseId), com = crec && crec.commission;
    if (com && s.calling === 'commissioner' && (com.from === 'bishop' || com.from === 'guild')) {
      var wish = com.from === 'bishop' ? ['fine', 'pardon'] : ['fine', 'pillory'];
      pick = rungs.filter(function (r) { return wish.indexOf(r.data.rung) >= 0; })[0] || pick;
    }
    var purse = pleas.filter(function (p) { return p.data.purse; })[0];
    if (pick) tryRun(e, 'sentence', [cond, pick, (temper === 'corrupt' || temper === 'schemer') && purse ? purse : pleas[0]]);
  }
  // Temptations.
  if (temper === 'corrupt') {
    if (of(e, 'writsale')[0]) tryRun(e, 'duty', [of(e, 'writsale')[0]]);
    if (of(e, 'tribute')[0]) tryRun(e, 'duty', [of(e, 'tribute')[0]]);
    // The corrupt road is walked through the Thief-takers' Office: petition for it first.
    var tto = of(e, 'order').filter(function (o) { return o.data.order === 'thieftakers'; })[0];
    if (tto && funds.length >= CF.costOf(tto)) tryRun(e, 'duty', [tto].concat(funds.slice(0, CF.costOf(tto))));
    if (s.rooms.thieftakers && funds.length >= 4) { var urgent = of(e, 'case').sort(function (a, b) { return a.life - b.life; })[0]; if (urgent && urgent.life < 90) tryRun(e, 'duty', [urgent, funds[0], funds[1]]); }
    if (of(e, 'syndicate')[0] && !(s.court && s.court.stance) && s.rank >= 2) tryRun(e, 'investigate', [of(e, 'syndicate')[0], of(e, 'focus')[0]]);
  }
  var dagger = of(e, 'dagger')[0];
  // Rest busy: the second door, a watchman doubling the guard in Attend.
  if (dagger && !tryRun(e, 'reflect', funds.length >= 4 ? [dagger, funds[0], funds[1]] : [dagger]) && team[0]) tryRun(e, 'duty', [dagger, team[0]]);

  // Duty: career, then money.
  var career = of(e, 'promotion')[0] || of(e, 'promo_inspector')[0] || of(e, 'promo_chief')[0] || of(e, 'chair')[0];
  // The Coquille on the table and the Vendetta high: the Watch on its stair comes before the fee.
  var coq = of(e, 'syndicate')[0];
  if (career) tryRun(e, 'duty', [career]);
  else if (coq && team.length && s.meters.retaliation >= 3 && tryRun(e, 'duty', [coq, team[0]])) { /* posted */ }
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
      var bp = bestProof(e, target, proof);
      if (bp.a.tier === 'strong' || cc.life < 40) { tryRun(e, 'arrest', [target].concat(bp.cards)); return; }
    }
    // A hand with no name yet: hold it against the accused, one at a time.
    var hand = clues.filter(function (c) { return c.data.names && !c.data.points; })[0];
    if (hand && suspects.length) tryRun(e, 'analyze', [hand, suspects[Math.floor(s.t) % suspects.length]]);
    // An alibi laid beside the hours in Rest: check the night.
    var alibi = clues.filter(function (c) { return c.data.alibi; })[0];
    var hours = clues.filter(function (c) { return !c.data.alibi && CF.clueAspects(c).opportunity; })[0];
    if (alibi && hours) tryRun(e, 'reflect', [alibi, hours]);
    // Two marks of two people, laid side by side in Rest once: one may have been put there.
    var marks = clues.filter(function (c) { return c.data.trait && !c.data.alibi; });
    var otherMark = marks.filter(function (c) { return c.data.trait !== marks[0].data.trait; })[0];
    var accounts = e._botAccounts || (e._botAccounts = {});
    if (otherMark && !accounts[rec.id] && tryRun(e, 'reflect', [marks[0], otherMark])) accounts[rec.id] = true;
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
  var ghost = cold && of(e, 'atlarge').filter(function (a) { return CF.walkedFrom(cold, a); })[0];
  if (cold && ghost) tryRun(e, 'reflect', [cold, ghost]);

  // Buy things.
  var orders = of(e, 'order').concat(of(e, 'personnel')).sort(function (a, b) { return CF.costOf(a) - CF.costOf(b); });
  if (orders[0] && funds.length >= CF.costOf(orders[0]) + 2) tryRun(e, 'duty', [orders[0]].concat(funds.slice(0, CF.costOf(orders[0]))));

  // Streets.
  var inf = of(e, 'informant')[0];
  if (inf && funds.length > 4) tryRun(e, 'investigate', [inf, funds[0]]);
  else if (of(e, 'atlarge').length && of(e, 'instinct')[0] && of(e, 'district')[0]) tryRun(e, 'investigate', [of(e, 'instinct')[0], of(e, 'district')[0]]); // Work the Quarter for a face you know
  else if (of(e, 'instinct')[0]) tryRun(e, 'investigate', [of(e, 'instinct')[0]]);
  var ucTarget = of(e, 'syndicate')[0] || of(e, 'gang')[0] || al;
  if (ucTarget && s.rank >= 2 && of(e, 'health').length) tryRun(e, 'investigate', [ucTarget, of(e, 'instinct')[0], team[1] || team[0]]);
  // Below Bailiff a band, or the Coquille, is fought from the Watch-house: a watchman on its stair, hired if need be.
  // Above it, a watchman still cools the Coquille's Vendetta when it runs high.
  var band = of(e, 'gang')[0] || of(e, 'syndicate')[0];
  if (band && (s.rank < 2 || (band.def === 'syndicate' && s.meters.retaliation >= 3))) {
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
// The schemer deals with the Coquille (a parley, its trial, its throne). Its games
// come after the main ones and are counted apart, so the seeded run stays as it was.
var SCHEMERS = Math.max(2, Math.round(GAMES / 10)), schemerEnds = {};
var endings = {}, weeks = [], ranks = [0, 0, 0, 0], convictions = 0, acquittals = 0, wrongful = 0, seen = {}, byTemper = {}, byWho = {}, counts = { cruelty: 0, mercy: 0, purse: 0, debt: 0 };
var insights = 0, bands = [], rank2By20 = 0, needsMet = 0, lost = 0, choices = 0;
var earlyCoquille = 0, drifts = {}, attacks = {}, seatWins = [];
var restTicks = 0, allTicks = 0, tallyGames = 0, trained = 0, perks = 0;
var threadGames = 0, receivers = 0, byCalling = {};
var rivalCame = 0, rivalExposed = 0, rivalClosed = 0, rivalCaught = 0, stagedRead = 0, harbour = { opened: 0, fell: 0, friends: 0 };
for (var g = 0; g < GAMES + SCHEMERS; g++) {
  var calling = ['commissioner', 'master', 'crusader'][g % 3];
  var who = CF.ORIGIN_ORDER[g % 5];
  var temper = g < GAMES ? TEMPERS[Math.floor(g / 3) % TEMPERS.length] : 'schemer';
  var main = g < GAMES;
  // The whole city: the needs and the choices run from the first day.
  var e = CF.Engine.newGame({ seed: 500 + g, calling: calling, who: who, life: true });
  e.on(function (type, p) {
    if (!main) return;
    if (type === 'story' && /^Lost: /.test(p.title)) lost++;
    if (type === 'chosen') choices++;
    if (type === 'story' && /^Your .* is more than it was\.$/.test(p.title)) trained++;
    // Sent: the first, another, or the one his friends send when his books are shut again.
    if (type === 'story' && (p.title === 'The Harbourmaster\'s Examiner' || p.title === 'Another Examiner' || p.title === 'He Has Friends')) rivalCame++;
    if (type === 'story' && p.title === 'Answered by the Rival') rivalClosed++;
    if (type === 'story' && p.title === 'Quicker than the Customs House') rivalCaught++;
    if (type === 'story' && p.title === 'A Mark Left to Be Found') stagedRead++;
    if (type === 'story' && p.title === 'The Harbourmaster\'s Books') harbour.opened++;
    if (type === 'story' && p.title === 'The Harbourmaster Falls') harbour.fell++;
    if (type === 'story' && p.title === 'He Has Friends') harbour.friends++;
  });
  var band = null, reached2 = false, below = 0, early = false, tallied = false, threaded = false;
  e.on(function (type, p) { if (type === 'story' && p.title === 'These Cases Are One') threaded = true; if (main && type === 'story' && p.title === 'The Receiver') receivers++; });
  for (var t = 0; t < 60 * 40 && !e.s.over; t++) {
    step(e, temper);
    CF.VERB_ORDER.forEach(function (vid) { var v = e.s.verbs[vid]; if (v.status === 'running') seen[v.recipe] = true; });
    if (main) allTicks++;
    if (main && e.s.verbs.reflect && e.s.verbs.reflect.status === 'running') restTicks++;
    if (!tallied && e.abroadTally().n >= 4) tallied = true;
    e.tick(1);
    if (!band && e.countOf('gang')) band = { week: e.s.week, rank: e.s.rank };
    if (band && e.s.rank < 2 && e.countOf('gang')) below++; // ticks the band sat on the table below Bailiff
    if (e.s.rank >= 2 && e.s.week <= 20) reached2 = true;
    if (calling === 'crusader' && e.s.rank < 2 && !early && e.countOf('syndicate') &&
      !e.s.journal.some(function (j) { return j.title === 'The Coquille' && /^The bands have stopped/.test(j.text); })) early = true;
  }
  if (!main) { var sid = calling.slice(0, 4) + ':' + (e.s.over ? e.s.over.id : 'survived'); schemerEnds[sid] = (schemerEnds[sid] || 0) + 1; continue; }
  if (early) earlyCoquille++;
  if (threaded) threadGames++;
  byCalling[calling] = byCalling[calling] || {};
  byCalling[calling][e.s.over ? e.s.over.id : 'survived'] = (byCalling[calling][e.s.over ? e.s.over.id : 'survived'] || 0) + 1;
  if (tallied) tallyGames++;
  perks += Object.keys(e.s.perks || {}).length;
  rivalExposed += e.s.stats.rivalExposed || 0;
  attacks[calling] = attacks[calling] || { runs: 0, n: 0 };
  attacks[calling].runs++; attacks[calling].n += e.s.stats.attacks || 0;
  if (e.s.over && e.s.over.id === 'commissioner') seatWins.push(e.s.week);
  // The calling drifts only when the work has really changed: Power no longer grows from promotions and calm
  // weeks for a run that does not want it.
  drifts[calling] = drifts[calling] || { runs: 0, drifted: 0 };
  drifts[calling].runs++;
  if (e.s.journal.some(function (j) { return j.title === 'Your Calling Changes'; })) drifts[calling].drifted++;
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
// The opening case lost in Court: the desk and the Bell are kept, and the bot
// has a case on the desk again within two minutes.
(function openingLost() {
  var done = false;
  for (var i = 0; i < 6 && !done; i++) {
    var o = CF.Engine.newGame({ seed: 950 + i, who: CF.ORIGIN_ORDER[i % CF.ORIGIN_ORDER.length], name: 'Lost', opening: true, guided: true });
    for (var t = 0; t < 500 && !o.s.over && o.s.flags.stage !== 'hired'; t++) { step(o, 'custom'); o.tick(1); }
    var rec = o.openCases().filter(function (r) { return r.opening; })[0];
    if (!rec) continue;
    var innocent = rec.suspects.filter(function (x) { return !x.guilty; })[0];
    rec.status = 'trial';
    var cc = o.caseCard(rec.id); if (cc) o.remove(cc);
    o.verdict(o.create('trial', { data: { caseId: rec.id, name: innocent.name, guilty: false, solid: false, tier: 'weak', real: 1, need: 6, coerced: 0, planted: 0, contradictions: 0 } }));
    if (rec.status !== 'acquitted') continue;
    done = true;
    assert.ok(!o.s.flags.opening && o.s.flags.stage === 'keep' && !o.s.flags.bellSilent, 'the desk and the Bell are kept after the opening is lost');
    var at = null;
    for (var u = 0; u < 120 && at === null && !o.s.over; u++) { step(o, 'custom'); o.tick(1); if (o.openCases().length) at = u; }
    assert.ok(at !== null, 'a case comes to the desk within two minutes of losing the opening');
  }
  assert.ok(done, 'the opening was lost in one of the seeds');
})();
console.log('bot: ' + GAMES + ' games, and the opening for every origin');
console.log('endings', JSON.stringify(endings));
console.log('final rank [Det, Senior, Insp, ChiefInsp]', JSON.stringify(ranks), 'avg week', (weeks.reduce(function (a, b) { return a + b; }, 0) / GAMES).toFixed(1));
console.log('convictions', convictions, 'acquittals', acquittals, 'wrongful', wrongful);
console.log('by temper', JSON.stringify(byTemper));
console.log('by origin', JSON.stringify(byWho));
console.log('counts per game', JSON.stringify(Object.keys(counts).reduce(function (o, k) { o[k] = +(counts[k] / GAMES).toFixed(2); return o; }, {})));
console.log('recipes never run:', CF.RECIPES.map(function (r) { return r.id; }).filter(function (id) { return !seen[id]; }).join(', ') || 'none');
console.log('insights earned', insights, '| bands formed', bands.length, '| Bailiff by week 20 in', rank2By20, 'games');
console.log('callings drifted', JSON.stringify(drifts));
console.log('attacks per game by calling', JSON.stringify(Object.keys(attacks).reduce(function (o, k) { o[k] = +(attacks[k].n / attacks[k].runs).toFixed(2); return o; }, {})), '| the Seat won at weeks', JSON.stringify(seatWins.sort(function (a, b) { return a - b; })));
console.log('per game: needs met', (needsMet / GAMES).toFixed(2), '| abilities lost', (lost / GAMES).toFixed(2), '| choices answered', (choices / GAMES).toFixed(2));
console.log('a mark left to be found, read in Rest:', stagedRead, '| the Harbourmaster\'s books', JSON.stringify(harbour));
console.log('Rest busy', (100 * restTicks / Math.max(1, allTicks)).toFixed(1) + '% of ticks | the Crowd\'s tally reached 4 in', tallyGames, 'of', GAMES, 'games | Insights learned', trained, '| tricks kept', perks);
console.log('endings by calling', JSON.stringify(byCalling), '| the schemer', JSON.stringify(schemerEnds));
console.log('the network: a Thread found in', threadGames, 'of', GAMES, 'games | the receiver\'s case opened', receivers, 'times | the Pattern read', seen.ref_deduce ? 'yes' : 'no', '| the next door', !!seen.inv_next_door, '| cried', !!seen.major_declare, '| the Court\'s trial', !!seen.undercover_trial, '| the throne', !!seen.undercover_throne, '| a parley', !!seen.undercover_parley);
console.log('the Rival: came', rivalCame, '| exposed', rivalExposed, '| closed a case', rivalClosed, '| beaten on their case', rivalCaught);
assert.ok(convictions > 0, 'the bot should be able to convict someone');
// The network is found in play: two chits to one door, laid together in Rest.
if (GAMES >= 20) assert.ok(threadGames >= 1, 'a Thread is found in at least one game: ' + threadGames + ' of ' + GAMES);
// Soft checks (printed, never failing): over a long run (45 games) every calling should reach
// its own ending at least once, and none be dismissed in more than two games in five. A miss
// is a gap in the design or in this bot, to be read, not a broken build.
var OWN = { commissioner: 'commissioner', master: 'master', crusader: 'crusader' };
Object.keys(OWN).forEach(function (cl) {
  var b = byCalling[cl] || {}, runs = Object.keys(b).reduce(function (n, k) { return n + b[k]; }, 0);
  var line = cl + ': own ending ' + (b[OWN[cl]] || 0) + ', dismissed ' + (b.dismissed || 0) + ' of ' + runs;
  var ok = (b[OWN[cl]] || 0) >= 1 && (b.dismissed || 0) <= runs * 0.4;
  console.log((ok ? 'soft check ok: ' : 'SOFT CHECK MISSED' + (GAMES < 45 ? ' (in ' + GAMES + ' games; meant for 45)' : '') + ': ') + line);
});
// The Rival is a race, not a Standing faucet: caught only at their own work, so in a run of games they win one.
if (GAMES >= 20) assert.ok(rivalClosed >= 1, 'the Rival closes a case in at least one game: ' + rivalClosed);
assert.ok(rivalExposed <= rivalCame, 'never exposed more often than sent');
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
// The Reformer's Coquille is answered from the Watch-house too (the Watch on its stair): the calling
// that is about breaking it is not beaten on the stair more than twice as often as the others.
var atkPer = function (k) { return attacks[k] ? attacks[k].n / attacks[k].runs : 0; };
var atkOthers = (atkPer('commissioner') + atkPer('master')) / 2;
assert.ok(atkPer('crusader') <= 2 * Math.max(1, atkOthers), 'Reformer attacks per game ' + atkPer('crusader').toFixed(2) + ' against ' + atkOthers.toFixed(2));
// The Seat is a campaign, not a stroll: it is won, and not before week twenty in the middle game.
assert.ok(seatWins.length >= 1, 'the Burgomaster ending is reached');
assert.ok(seatWins[Math.floor((seatWins.length - 1) / 2)] > 20, 'the median Seat is won after week 20: ' + JSON.stringify(seatWins));
// The calling holds: at most one run in eight drifts away from what the player chose.
Object.keys(drifts).forEach(function (cl) {
  assert.ok(drifts[cl].drifted * 8 <= Math.max(8, drifts[cl].runs), cl + ' drifted in ' + drifts[cl].drifted + ' of ' + drifts[cl].runs);
});
['comm', 'mast', 'crus'].forEach(function (cl) {
  var played = Object.keys(endings).reduce(function (n, k) { return n + (k.indexOf(cl + ':') === 0 ? endings[k] : 0); }, 0);
  var out = endings[cl + ':dismissed'] || 0;
  assert.ok(out <= Math.ceil(played / 2), cl + ' dismissed in ' + out + ' of ' + played);
});
