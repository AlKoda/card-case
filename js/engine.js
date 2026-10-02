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
      cards: {}, verbs: {}, cases: {}, rooms: {}, flags: {}, journal: [], criminals: {}, network: { fronts: {} },
      meters: { pressure: 0, scrutiny: 0, retaliation: 0, reputation: 0, dread: 0 },
      counts: { cruelty: 0, mercy: 0, purse: 0, debt: 0 },
      rank: 0, calling: opts.calling || 'master', origin: opts.calling || 'master', who: opts.who || null, detective: opts.name || 'Examiner',
      over: null,
      stats: { convictions: 0, acquittals: 0, wrongful: 0, cold: 0, cases: 0, attacks: 0, sentHome: 0, reformed: 0 },
    };
    var e = new Engine(s);
    e.initPaths();
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
    if (opts.legacy) e.applyLegacy(opts.legacy, !!(opts.opening && e.setupOpening));

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
    // The week's ledger counts from the last bell: an older save starts counting now, not from the beginning.
    if (!s.weekSnap) s.weekSnap = { convictions: s.stats.convictions || 0, acquittals: s.stats.acquittals || 0, cold: s.stats.cold || 0 };
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
    // A question the city no longer asks, or a hook left from an older hour, is dropped.
    if (s.choice && !(CF.CHOICES || []).some(function (c) { return c.id === s.choice.id; })) s.choice = null;
    if (s.choiceHook && !(s.t - s.choiceHook.t <= 6)) s.choiceHook = null;
    var e = new Engine(s);
    e.initPaths();
    e.layoutVerbs();
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
  P.story = function (title, text, kind) {
    var entry = { t: this.s.t, week: this.s.week, title: title, text: text, kind: kind || 'event' };
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
    this.s.cards[card.uid] = card;
    return card;
  };

  // Create a card directly on the table.
  P.create = function (defId, spec, prefer) {
    var card = this.make(defId, spec);
    if (defId === 'informant') this.s.flags.hadInformer = true;   // a first that stays ticked when the informer is gone
    if (defId === 'witness' && card.life && this.perkHas('longmemory')) { card.life = Math.round(card.life * 1.5); card.maxLife = card.life; }
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
    card.data = spec.data || {};
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
  P.slotReachable = function (vid, sl) {
    if (sl.primary || !sl.when) return true;
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
    if (loc.t === 'out' && v) v.out = v.out.filter(function (u) { return u !== card.uid; });
    card.loc = null;
  };

  P.remove = function (card) {
    if (typeof card === 'number') card = this.card(card);
    if (!card || !this.s.cards[card.uid]) return;
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

  P.slotAccepts = function (slot, card) {
    var a = CF.aspectsOf(card);
    for (var i = 0; i < slot.accepts.length; i++) if (a[slot.accepts[i]] > 0) return true;
    return false;
  };

  P.lockReason = function (verbId) {
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
  // The magnet: fill the verb's empty slots from the table with cards that
  // fit them. The subject (the primary slot) is always the player's choice.
  // Its own case's tokens come first, the ones that point at the Accused
  // before the rest; then the oldest card. Returns what it pulled, in the
  // order it pulled it.
  P.magnetCandidates = function (verbId) {
    verbId = CF.VERB_ALIAS && CF.VERB_ALIAS[verbId] || verbId;
    var self = this, v = this.verb(verbId), def = CF.VERBS[verbId];
    if (!v.unlocked || def.auto || v.status !== 'idle' || !v.slots[this.primaryKey(verbId)]) return [];
    var taken = {}, out = [];
    var primary = this.card(v.slots[this.primaryKey(verbId)]);
    var accused = primary && primary.def === 'suspect' ? this.suspectOf(primary) : null;
    var order = function (x) {
      var same = primary && primary.caseId && x.caseId === primary.caseId ? 0 : 2;
      var aims = accused && x.data && ((x.data.points && x.data.points === accused.key) || (x.data.trait && x.data.trait === accused.trait)) ? 0 : 1;
      return same + aims;
    };
    var cards = this.tableCards().filter(function (x) { return self.sameCaseAs(primary, x); })
      .sort(function (a, b) { return order(a) - order(b) || a.uid - b.uid; });
    this.visibleSlots(verbId).forEach(function (sl) {
      if (sl.primary || v.slots[sl.key]) return;
      // Your own faculties and your Coin are choices, not requirements: the magnet leaves them.
      var c = cards.filter(function (x) { var k = self.kindOf(x); return k !== 'ability' && k !== 'funds' && !taken[x.uid] && self.slotAccepts(sl, x) && !self.unavailableReason(x); })[0];
      if (c) { taken[c.uid] = true; out.push({ uid: c.uid, slot: sl.key }); }
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
    var perk = ctx.verb === 'investigate' && this.perkHas('nose') ? 0.8 : 1;
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
    v.askSkipped = false;
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
    var vid = v.id;
    for (var i = 0; i < CF.ASKS.length; i++) if (CF.ASKS[i].when(v.recipe, vid)) return CF.ASKS[i];
    return null;
  };
  P.tickAsk = function (vid) {
    var v = this.verb(vid), spec = this.askSpec(v);
    if (!spec || v.ask || v.askSkipped || v.status !== 'running' || v.elapsed < spec.at * v.duration) return;
    // Nothing on the table could answer it: no ask, no penalty. A locked door
    // is only a question when you have someone to put a shoulder to it.
    var self = this, probe = { key: 'ask', label: spec.label, accepts: spec.accepts };
    if (!this.tableCards().some(function (c) { return self.slotAccepts(probe, c); })) { v.askSkipped = true; return; }
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

  P.complete = function (verbId) {
    var v = this.verb(verbId);
    var rec = CF.RECIPES_BY_ID[v.recipe];
    var ctx = this.makeCtx(verbId, v.ctxSlots);
    var result;
    try {
      // The main card can vanish mid-recipe (burned informant, expired case...).
      if (!rec || !ctx.primary || !rec.match(ctx)) result = { title: 'Interrupted', text: 'Whatever you were working on is gone before you finish. The city does not wait.' };
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
    var v = this.verb(verbId);
    var card = this.card(uid);
    if (!card || !card.loc || card.loc.t !== 'out' || card.loc.verb !== verbId) return false;
    delete card.hidden;
    this.detach(card);
    this.placeOnTable(card, pos || this.outputSpot(verbId, card));
    if (!v.out.length && v.status === 'done') { v.status = 'idle'; v.story = null; }
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
  P.tidy = function () {
    var self = this, cards = this.tableCards().sort(function (a, b) { return a.uid - b.uid; });
    var done = {};
    cards.forEach(function (c) { c.loc = null; });
    cards.forEach(function (c) {
      if (done[c.uid]) return;
      var key = self.stackKey(c);
      var mates = key ? cards.filter(function (o) { return !done[o.uid] && self.stackKey(o) === key; }) : [c];
      var spot = self.layoutSpot(ZONE_ROWS[self.kindOf(c)] || 0, T.CW, T.CH, self.obstacles());
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
      if (c.loc && (c.loc.t === 'held' || c.loc.t === 'out')) continue; // at work in a verb, or waiting to be collected: the clock waits
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
      this.remove(card);
      this.gameOver('burnout');
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
    if (card.def === 'bribe') {
      // With a Band or the Coquille in the city, the purse had owners who keep a tally.
      var organized = this.countOf('gang') > 0 || (this.countOf('syndicate') > 0 && !this.s.flags.syndicateFallen);
      if (organized) this.meter('retaliation', 1);
      this.story('The Purse Is Gone', 'Somebody came back for it. They will remember you left it alone.' + (organized ? ' The people who left it remember.' : ''), 'minor');
    }
    // The King's purse left to lie: he counts the times (see coquilleWeek).
    if (card.def === 'tribute' && this.court) { var court = this.court(); court.ignoredTribute = (court.ignoredTribute || 0) + 1; }
    if (card.def === 'clue' || card.def === 'evidence') this.story('The Trail Fades', label + ' has faded beyond use.', 'minor');
    this.remove(card);
  };

  // What the Bell draws each week: lodging, and a Coin for every two
  // watchmen in your service.
  // Perks: lasting edges found in play (see js/systems/growth.js).
  P.perkHas = function (id) { return !!(this.s.perks && this.s.perks[id]); };

  P.dues = function () {
    return CF.ECONOMY.rent + Math.floor(this.cardsOf('teammate', true).length / 2);
  };

  P.weekTick = function () {
    var s = this, self = this;
    s = this.s;
    s.week++;
    if (s.intro && !s.intro.finished) this.introFinish('The week turns.');
    var lines = [];

    // Dues first, out of what is on the table; then the salary.
    var salary = (CF.RANK_DEFS[s.rank] || {}).salary || CF.ECONOMY.salary[s.rank] || 1;
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
      lines.push('Lodging and dues take ' + dues + '. The Council\'s stipend: ' + salary + ' Coin.');
    }
    for (var si = 0; si < salary; si++) this.create('funds');
    if (!paid) {
      this.create('fatigue');
      this.create('fatigue');
      lines.push('You cannot pay your lodging. The landlord puts your chest in the lane at prime. You sleep in the Watch-house, on the bench.');
    }

    // The criminal ecosystem grows. The sworn of a band count with their band.
    var atLarge = this.cardsOf('atlarge').filter(function (c) { return !c.data.band; }).length;
    var gangs = this.countOf('gang');
    var synd = this.countOf('syndicate');
    var ret = Math.min(2, (atLarge ? 1 : 0) + (atLarge >= 3 ? 1 : 0) + gangs * 2 + synd * 3);
    if (ret) {
      this.meter('retaliation', ret);
      var talk = [U.fill('{n} who walked from you are still inside the walls.', { n: atLarge }), 'A name you let go was heard in the Red Ox this week.', 'Somebody who walked from a case of yours bought a round in the Stews and drank to your health, the wrong way.'];
      var bandCards = this.cardsOf('gang', true);
      lines.push(gangs && bandCards.length ? bandCards[0].data.name + ' keep a cellar now, and a tally.' : talk[s.week % 3]);
    }
    // A week in which no case went cold lets the Vendetta cool, unless the bands are feeding it.
    var coldBefore = (s.weekSnap || {}).cold || 0;
    if ((s.stats.cold || 0) === coldBefore && ret <= 1 && s.meters.retaliation > 0) this.meter('retaliation', -1);
    // The Crowd counts the thieves abroad: not while a hue and cry is up, and under a Bailiff every week, below that every other.
    if (atLarge + gangs * 2 + synd * 3 >= 4 && !this.manhuntOpen() && (s.rank >= 2 || s.week % 2 === 0)) { this.meter('pressure', 1); lines.push('The broadsheet-sellers count the thieves abroad, and sing the number in the Market.'); }
    this.organise();
    lines = lines.concat(this.criminalsAct());
    if (this.banishedReturn) lines = lines.concat(this.banishedReturn());
    if (this.purseWeek) lines = lines.concat(this.purseWeek());
    if (this.coquilleWeek) lines = lines.concat(this.coquilleWeek());
    if (this.patronsWeek) lines = lines.concat(this.patronsWeek());
    if (this.mountainWeek) lines = lines.concat(this.mountainWeek());
    if (this.rivalWeek) lines = lines.concat(this.rivalWeek());
    if (s.rooms.survroom) lines = lines.concat(this.belfryWeek());
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
      self.create('clue', self.clueSpec(rec, { label: 'The ' + n.charAt(0).toUpperCase() + n.slice(1) + ' Door', text: 'Another girl of ' + rec.scene + ', another doorway, the hair cut close. The same lane runs down to the same river. ' + (rec.victims >= 3 ? 'The city has stopped sleeping.' : 'The quarter has begun to count.'), aspects: { opportunity: 1, forensic: 1 }, pattern: true }, []));
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
    } else if (r >= 3 && this.rng() < r * 0.07) this.attack();

    // Temptation.
    if (!this.countOf('bribe') && this.rng() < 0.15 + 0.1 * (gangs + synd * 2)) {
      this.create('bribe');
      lines.push('There is a purse on your desk. Nobody saw who left it.');
    }

    // Transfers.
    if (s.meters.reputation >= 2 && this.countOf('personnel') < 2 && this.rng() < 0.25) {
      var pk = U.pick(this.rng, ['rookie', 'tech', 'interviewer', 'analyst', 'veteran']);
      this.create('personnel', this.personnelSpec(pk));
      lines.push('A letter of service lands on your desk: ' + CF.PERSONNEL[pk].label + '.');
    }

    // A calm city under a senior officer is Power; it counts every other calm week.
    if (s.rank >= 1 && s.meters.pressure <= 3 && s.meters.scrutiny <= 3) {
      s.calmWeeks = (s.calmWeeks || 0) + 1;
      if (s.calmWeeks % 2 === 0) this.pathGain('commissioner', 1, 'a calm fortnight');
    }
    // Fear fades, slowly, and while it lasts the Stews keep their heads down.
    // The count endings are judged before fear fades, so the thresholds mean what they say.
    if (this.checkCountEndings) { this.checkCountEndings(); if (s.over) return; }
    if (s.meters.dread > 0) this.meter('dread', -1);
    if (s.meters.dread > 0 && this.rng() < 0.5) this.meter('dread', -1);
    if (s.meters.dread >= 6) { this.meter('pressure', -1); lines.push('The Stews are quiet. Nobody wants to be the next one you put to the question.'); }
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
    lines.push('The ledger: ' + (ledger.length ? ledger.join(', ') : 'no case closed') + '; ' + this.openCases().length + ' open; ' + this.countOf('funds') + ' Coin in hand.');
    s.weekSnap = { convictions: s.stats.convictions || 0, acquittals: s.stats.acquittals || 0, cold: s.stats.cold || 0 };
    if (this.growthTick) this.growthTick();
    this.story('Week ' + s.week, lines.join(' '), 'week');
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
      if (c.loc.t !== 'table' || c.data.band) return false;
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
    // The Crusader's enemy doesn't wait to be built from your failures.
    if (s.calling === 'crusader' && (s.week >= 6 || this.countOf('ledger') >= 3) && !this.countOf('syndicate') && !s.flags.syndicateFallen) {
      this.spawnSyndicate('You have seen the same advocate at every hearing, the same faces at every cellar door. Behind the city\'s crime there is a court, a barrel for a throne, and a king. They call it the Coquille. Go in Disguise to get at its books.');
    }
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
        this.story('A Watchman Dead', this.labelOf(c) + ' was stabbed on their way home. The burial is on Thursday. The whole Watch-house goes. You carry the coffin.', 'danger');
      } else {
        this.remove(c);
        this.create('injured', { label: 'Hurt: ' + this.labelOf(c), data: { teammate: { label: c.label, desc: c.desc, aspects: c.aspects, data: c.data } } });
        this.story('A Watchman Hurt', this.labelOf(c) + ' was set upon outside the Watch-house. They will be in the Abbey hospital for a while.', 'danger');
      }
    } else {
      this.hurtYou('Someone was waiting on the stair of your lodging. You remember the first blow of the cudgel and not much after.');
    }
  };

  // A blow takes your Health, Winded or not, and leaves a Wound. With no
  // Health to lose: a Wound already carried is death; otherwise a beating.
  P.hurtYou = function (text) {
    var hp = this.cardsOf('health', true);
    if (!hp.length) hp = this.cardsOf('spent_health', true);
    if (hp.length) {
      this.remove(hp[0]);
      var w = this.create('wound');
      if (this.woundFactor && this.woundFactor() !== 1) { w.life *= this.woundFactor(); w.maxLife = w.life; }
      this.story('Wounded', text, 'danger');
    } else if (this.cardsOf('wound', true).length) {
      this.story('In the Council\'s Service', text, 'danger');
      this.gameOver('death');
    } else {
      this.create('fatigue');
      this.create('fatigue');
      this.story('Beaten on the Stair', text + ' There was no strength in you to lose. You lie on the stair until the watchman finds you.', 'danger');
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
  P.checkThresholds = function () {
    var s = this.s;
    if (s.over) return;
    var self = this;
    var free = function (def) {
      return self.cardsOf(def).filter(function (c) { return c.loc.t === 'table' || c.loc.t === 'out'; });
    };

    var fat = free('fatigue');
    if (fat.length >= 3) {
      if (this.countOf('burnout')) { this.gameOver('collapse'); return; }
      fat.slice(0, 3).forEach(function (c) { self.remove(c); });
      this.create('burnout');
      this.story('Fever', 'You stand in the Market outside the Watch-house for an hour and cannot make yourself go in. Your hands will not stop shaking. You need rest, and soon.', 'danger');
    }

    var obs = free('obsession');
    if (obs.length >= 3) {
      if (this.countOf('tunnel')) { this.gameOver('consumed'); return; }
      obs.slice(0, 3).forEach(function (c) { self.remove(c); });
      this.create('tunnel');
      this.story('Fixation', 'The walls of your study are covered in string and paper. You are certain you are right. You are certain of everything now. That should frighten you more than it does.', 'danger');
    }

    if (s.meters.pressure >= this.meterMax('pressure')) { this.gameOver('dismissed'); return; }
    if (s.meters.dread >= this.meterMax('dread')) { this.gameOver('riot'); return; }
    if (s.meters.scrutiny >= this.meterMax('scrutiny')) { this.gameOver('corruption'); return; }

    // Promotion boards. A displeased Council does not write, unless the Bishop speaks for you.
    if (s.rank < (this.rankCap ? this.rankCap() : CF.TOP_RANK) && s.meters.reputation >= CF.RANK_REP[s.rank + 1] && !this.cardsWith('promotion').length) {
      var next = CF.RANK_DEFS[s.rank + 1];
      if (this.promotionHeld()) {
        if (!s.flags['promoHeld' + (s.rank + 1)]) {
          s.flags['promoHeld' + (s.rank + 1)] = true;
          this.story('The Council Does Not Write', 'You have the Standing for the office of ' + next.label + ', and the letter does not come. Your patron on the Council is not your patron any more. Answer a commission of the Council\'s, or let the Bishop speak for you, and it will.', 'danger');
        }
      } else {
        this.create('promotion', { label: 'The Council\'s Letter: ' + next.label, desc: next.text + ' Attend on the Council.', data: { rank: s.rank + 1 } });
        this.story('The Council Takes Notice', 'A letter on heavy paper under the city\'s seal: the Council will see you about the office of ' + next.label + '. Attend on them, in a clean collar.', 'major');
      }
    }
    if (s.calling === 'commissioner' && s.rank === CF.TOP_RANK && s.meters.reputation >= CF.COMMISSIONER_REP && !this.countOf('chair') && !s.flags.chairCooldown) {
      this.create('chair');
      this.story('The Seat Is Empty', 'The Burgomaster is dead of a stone. The Council will choose a successor, and your name is on the list.', 'major');
    }
  };

  // ---- Endings -------------------------------------------------------------
  CF.ENDINGS = {
    dismissed: { win: false, title: 'Dismissed', text: 'The city lost patience. Too many names the crier sang, too many of them walking free. The Burgomaster takes your letter of office back in front of the whole Watch-house and does not meet your eyes.' },
    burnout: { win: false, title: 'The Fever', text: 'One morning you simply do not come in. Or the next. The letter to the Council is two lines long. Someone else sits under the stair now, and the cases keep coming.' },
    collapse: { win: false, title: 'Collapse', text: 'You fall on the Watch-house stair and do not get up. The barber-surgeon uses words like "a surfeit" and "the heart" and "rest, in the country". The city does not send flowers.' },
    consumed: { win: false, title: 'Lost in the Case', text: 'You stop going to your lodging. You stop shaving. You stop answering to your name. When they finally break the door of your study, every wall is covered, and none of it makes sense to anyone but you.' },
    corruption: { win: false, title: 'The Council\'s Sergeants', text: 'The Council\'s sergeants come for you at first light, with a writ and a sack for your things. The beaten confessions, the purses, the proof that appeared from nowhere. They kept a list too.' },
    merciful: { win: true, title: 'The Merciful Judge', text: 'Twelve times you sent a poor sinner home instead of to the Ravenstone, and four of them are citizens now with stalls in the Market and children who do not know what their fathers were. The Council never understood it. The city did. When you go, they carry the bier themselves.' },
    hangmans: { win: false, title: 'The Hangman\'s Examiner', text: 'The Council keeps you, because the city is quiet. The city fears you, because it knows why. You live outside the walls now, in the executioner\'s house by the Ravenstone, and dine with him, because nobody else will. The work goes on. It is very quiet.' },
    stake: { win: false, title: 'The Stake', text: 'The Inquisitor\'s charge lands on you: heresy, from a patron you crossed, sworn to by two men you sent to the Hole. The proof against you is the proof you taught the city to want. The Bishop does not answer your letter. The Fire on Friday.' },
    dagger: { win: false, title: 'The Dagger on the Pillow', text: 'They warned you once. A dagger on the pillow, and the door still barred. You did not pay, and you did not leave, and one morning the servant who brings the water is not the servant. The Order of the Mountain keeps its word, in daylight, before witnesses, and nobody in the city will say they saw it.' },
    kingofthunes: { win: true, title: 'The King of Thunes', text: 'The old King goes into the river and the Court kneels to a new one who keeps the Examiner\'s desk by day. Crimes fall in number and rise in scale. You decide who is caught, and the Council thanks you for the quiet. Under the Warrens, where the lame walk and the blind see, they sing a new name.' },
    treatycity: { win: true, title: 'The Treaty City', text: 'Twelve quiet weeks. The Stews keep their own peace, the Court tries its own, the Rolls fill with answered cases, and the Council votes you a pension for the calm it does not ask about. You retire rich to a house on the Hill. The city calls it peace, and for the years you have left, it is.' },
    thieftaker: { win: true, title: 'The Thief-taker General', text: 'The city has never had an officer so effective, or so rich. Every fence in the Free City pays you, every victim thanks you, and the Council votes you a chain of office without asking where the goods you recover come from. You know. You are the only one who does. It will hold for years, if nobody ever reads the ledger.' },
    oldbailey: { win: false, title: 'The Old Bailey', text: 'Somebody you hanged had a brother, and the brother had a ledger. The Council makes a new law with your trade in it, word for word, and tries you under it in the same court where you sent so many. Two witnesses. Your own men. The ballad is already printed.' },
    riot: { win: false, title: 'The Crowd Turns', text: 'The next execution is meant to be a lesson. The crowd has learned a different one. When the cart reaches the Ravenstone they take the poor sinner off it, and then they come for you. You get out of the city by the Harbour gate with what you are wearing. The Council does not send after you.' },
    death: { win: false, title: 'Killed in the Council\'s Service', text: 'They give you a bell, a Mass and a line in the Rolls. The people who did it are drinking to your memory in a cellar by the Harbour.' },
    commissioner: { win: true, title: 'The Burgomaster', text: 'The Council votes, and it is not close. You take the Seat, the chamber with the window and the city\'s Watch, and you begin, slowly, to remake it in your own image. Somewhere a new examiner sits under the stair. You make sure they have what you did not.' },
    master: { win: true, title: 'The Scholar', text: 'The Architect is sentenced on a grey Tuesday. Every crime you ever worked had their hand on it, if you knew where to look. You did. The scriveners are copying your casebook for the law faculties. You find the same three strokes cut into your own lintel, and you rub them out with your thumb.' },
    crusader: { win: true, title: 'The Reformer', text: 'The Court of Miracles is a wet cellar with nobody in it. The King of Thunes hangs on the Ravenstone. It cost you more than you will ever say, and the city will grow new thieves like weeds through cobbles. But for one bright season, nobody is above the law.' },
  };

  P.gameOver = function (id) {
    var s = this.s;
    if (s.over) return;
    var end = CF.ENDINGS[id];
    if (this.reformedCount) s.stats.reformed = this.reformedCount();
    var text = CF.Story ? CF.Story.ending(this, id) : end.text;
    s.over = { id: id, win: end.win, title: end.title, text: text, week: s.week, origin: s.origin, calling: s.calling };
    this.story(end.title, text, end.win ? 'victory' : 'defeat');
    s.legacy = this.buildLegacy();
    this.emit('over', s.over);
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

  P.applyLegacy = function (L, quiet) {
    var self = this;
    (L.cold || []).slice(0, 4).forEach(function (c) { self.create('coldcase', c); });
    (L.criminals || []).forEach(function (c) { var copy = U.clone(c); copy.heat = 0; delete copy.hidden; delete copy.surfaceWeek; self.s.criminals[copy.id] = copy; });
    (L.atlarge || []).slice(0, 2).forEach(function (c) { self.create('atlarge', c); });
    (L.gangs || []).slice(0, 1).forEach(function (c) { self.create('gang', c); });
    if (L.syndicate) this.create('syndicate');
    this.create('notes', { desc: 'The casebook of ' + L.predecessor + ' (' + L.ending + '). Half of it is water-stained. Read it in Rest.' });
    this.meter('retaliation', Math.min(4, (L.atlarge || []).length + (L.gangs || []).length * 2));
    // In the opening the desk is not yours yet: openingHired (life.js) tells the inheritance.
    if (quiet) { this.s.flags.legacy = { predecessor: L.predecessor, ending: L.ending, syndicate: !!L.syndicate }; return; }
    this.story('Inherited', 'Your predecessor, ' + L.predecessor + ', left you their desk, their unanswered cases and their enemies. The enemies have already sent a welcome: a cask of very good Rhenish, with the King\'s compliments.', 'major');
  };

  // ---- Specs for generated cards ------------------------------------------
  // A name: a man's, a woman's, or either when the role does not say.
  P.newName = function (sex) {
    var N = CF.NAMES, first = sex === 'm' ? N.m : sex === 'f' ? N.f : N.first;
    return U.pick(this.rng, first || N.first) + ' ' + U.pick(this.rng, N.last);
  };
  // What a witness's description says of their sex, for the name they are given.
  P.sexOf = function (who) {
    if (!who) return null;
    if (/woman|wife|maid|widow|laundress|sister|fishwife|girl/i.test(who)) return 'f';
    if (/\bman\b|boy|husband|porter|sergeant|baker|shepherd|bargeman|ferryman|tapster|drunk|doorkeeper|infirmarian|assayer|watchman/i.test(who)) return 'm';
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
    var name = this.newName();
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
    var nick = U.pick(this.rng, ['Whistle', 'Two-Coats', 'Sparrow', 'Lucky', 'The Deacon', 'Moth', 'Rattle', 'Penny']);
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
  P.addOrdersForRank = function (rank) {
    var self = this;
    var bought = this.s.flags.bought = this.s.flags.bought || {};
    Object.keys(CF.ORDERS).forEach(function (k) {
      var o = CF.ORDERS[k];
      if (o.rank !== rank || bought[k]) return;
      var what = o.room ? CF.ROOMS[o.room].desc : CF.CARDS[o.give].desc;
      var disc = self.s.who === 'clerk' ? 1 : 0;
      self.create('order', { label: 'Petition: ' + o.label, desc: what + ' Costs ' + Math.max(1, o.cost - disc) + ' Coin.', data: { order: k, discount: disc } });
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
    var unlocked = [];
    CF.VERB_ORDER.forEach(function (id) {
      if (!s.verbs[id].unlocked && CF.VERBS[id].rank <= s.rank) { s.verbs[id].unlocked = true; unlocked.push(CF.VERBS[id].label); }
    });
    this.layoutVerbs();
    this.addOrdersForRank(s.rank);
    this.pathGain('commissioner', 1, 'promoted');
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
  P.tickIntelOffice = function () {
    var self = this, fronts = this.fronts();
    for (var k in this.s.cards) {
      var c = this.s.cards[k];
      if (c.def !== 'clue' || !c.data.link || !c.loc) continue;
      var f = fronts[c.data.link];
      if (f && !f.known) {
        self.revealFront(f);
        self.story('The Informers\' Bench', 'Someone on the bench knows ' + self.labelOf(c) + ' at once: ' + f.name + '. ' + f.gang.replace(/^the /, 'The ') + ' works through it.', 'major');
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

  // Generate a case record and put its card on the table (or into ctx output).
  // The crimes an office is sent: the tiers up to your rank, the first tier
  // always; a new tier joins a week after the promotion that opened it.
  P.casePool = function () {
    var s = this.s, pool = [];
    CF.CASE_TIERS.forEach(function (tier, i) { if (i <= s.rank) pool = pool.concat(tier); });
    return pool;
  };
  // How long a case keeps, as a share of its template's clock: a young office is given more time.
  P.caseClock = function () { return this.s.rank === 0 ? 1.8 : this.s.rank === 1 ? 1.6 : 1.5; };
  P.spawnCase = function (templateId, opts) {
    opts = opts || {};
    var s = this.s;
    var rng = this.rng;
    // The crimes come by rank: an Examiner gets the plain ones; the killings
    // and the strange cases wait until you have risen to them.
    var tid = templateId || U.pick(rng, this.casePool());
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
    var scene = from && from.scene ? from.scene : U.fill(U.pick(rng, T.scenes), vars);
    vars.scene = scene;
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
    var self = this;
    var suspects = roles.map(function (r, i) {
      var name = i === guiltyIdx && opts.culpritName ? opts.culpritName : self.newName(r.sex || null);
      return { key: 's' + i, name: name, role: r.role, motive: r.motive, trait: traits[i].id, guilty: i === guiltyIdx, revealed: false };
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
      if (s.rank === 0) for (var ca in charge) charge[ca] = Math.min(charge[ca], 2);
      if (s.rank >= 2) charge[T.keyAspects[0]] = Math.min(4, charge[T.keyAspects[0]] + 1);
      if (s.rank >= 3) charge[T.keyAspects[1]] = Math.min(4, charge[T.keyAspects[1]] + 1);
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
    var front = opts.frontId && s.network.fronts[opts.frontId] ? s.network.fronts[opts.frontId] : !T.special ? this.frontForCase(opts) : null;
    var trait = traits[guiltyIdx];
    var traitItem = { type: 'clue', label: trait.clue.label, text: trait.clue.text, aspects: trait.clue.aspects, trait: trait.id, own: true };
    var tItems = T.items.map(function (it) { return fillItem(it, vars); });
    var generic = fillItem(U.pick(rng, CF.GENERIC_SCENE), vars);
    var items;
    if (structure) {
      var covers = tItems.filter(function (it) { return itemCovers(it, T.keyAspects[0]); });
      var key1 = covers.length ? U.pick(rng, covers) : tItems.length ? U.pick(rng, tItems) : null;
      items = [traitItem].concat(structure.items.map(function (it) { var f = fillItem(it, vars); f.own = true; return f; }));
      var rest = front ? [this.linkItem(front)] : [];
      if (key1) rest.push(key1);
      rest.push(generic);
      while (items.length < 4 && rest.length) items.push(rest.shift());
    } else {
      var picked = U.sample(rng, tItems, Math.min(2, tItems.length));
      if (front) picked = [this.linkItem(front)].concat(picked.slice(0, 1));
      items = [traitItem].concat(picked, [generic]);
    }
    items = U.shuffle(rng, items);
    if (items.length > 4) items.length = 4; // a scene gives four things at most: what matters, not everything
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

    var rec = {
      id: id, template: tid, title: from && from.title ? from.title : U.fill(opts.title || T.title, vars), short: T.label, district: district, scene: scene,
      victim: victim, vars: vars, suspects: suspects, culprit: culprit.key, keyAspects: T.keyAspects.slice(),
      difficulty: difficulty, highProfile: highProfile, charge: charge, items: items, found: 0,
      witnesses: U.shuffle(rng, T.witnesses), work: 0, searches: 0, identified: null, status: 'open', leads: {},
      special: !!T.special, atLargeUid: opts.atLargeUid || null, gangUid: opts.gangUid || null,
      reopened: !!opts.reopened, criminalId: opts.criminalId || null,
      structure: structure ? structure.id : null, front: front ? front.id : null,
    };
    rec.week = s.week;
    if (this.commissionFor) rec.commission = this.commissionFor(rec, T);
    if (T.council && this.commissionFor) rec.commission = { from: 'council', wants: 'quiet', ofCouncil: null, deadline: s.t + (T.lifetime || 250) * 0.66, days: CF.daysLeft((T.lifetime || 250) * 0.66) };
    s.cases[id] = rec;
    s.stats.cases++;
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
    if (!opts.quiet) {
      this.story(opts.headline || (rec.commission ? 'A Commission from ' + CF.PATRONS[rec.commission.from].label + ': ' : 'New Case: ') + rec.title, (lead ? lead + ' ' : '') + brief + (rec.commission && CF.Patrons ? ' ' + CF.Patrons.describe(rec) : ''), 'case');
    }
    return card;
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
    if (item.names) data.names = true;
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
      if (f && f.society && c.loc) {
        if (!c.data.kept) { c.data.kept = true; c.label = 'Kept: ' + this.labelOf(c); c.life = 400; c.maxLife = 400; this.dirty = true; }
        continue;
      }
      this.remove(c);
    }
  };

  // A record of how a case ended, for the Case Archive.
  P.caseRecord = function (rec, outcome, charged) {
    var cul = rec.suspects.filter(function (x) { return x.guilty; })[0];
    var trait = cul && CF.TRAITS.filter(function (t) { return t.id === cul.trait; })[0];
    return {
      id: rec.id + '-' + this.s.seed, title: rec.title, template: rec.template, district: rec.district, scene: rec.scene,
      victim: rec.victim, outcome: outcome, charged: charged || null, week: this.s.week, highProfile: !!rec.highProfile,
      culprit: cul ? { name: cul.name, role: cul.role, motive: cul.motive, trait: trait ? trait.desc : '' } : null,
      detective: this.s.detective, calling: this.s.calling,
    };
  };

  P.goCold = function (caseId) {
    var rec = this.caseRec(caseId);
    var card = this.caseCard(caseId);
    if (card) this.remove(card);
    if (!rec || rec.status !== 'open') return;
    rec.status = 'cold';
    if (this.commissionCold) this.commissionCold(rec);
    this.releaseDelegate(rec);
    this.s.stats.cold++;
    this.emit('resolved', this.caseRecord(rec, 'cold'));
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
      this.story('The Architect Vanishes', 'By the time you get a writ the house on the Hill is empty, except for three strokes cut into the mantel. You will have to find the thread again.', 'danger');
      return;
    }
    if (rec.template === 'manhunt') {
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

  // ---- Charges and trials ---------------------------------------------------
  // Assess a charge. `apparent` is what you believe; `real` excludes misread clues.
  // assessCharge lives in js/systems/charge.js.

  P.verdict = function (trialCard) {
    var d = trialCard.data;
    this.remove(trialCard);
    var rec = this.caseRec(d.caseId);
    if (!rec) return;
    var s = this.s;
    var rng = this.rng;
    var notes = [];
    var p;
    var tier = d.tier || (d.solid ? 'strong' : 'weak');
    if (d.guilty) {
      p = d.solid ? 0.92 : tier === 'reasonable' ? U.clamp(0.35 + 0.4 * d.real / d.need, 0.35, 0.8) : U.clamp(0.15 + 0.5 * d.real / d.need, 0.15, 0.55);
    } else {
      p = U.clamp(0.08 + 0.25 * Math.min(1, d.real / d.need), 0, 0.35);
      if (d.coerced) p += 0.25;
      if (d.planted) p += 0.25;
    }
    // A confession is the king of proofs. Given freely it convicts; given
    // under the question it must be repeated freely a day later, and the
    // Court checks it against the body of the thing. A false confession
    // that nothing contradicts convicts all the same [Carolina].
    if (d.confession === 'free') p = Math.max(p, 0.9);
    else if (d.confession === 'question') {
      if (d.guilty) p = d.checked ? Math.max(p, 0.9) : Math.max(p, 0.6);
      else p = d.checked ? 0.12 : 0.8;
      if (!d.checked && rng() < 0.4) notes.push(d.guilty ? d.name + ' repeats the confession before the judge, freely, as the Carolina asks.' : d.name + ' recants before the judge, then, shown the Hole again, confesses a second time.');
      else if (d.checked && !d.guilty) notes.push('The confession says one thing and the body of the thing says another. The judge sees it.');
    }
    for (var i = 0; i < d.coerced; i++) {
      if (rng() < 0.3) {
        p -= 0.25;
        this.meter('scrutiny', 1);
        notes.push('The defence has the coerced statement thrown out. The judge asks, pointedly, how it was obtained.');
      }
    }
    for (var q = 0; q < (d.illegal || 0); q++) {
      if (rng() < 0.3) {
        p -= 0.25;
        this.meter('scrutiny', 1);
        notes.push('The accused\'s advocate asks to see the writ for the search. There is no writ. The proof is struck out.');
      }
    }
    if (d.planted && rng() < 0.3) {
      p = 0.03;
      this.meter('scrutiny', 3);
      notes.push('The accused\'s advocate takes your arranged proof apart before the sworn men. The court goes very quiet.');
    }
    for (var j = 0; j < (d.contradictions || 0); j++) {
      if (rng() < 0.35) {
        p -= 0.2;
        notes.push('The advocate reads your own proof back to the sworn men: it describes somebody else entirely.');
      }
    }
    p = U.clamp(p, 0.02, 0.97);
    var convicted = rng() < p;
    rec.status = convicted ? 'closed' : 'acquitted';
    if (this.commissionVerdict) this.commissionVerdict(rec, d, convicted, notes);
    this.emit('resolved', this.caseRecord(rec, convicted ? (d.guilty ? 'convicted' : 'wrongful') : 'acquitted', d.name));
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
        if (caught && caught.crimes >= 2) this.pathGain('crusader', 1, 'put away a repeat offender');
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
      if (pay) notes.push(tier === 'strong' ? 'The Council\'s thanks, with a purse attached.' : 'The case closes, and a small fee comes with it.');
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
          this.create('looseend');
          this.pathGain('master', 1, 'a loose end');
          notes.push('But one detail belongs to no one in the case: a small mason\'s mark, three strokes, cut where the crime began. You have seen it before.');
        }
      }
      this.onConviction(rec, d, notes);
      if (!s.over) this.condemn(rec, d, tier);
      if (!d.guilty) {
        var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
        this.meter('scrutiny', 1);
        if (!rec.special) {
          var crimW = this.criminalEscapes(rec, culprit, 'wrongful');
          if (this.atLargeCardFor(crimW)) this.refreshAtLarge(crimW);
          else this.hideCriminal(crimW, rec);
        }
      }
      var lesser = tier !== 'strong' && !d.solid && !rec.special && d.confession !== 'free';
      var T = CF.CASE_TEMPLATES[rec.template];
      if (lesser) notes.unshift('On half proof the Court convicts of the lesser crime only: ' + (T && T.lesser ? T.lesser : 'the lesser charge') + '.');
      this.story('Guilty: ' + d.name, 'The sworn men are out for ' + (d.solid ? 'the length of a Paternoster' : 'two days') + '. ' + d.name + ' is convicted of ' + rec.title + ', and the sergeants take them down to the Hole to wait for the sentence. ' +
        (d.guilty ? '' : 'You tell yourself it was the right person. ') + notes.join(' '), 'victory');
    } else {
      s.stats.acquittals++;
      this.meter('pressure', 1);
      this.meter('retaliation', rec.special ? 2 : 1);
      this.meter('reputation', -1);
      if (tier === 'weak' && rng() < 0.5) {
        this.meter('scrutiny', 1);
        notes.push('The judge\'s remarks about a thin charge reach the Council chamber by sext.');
      }
      if (!rec.special || rec.template === 'manhunt') {
        if (rec.template === 'manhunt' && rec.atLargeUid && this.card(rec.atLargeUid)) {
          // They were already at large; they simply stay so.
        } else {
          var charged = rec.suspects.filter(function (x) { return x.name === d.name; })[0] || { name: d.name, trait: null };
          var crimA = d.guilty ? this.criminalEscapes(rec, charged, 'acquitted') : null;
          if (crimA && this.atLargeCardFor(crimA)) this.refreshAtLarge(crimA);
          else this.create('atlarge', {
            label: (crimA ? CF.Criminals.rankOf(crimA).label : 'Abroad') + ': ' + d.name,
            desc: d.name + ' walked out of the Blood Court smiling. ' + (d.guilty ? 'They are guilty, and now they are careful. ' + this.criminalDesc(crimA) : 'They were innocent, and now they hate you.'),
            data: { name: d.name, trait: charged.trait, careful: true, criminalId: crimA ? crimA.id : null },
          });
        }
      }
      if (rec.template === 'architect') s.flags.architect = false;
      this.story('Not Guilty: ' + d.name, (notes.length ? notes.join(' ') + ' ' : '') + 'The sworn men acquit. ' + d.name +
        ' walks down the court steps into the crowd\'s cheering and looks straight at you.', 'danger');
    }
  };

  P.onConviction = function (rec, d, notes) {
    var s = this.s;
    var self = this;
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
    if (rec.template === 'architect') {
      if (d.guilty && this.pathOpen('master')) { this.gameOver('master'); return; }
      s.flags.architect = false;
    }
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
