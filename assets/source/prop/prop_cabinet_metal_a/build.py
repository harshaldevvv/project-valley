"""prop_cabinet_metal_a — two-door steel storage cabinet / locker, 0.9 x 1.8 x 0.5 m.
Faded green enamel shell on a dark plinth, two doors with vent louvres and handles (right door slightly
sprung open by a dent), rust patches along the bottom. Doors are part of the main mesh in M1.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

W, H, D = 0.9, 1.8, 0.5
PL = 0.06  # plinth
FZ = -D / 2  # front plane
DW = (W - 0.06) / 2  # door width
m = vlib.Builder("prop_cabinet_metal_a")

PAINT = "paint_green_faded"
m.box((0, PL + (H - PL) / 2, 0.01), (W, H - PL, D - 0.02), PAINT, bevel=0.015)  # shell
m.box((0, PL / 2, 0.01), (W - 0.04, PL, D - 0.06), "metal_dark", bevel=0.008)  # plinth
m.box((0, H - 0.015, 0.01), (W + 0.01, 0.03, D - 0.01), PAINT, bevel=0.01)  # top lip
for i, sx in enumerate((-1, 1)):
    cx = sx * (DW / 2 + 0.006)
    yaw = 0  # right door sits proud instead (sprung by a dent)
    zoff = FZ - 0.008 - (0.012 if sx > 0 else 0)
    m.box((cx, PL + (H - PL) / 2, zoff), (DW, H - PL - 0.06, 0.02), PAINT, bevel=0.01, rot=(0, yaw, 0))
    for k in range(4):  # louvres
        m.box((cx, H - 0.2 - k * 0.045, zoff - 0.012), (DW * 0.55, 0.018, 0.012), "metal_dark", rot=(0, yaw, 0))
    # handle near the centre seam
    hx = cx - sx * (DW / 2 - 0.05)
    m.box((hx, 1.0, zoff - 0.025), (0.02, 0.16, 0.02), "metal_bare", bevel=0.005, rot=(0, yaw, 0))
    m.box((hx, 1.0, zoff - 0.012), (0.04, 0.2, 0.006), "metal_dark", rot=(0, yaw, 0))
# label holder + rust
m.box((-0.2, 1.3, FZ - 0.02), (0.14, 0.06, 0.004), "paper")
for x, y, w, h in ((-0.3, 0.13, 0.22, 0.1), (0.25, 0.12, 0.3, 0.07), (0.43, 0.6, 0.006, 0.25)):
    m.box((x, y, FZ - 0.02), (w, h, 0.004), "rust")
m.box((W / 2 + 0.002, 0.2, 0.05), (0.004, 0.18, 0.3), "rust")

m.lod(1)
m.box((0, PL + (H - PL) / 2, 0), (W, H - PL, D), PAINT)
m.box((0, PL / 2, 0.01), (W - 0.04, PL, D - 0.06), "metal_dark")
m.box((0, H - 0.25, FZ - 0.003), (W * 0.6, 0.16, 0.006), "metal_dark")
for sx in (-1, 1):
    m.box((sx * 0.06, 1.0, FZ - 0.012), (0.02, 0.16, 0.024), "metal_bare")
m.box((0, PL + (H - PL) / 2, FZ - 0.002), (0.01, H - PL - 0.06, 0.006), "metal_dark")
m.lod(2)
m.box((0, PL + (H - PL) / 2, 0), (W, H - PL, D), PAINT)
m.box((0, PL / 2, 0.01), (W - 0.04, PL, D - 0.06), "metal_dark")
m.lod(0)

m.finish(lods=[0.5, 0.15], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
