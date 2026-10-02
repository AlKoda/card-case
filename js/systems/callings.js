// Callings as drift (roadmap Phase 18). The Calling chosen at the start is
// a leaning, not a campaign: every ending is reachable from every run, and
// the run drifts toward whichever path the detective actually walks.
//
//   s.origin            the calling chosen at the start (its bonus is kept)
//   s.calling           the current calling; endings and their machinery key on it
//   s.paths             { commissioner, master, crusader }: how far down each path
//
// Paths grow from play: Power from rank, rooms and a calm city; Knowledge
// from connections, identifications, reopened cold cases and loose ends;
// Justice from gangs broken, criminals put away and operations run. When
// another path leads the current one by a margin, the calling changes,
// the Calling card on the table changes with it, and the journal says so.
(function (G) {
  var CF = G.CF;
  var U = CF.util;
  var P = CF.Engine.prototype;

  var Callings = (CF.Callings = {});
  CF.PATHS = {
    commissioner: { label: 'Power', calling: 'commissioner' },
    master: { label: 'Knowledge', calling: 'master' },
    crusader: { label: 'Justice', calling: 'crusader' },
  };
  Callings.MARGIN = 4;   // how far ahead another path must be to take over
  Callings.SEED = 3;     // the head start the chosen calling begins with

  P.initPaths = function () {
    var s = this.s;
    s.origin = s.origin || s.calling;
    if (!s.paths) {
      s.paths = { commissioner: 0, master: 0, crusader: 0 };
      s.paths[s.calling] = Callings.SEED;
    }
  };

  // Progress down a path. Returns true if the calling changed.
  P.pathGain = function (path, n, why) {
    this.initPaths();
    if (path === 'crusader' && this.s.court && this.s.court.stance === 'treaty') return false;
    this.s.paths[path] = (this.s.paths[path] || 0) + (n || 1);
    if (why) this.s.pathNotes = (this.s.pathNotes || []).concat([{ path: path, n: n, why: why, week: this.s.week }]).slice(-30);
    return this.checkDrift();
  };

  P.dominantPath = function () {
    this.initPaths();
    var p = this.s.paths, best = this.s.calling;
    Object.keys(p).forEach(function (k) { if (p[k] > p[best]) best = k; });
    return best;
  };

  // Another path has pulled clearly ahead. The run does not drift by itself:
  // the city asks (The Work Has Changed You), and the answer keeps the road
  // or takes the new one. Without a way to ask (no questions in this build,
  // the run over), it drifts as before. Returns true if the calling changed.
  P.checkDrift = function () {
    this.initPaths();
    var s = this.s, lead = this.dominantPath();
    if (lead === s.calling || s.paths[lead] < s.paths[s.calling] + Callings.MARGIN) return false;
    if (s.over) return false;
    if (this.offerChoice && Callings.register()) {
      if (s.choice) return false; // one question at a time; asked when this one is answered
      var from = s.calling, deeds = Callings.deeds(this, lead);
      var spec = U.clone(Callings.CHOICE);
      spec.options = Callings.CHOICE.options;
      spec.text = deeds
        ? U.fill('You meant to be {from}. Look at what you have done instead: {deeds}. Keep to your road, or take the one you are on.', { from: Callings.inProse(from), deeds: deeds })
        : U.fill('You meant to be {from}. The work has had other ideas. Keep to your road, or take the one you are on.', { from: Callings.inProse(from) });
      this.offerChoice(spec, { path: lead, from: from });
      return false;
    }
    return this.driftTo(lead);
  };
  // The question, kept in CF.CHOICES so a save can hold it open (never asked by the clock).
  Callings.CHOICE = { id: 'drift', when: function () { return false; },
    title: 'The Work Has Changed You', text: 'The work has changed you.',
    options: [
      { label: 'Keep to your road', gain: 'Your calling holds; Standing +1', text: 'You read your own name in the Rolls and remember why you wrote it there. The Council notices an examiner who knows their own mind.',
        effect: function (e, ctx) { e.keepCalling(ctx && ctx.path); } },
      { label: 'Take the new road', gain: 'Your calling changes, and your ending with it', text: 'You stop telling yourself otherwise.',
        effect: function (e, ctx) { e.driftTo(ctx && ctx.path); } },
    ] };
  Callings.register = function () {
    if (!CF.CHOICES) return false;
    if (!CF.CHOICES.some(function (c) { return c.id === 'drift'; })) CF.CHOICES.push(Callings.CHOICE);
    return true;
  };
  // Kept to the road: the other path falls back level with your own, so the
  // question waits for as much again of the other work.
  P.keepCalling = function (path) {
    this.initPaths();
    var s = this.s;
    if (path && path !== s.calling && s.paths[path] > s.paths[s.calling]) s.paths[path] = s.paths[s.calling];
    this.meter('reputation', 1);
    this.dirty = true;
  };
  // The calling changes: the card on the table, and the journal says why.
  P.driftTo = function (lead) {
    this.initPaths();
    var s = this.s;
    if (!lead || lead === s.calling || !CF.CALLINGS[lead]) return false;
    var from = s.calling;
    s.calling = lead;
    var card = null;
    for (var k in s.cards) if (CF.CARDS[s.cards[k].def].kind === 'calling' && s.cards[k].loc) { card = s.cards[k]; break; }
    var def = CF.CALLINGS[lead];
    if (card) this.transform(card, def.card, { desc: CF.CARDS[def.card].desc + ' (You set out as ' + Callings.inProse(from) + '; the work has changed you.)' });
    else this.create(def.card);
    // What the player did, in words; the numbers stay in the Calling card's dossier.
    var deeds = Callings.deeds(this, lead);
    this.story('Your Calling Changes', deeds
      ? U.fill('You meant to be {from}. Look at what you have done instead: {deeds}. Whatever you tell yourself, you are {to} now, and the ending you are walking toward is theirs.', { from: Callings.inProse(from), deeds: deeds, to: Callings.inProse(lead) })
      : U.fill('You meant to be {from}. The work had other ideas. Whatever you tell yourself, you are {to} now, and the ending you are walking toward is theirs.', { from: Callings.inProse(from), to: Callings.inProse(lead) }), 'major');
    this.dirty = true;
    return true;
  };

  // Is a path's ending open? Its own calling, or a path not clearly behind
  // the current one: a run that broke the Syndicate ends as the Crusader
  // even if promotions had nudged it toward the Chair.
  P.pathOpen = function (path) {
    this.initPaths();
    var p = this.s.paths;
    return this.s.calling === path || p[path] >= p[this.s.calling] - Callings.MARGIN;
  };

  // 'The Scholar' in the middle of a sentence: 'the Scholar'.
  Callings.inProse = function (key) { return CF.CALLINGS[key].label.replace(/^The /, 'the '); };
  // Why a path grew (s.pathNotes), as the deed itself: [one, several].
  Callings.DEEDS = {
    'a calm fortnight': ['a calm fortnight', 'calm fortnight after calm fortnight'],
    'promoted': ['a letter of office', 'letter after letter of office'],
    'made a treaty with the Coquille': ['a treaty with the Coquille'],
    'reasoned to the right name': ['the right name, reasoned out', 'the right names, reasoned out'],
    'put away a repeat offender': ['a thief who will not be back', 'thieves who will not be back'],
    'put away a violent man': ['a brute off the street', 'brutes off the street'],
    'put away someone at large': ['a name off the wall', 'names off the wall'],
    'broke a gang': ['a band broken', 'bands broken'],
    'broke the Coquille': ['the Coquille broken'],
    'went undercover': ['a season in disguise', 'seasons in disguise'],
    'left a purse to lie': ['a purse left lying', 'purses left lying'],
    'convicted a Council family': ['a Council family in the dock'],
    'an identification': ['a face put to a name', 'faces put to names'],
    'found a connection': ['two cases tied together', 'cases tied together'],
    'broke the Eumenides': ['the Eumenides broken'],
    'reopened a cold case': ['a cold case opened again', 'cold cases opened again'],
    'reopened a cold trail': ['a cold trail warmed', 'cold trails warmed'],
    'closed a cold case': ['a cold case answered', 'cold cases answered'],
    'a loose end': ['a loose end tied', 'loose ends tied'],
    'closed in on the network': ['the network drawn tight'],
  };
  Callings.deed = function (why, many) {
    var d = Callings.DEEDS[why];
    if (d) return many && d[1] ? d[1] : d[0];
    var room = /^built the (.+)$/.exec(why);
    if (room) return U.fill('masons in the {room}', { room: room[1] });
    return why;
  };
  // The last three distinct deeds down a path, newest first: 'a; b; c'.
  Callings.deeds = function (e, path) {
    var notes = (e.s.pathNotes || []).filter(function (n) { return n.path === path && n.why; });
    var order = [], count = {};
    for (var i = notes.length - 1; i >= 0; i--) {
      var w = notes[i].why;
      if (!count[w]) { count[w] = 0; order.push(w); }
      count[w]++;
    }
    var list = order.slice(0, 3).map(function (w) { return Callings.deed(w, count[w] > 1); });
    return list.join('; ');
  };

  Callings.summary = function (e) {
    var p = e.s.paths;
    return Object.keys(CF.PATHS).map(function (k) { return CF.PATHS[k].label + ' ' + (p[k] || 0); }).join(' · ');
  };
})(typeof window !== 'undefined' ? window : globalThis);
