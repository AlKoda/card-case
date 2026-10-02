// Growth: the city teaches. Certain things you do often enough, or well
// enough, earn an Insight card. In Rest on its own an Insight becomes a
// lesson: one more Health, Wit or Instinct, for good. With the matching
// ability beside it, it becomes a perk instead: a lasting edge, kept in
// s.perks. The triggers are not announced; the ability cards only hint.
(function (G) {
  var CF = G.CF;
  var P = CF.Engine.prototype;

  // Each Insight says how it is earned (how, count, need), so the ability
  // cards can show the way and how far along it is.
  CF.INSIGHTS = {
    fencing: { label: 'The Fencing-master', trains: 'health', perk: 'Sure-footed',
      how: 'Walk the hard round: Health into Attend, three times.', need: 3, count: function (e) { return recipeCount(e, 'duty_beat'); },
      text: 'A gentleman on the Hill, retired from a regiment nobody names, has watched you walk the hard round past his window three nights running. He offers to teach you the rapier. It is not really about the rapier.',
      lesson: 'Your Health is more than it was.',
      perkText: 'The hard round pays one Coin more: you know where the ground is.' },
    casebook: { label: 'The Old Examiner\'s Method', trains: 'focus', perk: 'The Long Memory',
      how: 'Convict someone on full proof in the Court.', need: 1, count: function (e) { return e.s.stats.solid || 0; },
      text: 'Full proof before the Blood Court, and the judge asked who taught you. Nobody did. But in the drawer of your desk is a leaf in the last examiner\'s hand, and reading it now, you understand it.',
      lesson: 'Your Wit is more than it was.',
      perkText: 'Witnesses keep half again as long before they forget.' },
    ward: { label: 'The Ward by Heart', trains: 'instinct', perk: 'A Nose for the Street',
      how: 'Walk the ward: Instinct alone into Explore, three times.', need: 3, count: function (e) { return recipeCount(e, 'patrol_walk'); },
      text: 'Three rounds of the ward, and you notice you no longer look at the doors. You know which are shut and which only look it.',
      lesson: 'Your Instinct is more than it was.',
      perkText: 'Everything in Explore takes a fifth less time.' },
    sergeant: { label: 'The Sergeant\'s Patience', trains: 'focus', perk: 'Second Wind',
      how: 'Let a case add up in Rest (a case with its tokens), three times.', need: 3, count: function (e) { return recipeCount(e, 'ref_corroborate') + recipeCount(e, 'ref_deduce') + recipeCount(e, 'ref_theory'); },
      text: 'The sergeant has seen every examiner burn out the same way. He shows you how he sits down between things: how he lets a case go for the length of a pipe, and comes back to it.',
      lesson: 'Your Wit is more than it was.',
      perkText: 'Spent Health, Wit and Instinct come back in half the time.' },
    iron: { label: 'An Iron Constitution', trains: 'health', perk: 'Iron',
      how: 'See off three needs (Hunger, Sickness, Stress) in Rest before their clocks run out.', need: 3, count: function (e) { return e.s.stats.needsMet || 0; },
      text: 'Hunger, the river cough and the black nights, and you are still at the desk. The Warrens give everything to everyone in the end, and you have found out what they cannot take.',
      lesson: 'Your Health is more than it was.',
      perkText: 'The needs come for you less often.' },
    ear: { label: 'A Word in the Right Ear', trains: 'instinct', perk: 'The Whisperer',
      how: 'Earn an informer\'s trust: take their word until they trust you fully.', need: 3,
      count: function (e) { var best = 0; e.cardsOf('informant', true).forEach(function (c) { best = Math.max(best, c.data.trust || 0); }); return e.s.flags.trusted ? 3 : best; },
      text: 'An informer trusts you now, which in this city is rarer than gold. They tell you which tapster to buy, and which to be seen buying.',
      lesson: 'Your Instinct is more than it was.',
      perkText: 'Informers bring word sooner.' },
    // The second ring: each office's own work teaches, and opens only with
    // that office (rank). Kept as a trick, the work itself goes quicker
    // (faster: the recipes a third shorter).
    writ: { label: 'The Writ\'s Weight', trains: 'focus', perk: 'The Sealed Hand', rank: 1, faster: ['warrant_search'],
      how: 'Serve the Writ (an Accused with cause, in Explore), twice.', need: 2, count: function (e) { return recipeCount(e, 'warrant_search'); },
      text: 'Two houses searched under seal, and you have learned what a Writ is: not leave to look, but leave to be wrong in public. You read the cause twice now before you sign.',
      lesson: 'Your Wit is more than it was.',
      perkText: 'Serving a Writ takes a third less time.' },
    nightdoor: { label: 'The Night Door', trains: 'instinct', perk: 'Owl', rank: 2, faster: ['stakeout_watch', 'stakeout_front'],
      how: 'Watch a door through the night (Explore), three times.', need: 3, count: function (e) { return recipeCount(e, 'stakeout_watch') + recipeCount(e, 'stakeout_front'); },
      text: 'Three nights in doorways, and you can tell a man going home from a man going out by the way he shuts the door behind him.',
      lesson: 'Your Instinct is more than it was.',
      perkText: 'Watching a door takes a third less time.' },
    whitestaff: { label: 'The White Staff', trains: 'health', perk: 'A Borrowed Coat', rank: 2, faster: ['undercover_op', 'undercover_parley', 'undercover_trial', 'undercover_throne'],
      how: 'Go among them in Disguise (Explore), twice.', need: 2, count: function (e) { return recipeCount(e, 'undercover_op') + recipeCount(e, 'undercover_parley') + recipeCount(e, 'undercover_trial') + recipeCount(e, 'undercover_throne'); },
      text: 'Twice among them in another man\'s coat, and back with all your teeth. The body learns to stand like somebody else\'s, and to run like your own.',
      lesson: 'Your Health is more than it was.',
      perkText: 'Disguise takes a third less time.' },
    crier: { label: 'The Crier\'s Voice', trains: 'focus', perk: 'The Proclamation', rank: 3, faster: ['major_declare'],
      how: 'Have a case cried (a Case with Wit and Coin in Attend), twice.', need: 2, count: function (e) { return recipeCount(e, 'major_declare'); },
      text: 'Twice the crier has sung your words in the squares, and you have learned to write them for the ear: short, with the name last.',
      lesson: 'Your Wit is more than it was.',
      perkText: 'Having a case cried takes a third less time.' },
    eyes: { label: 'The City\'s Eyes', trains: 'instinct', perk: 'Where to Look', rank: 3, faster: ['major_focus'],
      how: 'Turn the Watch\'s Eyes on a Quarter (Attend), twice.', need: 2, count: function (e) { return recipeCount(e, 'major_focus'); },
      text: 'Twice you have sent the whole Watch to one Quarter, and twice you have read the city by what it hid while they looked.',
      lesson: 'Your Instinct is more than it was.',
      perkText: 'Turning the Watch\'s Eyes takes a third less time.' },
    muster: { label: 'The Muster', trains: 'health', perk: 'At the Head of the Column', rank: 3, faster: ['taskforce_run'],
      how: 'Call Out the Watch (a Case with two or three watchmen in Attend), twice.', need: 2, count: function (e) { return recipeCount(e, 'taskforce_run'); },
      text: 'Twice at the head of the Watch through the night streets, and the men keep your pace now, not the sergeant\'s.',
      lesson: 'Your Health is more than it was.',
      perkText: 'Calling Out the Watch takes a third less time.' },
  };
  Object.keys(CF.INSIGHTS).forEach(function (id) { var sp = CF.INSIGHTS[id]; sp.when = function (e) { return sp.count(e) >= sp.need; }; });
  CF.PERKS = { surefoot: 'fencing', longmemory: 'casebook', nose: 'ward', secondwind: 'sergeant', iron: 'iron', whisperer: 'ear',
    sealedhand: 'writ', owl: 'nightdoor', coat: 'whitestaff', proclamation: 'crier', lookhere: 'eyes', column: 'muster' };
  // Is this Insight's office reached? The first ring is open from the start.
  CF.insightOpen = function (e, id) { var sp = CF.INSIGHTS[id]; return !!sp && (e.s.rank || 0) >= (sp.rank || 0); };
  // A kept trick from the second ring: that office work goes a third quicker.
  P.perkPace = function (recipeId) {
    for (var k in CF.PERKS) {
      var sp = CF.INSIGHTS[CF.PERKS[k]];
      if (sp && sp.faster && sp.faster.indexOf(recipeId) >= 0 && this.perkHas(k)) return 2 / 3;
    }
    return 1;
  };
  // The Insights an office opens, for the promotion's word.
  CF.insightsAtRank = function (rank) { return Object.keys(CF.INSIGHTS).filter(function (id) { return (CF.INSIGHTS[id].rank || 0) === rank; }); };

  function recipeCount(e, id) { return (e.s.stats.recipes && e.s.stats.recipes[id]) || 0; }

  // The ways an ability grows, with how far along each is: for the ability
  // cards' dossier and the advisor. state: open (not yet earned), waiting
  // (the Insight is out, take it to Rest), learned; with `locked`, also an
  // office's own Insight not yet open (state locked, with its rank), for the
  // dossier to name dim with its office.
  CF.growthWays = function (e, ability, locked) {
    var s = e.s, cards = s.cards || {};
    // An office's Insights show once the office is yours, or once earned.
    return Object.keys(CF.INSIGHTS).filter(function (id) { return CF.INSIGHTS[id].trains === ability && (locked || CF.insightOpen(e, id) || (s.insights && s.insights[id])); }).map(function (id) {
      var sp = CF.INSIGHTS[id];
      var waiting = Object.keys(cards).some(function (u) { var c = cards[u]; return c.def === 'insight' && c.data && c.data.insight === id; });
      var earned = !!(s.insights && s.insights[id]);
      var shut = !earned && !waiting && !CF.insightOpen(e, id);
      return { id: id, label: sp.label, how: sp.how, n: Math.min(sp.need, sp.count(e)), need: sp.need, rank: sp.rank || 0, state: waiting ? 'waiting' : earned ? 'learned' : shut ? 'locked' : 'open' };
    });
  };

  // After every finished verb: has anything been earned?
  P.growthTick = function () {
    var s = this.s, self = this;
    if (s.over || !s.stats) return;
    s.insights = s.insights || {};
    Object.keys(CF.INSIGHTS).forEach(function (id) {
      if (s.insights[id] || !CF.insightOpen(self, id)) return;
      var spec = CF.INSIGHTS[id];
      if (!spec.when(self)) return;
      s.insights[id] = true;
      self.create('insight', { label: spec.label, desc: spec.text + ' (In Rest on its own it is a lesson: one more ' + CF.CARDS[spec.trains].label + ', for good. With your ' + CF.CARDS[spec.trains].label + ' beside it, it is kept as a trick instead: ' + spec.perkText + ')', data: { insight: id } });
      self.story('An Insight: ' + spec.label, spec.text + ' Take it to Rest.', 'major');
    });
  };
  P.perkId = function (insightId) {
    for (var k in CF.PERKS) if (CF.PERKS[k] === insightId) return k;
    return null;
  };
  P.perkLabel = function (perkId) { var spec = CF.INSIGHTS[CF.PERKS[perkId]]; return spec ? spec.perk : perkId; };
  P.perkList = function () { var s = this.s; return Object.keys(s.perks || {}).filter(function (k) { return s.perks[k]; }); };
})(typeof window !== 'undefined' ? window : globalThis);
