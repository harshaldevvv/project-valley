"""Shared low-poly zombie body for zmb_* variants (same contract skeleton as zmb_shambler_a; proportions live in
the mesh, height in Character.finish(scale=...)). Each variant's build.py calls build(ch, **cfg) then adds gear."""
import math

import vrig
from vrig import Vector, blend, smooth

SKIN, BRUISE, BLOOD, MEAT = "zombie_skin", "zombie_bruise", "blood_dry", "gore_meat"
TW = [(0.86, dict(hips=1)), (0.97, dict(hips=1)), (1.07, dict(hips=0.5, spine=0.5)), (1.17, dict(spine=1)),
      (1.28, dict(spine=0.35, chest=0.65)), (1.36, dict(chest=1)), (1.50, dict(chest=1)), (1.56, dict(chest=0.5, neck=0.5))]
HW = dict(head=1)


def h(c, k=1):
    """Deterministic per-face hash in [0, 1)."""
    return (math.sin(c.x * 127.1 * k + c.y * 311.7 + c.z * 74.7) * 43758.5453) % 1.0


def torso_w(c):
    w = blend(c.z, TW)
    k = smooth((abs(c.x) - 0.11) / 0.07) * smooth((c.z - 1.34) / 0.1) * 0.65
    if k > 0:
        w = {n: x * (1 - k) for n, x in w.items()}
        w["shoulder_R" if c.x > 0 else "shoulder_L"] = k
    return w


def R(z, rx, rf, rb, sw, y=0.0, **kw):
    return dict(c=(0, y, z), r=(rx, rf, rb), sw=sw, **kw)


def build(ch, shirt, pants, shoes=("leather_brown", "leather_brown"), sleeves=(0.15, 0.15), pants_end=(0.17, 0.17),
          shoulder=1.0, hip=1.0, chest=1.0, bust=0.0, hair="hair_dark", hair_style="patchy", belly=True, boot_top=0.2, limb=1.0):
    """sleeves: sleeve length from the shoulder per side (R, L) in m (0.53 = full, None = ripped off).
    pants_end: hem height per leg (z, m). shoes: swatch per foot (R, L) or None for a bare foot."""
    b = ch.body
    sx, hx = shoulder, hip
    hem = R(1.02, 0.162 * hx, 0.1, 0.11, shirt, jag=0.025)
    rings = [R(0.84, 0.10 * hx, 0.07, 0.075, pants), R(0.92, 0.158 * hx, 0.095, 0.11, pants)]
    rings += [R(0.97, 0.15 * hx, 0.09, 0.1, SKIN), R(1.02, 0.148 * hx, 0.09, 0.1, SKIN), hem] if belly else \
             [R(0.98, 0.155 * hx, 0.093, 0.104, shirt), R(0.98, 0.16 * hx, 0.098, 0.108, shirt)]
    rings += [R(1.12, 0.152 * (hx + 1) / 2, 0.1, 0.105, shirt), R(1.24, 0.166 * chest, 0.11 + bust * 0.5, 0.105, shirt),
              R(1.33, 0.176 * chest, 0.112 + bust, 0.102, shirt), R(1.44, 0.176 * sx, 0.1, 0.095, shirt),
              R(1.50, 0.125 * sx, 0.074, 0.078, shirt), R(1.53, 0.075, 0.058, 0.06, shirt)]
    b.loft(rings, n=10, sq=2.5, w=torso_w)
    b.loft([dict(c=(0, 0, 1.49), r=0.046), dict(c=(0, 0.012, 1.63), r=0.044)], n=8, sw=SKIN, cap0=False, cap1=False,
           w=lambda c: blend(c.z, [(1.52, dict(chest=0.5, neck=0.5)), (1.6, dict(neck=1)), (1.63, dict(neck=0.4, head=0.6))]))
    b.loft([R(1.565, 0.04, 0.03, 0.03, SKIN, y=0.06), R(1.605, 0.058, 0.07, 0.055, SKIN, y=0.035), R(1.655, 0.066, 0.09, 0.085, SKIN, y=0.015),
            R(1.70, 0.077, 0.097, 0.095, SKIN, y=0.01), R(1.745, 0.078, 0.095, 0.1, SKIN, y=0.004), R(1.785, 0.061, 0.07, 0.084, SKIN, y=-0.006)],
           n=10, sq=2.3, w=HW, cap1=0.018)
    b.box((0, 0.107, 1.682), (0.023, 0.025, 0.04), SKIN, HW, bevel=0.006)
    b.box((0, 0.088, 1.625), (0.066, 0.02, 0.03), MEAT, HW)
    b.box((0, 0.098, 1.638), (0.052, 0.008, 0.012), "teeth", HW)
    for s in (1, -1):
        b.box((s * 0.079, -0.005, 1.69), (0.016, 0.032, 0.046), SKIN, HW, bevel=0.005)
        b.box((s * 0.031, 0.096, 1.703), (0.021, 0.01, 0.012), "eye_glow_zombie", HW)
    if hair_style == "patchy":
        b.paint(lambda c, n: c.z > 1.72 + 0.05 * smooth((c.y + 0.01) / 0.09) and abs(c.x) < 0.075 and h(c) > 0.35, hair, only={SKIN})
    elif hair_style == "long":  # hair shell over the skull falling to the shoulders, matted
        b.paint(lambda c, n: c.z > 1.655 + 0.11 * smooth((c.y + 0.01) / 0.09) and abs(c.x) < 0.077, hair, only={SKIN})
        b.loft([dict(c=(0, -0.01, 1.80), r=(0.07, 0.07, 0.08)), dict(c=(0, -0.03, 1.72), r=(0.092, 0.06, 0.1)),
                dict(c=(0, -0.05, 1.62), r=(0.098, 0.035, 0.085), jag=0.02), dict(c=(0, -0.06, 1.5), r=(0.11, 0.02, 0.06), jag=0.035)],
               n=8, sw=hair, w=lambda c: blend(c.z, [(1.52, dict(neck=0.6, head=0.4)), (1.62, dict(head=1))]), cap0=0.012, cap1=True,
               fwd=(0, 1, 0), side=(1, 0, 0))
    b.paint(lambda c, n: h(c, 3) > 0.8, BRUISE, only={SKIN})
    b.paint(lambda c, n: 1.55 < c.z < 1.62 and c.y > 0.02, BLOOD, only={SKIN})
    b.paint(lambda c, n: c.y > 0.05 and c.x < 0.02 and 1.05 < c.z < 1.3 and h(c, 7) > 0.5, BLOOD, only={shirt})

    for (X, s), slen, pend, shoe in zip(vrig.SIDES, sleeves, pants_end, shoes):
        sh, el, wr, _ = vrig._arm(s)
        d = (el - sh).normalized()
        P = lambda t: tuple(sh + d * t)  # noqa: E731
        up, fo, ha, shd = f"upper_arm_{X}", f"forearm_{X}", f"hand_{X}", f"shoulder_{X}"
        W = lambda t: {up: 1} if t < 0.26 else {up: 0.4, fo: 0.6} if t < 0.33 else {fo: 1}  # noqa: E731
        r_arm = lambda t: (0.058 if t < 0.05 else 0.05 - 0.035 * t / 0.55) * (sx + 1) / 2 * limb + (0.006 if slen and t <= slen else 0)  # noqa: E731
        rings = [dict(c=P(-0.05), r=0.056 * (sx + 1) / 2, w={shd: 0.5, up: 0.5}, sw=shirt if slen is not None else SKIN)]
        ts = sorted({0.04, 0.16, 0.27, 0.30, 0.36, 0.50, 0.555} | ({slen} if slen else set()))
        for t in ts:
            ring = dict(c=P(t), r=r_arm(t), w=W(t) if t < 0.55 else {fo: 0.4, ha: 0.6}, sw=shirt if slen and t < slen else SKIN)
            rings.append(ring)
            if slen and abs(t - slen) < 1e-6 and slen < 0.5:  # torn cuff: step in to the bare arm
                rings[-1]["jag"] = 0.015
                rings.append(dict(c=P(t), r=r_arm(t) - 0.012, w=W(t), sw=SKIN))
        b.loft(rings, n=8, cap1=False)
        vrig.hand(b, s, SKIN)

        x = s * 0.095 * (hx + 1) / 2
        th, sn = f"thigh_{X}", f"shin_{X}"
        LW = lambda z: blend(z, [(0.45, {sn: 1}), (0.505, {th: 0.5, sn: 0.5}), (0.555, {th: 0.75, sn: 0.25}), (0.6, {th: 1})])  # noqa: E731
        RL = lambda z: limb * (0.083 * hx if z > 0.8 else 0.07 * (hx + 1) / 2 if z > 0.6 else 0.058 if z > 0.48 else 0.054 if z > 0.3 else 0.042)  # noqa: E731
        zs = [0.86, 0.70, 0.555, 0.505, 0.45, 0.33, 0.2]
        legs = [dict(c=(x * 0.9, 0, 0.97), r=0.082 * hx, w={"hips": 0.5, th: 0.5}, sw=pants)]
        for z in zs:
            if z < pend:
                break
            legs.append(dict(c=(x, 0.004, z), r=RL(z) + 0.004, w=LW(z), sw=pants))
        legs.append(dict(c=(x, 0.004, pend), r=RL(pend) + 0.004, w=LW(pend), sw=SKIN, jag=0.015))
        if pend > 0.22:  # bare leg below the hem
            legs.append(dict(c=(x, 0.004, pend), r=RL(pend) - 0.008, w=LW(pend), sw=SKIN))
            legs += [dict(c=(x, 0.0, z), r=RL(z) - 0.01, w=LW(z), sw=SKIN) for z in zs if z < pend - 0.03]
            legs.append(dict(c=(x, 0, 0.12), r=0.034, w={sn: 1}, sw=SKIN))
        b.loft(legs, n=8, cap1=False)
        if shoe:
            vrig.boot(b, s, shoe, "rubber_black", top=boot_top, r_top=0.05)
        else:
            vrig.boot(b, s, SKIN, SKIN, top=0.13, r_top=0.034)
    return b


def dome(b, c, rx, rz, sw, rim=0.0, rim_sw=None, y=0.0):
    """Helmet / hard-hat shell (weighted to the head)."""
    cx, cy, cz = c
    b.loft([dict(c=(cx, cy + y, cz), r=(rx, rx * 1.12, rx * 1.18)), dict(c=(cx, cy, cz + rz * 0.6), r=(rx * 0.85, rx * 0.95, rx * 1.0)),
            dict(c=(cx, cy, cz + rz), r=(rx * 0.35, rx * 0.4, rx * 0.4))], n=10, sw=sw, w=HW, cap0=True, cap1=0.01)
    if rim:
        b.loft([dict(c=(cx, cy + y + rim * 0.4, cz), r=(rx + rim, rx * 1.12 + rim * 1.6, rx * 1.18 + rim)),
                dict(c=(cx, cy + y + rim * 0.4, cz + 0.012), r=(rx + rim, rx * 1.12 + rim * 1.6, rx * 1.18 + rim))],
               n=10, sw=rim_sw or sw, w=HW)


def finish_variant(ch, scale):
    """Mesh-only variant: clips are shared from zmb_shambler_a (identical skeleton)."""
    import sys
    from zclips import CLIPS, SHEETS
    ch.finish(lods=(0.5, 0.2), scale=scale)
    if "--sheets" in sys.argv:
        vrig.preview_sheets(ch, CLIPS, {"turnaround": SHEETS["turnaround"],
                                        "clips": [r for r in SHEETS["clips"] if r[0] in ("z_walk", "z_attack")]})
    ch.export(animations=False)
    ch.report()


__all__ = ["build", "dome", "finish_variant", "h", "Vector", "HW", "TW", "SKIN", "BLOOD"]
