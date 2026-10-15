"""kit_wood_roof — single-slope (shed) roof for one 3 x 3 cell, ~3 x 1.5 x 3 m, rising toward -Z.
Sits on the wall tops (origin at base centre = wall-top height). Exactly 3.0 wide in X so cells tile side by
side; eaves overhang 0.15 m front and back. Rafters under lapped weathered boards.
Collider: stepped boxes along the slope (the runtime reads colliders as AABBs).
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

RISE = 1.5
OH = 0.15  # eave overhang in z
SLOPE = math.atan2(RISE, 3.0)
DEG = math.degrees(SLOPE)
m = vlib.Builder("kit_wood_roof")


def y_at(z):  # rafter top line: y = 0 at z = +1.5, RISE at z = -1.5
    return (1.5 - z) * RISE / 3.0


def roof(lod):
    z0, z1 = 1.5 + OH, -1.5 - OH
    t = 0.1  # rafter depth
    # rafters (x = edges + middle) as sloped extrusions
    prof = [(z0, y_at(z0)), (z0, y_at(z0) + t), (z1, y_at(z1) + t), (z1, y_at(z1))]
    xs = (-1.44, 0.0, 1.44) if lod < 2 else ()
    for x in xs:
        m.extrude(prof, 0.12, "wood_dark", axis="x", center=(x, 0, 0), bevel=0.015 if lod == 0 else 0)
    # sheathing / boards
    base = t
    if lod == 0:
        n = 7
        ln = math.hypot(z0 - z1, y_at(z1) - y_at(z0)) / n
        for i in range(n):  # lapped rows from the eave (+Z) up
            f = (i + 0.5) / n
            z = z0 + (z1 - z0) * f
            y = y_at(z) + base + 0.025 + 0.012 * (i % 2)
            m.box((0, y, z), (3.0, 0.03, ln + 0.03), "wood_weathered", rot=(DEG + 2.0, 0, 0))
        m.extrude([(z0, y_at(z0) + base), (z0, y_at(z0) + base + 0.02), (z1, y_at(z1) + base + 0.02),
                   (z1, y_at(z1) + base)], 2.98, "wood_dark", axis="x")  # underlay (no see-through)
    else:
        m.extrude([(z0, y_at(z0) + base), (z0, y_at(z0) + base + 0.05), (z1, y_at(z1) + base + 0.05),
                   (z1, y_at(z1) + base)], 3.0, "wood_weathered", axis="x")
    if lod == 2:  # make up for the missing rafters
        m.extrude([(z0, y_at(z0)), (z0, y_at(z0) + t), (z1, y_at(z1) + t), (z1, y_at(z1))], 3.0, "wood_dark",
                  axis="x")


for lod in (0, 1, 2):
    m.lod(lod)
    roof(lod)
m.lod(0)
STEPS = 6
for i in range(STEPS):
    za, zb = 1.5 + OH - (3.0 + 2 * OH) * i / STEPS, 1.5 + OH - (3.0 + 2 * OH) * (i + 1) / STEPS
    ya, yb = y_at(za), y_at(zb) + 0.17
    m.collider_box((0, (ya + yb) / 2, (za + zb) / 2), (3.0, yb - ya, za - zb))
m.finish(lods=[0.5, 0.15])
m.export()
m.preview()
m.sheet()
m.report()
