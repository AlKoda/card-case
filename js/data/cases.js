// Case templates and the prose that fills them. Each case is generated from a
// template: a victim, a scene, three suspects (one guilty) with distinct
// traits, and a pool of things to find. Clues about the culprit's trait are
// hidden among the scene items, so a careful reader can deduce the culprit
// before the mind palace confirms it.
(function (G) {
  var CF = G.CF;

  CF.NAMES = {
    first: ['Ada', 'Bram', 'Cora', 'Dmitri', 'Edith', 'Felix', 'Greta', 'Hollis', 'Ines', 'Jonah', 'Kasia', 'Lionel',
      'Mara', 'Nico', 'Odette', 'Pavel', 'Queenie', 'Rufus', 'Sabine', 'Tobias', 'Ursula', 'Vance', 'Wren', 'Yusuf',
      'Zelda', 'Arlo', 'Bess', 'Casimir', 'Delphine', 'Emmett', 'Frida', 'Gideon', 'Hattie', 'Ivo', 'June', 'Lazlo'],
    last: ['Ashdown', 'Brisk', 'Calloway', 'Drummond', 'Ellery', 'Fenwick', 'Gault', 'Harrow', 'Ibsen', 'Jessop',
      'Kilbride', 'Lusk', 'Marlowe', 'Nightingale', 'Okafor', 'Pruitt', 'Quill', 'Rourke', 'Sallow', 'Thorne',
      'Umber', 'Vasquez', 'Whitlock', 'Yardley', 'Zorn', 'Blackwood', 'Crane', 'Delacroix', 'Moreau', 'Szabo'],
    gang: ['the Tide Rats', 'the Lamplighters', 'the Ninth Street Saints', 'the Brass Hands', 'the Quiet Men',
      'the Gallows Crew', 'the Velvet Knives', 'the Canal Kings'],
  };

  CF.DISTRICTS = {
    docks: { label: 'The Docks', desc: 'Cranes, fog and container yards. Everything here is for sale, including silence.' },
    market: { label: 'Old Market', desc: 'Stalls, pawnbrokers and pickpockets. Your precinct sits on its edge.' },
    neon: { label: 'Neon Row', desc: 'Clubs, card rooms and the people who own them.' },
    uptown: { label: 'Uptown', desc: 'Money lives here. It does not like to be asked questions.' },
    warrens: { label: 'The Warrens', desc: 'Tenements stacked on tenements. Everyone saw nothing, and everyone knows everything.' },
    canal: { label: 'Canal Street', desc: 'Warehouses and workshops along black water. Quiet at night. Too quiet.' },
  };

  // Every suspect has one trait. The culprit's trait leaks into clues.
  CF.TRAITS = [
    { id: 'menthol', desc: 'Smokes cheap menthols, one after another.',
      clue: { label: 'Menthol Cigarette Butt', text: 'Crushed under a heel, still faintly minty. Someone waited here a long while, smoking.', aspects: { forensic: 1, opportunity: 1 } } },
    { id: 'limp', desc: 'Walks with a pronounced limp in the left leg.',
      clue: { label: 'Dragging Footprints', text: 'Prints in the dust. The left foot drags on every step, leaving a long scuff.', aspects: { forensic: 1, opportunity: 1 } } },
    { id: 'lefty', desc: 'Left-handed. Writes with a hooked wrist.',
      clue: { label: 'A Left-Handed Stroke', text: 'Whoever did this stood on the right and worked with their left hand. The angle is unmistakable.', aspects: { forensic: 2 } } },
    { id: 'van', desc: 'Drives a battered green delivery van.',
      clue: { label: 'Green Paint Transfer', text: 'A scrape of green paint on the gatepost, van-height. Somebody reversed in a hurry.', aspects: { forensic: 1, opportunity: 1 } } },
    { id: 'bandage', desc: 'Has a fresh bandage wrapped around one hand.',
      clue: { label: 'Blood on the Latch', text: 'A smear of blood on the window latch. Someone cut themselves getting in, or getting out.', aspects: { forensic: 2 } } },
    { id: 'sandalwood', desc: 'Wears an expensive sandalwood cologne.',
      clue: { label: 'A Scent in the Room', text: 'Hours later the room still smells, faintly, of sandalwood cologne. Not the victim\'s.', aspects: { opportunity: 1, testimony: 1 } } },
    { id: 'debt', desc: 'Owes serious money to a loan shark on Neon Row.',
      clue: { label: 'Torn IOU', text: 'Half an IOU, the sum circled twice in red. A lender on Neon Row signs like that.', aspects: { financial: 1, motive: 1 } } },
    { id: 'boots', desc: 'Wears size-twelve steel-toed work boots.',
      clue: { label: 'Steel-Toe Dent', text: 'A deep dent at the foot of the door, the kind a steel toe cap makes. A big boot.', aspects: { forensic: 1, opportunity: 1 } } },
    { id: 'licorice', desc: 'Chews black licorice constantly.',
      clue: { label: 'Licorice Wrapper', text: 'A black licorice wrapper, folded into a tiny square and tucked behind the radiator.', aspects: { forensic: 1, opportunity: 1 } } },
    { id: 'key', desc: 'Has had a key to the building for years.',
      clue: { label: 'No Forced Entry', text: 'Not a scratch on the locks. Whoever came in had a key, or was let in by someone who trusted them.', aspects: { opportunity: 2 } } },
    { id: 'ring', desc: 'Never takes off a heavy gold signet ring.',
      clue: { label: 'Curved Scratch', text: 'A fresh curved scratch in the varnish, the kind a heavy ring leaves on a clenched fist.', aspects: { forensic: 1, opportunity: 1 } } },
    { id: 'ticket', desc: 'Recently bought a one-way train ticket.',
      clue: { label: 'Circled Timetable', text: 'A railway timetable with the 6:10 express circled. One way. Someone is planning to leave.', aspects: { opportunity: 1, motive: 1 } } },
    { id: 'ink', desc: 'Has ink-stained fingers; works a printing press.',
      clue: { label: 'Ink-Black Fingerprint', text: 'A thumbprint, perfectly preserved, in printer\'s ink.', aspects: { forensic: 2 } } },
    { id: 'gambler', desc: 'Plays cards every night at a club on Neon Row.',
      clue: { label: 'A Lost Casino Chip', text: 'A red chip from a Neon Row card room, rolled under the sideboard.', aspects: { financial: 1, opportunity: 1 } } },
  ];

  // What a witness might remember about the culprit's trait.
  CF.TRAIT_SEEN = {
    menthol: 'They smelled of mint. Cigarettes, I think.',
    limp: 'They walked funny. Dragged one leg.',
    lefty: 'They opened the gate with their left hand. I remember because it\'s the stiff side.',
    van: 'There was a green van. Old, dented.',
    bandage: 'Their hand was wrapped up in something white.',
    sandalwood: 'They smelled expensive. Some kind of wood.',
    debt: 'They looked hunted. Like someone who owes money to the wrong people.',
    boots: 'Big boots. Heavy. You could hear them coming.',
    licorice: 'They were chewing something black. Licorice?',
    key: 'They didn\'t knock. They let themselves in.',
    ring: 'A gold ring. Big, on the little finger. It caught the street lamp.',
    ticket: 'They kept checking a railway timetable.',
    ink: 'Their fingers were black, like a printer\'s.',
    gambler: 'They were flipping a casino chip over their knuckles.',
  };

  // Interrogation and street prose that works across cases.
  CF.PROSE = {
    witnessEmpathy: [
      '{witness} talks for an hour. Most of it is about their late husband. Then, almost as an afterthought: "{hint}"',
      'You sit. You listen. You let the silence do the work. Eventually {witness} says: "{hint}"',
      '{witness} keeps apologising for wasting your time. They are not wasting it. "{hint}"',
    ],
    witnessBluff: [
      'You tell {witness} someone else already named them. It is not true. Their face goes white. "{hint}"',
      'You pretend to know more than you do. {witness} fills in the gaps for you. "{hint}"',
    ],
    witnessBluffFail: [
      '{witness} sees through you in a heartbeat and folds their arms. "I think I want to go home now."',
      'The bluff lands wrong. {witness} clams up and will not look at you.',
    ],
    witnessPressure: [
      'You lean on {witness}. You lean hard. They tell you what you want to hear. Some of it might even be true. "{hint}"',
      'Voices are raised. A chair goes over. {witness} is crying by the end, and signing whatever you put in front of them.',
    ],
    suspectAlibi: [
      '{suspect} has an alibi, and it is a good one: {alibi}. They are cleared.',
      'You check {suspect}\'s story. It holds: {alibi}. Scratch one name off the board.',
    ],
    alibis: ['a night shift with twelve witnesses', 'a hospital bed across town', 'a card game with a police sergeant',
      'a train ticket stamped two hundred miles away', 'a wedding, in the photographs', 'a night in the cells for drunkenness'],
    suspectEmpathy: [
      'You let {suspect} talk about {victim}. Their voice changes when they do. {motive}',
      'A gentle question, then another. {suspect} is angry about something, and it comes out sideways. {motive}',
    ],
    suspectBluff: [
      'You tell {suspect} you have them on camera. You do not. They glance at the door, then start explaining where they were. It is the wrong explanation.',
      'You say the name of the scene casually, like it means nothing. {suspect} flinches. They knew exactly where it was.',
    ],
    suspectBluffFail: [
      '{suspect} smiles and asks for a lawyer. The interview is over.',
      '{suspect} just watches you, calm as still water. They are not going to give you anything today.',
    ],
    suspectPressure: [
      'It goes on for hours. It gets physical. At the end {suspect} signs a confession. Whether it is true is another question.',
      'You leave the tape off. When you turn it back on, {suspect} is ready to say anything.',
    ],
    suspectCracks: [
      'You lay {clue} on the table and say nothing. {suspect} stares at it for a long time. Then they start to talk.',
      'You slide {clue} across the table. {suspect}\'s composure goes, all at once, like a dam breaking.',
    ],
  };

  // Generic scene items used by every template (on top of template items).
  CF.GENERIC_SCENE = [
    { type: 'evidence', label: 'Latent Prints', text: 'Prints on the glass. Faint, but there.', needs: 'prints',
      result: { label: 'Print Match', text: 'The ridge detail is good enough to hold up in court.', aspects: { forensic: 3 } } },
    { type: 'clue', label: 'Disturbed Dust', text: 'Something heavy was moved recently. Recently enough to date it.', aspects: { opportunity: 1 } },
  ];

  CF.CASE_TEMPLATES = {
    burglary: {
      label: 'Burglary', title: 'Burglary at {scene}', lifetime: 250, difficulty: 5,
      keyAspects: ['forensic', 'opportunity', 'financial'], districts: ['market', 'uptown', 'canal'],
      charge: { forensic: 2, opportunity: 2, financial: 2 },
      scenes: ['{last}\'s Pawnbrokers', 'the {last} Residence', '{last} & Sons Jewellers'],
      brief: '{victim} came in this morning to find the back window open and the safe empty. It was not a professional job, but it was not a nervous one either.',
      roles: [
        { role: 'the night watchman', motive: 'The watchman was fired last month and never paid his final wages.' },
        { role: 'a nephew of the owner', motive: 'The nephew was cut out of the will a week ago, loudly.' },
        { role: 'a fence from the Old Market', motive: 'The fence had a buyer waiting for exactly what was taken.' },
        { role: 'the owner\'s business partner', motive: 'The partnership is drowning in debt and the insurance would clear it.' },
        { role: 'a former employee', motive: 'Let go without a reference, and still talking about it in every bar in town.' },
      ],
      items: [
        { type: 'evidence', label: 'Pried Window Frame', text: 'Tool marks on the frame, a flat blade.', needs: 'bio',
          result: { label: 'Tool Mark Analysis', text: 'The blade was a specific chisel, chipped at one corner. Find the chisel, find the burglar.', aspects: { forensic: 2, opportunity: 1 } } },
        { type: 'clue', label: 'Inventory Discrepancy', text: 'The list of what was stolen does not match the insurance schedule. Someone knew what was worth taking.', aspects: { financial: 2 } },
        { type: 'evidence', label: 'Pawn Ticket', text: 'A ticket from another shop, dated the morning after.', needs: null,
          result: { label: 'Pawned Goods', text: 'A ring from the safe turned up in a pawn shop across town within hours. The clerk kept a description.', aspects: { financial: 2, testimony: 1 } } },
        { type: 'clue', label: 'The Timing', text: 'The alarm was switched off at 2:14 and back on at 2:41. Twenty-seven minutes, and they knew the code.', aspects: { opportunity: 2 } },
      ],
      witnesses: ['a baker starting the ovens', 'a night-shift tram driver', 'the woman in the flat opposite'],
      hints: ['I saw someone at the back gate. They had a bad leg, or maybe a heavy bag.', 'There was a van. I didn\'t see the colour, it was dark.', 'The dog next door never barked. Never. It knew whoever it was.'],
      // The written case (docs/DESIGN.md, "The first playable case"). Three
      // threads leave the scene: the window (forensic), the neighbour
      // (testimony) and the money (financial). Any two make a charge.
      // Order matters: the first lead whose needs are met is the one that
      // runs, so the specific ones come before the catch-alls.
      leads: [
        { id: 'scene', verb: 'investigate', label: 'Search the Scene', duration: 30,
          preview: 'Duck under the tape. Start at the window and work inwards.',
          gives: [
            { type: 'evidence', key: 'window', label: 'Pried Window Frame', text: 'Tool marks on the frame, a flat blade.', needs: 'bio',
              result: { label: 'Tool Mark Analysis', text: 'The blade was a specific chisel, chipped at one corner. Find the chisel, find the burglar.', aspects: { forensic: 2, opportunity: 1 } } },
            { type: 'clue', label: 'Inventory Discrepancy', text: 'The list of what was stolen does not match the insurance schedule. Someone knew what was worth taking.', aspects: { financial: 2 } },
          ],
          reveal: 'any', district: true, fatigue: 0.25,
          story: { title: 'At the Scene', text: 'You duck under the tape at {scene}. The back window has been forced with something flat and patient, and the safe stands open like a mouth. You come away with {found}.' } },
        { id: 'prints', verb: 'investigate', label: 'Dust for Prints', duration: 25, needs: { tags: ['surfaces'], after: ['scene'] },
          preview: 'Powder on the window frame, the safe dial, the door handle. Somebody touched all three.',
          gives: [
            { type: 'evidence', key: 'print', label: 'Partial Fingerprint', text: 'Lifted from the safe dial. Half a thumb, maybe. Needs a name to match it against.', needs: 'prints',
              result: { label: 'Matched Print', text: 'The ridge detail on the safe dial matches {culprit}. Not the owner, not the staff. {culprit}.', aspects: { forensic: 3 } } },
          ],
          fatigue: 0.25,
          story: { title: 'Prints', text: 'The powder finds a partial on the safe dial where a thumb pressed hard, turning it. Whoever it belongs to was not wearing gloves when it mattered.' } },
        { id: 'canvass', verb: 'investigate', label: 'Canvass the Neighbourhood', duration: 30, needs: { aspects: ['district'], sameDistrict: true },
          preview: 'Door to door. Somebody was awake at two in the morning. Somebody always is.',
          gives: [
            { type: 'witness', who: 'the woman in the flat opposite, who does not sleep', knows: true },
            { type: 'evidence', key: 'ticket', label: 'Pawn Ticket', text: 'A ticket from a shop across town, dated the morning after, dropped in the gutter by the back gate.',
              result: { label: 'Pawned Goods', text: 'A ring from the safe turned up in a pawn shop across town within hours. The clerk remembers who brought it in: "{seen}"', aspects: { financial: 2, testimony: 1 } } },
          ],
          reveal: 'any',
          story: { title: 'Door to Door', text: 'Around {scene} people are frightened, and frightened people talk. The woman in the flat opposite was at her window at two in the morning. She usually is.' } },
        { id: 'timing', verb: 'investigate', label: 'Go Back Over It', duration: 30, needs: { after: ['scene'] },
          preview: 'Go back over {scene} inch by inch. The first pass never finds everything.',
          gives: [
            { type: 'clue', label: 'The Timing', text: 'The alarm was switched off at 2:14 and back on at 2:41. Twenty-seven minutes, and they knew the code.', aspects: { opportunity: 2 } },
          ],
          fatigue: 0.25,
          story: { title: 'Back at the Scene', text: 'The alarm company keeps a log. Off at 2:14, on at 2:41. Somebody knew the code, and somebody was in and out in twenty-seven minutes.' } },
        { id: 'toolmark', verb: 'analyze', label: 'Tool Mark Analysis', duration: 25, needs: { item: 'window', tool: 'bio' }, consume: true,
          preview: 'Cast the marks, measure the blade, look for the flaw.',
          gives: [{ type: 'clue', label: 'Tool Mark Analysis', text: 'The blade was a specific chisel, chipped at one corner. Find the chisel, find the burglar.', aspects: { forensic: 2, opportunity: 1 } }],
          story: { title: 'Results', text: 'The cast shows a chisel, and a chip at one corner that will match exactly one chisel in the city. It is the kind of detail juries like.' } },
        { id: 'print_match', verb: 'analyze', label: 'Match the Print', duration: 25, needs: { item: 'print', tool: 'prints', suspects: 1 }, consume: true,
          preview: 'Compare the partial against everyone on the board.',
          gives: [{ type: 'clue', label: 'Matched Print: {culprit}', text: 'The ridge detail on the safe dial matches {culprit}. Not the owner, not the staff. {culprit}.', aspects: { forensic: 3 }, points: 'culprit', noMisread: true }],
          story: { title: 'A Match', kind: 'major', text: 'Twelve points of comparison. The thumb on the safe dial belongs to {culprit}.' } },
        { id: 'print_nomatch', verb: 'analyze', label: 'Compare the Print', duration: 10, needs: { item: 'print', tool: 'prints' }, once: false,
          preview: 'A print is only half a clue. You need somebody to match it against.',
          story: { title: 'Nothing to Compare', text: 'A clean partial, and nobody on the board to hold it against. Find a suspect first, then bring it back.' } },
        { id: 'pawn', verb: 'analyze', label: 'Trace the Ticket', duration: 20, needs: { item: 'ticket' }, consume: true,
          preview: 'Ring the shop. Get the clerk talking.',
          gives: [{ type: 'clue', label: 'Pawned Goods', text: 'A ring from the safe turned up in a pawn shop across town within hours. The clerk remembers who brought it in: "{seen}"', aspects: { financial: 2, testimony: 1 }, trait: true }],
          story: { title: 'The Pawn Shop', text: 'The clerk kept the ring and the ticket and, when you lean on the counter, a description: "{seen}"' } },
      ],
    },
    missing: {
      label: 'Missing Person', title: 'The Disappearance of {victim}', lifetime: 280, difficulty: 6,
      keyAspects: ['testimony', 'motive', 'digital'], districts: ['warrens', 'neon', 'uptown'],
      charge: { testimony: 2, motive: 2, digital: 2 },
      scenes: ['{victim}\'s Flat', 'the Last Known Address', 'the Bus Shelter on {last} Street'],
      brief: '{victim} has not been seen for four days. Their bed has not been slept in. Their cat is very hungry. Nobody has asked for a ransom.',
      roles: [
        { role: 'the estranged spouse', motive: 'The divorce would have left the spouse with nothing. A disappearance leaves them with everything.' },
        { role: 'a jealous colleague', motive: 'The colleague was passed over for promotion in favour of the victim.' },
        { role: 'the landlord', motive: 'The victim had reported the landlord to the housing board twice.' },
        { role: 'a secret lover', motive: 'The victim was going to end it, and had said so in writing.' },
        { role: 'a club owner on Neon Row', motive: 'The victim had seen something in the back office they should not have.' },
      ],
      items: [
        { type: 'evidence', label: 'Telephone Bill', text: 'Itemised calls from the last month.', needs: 'lab',
          result: { label: 'Call Records', text: 'Nine calls to the same number in the last two days, then nothing. The number belongs to someone the victim knew well.', aspects: { digital: 3 } } },
        { type: 'clue', label: 'Unfinished Letter', text: '"I can\'t keep pretending, and I won\'t let you—" It stops there.', aspects: { motive: 2, testimony: 1 } },
        { type: 'clue', label: 'Packed Suitcase', text: 'A suitcase, packed and left under the bed. They meant to leave. They did not get to.', aspects: { motive: 1, opportunity: 1 } },
        { type: 'evidence', label: 'Diary', text: 'Written in a private shorthand.', needs: null,
          result: { label: 'Diary Entries', text: 'Decoded, the last entries mention being followed, and name the person they were afraid of in everything but name.', aspects: { testimony: 2, motive: 1 } } },
      ],
      witnesses: ['the neighbour with the cat', 'the barman at the corner pub', 'a newspaper seller'],
      hints: ['They argued with someone on the stairs. A man or a woman, I couldn\'t say. They sounded like they knew each other.', 'They were scared. They kept looking at the door.', 'They told me they were coming into money. Then they said they were leaving town.'],
    },
    harbor: {
      label: 'Homicide', title: 'The Body in the Harbour', lifetime: 240, difficulty: 7, highProfile: true,
      keyAspects: ['forensic', 'motive', 'opportunity'], districts: ['docks', 'canal'],
      charge: { forensic: 3, motive: 2, opportunity: 2 },
      scenes: ['Pier {n}', 'the {last} Dry Dock', 'the Harbour Steps'],
      brief: 'A dockworker\'s hook pulled {victim} out of the water at dawn. The coroner says they were dead before they went in. The newspapers have already given it a name.',
      roles: [
        { role: 'the harbour master', motive: 'The victim was about to report the harbour master for taking bribes on cargo.' },
        { role: 'a union boss', motive: 'The victim was organising against the union\'s leadership.' },
        { role: 'a smuggler', motive: 'The victim owed the smuggler for a shipment that never arrived.' },
        { role: 'the victim\'s business rival', motive: 'Their rivalry had turned into lawsuits, and then into threats.' },
        { role: 'a crane operator', motive: 'The crane operator\'s brother died on a job the victim signed off as safe.' },
      ],
      items: [
        { type: 'evidence', label: 'Fibres Under Fingernails', text: 'The victim fought.', needs: 'bio',
          result: { label: 'Fibre Match', text: 'Wool and oil, from a heavy work coat. The victim scratched their killer, hard.', aspects: { forensic: 3 } } },
        { type: 'clue', label: 'Wrong Tide', text: 'The body went in at the east pier. At that tide, it could only have been between midnight and one.', aspects: { opportunity: 2 } },
        { type: 'clue', label: 'Wallet Untouched', text: 'Wallet full, watch still on. This was not a robbery. This was personal.', aspects: { motive: 2 } },
        { type: 'evidence', label: 'Waterlogged Notebook', text: 'Pages stuck together, ink running.', needs: 'lab',
          result: { label: 'Recovered Notes', text: 'The lab separates the pages. The victim had been writing down names and cargo numbers.', aspects: { motive: 1, financial: 2 } } },
      ],
      witnesses: ['a night fisherman', 'a docker on the late shift', 'a sailor waiting for his ship'],
      hints: ['Two of them were arguing by the bollards, around midnight. Then just one.', 'I heard a splash. I thought it was a crate. Nobody drops crates at midnight.', 'Somebody walked off the pier in a hurry. Big coat. They didn\'t look back.'],
    },
    arson: {
      label: 'Arson', title: 'Fire at {scene}', lifetime: 230, difficulty: 6,
      keyAspects: ['forensic', 'financial', 'testimony'], districts: ['canal', 'warrens', 'market'],
      charge: { forensic: 2, financial: 2, testimony: 2 },
      scenes: ['the {last} Warehouse', 'the {last} Print Works', 'a Tenement on {last} Row'],
      brief: 'The fire brigade got there in time to save the walls and nothing else. The fire chief says it started in three places at once. Fires do not do that.',
      roles: [
        { role: 'the building\'s owner', motive: 'The building was insured for three times its value, and the owner was broke.' },
        { role: 'a disgruntled tenant', motive: 'The tenant had been evicted two days before the fire.' },
        { role: 'a rival business', motive: 'The fire took out the only competition on the street.' },
        { role: 'a local firebug', motive: 'The firebug has been questioned about three fires before. Never charged.' },
        { role: 'the night manager', motive: 'The night manager had been skimming from the books, and the books were in the office.' },
      ],
      items: [
        { type: 'evidence', label: 'Accelerant Residue', text: 'The floor smells of paraffin under the smoke.', needs: 'bio',
          result: { label: 'Accelerant Identified', text: 'Lamp paraffin, a specific blend sold by one chandler on Canal Street.', aspects: { forensic: 2, opportunity: 1 } } },
        { type: 'clue', label: 'Insurance Policy', text: 'Taken out six weeks ago. Premiums paid in cash.', aspects: { financial: 2, motive: 1 } },
        { type: 'clue', label: 'Moved Stock', text: 'The valuable stock was moved out of the building the week before. Someone knew.', aspects: { financial: 1, opportunity: 1 } },
        { type: 'evidence', label: 'Scorched Ledger', text: 'Half-burned, the pages brittle.', needs: 'lab',
          result: { label: 'Recovered Accounts', text: 'The surviving pages show money leaving the business for months.', aspects: { financial: 3 } } },
      ],
      witnesses: ['a fire brigade volunteer', 'a drunk sleeping in the doorway opposite', 'a child who couldn\'t sleep'],
      hints: ['Someone came out the side door just before the smoke. They weren\'t running. They were walking.', 'There was a smell, like a lamp, but strong. An hour before.', 'I saw the lights on upstairs at three in the morning. There\'s never anyone there at three.'],
    },
    fraud: {
      label: 'Fraud', title: 'The {last} Account', lifetime: 300, difficulty: 7,
      keyAspects: ['financial', 'digital', 'motive'], districts: ['uptown', 'neon'],
      charge: { financial: 3, digital: 2, motive: 2 },
      scenes: ['the {last} Savings Bank', '{last} Holdings', 'the {last} Trust'],
      brief: '{victim}, a retired schoolteacher, has lost her life savings to an investment that does not exist. She is not the only one. She is just the only one brave enough to come in.',
      roles: [
        { role: 'the smooth-talking broker', motive: 'The broker\'s lifestyle cost far more than a broker earns.' },
        { role: 'a bank clerk', motive: 'The clerk had access to every account and a gambling habit to feed.' },
        { role: 'the victim\'s financial adviser', motive: 'The adviser recommended the fund personally, and took a commission on each referral.' },
        { role: 'a society hostess', motive: 'The hostess introduced every victim to the fund at her parties.' },
      ],
      items: [
        { type: 'evidence', label: 'Bank Statements', text: 'Six months of transfers.', needs: 'lab',
          result: { label: 'Money Trail', text: 'The money went through four accounts and came to rest in one. The last signature is legible.', aspects: { financial: 3, digital: 1 } } },
        { type: 'clue', label: 'Glossy Prospectus', text: 'Beautifully printed. The company address is a post box.', aspects: { financial: 1, motive: 1 } },
        { type: 'evidence', label: 'Typewritten Letters', text: 'Reassurances to investors. The same typewriter, every time.', needs: null,
          result: { label: 'Typewriter Match', text: 'The lowercase e is broken on every letter. Find the typewriter.', aspects: { forensic: 1, digital: 2 } } },
        { type: 'clue', label: 'Lavish Spending', text: 'Someone connected to the fund bought a car and a boat this spring, in cash.', aspects: { motive: 2 } },
      ],
      witnesses: ['another investor', 'a secretary at the firm', 'a doorman Uptown'],
      hints: ['There were always parties. The same people, telling the same stories about the fund.', 'I typed the letters. I was told what to type. I didn\'t ask.', 'They came in every Friday with a briefcase. Left without it.'],
    },
    extortion: {
      label: 'Extortion', title: 'Protection on {scene}', lifetime: 260, difficulty: 6,
      keyAspects: ['testimony', 'financial', 'opportunity'], districts: ['market', 'neon', 'warrens'],
      charge: { testimony: 2, financial: 2, opportunity: 2 },
      scenes: ['{last} Street', 'the {last} Arcade', 'the Night Market'],
      brief: 'Shopkeepers have been paying for "protection" for months. Now {victim}\'s shop has had its windows broken for refusing. Nobody else will talk.',
      roles: [
        { role: 'a local enforcer', motive: 'The enforcer collects the money, and keeps a percentage.' },
        { role: 'the landlord of the parade', motive: 'Frightened tenants accept rent rises. The landlord knows it.' },
        { role: 'a corrupt beat officer', motive: 'The beat officer\'s patch is exactly the streets being squeezed.' },
        { role: 'a shopkeeper who pays', motive: 'The shopkeeper who pays gets a discount for pointing out who doesn\'t.' },
      ],
      items: [
        { type: 'clue', label: 'Collection Schedule', text: 'Pencilled on the back of a menu: days of the week, shop numbers, amounts.', aspects: { financial: 2, opportunity: 1 } },
        { type: 'evidence', label: 'Threatening Note', text: '"Pay or burn." Cut from newspaper letters.', needs: 'prints',
          result: { label: 'Prints on the Note', text: 'Whoever pasted this down was careful everywhere except the glue.', aspects: { forensic: 3 } } },
        { type: 'clue', label: 'Broken Glass', text: 'Broken from outside, at 11pm, when the street is still busy. They wanted to be seen.', aspects: { opportunity: 1, testimony: 1 } },
        { type: 'clue', label: 'The Victim\'s Account', text: '{victim} tells you everything, hands shaking, and asks you not to write their name down.', aspects: { testimony: 2 } },
      ],
      witnesses: ['a frightened shopkeeper', 'a delivery boy', 'the woman who runs the café'],
      hints: ['He comes on Thursdays. Always Thursdays. He talks like a policeman.', 'They count the money on the corner, bold as brass.', 'There are two of them. One talks, one watches.'],
    },

    // --- Special cases -------------------------------------------------
    manhunt: {
      label: 'Manhunt', title: 'Manhunt: {culprit}', lifetime: 200, difficulty: 5, special: true,
      keyAspects: ['opportunity', 'testimony', 'forensic'], districts: ['docks', 'warrens', 'canal', 'neon'],
      charge: { opportunity: 2, testimony: 2, forensic: 1 },
      scenes: ['a Safe House in {district}', 'a Rented Room in {district}'],
      brief: '{culprit} has been seen again. They got away once. The trail is warm, for now.',
      roles: [{ role: 'the fugitive', motive: 'They know you are coming. They have always known.' }],
      items: [
        { type: 'clue', label: 'Fresh Sighting', text: 'Seen buying cigarettes two streets over, this morning.', aspects: { opportunity: 2, testimony: 1 } },
        { type: 'evidence', label: 'Abandoned Room', text: 'Left in a hurry. A glass on the table.', needs: 'prints',
          result: { label: 'Prints on the Glass', text: 'A match to the prints on file from the original case.', aspects: { forensic: 3 } } },
        { type: 'clue', label: 'Old File', text: 'Your notes from the first time round. You were closer than you knew.', aspects: { motive: 2 } },
      ],
      witnesses: ['a landlady', 'a tobacconist'],
      hints: ['Paid a month up front, in cash. Nervous type.', 'Comes and goes at night. Never the same route twice.'],
    },
    gang: {
      label: 'Gang Case', title: 'Operation: {gang}', lifetime: 320, difficulty: 9, special: true, highProfile: true,
      keyAspects: ['financial', 'testimony', 'digital', 'opportunity'], districts: ['docks', 'neon', 'warrens'],
      charge: { financial: 3, testimony: 2, digital: 2, opportunity: 2 },
      scenes: ['{gang}\'s Clubhouse', 'a Warehouse used by {gang}'],
      brief: 'Undercover work has given you a way in to {gang}. Build a case against their leader. Solidly. They will buy any jury they can.',
      roles: [
        { role: 'the gang\'s boss', motive: 'Built the gang out of people you let walk.' },
        { role: 'the gang\'s bookkeeper', motive: 'Keeps the numbers, and wants to be the boss.' },
        { role: 'a lieutenant', motive: 'Does the dirty work, and wants the credit.' },
      ],
      items: [
        { type: 'evidence', label: 'Coded Ledger', text: 'Columns of numbers, dates, initials.', needs: 'lab',
          result: { label: 'Decoded Ledger', text: 'Payments in, payments out. Names beside the biggest numbers.', aspects: { financial: 3, digital: 1 } } },
        { type: 'clue', label: 'Wiretap Transcript', text: 'Hours of nothing, then five minutes of everything.', aspects: { digital: 2, testimony: 1 } },
        { type: 'clue', label: 'Meeting Pattern', text: 'They meet on Tuesdays, in the back room, and the boss always arrives last.', aspects: { opportunity: 2 } },
        { type: 'clue', label: 'Your Cover Story', text: 'What you saw with your own eyes, written down while it was fresh.', aspects: { testimony: 2 } },
      ],
      witnesses: ['a runner who wants out', 'a bartender who pays protection'],
      hints: ['The boss never touches the money. Makes someone else do it.', 'They\'re frightened of their own boss. More than of you.'],
    },
    syndicate: {
      label: 'The Syndicate', title: 'The Syndicate', lifetime: 400, difficulty: 12, special: true, highProfile: true,
      keyAspects: ['financial', 'digital', 'testimony', 'motive', 'forensic'], districts: ['uptown'],
      charge: { financial: 3, digital: 3, testimony: 2, motive: 2, forensic: 2 },
      scenes: ['the Boardroom Uptown'],
      brief: 'The ledgers point Uptown, to a room with a long table and very good chairs. Make it stick. You will not get a second chance.',
      roles: [
        { role: 'the chairman', motive: 'Owns half the city and rents out the other half.' },
        { role: 'a councillor', motive: 'Signs whatever the syndicate puts in front of them.' },
        { role: 'a respected banker', motive: 'Makes the dirty money clean.' },
      ],
      items: [
        { type: 'evidence', label: 'Shell Company Files', text: 'Boxes of them.', needs: 'lab',
          result: { label: 'Beneficial Owner', text: 'Every shell company, peeled back, has the same name at the centre.', aspects: { financial: 3, digital: 2 } } },
        { type: 'clue', label: 'The Accountant\'s Statement', text: 'He came to you in the night, terrified, and talked until dawn.', aspects: { testimony: 3, motive: 1 } },
        { type: 'clue', label: 'Payroll of Silence', text: 'A list of officials on the payroll. Some of them are police.', aspects: { financial: 2, motive: 2 } },
        { type: 'evidence', label: 'A Bloodied Coat', text: 'From a murder three years ago that was never solved.', needs: 'bio',
          result: { label: 'The Old Murder', text: 'The blood matches. The coat was bought by one of the men at the long table.', aspects: { forensic: 3 } } },
      ],
      witnesses: ['a frightened accountant', 'a chauffeur'],
      hints: ['The chairman never raises his voice. He doesn\'t have to.', 'I drove them. All of them. I know where they went.'],
    },
    architect: {
      label: 'The Architect', title: 'The Architect', lifetime: 400, difficulty: 11, special: true, highProfile: true,
      keyAspects: ['forensic', 'testimony', 'motive', 'opportunity', 'digital', 'financial'], districts: ['uptown', 'market'],
      charge: { forensic: 2, testimony: 2, motive: 2, opportunity: 2, digital: 2, financial: 2 },
      scenes: ['a Quiet House on the Hill'],
      brief: 'The Loose Ends all lead to one person: someone who has been planning crimes for others to commit, and leaving the smallest of signatures. Prove it.',
      roles: [
        { role: 'the respected professor', motive: 'Teaches criminology. Has been conducting experiments.' },
        { role: 'a retired judge', motive: 'Sentenced the city\'s criminals for thirty years, and learned from every one.' },
        { role: 'the philanthropist', motive: 'Funds the orphanage, the hospital, and everything else.' },
      ],
      items: [
        { type: 'clue', label: 'The Signature', text: 'The same small mark at every scene you have ever worked: a folded paper crane.', aspects: { forensic: 2, opportunity: 1 } },
        { type: 'evidence', label: 'Correspondence', text: 'Letters to a dozen criminals, unsigned.', needs: 'lab',
          result: { label: 'The Letters Decoded', text: 'Plans. Detailed plans. For crimes you have investigated.', aspects: { digital: 2, motive: 2 } } },
        { type: 'clue', label: 'The Payments', text: 'Every one of them was paid, in the same way, from the same place.', aspects: { financial: 3 } },
        { type: 'clue', label: 'A Convict\'s Testimony', text: 'One of the people you put away has decided to talk.', aspects: { testimony: 3 } },
      ],
      witnesses: ['a housekeeper', 'a former student'],
      hints: ['Such a kind person. They always asked about your cases, detective.', 'They kept paper cranes on every windowsill.'],
    },
  };

  CF.ORDINARY_CASES = ['burglary', 'missing', 'harbor', 'arson', 'fraud', 'extortion'];
})(typeof window !== 'undefined' ? window : globalThis);
