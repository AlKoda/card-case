// The recipe engine (roadmap Phase 2). A recipe is data: what a verb needs
// in its slots, and what happens when the timer runs out. This file turns
// that data into the match / blocked / run functions the engine calls, so
// content files describe recipes instead of programming them.
//
//   {
//     id: 'duty_bribe', verb: 'duty', label: 'Pocket the Envelope', duration: 5,
//     preview: '...', danger: 'Scrutiny +2',
//     requires: { aspects: ['bribe'] },        // or a bare list of aspects
//     forbids:  { aspects: ['funds'] },
//     blocked:  { funds: 2 } | 'text' | fn(ctx),
//     effects:  [ { consume: 'primary' }, { give: 'funds', n: 3 }, { meter: { scrutiny: 2 } },
//                 { story: { title: 'Pocketed', text: '...' } } ],
//     run: fn(ctx)                              // optional code, after the effects
//   }
//
// requires / forbids take: aspects (list, or {aspect: minimum count}),
// tags (every listed tag on some slotted card), cards (definition ids),
// primary (definition id or aspect the primary card must carry), case (a
// case template the primary must belong to), and when(ctx) for anything else.
//
// Effects (each is one object, run in order):
//   consume: 'primary' | 'all' | aspect | [aspects]     n: how many (default all)
//   give:    defId   spec?: object | fn(ctx)  n?: count  (a card into the verb's output)
//   modify:  'primary' | aspect   set?: fields   aspects?: {aspect: delta}   data?: fields
//   meter:   { pressure: 1, scrutiny: -1, ... }
//   chance:  0.5  then: [effects]  else?: [effects]
//   story:   { title, text, kind }  (text and title may be fn(ctx) or a list to pick from)
//   unlock:  verbId            district: districtKey     flag: { name: value }
//   reveal:  'any' | 'culprit' | suspect key   (a suspect of the primary's case)
//   set:     { field: value }  on the primary's case record (hidden variables)
//   call:    fn(ctx)           (an escape hatch; returns a story result or nothing)
(function (G) {
  var CF = G.CF;
  var U = CF.util;

  var Recipe = (CF.Recipe = {});

  function list(x) { return x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]; }
  function fnOr(v, ctx) { return typeof v === 'function' ? v(ctx) : v; }
  function text(v, ctx) {
    v = fnOr(v, ctx);
    if (Array.isArray(v)) v = U.pick(ctx.rng, v);
    return v === undefined || v === null ? '' : String(v);
  }
  function cardsIn(ctx, what) {
    if (what === 'primary') return ctx.primary ? [ctx.primary] : [];
    if (what === 'all') return ctx.cards.slice();
    return ctx.with(what);
  }

  // ---- Requirements ---------------------------------------------------------
  function aspectsOk(ctx, spec) {
    if (!spec) return true;
    if (Array.isArray(spec)) return spec.every(function (a) { return ctx.has(a); });
    for (var a in spec) if (ctx.count(a) < spec[a]) return false;
    return true;
  }
  function tagsOk(ctx, tags) {
    return list(tags).every(function (t) { return ctx.cards.some(function (c) { return CF.hasTag(c, t); }); });
  }
  function cardsOk(ctx, ids) {
    return list(ids).every(function (id) { return ctx.cards.some(function (c) { return c.def === id; }); });
  }
  function primaryOk(ctx, what) {
    if (!what) return true;
    var p = ctx.primary;
    if (!p) return false;
    return list(what).some(function (w) { return p.def === w || CF.aspectsOf(p)[w] > 0; });
  }
  function caseOk(ctx, tid) {
    if (!tid) return true;
    var rec = ctx.caseOf(ctx.primary);
    return !!rec && list(tid).indexOf(rec.template) >= 0;
  }

  Recipe.requirementsMet = function (req, ctx) {
    if (!req) return true;
    if (Array.isArray(req)) return aspectsOk(ctx, req);
    return aspectsOk(ctx, req.aspects) && tagsOk(ctx, req.tags) && cardsOk(ctx, req.cards) &&
      primaryOk(ctx, req.primary) && caseOk(ctx, req.case) && (!req.when || !!req.when(ctx));
  };
  Recipe.forbidden = function (fb, ctx) {
    if (!fb) return false;
    if (Array.isArray(fb)) return fb.some(function (a) { return ctx.has(a); });
    return list(fb.aspects).some(function (a) { return ctx.has(a); }) ||
      list(fb.tags).some(function (t) { return ctx.cards.some(function (c) { return CF.hasTag(c, t); }); }) ||
      list(fb.cards).some(function (id) { return ctx.cards.some(function (c) { return c.def === id; }); }) ||
      (!!fb.when && !!fb.when(ctx));
  };

  function blockedBy(spec, ctx) {
    if (!spec) return null;
    if (typeof spec === 'string') return spec;
    if (typeof spec === 'function') return spec(ctx) || null;
    if (spec.funds !== undefined) {
      var need = fnOr(spec.funds, ctx);
      if (ctx.count('funds') < need) return 'Needs ' + need + ' Funds (you have put in ' + ctx.count('funds') + ').';
    }
    if (spec.minClues && ctx.with('clue').length < spec.minClues) return 'You need at least ' + spec.minClues + ' clues.';
    if (spec.sameCase) {
      var cl = ctx.with('clue'), id = cl.length ? cl[0].caseId : null;
      if (!cl.every(function (c) { return c.caseId === id; })) return 'These clues belong to different cases.';
    }
    if (spec.text) return fnOr(spec.text, ctx);
    return null;
  }

  // ---- Effects ------------------------------------------------------------------
  var OPS = {
    consume: function (ctx, op) {
      var what = list(op.consume), n = op.n;
      what.forEach(function (w) {
        var cards = cardsIn(ctx, w);
        (n ? cards.slice(0, n) : cards).forEach(ctx.consume);
      });
    },
    give: function (ctx, op) {
      var n = op.n || 1;
      for (var i = 0; i < n; i++) ctx.give(op.give, fnOr(op.spec, ctx) ? U.clone(fnOr(op.spec, ctx)) : undefined);
    },
    modify: function (ctx, op) {
      cardsIn(ctx, op.modify).forEach(function (c) {
        if (op.set) for (var k in op.set) c[k] = fnOr(op.set[k], ctx);
        if (op.data) { c.data = c.data || {}; for (var d in op.data) c.data[d] = fnOr(op.data[d], ctx); }
        if (op.aspects) { c.aspects = c.aspects || {}; for (var a in op.aspects) c.aspects[a] = Math.max(0, (c.aspects[a] || 0) + op.aspects[a]); }
        if (op.life !== undefined) { c.life = Math.max(0, fnOr(op.life, ctx)); if (!c.maxLife) c.maxLife = c.life; }
        ctx.e.dirty = true;
      });
    },
    meter: function (ctx, op) { for (var m in op.meter) ctx.e.meter(m, fnOr(op.meter[m], ctx)); },
    chance: function (ctx, op) {
      var p = fnOr(op.chance, ctx);
      var branch = ctx.rng() < p ? op.then : op['else'];
      if (branch) Recipe.applyEffects(ctx, branch);
    },
    story: function (ctx, op) {
      var st = fnOr(op.story, ctx);
      ctx.result = { title: text(st.title, ctx), text: text(st.text, ctx), kind: st.kind };
      if (st.keepOpen) ctx.result.keepOpen = true;
    },
    unlock: function (ctx, op) {
      list(op.unlock).forEach(function (vid) { if (ctx.e.s.verbs[vid]) { ctx.e.s.verbs[vid].unlocked = true; ctx.e.layoutVerbs(); } });
    },
    district: function (ctx, op) {
      var key = op.district === true ? (ctx.caseOf(ctx.primary) || {}).district : fnOr(op.district, ctx);
      if (key && !ctx.e.hasDistrict(key)) ctx.e.giveDistrict(key, ctx);
    },
    flag: function (ctx, op) { for (var f in op.flag) ctx.e.s.flags[f] = fnOr(op.flag[f], ctx); },
    reveal: function (ctx, op) {
      var rec = ctx.caseOf(ctx.primary);
      if (!rec) return;
      var who = fnOr(op.reveal, ctx);
      var key = who === 'culprit' ? rec.culprit : who === 'any' ? undefined : who;
      var card = ctx.e.revealSuspect(rec, ctx, key ? { key: key } : {});
      if (card) ctx.revealed.push(card);
    },
    set: function (ctx, op) {
      var rec = ctx.caseOf(ctx.primary);
      if (rec) for (var k in op.set) rec[k] = fnOr(op.set[k], ctx);
    },
    call: function (ctx, op) { var r = op.call(ctx); if (r) ctx.result = r; },
  };

  Recipe.applyEffects = function (ctx, effects) {
    list(effects).forEach(function (op) {
      for (var k in OPS) if (op[k] !== undefined) { OPS[k](ctx, op); return; }
      throw new Error('Unknown recipe effect: ' + JSON.stringify(op));
    });
  };

  // ---- Authored case leads (roadmap Phase 3) ----------------------------------
  // A case template may carry `leads`: the hand-written discovery graph of
  // that case. Each lead becomes a recipe that outranks the generic casework
  // recipes while it is undone, so a written case plays as written and the
  // generic rules only fill in once the script runs out.
  //
  //   { id: 'scene', verb: 'investigate', label, duration, preview,
  //     needs: { aspects, without: [aspects that must be absent], tags, after: ['lead ids'], item: 'evidence key',
  //              tool: 'bio'|'prints'|'lab', suspects: 1, sameDistrict: true, when(ctx, rec) },
  //     once: true (default), consume: true (the primary evidence),
  //     gives: [ { type: 'clue', label, text, aspects, trait: true, points: 'culprit' },
  //              { type: 'evidence', key, label, text, needs, result: { label, text, aspects } },
  //              { type: 'witness', who, knows: true } ],
  //     reveal: 'any' | 'culprit', district: true, fatigue: 0.25,
  //     story: { title, text } }
  //
  // Text fields are filled with the case's variables ({victim}, {scene},
  // {culprit}) plus {seen}: what a witness would notice about the culprit.
  function leadVars(rec) {
    var vars = U.clone(rec.vars || {});
    var cul = rec.suspects.filter(function (x) { return x.guilty; })[0];
    vars.seen = cul ? CF.TRAIT_SEEN[cul.trait] : '';
    vars.culprit = cul ? cul.name : vars.culprit;
    return vars;
  }
  function leadRec(ctx) {
    var rec = ctx.caseOf(ctx.primary);
    return rec && rec.status === 'open' ? rec : null;
  }
  function needsMet(lead, ctx, rec) {
    var n = lead.needs || {}, e = ctx.e;
    if (n.aspects && !aspectsOk(ctx, n.aspects)) return false;
    if (n.without && list(n.without).some(function (a) { return ctx.has(a); })) return false;
    if (n.tags && !tagsOk(ctx, n.tags)) return false;
    if (n.after && !list(n.after).every(function (id) { return (rec.leads || {})[id]; })) return false;
    if (n.item && !(ctx.primary.data && ctx.primary.data.item && ctx.primary.data.item.key === n.item)) return false;
    if (n.tool && !e.hasTool(ctx, n.tool)) return false;
    if (n.suspects && rec.suspects.filter(function (x) { return x.revealed; }).length < n.suspects) return false;
    if (n.sameDistrict) { var d = ctx.first('district'); if (!d || d.data.district !== rec.district) return false; }
    if (n.when && !n.when(ctx, rec)) return false;
    return true;
  }
  function giveLead(ctx, rec, g, vars) {
    var e = ctx.e;
    var fill = function (t) { return U.fill(t || '', vars); };
    var cul = rec.suspects.filter(function (x) { return x.guilty; })[0];
    if (g.type === 'clue') {
      var flags = { points: g.points === 'culprit' ? rec.culprit : g.points || null, noMisread: !!g.noMisread };
      // `echoes`: words that describe a mark are the culprit's mark when it is theirs.
      var echo = g.echoes && cul && cul.trait === g.echoes ? g.echoes : null;
      var item = { label: fill(g.label), text: fill(g.text), aspects: g.aspects, tags: g.tags, trait: g.trait && cul ? cul.trait : echo };
      return ctx.give('clue', e.clueSpec(rec, item, e.helpers(ctx), flags));
    }
    if (g.type === 'evidence') {
      var needs = g.needs ? ' Needs ' + ({ prints: 'a Fingerprint Set', bio: 'a Forensic Kit', lab: 'Lab Access' })[g.needs] + ' to analyse properly.' : '';
      var res = g.result ? { label: fill(g.result.label), text: fill(g.result.text), aspects: g.result.aspects } : null;
      return ctx.give('evidence', { label: fill(g.label), desc: fill(g.text) + ' Take it to Study.' + needs + ' (Raw proof in: ' + rec.title + ')',
        caseId: rec.id, data: { item: { key: g.key, label: fill(g.label), text: fill(g.text), needs: g.needs || null, tags: g.tags, result: res,
          trait: g.echoes && cul && cul.trait === g.echoes ? g.echoes : null } } });
    }
    if (g.type === 'witness') {
      var spec = e.witnessSpec(rec, g.who ? fill(g.who) : undefined);
      if (g.who) spec.desc = spec.label.replace('Witness: ', '') + ', ' + fill(g.who) + '. Saw something near ' + rec.scene + '. (Witness in: ' + rec.title + ')';
      if (g.knows !== undefined) spec.data.knows = !!g.knows;
      return ctx.give('witness', spec);
    }
    if (g.type === 'card') return ctx.give(g.def, g.spec ? U.clone(g.spec) : undefined);
    throw new Error('Unknown lead gift type ' + g.type);
  }
  Recipe.fromLeads = function (templates) {
    var out = [];
    Object.keys(templates).forEach(function (tid) {
      list(templates[tid].leads).forEach(function (lead) {
        out.push({
          id: 'lead_' + tid + '_' + lead.id, verb: lead.verb, lead: lead, priority: 10,
          label: lead.label, duration: lead.duration || ({ investigate: 40, analyze: 20, interrogate: 20, reflect: 30 })[lead.verb] || 30, danger: lead.danger,
          preview: function (ctx) { var rec = leadRec(ctx); return rec ? U.fill(text(lead.preview, ctx), leadVars(rec)) : ''; },
          // A lead runs on the case card (Investigate), a piece of evidence
          // (Analyze), or whatever the lead names as `primary`.
          requires: { case: tid, primary: lead.primary || { investigate: 'case', analyze: 'evidence', interrogate: ['witness', 'suspect'], reflect: ['case', 'clue'] }[lead.verb], when: function (ctx) {
            var rec = leadRec(ctx);
            if (!rec) return false;
            if (lead.once !== false && (rec.leads || {})[lead.id]) return false;
            return needsMet(lead, ctx, rec);
          } },
          run: function (ctx) {
            var e = ctx.e, rec = leadRec(ctx);
            if (!rec) return { title: 'Too Late', text: 'By the time you get to it, the case is no longer open. The moment has passed.' };
            rec.leads = rec.leads || {};
            rec.leads[lead.id] = true;
            if (lead.verb === 'investigate') rec.searches++;
            e.caseWork(rec, ctx);
            var vars = leadVars(rec);
            var given = list(lead.gives).map(function (g) { return giveLead(ctx, rec, g, vars); });
            if (lead.consume) ctx.consume(ctx.primary);
            var extra = [];
            if (lead.reveal) {
              var key = lead.reveal === 'culprit' ? rec.culprit : lead.reveal === 'any' ? undefined : lead.reveal;
              var sc = e.revealSuspect(rec, ctx, key ? { key: key } : {});
              if (sc) extra.push('A name for the casebook: ' + e.labelOf(sc) + '.');
            }
            if (lead.district && !e.hasDistrict(rec.district) && e.s.flags.marketOpen) { e.giveDistrict(rec.district, ctx); extra.push('The case takes you to ' + CF.DISTRICTS[rec.district].label + '.'); }
            if (lead.fatigue && ctx.rng() < lead.fatigue) ctx.give('fatigue');
            if (lead.set) for (var k in lead.set) rec[k] = lead.set[k];
            vars.found = given.map(function (c) { return e.labelOf(c); }).join(', ');
            var st = lead.story || {};
            return { title: U.fill(text(st.title, ctx) || lead.label, vars), text: (U.fill(text(st.text, ctx), vars) + ' ' + extra.join(' ')).trim(), kind: st.kind };
          },
        });
      });
    });
    return out;
  };

  // ---- Compilation -----------------------------------------------------------
  // Adds match / blocked / run to a recipe so the engine can use it. Recipes
  // written with their own match/run keep them; declarative fields wrap them.
  Recipe.compile = function (r) {
    if (r.compiled) return r;
    var ownMatch = r.match, ownBlocked = r.blocked, ownRun = r.run;
    r.match = function (ctx) {
      if (r.rank && ctx.e.s.rank < r.rank && !(r.src && ctx.e.powerOpen && ctx.e.powerOpen(r.src))) return false;
      if (r.requires && !Recipe.requirementsMet(r.requires, ctx)) return false;
      if (r.forbids && Recipe.forbidden(r.forbids, ctx)) return false;
      return ownMatch ? !!ownMatch(ctx) : true;
    };
    if (ownBlocked && typeof ownBlocked !== 'function') r.blocked = function (ctx) { return blockedBy(ownBlocked, ctx); };
    if (r.src) { var innerBlocked = r.blocked; r.blocked = function (ctx) { var lock = ctx.e.originLock && ctx.e.originLock(r.src); return lock || (innerBlocked ? innerBlocked(ctx) : null); }; }
    if (r.effects || !ownRun) {
      r.run = function (ctx) {
        ctx.result = null;
        ctx.revealed = [];
        Recipe.applyEffects(ctx, r.effects);
        var own = ownRun ? ownRun(ctx) : null;
        var res = own || ctx.result || { title: text(r.label, ctx), text: '' };
        if (!own && ctx.revealed.length && ctx.result) {
          res.text += ' ' + ctx.revealed.map(function (c) { return 'A name comes up: ' + ctx.e.labelOf(c) + '.'; }).join(' ');
        }
        return res;
      };
    }
    if (typeof r.danger === 'string') { var dg = r.danger; r.danger = function () { return dg; }; }
    r.priority = r.priority || 0;
    r.compiled = true;
    return r;
  };

  // Registers recipes: compiles them, indexes by id and by verb. Within a
  // verb, higher priority comes first; equal priority keeps file order.
  Recipe.register = function (recipes) {
    CF.RECIPES = (CF.RECIPES || []).concat(recipes.map(Recipe.compile));
    CF.RECIPES_BY_ID = {};
    CF.RECIPES_BY_VERB = {};
    CF.RECIPES.forEach(function (r, i) { r.order = i; CF.RECIPES_BY_ID[r.id] = r; });
    CF.RECIPES.forEach(function (r) { (CF.RECIPES_BY_VERB[r.verb] = CF.RECIPES_BY_VERB[r.verb] || []).push(r); });
    Object.keys(CF.RECIPES_BY_VERB).forEach(function (v) {
      CF.RECIPES_BY_VERB[v].sort(function (a, b) { return (b.priority - a.priority) || (a.order - b.order); });
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
