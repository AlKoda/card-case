// Sentence: the mercy ladder (docs/CITY.md §6). A conviction does not end
// with the verdict. It makes a Condemned card and lays the rungs of the
// Carolina's ladder beside it; you put one rung in the Sentence verb and
// the Council follows. Every rung has a price, counted in Mercy, Cruelty,
// Dread and the crowd. Say nothing and the Council sentences by custom.
//
//   CF.RUNGS[id]       one rung: label, what it does, what it costs
//   CF.LADDERS[tid]    which rungs a crime allows (lightest first) and the
//                      customary one; `capital` crimes have a Wheel rung
//                      with its own name (the Fire, the Water)
//   s.counts           cruelty, mercy, purse (never go down)
//   criminal.status    at_large | hunted | jailed | dead | banished | reformed
//   criminal.traits    + spared, pilloried, branded
(function (G) {
  var CF = G.CF;
  var U = CF.util;
  var P = CF.Engine.prototype;

  var Sen = (CF.Sentence = {});

  CF.RUNGS = {
    pardon: { label: 'Pardon', short: 'Pardon', icon: 'ilaw-13',
      desc: 'Let them walk, for a reason: youth, penitence, a plea. Mercy. Without a reason the Council frowns, and on a case the crier sang, the crowd mutters.',
      cost: 'Mercy +2 · Suspicion +1 without a reason' },
    fine: { label: 'Fine and Restitution', short: 'A Fine', icon: 'itrade-20',
      desc: 'Coin back to the victim, a fee to the Watch-house, and the poor sinner goes home lighter. They go home and, as far as the city ever learns, stay honest.',
      cost: 'Mercy +1 · 1 Coin' },
    pillory: { label: 'The Pillory', short: 'Pillory', icon: 'ilaw-07',
      desc: 'A day in the square in the iron collar. The crowd is fed, and it learns the face: next time, the quarter knows them at once. They walk, marked; if they do it again the quarter will name them at once.',
      cost: 'Crowd −1' },
    banish: { label: 'Flogging and Banishment', short: 'Banished', icon: 'iinv-17',
      desc: 'Whipped at the cart\'s tail to the gate and forbidden the city for ten years. Some come back.',
      cost: 'Dread +1' },
    brand: { label: 'Branding', short: 'Branded', icon: 'ilaw-24',
      desc: 'The iron on the cheek. A marked man cannot swear before a court, cannot be pardoned again, and has nowhere to go but the Coquille.',
      cost: 'Dread +1 · Cruelty +1' },
    sword: { label: 'The Sword', short: 'The Sword', icon: 'itrade-08',
      desc: 'An honourable death, kneeling, one stroke. For the penitent and the well-born. No band swears vengeance for one who died well.',
      cost: 'Cruelty +1 · Crowd −2' },
    rope: { label: 'The Rope', short: 'The Rope', icon: 'icrime-02',
      desc: 'The gallows on the Ravenstone, before the crowd. For thieves, burglars and receivers.',
      cost: 'Cruelty +1 · Crowd −2 · Vendetta +1' },
    wheel: { label: 'The Wheel', short: 'The Wheel', icon: 'icrime-05',
      desc: 'The spectacle the Carolina keeps for murder with cruelty, arson, coining and poison. The city will remember your name for it. So will the underworld.',
      cost: 'Cruelty +2 · Crowd −3 · Dread +2 · Vendetta +2' },
  };
  Sen.ORDER = ['pardon', 'fine', 'pillory', 'banish', 'brand', 'sword', 'rope', 'wheel'];
  Sen.DEATH = ['sword', 'rope', 'wheel'];

  CF.LADDERS = {
    burglary: { rungs: ['pardon', 'fine', 'pillory', 'banish', 'brand', 'rope'], custom: 'banish', repeat: 'rope' },
    fraud: { rungs: ['pardon', 'fine', 'pillory', 'banish', 'brand'], custom: 'pillory', repeat: 'banish' },
    extortion: { rungs: ['pardon', 'pillory', 'banish', 'brand', 'rope'], custom: 'banish', repeat: 'rope' },
    missing: { rungs: ['pardon', 'banish', 'sword', 'rope'], custom: 'rope' },
    harbor: { rungs: ['pardon', 'sword', 'rope', 'wheel'], custom: 'rope', capital: true },
    arson: { rungs: ['pardon', 'banish', 'sword', 'wheel'], custom: 'wheel', capital: true, wheel: 'The Fire' },
    poison: { rungs: ['pardon', 'sword', 'wheel'], custom: 'wheel', capital: true, wheel: 'The Water' },
    coining: { rungs: ['pardon', 'fine', 'brand', 'wheel'], custom: 'wheel', capital: true, wheel: 'The Fire' },
    manhunt: { rungs: ['pardon', 'banish', 'rope'], custom: 'rope' },
    scriptorium: { rungs: ['pardon', 'banish', 'sword', 'rope'], custom: 'sword' },
    pattern: { rungs: ['pardon', 'sword', 'rope', 'wheel'], custom: 'wheel', capital: true },
    threedays: { rungs: ['pardon', 'banish', 'sword', 'rope'], custom: 'sword' },
    witch: { rungs: ['pardon', 'banish', 'sword', 'wheel'], custom: 'wheel', capital: true, wheel: 'The Fire' },
    highway: { rungs: ['pardon', 'banish', 'rope', 'wheel'], custom: 'rope' },
    contract: { rungs: ['pardon', 'sword', 'rope', 'wheel'], custom: 'wheel', capital: true },
    gang: { rungs: ['pardon', 'banish', 'rope', 'wheel'], custom: 'rope' },
    syndicate: { rungs: ['pardon', 'sword', 'rope', 'wheel'], custom: 'wheel', capital: true },
    architect: { rungs: ['pardon', 'sword', 'rope', 'wheel'], custom: 'rope' },
  };
  Sen.ladderOf = function (tid) { return CF.LADDERS[tid] || CF.LADDERS.burglary; };
  Sen.rungLabel = function (tid, rung) {
    var L = Sen.ladderOf(tid);
    return rung === 'wheel' && L.wheel ? L.wheel : CF.RUNGS[rung].label;
  };
  Sen.rungShort = function (tid, rung) {
    var L = Sen.ladderOf(tid);
    return rung === 'wheel' && L.wheel ? L.wheel : CF.RUNGS[rung].short;
  };

  // A record for anyone the Court has dealt with, whether or not they ever
  // escaped before.
  P.criminalFor = function (name, trait) {
    var c = this.criminalByName(name);
    if (c) return c;
    c = { id: 'k' + this.s.nextUid++, name: name, trait: trait || null, crimes: 1, heat: 0, organization: 'none', traits: [], status: 'jailed', history: [] };
    this.s.criminals[c.id] = c;
    return c;
  };

  // An Abroad card for a criminal the sentence leaves loose in the city.
  P.abroadCard = function (c, why) {
    var card = this.atLargeCardFor(c);
    if (card) { this.refreshAtLarge(c); return card; }
    return this.create('atlarge', {
      label: this.atLargeLabel(c),
      desc: c.name + '. ' + why + ' ' + this.criminalDesc(c),
      data: { name: c.name, trait: c.trait, criminalId: c.id },
    });
  };

  // ---- After the verdict: the Condemned, the ladder, the pleas -------------
  P.condemn = function (rec, d, tier) {
    var s = this.s;
    var L = Sen.ladderOf(rec.template);
    var c = this.criminalByName(d.name);
    var lesser = tier !== 'strong' && !d.solid && !rec.special && d.confession !== 'free';
    var rungs = L.rungs.slice();
    // Half proof convicts of the lesser crime: nothing past banishment.
    if (lesser) rungs = rungs.filter(function (r) { return Sen.ORDER.indexOf(r) <= Sen.ORDER.indexOf('banish'); });
    if (c && c.traits.indexOf('branded') >= 0) rungs = rungs.filter(function (r) { return r !== 'pardon'; });
    var penitent = d.confession === 'free';
    var custom = lesser ? (rungs.indexOf('pillory') >= 0 ? 'pillory' : rungs[rungs.length - 1]) : (c && c.crimes >= 2 && L.repeat ? L.repeat : L.custom);
    var sus = rec.suspects.filter(function (x) { return x.name === d.name; })[0] || {};
    var cond = this.create('condemned', {
      label: d.name,
      desc: d.name + (sus.role ? ', ' + sus.role : '') + ', convicted of ' + rec.title + (lesser ? ' (the lesser crime)' : '') + ', waits in the Hole for your word. ' +
        (penitent ? 'They confessed freely and ask for the Church. ' : '') + 'By custom the Council would give them ' + Sen.rungLabel(rec.template, custom).toLowerCase() + '. Say nothing and it will.',
      caseId: rec.id,
      data: { name: d.name, caseId: rec.id, guilty: !!d.guilty, lesser: lesser, penitent: penitent, custom: custom, template: rec.template,
        highProfile: !!rec.highProfile, trait: sus.trait || null, role: sus.role || '', crimes: c ? c.crimes : 1 },
    });
    var self = this;
    rungs.forEach(function (r) {
      self.create('rung', {
        label: Sen.rungShort(rec.template, r),
        desc: Sen.rungLabel(rec.template, r) + '. ' + CF.RUNGS[r].desc + (r === custom ? ' This is the custom for the crime.' : '') + ' (' + CF.RUNGS[r].cost + ')',
        caseId: rec.id, data: { rung: r, condemned: cond.uid },
      });
    });
    // Pleas arrive with the morning.
    var pleas = [];
    var rng = this.rng;
    if (rng() < (penitent ? 0.8 : 0.25)) pleas.push({ from: 'church', label: 'The Bishop\'s Plea', text: 'The Bishop\'s chaplain writes that ' + d.name + ' has made a good confession and asks mercy for a penitent. The Church counts pardons.' });
    if (['burglary', 'fraud', 'coining', 'extortion'].indexOf(rec.template) >= 0 && rng() < 0.3) pleas.push({ from: 'guild', label: 'The Guild\'s Plea', text: 'The wardens of ' + d.name + '\'s guild ask that a brother be fined and shamed, not hanged. They would remember the favour.' });
    if (rng() < 0.5) {
      var purse = rng() < 0.4;
      pleas.push({ from: 'family', purse: purse, label: 'A Family\'s Plea', text: d.name + '\'s ' + U.pick(rng, ['mother', 'wife', 'brother', 'father', 'sister']) + ' waits at the Watch-house door with a letter for the Examiner.' + (purse ? ' The letter is heavier than paper.' : '') });
    }
    pleas.forEach(function (p) {
      self.create('plea', { label: p.label, desc: p.text + ' Put it in The Court with a lighter rung and it counts as a reason.', caseId: rec.id, data: { from: p.from, purse: !!p.purse, condemned: cond.uid } });
    });
    if (this.inquisitorTakes && this.inquisitorTakes(cond)) return null;
    this.story('Condemned: ' + d.name, d.name + ' goes down to the Hole to wait. The ladder is on your desk: ' + rungs.map(function (r) { return Sen.rungShort(rec.template, r); }).join(', ') + '. The Council will follow your word, or its custom.' +
      (pleas.length ? ' Pleas arrive with the morning: ' + pleas.map(function (p) { return p.label; }).join(', ') + '.' : ''), 'major');
    return cond;
  };

  // ---- Passing sentence ------------------------------------------------------
  // Returns { title, text }. `plea` is a plea card or a token of penitence (a
  // free confession) or null.
  P.passSentence = function (cond, rung, plea, opts) {
    opts = opts || {};
    var s = this.s, d = cond.data, notes = [];
    var rec = this.caseRec(d.caseId) || { template: d.template, title: 'the case', highProfile: d.highProfile, special: false };
    var L = Sen.ladderOf(d.template);
    var c = this.criminalFor(d.name, d.trait);
    var name = d.name;
    var lighter = Sen.ORDER.indexOf(rung) < Sen.ORDER.indexOf(d.custom);
    var reason = !!plea || d.penitent;
    var byCouncil = !!opts.byCouncil;
    var self = this;
    var count = function (k, n) { if (!byCouncil) self.count(k, n); };
    var title = Sen.rungLabel(d.template, rung) + ': ' + name;
    var text = '';

    // A purse inside a plea, taken for a lighter rung, is a bribe.
    if (plea && plea.def === 'plea' && plea.data.purse && lighter) {
      this.create('funds'); this.create('funds');
      this.count('purse', 1);
      notes.push('The letter had two Coin folded in it. You kept them.');
    }
    if (plea && plea.def === 'plea' && plea.data.from === 'church' && Sen.DEATH.indexOf(rung) >= 0) notes.push('The Bishop\'s chaplain will remember that you were asked.');

    switch (rung) {
      case 'pardon':
        count('mercy', 2);
        s.stats.sentHome = (s.stats.sentHome || 0) + 1;
        if (!reason && !byCouncil) { this.meter('scrutiny', 1); notes.push('The Council asks, in writing, why. You have no answer it will like.'); }
        if (d.highProfile) { this.meter('pressure', 1); notes.push('The crowd that came for a hanging goes home puzzled.'); }
        var reformed = this.rng() < (reason ? 0.75 : 0.5);
        if (!d.guilty) { reformed = true; notes.push('They were innocent. They do not know that you know.'); }
        if (reformed) {
          c.status = 'reformed';
          var alc = this.atLargeCardFor(c);
          if (alc) this.remove(alc);
          text = name + ' walks out of the Hole into the Market and does not look back. A year from now they keep a stall in the Abbey Close, and a family, and they cross the street when they see you.';
        } else {
          c.status = 'at_large';
          if (c.traits.indexOf('spared') < 0) c.traits.push('spared');
          if (this.rng() < 0.35) {
            var inf = this.create('informant', this.informantSpec(rec.district || U.pick(this.rng, Object.keys(CF.DISTRICTS))));
            inf.label = 'Informer: ' + name.split(' ')[1];
            inf.data.name = name;
            inf.data.trust = 1;
            text = name + ' knows what a pardon costs and what it is worth. A week later they are waiting on the Informers\' Bench with something to sell. They owe you, and they know it.';
          } else {
            this.abroadCard(c, 'Pardoned by the Examiner, and the underworld knows it.');
            text = name + ' walks. The Coquille hears of it before the bell. The spared owe the Examiner, and everybody knows to whom.';
          }
        }
        break;
      case 'fine':
        count('mercy', 1);
        s.stats.sentHome = (s.stats.sentHome || 0) + 1;
        this.create('funds');
        c.status = 'reformed';
        text = name + ' pays what they can and works off the rest. The victim gets their goods back, the Watch-house gets its fee, and the Market Warden nods.';
        break;
      case 'pillory':
        this.meter('pressure', -1);
        if (c.traits.indexOf('pilloried') < 0) c.traits.push('pilloried');
        c.status = 'at_large';
        this.abroadCard(c, 'Pilloried, and known by every quarter.');
        text = 'A day in the collar in the Market, with the turnips. By evening every quarter knows ' + name + '\'s face. If they are seen near a crime again, they will be named at once.';
        break;
      case 'banish':
        this.meter('dread', 1);
        c.status = 'banished';
        c.returnWeek = s.week + U.randInt(this.rng, 4, 9);
        var alb = this.atLargeCardFor(c);
        if (alb) this.remove(alb);
        text = name + ' is whipped at the cart\'s tail to the Harbour gate and forbidden the city for ten years. The gate shuts. Some of them come back.';
        break;
      case 'brand':
        this.meter('dread', 1);
        count('cruelty', 1);
        if (c.traits.indexOf('branded') < 0) c.traits.push('branded');
        c.status = 'at_large';
        c.organization = 'gang';
        this.abroadCard(c, 'Branded on the cheek by your sentence.');
        text = 'The iron, the smell, the mark on the cheek. ' + name + ' can never swear before a court again, and no honest master will take them. Within the month they are sworn to a band. You made a Coquillard.';
        break;
      case 'sword':
        count('cruelty', 1);
        this.meter('pressure', d.highProfile ? -2 : -1);
        if (L.capital && d.custom === 'wheel') { count('mercy', 1); notes.push('Commuted from ' + Sen.rungLabel(d.template, 'wheel').toLowerCase() + ', out of mercy. The Bishop approves.'); }
        c.status = 'dead';
        text = 'The judge breaks the white staff over the head of ' + name + '. At first light they kneel on the Ravenstone and it is over in one stroke. A good death, the crowd says. Nobody swears vengeance for one who died well.';
        break;
      case 'rope':
        count('cruelty', 1);
        this.meter('pressure', -2);
        this.meter('retaliation', 1);
        c.status = 'dead';
        text = 'The staff is broken. ' + name + ' hangs on the Ravenstone before the whole city, and the ballad-sellers have the verses printed by nones. ' + (c.organization !== 'none' ? 'Their band drinks to them in a cellar and to you in a different tone.' : 'The crowd goes home satisfied.');
        break;
      case 'wheel':
        count('cruelty', 2);
        this.meter('pressure', -3);
        this.meter('dread', 2);
        this.meter('retaliation', 2);
        c.status = 'dead';
        text = 'The staff is broken, and ' + Sen.rungLabel(d.template, 'wheel').toLowerCase() + ' follows, before the whole city. It takes most of the morning. The crowd is very quiet by the end, and so is the Market for a week after. The underworld learns your name from it.';
        break;
    }
    if (!d.guilty && rec.id) this.wrongfulSentenced(rec, rung);
    if (!d.guilty && Sen.DEATH.indexOf(rung) >= 0) {
      this.meter('dread', 1);
      notes.push('Somebody in the crowd shouts that the wrong one is dying. Somebody always does. This time they are right.');
    }
    c.history.push({ week: s.week, how: 'sentence:' + rung });
    if (this.commissionSentence && !byCouncil) this.commissionSentence(this.caseRec(d.caseId), rung, notes);
    if (byCouncil) notes.unshift('You said nothing, so the Council said it for you.');
    // A sentence passed in your own voice on a case the whole city watched is Standing.
    if (!byCouncil && d.highProfile) { this.meter('reputation', 1); notes.push('The city saw you pass the sentence yourself, on a case the crier sang.'); }

    // The ladder, the pleas and the poor sinner leave the table together.
    var self = this;
    this.cardsOf('rung', true).concat(this.cardsOf('plea', true)).forEach(function (x) { if (x.data.condemned === cond.uid) self.remove(x); });
    if (this.card(cond.uid)) this.remove(cond);
    var story = { title: title, text: (text + ' ' + notes.join(' ')).trim() };
    if (!opts.quiet) this.story(story.title, story.text, Sen.DEATH.indexOf(rung) >= 0 ? 'danger' : 'minor');
    return story;
  };

  // The Condemned card ran out: the Council sentences by custom.
  P.defaultSentence = function (cond) {
    this.passSentence(cond, cond.data.custom, null, { byCouncil: true });
  };

  // Banished men come back, sometimes.
  P.banishedReturn = function () {
    var s = this.s, lines = [], self = this;
    Object.keys(s.criminals).forEach(function (k) {
      var c = s.criminals[k];
      if (c.status !== 'banished' || !c.returnWeek || s.week < c.returnWeek) return;
      if (self.rng() < 0.5) {
        c.status = 'at_large';
        c.crimes++;
        self.abroadCard(c, 'Back from banishment. Hangs if caught.');
        lines.push(c.name + ', banished, is back inside the walls. The banished who come back hang if caught, and know it.');
      } else c.returnWeek = s.week + 3;
    });
    return lines;
  };
})(typeof window !== 'undefined' ? window : globalThis);
