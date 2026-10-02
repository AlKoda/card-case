// The crime network (roadmap Phase 14). People, gangs, places, cases and
// informants are linked underneath the surface. The player is never told
// which cases connect: clues carry links to the same front, and the mind
// palace notices when two of them, from different cases, are laid together.
//
//   s.network.fronts[id] = { id, name, district, gang, known, watched }
// A front is a place a gang works through: a warehouse, a pawnshop, a
// club. Cases committed by the gang's people, and some ordinary cases,
// carry a clue that points at it. Two such clues from different cases in
// Reflect make a Thread and put the Front on the table; the Front can be
// staked out, or used as a way in for Undercover.
(function (G) {
  var CF = G.CF;
  var U = CF.util;
  var P = CF.Engine.prototype;

  var Net = (CF.Network = {});
  // Ordinary cases that touch a front while one exists: likelier while no
  // front is known yet, so the first thread is there to find.
  Net.LINK_CHANCE = 0.4;
  Net.LINK_CHANCE_KNOWN = 0.15;

  var FRONT_NAMES = {
    docks: ['the Crane-house at Berth {n}', 'the {last} Bonded Warehouse', 'Berth {n}'],
    market: ['{last}\'s Pawnshop', 'the {last} Lane Lock-up', 'a stall at the back of the Market'],
    neon: ['the {gang} Bathhouse', 'the {last} Dice-cellar', 'a tavern with no sign in the Stews'],
    uptown: ['{last} & Company', 'a house on {last} Square', 'the {last} Almshouse'],
    warrens: ['the {last} Lane Lodging-house', 'a cellar under {last} Court', 'the washhouse in {last} Row'],
    canal: ['the {last} Chantry', 'the {last} Workshop by the Close', 'a barge moored at {last} Wharf'],
  };
  var LINK_ITEMS = [
    { label: 'A Chit from {front}', text: 'Folded small, in the wrong pocket. A chit from {front}, dated last week. A chit in a drawer keeps.', aspects: { financial: 1, opportunity: 1 } },
    { label: 'A Tavern Token: {front}', text: 'A lead token from {front}, the kind they give for a drink owed. Rubbed smooth. A chit in a drawer keeps.', aspects: { opportunity: 1, testimony: 1 } },
    { label: 'A Carrier\'s Docket', text: 'A carrier\'s docket for a load to {front}, and a mark that is not a name. A chit in a drawer keeps.', aspects: { financial: 1, digital: 1 } },
    { label: 'A Torn Tally', text: 'Half a tally-stick from {front}. Somebody spends their evenings there, and owes. A chit in a drawer keeps.', aspects: { opportunity: 1, testimony: 1 } },
  ];

  P.fronts = function () { return this.s.network.fronts; };
  P.frontsFor = function (gangName) {
    var out = [], f = this.fronts();
    for (var k in f) if (!gangName || f[k].gang === gangName) out.push(f[k]);
    return out;
  };

  // A gang gets a place to work through.
  P.newFront = function (gangName, district) {
    district = district || U.pick(this.rng, Object.keys(CF.DISTRICTS));
    var name = U.fill(U.pick(this.rng, FRONT_NAMES[district]), { n: U.randInt(this.rng, 2, 19), last: U.pick(this.rng, CF.NAMES.last), gang: gangName.replace(/^the /, '') });
    var f = { id: 'f' + this.s.nextUid++, name: name, district: district, gang: gangName, known: false, watched: false };
    this.s.network.fronts[f.id] = f;
    return f;
  };

  // The front a case's culprit works through, if any; else, sometimes, any front.
  P.frontForCase = function (opts) {
    var crim = opts.criminalId && this.criminal(opts.criminalId);
    var all = this.frontsFor();
    if (!all.length) return null;
    if (crim && crim.organization !== 'none') {
      var gangs = this.cardsOf('gang', true);
      var mine = all.filter(function (f) { return gangs.some(function (g) { return g.data.name === f.gang && (g.data.members || []).indexOf(crim.name) >= 0; }); });
      if (mine.length) return mine[0];
      return all[0];
    }
    var known = all.some(function (f) { return f.known; });
    return this.rng() < (known ? Net.LINK_CHANCE_KNOWN : Net.LINK_CHANCE) ? U.pick(this.rng, all) : null;
  };

  // A scene item that points at a front.
  P.linkItem = function (front) {
    var it = U.clone(U.pick(this.rng, LINK_ITEMS));
    it.type = 'clue';
    it.label = U.fill(it.label, { front: front.name });
    it.text = U.fill(it.text, { front: front.name });
    it.link = front.id;
    return it;
  };

  // Open cases that touch a front.
  P.casesAtFront = function (frontId) {
    return this.openCases().filter(function (r) { return r.front === frontId; });
  };

  // The Front card on the table, made when a Thread is found.
  P.revealFront = function (front) {
    front.known = true;
    var existing = this.cardsOf('front', true).filter(function (c) { return c.data.front === front.id; })[0];
    if (existing) return existing;
    return this.create('front', {
      label: front.name.charAt(0).toUpperCase() + front.name.slice(1),
      desc: front.name + ', ' + CF.DISTRICTS[front.district].label + '. ' + front.gang.replace(/^the /, 'The ') + ' works through it. Watch it for what passes through, or go in Disguise here for a way in.',
      data: { front: front.id, gang: front.gang },
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
