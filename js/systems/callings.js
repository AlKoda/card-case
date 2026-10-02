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

  // ---- Roads: the endings nearest (round 8) -------------------------------------
  // e.roads() lists the ways this run could end that it has touched, nearest
  // first: up to three roads (the wins and the Hangman's table) and, ahead of
  // them, the defeats the city has already warned of. Each is
  //   { id, title, warn, frac, near, want }
  // `id` keys the ending's seal; `near` is a word ('Near', 'Halfway', 'A long
  // road'; for a warning 'Warned'), `want` one sentence of what it still
  // wants, in words rather than counts. DOM-free: the journal draws it.
  Callings.ROADS_HELP = 'There are many ways to end. The journal\'s Roads show the three you are nearest, and what each still wants.';
  Callings.NEAR = [[0.8, 'Near'], [0.5, 'Halfway'], [0, 'A long road']];
  function part(have, need) { return need > 0 ? Math.max(0, Math.min(1, have / need)) : 1; }
  function nearWord(frac) { for (var i = 0; i < Callings.NEAR.length; i++) if (frac >= Callings.NEAR[i][0]) return Callings.NEAR[i][1]; return 'A long road'; }
  P.roads = function () {
    var s = this.s, st = s.stats || {}, cnt = s.counts || {}, m = s.meters || {}, court = s.court || {};
    var roads = [], warns = [];
    function road(id, parts, want) {
      var frac = parts.reduce(function (a, b) { return a + b; }, 0) / parts.length;
      roads.push({ id: id, title: CF.ENDINGS[id].title, warn: false, frac: frac, near: nearWord(frac), want: want });
    }
    function warn(id, want) { warns.push({ id: id, title: CF.ENDINGS[id].title, warn: true, frac: 1, near: 'Warned', want: want }); }
    var top = this.rankCap ? this.rankCap() : CF.TOP_RANK, rep = m.reputation || 0;
    // The Burgomaster: the red gown, Standing for the Seat, three seals, and a quiet, clean city.
    if (s.calling === 'commissioner' && top >= CF.TOP_RANK) {
      var pl = this.seatPledges(), rank = s.rank || 0;
      road('commissioner', [part(rank, CF.TOP_RANK), part(rep, CF.COMMISSIONER_REP), part(pl.n, 3)],
        rank < CF.TOP_RANK ? 'The red gown first.' : !this.seatSeasoned() ? 'The Council wants a season in the red gown first.' :
        rep < CF.COMMISSIONER_REP ? 'The Seat wants more Standing.' : !pl.all ? 'The Seat wants the seals of the Council, the Bishop and the Guilds.' :
        (m.pressure > 4 || m.scrutiny > 4) ? 'The Seat wants a quieter city and a cleaner name.' : 'The Seat waits, in Attend.');
    }
    // The Scholar: three Loose Ends in Rest, then the Architect convicted.
    var loose = this.cardsOf('looseend', true).length, archOpen = this.openCases().some(function (r) { return r.template === 'architect'; });
    if ((s.calling === 'master' || loose || archOpen) && this.pathOpen('master')) {
      road('master', archOpen ? [1, 0.5] : [part(loose, 3), 0], archOpen ? 'The Architect, convicted.' : 'Three Loose Ends, together in Rest.');
    }
    // The Reformer: the Bailiff's staff, two leaves of the ledger, the King of Thunes convicted.
    var synd = this.countOf('syndicate') > 0 && !s.flags.syndicateFallen, ledger = this.cardsOf('ledger', true).length;
    var kingCase = this.openCases().some(function (r) { return r.template === 'syndicate'; });
    if (synd && (s.calling === 'crusader' || ledger || kingCase) && this.pathOpen('crusader') && court.stance !== 'treaty') {
      road('crusader', kingCase ? [1, 1, 0.5] : [part(s.rank || 0, 2), part(ledger, 2), 0],
        kingCase ? 'The King of Thunes, convicted.' : (s.rank || 0) < 2 ? 'The Bailiff\'s staff, to go among them.' : 'Two leaves of the Coquille\'s ledger.');
    }
    // The Treaty City: quiet weeks under the Treaty.
    if (court.stance === 'treaty' && CF.Coquille) road('treatycity', [part(court.quietWeeks || 0, CF.Coquille.TREATY_WEEKS)], 'Quiet weeks under the Treaty, with the Crowd low.');
    // The King of Thunes: weeks inside the Court, a Purse it respects, a name it fears.
    if (court.stance === 'rule' && court.inside && CF.Coquille) {
      var T = CF.Coquille.THRONE;
      road('kingofthunes', [part(court.insideWeeks || 0, T.weeks), part(cnt.purse || 0, T.purse), part(cnt.cruelty || 0, T.cruelty)],
        (court.insideWeeks || 0) < T.weeks ? 'More weeks inside the Court.' : (cnt.purse || 0) < T.purse ? 'A Purse the Court respects.' :
        (cnt.cruelty || 0) < T.cruelty ? 'A name the Court fears.' : 'The barrel is within reach.');
    }
    // The Thief-taker General: purses, settlements, Standing and the red gown, and few wrong names.
    var TT = CF.Purse && CF.Purse.THIEFTAKER;
    if (TT && ((cnt.purse || 0) || (st.settled || 0)) && (st.wrongful || 0) <= TT.wrongful) {
      road('thieftaker', [part(cnt.purse || 0, TT.purse), part(st.settled || 0, TT.settled), part(rep, TT.standing), part(s.rank || 0, TT.rank)],
        (cnt.purse || 0) < TT.purse ? 'More purses taken.' : (st.settled || 0) < TT.settled ? 'Cases settled by the thief-takers.' :
        rep < TT.standing ? 'More Standing.' : (s.rank || 0) < TT.rank ? 'The red gown.' : 'The fences already call you General.');
    }
    // The Merciful Judge: mercies, and citizens made of the ones sent home; closed by cruelty.
    var MJ = CF.Societies && CF.Societies.MERCIFUL, reformed = this.reformedCount ? this.reformedCount() : 0;
    if (MJ && (cnt.mercy || 0) && (cnt.cruelty || 0) <= MJ.cruelty) {
      road('merciful', [part(cnt.mercy || 0, MJ.mercy), part(reformed, MJ.reformed)],
        (cnt.mercy || 0) < MJ.mercy ? 'More mercies at the Court.' : reformed < MJ.reformed ? 'Citizens made of the ones sent home.' : 'Hold to it one more week.');
    }
    // The Hangman's Examiner: cruelty, and a city that fears you.
    var HG = CF.Societies && CF.Societies.HANGMANS;
    if (HG && (cnt.cruelty || 0) >= 3) {
      road('hangmans', [part(cnt.cruelty || 0, HG.cruelty), part(m.dread || 0, HG.dread)],
        (cnt.cruelty || 0) < HG.cruelty ? 'More cruelty on the ladder.' : 'The city must fear you.');
    }
    // The Long Service: a year at the top of your road, and the pension.
    var due = this.longServiceDue ? this.longServiceDue() : null;
    if (due) road('longservice', [part(s.week || 0, due)], typeof s.flags.longService === 'number' ? 'The Council is drawing up your pension.' : 'A year in the Council\'s service, at the top of your road.');
    // The defeats already warned of.
    if (this.blowWouldKill && this.blowWouldKill()) warn('death', 'With a Wound and no Health, the next blow kills.');
    if (s.flags.oldbaileyWarned) warn('oldbailey', 'One more purse, wrong name or debt, and the brother\'s ledger is enough.');
    if (s.flags.mountainIgnored && !s.flags.mountainDone) warn('dagger', 'The Order of the Mountain has warned you once.');
    if (s.flags.stakeWarned) warn('stake', 'The Inquisitor has asked for your name.');
    if ((m.pressure || 0) >= this.meterMax('pressure') - 2) warn('dismissed', 'The Crowd is close to the end of its patience.');
    if ((m.scrutiny || 0) >= this.meterMax('scrutiny') - 2) warn('corruption', 'The Council\'s sergeants are close.');
    if ((m.dread || 0) >= this.meterMax('dread') - 2) warn('riot', 'The city\'s fear is close to turning.');
    var order = Object.keys(CF.ENDINGS);
    roads.sort(function (a, b) { return b.frac - a.frac || order.indexOf(a.id) - order.indexOf(b.id); });
    return warns.slice(0, 2).concat(roads.slice(0, 3));
  };

  Callings.summary = function (e) {
    var p = e.s.paths;
    return Object.keys(CF.PATHS).map(function (k) { return CF.PATHS[k].label + ' ' + (p[k] || 0); }).join(' · ');
  };
})(typeof window !== 'undefined' ? window : globalThis);
