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
      // A successor's run: the last Examiner did not die, they went (the drawer is told at the hire).
      firstLegacy: 'Six years you copied the last Examiner\'s day-book, and when they went the desk went to nobody and the copying went to you, at a rented bench over the scriveners\' shop. You know every form, fee and seal in the city, and have never once been in a fight.',
      notice: 'Endres has not come to the bench in four days. The master scrivener says nothing, which is how he says things. Endres lodged in the Warrens; you know the door.',
      found: 'The Watch pulled Endres out of the mill-race this morning. A sergeant is at the shop before noon, and he wants to know why you were asking at that door before anyone knew there was a body.',
      hired: 'The sergeant listens longer than sergeants do. When you are finished he says the Watch-house on the Market has a desk under the stair and nobody at it, and that a man who reads a room like a deed is wasted on deeds. Junior examiner. No stipend until you have earned it.',
      kept: 'Endres is buried at the Council\'s charge, the first thing the Council has ever paid for on your account. The master scrivener sends his bench to the Watch-house without a word.',
      roles: [
        { role: 'the master scrivener', motive: 'Endres copied a bond he was told not to read, and read it.' },
        { role: 'the man whose bond it was', motive: 'A deed in the Warrens, and a name on it that should not be there.' },
        { role: 'a lodger on Endres\'s stair', motive: 'Owed Endres a month\'s rent and a great deal of silence.' },
      ] },
    watchman: { where: 'the Watch-house bench, where you have slept since the round ended', work: 'guarding warehouses by night for whoever has one', missing: 'Old Bartel', missingWho: 'who walked the round beside you for twenty years',
      first: 'Twenty years you cried the hours with a cudgel and a lantern, and the round ended in the spring with the Council\'s thanks and nothing else. You sleep on the Watch-house bench and guard warehouses for whoever has one.',
      notice: 'Old Bartel has missed three rounds. His halberd is still on its hook. His landlady says he went out on Thursday to meet somebody about money.',
      found: 'They find Bartel in a lock-up at the Harbour with his skull broken. The sergeant, who was Bartel\'s friend before he was yours, wants to know what you know.',
      hired: 'The sergeant has heard you read a scene before, on the round, in the dark. He says the Examiner\'s desk under the stair is empty and the Council has stopped asking why. Junior examiner. No stipend until you have earned it.',
      kept: 'They bury Bartel with his halberd. The sergeant stands beside you at the grave and says, to nobody, that the round is short a man. It is.',
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
      kept: 'Sebald goes into the Abbey\'s ground with his herbal on his chest. The Abbot reads the office himself and does not look at you once, which from him is thanks.',
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
      kept: 'Nan is buried outside the wall, where the city buries what it does not want. On Tuesday the ballad-sellers sing her at the Ravenstone, with a verse that has your name in it.',
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
      kept: 'Pieter is buried from the chambers on the Hill. You draw his will yourself; it is a page long and leaves you his pen.',
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
    kept: 'Grete\'s cat moves in with you. The Watch-house cat does not approve.',
    roles: [
      { role: 'the man on the floor below', motive: 'Knocked on her door every night, and she stopped answering.' },
      { role: 'her brother from the Warrens', motive: 'Owed money in the Warrens, and she had some.' },
      { role: 'the landlord\'s son', motive: 'Had a key to every room on the stair, and used it.' },
    ] };
  CF.OPENING_TEXT = {
    start: 'No office, no stipend, no name the crier would sing. You lodge at {where}, and you live by {work}. Health in Attend earns a Coin; so does Wit, more slowly. The city has not noticed you yet.',
    // After an origin's own first morning, which has already said where you lodge and what you do.
    startTold: 'No office, no stipend, no name the crier would sing. Health in Attend earns a Coin; so does Wit, more slowly. The city has not noticed you yet.',
    notice: 'A Notice',
    body: 'The Watch Has a Body',
    hired: 'Junior Examiner',
    keep: 'Your First Keep',
    hiredWit: 'Two tokens and a name already. Lay the case and its tokens together in Rest: they may tell you who it was. Or question {name} with Wit.',
    hiredNoWit: 'Two tokens and a name already. Lay the case and its tokens together in Rest: they may tell you who it was. When your Wit comes back from the sergeant, question {name} with it.',
    keepText: 'The Council pays a stipend to the examiner who answered a case, and the landlord, who has heard, sends up the bill. The Bell rings from today: lodging and dues at every turn of the week. You are an examiner now, and the cases will come on the city\'s clock.',
    // The opening case ended without a conviction: the desk is earned all the same.
    keepAcquitted: 'The sworn men did not convict, but the Council has seen you work: the desk is yours, and so is the Bell. Lodging and dues at every turn of the week, and the next case on the city\'s clock.',
    keepCold: 'The case went unanswered, but the Council has seen you work: the desk is yours, and so is the Bell. Lodging and dues at every turn of the week, and the next case on the city\'s clock.',
    drawer: 'The Last Examiner\'s Drawer',
    drawerText: 'The desk under the stair was {name}\'s, until {how}. Their unanswered cases are still in the drawer, and their enemies have already found the new name on the door.',
    // The King's welcome, only when the Court of Thunes came down with the desk.
    drawerKing: 'The desk under the stair was {name}\'s, until {how}. Their unanswered cases are still in the drawer, and their enemies have already found the new name on the door: a cask of very good Rhenish waits on the desk, with the King\'s compliments.',
    bellHint: 'The Bell rings from now on: lodging and dues come out of your Coin at every turn of the week. Attend earns it.',
    // The opening case's own Quarter comes with the hire (only that one: the rest of the city waits
    // for the keep), so door to door, and the Word it brings, is there to learn on the first case.
    door: 'Door to Door',
    quarter: 'You have the run of {quarter}. Go door to door: the case with its Quarter in Explore finds the people who saw.',
    doorHint: 'Nobody named yet. Go door to door: the case with its Quarter in Explore finds the people who saw.',
  };
  // How the predecessor left the desk, by the ending they came to.
  CF.LEGACY_HOW = {
    'Dismissed': 'the Council took the letter back',
    'The Fever': 'one morning they did not come in',
    'Killed in the Council\'s Service': 'the burial',
    'The Council\'s Sergeants': 'the sergeants came at first light',
    'Lost in the Case': 'they broke the study door',
  };
  P.openingScene = function () { return CF.OPENING_SCENES[this.s.who] || CF.OPENING_SCENES.none; };
  // Whose death began the casebook: kept at the first keep. A save from before
  // the flag that went through the opening still knows it from its origin.
  P.firstVictim = function () {
    var f = this.s.flags;
    if (f.firstVictim) return f.firstVictim;
    return f.stage === 'keep' ? this.openingScene().missing : null;
  };
  P.setupOpening = function () {
    var s = this.s, sc = this.openingScene();
    s.flags.opening = true;
    s.flags.stage = 'work';
    s.flags.firstCase = false;
    s.flags.bellSilent = true;
    s.verbs.time.unlocked = false;
    this.create('health');
    // The first morning in the origin's own words, then where you stand.
    var first = s.flags.legacy && sc.firstLegacy || sc.first;
    this.story('Before the Office', first ? first + ' ' + CF.OPENING_TEXT.startTold : U.fill(CF.OPENING_TEXT.start, { where: sc.where, work: sc.work }), 'major');
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
  // The opening case, whatever became of it.
  // A case still in your hands: on the desk, or before the sworn men.
  var OPEN_STATUS = ['open', 'trial', 'closed'];
  function openingRec(e) {
    var cs = e.s.cases;
    for (var k in cs) if (cs[k].opening) return cs[k];
    return null;
  }
  // A strain card (Weariness, Obsession, Fever, Fixation) never sits on the table without its
  // cure: Rest opens with the first of them, even before the guided start would open it.
  function strainCure(e) {
    var s = e.s;
    if (!s.verbs.reflect || s.verbs.reflect.unlocked || !e.introUnlock) return;
    var strain = e.tableCards().filter(function (c) { var d = CF.CARDS[c.def]; return d && d.tags && d.tags.indexOf('strain') >= 0; })[0];
    if (!strain) return;
    e.introUnlock(['reflect']);
    hint(e, U.fill('Rest is open: put {card} in it to ease it before more come.', { card: e.labelOf(strain) }));
  }
  // The opening case's Quarter, given once at the hire (a save from before it gets it on the next tick).
  function openingQuarter(e, rec) {
    var known = e.s.flags.districts || {};
    if (!rec || rec.status !== 'open' || !CF.DISTRICTS[rec.district] || known[rec.district] || e.hasDistrict(rec.district)) return null;
    return e.giveDistrict(rec.district);
  }
  P.openingTick = function () {
    var s = this.s, sc = this.openingScene();
    strainCure(this);
    if (!s.flags.opening) return;
    // The opening case ended without a conviction (acquitted, gone unanswered, settled for a
    // purse or taken out of your hands): the keep comes all the same, so the city does not stand
    // still with an empty desk. A conviction makes the keep itself (the verdict).
    if (s.flags.stage === 'hired') {
      var first = openingRec(this);
      if (first && OPEN_STATUS.indexOf(first.status) < 0) { this.openingKeep(first.status === 'acquitted' ? 'acquitted' : 'cold'); return; }
      var q = openingQuarter(this, first);
      if (q) this.story(CF.OPENING_TEXT.door, U.fill(CF.OPENING_TEXT.quarter, { quarter: q.label }));
    }
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
      if (this.introReveal) this.introReveal(['focus']);
      // The sergeant does not wait to be invited: the questioning starts by itself (below, this tick).
    }
    if (s.flags.stage === 'questioned') {
      // The sergeant does not go away. While his questions lie about and Question is idle, the
      // questioning starts by itself whenever a Wit is to be had: on the table, left in an idle
      // verb's slot, or still uncollected in a verb (the day-book never opened, a Wits' End that
      // came back there). Until then the hint names what he wants, instead of saying wait.
      if (this.verb('interrogate').status !== 'idle') return;
      var wq = this.cardsOf('watchq', true).filter(function (c) { return c.loc.t === 'table' || c.loc.t === 'out' || (c.loc.t === 'slot' && s.verbs[c.loc.verb] && s.verbs[c.loc.verb].status !== 'running'); })[0];
      if (!wq) return;
      var wit = this.choicePayment({ cost: 'focus' });
      if (!wit) { hint(this, 'The sergeant waits. When your Wit comes back, put The Sergeant\'s Questions in Question with it.'); return; }
      [wq, wit].forEach(function (c) {
        if (c.loc.t === 'out') this.takeOutput(c.loc.verb, c.uid);
        else if (c.loc.t !== 'table') { this.detach(c); this.placeOnTable(c); }
      }, this);
      if (this.autoRun('interrogate', [wq.uid, wit.uid])) hint(this, 'The Watch wants a word, and the sergeant has already sat you down. Your Wit is doing the talking; wait for him to be satisfied.');
      else hint(this, 'The sergeant waits. Put The Sergeant\'s Questions in Question with Wit.');
      return;
    }
    // The desk is yours: what you want from it is asked once the sergeant's answer is taken out of
    // Question (on a phone its sheet would cover the box) and Explore is idle, or ten seconds on.
    if (s.flags.stage === 'hired' && s.flags.callingDue && s.flags.callingOpen && !s.choice && this.verb('interrogate').status === 'idle') {
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
    var rec = this.openCases().filter(function (r) { return r.opening; })[0];
    var quarter = openingQuarter(this, rec);
    this.story(CF.OPENING_TEXT.hired, sc.hired + ' The case is yours now: find who did it. Raw proof speaks in Study; the Court opens when you have someone to charge.' +
      (quarter ? ' ' + U.fill(CF.OPENING_TEXT.quarter, { quarter: quarter.label }) : ''), 'major');
    // A successor's desk: whose it was, now that it is yours. Told once.
    var L = s.flags.legacy;
    if (L && !L.told) {
      L.told = true;
      this.story(CF.OPENING_TEXT.drawer, U.fill(L.syndicate ? CF.OPENING_TEXT.drawerKing : CF.OPENING_TEXT.drawerText,
        { name: L.predecessor, how: CF.LEGACY_HOW[L.ending] || 'they left it' }), 'major');
    }
    var named = rec && rec.suspects.filter(function (x) { return x.revealed; })[0];
    var tb = this.tableCards();
    var proof = tb.some(function (c) { return c.def === 'evidence'; });
    // The case with its tokens in Rest is what names someone; the sergeant has just had the Wit.
    var wit = tb.some(function (c) { return c.def === 'focus'; });
    if (named && !proof) hint(this, U.fill(wit ? CF.OPENING_TEXT.hiredWit : CF.OPENING_TEXT.hiredNoWit, { name: named.name }));
    else if (!named && this.hasDistrict(rec ? rec.district : '')) hint(this, CF.OPENING_TEXT.doorHint);
    else hint(this, 'You have the desk. Study what you found, question who you meet, and build a charge. The Court opens when you have an accused and a token.');
    if (s.flags.callingOpen) s.flags.callingDue = true; // put to you from openingTick, once Explore is idle or ten seconds on
  };
  // The first conviction: stipend, lodging, the Bell, and the city's clock. Without a
  // conviction (why: 'acquitted' or 'cold') the keep still comes, with one Coin, not two,
  // and the next case at once if the desk is empty.
  P.openingKeep = function (why) {
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
    var won = !why;
    for (var i = 0; i < (won ? 2 : 1); i++) this.create('funds');
    this.layoutVerbs();
    // The one you knew is buried, and the casebook remembers whose death began it.
    var sc = this.openingScene();
    s.flags.firstVictim = sc.missing;
    var text = won ? CF.OPENING_TEXT.keepText : why === 'acquitted' ? CF.OPENING_TEXT.keepAcquitted : CF.OPENING_TEXT.keepCold;
    this.story(CF.OPENING_TEXT.keep, (sc.kept ? sc.kept + ' ' : '') + text, 'major');
    if (!won && !this.openCases().length) s.dispatchT = Math.min(s.dispatchT, 5);
    // The Bell's lesson: now, and kept on for a while after the desk arrives (introFinish),
    // since the Court's own lessons may still have the hint when the guided start ends.
    hint(this, CF.OPENING_TEXT.bellHint);
    if (s.intro && !s.intro.finished) s.intro.after = { text: CF.OPENING_TEXT.bellHint, week: s.week };
  };

  // ---- Needs -----------------------------------------------------------------
  // Every so often one comes for you. Each is a card with a clock; deal with
  // it in Rest before the clock runs out, or it takes something of yours:
  // permanently, if you had it to spare.
  // deepen: what the first run-out costs when there is nothing to spare (said before the rule);
  // debt: who stops asking the second time. Stress owes nobody: it costs the Crowd, not a debt.
  CF.NEEDS = {
    hunger: { takes: 'health', weight: 3, life: 110,
      arrive: 'You cannot remember your last hot meal. Your hands have started to shake on the stairs.',
      loss: 'Hunger took what it wanted. You are less than you were.',
      deepen: 'You go another day on small beer and nothing.',
      debt: 'The cookshop has stopped asking, and the Market knows why.' },
    sickness: { takes: 'instinct', weight: 2, life: 130,
      arrive: 'A cough from the river, and the river in your chest. The Warrens give it to everyone in the end.',
      loss: 'The cough wore you down for a week. Something of your nose for the street went with it.',
      deepen: 'The cough settles in your chest and will not leave.',
      debt: 'The barber-surgeon has stopped asking, and the Market knows why.' },
    stress: { takes: 'focus', weight: 3, life: 110, owes: false,
      arrive: 'You wake at the same hour every night with the same case behind your eyes. You have started to snap at the sergeant.',
      loss: 'It has worn a groove in you. Some things you will never think as quickly again.',
      deepen: 'You shout at the sergeant in front of the whole Watch-house.',
      debt: 'The sergeant has stopped asking why you snap at him. The whole Watch-house knows.' },
  };
  CF.NEED_DEEPENS = '{deepen} With only one {ability} to your name, {need} cannot take it, so it takes your strength instead, and stays. It will come again.';
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
  // to run out a second time it stops asking, and the Market keeps the debt
  // (Stress owes nobody: the Watch-house talks, and the Crowd hears it).
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
      this.story('Lost: ' + label, spec.loss + ' One ' + label + ' is gone, and it will not come back.', 'harm');
    } else if (repeat >= 1) {
      if (spec.owes !== false) this.count('debt');
      this.meter('pressure', 1);
      this.story(CF.CARDS[card.def].label + ' Deepens', spec.debt, 'danger');
    } else {
      this.create('fatigue');
      this.create(card.def, { lifetime: spec.life, data: { repeat: repeat + 1 } });
      this.story(CF.CARDS[card.def].label + ' Deepens', U.fill(CF.NEED_DEEPENS, { deepen: spec.deepen, ability: label, need: CF.CARDS[card.def].label }), 'danger');
    }
  };

  // ---- The Abbey Takes You In ------------------------------------------------------
  // Once in a file, while you are new to it (no rank, the first four weeks), a strain ending
  // (the Fever, Collapse, Lost in the Case) is not the end: the Abbey hospital keeps you a week.
  // The strain goes, the week runs out to the Bell (if the Bell rings yet), and it costs a
  // Standing and a Coin, or a debt. s.flags.abbey marks it used; the second time is the ending.
  // gameOver asks first (one guarded line in engine.js).
  CF.ABBEY = {
    ends: ['burnout', 'collapse', 'consumed'], weeks: 4,
    title: 'The Abbey Takes You In',
    paid: 'The Brothers carry you to the Abbey hospital and keep you a week on broth and bells. The infirmarian takes a Coin for the bed, and the Council notices the empty desk. The Abbey does this once for a new examiner. Not twice.',
    owed: 'The Brothers carry you to the Abbey hospital and keep you a week on broth and bells. The infirmarian writes the bed against your name, and the Council notices the empty desk. The Abbey does this once for a new examiner. Not twice.',
  };
  P.abbeyReprieve = function (id) {
    var s = this.s, self = this;
    if (CF.ABBEY.ends.indexOf(id) < 0 || s.flags.abbey || (s.rank || 0) > 0 || s.week > CF.ABBEY.weeks) return false;
    s.flags.abbey = true;
    var strain = id === 'consumed' ? ['tunnel', 'obsession'] : ['burnout', 'fatigue'];
    strain.forEach(function (def) {
      self.cardsOf(def).forEach(function (c) { self.remove(c); });
    });
    this.meter('reputation', -1);
    var coin = this.cardsOf('funds')[0];
    if (coin) this.remove(coin); else this.count('debt');
    // A week passes: the Bell rings at the next tick, if it rings yet.
    if (!s.flags.bellSilent) s.weekT = Math.max(s.weekT || 0, CF.WEEK);
    this.story(CF.ABBEY.title, coin ? CF.ABBEY.paid : CF.ABBEY.owed, 'danger');
    this.dirty = true;
    return true;
  };

  // ---- The Rival ----------------------------------------------------------------
  // From the middle of the game the Harbourmaster sends an examiner of his
  // own to show the Council it has a choice. Every week they act against
  // you: take up a case you have opened and race you on it (a week on they
  // boast of a name, a week after that they close it), spoil a scene, pay a
  // witness to forget. A spoiled token and a bought witness carry the mark
  // (data.tampered, data.bribed) for the dossier.
  // The Reformer below the white staff hears of the Coquille before it can be touched: a story
  // in the week the bands begin to gather, and nothing on the meters. Once, and only while the
  // Coquille has not yet formed (see organise in engine.js). Until the staff, the Watch on its
  // stair is the Reformer's answer to it (Attend, a watchman and the Coquille).
  CF.COQUILLE_FORETOLD = { title: 'The Word Nobody Says', text: 'Every fence you question looks at the same door before he lies. Somebody under the Warrens is gathering the bands into one shell. Until you carry the Bailiff\'s staff you cannot go among them: post the Watch on its stair.' };
  function foretellCoquille(e) {
    var s = e.s, f = s.flags;
    if (s.calling !== 'crusader' || s.week < 6 || (s.rank || 0) >= 2 || f.coquilleForetold || f.syndicateFallen) return;
    if ((s.intro && !s.intro.finished) || e.countOf('syndicate')) return;
    f.coquilleForetold = true;
    e.story(CF.COQUILLE_FORETOLD.title, CF.COQUILLE_FORETOLD.text);
  }

  // What the Rival could do at the Bell of week `wk`: race you on a case you have opened and
  // held a week, close one they have raced two, spoil a token, or buy a witness.
  function rivalOptions(e, wk) {
    var open = e.openCases();
    return {
      mine: open.filter(function (x) { return !x.rival && !x.special && x.searches > 0 && wk - (x.week || 0) >= 1; }),
      ripe: open.filter(function (x) { return x.rival && wk - (x.rivalSince || 0) >= 2; }),
      clues: e.tableCards().filter(function (c) { return (c.def === 'clue' || c.def === 'evidence') && CF.CLUE_ASPECTS.some(function (k) { return CF.aspectsOf(c)[k] > 0; }); }),
      witnesses: e.tableCards().filter(function (c) { return c.def === 'witness' && c.life > 40; }),
    };
  }
  // The target of a foreseen move, if it is still there to be taken.
  function rivalAim(next, o) {
    var list = { poach: o.mine, close: o.ripe, tamper: o.clues, bribe: o.witnesses }[next.act] || [];
    for (var i = 0; i < list.length; i++) if ((list[i].uid || list[i].id) === next.id) return list[i];
    return null;
  }
  CF.RIVAL_FORESEEN = {
    poach: '{name} means to take up {target} at the next Bell.',
    close: '{name} means to close {target} at the next Bell, before you do.',
    tamper: '{name}\'s people mean to spoil {target} at the next Bell.',
    bribe: '{name} means to buy {target} at the next Bell.',
    none: '{name} has nothing of yours in hand yet.',
  };
  // A weakness found shows the Rival's next move: chosen now, kept for the Bell (rivalWeek
  // makes it if it still can), and said in one line for the story that found it.
  P.rivalForesee = function () {
    var s = this.s, r = this.cardsOf('rival', true)[0];
    if (!r) return null;
    var o = rivalOptions(this, s.week + 1), acts = [];
    if (o.ripe.length) acts.push('close');
    if (o.mine.length) acts.push('poach');
    if (o.clues.length) acts.push('tamper');
    if (o.witnesses.length) acts.push('bribe');
    if (!acts.length) { delete r.data.next; return U.fill(CF.RIVAL_FORESEEN.none, { name: r.data.name }); }
    var act = U.pick(this.rng, acts);
    var t = U.pick(this.rng, { poach: o.mine, close: o.ripe, tamper: o.clues, bribe: o.witnesses }[act]);
    r.data.next = { act: act, id: t.uid || t.id };
    this.dirty = true;
    return U.fill(CF.RIVAL_FORESEEN[act], { name: r.data.name, target: t.uid ? this.labelOf(t) : t.title });
  };

  // The upright man's Coin, taken once (the 'upright' choice), comes every week while his band
  // stands: one Coin, and every other week the purse is counted. When the band is broken the
  // boy stops coming, and says so once.
  CF.UPRIGHT_WEEK = {
    paid: 'The upright man\'s boy brings the week\'s Coin. The band keeps clear of your stair.',
    broken: 'The boy does not come this week. His upright man is in the Hole, and so, in a manner of speaking, is your Coin.',
    // Two bands sworn into the Coquille: the band card goes, but nobody broke it.
    sworn: 'The boy does not come this week. His band has gone under the Warrens to the King of Thunes, and the King pays nobody.',
  };
  function uprightWeek(e, lines) {
    var f = e.s.flags, band = f.uprightPaid;
    if (!band) return;
    var stands = e.cardsOf('gang', true).some(function (g) { return g.data && g.data.name === band; });
    if (!stands) {
      delete f.uprightPaid;
      lines.push(e.countOf('syndicate') && !f.syndicateFallen ? CF.UPRIGHT_WEEK.sworn : CF.UPRIGHT_WEEK.broken);
      return;
    }
    coins(e, 1);
    f.uprightWeeks = (f.uprightWeeks || 0) + 1;
    if (f.uprightWeeks % 2 === 0) e.count('purse');
    lines.push(CF.UPRIGHT_WEEK.paid);
  }

  // The Rival closes a case of yours before you do: answered, not cold. No Crowd, no Unanswered
  // card; the Council notes who was quicker (Standing -1). Most often they hanged the right name,
  // and the culprit is done; sometimes the confession was bought, the wrong neck paid, and the real
  // culprit keeps their head down until a ballad tells the city (surfaceCriminal, below).
  // A case of the bands, the Court or the Architect is never theirs to close (rivalOptions).
  CF.RIVAL_RIGHT = 0.6;
  P.rivalCloses = function (rec, rival) {
    var s = this.s;
    if (!rec || rec.status !== 'open') return null;
    if (rec.special) { this.goCold(rec.id); return null; }
    var card = this.caseCard(rec.id);
    if (card) this.remove(card);
    rec.status = 'rival';
    if (this.commissionCold) this.commissionCold(rec);
    this.releaseDelegate(rec);
    var culprit = rec.suspects.filter(function (x) { return x.guilty; })[0];
    var others = rec.suspects.filter(function (x) { return !x.guilty; });
    var right = !culprit || !others.length || this.rng() < CF.RIVAL_RIGHT;
    var hanged = right ? culprit : U.pick(this.rng, others);
    s.stats.byRival = (s.stats.byRival || 0) + 1;
    this.emit('resolved', this.caseRecord(rec, 'rival', hanged ? hanged.name : null));
    this.clearCaseCards(rec.id);
    this.meter('reputation', -1);
    if (culprit && right) {
      var caught = this.criminalCaught(culprit.name);
      var al = caught && this.atLargeCardFor(caught);
      if (al) this.remove(al);
    } else if (culprit) {
      var crim = this.criminalEscapes(rec, culprit, 'rival');
      if (this.atLargeCardFor(crim)) this.refreshAtLarge(crim);
      else { this.hideCriminal(crim, rec, 'rope'); crim.wrongfulBy = rival || 'the Harbourmaster\'s Examiner'; }
    }
    this.story('Answered by the Rival', U.fill('{rival} has closed {title} with a confession from {name}, and the Harbourmaster is pleased with it. The Council notes who was quicker.',
      { rival: rival || 'The Harbourmaster\'s Examiner', title: rec.title, name: hanged ? hanged.name : 'somebody' }), 'danger');
    this.dirty = true;
    return { right: right, name: hanged ? hanged.name : null };
  };
  // The wrong name the Rival hanged: the ballad blames their bought confession, not you.
  var surfaceCriminal = P.surfaceCriminal;
  if (surfaceCriminal) P.surfaceCriminal = function (c, crimeFirst) {
    var by = c.wrongfulBy, title = c.wrongfulTitle || 'an old case';
    var dl = CF.DISTRICTS[c.district] ? CF.DISTRICTS[c.district].label : 'the Warrens';
    surfaceCriminal.call(this, c, crimeFirst || !!by);
    if (!by) return;
    delete c.wrongfulBy;
    if (!crimeFirst) this.story('The Wrong Name', U.fill('{name} has been seen in {district}, alive and careful, and a ballad-seller has a new verse about {title}: the confession {rival} was so pleased with was bought, and the wrong neck paid for it. The Warrens have known for a week. Now the Market does.',
      { name: c.name, district: dl, title: title, rival: by }), 'danger');
  };

  // A thread on the Rival (heat, and the ways it was found: r.data.ways) is forgotten three weeks
  // after it was found (r.data.heatWeek, set by the finding or at the next Bell): generous, so the
  // second way is a week's work, not a race against the clock.
  CF.RIVAL_FADE = {
    weeks: 3,
    title: 'Tracks Covered',
    text: '{name} has had three weeks to tidy up behind them. What you had on them would not stand before the Council now. Find it again.',
    line: 'The thread on {name} has gone cold.',
  };
  // The Harbourmaster's Books: each exposed examiner leaves a leaf from the Customs House, and two
  // open a case against the man who sends them (the engine lane's card, template and Rest recipe).
  // While that case is open he sends nobody. Convict him and nobody is ever sent again
  // (harbourmasterFalls, called at the verdict); let it end without him and the next one comes
  // with 'He Has Friends', once for that case.
  CF.HARBOURMASTER = {
    template: 'harbourmaster',
    title: 'The Harbourmaster\'s Books',
    falls: { title: 'The Harbourmaster Falls', text: 'The Customs House is sealed. Nobody will send another examiner against you, because nobody is left who wants to.' },
    friends: { title: 'He Has Friends', text: 'The Harbourmaster\'s books are back on their shelf, and another examiner has his desk: {name}. Catch them out two different ways, a week apart, and the Council sends them home too.' },
    line: 'The Harbourmaster has friends, and another examiner.',
  };
  function isHarbourCase(rec) { return !!rec && (rec.template === CF.HARBOURMASTER.template || rec.title === CF.HARBOURMASTER.title); }
  // The latest case against the Harbourmaster, open or ended; null if there has been none.
  P.harbourCase = function () {
    var cases = this.s.cases || {}, best = null;
    for (var id in cases) if (isHarbourCase(cases[id]) && (!best || (cases[id].week || 0) >= (best.week || 0))) best = cases[id];
    return best;
  };
  // At the verdict on the Harbourmaster's Books: the Harbourmaster himself convicted ends the
  // examiners for good. His clerk convicted, or the wrong neck, leaves him at his desk.
  P.harbourmasterFalls = function (rec, d) {
    var s = this.s;
    if (s.flags.harbourmasterFallen || !isHarbourCase(rec) || !d || !d.guilty) return false;
    var g = (rec.suspects || []).filter(function (x) { return x.guilty; })[0];
    if (!g || g.name !== d.name || !/harbourmaster$/i.test(g.role || '')) return false;
    s.flags.harbourmasterFallen = true;
    this.cardsOf('rival', true).forEach(function (c) { this.remove(c); }, this);
    this.meter('reputation', 3);
    this.favour().council -= 2;
    this.story(CF.HARBOURMASTER.falls.title, CF.HARBOURMASTER.falls.text, 'major');
    this.dirty = true;
    return true;
  };
  CF.RIVAL_NAMES = ['Anselm Vogt', 'Lucia Brenner', 'Konrad Aschauer', 'Margarethe Sturm', 'Piet Wieland', 'Ottilie Kress'];
  P.rivalWeek = function () {
    var s = this.s, lines = [];
    foretellCoquille(this); // the week's other word from the street, before the Rival's
    uprightWeek(this, lines); // and the upright man's boy, if you took his Coin
    if (s.week < 5 || (s.intro && !s.intro.finished)) return lines;
    var r = this.cardsOf('rival', true)[0];
    if (!r) {
      if (s.flags.harbourmasterFallen) return lines;
      var books = this.harbourCase();
      if (books && books.status === 'open') return lines;
      if (s.flags.rivalGone && s.flags.rivalGone > s.week) return lines;
      if (s.flags.rivalSeen && this.rng() > 0.25) return lines;
      if (!s.flags.rivalSeen && this.rng() > 0.4 && s.week < 8) return lines;
      // The second time, a different name, and the office needs no introduction.
      var again = !!s.flags.rivalSeen, last = s.flags.rivalName;
      var name = U.pick(this.rng, CF.RIVAL_NAMES.filter(function (n) { return n !== last; }));
      s.flags.rivalSeen = true;
      s.flags.rivalName = name;
      this.create('rival', { label: 'The Rival: ' + name, data: { name: name, heat: 0, stalled: 0 } });
      if (books && s.flags.harbourFriends !== books.id) {
        s.flags.harbourFriends = books.id;
        this.story(CF.HARBOURMASTER.friends.title, U.fill(CF.HARBOURMASTER.friends.text, { name: name }), 'danger');
        lines.push(CF.HARBOURMASTER.line);
      } else if (again) {
        this.story('Another Examiner', 'The Harbourmaster has found another: ' + name + ', with the same letter and the same desk in the Customs House. They will work your cases from the other side as the last one did. Catch them out two different ways, a week apart, and the Council sends them home too.', 'danger');
        lines.push('The Harbourmaster has sent another examiner.');
      } else {
        this.story('The Harbourmaster\'s Examiner', name + ' has the Harbourmaster\'s letter and a desk in the Customs House. The Harbourmaster wants the Council to see it has a choice. They will work your cases from the other side: close them first, spoil your scenes, pay your witnesses to forget. Question them, buy them, frighten them, or shadow them. Catch them out two different ways, a week apart, and the Council sends them home: questioned with Wit, shadowed with Instinct, or shown their own spoiled work.', 'danger');
        lines.push('The Harbourmaster has sent an examiner of his own.');
      }
      return lines;
    }
    // A weakness found does not keep: three weeks on, they have covered their tracks.
    if (r.data.heat > 0) {
      if (r.data.heatWeek === undefined) r.data.heatWeek = s.week;
      else if (s.week - r.data.heatWeek >= CF.RIVAL_FADE.weeks) {
        r.data.heat = 0;
        delete r.data.heatWeek;
        delete r.data.ways;
        this.story(CF.RIVAL_FADE.title, U.fill(CF.RIVAL_FADE.text, { name: r.data.name }));
        lines.push(U.fill(CF.RIVAL_FADE.line, { name: r.data.name }));
      }
    }
    if (r.data.stalled && r.data.stalled >= s.week) return lines;
    var o = rivalOptions(this, s.week);
    var mine = o.mine, ripe = o.ripe, clues = o.clues, witnesses = o.witnesses;
    var boast = this.openCases().filter(function (x) { return x.rival && s.week - (x.rivalSince || 0) === 1 && !x.rivalBoasted; });
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
    // A move foreseen (rivalForesee) is the move made, if it can still be made.
    var next = r.data.next, aim = next ? rivalAim(next, o) : null;
    delete r.data.next;
    if (!acts.length) { this.dirty = true; return lines; }
    var act = aim ? next.act : U.pick(this.rng, acts);
    if (act === 'poach') {
      var rec = aim || U.pick(this.rng, mine), card = this.caseCard(rec.id);
      rec.rival = true;
      rec.rivalSince = s.week;
      if (card) card.life = Math.min(card.life, card.maxLife * 0.5);
      this.story('The Rival Takes a Case', name2 + ' is working ' + rec.title + ' from the other side, with the Harbourmaster\'s men. Answer it first, or they will.', 'danger');
      lines.push(name2 + ' has taken up one of your cases.');
    } else if (act === 'close') {
      var rec2 = aim || U.pick(this.rng, ripe);
      this.rivalCloses(rec2, name2);
      lines.push(name2 + ' closed a case of yours first.');
    } else if (act === 'tamper') {
      var c = aim || U.pick(this.rng, clues), asp = CF.aspectsOf(c);
      var keys = CF.CLUE_ASPECTS.filter(function (k) { return asp[k] > 0; }), k2 = U.pick(this.rng, keys);
      c.aspects = c.aspects || {};
      c.aspects[k2] = (c.aspects[k2] || asp[k2]) - 1;
      if (c.aspects[k2] <= 0) delete c.aspects[k2];
      c.data = c.data || {};
      c.data.tampered = true;
      this.story('A Scene Spoiled', 'Somebody has been at ' + this.labelOf(c) + ' before you could use it: moved, wiped, muddled. ' + name2 + '\'s people were seen in the lane.', 'danger');
      lines.push(name2 + ' spoiled a token of yours.');
    } else if (act === 'bribe') {
      var w = aim || U.pick(this.rng, witnesses);
      w.life = Math.min(w.life, 30);
      w.data = w.data || {};
      w.data.bribed = true;
      // Counted in the city's days, as every clock is.
      var gone = CF.daysLeft(w.life);
      this.story('A Witness Paid to Forget', U.fill(gone > 1 ? '{label} has had a visit and a purse from {name}, and is suddenly leaving the city in {days} days. Go now, if you want their word.'
        : '{label} has had a visit and a purse from {name}, and is leaving the city tomorrow. Go now, if you want their word.', { label: this.labelOf(w), name: name2, days: gone }), 'danger');
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
      // The answer is the end you work toward: each option names it (other ends stay open).
      title: 'What You Want', text: 'A desk under the stair, a caseload, and a city that has not decided what you are. You have. What is this for? Your answer is the end you work toward.',
      options: [
        { label: 'The Burgomaster', gain: 'Your end: the Council\'s Seat, by office and calm weeks', text: 'Power. Rise through the offices and remake the Watch from the Council chamber. An extra Coin, and a Beadle in service.', effect: function (e) { e.applyCalling('commissioner'); } },
        { label: 'The Scholar', gain: 'Your end: the Architect sentenced, by threads and loose ends', text: 'Knowledge. Trace every small crime back to the hidden hand that drew it. A Sketch-book, and Loose Ends on sound convictions.', effect: function (e) { e.applyCalling('master'); } },
        { label: 'The Reformer', gain: 'Your end: the Coquille broken and its King hanged', text: 'Justice. Break the Coquille by any means, even if it costs your office. An Informer, and the Council\'s eye looks away a little longer.', effect: function (e) { e.applyCalling('crusader'); } },
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
    // The note names one of your open cases: the one somebody wants dropped.
    { id: 'purse', when: function (e) { return e.s.week >= 2 && e.openCases().length > 0; },
      context: function (e) { var rec = U.pick(e.rng, e.openCases()); return rec ? { caseId: rec.id } : null; },
      fill: function (e, ctx) { var rec = anyOpenCase(e, ctx); return { 'case': rec ? rec.title : 'a case of yours' }; },
      title: 'The Note with the Purse', text: 'Three Coin, good silver, and a note with one thing on it: {case}. Nobody saw who left it.',
      again: 'Another purse, heavier than the last, and the same hand on the note: {case}.',
      options: [
        { label: 'Pocket it', gain: '+3 Coin; the Council\'s eye', text: 'Silver is silver. Somebody now believes you can be bought, because you can.', effect: function (e) { coins(e, 3); e.count('purse'); e.meter('scrutiny', 1); } },
        { label: 'Find who left it', cost: 'instinct', gain: 'A name in that case, or an Informer on the Hill', text: 'A boy, a lane, a door on the Hill.',
          effect: function (e, ctx) {
            e.meter('scrutiny', -1); e.meter('retaliation', 1); e.favour().council += 1;
            // The door belongs to somebody in the case the note named, if anyone there is still unnamed.
            var rec = anyOpenCase(e, ctx);
            var sc = rec && rec.suspects.some(function (x) { return !x.revealed && !x.cleared; }) ? e.revealSuspect(rec, null) : null;
            if (sc) return U.fill('The boy leads you up the Hill to a door that does not open to you. You know whose it is: {name}, in {case}.', { name: sc.label, 'case': rec.title });
            e.create('informant', e.informantSpec('uptown'));
            return 'A boy, a lane, a door on the Hill that does not open to you. But the boy will, for a coin now and then.';
          } },
        { label: 'Give it to the poor-box', gain: 'The Bishop\'s favour; Standing rises', text: 'The chaplain blinks. The Council hears of it, and so does whoever left it.', effect: function (e) { e.meter('reputation', 1); e.meter('retaliation', 1); e.favour().bishop += 1; } },
      ] },
    { id: 'informer', when: function (e) { return e.cardsOf('informant').length >= 1; },
      title: 'The Informer\'s Brother', text: 'Your informer asks a favour, the first they have ever asked. Their brother runs untaxed wine through the Water-gate. The Watch is due there on Thursday.',
      options: [
        { label: 'Look away on Thursday', cost: 'focus', gain: 'Your informer\'s trust', text: 'The wine comes through. Your informer will remember, and so will the Council if it ever learns.', effect: function (e) { e.meter('scrutiny', 1); e.meter('dread', -1); e.cardsOf('informant').forEach(function (c) { if (e.trustInformant) e.trustInformant(c, 1); }); } },
        { label: 'Send the Watch as planned', gain: 'Standing rises; Vendetta', text: 'The brother is taken. Your informer stops meeting your eye.', effect: function (e) { e.meter('reputation', 1); e.meter('retaliation', 1); e.cardsOf('informant').forEach(function (c) { if (e.trustInformant) e.trustInformant(c, -1); }); } },
      ] },
    { id: 'bishop', when: function (e) { return e.s.week >= 3; },
      title: 'The Bishop\'s Invitation', text: 'The Bishop would be glad to see the Examiner at the cathedral on Sunday, in the front pew, where the whole city can see.',
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
        { label: 'Bar the door and sleep', gain: 'Nothing; he may come back', text: 'You sleep with the halberd by the bed.', effect: function (e) { if (e.rng() < 0.3) e.hurtYou('He did not lose his nerve the second time.', 'stair'); } },
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
        { label: 'Take it', gain: '+1 Coin a week while the band stands; Purse; Vendetta eases', text: 'The boy comes every week. The band keeps clear of your stair, and the Market knows why.',
          effect: function (e) { coins(e, 1); e.count('purse'); e.meter('retaliation', -3); var g = e.cardsOf('gang', true)[0]; if (g) e.s.flags.uprightPaid = g.data.name; } },
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
        { label: 'Send them out of the city', gain: 'Your informer goes; Dread eases', text: 'A cart at the Water-gate before dawn. The Warrens hear that the Examiner does not forget a friend.',
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
  // What the window shows of a question's answers: read from its spec, so a save holds a copy.
  function choiceView(spec) {
    return spec.options.map(function (o) { return { label: o.label, text: o.text, cost: o.cost || null, gain: o.gain || null, forGood: !!o.forGood }; });
  }
  // A save keeps the answers as they were when it was written, while choose() runs the spec's own.
  // On load the shown answers are read again from the spec (its title and text stay), so an answer
  // added since, like the free way out of the swan, is there to take. Returns true if they changed.
  P.refreshChoice = function () {
    var c = this.s.choice, spec = c && CF.CHOICES.filter(function (x) { return x.id === c.id; })[0];
    if (!spec) return false;
    var now = choiceView(spec), was = JSON.stringify(c.options || []);
    c.options = now;
    return JSON.stringify(now) !== was;
  };
  P.offerChoice = function (spec, ctx) {
    var s = this.s;
    // Asked before: the second wording, if it has one.
    var text = choiceAsked(this, spec) && spec.again ? spec.again : spec.text;
    // A question about something of yours: the case it is about is chosen now, and named in the text.
    if (!ctx && spec.context) ctx = spec.context(this);
    if (spec.fill) text = U.fill(text, spec.fill(this, ctx || null));
    (s.choicesSeen || (s.choicesSeen = {}))[spec.id] = s.week;
    s.choiceLast = s.t;
    s.choice = { id: spec.id, title: spec.title, text: text, ctx: ctx || null, options: choiceView(spec) };
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
    // An answer that turns out one of two ways says which (the effect returns its own words).
    var told = opt.effect(this, c.ctx || null);
    this.story(c.title + ': ' + opt.label, (typeof told === 'string' ? told : opt.text) + (opt.gain ? ' (' + opt.gain + ')' : ''), 'major');
    this.emit('chosen', { id: c.id, option: i });
    this.dirty = true;
    return true;
  };
  // What an answer would do, without doing it: the answer is given on a copy of the game (the same
  // dice, no listeners), and what moved is read back: meters, favour, and cards by kind (a spent Wit
  // reads as one Wit less and one Wits' End more). For the window's icons; an answer whose return
  // comes later (a flag, a relation, an event next week) shows nothing here, so its words stay.
  P.choicePreview = function (i) {
    if (!this.s.choice || !this.canChoose(i)) return null;
    var t = CF.Engine.load(this.save());
    if (!t.choose(i)) return null;
    function kinds(e) { var n = {}; Object.keys(e.s.cards).forEach(function (u) { var c = e.s.cards[u]; if (c && c.loc) n[c.def] = (n[c.def] || 0) + 1; }); return n; }
    function diff(a, b) { var out = {}; Object.keys(a).concat(Object.keys(b)).forEach(function (k) { var d = (b[k] || 0) - (a[k] || 0); if (d) out[k] = d; }); return out; }
    return { meters: diff(this.s.meters, t.s.meters), favour: diff(this.s.favour || {}, t.s.favour || {}), cards: diff(kinds(this), kinds(t)) };
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
