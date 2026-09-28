// Static card definitions: the data half of the card system (see
// docs/DESIGN.md, "Cards are data"; the setting is docs/CITY.md). A
// definition has
//   label, kind, aspects, tags, decay (seconds; omitted = permanent),
//   image (an --art-* key; omitted = the UI picks one), onExpire, stackable.
// A card instance may override label/desc/aspects/tags/image (clues, suspects
// and cases are generated), but its def supplies kind, colour and behaviour.
// Keys never change: a save from the modern city loads into the Free City.
(function (G) {
  var CF = G.CF;

  // The six kinds of proof that build a charge before the Blood Court.
  CF.ASPECTS = {
    forensic: { label: 'Body', short: 'BOD', color: '#3fb6a8', meaning: 'What the corpse, the wound, the ground and the thing itself will say: marks, blood, poison, a chipped blade.' },
    testimony: { label: 'Word', short: 'WRD', color: '#e0a84a', meaning: 'What someone will swear to. Two credible witnesses are full proof; one is half.' },
    motive: { label: 'Motive', short: 'MOT', color: '#d8605a', meaning: 'Why anyone would want it done.' },
    opportunity: { label: 'Presence', short: 'PRE', color: '#a07ae0', meaning: 'Who could have been there, then, with the means.' },
    digital: { label: 'Writ', short: 'WRT', color: '#4f95e6', meaning: 'Paper that dates itself: a ledger, a letter, a seal, the parish register, a forged hand.' },
    financial: { label: 'Coin', short: 'CN', color: '#62bd5c', meaning: 'Money moving: debts, dowries, pledges, a man spending beyond his station.' },
  };
  CF.CLUE_ASPECTS = Object.keys(CF.ASPECTS);

  // Kinds control colour and which slots a card fits (kind is also an aspect).
  CF.KINDS = {
    ability: { label: 'Yourself', color: '#c9b37e' },
    funds: { label: 'Coin', color: '#b9a24a' },
    threat: { label: 'Affliction', color: '#9c3b3b' },
    case: { label: 'Case', color: '#c0392b' },
    coldcase: { label: 'Unanswered', color: '#5a6f86' },
    clue: { label: 'Token', color: '#d8cfb8' },
    evidence: { label: 'Raw Proof', color: '#8a6a45' },
    witness: { label: 'Witness', color: '#6f9bbd' },
    suspect: { label: 'Accused', color: '#b86b3c' },
    district: { label: 'Quarter', color: '#4f7a5a' },
    equipment: { label: 'Instrument', color: '#7f8c8d' },
    order: { label: 'Petition', color: '#95876a' },
    room: { label: 'Watch-house', color: '#56606e' },
    personnel: { label: 'Letter of Service', color: '#8a8f6a' },
    teammate: { label: 'Watch', color: '#3d7ea6' },
    hospital: { label: 'Hospital', color: '#6b6f78' },
    informant: { label: 'Informer', color: '#7a5c8a' },
    intel: { label: 'Whisper', color: '#8a6f9c' },
    place: { label: 'Place', color: '#4f7a5a' },
    criminal: { label: 'Coquille', color: '#5b1f1f' },
    court: { label: 'Court', color: '#8e7cc3' },
    condemned: { label: 'Condemned', color: '#7a2a2a' },
    sentence: { label: 'Sentence', color: '#8e7cc3' },
    plea: { label: 'Plea', color: '#b8a878' },
    paper: { label: 'The Rolls', color: '#a8a290' },
    temptation: { label: 'Temptation', color: '#c7a13b' },
    career: { label: 'Office', color: '#d4af37' },
    insight: { label: 'Insight', color: '#b48ede' },
    calling: { label: 'Calling', color: '#e6d3a3' },
  };

  CF.CARDS = {
    // --- You -----------------------------------------------------------
    health: { label: 'Health', kind: 'ability', tags: ['you', 'body'], image: 'icon-health', aspects: { health: 1 },
      desc: 'Your body. It walks the ward at night, holds a man against a wall, and stands in the rain outside a door until the door opens.' },
    focus: { label: 'Wit', kind: 'ability', tags: ['you', 'mind'], image: 'icon-focus', aspects: { focus: 1 },
      desc: 'Patience and method. The ledger read twice, the witness let talk, the long evening with the candle and the casebook.' },
    instinct: { label: 'Instinct', kind: 'ability', tags: ['you', 'street'], image: 'icon-instinct', aspects: { instinct: 1 },
      desc: 'The itch between the shoulder blades. It knows which tavern, which door, which face is lying before the face has finished.' },
    wound: { label: 'Wound', kind: 'threat', tags: ['you', 'injury'], image: 'icon-health', aspects: { wound: 1 }, decay: 150, onExpire: 'heal',
      desc: 'Stitched by the barber-surgeon and bound in linen. When it knits you have your Health back. Take another before then and you may not get up.' },
    funds: { label: 'Coin', kind: 'funds', tags: ['money'], image: 'icon-funds', aspects: { funds: 1 }, stackable: true,
      desc: 'Silver. Lodging and dues come out of it at every bell. So does everything else, and everyone.' },

    // --- Afflictions ------------------------------------------------------
    fatigue: { label: 'Weariness', kind: 'threat', tags: ['strain'], image: 'icon-fatigue', aspects: { fatigue: 1 }, stackable: true,
      desc: 'Too many nights. Three of these and the fever takes you. Sleep it off in Rest; Coin buys a proper bed, or let a watchman take the round for you.' },
    hunger: { label: 'Hunger', kind: 'threat', tags: ['need'], image: 'icon-fatigue', aspects: { hunger: 1 }, decay: 110, onExpire: 'need',
      desc: 'You cannot remember your last hot meal. In Rest: with Coin, a dinner; with a watchman, the Watch-house pot (slow, free); with a Quarter, a meal on credit (quick, and a debt); with an Informer, a bowl at their table (they remember it). Let the clock run out and it takes your Health: for good, if you had it to spare.' },
    sickness: { label: 'Sickness', kind: 'threat', tags: ['need'], image: 'icon-burnout', aspects: { sickness: 1 }, decay: 130, onExpire: 'need',
      desc: 'A cough from the river, a heat behind the eyes. In Rest: with Coin, a physician; with the Physician\'s Case, treat yourself; with Health, sweat it out (slow, and it tires you); with a watchman, their grandmother\'s remedy. Let the clock run out and it takes your Instinct: for good, if you had it to spare.' },
    stress: { label: 'Stress', kind: 'threat', tags: ['need'], image: 'icon-obsession', aspects: { stress: 1 }, decay: 110, onExpire: 'need',
      desc: 'The same case behind your eyes every night. In Rest: alone, an evening off; with Coin, a quick one; with Instinct, walk it off (quick, free); with a watchman, a drink with the Watch. Let the clock run out and it takes your Wit: for good, if you had it to spare.' },
    rival: { label: 'The Rival', kind: 'criminal', tags: ['person', 'rival'], aspects: { rival: 1 },
      desc: 'The Provost\'s Examiner, appointed to show the Council it has a choice. They work your cases from the other side: they close them first, spoil your scenes, pay your witnesses to forget. Question them with Wit to find their weakness (twice, and you can expose them), with Coin to buy a quiet fortnight, with Health to frighten them; shadow them in Explore with Instinct.' },
    burnout: { label: 'Fever', kind: 'threat', tags: ['strain', 'collapse'], image: 'icon-burnout', aspects: { burnout: 1 }, decay: 120, onExpire: 'burnout',
      desc: 'You cannot face the street. Attend, Walk the Ward, Examine and Question are shut to you. Rest in Rest before this runs out, or they carry you to the pesthouse.' },
    obsession: { label: 'Obsession', kind: 'threat', tags: ['strain'], image: 'icon-obsession', aspects: { obsession: 1 }, stackable: true,
      desc: 'A case has got under your skin. Three of these harden into Fixation. Closing the case eases it; so does letting go in Rest.' },
    tunnel: { label: 'Fixation', kind: 'threat', tags: ['strain', 'collapse'], image: 'icon-redeye', aspects: { tunnel: 1 },
      desc: 'You see what you want to see. Some tokens you find now are misread and will not hold before the Court. A conviction, or a long night in Rest, clears it. More Obsession on top of this will swallow you.' },

    // --- Casework ------------------------------------------------------
    case: { label: 'Case', kind: 'case', tags: ['casework'], aspects: { case: 1 }, onExpire: 'cold',
      desc: 'A crime the Council wants answered.' },
    coldcase: { label: 'Unanswered', kind: 'coldcase', tags: ['casework', 'cold'], aspects: { coldcase: 1 },
      desc: 'A case that went unanswered. Somebody walked. With the Rolls, it can be opened again in Study.' },
    clue: { label: 'Token', kind: 'clue', tags: ['casework', 'proof'], aspects: { clue: 1 }, decay: 300, onExpire: 'vanish',
      desc: 'A token: a thing found, a thing said, a thing that points.' },
    evidence: { label: 'Raw Proof', kind: 'evidence', tags: ['casework', 'raw'], aspects: { evidence: 1 }, decay: 260, onExpire: 'vanish',
      desc: 'Something carried away from a scene that has not yet said what it means. Take it to Study.' },
    witness: { label: 'Witness', kind: 'witness', tags: ['casework', 'person'], aspects: { witness: 1 }, decay: 170, onExpire: 'vanish',
      desc: 'Someone who saw something. Witnesses leave town, forget, or are reminded to forget.' },
    suspect: { label: 'Accused', kind: 'suspect', tags: ['casework', 'person'], aspects: { suspect: 1 },
      desc: 'A name the case has thrown up.' },
    district: { label: 'Quarter', kind: 'district', tags: ['place'], aspects: { district: 1 },
      desc: 'A quarter of the city.' },

    // --- Instruments (slot into Examine / Study) --------------------
    // Instruments change what recipes do (see docs/DESIGN.md, "Equipment"):
    //   boost:   { tags, aspects }  adds aspects to tokens found from items with one of the tags
    //   gate:    'prints'|'bio'|'lab'  raw proof that "needs" this is read properly with it
    //   unlocks: a recipe id it makes possible; unlocksVerb: a verb it opens
    camera: { label: 'Sketch-book', kind: 'equipment', tags: ['tool'], image: 'icon-camera', aspects: { tool: 1 },
      mods: { unlocks: 'inv_photograph', boost: { tags: ['watching'], aspects: { opportunity: 1 } } },
      desc: 'Charcoal and good paper. Put it in Examine with a case to draw the scene before it is tidied: what you have found there stops fading, and the drawings are proof. On a Watch, it catches faces.' },
    prints: { label: 'Vinegar and Umbrella', kind: 'equipment', tags: ['tool', 'kit', 'surfaces'], image: 'aspect-forensic', aspects: { tool: 1, kit_prints: 1 },
      mods: { gate: 'prints', boost: { tags: ['surfaces'], aspects: { forensic: 1 } } },
      desc: 'The coroner\'s trick from the old book: wash a surface with vinegar and wine, and read it under a red umbrella in sunlight. Old wounds, old blood and the marks of a hand come up plain.' },
    kit: { label: 'Physician\'s Case', kind: 'equipment', tags: ['tool', 'kit', 'biology'], image: 'icon-search', aspects: { tool: 1, kit_bio: 1 },
      mods: { gate: 'bio', boost: { tags: ['biology', 'physical'], aspects: { forensic: 1 } }, extraEvidence: true },
      desc: 'Lancets, a silver needle, dried herbs in paper twists. Needed for blood and poison, sharpens anything of the body, and finds more of it at a scene.' },
    surveillance: { label: 'Lantern and Cloak', kind: 'equipment', tags: ['tool', 'watching'], image: 'icon-binoculars', aspects: { tool: 1 },
      mods: { unlocksVerb: 'stakeout', boost: { tags: ['watching'], aspects: { opportunity: 1, digital: 1 } } },
      desc: 'A dark lantern with a shutter, a cloak that is nobody\'s. Opens the Watch whatever your office, and turns a night in a doorway into names and hours written down.' },
    labpass: { label: 'The Apothecary\'s Key', kind: 'equipment', tags: ['tool', 'access'], image: 'icon-mind', aspects: { tool: 1, kit_lab: 1 },
      mods: { gate: 'lab', unlocks: 'an_enhance', boost: { tags: ['records'], aspects: { digital: 1 } } },
      desc: 'A key to the apothecary\'s back room and his patience. Needed for ledgers, letters and anything under the glass, and lets you take a token back to the bench once for more.' },

    // --- Petitions --------------------------------------------------
    order: { label: 'Petition', kind: 'order', tags: ['precinct', 'form'], image: 'icon-folder', aspects: { order: 1 },
      desc: 'A petition to the Council\'s treasury. Put it into Petition with enough Coin.' },
    room: { label: 'Watch-house Room', kind: 'room', tags: ['precinct'], image: 'icon-court', aspects: { room: 1 }, desc: 'Part of the Watch-house.' },
    personnel: { label: 'Letter of Service', kind: 'personnel', tags: ['precinct', 'person'], aspects: { personnel: 1 },
      desc: 'Someone who would serve under you. Put this into Petition with Coin to take them on.' },
    teammate: { label: 'Watchman', kind: 'teammate', tags: ['team', 'person'], aspects: { teammate: 1 },
      desc: 'One of your Watch. Slot them in beside you to work a case. Drill them in Attend.' },
    injured: { label: 'Hurt Watchman', kind: 'hospital', tags: ['team', 'person', 'injury'], aspects: { injured: 1 }, decay: 150, onExpire: 'recover',
      desc: 'In the hospital of the Abbey. They will be back, if nothing else finds them there.' },
    informant: { label: 'Informer', kind: 'informant', tags: ['street', 'person'], aspects: { informant: 1 },
      desc: 'Someone who hears things before the Council does. Left on the table they bring rumours, sightings and warnings on their own time; pay them on the Ward for a proper word and their trust. Every meeting warms them: at three they are marked and go quiet. Guard them in Attend with a watchman.' },
    intel: { label: 'Whisper', kind: 'intel', tags: ['street'], image: 'icon-binoculars', aspects: { intel: 1 }, decay: 100, onExpire: 'ignored',
      desc: 'Something an informer heard. It will not stay true for long.' },

    front: { label: 'Front', kind: 'place', tags: ['place', 'crime'], image: 'icon-court', aspects: { front: 1 },
      desc: 'A place the Coquille works through.' },
    thread: { label: 'Thread', kind: 'insight', tags: ['insight'], image: 'icon-hook', aspects: { thread: 1 },
      desc: 'Two cases that touch the same door. They are one case, and now you know it.' },

    // --- The underworld ----------------------------------------------
    atlarge: { label: 'Abroad', kind: 'criminal', tags: ['crime', 'person'], aspects: { atlarge: 1, criminal: 1 },
      desc: 'Someone who walked. Every week they are out there, the Vendetta grows. Three of them will find each other.' },
    gang: { label: 'Band', kind: 'criminal', tags: ['crime', 'network'], image: 'icon-roots', aspects: { gang: 1, criminal: 1 },
      desc: 'People who walked from your cases and found each other in the same cellar. They feed the Vendetta every week. Go in Disguise to build a case against them.' },
    syndicate: { label: 'The Coquille', kind: 'criminal', tags: ['crime', 'network'], image: 'icon-pyramid', aspects: { syndicate: 1, criminal: 1 },
      desc: 'The bands have sworn to one shell now, and the shell has a king. The Vendetta surges every week. Only a long Disguise reaches the Court of Miracles.' },

    // --- Court and paper -------------------------------------------
    trial: { label: 'The Blood Court', kind: 'court', tags: ['court'], image: 'icon-gavel', aspects: { trial: 1 }, decay: 45, onExpire: 'verdict',
      desc: 'The case is before the judge and the sworn men. The verdict comes when the sand runs out.' },
    condemned: { label: 'The Condemned', kind: 'condemned', tags: ['court', 'person'], aspects: { condemned: 1 }, decay: 120, onExpire: 'sentence_default',
      desc: 'Convicted, and waiting in the Hole for your word. Put them in Sentence with a rung of the ladder. Say nothing and the Council sentences by custom.' },
    rung: { label: 'A Rung', kind: 'sentence', tags: ['court', 'ladder'], aspects: { rung: 1 },
      desc: 'One rung of the Carolina\'s ladder. It leaves the table with the Condemned it belongs to.' },
    plea: { label: 'A Plea', kind: 'plea', tags: ['court', 'letter'], aspects: { plea: 1 }, decay: 100, onExpire: 'vanish',
      desc: 'Somebody asks mercy for the Condemned. In Sentence, with a lighter rung, it counts as a reason. Some letters are heavier than paper.' },
    paperwork: { label: 'The Rolls', kind: 'paper', tags: ['precinct', 'form'], image: 'icon-folder', aspects: { paperwork: 1 }, stackable: true,
      desc: 'Depositions, examinations, the day-book. Entered fair in Attend (with Wit) they soothe the Council\'s eye.' },
    writsale: { label: 'A Patrician\'s Letter', kind: 'temptation', tags: ['money', 'corrupt', 'letter'], aspects: { writsale: 1 }, decay: 70, onExpire: 'vanish',
      desc: 'A patrician wants a rival searched and will pay for the writ. Put it in Attend to oblige, or let it lie.' },
    tribute: { label: 'The King\'s Tribute', kind: 'temptation', tags: ['money', 'corrupt'], aspects: { tribute: 1 }, decay: 60, onExpire: 'vanish',
      desc: 'The Court of Miracles pays its Examiner while the Treaty stands. Put it in Attend to take it; every week taken is Purse +1. Let it lie and the King notes that too.' },
    dagger: { label: 'A Dagger on the Pillow', kind: 'threat', tags: ['warning'], aspects: { dagger: 1 }, decay: 100, onExpire: 'mountain',
      desc: 'The Order of the Mountain warns once. Rest it with Coin to buy a season; alone, to endure. Let it lie and they come back.' },
    bribe: { label: 'A Purse', kind: 'temptation', tags: ['money', 'corrupt'], image: 'icon-handshake', aspects: { bribe: 1 }, decay: 50, onExpire: 'vanish',
      desc: 'Heavy, unmarked, left on your desk. Put it in Attend to pocket it. Or let it sit until someone comes back for it.' },

    // --- Office ----------------------------------------------------------
    promotion: { label: 'The Council\'s Letter', kind: 'career', tags: ['career'], image: 'icon-star', aspects: { promotion: 1 },
      desc: 'The Council has noticed you. Attend on them.' },
    // Kept for older saves; the generic `promotion` card replaced them.
    promo_inspector: { label: 'The Council\'s Letter', kind: 'career', tags: ['career'], image: 'icon-star', aspects: { promotion: 1 },
      desc: 'The Council has noticed you. Attend on them.' },
    promo_chief: { label: 'The Council\'s Letter', kind: 'career', tags: ['career'], image: 'icon-star', aspects: { promotion: 1 },
      desc: 'They want you to hold the Watch-house. Attend on them.' },
    chair: { label: 'The Burgomaster\'s Seat', kind: 'career', tags: ['career'], image: 'icon-court', aspects: { chair: 1 },
      desc: 'The Council meets to choose a Burgomaster. Bring this to Attend. They will look hard at the Crowd and at Suspicion.' },

    // --- Insight (victory paths) ---------------------------------------
    looseend: { label: 'Loose End', kind: 'insight', tags: ['insight'], image: 'icon-hook', aspects: { looseend: 1 }, stackable: true,
      desc: 'A detail that belongs to no case. The same shape keeps turning up. Three of these, together in Rest, might show you the hand that draws it.' },
    ledger: { label: 'A Leaf of the Ledger', kind: 'insight', tags: ['insight', 'money'], image: 'icon-scales', aspects: { ledger: 1 }, stackable: true,
      desc: 'A page from the Coquille\'s book: payments, names, dates. Enough of these and the King of Thunes cannot hide.' },
    notes: { label: 'The Last Examiner\'s Casebook', kind: 'insight', tags: ['insight'], image: 'icon-folder', aspects: { notes: 1 },
      desc: 'Your predecessor\'s casebook. Half of it is water-stained. Read it in Rest.' },

    calling_commissioner: { label: 'Calling: The Burgomaster', kind: 'calling', tags: ['calling'], image: 'icon-star', aspects: { calling: 1 },
      desc: 'Power. Rise to Magistrate, earn a great Standing, then take the Burgomaster\'s Seat and remake the Watch in your own image.' },
    calling_master: { label: 'Calling: The Scholar', kind: 'calling', tags: ['calling'], image: 'icon-mind', aspects: { calling: 1 },
      desc: 'Knowledge. Sound convictions and unanswered cases leave Loose Ends. Bring three to Rest, find the Architect behind them, and convict them.' },
    calling_crusader: { label: 'Calling: The Reformer', kind: 'calling', tags: ['calling'], image: 'icon-scales', aspects: { calling: 1 },
      desc: 'Justice. Go in Disguise among the bands (you will need to be Bailiff), take leaves from their ledger, drag the Coquille into the square and convict its king. Whatever it costs.' },
  };

  // Things the Council's treasury will buy. rank = minimum office to see the petition.
  CF.ORDERS = {
    camera: { label: 'Sketch-book', cost: 8, give: 'camera', rank: 0 },
    prints: { label: 'Vinegar and Umbrella', cost: 3, give: 'prints', rank: 0 },
    kit: { label: 'Physician\'s Case', cost: 9, give: 'kit', rank: 0 },
    locker: { label: 'Strongroom', cost: 9, room: 'locker', rank: 0 },
    suite: { label: 'The Hole', cost: 8, room: 'suite', rank: 1 },
    labpass: { label: 'The Apothecary\'s Key', cost: 5, give: 'labpass', rank: 1 },
    archive: { label: 'The Rolls', cost: 8, room: 'archive', rank: 1 },
    surveillance: { label: 'Lantern and Cloak', cost: 6, give: 'surveillance', rank: 2 },
    intel: { label: 'The Informers\' Bench', cost: 6, room: 'intel', rank: 2 },
    training: { label: 'The Drill Yard', cost: 8, room: 'training', rank: 2 },
    thieftakers: { label: 'The Thief-takers\' Office', cost: 6, room: 'thieftakers', rank: 1 },
    lab: { label: 'The Apothecary', cost: 14, room: 'lab', rank: 3 },
    survroom: { label: 'The Belfry', cost: 8, room: 'survroom', rank: 3 },
  };

  // The Watch-house: a second board. Each room changes a system (see
  // docs/DESIGN.md, "The precinct"); `order` is the petition that builds it.
  CF.ROOMS = {
    locker: { label: 'Strongroom', order: 'locker', desc: 'Tokens and raw proof keep twice as long behind an iron door.' },
    suite: { label: 'The Hole', order: 'suite', desc: 'A cell under the Watch-house with a table and one candle. Questioning is faster and draws out more Word.' },
    archive: { label: 'The Rolls', order: 'archive', desc: 'The court\'s old books, shelved and indexed. Unanswered cases can be opened again in Study.' },
    intel: { label: 'The Informers\' Bench', order: 'intel', desc: 'A bench by the back door where the city\'s whisperers wait. A token that points at a front names it at once; the Coquille shows itself.' },
    training: { label: 'The Drill Yard', order: 'training', desc: 'Drilling a watchman costs 1 Coin instead of 2, and at the third drill they learn a new trait.' },
    lab: { label: 'The Apothecary', order: 'lab', desc: 'The apothecary keeps a bench for you. Study is faster, and no raw proof needs a special instrument.' },
    survroom: { label: 'The Belfry', order: 'survroom', desc: 'The sexton lets you up. A Watch takes half the night and never tires you.' },
    thieftakers: { label: 'The Thief-takers\' Office', order: 'thieftakers', desc: 'A room let to men who know every fence in the city. Put a Case in Attend with 2 Coin and they get the goods back for a cut, without a trial. Some of what they bring back is a frame.' },
  };
  CF.ROOM_ORDER = ['locker', 'suite', 'archive', 'intel', 'training', 'thieftakers', 'lab', 'survroom'];

  // A watchman's traits change what a verb does when they are in it.
  CF.OFFICER_TRAITS = {
    thorough: { label: 'Thorough', desc: 'Finds one more thing at every scene.' },
    streetwise: { label: 'Known', desc: 'Doors open for them. A canvass turns up one more person.' },
    empathetic: { label: 'Gentle', desc: 'Witnesses trust them. A bluff never frightens anyone off.' },
    sharp: { label: 'Sharp', desc: 'Reads raw proof properly even without the right instrument.' },
    patient: { label: 'Patient', desc: 'Study and the Watch take a fifth less time.' },
    steady: { label: 'Steady', desc: 'Working beside them, you do not tire.' },
  };

  // People you can take into service. aspects are what they bring to a case;
  // traits are drawn from the pool when they are hired.
  CF.PERSONNEL = {
    rookie: { label: 'Beadle', cost: 1, role: 'Beadle', aspects: { testimony: 1, opportunity: 1 }, traits: ['thorough', 'streetwise', 'steady'],
      desc: 'A parish beadle with a staff and a loud voice. Knocks on doors without complaining and whips beggars without being asked.' },
    tech: { label: 'Apothecary\'s Boy', cost: 3, role: 'Apothecary\'s Boy', aspects: { forensic: 2 }, traits: ['sharp', 'patient', 'thorough'],
      desc: 'Talks to jars more than people. Knows the taste of every powder in the shop and which ones he should not have tasted.' },
    interviewer: { label: 'Confessor', cost: 3, role: 'Confessor', aspects: { testimony: 2, motive: 1 }, traits: ['empathetic', 'patient', 'streetwise'],
      desc: 'A priest without a parish. Sits. Listens. People tell him things they have never told God.' },
    analyst: { label: 'Clerk', cost: 4, role: 'Clerk', aspects: { digital: 2, financial: 2 }, traits: ['sharp', 'patient'],
      desc: 'Reads a ledger like a romance and a forged hand like a confession. Ink under every nail.' },
    veteran: { label: 'Sergeant of the Watch', cost: 5, role: 'Sergeant', aspects: { opportunity: 2, motive: 2, testimony: 1 }, traits: ['thorough', 'streetwise', 'steady', 'empathetic'], nTraits: 2,
      desc: 'Thirty years with a halberd. Has seen this before. Has seen everything before, and hanged some of it.' },
  };

  // Offices change the game: the verbs you have, the caseload the Council
  // hands you, your stipend, and which petitions the treasury will sign.
  CF.RANK_DEFS = [
    { id: 'detective', label: 'Examiner', rep: 0, salary: 1, maxCases: 2, badge: 1, dispatch: 0,
      text: 'A desk in the Watch-house, a caseload, and the street.' },
    { id: 'senior', label: 'Sworn Examiner', rep: 4, salary: 2, maxCases: 3, badge: 1, dispatch: 0,
      text: 'A magistrate will seal a Writ for you (an Accused with cause, in Explore), and the Council sends you more.' },
    { id: 'inspector', label: 'Bailiff', rep: 9, salary: 3, maxCases: 4, badge: 2, dispatch: 5,
      text: 'Watch a door and go in Disguise (Explore), and Deputise a watchman with a case (Attend).' },
    { id: 'chief', label: 'Magistrate', rep: 15, salary: 4, maxCases: 4, badge: 3, dispatch: 10,
      text: 'Muster the Watch and have cases cried (Attend), and a city that expects everything of you.' },
  ];
  CF.RANKS = CF.RANK_DEFS.map(function (r) { return r.label; });
  CF.RANK_REP = CF.RANK_DEFS.map(function (r) { return r.rep; }); // standing needed for the Council to write
  CF.TOP_RANK = CF.RANK_DEFS.length - 1;
  CF.COMMISSIONER_REP = 24;

  CF.CALLINGS = {
    commissioner: { card: 'calling_commissioner', label: 'The Burgomaster', theme: 'Power',
      blurb: 'Rise through the offices. Remake the city\'s Watch from the Council chamber.',
      bonus: 'Begin with an extra Coin and a Beadle already in service.' },
    master: { card: 'calling_master', label: 'The Scholar', theme: 'Knowledge',
      blurb: 'Trace every small crime back to the hidden hand that drew it.',
      bonus: 'Begin with a Sketch-book. Loose Ends appear on sound convictions.' },
    crusader: { card: 'calling_crusader', label: 'The Reformer', theme: 'Justice',
      blurb: 'Break the Coquille by any means, even if it costs your office.',
      bonus: 'Begin with an Informer. The Council\'s eye looks away a little longer.' },
  };
})(typeof window !== 'undefined' ? window : globalThis);
