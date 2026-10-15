"""kit_wood_door — ledged-and-braced plank door, 0.95 x 2.05 x 0.06 m.
Origin at the hinge edge, bottom (x = 0); the leaf extends toward +X, front face -Z. Rotate about Y at the
origin to swing. Strap hinges + pull handle on the front, Z-brace on the back (+Z).
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

W, H, T = 0.95, 2.05, 0.06
PT = 0.035  # plank thickness (front layer); ledges make up the rest at the back
m = vlib.Builder("kit_wood_door")


def leaf(lod):
    if lod:
        m.box((W / 2, H / 2, -T / 2 + PT / 2), (W, H, PT), "wood_raw")
    else:
        n = 5
        w = W / n
        for i in range(n):
            m.box((w * (i + 0.5), H / 2, -T / 2 + PT / 2), (w - 0.008, H, PT), "wood_raw", bevel=0.008)
        m.box((W / 2, H / 2, -T / 2 + PT / 2), (W - 0.02, H - 0.02, PT - 0.012), "wood_dark")  # fills seams
    zb = T / 2 - (T - PT) / 2
    for y in (0.25, H - 0.25):  # ledges (back)
        m.box((W / 2, y, zb), (W - 0.06, 0.12, T - PT), "wood_dark", bevel=0.01 if not lod else 0)
    dy = (H - 0.5) - 0.12
    dx = W - 0.2
    m.box((W / 2, H / 2, zb), (math.hypot(dx, dy), 0.11, T - PT - 0.004), "wood_dark",
          rot=(0, 0, math.degrees(math.atan2(dy, dx))))  # brace rising from the hinge side bottom


leaf(0)
for y in (0.25, H - 0.25):  # strap hinges on the front
    m.box((0.2, y, -T / 2 - 0.004), (0.38, 0.05, 0.008), "metal_dark")
    m.cylinder((0.0, y, -T / 2 + 0.005), 0.016, 0.1, "metal_dark", segments=6)
m.box((W - 0.12, 1.0, -T / 2 - 0.025), (0.025, 0.2, 0.025), "metal_dark", bevel=0.005)  # pull handle
for y in (0.92, 1.08):
    m.box((W - 0.12, y, -T / 2 - 0.012), (0.025, 0.025, 0.025), "metal_dark")
m.box((W - 0.12, 1.2, -T / 2 - 0.004), (0.06, 0.1, 0.008), "metal_dark")  # latch plate
m.lod(1)
leaf(1)
m.box((W - 0.12, 1.0, -T / 2 - 0.02), (0.03, 0.2, 0.03), "metal_dark")
m.lod(2)
m.box((W / 2, H / 2, 0), (W, H, T), "wood_raw")
m.lod(0)

m.finish(lods=[0.5, 0.15], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
