"""env_gate_chainlink_a — closed chain-link swing gate in its own posts, 3 x 2.2 x 0.08 m.
Heavier gate posts at x = +/-1.5, welded pipe frame with a mid rail and diagonal brace, coarse diamond
lattice mesh, barrel hinges on the -X post and a fork latch on the +X side. Collider: solid box (closed in M1).
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

W, H = 3.0, 2.2
FX0, FX1 = -W / 2 + 0.07, W / 2 - 0.07   # gate frame span between the posts
FY0, FY1 = 0.06, H - 0.1
R = 0.021
m = vlib.Builder("env_gate_chainlink_a")


def body(seg=6, post_seg=8, detail=True, spacing=0.16, thick=0.01):
    for x in (-W / 2, W / 2):
        m.cylinder((x, H / 2, 0), 0.042, H, "metal_bare", segments=post_seg)
        if detail:
            m.lathe([(0.048, H - 0.01), (0.048, H + 0.02), (0.025, H + 0.035), (0, H + 0.04)], "metal_bare",
                    center=(x, 0, 0), segments=post_seg)
    # frame rectangle + mid rail
    for y in (FY0, (FY0 + FY1) / 2, FY1):
        m.cylinder(((FX0 + FX1) / 2, y, 0), R, FX1 - FX0, "metal_bare", segments=seg, axis="x")
    for x in (FX0, FX1):
        m.cylinder((x, (FY0 + FY1) / 2, 0), R, FY1 - FY0 + 2 * R, "metal_bare", segments=seg)
    # diagonal brace, bottom hinge side to top latch side (lower half... full height)
    dx, dy = FX1 - FX0, FY1 - FY0
    ang = math.degrees(math.atan2(dy, dx))
    m.box(((FX0 + FX1) / 2, (FY0 + FY1) / 2, 0.0), (math.hypot(dx, dy) - 0.05, 0.034, 0.034), "metal_bare",
          rot=(0, 0, ang))
    m.lattice(FX0 + R, FX1 - R, FY0 + R, FY1 - R, 0.014, spacing, thick, "metal_bare")


body()
# hinges (-X post) and fork latch (+X side)
for y in (0.35, FY1 - 0.25):
    m.cylinder((-W / 2 + 0.045, y, 0), 0.03, 0.12, "metal_dark", segments=6)
    m.box((-W / 2 + 0.06, y, 0), (0.06, 0.05, 0.02), "metal_dark")
m.box((W / 2 - 0.05, 1.1, 0), (0.07, 0.04, 0.09), "metal_dark", bevel=0.008)
m.box((W / 2 - 0.08, 1.02, -0.04), (0.02, 0.18, 0.02), "metal_dark")  # drop rod
m.box((0.0, 1.1, -0.016), (0.24, 0.14, 0.008), "paint_red_faded")  # faded "keep closed" plate

m.lod(1)
body(seg=4, post_seg=6, detail=False, spacing=0.32, thick=0.014)
m.lod(2)
for x in (-W / 2, W / 2):
    m.box((x, H / 2, 0), (0.08, H, 0.08), "metal_bare")
for y in (FY0, FY1):
    m.box((0, y, 0), (FX1 - FX0, 0.04, 0.04), "metal_bare")
m.lattice(FX0, FX1, FY0, FY1, 0.014, 0.6, 0.025, "metal_bare")
m.lod(0)

m.finish(lods=[0.4, 0.1], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
