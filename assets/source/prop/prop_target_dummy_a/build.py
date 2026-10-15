"""prop_target_dummy_a — wooden mannequin practice dummy on a post, 0.6 x 1.8 x 0.4 m.
Plank cross base, post, chamfered block torso/hips/head, stub arms, a paper target pinned on the chest
(faces -Z). SOCKET_hit at the target centre.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

m = vlib.Builder("prop_target_dummy_a")


def body(bev, detail=True):
    m.box((0, 0.04, 0), (0.6, 0.08, 0.1), "wood_weathered", bevel=bev)  # base cross
    m.box((0, 0.04, 0), (0.1, 0.08, 0.4), "wood_weathered", bevel=bev)
    m.box((0, 0.5, 0), (0.07, 0.9, 0.07), "wood_dark", bevel=bev)  # post
    m.extrude([(-0.15, 0.0), (0.15, 0.0), (0.13, 0.18), (-0.13, 0.18)], 0.18, "wood_raw", axis="z",
              center=(0, 0.92, 0), bevel=bev)  # hips
    m.extrude([(-0.14, 0.0), (0.14, 0.0), (0.2, 0.38), (0.17, 0.48), (-0.17, 0.48), (-0.2, 0.38)], 0.2, "wood_raw",
              axis="z", center=(0, 1.12, 0), bevel=bev)  # torso
    m.box((0, 1.63, 0), (0.06, 0.06, 0.06), "wood_dark")  # neck
    m.box((0, 1.72, 0), (0.16, 0.16, 0.17), "wood_raw", bevel=bev * 2)  # head
    for sx in (-1, 1):  # stub arms hanging slightly outward
        m.box((sx * 0.22, 1.42, 0), (0.08, 0.3, 0.08), "wood_raw", bevel=bev, rot=(0, 0, sx * 12))
        if detail:
            m.box((sx * 0.205, 1.585, 0), (0.06, 0.06, 0.06), "metal_dark")  # bolt hinge


body(0.01)
# paper target + tape on the chest (front -Z)
m.box((0, 1.38, -0.103), (0.2, 0.22, 0.004), "paper")
m.box((0, 1.38, -0.106), (0.1, 0.1, 0.003), "cloth_red")
m.box((0, 1.38, -0.108), (0.035, 0.035, 0.003), "paper")
m.box((0, 1.5, -0.105), (0.24, 0.03, 0.004), "cloth_khaki")
m.box((0, 0.98, 0.0), (0.31, 0.04, 0.19), "cloth_black")  # strap round the hips
for x, y in ((0.07, 1.3), (-0.05, 1.45), (0.11, 1.18)):  # splintered hit marks
    m.box((x, y, -0.102), (0.025, 0.025, 0.004), "wood_dark")
m.socket("hit", (0, 1.38, -0.11))

m.lod(1)
body(0, detail=False)
m.box((0, 1.38, -0.103), (0.2, 0.22, 0.004), "paper")
m.lod(2)
m.box((0, 0.04, 0), (0.6, 0.08, 0.4), "wood_weathered")
m.box((0, 0.5, 0), (0.07, 0.9, 0.07), "wood_dark")
m.box((0, 1.2, 0), (0.34, 0.6, 0.2), "wood_raw")
m.box((0, 1.72, 0), (0.16, 0.16, 0.17), "wood_raw")
m.lod(0)

m.finish(lods=[0.5, 0.15], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
