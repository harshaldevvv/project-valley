"""kit_wood_foundation — timber foundation platform, 3 x 0.5 x 3 m (top at y = 0.5).
Log skirt beams on all sides, corner posts that run 1 m below ground (so it never floats on slopes; the
collider is only the 3 x 0.5 x 3 block), plank deck on top.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", "tools", "blender"))
sys.path.insert(0, os.path.join(HERE, ".."))
import vlib  # noqa: E402
import kitlib as K  # noqa: E402

H = 0.5
SK = 0.2  # skirt beam thickness
m = vlib.Builder("kit_wood_foundation")


def body(lod):
    bev = K.BEV if lod == 0 else 0
    m.box((0, (H - 0.06) / 2 - 0.25, 0), (2.9, H - 0.06 + 0.5, 2.9), "wood_dark")  # hidden core, sinks in
    for s in (-1, 1):  # skirt: two stacked beams per side
        for y in ((0.12, 0.33) if lod == 0 else (H / 2 - 0.03,)):
            hh = 0.2 if lod == 0 else H - 0.06
            m.box((0, y, s * (1.5 - SK / 2)), (2.6, hh, SK), "wood_weathered", bevel=bev)
            m.box((s * (1.5 - SK / 2), y, 0), (SK, hh, 2.6), "wood_weathered", bevel=bev)
    for x in (-1, 1):  # corner posts down to -1 m
        for z in (-1, 1):
            m.box((x * 1.35, (H - 0.04 - 1.0) / 2, z * 1.35), (0.3, H - 0.04 + 1.0, 0.3), "wood_dark", bevel=bev)
    K.deck(m, H, 0.06, "wood_raw", lod, extent=1.5)


for lod in (0, 1, 2):
    m.lod(lod)
    body(lod)
m.lod(0)
m.collider_box((0, H / 2, 0), (3.0, H, 3.0))
m.finish(lods=[0.5, 0.15])
m.export()
m.preview()
m.sheet()
m.report()
