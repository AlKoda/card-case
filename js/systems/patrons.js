// Patrons (docs/CITY.md §9). Three powers give you work and want
// particular answers. A commission is a case with a desired verdict on
// it; deliver it and the patron's Favour rises, deliver the truth instead
// and it falls. Favour opens doors and shuts them, patrons can fall in an
// election, and the Bishop's displeasure brings the Inquisitor.
//
//   s.favour = { council, bishop, guild }
//   rec.commission = { from, wants, ofCouncil?, deadline?, days? }
//   e.commissionDays(rec)  the Council's days still left on it (null when none)
//     council  wants it quiet: answered quickly, and not against a Council family
//     bishop   wants mercy for the penitent: Pardon or a Fine
//     guild    wants a cheat shamed, a brother fined, not hanged: the Pillory or a Fine
(function (G) {
  var CF = G.CF;
  var U = CF.util;
  var P = CF.Engine.prototype;

  var Pat = (CF.Patrons = {});
  Pat.CHANCE = 0.25;
  Pat.ELECTION_EVERY = 12;
  CF.PATRONS = {
    council: { label: 'The Council', wants: 'it answered quickly, and no scandal on the Hill', icon: 'gicon-crown' },
    bishop: { label: 'The Bishop', wants: 'mercy for the penitent', icon: 'gicon-cross' },
    guild: { label: 'The Guilds', wants: 'a cheat shamed in the square, a brother fined, not hanged', icon: 'gicon-coins' },
  };

  P.favour = function () {
    var s = this.s;
    if (!s.favour) s.favour = { council: 0, bishop: 0, guild: 0 };
    return s.favour;
  };
  P.favourGain = function (who, n, why) {
    var f = this.favour();
    f[who] = U.clamp((f[who] || 0) + n, -5, 5);
    this.dirty = true;
    return f[who];
  };

  // Which patron, if any, commissions a freshly spawned case.
  // While the Seat waits on a power's seal, that power sends work twice as
  // often, and sends it whenever the crime is of its kind.
  P.commissionFor = function (rec, T) {
    var want = this.cardsOf('chair', true).length && this.seatPledges ? this.seatPledges() : null;
    if (T.special || this.rng() >= Pat.CHANCE * (want && !want.all ? 2 : 1)) return null;
    var pool = ['council'];
    if (['burglary', 'fraud', 'coining', 'extortion'].indexOf(rec.template) >= 0) pool.push('guild');
    if (['harbor', 'missing', 'poison', 'arson', 'burglary'].indexOf(rec.template) >= 0) pool.push('bishop');
    var lacking = want ? pool.filter(function (k) { return !want[k]; }) : [];
    var from = U.pick(this.rng, lacking.length ? lacking : pool);
    var com = { from: from };
    if (from === 'council') {
      // One of the accused is of a Council family. The Council would rather it were not them.
      var innocentish = rec.suspects.filter(function (x) { return true; });
      var pick = U.pick(this.rng, innocentish);
      com.ofCouncil = pick.key;
      com.wants = 'quiet';
      com.deadline = this.s.t + (CF.CASE_TEMPLATES[rec.template].lifetime || 250) * 0.66;
      com.days = CF.daysLeft(com.deadline - this.s.t);
    } else if (from === 'bishop') com.wants = 'mercy';
    else com.wants = 'square';
    return com;
  };
  // How many of the Council's days are left on a commission, for the dossier.
  P.commissionDays = function (rec) {
    var c = rec && rec.commission;
    if (!c || c.from !== 'council' || !c.deadline) return null;
    return CF.daysLeft(c.deadline - this.s.t);
  };
  Pat.describe = function (rec) {
    var c = rec.commission;
    if (!c) return null;
    var who = CF.PATRONS[c.from].label;
    if (c.from === 'council') {
      var sus = rec.suspects.filter(function (x) { return x.key === c.ofCouncil; })[0];
      return U.fill('{who} wants it answered within {days} days, and would take it kindly if {name}, of a Council family, were not the name.',
        { who: who, days: c.days || CF.daysLeft((CF.CASE_TEMPLATES[rec.template].lifetime || 250) * 0.66), name: sus ? sus.name : 'a certain patrician' });
    }
    if (c.from === 'bishop') return who + ' asks mercy for whoever did this, if they repent: a Pardon or a Fine, not the rope.';
    return who + ' want the culprit shamed in the square or fined, and a brother of the guild not hanged.';
  };

  // ---- Delivery ----------------------------------------------------------------
  // At the verdict (the Council), at the sentence (the Bishop, the Guilds).
  P.commissionVerdict = function (rec, d, convicted, notes) {
    var c = rec.commission;
    if (!c) return;
    if (c.from !== 'council') return;
    if (!convicted) { this.favourGain('council', -1); notes.push('The Council wanted this answered. It was not.'); return; }
    var charged = rec.suspects.filter(function (x) { return x.name === d.name; })[0];
    if (charged && charged.key === c.ofCouncil) {
      this.favourGain('council', -1);
      this.meter('reputation', -1);
      this.pathGain('crusader', 2, 'convicted a Council family');
      notes.push('A Council family in the dock. The Hill will not forgive it, and the Stews will not forget it.');
      rec.commission.delivered = 'truth';
      return;
    }
    if (this.s.t <= (c.deadline || Infinity)) {
      this.favourGain('council', 1);
      this.create('funds'); this.create('funds');
      notes.push('Quick, and quiet, and the right name for the Council: its thanks come with two Coin.');
      rec.commission.delivered = 'desired';
      if (!d.guilty) { this.s.stats.protected = (this.s.stats.protected || 0) + 1; notes.push('The Council carries the Suspicion for this one, as long as it stands.'); this.meter('scrutiny', -1); }
    } else notes.push('The Council wanted it quicker.');
  };
  P.commissionSentence = function (rec, rung, notes) {
    var c = rec && rec.commission;
    if (!c || c.from === 'council') return;
    var s = this.s;
    var mercy = rung === 'pardon' || rung === 'fine';
    var square = rung === 'pillory' || rung === 'fine';
    var death = CF.Sentence.DEATH.indexOf(rung) >= 0 || rung === 'brand';
    if (c.from === 'bishop') {
      if (mercy) {
        this.favourGain('bishop', 1);
        var key = 'absolved' + s.rank;
        if (!s.flags[key] && (s.counts.cruelty || 0) > 0) { s.flags[key] = true; this.count('cruelty', -1); notes.push('The Bishop absolves you of one thing you did in the Hole.'); }
        else notes.push('The Bishop is pleased.');
        c.delivered = 'desired';
      } else if (death) { this.favourGain('bishop', -1); notes.push('The Bishop asked for mercy and was refused. His chaplain will not come to the Watch-house for a while.'); c.delivered = 'truth'; }
    } else if (c.from === 'guild') {
      if (square) { this.favourGain('guild', 1); this.create('funds'); notes.push('The wardens send a fee, and their thanks.'); c.delivered = 'desired'; }
      else if (death) { this.favourGain('guild', -1); s.flags.marketQuietUntil = s.week + 1; notes.push('The guild wanted a brother shamed, not hanged. The Market goes quiet for a week.'); c.delivered = 'truth'; }
    }
  };
  P.commissionCold = function (rec) {
    if (rec.commission && !rec.commission.delivered) this.favourGain(rec.commission.from, -1);
  };

  // ---- Favour, every week ------------------------------------------------------
  P.patronsWeek = function () {
    var s = this.s, f = this.favour(), lines = [];
    if (f.council >= 3 && s.meters.scrutiny > 0) { this.meter('scrutiny', -1); lines.push('A word from your patron on the Council, and a leaf of the clerks\' list is lost.'); }
    if (f.bishop >= 3 && this.countOf('fatigue')) { this.remove(this.cardsOf('fatigue')[0]); lines.push('The Abbey hospital keeps a bed for you. You sleep a night in it.'); }
    if (f.guild >= 3 && this.rng() < 0.5) { this.create('funds'); lines.push('The Market Warden sends the guilds\' fee for a quiet Market.'); }
    // The letter of office the Council is not writing.
    if (this.promotionHeld && this.promotionHeld() && s.rank < (this.rankCap ? this.rankCap() : CF.TOP_RANK) && s.meters.reputation >= CF.RANK_REP[s.rank + 1] && !this.cardsWith('promotion').length) {
      lines.push('You have the Standing for a new office. The letter does not come; the Council is displeased.');
    }
    // Elections: every twelve weeks the Council may turn, and Favour becomes Suspicion.
    // Told whichever way it goes, once the city knows you.
    if (s.week % Pat.ELECTION_EVERY === 0 && f.council > 0 && this.rng() < 0.4) {
      this.meter('scrutiny', f.council);
      lines.push('The Council election goes against your patron. Every favour he did you is read aloud by the men who beat him. Suspicion +' + f.council + '.');
      f.council = 0;
    } else if (s.week % Pat.ELECTION_EVERY === 0 && f.council > 0) {
      lines.push('The Council elects. Your patron keeps his seat by four votes, and sends round a haunch of venison to say he noticed who was at his door.');
    } else if (s.week % Pat.ELECTION_EVERY === 0 && s.flags.firstCase) {
      lines.push('The Council elects. New faces on the bench, old money behind them. Nobody asks after the Examiner either way.');
    }
    // The Inquisitor arrives when the Bishop's Favour is low.
    if (f.bishop <= -2 && !s.flags.inquisitor) { s.flags.inquisitor = true; lines.push('A Dominican, white habit under a black cloak, has taken rooms at the Abbey and asked for the Rolls. The Bishop sent for him. He is called the Inquisitor, and he does not answer to you.'); }
    if (f.bishop >= 0 && s.flags.inquisitor) { s.flags.inquisitor = false; lines.push('The Inquisitor has been recalled. The Bishop is satisfied, for now.'); }
    // The week before an election, the seat your patron holds is in play.
    if (s.week % Pat.ELECTION_EVERY === Pat.ELECTION_EVERY - 1 && f.council > 0) lines.push('The Council elects next week. Your patron\'s seat is contested.');
    // A case that smells of heresy is asked after at a week, and taken at two:
    // by the Inquisitor when he is here, else only while the Bishop is cold.
    var self = this;
    this.openCases().forEach(function (rec) {
      var T = CF.CASE_TEMPLATES[rec.template];
      if (!T.heresy) return;
      var age = s.week - (rec.week || 0);
      // Asked after only while the file can be taken: the Inquisitor here, or the Bishop not in favour.
      // The warning comes a week before any seizure.
      if (!rec.dominican) {
        if (age < 1 || !(s.flags.inquisitor || f.bishop <= 0)) return;
        rec.dominican = true;
        self.story('A Dominican at the Rolls', 'A Dominican has asked the Rolls for the file on ' + rec.title + '. He has a week\'s start on you.', 'danger');
        lines.push('A Dominican has asked the Rolls for the file on ' + rec.title + '.');
        return;
      }
      if (age < 2) return;
      if (!s.flags.inquisitor && (f.bishop > 0 || self.rng() < 0.7)) return;
      self.inquisitorSeizes(rec);
      lines.push('The Inquisitor has taken ' + rec.title + ' out of your hands.');
    });
    return lines;
  };

  // The Inquisitor takes a heresy case: somebody burns, and it is rarely the right one.
  P.inquisitorSeizes = function (rec) {
    var s = this.s;
    var card = this.caseCard(rec.id);
    if (card) this.remove(card);
    rec.status = 'inquisitor';
    this.releaseDelegate(rec);
    this.clearCaseCards(rec.id);
    var named = U.pick(this.rng, rec.suspects);
    s.stats.inquisitor = (s.stats.inquisitor || 0) + 1;
    if (!named.guilty) { s.stats.wrongful++; var cul = rec.suspects.filter(function (x) { return x.guilty; })[0]; var c = this.criminalEscapes(rec, cul, 'wrongful'); if (this.atLargeCardFor(c)) this.refreshAtLarge(c); else this.hideCriminal(c, rec, 'burned', named.alibi); }
    this.meter('dread', 2);
    this.meter('pressure', -1);
    this.emit('resolved', this.caseRecord(rec, 'inquisitor', named.name));
    this.story('The Inquisitor: ' + rec.title, 'The Inquisitor found his heretic in two days: ' + named.name + ', who confessed under the question to everything he asked. The Fire on Friday. The Rolls say the case is answered. You were not asked.', 'danger');
  };

  // The Inquisitor takes the Condemned before you can sentence, sometimes.
  P.inquisitorTakes = function (cond) {
    var s = this.s;
    if (!s.flags.inquisitor || this.rng() >= 0.5) return false;
    var name = cond.data.name;
    this.passSentence(cond, 'wheel', null, { quiet: true, byCouncil: true }); // the Inquisitor's cruelty, not yours
    this.meter('dread', 1);
    s.stats.inquisitor = (s.stats.inquisitor || 0) + 1;
    this.story('The Inquisitor: ' + name, 'The Inquisitor takes ' + name + ' out of the Hole before you can speak. The question is applied whether you would or not, a confession is read out, and the Fire follows by the end of the week. He thanks you for your diligence in finding the heretic. You did not know there was one.', 'danger');
    return true;
  };
})(typeof window !== 'undefined' ? window : globalThis);
