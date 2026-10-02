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
    { id: 'menthol', icon: 'imyst-19', desc: 'Smokes a clay pipe of cheap Dutch tobacco, one bowl after another.',
      clue: { label: 'Pipe Ash on the Sill', text: 'A knocked-out bowl of ash on the windowsill, still sour. Someone waited here a long while, smoking.', aspects: { forensic: 1, opportunity: 1 } } },
    { id: 'limp', icon: 'iev-02', desc: 'Walks with a heavy limp in the left leg.',
      clue: { label: 'A Dragging Footprint', text: 'Prints in the mud of the yard. The left foot drags on every step, leaving a long scuff.', aspects: { forensic: 1, opportunity: 1 } } },
    { id: 'lefty', icon: 'imed-23', desc: 'Left-handed. Writes with a hooked wrist.', who: 'is left-handed, and writes with a hooked wrist.',
      clue: { label: 'A Left-Handed Stroke', text: 'Whoever did this stood on the right and worked with their left hand. The angle is plain to anyone who has seen a butcher.', aspects: { forensic: 2 } } },
    { id: 'van', icon: 'itrade-12', desc: 'Drives a dray with a lame grey mule.',
      clue: { label: 'Grey Hair on the Gatepost', text: 'A rub of grey hair on the gatepost at a mule\'s height, and one hoofprint that lands wrong. Somebody backed a dray in here.', aspects: { forensic: 1, opportunity: 1 } } },
    { id: 'bandage', icon: 'imed-02', desc: 'Has a fresh linen binding wrapped around one hand.',
      clue: { label: 'Blood on the Latch', text: 'A smear of blood on the shutter latch. Someone cut themselves getting in, or getting out.', aspects: { forensic: 2 } } },
    { id: 'sandalwood', icon: 'imyst-08', desc: 'Wears civet and rosewater, like a courtier.',
      clue: { label: 'A Scent in the Room', text: 'Hours later the room still smells, faintly, of civet and rosewater. Not the victim\'s.', aspects: { opportunity: 1, testimony: 1 } } },
    { id: 'debt', icon: 'icrime-10', desc: 'Owes a great deal to a moneylender in the Stews.',
      clue: { label: 'A Torn Bond', text: 'Half a bond, the sum circled twice in red ink. A lender in the Stews signs like that.', aspects: { financial: 1, motive: 1 } } },
    { id: 'boots', icon: 'iev-27', desc: 'Wears great hobnailed boots, a soldier\'s.',
      clue: { label: 'A Hobnail Scar', text: 'A deep gouge at the foot of the door, the kind a hobnailed boot makes. A big boot, and a kick.', aspects: { forensic: 1, opportunity: 1 } } },
    { id: 'licorice', icon: 'imed-06', desc: 'Chews cloves against the toothache, constantly.',
      clue: { label: 'A Chewed Clove', text: 'A clove, chewed flat and spat behind the stove. Somebody with a bad tooth stood here a while.', aspects: { forensic: 1, opportunity: 1 } } },
    { id: 'key', icon: 'iev-25', desc: 'Has had a key to the house for years.',
      clue: { label: 'No Forced Entry', text: 'Not a mark on the locks. Whoever came in had a key, or was let in by someone who trusted them.', aspects: { opportunity: 2 } } },
    { id: 'ring', icon: 'iev-18', desc: 'Never takes off a heavy gold signet.',
      clue: { label: 'A Curved Scratch', text: 'A fresh curved scratch in the wax of the table, the kind a heavy signet leaves on a clenched fist.', aspects: { forensic: 1, opportunity: 1 } } },
    { id: 'ticket', icon: 'iinv-02', desc: 'Has lately paid a carrier for a seat on the wagon to the coast.',
      clue: { label: 'The Carrier\'s Chit', text: 'A carrier\'s chit for a place on Friday\'s wagon to the coast. One way. Someone is planning to leave.', aspects: { opportunity: 1, motive: 1 } } },
    { id: 'ink', icon: 'iev-30', desc: 'Has ink-black fingers; works a printer\'s press.',
      clue: { label: 'An Inked Thumb', text: 'A thumbprint, perfect, in printer\'s ink on the white of the doorframe.', aspects: { forensic: 2 } } },
    { id: 'gambler', icon: 'iev-16', desc: 'Plays at dice every night in a cellar in the Stews.',
      clue: { label: 'A Loaded Die', text: 'A bone die, rolled under the sideboard. Weighted. The dice-cellars in the Stews call them gourds.', aspects: { financial: 1, opportunity: 1 } } },
    // Marks that are heard, sealed or owed.
    { id: 'stammer', icon: 'ilaw-08', desc: 'Stammers on hard consonants; the whole quarter mimics it.',
      clue: { label: 'What the Child Heard', text: 'A child on the stair heard somebody say the name and stick on it, twice.', aspects: { testimony: 2 } } },
    { id: 'seal', icon: 'cwax-04', desc: 'Seals letters with a cracked signet: a bird with half a wing.',
      clue: { label: 'A Cracked Seal', text: 'Wax on the boards by the desk, and in it a bird with half a wing. Not the household\'s.', aspects: { digital: 2 } } },
    { id: 'shell', icon: 'itrade-22', desc: 'Wears a pilgrim\'s cockle-shell on a greasy hat.',
      clue: { label: 'A Shell on the Sill', text: 'A cockle-shell, the Compostela kind, on the sill where a hat was set down.', aspects: { forensic: 1, testimony: 1 } } },
    { id: 'lombard', icon: 'iev-24', desc: 'Has pledged the same coat at the Lombard\'s three times this year.',
      clue: { label: 'A Lombard\'s Chit', text: 'A chit from across the river for a coat, redeemed and pledged again. Somebody lives from Friday to Friday.', aspects: { financial: 2 } } },
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
    stammer: 'They stuck on their words. K-k-, like that.',
    seal: 'They gave the boy a letter. The seal was a bird, broken.',
    shell: 'A shell on the hat, like the pilgrims.',
    lombard: 'They kept feeling for a purse that was not there.',
  };

  // Questioning and street prose that works across cases.
  CF.PROSE = {
    witnessEmpathy: [
      '{witness} talks for an hour. Most of it is about the price of bread. Then, almost as an afterthought: "{hint}"',
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
      'You try {suspect}\'s story. It holds: {alibi}. Strike one name from the casebook.',
    ],
    alibis: ['a night at the Harbour crane with a dozen porters', 'a bed in the Abbey hospital', 'a game of tables with a sergeant of the Watch',
      'a carrier\'s chit stamped two days\' ride away', 'a wedding, and forty guests who remember the dancing', 'a night in the Hole for drunkenness'],
    // What the hours say when an alibi is a lie: one answer for each alibi above, by its text.
    alibiLies: {
      'a night at the Harbour crane with a dozen porters': 'Nobody at the crane remembers them.',
      'a bed in the Abbey hospital': 'The infirmarian\'s book has no bed for them.',
      'a game of tables with a sergeant of the Watch': 'The sergeant was on the wall that night, and says so.',
      'a carrier\'s chit stamped two days\' ride away': 'The chit is stamped. The carrier never saw them.',
      'a wedding, and forty guests who remember the dancing': 'Forty guests remember the dancing. None of them remembers them.',
      'a night in the Hole for drunkenness': 'The gaoler\'s roll has no such name that night.',
    },
    alibiLie: 'Nobody remembers them where they say they were.',
    // What the ballad says the wrong name was really doing: one for each alibi above, by its text.
    alibiTrue: {
      'a night at the Harbour crane with a dozen porters': 'at the Harbour crane all night with a dozen porters',
      'a bed in the Abbey hospital': 'in a bed in the Abbey hospital, and the infirmarian\'s book says so',
      'a game of tables with a sergeant of the Watch': 'at a game of tables with a sergeant of the Watch, who remembers losing',
      'a carrier\'s chit stamped two days\' ride away': 'two days\' ride away, with the carrier\'s chit to prove it',
      'a wedding, and forty guests who remember the dancing': 'dancing at a wedding before forty guests',
      'a night in the Hole for drunkenness': 'in the Hole for drunkenness',
    },
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
      brief: '{victim} came down at prime to find the strongbox empty. Whoever it was came in by {entry}. It was not a crocheteur\'s work, but it was not a nervous man\'s either.',
      // A case from before the structures has no way in of its own.
      varDefaults: { entry: 'the back shutter' },
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
      hints: [{ text: 'I saw someone at the back gate with a sack. I did not see the face. I saw the hurry.' }, { text: 'There was a dray. I didn\'t see the beast, it was dark.' }, { text: 'The dog next door never barked. Never. It knew whoever it was.' }],
      // The written case (docs/DESIGN.md, "The first playable case"). Three
      // threads leave the scene: the way in (body), the neighbour (word)
      // and the money (coin). Any two make a charge. The way in follows the
      // structure: forced (a blade's marks) or opened with a key (the wards).
      // Order matters: the first lead whose needs are met is the one that
      // runs, so the specific ones come before the catch-alls.
      leads: [
        { id: 'scene_key', verb: 'investigate', label: 'Search the Scene', duration: 30, also: ['scene'],
          needs: { structure: ['inside_key', 'quiet_safe'] },
          preview: 'Go in past the beadle. Start at the way they came in and work inwards.',
          gives: [
            { type: 'evidence', key: 'lock', label: 'The Lock Unmarked', text: 'Not a scratch on the wards.', needs: 'bio',
              result: { label: 'The Wards Read', text: 'Wax in the keyhole takes the wards: a key cut new from a borrowed one, by a locksmith who did not ask.', aspects: { forensic: 2, opportunity: 1 } } },
            { type: 'clue', label: 'The Inventory', text: 'What the house says was taken does not match the guild\'s inventory. Someone knew what was worth carrying.', aspects: { financial: 2 } },
          ],
          reveal: 'any', district: true, fatigue: 0.25,
          story: { title: 'At the Scene', text: 'You go in past the beadle. Nothing at {scene} was forced. They came in by {entry}, and shut it again behind them. You come away with {found}.' } },
        { id: 'scene', verb: 'investigate', label: 'Search the Scene', duration: 30,
          needs: { structure: ['rear_window', 'smash_grab', null] },
          preview: 'Go in past the beadle. Start at the way they came in and work inwards.',
          gives: [
            { type: 'evidence', key: 'window', label: 'The Forced Frame', text: 'Marks where they came in: a flat blade.', needs: 'bio',
              result: { label: 'The Blade Read', text: 'The blade was a chisel, chipped at one corner. Find the chisel, find the burglar.', aspects: { forensic: 2, opportunity: 1 } } },
            { type: 'clue', label: 'The Inventory', text: 'What the house says was taken does not match the guild\'s inventory. Someone knew what was worth carrying.', aspects: { financial: 2 } },
          ],
          reveal: 'any', district: true, fatigue: 0.25,
          story: { title: 'At the Scene', text: 'You go in past the beadle at {scene}. They came in by {entry}, and the strongbox stands open like a mouth. You come away with {found}.' } },
        { id: 'prints', verb: 'investigate', label: 'Read the Surfaces', duration: 25, needs: { tags: ['surfaces'], after: ['scene'] },
          preview: 'Vinegar on the way in, the strongbox lid, the latch. Somebody touched all three.',
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
            { type: 'evidence', key: 'ticket', label: 'A Pawnbroker\'s Chit', text: 'A chit from a Lombard across the river, dated the morning after, dropped in the gutter by the back gate.', echoes: 'lombard',
              result: { label: 'Pledged Goods', text: 'A ring from the strongbox was pledged across the river within hours. The Lombard remembers who brought it in: "{seen}"', aspects: { financial: 2, testimony: 1 } } },
          ],
          reveal: 'any',
          story: { title: 'Door to Door', text: 'Around {scene} people are frightened, and frightened people talk. The woman at the casement opposite was at her window past matins. She usually is.' } },
        { id: 'timing', verb: 'investigate', label: 'Go Back Over It', duration: 30, needs: { after: ['scene'], without: ['district', 'tool'] },
          preview: 'Go back over {scene} inch by inch. The first pass never finds everything.',
          gives: [
            { type: 'clue', label: 'The Hours', text: 'The watchman cried two, and the dog was quiet. He cried three, and someone had come in by {entry}. One hour, and they knew the house.', aspects: { opportunity: 2 } },
          ],
          fatigue: 0.25,
          story: { title: 'Back at the Scene', text: 'The night-watchman keeps his hours in his head. Two, quiet. Three, and someone in by {entry}. Somebody knew the house, and somebody was in and out between the bells.' } },
        { id: 'toolmark', verb: 'analyze', label: 'Read the Blade', duration: 25, needs: { item: 'window', tool: 'bio' }, consume: true,
          preview: 'Take a wax cast of the marks, measure the blade, look for the flaw.',
          gives: [{ type: 'clue', label: 'The Blade Read', text: 'The blade was a chisel, chipped at one corner. Find the chisel, find the burglar.', aspects: { forensic: 2, opportunity: 1 } }],
          story: { title: 'The Cast', text: 'The wax shows a chisel, and a chip at one corner that will match exactly one chisel in the city. It is the kind of detail the sworn men like.' } },
        { id: 'wards', verb: 'analyze', label: 'Read the Wards', duration: 25, needs: { item: 'lock', tool: 'bio' }, consume: true,
          preview: 'Press wax into the keyhole and read the wards.',
          gives: [{ type: 'clue', label: 'The Wards Read', text: 'Wax in the keyhole takes the wards: a key cut new from a borrowed one, by a locksmith who did not ask.', aspects: { forensic: 2, opportunity: 1 } }],
          story: { title: 'The Wards', text: 'The wax comes out of the keyhole with the wards on it, sharp as the day they were cut. A new key, from a borrowed one. Some locksmith in the city cut it and did not ask.' } },
        { id: 'print_match', verb: 'analyze', label: 'Match the Hand', duration: 25, needs: { item: 'print', tool: 'prints', suspects: 1 }, consume: true,
          preview: 'Hold the half-hand against every name in the casebook.',
          gives: [{ type: 'clue', label: 'The Hand Matched: {culprit}', text: 'The scar across the thumb on the strongbox lid is {culprit}\'s. Not the owner, not the household. {culprit}.', aspects: { forensic: 3 }, points: 'culprit', noMisread: true }],
          story: { title: 'A Match', kind: 'major', text: 'A scar across the ball of the thumb, and the same scar on a hand you have shaken. The thumb on the strongbox lid belongs to {culprit}.' } },
        { id: 'print_nomatch', verb: 'analyze', label: 'Compare the Hand', duration: 10, needs: { item: 'print', tool: 'prints' }, once: false,
          preview: 'Half a hand is only half a token. You need somebody to hold it against.',
          story: { title: 'Nothing to Compare', text: 'A clean half-hand, and no accused to hold it against. Find an accused first, then bring it back.' } },
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
      // Three written threads beside the scene, so the Writ need not wait on
      // the Apothecary: the ferry's book (with the Harbour's Quarter), the
      // parish register (with Wit, once the scene is searched), and, where
      // they left or never got home, the cellars (with Instinct, after both).
      leads: [
        { id: 'ferry', verb: 'investigate', label: 'The Ferryman\'s Book', duration: 30,
          needs: { aspects: ['district'], when: function (ctx) { var d = ctx.first('district'); return !!d && d.data.district === 'docks'; } },
          preview: 'The ferry keeps a book of who crosses, and the ferryman can read.',
          gives: [
            { type: 'clue', label: 'Crossed at Dusk', text: '{victim} is in the book on the night they went, and under the name, in the same hand, a second fare paid by someone who did not cross.', aspects: { digital: 2, opportunity: 1 } },
          ],
          story: { title: 'The Ferryman\'s Book', text: 'The ferryman licks his thumb and turns back the leaves. {victim} is there, and the fare beneath is the one that matters.' } },
        { id: 'register', verb: 'investigate', label: 'The Parish Register', duration: 20,
          needs: { aspects: ['focus'], when: function (ctx, rec) { return rec.searches > 0; } },
          preview: 'The parish clerk keeps the banns, the burials and the debts of the soul. Read back a month.',
          gives: [
            { type: 'clue', label: 'The Banns Struck', text: 'Banns read for {victim} three Sundays running, and struck through on the fourth.', aspects: { digital: 1, motive: 1 } },
          ],
          story: { title: 'The Parish Register', text: 'The clerk finds the leaf for you. Somebody wanted {victim} married, and somebody wanted it stopped.' } },
        { id: 'cellars', verb: 'investigate', label: 'Search the Cellars', duration: 40,
          needs: { aspects: ['instinct'], after: ['ferry', 'register'], when: function (ctx, rec) { return !!rec.alive; } },
          preview: 'The book and the banns point the same way: under the Stews. Go down with a lantern.',
          gives: [{ type: 'witness', victim: true }],
          set: { foundAlive: true }, reveal: 'culprit', fatigue: 0.5,
          story: { title: 'Alive', kind: 'major', text: 'Behind a door in the bathhouse cellar, thin, filthy and furious, is {victim}. They know exactly who put them there, and they will say it in front of the sworn men.' } },
      ],
      witnesses: ['the neighbour with the cat', 'the tapster at the corner alehouse', 'a ballad-seller'],
      hints: [{ text: 'They quarrelled with someone on the stair. A man or a woman, I couldn\'t say. They sounded like they knew each other.' }, { text: 'They were frightened. They kept looking at the door.' }, { text: 'They told me they were coming into money. Then they said they were leaving the city.' }],
    },
    harbor: {
      label: 'A Death', title: 'The Body at {scene}', lesser: 'manslaughter, not murder', lifetime: 240, difficulty: 7, highProfile: true,
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
      hints: [{ text: 'Two of them were arguing by the bollards, past compline. Then just one.' }, { text: 'I heard a splash. I thought it was a bale. Nobody drops bales at midnight.' }, { text: 'Somebody walked off the quay in a hurry. Big coat. They didn\'t look back.' }],
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
        { type: 'clue', label: 'Moved Stock', text: 'The good stock was carted out of the building the week before. Someone knew.', aspects: { financial: 1, opportunity: 1 } },
        { type: 'evidence', label: 'A Scorched Ledger', text: 'Half-burned, the leaves brittle.', needs: 'lab',
          result: { label: 'The Accounts Recovered', text: 'The leaves that survived show coin leaving the business for months.', aspects: { financial: 3 } } },
      ],
      // The written case. Three threads leave the ashes: the Fire-warden's
      // Count (body: three seats of fire, and the oil), the Lender on the
      // Hill (coin: the bond, and who profits) and the Bucket-chain (word).
      // Any two convict.
      leads: [
        { id: 'scene', verb: 'investigate', label: 'Walk the Ashes', duration: 30,
          preview: 'Go in behind the fire-warden while the beams still tick. Count where it started.',
          gives: [
            { type: 'clue', label: 'The Fire-warden\'s Count', text: 'Three seats of fire: the stair, the counting-room, the store. Fires do not start in three places.', aspects: { forensic: 1, opportunity: 1 } },
            { type: 'evidence', key: 'oil', label: 'The Smell Under the Smoke', text: 'The floor stinks of lamp-oil under the char.', needs: 'bio',
              result: { label: 'The Oil Named', text: 'Rape-oil cut with spirit, a blend sold by one chandler in the Abbey Close.', aspects: { forensic: 2, opportunity: 1 } } },
          ],
          reveal: 'any', district: true, fatigue: 0.25,
          story: { title: 'The Ashes', text: 'The fire-warden walks you through {scene} with a wet cloth over his mouth and stops three times. Here, here and here. You come away with {found}.' } },
        { id: 'oil', verb: 'analyze', label: 'Name the Oil', duration: 25, needs: { item: 'oil', tool: 'bio' }, consume: true,
          preview: 'Scrape the boards, warm the scrapings, and smell what comes off them.',
          gives: [{ type: 'clue', label: 'The Chandler\'s Book', text: 'Rape-oil cut with spirit, a blend one chandler in the Abbey Close sells. His book has three jugs this month, to one buyer: "{seen}"', aspects: { forensic: 2, testimony: 1 }, trait: true }],
          story: { title: 'The Oil', text: 'One chandler sells that blend, and he remembers the three jugs and the one who carried them.' } },
        { id: 'buckets', verb: 'investigate', label: 'Ask the Bucket-chain', duration: 30, needs: { after: ['scene'], without: ['district', 'tool', 'focus'] },
          preview: 'Every man on the bucket-chain saw the building from the front. One of them saw the side.',
          gives: [
            { type: 'clue', label: 'The Side Door', text: 'Somebody came out of the side door before the smoke, walking, not running, and shut it behind them.', aspects: { testimony: 1, opportunity: 1 } },
            { type: 'witness', who: 'a man on the bucket-chain, who was nearest the side door', knows: true },
          ],
          fatigue: 0.25,
          story: { title: 'The Bucket-chain', text: 'The men on the chain all saw the same fire. One of them was at the end by the side door, and saw something before it.' } },
        { id: 'lender', verb: 'investigate', label: 'The Lender on the Hill', duration: 30, needs: { aspects: ['focus'], after: ['scene'] },
          preview: 'The building was pledged. Somebody on the Hill lent the money. Wit reads a lender\'s face.',
          gives: [
            { type: 'evidence', key: 'bond', label: 'A Bond on the Building', text: 'Sealed six weeks ago before a notary on the Hill, for three times what the building was worth.', needs: null,
              result: { label: 'Who Profits by the Fire', text: 'The lender takes the loss if it burns. The payment went to another purse.', aspects: { financial: 2, motive: 1 } } },
          ],
          story: { title: 'The Lender', text: 'The lender on the Hill is very sorry about the fire, and sorrier about the bond. He shows it to you before you ask.' } },
        { id: 'profit', verb: 'analyze', label: 'Read the Bond', duration: 20, needs: { item: 'bond' }, consume: true,
          preview: 'Clause by clause. Who is paid if it burns?',
          gives: [{ type: 'clue', label: 'Who Profits by the Fire', text: 'The lender takes the loss if it burns. The payment went to another purse, and the notary remembers the one who sealed for it: "{seen}"', aspects: { financial: 2, motive: 1 }, trait: true }],
          story: { title: 'The Bond', text: 'A bond for three times the building, sealed six weeks before the fire. Somebody was paid to watch it burn.' } },
      ],
      witnesses: ['a man on the bucket-chain', 'a drunk asleep in the doorway opposite', 'a child who could not sleep'],
      hints: [{ text: 'Someone came out the side door just before the smoke. They weren\'t running. They were walking.' }, { text: 'There was a smell, like a lamp, but strong. An hour before.' }, { text: 'I saw a light in the upper room at matins. There\'s never anyone there at matins.' }],
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
      hints: [{ text: 'There were always suppers. The same people, telling the same stories about the venture.' }, { text: 'I wrote the letters fair. I was told what to write. I didn\'t ask.' }, { text: 'They came in every Friday with a strongbox. Left without it.' }],
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
        { type: 'clue', label: 'The Slashed Awning', text: 'Cut from the street, an hour before the gate bell, when the lane is still busy. They wanted to be seen.', aspects: { opportunity: 1, testimony: 1 } },
        { type: 'clue', label: 'The Victim\'s Account', text: '{victim} tells you everything, hands shaking, and begs you not to write their name down.', aspects: { testimony: 2 } },
      ],
      // The written case. Three threads leave the stall: the Collector's
      // Round (coin: whose purse the tally fills), the Cookshop (word: the
      // woman who counts every face on market day) and the Hand on the
      // Letter (body, and a name). Any two convict.
      leads: [
        { id: 'scene', verb: 'investigate', label: 'Search the Stall', duration: 30,
          preview: 'Start at {victim}\'s stall. Count what was spoiled, and what was left.',
          gives: [
            { type: 'evidence', key: 'tally', label: 'The Collector\'s Round', text: 'Chalked on the back of a broadsheet: market days, stall numbers, sums.', needs: null,
              result: { label: 'Whose Purse It Fills', text: 'The sums on the tally go into one purse on market night, counted on the corner.', aspects: { financial: 2, opportunity: 1 } } },
            { type: 'evidence', key: 'letter', label: 'A Threatening Letter', text: '"Pay or burn." Written left-handed, in a hand that is trying not to be a hand.', needs: 'prints', echoes: 'lefty',
              result: { names: true, label: 'The Hand on the Paper', text: 'Whoever wrote this was careful with the letters and careless with the thumb that held the paper.', aspects: { forensic: 3 } } },
          ],
          reveal: 'any', district: true, fatigue: 0.25,
          story: { title: 'The Stall', text: 'The awning at {scene} hangs in ribbons and the stock is still in the gutter. Pinned under a crate, out of the rain, {victim} kept what they left. You come away with {found}.' } },
        { id: 'round', verb: 'analyze', label: 'Trace the Tally', duration: 20, needs: { item: 'tally' }, consume: true,
          preview: 'Add the sums. Follow them to the purse they fill.',
          gives: [{ type: 'clue', label: 'Whose Purse It Fills', text: 'The sums on the tally go into one purse on market night, counted on the corner, bold as brass. The one who carries it: "{seen}"', aspects: { financial: 2, opportunity: 1 }, trait: true }],
          story: { title: 'The Tally', text: 'Every sum adds to the same total each market day, and the total goes into one purse. The stallholders know who carries it.' } },
        { id: 'cookshop', verb: 'investigate', label: 'Sit in the Cookshop', duration: 30, needs: { after: ['scene'], without: ['district', 'tool'] },
          preview: 'A bowl of pottage by the cookshop window, on market day. Watch who comes for the money.',
          gives: [
            { type: 'clue', label: 'The Cookshop Count', text: 'The woman who keeps the cookshop counts every face on market day. Two came in with the collector, and only one of them ate.', aspects: { testimony: 1, opportunity: 1 } },
            { type: 'witness', who: 'the woman who keeps the cookshop, and counts every face on market day', knows: true },
          ],
          fatigue: 0.25,
          story: { title: 'The Cookshop', text: 'She sets down the bowl and does not ask why the Examiner is eating pottage at her window. She has been waiting a long time for somebody to ask her what she sees from it.' } },
        { id: 'hand', verb: 'analyze', label: 'Match the Hand', duration: 25, needs: { item: 'letter', tool: 'prints', suspects: 1 }, consume: true,
          preview: 'The thumb on the letter, and the hands in the casebook.',
          gives: [{ type: 'clue', label: 'The Hand on the Letter: {culprit}', text: 'The thumb that held the paper is {culprit}\'s. The hand that wrote it tried not to be a hand. The thumb did not try.', aspects: { forensic: 3 }, points: 'culprit', noMisread: true }],
          story: { title: 'The Hand on the Letter', kind: 'major', text: 'A careful hand wrote "Pay or burn". A careless thumb held the paper. The thumb is {culprit}\'s.' } },
        { id: 'letter_nomatch', verb: 'analyze', label: 'Read the Hand', duration: 10, needs: { item: 'letter', tool: 'prints' }, once: false,
          preview: 'A thumb on the paper, and nobody to hold it against.',
          story: { title: 'Nobody to Hold It Against', text: 'A clean thumb on the letter, and no accused to hold it against. Find an accused first, then bring it back.' } },
      ],
      witnesses: ['a frightened stallholder', 'a carrier\'s boy', 'the woman who keeps the cookshop'],
      hints: [{ text: 'He comes on market day. Always market day. He talks like a sergeant.', role: 'a sergeant of the Watch' }, { text: 'They count the money on the corner, bold as brass.' }, { text: 'There are two of them. One talks, one watches.' }],
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
      // The written leads give the supper table; the generic search draws
      // from the structure, the generic pool and the trait token afterwards.
      items: [],
      witnesses: ['the kitchen maid', 'the apothecary\'s boy', 'a guest at the supper'],
      hints: [{ text: 'They sent the eels back and asked for the other dish. The one nobody else had.' }, { text: 'Someone came for a paper of powder for the rats. We have no rats.' }, { text: 'They laughed all through supper. At the end they said they felt cold.' }],
      // The written case. Three threads leave the supper table: the Needle
      // (body), the Book (writ, and a name) and the Jointure (coin). Any two
      // convict before a Bailiff's Court. Order matters: the first lead whose
      // needs are met is the one that runs.
      leads: [
        { id: 'scene', verb: 'investigate', label: 'Search the Scene', duration: 30,
          preview: 'Go up past the weeping maid. Start at the cup.',
          gives: [
            { type: 'evidence', key: 'cup', label: 'The Supper Cup', text: 'Rinsed, but not well.', needs: 'bio',
              result: { label: 'The Needle Blackens', text: 'Silver into the dregs, out black. Ratsbane, and a great deal of it.', aspects: { forensic: 3 } } },
            { type: 'evidence', key: 'settlement', label: 'The Settlement', text: 'Sealed a month ago before a notary on the Hill. Nobody in the house will say what it leaves to whom.', needs: null,
              result: { label: 'The Jointure Read', text: 'Sealed a month ago before a notary on the Hill. It leaves one person very comfortable, and it was drawn the week the physician first called.', aspects: { financial: 2, motive: 1 } } },
            { type: 'clue', label: 'The Physician\'s Note', text: '"A surfeit of eels." Written before he had seen the body, and paid for before he had written it.', aspects: { motive: 1, testimony: 1 } },
          ],
          reveal: 'any', district: true, fatigue: 0.25,
          story: { title: 'At the Supper', text: 'You go up past the weeping maid at {scene}. The bed has been stripped and the cup has been rinsed, but not well. You come away with {found}.' } },
        { id: 'dish', verb: 'investigate', label: 'Ask the Kitchen', duration: 30, needs: { after: ['scene'], without: ['district', 'tool', 'focus'] },
          preview: 'Down to the kitchen. The cook remembers every dish, and who ate it.',
          gives: [
            { type: 'clue', label: 'The Pears', text: 'Eels for the table, and one dish of stewed pears for {victim} alone. Whoever seasoned the pears knew the habits of the house.', aspects: { opportunity: 2 } },
          ],
          fatigue: 0.25,
          story: { title: 'The Kitchen', text: 'The cook remembers every dish and who ate it. One dish went to one plate.' } },
        { id: 'canvass', verb: 'investigate', label: 'Go Door to Door', duration: 30, needs: { aspects: ['district'], sameDistrict: true },
          preview: 'Every apothecary keeps a poison book. Start at the Sign of the Pestle.',
          gives: [
            { type: 'witness', who: 'the apothecary\'s boy, who sweeps the Sign of the Pestle', knows: true },
            { type: 'evidence', key: 'book', label: 'The Poison Book', text: 'Every apothecary in the city must keep one. This one has a leaf cut out.', needs: 'lab',
              result: { label: 'The Cut Leaf', text: 'A leaf cut out, and the leaf beneath took the impress of the pen: a date, three drams, and half a name.', aspects: { digital: 2 } } },
          ],
          story: { title: 'The Sign of the Pestle', text: 'Every apothecary keeps a poison book. This one has lost a leaf, and the boy who sweeps the shop saw who bought what.' } },
        { id: 'leaf_match', verb: 'analyze', label: 'Read the Leaf', duration: 25, needs: { item: 'book', tool: 'lab', suspects: 1 }, consume: true,
          preview: 'The impress under the glass, and the names in the casebook beside it.',
          gives: [{ type: 'clue', label: 'The Name on the Leaf: {culprit}', text: 'The impress reads whole under the glass. Three drams of white arsenic, sold on the Tuesday, to {culprit}.', aspects: { digital: 2, forensic: 1 }, points: 'culprit', noMisread: true }],
          story: { title: 'The Leaf', kind: 'major', text: 'The impress reads whole under the glass. Three drams of white arsenic, sold on the Tuesday, to {culprit}. The boy remembers the hand that signed.' } },
        { id: 'leaf_nomatch', verb: 'analyze', label: 'Read the Leaf', duration: 10, needs: { item: 'book', tool: 'lab' }, once: false,
          preview: 'Half a name is only half a token. You need somebody to hold it against.',
          story: { title: 'Half a Name', text: 'Half a name and nobody to hold it against. Find an accused first.' } },
        { id: 'table', verb: 'investigate', label: 'Ask the Kitchen Maid', duration: 25, needs: { aspects: ['focus'], after: ['scene'] },
          preview: 'The kitchen maid talks once the cook is out of the room. Wit keeps her talking.',
          gives: [{ type: 'clue', label: 'The Table', text: 'The kitchen maid remembers who sent the eels back and who watched the pears being eaten: "{seen}"', aspects: { testimony: 1, motive: 1 }, trait: true }],
          story: { title: 'The Maid', text: 'The kitchen maid talks once the cook is out of the room. She watched the table. "{seen}"' } },
        { id: 'jointure', verb: 'analyze', label: 'Read the Jointure', duration: 20, needs: { item: 'settlement' }, consume: true,
          preview: 'Clause by clause. Somebody is very comfortable now.',
          gives: [{ type: 'clue', label: 'The Jointure Read', text: 'Sealed a month ago before a notary on the Hill. It leaves one person very comfortable, and it was drawn the week the physician first called.', aspects: { financial: 2, motive: 1 } }],
          story: { title: 'The Notary\'s Hand', text: 'A jointure, sealed a month ago, drawn the week the physician first called.' } },
      ],
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
      // The written leads give the takings; the generic search draws from
      // the structure, the generic pool and the trait token afterwards.
      items: [],
      // The written case. Three threads leave the takings: the Coin (body, or
      // coin by the scale), the Charcoal (presence, and the kindling boy's
      // word) and the Market (the market-woman, the mould and the thumb on
      // it). Any two convict. Order matters: the first lead whose needs are
      // met is the one that runs.
      leads: [
        { id: 'scene', verb: 'investigate', label: 'Count the Takings', duration: 30,
          preview: 'Start where the bad coin was taken. Count the takings again.',
          gives: [
            { type: 'evidence', key: 'coin', label: 'The Bad Coin', text: 'A handful of it. Bright where it should be worn.', needs: 'bio',
              result: { label: 'The Coin Assayed', text: 'The apothecary\'s acid finds lead under the silver, and the same flaw in the Emperor\'s eye on every piece. One die.', aspects: { forensic: 3 } } },
            { type: 'clue', label: 'Who Paid It In', text: '{victim} keeps a slate of who paid in silver. Three names this week paid in new coin.', aspects: { financial: 1, opportunity: 1 } },
          ],
          reveal: 'any', district: true, fatigue: 0.25,
          story: { title: 'The Takings', text: 'You tip the takings onto the counter at {scene} and bite every third coin. The bad ones are too bright, too light, and every one has the same squint in the Emperor\'s eye. You come away with {found}.' } },
        { id: 'charcoal', verb: 'investigate', label: 'Follow the Charcoal', duration: 30, needs: { after: ['scene'], without: ['district', 'tool'] },
          preview: 'A furnace eats charcoal. Somebody sold it.',
          gives: [
            { type: 'clue', label: 'Sacks After Curfew', text: 'The kindling boy sold three sacks of charcoal a night for a week, carried in by the back lane and paid for in new coin. Nobody bakes that much.', aspects: { opportunity: 2 } },
            { type: 'witness', who: 'the kindling boy, who carried the sacks', knows: true },
          ],
          fatigue: 0.25,
          story: { title: 'The Charcoal', text: 'The boy has never been asked a question by a sworn man and answers all of them twice.' } },
        { id: 'canvass', verb: 'investigate', label: 'Go Door to Door', duration: 30, needs: { aspects: ['district'], sameDistrict: true },
          preview: 'Ask the Market who was paid in it. Somebody has not forgiven it.',
          gives: [
            { type: 'witness', who: 'a market-woman who was paid in it, and has not forgiven it', knows: true },
            { type: 'evidence', key: 'mould', label: 'A Plaster Mould', text: 'Broken in half in a midden.', needs: 'prints',
              result: { names: true, label: 'The Mould Read', text: 'Vinegar brings up the hand that pressed the plaster: a thumb, and a missing nail.', aspects: { forensic: 2, opportunity: 1 } } },
          ],
          reveal: 'any',
          story: { title: 'Door to Door', text: 'Half the Market was paid in it, and the half that was paid wants a name. In a midden behind {scene}, a mould broken in two.' } },
        { id: 'weigh', verb: 'analyze', label: 'Weigh the Coin', duration: 20, needs: { item: 'coin', when: function (ctx) { return !ctx.e.hasTool(ctx, 'bio'); } }, consume: true,
          preview: 'No acid, but a good scale. Weigh it against the Mint\'s standard.',
          gives: [{ type: 'clue', label: 'Short Weight', text: 'Against the Mint\'s standard each piece is light by a grain and a half: a clipper\'s harvest melted down and passed again.', aspects: { financial: 2, digital: 1 } }],
          story: { title: 'The Scale', text: 'A grain and a half light, every piece. Somebody is melting clippings and passing them again.' } },
        { id: 'clippings', verb: 'analyze', label: 'Match the Thumb', duration: 25, needs: { item: 'mould', tool: 'prints', suspects: 1 }, consume: true,
          preview: 'The thumb in the plaster, and the hands in the casebook.',
          gives: [{ type: 'clue', label: 'The Thumb Matched: {culprit}', text: 'A thumb with a missing nail pressed the plaster, and {culprit} is missing that nail.', aspects: { forensic: 3 }, points: 'culprit', noMisread: true }],
          story: { title: 'The Thumb', kind: 'major', text: 'The thumb in the plaster has no nail. Neither has {culprit}\'s.' } },
        { id: 'mould_nomatch', verb: 'analyze', label: 'Read the Mould', duration: 10, needs: { item: 'mould', tool: 'prints' }, once: false,
          preview: 'A thumb with no nail, and nobody to hold it against.',
          story: { title: 'Nobody to Hold It Against', text: 'A thumb with no nail, and no accused to hold it against. Find an accused first, then bring it back.' } },
      ],
      witnesses: ['the Mintmaster\'s assayer', 'a market-woman who was paid in it', 'a boy who sells kindling'],
      hints: [{ text: 'They paid in new coin. Too new. Nobody in the Market has new coin.' }, { text: 'I sold them charcoal three nights running. Sacks of it. Nobody bakes that much.' }, { text: 'Their fingers were burned. Little burns, all over, like a cook\'s.' }],
    },

    // The receiver of stolen goods, opened from a Thread on his door (js/systems/network.js).
    receiver: {
      label: 'The Receiver', title: 'The Receiver at {scene}', lesser: 'receiving, not theft', lifetime: 300, difficulty: 7, special: true, guiltyRole: 'the receiver',
      keyAspects: ['financial', 'testimony', 'opportunity'], districts: ['market'],
      charge: { financial: 3, testimony: 2, opportunity: 2 },
      scenes: ['{last}\'s Pawnshop'],
      brief: 'Two of your cases went through one door: {scene}. What is stolen in the city is sold there, and the man who keeps it buys without asking. Prove he knew.',
      roles: [
        { role: 'the receiver', sex: 'm', motive: 'Buys what the city steals, and sells it back to the city.' },
        { role: 'the receiver\'s wife', sex: 'f', motive: 'Keeps the book of what came in, in her own hand.' },
        { role: 'his journeyman', sex: 'm', motive: 'Carries the goods out by the back lane, and is paid by the piece.' },
      ],
      items: [
        { type: 'clue', label: 'The Back-room Book', text: 'Every piece that came in, and from whom, in a careful hand. Some of the names are your cases.', aspects: { financial: 2, digital: 1 } },
        { type: 'evidence', label: 'A Ring from Your Case', text: 'A ring on the back-room shelf that a victim of yours described to the letter.', needs: null,
          result: { label: 'The Ring Known', text: 'The victim knows the ring, and the receiver knows who brought it in. He paid a third of its worth.', aspects: { testimony: 2, financial: 1 } } },
        { type: 'clue', label: 'The Back Lane', text: 'A handcart in the back lane after the bell, and the gate oiled.', aspects: { opportunity: 2 } },
        { type: 'clue', label: 'Paid Under Weight', text: 'He pays a third of what a thing is worth, by weight, in old coin, and says nothing.', aspects: { financial: 1, testimony: 1 } },
      ],
      witnesses: ['a thief who sold to him once', 'the woman at the next stall', 'a carter who uses the back lane'],
      hints: [{ text: 'He never asks where a thing came from. He asks what it weighs.', role: 'the receiver' }, { text: 'The back gate opens after the bell, and a handcart goes in.' }, { text: 'His wife writes everything down. He does not know she does.' }],
    },
    // A Market crime for a new Examiner: a drilled pound weight.
    weights: {
      label: 'False Weights', title: 'The Light Pound of {scene}', lesser: 'short measure, not fraud', lifetime: 240, difficulty: 5,
      keyAspects: ['financial', 'forensic', 'testimony'], districts: ['market'],
      charge: { financial: 2, forensic: 2, testimony: 2 },
      scenes: ['the Weigh-house', '{last}\'s Grain Stall', 'the Salt Market'],
      brief: 'The Market Warden had {victim}\'s pound weight tried against the Mint\'s standard and found it a quarter-ounce light. {victim} swears the weight was true at Easter. Somebody drilled it, and somebody has been buying by it.',
      roles: [
        { role: 'the weigh-master\'s deputy', sex: 'm', motive: 'Is paid by the grain factors, and has lately bought a mule.' },
        { role: 'a grain factor', motive: 'Buys by the light pound and sells by the true one.' },
        { role: 'a rival stallholder', sex: 'f', motive: 'Lost her best customers to the stall at Candlemas.' },
        { role: 'the Warden\'s runner', motive: 'Carries the weights to the Mint and back, alone.' },
      ],
      items: [
        { type: 'evidence', label: 'The Pound Weight', text: 'Stamped with the city\'s eagle. It rings a little wrong on the counter.', needs: 'bio',
          result: { label: 'The Weight Opened', text: 'Lead drilled from under the stamp and the hole stopped with wax. A careful hand, and a small drill.', aspects: { forensic: 3 } } },
        { type: 'clue', label: 'The Factor\'s Book', text: 'Bought by the pound on the Market\'s scale, sold by the pound at the Harbour. The two pounds are not the same.', aspects: { financial: 2 } },
        { type: 'clue', label: 'Flour in the Scale Pan', text: 'The pan was cleaned, all but the hinge.', aspects: { forensic: 1, opportunity: 1 } },
        { type: 'clue', label: 'The Short Sack', text: 'A miller\'s wife weighed her flour again at home. A quarter-ounce short in every pound, every week since Easter.', aspects: { testimony: 2 } },
      ],
      witnesses: ['a miller\'s wife', 'the salt-seller', 'a boy who sweeps the weigh-house'],
      hints: [{ text: 'The weights go to the Mint and back in a basket. Nobody watches the basket.' }, { text: 'Somebody bought a little drill from the clockmaker. For fine work, he said.' }, { text: 'The factor pays somebody behind the weigh-house on market day, in coin, and does not count it.' }],
    },
    // A death the searchers of the dead called plague.
    searchers: {
      label: 'The Searchers', title: 'A Plague Death in {scene}', lesser: 'a hidden death, not murder', lifetime: 260, difficulty: 7,
      keyAspects: ['forensic', 'testimony', 'opportunity'], districts: ['warrens', 'canal'],
      charge: { forensic: 3, testimony: 2, opportunity: 2 },
      scenes: ['{last} Row', 'the Tenement by the Abbey Wall', 'the Room over {last}\'s Shop'],
      brief: 'The searchers of the dead wrote "plague" against {victim}\'s name, and the cart took the body before noon. But the searchers were paid twice that day, and plague does not leave a bruise the shape of a thumb.',
      roles: [
        { role: 'the searcher', sex: 'f', motive: 'Is paid fourpence a body by the parish, and more by the family.' },
        { role: 'the heir', motive: 'Inherits the lease the day the red cross comes down.' },
        { role: 'the landlord', motive: 'Wanted the room, and the plague clears a room.' },
        { role: 'a barber-surgeon', sex: 'm', motive: 'Bled the dead one on the Monday and has not been seen since.' },
      ],
      items: [
        { type: 'evidence', label: 'The Body at the Pit', text: 'Lime on it already, and the bearers in a hurry.', needs: 'bio',
          result: { label: 'Not the Plague', text: 'No buboes, no tokens on the skin. Thumbs, on the throat. Song Ci would have known it from the door.', aspects: { forensic: 3 } } },
        { type: 'clue', label: 'The Red Cross Painted Early', text: 'The cross on the door is dry. It was painted before the searchers came.', aspects: { opportunity: 2 } },
        { type: 'clue', label: 'The Bill of Mortality', text: 'Two plague deaths in the parish this week, and one of them walked to Mass on Sunday.', aspects: { digital: 1, testimony: 1 } },
        { type: 'clue', label: 'Fourpence Twice', text: 'The parish paid the searcher fourpence for the body. Somebody paid her a gulden for the word.', aspects: { testimony: 1, financial: 1 } },
      ],
      witnesses: ['the bearer who drove the cart', 'a neighbour across the court', 'the parish clerk'],
      hints: [{ text: 'The cart came before noon. It never comes before noon.' }, { text: 'There was shouting in that room on the Sunday. Plague does not shout.' }, { text: 'The searcher went in and came out again in the time it takes to say a Paternoster.', role: 'the searcher' }],
    },
    // A Magistrate's crime: the Mint itself strikes light.
    mint: {
      label: 'The Mint', title: 'The Light Gulden of {scene}', lesser: 'false account, not coining', lifetime: 280, difficulty: 8, council: true,
      keyAspects: ['financial', 'digital', 'forensic'], districts: ['uptown'],
      charge: { financial: 3, digital: 2, forensic: 2 },
      scenes: ['the Mint', 'the Assay Office', 'the {last} Counting-house'],
      brief: 'At the Trial of the Pyx the Mint\'s own coins were weighed against the city\'s standard before the Council, and every one was light. Not clipped, not worn: struck light, under the city\'s eagle. The Mint\'s warden, {victim}, has asked for the Watch, which is brave of a warden. The Council wants it answered quietly, before the Emperor hears.',
      roles: [
        { role: 'the Mint\'s assayer', motive: 'Weighs every melt alone, and signs for it.' },
        { role: 'the die-cutter', motive: 'Cuts the dies, and keeps the old ones he was told to break.' },
        { role: 'the Mintmaster\'s wife', sex: 'f', motive: 'Keeps a house on the Hill above the Mintmaster\'s salary.' },
        { role: 'a silver merchant', motive: 'Sells the Mint its silver, and buys back what it does not use.' },
      ],
      items: [
        { type: 'evidence', label: 'The Trial of the Pyx', text: 'Twelve coins from the Mint\'s own box, sealed by the Council.', needs: 'lab',
          result: { label: 'The Pyx Weighed', text: 'Twelve coins from the Mint\'s own box against the city\'s standard: every one a grain light, the same grain.', aspects: { financial: 2, forensic: 1 } } },
        { type: 'evidence', label: 'The Die-Cutter\'s Ledger', text: 'Dies cut, dies broken, in a neat hand.', needs: null,
          result: { label: 'Two Dies Never Broken', text: 'Every die is entered twice: cut, and broken before the Council. Two are entered once.', aspects: { digital: 3 } } },
        { type: 'clue', label: 'Silver Bought After Curfew', text: 'Silver came in by the river gate after the bell, and the Mint\'s book has no line for it.', aspects: { financial: 2, digital: 1 } },
        { type: 'evidence', label: 'The Assay Scales, Filed', text: 'The Mint\'s own scales. One arm is brighter than the other.', needs: 'bio',
          result: { label: 'The Beam Read', text: 'A file has taken a hair off one arm of the beam. The scales weigh true for silver going out and false for silver coming in.', aspects: { forensic: 3 } } },
      ],
      witnesses: ['a Mint apprentice', 'the river-gate keeper', 'the Mintmaster\'s cook'],
      hints: [{ text: 'The assayer weighs alone. The Mintmaster made that rule, and then forgot it.' }, { text: 'A boat comes to the river gate after the bell, and nobody writes it down.' }, { text: 'The die-cutter drinks better wine than a die-cutter.', role: 'the die-cutter' }],
    },
    // A Magistrate's crime: a house asleep, and a hanged man's hand gone from the gibbet.
    gloryhand: {
      label: 'The Hand of Glory', title: 'A Hand of Glory at {scene}', lesser: 'theft, not burglary by witchcraft', lifetime: 260, difficulty: 8, heresy: true,
      keyAspects: ['forensic', 'opportunity', 'testimony'], districts: ['uptown', 'market', 'canal'],
      charge: { forensic: 3, opportunity: 2, testimony: 2 },
      scenes: ['the {last} House', '{last} the Goldsmith\'s', 'the Abbey Guest-house'],
      brief: 'Every soul in {victim}\'s house slept through the night like the dead, the dogs too, and in the morning the plate was gone. On the sill, a stub of candle in a ring of grease. On the Ravenstone gibbet, a hanged man is missing his right hand. The Dominicans call it witchcraft. A thief calls it a Hand of Glory.',
      roles: [
        { role: 'the executioner\'s knecht', sex: 'm', motive: 'Cuts down the hanged for the pit, and is paid by the piece for what the pit does not need.' },
        { role: 'an apothecary', motive: 'Sells mandrake and poppy by the ounce, and asks nothing.' },
        { role: 'a housebreaker of the Stews', motive: 'Breaks houses, and believes what the old thieves told him.' },
        { role: 'a maidservant of the house', sex: 'f', motive: 'Mixed the household\'s posset that night, and nobody else touched it.' },
      ],
      items: [
        { type: 'evidence', label: 'The Candle-Stub in the Hand', text: 'Grey tallow in a ring of grease on the sill. It smells sweet.', needs: 'bio',
          result: { label: 'Fat and Poppy', text: 'Song Ci would not believe in the hand. He would believe the candle: tallow cut with poppy and henbane, enough to keep a house asleep in a shut room.', aspects: { forensic: 3 } } },
        { type: 'clue', label: 'The Gibbet Ladder', text: 'A ladder left against the Ravenstone gibbet, with the mud of the Stews on the rungs.', aspects: { opportunity: 2 } },
        { type: 'clue', label: 'Mandrake Sold by the Ounce', text: 'The apothecary\'s poison book: mandrake and poppy, three ounces, the week before. A name in a bad hand.', aspects: { testimony: 1, forensic: 1 } },
        { type: 'clue', label: 'The Posset', text: 'The household drank its posset at nine and slept by ten. The cook says it was bitter.', aspects: { testimony: 2 } },
      ],
      witnesses: ['the night-watchman on the Hill', 'the hangman\'s boy', 'the cook of the house'],
      hints: [{ text: 'There was a light in the window, and nobody holding it.' }, { text: 'Somebody climbed the Ravenstone after the gate shut. The crows were up.' }, { text: 'He bought poppy enough to put a regiment to sleep, and said it was for his teeth.' }],
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
      hints: [{ text: 'Somebody was in the library after compline with a shaded lamp. Nobody is in the library after compline.' }, { text: 'They asked me what a certain word in Greek meant, and then said forget it.' }, { text: 'The garden was trodden under the window, before the frost.' }],
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
      hints: [{ text: 'The child was afraid of the house, not of the water.' }, { text: 'I saw a man at the sluice, and it was no woman, whatever they shout in the square.' }, { text: 'The midwife was at a birth across the city that night, and there are twelve women who will say so, if anyone asks.' }],
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
        { type: 'clue', label: 'The Passenger\'s Rings', text: 'Pledged at a Lombard across the river the next morning by a man in a good coat.', aspects: { financial: 2 }, echoes: 'lombard' },
        { type: 'clue', label: 'The Polite Robber', text: 'He called the carrier by name and asked after his wife. He has drunk at the carrier\'s inn.', aspects: { testimony: 2 } },
      ],
      witnesses: ['the carrier', 'the passenger', 'a shepherd on the road'],
      hints: [{ text: 'He sat a horse like a man who was taught, not like a man who stole one.', role: 'a gentleman of the Hill in debt' }, { text: 'They knew the box was there before the carrier did.' }, { text: 'The one who gave the orders had a voice from the Warrens under the mask.', role: 'a former upright man' },
        { text: 'They were polite. Nobody who has ever been hungry is that polite with a pistol.' }],
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
      hints: [{ text: 'The man did not run. He walked, like somebody who had done it before.' }, { text: 'A purse with a good seal on it went across the table the night before.' }, { text: 'Somebody on the Hill wanted this. The hand was hired; the reason was not.' }],
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
      hints: [{ text: 'The carts go out by the Harbour road, after compline, covered.' }, { text: 'They give the poor a ring and a supper. Nobody who took the ring came back for a second supper.' }, { text: 'The physician drinks now. He did not, before.' }],
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
        { type: 'clue', label: 'A Smell of Attar', text: 'Rosewater and something under it, on the doorpost where he leaned.', aspects: { forensic: 1, testimony: 1 }, echoes: 'sandalwood' },
      ],
      witnesses: ['a girl who walks the same lane', 'the night soil man', 'a tapster closing up'],
      hints: [{ text: 'He does not hurry. He walks like a man going home.' }, { text: 'The girls say a gentle voice asked their names the week before.' }, { text: 'Always the night after a fair. Always a girl with fair hair.' }],
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
      hints: [{ text: 'Two men came to the Watch-house on the same morning, each saying he did it, and neither would look at the other.' }, { text: 'The apples were bought on the Hill, three of them, for a woman who was dying.' }, { text: 'The husband was not angry when he came home. He was very quiet.' }],
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
      hints: [{ text: 'Paid a month in advance, in coin. Nervous sort.' }, { text: 'Comes and goes at night. Never the same street twice.' }],
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
      hints: [{ text: 'The upright man never touches the coin. Makes someone else do it.' }, { text: 'They\'re more frightened of him than of you.' }],
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
      hints: [{ text: 'The King never raises his voice. He doesn\'t have to.' }, { text: 'I rowed them. All of them. I know where they went.' }],
    },
    // The Harbourmaster's own case: two leaves from the Customs House, read
    // in Rest (js/data/recipes.js ref_customs). The guilty is the Harbourmaster
    // or his clerk (the recipe says which); convicting the Harbourmaster
    // himself ends his examiners for good.
    harbourmaster: {
      label: 'The Harbourmaster', title: 'The Harbourmaster\'s Books', lesser: 'false entry, not theft from the city', lifetime: 360, difficulty: 10, special: true, highProfile: true, council: true, councilRole: 'the Harbourmaster',
      keyAspects: ['financial', 'digital', 'testimony', 'opportunity'], districts: ['docks'],
      charge: { financial: 3, digital: 2, testimony: 2, opportunity: 1 },
      scenes: ['the Customs House on the Harbour'],
      brief: 'Two leaves from the Customs House, in one hand: what the Harbourmaster paid his examiners, and for what. The cargo on his books never landed. Prove where it went.',
      roles: [
        { role: 'the Harbourmaster', motive: 'Wants the Council to need him, and the Watch to answer to the Customs House.' },
        { role: 'the Harbourmaster\'s clerk', motive: 'Keeps both sets of books, and is paid for one.' },
        { role: 'the customs searcher', motive: 'Searches the ships he is told to search, and not the others.' },
      ],
      items: [
        { type: 'clue', label: 'Cargo Never Landed', text: 'Forty bales of English cloth on the books, cleared and taxed. No crane on the quay lifted them.', aspects: { digital: 2, opportunity: 1 } },
        { type: 'clue', label: 'The Examiner\'s Purse', text: 'The purse the Customs House paid its examiners from, and the false entries that filled it.', aspects: { financial: 3, motive: 1 } },
        { type: 'clue', label: 'The Crane-Master\'s Deposition', text: 'He lifted nothing that night, and was paid for it all the same.', aspects: { testimony: 3, opportunity: 1 } },
      ],
      witnesses: ['a tally-man', 'a customs boatman', 'a quay porter'],
      hints: [{ text: 'The clerk takes the books home at night. Both sets.' }, { text: 'The Harbourmaster dines with half the Council, and pays for the wine.' }, { text: 'Nothing was lifted that night. I was on the crane.' }],
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
        { type: 'clue', label: 'The Signature', text: 'The same small mark cut at every scene you ever worked: three strokes, a mason\'s mark, where the crime began.', aspects: { forensic: 2, opportunity: 2 } },
        { type: 'evidence', label: 'The Correspondence', text: 'Letters to a dozen thieves, unsigned.', needs: 'lab',
          result: { label: 'The Letters Read', text: 'Plans. Detailed plans. For crimes you have examined.', aspects: { digital: 2, motive: 2 } } },
        { type: 'clue', label: 'The Payments', text: 'Every one of them was paid, in the same way, from the same purse.', aspects: { financial: 3 } },
        { type: 'clue', label: 'A Convict\'s Deposition', text: 'One of the people you sent down has decided to talk.', aspects: { testimony: 3 } },
      ],
      witnesses: ['a housekeeper', 'a former pupil'],
      hints: [{ text: 'Such a kind person. They always asked about your cases, Examiner.' }, { text: 'They kept a mason\'s square on the desk and never built anything.' }],
    },
  };

  // The crimes by rank (js/engine.js casePool): an Examiner gets the plain
  // ones, a Sworn Examiner the deaths and the frauds, a Bailiff the strange
  // and the professional, a Magistrate the rest.
  CF.CASE_TIERS = [['burglary', 'extortion', 'coining', 'arson', 'weights'], ['missing', 'harbor', 'poison', 'fraud', 'searchers'], ['witch', 'scriptorium', 'contract'], ['threedays', 'mint', 'gloryhand']];
  // How often an ordinary case is one the whole city watches, by rank.
  CF.HIGH_PROFILE_CHANCE = [0, 0.08, 0.15, 0.2];
  CF.ORDINARY_CASES = ['burglary', 'missing', 'harbor', 'arson', 'fraud', 'extortion', 'poison', 'coining', 'scriptorium', 'witch', 'contract', 'threedays', 'weights', 'searchers', 'mint', 'gloryhand'];
  // The written mysteries with one answer: sent once a run (js/engine.js casePool, s.flags.seenCases).
  CF.ONCE_CASES = ['threedays', 'scriptorium', 'witch'];
  // Crimes that arrive on their own clock: the Pattern, once a run, from week six.
  CF.RARE_CASES = ['pattern'];
  // Crimes the city breeds only after the Court of Miracles is scattered.
  CF.LATE_CASES = ['highway'];
})(typeof window !== 'undefined' ? window : globalThis);
