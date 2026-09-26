# Case File

A detective card game in the style of *Cultist Simulator*. You are a newly assigned detective in a restless city. Cases arrive on their own clock, the trail goes cold if you're slow, and every criminal who walks free comes back as part of the city's growing underworld.

## Play

Open `index.html` in a browser. There's no build step and nothing to install. The game autosaves to your browser's local storage.

- **Drag** cards onto a verb, or into a verb's slots. **Begin** runs it.
- **Hover or click** a card to read it. **Double-click** a card to send it to the open verb.
- **Space** pauses, **1/2/3** set the speed, **J** opens the journal, and **Esc** closes the verb window.

## How it plays

| Verb | What it does |
|---|---|
| **Time** | The weekly clock. It takes rent, and at-large criminals organise. |
| **Duty** | Earn Funds (Health for a beat shift, Focus for desk work), file paperwork to calm Internal Affairs, train officers, attend promotion boards, or pocket an envelope. |
| **Patrol** | Discover districts, informants and walk-in cases. Work a district's streets. Pay informants for tips. |
| **Investigate** | Search a case's scene. Add the case's District to canvass for witnesses and suspects. Equipment and team strengthen what you find. |
| **Analyze** | Process evidence into clues. Some evidence needs a specific kit. Reopen cold cases once you have an Archive. You can also fabricate evidence. |
| **Interrogate** | Question witnesses and suspects with Focus (empathy), Instinct (bluff) or Health (pressure). Confront a suspect with a clue to crack them. |
| **Reflect** | Rest off Fatigue, Burnout, Obsession and Tunnel Vision. Put a case with its clues here to form theories. Corroborate clues together. |
| **Arrest** | Charge a suspect with clues from their case. The trial resolves a little later. |
| **Requisition** | Buy equipment and precinct rooms, and hire officers. |
| **Warrant / Stakeout / Undercover** | Unlocked at Inspector. |
| **Task Force** | Unlocked at Chief. |

**Charges.** Clues carry six aspects: Forensic, Testimony, Motive, Opportunity, Digital and Financial. Each case type turns on a few of them. A solid charge needs enough weight in the right aspects. A thin charge can still convict, but an acquitted suspect comes back At Large and angrier.

**Deduction.** Every suspect has a trait, such as a limp, menthol cigarettes or a green van. The culprit's trait leaks into scene clues and witness statements, so a careful reader can spot the culprit before the mind palace confirms it. Nothing tells you which aspects combine into a theory in Reflect. Working that out is the detective work.

**Threats.**
- Three Fatigue become Burnout, which locks your street verbs until you rest.
- Three Obsession become Tunnel Vision, and you start silently misreading clues.
- Public Pressure rises when cases go cold and gets you dismissed at 10.
- Scrutiny comes from coercion, bribes and planted evidence. At 10 you face corruption charges.
- Retaliation grows with every criminal at large. Three of them form a gang, and two gangs form the Syndicate. They will come for your informants, your team and you.

**Callings** set how you win:
- **The Commissioner:** reach Chief, build a high Reputation, and take the chair while Pressure and Scrutiny are low.
- **The Master Detective:** solid convictions leave Loose Ends. Three of them reveal the Architect.
- **The Crusader:** go Undercover against the Syndicate, take its Ledger Pages, and convict it.

When a run ends, your successor can inherit your cold cases and your enemies.

## Code

- `js/data/`: cards, case templates and prose, verbs, and recipes (what each verb does)
- `js/engine.js`: game state, time, the criminal ecosystem, charges and trials. It doesn't touch the DOM.
- `js/ui.js`, `js/main.js`: rendering, drag and drop, and menus

Most content lives in `js/data/`. To add a case type, add a template to `CF.CASE_TEMPLATES` in `cases.js` and list it in `CF.ORDINARY_CASES`.

## Tests

```
npm test
```

- `tests/sim.test.js` runs scripted mechanics checks, then lets a random bot play 60 games while checking card bookkeeping invariants.
- `tests/bot.test.js` has a heuristic bot play full games. It reports endings and balance numbers.
