"""
Printer stand for The Mainframe: a metal-frame stand with a laminate top and a lower shelf that
catches the printed paper.

    python scripts/models/printer_stand.py

Writes public/models/mainframe/printer-stand.glb. Metres, Y up, front +Z, origin at floor centre.
Named nodes: TopSurface (y of the top, where the printer sits), Shelf (y of the paper shelf).
Plain surfaces use smaller atlas regions than DENSITY would give; they have no detail to lose.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lowpoly_kit import PALETTE, Atlas, Material, Mesh, Node, shade, write_glb  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "public", "models", "mainframe", "printer-stand.glb")

TOP_W, TOP_D, TOP_Y, TOP_T = 1.0, 0.7, 0.74, 0.03
LEG = 0.04
SHELF_Y, SHELF_T = 0.16, 0.02
INSET = 0.03

LAMINATE = PALETTE["shell_dark"]
METAL = PALETTE["cabinet"]

atlas = Atlas(size=1024, pad=6)
r_top = atlas.region("laminate", 0.45, 0.32, LAMINATE)
r_edge = atlas.region("top_edge", 0.45, 0.03, METAL)
r_leg = atlas.region("leg", 0.12, 0.36, METAL)
r_shelf = atlas.region("shelf", 0.4, 0.28, shade(METAL, 1.15))
r_shelf_edge = atlas.region("shelf_edge", 0.4, 0.02, METAL)
r_foot = atlas.region("foot", 0.03, 0.03, PALETTE["rubber"])

r_top.grime(0.03, seed=11)
r_top.rect(0, 0, r_top.w, 3, shade(LAMINATE, 1.12))
r_edge.bevel(1.5, 0.6, 3, base=METAL)
r_leg.gradient(1.25, 0.9, base=METAL)
r_leg.rect(r_leg.w * 0.35, 0, r_leg.w * 0.5, r_leg.h, shade(METAL, 1.6))  # highlight down the leg
r_shelf.grime(0.03, seed=13)
for i in range(1, 9):  # pressed ribs in the sheet-metal shelf
    y = i * r_shelf.h / 9
    r_shelf.line(6, y, r_shelf.w - 6, y, shade(METAL, 0.8), 2)
    r_shelf.line(6, y + 2, r_shelf.w - 6, y + 2, shade(METAL, 1.5), 1)
r_shelf_edge.bevel(1.5, 0.6, 2, base=METAL)

base_img, emissive_img = atlas.finish()

m = Mesh("PrinterStand", atlas)
hw, hd = TOP_W / 2, TOP_D / 2
m.box("metal", (-hw, TOP_Y - TOP_T, -hd), (hw, TOP_Y, hd), {"top": "laminate", "*": "top_edge"})
for sx in (-1, 1):
    for sz in (-1, 1):
        x = sx * (hw - INSET - LEG / 2)
        z = sz * (hd - INSET - LEG / 2)
        m.box("metal", (x - LEG / 2, 0.012, z - LEG / 2), (x + LEG / 2, TOP_Y - TOP_T, z + LEG / 2), {"*": "leg"}, skip=("top", "bottom"))
        m.box("metal", (x - LEG * 0.7, 0, z - LEG * 0.7), (x + LEG * 0.7, 0.012, z + LEG * 0.7), {"*": "foot"}, skip=("bottom",))
sw, sd = hw - INSET, hd - INSET
m.box("metal", (-sw, SHELF_Y - SHELF_T, -sd), (sw, SHELF_Y, sd), {"top": "shelf", "*": "shelf_edge"})

root = Node("PrinterStand", mesh=m, children=[
    Node("TopSurface", translation=(0, TOP_Y, 0)),
    Node("Shelf", translation=(0, SHELF_Y, 0)),
])
for prim in m.prims.values():
    prim.material = "PaintedMetal"

if __name__ == "__main__":
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    stats = write_glb(OUT, root, [Material("PaintedMetal", roughness=0.55, metalness=0.2)], base_img, None)
    print(f"wrote {os.path.relpath(OUT)}: {stats['triangles']} triangles, {stats['bytes'] / 1024:.0f} KB")
