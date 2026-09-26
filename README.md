# Case File

A detective card game in the style of *Cultist Simulator*. You are a newly assigned detective in a restless city. Cases arrive on their own clock, the trail goes cold if you're slow, and every criminal who walks free comes back as part of the city's growing underworld.

## Design

The fixed rules, the engine decision and the roadmap-to-code map are in [`docs/DESIGN.md`](docs/DESIGN.md). Read that before adding content or systems.

## Play

Open `index.html` in a browser. There's no build step and nothing to install. The game autosaves to your browser's local storage.

### On a tablet

- **Install from the web page.** Open the Pages URL in Chrome on the tablet, then *Add to Home screen*. The game installs as a full-screen app and works offline (a service worker caches everything on first visit). Two fingers pinch to zoom the table; the Back button closes windows and menus.
- **Or sideload the APK.** Every push to `main` builds `CaseFile.apk` (a WebView wrapper with the game bundled inside, see `android/README.md`) and attaches it to the **apk-latest** release on the Releases page. Download it on the tablet, allow installs from that source, and open it. Saves live inside the app.

### Host it on GitHub Pages

The workflow in `.github/workflows/deploy.yml` runs the tests and publishes the game to GitHub Pages on every push to `main`.

1. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**. You only need to do this once.
2. Push to `main`, or open the **Actions** tab, pick **Deploy to GitHub Pages**, and click **Run workflow**.
3. When it finishes, the game is at `https://<your-username>.github.io/<repo-name>/`. The link also appears on the workflow run.

- **Drag** cards onto a verb, or into a verb's slots. **Begin** runs it. Cards that fit an open verb glow.
- **Click a verb** to open its window. Windows can be dragged, and several can be open at once.
- **Move anything**: cards, stacks and verbs. Drop a card on its own kind to stack it; drag the top card off a stack to take one, or **Shift-drag** to take the whole stack.
- **Drag the empty table** to pan, **scroll** to zoom, **0** to fit the table.
- **Hover or click** a card to read it. **Double-click** a card to send it to an open verb.
- **Space** pauses, **1/2/3** set the speed, and **Esc** closes the top window. You can still move cards and start verbs while paused.

### Menus and settings

- **Title screen:** start a new case file, continue a saved one, open the Case Archive or change settings.
- **Settings:** master, music and sound-effect volume; fullscreen; text speed (how fast story text types itself out); window shake on bad news; language (English for now). All sound is synthesized in the browser, so there are no audio files.
- **Case Archive:** every case you close or lose is filed here, across all your detectives. Open a file to learn the truth: who really did it.

## How it plays

| Verb | What it does |
|---|---|
| **Time** | The weekly clock. It takes rent, and at-large criminals organise. Open it to see every case's clock, most urgent first. |
| **Duty** | Earn Funds (Health for a beat shift, Focus for desk work), file paperwork to calm Internal Affairs, train officers, attend promotion boards, or pocket an envelope. |
| **Patrol** | Discover districts, informants and walk-in cases. Work a district's streets. Pay informants for tips. |
| **Investigate** | Search a case's scene. Add the case's District to canvass for witnesses and suspects. Equipment and team strengthen what you find. |
| **Analyze** | Process evidence into clues. Some evidence needs a specific kit. Reopen cold cases once you have an Archive. You can also fabricate evidence. |
| **Interrogate** | Question witnesses and suspects with Focus (empathy), Instinct (bluff) or Health (pressure). Confront a suspect with a clue to crack them. |
| **Reflect** | Rest off Fatigue, Burnout, Obsession and Tunnel Vision. Lay clues side by side and reason: two descriptions of the same person become an identification, money and motive become a theory, and two descriptions of different people tell you one of them is wrong. Put a case with its clues here to see who it points to. |
| **Arrest** | Charge a suspect with clues from their case. The trial resolves a little later. |
| **Requisition** | Buy equipment and precinct rooms, and hire officers. Equipment changes what verbs do: the Camera photographs a scene so its clues keep, Lab Access takes a clue back to the bench, Surveillance Gear opens the Stakeout. Officers come with traits (Thorough, Streetwise, Empathetic, Sharp, Patient, Steady) that change the verbs they help with. |
| **Warrant** | Senior Detective. Search a suspect's home with probable cause. |
| **Stakeout / Delegate / Undercover** | Inspector. Delegate hands a case to an officer who works it alone until it closes. |
| **Task Force / Major Crimes** | Chief Inspector. Declare a Major Crime, or focus the division on a district. |

**Charges.** Clues carry six aspects: Forensic, Testimony, Motive, Opportunity, Digital and Financial. Each case has a charge profile: the aspects a court will want proven, and how much of each. A charge is scored as evidence strength + independent kinds of proof + corroboration − contradictions − illegal evidence. Four Forensic clues are not better than one of each kind, and a clue that describes somebody other than the accused counts against you. **Weak** charges are enough to arrest and little more; **reasonable** ones could go either way; **strong** ones hold, and pay.

**Deduction.** Every suspect has a trait, such as a limp, menthol cigarettes or a green van. The culprit's trait leaks into scene clues and witness statements, so a careful reader can spot the culprit before the mind palace confirms it. Nothing tells you which aspects combine into a theory in Reflect. Working that out is the detective work.

**Threats.**
- Two Fatigue is Exhaustion (the street verbs slow down); three become Burnout, which locks them until you rest. Funds beside the card in Reflect buy a quicker night off.
- Three Obsession become Tunnel Vision: you work slower, silently misread clues, and cannot see when two descriptions disagree.
- Public Pressure rises when cases go cold and gets you dismissed at 10.
- Scrutiny comes from coercion, bribes, planted evidence and searching a suspect's home without a warrant (Investigate with a Suspect: quick, and the court may exclude what you find). At 10 you face corruption charges.
- Every week pays a salary by rank and takes the rent; convictions pay by the strength of the charge. Ranks (Detective → Senior Detective → Inspector → Chief Inspector) raise the caseload and the salary and open new verbs.
- The **precinct** (⌂) is a second board: seven rooms that change how the verbs work, each with a cost and a rank that can sign for it.
- Retaliation grows with every criminal at large. Three of them form a gang, and two gangs form the Syndicate. They will come for your informants, your team and you.
- Cases connect underneath: a gang works through a front, and clues from different cases can point at the same place. Lay two of them together in Reflect and you find the thread; the Front can then be staked out or used as a way in.
- Nobody who gets away is forgotten: they keep a record, commit new crimes that arrive as cases with their name on them, and climb from Petty Criminal to Syndicate Member.
- Informants left on the table bring rumours, sightings and warnings on their own time. Pay them for trust; every meeting adds heat, and at three they go quiet until an officer protects them in Duty.

**Callings** set how you win. The one you choose is a leaning, not a campaign: the run drifts toward the path you actually walk (Power, Knowledge or Justice), your Calling card changes with it, and every ending is reachable from every start.
- **The Commissioner:** reach Chief, build a high Reputation, and take the chair while Pressure and Scrutiny are low.
- **The Master Detective:** solid convictions leave Loose Ends. Three of them reveal the Architect.
- **The Crusader:** go Undercover against the Syndicate, take its Ledger Pages, and convict it.

When a run ends, your successor can inherit your cold cases and your enemies.

## Code

- `js/data/`: cards, case templates and prose, verbs, and recipes (what each verb does)
- `js/engine.js`: game state, time, the criminal ecosystem, charges and trials. It doesn't touch the DOM.
- `js/ui.js`: table rendering, drag and drop, the verb windows and inspector
- `js/main.js`, `js/screens.js`: title, new game, settings, archive and ending screens
- `js/settings.js`, `js/audio.js`: saved settings and synthesized sound
- `css/art/`: the art, embedded as text by `tools/build_art.py` (see the script for the sheet names it expects)

Most content lives in `js/data/`. To add a case type, add a template to `CF.CASE_TEMPLATES` in `cases.js` and list it in `CF.ORDINARY_CASES`.

## Tests

```
npm test
```

- `tests/sim.test.js` runs scripted mechanics checks, then lets a random bot play 60 games while checking card bookkeeping invariants.
- `tests/bot.test.js` has a heuristic bot play full games. It reports endings and balance numbers.
