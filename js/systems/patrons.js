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
    this.sealCheck();
    return f[who];
  };

  // ---- Seals: a patron's favour you can call in -------------------------------
  // The first time a patron's Favour reaches SEAL_AT they send their seal:
  // one card, put in Attend to call the favour in once (Pat.SEAL says what
  // it does), at the cost of SEAL_COST Favour. A seal is sent again only
  // after the Favour has fallen below SEAL_AT and climbed back.
  //   s.seals = { council: true }   a seal sent at this height (false or absent: sent at the next climb)
  Pat.SEAL_AT = 3;
  Pat.SEAL_COST = 2;
  Pat.SEAL = {
    council: { label: 'The Council\'s Seal', gives: 'Suspicion -2',
      desc: 'Your patron on the Council will lose a leaf of the clerks\' list for you, once. Put it in Attend to call it in. It costs the Council\'s favour 2.' },
    bishop: { label: 'The Bishop\'s Seal', gives: 'The Inquisitor recalled, or a bed in the Abbey hospital',
      desc: 'The Bishop will do you one kindness: recall the Inquisitor, or keep a bed for you in the Abbey hospital. Put it in Attend to call it in. It costs the Bishop\'s favour 2.' },
    guild: { label: 'The Guilds\' Seal', gives: '3 Coin',
      desc: 'The wardens will open the guild chest for you, once: three Coin. Put it in Attend to call it in. It costs the Guilds\' favour 2.' },
  };
  Pat.SENT = {
    council: 'A clerk brings a fold of paper with the Council\'s seal on it, and nothing written inside. You know what it means: one favour, when you need it.',
    bishop: 'The Bishop\'s chaplain leaves a seal on your desk, the Abbey\'s keys in red wax. One kindness, when you need it.',
    guild: 'The Market Warden sends the guilds\' seal round with a boy. One favour from the chest, when you need it.',
  };
  P.sealCheck = function () {
    var s = this.s, f = this.favour(), self = this;
    if (!s.seals || typeof s.seals !== 'object') s.seals = {};
    if (s.over || !CF.CARDS.seal) return;
    ['council', 'bishop', 'guild'].forEach(function (k) {
      if ((f[k] || 0) < Pat.SEAL_AT) { s.seals[k] = false; return; }
      if (s.seals[k]) return;
      s.seals[k] = true;
      if (self.cardsOf('seal', true).some(function (c) { return c.data && c.data.patron === k; })) return;
      self.create('seal', { label: Pat.SEAL[k].label, desc: Pat.SEAL[k].desc, data: { patron: k } });
      self.story(Pat.SEAL[k].label, Pat.SENT[k], 'major');
    });
  };
  // Call the favour in (the Attend recipe): what it gave, as story text.
  P.callInSeal = function (card) {
    var s = this.s, k = card.data && card.data.patron, text;
    if (!Pat.SEAL[k]) return null;
    if (k === 'council') {
      this.meter('scrutiny', -2);
      text = 'Your patron on the Council has a quiet word with the clerks. Two leaves of their list go into the fire. Suspicion -2.';
    } else if (k === 'bishop') {
      if (s.flags.inquisitor) {
        s.flags.inquisitor = false;
        text = 'The Bishop writes to the Provincial. By the end of the week the Inquisitor has packed his books and gone back over the river.';
      } else {
        var lifted = 0, self = this;
        this.cardsOf('fatigue').concat(this.cardsOf('sickness'), this.cardsOf('hunger')).forEach(function (c) { self.remove(c); lifted++; });
        this.meter('dread', -1);
        text = lifted ? 'Three nights in the Abbey hospital: clean linen, broth, and the brothers\' bell for a clock. You come out rested and fed. Dread -1.' :
          'You hear Mass from the Bishop\'s own pew, and the city sees you there. Dread -1.';
      }
    } else {
      for (var i = 0; i < 3; i++) this.create('funds');
      text = 'The wardens open the guild chest, count three Coin into your hand, and write it in a book you will never see.';
    }
    this.favourGain(k, -Pat.SEAL_COST);
    return text;
  };
  // The three patrons' standing for the Standing meter's popover: the
  // Favour, a word for it, and the next step each way (null when there is
  // none). `seal`: their seal is on the table now.
  Pat.WORDS = [[-2, 'Cold'], [-1, 'Cool'], [0, 'Neutral'], [2, 'Warm'], [5, 'Your patron']];
  Pat.STEPS = {
    council: { up: 'At 3: Suspicion eases each week, and the Council\'s Seal.', down: 'At -2: the Council holds your next office.' },
    bishop: { up: 'At 3: a bed in the Abbey hospital each week, and the Bishop\'s Seal.', down: 'At -2: the Inquisitor comes.' },
    guild: { up: 'At 3: the guilds\' fee now and then, and the Guilds\' Seal.', down: null },
  };
  P.favourSteps = function () {
    var f = this.favour(), self = this;
    return ['council', 'bishop', 'guild'].map(function (k) {
      var n = f[k] || 0, word = 'Your patron';
      for (var i = 0; i < Pat.WORDS.length; i++) if (n <= Pat.WORDS[i][0]) { word = Pat.WORDS[i][1]; break; }
      return { key: k, label: CF.PATRONS[k].label, icon: CF.PATRONS[k].icon, n: n, word: word,
        up: n < Pat.SEAL_AT ? Pat.STEPS[k].up : null, down: n > -2 ? Pat.STEPS[k].down : null,
        seal: self.cardsOf('seal', true).some(function (c) { return c.data && c.data.patron === k; }) };
    });
  };

  // Which patron, if any, commissions a freshly spawned case.
  // While the Seat waits on a power's seal, that power sends work twice as
  // often, and sends it whenever the crime is of its kind.
  P.commissionFor = function (rec, T) {
    var want = this.cardsOf('chair', true).length && this.seatPledges ? this.seatPledges() : null;
    if (T.special || this.rng() >= Pat.CHANCE * (want && !want.all ? 2 : 1)) return null;
    var pool = ['council'];
    if (Pat.KIND.guild.indexOf(rec.template) >= 0) pool.push('guild');
    if (Pat.KIND.bishop.indexOf(rec.template) >= 0) pool.push('bishop');
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
  // What the Bishop and the Guilds ask of the sentence, as rungs of the ladder.
  Pat.WISH = { bishop: ['pardon', 'fine'], guild: ['pillory', 'fine'] };
  // The line the Condemned card carries: who asked, and what.
  // Only the rungs the ladder holds are asked for.
  Pat.ASKS = {
    bishop: { both: 'The Bishop asks: a Pardon or a Fine.', pardon: 'The Bishop asks: a Pardon.', fine: 'The Bishop asks: a Fine.' },
    guild: { both: 'The Guilds ask: the Pillory or a Fine.', pillory: 'The Guilds ask: the Pillory.', fine: 'The Guilds ask: a Fine.' },
  };
  Pat.asksLine = function (from, wish) {
    var A = Pat.ASKS[from];
    if (!A || !wish || !wish.length) return '';
    return wish.length > 1 ? A.both : A[wish[0]] || '';
  };
  // What a commission comes to when nobody stands trial (gone cold, settled, taken by the Rival).
  Pat.LOST = {
    council: 'The Council wanted {title} answered. It went into the Rolls unanswered, and the Council\'s favour with it.',
    bishop: 'The Bishop asked mercy for whoever did {title}. Nobody stood before the Court to receive it, and the Bishop\'s favour cools.',
    guild: 'The Guilds wanted {title} answered in the square. Nobody stood there, and the wardens\' favour cools.',
  };
  // A week's favour moved, for the Bell's ledger.
  Pat.MOVED = {
    council: ['The Council\'s favour rises.', 'The Council\'s favour falls.'],
    bishop: ['The Bishop\'s favour rises.', 'The Bishop\'s favour falls.'],
    guild: ['The Guilds\' favour rises.', 'The Guilds\' favour falls.'],
  };
  P.favourMoved = function (before) {
    var f = this.favour(), out = [];
    if (!before) return out;
    ['council', 'bishop', 'guild'].forEach(function (k) {
      var d = (f[k] || 0) - (before[k] || 0);
      if (d) out.push(Pat.MOVED[k][d > 0 ? 0 : 1]);
    });
    return out;
  };

  P.commissionVerdict = function (rec, d, convicted, notes) {
    var c = rec.commission;
    if (!c) return;
    if (c.from !== 'council') {
      // The Bishop and the Guilds wait for the sentence; an acquittal gives them nothing to judge.
      if (!convicted && !c.delivered) {
        c.delivered = 'acquitted';
        notes.push(c.from === 'bishop' ? 'The Bishop asked mercy for a penitent; the sworn men gave a walk instead, and the Bishop has nothing to say.' : 'The Guilds wanted a brother shamed; he walked.');
      }
      return;
    }
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
  // The kinds of crime the Bishop and the Guilds care for (as commissionFor sends them).
  Pat.KIND = { guild: ['burglary', 'fraud', 'coining', 'extortion', 'weights'], bishop: ['harbor', 'missing', 'poison', 'arson', 'burglary', 'searchers', 'gloryhand'] };
  P.commissionSentence = function (rec, rung, notes) {
    var c = rec && rec.commission;
    // Unasked, a sentence of their kind of crime as they would wish it warms a cold or neutral
    // Bishop or Guilds to 1 (no further): a patron is won in the square as well as by commission.
    if (rec && (!c || c.from === 'council')) {
      var f = this.favour(), self = this;
      ['guild', 'bishop'].forEach(function (k) {
        if ((f[k] || 0) >= 1 || Pat.KIND[k].indexOf(rec.template) < 0 || Pat.WISH[k].indexOf(rung) < 0) return;
        self.favourGain(k, 1);
        notes.push(k === 'guild' ? 'The wardens hear of it in the square, and the Guilds\' favour warms.' : 'The Bishop hears of the mercy, and his chaplain says so where the Council can hear it.');
      });
    }
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
      else { notes.push('Not the rope, and not mercy. The Bishop says nothing.'); c.delivered = 'half'; }
    } else if (c.from === 'guild') {
      if (square) { this.favourGain('guild', 1); this.create('funds'); notes.push('The wardens send a fee, and their thanks.'); c.delivered = 'desired'; }
      else if (death) { this.favourGain('guild', -1); s.flags.marketQuietUntil = s.week + 1; notes.push('The guild wanted a brother shamed, not hanged. The Market goes quiet for a week.'); c.delivered = 'truth'; }
      else { notes.push('Not the square, and not the rope. The wardens say nothing.'); c.delivered = 'half'; }
    }
  };
  // A commission nobody answered (cold, settled, closed by the Rival): favour -1, and a word of it.
  P.commissionCold = function (rec) {
    var c = rec && rec.commission;
    if (!c || c.delivered) return;
    c.delivered = 'lost';
    this.favourGain(c.from, -1);
    if (Pat.LOST[c.from]) this.story('A Patron Displeased', U.fill(Pat.LOST[c.from], { title: rec.title }), 'minor');
  };

  // ---- Favour, every week ------------------------------------------------------
  P.patronsWeek = function () {
    var s = this.s, f = this.favour(), lines = [];
    this.sealCheck(); // favour moved by a choice or a beat this week
    if (f.council >= 3 && s.meters.scrutiny > 0) { this.meter('scrutiny', -1); lines.push('A word from your patron on the Council, and a leaf of the clerks\' list is lost.'); }
    if ((f.bishop >= 3 || (this.endowedWith && this.endowedWith('abbey'))) && this.countOf('fatigue')) { this.remove(this.cardsOf('fatigue')[0]); lines.push('The Abbey hospital keeps a bed for you. You sleep a night in it.'); }
    if (f.guild >= 3 && this.rng() < 0.5) { this.create('funds'); lines.push('The Market Warden sends the guilds\' fee for a quiet Market.'); }
    // The letter of office the Council is not writing.
    if (this.promotionHeld && this.promotionHeld() && s.rank < (this.rankCap ? this.rankCap() : CF.TOP_RANK) && s.meters.reputation >= CF.RANK_REP[s.rank + 1] && !this.cardsWith('promotion').length) {
      lines.push('You have the Standing for a new office. The letter does not come; the Council is displeased.');
    }
    // Elections: every twelve weeks the Council may turn, and Favour becomes Suspicion.
    // Answered the week before (The Council Elects), the count follows the answer.
    // Told whichever way it goes, once the city knows you.
    var el = s.flags.election;
    if (el && s.week >= el.week) {
      s.flags.election = null;
      lines = lines.concat(this.electionCount(el.stance, el.holds));
    } else if (s.week % Pat.ELECTION_EVERY === 0 && f.council > 0 && this.rng() < (s.flags.canvassed === s.week ? Pat.CANVASSED_LOSS : 0.4)) {
      this.meter('scrutiny', f.council);
      lines.push('The Council election goes against your patron. Every favour he did you is read aloud by the men who beat him, and the clerks write each one down.');
      f.council = 0;
    } else if (s.week % Pat.ELECTION_EVERY === 0 && f.council > 0) {
      lines.push('The Council elects. Your patron keeps his seat by four votes, and sends round a haunch of venison to say he noticed who was at his door.');
    } else if (s.week % Pat.ELECTION_EVERY === 0 && s.flags.firstCase) {
      lines.push('The Council elects. New faces on the bench, old money behind them. Nobody asks after the Examiner either way.');
    }
    // The Inquisitor arrives when the Bishop's Favour is low.
    if (f.bishop <= -2 && !s.flags.inquisitor) { s.flags.inquisitor = true; lines.push('A Dominican, white habit under a black cloak, has taken rooms at the Abbey and asked for the Rolls. The Bishop sent for him. He is called the Inquisitor, and he does not answer to you.'); }
    if (f.bishop >= 0 && s.flags.inquisitor) { s.flags.inquisitor = false; lines.push('The Inquisitor has been recalled. The Bishop is satisfied, for now.'); }
    // The week before an election, the seat your patron holds is in play: told,
    // and asked (The Council Elects) when he is your patron in earnest (favour 2
    // or more) and no other question waits. At favour 1 the count is only told.
    if (s.week % Pat.ELECTION_EVERY === Pat.ELECTION_EVERY - 1 && f.council > 0) {
      lines.push('The Council elects next week. Your patron\'s seat is contested.');
      if (f.council >= 2) this.offerElection();
      else this.offerLate('canvass');
    }
    if (s.flags.canvassed && s.flags.canvassed < s.week) s.flags.canvassed = null;
    // A wrong name surfaced: his mother comes to the Watch-house door, once a run.
    var wm = this.wrongMother();
    if (wm) this.offerLate('wrongmother', { criminalId: wm.id }, { case: wm.wrongfulTitle || 'an old case' }, wm.wrongSex === 'f' ? Pat.WRONG_DAUGHTER : null);
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

  // ---- The Council elects ------------------------------------------------------
  // The week before an election, with a patron on the Council (favour 2 or
  // more: at 1 there is too little at stake to ask), the city asks how you stand. The count is the next week, at the Bell,
  // and told: your patron holds his seat six times in ten.
  //   s.flags.election = { stance: 'stand'|'distance'|'dine', week, holds }   answered, told at `week`
  Pat.HOLDS = 0.6;
  Pat.ELECTION = { id: 'election', when: function () { return false; },
    title: 'The Council Elects', text: 'Your patron\'s seat is contested. The other side has been counting the favours he did you.',
    options: [
      { label: 'Stand with him openly', cost: 'funds', gain: 'If he holds the seat, Council favour +2; if not, Suspicion for every favour',
        text: 'You dine at his table the night before the count, where the chamber can see you.',
        effect: function (e) { e.electionStance('stand'); } },
      { label: 'Keep your distance', gain: 'Favour halves; no Suspicion either way',
        text: 'You are busy at the Watch-house all week, and say so to anyone who asks.',
        effect: function (e) { var f = e.favour(); f.council = Math.floor((f.council || 0) / 2); e.electionStance('distance'); } },
      { label: 'Dine with the other side', cost: 'focus', gain: 'Council favour +1 under the new man; Bishop -1',
        text: 'The other side keeps a good table, and the Bishop\'s chaplain hears whose.',
        effect: function (e) { e.favourGain('bishop', -1); e.electionStance('dine'); } },
    ] };
  Pat.register = function () {
    if (!CF.CHOICES) return false;
    if (!CF.CHOICES.some(function (c) { return c.id === Pat.ELECTION.id; })) CF.CHOICES.push(Pat.ELECTION);
    Pat.LATE.forEach(function (spec) { if (!CF.CHOICES.some(function (c) { return c.id === spec.id; })) CF.CHOICES.push(spec); });
    // The questions a verb invites are put again ten weeks on, in other words (life.js keeps them).
    CF.CHOICES.forEach(function (c) { if (Pat.AGAIN[c.id] && !c.again) c.again = Pat.AGAIN[c.id]; });
    return true;
  };

  // ---- The late questions --------------------------------------------------------
  // The powers you live with put questions of their own: the Harbourmaster's
  // examiner at supper, the mother of a wrong name, the King's wine under the
  // Treaty, the Inquisitor's list, a canvass before the count, the hangman's
  // daughter. Each has a free answer and a return you can see. The clock asks
  // the ones whose `when` holds; the Bell asks the canvass and the mother.
  function rivalOf(e) { return e.cardsOf('rival', true)[0] || null; }
  function unsolved(e) { return e.openCases().filter(function (r) { return !r.identified && !r.special; })[0] || null; }
  Pat.CANVASSED_LOSS = 0.2;
  Pat.AGAIN = {
    lamplighter: 'The tiler is up a different ladder on a different lane, and has seen a different face. He remembers your coin.',
    pawnbroker: 'The pawnbroker\'s book again, and a fatter week in it.',
    confessor: 'The same priest, a different penitent, and the same look at a door.',
    tapster: 'The Swan\'s window was mended once this year already. Tonight it goes again.',
  };
  Pat.LATE = [
    { id: 'harbourtable', when: function (e) { var r = rivalOf(e); return !!r && !(r.data && r.data.stalled >= e.s.week); },
      title: 'The Harbourmaster\'s Table', text: 'The Harbourmaster asks both his examiner and you to supper, to see which of you eats with the better manners.',
      options: [
        { label: 'Go, and listen', cost: 'focus', gain: 'A thread on the Rival', text: 'You eat little and listen much. Between the fish and the fowl the examiner names a moneylender, and wishes they had not.',
          effect: function (e) { var r = rivalOf(e); if (r && e.rivalThread) e.rivalThread(r, 'question'); } },
        { label: 'Go, and pour', cost: 'funds', gain: 'The Rival loses a week', text: 'You keep the examiner\'s cup full. They are carried home at midnight and do no work for a week.',
          effect: function (e) { var r = rivalOf(e); if (r) { r.data = r.data || {}; r.data.stalled = Math.max(r.data.stalled || 0, e.s.week + 1); } } },
        { label: 'Send regrets', gain: 'Standing rises', text: 'The Harbourmaster dines with his examiner alone. The Council hears that you were working.',
          effect: function (e) { e.meter('reputation', 1); } },
      ] },
    // Asked by the Bell (offerLate), the text filled with the wrong name's case.
    { id: 'wrongmother', when: function () { return false; },
      title: 'The Mother of the Wrong Name', text: 'A woman in black waits at the Watch-house door. Her son answered for {case}. The ballad says he did not do it. She wants to hear you say so.',
      options: [
        { label: 'Say it, on the steps', gain: 'Mercy; the Crowd eases; Standing falls', text: 'You say it where the Market can hear. She weeps. The Council reads it in the broadsheets the next morning.',
          effect: function (e) { e.count('mercy'); e.meter('pressure', -1); e.meter('reputation', -1); } },
        { label: 'Give her what Coin you have', cost: 'funds', gain: 'Mercy; Dread eases', text: 'She takes it without a word and goes. The Warrens hear what you gave, and not what you said.',
          effect: function (e) { e.count('mercy'); e.meter('dread', -1); } },
        { label: 'Shut the door', gain: 'The Council\'s favour; Dread rises', text: 'The sergeant shuts the door. She is still on the step at the Bell.',
          effect: function (e) { e.favourGain('council', 1); e.meter('dread', 1); } },
      ] },
    { id: 'kingswine', when: function (e) { return !!(e.s.court && e.s.court.stance === 'treaty') && !!unsolved(e); },
      title: 'The King\'s Wine', text: 'A cask with the King\'s compliments, and folded under the bung, a name: a fence the Court is tired of.',
      options: [
        { label: 'Take the name', gain: 'A token that names a name; Purse', text: 'The fence talks by morning, about everything he ever bought. The Court sends its thanks, and the Market notes whose thanks.',
          effect: function (e) {
            var rec = unsolved(e);
            e.count('purse');
            if (rec) e.create('clue', e.clueSpec(rec, { label: 'The King\'s Name', text: 'Folded under the bung of the King\'s cask: a fence, and what he bought, and from whom.', aspects: { testimony: 1, financial: 1 } }, [], { points: rec.culprit }));
          } },
        { label: 'Send the cask back', gain: 'Suspicion eases; Vendetta', text: 'The cask goes back down the Warrens unopened. The Council hears of it, and so does the King.',
          effect: function (e) { e.meter('scrutiny', -1); e.meter('retaliation', 1); } },
      ] },
    { id: 'inquisitorlist', when: function (e) { return !!e.s.flags.inquisitor; },
      title: 'The Inquisitor\'s Question', text: 'The Inquisitor asks, very courteously, for the Examiner\'s list of the city\'s heretics. He is sure you keep one.',
      options: [
        { label: 'Give him a name from the Rolls', cost: 'coldcase', gain: 'The Bishop\'s favour +2; Cruelty', text: 'An unanswered case, and a name in it. On Friday somebody burns for it, and the Bishop preaches on the Examiner\'s zeal.',
          effect: function (e) { e.favourGain('bishop', 2); e.count('cruelty'); } },
        { label: 'Give him nothing', cost: 'health', gain: 'Mercy; the Bishop frowns', text: 'He asks again, and again, for an afternoon. You give him nothing, and it tires you more than a day on the Ward.',
          effect: function (e) { e.count('mercy'); e.favourGain('bishop', -1); } },
        { label: 'Plead the Council\'s business', gain: 'Suspicion rises', text: 'You plead the Council\'s business and leave him in the passage. He writes your name in a small book.',
          effect: function (e) { e.meter('scrutiny', 1); } },
      ] },
    // Asked by the Bell the week before the count, when your patron is only a patron (Council favour 1).
    { id: 'canvass', when: function () { return false; },
      title: 'Canvassing on the Hill', text: 'Your patron\'s seat is contested. His man asks whether the Examiner might be seen at his door this week.',
      options: [
        { label: 'Be seen', cost: 'focus', gain: 'His seat is safer', text: 'You are seen at his door, and at his table, and at Mass in his pew. The other side counts you among his votes.',
          effect: function (e) { e.s.flags.canvassed = e.s.week + 1; } },
        { label: 'Stay out of it', gain: 'Standing rises', text: 'You stay at the Watch-house, where the city can see you working.',
          effect: function (e) { e.meter('reputation', 1); } },
      ] },
    { id: 'hangmansdaughter', when: function (e) { return (e.s.counts.cruelty || 0) >= 3 || e.s.who === 'hangman'; },
      title: 'The Executioner\'s Daughter', text: 'The executioner\'s daughter is to marry a glover\'s son, and the glovers will not have hangman\'s blood in the guild. Her father asks you to stand witness at the church door.',
      options: [
        { label: 'Stand witness', cost: 'health', gain: 'Mercy; Dread eases; the Guilds frown', text: 'You stand at the church door in your gown while the glovers stare. The marriage holds.',
          effect: function (e) { e.count('mercy'); e.meter('dread', -1); e.favourGain('guild', -1); } },
        { label: 'Decline', gain: 'The Council\'s favour; Dread rises', text: 'You send a clerk with your regrets. The glovers are grateful, and the Council likes an examiner who knows his company.',
          effect: function (e) { e.favourGain('council', 1); e.meter('dread', 1); } },
      ] },
  ];
  // The mother's words when the wrong name was her daughter.
  Pat.WRONG_DAUGHTER = 'A woman in black waits at the Watch-house door. Her daughter answered for {case}. The ballad says she did not do it. She wants to hear you say so.';
  // Put a late question now, if it can be: none waiting, the game running, asked
  // once a run (by the city's record of its questions). `vars` fill its text
  // (or `text`, other words for it).
  P.offerLate = function (id, ctx, vars, text) {
    var s = this.s;
    if (s.choice || s.over || !this.offerChoice || !Pat.register()) return false;
    if ((s.choicesSeen || {})[id] !== undefined) return false;
    var spec = Pat.LATE.filter(function (c) { return c.id === id; })[0];
    if (!spec) return false;
    if (vars || text) { var sp = U.clone(spec); sp.options = spec.options; sp.text = U.fill(text || spec.text, vars || {}); spec = sp; }
    this.offerChoice(spec, ctx || null);
    return true;
  };
  // A wrong name surfaced, whose mother has not yet come: the record, or null.
  P.wrongMother = function () {
    var cs = this.s.criminals || {};
    if ((this.s.choicesSeen || {}).wrongmother !== undefined) return null;
    for (var k in cs) if (!cs[k].hidden && cs[k].wrongfulTitle) return cs[k];
    return null;
  };
  // Put the question, if it can be put now. Returns true when asked.
  P.offerElection = function () {
    var s = this.s;
    if (s.choice || s.over || !this.offerChoice || !Pat.register()) return false;
    this.offerChoice(Pat.ELECTION, null);
    return true;
  };
  // The answer, and the count it waits on: the votes are already promised
  // when the seat is contested, and read out at the next Bell.
  P.electionStance = function (stance) {
    var s = this.s;
    s.flags.election = { stance: stance, week: s.week + 1, holds: this.rng() < Pat.HOLDS };
    this.dirty = true;
  };
  // The count in the chamber, as the answer left it: the Bell's lines.
  P.electionCount = function (stance, held) {
    var s = this.s, f = this.favour(), lines = [];
    var holds = typeof held === 'boolean' ? held : this.rng() < Pat.HOLDS;
    lines.push(holds ? 'The Count in the Chamber: your patron holds.' : 'The Count in the Chamber: your patron loses.');
    if (stance === 'stand') {
      if (holds) { this.favourGain('council', 2); lines.push('He remembers who stood with him. Council favour +2.'); }
      else {
        var owed = Math.max(0, f.council || 0);
        f.council = 0;
        if (owed) { this.meter('scrutiny', owed); lines.push(U.fill('Every favour he did you is read aloud by the men who beat him. Suspicion +{n}.', { n: owed })); }
        else lines.push('The new men have nothing against you, and nothing for you.');
      }
    } else if (stance === 'distance') {
      if (!holds) f.council = 0;
      lines.push(holds ? 'He keeps his seat, and notes that you kept your distance.' : 'The new men have nothing against you, and nothing for you.');
    } else {
      if (holds) { f.council = Math.floor((f.council || 0) / 2); lines.push('He keeps his seat, and has heard where you dined. Council favour halves.'); }
      else { f.council = 1; lines.push('The new man remembers your face from his table. Council favour +1.'); }
    }
    this.sealCheck();
    this.dirty = true;
    return lines;
  };

  // What the dossier says of a heresy case: when the Inquisitor could take
  // it, or that the Bishop keeps the Dominicans off it. The same gate as
  // patronsWeek: asked after only while the Inquisitor is here or the
  // Bishop not in favour, and taken a week after the asking at the soonest.
  // null for a case that does not smell of heresy. `line` and `vars` are
  // the words to show (through tr).
  P.heresyWatch = function (rec) {
    var T = rec && CF.CASE_TEMPLATES[rec.template];
    if (!T || !T.heresy || rec.status !== 'open') return null;
    var s = this.s, f = this.favour();
    if (!s.flags.inquisitor && f.bishop > 0) return { kept: true, line: 'The Bishop has kept the Dominicans off this one.' };
    var from = (rec.week || 0) + 2, n = Math.max(from, s.week + (rec.dominican ? 1 : 2));
    return { kept: false, week: n, asked: !!rec.dominican, line: 'Smells of heresy: the Inquisitor\'s after week {n}', vars: { n: n } };
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
    if (!named.guilty) { s.stats.wrongful++; var cul = rec.suspects.filter(function (x) { return x.guilty; })[0]; var c = this.criminalEscapes(rec, cul, 'wrongful'); if (this.atLargeCardFor(c)) this.refreshAtLarge(c); else this.hideCriminal(c, rec, 'burned', named.alibi, named); }
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
