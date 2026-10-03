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
  // gloss: a few words for the tier's name, beside it in the Court window.
  Charge.TIERS = {
    weak: { label: 'Indicia', gloss: 'Suspicion, not proof: it will not convict', text: 'Indicia: suspicion, not proof. Enough to hold them in the Hole, the cells under the Watch-house; before the sworn men who judge, an advocate will eat it alive.' },
    reasonable: { label: 'Half Proof', gloss: 'Half the proof the Carolina asks: it may hold', text: 'It could go either way. The sworn men might take it, or convict of the lesser crime.' },
    strong: { label: 'Full Proof', gloss: '', text: 'Several independent kinds of proof, all pointing one way. The Carolina, the Emperor\'s law the Court sits under, is satisfied. It should hold.' },
  };

  // The four seals of full proof, and the caption under each laid token.
  Charge.GATES = { enough: 'Enough', kinds: 'Two kinds', word: 'Word behind it', clean: 'Nothing against them' };
  Charge.STANDING = { names: 'Names them', 'else': 'Someone else', off: 'Off the case', proof: 'Proof' };

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
    var res = { strength: 0, diversity: 0, corroboration: 0, contradictions: 0, illegal: 0, have: {}, notes: [], n: 0,
      witnesses: 0, stakes: {}, fingerpost: false, sameStake: false, againstInterest: 0, confession: null, checked: false, bodyOrWrit: false, framed: 0,
      elsewhere: [], elsewhereConfessions: 0 };
    var seen = {};
    clues.forEach(function (c) {
      if (skipMisread && c.data.misread) return;
      // Another person's words (their confession, their motive, their story)
      // prove nothing against this accused. Another's confession is the
      // defence's best friend.
      if (c.data.about && sus && c.data.about !== sus.key) {
        res.elsewhere.push(c);
        if (c.data.confession) { res.contradictions++; res.elsewhereConfessions++; }
        return;
      }
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
      if (c.data.frame) res.framed++;
      if (a.forensic || a.digital) res.bodyOrWrit = true;
      // Word from a witness: credible only if it was not beaten out of them.
      if (c.data.stake && !c.data.coerced) {
        res.witnesses++;
        res.stakes[c.data.stake] = (res.stakes[c.data.stake] || 0) + 1;
        if (c.data.againstInterest) res.againstInterest++;
      }
      if (c.data.confession === 'free') res.confession = 'free';
      else if (c.data.confession === 'question' && res.confession !== 'free') res.confession = 'question';
    });
    // The Fingerpost rule: two witnesses who agree for different reasons
    // establish a fact; two who want the same thing establish nothing.
    var kinds = Object.keys(res.stakes).length;
    if (res.witnesses >= 2 && kinds >= 2) { res.fingerpost = true; res.corroboration += 1.5; }
    else if (res.witnesses >= 2 && kinds === 1) { res.sameStake = true; res.contradictions += 0; res.strength -= (res.witnesses - 1); }
    res.corroboration += res.againstInterest;
    // A confession under the question is checked against Body or Writ.
    if (res.confession === 'question') res.checked = res.bodyOrWrit && res.contradictions === 0;
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
    // Full proof by the Carolina's own routes: a free confession, or two
    // credible witnesses who agree for different reasons.
    if (r.confession === 'free' && r.contradictions === 0) return 'strong';
    if (r.fingerpost && r.contradictions === 0 && r.covered >= 1) return 'strong';
    if (r.confession === 'question' && r.contradictions === 0) return r.checked ? 'strong' : 'reasonable';
    // Enough of the right proof is full proof only with Word behind it: a
    // witness, a confession, or a token that names or corroborates.
    if (r.score >= need && r.covered >= 2 && r.contradictions === 0 && (r.witnesses >= 1 || r.confession || r.corroboration >= 1)) return 'strong';
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
      witnesses: apparent.witnesses, fingerpost: apparent.fingerpost, sameStake: apparent.sameStake, againstInterest: apparent.againstInterest,
      confession: apparent.confession, checked: apparent.checked, framed: apparent.framed,
      elsewhere: apparent.elsewhere, elsewhereConfessions: apparent.elsewhereConfessions,
    };
    own.forEach(function (c) { if (c.data.coerced) res.coerced++; if (c.data.planted) res.planted++; if (c.data.illegal) res.unwarranted++; });
    res.tier = tierOf(apparent, need);
    res.realTier = tierOf(real, need);
    res.quality = res.tier;
    res.solid = res.realTier === 'strong';
    // Which clues describe somebody else, for the preview.
    var self = this;
    res.contradicting = own.filter(function (c) {
      if (!sus) return false;
      if (c.data.about) return c.data.about !== sus.key;
      return (c.data.points && c.data.points !== sus.key) || (c.data.trait && c.data.trait !== sus.trait);
    });
    res.contradictingLabels = res.contradicting.filter(function (c) { return res.elsewhere.indexOf(c) < 0; }).map(function (c) { return self.labelOf(c); });
    res.elsewhereLabels = res.elsewhere.map(function (c) { return self.labelOf(c); });
    // Whose the stray words are, for the Court's note.
    res.elsewhereOf = {};
    res.elsewhere.forEach(function (c) {
      var who = rec.suspects.filter(function (x) { return x.key === c.data.about; })[0];
      res.elsewhereOf[c.uid] = who ? who.name : '';
    });
    // Every row is met, and full proof still wants a word behind it: a
    // witness, a token that names them, or a confession freely given. The
    // honest road there is to confront the accused (see confrontFor).
    var profileRows = Object.keys(profile);
    res.rowsMet = profileRows.length > 0 && profileRows.every(function (k) { return (res.have[k] || 0) >= profile[k]; });
    // What the player has already worked out, for the Court to repeat: the
    // Prime Suspect their own reasoning named (when this charge names another),
    // and a free confession whose own words say it is a lie. The tier stands
    // (a false confession nothing contradicts convicts); only the window speaks.
    var prime = sus && rec.identified && rec.identified !== sus.key ? rec.suspects.filter(function (x) { return x.key === rec.identified && !x.cleared; })[0] : null;
    res.prime = prime ? prime.name : null;
    res.primeKey = prime ? prime.key : null;
    res.falseFree = !!sus && own.some(function (c) { return c.data.confession === 'free' && c.data.falseConfession && (!c.data.about || c.data.about === sus.key); });
    // The four things full proof asks, as the Court's seals: enough proof
    // for the need, two kinds of it the case turns on, a word behind it (a
    // witness, a confession, or corroboration), and nothing against them.
    res.gates = [
      { id: 'enough', ok: apparent.score >= need },
      { id: 'kinds', ok: apparent.covered >= 2 },
      { id: 'word', ok: apparent.witnesses >= 1 || !!apparent.confession || apparent.corroboration >= 1 },
      { id: 'clean', ok: apparent.contradictions === 0 },
    ];
    res.gates.forEach(function (g) { g.label = Charge.GATES[g.id]; });
    // A word wanted: every row met, and of the four seals only the word is dark.
    res.wordWanted = res.rowsMet && res.tier !== 'strong' && res.gates.every(function (g) { return g.id === 'word' ? !g.ok : g.ok; });
    // How full proof was reached, when it was: by the four seals, or by one
    // of the Carolina's own roads (a free confession, two witnesses who
    // agree for different reasons, a confession checked against Body or Writ).
    res.fullBy = null;
    if (res.tier === 'strong') {
      var allLit = res.gates.every(function (g) { return g.ok; });
      res.fullBy = allLit ? 'seals' : apparent.confession === 'free' ? 'confession' : apparent.fingerpost ? 'fingerpost' : apparent.checked ? 'checked' : 'seals';
    }
    // Each laid token's standing toward this accused, for the caption under
    // it: names them, describes someone else, off the case, or plain proof.
    res.standing = {};
    clues.forEach(function (c) {
      var id = 'proof';
      if (c.caseId !== rec.id) id = 'off';
      else if (res.contradicting.indexOf(c) >= 0 || res.elsewhere.indexOf(c) >= 0) id = 'else';
      else if (sus && ((c.data.points && c.data.points === sus.key) || (c.data.about && c.data.about === sus.key) || (c.data.trait && c.data.trait === sus.trait))) id = 'names';
      else {
        var asp = CF.clueAspects(c), onCase = false;
        for (var k in asp) if (asp[k] && profile[k]) onCase = true;
        if (!onCase) id = 'off';
      }
      res.standing[c.uid] = { id: id, label: Charge.STANDING[id] };
    });
    return res;
  };

  // The honest road to full proof once the rows are met: put the accused in
  // Question with a token of their own case (and Wit, if one is free). A
  // culprit may break and confess freely. For the advisor and the dossier:
  // { suspect, token, wit, ready } as uids and a flag, or null when they
  // are cleared, their case is shut, a free confession of theirs already
  // lies on the table, or there is no token of the case to show them.
  P.confrontFor = function (suspectCard) {
    var rec = suspectCard && this.caseRec(suspectCard.caseId);
    var sus = rec && this.suspectOf(suspectCard);
    if (!rec || !sus || sus.cleared || rec.status !== 'open') return null;
    var self = this;
    var table = this.tableCards().filter(function (c) { return !self.unavailableReason(c); });
    var theirs = function (c) { return !c.data.about || c.data.about === sus.key; };
    if (table.some(function (c) { return c.def === 'clue' && c.caseId === rec.id && c.data.confession === 'free' && theirs(c); })) return null;
    var weight = function (c) { var a = CF.clueAspects(c), n = 0; for (var k in a) n += a[k]; return n; };
    var tokens = table.filter(function (c) { return c.def === 'clue' && c.caseId === rec.id && theirs(c) && !c.data.confession; })
      .sort(function (x, y) { return weight(y) - weight(x); });
    if (!tokens.length) return null;
    var wit = table.filter(function (c) { return c.def === 'focus'; })[0];
    var v = this.verb('interrogate');
    return { suspect: suspectCard.uid, token: tokens[0].uid, wit: wit ? wit.uid : null, ready: !!(v && v.unlocked && v.status !== 'running') };
  };

  // Lines for the Arrest window: what the case needs, what the clues give.
  Charge.describe = function (a) {
    var rows = Object.keys(a.profile).map(function (k) {
      return { aspect: k, need: a.profile[k], have: a.have[k] || 0 };
    });
    var notes = [];
    var extra = Object.keys(a.have).filter(function (k) { return !a.profile[k]; });
    if (extra.length) notes.push({ kind: 'dim', text: extra.map(function (k) { return CF.ASPECTS[k].label + ' ' + a.have[k]; }).join(', ') + ': not what this case turns on. Counts for little.' });
    if (a.prime) notes.push({ kind: 'bad', text: U.fill('Your own reasoning named {prime}. This charge names someone else.', { prime: a.prime }) });
    if (a.falseFree) notes.push({ kind: 'bad', text: 'This confession says too much: the wrong day, the wrong knife.' });
    else if (a.confession === 'free') notes.push({ kind: 'good', text: 'A confession, freely given: the king of proofs. Full proof unless something contradicts it.' });
    if (a.confession === 'question') notes.push({ kind: a.checked ? 'good' : 'bad', text: a.checked ? 'A confession under the question, and Body or Writ that agrees with it. The Court will take it.' : 'A confession under the question and nothing of Body or Writ to check it against. Half proof, until it is repeated freely.' });
    if (a.fingerpost) notes.push({ kind: 'good', text: 'Two witnesses who agree for different reasons: a fact. +1.5' });
    if (a.sameStake) notes.push({ kind: 'bad', text: 'Your witnesses all want the same thing. Together they prove no more than one.' });
    if (a.againstInterest) notes.push({ kind: 'good', text: 'A witness who spoke against their own interest: +' + a.againstInterest });
    if (a.diversity) notes.push({ kind: 'good', text: 'Independent kinds of proof: +' + a.diversity });
    if (a.corroboration) notes.push({ kind: 'good', text: 'Corroboration, or proof that names them: +' + a.corroboration });
    var bad = (a.contradicting || []).map(function (c) { return c.uid; });
    (a.elsewhere || []).forEach(function (c) { if (bad.indexOf(c.uid) < 0) bad.push(c.uid); });
    var mine = a.contradictions - (a.elsewhereConfessions || 0);
    if (mine > 0) {
      var names = (a.contradictingLabels || []).filter(Boolean);
      var who = names.length ? names.join(' and ') : mine + ' token' + (mine > 1 ? 's' : '');
      notes.push({ kind: 'bad', text: who + (mine > 1 ? ' describe' : ' describes') + ' somebody else: −' + mine * 2 });
    }
    // Another person's words, laid against this accused.
    (a.elsewhere || []).forEach(function (c, i) {
      var label = (a.elsewhereLabels || [])[i] || c.label, name = (a.elsewhereOf || {})[c.uid];
      var text = c.data.confession ? U.fill('{token}: another\'s confession. It proves nothing against this accused, and the advocate will use it: −2', { token: label })
        : name ? U.fill('{token}: about {name}, not this accused. It counts for nothing here.', { token: label, name: name })
        : U.fill('{token}: about somebody else. It counts for nothing here.', { token: label });
      notes.push({ kind: 'bad', text: text });
    });
    if (a.illegal) notes.push({ kind: 'bad', text: 'Beaten out, arranged, or found without a writ: −' + a.illegal + ', and the advocate may find out.' });
    if (a.foreign) notes.push({ kind: 'bad', text: a.foreign + ' token' + (a.foreign > 1 ? 's have' : ' has') + ' nothing to do with this case.' });
    // What the Court would make of it, and what full proof still wants.
    var T = a.rec && CF.CASE_TEMPLATES[a.rec.template];
    if (a.tier === 'reasonable') notes.push({ kind: 'bad', text: 'Half proof: the Court would convict of ' + (T && T.lesser ? T.lesser : 'the lesser crime') + ', and the ladder stops at banishment.' });
    if (a.tier !== 'strong') {
      // What full proof still wants, read off the dark seals (not off every row: a row short of its mark is
      // not wanted when the seals are lit by other proof). Each seal names the proof that would light it.
      var dark = (a.gates || []).filter(function (g) { return !g.ok; }).map(function (g) { return g.id; });
      var labelOf = function (r) { return CF.ASPECTS[r.aspect].label; };
      var open = rows.filter(function (r) { return r.have < r.need; }).map(labelOf);
      var bare = rows.filter(function (r) { return !r.have; }).map(labelOf);
      // The kinds as a list the eye reads at once, Body / Coin, in any language.
      var orList = function (xs) { return xs.join(' / '); };
      var wants = [];
      if (dark.indexOf('enough') >= 0) {
        var short = Math.max(0.5, Math.ceil((a.need - a.score) * 2) / 2);
        wants.push(open.length ? U.fill('{n} more proof, such as {rows}', { n: short, rows: orList(open) }) : U.fill('{n} more proof', { n: short }));
      }
      if (dark.indexOf('kinds') >= 0) wants.push(bare.length ? U.fill('a second kind the case turns on, such as {rows}', { rows: orList(bare) }) : 'a second kind the case turns on');
      if (dark.indexOf('word') >= 0 && dark.length > 1) wants.push('a word behind it');
      if (dark.indexOf('clean') >= 0) wants.push('without the tokens marked Someone else');
      // Only the word dark: confronting the accused is the honest road to one.
      if (dark.length === 1 && dark[0] === 'word') notes.push({ kind: 'dim', id: 'word', text: 'Word behind it: a witness\'s Deposition, two tokens bound in Rest, a hand matched to them, or a free confession. Confront them in Question with a token of the case.' });
      else if (!wants.length) notes.push({ kind: 'dim', text: 'To full proof: a witness, a token that names them, or a confession freely given. Confront them in Question with a token of the case.' });
      else notes.push({ kind: 'dim', text: 'To full proof: ' + wants.join('; ') + (a.witnesses === 1 ? '; or a second witness who wants something else' : '') + '; or a confession, freely given.' });
    }
    return { rows: rows, notes: notes, bad: bad, wordWanted: !!a.wordWanted, gates: a.gates || [], fullBy: a.fullBy || null, standing: a.standing || {}, score: Math.round(a.score * 10) / 10, need: a.need, tier: a.tier, tierLabel: Charge.TIERS[a.tier].label, tierText: Charge.TIERS[a.tier].text,
      tierGloss: Charge.TIERS[a.tier].gloss };
  };
})(typeof window !== 'undefined' ? window : globalThis);
