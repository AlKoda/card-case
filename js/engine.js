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
  var FADING = { clue: 1, evidence: 1, witness: 1, intel: 1, bribe: 1 };
  // Strain: two Fatigue is Exhaustion (street verbs slower), three is
  // Burnout. Tunnel Vision slows the careful verbs and warps deductions.
  CF.STRAIN = { exhaustedAt: 2, exhaustedSlow: 1.25, exhaustedVerbs: ['duty', 'patrol', 'investigate', 'interrogate', 'stakeout'],
    tunnelSlow: 1.25, tunnelVerbs: ['investigate', 'analyze', 'reflect'] };
  // Money: salary rises with rank, rent does not.
  CF.ECONOMY = { salary: [1, 2, 3], rent: 1, convictionPay: { reasonable: 1, strong: 2 }, highProfilePay: 1 };
  // The table is a free board measured in board pixels. Cards and verbs can
  // sit anywhere; placement keeps them from covering each other.
  var T = {
    CW: 116, CH: 158, GAP: 14,   // card footprint
    VW: 92, VH: 104,             // verb token footprint
    COLS: 8,                     // width of the automatic layout, in cards
    TOP: 136,                    // cards start below the row of verbs
  };
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
    if (card.data.order) return CF.ORDERS[card.data.order].cost;
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
  Engine.newGame = function (opts) {
    opts = opts || {};
    var seed = opts.seed !== undefined ? opts.seed : Math.floor(Math.random() * 1e9);
    var s = {
      version: 1, seed: seed, rng: seed, t: 0, week: 1, weekT: 0, dispatchT: 55, nextUid: 1,
      cards: {}, verbs: {}, cases: {}, rooms: {}, flags: {}, journal: [], criminals: {}, network: { fronts: {} },
      meters: { pressure: 0, scrutiny: 0, retaliation: 0, reputation: 0 },
      rank: 0, calling: opts.calling || 'master', origin: opts.calling || 'master', detective: opts.name || 'Detective',
      over: null,
      stats: { convictions: 0, acquittals: 0, wrongful: 0, cold: 0, cases: 0, attacks: 0 },
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
    e.create(CF.CALLINGS[s.calling].card);
    e.giveDistrict('market');
    e.addOrdersForRank(0);
    e.create('personnel', e.personnelSpec('rookie'));

    if (s.calling === 'commissioner') {
      e.create('funds');
      e.create('teammate', e.teammateSpec('rookie'));
    } else if (s.calling === 'master') {
      e.create('camera');
      e.removeOrder('camera');
    } else if (s.calling === 'crusader') {
      e.create('informant', e.informantSpec('market'));
    }

    if (opts.legacy) e.applyLegacy(opts.legacy);

    e.spawnCase('burglary', { lifetime: 300, quiet: !!opts.guided });
    if (opts.guided && e.setupIntro) { e.setupIntro(); return e; }
    if (CF.Story) { var op = CF.Story.opening(e); e.story(op.title, op.text, 'major'); return e; }
    e.story('Your First Day',
      'The desk is yours now, along with the cold coffee, the ringing phone and the file already waiting in the tray. ' +
      'The last detective to sit here left in a hurry. The city did not stop to notice. ' +
      'Drag cards onto the verbs on your table to act. Click a verb to open it and see what it wants.', 'major');
    e.dirty = true;
    return e;
  };

  Engine.load = function (json) {
    var s = typeof json === 'string' ? JSON.parse(json) : json;
    s.criminals = s.criminals || {}; // older saves had no criminal records
    s.network = s.network || { fronts: {} };
    s.origin = s.origin || s.calling;
    s.rooms = s.rooms || {};
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
    var e = new Engine(s);
    e.initPaths();
    e.layoutVerbs();
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
  P.usableIn = function (card) {
    var self = this, out = [];
    CF.VERB_ORDER.forEach(function (vid) {
      var v = self.verb(vid), def = CF.VERBS[vid];
      if (!v || !v.unlocked || def.auto || v.status === 'running' || self.lockReason(vid)) return;
      if (def.slots.some(function (sl) { return self.slotAccepts(sl, card); })) out.push(vid);
    });
    return out;
  };

  // Does any unlocked verb have a slot that takes this card at all (ignoring
  // whether it is busy or locked right now)?
  P.fitsAny = function (card) {
    var self = this;
    return CF.VERB_ORDER.some(function (vid) {
      var v = self.verb(vid), def = CF.VERBS[vid];
      return v && v.unlocked && !def.auto && def.slots.some(function (sl) { return self.slotAccepts(sl, card); });
    });
  };
  // Why a card cannot be used right now, or null if it can (or never could).
  P.unavailableReason = function (card) {
    if (this.usableIn(card).length || !this.fitsAny(card)) return null;
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
    var def = this.def(card);
    return def.stackable && !card.caseId ? card.def : null;
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

  function isFree(r, obs) {
    if (r.x < 0 || r.y < 0) return false;
    for (var i = 0; i < obs.length; i++) if (overlaps(r, obs[i])) return false;
    return true;
  }

  // The free spot closest to (x, y) for a w x h footprint.
  P.nearestFree = function (x, y, w, h, obs) {
    x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y));
    if (isFree({ x: x, y: y, w: w, h: h }, obs)) return { x: x, y: y };
    var step = 12;
    for (var r = 1; r <= 90; r++) {
      var best = null, bestD = Infinity;
      for (var i = -r; i <= r; i++) {
        var pts = [[i, -r], [i, r], [-r, i], [r, i]];
        for (var j = 0; j < 4; j++) {
          var px = x + pts[j][0] * step, py = y + pts[j][1] * step;
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

  // Put a card on the table: join its stack, else the spot asked for (or the
  // one it last had), else the first free place in its kind's layout row.
  P.placeOnTable = function (card, prefer) {
    card.loc = null;
    var join = this.stackFor(card);
    if (join) { card.loc = { t: 'table', x: join.loc.x, y: join.loc.y }; return; }
    if (!prefer && card.lastPos) prefer = card.lastPos;
    var obs = this.obstacles(function (c) { return c === card; });
    var p = prefer ? this.nearestFree(prefer.x, prefer.y, T.CW, T.CH, obs)
      : this.layoutSpot(ZONE_ROWS[this.kindOf(card)] || 0, T.CW, T.CH, obs);
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
    if (loc.t === 'slot' && v && v.slots[loc.slot] === card.uid) delete v.slots[loc.slot];
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

  // ---- Verbs --------------------------------------------------------------
  P.verb = function (id) { return this.s.verbs[id]; };

  P.primaryKey = function (verbId) {
    var slots = CF.VERBS[verbId].slots;
    for (var i = 0; i < slots.length; i++) if (slots[i].primary) return slots[i].key;
    return null;
  };

  P.visibleSlots = function (verbId) {
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
    var def = CF.VERBS[verbId];
    if (def.lockedBy === 'burnout' && this.countOf('burnout') > 0) return 'You are burnt out. Rest in Reflect first.';
    return null;
  };

  // Put a table card into a verb slot. Returns true on success.
  P.slotCard = function (verbId, slotKey, uid) {
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

  P.clearSlots = function (verbId) {
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
        self.verb(verbId).out.push(card.uid);
        ctx.out.push(card);
        return card;
      },
      consume: function (c) { if (c) self.remove(c); },
    };
    return ctx;
  };

  P.currentRecipe = function (verbId) {
    var v = this.verb(verbId);
    if (v.status !== 'idle' || !v.slots[this.primaryKey(verbId)]) return null;
    var ctx = this.makeCtx(verbId, v.slots);
    var list = CF.RECIPES_BY_VERB[verbId] || [];
    for (var i = 0; i < list.length; i++) if (list[i].match(ctx)) return { recipe: list[i], ctx: ctx };
    return null;
  };

  // What the verb window should show about the current slots.
  P.preview = function (verbId) {
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
    return Math.max(3, Math.round((d || 10) * this.strainFactor(ctx.verb)));
  };

  P.start = function (verbId) {
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
    v.recipe = r.recipe.id;
    v.duration = this.durationOf(r.recipe, r.ctx);
    v.elapsed = 0;
    v.story = null;
    if (r.recipe.onStart) r.recipe.onStart(r.ctx);
    this.dirty = true;
    return true;
  };

  P.complete = function (verbId) {
    var v = this.verb(verbId);
    var rec = CF.RECIPES_BY_ID[v.recipe];
    var ctx = this.makeCtx(verbId, v.ctxSlots);
    var result;
    try {
      // The main card can vanish mid-recipe (burned informant, expired case...).
      if (!ctx.primary || !rec.match(ctx)) result = { title: 'Interrupted', text: 'Whatever you were working on is gone before you finish. The city does not wait.' };
      else result = rec.run(ctx) || { title: rec.label, text: '' };
    } catch (err) {
      if (typeof console !== 'undefined') console.error(err);
      result = { title: 'Something went wrong', text: String(err && err.message) };
    }
    var self = this;
    // Anything still held (not consumed) comes back out.
    v.held.slice().forEach(function (uid) {
      var c = self.card(uid);
      if (!c) return;
      c.loc = { t: 'out', verb: verbId };
      v.out.push(uid);
    });
    v.held = [];
    v.ctxSlots = {};
    v.status = 'done';
    v.story = result;
    if (this.s.intro) (this.s.intro.done = this.s.intro.done || {})[verbId] = true;
    this.layoutVerbs();
    this.story(result.title, result.text, result.kind || 'verb');
    this.emit('complete', { verb: verbId });
    if (v.out.length === 0 && !result.keepOpen) {
      // Nothing to collect: return the verb to idle straight away.
      v.status = 'idle';
    }
    this.checkThresholds();
  };

  // Drag a single output card out of a finished verb onto the table.
  P.takeOutput = function (verbId, uid, pos) {
    var v = this.verb(verbId);
    var card = this.card(uid);
    if (!card || !card.loc || card.loc.t !== 'out' || card.loc.verb !== verbId) return false;
    this.detach(card);
    this.placeOnTable(card, pos || this.outputSpot(verbId, card));
    if (!v.out.length && v.status === 'done') { v.status = 'idle'; v.story = null; }
    this.dirty = true;
    return true;
  };

  // Where a verb's output lands: back where it came from, or beside the verb.
  P.outputSpot = function (verbId, card) {
    return card.lastPos || null; // else placeOnTable finds a spot by kind
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
    var v = this.verb(verbId);
    var self = this;
    v.out.slice().forEach(function (uid) {
      var c = self.card(uid);
      if (!c) return;
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
    s.t += dt;

    // Card lifetimes. The evidence locker halves decay on clues and evidence.
    var ids = Object.keys(s.cards);
    for (var i = 0; i < ids.length; i++) {
      var c = s.cards[ids[i]];
      if (!c || c.life === undefined || c.life === null) continue;
      var rate = 1;
      if (s.rooms.locker && (c.def === 'clue' || c.def === 'evidence')) rate = 0.5;
      c.life -= dt * rate;
      if (c.life <= 0) this.expire(c);
      else if (c.def === 'case' && c.life < COLD_WARNING) this.warnCold(c);
      else if (c.life < FADE_WARNING && !c.fadeWarned && c.loc && c.loc.t === 'table' && FADING[c.def]) {
        // A clue, lead or witness about to go: say so, once, in time to act.
        c.fadeWarned = true;
        this.emit('expiring', { uid: c.uid, label: this.labelOf(c) });
      }
      if (s.over) return;
    }

    // Verbs.
    for (var vid in s.verbs) {
      var v = s.verbs[vid];
      if (v.status !== 'running') continue;
      v.elapsed += dt;
      if (v.elapsed >= v.duration) this.complete(vid);
      if (s.over) return;
    }

    // The week.
    s.weekT += dt;
    if (s.weekT >= WEEK) {
      s.weekT -= WEEK;
      this.weekTick();
      if (s.over) return;
    }

    if (s.intro && !s.intro.finished) this.introTick();
    this.tickInformants(dt);
    this.tickDelegates(dt);
    if (s.rooms.intel) this.tickIntelOffice();

    // Dispatch: new cases come in on their own clock (or an informant's).
    s.dispatchT -= dt;
    if (s.dispatchT <= 0) {
      var open = this.openCases().length;
      if (open < this.maxOpenCases()) {
        var next = s.nextCase; s.nextCase = null;
        this.spawnCase(next ? next.template : null, next ? { district: next.district, extraTime: next.extraTime || 0 } : {});
      }
      var base = U.randInt(this.rng, 70, 105) - Math.min(30, s.week * 2) - (CF.RANK_DEFS[s.rank] || {}).dispatch || 0;
      if (this.countOf('syndicate')) base -= 10;
      s.dispatchT = Math.max(40, base);
    }

    this.checkThresholds();
  };

  // One warning per case, a minute before it goes cold.
  P.warnCold = function (card) {
    var rec = this.caseRec(card.caseId);
    if (!rec || rec.status !== 'open' || rec.warned) return;
    rec.warned = true;
    this.story('Going Cold: ' + rec.title, 'A minute left, and the trail is fading. Charge somebody, or let it go and live with it.', 'danger');
  };
  // How long a case has left, in the city's days (a week is a game minute).
  CF.daysLeft = function (seconds) { return Math.max(0, Math.ceil(seconds / (WEEK / 7))); };

  P.expire = function (card) {
    var def = this.def(card);
    var how = card.data.onExpire || def.onExpire || 'vanish';
    var label = this.labelOf(card);
    if (how === 'cold') { this.goCold(card.caseId); return; }
    if (how === 'heal') {
      this.remove(card);
      this.create('health');
      this.story('Healed', 'The stitches come out. You can take a punch again. Probably.', 'minor');
      return;
    }
    if (how === 'burnout') {
      this.remove(card);
      this.gameOver('burnout');
      return;
    }
    if (how === 'recover') {
      var spec = card.data.teammate;
      this.remove(card);
      if (spec) {
        this.create('teammate', spec);
        this.story('Back on Duty', spec.label + ' is out of hospital and back at their desk.', 'minor');
      }
      return;
    }
    if (how === 'verdict') { this.verdict(card); return; }
    if (how === 'ignored') {
      var inf = card.data.informant && this.card(card.data.informant);
      if (inf && inf.def === 'informant') { this.trustInformant(inf, -1); this.story('Nothing Came of It', inf.data.name + ' notices you did nothing with what they told you. They will be slower to tell you again.', 'minor'); }
      this.remove(card);
      return;
    }
    if (card.def === 'witness') this.story('A Witness Moves On', label + ' has left town. Whatever they saw went with them.', 'minor');
    if (card.def === 'bribe') this.story('The Envelope Is Gone', 'Somebody came back for it. They will remember you left it alone.', 'minor');
    if (card.def === 'clue' || card.def === 'evidence') this.story('Trail Degrades', label + ' has degraded beyond use.', 'minor');
    this.remove(card);
  };

  P.weekTick = function () {
    var s = this, self = this;
    s = this.s;
    s.week++;
    if (s.intro && !s.intro.finished) this.introFinish('The week turns.');
    var lines = [];

    // Rent first, out of what is on the table; then the salary.
    var salary = (CF.RANK_DEFS[s.rank] || {}).salary || CF.ECONOMY.salary[s.rank] || 1;
    var funds = this.cardsOf('funds').filter(function (c) { return c.loc.t === 'table'; });
    var paid = funds.length >= CF.ECONOMY.rent;
    if (paid) {
      funds.slice(0, CF.ECONOMY.rent).forEach(function (c) { self.remove(c); });
      lines.push('Rent takes ' + CF.ECONOMY.rent + '. Payday: ' + salary + ' Funds.');
    }
    for (var si = 0; si < salary; si++) this.create('funds');
    if (!paid) {
      this.create('fatigue');
      this.create('fatigue');
      lines.push('You cannot make rent. The landlord bangs on the door at six in the morning. You sleep in the car.');
    }

    // The criminal ecosystem grows.
    var atLarge = this.countOf('atlarge');
    var gangs = this.countOf('gang');
    var synd = this.countOf('syndicate');
    var ret = (atLarge ? 1 : 0) + (atLarge >= 3 ? 1 : 0) + gangs * 2 + synd * 3;
    if (ret) { this.meter('retaliation', ret); lines.push('Out there, the people who got away are talking about you.'); }
    if (atLarge + gangs * 2 + synd * 3 >= 4) { this.meter('pressure', 1); lines.push('The newspapers count the criminals at large, and print the number on the front page.'); }
    this.organise();
    lines = lines.concat(this.criminalsAct());

    // Retaliation strikes.
    var r = s.meters.retaliation;
    if (r >= 3 && this.rng() < r * 0.07) this.attack();

    // Temptation.
    if (!this.countOf('bribe') && this.rng() < 0.15 + 0.1 * (gangs + synd * 2)) {
      this.create('bribe');
      lines.push('There is an envelope on your desk. Nobody saw who left it.');
    }

    // Transfers.
    if (s.meters.reputation >= 2 && this.countOf('personnel') < 2 && this.rng() < 0.25) {
      var pk = U.pick(this.rng, ['rookie', 'tech', 'interviewer', 'analyst', 'veteran']);
      this.create('personnel', this.personnelSpec(pk));
      lines.push('A transfer request lands on your desk: ' + CF.PERSONNEL[pk].label + '.');
    }

    // A calm city under a senior officer is Power; it counts every other calm week.
    if (s.rank >= 1 && s.meters.pressure <= 3 && s.meters.scrutiny <= 3) {
      s.calmWeeks = (s.calmWeeks || 0) + 1;
      if (s.calmWeeks % 2 === 0) this.pathGain('commissioner', 1, 'a calm fortnight');
    }
    this.checkDrift();
    if (s.meters.scrutiny >= 7) lines.push('Internal Affairs has started asking your colleagues about you. They are not subtle about it.');
    if (s.meters.pressure >= 7) lines.push('The Commissioner calls you in to ask why the city is burning. It is not a question.');

    this.story('Week ' + s.week, lines.join(' '), 'week');
  };

  // At-large criminals find each other; gangs merge into a syndicate.
  P.organise = function () {
    var s = this.s;
    var self = this;
    var al = this.cardsOf('atlarge').filter(function (c) { return c.loc.t === 'table'; });
    if (al.length >= 3) {
      var members = al.slice(0, 3);
      var name = U.pick(this.rng, CF.NAMES.gang);
      var names = members.map(function (c) { return c.data.name; });
      members.forEach(function (c) { self.remove(c); self.criminalJoins(c.data.name, 'gang'); });
      var front = this.newFront(name);
      this.create('gang', {
        label: 'Gang: ' + name.replace(/^the /, 'The '),
        data: { name: name, members: names, front: front.id },
        desc: 'Formed by ' + names.join(', ') + ', who all got away from you. They feed Retaliation every week. Go Undercover to build a case against them.',
      });
      this.meter('pressure', 1);
      this.story('They Found Each Other', names.join(', ') + ': every one of them walked away from one of your cases. Now they drink in the same bar, and call themselves ' + name + '.', 'major');
    }
    var gangs = this.cardsOf('gang').filter(function (c) { return c.loc.t === 'table'; });
    if (gangs.length >= 2 && !this.countOf('syndicate') && !s.flags.syndicateFallen) {
      gangs.slice(0, 2).forEach(function (c) { self.remove(c); });
      this.spawnSyndicate('The gangs have stopped fighting each other. Someone Uptown has put them on a payroll. They call it, simply, the Syndicate.');
    }
    // The Crusader's enemy doesn't wait to be built from your failures.
    if (s.calling === 'crusader' && (s.week >= 6 || this.countOf('ledger') >= 3) && !this.countOf('syndicate') && !s.flags.syndicateFallen) {
      this.spawnSyndicate('You have seen the same lawyers at every bail hearing, the same car outside every gang\'s clubhouse. Behind the city\'s crime there is a board, a long table, and very good chairs. They call it the Syndicate. Go Undercover to get at their books.');
    }
  };

  P.spawnSyndicate = function (text) {
    var s = this.s;
    for (var k in s.criminals) if (s.criminals[k].organization === 'gang') s.criminals[k].organization = 'syndicate';
    this.newFront('the Syndicate', 'uptown');
    this.create('syndicate');
    this.meter('retaliation', 2);
    this.story('The Syndicate', text, 'major');
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
        this.story('Officer Down', this.labelOf(c) + ' was shot on their way home. The funeral is on Thursday. The whole precinct goes. You carry the coffin.', 'danger');
      } else {
        this.remove(c);
        this.create('injured', { label: 'Injured: ' + this.labelOf(c), data: { teammate: { label: c.label, desc: c.desc, aspects: c.aspects, data: c.data } } });
        this.story('Officer Hurt', this.labelOf(c) + ' was jumped outside the precinct. They will be in hospital for a while.', 'danger');
      }
    } else {
      this.hurtYou('Someone was waiting in the stairwell of your building. You remember the first punch and not much after.');
    }
  };

  // Lose Health to a Wound; a second wound kills you.
  P.hurtYou = function (text) {
    var hp = this.cardsOf('health', true);
    if (hp.length) {
      this.remove(hp[0]);
      this.create('wound');
      this.story('Wounded', text, 'danger');
    } else {
      this.story('In the Line of Duty', text, 'danger');
      this.gameOver('death');
    }
  };

  // ---- Thresholds ----------------------------------------------------------
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
      this.story('Burnout', 'You sit in the car outside the precinct for an hour and cannot make yourself go in. Your hands will not stop shaking. You need rest, and soon.', 'danger');
    }

    var obs = free('obsession');
    if (obs.length >= 3) {
      if (this.countOf('tunnel')) { this.gameOver('consumed'); return; }
      obs.slice(0, 3).forEach(function (c) { self.remove(c); });
      this.create('tunnel');
      this.story('Tunnel Vision', 'The walls of your flat are covered in string and photographs. You are certain you are right. You are certain of everything now. That should frighten you more than it does.', 'danger');
    }

    if (s.meters.pressure >= this.meterMax('pressure')) { this.gameOver('dismissed'); return; }
    if (s.meters.scrutiny >= this.meterMax('scrutiny')) { this.gameOver('corruption'); return; }

    // Promotion boards.
    if (s.rank < CF.TOP_RANK && s.meters.reputation >= CF.RANK_REP[s.rank + 1] && !this.cardsWith('promotion').length) {
      var next = CF.RANK_DEFS[s.rank + 1];
      this.create('promotion', { label: 'Promotion Board: ' + next.label, desc: next.text + ' Attend the board in Duty.', data: { rank: s.rank + 1 } });
      this.story('The Brass Take Notice', 'A memo, on heavy paper: a promotion board has been convened. Your attendance is expected.', 'major');
    }
    if (s.calling === 'commissioner' && s.rank === CF.TOP_RANK && s.meters.reputation >= CF.COMMISSIONER_REP && !this.countOf('chair') && !s.flags.chairCooldown) {
      this.create('chair');
      this.story('The Chair Is Empty', 'The Commissioner has resigned. The council will choose a successor, and your name is on the list.', 'major');
    }
  };

  // ---- Endings -------------------------------------------------------------
  CF.ENDINGS = {
    dismissed: { win: false, title: 'Dismissed', text: 'The city lost patience. Too many names on the front page, too many of them walking free. The Commissioner takes your badge in front of the whole squad room and does not meet your eyes.' },
    burnout: { win: false, title: 'Burnt Out', text: 'One morning you simply do not go in. Or the next. The resignation letter is two lines long. Someone else sits at your desk now, and the phone keeps ringing.' },
    collapse: { win: false, title: 'Collapse', text: 'You collapse on the precinct stairs. The doctors use words like "exhaustion" and "cardiac event" and "early retirement". The city does not send flowers.' },
    consumed: { win: false, title: 'Lost in the Case', text: 'You stop going home. You stop shaving. You stop answering to your name. When they finally open the door to your flat, every wall is covered, and none of it makes sense to anyone but you.' },
    corruption: { win: false, title: 'Corruption Charges', text: 'Internal Affairs comes for you at dawn, with a warrant and a box for your things. The coerced statements, the envelopes, the evidence that appeared from nowhere. They kept a list too.' },
    death: { win: false, title: 'Killed in the Line of Duty', text: 'They give you a flag, a bagpiper and a paragraph in the morning paper. The people who did it are drinking to your memory in a bar on the Docks.' },
    commissioner: { win: true, title: 'The Commissioner', text: 'The council votes, and it is not close. You take the chair, the corner office and the city\'s police force, and you begin, slowly, to rebuild it in your own image. Somewhere a new detective sits at your old desk. You make sure they have what you did not.' },
    master: { win: true, title: 'The Master Detective', text: 'The Architect is sentenced on a grey Tuesday. Every crime you ever worked had their fingerprints on it, if you knew where to look. You did. The newspapers call you the best detective the city has ever had. You fold a paper crane, and throw it away.' },
    crusader: { win: true, title: 'The Crusader', text: 'The long table Uptown is empty. The chairs are sold at auction. It cost you more than you will ever say, and the city will grow new criminals like weeds through concrete. But for one bright season, nobody is above the law.' },
  };

  P.gameOver = function (id) {
    var s = this.s;
    if (s.over) return;
    var end = CF.ENDINGS[id];
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

  P.applyLegacy = function (L) {
    var self = this;
    (L.cold || []).slice(0, 4).forEach(function (c) { self.create('coldcase', c); });
    (L.criminals || []).forEach(function (c) { var copy = U.clone(c); copy.heat = 0; self.s.criminals[copy.id] = copy; });
    (L.atlarge || []).slice(0, 2).forEach(function (c) { self.create('atlarge', c); });
    (L.gangs || []).slice(0, 1).forEach(function (c) { self.create('gang', c); });
    if (L.syndicate) this.create('syndicate');
    this.create('notes', { desc: 'The notebook of ' + L.predecessor + ' (' + L.ending + '). Half of it is illegible. Read it in Reflect.' });
    this.meter('retaliation', Math.min(4, (L.atlarge || []).length + (L.gangs || []).length * 2));
    this.story('Inherited', 'Your predecessor, ' + L.predecessor + ', left you their desk, their cold cases and their enemies. The enemies have already sent a welcome card.', 'major');
  };

  // ---- Specs for generated cards ------------------------------------------
  P.newName = function () {
    return U.pick(this.rng, CF.NAMES.first) + ' ' + U.pick(this.rng, CF.NAMES.last);
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
    return { label: 'File: ' + p.label, desc: p.desc + ' Cost: ' + p.cost + ' Funds.', data: { personnel: key } };
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
  P.unlockVerb = function (id, why) {
    var v = this.s.verbs[id];
    if (!v || v.unlocked) return false;
    v.unlocked = true;
    this.layoutVerbs();
    if (why) this.story('Unlocked: ' + CF.VERBS[id].label, why, 'major');
    return true;
  };
  P.informantSpec = function (district) {
    var name = this.newName();
    var nick = U.pick(this.rng, ['Whistle', 'Two-Coats', 'Sparrow', 'Lucky', 'The Deacon', 'Moth', 'Rattle', 'Penny']);
    return {
      label: 'Informant: ' + nick,
      desc: name + ', known on the street as ' + nick + '. Works ' + CF.DISTRICTS[district].label + '. Meet them in Patrol with Funds for a tip.',
      data: { name: nick, district: district, heat: 0, trust: 1, tipT: CF.INFORMANT.firstTip },
    };
  };

  P.addOrdersForRank = function (rank) {
    var self = this;
    var bought = this.s.flags.bought = this.s.flags.bought || {};
    Object.keys(CF.ORDERS).forEach(function (k) {
      var o = CF.ORDERS[k];
      if (o.rank !== rank || bought[k]) return;
      var what = o.room ? CF.ROOMS[o.room].desc : CF.CARDS[o.give].desc;
      self.create('order', { label: 'Order: ' + o.label, desc: what + ' Cost: ' + o.cost + ' Funds.', data: { order: k } });
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
    if (note !== false) this.story('Back from ' + rec.title, this.labelOf(back) + ' hands in a report on ' + rec.title + ' and goes back to their desk.', 'minor');
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
      this.create('evidence', { label: item.label, desc: item.text + ' Take it to Analyze.' + needs + ' (Evidence in: ' + rec.title + ')', caseId: rec.id, data: { item: item } });
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
        self.story('Intelligence Office', 'The office matches ' + self.labelOf(c) + ' to a known address: ' + f.name + '. ' + f.gang.replace(/^the /, 'The ') + ' works through it.', 'major');
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
  P.spawnCase = function (templateId, opts) {
    opts = opts || {};
    var s = this.s;
    var rng = this.rng;
    var tid = templateId || U.pick(rng, CF.ORDINARY_CASES);
    var T = CF.CASE_TEMPLATES[tid];
    var id = 'c' + s.nextUid++;
    var victim = opts.victim || this.newName();
    var last = U.pick(rng, CF.NAMES.last);
    var district = opts.district || U.pick(rng, T.districts);
    var vars = {
      victim: victim, last: last, n: U.randInt(rng, 3, 19), district: CF.DISTRICTS[district].label,
      gang: opts.gangName || 'the gang', culprit: opts.culpritName || '',
    };
    var scene = U.fill(U.pick(rng, T.scenes), vars);
    vars.scene = scene;
    // Structure first, prose second: the shape of this particular crime.
    var structure = (CF.STRUCTURES[tid] && CF.STRUCTURES[tid].length) ? U.pick(rng, CF.STRUCTURES[tid]) : null;
    if (structure) for (var sv in structure.vars) vars[sv] = U.pick(rng, structure.vars[sv]);

    var nSus = Math.min(3, T.roles.length);
    var roles = U.sample(rng, T.roles, nSus);
    var traits = U.sample(rng, CF.TRAITS, nSus);
    var guiltyIdx = U.randInt(rng, 0, nSus - 1);
    if (opts.culpritTrait) {
      var tr = CF.TRAITS.filter(function (x) { return x.id === opts.culpritTrait; })[0];
      if (tr) {
        traits = traits.filter(function (x) { return x.id !== tr.id; }).slice(0, nSus - 1);
        traits.splice(guiltyIdx, 0, tr);
      }
    }
    var self = this;
    var suspects = roles.map(function (r, i) {
      var name = i === guiltyIdx && opts.culpritName ? opts.culpritName : self.newName();
      return { key: 's' + i, name: name, role: r.role, motive: r.motive, trait: traits[i].id, guilty: i === guiltyIdx, revealed: false };
    });
    var culprit = suspects[guiltyIdx];
    vars.culprit = culprit.name;

    var highProfile = !!T.highProfile || rng() < 0.15;
    var difficulty = T.difficulty + (highProfile && !T.highProfile ? 1 : 0);
    // The charge profile: what a court will want proven. A high-profile
    // case wants one more point of its main aspect.
    var charge = U.clone(T.charge);
    if (highProfile && !T.highProfile) charge[T.keyAspects[0]]++;
    // A known criminal's crimes are harder to prove the further they have risen.
    charge[T.keyAspects[0]] += this.caseRankBonus(opts.criminalId);
    // A Careful criminal leaves less behind.
    var known = opts.criminalId && this.criminal(opts.criminalId);

    // Scene pool: template items + generic items + the culprit's trait clue.
    var pool = T.items.concat(U.sample(rng, CF.GENERIC_SCENE, 1)).map(function (it) { return fillItem(it, vars); });
    if (structure) pool = pool.concat(structure.items.map(function (it) { return fillItem(it, vars); }));
    var items = U.shuffle(rng, pool);
    if (known && known.traits.indexOf('careful') >= 0) items = items.slice(0, Math.max(2, items.length - 2));
    // The network: a clue that points at the place this crime went through.
    var front = !T.special ? this.frontForCase(opts) : null;
    if (front) items.splice(U.randInt(rng, 0, Math.min(2, items.length)), 0, this.linkItem(front));
    var trait = traits[guiltyIdx];
    var traitItem = { type: 'clue', label: trait.clue.label, text: trait.clue.text, aspects: trait.clue.aspects, trait: trait.id };
    items.splice(U.randInt(rng, 0, Math.min(2, items.length)), 0, traitItem);

    var rec = {
      id: id, template: tid, title: U.fill(T.title, vars), short: T.label, district: district, scene: scene,
      victim: victim, vars: vars, suspects: suspects, culprit: culprit.key, keyAspects: T.keyAspects.slice(),
      difficulty: difficulty, highProfile: highProfile, charge: charge, items: items, found: 0,
      witnesses: U.shuffle(rng, T.witnesses), work: 0, searches: 0, identified: null, status: 'open', leads: {},
      special: !!T.special, atLargeUid: opts.atLargeUid || null, gangUid: opts.gangUid || null,
      reopened: !!opts.reopened, criminalId: opts.criminalId || null,
      structure: structure ? structure.id : null, front: front ? front.id : null,
    };
    s.cases[id] = rec;
    s.stats.cases++;

    var life = (opts.lifetime || T.lifetime) + (opts.extraTime || 0);
    var brief = U.fill(structure && !opts.culpritName ? structure.brief : T.brief, vars);
    // An informant's warning: you were ready for this one.
    var warning = !T.special && this.warningFor(tid);
    if (warning) {
      life += CF.INFORMANT.warningExtraTime;
      var winf = warning.data.informant && this.card(warning.data.informant);
      if (winf && winf.def === 'informant') this.trustInformant(winf, 1);
      this.remove(warning);
      brief += ' You were warned, and you were ready: the scene is fresh, and you already have a name.';
    }
    var spec = {
      label: (highProfile ? '★ ' : '') + rec.title,
      desc: brief + ' (' + CF.DISTRICTS[district].label + ')' + (highProfile ? ' High-profile: the papers are watching.' : ''),
      caseId: id, lifetime: life, data: { onExpire: 'cold' },
    };
    var card = opts.ctx ? opts.ctx.give('case', spec) : this.create('case', spec);
    if (warning) this.revealSuspect(rec, null);
    if (!opts.quiet) {
      this.story(opts.headline || 'New Case: ' + rec.title, (opts.lead ? opts.lead + ' ' : '') + brief, 'case');
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
      desc: U.fill('{name}, {role}. {trait}', { name: sus.name, role: sus.role, trait: trait.desc }) + ' (Suspect in: ' + rec.title + ')',
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
    if (this.countOf('tunnel') && !flags.noMisread && this.rng() < 0.35) data.misread = true;
    return {
      label: item.label,
      desc: item.text,
      aspects: aspects,
      caseId: rec.id,
      data: data,
    };
  };

  P.witnessSpec = function (rec) {
    var who = rec.witnesses.length ? rec.witnesses.shift() : 'a passer-by';
    var name = this.newName();
    return {
      label: 'Witness: ' + name,
      desc: name + ', ' + who + '. Saw something near ' + rec.scene + '. (Witness in: ' + rec.title + ')',
      caseId: rec.id,
      data: { knows: this.rng() < 0.65 },
    };
  };

  // Remove every card belonging to a case (optionally sparing some).
  P.clearCaseCards = function (caseId, spare) {
    spare = spare || [];
    for (var k in this.s.cards) {
      var c = this.s.cards[k];
      if (c.caseId === caseId && spare.indexOf(c) < 0) this.remove(c);
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
    this.releaseDelegate(rec);
    this.s.stats.cold++;
    this.emit('resolved', this.caseRecord(rec, 'cold'));
    this.clearCaseCards(caseId);
    var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
    this.meter('pressure', (rec.highProfile ? 2 : 1) + (rec.major ? 1 : 0));

    if (rec.template === 'gang') {
      this.meter('retaliation', 2);
      this.story('The Operation Collapses', 'Your case against ' + rec.vars.gang + ' falls apart. They know who you are now.', 'danger');
      return;
    }
    if (rec.template === 'syndicate') {
      this.meter('retaliation', 3);
      this.story('The Long Table Laughs', 'Your case against the Syndicate runs out of road. The chairman sends you a bottle of very expensive whisky, with his compliments.', 'danger');
      return;
    }
    if (rec.template === 'architect') {
      this.s.flags.architect = false;
      this.story('The Architect Vanishes', 'By the time you get a warrant the house on the hill is empty, except for a paper crane on the mantelpiece. You will have to find the thread again.', 'danger');
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
      label: CF.Criminals.rankOf(crim).label + ': ' + culprit.name,
      desc: culprit.name + ', ' + culprit.role + '. Got away with ' + rec.title + '. ' + this.criminalDesc(crim),
      data: { name: culprit.name, trait: culprit.trait, template: rec.template, criminalId: crim.id },
    });
    this.create('coldcase', {
      label: 'Cold: ' + rec.title,
      desc: 'The trail went cold. ' + culprit.name + ' walked. With an Archive, this can be reopened in Analyze.',
      data: { template: rec.template, culpritName: culprit.name, culpritTrait: culprit.trait, atLargeUid: al.uid, title: rec.title },
    });
    this.story('The Trail Goes Cold', rec.title + ' goes into a box in the basement. Somewhere in ' + CF.DISTRICTS[rec.district].label +
      ', ' + culprit.name + ' reads the newspaper and laughs.', 'danger');
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
        notes.push('The defence asks to see the warrant for the search. There is no warrant. The evidence is excluded.');
      }
    }
    if (d.planted && rng() < 0.3) {
      p = 0.03;
      this.meter('scrutiny', 3);
      notes.push('The defence\'s expert takes your planted evidence apart on the stand. The courtroom goes very quiet.');
    }
    for (var j = 0; j < (d.contradictions || 0); j++) {
      if (rng() < 0.35) {
        p -= 0.2;
        notes.push('The defence reads your own evidence back to the jury: it describes somebody else entirely.');
      }
    }
    p = U.clamp(p, 0.02, 0.97);
    var convicted = rng() < p;
    rec.status = convicted ? 'closed' : 'acquitted';
    this.emit('resolved', this.caseRecord(rec, convicted ? (d.guilty ? 'convicted' : 'wrongful') : 'acquitted', d.name));
    var hp = rec.highProfile;

    if (convicted) {
      s.stats.convictions++;
      if (!d.guilty) s.stats.wrongful++;
      if (d.guilty) {
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
      if (pay) notes.push(tier === 'strong' ? 'A commendation, with a cheque attached.' : 'The case closes, and a small bonus comes with it.');
      if (d.solid && d.guilty) {
        if (s.calling === 'master' && rng() < 0.55) {
          this.create('looseend');
          this.pathGain('master', 1, 'a loose end');
          notes.push('But one detail belongs to no one in the case: a folded paper crane, left where the crime began. You have seen one before.');
        }
      }
      this.onConviction(rec, d, notes);
      if (!d.guilty) {
        var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
        this.meter('scrutiny', 1);
        if (!rec.special) {
          var crimW = this.criminalEscapes(rec, culprit, 'wrongful');
          if (this.atLargeCardFor(crimW)) this.refreshAtLarge(crimW);
          else this.create('atlarge', {
            label: CF.Criminals.rankOf(crimW).label + ': ' + culprit.name,
            desc: culprit.name + ', ' + culprit.role + '. Someone else went to prison for what they did. ' + this.criminalDesc(crimW),
            data: { name: culprit.name, trait: culprit.trait, template: rec.template, criminalId: crimW.id },
          });
        }
      }
      this.story('Guilty: ' + d.name, 'The jury is out for ' + (d.solid ? 'forty minutes' : 'two days') + '. ' + d.name + ' is convicted for ' + rec.title + '. ' +
        (d.guilty ? '' : 'You tell yourself it was the right person. ') + notes.join(' '), 'victory');
    } else {
      s.stats.acquittals++;
      this.meter('pressure', 1);
      this.meter('retaliation', rec.special ? 2 : 1);
      this.meter('reputation', -1);
      if (tier === 'weak' && rng() < 0.5) {
        this.meter('scrutiny', 1);
        notes.push('The judge\'s remarks about a rushed charge reach Internal Affairs by lunchtime.');
      }
      if (!rec.special || rec.template === 'manhunt') {
        if (rec.template === 'manhunt' && rec.atLargeUid && this.card(rec.atLargeUid)) {
          // They were already at large; they simply stay so.
        } else {
          var charged = rec.suspects.filter(function (x) { return x.name === d.name; })[0] || { name: d.name, trait: null };
          var crimA = d.guilty ? this.criminalEscapes(rec, charged, 'acquitted') : null;
          if (crimA && this.atLargeCardFor(crimA)) this.refreshAtLarge(crimA);
          else this.create('atlarge', {
            label: (crimA ? CF.Criminals.rankOf(crimA).label : 'At Large') + ': ' + d.name,
            desc: d.name + ' walked out of court smiling. ' + (d.guilty ? 'They are guilty, and now they are careful. ' + this.criminalDesc(crimA) : 'They were innocent, and now they hate you.'),
            data: { name: d.name, trait: charged.trait, careful: true, criminalId: crimA ? crimA.id : null },
          });
        }
      }
      if (rec.template === 'architect') s.flags.architect = false;
      this.story('Not Guilty: ' + d.name, (notes.length ? notes.join(' ') + ' ' : '') + 'The jury acquits. ' + d.name +
        ' walks down the courthouse steps into the flashbulbs and looks straight at you.', 'danger');
    }
  };

  P.onConviction = function (rec, d, notes) {
    var s = this.s;
    var self = this;
    // Reopened cases and manhunts put an at-large criminal away.
    if (rec.atLargeUid && this.card(rec.atLargeUid) && d.guilty) {
      this.remove(this.card(rec.atLargeUid));
      notes.push('One less name on the list of those who got away.');
      this.meter('retaliation', -1);
      this.pathGain('crusader', 1, 'put away someone at large');
      if (rec.reopened) this.pathGain('master', 1, 'closed a cold case');
    }
    if (rec.template === 'gang') {
      var g = rec.gangUid && this.card(rec.gangUid);
      if (d.guilty || d.solid) {
        if (g) this.remove(g);
        this.meter('retaliation', -4);
        this.pathGain('crusader', 2, 'broke a gang');
        this.create('ledger');
        notes.push(rec.vars.gang + ' is finished. In the boss\'s safe: a ledger page, with numbers that lead further up.');
      }
    }
    if (rec.template === 'syndicate') {
      this.cardsOf('syndicate', true).forEach(function (c) { self.remove(c); });
      s.flags.syndicateFallen = true;
      this.meter('retaliation', -6);
      this.meter('reputation', 5);
      this.pathGain('crusader', 3, 'broke the Syndicate');
      // Breaking the Syndicate is the Crusader's ending for anyone whose
      // Justice is not clearly behind their current path.
      if (this.pathOpen('crusader')) { this.gameOver('crusader'); return; }
      notes.push('The Syndicate is broken.');
    }
    if (rec.template === 'architect') {
      if (d.guilty && this.pathOpen('master')) { this.gameOver('master'); return; }
      s.flags.architect = false;
    }
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
