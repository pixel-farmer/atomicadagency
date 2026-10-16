"""
Low-poly model kit for The Mainframe.

Every machine in the room is built with this kit so they share one look:
  * Chunky, low-poly shapes (boxes, extruded side profiles, 12-sided cylinders).
  * All detail lives in one painted texture atlas per model: panel seams, buttons, labels,
    vents, ribs, grime, and fake bevels (light top edges, dark bottom edges, soft contact shadows).
  * One texel density for every model (DENSITY px per metre), so details read at the same scale.
  * One shared palette (PALETTE), matching the room's grayscale + amber scheme.

Output is a single binary glTF (.glb) with the textures embedded, ready for three.js / R3F.
Run the model scripts with plain Python 3 (numpy + Pillow). No Blender needed, though the .glb
opens in Blender too if you want to tweak it there.
"""
from __future__ import annotations

import io
import json
import math
import struct
from dataclasses import dataclass, field

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# --------------------------------------------------------------------------------------------
# Shared style
# --------------------------------------------------------------------------------------------

#: Texture pixels per metre of surface, for every model (1 px = 1 mm). Small props use a
#: 1024 atlas, big machines like the cabinets a 2048 one, so detail reads the same everywhere.
DENSITY = 1000
#: Painting happens at this multiple of the final size, then scales down for clean edges.
SUPERSAMPLE = 3

PALETTE = {
    # Casings
    "shell": (214, 213, 207),        # warm light gray, the room's printer/peripheral plastic
    "shell_dark": (176, 175, 169),   # recesses and second-tone plastic
    "shell_trim": (196, 195, 189),
    "cabinet": (37, 38, 41),         # the dark server cabinets
    "panel": (29, 30, 32),           # control panels, smoked plastic
    "glass": (20, 21, 23),
    "ink": (233, 232, 226),          # printed labels on dark panels
    "label_dim": (150, 151, 150),
    "amber": (242, 154, 31),         # the room's single accent
    "alert": (217, 58, 43),
    "metal": (120, 122, 126),
    "rubber": (24, 24, 25),
}

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
FONT_MONO_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"


def font(path: str, px: float) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, max(4, int(round(px))))


def shade(rgb, k: float):
    """Multiply a colour's brightness by k."""
    return tuple(max(0, min(255, int(round(c * k)))) for c in rgb)


# --------------------------------------------------------------------------------------------
# Texture atlas
# --------------------------------------------------------------------------------------------


@dataclass
class Region:
    name: str
    x: int  # final-size pixels
    y: int
    w: int
    h: int
    atlas: "Atlas"

    # --- painting helpers, all in this region's own coordinates (final-size pixels) ---
    def box(self, x0, y0, x1, y1):
        s = SUPERSAMPLE
        return [(self.x + x0) * s, (self.y + y0) * s, (self.x + x1) * s - 1, (self.y + y1) * s - 1]

    def pt(self, x, y):
        s = SUPERSAMPLE
        return ((self.x + x) * s, (self.y + y) * s)

    @property
    def draw(self) -> ImageDraw.ImageDraw:
        return self.atlas.draw

    def fill(self, rgb):
        self.draw.rectangle(self.box(0, 0, self.w, self.h), fill=rgb)

    def rect(self, x0, y0, x1, y1, rgb, radius=0.0):
        if radius:
            self.draw.rounded_rectangle(self.box(x0, y0, x1, y1), radius * SUPERSAMPLE, fill=rgb)
        else:
            self.draw.rectangle(self.box(x0, y0, x1, y1), fill=rgb)

    def line(self, x0, y0, x1, y1, rgb, width=1.0):
        self.draw.line([self.pt(x0, y0), self.pt(x1, y1)], fill=rgb, width=max(1, int(width * SUPERSAMPLE)))

    def ellipse(self, cx, cy, rx, ry, rgb):
        self.draw.ellipse(self.box(cx - rx, cy - ry, cx + rx, cy + ry), fill=rgb)

    def text(self, x, y, s, rgb, px, path=FONT_BOLD, anchor="la"):
        self.draw.text(self.pt(x, y), s, fill=rgb, font=font(path, px * SUPERSAMPLE), anchor=anchor)

    def bevel(self, light=1.12, dark=0.78, width=2.0, base=None):
        """Fake bevel: brighter top edge, darker bottom edge."""
        base = base or self.atlas.base_of.get(self.name, PALETTE["shell"])
        self.rect(0, 0, self.w, width, shade(base, light))
        self.rect(0, self.h - width, self.w, self.h, shade(base, dark))

    def gradient(self, top_k=1.0, bottom_k=0.88, base=None):
        """Vertical light falloff, e.g. grime toward the bottom of a face."""
        base = base or self.atlas.base_of.get(self.name, PALETTE["shell"])
        steps = max(2, self.h)
        for i in range(steps):
            k = top_k + (bottom_k - top_k) * (i / (steps - 1))
            self.rect(0, i, self.w, i + 1, shade(base, k))

    def grime(self, amount=0.05, seed=0):
        """Light speckle and smudges so flat plastic doesn't look like flat colour."""
        rng = np.random.default_rng(seed + hash(self.name) % 10_000)
        n = int(self.w * self.h * 0.004 * (amount / 0.05))
        for _ in range(n):
            x = rng.uniform(0, self.w)
            y = rng.uniform(0, self.h)
            r = rng.uniform(0.6, 2.4)
            k = rng.uniform(1 - amount * 1.6, 1 + amount * 0.6)
            base = self.atlas.base_of.get(self.name, PALETTE["shell"])
            self.ellipse(x, y, r, r * rng.uniform(0.5, 1.0), shade(base, k))


class ScaledRegion:
    """
    Paint a region in millimetres when the region itself is stored at a lower resolution.
    Large plain surfaces (a cabinet door, a side panel) can sit in the atlas at, say, 0.8 px/mm
    while the painting code stays in real units, so it reads the same as every other model.
    """

    def __init__(self, region: "Region", k: float):
        self.r = region
        self.k = k
        self.name = region.name
        self.atlas = region.atlas
        self.w = region.w / k
        self.h = region.h / k

    def box(self, x0, y0, x1, y1):
        k = self.k
        return self.r.box(x0 * k, y0 * k, x1 * k, y1 * k)

    def pt(self, x, y):
        return self.r.pt(x * self.k, y * self.k)

    @property
    def draw(self):
        return self.r.draw

    def fill(self, rgb):
        self.r.fill(rgb)

    def rect(self, x0, y0, x1, y1, rgb, radius=0.0):
        k = self.k
        self.r.rect(x0 * k, y0 * k, x1 * k, y1 * k, rgb, radius * k)

    def line(self, x0, y0, x1, y1, rgb, width=1.0):
        k = self.k
        self.r.line(x0 * k, y0 * k, x1 * k, y1 * k, rgb, max(1.0, width * k))

    def ellipse(self, cx, cy, rx, ry, rgb):
        k = self.k
        self.r.ellipse(cx * k, cy * k, rx * k, ry * k, rgb)

    def text(self, x, y, s, rgb, px, path=FONT_BOLD, anchor="la"):
        self.r.text(x * self.k, y * self.k, s, rgb, px * self.k, path, anchor)

    def bevel(self, light=1.12, dark=0.78, width=2.0, base=None):
        self.r.bevel(light, dark, max(1.0, width * self.k), base)

    def gradient(self, top_k=1.0, bottom_k=0.88, base=None):
        self.r.gradient(top_k, bottom_k, base)

    def grime(self, amount=0.05, seed=0):
        self.r.grime(amount, seed)


class Atlas:
    """Shelf-packed texture atlas. Regions are sized from real-world metres at DENSITY."""

    def __init__(self, size=1024, pad=6):
        self.size = size
        self.pad = pad
        self.regions: dict[str, Region] = {}
        self.base_of: dict[str, tuple] = {}
        # Skyline packing: the top edge of everything placed so far, as [x, y, width] segments.
        self._skyline: list[list[int]] = [[pad, pad, size - pad]]
        s = size * SUPERSAMPLE
        self.image = Image.new("RGB", (s, s), (128, 128, 128))
        self.emissive = Image.new("RGB", (s, s), (0, 0, 0))
        self.draw = ImageDraw.Draw(self.image)
        self.edraw = ImageDraw.Draw(self.emissive)

    def region(self, name: str, w_m: float, h_m: float, base=None, min_px=8, scale=1.0):
        """
        Allocate a region for a surface w_m × h_m metres, prefilled with `base`.
        scale < 1 stores a plain surface at lower resolution; you still paint it in millimetres.
        """
        w = max(min_px, int(round(w_m * DENSITY * scale)))
        h = max(min_px, int(round(h_m * DENSITY * scale)))
        if w + 2 * self.pad > self.size:
            raise ValueError(f"{name} is wider than the atlas ({w}px)")
        pos = self._find_spot(w + self.pad, h + self.pad)
        if pos is None:
            raise ValueError(f"Atlas full at {name}; use a bigger atlas or a smaller region")
        x, y = pos
        self._add_skyline(x, y + h + self.pad, w + self.pad)
        r = Region(name, x, y, w, h, self)
        self.regions[name] = r
        self.base_of[name] = base or PALETTE["shell"]
        r.fill(self.base_of[name])
        return ScaledRegion(r, scale) if scale != 1.0 else r

    def _find_spot(self, w, h):
        best = None
        for i in range(len(self._skyline)):
            x = self._skyline[i][0]
            if x + w > self.size:
                break
            # The rect rests on the highest segment it spans.
            y, span, j = 0, 0, i
            while span < w and j < len(self._skyline):
                y = max(y, self._skyline[j][1])
                span += self._skyline[j][2]
                j += 1
            if span < w or y + h > self.size:
                continue
            if best is None or y < best[1] or (y == best[1] and x < best[0]):
                best = (x, y)
        return best

    def _add_skyline(self, x, top, w):
        new = []
        for sx, sy, sw in self._skyline:
            # Keep the parts of each segment outside [x, x + w).
            if sx + sw <= x or sx >= x + w:
                new.append([sx, sy, sw])
                continue
            if sx < x:
                new.append([sx, sy, x - sx])
            if sx + sw > x + w:
                new.append([x + w, sy, sx + sw - (x + w)])
        new.append([x, top, w])
        new.sort()
        merged = []
        for seg in new:
            if merged and merged[-1][1] == seg[1] and merged[-1][0] + merged[-1][2] == seg[0]:
                merged[-1][2] += seg[2]
            else:
                merged.append(seg)
        self._skyline = merged

    def glow(self, region: Region, cx, cy, rx, ry, rgb):
        """Paint into the emissive map (things that light up, like LEDs)."""
        b = region.box(cx - rx, cy - ry, cx + rx, cy + ry)
        self.edraw.ellipse(b, fill=rgb)

    def uv_rect(self, name: str, inset=0.5):
        """(u0, v0, u1, v1) with v measured from the top, as glTF expects."""
        r = self.regions[name]
        s = self.size
        return ((r.x + inset) / s, (r.y + inset) / s, (r.x + r.w - inset) / s, (r.y + r.h - inset) / s)

    def bleed(self):
        """Spread region edges into the padding so mipmaps don't pull in the gray background."""
        img = self.image
        s = SUPERSAMPLE
        for r in self.regions.values():
            x0, y0, x1, y1 = r.x * s, r.y * s, (r.x + r.w) * s, (r.y + r.h) * s
            p = self.pad * s // 2
            top = img.crop((x0, y0, x1, y0 + 1)).resize((x1 - x0, p))
            img.paste(top, (x0, y0 - p))
            bottom = img.crop((x0, y1 - 1, x1, y1)).resize((x1 - x0, p))
            img.paste(bottom, (x0, y1))
            left = img.crop((x0, y0 - p, x0 + 1, y1 + p)).resize((p, y1 - y0 + 2 * p))
            img.paste(left, (x0 - p, y0 - p))
            right = img.crop((x1 - 1, y0 - p, x1, y1 + p)).resize((p, y1 - y0 + 2 * p))
            img.paste(right, (x1, y0 - p))

    def finish(self):
        self.bleed()
        base = self.image.resize((self.size, self.size), Image.LANCZOS)
        emissive = self.emissive.filter(ImageFilter.GaussianBlur(SUPERSAMPLE * 0.6)).resize(
            (self.size, self.size), Image.LANCZOS
        )
        return base, emissive


# --------------------------------------------------------------------------------------------
# Geometry
# --------------------------------------------------------------------------------------------


@dataclass
class Prim:
    material: str
    pos: list = field(default_factory=list)
    nrm: list = field(default_factory=list)
    uv: list = field(default_factory=list)
    idx: list = field(default_factory=list)


class Mesh:
    """Flat-shaded mesh: every face gets its own vertices, which is what gives the faceted look."""

    def __init__(self, name: str, atlas: Atlas):
        self.name = name
        self.atlas = atlas
        self.prims: dict[str, Prim] = {}

    def _prim(self, material):
        if material not in self.prims:
            self.prims[material] = Prim(material)
        return self.prims[material]

    def quad(self, material, region, p0, p1, p2, p3, flip_u=False):
        """p0..p3 counter-clockwise seen from outside: bottom-left, bottom-right, top-right, top-left."""
        u0, v0, u1, v1 = self.atlas.uv_rect(region)
        if flip_u:
            u0, u1 = u1, u0
        uvs = [(u0, v1), (u1, v1), (u1, v0), (u0, v0)]
        self.poly(material, [p0, p1, p2, p3], uvs)

    def poly(self, material, pts, uvs):
        pr = self._prim(material)
        pts = [np.asarray(p, float) for p in pts]
        n = newell_normal(pts)
        base = len(pr.pos)
        for p, t in zip(pts, uvs):
            pr.pos.append(tuple(p))
            pr.nrm.append(tuple(n))
            pr.uv.append(tuple(t))
        for tri in triangulate_2d(pts, n):
            pr.idx.extend(base + i for i in tri)

    def planar(self, material, region, pts, axes):
        """A flat polygon with planar UVs. `axes` = (u_axis, v_axis, origin, size_u, size_v) in metres."""
        u_ax, v_ax, origin, su, sv = axes
        u0, v0, u1, v1 = self.atlas.uv_rect(region)
        uvs = []
        for p in pts:
            d = np.asarray(p, float) - np.asarray(origin, float)
            fu = float(np.dot(d, u_ax)) / su
            fv = float(np.dot(d, v_ax)) / sv
            uvs.append((u0 + (u1 - u0) * fu, v1 - (v1 - v0) * fv))
        self.poly(material, pts, uvs)

    def box(self, material, lo, hi, regions: dict[str, str], skip=()):
        """Axis-aligned box. regions keys: front back left right top bottom (front is +z)."""
        x0, y0, z0 = lo
        x1, y1, z1 = hi
        faces = {
            "front": [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)],
            "back": [(x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0)],
            "left": [(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)],
            "right": [(x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1)],
            "top": [(x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0)],
            "bottom": [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)],
        }
        for k, pts in faces.items():
            if k in skip:
                continue
            self.quad(material, regions.get(k, regions.get("*")), *pts)

    def extrude_x(self, material, profile, x0, x1, segment_regions, cap_region, cap_size):
        """
        Extrude a side profile (list of (z, y), counter-clockwise when viewed from +x) between
        x0 and x1. segment_regions[i] textures the strip from profile[i] to profile[i+1].
        Both end caps use cap_region, mapped by (z, y) over cap_size = (z_min, y_min, depth, height).
        """
        n = len(profile)
        # Signed area in the view from +x (screen right is -z): must be counter-clockwise.
        area = sum((-profile[i][0]) * profile[(i + 1) % n][1] - (-profile[(i + 1) % n][0]) * profile[i][1] for i in range(n))
        if area < 0:
            raise ValueError("extrude_x profile must run counter-clockwise when viewed from +x (front on the left)")
        for i in range(n):
            za, ya = profile[i]
            zb, yb = profile[(i + 1) % n]
            reg = segment_regions[i]
            if reg is None:
                continue
            # Texture "up" points to the higher / further-back end, so labels read from the front.
            if (yb - zb) > (ya - za):
                (zl, yl), (zh, yh) = (za, ya), (zb, yb)
            else:
                (zl, yl), (zh, yh) = (zb, yb), (za, ya)
            normal = np.array([0.0, zb - za, -(yb - ya)])
            up = np.array([0.0, yh - yl, zh - zl])
            right_is_plus_x = np.cross(up, normal)[0] > 0
            xl, xr = (x0, x1) if right_is_plus_x else (x1, x0)
            self.quad(material, reg, (xl, yl, zl), (xr, yl, zl), (xr, yh, zh), (xl, yh, zh))
        zmin, ymin, depth, height = cap_size
        right = [(x1, y, z) for z, y in profile]
        self.planar(material, cap_region, right, (np.array([0, 0, -1.0]), np.array([0, 1.0, 0]), (x1, ymin, zmin + depth), depth, height))
        # The left cap reuses the same texture mirrored, so vents and seams sit at the same place on
        # both sides. Keep text off side caps, since it would read backwards on the left.
        left = [(x0, y, z) for z, y in reversed(profile)]
        self.planar(material, cap_region, left, (np.array([0, 0, -1.0]), np.array([0, 1.0, 0]), (x0, ymin, zmin + depth), depth, height))

    def cylinder_x(self, material, side_region, cap_region, center, radius, length, segments=12, outward=+1):
        """Cylinder along x. `outward` = +1 caps the +x end (the end that faces away from the body)."""
        cx, cy, cz = center
        xa, xb = cx - length / 2, cx + length / 2
        u0, v0, u1, v1 = self.atlas.uv_rect(side_region)
        for i in range(segments):
            a0 = 2 * math.pi * i / segments
            a1 = 2 * math.pi * (i + 1) / segments
            pa = (cy + radius * math.cos(a0), cz + radius * math.sin(a0))
            pb = (cy + radius * math.cos(a1), cz + radius * math.sin(a1))
            ua = u0 + (u1 - u0) * i / segments
            ub = u0 + (u1 - u0) * (i + 1) / segments
            pts = [(xb, pa[0], pa[1]), (xa, pa[0], pa[1]), (xa, pb[0], pb[1]), (xb, pb[0], pb[1])]
            uvs = [(ua, v1), (ua, v0), (ub, v0), (ub, v1)]
            if not self._outward(pts, (cy, cz)):
                pts, uvs = pts[::-1], uvs[::-1]
            self.poly(material, pts, uvs)
        cu0, cv0, cu1, cv1 = self.atlas.uv_rect(cap_region)
        for end, sign in ((xb, 1), (xa, -1)):
            ring = []
            uvs = []
            for i in range(segments):
                a = 2 * math.pi * i / segments
                ring.append((end, cy + radius * math.cos(a), cz + radius * math.sin(a)))
                uvs.append((cu0 + (cu1 - cu0) * (0.5 + 0.5 * math.sin(a)), cv0 + (cv1 - cv0) * (0.5 - 0.5 * math.cos(a))))
            n = np.cross(np.subtract(ring[1], ring[0]), np.subtract(ring[2], ring[0]))
            if (n[0] > 0) != (sign > 0):
                ring.reverse()
                uvs.reverse()
            self.poly(material, ring, uvs)

    @staticmethod
    def _outward(pts, axis_yz):
        p = [np.asarray(q, float) for q in pts]
        n = np.cross(p[1] - p[0], p[2] - p[0])
        mid = sum(p) / len(p)
        radial = np.array([0, mid[1] - axis_yz[0], mid[2] - axis_yz[1]])
        return float(np.dot(n, radial)) > 0

    def panel(self, material, region, center, size, tilt_x=0.0, thickness=0.01, back_region=None, edge_region=None):
        """A thin tilted plate (paper rests, guides). tilt_x leans the top backward (radians)."""
        cx, cy, cz = center
        w, h = size
        t = thickness
        c, s = math.cos(tilt_x), math.sin(tilt_x)

        def P(x, y, z):  # local x across, y up the plate, z out of its face; the top leans back
            return (cx + x, cy + y * c + z * s, cz - y * s + z * c)

        f = [P(-w / 2, 0, t / 2), P(w / 2, 0, t / 2), P(w / 2, h, t / 2), P(-w / 2, h, t / 2)]
        b = [P(w / 2, 0, -t / 2), P(-w / 2, 0, -t / 2), P(-w / 2, h, -t / 2), P(w / 2, h, -t / 2)]
        self.quad(material, region, *f)
        self.quad(material, back_region or region, *b)
        e = edge_region or region
        self.quad(material, e, b[1], f[0], f[3], b[2])  # left
        self.quad(material, e, f[1], b[0], b[3], f[2])  # right
        self.quad(material, e, f[3], f[2], b[3], b[2])  # top
        self.quad(material, e, b[1], b[0], f[1], f[0])  # bottom


def newell_normal(pts):
    """Polygon normal that stays correct for concave shapes (counter-clockwise = facing you)."""
    n = np.zeros(3)
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        n += np.array([(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])])
    length = np.linalg.norm(n)
    return n / length if length > 1e-12 else np.array([0, 1.0, 0])


def triangulate_2d(pts, normal):
    """Ear clipping for a simple planar polygon wound counter-clockwise around `normal`."""
    n = len(pts)
    if n == 3:
        return [(0, 1, 2)]
    a = np.asarray(normal, float)
    u = np.cross(a, [0, 0, 1.0]) if abs(a[2]) < 0.9 else np.cross(a, [0, 1.0, 0])
    u /= np.linalg.norm(u)
    v = np.cross(a, u)  # u × v = normal, so counter-clockwise has positive area
    p2 = [(float(np.dot(p, u)), float(np.dot(p, v))) for p in pts]

    def cross(o, q, r):
        return (q[0] - o[0]) * (r[1] - o[1]) - (r[0] - o[0]) * (q[1] - o[1])

    idx = list(range(n))
    tris = []
    while len(idx) > 3:
        for k in range(len(idx)):
            i, j, l = idx[k - 1], idx[k], idx[(k + 1) % len(idx)]
            if cross(p2[i], p2[j], p2[l]) <= 1e-12:
                continue  # reflex corner, not an ear
            if any(
                cross(p2[i], p2[j], p2[m]) >= 0 and cross(p2[j], p2[l], p2[m]) >= 0 and cross(p2[l], p2[i], p2[m]) >= 0
                for m in idx
                if m not in (i, j, l)
            ):
                continue
            tris.append((i, j, l))
            idx.pop(k)
            break
        else:
            raise ValueError("Could not triangulate polygon; is it self-intersecting?")
    tris.append(tuple(idx))
    return tris


# --------------------------------------------------------------------------------------------
# GLB writer
# --------------------------------------------------------------------------------------------


@dataclass
class Material:
    name: str
    roughness: float = 0.6
    metalness: float = 0.0
    emissive: bool = False
    double_sided: bool = False


@dataclass
class Node:
    name: str
    mesh: Mesh | None = None
    translation: tuple = (0, 0, 0)
    children: list = field(default_factory=list)
    extras: dict | None = None


def write_glb(path, root: Node, materials: list[Material], base_img: Image.Image, emissive_img: Image.Image | None):
    bin_chunks = []
    offset = 0
    buffer_views = []
    accessors = []

    def add_view(data: bytes, target=None):
        nonlocal offset
        pad = (-len(data)) % 4
        data += b"\0" * pad
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(data) - pad}
        if target:
            view["target"] = target
        buffer_views.append(view)
        bin_chunks.append(data)
        offset += len(data)
        return len(buffer_views) - 1

    def add_accessor(arr: np.ndarray, kind: str, ctype: int, target):
        view = add_view(arr.tobytes(), target)
        acc = {"bufferView": view, "componentType": ctype, "count": int(arr.shape[0]), "type": kind}
        if kind == "VEC3" and ctype == 5126:
            acc["min"] = arr.min(axis=0).tolist()
            acc["max"] = arr.max(axis=0).tolist()
        accessors.append(acc)
        return len(accessors) - 1

    def png(img):
        b = io.BytesIO()
        img.save(b, "PNG", optimize=True)
        return b.getvalue()

    def jpeg(img):
        b = io.BytesIO()
        img.save(b, "JPEG", quality=90, optimize=True, subsampling=0)
        return b.getvalue()

    # Colour as JPEG keeps files small; the emissive map is mostly black, so PNG is tiny.
    images = [{"bufferView": add_view(jpeg(base_img)), "mimeType": "image/jpeg", "name": "baseColor"}]
    textures = [{"source": 0, "sampler": 0}]
    if emissive_img is not None:
        images.append({"bufferView": add_view(png(emissive_img)), "mimeType": "image/png", "name": "emissive"})
        textures.append({"source": 1, "sampler": 0})

    mat_index = {}
    gl_materials = []
    for m in materials:
        gm = {
            "name": m.name,
            "pbrMetallicRoughness": {
                "baseColorTexture": {"index": 0},
                "metallicFactor": m.metalness,
                "roughnessFactor": m.roughness,
            },
        }
        if m.emissive and emissive_img is not None:
            gm["emissiveTexture"] = {"index": 1}
            gm["emissiveFactor"] = [1, 1, 1]
        if m.double_sided:
            gm["doubleSided"] = True
        mat_index[m.name] = len(gl_materials)
        gl_materials.append(gm)

    meshes = []
    nodes = []

    def add_node(n: Node):
        entry = {"name": n.name}
        if any(n.translation):
            entry["translation"] = list(map(float, n.translation))
        if n.extras:
            entry["extras"] = n.extras
        if n.mesh and n.mesh.prims:
            prims = []
            for pr in n.mesh.prims.values():
                pos = np.asarray(pr.pos, np.float32)
                nrm = np.asarray(pr.nrm, np.float32)
                uv = np.asarray(pr.uv, np.float32)
                idx = np.asarray(pr.idx, np.uint32 if len(pr.pos) > 65535 else np.uint16)
                prims.append({
                    "attributes": {
                        "POSITION": add_accessor(pos, "VEC3", 5126, 34962),
                        "NORMAL": add_accessor(nrm, "VEC3", 5126, 34962),
                        "TEXCOORD_0": add_accessor(uv, "VEC2", 5126, 34962),
                    },
                    "indices": add_accessor(idx, "SCALAR", 5125 if idx.dtype == np.uint32 else 5123, 34963),
                    "material": mat_index[pr.material],
                })
            meshes.append({"name": n.mesh.name, "primitives": prims})
            entry["mesh"] = len(meshes) - 1
        nodes.append(entry)
        me = len(nodes) - 1
        kids = [add_node(c) for c in n.children]
        if kids:
            nodes[me]["children"] = kids
        return me

    root_index = add_node(root)
    binary = b"".join(bin_chunks)
    gltf = {
        "asset": {"version": "2.0", "generator": "Mainframe lowpoly_kit"},
        "scene": 0,
        "scenes": [{"nodes": [root_index]}],
        "nodes": nodes,
        "meshes": meshes,
        "materials": gl_materials,
        "textures": textures,
        "images": images,
        # Linear filtering with mipmaps; repeat is unused because UVs stay inside the atlas.
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{"byteLength": len(binary)}],
    }
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((-len(js)) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<I4s", len(js), b"JSON"))
        f.write(js)
        f.write(struct.pack("<I4s", len(binary), b"BIN\0"))
        f.write(binary)
    tris = sum(len(p.idx) // 3 for n in _walk(root) if n.mesh for p in n.mesh.prims.values())
    return {"bytes": total, "triangles": tris}


def _walk(n: Node):
    yield n
    for c in n.children:
        yield from _walk(c)
