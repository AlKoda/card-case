// The mind palace (roadmap Phase 6): finding the deduction that fits a set
// of clues, and building what it produces. Patterns live in
// js/data/deductions.js; this file only reads them.
(function (G) {
  var CF = G.CF;
  var U = CF.util;

  var Deduce = (CF.Deduce = {});

  function traitsOf(clues) {
    var t = {};
    clues.forEach(function (c) { if (c.data.trait) t[c.data.trait] = (t[c.data.trait] || 0) + 1; });
    return t;
  }

  // Tunnel Vision cannot see a conflict: any two descriptions look like the
  // same person, and the identification lands on whoever you already suspect.
  Deduce.fits = function (d, clues, tunnel) {
    var n = d.needs || {};
    if (tunnel && n.distinctTraits) return false;
    if (clues.length < (n.min || 2)) return false;
    if (n.aspects) {
      var agg = {};
      clues.forEach(function (c) { U.addAspects(agg, CF.clueAspects(c)); });
      for (var k in n.aspects) if ((agg[k] || 0) < n.aspects[k]) return false;
    }
    var traits = traitsOf(clues);
    if (n.sameTrait) {
      var shared = Object.keys(traits).filter(function (t) { return traits[t] >= 2; });
      var total = 0; for (var tk in traits) total += traits[tk];
      if (!shared.length && !(tunnel && total >= 2)) return false;
    }
    if (n.distinctTraits && Object.keys(traits).length < n.distinctTraits) return false;
    if (n.sharedLink) {
      var links = {};
      clues.forEach(function (c) { if (c.data.link) links[c.data.link] = (links[c.data.link] || 0) + 1; });
      var cases = {};
      clues.forEach(function (c) { cases[c.caseId] = true; });
      if (!Object.keys(links).some(function (l) { return links[l] >= 2; }) || Object.keys(cases).length < 2) return false;
    }
    if (n.points && !clues.some(function (c) { return c.data.points; })) return false;
    if (n.alibi && !clues.some(function (c) { return c.data.alibi; })) return false;
    if (n.pattern && clues.filter(function (c) { return c.data.pattern; }).length < n.pattern) return false;
    if (n.confessions && clues.filter(function (c) { return c.data.confession === 'free'; }).length < n.confessions) return false;
    return true;
  };

  // The first pattern the clues fit, or null.
  Deduce.find = function (clues, tunnel) {
    for (var i = 0; i < CF.DEDUCTIONS.length; i++) if (Deduce.fits(CF.DEDUCTIONS[i], clues, tunnel)) return CF.DEDUCTIONS[i];
    return null;
  };

  // Run a deduction in a recipe context: make the result, fold the clues in.
  // A pattern that crosses cases does not care that the clues differ in case.
  Deduce.crossCase = function (d) { return !!(d && d.needs && d.needs.crossCase); };

  Deduce.run = function (ctx, d, rec, clues) {
    var e = ctx.e;
    if (d.id === 'connect') return Deduce.connect(ctx, clues);
    if (d.id === 'alibi') return Deduce.alibi(ctx, d, rec, clues);
    var traits = traitsOf(clues);
    var shared = Object.keys(traits).filter(function (t) { return traits[t] >= 2; })[0] || null;
    var trait = shared || (Object.keys(traits).length === 1 ? Object.keys(traits)[0] : null);
    var traitDef = trait && CF.TRAITS.filter(function (t) { return t.id === trait; })[0];
    // Who does this describe? A revealed suspect with the trait, or one the clues name.
    var named = clues.map(function (c) { return c.data.points; }).filter(Boolean)[0] || null;
    if (d.id === 'pattern') { named = rec.culprit; rec.identified = rec.culprit; rec.patternRead = true; }
    // Two confessions shield one person: the token points at the culprit once they are in the casebook.
    if (d.id === 'two_confessions') { trait = null; traitDef = null; var cul = rec.suspects.filter(function (x) { return x.guilty && x.revealed && !x.cleared; })[0]; named = cul ? cul.key : null; }
    var fits = rec.suspects.filter(function (x) { return x.revealed && !x.cleared && (x.key === named || (trait && x.trait === trait)); })[0] || null;
    // Tunnel Vision: conflicting descriptions "identify" whoever is on the
    // board, and the result is a misreading that will not hold up.
    var warped = false;
    if (d.id === 'identify' && !shared && Object.keys(traits).length >= 2 && e.countOf('tunnel')) {
      var onBoard = rec.suspects.filter(function (x) { return x.revealed && !x.cleared; });
      fits = onBoard.filter(function (x) { return !x.guilty; })[0] || onBoard[0] || null;
      trait = fits ? fits.trait : trait;
      traitDef = trait && CF.TRAITS.filter(function (t) { return t.id === trait; })[0];
      warped = true;
    }
    var vars = { clues: clues.map(function (c) { return e.labelOf(c); }).join(', '), trait: traitDef ? traitDef.desc : '', name: fits ? fits.name : 'someone' };
    if (warped) vars.trait = 'It all fits. It has to.';
    var made = null;
    if (d.gives) {
      var data = { misread: warped, coerced: false, planted: false, corroborated: true, trait: trait, points: fits ? fits.key : named, deduction: d.id };
      clues.forEach(function (c) {
        data.misread = data.misread || !!c.data.misread;
        data.coerced = data.coerced || !!c.data.coerced;
        data.planted = data.planted || !!c.data.planted;
      });
      var label = d.gives.label, text = U.fill(d.gives.text, vars);
      if (d.id === 'identify') {
        label = fits ? 'Confirmed Identification: ' + fits.name : 'Possible Identification';
        text = fits ? fits.name + ', ' + fits.role + '. ' + text : text + ' Nobody you have met fits yet. Find them, and this becomes a name.';
      }
      // An identification keeps what the tokens carried: one name, and everything they brought.
      var aspects = U.clone(d.gives.aspects);
      if (d.keep) {
        clues.forEach(function (c) { U.addAspects(aspects, CF.clueAspects(c)); });
        for (var ak in aspects) aspects[ak] = Math.min(3, aspects[ak]);
      }
      if (d.id === 'pattern') data.nextDoor = true;
      made = ctx.give('clue', { label: label, desc: text, aspects: aspects, tags: d.gives.tags, caseId: rec.id, data: data });
      if (d.id === 'two_confessions') Deduce.falseConfessions(e, clues);
      if (d.id === 'identify' && fits && !data.misread) {
        rec.identified = fits.key;
        e.pathGain('master', 1, 'an identification');
        for (var k in e.s.cards) {
          var sc = e.s.cards[k];
          if (sc.def === 'suspect' && sc.caseId === rec.id && sc.data.key === fits.key) sc.label = 'Prime Suspect: ' + fits.name;
        }
      }
      if (d.consume) clues.forEach(ctx.consume);
    }
    var st = d.story || {};
    var text2 = U.fill(st.text || '', vars);
    if (d.id === 'identify') text2 += fits ? ' It is ' + fits.name + '.' : ' Whoever it is, you have not met them yet.';
    return { title: U.fill(st.title || d.label, vars), text: text2, kind: st.kind || (fits ? 'major' : undefined), made: made };
  };
  // Two confessions laid side by side: both stay, and both are false now.
  Deduce.falseConfessions = function (e, clues) {
    clues.forEach(function (c) {
      if (c.data.confession !== 'free') return;
      delete c.data.confession;
      c.data.falseConfession = true;
      c.label = 'False Confession: ' + e.labelOf(c).replace(/^(False )?Confession: /, '');
      c.fresh = true;
    });
    e.dirty = true;
  };
  // The night checked against an alibi. An innocent's story holds: they are
  // cleared and their card goes. The culprit's does not: a token against them.
  Deduce.alibi = function (ctx, d, rec, clues) {
    var e = ctx.e;
    var key = clues.map(function (c) { return c.data.alibi; }).filter(Boolean)[0];
    var sus = rec.suspects.filter(function (x) { return x.key === key; })[0];
    if (!sus) return { title: 'Nothing to Check', text: 'The story names nobody in the casebook.' };
    clues.forEach(ctx.consume);
    if (!sus.guilty) {
      sus.cleared = true;
      if (rec.identified === sus.key) rec.identified = null;
      for (var k in e.s.cards) { var c = e.s.cards[k]; if (c.def === 'suspect' && c.caseId === rec.id && c.data.key === sus.key) e.remove(c); }
      return { title: 'The Night Accounted For', text: sus.name + ' was where they said. Strike the name from the casebook.' };
    }
    var made = ctx.give('clue', { label: 'A Lie About the Night', desc: 'The bells do not agree with ' + sus.name + '. Nobody at the crane remembers them.',
      aspects: { opportunity: 2 }, caseId: rec.id, data: { misread: false, coerced: false, planted: false, corroborated: false, trait: sus.trait, points: sus.key, deduction: d.id } });
    return { title: 'A Lie About the Night', kind: 'major', text: 'The bells do not agree with ' + sus.name + '. Nobody at the crane remembers them.', made: made };
  };
  // Two cases, one front: a Thread, the Front on the table, and (for the
  // Master Detective) a name in each connected case.
  Deduce.connect = function (ctx, clues) {
    var e = ctx.e;
    var links = {};
    clues.forEach(function (c) { if (c.data.link) links[c.data.link] = (links[c.data.link] || 0) + 1; });
    var fid = Object.keys(links).sort(function (a, b) { return links[b] - links[a]; })[0];
    var front = e.fronts()[fid];
    if (!front) return { title: 'Nothing There', text: 'The door leads to a house that was pulled down last year.' };
    var titles = [];
    clues.forEach(function (c) { var r = e.caseRec(c.caseId); if (r && titles.indexOf(r.title) < 0) titles.push(r.title); });
    ctx.give('thread', {
      label: 'Thread: ' + front.name,
      desc: titles.join(' and ') + ' both lead to ' + front.name + '. ' + front.gang.replace(/^the /, 'The ') + ' works through it. Bring it to Rest with a Band or Coquille card to close in.',
      data: { front: front.id, cases: titles },
    });
    e.revealFront(front);
    e.pathGain('master', 2, 'found a connection');
    var extra = [];
    if (e.s.calling === 'master') {
      e.casesAtFront(front.id).forEach(function (r) { var sc = e.revealSuspect(r, ctx); if (sc) extra.push(e.labelOf(sc) + ' (' + r.title + ')'); });
    }
    var vars = { clues: clues.map(function (c) { return e.labelOf(c); }).join(', '), front: front.name };
    var d = CF.DEDUCTIONS.filter(function (x) { return x.id === 'connect'; })[0];
    return { title: U.fill(d.story.title, vars), kind: 'major',
      text: U.fill(d.story.text, vars) + (extra.length ? ' And a name for each: ' + extra.join('; ') + '.' : '') };
  };
})(typeof window !== 'undefined' ? window : globalThis);
