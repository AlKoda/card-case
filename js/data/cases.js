// Case templates and the prose that fills them. Each case is generated from a
// template: a victim, a scene, three accused (one guilty) with distinct
// traits, and a pool of things to find. Tokens that betray the culprit's
// trait are hidden among the scene items, so a careful reader can deduce
// the culprit before the casebook confirms it. The city is the Free City
// of docs/CITY.md, about the year 1600.
(function (G) {
  var CF = G.CF;

  CF.NAMES = {
    m: ['Hans', 'Jörg', 'Kunz', 'Veit', 'Lienhard', 'Endres', 'Caspar', 'Sebald', 'Michel', 'Matthes', 'Bartel', 'Stoffel',
      'Claes', 'Dirck', 'Pieter', 'Cornelis', 'Wouter', 'Barent', 'Kit', 'Hodge', 'Rafe', 'Ned', 'Hal', 'Tom', 'Gregory'],
    f: ['Grete', 'Els', 'Barbel', 'Ursel', 'Apollonia', 'Kathrin', 'Walburg', 'Ottilie', 'Sibylla', 'Magdalena', 'Afra', 'Regina',
      'Anneke', 'Griet', 'Neeltje', 'Trijn', 'Lijsbet', 'Aeltje', 'Nan', 'Bess', 'Joan', 'Margery', 'Cicely', 'Moll', 'Dorcas'],
    last: ['Schmidt', 'Kramer', 'Weber', 'Pfister', 'Kürschner', 'Seiler', 'Bader', 'Gerber', 'Sattler', 'Nagel', 'Kessler',
      'Vos', 'de Witt', 'Visscher', 'Bakker', 'Kuiper', 'Molenaar', 'van der Meer', 'de Groot', 'Claesz', 'Pietersz',
      'Fletcher', 'Cooper', 'Tanner', 'Chandler', 'Fuller', 'Webster', 'Mercer', 'Dyer', 'Barker', 'Sawyer', 'Kempe', 'Hobson',
      'Tucher', 'Imhoff', 'Holzschuher', 'Welser', 'Stromer', 'Ebner', 'Haller', 'Bicker', 'Pauw', 'Adornes'],
  };
  CF.NAMES.first = CF.NAMES.m.concat(CF.NAMES.f);
  CF.NAMES.gang = ['the Coquillards of the Quay', 'the Lanternless', 'the Brotherhood of the Shell', 'the Brass Hands', 'the Quiet Men',
      'the Gallows Company', 'the Velvet Knives', 'the Kings of the Warrens'];

  // Six quarters. Keys are the old district keys, so saves and tests hold.
  CF.DISTRICTS = {
    docks: { label: 'The Harbour', desc: 'Quays, the great crane, bonded warehouses and foreign sailors. Everything here is for sale, including silence.' },
    market: { label: 'The Market', desc: 'Stalls, the weigh-house, pawnbrokers and cutpurses. The pillory stands in the square, and your Watch-house at its edge.' },
    neon: { label: 'The Stews', desc: 'Taverns, bathhouses, dice-rooms and the spinning-house across the river. The people who own them own more than that.' },
    uptown: { label: 'Patricians\' Hill', desc: 'The great houses, the Council chamber and the Mint. Money lives here. It does not like to be asked questions.' },
    warrens: { label: 'The Warrens', desc: 'Tenements stacked against the wall, and cellars under the cellars. Everyone saw nothing, and everyone knows everything.' },
    canal: { label: 'The Abbey Close', desc: 'The Bishop\'s precinct: the hospital, the scriptorium, the sanctuary yard. Quiet at night. Too quiet.' },
  };

  // Every accused has one trait. The culprit's trait leaks into tokens.
  CF.TRAITS = [
    { id: 'menthol', desc: 'Smokes a clay pipe of cheap Dutch tobacco, one bowl after another.',
      clue: { label: 'Pipe Ash on the Sill', text: 'A knocked-out bowl of ash on the windowsill, still sour. Someone waited here a long while, smoking.', aspects: { forensic: 1, opportunity: 1 } } },
    { id: 'limp', desc: 'Walks with a heavy limp in the left leg.',
      clue: { label: 'A Dragging Footprint', text: 'Prints in the mud of the yard. The left foot drags on every step, leaving a long scuff.', aspects: { forensic: 1, opportunity: 1 } } },
    { id: 'lefty', desc: 'Left-handed. Writes with a hooked wrist.', who: 'is left-handed, and writes with a hooked wrist.',
      clue: { label: 'A Left-Handed Stroke', text: 'Whoever did this stood on the right and worked with their left hand. The angle is plain to anyone who has seen a butcher.', aspects: { forensic: 2 } } },
    { id: 'van', desc: 'Drives a dray with a lame grey mule.',
      clue: { label: 'Grey Hair on the Gatepost', text: 'A rub of grey hair on the gatepost at a mule\'s height, and one hoofprint that lands wrong. Somebody backed a dray in here.', aspects: { forensic: 1, opportunity: 1 } } },
    { id: 'bandage', desc: 'Has a fresh linen binding wrapped around one hand.',
      clue: { label: 'Blood on the Latch', text: 'A smear of blood on the shutter latch. Someone cut themselves getting in, or getting out.', aspects: { forensic: 2 } } },
    { id: 'sandalwood', desc: 'Wears civet and rosewater, like a courtier.',
      clue: { label: 'A Scent in the Room', text: 'Hours later the room still smells, faintly, of civet and rosewater. Not the victim\'s.', aspects: { opportunity: 1, testimony: 1 } } },
    { id: 'debt', desc: 'Owes a great deal to a moneylender in the Stews.',
      clue: { label: 'A Torn Bond', text: 'Half a bond, the sum circled twice in red ink. A lender in the Stews signs like that.', aspects: { financial: 1, motive: 1 } } },
    { id: 'boots', desc: 'Wears great hobnailed boots, a soldier\'s.',
      clue: { label: 'A Hobnail Scar', text: 'A deep gouge at the foot of the door, the kind a hobnailed boot makes. A big boot, and a kick.', aspects: { forensic: 1, opportunity: 1 } } },
    { id: 'licorice', desc: 'Chews cloves against the toothache, constantly.',
      clue: { label: 'A Chewed Clove', text: 'A clove, chewed flat and spat behind the stove. Somebody with a bad tooth stood here a while.', aspects: { forensic: 1, opportunity: 1 } } },
    { id: 'key', desc: 'Has had a key to the house for years.',
      clue: { label: 'No Forced Entry', text: 'Not a mark on the locks. Whoever came in had a key, or was let in by someone who trusted them.', aspects: { opportunity: 2 } } },
    { id: 'ring', desc: 'Never takes off a heavy gold signet.',
      clue: { label: 'A Curved Scratch', text: 'A fresh curved scratch in the wax of the table, the kind a heavy signet leaves on a clenched fist.', aspects: { forensic: 1, opportunity: 1 } } },
    { id: 'ticket', desc: 'Has lately paid a carrier for a seat on the wagon to the coast.',
      clue: { label: 'The Carrier\'s Chit', text: 'A carrier\'s chit for a place on Friday\'s wagon to the coast. One way. Someone is planning to leave.', aspects: { opportunity: 1, motive: 1 } } },
    { id: 'ink', desc: 'Has ink-black fingers; works a printer\'s press.',
      clue: { label: 'An Inked Thumb', text: 'A thumbprint, perfect, in printer\'s ink on the white of the doorframe.', aspects: { forensic: 2 } } },
    { id: 'gambler', desc: 'Plays at dice every night in a cellar in the Stews.',
      clue: { label: 'A Loaded Die', text: 'A bone die, rolled under the sideboard. Weighted. The dice-cellars in the Stews call them gourds.', aspects: { financial: 1, opportunity: 1 } } },
  ];

  // What a witness might remember about the culprit's trait.
  CF.TRAIT_SEEN = {
    menthol: 'They smelled of pipe smoke. Cheap stuff, the Dutch kind.',
    limp: 'They walked wrong. Dragged one leg.',
    lefty: 'They opened the gate with their left hand. I marked it because it is the stiff side.',
    van: 'There was a dray. A grey mule, lame in one foot.',
    bandage: 'Their hand was wrapped up in something white.',
    sandalwood: 'They smelled like a gentleman. Civet, or some such.',
    debt: 'They looked hunted. Like someone who owes money to the wrong people.',
    boots: 'Big boots. Nailed. You could hear them coming on the cobbles.',
    licorice: 'They were chewing something. Cloves, I thought.',
    key: 'They didn\'t knock. They let themselves in.',
    ring: 'A gold ring. Big, on the little finger. It caught the lantern.',
    ticket: 'They kept asking when the carrier\'s wagon left.',
    ink: 'Their fingers were black, like a printer\'s.',
    gambler: 'They were rolling a die over their knuckles.',
  };

  // Questioning and street prose that works across cases.
  CF.PROSE = {
    witnessEmpathy: [
      '{witness} talks for an hour. Most of it is about their late husband. Then, almost as an afterthought: "{hint}"',
      'You sit. You listen. You let the silence do the work. Eventually {witness} says: "{hint}"',
      '{witness} keeps begging your pardon for wasting your time. They are not wasting it. "{hint}"',
    ],
    witnessBluff: [
      'You tell {witness} someone else already named them. It is not true. Their face goes white. "{hint}"',
      'You pretend to know more than you do. {witness} fills in the gaps for you. "{hint}"',
    ],
    witnessBluffFail: [
      '{witness} sees through you in a heartbeat and folds their arms. "I think I will go home now, your worship."',
      'The bluff lands wrong. {witness} shuts like a shutter and will not look at you.',
    ],
    witnessPressure: [
      'You lean on {witness}. You lean hard. They tell you what you want to hear. Some of it might even be true. "{hint}"',
      'Voices are raised. A stool goes over. {witness} is weeping by the end, and making their mark on whatever you put in front of them.',
    ],
    suspectAlibi: [
      '{suspect} has an answer, and it is a good one: {alibi}. They are cleared.',
      'You try {suspect}\'s story. It holds: {alibi}. Scratch one name off the board.',
    ],
    alibis: ['a night at the Harbour crane with a dozen porters', 'a bed in the Abbey hospital', 'a game of tables with a sergeant of the Watch',
      'a carrier\'s chit stamped two days\' ride away', 'a wedding, and forty guests who remember the dancing', 'a night in the Hole for drunkenness'],
    suspectEmpathy: [
      'You let {suspect} talk about {victim}. Their voice changes when they do. {motive}',
      'A gentle question, then another. {suspect} is angry about something, and it comes out sideways. {motive}',
    ],
    suspectBluff: [
      'You tell {suspect} the beadle saw them. He did not. They glance at the door, then start explaining where they were. It is the wrong explanation.',
      'You name the scene carelessly, as if it meant nothing. {suspect} flinches. They knew exactly where it was.',
    ],
    suspectBluffFail: [
      '{suspect} smiles and asks for their advocate. The examination is over.',
      '{suspect} just watches you, calm as still water. They are not going to give you anything today.',
    ],
    suspectPressure: [
      'It goes on for hours in the Hole. It gets to the thumbscrews. At the end {suspect} makes their mark on a confession. Whether it is true is another question.',
      'You send the clerk out. When you call him back in, {suspect} is ready to say anything.',
    ],
    suspectCracks: [
      'You lay {clue} on the table and say nothing. {suspect} stares at it for a long time. Then they start to talk.',
      'You slide {clue} across the table. {suspect}\'s composure goes, all at once, like a dam breaking.',
    ],
  };

  // What a witness stands to gain or lose by talking [Fingerpost]. Two
  // witnesses who agree for different reasons establish a fact; two who
  // want the same thing establish nothing; one who speaks against their
  // own interest counts double.
  CF.STAKES = {
    self: { label: 'Protects themselves', desc: 'has something of their own to hide', against: false },
    kin: { label: 'Protects kin', desc: 'is kin to somebody in the case', against: true },
    reward: { label: 'Wants the reward', desc: 'has heard there is a reward', against: false },
    hates: { label: 'Hates the accused', desc: 'has an old grudge in the quarter', against: false },
    loves: { label: 'Loves the accused', desc: 'is fond of somebody in the case', against: true },
    none: { label: 'No stake', desc: 'has no stake in it that you can see', against: false },
  };

  // Generic scene items used by every template (on top of template items).
  CF.GENERIC_SCENE = [
    { type: 'evidence', label: 'Marks on the Sill', text: 'The print of a hand on the whitewash. Faint, but there.', needs: 'prints',
      result: { names: true, label: 'The Hand Read', text: 'Under vinegar and the red umbrella the hand comes up whole: a thumb with a scar across it. Good enough for the Court.', aspects: { forensic: 3 } } },
    { type: 'clue', label: 'Disturbed Dust', text: 'Something heavy was moved lately. Lately enough to date it.', aspects: { opportunity: 1 } },
  ];

  CF.CASE_TEMPLATES = {
    burglary: {
      label: 'Burglary', title: 'Burglary at {scene}', lesser: 'theft, not burglary', lifetime: 250, difficulty: 5,
      keyAspects: ['forensic', 'opportunity', 'financial'], districts: ['market', 'uptown', 'canal'],
      charge: { forensic: 2, opportunity: 2, financial: 2 },
      scenes: ['{last}\'s Pawnshop', 'the {last} House', '{last} the Goldsmith\'s'],
      brief: '{victim} came down at prime to find the back shutter open and the strongbox empty. It was not a crocheteur\'s work, but it was not a nervous man\'s either.',
      roles: [
        { role: 'the night porter', motive: 'The porter was turned off last month and never paid his last wages.' },
        { role: 'a nephew of the house', motive: 'The nephew was cut out of the will a week ago, loudly, at table.' },
        { role: 'a receiver from the Market', motive: 'The receiver had a buyer waiting for exactly what was taken.' },
        { role: 'the owner\'s partner in trade', motive: 'The partnership is drowning in debt, and a theft is a loss the guild will forgive.' },
        { role: 'a journeyman turned off', motive: 'Let go without a letter, and still talking of it in every tavern in the Stews.' },
      ],
      // The written leads below give the scene; the generic search draws
      // from the structure, the generic pool and the trait token afterwards.
      items: [],
      witnesses: ['a baker lighting the ovens', 'the night-watchman crying the hours', 'the woman at the casement opposite'],
      hints: ['I saw someone at the back gate. They had a bad leg, or maybe a heavy sack.', 'There was a dray. I didn\'t see the beast, it was dark.', 'The dog next door never barked. Never. It knew whoever it was.'],
      // The written case (docs/DESIGN.md, "The first playable case"). Three
      // threads leave the scene: the shutter (body), the neighbour (word)
      // and the money (coin). Any two make a charge.
      // Order matters: the first lead whose needs are met is the one that
      // runs, so the specific ones come before the catch-alls.
      leads: [
        { id: 'scene', verb: 'investigate', label: 'Search the Scene', duration: 30,
          preview: 'Go in past the beadle. Start at the shutter and work inwards.',
          gives: [
            { type: 'evidence', key: 'window', label: 'The Pried Shutter', text: 'Marks on the frame, a flat blade.', needs: 'bio',
              result: { label: 'The Blade Read', text: 'The blade was a chisel, chipped at one corner. Find the chisel, find the burglar.', aspects: { forensic: 2, opportunity: 1 } } },
            { type: 'clue', label: 'The Inventory', text: 'What the house says was taken does not match the guild\'s inventory. Someone knew what was worth carrying.', aspects: { financial: 2 } },
          ],
          reveal: 'any', district: true, fatigue: 0.25,
          story: { title: 'At the Scene', text: 'You go in past the beadle at {scene}. The back shutter has been forced with something flat and patient, and the strongbox stands open like a mouth. You come away with {found}.' } },
        { id: 'prints', verb: 'investigate', label: 'Read the Surfaces', duration: 25, needs: { tags: ['surfaces'], after: ['scene'] },
          preview: 'Vinegar on the shutter frame, the strongbox lid, the door. Somebody touched all three.',
          gives: [
            { type: 'evidence', key: 'print', label: 'Half a Hand', text: 'Raised from the strongbox lid. Half a thumb, maybe. Needs a name to hold it against.', needs: 'prints',
              result: { label: 'Half a Hand', text: 'Half a thumb. Without the vinegar and the red umbrella it is only half a token.', aspects: { forensic: 1 } } },
          ],
          fatigue: 0.25,
          story: { title: 'The Surfaces', text: 'The vinegar brings up half a hand on the strongbox lid where a thumb pressed hard, lifting it. Whoever it belongs to was not wearing gloves when it mattered.' } },
        { id: 'canvass', verb: 'investigate', label: 'Go Door to Door', duration: 30, needs: { aspects: ['district'], sameDistrict: true },
          preview: 'Door to door. Somebody was awake between compline and matins. Somebody always is.',
          gives: [
            { type: 'witness', who: 'the woman at the casement opposite, who does not sleep', knows: true },
            { type: 'evidence', key: 'ticket', label: 'A Pawnbroker\'s Chit', text: 'A chit from a Lombard across the river, dated the morning after, dropped in the gutter by the back gate.',
              result: { label: 'Pledged Goods', text: 'A ring from the strongbox was pledged across the river within hours. The Lombard remembers who brought it in: "{seen}"', aspects: { financial: 2, testimony: 1 } } },
          ],
          reveal: 'any',
          story: { title: 'Door to Door', text: 'Around {scene} people are frightened, and frightened people talk. The woman at the casement opposite was at her window past matins. She usually is.' } },
        { id: 'timing', verb: 'investigate', label: 'Go Back Over It', duration: 30, needs: { after: ['scene'], without: ['district', 'tool'] },
          preview: 'Go back over {scene} inch by inch. The first pass never finds everything.',
          gives: [
            { type: 'clue', label: 'The Hours', text: 'The watchman cried two, and the dog was quiet. He cried three, and the shutter was open. One hour, and they knew the house.', aspects: { opportunity: 2 } },
          ],
          fatigue: 0.25,
          story: { title: 'Back at the Scene', text: 'The night-watchman keeps his hours in his head. Two, quiet. Three, the shutter open. Somebody knew the house, and somebody was in and out between the bells.' } },
        { id: 'toolmark', verb: 'analyze', label: 'Read the Blade', duration: 25, needs: { item: 'window', tool: 'bio' }, consume: true,
          preview: 'Take a wax cast of the marks, measure the blade, look for the flaw.',
          gives: [{ type: 'clue', label: 'The Blade Read', text: 'The blade was a chisel, chipped at one corner. Find the chisel, find the burglar.', aspects: { forensic: 2, opportunity: 1 } }],
          story: { title: 'The Cast', text: 'The wax shows a chisel, and a chip at one corner that will match exactly one chisel in the city. It is the kind of detail the sworn men like.' } },
        { id: 'print_match', verb: 'analyze', label: 'Match the Hand', duration: 25, needs: { item: 'print', tool: 'prints', suspects: 1 }, consume: true,
          preview: 'Hold the half-hand against every name on the board.',
          gives: [{ type: 'clue', label: 'The Hand Matched: {culprit}', text: 'The scar across the thumb on the strongbox lid is {culprit}\'s. Not the owner, not the household. {culprit}.', aspects: { forensic: 3 }, points: 'culprit', noMisread: true }],
          story: { title: 'A Match', kind: 'major', text: 'A scar across the ball of the thumb, and the same scar on a hand you have shaken. The thumb on the strongbox lid belongs to {culprit}.' } },
        { id: 'print_nomatch', verb: 'analyze', label: 'Compare the Hand', duration: 10, needs: { item: 'print', tool: 'prints' }, once: false,
          preview: 'Half a hand is only half a token. You need somebody to hold it against.',
          story: { title: 'Nothing to Compare', text: 'A clean half-hand, and nobody on the board to hold it against. Find an accused first, then bring it back.' } },
        { id: 'pawn', verb: 'analyze', label: 'Trace the Chit', duration: 20, needs: { item: 'ticket' }, consume: true,
          preview: 'Cross the river. Get the Lombard talking.',
          gives: [{ type: 'clue', label: 'Pledged Goods', text: 'A ring from the strongbox was pledged across the river within hours. The Lombard remembers who brought it in: "{seen}"', aspects: { financial: 2, testimony: 1 }, trait: true }],
          story: { title: 'The Lombard', text: 'The Lombard kept the ring and the chit and, when you lean on the counter, a description: "{seen}"' } },
      ],
    },
    missing: {
      label: 'The Vanished', title: 'The Vanishing of {victim}', lesser: 'abduction, not murder', lifetime: 280, difficulty: 6,
      keyAspects: ['testimony', 'motive', 'digital'], districts: ['warrens', 'neon', 'uptown'],
      charge: { testimony: 2, motive: 2, digital: 2 },
      scenes: ['{victim}\'s Lodging', 'the Last Known Door', 'the Ferry Steps by {last} Wharf'],
      brief: '{victim} has not been seen for four days. Their bed has not been slept in. Their cat is very hungry. Nobody has asked for a ransom.',
      roles: [
        { role: 'the estranged spouse', motive: 'A separation before the Bishop\'s court would have left the spouse with nothing. A vanishing leaves them with everything.' },
        { role: 'a jealous journeyman', motive: 'The guild passed the journeyman over for mastership in favour of the victim.' },
        { role: 'the landlord', motive: 'The victim had complained of the landlord to the Council twice.' },
        { role: 'a secret lover', motive: 'The victim was going to end it, and had said so in a letter.' },
        { role: 'a bathhouse keeper in the Stews', motive: 'The victim had seen something in the back room they should not have.' },
      ],
      items: [
        { type: 'evidence', label: 'A Bundle of Letters', text: 'Tied with ribbon, the ribbon cut.', needs: 'lab',
          result: { label: 'The Letters Read', text: 'Nine letters from the same hand in the last month, then nothing. The hand belongs to someone the victim knew well.', aspects: { digital: 3 } } },
        { type: 'clue', label: 'An Unfinished Letter', text: '"I cannot keep pretending, and I will not let you—" It stops there.', aspects: { motive: 2, testimony: 1 } },
        { type: 'clue', label: 'A Packed Coffer', text: 'A travelling coffer, packed and pushed under the bed. They meant to leave. They did not get to.', aspects: { motive: 1, opportunity: 1 } },
        { type: 'evidence', label: 'A Commonplace Book', text: 'Written in a private cipher.', needs: null,
          result: { label: 'The Cipher Broken', text: 'Read out, the last leaves speak of being followed, and name the person they feared in everything but name.', aspects: { testimony: 2, motive: 1 } } },
      ],
      witnesses: ['the neighbour with the cat', 'the tapster at the corner alehouse', 'a ballad-seller'],
      hints: ['They quarrelled with someone on the stair. A man or a woman, I couldn\'t say. They sounded like they knew each other.', 'They were frightened. They kept looking at the door.', 'They told me they were coming into money. Then they said they were leaving the city.'],
    },
    harbor: {
      label: 'A Death', title: 'The Body at the Crane', lesser: 'manslaughter, not murder', lifetime: 240, difficulty: 7, highProfile: true,
      keyAspects: ['forensic', 'motive', 'opportunity'], districts: ['docks', 'canal'],
      charge: { forensic: 3, motive: 2, opportunity: 2 },
      scenes: ['Berth {n}', 'the {last} Warehouse', 'the Harbour Steps'],
      brief: 'A porter\'s hook pulled {victim} out of the water under the great crane at first light. There is no froth at the mouth and no sand under the nails: they were dead before they went in. The crier has already sung it.',
      roles: [
        { role: 'the harbourmaster', motive: 'The victim was about to lay before the Council how the harbourmaster is paid on every cargo.' },
        { role: 'a porters\' guildmaster', motive: 'The victim was gathering the porters against the guild\'s masters.' },
        { role: 'a smuggler', motive: 'The victim owed the smuggler for a cargo that never came ashore.' },
        { role: 'the victim\'s rival in trade', motive: 'Their rivalry had gone to the courts, and then to threats.' },
        { role: 'a crane-walker', motive: 'The crane-walker\'s brother died on a load the victim swore was sound.' },
      ],
      items: [
        { type: 'evidence', label: 'Threads Under the Nails', text: 'The victim fought.', needs: 'bio',
          result: { label: 'The Threads Matched', text: 'Wool and tar, from a heavy sea-coat. The victim clawed their killer, hard.', aspects: { forensic: 3 } } },
        { type: 'clue', label: 'The Wrong Tide', text: 'The body went in at the east quay. At that tide, it could only have been between compline and matins.', aspects: { opportunity: 2 } },
        { type: 'clue', label: 'The Purse Untouched', text: 'Purse full, signet still on the finger. This was not a robbery. This was personal.', aspects: { motive: 2 } },
        { type: 'evidence', label: 'A Sodden Day-Book', text: 'Leaves stuck together, ink running.', needs: 'lab',
          result: { label: 'The Leaves Parted', text: 'The apothecary parts the leaves over steam. The victim had been writing down names and cargo marks.', aspects: { motive: 1, financial: 2 } } },
      ],
      witnesses: ['a night fisherman', 'a porter on the late gang', 'a sailor waiting for the tide'],
      hints: ['Two of them were arguing by the bollards, past compline. Then just one.', 'I heard a splash. I thought it was a bale. Nobody drops bales at midnight.', 'Somebody walked off the quay in a hurry. Big coat. They didn\'t look back.'],
    },
    arson: {
      label: 'Fire', title: 'Fire at {scene}', lesser: 'a careless fire, not arson', lifetime: 230, difficulty: 6,
      keyAspects: ['forensic', 'financial', 'testimony'], districts: ['canal', 'warrens', 'market'],
      charge: { forensic: 2, financial: 2, testimony: 2 },
      scenes: ['the {last} Warehouse', 'the {last} Print-shop', 'a Tenement in {last} Row'],
      brief: 'The bucket-chain got there in time to save the walls and nothing else. The fire-warden says it started in three places at once. Fires do not do that. The Carolina says the Fire for whoever did.',
      roles: [
        { role: 'the building\'s owner', motive: 'The building was pledged for three times its worth, and the owner was ruined.' },
        { role: 'a tenant put out', motive: 'The tenant had been put into the street two days before the fire.' },
        { role: 'a rival in the trade', motive: 'The fire took out the only rival on the street.' },
        { role: 'a known fire-setter', motive: 'The fire-setter has been examined about three fires before. Never charged.' },
        { role: 'the night-clerk', motive: 'The clerk had been skimming from the books, and the books were in the counting-room.' },
      ],
      items: [
        { type: 'evidence', label: 'The Smell Under the Smoke', text: 'The floor stinks of lamp-oil under the char.', needs: 'bio',
          result: { label: 'The Oil Named', text: 'Rape-oil cut with spirit, a blend sold by one chandler in the Abbey Close.', aspects: { forensic: 2, opportunity: 1 } } },
        { type: 'clue', label: 'A Bond of Assurance', text: 'Drawn six weeks ago before a notary. The premium paid in coin.', aspects: { financial: 2, motive: 1 } },
        { type: 'clue', label: 'Moved Stock', text: 'The good stock was carted out of the building the week before. Someone knew.', aspects: { financial: 1, opportunity: 1 } },
        { type: 'evidence', label: 'A Scorched Ledger', text: 'Half-burned, the leaves brittle.', needs: 'lab',
          result: { label: 'The Accounts Recovered', text: 'The leaves that survived show coin leaving the business for months.', aspects: { financial: 3 } } },
      ],
      witnesses: ['a man on the bucket-chain', 'a drunk asleep in the doorway opposite', 'a child who could not sleep'],
      hints: ['Someone came out the side door just before the smoke. They weren\'t running. They were walking.', 'There was a smell, like a lamp, but strong. An hour before.', 'I saw a light in the upper room at matins. There\'s never anyone there at matins.'],
    },
    fraud: {
      label: 'False Dealing', title: 'The {last} Affair', lesser: 'sharp dealing, not fraud', lifetime: 300, difficulty: 7, victimSex: 'f',
      keyAspects: ['financial', 'digital', 'motive'], districts: ['uptown', 'neon'],
      charge: { financial: 3, digital: 2, motive: 2 },
      scenes: ['the {last} Counting-house', '{last} & Company', 'the {last} Venture'],
      brief: '{victim}, a widow of the Market, has lost everything she had to a share in a venture that does not exist. She is not the only one. She is just the only one brave enough to come to the Watch-house.',
      roles: [
        { role: 'the silver-tongued factor', motive: 'The factor\'s table costs far more than a factor earns.' },
        { role: 'a clerk of the counting-house', motive: 'The clerk had the keys to every book and a taste for the dice-cellars.' },
        { role: 'the victim\'s man of business', motive: 'He recommended the venture himself, and took a fee on every widow he brought to it.' },
        { role: 'a patrician\'s wife', sex: 'f', motive: 'She introduced every one of them to the venture at her table on the Hill.' },
      ],
      items: [
        { type: 'evidence', label: 'The Bills of Exchange', text: 'Six months of paper.', needs: 'lab',
          result: { names: true, label: 'The Coin Followed', text: 'The money went through four hands and came to rest in one. The last endorsement is legible.', aspects: { financial: 3, digital: 1 } } },
        { type: 'clue', label: 'A Handsome Prospectus', text: 'Beautifully printed, with a woodcut of a mine. The venture\'s address is a rented room.', aspects: { financial: 1, motive: 1 } },
        { type: 'evidence', label: 'Letters of Reassurance', text: 'To the investors. The same hand, every time, disguised.', needs: null,
          result: { names: true, label: 'The Hand Matched', text: 'The same broken loop on every e, disguised or not. Find the hand.', aspects: { forensic: 1, digital: 2 } } },
        { type: 'clue', label: 'Spending Beyond Station', text: 'Someone near the venture bought a horse and a house this spring, in coin. The Carolina counts that as indicia.', aspects: { motive: 2 } },
      ],
      witnesses: ['another investor', 'a scrivener at the counting-house', 'a doorkeeper on the Hill'],
      hints: ['There were always suppers. The same people, telling the same stories about the venture.', 'I wrote the letters fair. I was told what to write. I didn\'t ask.', 'They came in every Friday with a strongbox. Left without it.'],
    },
    extortion: {
      label: 'Protection', title: 'Protection in {scene}', lesser: 'menaces, not extortion', lifetime: 260, difficulty: 6,
      keyAspects: ['testimony', 'financial', 'opportunity'], districts: ['market', 'neon', 'warrens'],
      charge: { testimony: 2, financial: 2, opportunity: 2 },
      scenes: ['{last} Lane', 'the {last} Arcade', 'the Night Market'],
      brief: 'Stallholders have been paying for "protection" for months. Now {victim}\'s stall has had its awning slashed and its stock in the gutter for refusing. Nobody else will talk.',
      roles: [
        { role: 'a bravo of the Stews', motive: 'The bravo collects the money, and keeps a share.' },
        { role: 'the landlord of the arcade', motive: 'Frightened tenants accept a higher rent. The landlord knows it.' },
        { role: 'a sergeant of the Watch', motive: 'The sergeant\'s round is exactly the streets being squeezed.' },
        { role: 'a stallholder who pays', motive: 'The stallholder who pays gets a discount for pointing out who does not.' },
      ],
      items: [
        { type: 'clue', label: 'The Collector\'s Round', text: 'Pencilled on the back of a broadsheet: market days, stall numbers, sums.', aspects: { financial: 2, opportunity: 1 } },
        { type: 'evidence', label: 'A Threatening Letter', text: '"Pay or burn." Letters cut from a broadsheet and pasted.', needs: 'prints',
          result: { names: true, label: 'The Hand on the Paste', text: 'Whoever pasted this down was careful everywhere except the glue.', aspects: { forensic: 3 } } },
        { type: 'clue', label: 'The Slashed Awning', text: 'Cut from the street, an hour before the gate bell, when the lane is still busy. They wanted to be seen.', aspects: { opportunity: 1, testimony: 1 } },
        { type: 'clue', label: 'The Victim\'s Account', text: '{victim} tells you everything, hands shaking, and begs you not to write their name down.', aspects: { testimony: 2 } },
      ],
      witnesses: ['a frightened stallholder', 'a carrier\'s boy', 'the woman who keeps the cookshop'],
      hints: ['He comes on market day. Always market day. He talks like a sergeant.', 'They count the money on the corner, bold as brass.', 'There are two of them. One talks, one watches.'],
    },
    poison: {
      label: 'Poisoning', title: 'The Death of {victim}', lesser: 'unlawful physic, not murder', lifetime: 260, difficulty: 7,
      keyAspects: ['forensic', 'motive', 'financial'], districts: ['uptown', 'canal', 'market'],
      charge: { forensic: 3, motive: 2, financial: 1 },
      scenes: ['the {last} House', 'the Sign of the Pestle', 'a Cell in the Abbey Hospital'],
      brief: '{victim} died in the night after a good supper, in agony, and the physician wrote "a surfeit". The silver needle in the coroner\'s book says otherwise. The Carolina says the Wheel for a man who poisons, and the Water for a woman.',
      roles: [
        { role: 'the widow', sex: 'f', motive: 'The marriage was a cold one and the jointure is a warm one.' },
        { role: 'the apothecary', motive: 'The apothecary sold the powder, and had been paid to forget who bought it.' },
        { role: 'a physician of the Abbey', motive: 'The victim was going to tell the guild which of the physician\'s cures were water.' },
        { role: 'the heir', motive: 'The heir had been living on expectations, and the expectations had run out.' },
        { role: 'the cook', motive: 'The cook was beaten in this house, and everyone in the kitchen knew it.' },
      ],
      items: [
        { type: 'evidence', label: 'The Supper Cup', text: 'Rinsed, but not well.', needs: 'bio',
          result: { label: 'The Needle Blackens', text: 'The silver needle goes into the dregs and comes out black. Ratsbane, and a great deal of it.', aspects: { forensic: 3 } } },
        { type: 'clue', label: 'The Physician\'s Note', text: '"A surfeit of eels." Written before he had seen the body, and paid for before he had written it.', aspects: { motive: 1, testimony: 1 } },
        { type: 'clue', label: 'The Jointure', text: 'A settlement, sealed a month ago, that leaves someone very comfortable.', aspects: { financial: 2, motive: 1 } },
        { type: 'evidence', label: 'The Poison Book', text: 'Every apothecary in the city must keep one. This one has a leaf cut out.', needs: 'lab',
          result: { names: true, label: 'The Cut Leaf Read', text: 'The leaf beneath took the impress of the pen. A name, a date, three drams of white arsenic.', aspects: { digital: 2, forensic: 1 } } },
      ],
      witnesses: ['the kitchen maid', 'the apothecary\'s boy', 'a guest at the supper'],
      hints: ['They sent the eels back and asked for the other dish. The one nobody else had.', 'Someone came for a paper of powder for the rats. We have no rats.', 'They laughed all through supper. At the end they said they felt cold.'],
    },
    coining: {
      label: 'Coining', title: 'False Coin in {scene}', lesser: 'uttering, not coining', lifetime: 240, difficulty: 6,
      keyAspects: ['forensic', 'financial', 'opportunity'], districts: ['market', 'warrens', 'docks'],
      charge: { forensic: 2, financial: 2, opportunity: 2 },
      scenes: ['the Weigh-house', '{last}\'s Tavern', 'the Cattle Market'],
      brief: 'The Mintmaster brought {victim}\'s takings to the Watch-house in a bag: a third of them silver over lead, clipped at the edge, the Emperor\'s face a little wrong. Somebody in the city has a die and a furnace. The Carolina says the Fire for coiners.',
      roles: [
        { role: 'a goldsmith\'s journeyman', motive: 'The journeyman has the hands for a die and none of the guild\'s scruples.' },
        { role: 'a tavern-keeper', motive: 'The tavern passes more coin in a night than the Mint in a week, and nobody looks at it by candlelight.' },
        { role: 'a discharged soldier', motive: 'The soldier learned to cast bullets in Flanders and found a better use for lead.' },
        { role: 'a moneychanger', motive: 'The changer buys clippings by weight and asks no questions, and lately has been selling them.' },
      ],
      items: [
        { type: 'evidence', label: 'The Bad Coin', text: 'A handful of it. Bright where it should be worn.', needs: 'bio',
          result: { label: 'The Coin Assayed', text: 'The apothecary\'s acid finds lead under the silver, and the same flaw in the Emperor\'s eye on every piece. One die.', aspects: { forensic: 3 } } },
        { type: 'clue', label: 'Clippings', text: 'A twist of paper with the shaved edges of good coin in it. Somebody is weighing their harvest.', aspects: { financial: 2 } },
        { type: 'clue', label: 'Smoke After Curfew', text: 'A furnace burning past the gate bell, in a quarter where no forge is licensed.', aspects: { opportunity: 2 } },
        { type: 'evidence', label: 'A Plaster Mould', text: 'Broken in half in a midden.', needs: 'prints',
          result: { names: true, label: 'The Mould Read', text: 'Vinegar brings up the hand that pressed the plaster: a thumb, and a missing nail.', aspects: { forensic: 2, opportunity: 1 } } },
      ],
      witnesses: ['the Mintmaster\'s assayer', 'a market-woman who was paid in it', 'a boy who sells kindling'],
      hints: ['They paid in new coin. Too new. Nobody in the Market has new coin.', 'I sold them charcoal three nights running. Sacks of it. Nobody bakes that much.', 'Their fingers were burned. Little burns, all over, like a cook\'s.'],
    },

    // --- Special cases -------------------------------------------------
    scriptorium: {
      label: 'The Scriptorium', title: 'A Death in the Scriptorium', lesser: 'a fall, not murder', lifetime: 280, difficulty: 8, highProfile: true, heresy: true,
      keyAspects: ['forensic', 'digital', 'testimony'], districts: ['canal'],
      charge: { forensic: 3, digital: 2, testimony: 2 },
      scenes: ['the Abbey scriptorium', 'the Abbey library, the locked press', 'the infirmary garden under the scriptorium window'],
      brief: 'A brother of the Abbey lies dead under the scriptorium window, and the scriptorium was locked from within. His fingers and tongue are black. The Bishop wants it called a fall by Sunday; the Inquisitor, if he comes, will want it called something else.',
      roles: [
        { role: 'the librarian', motive: 'There is a book in the press that must not be read, and the dead man had read it.' },
        { role: 'a young novice', motive: 'The dead man knew what the novice did at night, and had begun to write it down.' },
        { role: 'the cellarer', motive: 'The Abbey\'s accounts are the cellarer\'s, and the dead man had begun to check them.' },
        { role: 'a visiting scholar', motive: 'Came for one manuscript, and would not leave without it.' },
      ],
      items: [
        { type: 'evidence', label: 'The Black Fingers', text: 'Ink is not the only thing that blackens a scribe\'s hand.', needs: 'bio',
          result: { label: 'The Page Was Poisoned', text: 'The tongue too. He licked his finger to turn a page, and the page was painted. Song Ci\'s needle blackens at the corner of the leaf.', aspects: { forensic: 3 } } },
        { type: 'clue', label: 'The Locked Press', text: 'One press in the library is chained. The key is the librarian\'s, and the librarian\'s alone.', aspects: { opportunity: 1, digital: 1 } },
        { type: 'evidence', label: 'The Last Leaf He Copied', text: 'A Greek text on laughter, half copied, in a hand that starts to shake.', needs: 'lab',
          result: { label: 'The Forbidden Book', text: 'The text is a book the Abbey does not admit to owning. Whoever painted its pages meant to kill whoever read it.', aspects: { digital: 2, motive: 1 } } },
        { type: 'clue', label: 'The Window Bar', text: 'The scriptorium was locked, but one bar of the window is loose, and the garden below is soft.', aspects: { forensic: 1, opportunity: 1 } },
      ],
      witnesses: ['the infirmarian', 'a novice who sleeps badly', 'the Abbey\'s porter'],
      hints: ['Somebody was in the library after compline with a shaded lamp. Nobody is in the library after compline.', 'They asked me what a certain word in Greek meant, and then said forget it.', 'The garden was trodden under the window, before the frost.'],
    },
    witch: {
      label: 'The Witch Mark', title: 'The Drowned Child of {scene}', lesser: 'neglect, not murder', lifetime: 240, difficulty: 7, highProfile: true, council: true,
      keyAspects: ['testimony', 'forensic', 'motive'], districts: ['canal', 'warrens', 'market'],
      charge: { testimony: 3, forensic: 2, motive: 2 },
      scenes: ['the Mill Race', 'the Tanners\' Ditch', 'the Abbey Fishpond'],
      brief: 'A child was taken drowned from {scene}, and by noon the quarter had a name: the midwife, who has a mark on her arm and no husband. The Council wants a burning by Friday. The Carolina wants proof. The child wants somebody to look at the bruises properly.',
      roles: [
        { role: 'the midwife', sex: 'f', motive: 'The quarter has always hated her. That is not a reason, and she knows it, and so do you.' },
        { role: 'the child\'s stepfather', sex: 'm', motive: 'The child was another mouth, and the mother\'s jointure went with the child.' },
        { role: 'a miller\'s apprentice', motive: 'The child saw what the apprentice did at the sluice, and children talk.' },
      ],
      items: [
        { type: 'evidence', label: 'The Child', text: 'Laid out in the Abbey chapel. The quarter has already decided what killed it.', needs: 'bio',
          result: { label: 'Bruises Before the Water', text: 'Song Ci: the drowned have froth at the mouth and water in the belly. This child has neither, and finger-marks on the arms made while it lived.', aspects: { forensic: 3 } } },
        { type: 'clue', label: 'The Witch Mark', text: 'A brown mark on the midwife\'s arm. Half the women in the quarter have one. The quarter has not looked at half the women.', aspects: { testimony: 1 } },
        { type: 'clue', label: 'The Sluice Gate', text: 'Opened that night and not by the miller. Someone wanted the body carried down.', aspects: { opportunity: 2 } },
        { type: 'clue', label: 'Who Gains', text: 'The mother\'s jointure was the child\'s. Now it is somebody else\'s.', aspects: { motive: 2, financial: 1 } },
      ],
      witnesses: ['the miller\'s wife', 'a washerwoman at the race', 'the child\'s older sister'],
      hints: ['The child was afraid of the house, not of the water.', 'I saw a man at the sluice, and it was no woman, whatever they shout in the square.', 'The midwife was at a birth across the city that night, and there are twelve women who will say so, if anyone asks.'],
    },
    highway: {
      label: 'The Highway', title: 'The Robbery on the {scene}', lesser: 'theft, not robbery', lifetime: 240, difficulty: 7,
      keyAspects: ['opportunity', 'testimony', 'financial'], districts: ['docks', 'warrens'],
      charge: { opportunity: 3, testimony: 2, financial: 2 },
      scenes: ['Abbey Road', 'Mill Road', 'Harbour Causeway'],
      brief: 'The Court of Miracles is scattered, and its scattered men have taken to the roads. A carrier was stopped on the {scene} by masked riders and stripped of a strongbox and a passenger\'s rings. They were polite about it. They knew the carrier\'s name.',
      roles: [
        { role: 'a former upright man', motive: 'Had a cellar in the Warrens once. Has a horse and a mask now.' },
        { role: 'the carrier\'s own boy', motive: 'Knew what was in the strongbox and which night it would travel.' },
        { role: 'an innkeeper on the road', motive: 'Keeps the inn where every carrier stops and every stranger drinks.' },
        { role: 'a gentleman of the Hill in debt', motive: 'Rides well, owes much, and is never seen on the roads at night.' },
      ],
      items: [
        { type: 'clue', label: 'The Carrier\'s Docket', text: 'The strongbox was on no docket. Only three people knew it travelled.', aspects: { opportunity: 2, financial: 1 } },
        { type: 'evidence', label: 'The Hoofprints', text: 'One horse throws its off fore. It has been shod in the city.', needs: 'prints',
          result: { names: true, label: 'The Farrier\'s Word', text: 'The farrier by the Harbour gate shod that horse a week ago, and remembers the rider\'s coat.', aspects: { testimony: 2, opportunity: 1 } } },
        { type: 'clue', label: 'The Passenger\'s Rings', text: 'Pledged at a Lombard across the river the next morning by a man in a good coat.', aspects: { financial: 2 } },
        { type: 'clue', label: 'The Polite Robber', text: 'He called the carrier by name and asked after his wife. He has drunk at the carrier\'s inn.', aspects: { testimony: 2 } },
      ],
      witnesses: ['the carrier', 'the passenger', 'a shepherd on the road'],
      hints: ['He sat a horse like a man who was taught, not like a man who stole one.', 'They knew the box was there before the carrier did.', 'The one who gave the orders had a voice from the Warrens under the mask.'],
    },
    contract: {
      label: 'The Contract', title: 'The Killing of {victim}', lesser: 'manslaughter, not murder', lifetime: 260, difficulty: 8,
      keyAspects: ['forensic', 'financial', 'motive'], districts: ['neon', 'uptown', 'docks'],
      charge: { forensic: 2, financial: 3, motive: 2 },
      scenes: ['the lane behind the Red Ox', 'the {last} House stair', 'the Customs House steps'],
      brief: '{victim} was killed with one clean stroke at {scene} by a man who took nothing and ran nowhere. A clean wound is a paid wound. Find the hand, then find the purse that moved it.',
      roles: [
        { role: 'a sender of the Coquille', motive: 'Kills for hire. Has never once been asked why.' },
        { role: 'the victim\'s partner in trade', motive: 'The partnership was worth more to one of them dead.' },
        { role: 'a jilted patrician', motive: 'Wrote three letters, and the third was to somebody in the Stews.' },
        { role: 'the victim\'s brother', sex: 'm', motive: 'Inherits the house, the trade and the quarrel.' },
      ],
      items: [
        { type: 'evidence', label: 'The Wound', text: 'One stroke, from behind, under the ribs.', needs: 'bio',
          result: { label: 'A Practised Hand', text: 'Song Ci: the blade went in flat and turned. That is not anger. That is trade.', aspects: { forensic: 3 } } },
        { type: 'clue', label: 'A Purse Paid in the Stews', text: 'Twelve gulden changed hands at the Red Ox the night before, and the tapster remembers the seal on the purse.', aspects: { financial: 2, testimony: 1 } },
        { type: 'clue', label: 'The Third Letter', text: 'Unsigned, to a man in the Stews, naming a street and an hour.', aspects: { digital: 1, motive: 2 } },
        { type: 'clue', label: 'Nothing Taken', text: 'The purse still on the body, the rings still on the hand. Whoever did this was paid already.', aspects: { motive: 1, forensic: 1 } },
      ],
      witnesses: ['the tapster of the Red Ox', 'a link-boy', 'the victim\'s clerk'],
      hints: ['The man did not run. He walked, like somebody who had done it before.', 'A purse with a good seal on it went across the table the night before.', 'Somebody on the Hill wanted this. The hand was hired; the reason was not.'],
    },
    eumenides: {
      label: 'The Eumenides', title: 'The Brotherhood of St Julian', lifetime: 360, difficulty: 10, special: true, highProfile: true,
      keyAspects: ['digital', 'testimony', 'forensic', 'motive'], districts: ['uptown'],
      charge: { digital: 3, testimony: 2, forensic: 2, motive: 2 },
      scenes: ['the Hospital of St Julian', 'the Brotherhood\'s chapter house on the Hill'],
      brief: 'Two torsos, one hospital door. The Brotherhood of St Julian feeds the poor, endows the Abbey, and sits on half the Council. Behind its chapter house is a room with a drain in the floor. Prove it before the Hill closes ranks.',
      roles: [
        { role: 'the Brotherhood\'s almoner', motive: 'Chooses who is fed at the hospital door, and who is never seen again.' },
        { role: 'a patrician benefactor', motive: 'Founded the hospital. Uses the room behind it.' },
        { role: 'the hospital\'s physician', motive: 'Signs the deaths, and never writes what he saw.' },
      ],
      items: [
        { type: 'evidence', label: 'The Hospital Register', text: 'Admitted, admitted, admitted. Discharged less often than arithmetic allows.', needs: 'lab',
          result: { label: 'The Missing Discharged', text: 'Eleven names admitted and never discharged, never buried, never seen. All young, all poor, all in winter.', aspects: { digital: 3, motive: 1 } } },
        { type: 'evidence', label: 'The Drain', text: 'A room behind the chapter house with a drain in the floor and a smell of lye.', needs: 'bio',
          result: { label: 'What the Drain Kept', text: 'Song Ci\'s test on the stones: blood, and a great deal of it, under the lye.', aspects: { forensic: 3 } } },
        { type: 'clue', label: 'The Ring-mark', text: 'Both torsos wore a ring on the same finger. The Brotherhood gives its beneficiaries a ring.', aspects: { forensic: 1, testimony: 1 } },
        { type: 'clue', label: 'The Porter\'s Word', text: 'The hospital porter has seen the carts leave at night and has been paid, until now, not to count them.', aspects: { testimony: 2, opportunity: 1 } },
      ],
      witnesses: ['the hospital porter', 'a beggar fed at the door', 'a laundress who washes the chapter house linen'],
      hints: ['The carts go out by the Harbour road, after compline, covered.', 'They give the poor a ring and a supper. Nobody who took the ring came back for a second supper.', 'The physician drinks now. He did not, before.'],
    },
    pattern: {
      label: 'The Pattern', title: 'The Girls of {scene}', lesser: 'one death, not all', lifetime: 360, difficulty: 9, highProfile: true, serial: true, victimSex: 'f',
      keyAspects: ['opportunity', 'forensic', 'testimony'], districts: ['neon', 'market', 'warrens'],
      charge: { opportunity: 3, forensic: 2, testimony: 2 },
      scenes: ['the Stews', 'the Market Lanes', 'the Warrens'],
      brief: 'A girl of {scene} found dead in a doorway with her hair cut off and nothing else touched. The second will come, and the third; the city already knows it. Each one leaves a piece of the pattern. Read enough of it to be at the next door before he is.',
      roles: [
        { role: 'a perfumer\'s journeyman', sex: 'm', motive: 'Wants something from them that is not what the Stews sell.' },
        { role: 'a barber of the Market', sex: 'm', motive: 'Cuts hair for a living and has been seen where he should not be.' },
        { role: 'a wool-merchant\'s son', sex: 'm', motive: 'Rides through the Stews at night with a groom and a purse.' },
        { role: 'the spinning-house warden', sex: 'm', motive: 'Keeps the girls locked in by day and knows which walk at night.' },
      ],
      items: [
        { type: 'clue', label: 'The First Door', text: 'Found at dawn in a doorway, hair cut close, nothing else touched. No struggle. She knew him, or did not fear him.', aspects: { forensic: 1, opportunity: 1 }, pattern: true },
        { type: 'evidence', label: 'The Cut Hair', text: 'Cut, not torn. A good blade, and a careful hand.', needs: 'bio',
          result: { label: 'A Barber\'s Cut', text: 'One stroke, close to the scalp, from behind. The hand has done this a thousand times to the living.', aspects: { forensic: 2 } } },
        { type: 'clue', label: 'What Was Not Taken', text: 'Her purse, her ring, her shoes. He wanted the hair, and only the hair.', aspects: { motive: 2 } },
        { type: 'clue', label: 'A Smell of Attar', text: 'Rosewater and something under it, on the doorpost where he leaned.', aspects: { forensic: 1, testimony: 1 } },
      ],
      witnesses: ['a girl who walks the same lane', 'the night soil man', 'a tapster closing up'],
      hints: ['He does not hurry. He walks like a man going home.', 'The girls say a gentle voice asked their names the week before.', 'Always the night after a fair. Always a girl with fair hair.'],
    },
    threedays: {
      label: 'The Three Days', title: 'The Apple in the Chest', lesser: 'a death by misadventure', lifetime: 100, difficulty: 8, highProfile: true, council: true, nSuspects: 4, guiltyRole: 'the husband', victimSex: 'f',
      keyAspects: ['digital', 'testimony', 'opportunity'], districts: ['uptown', 'market'],
      charge: { digital: 2, testimony: 2, opportunity: 2 },
      scenes: ['the Weigh-house', 'the Fish Market', 'the Council Steps'],
      brief: 'A chest bought at auction at {scene} for a hundred gulden, and inside it a young woman cut in pieces. The Council gives you three days\' grace to bring the murderer, and the Council, being the Council, will stretch three days to a fortnight before it comes for you instead. Two men have already confessed. Both are lying, and one of them is lying for the man who did it.',
      roles: [
        { role: 'the husband', sex: 'm', motive: 'Loved her, and believed a story he was told about her, and did not ask.' },
        { role: 'the husband\'s brother', sex: 'm', motive: 'Cannot bear what his brother believes, and would hang for him.' },
        { role: 'a servant boy', sex: 'm', motive: 'Took an apple from a sick woman\'s table and gave it to a man who did not deserve it.' },
        { role: 'a porter of the Market', sex: 'm', motive: 'Was given an apple by a boy and told a lie about where it came from.' },
      ],
      items: [
        { type: 'evidence', label: 'The Apple in the First Hand', text: 'Three apples were bought for a sick woman. One left her table. Whose hand took it?', needs: 'lab',
          result: { label: 'The First Hand', text: 'The boy took it. He says so, when he is asked gently. He gave it to a porter, for a kindness.', aspects: { testimony: 2 } } },
        { type: 'evidence', label: 'The Apple in the Second Hand', text: 'A porter of the Market was seen with an apple he could not have bought.', needs: 'lab',
          result: { label: 'The Second Hand', text: 'The porter, asked, tells the lie he was told: that a woman gave it him, for love. He did not think what the lie would do.', aspects: { testimony: 2, motive: 1 } } },
        { type: 'clue', label: 'The Third Hand', text: 'The husband heard the porter\'s lie in the Market, went home, and did not ask his wife anything. The chest was in the house by evening.', aspects: { opportunity: 2, motive: 2 } },
        { type: 'clue', label: 'The Bill of Sale', text: 'The chest was sold at auction by the man who owned it. He signed his own name.', aspects: { digital: 2, opportunity: 1 } },
      ],
      witnesses: ['the auctioneer', 'the sick woman\'s neighbour', 'a fishwife who saw the chest carried'],
      hints: ['Two men came to the Watch-house on the same morning, each saying he did it, and neither would look at the other.', 'The apples were bought on the Hill, three of them, for a woman who was dying.', 'The husband was not angry when he came home. He was very quiet.'],
    },
    manhunt: {
      label: 'Hue and Cry', title: 'Hue and Cry: {culprit}', lifetime: 200, difficulty: 5, special: true,
      keyAspects: ['opportunity', 'testimony', 'forensic'], districts: ['docks', 'warrens', 'canal', 'neon'],
      charge: { opportunity: 2, testimony: 2, forensic: 1 },
      scenes: ['a Bolt-hole in {district}', 'a Rented Garret in {district}'],
      brief: '{culprit} has been seen again. They walked once. The trail is warm, for now.',
      roles: [{ role: 'the fugitive', motive: 'They know you are coming. They have always known.' }],
      items: [
        { type: 'clue', label: 'A Fresh Sighting', text: 'Seen buying bread two streets over, this morning.', aspects: { opportunity: 2, testimony: 1 } },
        { type: 'evidence', label: 'The Abandoned Garret', text: 'Left in a hurry. A cup on the table.', needs: 'prints',
          result: { label: 'The Hand on the Cup', text: 'The same hand as the one in the Rolls from the first case.', aspects: { forensic: 3 } } },
        { type: 'clue', label: 'The Old Case', text: 'Your notes from the first time round. You were closer than you knew.', aspects: { motive: 2 } },
      ],
      witnesses: ['a landlady', 'a tobacconist'],
      hints: ['Paid a month in advance, in coin. Nervous sort.', 'Comes and goes at night. Never the same street twice.'],
    },
    gang: {
      label: 'A Band', title: 'The Breaking of {gang}', lifetime: 320, difficulty: 9, special: true, highProfile: true, guiltyRole: 'the band\'s upright man',
      keyAspects: ['financial', 'testimony', 'digital', 'opportunity'], districts: ['docks', 'neon', 'warrens'],
      charge: { financial: 3, testimony: 2, digital: 2, opportunity: 2 },
      scenes: ['the Cellar {gang} Drink In', 'a Warehouse {gang} Use'],
      brief: 'Your time in disguise has given you a way in to {gang}. Build a case against their upright man. Solidly. They will buy any sworn man they can.',
      roles: [
        { role: 'the band\'s upright man', motive: 'Built the band out of people you let walk.' },
        { role: 'the band\'s reckoner', motive: 'Keeps the tally, and wants to be upright man.' },
        { role: 'a lieutenant', motive: 'Does the dirty work, and wants the credit.' },
      ],
      items: [
        { type: 'evidence', label: 'The Tally', text: 'Columns of marks, dates, initials.', needs: 'lab',
          result: { label: 'The Tally Read', text: 'Coin in, coin out. Names beside the biggest sums.', aspects: { financial: 3, digital: 1 } } },
        { type: 'clue', label: 'Heard Through the Wall', text: 'Hours of nothing, then five minutes of everything.', aspects: { digital: 2, testimony: 1 } },
        { type: 'clue', label: 'The Meeting', text: 'They meet on market night, in the back cellar, and the upright man always comes last.', aspects: { opportunity: 2 } },
        { type: 'clue', label: 'Your Own Account', text: 'What you saw with your own eyes, written down while it was fresh.', aspects: { testimony: 2 } },
      ],
      witnesses: ['a runner who wants out', 'a tapster who pays protection'],
      hints: ['The upright man never touches the coin. Makes someone else do it.', 'They\'re more frightened of him than of you.'],
    },
    syndicate: {
      label: 'The Coquille', title: 'The Court of Miracles', lifetime: 400, difficulty: 12, special: true, highProfile: true, guiltyRole: 'the King of Thunes',
      keyAspects: ['financial', 'digital', 'testimony', 'motive', 'forensic'], districts: ['warrens'],
      charge: { financial: 3, digital: 3, testimony: 2, motive: 2, forensic: 2 },
      scenes: ['the Court of Miracles, under the Warrens'],
      brief: 'The ledger points under the Warrens, to a cellar where the lame walk and the blind see, and a man they call the King of Thunes sits on a barrel. Make it stick. You will not get a second chance.',
      roles: [
        { role: 'the King of Thunes', motive: 'Owns half the Warrens and rents out the other half.' },
        { role: 'a councillor', motive: 'Seals whatever the Coquille puts in front of him.' },
        { role: 'a respected goldsmith', motive: 'Makes the stolen silver into new silver.' },
      ],
      items: [
        { type: 'evidence', label: 'The Shell\'s Books', text: 'Chests of them.', needs: 'lab',
          result: { label: 'The Hand Behind the Hands', text: 'Every front, peeled back, has the same name at its centre.', aspects: { financial: 3, digital: 2 } } },
        { type: 'clue', label: 'The Reckoner\'s Deposition', text: 'He came to you in the night, terrified, and talked until the bell.', aspects: { testimony: 3, motive: 1 } },
        { type: 'clue', label: 'The Payroll of Silence', text: 'A list of officers on the Coquille\'s payroll. Some of them wear the Watch\'s coat.', aspects: { financial: 2, motive: 2 } },
        { type: 'evidence', label: 'A Bloodied Cloak', text: 'From a killing three years ago that was never answered.', needs: 'bio',
          result: { label: 'The Old Killing', text: 'The blood is a man\'s, and the cloak was bought by one of the men who sit on barrels in the Court.', aspects: { forensic: 3 } } },
      ],
      witnesses: ['a frightened reckoner', 'a ferryman'],
      hints: ['The King never raises his voice. He doesn\'t have to.', 'I rowed them. All of them. I know where they went.'],
    },
    architect: {
      label: 'The Architect', title: 'The Architect', lifetime: 400, difficulty: 11, special: true, highProfile: true,
      keyAspects: ['forensic', 'testimony', 'motive', 'opportunity', 'digital', 'financial'], districts: ['uptown', 'market'],
      charge: { forensic: 2, testimony: 2, motive: 2, opportunity: 2, digital: 2, financial: 2 },
      scenes: ['a Quiet House on the Hill'],
      brief: 'The loose ends all lead to one person: someone who has been drawing crimes for others to commit, and leaving the smallest of signatures. Prove it.',
      roles: [
        { role: 'the respected doctor of laws', motive: 'Lectures on the Carolina at the faculty. Has been conducting experiments.' },
        { role: 'a retired judge of the Blood Court', motive: 'Sentenced the city\'s thieves for thirty years, and learned from every one.' },
        { role: 'the great benefactor', motive: 'Endows the orphanage, the hospital, and everything else.' },
      ],
      items: [
        { type: 'clue', label: 'The Signature', text: 'The same small mark at every scene you ever worked: a folded paper crane.', aspects: { forensic: 2, opportunity: 1 } },
        { type: 'evidence', label: 'The Correspondence', text: 'Letters to a dozen thieves, unsigned.', needs: 'lab',
          result: { label: 'The Letters Read', text: 'Plans. Detailed plans. For crimes you have examined.', aspects: { digital: 2, motive: 2 } } },
        { type: 'clue', label: 'The Payments', text: 'Every one of them was paid, in the same way, from the same purse.', aspects: { financial: 3 } },
        { type: 'clue', label: 'A Convict\'s Deposition', text: 'One of the people you sent down has decided to talk.', aspects: { testimony: 3 } },
      ],
      witnesses: ['a housekeeper', 'a former pupil'],
      hints: ['Such a kind person. They always asked about your cases, Examiner.', 'They kept paper cranes on every windowsill.'],
    },
  };

  // The crimes by rank (js/engine.js casePool): an Examiner gets the plain
  // ones, a Sworn Examiner the deaths and the frauds, a Bailiff the strange
  // and the professional, a Magistrate the rest.
  CF.CASE_TIERS = [['burglary', 'extortion', 'coining', 'arson'], ['missing', 'harbor', 'poison', 'fraud'], ['witch', 'scriptorium', 'contract'], ['threedays']];
  // How often an ordinary case is one the whole city watches, by rank.
  CF.HIGH_PROFILE_CHANCE = [0, 0.08, 0.15, 0.2];
  CF.ORDINARY_CASES = ['burglary', 'missing', 'harbor', 'arson', 'fraud', 'extortion', 'poison', 'coining', 'scriptorium', 'witch', 'contract', 'threedays'];
  // Crimes that arrive on their own clock: the Pattern, once a run, from week six.
  CF.RARE_CASES = ['pattern'];
  // Crimes the city breeds only after the Court of Miracles is scattered.
  CF.LATE_CASES = ['highway'];
})(typeof window !== 'undefined' ? window : globalThis);
