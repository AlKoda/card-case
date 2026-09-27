// Endings from the counts, and the two late societies (docs/CITY.md §8, §10).
//
//   The Merciful Judge      Mercy 8, Cruelty at most 1, three reformed citizens
//   The Hangman's Examiner  Cruelty 8: the Council keeps you, the city fears you
//   The Stake               the Inquisitor's charge lands on you
//   The Dagger on the Pillow  the Order of the Mountain, warned once and ignored
//
//   The Order of the Mountain: fida'is under cover in the city, who leave a
//   dagger on a pillow as a warning first. They cannot be broken, only
//   bargained with (Coin in Rest) or endured. They are what an
//   Examiner on the way to the Seat meets.
//   The Eumenides: a charitable brotherhood of patricians whose private face
//   leaves the Harbour a torso a season. Their cases never point at them;
//   only a Thread between two of them does. Breaking them is the Scholar's
//   late case, and the Council will not thank you.
(function (G) {
  var CF = G.CF;
  var U = CF.util;
  var P = CF.Engine.prototype;

  var Soc = (CF.Societies = {});
  Soc.MERCIFUL = { mercy: 12, cruelty: 1, reformed: 4 };
  Soc.HANGMANS = { cruelty: 14, dread: 5 };
  Soc.MOUNTAIN = { week: 8, rank: 2, chance: 0.12, grace: 6 };
  Soc.EUMENIDES = { week: 8, chance: 0.2 };

  P.reformedCount = function () {
    var n = 0, s = this.s.criminals;
    for (var k in s) if (s[k].status === 'reformed') n++;
    return n;
  };

  // ---- Endings from the counts, every week --------------------------------------
  P.checkCountEndings = function () {
    var s = this.s, cnt = s.counts || {}, f = s.favour || {};
    if (s.over) return;
    if ((cnt.mercy || 0) >= Soc.MERCIFUL.mercy && (cnt.cruelty || 0) <= Soc.MERCIFUL.cruelty && this.reformedCount() >= Soc.MERCIFUL.reformed) { this.gameOver('merciful'); return; }
    if ((cnt.cruelty || 0) >= Soc.HANGMANS.cruelty && s.meters.dread >= Soc.HANGMANS.dread) { this.gameOver('hangmans'); return; }
    if ((f.bishop || 0) <= -4 && s.flags.inquisitor && (s.stats.wrongful || 0) >= 1 && this.rng() < 0.15) { this.gameOver('stake'); return; }
  };

  // ---- The Order of the Mountain ---------------------------------------------------
  P.mountainWeek = function () {
    var s = this.s, lines = [];
    if (s.calling !== 'commissioner' || s.rank < Soc.MOUNTAIN.rank || s.week < Soc.MOUNTAIN.week) return lines;
    if (s.flags.mountainPaidUntil && s.week <= s.flags.mountainPaidUntil) return lines;
    if (this.countOf('dagger') || this.rng() >= Soc.MOUNTAIN.chance) return lines;
    this.create('dagger', {
      label: 'A Dagger on the Pillow',
      desc: 'You wake and it is there, on the pillow beside your head, and the door is still barred. The Order of the Mountain does not ask for anything. It warns once. Rest it with Coin to buy a season; contemplate it alone to endure. Let it lie and they come back.',
      data: { week: s.week },
    });
    lines.push('There was a dagger on your pillow this morning. The door was barred. Somebody wants you to know what they can do.');
    return lines;
  };
  // The warning ignored.
  P.mountainStrikes = function () {
    var s = this.s;
    if (this.rng() < 0.5) { this.gameOver('dagger'); return; }
    this.hurtYou('A man in a servant\'s coat on the Watch-house stair, a blade under the ribs, and gone before anyone shouts. The Order of the Mountain keeps its word.');
    this.meter('dread', 1);
  };

  // ---- The Eumenides --------------------------------------------------------------
  P.eumenidesFront = function () {
    var s = this.s;
    if (s.flags.eumenidesFront && s.network.fronts[s.flags.eumenidesFront]) return s.network.fronts[s.flags.eumenidesFront];
    var f = this.newFront('the Eumenides', 'uptown');
    f.name = 'the Hospital of St Julian';
    f.society = 'eumenides';
    s.flags.eumenidesFront = f.id;
    return f;
  };
  P.eumenidesWeek = function () {
    var s = this.s, lines = [];
    if (s.calling !== 'master' || s.week < Soc.EUMENIDES.week || s.flags.eumenidesBroken) return lines;
    if (this.rng() >= Soc.EUMENIDES.chance || this.openCases().length >= this.maxOpenCases()) return lines;
    if (this.openCases().some(function (r) { return r.society === 'eumenides'; })) return lines;
    var front = this.eumenidesFront();
    var card = this.spawnCase('harbor', { quiet: true, frontId: front.id });
    var rec = this.caseRec(card.caseId);
    rec.society = 'eumenides';
    card.desc += ' Another torso. The Harbour has given up one a season for years, and every case closes on some sailor. This one has a patrician\'s ring-mark on its finger.';
    this.story('A Torso at the Harbour', 'The Harbour has given up another one: a body without a head or hands, wrapped like a parcel, with a ring-mark on one finger that no sailor ever wore. The last three closed on sailors. Find what this one has in common with the next.', 'case');
    lines.push('The Harbour gave up a torso this week.');
    return lines;
  };
  // Two torsos connected by a Thread: the brotherhood shows its face.
  P.openEumenides = function (ctx) {
    var s = this.s;
    var card = this.spawnCase('eumenides', { ctx: ctx, headline: 'The Eumenides', lead: 'Two torsos, one hospital door.' });
    s.flags.eumenidesCase = card.caseId;
    return card;
  };
  P.eumenidesBroken = function (rec, d, notes) {
    var s = this.s;
    s.flags.eumenidesBroken = true;
    this.pathGain('master', 3, 'broke the Eumenides');
    if (this.favourGain) this.favourGain('council', -2);
    this.meter('reputation', 2);
    notes.push('The Hospital of St Julian closes its doors. Half the Hill was on its board of charity, and the Council will not thank you for what you have read aloud in the Blood Court.');
  };
})(typeof window !== 'undefined' ? window : globalThis);
