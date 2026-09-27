#!/usr/bin/env python3
"""Cut the Free City art sheets into pieces and embed them in css/art/city-*.css.

Only city-ui and city-icons are still built: the cards, scenes and tables
now come from the Candlemark Noir sheets (tools/build_noir_art.py).

The sheets (PNG, 1448x1086 or 1672x941) are supplied outside the repository,
which holds no binary files. Every piece becomes a base64 WebP data URI under
a CSS custom property --art-<key>.

Usage:
    pip install pillow
    python3 tools/build_city_art.py path/to/sheets/ [--preview] [--only s01,s02]

The folder holds the sheets as s01.png ... s33.png in the order they were
supplied. --preview also writes every piece as PNG to tools/.preview/city/.

The manifest below says where each piece is. Two forms:
    'key': (sheet, [x0, y0, x1, y1])                   one box, trimmed
    ('prefix', [names...]): (sheet, [box], cols, rows)  a grid of cells, each
                                                        snapped to the darkest
                                                        gutter, then trimmed
Names in a grid may be None to skip a cell.
"""
import base64, io, os, sys

try:
    from PIL import Image
except ImportError:
    sys.exit('pip install pillow')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'css', 'art')
THR = 40  # a pixel brighter than this is "ink", not the black sheet

# ------------------------------------------------------------------ manifest
# Output file -> list of entries. Sizes: (max width, webp quality).
FILES = {
    'city-ui': dict(width=480, q=72),
    'city-icons': dict(width=96, q=78),
}

M = {'city-cards': [], 'city-scenes': [], 'city-ui': [], 'city-icons': [], 'city-tables': []}

def one(file, key, sheet, box): M[file].append(('one', key, sheet, box))
def grid(file, names, sheet, box, cols, rows): M[file].append(('grid', names, sheet, box, cols, rows))

# ---- Tables (full bleed) ---------------------------------------------------
one('city-tables', 'table-wood', 's30', None)
one('city-tables', 'table-green', 's31', None)
one('city-tables', 'table-leather', 's32', None)
one('city-tables', 'table-dark', 's33', None)

# ---- Illustrated character cards -----------------------------------------
grid('city-cards', ['char-sleuth-star', 'char-physician-two', 'char-scholar-two', 'char-lady-moon',
                    'char-brawler-two', 'char-sailor-two', 'char-alchemist-two', 'char-masked-two'], 's16', [0, 0, 1155, 800], 4, 2)
grid('city-cards', ['char-sleuth', 'char-physician', 'char-hooded', 'char-noble',
                    'char-lady-eye', 'char-priest', 'char-sailor-pipe', 'char-brawler'], 's18', [0, 0, 1095, 800], 4, 2)
grid('city-cards', ['char-woman-eye', 'char-docker', 'char-watchman', 'char-richman',
                    'char-clerk', 'char-veiled', 'char-boy-ladder', 'char-widow',
                    'char-maid', 'char-porter', 'char-scholar-astro', 'char-lady-sun'], 's19', [0, 0, 1095, 1086], 4, 3)
grid('city-cards', ['char-scholar-book', 'char-maid-linen', 'char-boy-letter', 'char-fisher',
                    'char-barman', 'char-seamstress', 'char-clerk-papers', 'char-flowergirl',
                    'char-student', 'char-officer-swords', 'char-veiled-cat', 'char-newsboy'], 's23', [0, 0, 1095, 1086], 4, 3)
grid('city-cards', ['char-officer-star', 'char-sailor-anchor', 'char-scholar-pyr', 'char-mourner',
                    'char-singer', 'char-noble-crown', 'char-boy-swords', 'char-doctor-vial',
                    'char-priest-bible', 'char-gravedigger', 'char-agitator', 'char-masked-lady'], 's25', [0, 0, 1095, 1086], 4, 3)

# ---- Tarot backs -----------------------------------------------------------

# ---- Blank frames with an emblem (resources, threats, papers) -----------
grid('city-cards', ['frame-portrait', 'frame-hand', 'frame-sun', 'frame-moon'], 's13', [15, 15, 990, 395], 4, 1)
grid('city-cards', ['frame-eye', 'frame-scales', 'frame-key', 'frame-book'], 's13', [15, 400, 990, 700], 4, 1)
grid('city-cards', ['small-magnifier', 'small-skull', 'small-flask', 'small-map', 'small-herb', 'small-compass'], 's13', [15, 700, 830, 880], 6, 1)
grid('city-cards', ['arch-paper', 'arch-sun', 'arch-moon', 'arch-frame', 'oval-dark', 'oval-sun'], 's13', [15, 880, 910, 1080], 6, 1)
grid('city-cards', ['card-frame-red', 'card-frame-moon', 'card-frame-green'], 's12', [575, 570, 1070, 800], 3, 1)
one('city-cards', 'tag-paper', 's12', [1085, 570, 1200, 800])
one('city-cards', 'tag-blue', 's12', [1215, 570, 1320, 800])
one('city-cards', 'tag-key', 's12', [1330, 570, 1440, 800])
one('city-cards', 'kit-frame-sun', 's05', [54, 76, 169, 304])
one('city-cards', 'kit-frame-moon', 's05', [187, 67, 325, 313])
one('city-cards', 'kit-frame-pyramid', 's05', [347, 80, 459, 303])
one('city-cards', 'kit-frame-portrait', 's05', [491, 77, 611, 303])
one('city-cards', 'kit-frame-portrait-red', 's05', [618, 65, 775, 313])
one('city-cards', 'kit-portrait-card', 's05', [59, 341, 192, 636])
one('city-cards', 'kit-crowned-card', 's05', [201, 341, 374, 631])
one('city-cards', 'kit-clipboard', 's05', [382, 343, 541, 592])
one('city-cards', 'kit-frame-empty', 's05', [563, 352, 686, 584])
one('city-cards', 'kit-watchman-oval', 's05', [736, 351, 878, 610])
one('city-cards', 'kit-note-seal', 's05', [730, 807, 1227, 1068])
one('city-cards', 'kit-card-key', 's05', [46, 875, 229, 1053])
one('city-cards', 'kit-card-skull', 's05', [234, 876, 343, 1052])
one('city-cards', 'kit-card-eye', 's05', [349, 884, 425, 1042])
one('city-cards', 'kit-card-pyramid', 's05', [1136, 345, 1401, 637])
one('city-cards', 'kit-globe', 's05', [1266, 889, 1392, 1051])

# ---- Evidence --------------------------------------------------------------
grid('city-cards', ['ev-likeness', 'ev-glove', 'ev-watch', 'ev-cipher', 'ev-letter',
                    'ev-ticket', 'ev-locket', 'ev-powder', 'ev-keys', 'ev-matches',
                    'ev-notes', 'ev-keytag', 'ev-compass', 'ev-picks', 'ev-quill'], 's20', [0, 0, 1448, 1086], 5, 3)
grid('city-cards', ['ev2-likeness', 'ev2-letter', 'ev2-clock', 'ev2-key', 'ev2-ticket',
                    'ev2-quill', 'ev2-picks', 'ev2-powder', 'ev2-ledger', 'ev2-glove',
                    'ev2-monocle', 'ev2-signet', 'ev2-compass', 'ev2-matches', 'ev2-map'], 's22', [0, 0, 1448, 1086], 5, 3)

# ---- Scenes and actions (verb tiles, quarters, rooms) --------------------
grid('city-scenes', ['scene-alley', 'scene-library', 'scene-rite', 'scene-quay-deal',
                     'scene-study', 'scene-hole', 'scene-morgue', 'scene-sewer',
                     'scene-station', 'scene-rooftop', 'scene-archive', 'scene-cemetery'], 's17', [0, 0, 1448, 1086], 4, 3)
grid('city-scenes', ['scene2-alley', 'scene-harbour', 'scene-graveyard', 'scene-library2',
                     'scene-rite2', 'scene-hole2', 'scene-station2', 'scene-rooftop2',
                     'scene-catacombs', 'scene-corridor', 'scene-rolls', 'scene-morgue2'], 's26', [0, 0, 1448, 1086], 4, 3)
grid('city-scenes', ['act-chase', 'act-deal', 'act-question', 'act-study',
                     'act-watch', 'act-seal', 'act-rite', 'act-threat',
                     'act-letter', 'act-body', 'act-safe', 'act-train'], 's27', [0, 0, 1448, 1086], 4, 3)

# ---- Icons, coins, seals, medals -------------------------------------------
grid('city-icons', ['coin-sun', 'coin-fire', 'coin-eye', 'coin-bulb', 'coin-leaf', 'coin-hourglass', 'coin-heart'], 's01', [15, 20, 845, 155], 7, 1)
grid('city-icons', ['seal-compass', 'seal-eye', 'seal-hand', 'seal-pyramid', 'seal-tree', 'seal-crow', 'seal-skull', 'seal-star'], 's01', [15, 160, 845, 295], 8, 1)
grid('city-icons', ['icon-person', 'icon-hand', 'icon-book', 'icon-eye', 'icon-key', 'icon-magnifier', 'icon-quill'], 's01', [855, 25, 1430, 112], 7, 1)
grid('city-icons', ['icon-pentagram', 'icon-goblet', 'icon-flask', 'icon-crown', 'icon-scales', 'icon-skull', 'icon-ankh', 'icon-target'], 's01', [855, 112, 1445, 190], 8, 1)
grid('city-icons', ['icon-alert', 'icon-question', 'icon-lock', 'icon-unlock'], 's01', [900, 305, 1160, 380], 4, 1)
one('city-icons', 'icon-refresh', 's01', [1175, 300, 1262, 385])
one('city-icons', 'icon-gear', 's01', [1262, 300, 1345, 385])
one('city-icons', 'icon-sun-big', 's01', [1330, 290, 1432, 385])
one('city-icons', 'icon-hourglass-big', 's01', [1185, 385, 1312, 505])
grid('city-icons', ['icon-hourglass-a', 'icon-hourglass-b'], 's01', [1315, 400, 1432, 475], 2, 1)
grid('city-icons', ['phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5'], 's01', [1180, 522, 1442, 582], 5, 1)
grid('city-icons', ['phase-6', 'phase-7', 'phase-8', 'phase-9', 'phase-10'], 's01', [1180, 583, 1442, 642], 5, 1)
grid('city-icons', ['btn-check', 'btn-x', 'btn-left', 'btn-right', 'btn-up', 'btn-down'], 's01', [858, 198, 1405, 292], 6, 1)
grid('city-icons', ['gem-red', 'gem-blue', 'gem-gold', 'gem-green'], 's01', [860, 780, 1100, 838], 4, 1)
grid('city-icons', ['medal-sun', 'medal-moon', 'medal-snake', 'medal-cross', 'medal-lion'], 's13', [930, 720, 1440, 880], 5, 1)
one('city-icons', 'seal-big', 's13', [830, 700, 930, 880])
grid('city-icons', ['rbtn-check', 'rbtn-x', 'rbtn-left', 'rbtn-right', 'rbtn-up', 'rbtn-down'], 's12', [945, 462, 1372, 542], 6, 1)
one('city-icons', 'rbtn-star', 's12', [1372, 462, 1442, 542])
grid('city-icons', ['wax2-crown', 'wax2-tree', 'wax2-eye', 'wax2-key', 'wax2-pyramid', 'wax2-star'], 's05', [1205, 62, 1401, 334], 2, 3)

# Portrait medallions: a pool for faces in the dossier and the journal.

# ---- UI: rings, plates, bars, dialogs, ribbons ---------------------------
grid('city-ui', ['ring-red-face', 'ring-blue', 'ring-gold', 'ring-green', 'ring-gold-face', 'ring-red', 'ring-dark'], 's01', [15, 585, 880, 715], 7, 1)
grid('city-ui', ['ring-face-big', 'ring-red-big', 'ring-green-big'], 's13', [1000, 25, 1440, 200], 3, 1)
grid('city-ui', ['ring-dark-moon', 'ring-blue-moon', 'ring-red-sun'], 's13', [1000, 200, 1440, 395], 3, 1)
grid('city-ui', ['rel-heart', 'rel-star', 'rel-link'], 's13', [900, 400, 1440, 700], 1, 3)
grid('city-ui', ['paper-plain', 'paper-red', 'paper-blue', 'paper-face'], 's01', [15, 305, 490, 505], 4, 1)
one('city-ui', 'frame-x', 's01', [495, 305, 615, 435])
one('city-ui', 'frame-small', 's01', [498, 440, 615, 562])
grid('city-ui', ['ribbon-paper', 'ribbon-red', 'ribbon-blue', 'ribbon-gold', 'ribbon-green'], 's01', [625, 305, 890, 505], 5, 1)
one('city-ui', 'plate-dark-small', 's01', [15, 505, 140, 578])
one('city-ui', 'plate-paper-wide', 's01', [140, 505, 350, 578])
one('city-ui', 'plate-dark-wide', 's01', [350, 505, 490, 578])
one('city-ui', 'chain-dots', 's01', [625, 515, 890, 575])
grid('city-ui', ['bar-plain', 'bar-person', 'bar-heart', 'bar-eye', 'bar-hourglass'], 's01', [900, 385, 1170, 640], 1, 5)
grid('city-ui', ['gauge-heart', 'gauge-mind', 'gauge-eye', 'gauge-hourglass', 'gauge-leaf'], 's01', [15, 725, 335, 1000], 5, 1)
grid('city-ui', ['meter-heart', 'meter-eye', 'meter-person', 'meter-leaf', 'meter-bolt'], 's01', [340, 778, 660, 1000], 1, 5)
grid('city-ui', ['pips-red', 'pips-blue', 'pips-gold', 'pips-green', 'pips-paper'], 's01', [660, 778, 850, 1000], 1, 5)
one('city-ui', 'check-small', 's01', [1118, 788, 1172, 838])
one('city-ui', 'x-small', 's01', [1172, 788, 1228, 838])
one('city-ui', 'toggle-on', 's01', [1240, 783, 1332, 833])
one('city-ui', 'toggle-off', 's01', [1240, 838, 1332, 885])
one('city-ui', 'toggle-green', 's01', [1345, 785, 1445, 833])
one('city-ui', 'toggle-red', 's01', [1345, 838, 1445, 885])
grid('city-ui', ['mini-dark', 'mini-blue', 'mini-gold', 'mini-green'], 's01', [860, 840, 1100, 930], 4, 1)
one('city-ui', 'mini-dark2', 's01', [860, 930, 958, 1000])
one('city-ui', 'mini-dark3', 's01', [962, 930, 1042, 1000])
one('city-ui', 'mini-paper', 's01', [1048, 932, 1112, 998])
one('city-ui', 'mini-x', 's01', [1118, 888, 1202, 1000])
one('city-ui', 'mini-red', 's01', [1204, 888, 1290, 1000])
one('city-ui', 'mini-blue2', 's01', [1292, 888, 1372, 1000])
one('city-ui', 'mini-green2', 's01', [1374, 888, 1445, 1000])
grid('city-ui', ['plate-gold-long', 'plate-red-long', 'plate-blue-long', 'plate-green-long', 'plate-dark-long'], 's01', [15, 1000, 1445, 1082], 5, 1)
one('city-ui', 'divider-sun', 's01', [345, 725, 880, 778])
one('city-ui', 'divider-a', 's01', [900, 655, 1445, 700])
one('city-ui', 'divider-b', 's01', [900, 700, 1445, 745])
one('city-ui', 'dlg-star', 's12', [15, 40, 528, 292])
one('city-ui', 'dlg-x', 's12', [545, 40, 1005, 292])
grid('city-ui', ['plate-sun', 'plate-moon', 'plate-seal'], 's12', [1020, 40, 1442, 322], 1, 3)
one('city-ui', 'dlg-scales', 's12', [15, 315, 472, 556])
one('city-ui', 'dlg-question', 's12', [478, 315, 938, 556])
one('city-ui', 'bubble-dark', 's12', [945, 340, 1105, 442])
one('city-ui', 'bubble-paper', 's12', [1105, 340, 1248, 442])
one('city-ui', 'bubble-moon', 's12', [1250, 340, 1442, 442])
one('city-ui', 'dlg-city', 's12', [15, 570, 568, 802])
one('city-ui', 'dlg-books', 's12', [15, 810, 668, 1082])
one('city-ui', 'pills-3', 's12', [680, 810, 1000, 862])
one('city-ui', 'pill-star-moon', 's12', [680, 863, 1000, 912])
one('city-ui', 'pill-flask-herb', 's12', [680, 913, 1000, 968])
one('city-ui', 'pill-pyramid-skull', 's12', [680, 970, 1000, 1045])
one('city-ui', 'plate-sun-r', 's12', [1018, 812, 1200, 878])
one('city-ui', 'plate-blue-r', 's12', [1208, 812, 1442, 878])
one('city-ui', 'plate-moon-r', 's12', [1018, 880, 1200, 942])
one('city-ui', 'plate-star-r', 's12', [1208, 880, 1442, 942])
one('city-ui', 'dividers-gem', 's12', [1018, 945, 1442, 1078])
grid('city-ui', ['plate-p-star', 'plate-p-moon', 'plate-p-eye'], 's24', [0, 830, 420, 1086], 1, 3)
grid('city-ui', ['flag-red', 'flag-blue', 'flag-green'], 's24', [420, 830, 700, 1086], 3, 1)
grid('city-ui', ['label-red', 'label-blue', 'label-green'], 's24', [1090, 830, 1448, 1086], 1, 3)
one('city-ui', 'kit-tags', 's05', [784, 64, 1001, 324])
one('city-ui', 'kit-tag-pair', 's05', [1025, 63, 1178, 207])
one('city-ui', 'kit-octagon', 's05', [1020, 215, 1179, 316])
one('city-ui', 'kit-ovals', 's05', [903, 341, 1116, 637])
one('city-ui', 'kit-bars5', 's05', [1136, 345, 1401, 637])
one('city-ui', 'kit-plate-sun-wide', 's05', [47, 657, 536, 799])
one('city-ui', 'kit-face-square', 's05', [992, 642, 1064, 720])
one('city-ui', 'kit-speech', 's05', [1071, 642, 1392, 720])
one('city-ui', 'kit-sunrise', 's05', [650, 682, 832, 798])
one('city-ui', 'kit-alert-bar', 's05', [991, 742, 1392, 802])
one('city-ui', 'kit-controls', 's05', [46, 807, 724, 867])
one('city-ui', 'kit-arrow', 's05', [1351, 820, 1398, 866])
one('city-ui', 'kit-plates5', 's05', [446, 875, 723, 1072])
one('city-ui', 'chain-diagram', 's13', [930, 880, 1440, 1080])

# ---- Corrected regions (s28 = medallions/frames/seals/icons sheet; s29 = network sheet) ----
grid('city-icons', ['face-%d' % i for i in range(8)], 's28', [0, 0, 1448, 175], 8, 1)
grid('city-icons', ['face-%d' % i for i in range(8, 16)], 's28', [0, 180, 1448, 350], 8, 1)
grid('city-ui', ['ring-c-star', 'ring-c-moon', 'ring-c-eye', 'ring-c-pyramid'], 's28', [0, 355, 720, 570], 4, 1)
grid('city-ui', ['rel-heart2', 'rel-hands', 'rel-heart3', 'rel-eye'], 's28', [730, 355, 1448, 570], 2, 2)
grid('city-icons', ['wax-star', 'wax-moon', 'wax-eye', 'wax-crown', 'wax-pyramid', 'wax-fleur', 'wax-snake', 'wax-keys'], 's28', [0, 580, 950, 730], 8, 1)
grid('city-icons', ['gicon-star', 'gicon-moon', 'gicon-eye', 'gicon-crown', 'gicon-anchor', 'gicon-cross'], 's28', [950, 585, 1448, 655], 6, 1)
grid('city-icons', ['gicon-pentagram', 'gicon-coins', 'gicon-gear', 'gicon-book', 'gicon-handshake', 'gicon-scales'], 's28', [950, 660, 1448, 735], 6, 1)
grid('city-cards', ['char-sleuth-red', 'char-lady-moon2', 'char-scholar-shelf2', 'char-lady-fur'], 's28', [0, 735, 720, 1086], 4, 1)
grid('city-ui', ['plate-i-star', 'plate-i-moon', 'plate-i-eye', 'plate-i-dark', 'plate-thin'], 's28', [725, 740, 1000, 1086], 1, 5)
grid('city-ui', ['plate-e1', 'plate-e2', 'plate-e3', 'plate-e4'], 's28', [1005, 740, 1200, 1050], 1, 4)
grid('city-ui', ['rib-red', 'rib-blue', 'rib-green', 'rib-gold'], 's28', [1205, 740, 1448, 940], 4, 1)
grid('city-icons', ['gicon-star-big', 'gicon-star-blue', 'gicon-fleur'], 's28', [1205, 945, 1448, 1086], 3, 1)
grid('city-icons', ['face-%d' % i for i in range(16, 24)], 's29', [15, 845, 440, 1086], 4, 2)
grid('city-ui', ['rel-heart2b', 'rel-hands2', 'rel-broken', 'rel-eye2', 'rel-moon2'], 's29', [460, 800, 810, 1086], 1, 5)
one('city-ui', 'note-pinned', 's29', [815, 800, 1085, 1086])
grid('city-icons', ['gold-magnifier', 'gold-key', 'gold-book', 'gold-star', 'gold-scroll', 'gold-hat'], 's29', [1105, 875, 1448, 1070], 3, 2)
one('city-ui', 'panel-counters', 's29', [1100, 15, 1448, 400])
one('city-ui', 'panel-bank', 's29', [15, 15, 350, 205])
one('city-ui', 'panel-star', 's29', [15, 215, 350, 405])
one('city-ui', 'panel-pyramid', 's29', [15, 435, 350, 640])
one('city-ui', 'panel-crown', 's29', [15, 640, 350, 835])
one('city-ui', 'panel-mind', 's29', [1100, 410, 1448, 590])
one('city-ui', 'panel-heart', 's29', [1100, 590, 1448, 725])
one('city-ui', 'panel-scales', 's29', [1100, 725, 1448, 875])
one('city-ui', 'board-network', 's29', [355, 15, 1085, 800])
grid('city-icons', ['face-24', 'face-25', 'face-26', 'face-27'], 's16', [1160, 0, 1448, 520], 1, 4)
grid('city-icons', ['face-28', 'face-29', 'face-30', 'face-31', 'face-32', 'face-33', 'face-34', 'face-35', 'face-36', 'face-37'], 's25', [1095, 0, 1448, 720], 2, 5)
grid('city-icons', ['face-38', 'face-39', 'face-40', 'face-41', 'face-42', 'face-43'], 's18', [1160, 0, 1448, 480], 2, 3)
grid('city-icons', ['face-44', 'face-45', 'face-46', 'face-47'], 's18', [15, 800, 530, 905], 4, 1)
grid('city-ui', ['ring-o-star', 'ring-o-blue', 'ring-o-paper', 'ring-o-red', 'ring-o-green'], 's18', [15, 910, 530, 1086], 5, 1)
grid('city-icons', ['gicon2-star', 'gicon2-moon', 'gicon2-sun', 'gicon2-eye', 'gicon2-handshake', 'gicon2-snake', 'gicon2-scales', 'gicon2-book', 'gicon2-blue', 'gicon2-red', 'gicon2-star2', 'gicon2-star3'], 's18', [795, 800, 1175, 1086], 4, 3)
grid('city-ui', ['oval-blue-face', 'oval-blue', 'oval-red-big', 'oval-blue-big'], 's18', [1160, 480, 1448, 1086], 2, 2)
grid('city-cards', ['back-sun', 'back-moon', 'back-eye', 'back-scales', 'back-key', 'back-snake'], 's24', [0, 0, 1448, 415], 6, 1)
grid('city-cards', ['char-officer-lamp', 'char-brawler-knuckles', 'char-cultists', 'char-lady-fan', 'char-worker', 'char-scholar-window'], 's24', [0, 420, 1448, 815], 6, 1)

# Mockup screens used whole (as backdrops): the network board, the casebook.
# one('city-tables', 'screen-network', 's03', None)
# one('city-tables', 'screen-casebook', 's10', None)
# one('city-tables', 'screen-legacy', 's15', None)
# one('city-tables', 'screen-court', 's07', None)
# one('city-tables', 'screen-person', 's09', None)


# ------------------------------------------------------------------ cutting
def maxch(im):
    r, g, b = im.convert('RGB').split()
    from PIL import ImageChops
    return ImageChops.lighter(r, ImageChops.lighter(g, b))

def profile(mask, x0, y0, x1, y1, axis):
    """Fraction of ink per column (axis x) or row (axis y) inside a box."""
    part = mask.crop((x0, y0, x1, y1))
    if axis == 'x': return list(part.resize((x1 - x0, 1), Image.BOX).getdata())
    return list(part.resize((1, y1 - y0), Image.BOX).getdata())

def trim(mask, x0, y0, x1, y1):
    cols = profile(mask, x0, y0, x1, y1, 'x'); rows = profile(mask, x0, y0, x1, y1, 'y')
    t = 1.6  # a column with less than 0.6% ink is gutter
    a = 0
    while a < len(cols) - 1 and cols[a] <= t: a += 1
    b = len(cols)
    while b > a + 1 and cols[b - 1] <= t: b -= 1
    c = 0
    while c < len(rows) - 1 and rows[c] <= t: c += 1
    d = len(rows)
    while d > c + 1 and rows[d - 1] <= t: d -= 1
    return x0 + a, y0 + c, x0 + b, y0 + d

def snap_cuts(profile, n, span0):
    """n-1 cut positions: the darkest column near each even division."""
    L = len(profile); cw = L / n; cuts = []
    for i in range(1, n):
        c = int(i * cw); lo = max(0, int(c - 0.3 * cw)); hi = min(L - 1, int(c + 0.3 * cw))
        best = min(range(lo, hi + 1), key=lambda k: (profile[k], abs(k - c)))
        cuts.append(span0 + best)
    return cuts

def cells(mask, box, cols, rows):
    x0, y0, x1, y1 = box
    xs = [x0] + snap_cuts(profile(mask, x0, y0, x1, y1, 'x'), cols, x0) + [x1]
    ys = [y0] + snap_cuts(profile(mask, x0, y0, x1, y1, 'y'), rows, y0) + [y1]
    out = []
    for r in range(rows):
        for c in range(cols):
            out.append(trim(mask, xs[c], ys[r], xs[c + 1], ys[r + 1]))
    return out

def encode(im, width, q):
    if im.width > width:
        im = im.resize((width, max(1, round(im.height * width / im.width))), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=q, method=4, alpha_quality=85)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode('ascii'), im

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args: sys.exit(__doc__)
    folder = args[0]
    preview = '--preview' in sys.argv
    only = None
    for a in sys.argv[1:]:
        if a.startswith('--only='): only = set(a[7:].split(','))
    sheets = {}
    def sheet(name):
        if name not in sheets:
            p = os.path.join(folder, name + '.png')
            if os.path.exists(p):
                im = Image.open(p).convert('RGBA')
                sheets[name] = (im, maxch(im).point(lambda v: 255 if v > THR else 0))
            else: sheets[name] = None
        return sheets[name]
    pv = os.path.join(ROOT, 'tools', '.preview', 'city')
    if preview: os.makedirs(pv, exist_ok=True)
    total = 0
    for file, spec in FILES.items():
        lines = ['/* Generated by tools/build_city_art.py from the Free City sheets. Do not edit. */', ':root {']
        n = 0
        for entry in M[file]:
            kind = entry[0]
            got = sheet(entry[2])
            if got is None:
                print('  missing sheet', entry[2], 'for', entry[1]); continue
            if only and entry[2] not in only: continue
            sh, mask = got
            if kind == 'one':
                key, box = entry[1], entry[3]
                if box is None: box = (0, 0, sh.width, sh.height)
                else: box = trim(mask, *box)
                pieces = [(key, box)]
            else:
                names, box, cols, rows = entry[1], entry[3], entry[4], entry[5]
                pieces = [(nm, b) for nm, b in zip(names, cells(mask, box, cols, rows)) if nm]
            for key, box in pieces:
                im = sh.crop(box)
                if entry[2] in ('s30', 's31', 's32', 's33', 's03', 's10', 's15', 's07', 's09'):
                    im = im.convert('RGB')
                else:
                    im = keyed(im)
                uri, small = encode(im, spec['width'], spec['q'])
                lines.append('  --art-%s: url("%s");' % (key, uri))
                if preview: small.save(os.path.join(pv, key + '.png'))
                n += 1; total += len(uri)
        lines.append('}')
        with open(os.path.join(OUT, file + '.css'), 'w') as f: f.write('\n'.join(lines) + '\n')
        print('%s: %d pieces' % (file, n))
    print('total %.1f MB of data URIs' % (total / 1e6))

def keyed(im):
    """Make the black sheet transparent: everything near-black that touches
    the crop's border is outside the piece. Dark pixels inside a picture stay
    opaque, and the edge is feathered so the gold rims stay smooth."""
    from PIL import ImageDraw, ImageFilter
    im = im.convert('RGBA')
    dark = maxch(im).point(lambda m: 0 if m <= 30 else 255)
    w, h = dark.size
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    seeds += [(x, 0) for x in range(0, w, 8)] + [(x, h - 1) for x in range(0, w, 8)]
    seeds += [(0, y) for y in range(0, h, 8)] + [(w - 1, y) for y in range(0, h, 8)]
    for sd in seeds:
        if dark.getpixel(sd) == 0: ImageDraw.floodfill(dark, sd, 128)
    alpha = dark.point(lambda v: 0 if v == 128 else 255).filter(ImageFilter.GaussianBlur(0.7))
    im.putalpha(alpha)
    return im

if __name__ == '__main__':
    main()
