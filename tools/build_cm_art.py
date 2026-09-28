#!/usr/bin/env python3
"""Cut the Candlemark sheets (the fourth batch, and the game's one style) into
css/art/cm-cards.css, cm-icons.css and cm-ui.css as base64 WebP custom
properties --art-<key>.

Usage:
    python3 tools/build_cm_art.py path/to/sheets/ [--preview]

The folder holds the sheets as e01.png ... e48.png in the order they were
supplied (docs/ART.md lists which is which). Most sheets are clean grids:
their tiles are found row by row from the background colour. The catalogue
sheets (e02, e06, e10, e14, e16) are cut by named regions, given as fractions
of the sheet, then each cell is trimmed to its picture. Every tile is kept
whole; the page scales pictures to fit.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_noir_art import encode, montage, ROOT, OUT
from PIL import Image
import numpy as np

FILES = {
    'cm-cards': dict(width=208, q=60),   # tall cards, frames, backs
    'cm-icons': dict(width=112, q=72),   # square and round icons, seals, stamps, markers
    'cm-ui': dict(width=128, q=76),      # buttons, pills, bars, panels (widths per family)
}

def mask_of(im):
    a = np.asarray(im.convert('RGBA')).astype(int)
    if a[:, :, 3].min() < 250: return a[:, :, 3] > 40
    bg = np.median(a[:8, :8, :3].reshape(-1, 3), axis=0)
    return np.abs(a[:, :, :3] - bg).sum(axis=2) > 70

def runs(v, gap, least):
    out, start = [], None
    for i, x in enumerate(list(v) + [False]):
        if x and start is None: start = i
        if not x and start is not None:
            if i - start >= least: out.append([start, i])
            start = None
    m = []
    for r in out:
        if m and r[0] - m[-1][1] <= gap: m[-1][1] = r[1]
        else: m.append(r)
    return m

def rows_of(mask, gap=4, least=30):
    """Tiles as rows of boxes. Two tiles that touch come out as one wide box:
    it is split by the row's usual width."""
    rows = []
    for y0, y1 in runs(mask.any(axis=1), gap, least):
        band = mask[y0:y1]
        row = []
        for x0, x1 in runs(band.any(axis=0), gap, least):
            ys = np.where(band[:, x0:x1].any(axis=1))[0]
            row.append((x0, y0 + ys[0], x1, y0 + ys[-1] + 1))
        if row:
            widths = sorted(b[2] - b[0] for b in row)
            base = [w for w in widths if w <= widths[0] * 1.4]   # the single tiles, not the merged ones
            med = base[len(base) // 2]
            split = []
            for b in row:
                n = max(1, round((b[2] - b[0]) / med))
                if n == 1: split.append(b); continue
                pw = (b[2] - b[0]) / n
                for i in range(n): split.append((round(b[0] + i * pw), b[1], round(b[0] + (i + 1) * pw), b[3]))
            row = split
        rows.append(row)
    return rows

def trim(mask, box, pad=2):
    """The picture inside a cell: the tallest run of rows with anything in
    them (a caption above a tile is a short run of its own), then its columns."""
    x0, y0, x1, y1 = box
    m = mask[y0:y1, x0:x1]
    blocks = runs(m.any(axis=1), 2, 1)
    if not blocks: return box
    b0, b1 = max(blocks, key=lambda r: r[1] - r[0])
    xs = np.where(m[b0:b1].any(axis=0))[0]
    return (max(0, x0 + xs.min() - pad), max(0, y0 + b0 - pad), x0 + xs.max() + 1 + pad, y0 + b1 + pad)

def region(W, H, frac, cols, nrows):
    fx0, fy0, fx1, fy1 = frac
    x0, y0, x1, y1 = fx0 * W, fy0 * H, fx1 * W, fy1 * H
    pw, ph = (x1 - x0) / cols, (y1 - y0) / nrows
    return [(round(x0 + c * pw), round(y0 + r * ph), round(x0 + (c + 1) * pw), round(y0 + (r + 1) * ph)) for r in range(nrows) for c in range(cols)]

# ---- what to cut ---------------------------------------------------------------
# ('rows', prefix, file, rows=None|[indexes], count=None, width=None)
# ('region', prefix, file, (x0, y0, x1, y1), cols, rows, width=None)
def R(prefix, file, frac, cols, nrows, width=None): return ('region', prefix, file, frac, cols, nrows, width)
def T(prefix, file, rows=None, count=None, width=None): return ('rows', prefix, file, rows, count, width)

S = {
    # the study's UI kit
    'e02': [T('cstory', 'cm-cards', rows=[0]),
            R('cpill', 'cm-ui', (0.015, 0.705, 0.985, 0.78), 9, 1, 320), R('cpilld', 'cm-ui', (0.015, 0.78, 0.985, 0.855), 9, 1, 320),
            R('cpillh', 'cm-ui', (0.015, 0.855, 0.985, 0.925), 9, 1, 320), R('cpillhd', 'cm-ui', (0.015, 0.925, 0.985, 0.985), 9, 1, 320)],
    'e04': [T('bsq', 'cm-ui', rows=[0, 1, 2]), T('bround', 'cm-ui', rows=[3, 4, 5])],
    'e05': [T('iev', 'cm-icons')],
    'e06': [R('ctimer', 'cm-ui', (0.02, 0.055, 0.135, 0.215), 1, 1),
            R('cnum', 'cm-icons', (0.705, 0.06, 0.975, 0.225), 5, 2),
            R('cres', 'cm-icons', (0.025, 0.265, 0.40, 0.475), 6, 2),
            R('ctab', 'cm-icons', (0.44, 0.525, 0.745, 0.615), 5, 1),
            R('casp', 'cm-icons', (0.025, 0.71, 0.385, 0.82), 5, 1), R('casp2', 'cm-icons', (0.025, 0.83, 0.385, 0.94), 6, 1),
            R('cprog', 'cm-icons', (0.415, 0.725, 0.735, 0.83), 5, 1)],
    'e08': [T('cplace3', 'cm-cards', count=15), R('iplace2', 'cm-icons', (0.53, 0.645, 0.97, 0.96), 5, 3)],
    'e09': [T('irole', 'cm-icons', rows=[0, 2]), T('rrole', 'cm-icons', rows=[1, 3])],
    'e10': [R('cwax', 'cm-icons', (0.015, 0.12, 0.49, 0.255), 5, 1), R('cwaxn', 'cm-icons', (0.535, 0.12, 0.975, 0.255), 5, 1),
            R('cstamp', 'cm-icons', (0.015, 0.29, 0.495, 0.465), 6, 1), R('ccstamp', 'cm-icons', (0.52, 0.29, 0.975, 0.465), 6, 1),
            R('crel', 'cm-icons', (0.015, 0.495, 0.43, 0.625), 5, 1), R('cacc', 'cm-icons', (0.44, 0.495, 0.69, 0.625), 3, 1),
            R('csus', 'cm-icons', (0.70, 0.495, 0.975, 0.625), 3, 1), R('cwit', 'cm-icons', (0.015, 0.655, 0.365, 0.78), 4, 1),
            R('clink', 'cm-icons', (0.72, 0.655, 0.975, 0.78), 3, 1),
            R('cmark', 'cm-icons', (0.015, 0.82, 0.485, 0.965), 5, 1), R('ccirc', 'cm-icons', (0.515, 0.82, 0.975, 0.965), 5, 1)],
    'e13': [T('cback', 'cm-cards', rows=[0]), T('cframe', 'cm-cards', rows=[1]), T('cwide', 'cm-cards', rows=[2], width=320)],
    'e14': [R('cbar', 'cm-ui', (0.015, 0.215, 0.985, 0.355), 3, 1, 640), R('clabel', 'cm-ui', (0.015, 0.365, 0.985, 0.525), 3, 2, 640),
            R('cpanel', 'cm-ui', (0.015, 0.535, 0.265, 0.825), 1, 1, 720), R('cpanel2', 'cm-ui', (0.27, 0.535, 0.635, 0.825), 1, 1, 720),
            R('cpanel3', 'cm-ui', (0.64, 0.535, 0.835, 0.825), 1, 1, 720),
            R('cok', 'cm-ui', (0.84, 0.545, 0.985, 0.62), 2, 1), R('carrow', 'cm-ui', (0.84, 0.63, 0.985, 0.71), 2, 1), R('carrow2', 'cm-ui', (0.84, 0.735, 0.985, 0.815), 2, 1),
            R('cpill2', 'cm-ui', (0.015, 0.845, 0.405, 0.95), 3, 2, 320)],
    'e16': [R('cset', 'cm-icons', (0.335, 0.04, 0.745, 0.18), 4, 1), R('cset2', 'cm-icons', (0.335, 0.21, 0.745, 0.345), 4, 1),
            R('caud', 'cm-icons', (0.775, 0.04, 0.975, 0.18), 2, 1), R('caud2', 'cm-icons', (0.775, 0.21, 0.975, 0.345), 2, 1),
            R('ctog', 'cm-ui', (0.715, 0.505, 0.815, 0.555), 1, 1, 160), R('ctog2', 'cm-ui', (0.715, 0.575, 0.815, 0.63), 1, 1, 160),
            R('ccheck', 'cm-ui', (0.84, 0.505, 0.895, 0.57), 1, 1, 96), R('ccheck2', 'cm-ui', (0.84, 0.575, 0.895, 0.64), 1, 1, 96)],
    # the cards
    'e17': [T('crogue', 'cm-cards')], 'e18': [T('csign', 'cm-cards')], 'e19': [T('cherald', 'cm-cards')], 'e20': [T('cnoble', 'cm-cards')],
    'e21': [T('cclerk', 'cm-cards')], 'e22': [T('charb', 'cm-cards')], 'e23': [T('cmyst', 'cm-cards')], 'e24': [T('cfolk', 'cm-cards')],
    'e25': [T('cwatch', 'cm-cards')], 'e26': [T('citem', 'cm-cards')], 'e27': [T('ccourt', 'cm-cards')], 'e28': [T('coutlaw', 'cm-cards')],
    'e29': [T('cnoble2', 'cm-cards')], 'e30': [T('cplace', 'cm-cards')], 'e31': [T('ccrime', 'cm-cards')], 'e32': [T('cwoman', 'cm-cards')],
    'e33': [T('ctrade', 'cm-cards')], 'e34': [T('citem2', 'cm-cards')], 'e35': [T('cplace2', 'cm-cards')],
    'e40': [T('charb2', 'cm-cards')], 'e41': [T('coccult', 'cm-cards')], 'e44': [T('cherald2', 'cm-cards')], 'e45': [T('cink', 'cm-cards')],
    'e48': [T('cverb', 'cm-cards')],
    # the icons
    'e36': [T('iinv', 'cm-icons')], 'e37': [T('imyst', 'cm-icons')], 'e38': [T('imed', 'cm-icons')], 'e39': [T('icrime', 'cm-icons')],
    'e42': [T('imark', 'cm-icons')], 'e43': [T('ilaw', 'cm-icons')], 'e46': [T('itrade', 'cm-icons')], 'e47': [T('iplace', 'cm-icons')],
}

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args: sys.exit(__doc__)
    folder, preview = args[0], '--preview' in sys.argv
    pv = os.path.join(ROOT, 'tools', '.preview', 'cm')
    if preview: os.makedirs(pv, exist_ok=True)
    lines = {f: ['/* Generated by tools/build_cm_art.py from the Candlemark sheets. Do not edit. */', ':root {'] for f in FILES}
    fams = {f: {} for f in FILES}
    total = [0]
    def put(file, key, piece, width):
        if piece.mode == 'RGBA' and piece.getextrema()[3][0] == 255: piece = piece.convert('RGB')
        uri, small = encode(piece, width or FILES[file]['width'], FILES[file]['q'])
        lines[file].append('  --art-%s: url("%s");' % (key, uri))
        total[0] += len(uri)
        fams[file].setdefault(key.split('-')[0], []).append((key, small))
    for sname in sorted(S):
        p = os.path.join(folder, sname + '.png')
        if not os.path.exists(p): print('missing', p); continue
        im = Image.open(p).convert('RGBA')
        W, H = im.size
        mask = mask_of(im)
        rows = None
        for spec in S[sname]:
            if spec[0] == 'rows':
                _, prefix, file, want, count, width = spec
                if rows is None: rows = rows_of(mask)
                use = rows if want is None else [rows[i] for i in want]
                boxes = [b for r in use for b in r]
                if count: boxes = boxes[:count]
            else:
                _, prefix, file, frac, cols, nrows, width = spec
                boxes = [trim(mask, b) for b in region(W, H, frac, cols, nrows)]
            for i, box in enumerate(boxes):
                put(file, '%s-%02d' % (prefix, i + 1), im.crop(box), width)
    for file in FILES:
        lines[file].append('}')
        with open(os.path.join(OUT, file + '.css'), 'w') as f: f.write('\n'.join(lines[file]) + '\n')
        n = sum(len(v) for v in fams[file].values())
        print('%s: %d pieces (%s)' % (file, n, ', '.join('%s %d' % (k, len(v)) for k, v in fams[file].items())))
        if preview:
            for fam, ps in fams[file].items(): montage(ps, os.path.join(pv, fam + '.png'))
    print('total %.1f MB of data URIs' % (total[0] / 1e6))

if __name__ == '__main__':
    main()
