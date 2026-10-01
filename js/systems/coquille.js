// The Court of Miracles (docs/CITY.md §8). The Coquille has a court under
// the Warrens and a King of Thunes on a barrel. The game does not ask you
// to pick a stance toward it; it watches what you do:
//
//   Eradicate   the case against the Coquille, as before; raiding the
//               Warrens costs Dread, and the Crusader's ending follows
//   Treaty      parley with the King (Disguise: the Coquille + Wit). The
//               Stews go quiet, the Court hands you a culprit a week and
//               closes two cases a month its own way, tribute comes if you
//               take it; Justice scores nothing while it stands. Twelve
//               quiet weeks end as the Treaty City.
//   Rule        pass the Court's trial (Disguise: the Coquille + Instinct +
//               Coin) and stay inside. Every second week a case arrives
//               already solved; after four weeks inside, with Purse and
//               Cruelty enough, take the throne: the King of Thunes ending.
//
//   s.court = { king: {name, trait, criminalId}, stance: null|'treaty'|'rule', since, inside, insideWeeks, quietWeeks }
(function (G) {
  var CF = G.CF;
  var U = CF.util;
  var P = CF.Engine.prototype;

  var Coq = (CF.Coquille = {});
  Coq.TREATY_WEEKS = 12;
  Coq.THRONE = { weeks: 4, purse: 4, cruelty: 2 };

  // Coquille roles: the cant name for what a criminal's crimes show.
  CF.COQUILLE_ROLES = {
    burglary: { role: 'Crocheteur', desc: 'a lock-picker: in and out without a mark' },
    fraud: { role: 'Beffleur', desc: 'a decoy: lures the trusting into rigged games' },
    coining: { role: 'Planteur', desc: 'a passer of false coin' },
    extortion: { role: 'Desrocheur', desc: 'a stripper: takes everything, down to the shoes' },
    harbor: { role: 'Envoyeur', desc: 'a sender: murder for hire, a clean wound' },
    missing: { role: 'Envoyeur', desc: 'a sender: people who are not seen again' },
    poison: { role: 'Blanc coulon', desc: 'a sleeper: the drugged cup in the inn dormitory' },
    arson: { role: 'Espieur', desc: 'a scout: watches, marks, and sometimes burns' },
  };
  Coq.roleOf = function (c) {
    var t = c && c.role || (c && c.history && c.history.length ? c.history[0].template : null);
    return t && CF.COQUILLE_ROLES[t] ? CF.COQUILLE_ROLES[t] : null;
  };

  P.court = function () {
    var s = this.s;
    if (!s.court) s.court = { king: null, stance: null, since: 0, inside: false, insideWeeks: 0, quietWeeks: 0, handed: 0 };
    return s.court;
  };

  // When the Coquille forms, the man abroad with the most crimes is King:
  // never one in the Hole, on the road, or in the ground. He gets a card.
  P.crownKing = function () {
    var s = this.s, court = this.court(), best = null;
    var most = function (list) {
      var top = null;
      list.forEach(function (c) { if (!c.hidden && (!top || c.crimes > top.crimes)) top = c; });
      return top;
    };
    best = most(this.criminalsAtLarge());
    if (!best) {
      var loose = [];
      for (var k in s.criminals) {
        var c = s.criminals[k];
        if (c.status === 'dead' || c.status === 'reformed' || c.status === 'jailed' || c.status === 'banished') continue;
        loose.push(c);
      }
      best = most(loose);
    }
    if (!best) {
      best = { id: 'k' + s.nextUid++, name: this.newName(), trait: U.pick(this.rng, CF.TRAITS).id, crimes: 5, heat: 0, organization: 'syndicate', traits: [], status: 'at_large', history: [] };
      s.criminals[best.id] = best;
    }
    best.organization = 'syndicate';
    best.king = true;
    best.status = 'at_large';
    court.king = { name: best.name, trait: best.trait, criminalId: best.id };
    this.abroadCard(best, 'Crowned King of Thunes under the Warrens.');
    var card = this.cardsOf('syndicate', true)[0];
    if (card) card.desc = 'The bands have sworn to one shell now, and the shell has a king: ' + best.name + ', the King of Thunes, on a barrel in a cellar under the Warrens. The Vendetta surges every week. Go in Disguise: with the ledger, to break it; with Wit, to parley; with Instinct and Coin, to be tried by its court and stay.';
    return best;
  };

  // ---- Treaty --------------------------------------------------------------
  P.makeTreaty = function () {
    var court = this.court();
    court.stance = 'treaty';
    court.since = this.s.week;
    court.quietWeeks = 0;
    court.inside = false;
    this.meter('retaliation', -3);
    this.meter('pressure', -1);
  };
  P.breakTreaty = function (why) {
    var court = this.court();
    if (court.stance !== 'treaty') return;
    court.stance = null;
    this.meter('retaliation', 3);
    this.story('The Treaty Is Broken', why + ' The King of Thunes hears of it before the bell. The quiet in the Stews ends the same night.', 'danger');
  };

  // ---- Rule ----------------------------------------------------------------
  P.enterCourt = function () {
    var court = this.court();
    court.stance = 'rule';
    court.inside = true;
    court.insideWeeks = 0;
    court.since = this.s.week;
  };
  P.canTakeThrone = function () {
    var court = this.court(), cnt = this.s.counts || {};
    return court.inside && court.insideWeeks >= Coq.THRONE.weeks && (cnt.purse || 0) >= Coq.THRONE.purse && (cnt.cruelty || 0) >= Coq.THRONE.cruelty;
  };
  P.throneReason = function () {
    var court = this.court(), cnt = this.s.counts || {}, why = [];
    if (!court.inside) why.push('you are not inside the Court');
    if (court.insideWeeks < Coq.THRONE.weeks) why.push('the Court has known you ' + court.insideWeeks + ' of ' + Coq.THRONE.weeks + ' weeks');
    if ((cnt.purse || 0) < Coq.THRONE.purse) why.push('the Court does not crown the honest (Purse ' + (cnt.purse || 0) + ' of ' + Coq.THRONE.purse + ')');
    if ((cnt.cruelty || 0) < Coq.THRONE.cruelty) why.push('the Court does not fear you (Cruelty ' + (cnt.cruelty || 0) + ' of ' + Coq.THRONE.cruelty + ')');
    return why.join('; ');
  };

  // A case that arrives with its answer: the Court's culprit and the Court's word.
  P.courtHandsOver = function (why) {
    var card = this.spawnCase(U.pick(this.rng, this.casePool()), { quiet: true, headline: 'From the Court: ' });
    var rec = this.caseRec(card.caseId);
    var sc = this.revealSuspect(rec, null, { key: rec.culprit });
    var clue = this.clueSpec(rec, { label: 'The Court\'s Word', text: 'A boy brings a paper with a name on it and no signature. The Court of Miracles has decided this one is not worth protecting.', aspects: { testimony: 3, opportunity: 1 } }, [], { points: rec.culprit, noMisread: true, stake: 'hates', witness: 'the Court' });
    this.create('clue', clue);
    this.story('From the Court: ' + rec.title, why + ' ' + (sc ? sc.label : rec.suspects.filter(function (x) { return x.guilty; })[0].name) + ' is named, and the Court\'s word comes with the name.', 'case');
    return rec;
  };
  // A case the Court closed its own way: no trial, the Court's culprit, sometimes a scapegoat.
  P.closedByCourt = function () {
    var s = this.s;
    var card = this.spawnCase(U.pick(this.rng, this.casePool()), { quiet: true });
    var rec = this.caseRec(card.caseId);
    var scapegoat = this.rng() < 0.3;
    var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
    var named = scapegoat ? rec.suspects.filter(function (x) { return !x.guilty; })[0] : culprit;
    rec.status = 'court';
    this.remove(card);
    this.clearCaseCards(rec.id);
    s.stats.byCourt = (s.stats.byCourt || 0) + 1;
    if (scapegoat) s.stats.scapegoats = (s.stats.scapegoats || 0) + 1;
    this.emit('resolved', this.caseRecord(rec, 'court', named.name));
    this.story('Closed by the Court: ' + rec.title, 'The Court of Miracles tried its own. ' + named.name + ' was found in the Warrens ditch at first light with the goods beside them, and the Rolls say the case is answered. ' + (scapegoat ? 'You do not look too closely at the name.' : 'You had nothing to do with it.'), 'minor');
    return rec;
  };

  // ---- Every week ------------------------------------------------------------
  P.coquilleWeek = function () {
    var s = this.s, court = this.court(), lines = [], cnt = s.counts || {};
    if (!this.countOf('syndicate') || s.flags.syndicateFallen) return lines;
    if (court.stance === 'treaty') {
      this.meter('pressure', -1);
      this.meter('retaliation', -1);
      court.quietWeeks = s.meters.pressure <= 3 ? court.quietWeeks + 1 : 0;
      if (this.openCases().length < this.maxOpenCases()) {
        this.courtHandsOver(['The Treaty holds.', 'The King keeps his word.', 'A name comes up from the Warrens, as agreed.'][(s.week - court.since) % 3]);
        court.handed++;
      }
      if ((s.week - court.since) % 2 === 0) this.closedByCourt();
      if (!this.countOf('tribute')) { this.create('tribute'); lines.push('The King\'s tribute waits on the desk: a purse and no note. Attend to it, or let it lie.'); }
      if ((s.week - court.since) % 3 === 0) { this.meter('scrutiny', 1); lines.push('The Bishop preaches on the Examiner who dines with thieves. The Council pretends not to hear.'); }
      lines.push('The Stews are quiet under the Treaty: week ' + court.quietWeeks + ' of ' + Coq.TREATY_WEEKS + '.');
      if (court.quietWeeks >= Coq.TREATY_WEEKS) { this.gameOver('treatycity'); return lines; }
    }
    if (court.stance === 'rule' && court.inside) {
      court.insideWeeks++;
      this.meter('retaliation', -1);
      if (court.insideWeeks % 2 === 0 && this.openCases().length < this.maxOpenCases()) this.courtHandsOver('From inside the Court you feed the Watch-house a name.');
      if (this.rng() < 0.15) { this.meter('scrutiny', 1); lines.push('Somebody on the Council wonders aloud where the Examiner goes at night.'); }
      var insideLine = ['Week {n} inside the Court of Miracles.', 'Week {n} inside. The doorkeeper no longer looks at you twice.', 'Week {n} inside. You know which barrel is the throne.'][court.insideWeeks % 3];
      lines.push(U.fill(insideLine, { n: court.insideWeeks }) + (this.canTakeThrone() ? ' The barrel is within reach.' : ''));
    }
    void cnt;
    return lines;
  };

  // The Coquille broken: the Court scatters, and the stance with it.
  P.coquilleFalls = function () {
    var court = this.court();
    court.stance = null;
    court.inside = false;
    this.meter('dread', 2);
  };
})(typeof window !== 'undefined' ? window : globalThis);
