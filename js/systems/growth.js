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
      text: 'A gentleman on the Hill, retired from a regiment nobody names, has watched you walk the hard round past his window three nights running. He offers to teach you the small sword. It is not really about the sword.',
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
      text: 'Hunger, fever and the black nights, and you are still at the desk. The Warrens give everything to everyone in the end, and you have found out what they cannot take.',
      lesson: 'Your Health is more than it was.',
      perkText: 'The needs come for you less often.' },
    ear: { label: 'A Word in the Right Ear', trains: 'instinct', perk: 'The Whisperer',
      how: 'Earn an informer\'s trust: take their word until they trust you fully.', need: 3,
      count: function (e) { var best = 0; e.cardsOf('informant', true).forEach(function (c) { best = Math.max(best, c.data.trust || 0); }); return e.s.flags.trusted ? 3 : best; },
      text: 'An informer trusts you now, which in this city is rarer than gold. They tell you which tapster to buy, and which to be seen buying.',
      lesson: 'Your Instinct is more than it was.',
      perkText: 'Informers bring word sooner.' },
  };
  Object.keys(CF.INSIGHTS).forEach(function (id) { var sp = CF.INSIGHTS[id]; sp.when = function (e) { return sp.count(e) >= sp.need; }; });
  CF.PERKS = { surefoot: 'fencing', longmemory: 'casebook', nose: 'ward', secondwind: 'sergeant', iron: 'iron', whisperer: 'ear' };

  function recipeCount(e, id) { return (e.s.stats.recipes && e.s.stats.recipes[id]) || 0; }

  // The ways an ability grows, with how far along each is: for the ability
  // cards' dossier and the advisor. state: open (not yet earned), waiting
  // (the Insight is out, take it to Rest), learned.
  CF.growthWays = function (e, ability) {
    var s = e.s, cards = s.cards || {};
    return Object.keys(CF.INSIGHTS).filter(function (id) { return CF.INSIGHTS[id].trains === ability; }).map(function (id) {
      var sp = CF.INSIGHTS[id];
      var waiting = Object.keys(cards).some(function (u) { var c = cards[u]; return c.def === 'insight' && c.data && c.data.insight === id; });
      var earned = !!(s.insights && s.insights[id]);
      return { id: id, label: sp.label, how: sp.how, n: Math.min(sp.need, sp.count(e)), need: sp.need, state: waiting ? 'waiting' : earned ? 'learned' : 'open' };
    });
  };

  // After every finished verb: has anything been earned?
  P.growthTick = function () {
    var s = this.s, self = this;
    if (s.over || !s.stats) return;
    s.insights = s.insights || {};
    Object.keys(CF.INSIGHTS).forEach(function (id) {
      if (s.insights[id]) return;
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
