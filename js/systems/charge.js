// The Charge system (roadmap Phases 4–5): what a case needs proven, how a
// set of clues measures up, and the three charge strengths the court reacts
// to. A charge is scored as
//     evidence strength + diversity + corroboration − contradictions − illegal evidence
// against the case's charge profile, so four Forensic clues are not
// automatically better than one of each kind, and a clue that describes
// somebody other than the accused counts against you.
(function (G) {
  var CF = G.CF;
  var U = CF.util;
  var P = CF.Engine.prototype;

  var Charge = (CF.Charge = {});
  Charge.TIERS = {
    weak: { label: 'Indicia', text: 'Enough to hold them in the Hole. Before the sworn men, an advocate will eat it alive.' },
    reasonable: { label: 'Half Proof', text: 'It could go either way. The sworn men might take it, or convict of the lesser crime.' },
    strong: { label: 'Full Proof', text: 'Several independent kinds of proof, all pointing one way. The Carolina is satisfied. It should hold.' },
  };

  // The charge profile of a case: {aspect: points needed}. Generated cases
  // carry their own (rec.charge); older saves fall back to the template.
  Charge.profileOf = function (rec) {
    if (rec.charge) return rec.charge;
    var T = CF.CASE_TEMPLATES[rec.template];
    if (T && T.charge) return T.charge;
    var p = {};
    rec.keyAspects.forEach(function (k) { p[k] = Math.max(1, Math.round(rec.difficulty / rec.keyAspects.length)); });
    return p;
  };
  Charge.needOf = function (profile) {
    var n = 0;
    for (var k in profile) n += profile[k];
    return n;
  };

  // Score one set of clues against a suspect. `skipMisread` drops the clues
  // Tunnel Vision made you misread, giving the charge's real strength.
  function score(rec, sus, clues, profile, skipMisread) {
    var res = { strength: 0, diversity: 0, corroboration: 0, contradictions: 0, illegal: 0, have: {}, notes: [], n: 0 };
    var seen = {};
    clues.forEach(function (c) {
      if (skipMisread && c.data.misread) return;
      res.n++;
      var a = CF.clueAspects(c);
      for (var k in a) {
        seen[k] = true;
        res.have[k] = (res.have[k] || 0) + a[k];
      }
      if (c.data.corroborated) res.corroboration += 1;
      if (c.data.points && sus) res.corroboration += c.data.points === sus.key ? 1 : 0;
      if (c.data.points && sus && c.data.points !== sus.key) res.contradictions++;
      if (c.data.trait && sus) {
        if (c.data.trait === sus.trait) res.corroboration += 0.5;
        else res.contradictions++;
      }
      if (c.data.coerced) res.illegal++;
      if (c.data.planted) res.illegal++;
      if (c.data.illegal) res.illegal++;
    });
    // Strength: profile aspects count in full up to what the case needs,
    // half for as much again, nothing past that; aspects the case does not
    // turn on count a quarter. Piling one aspect up has a ceiling.
    res.covered = 0;
    for (var k2 in res.have) {
      var need = profile[k2] || 0, have = res.have[k2];
      if (need) {
        res.strength += Math.min(have, need) + Math.min(need, Math.max(0, have - need)) * 0.5;
        res.covered++;
      } else res.strength += have * 0.25;
    }
    res.diversity = Math.min(2.5, Math.max(0, Object.keys(seen).length - 1) * 0.5);
    res.score = res.strength + res.diversity + res.corroboration - res.contradictions * 2 - res.illegal;
    return res;
  }

  function tierOf(r, need) {
    if (r.n === 0) return 'weak';
    if (r.score >= need && r.covered >= 2 && r.contradictions === 0) return 'strong';
    if (r.score >= need * 0.6) return 'reasonable';
    return 'weak';
  }

  // Assess a charge: the suspect card plus the clues laid beside it.
  P.assessCharge = function (suspectCard, clues) {
    var rec = this.caseRec(suspectCard.caseId);
    if (!rec) return null;
    var sus = this.suspectOf(suspectCard);
    var profile = Charge.profileOf(rec);
    var need = Charge.needOf(profile);
    var own = clues.filter(function (c) { return c.caseId === rec.id; });
    var apparent = score(rec, sus, own, profile, false);
    var real = score(rec, sus, own, profile, true);
    var res = {
      rec: rec, profile: profile, need: need, n: own.length, foreign: clues.length - own.length,
      have: apparent.have, strength: apparent.strength, diversity: apparent.diversity, corroboration: apparent.corroboration,
      contradictions: apparent.contradictions, illegal: apparent.illegal, coerced: 0, planted: 0, unwarranted: 0,
      score: apparent.score, apparent: apparent.score, real: real.score, covered: apparent.covered,
    };
    own.forEach(function (c) { if (c.data.coerced) res.coerced++; if (c.data.planted) res.planted++; if (c.data.illegal) res.unwarranted++; });
    res.tier = tierOf(apparent, need);
    res.realTier = tierOf(real, need);
    res.quality = res.tier;
    res.solid = res.realTier === 'strong';
    // Which clues describe somebody else, for the preview.
    res.contradicting = own.filter(function (c) {
      return sus && ((c.data.points && c.data.points !== sus.key) || (c.data.trait && c.data.trait !== sus.trait));
    });
    return res;
  };

  // Lines for the Arrest window: what the case needs, what the clues give.
  Charge.describe = function (a) {
    var rows = Object.keys(a.profile).map(function (k) {
      return { aspect: k, need: a.profile[k], have: a.have[k] || 0 };
    });
    var notes = [];
    var extra = Object.keys(a.have).filter(function (k) { return !a.profile[k]; });
    if (extra.length) notes.push({ kind: 'dim', text: extra.map(function (k) { return CF.ASPECTS[k].label + ' ' + a.have[k]; }).join(', ') + ': not what this case turns on. Counts for little.' });
    if (a.diversity) notes.push({ kind: 'good', text: 'Independent kinds of proof: +' + a.diversity });
    if (a.corroboration) notes.push({ kind: 'good', text: 'Corroboration, or proof that names them: +' + a.corroboration });
    if (a.contradictions) notes.push({ kind: 'bad', text: a.contradictions + ' token' + (a.contradictions > 1 ? 's' : '') + ' describe' + (a.contradictions > 1 ? '' : 's') + ' somebody else: −' + a.contradictions * 2 });
    if (a.illegal) notes.push({ kind: 'bad', text: 'Beaten out, arranged, or found without a writ: −' + a.illegal + ', and the advocate may find out.' });
    if (a.foreign) notes.push({ kind: 'bad', text: a.foreign + ' token' + (a.foreign > 1 ? 's have' : ' has') + ' nothing to do with this case.' });
    return { rows: rows, notes: notes, score: Math.round(a.score * 10) / 10, need: a.need, tier: a.tier, tierLabel: Charge.TIERS[a.tier].label, tierText: Charge.TIERS[a.tier].text };
  };
})(typeof window !== 'undefined' ? window : globalThis);
