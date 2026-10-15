"""prop_target_plate_a — steel silhouette (IPSC-style) target plate on a stand, 0.6 x 1.8 x 0.3 m.
Origin at ground centre, plate faces -Z, hung plumb. SOCKET_hit at the A-zone centre.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

PY = 1.0  # plate bottom
PLATE = [(-0.225, 0.0), (0.225, 0.0), (0.225, 0.5), (0.15, 0.62), (0.08, 0.62), (0.08, 0.8), (-0.08, 0.8),
         (-0.08, 0.62), (-0.15, 0.62), (-0.225, 0.5)]
TILT = 0  # hung plumb; tilting needs the marks rotated with it
m = vlib.Builder("prop_target_plate_a")


def stand(bev):
    m.box((0, 0.03, 0), (0.6, 0.06, 0.08), "metal_dark", bevel=bev)  # base bar
    m.box((0, 0.03, 0), (0.08, 0.06, 0.3), "metal_dark", bevel=bev)  # cross foot
    m.box((0, PY / 2 + 0.03, 0.03), (0.05, PY + 0.05, 0.05), "metal_dark", bevel=bev)  # upright
    m.box((0, PY + 0.06, 0.02), (0.14, 0.1, 0.03), "metal_dark", bevel=bev)  # mount bracket


stand(0.008)
for sx in (-1, 1):  # gussets
    m.extrude([(0, 0), (0.12, 0), (0, 0.18)], 0.01, "metal_dark", axis="z", center=(sx * 0.025, 0.06, 0.03),
              rot=(0, 0 if sx > 0 else 180, 0))
m.extrude(PLATE, 0.012, "paint_white_faded", axis="z", center=(0, PY, -0.004), bevel=0.003, rot=(TILT, 0, 0))
# hit marks (bare steel splashes) and A-zone outline
for x, y in ((0.05, 0.3), (-0.08, 0.42), (0.12, 0.16), (-0.02, 0.7), (0.0, 0.33)):
    m.cylinder((x, PY + y, -0.012), 0.018, 0.004, "metal_bare", segments=6, axis="z")
m.box((0, PY + 0.33, -0.0115), (0.15, 0.25, 0.002), "paint_red_faded")
m.socket("hit", (0, PY + 0.33, -0.012))

m.lod(1)
stand(0)
m.extrude(PLATE, 0.012, "paint_white_faded", axis="z", center=(0, PY, -0.004), rot=(TILT, 0, 0))
m.box((0, PY + 0.33, -0.0115), (0.15, 0.25, 0.002), "paint_red_faded")
m.lod(2)
m.box((0, 0.03, 0), (0.6, 0.06, 0.08), "metal_dark")
m.box((0, PY / 2, 0.03), (0.05, PY, 0.05), "metal_dark")
m.extrude(PLATE, 0.02, "paint_white_faded", axis="z", center=(0, PY, -0.004))
m.lod(0)

m.finish(lods=[0.5, 0.15], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
