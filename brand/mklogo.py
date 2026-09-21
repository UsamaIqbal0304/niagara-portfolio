#!/usr/bin/env python3
"""Plantroom Labs brand mark and lockups.

Type is converted to outlines, so a logo file renders identically on a machine
that has never heard of Inter. Everything is generated rather than drawn by
hand, so a colour or spacing decision is changed in one place.
"""
import os
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform

# Inter Display SemiBold — the site's display face. Only needed to *re*build
# the lockups: the SVGs it writes carry outlined paths, so nothing downstream
# needs the font installed. Download: github.com/rsms/inter/releases
FONT = os.environ.get("INTER_DISPLAY_SEMIBOLD",
                      "/tmp/inter/extras/otf/InterDisplay-SemiBold.otf")
OUT  = os.path.dirname(os.path.abspath(__file__))

# ------------------------------------------------------------------ palette
INK      = "#0e1116"   # --gx-n-99, the dark canvas
PAPER    = "#ffffff"
ACCENT_L = "#7b61ff"   # --gx-run,  the light-theme accent
ACCENT_D = "#9b85ff"   # dark-theme accent: lifts off ink without glowing
MUTED_L  = "#5f6b7c"   # --gx-n-70
MUTED_D  = "#97a2b3"

# ------------------------------------------------------------------ the mark
# A heat-exchanger coil, plumbed: an inlet stub enters low-left, the flow
# takes two 180-degree bends through the bank, an outlet stub leaves high-
# right. A literal plantroom object that also reads as a bound signal path,
# which is the business in one glyph. Drawn on a 32 grid.
#
# The stubs are load-bearing. Earlier passes drew the bends alone and the
# figure collapsed into a letter — a "2", an "N", an "M" depending on the
# turn count. Breaking the silhouette open at both ends is what stops a
# reader resolving it as type.
COIL   = "M5 22H11V10a3 3 0 0 1 6 0v12a3 3 0 0 0 6 0V10h5"
NODE_A = (5, 22)
NODE_B = (27, 10)
SW     = 3.4           # stroke width at 32 units
NODE_R = 2.2

# Below ~20px the terminal nodes thicken the stub ends into blobs and the
# coil loses a turn. The favicon-sized exports drop them and thicken the
# stroke instead; same silhouette, one fewer thing to render.
SW_SMALL     = 3.8
NODE_R_SMALL = 0.0


def mark(fg, sw=SW, node_r=NODE_R):
    nodes = ""
    if node_r:
        nodes = (f'<circle cx="{NODE_A[0]}" cy="{NODE_A[1]}" r="{node_r}" fill="{fg}"/>'
                 f'<circle cx="{NODE_B[0]}" cy="{NODE_B[1]}" r="{node_r}" fill="{fg}"/>')
    return (f'<path d="{COIL}" fill="none" stroke="{fg}" stroke-width="{sw}" '
            f'stroke-linecap="round" stroke-linejoin="round"/>' + nodes)


def badge(fg, bg, radius=8):
    """The mark in a rounded container — avatars, app icons, favicons."""
    return (f'<rect width="32" height="32" rx="{radius}" fill="{bg}"/>' + mark(fg))


# ------------------------------------------------------------------ the type
_font = TTFont(FONT)
_upem = _font["head"].unitsPerEm
_glyphs = _font.getGlyphSet()
with open(FONT, "rb") as fh:
    _hbface = hb.Face(fh.read())


def outline(text, size, tracking=0.0):
    """Shape `text` with real kerning and return (svg_path_d, advance_width).

    Coordinates come back in the same units as `size`, with the baseline at
    y=0 and y increasing downwards, which is what SVG wants.
    """
    font = hb.Font(_hbface)
    font.scale = (_upem, _upem)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, {"kern": True, "liga": True})

    order = _font.getGlyphOrder()
    scale = size / _upem
    track = tracking * size / scale          # tracking in font units
    pen_x, parts = 0.0, []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        pen = SVGPathPen(_glyphs)
        # Flip Y: font space is y-up, SVG is y-down.
        tp = TransformPen(pen, Transform(scale, 0, 0, -scale,
                                         (pen_x + pos.x_offset) * scale,
                                         -pos.y_offset * scale))
        _glyphs[name].draw(tp)
        d = pen.getCommands()
        if d:
            parts.append(d)
        pen_x += pos.x_advance + track
    return " ".join(parts), (pen_x - track if text else 0.0) * scale


def cap_height(size):
    return _font["OS/2"].sCapHeight * size / _upem


# ------------------------------------------------------------------ lockups
WORD    = "Plantroom Labs"
TAG     = "NIAGARA FRAMEWORK ENGINEERING"
TRACK_W = -0.015        # --gx-track-title
TRACK_T = 0.14          # micro caps need air or they read as one word


def horizontal(fg_mark, fg_word, fg_tag, bg=None, tagline=True, pad=0):
    """Mark left, wordmark right, optional tagline beneath the wordmark."""
    ms    = 44.0                       # mark box
    wsize = 30.0
    tsize = 9.2
    gap   = 15.0                       # mark to type
    cap   = cap_height(wsize)

    wd, ww = outline(WORD, wsize, TRACK_W)
    td, tw = outline(TAG,  tsize, TRACK_T)

    if tagline:
        # Optically centre the two-line type block against the mark.
        lead   = 9.0
        blockh = cap + lead + tsize
        top    = (ms - blockh) / 2
        wbase  = top + cap
        tbase  = wbase + lead + tsize
    else:
        wbase = (ms + cap) / 2
        tbase = None

    x = pad + ms + gap
    w = x + max(ww, tw if tagline else 0) + pad
    h = ms + pad * 2

    body = [f'<g transform="translate({pad},{pad}) scale({ms/32})">{mark(fg_mark)}</g>',
            f'<path transform="translate({x},{pad + wbase})" d="{wd}" fill="{fg_word}"/>']
    if tagline:
        body.append(f'<path transform="translate({x},{pad + tbase})" d="{td}" fill="{fg_tag}"/>')
    return svg(w, h, "".join(body), bg)


def stacked(fg_mark, fg_word, fg_tag, bg=None):
    ms, wsize, tsize = 64.0, 27.0, 8.6
    cap = cap_height(wsize)
    wd, ww = outline(WORD, wsize, TRACK_W)
    td, tw = outline(TAG,  tsize, TRACK_T)
    w = max(ms, ww, tw)
    gap_mark, lead = 20.0, 9.0
    h = ms + gap_mark + cap + lead + tsize
    cx = w / 2
    return svg(w, h, "".join([
        f'<g transform="translate({cx - ms/2},0) scale({ms/32})">{mark(fg_mark)}</g>',
        f'<path transform="translate({cx - ww/2},{ms + gap_mark + cap})" d="{wd}" fill="{fg_word}"/>',
        f'<path transform="translate({cx - tw/2},{ms + gap_mark + cap + lead + tsize})" '
        f'd="{td}" fill="{fg_tag}"/>',
    ]), bg)


def svg(w, h, body, bg=None, title="Plantroom Labs"):
    r = (f'<rect width="{w:.2f}" height="{h:.2f}" fill="{bg}"/>' if bg else "")
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:.2f}" height="{h:.2f}" '
            f'viewBox="0 0 {w:.2f} {h:.2f}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{r}{body}</svg>\n')


def square(w, h, body, bg=None, title="Plantroom Labs"):
    return svg(w, h, body, bg, title)


def write(name, content):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content)
    return name


# ------------------------------------------------------------------- output
os.makedirs(OUT, exist_ok=True)
files = []

# The mark on its own. currentColor so it can be dropped into any UI.
files.append(write("mark.svg", svg(32, 32, mark("currentColor"), None, "Plantroom Labs mark")))
files.append(write("mark-accent.svg",   svg(32, 32, mark(ACCENT_L))))
files.append(write("mark-on-dark.svg",  svg(32, 32, mark(ACCENT_D), INK)))

# Small-size mark: no nodes, heavier stroke. Used by the favicon exports.
files.append(write("mark-small.svg",
                   svg(32, 32, mark("currentColor", SW_SMALL, NODE_R_SMALL),
                       None, "Plantroom Labs mark")))

# Badge forms — anything that wants a filled square: avatars, app icons.
files.append(write("badge-dark.svg",  svg(32, 32, badge(ACCENT_D, INK))))
files.append(write("badge-light.svg", svg(32, 32, badge(ACCENT_L, PAPER))))
files.append(write("badge-mono.svg",  svg(32, 32, badge(PAPER, INK))))
files.append(write("badge-dark-small.svg",
                   svg(32, 32, f'<rect width="32" height="32" rx="8" fill="{INK}"/>'
                       + mark(ACCENT_D, SW_SMALL, NODE_R_SMALL))))

# Horizontal lockup — the default. Email signatures, letterheads, the nav bar.
files.append(write("logo-horizontal-light.svg",
                   horizontal(ACCENT_L, INK, MUTED_L)))
files.append(write("logo-horizontal-dark.svg",
                   horizontal(ACCENT_D, PAPER, MUTED_D, INK, pad=18)))
files.append(write("logo-horizontal-notag-light.svg",
                   horizontal(ACCENT_L, INK, MUTED_L, tagline=False)))
files.append(write("logo-horizontal-notag-dark.svg",
                   horizontal(ACCENT_D, PAPER, MUTED_D, INK, tagline=False, pad=18)))

# One-colour forms. Invoices, faxes from 1998, laser etching, embroidery.
files.append(write("logo-horizontal-black.svg", horizontal("#000", "#000", "#000")))
files.append(write("logo-horizontal-white.svg", horizontal("#fff", "#fff", "#fff")))

# Stacked — square-ish spaces: business cards, stickers, exhibition panels.
files.append(write("logo-stacked-light.svg", stacked(ACCENT_L, INK, MUTED_L)))
files.append(write("logo-stacked-dark.svg",  stacked(ACCENT_D, PAPER, MUTED_D, INK)))

print("\n".join(sorted(files)))
print(f"\n{len(files)} svg files -> {OUT}")
