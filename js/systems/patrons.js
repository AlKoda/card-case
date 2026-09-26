// Patrons (docs/CITY.md §9). Three powers give you work and want
// particular answers. A commission is a case with a desired verdict on
// it; deliver it and the patron's Favour rises, deliver the truth instead
// and it falls. Favour opens doors and shuts them, patrons can fall in an
// election, and the Bishop's displeasure brings the Inquisitor.
//
//   s.favour = { council, bishop, guild }
//   rec.commission = { from, wants, ofCouncil?, deadline? }
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
  P.commissionFor = function (rec, T) {
    if (T.special || this.rng() >= Pat.CHANCE) return null;
    var pool = ['council'];
    if (['burglary', 'fraud', 'coining', 'extortion'].indexOf(rec.template) >= 0) pool.push('guild');
    if (['harbor', 'missing', 'poison', 'arson', 'burglary'].indexOf(rec.template) >= 0) pool.push('bishop');
    var from = U.pick(this.rng, pool);
    var com = { from: from };
    if (from === 'council') {
      // One of the accused is of a Council family. The Council would rather it were not them.
      var innocentish = rec.suspects.filter(function (x) { return true; });
      var pick = U.pick(this.rng, innocentish);
      com.ofCouncil = pick.key;
      com.wants = 'quiet';
      com.deadline = this.s.t + (CF.CASE_TEMPLATES[rec.template].lifetime || 250) * 0.66;
    } else if (from === 'bishop') com.wants = 'mercy';
    else com.wants = 'square';
    return com;
  };
  Pat.describe = function (rec) {
    var c = rec.commission;
    if (!c) return null;
    var who = CF.PATRONS[c.from].label;
    if (c.from === 'council') {
      var sus = rec.suspects.filter(function (x) { return x.key === c.ofCouncil; })[0];
      return who + ' wants it answered by ' + 'the end of the week' + ', and would take it kindly if ' + (sus ? sus.name : 'a certain patrician') + ', of a Council family, were not the name.';
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
    // Elections: every twelve weeks the Council may turn, and Favour becomes Suspicion.
    if (s.week % Pat.ELECTION_EVERY === 0 && f.council > 0 && this.rng() < 0.4) {
      this.meter('scrutiny', f.council);
      lines.push('The Council election goes against your patron. Every favour he did you is read aloud by the men who beat him. Suspicion +' + f.council + '.');
      f.council = 0;
    }
    // The Inquisitor arrives when the Bishop's Favour is low.
    if (f.bishop <= -2 && !s.flags.inquisitor) { s.flags.inquisitor = true; lines.push('A Dominican in a grey cloak has taken rooms at the Abbey and asked for the Rolls. The Bishop sent for him. He is called the Inquisitor, and he does not answer to you.'); }
    if (f.bishop >= 0 && s.flags.inquisitor) { s.flags.inquisitor = false; lines.push('The Inquisitor has been recalled. The Bishop is satisfied, for now.'); }
    return lines;
  };

  // The Inquisitor takes the Condemned before you can sentence, sometimes.
  P.inquisitorTakes = function (cond) {
    var s = this.s;
    if (!s.flags.inquisitor || this.rng() >= 0.5) return false;
    var name = cond.data.name;
    this.passSentence(cond, 'wheel', null, { quiet: true, byCouncil: true });
    this.count('cruelty', -2); // the Inquisitor's, not yours
    this.meter('dread', 1);
    s.stats.inquisitor = (s.stats.inquisitor || 0) + 1;
    this.story('The Inquisitor: ' + name, 'The Inquisitor takes ' + name + ' out of the Hole before you can speak. The question is applied whether you would or not, a confession is read out, and the Fire follows by the end of the week. He thanks you for your diligence in finding the heretic. You did not know there was one.', 'danger');
    return true;
  };
})(typeof window !== 'undefined' ? window : globalThis);
