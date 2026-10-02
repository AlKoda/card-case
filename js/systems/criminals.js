// Criminal persistence (roadmap Phase 13). Nobody who gets away is deleted:
// they get a record, and the record grows.
//
//   s.criminals[id] = { id, name, trait, crimes, heat, organization, traits, status, history }
//     crimes        cases they are known for (each escape, each new crime)
//     organization  'none' | 'gang' | 'syndicate'
//     traits        'careful' (acquitted once: scenes give up less), 'violent' (feeds Retaliation)
//     status        'at_large' | 'hunted' | 'jailed'
//   Rank follows crimes and organisation: Petty Criminal → Repeat Offender →
//   Gang Member → Gang Lieutenant → Syndicate Member. Higher ranks commit
//   harder crimes: each rank adds a point to the charge a court will want.
// Every week each criminal at large may commit another crime, which arrives
// as a new case with their name on it. Failure makes content.
(function (G) {
  var CF = G.CF;
  var U = CF.util;
  var P = CF.Engine.prototype;

  var Crim = (CF.Criminals = {});
  CF.CRIMINAL_RANKS = [
    { id: 'petty', label: 'Petty Thief', crimes: 0 },
    { id: 'repeat', label: 'Old Offender', crimes: 2 },
    { id: 'member', label: 'Sworn of a Band', crimes: 0, organization: 'gang' },
    { id: 'lieutenant', label: 'Upright Man', crimes: 4, organization: 'gang' },
    { id: 'syndicate', label: 'Of the Coquille', crimes: 0, organization: 'syndicate' },
  ];
  CF.CRIMINAL_TRAITS = {
    careful: { label: 'Careful', desc: 'Has stood before the Blood Court once. Leaves less behind.' },
    violent: { label: 'Violent', desc: 'Hurts people. Feeds the Vendetta every week.' },
    spared: { label: 'Spared', desc: 'Pardoned once. Owes the Examiner, and the underworld knows it.' },
    pilloried: { label: 'Pilloried', desc: 'Stood in the collar. Every quarter knows the face: named at once at any new scene.' },
    branded: { label: 'Branded', desc: 'The iron on the cheek. Cannot swear before a court, cannot be pardoned again.' },
    slipped: { label: 'Slipped', desc: 'Slipped the hue and cry once.' },
  };
  Crim.WEEKLY_CRIME = 0.2;

  Crim.rankOf = function (rec) {
    var best = CF.CRIMINAL_RANKS[0];
    CF.CRIMINAL_RANKS.forEach(function (r) {
      if (r.organization && r.organization !== rec.organization) return;
      if (!r.organization && rec.organization !== 'none') return;
      if (rec.crimes >= r.crimes) best = r;
    });
    return best;
  };
  Crim.rankIndex = function (rec) { return CF.CRIMINAL_RANKS.indexOf(Crim.rankOf(rec)); };

  P.criminal = function (id) { return this.s.criminals[id] || null; };
  P.criminalByName = function (name) {
    var s = this.s.criminals;
    for (var k in s) if (s[k].name === name) return s[k];
    return null;
  };
  P.criminalsAtLarge = function () {
    var s = this.s.criminals, out = [];
    for (var k in s) if (s[k].status === 'at_large' || s[k].status === 'hunted') out.push(s[k]);
    return out;
  };

  // A culprit escapes justice (cold case, acquittal, wrongful conviction).
  P.criminalEscapes = function (rec, sus, how) {
    var c = this.criminalByName(sus.name);
    if (!c) {
      c = { id: 'k' + this.s.nextUid++, name: sus.name, trait: sus.trait, crimes: 0, heat: 0, organization: 'none', traits: [], status: 'at_large', history: [], role: rec.template };
      if (this.rng() < 0.3) c.traits.push('violent');
      this.s.criminals[c.id] = c;
    }
    c.crimes++;
    c.status = 'at_large';
    c.history.push({ week: this.s.week, title: rec.title, how: how });
    if (how === 'acquitted' && c.traits.indexOf('careful') < 0) c.traits.push('careful');
    return c;
  };
  P.criminalCaught = function (name) {
    var c = this.criminalByName(name);
    if (!c) return null;
    c.status = 'jailed';
    c.history.push({ week: this.s.week, how: 'jailed' });
    return c;
  };
  P.criminalJoins = function (name, organization) {
    var c = this.criminalByName(name);
    if (c) c.organization = organization;
  };

  // The hue and cry, begun and ended in one place. A hunt raised for an
  // Abroad card ties the card to its case and keeps the record from working
  // while the Watch is on its heels; a hunt that ends without a conviction
  // (cold, acquitted, the wrong name hanged) sets them loose again, hotter,
  // and sightable again.
  P.criminalOfCard = function (al) {
    if (!al || !al.data) return null;
    return (al.data.criminalId && this.criminal(al.data.criminalId)) || (al.data.name ? this.criminalByName(al.data.name) : null);
  };
  P.huntBegins = function (al, caseId) {
    if (!al || !al.data) return null;
    al.data.hunted = caseId;
    var crim = this.criminalOfCard(al);
    if (crim && crim.status === 'at_large') crim.status = 'hunted';
    return crim;
  };
  P.huntEnds = function (rec, how) {
    var al = rec && rec.atLargeUid ? this.card(rec.atLargeUid) : null;
    var cul = rec && (rec.suspects || []).filter(function (x) { return x.guilty; })[0];
    var crim = (rec && rec.criminalId && this.criminal(rec.criminalId)) || this.criminalOfCard(al) || (cul ? this.criminalByName(cul.name) : null);
    if (al && al.data) delete al.data.sighted;
    if (!crim || crim.status !== 'hunted') return crim;
    crim.status = 'at_large';
    crim.heat = (crim.heat || 0) + 1;
    crim.history.push({ week: this.s.week, title: rec.title, how: how || 'slipped' });
    if (crim.traits.indexOf('slipped') < 0) crim.traits.push('slipped');
    this.refreshAtLarge(crim);
    return crim;
  };
  // A record left 'hunted' with no hue and cry still running (an older save,
  // or a hunt that ended before huntEnds existed) is at large again.
  P.huntStale = function (c) {
    if (!c || c.status !== 'hunted') return false;
    var cases = this.s.cases || {};
    var running = Object.keys(cases).some(function (k) {
      var r = cases[k];
      if (r.template !== 'manhunt' || (r.status !== 'open' && r.status !== 'trial')) return false;
      if (r.criminalId) return r.criminalId === c.id;
      var cul = (r.suspects || []).filter(function (x) { return x.guilty; })[0];
      return !!cul && cul.name === c.name;
    });
    return !running;
  };
  // An informer's sighting still in hand: one at a time for a name.
  P.sightingOut = function (al) {
    var name = al && al.data && al.data.name;
    return !!name && this.cardsOf('intel', true).some(function (c) { return c.data && c.data.kind === 'sighting' && c.data.criminal === name; });
  };

  // What the At Large card says about them.
  P.criminalDesc = function (c) {
    var rank = Crim.rankOf(c);
    var trait = CF.TRAITS.filter(function (t) { return t.id === c.trait; })[0];
    var role = CF.Coquille && CF.Coquille.roleOf(c);
    var bits = [rank.label + (role ? ', ' + role.role.toLowerCase() : '') + '.', c.crimes + ' crime' + (c.crimes === 1 ? '' : 's') + ' on the record.'];
    if (c.king) bits.push('The King of Thunes.');
    if (trait) bits.push(trait.desc);
    c.traits.forEach(function (t) { bits.push(CF.CRIMINAL_TRAITS[t].desc); });
    return bits.join(' ');
  };
  P.atLargeCardFor = function (c) {
    return this.cardsOf('atlarge', true).filter(function (card) { return card.data.criminalId === c.id || card.data.name === c.name; })[0] || null;
  };
  // What the Abroad card is called: the rank and the name, or the crown.
  P.atLargeLabel = function (c) {
    return (c.king ? 'The King of Thunes' : Crim.rankOf(c).label) + ': ' + c.name;
  };
  P.refreshAtLarge = function (c) {
    var card = this.atLargeCardFor(c);
    if (!card) return;
    card.data.criminalId = c.id;
    card.data.trait = card.data.trait || c.trait;
    card.label = this.atLargeLabel(c);
    card.desc = this.criminalDesc(c);
    this.dirty = true;
  };

  // The real culprit behind a wrongful conviction keeps their head down for
  // a few weeks: no Abroad card until the city hears the wrong name hanged.
  // 'how' is what became of the wrong name: a sentence rung, 'burned' when
  // the Inquisitor took the case, 'rival' when the Harbourmaster's examiner
  // hanged them, nothing while the Hole still holds them. 'alibi' is where
  // the wrong name really was (one of CF.PROSE.alibis: their own, when they
  // gave one), kept for the ballad. 'wrong' is the accused who answered for
  // it: their sex is kept (wrongSex) for the mother who comes to the door.
  P.hideCriminal = function (c, rec, how, alibi, wrong) {
    c.hidden = true;
    c.surfaceWeek = this.s.week + U.randInt(this.rng, 2, 4);
    c.wrongfulTitle = rec.title;
    c.wrongfulCase = rec.id;
    c.wrongfulHow = how || null;
    c.wrongfulAlibi = Crim.trueAlibi(alibi) ? alibi : Crim.alibiFor(c.name + '|' + rec.title);
    c.wrongSex = (wrong && wrong.sex) || null;
    c.district = rec.district;
    return c;
  };
  // The true whereabouts for an alibi, or null if the pool has none for it.
  Crim.trueAlibi = function (alibi) {
    var T = CF.PROSE && CF.PROSE.alibiTrue;
    return (alibi && T && T[alibi]) || null;
  };
  // One alibi from the pool, picked by the text given, so it holds across a
  // save and draws nothing from the dice.
  Crim.alibiFor = function (key) {
    var pool = CF.PROSE.alibis, h = 0, str = String(key || '');
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 9973;
    return pool[h % pool.length];
  };
  // The sentence passed on the wrong name, kept on the real culprit's record.
  P.wrongfulSentenced = function (rec, rung) {
    var s = this.s.criminals;
    for (var k in s) if (s[k].hidden && (s[k].wrongfulCase === rec.id || (!s[k].wrongfulCase && s[k].wrongfulTitle === rec.title))) s[k].wrongfulHow = rung;
  };
  // What the ballad says the wrong name got: hanged, burned, the Ravenstone, or nothing yet.
  Crim.wrongfulFate = function (c) {
    var how = c.wrongfulHow;
    if (how === 'rope') return 'hanged for';
    if (how === 'burned') return 'burned for';
    if (how === 'rival') return 'hanged for';
    if (how === 'sword' || how === 'wheel') return 'died on the Ravenstone for';
    return 'answered for';
  };
  // The hidden record surfaces: the card, the Crowd, and unless a new crime
  // tells it first, the ballad.
  P.surfaceCriminal = function (c, crimeFirst) {
    delete c.hidden;
    var title = c.wrongfulTitle || 'an old case';
    var dl = CF.DISTRICTS[c.district] ? CF.DISTRICTS[c.district].label : 'the Warrens';
    this.abroadCard(c, 'Someone else ' + Crim.wrongfulFate(c) + ' ' + title + '.');
    this.meter('pressure', 1);
    var who = c.wrongfulHow === 'burned' ? 'the one the Inquisitor burned' : c.wrongfulHow === 'rival' ? 'the one the Harbourmaster\'s examiner hanged' : 'the one you sent down';
    var where = Crim.trueAlibi(c.wrongfulAlibi) || 'in the Hole for drunkenness';
    if (!crimeFirst) this.story('The Wrong Name', c.name + ' has been seen in ' + dl + ', alive and careful, and a ballad-seller has a new verse about ' + title + ': ' + who + ' was ' + where + ' that night. The Warrens have known for a week. Now the Market does.', 'danger');
  };

  // The crime a record keeps coming back to: their trade, when the city
  // still has it, else whatever the pool gives.
  P.criminalTrade = function (c) {
    var pool = this.casePool();
    if (c.role && pool.indexOf(c.role) >= 0 && this.rng() < 0.7) return c.role;
    return U.pick(this.rng, pool);
  };

  // One you spared pays a debt: word of a crime before it happens, in the
  // shape of an informer's warning, with no informer behind it.
  P.sparedWarning = function (c) {
    var tid = this.criminalTrade(c);
    var T = CF.CASE_TEMPLATES[tid];
    var district = U.pick(this.rng, T.districts);
    this.s.nextCase = { template: tid, district: district, extraTime: 0, told: false };
    this.s.dispatchT = Math.min(this.s.dispatchT, 40 + this.rng() * 30);
    this.create('intel', {
      label: 'Warning: ' + T.label,
      desc: 'One you spared pays a debt: word from ' + c.name + ' of ' + T.label.toLowerCase() + ' in ' + CF.DISTRICTS[district].label + '. Keep this on the table.',
      data: { kind: 'warning', template: tid, district: district, informant: null, spared: c.id },
    });
    return c.name + ' pays a debt: a warning, not a crime.';
  };

  // Every week: the ones who got away keep working.
  P.criminalsAct = function () {
    var self = this, lines = [];
    this.criminalsAtLarge().forEach(function (c) {
      if (c.traits.indexOf('violent') >= 0) self.meter('retaliation', 1);
      if (c.status === 'hunted' && self.huntStale(c)) c.status = 'at_large';
      if (c.status === 'hunted') return;
      var p = Crim.WEEKLY_CRIME + (c.crimes >= 2 ? 0.1 : 0);
      var fires = self.rng() < p;
      var room = self.roomForCase();
      var canAct = fires && (room || !self.s.nextCase);
      var surfaced = false;
      if (c.hidden) {
        if (!canAct && self.s.week < c.surfaceWeek) return;
        self.surfaceCriminal(c, canAct);
        if (!canAct) return;
        surfaced = true;
      }
      if (!fires) return;
      if (!room && self.s.nextCase) return; // the desk is full and something already waits
      if (c.traits.indexOf('spared') >= 0 && !self.s.nextCase && self.rng() < 0.5) { lines.push(self.sparedWarning(c)); return; }
      c.crimes++;
      c.heat++;
      var spec = { template: self.criminalTrade(c), culpritName: c.name, culpritTrait: c.trait, criminalId: c.id, headline: c.name + ' Again: ', lead: surfaced ? 'The hand is familiar. It should be: somebody else ' + Crim.wrongfulFate(c) + ' it.' : 'The hand is familiar.' };
      self.refreshAtLarge(c);
      if (room) {
        var card = self.spawnCase(spec.template, spec);
        lines.push(c.name + ' has done it again: ' + self.caseRec(card.caseId).title + '.');
      } else {
        // A full desk: the crime waits its turn, and the week says so.
        spec.told = false;
        self.s.nextCase = spec;
        lines.push(c.name + ' has done it again. The Watch-house will hear of it when a desk is clear.');
      }
    });
    return lines;
  };

  // The rank of the culprit behind a case, for the court's demands: one
  // point a rung, at most one for an Examiner's court, none once the
  // Coquille has fallen.
  P.caseRankBonus = function (criminalId) {
    var c = criminalId && this.criminal(criminalId);
    if (!c) return 0;
    if (c.organization === 'syndicate' && this.s.flags.syndicateFallen) return 0;
    var bonus = Crim.rankIndex(c);
    return this.s.rank === 0 ? Math.min(1, bonus) : bonus;
  };
})(typeof window !== 'undefined' ? window : globalThis);
