# Case File — Design Lock

This is the document the roadmap's Phase 0 asks for: the rules that do not
change from week to week, the engine decision, the first playable case, and
the contract the tabletop has to honour. Everything later in the roadmap
builds on this; if something here has to change, change it here first.

## 1. Engine and language

**Vanilla JavaScript, in the browser, no build step.** Plain `<script>` tags,
ES5-style code, one `CF` namespace. Hosted as static files on GitHub Pages.

Why, given the scale of the roadmap (eighteen phases, a criminal network, a
procedural city):

- The game is text, timers and DOM cards. Nothing needs a scene graph, a
  physics engine or a GPU. A game engine (Godot, Unity, Phaser) would add a
  build pipeline and binary assets, and the repository cannot carry binaries.
  All art already ships as base64 CSS custom properties, which only works
  cleanly with a plain web page.
- Every phase of the roadmap is *data* work (cards, recipes, cases,
  criminals, equipment, officers, events) on top of a small engine. That is
  what a scripting language is for, and JavaScript is the one the browser
  runs natively. No TypeScript: the compile step is the only thing it would
  add for a codebase this size, and the headless tests catch the errors it
  would.
- The headless engine already runs under Node for tests (random bots, a
  heuristic bot, invariant checks). Keeping the engine free of DOM code keeps
  that true.
- Deploy is a push to `main`. Anyone can open `index.html` from disk.

### Code defines what systems can do; data defines what exists

The roadmap's structure is adopted as the target, and the current files map
onto it like this. Files move only when a phase touches them; nothing is
moved for its own sake.

| Roadmap | Today | Role |
|---|---|---|
| `js/core/GameState`, `TimerManager`, `SaveManager` | `js/engine.js` (state, `tick`, `save`/`load`) | the clock, the board, the save |
| `js/core/CardManager` | `js/engine.js` (make/create/transform/move/stack/remove) | generic cards |
| `js/core/VerbManager`, `RecipeManager` | `js/engine.js` (slots/start/complete) + `js/core/recipes.js` (the recipe engine) + `js/data/verbs.js`, `js/data/recipes.js` | verbs and recipes |
| `js/systems/*` (Case, Evidence, Charge, Court, Pressure, Economy, Criminal, Team) | `js/systems/charge.js`; the rest is the second half of `js/engine.js` | split out as their phases arrive |
| `js/ui/*` | `js/ui.js`, `js/screens.js`, `js/main.js` | rendering and input only, never rules |
| `data/*.json` | `js/data/*.js` | content. Kept as JS-wrapped objects so the game opens from `file://` with no server. Recipes and case leads are declarative (see below); a few recipes with branching prose keep a `run()` callback. |

Rule of thumb: if a change adds a new *thing* (a card, a clue, a recipe, a
case, a criminal), it goes in `js/data`. If it adds a new *capability* (a way
cards can behave), it goes in the engine, once, and the data uses it.

## 2. The fixed rules

### Resources (cards you own)

| Card | What it is for |
|---|---|
| **Health** | Beat shifts, hard interrogations, long nights. Lost to Wounds. |
| **Focus** | Desk work, careful interviews, the mind palace. |
| **Instinct** | Street work, hunches, bluffs. |
| **Funds** | Rent every week. Everything else too. |

### Threats

| Threat | How it grows | What it does |
|---|---|---|
| **Fatigue** | Working without rest | Three become **Burnout**, which closes Duty, Patrol, Investigate and Interrogate until you Reflect. |
| **Obsession** | Working one case too hard | Three become **Tunnel Vision**: some clues you find are misread and will not hold up. |
| **Public Pressure** (meter) | Cases going cold, high-profile failures | At 10 you are dismissed. |
| **Scrutiny** (meter) | Coercion, bribes, planted evidence | At 10 you face corruption charges. |
| **Reputation** (meter) | Convictions; lost on acquittals and wrongful convictions | Opens promotion boards and, for the Commissioner, the Chair. |

**Retaliation** (the criminal network's heat) exists in the code already. It is
not part of the locked first version: it stays as it is until Phase 15
(criminal persistence) and 16 (crime network) redefine it. Nothing new is
built on it before then.

### Core verbs

Duty, Patrol, Investigate, Analyze, Interrogate, Reflect, Arrest, plus the
**Time** clock (weekly rent) and **Requisition** (the shop). These nine are
the vertical slice.

### Not built further until their phase

Stakeout, Undercover, Warrant, Task Force, Chief mechanics, the Syndicate war,
precinct management beyond four rooms, the procedural city. They are in the
code from the prototype and stay playable, but they receive no new content,
no fixes beyond crashes, and no design attention until Phases 10–18. The
priority is one case that is satisfying from the first clue to the verdict.

### Aspects

Six clue aspects build a charge: **Forensic, Testimony, Motive, Opportunity,
Digital, Financial.** A card's kind is also an aspect (a Witness card has
`witness: 1`) so that slots can accept by kind or by aspect with one rule.

## 3. The first playable case

**Burglary at an apartment.** Someone came in through the back window and
emptied the safe. The case is hand-authored (it is the one case that must be
good before any procedural generation is trusted) and it must be solvable
in at least three different ways, so that a player who misses one thread is
not stuck.

The threads, each of which starts at the scene:

1. **The window** (Forensic). Investigate the scene → *Pried Window Frame*
   (evidence) → Analyze with the Forensic Kit → *Tool Mark Analysis*
   (Forensic 2, Opportunity 1). Investigate again with the Fingerprint Set →
   *Partial Fingerprint* → Analyze → *Matched Print* (Forensic 3). Prints only
   match once you have a suspect to match them to.
2. **The witness** (Testimony → Opportunity). Investigate with the District →
   a *Witness* (the neighbour opposite). Interrogate with Focus → a statement
   that carries the culprit's **trait** ("a bad leg", "a green van") and
   Testimony 2. The statement, corroborated in Reflect with a scene clue,
   becomes Opportunity.
3. **The money** (Financial → Motive). The *Inventory Discrepancy* clue
   (someone knew what was worth taking) and the *Pawn Ticket* (Analyze →
   *Pawned Goods*, Financial 2, Testimony 1). Interrogate the suspect with a
   Financial clue → *Motive* (the unpaid wages, the will, the debt).

Suspects: the case reveals up to three (the night watchman, the nephew, the
fence, the partner, the former employee; three are drawn). One is the
culprit. Each suspect has a trait; the culprit's trait leaks into scene clues
and the witness statement, so a careful reader can name the culprit before
the mind palace confirms it.

A **charge** is a Suspect plus up to four clues from the same case in Arrest.
The burglary's charge profile is Forensic 2, Opportunity 2, Financial 2. A
strong charge needs weight in at least two of the three and no clue that
describes somebody else; a clue that names the suspect (a matched print, a
cracked confession, a corroborated sighting) helps. A weak charge can still
convict; an acquitted suspect walks and remembers you. Section 6 has the
scoring.

Ways to win the case:

- Forensic route: Tool Mark Analysis + Matched Print + any Opportunity.
- Human route: corroborated Witness sighting + cracked confession (Interrogate
  a suspect with a clue that fits them) + any Financial clue.
- Money route: Pawned Goods + Inventory Discrepancy + Motive from
  interrogation, and the trait in the pawn clerk's description.

Ways to lose it: the case clock runs out (it goes cold; Public Pressure rises;
the culprit is At Large), or a thin charge is acquitted, or the wrong suspect
is convicted (Reputation falls when the truth comes out).

The template lives in `js/data/cases.js` (`burglary`). Phase 3 makes every
line above true in play and covers it with a scripted test that solves the
case each of the three ways.

## 4. The tabletop

### Cards are data

A card definition (`js/data/cards.js`) is a plain object:

```js
prints: {
  label: 'Fingerprint Set', kind: 'equipment',
  aspects: { tool: 1, forensic: 2, kit_prints: 1 },
  tags: ['tool', 'kit', 'surfaces'],
  image: 'aspect-forensic',          // an --art-* key; omitted = the UI picks
  decay: undefined,                  // seconds; omitted = permanent
  onExpire: undefined,               // 'vanish' | 'cold' | 'heal' | ...
  desc: 'Powder, brush, lifting tape...',
}
```

A card *instance* is `{ uid, def, data, label?, desc?, aspects?, tags?,
image?, caseId?, life?, maxLife?, loc }`. Instances override the definition
where a generated card needs to (a clue's label and aspects, a suspect's name
and trait); everything else comes from the definition. `CF.aspectsOf`,
`CF.tagsOf` and `CF.imageOf` merge the two, and nothing else reads the raw
fields. No gameplay rule lives on a card: cards carry aspects and tags,
recipes decide what they mean.

### The board can

| Capability | Where |
|---|---|
| spawn a card on a free spot | `Engine.create` → `placeOnTable` |
| drag / select / inspect | `ui.js` drag layer, `select`, the dossier panel |
| stack identical cards | `stackKey`, `stackFor`, `moveCard` |
| move a card, a stack or a verb | `moveCard`, `moveVerb` |
| consume a card | `Engine.remove` |
| transform a card in place | `Engine.transform` (same uid, same spot) |
| create a card from other cards | recipes, via `ctx.give` |
| keep every position in the save | `card.loc = {t:'table', x, y}`, `verb.x/y` |
| highlight what is compatible | `slotAccepts`, `usableIn`, `fitsAny` |

`tests/board.test.js` checks each of these headlessly, and `tests/sim.test.js`
asserts across sixty random games that nothing on the board ever overlaps.

### Card states

| State | Trigger | Look |
|---|---|---|
| normal | | painted frame, drop shadow |
| hovered | pointer over the card | lifts 4px, deeper shadow, dossier in the side panel |
| selected | click | gold outer glow, dossier pinned |
| dragging | pointer down and moved | lifted into the drag layer, tilts with the motion, ghost left on the board |
| compatible | an open verb's slot takes it (`fits`), the hovered slot takes it (`fits-strong`), same kind under a dragged card (`can-stack`) | gold / bright gold / green glow |
| unavailable | something takes this card but nothing can right now (its verbs are locked or busy) | desaturated and dimmed; the dossier says why |
| timer | the card has a `decay` | life bar, and a countdown on cases, trials, threats, witnesses |

A card that *nothing* takes (a room, your Calling) is not "unavailable"; it
is inert and looks normal.

## 5. Recipes are data

A verb runs the first recipe (by priority, then file order) whose
requirements its slots satisfy. `js/core/recipes.js` compiles recipe data
into the `match` / `blocked` / `run` the engine calls:

```js
{ id: 'duty_bribe', verb: 'duty', label: 'Pocket the Envelope', duration: 5,
  requires: ['bribe'],                       // aspects; or { aspects, tags, cards, primary, case, when }
  forbids: ['funds'],
  blocked: { funds: 2 },                     // or a string, or fn(ctx)
  effects: [ { consume: 'primary' }, { give: 'funds', n: 3 }, { meter: { scrutiny: 2 } },
             { story: { title: 'Pocketed', text: '...' } } ] }
```

Effects cover what the roadmap asks of the system: require cards, aspects
and tags; consume, preserve, modify and create cards; add and remove
resources (`give`, `consume`, `meter`); timers (`modify.life`, a created
card's `decay`); story text; unlocks (`unlock`, `district`); `reveal` a
suspect; and hidden variables (`set` on the case, `flag` on the game).
`chance` branches, and `call` is the escape hatch for prose that has to
branch on more than a roll. New content should need no new code.

### Authored cases: leads

A case template may carry `leads`: its hand-written discovery graph. Each
lead compiles into a recipe that outranks the generic casework recipes
while it is undone, so a written case plays as written and the generic
rules (search the scene pool, canvass, process evidence) only take over
once the script is spent. A lead names its verb, what it needs in the slots
(`aspects`, `tags`, an evidence `item`, a `tool`, earlier leads, a revealed
suspect, the case's own district) and what it gives (clues, evidence with
its own analysis result, witnesses), plus its story beat. Text is filled
with the case's variables, including `{culprit}` and `{seen}` (what a
witness would notice about the culprit).

The burglary is the first written case (`js/data/cases.js`, `burglary.leads`)
and `tests/case.test.js` proves each of its three routes ends in a solid
charge and a conviction.

## 6. Charges

Every case carries a **charge profile**: the aspects a court will want
proven and how much of each (`charge: { forensic: 2, opportunity: 2,
financial: 2 }` on the template; a high-profile case wants one more point of
its main aspect). Reflect's "Mull It Over" tells the player the profile;
the suspect's dossier repeats it.

A charge (`js/systems/charge.js`) is scored as

    strength + diversity + corroboration − 2 × contradictions − illegal evidence

- **Strength.** Profile aspects count in full up to what the case needs,
  half for as much again, and nothing past that. Aspects the case does not
  turn on count a quarter. Four Forensic clues cannot make a strong charge
  on their own.
- **Diversity.** +0.5 for every distinct aspect beyond the first (max 2.5).
- **Corroboration.** +1 for a clue bound together in Reflect, +1 for a clue
  that names the accused (a matched print), +0.5 for a clue whose trait
  matches them.
- **Contradictions.** A clue whose trait or identification belongs to
  somebody else describes another person: −2 each, and the charge can never
  be strong.
- **Illegal evidence.** Coerced statements and planted evidence: −1 each,
  and the defence may get them thrown out at trial.

Three strengths, judged against the profile's total: **weak** (below 60%),
**reasonable** (60% and up), **strong** (the total, at least two profile
aspects touched, no contradictions). Misread clues (Tunnel Vision) count in
the apparent strength but not the real one; the court judges the real one.
In court a strong charge on the culprit convicts 92% of the time; a
reasonable one 35–80%; a weak one 15–55%. Each contradiction gives the
defence a 35% chance to knock 20 points off. Acquittal costs Reputation,
and a weak charge that fails may draw Scrutiny. The Arrest window shows the
whole breakdown before you commit.

## 7. Reflect is reasoning

Analyze is the lab; Reflect is the detective's head. Clues laid side by side
in Reflect are matched against **deductions** (`js/data/deductions.js`,
read by `js/systems/reflect.js`): patterns across two or more clues of one
case that produce a new clue, a theory, or nothing.

- Two clues that describe the same person (they carry the same trait) make
  an **Identification**: *Confirmed*, naming the suspect and making them the
  prime suspect, when someone on the board fits; only *Possible* until then.
- Two descriptions of different people make **nothing**, and the story says
  so: at least one of them is about somebody else. That is the game telling
  the player something without telling them which.
- Aspects that explain each other become theories: Financial + Motive →
  *Financial Motive*; Forensic + Opportunity → *Placed at the Scene*;
  Opportunity across clues → *Reconstructed Timeline*; Digital + Financial
  → *Paper Trail*; Testimony + Forensic → *Corroborated Account*.
- Clues with nothing in common cannot even be corroborated. Corroborate is
  the plain fallback for clues that share an aspect but fit no pattern.

Deductions are content: a new pattern is a new entry, never new code.
Deduction results count as corroborated in a charge (§6) and keep the
trait and identification of the clues they came from, so a wrong theory
built on a wrong description still contradicts the right suspect.

## 8. Time

Every verb takes seconds (Patrol 25, Investigate 30, Analyze 25, Interrogate
20–25, Reflect 15–60, Arrest 15); a week is 60 seconds and takes the rent.
Cases carry their own clock (250–400 seconds by type) and are shown in the
city's days (a week is seven). The **Time** window lists every open case,
most urgent first, with its bar and days left; a case gets one warning a
minute before it goes cold; cases pulse in their last minute, and clues,
evidence and witnesses in their last thirty seconds. A cold case raises
Public Pressure and puts its culprit At Large. With up to four cases open
and one detective, the game is triage; that tension is the design, and
nothing later should relieve it for free.

## 9. Your own clocks

The detective wears out on the same clock as the cases.

- **Fatigue** comes from Duty, Patrol, Investigate, Interrogate, stakeouts
  and missed rent. Two on the table is **Exhaustion**: the street verbs run
  25% slower and say so. Three become **Burnout**, which closes them until
  you Reflect, and which ends the career if it runs out.
- **Obsession** comes from working one case past six actions. Three become
  **Tunnel Vision**: Investigate, Analyze and Reflect run slower; a third
  of new clues are silently misread; a suspect's alibi can look like guilt;
  and Reflect cannot see a conflict any more, so two descriptions of
  different people "identify" whoever is already on the board, as a
  misreading that will not survive court. A conviction, or a long rest,
  clears it.
- **Public Pressure** rises with cold cases, acquittals and criminals at
  large; a conviction lowers it, a high-profile one by two. Ten and you are
  dismissed.
- **Scrutiny** rises with the tempting things: leaning on a witness,
  coercing a confession, planting evidence, pocketing an envelope, and
  searching a home without a warrant. Each of them is faster or stronger
  than the clean way, on purpose: the illegal search takes fifteen seconds
  and no probable cause where the warrant takes forty and a clue, and what
  it finds is good evidence that the defence may get excluded. Ten and
  Internal Affairs comes for you.

`CF.STRAIN` holds the thresholds and slowdowns.

## 10. Money

Sources: the weekly salary (1, 2 or 3 Funds by rank), Duty shifts,
convictions (1 for a reasonable charge, 2 for a strong one, +1
high-profile), promotions, informants' side-effects and the occasional
envelope. Expenses: rent (1 a week, before salary is counted; miss it and
you sleep in the car), informants, equipment, training, precinct rooms,
and yourself: Funds beside a Fatigue, Obsession, Burnout or Tunnel Vision
card in Reflect buys a proper night off at a third of the time. The Time
window shows the balance and the terms. `CF.ECONOMY` holds the numbers.
The test of the economy is the question it should keep asking: the
investigation, the precinct, or yourself?

## 11. Equipment changes recipes

No "+10% investigation speed". Each piece of equipment carries `mods` on
its card definition (`js/data/cards.js`) and the recipes read them:

| Equipment | What it changes |
|---|---|
| Fingerprint Set | Reads evidence that needs it; Forensic +1 on anything found on a *surface* (and nothing else). |
| Forensic Kit | Reads blood and fibres; Forensic +1 on *physical* evidence; a scene search with it finds one more piece of physical evidence. |
| Camera | Unlocks *Photograph the Scene* (case + camera in Investigate, once per case): every clue and piece of evidence already found stops degrading, and the photographs are a permanent clue. On a Stakeout, Opportunity +1. |
| Lab Access | Reads phones, ledgers and anything under a microscope; unlocks *Back to the Bench* (a clue + Lab Access in Analyze, once per clue: +1 to its main aspect); Digital +1 on records. |
| Surveillance Gear | Opens the Stakeout verb at any rank; a stakeout with it is faster and yields photographs and a transcript (Opportunity +1, Digital +1). |

Scene items carry tags (`surfaces`, `physical`, `biology`, `records`,
`watching`); an item that says what it needs gets its tags from that.
Equipment only sharpens what it is for; officers still add their own
aspects to whatever they help with.

## 12. Officers

Officers are cards with aspects and one or two **traits**
(`CF.OFFICER_TRAITS`), drawn from their role's pool when hired and printed
on the card. Traits change verbs, not numbers:

| Trait | Effect |
|---|---|
| Thorough | One more thing at every scene. |
| Streetwise | A canvass turns up one more person. |
| Empathetic | A bluff never scares a witness off. |
| Sharp | Reads evidence properly without the right kit. |
| Patient | Analysis and stakeouts take a fifth less time. |
| Steady | You do not tire working beside them. |

Fatigue, loyalty, personal events and promotions for officers wait for a
later phase; injuries (Retaliation) already exist.

## 13. What this phase does not decide

Equipment as recipe modifiers (Phase 10), team and informants (11–12),
criminal state (15), the network (16), procedural cases (17), ranks and
precinct (13–14), and the three Callings beyond their present prototype.
Every one of those is designed in its own phase against the rules above.
