"""kit_wood_stairs — straight timber stair flight filling one 3 x 3 x 3 m cell, rising toward -Z.
1.4 m wide, 12 treads of 0.25 rise / 0.25 run (steep utility stairs); the top tread is flush with a floor
top at +3.0. Two stringers, open risers, handrail on the +X side.
Collider: one box per step (stepped, AABB-friendly).
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

N = 12
RISE = 3.0 / N
RUN = 3.0 / N
SW = 1.4  # stair width
SX = SW / 2 + 0.04  # stringer centre x
m = vlib.Builder("kit_wood_stairs")


def flight(lod):
    bev = 0.01 if lod == 0 else 0
    # stringers: thick sloped planks as extruded parallelograms (z, y)
    prof = [(1.5, 0.0), (1.5, 0.2), (-1.3, 3.0), (-1.5, 3.0), (-1.5, 2.75), (1.25, 0.0)]  # follows the nosings
    for s in (-1, 1):
        m.extrude(prof, 0.08, "wood_dark", axis="x", center=(s * SX, 0, 0), bevel=0.02 if lod == 0 else 0)
    if lod == 2:
        m.extrude([(1.5, 0.0), (-1.5, 3.0), (-1.5, 2.96), (1.5, -0.04)], SW, "wood_raw", axis="x")
        m.extrude([(1.5, 0.25), (-1.5, 3.0), (-1.5, 2.75)], SW, "wood_raw", axis="x")
        return
    for i in range(N):
        ytop = RISE * (i + 1)
        z = 1.5 - RUN * (i + 0.5)
        m.box((0, ytop - 0.025, z), (SW, 0.05, RUN + 0.03), "wood_raw", bevel=bev)
    if lod == 0:  # handrail on +X: two posts + sloped rail
        for zz, yy in ((1.3, 0.2), (-1.3, 2.9)):
            m.box((SX + 0.06, yy + 0.5, zz), (0.07, 1.0, 0.07), "wood_dark", bevel=0.01)
        ln = math.hypot(2.6, 2.7)
        m.box((SX + 0.06, 2.52, 0), (0.06, 0.06, ln), "wood_dark",
              rot=(math.degrees(math.atan2(2.7, 2.6)), 0, 0))


for lod in (0, 1, 2):
    m.lod(lod)
    flight(lod)
m.lod(0)
for i in range(N):
    ytop = RISE * (i + 1)
    m.collider_box((0, ytop / 2, 1.5 - RUN * (i + 0.5)), (SW + 0.2, ytop, RUN))
m.finish(lods=[0.5, 0.15])
m.export()
m.preview()
m.sheet()
m.report()
