"""zmb_shambler_a — shambling zombie, same 1.80 m contract rig as chr_survivor_a. Torn faded shirt, ripped jeans,
one bare foot, grey-green bruised skin, dried blood. Procedural (vrig). The hunch lives in the clips, not the rest pose.
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vrig  # noqa: E402
from vrig import ANK, blend, gait, keys, smooth, stance  # noqa: E402

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

# =============================================================================== clips (z_*)
S2 = math.sin
TAU = 2 * math.pi


def z_idle(t):
    b_, s_ = S2(TAU * t / 3), S2(TAU * t / 3 + 0.8)
    P = stance(dx=0.02 * s_, stagger=0.12, z=-0.06, w=0.13, toe_out=14)
    P.update(fRy=-4, hipR=(-8, 3 * s_, 4 * s_), spine=(-14, 0, 3 * s_), chest=(-12 + 1.5 * b_, 4, -3 * s_), neck=(8, 0, 0),
             head=(16 + 3 * b_, 14 + 4 * s_, 6 * S2(TAU * t / 1.5)), shR=(0, 7, 0), shL=(0, -3, 6),
             aR=(10 + 3 * s_, 6, 25 + 4 * b_), aL=(22 - 3 * s_, 10, 38 + 3 * b_))
    return P


ZWALK = dict(v=1.2, T=1.0, duty=0.6, duty_R=0.66, duty_L=0.58, off_L=0.55, w=0.11, lift=0.09, lift_R=0.025, drag_R=1.0,
             reach=0.03, hs=10, hs_R=0.0, to=18, to_R=8, hip_z=-0.07, lean=30, roll=7, yaw=8, sway=0.045, nod=3,
             arms=(30, 8, 30, 10, 12))
ZRUN = dict(v=4.5, T=19 / 30, duty=0.32, w=0.1, lift=0.28, lpk=0.4, k0=0.15, reach=0.02, hs=4, to=22, hip_z=-0.07, comp=0.03,
            lean=30, roll=6, yaw=12, sway=0.02, nod=2, arms=(55, 25, 30, 20, 20))


def z_walk(t):
    P = gait(t, ZWALK)
    ph = TAU * t / ZWALK["T"]
    P["aR"] = (55 + 6 * S2(ph), 8, 18, 0)  # right arm reaching
    P["aL"] = (8 - 14 * math.cos(ph - 0.6), 10, 30 + 10 * S2(ph - 1.0))  # left arm dangling, lagging swing
    P["head"] = (P["head"][0] + 10, 12 + 6 * S2(ph), 6 * S2(ph + 0.5))
    P["shR"] = (0, -4, 8)
    return P


def z_run(t):
    P = gait(t, ZRUN)
    ph = TAU * t / ZRUN["T"]
    P["aR"] = (70 + 22 * math.cos(ph), 18, 25 + 15 * S2(ph))
    P["aL"] = (75 - 22 * math.cos(ph + 0.4), 22, 30 - 15 * S2(ph))
    P["head"] = (P["head"][0] + 14, 6 * S2(ph), 0)
    return P


IDLE0 = z_idle(0)


def z_attack(t):  # 0.6 s telegraphed wind-up, swipe lands ~0.72 s
    up = dict(aR=(150, 30, 70), aL=(140, 34, 75), chest=(12, 0, -14), spine=(6, 0, -6), head=(4, 8, 0), hip=(0, -0.06, -0.08))
    return {**IDLE0, **keys(t, [
        (0.0, {k: IDLE0[k] for k in ("aR", "aL", "chest", "spine", "head", "hip")}, 0),
        (0.45, up, 0.3),
        (0.6, {**up, "aR": (158, 32, 72), "chest": (14, 0, -16)}, 0),
        (0.72, dict(aR=(35, 8, 12), aL=(55, 14, 20), chest=(-32, 0, 18), spine=(-16, 0, 8), head=(24, 4, 0), hip=(0, 0.1, -0.12)), 0),
        (0.82, dict(aR=(5, 12, 30), aL=(25, 16, 30), chest=(-30, 0, 22), spine=(-16, 0, 10), head=(22, 6, 0), hip=(0, 0.1, -0.12)), 0),
        (1.1, {k: IDLE0[k] for k in ("aR", "aL", "chest", "spine", "head", "hip")}, 0)])}


def z_grab(t):  # lunge, clutch, bite
    base = {k: IDLE0[k] for k in ("aR", "aL", "chest", "spine", "neck", "head", "hip")}
    reach = dict(aR=(88, 6, 8, 0), aL=(88, 6, 8, 0), chest=(-22, 0, 0), spine=(-14, 0, 0), neck=(10, 0, 0), head=(16, 0, 0), hip=(0, 0.1, -0.1))
    clutch = dict(aR=(72, -6, 80, 30), aL=(72, -6, 80, 30), chest=(-20, 0, 0), spine=(-12, 0, 0), neck=(14, 0, 0), head=(14, 0, 0), hip=(0, 0.08, -0.1))
    bite = {**clutch, "chest": (-30, 0, 0), "neck": (24, 0, 0), "head": (24, 0, 0), "hip": (0, 0.12, -0.12)}
    return {**IDLE0, **keys(t, [(0.0, {**base, "aR": (*base["aR"], 0), "aL": (*base["aL"], 0)}, 0), (0.25, reach, 0.4), (0.45, clutch, 0),
                                (0.7, bite, 0), (0.8, {**bite, "head": (26, 0, 10)}), (0.9, {**bite, "head": (26, 0, -10)}),
                                (1.2, {**base, "aR": (*base["aR"], 0), "aL": (*base["aL"], 0)}, 0)])}


def z_hit(t):
    base = {k: IDLE0[k] for k in ("chest", "spine", "head", "hip", "aR", "aL")}
    hit = dict(chest=(4, 6, 10), spine=(0, 0, 4), head=(-14, 20, -12), hip=(0, -0.05, -0.07), aR=(25, 30, 40), aL=(30, 28, 45))
    return {**IDLE0, **keys(t, [(0.0, base, 0), (0.07, hit, 0), (0.4, base, 0)])}


def z_stagger(t):
    base = {k: IDLE0[k] for k in ("chest", "spine", "head", "hip", "aR", "aL", "fR", "fL", "fRp", "fLp")}
    back = dict(chest=(18, 0, 6), spine=(10, 0, 0), head=(-10, 18, 0), hip=(0, -0.1, -0.05), aR=(55, 45, 30), aL=(40, 50, 40))
    step1 = {**back, "fR": (0.13, -0.22, ANK + 0.08), "fRp": 10, "hip": (0, -0.14, -0.06)}
    step1b = {**back, "fR": (0.13, -0.3, ANK), "fRp": 0, "hip": (0, -0.16, -0.08), "chest": (8, 0, 4)}
    step2 = {**step1b, "fL": (-0.13, -0.18, ANK + 0.07), "fLp": 8, "chest": (-4, 0, 0), "aR": (30, 30, 30)}
    return {**IDLE0, **keys(t, [(0.0, base, 0), (0.12, back, 0.4), (0.3, step1, 0.5), (0.42, step1b, 0), (0.6, step2, 0.5),
                                (0.75, {**step2, "fL": (-0.13, -0.26, ANK), "fLp": 0}, 0), (1.0, base, 0)])}


def z_death(t):  # buckle to the knees, topple face down
    return keys(t, [
        (0.0, dict(hip=(0, 0, -0.06), hipR=(-8, 0, 0), spine=(-14, 0, 0), chest=(-12, 4, 0), neck=(8, 0, 0), head=(16, 14, 0),
                   lR=(4, 4, 8, -4), lL=(-4, 4, 8, -4), aR=(10, 6, 25), aL=(22, 10, 38)), 0),
        (0.35, dict(hip=(0, -0.05, -0.42), hipR=(-5, 0, 6), spine=(-6, 0, 0), chest=(-4, 0, 0), head=(-10, 20, 0),
                    lR=(10, 6, 115, 20), lL=(4, 8, 118, 22), aR=(5, 15, 15), aL=(8, 15, 20))),
        (0.5, dict(hip=(0, -0.02, -0.5), hipR=(-15, 0, 8), lR=(18, 6, 125, 30), lL=(10, 8, 128, 30), aR=(20, 20, 20), aL=(25, 18, 25)), 0.6),
        (0.9, dict(hip=(0, 0.25, -0.75), hipR=(-60, 4, 12), spine=(-6, 0, 0), chest=(-4, 0, 0), head=(10, 10, 0), lR=(-20, 8, 70, 30), lL=(-25, 10, 75, 30),
                   aR=(60, 30, 30), aL=(65, 28, 35)), 0.8),
        (1.1, dict(hip=(0, 0.42, -0.84), hipR=(-88, 4, 12), spine=(0, 0, 0), chest=(0, 0, 0), head=(20, 0, 30), lR=(-4, 8, 3, 60), lL=(-6, 10, 6, 60),
                   aR=(10, 70, 30), aL=(20, 60, 50)), 0),
        (1.22, dict(hip=(0, 0.42, -0.82), head=(16, 0, 34)), 0.5),
        (1.5, dict(hip=(0, 0.42, -0.84), head=(20, 0, 40), aR=(8, 75, 35), aL=(18, 62, 55)), 0)])


CRAWL_T, CRAWL_V = 1.6, 0.6


def z_crawl(t):  # prone, dragging itself with the arms; hands planted move back at CRAWL_V (no sliding)
    ph = (t / CRAWL_T) % 1.0
    P = dict(space="world", hip=(0, -0.38, -0.8), hipR=(-84, 0, 4 * math.cos(TAU * ph)), spine=(10, 0, -4 * math.cos(TAU * ph)),
             chest=(10 + 2 * S2(TAU * ph), 4 * S2(TAU * ph), -4 * math.cos(TAU * ph)), neck=(25, 0, 0), head=(32, 8 * S2(TAU * ph), 0),
             lR=(-6, 8, 2 + 3 * S2(TAU * ph), 60), lL=(-6, 10, 4 - 3 * S2(TAU * ph), 60))
    duty = 0.6
    y0, y1 = 0.62, 0.62 - CRAWL_V * duty * CRAWL_T
    for X, s, off in (("R", 1, 0.0), ("L", -1, 0.5)):
        psi = (ph - off) % 1.0
        if psi < duty:
            y, z = y0 + (y1 - y0) * psi / duty, 0.045
        else:
            u = (psi - duty) / (1 - duty)
            y, z = y1 + (y0 - y1) * smooth(u), 0.045 + 0.16 * S2(math.pi * u)
        P.update({"g" + X: (s * 0.24, y, z), "g" + X + "f": (s * 0.3, 1, -0.4), "g" + X + "u": (-s, 0, 0.3), "e" + X: (s, -0.3, 0.6)})
    return P


CLIPS = [("z_idle", 3.0, z_idle, True), ("z_walk", ZWALK["T"], z_walk, True), ("z_run", ZRUN["T"], z_run, True),
         ("z_attack", 1.1, z_attack, False), ("z_grab", 1.2, z_grab, False), ("z_hit", 0.4, z_hit, False),
         ("z_stagger", 1.0, z_stagger, False), ("z_death", 1.5, z_death, False), ("z_crawl", CRAWL_T, z_crawl, True)]


def cyc(T, n=6):
    return [round(T * i / n, 4) for i in range(n)]


SHEETS = {  # `blender -b --python build.py -- --sheets 1`
    "turnaround": [(None, [0], y, 8, 3.3, 0.92) for y in (0, 90, 180, 35)] + [(None, [0], 25, 5, 0.9, 1.68), (None, [0], 0, 8, 3.3, 0.92, None, 1),
                                                                            (None, [0], 0, 8, 3.3, 0.92, None, 2), ("z_idle", [0], 180, 22, 2.6, 1.3)],
    "clips": [("z_idle", [0, 1.5], 30, 8, 3.3, 0.9), ("z_walk", cyc(ZWALK["T"]), 90, 8, 3.3, 0.9), ("z_walk", cyc(ZWALK["T"], 3), 0, 8, 3.3, 0.9),
              ("z_run", cyc(ZRUN["T"]), 90, 8, 3.3, 0.9), ("z_attack", [0.3, 0.6, 0.72, 0.82], 40, 8, 3.3, 0.9),
              ("z_grab", [0.25, 0.45, 0.7], 90, 8, 3.3, 0.9), ("z_hit", [0.07], 30, 8, 3.3, 0.9), ("z_stagger", [0.12, 0.3, 0.6], 90, 8, 3.3, 0.9),
              ("z_death", [0.35, 0.5, 0.9, 1.5], 90, 15, 3.4, 0.6), ("z_crawl", cyc(CRAWL_T, 4), 90, 15, 3.4, 0.4)],
}

if __name__ == "__main__":
    for name, dur, fn, loop in CLIPS:
        ch.clip(name, dur, fn, loop)
    if "--sheets" in sys.argv:
        vrig.preview_sheets(ch, CLIPS, SHEETS)
    ch.export()
    ch.report()
