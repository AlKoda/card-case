#!/usr/bin/env python3
"""Rasterise icons/icon.svg into the PNG sizes a home-screen install wants
(192 and 512). Run by the deploy workflow into the site folder; the PNGs
are never committed (the repository holds no binary files).

    python3 tools/build_icons.py _site/icons
"""
import sys, os
SIZES = (192, 512)
out = sys.argv[1] if len(sys.argv) > 1 else 'icons'
os.makedirs(out, exist_ok=True)
svg = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons', 'icon.svg')
try:
    import cairosvg
    for size in SIZES:
        cairosvg.svg2png(url=svg, write_to=os.path.join(out, 'icon-%d.png' % size), output_width=size, output_height=size)
    print('icons rasterised with cairosvg')
except Exception as err:  # no cairo: draw a plain icon with Pillow instead
    from PIL import Image, ImageDraw
    for size in SIZES:
        im = Image.new('RGBA', (size, size), (11, 21, 22, 255))
        d = ImageDraw.Draw(im)
        m = size * 0.2
        d.rounded_rectangle([m, m * 0.8, size - m, size - m * 0.6], radius=size * 0.04, fill=(239, 230, 207), outline=(201, 162, 76), width=max(2, size // 50))
        d.rounded_rectangle([m * 1.3, m * 1.1, size - m * 1.3, size * 0.5], radius=size * 0.02, fill=(24, 40, 42))
        d.ellipse([size * 0.42, size * 0.3, size * 0.58, size * 0.46], outline=(63, 182, 168), width=max(2, size // 50))
        im.save(os.path.join(out, 'icon-%d.png' % size))
    print('icons drawn with Pillow (%s)' % err)
