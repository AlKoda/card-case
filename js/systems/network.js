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
  // The receiver of stolen goods: a front with no band behind it, seeded at
  // the first promotion. The thefts go through it (FENCE_KINDS), at the same
  // chances; its door is decided by the case's own names, never on the rng's
  // stream. A Thread on it opens a case against the receiver (ref_thread).
  //   front.fence: true; front.fallen: true once the receiver is convicted
  Net.FENCE_KINDS = ['burglary', 'fraud', 'coining', 'extortion'];
  Net.FENCE_NAMES = ['{last}\'s Pawnshop', 'the {last} Lane Lock-up'];
  // The dossier's quiet cue on a link token whose door another token on the table names too (a dossier line: no stop).
  Net.TWIN_LINE = 'Another token on the table names the same door';

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
    var f = { id: 'f' + this.s.nextUid++, name: name, district: district, gang: gangName, known: false, watched: false, fence: false, fallen: false };
    this.s.network.fronts[f.id] = f;
    return f;
  };

  // The front a case's culprit works through, if any; else, sometimes, any
  // band's front; else, for a theft (tid) while the receiver keeps his door,
  // his front, by the case's own names (key).
  P.frontForCase = function (opts, tid, key) {
    var crim = opts.criminalId && this.criminal(opts.criminalId);
    var all = this.frontsFor().filter(function (f) { return !f.fence; });
    if (all.length) {
      if (crim && crim.organization !== 'none') {
        var gangs = this.cardsOf('gang', true);
        var mine = all.filter(function (f) { return gangs.some(function (g) { return g.data.name === f.gang && (g.data.members || []).indexOf(crim.name) >= 0; }); });
        if (mine.length) return mine[0];
        return all[0];
      }
      var known = all.some(function (f) { return f.known; });
      if (this.rng() < (known ? Net.LINK_CHANCE_KNOWN : Net.LINK_CHANCE)) return U.pick(this.rng, all);
    }
    var fence = this.fenceFront();
    if (!fence || !tid || Net.FENCE_KINDS.indexOf(tid) < 0) return null;
    var roll = CF.Engine.nameHash(String(key || '') + '|fence') % 100;
    return roll < (fence.known ? Net.LINK_CHANCE_KNOWN : Net.LINK_CHANCE) * 100 ? fence : null;
  };
  // The receiver's front while he keeps his door, or null.
  P.fenceFront = function () {
    var f = this.fronts();
    for (var k in f) if (f[k].fence && !f[k].fallen) return f[k];
    return null;
  };
  // The receiver opens his door at the first promotion: a front with no band,
  // named by the seed (no draw from the rng), and nobody is told.
  P.seedFence = function () {
    var f = this.fronts();
    for (var k in f) if (f[k].fence) return f[k];
    var h = CF.Engine.nameHash('fence|' + this.s.seed);
    var name = U.fill(Net.FENCE_NAMES[h % Net.FENCE_NAMES.length], { last: CF.NAMES.last[Math.floor(h / 7) % CF.NAMES.last.length] });
    var fr = { id: 'f' + this.s.nextUid++, name: name, district: 'market', gang: 'the receivers', known: false, watched: false, fence: true, fallen: false };
    this.s.network.fronts[fr.id] = fr;
    return fr;
  };
  // Who works through a front, in a sentence: a band, or the receiver.
  P.frontWho = function (front) {
    return front.fence ? 'A receiver of stolen goods keeps it.' : front.gang.replace(/^the /, 'The ') + ' works through it.';
  };
  // Another token on the table that names the same door as `card`, from
  // another case (the dossier's quiet cue, Net.TWIN_LINE), or null.
  P.linkTwin = function (card) {
    if (!card || card.def !== 'clue' || !card.data || !card.data.link) return null;
    var cs = this.s.cards;
    for (var k in cs) {
      var c = cs[k];
      // A find still face down is not yet read: it names no door.
      if (c === card || c.def !== 'clue' || c.hidden || !c.loc || c.loc.t !== 'table' || !c.data || c.data.link !== card.data.link) continue;
      if (c.caseId !== card.caseId) return c;
    }
    return null;
  };

  // The case against the receiver, opened from a Thread on his door: the
  // scene is his front; rec.fenceFront remembers which (casesAtFront leaves it out).
  P.openReceiver = function (front, ctx) {
    var card = this.spawnCase('receiver', { ctx: ctx, scene: front.name, district: front.district, headline: 'The Receiver', lead: 'Two of your cases went through one door.' });
    var rec = this.caseRec(card.caseId);
    rec.fenceFront = front.id;
    return card;
  };
  P.receiverOpen = function (fid) {
    return this.openCases().some(function (r) { return r.template === 'receiver' && r.fenceFront === fid; });
  };
  // The receiver convicted: his door shuts, and every open case that went
  // through it gets its goods back, and the name of who brought them in.
  P.receiverConvicted = function (rec, notes) {
    var f = this.fronts()[rec.fenceFront], self = this;
    if (!f) return 0;
    f.fallen = true;
    var n = 0;
    this.casesAtFront(f.id).forEach(function (r) {
      if (r.id === rec.id) return;
      self.create('clue', self.clueSpec(r, { label: 'Recovered Goods', text: U.fill('The receiver\'s back room gives up what was taken in {title}, and his book says who brought it in.', { title: r.title }), aspects: { financial: 2, testimony: 1 } }, [], { points: r.culprit, noMisread: true }));
      n++;
    });
    notes.push(n ? U.fill('{front} is shut. In the back room, goods from {n} of your cases, and the book that says who brought them.', { front: f.name, n: n })
      : U.fill('{front} is shut, and the city\'s thieves must find another door.', { front: f.name }));
    return n;
  };

  // A scene item that points at a front. The receiver's door is drawn by the
  // case's names (key), off the rng's stream.
  P.linkItem = function (front, key) {
    var it = U.clone(front.fence ? LINK_ITEMS[CF.Engine.nameHash(String(key || '') + '|link') % LINK_ITEMS.length] : U.pick(this.rng, LINK_ITEMS));
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
      desc: front.fence ? U.fill('{name}, {district}. A receiver of stolen goods keeps it: what is taken in the city is sold through it. Watch it for who brings what.', { name: front.name, district: CF.DISTRICTS[front.district].label })
        : front.name + ', ' + CF.DISTRICTS[front.district].label + '. ' + front.gang.replace(/^the /, 'The ') + ' works through it. Watch it for what passes through, or go in Disguise here for a way in.',
      data: { front: front.id, gang: front.gang },
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
