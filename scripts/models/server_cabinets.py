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


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, build in (("cabinet-terminal", build_terminal), ("cabinet-rack", build_rack)):
        root, mats, base, emissive = build()
        out = os.path.join(OUT_DIR, f"{name}.glb")
        stats = write_glb(out, root, mats, base, emissive)
        base.save(os.path.join(HERE, f"{name}.albedo.png"))
        print(f"wrote {os.path.relpath(out)}: {stats['triangles']} triangles, {stats['bytes'] / 1024:.0f} KB")
