"""env_sign_board_a — wooden notice board on two posts, 2 x 2.2 x 0.15 m.
The front face (-Z) of the board is a flat 1.8 x 0.9 m rectangle centred at y = 1.6, z = -0.05;
SOCKET_label sits at its centre (the game lays a text texture there, facing -Z).
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

BW, BH, BY = 1.8, 0.9, 1.6
FRONT = -0.05
m = vlib.Builder("env_sign_board_a")

# board (flat painted face), trim frame just outside the rectangle, slightly proud
m.box((0, BY, FRONT + 0.015), (BW, BH, 0.03), "wood_painted_white")
for y in (BY - BH / 2 - 0.025, BY + BH / 2 + 0.025):
    m.box((0, y, FRONT + 0.012), (BW + 0.1, 0.05, 0.034), "wood_dark", bevel=0.01)
for x in (-BW / 2 - 0.025, BW / 2 + 0.025):
    m.box((x, BY, FRONT + 0.012), (0.05, BH, 0.034), "wood_dark", bevel=0.01)
# little roof plank over the board
m.box((0, BY + BH / 2 + 0.08, 0.0), (BW + 0.2, 0.04, 0.16), "wood_weathered", bevel=0.01, rot=(-8, 0, 0))
# posts with chamfered tops
for x in (-0.95, 0.95):
    m.box((x, 1.07, 0.035), (0.1, 2.14, 0.1), "wood_weathered", bevel=0.015)
    m.extrude([(-0.05, 0), (0.05, 0), (0.0, 0.06)], 0.1, "wood_weathered", axis="x", center=(x, 2.14, 0.035))
    m.box((x, 0.08, 0.035), (0.12, 0.16, 0.12), "wood_dark", bevel=0.01)  # rot/dirt collar at ground
# back rails holding the board
for y in (BY - 0.3, BY + 0.3):
    m.box((0, y, 0.0), (1.98, 0.08, 0.035), "wood_raw", bevel=0.01)
# a few nail heads on the trim
for x in (-0.925, 0.925):
    for y in (BY - 0.3, BY + 0.3):
        m.box((x, y, FRONT - 0.008), (0.015, 0.015, 0.006), "metal_dark")
m.socket("label", (0, BY, FRONT))

m.lod(1)
m.box((0, BY, FRONT + 0.015), (BW, BH, 0.03), "wood_painted_white")
m.box((0, BY, FRONT + 0.03), (BW + 0.1, BH + 0.1, 0.03), "wood_dark")
m.box((0, BY + BH / 2 + 0.08, 0.0), (BW + 0.2, 0.04, 0.16), "wood_weathered", rot=(-8, 0, 0))
for x in (-0.95, 0.95):
    m.box((x, 1.1, 0.035), (0.1, 2.2, 0.1), "wood_weathered")
m.lod(2)
m.box((0, BY, FRONT + 0.015), (BW, BH, 0.03), "wood_painted_white")
m.box((0, BY + 0.02, FRONT + 0.04), (BW + 0.2, BH + 0.14, 0.03), "wood_dark")
for x in (-0.95, 0.95):
    m.box((x, 0.6, 0.035), (0.1, 1.2, 0.1), "wood_weathered")
m.lod(0)

m.finish(lods=[0.5, 0.15], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
