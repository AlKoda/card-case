// Verb definitions. A verb has a primary slot; filling it opens the rest.
// Each slot accepts cards carrying any of the listed aspects (card kind counts
// as an aspect). `when(primary)` decides whether a secondary slot appears.
(function (G) {
  var CF = G.CF;
  function has(card, a) { return card && CF.aspectsOf(card)[a] > 0; }
  function any(card, list) { for (var i = 0; i < list.length; i++) if (has(card, list[i])) return true; return false; }

  CF.VERBS = {
    time: {
      label: 'Time', auto: true, rank: 0,
      desc: 'The city clock. Every week rent comes out of your Funds, and the city moves on without you.',
      slots: [],
    },
    duty: {
      label: 'Duty', rank: 0, lockedBy: 'burnout',
      desc: 'Your paid shift. Put in Health for a hard beat shift or Focus for desk work. Also: promotion boards, training your team, protecting an informant with an officer, and envelopes left on your desk.',
      slots: [
        { key: 'main', label: 'Shift', accepts: ['health', 'focus', 'teammate', 'bribe', 'promotion', 'chair', 'informant'], primary: true },
        { key: 'extra', label: 'Paperwork / Funds', accepts: ['paperwork', 'funds'],
          when: function (p) { return any(p, ['focus', 'teammate']); } },
        { key: 'extra2', label: 'Funds', accepts: ['funds'], when: function (p) { return has(p, 'teammate'); } },
        { key: 'guard', label: 'Officer', accepts: ['teammate'], when: function (p) { return has(p, 'informant'); } },
      ],
    },
    patrol: {
      label: 'Patrol', rank: 0, lockedBy: 'burnout',
      desc: 'Walk the city. Instinct finds new districts and trouble. Instinct and a District works those streets. Meet an Informant here with Funds.',
      slots: [
        { key: 'main', label: 'Walk', accepts: ['instinct', 'health', 'informant'], primary: true },
        { key: 'where', label: 'District', accepts: ['district'], when: function (p) { return any(p, ['instinct', 'health']); } },
        { key: 'pay', label: 'Funds', accepts: ['funds'], when: function (p) { return has(p, 'informant'); } },
        { key: 'help', label: 'Team', accepts: ['teammate'], when: function (p) { return any(p, ['instinct', 'health']); } },
      ],
    },
    investigate: {
      label: 'Investigate', rank: 0, lockedBy: 'burnout',
      desc: 'Work a case. Alone, you search the scene. With the case\'s District, you canvass the neighbourhood for witnesses and suspects. Put a Suspect in instead and you can search their home without a warrant: fast, and Internal Affairs would love to hear about it.',
      slots: [
        { key: 'main', label: 'Case / Suspect', accepts: ['case', 'suspect'], primary: true },
        { key: 'where', label: 'District', accepts: ['district'], when: function (p) { return has(p, 'case'); } },
        { key: 'tool', label: 'Equipment', accepts: ['tool'], when: function (p) { return has(p, 'case'); } },
        { key: 'help', label: 'Team', accepts: ['teammate'], when: function (p) { return has(p, 'case'); } },
        { key: 'mind', label: 'Approach', accepts: ['focus', 'instinct'], when: function (p) { return has(p, 'case'); } },
      ],
    },
    analyze: {
      label: 'Analyze', rank: 0,
      desc: 'Process evidence into clues. Some evidence needs the right equipment. With Lab Access, a clue can go back to the bench once for more. With an Archive, reopen Cold Cases here. Put a Suspect in with Funds and you can... arrange for evidence to exist.',
      slots: [
        { key: 'main', label: 'Evidence', accepts: ['evidence', 'coldcase', 'suspect', 'clue'], primary: true },
        { key: 'tool', label: 'Equipment', accepts: ['tool'], when: function (p) { return any(p, ['evidence', 'clue']); } },
        { key: 'help', label: 'Team', accepts: ['teammate'], when: function (p) { return any(p, ['evidence', 'coldcase']); } },
        { key: 'pay', label: 'Funds', accepts: ['funds'], when: function (p) { return has(p, 'suspect'); } },
        { key: 'pay2', label: 'Funds', accepts: ['funds'], when: function (p) { return has(p, 'suspect'); } },
      ],
    },
    interrogate: {
      label: 'Interrogate', rank: 0, lockedBy: 'burnout',
      desc: 'Question a Witness or Suspect. Your approach matters: Focus for empathy, Instinct for a bluff, Health for pressure. Confronting a suspect with a clue from their own case can crack them.',
      slots: [
        { key: 'main', label: 'Subject', accepts: ['witness', 'suspect'], primary: true },
        { key: 'mind', label: 'Approach', accepts: ['focus', 'instinct', 'health'], when: function (p) { return !!p; } },
        { key: 'clue', label: 'Confront With', accepts: ['clue'], when: function (p) { return has(p, 'suspect'); } },
        { key: 'help', label: 'Team', accepts: ['teammate'], when: function (p) { return !!p; } },
      ],
    },
    reflect: {
      label: 'Reflect', rank: 0,
      desc: 'Your mind palace, and your bed. Rest away Fatigue and Burnout. Let go of Obsession. Lay clues side by side and reason: two descriptions of the same person become an identification, money and motive become a theory. Bring a Case with its clues to see who it points to.',
      slots: [
        { key: 'main', label: 'Mind', accepts: ['case', 'fatigue', 'burnout', 'obsession', 'tunnel', 'coldcase', 'looseend', 'notes', 'clue', 'intel', 'thread'], primary: true },
        { key: 'a', label: 'Clue', accepts: ['clue', 'atlarge', 'looseend', 'gang', 'syndicate'], when: function (p) { return any(p, ['case', 'coldcase', 'looseend', 'clue', 'intel', 'thread']); } },
        { key: 'b', label: 'Clue', accepts: ['clue', 'looseend'], when: function (p) { return any(p, ['case', 'looseend', 'clue']); } },
        { key: 'c', label: 'Clue', accepts: ['clue'], when: function (p) { return any(p, ['case', 'clue']); } },
        { key: 'pay', label: 'Funds', accepts: ['funds'], when: function (p) { return any(p, ['fatigue', 'burnout', 'obsession', 'tunnel']); } },
      ],
    },
    arrest: {
      label: 'Arrest', rank: 0,
      desc: 'Charge a Suspect. Add clues from their case to build the Charge. A thin charge is quick but a jury may let them walk, and they will not forget.',
      slots: [
        { key: 'main', label: 'Suspect', accepts: ['suspect'], primary: true },
        { key: 'c1', label: 'Charge', accepts: ['clue'], when: function (p) { return !!p; } },
        { key: 'c2', label: 'Charge', accepts: ['clue'], when: function (p) { return !!p; } },
        { key: 'c3', label: 'Charge', accepts: ['clue'], when: function (p) { return !!p; } },
        { key: 'c4', label: 'Charge', accepts: ['clue'], when: function (p) { return !!p; } },
      ],
    },
    requisition: {
      label: 'Requisition', rank: 0,
      desc: 'Spend Funds. Put in a Requisition Form or a Personnel File, then enough Funds to cover it.',
      slots: [
        { key: 'main', label: 'Form', accepts: ['order', 'personnel'], primary: true },
        { key: 'f1', label: 'Funds', accepts: ['funds'], when: function (p) { return !!p; } },
        { key: 'f2', label: 'Funds', accepts: ['funds'], when: function (p) { return !!p; } },
        { key: 'f3', label: 'Funds', accepts: ['funds'], when: function (p) { return !!p; } },
        { key: 'f4', label: 'Funds', accepts: ['funds'], when: function (p) { return !!p; } },
        { key: 'f5', label: 'Funds', accepts: ['funds'], when: function (p) { return !!p && CF.costOf(p) > 4; } },
        { key: 'f6', label: 'Funds', accepts: ['funds'], when: function (p) { return !!p && CF.costOf(p) > 5; } },
        { key: 'f7', label: 'Funds', accepts: ['funds'], when: function (p) { return !!p && CF.costOf(p) > 6; } },
        { key: 'f8', label: 'Funds', accepts: ['funds'], when: function (p) { return !!p && CF.costOf(p) > 7; } },
        { key: 'f9', label: 'Funds', accepts: ['funds'], when: function (p) { return !!p && CF.costOf(p) > 8; } },
      ],
    },

    // --- Unlocked by rank ----------------------------------------------
    warrant: {
      label: 'Warrant', rank: 1,
      desc: 'Search a Suspect\'s home and business. You need probable cause: a clue from their case. A warrant on an innocent person is a mark against you.',
      slots: [
        { key: 'main', label: 'Suspect', accepts: ['suspect'], primary: true },
        { key: 'cause', label: 'Probable Cause', accepts: ['clue'], when: function (p) { return !!p; } },
        { key: 'help', label: 'Team', accepts: ['teammate'], when: function (p) { return !!p; } },
      ],
    },
    stakeout: {
      label: 'Stakeout', rank: 2,
      desc: 'Sit in a car and watch a Suspect for a long, cold night. The guilty do guilty things. The innocent go to bed. Watch a known Front instead to see which of your cases passes through it.',
      slots: [
        { key: 'main', label: 'Target', accepts: ['suspect', 'front'], primary: true },
        { key: 'mind', label: 'Watcher', accepts: ['instinct', 'teammate'], when: function (p) { return !!p; } },
        { key: 'tool', label: 'Equipment', accepts: ['tool'], when: function (p) { return !!p; } },
      ],
    },
    undercover: {
      label: 'Undercover', rank: 2,
      desc: 'Go under. Point yourself at someone At Large, a Gang, or the Syndicate itself. Takes a long time, costs Health if it goes wrong, and gets results nothing else can.',
      slots: [
        { key: 'main', label: 'Target', accepts: ['atlarge', 'gang', 'syndicate', 'front'], primary: true },
        { key: 'mind', label: 'Cover', accepts: ['instinct'], when: function (p) { return !!p; } },
        { key: 'help', label: 'Backup', accepts: ['teammate'], when: function (p) { return !!p; } },
      ],
    },
    taskforce: {
      label: 'Task Force', rank: 3,
      desc: 'Hand a Case to a Task Force of your officers. They work it in parallel with you and bring back whatever they find.',
      slots: [
        { key: 'main', label: 'Case', accepts: ['case'], primary: true },
        { key: 't1', label: 'Officer', accepts: ['teammate'], when: function (p) { return !!p; } },
        { key: 't2', label: 'Officer', accepts: ['teammate'], when: function (p) { return !!p; } },
        { key: 't3', label: 'Officer', accepts: ['teammate'], when: function (p) { return !!p; } },
      ],
    },
  };

  CF.VERBS.delegate = {
    label: 'Delegate', rank: 2,
    desc: 'Hand a Case to an officer. They work it on their own, in parallel with you, turning up something from the scene every half minute until it is closed. They come back when it is.',
    slots: [
      { key: 'main', label: 'Case', accepts: ['case'], primary: true },
      { key: 'who', label: 'Officer', accepts: ['teammate'], when: function (p) { return !!p; } },
    ],
  };
  CF.VERBS.majorcrimes = {
    label: 'Major Crimes', rank: 3,
    desc: 'The division answers to you now. Declare a Case a Major Crime (with Funds) and the city gives it time, attention and a name; or put a District in to focus the division there.',
    slots: [
      { key: 'main', label: 'Case / District', accepts: ['case', 'district'], primary: true },
      { key: 'pay', label: 'Funds', accepts: ['funds'], when: function (p) { return has(p, 'case'); } },
      { key: 'pay2', label: 'Funds', accepts: ['funds'], when: function (p) { return has(p, 'case'); } },
    ],
  };

  CF.VERB_ORDER = ['time', 'duty', 'patrol', 'investigate', 'analyze', 'interrogate', 'reflect', 'arrest',
    'requisition', 'warrant', 'stakeout', 'delegate', 'undercover', 'taskforce', 'majorcrimes'];
})(typeof window !== 'undefined' ? window : globalThis);
