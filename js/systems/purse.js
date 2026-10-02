// The purse (docs/CITY.md §7). This city pays its officers in fees; that
// is the job. Corruption is when the fee decides the answer. The Purse
// count on the Calling card rises every time money changes the truth, and
// Underworld Debt rises every time the underworld does your work for you.
//
//   temptations   a gratuity (honest: Purse 0), a purse in a plea (Sentence),
//                 a patrician's letter asking for a writ sold, the
//                 Thief-takers' cut, blood money for a frame
//   endings       The Thief-taker General (corrupt and working) and
//                 The Old Bailey (lost to greed)
(function (G) {
  var CF = G.CF;
  var U = CF.util;
  var P = CF.Engine.prototype;

  var Purse = (CF.Purse = {});
  // The corrupt road is a road: the office of a Magistrate, a name in the
  // chamber, and the thief-takers' settlements walked more than once.
  Purse.THIEFTAKER = { purse: 9, wrongful: 1, standing: 12, rank: 3, settled: 2 };
  Purse.OLDBAILEY = { purse: 6, wrongful: 3, frames: 2, debt: 4 };

  // A patrician wants a rival's house searched. The letter waits on the desk.
  P.offerWritSale = function () {
    if (this.s.rank < 1 || this.countOf('writsale')) return null;
    var rival = this.newName();
    var council = this.rng() < 0.4;
    return this.create('writsale', {
      label: 'A Patrician\'s Letter',
      desc: 'A letter under a good seal. The writer would take it kindly if the Examiner found cause to search the house of ' + rival + (council ? ', of a Council family' : ', a merchant of the Hill') + '. Three Coin are mentioned, delicately. Put it in Attend to oblige, or let it lie.',
      data: { rival: rival, council: council },
    });
  };

  // Recovering the goods for a fee, without prosecuting. The thief-takers
  // know who did it because they know everybody; sometimes what they bring
  // back is a frame.
  P.thieftakersSettle = function (rec, ctx) {
    var s = this.s, rng = ctx ? ctx.rng : this.rng;
    var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
    var roll = rng();
    this.count('debt', 1);
    if (roll < 0.6) {
      // Settled: the goods come back, the case closes, nobody stands trial.
      rec.status = 'settled';
      this.releaseDelegate(rec);
      var cc = this.caseCard(rec.id);
      if (cc) this.remove(cc);
      this.clearCaseCards(rec.id);
      this.meter('pressure', rec.highProfile ? -1 : -1);
      this.count('purse', 1);
      this.create('funds'); this.create('funds');
      s.stats.settled = (s.stats.settled || 0) + 1;
      this.emit('resolved', this.caseRecord(rec, 'settled', null));
      var c = this.criminalEscapes(rec, culprit, 'settled');
      this.abroadCard(c, 'Named by the thief-takers, never charged. The goods came back; they did not.');
      return { title: 'Settled: ' + rec.title, text: 'Two days later the goods are on your desk, most of them, and a thief-taker\'s man is waiting for his cut. ' + culprit.name + ' is named in a low voice and will not be charged; that was the price. The victim is grateful. The Rolls say the case is answered. They do not say how.', kind: 'minor' };
    }
    if (roll < 0.85) {
      // A frame: a suspect and a Word against them that would convict.
      var innocent = rec.suspects.filter(function (x) { return !x.guilty && !x.cleared; })[0];
      if (innocent) {
        var sc = this.revealSuspect(rec, ctx, { key: innocent.key });
        var clue = this.clueSpec(rec, { label: 'The Thief-takers\' Word', text: 'Two of their men will swear they saw ' + innocent.name + ' with the goods. They swear very readily.', aspects: { testimony: 3, opportunity: 1 } }, [], { points: innocent.key, noMisread: true });
        clue.data.frame = true;
        clue.data.stake = 'reward';
        if (ctx) ctx.give('clue', clue); else this.create('clue', clue);
        return { title: 'A Name, and Two Witnesses', text: 'The thief-takers bring you ' + (sc ? sc.label : innocent.name) + ' and two men who will swear to anything. It would convict. Whether it is true is not a question they were paid to answer.', kind: 'minor' };
      }
    }
    return { title: 'Nothing for Your Coin', text: 'The thief-takers take the Coin and come back with shrugs. The goods are already out of the city, they say. They may even be telling the truth.', kind: 'minor' };
  };

  // The upright man's offer, taken (life.js 'upright', 'Take it'): a Coin
  // now, and a Coin a week while his band stands (s.flags.uprightPaid holds
  // the band's name). Returns the band's name, or null with no band.
  P.takeUpright = function () {
    var band = this.cardsOf('gang', true)[0];
    this.create('funds');
    this.count('purse');
    this.meter('retaliation', -3);
    this.s.flags.uprightPaid = band ? band.data.name : null;
    this.s.flags.uprightBroken = false;
    return this.s.flags.uprightPaid;
  };
  // The boy's weekly visit, or the week he does not come.
  P.uprightWeek = function () {
    var s = this.s, name = s.flags.uprightPaid;
    if (!name) return [];
    var stands = this.cardsOf('gang', true).some(function (c) { return c.data && c.data.name === name; });
    if (stands) {
      this.create('funds');
      if (s.week % 2 === 0) this.count('purse');
      return ['The upright man\'s boy brings the week\'s Coin. The band keeps clear of your stair.'];
    }
    var broken = !!s.flags.uprightBroken;
    s.flags.uprightPaid = null;
    s.flags.uprightBroken = false;
    return [broken ? 'The boy does not come this week. His upright man is in the Hole, and so, in a manner of speaking, is your Coin.'
      : 'The boy does not come this week. His band answers to the Coquille now, and the Coquille pays nobody.'];
  };

  // The purse left on the desk with a note (life.js 'purse'): the note names
  // an open case of yours, chosen by the week. Null when no case is open.
  P.purseNote = function () {
    var open = this.openCases().filter(function (r) { return !r.special; });
    if (!open.length) return null;
    var rec = open[this.s.week % open.length];
    return { caseId: rec.id, title: rec.title };
  };
  // Who left it: a suspect of that case who is of the Hill, revealed as a
  // card, or null when the case has none (then the Informer on the Hill).
  Purse.HILL = /\bHill\b|patrician|councillor|benefactor|judge|doctor of laws/i;
  P.purseSender = function (caseId) {
    var rec = this.caseRec(caseId);
    if (!rec || rec.status !== 'open') return null;
    var hill = rec.suspects.filter(function (x) { return !x.cleared && Purse.HILL.test(x.role || ''); })[0];
    if (!hill) return null;
    var card = this.cardsOf('suspect', true).filter(function (c) { return c.caseId === rec.id && c.data && c.data.key === hill.key; })[0];
    return card || this.revealSuspect(rec, null, { key: hill.key });
  };

  // Every week: debts are called in, letters arrive, and two roads end.
  P.purseWeek = function () {
    var s = this.s, lines = this.uprightWeek(), cnt = s.counts || {};
    if (s.rank >= 1 && !this.countOf('writsale') && this.rng() < 0.15) {
      this.offerWritSale();
      lines.push('A letter under a good seal waits on your desk. It asks nothing outright.');
    }
    if ((cnt.debt || 0) >= 2 && this.rng() < 0.5) {
      this.meter('retaliation', 1);
      lines.push('The thief-takers\' men drink at the Red Ox and talk about what the Examiner owes them.');
    }
    if ((cnt.debt || 0) >= 4 && this.rng() < 0.4 && !this.countOf('bribe')) {
      this.create('bribe');
      lines.push('A purse on the desk, again. This one has a note: "For looking the other way."');
    }
    return lines;
  };

  // Whether the Thief-taker General's counts hold now (for the warning, the
  // ending and the interface).
  P.thieftakerMet = function () {
    var s = this.s, cnt = s.counts || {}, st = s.stats || {}, T = Purse.THIEFTAKER;
    return (cnt.purse || 0) >= T.purse && (st.wrongful || 0) <= T.wrongful && s.meters.reputation >= T.standing &&
      s.rank >= T.rank && (st.settled || 0) >= T.settled;
  };

  // The two ends of the corrupt road. The Thief-taker General is told a
  // week before it lands, as every count ending is (societies.js).
  P.checkPurseEndings = function () {
    var s = this.s, cnt = s.counts || {}, st = s.stats;
    if (s.over) return;
    var purse = cnt.purse || 0;
    if (purse >= Purse.OLDBAILEY.purse && (st.wrongful >= Purse.OLDBAILEY.wrongful || (st.frames || 0) >= Purse.OLDBAILEY.frames || (cnt.debt || 0) >= Purse.OLDBAILEY.debt)) {
      this.gameOver('oldbailey');
      return;
    }
    if (!this.thieftakerMet()) return;
    if (!s.flags.thieftakerWarned) {
      s.flags.thieftakerWarned = true;
      this.story('The General', 'The fences of the Free City have started to call you General.', 'major');
      return;
    }
    this.gameOver('thieftaker');
  };
})(typeof window !== 'undefined' ? window : globalThis);
