// Recipes: what each verb does with the cards in its slots. The first recipe
// (by priority, then file order) whose requirements pass is the one the verb
// will run. See js/core/recipes.js for the fields. Simple recipes are pure
// data (requires + effects); the ones with branching prose keep a run().
(function (G) {
  var CF = G.CF;
  var U = CF.util;

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
    id: 'duty_promo', verb: 'duty', label: 'Attend on the Council', duration: 30,
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
        text: 'They give you a new title under the city\'s seal, a better stipend and a heavier caseload. You are now ' + rank.label + '. ' + rank.text +
          (unlocked.length ? ' New tools are open to you: ' + unlocked.join(', ') + '.' : '') + ' The Council will send you up to ' + e.maxOpenCases() + ' cases at once, and pay ' + rank.salary + ' a week. New petitions arrive with the letter.' };
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
    id: 'duty_train', verb: 'duty', label: 'Drill a Watchman', duration: 40,
    preview: 'The yard, the halberd, the sergeant\'s tongue. They will come back sharper.',
    blocked: { funds: function (ctx) { return ctx.e.s.rooms.training ? 1 : 2; } },
    requires: ['teammate', 'funds'],
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
    id: 'duty_team', verb: 'duty', label: 'Put Them on the Round', duration: 30,
    preview: 'They walk a round in your name. The fee comes to you.',
    requires: ['teammate'], forbids: ['funds'],
    effects: [
      { give: 'funds' },
      { story: { title: 'A Round Walked', text: function (ctx) { return ctx.primary.data.name + ' walks the round without complaint. The Council\'s ledger reads your name.'; } } },
    ],
  });
  R.push({
    id: 'duty_file', verb: 'duty', label: 'Enter the Rolls', duration: 25,
    preview: 'Every examination written fair. Every deposition marked. The Council loves a tidy book.',
    requires: ['focus', 'paperwork'],
    effects: [
      { consume: 'paperwork', n: 1 }, { meter: { scrutiny: -1 } }, { give: 'funds' },
      { story: { title: 'Entered', text: 'Four hours with the quill. By the end, even the parts that were not quite by the Carolina read as if they were.' } },
    ],
  });
  R.push({
    id: 'duty_desk', verb: 'duty', label: 'Keep the Day-book', duration: 30,
    preview: 'Sit at the desk. Take depositions. Earns a little, costs little.',
    requires: ['focus'],
    effects: [
      { give: 'funds' },
      { story: { title: 'The Day-book', text: ['A woman reports her husband missing. He is at the Red Ox. You find him in ten minutes.',
        'A boy brings in a purse he found. Every coin still in it. You buy him a pie.',
        'Forty people come to the desk. Thirty-nine of them are nothing.'] } },
    ],
  });
  R.push({
    id: 'duty_beat', verb: 'duty', label: 'Walk the Hard Round', duration: 30,
    preview: 'Walk the round with the halberd, part brawlers, earn your fee. Pays better than the desk. Tiring.',
    danger: 'May cause Weariness',
    requires: ['health'],
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
    id: 'patrol_informant_nopay', verb: 'patrol', label: 'Meet an Informer', duration: 5,
    preview: 'Informers do not talk for nothing.',
    blocked: 'Add Coin to pay them.',
    requires: ['informant'], forbids: ['funds'],
  });
  R.push({
    id: 'patrol_informant', verb: 'patrol', label: 'Meet an Informer', duration: 25,
    preview: 'A quiet word in a back booth of the Red Ox, and a purse passed under the table. Every meeting puts them at more risk.',
    requires: ['informant', 'funds'],
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
      if (al.length && ctx.rng() < 0.5) {
        var target = U.pick(ctx.rng, al);
        var hunt = e.spawnCase('manhunt', { ctx: ctx, culpritName: target.data.name, culpritTrait: target.data.trait, atLargeUid: target.uid, criminalId: target.data.criminalId,
          headline: 'Sighting: ' + target.data.name, lead: nick + ' has seen ' + target.data.name + '.' });
        target.data.hunted = hunt.caseId;
        return { title: 'A Sighting', text: nick + ' leans in. "' + target.data.name + '. I know where they sleep."' };
      }
      e.spawnCase(null, { ctx: ctx, extraTime: 90, headline: 'A Word Ahead', lead: nick + ' tells you of it before the crier does.' });
      return { title: 'Ahead of the Crier', text: '"Something is going to happen," says ' + nick + '. "Tonight." It does. But you are ready for it.' };
    },
  });
  R.push({
    id: 'patrol_district', verb: 'patrol', label: 'Work the Quarter', duration: 30,
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
      if (al.length && ctx.rng() < 0.45) {
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
    id: 'patrol_walk', verb: 'patrol', label: 'Walk the City', duration: 25,
    preview: function (ctx) { return ctx.has('health') ? 'A long hard round. Pays a fee. Anything could happen.' : 'Follow your nose. See where the city takes you.'; },
    requires: { primary: ['instinct', 'health'] },
    run: function (ctx) {
      var e = ctx.e, s = e.s;
      var known = s.flags.districts || {};
      var unknown = Object.keys(CF.DISTRICTS).filter(function (k) { return !known[k]; });
      if (ctx.has('health')) { ctx.give('funds'); maybe(ctx, 0.5, 'fatigue'); } else maybe(ctx, 0.2, 'fatigue');
      var nKnown = Object.keys(known).length;
      if (unknown.length && (ctx.rng() < 0.45 || nKnown < 3)) {
        var k = U.pick(ctx.rng, unknown);
        e.giveDistrict(k, ctx);
        return { title: 'New Ground: ' + CF.DISTRICTS[k].label, text: 'Your feet take you somewhere new. ' + CF.DISTRICTS[k].desc };
      }
      var r = ctx.rng();
      var open = e.openCases().filter(function (x) { return !x.special; });
      if (r < 0.25 && e.cardsOf('informant', true).length < 3) {
        var dk = U.pick(ctx.rng, Object.keys(known));
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
      if (r < 0.62 && open.length < 4) {
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
    id: 'inv_canvass', verb: 'investigate', label: 'Go Door to Door', duration: function (ctx) { return ctx.has('teammate') ? 25 : 30; },
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
      for (var i = 0; i < n; i++) {
        if (rec.witnesses.length && e.s.meters.dread >= 5 && ctx.rng() < e.s.meters.dread * 0.08) { rec.witnesses.shift(); afraid++; continue; }
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
    id: 'inv_search', verb: 'investigate', label: 'Search the Scene', duration: function (ctx) { return ctx.has('teammate') ? 25 : 30; },
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
        if (sc) extra.push('The first name on the board: ' + sc.label + '.');
        if (!e.hasDistrict(rec.district)) { e.giveDistrict(rec.district, ctx); extra.push('The case takes you to ' + CF.DISTRICTS[rec.district].label + '.'); }
      }
      if (ctx.has('instinct') && ctx.rng() < 0.5) {
        var sc2 = e.revealSuspect(rec, ctx);
        if (sc2) extra.push('A hunch, a likeness on the wall, a name: ' + sc2.label + '.');
      }
      maybe(ctx, 0.25, 'fatigue');
      if (!found.length) {
        ctx.give('obsession');
        return { title: 'Nothing Left', text: rec.scene + ' has given up everything it is going to. You stand in the middle of it anyway, staring, for a long time. ' + extra.join(' ') };
      }
      return { title: first ? 'At the Scene' : 'Back at the Scene',
        text: (first ? 'You go in past the beadle at ' + rec.scene + '. ' : 'You go back over ' + rec.scene + '. ') + 'You find: ' + found.join(', ') + '. ' + extra.join(' ') };
    },
  });

  R.push({
    id: 'inv_photograph', verb: 'investigate', label: 'Draw the Scene', duration: 15, priority: 20,
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
    id: 'inv_illegal_search', verb: 'investigate', label: 'Search Without a Writ', duration: 15,
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
    duration: function (ctx) { return Math.round((ctx.e.s.rooms.lab ? 15 : 25) * (ctx.e.teamHas(ctx, 'patient') ? 0.8 : 1)); },
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
      ctx.consume(ev);
      ctx.give('clue', e.clueSpec(rec, spec, e.helpers(ctx)));
      return { title: ok ? 'Results' : 'Partial Results', text: spec.text };
    },
  });
  R.push({
    id: 'an_enhance', verb: 'analyze', label: 'Back to the Bench', duration: 20,
    preview: function (ctx) { return 'Take ' + ctx.e.labelOf(ctx.primary) + ' to the apothecary\'s back room and get more out of it. Once.'; },
    blocked: function (ctx) { return ctx.primary.data.enhanced ? 'The apothecary has already had everything he can get from this.' : null; },
    requires: { primary: 'clue', cards: ['labpass'] },
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
    id: 'an_clue_none', verb: 'analyze', label: 'Back to the Bench', duration: 10,
    preview: 'A token is not raw proof. Only the apothecary can get more out of it.',
    blocked: 'Only the apothecary gets more out of a token. Petition for the Apothecary\'s Key.',
    requires: { primary: 'clue' }, forbids: { cards: ['labpass'] },
  });
  R.push({
    id: 'an_reopen', verb: 'analyze', label: 'Open the Case Again', duration: 40,
    preview: 'Pull the old books from the Rolls. Read everything again with fresh eyes.',
    blocked: function (ctx) { return ctx.e.s.rooms.archive ? null : 'You need the Rolls to open an unanswered case again.'; },
    requires: ['coldcase'],
    run: function (ctx) {
      ctx.e.pathGain('master', 1, 'reopened a cold case');
      var e = ctx.e, cc = ctx.primary, d = cc.data;
      ctx.consume(cc);
      var tid = CF.CASE_TEMPLATES[d.template] ? d.template : U.pick(ctx.rng, CF.ORDINARY_CASES);
      var alCard = d.atLargeUid && e.card(d.atLargeUid);
      e.spawnCase(tid, { ctx: ctx, culpritName: d.culpritName, culpritTrait: d.culpritTrait, atLargeUid: d.atLargeUid, reopened: true,
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
    duration: function (ctx) { return ctx.e.s.rooms.suite ? 12 : 20; },
    preview: function (ctx) {
      if (ctx.has('health')) return 'Get it out of them, whatever it takes. A beaten witness is not credible before the Court, but the word is the word. The Council will hear of it, and so will the quarter.';
      if (ctx.has('instinct')) return 'Pretend you already know. Might shake more loose. Might frighten them off.';
      return 'Small beer, patience, a kind word. Reliable.';
    },
    danger: function (ctx) { return ctx.has('health') ? 'Suspicion +1 · Dread +1' : null; },
    requires: ['witness'],
    run: function (ctx) {
      var e = ctx.e, w = ctx.primary;
      var rec = openRec(ctx, w);
      if (!rec) { ctx.consume(w); return closed(); }
      e.caseWork(rec, ctx);
      var cul = culpritOf(rec);
      var T = CF.CASE_TEMPLATES[rec.template];
      var hint = w.data.knows ? CF.TRAIT_SEEN[cul.trait] : U.pick(ctx.rng, T.hints);
      var name = w.label.replace('Witness: ', '');
      var helpers = ctx.with('teammate');
      var vars = { witness: name, hint: hint };
      var P = CF.PROSE;
      var aspects = { testimony: 2 };
      if (w.data.knows) aspects.opportunity = 1;
      var spec = { label: 'Deposition: ' + name, text: '"' + hint + '"' + (w.data.stake ? ' (' + CF.STAKES[w.data.stake].label + '.)' : ''), aspects: aspects, trait: w.data.knows ? cul.trait : null };
      var stakeFlags = { stake: w.data.stake || 'none', witness: name, againstInterest: !!(w.data.knows && w.data.stake && CF.STAKES[w.data.stake].against) };
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
        ctx.give('clue', suiteBonus(e, e.clueSpec(rec, spec, helpers, { stake: stakeFlags.stake, witness: stakeFlags.witness, againstInterest: stakeFlags.againstInterest, coerced: true })));
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
    duration: function (ctx) { return ctx.e.s.rooms.suite ? 15 : 25; },
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
          aspects: { testimony: 4 } }, [], { confession: 'question', falseConfession: !sus.guilty, illegal: !ind.sufficient, noMisread: true })));
        return { title: 'A Confession', text: U.fill(U.pick(ctx.rng, P.suspectPressure), vars) + (ind.sufficient ? '' : ' There were no sufficient indicia for it. If the Council asks, and it will, you have no answer.') };
      }

      if (!sus.guilty) {
        if (tunnel && ctx.rng() < 0.4) {
          ctx.give('clue', e.clueSpec(rec, { label: 'Something to Hide', text: sus.name + ' is hiding something. You are sure of it. You have never been so sure.', aspects: { motive: 2 } }, [], {}));
          var made = ctx.out[ctx.out.length - 1];
          made.data.misread = true;
          return { title: 'Guilty Eyes', text: 'Every pause, every glance at the door: guilt. It has to be.' };
        }
        sus.cleared = true;
        ctx.consume(sc);
        return { title: 'Cleared: ' + sus.name, text: U.fill(U.pick(ctx.rng, P.suspectAlibi), vars) };
      }

      if (confront) {
        var valid = confront.caseId === rec.id && !confront.data.misread;
        var weight = 0;
        var ca = CF.clueAspects(confront);
        for (var k in ca) weight += ca[k];
        var p = valid ? 0.5 + (weight >= 3 ? 0.2 : 0) + (ctx.has('focus') ? 0.1 : 0) : 0.05;
        if (ctx.rng() < p) {
          ctx.give('clue', suiteBonus(e, e.clueSpec(rec, { label: 'Confession: ' + sus.name, text: 'In their own words, written fair by the clerk, freely and out of the Hole. ' + sus.motive,
            aspects: { testimony: 3, motive: 1 } }, helpers, { noMisread: true, confession: 'free' })));
          return { title: sus.name + ' Cracks', text: U.fill(U.pick(ctx.rng, P.suspectCracks), { suspect: sus.name, clue: e.labelOf(confront) }) };
        }
        return { title: 'Stone', text: sus.name + ' looks at ' + e.labelOf(confront) + ', then at you, and asks what it has to do with them. ' + (valid ? 'Nearly. They nearly broke.' : 'It is a fair question.') };
      }

      if (ctx.has('instinct')) {
        if (ctx.rng() < 0.55) {
          ctx.give('clue', suiteBonus(e, e.clueSpec(rec, { label: 'Slip of the Tongue', text: sus.name + ' knew something only the person who did it would know.', aspects: { opportunity: 2 } }, helpers)));
          return { title: 'A Slip', text: U.fill(U.pick(ctx.rng, P.suspectBluff), vars) };
        }
        return { title: 'Nothing Shaken Loose', text: U.fill(U.pick(ctx.rng, P.suspectBluffFail), vars) };
      }

      ctx.give('clue', suiteBonus(e, e.clueSpec(rec, { label: 'Motive: ' + sus.name, text: sus.motive, aspects: { motive: 2 } }, helpers)));
      return { title: 'A Reason', text: U.fill(U.pick(ctx.rng, P.suspectEmpathy), vars) };
    },
  });

  // ================================================================== REFLECT
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
        (e.s.calling === 'master' ? 'And a drawing of a paper crane, circled three times.' : 'A contact your predecessor trusted.') };
    },
  });
  R.push({
    id: 'ref_architect', verb: 'reflect', label: 'Pull the Thread', duration: 45,
    preview: 'Three loose ends. The same hand, the same paper crane. Lay them side by side.',
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
        (e.s.calling === 'master' ? ' And in the margin of the old book, a doodle you never noticed: a paper crane.' : '') };
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
        (e.s.calling === 'master' ? ' And in the corner of the map, something that is not a band at all: a paper crane.' : '') };
    },
  });
  R.push({
    id: 'stakeout_front', verb: 'stakeout', label: 'Watch the Front',
    duration: function (ctx) { return Math.round((ctx.e.s.rooms.survroom ? 30 : ctx.e.gearWith(ctx, 'unlocksVerb').length ? 40 : 60) * (ctx.e.teamHas(ctx, 'patient') ? 0.8 : 1)); },
    preview: function (ctx) { return 'Stand in a doorway across from ' + ctx.e.labelOf(ctx.primary) + ' and write down who comes and goes.'; },
    blocked: function (ctx) { return ctx.slots.mind ? null : 'Someone has to watch: you (Instinct) or a watchman.'; },
    requires: { primary: 'front' },
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
  R.push({
    id: 'ref_cold', verb: 'reflect', label: 'Regret', duration: 15,
    preview: 'Turn the unanswered case over in your mind. It will not change anything on its own.',
    requires: ['coldcase'],
    run: function (ctx) {
      return { title: 'Regret', text: 'You remember every mistake. If you knew where the one who walked was now, you could do something about it.' };
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
      return deduction(ctx).gives ? 'These fit together. Something new comes of it.' : 'These do not fit together. It is worth knowing why.';
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
    id: 'ref_corroborate', verb: 'reflect', label: 'Corroborate', duration: 20,
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
    id: 'ref_theory', verb: 'reflect', label: 'Build a Theory', duration: 30,
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
      var key = rec.culprit;
      if (misread) {
        var others = rec.suspects.filter(function (x) { return !x.guilty && !x.cleared; });
        if (others.length) key = U.pick(ctx.rng, others).key;
      }
      var sus = identify(ctx, rec, key);
      return { title: th.title, kind: 'major', text: th.text + ' It was ' + sus.name + ', ' + sus.role + '. It has to be.' };
    },
  });
  R.push({
    id: 'ref_mull', verb: 'reflect', label: 'Mull It Over', duration: 20,
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
    id: 'arrest_charge', verb: 'arrest', label: function (ctx) { return 'Indict ' + ctx.e.labelOf(ctx.primary).replace('Prime Suspect: ', ''); },
    duration: 15,
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
      e.releaseDelegate(rec);
      var caseCard = e.caseCard(rec.id);
      if (caseCard) e.remove(caseCard);
      e.clearCaseCards(rec.id, clues.filter(function (c) { return c.caseId !== rec.id; }));
      ctx.give('trial', {
        label: 'Blood Court: ' + sus.name,
        desc: sus.name + ' stands before the Blood Court for ' + rec.title + '. The charge looked like ' + CF.Charge.TIERS[a.tier].label.toLowerCase() + '.',
        data: { caseId: rec.id, name: sus.name, guilty: sus.guilty, solid: a.solid, tier: a.realTier, real: a.real, need: a.need,
          coerced: a.coerced, planted: a.planted, illegal: a.unwarranted, contradictions: a.contradictions, confession: a.confession, checked: a.checked },
      });
      ctx.give('paperwork');
      return { title: 'Taken: ' + sus.name, text: 'The sergeants take them at ' + U.pick(ctx.rng, ['first light, on their doorstep', 'their shop, in front of everyone', 'the Red Ox, mid-sentence', 'the city gate, one foot on the carrier\'s wagon']) +
        '. The charge is ' + CF.Charge.TIERS[a.tier].label.toLowerCase() + '. Now it is for the sworn men.' };
    },
  });

  // ============================================================== REQUISITION
  R.push({
    id: 'req_buy', verb: 'requisition',
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
      var opened = mods && mods.unlocksVerb && e.unlockVerb(mods.unlocksVerb);
      return { title: 'Delivered: ' + o.label, text: 'It arrives by carrier in a crate with the wrong name on it. It works perfectly.' + (opened ? ' With it, you can keep a Watch.' : '') };
    },
  });

  // ================================================================== WARRANT
  R.push({
    id: 'warrant_search', verb: 'warrant', label: 'Serve the Writ', duration: 40,
    preview: 'Break the door at first light. Search their house and shop. If you are wrong, it will be noted.',
    danger: function () { return 'Suspicion +1 if they are innocent'; },
    blocked: function (ctx) {
      var cause = ctx.slots.cause;
      if (!cause) return 'You need cause: a token from their case.';
      if (cause.caseId !== ctx.primary.caseId) return 'That token has nothing to do with this accused. No magistrate will seal it.';
      return null;
    },
    requires: ['suspect'],
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
    id: 'stakeout_watch', verb: 'stakeout', label: 'Watch Their Door',
    duration: function (ctx) { return Math.round((ctx.e.s.rooms.survroom ? 30 : ctx.e.gearWith(ctx, 'unlocksVerb').length ? 40 : 60) * (ctx.e.teamHas(ctx, 'patient') ? 0.8 : 1)); },
    preview: 'A shuttered lantern, a doorway, and a long night watching one door.',
    blocked: function (ctx) { return ctx.slots.mind ? null : 'Someone has to watch: you (Instinct) or a watchman.'; },
    requires: ['suspect'],
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

  // =============================================================== UNDERCOVER
  R.push({
    id: 'undercover_op', verb: 'undercover',
    label: function (ctx) { return ctx.has('syndicate') ? 'Go Down to the Court' : ctx.has('gang') ? 'Go Among the Band' : 'Track Them Down'; },
    duration: 90,
    preview: function (ctx) {
      if (ctx.has('syndicate')) return 'Go deeper than you have ever gone. With two leaves of the ledger you can open a case against the Coquille itself; without them, you might steal one.';
      if (ctx.has('gang')) return 'A new name, a new past, and months of pretending. Get close enough to build a case against their upright man.';
      return 'Go to ground in their world until you find them.';
    },
    danger: function (ctx) { return 'Dangerous: you may be Wounded' + (ctx.has('teammate') ? ' (a second halves the risk)' : ''); },
    blocked: function (ctx) {
      if (!ctx.has('instinct')) return 'You need Instinct to hold a cover.';
      var g = ctx.first('gang') || (ctx.primary.def === 'front' ? ctx.e.cardsOf('gang').filter(function (x) { return x.data.name === ctx.primary.data.gang; })[0] : null);
      if (g && g.data.caseId && ctx.e.caseRec(g.data.caseId) && ctx.e.caseRec(g.data.caseId).status === 'open') return 'You already have an operation running against them.';
      if (ctx.has('syndicate') && ctx.e.s.flags.syndicateCase && ctx.e.caseRec(ctx.e.s.flags.syndicateCase).status === 'open') return 'The case against the Coquille is already open.';
      return null;
    },
    requires: { primary: ['atlarge', 'gang', 'syndicate', 'front'] },
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
        var gc = e.spawnCase('gang', { ctx: ctx, gangName: t.data.name, gangUid: t.uid, headline: 'Among the Band: ' + t.data.name, lead: 'You are in.' });
        t.data.caseId = gc.caseId;
        out = { title: 'Sworn In', kind: 'major', text: 'They trust you now. Mostly. You have seen the tally, the back cellar, and the upright man\'s face. Now build the case before they find out who you are.' };
      } else {
        e.meter('retaliation', 1);
        var ledgers = e.cardsOf('ledger').filter(function (c) { return c.loc.t === 'table'; });
        if (ledgers.length >= 2) {
          ledgers.slice(0, 2).forEach(function (c) { e.remove(c); });
          var sc = e.spawnCase('syndicate', { ctx: ctx, headline: 'The Court of Miracles', lead: 'The ledger and your own eyes are enough.' });
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
    id: 'taskforce_run', verb: 'taskforce', label: 'Call Out the Watch', duration: 60,
    preview: 'Your watchmen take the case and run with it: search, go door to door, dig. They report back when they are done.',
    blocked: function (ctx) { return ctx.has('teammate') ? null : 'Muster at least one watchman.'; },
    requires: ['case'],
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
    id: 'delegate_case', verb: 'delegate', label: 'Deputise the Case', duration: 10,
    preview: function (ctx) { var rec = ctx.caseOf(ctx.primary); return rec && rec.delegate ? 'Somebody is already working this case for you.' : 'Hand it over. They will bring you something every half minute until it closes.'; },
    blocked: function (ctx) {
      var rec = ctx.caseOf(ctx.primary);
      if (rec && rec.delegate) return 'A watchman is already on it.';
      return ctx.has('teammate') ? null : 'Add the watchman who will take it.';
    },
    requires: ['case'],
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
    id: 'major_declare', verb: 'majorcrimes', label: 'Have It Cried', duration: 15,
    preview: function (ctx) { var rec = ctx.caseOf(ctx.primary); return rec && rec.major ? 'The crier has already sung it.' : 'Costs 2 Coin. The case gets two minutes more, a name on the board, a witness, and the whole city watching. Convictions pay in Standing; an unanswered case costs the Crowd.'; },
    blocked: function (ctx) {
      var rec = ctx.caseOf(ctx.primary);
      if (rec && rec.major) return 'The crier has already sung this one.';
      return ctx.count('funds') >= 2 ? null : 'Needs 2 Coin (you have put in ' + ctx.count('funds') + ').';
    },
    requires: ['case'],
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
    id: 'major_focus', verb: 'majorcrimes', label: 'Turn the Watch\'s Eyes', duration: 15,
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
})(typeof window !== 'undefined' ? window : globalThis);
