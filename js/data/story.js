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
    2: { title: 'The Casebook', text: 'Two tokens are a pattern or a contradiction. Contemplate is where you lay them side by side: two descriptions of one person become an identification, coin and motive become a theory, and two different descriptions tell you that one of them is lying.' },
    3: { title: 'The Charge', text: 'An accused and the tokens that fit them make a charge. The Blood Court wants the right kinds of proof in enough weight, and it will tell you, before you commit, how it looks. Indicia will not convict alone. A thin charge can still hang someone, and an acquitted man walks out remembering your face.' },
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
      { text: 'The Council\'s sergeants come for you at first light, with a writ and a sack for your things. The beaten confessions, the purses, the proof that appeared from nowhere. They kept a list too.' },
    ],
    death: [
      { when: function (st) { return st.attacks >= 2; }, text: 'They came for you twice and warned you both times. The third time there was no warning. They give you a bell, a Mass and a line in the Rolls. The people who did it are drinking to your memory in a cellar by the Harbour.' },
      { text: 'They give you a bell, a Mass and a line in the Rolls. The people who did it are drinking to your memory in a cellar by the Harbour.' },
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
      { when: function (st, s) { return (s.counts || {}).cruelty >= 6; }, text: 'You put too many of them to the question, and the quarters counted. The next execution is meant to be a lesson; the crowd has learned a different one. When the cart reaches the Ravenstone they take the poor sinner off it, and then they come for you. You leave by the Harbour gate with what you are wearing.' },
      { text: 'The next execution is meant to be a lesson. The crowd has learned a different one. When the cart reaches the Ravenstone they take the poor sinner off it, and then they come for you. You get out of the city by the Harbour gate with what you are wearing. The Council does not send after you.' },
    ],
    commissioner: [
      { when: function (st, s) { return s.origin !== 'commissioner'; }, text: 'You did not set out for the Seat; the work walked you to it. The Council votes, and it is not close. You take the chamber with the window and the city\'s Watch, and you begin, slowly, to remake it in your own image. Somewhere a new examiner sits under the stair, chasing what you used to chase.' },
      { when: function (st) { return st.wrongful > 0; }, text: 'The Council votes, and it is not close. You take the Seat, the chamber with the window and the city\'s Watch. On your first night in it you read one old case again, the one with the wrong name in it, and then you put it back in the Rolls.' },
      { text: 'The Council votes, and it is not close. You take the Seat, the chamber with the window and the city\'s Watch, and you begin, slowly, to remake it in your own image. Somewhere a new examiner sits under the stair. You make sure they have what you did not.' },
    ],
    master: [
      { when: function (st, s) { return s.origin !== 'master'; }, text: 'You did not come to this city to find a pattern. The pattern found you. The Architect is sentenced on a grey Tuesday, and every case you ever worked turns out to have been a line in someone else\'s drawing. You fold a paper crane, and throw it in the fire.' },
      { when: function (st) { return st.cold >= 4; }, text: 'The Architect is sentenced on a grey Tuesday. Half your unanswered cases answer themselves the same week; the other half never will, and you know exactly which. The scriveners are already copying your casebook. You fold a paper crane, and throw it in the fire.' },
      { text: 'The Architect is sentenced on a grey Tuesday. Every crime you ever worked had their hand on it, if you knew where to look. You did. The scriveners are copying your casebook for the law faculties, and it will be called after you for a hundred years. You fold a paper crane, and throw it in the fire.' },
    ],
    crusader: [
      { when: function (st, s) { return s.meters.scrutiny >= 7; }, text: 'The Court of Miracles is a wet cellar with nobody in it. So, very nearly, is your file in the Council chamber: they have been keeping it for the day the Coquille fell, and now they open it. It cost you more than you will ever say, and it may cost your office yet. For one bright season, nobody in this city was above the law.' },
      { when: function (st, s) { return s.origin !== 'crusader'; }, text: 'You never called yourself a reformer. The Court of Miracles is a wet cellar with nobody in it all the same, and the King of Thunes hangs on the Ravenstone. The city will grow new thieves like weeds through cobbles. But for one bright season, nobody is above the law, and it was you.' },
      { text: 'The Court of Miracles is a wet cellar with nobody in it. The King of Thunes hangs on the Ravenstone. It cost you more than you will ever say, and the city will grow new thieves like weeds through cobbles. But for one bright season, nobody is above the law.' },
    ],
  };

  Story.opening = function (e) {
    var list = CF.OPENINGS[e.s.origin] || CF.OPENINGS.master;
    var op = list[e.s.seed % list.length];
    if (e.s.legacyFrom) return { title: op.title, text: op.text + ' Your predecessor, ' + e.s.legacyFrom + ', left you their unanswered cases and their enemies.' };
    return op;
  };
  Story.beat = function (e, key) {
    var b = CF.INTRO_BEATS[key];
    if (!b) return null;
    var extra = (CALLING_BEATS[e.s.calling] || {})[key] || '';
    return { title: b.title, text: b.text + extra };
  };
  Story.ending = function (e, id) {
    var list = CF.ENDING_VARIANTS[id];
    if (!list || !list.length) return CF.ENDINGS[id].text;
    // The first variant whose condition fits; otherwise one of the plain ones.
    var fit = list.filter(function (v) { return v.when && v.when(e.s.stats, e.s); });
    if (fit.length) return fit[0].text;
    var plain = list.filter(function (v) { return !v.when; });
    var pool = plain.length ? plain : [list[list.length - 1]];
    return pool[e.s.seed % pool.length].text;
  };
  void U;
})(typeof window !== 'undefined' ? window : globalThis);
