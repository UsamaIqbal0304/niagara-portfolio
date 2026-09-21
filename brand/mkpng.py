#!/usr/bin/env python3
"""Raster exports of the brand SVGs.

cairosvg rather than ImageMagick: there is no librsvg delegate on this
machine, so `convert` would re-parse the file with its own SVG reader and
lose the rounded joins and the stroke geometry.
"""
import os, struct, cairosvg
from PIL import Image

B = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(B, "png")
os.makedirs(P, exist_ok=True)

def png(svg, width, out, bg=None):
    cairosvg.svg2png(url=os.path.join(B, svg), write_to=os.path.join(P, out),
                     output_width=width, background_color=bg)
    w, h = Image.open(os.path.join(P, out)).size
    print(f"  {out:<34} {w}x{h}")

# App icons and favicons. Below 32px the mark drops its nodes (see mklogo.py).
png("badge-dark.svg",        512, "icon-512.png")
png("badge-dark.svg",        192, "icon-192.png")
png("badge-dark.svg",        180, "apple-touch-icon.png")
png("badge-dark.svg",         48, "favicon-48.png")
png("badge-dark-small.svg",   32, "favicon-32.png")
png("badge-dark-small.svg",   16, "favicon-16.png")

# Lockups on transparent — email signature, slide masters, letterhead.
for name, w in (("logo-horizontal-light",       1200),
                ("logo-horizontal-dark",        1200),
                ("logo-horizontal-notag-light",  900),
                ("logo-horizontal-notag-dark",   900),
                ("logo-stacked-light",           800),
                ("logo-stacked-dark",            800),
                ("logo-horizontal-black",       1200),
                ("logo-horizontal-white",       1200)):
    png(f"{name}.svg", w, f"{name}@2x.png")
    png(f"{name}.svg", w // 2, f"{name}.png")

# Square avatar — GitHub org, LinkedIn, Google Workspace profile all want one.
png("badge-dark.svg", 1000, "avatar-1000.png")

# Multi-resolution .ico. PIL's own multi-size save downscales one bitmap,
# which would throw away the small-size drawing; an .ico is just a header
# plus one PNG payload per entry, so write it directly and keep all three.
entries = [(16, "favicon-16.png"), (32, "favicon-32.png"), (48, "favicon-48.png")]
blobs = [open(os.path.join(P, f), "rb").read() for _, f in entries]
head = struct.pack("<HHH", 0, 1, len(entries))
offset = 6 + 16 * len(entries)
dirs = b""
for (size, _), blob in zip(entries, blobs):
    dirs += struct.pack("<BBBBHHII", size, size, 0, 0, 1, 32, len(blob), offset)
    offset += len(blob)
with open(os.path.join(P, "favicon.ico"), "wb") as fh:
    fh.write(head + dirs + b"".join(blobs))
print(f"  {'favicon.ico':<34} 16+32+48, three drawings")
