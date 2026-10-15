"""prop_weapon_rack_a — free-standing wall-style gun rack on legs, 1.6 x 1.6 x 0.5 m (empty).
Plank backboard between two posts with splayed feet, a butt tray at the bottom and peg pairs at the top
(front = -Z). Sockets SOCKET_slot_0..5 mark where a long gun rests (butt-in-tray point).
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

W, H, D = 1.6, 1.6, 0.5
PX = W / 2 - 0.05
BZ = 0.0  # backboard plane
SLOTS = 6
m = vlib.Builder("prop_weapon_rack_a")


def frame(bev):
    for x in (-PX, PX):
        m.box((x, H / 2, BZ + 0.03), (0.08, H, 0.08), "wood_dark", bevel=bev)
        m.box((x, 0.04, 0), (0.09, 0.08, D), "wood_dark", bevel=bev)  # foot
        m.box((x, 0.24, -0.125), (0.04, 0.04, 0.41), "wood_dark", rot=(-52, 0, 0))  # front brace
    m.box((0, H - 0.03, BZ + 0.03), (W, 0.06, 0.09), "wood_dark", bevel=bev)  # top cap


frame(0.012)
# backboard: 5 vertical-gap horizontal planks
for i in range(5):
    m.box((0, 0.35 + i * 0.23, BZ + 0.05), (2 * PX - 0.08, 0.215, 0.025), "wood_raw", bevel=0.006)
# butt tray: floor + front lip
m.box((0, 0.2, -0.07), (2 * PX - 0.08, 0.03, 0.22), "wood_dark", bevel=0.008)
m.box((0, 0.26, -0.17), (2 * PX - 0.08, 0.1, 0.025), "wood_raw", bevel=0.008)
for k in range(SLOTS + 1):  # tray dividers
    x = -PX + 0.04 + (2 * PX - 0.08) * k / SLOTS
    m.box((x, 0.25, -0.07), (0.02, 0.07, 0.2), "wood_dark")
# peg rail with peg pairs (barrel rests)
m.box((0, 1.3, BZ + 0.02), (2 * PX - 0.08, 0.08, 0.04), "wood_dark", bevel=0.008)
for k in range(SLOTS):
    x = -PX + 0.04 + (2 * PX - 0.08) * (k + 0.5) / SLOTS
    for dx in (-0.05, 0.05):
        m.cylinder((x + dx, 1.32, -0.08), 0.015, 0.16, "wood_raw", segments=6, axis="z")
    m.socket(f"slot_{k}", (x, 0.22, -0.07))
# small stencil plate on the top cap
m.box((0, H - 0.03, -0.017), (0.3, 0.04, 0.004), "stencil_white")

m.lod(1)
frame(0)
m.box((0, 0.35 + 2 * 0.23, BZ + 0.05), (2 * PX - 0.08, 5 * 0.23, 0.025), "wood_raw")
m.box((0, 0.22, -0.08), (2 * PX - 0.08, 0.1, 0.2), "wood_dark")
m.box((0, 1.3, -0.02), (2 * PX - 0.08, 0.08, 0.12), "wood_dark")
m.lod(2)
for x in (-PX, PX):
    m.box((x, H / 2, 0.03), (0.08, H, 0.08), "wood_dark")
    m.box((x, 0.04, 0), (0.09, 0.08, D), "wood_dark")
m.box((0, 0.35 + 2 * 0.23, 0.05), (2 * PX - 0.08, 5 * 0.23, 0.025), "wood_raw")
m.box((0, 0.22, -0.08), (2 * PX - 0.08, 0.1, 0.2), "wood_dark")
m.lod(0)

m.finish(lods=[0.5, 0.15], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
