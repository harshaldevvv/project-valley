"""prop_target_plate_a (rev b) — swinging steel silhouette (IPSC-style) plate on a gallows stand.
Origin at ground centre, plate faces -Z. Stand: two posts at x = +/-0.42 (0.07 sq, 1.88 tall) on splayed feet,
top bar 0.92 m centred at y = 1.81 (the hinge line). The plate (0.45 x 0.8 m, hanging 1.0 - 1.8 m) and its two
hinge straps are a separate child part "PLATE" with its origin ON the hinge axis at (0, 1.8, 0): rotate PLATE
about local X to swing it (negative = bottom kicks back toward +Z, away from a shooter at -Z).
HINGE_Y = 1.8. SOCKET_hit = A-zone centre at rest (static; it does not follow the swing).
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

HINGE_Y = 1.8
PY = HINGE_Y - 0.8  # plate bottom
PX = 0.42  # post centre x
PLATE = [(-0.225, 0.0), (0.225, 0.0), (0.225, 0.5), (0.15, 0.62), (0.08, 0.62), (0.08, 0.8), (-0.08, 0.8),
         (-0.08, 0.62), (-0.15, 0.62), (-0.225, 0.5)]
m = vlib.Builder("prop_target_plate_a")


def gallows(bev):
    for sx in (-1, 1):
        m.box((sx * PX, (HINGE_Y + 0.08) / 2, 0), (0.07, HINGE_Y + 0.08, 0.07), "metal_dark", bevel=bev)  # post
        m.box((sx * PX, 0.03, 0), (0.08, 0.06, 0.34), "metal_dark", bevel=bev)  # foot
        if bev:  # diagonal braces post -> foot ends
            for sz in (-1, 1):
                m.box((sx * PX, 0.16, sz * 0.085), (0.03, 0.03, 0.26), "metal_dark", rot=(sz * 50, 0, 0))
    m.box((0, HINGE_Y + 0.01, 0), (2 * PX + 0.08, 0.07, 0.07), "metal_dark", bevel=bev)  # hinge bar
    m.box((0, 0.025, 0.12), (2 * PX, 0.05, 0.05), "metal_dark", bevel=bev)  # ground spreader (behind the plate)


gallows(0.008)
m.lod(1)
gallows(0)
m.lod(2)
for sx in (-1, 1):
    m.box((sx * PX, (HINGE_Y + 0.08) / 2, 0), (0.07, HINGE_Y + 0.08, 0.07), "metal_dark")
    m.box((sx * PX, 0.03, 0), (0.08, 0.06, 0.34), "metal_dark")
m.box((0, HINGE_Y + 0.01, 0), (2 * PX + 0.08, 0.07, 0.07), "metal_dark")
m.lod(0)

# --- PLATE part: hangs from the bar, origin on the hinge axis ---
m.part("PLATE", pivot=(0, HINGE_Y, 0))
m.extrude(PLATE, 0.012, "paint_white_faded", axis="z", center=(0, PY, 0), bevel=0.003)
for sx in (-1, 1):  # hinge straps: flat steel loops wrapped over the bar
    m.box((sx * 0.05, HINGE_Y - 0.02, 0), (0.03, 0.07, 0.024), "metal_bare")
    m.box((sx * 0.05, HINGE_Y + 0.05, 0), (0.03, 0.012, 0.09), "metal_bare")
    for sz in (-1, 1):
        m.box((sx * 0.05, HINGE_Y + 0.015, sz * 0.042), (0.03, 0.07, 0.008), "metal_bare")
for x, y in ((0.05, 0.3), (-0.08, 0.42), (0.12, 0.16), (-0.02, 0.7), (0.0, 0.33)):  # hit splashes
    m.cylinder((x, PY + y, -0.008), 0.018, 0.004, "metal_bare", segments=6, axis="z")
m.box((0, PY + 0.33, -0.0075), (0.15, 0.25, 0.002), "paint_red_faded")  # A-zone
m.part(None)
m.socket("hit", (0, PY + 0.33, -0.008))
m.socket("hinge", (0, HINGE_Y, 0))

m.finish(lods=[0.5, 0.15], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
