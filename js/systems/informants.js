// Informants (roadmap Phase 12): street contacts who bring intelligence
// before the city does, if they are paid, protected and trusted. Ignore
// them and they go quiet; lean on them and they get burned.
//
// An informant card carries data { name, district, heat, trust, tipT }.
//   trust 0–3   how often they talk (a tip every 80 − 15·trust seconds)
//   heat        every meeting adds one; at 3 they are Compromised and go
//               quiet; Retaliation picks them first. Protect them in Duty
//               with an officer to reset it.
// Tips are cards: a Rumor (a clue about an open case, with the culprit's
// description), a Sighting (an At Large criminal: bring it to Reflect with
// their card to start a manhunt), or a Warning (a crime that is about to
// happen: the next case comes with more time and a first suspect).
(function (G) {
  var CF = G.CF;
  var U = CF.util;
  var P = CF.Engine.prototype;

  CF.INFORMANT = { compromisedAt: 3, burnedAt: 5, tipEvery: 80, tipTrustBonus: 15, warningExtraTime: 60, firstTip: 35 };

  P.informantStatus = function (card) {
    var heat = card.data.heat || 0;
    return heat >= CF.INFORMANT.burnedAt ? 'burned' : heat >= CF.INFORMANT.compromisedAt ? 'compromised' : 'safe';
  };
  P.informantInterval = function (card) {
    return Math.max(30, Math.round((CF.INFORMANT.tipEvery - CF.INFORMANT.tipTrustBonus * (card.data.trust || 0)) * (this.perkHas('whisperer') ? 0.7 : 1)));
  };
  P.trustInformant = function (card, delta) {
    card.data.trust = U.clamp((card.data.trust || 0) + delta, 0, 3);
    if (card.data.trust >= 3) this.s.flags.trusted = true;
  };
  // Heat rises with every meeting. The day it crosses to Compromised, you are told.
  P.heatInformant = function (card, delta) {
    var was = this.informantStatus(card);
    card.data.heat = Math.max(0, (card.data.heat || 0) + delta);
    var st = this.informantStatus(card);
    card.label = (st === 'compromised' ? 'Compromised: ' : 'Informer: ') + card.data.name;
    if (delta > 0 && was === 'safe' && st === 'compromised') {
      this.story('Marked: ' + card.data.name, 'Somebody in the Warrens has asked, by name, who ' + card.data.name + '\'s friend at the Watch-house is. They stop coming to the bench. Guard them in Attend with a watchman, or the next time they are asked it will not be politely.', 'danger');
    }
    this.dirty = true;
  };

  // Called from the clock. Informants on the table talk on their own time.
  P.tickInformants = function (dt) {
    var self = this;
    this.cardsOf('informant').forEach(function (c) {
      if (c.loc.t !== 'table' || self.informantStatus(c) !== 'safe') return;
      if (c.data.tipT === undefined) c.data.tipT = CF.INFORMANT.firstTip;
      c.data.tipT -= dt;
      if (c.data.tipT <= 0) {
        c.data.tipT = self.informantInterval(c);
        self.informantTip(c);
      }
    });
  };

  // What an informant has heard this time.
  P.informantTip = function (inf) {
    var nick = inf.data.name;
    var open = this.openCases().filter(function (r) { return !r.identified && !r.special; });
    var self0 = this, al = this.cardsOf('atlarge').filter(function (c) { return c.loc.t === 'table' && !c.data.sighted && self0.huntable(c); });
    var roll = this.rng();
    if (open.length && roll < 0.45) {
      var rec = U.pick(this.rng, open);
      var cul = rec.suspects.filter(function (x) { return x.guilty; })[0];
      this.create('clue', this.clueSpec(rec, {
        label: 'Rumour from ' + nick,
        text: nick + ' heard something about ' + rec.title + ': "' + CF.TRAIT_SEEN[cul.trait] + '"',
        aspects: { testimony: 1 }, trait: cul.trait,
      }, [], { noMisread: true }));
      this.story('A Word from ' + nick, 'A folded paper pushed under the Watch-house door, about ' + rec.title + '. ' + nick + ' does not sign things.', 'minor');
      return 'rumor';
    }
    if (al.length && roll < 0.75) {
      // The hotter the record, the more often they are seen.
      var self = this;
      var weights = al.map(function (c) { var r = c.data.criminalId ? self.criminal(c.data.criminalId) : self.criminalByName(c.data.name); return 1 + (r ? r.heat || 0 : 0); });
      var total = weights.reduce(function (a, w) { return a + w; }, 0);
      var pickRoll = this.rng() * total, target = al[al.length - 1];
      for (var wi = 0; wi < al.length; wi++) { pickRoll -= weights[wi]; if (pickRoll <= 0) { target = al[wi]; break; } }
      target.data.sighted = true;
      this.create('intel', {
        label: 'Sighting: ' + target.data.name,
        desc: nick + ' has seen ' + target.data.name + ' in ' + CF.DISTRICTS[inf.data.district].label + '. Bring this to Rest with their Abroad card to raise the hue and cry. It will not stay true for long.',
        data: { kind: 'sighting', criminal: target.data.name, informant: inf.uid },
      });
      this.story('A Sighting', nick + ' has seen ' + target.data.name + '. "Same tavern every night. Ask me how I know."', 'minor');
      return 'sighting';
    }
    // A warning: something is about to happen. One at a time.
    if (this.s.nextCase) return null;
    var spec = this.warnOfCase(inf, 0);
    this.create('intel', spec);
    this.story('A Warning', '"' + CF.CASE_TEMPLATES[spec.data.template].label + '," says ' + nick + ', "in ' + CF.DISTRICTS[spec.data.district].label + '. Soon. Don\'t ask me how I know."', 'minor');
    return 'warning';
  };

  // What a paid meeting with an informer can give now, for the preview and
  // the run: 'word' (a case on the desk with no name yet), 'sighting'
  // (someone Abroad, and room on the desk), 'warning' (nothing queued yet),
  // 'quarter' (where the queued case will come from, once), or null when
  // they have nothing: the meeting is refused and nothing is spent.
  // { kind, open: [unnamed case records], sight: bool }.
  P.informerOffer = function () {
    var e = this;
    var open = this.openCases().filter(function (r) { return !r.identified && !r.special; });
    var al = this.cardsOf('atlarge').filter(function (c) { return e.huntable(c); });
    var sight = al.length > 0 && this.roomForCase(1);
    var next = this.s.nextCase;
    var kind = open.length ? 'word' : sight ? 'sighting' : !next ? 'warning' : !next.told ? 'quarter' : null;
    return { kind: kind, open: open, sight: sight, atlarge: al };
  };

  // Queue the next case on an informer's word (it comes sooner, and with
  // `extraTime` it comes even to a full desk) and build the Warning card.
  P.warnOfCase = function (inf, extraTime) {
    var tid = U.pick(this.rng, this.casePool());
    var T = CF.CASE_TEMPLATES[tid];
    var district = U.pick(this.rng, T.districts);
    this.s.nextCase = { template: tid, district: district, extraTime: extraTime || 0 };
    this.s.dispatchT = Math.min(this.s.dispatchT, 40 + this.rng() * 30);
    return {
      label: 'Warning: ' + T.label,
      desc: inf.data.name + ' says something is going to happen in ' + CF.DISTRICTS[district].label + ': ' + T.label.toLowerCase() + '. Keep this on the table. When the case comes in you will be ahead of it.',
      data: { kind: 'warning', template: tid, district: district, informant: inf.uid },
    };
  };

  // A warning on the table (or waiting in a verb's output) for this case,
  // if any: the case arrives with more time and a name already on the board.
  P.warningFor = function (templateId) {
    return this.cardsOf('intel').filter(function (c) { return (c.loc.t === 'table' || c.loc.t === 'out') && c.data.kind === 'warning' && c.data.template === templateId; })[0] || null;
  };

  // An informant is burned: gone, and if they were already compromised the
  // city has a new missing person.
  P.burnInformant = function (card, text) {
    var was = this.informantStatus(card);
    var name = card.data.name;
    this.remove(card);
    this.story('An Informer Is Burned', text, 'danger');
    if (was === 'compromised' && this.roomForCase(1)) {
      this.spawnCase('missing', { victim: name, headline: 'Vanished: ' + name, lead: 'Nobody has seen ' + name + ' since the night they were questioned.', extraTime: 30 });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
