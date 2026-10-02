// The game engine: owns all state, advances time, runs verbs and recipes,
// and drives the city (cases, rent, criminals, retaliation). No DOM here;
// the UI reads state and calls the public methods.
(function (G) {
  var CF = G.CF;
  var U = CF.util;

  var WEEK = 60;          // seconds of game time per week
  var MAX_OPEN_CASES = 4; // the ceiling; rank sets the real number (maxOpenCases)
  var COLD_WARNING = 60; // seconds left on a case before the warning
  var FADE_WARNING = 30; // seconds left on a clue or witness before the warning
  var FADING = { clue: 1, evidence: 1, witness: 1, intel: 1, bribe: 1, hunger: 1, sickness: 1, stress: 1 };
  // A strain whose clock ends the file (the Fever): half a minute before, it
  // is told as a danger story with the card's uid, and 'pressing' is emitted.
  var STRAIN_WARN = { burnout: 1 };
  // Strain: two Fatigue is Exhaustion (street verbs slower), three is
  // Burnout. Tunnel Vision slows the careful verbs and warps deductions.
  CF.STRAIN = { exhaustedAt: 2, exhaustedSlow: 1.25, exhaustedVerbs: ['duty', 'investigate', 'interrogate'],
    tunnelSlow: 1.25, tunnelVerbs: ['investigate', 'analyze', 'reflect'] };
  // Money: salary rises with rank, rent does not.
  CF.ECONOMY = { salary: [1, 2, 3], rent: 1, convictionPay: { reasonable: 1, strong: 2 }, highProfilePay: 1 };
  // The table is a free board measured in board pixels. Cards and verbs can
  // sit anywhere; placement keeps them from covering each other.
  var T = {
    CW: 116, CH: 168, GAP: 14,   // card footprint (the painted cards' own shape)
    VW: 240, VH: 292,            // verb token footprint: a square tile twice a card's width, its ring and its name plate
    COLS: 8,                     // width of the automatic layout, in cards
    TOP: 312,                    // cards start below the row of verbs
    verbsOnBoard: true,          // the verbs are tokens on the felt, movable like cards
  };
  // The edge of the table: nothing goes beyond it.
  T.BOUNDS = { x: -520, y: -250, w: 2900, h: 1840 };
  var ZONE_ROWS = {       // layout row each kind prefers
    ability: 0, funds: 0, threat: 0, calling: 0, insight: 0, career: 0,
    case: 1, coldcase: 1, court: 1,
    clue: 2, evidence: 2, witness: 2, suspect: 2,
    district: 4, informant: 4, criminal: 4,
    equipment: 5, order: 5, room: 5, personnel: 5, teammate: 5, hospital: 5, paper: 5, temptation: 5,
  };

  CF.WEEK = WEEK;
  CF.TABLE = T;

  // ---- Card helpers shared with data files --------------------------------
  // A card definition is data: label, kind, aspects, tags, decay (seconds of
  // lifetime, 0 = permanent), image (an --art-* key) and onExpire. `decay` and
  // `lifetime` are the same field; either spelling is accepted.
  (function normaliseDefs() {
    for (var id in CF.CARDS) {
      var d = CF.CARDS[id];
      d.id = id;
      if (d.decay !== undefined && d.lifetime === undefined) d.lifetime = d.decay;
      if (d.lifetime !== undefined && d.decay === undefined) d.decay = d.lifetime;
      d.aspects = d.aspects || {};
      d.tags = d.tags || [];
    }
  })();
  CF.aspectsOf = function (card) {
    var def = CF.CARDS[card.def];
    var res = {};
    // The kind is an aspect too, but a definition that already names it
    // (Funds carry `funds`) must not count double: a cost of 2 is 2 cards.
    if (!def.aspects || !def.aspects[def.kind]) res[def.kind] = 1;
    U.addAspects(res, def.aspects || {});
    if (card.aspects) U.addAspects(res, card.aspects);
    return res;
  };
  CF.clueAspects = function (card) {
    var out = {};
    var a = CF.aspectsOf(card);
    CF.CLUE_ASPECTS.forEach(function (k) { if (a[k]) out[k] = a[k]; });
    return out;
  };
  // Tags are free-form labels used by recipes and highlights ("kit",
  // "surface", "burglary"...). An instance's tags add to its definition's.
  CF.tagsOf = function (card) {
    var out = (CF.CARDS[card.def].tags || []).slice();
    (card.tags || []).forEach(function (t) { if (out.indexOf(t) < 0) out.push(t); });
    return out;
  };
  CF.hasTag = function (card, tag) { return CF.tagsOf(card).indexOf(tag) >= 0; };
  // The art key for a card's picture, if the data names one (else the UI picks).
  CF.imageOf = function (card) { return card.image || CF.CARDS[card.def].image || null; };
  CF.costOf = function (card) {
    if (!card || !card.data) return 0;
    if (card.data.order) return Math.max(1, CF.ORDERS[card.data.order].cost - (card.data.discount || 0));
    if (card.data.personnel) return CF.PERSONNEL[card.data.personnel].cost;
    return 0;
  };

  function Engine(state) {
    this.s = state;
    this.rng = CF.makeRng(state.seed);
    this.rng.setState(state.rng);
    this.listeners = [];
    this.dirty = true;
    this._memo = null; // a render pass's memo (see withMemo); never saved
  }
  CF.Engine = Engine;
  var P = Engine.prototype;

  // ---- Construction -------------------------------------------------------
  // What a calling brings: its card on the table and its opening edge.
  P.applyCalling = function (calling) {
    var s = this.s;
    s.calling = calling; s.origin = calling;
    delete s.flags.callingOpen;
    this.create(CF.CALLINGS[calling].card);
    if (calling === 'commissioner') {
      this.create('funds');
      this.create('teammate', this.teammateSpec('rookie'));
    } else if (calling === 'master') {
      this.create('camera');
      this.removeOrder('camera');
    } else if (calling === 'crusader') {
      this.create('informant', this.informantSpec('market'));
    }
    if (this.initPaths) { s.paths = null; this.initPaths(); }
    this.dirty = true;
  };

  Engine.newGame = function (opts) {
    opts = opts || {};
    var seed = opts.seed !== undefined ? opts.seed : Math.floor(Math.random() * 1e9);
    var s = {
      version: 2, seed: seed, rng: seed, t: 0, week: 1, weekT: 0, dispatchT: 170, nextUid: 1,
      cards: {}, verbs: {}, cases: {}, rooms: {}, flags: { oldDebt: {} }, journal: [], criminals: {}, network: { fronts: {} }, askSeen: {}, seals: {}, roomUse: {},
      meters: { pressure: 0, scrutiny: 0, retaliation: 0, reputation: 0, dread: 0 },
      counts: { cruelty: 0, mercy: 0, purse: 0, debt: 0 },
      rank: 0, calling: opts.calling || 'master', origin: opts.calling || 'master', who: opts.who || null, detective: opts.name || 'Examiner',
      over: null,
      stats: { convictions: 0, acquittals: 0, wrongful: 0, cold: 0, cases: 0, attacks: 0, sentHome: 0, reformed: 0, killedBy: null }, weekFaded: [],
    };
    var e = new Engine(s);
    e.initPaths();
    // The questions kept outside the city's list (the calling's, the powers'): registered before the clock asks.
    if (CF.Callings && CF.Callings.register) CF.Callings.register();
    if (CF.Patrons && CF.Patrons.register) CF.Patrons.register();
    CF.VERB_ORDER.forEach(function (id) {
      s.verbs[id] = { id: id, status: 'idle', slots: {}, held: [], ctxSlots: {}, out: [], recipe: null,
        elapsed: 0, duration: 0, story: null, unlocked: CF.VERBS[id].rank === 0 };
    });
    e.layoutVerbs();

    e.create('health');
    e.create('focus');
    e.create('instinct');
    for (var i = 0; i < 3; i++) e.create('funds');
    e.create('personnel', e.personnelSpec('rookie'));
    // The calling: given now, or chosen in play once you have the desk (the opening).
    if (opts.opening && !opts.calling) s.flags.callingOpen = true;
    else e.applyCalling(s.calling);

    if (e.applyOrigin) e.applyOrigin();
    if (opts.legacy) e.applyLegacy(opts.legacy, { defer: !!(opts.opening && e.setupOpening) });

    if (opts.opening && e.setupOpening) {
      // No office yet: Health and Attend, then the notice, the Watch, the desk.
      e.setupOpening();
      if (e.setupIntro) e.setupIntro(!opts.guided);
      e.dirty = true;
      return e;
    }
    // A harness that wants the whole city (opts.life): the needs and the choices run from the first day, as they do after the opening.
    if (opts.life) s.flags.firstCase = true;
    e.spawnCase('burglary', { lifetime: 300, quiet: !!opts.guided, first: true });
    if (opts.guided && e.setupIntro) { e.setupIntro(); return e; }
    if (CF.Story) { var op = CF.Story.opening(e); e.story(op.title, op.text, 'major'); return e; }
    e.story('Your First Day',
      'The desk is yours now, along with the tallow stub, the cracked inkhorn and the case already waiting on it. ' +
      'The last examiner to sit here left in a hurry. The city did not stop to notice. ' +
      'Drag cards onto the verbs on your table to act. Click a verb to open it and see what it wants.', 'major');
    e.dirty = true;
    return e;
  };

  Engine.load = function (json) {
    var s = typeof json === 'string' ? JSON.parse(json) : json;
    s.criminals = s.criminals || {}; // older saves had no criminal records
    s.network = s.network || { fronts: {} };
    s.origin = s.origin || s.calling;
    s.who = s.who || null;
    s.favour = s.favour || { council: 0, bishop: 0, guild: 0 };
    s.rooms = s.rooms || {};
    s.meters.dread = s.meters.dread || 0; // the Free City's fear of you (Part II)
    s.counts = s.counts || { cruelty: 0, mercy: 0, purse: 0, debt: 0 };
    s.counts.debt = s.counts.debt || 0;
    // An older finished file: the end paper's lesson, from the ending alone (no cause was kept).
    if (s.over && s.over.lesson === undefined) {
      var oldEnd = CF.ENDINGS && CF.ENDINGS[s.over.id];
      s.over.cause = s.over.cause || null;
      s.over.threat = oldEnd && oldEnd.threat || null;
      s.over.lesson = oldEnd && !oldEnd.win && oldEnd.lesson ? oldEnd.lesson : null;
    }
    // The week's ledger counts from the last bell: an older save starts counting now, not from the beginning.
    if (!s.weekSnap) s.weekSnap = { convictions: s.stats.convictions || 0, acquittals: s.stats.acquittals || 0, cold: s.stats.cold || 0 };
    // The Bell tells the patrons' favour moved (round 8): an older save counts from now.
    if (!s.weekSnap.favour) s.weekSnap.favour = { council: s.favour.council || 0, bishop: s.favour.bishop || 0, guild: s.favour.guild || 0 };
    // The trails gone stale this week are told in one line at the Bell (round 8).
    if (!Array.isArray(s.weekFaded)) s.weekFaded = [];
    // How the last blow fell, for the ending (round 8).
    if (s.stats.killedBy === undefined) s.stats.killedBy = null;
    // The Crusader's word of the Coquille came with round 8: a save already past its week has had its warning.
    if (s.flags.coquilleWord === undefined) s.flags.coquilleWord = (s.week || 0) > 6;
    // The Thief-taker General and the Mountain warn before they end a run (round 8): an older save has had neither warning.
    if (s.flags.thieftakerWarned === undefined) s.flags.thieftakerWarned = false;
    if (s.flags.mountainIgnored === undefined) s.flags.mountainIgnored = false;
    // The Order wants a case left alone (round 8): an older save has neither its peace nor its war.
    if (s.flags.mountainDone === undefined) s.flags.mountainDone = false;
    if (s.flags.mountainWar === undefined) s.flags.mountainWar = false;
    // The calendar (round 8): the Assize's pension is asked of nothing yet; a save past the Assize's
    // weeks has had none (it is not read late); the Long Service has not been told.
    if (s.flags.pension === undefined) s.flags.pension = false;
    if (s.flags.assize === undefined) s.flags.assize = (s.week || 0) > CF.ASSIZE.last ? { week: null, record: null } : null;
    if (s.flags.longService === undefined) s.flags.longService = null;
    // Round 8: the opening case may be lost and the desk kept; a failed vote waits six weeks.
    if (s.flags.openingAcquitted === undefined) s.flags.openingAcquitted = false;
    if (typeof s.flags.chairCooldown !== 'number') s.flags.chairCooldown = 0;
    // The Seat already told once (a cooldown or a Seat on the table): the next telling is not a death.
    if (s.flags.seatTold === undefined) s.flags.seatTold = !!s.flags.chairCooldown || Object.keys(s.cards || {}).some(function (k) { return s.cards[k].def === 'chair'; });
    // A queued case says once where it will come from (an informer's word, round 8).
    if (s.nextCase && s.nextCase.told === undefined) s.nextCase.told = false;
    // A hue and cry is tried for the crime they walked from (round 8): an older save's hunt finds it on the record.
    Object.keys(s.cases || {}).forEach(function (id) {
      var hr = s.cases[id];
      if (hr.template !== 'manhunt' || hr.crimeTitle !== undefined) return;
      var cul = (hr.suspects || []).filter(function (x) { return x.guilty; })[0];
      var kc = null;
      if (cul) for (var kk in s.criminals || {}) if (s.criminals[kk].name === cul.name) kc = s.criminals[kk];
      var chase = cul ? U.fill(CF.CASE_TEMPLATES.manhunt.title, { culprit: cul.name }) : '';
      var hs = kc && kc.history ? kc.history.filter(function (h) { return h.title && h.title !== chase; }) : [];
      hr.crimeTitle = hs.length ? hs[hs.length - 1].title : null;
    });
    // The Harbourmaster's Examiner keeps the week and the road of the last thread pulled (round 8).
    Object.keys(s.cards).forEach(function (u) {
      var rc = s.cards[u];
      if (rc.def !== 'rival') return;
      rc.data = rc.data || {};
      if (typeof rc.data.heatWeek !== 'number') rc.data.heatWeek = -1;
      if (rc.data.heatHow === undefined) rc.data.heatHow = null;
      if (rc.data.eyes === undefined) rc.data.eyes = null;
    });
    // An innocent acquitted is nobody to hunt (round 8): an older save's Abroad card for one is marked, and leaves in six weeks.
    Object.keys(s.cards).forEach(function (u) {
      var ic = s.cards[u];
      if (ic.def !== 'atlarge' || !ic.data || ic.data.innocent !== undefined) return;
      ic.data.innocent = !ic.data.criminalId && /They were innocent, and now they hate you\./.test(ic.desc || '');
      if (ic.data.innocent && ic.life === undefined) { ic.life = ic.maxLife = CF.INNOCENT_ABROAD_WEEKS * WEEK; }
    });
    // The Council writes on the record as well as Standing, and an office's crimes come a week after it (round 8).
    if (typeof s.rankWeek !== 'number') s.rankWeek = -1;
    // The Old Bailey is told a step before it lands (round 8).
    if (s.flags.oldbaileyWarned === undefined) s.flags.oldbaileyWarned = false;
    // The upright man's weekly Coin (round 8): an older save took it once, and owes nothing.
    if (s.flags.uprightPaid === undefined) s.flags.uprightPaid = null;
    if (s.flags.uprightBroken === undefined) s.flags.uprightBroken = false;
    // A wrong name's true whereabouts, for the ballad (round 8): an older hidden record is given one by its name.
    Object.keys(s.criminals).forEach(function (k) {
      var hc = s.criminals[k];
      if (hc.hidden && hc.wrongfulAlibi === undefined && CF.Criminals) hc.wrongfulAlibi = CF.Criminals.alibiFor(hc.name + '|' + (hc.wrongfulTitle || ''));
    });
    // The Merciful Judge counts the ones sent home (round 7): an older save counts its pardons, fines and reformed from the records.
    s.stats.sentHome = Math.max(s.stats.sentHome || 0, Engine.sentHomeOf(s));
    // The Harbourmaster's own case (round 8): an older save has neither opened it nor seen him fall.
    if (s.flags.harbourFallen === undefined) s.flags.harbourFallen = false;
    if (s.flags.harbourCase === undefined) s.flags.harbourCase = null;
    // A Loose End remembers its case (round 8): an older one remembers only a kind of proof.
    Object.keys(s.cards).forEach(function (u, i) {
      var lc = s.cards[u];
      if (lc.def !== 'looseend') return;
      lc.data = lc.data || {};
      if (lc.data.aspect === undefined) lc.data.aspect = CF.LOOSE_END_ASPECTS[i % CF.LOOSE_END_ASPECTS.length];
      if (lc.data.fromTitle === undefined) lc.data.fromTitle = null;
      if (lc.data.week === undefined) lc.data.week = -1;
    });
    // A citizen sent home may come back as a witness (round 8): an older save has had none come.
    if (!s.flags.oldDebt || typeof s.flags.oldDebt !== 'object') s.flags.oldDebt = {};
    // Mid-work asks are rationed per verb and week (round 8): an older save has asked nothing yet.
    if (!s.askSeen || typeof s.askSeen !== 'object') s.askSeen = {};
    // The Vanished may be alive (round 8): an older save's cases were all as dead as they were written.
    Object.keys(s.cases || {}).forEach(function (id) {
      var vr = s.cases[id];
      if (vr.template === 'missing' && vr.alive === undefined) vr.alive = false;
      if (vr.foundAlive === undefined) vr.foundAlive = false;
    });
    // An accused keeps their sex, for the face the interface gives them (round 8): an older record's from its role or its name.
    Object.keys(s.cases || {}).forEach(function (id) {
      (s.cases[id].suspects || []).forEach(function (x) { if (x.sex === undefined) x.sex = P.sexOf(x.role) || P.sexOfName(x.name); });
    });
    // The Council counts each fortnight from Bailiff (round 8): an older save starts its count at the next Bell.
    if (s.councilCount === undefined) s.councilCount = null;
    // The Council's favour past the last office (round 8): an older save has been written no writ yet.
    if (typeof s.flags.favourStep !== 'number') s.flags.favourStep = 0;
    // The receiver of stolen goods (round 8): an older front is a band's; an older save past its first office has his door already.
    Object.keys(s.network.fronts || {}).forEach(function (k) { var fr = s.network.fronts[k]; if (fr.fence === undefined) fr.fence = false; if (fr.fallen === undefined) fr.fallen = false; });
    // A canvass before the count (round 8): an older save has canvassed nobody.
    if (s.flags.canvassed === undefined) s.flags.canvassed = null;
    // The wrong name's sex, for the mother at the door (round 8): an older record does not know it.
    Object.keys(s.criminals).forEach(function (k) { if (s.criminals[k].wrongfulTitle && s.criminals[k].wrongSex === undefined) s.criminals[k].wrongSex = null; });
    // The written mysteries come once a run (round 8): an older save has seen the ones on its record.
    if (!Array.isArray(s.flags.seenCases)) {
      s.flags.seenCases = [];
      Object.keys(s.cases || {}).forEach(function (id) { var t = s.cases[id].template; if ((CF.ONCE_CASES || []).indexOf(t) >= 0 && s.flags.seenCases.indexOf(t) < 0) s.flags.seenCases.push(t); });
    }
    // The Council election is asked a week ahead (round 8): an older save has answered nothing.
    if (s.flags.election === undefined) s.flags.election = null;
    // A patron's seal (round 8): an older save has been sent none, and gets one when Favour next reaches 3.
    if (!s.seals || typeof s.seals !== 'object') s.seals = {};
    // What each built room has done for you (round 8): an older save counts from now.
    if (!s.roomUse || typeof s.roomUse !== 'object') s.roomUse = {};
    if (!s.flags.hadInformer && Object.keys(s.cards).some(function (u) { return s.cards[u].def === 'informant'; })) s.flags.hadInformer = true;
    // Saves from before the verbs grew: the cards below the verb row move down with it.
    if (!s.version || s.version < 2) {
      var dy = T.TOP - 200;
      Object.keys(s.cards).forEach(function (u) { var c = s.cards[u]; if (c.loc && c.loc.t === 'table' && c.loc.y >= 200) c.loc.y += dy; });
      if (s.pile && s.pile.y >= 200) s.pile.y += dy;
      s.version = 2;
    }
    // Verbs folded into others since the save was written: their cards come back to the table.
    var alias = CF.VERB_ALIAS || {};
    Object.keys(s.verbs).forEach(function (id) {
      if (CF.VERBS[id]) return;
      var v = s.verbs[id];
      Object.keys(v.slots || {}).map(function (k) { return v.slots[k]; }).concat(v.held || [], v.out || []).forEach(function (uid) { var c = s.cards[uid]; if (c) c.loc = { t: 'table', x: 0, y: T.TOP }; });
      delete s.verbs[id];
    });
    if (s.flags && s.flags.dockOrder) s.flags.dockOrder = s.flags.dockOrder.map(function (v) { return alias[v] || v; });
    // Verbs added since the save was written.
    CF.VERB_ORDER.forEach(function (id) {
      if (!s.verbs[id]) s.verbs[id] = { id: id, status: 'idle', slots: {}, held: [], ctxSlots: {}, out: [], recipe: null,
        elapsed: 0, duration: 0, story: null, unlocked: CF.VERBS[id].rank <= (s.rank || 0) };
    });
    // Saves from the grid-table days stored a cell index instead of x/y;
    // cards whose definition has gone are dropped rather than crashing.
    for (var k in s.cards) {
      var c = s.cards[k];
      if (!CF.CARDS[c.def]) { delete s.cards[k]; continue; }
      if (c.loc && c.loc.t === 'table' && c.loc.cell !== undefined) {
        c.loc = { t: 'table', x: (c.loc.cell % T.COLS) * (T.CW + T.GAP), y: T.TOP + Math.floor(c.loc.cell / T.COLS) * (T.CH + T.GAP) };
      }
      delete c.lastCell;
    }
    // A verb only keeps the cards that still exist; a card a verb has forgotten goes back to the table.
    var live = function (uid) { return !!s.cards[uid]; };
    var toTable = function (uid) { var c = s.cards[uid]; if (c) c.loc = { t: 'table', x: 0, y: T.TOP }; };
    var ralias = CF.RECIPE_ALIAS || {};
    Object.keys(s.verbs).forEach(function (id) {
      var v = s.verbs[id];
      v.slots = v.slots || {}; v.ctxSlots = v.ctxSlots || {}; v.held = (v.held || []).filter(live); v.out = (v.out || []).filter(live);
      Object.keys(v.slots).forEach(function (k) { if (!live(v.slots[k])) delete v.slots[k]; });
      Object.keys(v.ctxSlots).forEach(function (k) { if (!live(v.ctxSlots[k])) delete v.ctxSlots[k]; });
      if (v.ask && v.ask.filled && !live(v.ask.filled)) v.ask.filled = null;
      // A way renamed since the save was written: follow it. One gone for good gives its cards back and the verb goes idle.
      if (v.recipe && !CF.RECIPES_BY_ID[v.recipe] && ralias[v.recipe]) v.recipe = ralias[v.recipe];
      if (v.status === 'running' && !CF.RECIPES_BY_ID[v.recipe]) {
        v.held.forEach(toTable);
        v.held = []; v.ctxSlots = {}; v.ask = null; v.recipe = null; v.status = 'idle'; v.elapsed = 0; v.duration = 0;
      }
    });
    Object.keys(s.cards).forEach(function (u) {
      var c = s.cards[u], loc = c.loc, v = loc && loc.verb && s.verbs[loc.verb];
      if (!loc || loc.t === 'table') return;
      var kept = v && ((loc.t === 'slot' && v.slots[loc.slot] === c.uid) || (loc.t === 'held' && v.held.indexOf(c.uid) >= 0) || (loc.t === 'out' && v.out.indexOf(c.uid) >= 0));
      if (!kept) toTable(c.uid);
    });
    // The calling's own question (callings.js) is kept with the city's.
    if (CF.Callings && CF.Callings.register) CF.Callings.register();
    if (CF.Patrons && CF.Patrons.register) CF.Patrons.register();
    // A question the city no longer asks, or a hook left from an older hour, is dropped.
    if (s.choice && !(CF.CHOICES || []).some(function (c) { return c.id === s.choice.id; })) s.choice = null;
    // A question still asked: its answers as the city words them now (a free way out added since is shown, and choose(i) runs what is shown).
    if (s.choice) {
      var cspec = CF.CHOICES.filter(function (c) { return c.id === s.choice.id; })[0];
      s.choice.options = Engine.choiceOptions(cspec);
    }
    if (s.choiceHook && !(s.t - s.choiceHook.t <= 6)) s.choiceHook = null;
    var e = new Engine(s);
    e.initPaths();
    // An older save past its first office has the receiver's door already (round 8).
    if ((s.rank || 0) >= 1 && e.seedFence) e.seedFence();
    e.layoutVerbs();
    // A file finished before the ending told what became of them (round 8): told from what it kept.
    if (s.over && s.over.epilogue === undefined) s.over.epilogue = e.epilogue();
    // A save stranded by an opening case that went cold, or was lost before the desk was kept
    // on a loss (round 8): the desk is given now, with the Bell and the city's clock.
    if (s.flags.opening && s.flags.stage === 'hired' && !s.over && !Object.keys(s.cases || {}).some(function (k) { var r = s.cases[k]; return r.opening && (r.status === 'open' || r.status === 'trial'); })) {
      e.openingLost(null, 'cold');
    }
    // Verbs and cards from older saves may sit off the table, or on each other: bring them back onto it.
    CF.VERB_ORDER.forEach(function (id) {
      var v = s.verbs[id];
      if (!v.unlocked || v.x === undefined) return;
      var q = e.clampToTable(v.x, v.y, T.VW, T.VH), obs = e.obstacles(null, id);
      if (q.x === v.x && q.y === v.y && isFree({ x: q.x, y: q.y, w: T.VW, h: T.VH }, obs)) return; // where it was, and clear
      var p = e.nearestFree(q.x, q.y, T.VW, T.VH, obs);
      v.x = p.x; v.y = p.y;
    });
    e.tableCards().forEach(function (c) { var q = e.clampToTable(c.loc.x, c.loc.y, T.CW, T.CH); c.loc.x = q.x; c.loc.y = q.y; });
    return e;
  };

  // A small steady hash of a string, for a choice that must not draw on the rng.
  Engine.nameHash = function (str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 1000003;
    return h;
  };
  // The answers a question shows, as offerChoice stores them in the save.
  Engine.choiceOptions = function (spec) {
    return (spec.options || []).map(function (o) { return { label: o.label, text: o.text, cost: o.cost || null, gain: o.gain || null, forGood: !!o.forGood }; });
  };
  // How many the Examiner has sent home, from the criminal records: a pardon
  // or a fine in their history, or a citizen now.
  Engine.sentHomeOf = function (s) {
    var n = 0, crim = s.criminals || {};
    Object.keys(crim).forEach(function (k) {
      var c = crim[k];
      var home = (c.history || []).filter(function (h) { return h.how === 'sentence:pardon' || h.how === 'sentence:fine'; }).length;
      n += Math.max(home, c.status === 'reformed' ? 1 : 0);
    });
    return n;
  };

  P.save = function () {
    this.s.rng = this.rng.getState();
    return JSON.stringify(this.s);
  };

  P.on = function (fn) { this.listeners.push(fn); };
  P.emit = function (type, payload) {
    this.dirty = true;
    this.listeners.forEach(function (fn) { fn(type, payload); });
  };

  // ---- Journal ------------------------------------------------------------
  function storyCue(title) {
    if (/^Lost: /.test(title)) return 'harm';
    for (var k in CF.NEEDS || {}) if (CF.CARDS[k] && CF.CARDS[k].label === title) return 'need';
    return null;
  }
  // A 'danger' story carries a cue for how loud it lands (the UI reads entry.cue):
  //   'harm'   a body hurt: yours or a watchman's (the alarm and the shake)
  //   'need'   a need arrives (a heartbeat)
  //   'quiet'  the verdict or the scene says it already (no cue of its own)
  //   none     every other bad news (an omen)
  // A need's arrival and an ability lost to one are known by their titles.
  // The text may be a list of sentences, each one whole for a translation:
  // the entry keeps them as entry.parts (the UI translates each on its own
  // and joins them with a space) and their join as entry.text.
  P.story = function (title, text, kind, opts) {
    var parts = Array.isArray(text) ? text.filter(function (x) { return !!x; }) : null;
    var entry = { t: this.s.t, week: this.s.week, title: title, text: parts ? parts.join(' ') : text, kind: kind || 'event' };
    if (parts) entry.parts = parts;
    var cue = opts && opts.cue;
    if (!cue && kind === 'danger') cue = storyCue(title);
    if (cue) entry.cue = cue;
    // The card the story is about, for the toast to take you to (the Fever, say).
    if (opts && opts.uid) entry.uid = opts.uid;
    // The Bell's week: whether the dues were met, and the stipend's new Coin
    // (for the interface to toll a cracked bell, and to fly them out of the Bell).
    if (opts && opts.paid !== undefined) entry.paid = !!opts.paid;
    if (opts && opts.uids) entry.uids = opts.uids.slice();
    // The Bell's week: the season it fell in (CF.SEASONS), for the week bar.
    if (opts && opts.season) entry.season = opts.season;
    this.s.journal.unshift(entry);
    if (this.s.journal.length > 300) this.s.journal.length = 300;
    this.emit('story', entry);
    return entry;
  };

  // ---- Card creation and placement ---------------------------------------
  P.def = function (card) { return CF.CARDS[card.def]; };
  P.card = function (uid) { return this.s.cards[uid]; };

  // Build a card object without placing it.
  P.make = function (defId, spec) {
    var def = CF.CARDS[defId];
    if (!def) throw new Error('Unknown card def ' + defId);
    spec = spec || {};
    var card = { uid: this.s.nextUid++, def: defId, data: spec.data || {}, fresh: true };
    if (spec.label) card.label = spec.label;
    if (spec.desc) card.desc = spec.desc;
    if (spec.aspects) card.aspects = spec.aspects;
    if (spec.tags) card.tags = spec.tags.slice();
    if (spec.image) card.image = spec.image;
    if (spec.caseId) card.caseId = spec.caseId;
    var life = spec.lifetime !== undefined ? spec.lifetime : spec.decay !== undefined ? spec.decay : def.lifetime;
    if (life) { card.life = life; card.maxLife = life; }
    // Fields a save fills on load are filled when the card is made, so a save round-trips.
    if (defId === 'informant') this.s.flags.hadInformer = true;   // a first that stays ticked when the informer is gone
    if (defId === 'atlarge' && card.data.innocent === undefined) card.data.innocent = false;
    this.s.cards[card.uid] = card;
    return card;
  };

  // Create a card directly on the table.
  P.create = function (defId, spec, prefer) {
    var card = this.make(defId, spec);
    if (defId === 'witness' && card.life && this.perkHas('longmemory')) { card.life = Math.round(card.life * 1.5); card.maxLife = card.life; }
    // The Rival keeps the week and the road of the last thread pulled from the first day, as
    // Engine.load gives an older card, so a save written the week one arrives round-trips.
    if (defId === 'rival') {
      var rd = card.data = card.data || {};
      if (typeof rd.heatWeek !== 'number') rd.heatWeek = -1;
      if (rd.heatHow === undefined) rd.heatHow = null;
      if (rd.eyes === undefined) rd.eyes = null;
    }
    this.placeOnTable(card, prefer);
    this.dirty = true;
    return card;
  };

  // Turn a card into another card in place: same uid, same spot on the table
  // (or the same slot). Used when evidence becomes a clue, a witness becomes
  // a suspect, a case goes cold...
  P.transform = function (card, defId, spec) {
    if (typeof card === 'number') card = this.card(card);
    var def = CF.CARDS[defId];
    if (!card || !def) throw new Error('Cannot transform into ' + defId);
    spec = spec || {};
    card.def = defId;
    // The player's own Mark stays on the card through whatever it becomes
    // (spent, restored, a witness turned suspect): copied, not set on a shared spec.
    var marked = card.data && card.data.mark;
    card.data = spec.data || {};
    if (marked) { var kept = {}; for (var dk in card.data) kept[dk] = card.data[dk]; kept.mark = true; card.data = kept; }
    ['label', 'desc', 'aspects', 'tags', 'image', 'caseId'].forEach(function (k) {
      if (spec[k] !== undefined) card[k] = k === 'tags' ? spec[k].slice() : spec[k]; else delete card[k];
    });
    var life = spec.lifetime !== undefined ? spec.lifetime : spec.decay !== undefined ? spec.decay : def.lifetime;
    if (life) { card.life = life; card.maxLife = life; } else { delete card.life; delete card.maxLife; }
    card.fresh = true;
    this.dirty = true;
    return card;
  };

  // The verbs this card could go into right now: unlocked, not running, not
  // locked, with any slot (visible now or once a primary is placed) that
  // takes it. A card that fits nowhere is shown as unavailable on the board.
  // Could this slot open at all: it is the primary, or something that could
  // be the verb's primary (in it now, or on the table) would open it.
  // A render pass may set `this._memo = {}` (or run inside withMemo) while
  // nothing changes the state: slot reach and verb locks are then asked once
  // per pass, not once per card. Unset, nothing is remembered.
  P.withMemo = function (fn) {
    if (this._memo) return fn.call(this);
    this._memo = {};
    try { return fn.call(this); } finally { this._memo = null; }
  };
  P.slotReachable = function (vid, sl) {
    if (sl.primary || !sl.when) return true;
    var memo = this._memo;
    if (!memo) return this.slotReachableNow(vid, sl);
    var key = 'r|' + vid + '|' + sl.key;
    if (!(key in memo)) memo[key] = this.slotReachableNow(vid, sl);
    return memo[key];
  };
  P.slotReachableNow = function (vid, sl) {
    var v = this.verb(vid), def = CF.VERBS[vid], pk = this.primaryKey(vid);
    var held = v.slots[pk] ? this.card(v.slots[pk]) : null;
    if (held) return !!sl.when(held);
    var main = def.slots.filter(function (x) { return x.primary; })[0];
    var self = this;
    return this.tableCards().some(function (c) { return self.slotAccepts(main, c) && sl.when(c); });
  };
  P.usableIn = function (card) {
    var self = this, out = [];
    CF.VERB_ORDER.forEach(function (vid) {
      var v = self.verb(vid), def = CF.VERBS[vid];
      if (!v || !v.unlocked || def.auto || v.status === 'running' || self.lockReason(vid)) return;
      if (def.slots.some(function (sl) { return self.slotAccepts(sl, card) && self.slotReachable(vid, sl); })) out.push(vid);
    });
    return out;
  };

  // Does any unlocked verb have a slot that takes this card at all (ignoring
  // whether it is busy or locked right now)?
  P.fitsAny = function (card) {
    var self = this;
    return CF.VERB_ORDER.some(function (vid) {
      var v = self.verb(vid), def = CF.VERBS[vid];
      return v && v.unlocked && !def.auto && def.slots.some(function (sl) { return self.slotAccepts(sl, card) && self.slotReachable(vid, sl); });
    });
  };
  // Why a card cannot be used right now, or null if it can (or never could).
  // The running verb whose open ask this card answers, if any.
  P.askedBy = function (card) {
    for (var i = 0; i < CF.VERB_ORDER.length; i++) if (this.askAccepts(CF.VERB_ORDER[i], card)) return CF.VERB_ORDER[i];
    return null;
  };
  P.unavailableReason = function (card) {
    if (this.usableIn(card).length || !this.fitsAny(card) || this.askedBy(card)) return null;
    var self = this, locked = CF.VERB_ORDER.filter(function (vid) {
      var v = self.verb(vid);
      return v && v.unlocked && self.lockReason(vid) && CF.VERBS[vid].slots.some(function (sl) { return self.slotAccepts(sl, card); });
    });
    if (locked.length) return this.lockReason(locked[0]);
    return 'Everything that takes this is busy.';
  };

  P.labelOf = function (card) { return card.label || this.def(card).label; };
  P.descOf = function (card) { return card.desc || this.def(card).desc; };
  // What a card's face says, read without the DOM (the interface and the
  // language test both ask). A token's face is the head of its label, read
  // through a status (a kept Warning is a Warning, with a seal), and the
  // status comes back as a seal for a small mark; a person's face is the
  // name; a case's, its short title. Both strings are English: the
  // interface translates them.
  CF.FACE_SHORTS = [
    [/^Word from /, 'A Word'], [/^Rumour from /, 'A Rumour'], [/^Sighting: |^Seen at /, 'A Sighting'], [/^Found at .*Lodging$/, 'The Lodging'],
    [/^Found at .*House$/, 'The House'], [/^Thread: /, 'A Thread'], [/^Blood Court: /, 'The Blood Court'],
    [/^Confession Under the Question: /, 'The Question'], [/^Unanswered: /, 'Unanswered'], [/^The Hand Matched: /, 'The Hand Matched'],
    [/^The Mark at /, 'The Mark'],
  ];
  CF.FACE_SEALS = ['Kept', 'Matched', 'Partial', 'Corroborated'];
  var FACE_PERSONS = { witness: 1, suspect: 1, informant: 1, atlarge: 1, condemned: 1, teammate: 1, hospital: 1, injured: 1, personnel: 1 };
  P.cardFace = function (card) {
    var def = this.def(card), label = this.labelOf(card), seal = null;
    if (def.kind === 'case') { var rec = this.caseRec(card.caseId); return { title: (rec && rec.highProfile ? '★ ' : '') + (rec ? rec.short : label), seal: null }; }
    if (!FACE_PERSONS[card.def]) {
      for (var guard = 0; guard < 3; guard++) {
        var at0 = label.indexOf(': ');
        if (at0 < 0 || CF.FACE_SEALS.indexOf(label.slice(0, at0)) < 0) break;
        seal = seal || label.slice(0, at0);
        label = label.slice(at0 + 2);
      }
    }
    for (var i = 0; i < CF.FACE_SHORTS.length; i++) if (CF.FACE_SHORTS[i][0].test(label)) return { title: CF.FACE_SHORTS[i][1], seal: seal };
    var at = label.indexOf(': ');
    if (at < 0) return { title: label, seal: seal };
    var head = label.slice(0, at), tail = label.slice(at + 2);
    if (FACE_PERSONS[card.def]) return { title: (head === 'Prime Suspect' ? '★ ' : '') + tail, seal: seal };
    if (card.def === 'order' || card.def === 'personnel' || def.kind === 'calling' || card.def === 'gang') return { title: tail, seal: seal };
    return { title: head, seal: seal };
  };
  P.kindOf = function (card) { return this.def(card).kind; };
  P.stackKey = function (card) {
    var d = card.data || {};
    return [card.def, this.labelOf(card), card.caseId || '', JSON.stringify(card.aspects || ''), d.name || '', d.order || '', d.district || '', d.rung || '', d.mark ? 'm' : ''].join('|');
  };

  P.tableCards = function () {
    var out = [];
    for (var k in this.s.cards) if (this.s.cards[k].loc && this.s.cards[k].loc.t === 'table') out.push(this.s.cards[k]);
    return out;
  };

  // ---- Board geometry ------------------------------------------------------
  function overlaps(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  }
  P.cardRect = function (c) { return { x: c.loc.x, y: c.loc.y, w: T.CW, h: T.CH }; };
  P.verbRect = function (v) { return { x: v.x, y: v.y, w: T.VW, h: T.VH }; };

  // Everything on the board that a placement must not cover. `skip` is a
  // predicate for cards/verbs that are moving (and so don't count).
  P.obstacles = function (skipCard, skipVerb) {
    var out = [], seen = {};
    var self = this;
    this.tableCards().forEach(function (c) {
      if (skipCard && skipCard(c)) return;
      var k = c.loc.x + ',' + c.loc.y;
      if (seen[k]) return;
      seen[k] = true;
      out.push(self.cardRect(c));
    });
    for (var id in this.s.verbs) {
      if (!T.verbsOnBoard) break; // the verbs live in the dock, not on the felt
      var v = this.s.verbs[id];
      if (!v.unlocked || v.x === undefined || id === skipVerb) continue;
      out.push(this.verbRect(v));
    }
    return out;
  };

  function inside(r) { var B = T.BOUNDS; return r.x >= B.x && r.y >= B.y && r.x + r.w <= B.x + B.w && r.y + r.h <= B.y + B.h; }
  P.clampToTable = function (x, y, w, h) {
    var B = T.BOUNDS;
    return { x: U.clamp(Math.round(x), B.x, B.x + B.w - w), y: U.clamp(Math.round(y), B.y, B.y + B.h - h) };
  };
  function isFree(r, obs) {
    if (!inside(r)) return false;
    for (var i = 0; i < obs.length; i++) if (overlaps(r, obs[i])) return false;
    return true;
  }

  // The free spot closest to (x, y) for a w x h footprint.
  // The table is a grid of card-sized cells; every card sits in one.
  T.PILE_COLS = 6;
  // The grid's pitch follows the card spacing (Settings: Card spacing).
  T.setGap = function (gap) { T.GAP = gap; T.PX = T.CW + T.GAP; T.PY = T.CH + T.GAP; };
  T.setGap(T.GAP);
  T.snap = true; // cards settle on the grid's cells (Settings: Snap to grid)
  function snap(x, y) {
    return { x: Math.round(x / T.PX) * T.PX, y: T.TOP + Math.round((y - T.TOP) / T.PY) * T.PY };
  }
  CF.snapGrid = snap;
  P.nearestFree = function (x, y, w, h, obs) {
    var g = T.snap ? snap(x, y) : { x: x, y: y };
    var p = this.clampToTable(g.x, g.y, w, h);
    x = p.x; y = p.y;
    if (isFree({ x: x, y: y, w: w, h: h }, obs)) return { x: x, y: y };
    var sx = T.snap ? T.PX : 12, sy = T.snap ? T.PY : 12;
    for (var r = 1; r <= (T.snap ? 30 : 90); r++) {
      var best = null, bestD = Infinity;
      for (var i = -r; i <= r; i++) {
        var pts = [[i, -r], [i, r], [-r, i], [r, i]];
        for (var j = 0; j < 4; j++) {
          var px = x + pts[j][0] * sx, py = y + pts[j][1] * sy;
          var d = (px - x) * (px - x) + (py - y) * (py - y);
          if (d < bestD && isFree({ x: px, y: py, w: w, h: h }, obs)) { best = { x: px, y: py }; bestD = d; }
        }
      }
      if (best) return best;
    }
    return this.layoutSpot(0, w, h, obs);
  };

  // The first free slot in the automatic layout, from a given row down.
  P.layoutSpot = function (row, w, h, obs) {
    for (var r = row; r < row + 200; r++) {
      for (var c = 0; c < T.COLS; c++) {
        var p = { x: c * (T.CW + T.GAP), y: T.TOP + r * (T.CH + T.GAP), w: w, h: h };
        if (isFree(p, obs)) return { x: p.x, y: p.y };
      }
    }
    return { x: 0, y: T.TOP };
  };

  // The stack a card would join: another table card with the same stack key.
  P.stackFor = function (card, near) {
    var key = this.stackKey(card);
    if (!key) return null;
    var best = null, bestD = Infinity;
    var self = this;
    this.tableCards().forEach(function (c) {
      if (c === card || self.stackKey(c) !== key) return;
      if (near) {
        var r = self.cardRect(c);
        if (!overlaps(r, { x: near.x + T.CW * 0.3, y: near.y + T.CH * 0.3, w: T.CW * 0.4, h: T.CH * 0.4 })) return;
      }
      var d = near ? Math.abs(c.loc.x - near.x) + Math.abs(c.loc.y - near.y) : 0;
      if (d < bestD) { best = c; bestD = d; }
    });
    return best;
  };

  // The other cards sharing this card's stack.
  P.stackOf = function (card) {
    if (!card.loc || card.loc.t !== 'table') return [card];
    var key = this.stackKey(card);
    if (!key) return [card];
    var self = this;
    return this.tableCards().filter(function (c) { return c.loc.x === card.loc.x && c.loc.y === card.loc.y && self.stackKey(c) === key; });
  };

  // The collection pile: a strip on the table where everything new lands.
  // The player can move it. New cards fill it left to right, then the row
  // below, unless a stack of their kind already waits somewhere.
  P.pile = function () {
    if (!this.s.pile) this.s.pile = { x: 0, y: T.TOP + 2 * T.PY };
    return this.s.pile;
  };
  P.movePile = function (x, y) {
    var p = this.clampToTable(x, y, T.PILE_COLS * T.PX, T.CH);
    if (T.snap) p = this.clampToTable(snap(p.x, p.y).x, snap(p.x, p.y).y, T.PILE_COLS * T.PX, T.CH);
    this.s.pile = { x: p.x, y: p.y };
    this.dirty = true;
  };
  P.pileSpot = function (obs) {
    var pile = this.pile();
    for (var r = 0; r < 6; r++) {
      for (var c = 0; c < T.PILE_COLS; c++) {
        var p = { x: pile.x + c * T.PX, y: pile.y + r * T.PY, w: T.CW, h: T.CH };
        if (isFree(p, obs)) return { x: p.x, y: p.y };
      }
    }
    return this.nearestFree(pile.x, pile.y, T.CW, T.CH, obs);
  };
  // Put a card on the table: join its stack wherever it is, else the spot
  // asked for (or the one it last had), else the collection pile.
  P.placeOnTable = function (card, prefer) {
    card.loc = null;
    var join = this.stackFor(card);
    if (join) { card.loc = { t: 'table', x: join.loc.x, y: join.loc.y }; return; }
    if (!prefer && card.lastPos) prefer = card.lastPos;
    var obs = this.obstacles(function (c) { return c === card; });
    var p = prefer ? this.nearestFree(prefer.x, prefer.y, T.CW, T.CH, obs) : this.pileSpot(obs);
    card.loc = { t: 'table', x: p.x, y: p.y };
  };

  // A card that changed while it lay in a stack (a token spoiled, a mark read)
  // is not its neighbours' twin any more: it takes a spot of its own nearby.
  P.settleStacks = function () {
    var self = this, at = {};
    this.tableCards().sort(function (a, b) { return a.uid - b.uid; }).forEach(function (c) {
      var pk = c.loc.x + ',' + c.loc.y, key = self.stackKey(c);
      if (!at[pk]) { at[pk] = key; return; }
      if (at[pk] === key) return;
      var p = self.nearestFree(c.loc.x, c.loc.y, T.CW, T.CH, self.obstacles(function (o) { return o === c; }));
      c.loc = { t: 'table', x: p.x, y: p.y };
      at[p.x + ',' + p.y] = key;
      self.dirty = true;
    });
  };

  // Drop a card (or its whole stack) at a board position. Dropping a stackable
  // card onto its own kind joins that stack; otherwise it settles at the
  // nearest free spot. Returns the final position.
  P.moveCard = function (uid, x, y, wholeStack) {
    var card = this.card(uid);
    if (!card || !card.loc || card.loc.t !== 'table') return null;
    var moving = wholeStack ? this.stackOf(card) : [card];
    var join = this.stackFor(card, { x: x, y: y });
    if (join && moving.indexOf(join) >= 0) join = null;
    var p;
    if (join) p = { x: join.loc.x, y: join.loc.y };
    else {
      var obs = this.obstacles(function (c) { return moving.indexOf(c) >= 0; });
      p = this.nearestFree(x, y, T.CW, T.CH, obs);
    }
    moving.forEach(function (c) { c.loc = { t: 'table', x: p.x, y: p.y }; });
    this.dirty = true;
    return p;
  };

  P.moveVerb = function (vid, x, y) {
    var v = this.verb(vid);
    if (!v || !v.unlocked) return null;
    var p = this.nearestFree(x, y, T.VW, T.VH, this.obstacles(null, vid));
    v.x = p.x; v.y = p.y;
    this.dirty = true;
    return p;
  };

  // Give every unlocked verb a place on the board (a row along the top).
  P.layoutVerbs = function () {
    var self = this;
    CF.VERB_ORDER.forEach(function (id) {
      var v = self.s.verbs[id];
      if (!v.unlocked || v.x !== undefined) return;
      var obs = self.obstacles(null, id);
      for (var i = 0; i < 40; i++) {
        var r = { x: i * (T.VW + T.GAP), y: 0, w: T.VW, h: T.VH };
        if (isFree(r, obs)) { v.x = r.x; v.y = r.y; return; }
      }
      var p = self.nearestFree(0, 0, T.VW, T.VH, obs);
      v.x = p.x; v.y = p.y;
    });
  };

  // Detach a card from wherever it currently sits (table, slot, verb).
  P.detach = function (card) {
    var loc = card.loc;
    if (!loc) return;
    if (loc.t === 'table') card.lastPos = { x: loc.x, y: loc.y };
    var v = loc.verb ? this.s.verbs[loc.verb] : null;
    if (loc.t === 'slot' && v && v.slots[loc.slot] === card.uid) {
      delete v.slots[loc.slot];
      // The subject gone, its secondaries go back to the table.
      if (loc.slot === this.primaryKey(loc.verb)) this.pruneSlots(loc.verb);
    }
    if (loc.t === 'held' && v) {
      v.held = v.held.filter(function (u) { return u !== card.uid; });
      for (var k in v.ctxSlots) if (v.ctxSlots[k] === card.uid) delete v.ctxSlots[k];
    }
    if (loc.t === 'out' && v) {
      v.out = v.out.filter(function (u) { return u !== card.uid; });
      // The last output gone, however it went (taken, spent, paid at the Bell): the verb is free again.
      if (!v.out.length && v.status === 'done') { v.status = 'idle'; v.story = null; }
    }
    card.loc = null;
  };

  // How a card leaves, for the interface to show it (round 8): 'lost' an
  // ability gone for good, 'faded' a token gone stale, 'left' a person or a
  // purse gone from the city, 'spent' Coin paid out, 'wounded' Health taken
  // by a blow. P.remove(card, why) emits 'gone' { uid, def, why } just before
  // the card goes; without a why, Coin is 'spent' and Health, Wit or Instinct
  // removed whole is 'lost' (spending one transforms it, and is not a removal).
  // 'none' says nothing.
  CF.GONE_DEFAULT = { funds: 'spent', health: 'lost', focus: 'lost', instinct: 'lost' };
  P.remove = function (card, why) {
    if (typeof card === 'number') card = this.card(card);
    if (!card || !this.s.cards[card.uid]) return;
    var gone = why || CF.GONE_DEFAULT[card.def];
    if (gone && gone !== 'none') this.emit('gone', { uid: card.uid, def: card.def, why: gone });
    // A card taken out of a running verb's hands (a charge clears its case, a case goes cold):
    // the verb remembers what it lost, to say so when it finishes.
    var hv = card.loc && card.loc.t === 'held' && this.s.verbs[card.loc.verb];
    if (hv && hv.status === 'running' && !hv.lost) hv.lost = { label: this.labelOf(card), caseId: card.caseId || null };
    this.detach(card);
    delete this.s.cards[card.uid];
    this.dirty = true;
  };

  // Every card of a def, anywhere except inside a running verb.
  P.cardsOf = function (defId, includeHeld) {
    var out = [];
    for (var k in this.s.cards) {
      var c = this.s.cards[k];
      if (c.def === defId && c.loc && (includeHeld || c.loc.t !== 'held')) out.push(c);
    }
    return out;
  };
  P.countOf = function (defId) { return this.cardsOf(defId).length; };
  P.cardsWith = function (aspect) {
    var out = [];
    for (var k in this.s.cards) {
      var c = this.s.cards[k];
      if (c.loc && CF.aspectsOf(c)[aspect] > 0) out.push(c);
    }
    return out;
  };

  // ---- Meters ------------------------------------------------------------
  P.meterMax = function (name) {
    if (name === 'scrutiny' && this.s.origin === 'crusader') return 12;
    if (name === 'reputation') return 99;
    return 10;
  };
  // The city remembers: Dread fades at the Bell, but not below one step for
  // every three Cruelties, up to seven (the UI's Dread info reads this).
  CF.DREAD_FLOOR = { per: 3, max: 7 };
  P.dreadFloor = function () {
    var cruelty = (this.s.counts && this.s.counts.cruelty) || 0;
    return Math.min(CF.DREAD_FLOOR.max, Math.floor(cruelty / CF.DREAD_FLOOR.per));
  };
  P.meter = function (name, delta) {
    var m = this.s.meters;
    m[name] = U.clamp((m[name] || 0) + delta, 0, this.meterMax(name));
    this.dirty = true;
  };
  // The counts on the Calling card that never go down: Cruelty, Mercy, Purse.
  P.count = function (name, delta) {
    var c = this.s.counts || (this.s.counts = { cruelty: 0, mercy: 0, purse: 0, debt: 0 });
    c[name] = (c[name] || 0) + (delta === undefined ? 1 : delta);
    this.dirty = true;
  };

  // The Carolina's threshold for the question: indicia in the case that
  // amount to half proof. Two tokens of different kinds, or one word from a
  // witness who spoke against their own interest.
  P.indiciaOf = function (rec) {
    var seen = {}, n = 0, against = false;
    for (var k in this.s.cards) {
      var c = this.s.cards[k];
      if (c.caseId !== rec.id || (c.def !== 'clue' && c.def !== 'evidence') || !c.loc) continue;
      if (c.def === 'clue' && c.data.misread) continue;
      n++;
      var a = CF.clueAspects(c);
      for (var x in a) if (a[x]) seen[x] = true;
      if (c.data.againstInterest) against = true;
    }
    var kinds = Object.keys(seen).length;
    return { n: n, kinds: kinds, against: against, sufficient: kinds >= 2 || against };
  };

  // ---- Verbs --------------------------------------------------------------
  P.verb = function (id) { return this.s.verbs[CF.VERB_ALIAS && CF.VERB_ALIAS[id] || id]; };

  P.primaryKey = function (verbId) {
    verbId = CF.VERB_ALIAS && CF.VERB_ALIAS[verbId] || verbId;
    var slots = CF.VERBS[verbId].slots;
    for (var i = 0; i < slots.length; i++) if (slots[i].primary) return slots[i].key;
    return null;
  };

  P.visibleSlots = function (verbId) {
    verbId = CF.VERB_ALIAS && CF.VERB_ALIAS[verbId] || verbId;
    var v = this.verb(verbId);
    var def = CF.VERBS[verbId];
    var src = v.status === 'running' ? v.ctxSlots : v.slots;
    var primary = src[this.primaryKey(verbId)];
    var pc = primary ? this.card(primary) : null;
    return def.slots.filter(function (sl) { return sl.primary || (sl.when && sl.when(pc)); });
  };

  // A slot takes a card carrying one of its aspects; a slot with `fits`
  // takes only the cards that pass it as well (the Rival's own work).
  P.slotAccepts = function (slot, card) {
    var a = CF.aspectsOf(card);
    for (var i = 0; i < slot.accepts.length; i++) if (a[slot.accepts[i]] > 0) return !slot.fits || !!slot.fits(card, this);
    return false;
  };

  P.lockReason = function (verbId) {
    var memo = this._memo;
    if (!memo) return this.lockReasonNow(verbId);
    var key = 'l|' + verbId;
    if (!(key in memo)) memo[key] = this.lockReasonNow(verbId);
    return memo[key];
  };
  P.lockReasonNow = function (verbId) {
    verbId = CF.VERB_ALIAS && CF.VERB_ALIAS[verbId] || verbId;
    var def = CF.VERBS[verbId];
    if (def.lockedBy === 'burnout' && this.countOf('burnout') > 0) return 'The fever has you. Sleep it off in Rest first.';
    return null;
  };

  // Put a table card into a verb slot. Returns true on success.
  P.slotCard = function (verbId, slotKey, uid) {
    verbId = CF.VERB_ALIAS && CF.VERB_ALIAS[verbId] || verbId;
    var v = this.verb(verbId);
    var card = this.card(uid);
    if (!v || !card || !v.unlocked || CF.VERBS[verbId].auto) return false;
    if (v.status === 'done') this.collect(verbId);
    if (v.status !== 'idle') return false;
    if (!card.loc || (card.loc.t !== 'table' && card.loc.t !== 'slot')) return false;
    var slot = null;
    var slots = CF.VERBS[verbId].slots;
    var isPrimary = slotKey === this.primaryKey(verbId);
    for (var i = 0; i < slots.length; i++) if (slots[i].key === slotKey) slot = slots[i];
    if (!slot || !this.slotAccepts(slot, card)) return false;
    if (!isPrimary && !this.visibleSlots(verbId).some(function (sl) { return sl.key === slotKey; })) return false;
    if (card.loc.t === 'slot' && card.loc.verb === verbId && card.loc.slot === slotKey) return true;
    var existing = v.slots[slotKey];
    if (existing) this.unslot(verbId, slotKey);
    this.detach(card);
    card.loc = { t: 'slot', verb: verbId, slot: slotKey };
    card.fresh = false;
    v.story = null;
    v.slots[slotKey] = uid;
    if (isPrimary) this.pruneSlots(verbId);
    this.dirty = true;
    return true;
  };

  // Find the best slot for a card dropped on a verb token.
  P.autoSlot = function (verbId, uid) {
    verbId = CF.VERB_ALIAS && CF.VERB_ALIAS[verbId] || verbId;
    var v = this.verb(verbId);
    var card = this.card(uid);
    if (!v || !card || !v.unlocked || CF.VERBS[verbId].auto) return null;
    if (v.status === 'done') this.collect(verbId);
    if (v.status !== 'idle') return null;
    var pk = this.primaryKey(verbId);
    var pslot = CF.VERBS[verbId].slots[0];
    if (!v.slots[pk] && this.slotAccepts(pslot, card)) return this.slotCard(verbId, pk, uid) ? pk : null;
    var vis = this.visibleSlots(verbId);
    for (var i = 0; i < vis.length; i++) {
      var sl = vis[i];
      if (!sl.primary && !v.slots[sl.key] && this.slotAccepts(sl, card)) return this.slotCard(verbId, sl.key, uid) ? sl.key : null;
    }
    if (this.slotAccepts(pslot, card)) return this.slotCard(verbId, pk, uid) ? pk : null;
    return null;
  };

  P.unslot = function (verbId, slotKey) {
    verbId = CF.VERB_ALIAS && CF.VERB_ALIAS[verbId] || verbId;
    var v = this.verb(verbId);
    var uid = v.slots[slotKey];
    if (!uid) return;
    var card = this.card(uid);
    delete v.slots[slotKey];
    if (card) { card.loc = null; this.placeOnTable(card); }
    if (slotKey === this.primaryKey(verbId)) this.pruneSlots(verbId);
    this.dirty = true;
  };

  // Return cards in slots that are no longer visible.
  P.pruneSlots = function (verbId) {
    var v = this.verb(verbId);
    var vis = {};
    this.visibleSlots(verbId).forEach(function (sl) { vis[sl.key] = true; });
    for (var k in v.slots) if (!vis[k]) this.unslot(verbId, k);
  };

  // A card of another case never joins this one's work: the magnet and the
  // asks leave it. Cards of no case (your faculties, the Watch) are free.
  P.sameCaseAs = function (primary, card) {
    return !primary || !primary.caseId || !card.caseId || card.caseId === primary.caseId;
  };
  // Where a case's trail goes next, for the search preview and the advisor:
  //   searchedOut  the scene has given up every item (another search is an Obsession)
  //   neighbour    a young office's re-search can still bring a name from the gate
  //   canvass      { district: uid, quarter: label } when the case's own Quarter
  //                lies on the table and someone there has not yet been met
  P.trailFor = function (rec) {
    if (!rec) return null;
    var unnamed = rec.suspects.some(function (x) { return !x.revealed && !x.cleared; });
    var d = this.tableCards().filter(function (c) { return c.def === 'district' && c.data && c.data.district === rec.district; })[0];
    return {
      searchedOut: rec.found >= rec.items.length,
      // Every door knocked: no witness left to find and nobody left to name.
      canvassedOut: !(rec.witnesses || []).length && !unnamed,
      neighbour: rec.found >= rec.items.length && this.s.rank <= 1 && unnamed,
      canvass: d && ((rec.witnesses || []).length || unnamed) ? { district: d.uid, quarter: CF.DISTRICTS[rec.district] ? CF.DISTRICTS[rec.district].label : this.labelOf(d) } : null,
    };
  };

  // The magnet: fill the verb's empty slots from the table with cards that
  // fit them. The subject (the primary slot) is always the player's choice.
  // Its own case's tokens come first. Against an Accused it leaves every
  // token that speaks for somebody else (an alibi, another's mark, trait or
  // words), and takes first what fills a row of the charge still empty, then
  // what points at them, then the oldest. Returns what it pulled, in the
  // order it pulled it.
  P.magnetCandidates = function (verbId) {
    verbId = CF.VERB_ALIAS && CF.VERB_ALIAS[verbId] || verbId;
    var self = this, v = this.verb(verbId), def = CF.VERBS[verbId];
    if (!v.unlocked || def.auto || v.status !== 'idle' || !v.slots[this.primaryKey(verbId)]) return [];
    var taken = {}, out = [];
    var primary = this.card(v.slots[this.primaryKey(verbId)]);
    var accused = primary && primary.def === 'suspect' ? this.suspectOf(primary) : null;
    var rec = accused && this.caseRec(primary.caseId);
    var profile = rec && CF.Charge ? CF.Charge.profileOf(rec) : null;
    // What the slots already hold counts toward the rows.
    var have = {};
    var add = function (c) { if (!c || c.def !== 'clue') return; var a = CF.clueAspects(c); for (var k in a) have[k] = (have[k] || 0) + a[k]; };
    if (profile) for (var sk in v.slots) if (sk !== this.primaryKey(verbId)) add(this.card(v.slots[sk]));
    var fills = function (x) {
      if (!profile || x.def !== 'clue') return 0;
      var a = CF.clueAspects(x), n = 0;
      for (var k in profile) if (a[k] && (have[k] || 0) < profile[k]) n++;
      return n;
    };
    var elsewhere = function (x) {
      var d = x.data || {};
      if (!accused || x.def !== 'clue') return false;
      return !!(d.alibi || (d.points && d.points !== accused.key) || (d.about && d.about !== accused.key) || (d.trait && d.trait !== accused.trait));
    };
    var order = function (x) {
      var same = primary && primary.caseId && x.caseId === primary.caseId ? 0 : 2;
      var aims = accused && x.data && ((x.data.points && x.data.points === accused.key) || (x.data.trait && x.data.trait === accused.trait)) ? 0 : 1;
      return same + aims;
    };
    var cards = this.tableCards().filter(function (x) { return self.sameCaseAs(primary, x) && !elsewhere(x); });
    this.visibleSlots(verbId).forEach(function (sl) {
      if (sl.primary || v.slots[sl.key]) return;
      // Your own faculties and your Coin are choices, not requirements: the magnet leaves them.
      var c = cards.filter(function (x) { var k = self.kindOf(x); return k !== 'ability' && k !== 'funds' && !taken[x.uid] && self.slotAccepts(sl, x) && !self.unavailableReason(x); })
        .sort(function (a, b) {
          var sa = order(a) >= 2 ? 1 : 0, sb = order(b) >= 2 ? 1 : 0;
          return (sa - sb) || (fills(b) - fills(a)) || (order(a) - order(b)) || (a.uid - b.uid);
        })[0];
      if (c) { taken[c.uid] = true; out.push({ uid: c.uid, slot: sl.key }); add(c); }
    });
    return out;
  };
  P.magnet = function (verbId) {
    verbId = CF.VERB_ALIAS && CF.VERB_ALIAS[verbId] || verbId;
    var self = this, pulled = [];
    // Slots open as others fill: pull again until nothing more fits.
    for (var round = 0; round < 6; round++) {
      var list = this.magnetCandidates(verbId);
      if (!list.length) break;
      list.forEach(function (it) { if (self.slotCard(verbId, it.slot, it.uid)) pulled.push(it); });
    }
    if (pulled.length) this.dirty = true;
    return pulled;
  };

  P.clearSlots = function (verbId) {
    verbId = CF.VERB_ALIAS && CF.VERB_ALIAS[verbId] || verbId;
    var v = this.verb(verbId);
    for (var k in v.slots) this.unslot(verbId, k);
  };

  // Build the recipe context from a slot map.
  P.makeCtx = function (verbId, slotMap) {
    var self = this;
    var slots = {};
    var all = [];
    for (var k in slotMap) {
      var c = this.card(slotMap[k]);
      if (c) { slots[k] = c; all.push(c); }
    }
    var agg = {};
    all.forEach(function (c) { U.addAspects(agg, CF.aspectsOf(c)); });
    var ctx = {
      e: self, verb: verbId, slots: slots, cards: all, agg: agg, rng: self.rng,
      primary: slots[self.primaryKey(verbId)] || null,
      out: [],
      has: function (a) { return (agg[a] || 0) > 0; },
      count: function (a) { return agg[a] || 0; },
      with: function (a) { return all.filter(function (c) { return CF.aspectsOf(c)[a] > 0; }); },
      first: function (a) { return ctx.with(a)[0] || null; },
      caseOf: function (c) { return c && c.caseId ? self.s.cases[c.caseId] : null; },
      give: function (defId, spec) {
        var card = self.make(defId, spec);
        card.loc = { t: 'out', verb: verbId };
        card.hidden = true; // found face down: turned over when the player looks
        self.verb(verbId).out.push(card.uid);
        ctx.out.push(card);
        return card;
      },
      consume: function (c) { if (c) self.remove(c); },
    };
    return ctx;
  };

  P.currentRecipe = function (verbId) {
    verbId = CF.VERB_ALIAS && CF.VERB_ALIAS[verbId] || verbId;
    var v = this.verb(verbId);
    if (v.status !== 'idle' || !v.slots[this.primaryKey(verbId)]) return null;
    var ctx = this.makeCtx(verbId, v.slots);
    var list = CF.RECIPES_BY_VERB[verbId] || [];
    for (var i = 0; i < list.length; i++) if (list[i].match(ctx)) return { recipe: list[i], ctx: ctx };
    return null;
  };

  // What the verb window should show about the current slots.
  P.preview = function (verbId) {
    verbId = CF.VERB_ALIAS && CF.VERB_ALIAS[verbId] || verbId;
    var r = this.currentRecipe(verbId);
    if (!r) return null;
    var rec = r.recipe;
    var blocked = rec.blocked ? rec.blocked(r.ctx) : null;
    var lock = this.lockReason(verbId);
    return {
      label: typeof rec.label === 'function' ? rec.label(r.ctx) : rec.label,
      text: typeof rec.preview === 'function' ? rec.preview(r.ctx) : rec.preview,
      duration: this.durationOf(rec, r.ctx),
      blocked: lock || blocked,
      danger: rec.danger ? rec.danger(r.ctx) : null,
      detail: rec.detail ? rec.detail(r.ctx) : null,
      strain: this.strainNote(verbId) || null,
    };
  };

  // How much slower a verb runs while you are exhausted or in Tunnel Vision.
  P.strainFactor = function (verbId) {
    var f = 1, S = CF.STRAIN;
    if (this.exhausted() && S.exhaustedVerbs.indexOf(verbId) >= 0) f *= S.exhaustedSlow;
    if (this.countOf('tunnel') && S.tunnelVerbs.indexOf(verbId) >= 0) f *= S.tunnelSlow;
    return f;
  };
  P.exhausted = function () {
    return this.cardsOf('fatigue').filter(function (c) { return c.loc.t === 'table' || c.loc.t === 'out'; }).length >= CF.STRAIN.exhaustedAt;
  };
  P.strainNote = function (verbId) {
    var notes = [], S = CF.STRAIN;
    if (this.exhausted() && S.exhaustedVerbs.indexOf(verbId) >= 0) notes.push('You are exhausted. This will take longer.');
    if (this.countOf('tunnel') && S.tunnelVerbs.indexOf(verbId) >= 0) notes.push('Tunnel Vision: you keep going back over the same ground.');
    return notes.join(' ');
  };
  P.durationOf = function (rec, ctx) {
    var d = typeof rec.duration === 'function' ? rec.duration(ctx) : rec.duration;
    var perk = (ctx.verb === 'investigate' && this.perkHas('nose') ? 0.8 : 1) * (this.perkPace ? this.perkPace(rec.id) : 1);
    return Math.max(3, Math.round((d || 10) * perk * this.strainFactor(ctx.verb) * (this.originFactor ? this.originFactor(rec.src || ctx.verb) : 1)));
  };

  // An event runs a verb by itself: the cards are pulled in and the work
  // starts. The table animates the pull ('autorun'). Returns false if it
  // could not start.
  P.autoRun = function (verbId, uids) {
    var self = this, v = this.verb(verbId);
    if (!v || !v.unlocked || v.status !== 'idle') return false;
    this.clearSlots(verbId);
    var pulled = [];
    (uids || []).forEach(function (uid) { var c = self.card(uid); if (c && c.loc && c.loc.t === 'table' && self.autoSlot(verbId, uid)) pulled.push(uid); });
    if (!this.start(verbId)) { this.clearSlots(verbId); return false; }
    this.emit('autorun', { verb: verbId, uids: pulled });
    return true;
  };

  P.start = function (verbId) {
    verbId = CF.VERB_ALIAS && CF.VERB_ALIAS[verbId] || verbId;
    var v = this.verb(verbId);
    var r = this.currentRecipe(verbId);
    if (!r || this.lockReason(verbId)) return false;
    if (r.recipe.blocked && r.recipe.blocked(r.ctx)) return false;
    v.ctxSlots = {};
    v.held = [];
    for (var k in v.slots) {
      var c = this.card(v.slots[k]);
      c.loc = { t: 'held', verb: verbId };
      v.ctxSlots[k] = c.uid;
      v.held.push(c.uid);
    }
    v.slots = {};
    v.status = 'running';
    v.ask = null;
    // Rest put to work while a Fever runs: the end paper says so if it ran out all the same.
    if (verbId === 'reflect') this.cardsOf('burnout', true).forEach(function (fc) { fc.data.rested = true; });
    v.askSkipped = false;
    v.lost = null;
    v.recipe = r.recipe.id;
    v.recipeLabel = typeof r.recipe.label === 'function' ? r.recipe.label(r.ctx) : r.recipe.label;
    v.duration = this.durationOf(r.recipe, r.ctx);
    v.elapsed = 0;
    v.story = null;
    if (r.recipe.onStart) r.recipe.onStart(r.ctx);
    this.dirty = true;
    return true;
  };

  // ---- Mid-work asks ---------------------------------------------------------
  // Part-way through, some work wants one more card (see CF.ASKS). The verb
  // opens its small box; answer it by dropping the card on the token or
  // letting the magnet pull it, for a reward. Ignored, the work finishes as
  // it would have.
  P.askSpec = function (v) {
    if (!v || !v.recipe || !CF.ASKS) return null;
    var vid = v.id, spec = null;
    for (var i = 0; i < CF.ASKS.length; i++) if (CF.ASKS[i].when(v.recipe, vid)) { spec = CF.ASKS[i]; break; }
    if (!spec || !spec.byTemplate) return spec;
    // The case's own kind of door: a template's words over the plain ones.
    var key = v.ctxSlots && this.primaryKey(vid), prim = key && this.card(v.ctxSlots[key]);
    var rec = prim && prim.caseId && this.caseRec(prim.caseId), over = rec && spec.byTemplate[rec.template];
    if (!over) return spec;
    var out = {};
    Object.keys(spec).forEach(function (k) { if (k !== 'byTemplate') out[k] = spec[k]; });
    Object.keys(over).forEach(function (k) { out[k] = over[k]; });
    out.base = spec.label; // rationed as the one question it is
    return out;
  };
  P.tickAsk = function (vid) {
    var v = this.verb(vid), spec = this.askSpec(v);
    if (!spec || v.ask || v.askSkipped || v.status !== 'running' || v.elapsed < spec.at * v.duration) return;
    // Nothing on the table could answer it: no ask, no penalty. A locked door
    // is only a question when you have someone to put a shoulder to it.
    var self = this, probe = { key: 'ask', label: spec.label, accepts: spec.accepts };
    if (!this.tableCards().some(function (c) { return self.slotAccepts(probe, c); })) { v.askSkipped = true; return; }
    // Rationed: a verb puts the same question once a week at most. The rest of the week's work runs without it.
    var seen = this.s.askSeen || (this.s.askSeen = {}), seenKey = (spec.base || spec.label) + '|' + vid;
    if (seen[seenKey] === this.s.week) { v.askSkipped = true; return; }
    seen[seenKey] = this.s.week;
    v.ask = { label: spec.label, text: spec.text, accepts: spec.accepts, filled: null };
    this.dirty = true;
    this.emit('ask', { verb: vid, label: spec.label, text: spec.text });
  };
  P.askAccepts = function (vid, card) {
    var v = this.verb(vid);
    if (!v || v.status !== 'running' || !v.ask || v.ask.filled || !card || !card.loc || card.loc.t !== 'table') return false;
    return this.slotAccepts({ key: 'ask', label: v.ask.label, accepts: v.ask.accepts }, card);
  };
  P.askCandidates = function (vid) {
    var self = this, v = this.verb(vid);
    var primary = v && v.ctxSlots ? this.card(v.ctxSlots[this.primaryKey(vid)]) : null;
    return this.tableCards().filter(function (c) { return self.askAccepts(vid, c) && self.sameCaseAs(primary, c) && !self.unavailableReason(c); }).sort(function (a, b) { return a.uid - b.uid; });
  };
  P.answerAsk = function (vid, uid) {
    var v = this.verb(vid), card = this.card(uid), spec = this.askSpec(v);
    if (!spec || !this.askAccepts(vid, card)) return false;
    this.detach(card);
    card.loc = { t: 'held', verb: vid };
    v.held.push(uid);
    v.ask.filled = uid;
    this.dirty = true;
    return true;
  };
  // At completion: the reward, and the card back (or spent).
  P.settleAsk = function (v, ctx, result) {
    var spec = this.askSpec(v), self = this;
    var answered = v.ask && v.ask.filled && this.card(v.ask.filled);
    // Work that did not happen earns no thanks and pays no penalty; an answer comes back out.
    if (result && result.interrupted) { v.ask = null; return; }
    if (answered && spec) {
      if (spec.reward === 'nofatigue') ctx.out.slice().forEach(function (c) { if (c.def === 'fatigue') { self.remove(c); ctx.out.splice(ctx.out.indexOf(c), 1); } });
      if (spec.reward === 'testimony') ctx.out.forEach(function (c) { if ((c.def === 'clue' || c.def === 'evidence') && c.aspects) c.aspects.testimony = (c.aspects.testimony || 0) + 1; });
      if (spec.consume) this.remove(answered);
      if (result && spec.thanks) result.text = (result.text ? result.text + ' ' : '') + spec.thanks;
    } else if (v.ask && spec && spec.penalty) {
      // The ask was put and ignored: the work still finishes, but thinner.
      if (spec.penalty === 'thin') {
        // What the case turns on (the culprit's trait, the front's link) is never the thing left behind.
        var finds = ctx.out.filter(function (c) { return (c.def === 'clue' || c.def === 'evidence') && !(c.data && (c.data.trait || c.data.link)); });
        if (finds.length >= 1 && ctx.out.filter(function (c) { return c.def === 'clue' || c.def === 'evidence'; }).length >= 2) { var lost = finds[finds.length - 1]; this.remove(lost); ctx.out.splice(ctx.out.indexOf(lost), 1); }
      }
      if (spec.penalty === 'fatigue') ctx.give('fatigue');
      if (result && spec.miss) result.text = (result.text ? result.text + ' ' : '') + spec.miss;
    }
    v.ask = null;
  };

  // What an interrupted job says: the case that went to the Court or went
  // cold while you were at it, else the card that went, else the work itself.
  P.interruptedText = function (v) {
    var lost = v.lost, rec = lost && lost.caseId && this.caseRec(lost.caseId);
    if (rec && rec.status !== 'open') {
      if (rec.status === 'trial' || rec.status === 'closed') return U.fill('{case} went to the Court while you were at it.', { case: rec.title });
      if (rec.status === 'cold') return U.fill('{case} went cold while you were at it.', { case: rec.title });
      return U.fill('{case} was taken out of your hands while you were at it.', { case: rec.title });
    }
    if (lost && lost.label) return U.fill('{card} was gone before you finished. The city does not wait.', { card: lost.label });
    if (v.recipeLabel) return U.fill('{way}: what you were working on is gone before you finish. The city does not wait.', { way: v.recipeLabel });
    return 'Whatever you were working on is gone before you finish. The city does not wait.';
  };
  // The running verbs that hold a card of this case: a charge or a cold trail ends their work.
  P.busyOnCase = function (caseId) {
    var s = this.s, out = [];
    CF.VERB_ORDER.forEach(function (id) {
      var v = s.verbs[id];
      if (v && v.status === 'running' && (v.held || []).some(function (u) { return s.cards[u] && s.cards[u].caseId === caseId; })) out.push(id);
    });
    return out;
  };

  P.complete = function (verbId) {
    var v = this.verb(verbId);
    var rec = CF.RECIPES_BY_ID[v.recipe];
    var ctx = this.makeCtx(verbId, v.ctxSlots);
    var result;
    try {
      // The main card can vanish mid-recipe (burned informant, expired case...).
      if (!rec || !ctx.primary || !rec.match(ctx)) result = { title: 'Interrupted', text: this.interruptedText(v), interrupted: true };
      else result = rec.run(ctx) || { title: rec.label, text: '' };
    } catch (err) {
      if (typeof console !== 'undefined') console.error(err);
      result = { title: 'Something went wrong', text: String(err && err.message) };
    }
    this.settleAsk(v, ctx, result);
    var self = this;
    // Anything still held (not consumed) comes back out. Your Health, Wit and
    // Instinct come back spent, and recover with time or in Rest.
    v.held.slice().forEach(function (uid) {
      var c = self.card(uid);
      if (!c) return;
      var spends = CF.CARDS[c.def].spends;
      if (spends) self.transform(c, spends, { decay: CF.CARDS[spends].decay / (self.perkHas('secondwind') ? 2 : 1) });
      c.loc = { t: 'out', verb: verbId };
      v.out.push(uid);
    });
    v.held = [];
    v.ctxSlots = {};
    v.lost = null;
    v.status = 'done';
    v.story = result;
    var sv = this.s.stats.verbs || (this.s.stats.verbs = {});
    sv[verbId] = (sv[verbId] || 0) + 1;
    var sr = this.s.stats.recipes || (this.s.stats.recipes = {});
    sr[v.recipe] = (sr[v.recipe] || 0) + 1;
    if (v.recipeLabel) (this.s.stats.ways = this.s.stats.ways || {})[v.recipe] = v.recipeLabel;   // the way's name as it read, for the verb's about pane
    if (/^ref_(hunger|sickness|stress)/.test(v.recipe)) this.s.stats.needsMet = (this.s.stats.needsMet || 0) + 1;
    if (this.growthTick) this.growthTick();
    if (v.recipe === 'duty_beat' && this.perkHas('surefoot')) { var extra = this.make('funds'); extra.loc = { t: 'out', verb: verbId }; v.out.push(extra.uid); }
    if (this.s.intro) (this.s.intro.done = this.s.intro.done || {})[verbId] = true;
    this.layoutVerbs();
    this.story(result.title, result.text, result.kind || 'verb');
    this.emit('complete', { verb: verbId });
    if (this.choiceHook) this.choiceHook(verbId, v);
    if (v.out.length === 0 && !result.keepOpen) {
      // Nothing to collect: return the verb to idle straight away.
      v.status = 'idle';
    }
    this.checkThresholds();
  };

  // Drag a single output card out of a finished verb onto the table.
  P.reveal = function (uid) {
    var card = this.card(uid);
    if (!card || !card.hidden) return false;
    delete card.hidden;
    this.dirty = true;
    return true;
  };
  P.takeOutput = function (verbId, uid, pos) {
    var card = this.card(uid);
    if (!card || !card.loc || card.loc.t !== 'out' || card.loc.verb !== verbId) return false;
    delete card.hidden;
    this.detach(card);
    this.placeOnTable(card, pos || this.outputSpot(verbId, card));
    this.dirty = true;
    return true;
  };

  // Where a verb's output lands: back where it came from, or beside the verb.
  P.outputSpot = function (verbId, card) {
    // A card that came off the table goes back where it was (placeOnTable
    // keeps card.lastPos); a new find joins its stack, else the collection pile.
    return null;
  };

  // Tidy the table: every card back to a spot its kind prefers, with the
  // current spacing, keeping stacks together.
  // The row a kind of card takes when the table is tidied. Zones with no
  // card on the table close up: their order is kept, only the gaps go, so
  // an early desk is not stretched down to an empty row of kit.
  P.zoneRow = function (kind, cards) {
    var self = this, rows = {};
    (cards || this.tableCards()).forEach(function (c) { rows[ZONE_ROWS[self.kindOf(c)] || 0] = true; });
    var want = ZONE_ROWS[kind] || 0;
    rows[want] = true;
    return Object.keys(rows).map(Number).sort(function (a, b) { return a - b; }).indexOf(want);
  };

  P.tidy = function () {
    var self = this, cards = this.tableCards().sort(function (a, b) { return a.uid - b.uid; });
    var done = {};
    cards.forEach(function (c) { c.loc = null; });
    cards.forEach(function (c) {
      if (done[c.uid]) return;
      var key = self.stackKey(c);
      var mates = key ? cards.filter(function (o) { return !done[o.uid] && self.stackKey(o) === key; }) : [c];
      var spot = self.layoutSpot(self.zoneRow(self.kindOf(c), cards), T.CW, T.CH, self.obstacles());
      mates.forEach(function (m) { m.loc = { t: 'table', x: spot.x, y: spot.y }; m.lastPos = null; done[m.uid] = true; });
    });
    this.dirty = true;
  };

  // Gather every like card on the table into one stack (the first one, by
  // age), leaving everything else where it is. Returns the uids of the cards
  // that moved, so the table can show what merged.
  P.mergeStacks = function () {
    var self = this, moved = [], homes = {};
    this.tableCards().sort(function (a, b) { return a.uid - b.uid; }).forEach(function (c) {
      var key = self.stackKey(c);
      if (!key) return;
      if (!homes[key]) { homes[key] = c.loc; return; }
      if (c.loc.x === homes[key].x && c.loc.y === homes[key].y) return;
      c.loc = { t: 'table', x: homes[key].x, y: homes[key].y };
      c.lastPos = null;
      moved.push(c.uid);
    });
    if (moved.length) this.dirty = true;
    return moved;
  };

  // Where every table card is right now, so a tidy can be undone.
  P.snapshotTable = function () {
    var snap = {};
    this.tableCards().forEach(function (c) { snap[c.uid] = { x: c.loc.x, y: c.loc.y }; });
    return snap;
  };
  P.restoreTable = function (snap) {
    var self = this, n = 0;
    Object.keys(snap || {}).forEach(function (uid) {
      var c = self.card(+uid);
      if (!c || !c.loc || c.loc.t !== 'table') return;
      c.loc = { t: 'table', x: snap[uid].x, y: snap[uid].y };
      n++;
    });
    if (n) this.dirty = true;
    return n;
  };

  P.collect = function (verbId) {
    verbId = CF.VERB_ALIAS && CF.VERB_ALIAS[verbId] || verbId;
    var v = this.verb(verbId);
    var self = this;
    v.out.slice().forEach(function (uid) {
      var c = self.card(uid);
      if (!c) return;
      delete c.hidden;
      c.loc = null;
      self.placeOnTable(c, self.outputSpot(verbId, c));
    });
    v.out = [];
    if (v.status === 'done') v.status = 'idle';
    v.story = null;
    this.dirty = true;
  };

  // ---- Time -----------------------------------------------------------------
  P.tick = function (dt) {
    var s = this.s;
    if (s.over || dt <= 0) return;
    if (s.choice) return; // the city has asked you something: the clock waits
    s.t += dt;

    // Card lifetimes. The evidence locker halves decay on clues and evidence.
    var ids = Object.keys(s.cards);
    for (var i = 0; i < ids.length; i++) {
      var c = s.cards[ids[i]];
      if (!c || c.life === undefined || c.life === null) continue;
      var rate = 1;
      // At work in a verb, or a find waiting to be collected: the clock waits.
      // A case's clock is the city's, and runs wherever the case sits.
      if (c.loc && (c.loc.t === 'held' || (c.loc.t === 'out' && c.def !== 'case'))) continue;
      if (s.rooms.locker && (c.def === 'clue' || c.def === 'evidence')) rate = 0.5;
      c.life -= dt * rate;
      if (c.life <= 0) this.expire(c);
      else if (c.def === 'case' && c.life < COLD_WARNING) this.warnCold(c);
      else if (c.life < FADE_WARNING && !c.fadeWarned && c.loc && FADING[c.def]) {
        // A clue, lead or witness about to go: say so, once, in time to act.
        // It may be on the table, or waiting in (or held by) a verb.
        c.fadeWarned = true;
        this.emit('expiring', { uid: c.uid, label: this.labelOf(c), verb: c.loc.verb || null });
      }
      else if (c.life < FADE_WARNING && !c.fadeWarned && c.loc && STRAIN_WARN[c.def]) {
        c.fadeWarned = true;
        this.story('The Fever Worsens', 'Half a minute, and the file ends. Lie down in Rest now.', 'danger', { cue: 'harm', uid: c.uid });
        this.emit('pressing', { uid: c.uid, label: this.labelOf(c), def: c.def, verb: c.loc.verb || null, ends: true });
      }
      if (s.over) return;
    }

    // Verbs.
    for (var vid in s.verbs) {
      var v = s.verbs[vid];
      if (v.status !== 'running') continue;
      v.elapsed += dt;
      this.tickAsk(vid);
      if (v.elapsed >= v.duration) this.complete(vid);
      if (s.over) return;
    }

    // The week (the Bell is silent until you have earned your first keep).
    if (!s.flags.bellSilent) s.weekT += dt;
    if (s.weekT >= WEEK) {
      s.weekT -= WEEK;
      this.weekTick();
      if (s.over) return;
    }

    if (s.intro && !s.intro.finished) this.introTick();
    if (this.openingTick) this.openingTick();
    if (this.needsTick) this.needsTick(dt);
    if (this.choicesTick) this.choicesTick(dt);
    this.tickInformants(dt);
    this.tickDelegates(dt);
    if (s.rooms.intel) this.tickIntelOffice();

    // Dispatch: new cases come in on their own clock (or an informant's).
    s.dispatchT -= dt;
    if (s.flags.opening) s.dispatchT = Math.max(s.dispatchT, 60); // no more cases until you have the desk and your first keep
    if (s.dispatchT <= 0) {
      // A queued case (a warning, a known hand) comes with its own particulars;
      // a warned case comes even to a full desk. A queued culprit since caught
      // or dead is dropped.
      var next = s.nextCase;
      if (next && next.criminalId) { var nc = this.criminal(next.criminalId); if (nc && nc.status !== 'at_large' && nc.status !== 'hunted') { s.nextCase = next = null; } }
      if (this.roomForCase(next && next.extraTime ? 1 : 0)) {
        s.nextCase = null;
        this.spawnCase(next ? next.template : null, next || {});
      }
      var base = U.randInt(this.rng, 170, 220) - Math.min(30, s.week * 2) - (CF.RANK_DEFS[s.rank] || {}).dispatch || 0;
      if (this.countOf('syndicate')) base -= 10;
      if (s.meters.dread >= 6) base += 15; // a frightened city commits fewer small crimes, or reports fewer
      s.dispatchT = Math.max(70, base);
    }

    this.checkThresholds();
  };

  // One warning per case, a minute before it goes cold.
  P.warnCold = function (card) {
    var rec = this.caseRec(card.caseId);
    if (!rec || rec.status !== 'open' || rec.warned) return;
    rec.warned = true;
    this.story('Going Unanswered: ' + rec.title, (rec.searches === 0 ? 'Seven days left on a case you never opened, and the trail is fading. ' : 'Seven days left, and the trail is fading. ') +
      'Charge somebody, or let it go and live with it.', 'danger');
  };
  // How long a case has left, in the city's days (a week is a game minute).
  CF.daysLeft = function (seconds) { return Math.max(0, Math.ceil(seconds / (WEEK / 7))); };

  P.expire = function (card) {
    var def = this.def(card);
    var how = card.data.onExpire || def.onExpire || 'vanish';
    var label = this.labelOf(card);
    if (how === 'cold') { this.goCold(card.caseId); return; }
    if (how === 'sentence_default') { this.defaultSentence(card); return; }
    if (how === 'mountain') { this.remove(card); if (this.mountainStrikes) this.mountainStrikes(); return; }
    if (how === 'heal') {
      this.remove(card);
      this.create('health');
      this.story('Healed', 'The barber-surgeon takes the stitches out. You can take a blow again. Probably.', 'minor');
      return;
    }
    if (how === 'burnout') {
      var feverCause = { threat: 'burnout', seconds: Math.round(card.maxLife || def.lifetime || 0), restIdle: !card.data.rested };
      this.remove(card);
      this.strainEnds('burnout', feverCause);
      return;
    }
    if (how === 'restore') {
      // Restored in place, then re-placed: it leaves the spent stack it sat on and joins its own.
      // One that recovered in an idle verb's slot comes back to the table: the slot took a spent card, not a whole one.
      var at = card.loc;
      if (at && at.t !== 'table') this.detach(card);
      this.transform(card, def.restores);
      if (at) this.placeOnTable(card, at.t === 'table' ? { x: at.x, y: at.y } : undefined);
      return;
    }
    if (how === 'recover') {
      var spec = card.data.teammate;
      this.remove(card);
      if (spec) {
        this.create('teammate', spec);
        this.story('Back on the Round', spec.label + ' is out of the Abbey hospital and back at the Watch-house.', 'minor');
      }
      return;
    }
    if (how === 'verdict') { this.verdict(card); return; }
    if (how === 'need') { this.needExpired(card); return; }
    if (how === 'ignored') {
      // A warning of a case still queued was not ignored: the desk was full.
      if (card.data.kind === 'warning' && this.s.nextCase && this.s.nextCase.template === card.data.template) {
        // The card goes, but its benefit rides on the queued case.
        this.s.nextCase.warned = { informant: card.data.informant || null };
        this.remove(card); return;
      }
      var inf = card.data.informant && this.card(card.data.informant);
      if (inf && inf.def === 'informant') { this.trustInformant(inf, -1); this.story('Nothing Came of It', inf.data.name + ' notices you did nothing with what they told you. They will be slower to tell you again.', 'minor'); }
      this.remove(card);
      return;
    }
    if (card.def === 'witness') this.story('A Witness Moves On', label + ' has left the city. Whatever they saw went with them.', 'minor');
    if (card.def === 'atlarge' && card.data.innocent) this.story('Gone from the City', U.fill('{name} has left the Free City for good, and taken the grudge along.', { name: card.data.name }), 'minor');
    if (card.def === 'bribe') {
      // With a Band or the Coquille in the city, the purse had owners who keep a tally.
      var organized = this.countOf('gang') > 0 || (this.countOf('syndicate') > 0 && !this.s.flags.syndicateFallen);
      if (organized) this.meter('retaliation', 1);
      // Left to lie, it is Justice; once a month at most, so refusing is not a trade.
      var just = !this.s.flags.purseLeftWeek || this.s.week - this.s.flags.purseLeftWeek >= 4;
      if (just) { this.s.flags.purseLeftWeek = this.s.week; this.pathGain('crusader', 1, 'left a purse to lie'); }
      this.story('The Purse Is Gone', 'Somebody came back for it.' + (organized ? ' The band that left it keeps a tally, and your name is on it.' : ' Whoever left it will try another door.') + (just ? ' Justice +1.' : ''), 'minor');
    }
    // The King's purse left to lie: he counts the times (see coquilleWeek).
    if (card.def === 'tribute' && this.court) { var court = this.court(); court.ignoredTribute = (court.ignoredTribute || 0) + 1; }
    if (card.def === 'clue' || card.def === 'evidence') {
      // A token that named the culprit is told on its own; the rest go into the week's ledger in one line.
      var frec = card.caseId && this.caseRec(card.caseId), fcul = frec && frec.suspects.filter(function (x) { return x.guilty; })[0];
      var fd = card.data || {};
      var named = !!fcul && (fd.names || (fd.points && (fd.points === fcul.key || fd.points === fcul.name)) || (fd.about && (fd.about === fcul.key || fd.about === fcul.name)) || (fd.trait && fd.trait === fcul.trait));
      if (named) this.story('The Trail Fades', label + ' has faded beyond use.', 'minor');
      else (this.s.weekFaded || (this.s.weekFaded = [])).push(label);
    }
    this.remove(card, CF.EXPIRE_GONE[card.def] || 'faded');
  };
  // How a card whose clock ran out leaves the table (see CF.GONE_DEFAULT).
  CF.EXPIRE_GONE = { witness: 'left', atlarge: 'left', bribe: 'left', tribute: 'left', writsale: 'left' };

  // What the Bell draws each week: lodging, and a Coin for every two
  // watchmen in your service.
  // Perks: lasting edges found in play (see js/systems/growth.js).
  P.perkHas = function (id) { return !!(this.s.perks && this.s.perks[id]); };

  P.dues = function () {
    return CF.ECONOMY.rent + Math.floor(this.cardsOf('teammate', true).length / 2);
  };

  // How the Fever takes you: one of these, by the run's dice.
  CF.FEVER_TEXTS = [
    'You stand in the Market outside the Watch-house for an hour and cannot make yourself go in. Your hands will not stop shaking. You need rest, and soon.',
    'The ague takes you on the Watch-house stair: hot, then cold, then hot. The sergeant sends you home. You do not go.',
    'You read the same deposition four times and cannot say what is in it. The room tilts when you stand.',
  ];

  P.weekTick = function () {
    var s = this, self = this;
    s = this.s;
    s.week++;
    if (s.intro && !s.intro.finished) this.introFinish('The week turns.');
    var lines = [];
    // The calendar: the season's turn opens the Bell; a year at the top of the road is pensioned.
    var seaLine = this.seasonLine();
    if (seaLine) lines.push(seaLine);
    var pension = this.longServiceWeek();
    if (s.over) return;
    if (pension) lines.push(pension);

    // Dues first, out of what is on the table; then the salary.
    var salary = (CF.RANK_DEFS[s.rank] || {}).salary || CF.ECONOMY.salary[s.rank] || 1;
    if (s.flags.pension) salary += 1; // asked of the Assize
    // Coin on the table pays first, then Coin waiting in an idle verb's slot or among its outputs.
    var funds = this.cardsOf('funds', true).filter(function (c) {
      var vb = c.loc.verb && s.verbs[c.loc.verb];
      return c.loc.t === 'table' || (c.loc.t === 'slot' && vb && vb.status !== 'running') || c.loc.t === 'out';
    });
    funds.sort(function (a, b) { return (a.loc.t === 'table' ? 0 : 1) - (b.loc.t === 'table' ? 0 : 1); });
    var dues = this.dues();
    var paid = funds.length >= dues;
    if (paid) {
      var taken = funds.slice(0, dues);
      this.emit('dues', { uids: taken.map(function (c) { return c.uid; }) });
      taken.forEach(function (c) { self.remove(c); });
      lines.push(U.fill('Lodging and dues take {n}.', { n: dues }), U.fill('The Council\'s stipend: {m} Coin.', { m: salary }));
    }
    var stipend = [];
    for (var si = 0; si < salary; si++) stipend.push(this.create('funds').uid);
    // The stipend's Coin, new on the table: the interface flies them out of the Bell.
    this.emit('salary', { uids: stipend, paid: paid });
    if (!paid) {
      this.create('fatigue');
      this.create('fatigue');
      lines.push('You cannot pay your lodging. The landlord puts your chest in the lane at prime. You sleep in the Watch-house, on the bench.');
    }

    // The criminal ecosystem grows. The sworn of a band count with their band.
    var atLarge = this.cardsOf('atlarge').filter(function (c) { return !c.data.band; }).length;
    var gangs = this.countOf('gang');
    var synd = this.countOf('syndicate');
    // Below Bailiff the Coquille weighs like a band (nobody under the white staff can go among
    // them); in a week the Watch stood on its stair it keeps its hands off yours.
    var watched = typeof s.flags.coqWatched === 'number' && s.flags.coqWatched >= s.week - 1;
    var ret = Math.min(2, (atLarge ? 1 : 0) + (atLarge >= 3 ? 1 : 0) + gangs * 2 + synd * (watched ? 0 : s.rank >= 2 ? 3 : 1));
    if (ret) {
      this.meter('retaliation', ret);
      var walked = atLarge === 1 ? 'One who walked from you is still inside the walls.' : U.fill('{N} who walked from you are still inside the walls.', { N: CF.numberWord(atLarge, true) });
      var talk = [walked, 'A name you let go was heard in the Red Ox this week.', 'Somebody who walked from a case of yours bought a round in the Stews and drank to your health, the wrong way.'];
      var bandCards = this.cardsOf('gang', true);
      lines.push(gangs && bandCards.length ? bandCards[0].data.name + ' keep a cellar now, and a tally.' : talk[atLarge ? s.week % 3 : 1 + s.week % 2]);
    }
    // A week in which no case went cold lets the Vendetta cool, unless the bands are feeding it.
    var coldBefore = (s.weekSnap || {}).cold || 0;
    if ((s.stats.cold || 0) === coldBefore && ret <= 1 && s.meters.retaliation > 0) this.meter('retaliation', -1);
    // The Crowd counts the thieves abroad: not while a hue and cry is up, and under a Bailiff every week, below that every other.
    // The week says the count, and says it a name early.
    var tally = this.abroadTally();
    if (tally.n >= tally.at && !tally.quiet && (s.rank >= 2 || s.week % 2 === 0)) { this.meter('pressure', 1); lines.push(U.fill('The broadsheet-sellers count {n} names abroad, and sing them in the Market.', { n: tally.n })); }
    else if (tally.n === tally.at - 1 && !tally.quiet) lines.push('The broadsheet-sellers count three names abroad. At four they will sing them in the Market.');
    this.organise();
    lines = lines.concat(this.criminalsAct());
    if (this.banishedReturn) lines = lines.concat(this.banishedReturn());
    if (this.purseWeek) lines = lines.concat(this.purseWeek());
    if (this.coquilleWeek) lines = lines.concat(this.coquilleWeek());
    lines = lines.concat(this.assizeWeek());
    if (this.patronsWeek) lines = lines.concat(this.patronsWeek());
    if (this.mountainWeek) lines = lines.concat(this.mountainWeek());
    lines = lines.concat(this.rivalFade());
    if (this.rivalWeek) lines = lines.concat(this.rivalWeek());
    this.settleStacks(); // a token tampered with in its stack is no longer its twin
    if (s.rooms.survroom) lines = lines.concat(this.belfryWeek());
    if (s.rooms.intel && this.benchWeek) lines = lines.concat(this.benchWeek());
    // The Pattern: once a run, for a Bailiff (or a Sworn Examiner from week twelve), and every week it is open another girl.
    if (s.week >= 6 && (s.rank >= 2 || (s.rank >= 1 && s.week >= 12)) && !s.flags.patternSeen && this.rng() < 0.2 && this.openCases().length < this.maxOpenCases()) {
      s.flags.patternSeen = true;
      this.spawnCase('pattern', { headline: 'The Pattern: ', lead: 'The first of them.' });
    }
    this.openCases().forEach(function (rec) {
      if (rec.template !== 'pattern' || rec.patternRead || rec.week === s.week) return;
      rec.victims = (rec.victims || 1) + 1;
      if ((s.week - rec.week) % 2 === 0) self.meter('pressure', 1); // the Crowd counts every other door
      var n = ['', 'first', 'second', 'third', 'fourth', 'fifth'][Math.min(5, rec.victims)];
      self.create('clue', self.clueSpec(rec, { label: 'The ' + n.charAt(0).toUpperCase() + n.slice(1) + ' Door', text: 'Another girl of ' + rec.scene + ', another doorway, the hair cut close. He chose the door the way he chose the last. ' + (rec.victims >= 3 ? 'The city has stopped sleeping.' : 'The quarter has begun to count.'), aspects: { opportunity: 1, forensic: 1 }, pattern: true }, []));
      lines.push('Another girl in ' + rec.scene + '. The ' + n + '.');
    });
    if (this.eumenidesWeek) lines = lines.concat(this.eumenidesWeek());
    if (s.flags.syndicateFallen && this.rng() < 0.25 && this.openCases().length < this.maxOpenCases() && !this.openCases().some(function (r) { return r.template === 'highway'; })) {
      this.spawnCase('highway', { headline: 'From the Roads: ', lead: 'The Court of Miracles is scattered, and its men have horses now.' });
    }
    if (s.over) return;

    // Retaliation strikes. The first week it could reach the stair, it only asks the way.
    var r = s.meters.retaliation;
    if (r < 5) s.flags.stairWarned = false;
    if (r >= 5 && !s.flags.stairWarned) {
      s.flags.stairWarned = true;
      this.story('Which Stair Is Yours', 'A man has been asking in the Red Ox which stair is yours. He was not asking for the landlord.', 'danger');
    } else if (r >= 3 && this.rng() < r * (this.endowedWith('lanes') ? 0.05 : 0.07)) this.attack();

    // Temptation.
    if (!this.countOf('bribe') && this.rng() < 0.15 + 0.1 * (gangs + synd * 2) + (this.season().purse || 0)) {
      this.create('bribe');
      lines.push('There is a purse on your desk. Nobody saw who left it.');
    }

    // Transfers.
    if (s.meters.reputation >= 2 && this.countOf('personnel') < 2 && this.rng() < 0.25) {
      var pk = U.pick(this.rng, ['rookie', 'tech', 'interviewer', 'analyst', 'veteran']);
      this.create('personnel', this.personnelSpec(pk));
      lines.push('A letter of service lands on your desk: ' + CF.PERSONNEL[pk].label + '.');
    }

    // A calm city under a senior officer is Power for one who wants Power; it counts every other calm week.
    if (s.rank >= 1 && s.meters.pressure <= 3 && s.meters.scrutiny <= 3) {
      s.calmWeeks = (s.calmWeeks || 0) + 1;
      if (s.calmWeeks % 2 === 0 && s.calling === 'commissioner') this.pathGain('commissioner', 1, 'a calm fortnight');
    }
    // Fear fades, slowly, and while it lasts the Stews keep their heads down.
    // The count endings are judged before fear fades, so the thresholds mean what they say.
    if (this.checkCountEndings) { this.checkCountEndings(); if (s.over) return; }
    // The city remembers: fear fades, but not below what you have done (every three cruelties keep it a step higher).
    var dreadFloor = this.dreadFloor();
    if (s.meters.dread > dreadFloor) this.meter('dread', -1);
    if (s.meters.dread > dreadFloor && this.rng() < 0.5) this.meter('dread', -1);
    // Only fear that is fresh keeps the Stews down: what is merely remembered does not quiet the Crowd.
    if (s.meters.dread >= 6 && s.meters.dread > dreadFloor) { this.meter('pressure', -1); lines.push('The Stews are quiet. Nobody wants to be the next one you put to the question.'); }
    if (s.meters.dread >= 8) lines.push('Doors close as you pass. The city is afraid of you now, and fear does not stay quiet forever.');
    this.checkDrift();
    if (s.meters.scrutiny >= 7) lines.push('The Council\'s clerks have started asking your watchmen about you. They are not subtle about it.');
    if (s.meters.pressure >= 7) lines.push('The Burgomaster calls you in to ask why the city is burning. It is not a question.');

    var snap = s.weekSnap || { convictions: 0, acquittals: 0, cold: 0 };
    var ledger = [];
    var dc = (s.stats.convictions || 0) - (snap.convictions || 0), da = (s.stats.acquittals || 0) - (snap.acquittals || 0), dk = (s.stats.cold || 0) - (snap.cold || 0);
    if (dc) ledger.push(dc + (dc === 1 ? ' conviction' : ' convictions'));
    if (da) ledger.push(da + (da === 1 ? ' acquittal' : ' acquittals'));
    if (dk) ledger.push(dk + (dk === 1 ? ' case gone cold' : ' cases gone cold'));
    // Each label once, joined as the finds are (' · '), so a label with a comma of its own reads whole.
    var faded = (s.weekFaded || []).filter(function (x, i, a) { return a.indexOf(x) === i; });
    if (faded.length) lines.push(U.fill('Gone stale this week: {what}.', { what: faded.join(' · ') }));
    s.weekFaded = [];
    lines.push(U.fill('The ledger: {what}; {open} open; {coin} Coin in hand.', { what: ledger.length ? ledger.join(', ') : 'no case closed', open: this.openCases().length, coin: this.countOf('funds') }));
    // The patrons' favour moved this week, a line each.
    if (this.favourMoved) lines = lines.concat(this.favourMoved(snap.favour || { council: 0, bishop: 0, guild: 0 }));
    // From Bailiff, the Council counts what you closed this fortnight.
    lines = lines.concat(this.councilCountWeek());
    var fav = this.favour ? this.favour() : null;
    s.weekSnap = { convictions: s.stats.convictions || 0, acquittals: s.stats.acquittals || 0, cold: s.stats.cold || 0,
      favour: fav ? { council: fav.council || 0, bishop: fav.bishop || 0, guild: fav.guild || 0 } : null };
    if (this.growthTick) this.growthTick();
    this.story('Week ' + s.week, lines, 'week', { paid: paid, uids: stipend, season: this.season().id });
    if (this.checkPurseEndings) this.checkPurseEndings();
  };

  // The Belfry: every week it looks down on each known front, and one open
  // case that goes through it gets a token and a name. Once per case.
  P.belfryWeek = function () {
    var self = this, lines = [], fronts = this.fronts ? this.fronts() : {};
    Object.keys(fronts).forEach(function (fid) {
      var f = fronts[fid];
      if (!f.known) return;
      var rec = self.casesAtFront(fid).filter(function (r) { return !r.belfry; })[0];
      if (!rec) return;
      rec.belfry = true;
      var spec = self.clueSpec(rec, { label: 'Seen from the Belfry', text: U.fill('From the belfry you watch {front} through a glass: who goes in, and who comes out lighter.', { front: f.name }),
        aspects: { opportunity: 2 }, link: fid }, [], { noMisread: true });
      spec.tags = ['watching'];
      self.create('clue', spec);
      self.roomUsed('survroom');
      self.revealSuspect(rec, null);
      lines.push(U.fill('From the Belfry: {title}.', { title: rec.title }));
    });
    return lines;
  };

  // At-large criminals find each other; gangs merge into a syndicate. The
  // sworn keep their Abroad cards (marked with their band) and can still be
  // hunted one by one.
  P.organise = function () {
    var s = this.s;
    var self = this;
    var al = this.cardsOf('atlarge').filter(function (c) {
      if (c.loc.t !== 'table' || c.data.band || c.data.innocent) return false; // the innocent hate you alone
      var rec = c.data.criminalId ? self.criminal(c.data.criminalId) : self.criminalByName(c.data.name);
      if (rec && rec.traits.indexOf('spared') >= 0) return false; // a spared man owes the Examiner, and no band trusts him
      return !(rec && (rec.king || rec.organization === 'syndicate')); // the King and his sworn men already have a shell
    });
    if (al.length >= 3) {
      var members = al.slice(0, 3);
      var name = U.pick(this.rng, CF.NAMES.gang);
      var names = members.map(function (c) { return c.data.name; });
      members.forEach(function (c) {
        c.data.band = name;
        c.label = 'Sworn of a Band: ' + c.data.name;
        self.criminalJoins(c.data.name, 'gang');
        var rec = self.criminalByName(c.data.name);
        if (rec) self.refreshAtLarge(rec);
      });
      var front = this.newFront(name);
      this.create('gang', {
        label: 'Band: ' + name.replace(/^the /, 'The '),
        data: { name: name, members: names, front: front.id },
        desc: 'Sworn together by ' + names.join(', ') + ', who all walked from you. They feed the Vendetta every week. Post the Watch on them in Attend with a watchman; at Bailiff, go in Disguise to build a case against them.',
      });
      this.meter('pressure', 1);
      this.story('They Found Each Other', names.join(', ') + ': every one of them walked away from one of your cases. Now they drink in the same cellar, and call themselves ' + name + '.', 'major');
    }
    var gangs = this.cardsOf('gang').filter(function (c) { return c.loc.t === 'table'; });
    if (gangs.length >= 2 && !this.countOf('syndicate') && !s.flags.syndicateFallen) {
      gangs.slice(0, 2).forEach(function (c) { self.remove(c); });
      this.spawnSyndicate('The bands have stopped fighting each other. Someone under the Warrens has sworn them to one shell, and sits on a barrel in a cellar where the lame walk and the blind see. They call him the King of Thunes, and his kingdom the Coquille.');
    }
    // The Crusader's enemy doesn't wait to be built from your failures, but
    // it waits for the Bailiff's Disguise: below that rank the city only
    // says its name.
    var waiting = s.calling === 'crusader' && !this.countOf('syndicate') && !s.flags.syndicateFallen;
    if (waiting && s.week >= 6 && s.rank < 2 && !s.flags.coquilleWord) {
      s.flags.coquilleWord = true;
      this.story('The Same Door', 'Every fence you question looks at the same door before he lies. Somebody under the Warrens is gathering the bands into one shell. When the Council makes you Bailiff, you can go among them.');
    }
    if (waiting && ((s.rank >= 2 && s.week >= 10) || this.countOf('ledger') >= 3)) {
      this.spawnSyndicate('You have seen the same advocate at every hearing, the same faces at every cellar door. Behind the city\'s crime there is a court, a barrel for a throne, and a king. They call it the Coquille. Go in Disguise to get at its books.');
    }
  };

  // The broadsheet's tally of the thieves abroad: a name on the wall counts
  // one, a band two (its sworn stand behind it), the Coquille one (its
  // weight is in the Vendetta, where the threat is), and nothing while you
  // are inside it with a case. At four the Crowd rises,
  // every week under a Bailiff and every other week below; a hue and cry
  // quiets it. The interface reads this for the Crowd's help.
  // Who can be hunted. An innocent acquitted is not (data.innocent): they
  // hate you, and feed the Vendetta, but there is no crime to raise the hue
  // and cry for. A hunt still before the Court is a hunt still running.
  CF.INNOCENT_ABROAD_WEEKS = 6;
  CF.INNOCENT_NO_HUNT = 'They were innocent. There is no crime to raise the hue and cry for.';
  P.huntRunning = function (c) {
    var r = c && c.data && c.data.hunted && this.caseRec(c.data.hunted);
    return !!r && (r.status === 'open' || r.status === 'trial');
  };
  P.huntable = function (c) { return !!c && c.def === 'atlarge' && !(c.data && c.data.innocent) && !this.huntRunning(c); };
  // A name convicted: every other hue and cry still raised for that name is
  // called off (they are in the Hole already). Returns the hunts closed.
  P.callOffHunts = function (name, exceptId) {
    var self = this, closed = [];
    this.openCases().forEach(function (r) {
      if (r.template !== 'manhunt' || r.id === exceptId) return;
      var cul = r.suspects.filter(function (x) { return x.guilty; })[0];
      if (!cul || cul.name !== name) return;
      r.status = 'dropped';
      self.releaseDelegate(r, false);
      var cc = self.caseCard(r.id);
      if (cc) self.remove(cc);
      self.clearCaseCards(r.id);
      closed.push(r);
      self.story(U.fill('Called Off: {title}', { title: r.title }), U.fill('{name} is already in the Hole. The hue and cry is called off.', { name: name }), 'minor');
    });
    return closed;
  };

  P.abroadTally = function () {
    var s = this.s;
    var atLarge = this.cardsOf('atlarge').filter(function (c) { return !c.data.band && !c.data.innocent; }).length;
    var synd = this.countOf('syndicate');
    var inside = this.openCases().some(function (r) { return r.template === 'syndicate'; });
    return { n: atLarge + this.countOf('gang') * 2 + (synd && !inside ? 1 : 0), at: 4, every: s.rank >= 2 ? 1 : 2, quiet: this.manhuntOpen() };
  };

  P.spawnSyndicate = function (text) {
    var s = this.s;
    for (var k in s.criminals) if (s.criminals[k].organization === 'gang') s.criminals[k].organization = 'syndicate';
    this.newFront('the Coquille', 'warrens');
    this.create('syndicate');
    this.meter('retaliation', 2);
    var king = this.crownKing ? this.crownKing() : null;
    if (king) {
      var first = (king.history || []).filter(function (h) { return h.title; })[0];
      text += first ? ' You know the name. It is ' + king.name + ', who walked from ' + first.title + ' in week ' + first.week + ', and has not stopped since.'
        : ' The name is ' + king.name + '. It is not in your Rolls. It will be.';
    }
    this.story('The Coquille', text, 'major');
  };

  // Retaliation lands on someone close to you.
  P.attack = function () {
    var s = this.s;
    var self = this;
    s.stats.attacks++;
    this.meter('retaliation', -3);
    var informants = this.cardsOf('informant', true);
    var team = this.cardsOf('teammate', true);
    var pool = [];
    informants.forEach(function (c) { pool.push({ w: 2 + (c.data.heat || 0), c: c }); });
    team.forEach(function (c) { pool.push({ w: 2, c: c }); });
    pool.push({ w: 2, c: null });
    var total = pool.reduce(function (a, p) { return a + p.w; }, 0);
    var roll = this.rng() * total;
    var target = null;
    for (var i = 0; i < pool.length; i++) { roll -= pool[i].w; if (roll <= 0) { target = pool[i]; break; } }
    if (!target) target = pool[pool.length - 1];
    var c = target.c;
    if (c && c.def === 'informant') {
      this.burnInformant(c, c.data.name + ' was dragged into an alley and asked who they had been talking to. ' + (this.informantStatus(c) === 'safe' ? 'They survived. They will not be talking to you again.' : 'Nobody has seen them since.'));
    } else if (c && c.def === 'teammate') {
      if (s.meters.retaliation >= 5 && this.rng() < 0.3) {
        this.remove(c);
        this.meter('pressure', 1);
        this.create('obsession');
        this.story('A Watchman Dead', this.labelOf(c) + ' was stabbed on their way home. The burial is on Thursday. The whole Watch-house goes. You carry the coffin.', 'danger', { cue: 'harm' });
      } else {
        this.remove(c);
        this.create('injured', { label: 'Hurt: ' + this.labelOf(c), data: { teammate: { label: c.label, desc: c.desc, aspects: c.aspects, data: c.data } } });
        this.story('A Watchman Hurt', this.labelOf(c) + ' was set upon outside the Watch-house. They will be in the Abbey hospital for a while.', 'danger', { cue: 'harm' });
      }
    } else {
      this.hurtYou('Someone was waiting on the stair of your lodging. You remember the first blow of the cudgel and not much after.', 'stair');
    }
  };

  // A blow takes your Health, Winded or not, and leaves a Wound. With no
  // Health to lose: a Wound already carried is death; otherwise a beating.
  // `cause` says who struck (order, court, cover, stair): a killing blow keeps it
  // in stats.killedBy for the ending.
  P.hurtYou = function (text, cause) {
    // The Health lying idle goes first: a blow does not stop a round that one walks while another waits.
    var held = function (a, b) { return (a.loc && a.loc.t === 'held' ? 1 : 0) - (b.loc && b.loc.t === 'held' ? 1 : 0); };
    var hp = this.cardsOf('health', true).sort(held);
    if (!hp.length) hp = this.cardsOf('spent_health', true).sort(held);
    if (hp.length) {
      this.remove(hp[0], 'wounded');
      var w = this.create('wound');
      if (this.woundFactor && this.woundFactor() !== 1) { w.life *= this.woundFactor(); w.maxLife = w.life; }
      this.story('Wounded', text, 'danger', { cue: 'harm' });
    } else if (this.cardsOf('wound', true).length) {
      this.s.stats.killedBy = cause || null;
      this.story('The Last Blow', text, 'danger', { cue: 'harm' });
      this.gameOver('death', { threat: 'wound', killedBy: cause || null });
    } else {
      this.create('fatigue');
      this.create('fatigue');
      this.story('Beaten on the Stair', text + ' There was no strength in you to lose. You lie on the stair until the watchman finds you.', 'danger', { cue: 'harm' });
    }
  };
  // Would the next blow kill you: a Wound carried, and no Health left to lose.
  P.blowWouldKill = function () {
    return this.cardsOf('wound', true).length > 0 && !this.cardsOf('health', true).length && !this.cardsOf('spent_health', true).length;
  };

  // ---- Thresholds ----------------------------------------------------------
  // The Council withholds the letter of office while it is displeased, unless
  // the Bishop speaks for you. The UI reads this to mark the Standing meter.
  P.promotionHeld = function () {
    var f = this.s.favour || {};
    return (f.council || 0) <= -2 && (f.bishop || 0) < 3;
  };
  // The Seat is a short campaign: the Council does not seat a Magistrate
  // of less than CF.SEAT_WEEKS in the red gown, and votes only with the
  // pledges of all three powers (Favour CF.SEAT_PLEDGE each, earned by
  // answering their commissions as they wish). The UI reads seatPledges()
  // for the three seals on the Seat.
  CF.SEAT_WEEKS = 4;
  CF.SEAT_PLEDGE = 1;
  P.seatSeasoned = function () {
    var s = this.s;
    return typeof s.rankWeek !== 'number' || s.rankWeek < 0 || s.week - s.rankWeek >= CF.SEAT_WEEKS;
  };
  P.seatPledges = function () {
    var f = this.s.favour || {}, out = { n: 0 };
    ['council', 'bishop', 'guild'].forEach(function (k) { out[k] = (f[k] || 0) >= CF.SEAT_PLEDGE; if (out[k]) out.n++; });
    out.all = out.n === 3;
    return out;
  };
  // The record the Council counts: cases answered (convictions and the
  // thief-takers' settlements), less the wrong names hanged.
  P.rankRecord = function () {
    var st = this.s.stats || {};
    return Math.max(0, (st.convictions || 0) - (st.wrongful || 0) + (st.settled || 0));
  };
  // How many more cases the Council wants answered before it writes for the
  // next office (0 when the record is enough). The UI reads it to mark the
  // Standing meter, as it reads promotionHeld.
  P.recordShort = function () {
    var need = (CF.RANK_RECORD || [])[this.s.rank + 1] || 0;
    return Math.max(0, need - this.rankRecord());
  };
  P.checkThresholds = function () {
    var s = this.s;
    if (s.over) return;
    var self = this;
    var free = function (def) {
      return self.cardsOf(def).filter(function (c) { return c.loc.t === 'table' || c.loc.t === 'out'; });
    };

    // A predecessor's drawer is told once the desk is yours.
    var L = s.flags.legacy;
    if (L && !L.told && (!s.flags.opening || s.flags.stage === 'hired' || s.flags.stage === 'keep')) this.legacyStory();

    // A strain card never waits without its cure: Rest opens with the first one.
    var rest = s.verbs.reflect;
    if (rest && !rest.unlocked && this.introUnlock && ['fatigue', 'obsession', 'burnout', 'tunnel'].some(function (d) { return self.cardsOf(d, true).length; })) this.introUnlock(['reflect']);

    var fat = free('fatigue');
    if (fat.length >= 3) {
      if (this.countOf('burnout')) { this.strainEnds('collapse', { threat: 'fatigue', weariness: fat.length }); return; }
      fat.slice(0, 3).forEach(function (c) { self.remove(c); });
      var fever = this.create('burnout');
      this.story('Fever', U.pick(this.rng, CF.FEVER_TEXTS), 'danger', { cue: 'harm', uid: fever.uid });
      // For the interface: an edge mark and a pan to the card, and the game slowed on a phone.
      this.emit('strain', { uid: fever.uid, def: 'burnout', ends: true });
    }

    var obs = free('obsession');
    if (obs.length >= 3) {
      if (this.countOf('tunnel')) { this.strainEnds('consumed', { threat: 'obsession', obsessions: obs.length }); return; }
      obs.slice(0, 3).forEach(function (c) { self.remove(c); });
      var fix = this.create('tunnel');
      this.emit('strain', { uid: fix.uid, def: 'tunnel', ends: false });
      this.story('Fixation', 'The walls of your study are covered in string and paper. You are certain you are right. You are certain of everything now. That should frighten you more than it does.', 'danger', { uid: fix.uid });
    }

    if (s.meters.pressure >= this.meterMax('pressure')) { this.gameOver('dismissed', { meter: 'pressure' }); return; }
    if (s.meters.dread >= this.meterMax('dread')) { this.gameOver('riot', { meter: 'dread' }); return; }
    if (s.meters.scrutiny >= this.meterMax('scrutiny')) { this.gameOver('corruption', { meter: 'scrutiny' }); return; }

    // Promotion boards. A displeased Council does not write, unless the Bishop speaks for you.
    if (s.rank < (this.rankCap ? this.rankCap() : CF.TOP_RANK) && s.meters.reputation >= CF.RANK_REP[s.rank + 1] && !this.cardsWith('promotion').length) {
      var next = CF.RANK_DEFS[s.rank + 1], short = this.recordShort();
      if (short > 0) {
        // Rank waits for the record: the Council knows the name before it writes.
        if (!s.flags['recordHeld' + (s.rank + 1)]) {
          s.flags['recordHeld' + (s.rank + 1)] = true;
          this.story('The Council Knows Your Name', U.fill(short === 1 ? 'The Council knows your name; it wants one more case answered before it writes for the office of {office}.' : 'The Council knows your name; it wants {n} more cases answered before it writes for the office of {office}.', { n: short, office: next.label }), 'major');
        }
      } else if (this.promotionHeld()) {
        if (!s.flags['promoHeld' + (s.rank + 1)]) {
          s.flags['promoHeld' + (s.rank + 1)] = true;
          this.story('The Council Does Not Write', 'You have the Standing for the office of ' + next.label + ', and the letter does not come. Your patron on the Council is not your patron any more. Answer a commission of the Council\'s, or let the Bishop speak for you, and it will.', 'danger');
        }
      } else {
        this.create('promotion', { label: 'The Council\'s Letter: ' + next.label, desc: next.text + ' Attend on the Council.', data: { rank: s.rank + 1 } });
        this.story('The Council Takes Notice', 'A letter on heavy paper under the city\'s seal: the Council will see you about the office of ' + next.label + '. Attend on them, in a clean collar.', 'major');
      }
    }
    // The Seat: one at a time (a Seat held by the vote counts), and a failed vote waits six weeks.
    if (s.flags.chairCooldown && s.week >= s.flags.chairCooldown) s.flags.chairCooldown = 0;
    if (s.calling === 'commissioner' && s.rank === CF.TOP_RANK && this.seatSeasoned() && s.meters.reputation >= CF.COMMISSIONER_REP && !this.cardsOf('chair', true).length && !(s.flags.chairCooldown > s.week)) {
      this.create('chair');
      // The first time a death; after that, the man the Council chose instead (s.flags.burgomaster) wears out.
      var bm = s.flags.burgomaster, seals = 'The vote wants three seals: the Council\'s, the Bishop\'s and the Guilds\'.';
      if (bm) this.story('The Seat Is Empty', [U.fill('{name} has lasted a season and the Council has had enough of him. It will choose again, and your name is on the list.', { name: bm }), seals], 'major');
      else if (s.flags.seatTold) this.story('The Seat Is Empty', ['The Council has not settled on a Burgomaster. It will vote again, and your name is still on the list.', seals], 'major');
      else this.story('The Seat Is Empty', ['The Burgomaster is dead of a stone. The Council will choose a successor, and your name is on the list.', seals], 'major');
      s.flags.seatTold = true;
    }
    // The Hangman's shut door: the Standing for the next office, and no letter will ever come. Told once.
    var cap = this.rankCap ? this.rankCap() : CF.TOP_RANK;
    if (cap < CF.TOP_RANK && s.rank >= cap && !s.flags.capTold && s.meters.reputation >= CF.RANK_REP[cap + 1]) {
      s.flags.capTold = true;
      this.story('The Letter That Will Not Come', U.fill('You have the Standing for the red gown, and every councillor knows it. None of them will seat a hangman on the bench. The sergeant says it for them: {office} is as high as the Ravenstone reaches.', { office: CF.RANK_DEFS[cap].label }), 'major');
    }
    // The Council's favour: past the last office, a Writ of the Council at every step of Standing.
    var fav = this.favourNext();
    if (fav && fav.step > fav.given) {
      s.flags.favourStep = fav.step;
      this.create('councilwrit');
      this.story('Writ of the Council', fav.given ? 'The Council writes again, under the city\'s seal: one more favour, when you need it.' :
        'There is no office left for the Council to give you, so it gives you its favour instead: a writ under the city\'s seal, good for one thing you ask.', 'major');
    }
  };

  // ---- The Council's favour (round 8) ------------------------------------------
  // Past the last office (the red gown, or the highest a hangman may rise),
  // every CF.FAVOUR_STEP Standing the Council writes a Writ of the Council:
  // once per step (s.flags.favourStep counts the steps written). In Attend it
  // does one thing, by what goes with it: a Case taken off your hands (no
  // Crowd, Standing -1), the Rolls (Suspicion -2), the Rival (recalled for
  // CF.FAVOUR_RECALL weeks) or a Witness (held for the Court).
  // favourNext() is { base, step, given, at } at the top office, else null:
  // `at` is the Standing of the next writ, for the Standing meter.
  CF.FAVOUR_STEP = 4;
  CF.FAVOUR_RECALL = 8;
  CF.FAVOUR_HOLD = 120;
  CF.FAVOUR_INFO = 'Past the last office, every four Standing the Council grants you a favour.';
  P.favourNext = function () {
    var s = this.s, cap = this.rankCap ? this.rankCap() : CF.TOP_RANK;
    if ((s.rank || 0) < cap) return null;
    var base = CF.RANK_REP[Math.min(cap + 1, CF.TOP_RANK)];
    var rep = s.meters.reputation || 0, given = s.flags.favourStep || 0;
    var step = Math.max(0, Math.floor((rep - base) / CF.FAVOUR_STEP));
    return { base: base, step: step, given: given, at: base + CF.FAVOUR_STEP * (given + 1) };
  };
  // Will the Council take this case off your hands? An ordinary case still open; not the city's great ones.
  P.councilMayTake = function (rec) {
    return !!rec && rec.status === 'open' && !rec.special && !rec.opening && rec.template !== 'pattern';
  };
  // What the writ will do with this card, for the verb's preview.
  P.councilFavourGives = function (card) {
    if (!card) return '';
    if (card.def === 'case') return 'The Council takes it off your hands: no Crowd, Standing -1.';
    if (card.def === 'paperwork') return 'The clerks lose a leaf of their list: Suspicion -2.';
    if (card.def === 'rival') return U.fill('The Harbourmaster\'s examiner is recalled for {n} weeks.', { n: CF.FAVOUR_RECALL });
    if (card.def === 'witness') return 'Held for the Court: they stay in the city until it sits.';
    return '';
  };
  // Use the writ on a card (the Attend recipe): what it did, as story text.
  P.councilFavour = function (card) {
    var s = this.s;
    if (!card) return 'The writ is filed, and nothing comes of it.';
    if (card.def === 'case') {
      var rec = this.caseRec(card.caseId);
      if (!this.councilMayTake(rec)) return 'The Council will not take this one off your hands.';
      return this.councilTakes(rec);
    }
    if (card.def === 'paperwork') {
      this.remove(card, 'none');
      this.meter('scrutiny', -2);
      return 'The writ goes to the clerks with the Rolls under it. Two leaves of their list go into the fire. Suspicion -2.';
    }
    if (card.def === 'rival') {
      var name = card.data && card.data.name || 'The Harbourmaster\'s examiner';
      this.remove(card, 'left');
      s.flags.rivalGone = Math.max(s.flags.rivalGone || 0, s.week + CF.FAVOUR_RECALL);
      this.openCases().forEach(function (r) { if (r.rival) { r.rival = false; r.rivalBoasted = false; } });
      return U.fill('The Council writes to the Customs House. {name} is recalled, and their desk is empty by the Bell. The Harbourmaster will not try again for {n} weeks.', { name: name, n: CF.FAVOUR_RECALL });
    }
    if (card.def === 'witness') {
      card.life = (card.life || 0) + CF.FAVOUR_HOLD;
      card.maxLife = Math.max(card.maxLife || 0, card.life);
      card.data = card.data || {};
      card.data.held = true;
      this.dirty = true;
      return U.fill('The Council\'s writ holds {name} in the city for the Court. They grumble, and stay.', { name: this.labelOf(card).replace(/^Witness: /, '') });
    }
    return 'The writ is filed, and nothing comes of it.';
  };
  // The Council takes a case off your hands: closed by its own sergeants, the
  // right name taken quietly. Not a case gone cold (no Crowd, no Unanswered
  // card, nobody walks) and not yours either: Standing -1.
  P.councilTakes = function (rec) {
    var s = this.s;
    var card = this.caseCard(rec.id);
    var seat = card ? { uid: card.uid, at: card.loc && card.loc.t === 'table' ? { x: card.loc.x, y: card.loc.y } : null } : null;
    if (card) this.remove(card);
    rec.status = 'council';
    if (rec.commission && !rec.commission.delivered) rec.commission.delivered = 'council';
    this.releaseDelegate(rec);
    var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0] || null;
    s.stats.councilTook = (s.stats.councilTook || 0) + 1;
    this.emit('resolved', this.caseRecord(rec, 'council', culprit ? culprit.name : null, seat));
    this.clearCaseCards(rec.id);
    this.meter('reputation', -1);
    if (culprit) {
      var c = this.criminalByName(culprit.name);
      if (c) { c.status = 'jailed'; c.history.push({ week: s.week, title: rec.title, how: 'council' }); var al = this.atLargeCardFor(c); if (al) this.remove(al); }
    }
    return U.fill('The Council\'s sergeants take {title} off your hands. {name} is taken quietly at first light, and the Rolls say the case is answered. Not by you: Standing -1.', { title: rec.title, name: culprit ? culprit.name : 'Somebody' });
  };
  // A Magistrate's endowment granted (the Petition paid): what it does, as story text.
  P.endowed = function (key) {
    if (key === 'abbey') {
      if (this.favourGain) this.favourGain('bishop', 2);
      return 'The Abbey hospital has a new ward with your name over the door. The Bishop\'s favour +2, and a bed kept for you: a Weariness lifted at every Bell.';
    }
    if (key === 'lanes') return 'Lanterns go up at every corner of the Stews and the Warrens, and a lamplighter walks them at dusk. A blow on the stair comes less often now.';
    return '';
  };
  // ---- The Council counts (round 8) ---------------------------------------------
  // From Bailiff the Council expects cases answered: rank - 1 a fortnight
  // (the record it counts, rankRecord). At the fortnight's Bell, met, the
  // Crowd eases a step; part met, it is only said; nothing answered at all,
  // the Crowd rises a step, but only while it is below
  // CF.COUNCIL_COUNT.crowdBelow: a nudge, never a road to dismissal.
  //   s.councilCount = { from: week, record }   the fortnight being counted (null below Bailiff)
  // councilExpects() is { n, m, weeksLeft } for the Bell's pane, else null.
  CF.COUNCIL_COUNT = { rank: 2, weeks: 2, crowdBelow: 2 };
  P.councilExpects = function () {
    var s = this.s, C = CF.COUNCIL_COUNT, c = s.councilCount;
    if ((s.rank || 0) < C.rank) return null;
    var m = (s.rank || 0) - 1;
    if (!c) return { n: 0, m: m, weeksLeft: C.weeks };
    return { n: Math.max(0, this.rankRecord() - (c.record || 0)), m: m, weeksLeft: Math.max(0, c.from + C.weeks - s.week) };
  };
  P.councilCountWeek = function () {
    var s = this.s, C = CF.COUNCIL_COUNT, lines = [];
    if ((s.rank || 0) < C.rank) { s.councilCount = null; return lines; }
    if (!s.councilCount) { s.councilCount = { from: s.week, record: this.rankRecord() }; return lines; }
    if (s.week - s.councilCount.from < C.weeks) return lines;
    var ex = this.councilExpects();
    if (ex.n >= ex.m) {
      if (s.meters.pressure > 0) this.meter('pressure', -1);
      lines.push(U.fill('The Council counts what you closed: {n} of {m} this fortnight, and is content. The Crowd eases.', ex));
    } else if (ex.n > 0) {
      lines.push(U.fill('The Council counts what you closed: {n} of {m} this fortnight. It expected more.', ex));
    } else {
      if (s.meters.pressure < C.crowdBelow) this.meter('pressure', 1);
      lines.push(U.fill('The Council counts what you closed: {n} of {m} this fortnight. It expected more, and the Crowd hears of it.', ex));
    }
    s.councilCount = { from: s.week, record: this.rankRecord() };
    return lines;
  };
  // Whether an endowment has been paid (the Petition granted).
  P.endowedWith = function (key) { return !!(this.s.flags.bought || {})[key] && !!CF.ORDERS[key] && !!CF.ORDERS[key].endow; };

  // ---- The calendar (round 8) ------------------------------------------------
  // The year turns in four quarters of thirteen weeks, counted from the hire:
  // (week - 1) % 52. Two of them change the crimes the city sends (`weigh`:
  // a crime's share of casePool multiplied), and the Fair leaves purses on the
  // desk more often (`purse`, added to the week's chance). The Bell says the
  // season the week it turns (`line`); the interface reads season() for the
  // week bar: `name`, and `effect` (null when nothing changes).
  CF.YEAR_WEEKS = 52;
  CF.SEASONS = [
    { id: 'lent', name: 'Lent', from: 1, weigh: {}, purse: 0, effect: null,
      line: 'Lent: fish on every table, and the taverns shut at vespers.' },
    { id: 'fair', name: 'The Midsummer Fair', from: 14, weigh: { fraud: 2, coining: 2, extortion: 2 }, purse: 0.1,
      effect: 'More fraud, false coin and protection; more purses on the desk.',
      line: 'The Midsummer Fair: booths in the Market, strangers at every inn, and more false coin than true.' },
    { id: 'plague', name: 'The Plague Summer', from: 27, weigh: { poison: 2, missing: 2 }, purse: 0,
      effect: 'More poisonings, and more of the missing.',
      line: 'The Plague Summer: the Abbey cart goes round twice a day.' },
    { id: 'winter', name: 'Winter', from: 40, weigh: {}, purse: 0, effect: null,
      line: 'Winter: ice in the Harbour, and the night watch doubled.' },
  ];
  // The week of the year (1 to 52) for a week of the run (default: this one).
  P.weekOfYear = function (week) {
    var w = typeof week === 'number' ? week : this.s.week;
    return ((Math.max(1, w) - 1) % CF.YEAR_WEEKS) + 1;
  };
  P.season = function (week) {
    var wy = this.weekOfYear(week), out = CF.SEASONS[0];
    CF.SEASONS.forEach(function (x) { if (wy >= x.from) out = x; });
    return out;
  };
  // The Bell's first line the week a season turns, else null.
  P.seasonLine = function () {
    var sea = this.season();
    return this.s.week > 1 && this.weekOfYear() === sea.from ? sea.line : null;
  };

  // ---- The Assize: the Council reads your half-year aloud --------------------
  // At the Bell of week 26 (or the first Bell after it, to week 29, when a
  // question was waiting), the clerk reads the record in the chamber and the
  // Council asks what the Examiner wants of it (the 'assize' question,
  // patrons.js). s.flags.assize = { week, record } once read; an older save
  // past week 29 had none (load).
  CF.ASSIZE = { week: 26, last: 29 };
  P.assizeRecord = function () {
    var st = this.s.stats || {};
    return { cases: st.cases || 0, convictions: st.convictions || 0, acquittals: st.acquittals || 0, cold: st.cold || 0,
      wrongful: st.wrongful || 0, sentHome: st.sentHome || 0, attacks: st.attacks || 0 };
  };
  // The reading, as lines (the journal keeps them; the interface may show them again).
  P.assizeLines = function (r) {
    var lines = [U.fill('Cases sent to your desk: {n}.', { n: r.cases }),
      U.fill('Convicted: {c}. Acquitted: {a}. Gone cold: {k}.', { c: r.convictions, a: r.acquittals, k: r.cold })];
    if (r.wrongful) lines.push(U.fill('Wrong names, by the ballads\' count: {n}.', { n: r.wrongful }));
    if (r.sentHome) lines.push(U.fill('Sent home from the Court: {n}.', { n: r.sentHome }));
    if (r.attacks) lines.push(U.fill('Blows taken in the city\'s service: {n}.', { n: r.attacks }));
    lines.push(r.convictions > r.acquittals + r.cold + r.wrongful
      ? 'The councillors knock on the benches. In this chamber, that is applause.'
      : 'The councillors say nothing. In this chamber, that is a verdict.');
    return lines;
  };
  P.assizeWeek = function () {
    var s = this.s;
    if (s.flags.assize || s.over || s.week < CF.ASSIZE.week || s.week > CF.ASSIZE.last) return [];
    if (s.choice || !this.offerLate) return []; // a question waits: the Assize sits at the next Bell
    var rec = this.assizeRecord();
    s.flags.assize = { week: s.week, record: rec };
    this.story('The Assize', ['Twenty-six weeks. The Council\'s clerk reads your half-year aloud in the chamber.'].concat(this.assizeLines(rec)), 'major');
    this.offerLate('assize');
    return ['The Assize sits. The Council has read your half-year.'];
  };

  // ---- The Long Service: a year at the top of your road ---------------------
  // A run at its rank cap (rankCap) that has not otherwise ended is pensioned
  // at week 52: told four weeks before (s.flags.longService = the week told),
  // and ended no sooner than four weeks after the telling, so a file that
  // reaches the cap late, or an older save, still has its warning.
  CF.LONG_SERVICE = { week: 52, warn: 4 };
  P.atRankCap = function () { return (this.s.rank || 0) >= (this.rankCap ? this.rankCap() : CF.TOP_RANK); };
  // The week the pension falls due (for the journal's Roads), or null while
  // the run is not at its cap.
  P.longServiceDue = function () {
    var s = this.s, L = CF.LONG_SERVICE;
    if (!this.atRankCap()) return null;
    var told = typeof s.flags.longService === 'number' ? s.flags.longService : Math.max(L.week - L.warn, s.week);
    return Math.max(L.week, told + L.warn);
  };
  // At the Bell: the warning, or the ending. Returns the Bell's line, or null.
  P.longServiceWeek = function () {
    var s = this.s, L = CF.LONG_SERVICE;
    if (s.over || !this.atRankCap()) return null;
    if (typeof s.flags.longService !== 'number') {
      if (s.week < L.week - L.warn) return null;
      s.flags.longService = s.week;
      return 'The Council is drawing up your pension. Four more weeks.';
    }
    if (s.week >= this.longServiceDue()) this.gameOver('longservice');
    return null;
  };

  // ---- Endings -------------------------------------------------------------
  CF.ENDINGS = {
    dismissed: { win: false, title: 'Dismissed', text: 'The city lost patience. Too many names the crier sang, too many of them walking free. The Burgomaster takes your letter of office back in front of the whole Watch-house and does not meet your eyes.',
      threat: 'pressure', lesson: 'The Crowd rises with every case left unanswered and every name that walks free. Convictions quiet it, and Coin given where the clerks can see.' },
    burnout: { win: false, title: 'The Fever', text: 'One morning you simply do not come in. Or the next. The letter to the Council is two lines long. Someone else sits under the stair now, and the cases keep coming.',
      threat: 'burnout', lesson: 'The Fever ends the file when its clock runs out. The Fever alone in Rest cures it; Coin with it makes it quick.' },
    collapse: { win: false, title: 'Collapse', text: 'You fall on the Watch-house stair and do not get up. The barber-surgeon uses words like "a surfeit" and "the heart" and "rest, in the country". The city does not send flowers.',
      threat: 'fatigue', lesson: 'Three Weariness make a Fever, and three more while it lasts are the end. Sleep them off in Rest before the third.' },
    consumed: { win: false, title: 'Lost in the Case', text: 'You stop going to your lodging. You stop shaving. You stop answering to your name. When they finally break the door of your study, every wall is covered, and none of it makes sense to anyone but you.',
      threat: 'obsession', lesson: 'Three Obsessions make a Fixation, and three more while it lasts are the end. Let them go in Rest before the third.' },
    corruption: { win: false, title: 'The Council\'s Sergeants', text: 'The Council\'s sergeants come for you at first light, with a writ and a sack for your things. The beaten confessions, the purses, the proof that appeared from nowhere. They kept a list too.',
      threat: 'scrutiny', lesson: 'Suspicion rises with searches without a Writ, proof arranged, purses pocketed and questions put with Health. The Rolls entered, and time, let it fall.' },
    merciful: { win: true, title: 'The Merciful Judge', text: 'Twelve times you sent a poor sinner home instead of to the Ravenstone, and four of them are citizens now with stalls in the Market and children who do not know what their fathers were. The Council never understood it. The city did. When you go, they carry the bier themselves.' },
    hangmans: { win: false, title: 'The Hangman\'s Examiner', text: 'The Council keeps you, because the city is quiet. The city fears you, because it knows why. You live outside the walls now, in the executioner\'s house by the Ravenstone, and dine with him, because nobody else will. The work goes on. It is very quiet.' },
    stake: { win: false, title: 'The Stake', text: 'The Inquisitor\'s charge lands on you: heresy, from a patron you crossed, sworn to by two men you sent to the Hole. The proof against you is the proof you taught the city to want. The Bishop does not answer your letter. The Fire on Friday.' },
    dagger: { win: false, title: 'The Dagger on the Pillow', text: 'They warned you once. A dagger on the pillow, and the door still barred. You did not pay, and you did not leave, and one morning the servant who brings the water is not the servant. The Order of the Mountain keeps its word, in daylight, before witnesses, and nobody in the city will say they saw it.',
      threat: 'dagger', lesson: 'Answer the dagger on the pillow before it fades: in Rest with Coin, or alone, or in Attend with a watchman. Left to lie, it is the end.' },
    kingofthunes: { win: true, title: 'The King of Thunes', text: 'The old King goes into the river and the Court kneels to a new one who keeps the Examiner\'s desk by day. Crimes fall in number and rise in scale. You decide who is caught, and the Council thanks you for the quiet. Under the Warrens, where the lame walk and the blind see, they sing a new name.' },
    treatycity: { win: true, title: 'The Treaty City', text: 'Twelve quiet weeks. The Stews keep their own peace, the Court tries its own, the Rolls fill with answered cases, and the Council votes you a pension for the calm it does not ask about. You retire rich to a house on the Hill. The city calls it peace, and for the years you have left, it is.' },
    thieftaker: { win: true, title: 'The Thief-taker General', text: 'The city has never had an officer so effective, or so rich. Every fence in the Free City pays you, every victim thanks you, and the Council votes you a chain of office without asking where the goods you recover come from. You know. You are the only one who does. It will hold for years, if nobody ever reads the ledger.' },
    oldbailey: { win: false, title: 'The Old Bailey', text: 'Somebody you hanged had a brother, and the brother had a ledger. The Council makes a new law with your trade in it, word for word, and tries you under it in the same court where you sent so many. Two witnesses. Your own men. The ballad is already printed.' },
    riot: { win: false, title: 'The Crowd Turns', text: 'The next execution is meant to be a lesson. The crowd has learned a different one. When the cart reaches the Ravenstone they take the poor sinner off it, and then they come for you. You get out of the city by the Harbour gate with what you are wearing. The Council does not send after you.',
      threat: 'dread', lesson: 'Dread rises with leaning on people and cruelty on the ladder. Mercy and fair dealing let it fall.' },
    death: { win: false, title: 'Killed in the Council\'s Service', text: 'They give you a bell, a Mass and a line in the Rolls. The people who did it are drinking to your memory in a cellar by the Harbour.',
      threat: 'wound', lesson: 'With no Health left and a Wound carried, the next blow kills. Dress the Wound in Rest before you walk into danger again.' },
    commissioner: { win: true, title: 'The Burgomaster', text: 'The Council votes, and it is not close. You take the Seat, the chamber with the window and the city\'s Watch, and you begin, slowly, to remake it in your own image. Somewhere a new examiner sits under the stair. You make sure they have what you did not.' },
    master: { win: true, title: 'The Scholar', text: 'The Architect is sentenced on a grey Tuesday. Every crime you ever worked had their hand on it, if you knew where to look. You did. The scriveners are copying your casebook for the law faculties. You find the same three strokes cut into your own lintel, and you rub them out with your thumb.' },
    crusader: { win: true, title: 'The Reformer', text: 'The Court of Miracles is a wet cellar with nobody in it. The King of Thunes hangs on the Ravenstone. It cost you more than you will ever say, and the city will grow new thieves like weeds through cobbles. But for one bright season, nobody is above the law.' },
    longservice: { win: true, title: 'The Long Service', text: 'Fifty-two weeks under the stair and in the chamber, and the city is still standing. The Council gives you a pension, a house by the Abbey Close and a line in the Rolls in red ink. You never caught them all. Nobody does.' },
  };
  // Every ending has its words in CF.ENDING_VARIANTS (js/data/story.js); the
  // Long Service brings its own until the story gives it more.
  if (CF.ENDING_VARIANTS && !CF.ENDING_VARIANTS.longservice) CF.ENDING_VARIANTS.longservice = [{ text: CF.ENDINGS.longservice.text }];

  // A losing ending says what would have saved you: `lesson` (one line, the
  // remedy) and `threat` (the card or meter that ended it, for its icon).
  // s.over.cause is what the engine saw: { threat, seconds, restIdle } for
  // the Fever, { meter } for a meter, { killedBy } for the last blow.
  // s.over.lesson is the line for the end paper, with the specific part first.
  P.endingLesson = function (id, cause) {
    var end = CF.ENDINGS[id];
    if (!end || !end.lesson) return null;
    var lead = '';
    if (id === 'burnout' && cause && cause.restIdle) lead = 'Rest stood idle the whole time the Fever ran. ';
    return lead + end.lesson;
  };

  // The Abbey takes you in: the first strain ending (the Fever, Collapse,
  // Lost in the Case) of a junior's first weeks is a week in the Abbey
  // hospital instead. Once a file (flags.abbey); the second time it is the end.
  CF.ABBEY = { rank: 0, weeks: 4 };
  CF.STRAIN_ENDINGS = { burnout: ['burnout', 'fatigue'], collapse: ['burnout', 'fatigue'], consumed: ['tunnel', 'obsession'] };
  P.abbeyOpen = function (id) {
    var s = this.s;
    return !!CF.STRAIN_ENDINGS[id] && !s.over && !s.flags.abbey && s.rank <= CF.ABBEY.rank && s.week <= CF.ABBEY.weeks;
  };
  P.strainEnds = function (id, cause) {
    if (this.abbeyOpen(id)) { this.abbeyTakesYou(id); return 'abbey'; }
    this.gameOver(id, cause);
    return 'over';
  };
  P.abbeyTakesYou = function (id) {
    var s = this.s, self = this;
    s.flags.abbey = { week: s.week, ending: id };
    CF.STRAIN_ENDINGS[id].forEach(function (d) { self.cardsOf(d).forEach(function (c) { self.remove(c); }); });
    this.meter('reputation', -1);
    var coin = this.cardsOf('funds')[0];
    if (coin) this.remove(coin); else this.count('debt');
    this.story('The Abbey Takes You In', 'The Grey Sisters find you on the Watch-house stair and carry you to the Abbey hospital. A week of broth, bells and clean linen, and the Council hears where you were. ' +
      (coin ? 'You leave a Coin in the alms box.' : 'The Sisters write your name in their book of debts.') + ' They will not take you in twice.', 'major', { cue: 'quiet' });
    this.emit('abbey', { ending: id });
    // The week you lay there: the Bell rings, unless it has not yet been given to you.
    if (!s.flags.bellSilent) { s.weekT = 0; this.weekTick(); }
  };

  P.gameOver = function (id, cause) {
    var s = this.s;
    if (s.over) return;
    var end = CF.ENDINGS[id];
    if (this.reformedCount) s.stats.reformed = this.reformedCount();
    // Every citizen made was first sent home: the Merciful ending never counts fewer sent than reformed.
    s.stats.sentHome = Math.max(s.stats.sentHome || 0, s.stats.reformed || 0);
    var text = CF.Story ? CF.Story.ending(this, id) : end.text;
    s.over = { id: id, win: end.win, title: end.title, text: text, week: s.week, origin: s.origin, calling: s.calling,
      cause: cause || null, threat: end.threat || null, lesson: end.win ? null : this.endingLesson(id, cause) };
    s.over.epilogue = this.epilogue();
    this.story(end.title, text, end.win ? 'victory' : 'defeat');
    s.legacy = this.buildLegacy();
    this.emit('over', s.over);
  };

  // Where each kind of proof comes from, as ways the desk can use today
  // (round 8): `ok(e, rec)` says whether the way is open now. The advisor and
  // the aspect popover show only the open ones (aspectSources); the last way
  // of each kind is always open, so there is always something to say.
  function onTable(e, pred) { return e.tableCards().some(pred); }
  CF.ASPECT_SOURCES = {
    forensic: [
      { text: 'an instrument on the scene or the body, read in Study', ok: function (e) { return onTable(e, function (c) { return CF.aspectsOf(c).tool > 0; }); } },
      { text: 'the scene searched, and what it gives read in Study', ok: function () { return true; } },
    ],
    testimony: [
      { text: 'a witness in Question', ok: function (e, rec) { return onTable(e, function (c) { return c.def === 'witness' && (!rec || c.caseId === rec.id); }); } },
      { text: 'door to door with {quarter}', ok: function (e, rec) { return !!rec && !!rec.district && e.hasDistrict(rec.district); } },
      { text: 'the accused confronted with a token in Question', ok: function () { return true; } },
    ],
    motive: [
      { text: 'the accused questioned with Wit', ok: function (e, rec) { return onTable(e, function (c) { return c.def === 'suspect' && (!rec || c.caseId === rec.id); }); } },
      { text: 'coin and quarrels laid side by side in Rest', ok: function () { return true; } },
    ],
    opportunity: [
      { text: 'door to door with {quarter}', ok: function (e, rec) { return !!rec && !!rec.district && e.hasDistrict(rec.district); } },
      { text: 'the scene searched again; two descriptions laid side by side in Rest', ok: function () { return true; } },
    ],
    digital: [
      { text: 'a search of the accused\'s lodging with a Writ', ok: function (e) { return e.s.rank >= 1; } },
      { text: 'the Rolls', ok: function (e) { return !!e.s.rooms.archive; } },
      { text: 'ledgers and papers read in Study', ok: function () { return true; } },
    ],
    financial: [
      { text: 'ledgers, pledges and chits read in Study', ok: function () { return true; } },
    ],
  };
  // The ways open today to find proof of `aspect` for a case (a record or its id), as text.
  P.aspectSources = function (aspect, recOrId) {
    var rec = recOrId && typeof recOrId === 'object' ? recOrId : recOrId ? this.caseRec(recOrId) : null;
    var self = this, list = CF.ASPECT_SOURCES[aspect] || [];
    var quarter = rec && rec.district && CF.DISTRICTS[rec.district] ? CF.DISTRICTS[rec.district].label : 'its Quarter';
    return list.filter(function (w) { return w.ok(self, rec); }).map(function (w) { return U.fill(w.text, { quarter: quarter }); });
  };
  // The opening case's own Quarter, at the hire: door to door is learnt in the
  // first case. Only that one district comes out of the stash; the rest wait
  // for the first conviction. Returns the card, or null.
  CF.OPENING_QUARTER = 'Go door to door: the case with its Quarter in Explore finds the people who saw.';
  P.openingQuarter = function () {
    var s = this.s;
    if (s.flags.stage !== 'hired') return null;
    var rec = this.openCases().filter(function (r) { return r.opening; })[0];
    if (!rec || !rec.district || !CF.DISTRICTS[rec.district] || this.hasDistrict(rec.district)) return null;
    var stash = s.intro && s.intro.stash, card = null;
    for (var i = 0; stash && i < stash.length; i++) {
      var it = stash[i];
      if (it.def === 'district' && it.spec && it.spec.data && it.spec.data.district === rec.district) { stash.splice(i, 1); card = this.create('district', it.spec); break; }
    }
    if (card) (s.flags.districts = s.flags.districts || {})[rec.district] = true;
    return card || this.giveDistrict(rec.district);
  };

  // U.fill, with a value that opens the text or a sentence capitalised: a
  // witness called 'the Tiler' starts a sentence as 'The Tiler'. English
  // only: the Arabic dictionaries translate the filled text as a template.
  CF.fillCap = function (text, vars) {
    var t = String(text || '').replace(/(^|[.!?]"? )\{(\w+)\}/g, function (m, pre, k) {
      var v = vars && vars[k] !== undefined ? String(vars[k]) : null;
      return v === null ? m : pre + v.charAt(0).toUpperCase() + v.slice(1);
    });
    return U.fill(t, vars);
  };
  // Small numbers in words, for an ending that counts them in words.
  CF.NUMBER_WORDS = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  CF.numberWord = function (n, cap) {
    var w = n >= 0 && n < CF.NUMBER_WORDS.length && n === Math.floor(n) ? CF.NUMBER_WORDS[n] : String(n);
    return cap ? w.charAt(0).toUpperCase() + w.slice(1) : w;
  };
  // What an ending may name besides the run's numbers (CF.Story.ending fills
  // its text from this): the King of Thunes and the Architect as this run
  // knew them, how the last blow fell, and the counts in words.
  //   {king} {architect} {architectRole} {killedBy}
  //   {sentHomeWord} {SentHomeWord} {reformedWord} {ReformedWord}
  P.endingVars = function () {
    var s = this.s, st = s.stats || {}, out = {};
    Object.keys(st).forEach(function (k) { out[k] = st[k]; });
    var king = null;
    Object.keys(s.criminals || {}).forEach(function (k) { if (s.criminals[k].king && !king) king = s.criminals[k].name; });
    if (!king && s.court && s.court.king && s.court.king.name) king = s.court.king.name;
    out.king = king || 'the King of Thunes';
    var arch = null;
    Object.keys(s.cases || {}).forEach(function (k) {
      var rec = s.cases[k];
      if (rec.template !== 'architect' || (arch && arch.closed)) return;
      var cul = (rec.suspects || []).filter(function (x) { return x.guilty; })[0];
      if (cul) arch = { name: cul.name, role: cul.role || '', closed: rec.status === 'closed' };
    });
    out.architect = arch ? arch.name : 'the Architect';
    out.architectRole = arch && arch.role ? arch.role : 'a patient man';
    out.killedBy = st.killedBy || null;
    out.sentHomeWord = CF.numberWord(st.sentHome || 0);
    out.SentHomeWord = CF.numberWord(st.sentHome || 0, true);
    out.reformedWord = CF.numberWord(st.reformed || 0);
    out.ReformedWord = CF.numberWord(st.reformed || 0, true);
    return out;
  };

  // What became of them (round 8): the run's own late story, told back under
  // the ending. Up to four lines, each { id, text } (id keys an icon: pattern,
  // coquille, rival, abroad, watch), drawn from state alone, never from the
  // dice: the same run gives the same lines. gameOver keeps them in s.over.
  P.epilogue = function () {
    var s = this.s, st = s.stats || {}, out = [];
    var cases = Object.keys(s.cases || {}).map(function (k) { return s.cases[k]; });
    // The Pattern: answered at its last door, or never.
    var pat = cases.filter(function (r) { return r.template === 'pattern'; })[0];
    if (pat) {
      var nth = ['', 'first', 'second', 'third', 'fourth', 'fifth'][Math.min(5, Math.max(1, pat.victims || 1))];
      out.push({ id: 'pattern', text: pat.status === 'closed'
        ? U.fill('The girls of {scene}: answered at the {nth} door.', { scene: pat.scene, nth: nth })
        : U.fill('The girls of {scene}: never answered. He still walks the lanes.', { scene: pat.scene }) });
    }
    // The Coquille's King: on his barrel, on the Ravenstone, or kneeling to you.
    var court = s.court || {}, ev = this.endingVars();
    var kingCase = cases.filter(function (r) { return r.template === 'syndicate' && r.status === 'closed'; })[0];
    if (s.over && s.over.id === 'kingofthunes') out.push({ id: 'coquille', text: 'The old King went into the river. The Court kneels to you.' });
    else if (kingCase || s.flags.syndicateFallen) out.push({ id: 'coquille', text: U.fill('{king} hangs on the Ravenstone.', { king: ev.king }) });
    else if (court.stance === 'treaty') out.push({ id: 'coquille', text: U.fill('{king} keeps the Treaty, and his barrel.', { king: ev.king }) });
    else if (this.countOf('syndicate')) out.push({ id: 'coquille', text: U.fill('{king} still sits on his barrel.', { king: ev.king }) });
    // The Harbourmaster's examiners, sent home.
    var sent = st.rivalExposed || 0;
    if (sent === 1) out.push({ id: 'rival', text: 'One examiner sent home to the Customs House.' });
    else if (sent > 1) out.push({ id: 'rival', text: U.fill('{N} examiners sent home to the Customs House.', { N: CF.numberWord(sent, true) }) });
    // The worst of those abroad: the one who walked from you most.
    var WALKED = { cold: 1, acquitted: 1, wrongful: 1, rival: 1, slipped: 1, burned: 1 };
    var worst = null, walks = 0;
    this.criminalsAtLarge().forEach(function (c) {
      var n = (c.history || []).filter(function (h) { return WALKED[h.how]; }).length;
      if (n > walks || (n === walks && worst && c.crimes > worst.crimes)) { worst = c; walks = n; }
    });
    if (worst && walks >= 1) {
      var last = (worst.history || []).filter(function (h) { return h.title; }).slice(-1)[0];
      var rec = last && cases.filter(function (r) { return r.title === last.title; })[0];
      var where = rec && CF.DISTRICTS[rec.district] ? CF.DISTRICTS[rec.district].label : null;
      var vars = { name: worst.name, k: CF.numberWord(walks), where: where };
      var seen = where ? [
        '{name}, who walked from you once, was last seen in {where}.', '{name}, who walked from you twice, was last seen in {where}.', '{name}, who walked from you {k} times, was last seen in {where}.',
      ] : [
        '{name}, who walked from you once, is still inside the walls.', '{name}, who walked from you twice, is still inside the walls.', '{name}, who walked from you {k} times, is still inside the walls.',
      ];
      out.push({ id: 'abroad', text: U.fill(seen[Math.min(3, walks) - 1], vars) });
    }
    // The watchman you drilled hardest.
    var best = null;
    this.cardsOf('teammate', true).forEach(function (c) { var lv = (c.data && c.data.level) || 1; if (lv >= 2 && (!best || lv > best.data.level)) best = c; });
    if (best && best.data.name) out.push({ id: 'watch', text: U.fill('{name} is sergeant now.', { name: best.data.name }) });
    return out.slice(0, 4);
  };

  // What a successor inherits: your cold cases and your enemies.
  P.buildLegacy = function () {
    var self = this;
    return {
      predecessor: this.s.detective,
      ending: this.s.over && this.s.over.title,
      cold: this.cardsOf('coldcase', true).map(function (c) { return { label: c.label, desc: c.desc, data: c.data }; }),
      atlarge: this.cardsOf('atlarge', true).map(function (c) { return { label: c.label, desc: c.desc, data: c.data }; }),
      gangs: this.cardsOf('gang', true).map(function (c) { return { label: c.label, desc: c.desc, data: c.data }; }),
      syndicate: this.countOf('syndicate') > 0 && !self.s.flags.syndicateFallen,
      criminals: this.criminalsAtLarge().sort(function (a, b) { return b.crimes - a.crimes; }).slice(0, 4),
    };
  };

  P.applyLegacy = function (L, o) {
    var self = this;
    (L.cold || []).slice(0, 4).forEach(function (c) { self.create('coldcase', c); });
    (L.criminals || []).forEach(function (c) { var copy = U.clone(c); copy.heat = 0; delete copy.hidden; delete copy.surfaceWeek; self.s.criminals[copy.id] = copy; });
    (L.atlarge || []).slice(0, 2).forEach(function (c) { self.create('atlarge', c); });
    (L.gangs || []).slice(0, 1).forEach(function (c) { self.create('gang', c); });
    if (L.syndicate) this.create('syndicate');
    this.create('notes', { desc: 'The casebook of ' + L.predecessor + ' (' + L.ending + '). Half of it is water-stained. Read it in Rest.' });
    this.meter('retaliation', Math.min(4, (L.atlarge || []).length + (L.gangs || []).length * 2));
    this.s.flags.legacy = { predecessor: L.predecessor, ending: L.ending || null, syndicate: !!L.syndicate };
    // With the opening the desk is not yours yet: the drawer is told at the hire (legacyStory).
    if (o && o.defer) return;
    this.s.flags.legacy.told = true;
    this.story('Inherited', 'Your predecessor, ' + L.predecessor + ', left you their desk, their unanswered cases and their enemies. The enemies have already sent a welcome: a cask of very good Rhenish, with the King\'s compliments.', 'major');
  };
  // How the last Examiner left the desk, from the title of their ending.
  CF.LEGACY_HOW = {
    'Dismissed': 'the Council took the letter back',
    'The Fever': 'one morning they did not come in',
    'Collapse': 'they fell on the Watch-house stair',
    'Killed in the Council\'s Service': 'the burial',
    'The Council\'s Sergeants': 'the sergeants came at first light',
    'Lost in the Case': 'they broke the study door',
    'The Crowd Turns': 'the crowd came for them',
    'The Stake': 'the Fire',
    'The Dagger on the Pillow': 'the dagger',
    'The Old Bailey': 'the trial',
    'The Long Service': 'they took the Council\'s pension',
  };
  // The inheritance, once the desk is yours (the hire in the opening). Once.
  P.legacyStory = function () {
    var L = this.s.flags.legacy;
    if (!L || L.told) return null;
    L.told = true;
    var how = CF.LEGACY_HOW[L.ending] || 'they left it';
    var text = U.fill(L.syndicate
      ? 'The desk under the stair was {predecessor}\'s, until {how}. Their unanswered cases are still in the drawer, and their enemies have already found the new name on the door: a cask of very good Rhenish waits on the desk, with the King\'s compliments.'
      : 'The desk under the stair was {predecessor}\'s, until {how}. Their unanswered cases are still in the drawer, and their enemies have already found the new name on the door.',
    { predecessor: L.predecessor, how: how });
    return this.story('The Last Examiner\'s Drawer', text, 'major');
  };

  // ---- Specs for generated cards ------------------------------------------
  // A name: a man's, a woman's, or either when the role does not say.
  // `ex` ({ first: [], last: [] }) names to keep clear of: a first name or a
  // surname one of them has is passed over for the next in the list, so the
  // accused are not kin of the victim nobody wrote. Stepping, not drawing
  // again: the city's dice fall as they would have.
  P.newName = function (sex, ex) {
    var N = CF.NAMES, first = (sex === 'm' ? N.m : sex === 'f' ? N.f : N.first) || N.first;
    var f = U.pick(this.rng, first), l = U.pick(this.rng, N.last);
    if (ex) { f = CF.nextClear(first, f, ex.first); l = CF.nextClear(N.last, l, ex.last); }
    return f + ' ' + l;
  };
  // The first entry of `list`, from `item` on, that is not in `taken` (`item` itself when every one is).
  CF.nextClear = function (list, item, taken) {
    var i0 = list.indexOf(item);
    if (!taken || !taken.length || i0 < 0) return item;
    for (var k = 0; k < list.length; k++) { var x = list[(i0 + k) % list.length]; if (taken.indexOf(x) < 0) return x; }
    return item;
  };
  // A name as [first, surname]; a surname of several words (van der Meer) stays whole.
  CF.nameParts = function (name) {
    var i = (name || '').indexOf(' ');
    return i < 0 ? [name || '', ''] : [name.slice(0, i), name.slice(i + 1)];
  };
  // What a description says of a person's sex (a witness's, an accused's
  // role), for the name and the face they are given. Whose they are does not
  // count: 'the widow's son' is a man, 'the miller's wife' a woman.
  P.sexOf = function (who) {
    if (!who) return null;
    var head = String(who).replace(/\b[\w-]+(?:'s|s')(?=\s)/gi, ' ');
    if (/woman|wife|maid|widow|laundress|sister|fishwife|girl|niece|daughter|mother|\baunt\b|midwife|lady|abbess|\bnun\b/i.test(head)) return 'f';
    if (/\bman\b|boy|husband|porter|sergeant|baker|shepherd|bargeman|ferryman|tapster|drunk|doorkeeper|infirmarian|assayer|watchman|nephew|\bson\b|brother|father|uncle|journeyman|apprentice|novice|\bking\b|master\b/i.test(head)) return 'm';
    return null;
  };

  // A name's sex, by its first name ('m', 'f', or null for one not in the lists):
  // the interface picks a face to match (a suspect record also keeps `sex`).
  P.sexOfName = function (name) {
    var first = CF.nameParts(name)[0], N = CF.NAMES || {};
    if ((N.f || []).indexOf(first) >= 0) return 'f';
    if ((N.m || []).indexOf(first) >= 0) return 'm';
    return null;
  };

  P.giveDistrict = function (key, ctx) {
    var d = CF.DISTRICTS[key];
    var known = this.s.flags.districts = this.s.flags.districts || {};
    known[key] = true;
    var spec = { label: d.label, desc: d.desc, data: { district: key } };
    return ctx ? ctx.give('district', spec) : this.create('district', spec);
  };
  P.hasDistrict = function (key) {
    return this.cardsOf('district', true).some(function (c) { return c.data.district === key; });
  };

  P.personnelSpec = function (key) {
    var p = CF.PERSONNEL[key];
    return { label: 'Letter: ' + p.label, desc: p.desc + ' Costs ' + p.cost + ' Coin.', data: { personnel: key } };
  };
  P.teammateSpec = function (key) {
    var p = CF.PERSONNEL[key];
    var name = this.newName(p.sex);
    var traits = U.sample(this.rng, p.traits || [], p.nTraits || 1);
    return {
      label: p.role + ' ' + name.split(' ')[1],
      desc: p.desc + ' Slot them into a verb to help. ' + traits.map(function (t) { return CF.OFFICER_TRAITS[t].label + ': ' + CF.OFFICER_TRAITS[t].desc; }).join(' '),
      aspects: U.clone(p.aspects),
      data: { personnel: key, name: name, level: 1, role: p.role, traits: traits },
    };
  };
  // Is an officer with this trait among the cards in the verb?
  P.teamHas = function (ctx, trait) {
    return ctx.cards.some(function (c) { return c.def === 'teammate' && (c.data.traits || []).indexOf(trait) >= 0; });
  };
  // Equipment with this modifier among the cards in the verb.
  P.gearWith = function (ctx, mod) {
    return ctx.cards.filter(function (c) { var m = CF.CARDS[c.def].mods; return m && m[mod]; });
  };
  // An office's power is open at its rank, or when a piece of gear opens it.
  P.powerOpen = function (src) {
    var p = CF.POWERS && CF.POWERS[src];
    if (!p) return true;
    if (this.s.rank >= p.rank) return true;
    for (var k in this.s.cards) { var c = this.s.cards[k], m = CF.CARDS[c.def] && CF.CARDS[c.def].mods; if (c.loc && m && m.unlocksVerb === src) return true; }
    return false;
  };
  // What a verb's window says to this player: the basics a junior can do,
  // then one line per office power on that verb, open or not yet. A locked
  // line names the office it waits for (the interface shows 'At {rank}: {label}').
  //   { basics, powers: [{ key, label, text, rank, rankLabel, open }] }
  P.verbInfo = function (verbId) {
    var def = CF.VERBS[verbId];
    if (!def) return null;
    var self = this, powers = [];
    Object.keys(CF.POWERS || {}).forEach(function (k) {
      var p = CF.POWERS[k];
      if (p.verb !== verbId) return;
      powers.push({ key: k, label: p.label, text: p.text, rank: p.rank, rankLabel: CF.RANKS[p.rank] || '', open: self.powerOpen(k) });
    });
    powers.sort(function (a, b) { return a.rank - b.rank; });
    return { basics: def.basics || def.desc, powers: powers };
  };
  P.unlockVerb = function (id, why) {
    var v = this.s.verbs[id]; // offices open recipes now, not tokens; a folded verb is already open
    if (!v || v.unlocked) return false;
    v.unlocked = true;
    this.layoutVerbs();
    if (why) this.story('Unlocked: ' + CF.VERBS[id].label, why, 'major');
    this.emit('unlock', { verb: id });
    return true;
  };
  P.informantSpec = function (district) {
    var name = this.newName();
    // One Moth on the table at a time: a nickname already in use is passed
    // over, and when all eight are taken the newcomer is that one's junior.
    var all = ['Whistle', 'Two-Coats', 'Sparrow', 'Lucky', 'The Deacon', 'Moth', 'Rattle', 'Penny'];
    var used = {};
    this.cardsOf('informant', true).forEach(function (c) { if (c.data && c.data.name) used[c.data.name] = true; });
    var free = all.filter(function (n) { return !used[n]; });
    var nick = free.length ? U.pick(this.rng, free) : U.pick(this.rng, all) + ' the Younger';
    if (used[nick]) nick = name.split(' ')[0] + ' ' + nick;
    return {
      label: 'Informer: ' + nick,
      desc: name + ', known in the taverns as ' + nick + '. Works ' + CF.DISTRICTS[district].label + '. Meet them on the Ward with Coin for a word.',
      data: { name: nick, district: district, heat: 0, trust: 1, tipT: CF.INFORMANT.firstTip },
    };
  };

  // The city opens as you answer cases: the Market after the first, the
  // Petitions after the second.
  P.openTheCity = function () {
    var s = this.s, n = s.stats.convictions;
    if (n >= 1 && !s.flags.marketOpen) {
      s.flags.marketOpen = true;
      if (!(s.flags.districts || {}).market) this.giveDistrict('market');
      this.story('The Market', 'The stallholders know your face now. The Quarter is yours to walk: put it in Explore with Health for a round, or with a case to look for its people there.', 'major');
    }
    if (n >= 2 && !s.flags.petitionsOpen) {
      s.flags.petitionsOpen = true;
      this.addOrdersForRank(0);
      this.story('The Petitions', 'A clerk brings the forms the Council will now hear from you: instruments, rooms, a key. Each Petition in Attend with its price in Coin.', 'major');
    }
  };
  // One Petition's card, wherever it is asked for (the Clerk's forms, the
  // Watch-house board): its label, its price after the origin's discount.
  P.orderSpec = function (key) {
    var o = CF.ORDERS[key];
    if (!o) return null;
    var what = o.desc || (o.room ? CF.ROOMS[o.room].desc : CF.CARDS[o.give].desc);
    var disc = this.s.who === 'clerk' ? 1 : 0;
    return { label: 'Petition: ' + o.label, desc: what + ' Costs ' + Math.max(1, o.cost - disc) + ' Coin.', data: { order: key, discount: disc } };
  };
  // Whether a Petition is already on the table or in hand, or already granted.
  P.orderOut = function (key) {
    if ((this.s.flags.bought || {})[key]) return true;
    return this.cardsOf('order', true).some(function (c) { return c.data && c.data.order === key; });
  };
  // Put one Petition on the table, once: the card, or null when it is
  // already out or granted. The Watch-house board asks through this.
  P.petition = function (key) {
    if (!CF.ORDERS[key] || this.orderOut(key)) return null;
    return this.create('order', this.orderSpec(key));
  };
  P.addOrdersForRank = function (rank) {
    var self = this;
    Object.keys(CF.ORDERS).forEach(function (k) {
      if (CF.ORDERS[k].rank !== rank) return;
      self.petition(k);
    });
  };
  P.removeOrder = function (key) {
    var self = this;
    this.s.flags.bought = this.s.flags.bought || {};
    this.s.flags.bought[key] = true;
    this.cardsOf('order', true).forEach(function (c) { if (c.data.order === key) self.remove(c); });
  };

  // ---- Rank ----------------------------------------------------------------
  P.rankDef = function () { return CF.RANK_DEFS[this.s.rank] || CF.RANK_DEFS[0]; };
  P.maxOpenCases = function () { return Math.min(MAX_OPEN_CASES + 1, this.rankDef().maxCases); };
  // Is there a desk free for one more case? `extra` lets a warned case, a
  // hue and cry or an old case opened again come to a full desk, one over.
  P.roomForCase = function (extra) { return this.openCases().length < this.maxOpenCases() + (extra || 0); };
  P.manhuntOpen = function () { return this.openCases().some(function (r) { return r.template === 'manhunt'; }); };
  // Take the next rank: verbs, requisitions, salary, caseload.
  P.promote = function () {
    var s = this.s;
    if (s.rank >= CF.TOP_RANK) return [];
    s.rank++;
    s.rankWeek = s.week; // the harder crimes of the office come from the next week
    var unlocked = [];
    CF.VERB_ORDER.forEach(function (id) {
      if (!s.verbs[id].unlocked && CF.VERBS[id].rank <= s.rank) { s.verbs[id].unlocked = true; unlocked.push(CF.VERBS[id].label); }
    });
    this.layoutVerbs();
    this.addOrdersForRank(s.rank);
    // The receiver of stolen goods opens his door with the first office (nobody is told).
    if (s.rank === 1 && this.seedFence) this.seedFence();
    // The office serves what you want: a promotion feeds the path you walk.
    this.pathGain(s.calling || 'commissioner', 1, 'promoted');
    // The office teaches as well as pays: its own Insights open now.
    var ways = CF.insightsAtRank ? CF.insightsAtRank(s.rank) : [];
    if (ways.length) this.story('The Office Teaches', U.fill('New work, new lessons: {list}. The Health, Wit and Instinct cards say how each is earned.', { list: ways.map(function (id) { return CF.INSIGHTS[id].label; }).join(', ') }), 'minor');
    return unlocked;
  };

  // ---- Delegated cases (the Delegate verb) ----------------------------------
  // An officer works a case alone: something from the scene every so often
  // until the case closes, when they come back.
  CF.DELEGATE_EVERY = 30;
  P.delegateCase = function (rec, officer) {
    rec.delegate = { card: { label: officer.label, desc: officer.desc, aspects: officer.aspects, data: officer.data }, t: CF.DELEGATE_EVERY, found: 0 };
    this.remove(officer);
  };
  P.releaseDelegate = function (rec, note) {
    var d = rec.delegate;
    if (!d) return null;
    rec.delegate = null;
    var back = this.create('teammate', d.card);
    if (note !== false) this.story('Back from ' + rec.title, this.labelOf(back) + ' hands in a report on ' + rec.title + ' and goes back to the round.', 'minor');
    return back;
  };
  P.tickDelegates = function (dt) {
    var self = this;
    this.openCases().forEach(function (rec) {
      var d = rec.delegate;
      if (!d) return;
      d.t -= dt;
      if (d.t > 0) return;
      d.t = CF.DELEGATE_EVERY;
      var helper = { def: 'teammate', aspects: d.card.aspects, data: d.card.data };
      var it = self.drawSceneItem(rec, [helper]);
      if (it) { d.found++; self.story(d.card.label + ' Reports', 'From ' + rec.title + ': ' + it.label + '.', 'minor'); }
      else if (rec.witnesses.length) { self.create('witness', self.witnessSpec(rec)); d.found++; }
    });
  };
  // Draw the next unfound scene item onto the table (the engine-side twin
  // of the recipes' drawItem).
  P.drawSceneItem = function (rec, helpers) {
    var item = rec.items[rec.found];
    if (!item) return null;
    rec.found++;
    if (item.type === 'clue') this.create('clue', this.clueSpec(rec, item, helpers));
    else {
      var needs = item.needs ? ' Needs ' + ({ prints: 'a Fingerprint Set', bio: 'a Forensic Kit', lab: 'Lab Access' })[item.needs] + ' to analyse properly.' : '';
      this.create('evidence', { label: item.label, desc: item.text + ' Take it to Study.' + needs + ' (Raw proof in: ' + rec.title + ')', caseId: rec.id, data: { item: item } });
    }
    return item;
  };

  // ---- The Intelligence Office ------------------------------------------------
  // A clue that points at a front reveals the front as soon as it is found.
  // What each built room has done for you, counted where its effect lands
  // (s.roomUse = { room: n }), so the Watch-house board can say it paid:
  // the UI reads roomUseText(room) for the tile's foot ({one|many} with {n}).
  CF.ROOM_USE = {
    locker: ['One token kept past its time', '{n} tokens kept past their time'],
    suite: ['One questioning with more Word', '{n} questionings with more Word'],
    archive: ['One case opened again', '{n} cases opened again'],
    intel: ['One front named or informer seated', '{n} fronts named or informers seated'],
    training: ['One Coin saved at the drill', '{n} Coin saved at the drill'],
    thieftakers: ['One case settled', '{n} cases settled'],
    lab: ['One reading made stronger', '{n} readings made stronger'],
    survroom: ['One token from the belfry', '{n} tokens from the belfry'],
  };
  P.roomUsed = function (room, n) {
    var s = this.s;
    if (!s.rooms[room]) return;
    if (!s.roomUse || typeof s.roomUse !== 'object') s.roomUse = {};
    s.roomUse[room] = (s.roomUse[room] || 0) + (n || 1);
  };
  // { text, vars } for a room that has done something (through tr), or null.
  P.roomUseText = function (room) {
    var n = (this.s.roomUse || {})[room] || 0, t = CF.ROOM_USE[room];
    if (!n || !t) return null;
    return { text: n === 1 ? t[0] : t[1], vars: { n: n }, n: n };
  };
  P.tickIntelOffice = function () {
    var self = this, fronts = this.fronts();
    for (var k in this.s.cards) {
      var c = this.s.cards[k];
      if (c.def !== 'clue' || !c.data.link || !c.loc) continue;
      var f = fronts[c.data.link];
      if (f && !f.known) {
        self.revealFront(f);
        self.roomUsed('intel');
        self.story('The Informers\' Bench', 'Someone on the bench knows ' + self.labelOf(c) + ' at once: ' + f.name + '. ' + self.frontWho(f), 'major');
      }
    }
  };

  // ---- Cases ----------------------------------------------------------------
  P.openCases = function () {
    var out = [];
    for (var k in this.s.cases) if (this.s.cases[k].status === 'open') out.push(this.s.cases[k]);
    return out;
  };
  P.caseRec = function (id) { return this.s.cases[id]; };
  P.caseCard = function (id) {
    for (var k in this.s.cards) {
      var c = this.s.cards[k];
      if (c.def === 'case' && c.caseId === id) return c;
    }
    return null;
  };

  // Whether a scene item speaks to an aspect (a token's own, or what its raw proof gives).
  function itemCovers(it, aspect) {
    var a = it.aspects || (it.result && it.result.aspects) || {};
    return a[aspect] > 0;
  }
  // A structure's scene item with its variables filled in.
  function fillItem(it, vars) {
    var out = U.clone(it);
    out.label = U.fill(out.label, vars);
    out.text = U.fill(out.text, vars);
    if (out.result) { out.result.label = U.fill(out.result.label, vars); out.result.text = U.fill(out.result.text, vars); }
    if (out.label) out.label = out.label.charAt(0).toUpperCase() + out.label.slice(1);
    return out;
  }

  // The marks a case's own words describe: the `echoes` of its structure's
  // items, its template's items and what its leads give.
  CF.caseEchoes = function (T, structure) {
    var out = [];
    var add = function (it) { if (it && it.echoes && out.indexOf(it.echoes) < 0) out.push(it.echoes); };
    ((structure && structure.items) || []).forEach(add);
    ((T && T.items) || []).forEach(add);
    ((T && T.leads) || []).forEach(function (l) { (l.gives || []).forEach(add); });
    return out;
  };

  // Generate a case record and put its card on the table (or into ctx output).
  // The crimes an office is sent: the tiers up to your rank, the first tier
  // always; a new tier joins a week after the promotion that opened it.
  // A written mystery with one answer (CF.ONCE_CASES) is sent once a run.
  P.casePool = function () {
    var s = this.s, pool = [], rank = this.caseRank(), seen = (s.flags && s.flags.seenCases) || [];
    CF.CASE_TIERS.forEach(function (tier, i) { if (i <= rank) pool = pool.concat(tier); });
    pool = pool.filter(function (t) { return (CF.ONCE_CASES || []).indexOf(t) < 0 || seen.indexOf(t) < 0; });
    // The season weighs its crimes: one sent twice as often is in the pool twice.
    var weigh = this.season().weigh || {}, extra = [];
    pool.forEach(function (t) { for (var k = 1; k < (weigh[t] || 1); k++) extra.push(t); });
    return pool.concat(extra);
  };
  // The office a new case is sent to: the rank, but in the week of a
  // promotion still the one before it (its crimes and its charges).
  P.caseRank = function () {
    var s = this.s;
    return s.rank > 0 && typeof s.rankWeek === 'number' && s.week <= s.rankWeek ? s.rank - 1 : s.rank;
  };
  // How long a case keeps, as a share of its template's clock: a young office is given more time.
  P.caseClock = function () { var r = this.caseRank(); return r === 0 ? 1.8 : r === 1 ? 1.6 : 1.5; };
  // A mark left to be found (see spawnCase and the Rest's Two Accounts).
  CF.STAGED_MARK = {
    chance: 0.35,
    tells: [
      'It lies exactly where the beadle\'s lantern falls first.',
      'Nothing else in the room was touched. This was put.',
      'Too neat. Whoever left it wanted it read.',
    ],
  };
  P.spawnCase = function (templateId, opts) {
    opts = opts || {};
    var s = this.s;
    var rng = this.rng;
    // The crimes come by rank: an Examiner gets the plain ones; the killings
    // and the strange cases wait until you have risen to them.
    var pool = templateId ? null : this.casePool();
    var tid = templateId || U.pick(rng, pool);
    // A crime whose title has no names in it (the Scriptorium) is not sent twice to one desk: the next in the pool comes instead.
    if (pool) {
      var fixedOpen = this.openCases().map(function (r) { return r.title; });
      var fixedClash = function (t) { var TT = CF.CASE_TEMPLATES[t]; return TT && TT.title.indexOf('{') < 0 && fixedOpen.indexOf(TT.title) >= 0; };
      for (var pk = 1; pk < pool.length && fixedClash(tid); pk++) tid = pool[(pool.indexOf(tid) + 1) % pool.length];
    }
    var T = CF.CASE_TEMPLATES[tid];
    var id = 'c' + s.nextUid++;
    // An unanswered case opened again is the same book: the victim, the
    // scene, the names, and what was never found (goCold writes `from`).
    var from = opts.from && opts.from.suspects && opts.from.suspects.length ? opts.from : null;
    var victim = opts.victim || (from && from.victim) || this.newName(T.victimSex || null);
    var last = U.pick(rng, CF.NAMES.last);
    var district = opts.district || (from && from.district) || U.pick(rng, T.districts);
    var vars = {
      victim: victim, last: last, n: U.randInt(rng, 3, 19), district: CF.DISTRICTS[district].label,
      gang: opts.gangName || 'the gang', culprit: opts.culpritName || '',
    };
    if (from && from.vars) for (var fv in from.vars) vars[fv] = from.vars[fv];
    var scene = from && from.scene ? from.scene : opts.scene || U.fill(U.pick(rng, T.scenes), vars);
    vars.scene = scene;
    // Two cases on one desk do not share a title: on a clash the next surname,
    // the victim's next surname (when the story did not name one) and the next
    // scene are tried, five times at most, without a throw of the dice.
    var openTitles = from ? [] : this.openCases().map(function (r) { return r.title; });
    var titleTpl = opts.title || T.title;
    var lastAt = CF.NAMES.last.indexOf(last), sceneAt = Math.max(0, T.scenes.map(function (x) { return U.fill(x, vars); }).indexOf(scene));
    var vic0 = CF.nameParts(victim), vicAt = CF.NAMES.last.indexOf(vic0[1]);
    for (var tt = 1; tt <= 5 && !from && openTitles.indexOf(U.fill(titleTpl, vars)) >= 0; tt++) {
      vars.last = last = CF.NAMES.last[(lastAt + tt) % CF.NAMES.last.length];
      if (!opts.victim && vicAt >= 0 && /\{victim\}/.test(titleTpl)) vars.victim = victim = vic0[0] + ' ' + CF.NAMES.last[(vicAt + tt) % CF.NAMES.last.length];
      vars.scene = scene = U.fill(T.scenes[(sceneAt + tt) % T.scenes.length], vars);
    }
    // Structure first, prose second: the shape of this particular crime.
    var structure = null;
    if (from) structure = (CF.STRUCTURES[tid] || []).filter(function (x) { return x.id === from.structure; })[0] || null;
    else if (CF.STRUCTURES[tid] && CF.STRUCTURES[tid].length) {
      structure = U.pick(rng, CF.STRUCTURES[tid]);
      for (var sv in structure.vars) vars[sv] = U.pick(rng, structure.vars[sv]);
    }

    // The accused: the template's roles, or the ones the story hands in.
    var rolePool = opts.roles && opts.roles.length ? opts.roles : T.roles;
    var nSus = Math.min(T.nSuspects || 3, rolePool.length);
    var roles = (opts.roles || T.nSuspects) ? rolePool.slice(0, nSus) : U.sample(rng, rolePool, nSus);
    var traits = U.sample(rng, CF.TRAITS, nSus);
    var guiltyIdx = U.randInt(rng, 0, nSus - 1);
    var guiltyRole = opts.guiltyRole || T.guiltyRole;
    if (guiltyRole) { var gi = roles.map(function (r) { return r.role; }).indexOf(guiltyRole); if (gi >= 0) guiltyIdx = gi; }
    if (opts.culpritTrait) {
      var tr = CF.TRAITS.filter(function (x) { return x.id === opts.culpritTrait; })[0];
      if (tr) {
        traits = traits.filter(function (x) { return x.id !== tr.id; }).slice(0, nSus - 1);
        traits.splice(guiltyIdx, 0, tr);
      }
    }
    // A token whose words describe a mark (a key, pipe ash, a left hand) never
    // points at an innocent: an innocent who drew that mark is given another.
    var echoed = from ? [] : CF.caseEchoes(T, structure);
    if (echoed.length) {
      var usedT = traits.map(function (x) { return x.id; });
      traits = traits.map(function (t, i) {
        if (i === guiltyIdx || echoed.indexOf(t.id) < 0) return t;
        var nt = U.pick(rng, CF.TRAITS.filter(function (x) { return echoed.indexOf(x.id) < 0 && usedT.indexOf(x.id) < 0; }));
        usedT.push(nt.id);
        return nt;
      });
    }
    var self = this;
    // The accused keep clear of the victim's names, the scene's surname, each
    // other's, and the surnames of the accused in every other open case.
    var vp = CF.nameParts(victim), ex = { first: [vp[0]], last: [vp[1], vars.last] };
    this.openCases().forEach(function (r) { (r.suspects || []).forEach(function (x) { ex.last.push(CF.nameParts(x.name)[1]); }); });
    if (opts.culpritName) { var cp = CF.nameParts(opts.culpritName); ex.first.push(cp[0]); ex.last.push(cp[1]); }
    var suspects = roles.map(function (r, i) {
      var name = i === guiltyIdx && opts.culpritName ? opts.culpritName : self.newName(r.sex || self.sexOf(r.role), ex);
      var np = CF.nameParts(name); ex.first.push(np[0]); ex.last.push(np[1]);
      return { key: 's' + i, name: name, role: r.role, motive: r.motive, trait: traits[i].id, guilty: i === guiltyIdx, revealed: false, sex: r.sex || self.sexOf(r.role) || self.sexOfName(name) };
    });
    if (from) {
      // The same names: nobody is in the casebook yet, but the cleared stay cleared.
      suspects = from.suspects.map(function (x) {
        return { key: x.key, name: x.name, role: x.role, motive: x.motive, trait: x.trait, guilty: !!x.guilty, revealed: false, cleared: !!x.cleared };
      });
      guiltyIdx = Math.max(0, suspects.map(function (x) { return x.guilty; }).indexOf(true));
      traits = suspects.map(function (x) { return CF.TRAITS.filter(function (t) { return t.id === x.trait; })[0] || CF.TRAITS[0]; });
    }
    var culprit = suspects[guiltyIdx];
    vars.culprit = culprit.name;

    var highProfile = !!T.highProfile || (!opts.first && rng() < (CF.HIGH_PROFILE_CHANCE[Math.min(s.rank, CF.HIGH_PROFILE_CHANCE.length - 1)] || 0));
    var difficulty = T.difficulty + (highProfile && !T.highProfile ? 1 : 0);
    // The charge profile: what a court will want proven. A high-profile
    // case wants one more point of its main aspect.
    var charge = U.clone(T.charge);
    if (highProfile && !T.highProfile) charge[T.keyAspects[0]]++;
    // The Court asks a little less of the first case's kind of proof than the template's full weight.
    if (!T.special && !highProfile) { var ck = T.keyAspects[T.keyAspects.length - 1]; if (charge[ck] > 1) charge[ck]--; }
    // And it asks by your rank: an Examiner's cases want two of anything at most;
    // a Bailiff's want one more of what they turn on; a Magistrate's, two more.
    if (!T.special) {
      var crank = this.caseRank();
      if (crank === 0) for (var ca in charge) charge[ca] = Math.min(charge[ca], 2);
      if (crank >= 2) charge[T.keyAspects[0]] = Math.min(4, charge[T.keyAspects[0]] + 1);
      if (crank >= 3) charge[T.keyAspects[1]] = Math.min(4, charge[T.keyAspects[1]] + 1);
    }
    // A known criminal's crimes are harder to prove the further they have risen.
    // A band's or the Coquille's own case already carries the organisation's weight.
    var orgCase = tid === 'gang' || tid === 'syndicate';
    if (!orgCase) charge[T.keyAspects[0]] += this.caseRankBonus(opts.criminalId);
    // A Careful criminal leaves less behind.
    var known = !orgCase && opts.criminalId && this.criminal(opts.criminalId);

    // The scene: the brief's own items are always there. The culprit's trait
    // token, both structure items, one template item for what the case turns
    // on (a front's door takes its place when the crime went through one),
    // and the generic find if there is room. Without a structure, the trait
    // and up to three template items, one of them generic. Four at most.
    var front = opts.frontId && s.network.fronts[opts.frontId] ? s.network.fronts[opts.frontId] : !T.special ? this.frontForCase(opts, tid, id + '|' + victim) : null;
    var trait = traits[guiltyIdx];
    var traitItem = { type: 'clue', label: trait.clue.label, text: trait.clue.text, aspects: trait.clue.aspects, trait: trait.id, own: true };
    var tItems = T.items.map(function (it) { return fillItem(it, vars); });
    var generic = fillItem(U.pick(rng, CF.GENERIC_SCENE), vars);
    var items;
    if (structure) {
      var covers = tItems.filter(function (it) { return itemCovers(it, T.keyAspects[0]); });
      var key1 = covers.length ? U.pick(rng, covers) : tItems.length ? U.pick(rng, tItems) : null;
      items = [traitItem].concat(structure.items.map(function (it) { var f = fillItem(it, vars); f.own = true; return f; }));
      var rest = front ? [this.linkItem(front, id + '|' + victim)] : [];
      if (key1) rest.push(key1);
      rest.push(generic);
      while (items.length < 4 && rest.length) items.push(rest.shift());
    } else if (T.special) {
      // A great case's scene holds everything its template has: the charge asks for every kind.
      items = [traitItem].concat(front ? [this.linkItem(front, id + '|' + victim)] : [], tItems);
    } else {
      var picked = U.sample(rng, tItems, Math.min(2, tItems.length));
      if (front) picked = [this.linkItem(front, id + '|' + victim)].concat(picked.slice(0, 1));
      items = [traitItem].concat(picked, [generic]);
    }
    // On the culprit, the words are a mark: the token says whose.
    items.forEach(function (it) { if (it.echoes && it.echoes === trait.id && !it.trait) it.trait = it.echoes; });
    items = U.shuffle(rng, items);
    if (items.length > 4 && !T.special) items.length = 4; // a scene gives four things at most: what matters, not everything
    if (from) {
      // What was never found, topped up to two from a fresh look at the scene.
      var had = (from.items || []).map(function (it) { return U.clone(it); });
      var seen = had.map(function (it) { return it.label; });
      items.forEach(function (it) { if (had.length < 2 && seen.indexOf(it.label) < 0) { had.push(it); seen.push(it.label); } });
      items = had;
    }
    // A Careful criminal leaves less behind: the trait and the structure's
    // own tokens stay; up to two of the rest go, down to two things.
    if (known && known.traits.indexOf('careful') >= 0) {
      var drop = Math.min(2, items.length - 2);
      items = items.filter(function (it) { if (drop > 0 && !it.own) { drop--; return false; } return true; });
    }
    // A mark left to be found: from the Bailiff's office on (or whenever a
    // Careful criminal is at work), some scenes also hold an innocent's mark,
    // put there to be read. It looks real; a tell in its words gives it away.
    if (!from && !T.special && !opts.first && !opts.quiet && (this.caseRank() >= 2 || (known && known.traits.indexOf('careful') >= 0)) && rng() < CF.STAGED_MARK.chance) {
      var marked = suspects.filter(function (x) { return !x.guilty && x.trait !== culprit.trait; });
      var mark = marked.length ? U.pick(rng, marked) : null;
      var mt = mark && CF.TRAITS.filter(function (t) { return t.id === mark.trait; })[0];
      if (mt && mt.clue) {
        var stagedItem = { type: 'clue', label: mt.clue.label, text: mt.clue.text + ' ' + U.pick(rng, CF.STAGED_MARK.tells), aspects: U.clone(mt.clue.aspects), trait: mt.id, staged: true, own: true };
        items.splice(U.randInt(rng, 0, items.length), 0, stagedItem);
      }
    }

    var rec = {
      id: id, template: tid, title: from && from.title ? from.title : U.fill(titleTpl, vars), short: T.label, district: district, scene: scene,
      victim: victim, vars: vars, suspects: suspects, culprit: culprit.key, keyAspects: T.keyAspects.slice(),
      difficulty: difficulty, highProfile: highProfile, charge: charge, items: items, found: 0,
      witnesses: U.shuffle(rng, T.witnesses), work: 0, searches: 0, identified: null, status: 'open', leads: {},
      special: !!T.special, atLargeUid: opts.atLargeUid || null, gangUid: opts.gangUid || null,
      reopened: !!opts.reopened, criminalId: opts.criminalId || null,
      structure: structure ? structure.id : null, front: front ? front.id : null, foundAlive: false,
    };
    rec.week = s.week;
    // The Vanished may be alive (round 8): only where they left or never got home, never on the
    // rng's stream (a fixed quarter of names), so the city's other draws stay as they were.
    if (tid === 'missing') rec.alive = (rec.structure === 'own_accord' || rec.structure === 'never_home') && Engine.nameHash(id + '|' + victim) % 4 === 0;
    // A title no redraw could change (a fixed one, the Scriptorium's) on a desk that already holds it.
    if (!from && openTitles.indexOf(rec.title) >= 0) {
      var again = U.fill('{title}, Again', { title: rec.title });
      rec.title = openTitles.indexOf(again) < 0 ? again : U.fill('{title}, Once More', { title: rec.title });
    }
    // A hue and cry is tried for the crime they walked from, not for the chase.
    if (tid === 'manhunt') rec.crimeTitle = opts.crimeTitle || this.walkedFromTitle(opts) || null;
    if (this.commissionFor) rec.commission = this.commissionFor(rec, T);
    // A template may name the role the Council would rather not see in the dock (the Harbourmaster).
    var councilSus = T.councilRole ? suspects.filter(function (x) { return x.role === T.councilRole; })[0] : null;
    if (T.council && this.commissionFor) rec.commission = { from: 'council', wants: 'quiet', ofCouncil: councilSus ? councilSus.key : null, deadline: s.t + (T.lifetime || 250) * 0.66, days: CF.daysLeft((T.lifetime || 250) * 0.66) };
    s.cases[id] = rec;
    s.stats.cases++;
    // A written mystery with one answer, kept so the pool does not send it again.
    if ((CF.ONCE_CASES || []).indexOf(tid) >= 0) { s.flags.seenCases = s.flags.seenCases || []; if (s.flags.seenCases.indexOf(tid) < 0) s.flags.seenCases.push(tid); }
    // A leaf read from the old book in Rest belongs to the case again.
    if (from && from.id) for (var ok in s.cards) { if (s.cards[ok].caseId === from.id) { s.cards[ok].caseId = id; s.cards[ok].fresh = true; } }

    var life = Math.round((opts.lifetime || T.lifetime) * this.caseClock()) + (opts.extraTime || 0);
    var brief = from ? 'The book opens where you closed it. ' + U.fill(T.brief, vars) : U.fill(opts.brief || (structure && !opts.culpritName ? structure.brief : T.brief), vars);
    // An informant's warning: you were ready for this one.
    var warning = !T.special && (this.warningFor(tid) || (opts.warned ? { data: opts.warned } : null));
    if (warning) {
      life += CF.INFORMANT.warningExtraTime;
      var winf = warning.data.informant && this.card(warning.data.informant);
      if (winf && winf.def === 'informant') this.trustInformant(winf, 1);
      if (warning.uid) this.remove(warning);
      brief += ' You were warned, and you were ready: the scene is fresh, and you already have a name.';
    }
    var spec = {
      label: (highProfile ? '★ ' : '') + rec.title,
      desc: brief + ' (' + CF.DISTRICTS[district].label + ')' + (highProfile ? ' The crier has sung it: the whole city is watching.' : '') + (rec.commission && CF.Patrons ? ' ' + CF.Patrons.describe(rec) : ''),
      caseId: id, lifetime: life, data: { onExpire: 'cold' },
    };
    var card = opts.ctx ? opts.ctx.give('case', spec) : this.create('case', spec);
    // A case the crier sings brings the first witness to the door, after the reward.
    var lead = opts.lead || '';
    if (highProfile && !T.highProfile && !opts.first && !opts.quiet && rec.witnesses.length) {
      var wspec = this.witnessSpec(rec);
      wspec.data.stake = 'reward';
      wspec.desc = U.fill('{name}, {who}. Came to the Watch-house door with the broadsheet in their hand, and has heard there is a reward. (Witness in: {title})', { name: wspec.label.replace('Witness: ', ''), who: wspec.data.who, title: rec.title });
      if (opts.ctx) opts.ctx.give('witness', wspec); else this.create('witness', wspec);
      lead += (lead ? ' ' : '') + 'The crier\'s song brings the first of them to your door before the ink is dry.';
    }
    if (warning) this.revealSuspect(rec, null);
    if (known && known.traits.indexOf('pilloried') >= 0 && !warning) { this.revealSuspect(rec, null, { key: rec.culprit }); }
    // An old debt: somebody you once sent home instead of to the Ravenstone
    // saw something, and comes to say so. A pardoned thief at the Watch-house
    // door risks everything: their word is against their own interest.
    var debtor = !T.special && !opts.quiet && !opts.first && !from ? this.oldDebtor(opts.criminalId) : null;
    if (debtor && rng() >= 0.25) debtor = null;
    if (debtor) {
      s.flags.oldDebt[debtor.id] = s.week;
      var dspec = {
        label: 'Witness: ' + debtor.name,
        desc: U.fill('{name}, who keeps a stall in the Abbey Close now. You sent them home once instead of to the Ravenstone. They have not forgotten, and they were at their casement the night of {title}.', { name: debtor.name, title: rec.title }),
        caseId: rec.id,
        data: { knows: true, stake: 'none', who: 'a citizen you once sent home', reformed: debtor.id },
      };
      if (opts.ctx) opts.ctx.give('witness', dspec); else this.create('witness', dspec);
    }
    if (!opts.quiet) {
      // A headline that ends in a colon is a heading for the case's own name ('The Pattern: ' + the title).
      var head = opts.headline ? (/:\s*$/.test(opts.headline) ? opts.headline + rec.title : opts.headline)
        : (rec.commission ? 'A Commission from ' + CF.PATRONS[rec.commission.from].label + ': ' : 'New Case: ') + rec.title;
      this.story(head, (lead ? lead + ' ' : '') + brief + (rec.commission && CF.Patrons ? ' ' + CF.Patrons.describe(rec) : ''), 'case');
    }
    if (debtor) {
      this.story('An Old Debt', U.fill('{name} is waiting on the Watch-house step with their cap in their hands. "You sent me home once," they say. "I saw something."', { name: debtor.name }), 'major');
    }
    return card;
  };
  // The case a hunted name walked from: the last one on their record that was
  // not itself a hue and cry.
  P.walkedFromTitle = function (opts) {
    var c = (opts.criminalId && this.criminal && this.criminal(opts.criminalId)) || (opts.culpritName && this.criminalByName && this.criminalByName(opts.culpritName));
    if (!c || !c.history) return null;
    var chase = U.fill(CF.CASE_TEMPLATES.manhunt.title, { culprit: c.name });
    var hs = c.history.filter(function (h) { return h.title && h.title !== chase; });
    return hs.length ? hs[hs.length - 1].title : null;
  };
  // What a conviction says the accused was convicted of.
  // The Vanished found alive: the charge is the lesser crime, the taking.
  P.convictedOf = function (rec) { return rec.crimeTitle || (rec.foundAlive ? U.fill('the abduction of {victim}', { victim: rec.victim }) : rec.title); };
  // A citizen you once sent home who may come back as a witness: reformed,
  // not the case's own criminal, and nobody come that way in six weeks.
  P.oldDebtor = function (exceptId) {
    var s = this.s;
    if (!s.flags.oldDebt) s.flags.oldDebt = {};
    for (var od in s.flags.oldDebt) if (s.week - s.flags.oldDebt[od] < 6) return null;
    var pool = [];
    for (var k in s.criminals) {
      var c = s.criminals[k];
      if (c.status === 'reformed' && c.id !== exceptId && c.name) pool.push(c);
    }
    return pool.length ? U.pick(this.rng, pool) : null;
  };

  // Record that the detective spent effort on a case (feeds Obsession).
  P.caseWork = function (rec, ctx) {
    if (!rec) return;
    rec.work++;
    if (rec.work > 6 && this.rng() < 0.35) {
      if (ctx) ctx.give('obsession'); else this.create('obsession');
      return true;
    }
    return false;
  };

  // Reveal a suspect card for a case. Returns the card, or null.
  P.revealSuspect = function (rec, ctx, opts) {
    opts = opts || {};
    var pool = rec.suspects.filter(function (x) { return !x.revealed && !x.cleared; });
    if (opts.key) pool = rec.suspects.filter(function (x) { return x.key === opts.key && !x.cleared; });
    if (!pool.length) return null;
    var sus = U.pick(this.rng, pool);
    sus.revealed = true;
    var trait = CF.TRAITS.filter(function (t) { return t.id === sus.trait; })[0];
    var spec = {
      label: sus.name,
      desc: U.fill('{name}, {role}. {trait}', { name: sus.name, role: sus.role, trait: trait.desc }) + ' (Accused in: ' + rec.title + ')',
      caseId: rec.id, data: { key: sus.key },
    };
    if (rec.identified === sus.key) spec.label = 'Prime Suspect: ' + sus.name;
    return ctx ? ctx.give('suspect', spec) : this.create('suspect', spec);
  };

  P.suspectOf = function (card) {
    var rec = this.caseRec(card.caseId);
    if (!rec) return null;
    return rec.suspects.filter(function (x) { return x.key === card.data.key; })[0] || null;
  };

  // Build a clue spec. Helpers (equipment, team) sharpen what's found;
  // Tunnel Vision may silently misread it.
  // What a scene item or evidence is made of, for equipment to act on.
  CF.itemTags = function (item) {
    if (!item) return [];
    if (item.tags) return item.tags;
    var needs = item.needs;
    return needs === 'prints' ? ['surfaces'] : needs === 'bio' ? ['biology', 'physical'] : needs === 'lab' ? ['records'] : [];
  };
  P.clueSpec = function (rec, item, helpers, flags) {
    flags = flags || {};
    var aspects = U.clone(item.aspects || {});
    var bonus = {};
    var tags = CF.itemTags(item);
    (helpers || []).forEach(function (h) {
      var mods = CF.CARDS[h.def].mods;
      if (CF.aspectsOf(h).tool) {
        // Equipment only sharpens what it is for.
        if (mods && mods.boost && mods.boost.tags.some(function (t) { return tags.indexOf(t) >= 0; })) U.addAspects(bonus, mods.boost.aspects);
      } else U.addAspects(bonus, CF.clueAspects(h));
    });
    // Helpers add up to 3 points in all, at most 2 to any one aspect.
    var total = 0;
    for (var a in bonus) {
      var add = Math.min(bonus[a], 2, 3 - total);
      if (add > 0) { aspects[a] = (aspects[a] || 0) + add; total += add; }
    }
    var data = { trait: item.trait || null, coerced: !!flags.coerced, planted: !!flags.planted, illegal: !!flags.illegal, points: flags.points || null, link: item.link || null };
    if (flags.stake) { data.stake = flags.stake; data.witness = flags.witness || null; data.againstInterest = !!flags.againstInterest; }
    if (item.pattern) data.pattern = true;
    if (item.alibi) data.alibi = item.alibi;
    // Whose words these are: a confession, a motive or a story belongs to the one who gave it.
    if (item.about || flags.about) data.about = item.about || flags.about;
    if (item.names) data.names = true;
    if (item.staged) data.staged = true;
    if (flags.confession) { data.confession = flags.confession; data.falseConfession = !!flags.falseConfession; }
    if (this.countOf('tunnel') && !flags.noMisread && this.rng() < 0.35) data.misread = true;
    var spec = {
      label: item.label,
      desc: item.text,
      aspects: aspects,
      caseId: rec.id,
      data: data,
    };
    if (item.link) spec.lifetime = 0; // a chit in a drawer keeps: the thread needs two of them
    return spec;
  };

  P.witnessSpec = function (rec, who) {
    if (!who) who = rec.witnesses.length ? rec.witnesses.shift() : 'a passer-by';
    var name = this.newName(this.sexOf(who));
    var stake = U.pick(this.rng, Object.keys(CF.STAKES));
    var knows = this.rng() < 0.8;
    return {
      label: 'Witness: ' + name,
      desc: name + ', ' + who + '. ' + (knows ? 'Was at their casement and saw somebody near ' : 'Heard something near ') + rec.scene + ', and ' + CF.STAKES[stake].desc + '. (Witness in: ' + rec.title + ')',
      caseId: rec.id,
      data: { knows: knows, stake: stake, who: who },
    };
  };

  // Remove every card belonging to a case (optionally sparing some).
  P.clearCaseCards = function (caseId, spare) {
    spare = spare || [];
    var fronts = this.s.network && this.s.network.fronts || {};
    for (var k in this.s.cards) {
      var c = this.s.cards[k];
      if (c.caseId !== caseId || spare.indexOf(c) >= 0) continue;
      // A clue that names a society's door outlives its case: the thread needs two of them.
      var f = c.def === 'clue' && c.data && c.data.link && fronts[c.data.link];
      if (f && (f.society || f.fence) && c.loc) {
        if (!c.data.kept) { c.data.kept = true; c.label = 'Kept: ' + this.labelOf(c); c.life = 400; c.maxLife = 400; this.dirty = true; }
        continue;
      }
      this.remove(c);
    }
  };

  // A record of how a case ended, for the Case Archive. `seat` is the card
  // the ending happened on (the trial, or the case gone cold): its uid and
  // table spot, so the interface can stamp the verdict where the player
  // was looking. The card is already gone from the table when this is sent.
  P.caseRecord = function (rec, outcome, charged, seat) {
    var cul = rec.suspects.filter(function (x) { return x.guilty; })[0];
    var trait = cul && CF.TRAITS.filter(function (t) { return t.id === cul.trait; })[0];
    var out = {
      id: rec.id + '-' + this.s.seed, title: rec.title, template: rec.template, district: rec.district, scene: rec.scene,
      victim: rec.victim, outcome: outcome, charged: charged || null, week: this.s.week, highProfile: !!rec.highProfile,
      culprit: cul ? { name: cul.name, role: cul.role, motive: cul.motive, trait: trait ? trait.desc : '' } : null,
      detective: this.s.detective, calling: this.s.calling,
    };
    if (seat && seat.uid) { out.uid = seat.uid; out.at = seat.at || null; }
    return out;
  };

  // The opening's case ended without a conviction (gone cold, closed by the
  // Rival, settled by the thief-takers): the desk is kept all the same. The
  // Bell, the stipend and the city's clock start as after a first conviction
  // (openingKeep), so the opening never strands you at an empty desk.
  // (An acquittal tells it in the verdict.) Returns true when it ran.
  CF.OPENING_LOST = 'The Council does not pay for a case it did not see answered in the Blood Court, but it pays for the desk: someone has to sit under the stair. The Bell rings from today, and the cases will come on the city\'s clock.';
  P.openingLost = function (rec, why) {
    var s = this.s, self = this;
    if (!s.flags.opening || !this.openingKeep || (rec && !rec.opening)) return false;
    // Lost before the sergeant was satisfied: the place is given all the same.
    if (s.flags.stage !== 'hired') {
      s.flags.stage = 'hired';
      s.flags.firstCase = true;
      this.cardsOf('watchq', true).forEach(function (c) { self.remove(c); });
      if (this.introUnlock) this.introUnlock(['investigate', 'interrogate', 'analyze', 'reflect']);
      if (this.introReveal) this.introReveal(['instinct', 'health', 'focus', 'personnel']);
    }
    s.flags.openingLost = why || 'cold';
    this.story('The Desk All the Same', CF.OPENING_LOST, 'major');
    this.openingKeep();
    if (!this.openCases().length) s.dispatchT = Math.min(s.dispatchT, 20);
    // What you want from the desk is still to be asked.
    if (s.flags.callingOpen && s.flags.callingDue && !s.choice && this.offerChoice && CF.CHOICES) {
      delete s.flags.callingDue;
      this.offerChoice(CF.CHOICES.filter(function (c) { return c.id === 'calling'; })[0]);
    }
    return true;
  };

  P.goCold = function (caseId) {
    var rec = this.caseRec(caseId), open = !!rec && rec.status === 'open';
    this.caseGoesCold(caseId);
    if (open && rec.opening && rec.status === 'cold' && !this.s.over) this.openingLost(rec, 'cold');
  };
  P.caseGoesCold = function (caseId) {
    var rec = this.caseRec(caseId);
    var card = this.caseCard(caseId);
    var seat = card ? { uid: card.uid, at: card.loc && card.loc.t === 'table' ? { x: card.loc.x, y: card.loc.y } : null } : null;
    if (card) this.remove(card);
    if (!rec || rec.status !== 'open') return;
    rec.status = 'cold';
    if (this.commissionCold) this.commissionCold(rec);
    this.releaseDelegate(rec);
    this.s.stats.cold++;
    this.emit('resolved', this.caseRecord(rec, 'cold', null, seat));
    this.clearCaseCards(caseId);
    var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
    this.meter('pressure', (rec.highProfile ? 2 : 1) + (rec.major ? 1 : 0) - (this.s.rank === 0 && !rec.highProfile && !rec.major ? 1 : 0));

    if (rec.template === 'gang') {
      this.meter('retaliation', 2);
      this.story('The Disguise Slips', 'Your case against ' + rec.vars.gang + ' falls apart. They know who you are now.', 'danger');
      return;
    }
    if (rec.template === 'syndicate') {
      this.meter('retaliation', 3);
      this.story('The Court Laughs', 'Your case against the Coquille runs out of road. The King of Thunes sends you a cask of very good Rhenish, with his compliments.', 'danger');
      return;
    }
    if (rec.template === 'architect') {
      this.s.flags.architect = false;
      // The marks that found him come back, but one of the three has been plastered over.
      var marks = (rec.marks || []).slice(0, 2), self = this;
      marks.forEach(function (m) { self.create('looseend', self.looseEndSpec(m.fromTitle, m.aspect, m.week)); });
      if (marks.length) this.story('The Architect Vanishes', 'By the time you get a writ the house on the Hill is empty, except for three strokes cut into the mantel. One of the three marks has been plastered over. You still have two of the marks.', 'danger');
      else this.story('The Architect Vanishes', 'By the time you get a writ the house on the Hill is empty, except for three strokes cut into the mantel. You will have to find the thread again.', 'danger');
      return;
    }
    if (rec.template === 'harbourmaster') { this.harbourLost(rec); return; }
    if (rec.template === 'manhunt') {
      this.huntEnds(rec, 'slipped');
      this.story('Gone Again', culprit.name + ' has slipped away again. The sighting leads nowhere.', 'danger');
      return;
    }

    var crim = this.criminalEscapes(rec, culprit, 'cold');
    var al = this.atLargeCardFor(crim);
    if (al) this.refreshAtLarge(crim);
    else al = this.create('atlarge', {
      label: this.atLargeLabel(crim),
      desc: culprit.name + ', ' + culprit.role + '. Walked from ' + rec.title + '. ' + this.criminalDesc(crim),
      data: { name: culprit.name, trait: culprit.trait, template: rec.template, criminalId: crim.id },
    });
    this.create('coldcase', {
      label: 'Unanswered: ' + rec.title,
      desc: 'The trail went cold. ' + culprit.name + ' walked. With the Rolls, this can be opened again in Study.',
      data: { template: rec.template, culpritName: culprit.name, culpritTrait: culprit.trait, atLargeUid: al.uid, title: rec.title,
        // What the case was, for the day it is opened again: the same victim, scene and names, the proof not yet found.
        from: { id: rec.id, victim: rec.victim, district: rec.district, scene: rec.scene, structure: rec.structure, vars: rec.vars,
          items: rec.items.slice(rec.found), suspects: rec.suspects, title: rec.title, template: rec.template } },
    });
    this.story('The Trail Goes Cold', rec.title + ' goes into the Rolls unanswered. Somewhere in ' + CF.DISTRICTS[rec.district].label +
      ', ' + culprit.name + ' hears the crier and laughs.' + (rec.template === 'pattern' && rec.patternRead ? ' You knew the door, and nobody stood in it.' : ''), 'danger');
  };

  // The Harbourmaster's examiner answers a case first (the Rival's 'close').
  // Not a case gone cold: no Crowd, no Unanswered card, and the culprit does
  // not walk laughing. The Council notes who was quicker (Standing -1). Six
  // times in ten they hang the right name and the culprit leaves the game;
  // otherwise a wrong one, and the real culprit lies low until the ballad of
  // the Wrong Name blames the Harbourmaster's examiner. A band's, the
  // Coquille's or the Architect's case is beyond them: always a wrong name.
  // Returns { right, hanged } or null when the case is not open.
  P.rivalCloses = function (recOrId, rivalName) {
    var s = this.s;
    var rec = recOrId && typeof recOrId === 'object' ? recOrId : this.caseRec(recOrId);
    if (!rec || rec.status !== 'open') return null;
    if (!rivalName) { var rv = this.cardsOf('rival', true)[0]; rivalName = rv && rv.data && rv.data.name ? rv.data.name : 'The Harbourmaster\'s examiner'; }
    var card = this.caseCard(rec.id);
    if (card) this.remove(card);
    rec.status = 'rival';
    if (this.commissionCold) this.commissionCold(rec);
    this.releaseDelegate(rec);
    var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0] || null;
    var others = rec.suspects.filter(function (x) { return !x.guilty; });
    var right = !!culprit && !rec.special && (!others.length || this.rng() < 0.6);
    var hanged = right ? culprit : (others.length ? U.pick(this.rng, others) : null);
    s.stats.rivalClosed = (s.stats.rivalClosed || 0) + 1;
    this.emit('resolved', this.caseRecord(rec, 'rival', hanged ? hanged.name : null));
    this.clearCaseCards(rec.id);
    this.meter('reputation', -1);
    if (rec.template === 'architect') s.flags.architect = false;
    if (rec.template === 'harbourmaster') this.harbourLost(rec);
    var text = rivalName + ' has closed ' + rec.title + ' with a confession the Harbourmaster is pleased with. The Council notes who was quicker.';
    if (right) {
      var c = this.criminalByName(culprit.name);
      if (c) {
        c.status = 'dead';
        c.history.push({ week: s.week, title: rec.title, how: 'rival' });
        var al = this.atLargeCardFor(c);
        if (al) this.remove(al);
      }
      text += ' ' + culprit.name + ' hangs on the Ravenstone for it, and the Rolls have nothing to add.';
    } else if (culprit) {
      var w = this.criminalEscapes(rec, culprit, 'rival');
      if (this.atLargeCardFor(w)) this.refreshAtLarge(w);
      else this.hideCriminal(w, rec, 'rival', hanged && hanged.alibi, hanged);
      if (hanged) text += ' ' + hanged.name + ' hangs for it. You read the file once, and you are not sure.';
    }
    this.story('Answered by the Rival', text, 'danger');
    if (rec.opening && !s.over) this.openingLost(rec, 'rival');
    return { right: right, hanged: hanged ? hanged.name : null };
  };

  // The Harbourmaster's Examiner caught (round 8). A thread is found by Wit
  // or Instinct; the second is catching them at it: their own work brought to
  // Question (a token they spoiled, a witness they paid, the case they took),
  // or a case they took answered in the Blood Court before they close it.
  // A thread left lying goes slack after CF.RIVAL_THREAD_WEEKS. Exposure:
  // Standing +1, the Council's favour +1, and they are gone CF.RIVAL_GONE_WEEKS.
  CF.RIVAL_THREAD_WEEKS = 3;
  CF.RIVAL_GONE_WEEKS = 10;
  CF.RIVAL_CATCH = 'You have a thread. Now catch them at it: something they spoiled, a witness they paid, a case they took.';
  // Is this card the Rival's own work: a spoiled token, a paid witness, a case they took?
  P.rivalWork = function (card) {
    if (!card) return false;
    var d = card.data || {};
    if ((card.def === 'clue' || card.def === 'evidence') && d.tampered) return true;
    if (card.def === 'witness' && d.bribed) return true;
    return this.rivalWorkCase(card);
  };
  P.rivalWorkCase = function (card) {
    if (!card || card.def !== 'case' || !card.caseId) return false;
    var rec = this.caseRec(card.caseId);
    return !!(rec && rec.rival && rec.status === 'open');
  };
  // A thread pulled on the Rival `r` (how: question, shadow, caught, case).
  // Returns { exposed } with the story's tail, for the recipe or the verdict.
  P.rivalThread = function (r, how) {
    var s = this.s;
    if (!r || r.def !== 'rival' || !r.loc) return null;
    r.data = r.data || {};
    var caught = how === 'caught' || how === 'case';
    if ((r.data.heat || 0) >= 1 && caught) {
      this.remove(r);
      s.flags.rivalGone = Math.max(s.flags.rivalGone || 0, s.week + CF.RIVAL_GONE_WEEKS); // never shortens the Harbourmaster's hold
      this.meter('reputation', 1);
      if (this.favourGain) this.favourGain('council', 1, 'the Rival exposed');
      s.stats.rivalExposed = (s.stats.rivalExposed || 0) + 1;
      if (!s.flags.harbourFallen) this.create('customsleaf');
      return { exposed: true, text: 'The Council reads the file in silence and sends the Harbourmaster\'s Examiner back to the Customs House. Your name is spoken in the chamber, warmly for once.' +
        (s.flags.harbourFallen ? '' : ' In the examiner\'s desk, a leaf from the Customs House: what the Harbourmaster paid, and for what.') };
    }
    r.data.heat = 1;
    r.data.heatWeek = s.week;
    r.data.heatHow = how;
    this.dirty = true;
    return { exposed: false };
  };
  // At the Bell: a thread on the Rival left too long goes slack.
  P.rivalFade = function () {
    var r = this.cardsOf('rival', true)[0], s = this.s;
    if (!r || !r.data || !(r.data.heat >= 1)) return [];
    // An older save's thread carries no week (-1 from Engine.load): its clock starts now.
    if (typeof r.data.heatWeek !== 'number' || r.data.heatWeek < 0) { r.data.heatWeek = s.week; return []; }
    if (s.week - r.data.heatWeek < CF.RIVAL_THREAD_WEEKS) return [];
    r.data.heat = 0;
    r.data.heatHow = null;
    r.data.heatWeek = -1; // no thread: as a new card, and as Engine.load reads it
    r.data.eyes = null;
    this.dirty = true;
    return [U.fill('The thread on {name} has gone slack. Find another.', { name: r.data.name || 'the Rival' })];
  };

  // ---- Charges and trials ---------------------------------------------------
  // Assess a charge. `apparent` is what you believe; `real` excludes misread clues.
  // assessCharge lives in js/systems/charge.js.

  // Why the sworn men acquit on full proof, the rare time they do.
  CF.FULL_PROOF_FAILS = [
    'One of the sworn men had dined with the accused\'s guild the night before.',
    'The accused\'s cousin sits on the Council, and the foreman knows it.',
    'A sworn man is taken ill, and his place is filled from the accused\'s own street.',
    'The advocate finds a clerk\'s error in the date of the deposition, and the sworn men take the way out it offers.',
  ];

  P.verdict = function (trialCard) {
    var d = trialCard.data;
    // Where the trial sat, for the stamp: the card goes, the interface keeps its ghost.
    var seat = { uid: trialCard.uid, at: trialCard.loc && trialCard.loc.t === 'table' ? { x: trialCard.loc.x, y: trialCard.loc.y } : null };
    this.remove(trialCard);
    var rec = this.caseRec(d.caseId);
    if (!rec) return;
    var s = this.s;
    var rng = this.rng;
    var notes = [];
    var p;
    var tier = d.tier || (d.solid ? 'strong' : 'weak');
    if (d.guilty) {
      p = d.solid ? 0.97 : tier === 'reasonable' ? U.clamp(0.35 + 0.4 * d.real / d.need, 0.35, 0.8) : U.clamp(0.15 + 0.5 * d.real / d.need, 0.15, 0.55);
    } else {
      p = U.clamp(0.08 + 0.25 * Math.min(1, d.real / d.need), 0, 0.35);
      if (d.coerced) p += 0.25;
      if (d.planted) p += 0.25;
    }
    // A confession is the king of proofs. Given freely it convicts; given
    // under the question it must be repeated freely a day later, and the
    // Court checks it against the body of the thing. A false confession
    // that nothing contradicts convicts all the same [Carolina].
    // A true free confession that nothing contradicts all but settles it.
    if (d.confession === 'free') p = Math.max(p, d.guilty && !d.contradictions ? 0.98 : 0.9);
    else if (d.confession === 'question') {
      if (d.guilty) p = d.checked ? Math.max(p, 0.9) : Math.max(p, 0.6);
      else p = d.checked ? 0.12 : 0.8;
      if (!d.checked && rng() < 0.4) notes.push(d.guilty ? d.name + ' repeats the confession before the judge, freely, as the Carolina asks.' : d.name + ' recants before the judge, then, shown the Hole again, confesses a second time.');
      else if (d.checked && !d.guilty) notes.push('The confession says one thing and the body of the thing says another. The judge sees it.');
    }
    var struck = false; // the defence took something out of the proof
    for (var i = 0; i < d.coerced; i++) {
      if (rng() < 0.3) {
        struck = true;
        p -= 0.25;
        this.meter('scrutiny', 1);
        notes.push('The defence has the coerced statement thrown out. The judge asks, pointedly, how it was obtained.');
      }
    }
    for (var q = 0; q < (d.illegal || 0); q++) {
      if (rng() < 0.3) {
        struck = true;
        p -= 0.25;
        this.meter('scrutiny', 1);
        notes.push('The accused\'s advocate asks to see the writ for the search. There is no writ. The proof is struck out.');
      }
    }
    if (d.planted && rng() < 0.3) {
      p = 0.03;
      struck = true;
      this.meter('scrutiny', 3);
      notes.push('The accused\'s advocate takes your arranged proof apart before the sworn men. The court goes very quiet.');
    }
    for (var j = 0, read = 0; j < (d.contradictions || 0); j++) {
      if (rng() < 0.35) {
        p -= 0.2;
        struck = true;
        if (!read++) notes.push('The advocate reads your own proof back to the sworn men: it describes somebody else entirely.');
        else if (read === 2) notes.push('Then he does it again, with another token of yours.');
      }
    }
    p = U.clamp(p, 0.02, 0.98);
    // The opening case teaches the Court; it does not gamble. Full proof against the guilty holds.
    if (rec.opening && d.guilty && d.solid && !struck) p = 1;
    var convicted = rng() < p;
    // Full proof that fails anyway: the city saw the proof, and the week says what turned the sworn men.
    var unlucky = !convicted && d.guilty && !struck && (d.solid || (d.confession === 'free' && !d.contradictions));
    if (unlucky) notes.push(U.pick(rng, CF.FULL_PROOF_FAILS), 'The Market saw your proof, and blames the bench, not you.');
    rec.status = convicted ? 'closed' : 'acquitted';
    if (this.commissionVerdict) this.commissionVerdict(rec, d, convicted, notes);
    if (this.mountainVerdict) this.mountainVerdict(rec, d, convicted);
    if (rec.template === 'harbourmaster' && !convicted) this.harbourLost(rec);
    this.emit('resolved', this.caseRecord(rec, convicted ? (d.guilty ? 'convicted' : 'wrongful') : 'acquitted', d.name, seat));
    var hp = rec.highProfile;
    if (convicted) this.openTheCity();

    if (convicted) {
      s.stats.convictions++;
      if (!d.guilty) s.stats.wrongful++;
      if (d.guilty) {
        this.meter('retaliation', -1);
        var caught = this.criminalCaught(d.name);
        var alc = caught && this.atLargeCardFor(caught);
        if (alc) { this.remove(alc); notes.push('Their name comes off the wall.'); }
        // Justice in the everyday loop: a culprit with a real record (one who walked, went cold,
        // was settled for, or let another hang), and one who hurts people.
        var record = caught && (caught.crimes >= 2 || (caught.history || []).some(function (h) { return h.how === 'acquitted' || h.how === 'cold' || h.how === 'settled' || h.how === 'wrongful' || h.how === 'slipped'; }));
        if (record) this.pathGain('crusader', 1, 'put away a repeat offender');
        if (caught && (caught.traits || []).indexOf('violent') >= 0) this.pathGain('crusader', 1, 'put away a violent man');
        if (d.solid && rec.identified === rec.culprit && !rec.special) this.pathGain('master', 1, 'reasoned to the right name');
      }
      this.meter('reputation', 1 + (d.solid ? 1 : 0) + (hp ? 1 : 0) + (rec.special ? 2 : 0) + (rec.major ? 1 : 0));
      this.meter('pressure', hp ? -2 : -1);
      var t = this.cardsOf('tunnel')[0];
      var ob = this.cardsOf('obsession')[0];
      if (t) { this.remove(t); notes.push('The fog in your head lifts. You can see the edges of things again.'); }
      else if (ob) this.remove(ob);
      var pay = d.guilty ? (CF.ECONOMY.convictionPay[tier] || 0) + (hp ? CF.ECONOMY.highProfilePay : 0) : 0;
      for (var pi = 0; pi < pay; pi++) this.create('funds');
      // A Council family convicted against the Council's wish: no thanks, only the fee.
      var spurned = rec.commission && rec.commission.from === 'council' && rec.commission.delivered === 'truth';
      if (pay) notes.push(tier !== 'strong' ? 'The case closes, and a small fee comes with it.' : spurned ? 'The Watch-house fee is paid to the coin, and not a penny over.' : 'The Council\'s thanks, with a purse attached.');
      if (d.guilty && !rec.special && rng() < 0.35) { this.create('funds'); notes.push('At the court door ' + rec.victim + ' presses a coin into your hand and will not take it back. An honest fee.'); }
      if (d.framed) {
        for (var fi = 0; fi < 3; fi++) this.create('funds');
        this.count('purse', 2);
        s.stats.frames = (s.stats.frames || 0) + 1;
        notes.push('The reward for the conviction is paid out, and the thief-takers take their share of it at the Red Ox. Blood money, the ballad-sellers will call it later.');
      }
      if (d.solid) s.stats.solid = (s.stats.solid || 0) + 1;
      if (this.growthTick) this.growthTick();
      if (this.openingKeep) this.openingKeep();
      if (d.solid && d.guilty) {
        if (s.calling === 'master' && rng() < 0.55) {
          this.create('looseend', this.looseEndSpec(rec.title, rec.keyAspects[0]));
          this.pathGain('master', 1, 'a loose end');
          notes.push('But one detail belongs to no one in the case: a small mason\'s mark, three strokes, cut where the crime began. You have seen it before.');
        }
      }
      this.onConviction(rec, d, notes);
      if (!s.over) this.condemn(rec, d, tier);
      if (!d.guilty) {
        var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
        this.meter('scrutiny', 1);
        if (rec.template === 'manhunt') this.huntEnds(rec, 'slipped');
        if (!rec.special) {
          var crimW = this.criminalEscapes(rec, culprit, 'wrongful');
          if (this.atLargeCardFor(crimW)) this.refreshAtLarge(crimW);
          else { var wrongS = rec.suspects.filter(function (x) { return x.name === d.name; })[0] || {}; this.hideCriminal(crimW, rec, null, wrongS.alibi, wrongS); }
        }
      }
      var lesser = tier !== 'strong' && !d.solid && !rec.special && d.confession !== 'free';
      var T = CF.CASE_TEMPLATES[rec.template];
      if (lesser) notes.unshift('On half proof the Court convicts of the lesser crime only: ' + (T && T.lesser ? T.lesser : 'the lesser charge') + '.');
      if (rec.crimeTitle) notes.unshift('The hue and cry brought them in. The Court tried them for what they walked from.');
      this.story('Guilty: ' + d.name, 'The sworn men are out for ' + (d.solid ? 'the length of a Paternoster' : 'two days') + '. ' + d.name + ' is convicted of ' + this.convictedOf(rec) + ', and the sergeants take them down to the Hole to wait for the sentence. ' +
        (d.guilty ? '' : 'You tell yourself it was the right person. ') + notes.join(' '), 'victory');
    } else {
      s.stats.acquittals++;
      if (!unlucky) this.meter('pressure', 1);
      this.meter('retaliation', rec.special ? 2 : 1);
      this.meter('reputation', -1);
      if (tier === 'weak' && rng() < 0.5) {
        this.meter('scrutiny', 1);
        notes.push('The judge\'s remarks about a thin charge reach the Council chamber by sext.');
      }
      if (!rec.special || rec.template === 'manhunt') {
        if (rec.template === 'manhunt' && rec.atLargeUid && this.card(rec.atLargeUid)) {
          // They were already at large; they simply stay so, and the hunt is off.
          this.huntEnds(rec, 'acquitted');
        } else {
          var charged = rec.suspects.filter(function (x) { return x.name === d.name; })[0] || { name: d.name, trait: null };
          var crimA = d.guilty ? this.criminalEscapes(rec, charged, 'acquitted') : null;
          if (crimA && this.atLargeCardFor(crimA)) this.refreshAtLarge(crimA);
          else this.create('atlarge', {
            label: (crimA ? CF.Criminals.rankOf(crimA).label : 'Abroad') + ': ' + d.name,
            desc: d.name + ' walked out of the Blood Court smiling. ' + (d.guilty ? 'They are guilty, and now they are careful. ' + this.criminalDesc(crimA) : 'They were innocent, and now they hate you.'),
            // An innocent acquitted is nobody to hunt: their grudge feeds the Vendetta until they leave the city.
            data: { name: d.name, trait: charged.trait, careful: true, criminalId: crimA ? crimA.id : null, innocent: !d.guilty },
            lifetime: d.guilty ? undefined : CF.INNOCENT_ABROAD_WEEKS * WEEK,
          });
        }
      }
      if (rec.template === 'architect') s.flags.architect = false;
      // What the sworn men wanted and did not get, so the loss teaches something.
      var missing = this.acquittalLine(d);
      if (missing) notes.push(missing);
      // The opening case lost: the Council has seen you work all the same. The desk,
      // the Bell and the city's clock are yours, and a case comes soon (openingKeep).
      var keepAnyway = !!(s.flags.opening && this.openingKeep);
      this.story('Not Guilty: ' + d.name, (notes.length ? notes.join(' ') + ' ' : '') + 'The sworn men acquit. ' + d.name +
        ' walks down the court steps into the crowd\'s cheering and looks straight at you.' +
        (keepAnyway ? ' The sworn men did not convict, but the Council has seen you work: the desk is yours, and so is the Bell.' : ''), 'danger', { cue: 'quiet' });
      if (keepAnyway) {
        s.flags.openingAcquitted = true;
        this.openingKeep('acquitted');
        if (!this.openCases().length) s.dispatchT = Math.min(s.dispatchT, 20);
      }
    }
  };

  // One line for an acquittal: the rows of the charge that were short, and
  // what the tokens laid did bring. Null when every row was met (the loss was
  // the word, a contradiction, or the bench) or the trial is from an older save.
  P.acquittalLine = function (d) {
    var rows = d && d.rows;
    if (!rows || !rows.length) return null;
    var lab = function (k) { return CF.ASPECTS[k] ? CF.ASPECTS[k].label : k; };
    var short = rows.filter(function (r) { return r.have < r.need; });
    if (!short.length) return null;
    var want = short.map(function (r) { return lab(r.aspect) + ' ' + r.need; }).join(', ');
    var have = d.have || {};
    var brought = Object.keys(have).filter(function (k) { return have[k] > 0 && CF.ASPECTS[k]; }).map(function (k) { return lab(k) + ' ' + have[k]; }).join(', ');
    return brought ? U.fill('The sworn men wanted {want}; you brought {brought}.', { want: want, brought: brought })
      : U.fill('The sworn men wanted {want}; you brought nothing.', { want: want });
  };

  P.onConviction = function (rec, d, notes) {
    var s = this.s;
    var self = this;
    if (d.name) this.callOffHunts(d.name, rec.id);
    // A case the Rival took, answered first: a thread on them, or the end of them.
    if (rec.rival) {
      var rv = this.cardsOf('rival', true)[0];
      var th = rv && this.rivalThread(rv, 'case');
      var rvName = rv && rv.data && rv.data.name ? rv.data.name : 'The Harbourmaster\'s examiner';
      if (th) this.story('Quicker than the Customs House', U.fill('{name} was working {title} from the other side, and the Blood Court heard yours first.', { name: rvName, title: rec.title }) + ' ' +
        (th.exposed ? th.text : 'A thread on them: they were seen at it, and the Council saw who was quicker.'), th.exposed ? 'major' : 'minor');
    }
    // The Vanished, found alive, sees it done: the city is glad of it.
    if (rec.foundAlive && d.guilty) {
      this.meter('reputation', 1);
      this.meter('pressure', -1);
      notes.push(U.fill('{victim} is in the gallery to hear it. Standing +1, and the Crowd eases.', { victim: rec.victim }));
    }
    // Reopened cases and manhunts put an at-large criminal away.
    if (rec.atLargeUid && this.card(rec.atLargeUid) && d.guilty) {
      this.remove(this.card(rec.atLargeUid));
      notes.push('One less name on the list of those who walked.');
      this.meter('retaliation', -1);
      this.meter('reputation', 1);
      this.pathGain('crusader', 1, 'put away someone at large');
      if (rec.reopened) this.pathGain('master', 1, 'closed a cold case');
    }
    if (rec.template === 'gang') {
      var g = rec.gangUid && this.card(rec.gangUid);
      if (d.guilty || d.solid) {
        if (s.flags.uprightPaid && s.flags.uprightPaid === rec.vars.gang) s.flags.uprightBroken = true; // the boy's last visit is told at the Bell
        this.scatterBand(rec.vars.gang, g ? g.data.members : null);
        if (g) this.remove(g);
        this.meter('retaliation', -4);
        this.pathGain('crusader', 2, 'broke a gang');
        this.create('ledger');
        notes.push(rec.vars.gang + ' is finished. In the upright man\'s strongbox: a leaf of a ledger, with sums that lead further down.');
        notes.push('The rest of ' + rec.vars.gang + ' scatter into the Warrens, smaller men than they were.');
      }
    }
    if (rec.template === 'syndicate') {
      this.cardsOf('syndicate', true).forEach(function (c) { self.remove(c); });
      s.flags.syndicateFallen = true;
      // The Court scatters: its sworn are nobody's again.
      for (var ck in s.criminals) if (s.criminals[ck].organization === 'syndicate') s.criminals[ck].organization = 'none';
      this.cardsOf('atlarge', true).forEach(function (c) {
        if (!c.data.band) return;
        delete c.data.band;
        var r = c.data.criminalId && self.criminal(c.data.criminalId);
        if (r) self.refreshAtLarge(r); else c.label = 'Abroad: ' + c.data.name;
      });
      if (this.coquilleFalls) this.coquilleFalls();
      this.meter('retaliation', -6);
      this.meter('reputation', 5);
      this.pathGain('crusader', 3, 'broke the Coquille');
      // Breaking the Syndicate is the Crusader's ending for anyone whose
      // Justice is not clearly behind their current path.
      if (this.pathOpen('crusader')) { this.gameOver('crusader'); return; }
      notes.push('The Coquille is broken.');
    }
    if (rec.template === 'eumenides' && d.guilty && this.eumenidesBroken) this.eumenidesBroken(rec, d, notes);
    if (rec.template === 'receiver' && d.guilty && this.receiverConvicted) this.receiverConvicted(rec, notes);
    if (rec.template === 'architect') {
      if (d.guilty && this.pathOpen('master')) { this.gameOver('master'); return; }
      s.flags.architect = false;
    }
    if (rec.template === 'harbourmaster') this.harbourFalls(rec, d);
  };

  // ---- Loose Ends and the Architect ------------------------------------------------
  // A Loose End remembers the case it came from: its title, the kind of
  // proof that case turned on, and the week. In the Architect's case each
  // becomes a token worth two of that kind.
  P.looseEndSpec = function (fromTitle, aspect, week) {
    var def = CF.CARDS.looseend;
    var spec = { data: { fromTitle: fromTitle || null, aspect: aspect || 'opportunity', week: typeof week === 'number' ? week : this.s.week } };
    if (fromTitle) spec.desc = U.fill('From {fromTitle}: three strokes cut where the crime began.', { fromTitle: fromTitle }) + ' ' + def.desc;
    return spec;
  };
  // The three Loose Ends laid in Rest become the Architect's first tokens, and
  // the case keeps them, to give two back if it goes cold.
  CF.LOOSE_END_ASPECTS = ['motive', 'digital', 'financial'];
  P.architectMarks = function (rec, ends, ctx) {
    if (!rec) return [];
    var self = this;
    rec.marks = ends.map(function (c, i) {
      var d = c.data || {};
      return { fromTitle: d.fromTitle || null, aspect: CF.ASPECTS[d.aspect] ? d.aspect : CF.LOOSE_END_ASPECTS[i % CF.LOOSE_END_ASPECTS.length], week: typeof d.week === 'number' ? d.week : -1 };
    });
    return rec.marks.map(function (m) {
      var aspects = {};
      aspects[m.aspect] = 2;
      var spec = self.clueSpec(rec, {
        label: m.fromTitle ? U.fill('The Mark at {fromTitle}', { fromTitle: m.fromTitle }) : 'An Old Mark',
        text: 'You were there. You saw the three strokes and did not know what they were. Now you do.',
        aspects: aspects,
      }, [], { noMisread: true });
      return ctx ? ctx.give('clue', spec) : self.create('clue', spec);
    });
  };

  // ---- The Harbourmaster ------------------------------------------------------------
  // Each examiner exposed leaves a leaf from the Customs House; two, in Rest,
  // open the Harbourmaster's own books. While that case is open he sends
  // nobody; if it fails, he has friends and another examiner has the desk;
  // the Harbourmaster himself convicted ends his examiners for good.
  CF.RIVAL_HELD = 1e6; // a week that never comes: no examiner is sent
  P.harbourOpened = function (caseId) {
    var f = this.s.flags;
    f.harbourCase = caseId;
    f.rivalGone = CF.RIVAL_HELD;
  };
  P.harbourFalls = function (rec, d) {
    var s = this.s, self = this;
    var sus = rec.suspects.filter(function (x) { return x.name === d.name; })[0];
    if (sus && sus.role === 'the Harbourmaster') {
      s.flags.harbourFallen = true;
      s.flags.rivalGone = CF.RIVAL_HELD;
      this.cardsOf('rival', true).forEach(function (c) { if (c.loc && c.loc.t === 'table') self.remove(c); });
      // With the Council's own word on a Council family in the dock (commissionVerdict: Standing −1,
      // favour −1), the fall comes to Standing +3 and the Council's favour −2 in all.
      var councilsMan = rec.commission && rec.commission.ofCouncil === sus.key && rec.commission.delivered === 'truth';
      this.meter('reputation', councilsMan ? 4 : 3);
      if (this.favourGain) this.favourGain('council', councilsMan ? -1 : -2);
      this.story('The Harbourmaster Falls', 'The Customs House is sealed. Nobody will send another examiner against you, because nobody is left who wants to.', 'major');
      return;
    }
    // His clerk goes down for it: the Harbourmaster keeps his chain, and in time another examiner.
    s.flags.rivalGone = s.week + CF.RIVAL_GONE_WEEKS;
  };
  P.harbourLost = function (rec) {
    var s = this.s;
    if (s.flags.harbourFallen) return;
    s.flags.rivalGone = s.week;
    if (this.cardsOf('rival', true).length) return;
    var last = s.flags.rivalName, names = (CF.RIVAL_NAMES || ['Anselm Vogt']).filter(function (n) { return n !== last; });
    var name = U.pick(this.rng, names.length ? names : CF.RIVAL_NAMES);
    s.flags.rivalSeen = true;
    s.flags.rivalName = name;
    this.create('rival', { label: 'The Rival: ' + name, data: { name: name, heat: 0, stalled: 0 } });
    this.story('He Has Friends', 'The Harbourmaster\'s books are back on their shelf, and another examiner has his desk.', 'danger');
  };

  // A band is broken: its sworn scatter, smaller men. Records lose the band
  // and half their crimes; their Abroad cards are plain Abroad again.
  P.scatterBand = function (gangName, members) {
    var self = this, names = (members || []).slice();
    this.cardsOf('atlarge', true).forEach(function (c) {
      if (c.data.band !== gangName) return;
      if (names.indexOf(c.data.name) < 0) names.push(c.data.name);
    });
    names.forEach(function (name) {
      var rec = self.criminalByName(name);
      if (rec && rec.organization === 'gang') {
        rec.organization = 'none';
        rec.crimes = Math.floor(rec.crimes / 2);
        rec.history.push({ week: self.s.week, how: 'scattered' });
      }
      self.cardsOf('atlarge', true).forEach(function (c) {
        if (c.data.name !== name || !c.data.band) return;
        delete c.data.band;
        if (rec) self.refreshAtLarge(rec); else c.label = 'Abroad: ' + name;
      });
    });
  };

  // ---- Utility for recipes --------------------------------------------------
  P.hasTool = function (ctx, need) {
    if (!need) return true;
    if (this.s.rooms.lab) return true;
    if (this.teamHas(ctx, 'sharp')) return true;
    return ctx.cards.some(function (c) { var m = CF.CARDS[c.def].mods; return m && m.gate === need; });
  };
  P.helpers = function (ctx) {
    return ctx.cards.filter(function (c) { var a = CF.aspectsOf(c); return a.tool || a.teammate; });
  };
})(typeof window !== 'undefined' ? window : globalThis);
