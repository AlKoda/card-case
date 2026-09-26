#!/usr/bin/env python3
"""Cut the art sheets into pieces and embed them in css/art/*.css.

The art ships as base64 WebP data URIs inside CSS files, so the repository
holds no binary files (pull requests here can't carry binaries).

Usage:
    pip install pillow
    python3 tools/build_art.py path/to/sheets/ [--preview]

The folder must hold the source sheets under these names (1448x1086 PNGs
with transparent backgrounds):
    ui.png        card frames, first verb tokens, aspect and status icons
    icons.png     square/round/diamond icons, portraits, card backs
    frames.png    UI frames: slots, toasts, banners
    verbs.png     the illustrated verb tokens with name plates
    evidence.png  illustrated evidence cards and small props
    dossiers.png  wide case-file panels
    menu.png      the main menu mock-up (only the logo is used)
    table.png     the table background
    cards.png     illustrated character and scene cards
A missing sheet is skipped and its CSS file left as it is.

--preview also writes every piece as PNG to tools/.preview/ (git-ignored).

Boxes are (left, top, right, bottom) in sheet pixels. When new art arrives,
add entries below and re-run.
"""
import base64
import collections
import io
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / 'css' / 'art'


def grid(names, x0, x1, y0, y1):
    """Split one row [x0, x1) evenly into len(names) boxes."""
    step = (x1 - x0) / len(names)
    return {n: (round(x0 + i * step), y0, round(x0 + (i + 1) * step), y1) for i, n in enumerate(names) if n}


# ---------------------------------------------------------------- ui.png
UI = {
    'frame-case': (32, 292, 284, 636),
    'frame-evidence': (316, 292, 576, 636),
    'frame-character': (600, 292, 852, 636),
    'frame-location': (876, 292, 1136, 636),
    'frame-status': (1168, 292, 1420, 636),
    'aspect-forensic': (40, 672, 144, 772),
    'aspect-testimony': (162, 672, 262, 772),
    'aspect-motive': (279, 672, 381, 772),
    'aspect-opportunity': (404, 672, 512, 772),
    'aspect-digital': (535, 672, 637, 772),
    'aspect-financial': (656, 672, 768, 772),
    'card-back': (232, 820, 416, 1072),
    'divider': (432, 904, 916, 966),
    'icon-alert': (456, 980, 524, 1048),
}

# ------------------------------------------------------------- icons.png
ICONS = {}
ICONS.update(grid(['icon-health', 'icon-focus', 'icon-instinct', 'icon-funds', 'icon-fatigue', 'icon-burnout',
                   'icon-retaliation', 'icon-roots'], 33, 828, 24, 117))
ICONS.update({'icon-mask': (834, 24, 927, 117), 'icon-group': (930, 24, 1020, 117),
              'icon-search': (1026, 24, 1122, 117), 'icon-star': (1128, 24, 1221, 117),
              'icon-obsession': (1227, 24, 1320, 117), 'icon-hook': (1326, 24, 1419, 117)})
for name, box in zip(['icon-folder', 'icon-mind', 'icon-binoculars', 'icon-car', 'icon-court', 'icon-megaphone',
                      'icon-masks', 'icon-gavel', 'icon-scales', 'icon-handshake', 'icon-redeye', 'icon-pyramid'],
                     [(33, 129, 135, 225), (144, 129, 255, 225), (264, 129, 369, 225), (378, 129, 486, 225),
                      (495, 129, 603, 225), (612, 129, 720, 225), (726, 129, 834, 225), (840, 129, 945, 225),
                      (954, 129, 1059, 225), (1068, 129, 1179, 225), (1191, 129, 1302, 225), (1311, 129, 1416, 225)]):
    ICONS[name] = box
ICONS['icon-lock'] = (597, 444, 711, 555)
ICONS['token-time'] = (24, 717, 174, 876)
ICONS['card-back-red'] = (1239, 741, 1419, 1020)
ICONS.update(grid(['portrait-%d' % i for i in range(9)], 30, 1041, 879, 1044))

# ------------------------------------------------------------ frames.png
FRAMES = {
    'slot-dark': (21, 414, 120, 531),
    'slot-gold': (360, 414, 462, 531),
    'toast-danger': (30, 646, 104, 708),
    'toast-major': (30, 722, 104, 772),
    'toast-case': (30, 785, 104, 832),
    'toast-victory': (30, 845, 104, 889),
}

# ------------------------------------------------------------- verbs.png
# Each token is isolated from its neighbours (rows overlap slightly).
VERBS = {
    'token-duty': (87, 9, 396, 345), 'token-patrol': (405, 9, 720, 345),
    'token-investigate': (729, 9, 1044, 345), 'token-warrant': (1050, 9, 1362, 345),
    'token-interrogate': (15, 336, 297, 642), 'token-reflect': (300, 336, 582, 642),
    'token-arrest': (585, 336, 866, 642), 'token-stakeout': (866, 336, 1146, 642),
    'token-undercover': (1149, 336, 1434, 642),
    'token-taskforce': (90, 636, 393, 942), 'token-requisition': (411, 636, 714, 945),
    'token-rest': (729, 636, 1038, 945), 'token-analyze': (1053, 636, 1356, 945),
}

# ---------------------------------------------------------- evidence.png
# Only the picture between the two label plates is kept.
EVIDENCE_ROWS = [
    (['house', 'mugshot', 'photos', 'alley', 'fingerprint', 'glass', 'cassette', 'pair', 'chalk'],
     [(33, 21, 195, 285), (207, 18, 363, 282), (375, 18, 537, 285), (546, 18, 705, 285), (717, 18, 858, 285),
      (867, 18, 1005, 285), (1017, 18, 1146, 282), (1158, 18, 1284, 279), (1296, 18, 1425, 282)]),
    (['blood', 'vial', 'gem', 'leaf', 'pills', 'documents', 'letter', 'sketch', 'notepad'],
     [(30, 300, 177, 534), (186, 288, 321, 534), (333, 288, 468, 534), (477, 288, 627, 534), (639, 288, 780, 534),
      (792, 288, 954, 534), (963, 288, 1110, 534), (1122, 288, 1266, 534), (1278, 288, 1419, 534)]),
    (['newspaper', 'dossier', 'snapshots', 'badge', 'tag', 'key', 'bloodtag', 'memo', 'notes'],
     [(33, 543, 183, 765), (195, 543, 345, 762), (354, 543, 501, 762), (513, 543, 663, 765), (675, 543, 816, 765),
      (825, 546, 960, 762), (969, 543, 1113, 762), (1122, 543, 1260, 762), (1272, 543, 1419, 762)]),
]
EVIDENCE = {}
for names, boxes in EVIDENCE_ROWS:
    for n, (l, t, r, b) in zip(names, boxes):
        h = b - t
        EVIDENCE['ev-' + n] = (l + 10, t + round(h * 0.2), r - 10, b - round(h * 0.2))
EVIDENCE.update({'icon-camera': (1329, 783, 1413, 879), 'icon-boot': (1212, 783, 1308, 882)})

# ---------------------------------------------------------- dossiers.png
DOSSIERS = {
    'dossier-man': (36, 18, 714, 255), 'dossier-house': (738, 9, 1416, 255),
    'dossier-print': (39, 264, 690, 504), 'dossier-map': (714, 267, 1410, 501),
    'dossier-alley': (36, 510, 498, 705), 'dossier-badge': (519, 513, 930, 705),
    'dossier-redprint': (948, 507, 1413, 705), 'dossier-woman': (36, 711, 495, 894),
    'dossier-fedora': (519, 714, 909, 897), 'dossier-knife': (930, 717, 1416, 894),
    'dossier-tower': (33, 900, 762, 1074), 'dossier-city': (783, 900, 1416, 1074),
}

# ------------------------------------------------ menu, table, cards.png
MENU = {'logo': (468, 168, 1204, 382)}
TABLE = {'bg-table': (0, 0, 1672, 941)}
CARD_NAMES = [['man', 'woman', 'officer', 'city', 'fingerprint', 'board'],
              ['tangled', 'smoker', 'grimoire', 'crow', 'house', 'mirror'],
              ['map', 'letter', 'hourglass', 'eye', 'keyhole', 'tentacles']]
CARD_COLS = [(33, 246), (270, 483), (504, 714), (732, 945), (966, 1179), (1200, 1416)]
CARD_ROWS = [(9, 378), (384, 735), (738, 1071)]
CARDS = {'pcard-' + CARD_NAMES[r][c]: (CARD_COLS[c][0], CARD_ROWS[r][0], CARD_COLS[c][1], CARD_ROWS[r][1])
         for r in range(3) for c in range(6)}

# Writing areas the automatic detection gets wrong: (left, width) in %.
DOSSIER_LINES = {'dossier-redprint': (47.0, 46.0), 'dossier-tower': (77.0, 18.0)}

SHEETS = [
    ('ui', 'ui.png', UI),
    ('icons', 'icons.png', ICONS),
    ('frames', 'frames.png', FRAMES),
    ('verbs', 'verbs.png', VERBS),
    ('evidence', 'evidence.png', EVIDENCE),
    ('dossiers', 'dossiers.png', DOSSIERS),
    ('menu', 'menu.png', MENU),
    ('table', 'table.png', TABLE),
    ('cards', 'cards.png', CARDS),
]

# Longest side in pixels (about 2x on-screen size).
MAX_SIDE = [('frame', 260), ('aspect', 64), ('icon', 64), ('portrait', 120), ('toast', 56), ('slot', 140),
            ('token', 180), ('card-back', 220), ('divider', 480), ('ev-', 160), ('dossier', 600),
            ('bg-', 1600), ('logo', 740), ('pcard', 300)]


def fit(img, name):
    limit = next((v for k, v in MAX_SIDE if name.startswith(k)), 256)
    scale = min(1.0, limit / max(img.size))
    if scale < 1:
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    return img


def encode(img, quality=80):
    buf = io.BytesIO()
    img.save(buf, 'WEBP', quality=quality, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')


def isolate(img, thr=40):
    """Keep only the opaque region connected to the centre of the crop."""
    a = img.getchannel('A')
    px = a.load()
    w, h = img.size
    seed = (w // 2, h // 2)
    if px[seed] <= thr:
        return img
    keep = Image.new('L', img.size, 0)
    kp = keep.load()
    q = collections.deque([seed])
    kp[seed] = 255
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not kp[nx, ny] and px[nx, ny] > thr:
                kp[nx, ny] = 255
                q.append((nx, ny))
    out = img.copy()
    out.putalpha(Image.composite(a, keep, keep))
    return out


def cream(p):
    r, g, b, a = p
    return a > 200 and r > 200 and g > 185 and b > 140 and r - b < 90


def dossier_layout(img):
    """Find the title plate and the lined writing area, as % of the panel."""
    w, h = img.size
    px = img.load()
    # Title plate: the cream component touching the top third whose bottom
    # stays above 35% of the height.
    seen = set()
    best = None
    for y in range(0, int(h * 0.3), 2):
        for x in range(0, w, 2):
            if (x, y) in seen or not cream(px[x, y]):
                continue
            q = collections.deque([(x, y)])
            seen.add((x, y))
            x0 = x1 = x
            y0 = y1 = y
            n = 0
            while q and n < 60000:
                cx, cy = q.popleft()
                n += 1
                x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                for nx, ny in ((cx + 2, cy), (cx - 2, cy), (cx, cy + 2), (cx, cy - 2)):
                    if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and cream(px[nx, ny]):
                        seen.add((nx, ny))
                        q.append((nx, ny))
            bw, bh = x1 - x0, y1 - y0
            if y1 < h * 0.36 and 0.15 * w < bw < 0.5 * w and bh > 0.07 * h:
                if not best or bw * bh > best[2] * best[3]:
                    best = (x0, y0, bw, bh)
    # Writing area: the run of mostly-cream (or pale) columns on the right.
    def pale(p):
        r, g, b, a = p
        return a > 200 and r > 170 and g > 170 and b > 150
    rows = range(int(h * 0.42), int(h * 0.85), 3)
    cols = [sum(pale(px[x, y]) for y in rows) / len(rows) > 0.75 for x in range(w)]
    runs, start = [], None
    for x, c in enumerate(cols + [False]):
        if c and start is None:
            start = x
        if not c and start is not None:
            runs.append((start, x))
            start = None
    rx0, rx1 = max(runs, key=lambda r: r[1] - r[0]) if runs else (int(w * 0.45), int(w * 0.92))
    pct = lambda v, t: round(100.0 * v / t, 2)
    plate = best or (w * 0.35, h * 0.05, w * 0.3, h * 0.14)
    return {
        'plate': (pct(plate[0], w), pct(plate[1], h), pct(plate[2], w), pct(plate[3], h)),
        'lines': (pct(rx0 + 6, w), 40.0, pct(rx1 - rx0 - 18, w), 48.0),
    }


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        sys.exit(__doc__)
    src = Path(args[0])
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    preview = ROOT / 'tools' / '.preview'
    for key, fname, sprites in SHEETS:
        path = src / fname
        if not path.exists():
            print('skip %s (no %s)' % (key, fname))
            continue
        sheet = Image.open(path).convert('RGBA')
        pieces = {name: sheet.crop(box) for name, box in sprites.items()}
        if key in ('verbs', 'icons', 'cards'):
            for name in pieces:
                if name.startswith(('token', 'portrait', 'card-back', 'pcard')):
                    pieces[name] = isolate(pieces[name])
                if name.startswith('pcard'):
                    pieces[name] = pieces[name].crop(pieces[name].getchannel('A').getbbox())
        lines = ['/* Generated by tools/build_art.py from %s. Do not edit by hand. */' % fname, ':root {']
        extra = []
        total = 0
        for name, img in pieces.items():
            uri = encode(fit(img, name), 68 if name.startswith('bg-') else 80)
            total += len(uri)
            lines.append('  --art-%s: url("%s");' % (name, uri))
            if key == 'dossiers':
                lay = dossier_layout(img)
                if name in DOSSIER_LINES:
                    lay['lines'] = (DOSSIER_LINES[name][0], 40.0, DOSSIER_LINES[name][1], 48.0)
                ratio = round(img.height / img.width * 100, 3)
                extra.append('.dossier.%s { --ratio: %s%%; }' % (name, ratio))
                extra.append('.dossier.%s .d-plate { left: %s%%; top: %s%%; width: %s%%; height: %s%%; }' % ((name,) + lay['plate']))
                extra.append('.dossier.%s .d-lines { left: %s%%; top: %s%%; width: %s%%; height: %s%%; }' % ((name,) + lay['lines']))
        lines.append('}')
        out = OUT_DIR / (key + '.css')
        out.write_text('\n'.join(lines + extra) + '\n')
        print('wrote %s: %d pieces, %.0f KB' % (out.relative_to(ROOT), len(pieces), total / 1024))
        if '--preview' in sys.argv:
            preview.mkdir(exist_ok=True)
            for name, img in pieces.items():
                img.save(preview / (name + '.png'))


if __name__ == '__main__':
    main()
