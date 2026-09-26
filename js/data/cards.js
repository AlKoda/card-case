// Static card definitions: the data half of the card system (see
// docs/DESIGN.md, "Cards are data"). A definition has
//   label, kind, aspects, tags, decay (seconds; omitted = permanent),
//   image (an --art-* key; omitted = the UI picks one), onExpire, stackable.
// A card instance may override label/desc/aspects/tags/image (clues, suspects
// and cases are generated), but its def supplies kind, colour and behaviour.
(function (G) {
  var CF = G.CF;

  // The six clue aspects that build a Charge.
  CF.ASPECTS = {
    forensic: { label: 'Forensic', short: 'FOR', color: '#3fb6a8', meaning: 'Physical evidence: prints, fibres, tool marks, blood.' },
    testimony: { label: 'Testimony', short: 'TES', color: '#e0a84a', meaning: 'What people say they saw, heard or did.' },
    motive: { label: 'Motive', short: 'MOT', color: '#d8605a', meaning: 'Why anyone would want this done.' },
    opportunity: { label: 'Opportunity', short: 'OPP', color: '#a07ae0', meaning: 'Who could have been there, then, with the means.' },
    digital: { label: 'Digital', short: 'DIG', color: '#4f95e6', meaning: 'Cameras, phones, computers, records that time-stamp themselves.' },
    financial: { label: 'Financial', short: 'FIN', color: '#62bd5c', meaning: 'Money moving: payments, debts, insurance, who profits.' },
  };
  CF.CLUE_ASPECTS = Object.keys(CF.ASPECTS);

  // Kinds control colour and which slots a card fits (kind is also an aspect).
  CF.KINDS = {
    ability: { label: 'Ability', color: '#c9b37e' },
    funds: { label: 'Funds', color: '#b9a24a' },
    threat: { label: 'Threat', color: '#9c3b3b' },
    case: { label: 'Case', color: '#c0392b' },
    coldcase: { label: 'Cold Case', color: '#5a6f86' },
    clue: { label: 'Clue', color: '#d8cfb8' },
    evidence: { label: 'Evidence', color: '#8a6a45' },
    witness: { label: 'Witness', color: '#6f9bbd' },
    suspect: { label: 'Suspect', color: '#b86b3c' },
    district: { label: 'District', color: '#4f7a5a' },
    equipment: { label: 'Equipment', color: '#7f8c8d' },
    order: { label: 'Requisition', color: '#95876a' },
    room: { label: 'Precinct Room', color: '#56606e' },
    personnel: { label: 'Personnel File', color: '#8a8f6a' },
    teammate: { label: 'Team', color: '#3d7ea6' },
    hospital: { label: 'Hospital', color: '#6b6f78' },
    informant: { label: 'Informant', color: '#7a5c8a' },
    intel: { label: 'Intelligence', color: '#8a6f9c' },
    place: { label: 'Place', color: '#4f7a5a' },
    criminal: { label: 'Criminal', color: '#5b1f1f' },
    court: { label: 'Court', color: '#8e7cc3' },
    paper: { label: 'Paperwork', color: '#a8a290' },
    temptation: { label: 'Temptation', color: '#c7a13b' },
    career: { label: 'Career', color: '#d4af37' },
    insight: { label: 'Insight', color: '#b48ede' },
    calling: { label: 'Calling', color: '#e6d3a3' },
  };

  CF.CARDS = {
    // --- You -----------------------------------------------------------
    health: { label: 'Health', kind: 'ability', tags: ['you', 'body'], image: 'icon-health', aspects: { health: 1 },
      desc: 'Your body: stamina for a beat shift, fists for a hard interrogation, legs for a long night.' },
    focus: { label: 'Focus', kind: 'ability', tags: ['you', 'mind'], image: 'icon-focus', aspects: { focus: 1 },
      desc: 'Patience and method. Good for desk work, careful interviews and quiet evenings in the mind palace.' },
    instinct: { label: 'Instinct', kind: 'ability', tags: ['you', 'street'], image: 'icon-instinct', aspects: { instinct: 1 },
      desc: 'The hunch, the bluff, the itch between the shoulder blades. It walks the streets with you.' },
    wound: { label: 'Wound', kind: 'threat', tags: ['you', 'injury'], image: 'icon-health', aspects: { wound: 1 }, decay: 150, onExpire: 'heal',
      desc: 'Stitches and bruises. When it heals you get your Health back. Get hurt again before then and you may not get up.' },
    funds: { label: 'Funds', kind: 'funds', tags: ['money'], image: 'icon-funds', aspects: { funds: 1 }, stackable: true,
      desc: 'Money. Rent comes out of it every week. So does everything else.' },

    // --- Threats -------------------------------------------------------
    fatigue: { label: 'Fatigue', kind: 'threat', tags: ['strain'], image: 'icon-fatigue', aspects: { fatigue: 1 }, stackable: true,
      desc: 'Too many hours. Three of these and you burn out. Sleep it off in Reflect.' },
    burnout: { label: 'Burnout', kind: 'threat', tags: ['strain', 'collapse'], image: 'icon-burnout', aspects: { burnout: 1 }, decay: 120, onExpire: 'burnout',
      desc: 'You cannot face the street. Duty, Patrol, Investigate and Interrogate are closed to you. Rest in Reflect before this runs out, or you are finished.' },
    obsession: { label: 'Obsession', kind: 'threat', tags: ['strain'], image: 'icon-obsession', aspects: { obsession: 1 }, stackable: true,
      desc: 'A case is under your skin. Three of these harden into Tunnel Vision. Closing a case eases it; so does letting go in Reflect.' },
    tunnel: { label: 'Tunnel Vision', kind: 'threat', tags: ['strain', 'collapse'], image: 'icon-redeye', aspects: { tunnel: 1 },
      desc: 'You see what you want to see. Some clues you find now are misread and will not hold up. A conviction, or a long night in Reflect, clears it. More Obsession on top of this will swallow you.' },

    // --- Casework ------------------------------------------------------
    case: { label: 'Case', kind: 'case', tags: ['casework'], aspects: { case: 1 }, onExpire: 'cold',
      desc: 'An open case.' },
    coldcase: { label: 'Cold Case', kind: 'coldcase', tags: ['casework', 'cold'], aspects: { coldcase: 1 },
      desc: 'A case that went cold. Someone walked. With an Archive, it can be reopened in Analyze.' },
    clue: { label: 'Clue', kind: 'clue', tags: ['casework', 'proof'], aspects: { clue: 1 }, decay: 300, onExpire: 'vanish',
      desc: 'A clue.' },
    evidence: { label: 'Evidence', kind: 'evidence', tags: ['casework', 'raw'], aspects: { evidence: 1 }, decay: 260, onExpire: 'vanish',
      desc: 'Unprocessed evidence. Take it to Analyze.' },
    witness: { label: 'Witness', kind: 'witness', tags: ['casework', 'person'], aspects: { witness: 1 }, decay: 170, onExpire: 'vanish',
      desc: 'Someone who saw something. They will not stay around forever.' },
    suspect: { label: 'Suspect', kind: 'suspect', tags: ['casework', 'person'], aspects: { suspect: 1 },
      desc: 'A person of interest.' },
    district: { label: 'District', kind: 'district', tags: ['place'], aspects: { district: 1 },
      desc: 'A part of the city.' },

    // --- Equipment (slot into Investigate / Analyze) --------------------
    // Equipment changes what recipes do (see docs/DESIGN.md, "Equipment"):
    //   boost:   { tags, aspects }  adds aspects to clues found from items with one of the tags
    //   gate:    'prints'|'bio'|'lab'  evidence that "needs" this analyses properly with it
    //   unlocks: a recipe id it makes possible; unlocksVerb: a verb it opens
    camera: { label: 'Camera', kind: 'equipment', tags: ['tool'], image: 'icon-camera', aspects: { tool: 1 },
      mods: { unlocks: 'inv_photograph', boost: { tags: ['watching'], aspects: { opportunity: 1 } } },
      desc: 'Photographs don\'t forget. Put it in Investigate with a case to photograph the scene: what you have found stops degrading, and the pictures are evidence. On a Stakeout it catches what you saw.' },
    prints: { label: 'Fingerprint Set', kind: 'equipment', tags: ['tool', 'kit', 'surfaces'], image: 'aspect-forensic', aspects: { tool: 1, kit_prints: 1 },
      mods: { gate: 'prints', boost: { tags: ['surfaces'], aspects: { forensic: 1 } } },
      desc: 'Powder, brush, lifting tape. Reads latent prints properly, and sharpens anything found on a surface.' },
    kit: { label: 'Forensic Kit', kind: 'equipment', tags: ['tool', 'kit', 'biology'], image: 'icon-search', aspects: { tool: 1, kit_bio: 1 },
      mods: { gate: 'bio', boost: { tags: ['biology', 'physical'], aspects: { forensic: 1 } }, extraEvidence: true },
      desc: 'Swabs, vials and a UV lamp. Needed for blood and fibres, sharpens physical evidence, and finds more of it at a scene.' },
    surveillance: { label: 'Surveillance Gear', kind: 'equipment', tags: ['tool', 'watching'], image: 'icon-binoculars', aspects: { tool: 1 },
      mods: { unlocksVerb: 'stakeout', boost: { tags: ['watching'], aspects: { opportunity: 1, digital: 1 } } },
      desc: 'Long lenses and wire taps. Opens the Stakeout, whatever your rank, and turns a night\'s watching into photographs and transcripts.' },
    labpass: { label: 'Lab Access', kind: 'equipment', tags: ['tool', 'access'], image: 'icon-mind', aspects: { tool: 1, kit_lab: 1 },
      mods: { gate: 'lab', unlocks: 'an_enhance', boost: { tags: ['records'], aspects: { digital: 1 } } },
      desc: 'A badge for the city lab. Needed for phones, ledgers and anything under a microscope, and lets you take a clue back to the bench to get more out of it.' },

    // --- Requisitions --------------------------------------------------
    order: { label: 'Requisition Form', kind: 'order', tags: ['precinct', 'form'], image: 'icon-folder', aspects: { order: 1 },
      desc: 'Put this into Requisition with enough Funds.' },
    room: { label: 'Precinct Room', kind: 'room', tags: ['precinct'], image: 'icon-court', aspects: { room: 1 }, desc: 'Part of your precinct.' },
    personnel: { label: 'Personnel File', kind: 'personnel', tags: ['precinct', 'person'], aspects: { personnel: 1 },
      desc: 'Someone who could join your team. Put this into Requisition with Funds to hire them.' },
    teammate: { label: 'Officer', kind: 'teammate', tags: ['team', 'person'], aspects: { teammate: 1 },
      desc: 'A member of your team. Slot them in to help work a case. Train them in Duty.' },
    injured: { label: 'Injured Officer', kind: 'hospital', tags: ['team', 'person', 'injury'], aspects: { injured: 1 }, decay: 150, onExpire: 'recover',
      desc: 'In hospital. They will be back, if nothing else happens to them.' },
    informant: { label: 'Informant', kind: 'informant', tags: ['street', 'person'], aspects: { informant: 1 },
      desc: 'A street contact. Left on the table they bring rumours, sightings and warnings on their own time; pay them in Patrol for a proper tip and their trust. Every meeting warms them up: at three they are compromised and go quiet. Protect them in Duty with an officer.' },
    intel: { label: 'Intelligence', kind: 'intel', tags: ['street'], image: 'icon-binoculars', aspects: { intel: 1 }, decay: 100, onExpire: 'ignored',
      desc: 'Something an informant heard. It will not stay true for long.' },

    front: { label: 'Front', kind: 'place', tags: ['place', 'crime'], image: 'icon-court', aspects: { front: 1 },
      desc: 'A place the network works through.' },
    thread: { label: 'Thread', kind: 'insight', tags: ['insight'], image: 'icon-hook', aspects: { thread: 1 },
      desc: 'Two cases that touch the same place. They are connected, and now you know it.' },

    // --- The criminal ecosystem ----------------------------------------
    atlarge: { label: 'At Large', kind: 'criminal', tags: ['crime', 'person'], aspects: { atlarge: 1, criminal: 1 },
      desc: 'Someone who got away. Every week they are out there, Retaliation grows. Three of them will find each other.' },
    gang: { label: 'Gang', kind: 'criminal', tags: ['crime', 'network'], image: 'icon-roots', aspects: { gang: 1, criminal: 1 },
      desc: 'Criminals who got away and found each other. They feed Retaliation every week. Go Undercover to build a case against them.' },
    syndicate: { label: 'The Syndicate', kind: 'criminal', tags: ['crime', 'network'], image: 'icon-pyramid', aspects: { syndicate: 1, criminal: 1 },
      desc: 'The gangs have a board of directors now. Retaliation surges every week. Only a deep Undercover operation can reach them.' },

    // --- Court and paperwork -------------------------------------------
    trial: { label: 'Trial', kind: 'court', tags: ['court'], image: 'icon-gavel', aspects: { trial: 1 }, decay: 45, onExpire: 'verdict',
      desc: 'The case is before a judge. The verdict comes when this runs out.' },
    paperwork: { label: 'Paperwork', kind: 'paper', tags: ['precinct', 'form'], image: 'icon-folder', aspects: { paperwork: 1 }, stackable: true,
      desc: 'Reports, forms, statements. Filing it properly in Duty (with Focus) soothes Internal Affairs.' },
    bribe: { label: 'An Envelope', kind: 'temptation', tags: ['money', 'corrupt'], image: 'icon-handshake', aspects: { bribe: 1 }, decay: 50, onExpire: 'vanish',
      desc: 'Thick, unmarked, left on your desk. Put it in Duty to pocket it. Or let it sit until someone takes it back.' },

    // --- Career ----------------------------------------------------------
    promo_inspector: { label: 'Promotion Board: Inspector', kind: 'career', tags: ['career'], image: 'icon-star', aspects: { promotion: 1 },
      desc: 'The brass have noticed you. Attend the board in Duty.' },
    promo_chief: { label: 'Promotion Board: Chief', kind: 'career', tags: ['career'], image: 'icon-star', aspects: { promotion: 1 },
      desc: 'They want you running the precinct. Attend the board in Duty.' },
    chair: { label: 'The Commissioner\'s Chair', kind: 'career', tags: ['career'], image: 'icon-court', aspects: { chair: 1 },
      desc: 'The council meets to choose a new Commissioner. Bring this to Duty. They will look hard at Public Pressure and Scrutiny.' },

    // --- Insight (victory paths) ---------------------------------------
    looseend: { label: 'Loose End', kind: 'insight', tags: ['insight'], image: 'icon-hook', aspects: { looseend: 1 }, stackable: true,
      desc: 'A detail that belongs to no case. The same shape keeps appearing. Three of these, together in Reflect, might show you who is drawing it.' },
    ledger: { label: 'Ledger Page', kind: 'insight', tags: ['insight', 'money'], image: 'icon-scales', aspects: { ledger: 1 }, stackable: true,
      desc: 'A page from the syndicate\'s books: payments, names, dates. Enough of these and the Syndicate cannot hide.' },
    notes: { label: 'Predecessor\'s Notes', kind: 'insight', tags: ['insight'], image: 'icon-folder', aspects: { notes: 1 },
      desc: 'Your predecessor\'s notebook. Half of it is illegible. Read it in Reflect.' },

    calling_commissioner: { label: 'Calling: The Commissioner', kind: 'calling', tags: ['calling'], image: 'icon-star', aspects: { calling: 1 },
      desc: 'Power. Climb to Chief, earn a great Reputation, then take the Commissioner\'s Chair and remake the force.' },
    calling_master: { label: 'Calling: The Master Detective', kind: 'calling', tags: ['calling'], image: 'icon-mind', aspects: { calling: 1 },
      desc: 'Knowledge. Solid convictions and cold cases leave Loose Ends. Bring three to Reflect, find the Architect behind them, and convict them.' },
    calling_crusader: { label: 'Calling: The Crusader', kind: 'calling', tags: ['calling'], image: 'icon-scales', aspects: { calling: 1 },
      desc: 'Justice. Go Undercover against the gangs (you will need to be Inspector), take their Ledger Pages, drag the Syndicate into the light and convict it. Whatever it costs.' },
  };

  // Things you can requisition. rank = minimum rank index to see the form.
  CF.ORDERS = {
    camera: { label: 'Camera', cost: 2, give: 'camera', rank: 0 },
    prints: { label: 'Fingerprint Set', cost: 3, give: 'prints', rank: 0 },
    kit: { label: 'Forensic Kit', cost: 4, give: 'kit', rank: 0 },
    locker: { label: 'Evidence Locker', cost: 4, room: 'locker', rank: 0 },
    suite: { label: 'Interrogation Suite', cost: 5, room: 'suite', rank: 1 },
    labpass: { label: 'Lab Access', cost: 5, give: 'labpass', rank: 1 },
    surveillance: { label: 'Surveillance Gear', cost: 6, give: 'surveillance', rank: 1 },
    archive: { label: 'Archive', cost: 5, room: 'archive', rank: 1 },
    lab: { label: 'Crime Lab', cost: 9, room: 'lab', rank: 2 },
  };

  CF.ROOMS = {
    locker: { label: 'Evidence Locker', desc: 'Clues and evidence keep twice as long.' },
    suite: { label: 'Interrogation Suite', desc: 'Interrogations are faster and draw out more Testimony.' },
    archive: { label: 'Archive', desc: 'Cold Cases can be reopened in Analyze.' },
    lab: { label: 'Crime Lab', desc: 'Analysis is faster, and no evidence needs special equipment.' },
  };

  // Officer traits change what a verb does when the officer is in it.
  CF.OFFICER_TRAITS = {
    thorough: { label: 'Thorough', desc: 'Finds one more thing at every scene.' },
    streetwise: { label: 'Streetwise', desc: 'Doors open for them. A canvass turns up one more person.' },
    empathetic: { label: 'Empathetic', desc: 'Witnesses trust them. A bluff never scares anyone off.' },
    sharp: { label: 'Sharp', desc: 'Reads evidence properly even without the right kit.' },
    patient: { label: 'Patient', desc: 'Analysis and stakeouts take a fifth less time.' },
    steady: { label: 'Steady', desc: 'Working beside them, you do not tire.' },
  };

  // Personnel you can hire. aspects are what they bring to a case; traits
  // are drawn from the pool when they are hired.
  CF.PERSONNEL = {
    rookie: { label: 'Rookie Officer', cost: 1, role: 'Officer', aspects: { testimony: 1, opportunity: 1 }, traits: ['thorough', 'streetwise', 'steady'],
      desc: 'Eager, green, and cheap. Knocks on doors without complaining.' },
    tech: { label: 'Forensic Technician', cost: 3, role: 'Technician', aspects: { forensic: 2 }, traits: ['sharp', 'patient', 'thorough'],
      desc: 'Talks to microscopes more than people. The microscopes talk back.' },
    interviewer: { label: 'Interviewer', cost: 3, role: 'Sergeant', aspects: { testimony: 2, motive: 1 }, traits: ['empathetic', 'patient', 'streetwise'],
      desc: 'Makes tea. Listens. People tell her things they have never told anyone.' },
    analyst: { label: 'Analyst', cost: 4, role: 'Analyst', aspects: { digital: 2, financial: 2 }, traits: ['sharp', 'patient'],
      desc: 'Reads bank statements like novels and phone records like poetry.' },
    veteran: { label: 'Veteran Detective', cost: 5, role: 'Detective', aspects: { opportunity: 2, motive: 2, testimony: 1 }, traits: ['thorough', 'streetwise', 'steady', 'empathetic'], nTraits: 2,
      desc: 'Thirty years on the job. Has seen this before. Has seen everything before.' },
  };

  CF.RANKS = ['Detective', 'Inspector', 'Chief'];
  CF.RANK_REP = [0, 6, 15]; // reputation needed for the board to convene
  CF.COMMISSIONER_REP = 24;

  CF.CALLINGS = {
    commissioner: { card: 'calling_commissioner', label: 'The Commissioner', theme: 'Power',
      blurb: 'Climb the ranks. Reshape the city\'s police force from the top.',
      bonus: 'Start with an extra Funds and a Rookie Officer already hired.' },
    master: { card: 'calling_master', label: 'The Master Detective', theme: 'Knowledge',
      blurb: 'Trace every small crime back to the hidden mastermind behind them.',
      bonus: 'Start with a Camera. Loose Ends appear on solid convictions.' },
    crusader: { card: 'calling_crusader', label: 'The Crusader', theme: 'Justice',
      blurb: 'Dismantle the syndicate by any means, even if it costs your badge.',
      bonus: 'Start with an Informant. Internal Affairs looks the other way a little longer.' },
  };
})(typeof window !== 'undefined' ? window : globalThis);
