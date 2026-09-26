// Deductions: what Contemplate makes of tokens laid side by side (roadmap
// Phase 6). Contemplate is reasoning, not bench work: a pattern across two
// or more tokens of one case becomes a new token, a theory or an
// identification. The first pattern (in order) that fits is the one that runs.
//
//   { id, label, duration,
//     needs: { min: 2, aspects: {aspect: total needed}, sameTrait: true, distinctTraits: 2, points: true },
//     gives: { label, text, aspects, tags },   // omitted = nothing is made, the tokens come back
//     consume: true,                           // the tokens fold into the result
//     story: { title, text, kind } }
//
// Text is filled with {name} (the accused the pattern identifies, if any),
// {trait} (what marks them out) and {clues} (the token labels joined).
(function (G) {
  var CF = G.CF;

  CF.DEDUCTIONS = [
    // Two tokens from different cases that point at the same door: the
    // cases are connected. Nobody tells the player this; they find it.
    { id: 'connect', label: 'Follow the Thread', duration: 30,
      needs: { min: 2, sharedLink: true, crossCase: true },
      story: { title: 'These Cases Are One', text: '{clues}: two cases, one door. Somebody is working through {front}, and more than one of your cases leads there.', kind: 'major' } },
    // Two tokens that describe the same person: an identification. Confirmed
    // when an accused on the board fits; only "possible" until then.
    { id: 'identify', label: 'Put a Face to It', duration: 30,
      needs: { min: 2, sameTrait: true },
      gives: { label: 'Identification', text: 'Everything points to the same person: {trait}', aspects: { opportunity: 2, testimony: 1 } },
      consume: true,
      story: { title: 'The Same Person', text: '{clues}: different tokens, one description. {trait} You know who you are looking for.' } },

    // Two descriptions that cannot both be the culprit. Nothing is made.
    { id: 'conflict', label: 'Two Accounts', duration: 15,
      needs: { min: 2, distinctTraits: 2 },
      story: { title: 'Two Different People', text: 'Lay them side by side and they describe two different people. At least one of these tokens is about somebody who was not there, or who was there for another reason.', kind: 'minor' } },

    // Theories: aspects that explain each other.
    { id: 'money_motive', label: 'Follow the Coin', duration: 35,
      needs: { min: 2, aspects: { financial: 2, motive: 1 } },
      gives: { label: 'Theory: Who Profits', text: 'Who owed, who paid, who is richer this week. The coin tells the story of why.', aspects: { motive: 2, financial: 2 } },
      consume: true,
      story: { title: 'Follow the Coin', text: 'You read the debts against the reasons until the two columns line up. Somebody needed this to happen, and the ledger says who.' } },
    { id: 'placed', label: 'Put Them in the Room', duration: 35,
      needs: { min: 2, aspects: { forensic: 2, opportunity: 1 } },
      gives: { label: 'Placed in the Room', text: 'What was left behind, and who could have left it. The body of the thing puts one person in the room.', aspects: { forensic: 2, opportunity: 2 } },
      consume: true,
      story: { title: 'Hands and Hours', text: 'The marks and the hours agree. Whoever left this was here, then, with their hands on it.' } },
    { id: 'timeline', label: 'Reckon the Night', duration: 35,
      needs: { min: 2, aspects: { opportunity: 3 } },
      gives: { label: 'The Night Reckoned', text: 'Bell by bell: who was where, and when the door of chance opened and shut.', aspects: { opportunity: 3 } },
      consume: true,
      story: { title: 'The Night, Bell by Bell', text: 'You write the hours on the wall and draw lines between them. There is a gap between compline and matins, and only one person fits through it.' } },
    { id: 'paper_trail', label: 'Read the Papers', duration: 35,
      needs: { min: 2, aspects: { digital: 2, financial: 1 } },
      gives: { label: 'Paper Trail', text: 'Ledgers, letters, seals. Paper does not misremember.', aspects: { digital: 2, financial: 2 } },
      consume: true,
      story: { title: 'Paper Trail', text: 'The papers agree with each other to the day. Nobody argues with a notary\'s seal.' } },
    { id: 'said_and_seen', label: 'Compare the Accounts', duration: 30,
      needs: { min: 2, aspects: { testimony: 2, forensic: 1 } },
      gives: { label: 'Corroborated Account', text: 'What the witnesses swore matches what the scene shows. Together they are hard to dismiss.', aspects: { testimony: 2, forensic: 1, opportunity: 1 } },
      consume: true,
      story: { title: 'Corroborated', text: 'The body of the thing and the words of the witnesses finally agree. The sworn men will hear the same story twice, from two directions.' } },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
