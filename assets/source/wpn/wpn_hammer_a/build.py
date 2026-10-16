"""wpn_hammer_a — 0.33 m wooden-handled claw hammer.
Same frame as wpn_knife_a (attaches to the FP arms' SOCKET_knife / SOCKET_grip with identity):
origin at the grip centre, handle along -Z (out of the thumb side) to the steel head; the striking face points
-Y (the knife's edge side), the curved claw +Y. Butt end at +Z.
Sockets: grip (origin), tip (centre of the striking face).
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

HZ = -0.235  # head centre z
m = vlib.Builder("wpn_hammer_a")


def hammer(seg, detail=True):
    # handle: oval, swelling at the butt, slimmer neck under the head
    m.lathe([(0.0, 0.0), (0.017, 0.0), (0.019, 0.02), (0.016, 0.07), (0.014, 0.17), (0.013, 0.31), (0.0, 0.31)],
            "wood_raw", center=(0, 0, 0.085), segments=seg, axis="z", rot=(0, 180, 0), scale=(0.75, 1, 1))
    # head: eye block, neck + round striking face (-Y), curved split claw (+Y)
    m.box((0, 0.0, HZ), (0.026, 0.04, 0.034), "metal_dark", bevel=0.004 if detail else 0)
    m.lathe([(0.0, 0.0), (0.012, 0.0), (0.013, 0.035), (0.016, 0.04), (0.016, 0.055), (0.0, 0.056)], "metal_bare",
            center=(0, -0.018, HZ), segments=seg, axis="y", rot=(180, 0, 0))
    claw = [(0.018, -0.017), (0.018, 0.017), (0.04, 0.03), (0.065, 0.05), (0.078, 0.05), (0.07, 0.035),
            (0.05, 0.012), (0.04, -0.005), (0.035, -0.017)]  # (y, dz): thick root, tapering curl toward the handle
    m.extrude([(HZ + z, y) for y, z in claw], 0.024, "metal_dark", axis="x", bevel=0.002 if detail else 0)
    if detail:
        m.box((0, 0.0, HZ + 0.018), (0.03, 0.044, 0.004), "metal_bare")  # wedge plate
    m.lathe([(0.0175, 0.0), (0.0175, 0.012)], "metal_dark", center=(0, 0, 0.074), segments=seg, axis="z",
            scale=(0.75, 1, 1))  # ferrule ring at the butt


hammer(8)
m.lod(1)
hammer(5, detail=False)
m.lod(0)
m.socket("grip", (0, 0, 0))
m.socket("tip", (0, -0.074, HZ))
m.finish(lods=[0.5], collider="box")
m.export()
m.preview()
m.sheet(figure=False)
m.report()
