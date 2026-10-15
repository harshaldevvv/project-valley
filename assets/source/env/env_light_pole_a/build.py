"""env_light_pole_a — yard light pole, 0.3 m base x 6 m, with a cobra-head lamp on a 0.9 m arm over -Z.
Concrete footing, bolted base plate, tapered galvanised pole, lens in light_warm (SOCKET_light at the lens).
Collider covers the pole only (the arm is overhead).
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

H = 6.0
ARM = 0.9
m = vlib.Builder("env_light_pole_a")


def pole(seg, detail=True):
    m.lathe([(0.15, 0.0), (0.15, 0.22), (0.13, 0.25), (0, 0.25)], "concrete", segments=seg)  # footing
    m.box((0, 0.26, 0), (0.24, 0.02, 0.24), "metal_dark", bevel=0.005 if detail else 0)
    m.lathe([(0.075, 0.27), (0.06, 0.6), (0.045, H - 0.2), (0.04, H)], "metal_bare", segments=seg)
    if detail:  # base collar
        m.lathe([(0.085, 0.27), (0.085, 0.36), (0.07, 0.39), (0, 0.39)], "metal_bare", segments=seg)
    # arm: horizontal tube + slight upsweep, toward -Z
    m.cylinder((0, H - 0.12, -ARM / 2), 0.03, ARM, "metal_bare", segments=6, axis="z")
    m.box((0, H - 0.22, -0.22), (0.03, 0.03, 0.45), "metal_bare", rot=(-28, 0, 0))  # brace
    # cobra head: extruded side profile along x, lens below
    head = [(-ARM - 0.32, H - 0.13), (-ARM - 0.28, H - 0.03), (-ARM + 0.05, H - 0.04), (-ARM + 0.12, H - 0.1),
            (-ARM + 0.1, H - 0.17), (-ARM - 0.3, H - 0.19)]
    m.extrude(head, 0.26, "metal_dark", axis="x", bevel=0.015 if detail else 0)
    m.extrude([(-ARM - 0.27, H - 0.185), (-ARM + 0.06, H - 0.165), (-ARM + 0.02, H - 0.21), (-ARM - 0.24, H - 0.215)],
              0.2, "light_warm", axis="x")


pole(10)
for x in (-1, 1):  # anchor bolts
    for z in (-1, 1):
        m.cylinder((x * 0.095, 0.285, z * 0.095), 0.012, 0.03, "rust", segments=6)
m.box((0, 1.3, -0.065), (0.07, 0.16, 0.012), "metal_dark", bevel=0.003)  # access hatch
m.socket("light", (0, H - 0.21, -ARM - 0.1))

m.lod(1)
pole(6, detail=False)
m.lod(2)
m.box((0, 0.13, 0), (0.28, 0.26, 0.28), "concrete")
m.box((0, H / 2, 0), (0.1, H, 0.1), "metal_bare")
m.box((0, H - 0.12, -ARM / 2), (0.05, 0.05, ARM), "metal_bare")
m.box((0, H - 0.12, -ARM - 0.1), (0.24, 0.14, 0.42), "metal_dark")
m.box((0, H - 0.2, -ARM - 0.1), (0.18, 0.02, 0.32), "light_warm")
m.lod(0)

m.collider_box((0, H / 2, 0), (0.3, H, 0.3))
m.finish(lods=[0.4, 0.1])
m.export()
m.preview()
m.sheet()
m.report()
