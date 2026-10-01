// Life at the desk: the opening (back from a shift, dead on your feet), the
// needs that come for you between cases (hunger, sickness, stress), and the
// choices the city puts to you, which stop the clock until you answer.
//
//   s.needT      seconds until the next need arrives
//   s.choiceT    seconds until the next choice is put to you
//   s.choice     the choice waiting: { id, title, text, options: [{label, text}] }
//   s.flags.firstCase  the first case has arrived
(function (G) {
  var CF = G.CF;
  var U = CF.util;
  var P = CF.Engine.prototype;

  // ---- The opening ---------------------------------------------------------
  // You have no office yet. You work for your bread (Health in Attend); a
  // notice about someone close to you opens Explore; the Watch finds the
  // body and questions you, which opens Question and puts your Wit on the
  // table; reasoning with the sergeant gets you the junior place. The Court
  // opens with your first charge, and the Bell only rings once you have
  // earned your first keep. Stages: work, search, questioned, hired, keep.
  CF.FIRST_CASES = ['burglary', 'missing', 'harbor', 'arson', 'fraud', 'extortion', 'poison', 'coining'];
  // Where each start begins, and who goes missing. The default serves a start with no origin.
  CF.OPENING_SCENES = {
    clerk: { where: 'a rented room over the scriveners\' shop on the Market', work: 'copying deeds for whoever pays', missing: 'Endres', missingWho: 'the copyist who shares your bench',
      first: 'Six years you copied the last Examiner\'s day-book, and when he died the desk went to nobody and the copying went to you, at a rented bench over the scriveners\' shop. You know every form, fee and seal in the city, and have never once been in a fight.',
      notice: 'Endres has not come to the bench in four days. The master scrivener says nothing, which is how he says things. Endres lodged in the Warrens; you know the door.',
      found: 'The Watch pulled Endres out of the mill-race this morning. A sergeant is at the shop before noon, and he wants to know why you were asking at that door before anyone knew there was a body.',
      hired: 'The sergeant listens longer than sergeants do. When you are finished he says the Watch-house on the Market has a desk under the stair and nobody at it, and that a man who reads a room like a deed is wasted on deeds. Junior examiner. No stipend until you have earned it.',
      roles: [
        { role: 'the master scrivener', motive: 'Endres copied a bond he was told not to read, and read it.' },
        { role: 'the man whose bond it was', motive: 'A deed in the Warrens, and a name on it that should not be there.' },
        { role: 'a lodger on Endres\'s stair', motive: 'Owed Endres a month\'s rent and a great deal of silence.' },
      ] },
    watchman: { where: 'the Watch-house bench, where you have slept since the round ended', work: 'hired out as a night-guard to whoever has a warehouse', missing: 'Old Bartel', missingWho: 'who walked the round beside you for twenty years',
      first: 'Twenty years you cried the hours with a cudgel and a lantern, and the round ended in the spring with the Council\'s thanks and nothing else. You sleep on the Watch-house bench and guard warehouses for whoever has one.',
      notice: 'Old Bartel has missed three rounds. His halberd is still on its hook. His landlady says he went out on Thursday to meet somebody about money.',
      found: 'They find Bartel in a lock-up at the Harbour with his skull broken. The sergeant, who was Bartel\'s friend before he was yours, wants to know what you know.',
      hired: 'The sergeant has heard you read a scene before, on the round, in the dark. He says the Examiner\'s desk under the stair is empty and the Council has stopped asking why. Junior examiner. No stipend until you have earned it.',
      roles: [
        { role: 'the man Bartel went to meet about money', motive: 'Bartel lent, and Bartel asked for it back, on Thursday.' },
        { role: 'the warehouse-keeper who hired him', motive: 'Bartel saw what came in by night and was paid to forget, until he stopped forgetting.' },
        { role: 'a tapster at the Harbour', motive: 'Bartel drank there on credit, and the slate was long.' },
      ] },
    monk: { where: 'the Abbey guest-house, since the Abbot found you a nuisance in the garden', work: 'dressing wounds at the Abbey hospital for whoever can pay the hospital', missing: 'Brother Sebald', missingWho: 'the novice who ground your simples',
      first: 'The Abbot found you a nuisance in his garden and moved you to the guest-house, where you dress the hospital\'s wounds for whoever can pay the hospital. You may not carry a sword. You carry a case of instruments, and a great deal of patience with abbots.',
      notice: 'Brother Sebald did not come to matins, or to prime. His bed is made. His herbal is gone from the shelf, and so is a jar that should not leave the dispensary.',
      found: 'The Watch finds Sebald under the sluice with the jar in his cloak, and a sergeant who does not like monks wants to know why a physician was asking the porter about him.',
      hired: 'You tell the sergeant what the body says, and the sergeant, who has heard a hundred physicians, hears something new. The Watch-house has a desk with nobody at it. Junior examiner. No stipend until you have earned it.',
      roles: [
        { role: 'the cellarer', motive: 'The jar was in his keeping, and so was the key.' },
        { role: 'the man who bought the jar', motive: 'Somebody outside the walls wanted what the dispensary keeps locked.' },
        { role: 'a novice who envied him', motive: 'Sebald was to be sent to the scriptorium. The other was not.' },
      ] },
    hangman: { where: 'the hangman\'s house outside the wall, where nobody visits', work: 'flaying for the tanners, which is what the city lets you do', missing: 'Nan', missingWho: 'who sells the ballads at the Ravenstone',
      first: 'Nobody visits the hangman\'s house outside the wall. You flay for the tanners, which is what the city lets you do, and you have read more bodies than any physician inside the walls, for nobody. The Ravenstone is quiet this week.',
      notice: 'Nan has not been at the Ravenstone in four days, and there was a hanging on Tuesday. Her ballads are still in the basket by the gate. Somebody took the basket in.',
      found: 'The Watch finds Nan in the reeds below the Water-gate. The sergeant comes to the house outside the wall, which no sergeant does, and wants to know what a hangman was doing asking after her.',
      hired: 'You tell him what the marks on her say, and he goes quiet. The Council will not like it, he says, but the desk under the stair is empty and you read a body better than the barber-surgeon. Junior examiner. No stipend until you have earned it.',
      roles: [
        { role: 'the printer of her ballads', motive: 'Nan sang a verse he had not been paid for.' },
        { role: 'the man she sang about', motive: 'A ballad names names. His was in Tuesday\'s.' },
        { role: 'the gatekeeper who took the basket in', motive: 'Knew she was not coming back before anyone else did.' },
      ] },
    advocate: { where: 'chambers on the Hill you can no longer afford', work: 'drawing up wills and bonds for whoever still knocks', missing: 'Pieter', missingWho: 'your clerk, who kept the chambers when the clients stopped',
      first: 'Ten years you argued the Carolina before the Blood Court, and then the clients stopped coming, and then the money. Chambers on the Hill you cannot afford, and wills and bonds for whoever still knocks.',
      notice: 'Pieter did not come in on Monday. His pen is on the desk, uncleaned, which he never leaves. The last thing he copied was a bond you did not draw.',
      found: 'The Watch finds Pieter in the Stews, in a room he could not have paid for. A sergeant comes up the Hill to ask why you were at that door before they were.',
      hired: 'You argue your own case to the sergeant as you argued a hundred before the Blood Court, and he is not a judge, so it works. The desk under the stair is empty. Junior examiner. No stipend until you have earned it.',
      roles: [
        { role: 'the man whose bond Pieter copied', motive: 'A bond you did not draw, in your chambers, in your clerk\'s hand.' },
        { role: 'a client who stopped paying', motive: 'Owed the chambers a year, and Pieter kept the book.' },
        { role: 'the keeper of the room in the Stews', motive: 'Somebody paid for that room. It was not Pieter.' },
      ] },
  };
  CF.OPENING_SCENES.none = { where: 'a rented room on the Market', work: 'whatever work the Market has', missing: 'Grete', missingWho: 'the neighbour who shared your stair',
    notice: 'Grete from the floor below has not been seen in four days. Her door is locked and her cat is on your sill. Nobody has asked the Watch, because nobody asks the Watch.',
    found: 'The Watch pulls Grete out of the river. A sergeant is on your stair by noon, wanting to know why you were asking at her door.',
    hired: 'The sergeant listens, and at the end says the Watch-house has a desk under the stair and nobody at it. Junior examiner. No stipend until you have earned it.',
    roles: [
      { role: 'the man on the floor below', motive: 'Knocked on her door every night, and she stopped answering.' },
      { role: 'her brother from the Warrens', motive: 'Owed money in the Warrens, and she had some.' },
      { role: 'the landlord\'s son', motive: 'Had a key to every room on the stair, and used it.' },
    ] };
  CF.OPENING_TEXT = {
    start: 'No office, no stipend, no name the crier would sing. You lodge at {where}, and you live by {work}. Health in Attend earns a Coin; so does Wit, more slowly. The city has not noticed you yet.',
    notice: 'A Notice',
    body: 'The Watch Has a Body',
    hired: 'Junior Examiner',
    keep: 'Your First Keep',
    keepText: 'The Council pays a stipend to the examiner who answered a case, and the landlord, who has heard, sends up the bill. The Bell rings from today: lodging and dues at every turn of the week. You are an examiner now, and the cases will come on the city\'s clock.',
  };
  P.openingScene = function () { return CF.OPENING_SCENES[this.s.who] || CF.OPENING_SCENES.none; };
  P.setupOpening = function () {
    var s = this.s, sc = this.openingScene();
    s.flags.opening = true;
    s.flags.stage = 'work';
    s.flags.firstCase = false;
    s.flags.bellSilent = true;
    s.verbs.time.unlocked = false;
    this.create('health');
    // The first morning in the origin's own words, then where you stand.
    this.story('Before the Office', (sc.first ? sc.first + ' ' : '') + U.fill(CF.OPENING_TEXT.start, { where: sc.where, work: sc.work }), 'major');
    this.dirty = true;
  };
  function hint(e, text) { if (e.s.intro && !e.s.intro.finished && !e.s.intro.silent) e.s.intro.hint = text; }
  // How many verbs have finished, all told: the opening's beats wait for one.
  function verbsRun(e) { var sv = e.s.stats.verbs || {}, n = 0; for (var k in sv) n += sv[k]; return n; }
  // What the hint says while you work for bread: it follows what is on the table.
  var WORK_HINTS = {
    health: 'You have no office yet. Drag Health onto Attend and press what it offers: a day\'s labour, a Coin.',
    focus: 'Winded. Health comes back in a moment; meanwhile Wit keeps the day-book in Attend for a Coin.',
    none: 'Both spent. They come back on their own; the clock is running.',
  };
  // The body is found: the case takes its true name, on the record and on every card of it.
  function retitle(e, rec, title) {
    var old = rec.title;
    rec.title = title;
    Object.keys(e.s.cards).forEach(function (k) {
      var c = e.s.cards[k];
      if (!c || c.caseId !== rec.id) return;
      if (c.label && c.label.indexOf(old) >= 0) c.label = c.label.replace(old, title);
      if (c.desc && c.desc.indexOf(old) >= 0) c.desc = c.desc.replace(old, title);
    });
    e.dirty = true;
  }
  P.openingTick = function () {
    var s = this.s, sc = this.openingScene();
    if (!s.flags.opening) return;
    var worked = (s.stats.verbs && s.stats.verbs.duty) || 0;
    if (s.flags.stage === 'work') {
      if (worked < 2) {
        var tb = this.tableCards();
        hint(this, tb.some(function (c) { return c.def === 'health'; }) ? WORK_HINTS.health : tb.some(function (c) { return c.def === 'focus'; }) ? WORK_HINTS.focus : WORK_HINTS.none);
        return;
      }
      s.flags.stage = 'search';
      var card = this.spawnCase('missing', { victim: sc.missing, lifetime: 900, quiet: true, district: 'warrens',
        title: 'The Vanishing of ' + sc.missing, brief: sc.notice, roles: sc.roles });
      var rec = this.caseRec(card.caseId);
      rec.opening = true;
      this.story(CF.OPENING_TEXT.notice + ': ' + rec.title, sc.notice + ' Nobody else is going to look.', 'case');
      if (this.introUnlock) this.introUnlock(['investigate']);
      // You go before you decide to: the case pulls itself into Explore.
      this.autoRun('investigate', [card.uid]);
      hint(this, 'Somebody you know is missing, and you are already at the door. When Explore is done, open it: tap a card to turn it over, double-tap to take it.');
      return;
    }
    if (s.flags.stage === 'search') {
      var rec2 = this.openCases().filter(function (r) { return r.opening; })[0];
      if (!rec2 || !(rec2.searches > 0)) return;
      var ex = this.verb('investigate');
      if (ex.status !== 'idle') {
        // Explore is done and waits to be opened: say so, once. The Watch does not come until you have.
        if (ex.status === 'done' && !s.flags.exploreHinted) { s.flags.exploreHinted = true; hint(this, 'Explore is done. Open it: tap a card to turn it over, double-tap to take it, or Take all.'); }
        return;
      }
      s.flags.stage = 'questioned';
      retitle(this, rec2, 'The Death of ' + sc.missing);
      var q = this.create('watchq', { label: 'The Sergeant\'s Questions', desc: sc.found + ' Reason with him: put this in Question with Wit.' });
      this.story(CF.OPENING_TEXT.body, sc.found, 'danger');
      if (this.introUnlock) this.introUnlock(['interrogate']);
      var wits = this.introReveal ? this.introReveal(['focus']) : [];
      var wit = wits[0] || this.cardsOf('focus').filter(function (c) { return c.loc.t === 'table'; })[0];
      // The sergeant does not wait to be invited: the questioning starts by itself.
      this.autoRun('interrogate', [q.uid].concat(wit ? [wit.uid] : []));
      hint(this, 'The Watch wants a word, and the sergeant has already sat you down. Your Wit is doing the talking; wait for him to be satisfied.');
      return;
    }
    // The desk is yours: what you want from it is asked once Explore is idle, or ten seconds on.
    if (s.flags.stage === 'hired' && s.flags.callingDue && s.flags.callingOpen && !s.choice) {
      if (s.t - (s.flags.hiredT || 0) >= 10 || this.verb('investigate').status === 'idle') {
        delete s.flags.callingDue;
        this.offerChoice(CF.CHOICES.filter(function (c) { return c.id === 'calling'; })[0]);
      }
    }
  };
  // The sergeant is satisfied: the junior place, and the rest of the desk.
  P.openingHired = function () {
    var s = this.s, sc = this.openingScene();
    if (s.flags.stage !== 'questioned') return;
    s.flags.stage = 'hired';
    s.flags.firstCase = true;
    s.flags.hiredT = s.t;
    // The lessons come one beat at a time from here: the intro counts from the hire.
    if (s.intro) { s.intro.lastBeatT = s.t; s.intro.lastBeatVerbs = verbsRun(this); }
    if (this.introUnlock) this.introUnlock(['analyze', 'reflect']);
    if (this.introReveal) this.introReveal(['instinct', 'health', 'focus', 'personnel']);
    this.story(CF.OPENING_TEXT.hired, sc.hired + ' The case is yours now: find who did it. Raw proof speaks in Study; the Court opens when you have someone to charge.', 'major');
    var rec = this.openCases().filter(function (r) { return r.opening; })[0];
    var named = rec && rec.suspects.filter(function (x) { return x.revealed; })[0];
    var proof = this.tableCards().some(function (c) { return c.def === 'evidence'; });
    if (named && !proof) hint(this, U.fill('Two tokens and a name already. Question {name} with Wit, or lay the tokens side by side in Rest.', { name: named.name }));
    else hint(this, 'You have the desk. Study what you found, question who you meet, and build a charge. The Court opens when you have an accused and a token.');
    if (s.flags.callingOpen) s.flags.callingDue = true; // put to you from openingTick, once Explore is idle or ten seconds on
  };
  // The first conviction: stipend, lodging, the Bell, and the city's clock.
  P.openingKeep = function () {
    var s = this.s;
    if (!s.flags.opening || s.flags.stage === 'keep') return;
    s.flags.stage = 'keep';
    s.flags.opening = false;
    s.flags.bellSilent = false;
    s.verbs.time.unlocked = true;
    s.weekT = 0;
    s.needT = U.randInt(this.rng, 150, 240) + 60;
    s.choiceT = 90;
    if (this.introReveal) this.introReveal(['funds', 'order', 'district', 'camera', 'teammate', 'informant', 'notes', 'coldcase', 'atlarge', 'gang', 'syndicate']);
    for (var i = 0; i < 2; i++) this.create('funds');
    this.layoutVerbs();
    this.story(CF.OPENING_TEXT.keep, CF.OPENING_TEXT.keepText, 'major');
    hint(this, 'The Bell rings from now on: lodging and dues come out of your Coin at every turn of the week. Attend earns it.');
  };

  // ---- Needs -----------------------------------------------------------------
  // Every so often one comes for you. Each is a card with a clock; deal with
  // it in Rest before the clock runs out, or it takes something of yours:
  // permanently, if you had it to spare.
  CF.NEEDS = {
    hunger: { takes: 'health', weight: 3, life: 110,
      arrive: 'You cannot remember your last hot meal. Your hands have started to shake on the stairs.',
      loss: 'Hunger took what it wanted. You are less than you were.' },
    sickness: { takes: 'instinct', weight: 2, life: 130,
      arrive: 'A cough from the river, a heat behind the eyes. The Warrens give it to everyone in the end.',
      loss: 'The cough wore you down for a week. Something of your nose for the street went with it.' },
    stress: { takes: 'focus', weight: 3, life: 110,
      arrive: 'You wake at the same hour every night with the same case behind your eyes. You have started to snap at the sergeant.',
      loss: 'It has worn a groove in you. Some things you will never think as quickly again.' },
  };
  function nextNeedIn(e) { return U.randInt(e.rng, 150, 240) + (e.perkHas('iron') ? 60 : 0); }
  P.needsTick = function (dt) {
    var s = this.s;
    if (!s.flags.firstCase) return; // not before the city has knocked
    if (s.intro && !s.intro.finished) return;
    if (s.needT === undefined) s.needT = nextNeedIn(this) + 60;
    s.needT -= dt;
    if (s.needT > 0) return;
    s.needT = nextNeedIn(this);
    var keys = Object.keys(CF.NEEDS).filter(function (k) { return !this.countOf(k); }, this);
    if (!keys.length) return;
    var weights = keys.map(function (k) { return CF.NEEDS[k].weight + (k === 'sickness' && (s.meters.pressure >= 5 || this.hasDistrict('warrens')) ? 2 : 0) + (k === 'stress' && this.openCases().length >= 3 ? 2 : 0); }, this);
    var total = weights.reduce(function (a, b) { return a + b; }, 0), r = this.rng() * total, pick = keys[0];
    for (var i = 0; i < keys.length; i++) { r -= weights[i]; if (r <= 0) { pick = keys[i]; break; } }
    var spec = CF.NEEDS[pick];
    this.create(pick, { lifetime: spec.life });
    this.story(CF.CARDS[pick].label, spec.arrive + ' Deal with it in Rest before the clock runs out.', 'danger');
  };
  // The clock ran out: it takes what it came for, for good if you had a spare.
  // With nothing to spare it takes your strength and comes once more; left
  // to run out a second time it stops asking, and the Market keeps the debt.
  P.needExpired = function (card) {
    var spec = CF.NEEDS[card.def];
    var repeat = (card.data && card.data.repeat) || 0;
    this.remove(card);
    if (!spec) return;
    var have = this.cardsOf(spec.takes, true);
    var label = CF.CARDS[spec.takes].label;
    if (have.length >= 2) {
      var victim = have.filter(function (c) { return c.loc && c.loc.t === 'table'; })[0] || have[0];
      this.remove(victim);
      this.story('Lost: ' + label, spec.loss + ' One ' + label + ' is gone, and it will not come back.', 'danger');
    } else if (repeat >= 1) {
      this.count('debt');
      this.meter('pressure', 1);
      this.story(CF.CARDS[card.def].label + ' Deepens', 'You could not pay it, and it stopped asking. The cookshop and the barber are owed, and the Market knows it.', 'danger');
    } else {
      this.create('fatigue');
      this.create(card.def, { lifetime: spec.life, data: { repeat: repeat + 1 } });
      this.story(CF.CARDS[card.def].label + ' Deepens', spec.loss.split('.')[0] + '. With only one ' + label + ' to your name it cannot take that, so it takes your strength instead, and stays. It will come again.', 'danger');
    }
  };

  // ---- The Rival ----------------------------------------------------------------
  // From the middle of the game the Harbourmaster sends an examiner of his
  // own to show the Council it has a choice. Every week they act against
  // you: take up a case you have opened and race you on it (a week on they
  // boast of a name, a week after that they close it), spoil a scene, pay a
  // witness to forget. A spoiled token and a bought witness carry the mark
  // (data.tampered, data.bribed) for the dossier.
  CF.RIVAL_NAMES = ['Anselm Vogt', 'Lucia Brenner', 'Konrad Aschauer', 'Margarethe Sturm', 'Piet Wieland', 'Ottilie Kress'];
  P.rivalWeek = function () {
    var s = this.s, lines = [];
    if (s.week < 5 || (s.intro && !s.intro.finished)) return lines;
    var r = this.cardsOf('rival', true)[0];
    if (!r) {
      if (s.flags.rivalGone && s.flags.rivalGone > s.week) return lines;
      if (s.flags.rivalSeen && this.rng() > 0.25) return lines;
      if (!s.flags.rivalSeen && this.rng() > 0.4 && s.week < 8) return lines;
      var name = U.pick(this.rng, CF.RIVAL_NAMES);
      s.flags.rivalSeen = true;
      this.create('rival', { label: 'The Rival: ' + name, data: { name: name, heat: 0, stalled: 0 } });
      this.story('The Harbourmaster\'s Examiner', name + ' has the Harbourmaster\'s letter and a desk in the Customs House. The Harbourmaster wants the Council to see it has a choice. They will work your cases from the other side: close them first, spoil your scenes, pay your witnesses to forget. Question them, buy them, frighten them, or shadow them; find their weakness twice and the Council sends them home.', 'danger');
      lines.push('The Harbourmaster has sent an examiner of his own.');
      return lines;
    }
    if (r.data.stalled && r.data.stalled >= s.week) return lines;
    var open = this.openCases();
    // Only a case you have opened and held a week is worth racing you on.
    var mine = open.filter(function (x) { return !x.rival && x.searches > 0 && s.week - (x.week || 0) >= 1; });
    var theirs = open.filter(function (x) { return x.rival; });
    var ripe = theirs.filter(function (x) { return s.week - (x.rivalSince || 0) >= 2; });
    var boast = theirs.filter(function (x) { return s.week - (x.rivalSince || 0) === 1 && !x.rivalBoasted; });
    var clues = this.tableCards().filter(function (c) { return (c.def === 'clue' || c.def === 'evidence') && CF.CLUE_ASPECTS.some(function (k) { return CF.aspectsOf(c)[k] > 0; }); });
    var witnesses = this.tableCards().filter(function (c) { return c.def === 'witness' && c.life > 40; });
    var name2 = r.data.name;
    // The week before they close a case they boast of it: the warning is yours to use.
    boast.forEach(function (x) {
      x.rivalBoasted = true;
      this.story('The Rival Boasts', name2 + ' is boasting in the Red Ox that they have a name for ' + x.title + '.', 'danger');
      lines.push(name2 + ' is boasting of a name for ' + x.title + '.');
    }, this);
    var acts = [];
    if (ripe.length) acts.push('close');
    if (mine.length) acts.push('poach');
    if (clues.length) acts.push('tamper');
    if (witnesses.length) acts.push('bribe');
    if (!acts.length) { this.dirty = true; return lines; }
    var act = U.pick(this.rng, acts);
    if (act === 'poach') {
      var rec = U.pick(this.rng, mine), card = this.caseCard(rec.id);
      rec.rival = true;
      rec.rivalSince = s.week;
      if (card) card.life = Math.min(card.life, card.maxLife * 0.5);
      this.story('The Rival Takes a Case', name2 + ' is working ' + rec.title + ' from the other side, with the Harbourmaster\'s men. Answer it first, or they will.', 'danger');
      lines.push(name2 + ' has taken up one of your cases.');
    } else if (act === 'close') {
      var rec2 = U.pick(this.rng, ripe);
      this.goCold(rec2.id);
      this.meter('reputation', -1);
      this.story('Answered by the Rival', name2 + ' has closed ' + rec2.title + ' with a confession the Harbourmaster is pleased with. The Council notes who was quicker.', 'danger');
      lines.push(name2 + ' closed a case of yours first.');
    } else if (act === 'tamper') {
      var c = U.pick(this.rng, clues), asp = CF.aspectsOf(c);
      var keys = CF.CLUE_ASPECTS.filter(function (k) { return asp[k] > 0; }), k2 = U.pick(this.rng, keys);
      c.aspects = c.aspects || {};
      c.aspects[k2] = (c.aspects[k2] || asp[k2]) - 1;
      if (c.aspects[k2] <= 0) delete c.aspects[k2];
      c.data = c.data || {};
      c.data.tampered = true;
      this.story('A Scene Spoiled', 'Somebody has been at ' + this.labelOf(c) + ' before you could use it: moved, wiped, muddled. ' + name2 + '\'s people were seen in the lane.', 'danger');
      lines.push(name2 + ' spoiled a token of yours.');
    } else if (act === 'bribe') {
      var w = U.pick(this.rng, witnesses);
      w.life = Math.min(w.life, 30);
      w.data = w.data || {};
      w.data.bribed = true;
      this.story('A Witness Paid to Forget', this.labelOf(w) + ' has had a visit and a purse from ' + name2 + ', and is suddenly leaving the city. Half a minute, if you want their word.', 'danger');
      lines.push(name2 + ' paid a witness of yours to forget.');
    }
    this.dirty = true;
    return lines;
  };

  // ---- Choices ------------------------------------------------------------------
  // The city puts a question to you and the clock stops until you answer.
  // Each answer bends what comes after: the Crowd, the Council's eye, the
  // underworld's grudge, the city's Dread of you, your purse.
  // Helpers for what an answer gives.
  function anyOpenCase(e, ctx) {
    var rec = ctx && ctx.caseId ? e.caseRec(ctx.caseId) : null;
    if (rec && rec.status === 'open') return rec;
    return e.openCases()[0] || null;
  }
  function unsolvedCase(e, ctx) {
    var rec = anyOpenCase(e, ctx);
    return rec && !rec.identified ? rec : null;
  }
  function giveClue(e, rec, item, points) {
    if (!rec) return;
    e.create('clue', e.clueSpec(rec, item, [], points ? { points: rec.culprit } : {}));
  }
  function giveWitness(e, rec, who, text) {
    if (!rec) return;
    e.create('witness', { label: 'Witness: ' + who, desc: text + ' (Witness in: ' + rec.title + ')', caseId: rec.id, data: { knows: true, stake: 'reward' } });
  }
  function lift(e, def) { var c = e.cardsOf(def, true)[0]; if (c) e.remove(c); return !!c; }
  function coins(e, n) { for (var i = 0; i < n; i++) e.create('funds'); }

  // Every answer gives something you can point to (gain), and most cost a
  // card. Choices with `after` are put to you when that verb finishes, about
  // the case it worked on; the rest come on the city's clock, when their
  // `when` holds.
  CF.CHOICES = [
    // Put to you once you have the desk: what you want from it. Never offered by the clock.
    { id: 'calling', when: function () { return false; },
      title: 'What You Want', text: 'A desk under the stair, a caseload, and a city that has not decided what you are. You have. What is this for?',
      options: [
        { label: 'The Burgomaster', text: 'Power. Rise through the offices and remake the Watch from the Council chamber. An extra Coin, and a Beadle in service.', effect: function (e) { e.applyCalling('commissioner'); } },
        { label: 'The Scholar', text: 'Knowledge. Trace every small crime back to the hidden hand that drew it. A Sketch-book, and Loose Ends on sound convictions.', effect: function (e) { e.applyCalling('master'); } },
        { label: 'The Reformer', text: 'Justice. Break the Coquille by any means, even if it costs your office. An Informer, and the Council\'s eye looks away a little longer.', effect: function (e) { e.applyCalling('crusader'); } },
      ] },
    // --- On the city's clock ---------------------------------------------------
    { id: 'beggar', when: function (e) { return e.cardsOf('funds').length >= 1; },
      title: 'The Beggar at the Door', text: 'A woman with a child on her hip has been at the Watch-house door since prime. She does not ask for anything. She just stands there, where the Council\'s clerks can see her, and she has seen everyone who passed.',
      again: 'She is back at the Watch-house door, the child grown a little, and she has seen everyone who passed.',
      options: [
        { label: 'Give her a Coin', cost: 'funds', gain: 'The Crowd and Dread ease; her word on the case', text: 'The child gets bread. She tells you who came and went, and the clerks get a story about you.',
          effect: function (e, ctx) { e.meter('dread', -1); e.meter('pressure', -1); giveClue(e, anyOpenCase(e, ctx), { label: 'The Beggar\'s Word', text: 'She stood where everyone passes, and nobody looks at a beggar. She looked at them.', aspects: { testimony: 1, opportunity: 1 } }); } },
        { label: 'Have the sergeant move her on', gain: 'Nothing; the lane remembers', text: 'She goes. The lane remembers.', effect: function (e) { e.meter('dread', 1); } },
      ] },
    { id: 'clerk', when: function (e) { return e.s.week >= 2; },
      title: 'The Clerk\'s Favour', text: 'The Council\'s clerk lingers after delivering the stipend. A councillor\'s son was found where he should not have been, with people he should not have known. There is a file. It would be a kindness if there were not.',
      options: [
        { label: 'Lose the file', cost: 'focus', gain: 'Council favour +2; a Coin in thanks', text: 'The Council owes you one, and knows you can be asked. A purse follows the clerk out.',
          effect: function (e) { e.favour().council += 2; e.count('purse'); e.meter('scrutiny', -1); e.meter('dread', 1); coins(e, 1); } },
        { label: 'Keep the file', gain: 'Standing rises', text: 'The clerk\'s smile does not reach his eyes. Your name is spoken in the chamber, not warmly, and in the lanes, warmly.', effect: function (e) { e.favour().council -= 1; e.meter('reputation', 1); } },
      ] },
    { id: 'crowd', when: function (e) { return e.s.stats.cold >= 1 && e.s.meters.pressure >= 3; },
      title: 'The Crowd Wants a Name', text: 'The unanswered case has a song now, and the song has a verse about you. A sergeant suggests, carefully, that there is a vagrant in the cells who would confess to anything for a dry bed.',
      options: [
        { label: 'Give them the vagrant', gain: 'The Crowd goes quiet; Dread rises', text: 'The Crowd is fed. Someone who did nothing hangs for it, and the city learns what you are.', effect: function (e) { e.meter('pressure', -3); e.meter('dread', 2); e.count('cruelty', 2); e.s.stats.wrongful++; } },
        { label: 'Hold the line', cost: 'health', gain: 'Standing rises; Mercy', text: 'You say the case is open. The song gets another verse.', effect: function (e) { e.meter('pressure', 1); e.meter('reputation', 1); e.count('mercy'); } },
      ] },
    { id: 'purse', when: function (e) { return e.s.week >= 2; },
      title: 'A Purse on the Desk', text: 'Nobody saw who left it. Three Coin, good silver, and a note with the name of a case on it and nothing else.',
      again: 'Another purse, heavier than the last, and the same hand on the note.',
      options: [
        { label: 'Pocket it', gain: '+3 Coin; the Council\'s eye', text: 'Silver is silver. Somebody now believes you can be bought, because you can.', effect: function (e) { coins(e, 3); e.count('purse'); e.meter('scrutiny', 1); } },
        { label: 'Find who left it', cost: 'instinct', gain: 'An Informer on the Hill', text: 'A boy, a lane, a door on the Hill that does not open to you. But the boy will, for a coin now and then.',
          effect: function (e) { e.meter('scrutiny', -1); e.meter('retaliation', 1); e.favour().council += 1; e.create('informant', e.informantSpec('uptown')); } },
        { label: 'Give it to the poor-box', gain: 'The Bishop\'s favour; Standing rises', text: 'The chaplain blinks. The Council hears of it, and so does whoever left it.', effect: function (e) { e.meter('reputation', 1); e.meter('retaliation', 1); e.favour().bishop += 1; } },
      ] },
    { id: 'informer', when: function (e) { return e.cardsOf('informant').length >= 1; },
      title: 'The Informer\'s Brother', text: 'Your informer asks a favour, the first they have ever asked. Their brother runs untaxed wine through the Water-gate. The Watch is due there on Thursday.',
      options: [
        { label: 'Look away on Thursday', cost: 'focus', gain: 'Your informer\'s trust', text: 'The wine comes through. Your informer will remember, and so will the Council if it ever learns.', effect: function (e) { e.meter('scrutiny', 1); e.meter('dread', -1); e.cardsOf('informant').forEach(function (c) { if (e.trustInformant) e.trustInformant(c, 1); }); } },
        { label: 'Send the Watch as planned', gain: 'Standing rises; Vendetta', text: 'The brother is taken. Your informer stops meeting your eye.', effect: function (e) { e.meter('reputation', 1); e.meter('retaliation', 1); e.cardsOf('informant').forEach(function (c) { if (e.trustInformant) e.trustInformant(c, -1); }); } },
      ] },
    { id: 'bishop', when: function (e) { return e.s.week >= 3; },
      title: 'The Bishop\'s Invitation', text: 'The Bishop would be glad to see the Examiner at the cathedral on Sunday, in the front pew, where the city can see him too.',
      options: [
        { label: 'Go, and be seen', cost: 'health', gain: 'The Bishop\'s favour +2; Dread eases', text: 'The Bishop is pleased. The Council notes whose pew you sat in.', effect: function (e) { e.favour().bishop += 2; e.favour().council -= 1; e.meter('dread', -1); } },
        { label: 'Send your regrets', gain: 'The Council\'s favour', text: 'The Council is pleased. The Bishop\'s chaplain stops greeting you in the street.', effect: function (e) { e.favour().council += 1; e.favour().bishop -= 1; } },
      ] },
    { id: 'swan', when: function (e) { return e.countOf('fatigue') >= 1 && e.cardsOf('funds').length >= 1; },
      title: 'A Room at the Swan', text: 'The landlord of the Swan, who owes the Watch a kindness, offers a room with a fire and a door that locks. One night. Tonight.',
      again: 'The landlord of the Swan offers the room again. He remembers.',
      options: [
        { label: 'Take the room', cost: 'funds', gain: 'Weariness lifts', text: 'You sleep like the dead and wake like the living.', effect: function (e) { lift(e, 'fatigue'); } },
        { label: 'Work through', cost: 'focus', gain: '+1 Coin; +1 Weariness', text: 'A Coin for the night\'s writing, and the ache goes a little deeper.', effect: function (e) { e.create('funds'); e.create('fatigue'); } },
        { label: 'Sleep at the desk', gain: 'Nothing changes', text: 'The fire goes out in the Watch-house and you sleep sitting up. The Swan keeps its room.', effect: function () {} },
      ] },
    { id: 'watchman', when: function (e) { return e.cardsOf('teammate', true).length >= 1; },
      title: 'The Watchman\'s Mother', text: 'One of your watchmen asks for the week: his mother is dying in the Warrens and there is nobody else. The round will be short a man.',
      options: [
        { label: 'Give him the week, and his wage', cost: 'funds', gain: 'Standing rises; Dread eases', text: 'He goes. The others see it.', effect: function (e) { e.meter('reputation', 1); e.meter('dread', -1); } },
        { label: 'The round comes first', gain: '+1 Coin from a full round; Dread rises', text: 'He stays. He does his work, and the round brings in its dues. He does not sing on the round any more.', effect: function (e) { e.meter('dread', 1); e.meter('retaliation', 1); coins(e, 1); } },
      ] },
    // --- Because of something you just did ------------------------------------
    { id: 'lamplighter', after: 'investigate', when: function (e, ctx) { return !!unsolvedCase(e, ctx); },
      title: 'The Tiler\'s Word', text: 'A tiler was on his ladder across the lane when it happened, mending a roof that did not need mending. He says so to anyone with a coin, and now he is saying it to you.',
      options: [
        { label: 'A Coin for his trouble', cost: 'funds', gain: 'A Witness who saw it', text: 'He saw a face, and he will say so again where it counts.',
          effect: function (e, ctx) { giveWitness(e, unsolvedCase(e, ctx), 'the Tiler', 'On his ladder across the lane when it happened, and not too proud to say what he saw.'); } },
        { label: 'Lean on him', cost: 'health', gain: 'A Witness who saw it; Dread rises', text: 'He remembers a great deal, suddenly. So does the lane.',
          effect: function (e, ctx) { giveWitness(e, unsolvedCase(e, ctx), 'the Tiler', 'On his ladder across the lane when it happened. He told you what he saw, once you had made the question plain.'); e.meter('dread', 1); } },
        { label: 'Let him talk to the lane instead', gain: 'The Crowd eases', text: 'By evening the lane knows an examiner is asking. The lane, for once, approves.', effect: function (e) { e.meter('pressure', -1); } },
      ] },
    { id: 'pawnbroker', after: 'analyze', when: function (e, ctx) { return !!unsolvedCase(e, ctx); },
      title: 'The Pawnbroker\'s Book', text: 'A pawnbroker keeps a book of everything that came through his door this week, and who brought it. Something from your case is in it. He would part with the page.',
      options: [
        { label: 'Buy the page', cost: 'funds', gain: 'A token that names a name', text: 'A page in a bad hand, with a name on it that you were going to have to find the hard way.',
          effect: function (e, ctx) { giveClue(e, unsolvedCase(e, ctx), { label: 'The Pawnbroker\'s Page', text: 'What came through the pawnbroker\'s door this week, and who brought it.', aspects: { financial: 2 } }, true); } },
        { label: 'Threaten his licence', cost: 'focus', gain: 'The token; the Council hears of it', text: 'He gives you the page and a look. The Council\'s clerk hears how the Examiner does business.',
          effect: function (e, ctx) { giveClue(e, unsolvedCase(e, ctx), { label: 'The Pawnbroker\'s Page', text: 'What came through the pawnbroker\'s door this week, and who brought it.', aspects: { financial: 2 } }, true); e.meter('scrutiny', 1); } },
        { label: 'Leave it', gain: 'Standing rises', text: 'You do not deal with pawnbrokers. The word gets round that you do not.', effect: function (e) { e.meter('reputation', 1); } },
      ] },
    { id: 'confessor', after: 'interrogate', when: function (e, ctx) { var rec = unsolvedCase(e, ctx); return !!rec && rec.suspects.some(function (x) { return x.revealed; }); },
      title: 'The Confessor', text: 'A priest of the parish asks for a word. Someone told him something under the seal, and it is eating him. He will not break the seal. He might point.',
      options: [
        { label: 'Ask him to point', cost: 'instinct', gain: 'A token that names a name; the Bishop frowns', text: 'He does not say a word. He looks, once, at a door, and goes back inside to pray for both of you.',
          effect: function (e, ctx) { giveClue(e, unsolvedCase(e, ctx), { label: 'The Confessor\'s Glance', text: 'A priest looked at a door and would not say why. You know why.', aspects: { testimony: 1 } }, true); e.favour().bishop -= 1; } },
        { label: 'Leave the seal alone', gain: 'The Bishop\'s favour', text: 'He is grateful, and says so where the Bishop can hear it.', effect: function (e) { e.favour().bishop += 1; } },
      ] },
    { id: 'widow', after: 'arrest', when: function (e) { return e.cardsOf('condemned', true).length >= 1; },
      title: 'The Condemned\'s Wife', text: 'She waits at the Watch-house door with a purse, three Coin in it, and asks only that a word for mercy reach the Council before it speaks.',
      options: [
        { label: 'Take the purse and say the word', gain: '+3 Coin; Mercy; the Council\'s eye', text: 'The word goes to the Council. So, in time, does the story of the purse.', effect: function (e) { coins(e, 3); e.count('purse'); e.count('mercy'); e.meter('scrutiny', 1); } },
        { label: 'Say the word for nothing', gain: 'Mercy; Dread eases', text: 'The word goes to the Council. She keeps her silver, and tells the Warrens what you did.', effect: function (e) { e.count('mercy'); e.meter('dread', -1); } },
        { label: 'Send her home', gain: 'The Council\'s favour; Dread rises', text: 'The Council likes an examiner who does not plead. The Warrens do not.', effect: function (e) { e.favour().council += 1; e.meter('dread', 1); } },
      ] },
    { id: 'tapster', after: 'duty',
      title: 'Trouble at the Swan', text: 'The round passes the Swan as two carters go through its window. The tapster is shouting your name.',
      options: [
        { label: 'Break it up', cost: 'health', gain: '+2 Coin from a grateful tapster', text: 'Two carters in the cells and a tapster who remembers who kept his window. He pays in silver.', effect: function (e) { coins(e, 2); } },
        { label: 'Watch who leaves', cost: 'instinct', gain: 'An Informer at the Swan', text: 'You let it burn out and watch the door. The potboy sees you watching, and sees a living in it.', effect: function (e) { e.create('informant', e.informantSpec('market')); } },
        { label: 'Walk on', gain: 'The round ends early: Weariness lifts', text: 'Not your window. You are home before the bell for once.', effect: function (e) { if (!lift(e, 'fatigue')) e.meter('dread', -1); } },
      ] },
    // --- Because of what you need ----------------------------------------------
    { id: 'pieman', when: function (e) { return e.countOf('hunger') >= 1; },
      title: 'The Pie-man\'s Credit', text: 'The pie-man at the corner has watched you not eat for two days. He offers one on credit, which in the Warrens is a kind of contract.',
      options: [
        { label: 'Take the pie', gain: 'Hunger goes; a Debt is noted', text: 'Mutton, mostly. He writes nothing down. He does not need to.', effect: function (e) { lift(e, 'hunger'); e.count('debt'); } },
        { label: 'Pay him', cost: 'funds', gain: 'Hunger goes; the Crowd eases', text: 'Mutton, mostly, and the corner decides you are all right.', effect: function (e) { lift(e, 'hunger'); e.meter('pressure', -1); } },
        { label: 'Refuse', gain: 'Dread eases', text: 'The Warrens watch you refuse charity, and understand it.', effect: function (e) { e.meter('dread', -1); } },
      ] },
    { id: 'barber', when: function (e) { return e.countOf('sickness') >= 1; },
      title: 'The Barber\'s Knife', text: 'The barber-surgeon will bleed you for nothing, for the story of it. Or you could pay a physician, like a gentleman.',
      options: [
        { label: 'Let him bleed you', cost: 'health', gain: 'Sickness goes', text: 'A basin, a knife, a week of feeling lighter than you should.', effect: function (e) { lift(e, 'sickness'); } },
        { label: 'Pay the physician', cost: 'funds', gain: 'Sickness goes; Standing rises', text: 'Latin, a draught, and a bill. The Hill hears you keep a physician.', effect: function (e) { lift(e, 'sickness'); e.meter('reputation', 1); } },
        { label: 'Sweat it out', gain: 'Nothing yet', text: 'Rest will do what silver would. Slower.', effect: function () {} },
      ] },
    // --- Late in the game: the city has decided what you are ------------------
    { id: 'cudgel', when: function (e) { return e.s.meters.retaliation >= 5; },
      title: 'The Cudgel on the Stair', text: 'A man was waiting on your stair tonight with a cudgel, and lost his nerve when the landlord\'s dog barked. He will not lose it twice.',
      options: [
        { label: 'A watchman walks you home', cost: 'funds', gain: 'Vendetta eases', text: 'A halberd on the stair every night for a week. The lane notices.', effect: function (e) { e.meter('retaliation', -2); } },
        { label: 'Change lodgings', cost: 'instinct', gain: 'Vendetta eases; Dread rises', text: 'A room over a chandler\'s, and nobody told. For a while.', effect: function (e) { e.meter('retaliation', -2); e.meter('dread', 1); } },
        { label: 'Bar the door and sleep', gain: 'Nothing; he may come back', text: 'You sleep with the halberd by the bed.', effect: function (e) { if (e.rng() < 0.3) e.hurtYou('He did not lose his nerve the second time.'); } },
      ] },
    { id: 'market', when: function (e) { return e.s.meters.dread >= 6; },
      title: 'The Empty Market', text: 'Stalls shut when you pass. The Market Warden asks, politely, whether the Examiner might be seen somewhere else on market day.',
      options: [
        { label: 'Walk the Market unarmed', cost: 'health', gain: 'Dread eases; Mercy', text: 'No halberd, no watchman, a basket on your arm. By noon the stalls are open and the Warden has nothing to say.', effect: function (e) { e.meter('dread', -2); e.count('mercy'); } },
        { label: 'Pay for a round at the Red Ox', cost: 'funds', gain: 'Dread eases; the Crowd eases', text: 'The Examiner stands a round and drinks it with them. The song about you gets a kinder verse.', effect: function (e) { e.meter('dread', -1); e.meter('pressure', -1); } },
        { label: 'Let them fear you', gain: 'Dread rises; Vendetta eases', text: 'You walk the Market on market day with the halberd. The stalls stay shut. Nobody waits on your stair.', effect: function (e) { e.meter('dread', 1); e.meter('retaliation', -1); } },
      ] },
    { id: 'upright', when: function (e) { return e.cardsOf('gang', true).length >= 1; },
      title: 'The Upright Man\'s Offer', text: 'A boy brings a purse and a message from the band\'s upright man: a Coin a week, and the band keeps clear of your stair.',
      options: [
        { label: 'Take it', gain: '+1 Coin; Purse; Vendetta eases', text: 'The boy comes every week. The band keeps clear of your stair, and the Market knows why.', effect: function (e) { coins(e, 1); e.count('purse'); e.meter('retaliation', -3); } },
        { label: 'Send the boy back with the purse', gain: 'Standing rises; Vendetta', text: 'The boy goes back with the purse and the message. The band hears it, and so does the lane.', effect: function (e) { e.meter('reputation', 1); e.meter('retaliation', 1); } },
      ] },
    { id: 'dinner', when: function (e) { return e.s.meters.reputation >= 6; },
      title: 'The Council\'s Dinner', text: 'An invitation under the city\'s seal: dinner on the Hill, where the Council can look at the examiner it pays.',
      options: [
        { label: 'Go up the Hill', cost: 'health', gain: 'Council favour +1', text: 'Six courses and nine councillors, and every one of them wants to know what you know. You are home after the bell.', effect: function (e) { e.favour().council += 1; } },
        { label: 'Send regrets', gain: 'Standing rises; Council favour -1', text: 'The Examiner has a case. The Hill tuts; the lanes approve.', effect: function (e) { e.meter('reputation', 1); e.favour().council -= 1; } },
      ] },
    { id: 'knock', when: function (e) { return !!compromisedInformer(e); },
      title: 'A Knock at Night', text: 'Your informer is on your stair at midnight with a bag. Somebody has been asking after them by name.',
      options: [
        { label: 'Put them up at the Watch-house', cost: 'funds', gain: 'Your informer is safe again', text: 'A bench in the Watch-house and a sergeant who asks no questions. By the week\'s end nobody is asking after them.',
          effect: function (e) { var c = compromisedInformer(e); if (c && e.heatInformant) e.heatInformant(c, -3); } },
        { label: 'Send them out of the city', gain: 'Your informer goes; Dread eases', text: 'A cart at the Water-gate before dawn. The Warrens hear that the Examiner looks after his own.',
          effect: function (e) { var c = compromisedInformer(e); if (c) e.remove(c); e.meter('dread', -1); } },
        { label: 'Turn them away', gain: 'Your informer\'s trust falls', text: 'You do not open the door. The bag goes down the stair slowly.',
          effect: function (e) { var c = compromisedInformer(e); if (c && e.trustInformant) e.trustInformant(c, -1); } },
      ] },
  ];
  // The informer somebody has been asking after: the first one Compromised.
  function compromisedInformer(e) {
    return e.cardsOf('informant', true).filter(function (c) { return e.informantStatus && e.informantStatus(c) === 'compromised'; })[0] || null;
  }
  // Where the choice is put to you on the table: beside the tidy layout, to the right.
  P.choiceSpot = function () {
    var T = CF.TABLE;
    return { x: T.COLS * (T.CW + T.GAP) + 40, y: T.TOP };
  };
  P.spend = function (n) {
    var funds = this.cardsOf('funds').filter(function (c) { return c.loc && c.loc.t === 'table'; });
    for (var i = 0; i < n && funds[i]; i++) this.remove(funds[i]);
  };
  function nextChoiceIn(e) { return U.randInt(e.rng, 130, 220); }
  // Ten weeks on, a question with a second wording (`again`) is put once more.
  CF.CHOICE_AGAIN_WEEKS = 10;
  // Has the city asked this before? Seen is the week it was asked (older saves: true).
  function choiceAsked(e, c) { var seen = (e.s.choicesSeen || {})[c.id]; return seen !== undefined && seen !== false; }
  function choiceAgain(e, c) {
    var seen = (e.s.choicesSeen || {})[c.id];
    return !!c.again && typeof seen === 'number' && e.s.week - seen >= CF.CHOICE_AGAIN_WEEKS;
  }
  function choiceUnseen(e, c) { return !choiceAsked(e, c) || choiceAgain(e, c); }
  function choiceOpen(e, c, ctx) { return choiceUnseen(e, c) && (!c.when || c.when(e, ctx)); }
  // Would the city put this question now? (The UI and the tests ask.)
  P.choiceOpenFor = function (spec, ctx) { return choiceOpen(this, spec, ctx || null); };
  // A verb has finished: remember which, and about what, so a choice can follow from it.
  P.choiceHook = function (verbId, v) {
    var s = this.s, self = this;
    if (s.choice || !s.flags.firstCase || (s.intro && !s.intro.finished)) return;
    if (!CF.CHOICES.some(function (c) { return c.after === verbId && choiceUnseen(self, c); })) return;
    var self = this, caseId = null;
    // The verb's cards at this point sit in its outputs (the case comes back that way), else in its slots or held.
    (v.out || []).concat(v.held || [], Object.keys(v.slots || {}).map(function (k) { return v.slots[k]; })).map(function (u) { return self.card(u); })
      .forEach(function (c) { if (c && c.caseId && !caseId) caseId = c.caseId; });
    s.choiceHook = { verb: verbId, caseId: caseId, t: s.t };
  };
  P.choicesTick = function (dt) {
    var s = this.s, self = this;
    if (s.choice || !s.flags.firstCase || (s.intro && !s.intro.finished)) return;
    // Something you just did invites a question about it: soon after, and not on the heels of the last one.
    if (s.choiceHook) {
      var hook = s.choiceHook;
      if (s.t - hook.t > 6) s.choiceHook = null;
      else if (s.t - hook.t >= 2 && s.t - (s.choiceLast || -999) > 60) {
        s.choiceHook = null;
        var ctx = { caseId: hook.caseId };
        var tied = CF.CHOICES.filter(function (c) { return c.after === hook.verb && choiceOpen(self, c, ctx); });
        if (tied.length && this.rng() < 0.7) { this.offerChoice(U.pick(this.rng, tied), ctx); return; }
      }
    }
    if (s.choiceT === undefined) s.choiceT = 90;
    s.choiceT -= dt;
    if (s.choiceT > 0) return;
    s.choiceT = nextChoiceIn(this);
    var open = CF.CHOICES.filter(function (c) { return !c.after && choiceOpen(self, c, null); });
    if (!open.length) return;
    this.offerChoice(U.pick(this.rng, open), null);
  };
  P.offerChoice = function (spec, ctx) {
    var s = this.s;
    // Asked before: the second wording, if it has one.
    var text = choiceAsked(this, spec) && spec.again ? spec.again : spec.text;
    (s.choicesSeen || (s.choicesSeen = {}))[spec.id] = s.week;
    s.choiceLast = s.t;
    s.choice = { id: spec.id, title: spec.title, text: text, ctx: ctx || null,
      options: spec.options.map(function (o) { return { label: o.label, text: o.text, cost: o.cost || null, gain: o.gain || null, forGood: !!o.forGood }; }) };
    this.story(spec.title, text + ' (The clock waits for your answer.)', 'major');
    this.emit('choice', s.choice);
    this.dirty = true;
  };
  // The card an option takes (Health, Wit, Instinct or Coin), if you have it:
  // on the table first, else waiting in an idle verb's slot or among its outputs.
  P.choicePayment = function (opt) {
    if (!opt || !opt.cost) return null;
    var s = this.s;
    var have = this.cardsOf(opt.cost, true).filter(function (c) {
      var vb = c.loc.verb && s.verbs[c.loc.verb];
      return c.loc.t === 'table' || (c.loc.t === 'slot' && vb && vb.status !== 'running') || c.loc.t === 'out';
    });
    have.sort(function (a, b) { return (a.loc.t === 'table' ? 0 : 1) - (b.loc.t === 'table' ? 0 : 1); });
    return have[0] || null;
  };
  P.canChoose = function (i) {
    var c = this.s.choice, spec = c && CF.CHOICES.filter(function (x) { return x.id === c.id; })[0];
    var opt = spec && spec.options[i];
    return !!opt && (!opt.cost || !!this.choicePayment(opt));
  };
  P.choose = function (i) {
    var s = this.s, c = s.choice;
    if (!c) return false;
    var spec = CF.CHOICES.filter(function (x) { return x.id === c.id; })[0];
    var opt = spec && spec.options[i];
    if (!opt) return false;
    var pay = this.choicePayment(opt);
    if (opt.cost && !pay) return false;
    if (pay) {
      // A card waiting in a verb comes to the table first, then is spent.
      if (pay.loc.t === 'out') this.takeOutput(pay.loc.verb, pay.uid);
      else if (pay.loc.t !== 'table') { this.detach(pay); this.placeOnTable(pay); }
      // An ability is spent, not lost (it comes back as it does after work), unless the option takes it for good. Coin is gone.
      var spends = CF.CARDS[pay.def].spends;
      if (spends && !opt.forGood) this.transform(pay, spends, { decay: CF.CARDS[spends].decay / (this.perkHas('secondwind') ? 2 : 1) });
      else this.remove(pay);
    }
    s.choice = null;
    opt.effect(this, c.ctx || null);
    this.story(c.title + ': ' + opt.label, opt.text + (opt.gain ? ' (' + opt.gain + ')' : ''), 'major');
    this.emit('chosen', { id: c.id, option: i });
    this.dirty = true;
    return true;
  };
  // Words for the city's temper, in place of numbers.
  CF.METER_WORDS = {
    pressure: ['Quiet', 'Muttering', 'Restless', 'Angry', 'Boiling'],
    scrutiny: ['Unwatched', 'Noted', 'Watched', 'Suspected', 'Marked'],
    retaliation: ['Forgotten', 'Remembered', 'Marked', 'Hunted', 'Condemned'],
    dread: ['Easy', 'Uneasy', 'Wary', 'Fearful', 'Terrified'],
    reputation: ['Unknown', 'Known', 'Regarded', 'Trusted', 'Honoured'],
  };
})(typeof window !== 'undefined' ? window : globalThis);
