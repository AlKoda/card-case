// Verb definitions. A verb has a primary slot; filling it opens the rest.
// Each slot accepts cards carrying any of the listed aspects (card kind counts
// as an aspect). `when(primary)` decides whether a secondary slot appears.
// Keys are the old ones (duty, patrol...); only the words have changed.
(function (G) {
  var CF = G.CF;
  function has(card, a) { return card && CF.aspectsOf(card)[a] > 0; }
  function any(card, list) { for (var i = 0; i < list.length; i++) if (has(card, list[i])) return true; return false; }

  // Six verbs, like a table should have (the tutorial opens them one at a
  // time). The offices do not add tokens any more: they open recipes inside
  // these (a Writ in Explore, the Court's trial in Explore, a Muster in
  // Attend...). CF.POWERS lists what each office opens, for the letter.
  CF.VERBS = {
    time: {
      label: 'The Bell', auto: true, rank: 0,
      desc: 'The bell in the Rathaus tower. At every week\'s end your lodging and dues come out of your Coin, and the city goes on without you.',
      slots: [],
    },
    duty: {
      label: 'Attend', rank: 0, lockedBy: 'burnout',
      desc: 'The Watch-house. Work for Coin (Health walks a hard round, Wit keeps the day-book), spend it (a Petition or a Letter of Service with Coin), and attend to what lands on the desk: the Council\'s letters, purses, your watchmen. A Case here with watchmen musters them; with Wit and Coin it is cried through the city.',
      slots: [
        { key: 'main', label: 'Hours', accepts: ['health', 'focus', 'teammate', 'bribe', 'writsale', 'tribute', 'promotion', 'chair', 'informant', 'case', 'order', 'personnel', 'district'], primary: true },
        { key: 'extra', label: 'Rolls / Coin', accepts: ['paperwork', 'funds'], when: function (p) { return any(p, ['focus', 'teammate', 'case', 'district']); } },
        { key: 'extra2', label: 'Coin', accepts: ['funds'], when: function (p) { return any(p, ['teammate', 'case']); } },
        { key: 'mind', label: 'Wit', accepts: ['focus'], when: function (p) { return has(p, 'case'); } },
        { key: 't1', label: 'Watchman', accepts: ['teammate'], when: function (p) { return has(p, 'case'); } },
        { key: 't2', label: 'Watchman', accepts: ['teammate'], when: function (p) { return has(p, 'case'); } },
        { key: 't3', label: 'Watchman', accepts: ['teammate'], when: function (p) { return has(p, 'case'); } },
        { key: 'guard', label: 'Watchman', accepts: ['teammate'], when: function (p) { return has(p, 'informant'); } },
        { key: 'f1', label: 'Coin', accepts: ['funds'], when: function (p) { return any(p, ['order', 'personnel']); } },
        { key: 'f2', label: 'Coin', accepts: ['funds'], when: function (p) { return any(p, ['order', 'personnel']); } },
        { key: 'f3', label: 'Coin', accepts: ['funds'], when: function (p) { return any(p, ['order', 'personnel']); } },
        { key: 'f4', label: 'Coin', accepts: ['funds'], when: function (p) { return any(p, ['order', 'personnel']); } },
        { key: 'f5', label: 'Coin', accepts: ['funds'], when: function (p) { return any(p, ['order', 'personnel']) && CF.costOf(p) > 4; } },
        { key: 'f6', label: 'Coin', accepts: ['funds'], when: function (p) { return any(p, ['order', 'personnel']) && CF.costOf(p) > 5; } },
        { key: 'f7', label: 'Coin', accepts: ['funds'], when: function (p) { return any(p, ['order', 'personnel']) && CF.costOf(p) > 6; } },
        { key: 'f8', label: 'Coin', accepts: ['funds'], when: function (p) { return any(p, ['order', 'personnel']) && CF.costOf(p) > 7; } },
        { key: 'f9', label: 'Coin', accepts: ['funds'], when: function (p) { return any(p, ['order', 'personnel']) && CF.costOf(p) > 8; } },
      ],
    },
    investigate: {
      label: 'Explore', rank: 0, lockedBy: 'burnout',
      desc: 'Go out. A Case: search its scene, or with its Quarter go door to door. Instinct alone: walk the ward and see what the city offers; an Informer with Coin talks. An Accused: search their lodging without a Writ, or with a token as cause serve one (Sworn Examiner), or with Instinct or a watchman watch their door (Bailiff). Someone Abroad, a Band or the Coquille with Instinct: go in Disguise (Bailiff).',
      slots: [
        { key: 'main', label: 'Case / Mark', accepts: ['case', 'suspect', 'instinct', 'health', 'informant', 'front', 'atlarge', 'gang', 'syndicate'], primary: true },
        { key: 'where', label: 'Quarter', accepts: ['district'], when: function (p) { return any(p, ['case', 'instinct', 'health']); } },
        { key: 'tool', label: 'Instrument', accepts: ['tool'], when: function (p) { return any(p, ['case', 'suspect', 'front']); } },
        { key: 'help', label: 'Watch', accepts: ['teammate'], when: function (p) { return any(p, ['case', 'suspect', 'instinct', 'health', 'atlarge', 'gang', 'syndicate']); } },
        { key: 'mind', label: 'Manner', accepts: ['focus', 'instinct', 'teammate'], when: function (p) { return any(p, ['case', 'suspect', 'front', 'atlarge', 'gang', 'syndicate']); } },
        { key: 'cause', label: 'Cause', accepts: ['clue'], when: function (p) { return has(p, 'suspect'); } },
        { key: 'pay', label: 'Coin', accepts: ['funds'], when: function (p) { return has(p, 'informant'); } },
        { key: 'coin', label: 'Coin', accepts: ['funds'], when: function (p) { return has(p, 'syndicate'); } },
        { key: 'coin2', label: 'Coin', accepts: ['funds'], when: function (p) { return has(p, 'syndicate'); } },
      ],
    },
    analyze: {
      label: 'Study', rank: 0,
      desc: 'Make raw proof speak. Some of it needs the right instrument. With the Apothecary\'s Key, a token can go back to the bench once for more. With the Rolls, open an unanswered case again here. Put an Accused in with Coin and you can... arrange for proof to exist.',
      slots: [
        { key: 'main', label: 'Raw Proof', accepts: ['evidence', 'coldcase', 'suspect', 'clue'], primary: true },
        { key: 'tool', label: 'Instrument', accepts: ['tool'], when: function (p) { return any(p, ['evidence', 'clue']); } },
        { key: 'help', label: 'Watch', accepts: ['teammate'], when: function (p) { return any(p, ['evidence', 'coldcase']); } },
        { key: 'pay', label: 'Coin', accepts: ['funds'], when: function (p) { return has(p, 'suspect'); } },
        { key: 'pay2', label: 'Coin', accepts: ['funds'], when: function (p) { return has(p, 'suspect'); } },
      ],
    },
    interrogate: {
      label: 'Question', rank: 0, lockedBy: 'burnout',
      desc: 'Question a Witness or an Accused. Your manner matters: Wit to listen, Instinct to bluff, Health to lean. Confronting the accused with a token from their own case can break them.',
      slots: [
        { key: 'main', label: 'Subject', accepts: ['witness', 'suspect'], primary: true },
        { key: 'mind', label: 'Manner', accepts: ['focus', 'instinct', 'health'], when: function (p) { return !!p; } },
        { key: 'clue', label: 'Confront With', accepts: ['clue'], when: function (p) { return has(p, 'suspect'); } },
        { key: 'help', label: 'Watch', accepts: ['teammate'], when: function (p) { return !!p; } },
      ],
    },
    reflect: {
      label: 'Rest', rank: 0,
      desc: 'Your study, and your bed. Sleep off Weariness and Fever. Let go of Obsession. Lay tokens side by side and reason: two descriptions of one person become an identification, coin and motive become a theory. Bring a Case with its tokens to see who it points to.',
      slots: [
        { key: 'main', label: 'Mind', accepts: ['case', 'fatigue', 'burnout', 'obsession', 'tunnel', 'coldcase', 'looseend', 'notes', 'clue', 'intel', 'thread', 'dagger'], primary: true },
        { key: 'a', label: 'Token', accepts: ['clue', 'atlarge', 'looseend', 'gang', 'syndicate'], when: function (p) { return any(p, ['case', 'coldcase', 'looseend', 'clue', 'intel', 'thread']); } },
        { key: 'b', label: 'Token', accepts: ['clue', 'looseend'], when: function (p) { return any(p, ['case', 'looseend', 'clue']); } },
        { key: 'c', label: 'Token', accepts: ['clue'], when: function (p) { return any(p, ['case', 'clue']); } },
        { key: 'pay', label: 'Coin', accepts: ['funds'], when: function (p) { return any(p, ['fatigue', 'burnout', 'obsession', 'tunnel', 'dagger']); } },
        { key: 'pay2', label: 'Coin', accepts: ['funds'], when: function (p) { return has(p, 'dagger'); } },
      ],
    },
    arrest: {
      label: 'The Court', rank: 0,
      desc: 'The Blood Court. An Accused with tokens from their case is a charge: indicia alone will not convict; the Court wants two witnesses, a confession, or enough of the right proof. The Condemned with a rung of the ladder is a sentence; a plea or a free confession is a reason for mercy.',
      slots: [
        { key: 'main', label: 'Accused / Condemned', accepts: ['suspect', 'condemned'], primary: true },
        { key: 'c1', label: 'Proof', accepts: ['clue'], when: function (p) { return has(p, 'suspect'); } },
        { key: 'c2', label: 'Proof', accepts: ['clue'], when: function (p) { return has(p, 'suspect'); } },
        { key: 'c3', label: 'Proof', accepts: ['clue'], when: function (p) { return has(p, 'suspect'); } },
        { key: 'c4', label: 'Proof', accepts: ['clue'], when: function (p) { return has(p, 'suspect'); } },
        { key: 'rung', label: 'The Ladder', accepts: ['rung'], when: function (p) { return has(p, 'condemned'); } },
        { key: 'plea', label: 'Plea', accepts: ['plea', 'clue'], when: function (p) { return has(p, 'condemned'); } },
      ],
    },
  };
  // Old verb ids (saves, gear, tests) fold into the six.
  CF.VERB_ALIAS = { patrol: 'investigate', warrant: 'investigate', stakeout: 'investigate', undercover: 'investigate',
    sentence: 'arrest', requisition: 'duty', taskforce: 'duty', delegate: 'duty', majorcrimes: 'duty' };
  // What each office opens, inside the verbs.
  CF.POWERS = {
    warrant: { label: 'Writ', rank: 1, verb: 'investigate', art: 'nverb-08', text: 'An Accused with a token as cause in Explore: a magistrate seals a Writ to search their house.' },
    stakeout: { label: 'Watch', rank: 2, verb: 'investigate', art: 'nverb-09', text: 'An Accused or a Front with Instinct or a watchman in Explore: watch their door through the night.' },
    undercover: { label: 'Disguise', rank: 2, verb: 'investigate', art: 'nverb-10', text: 'Someone Abroad, a Band or the Coquille with Instinct in Explore: go among them.' },
    delegate: { label: 'Deputise', rank: 2, verb: 'duty', art: 'nverb-11', text: 'A Case with one watchman in Attend: they work it alone.' },
    taskforce: { label: 'Muster', rank: 3, verb: 'duty', art: 'nverb-11', text: 'A Case with two or three watchmen in Attend: the Watch works it together.' },
    majorcrimes: { label: 'Proclamation', rank: 3, verb: 'duty', art: 'nverb-03', text: 'A Case with Wit and Coin in Attend: the crier sings it; a Quarter alone turns the Watch\'s eyes there.' },
  };

  CF.VERB_ORDER = ['time', 'duty', 'investigate', 'analyze', 'interrogate', 'reflect', 'arrest'];
})(typeof window !== 'undefined' ? window : globalThis);
