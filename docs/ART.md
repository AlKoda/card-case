# Art

The game ships no binary files: every picture is a base64 WebP data URI
under a CSS custom property `--art-<key>` in `css/art/*.css`, cut from
sheets that live outside the repository.

## Candlemark Noir (current)

Built by `tools/build_noir_art.py` from the sheets as they were supplied,
saved as `n01.png` … `n25.png` in this order:

| Sheet | Contents | Used for |
| --- | --- | --- |
| n04 | the teal table with a gold frame | `ntable`, the table under the grid |
| n06 | tarot faces (heart, eye, coins, key, fire, brain, three backs) and illustrated cards | `ntarot` resources and callings, `ntar2`/`ntp` clue pictures |
| n08 | the verb box kit | `nverb` verb tokens, `nbox` empty boxes |
| n09 | the main-menu scene | `nmenu`, behind every full-screen panel |
| n11 | eight bold portrait cards | `nhero` |
| n12 | twelve round evidence pictures | `nev` clues and evidence |
| n13, n14 | eight city places, eight rooms | `nplace`, `nroom` quarters, fronts, bands |
| n16 | square icons, coins, small pips, wax seals | `nsq`, `ncoin`, `nsmall`, `nwax` chips and meters |
| n18–n22 | silhouette portraits (24 different faces) | `nport` everyone with a name |
| n23 | eight detailed portrait cards | `nface` the Watch and the origins |
| n24 | ten tall ink locations | `nloc` cases |
| n25 | twelve paper cards with a corner icon | `npaper` words on paper |

## The kit (second batch)

`tools/build_kit_art.py` cuts sixteen more sheets, supplied as `k01.png` …
`k16.png`, into `css/art/kit-cards.css` and `kit-icons.css`. Tiles are found
by their pixels, so the sheets need no measured boxes.

| sheet | what it holds | keys |
| --- | --- | --- |
| k01 | sixteen deaths (a body under a sheet, in the river, on the rope…) | `kdeath` cases: missing, the Eumenides, the pattern, three days |
| k02–k04, k06–k08 | body silhouettes: stabbed, beaten, hanged, drowned, plain, shot | `kstab` `kblunt` `khang` `kdrown` `kbody` `kshot` case cards and body tokens, by the case's kind of death |
| k05 | poison: bottles, cups, the sick and the dead | `kpoison` |
| k07 | sixteen bodies on the ground | `kbody` |
| k09 | thirty wax seals | `kseal` the crime on a case's corner, the six proofs, the meters |
| k10 | people and dealings | `kfolk` fraud, extortion, gangs, coining |
| k11 | numbers, tags, links, ropes, seals, plates | `knum` `knext` `ktag` `klink` `krope` `kwax` `kplate` (spare) |
| k12 | the court: gavel, bars, the condemned, the jury | `kcourt` the Condemned (behind bars), a wanted notice for the Abroad, the sworn men |
| k13 | arrows, relations, pinned strings, time, places | `karrow` `krel` `kpin` `ktime` `kplace` (spare) |
| k14 | investigation: lenses, keys, prints, the city | `kinv` burglary |
| k15 | evidence: blood, poison, rope, papers, ash | `kev` arson |
| k16 | rosettes, badges, labels | `kros` `kros2` `kbadge` `klabel` (spare) |

## The deck (third batch)

`tools/build_deck_art.py` cuts sixteen more sheets, supplied as `d01.png` …
`d16.png`, into `css/art/deck-cards.css` (200px), `deck-icons.css` (128px)
and `deck-menu.css` (the study, 1400px). Tiles are found row by row from the
sheet's alpha or its background colour; a family is a slice of one row or of
every row. Every tile is kept whole, at its own size: the page scales a picture
to fit its frame (`contain`) rather than cutting it.

| sheet | what it holds | keys |
| --- | --- | --- |
| d01 | thirty-five ink portraits on coloured squares | `dport` everyone with a name (suspects, witnesses, informants, rivals) |
| d02 | twenty-six square icons (lens, notebook, speech, footprints, shield, insight, crowd, suspect, quarter, print, bulb, map, scales, coins, heart, eye, compass, hourglass, folder, books, lock, unlock, laurel, wax eye, warning, blood) | `dicon` the six proofs, the meters, slot and ask icons, the dossier's kind seals |
| d03 | twenty-five round buttons (gear, music, sound, play, pause, fast, back, close, yes, no, save, load, help, menu, book, purse, map, scroll, compass, eye, people, exit) | `dui` the top bar, the pause and title menus, a window's close and info buttons |
| d04 | the study at night, empty | `dmenu` behind the title and every full-screen panel |
| d08 | sixteen verb tiles | `dverb` Attend, Explore, Study, Question, Rest, the Court |
| d09 | eight round resource tokens | `dtok` Health and Coin in slots and asks, Weariness |
| d10 | sixteen wax seals, six flags | `dwax` the dossier's kind seals; `dflag` the edge markers |
| d11 | twelve drawn items (letter, seal, dagger, sack, phial, ring, key, map, holy card, blood, rope, book) | `ditem` clues and evidence by their words; the Ledger, orders, bribes, threads, loose ends |
| d12 | twelve trades (magistrate, plague doctor, nun, sailor, scholar, guard, noblewoman, thief, priest, merchant, healer, executioner) | `drole` a named person whose role matches (`ROLE_ART` in `js/ui.js`) |
| d14 | twenty-nine square buttons | `dbtn` `dbtn2` `dbtn3` the Settings tabs (spare otherwise) |
| d15 | eight full character cards | `dhero` the three callings |
| d16 | ten places (court, docks, alley, chapel, tavern, infirmary, cell, market, manor, library) | `dloc` quarters, fronts, gangs, the Watch-house rooms, the Burgomaster's seat |

Not cut: d05, d06 and d13 (dense catalogue sheets whose pieces are too small
to use), d07 (dialogue frames; the windows are drawn by the stylesheet). The
tarot backs on d05 and d06 are under 120px wide, so face-down cards keep
their tarot back from the Candlemark batch.

Case strings (the pinned ropes between a case and its cards) are drawn by
the stylesheet and `syncLinks` in `js/ui.js`, not cut from a sheet.

Card faces are simple on purpose: a picture in a frame the stylesheet draws
in the kind's colour, a paper strip with one name, and the whole story in
the dossier. See `cardPicture` in `js/ui.js` for which picture a card gets.

## The Free City (older)

`tools/build_city_art.py` still builds `city-ui.css` and `city-icons.css`
(plates, dialogs, meters, badges) from the earlier sheets.
