// Verb definitions. A verb has a primary slot; filling it opens the rest.
// Each slot accepts cards carrying any of the listed aspects (card kind counts
// as an aspect). `when(primary)` decides whether a secondary slot appears.
// Keys are the old ones (duty, patrol...); only the words have changed.
(function (G) {
  var CF = G.CF;
  function has(card, a) { return card && CF.aspectsOf(card)[a] > 0; }
  function any(card, list) { for (var i = 0; i < list.length; i++) if (has(card, list[i])) return true; return false; }

  CF.VERBS = {
    time: {
      label: 'The Bell', auto: true, rank: 0,
      desc: 'The bell in the Rathaus tower. At every week\'s end your lodging and dues come out of your Coin, and the city goes on without you.',
      slots: [],
    },
    duty: {
      label: 'Attend', rank: 0, lockedBy: 'burnout',
      desc: 'Your hours at the Watch-house. Put in Health to walk a hard round for pay, or Wit to sit with the day-book. Also: the Council\'s letters, drilling your watchmen, guarding an informer with a watchman, and purses left on your desk.',
      slots: [
        { key: 'main', label: 'Hours', accepts: ['health', 'focus', 'teammate', 'bribe', 'writsale', 'tribute', 'promotion', 'chair', 'informant', 'case'], primary: true },
        { key: 'extra', label: 'Rolls / Coin', accepts: ['paperwork', 'funds'],
          when: function (p) { return any(p, ['focus', 'teammate', 'case']); } },
        { key: 'extra2', label: 'Coin', accepts: ['funds'], when: function (p) { return any(p, ['teammate', 'case']); } },
        { key: 'guard', label: 'Watchman', accepts: ['teammate'], when: function (p) { return has(p, 'informant'); } },
      ],
    },
    patrol: {
      label: 'Walk the Ward', rank: 0, lockedBy: 'burnout',
      desc: 'Take the lantern out. Instinct finds new quarters and trouble; Instinct with a Quarter works those streets. Meet an Informer here with Coin.',
      slots: [
        { key: 'main', label: 'Lantern', accepts: ['instinct', 'health', 'informant'], primary: true },
        { key: 'where', label: 'Quarter', accepts: ['district'], when: function (p) { return any(p, ['instinct', 'health']); } },
        { key: 'pay', label: 'Coin', accepts: ['funds'], when: function (p) { return has(p, 'informant'); } },
        { key: 'help', label: 'Watch', accepts: ['teammate'], when: function (p) { return any(p, ['instinct', 'health']); } },
      ],
    },
    investigate: {
      label: 'Examine', rank: 0, lockedBy: 'burnout',
      desc: 'Go to the scene. Alone, you search it. With the case\'s Quarter, you go door to door for witnesses and names. Put an Accused in instead and you can search their lodging without a Writ: quick, and the Council would love to hear of it.',
      slots: [
        { key: 'main', label: 'Case / Accused', accepts: ['case', 'suspect'], primary: true },
        { key: 'where', label: 'Quarter', accepts: ['district'], when: function (p) { return has(p, 'case'); } },
        { key: 'tool', label: 'Instrument', accepts: ['tool'], when: function (p) { return has(p, 'case'); } },
        { key: 'help', label: 'Watch', accepts: ['teammate'], when: function (p) { return has(p, 'case'); } },
        { key: 'mind', label: 'Manner', accepts: ['focus', 'instinct'], when: function (p) { return has(p, 'case'); } },
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
      label: 'Contemplate', rank: 0,
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
      label: 'Indict', rank: 0,
      desc: 'Bring an Accused before the Blood Court. Add tokens from their case to build the charge. Indicia alone will not convict: the Court wants two witnesses, or a confession, or enough of the right proof that the sworn men stop asking.',
      slots: [
        { key: 'main', label: 'Accused', accepts: ['suspect'], primary: true },
        { key: 'c1', label: 'Proof', accepts: ['clue'], when: function (p) { return !!p; } },
        { key: 'c2', label: 'Proof', accepts: ['clue'], when: function (p) { return !!p; } },
        { key: 'c3', label: 'Proof', accepts: ['clue'], when: function (p) { return !!p; } },
        { key: 'c4', label: 'Proof', accepts: ['clue'], when: function (p) { return !!p; } },
      ],
    },
    sentence: {
      label: 'Sentence', rank: 0,
      desc: 'The Condemned wait in the Hole for your word. Put one beside a rung of the ladder and the Council follows. A plea, or a free confession, is a reason for mercy. Every rung has its price: in Mercy, in Cruelty, in what the city thinks of you.',
      slots: [
        { key: 'main', label: 'The Condemned', accepts: ['condemned'], primary: true },
        { key: 'rung', label: 'The Ladder', accepts: ['rung'], when: function (p) { return !!p; } },
        { key: 'plea', label: 'Plea', accepts: ['plea', 'clue'], when: function (p) { return !!p; } },
      ],
    },
    requisition: {
      label: 'Petition', rank: 0,
      desc: 'Spend Coin. Put in a Petition or a Letter of Service, then enough Coin to cover it.',
      slots: [
        { key: 'main', label: 'Petition', accepts: ['order', 'personnel'], primary: true },
        { key: 'f1', label: 'Coin', accepts: ['funds'], when: function (p) { return !!p; } },
        { key: 'f2', label: 'Coin', accepts: ['funds'], when: function (p) { return !!p; } },
        { key: 'f3', label: 'Coin', accepts: ['funds'], when: function (p) { return !!p; } },
        { key: 'f4', label: 'Coin', accepts: ['funds'], when: function (p) { return !!p; } },
        { key: 'f5', label: 'Coin', accepts: ['funds'], when: function (p) { return !!p && CF.costOf(p) > 4; } },
        { key: 'f6', label: 'Coin', accepts: ['funds'], when: function (p) { return !!p && CF.costOf(p) > 5; } },
        { key: 'f7', label: 'Coin', accepts: ['funds'], when: function (p) { return !!p && CF.costOf(p) > 6; } },
        { key: 'f8', label: 'Coin', accepts: ['funds'], when: function (p) { return !!p && CF.costOf(p) > 7; } },
        { key: 'f9', label: 'Coin', accepts: ['funds'], when: function (p) { return !!p && CF.costOf(p) > 8; } },
      ],
    },

    // --- Unlocked by office ----------------------------------------------
    warrant: {
      label: 'Writ', rank: 1,
      desc: 'A magistrate\'s seal to search an Accused\'s house and shop. You need cause: a token from their case. A Writ served on the innocent is a mark against you.',
      slots: [
        { key: 'main', label: 'Accused', accepts: ['suspect'], primary: true },
        { key: 'cause', label: 'Cause', accepts: ['clue'], when: function (p) { return !!p; } },
        { key: 'help', label: 'Watch', accepts: ['teammate'], when: function (p) { return !!p; } },
      ],
    },
    stakeout: {
      label: 'Watch', rank: 2,
      desc: 'Stand in a doorway with the lantern shuttered and watch an Accused through one long cold night. The guilty do guilty things. The innocent go to bed. Watch a known Front instead to see which of your cases passes through it.',
      slots: [
        { key: 'main', label: 'Mark', accepts: ['suspect', 'front'], primary: true },
        { key: 'mind', label: 'Watcher', accepts: ['instinct', 'teammate'], when: function (p) { return !!p; } },
        { key: 'tool', label: 'Instrument', accepts: ['tool'], when: function (p) { return !!p; } },
      ],
    },
    undercover: {
      label: 'Disguise', rank: 2,
      desc: 'Take off the badge and put on a coat that is nobody\'s. Point yourself at someone Abroad, a Band, or the Coquille itself. It takes a long time, costs Health if it goes wrong, and brings back what nothing else can. The Coquille with Wit is a parley; with Instinct and Coin, its court tries you, and you may stay.',
      slots: [
        { key: 'main', label: 'Mark', accepts: ['atlarge', 'gang', 'syndicate', 'front'], primary: true },
        { key: 'mind', label: 'Cover', accepts: ['instinct', 'focus'], when: function (p) { return !!p; } },
        { key: 'help', label: 'Second', accepts: ['teammate'], when: function (p) { return !!p; } },
        { key: 'coin', label: 'Coin', accepts: ['funds'], when: function (p) { return has(p, 'syndicate'); } },
        { key: 'coin2', label: 'Coin', accepts: ['funds'], when: function (p) { return has(p, 'syndicate'); } },
      ],
    },
    taskforce: {
      label: 'Muster', rank: 3,
      desc: 'Call out the Watch on a Case. Your watchmen work it together while you work elsewhere, and bring back whatever they find.',
      slots: [
        { key: 'main', label: 'Case', accepts: ['case'], primary: true },
        { key: 't1', label: 'Watchman', accepts: ['teammate'], when: function (p) { return !!p; } },
        { key: 't2', label: 'Watchman', accepts: ['teammate'], when: function (p) { return !!p; } },
        { key: 't3', label: 'Watchman', accepts: ['teammate'], when: function (p) { return !!p; } },
      ],
    },
  };

  CF.VERBS.delegate = {
    label: 'Deputise', rank: 2,
    desc: 'Hand a Case to a watchman. They work it alone, turning up something from the scene every half minute until it is closed, and come back when it is.',
    slots: [
      { key: 'main', label: 'Case', accepts: ['case'], primary: true },
      { key: 'who', label: 'Watchman', accepts: ['teammate'], when: function (p) { return !!p; } },
    ],
  };
  CF.VERBS.majorcrimes = {
    label: 'Proclamation', rank: 3,
    desc: 'The crier answers to you now. Proclaim a Case through the city (with Coin) and it gets time, a reward posted, and a name on every lip; or put a Quarter in to turn the Watch\'s eyes there.',
    slots: [
      { key: 'main', label: 'Case / Quarter', accepts: ['case', 'district'], primary: true },
      { key: 'pay', label: 'Coin', accepts: ['funds'], when: function (p) { return has(p, 'case'); } },
      { key: 'pay2', label: 'Coin', accepts: ['funds'], when: function (p) { return has(p, 'case'); } },
    ],
  };

  CF.VERB_ORDER = ['time', 'duty', 'patrol', 'investigate', 'analyze', 'interrogate', 'reflect', 'arrest', 'sentence',
    'requisition', 'warrant', 'stakeout', 'delegate', 'undercover', 'taskforce', 'majorcrimes'];
})(typeof window !== 'undefined' ? window : globalThis);
