"""zmb_shambler_a — shambling zombie, same 1.80 m contract rig as chr_survivor_a. Torn faded shirt, ripped jeans,
one bare foot, grey-green bruised skin, dried blood. Procedural (vrig). The hunch lives in the clips, not the rest pose.
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vrig  # noqa: E402
from vrig import blend, smooth  # noqa: E402

ID = "zmb_shambler_a"
SKIN, BRUISE, SHIRT, JEANS, SHOE, HAIR = "zombie_skin", "zombie_bruise", "paint_blue_faded", "cloth_denim", "leather_brown", "hair_dark"
BLOOD, MEAT = "blood_dry", "gore_meat"

ch = vrig.Character(ID)
b = ch.body


def h(c, k=1):  # deterministic per-face hash in [0, 1)
    return (math.sin(c.x * 127.1 * k + c.y * 311.7 + c.z * 74.7) * 43758.5453) % 1.0


TW = [(0.86, dict(hips=1)), (0.97, dict(hips=1)), (1.07, dict(hips=0.5, spine=0.5)), (1.17, dict(spine=1)),
      (1.28, dict(spine=0.35, chest=0.65)), (1.36, dict(chest=1)), (1.50, dict(chest=1)), (1.56, dict(chest=0.5, neck=0.5))]


def torso_w(c):
    w = blend(c.z, TW)
    k = smooth((abs(c.x) - 0.11) / 0.07) * smooth((c.z - 1.34) / 0.1) * 0.65
    if k > 0:
        w = {n: x * (1 - k) for n, x in w.items()}
        w["shoulder_R" if c.x > 0 else "shoulder_L"] = k
    return w


R = lambda z, rx, rf, rb, sw, y=0.0, **kw: dict(c=(0, y, z), r=(rx, rf, rb), sw=sw, **kw)  # noqa: E731
# thinner, gaunt torso; ragged shirt hem over a strip of bare belly
b.loft([R(0.84, 0.10, 0.07, 0.075, JEANS), R(0.92, 0.158, 0.095, 0.11, JEANS), R(0.97, 0.15, 0.09, 0.1, SKIN),
        R(1.02, 0.148, 0.09, 0.1, SKIN), R(1.02, 0.162, 0.1, 0.11, SHIRT, jag=0.025), R(1.12, 0.155, 0.1, 0.105, SHIRT),
        R(1.24, 0.168, 0.11, 0.105, SHIRT), R(1.35, 0.178, 0.112, 0.102, SHIRT), R(1.44, 0.176, 0.1, 0.095, SHIRT),
        R(1.50, 0.125, 0.074, 0.078, SHIRT), R(1.53, 0.075, 0.058, 0.06, SHIRT)], n=10, sq=2.5, w=torso_w)
b.loft([dict(c=(0, 0, 1.49), r=0.048), dict(c=(0, 0.012, 1.63), r=0.046)], n=8, sw=SKIN, cap0=False, cap1=False,
       w=lambda c: blend(c.z, [(1.52, dict(chest=0.5, neck=0.5)), (1.6, dict(neck=1)), (1.63, dict(neck=0.4, head=0.6))]))
HW = dict(head=1)
# head: sunken cheeks, slack open jaw (chin dropped + forward)
b.loft([R(1.565, 0.04, 0.03, 0.03, SKIN, y=0.06), R(1.605, 0.06, 0.07, 0.055, SKIN, y=0.035), R(1.655, 0.068, 0.09, 0.085, SKIN, y=0.015),
        R(1.70, 0.079, 0.098, 0.095, SKIN, y=0.01), R(1.745, 0.079, 0.095, 0.1, SKIN, y=0.004), R(1.785, 0.062, 0.07, 0.084, SKIN, y=-0.006)],
       n=10, sq=2.3, w=HW, cap1=0.018)
b.box((0, 0.108, 1.682), (0.024, 0.026, 0.04), SKIN, HW, bevel=0.006)  # nose
b.box((0, 0.088, 1.625), (0.07, 0.02, 0.03), MEAT, HW)  # open mouth
b.box((0, 0.098, 1.638), (0.055, 0.008, 0.012), "teeth", HW)
for s in (1, -1):
    b.box((s * 0.081, -0.005, 1.69), (0.016, 0.032, 0.048), SKIN, HW, bevel=0.005)
    b.box((s * 0.032, 0.097, 1.703), (0.022, 0.01, 0.012), "eye_glow_zombie", HW)
# patchy hair, bruises, blood
b.paint(lambda c, n: c.z > 1.72 + 0.05 * smooth((c.y + 0.01) / 0.09) and abs(c.x) < 0.075 and h(c) > 0.35, HAIR, only={SKIN})
b.paint(lambda c, n: h(c, 3) > 0.8, BRUISE, only={SKIN})
b.paint(lambda c, n: c.z < 1.62 and c.z > 1.55 and c.y > 0.02, BLOOD, only={SKIN})  # chin / throat
b.paint(lambda c, n: c.y > 0.05 and c.x < 0.02 and 1.05 < c.z < 1.3 and h(c, 7) > 0.45, BLOOD, only={SHIRT})
b.paint(lambda c, n: c.y < -0.05 and c.x > 0.0 and 1.1 < c.z < 1.25 and h(c, 5) > 0.6, BLOOD, only={SHIRT})

# arms: right short sleeve torn, left sleeve ripped off at the shoulder (bite wound)
for X, s in vrig.SIDES:
    sh, el, wr, _ = vrig._arm(s)
    d = (el - sh).normalized()
    P = lambda t: tuple(sh + d * t)  # noqa: E731
    up, fo, ha, shd = f"upper_arm_{X}", f"forearm_{X}", f"hand_{X}", f"shoulder_{X}"
    sleeve_end = 0.15 if s > 0 else 0.04
    rings = [dict(c=P(-0.05), r=0.056, w={shd: 0.5, up: 0.5}, sw=SHIRT), dict(c=P(sleeve_end), r=0.058, w={up: 1}, sw=SKIN, jag=0.018),
             dict(c=P(sleeve_end), r=0.045, w={up: 1}, sw=SKIN), dict(c=P(0.26), r=0.04, w={up: 0.7, fo: 0.3}, sw=SKIN),
             dict(c=P(0.30), r=0.039, w={up: 0.4, fo: 0.6}, sw=SKIN), dict(c=P(0.36), r=0.04, w={fo: 1}, sw=SKIN),
             dict(c=P(0.50), r=0.03, w={fo: 1}, sw=SKIN), dict(c=P(0.555), r=0.025, w={fo: 0.4, ha: 0.6}, sw=SKIN)]
    b.loft(rings, n=8, cap1=False)
    vrig.hand(b, s, SKIN)
    if s < 0:
        b.box(tuple(sh + d * 0.1 + vrig.Vector((0, 0.035, 0.0))), (0.05, 0.02, 0.06), MEAT, {up: 1})  # bite wound

    x = s * 0.095
    th, sn = f"thigh_{X}", f"shin_{X}"
    legs = [dict(c=(x * 0.9, 0, 0.97), r=0.082, w={"hips": 0.5, th: 0.5}), dict(c=(x, 0, 0.86), r=0.083, w={th: 1}),
            dict(c=(x, 0.0, 0.70), r=(0.07, 0.07, 0.068), w={th: 1}), dict(c=(x, 0.006, 0.555), r=0.058, w={th: 0.75, sn: 0.25}),
            dict(c=(x, 0.008, 0.505), r=0.057, w={th: 0.5, sn: 0.5})]
    if s > 0:  # right jeans leg torn off below the knee: bare shin and foot
        legs += [dict(c=(x, 0.004, 0.42), r=0.058, w={sn: 1}, jag=0.03, sw=SKIN), dict(c=(x, 0.004, 0.42), r=0.046, w={sn: 1}, sw=SKIN),
                 dict(c=(x, -0.004, 0.3), r=(0.045, 0.04, 0.05), w={sn: 1}, sw=SKIN), dict(c=(x, 0, 0.12), r=0.035, w={sn: 1}, sw=SKIN)]
        b.loft(legs, n=8, sw=JEANS, cap1=False)
        vrig.boot(b, s, SKIN, SKIN, top=0.13, r_top=0.036)
    else:
        legs += [dict(c=(x, 0.004, 0.45), r=0.056, w={sn: 1}), dict(c=(x, -0.004, 0.33), r=(0.055, 0.05, 0.06), w={sn: 1}),
                 dict(c=(x, 0, 0.17), r=0.06, w={sn: 1}, jag=0.02)]
        b.loft(legs, n=8, sw=JEANS, cap1=False)
        vrig.boot(b, s, SHOE, "rubber_black", top=0.2, r_top=0.05)
b.paint(lambda c, n: c.z < 0.75 and c.y > 0.04 and h(c, 11) > 0.6, "mud", only={JEANS})

ch.finish(lods=(0.5, 0.2))

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "_shared"))
from zclips import CLIPS, SHEETS  # noqa: E402

if __name__ == "__main__":
    for name, dur, fn, loop in CLIPS:
        ch.clip(name, dur, fn, loop)
    if "--sheets" in sys.argv:
        vrig.preview_sheets(ch, CLIPS, SHEETS)
    ch.export()
    ch.report()
