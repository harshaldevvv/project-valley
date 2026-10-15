"""env_pedestal_a — round concrete display pedestal with one step, 3 m dia x 0.4 m."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

m = vlib.Builder("env_pedestal_a")


def body(seg, chamfer=True):
    c = 0.04 if chamfer else 0.0
    m.lathe([(1.5, 0.0), (1.5, 0.2 - c), (1.5 - c, 0.2), (0, 0.2)], "concrete", segments=seg)
    m.lathe([(1.22, 0.2), (1.22, 0.4 - c), (1.22 - c, 0.4), (0, 0.4)], "concrete", segments=seg)


body(32)
m.lathe([(1.505, 0.0), (1.505, 0.07), (0, 0.07)], "concrete_dark", segments=32)  # splash band
m.lathe([(1.0, 0.401), (1.0, 0.405), (0.96, 0.405), (0.96, 0.401)], "metal_dark", segments=32, closed=True)  # inlay ring
m.lod(1)
body(16, chamfer=False)
m.lod(2)
body(10, chamfer=False)
m.lod(0)

m.finish(lods=[0.4, 0.1], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
