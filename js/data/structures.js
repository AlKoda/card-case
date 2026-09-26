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
      { id: 'rear_window', vars: { time: ['just after two', 'a little before dawn', 'while the street was at church'], entry: ['the rear window', 'the coal chute', 'the skylight over the stockroom'], item: ['the contents of the safe', 'a tray of rings', 'the week\'s takings and a fur coat'], detail: ['someone carrying a long bag towards the canal', 'a van idling with its lights off', 'a figure on the roof, quite calm'] },
        brief: '{victim} came back {time} to find {entry} forced and {item} gone. A neighbour reports seeing {detail}. It was not a professional job, but it was not a nervous one either.',
        items: [
          { type: 'clue', label: 'Marks at {entry}', text: 'Scuffs and splinters where {entry} was worked open. They knew which way it gave.', aspects: { forensic: 1, opportunity: 1 } },
          { type: 'clue', label: 'What Was Taken', text: '{item}: chosen, not grabbed. Whoever it was knew what was worth carrying.', aspects: { financial: 2 } },
        ] },
      { id: 'inside_key', vars: { time: ['overnight', 'during the lunch hour', 'on the one evening the shop closes early'], entry: ['the front door, with a key', 'the staff entrance', 'the connecting door from the flat upstairs'], item: ['the safe\'s contents', 'the stock book and the stock', 'three watches and a ledger'], detail: ['nothing at all, which is the strange part', 'the lights go on and off again, as if someone knew the switches', 'a familiar coat in the doorway'] },
        brief: 'No broken glass at {victim}\'s. Whoever came in {time} used {entry}, and left with {item}. A neighbour reports seeing {detail}.',
        items: [
          { type: 'clue', label: 'No Forced Entry', text: '{entry}: no marks, no damage. Whoever came in was expected, or had a key.', aspects: { opportunity: 2 } },
          { type: 'evidence', label: 'The Key Log', text: 'Who has keys, and since when. Someone has crossed a name out.', needs: null,
            result: { label: 'Key Holders', text: 'Four keys. Three are accounted for. The fourth was "lost" a month ago by someone who still comes and goes.', aspects: { opportunity: 2, testimony: 1 } } },
        ] },
      { id: 'smash_grab', vars: { time: ['at four in the morning', 'during the storm', 'in the twenty minutes between patrols'], entry: ['the shop window, with a brick', 'the shutter, with a crowbar', 'the glass door'], item: ['the window display', 'whatever was in the till', 'a case of silver'], detail: ['a car with no plates', 'two people running, one of them limping under the weight', 'somebody laughing'] },
        brief: 'Glass everywhere at {victim}\'s. Someone went through {entry} {time}, took {item}, and was gone before the alarm finished ringing. A neighbour reports seeing {detail}.',
        items: [
          { type: 'evidence', label: 'Blood on the Glass', text: 'They cut themselves going in, or out.', needs: 'bio',
            result: { label: 'Blood Type', text: 'A rare type. The hospital on Canal Street stitched a hand the same morning.', aspects: { forensic: 3 } } },
          { type: 'clue', label: 'The Getaway', text: 'Tyre marks over the kerb, {detail}. They did not care who saw.', aspects: { opportunity: 1, testimony: 1 } },
        ] },
      { id: 'quiet_safe', vars: { time: ['some time between Friday night and Monday morning', 'while the family was at a funeral', 'during the wedding downstairs'], entry: ['the study window', 'the garden door', 'the cellar hatch'], item: ['the safe, opened rather than forced', 'the jewellery box and nothing else', 'the deeds and the cash'], detail: ['a light in the study at midnight', 'a tradesman\'s van that no tradesman came from', 'a guest who left early'] },
        brief: '{victim} is not sure when it happened: {time}. Only {entry} was touched, and only {item} taken. A neighbour reports seeing {detail}. Somebody knew the house.',
        items: [
          { type: 'clue', label: 'The Combination', text: 'The safe was opened, not forced. Three people knew the combination. One of them wrote it down.', aspects: { opportunity: 2, motive: 1 } },
          { type: 'evidence', label: 'Cigarette Ash in the Study', text: 'Nobody in the house smokes.', needs: 'bio',
            result: { label: 'Tobacco Analysis', text: 'A cheap brand, sold at two shops in the city. Both keep a tab for regulars.', aspects: { forensic: 2, testimony: 1 } } },
        ] },
    ],
    missing: [
      { id: 'walked_out', vars: { time: ['four days ago', 'a week last Tuesday', 'the night of the storm'], detail: ['their coat is still on the hook', 'the kettle was still warm when the neighbour looked in', 'the door was locked from outside'], item: ['a train timetable', 'a photograph, torn in half', 'an unposted letter'] },
        brief: '{victim} has not been seen since {time}. {detail}. On the table, {item}. Nobody has asked for a ransom.',
        items: [
          { type: 'clue', label: 'Left Behind: {item}', text: '{item}, on the kitchen table, where they would see it every morning.', aspects: { motive: 1, testimony: 1 } },
          { type: 'clue', label: 'The Last Evening', text: '{detail}. Whatever happened, it happened fast.', aspects: { opportunity: 2 } },
        ] },
      { id: 'never_home', vars: { time: ['after the late shift', 'on the way back from the club', 'after a meeting nobody will admit to'], detail: ['their bicycle was found chained outside the wrong building', 'a shoe was found by the canal', 'their phone rang out in a locked room'], item: ['a pawn ticket', 'a bus ticket to the coast', 'a key that fits nothing in the flat'] },
        brief: '{victim} never got home {time}. {detail}. In their pocket, when the pocket was found: {item}.',
        items: [
          { type: 'clue', label: 'Wrong Building', text: '{detail}. They went somewhere they were not supposed to be.', aspects: { opportunity: 2 } },
          { type: 'evidence', label: '{item}', text: 'Found with their things. It means something to somebody.', needs: null,
            result: { label: 'Traced: {item}', text: 'It leads to a name, and the name leads to a reason.', aspects: { motive: 2, financial: 1 } } },
        ] },
      { id: 'own_accord', vars: { time: ['last Sunday', 'the morning after the argument', 'payday'], detail: ['they withdrew everything from the bank the day before', 'they had booked a ticket and never used it', 'they left the dog with a neighbour "for an hour"'], item: ['a second passport', 'a stack of letters from one address', 'a doctor\'s appointment card'] },
        brief: '{victim} left {time}, and it looked planned: {detail}. Then the plan stopped. Among their papers: {item}.',
        items: [
          { type: 'clue', label: 'A Plan That Stopped', text: '{detail}. People who are leaving do not stop halfway unless somebody stops them.', aspects: { motive: 2 } },
          { type: 'evidence', label: '{item}', text: 'Kept somewhere private.', needs: 'lab',
            result: { label: 'What It Points To', text: 'The lab reads the faded parts. A name, an address, a date that is very soon.', aspects: { digital: 2, testimony: 1 } } },
        ] },
    ],
    harbor: [
      { id: 'east_pier', vars: { time: ['between midnight and one', 'just before the tide turned', 'during the fog'], detail: ['a rowing boat with one oar', 'a struggle heard from a moored barge', 'a car door slamming on the quay'], item: ['a cargo docket', 'a torn union card', 'a key to a lock-up'] },
        brief: 'A dockworker\'s hook pulled {victim} out of the water at dawn. The coroner says they were dead before they went in, {time}. On them, in a sealed pocket: {item}.',
        items: [
          { type: 'clue', label: 'Heard from the Barge', text: '{detail}, {time}. The bargeman went back to sleep. He is sorry now.', aspects: { testimony: 1, opportunity: 1 } },
          { type: 'evidence', label: '{item}', text: 'Sealed in oilcloth. The victim wanted it kept.', needs: 'lab',
            result: { label: 'What They Kept', text: 'Numbers and names, and one of the names is on your board.', aspects: { financial: 2, motive: 1 } } },
        ] },
      { id: 'warehouse_floor', vars: { time: ['on the night shift', 'after the last lorry left', 'on Sunday, when nobody should have been there'], detail: ['a forklift left running', 'fresh paint over something on the floor', 'the night watchman\'s chair by the wrong door'], item: ['a weighbridge ticket', 'a foreman\'s notebook', 'a sample bag of something white'] },
        brief: '{victim} was found on a warehouse floor at the harbour, {time}. The scene had been tidied: {detail}. What they missed: {item}.',
        items: [
          { type: 'evidence', label: 'Under the Paint', text: '{detail}. Somebody cleaned up in a hurry.', needs: 'bio',
            result: { label: 'What Was Painted Over', text: 'Blood, a lot of it, and a boot print in it that the paint preserved perfectly.', aspects: { forensic: 3 } } },
          { type: 'clue', label: 'The Wrong Shift', text: 'Nobody was rostered {time}. Somebody came in anyway, and knew the doors.', aspects: { opportunity: 2 } },
        ] },
      { id: 'quiet_drowning', vars: { time: ['after the pub shut', 'in the rain', 'while the fleet was out'], detail: ['no water in the lungs', 'a bruise the shape of a hand', 'their watch stopped an hour before the tide'], item: ['a bar bill with two rounds on it', 'a letter beginning "You know what you did"', 'a receipt for rope'] },
        brief: 'It was meant to look like a drowning. {victim} went in {time}, but the coroner found {detail}. In their coat, {item}.',
        items: [
          { type: 'clue', label: 'Not a Drowning', text: '{detail}. Somebody wanted this to look like an accident, and nearly managed.', aspects: { forensic: 2 } },
          { type: 'clue', label: 'Two Rounds', text: '{item}. They were not alone that night, and they did not pay.', aspects: { testimony: 1, motive: 1 } },
        ] },
    ],
    arson: [
      { id: 'three_places', vars: { time: ['at three in the morning', 'an hour after closing', 'during the match, when the streets were empty'], detail: ['a man watching from across the road, not running', 'a car leaving without lights', 'a smell of paraffin in the yard beforehand'], item: ['a fresh insurance policy', 'a lease due to expire', 'an eviction notice'] },
        brief: 'The fire brigade got to {scene} in time to save the walls, {time}. The fire chief says it started in three places at once. Fires do not do that. A witness saw {detail}. In the office safe, unburnt: {item}.',
        items: [
          { type: 'clue', label: 'Three Seats of Fire', text: 'Three places, lit within a minute of each other. One person moving fast, or two moving slowly.', aspects: { forensic: 2 } },
          { type: 'clue', label: '{item}', text: 'Kept somewhere fireproof, which is interesting.', aspects: { financial: 2, motive: 1 } },
        ] },
      { id: 'warning_fire', vars: { time: ['on the night the rent was due', 'a day after the refusal', 'while the family slept upstairs'], detail: ['a rag pushed through the letterbox', 'a brick with a note tied to it', 'a lit match dropped carefully'], item: ['a demand for money', 'a list of other shops', 'a phone number'] },
        brief: 'Somebody set fire to {scene} {time}. It started with {detail}. The message came the next morning: {item}.',
        items: [
          { type: 'evidence', label: '{detail}', text: 'What the fire started with. Cheap, and handled.', needs: 'prints',
            result: { label: 'Prints on the Starter', text: 'A clean thumb on the one part that did not burn.', aspects: { forensic: 3 } } },
          { type: 'clue', label: 'The Message', text: '{item}. This was not the first, and it was not meant to be the last.', aspects: { testimony: 1, motive: 2 } },
        ] },
      { id: 'cover_fire', vars: { time: ['after the audit was announced', 'the night before the inspection', 'on the eve of the sale'], detail: ['the filing cabinets were open before the fire', 'the safe was empty and unmelted', 'the stock had been moved out the week before'], item: ['a set of books', 'a second set of books', 'a shipping manifest'] },
        brief: 'The fire at {scene} {time} destroyed exactly what somebody needed destroyed: {detail}. Everything else survived. Including, in a drawer nobody checked, {item}.',
        items: [
          { type: 'clue', label: 'Convenient Losses', text: '{detail}. The fire knew what it was looking for.', aspects: { motive: 2, financial: 1 } },
          { type: 'evidence', label: '{item}', text: 'Scorched at the edges, readable in the middle.', needs: 'lab',
            result: { label: 'The Numbers', text: 'The lab recovers the columns. They do not add up, and somebody knew they would not.', aspects: { financial: 3 } } },
        ] },
    ],
    fraud: [
      { id: 'the_scheme', vars: { time: ['over eighteen months', 'since the spring', 'for as long as anyone can remember'], detail: ['a glossy brochure for a mine that does not exist', 'a certificate with a seal from a country nobody can find', 'a dividend cheque that bounced'], item: ['a list of investors', 'a rented office, now empty', 'a bank in another name'] },
        brief: '{victim}, a retired schoolteacher, has lost her life savings {time} to an investment that does not exist: {detail}. She is not the only one. Behind it, {item}.',
        items: [
          { type: 'clue', label: '{detail}', text: 'Printed well, on good paper. Somebody spent money to take money.', aspects: { financial: 2, digital: 1 } },
          { type: 'clue', label: 'The Investors', text: '{item}. Every one of them was introduced by the same friend of a friend.', aspects: { testimony: 1, financial: 1 } },
        ] },
      { id: 'inside_job', vars: { time: ['every payday', 'at the quarter\'s end', 'in small amounts, for years'], detail: ['a ghost employee on the payroll', 'a supplier that shares an address with a flat', 'invoices numbered in someone\'s own hand'], item: ['a new car', 'a mortgage paid off early', 'a holiday nobody could afford'] },
        brief: 'Money has been leaving {victim}\'s firm {time}: {detail}. Somebody inside has been living well: {item}.',
        items: [
          { type: 'evidence', label: 'The Payroll', text: 'Boxes of it.', needs: 'lab',
            result: { label: 'Payroll Analysis', text: '{detail}. The lab finds the thread and pulls it: one signature, over and over.', aspects: { digital: 2, financial: 2 } } },
          { type: 'clue', label: 'Living Well', text: '{item}, on a clerk\'s wages. People notice. They just do not say.', aspects: { motive: 2 } },
        ] },
      { id: 'the_will', vars: { time: ['a week before the death', 'while the old man was in hospital', 'on a Sunday, witnessed by nobody'], detail: ['a signature that leans the wrong way', 'a new solicitor nobody had heard of', 'a page typed on a different machine'], item: ['the house', 'the business', 'everything, to one person'] },
        brief: '{victim}\'s family say the will is wrong. It was changed {time}, and it leaves {item}. Look closely and there is {detail}.',
        items: [
          { type: 'evidence', label: 'The Will', text: 'Three pages and a signature.', needs: 'lab',
            result: { label: 'Document Analysis', text: '{detail}. The lab is certain: it was not signed by the person it says it was.', aspects: { forensic: 2, digital: 1 } } },
          { type: 'clue', label: 'Who Benefits', text: '{item}. Ask who was in the room, and who was not.', aspects: { motive: 2, financial: 1 } },
        ] },
    ],
    extortion: [
      { id: 'windows', vars: { time: ['on the first of the month', 'every Friday', 'the morning after the refusal'], detail: ['two men in good coats', 'a boy who takes the envelopes', 'a car that parks outside until it is paid'], item: ['a receipt book', 'a ledger of who pays', 'a list of who does not'] },
        brief: 'Shopkeepers around {scene} have been paying for "protection" {time}, collected by {detail}. {victim} refused, and lost their windows. Somewhere there is {item}.',
        items: [
          { type: 'clue', label: 'The Collectors', text: '{detail}. Everybody has seen them. Nobody has seen them.', aspects: { testimony: 2 } },
          { type: 'clue', label: 'The Round', text: 'They collect in the same order every time, and {victim}\'s shop was on the list. {item} would tell you who else is.', aspects: { opportunity: 1, financial: 1 } },
        ] },
      { id: 'photographs', vars: { time: ['since the summer', 'since the night at the club', 'since the letter'], detail: ['photographs in a plain envelope', 'a telephone call at the same hour every night', 'a copy of a letter that should not exist'], item: ['a sum that doubles every month', 'a favour, then another', 'silence about a name'] },
        brief: '{victim} has been paying {time}, because of {detail}. What is wanted is {item}. They came to you because they cannot pay any more.',
        items: [
          { type: 'evidence', label: '{detail}', text: 'What they were shown. Handled, folded, handled again.', needs: 'prints',
            result: { label: 'Prints on the Envelope', text: 'The blackmailer\'s own hand, on the thing they were most careful about.', aspects: { forensic: 3 } } },
          { type: 'clue', label: 'The Price', text: '{item}. It is never really about the money, until it is.', aspects: { motive: 2, financial: 1 } },
        ] },
      { id: 'the_club', vars: { time: ['after the owner changed', 'since the new doorman', 'since the licence came up'], detail: ['a fire in the kitchen that was not an accident', 'a delivery that never arrives on time', 'a fight that starts whenever the till is full'], item: ['a percentage', 'the back room, for their own use', 'the club itself, eventually'] },
        brief: 'Things have gone wrong at {scene} {time}: {detail}. Somebody wants {item}, and {victim} is running out of ways to say no.',
        items: [
          { type: 'clue', label: 'Bad Luck, Regularly', text: '{detail}. Accidents do not keep a timetable.', aspects: { opportunity: 2 } },
          { type: 'clue', label: 'What They Want', text: '{item}. The demand has a shape, and the shape has a name.', aspects: { motive: 2 } },
        ] },
    ],
  };
})(typeof window !== 'undefined' ? window : globalThis);
