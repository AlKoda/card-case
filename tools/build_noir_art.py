#!/usr/bin/env python3
"""Cut the Candlemark Noir sheets into pieces and embed them in css/art/noir-*.css.

The sheets are supplied outside the repository (it holds no binary files);
every piece becomes a base64 WebP data URI under a CSS custom property
--art-<key>. Simple is king: most pieces are pictures only, and the card
frame around them is drawn by css/style.css.

Usage:
    pip install pillow
    python3 tools/build_noir_art.py path/to/sheets/ [--preview]

The folder holds the sheets as n01.png ... n25.png in the order they were
supplied (see docs/ART.md for which is which). --preview writes a labelled montage of every
family to tools/.preview/noir/ so the names can be checked by eye.

Manifest forms:
    one(file, key, sheet, box, inset=None)   one box; inset = (l, t, r, b)
                                             fractions of the box to keep
    row(file, prefix, sheet, boxes, inset)   numbered pieces prefix-01...
"""
import base64, io, os, sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit('pip install pillow')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'css', 'art')

FILES = {
    'noir-cards': dict(width=232, q=68),    # card pictures and full faces (card is 116px wide, drawn at 2x)
    'noir-icons': dict(width=96, q=76),     # chips, coins, meter icons
    'noir-verbs': dict(width=180, q=74),    # verb boxes
    'noir-tables': dict(width=1672, q=56),  # the table and the menu scene
}
M = {k: [] for k in FILES}

def one(file, key, sheet, box, inset=None): M[file].append((key, sheet, box, inset))
def row(file, prefix, sheet, boxes, inset=None):
    for i, b in enumerate(boxes): one(file, '%s-%02d' % (prefix, i + 1), sheet, b, inset)
def cells(x0, y0, x1, y1, n, w=None):
    """n boxes evenly spaced from x0 to x1 (w = width of each, default the pitch)."""
    pitch = (x1 - x0) / n
    w = w or pitch
    return [(round(x0 + i * pitch), y0, round(x0 + i * pitch + w), y1) for i in range(n)]

# ---- Tables and scenes (full bleed) ---------------------------------------
# The table: only the gold-framed mat (the printed card outlines around it are left out).
one('noir-tables', 'ntable', 'n04', (120, 95, 1552, 800))
one('noir-tables', 'nmenu', 'n09', None)

# ---- Silhouette portraits (five sheets of eight): people ------------------
PORTRAITS = []
for sheet, boxes in [
    ('n18', [(45, 19, 400, 454), (457, 20, 811, 454), (865, 20, 1220, 454), (1275, 19, 1631, 454), (45, 479, 400, 915), (457, 479, 810, 915), (865, 479, 1220, 915), (1276, 479, 1631, 915)]),
    # The other sheets repeat that top row: only their second rows are new faces.
    ('n19', [(39, 444, 409, 877), (482, 443, 853, 877), (924, 443, 1294, 877), (1366, 443, 1737, 877)]),
    ('n20', [(74, 453, 430, 878), (499, 453, 853, 878), (925, 452, 1278, 878), (1343, 453, 1701, 878)]),
    ('n21', [(53, 521, 381, 985), (425, 521, 751, 985), (790, 521, 1114, 985), (1156, 521, 1485, 985)]),
    ('n22', [(46, 476, 402, 921), (454, 479, 818, 923), (859, 479, 1225, 923), (1273, 479, 1636, 923)]),
]:
    PORTRAITS += [(sheet, b) for b in boxes]
for i, (sheet, b) in enumerate(PORTRAITS):
    # The pictures are taller than the card's picture area: keep the head and shoulders.
    one('noir-cards', 'nport-%02d' % (i + 1), sheet, b, (0.03, 0.03, 0.97, 0.80))

# ---- Detailed portrait cards (n23): the Watch -----------------------------
row('noir-cards', 'nface', 'n23', [(17, 16, 356, 521), (375, 16, 714, 520), (733, 16, 1073, 521), (1093, 16, 1432, 521), (17, 540, 356, 1045), (375, 541, 714, 1045), (733, 540, 1073, 1045), (1093, 540, 1432, 1045)], (0.02, 0.02, 0.98, 0.60))
# ---- Bold portrait cards (n11): patrons and callings ----------------------
row('noir-cards', 'nhero', 'n11', [(33, 43, 356, 513), (388, 43, 709, 513), (740, 43, 1062, 513), (1093, 43, 1415, 513), (33, 558, 356, 1028), (388, 557, 709, 1028), (740, 557, 1062, 1027), (1094, 557, 1416, 1028)], (0.03, 0.03, 0.97, 0.78))

# ---- Places -----------------------------------------------------------------
# n24: ten tall ink locations; the picture is the top of the card.
row('noir-cards', 'nloc', 'n24', [(19, 27, 285, 520), (306, 27, 571, 520), (593, 27, 860, 520), (879, 27, 1145, 520), (1164, 27, 1430, 520), (20, 547, 285, 1039), (306, 547, 571, 1039), (593, 547, 857, 1039), (878, 547, 1145, 1039), (1165, 547, 1429, 1039)], (0.03, 0.03, 0.97, 0.62))
# n13: eight coloured city locations; n14: eight rooms. The round picture sits in the top of the card.
row('noir-cards', 'nplace', 'n13', [(27, 54, 359, 522), (384, 54, 711, 521), (736, 54, 1067, 521), (1093, 54, 1425, 521), (28, 554, 358, 1030), (383, 554, 710, 1031), (736, 554, 1065, 1030), (1092, 554, 1424, 1031)], (0.07, 0.06, 0.93, 0.66))
row('noir-cards', 'nroom', 'n14', [(32, 47, 357, 507), (385, 47, 711, 507), (739, 47, 1065, 507), (1092, 47, 1418, 507), (32, 554, 357, 1015), (385, 554, 711, 1015), (739, 554, 1065, 1015), (1092, 554, 1418, 1016)], (0.07, 0.06, 0.93, 0.68))

# ---- Evidence (n12): twelve round pictures ----------------------------------
row('noir-cards', 'nev', 'n12', [(58, 19, 363, 339), (402, 19, 706, 339), (745, 19, 1048, 340), (1086, 19, 1390, 339), (58, 370, 363, 688), (402, 370, 706, 689), (745, 370, 1049, 689), (1087, 370, 1391, 689), (58, 722, 363, 1042), (402, 721, 705, 1043), (744, 721, 1048, 1043), (1087, 721, 1391, 1043)], (0.09, 0.07, 0.91, 0.70))

# ---- Paper cards with a corner icon (n25): words on paper -------------------
row('noir-cards', 'npaper', 'n25', [(25, 23, 355, 357), (380, 23, 711, 358), (738, 23, 1067, 358), (1094, 23, 1424, 358), (25, 379, 355, 709), (382, 380, 710, 708), (737, 379, 1067, 709), (1094, 380, 1424, 709), (25, 730, 355, 1061), (381, 731, 710, 1061), (738, 730, 1067, 1061), (1095, 730, 1423, 1061)])

# ---- Tarot faces (n06 row 1): resources, with their own paper band; and three backs
row('noir-cards', 'ntarot', 'n06', [(24, 52, 174, 285), (179, 52, 329, 285), (333, 52, 483, 285), (488, 52, 636, 285), (640, 51, 790, 285), (795, 51, 944, 284), (953, 49, 1106, 283), (1111, 49, 1266, 283), (1272, 49, 1428, 284)])
# n06 row 2: illustrated cards with a paper band
row('noir-cards', 'ntar2', 'n06', [(24, 304, 194, 546), (200, 304, 371, 546), (377, 304, 549, 546), (554, 304, 720, 546), (726, 303, 892, 546), (899, 304, 1070, 546), (1076, 303, 1249, 546), (1255, 303, 1425, 545)])

# The same illustrated row as pictures only (the top of each card), for clue faces.
row('noir-cards', 'ntp', 'n06', [(24, 304, 194, 546), (200, 304, 371, 546), (377, 304, 549, 546), (554, 304, 720, 546), (726, 303, 892, 546), (899, 304, 1070, 546), (1076, 303, 1249, 546), (1255, 303, 1425, 545)], (0.06, 0.05, 0.94, 0.64))

# ---- Icons (n16) -------------------------------------------------------------
ICON_ROWS = [
    [(24, 42, 179, 195), (198, 42, 354, 195), (378, 42, 535, 195), (556, 42, 712, 195), (734, 42, 892, 195), (914, 42, 1071, 195), (1092, 42, 1250, 195), (1271, 42, 1424, 195)],
    [(24, 218, 179, 371), (199, 218, 355, 372), (377, 218, 535, 372), (556, 218, 712, 372), (734, 218, 891, 372), (913, 218, 1071, 372), (1092, 219, 1250, 372), (1271, 218, 1424, 372)],
    [(24, 397, 178, 553), (201, 397, 357, 553), (379, 398, 534, 554), (557, 397, 712, 554), (734, 398, 891, 554), (915, 399, 1070, 552), (1094, 398, 1250, 552), (1271, 397, 1424, 554)],
    [(18, 573, 155, 715), (168, 573, 306, 715), (316, 575, 453, 715), (466, 575, 588, 716), (605, 575, 732, 715), (741, 574, 880, 715), (888, 574, 1027, 716), (1289, 574, 1427, 716)],
]
row('noir-icons', 'nsq', 'n16', [b for r in ICON_ROWS for b in r])
row('noir-icons', 'ncoin', 'n16', [(21, 731, 118, 829), (120, 731, 215, 829), (218, 731, 309, 829), (315, 731, 411, 829), (411, 731, 507, 829), (507, 731, 603, 829), (606, 731, 702, 829), (702, 731, 798, 829), (804, 731, 901, 829), (909, 731, 1007, 829), (1013, 731, 1114, 829), (1120, 731, 1218, 829), (1226, 731, 1325, 829), (1329, 731, 1425, 829)])
row('noir-icons', 'nsmall', 'n16', [(21, 839, 106, 921), (115, 839, 201, 921), (205, 840, 284, 920), (289, 841, 366, 918), (371, 841, 445, 918), (450, 840, 527, 919), (529, 840, 607, 919), (613, 840, 685, 917), (690, 840, 769, 920), (774, 840, 853, 920), (858, 841, 937, 921), (942, 840, 1022, 921), (1038, 842, 1093, 921), (1115, 842, 1169, 921), (1190, 842, 1245, 921), (1267, 842, 1323, 921), (1344, 839, 1423, 919)])
row('noir-icons', 'nwax', 'n16', cells(836, 933, 1429, 1043, 6))

# ---- Verb boxes (n08) ---------------------------------------------------------
row('noir-verbs', 'nverb', 'n08', [(53, 153, 230, 325), (286, 152, 463, 325), (518, 152, 695, 325), (751, 152, 928, 325), (984, 152, 1162, 325), (1219, 152, 1399, 325), (53, 354, 229, 526), (286, 354, 462, 528), (518, 354, 695, 528), (751, 354, 928, 528), (984, 354, 1162, 528), (1219, 354, 1399, 529)])
row('noir-verbs', 'nbox', 'n08', [(37, 611, 180, 753), (212, 612, 356, 753), (389, 611, 532, 753), (565, 612, 708, 753), (741, 612, 884, 753), (918, 611, 1061, 753), (1094, 611, 1237, 753), (1270, 611, 1412, 753)])


def encode(im, width, q):
    if im.width > width:
        im = im.resize((width, max(1, round(im.height * width / im.width))), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=q, method=4, alpha_quality=85)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode('ascii'), im


def montage(pieces, path):
    if not pieces: return
    cw = max(p.width for _, p in pieces) + 8
    ch = max(p.height for _, p in pieces) + 22
    cols = min(8, len(pieces))
    rows = (len(pieces) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cw, rows * ch), (40, 40, 40))
    d = ImageDraw.Draw(sheet)
    for i, (key, p) in enumerate(pieces):
        x, y = (i % cols) * cw, (i // cols) * ch
        sheet.paste(p.convert('RGBA'), (x + 4, y + 18), p.convert('RGBA'))
        d.text((x + 4, y + 2), key, fill=(255, 220, 120))
    sheet.save(path)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args: sys.exit(__doc__)
    folder, preview = args[0], '--preview' in sys.argv
    sheets = {}
    def sheet(name):
        if name not in sheets:
            p = os.path.join(folder, name + '.png')
            sheets[name] = Image.open(p).convert('RGBA') if os.path.exists(p) else None
        return sheets[name]
    pv = os.path.join(ROOT, 'tools', '.preview', 'noir')
    if preview: os.makedirs(pv, exist_ok=True)
    total = 0
    for file, spec in FILES.items():
        lines = ['/* Generated by tools/build_noir_art.py from the Candlemark Noir sheets. Do not edit. */', ':root {']
        pieces = {}
        for key, sname, box, inset in M[file]:
            im = sheet(sname)
            if im is None: continue
            if box is None: box = (0, 0, im.width, im.height)
            x0, y0, x1, y1 = box
            if inset:
                w, h = x1 - x0, y1 - y0
                x0, y0, x1, y1 = round(x0 + inset[0] * w), round(y0 + inset[1] * h), round(x0 + inset[2] * w), round(y0 + inset[3] * h)
            piece = im.crop((x0, y0, x1, y1))
            if piece.getextrema()[3][0] == 255: piece = piece.convert('RGB')
            uri, small = encode(piece, spec['width'], spec['q'])
            lines.append('  --art-%s: url("%s");' % (key, uri))
            total += len(uri)
            pieces.setdefault(key.split('-')[0], []).append((key, small))
        lines.append('}')
        with open(os.path.join(OUT, file + '.css'), 'w') as f: f.write('\n'.join(lines) + '\n')
        if preview:
            for fam, ps in pieces.items(): montage(ps, os.path.join(pv, fam + '.png'))
        print('%s: %d pieces' % (file, sum(len(p) for p in pieces.values())))
    print('total %.1f MB of data URIs' % (total / 1e6))

if __name__ == '__main__':
    main()
