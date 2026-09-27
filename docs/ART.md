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

The other sheets (UI kits, dialogs, settings mock-ups) are not cut yet.

Card faces are simple on purpose: a picture in a frame the stylesheet draws
in the kind's colour, a paper strip with one name, and the whole story in
the dossier. See `cardPicture` in `js/ui.js` for which picture a card gets.

## The Free City (older)

`tools/build_city_art.py` still builds `city-ui.css` and `city-icons.css`
(plates, dialogs, meters, badges) from the earlier sheets.
