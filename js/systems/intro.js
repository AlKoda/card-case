// The guided start: a new detective is introduced to the table one thing at
// a time, the way the first night of a case would go, instead of being
// handed every card and verb at once. Cards that are not yet part of the
// story wait in a stash; verbs open as the work calls for them.
//
//   s.intro = { step, stash: [{def, spec}], done: {verb: true}, hint, finished }
(function (G) {
  var CF = G.CF;
  var P = CF.Engine.prototype;

  var STASHED = { health: 1, instinct: 1, funds: 1, order: 1, personnel: 1, camera: 1, teammate: 1, informant: 1, district: 1, notes: 1, coldcase: 1, atlarge: 1, gang: 1, syndicate: 1 };
  var FIRST_VERBS = { time: 1, investigate: 1 };

  function spec(card) {
    var out = { data: card.data };
    ['label', 'desc', 'aspects', 'tags', 'image', 'caseId'].forEach(function (k) { if (card[k] !== undefined) out[k] = card[k]; });
    if (card.maxLife) out.lifetime = card.life;
    return out;
  }

  // Called once by newGame: put everything but the case, the Calling and
  // Focus away, close every verb but Investigate, and tell the opening.
  P.setupIntro = function () {
    var self = this, s = this.s;
    s.intro = { step: 0, stash: [], done: {}, hint: null, finished: false };
    this.tableCards().forEach(function (c) {
      if (STASHED[c.def]) { s.intro.stash.push({ def: c.def, spec: spec(c) }); self.remove(c); }
    });
    CF.VERB_ORDER.forEach(function (id) { s.verbs[id].unlocked = !!FIRST_VERBS[id]; });
    var op = CF.Story.opening(this);
    this.story(op.title, op.text, 'major');
    var rec = this.openCases()[0];
    this.story('New Case: ' + rec.title, this.caseCard(rec.id).desc, 'case');
    s.intro.hint = 'Drag the case onto Investigate, then press what it offers.';
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
  P.introUnlock = function (ids) {
    var self = this;
    ids.forEach(function (id) { if (self.s.verbs[id]) self.s.verbs[id].unlocked = true; });
    this.layoutVerbs();
  };

  // The steps, in order; each waits for its cue on the table.
  var STEPS = [
    { cue: function (e) { return !!e.s.intro.done.investigate; },
      run: function (e) {
        e.introUnlock(['analyze']);
        e.introReveal(['instinct']);
        return { hint: 'Evidence goes into Analyze. Put Focus or Instinct in with the case to search differently.' };
      } },
    { cue: function (e) { return e.countOf('witness') + e.countOf('suspect') > 0; },
      run: function (e) {
        e.introUnlock(['interrogate']);
        e.introReveal(['health']);
        return { hint: 'People go into Interrogate: Focus to listen, Instinct to bluff, Health to lean on them.' };
      } },
    { cue: function (e) { return e.countOf('clue') >= 2; },
      run: function (e) {
        e.introUnlock(['reflect']);
        return { hint: 'Two clues side by side in Reflect: see whether they tell one story.' };
      } },
    { cue: function (e) { return e.countOf('suspect') > 0 && e.countOf('clue') > 0; },
      run: function (e) {
        e.introUnlock(['arrest']);
        return { hint: 'A suspect and their clues in Arrest make a charge. The window says how strong it is.' };
      } },
    { cue: function (e) { return e.countOf('trial') > 0 || e.s.cases[Object.keys(e.s.cases)[0]].status !== 'open'; },
      run: function (e) { e.introFinish(); return null; } },
  ];

  P.introTick = function () {
    var s = this.s;
    var step = STEPS[s.intro.step];
    if (!step) { this.introFinish(); return; }
    if (!step.cue(this)) return;
    var beat = CF.Story.beat(this, s.intro.step);
    var res = step.run(this);
    s.intro.step++;
    if (beat) this.story(beat.title, beat.text, 'major');
    if (res && res.hint) s.intro.hint = res.hint;
    this.dirty = true;
  };

  // The rest of the desk arrives: money, forms, the district, the people.
  P.introFinish = function (why) {
    var s = this.s;
    if (!s.intro || s.intro.finished) return;
    s.intro.finished = true;
    this.introUnlock(CF.VERB_ORDER.filter(function (id) { return CF.VERBS[id].rank === 0; }));
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
