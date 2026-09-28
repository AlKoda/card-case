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

Case strings (the pinned ropes between a case and its cards) are drawn by
the stylesheet and `syncLinks` in `js/ui.js`, not cut from a sheet.

Card faces are simple on purpose: a picture in a frame the stylesheet draws
in the kind's colour, a paper strip with one name, and the whole story in
the dossier. See `cardPicture` in `js/ui.js` for which picture a card gets.

## The Free City (older)

`tools/build_city_art.py` still builds `city-ui.css` and `city-icons.css`
(plates, dialogs, meters, badges) from the earlier sheets.
