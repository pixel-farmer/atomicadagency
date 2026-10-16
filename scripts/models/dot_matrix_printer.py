"""
Dot matrix printer for The Mainframe.

    python scripts/models/dot_matrix_printer.py

Writes public/models/mainframe/dot-matrix-printer.glb (and the painted atlas as PNGs next to
this script, for reference or repainting).

Units are metres, Y up, the front faces +Z, and the origin is the centre of the base.
Named nodes the room uses:
    PlatenKnob   the side knob; its local origin is on its axis so it can spin (rotation.x)
    PaperExit    where live paper leaves the printer; extras.tilt is the paper's lean (radians)
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lowpoly_kit import (  # noqa: E402
    FONT_BOLD,
    FONT_MONO,
    PALETTE,
    Atlas,
    Material,
    Mesh,
    Node,
    shade,
    write_glb,
)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "public", "models", "mainframe", "dot-matrix-printer.glb")

# ---- Dimensions (metres) -------------------------------------------------------------------
W = 0.60            # body width
D = 0.40            # body depth
FRONT_H = 0.088     # height of the front face
DECK_Y = 0.128      # top deck the lid sits on
REAR_Y = 0.150      # raised rear section
SEAM_Y = 0.030      # moulding seam that runs around the body
LID_W = 0.51
LID_FRONT_Z = 0.13
LID_BACK_Z = -0.062
REST_TILT = 0.36    # paper rest leans back this much (radians)

SHELL = PALETTE["shell"]
TRIM = PALETTE["shell_trim"]
PANEL = PALETTE["panel"]
SMOKE = (23, 24, 26)

atlas = Atlas(size=1024, pad=6)
A = atlas.region

# ---- Allocate the atlas, biggest surfaces first ----------------------------------------------
r_front = A("front", W, FRONT_H, SHELL)
r_side = A("side", D, REAR_Y, SHELL)
r_back = A("back", W, REAR_Y, SHELL)
r_rear = A("rear_top", W, 0.115, SHELL)
r_slope = A("slope", W, 0.0763, SHELL)
r_lid = A("lid_top", LID_W, 0.193, SMOKE)
r_rest = A("rest", 0.44, 0.19, TRIM)
r_sep = A("separator", 0.07, 0.21, TRIM)
r_knob = A("knob_side", 2 * math.pi * 0.042, 0.036, SHELL)
r_cap = A("knob_cap", 0.084, 0.084, SHELL)
r_step = A("step", W, 0.026, PANEL)
r_deck = A("deck", W, 0.03, (26, 27, 29))
r_bottom = A("bottom", W, 0.02, shade(SHELL, 0.6))
r_lid_edge = A("lid_edge", LID_W, 0.02, (32, 33, 36))
r_lid_side = A("lid_side", 0.2, 0.022, (32, 33, 36))
r_edge = A("edge", 0.2, 0.02, TRIM)

# ---- Paint -----------------------------------------------------------------------------------
INK = PALETTE["ink"]
DIM = PALETTE["label_dim"]
AMBER = PALETTE["amber"]


def seam(region, y):
    region.rect(0, y, region.w, y + 1.4, shade(region.atlas.base_of[region.name], 0.72))
    region.rect(0, y + 1.4, region.w, y + 2.6, shade(region.atlas.base_of[region.name], 1.08))


# Front: light falloff, moulding seam, contact shadow at the floor.
r_front.gradient(1.03, 0.9)
r_front.grime(0.015)
seam(r_front, (FRONT_H - SEAM_Y) * 1000)
r_front.rect(0, r_front.h - 5, r_front.w, r_front.h, shade(SHELL, 0.62))
r_front.bevel(1.12, 0.7, 2)

# Side (both ends): seam, vent slots toward the back, rubber foot shadow.
r_side.gradient(1.0, 0.86)
r_side.grime(0.015, seed=3)
seam(r_side, (REAR_Y - SEAM_Y) * 1000)
for i in range(9):
    x = r_side.w * 0.55 + i * 13
    r_side.rect(x, 62, x + 7, 100, shade(SHELL, 0.45), radius=3)
    r_side.rect(x, 62, x + 7, 64, shade(SHELL, 0.3))
r_side.rect(0, r_side.h - 5, r_side.w, r_side.h, shade(SHELL, 0.62))

# Back: ports, vents and a service label.
r_back.gradient(0.98, 0.84)
r_back.grime(0.02, seed=5)
seam(r_back, (REAR_Y - SEAM_Y) * 1000)
r_back.rect(70, 50, 200, 82, (40, 41, 44), radius=4)          # parallel port
r_back.rect(78, 57, 192, 75, (18, 18, 19), radius=3)
for x in (60, 210):
    r_back.ellipse(x, 66, 5, 5, PALETTE["metal"])
r_back.rect(250, 52, 290, 80, (40, 41, 44), radius=3)          # power socket
r_back.rect(258, 60, 282, 72, (14, 14, 15))
for i in range(14):
    x = 330 + i * 15
    r_back.rect(x, 40, x + 8, 90, shade(SHELL, 0.48), radius=3)
r_back.rect(430, 100, 560, 128, (232, 230, 222), radius=2)     # service label
for i in range(18):
    r_back.rect(438 + i * 6, 106, 438 + i * 6 + (2 if i % 3 else 3), 122, (40, 40, 40))
r_back.rect(0, r_back.h - 5, r_back.w, r_back.h, shade(SHELL, 0.62))

# Rear deck: paper-feed slot along the front edge (bottom of this region), moulded ribs.
r_rear.gradient(1.02, 0.95)
r_rear.grime(0.012, seed=7)
r_rear.rect(30, r_rear.h - 22, r_rear.w - 30, r_rear.h - 12, (16, 16, 17), radius=3)
for i in range(30):
    x = 22 + i * 19
    r_rear.line(x, 8, x, r_rear.h - 34, shade(SHELL, 0.86), 1.2)

# Step between lid and rear deck: the dark throat the paper comes out of.
r_step.fill((14, 14, 15))
r_step.rect(0, 0, r_step.w, 2, shade(SHELL, 0.9))

# Control panel on the front slope. Texture "up" is toward the back, so it reads from the front.
r_slope.gradient(1.06, 0.98)
r_slope.bevel(1.12, 0.8, 2)
r_slope.rect(24, 9, r_slope.w - 24, r_slope.h - 9, PANEL, radius=5)
r_slope.rect(24, 9, r_slope.w - 24, 10.5, (58, 59, 62))
labels = ["LINE\nFEED", "FORM\nFEED", "TOF\nSET", "SELECT"]
for i, label in enumerate(labels):
    x = 44 + i * 44
    for j, part in enumerate(label.split("\n")):
        r_slope.text(x + 15, 15 + j * 7, part, INK, 6.5, FONT_BOLD, anchor="mt")
    r_slope.rect(x, 33, x + 30, 55, (52, 53, 56), radius=3)
    r_slope.rect(x + 1.5, 33.5, x + 28.5, 36, (82, 83, 87), radius=2)
    r_slope.rect(x, 52, x + 30, 55, (20, 20, 21), radius=2)
for k, (name, color, lit) in enumerate([("POWER", AMBER, True), ("ALARM", (70, 28, 24), False)]):
    x = 236 + k * 40
    r_slope.text(x, 22, name, INK, 6, FONT_BOLD, anchor="mt")
    r_slope.ellipse(x, 38, 4.2, 4.2, color)
    if lit:
        atlas.glow(r_slope, x, 38, 4.6, 4.6, AMBER)
r_slope.text(340, 18, "PITCH", INK, 6.5, FONT_BOLD, anchor="mt")
r_slope.rect(326, 30, 354, 50, (52, 53, 56), radius=3)
r_slope.rect(327.5, 30.5, 352.5, 33, (82, 83, 87), radius=2)
for j, p in enumerate(["10", "12", "17"]):
    r_slope.text(366, 26 + j * 9, p, DIM, 6, FONT_MONO)
    r_slope.ellipse(362, 29 + j * 9, 1.6, 1.6, AMBER if j == 0 else (60, 60, 62))
    if j == 0:
        atlas.glow(r_slope, 362, 29, 2, 2, AMBER)
r_slope.text(410, 18, "MODE", INK, 6.5, FONT_BOLD, anchor="mt")
r_slope.rect(396, 30, 424, 50, (52, 53, 56), radius=3)
r_slope.rect(397.5, 30.5, 422.5, 33, (82, 83, 87), radius=2)
for j, p in enumerate(["NLQ", "DRAFT"]):
    r_slope.text(436, 28 + j * 10, p, DIM, 6, FONT_MONO)
r_slope.text(r_slope.w - 40, 31, "LP-9", AMBER, 19, FONT_BOLD, anchor="rs")
r_slope.text(r_slope.w - 40, 45, "DOT MATRIX · 9 PIN", INK, 6.5, FONT_BOLD, anchor="rs")
r_slope.rect(r_slope.w - 128, 49, r_slope.w - 40, 50.5, AMBER)

# Smoked lid: dark plastic with the carriage faintly visible, and a couple of reflections.
lid = r_lid
lid.fill(SMOKE)
lid.rect(20, 92, lid.w - 20, 98, (40, 41, 44))                 # carriage rail
lid.rect(20, 104, lid.w - 20, 107, (34, 35, 37))
lid.rect(150, 70, 210, 128, (44, 45, 48), radius=4)            # print head
lid.rect(158, 78, 202, 92, (30, 31, 33), radius=2)
lid.rect(60, 128, lid.w - 60, 150, (30, 31, 33), radius=3)     # ribbon cartridge
lid.rect(20, 160, lid.w - 20, 166, (36, 37, 40))               # platen
for i, (x, w) in enumerate([(80, 34), (128, 10), (330, 46)]):
    lid.draw.polygon([lid.pt(x, 0), lid.pt(x + w, 0), lid.pt(x + w - 60, lid.h), lid.pt(x - 60, lid.h)], fill=(46 - i * 4, 48 - i * 4, 52 - i * 4))
lid.rect(0, 0, lid.w, 3, (78, 80, 84))
lid.rect(0, lid.h - 3, lid.w, lid.h, (12, 12, 13))
lid.rect(0, 0, 3, lid.h, (52, 53, 56))
lid.rect(lid.w - 3, 0, lid.w, lid.h, (52, 53, 56))

# Paper rest: ribbed plastic.
r_rest.gradient(1.04, 0.9, base=TRIM)
for i in range(1, 23):
    x = i * r_rest.w / 23
    r_rest.line(x, 14, x, r_rest.h - 8, shade(TRIM, 0.82), 1.6)
    r_rest.line(x + 2, 14, x + 2, r_rest.h - 8, shade(TRIM, 1.08), 1.0)
r_rest.bevel(1.12, 0.78, 3, base=TRIM)

# Paper separators: ribs and a sliding clamp.
r_sep.gradient(1.04, 0.86, base=TRIM)
for x in (18, 35, 52):
    r_sep.line(x, 30, x, r_sep.h - 10, shade(TRIM, 0.8), 1.6)
r_sep.rect(10, 120, 60, 175, shade(TRIM, 0.92), radius=4)
r_sep.rect(10, 120, 60, 123, shade(TRIM, 1.1), radius=2)
r_sep.bevel(1.12, 0.78, 3, base=TRIM)

# Platen knob: grip ridges around the rim and a dimpled cap.
r_knob.fill(SHELL)
for i in range(0, r_knob.w, 8):
    r_knob.rect(i, 0, i + 3, r_knob.h, shade(SHELL, 0.74))
r_cap.fill(shade(SHELL, 0.96))
r_cap.ellipse(42, 42, 34, 34, shade(SHELL, 1.05))
r_cap.ellipse(42, 42, 12, 12, shade(SHELL, 0.82))
r_cap.ellipse(42, 42, 9, 9, shade(SHELL, 0.9))

r_edge.gradient(1.05, 0.85, base=TRIM)

base_img, emissive_img = atlas.finish()

# ---- Geometry --------------------------------------------------------------------------------
body = Mesh("PrinterBody", atlas)

# Side profile (z, y), counter-clockwise seen from +x, i.e. front on the left.
profile = [
    (D / 2, 0.0),          # bottom front
    (-D / 2, 0.0),         # bottom back
    (-D / 2, REAR_Y),      # top back
    (-0.085, REAR_Y),      # front of the raised rear deck
    (-0.068, DECK_Y),      # step down to the lid deck
    (0.135, DECK_Y),       # front of the deck
    (D / 2, FRONT_H),      # top of the front face, after the control slope
]
segments = ["bottom", "back", "rear_top", "step", "deck", "slope", "front"]
body.extrude_x("plastic", profile, -W / 2, W / 2, segments, "side", (-D / 2, 0.0, D, REAR_Y))

# Smoked lid: a shallow wedge on the deck, higher at the back.
lid_profile = [
    (LID_FRONT_Z, DECK_Y),
    (LID_BACK_Z, DECK_Y),
    (LID_BACK_Z, DECK_Y + 0.021),
    (LID_FRONT_Z, DECK_Y + 0.011),
]
body.extrude_x("smoked", lid_profile, -LID_W / 2, LID_W / 2, [None, "lid_edge", "lid_top", "lid_edge"], "lid_side", (LID_BACK_Z, DECK_Y, LID_FRONT_Z - LID_BACK_Z, 0.022))

# Paper rest behind the paper exit, and two paper separators in front of it.
body.panel("plastic", "rest", (0.0, REAR_Y - 0.004, -0.15), (0.44, 0.19), tilt_x=REST_TILT, thickness=0.008, edge_region="edge")
for x in (-0.165, 0.165):
    body.panel("plastic", "separator", (x, REAR_Y - 0.004, -0.115), (0.07, 0.21), tilt_x=REST_TILT - 0.06, thickness=0.01, edge_region="edge")

# Platen knob on the right side, built around its own axis so it can spin.
KNOB_R = 0.042
KNOB_L = 0.036
knob_center = (W / 2 + KNOB_L / 2 - 0.004, 0.096, -0.035)
knob = Mesh("PlatenKnob", atlas)
knob.cylinder_x("plastic", "knob_side", "knob_cap", (0, 0, 0), KNOB_R, KNOB_L, segments=14)

root = Node(
    "DotMatrixPrinter",
    mesh=body,
    children=[
        Node("PlatenKnob", mesh=knob, translation=knob_center),
        Node("PaperExit", translation=(0.0, DECK_Y + 0.012, -0.074), extras={"tilt": REST_TILT - 0.03, "width": 0.25}),
    ],
)

materials = [
    Material("Plastic", roughness=0.62),
    Material("SmokedPlastic", roughness=0.16),
]
# Mesh prims are keyed by short names; map them to the glTF material names.
for mesh in (body, knob):
    for prim in mesh.prims.values():
        prim.material = {"plastic": "Plastic", "smoked": "SmokedPlastic"}[prim.material]
materials[0].emissive = True  # the POWER and pitch LEDs live on the plastic

if __name__ == "__main__":
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    stats = write_glb(OUT, root, materials, base_img, emissive_img)
    base_img.save(os.path.join(HERE, "dot-matrix-printer.albedo.png"))
    emissive_img.save(os.path.join(HERE, "dot-matrix-printer.emissive.png"))
    print(f"wrote {os.path.relpath(OUT)}: {stats['triangles']} triangles, {stats['bytes'] / 1024:.0f} KB")
