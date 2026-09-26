// Narrative content: how a run opens, the beats of the guided start, and
// how each ending reads. Several of each, so two runs of the same calling
// do not begin or end with the same words, and endings say what actually
// happened (a cold streak, a wrongful conviction, a clean record).
(function (G) {
  var CF = G.CF;
  var U = CF.util;

  var Story = (CF.Story = {});

  CF.OPENINGS = {
    commissioner: [
      { title: 'Your First Day', text: 'The desk is yours now, and so is the ladder. Everyone in the squad room knows which one you are looking at. The Commissioner\'s office is four floors up and has a window; yours has a file already waiting in the tray.' },
      { title: 'The Transfer', text: 'You asked for this precinct because it is the one the brass watch. A good record here is a record that gets read. The sergeant hands you a case and a look that says he has seen ambitious detectives before.' },
      { title: 'A Word from Upstairs', text: 'The Deputy Commissioner shook your hand this morning and said the city needs people who can close cases and keep their noses clean. Then he gave you a case that has already been in the paper.' },
    ],
    master: [
      { title: 'Your First Day', text: 'The desk is yours now, along with the cold coffee, the ringing phone and the file already waiting in the tray. The last detective to sit here left in a hurry. The city did not stop to notice.' },
      { title: 'The Pattern', text: 'You took the badge because something in this city does not add up: too many small crimes that fit together too neatly. Nobody else sees it yet. The first file in the tray is a burglary. Start there.' },
      { title: 'Somebody\'s Notes', text: 'The drawer of your new desk still has the last detective\'s pencils in it, and a page torn from a notebook with a single word underlined three times. You put it in your pocket and open the first file.' },
    ],
    crusader: [
      { title: 'Your First Day', text: 'Nobody in this precinct will say the word Syndicate out loud. You will. There is a burglary in the tray, and behind every burglary in this city there is somebody who bought what was taken.' },
      { title: 'The Funeral', text: 'You took the badge the week after the funeral. The man who did it is walking around Uptown in a good coat. Start with what is in the tray; it all leads to the same door eventually.' },
      { title: 'Rules', text: 'They gave you the rulebook with the badge. You have read it. You know exactly which pages you will tear out, and in what order. First, the burglary in the tray.' },
    ],
  };

  // The guided start's beats, by step (0-based), then the desk.
  CF.INTRO_BEATS = {
    0: { title: 'What the Scene Gives', text: 'A scene is never finished with you. What you carry away is raw: evidence has to be processed, and there is more to find if you go back with a different eye. Your Instinct is on the table now; Focus is patient, Instinct follows hunches.' },
    1: { title: 'People', text: 'Now there is somebody to talk to. How you go in matters: patience draws out the truth, a bluff shakes things loose or scares them off, and leaning on someone is fast and remembered. Your Health is on the table; it is what you spend when you lean.' },
    2: { title: 'The Wall', text: 'Two clues are a pattern or a contradiction. Reflect is where you lay them side by side: descriptions of the same person become an identification, money and motive become a theory, and two different descriptions tell you one of them is lying.' },
    3: { title: 'The Charge', text: 'A suspect and the clues that fit them make a charge. The court wants the right kinds of proof in enough weight; it will tell you, before you commit, how strong it looks. A weak charge can still convict, and an acquitted suspect walks out remembering your face.' },
    desk: { title: 'The Desk', text: 'The rest of the job arrives with the morning post: your pay, the forms for what you can requisition, a file on someone who could join you, and the streets themselves. Rent comes out every week. Cases arrive on their own clock, and the clock does not wait for you to be ready.' },
  };
  var CALLING_BEATS = {
    commissioner: { desk: ' Every conviction is a line in a record somebody upstairs is reading.' },
    master: { 2: ' The wall is where you will eventually see what nobody else does.' },
    crusader: { 3: ' Some of the people you charge will walk. Remember their names.' },
  };

  // Ending variants: the first whose `when` fits is used, else the last.
  CF.ENDING_VARIANTS = {
    dismissed: [
      { when: function (st) { return st.wrongful > 0; }, text: 'The city lost patience, and the wrong name in the wrong cell did the rest. The Commissioner takes your badge in front of the whole squad room and does not meet your eyes. Somewhere a person you put away is still saying they did not do it.' },
      { when: function (st) { return st.cold >= 6; }, text: 'Too many files in the basement, too many names on the front page walking free. The Commissioner takes your badge in front of the whole squad room and does not meet your eyes. The cold cases stay cold.' },
      { text: 'The city lost patience. Too many names on the front page, too many of them walking free. The Commissioner takes your badge in front of the whole squad room and does not meet your eyes.' },
    ],
    burnout: [
      { when: function (st) { return st.convictions >= 5; }, text: 'You closed more cases than anyone on the floor, and one morning you simply do not go in. Or the next. The resignation letter is two lines long. Somebody else sits at your desk now and inherits your reputation, and the phone keeps ringing.' },
      { text: 'One morning you simply do not go in. Or the next. The resignation letter is two lines long. Someone else sits at your desk now, and the phone keeps ringing.' },
    ],
    collapse: [{ text: 'You collapse on the precinct stairs. The doctors use words like "exhaustion" and "cardiac event" and "early retirement". The city does not send flowers.' }],
    consumed: [
      { when: function (st) { return st.wrongful > 0; }, text: 'You stop going home. You stop answering to your name. When they finally open the door to your flat, every wall is covered with string, and in the middle of it is the face of someone you already sent to prison. You were sure. You are still sure.' },
      { text: 'You stop going home. You stop shaving. You stop answering to your name. When they finally open the door to your flat, every wall is covered, and none of it makes sense to anyone but you.' },
    ],
    corruption: [
      { when: function (st) { return st.convictions >= 6; }, text: 'Internal Affairs comes for you at dawn. Your conviction rate was the best in the building, and every one of those files is being reopened now, page by page. The people you put away are getting letters from lawyers.' },
      { text: 'Internal Affairs comes for you at dawn, with a warrant and a box for your things. The coerced statements, the envelopes, the evidence that appeared from nowhere. They kept a list too.' },
    ],
    death: [
      { when: function (st) { return st.attacks >= 2; }, text: 'They came for you twice and warned you both times. The third time there was no warning. They give you a flag, a bagpiper and a paragraph in the morning paper. The people who did it are drinking to your memory in a bar on the Docks.' },
      { text: 'They give you a flag, a bagpiper and a paragraph in the morning paper. The people who did it are drinking to your memory in a bar on the Docks.' },
    ],
    commissioner: [
      { when: function (st, s) { return s.origin !== 'commissioner'; }, text: 'You did not set out for the chair; the work walked you to it. The council votes, and it is not close. You take the corner office and the city\'s police force, and you begin, slowly, to rebuild it in your own image. Somewhere a new detective sits at your old desk, chasing what you used to chase.' },
      { when: function (st) { return st.wrongful > 0; }, text: 'The council votes, and it is not close. You take the chair, the corner office and the city\'s police force. On your first night in it you read one old file again, the one with the wrong name in it, and then you put it back in the drawer.' },
      { text: 'The council votes, and it is not close. You take the chair, the corner office and the city\'s police force, and you begin, slowly, to rebuild it in your own image. Somewhere a new detective sits at your old desk. You make sure they have what you did not.' },
    ],
    master: [
      { when: function (st, s) { return s.origin !== 'master'; }, text: 'You did not come to this city to find a pattern. The pattern found you. The Architect is sentenced on a grey Tuesday, and every case you ever worked turns out to have been a line in someone else\'s drawing. You fold a paper crane, and throw it away.' },
      { when: function (st) { return st.cold >= 4; }, text: 'The Architect is sentenced on a grey Tuesday. Half your cold cases open again the same week; the other half never will, and you know exactly which. The newspapers call you the best detective the city has ever had. You fold a paper crane, and throw it away.' },
      { text: 'The Architect is sentenced on a grey Tuesday. Every crime you ever worked had their fingerprints on it, if you knew where to look. You did. The newspapers call you the best detective the city has ever had. You fold a paper crane, and throw it away.' },
    ],
    crusader: [
      { when: function (st, s) { return s.meters.scrutiny >= 7; }, text: 'The long table Uptown is empty. So, very nearly, is your file at Internal Affairs: they have been keeping it for the day the Syndicate fell, and now they open it. It cost you more than you will ever say, and it may cost the badge yet. For one bright season, nobody was above the law.' },
      { when: function (st, s) { return s.origin !== 'crusader'; }, text: 'You never called yourself a crusader. The long table Uptown is empty all the same, the chairs sold at auction. The city will grow new criminals like weeds through concrete. But for one bright season, nobody is above the law, and it was you.' },
      { text: 'The long table Uptown is empty. The chairs are sold at auction. It cost you more than you will ever say, and the city will grow new criminals like weeds through concrete. But for one bright season, nobody is above the law.' },
    ],
  };

  Story.opening = function (e) {
    var list = CF.OPENINGS[e.s.origin] || CF.OPENINGS.master;
    var op = list[e.s.seed % list.length];
    if (e.s.legacyFrom) return { title: op.title, text: op.text + ' Your predecessor, ' + e.s.legacyFrom + ', left you their cold cases and their enemies.' };
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
