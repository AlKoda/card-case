// The guided start: a new detective is introduced to the table one thing at
// a time, the way the first night of a case would go, instead of being
// handed every card and verb at once. Cards that are not yet part of the
// story wait in a stash; verbs open as the work calls for them.
//
//   s.intro = { step, stash: [{def, spec}], done: {verb: true}, hint, finished, asides: {id: true} }
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
    s.intro = { step: 0, stash: [], done: {}, hint: null, finished: false, silent: !!silent, asides: {} };
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

  // The opening path (no office, the notice, the Watch): it gives the first lessons itself.
  function openingPath(e) { return !!(e.s.flags.opening || e.s.flags.stage); }
  // How many verbs have finished, all told.
  function verbsRun(e) { var sv = e.s.stats.verbs || {}, n = 0; for (var k in sv) n += sv[k]; return n; }

  // The steps, in order; each waits for its cue on the table. A step with
  // skipIf is passed over when the opening has already taught it.
  var STEPS = [
    { beat: 0, skipIf: openingPath, cue: function (e) { return !!e.s.intro.done.investigate; },
      run: function (e) {
        e.introUnlock(['analyze']);
        e.introReveal(['instinct']);
        return { hint: 'Raw proof goes into Study. Put Wit or Instinct in with the case to search differently.' };
      } },
    { beat: 1, skipIf: openingPath, cue: function (e) { return e.countOf('witness') + e.countOf('suspect') > 0; },
      run: function (e) {
        e.introUnlock(['interrogate']);
        e.introReveal(['health']);
        return { hint: 'People go into Question: Wit to listen, Instinct to bluff, Health to lean on them.' };
      } },
    { beat: 2, skipIf: openingPath, cue: function (e) { return e.countOf('clue') >= 2; },
      run: function (e) {
        e.introUnlock(['reflect']);
        return { hint: 'Two tokens side by side in Rest: see whether they tell one story.' };
      } },
    // On the opening path the hire's own hint (the case in Rest, or question the named) stands until the
    // player has done something with the desk: a verb finished since the hire, not a clock alone.
    { beat: 3, played: true, cue: function (e) { return e.countOf('suspect') > 0 && e.countOf('clue') > 0; },
      run: function (e) {
        e.introUnlock(['arrest']);
        return { hint: 'An accused and the tokens of their case in The Court make a charge. Read the window before you press: on Indicia they walk free and remember you; Full Proof holds.' };
      } },
    // A charge laid: the sworn men are out (or have already answered). A case gone cold, settled or taken
    // by the Rival went to no jury, and the keep tells it in its own words.
    { beat: 4, cue: function (e) { var first = firstCase(e); return e.countOf('trial') > 0 || !!(first && JURY.indexOf(first.status) >= 0); },
      run: function (e) {
        e.introReveal(['funds']);
        e.introUnlock(['duty']);
        return { hint: 'The sworn men are out. Meanwhile, Attend: Health walks a hard round for Coin, Wit keeps the day-book.' };
      } },
    // The verdict: the ladder after a conviction, the sworn men's word after an acquittal
    // (the Ladder is not told when nobody was convicted).
    { beat: function (e) { return e.countOf('condemned') > 0 ? 5 : acquitted(e) ? 'acquit' : null; },
      cue: function (e) { return e.countOf('condemned') > 0 || e.countOf('trial') === 0; },
      run: function (e) { return e.countOf('condemned') > 0 ? { hint: 'A conviction. The Condemned and a rung of the ladder go in The Court; say nothing and the Council sentences by custom.' } : null; } },
    // The desk arrives once the Condemned is sentenced, and on the opening path not before
    // the first keep (the Bell and the stipend come with it).
    { cue: function (e) { return e.countOf('condemned') === 0 && !e.s.flags.opening; },
      run: function (e) { e.introFinish(); return null; } },
  ];

  // The guided start's first case (the opening's own, else the first opened), and the statuses that
  // mean it went before the sworn men.
  var JURY = ['trial', 'closed', 'acquitted'];
  function firstCase(e) {
    var cs = e.s.cases, keys = Object.keys(cs);
    for (var i = 0; i < keys.length; i++) if (cs[keys[i]].opening) return cs[keys[i]];
    return keys.length ? cs[keys[0]] : null;
  }

  // Was any case of the guided start ended by an acquittal?
  function acquitted(e) {
    var cs = e.s.cases;
    return Object.keys(cs).some(function (k) { return cs[k].status === 'acquitted'; });
  }

  // After the hire the beats come one at a time: eight seconds after the
  // last, and once a verb has finished since (or half a minute has passed).
  // A step marked played, while the hire's own hint still stands (intro.byHire, set by
  // openingHired), waits for the verb (or a long while: PLAYED_WAIT), so the hint that
  // names the next move is not replaced before the player can make it.
  var PLAYED_WAIT = 120;
  function paced(e, played) {
    var s = e.s;
    if (s.intro.lastBeatT === undefined) return true;
    var since = s.t - s.intro.lastBeatT;
    if (since < 8) return false;
    return verbsRun(e) > (s.intro.lastBeatVerbs || 0) || since >= (played && s.intro.byHire ? PLAYED_WAIT : 30);
  }

  // The plain start's first three beats, which the opening path passes over, come back there as
  // asides, each once, when the table first calls for it. Their prose goes quietly to the journal.
  // One speaks on the table, because it guards against harm: an accused and Health to hand with no
  // Wit (a hire from the gallows or the Watch has Health and nothing to listen with), and Health in
  // Question is the question. s.intro.asides holds what has been told; a save without it has told none.
  function avail(e, d) { return e.tableCards().some(function (c) { return c.def === d && !e.unavailableReason(c); }); }
  function accused(e) { return e.verb('interrogate').unlocked && avail(e, 'suspect'); }
  function twoTokens(e) {
    var n = {};
    return e.tableCards().some(function (c) { return c.def === 'clue' && c.caseId && (n[c.caseId] = (n[c.caseId] || 0) + 1) >= 2; });
  }
  CF.INTRO_ASIDE_QUESTION = 'Health in Question is the question: everybody confesses, true or not, and without indicia it is a crime. Wit listens; Instinct bluffs.';
  var ASIDES = [
    { id: 'question', hint: CF.INTRO_ASIDE_QUESTION, cue: function (e) { return accused(e) && avail(e, 'health') && !avail(e, 'focus'); } },
    { id: 'people', beat: 1, cue: accused },
    { id: 'scene', beat: 0, cue: function (e) { return avail(e, 'evidence'); } },
    { id: 'casebook', beat: 2, cue: twoTokens },
  ];
  // Tells the first aside whose time has come; true when it took the hint (the steps wait a beat).
  function asides(e) {
    var s = e.s;
    if (!openingPath(e)) return false;
    var told = s.intro.asides || (s.intro.asides = {});
    for (var i = 0; i < ASIDES.length; i++) {
      var a = ASIDES[i];
      if (told[a.id] || (a.hint && (s.intro.silent || !paced(e))) || !a.cue(e)) continue;
      told[a.id] = true;
      var beat = a.beat !== undefined ? CF.Story.beat(e, a.beat) : null;
      if (beat) e.story(beat.title, beat.text, 'minor');
      e.dirty = true;
      if (!a.hint) return false;
      s.intro.hint = a.hint; s.intro.lastBeatT = s.t; s.intro.lastBeatVerbs = verbsRun(e);
      delete s.intro.byHire;
      return true;
    }
    return false;
  }

  P.introSteps = function () { return STEPS; };
  P.introTick = function () {
    var s = this.s;
    if (s.flags.opening && s.flags.stage !== 'hired' && s.flags.stage !== 'keep') return; // the opening tells its own story
    if (asides(this)) return; // one lesson at a time
    var steps = this.introSteps(), step = steps[s.intro.step];
    while (step && step.skipIf && step.skipIf(this)) { s.intro.step++; step = steps[s.intro.step]; }
    if (!step) { this.introFinish(); return; }
    if (!step.cue(this)) return;
    if (step.beat !== undefined && openingPath(this) && !paced(this, step.played)) return;
    var key = typeof step.beat === 'function' ? step.beat(this) : step.beat;
    var beat = key !== undefined && key !== null ? CF.Story.beat(this, key) : null;
    var res = step.run(this);
    s.intro.step++;
    if (beat) { this.story(beat.title, beat.text, 'major'); s.intro.lastBeatT = s.t; s.intro.lastBeatVerbs = verbsRun(this); delete s.intro.byHire; }
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
    // A lesson the first keep gave while the Court was still being taught (the Bell and its
    // dues) stays on a little after the desk arrives: until the Bell rings, or a minute on.
    var after = s.intro.after;
    s.intro.hint = after && after.week === s.week && !s.intro.silent ? after.text : null;
    if (s.intro.hint) { s.intro.tailT = s.t + 60; s.intro.tailWeek = s.week; }
    delete s.intro.after;
    var beat = CF.Story.beat(this, 'desk');
    this.story(beat.title, (why ? why + ' ' : '') + beat.text, 'major');
    this.dirty = true;
  };

  // The opening teaches the table's handling as it goes (the labour, the notice, the sergeant), so
  // the plain how-to line (drag onto the verbs, tap a slot) is for a plain start only: on the
  // opening path, once the Bell's lesson has had its week, the advisor speaks. For the hint bar.
  P.introTaughtControls = function () { return !!(this.s.intro && openingPath(this)); };

  // A lesson never stands over the one card whose clock ends the file: while a Fever runs,
  // the hint says so instead (and the lesson comes back once it is slept off).
  CF.INTRO_FEVER = 'Pressing: {card}. Into Rest now, or the file ends.';
  function collapsing(e) {
    return e.tableCards().filter(function (c) { var d = CF.CARDS[c.def]; return d && d.tags && d.tags.indexOf('collapse') >= 0 && c.maxLife; })[0] || null;
  }
  P.introHint = function () {
    var s = this.s, hint;
    if (!s.intro) return null;
    if (!s.intro.finished) hint = s.intro.hint;
    else hint = s.intro.tailT > s.t && s.intro.tailWeek === s.week ? s.intro.hint : null;
    var fever = hint ? collapsing(this) : null;
    return fever ? CF.util.fill(CF.INTRO_FEVER, { card: this.labelOf(fever) }) : hint;
  };
})(typeof window !== 'undefined' ? window : globalThis);
