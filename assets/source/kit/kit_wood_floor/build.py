"""kit_wood_floor — upper-storey floor / ceiling, 3 x 0.2 x 3 m (origin at its base; snap so its top is
flush with the wall top, i.e. origin at wallBase + 2.8). Joists underneath, plank deck on top, rim beams.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", "tools", "blender"))
sys.path.insert(0, os.path.join(HERE, ".."))
import vlib  # noqa: E402
import kitlib as K  # noqa: E402

H = 0.2
m = vlib.Builder("kit_wood_floor")


def body(lod):
    bev = 0.02 if lod == 0 else 0
    m.box((0, 0.12, 0), (3.0, 0.04, 3.0), "wood_dark")  # sub-floor (no see-through from below)
    if lod < 2:
        for x in (-1.0, 0.0, 1.0):  # joists
            m.box((x, 0.06, 0), (0.1, 0.12, 2.8), "wood_dark", bevel=bev)
    for s in (-1, 1):  # rim beams, 1 cm below the top
        m.box((0, 0.095, s * 1.45), (3.0, 0.19, 0.1), "wood_dark", bevel=bev)
        m.box((s * 1.45, 0.095, 0), (0.1, 0.19, 2.8), "wood_dark", bevel=bev)
    K.deck(m, H, 0.06, "wood_raw", lod, extent=1.4)


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
