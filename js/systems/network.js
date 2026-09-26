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
  Net.LINK_CHANCE = 0.25; // ordinary cases that touch a front while one exists

  var FRONT_NAMES = {
    docks: ['Pier {n} Storage', 'the {last} Bonded Warehouse', 'Berth {n}'],
    market: ['{last}\'s Pawnbrokers', 'the {last} Street Lock-Up', 'a stall at the back of the Old Market'],
    neon: ['the {gang} Club', 'the {last} Card Room', 'a bar with no name on Neon Row'],
    uptown: ['{last} Holdings', 'a townhouse on {last} Square', 'the {last} Foundation'],
    warrens: ['the {last} Street Boarding House', 'a basement under {last} Court', 'the launderette on {last} Row'],
    canal: ['{last} & Co. Warehouse', 'the {last} Street Workshop', 'a barge moored at {last} Wharf'],
  };
  var LINK_ITEMS = [
    { label: 'A Receipt from {front}', text: 'Folded small, in the wrong pocket. A receipt from {front}, dated last week.', aspects: { financial: 1, opportunity: 1 } },
    { label: 'Matchbook: {front}', text: 'A matchbook from {front}. Half the matches gone.', aspects: { opportunity: 1, testimony: 1 } },
    { label: 'Delivery Docket', text: 'A delivery docket with the address of {front}, and a signature that is not a name.', aspects: { financial: 1, digital: 1 } },
    { label: 'Torn Ticket Stub', text: 'A ticket stub from {front}. Somebody spends their evenings there.', aspects: { opportunity: 1, testimony: 1 } },
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
    return this.rng() < Net.LINK_CHANCE ? U.pick(this.rng, all) : null;
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
      desc: front.name + ', ' + CF.DISTRICTS[front.district].label + '. ' + front.gang.replace(/^the /, 'The ') + ' works through it. Stake it out for what passes through, or go Undercover here for a way in.',
      data: { front: front.id, gang: front.gang },
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
