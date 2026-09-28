// The guided start: a new detective is introduced to the table one thing at
// a time, the way the first night of a case would go, instead of being
// handed every card and verb at once. Cards that are not yet part of the
// story wait in a stash; verbs open as the work calls for them.
//
//   s.intro = { step, stash: [{def, spec}], done: {verb: true}, hint, finished }
(function (G) {
  var CF = G.CF;
  var P = CF.Engine.prototype;

  var STASHED = { health: 1, focus: 1, instinct: 1, funds: 1, order: 1, personnel: 1, camera: 1, teammate: 1, informant: 1, district: 1, notes: 1, coldcase: 1, atlarge: 1, gang: 1, syndicate: 1 };
  var FIRST_VERBS = { time: 1, investigate: 1 };

  function spec(card) {
    var out = { data: card.data };
    ['label', 'desc', 'aspects', 'tags', 'image', 'caseId'].forEach(function (k) { if (card[k] !== undefined) out[k] = card[k]; });
    if (card.maxLife) out.lifetime = card.life;
    return out;
  }

  // Called once by newGame: put everything but the case, the Calling and
  // Focus away, close every verb but Investigate, and tell the opening.
  P.setupIntro = function (silent) {
    var self = this, s = this.s;
    s.intro = { step: 0, stash: [], done: {}, hint: null, finished: false, silent: !!silent };
    this.tableCards().forEach(function (c) {
      if (STASHED[c.def]) { s.intro.stash.push({ def: c.def, spec: spec(c) }); self.remove(c); }
    });
    var opening = !!s.flags.opening;
    var first = opening ? { duty: 1 } : FIRST_VERBS;
    CF.VERB_ORDER.forEach(function (id) { s.verbs[id].unlocked = !!first[id]; });
    if (opening) {
      // No office: one Health, one Wit, and work. The rest comes with the story.
      this.introRevealOne('health');
      this.introRevealOne('focus');
      s.intro.hint = 'You have no office yet. Drag Health onto Attend and press what it offers: a day\'s labour, a Coin.';
    } else {
      this.introReveal(['focus']); // a plain start keeps Wit out
      var op = CF.Story.opening(this);
      this.story(op.title, op.text, 'major');
      var rec = this.openCases()[0];
      this.story('New Case: ' + rec.title, this.caseCard(rec.id).desc, 'case');
      s.intro.hint = 'Drag the case onto Explore, then press what it offers. When it is done, open it: what it found lies face down. Tap a card to turn it over, tap it again to take it.';
    }
    if (s.intro.silent) s.intro.hint = null;
    this.dirty = true;
  };

  // Take cards out of the stash by definition.
  P.introReveal = function (defs) {
    var s = this.s, self = this, out = [];
    s.intro.stash = s.intro.stash.filter(function (it) {
      if (defs.indexOf(it.def) < 0) return true;
      out.push(self.create(it.def, it.spec));
      return false;
    });
    return out;
  };
  // One card of a kind out of the stash (the rest stay for later).
  P.introRevealOne = function (def) {
    var s = this.s;
    for (var i = 0; i < s.intro.stash.length; i++) {
      if (s.intro.stash[i].def !== def) continue;
      var it = s.intro.stash.splice(i, 1)[0];
      return this.create(it.def, it.spec);
    }
    return null;
  };
  P.introUnlock = function (ids) {
    var self = this;
    ids.forEach(function (id) { if (self.s.verbs[id] && !self.s.verbs[id].unlocked) { self.s.verbs[id].unlocked = true; self.emit('unlock', { verb: id }); } });
    this.layoutVerbs();
  };

  // The steps, in order; each waits for its cue on the table.
  var STEPS = [
    { beat: 0, cue: function (e) { return !!e.s.intro.done.investigate; },
      run: function (e) {
        e.introUnlock(['analyze']);
        e.introReveal(['instinct']);
        return { hint: 'Raw proof goes into Study. Put Wit or Instinct in with the case to search differently.' };
      } },
    { beat: 1, cue: function (e) { return e.countOf('witness') + e.countOf('suspect') > 0; },
      run: function (e) {
        e.introUnlock(['interrogate']);
        e.introReveal(['health']);
        return { hint: 'People go into Question: Wit to listen, Instinct to bluff, Health to lean on them.' };
      } },
    { beat: 2, cue: function (e) { return e.countOf('clue') >= 2; },
      run: function (e) {
        e.introUnlock(['reflect']);
        return { hint: 'Two tokens side by side in Rest: see whether they tell one story.' };
      } },
    { beat: 3, cue: function (e) { return e.countOf('suspect') > 0 && e.countOf('clue') > 0; },
      run: function (e) {
        e.introUnlock(['arrest']);
        return { hint: 'An accused and their tokens in The Court make a charge. The window says how it will stand.' };
      } },
    { beat: 4, cue: function (e) { return e.countOf('trial') > 0 || (Object.keys(e.s.cases).length > 0 && e.s.cases[Object.keys(e.s.cases)[0]].status !== 'open'); },
      run: function (e) {
        e.introReveal(['funds']);
        e.introUnlock(['duty']);
        return { hint: 'The sworn men are out. Meanwhile, Attend: Health walks a hard round for Coin, Wit keeps the day-book.' };
      } },
    { beat: 5, cue: function (e) { return e.countOf('condemned') > 0 || e.countOf('trial') === 0; },
      run: function (e) { return e.countOf('condemned') > 0 ? { hint: 'A conviction. The Condemned and a rung of the ladder go in The Court; say nothing and the Council sentences by custom.' } : null; } },
    { cue: function (e) { return e.countOf('condemned') === 0; },
      run: function (e) { e.introFinish(); return null; } },
  ];

  P.introSteps = function () { return STEPS; };
  P.introTick = function () {
    var s = this.s;
    if (s.flags.opening && s.flags.stage !== 'hired' && s.flags.stage !== 'keep') return; // the opening tells its own story
    var step = this.introSteps()[s.intro.step];
    if (!step) { this.introFinish(); return; }
    if (!step.cue(this)) return;
    var beat = step.beat !== undefined ? CF.Story.beat(this, step.beat) : null;
    var res = step.run(this);
    s.intro.step++;
    if (beat) this.story(beat.title, beat.text, 'major');
    if (res && res.hint && !s.intro.silent) s.intro.hint = res.hint;
    this.dirty = true;
  };

  // The rest of the desk arrives: money, forms, the district, the people.
  P.introFinish = function (why) {
    var s = this.s;
    if (!s.intro || s.intro.finished) return;
    s.intro.finished = true;
    this.introUnlock(CF.VERB_ORDER.filter(function (id) { return CF.VERBS[id].rank === 0 && !(id === 'time' && s.flags.bellSilent); }));
    var all = s.intro.stash.map(function (it) { return it.def; });
    this.introReveal(all);
    s.intro.hint = null;
    var beat = CF.Story.beat(this, 'desk');
    this.story(beat.title, (why ? why + ' ' : '') + beat.text, 'major');
    this.dirty = true;
  };

  P.introHint = function () {
    var s = this.s;
    return s.intro && !s.intro.finished ? s.intro.hint : null;
  };
})(typeof window !== 'undefined' ? window : globalThis);
