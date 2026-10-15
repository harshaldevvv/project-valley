"""env_bench_shooting_a — standing shooting bench, 2 x 0.9 x 0.8 m.
Five-plank top on 4x4 legs, aprons, X-brace at the back, lower shelf with an ammo can.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

W, H, D = 2.0, 0.9, 0.8
TOP = 0.05
LX, LZ = W / 2 - 0.12, D / 2 - 0.1
m = vlib.Builder("env_bench_shooting_a")

pw = D / 5
for i in range(5):
    z = -D / 2 + pw * (i + 0.5)
    m.box((0, H - TOP / 2, z), (W, TOP, pw - 0.008), "wood_raw", bevel=0.01)
for x in (-LX, LX):
    for z in (-LZ, LZ):
        m.box((x, (H - TOP) / 2, z), (0.09, H - TOP, 0.09), "wood_weathered", bevel=0.012)
for z in (-LZ - 0.055, LZ + 0.055):  # long aprons
    m.box((0, H - TOP - 0.06, z), (2 * LX + 0.09, 0.12, 0.025), "wood_dark", bevel=0.008)
for x in (-LX, LX):  # short aprons + shelf bearers
    m.box((x, H - TOP - 0.06, 0), (0.025, 0.12, 2 * LZ), "wood_dark", bevel=0.008)
    m.box((x, 0.22, 0), (0.06, 0.06, 2 * LZ + 0.09), "wood_dark", bevel=0.008)
for i in range(4):  # shelf slats
    z = -LZ + 0.04 + (2 * LZ - 0.08) / 3 * i
    m.box((0, 0.265, z), (2 * LX - 0.03, 0.025, 0.1), "wood_raw", bevel=0.006)
# X-brace on the back (+Z)
m.box((0, 0.5, LZ + 0.06), (2 * LX * 1.05, 0.06, 0.025), "wood_dark", rot=(0, 0, 17))
m.box((0, 0.5, LZ + 0.08), (2 * LX * 1.05, 0.06, 0.025), "wood_dark", rot=(0, 0, -17))
# ammo can on the shelf
m.box((0.45, 0.37, 0.0), (0.28, 0.18, 0.15), "military_olive", bevel=0.012)
m.box((0.45, 0.47, 0.0), (0.12, 0.02, 0.03), "metal_dark")
m.box((0.45, 0.38, -0.077), (0.12, 0.05, 0.004), "stencil_white")
# rest block on the top (front edge)
m.box((-0.55, H + 0.03, -0.18), (0.18, 0.06, 0.22), "wood_dark", bevel=0.012)

m.lod(1)
m.box((0, H - TOP / 2, 0), (W, TOP, D), "wood_raw")
for x in (-LX, LX):
    for z in (-LZ, LZ):
        m.box((x, (H - TOP) / 2, z), (0.09, H - TOP, 0.09), "wood_weathered")
m.box((0, H - TOP - 0.06, 0), (2 * LX + 0.09, 0.12, 2 * LZ + 0.11), "wood_dark")
m.box((0, 0.265, 0), (2 * LX, 0.04, 2 * LZ), "wood_raw")
m.box((0.45, 0.37, 0.0), (0.28, 0.18, 0.15), "military_olive")
m.box((-0.55, H + 0.03, -0.18), (0.18, 0.06, 0.22), "wood_dark")
m.lod(2)
m.box((0, H - 0.07, 0), (W, 0.14, D), "wood_raw")
for x in (-LX, LX):
    for z in (-LZ, LZ):
        m.box((x, (H - 0.14) / 2, z), (0.1, H - 0.14, 0.1), "wood_weathered")
m.box((0, 0.265, 0), (2 * LX, 0.04, 2 * LZ), "wood_raw")
m.lod(0)

m.finish(lods=[0.5, 0.15], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
