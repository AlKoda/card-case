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
  // The first cases are the ordinary ones; the lesser and stranger crimes come later.
  CF.FIRST_CASES = ['burglary', 'missing', 'harbor', 'arson', 'fraud', 'extortion', 'poison', 'coining'];
  CF.OPENING_BEAT = {
    title: 'Back from the Round',
    text: 'It is past matins and you are just in from the night round, wet to the knee and dead on your feet. The day-book is still open on the desk: the sergeant will not enter it for you. Enter it (Wit in Attend), then sleep (Weariness in Rest). The city will knock soon enough.',
  };
  P.setupOpening = function () {
    var s = this.s;
    s.flags.opening = true;
    s.flags.firstCase = false;
    this.create('fatigue');
    this.create('fatigue');
    this.story(CF.OPENING_BEAT.title, CF.OPENING_BEAT.text, 'major');
    this.dirty = true;
  };
  // The first case knocks once you have slept, or when the city runs out of patience.
  P.openingTick = function () {
    var s = this.s;
    if (!s.flags.opening || s.flags.firstCase) return;
    var rested = (s.stats.verbs && s.stats.verbs.reflect) || 0;
    if (rested < 1 && s.t < 150) return;
    s.flags.firstCase = true;
    s.needT = U.randInt(this.rng, 150, 240) + 60;
    s.choiceT = 90;
    var card = this.spawnCase(U.pick(this.rng, CF.FIRST_CASES), { lifetime: 300, quiet: true });
    var rec = this.caseRec(card.caseId);
    this.story('A Knock at the Door', 'The sergeant, with a lantern and a face. The first case of your office. ' + card.desc, 'case');
    if (s.intro && !s.intro.finished && this.introUnlock) {
      this.introUnlock(['investigate']);
      s.intro.hint = 'Drag the case onto Explore, then press what it offers. When it is done, open it: what it found lies face down. Tap a card to turn it over, tap it again to take it.';
    }
    void rec;
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
  function nextNeedIn(e) { return U.randInt(e.rng, 150, 240); }
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

  // ---- Choices ------------------------------------------------------------------
  // The city puts a question to you and the clock stops until you answer.
  // Each answer bends what comes after: the Crowd, the Council's eye, the
  // underworld's grudge, the city's Dread of you, your purse.
  CF.CHOICES = [
    { id: 'beggar', when: function (e) { return e.cardsOf('funds').length >= 1; },
      title: 'The Beggar at the Door', text: 'A woman with a child on her hip has been at the Watch-house door since prime. She does not ask for anything. She just stands there, where the Council\'s clerks can see her.',
      options: [
        { label: 'Give her a Coin', text: 'The child gets bread. The clerks get a story about you.', effect: function (e) { e.spend(1); e.meter('dread', -1); e.meter('pressure', -1); } },
        { label: 'Have the sergeant move her on', text: 'She goes. The lane remembers.', effect: function (e) { e.meter('dread', 1); } },
      ] },
    { id: 'clerk', when: function (e) { return e.s.week >= 2; },
      title: 'The Clerk\'s Favour', text: 'The Council\'s clerk lingers after delivering the stipend. A councillor\'s son was found where he should not have been, with people he should not have known. There is a file. It would be a kindness if there were not.',
      options: [
        { label: 'Lose the file', text: 'The Council owes you one, and knows you can be asked.', effect: function (e) { e.favour().council += 2; e.count('purse'); e.meter('scrutiny', -1); e.meter('dread', 1); } },
        { label: 'Keep the file', text: 'The clerk\'s smile does not reach his eyes. Your name is spoken in the chamber, not warmly.', effect: function (e) { e.favour().council -= 1; e.meter('reputation', 1); } },
      ] },
    { id: 'crowd', when: function (e) { return e.s.stats.cold >= 1 && e.s.meters.pressure >= 3; },
      title: 'The Crowd Wants a Name', text: 'The unanswered case has a song now, and the song has a verse about you. A sergeant suggests, carefully, that there is a vagrant in the cells who would confess to anything for a dry bed.',
      options: [
        { label: 'Give them the vagrant', text: 'The Crowd is fed. Someone who did nothing hangs for it, and the city learns what you are.', effect: function (e) { e.meter('pressure', -3); e.meter('dread', 2); e.count('cruelty', 2); e.s.stats.wrongful++; } },
        { label: 'Hold the line', text: 'You say the case is open. The song gets another verse.', effect: function (e) { e.meter('pressure', 1); e.meter('reputation', 1); e.count('mercy'); } },
      ] },
    { id: 'purse', when: function (e) { return e.s.week >= 2; },
      title: 'A Purse on the Desk', text: 'Nobody saw who left it. Three Coin, good silver, and a note with the name of a case on it and nothing else.',
      options: [
        { label: 'Pocket it', text: 'Silver is silver. Somebody now believes you can be bought, because you can.', effect: function (e) { for (var i = 0; i < 3; i++) e.create('funds'); e.count('purse'); e.meter('scrutiny', 1); } },
        { label: 'Give it to the poor-box', text: 'The chaplain blinks. The Council hears of it, and so does whoever left it.', effect: function (e) { e.meter('reputation', 1); e.meter('retaliation', 1); e.favour().bishop += 1; } },
      ] },
    { id: 'informer', when: function (e) { return e.cardsOf('informant').length >= 1; },
      title: 'The Informer\'s Brother', text: 'Your informer asks a favour, the first they have ever asked. Their brother runs untaxed wine through the Water-gate. The Watch is due there on Thursday.',
      options: [
        { label: 'Look away on Thursday', text: 'The wine comes through. Your informer will remember, and so will the Council if it ever learns.', effect: function (e) { e.meter('scrutiny', 1); e.meter('dread', -1); e.cardsOf('informant').forEach(function (c) { if (e.trustInformant) e.trustInformant(c, 1); }); } },
        { label: 'Send the Watch as planned', text: 'The brother is taken. Your informer stops meeting your eye.', effect: function (e) { e.meter('reputation', 1); e.meter('retaliation', 1); e.cardsOf('informant').forEach(function (c) { if (e.trustInformant) e.trustInformant(c, -1); }); } },
      ] },
    { id: 'bishop', when: function (e) { return e.s.week >= 3; },
      title: 'The Bishop\'s Invitation', text: 'The Bishop would be glad to see the Examiner at the cathedral on Sunday, in the front pew, where the city can see him too.',
      options: [
        { label: 'Go, and be seen', text: 'The Bishop is pleased. The Council notes whose pew you sat in.', effect: function (e) { e.favour().bishop += 2; e.favour().council -= 1; e.meter('dread', -1); } },
        { label: 'Send your regrets', text: 'The Council is pleased. The Bishop\'s chaplain stops greeting you in the street.', effect: function (e) { e.favour().council += 1; e.favour().bishop -= 1; } },
      ] },
    { id: 'swan', when: function (e) { return e.countOf('fatigue') >= 1 && e.cardsOf('funds').length >= 1; },
      title: 'A Room at the Swan', text: 'The landlord of the Swan, who owes the Watch a kindness, offers a room with a fire and a door that locks. One night. Tonight.',
      options: [
        { label: 'Take the room', text: 'You sleep like the dead and wake like the living.', effect: function (e) { e.spend(1); var f = e.cardsOf('fatigue', true)[0]; if (f) e.remove(f); } },
        { label: 'Work through', text: 'A Coin for the night\'s writing, and the ache goes a little deeper.', effect: function (e) { e.create('funds'); e.create('fatigue'); } },
      ] },
    { id: 'watchman', when: function (e) { return e.cardsOf('teammate', true).length >= 1; },
      title: 'The Watchman\'s Mother', text: 'One of your watchmen asks for the week: his mother is dying in the Warrens and there is nobody else. The round will be short a man.',
      options: [
        { label: 'Give him the week, and his wage', text: 'He goes. The others see it.', effect: function (e) { e.spend(1); e.meter('reputation', 1); e.meter('dread', -1); } },
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
  P.choose = function (i) {
    var s = this.s, c = s.choice;
    if (!c) return false;
    var spec = CF.CHOICES.filter(function (x) { return x.id === c.id; })[0];
    var opt = spec && spec.options[i];
    if (!opt) return false;
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
