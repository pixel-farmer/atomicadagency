"""
Back-wall sign for The Mainframe: a backlit enamel panel honouring the Internet Gopher protocol
(University of Minnesota, 1991), in the room's charcoal and amber.

    python scripts/models/gopher_sign.py

Writes scripts/models/gopher-sign.face.png (the artwork). The details are real: Gopher served
menus on port 70, was specified in RFC 1436 (1993), and every menu line starts with an item type,
such as 1 for a menu, 0 for a text file, 7 for a search and 9 for a binary file.
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "gopher-sign.face.png")

W, H = 1600, 2000          # final pixels; the panel is 3.4 m × 4.25 m
SS = 2                     # paint at 2× and scale down for clean edges
FONTS = "/usr/share/fonts/opentype/inter"

ENAMEL = (27, 28, 30)
AMBER = (242, 168, 72)
HOT = (255, 214, 150)
DIM = (150, 106, 52)
FAINT = (70, 54, 34)


def F(name, px):
    return ImageFont.truetype(os.path.join(FONTS, name), int(px * SS))


def tracked(d, xy, text, font, fill, tracking, anchor="l"):
    """Letter-spaced text; anchor l, m or r on the baseline."""
    widths = [d.textlength(c, font=font) for c in text]
    total = sum(widths) + tracking * SS * (len(text) - 1)
    x, y = xy[0] * SS, xy[1] * SS
    if anchor == "m":
        x -= total / 2
    elif anchor == "r":
        x -= total
    for c, w in zip(text, widths):
        d.text((x, y), c, font=font, fill=fill, anchor="ls")
        x += w + tracking * SS
    return total / SS


def paint():
    img = Image.new("RGB", (W * SS, H * SS), ENAMEL)
    light = Image.new("L", (W * SS, H * SS), 0)   # what glows: drives the emissive map and halo
    d = ImageDraw.Draw(img)
    dl = ImageDraw.Draw(light)

    def both(fn, *args, fill, glow=255, **kw):
        """Draw on the artwork and, in `glow` brightness, on the light mask."""
        fn(d, *args, fill=fill, **kw)
        fn(dl, *args, fill=glow, **kw)

    def rect(dd, box, fill, width=0):
        b = [v * SS for v in box]
        if width:
            dd.rectangle(b, outline=fill, width=int(width * SS))
        else:
            dd.rectangle(b, fill=fill)

    def line(dd, pts, fill, width):
        dd.line([(x * SS, y * SS) for x, y in pts], fill=fill, width=int(width * SS), joint="curve")

    def dot(dd, cx, cy, r, fill, outline=None, width=0):
        dd.ellipse([(cx - r) * SS, (cy - r) * SS, (cx + r) * SS, (cy + r) * SS], fill=fill, outline=outline, width=int(width * SS))

    # Frame: double hairline with small square corner blocks.
    M = 70
    both(rect, (M, M, W - M, H - M), fill=AMBER, width=3, glow=200)
    both(rect, (M + 14, M + 14, W - M - 14, H - M - 14), fill=DIM, width=1.5, glow=90)
    for cx, cy in ((M, M), (W - M, M), (M, H - M), (W - M, H - M)):
        both(rect, (cx - 13, cy - 13, cx + 13, cy + 13), fill=AMBER, glow=230)
        rect(d, (cx - 6, cy - 6, cx + 6, cy + 6), ENAMEL)

    # Eyebrow.
    eyebrow = F("Inter-SemiBold.otf", 30)
    tracked(d, (W / 2, 220), "THE INTERNET GOPHER PROTOCOL", eyebrow, DIM, 9, "m")
    tracked(dl, (W / 2, 220), "THE INTERNET GOPHER PROTOCOL", eyebrow, 110, 9, "m")

    # Striped wordmark: heavy wide letters cut by horizontal bands, the 80s corporate-tech way.
    word = Image.new("L", (W * SS, 360 * SS), 0)
    dw = ImageDraw.Draw(word)
    big = F("InterDisplay-Black.otf", 300)
    tracked(dw, (W / 2, 300), "GOPHER", big, 255, 18, "m")
    stripes = Image.new("L", word.size, 0)
    ds = ImageDraw.Draw(stripes)
    top, bottom, n = 82, 304, 9
    pitch = (bottom - top) / n
    for i in range(n):
        y0 = top + i * pitch
        ds.rectangle([0, y0 * SS, W * SS, (y0 + pitch * 0.62) * SS], fill=255)
    mask = Image.fromarray(np.minimum(np.asarray(word), np.asarray(stripes)))
    y_word = 250
    img.paste(Image.new("RGB", word.size, AMBER), (0, y_word * SS), mask)
    light.paste(Image.new("L", word.size, 255), (0, y_word * SS), mask)

    # Tagline.
    tag = F("InterDisplay-Light.otf", 50)
    tracked(d, (W / 2, 690), "Information, one menu at a time.", tag, HOT, 1, "m")
    tracked(dl, (W / 2, 690), "Information, one menu at a time.", tag, 200, 1, "m")
    both(rect, (W / 2 - 60, 735, W / 2 + 60, 739), fill=AMBER, glow=200)

    # Menu tree: one root menu branching to the four classic item types.
    root = (W / 2, 860)
    label = F("Inter-SemiBold.otf", 26)
    numf = F("InterDisplay-Black.otf", 44)
    small = F("Inter-Medium.otf", 22)
    branches = [
        (300, "0", "TEXT"),
        (633, "1", "MENU"),
        (967, "7", "SEARCH"),
        (1300, "9", "BINARY"),
    ]
    rail_y, node_y = 1000, 1120
    both(line, [root, (root[0], rail_y)], fill=AMBER, width=4, glow=230)
    both(line, [(branches[0][0], rail_y), (branches[-1][0], rail_y)], fill=AMBER, width=4, glow=230)
    dot(d, root[0], root[1], 46, ENAMEL, outline=AMBER, width=4)
    dot(dl, root[0], root[1], 46, None, outline=230, width=4)
    d.text((root[0] * SS, (root[1] + 2) * SS), "1", font=numf, fill=HOT, anchor="mm")
    dl.text((root[0] * SS, (root[1] + 2) * SS), "1", font=numf, fill=255, anchor="mm")
    tracked(d, (root[0] + 78, root[1] + 10), "ROOT MENU", label, AMBER, 5)
    tracked(dl, (root[0] + 78, root[1] + 10), "ROOT MENU", label, 170, 5)
    for x, num, name in branches:
        both(line, [(x, rail_y), (x, node_y - 46)], fill=AMBER, width=4, glow=230)
        dot(d, x, node_y, 46, ENAMEL, outline=AMBER, width=4)
        dot(dl, x, node_y, 46, None, outline=230, width=4)
        d.text((x * SS, (node_y + 2) * SS), num, font=numf, fill=HOT, anchor="mm")
        dl.text((x * SS, (node_y + 2) * SS), num, font=numf, fill=255, anchor="mm")
        tracked(d, (x, node_y + 100), name, label, AMBER, 6, "m")
        tracked(dl, (x, node_y + 100), name, label, 170, 6, "m")
    # The MENU node opens onto another level: menus all the way down.
    sub_y = 1330
    both(line, [(633, node_y + 130), (633, sub_y)], fill=DIM, width=3, glow=110)
    both(line, [(533, sub_y), (733, sub_y)], fill=DIM, width=3, glow=110)
    for x in (533, 633, 733):
        both(line, [(x, sub_y), (x, sub_y + 34)], fill=DIM, width=3, glow=110)
        dot(d, x, sub_y + 50, 14, DIM)
        dot(dl, x, sub_y + 50, 14, 110)
    tracked(d, (W / 2, 1460), "MENU-DRIVEN  ·  PLAIN TEXT  ·  ANY TERMINAL", small, DIM, 6, "m")
    tracked(dl, (W / 2, 1460), "MENU-DRIVEN  ·  PLAIN TEXT  ·  ANY TERMINAL", small, 90, 6, "m")

    # Footer band: the facts, set like a building plaque.
    both(rect, (M + 60, 1560, W - M - 60, 1563), fill=DIM, glow=110)
    figf = F("InterDisplay-Black.otf", 120)
    capf = F("Inter-SemiBold.otf", 24)
    facts = [(330, "1991", "FIRST RELEASED"), (W / 2, "70", "DEFAULT PORT"), (W - 330, "1436", "RFC")]
    for x, fig, cap in facts:
        d.text((x * SS, 1730 * SS), fig, font=figf, fill=AMBER, anchor="ms")
        dl.text((x * SS, 1730 * SS), fig, font=figf, fill=235, anchor="ms")
        tracked(d, (x, 1790), cap, capf, DIM, 6, "m")
        tracked(dl, (x, 1790), cap, capf, 100, 6, "m")
    for x in ((330 + W / 2) / 2, (W / 2 + W - 330) / 2):
        both(rect, (x - 1.5, 1625, x + 1.5, 1800), fill=FAINT, glow=40)

    # Lightbox: a little bloom around the lit parts, and enamel slightly brighter toward the middle.
    halo = light.filter(ImageFilter.GaussianBlur(14 * SS))
    arr = np.asarray(img, dtype="float32")
    h = np.asarray(halo, dtype="float32")[..., None] / 255
    arr += h * np.array([70, 44, 14]) * 0.55
    yy, xx = np.mgrid[0:H * SS, 0:W * SS]
    falloff = 1 - 0.18 * (((xx / (W * SS) - 0.5) * 2) ** 2 + ((yy / (H * SS) - 0.45) * 2) ** 2)
    arr *= falloff[..., None]
    face = Image.fromarray(np.clip(arr, 0, 255).astype("uint8")).resize((W, H), Image.LANCZOS)
    glow = light.resize((W, H), Image.LANCZOS)
    return face, glow


if __name__ == "__main__":
    face, glow = paint()
    face.save(OUT)
    glow.save(OUT.replace(".face.png", ".glow.png"))
    print("wrote", os.path.relpath(OUT))
