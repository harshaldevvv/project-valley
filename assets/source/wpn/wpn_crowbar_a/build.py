"""wpn_crowbar_a — 0.75 m hex-bar crowbar (wrecking bar), faded red paint worn to bare steel at both ends.
Same frame as wpn_knife_a (attaches to the FP arms' SOCKET_knife / SOCKET_grip with identity):
origin at the grip centre, the bar runs along -Z out of the thumb side, the gooseneck hook curls toward -Y
(the knife's edge side = the striking side). Straight chisel end behind the hand at +Z.
Sockets: grip (origin), tip (hook's outer curve, the strike point for melee traces).
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

R = 0.0115  # hex bar "radius"
Z0, Z1 = 0.13, -0.53  # straight end, start of the gooseneck
HOOK = 0.065  # gooseneck radius
m = vlib.Builder("wpn_crowbar_a")


def rod(p, q, sw, r=R, seg=6):
    """Hex rod between two (y, z) points in the YZ plane."""
    (y0, z0), (y1, z1) = p, q
    dy, dz = y1 - y0, z1 - z0
    ln = math.hypot(dy, dz)
    m.lathe([(r, -ln / 2 - 0.002), (r, ln / 2 + 0.002)], sw, center=(0, (y0 + y1) / 2, (z0 + z1) / 2), segments=seg,
            axis="z", rot=(math.degrees(math.atan2(-dy, dz)), 0, 0))


def bar(seg, arc_n):
    rod((0, Z0 - 0.06), (0, Z1), "paint_red_faded", seg=seg)
    rod((0, Z0), (0, Z0 - 0.06), "metal_bare", seg=seg)  # worn end
    # straight end: flattened chisel with a slight bend toward -Y
    m.extrude([(Z0 - 0.005, 0.009), (Z0 + 0.05, 0.002), (Z0 + 0.055, -0.006), (Z0 - 0.005, -0.009)], 0.022,
              "metal_bare", axis="x")
    # gooseneck: arc in YZ around (y = -HOOK, z = Z1), ending pointing back toward +Z
    pts = [(-HOOK + HOOK * math.cos(a), Z1 - HOOK * math.sin(a))
           for a in (math.pi * 1.1 * i / arc_n for i in range(arc_n + 1))]
    for i, (p, q) in enumerate(zip(pts, pts[1:])):
        rod(p, q, "metal_bare" if i >= arc_n - 2 else "paint_red_faded", seg=seg)
    # split claw at the hook tip
    ty, tz = pts[-1]
    for sx in (-1, 1):
        m.box((sx * 0.006, ty - 0.004, tz + 0.025), (0.008, 0.012, 0.05), "metal_bare", rot=(-15, 0, 0))


bar(6, 7)
m.lod(1)
bar(4, 4)
m.lod(0)
m.socket("grip", (0, 0, 0))
m.socket("tip", (0, -HOOK, Z1 - HOOK))
m.finish(lods=[0.5], collider="box")
m.export()
m.preview()
m.sheet(figure=False)
m.report()
