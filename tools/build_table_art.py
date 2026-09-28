#!/usr/bin/env python3
"""Lay the six table sheets out as one mat and embed it in css/art/noir-tables.css
as --art-ntable.

Usage:
    python3 tools/build_table_art.py path/to/sheets/ [--preview]

The folder holds the sheets as t01.png ... t06.png in the order they were
supplied: the bottom-right, bottom-left, bottom edge, top-left, top-right and
top edge of a table. They were drawn separately and do not tile pixel for
pixel (their slots differ in size, their lines in weight), so the mat is not
a collage of the six: it is built from parts cut whole from the cleanest of
them (the top-left) and mirrored to the other corners, so every line meets
its neighbour exactly.

  - the felt: a plain patch of the surface, tiled with mirroring;
  - the field: the raised playing area with its double gold line, a rosette
    in each corner and a compass medallion on each side;
  - the slots: tall ones down the sides, small and wide ones along the top
    and the bottom, in the felt's margin;
  - a star pointer in each outer corner.

The mat is drawn at MAT_W x MAT_H, the size in table units of the box
css/style.css paints it in (#board::before), so one pixel is one unit and a
tall slot is a little larger than a card. The field's inner edge is FIELD;
the table's edge (CF.TABLE.BOUNDS in js/engine.js) is the mat inset a little.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_noir_art import encode, ROOT, OUT
from PIL import Image, ImageOps, ImageDraw, ImageFilter

MAT_W, MAT_H = 2960, 1900
S = 0.72                      # sheet pixels -> mat units
FIELD = (400, 170, 2560, 1730)  # the raised playing area (outer edge of its rim)
COLS = 2                      # columns of tall slots down each side

def sc(im, s=S):
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)

def feather(im, left=0, top=0, right=0, bottom=0):
    """Fade the alpha of an RGBA image to nothing over the given edge widths."""
    im = im.copy()
    a = im.getchannel('A')
    m = Image.new('L', im.size, 255)
    d = ImageDraw.Draw(m)
    w, h = im.size
    for i in range(max(left, top, right, bottom)):
        v = 255 * i // max(1, max(left, top, right, bottom))
        if i < left: d.line([(i, 0), (i, h)], fill=min(255, 255 * i // max(1, left)))
        if i < right: d.line([(w - 1 - i, 0), (w - 1 - i, h)], fill=min(255, 255 * i // max(1, right)))
    for i in range(max(top, bottom)):
        if i < top: d.line([(0, i), (w, i)], fill=min(255, 255 * i // max(1, top)))
        if i < bottom: d.line([(0, h - 1 - i), (w, h - 1 - i)], fill=min(255, 255 * i // max(1, bottom)))
    # A corner fades on both axes: the darker of the two.
    m2 = Image.new('L', im.size, 255)
    d2 = ImageDraw.Draw(m2)
    for i in range(max(top, bottom)):
        if i < top: d2.line([(0, i), (w, i)], fill=255 * i // max(1, top))
        if i < bottom: d2.line([(0, h - 1 - i), (w, h - 1 - i)], fill=255 * i // max(1, bottom))
    m = Image.eval(Image.composite(m, m2, Image.eval(m, lambda p: 255 if p else 0)), lambda p: p)
    from PIL import ImageChops
    m = ImageChops.darker(m, m2)
    im.putalpha(ImageChops.multiply(a, m))
    return im

def stretch_x(tile, width, band=(0.42, 0.58)):
    """A tile made wider: its middle band is repeated, mirrored, between its two ends."""
    w, h = tile.size
    x0, x1 = round(w * band[0]), round(w * band[1])
    left, mid, right = tile.crop((0, 0, x0, h)), tile.crop((x0, 0, x1, h)), tile.crop((x1, 0, w, h))
    out = Image.new('RGBA', (width, h), (0, 0, 0, 0))
    out.paste(left, (0, 0))
    out.paste(right, (width - right.width, 0))
    x, flip = x0, False
    while x < width - right.width:
        piece = ImageOps.mirror(mid) if flip else mid
        out.paste(piece, (x, 0))
        x += piece.width; flip = not flip
    out.paste(right, (width - right.width, 0))   # over the last band
    return out

def repeat_x(seg, width):
    out = Image.new('RGBA', (width, seg.height), (0, 0, 0, 0))
    x, flip = 0, False
    while x < width:
        out.paste(ImageOps.mirror(seg) if flip else seg, (x, 0)); x += seg.width; flip = not flip
    return out

def repeat_y(seg, height):
    out = Image.new('RGBA', (seg.width, height), (0, 0, 0, 0))
    y, flip = 0, False
    while y < height:
        out.paste(ImageOps.flip(seg) if flip else seg, (0, y)); y += seg.height; flip = not flip
    return out

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args: sys.exit(__doc__)
    folder, preview = args[0], '--preview' in sys.argv
    sheets = {k: Image.open(os.path.join(folder, 't%02d.png' % n)).convert('RGBA') for k, n in
              dict(br=1, bl=2, bc=3, tl=4, tr=5, tc=6).items()}
    tl = sheets['tl']

    # --- parts, cut whole from the top-left sheet (sheet pixels) ---
    corner = tl.crop((269, 219, 640, 590))          # rim corner, line ends, rosette, arcs
    hline = tl.crop((700, 219, 1000, 268))          # rim edge and the double line
    vline = tl.crop((269, 850, 322, 1100))
    tall = tl.crop((42, 240, 268, 570))             # a tall slot with its dark rim
    small = tl.crop((342, 43, 588, 219))            # a small slot
    star = tl.crop((70, 55, 352, 225))              # the star pointer
    # The compass medallion on the line: a disc about its centre, the right
    # half mirrored to the left so no slot beside it comes along.
    MC, MR = (305, 727), 53
    disc = tl.crop((MC[0] - MR, MC[1] - MR, MC[0] + MR, MC[1] + MR))
    right = disc.crop((MR, 0, 2 * MR, 2 * MR))
    disc.paste(ImageOps.mirror(right), (0, 0))
    mask = Image.new('L', disc.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, 2 * MR - 1, 2 * MR - 1), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(3))
    from PIL import ImageChops
    disc.putalpha(ImageChops.multiply(disc.getchannel('A'), mask))
    medal = disc

    corner, hline, vline, medal, tall, small, star = [sc(i) for i in (corner, hline, vline, medal, tall, small, star)]

    # --- the felt: a quilt of plain patches from every sheet, feathered ---
    patches = [sheets['tl'].crop((620, 330, 1300, 1080)), sheets['tr'].crop((40, 330, 800, 1100)),
               sheets['bl'].crop((680, 40, 1340, 830)), sheets['br'].crop((30, 90, 760, 860)),
               sheets['bc'].crop((330, 300, 1040, 800)), sheets['tc'].crop((330, 720, 1040, 1140))]
    patches = [sc(p.convert('RGB')).convert('RGBA') for p in patches]
    import random
    rnd = random.Random(7)
    mat = Image.new('RGBA', (MAT_W, MAT_H), (4, 40, 44, 255))
    mat.paste(patches[0].resize((MAT_W, MAT_H)), (0, 0))   # a soft base under the quilt
    step = 380
    cells = [(x, y) for y in range(-200, MAT_H, step) for x in range(-200, MAT_W, step)]
    rnd.shuffle(cells)
    for x, y in cells:
        p = rnd.choice(patches)
        if rnd.random() < 0.5: p = ImageOps.mirror(p)
        if rnd.random() < 0.5: p = ImageOps.flip(p)
        p = feather(p, 90, 90, 90, 90)
        mat.alpha_composite(p, (x + rnd.randint(-60, 60) - p.width // 4, y + rnd.randint(-60, 60) - p.height // 4))

    # --- the field: lines first, then the corners over their ends ---
    fx0, fy0, fx1, fy1 = FIELD
    fw_, fh_ = fx1 - fx0, fy1 - fy0
    top = feather(repeat_x(hline, fw_), bottom=6)
    mat.alpha_composite(top, (fx0, fy0))
    mat.alpha_composite(ImageOps.flip(top), (fx0, fy1 - top.height))
    side = feather(repeat_y(vline, fh_), right=6)
    mat.alpha_composite(side, (fx0, fy0))
    mat.alpha_composite(ImageOps.mirror(side), (fx1 - side.width, fy0))
    c = feather(corner, right=60, bottom=60)
    mat.alpha_composite(c, (fx0, fy0))
    mat.alpha_composite(ImageOps.mirror(c), (fx1 - c.width, fy0))
    mat.alpha_composite(ImageOps.flip(c), (fx0, fy1 - c.height))
    mat.alpha_composite(ImageOps.mirror(ImageOps.flip(c)), (fx1 - c.width, fy1 - c.height))
    # Medallions: one on each side, centred on the double line.
    off = round((MC[0] - 269) * S)                  # the line's centre from the rim edge
    mw = medal.width
    my = (fy0 + fy1) // 2 - mw // 2
    mat.alpha_composite(medal, (fx0 + off - mw // 2, my))
    mat.alpha_composite(medal, (fx1 - off - mw // 2, my))
    mx = (fx0 + fx1) // 2 - mw // 2
    mat.alpha_composite(medal.rotate(90), (mx, fy0 + off - mw // 2))
    mat.alpha_composite(medal.rotate(90), (mx, fy1 - off - mw // 2))

    # --- the slots, in the margin ---
    gap = round(24 * S)
    tw, th = tall.size
    n = (fh_ + gap) // (th + gap)
    y = fy0 + (fh_ - (n * (th + gap) - gap)) // 2
    for i in range(n):
        for j in range(COLS):
            mat.alpha_composite(tall, (fx0 - (gap + tw) * (j + 1), y + i * (th + gap)))
            mat.alpha_composite(ImageOps.mirror(tall), (fx1 + gap + (gap + tw) * j, y + i * (th + gap)))
    sw, sh = small.size
    # Along the top and the bottom, from edge to edge: two smalls, a wide, two smalls, a wide, two smalls.
    wide_w = (fw_ - 6 * sw - 7 * gap) // 2
    wide = stretch_x(small, wide_w)
    row = [small, small, wide, small, small, wide, small, small]
    x = fx0
    for t in row:
        mat.alpha_composite(t, (x, fy0 - gap - sh))
        mat.alpha_composite(ImageOps.flip(t), (x, fy1 + gap))
        x += t.width + gap
    # --- the star pointers in the outer corners, pointing at the rows ---
    st = star
    sx0, sx1 = fx0 - gap - st.width, fx1 + gap
    sy0, sy1 = fy0 - gap - sh + (sh - st.height) // 2, fy1 + gap + (sh - st.height) // 2
    mat.alpha_composite(st, (sx0, sy0))
    mat.alpha_composite(ImageOps.mirror(st), (sx1, sy0))
    mat.alpha_composite(ImageOps.flip(st), (sx0, sy1))
    mat.alpha_composite(ImageOps.mirror(ImageOps.flip(st)), (sx1, sy1))

    # --- a little shade towards the edges, and a dark rim ---
    out = mat.convert('RGB')
    vig = Image.new('L', (MAT_W, MAT_H), 0)
    ImageDraw.Draw(vig).rectangle((60, 60, MAT_W - 60, MAT_H - 60), fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(70))
    dark = Image.new('RGB', (MAT_W, MAT_H), (2, 18, 22))
    out = Image.composite(out, Image.blend(out, dark, 0.45), vig)

    if preview:
        os.makedirs(os.path.join(ROOT, 'tools', '.preview'), exist_ok=True)
        out.save(os.path.join(ROOT, 'tools', '.preview', 'table.png'))
    uri, small_ = encode(out, MAT_W, 62)
    with open(os.path.join(OUT, 'noir-tables.css'), 'w') as f:
        f.write('/* Generated by tools/build_table_art.py from the table sheets. Do not edit. */\n:root {\n')
        f.write('  --art-ntable: url("%s");\n}\n' % uri)
    print('noir-tables.css: %d x %d, %.0f KB' % (out.width, out.height, len(uri) / 1024))

if __name__ == '__main__':
    main()
