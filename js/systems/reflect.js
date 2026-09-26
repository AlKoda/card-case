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
    if (n.points && !clues.some(function (c) { return c.data.points; })) return false;
    return true;
  };

  // The first pattern the clues fit, or null.
  Deduce.find = function (clues, tunnel) {
    for (var i = 0; i < CF.DEDUCTIONS.length; i++) if (Deduce.fits(CF.DEDUCTIONS[i], clues, tunnel)) return CF.DEDUCTIONS[i];
    return null;
  };

  // Run a deduction in a recipe context: make the result, fold the clues in.
  Deduce.run = function (ctx, d, rec, clues) {
    var e = ctx.e;
    var traits = traitsOf(clues);
    var shared = Object.keys(traits).filter(function (t) { return traits[t] >= 2; })[0] || null;
    var trait = shared || (Object.keys(traits).length === 1 ? Object.keys(traits)[0] : null);
    var traitDef = trait && CF.TRAITS.filter(function (t) { return t.id === trait; })[0];
    // Who does this describe? A revealed suspect with the trait, or one the clues name.
    var named = clues.map(function (c) { return c.data.points; }).filter(Boolean)[0] || null;
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
        text = fits ? fits.name + ', ' + fits.role + '. ' + text : text + ' Nobody on the board fits yet. Find them, and this becomes a name.';
      }
      made = ctx.give('clue', { label: label, desc: text, aspects: U.clone(d.gives.aspects), tags: d.gives.tags, caseId: rec.id, data: data });
      if (d.id === 'identify' && fits && !data.misread) {
        rec.identified = fits.key;
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
})(typeof window !== 'undefined' ? window : globalThis);
