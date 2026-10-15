"""env_barrier_jersey_a — concrete Jersey barrier, 2 x 0.8 x 0.6 m, long axis X.
Classic safety-shape section (75 mm toe, break at 330 mm, narrow top), hazard bands on the upper slope,
fake drainage slots at the base, rusty connector loops at both ends.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

L, H = 2.0, 0.8
# section (z, y), symmetric
HALF = [(0.3, 0.0), (0.3, 0.075), (0.2, 0.33), (0.1, H)]
SEC = [(z, y) for z, y in HALF] + [(-z, y) for z, y in reversed(HALF)]
m = vlib.Builder("env_barrier_jersey_a")


def zat(y):
    for (z0, y0), (z1, y1) in zip(HALF, HALF[1:]):
        if y0 <= y <= y1:
            return z0 + (z1 - z0) * (y - y0) / (y1 - y0)


m.extrude(SEC, L, "concrete", axis="x", bevel=0.03)
# hazard bands: thin shell over the upper slope + top, alternating yellow / black
e = 0.004
ys = 0.5
band = [(zat(ys) + e, ys), (0.1 + e, H + e), (-0.1 - e, H + e), (-zat(ys) - e, ys)]
n = 8
for i in range(n):
    w = (L - 0.12) / n
    x = -L / 2 + 0.06 + w * (i + 0.5)
    m.extrude(band, w, "hazard_yellow" if i % 2 == 0 else "hazard_black", axis="x", center=(x, 0, 0))
# base weathering + drainage slots
m.extrude([(0.3 + e, 0), (0.3 + e, 0.075), (0.27 + e, 0.15), (-0.27 - e, 0.15), (-0.3 - e, 0.075), (-0.3 - e, 0)],
          L - 0.04, "concrete_dark", axis="x")
for x in (-0.5, 0.5):
    m.box((x, 0.05, 0), (0.3, 0.07, 0.62), "asphalt")
# connector loops
for sx in (-1, 1):
    for y in (0.25, 0.55):
        m.box((sx * (L / 2 + 0.03), y, 0), (0.06, 0.04, 0.1), "rust", bevel=0.008)

m.lod(1)
m.extrude(SEC, L, "concrete", axis="x")
for i in range(4):
    w = (L - 0.12) / 4
    x = -L / 2 + 0.06 + w * (i + 0.5)
    m.extrude(band, w, "hazard_yellow" if i % 2 == 0 else "hazard_black", axis="x", center=(x, 0, 0))
m.lod(2)
m.extrude(SEC, L, "concrete", axis="x")
m.extrude(band, L * 0.5, "hazard_yellow", axis="x")
m.lod(0)

m.finish(lods=[0.4, 0.1], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
