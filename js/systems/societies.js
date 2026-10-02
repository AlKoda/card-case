// Endings from the counts, and the two late societies (docs/CITY.md §8, §10).
//
//   The Merciful Judge      Mercy 8, Cruelty at most 1, three reformed citizens
//   The Hangman's Examiner  Cruelty 12 and Dread 5: the Council keeps you, the city fears you
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
  Soc.HANGMANS = { cruelty: 12, dread: 5 };
  Soc.MOUNTAIN = { week: 8, rank: 2, chance: 0.12, grace: 6 };
  Soc.EUMENIDES = { week: 8, chance: 0.2 };

  // The Merciful warning counts honestly what is still wanted: mercies (up
  // to two) and citizens made (up to one).
  Soc.MERCIFUL_LINES = {
    '0,0': 'The Council has begun to call you the merciful judge. Hold to it one more week, and it will be your name.',
    '1,0': 'The Council has begun to call you the merciful judge. One more mercy, and it will be your name.',
    '2,0': 'The Council has begun to call you the merciful judge. Two more mercies, and it will be your name.',
    '0,1': 'The Council has begun to call you the merciful judge. One more citizen made, and it will be your name.',
    '1,1': 'The Council has begun to call you the merciful judge. One more mercy and one more citizen made, and it will be your name.',
    '2,1': 'The Council has begun to call you the merciful judge. Two more mercies and one more citizen made, and it will be your name.',
  };
  Soc.mercifulLine = function (n, r) { return Soc.MERCIFUL_LINES[Math.min(2, n) + ',' + Math.min(1, r)]; };

  P.reformedCount = function () {
    var n = 0, s = this.s.criminals;
    for (var k in s) if (s[k].status === 'reformed') n++;
    return n;
  };

  // ---- Endings from the counts, every week --------------------------------------
  // Each ending is told a week or more before it lands: the warning and the
  // ending never fall in the same tick.
  P.checkCountEndings = function () {
    var s = this.s, cnt = s.counts || {}, f = s.favour || {};
    if (s.over) return;
    var M = Soc.MERCIFUL, H = Soc.HANGMANS;
    var mercy = cnt.mercy || 0, cruelty = cnt.cruelty || 0, reformed = this.reformedCount();
    if (!s.flags.mercifulWarned && mercy >= M.mercy - 2 && cruelty <= M.cruelty && reformed >= M.reformed - 1) {
      s.flags.mercifulWarned = true;
      this.story('The Merciful Judge', Soc.mercifulLine(Math.max(0, M.mercy - mercy), Math.max(0, M.reformed - reformed)), 'major');
      return;
    }
    if (s.flags.mercifulWarned && mercy >= M.mercy && cruelty <= M.cruelty && reformed >= M.reformed) { this.gameOver('merciful'); return; }
    if (!s.flags.hangmanWarned && cruelty >= H.cruelty - 2) {
      s.flags.hangmanWarned = true;
      this.story('The Executioner\'s Table', 'The executioner has started saving you a place at his table.', 'danger');
      return;
    }
    if (s.flags.hangmanWarned && cruelty >= H.cruelty && s.meters.dread >= H.dread) { this.gameOver('hangmans'); return; }
    if ((f.bishop || 0) <= -4 && s.flags.inquisitor && (s.stats.wrongful || 0) >= 1) {
      if (!s.flags.stakeWarned) {
        s.flags.stakeWarned = true;
        this.story('The Inquisitor Asks for Your Name', 'The Inquisitor has asked the Rolls for your name.', 'danger');
        return;
      }
      if (this.rng() < 0.15) { this.gameOver('stake'); return; }
    }
  };

  // ---- The Order of the Mountain ---------------------------------------------------
  P.mountainWeek = function () {
    var s = this.s, lines = [];
    if (s.calling !== 'commissioner' || s.rank < Soc.MOUNTAIN.rank || s.week < Soc.MOUNTAIN.week) return lines;
    if (s.flags.mountainPaidUntil && s.week <= s.flags.mountainPaidUntil) return lines;
    if (this.cardsOf('dagger', true).length || this.rng() >= Soc.MOUNTAIN.chance) return lines;
    this.create('dagger', {
      label: 'A Dagger on the Pillow',
      desc: 'You wake and it is there, on the pillow beside your head, and the door is still barred. The Order of the Mountain does not ask for anything. It warns once. Bring it to Rest with two Coin to buy six weeks, or alone to endure it; or Attend it with a watchman to double the guard. Let it lie and they come back.',
      data: { week: s.week },
    });
    lines.push('There was a dagger on your pillow this morning. The door was barred. Somebody wants you to know what they can do.');
    return lines;
  };
  // The warning ignored. The first time they come for blood, not a life, and
  // say so; only a dagger ignored after that may be the end (warned, then ended).
  P.mountainStrikes = function () {
    var s = this.s;
    if (s.flags.mountainIgnored && this.rng() < 0.5) { this.gameOver('dagger'); return; }
    var first = !s.flags.mountainIgnored;
    s.flags.mountainIgnored = true;
    this.hurtYou('A man in a servant\'s coat on the Watch-house stair, a blade under the ribs, and gone before anyone shouts. The Order of the Mountain keeps its word.');
    this.meter('dread', 1);
    if (first && !s.over) this.story('They Came Anyway', 'The Order of the Mountain kept its word, and let you live to hear it. The next time they will not leave a dagger.', 'danger');
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
  // A torso, and once it is a week old, a second from the same door. Never a third.
  P.eumenidesWeek = function () {
    var s = this.s, lines = [];
    if (s.calling !== 'master' || s.week < Soc.EUMENIDES.week || s.flags.eumenidesBroken) return lines;
    if ((s.flags.eumenidesTorsos || 0) >= 2 || this.openCases().length >= this.maxOpenCases()) return lines;
    var open = this.openCases().filter(function (r) { return r.society === 'eumenides'; });
    var second = open.length === 1 || (s.flags.eumenidesTorsos || 0) === 1;
    if (open.length === 1 && open[0].week >= s.week) return lines;
    if (this.rng() >= (second ? 0.5 : Soc.EUMENIDES.chance)) return lines;
    var front = this.eumenidesFront();
    var card = this.spawnCase('harbor', { quiet: true, frontId: front.id });
    var rec = this.caseRec(card.caseId);
    rec.society = 'eumenides';
    s.flags.eumenidesTorsos = (s.flags.eumenidesTorsos || 0) + 1;
    if (second) {
      card.desc += ' Another torso, the same ring-mark, and a chit in its pocket from the same door.';
      this.story('Another Torso', 'Another torso, the same ring-mark. The Harbour has given up two in a season now, and the second has a chit in its pocket from the same door.', 'case');
    } else {
      card.desc += ' Another torso. The Harbour has given up one a season for years, and every case closes on some sailor. This one has a patrician\'s ring-mark on its finger.';
      this.story('A Torso at the Harbour', 'The Harbour has given up another one: a body without a head or hands, wrapped like a parcel, with a ring-mark on one finger that no sailor ever wore. The last three closed on sailors. Find what this one has in common with the next.', 'case');
    }
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
