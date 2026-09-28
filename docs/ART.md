# Art

The game ships no binary files: every picture is a base64 WebP data URI
under a CSS custom property `--art-<key>` in `css/art/*.css`, cut from
sheets that live outside the repository.

## Candlemark (current, the one style)

Everything on the table and around it comes from one batch of forty-eight
sheets in one style: cream paper, a coloured frame (red, blue, gold, teal,
black, grey), a black ink picture. `tools/build_cm_art.py` cuts them,
supplied as `e01.png` … `e48.png`, into three stylesheets. Every tile is kept
whole, at its own size; the page scales a picture to fit its frame.

| file | holds | width |
| --- | --- | --- |
| `cm-cards.css` | tall cards: portraits, items, places, crimes, verbs, backs, empty frames | 208px |
| `cm-icons.css` | square and round icons, wax seals, stamps, markers | 112px |
| `cm-ui.css` | buttons, pills, bars, panels, toggles, the timer | as cut |

| sheet | what it holds | keys |
| --- | --- | --- |
| e02 | verb story tiles, empty card frames, pills (cream, dark, hover) | `cstory` `cpill` `cpilld` `cpillh` `cpillhd` |
| e04 | twenty-seven square buttons, the same twenty-seven round | `bsq` `bround` the top bar, the menus, a window's buttons |
| e05 | thirty evidence icons | `iev` proofs, body tokens, the six aspects |
| e06 | the timer, numbered counters, resource counters, tabs, aspect tokens, progress marks | `ctimer` `cnum` `cres` `ctab` `casp` `casp2` `cprog` |
| e08 | fifteen place cards with a corner badge, and their fifteen icons | `cplace3` fronts and the Watch-house rooms; `iplace2` |
| e09 | thirteen trades as square and round portraits | `irole` `rrole` slots, origins, the Watch |
| e10 | wax seals, numbered seals, evidence and crime stamps, relation, accusation, suspect, witness and link markers, square and circular markers | `cwax` `cwaxn` `cstamp` `ccstamp` `crel` `cacc` `csus` `cwit` `clink` `cmark` `ccirc` |
| e13 | six card backs, six empty frames, four wide frames | `cback` face-down cards, the archive, the endings; `cframe` the framed icon cards; `cwide` |
| e14 | text bars, labelled bars, three panels, yes/no, arrows, filled pills | `cbar` banners; `clabel` toasts; `cpanel` the question, `cpanel2` a promotion, `cpanel3`; `cok` `carrow` `carrow2` `cpill2` |
| e16 | settings and audio icons, toggles, checkboxes | `cset` `cset2` `caud` `caud2` `ctog` `ctog2` `ccheck` `ccheck2` |
| e17–e35, e40, e41, e44, e45, e48 | eight painted cards each: rogues, signs, heraldry, nobles, clerks, the harbour, mysteries, folk, the Watch, items, the court, outlaws, places, crimes, women, trades, occult, ink portraits, the verbs | `crogue` `csign` `cherald` `cnoble` `cclerk` `charb` `cmyst` `cfolk` `cwatch` `citem` `ccourt` `coutlaw` `cnoble2` `cplace` `ccrime` `cwoman` `ctrade` `citem2` `cplace2` `charb2` `coccult` `cherald2` `cink` `cverb` |
| e36–e39, e42, e43, e46, e47 | twenty-four square icons each: investigation, mysteries, medicine, crime, markers, law, trades, places | `iinv` `imyst` `imed` `icrime` `imark` `ilaw` `itrade` `iplace` |
| e36, e37, e43 | seven of those squares again at twice a card's width, one per verb | `cvtok-time` `cvtok-duty` `cvtok-investigate` `cvtok-analyze` `cvtok-interrogate` `cvtok-reflect` `cvtok-arrest` |

Not cut: e01 and e07 (mock-ups of screens and blank dialogue boxes), e03,
e11, e12 and e15 (the same tiles as e09, e10, e05, e08 in other sizes).

### Where things go (`js/ui.js`)

- **People** draw a painted card from a pool by their trade (`ROLE_POOL`:
  judge, cleric, noble, watch, rogue, sailor, poor, woman, clerk, trader),
  and keep it by their name. The Watch are `cwatch`; the callings and the
  origins are `ctrade`.
- **Cases** are a crime card with a crime stamp on the corner
  (`CASE_ART`). **Tokens** about the body get an icon of the case's kind of
  death; other tokens pick a painted item by their words (`EV_RULES`), or an
  icon where there is no card for it.
- **Quarters** are `cplace`, fronts `cplace3` by name, the Watch-house rooms
  by room. **Words on paper** (orders, the Ledger, whispers, threads, pleas)
  are items and signs.
- **Health, Wit, Instinct, Coin** and the afflictions are an empty frame in
  the kind's colour (`cframe`) with only the icon's disc in its arch, clipped
  from the square tile (`ICONS`; css `.card.face-icon`, `clip-path`), so the
  glyph sits on the frame's own paper and the name in its bar. Painted cards
  are `.card.face-full`, with the name on a strip of paper at the foot.
- **Verbs** are square tiles twice a card's width (`cvtok`), raised on a dark
  slab, with a rounded ring drawn just outside the tile for the clock and the
  name on a pill plate below.
- **Meters, proofs, slots, asks, the dossier's kind seal** are square icons
  (`METER_ICONS`, `ASPECT_ART`, `SLOT_ART`, `ASK_ART`, `KIND_ART`).
- **Buttons** are the round set (`bround`) in the top bar and on the menus;
  the plates are the pills (`cpill`, `cpill2`); banners are `cbar`; toasts
  are `clabel` with a marker in the circle; the question and the promotion
  are `cpanel` and `cpanel2`; the rank is a wax seal (`cwax`).

## Still used from earlier batches

- `noir-tables.css` (`tools/build_table_art.py`): the table under the grid
  (`ntable`), laid out from six table sheets (`t01.png` … `t06.png`: the
  bottom-right, bottom-left, bottom edge, top-left, top-right and top edge
  of a table). The sheets were drawn separately and do not tile, so the mat
  is built from parts cut whole from the top-left sheet and mirrored: a
  quilt of felt from all six, the raised field with its double gold line,
  corner rosettes and compass medallions, two columns of tall slots down
  each side, a row of small and wide slots along the top and the bottom, a
  star pointer in each corner. It is drawn at the size of its box in
  `css/style.css` (`#board::before`, 2960 x 1900 units), so a tall slot is a
  little larger than a card; `CF.TABLE.BOUNDS` is that box inset a little.
  `tools/build_noir_art.py` no longer cuts anything but still holds the WebP
  encoder the other tools import.
- `deck-menu.css` (`tools/build_deck_art.py`): the study at night behind the
  title and every panel (`dmenu`).
- `menu.css`: the title logo (`logo`).

Everything else from the Free City, Candlemark Noir, kit and deck batches was
retired with the Candlemark sheets, so the game reads as one style.

Case strings (the pinned ropes between a case and its cards) are drawn by
the stylesheet and `syncLinks` in `js/ui.js`, not cut from a sheet.
