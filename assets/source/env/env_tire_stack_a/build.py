"""env_tire_stack_a — three stacked old car tyres, ~0.8 m dia x 0.9 m.
Each tyre is a lathed closed section (tread, shoulders, sidewalls, bead hole); slightly offset and tilted.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

TW = 0.29  # tyre width (stack height per tyre ~0.3)
SECTION = [(0.215, -0.12), (0.30, -0.145), (0.37, -0.14), (0.395, -0.11), (0.4, 0.0),
           (0.395, 0.11), (0.37, 0.14), (0.30, 0.145), (0.215, 0.12), (0.2, 0.0)]
m = vlib.Builder("env_tire_stack_a")


def stack(seg):
    for i, (dx, dz, tilt, spin) in enumerate(((0.0, 0.0, 0, 0), (0.025, -0.02, 1.5, 11), (-0.03, 0.015, -2, 23))):
        m.lathe(SECTION, "rubber_black", center=(dx, 0.145 + i * 0.295, dz), segments=seg, closed=True,
                rot=(tilt, spin, 0))


stack(14)
# dirt in the bottom tyre's well
m.cylinder((0, 0.05, 0), 0.21, 0.04, "dirt", segments=10)

m.lod(1)
stack(9)
m.lod(2)
m.lathe([(0.39, 0.0), (0.4, 0.06), (0.4, 0.83), (0.39, 0.89), (0.22, 0.89), (0, 0.89)], "rubber_black", segments=7)
m.lod(0)

m.finish(lods=[0.5, 0.15], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
