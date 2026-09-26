// Static card definitions. A card instance may override label/desc/aspects
// (clues, suspects and cases are generated), but its def supplies the kind,
// colour, default lifetime and behaviour on expiry.
(function (G) {
  var CF = G.CF;

  // The six clue aspects that build a Charge.
  CF.ASPECTS = {
    forensic: { label: 'Forensic', short: 'FOR', color: '#3fb6a8' },
    testimony: { label: 'Testimony', short: 'TES', color: '#e0a84a' },
    motive: { label: 'Motive', short: 'MOT', color: '#d8605a' },
    opportunity: { label: 'Opportunity', short: 'OPP', color: '#a07ae0' },
    digital: { label: 'Digital', short: 'DIG', color: '#4f95e6' },
    financial: { label: 'Financial', short: 'FIN', color: '#62bd5c' },
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
    health: { label: 'Health', kind: 'ability', aspects: { health: 1 },
      desc: 'Your body: stamina for a beat shift, fists for a hard interrogation, legs for a long night.' },
    focus: { label: 'Focus', kind: 'ability', aspects: { focus: 1 },
      desc: 'Patience and method. Good for desk work, careful interviews and quiet evenings in the mind palace.' },
    instinct: { label: 'Instinct', kind: 'ability', aspects: { instinct: 1 },
      desc: 'The hunch, the bluff, the itch between the shoulder blades. It walks the streets with you.' },
    wound: { label: 'Wound', kind: 'threat', aspects: { wound: 1 }, lifetime: 150, onExpire: 'heal',
      desc: 'Stitches and bruises. When it heals you get your Health back. Get hurt again before then and you may not get up.' },
    funds: { label: 'Funds', kind: 'funds', aspects: { funds: 1 }, stackable: true,
      desc: 'Money. Rent comes out of it every week. So does everything else.' },

    // --- Threats -------------------------------------------------------
    fatigue: { label: 'Fatigue', kind: 'threat', aspects: { fatigue: 1 }, stackable: true,
      desc: 'Too many hours. Three of these and you burn out. Sleep it off in Reflect.' },
    burnout: { label: 'Burnout', kind: 'threat', aspects: { burnout: 1 }, lifetime: 120, onExpire: 'burnout',
      desc: 'You cannot face the street. Duty, Patrol, Investigate and Interrogate are closed to you. Rest in Reflect before this runs out, or you are finished.' },
    obsession: { label: 'Obsession', kind: 'threat', aspects: { obsession: 1 }, stackable: true,
      desc: 'A case is under your skin. Three of these harden into Tunnel Vision. Closing a case eases it; so does letting go in Reflect.' },
    tunnel: { label: 'Tunnel Vision', kind: 'threat', aspects: { tunnel: 1 },
      desc: 'You see what you want to see. Some clues you find now are misread and will not hold up. A conviction, or a long night in Reflect, clears it. More Obsession on top of this will swallow you.' },

    // --- Casework ------------------------------------------------------
    case: { label: 'Case', kind: 'case', aspects: { case: 1 }, onExpire: 'cold',
      desc: 'An open case.' },
    coldcase: { label: 'Cold Case', kind: 'coldcase', aspects: { coldcase: 1 },
      desc: 'A case that went cold. Someone walked. With an Archive, it can be reopened in Analyze.' },
    clue: { label: 'Clue', kind: 'clue', aspects: { clue: 1 }, lifetime: 300, onExpire: 'vanish',
      desc: 'A clue.' },
    evidence: { label: 'Evidence', kind: 'evidence', aspects: { evidence: 1 }, lifetime: 260, onExpire: 'vanish',
      desc: 'Unprocessed evidence. Take it to Analyze.' },
    witness: { label: 'Witness', kind: 'witness', aspects: { witness: 1 }, lifetime: 170, onExpire: 'vanish',
      desc: 'Someone who saw something. They will not stay around forever.' },
    suspect: { label: 'Suspect', kind: 'suspect', aspects: { suspect: 1 },
      desc: 'A person of interest.' },
    district: { label: 'District', kind: 'district', aspects: { district: 1 },
      desc: 'A part of the city.' },

    // --- Equipment (slot into Investigate / Analyze) --------------------
    camera: { label: 'Camera', kind: 'equipment', aspects: { tool: 1, forensic: 1, opportunity: 1 },
      desc: 'Photographs don\'t forget. Adds Forensic and Opportunity to what you find.' },
    prints: { label: 'Fingerprint Set', kind: 'equipment', aspects: { tool: 1, forensic: 2, kit_prints: 1 },
      desc: 'Powder, brush, lifting tape. Needed to read latent prints properly.' },
    kit: { label: 'Forensic Kit', kind: 'equipment', aspects: { tool: 1, forensic: 2, kit_bio: 1 },
      desc: 'Swabs, vials and a UV lamp. Needed for blood and fibres.' },
    surveillance: { label: 'Surveillance Gear', kind: 'equipment', aspects: { tool: 1, opportunity: 2, digital: 1 },
      desc: 'Long lenses and wire taps. Makes a Stakeout far more productive.' },
    labpass: { label: 'Lab Access', kind: 'equipment', aspects: { tool: 1, digital: 2, kit_lab: 1 },
      desc: 'A badge for the city lab. Needed for phones, ledgers and anything under a microscope.' },

    // --- Requisitions --------------------------------------------------
    order: { label: 'Requisition Form', kind: 'order', aspects: { order: 1 },
      desc: 'Put this into Requisition with enough Funds.' },
    room: { label: 'Precinct Room', kind: 'room', aspects: { room: 1 }, desc: 'Part of your precinct.' },
    personnel: { label: 'Personnel File', kind: 'personnel', aspects: { personnel: 1 },
      desc: 'Someone who could join your team. Put this into Requisition with Funds to hire them.' },
    teammate: { label: 'Officer', kind: 'teammate', aspects: { teammate: 1 },
      desc: 'A member of your team. Slot them in to help work a case. Train them in Duty.' },
    injured: { label: 'Injured Officer', kind: 'hospital', aspects: { injured: 1 }, lifetime: 150, onExpire: 'recover',
      desc: 'In hospital. They will be back, if nothing else happens to them.' },
    informant: { label: 'Informant', kind: 'informant', aspects: { informant: 1 },
      desc: 'A street contact. Meet them in Patrol with Funds for a tip. The more you lean on them, the more exposed they are.' },

    // --- The criminal ecosystem ----------------------------------------
    atlarge: { label: 'At Large', kind: 'criminal', aspects: { atlarge: 1, criminal: 1 },
      desc: 'Someone who got away. Every week they are out there, Retaliation grows. Three of them will find each other.' },
    gang: { label: 'Gang', kind: 'criminal', aspects: { gang: 1, criminal: 1 },
      desc: 'Criminals who got away and found each other. They feed Retaliation every week. Go Undercover to build a case against them.' },
    syndicate: { label: 'The Syndicate', kind: 'criminal', aspects: { syndicate: 1, criminal: 1 },
      desc: 'The gangs have a board of directors now. Retaliation surges every week. Only a deep Undercover operation can reach them.' },

    // --- Court and paperwork -------------------------------------------
    trial: { label: 'Trial', kind: 'court', aspects: { trial: 1 }, lifetime: 45, onExpire: 'verdict',
      desc: 'The case is before a judge. The verdict comes when this runs out.' },
    paperwork: { label: 'Paperwork', kind: 'paper', aspects: { paperwork: 1 }, stackable: true,
      desc: 'Reports, forms, statements. Filing it properly in Duty (with Focus) soothes Internal Affairs.' },
    bribe: { label: 'An Envelope', kind: 'temptation', aspects: { bribe: 1 }, lifetime: 50, onExpire: 'vanish',
      desc: 'Thick, unmarked, left on your desk. Put it in Duty to pocket it. Or let it sit until someone takes it back.' },

    // --- Career ----------------------------------------------------------
    promo_inspector: { label: 'Promotion Board: Inspector', kind: 'career', aspects: { promotion: 1 },
      desc: 'The brass have noticed you. Attend the board in Duty.' },
    promo_chief: { label: 'Promotion Board: Chief', kind: 'career', aspects: { promotion: 1 },
      desc: 'They want you running the precinct. Attend the board in Duty.' },
    chair: { label: 'The Commissioner\'s Chair', kind: 'career', aspects: { chair: 1 },
      desc: 'The council meets to choose a new Commissioner. Bring this to Duty. They will look hard at Public Pressure and Scrutiny.' },

    // --- Insight (victory paths) ---------------------------------------
    looseend: { label: 'Loose End', kind: 'insight', aspects: { looseend: 1 }, stackable: true,
      desc: 'A detail that belongs to no case. The same shape keeps appearing. Three of these, together in Reflect, might show you who is drawing it.' },
    ledger: { label: 'Ledger Page', kind: 'insight', aspects: { ledger: 1 }, stackable: true,
      desc: 'A page from the syndicate\'s books: payments, names, dates. Enough of these and the Syndicate cannot hide.' },
    notes: { label: 'Predecessor\'s Notes', kind: 'insight', aspects: { notes: 1 },
      desc: 'Your predecessor\'s notebook. Half of it is illegible. Read it in Reflect.' },

    calling_commissioner: { label: 'Calling: The Commissioner', kind: 'calling', aspects: { calling: 1 },
      desc: 'Power. Climb to Chief, earn a great Reputation, then take the Commissioner\'s Chair and remake the force.' },
    calling_master: { label: 'Calling: The Master Detective', kind: 'calling', aspects: { calling: 1 },
      desc: 'Knowledge. Solid convictions and cold cases leave Loose Ends. Bring three to Reflect, find the Architect behind them, and convict them.' },
    calling_crusader: { label: 'Calling: The Crusader', kind: 'calling', aspects: { calling: 1 },
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

  // Personnel you can hire. aspects are what they bring to a case.
  CF.PERSONNEL = {
    rookie: { label: 'Rookie Officer', cost: 1, role: 'Officer', aspects: { testimony: 1, opportunity: 1 },
      desc: 'Eager, green, and cheap. Knocks on doors without complaining.' },
    tech: { label: 'Forensic Technician', cost: 3, role: 'Technician', aspects: { forensic: 2 },
      desc: 'Talks to microscopes more than people. The microscopes talk back.' },
    interviewer: { label: 'Interviewer', cost: 3, role: 'Sergeant', aspects: { testimony: 2, motive: 1 },
      desc: 'Makes tea. Listens. People tell her things they have never told anyone.' },
    analyst: { label: 'Analyst', cost: 4, role: 'Analyst', aspects: { digital: 2, financial: 2 },
      desc: 'Reads bank statements like novels and phone records like poetry.' },
    veteran: { label: 'Veteran Detective', cost: 5, role: 'Detective', aspects: { opportunity: 2, motive: 2, testimony: 1 },
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
