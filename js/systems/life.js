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
      notice: 'Endres has not come to the bench in four days. The master scrivener says nothing, which is how he says things. Endres lodged in the Warrens; you know the door.',
      found: 'The Watch pulled Endres out of the mill-race this morning. A sergeant is at the shop before noon, and he wants to know why you were asking at that door before anyone knew there was a body.',
      hired: 'The sergeant listens longer than sergeants do. When you are finished he says the Watch-house on the Market has a desk under the stair and nobody at it, and that a man who reads a room like a deed is wasted on deeds. Junior examiner. No stipend until you have earned it.' },
    watchman: { where: 'the Watch-house bench, where you have slept since the round ended', work: 'hired out as a night-guard to whoever has a warehouse', missing: 'Old Bartel', missingWho: 'who walked the round beside you for twenty years',
      notice: 'Old Bartel has missed three rounds. His halberd is still on its hook. His landlady says he went out on Thursday to meet somebody about money.',
      found: 'They find Bartel in a lock-up at the Harbour with his skull broken. The sergeant, who was Bartel\'s friend before he was yours, wants to know what you know.',
      hired: 'The sergeant has heard you read a scene before, on the round, in the dark. He says the Examiner\'s desk under the stair is empty and the Council has stopped asking why. Junior examiner. No stipend until you have earned it.' },
    monk: { where: 'the Abbey guest-house, since the Abbot found you a nuisance in the garden', work: 'dressing wounds at the Abbey hospital for whoever can pay the hospital', missing: 'Brother Sebald', missingWho: 'the novice who ground your simples',
      notice: 'Brother Sebald did not come to matins, or to prime. His bed is made. His herbal is gone from the shelf, and so is a jar that should not leave the dispensary.',
      found: 'The Watch finds Sebald under the sluice with the jar in his cloak, and a sergeant who does not like monks wants to know why a physician was asking the porter about him.',
      hired: 'You tell the sergeant what the body says, and the sergeant, who has heard a hundred physicians, hears something new. The Watch-house has a desk with nobody at it. Junior examiner. No stipend until you have earned it.' },
    hangman: { where: 'the hangman\'s house outside the wall, where nobody visits', work: 'flaying for the tanners, which is what the city lets you do', missing: 'Nan', missingWho: 'who sells the ballads at the Ravenstone',
      notice: 'Nan has not been at the Ravenstone in four days, and there was a hanging on Tuesday. Her ballads are still in the basket by the gate. Somebody took the basket in.',
      found: 'The Watch finds Nan in the reeds below the Water-gate. The sergeant comes to the house outside the wall, which no sergeant does, and wants to know what a hangman was doing asking after her.',
      hired: 'You tell him what the marks on her say, and he goes quiet. The Council will not like it, he says, but the desk under the stair is empty and you read a body better than the barber-surgeon. Junior examiner. No stipend until you have earned it.' },
    advocate: { where: 'chambers on the Hill you can no longer afford', work: 'drawing up wills and bonds for whoever still knocks', missing: 'Pieter', missingWho: 'your clerk, who kept the chambers when the clients stopped',
      notice: 'Pieter did not come in on Monday. His pen is on the desk, uncleaned, which he never leaves. The last thing he copied was a bond you did not draw.',
      found: 'The Watch finds Pieter in the Stews, in a room he could not have paid for. A sergeant comes up the Hill to ask why you were at that door before they were.',
      hired: 'You argue your own case to the sergeant as you argued a hundred before the Blood Court, and he is not a judge, so it works. The desk under the stair is empty. Junior examiner. No stipend until you have earned it.' },
  };
  CF.OPENING_SCENES.none = { where: 'a rented room on the Market', work: 'whatever work the Market has', missing: 'Grete', missingWho: 'the neighbour who shared your stair',
    notice: 'Grete from the floor below has not been seen in four days. Her door is locked and her cat is on your sill. Nobody has asked the Watch, because nobody asks the Watch.',
    found: 'The Watch pulls Grete out of the river. A sergeant is on your stair by noon, wanting to know why you were asking at her door.',
    hired: 'The sergeant listens, and at the end says the Watch-house has a desk under the stair and nobody at it. Junior examiner. No stipend until you have earned it.' };
  CF.OPENING_TEXT = {
    start: 'No office, no stipend, no name the crier would sing. You lodge at {where}, and you live by {work}. Health in Attend earns a Coin. The city has not noticed you yet.',
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
    this.story('Before the Office', U.fill(CF.OPENING_TEXT.start, { where: sc.where, work: sc.work }), 'major');
    this.dirty = true;
  };
  function hint(e, text) { if (e.s.intro && !e.s.intro.finished && !e.s.intro.silent) e.s.intro.hint = text; }
  P.openingTick = function () {
    var s = this.s, sc = this.openingScene();
    if (!s.flags.opening) return;
    var worked = (s.stats.verbs && s.stats.verbs.duty) || 0;
    if (s.flags.stage === 'work' && worked >= 2) {
      s.flags.stage = 'search';
      var card = this.spawnCase('missing', { victim: sc.missing, lifetime: 900, quiet: true, district: 'warrens' });
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
      if (rec2 && (rec2.searches > 0 || rec2.found > 0)) {
        s.flags.stage = 'questioned';
        var q = this.create('watchq', { label: 'The Sergeant\'s Questions', desc: sc.found + ' Reason with him: put this in Question with Wit.' });
        this.story(CF.OPENING_TEXT.body, sc.found, 'danger');
        if (this.introUnlock) this.introUnlock(['interrogate']);
        var wits = this.introReveal ? this.introReveal(['focus']) : [];
        var wit = wits[0] || this.cardsOf('focus').filter(function (c) { return c.loc.t === 'table'; })[0];
        // The sergeant does not wait to be invited: the questioning starts by itself.
        this.autoRun('interrogate', [q.uid].concat(wit ? [wit.uid] : []));
        hint(this, 'The Watch wants a word, and the sergeant has already sat you down. Your Wit is doing the talking; wait for him to be satisfied.');
      }
      return;
    }
  };
  // The sergeant is satisfied: the junior place, and the rest of the desk.
  P.openingHired = function () {
    var s = this.s, sc = this.openingScene();
    if (s.flags.stage !== 'questioned') return;
    s.flags.stage = 'hired';
    s.flags.firstCase = true;
    if (this.introUnlock) this.introUnlock(['analyze', 'reflect']);
    if (this.introReveal) this.introReveal(['instinct', 'health', 'focus', 'personnel']);
    this.story(CF.OPENING_TEXT.hired, sc.hired + ' The case is yours now: find who did it. Raw proof speaks in Study; the Court opens when you have someone to charge.', 'major');
    hint(this, 'You have the desk. Study what you found, question who you meet, and build a charge. The Court opens when you have an accused and a token.');
    if (s.flags.callingOpen) this.offerChoice(CF.CHOICES.filter(function (c) { return c.id === 'calling'; })[0]);
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
      loss: 'The fever burned through you for a week. Something of your nose for the street went with it.' },
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
  P.needExpired = function (card) {
    var spec = CF.NEEDS[card.def];
    this.remove(card);
    if (!spec) return;
    var have = this.cardsOf(spec.takes, true);
    var label = CF.CARDS[spec.takes].label;
    if (have.length >= 2) {
      var victim = have.filter(function (c) { return c.loc && c.loc.t === 'table'; })[0] || have[0];
      this.remove(victim);
      this.story('Lost: ' + label, spec.loss + ' One ' + label + ' is gone, and it will not come back.', 'danger');
    } else {
      this.create('fatigue');
      this.create(card.def, { lifetime: spec.life });
      this.story(CF.CARDS[card.def].label + ' Deepens', spec.loss.split('.')[0] + '. With only one ' + label + ' to your name it cannot take that, so it takes your strength instead, and stays.', 'danger');
    }
  };

  // ---- The Rival ----------------------------------------------------------------
  // From the middle of the game the Provost appoints an examiner of his own
  // to show the Council it has a choice. Every week they act against you:
  // take a case and close it first, spoil a scene, pay a witness to forget.
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
      this.story('The Provost\'s Examiner', name + ' has the Provost\'s letter and a desk on the other side of the Market. They will work your cases from the other side: close them first, spoil your scenes, pay your witnesses to forget. Question them, buy them, frighten them, or shadow them; find their weakness twice and the Council sends them home.', 'danger');
      lines.push('The Provost has sent an examiner of his own.');
      return lines;
    }
    if (r.data.stalled && r.data.stalled >= s.week) return lines;
    var open = this.openCases();
    var mine = open.filter(function (x) { return !x.rival; }), theirs = open.filter(function (x) { return x.rival; });
    var clues = this.tableCards().filter(function (c) { return (c.def === 'clue' || c.def === 'evidence') && CF.CLUE_ASPECTS.some(function (k) { return CF.aspectsOf(c)[k] > 0; }); });
    var witnesses = this.tableCards().filter(function (c) { return c.def === 'witness' && c.life > 40; });
    var acts = [];
    if (theirs.length) acts.push('close');
    if (mine.length) acts.push('poach');
    if (clues.length) acts.push('tamper');
    if (witnesses.length) acts.push('bribe');
    if (!acts.length) return lines;
    var act = U.pick(this.rng, acts), name2 = r.data.name;
    if (act === 'poach') {
      var rec = U.pick(this.rng, mine), card = this.caseCard(rec.id);
      rec.rival = true;
      if (card) card.life = Math.min(card.life, card.maxLife * 0.5);
      this.story('The Rival Takes a Case', name2 + ' is working ' + rec.title + ' from the other side, with the Provost\'s watchmen. Answer it first, or they will.', 'danger');
      lines.push(name2 + ' has taken up one of your cases.');
    } else if (act === 'close') {
      var rec2 = U.pick(this.rng, theirs);
      this.goCold(rec2.id);
      this.meter('reputation', -1);
      this.story('Answered by the Rival', name2 + ' has closed ' + rec2.title + ' with a confession the Provost is pleased with. The Council notes who was quicker.', 'danger');
      lines.push(name2 + ' closed a case of yours first.');
    } else if (act === 'tamper') {
      var c = U.pick(this.rng, clues), asp = CF.aspectsOf(c);
      var keys = CF.CLUE_ASPECTS.filter(function (k) { return asp[k] > 0; }), k2 = U.pick(this.rng, keys);
      c.aspects = c.aspects || {};
      c.aspects[k2] = (c.aspects[k2] || asp[k2]) - 1;
      if (c.aspects[k2] <= 0) delete c.aspects[k2];
      this.story('A Scene Spoiled', 'Somebody has been at ' + this.labelOf(c) + ' before you could use it: moved, wiped, muddled. ' + name2 + '\'s people were seen in the lane.', 'danger');
      lines.push(name2 + ' spoiled a token of yours.');
    } else if (act === 'bribe') {
      var w = U.pick(this.rng, witnesses);
      w.life = Math.min(w.life, 30);
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
  CF.CHOICES = [
    // Put to you once you have the desk: what you want from it. Never offered by the clock.
    { id: 'calling', when: function () { return false; },
      title: 'What You Want', text: 'A desk under the stair, a caseload, and a city that has not decided what you are. You have. What is this for?',
      options: [
        { label: 'The Burgomaster', text: 'Power. Rise through the offices and remake the Watch from the Council chamber. An extra Coin, and a Beadle in service.', effect: function (e) { e.applyCalling('commissioner'); } },
        { label: 'The Scholar', text: 'Knowledge. Trace every small crime back to the hidden hand that drew it. A Sketch-book, and Loose Ends on sound convictions.', effect: function (e) { e.applyCalling('master'); } },
        { label: 'The Reformer', text: 'Justice. Break the Coquille by any means, even if it costs your office. An Informer, and the Council\'s eye looks away a little longer.', effect: function (e) { e.applyCalling('crusader'); } },
      ] },
    { id: 'beggar', when: function (e) { return e.cardsOf('funds').length >= 1; },
      title: 'The Beggar at the Door', text: 'A woman with a child on her hip has been at the Watch-house door since prime. She does not ask for anything. She just stands there, where the Council\'s clerks can see her.',
      options: [
        { label: 'Give her a Coin', cost: 'funds', text: 'The child gets bread. The clerks get a story about you.', effect: function (e) { e.meter('dread', -1); e.meter('pressure', -1); } },
        { label: 'Have the sergeant move her on', text: 'She goes. The lane remembers.', effect: function (e) { e.meter('dread', 1); } },
      ] },
    { id: 'clerk', when: function (e) { return e.s.week >= 2; },
      title: 'The Clerk\'s Favour', text: 'The Council\'s clerk lingers after delivering the stipend. A councillor\'s son was found where he should not have been, with people he should not have known. There is a file. It would be a kindness if there were not.',
      options: [
        { label: 'Lose the file', cost: 'focus', text: 'The Council owes you one, and knows you can be asked.', effect: function (e) { e.favour().council += 2; e.count('purse'); e.meter('scrutiny', -1); e.meter('dread', 1); } },
        { label: 'Keep the file', text: 'The clerk\'s smile does not reach his eyes. Your name is spoken in the chamber, not warmly.', effect: function (e) { e.favour().council -= 1; e.meter('reputation', 1); } },
      ] },
    { id: 'crowd', when: function (e) { return e.s.stats.cold >= 1 && e.s.meters.pressure >= 3; },
      title: 'The Crowd Wants a Name', text: 'The unanswered case has a song now, and the song has a verse about you. A sergeant suggests, carefully, that there is a vagrant in the cells who would confess to anything for a dry bed.',
      options: [
        { label: 'Give them the vagrant', text: 'The Crowd is fed. Someone who did nothing hangs for it, and the city learns what you are.', effect: function (e) { e.meter('pressure', -3); e.meter('dread', 2); e.count('cruelty', 2); e.s.stats.wrongful++; } },
        { label: 'Hold the line', cost: 'health', text: 'You say the case is open. The song gets another verse.', effect: function (e) { e.meter('pressure', 1); e.meter('reputation', 1); e.count('mercy'); } },
      ] },
    { id: 'purse', when: function (e) { return e.s.week >= 2; },
      title: 'A Purse on the Desk', text: 'Nobody saw who left it. Three Coin, good silver, and a note with the name of a case on it and nothing else.',
      options: [
        { label: 'Pocket it', text: 'Silver is silver. Somebody now believes you can be bought, because you can.', effect: function (e) { for (var i = 0; i < 3; i++) e.create('funds'); e.count('purse'); e.meter('scrutiny', 1); } },
        { label: 'Find who left it', cost: 'instinct', text: 'A boy, a lane, a door on the Hill that does not open to you. You know a name now, and they know you looked.', effect: function (e) { e.meter('scrutiny', -1); e.meter('retaliation', 1); e.favour().council += 1; } },
        { label: 'Give it to the poor-box', text: 'The chaplain blinks. The Council hears of it, and so does whoever left it.', effect: function (e) { e.meter('reputation', 1); e.meter('retaliation', 1); e.favour().bishop += 1; } },
      ] },
    { id: 'informer', when: function (e) { return e.cardsOf('informant').length >= 1; },
      title: 'The Informer\'s Brother', text: 'Your informer asks a favour, the first they have ever asked. Their brother runs untaxed wine through the Water-gate. The Watch is due there on Thursday.',
      options: [
        { label: 'Look away on Thursday', cost: 'focus', text: 'The wine comes through. Your informer will remember, and so will the Council if it ever learns.', effect: function (e) { e.meter('scrutiny', 1); e.meter('dread', -1); e.cardsOf('informant').forEach(function (c) { if (e.trustInformant) e.trustInformant(c, 1); }); } },
        { label: 'Send the Watch as planned', text: 'The brother is taken. Your informer stops meeting your eye.', effect: function (e) { e.meter('reputation', 1); e.meter('retaliation', 1); e.cardsOf('informant').forEach(function (c) { if (e.trustInformant) e.trustInformant(c, -1); }); } },
      ] },
    { id: 'bishop', when: function (e) { return e.s.week >= 3; },
      title: 'The Bishop\'s Invitation', text: 'The Bishop would be glad to see the Examiner at the cathedral on Sunday, in the front pew, where the city can see him too.',
      options: [
        { label: 'Go, and be seen', cost: 'health', text: 'The Bishop is pleased. The Council notes whose pew you sat in.', effect: function (e) { e.favour().bishop += 2; e.favour().council -= 1; e.meter('dread', -1); } },
        { label: 'Send your regrets', text: 'The Council is pleased. The Bishop\'s chaplain stops greeting you in the street.', effect: function (e) { e.favour().council += 1; e.favour().bishop -= 1; } },
      ] },
    { id: 'swan', when: function (e) { return e.countOf('fatigue') >= 1 && e.cardsOf('funds').length >= 1; },
      title: 'A Room at the Swan', text: 'The landlord of the Swan, who owes the Watch a kindness, offers a room with a fire and a door that locks. One night. Tonight.',
      options: [
        { label: 'Take the room', cost: 'funds', text: 'You sleep like the dead and wake like the living.', effect: function (e) { var f = e.cardsOf('fatigue', true)[0]; if (f) e.remove(f); } },
        { label: 'Work through', cost: 'focus', text: 'A Coin for the night\'s writing, and the ache goes a little deeper.', effect: function (e) { e.create('funds'); e.create('fatigue'); } },
      ] },
    { id: 'watchman', when: function (e) { return e.cardsOf('teammate', true).length >= 1; },
      title: 'The Watchman\'s Mother', text: 'One of your watchmen asks for the week: his mother is dying in the Warrens and there is nobody else. The round will be short a man.',
      options: [
        { label: 'Give him the week, and his wage', cost: 'funds', text: 'He goes. The others see it.', effect: function (e) { e.meter('reputation', 1); e.meter('dread', -1); } },
        { label: 'The round comes first', text: 'He stays. He does his work. He does not sing on the round any more.', effect: function (e) { e.meter('dread', 1); e.meter('retaliation', 1); } },
      ] },
  ];
  // Where the choice is put to you on the table: past the verbs, to the right.
  P.choiceSpot = function () {
    var T = CF.TABLE;
    return { x: 8 * (T.VW + T.GAP) + 40, y: -20 };
  };
  P.spend = function (n) {
    var funds = this.cardsOf('funds').filter(function (c) { return c.loc && c.loc.t === 'table'; });
    for (var i = 0; i < n && funds[i]; i++) this.remove(funds[i]);
  };
  function nextChoiceIn(e) { return U.randInt(e.rng, 130, 220); }
  P.choicesTick = function (dt) {
    var s = this.s;
    if (s.choice || !s.flags.firstCase || (s.intro && !s.intro.finished)) return;
    if (s.choiceT === undefined) s.choiceT = 90;
    s.choiceT -= dt;
    if (s.choiceT > 0) return;
    s.choiceT = nextChoiceIn(this);
    var seen = s.choicesSeen || (s.choicesSeen = {});
    var self = this;
    var open = CF.CHOICES.filter(function (c) { return !seen[c.id] && (!c.when || c.when(self)); });
    if (!open.length) return;
    this.offerChoice(U.pick(this.rng, open));
  };
  P.offerChoice = function (spec) {
    var s = this.s;
    (s.choicesSeen || (s.choicesSeen = {}))[spec.id] = true;
    s.choice = { id: spec.id, title: spec.title, text: spec.text, options: spec.options.map(function (o) { return { label: o.label, text: o.text }; }) };
    this.story(spec.title, spec.text + ' (The clock waits for your answer.)', 'major');
    this.emit('choice', s.choice);
    this.dirty = true;
  };
  // The card an option takes from the table (Health, Wit, Instinct or Coin), if you have it.
  P.choicePayment = function (opt) {
    if (!opt || !opt.cost) return null;
    return this.tableCards().filter(function (c) { return c.def === opt.cost; })[0] || null;
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
    if (pay) this.remove(pay);
    s.choice = null;
    opt.effect(this);
    this.story(c.title + ': ' + opt.label, opt.text, 'verb');
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
