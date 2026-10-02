// Recipes: what each verb does with the cards in its slots. The first recipe
// (by priority, then file order) whose requirements pass is the one the verb
// will run. See js/core/recipes.js for the fields. Simple recipes are pure
// data (requires + effects); the ones with branching prose keep a run().
(function (G) {
  var CF = G.CF;
  var U = CF.util;
  // Ways renamed since a save was written: old id -> new id, so a running verb finishes under the new name.
  CF.RECIPE_ALIAS = {};

  function A(card) { return card ? CF.aspectsOf(card) : {}; }
  function openRec(ctx, card) {
    var rec = ctx.caseOf(card);
    return rec && rec.status === 'open' ? rec : null;
  }
  function closed(what) {
    return { title: 'Too Late', text: 'By the time you get to it, ' + (what || 'the case') + ' is no longer open. The moment has passed.' };
  }
  function maybe(ctx, p, defId) {
    if (defId === 'fatigue' && ctx.e.teamHas(ctx, 'steady')) return false;
    if (ctx.rng() < p) { ctx.give(defId); return true; }
    return false;
  }
  function trait(id) { return CF.TRAITS.filter(function (t) { return t.id === id; })[0]; }
  function culpritOf(rec) { return rec.suspects.filter(function (x) { return x.guilty; })[0]; }
  function slotClues(ctx, keys) {
    return keys.map(function (k) { return ctx.slots[k]; }).filter(function (c) { return c && A(c).clue; });
  }
  function aspectList(keys) {
    return keys.map(function (k) { return CF.ASPECTS[k].label; }).join(', ').replace(/, ([^,]*)$/, ' and $1');
  }
  function suiteBonus(e, spec) {
    if (e.s.rooms.suite && spec.aspects) spec.aspects.testimony = (spec.aspects.testimony || 0) + 1;
    return spec;
  }
  function needsLabel(need) {
    return { prints: 'the Vinegar and Umbrella', bio: 'a Physician\'s Case', lab: 'the Apothecary\'s Key' }[need];
  }
  function evidenceSpec(rec, item) {
    var needs = item.needs ? ' Needs ' + needsLabel(item.needs) + ' to analyse properly.' : '';
    return { label: item.label, desc: item.text + ' Take it to Study.' + needs + ' (Raw proof in: ' + rec.title + ')', caseId: rec.id, data: { item: item } };
  }
  // Draw the next unfound item from a case's scene pool into the verb output.
  function drawItem(ctx, rec, helpers) {
    var item = rec.items[rec.found];
    if (!item) return null;
    rec.found++;
    if (item.type === 'clue') ctx.give('clue', ctx.e.clueSpec(rec, item, helpers));
    else ctx.give('evidence', evidenceSpec(rec, item));
    return item;
  }
  function identify(ctx, rec, key) {
    var e = ctx.e;
    rec.identified = key;
    var sus = rec.suspects.filter(function (x) { return x.key === key; })[0];
    var existing = null;
    for (var k in e.s.cards) {
      var c = e.s.cards[k];
      if (c.def === 'suspect' && c.caseId === rec.id && c.data.key === key) existing = c;
    }
    if (existing) existing.label = 'Prime Suspect: ' + sus.name;
    else if (!sus.cleared) e.revealSuspect(rec, ctx, { key: key });
    return sus;
  }

  var R = [];

  // ===================================================================== DUTY
  R.push({
    id: 'duty_promo', verb: 'duty', label: 'Attend on the Council', duration: 45,
    preview: 'Put on a clean collar. Answer their questions. Try not to say what you actually think.',
    requires: ['promotion'],
    run: function (ctx) {
      var e = ctx.e, s = e.s;
      ctx.consume(ctx.primary);
      var unlocked = e.promote();
      var rank = e.rankDef();
      ctx.give('personnel', e.personnelSpec(['rookie', 'tech', 'interviewer', 'veteran'][s.rank] || 'veteran'));
      ctx.give('funds'); ctx.give('funds');
      return { title: 'Promoted: ' + rank.label, kind: 'major',
        text: (rank.scene ? rank.scene + ' ' : '') + 'You are now ' + rank.label + '. ' + rank.text +
          (unlocked.length ? ' New tools are open to you: ' + unlocked.join(', ') + '.' : '') + ' The Council will send you up to ' + e.maxOpenCases() + ' cases at once, and pay ' + rank.salary + ' a week.' };
    },
  });
  R.push({
    id: 'duty_chair', verb: 'duty', label: 'Stand Before the Council', duration: 60,
    preview: 'The Council will weigh your Standing, and look hard at the Crowd and at Suspicion. Both should be 4 or lower.',
    requires: ['chair'],
    run: function (ctx) {
      var e = ctx.e, m = e.s.meters;
      ctx.consume(ctx.primary);
      if (m.pressure <= 4 && m.scrutiny <= 4) {
        e.gameOver('commissioner');
        return { title: 'The Vote', text: 'The Council votes.', kind: 'victory' };
      }
      e.meter('reputation', -4);
      return { title: 'Passed Over', kind: 'danger',
        text: 'The Council thanks you for your service and chooses someone else. ' + (m.pressure > 4 ? 'The city is too restless. ' : '') + (m.scrutiny > 4 ? 'There are rumours about your methods. ' : '') + 'There will be another vote, if you earn it again.' };
    },
  });
  R.push({
    id: 'duty_bribe', verb: 'duty', label: 'Pocket the Purse', duration: 5,
    preview: 'Nobody would ever know. Except the people who left it. And the Council, eventually.',
    danger: 'Suspicion +2',
    requires: ['bribe'],
    effects: [
      { consume: 'primary' }, { give: 'funds', n: 3 }, { meter: { scrutiny: 2 } },
      { story: { title: 'Pocketed', text: 'Three weeks\' stipend in worn silver. It sits in your coat like a stone. Somewhere, somebody writes your name in a ledger.' } },
    ],
  });
  R.push({
    id: 'duty_writsale', verb: 'duty', label: 'Sell a Writ', duration: 10,
    preview: function (ctx) { var d = ctx.primary.data; return 'Find cause where there is none and have ' + d.rival + '\'s house turned over at first light. Three Coin, and a patrician who owes you.' + (d.council ? ' The rival is a Council family; the Council will hear of it.' : ''); },
    danger: function (ctx) { return 'Purse +1 · Suspicion +' + (ctx.primary.data.council ? 2 : 1); },
    requires: ['writsale'],
    run: function (ctx) {
      var e = ctx.e, d = ctx.primary.data;
      ctx.consume(ctx.primary);
      for (var i = 0; i < 3; i++) ctx.give('funds');
      e.count('purse', 1);
      e.meter('scrutiny', d.council ? 2 : 1);
      return { title: 'The Writ Is Sold', text: 'A sergeant breaks ' + d.rival + '\'s door at first light on a writ that names no crime. Nothing is found, because there was nothing to find. The patrician sends three Coin and a haunch of venison.' + (d.council ? ' Somebody on the Council asks who sealed the writ.' : '') };
    },
  });
  R.push({
    id: 'duty_thieftakers', verb: 'duty', label: 'Hire the Thief-takers', duration: 25,
    preview: function (ctx) {
      var rec = ctx.caseOf(ctx.primary);
      return 'For 2 Coin the thief-takers get the goods back' + (rec ? ' from ' + rec.title.toLowerCase() : '') + ' and name a culprit, without a trial. They know every fence in the city; that is the trouble with them. Some of what they bring back is a frame.';
    },
    danger: 'Purse +1 · Underworld Debt +1',
    blocked: function (ctx) {
      if (!ctx.e.s.rooms.thieftakers) return 'Petition for the Thief-takers\' Office first.';
      return ctx.count('funds') >= 2 ? null : 'This takes 2 Coin.';
    },
    requires: ['case'], forbids: ['teammate', 'focus'],
    run: function (ctx) {
      var e = ctx.e;
      var rec = openRec(ctx, ctx.primary);
      if (!rec) return closed();
      ctx.with('funds').slice(0, 2).forEach(ctx.consume);
      return e.thieftakersSettle(rec, ctx);
    },
  });
  R.push({
    id: 'duty_train', verb: 'duty', label: 'Drill a Watchman', duration: 60,
    preview: 'The yard, the halberd, the sergeant\'s tongue. They will come back sharper.',
    blocked: { funds: function (ctx) { return ctx.e.s.rooms.training ? 1 : 2; } },
    requires: { primary: 'teammate', aspects: ['funds'] },
    run: function (ctx) {
      var e = ctx.e, t = ctx.primary;
      ctx.with('funds').slice(0, e.s.rooms.training ? 1 : 2).forEach(ctx.consume);
      var a = t.aspects;
      var best = Object.keys(a).sort(function (x, y) { return a[y] - a[x]; })[0];
      a[best]++;
      t.data.level = (t.data.level || 1) + 1;
      var titles = ['', '', 'Senior ', 'Lead ', 'Chief '];
      t.label = (titles[Math.min(4, t.data.level)] || 'Chief ') + t.data.role + ' ' + t.data.name.split(' ')[1];
      var learned = null;
      if (e.s.rooms.training && t.data.level >= 3) {
        var pool = Object.keys(CF.OFFICER_TRAITS).filter(function (k) { return (t.data.traits || []).indexOf(k) < 0; });
        if (pool.length) { learned = U.pick(ctx.rng, pool); t.data.traits = (t.data.traits || []).concat([learned]); }
      }
      return { title: 'Drilled', text: t.data.name + ' comes back from the yard bruised and with a new confidence. Their ' + CF.ASPECTS[best].label + ' is now ' + a[best] + '.' +
        (learned ? ' And something else: they are ' + CF.OFFICER_TRAITS[learned].label.toLowerCase() + ' now. ' + CF.OFFICER_TRAITS[learned].desc : '') };
    },
  });
  R.push({
    id: 'duty_protect', verb: 'duty', label: 'Guard an Informer', duration: 30,
    preview: function (ctx) { return ctx.has('teammate') ? 'A watchman stands at their door for a week. The heat comes off them.' : 'Add a watchman to stand at their door.'; },
    blocked: function (ctx) { return ctx.has('teammate') ? null : 'Someone has to do the standing: add a watchman.'; },
    requires: { primary: 'informant' },
    run: function (ctx) {
      var e = ctx.e, inf = ctx.primary, guard = ctx.first('teammate');
      // The officer can be pulled off the job mid-week (Retaliation).
      if (!guard) return { title: 'Nobody Watching', text: 'The watchman you posted never got to the door. ' + inf.data.name + ' spends the week alone.' };
      inf.data.heat = 0;
      e.heatInformant(inf, 0);
      e.trustInformant(inf, 1);
      return { title: 'Watched Over', text: guard.data.name + ' spends a week on a stool outside ' + inf.data.name + '\'s door. Nobody comes. ' + inf.data.name + ' starts sleeping again.' };
    },
  });
  R.push({
    id: 'duty_post_watch', verb: 'duty', label: 'Post the Watch', duration: 30,
    preview: 'A watchman on the cellar stair every night for a week. The band drinks elsewhere, and somebody is seen going home.',
    requires: { primary: 'gang', aspects: ['teammate'] },
    run: function (ctx) {
      var e = ctx.e, band = ctx.primary, guard = ctx.first('teammate');
      e.meter('retaliation', -1);
      var sworn = e.cardsOf('atlarge').filter(function (c) { return c.data.band === band.data.name && !(c.data.hunted && e.caseRec(c.data.hunted) && e.caseRec(c.data.hunted).status === 'open'); });
      if (sworn.length && ctx.rng() < 0.4 && e.roomForCase(1)) {
        var al = U.pick(ctx.rng, sworn);
        var card = e.spawnCase('manhunt', { ctx: ctx, culpritName: al.data.name, culpritTrait: al.data.trait, atLargeUid: al.uid, criminalId: al.data.criminalId,
          headline: 'Sighting: ' + al.data.name, lead: 'Your watchman followed one of them home.' });
        al.data.hunted = card.caseId;
        var crim = al.data.criminalId && e.criminal(al.data.criminalId);
        if (crim) crim.status = 'hunted';
        return { title: 'Followed Home', text: (guard.data.name || e.labelOf(guard)) + ' stands on the stair until the band stops coming, and follows ' + al.data.name + ' home. The Hue and Cry can be raised.' };
      }
      return { title: 'Watched', text: 'The band drinks somewhere else this week. The Vendetta cools a little, and nobody is caught.' };
    },
  });
  // A watchman on the round earns the fee, and the round hears things: now
  // and then a word about an open case, now and then the desk left to you.
  R.push({
    id: 'duty_team', verb: 'duty', label: 'Put Them on the Round', duration: 45,
    preview: 'They walk a round in your name. The fee comes to you, and sometimes what the round hears.',
    requires: { primary: 'teammate' }, forbids: ['funds'],
    run: function (ctx) {
      var e = ctx.e, name = ctx.primary.data.name || e.labelOf(ctx.primary);
      ctx.give('funds');
      var open = e.openCases().filter(function (r) { return !r.identified && !r.special; });
      var roll = ctx.rng();
      if (open.length && roll < 0.3) {
        var rec = U.pick(ctx.rng, open), cul = culpritOf(rec);
        ctx.give('clue', e.clueSpec(rec, {
          label: 'Heard on the Round',
          text: name + ' heard it at the conduit, about ' + rec.title + ': "' + CF.TRAIT_SEEN[cul.trait] + '"',
          aspects: { testimony: 1 }, trait: cul.trait,
        }, [], { noMisread: true }));
        return { title: 'A Round Walked', text: 'The round hears things: a word about ' + rec.title + '.' };
      }
      if (roll >= 0.3 && roll < 0.4) {
        ctx.give('fatigue');
        return { title: 'A Round Walked', text: 'You covered the desk yourself while they walked.' };
      }
      return { title: 'A Round Walked', text: name + ' walks the round without complaint. The Council\'s ledger reads your name.' };
    },
  });
  R.push({
    id: 'duty_file', verb: 'duty', label: 'Enter the Rolls', duration: 15,
    preview: 'Every examination written fair. Every deposition marked. The Council loves a tidy book.',
    requires: { primary: 'focus', aspects: ['paperwork'] },
    effects: [
      { consume: 'paperwork', n: 1 }, { meter: { scrutiny: -1 } }, { give: 'funds' },
      { story: { title: 'Entered', text: 'Four hours with the quill. By the end, even the parts that were not quite by the Carolina read as if they were.' } },
    ],
  });
  R.push({
    id: 'duty_desk', verb: 'duty', label: 'Keep the Day-book', duration: 20,
    preview: 'Sit at the desk. Take depositions. Earns a little, costs little.',
    requires: { primary: 'focus' },
    effects: [
      { give: 'funds' },
      { story: { title: 'The Day-book', text: ['A woman reports her husband missing. He is at the Red Ox. You find him in ten minutes.',
        'A boy brings in a purse he found. Every coin still in it. You buy him a pie.',
        'Forty people come to the desk. Thirty-nine of them are nothing.'] } },
    ],
  });
  R.push({
    id: 'duty_beat', verb: 'duty', label: 'Walk the Hard Round', duration: 60,
    preview: 'Walk the round with the halberd, part brawlers, earn your fee. Pays better than the desk. Tiring.',
    danger: 'May cause Weariness',
    requires: { primary: 'health' },
    effects: [
      { give: 'funds', n: 2 },
      { story: { title: 'The Round', text: ['Two drunks, a stolen goose and a lost dog. The dog was the most reasonable of them.',
        'You spend six hours on your feet in the rain outside the bear-garden.',
        'A stallholder shakes your hand. A boy spits at your boots. An ordinary round.'] } },
      { chance: 0.55, then: [{ give: 'fatigue' }, { call: function (ctx) { ctx.result.text += ' Your feet ache all the way up to your skull.'; } }] },
    ],
  });

  // =================================================================== PATROL
  R.push({
    id: 'patrol_informant_nopay', verb: 'investigate', src: 'patrol', label: 'Meet an Informer', duration: 5,
    preview: 'Informers do not talk for nothing.',
    blocked: 'Add Coin to pay them.',
    requires: { primary: 'informant' }, forbids: ['funds'],
  });
  R.push({
    id: 'patrol_informant', verb: 'investigate', src: 'patrol', label: 'Meet an Informer', duration: 15,
    preview: 'A quiet word in a back booth of the Red Ox, and a purse passed under the table. Every meeting puts them at more risk.',
    requires: { primary: 'informant', aspects: ['funds'] },
    run: function (ctx) {
      var e = ctx.e, inf = ctx.primary;
      ctx.consume(ctx.first('funds'));
      e.heatInformant(inf, 1);
      e.trustInformant(inf, 1);
      var nick = inf.data.name;
      var open = e.openCases().filter(function (r) { return !r.identified && !r.special; });
      var al = e.cardsOf('atlarge').filter(function (c) { return !c.data.hunted || !e.caseRec(c.data.hunted) || e.caseRec(c.data.hunted).status !== 'open'; });
      if (open.length && ctx.rng() < 0.7) {
        var rec = U.pick(ctx.rng, open);
        var cul = culpritOf(rec);
        ctx.give('clue', e.clueSpec(rec, {
          label: 'Word from ' + nick,
          text: nick + ' says, about ' + rec.title + ': "' + CF.TRAIT_SEEN[cul.trait] + '"',
          aspects: { testimony: 2, motive: 1 },
          trait: cul.trait,
        }));
        return { title: 'A Word', text: nick + ' counts the coin twice before talking. It is worth it. They know something about ' + rec.title + '.' };
      }
      if (al.length && ctx.rng() < 0.5 && e.roomForCase(1)) {
        var target = U.pick(ctx.rng, al);
        var hunt = e.spawnCase('manhunt', { ctx: ctx, culpritName: target.data.name, culpritTrait: target.data.trait, atLargeUid: target.uid, criminalId: target.data.criminalId,
          headline: 'Sighting: ' + target.data.name, lead: nick + ' has seen ' + target.data.name + '.' });
        target.data.hunted = hunt.caseId;
        return { title: 'A Sighting', text: nick + ' leans in. "' + target.data.name + '. I know where they sleep."' };
      }
      // A word ahead: the next case is queued, and comes even to a full desk. One at a time.
      if (!e.s.nextCase) {
        var warn = e.warnOfCase(inf, 90);
        warn.desc += ' It will come even to a full desk.';
        ctx.give('intel', warn);
        return { title: 'Ahead of the Crier', text: '"Something is going to happen," says ' + nick + '. "Soon." Keep the warning on the table: when it comes, you will be ready for it.' };
      }
      if (open.length) {
        var rec2 = U.pick(ctx.rng, open);
        var cul2 = culpritOf(rec2);
        ctx.give('clue', e.clueSpec(rec2, {
          label: 'Word from ' + nick,
          text: nick + ' says, about ' + rec2.title + ': "' + CF.TRAIT_SEEN[cul2.trait] + '"',
          aspects: { testimony: 2, motive: 1 },
          trait: cul2.trait,
        }));
        return { title: 'A Word', text: nick + ' counts the coin twice before talking. It is worth it. They know something about ' + rec2.title + '.' };
      }
      return { title: 'Nothing Tonight', text: nick + ' takes the coin and has nothing for it. "Next week," they say.' };
    },
  });
  R.push({
    id: 'patrol_district', verb: 'investigate', src: 'patrol', label: 'Work the Quarter', duration: 45,
    preview: function (ctx) { return 'Knock on doors in ' + ctx.e.labelOf(ctx.first('district')) + '. Stand a round. Listen.'; },
    requires: { primary: ['instinct', 'health'], aspects: ['district'] },
    run: function (ctx) {
      var e = ctx.e;
      var dcard = ctx.first('district');
      var d = dcard.data.district;
      var dl = CF.DISTRICTS[d].label;
      var cases = e.openCases().filter(function (r) { return r.district === d && !r.special; });
      if (ctx.has('health')) { ctx.give('funds'); maybe(ctx, 0.5, 'fatigue'); } else maybe(ctx, 0.2, 'fatigue');
      if (cases.length) {
        var rec = U.pick(ctx.rng, cases);
        if (rec.witnesses.length) {
          var w = ctx.give('witness', e.witnessSpec(rec));
          return { title: 'Word in the Quarter', text: 'In ' + dl + ' everyone has heard about ' + rec.title + '. One of them saw more than gossip: ' + w.label.replace('Witness: ', '') + '.' };
        }
        if (e.revealSuspect(rec, ctx)) return { title: 'A Name', text: 'A tapster in ' + dl + ' gives you a name connected to ' + rec.title + '. Then he asks you to leave.' };
      }
      var al = e.cardsOf('atlarge').filter(function (c) { return !c.data.hunted || !e.caseRec(c.data.hunted) || e.caseRec(c.data.hunted).status !== 'open'; });
      var heat = al.reduce(function (h, c) { var r = c.data.criminalId ? e.criminal(c.data.criminalId) : e.criminalByName(c.data.name); return Math.max(h, r ? r.heat || 0 : 0); }, 0);
      if (al.length && ctx.rng() < 0.45 + 0.1 * heat && e.roomForCase(1)) {
        var t = U.pick(ctx.rng, al);
        var card = e.spawnCase('manhunt', { ctx: ctx, district: d, culpritName: t.data.name, culpritTrait: t.data.trait, atLargeUid: t.uid,
          headline: 'Sighting: ' + t.data.name, lead: 'You catch a glimpse of a face you know in ' + dl + '.' });
        t.data.hunted = card.caseId;
        return { title: 'A Face in the Crowd', text: 'Across the street, under a guttering cresset: ' + t.data.name + '. Then a cart passes, and they are gone. But they are here.' };
      }
      var infs = e.cardsOf('informant', true);
      if (infs.length < 3 && ctx.rng() < 0.6) {
        var inf = ctx.give('informant', e.informantSpec(d));
        return { title: 'A New Contact', text: 'Someone in ' + dl + ' decides you are the kind of examiner worth knowing. They call themselves ' + inf.data.name + '.' };
      }
      return { title: 'Quiet Streets', text: dl + ' is quiet tonight. Quiet the way a held breath is quiet.' };
    },
  });
  R.push({
    id: 'patrol_walk', verb: 'investigate', src: 'patrol', label: 'Walk the City', duration: 30,
    preview: function (ctx) { return ctx.has('health') ? 'A long hard round. Pays a fee. Anything could happen.' : 'Follow your nose. See where the city takes you.'; },
    requires: { primary: ['instinct', 'health'] },
    run: function (ctx) {
      var e = ctx.e, s = e.s;
      var known = s.flags.districts || {};
      var unknown = Object.keys(CF.DISTRICTS).filter(function (k) { return !known[k]; });
      if (ctx.has('health')) { ctx.give('funds'); maybe(ctx, 0.5, 'fatigue'); } else maybe(ctx, 0.2, 'fatigue');
      var nKnown = Object.keys(known).length;
      if (unknown.length && s.flags.marketOpen && (ctx.rng() < 0.45 || nKnown < 3)) {
        var k = U.pick(ctx.rng, unknown);
        e.giveDistrict(k, ctx);
        return { title: 'New Ground: ' + CF.DISTRICTS[k].label, text: 'Your feet take you somewhere new. ' + CF.DISTRICTS[k].desc };
      }
      var r = ctx.rng();
      var open = e.openCases().filter(function (x) { return !x.special; });
      if (r < 0.25 && e.cardsOf('informant', true).length < 3) {
        var dk = Object.keys(known).length ? U.pick(ctx.rng, Object.keys(known)) : 'market';
        var inf = ctx.give('informant', e.informantSpec(dk));
        return { title: 'A New Contact', text: 'You pull someone out of a brawl in ' + CF.DISTRICTS[dk].label + '. They owe you now. They call themselves ' + inf.data.name + '.' };
      }
      if (r < 0.5 && open.length) {
        var rec = U.pick(ctx.rng, open);
        if (rec.witnesses.length) {
          ctx.give('witness', e.witnessSpec(rec));
          return { title: 'Overheard', text: 'At the conduit you hear someone talking about ' + rec.title + '. They were there.' };
        }
      }
      if (r < 0.62 && e.roomForCase()) {
        e.spawnCase(null, { ctx: ctx, headline: 'Hue and Cry', lead: 'You are hailed in the street.' });
        return { title: 'Hailed', text: 'A woman runs up to you, out of breath, pointing. It is going to be a long day.' };
      }
      if (r < 0.75) {
        ctx.give('funds');
        return { title: 'A Small Kindness', text: 'You catch a cutpurse at the corner of the Market. The stallholder presses coin into your hand and will not take it back.' };
      }
      return { title: 'Nothing Doing', text: U.pick(ctx.rng, ['The city is quiet tonight. It is never quiet for long.', 'Rain, cressets, and the ring of pattens on wet stone. Nothing you can use.', 'You walk until your feet hurt. The city keeps its secrets.']) };
    },
  });

  // ============================================================== INVESTIGATE
  R.push({
    id: 'inv_canvass', verb: 'investigate', label: 'Go Door to Door', duration: function (ctx) { return ctx.has('teammate') ? 45 : 60; },
    preview: 'Door to door, asking who saw what. Witnesses, and the names of people with reasons.',
    requires: ['case', 'district'],
    run: function (ctx) {
      var e = ctx.e;
      var rec = openRec(ctx, ctx.primary);
      if (!rec) return closed();
      var d = ctx.first('district').data.district;
      if (d !== rec.district) {
        maybe(ctx, 0.3, 'fatigue');
        return { title: 'The Wrong Quarter', text: 'Nobody in ' + CF.DISTRICTS[d].label + ' has heard of ' + rec.title + '. It happened somewhere else.' };
      }
      e.caseWork(rec, ctx);
      var got = [];
      var n = (ctx.has('teammate') ? 2 : 1) + (e.teamHas(ctx, 'streetwise') ? 1 : 0);
      var afraid = 0;
      var quiet = rec.district === 'market' && e.s.flags.marketQuietUntil && e.s.week <= e.s.flags.marketQuietUntil;
      for (var i = 0; i < n; i++) {
        if (rec.witnesses.length && (quiet || (e.s.meters.dread >= 5 && ctx.rng() < e.s.meters.dread * 0.08))) { rec.witnesses.shift(); afraid++; continue; }
        if (rec.witnesses.length) got.push(ctx.give('witness', e.witnessSpec(rec)).label);
        var sc = e.revealSuspect(rec, ctx);
        if (sc) got.push(sc.label + ' (accused)');
      }
      maybe(ctx, 0.25, 'fatigue');
      if (!got.length) {
        ctx.give('obsession');
        return { title: afraid ? 'Doors Shut' : 'Every Door Knocked', text: afraid ? 'A shutter closes as you come up the lane. Nobody near ' + rec.scene + ' saw anything, and nobody will, while they are more afraid of you than of the thief.' : 'The quarter has told you everything it is going to. You go round again anyway.' };
      }
      return { title: 'Door to Door', text: 'Around ' + rec.scene + ' people are frightened, and frightened people talk. You come away with: ' + got.join('; ') + '.' + (afraid ? ' One door stayed shut; they had heard what happens in the Hole.' : '') };
    },
  });
  R.push({
    id: 'inv_search', verb: 'investigate', label: 'Search the Scene', duration: function (ctx) { return ctx.has('teammate') ? 30 : 40; },
    preview: function (ctx) {
      var rec = ctx.caseOf(ctx.primary);
      return 'Go over ' + (rec ? rec.scene : 'the scene') + ' inch by inch. Instruments and watchmen make what you find stronger. Wit is thorough; Instinct follows hunches about people.';
    },
    requires: ['case'],
    run: function (ctx) {
      var e = ctx.e;
      var rec = openRec(ctx, ctx.primary);
      if (!rec) return closed();
      var helpers = e.helpers(ctx);
      var first = rec.searches === 0;
      rec.searches++;
      e.caseWork(rec, ctx);
      var read = e.readFile && e.readFile(rec);
      var n = 1 + (ctx.has('teammate') ? 1 : 0) + (ctx.has('focus') ? 1 : 0) + (first ? 1 : 0) + (e.teamHas(ctx, 'thorough') ? 1 : 0);
      var found = [];
      for (var i = 0; i < n; i++) {
        var it = drawItem(ctx, rec, helpers);
        if (!it) break;
        found.push(it.label);
      }
      // A Forensic Kit finds physical evidence the eye misses.
      if (e.gearWith(ctx, 'extraEvidence').length && rec.items[rec.found] && rec.items[rec.found].type === 'evidence') {
        found.push(drawItem(ctx, rec, helpers).label);
      }
      var extra = [];
      if (first) {
        var sc = e.revealSuspect(rec, ctx);
        if (sc) extra.push('The first name in the casebook: ' + sc.label + '.');
        if (!e.hasDistrict(rec.district) && e.s.flags.marketOpen) { e.giveDistrict(rec.district, ctx); extra.push('The case takes you to ' + CF.DISTRICTS[rec.district].label + '.'); }
      }
      if (ctx.has('instinct') && ctx.rng() < 0.5) {
        var sc2 = e.revealSuspect(rec, ctx);
        if (sc2) extra.push('A hunch, a likeness on the wall, a name: ' + sc2.label + '.');
      } else if (!first && e.s.rank <= 1 && ctx.rng() < 0.85) {
        // A young office's cases keep their names within reach: the neighbours talk.
        var sc3 = e.revealSuspect(rec, ctx);
        if (sc3) extra.push(U.fill('A neighbour, leaning on the gate, offers a name: {name}.', { name: sc3.label }));
      }
      maybe(ctx, 0.25, 'fatigue');
      if (!found.length) {
        ctx.give('obsession');
        var told = { title: 'Nothing Left', text: rec.scene + ' has given up everything it is going to. You stand in the middle of it anyway, staring, for a long time. ' + extra.join(' ') };
      if (read) told.text += ' You read the file before you went in, as an advocate does, and knew what to look for.';
      return told;
      }
      return { title: first ? 'At the Scene' : 'Back at the Scene',
        text: (first ? 'You go in past the beadle at ' + rec.scene + '. ' : 'You go back over ' + rec.scene + '. ') + 'You find: ' + found.join(', ') + '. ' + extra.join(' ') + (read ? ' You read the file before you went in, as an advocate does, and knew what to look for.' : '') };
    },
  });

  R.push({
    id: 'inv_photograph', verb: 'investigate', label: 'Draw the Scene', duration: 10, priority: 20,
    preview: function (ctx) { var rec = ctx.caseOf(ctx.primary); return 'Every surface, every angle, before it is tidied. What you have found from ' + (rec ? rec.scene : 'the scene') + ' stops fading, and the drawings are proof.'; },
    requires: { aspects: ['case'], cards: ['camera'], when: function (ctx) { var rec = ctx.caseOf(ctx.primary); return !!rec && !rec.photographed && ctx.with('tool').length === 1; } },
    run: function (ctx) {
      var e = ctx.e;
      var rec = openRec(ctx, ctx.primary);
      if (!rec) return closed();
      rec.photographed = true;
      e.caseWork(rec, ctx);
      var kept = 0;
      for (var k in e.s.cards) {
        var c = e.s.cards[k];
        if (c.caseId === rec.id && (c.def === 'clue' || c.def === 'evidence') && c.maxLife) { delete c.life; delete c.maxLife; kept++; }
      }
      var photos = e.clueSpec(rec, { label: 'The Scene Drawn', text: 'Forty leaves of ' + rec.scene + ' in charcoal, numbered and dated. The room as it was.', aspects: { forensic: 1, opportunity: 1 }, tags: ['physical'] }, [], { noMisread: true });
      photos.lifetime = 0; // drawings do not fade
      ctx.give('clue', photos);
      return { title: 'Drawn', text: 'You fill a sketch-book with ' + rec.scene + ' before anyone can tidy it. ' + (kept ? kept + ' thing' + (kept > 1 ? 's' : '') + ' you found there will keep now.' : 'Whatever you find there next will be on record.') };
    },
  });
  R.push({
    id: 'inv_illegal_search', verb: 'investigate', label: 'Search Without a Writ', duration: 10,
    forbids: { aspects: ['clue'], when: function (ctx) { return !!ctx.slots.mind; } },
    preview: function (ctx) { return 'Nobody home at ' + ctx.e.labelOf(ctx.primary).replace('Prime Suspect: ', '') + '\'s lodging. A shutter is open, or could be. Quick, and nothing a magistrate sealed.'; },
    danger: function () { return 'Suspicion +1 (+2 if they are innocent). What you find may be struck out before the Court.'; },
    requires: ['suspect'],
    run: function (ctx) {
      var e = ctx.e;
      var sc = ctx.primary;
      var rec = openRec(ctx, sc);
      if (!rec) return closed();
      var sus = e.suspectOf(sc);
      e.caseWork(rec, ctx);
      maybe(ctx, 0.3, 'fatigue');
      if (!sus.guilty) {
        e.meter('scrutiny', 2);
        return { title: 'Nothing, and a Complaint', text: 'You go through ' + sus.name + '\'s chest by a shuttered lantern and find hose. A neighbour saw you climb in. The complaint is on the Burgomaster\'s desk before you are.' };
      }
      e.meter('scrutiny', 1);
      ctx.give('clue', e.clueSpec(rec, { label: 'Found at ' + sus.name + '\'s Lodging', text: 'In a box at the back of the press: what they took, or what they used. Nobody sealed a writ for this.',
        aspects: { forensic: 2, opportunity: 2 } }, [], { noMisread: true, illegal: true }));
      return { title: 'A Box', text: 'A quarter of an hour by a shuttered lantern and there it is, at the back of the press. You put it in your coat. Nobody saw. Probably nobody saw.' };
    },
  });

  // ================================================================== ANALYZE
  R.push({
    id: 'an_evidence', verb: 'analyze', label: 'Make It Speak',
    duration: function (ctx) { return Math.round((ctx.e.s.rooms.lab ? 12 : 20) * (ctx.e.teamHas(ctx, 'patient') ? 0.8 : 1)); },
    preview: function (ctx) {
      var item = ctx.primary.data.item || {};
      var ok = ctx.e.hasTool(ctx, item.needs);
      return ok ? 'Bench work: the glass, the acid, the needle, patience.' : 'You lack the right instrument (' + needsLabel(item.needs) + '). You will only get part of the story.';
    },
    requires: ['evidence'],
    run: function (ctx) {
      var e = ctx.e;
      var ev = ctx.primary;
      var rec = openRec(ctx, ev);
      if (!rec) { ctx.consume(ev); return closed('the case this belonged to'); }
      e.caseWork(rec, ctx);
      var item = ev.data.item;
      var res = item.result;
      var ok = e.hasTool(ctx, item.needs);
      var spec = { label: res.label, text: res.text, aspects: U.clone(res.aspects) };
      if (!ok) {
        for (var k in spec.aspects) spec.aspects[k] = Math.max(1, Math.floor(spec.aspects[k] / 2));
        spec.label = 'Partial: ' + res.label;
        spec.text = 'Without ' + needsLabel(item.needs) + ', you only get part of it. ' + res.text;
      }
      // The apothecary's bench: what the body says reads one point stronger.
      var bench = !!e.s.rooms.lab && CF.itemTags(item).indexOf('biology') >= 0;
      if (bench) { spec.aspects.forensic = (spec.aspects.forensic || 0) + 1; spec.text += ' At the apothecary\'s bench it reads one point stronger.'; }
      // Proof that promises a name gives one: the culprit's, if they are in
      // the casebook; otherwise a hand to hold against a name later.
      var flags = {};
      if (res.names && ok) {
        var cul = culpritOf(rec);
        if (cul.revealed && !cul.cleared) { flags.points = rec.culprit; flags.noMisread = true; spec.text += ' It is ' + cul.name + '\'s.'; }
        else { spec.trait = cul.trait; spec.names = true; spec.text += ' Nobody in the casebook yet has this hand. Keep it.'; }
      }
      ctx.consume(ev);
      ctx.give('clue', e.clueSpec(rec, spec, e.helpers(ctx), flags));
      return { title: ok ? 'Results' : 'Partial Results', text: spec.text };
    },
  });
  // A hand, a seal, a signature with no name yet: hold it against an accused.
  R.push({
    id: 'an_hold_against', verb: 'analyze', label: 'Hold It Against a Name', duration: 15,
    preview: function (ctx) { return 'Hold ' + ctx.e.labelOf(ctx.primary) + ' against ' + ctx.e.labelOf(ctx.slots.who).replace('Prime Suspect: ', '') + '.'; },
    blocked: function (ctx) { return ctx.slots.who.caseId !== ctx.primary.caseId ? 'That name belongs to another case.' : null; },
    requires: { primary: 'clue', when: function (ctx) { var c = ctx.primary; return !!(c.data && c.data.names && !c.data.points && ctx.slots.who); } },
    run: function (ctx) {
      var e = ctx.e, c = ctx.primary, sc = ctx.slots.who;
      var rec = openRec(ctx, c);
      if (!rec) return closed();
      var sus = e.suspectOf(sc);
      if (!sus) return { title: 'No Match', text: 'Not this one. Keep it.' };
      e.caseWork(rec, ctx);
      if (sus.guilty) {
        c.data.points = sus.key;
        c.data.names = false;
        c.label = 'Matched: ' + e.labelOf(c);
        c.fresh = true;
        e.dirty = true;
        return { title: 'A Match', kind: 'major', text: 'The same hand. It belongs to ' + sus.name + '.' };
      }
      return { title: 'No Match', text: 'Not this one. Keep it.' };
    },
  });
  R.push({
    id: 'an_enhance', verb: 'analyze', label: 'Back to the Bench', duration: 20,
    preview: function (ctx) { return 'Take ' + ctx.e.labelOf(ctx.primary) + ' to the apothecary\'s back room and get more out of it. Once.'; },
    blocked: function (ctx) { return ctx.primary.data.enhanced ? 'The apothecary has already had everything he can get from this.' : null; },
    requires: { primary: 'clue', when: function (ctx) { return !!ctx.e.s.rooms.lab || ctx.cards.some(function (c) { return c.def === 'labpass'; }); } },
    run: function (ctx) {
      var e = ctx.e, c = ctx.primary;
      var rec = openRec(ctx, c);
      if (!rec) return closed();
      var a = CF.clueAspects(c), best = null;
      for (var k in a) if (!best || a[k] > a[best]) best = k;
      if (!best) best = 'forensic';
      c.aspects = c.aspects || {};
      c.aspects[best] = (c.aspects[best] || 0) + 1;
      c.data.enhanced = true;
      c.fresh = true;
      e.dirty = true;
      return { title: 'Under the Glass', text: 'Under the apothecary\'s glass ' + e.labelOf(c) + ' gives up one more detail. ' + CF.ASPECTS[best].label + ' +1.' };
    },
  });
  R.push({
    id: 'an_clue_none', verb: 'analyze', label: 'Back to the Bench', duration: 5,
    preview: 'A token is not raw proof. Only the apothecary can get more out of it.',
    blocked: 'Only the apothecary gets more out of a token. Petition for the Apothecary\'s Key, or for his bench.',
    requires: { primary: 'clue' }, forbids: { cards: ['labpass'], when: function (ctx) { return !!ctx.e.s.rooms.lab; } },
  });
  R.push({
    id: 'an_reopen', verb: 'analyze', label: 'Open the Case Again', duration: 60,
    preview: 'Pull the old books from the Rolls. Read everything again with fresh eyes.',
    blocked: function (ctx) { return !ctx.e.s.rooms.archive ? 'You need the Rolls to open an unanswered case again.' : !ctx.e.roomForCase(1) ? 'The desk is full. Close or let go of a case before you open an old one again.' : null; },
    requires: ['coldcase'],
    run: function (ctx) {
      ctx.e.pathGain('master', 1, 'reopened a cold case');
      var e = ctx.e, cc = ctx.primary, d = cc.data;
      ctx.consume(cc);
      var tid = CF.CASE_TEMPLATES[d.template] ? d.template : U.pick(ctx.rng, CF.ORDINARY_CASES);
      var alCard = d.atLargeUid && e.card(d.atLargeUid);
      e.spawnCase(tid, { ctx: ctx, culpritName: d.culpritName, culpritTrait: d.culpritTrait, atLargeUid: d.atLargeUid, reopened: true, from: d.from || null,
        criminalId: (alCard && alCard.data.criminalId) || (e.criminalByName(d.culpritName) || {}).id || null,
        lifetime: 320, headline: 'Opened Again', lead: 'The old book on ' + (d.title || 'an old case') + ' is open on your desk again.' });
      return { title: 'Opened Again', text: 'Dust, faded ink, a witness list with half the names crossed out. But the answer was always in here somewhere.' };
    },
  });
  R.push({
    id: 'an_plant', verb: 'analyze', label: 'Arrange Proof', duration: 30,
    preview: function (ctx) { return 'A little silver in the right hands, and proof against ' + ctx.e.labelOf(ctx.primary) + ' will exist by prime. If it is ever examined closely, you are finished.'; },
    danger: function () { return 'Suspicion +1, and much worse if discovered'; },
    blocked: function (ctx) { return ctx.count('funds') >= 2 ? null : 'This takes 2 Coin.'; },
    requires: ['suspect'],
    run: function (ctx) {
      var e = ctx.e;
      var sc = ctx.primary;
      var rec = openRec(ctx, sc);
      if (!rec) return closed();
      ctx.with('funds').forEach(ctx.consume);
      e.meter('scrutiny', 1);
      ctx.give('clue', e.clueSpec(rec, { label: 'Convenient Proof', text: 'A glove, found in ' + sc.label.replace('Prime Suspect: ', '') + '\'s midden. It matches everything. It matches too well.',
        aspects: { forensic: 3, opportunity: 1 } }, [], { planted: true, noMisread: true }));
      return { title: 'Arranged', text: 'You do not ask how it was done. The gaoler who keeps the strongroom does not ask why. Neither of you will sleep well.' };
    },
  });

  // ============================================================== INTERROGATE
  R.push({
    id: 'int_none', verb: 'interrogate', label: 'Questioning', duration: 5,
    preview: 'How will you go in? Wit to listen, Instinct to bluff, Health to lean.',
    blocked: 'Choose a manner.',
    forbids: ['focus', 'instinct', 'health'],
  });
  R.push({
    id: 'int_witness', verb: 'interrogate',
    label: function (ctx) { return ctx.has('health') ? 'Lean on the Witness' : ctx.has('instinct') ? 'Bluff the Witness' : 'Hear the Witness'; },
    duration: function (ctx) { return ctx.e.s.rooms.suite ? 10 : 15; },
    preview: function (ctx) {
      if (ctx.has('health')) return 'Get it out of them, whatever it takes. A beaten witness is not credible before the Court, but the word is the word. The Council will hear of it, and so will the quarter.';
      if (ctx.has('instinct')) return 'Pretend you already know. Might shake more loose. Might frighten them off.';
      return 'Small beer, patience, a kind word. Reliable.';
    },
    danger: function (ctx) { return ctx.has('health') ? 'Suspicion +1 · Dread +1' : null; },
    requires: ['witness'],
    run: function (ctx) {
      var e = ctx.e, w = ctx.primary;
      w.data.asked = true;
      var rec = openRec(ctx, w);
      if (!rec) { ctx.consume(w); return closed(); }
      e.caseWork(rec, ctx);
      var cul = culpritOf(rec);
      var T = CF.CASE_TEMPLATES[rec.template];
      // What was heard has a target: a hint about nobody, or about the
      // culprit's trade; one about an innocent in the casebook only from a
      // witness with a reason (a grudge, or the reward).
      var points = null, hint;
      if (w.data.knows) hint = CF.TRAIT_SEEN[cul.trait];
      else {
        var eager = w.data.stake === 'hates' || w.data.stake === 'reward';
        var pool = T.hints.filter(function (h) {
          if (!h.role || h.role === cul.role) return true;
          return eager && rec.suspects.some(function (x) { return x.revealed && !x.cleared && !x.guilty && x.role === h.role; });
        });
        var h = U.pick(ctx.rng, pool.length ? pool : T.hints);
        hint = h.text;
        var target = h.role && rec.suspects.filter(function (x) { return x.role === h.role && (x.guilty || (x.revealed && !x.cleared)); })[0];
        if (target) points = target.key;
      }
      var name = w.label.replace('Witness: ', '');
      var helpers = ctx.with('teammate');
      var vars = { witness: name, hint: hint };
      var P = CF.PROSE;
      var aspects = { testimony: 2 };
      if (w.data.knows) aspects.opportunity = 1;
      var spec = { label: 'Deposition: ' + name, text: '"' + hint + '"' + (w.data.stake ? ' (' + CF.STAKES[w.data.stake].label + '.)' : ''), aspects: aspects, trait: w.data.knows ? cul.trait : null };
      var stakeFlags = { stake: w.data.stake || 'none', witness: name, againstInterest: !!(w.data.knows && w.data.stake && CF.STAKES[w.data.stake].against), points: points };
      if (ctx.has('instinct')) {
        if (!e.teamHas(ctx, 'empathetic') && ctx.rng() < 0.4) {
          w.life = Math.max(20, (w.life || 60) - 60);
          return { title: 'The Bluff Fails', text: U.fill(U.pick(ctx.rng, P.witnessBluffFail), vars) };
        }
        ctx.consume(w);
        ctx.give('clue', suiteBonus(e, e.clueSpec(rec, spec, helpers, stakeFlags)));
        var s1 = e.revealSuspect(rec, ctx);
        return { title: 'The Bluff Works', text: U.fill(U.pick(ctx.rng, P.witnessBluff), vars) + (s1 ? ' And a name: ' + s1.label + '.' : '') };
      }
      if (ctx.has('health')) {
        ctx.consume(w);
        spec.aspects.testimony = 3;
        ctx.give('clue', suiteBonus(e, e.clueSpec(rec, spec, helpers, { stake: stakeFlags.stake, witness: stakeFlags.witness, againstInterest: stakeFlags.againstInterest, points: stakeFlags.points, coerced: true })));
        e.meter('scrutiny', 1);
        e.meter('dread', 1);
        e.revealSuspect(rec, ctx);
        maybe(ctx, 0.4, 'fatigue');
        return { title: 'Under Pressure', text: U.fill(U.pick(ctx.rng, P.witnessPressure), vars) };
      }
      ctx.consume(w);
      ctx.give('clue', suiteBonus(e, e.clueSpec(rec, spec, helpers, stakeFlags)));
      var s2 = ctx.rng() < 0.5 ? e.revealSuspect(rec, ctx) : null;
      return { title: 'A Deposition', text: U.fill(U.pick(ctx.rng, P.witnessEmpathy), vars) + (s2 ? ' They also mention ' + s2.label + '.' : '') };
    },
  });
  R.push({
    id: 'int_suspect', verb: 'interrogate',
    label: function (ctx) { return ctx.has('health') ? 'Put Them to the Question' : ctx.has('clue') ? 'Confront the Accused' : ctx.has('instinct') ? 'Bluff the Accused' : 'Examine the Accused'; },
    duration: function (ctx) { return ctx.e.s.rooms.suite ? 20 : 30; },
    preview: function (ctx) {
      if (ctx.has('health')) {
        var rec0 = ctx.caseOf(ctx.primary), ind = rec0 && ctx.e.indiciaOf(rec0);
        return 'The Hole, the thumbscrews, the strappado. You will get a confession; everybody confesses. Whether it is true is another matter, and the Court will check it against Body or Writ. ' +
          (ind && ind.sufficient ? 'The indicia are sufficient: the Carolina allows the question.' : 'The indicia are not sufficient (two kinds of proof, or a word against interest). The question without them is a crime the Council can charge you with.');
      }
      if (ctx.has('clue')) return 'Put the token on the table and watch their face.';
      if (ctx.has('instinct')) return 'Pretend you have more than you do.';
      return 'Let them talk. People always say more than they mean to.';
    },
    danger: function (ctx) {
      if (!ctx.has('health')) return null;
      var rec0 = ctx.caseOf(ctx.primary), ind = rec0 && ctx.e.indiciaOf(rec0);
      return 'Dread +2 · Cruelty +1' + (ind && ind.sufficient ? '' : ' · Suspicion +2');
    },
    requires: ['suspect'],
    run: function (ctx) {
      var e = ctx.e, sc = ctx.primary;
      var rec = openRec(ctx, sc);
      if (!rec) return closed();
      var sus = e.suspectOf(sc);
      var again = !!sus.questioned;
      sus.questioned = true;
      e.caseWork(rec, ctx);
      var P = CF.PROSE;
      var helpers = ctx.with('teammate');
      var vars = { suspect: sus.name, victim: rec.victim, motive: sus.motive, alibi: U.pick(ctx.rng, P.alibis) };
      var confront = ctx.slots.clue;
      var tunnel = e.countOf('tunnel') > 0;

      if (ctx.has('health')) {
        // The question. Everybody confesses; only the guilty confess the truth.
        maybe(ctx, 0.5, 'fatigue');
        var ind = e.indiciaOf(rec);
        e.meter('dread', 2);
        e.count('cruelty', 1);
        if (!ind.sufficient) e.meter('scrutiny', 2);
        ctx.give('clue', suiteBonus(e, e.clueSpec(rec, { label: 'Confession Under the Question: ' + sus.name,
          text: sus.name + ' confessed, after eleven hours in the Hole with you. ' + (ind.sufficient ? 'The indicia were sufficient; the Carolina is satisfied so far.' : 'There were no sufficient indicia. The clerk wrote that down too.') + ' To stand as full proof it must be repeated freely, or agree with Body or Writ.',
          aspects: { testimony: 4 }, about: sus.key }, [], { confession: 'question', falseConfession: !sus.guilty, illegal: !ind.sufficient, noMisread: true })));
        return { title: 'A Confession', text: U.fill(U.pick(ctx.rng, P.suspectPressure), vars) + (ind.sufficient ? '' : ' There were no sufficient indicia for it. If the Council asks, and it will, you have no answer.') };
      }

      if (!sus.guilty && rec.template === 'threedays' && !sus.cleared && (/brother/.test(sus.role) || /porter/.test(sus.role))) {
        // Each confesses to save the other. A free confession, and a false one.
        ctx.give('clue', suiteBonus(e, e.clueSpec(rec, { label: 'Confession: ' + sus.name, text: sus.name + ' confesses freely, in a steady voice, to everything. Too much of everything: the wrong day, the wrong knife. They are lying to save somebody.', aspects: { testimony: 3, motive: 1 }, trait: sus.trait, about: sus.key }, helpers, { noMisread: true, confession: 'free', falseConfession: true })));
        return { title: 'A Confession, Freely Given', text: sus.name + ' does not wait to be asked. The Council has three days and here is a confession in a steady voice. Look at the details before you take it to the Court. Look at who they keep glancing at.' };
      }
      if (!sus.guilty) {
        if (tunnel && ctx.rng() < 0.4) {
          ctx.give('clue', e.clueSpec(rec, { label: 'Something to Hide', text: sus.name + ' is hiding something. You are sure of it. You have never been so sure.', aspects: { motive: 2 }, about: sus.key }, [], {}));
          var made = ctx.out[ctx.out.length - 1];
          made.data.misread = true;
          return { title: 'Guilty Eyes', text: 'Every pause, every glance at the door: guilt. It has to be.' };
        }
        // The innocent have a story. Written down, it is a token to check
        // in Rest against the hours, not a verdict; an Examiner's first
        // cases take it at its word.
        if (ctx.has('instinct') && ctx.rng() >= 0.4) return { title: 'Nothing Shaken Loose', text: U.fill(U.pick(ctx.rng, P.suspectBluffFail), vars) };
        if (!sus.alibi) sus.alibi = vars.alibi;
        vars.alibi = sus.alibi;
        if (e.s.rank === 0) {
          // Taken at its word: no token, so nothing for the magnet to carry into a charge.
          sus.cleared = true;
          ctx.consume(sc);
          return { title: 'Cleared: ' + sus.name, text: U.fill(U.pick(ctx.rng, P.suspectAlibi), vars) };
        }
        if (!sus.alibiGiven) ctx.give('clue', suiteBonus(e, e.clueSpec(rec, { label: 'Alibi: ' + sus.name, text: sus.alibi.charAt(0).toUpperCase() + sus.alibi.slice(1) + '.',
          aspects: { testimony: 1 }, trait: sus.trait, alibi: sus.key, about: sus.key }, helpers, { noMisread: true })));
        sus.alibiGiven = true;
        return { title: 'An Alibi', text: 'You try ' + sus.name + '\'s story: ' + sus.alibi + '. It will want checking.' };
      }

      if (confront) {
        var valid = confront.caseId === rec.id && !confront.data.misread;
        var weight = 0;
        var ca = CF.clueAspects(confront);
        for (var k in ca) weight += ca[k];
        var p = valid ? 0.5 + (weight >= 3 ? 0.2 : 0) + (ctx.has('focus') ? 0.1 : 0) : 0.05;
        if (ctx.rng() < p) {
          ctx.give('clue', suiteBonus(e, e.clueSpec(rec, { label: 'Confession: ' + sus.name, text: 'In their own words, written fair by the clerk, freely and out of the Hole. ' + sus.motive,
            aspects: { testimony: 3, motive: 1 }, about: sus.key }, helpers, { noMisread: true, confession: 'free' })));
          return { title: sus.name + ' Cracks', text: U.fill(U.pick(ctx.rng, P.suspectCracks), { suspect: sus.name, clue: e.labelOf(confront) }) };
        }
        return { title: 'Stone', text: sus.name + ' looks at ' + e.labelOf(confront) + ', then at you, and asks what it has to do with them. ' + (valid ? 'Nearly. They nearly broke.' : 'It is a fair question.') };
      }

      if (ctx.has('instinct')) {
        if (ctx.rng() < 0.55) {
          ctx.give('clue', suiteBonus(e, e.clueSpec(rec, { label: 'Slip of the Tongue', text: sus.name + ' knew something only the person who did it would know.', aspects: { opportunity: 2 }, about: sus.key }, helpers)));
          return { title: 'A Slip', text: U.fill(U.pick(ctx.rng, P.suspectBluff), vars) };
        }
        return { title: 'Nothing Shaken Loose', text: U.fill(U.pick(ctx.rng, P.suspectBluffFail), vars) };
      }

      // Asked again, the culprit has a story too, once. It will not hold.
      if (again && !sus.alibiGiven) {
        sus.alibiGiven = true;
        if (!sus.alibi) sus.alibi = vars.alibi;
        vars.alibi = sus.alibi;
        ctx.give('clue', suiteBonus(e, e.clueSpec(rec, { label: 'Alibi: ' + sus.name, text: sus.alibi.charAt(0).toUpperCase() + sus.alibi.slice(1) + '.',
          aspects: { testimony: 1 }, trait: sus.trait, alibi: sus.key, about: sus.key }, helpers, { noMisread: true })));
        return { title: 'An Alibi', text: 'You try ' + sus.name + '\'s story: ' + sus.alibi + '. It will want checking.' };
      }
      ctx.give('clue', suiteBonus(e, e.clueSpec(rec, { label: 'Motive: ' + sus.name, text: sus.motive, aspects: { motive: 2 }, about: sus.key }, helpers)));
      return { title: 'A Reason', text: U.fill(U.pick(ctx.rng, P.suspectEmpathy), vars) };
    },
  });

  // ==================================================================== RIVAL
  // The Provost's Examiner: find their weakness (twice to expose them), buy
  // them off, frighten them, or shadow them.
  function rivalStall(ctx, weeks) { var r = ctx.primary; r.data.stalled = ctx.e.s.week + weeks; }
  function rivalHeat(ctx, how) {
    var e = ctx.e, r = ctx.primary;
    r.data.heat = (r.data.heat || 0) + 1;
    if (r.data.heat >= 2) {
      e.remove(r);
      e.s.flags.rivalGone = e.s.week + 8;
      e.meter('reputation', 2);
      e.favour().council += 1;
      return { title: 'The Rival Exposed', text: how + ' The Council reads the file in silence and sends the Harbourmaster\'s Examiner back to the Customs House. Your name is spoken in the chamber, warmly for once.', kind: 'major' };
    }
    rivalStall(ctx, 1);
    return { title: 'A Weakness Found', text: how + ' They will be careful for a week. One more, and you will have them.', kind: 'verb' };
  }
  R.push({ id: 'int_rival_weakness', verb: 'interrogate', label: function (ctx) { return (ctx.primary.data.heat || 0) >= 1 ? 'Expose Them' : 'Find Their Weakness'; }, duration: 30,
    preview: function (ctx) { return (ctx.primary.data.heat || 0) >= 1 ? 'You have one thread. Pull it in front of the Council.' : 'Everyone has something. Find theirs.'; },
    requires: { primary: 'rival', aspects: ['focus'] },
    run: function (ctx) { return rivalHeat(ctx, 'Two hours of polite questions, and a name they did not want spoken: a moneylender, a widow, a file of their own.'); } });
  R.push({ id: 'int_rival_buy', verb: 'interrogate', label: 'Buy a Quiet Fortnight', duration: 8,
    preview: 'A Coin, and they find other things to do for two weeks.', requires: { primary: 'rival', aspects: ['funds'] },
    effects: [{ consume: 'funds', n: 1 }, { call: function (ctx) { rivalStall(ctx, 2); } }, { story: { title: 'Bought', text: 'They take it without counting it. Two weeks, they say, and then the Harbourmaster will ask why nothing is happening.' } }] });
  R.push({ id: 'int_rival_threat', verb: 'interrogate', label: 'Frighten Them', duration: 10,
    preview: 'Lean on them. It works for a week, and the city hears about it.', requires: { primary: 'rival', aspects: ['health'] },
    effects: [{ call: function (ctx) { rivalStall(ctx, 1); } }, { meter: { dread: 1, retaliation: 1 } }, { story: { title: 'Frightened', text: 'You explain what happens to examiners who spoil scenes. They go pale. They also go to the Harbourmaster.' } }] });
  R.push({ id: 'int_rival_none', verb: 'interrogate', label: 'A Polite Conversation', duration: 5,
    preview: 'Without Wit, Coin or Health, this is a chat about the weather.', requires: { primary: 'rival' },
    effects: [{ story: { title: 'The Weather', text: 'They agree it has been wet. They ask after your health. They leave.' } }] });
  R.push({ id: 'inv_rival_shadow', verb: 'investigate', label: 'Shadow Them', duration: 30,
    preview: 'Follow the Harbourmaster\'s Examiner through a night. See where they go, and who pays.', requires: { primary: 'rival', aspects: ['instinct'] },
    run: function (ctx) { return rivalHeat(ctx, 'A night in doorways, and at the end of it a door you can name and a purse you saw change hands.'); } });

  // ================================================================== REFLECT
  // Ways around the needs: what you have on the table instead of Coin. These
  // come before the plain rests so a watchman, a Quarter or Instinct beside
  // the need is used when it is there.
  function aid(id, need, aspect, label, dur, text, preview, effects) {
    R.push({ id: id, verb: 'reflect', label: label, duration: dur, preview: preview, requires: { primary: need, aspects: [aspect] },
      effects: [{ consume: 'primary' }, { story: { title: label, text: text } }].concat(effects || []) });
  }
  aid('ref_hunger_pot', 'hunger', 'teammate', 'The Watch-house Pot', 25, 'Whatever the Watch is eating, you are eating. It is mostly barley. It is hot.', 'Eat with the Watch. Slow, and free.');
  aid('ref_hunger_credit', 'hunger', 'district', 'Eat on Credit', 12, 'The cookshop on the corner knows the Examiner. The Examiner will pay next week. The cookshop writes it down.', 'A meal on the Quarter\'s credit. Quick, and it is written down.', [{ call: function (ctx) { ctx.e.count('debt'); } }]);
  aid('ref_hunger_dole', 'hunger', 'health', 'The Abbey Dole', 25, 'You stand in the line at the Abbey gate with the beggars and take the bread. The clerks on the Hill hear of it, and so does the Warrens, which thinks better of you for it.', 'Bread at the Abbey gate. Free, and seen.', [{ meter: { reputation: -1, dread: -1 } }]);
  aid('ref_hunger_informer', 'hunger', 'informant', 'A Bowl at Their Table', 15, 'They feed you without asking why. They will not forget that they did.', 'Your informer feeds you. They remember it.', [{ call: function (ctx) { var inf = ctx.first('informant'); if (inf && ctx.e.trustInformant) ctx.e.trustInformant(inf, -1); } }]);
  aid('ref_sickness_sweat', 'sickness', 'health', 'Sweat It Out', 60, 'Every blanket you own, a jug of water, and two days you do not remember. On the third the fever is gone and so is most of your strength.', 'No physician. Sweat it out. Slow, and it costs you.', [{ give: 'fatigue' }]);
  aid('ref_sickness_watch', 'sickness', 'teammate', 'A Watchman\'s Remedy', 45, 'Onion, honey, something from a jar with no label. His grandmother swore by it. It works, or the fever was leaving anyway.', 'A watchman knows a remedy. Free, and it usually works.', [{ chance: 0.4, then: [{ give: 'fatigue' }] }]);
  aid('ref_stress_walk', 'stress', 'instinct', 'Walk It Off', 12, 'Out past the Water-gate and along the river until the case behind your eyes goes quiet. It comes back on the way home, smaller.', 'Walk until it lets go. Quick, and free.');
  aid('ref_stress_watch', 'stress', 'teammate', 'A Drink with the Watch', 15, 'The sergeant tells the story about the goose again. You laugh in the right place. It helps more than it should.', 'A drink with the Watch. Quick, and you might regret the second one.', [{ chance: 0.4, then: [{ give: 'fatigue' }] }]);
  aid('ref_fatigue_watch', 'fatigue', 'teammate', 'The Watch Takes the Round', 10, 'You send a watchman out in your place and sit down for the first time since prime.', 'Let a watchman take the round. Quick, and free.');

  // An Insight alone is a lesson (one more of the ability); with the ability
  // beside it, a perk you keep.
  R.push({
    id: 'ref_insight_keep', verb: 'reflect', priority: 7, label: 'Keep the Trick', duration: 15,
    preview: function (ctx) { var sp = CF.INSIGHTS[ctx.primary.data.insight]; return sp ? 'Keep it as a trick instead of a lesson: ' + sp.perkText : ''; },
    requires: { primary: 'lesson', when: function (ctx) { var sp = CF.INSIGHTS[ctx.primary.data.insight]; return !!sp && !!ctx.slots.grow && ctx.slots.grow.def === sp.trains; } },
    run: function (ctx) {
      var sp = CF.INSIGHTS[ctx.primary.data.insight], e = ctx.e, id = e.perkId(ctx.primary.data.insight);
      ctx.consume(ctx.primary);
      e.s.perks = e.s.perks || {}; e.s.perks[id] = true;
      return { title: sp.perk, text: sp.perkText + ' It is yours now.' };
    },
  });
  R.push({
    id: 'ref_insight_wrong', verb: 'reflect', priority: 6, label: 'Keep the Trick',
    blocked: function (ctx) { var sp = CF.INSIGHTS[ctx.primary.data.insight]; return sp ? 'This lesson is about ' + CF.CARDS[sp.trains].label + '; put that beside it, or nothing.' : 'Nothing to learn here.'; },
    requires: { primary: 'lesson', when: function (ctx) { return !!ctx.slots.grow; } },
  });
  R.push({
    id: 'ref_insight_train', verb: 'reflect', priority: 5, label: 'Learn the Lesson', duration: 20,
    preview: function (ctx) { var sp = CF.INSIGHTS[ctx.primary.data.insight]; return sp ? 'Learn it: one more ' + CF.CARDS[sp.trains].label + ', for good.' : ''; },
    requires: { primary: 'lesson' },
    run: function (ctx) {
      var sp = CF.INSIGHTS[ctx.primary.data.insight];
      ctx.consume(ctx.primary);
      if (sp) ctx.give(sp.trains);
      return { title: sp ? sp.lesson : 'A Lesson', text: sp ? sp.text.split('.')[0] + '. You are more than you were.' : '' };
    },
  });

  // The opening: work for your bread, then reason with the Watch.
  R.push({
    id: 'duty_labour', verb: 'duty', priority: 20, label: 'A Day\'s Labour', duration: 15,
    preview: function (ctx) { return 'A day of ' + ctx.e.openingScene().work + '. A Coin, and it leaves you winded.'; },
    requires: { primary: 'health', when: function (ctx) { return !!ctx.e.s.flags.opening && ctx.e.s.flags.stage !== 'hired' && ctx.e.s.flags.stage !== 'keep'; } },
    effects: [{ give: 'funds' }, { story: { title: 'A Day\'s Labour', text: 'A Coin, honestly earned, and your back knows it.' } }],
  });
  R.push({
    id: 'int_watchq', verb: 'interrogate', priority: 20, label: 'Reason with the Sergeant', duration: 15,
    preview: 'Tell him what you saw, in order, and why you were there. Wit, not temper.',
    requires: { primary: 'watchq' },
    blocked: function (ctx) { return ctx.has('focus') ? null : 'He is not asking for your fists or your hunches. Put Wit beside him.'; },
    run: function (ctx) {
      ctx.consume(ctx.primary);
      ctx.e.openingHired();
      return { title: 'The Sergeant Listens', text: ctx.e.openingScene().hired };
    },
  });

  // Spent Health, Wit or Instinct: a short rest brings it back at once.
  R.push({
    id: 'ref_spent', verb: 'reflect', priority: 6, label: 'Catch Your Breath', duration: 8,
    preview: 'Sit down for a moment and let it come back.',
    requires: { primary: 'spent' },
    run: function (ctx) {
      var e = ctx.e;
      // The primary comes back out whole (a held card would be spent again on its way out).
      var restores = CF.CARDS[ctx.primary.def].restores;
      ctx.consume(ctx.primary);
      ctx.give(restores);
      // Every other spent faculty on the table comes back with it.
      e.cardsOf('spent_health').concat(e.cardsOf('spent_focus'), e.cardsOf('spent_instinct')).forEach(function (c) {
        if (c.loc && c.loc.t === 'table') { e.transform(c, CF.CARDS[c.def].restores); e.placeOnTable(c, { x: c.loc.x, y: c.loc.y }); }
      });
      return { title: 'Yourself Again', text: 'A moment on the bench, and you are yourself again.' };
    },
  });

  // Resting. Funds buy a proper night off: a third of the time.
  function rest(id, defId, label, dur, text, preview) {
    R.push({
      id: id, verb: 'reflect', label: function (ctx) { return ctx.has('funds') ? label + ' (Paid)' : label; },
      duration: function (ctx) { return ctx.has('funds') ? Math.ceil(dur / 3) : dur; },
      preview: function (ctx) { return ctx.has('funds') ? preview + ' With silver in your pocket it goes quicker: a good dinner, a clean bed at the Swan, a barber-surgeon who does not ask questions.' : preview + ' (Add Coin to make it quicker.)'; },
      requires: { primary: defId },
      effects: [{ consume: 'primary' }, { consume: 'funds', n: 1 }, { story: { title: label, text: text } }],
    });
  }
  rest('ref_fatigue', 'fatigue', 'Sleep', 20, 'You sleep from vespers to terce and wake up hungry. The world is still there. So are you.', 'Close the shutters. Bar the door. Sleep.');
  rest('ref_burnout', 'burnout', 'A Long Rest', 60, 'A week of nothing. Long walks outside the walls. Small beer and bread. Your hands stop shaking on the fourth day. On the seventh you want to go back to the Watch-house, which is either a good sign or a very bad one.', 'Take time away. Real time. The cases will wait. Some of them will not.');
  rest('ref_obsession', 'obsession', 'Let It Go', 30, 'You take the papers off the wall. You go to the players in the inn-yard. You do not think about the case for three whole hours.', 'Put the case down for a night. Just one.');
  // The needs: hunger wants Coin, sickness wants Coin or the Physician's Case, stress wants time (or Coin for a quick one).
  R.push({
    id: 'ref_hunger', verb: 'reflect', label: 'Eat', duration: 8,
    preview: 'A hot dinner at the Swan, and a second. It costs a Coin.',
    requires: { primary: 'hunger' },
    blocked: function (ctx) { return ctx.has('funds') ? null : 'You need Coin to eat, or a watchman, a Quarter, an Informer or your Health beside it.'; },
    effects: [{ consume: 'primary' }, { consume: 'funds', n: 1 }, { story: { title: 'A Hot Dinner', text: 'Mutton, bread, small beer, and a second helping. Your hands stop shaking somewhere around the pudding.' } }],
  });
  R.push({
    id: 'ref_sickness', verb: 'reflect', label: function (ctx) { return ctx.has('kit_bio') ? 'Treat Yourself' : 'See a Physician'; }, duration: function (ctx) { return ctx.has('kit_bio') ? 15 : 25; },
    preview: 'A physician wants a Coin; with the Physician\'s Case you can dose yourself.',
    requires: { primary: 'sickness' },
    blocked: function (ctx) { return ctx.has('funds') || ctx.has('kit_bio') ? null : 'A physician wants Coin, or you need the Physician\'s Case.'; },
    effects: [{ consume: 'primary' }, { consume: 'funds', n: 1 }, { story: { title: 'The Cough Clears', text: 'Bitter bark in wine, two days sweating under every blanket you own, and on the third morning the river smells like a river again.' } }],
  });
  // A Wound: dressed from the Case, paid to the barber-surgeon, or slept off. First match wins.
  R.push({
    id: 'ref_wound_case', verb: 'reflect', priority: 2, label: 'The Physician\'s Case', duration: 15,
    preview: 'Nurse it yourself with the Case: no Coin, no waiting.',
    requires: { primary: 'wound', when: function (ctx) { return ctx.has('kit_bio'); } },
    effects: [{ consume: 'primary' }, { give: 'health' }, { story: { title: 'The Physician\'s Case', text: 'You dress it yourself, as you have dressed a hundred others. The stitches come out early.' } }],
  });
  R.push({
    id: 'ref_wound_barber', verb: 'reflect', priority: 1, label: 'The Barber-surgeon', duration: 20,
    preview: 'A Coin to the barber-surgeon and the stitches come out now.',
    requires: { primary: 'wound', when: function (ctx) { return ctx.has('funds'); } },
    effects: [{ consume: 'primary' }, { consume: 'funds', n: 1 }, { give: 'health' }, { story: { title: 'The Barber-surgeon', text: 'Silver on the counter and the stitches come out early. You can take a blow again. Probably.' } }],
  });
  R.push({
    id: 'ref_wound_lie', verb: 'reflect', label: 'Lie Still', duration: 40,
    preview: 'Lie still and let it knit faster.',
    requires: { primary: 'wound' },
    effects: [{ modify: 'primary', life: function (ctx) { return ctx.primary.life - 60; } }, { story: { title: 'Lie Still', text: 'A day in the dark with the shutters closed and the barber-surgeon\'s bottle. The stitches hold.' } }],
  });
  rest('ref_stress', 'stress', 'An Evening Off', 25, 'You walk to the mill-race and back without once thinking about a case. On the way home you think about one. It is a start.', 'Put it all down for an evening.');
  rest('ref_tunnel', 'tunnel', 'Clear Your Head', 60, 'You take the string off the walls. You write to your sister. You make yourself admit that you might be wrong. It helps.', 'Step back. Admit you might be wrong about everything.');

  R.push({
    id: 'ref_notes', verb: 'reflect', label: 'Read the Casebook', duration: 20,
    preview: 'Your predecessor\'s casebook, in their cramped, furious hand.',
    requires: ['notes'],
    run: function (ctx) {
      var e = ctx.e;
      ctx.consume(ctx.primary);
      if (e.s.calling === 'master') { ctx.give('looseend'); e.pathGain('master', 1, 'a loose end'); }
      else ctx.give('informant', e.informantSpec(U.pick(ctx.rng, Object.keys(CF.DISTRICTS))));
      ctx.give('funds');
      return { title: 'Their Casebook', text: 'Between the wine-rings and the crossings-out: a name, a street, a few coins tucked in the back board. ' +
        (e.s.calling === 'master' ? 'And a mason\'s mark drawn in the margin, circled three times.' : 'A contact your predecessor trusted.') };
    },
  });
  R.push({
    id: 'ref_architect', verb: 'reflect', label: 'Pull the Thread', duration: 45,
    preview: 'Three loose ends. The same hand, the same three strokes. Lay them side by side.',
    blocked: function (ctx) {
      if (ctx.e.s.calling !== 'master') return 'Whatever pattern is here, it is not yours to chase.';
      if (ctx.count('looseend') < 3) return 'You need three Loose Ends to see the shape of it.';
      if (ctx.e.s.flags.architect) return 'You are already hunting the Architect.';
      return null;
    },
    requires: { primary: 'looseend' },
    run: function (ctx) {
      var e = ctx.e;
      ctx.with('looseend').forEach(ctx.consume);
      e.s.flags.architect = true;
      e.spawnCase('architect', { ctx: ctx, headline: 'The Architect', lead: 'The loose ends tie together.' });
      return { title: 'The Architect', kind: 'major', text: 'You lay the three details side by side on your table at matins, and for the first time you see the shape of the hand that drew them. Someone has been planning the city\'s crimes. You know where they live.' };
    },
  });
  R.push({
    id: 'ref_cold_atlarge', verb: 'reflect', label: 'Old Ghosts', duration: 30,
    preview: 'The unanswered case and the one who walked. Think about where they would go.',
    blocked: function (ctx) { return ctx.e.roomForCase(1) ? null : 'The desk is full. Close or let go of a case before you raise the hue and cry.'; },
    requires: ['coldcase', 'atlarge'],
    run: function (ctx) {
      var e = ctx.e;
      var al = ctx.first('atlarge');
      ctx.consume(ctx.first('coldcase'));
      var card = e.spawnCase('manhunt', { ctx: ctx, culpritName: al.data.name, culpritTrait: al.data.trait, atLargeUid: al.uid,
        headline: 'Hue and Cry: ' + al.data.name, lead: 'You think you know where ' + al.data.name + ' went.' });
      al.data.hunted = card.caseId;
      e.pathGain('master', 1, 'reopened a cold trail');
      if (e.s.calling === 'master') ctx.give('looseend');
      return { title: 'Old Ghosts', text: 'You read the old book again, and think like ' + al.data.name + '. Where would you go? Who would you trust? By first light, you have a guess.' +
        (e.s.calling === 'master' ? ' And in the margin of the old book, a doodle you never noticed: three strokes, a mason\'s mark.' : '') };
    },
  });
  R.push({
    id: 'ref_dagger', verb: 'reflect',
    label: function (ctx) { return ctx.count('funds') >= 2 ? 'Pay the Mountain' : 'Endure the Warning'; },
    duration: 20,
    preview: function (ctx) { return ctx.count('funds') >= 2 ? 'Two Coin left where the dagger lay. The Order takes it, and leaves you alone for a season.' : 'Bar the door, change the servant, sleep with a blade. They cannot be broken. They can be outlasted, sometimes.'; },
    danger: function (ctx) { return ctx.count('funds') >= 2 ? null : (ctx.e.blowWouldKill() ? 'You already carry a Wound: another will kill you. ' : '') + 'Dread +1 · Vendetta +2 · they may come anyway'; },
    requires: { primary: 'dagger' },
    run: function (ctx) {
      var e = ctx.e;
      ctx.consume(ctx.primary);
      if (ctx.count('funds') >= 2) {
        ctx.with('funds').slice(0, 2).forEach(ctx.consume);
        e.s.flags.mountainPaidUntil = e.s.week + CF.Societies.MOUNTAIN.grace;
        e.count('purse', 0);
        return { title: 'The Mountain Is Paid', text: 'You leave the Coin where the dagger lay. In the morning both are gone. Nobody in the house saw anything.' };
      }
      e.meter('dread', 1);
      e.meter('retaliation', 2);
      if (ctx.rng() < 0.3) { e.hurtYou('A man in a servant\'s coat on the Watch-house stair, a blade under the ribs, and gone before anyone shouts.'); return { title: 'They Came Anyway', text: 'The Order keeps its word. Not all of it, this time.' }; }
      return { title: 'Endured', text: 'You bar the door and change the servant and sleep, when you sleep, with a blade. Nothing comes. For now.' };
    },
  });
  R.push({
    id: 'ref_eumenides', verb: 'reflect', label: 'The Hospital Door', duration: 40,
    preview: 'Two torsos, one hospital. The Brotherhood of St Julian feeds the poor and sits on the Council. Open the case against it.',
    blocked: function (ctx) { return ctx.e.s.flags.eumenidesCase && ctx.e.caseRec(ctx.e.s.flags.eumenidesCase).status === 'open' ? 'The case against the Brotherhood is already open.' : ctx.e.s.flags.eumenidesBroken ? 'The Brotherhood is finished.' : null; },
    requires: { primary: 'thread', when: function (ctx) { var f = ctx.e.fronts()[ctx.primary.data.front]; return !!(f && f.society === 'eumenides'); } },
    run: function (ctx) {
      ctx.consume(ctx.primary);
      ctx.e.openEumenides(ctx);
      return { title: 'The Eumenides', kind: 'major', text: 'Two torsos, one door: the Hospital of St Julian, whose board of charity is half the Council. Behind its chapter house there is a room with a drain in the floor. You have a case now. You do not yet have a friend on the Hill.' };
    },
  });
  R.push({
    id: 'ref_thread', verb: 'reflect', label: 'Close In', duration: 30,
    preview: 'The thread and the band it leads to. Think about who goes in and out, and when.',
    blocked: function (ctx) { return ctx.has('gang') || ctx.has('syndicate') ? null : 'Add the Band or Coquille card the thread leads to.'; },
    requires: { primary: 'thread' },
    run: function (ctx) {
      var e = ctx.e, th = ctx.primary;
      var target = ctx.first('gang') || ctx.first('syndicate');
      var front = e.fronts()[th.data.front];
      if (front) front.watched = true;
      ctx.consume(th);
      e.meter('reputation', 1);
      e.pathGain('master', 1, 'closed in on the network');
      if (e.s.calling === 'master') ctx.give('looseend');
      return { title: 'The Shape of It', kind: 'major', text: 'You draw the map on the wall of your study: the cases, the place, ' + e.labelOf(target) + '. A Disguise through ' + (front ? front.name : 'the front') + ' will be safer now that you know the doors.' +
        (e.s.calling === 'master' ? ' And in the corner of the map, something that is not a band at all: a mason\'s mark.' : '') };
    },
  });
  R.push({
    id: 'stakeout_front', verb: 'investigate', src: 'stakeout', rank: 2, label: 'Watch the Front',
    duration: function (ctx) { return Math.round((ctx.e.s.rooms.survroom ? 30 : ctx.e.gearWith(ctx, 'unlocksVerb').length ? 40 : 60) * (ctx.e.teamHas(ctx, 'patient') ? 0.8 : 1)); },
    preview: function (ctx) { return 'Stand in a doorway across from ' + ctx.e.labelOf(ctx.primary) + ' and write down who comes and goes.'; },
    blocked: function (ctx) { return ctx.slots.mind ? null : 'Someone has to watch: you (Instinct) or a watchman.'; },
    requires: { primary: 'front', when: function (ctx) { return !!ctx.slots.mind; } }, forbids: ['focus'],
    run: function (ctx) {
      var e = ctx.e, fc = ctx.primary;
      var front = e.fronts()[fc.data.front];
      if (front) front.watched = true;
      if (ctx.has('instinct') && !e.s.rooms.survroom) maybe(ctx, 0.4, 'fatigue');
      var linked = front ? e.casesAtFront(front.id) : [];
      var got = [];
      linked.forEach(function (rec) {
        ctx.give('clue', e.clueSpec(rec, { label: 'Seen at ' + front.name, text: 'Seen going into ' + front.name + ' with a sack, and coming out without it: someone from ' + rec.title + '.', aspects: { opportunity: 2, financial: 1 }, tags: ['watching'] }, e.helpers(ctx)));
        var sc = e.revealSuspect(rec, ctx);
        if (sc) got.push(e.labelOf(sc));
      });
      if (!linked.length) return { title: 'A Quiet Night', text: 'A carter, a drunk, a cat. Nothing tonight ties ' + (front ? front.name : 'the place') + ' to an open case. It will.' };
      return { title: 'Who Comes and Goes', text: 'By first light you have a leaf of names and hours, and a face for each of your open cases.' + (got.length ? ' New faces: ' + got.join(', ') + '.' : '') };
    },
  });
  R.push({
    id: 'ref_sighting', verb: 'reflect', label: 'Follow the Sighting', duration: 20,
    preview: 'An informer saw them. Put it beside their card and think about where they sleep.',
    blocked: function (ctx) {
      var al = ctx.first('atlarge');
      if (!al) return 'Add the Abroad card of the person who was seen.';
      if (al.data.name !== ctx.primary.data.criminal) return 'That is not who was seen.';
      if (al.data.hunted && ctx.e.caseRec(al.data.hunted) && ctx.e.caseRec(al.data.hunted).status === 'open') return 'You are already hunting them.';
      if (!ctx.e.roomForCase(1)) return 'The desk is full. Close or let go of a case before you raise the hue and cry.';
      return null;
    },
    requires: { primary: 'intel', when: function (ctx) { return ctx.primary.data.kind === 'sighting'; } },
    run: function (ctx) {
      var e = ctx.e, al = ctx.first('atlarge');
      if (!al) return { title: 'Gone Again', text: 'By the time you get there, whoever was seen has moved on, or been moved.' };
      ctx.consume(ctx.primary);
      var card = e.spawnCase('manhunt', { ctx: ctx, culpritName: al.data.name, culpritTrait: al.data.trait, atLargeUid: al.uid, criminalId: al.data.criminalId,
        headline: 'Hue and Cry: ' + al.data.name, lead: 'An informer\'s word and a map.' });
      al.data.hunted = card.caseId;
      var crim = al.data.criminalId && e.criminal(al.data.criminalId);
      if (crim) crim.status = 'hunted';
      return { title: 'The Same Tavern Every Night', text: 'You stand across the lane from it for two nights. On the second, ' + al.data.name + ' walks in.' };
    },
  });
  R.push({
    id: 'ref_intel_none', verb: 'reflect', label: 'A Warning', duration: 10,
    preview: 'Nothing to reason about yet.',
    blocked: 'Keep this on the table. It pays off when the case comes in.',
    requires: { primary: 'intel', when: function (ctx) { return ctx.primary.data.kind !== 'sighting'; } },
  });
  // The old book has leaves nobody read: once per unanswered case, one of
  // the things never found becomes a token that keeps until the case is opened again.
  function oldBookItem(cc) {
    var from = cc.data.from;
    if (cc.data.read || !from || !from.items || !from.items.length) return null;
    return from.items.filter(function (it) { return it.type === 'clue'; })[0] || from.items[0];
  }
  R.push({
    id: 'ref_cold', verb: 'reflect', label: function (ctx) { return oldBookItem(ctx.primary) ? 'Read the Old Book' : 'Regret'; }, duration: 10,
    preview: function (ctx) { return oldBookItem(ctx.primary) ? 'Turn the leaves of the old book. Something in it was never read.' : 'Turn the unanswered case over in your mind. It will not change anything on its own.'; },
    requires: ['coldcase'],
    run: function (ctx) {
      var e = ctx.e, cc = ctx.primary, item = oldBookItem(cc);
      if (!item) return { title: 'Regret', text: 'You remember every mistake. If you knew where the one who walked was now, you could do something about it.' };
      var from = cc.data.from;
      from.items.splice(from.items.indexOf(item), 1);
      cc.data.read = true;
      var read = item.type === 'clue' ? item : (item.result || item);
      ctx.give('clue', { label: read.label, desc: 'Between two leaves of the old book, something the beadle bagged and nobody read.', aspects: U.clone(read.aspects || {}),
        caseId: from.id || null, lifetime: 0, data: { trait: item.trait || null, coerced: false, planted: false, illegal: false, points: null, link: item.link || null, oldBook: true } });
      return { title: 'The Old Book', text: 'Between two leaves of the old book, something the beadle bagged and nobody read. It keeps until the case is opened again.' };
    },
  });
  // Deduction: clues laid side by side become theories, identifications, or
  // nothing at all (see js/data/deductions.js).
  function deduction(ctx) { return CF.Deduce.find(ctx.with('clue'), ctx.e.countOf('tunnel') > 0); }
  R.push({
    id: 'ref_deduce', verb: 'reflect', priority: 5,
    label: function (ctx) { return deduction(ctx).label; },
    duration: function (ctx) { return deduction(ctx).duration || 30; },
    preview: function (ctx) {
      var d = deduction(ctx);
      if (d.id === 'identify') return 'These fit together: one name, and everything they carried.';
      return d.gives ? 'These fit together. Something new comes of it.' : 'These do not fit together. It is worth knowing why.';
    },
    blocked: function (ctx) {
      if (CF.Deduce.crossCase(deduction(ctx))) return null;
      var cl = ctx.with('clue'), id = cl[0].caseId;
      return cl.every(function (c) { return c.caseId === id; }) ? null : 'These tokens belong to different cases.';
    },
    requires: { primary: 'clue', when: function (ctx) { return ctx.with('clue').length >= 2 && !!deduction(ctx); } },
    run: function (ctx) {
      var clues = ctx.with('clue');
      var d = deduction(ctx);
      if (CF.Deduce.crossCase(d)) return CF.Deduce.run(ctx, d, null, clues);
      var rec = openRec(ctx, clues[0]);
      if (!rec) return closed();
      ctx.e.caseWork(rec, ctx);
      return CF.Deduce.run(ctx, d, rec, clues);
    },
  });
  R.push({
    id: 'ref_corroborate', verb: 'reflect', label: 'Corroborate', duration: 15,
    preview: 'Two pieces of the same truth, told in different ways. Bind them into one stronger token.',
    blocked: function (ctx) {
      var cl = ctx.with('clue');
      if (cl.length < 2) return 'You need at least two tokens.';
      var id = cl[0].caseId;
      if (!cl.every(function (c) { return c.caseId === id; })) return 'These tokens belong to different cases.';
      // They must have something in common to corroborate each other.
      var first = CF.clueAspects(cl[0]);
      var share = cl.slice(1).every(function (c) { var a = CF.clueAspects(c); for (var k in a) if (first[k]) return true; return false; });
      return share ? null : 'These tokens do not tell the same story. Nothing binds them.';
    },
    requires: { primary: 'clue' },
    run: function (ctx) {
      var e = ctx.e;
      var cl = ctx.with('clue');
      var rec = openRec(ctx, cl[0]);
      if (!rec) return closed();
      var aspects = {};
      var data = { misread: false, coerced: false, planted: false, corroborated: true, trait: null, points: null };
      cl.forEach(function (c) {
        U.addAspects(aspects, CF.clueAspects(c));
        data.misread = data.misread || !!c.data.misread;
        data.coerced = data.coerced || !!c.data.coerced;
        data.planted = data.planted || !!c.data.planted;
        if (c.data.trait) data.trait = c.data.trait;
        if (c.data.points) data.points = c.data.points;
      });
      var best = Object.keys(aspects).sort(function (a, b) { return aspects[b] - aspects[a]; })[0];
      if (best) aspects[best]++;
      var names = cl.map(function (c) { return e.labelOf(c).replace(/^(Corroborated|Deposition|Statement|Partial): /, ''); });
      var card = ctx.give('clue', { label: 'Corroborated: ' + names[0], desc: names.join(' + ') + '. Each makes the other harder to dismiss.', aspects: aspects, caseId: rec.id, data: data });
      cl.forEach(ctx.consume);
      e.caseWork(rec, ctx);
      return { title: 'Corroborated', text: names.join(' and ') + ' tell the same story. Together, they are harder to argue with.' };
    },
  });
  var THEORIES = [
    { need: ['motive', 'opportunity'], title: 'Means and Moment', text: 'Who wanted it, and who could have done it. When you lay the reason beside the chance, only one face fits both.' },
    { need: ['testimony', 'motive'], title: 'Breakthrough', text: 'What the witnesses said, and why anyone would want this. Suddenly the story tells itself.' },
    { need: ['forensic', 'testimony'], title: 'Corroborated Account', text: 'The body of the thing and the words of the witnesses finally agree. They point the same way.' },
    { need: ['forensic', 'opportunity'], title: 'Hands and Hours', text: 'What was left behind, and who could have been there to leave it. The marks narrow the door until only one person fits through it.' },
  ];
  R.push({
    id: 'ref_theory', verb: 'reflect', label: 'Build a Theory', duration: 45,
    preview: 'Pin the case to the wall with its tokens around it. Look for how they connect.',
    requires: ['case', 'clue'],
    run: function (ctx) {
      var e = ctx.e;
      var rec = openRec(ctx, ctx.primary);
      if (!rec) return closed();
      e.caseWork(rec, ctx);
      var clues = slotClues(ctx, ['a', 'b', 'c']);
      if (clues.some(function (c) { return c.caseId !== rec.id; })) {
        return { title: 'Crossed Wires', text: 'Some of this belongs to a different case. You spend the night trying to make it fit before you notice.' };
      }
      var agg = {};
      clues.forEach(function (c) { U.addAspects(agg, CF.clueAspects(c)); });
      var misread = clues.some(function (c) { return c.data.misread; });
      if (agg.financial && agg.digital && !rec.moneyTrail) {
        rec.moneyTrail = true;
        ctx.give('clue', e.clueSpec(rec, { label: 'Follow the Coin', text: 'The papers and the coin tell one story: who paid, and who profited.', aspects: { financial: 1, motive: 2 } }, []));
        return { title: 'Follow the Coin', text: 'You read the accounts against the papers until your eyes blur. Then the coin starts to move on the page, and you follow it.' };
      }
      var th = THEORIES.filter(function (t) { return agg[t.need[0]] && agg[t.need[1]]; })[0];
      if (!th) {
        return { title: 'Not Yet', text: 'The pieces are all there on the wall, and they do not fit. Not yet. Something is missing.' };
      }
      if (rec.identified) {
        var known = rec.suspects.filter(function (x) { return x.key === rec.identified; })[0];
        return { title: 'You Already Know', text: 'It keeps coming back to ' + known.name + '. You know who did it. Now you have to prove it.' };
      }
      // A name only when the tokens give one: a token that points at an
      // accused, or a trait that one of the accused carries.
      var named = clues.map(function (c) { return c.data.points; }).filter(Boolean)[0] || null;
      var laidTrait = clues.filter(function (c) { return !c.data.alibi; }).map(function (c) { return c.data.trait; }).filter(Boolean)[0] || null;
      var fits = rec.suspects.filter(function (x) { return !x.cleared && (x.key === named || (laidTrait && x.trait === laidTrait)); })[0] || null;
      if (fits) {
        var key = fits.key;
        if (misread) {
          var others = rec.suspects.filter(function (x) { return !x.guilty && !x.cleared; });
          if (others.length) key = U.pick(ctx.rng, others).key;
        }
        var sus = identify(ctx, rec, key);
        return { title: th.title, kind: 'major', text: th.text + ' It was ' + sus.name + ', ' + sus.role + '. It has to be.' };
      }
      // The theory itself is a token, once per kind: what sort of person, not yet which.
      var td = laidTrait && trait(laidTrait);
      var who = td ? (td.who || td.desc.charAt(0).toLowerCase() + td.desc.slice(1)) : '';
      rec.theories = rec.theories || {};
      if (!rec.theories[th.title]) {
        rec.theories[th.title] = true;
        ctx.give('clue', e.clueSpec(rec, { label: 'Theory: ' + th.title, text: th.text + (who ? ' Someone who ' + who : ''), aspects: { motive: 1, opportunity: 1 }, trait: laidTrait }, []));
      }
      return { title: th.title, text: th.text + ' You know what kind of person. Not yet which.' };
    },
  });
  R.push({
    id: 'ref_mull', verb: 'reflect', label: 'Mull It Over', duration: 15,
    preview: 'Sit with the case. What kind of case is it? What will it take?',
    requires: ['case'],
    run: function (ctx) {
      var e = ctx.e;
      var rec = openRec(ctx, ctx.primary);
      if (!rec) return closed();
      e.caseWork(rec, ctx);
      var unmet = rec.suspects.filter(function (x) { return !x.revealed && !x.cleared; }).length;
      var prof = CF.Charge.profileOf(rec), need = CF.Charge.needOf(prof);
      var sure = need >= 9 ? 'It will take a mountain of proof.' : need >= 7 ? 'It will take full proof.' : 'A good charge should hold.';
      var wants = Object.keys(prof).map(function (k) { return CF.ASPECTS[k].label + ' ' + prof[k]; }).join(', ');
      return { title: 'Thinking It Through', text: 'This case will turn on ' + aspectList(rec.keyAspects) + ' (' + wants + '). ' + sure + ' ' +
        (unmet ? 'There is someone involved you have not met yet.' : 'You have met everyone who matters. One of them did it.') };
    },
  });

  // =================================================================== ARREST
  R.push({
    id: 'arrest_charge', verb: 'arrest', label: function (ctx) { return 'Charge ' + ctx.e.labelOf(ctx.primary).replace('Prime Suspect: ', ''); },
    duration: 30,
    preview: function (ctx) {
      var e = ctx.e;
      var rec = ctx.caseOf(ctx.primary);
      if (!rec) return '';
      var a = e.assessCharge(ctx.primary, slotClues(ctx, ['c1', 'c2', 'c3', 'c4']));
      return 'The charge is ' + CF.Charge.TIERS[a.tier].label.toLowerCase() + '. ' + CF.Charge.TIERS[a.tier].text;
    },
    detail: function (ctx) {
      var a = ctx.e.assessCharge(ctx.primary, slotClues(ctx, ['c1', 'c2', 'c3', 'c4']));
      return { charge: CF.Charge.describe(a) };
    },
    requires: ['suspect'],
    run: function (ctx) {
      var e = ctx.e;
      var sc = ctx.primary;
      var rec = openRec(ctx, sc);
      if (!rec) return closed();
      var sus = e.suspectOf(sc);
      var clues = slotClues(ctx, ['c1', 'c2', 'c3', 'c4']);
      var a = e.assessCharge(sc, clues);
      rec.status = 'trial';
      if ((rec.template === 'syndicate' || rec.template === 'gang') && e.breakTreaty) e.breakTreaty('You have indicted one of the Court\'s own.');
      e.releaseDelegate(rec);
      var caseCard = e.caseCard(rec.id);
      if (caseCard) e.remove(caseCard);
      e.clearCaseCards(rec.id, clues.filter(function (c) { return c.caseId !== rec.id; }));
      ctx.give('trial', {
        label: 'Blood Court: ' + sus.name,
        desc: sus.name + ' stands before the Blood Court for ' + rec.title + '. The charge looked like ' + CF.Charge.TIERS[a.tier].label.toLowerCase() + '.',
        data: { caseId: rec.id, name: sus.name, guilty: sus.guilty, solid: a.solid, tier: a.realTier, real: a.real, need: a.need,
          coerced: a.coerced, planted: a.planted, illegal: a.unwarranted, contradictions: a.contradictions, confession: a.confession, checked: a.checked, framed: a.framed },
      });
      ctx.give('paperwork');
      return { title: 'Taken: ' + sus.name, text: 'The sergeants take them at ' + U.pick(ctx.rng, ['first light, on their doorstep', 'their shop, in front of everyone', 'the Red Ox, mid-sentence', 'the city gate, one foot on the carrier\'s wagon']) +
        '. The charge is ' + CF.Charge.TIERS[a.tier].label.toLowerCase() + '. Now it is for the sworn men.' };
    },
  });

  // ================================================================= SENTENCE
  R.push({
    id: 'sen_none', verb: 'arrest', src: 'sentence', label: 'The Ladder', duration: 5,
    preview: function (ctx) {
      var d = ctx.primary.data;
      return d.name + ' waits in the Hole. Custom would give them ' + CF.Sentence.rungLabel(d.template, d.custom).toLowerCase() + '. Put a rung of the ladder beside them; a plea or a free confession is a reason for mercy.';
    },
    blocked: 'Choose a rung of the ladder.',
    requires: ['condemned'],
    forbids: ['rung'],
  });
  R.push({
    id: 'sen_pass', verb: 'arrest', src: 'sentence',
    label: function (ctx) { return CF.Sentence.rungLabel(ctx.primary.data.template, ctx.first('rung').data.rung); },
    duration: 10,
    preview: function (ctx) {
      var d = ctx.primary.data, r = ctx.first('rung').data.rung, R0 = CF.RUNGS[r];
      var plea = ctx.slots.plea;
      var reason = d.penitent || (plea && (plea.def === 'plea' || plea.data.confession === 'free'));
      var lighter = CF.Sentence.ORDER.indexOf(r) < CF.Sentence.ORDER.indexOf(d.custom);
      var out = R0.desc;
      if (r === 'pardon') out += reason ? ' You have a reason the Council will accept.' : ' You have no reason to give the Council.';
      if (plea && plea.def === 'plea' && plea.data.purse && lighter) out += ' The letter is heavier than paper, and you know what that means.';
      if (lighter && r !== 'pardon') out += ' Lighter than custom; the crowd notices.';
      if (r === 'sword' && CF.Sentence.ladderOf(d.template).capital && d.custom === 'wheel') out += ' Commuted out of mercy.';
      return out;
    },
    danger: function (ctx) { return CF.RUNGS[ctx.first('rung').data.rung].cost; },
    requires: ['condemned', 'rung'],
    run: function (ctx) {
      var e = ctx.e, cond = ctx.primary, rung = ctx.first('rung');
      if (rung.data.condemned !== cond.uid) return { title: 'The Wrong Ladder', text: 'That rung belongs to somebody else\'s sentence.' };
      var plea = ctx.slots.plea || null;
      if (plea && plea.def !== 'plea' && plea.data.confession !== 'free') plea = null;
      var res = e.passSentence(cond, rung.data.rung, plea, { quiet: true });
      ctx.consume(cond);
      if (plea) ctx.consume(plea);
      ctx.give('paperwork');
      return res;
    },
  });

  // ============================================================== REQUISITION
  R.push({
    id: 'req_buy', verb: 'duty', src: 'requisition',
    label: function (ctx) { return ctx.has('personnel') ? 'Take On: ' + CF.PERSONNEL[ctx.primary.data.personnel].label : 'Petition For: ' + CF.ORDERS[ctx.primary.data.order].label; },
    duration: 10,
    preview: function (ctx) { return 'Costs ' + CF.costOf(ctx.primary) + ' Coin.'; },
    blocked: { funds: function (ctx) { return CF.costOf(ctx.primary); } },
    requires: { primary: ['order', 'personnel'] },
    run: function (ctx) {
      var e = ctx.e;
      var p = ctx.primary;
      var cost = CF.costOf(p);
      ctx.with('funds').slice(0, cost).forEach(ctx.consume);
      if (p.data.personnel) {
        var t = ctx.give('teammate', e.teammateSpec(p.data.personnel));
        ctx.consume(p);
        return { title: 'Sworn In', text: t.data.name + ' takes the oath at the Watch-house door. ' + CF.PERSONNEL[p.data.personnel].desc };
      }
      var o = CF.ORDERS[p.data.order];
      e.removeOrder(p.data.order);
      ctx.consume(p);
      if (o.room) {
        e.s.rooms[o.room] = true;
        e.pathGain('commissioner', 1, 'built the ' + o.label);
        ctx.give('room', { label: CF.ROOMS[o.room].label, desc: CF.ROOMS[o.room].desc });
        return { title: 'The Watch-house: ' + o.label, text: 'Masons, lime dust and a blessing from the Bishop\'s chaplain. The ' + o.label + ' is open. ' + CF.ROOMS[o.room].desc };
      }
      var gear = ctx.give(o.give);
      var mods = CF.CARDS[gear.def].mods;
      var opened = mods && mods.unlocksVerb && CF.POWERS[mods.unlocksVerb] && e.s.rank < CF.POWERS[mods.unlocksVerb].rank;
      return { title: 'Delivered: ' + o.label, text: 'It arrives by carrier in a crate with the wrong name on it. It works perfectly.' + (opened ? ' With it, you can keep a Watch.' : '') };
    },
  });

  // ================================================================== WARRANT
  R.push({
    id: 'warrant_search', verb: 'investigate', src: 'warrant', rank: 1, label: 'Serve the Writ', duration: 40,
    preview: 'Break the door at first light. Search their house and shop. If you are wrong, it will be noted.',
    danger: function () { return 'Suspicion +1 if they are innocent'; },
    blocked: function (ctx) {
      var cause = ctx.slots.cause;
      if (!cause) return 'You need cause: a token from their case.';
      if (cause.caseId !== ctx.primary.caseId) return 'That token has nothing to do with this accused. No magistrate will seal it.';
      return null;
    },
    requires: ['suspect', 'clue'],
    run: function (ctx) {
      var e = ctx.e;
      var sc = ctx.primary;
      var rec = openRec(ctx, sc);
      if (!rec) return closed();
      var sus = e.suspectOf(sc);
      e.caseWork(rec, ctx);
      if (!sus.guilty) {
        e.meter('scrutiny', 1);
        return { title: 'Nothing There', text: 'You turn ' + sus.name + '\'s house upside down. Their children watch from the stair. There is nothing. Their advocate writes to the Burgomaster.' };
      }
      var finds = [
        { label: 'Found at ' + sus.name + '\'s House', text: 'Hidden under the floorboards, wrapped in oilcloth.', aspects: { forensic: 2, financial: 1 } },
        { label: 'The Goldsmith\'s Tally', text: 'Deposits that do not match their trade, on dates that match the crime.', aspects: { financial: 2, motive: 1 } },
        { label: 'Letters in a Chest', text: 'Correspondence that says far more than its writer ever meant it to.', aspects: { motive: 2, testimony: 1 } },
      ];
      var f = U.pick(ctx.rng, finds);
      ctx.give('clue', e.clueSpec(rec, f, ctx.with('teammate')));
      return { title: 'The Search', text: 'First light. The door gives to the sergeant\'s shoulder. ' + sus.name + ' stands in their shift while you work. ' + f.text };
    },
  });

  // ================================================================= STAKEOUT
  R.push({
    id: 'stakeout_watch', verb: 'investigate', src: 'stakeout', rank: 2, label: 'Watch Their Door',
    duration: function (ctx) { return Math.round((ctx.e.s.rooms.survroom ? 30 : ctx.e.gearWith(ctx, 'unlocksVerb').length ? 40 : 60) * (ctx.e.teamHas(ctx, 'patient') ? 0.8 : 1)); },
    preview: 'A shuttered lantern, a doorway, and a long night watching one door.',
    requires: { aspects: ['suspect'], when: function (ctx) { return !!ctx.slots.mind; } }, forbids: ['clue', 'focus'],
    run: function (ctx) {
      var e = ctx.e;
      var sc = ctx.primary;
      var rec = openRec(ctx, sc);
      if (!rec) return closed();
      var sus = e.suspectOf(sc);
      if (ctx.has('instinct') && !e.s.rooms.survroom) maybe(ctx, 0.4, 'fatigue');
      if (!sus.guilty) {
        sus.cleared = true;
        ctx.consume(sc);
        return { title: 'Cleared: ' + sus.name, text: 'All night, ' + sus.name + ' does nothing but sleep, feed a cat and empty a pot from the window. Whatever happened, it was not them.' };
      }
      ctx.give('clue', e.clueSpec(rec, { label: 'Caught in the Act', text: 'At matins, ' + sus.name + ' goes out, meets someone, and does exactly what you hoped they would.' + (ctx.has('tool') ? ' You have a drawing of the face, and every word written down.' : ''), aspects: { opportunity: 3 }, tags: ['watching'] }, e.helpers(ctx)));
      return { title: 'Worth the Cold', text: 'Just before first light, the door opens. ' + sus.name + ' looks both ways, and does not see you.' };
    },
  });

  // The Pattern read: the next door is known, and somebody stands in it.
  R.push({
    id: 'inv_next_door', verb: 'investigate', label: 'Stand in the Doorway', duration: 45,
    preview: 'The lane he walks next, the night after the fair. Stand in the doorway with the lantern shuttered.',
    blocked: function (ctx) { return ctx.has('instinct') || ctx.has('teammate') ? null : 'Somebody has to stand in the doorway: Instinct, or a watchman.'; },
    requires: { primary: 'nextdoor' },
    run: function (ctx) {
      var e = ctx.e;
      var rec = openRec(ctx, ctx.primary);
      if (!rec) return closed();
      e.caseWork(rec, ctx);
      e.revealSuspect(rec, ctx, { key: rec.culprit });
      ctx.give('clue', e.clueSpec(rec, { label: 'Taken at the Door', text: 'He came up the lane at the hour the lamps go out, and you were in the doorway.',
        aspects: { opportunity: 3, forensic: 2 }, tags: ['watching'] }, e.helpers(ctx), { points: rec.culprit, noMisread: true }));
      ctx.consume(ctx.primary);
      return { title: 'The Doorway', kind: 'major', text: 'He comes up the lane at the hour the lamps go out, gentle-voiced, a cloth over his arm. He asks her name. You say yours.' };
    },
  });

  // =============================================================== UNDERCOVER
  // ---- The Court of Miracles: parley, the Court's trial, the throne.
  R.push({
    id: 'duty_tribute', verb: 'duty', label: 'Take the Tribute', duration: 5,
    preview: 'The King of Thunes pays his Examiner. Two Coin, and a week the Court owns a little more of you.',
    danger: 'Purse +1',
    requires: ['tribute'],
    run: function (ctx) {
      ctx.consume(ctx.primary);
      ctx.give('funds'); ctx.give('funds');
      ctx.e.count('purse', 1);
      var court = ctx.e.court();
      court.ignoredTribute = 0;
      court.tributeNoted = false;
      return { title: 'The Tribute', text: 'Two Coin, clipped and heavy. You do not ask whose they were.' };
    },
  });
  R.push({
    id: 'undercover_parley', verb: 'investigate', src: 'undercover', rank: 2, label: 'Parley with the King', duration: 40,
    preview: function (ctx) {
      var court = ctx.e.court();
      if (court.stance === 'treaty') return 'The Treaty stands. There is nothing to say that the King has not heard.';
      return 'Go as yourself, unarmed, to a front in the Warrens, and sit across a barrel from the King of Thunes. A Treaty: the Court tries its own, hands you a culprit a week, keeps the Stews quiet, and pays tribute if you take it. It costs a blind eye, the Bishop\'s good opinion, and every step of the Justice path while it stands.';
    },
    danger: 'Justice scores nothing under a Treaty',
    blocked: function (ctx) { return ctx.e.court().stance === 'treaty' ? 'The Treaty already stands.' : ctx.e.court().inside ? 'You are inside the Court already; kings do not parley with their own.' : null; },
    requires: ['syndicate', 'focus'],
    run: function (ctx) {
      var e = ctx.e, king = e.court().king;
      e.makeTreaty();
      e.pathGain('commissioner', 1, 'made a treaty with the Coquille');
      return { title: 'The Treaty', kind: 'major', text: 'A cellar under the Warrens where the lame walk and the blind see. ' + (king ? king.name : 'The King of Thunes') + ' pours the wine himself. By the end of it you have agreed that the Court will try its own, that the Stews will be quiet, and that some cases will arrive on your desk already answered. Nobody writes anything down.' };
    },
  });
  R.push({
    id: 'undercover_trial', verb: 'investigate', src: 'undercover', rank: 2, label: 'Stand the Court\'s Trial', duration: 60,
    preview: 'The bell-hung dummy: a purse to be picked without a sound, before the whole Court, with Instinct against the King\'s eye. Pass, and you are of the Coquille, and may stay inside it. Fail, and they take it out of your hide.',
    danger: 'Dangerous: you may be Wounded',
    blocked: function (ctx) {
      var court = ctx.e.court();
      if (court.stance === 'treaty') return 'You have a Treaty with the King. He will not try a man he dines with.';
      return ctx.count('funds') >= 2 ? null : 'The doorkeeper wants 2 Coin.';
    },
    requires: { aspects: ['syndicate', 'instinct'], when: function (ctx) { return ctx.count('funds') >= 2 && !ctx.e.court().inside; } },
    run: function (ctx) {
      var e = ctx.e;
      ctx.with('funds').slice(0, 2).forEach(ctx.consume);
      if (ctx.rng() < 0.6) {
        e.enterCourt();
        e.count('cruelty', 0);
        return { title: 'Of the Coquille', kind: 'major', text: 'The dummy hangs from the beam with a hundred little bells sewn on. You lift the purse and not one of them speaks. The Court roars. You are one of them now, and you may stay as long as you like. Nobody asks what you do in the daytime.' };
      }
      e.hurtYou('A bell rings. Then all of them. They beat you at the foot of the King\'s barrel and throw you into the Warrens ditch, and you are lucky it is only that.');
      return { title: 'A Bell Rings', text: 'One bell, then all of them. The Court has its fun with you before it throws you out.' };
    },
  });
  R.push({
    id: 'undercover_throne', verb: 'investigate', src: 'undercover', rank: 2, label: 'Take the Throne', duration: 30,
    preview: function (ctx) { return ctx.e.canTakeThrone() ? 'The old King is tired and the Court knows what you are. Take the barrel. You will run the underworld and the Examiner\'s office both, and decide who is caught.' : 'Not yet: ' + ctx.e.throneReason() + '.'; },
    blocked: function (ctx) { return ctx.e.canTakeThrone() ? null : 'Not yet: ' + ctx.e.throneReason() + '.'; },
    requires: { aspects: ['syndicate', 'instinct'], when: function (ctx) { return ctx.e.court().inside; } },
    run: function (ctx) {
      ctx.e.gameOver('kingofthunes');
      return { title: 'The King of Thunes', kind: 'major', text: 'The old King goes into the river. The Court kneels.' };
    },
  });
  R.push({
    id: 'undercover_op', verb: 'investigate', src: 'undercover', rank: 2,
    label: function (ctx) { return ctx.has('syndicate') ? 'Go Down to the Court' : ctx.has('gang') ? 'Go Among the Band' : 'Track Them Down'; },
    duration: 90,
    preview: function (ctx) {
      if (ctx.has('syndicate')) return 'Go deeper than you have ever gone. With two leaves of the ledger you can open a case against the Coquille itself; without them, you might steal one.';
      if (ctx.has('gang')) return 'A new name, a new past, and months of pretending. Get close enough to build a case against their upright man.';
      return 'Go to ground in their world until you find them.';
    },
    danger: function (ctx) { return (ctx.e.blowWouldKill() ? 'You already carry a Wound: another will kill you. ' : '') + 'Dangerous: you may be Wounded' + (ctx.has('teammate') ? ' (a second halves the risk)' : ''); },
    blocked: function (ctx) {
      if (!ctx.has('instinct')) return ctx.has('focus') && (ctx.has('syndicate') || ctx.primary.def === 'front') ? null : 'You need Instinct to hold a cover.';
      if (ctx.primary.def === 'atlarge' && !ctx.e.roomForCase(1)) return 'The desk is full. Close or let go of a case before you raise the hue and cry.';
      var g = ctx.first('gang') || (ctx.primary.def === 'front' ? ctx.e.cardsOf('gang').filter(function (x) { return x.data.name === ctx.primary.data.gang; })[0] : null);
      if (g && g.data.caseId && ctx.e.caseRec(g.data.caseId) && ctx.e.caseRec(g.data.caseId).status === 'open') return 'You already have an operation running against them.';
      if (ctx.has('syndicate') && ctx.e.s.flags.syndicateCase && ctx.e.caseRec(ctx.e.s.flags.syndicateCase).status === 'open') return 'The case against the Coquille is already open.';
      return null;
    },
    requires: { primary: ['atlarge', 'gang', 'syndicate', 'front'], when: function (ctx) { return ctx.primary.def !== 'front' || ctx.has('focus'); } },
    run: function (ctx) {
      var e = ctx.e;
      var t = ctx.primary;
      // A known front is a door: it stands in for the gang (or the Syndicate) behind it.
      var via = null;
      if (t.def === 'front') {
        via = e.fronts()[t.data.front];
        var gangCard = e.cardsOf('gang').filter(function (g) { return g.data.name === t.data.gang; })[0];
        t = gangCard || e.cardsOf('syndicate')[0] || null;
        if (!t) return { title: 'Nobody Home', text: 'The place is shuttered. Whoever worked through it has moved on.' };
      }
      var risk = t.def === 'syndicate' ? 0.45 : t.def === 'gang' ? 0.35 : 0.2;
      if (ctx.has('teammate')) risk /= 2;
      if (via && via.watched) risk /= 2;
      e.pathGain('crusader', 1, 'went undercover');
      var out;
      if (t.def === 'atlarge') {
        var c = e.spawnCase('manhunt', { ctx: ctx, culpritName: t.data.name, culpritTrait: t.data.trait, atLargeUid: t.uid, lifetime: 260,
          headline: 'Hue and Cry: ' + t.data.name, lead: 'Your time in disguise has found ' + t.data.name + '.' });
        t.data.hunted = c.caseId;
        out = { title: 'Found Them', text: 'Three weeks in a lodging-house, drinking with the wrong people. Then someone mentions where ' + t.data.name + ' sleeps now.' };
      } else if (t.def === 'gang') {
        e.meter('retaliation', 1);
        // The upright man is the member with the longest record.
        var upright = null;
        (t.data.members || []).forEach(function (n) { var r = e.criminalByName(n); if (r && (!upright || r.crimes > upright.crimes)) upright = r; });
        var gc = e.spawnCase('gang', { ctx: ctx, gangName: t.data.name, gangUid: t.uid, headline: 'Among the Band: ' + t.data.name, lead: 'You are in.',
          culpritName: upright ? upright.name : undefined, culpritTrait: upright ? upright.trait : undefined, criminalId: upright ? upright.id : null });
        t.data.caseId = gc.caseId;
        out = { title: 'Sworn In', kind: 'major', text: 'They trust you now. Mostly. You have seen the tally, the back cellar, and the upright man\'s face. Now build the case before they find out who you are.' };
      } else {
        e.meter('retaliation', 1);
        var ledgers = e.cardsOf('ledger').filter(function (c) { return c.loc.t === 'table'; });
        if (ledgers.length >= 2) {
          ledgers.slice(0, 2).forEach(function (c) { e.remove(c); });
          var king = e.court().king;
          var sc = e.spawnCase('syndicate', { ctx: ctx, headline: 'The Court of Miracles', lead: 'The ledger and your own eyes are enough.',
            culpritName: king ? king.name : undefined, culpritTrait: king ? king.trait : undefined, criminalId: king ? king.criminalId : null });
          e.s.flags.syndicateCase = sc.caseId;
          out = { title: 'The Court of Miracles', kind: 'major', text: 'You pour wine in a cellar under the Warrens where the lame walk and the blind see, and hear the King of Thunes speak for eleven minutes about the city as if he owned it. He does. For now.' };
        } else {
          ctx.give('ledger');
          out = { title: 'A Leaf Torn Out', text: 'In the confusion of a raid on one of their counting-cellars, you slip a single leaf from a ledger into your coat.' };
        }
      }
      if (ctx.rng() < risk) {
        e.hurtYou('Your cover slips. You get out, but not in one piece.');
        out.text += ' But your cover slipped on the way out, and it cost you.';
      }
      return out;
    },
  });

  // =============================================================== TASK FORCE
  R.push({
    id: 'taskforce_run', verb: 'duty', src: 'taskforce', rank: 3, label: 'Call Out the Watch', duration: 60,
    preview: 'Your watchmen take the case and run with it: search, go door to door, dig. They report back when they are done.',
    requires: { aspects: ['case'], when: function (ctx) { return ctx.with('teammate').length >= 2; } },
    run: function (ctx) {
      var e = ctx.e;
      var rec = openRec(ctx, ctx.primary);
      if (!rec) return closed();
      var team = ctx.with('teammate');
      var got = [];
      team.forEach(function (t, i) {
        var it = drawItem(ctx, rec, [t]);
        if (it) got.push(it.label);
        else if (rec.witnesses.length) got.push(ctx.give('witness', e.witnessSpec(rec)).label);
      });
      if (team.length >= 2) { var s = e.revealSuspect(rec, ctx); if (s) got.push(s.label); }
      return { title: 'The Muster Reports', text: team.length + ' watch' + (team.length > 1 ? 'men' : 'man') + ' worked ' + rec.title + '. ' + (got.length ? 'They bring back: ' + got.join(', ') + '.' : 'They found nothing new.') };
    },
  });

  // ================================================================= DELEGATE
  R.push({
    id: 'delegate_case', verb: 'duty', src: 'delegate', rank: 2, label: 'Deputise the Case', duration: 10,
    preview: function (ctx) { var rec = ctx.caseOf(ctx.primary); return rec && rec.delegate ? 'Somebody is already working this case for you.' : 'Hand it over. They will bring you something every half minute until it closes.'; },
    blocked: function (ctx) {
      var rec = ctx.caseOf(ctx.primary);
      if (rec && rec.delegate) return 'A watchman is already on it.';
      return null;
    },
    requires: { aspects: ['case'], when: function (ctx) { return ctx.with('teammate').length === 1; } },
    run: function (ctx) {
      var e = ctx.e;
      var rec = openRec(ctx, ctx.primary);
      if (!rec) return closed();
      var officer = ctx.first('teammate');
      if (!officer) return { title: 'Nobody Free', text: 'The watchman you had in mind is not at the Watch-house.' };
      e.delegateCase(rec, officer);
      return { title: 'Deputised', text: officer.data.name + ' takes the book for ' + rec.title + ' and a ring of keys. You will hear from them.' };
    },
  });

  // ============================================================= MAJOR CRIMES
  R.push({
    id: 'major_declare', verb: 'duty', src: 'majorcrimes', rank: 3, label: 'Have It Cried', duration: 20,
    preview: function (ctx) { var rec = ctx.caseOf(ctx.primary); return rec && rec.major ? 'The crier has already sung it.' : 'Costs 2 Coin. The case gets two weeks more, a name in the casebook, a witness, and the whole city watching. Convictions pay in Standing; an unanswered case costs the Crowd.'; },
    blocked: function (ctx) {
      var rec = ctx.caseOf(ctx.primary);
      if (rec && rec.major) return 'The crier has already sung this one.';
      return ctx.count('funds') >= 2 ? null : 'Needs 2 Coin (you have put in ' + ctx.count('funds') + ').';
    },
    requires: ['case', 'focus'],
    run: function (ctx) {
      var e = ctx.e, card = ctx.primary;
      var rec = openRec(ctx, card);
      if (!rec) return closed();
      ctx.with('funds').slice(0, 2).forEach(ctx.consume);
      rec.major = true;
      rec.highProfile = true;
      card.life += 120; card.maxLife = Math.max(card.maxLife || 0, card.life);
      card.label = '★ ' + card.label.replace(/^★ /, '');
      var sc = e.revealSuspect(rec, ctx);
      if (rec.witnesses.length) ctx.give('witness', e.witnessSpec(rec));
      return { title: 'Cried: ' + rec.title, kind: 'major', text: 'The crier sings it at every corner and a reward is posted on the Rathaus door. The city gives you time and expects a name.' + (sc ? ' The first one: ' + e.labelOf(sc) + '.' : '') };
    },
  });
  R.push({
    id: 'major_focus', verb: 'duty', src: 'majorcrimes', rank: 3, label: 'Turn the Watch\'s Eyes', duration: 15,
    preview: function (ctx) { return 'Rounds, informers and the day-book all point at ' + ctx.e.labelOf(ctx.primary) + '. The next case comes from there, sooner, with more time on its clock.'; },
    requires: ['district'],
    run: function (ctx) {
      var e = ctx.e, d = ctx.primary.data.district;
      var tid = U.pick(ctx.rng, CF.ORDINARY_CASES.filter(function (t) { return CF.CASE_TEMPLATES[t].districts.indexOf(d) >= 0; }) || CF.ORDINARY_CASES);
      e.s.nextCase = { template: tid, district: d, extraTime: 60 };
      e.s.dispatchT = Math.min(e.s.dispatchT, 30);
      return { title: 'Eyes on ' + CF.DISTRICTS[d].label, text: 'Every watchman with a lantern spends the week in ' + CF.DISTRICTS[d].label + '. Whatever happens there next, you will hear first.' };
    },
  });

  // Index.
  CF.Recipe.register(R.concat(CF.Recipe.fromLeads(CF.CASE_TEMPLATES)));
  // ------------------------------------------------------------ MID-WORK ASKS
  // Part-way through, some work wants one more card: the token opens its
  // small box, and the window says why. Answering (drop the card on the
  // token, or let the box pull it) earns the reward; ignoring it costs
  // nothing. Rewards: finish (done now), haste (the rest goes quickly),
  // nofatigue (no Weariness from it), testimony (the word carries more).
  function lead(id) { return /^lead_/.test(id); }
  CF.ASKS = [
    { when: function (id) { return id === 'inv_search'; },
      at: 0.3, label: 'A locked door', text: 'The back room is locked. Instinct finds the key under the sill; a watchman puts a shoulder to it. Left locked, whatever is behind it stays there.',
      accepts: ['instinct', 'teammate'], penalty: 'thin', thanks: 'The door gave, and the back room had something to say.', miss: 'The back room stayed locked, and whatever it held stays there.' },
    { when: function (id, verb) { return verb === 'investigate' && lead(id); },
      at: 0.3, label: 'A locked door', text: 'The back room is locked. Instinct finds the key under the sill; a watchman puts a shoulder to it. Left locked, you climb in the hard way, and it costs you.',
      accepts: ['instinct', 'teammate'], penalty: 'fatigue', thanks: 'The door gave, and the back room had something to say.', miss: 'The back room stayed locked, and the hard way in wore you out.' },
    { when: function (id) { return id === 'inv_canvass'; },
      at: 0.3, label: 'A shut door', text: 'One house will not open to the Watch. It opens to Coin. Shut, it keeps what it knows.',
      accepts: ['funds'], consume: true, penalty: 'thin', thanks: 'A Coin under the door, and the whole street talked.', miss: 'One door stayed shut, and the street talked less for it.' },
    { when: function (id) { return id === 'patrol_walk' || id === 'patrol_district'; },
      at: 0.3, label: 'A shortcut', text: 'A boy offers to show you the short way through the yards, for a Coin. The long way is on your legs.',
      accepts: ['funds'], consume: true, penalty: 'fatigue', thanks: 'The boy knew the yards.', miss: 'The long way round, and your legs know it.' },
    { when: function (id, verb) { return verb === 'analyze' && id !== 'an_clue_none' && id !== 'an_plant'; },
      at: 0.35, label: 'The light is going', text: 'The window dims. Wit works on by candle; Instinct works by feel. Neither, and you strain your eyes into the night.',
      accepts: ['focus', 'instinct'], penalty: 'fatigue', thanks: 'You finished before dark.', miss: 'You worked into the dark, and it cost you.' },
    { when: function (id) { return id === 'int_witness'; },
      at: 0.3, label: 'Their trouble', text: 'They have lost a morning to you. A Coin for it loosens the tongue.',
      accepts: ['funds'], consume: true, reward: 'testimony', thanks: 'Paid for their morning, they remembered more.' },
    { when: function (id) { return id === 'int_suspect'; },
      at: 0.35, label: 'A long silence', text: 'They have stopped answering. Wit finds the question that opens them again. Without it, the silence is what you take home.',
      accepts: ['focus'], penalty: 'fatigue', thanks: 'The right question, and the rest came out in a rush.', miss: 'The silence held, and it wore you down to break it.' },
    { when: function (id) { return id === 'duty_beat'; },
      at: 0.3, label: 'A brawl', text: 'The bear-garden empties into the lane. A watchman at your side, and it is over quickly. Alone, it is on you.',
      accepts: ['teammate'], penalty: 'fatigue', thanks: 'Two of you, and the brawl came apart before it wore you out.', miss: 'Alone in the lane, and it wore you out.' },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
