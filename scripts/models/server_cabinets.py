"""
Server cabinets for The Mainframe: a terminal cabinet (recessed anti-glare CRT) and a rack cabinet
(smoked glass door over a few rack units).

    python scripts/models/server_cabinets.py

Writes public/models/mainframe/cabinet-terminal.glb and cabinet-rack.glb.
Metres, Y up, front +Z, origin at floor centre. Same size as the room's stand-in cabinets.

Named nodes the room drives live:
    Screen     terminal only; the CRT face. The room replaces its texture with the live screen.
    LedPanel   the strip of status lights. The room replaces its texture with the live LEDs.
The textures painted here for those two are stand-ins, so the model looks right on its own.
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lowpoly_kit import (  # noqa: E402
    DENSITY,
    FONT_BOLD,
    FONT_MONO,
    PALETTE,
    SUPERSAMPLE,
    Atlas,
    Material,
    Mesh,
    Node,
    font,
    shade,
    write_glb,
)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "..", "..", "public", "models", "mainframe")

# ---- Shared dimensions (metres) --------------------------------------------------------------
W, H, D = 1.1, 2.0, 1.2
PLINTH = 0.08
CAP = 0.03
FRONT = D / 2
BODY_TOP = H - CAP

SCREEN_CY = 1.0
BEZEL_OUT = (1.0, 0.9)        # outer size of the light CRT surround
BEZEL_OPEN = (0.9, 0.74)      # opening at the front of the surround
SCREEN = (0.86, 0.70)         # the glass, recessed inside the opening
BEZEL_DEPTH = 0.065           # how far the surround stands off the door
SCREEN_RECESS = 0.04          # how far the glass sits behind the surround's face
LED_Y, LED_SIZE = 1.72, (0.92, 0.23)

CHARCOAL = PALETTE["cabinet"]
SEAM_DARK = shade(CHARCOAL, 0.55)
SEAM_LIGHT = shade(CHARCOAL, 1.55)
FRAME_LIGHT = (232, 232, 229)  # the room's light screen frames
AMBER = PALETTE["amber"]
INK = PALETTE["ink"]


def door_px(y):
    """Door texture row for a world height (the door region starts at BODY_TOP)."""
    return (BODY_TOP - y) * DENSITY


def paste_image(atlas: Atlas, region, img: Image.Image, emissive_k: float = 0.0):
    """Paste a separately painted image into a region; optionally also into the emissive map."""
    s = SUPERSAMPLE
    big = img.resize((region.w * s, region.h * s), Image.LANCZOS)
    atlas.image.paste(big, (region.x * s, region.y * s))
    if emissive_k:
        glow = big.point(lambda v: int(v * emissive_k))
        atlas.emissive.paste(glow, (region.x * s, region.y * s))


def paint_body_common(atlas: Atlas):
    r_side = atlas.region("side", D, BODY_TOP - PLINTH, CHARCOAL, scale=0.35)  # plain, so stored small
    r_side.gradient(1.12, 0.85, base=CHARCOAL)
    r_side.grime(0.08, seed=21)
    for y in (120, 940, 1760):
        r_side.rect(0, y, r_side.w, y + 6, SEAM_DARK)
        r_side.rect(0, y + 6, r_side.w, y + 10, SEAM_LIGHT)
    for i in range(12):  # vent slots near the top
        x = r_side.w / 2 - 330 + i * 60
        r_side.rect(x, 220, x + 28, 420, shade(CHARCOAL, 0.45), radius=10)
    r_trim = atlas.region("trim", 0.4, 0.04, shade(CHARCOAL, 1.25))
    r_trim.bevel(1.5, 0.6, 3, base=shade(CHARCOAL, 1.25))
    r_plinth = atlas.region("plinth", 1.06, PLINTH, shade(CHARCOAL, 0.7), scale=0.5)
    for i in range(24):
        x = 40 + i * 41
        r_plinth.rect(x, 18, x + 26, 62, shade(CHARCOAL, 0.35), radius=4)
    r_plinth.rect(0, 0, r_plinth.w, 3, shade(CHARCOAL, 1.2))
    r_tag = atlas.region("tag", 0.38, 0.13, AMBER)
    r_tag.text(r_tag.w / 2, r_tag.h / 2, "ACTIVE", (26, 18, 8), 62, FONT_BOLD, anchor="mm")
    r_dark = atlas.region("speaker", 0.2, 0.1, PALETTE["rubber"])
    for i in range(8):
        r_dark.rect(10 + i * 23, 20, 22 + i * 23, 80, shade(PALETTE["rubber"], 1.8), radius=5)
    r_metal = atlas.region("handle", 0.1, 0.1, PALETTE["metal"])
    r_metal.gradient(1.3, 0.7, base=PALETTE["metal"])


def paint_leds(atlas: Atlas, seed=0):
    """Stand-in LED strip: a few lit, most dark. The room animates the real one."""
    import random

    rng = random.Random(seed)
    r = atlas.region("led", *LED_SIZE, (10, 10, 11))
    cols, rows = 24, 5
    for row in range(rows):
        for col in range(cols):
            x = 22 + col * (r.w - 44) / (cols - 1)
            y = 30 + row * (r.h - 60) / (rows - 1)
            lit = rng.random() < 0.3
            color = (AMBER if rng.random() < 0.35 else (240, 240, 232)) if lit else (36, 37, 39)
            r.ellipse(x, y, 10, 10, color)
            if lit:
                atlas.glow(r, x, y, 10, 10, color)
    return r


def paint_door_base(r, with_vent=True):
    r.gradient(1.1, 0.9, base=CHARCOAL)
    r.grime(0.08, seed=31)
    # Door gap: dark line with a lit edge, 25 px in from the cabinet edge.
    g = 25
    r.rect(g, g, r.w - g, g + 3, SEAM_DARK)
    r.rect(g, r.h - g - 3, r.w - g, r.h - g, SEAM_DARK)
    r.rect(g, g, g + 3, r.h - g, SEAM_DARK)
    r.rect(r.w - g - 3, g, r.w - g, r.h - g, SEAM_DARK)
    r.rect(g + 3, g + 3, r.w - g - 3, g + 5, SEAM_LIGHT)
    # Hinges on the left.
    for y in (200, r.h - 260):
        r.rect(g - 6, y, g + 8, y + 90, shade(CHARCOAL, 1.8), radius=3)
    # Asset plate.
    r.rect(70, 70, 250, 120, (200, 200, 196), radius=4)
    r.text(84, 100, "MF-04", (30, 30, 30), 30, FONT_BOLD, anchor="ls")
    r.text(236, 100, "RACK", (90, 90, 90), 16, FONT_BOLD, anchor="rs")
    if with_vent:
        top = door_px(1.575)
        for i in range(30):
            x = 80 + i * 32
            r.rect(x, top, x + 18, top + 90, shade(CHARCOAL, 0.42), radius=6)
            r.rect(x, top, x + 18, top + 4, shade(CHARCOAL, 0.25))


def build_body(m: Mesh, front_region: str):
    hw, hd = W / 2, D / 2
    m.box("paint", (-hw, PLINTH, -hd), (hw, BODY_TOP, hd), {"front": front_region, "*": "side"}, skip=("top", "bottom"))
    m.box("paint", (-hw - 0.015, BODY_TOP, -hd - 0.015), (hw + 0.015, H, hd + 0.015), {"*": "trim"})
    m.box("paint", (-hw + 0.02, 0, -hd + 0.03), (hw - 0.02, PLINTH, hd - 0.03), {"*": "plinth"}, skip=("top", "bottom"))
    # The room's stand-ins have an ACTIVE tag and a speaker box on top; keep them.
    m.box("paint", (0.09, H, 0.38), (0.47, H + 0.11, 0.43), {"front": "tag", "*": "trim"})
    m.box("paint", (-0.45, H, -0.35), (0.05, H + 0.18, 0.05), {"*": "speaker"})


def led_node(atlas):
    led = Mesh("LedPanel", atlas)
    w, h = LED_SIZE
    z = FRONT + 0.002
    led.quad("led", "led", (-w / 2, LED_Y - h / 2, z), (w / 2, LED_Y - h / 2, z), (w / 2, LED_Y + h / 2, z), (-w / 2, LED_Y + h / 2, z))
    return Node("LedPanel", mesh=led)


# ---------------------------------------------------------------------------------------------
# Anti-glare CRT stand-in: matte, warm dark glass with amber phosphor text, a soft haze where the
# room's light falls on it, and a shadow under the top of the surround.
# ---------------------------------------------------------------------------------------------


def paint_crt(w_px, h_px) -> Image.Image:
    s = 2
    W2, H2 = w_px * s, h_px * s
    img = Image.new("RGB", (W2, H2), (40, 38, 35))
    g = ImageDraw.Draw(img)
    # Phosphor text, drawn on its own layer so it can glow.
    text = Image.new("RGB", (W2, H2), (0, 0, 0))
    t = ImageDraw.Draw(text)
    amber = (242, 168, 72)
    mono = font(FONT_MONO, 26 * s)
    mono_b = font(FONT_BOLD, 26 * s)
    t.text((60 * s, 62 * s), "TTY0 · RECENT CHANGES", fill=amber, font=mono_b)
    rows = [
        ("EN       EDIT    +142", 1), ("WIKIDATA EDIT     +88", 0), ("DE       EDIT    −310", 1),
        ("EN·DICT  NEW    +2,104", 1), ("COMMONS  EDIT     +17", 0), ("FR       EDIT    +956", 1),
        ("JA       EDIT     −42", 1), ("EN       EDIT  +1,288", 1), ("WIKIDATA EDIT    +203", 0),
        ("ES       NEW    +3,410", 1),
    ]
    for i, (row, human) in enumerate(rows):
        t.text((60 * s, (120 + i * 46) * s), row, fill=amber if human else shade(amber, 0.62), font=mono)
    t.rectangle([60 * s, (120 + 10 * 46) * s, 76 * s, (120 + 10 * 46 + 30) * s], fill=amber)  # cursor
    glow = text.filter(ImageFilter.GaussianBlur(7 * s))
    arr = np.asarray(img, dtype="float32") + np.asarray(text, dtype="float32") * 0.92 + np.asarray(glow, dtype="float32") * 0.55
    img = Image.fromarray(np.clip(arr, 0, 255).astype("uint8"))

    arr = np.asarray(img, dtype="float32")
    yy, xx = np.mgrid[0:H2, 0:W2]
    nx, ny = (xx / W2 - 0.5) * 2, (yy / H2 - 0.5) * 2
    # Curved-glass vignette, darker in the corners.
    vignette = 1 - 0.38 * np.clip(nx ** 2 * 0.8 + ny ** 2, 0, 1.6) ** 1.4
    # Matte anti-glare haze: a broad, soft brightening where room light hits the glass.
    haze = 18 * np.exp(-(((xx / W2 - 0.3) / 0.38) ** 2 + ((yy / H2 - 0.22) / 0.3) ** 2))
    # Shadow cast by the top of the surround into the recess.
    lip = 1 - 0.45 * np.clip(1 - yy / (H2 * 0.09), 0, 1) ** 1.6
    arr = arr * vignette[..., None] * lip[..., None] + haze[..., None] * np.array([1.0, 0.97, 0.92])
    # Faint scanlines.
    arr[::4 * s // 2] *= 0.9
    img = Image.fromarray(np.clip(arr, 0, 255).astype("uint8"))
    return img.resize((w_px, h_px), Image.LANCZOS)


def build_terminal():
    atlas = Atlas(size=2048, pad=8)
    r_door = atlas.region("door", W, BODY_TOP - PLINTH, CHARCOAL, scale=0.75)
    r_screen = atlas.region("screen", *SCREEN, (40, 38, 35))
    r_bezel = atlas.region("bezel_front", *BEZEL_OUT, FRAME_LIGHT, scale=0.7)  # mostly the hole
    paint_body_common(atlas)
    paint_leds(atlas, seed=4)
    r_bezel_side = atlas.region("bezel_side", 1.0, BEZEL_DEPTH, shade(FRAME_LIGHT, 0.86))
    r_tunnel = atlas.region("tunnel", 0.9, SCREEN_RECESS, shade(FRAME_LIGHT, 0.62))

    paint_door_base(r_door)
    # Perforated lower panel: a recessed grille below the screen.
    top, bottom = door_px(0.5), door_px(0.14)
    r_door.rect(110, top, r_door.w - 110, bottom, shade(CHARCOAL, 0.8), radius=6)
    r_door.rect(110, top, r_door.w - 110, top + 4, SEAM_DARK)
    for j in range(int((bottom - top - 40) // 22)):
        for i in range(int((r_door.w - 260) // 22)):
            r_door.ellipse(140 + i * 22 + (11 if j % 2 else 0), top + 30 + j * 22, 5, 5, shade(CHARCOAL, 0.3))

    # Light CRT surround with a soft bevel, a badge and a power light, like a VT-series terminal.
    r_bezel.gradient(1.03, 0.93, base=FRAME_LIGHT)
    k = r_bezel.w / (BEZEL_OUT[0] * DENSITY)  # region pixels per mm
    ox = (BEZEL_OUT[0] - BEZEL_OPEN[0]) / 2 * DENSITY * k
    oy = (BEZEL_OUT[1] - BEZEL_OPEN[1]) / 2 * DENSITY * k
    r_bezel.rect(ox - 4 * k, oy - 4 * k, r_bezel.w - ox + 4 * k, r_bezel.h - oy + 4 * k, shade(FRAME_LIGHT, 0.8), radius=10 * k)
    r_bezel.bevel(1.06, 0.8, 3, base=FRAME_LIGHT)
    r_bezel.rect(ox, r_bezel.h - oy + 20 * k, ox + 120 * k, r_bezel.h - oy + 52 * k, (210, 209, 204), radius=3)
    r_bezel.text(ox + 12 * k, r_bezel.h - oy + 44 * k, "MF-220", shade(AMBER, 0.85), 20 * k, FONT_BOLD, anchor="ls")
    r_bezel.ellipse(r_bezel.w - ox - 10 * k, r_bezel.h - oy + 36 * k, 5 * k, 4 * k, (120, 200, 120))
    atlas.glow(r_bezel, r_bezel.w - ox - 10 * k, r_bezel.h - oy + 36 * k, 5 * k, 4 * k, (90, 200, 90))
    r_bezel_side.gradient(1.0, 0.8, base=shade(FRAME_LIGHT, 0.86))
    r_tunnel.gradient(0.7, 1.0, base=shade(FRAME_LIGHT, 0.62))

    paste_image(atlas, r_screen, paint_crt(r_screen.w, r_screen.h), emissive_k=0.85)
    base, emissive = atlas.finish()

    body = Mesh("CabinetBody", atlas)
    build_body(body, "door")
    # Handle under the screen, on the right.
    body.box("paint", (0.42, 0.24, FRONT), (0.45, 0.46, FRONT + 0.03), {"*": "handle"})

    # CRT surround: outer sides, front ring and the tunnel back to the recessed glass.
    bz = Mesh("Bezel", atlas)
    zf, zb, zs = FRONT + BEZEL_DEPTH, FRONT, FRONT + BEZEL_DEPTH - SCREEN_RECESS
    OW, OH = BEZEL_OUT[0] / 2, BEZEL_OUT[1] / 2
    IW, IH = BEZEL_OPEN[0] / 2, BEZEL_OPEN[1] / 2
    SW, SH = SCREEN[0] / 2, SCREEN[1] / 2
    cy = SCREEN_CY
    bz.box("bezel", (-OW, cy - OH, zb), (OW, cy + OH, zf), {"*": "bezel_side"}, skip=("front", "back"))
    oBL, oBR, oTR, oTL = (-OW, cy - OH, zf), (OW, cy - OH, zf), (OW, cy + OH, zf), (-OW, cy + OH, zf)
    iBL, iBR, iTR, iTL = (-IW, cy - IH, zf), (IW, cy - IH, zf), (IW, cy + IH, zf), (-IW, cy + IH, zf)
    sBL, sBR, sTR, sTL = (-SW, cy - SH, zs), (SW, cy - SH, zs), (SW, cy + SH, zs), (-SW, cy + SH, zs)
    axes = (np.array([1.0, 0, 0]), np.array([0, 1.0, 0]), (-OW, cy - OH, zf), BEZEL_OUT[0], BEZEL_OUT[1])
    for band in ([oBL, oBR, iBR, iBL], [oBR, oTR, iTR, iBR], [oTR, oTL, iTL, iTR], [oTL, oBL, iBL, iTL]):
        bz.planar("bezel", "bezel_front", band, axes)
    bz.quad("bezel", "tunnel", iBL, iBR, sBR, sBL)   # floor of the recess
    bz.quad("bezel", "tunnel", sTL, sTR, iTR, iTL)   # ceiling
    bz.quad("bezel", "tunnel", iBL, sBL, sTL, iTL)   # left wall
    bz.quad("bezel", "tunnel", sBR, iBR, iTR, sTR)   # right wall

    screen = Mesh("Screen", atlas)
    screen.quad("screen", "screen", sBL, sBR, sTR, sTL)

    root = Node("CabinetTerminal", mesh=body, children=[
        Node("Bezel", mesh=bz),
        Node("Screen", mesh=screen),
        led_node(atlas),
    ])
    rename = {"paint": "PaintedMetal", "bezel": "BezelPlastic", "screen": "AntiGlareScreen", "led": "LedPanel"}
    for n in (body, bz, screen, root.children[2].mesh):
        for p in n.prims.values():
            p.material = rename[p.material]
    mats = [
        Material("PaintedMetal", roughness=0.55, metalness=0.1),
        Material("BezelPlastic", roughness=0.6),
        Material("AntiGlareScreen", roughness=0.85, emissive=True),  # matte: anti-glare coating
        Material("LedPanel", roughness=0.4, emissive=True),
    ]
    return root, mats, base, emissive


def build_rack():
    atlas = Atlas(size=2048, pad=8)
    r_door = atlas.region("door", W, BODY_TOP - PLINTH, CHARCOAL, scale=0.75)
    win_w, win_y0, win_y1 = 0.94, 0.2, 1.56
    r_win = atlas.region("window", win_w, win_y1 - win_y0, (20, 21, 23), scale=0.75)
    paint_leds(atlas, seed=9)
    paint_body_common(atlas)

    paint_door_base(r_door, with_vent=False)

    # Smoked glass over a handful of rack units. Kept deliberately sparse.
    w = r_win
    units = [(0.0, 0.11, "drives"), (0.13, 0.20, "blank"), (0.215, 0.29, "switch"), (0.31, 0.47, "server"),
             (0.49, 0.56, "blank"), (0.58, 0.74, "server"), (0.76, 0.83, "switch"), (0.85, 0.97, "drives")]
    import random

    rng = random.Random(3)
    for f0, f1, kind in units:
        y0, y1 = 40 + f0 * (w.h - 80), 40 + f1 * (w.h - 80)
        w.rect(46, y0, w.w - 46, y1, (40, 41, 44), radius=3)
        w.rect(46, y0, w.w - 46, y0 + 3, (66, 67, 71))
        w.rect(34, y0, 46, y1, (28, 28, 30))
        w.rect(w.w - 46, y0, w.w - 34, y1, (28, 28, 30))
        if kind == "drives":
            n = 10
            for i in range(n):
                x = 70 + i * (w.w - 140) / n
                w.rect(x, y0 + 14, x + (w.w - 140) / n - 8, y1 - 14, (30, 31, 33), radius=2)
                c = AMBER if rng.random() < 0.4 else (240, 240, 232)
                w.ellipse(x + 10, y1 - 22, 3.5, 3.5, c)
                atlas.glow(w, x + 10, y1 - 22, 4, 4, c)
        elif kind == "switch":
            for i in range(16):
                x = 220 + i * 30
                w.rect(x, y0 + 26, x + 20, y0 + 46, (14, 14, 15))
                if rng.random() < 0.6:
                    w.ellipse(x + 10, y0 + 18, 3, 3, AMBER)
                    atlas.glow(w, x + 10, y0 + 18, 3.5, 3.5, AMBER)
        elif kind == "server":
            for i in range(14):
                x = 90 + i * 30
                w.rect(x, y0 + 30, x + 16, y1 - 30, (26, 26, 28), radius=4)
            w.ellipse(w.w - 110, y0 + 40, 5, 5, (240, 240, 232))
            atlas.glow(w, w.w - 110, y0 + 40, 6, 6, (240, 240, 232))
            w.rect(w.w - 160, y1 - 50, w.w - 80, y1 - 34, (70, 71, 75), radius=3)
    # Smoke over everything, then two soft reflections on the glass.
    s = SUPERSAMPLE
    wr = w.r  # the stored (scaled) region, for working on its pixels directly
    box = (wr.x * s, wr.y * s, (wr.x + wr.w) * s, (wr.y + wr.h) * s)
    crop = np.asarray(atlas.image.crop(box), dtype="float32") * 0.62 + 6
    yy, xx = np.mgrid[0:crop.shape[0], 0:crop.shape[1]]
    for x0, width, k in ((0.12, 0.09, 26), (0.3, 0.035, 18)):
        band = np.exp(-(((xx / crop.shape[1]) - x0 - (1 - yy / crop.shape[0]) * 0.35) / width) ** 2)
        crop += band[..., None] * k
    atlas.image.paste(Image.fromarray(np.clip(crop, 0, 255).astype("uint8")), box[:2])
    base, emissive = atlas.finish()

    body = Mesh("CabinetBody", atlas)
    build_body(body, "door")
    body.box("paint", (0.485, 0.75, FRONT), (0.515, 1.05, FRONT + 0.03), {"*": "handle"})
    glass = Mesh("Glass", atlas)
    z = FRONT + 0.003
    glass.quad("glass", "window", (-win_w / 2, win_y0, z), (win_w / 2, win_y0, z), (win_w / 2, win_y1, z), (-win_w / 2, win_y1, z))
    # Header above the glass gets the room's LED strip.
    root = Node("CabinetRack", mesh=body, children=[Node("Glass", mesh=glass), led_node(atlas)])
    rename = {"paint": "PaintedMetal", "glass": "SmokedGlass", "led": "LedPanel"}
    for n in (body, glass, root.children[1].mesh):
        for p in n.prims.values():
            p.material = rename[p.material]
    mats = [
        Material("PaintedMetal", roughness=0.55, metalness=0.1),
        Material("SmokedGlass", roughness=0.12, emissive=True),
        Material("LedPanel", roughness=0.4, emissive=True),
    ]
    return root, mats, base, emissive



# ---------------------------------------------------------------------------------------------
# Tape drive: two reels behind glass with the head between them, two vacuum columns where the
# tape loops rise and fall, and a small operator panel. Animated by the room through these nodes:
#     ReelLeft, ReelRight   spin about their local z axis
#     LoopLeft, LoopRight   the dark tape loop in each column; scale.y sets how far it hangs down
# ---------------------------------------------------------------------------------------------

REEL_Y, REEL_X, REEL_R = 1.27, 0.245, 0.24
WIN = dict(x=0.0, y=1.27, w=1.04, h=0.62, band=0.03, depth=0.07)
COL = dict(xs=(-0.27, 0.27), top=0.88, bottom=0.34, w=0.13, band=0.022, depth=0.03)
TAPE_BROWN = (74, 52, 36)


def framed_window(m: Mesh, mat, cx, cy, outer, inner, z_back, z_front, r_front, r_inner, r_side):
    """A rectangular frame standing off the door: outer sides, front band, and the inner reveal."""
    OW, OH = outer[0] / 2, outer[1] / 2
    IW, IH = inner[0] / 2, inner[1] / 2
    m.box(mat, (cx - OW, cy - OH, z_back), (cx + OW, cy + OH, z_front), {"*": r_side}, skip=("front", "back"))
    oBL, oBR, oTR, oTL = (cx - OW, cy - OH, z_front), (cx + OW, cy - OH, z_front), (cx + OW, cy + OH, z_front), (cx - OW, cy + OH, z_front)
    iBL, iBR, iTR, iTL = (cx - IW, cy - IH, z_front), (cx + IW, cy - IH, z_front), (cx + IW, cy + IH, z_front), (cx - IW, cy + IH, z_front)
    bBL, bBR, bTR, bTL = (cx - IW, cy - IH, z_back), (cx + IW, cy - IH, z_back), (cx + IW, cy + IH, z_back), (cx - IW, cy + IH, z_back)
    axes = (np.array([1.0, 0, 0]), np.array([0, 1.0, 0]), (cx - OW, cy - OH, z_front), outer[0], outer[1])
    for band in ([oBL, oBR, iBR, iBL], [oBR, oTR, iTR, iBR], [oTR, oTL, iTL, iTR], [oTL, oBL, iBL, iTL]):
        m.planar(mat, r_front, band, axes)
    m.quad(mat, r_inner, iBL, iBR, bBR, bBL)
    m.quad(mat, r_inner, bTL, bTR, iTR, iTL)
    m.quad(mat, r_inner, iBL, bBL, bTL, iTL)
    m.quad(mat, r_inner, bBR, iBR, iTR, bTR)


def build_tape():
    # Wider padding: the frame reveals are thin strips, and at a distance their mipmaps would
    # otherwise pick up colour from neighbouring regions (like the amber ACTIVE tag).
    atlas = Atlas(size=2048, pad=12)
    r_door = atlas.region("door", W, BODY_TOP - PLINTH, CHARCOAL, scale=0.75)
    inner_w, inner_h = WIN["w"] - 2 * WIN["band"], WIN["h"] - 2 * WIN["band"]
    r_back = atlas.region("window_back", inner_w, inner_h, (30, 31, 34), scale=0.8)
    r_reel = atlas.region("reel_face", 2 * REEL_R, 2 * REEL_R, (150, 152, 156))
    paint_leds(atlas, seed=13)
    paint_body_common(atlas)
    r_reel_edge = atlas.region("reel_edge", 2 * math.pi * REEL_R, 0.012, (120, 122, 126), scale=0.3)
    r_glass = atlas.region("glass", inner_w, inner_h, (36, 38, 42), scale=0.4)
    r_frame = atlas.region("frame_front", WIN["w"], WIN["h"], shade(CHARCOAL, 1.35), scale=0.4)
    r_frame_in = atlas.region("frame_inner", 0.5, 0.12, shade(CHARCOAL, 0.8))
    r_col = atlas.region("column_back", COL["w"], COL["top"] - COL["bottom"], (222, 214, 198))
    r_col_frame = atlas.region("column_frame", COL["w"] + 2 * COL["band"], COL["top"] - COL["bottom"] + 2 * COL["band"], shade(CHARCOAL, 1.35), scale=0.5)
    r_tape = atlas.region("tape", 0.12, 0.2, TAPE_BROWN, scale=0.5)
    r_head = atlas.region("head", 0.12, 0.12, PALETTE["metal"])

    # Door: base, then the operator panel between the vacuum columns and a grille at the bottom.
    paint_door_base(r_door, with_vent=False)
    px = lambda x: (x + W / 2) * DENSITY  # noqa: E731
    x0, x1 = px(-0.16), px(0.16)
    y0, y1 = door_px(0.86), door_px(0.38)
    r_door.rect(x0, y0, x1, y1, PALETTE["panel"], radius=8)
    r_door.rect(x0, y0, x1, y0 + 4, shade(CHARCOAL, 1.9), radius=2)
    r_door.text((x0 + x1) / 2, y0 + 46, "TAPE UNIT 2", INK, 26, FONT_BOLD, anchor="ms")
    lights = [("READY", AMBER, True), ("WRITE", (240, 240, 232), True), ("PROTECT", (90, 40, 30), False)]
    for i, (name, color, lit) in enumerate(lights):
        cy = y0 + 100 + i * 62
        r_door.ellipse(x0 + 52, cy, 13, 13, color)
        if lit:
            atlas.glow(r_door, x0 + 52, cy, 14, 14, color)
        r_door.text(x0 + 84, cy + 9, name, INK, 22, FONT_BOLD, anchor="ls")
    for i, name in enumerate(["LOAD", "START", "REWIND", "UNLOAD"]):
        cy = y0 + 300 + i * 40
        r_door.rect(x0 + 34, cy - 14, x0 + 104, cy + 14, (58, 59, 62), radius=5)
        r_door.rect(x0 + 34, cy - 14, x0 + 104, cy - 9, (88, 89, 93), radius=3)
        r_door.text(x0 + 120, cy + 8, name, INK, 20, FONT_BOLD, anchor="ls")
    gy0, gy1 = door_px(0.28), door_px(0.12)
    r_door.rect(px(-0.45), gy0, px(0.45), gy1, shade(CHARCOAL, 0.8), radius=6)
    for j in range(int((gy1 - gy0 - 30) // 22)):
        for i in range(int((px(0.45) - px(-0.45) - 40) // 22)):
            r_door.ellipse(px(-0.45) + 30 + i * 22 + (11 if j % 2 else 0), gy0 + 26 + j * 22, 5, 5, shade(CHARCOAL, 0.3))

    # Window back plate: brushed panel with the tape path running down into the columns.
    r_back.gradient(1.15, 0.9, base=(30, 31, 34))
    for i in range(0, int(r_back.h), 6):
        r_back.rect(0, i, r_back.w, i + 1, (34, 35, 38))
    bx = lambda x: (x + inner_w / 2) * DENSITY  # noqa: E731
    by = lambda y: (WIN["y"] + inner_h / 2 - y) * DENSITY  # noqa: E731
    for sx in (-1, 1):
        col_x = sx * abs(COL["xs"][0])
        # Tape leaves each reel at the bottom and drops into the vacuum column below the window,
        # and the column's other side feeds back up to the head between the reels.
        r_back.line(bx(col_x - sx * 0.04), by(REEL_Y - 0.1), bx(col_x - sx * 0.04), by(WIN["y"] - inner_h / 2), TAPE_BROWN, 9)
        r_back.line(bx(col_x + sx * 0.04), by(WIN["y"] - inner_h / 2), bx(sx * 0.06), by(1.08), TAPE_BROWN, 9)
    r_back.text(18, 34, "TAPE UNIT 2 · 1600 BPI", shade(INK, 0.55), 18, FONT_BOLD, anchor="ls")

    # Reel: aluminium flange with three cut-outs showing the brown tape pack, and a dark hub.
    c = REEL_R * DENSITY
    r_reel.fill(CHARCOAL)
    r_reel.ellipse(c, c, c - 1, c - 1, (168, 170, 174))
    r_reel.ellipse(c, c, c - 10, c - 10, (150, 152, 156))
    for k in range(3):
        a0 = math.radians(k * 120 + 20)
        a1 = math.radians(k * 120 + 100)
        pts = [r_reel.pt(c + 52 * math.cos(a0), c + 52 * math.sin(a0))]
        for i in range(13):
            a = a0 + (a1 - a0) * i / 12
            pts.append(r_reel.pt(c + (c - 26) * math.cos(a), c + (c - 26) * math.sin(a)))
        pts.append(r_reel.pt(c + 52 * math.cos(a1), c + 52 * math.sin(a1)))
        r_reel.draw.polygon(pts, fill=TAPE_BROWN)
    for rr in range(70, int(c - 26), 18):  # tape pack windings
        r_reel.draw.arc(r_reel.box(c - rr, c - rr, c + rr, c + rr), 0, 360, fill=shade(TAPE_BROWN, 1.25), width=2)
    for k in range(3):  # spokes between the cut-outs keep the flange reading as solid
        a = math.radians(k * 120 + 110)
        r_reel.line(c + 50 * math.cos(a), c + 50 * math.sin(a), c + (c - 24) * math.cos(a), c + (c - 24) * math.sin(a), (150, 152, 156), 22)
    r_reel.ellipse(c, c, 52, 52, (40, 41, 44))
    r_reel.ellipse(c, c, 22, 22, (150, 152, 156))
    r_reel.ellipse(c, c, 8, 8, (30, 30, 32))
    r_reel_edge.gradient(1.2, 0.8, base=(120, 122, 126))

    # Glass: near-black so it reads as smoked when see-through, with two light streaks.
    for x, wdt in ((0.18, 0.06), (0.3, 0.02)):
        for i in range(int(r_glass.w * wdt)):
            xx = r_glass.w * x + i
            r_glass.draw.line([r_glass.pt(xx, r_glass.h), r_glass.pt(xx + r_glass.h * 0.4, 0)], fill=(150, 152, 158), width=3)
    r_frame.bevel(1.3, 0.7, 6, base=shade(CHARCOAL, 1.35))
    r_col.gradient(1.05, 0.88, base=(222, 214, 198))
    atlas.glow(r_col, r_col.w / 2, r_col.h / 2, r_col.w * 0.7, r_col.h * 0.62, (150, 140, 120))
    r_tape.rect(r_tape.w * 0.48, 0, r_tape.w * 0.52, r_tape.h, shade(TAPE_BROWN, 1.4))
    r_head.gradient(1.3, 0.75, base=PALETTE["metal"])
    r_head.rect(0, r_head.h * 0.45, r_head.w, r_head.h * 0.55, (20, 20, 22))

    base, emissive = atlas.finish()

    body = Mesh("CabinetBody", atlas)
    build_body(body, "door")
    zb, zf = FRONT, FRONT + WIN["depth"]
    framed_window(body, "paint", WIN["x"], WIN["y"], (WIN["w"], WIN["h"]), (inner_w, inner_h), zb, zf, "frame_front", "frame_inner", "frame_inner")
    hw, hh = inner_w / 2, inner_h / 2
    z = zb + 0.002
    body.quad("paint", "window_back", (-hw, WIN["y"] - hh, z), (hw, WIN["y"] - hh, z), (hw, WIN["y"] + hh, z), (-hw, WIN["y"] + hh, z))
    body.box("paint", (-0.06, 1.02, zb), (0.06, 1.14, zb + 0.045), {"*": "head"})
    for cx in COL["xs"]:
        cw, ch = COL["w"], COL["top"] - COL["bottom"]
        cy = (COL["top"] + COL["bottom"]) / 2
        framed_window(body, "paint", cx, cy, (cw + 2 * COL["band"], ch + 2 * COL["band"]), (cw, ch), zb, zb + COL["depth"], "column_frame", "frame_inner", "frame_inner")
        body.quad("lit", "column_back", (cx - cw / 2, COL["bottom"], zb + 0.002), (cx + cw / 2, COL["bottom"], zb + 0.002), (cx + cw / 2, COL["top"], zb + 0.002), (cx - cw / 2, COL["top"], zb + 0.002))

    glass = Mesh("Glass", atlas)
    zg = zf - 0.004
    glass.quad("glass", "glass", (-hw, WIN["y"] - hh, zg), (hw, WIN["y"] - hh, zg), (hw, WIN["y"] + hh, zg), (-hw, WIN["y"] + hh, zg))

    def reel(name):
        m = Mesh(name, atlas)
        m.cylinder_z("reel", "reel_edge", "reel_face", (0, 0, 0), REEL_R, 0.012, segments=20)
        return m

    def loop(name):
        # Unit-height strip hanging down from the column top; the room scales it to animate.
        m = Mesh(name, atlas)
        lw = COL["w"] * 0.9
        zt = zb + 0.006
        m.quad("tape", "tape", (-lw / 2, -1.0, zt), (lw / 2, -1.0, zt), (lw / 2, 0.0, zt), (-lw / 2, 0.0, zt))
        return m

    zr = zb + 0.03
    root = Node("CabinetTape", mesh=body, children=[
        Node("Glass", mesh=glass),
        Node("ReelLeft", mesh=reel("ReelLeft"), translation=(-REEL_X, REEL_Y, zr)),
        Node("ReelRight", mesh=reel("ReelRight"), translation=(REEL_X, REEL_Y, zr)),
        Node("LoopLeft", mesh=loop("LoopLeft"), translation=(COL["xs"][0], COL["top"], 0)),
        Node("LoopRight", mesh=loop("LoopRight"), translation=(COL["xs"][1], COL["top"], 0)),
        led_node(atlas),
    ])
    rename = {"paint": "PaintedMetal", "lit": "ColumnLight", "glass": "SmokedGlass", "reel": "ReelAluminium", "tape": "Tape", "led": "LedPanel"}
    for n in [root] + root.children:
        if n.mesh:
            for p in n.mesh.prims.values():
                p.material = rename[p.material]
    mats = [
        Material("PaintedMetal", roughness=0.55, metalness=0.1, emissive=True),  # panel lights
        Material("ColumnLight", roughness=0.7, emissive=True),
        Material("SmokedGlass", roughness=0.08, alpha=0.28),
        Material("ReelAluminium", roughness=0.45, metalness=0.2),
        Material("Tape", roughness=0.5),
        Material("LedPanel", roughness=0.4, emissive=True),
    ]
    return root, mats, base, emissive


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, build in (("cabinet-terminal", build_terminal), ("cabinet-rack", build_rack), ("cabinet-tape", build_tape)):
        root, mats, base, emissive = build()
        out = os.path.join(OUT_DIR, f"{name}.glb")
        stats = write_glb(out, root, mats, base, emissive)
        base.save(os.path.join(HERE, f"{name}.albedo.png"))
        print(f"wrote {os.path.relpath(out)}: {stats['triangles']} triangles, {stats['bytes'] / 1024:.0f} KB")
