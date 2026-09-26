// Deductions: what Reflect makes of clues laid side by side (roadmap Phase
// 6). Reflect is reasoning, not lab work: a pattern across two or more clues
// of one case becomes a new clue, a theory or an identification. The first
// pattern (in order) that fits the clues is the one that runs.
//
//   { id, label, duration,
//     needs: { min: 2, aspects: {aspect: total needed}, sameTrait: true, distinctTraits: 2, points: true },
//     gives: { label, text, aspects, tags },   // omitted = nothing is made, the clues come back
//     consume: true,                           // the clues fold into the result
//     story: { title, text, kind } }
//
// Text is filled with {name} (the suspect the pattern identifies, if any),
// {trait} (what marks them out) and {clues} (the clue labels joined).
(function (G) {
  var CF = G.CF;

  CF.DEDUCTIONS = [
    // Two clues from different cases that point at the same place: the
    // cases are connected. Nobody tells the player this; they find it.
    { id: 'connect', label: 'Follow the Thread', duration: 30,
      needs: { min: 2, sharedLink: true, crossCase: true },
      story: { title: 'These Cases Are Connected', text: '{clues}: two cases, one address. Somebody is working through {front}, and more than one of your files leads there.', kind: 'major' } },
    // Two clues that describe the same person: an identification. Confirmed
    // when a suspect on the board fits; only "possible" until then.
    { id: 'identify', label: 'Put a Face to It', duration: 30,
      needs: { min: 2, sameTrait: true },
      gives: { label: 'Identification', text: 'Everything points to the same person: {trait}', aspects: { opportunity: 2, testimony: 1 } },
      consume: true,
      story: { title: 'The Same Person', text: '{clues}: different clues, one description. {trait} You know who you are looking for.' } },

    // Two descriptions that cannot both be the culprit. Nothing is made.
    { id: 'conflict', label: 'Conflicting Accounts', duration: 15,
      needs: { min: 2, distinctTraits: 2 },
      story: { title: 'Two Different People', text: 'Lay them side by side and they describe two different people. At least one of these clues is about somebody who was not there, or somebody who was there for another reason.', kind: 'minor' } },

    // Theories: aspects that explain each other.
    { id: 'money_motive', label: 'Follow the Money', duration: 35,
      needs: { min: 2, aspects: { financial: 2, motive: 1 } },
      gives: { label: 'Theory: Financial Motive', text: 'Who owed, who paid, who profits. The money tells the story of why.', aspects: { motive: 2, financial: 2 } },
      consume: true,
      story: { title: 'Follow the Money', text: 'You read the accounts against the reasons until the two columns line up. Somebody needed this to happen, and the ledger says who.' } },
    { id: 'placed', label: 'Place Them at the Scene', duration: 35,
      needs: { min: 2, aspects: { forensic: 2, opportunity: 1 } },
      gives: { label: 'Placed at the Scene', text: 'What was left behind, and who could have left it. The physical evidence puts one person in the room.', aspects: { forensic: 2, opportunity: 2 } },
      consume: true,
      story: { title: 'Hands and Hours', text: 'The traces and the timing agree. Whoever left this was here, then, with their hands on it.' } },
    { id: 'timeline', label: 'Reconstruct the Night', duration: 35,
      needs: { min: 2, aspects: { opportunity: 3 } },
      gives: { label: 'Reconstructed Timeline', text: 'Minute by minute: who was where, and when the window of opportunity opened and shut.', aspects: { opportunity: 3 } },
      consume: true,
      story: { title: 'The Night, Minute by Minute', text: 'You write the times on the wall and draw lines between them. There is a gap, and only one person could fit through it.' } },
    { id: 'paper_trail', label: 'Read the Records', duration: 35,
      needs: { min: 2, aspects: { digital: 2, financial: 1 } },
      gives: { label: 'Paper Trail', text: 'Calls, transfers, time stamps. Machines do not misremember.', aspects: { digital: 2, financial: 2 } },
      consume: true,
      story: { title: 'Paper Trail', text: 'The records agree with each other to the minute. Nobody can argue with a time stamp.' } },
    { id: 'said_and_seen', label: 'Compare the Stories', duration: 30,
      needs: { min: 2, aspects: { testimony: 2, forensic: 1 } },
      gives: { label: 'Corroborated Account', text: 'What the witnesses said matches what the scene shows. Together they are hard to dismiss.', aspects: { testimony: 2, forensic: 1, opportunity: 1 } },
      consume: true,
      story: { title: 'Corroborated', text: 'The science and the statements finally agree with each other. A jury will hear the same story twice, from two directions.' } },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
