// Narrative content: how a run opens, the beats of the guided start, and
// how each ending reads. Several of each, so two runs of the same calling
// do not begin or end with the same words, and endings say what actually
// happened (a run of unanswered cases, a wrongful hanging, a clean record).
(function (G) {
  var CF = G.CF;
  var U = CF.util;

  var Story = (CF.Story = {});

  CF.OPENINGS = {
    commissioner: [
      { title: 'The Letter of Appointment', text: 'The Council\'s seal is still warm on the letter that makes you Examiner. The Burgomaster\'s chamber is up one flight and has a window; yours is under the stair and has a case on it already. Everyone in the Watch-house knows which one you are looking at.' },
      { title: 'The Watch-house on the Market', text: 'You asked for this Watch-house because the Council walks past it. A good record here is a record that is read. The sergeant hands you a case and the look of a man who has seen ambitious examiners before, and buried two.' },
      { title: 'A Word from the Chamber', text: 'A councillor took your hand this morning and said the city needs men who can answer a case and keep their own hands clean. Then he gave you one the crier has already sung.' },
    ],
    master: [
      { title: 'The Desk Under the Stair', text: 'The desk is yours now: the tallow stub, the cracked inkhorn, the case already waiting on it. The last examiner to sit here left in a hurry. The city did not stop to notice.' },
      { title: 'The Pattern', text: 'You took the Council\'s letter because something in this city does not add up: too many small crimes that fit together too neatly. Nobody else sees it yet. The first case on the desk is a burglary. Start there.' },
      { title: 'Somebody\'s Casebook', text: 'The drawer of your new desk still has the last examiner\'s quills in it, and a leaf torn from a casebook with one word underlined three times. You put it in your coat and open the first case.' },
    ],
    crusader: [
      { title: 'The Word Nobody Says', text: 'Nobody in this Watch-house will say the word Coquille aloud. You will. There is a burglary on the desk, and behind every burglary in this city there is somebody who bought what was taken.' },
      { title: 'After the Burial', text: 'You took the Council\'s letter the week after the burial. The man who did it walks the Hill in a good coat. Start with what is on the desk; it all leads to the same door in the end.' },
      { title: 'The Carolina', text: 'They gave you the Emperor\'s law with the letter: two witnesses, or a confession, or nothing. You have read it. You know exactly which pages you will tear out, and in what order. First, the burglary on the desk.' },
    ],
  };

  // The guided start's beats, by step (0-based), then the desk.
  CF.INTRO_BEATS = {
    0: { title: 'What the Scene Gives', text: 'A scene is never finished with you. What you carry away is raw: proof has to be made to speak in Study, and there is more to find if you go back with a different eye. Your Instinct is on the table now. Wit is patient; Instinct follows the itch.' },
    1: { title: 'People', text: 'Now there is somebody to talk to. How you go in matters: patience draws the truth out slowly, a bluff shakes things loose or frightens them off, and leaning on someone is fast and is remembered. Your Health is on the table; it is what you spend when you lean.' },
    2: { title: 'The Casebook', text: 'Two tokens are a pattern or a contradiction. Rest is where you lay them side by side: two descriptions of one person become an identification, coin and motive become a theory, and two different descriptions tell you that one of them is lying.' },
    3: { title: 'The Charge', text: 'An accused and the tokens that fit them make a charge. The Blood Court judges it by the Carolina, the Emperor\'s law: the right kinds of proof in enough weight, and it will tell you, before you commit, how it looks. Indicia, suspicion that is not yet proof, will not convict alone. A thin charge can still hang someone, and an acquitted man walks out remembering your face.' },
    4: { title: 'The Sworn Men', text: 'The sworn men, the citizens who sit with the judge, take as long as they take. The Watch-house does not wait: Attend is your hours, and your hours are Coin. Everything you will ever buy is bought there.' },
    5: { title: 'The Ladder', text: 'A conviction is not the end of a case. The Condemned wait in the Hole, the cells under the Watch-house, for your word, and the ladder is on your desk: from a Pardon to the Wheel, every rung with its price. Mercy and Cruelty are both counted, and the city remembers which you chose.' },
    acquit: { title: 'The Sworn Men Acquit', text: 'Not every charge holds. The one who walked out is Abroad now, on a card of their own, and remembers your face. If they did it, fresh proof can take them again.' },
    desk: { title: 'The Desk', text: 'The rest of the office arrives with the morning: your stipend, the petitions the treasury will consider, a letter from someone who would serve under you, and the quarters themselves. Lodging and dues come out at every bell. Cases arrive on the city\'s clock, and the clock does not wait for you to be ready.' },
  };
  var CALLING_BEATS = {
    commissioner: { desk: ' Every conviction is a line in a book somebody in the Council chamber is reading.' },
    master: { 2: ' The casebook is where you will one day see what nobody else does.' },
    crusader: { 3: ' Some of the people you indict will walk. Remember their names.' },
  };

  // Ending variants: the first whose `when` fits is used, else the last.
  CF.ENDING_VARIANTS = {
    dismissed: [
      { when: function (st) { return st.wrongful > 0; }, text: 'The city lost patience, and the wrong name on the gallows did the rest. The Burgomaster takes your letter of office back in front of the whole Watch-house and does not meet your eyes. Somewhere a man you sent to the rope is still saying, in the mouths of his friends, that he did not do it.' },
      { when: function (st) { return st.cold >= 6; }, text: 'Too many cases in the Rolls with no answer, too many names the crier sang walking the Market free. The Burgomaster takes your letter of office back in front of the whole Watch-house and does not meet your eyes. The unanswered stay unanswered.' },
      { text: 'The city lost patience. Too many names the crier sang, too many of them walking free. The Burgomaster takes your letter of office back in front of the whole Watch-house and does not meet your eyes.' },
    ],
    burnout: [
      { when: function (st) { return st.convictions >= 5; }, text: 'You answered more cases than anyone the Watch-house can remember, and one morning you simply do not come in. Or the next. The letter to the Council is two lines long. Somebody else sits under the stair now and inherits your name, and the cases keep coming.' },
      { text: 'One morning you simply do not come in. Or the next. The letter to the Council is two lines long. Someone else sits under the stair now, and the cases keep coming.' },
    ],
    collapse: [{ text: 'You fall on the Watch-house stair and do not get up. The barber-surgeon uses words like "a surfeit" and "the heart" and "rest, in the country". The city does not send flowers.' }],
    consumed: [
      { when: function (st) { return st.wrongful > 0; }, text: 'You stop going to your lodging. You stop answering to your name. When they finally break the door of your study, every wall is covered in string and paper, and in the middle of it is the face of someone you already sent to the rope. You were sure. You are still sure.' },
      { text: 'You stop going to your lodging. You stop shaving. You stop answering to your name. When they finally break the door of your study, every wall is covered, and none of it makes sense to anyone but you.' },
    ],
    corruption: [
      { when: function (st) { return st.convictions >= 6; }, text: 'The Council\'s sergeants come for you at first light. Your record of convictions was the best in the city, and every one of those cases is being read again now, leaf by leaf. The people you sent down are getting letters from advocates.' },
      // A run that never took a purse and barely hurt anyone came here by the doors it broke.
      { when: function (st, s) { var c = s.counts || {}; return (c.purse || 0) === 0 && (c.cruelty || 0) <= 1; }, text: 'The Council\'s sergeants come for you at first light. You never took a purse, and it does not matter: a door broken without a writ, a pardon without a reason, a name the Council wanted kept out of the dock. They kept a list. Lists do not ask why.' },
      { text: 'The Council\'s sergeants come for you at first light, with a writ and a sack for your things. The beaten confessions, the purses, the proof that appeared from nowhere. They kept a list too.' },
    ],
    // Who struck the last blow (stats.killedBy, set by hurtYou's cause): the Order, the Court of
    // Miracles, a borrowed name that slipped; the cudgel on the stair is the plain story.
    death: [
      { when: function (st) { return st.killedBy === 'order'; }, text: 'The Order of the Mountain warned you once, with a dagger on the pillow. The second time it sent a man in a servant\'s coat. They give you a bell, a Mass and a line in the Rolls, and nobody in the city will say they saw him.' },
      { when: function (st) { return st.killedBy === 'court'; }, text: 'The Court of Miracles threw you in the Warrens ditch, and this time you did not climb out. They give you a bell, a Mass and a line in the Rolls. Under the Warrens they drink your health, the wrong way.' },
      { when: function (st) { return st.killedBy === 'cover'; }, text: 'Your borrowed name slipped one night too many. They find you in the Harbour with it still in your coat. They give you a bell, a Mass and a line in the Rolls.' },
      { when: function (st) { return st.attacks >= 2; }, text: 'They came for you twice and warned you both times. The third time there was no warning. They give you a bell, a Mass and a line in the Rolls. The people who did it are drinking to your memory in a cellar by the Harbour.' },
      { text: 'They give you a bell, a Mass and a line in the Rolls. The people who did it are drinking to your memory in a cellar by the Harbour.' },
    ],
    merciful: [
      { when: function (st) { return st.reformed === 1; }, text: '{sentHome} times you sent a poor sinner home instead of to the Ravenstone, and one of them is a citizen now with a stall in the Market and children who do not know what their parents were. The Council never understood it. The city did. When you go, they carry the bier themselves.' },
      { text: '{sentHome} times you sent a poor sinner home instead of to the Ravenstone, and {reformed} of them are citizens now with stalls in the Market and children who do not know what their parents were. The Council never understood it. The city did. When you go, they carry the bier themselves.' },
    ],
    hangmans: [
      { when: function (st, s) { return s.who === 'hangman'; }, text: 'You began outside the walls and you end there. The Council keeps you because the city is quiet, and the city is quiet because it knows what you are. The executioner\'s house by the Ravenstone was always going to be your house. The work goes on.' },
      { text: 'The Council keeps you, because the city is quiet. The city fears you, because it knows why. You live outside the walls now, in the executioner\'s house by the Ravenstone, and dine with him, because nobody else will. The work goes on. It is very quiet.' },
    ],
    stake: [{ text: 'The Inquisitor\'s charge lands on you: heresy, from a patron you crossed, sworn to by two men you sent to the Hole. The proof against you is the proof you taught the city to want. The Bishop does not answer your letter. The Fire on Friday.' }],
    dagger: [{ text: 'They warned you once. A dagger on the pillow, and the door still barred. You did not pay, and you did not leave, and one morning the servant who brings the water is not the servant. The Order of the Mountain keeps its word, in daylight, before witnesses, and nobody in the city will say they saw it.' }],
    kingofthunes: [
      { when: function (st, s) { return (s.counts || {}).cruelty >= 6; }, text: 'The old King goes into the river and the Court kneels to a new one it fears more than it feared him. You keep the Examiner\'s desk by day and the barrel by night, and the two offices never meet. Crimes fall in number and rise in scale. You decide who is caught. The city sleeps better and does not know why.' },
      { text: 'The old King goes into the river and the Court kneels to a new one who keeps the Examiner\'s desk by day. Crimes fall in number and rise in scale. You decide who is caught, and the Council thanks you for the quiet. Under the Warrens, where the lame walk and the blind see, they sing a new name.' },
    ],
    treatycity: [
      { when: function (st) { return (st.scapegoats || 0) >= 2; }, text: 'Twelve quiet weeks. The Court tried its own, and some of the names it found in the Warrens ditch were not the right ones; you did not look. The Council votes you a pension for the calm it does not ask about. You retire rich to a house on the Hill. The city calls it peace.' },
      { text: 'Twelve quiet weeks. The Stews keep their own peace, the Court tries its own, the Rolls fill with answered cases, and the Council votes you a pension for the calm it does not ask about. You retire rich to a house on the Hill. The city calls it peace, and for the years you have left, it is.' },
    ],
    thieftaker: [
      { when: function (st) { return (st.frames || 0) >= 1; }, text: 'The city has never had an officer so effective, or so rich. Every fence pays you, every victim thanks you, and the Council votes you a chain of office. There is one name in your ledger that should not be there, one man who hanged on two witnesses who would swear to anything, and you have stopped thinking about him. Mostly.' },
      { text: 'The city has never had an officer so effective, or so rich. Every fence in the Free City pays you, every victim thanks you, and the Council votes you a chain of office without asking where the goods you recover come from. You know. You are the only one who does. It will hold for years, if nobody ever reads the ledger.' },
    ],
    oldbailey: [
      { when: function (st) { return st.wrongful >= 3; }, text: 'Three names on the gallows that should not have been there, and the third had a brother with a ledger. The Council makes a new law with your trade in it, word for word, and tries you under it in the same court where you sent so many. Two witnesses. Your own men.' },
      { text: 'Somebody you hanged had a brother, and the brother had a ledger. The Council makes a new law with your trade in it, word for word, and tries you under it in the same court where you sent so many. Two witnesses. Your own men. The ballad is already printed.' },
    ],
    riot: [
      { when: function (st, s) { return (s.counts || {}).cruelty >= 8; }, text: 'You put too many of them to the question, and the quarters counted. The next execution is meant to be a lesson; the crowd has learned a different one. When the cart reaches the Ravenstone they take the poor sinner off it, and then they come for you. You leave by the Harbour gate with what you are wearing.' },
      { text: 'The next execution is meant to be a lesson. The crowd has learned a different one. When the cart reaches the Ravenstone they take the poor sinner off it, and then they come for you. You get out of the city by the Harbour gate with what you are wearing. The Council does not send after you.' },
    ],
    commissioner: [
      { when: function (st, s) { return s.origin !== 'commissioner'; }, text: 'You did not set out for the Seat; the work walked you to it. The Council votes, and it is not close. You take the chamber with the window and the city\'s Watch, and you begin, slowly, to remake it in your own image. Somewhere a new examiner sits under the stair, chasing what you used to chase.' },
      { when: function (st) { return st.wrongful > 0; }, text: 'The Council votes, and it is not close. You take the Seat, the chamber with the window and the city\'s Watch. On your first night in it you read one old case again, the one with the wrong name in it, and then you put it back in the Rolls.' },
      { text: 'The Council votes, and it is not close. You take the Seat, the chamber with the window and the city\'s Watch, and you begin, slowly, to remake it in your own image. Somewhere a new examiner sits under the stair. You make sure they have what you did not.' },
    ],
    master: [
      { when: function (st, s) { return s.origin !== 'master'; }, text: 'You did not come to this city to find a pattern. The pattern found you. The Architect is sentenced on a grey Tuesday, and every case you ever worked turns out to have been a line in someone else\'s drawing. You find the same three strokes cut into your own lintel, and you rub them out with your thumb.',
        named: 'You did not come to this city to find a pattern. The pattern found you. The Architect is sentenced on a grey Tuesday: {architect}, {architectRole}, who always asked so kindly after your cases. Every case you ever worked turns out to have been a line in someone else\'s drawing. You find the same three strokes cut into your own lintel, and you rub them out with your thumb.' },
      { when: function (st) { return st.cold >= 4; }, text: 'The Architect is sentenced on a grey Tuesday. Half your unanswered cases answer themselves the same week; the other half never will, and you know exactly which. The scriveners are already copying your casebook. You find the same three strokes cut into your own lintel, and you rub them out with your thumb.',
        named: 'The Architect is sentenced on a grey Tuesday: {architect}, {architectRole}, who always asked so kindly after your cases. Half your unanswered cases answer themselves the same week; the other half never will, and you know exactly which. The scriveners are already copying your casebook. You find the same three strokes cut into your own lintel, and you rub them out with your thumb.' },
      { text: 'The Architect is sentenced on a grey Tuesday. Every crime you ever worked had their hand on it, if you knew where to look. You did. The scriveners are copying your casebook for the law faculties, and it will be called after you for a hundred years. You find the same three strokes cut into your own lintel, and you rub them out with your thumb.',
        named: 'The Architect is sentenced on a grey Tuesday: {architect}, {architectRole}, who always asked so kindly after your cases. Every crime you ever worked had their hand on it, if you knew where to look. You did. The scriveners are copying your casebook for the law faculties, and it will be called after you for a hundred years. You find the same three strokes cut into your own lintel, and you rub them out with your thumb.' },
    ],
    crusader: [
      { when: function (st, s) { return s.meters.scrutiny >= 7; }, text: 'The Court of Miracles is a wet cellar with nobody in it. So, very nearly, is your file in the Council chamber: they have been keeping it for the day the Coquille fell, and now they open it. It cost you more than you will ever say, and it may cost your office yet. For one bright season, nobody in this city was above the law.' },
      { when: function (st, s) { return s.origin !== 'crusader'; }, text: 'You never called yourself a reformer. The Court of Miracles is a wet cellar with nobody in it all the same, and the King of Thunes hangs on the Ravenstone. The city will grow new thieves like weeds through cobbles. But for one bright season, nobody is above the law, and it was you.',
        named: 'You never called yourself a reformer. The Court of Miracles is a wet cellar with nobody in it all the same, and the King of Thunes, {king}, hangs on the Ravenstone. The city will grow new thieves like weeds through cobbles. But for one bright season, nobody is above the law, and it was you.' },
      { text: 'The Court of Miracles is a wet cellar with nobody in it. The King of Thunes hangs on the Ravenstone. It cost you more than you will ever say, and the city will grow new thieves like weeds through cobbles. But for one bright season, nobody is above the law.',
        named: 'The Court of Miracles is a wet cellar with nobody in it. The King of Thunes, {king}, hangs on the Ravenstone. It cost you more than you will ever say, and the city will grow new thieves like weeds through cobbles. But for one bright season, nobody is above the law.' },
    ],
  };

  // What would have saved you, on the end paper: the ending's own lesson (CF.ENDINGS[id].lesson,
  // made particular by s.over.cause in e.endingLesson): { restIdle: true } says Rest stood empty
  // while the Fever's clock ran.
  CF.ENDING_REST_IDLE = 'Rest stood idle the whole time the Fever ran.';

  // Five first mornings, one per origin (docs/CITY.md §2).
  CF.OPENINGS_WHO = {
    advocate: { title: 'The Commission', text: 'Ten years you stood before the Blood Court and argued the Carolina at the sworn men; this morning the Council hands you the other side of the table. A commission under the city\'s seal, a stipend, a desk under the stair. Your old clients are already asking one another what you know.' },
    hangman: { title: 'Summoned from the Ravenstone', text: 'The Council\'s clerk would not come down to your house outside the walls; he sent a boy. You are to examine for the city, because you have read more bodies than any physician in it. You are not to sit at any patrician\'s table. Nobody needed to write that part down.' },
    monk: { title: 'Out of the Garden', text: 'The Abbot lent you to the Council with a letter that praised your knowledge of herbs, wounds and hearts, and did not mention that he wanted you out of his garden. You may not carry a sword. You may carry a case of instruments, and you do.' },
    watchman: { title: 'The Last Night Round', text: 'Twenty years you cried the hours with a cudgel and a lantern, and this morning the Council makes you Examiner because the last one is dead and you were standing nearest. You cannot read the letter. The sergeant reads it to you, slowly, and does not smile.' },
    clerk: { title: 'The Rolls in Your Hand', text: 'You copied the last Examiner\'s day-book for six years and know every form, fee and seal in the city. Now the day-book is yours. You have never walked a round, questioned a thief or been in a fight. The first case on the desk does not know that.' },
  };
  Story.opening = function (e) {
    var list = CF.OPENINGS[e.s.origin] || CF.OPENINGS.master;
    var op = e.s.who && CF.OPENINGS_WHO[e.s.who] ? CF.OPENINGS_WHO[e.s.who] : list[e.s.seed % list.length];
    return op;
  };
  Story.beat = function (e, key) {
    var b = CF.INTRO_BEATS[key];
    if (!b) return null;
    var extra = (CALLING_BEATS[e.s.calling] || {})[key] || '';
    return { title: b.title, text: b.text + extra };
  };
  // A won run looks back, at the end, to the death it began with (the opening's victim).
  CF.ENDING_FIRST_CASE = 'The first case in your casebook is still the death of {victim}. You never needed to read it again.';
  // A count told in words, as a chronicle would: 'seven', 'twelve'; digits past a dozen.
  var WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  Story.words = function (n, cap) {
    var w = n >= 0 && n < WORDS.length && n === Math.floor(n) ? WORDS[n] : String(n);
    return cap ? w.charAt(0).toUpperCase() + w.slice(1) : w;
  };
  // Who the run named, for the endings that name them: the King of Thunes ({king}) and the
  // Architect with what they were to the city ({architect}, {architectRole}).
  function named(s) {
    var out = {}, crim = s.criminals || {};
    if (s.court && s.court.king && s.court.king.name) out.king = s.court.king.name;
    for (var id in crim) if (!out.king && crim[id] && crim[id].king) out.king = crim[id].name;
    for (var k in s.cases || {}) {
      var rec = s.cases[k];
      if (!rec || rec.template !== 'architect') continue;
      var g = (rec.suspects || []).filter(function (x) { return x.guilty; })[0];
      if (g && g.name && g.role && (!out.architect || rec.status === 'closed')) { out.architect = g.name; out.architectRole = g.role; }
    }
    return out;
  }
  // The run's numbers for an ending. A save from before the count of those sent home still
  // knows who was: every reformed citizen, and every rogue spared by a pardon, went home from
  // the bench. So the count is never fewer than they. The counts the Merciful Judge reads aloud
  // are words ({sentHome} opens its sentence).
  function endingCounts(s) {
    var st = s.stats || {}, crim = s.criminals, out = named(s), home = 0;
    for (var k in st) out[k] = st[k];
    for (var id in crim || {}) { var c = crim[id]; if (c && (c.status === 'reformed' || (c.traits || []).indexOf('spared') >= 0)) home++; }
    out.sentHome = Story.words(Math.max(st.sentHome || 0, st.reformed || 0, home), true);
    out.reformed = Story.words(st.reformed || 0);
    return out;
  }
  // A variant's named telling, when the run knows every name it asks for.
  function told(v, vars) {
    if (!v.named) return v.text;
    var need = v.named.match(/\{\w+\}/g) || [];
    return need.every(function (p) { return vars[p.slice(1, -1)] !== undefined; }) ? v.named : v.text;
  }
  // The ending's text, with the run's own numbers and names where it has them.
  Story.ending = function (e, id) {
    var list = CF.ENDING_VARIANTS[id], text;
    if (!list || !list.length) text = CF.ENDINGS[id].text;
    else {
      // The first variant whose condition fits; otherwise one of the plain ones.
      var fit = list.filter(function (v) { return v.when && v.when(e.s.stats || {}, e.s); });
      var plain = list.filter(function (v) { return !v.when; });
      var pool = plain.length ? plain : [list[list.length - 1]];
      var vars = endingCounts(e.s);
      text = U.fill(told(fit.length ? fit[0] : pool[e.s.seed % pool.length], vars), vars);
    }
    var victim = e.firstVictim ? e.firstVictim() : null;
    if (victim && CF.ENDINGS[id] && CF.ENDINGS[id].win) text += ' ' + U.fill(CF.ENDING_FIRST_CASE, { victim: victim });
    return text;
  };

  // ---- Words for the dossier --------------------------------------------------------
  // What an instrument's boost reads on: its tags in words (CF.TAGS[t].words), never their ids
  // ('biology'), joined as a list each part of which is a key, so the line reads whole in every language.
  CF.BOOST_LINE = '{list}, on finds from {tags}';
  // The line in English, for an instrument's boost; the dossier translates it whole.
  Story.boostLine = function (boost) {
    if (!boost || !boost.aspects) return null;
    var list = Object.keys(boost.aspects).map(function (x) { return (CF.ASPECTS[x] ? CF.ASPECTS[x].label : x) + ' +' + boost.aspects[x]; }).join(', ');
    var tags = (boost.tags || []).map(function (t) { return (CF.TAGS[t] && CF.TAGS[t].words) || t; }).join(', ');
    return U.fill(CF.BOOST_LINE, { list: list, tags: tags });
  };

  // ---- What Became of Them -----------------------------------------------------------
  // Under the ending, up to four short lines told back from the run's own state: the Pattern,
  // the King of Thunes, the Rival's examiners, the worst of those Abroad, the watchman who stays.
  // Read from state alone (no dice), so one seed played one way tells one epilogue. This is the
  // one telling: the engine's e.epilogue() (kept in s.over.epilogue) and the end paper read it.
  CF.EPILOGUE = {
    title: 'What Became of Them',
    pattern: { icon: 'case', never: 'The girls of {scene}: never answered. He still walks the lanes.',
      doors: ['The girls of {scene}: answered at the first door.', 'The girls of {scene}: answered at the second door.',
        'The girls of {scene}: answered at the third door.', 'The girls of {scene}: answered at the fourth door.',
        'The girls of {scene}: answered at the fifth door.'] },
    king: { icon: 'syndicate', sits: '{king} still sits on his barrel.', treaty: '{king} keeps the Treaty, and his barrel.',
      hangs: '{king} hangs on the Ravenstone.', fallen: 'The Court of Miracles is scattered, and {king} hangs on the Ravenstone.',
      kneels: '{king} went into the river, and the Court kneels to you.' },
    rival: { icon: 'rival', one: 'One examiner sent home to the Customs House.', two: 'Two examiners sent home to the Customs House.',
      many: '{n} examiners sent home to the Customs House.', sealed: 'The Harbourmaster fell. Nobody sends examiners now.' },
    abroad: { icon: 'atlarge', once: '{name}, who walked from you once, was last seen near {where}.',
      twice: '{name}, who walked from you twice, was last seen near {where}.',
      many: '{name}, who walked from you {k} times, was last seen near {where}.' },
    watch: { icon: 'teammate', text: '{name} is sergeant of the Watch now.' },
  };
  // A line: { id (pattern, coquille, rival, abroad, watch), kind (the same, for the end paper's seal),
  // icon (a card def), key (its template), vars, text (filled, English) }.
  function epiLine(id, icon, key, vars) { return { id: id, kind: id, icon: icon, key: key, vars: vars, text: U.fill(key, vars) }; }
  function abroadNamed(s, name) {
    for (var id in s.criminals || {}) {
      var c = s.criminals[id];
      if (c && c.name === name) return c.status === 'at_large' || c.status === 'hunted';
    }
    return false;
  }
  // The Pattern, if it came: answered only by a conviction that did not leave him Abroad.
  function epiPattern(s) {
    var E = CF.EPILOGUE.pattern, rec = null;
    for (var id in s.cases || {}) if (s.cases[id] && s.cases[id].template === 'pattern') rec = s.cases[id];
    if (!rec || !rec.scene) return null;
    var g = (rec.suspects || []).filter(function (x) { return x.guilty; })[0];
    if (rec.status !== 'closed' || (g && abroadNamed(s, g.name))) return epiLine('pattern', E.icon, E.never, { scene: rec.scene });
    var n = Math.max(1, Math.min(E.doors.length, rec.victims || 1));
    return epiLine('pattern', E.icon, E.doors[n - 1], { scene: rec.scene });
  }
  // The King of Thunes, once the bands swore to him: on his barrel, under the Treaty, hanged when his
  // Court came down, or gone into the river with the Court kneeling to you.
  function epiKing(s) {
    var E = CF.EPILOGUE.king, court = s.court, king = court && court.king;
    if (!king || !king.name) return null;
    var crim = king.criminalId && s.criminals ? s.criminals[king.criminalId] : null;
    var fallen = (s.flags && s.flags.syndicateFallen) || Object.keys(s.cases || {}).some(function (k) { var r = s.cases[k]; return r && r.template === 'syndicate' && r.status === 'closed'; });
    var over = s.over && s.over.id, key = E.sits;
    if (over === 'kingofthunes') key = E.kneels;
    else if (fallen) key = E.fallen;
    else if ((crim && crim.status === 'dead') || over === 'crusader') key = E.hangs;
    else if (court.stance === 'treaty') key = E.treaty;
    return epiLine('coquille', E.icon, key, { king: king.name });
  }
  // The Harbourmaster's examiners sent home (each one 'The Rival Exposed'), or the man himself fallen.
  function epiRival(s) {
    var E = CF.EPILOGUE.rival, st = s.stats || {};
    if (s.flags && s.flags.harbourFallen) return epiLine('rival', E.icon, E.sealed, {});
    var n = (s.journal || []).filter(function (j) { return j.title === 'The Rival Exposed'; }).length;
    n = Math.max(n, st.rivalExposed || 0, st.rivalsExposed || 0);
    if (!n) return null;
    return epiLine('rival', E.icon, n === 1 ? E.one : n === 2 ? E.two : E.many, n > 2 ? { n: Story.words(n, true) } : {});
  }
  // Of those Abroad, the one who walked from you most often (never the King: he has his line). A walk is
  // a case that let them go: gone cold, acquitted, another hanged in their place, the Rival's, slipped, burned.
  var WALKED = { cold: 1, acquitted: 1, wrongful: 1, rival: 1, slipped: 1, burned: 1 };
  function walked(c) { return (c.history || []).filter(function (h) { return WALKED[h.how]; }); }
  function epiAbroad(s) {
    var E = CF.EPILOGUE.abroad, best = null, bestK = 0;
    for (var id in s.criminals || {}) {
      var c = s.criminals[id];
      if (!c || c.king || (c.status !== 'at_large' && c.status !== 'hunted')) continue;
      var k = walked(c).length;
      if (k > bestK || (k && k === bestK && (c.crimes || 0) > (best.crimes || 0))) { best = c; bestK = k; }
    }
    if (!best) return null;
    var titled = (best.history || []).filter(function (h) { return !!h.title; }), last = titled[titled.length - 1], where = null;
    if (last) for (var cid in s.cases || {}) if (s.cases[cid] && s.cases[cid].title === last.title && s.cases[cid].scene) where = s.cases[cid].scene;
    if (!where) where = CF.DISTRICTS && CF.DISTRICTS[best.district] ? CF.DISTRICTS[best.district].label : 'the Warrens';
    var key = bestK === 1 ? E.once : bestK === 2 ? E.twice : E.many;
    return epiLine('abroad', E.icon, key, bestK > 2 ? { name: best.name, k: Story.words(bestK), where: where } : { name: best.name, where: where });
  }
  // The watchman drilled the most (the first sworn, on a tie) keeps the Watch after you: a Beadle or a
  // Sergeant, the Watch's own men (a Clerk, a Confessor or the boy is not made sergeant).
  var WATCH_POSTS = { rookie: 1, veteran: 1 }, WATCH_ROLES = { Beadle: 1, Sergeant: 1 };
  function epiWatch(s) {
    var best = null;
    for (var uid in s.cards || {}) {
      var c = s.cards[uid];
      if (!c || c.def !== 'teammate' || !c.loc || !c.data || !c.data.name) continue;
      if (!(c.data.personnel ? WATCH_POSTS[c.data.personnel] : WATCH_ROLES[c.data.role])) continue;
      var lv = c.data.level || 1, bl = best ? best.data.level || 1 : 0;
      if (!best || lv > bl || (lv === bl && Number(c.uid) < Number(best.uid))) best = c;
    }
    return best ? epiLine('watch', CF.EPILOGUE.watch.icon, CF.EPILOGUE.watch.text, { name: best.data.name }) : null;
  }
  // Up to four lines. The ending page shows them under CF.EPILOGUE.title, translated with CF.T(line.key, line.vars).
  Story.epilogue = function (e) {
    var s = e.s;
    return [epiPattern(s), epiKing(s), epiRival(s), epiAbroad(s), epiWatch(s)].filter(function (l) { return !!l; }).slice(0, 4);
  };

  // ---- The Year ---------------------------------------------------------------------
  // Fifty-two weeks to a year, a quarter to a season (CF.SEASONS in engine.js: the names, the
  // Bell's line, and the crimes a season brings). Here, the words read from them: the season of a
  // week (the week bar's tooltip) and the Bell's line on a season's first week.
  // The season of a week: { id, name, first (its first week, this year), year (1, 2...) }.
  Story.season = function (week) {
    var Y = CF.YEAR_WEEKS || 52, w = Math.max(1, week || 1), at = (w - 1) % Y + 1, sw = CF.SEASONS[0];
    CF.SEASONS.forEach(function (x) { if (at >= x.from) sw = x; });
    return { id: sw.id, name: sw.name, first: w - (at - sw.from), year: Math.floor((w - 1) / Y) + 1 };
  };
  // The season's line on its first week ('Week 27. The Plague Summer: ...'), else null.
  CF.SEASON_BELL = 'Week {n}. {line}';
  Story.seasonBell = function (week) {
    var se = Story.season(week);
    if (se.first !== week) return null;
    return U.fill(CF.SEASON_BELL, { n: week, line: CF.SEASONS.filter(function (x) { return x.id === se.id; })[0].line });
  };

  // The Assize: halfway through the year the Council sits as a court and its clerk reads your
  // service aloud. Story.assize tells it from s.stats, one sentence per thing the Rolls hold, so
  // every sentence is a key of its own (none opens on a count): the cases, how many were answered, the one thing the
  // chamber remembers, and how the benches take it. The question that follows is patrons.js's
  // ('assize'); the engine keeps the record it is read from (assizeWeek).
  CF.ASSIZE = {
    title: 'The Assize',
    open: 'The Council sits for the Assize, and its clerk reads your service aloud from the Rolls.',
    cases: { one: 'He reads out one case with your name on it.', many: 'He reads out {n} cases with your name on them.' },
    convictions: { none: 'Not one has ended in a conviction yet.', one: 'Of these, one ended in a conviction.', many: 'Of these, {n} ended in a conviction.' },
    // The first that fits is read.
    remembered: [
      { when: function (st) { return st.wrongful === 1; }, text: 'One name was the wrong one, and the chamber is quiet while it is read.' },
      { when: function (st) { return st.wrongful >= 2; }, text: 'There were {n} wrong names among them, and the chamber is quiet while they are read.', n: 'wrongful' },
      { when: function (st) { return st.sentHome >= 3; }, text: 'You sent {n} home from the Bench instead of to the Ravenstone.', n: 'sentHome' },
      { when: function (st) { return st.cold >= 3; }, text: 'The clerk reads the {n} gone cold more slowly.', n: 'cold' },
      { when: function (st) { return st.attacks === 2; }, text: 'Somebody came for you on the stair twice, and you are still here.' },
      { when: function (st) { return st.attacks >= 3; }, text: 'Somebody came for you on the stair {n} times, and you are still here.', n: 'attacks' },
    ],
    praised: 'The benches knock on the wood. That is the Council\'s applause.',
    quiet: 'The benches are quiet.',
    murmur: 'The benches murmur, and the clerk ties the Rolls up again.',
    ask: 'The Burgomaster asks what you want for it.',
  };
  Story.assize = function (e) {
    var A = CF.ASSIZE, st = e.s.stats || {}, out = [A.open];
    var cases = st.cases || 0, conv = st.convictions || 0, cold = st.cold || 0, wrong = st.wrongful || 0;
    if (cases) out.push(cases === 1 ? A.cases.one : U.fill(A.cases.many, { n: cases }));
    out.push(!conv ? A.convictions.none : conv === 1 ? A.convictions.one : U.fill(A.convictions.many, { n: conv }));
    var mem = A.remembered.filter(function (r) { return r.when(st); })[0];
    if (mem) out.push(mem.n ? U.fill(mem.text, { n: st[mem.n] }) : mem.text);
    out.push(conv >= 3 && !wrong && conv >= cold ? A.praised : cold > conv ? A.quiet : A.murmur);
    out.push(A.ask);
    return out.join(' ');
  };

  // The Long Service: a run at its rank cap that has not otherwise ended is pensioned at the
  // year's end, told four weeks before. The ending's words are CF.ENDING_VARIANTS.longservice.
  CF.LONG_SERVICE = {
    week: 52, warn: 4, // engine.js counts them (longServiceDue)
    title: 'The Long Service',
    warnTitle: 'Your Pension',
    warnText: 'The Council is drawing up your pension. Four more weeks.',
  };
  // A year at least: the pension can fall due later than week 52 (longServiceDue), so the ending says a year, not the weeks.
  CF.ENDING_VARIANTS.longservice = [
    { when: function (st) { return st.wrongful === 1; }, text: 'A year under the stair and in the chamber, and the city is still standing. The Council gives you a pension, a house by the Abbey Close and a line in the Rolls in red ink. One name in your casebook should not be there, and you go to the Close with it. You never caught them all. Nobody does.' },
    { when: function (st) { return st.wrongful >= 2; }, text: 'A year under the stair and in the chamber, and the city is still standing. The Council gives you a pension, a house by the Abbey Close and a line in the Rolls in red ink. There are {wrongful} names in your casebook that should not be there, and you go to the Close with them. You never caught them all. Nobody does.' },
    { when: function (st) { return st.convictions >= 12 && !st.wrongful; }, text: 'A year under the stair and in the chamber, and the city is still standing. The Council gives you a pension, a house by the Abbey Close and a line in the Rolls in red ink. The scriveners copy your casebook for the next one under the stair. You never caught them all. Nobody does.' },
    { text: 'A year under the stair and in the chamber, and the city is still standing. The Council gives you a pension, a house by the Abbey Close and a line in the Rolls in red ink. You never caught them all. Nobody does.' },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
