"""prop_duffel_bag_a — military canvas duffel bag lying on its side, 0.8 x 0.35 x 0.4 m.
Squashed lathed body (sags flat on the ground), webbing straps, carry handles, end caps, stencil tag.
Organic shape: LODs are auto-decimated.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

L, H, D = 0.8, 0.35, 0.4
R = 0.2
SY, SZ = (H / 2) / R, (D / 2) / R
C = (0, H / 2, 0)
m = vlib.Builder("prop_duffel_bag_a")

# profile along the long axis (radius, position), soft gathered ends
body = [(0, -0.4), (0.09, -0.395), (0.15, -0.37), (0.185, -0.32), (0.2, -0.22), (0.2, 0.22), (0.185, 0.32),
        (0.15, 0.37), (0.09, 0.395), (0, 0.4)]
m.lathe(body, "cloth_olive", center=C, segments=12, axis="x", scale=(1, SY, SZ))
# end caps (darker gathered canvas)
for s in (-1, 1):
    m.lathe([(0.0, s * 0.402), (0.09, s * 0.397), (0.11, s * 0.39)], "military_olive", center=C, segments=10,
            axis="x", scale=(1, SY, SZ))
# webbing straps around the body
for x in (-0.2, 0.2):
    m.lathe([(0.203, x - 0.02), (0.203, x + 0.02)], "cloth_black", center=C, segments=12, axis="x",
            scale=(1, SY, SZ))
# carry handles over the top (two strap loops joined by a grip)
for x in (-0.2, 0.2):
    m.box((x, H + 0.02, -0.03), (0.04, 0.05, 0.012), "cloth_black", rot=(30, 0, 0))
m.box((0, H + 0.04, -0.045), (0.44, 0.012, 0.04), "cloth_black", bevel=0.004)
m.box((0, H + 0.045, -0.045), (0.12, 0.024, 0.05), "cloth_black", bevel=0.008)  # grip wrap
# zipper/closure flap along the top
m.box((0, H - 0.004, 0.06), (0.5, 0.012, 0.05), "military_olive", bevel=0.004)
# stencil tag on the side facing -Z
m.box((0.05, H * 0.55, -D / 2 - 0.004), (0.22, 0.07, 0.006), "stencil_white", rot=(8, 0, 0))

m.finish(lods=[0.5, 0.2], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
