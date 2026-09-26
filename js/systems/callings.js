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

  // Another path has pulled clearly ahead: the run drifts.
  P.checkDrift = function () {
    this.initPaths();
    var s = this.s, lead = this.dominantPath();
    if (lead === s.calling || s.paths[lead] < s.paths[s.calling] + Callings.MARGIN) return false;
    var from = s.calling;
    s.calling = lead;
    var card = null;
    for (var k in s.cards) if (CF.CARDS[s.cards[k].def].kind === 'calling' && s.cards[k].loc) { card = s.cards[k]; break; }
    var def = CF.CALLINGS[lead];
    if (card) this.transform(card, def.card, { desc: CF.CARDS[def.card].desc + ' (You set out as ' + CF.CALLINGS[from].label + '; the work has changed you.)' });
    else this.create(def.card);
    this.story('Your Calling Changes', 'You set out to be ' + CF.CALLINGS[from].label + '. Look at what you have actually done: ' + Callings.summary(this) +
      '. Whatever you tell yourself, you are ' + def.label + ' now, and the ending you are walking toward is theirs.', 'major');
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

  Callings.summary = function (e) {
    var p = e.s.paths;
    return Object.keys(CF.PATHS).map(function (k) { return CF.PATHS[k].label + ' ' + (p[k] || 0); }).join(' · ');
  };
})(typeof window !== 'undefined' ? window : globalThis);
