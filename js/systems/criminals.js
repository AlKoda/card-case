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
  P.refreshAtLarge = function (c) {
    var card = this.atLargeCardFor(c);
    if (!card) return;
    card.data.criminalId = c.id;
    card.data.trait = card.data.trait || c.trait;
    card.label = Crim.rankOf(c).label + ': ' + c.name;
    card.desc = this.criminalDesc(c);
    this.dirty = true;
  };

  // Every week: the ones who got away keep working.
  P.criminalsAct = function () {
    var self = this, lines = [];
    this.criminalsAtLarge().forEach(function (c) {
      if (c.traits.indexOf('violent') >= 0) self.meter('retaliation', 1);
      if (c.status === 'hunted') return;
      var p = Crim.WEEKLY_CRIME + (c.crimes >= 2 ? 0.1 : 0);
      if (self.rng() >= p) return;
      var room = self.roomForCase();
      if (!room && self.s.nextCase) return; // the desk is full and something already waits
      c.crimes++;
      c.heat++;
      var spec = { template: U.pick(self.rng, self.casePool()), culpritName: c.name, culpritTrait: c.trait, criminalId: c.id, headline: c.name + ' Again', lead: 'The hand is familiar.' };
      self.refreshAtLarge(c);
      if (room) {
        var card = self.spawnCase(spec.template, spec);
        lines.push(c.name + ' has done it again: ' + self.caseRec(card.caseId).title + '.');
      } else {
        // A full desk: the crime waits its turn, and the week says so.
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
