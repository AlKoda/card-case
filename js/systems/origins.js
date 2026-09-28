// Origins (docs/CITY.md §2): who you were before the Council's letter.
// The Calling is what you want; the origin is what you can do. Each one
// sets the starting cards, bends one rule, and shuts one door. The run's
// first morning is different five times.
//
//   s.who   'advocate' | 'hangman' | 'monk' | 'watchman' | 'clerk' | null
(function (G) {
  var CF = G.CF;
  var U = CF.util;
  var P = CF.Engine.prototype;

  var Origins = (CF.Origins = {});

  CF.ORIGINS = {
    advocate: { label: 'The Advocate', icon: 'irole-04', art: 'ctrade-02',
      blurb: 'You argued before the Blood Court for ten years and know how a file is built. The Council trusts your pen more than your fists.',
      bends: 'Reads the file: the first search of every scene turns up the token that marks the culprit. Begins with Wit ×2 and the Council\'s ear.',
      shut: 'Weak: a Wound takes half again as long to heal.' },
    hangman: { label: 'The Hangman', icon: 'irole-11', art: 'cwatch-01',
      blurb: 'You kept the Ravenstone for the city and read more bodies than any physician. The Council uses you. It will never dine with you.',
      bends: 'Reads wounds and poisons alone: begins with a Physician\'s Case, Health ×2 and the keys to the Hole. Study is quicker.',
      shut: 'Dishonoured: no office above Bailiff, and the city fears you from the first day (Dread 2).' },
    monk: { label: 'The Physician-Monk', icon: 'irole-05', art: 'ctrade-05',
      blurb: 'The Abbey lent you to the Council because you know herbs, wounds and the human heart, and because the Abbot wanted you out of the garden.',
      bends: 'Poisons and plants read at a glance: Study takes half the time. Begins with a Physician\'s Case and the Apothecary\'s Key.',
      shut: 'May not carry the sword: the Watch must make every arrest, and the Watch is slow. Indict takes half again as long.' },
    watchman: { label: 'The Watchman', icon: 'irole-03', art: 'ctrade-01',
      blurb: 'Twenty years on the night round with a cudgel and a lantern. Every tapster knows you. Every thief knows to run.',
      bends: 'Beats, chases and doors: Walk the Ward and the Watch take a quarter less time. Begins with Health ×3 and a Beadle already in service.',
      shut: 'Unlettered: Study takes twice as long until a Clerk is in your service, and the Council doubts you.' },
    clerk: { label: 'The Clerk of the Court', icon: 'irole-10', art: 'ctrade-06',
      blurb: 'You copied the Rolls for the last Examiner and know every form, fee and seal in the city. You have never once been in a fight.',
      bends: 'Procedure: every petition costs one Coin less and a Writ takes half the time. Begins with Wit ×2 and Coin ×2 more.',
      shut: 'No street: Walk the Ward is closed until a watchman is in your service, and the underworld does not know your face.' },
  };
  CF.ORIGIN_ORDER = ['advocate', 'hangman', 'monk', 'watchman', 'clerk'];

  // Starting cards, applied by newGame after the common table is laid.
  P.applyOrigin = function () {
    var s = this.s, who = s.who;
    if (!who || !CF.ORIGINS[who]) return;
    switch (who) {
      case 'advocate':
        this.create('focus');
        this.meter('reputation', 1);
        break;
      case 'hangman':
        this.create('health');
        this.create('kit'); this.removeOrder('kit');
        s.rooms.suite = true; this.removeOrder('suite');
        this.meter('dread', 2);
        break;
      case 'monk':
        this.create('kit'); this.removeOrder('kit');
        this.create('labpass'); this.removeOrder('labpass');
        break;
      case 'watchman':
        this.create('health'); this.create('health');
        this.create('teammate', this.teammateSpec('rookie'));
        break;
      case 'clerk':
        this.create('focus');
        this.create('funds'); this.create('funds');
        break;
    }
  };

  // The rule that bends and the door that shuts, as a factor on a verb's time.
  P.originFactor = function (verbId) {
    var who = this.s.who;
    if (!who) return 1;
    if (who === 'hangman' && verbId === 'analyze') return 0.75;
    if (who === 'monk' && verbId === 'analyze') return 0.5;
    if (who === 'monk' && verbId === 'arrest') return 1.5;
    if (who === 'watchman' && (verbId === 'patrol' || verbId === 'stakeout')) return 0.75;
    if (who === 'watchman' && verbId === 'analyze' && !this.hasClerk()) return 2;
    if (who === 'clerk' && verbId === 'warrant') return 0.5;
    return 1;
  };
  P.hasClerk = function () {
    return this.cardsOf('teammate', true).some(function (c) { return c.data && c.data.role === 'Clerk'; });
  };
  // Why a verb is shut for this origin, if it is.
  P.originLock = function (verbId) {
    var who = this.s.who;
    if (who === 'clerk' && verbId === 'patrol' && !this.countOf('teammate')) return 'You have never walked a round in your life. Take a watchman into service first (Petition).';
    return null;
  };
  // The highest office the Council will give this origin.
  P.rankCap = function () { return this.s.who === 'hangman' ? 2 : CF.TOP_RANK; };
  // How long a wound lasts for this body.
  P.woundFactor = function () { return this.s.who === 'advocate' ? 1.5 : 1; };
  // The Advocate reads the file: the culprit's trait token comes first.
  P.readFile = function (rec) {
    if (this.s.who !== 'advocate' || rec.fileRead) return false;
    rec.fileRead = true;
    var i = -1;
    for (var k = rec.found; k < rec.items.length; k++) if (rec.items[k].trait) { i = k; break; }
    if (i < 0) return false;
    var it = rec.items.splice(i, 1)[0];
    rec.items.splice(rec.found, 0, it);
    return true;
  };

  Origins.label = function (e) { return e.s.who && CF.ORIGINS[e.s.who] ? CF.ORIGINS[e.s.who].label : null; };
  void U;
})(typeof window !== 'undefined' ? window : globalThis);
