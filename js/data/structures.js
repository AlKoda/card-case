// Case structures (roadmap Phase 15): a case is built from a structure
// first, prose second. Each structure names the choices the writing will
// fill ({time}, {entry}, {item}, {detail}, {escape}...) and supplies a brief
// and two scene items written against them. Pools are drawn per case, so
// one structure reads many ways. Templates keep their roles, witnesses,
// leads and shared items; a structure adds to them.
(function (G) {
  var CF = G.CF;

  CF.STRUCTURES = {
    burglary: [
      { id: 'rear_window', vars: { time: ['just after the watchman cried two', 'a little before prime', 'while the street was at Mass'], entry: ['the back shutter', 'the coal-hatch', 'the skylight over the storeroom'], item: ['the strongbox and everything in it', 'a tray of rings', 'the week\'s takings and a fur-lined gown'], detail: ['someone carrying a long sack towards the river', 'a dray standing with no lantern', 'a figure on the roof, quite calm'] },
        brief: '{victim} came back {time} to find {entry} forced and {item} gone. A neighbour reports seeing {detail}. It was not a crocheteur\'s work, but it was not a nervous man\'s either.',
        items: [
          { type: 'clue', label: 'Marks at {entry}', text: 'Scuffs and splinters where {entry} was worked open. They knew which way it gave.', aspects: { forensic: 1, opportunity: 1 } },
          { type: 'clue', label: 'What Was Taken', text: '{item}: chosen, not grabbed. Whoever it was knew what was worth carrying.', aspects: { financial: 2 } },
        ] },
      { id: 'inside_key', vars: { time: ['overnight', 'during the dinner hour', 'on the one evening the shop shuts early'], entry: ['the front door, with a key', 'the yard door', 'the stair from the rooms above'], item: ['the strongbox\'s contents', 'the stock book and the stock', 'three watches and a ledger'], detail: ['nothing at all, which is the strange part', 'the candle go on and off again, as if someone knew the house', 'a familiar cloak in the doorway'] },
        brief: 'No broken glass at {victim}\'s. Whoever came in {time} used {entry}, and left with {item}. A neighbour reports seeing {detail}.',
        items: [
          { type: 'clue', label: 'A Key, Not a Crow', text: '{entry}: no marks, no damage. Whoever came in was expected, or had a key.', aspects: { opportunity: 2 } },
          { type: 'evidence', label: 'The Key Tally', text: 'Who has keys, and since when. Someone has crossed a name out.', needs: null,
            result: { label: 'The Key-holders', text: 'Four keys. Three are accounted for. The fourth was "lost" a month ago by someone who still comes and goes.', aspects: { opportunity: 2, testimony: 1 } } },
        ] },
      { id: 'smash_grab', vars: { time: ['at the dead of the night', 'during the storm', 'in the quarter-hour between the watchman\'s rounds'], entry: ['the shop window, with a cobble', 'the shutter, with a crow', 'the yard gate'], item: ['the window display', 'whatever was in the till', 'a case of plate'], detail: ['a cart with the tail-board up', 'two people running, one of them limping under the weight', 'somebody laughing'] },
        brief: 'Glass everywhere at {victim}\'s. Someone went through {entry} {time}, took {item}, and was gone before the watchman finished shouting. A neighbour reports seeing {detail}.',
        items: [
          { type: 'evidence', label: 'Blood on the Glass', text: 'They cut themselves going in, or out.', needs: 'bio',
            result: { label: 'The Blood Read', text: 'A great deal of it. The barber-surgeon in the Abbey Close stitched a hand the same morning.', aspects: { forensic: 3 } } },
          { type: 'clue', label: 'The Getaway', text: 'Wheel-ruts over the kerb, {detail}. They did not care who saw.', aspects: { opportunity: 1, testimony: 1 } },
        ] },
      { id: 'quiet_safe', vars: { time: ['some time between Friday night and Monday morning', 'while the family was at a burial', 'during the wedding downstairs'], entry: ['the study casement', 'the garden door', 'the cellar hatch'], item: ['the strongbox, opened rather than forced', 'the jewel-case and nothing else', 'the deeds and the coin'], detail: ['a light in the study past compline', 'a tradesman\'s cart that no tradesman came from', 'a guest who left early'] },
        brief: '{victim} is not sure when it happened: {time}. Only {entry} was touched, and only {item} taken. A neighbour reports seeing {detail}. Somebody knew the house.',
        items: [
          { type: 'clue', label: 'The Second Key', text: 'The strongbox was opened, not forced. Three people have a key. One of them lent it.', aspects: { opportunity: 2, motive: 1 } },
          { type: 'evidence', label: 'Pipe Ash in the Study', text: 'Nobody in the house smokes.', needs: 'bio',
            result: { label: 'The Tobacco Named', text: 'Cheap leaf, sold at two shops in the city. Both keep a slate for regulars.', aspects: { forensic: 2, testimony: 1 } } },
        ] },
    ],
    missing: [
      { id: 'walked_out', vars: { time: ['four days ago', 'a sennight last Tuesday', 'the night of the storm'], detail: ['their cloak is still on the hook', 'the pot was still warm when the neighbour looked in', 'the door was locked from outside'], item: ['a carrier\'s chit', 'a likeness, torn in half', 'an unsent letter'] },
        brief: '{victim} has not been seen since {time}. {detail}. On the table, {item}. Nobody has asked for a ransom.',
        items: [
          { type: 'clue', label: 'Left Behind: {item}', text: '{item}, on the kitchen table, where they would see it every morning.', aspects: { motive: 1, testimony: 1 } },
          { type: 'clue', label: 'The Last Evening', text: '{detail}. Whatever happened, it happened fast.', aspects: { opportunity: 2 } },
        ] },
      { id: 'never_home', vars: { time: ['after the late watch', 'on the way back from the bathhouse', 'after a meeting nobody will own to'], detail: ['their pattens were found outside the wrong door', 'a shoe was found by the river stair', 'a candle burned down in a locked room'], item: ['a pawnbroker\'s chit', 'a ferry token to the coast', 'a key that fits nothing in the lodging'] },
        brief: '{victim} never got home {time}. {detail}. In their pocket, when the pocket was found: {item}.',
        items: [
          { type: 'clue', label: 'The Wrong Door', text: '{detail}. They went somewhere they were not supposed to be.', aspects: { opportunity: 2 } },
          { type: 'evidence', label: '{item}', text: 'Found with their things. It means something to somebody.', needs: null,
            result: { label: 'Traced: {item}', text: 'It leads to a name, and the name leads to a reason.', aspects: { motive: 2, financial: 1 } } },
        ] },
      { id: 'own_accord', vars: { time: ['last Sunday', 'the morning after the quarrel', 'the day the wages were paid'], detail: ['they drew everything from the goldsmith the day before', 'they had paid the carrier and never taken the seat', 'they left the dog with a neighbour "for an hour"'], item: ['a second set of papers', 'a bundle of letters from one address', 'a physician\'s bill'] },
        brief: '{victim} left {time}, and it looked planned: {detail}. Then the plan stopped. Among their papers: {item}.',
        items: [
          { type: 'clue', label: 'A Plan That Stopped', text: '{detail}. People who are leaving do not stop halfway unless somebody stops them.', aspects: { motive: 2 } },
          { type: 'evidence', label: '{item}', text: 'Kept somewhere private.', needs: 'lab',
            result: { label: 'What It Points To', text: 'The apothecary reads the faded parts under the glass. A name, a street, a date that is very soon.', aspects: { digital: 2, testimony: 1 } } },
        ] },
    ],
    harbor: [
      { id: 'east_pier', vars: { time: ['between compline and matins', 'just before the tide turned', 'in the fog'], detail: ['a rowing boat with one oar', 'a struggle heard from a moored barge', 'a cart door slamming on the quay'], item: ['a cargo docket', 'a torn guild token', 'a key to a lock-up'] },
        brief: 'A porter\'s hook pulled {victim} out of the water at first light. No froth at the mouth, no sand under the nails: dead before they went in, {time}. On them, in a sealed pocket: {item}.',
        items: [
          { type: 'clue', label: 'Heard from the Barge', text: '{detail}, {time}. The bargeman went back to sleep. He is sorry now.', aspects: { testimony: 1, opportunity: 1 } },
          { type: 'evidence', label: '{item}', text: 'Sealed in oilcloth. The victim wanted it kept.', needs: 'lab',
            result: { label: 'What They Kept', text: 'Marks and names, and one of the names is on your board.', aspects: { financial: 2, motive: 1 } } },
        ] },
      { id: 'warehouse_floor', vars: { time: ['on the night gang', 'after the last cart left', 'on Sunday, when nobody should have been there'], detail: ['a hoist left swinging', 'fresh whitewash over something on the floor', 'the watchman\'s stool by the wrong door'], item: ['a weigh-house ticket', 'a foreman\'s tally', 'a sample bag of something white'] },
        brief: '{victim} was found on a warehouse floor at the Harbour, {time}. The scene had been tidied: {detail}. What they missed: {item}.',
        items: [
          { type: 'evidence', label: 'Under the Whitewash', text: '{detail}. Somebody cleaned up in a hurry.', needs: 'bio',
            result: { label: 'What Was Painted Over', text: 'Blood, a great deal of it, and a boot-print in it that the lime kept perfectly.', aspects: { forensic: 3 } } },
          { type: 'clue', label: 'The Wrong Gang', text: 'Nobody was on the roll {time}. Somebody came in anyway, and knew the doors.', aspects: { opportunity: 2 } },
        ] },
      { id: 'quiet_drowning', vars: { time: ['after the tavern shut', 'in the rain', 'while the fleet was out'], detail: ['no water in the lungs', 'a bruise the shape of a hand on the throat', 'a mark from a rope, but no rope'], item: ['a tavern slate with two rounds on it', 'a letter beginning "You know what you did"', 'a chandler\'s bill for rope'] },
        brief: 'It was meant to look like a drowning. {victim} went in {time}, but the coroner\'s book says {detail}. In their coat, {item}.',
        items: [
          { type: 'clue', label: 'Not a Drowning', text: '{detail}. Somebody wanted this to look like an accident, and nearly managed.', aspects: { forensic: 2 } },
          { type: 'clue', label: 'Two Rounds', text: '{item}. They were not alone that night, and they did not pay.', aspects: { testimony: 1, motive: 1 } },
        ] },
    ],
    arson: [
      { id: 'three_places', vars: { time: ['at matins', 'an hour after the gate bell', 'during the bear-baiting, when the streets were empty'], detail: ['a man watching from across the road, not running', 'a cart leaving without a lantern', 'a smell of lamp-oil in the yard beforehand'], item: ['a fresh bond of assurance', 'a lease near its end', 'a notice to quit'] },
        brief: 'The bucket-chain got to {scene} in time to save the walls, {time}. The fire-warden says it started in three places at once. Fires do not do that. A witness saw {detail}. In the strongbox, unburnt: {item}.',
        items: [
          { type: 'clue', label: 'Three Seats of Fire', text: 'Three places, lit within a minute of each other. One person moving fast, or two moving slowly.', aspects: { forensic: 2 } },
          { type: 'clue', label: '{item}', text: 'Kept somewhere fireproof, which is interesting.', aspects: { financial: 2, motive: 1 } },
        ] },
      { id: 'warning_fire', vars: { time: ['on the night the rent was due', 'a day after the refusal', 'while the family slept upstairs'], detail: ['a rag pushed under the door', 'a cobble with a note tied to it', 'a lit taper dropped carefully'], item: ['a demand for money', 'a list of other shops', 'the name of a tavern'] },
        brief: 'Somebody set fire to {scene} {time}. It started with {detail}. The message came the next morning: {item}.',
        items: [
          { type: 'evidence', label: '{detail}', text: 'What the fire started with. Cheap, and handled.', needs: 'prints',
            result: { label: 'The Hand on the Kindling', text: 'A clean thumb on the one part that did not burn.', aspects: { forensic: 3 } } },
          { type: 'clue', label: 'The Message', text: '{item}. This was not the first, and it was not meant to be the last.', aspects: { testimony: 1, motive: 2 } },
        ] },
      { id: 'cover_fire', vars: { time: ['after the guild\'s audit was announced', 'the night before the inspection', 'on the eve of the sale'], detail: ['the chests were open before the fire', 'the strongbox was empty and unmelted', 'the stock had been carted out the week before'], item: ['a set of books', 'a second set of books', 'a bill of lading'] },
        brief: 'The fire at {scene} {time} destroyed exactly what somebody needed destroyed: {detail}. Everything else survived. Including, in a drawer nobody checked, {item}.',
        items: [
          { type: 'clue', label: 'Convenient Losses', text: '{detail}. The fire knew what it was looking for.', aspects: { motive: 2, financial: 1 } },
          { type: 'evidence', label: '{item}', text: 'Scorched at the edges, readable in the middle.', needs: 'lab',
            result: { label: 'The Columns', text: 'The apothecary recovers the columns. They do not add up, and somebody knew they would not.', aspects: { financial: 3 } } },
        ] },
    ],
    fraud: [
      { id: 'the_scheme', vars: { time: ['over eighteen months', 'since the spring fair', 'for as long as anyone can remember'], detail: ['a handsome prospectus for a mine that does not exist', 'a charter with a seal from a country nobody can find', 'a bill of exchange that was protested'], item: ['a list of investors', 'a rented room, now empty', 'a goldsmith\'s account in another name'] },
        brief: '{victim}, a widow of the Market, has lost everything she had {time} to a venture that does not exist: {detail}. She is not the only one. Behind it, {item}.',
        items: [
          { type: 'clue', label: '{detail}', text: 'Printed well, on good paper. Somebody spent money to take money.', aspects: { financial: 2, digital: 1 } },
          { type: 'clue', label: 'The Investors', text: '{item}. Every one of them was introduced by the same friend of a friend.', aspects: { testimony: 1, financial: 1 } },
        ] },
      { id: 'inside_job', vars: { time: ['every quarter-day', 'at the fair', 'in small sums, for years'], detail: ['a ghost on the wage-roll', 'a supplier that shares an address with a garret', 'bills numbered in someone\'s own hand'], item: ['a new horse', 'a mortgage paid off early', 'a pilgrimage nobody could afford'] },
        brief: 'Coin has been leaving {victim}\'s counting-house {time}: {detail}. Somebody inside has been living well: {item}.',
        items: [
          { type: 'evidence', label: 'The Wage-roll', text: 'Chests of it.', needs: 'lab',
            result: { label: 'The Roll Read', text: '{detail}. The clerk finds the thread and pulls it: one signature, over and over.', aspects: { digital: 2, financial: 2 } } },
          { type: 'clue', label: 'Living Well', text: '{item}, on a clerk\'s wages. People notice. They just do not say.', aspects: { motive: 2 } },
        ] },
      { id: 'the_will', vars: { time: ['a week before the death', 'while the old man lay in the Abbey hospital', 'on a Sunday, witnessed by nobody'], detail: ['a signature that leans the wrong way', 'a new notary nobody had heard of', 'a leaf written on different paper'], item: ['the house', 'the business', 'everything, to one person'] },
        brief: '{victim}\'s family say the will is wrong. It was changed {time}, and it leaves {item}. Look closely and there is {detail}.',
        items: [
          { type: 'evidence', label: 'The Will', text: 'Three leaves and a signature.', needs: 'lab',
            result: { label: 'The Hand Examined', text: '{detail}. The clerk is certain: it was not signed by the person it says it was.', aspects: { forensic: 2, digital: 1 } } },
          { type: 'clue', label: 'Who Benefits', text: '{item}. Ask who was in the room, and who was not.', aspects: { motive: 2, financial: 1 } },
        ] },
    ],
    extortion: [
      { id: 'windows', vars: { time: ['on the first of the month', 'every market day', 'the morning after the refusal'], detail: ['two men in good cloaks', 'a boy who takes the purses', 'a cart that stands outside until it is paid'], item: ['a receipt book', 'a tally of who pays', 'a list of who does not'] },
        brief: 'Stallholders around {scene} have been paying for "protection" {time}, collected by {detail}. {victim} refused, and lost their awning. Somewhere there is {item}.',
        items: [
          { type: 'clue', label: 'The Collectors', text: '{detail}. Everybody has seen them. Nobody has seen them.', aspects: { testimony: 2 } },
          { type: 'clue', label: 'The Round', text: 'They collect in the same order every time, and {victim}\'s stall was on the list. {item} would tell you who else is.', aspects: { opportunity: 1, financial: 1 } },
        ] },
      { id: 'photographs', vars: { time: ['since the summer', 'since the night at the bathhouse', 'since the letter'], detail: ['a likeness in a plain paper', 'a knock at the same hour every night', 'a copy of a letter that should not exist'], item: ['a sum that doubles every month', 'a favour, then another', 'silence about a name'] },
        brief: '{victim} has been paying {time}, because of {detail}. What is wanted is {item}. They came to you because they cannot pay any more.',
        items: [
          { type: 'evidence', label: '{detail}', text: 'What they were shown. Handled, folded, handled again.', needs: 'prints',
            result: { label: 'The Hand on the Paper', text: 'The blackmailer\'s own hand, on the thing they were most careful about.', aspects: { forensic: 3 } } },
          { type: 'clue', label: 'The Price', text: '{item}. It is never really about the money, until it is.', aspects: { motive: 2, financial: 1 } },
        ] },
      { id: 'the_club', vars: { time: ['since the keeper changed', 'since the new doorman', 'since the licence came before the Council'], detail: ['a fire in the kitchen that was not an accident', 'a delivery that never comes on time', 'a brawl that starts whenever the till is full'], item: ['a share', 'the back room, for their own use', 'the tavern itself, eventually'] },
        brief: 'Things have gone wrong at {scene} {time}: {detail}. Somebody wants {item}, and {victim} is running out of ways to say no.',
        items: [
          { type: 'clue', label: 'Bad Luck, Regularly', text: '{detail}. Accidents do not keep market days.', aspects: { opportunity: 2 } },
          { type: 'clue', label: 'What They Want', text: '{item}. The demand has a shape, and the shape has a name.', aspects: { motive: 2 } },
        ] },
    ],
    poison: [
      { id: 'supper', vars: { time: ['after the feast of St Martin', 'the night of the guild dinner', 'after a quiet supper for two'], detail: ['the eels were sent back untouched', 'one cup was rinsed and the rest were not', 'the dog that ate the scraps is dead too'], item: ['a paper of white powder', 'a twist of monkshood root', 'a phial with a chemist\'s mark scraped off'] },
        brief: '{victim} died {time}, in agony, and the physician wrote "a surfeit". But {detail}. In the kitchen midden, {item}.',
        items: [
          { type: 'clue', label: 'What Was Sent Back', text: '{detail}. Somebody at that table knew which dish to leave.', aspects: { opportunity: 2 } },
          { type: 'evidence', label: '{item}', text: 'Found in the midden, wrapped, thrown away in a hurry.', needs: 'bio',
            result: { label: 'The Powder Named', text: 'The apothecary\'s boy knows it by the smell before the needle blackens. Ratsbane. Three drams would do it.', aspects: { forensic: 3 } } },
        ] },
      { id: 'slow', vars: { time: ['over a month', 'since Candlemas', 'since the new maid came'], detail: ['hair coming out in the comb', 'a burning in the hands and feet', 'the physician\'s cures made it worse'], item: ['a bottle of "tonic"', 'a jar of preserved plums', 'a sugar-loaf kept apart from the rest'] },
        brief: '{victim} sickened {time}: {detail}. Everyone called it a wasting. The coroner\'s book calls it something else. In the sickroom, {item}.',
        items: [
          { type: 'clue', label: 'The Course of It', text: '{detail}. A sickness that keeps a timetable is not a sickness.', aspects: { forensic: 1, motive: 1 } },
          { type: 'evidence', label: '{item}', text: 'Taken every day, by one person only.', needs: 'bio',
            result: { label: 'The Needle Blackens', text: 'Silver into the dregs, out black. A little every day, for a month.', aspects: { forensic: 3 } } },
        ] },
      { id: 'apothecary', vars: { time: ['on market day', 'the day the poison book was signed', 'the day the shop was shut for a burial'], detail: ['a leaf cut from the poison book', 'a jar on the top shelf half empty', 'the boy sent on an errand at the wrong hour'], item: ['three drams of arsenic', 'a dram of corrosive sublimate', 'a paper of aconite'] },
        brief: 'The powder that killed {victim} came from a shop in the city, {time}. At the Sign of the Pestle, {detail}. What went out the door: {item}.',
        items: [
          { type: 'evidence', label: 'The Poison Book', text: '{detail}. Every apothecary must keep one.', needs: 'lab',
            result: { label: 'The Cut Leaf Read', text: 'The leaf beneath took the impress of the pen. A name, a date, {item}.', aspects: { digital: 2, forensic: 1 } } },
          { type: 'clue', label: 'The Boy\'s Errand', text: '{detail}. Somebody wanted the shop empty for a quarter of an hour.', aspects: { opportunity: 2 } },
        ] },
    ],
    scriptorium: [
      { id: 'painted', vars: { time: ['after compline', 'during the night office', 'while the brothers were at chapter'], detail: ['the lamp was still warm', 'the press was chained and the chain was new', 'a page had been cut from the register of readers'], item: ['a leaf painted at the corner', 'a pot of gall with something else in it', 'a brush that was not a scribe\'s'] },
        brief: 'A brother died in the scriptorium {time}, the door locked from within. {detail}. On the desk, {item}.',
        items: [
          { type: 'clue', label: 'The Register of Readers', text: '{detail}. Somebody did not want it known who read what.', aspects: { digital: 2 } },
          { type: 'evidence', label: '{item}', text: 'It should not be in a scriptorium.', needs: 'bio',
            result: { label: 'The Poison on the Page', text: 'The needle blackens at the corner of the leaf. A reader who wets his finger dies by the third page.', aspects: { forensic: 3 } } },
        ] },
      { id: 'window', vars: { time: ['before matins', 'in the fog', 'on the night of the visitor'], detail: ['a bar of the window loose in its socket', 'the garden trodden under the window', 'a novice\'s sandal in the bed below'], item: ['a torn cowl', 'a knotted rope', 'a scholar\'s glove'] },
        brief: 'A brother was found under the scriptorium window {time}, and the room above was locked. But {detail}. Caught on the sill, {item}.',
        items: [
          { type: 'clue', label: 'The Way Out', text: '{detail}. A locked door means nothing when the window opens.', aspects: { opportunity: 2, forensic: 1 } },
          { type: 'clue', label: '{item}', text: 'Left on the sill by somebody who went out that way in a hurry.', aspects: { forensic: 2 } },
        ] },
      { id: 'visitor', vars: { time: ['on the third day of his visit', 'the night he was refused the book', 'the morning he was to leave'], detail: ['the guest-house bed not slept in', 'his satchel packed and one book too many in it', 'the porter paid to forget the hour'], item: ['a scholar\'s knife', 'a letter of introduction under a false seal', 'a list of the Abbey\'s books in a stranger\'s hand'] },
        brief: 'A brother died in the scriptorium {time}. The Abbey has a visitor, and {detail}. In the guest-house, {item}.',
        items: [
          { type: 'clue', label: 'The Guest-house', text: '{detail}. Guests of the Abbey do not usually keep such hours.', aspects: { opportunity: 2, motive: 1 } },
          { type: 'evidence', label: '{item}', text: 'Not what a scholar carries. Or exactly what one carries, if he came for a book he could not ask for.', needs: 'lab',
            result: { label: 'The Stranger Read', text: 'The seal is false and the hand is a lawyer\'s. He was sent for the book, and he did not come alone.', aspects: { digital: 2, testimony: 1 } } },
        ] },
    ],
    witch: [
      { id: 'sluice', vars: { time: ['on the night of the fair', 'the night the mill stood still', 'the night the mother was at the Abbey'], detail: ['the sluice gate opened by a man\'s hand', 'the child\'s shoes found dry on the bank', 'a cart heard at the race after curfew'], item: ['a man\'s belt in the reeds', 'a jointure deed newly sealed', 'the child\'s cap, folded, not dropped'] },
        brief: 'The child was taken from the race {time}. The quarter says the midwife. But {detail}. Found on the bank, {item}.',
        items: [
          { type: 'clue', label: 'What the Quarter Did Not See', text: '{detail}. The quarter was looking at the midwife.', aspects: { opportunity: 2 } },
          { type: 'clue', label: '{item}', text: 'Not a witch\'s thing. A man\'s, or a lawyer\'s.', aspects: { motive: 1, forensic: 1 } },
        ] },
      { id: 'square', vars: { time: ['by noon', 'before the child was cold', 'before the bell'], detail: ['the stepfather led the shouting', 'the suitor paid the crier', 'the miller\'s apprentice was the first to say the word'], item: ['a paper of accusations in one hand', 'a witness who was bought a dinner', 'a mark that was drawn on with walnut juice'] },
        brief: 'The midwife\'s name was in the square {time}: {detail}. In the shouting, {item}.',
        items: [
          { type: 'clue', label: 'Who Shouted First', text: '{detail}. The loudest accuser is not always the guiltiest, but it is where to start.', aspects: { motive: 2, testimony: 1 } },
          { type: 'clue', label: '{item}', text: 'An accusation that was prepared is an accusation with a reason behind it.', aspects: { testimony: 2 } },
        ] },
      { id: 'sister', vars: { time: ['the night before the fair', 'after the mother went to the Abbey', 'the night the sluice was mended'], detail: ['the older sister hid in the loft', 'the sister has bruises of her own', 'the sister will not say the word the square says'], item: ['a child\'s drawing of a man at the water', 'a strap with a buckle that matches the bruises', 'a bribe of sugared almonds'] },
        brief: 'The child drowned {time}. Its sister saw something: {detail}. In the loft where she hides, {item}.',
        items: [
          { type: 'clue', label: 'What the Sister Knows', text: '{detail}. A frightened child is a witness, if somebody is gentle.', aspects: { testimony: 2, motive: 1 } },
          { type: 'clue', label: '{item}', text: 'Kept hidden by a child who knew it mattered.', aspects: { forensic: 2 } },
        ] },
    ],
    highway: [
      { id: 'inn', vars: { time: ['the night before the fair', 'the night the strongbox travelled', 'a wet night with no moon'], detail: ['the innkeeper closed early', 'a horse was stabled that nobody owned', 'a boy rode ahead of the carrier'], item: ['a mask of black crape', 'a pistol with the Harbour gunsmith\'s mark', 'a docket that named the strongbox'] },
        brief: 'The carrier was stopped {time}, and {detail}. In the inn stable, {item}.',
        items: [
          { type: 'clue', label: 'The Inn', text: '{detail}. Every robbery on this road starts at the inn.', aspects: { opportunity: 2, testimony: 1 } },
          { type: 'clue', label: '{item}', text: 'Left where it could be found by somebody who did not expect anybody to look.', aspects: { forensic: 2 } },
        ] },
      { id: 'gentleman', vars: { time: ['on quarter-day', 'the night his note fell due', 'the night of the Hill ball'], detail: ['a good horse lathered in a Hill stable at dawn', 'a signet pawned across the river', 'a servant who will not meet your eye'], item: ['a mask of black crape in a gentleman\'s coat', 'a pair of pistols with the Hill gunsmith\'s mark', 'a tailor\'s bill that was suddenly paid'] },
        brief: 'The carrier was stopped {time} by a rider who sat a horse like a gentleman. On the Hill, {detail}. In a wardrobe there, {item}.',
        items: [
          { type: 'clue', label: 'A Gentleman\'s Debts', text: '{detail}. The Hill keeps its accounts, and its accounts were in trouble.', aspects: { financial: 2, motive: 1 } },
          { type: 'clue', label: '{item}', text: 'Found where a gentleman keeps the things a gentleman does not own.', aspects: { forensic: 2, opportunity: 1 } },
        ] },
      { id: 'boy', vars: { time: ['the night before the run', 'at the last inn', 'when the docket was written'], detail: ['the carrier\'s boy rode ahead alone', 'the boy knew the box was there', 'the boy has new boots'], item: ['a share of gulden under a mattress', 'a note from the inn', 'a rider\'s glove too big for a boy'] },
        brief: 'Somebody told the riders which cart and which night. {detail}, {time}. In the boy\'s loft, {item}.',
        items: [
          { type: 'clue', label: 'Who Knew', text: '{detail}. Three people knew the box travelled; one of them talked.', aspects: { opportunity: 2, testimony: 1 } },
          { type: 'clue', label: '{item}', text: 'A boy\'s share of a gentleman\'s robbery.', aspects: { financial: 2 } },
        ] },
    ],
    contract: [
      { id: 'hired', vars: { time: ['the night before', 'a week before', 'on the feast day'], detail: ['twelve gulden crossed a table at the Red Ox', 'a letter went to the Stews by a link-boy', 'a man from the Warrens asked which door'], item: ['a purse with a good seal', 'a letter naming an hour', 'a tally with one stroke on it'] },
        brief: '{victim} was killed with one clean stroke, and {time} {detail}. Found on the killer\'s road, {item}.',
        items: [
          { type: 'clue', label: 'The Purse That Moved the Hand', text: '{detail}. The hand was hired; the reason lives on the Hill.', aspects: { financial: 2, motive: 1 } },
          { type: 'clue', label: '{item}', text: 'Somebody paid, and somebody kept the receipt.', aspects: { financial: 1, digital: 1 } },
        ] },
      { id: 'partner', vars: { time: ['the week the accounts were due', 'the day after the quarrel at the warehouse', 'the night the ship came in'], detail: ['the partnership deed altered', 'the warehouse keys changed', 'the victim\'s share already spent'], item: ['a receipt for a debt paid in the Stews', 'a tally with the sender\'s mark', 'a letter to the Stews in a merchant\'s hand'] },
        brief: '{victim} was killed {time}, one stroke, nothing taken. At the counting-house, {detail}. Among the papers, {item}.',
        items: [
          { type: 'clue', label: 'The Partnership', text: '{detail}. A partnership is worth more to one partner dead.', aspects: { financial: 2, motive: 2 } },
          { type: 'clue', label: '{item}', text: 'A merchant keeps receipts. Even for this.', aspects: { digital: 2, financial: 1 } },
        ] },
      { id: 'sender', vars: { time: ['on the night of the fair', 'after the bell', 'in the lane behind the Red Ox'], detail: ['the sender drank at the Red Ox all evening', 'the sender was seen leaving by the Harbour gate', 'the sender\'s blade is known in the Stews'], item: ['a Coquille token', 'a blade wiped on a good cloth', 'a purse with the seal cut off'] },
        brief: '{victim} died {time}, and the Stews know the hand: {detail}. Left at the scene, {item}.',
        items: [
          { type: 'clue', label: 'The Sender\'s Habits', text: '{detail}. The Stews know their own.', aspects: { testimony: 2, opportunity: 1 } },
          { type: 'evidence', label: '{item}', text: 'Dropped, or left as a signature.', needs: 'bio',
            result: { label: 'The Blade\'s Owner', text: 'The Stews have a name for the man who carries this. So does the Coquille.', aspects: { forensic: 2, testimony: 1 } } },
        ] },
    ],
    pattern: [
      { id: 'fair', vars: { time: ['the night after the fair', 'the night the players left', 'the night of the guild dinner'], detail: ['her hair was fair', 'she had been asked her name the week before', 'a gentle voice was heard in the lane'], item: ['a strand of hair in a twist of paper', 'a phial of attar', 'a barber\'s cloth'] },
        brief: 'The first girl was found {time}: {detail}. In the doorway, {item}.',
        items: [
          { type: 'clue', label: 'The Night After the Fair', text: '{detail}. He comes when the city is tired.', aspects: { opportunity: 2 }, pattern: true },
          { type: 'evidence', label: '{item}', text: 'Left by a hand that did not think it was leaving anything.', needs: 'bio',
            result: { label: 'The Scent Named', text: 'Attar of roses, and under it something the apothecary\'s boy knows from one shop only.', aspects: { forensic: 2, testimony: 1 } } },
        ] },
      { id: 'doors', vars: { time: ['before matins', 'in the fog', 'in the hour the lamps go out'], detail: ['every door faces the same way', 'every lane runs down to the river', 'every girl was found within a bell of the spinning-house'], item: ['a chalk mark on the lintel', 'a cut lock of hair returned, tied with ribbon', 'a coin under the tongue'] },
        brief: 'A girl of {scene} found {time}, hair cut off. {detail}. On the doorpost, {item}.',
        items: [
          { type: 'clue', label: 'The Doors', text: '{detail}. He chooses the door before the girl.', aspects: { opportunity: 2 }, pattern: true },
          { type: 'clue', label: '{item}', text: 'A signature, or a courtesy. He wants somebody to read it.', aspects: { motive: 1, forensic: 1 } },
        ] },
      { id: 'attar', vars: { time: ['the night the perfumer\'s shop stayed lit', 'the night of the rose fair', 'the night after the players'], detail: ['the smell of attar in the lane', 'a phial with a shop\'s mark', 'petals in the gutter under the door'], item: ['a stoppered phial', 'a receipt for civet', 'a barber\'s strop'] },
        brief: 'A girl found {time} with her hair cut close, and in the doorway {detail}. Dropped nearby, {item}.',
        items: [
          { type: 'clue', label: 'The Scent', text: '{detail}. One shop in the city sells it.', aspects: { forensic: 2 }, pattern: true },
          { type: 'evidence', label: '{item}', text: 'Not a thing the lane would drop.', needs: 'bio',
            result: { label: 'The Shop Named', text: 'The apothecary\'s boy names the shop and the hand that buys there.', aspects: { testimony: 2, opportunity: 1 } } },
        ] },
    ],
    threedays: [
      { id: 'chest', vars: { time: ['at the Saturday auction', 'on market day', 'the day the Council sat'], detail: ['the chest was nailed shut from outside', 'the chest smelt of quicklime', 'the chest had a shipping mark from the Hill'], item: ['a bill of sale in a good hand', 'a nail from a Hill carpenter', 'a scrap of a woman\'s sleeve'] },
        brief: 'The chest was sold {time} for a hundred gulden. {detail}. Under the lid, {item}.',
        items: [
          { type: 'clue', label: 'The Chest', text: '{detail}. Whoever sold it did not expect it to be opened in public.', aspects: { opportunity: 2, digital: 1 } },
          { type: 'clue', label: '{item}', text: 'A man who cuts a woman in pieces and sells the chest signs his own name to the sale. He wanted to be found.', aspects: { digital: 2 } },
        ] },
      { id: 'brothers', vars: { time: ['on the same morning', 'within the hour', 'before the bell'], detail: ['each swore the other was at home', 'neither would look at the other', 'each described a different knife'], item: ['two confessions in two hands', 'a letter from one brother to the other, unsent', 'a knife that fits neither story'] },
        brief: 'Two men came to the Watch-house {time}, each saying he did it: {detail}. On your desk, {item}.',
        items: [
          { type: 'clue', label: 'Two Confessions', text: '{detail}. Two men cannot both have done one thing alone.', aspects: { testimony: 2, motive: 1 } },
          { type: 'clue', label: '{item}', text: 'The truth is in what the confessions leave out.', aspects: { digital: 1, opportunity: 1 } },
        ] },
      { id: 'apples', vars: { time: ['on the Hill, at a great price', 'from the Bishop\'s own orchard', 'off a ship, in winter'], detail: ['there were three', 'one was gone from the table by evening', 'the sick woman never tasted them'], item: ['a receipt for three apples', 'the apple itself, bitten once', 'a boy\'s account of a kindness'] },
        brief: 'Three apples were bought {time} for a woman who was dying: {detail}. Found on the way from her table to the Market, {item}.',
        items: [
          { type: 'clue', label: 'Three Apples', text: '{detail}. The whole death is in one apple\'s journey.', aspects: { opportunity: 2 } },
          { type: 'clue', label: '{item}', text: 'Every hand it passed through told the next one a lie.', aspects: { testimony: 1, motive: 1 } },
        ] },
    ],
    coining: [
      { id: 'the_furnace', vars: { time: ['past the gate bell', 'on Sunday, when the forges are cold', 'during the fair, when the city is full of strangers'], detail: ['smoke from a chimney where nobody lives', 'sacks of charcoal carried in at night', 'a smell of hot metal in a lane of weavers'], item: ['a broken mould', 'a bar of lead', 'a crucible with silver in the cracks'] },
        brief: 'Somebody in the city has a furnace going {time}: {detail}. The Mintmaster is certain of the die. In a midden nearby, {item}.',
        items: [
          { type: 'clue', label: 'Smoke After Curfew', text: '{detail}. No forge is licensed there.', aspects: { opportunity: 2 } },
          { type: 'evidence', label: '{item}', text: 'Thrown away in a hurry.', needs: 'prints',
            result: { label: 'The Hand on the Mould', text: 'Vinegar brings up the hand that pressed it: a thumb, and a missing nail.', aspects: { forensic: 2, opportunity: 1 } } },
        ] },
      { id: 'the_passer', vars: { time: ['at the cattle market', 'in the dice-cellars', 'at every tavern on the Harbour'], detail: ['always paid in new coin', 'always by candlelight', 'always to strangers'], item: ['a tally of what was passed where', 'a purse with two compartments', 'a ferryman\'s token'] },
        brief: 'The false coin is being passed {time}, {detail}. The Mintmaster wants the die; the Council wants a name. On the passer, when the passer was nearly taken: {item}.',
        items: [
          { type: 'clue', label: 'Always the Same Way', text: '{detail}. A passer has habits, and habits are a face.', aspects: { testimony: 1, opportunity: 1 } },
          { type: 'clue', label: '{item}', text: 'Dropped in the scramble. It leads somewhere.', aspects: { financial: 2 } },
        ] },
      { id: 'the_clipper', vars: { time: ['for a year', 'since the new coinage', 'since the moneychanger took a partner'], detail: ['every coin in the quarter a hair short', 'a scale that weighs light', 'shavings in the sweepings'], item: ['a twist of clippings', 'a set of shears', 'a ledger in weights, not sums'] },
        brief: 'The Emperor\'s face has been getting smaller in {scene} {time}: {detail}. Somebody is shaving the edges and melting the harvest. In a locked drawer, {item}.',
        items: [
          { type: 'clue', label: 'The Light Scale', text: '{detail}. The Muhtasib tests weights on market day; this one was tested and passed, which means somebody was paid.', aspects: { financial: 1, motive: 1 } },
          { type: 'evidence', label: '{item}', text: 'Locked away like something precious, which it is.', needs: 'bio',
            result: { label: 'The Clippings Assayed', text: 'Good silver, from the new coinage, and the same shears\' bite on every edge.', aspects: { forensic: 2, financial: 1 } } },
        ] },
    ],
  };
})(typeof window !== 'undefined' ? window : globalThis);
