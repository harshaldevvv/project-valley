"""chr_survivor_a — player survivor, 1.80 m: olive field jacket, jeans, boots, backpack. Procedural (vrig).
Run: blender --background --python build.py [-- --sheet 1]   (sheet = also render pose preview sheets)
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402
import vrig  # noqa: E402
from vrig import blend, smooth  # noqa: E402

ID = "chr_survivor_a"
SKIN, JACKET, JEANS, BOOT, SOLE, HAIR = "skin_3", "cloth_olive", "cloth_denim", "leather_brown", "rubber_black", "hair_dark"
PACK, STRAP, TRIM = "cloth_khaki", "cloth_black", "military_olive"

ch = vrig.Character(ID)
b = ch.body

# ---------------- torso (jeans pelvis -> jacket -> collar)
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
b.loft([R(0.84, 0.10, 0.07, 0.075, JEANS), R(0.92, 0.165, 0.10, 0.115, JEANS), R(0.99, 0.155, 0.095, 0.105, JACKET),
        R(0.99, 0.172, 0.112, 0.12, JACKET), R(1.09, 0.163, 0.108, 0.11, JACKET), R(1.23, 0.175, 0.118, 0.112, JACKET),
        R(1.35, 0.185, 0.122, 0.108, JACKET), R(1.44, 0.182, 0.105, 0.098, JACKET), R(1.50, 0.13, 0.078, 0.08, JACKET),
        R(1.535, 0.08, 0.062, 0.062, JACKET)], n=10, sq=2.6, w=torso_w)
# collar + neck + head
b.loft([R(1.5, 0.088, 0.07, 0.07, JACKET, y=-0.005), R(1.575, 0.078, 0.06, 0.068, JACKET, y=-0.01)], n=8, cap0=False, cap1=False,
       w=lambda c: blend(c.z, [(1.5, dict(chest=1)), (1.58, dict(chest=0.4, neck=0.6))]))
b.loft([dict(c=(0, 0, 1.49), r=0.052), dict(c=(0, 0.012, 1.63), r=0.05)], n=8, sw=SKIN, cap0=False, cap1=False,
       w=lambda c: blend(c.z, [(1.52, dict(chest=0.5, neck=0.5)), (1.6, dict(neck=1)), (1.63, dict(neck=0.4, head=0.6))]))
HW = dict(head=1)
b.loft([R(1.585, 0.042, 0.03, 0.03, SKIN, y=0.05), R(1.62, 0.066, 0.068, 0.06, SKIN, y=0.03), R(1.665, 0.077, 0.092, 0.085, SKIN, y=0.015),
        R(1.705, 0.081, 0.098, 0.095, SKIN, y=0.01), R(1.75, 0.08, 0.096, 0.1, SKIN, y=0.004), R(1.787, 0.063, 0.072, 0.084, SKIN, y=-0.006)],
       n=10, sq=2.3, w=HW, cap1=0.018)
b.box((0, 0.112, 1.683), (0.026, 0.028, 0.045), SKIN, HW, bevel=0.006)  # nose
for s in (1, -1):
    b.box((s * 0.083, -0.005, 1.69), (0.016, 0.034, 0.05), SKIN, HW, bevel=0.005)  # ears
    b.box((s * 0.033, 0.1, 1.705), (0.024, 0.01, 0.011), HAIR, HW)  # eyes
b.paint(lambda c, n: c.z > 1.655 + 0.105 * smooth((c.y + 0.01) / 0.09) and abs(c.x) < 0.079, HAIR, only={SKIN})

# ---------------- arms (sleeves with cuffs) + hands
for X, s in vrig.SIDES:
    sh, el, wr, _ = vrig._arm(s)
    d = (el - sh).normalized()
    P = lambda t: tuple(sh + d * t)  # noqa: E731
    up, fo, ha, shd = f"upper_arm_{X}", f"forearm_{X}", f"hand_{X}", f"shoulder_{X}"
    b.loft([dict(c=P(-0.05), r=0.06, w={shd: 0.5, up: 0.5}), dict(c=P(0.03), r=0.063, w={up: 1}), dict(c=P(0.16), r=0.054, w={up: 1}),
            dict(c=P(0.27), r=0.05, w={up: 0.7, fo: 0.3}), dict(c=P(0.30), r=0.049, w={up: 0.4, fo: 0.6}), dict(c=P(0.35), r=0.047, w={fo: 1}),
            dict(c=P(0.50), r=0.046, w={fo: 1}, sw=TRIM), dict(c=P(0.535), r=0.046, w={fo: 1}, sw=SKIN), dict(c=P(0.535), r=0.028, w={fo: 0.7, ha: 0.3}),
            dict(c=P(0.555), r=0.027, w={fo: 0.4, ha: 0.6})], n=8, sw=JACKET, cap1=False)
    vrig.hand(b, s, SKIN)

    # legs (jeans over boot tops) + boots
    x = s * 0.095
    th, sn = f"thigh_{X}", f"shin_{X}"
    b.loft([dict(c=(x * 0.9, 0, 0.97), r=0.085, w={"hips": 0.5, th: 0.5}), dict(c=(x, 0, 0.86), r=0.086, w={th: 1}),
            dict(c=(x, 0.0, 0.70), r=(0.072, 0.072, 0.07), w={th: 1}), dict(c=(x, 0.006, 0.555), r=0.059, w={th: 0.75, sn: 0.25}),
            dict(c=(x, 0.008, 0.505), r=0.058, w={th: 0.5, sn: 0.5}), dict(c=(x, 0.004, 0.45), r=0.056, w={sn: 1}),
            dict(c=(x, -0.004, 0.33), r=(0.056, 0.05, 0.063), w={sn: 1}), dict(c=(x, 0, 0.19), r=0.064, w={sn: 1})],
           n=8, sw=JEANS, cap1=False)
    vrig.boot(b, s, BOOT, SOLE, top=0.25, r_top=0.056)

# ---------------- backpack (separate skinned node chr_survivor_a_BACKPACK: hidden when no pack is equipped),
# straps (part of the pack), jacket details
PW = lambda c: blend(c.z, [(1.05, dict(spine=0.6, chest=0.4)), (1.25, dict(chest=1))])  # noqa: E731
body = b
b = ch.part("BACKPACK")
b.box((0, -0.205, 1.25), (0.30, 0.15, 0.36), PACK, PW, bevel=0.025)
b.box((0, -0.20, 1.42), (0.28, 0.17, 0.05), TRIM, PW, bevel=0.015)  # lid
b.box((0, -0.29, 1.2), (0.2, 0.04, 0.16), TRIM, PW, bevel=0.012)  # front pocket
b.loft([dict(c=(-0.16, -0.19, 1.04), r=0.05), dict(c=(0.16, -0.19, 1.04), r=0.05)], n=8, side=(0, 1, 0), fwd=(0, 0, 1), sw="cloth_grey", w=PW)
for s in (1, -1):
    for path in ([(s * 0.10, 0.128, 1.12), (s * 0.108, 0.13, 1.3), (s * 0.115, 0.075, 1.47), (s * 0.12, -0.035, 1.505), (s * 0.11, -0.135, 1.42)],):
        rings = [dict(c=p, r=(0.022, 0.006, 0.006)) for p in path]
        b.loft(rings, n=4, sq=8, rot=math.pi / 4, sw=STRAP, w=PW, fwd=None, side=(1, 0, 0))
b = body
for s in (1, -1):
    b.box((s * 0.08, 0.124, 1.33), (0.075, 0.016, 0.085), TRIM, dict(chest=1), bevel=0.006)  # chest pockets
    b.box((s * 0.115, 0.11, 1.06), (0.08, 0.02, 0.07), TRIM, dict(hips=0.5, spine=0.5), bevel=0.006)  # hip pockets
b.box((0, 0.124, 1.22), (0.012, 0.008, 0.48), "metal_dark", lambda c: blend(c.z, TW))  # zipper

ch.finish(lods=(0.5, 0.2))

# =============================================================================== clips
from vrig import ANK, ankle_at, gait, keys, stance, wpt  # noqa: E402

S2 = math.sin
TAU = 2 * math.pi


def norm(v):
    m = math.sqrt(sum(x * x for x in v))
    return tuple(x / m for x in v)


def idle(t):
    b_, s_ = S2(TAU * t / 3), S2(TAU * t / 3 + 1.2)
    P = stance(dx=0.014 * s_, stagger=0.05)
    P.update(hipR=(0, -1.5 * s_, 2 * s_), spine=(0, 0.8 * s_, 0), chest=(0.8 * b_, 0.5 * s_, -1.2 * s_),
             head=(-1 + b_, 0, 4 * S2(2 * TAU * t / 3)), shR=(0, -1.2 * b_, 0), shL=(0, -1.2 * b_, 0),
             aR=(4 + 1.5 * b_, 9, 14 + 3 * b_), aL=(3 + 1.5 * b_, 9, 12 + 3 * b_))
    return P


IDLE0 = idle(0)
IK0 = {**ch.arm_ik(IDLE0, "R"), **ch.arm_ik(IDLE0, "L")}

WALK = dict(v=1.6, T=0.8, duty=0.6, w=0.085, lift=0.08, reach=0.03, hs=14, to=24, hip_z=-0.005, lean=3,
            arms=(2, 16, 14, 18, 8), yaw=7, roll=3, sway=0.02)
RUN = dict(v=3.5, T=20 / 30, duty=0.33, w=0.075, lift=0.34, lpk=0.35, reach=0.0, hs=6, to=26, hip_z=-0.035, comp=0.035,
           fly=0.015, lean=9, arms=(10, 30, 78, 18, 12), ain=10, yaw=9, roll=3, sway=0.012, k0=0.12, nod=1)
SPRINT = dict(v=5.75, T=17 / 30, duty=0.26, w=0.07, lift=0.45, lpk=0.35, reach=0.02, hs=4, to=30, hip_z=-0.04, comp=0.04,
              fly=0.02, lean=16, arms=(14, 46, 82, 22, 10), ain=12, yaw=11, roll=3, sway=0.01, k0=0.08, nod=1)
CWALK = dict(v=1.2, T=0.9, duty=0.62, w=0.12, lift=0.06, reach=0.04, hs=8, to=16, hip_z=-0.34, lean=24,
             arms=(26, 10, 52, 10, 14), yaw=5, roll=2, sway=0.02, nod=0.5)


def crouch(t):
    b_ = S2(TAU * t / 2)
    P = stance(stagger=0.22, z=-0.37, w=0.13, toe_out=10)
    P.update(hipR=(-16, 0, -4), spine=(-10, 0, 2), chest=(-6 + 0.8 * b_, 0, 2), neck=(10, 0, 0), head=(16, 0, 0),
             aR=(28 + b_, 12, 58), aL=(24 + b_, 12, 54), shR=(0, -b_, 0), shL=(0, -b_, 0))
    return P


def fall(t):
    w_ = S2(TAU * t)
    return dict(hip=(0, 0, 0.0), hipR=(-4, 0, 0), spine=(-3, 0, 0), chest=(2 + w_, 0, 0), head=(4, 0, 0),
                fR=(0.11, -0.04 + 0.03 * w_, ANK + 0.24), fL=(-0.11, 0.1 - 0.03 * w_, ANK + 0.3), fRp=-18, fLp=-10,
                tRp=-10, tLp=-5, fRy=-6, fLy=6, aR=(30 + 8 * w_, 42, 35), aL=(36 - 8 * w_, 40, 38))


# ---------- weapons: grips in chest-rest space; barrel = fingers dir f (socket -Z), top = thumb dir u (socket +Y)
FWD, UP = (0, 1, 0), (0, 0, 1)
GP = (0.02, 0.58, 1.46)  # pistol grip, aimed
GR = (0.075, 0.30, 1.555)  # rifle grip, aimed


def pistol(g=GP, f=FWD, u=UP):
    return dict(gR=g, gRf=f, gRu=u, eR=(0.7, -0.2, -1), gL=wpt(g, f, u, (-0.03, 0.005, -0.03)),
                gLf=wpt((0, 0, 0), f, u, (0.75, 0.15, 0.6)), gLu=wpt((0, 0, 0), f, u, (0, 1, 0.25)), eL=(-0.7, -0.2, -1))


def rifle(g=GR, f=FWD, u=UP, lh=(-0.005, 0.25, 0.015)):
    return dict(gR=g, gRf=f, gRu=u, eR=(1, -0.3, -0.7), gL=wpt(g, f, u, lh), gLf=wpt((0, 0, 0), f, u, (0.6, 0, 0.8)),
                gLu=f, eL=(-0.4, 0, -1))


def aim_pistol(t):
    b_ = S2(TAU * t / 2)
    P = stance(stagger=0.14, z=-0.03, w=0.13)
    P.update(spine=(-3, 0, 0), chest=(-2 + 0.6 * b_, 0, 0), neck=(2, 0, 0), head=(5, 0, 0), **pistol())
    return P


def rifle_legs():
    P = stance(stagger=0.24, z=-0.04, w=0.13, toe_out=12)
    P.update(hipR=(-3, 0, -16), spine=(-4, 0, 8), chest=(-3, 0, 8), neck=(6, 0, 0), head=(12, 8, 0), shR=(0, -6, 0))
    return P


def aim_rifle(t):
    P = rifle_legs()
    P["chest"] = (-3 + 0.6 * S2(TAU * t / 2), 0, 8)
    P.update(rifle())
    return P


def kicked(g, dy, dz, deg):
    a = math.radians(deg)
    return (g[0], g[1] + dy, g[2] + dz), (0, math.cos(a), math.sin(a)), (0, -math.sin(a), math.cos(a))


def fire_pistol(t):
    P = aim_pistol(0)
    k = keys(t, [(0, dict(**pistol(), c=0.0), 0), (0.035, dict(**pistol(*kicked(GP, -0.035, 0.035, 14)), c=2.0), 0.2),
                 (0.3, dict(**pistol(), c=0.0), 0)])
    P["chest"] = (-2 + k.pop("c"), 0, 0)
    P.update(k)
    return P


def fire_rifle(t):
    P = aim_rifle(0)
    k = keys(t, [(0, dict(**rifle(), c=0.0), 0), (0.03, dict(**rifle(*kicked(GR, -0.03, 0.012, 4)), c=3.0), 0.2),
                 (0.25, dict(**rifle(), c=0.0), 0)])
    c = k.pop("c")
    P["chest"] = (-3 + c, 0, 8)
    P["shR"] = (0, 0, -1.3 * c)
    P.update(k)
    return P


def L(g, f, u, local, a, t=(0, 1, 0), e=(-0.8, -0.3, -0.6)):
    """Left-hand key in a weapon frame: local position, fingers a and thumb t given in weapon axes."""
    return dict(gL=wpt(g, f, u, local), gLf=wpt((0, 0, 0), f, u, a), gLu=wpt((0, 0, 0), f, u, t), eL=e)


def reload_pistol(t):
    P = aim_pistol(0)
    g1, f1, u1 = (0.07, 0.30, 1.30), norm((-0.3, 0.8, 0.5)), norm((0.25, -0.45, 0.85))
    R1 = dict(gR=g1, gRf=f1, gRu=u1)
    R1b = dict(gR=(0.07, 0.30, 1.315), gRf=f1, gRu=u1)
    pouch = dict(gL=(-0.17, 0.08, 1.0), gLf=(0.1, 0.2, -1), gLu=(0, 1, 0), eL=(-1, -0.5, 0))
    k = keys(t, [
        (0.0, pistol(), 0),
        (0.3, {**R1, **L(g1, f1, u1, (-0.1, -0.05, -0.12), (0.3, 0.3, -0.9))}),
        (0.55, pouch, 0),
        (0.65, {**R1, **pouch}, 0),
        (0.95, L(g1, f1, u1, (0, -0.03, -0.17), (0.3, 0.2, 0.9)), 0.4),
        (1.06, {**R1b, **L(g1, f1, u1, (0, -0.025, -0.07), (0.3, 0.2, 0.9))}, 0),
        (1.15, {**R1, **L(g1, f1, u1, (-0.03, -0.02, -0.1), (0.3, 0.2, 0.9))}),
        (1.35, L(g1, f1, u1, (-0.01, 0.02, 0.07), (0.9, 0, -0.3)), 0),
        (1.5, {**R1, **L(g1, f1, u1, (-0.01, -0.05, 0.07), (0.9, 0, -0.3))}, 0),
        (1.9, pistol(), 0)])
    P.update(k)
    P["head"] = (5 + 12 * math.sin(math.pi * min(1, t / 1.7)), 0, 0)
    return P


def reload_rifle(t):
    P = aim_rifle(0)
    g1, f1, u1 = (0.10, 0.28, 1.30), norm((-0.15, 1, -0.12)), norm((0.6, 0, 0.8))
    R1 = dict(gR=g1, gRf=f1, gRu=u1)
    MAG = (0.5, 0.05, 0.85)
    pouch = dict(gL=(-0.07, 0.17, 1.12), gLf=(0.2, 0.3, -0.9), gLu=(0, 1, 0), eL=(-1, -0.4, -0.3))
    k = keys(t, [
        (0.0, rifle(), 0),
        (0.35, {**R1, **L(g1, f1, u1, (0, 0.11, -0.14), MAG)}, 0),
        (0.6, L(g1, f1, u1, (-0.06, 0.15, -0.32), MAG), 0.4),
        (0.72, L(g1, f1, u1, (-0.12, 0.08, -0.36), MAG)),
        (1.0, {**R1, **pouch}, 0),
        (1.1, pouch, 0),
        (1.4, L(g1, f1, u1, (0, 0.13, -0.22), MAG), 0.3),
        (1.52, {**R1, **L(g1, f1, u1, (0, 0.11, -0.12), MAG)}, 0),
        (1.6, dict(gR=(g1[0], g1[1], g1[2] + 0.012), gRf=f1, gRu=u1), 0),
        (1.68, R1, 0),
        (1.86, L(g1, f1, u1, (0.06, 0.12, 0.06), (0.8, 0, -0.6)), 0),
        (2.0, {**R1, **L(g1, f1, u1, (0.06, 0.0, 0.06), (0.8, 0, -0.6))}, 0),
        (2.4, rifle(), 0)])
    P.update(k)
    P["head"] = (8 + 14 * math.sin(math.pi * min(1, t / 2.2)), 5, 0)
    return P


def ik_stance(**kw):
    P = stance(stagger=0.18, z=-0.04, w=0.13, toe_out=10)
    P.update(kw)
    return P


def melee_swing(t):  # knife: blade along the thumb axis (socket +Y)
    ready = dict(gR=(0.2, 0.3, 1.2), gRf=norm((0, 1, 0.3)), gRu=norm((0, -0.3, 1)), eR=(1, -0.5, -0.6), chest=(-4, 0, 0),
                 spine=(-4, 0, 0), hip=(0, 0, -0.05))
    k = keys(t, [
        (0.0, ready, 0),
        (0.16, dict(gR=(0.33, 0.06, 1.42), gRf=norm((0.2, 0.6, 0.8)), gRu=norm((0.4, -0.5, 0.7)), chest=(-2, 0, -22), spine=(-2, 0, -8), hip=(0, -0.02, -0.04)), 0),
        (0.27, dict(gR=(-0.12, 0.46, 1.12), gRf=norm((-0.6, 0.6, -0.2)), gRu=norm((-0.7, 0.5, -0.3)), chest=(-8, 0, 22), spine=(-6, 0, 10), hip=(0, 0.05, -0.08)), 0.8),
        (0.38, dict(gR=(-0.24, 0.26, 0.96), gRf=norm((-0.5, 0.3, -0.8)), gRu=norm((-0.6, -0.4, -0.6)), chest=(-10, 0, 28), spine=(-6, 0, 12), hip=(0, 0.04, -0.08)), 0),
        (0.7, ready, 0)])
    return ik_stance(aL=(40, 14, 75), **k)


def melee_heavy(t):  # two-handed bat / axe, head along socket +Y; left hand below the right on the handle
    def pose(g, u, f, **kw):
        f, u = norm(f), norm(u)
        return dict(gR=g, gRf=f, gRu=u, eR=(1, -0.4, -0.7), gL=wpt(g, f, u, (0, 0, -0.1)), gLf=f, gLu=u, eL=(-1, -0.2, -0.6), **kw)
    ready = pose((0.16, 0.26, 1.15), (0.1, -0.3, 1), (0, 1, 0.3), chest=(-4, 0, 0), spine=(-3, 0, 0), hip=(0, 0, -0.05))
    k = keys(t, [
        (0.0, ready, 0),
        (0.38, pose((0.13, 0.0, 1.62), (0.15, -0.8, 0.5), (0, 0.5, 0.85), chest=(6, 0, -12), spine=(4, 0, -6), hip=(0, -0.04, -0.03)), 0),
        (0.5, pose((0.08, 0.3, 1.5), (0, 0.3, 1), (0, 1, -0.3), chest=(-6, 0, -4), spine=(-6, 0, -2), hip=(0, 0.02, -0.06)), 1.0),
        (0.58, pose((0.03, 0.45, 1.4), (0, 1, 0.1), (0, -0.1, 1), chest=(-10, 0, 2), spine=(-8, 0, 0), hip=(0, 0.06, -0.12)), 0.6),
        (0.72, pose((0.0, 0.38, 1.0), (0, 0.6, -0.8), (0, 0.8, 0.6), chest=(-22, 0, 4), spine=(-16, 0, 0), hip=(0, 0.06, -0.14)), 0),
        (1.1, ready, 0)])
    return ik_stance(**k)


def shove(t):
    def hands(y, z, **kw):
        return dict(gR=(0.13, y, z), gRf=(0, 0.3, 1), gRu=(-1, 0, 0), eR=(1, -0.6, -0.5),
                    gL=(-0.13, y, z), gLf=(0, 0.3, 1), gLu=(1, 0, 0), eL=(-1, -0.6, -0.5), **kw)
    rest = {**IK0, "spine": (0, 0, 0), "hip": (0, 0, -0.03)}
    k = keys(t, [(0.0, rest, 0), (0.15, hands(0.14, 1.3, spine=(4, 0, 0), hip=(0, -0.03, -0.05)), 0),
                 (0.27, hands(0.56, 1.33, spine=(-14, 0, 0), hip=(0, 0.07, -0.07)), 0),
                 (0.36, hands(0.5, 1.32, spine=(-10, 0, 0), hip=(0, 0.05, -0.06)), 0.5), (0.65, rest, 0)])
    return ik_stance(**k)


def hit_react(t):
    def k_(chest, spine, head, hip, aR, aL):
        return dict(chest=chest, spine=spine, head=head, hip=hip, aR=aR, aL=aL)
    rest = k_((0, 0, 0), (0, 0, 0), (0, 0, 0), (0, 0, -0.012), IDLE0["aR"], IDLE0["aL"])
    k = keys(t, [(0.0, rest, 0), (0.06, k_((14, 4, 8), (6, 0, 3), (16, 0, -10), (0, -0.05, -0.04), (16, 26, 35), (10, 24, 40)), 0),
                 (0.2, k_((-3, 0, -2), (-2, 0, 0), (-4, 0, 3), (0, -0.02, -0.03), (8, 14, 25), (6, 12, 22)), 0.5), (0.45, rest, 0)])
    return {**stance(stagger=0.05), **k}


def death(t):
    return keys(t, [
        (0.0, dict(hip=(0, 0, -0.012), hipR=(0, 0, 0), spine=(0, 0, 0), chest=(0, 0, 0), head=(0, 0, 0), lR=(1, 3, 2, 0), lL=(-1, 3, 2, 0), aR=(4, 9, 12), aL=(4, 9, 12)), 0),
        (0.18, dict(hip=(0, -0.03, -0.05), hipR=(3, 0, 6), chest=(16, 0, 10), head=(20, 0, 0), lR=(6, 3, 16, -6), lL=(-4, 3, 20, -4), aR=(20, 30, 30), aL=(15, 28, 35))),
        (0.55, dict(hip=(0, -0.06, -0.36), hipR=(12, 0, 10), spine=(8, 0, 0), chest=(10, 0, 8), lR=(48, 6, 76, -22), lL=(38, 8, 80, -26), aR=(35, 40, 40), aL=(30, 42, 45))),
        (0.9, dict(hip=(0, -0.36, -0.7), hipR=(60, 4, 15), spine=(6, 0, 0), chest=(14, 0, 4), head=(12, 0, 0), lR=(50, 8, 60, 0), lL=(42, 10, 70, 0), aR=(30, 70, 30), aL=(25, 72, 35)), 0.8),
        (1.08, dict(hip=(0, -0.55, -0.86), hipR=(88, 4, 15), spine=(2, 0, 0), chest=(0, 0, 0), head=(-12, 0, 0), lR=(24, 10, 34, 12), lL=(12, 12, 16, 12), aR=(8, 72, 22), aL=(4, 76, 20)), 0),
        (1.22, dict(hip=(0, -0.55, -0.83), chest=(4, 0, 0), head=(4, 0, 10)), 0.5),
        (1.8, dict(hip=(0, -0.55, -0.86), hipR=(88, 4, 15), chest=(0, 0, 0), head=(-2, 0, 35), lR=(20, 12, 30, 15), lL=(8, 14, 10, 15), aR=(0, 84, 25), aL=(6, 80, 30)), 0)])


WHEEL_C, WHEEL_R = (0, 0.40, 1.21), 0.19


def drive_sit(t):
    th = math.radians(6 * S2(TAU * t / 2.4))
    P = dict(hip=(0, -0.05, -0.52), hipR=(8, 0, 0), spine=(-4, 0, 0), chest=(-4, 0, 1.5 * S2(TAU * t / 2.4)), neck=(0, 0, 0),
             head=(0, 0, 4 * S2(TAU * t / 2.4)), lR=(80, 9, 78, 12), lL=(80, 7, 80, 12))
    for X, s in (("R", 1), ("L", -1)):
        a = math.radians(60) * s + th
        p = (WHEEL_C[0] + WHEEL_R * math.sin(a), WHEEL_C[1], WHEEL_C[2] + WHEEL_R * math.cos(a))
        tang = (-math.cos(a), 0, math.sin(a))
        P.update({"g" + X: p, "g" + X + "f": (0, 1, -0.25), "g" + X + "u": tang, "e" + X: (s, -0.3, -1)})
    return P


def interact_search(t):
    P = stance(stagger=0.18, z=-0.42, w=0.14, toe_out=12)
    P.update(space="world", hipR=(-28, 0, 0), spine=(-14, 0, 2 * S2(TAU * t / 2.4)), chest=(-10, 0, 4 * S2(TAU * t / 2.4)),
             neck=(12, 0, 0), head=(22, 0, 0))
    R_ = [(0.0, (0.12, 0.52, 0.52)), (0.6, (0.06, 0.64, 0.4)), (1.2, (0.16, 0.5, 0.58)), (1.8, (0.08, 0.6, 0.42))]
    for X, s, ph in (("R", 1, 0.0), ("L", -1, 0.6)):
        ks = sorted(((tt + ph) % 2.4, {"p": (s * x, y, z)}) for tt, (x, y, z) in R_)
        p = keys(t, ks, loop=2.4)["p"]
        P.update({"g" + X: p, "g" + X + "f": (0, 0.5, -1), "g" + X + "u": (-s, 0.3, 0), "e" + X: (s, -0.3, 0.2)})
    return P


HOLSTER = dict(gR=(0.215, 0.03, 0.95), gRf=(0, 0, -1), gRu=(0, 1, 0), eR=(0.6, -1, 0))
BACK = dict(gR=(0.14, -0.13, 1.52), gRf=norm((-0.2, -0.3, 0.9)), gRu=(0, -1, 0), eR=(1, 0, 0.6))
LIFT_P = dict(gR=(0.14, 0.24, 1.2), gRf=norm((0, 1, 0.1)), gRu=UP, eR=(0.8, -0.3, -1))
LIFT_R = dict(gR=(0.16, 0.28, 1.28), gRf=norm((0, 1, 0.35)), gRu=norm((0, -0.35, 1)), eR=(1, -0.3, -0.7))


def draw_pistol(t):  # engine: attach the pistol to SOCKET_hand_R at 0.18 s
    k = keys(t, [(0.0, IK0, 0), (0.18, {**HOLSTER, "gL": IK0["gL"]}, 0), (0.32, LIFT_P, 0.6), (0.5, pistol(), 0)])
    return {**aim_pistol(0), **k}


def holster(t):  # pistol: engine detaches at 0.32 s
    k = keys(t, [(0.0, pistol(), 0), (0.16, LIFT_P, 0.6), (0.32, {**HOLSTER, "gL": IK0["gL"]}, 0), (0.5, IK0, 0)])
    return {**aim_pistol(0), **k}


def draw_rifle(t):  # rifle slung on the back: engine moves it to SOCKET_hand_R at 0.2 s
    k = keys(t, [(0.0, IK0, 0), (0.2, {**BACK, "gL": IK0["gL"]}, 0), (0.4, LIFT_R, 0.6), (0.6, rifle(), 0)])
    return {**rifle_legs(), **k}


def holster_rifle(t):  # engine moves the rifle back to the sling at 0.36 s
    k = keys(t, [(0.0, rifle(), 0), (0.18, {**LIFT_R, "gL": IK0["gL"]}, 0.6), (0.36, BACK, 0), (0.6, IK0, 0)])
    return {**rifle_legs(), **k}


def jump(t):
    return keys(t, [
        (0.0, IDLE0, 0),
        (0.12, dict(hip=(0, -0.02, -0.15), hipR=(-16, 0, 0), spine=(-8, 0, 0), aR=(-35, 14, 25), aL=(-35, 14, 25), head=(8, 0, 0)), 0),
        (0.22, dict(hip=(0, 0.02, 0.0), hipR=(-5, 0, 0), spine=(-2, 0, 0), aR=(60, 16, 35), aL=(60, 16, 35), head=(0, 0, 0),
                    fR=ankle_at(0.11, -0.025, -32, -6), fL=ankle_at(-0.11, 0.025, -32, 6), fRp=-32, fLp=-32, tRp=0, tLp=0), 0.5),
        (0.36, {**fall(0), "fRp": -18, "fLp": -10}, 0.5),
        (0.6, fall(0), 0)])


def land(t):
    imp = stance(stagger=0.08, z=-0.25, w=0.13)
    imp.update(hipR=(-20, 0, 0), spine=(-10, 0, 0), chest=(-5, 0, 0), head=(12, 0, 0), aR=(30, 22, 45), aL=(30, 22, 45))
    return keys(t, [(0.0, fall(0), 0), (0.07, imp, 0.3), (0.2, {**imp, "hip": (0, 0, -0.18)}), (0.5, IDLE0, 0)])


# ---------- carry poses (upper-body layer: spine and up; legs come from locomotion) + short use clips
def carry(t, **grips):
    b_ = S2(TAU * t / 2)
    P = stance(stagger=0.1, z=-0.02)
    P.update(spine=(-2, 0, 0), chest=(-1 + 0.6 * b_, 0, 0), neck=(2, 0, 0), head=(3, 0, 0), **grips)
    return P


def rifle_low(t):  # stock in the shoulder pocket, muzzle ~40 deg down and ~15 deg across the body, both hands on
    return carry(t, **rifle(g=(0.11, 0.27, 1.26), f=norm((-0.26, 0.72, -0.64)), u=norm((-0.1, 0.62, 0.78))))


def rifle_sprint(t):  # muzzle up across the chest
    return carry(t, **rifle(g=(0.13, 0.2, 1.18), f=norm((-0.5, 0.35, 0.8)), u=norm((-0.75, -0.2, -0.3)), lh=(0.0, 0.24, 0.0)))


def pistol_low(t):  # right arm ~20 deg forward of hanging, elbow soft, muzzle at the ground ~1.5 m ahead; left arm free
    P = carry(t, gR=(0.21, 0.2, 0.98), gRf=norm((0, 0.5, -0.87)), gRu=norm((0, 0.87, 0.5)), eR=(0.6, -1, 0))
    P["aL"] = IDLE0["aL"]
    return P


def use_bandage(t):  # left forearm held out palm up, right hand wraps it twice, head down
    c = (-0.06, 0.24, 1.16)
    a = TAU * 2 * smooth(min(1.0, t / 1.9))
    gr = (c[0] + 0.02 + 0.06 * math.sin(a), c[1] + 0.02, c[2] + 0.06 * math.cos(a))
    k = keys(t, [(0, dict(**IK0, head=(0, 0, 0)), 0), (0.3, dict(gL=(-0.03, 0.3, 1.14), gLf=norm((0.7, 0.6, 0)), gLu=(0, 0, 1), eL=(-1, -0.5, -0.4),
                                                                       gR=gr, gRf=norm((-0.8, 0.3, -0.2)), gRu=(0, 1, 0), eR=(1, -0.6, -0.5), head=(-22, 0, 0)), 0),
                 (1.7, dict(gL=(-0.03, 0.3, 1.14), gLf=norm((0.7, 0.6, 0)), gLu=(0, 0, 1), eL=(-1, -0.5, -0.4), head=(-22, 0, 0)), 0),
                 (2.0, dict(**IK0, head=(0, 0, 0)), 0)])
    if 0.3 < t < 1.7:
        k["gR"] = gr
    P = stance(stagger=0.08)
    P.update(k)
    return P


def eat(t):  # two bites; the food item rides on SOCKET_hand_R
    mouth = dict(gR=(0.04, 0.13, 1.6), gRf=norm((-0.5, 0.3, 0.8)), gRu=norm((0, 1, 0.2)), eR=(1, -0.3, -0.7))
    low = dict(gR=(0.14, 0.26, 1.22), gRf=norm((0, 0.7, 0.7)), gRu=norm((0, -0.7, 0.7)), eR=(0.8, -0.3, -0.9))
    k = keys(t, [(0, dict(gR=IK0["gR"], gRf=IK0["gRf"], gRu=IK0["gRu"], eR=IK0["eR"], head=(0, 0, 0)), 0), (0.35, {**low, "head": (-6, 0, 0)}, 0),
                 (0.6, {**mouth, "head": (-10, 0, 0)}, 0), (0.85, {**low, "head": (-4, 0, 0)}, 0), (1.15, {**mouth, "head": (-10, 0, 0)}, 0),
                 (1.45, {**low, "head": (-4, 0, 0)}, 0), (2.0, dict(gR=IK0["gR"], gRf=IK0["gRf"], gRu=IK0["gRu"], eR=IK0["eR"], head=(0, 0, 0)), 0)])
    P = stance(stagger=0.08)
    P.update(k)
    P["aL"] = IDLE0["aL"]
    return P


def drink(t):  # bottle (along the thumb axis) tipped to the mouth, head back
    sip = dict(gR=(0.05, 0.13, 1.58), gRf=norm((-0.6, 0.2, 0.75)), gRu=norm((-0.2, -0.75, 0.6)), eR=(1, 0, -0.5), head=(18, 0, 0), neck=(6, 0, 0))
    up = dict(gR=(0.12, 0.24, 1.3), gRf=norm((0, 0.6, 0.8)), gRu=norm((0, -0.2, 1)), eR=(0.8, -0.3, -0.9), head=(0, 0, 0), neck=(0, 0, 0))
    rest = dict(gR=IK0["gR"], gRf=IK0["gRf"], gRu=IK0["gRu"], eR=IK0["eR"], head=(0, 0, 0), neck=(0, 0, 0))
    k = keys(t, [(0, rest, 0), (0.4, up, 0.5), (0.7, sip, 0), (1.4, sip, 0), (1.65, up, 0.5), (2.0, rest, 0)])
    P = stance(stagger=0.08)
    P.update(k)
    P["aL"] = IDLE0["aL"]
    return P


# ---------- mocap locomotion (retarget.build_clips): name, source under assets/mocap/, kind, options
H = 12  # 100STYLE actors look at the floor: lift the gaze
MOCAP = [
    ("idle", "100style/Neutral/Neutral_ID", "loop", dict(period=True, min_T=3.0, max_T=6.0, lo=0.05, hi=0.45, head=H)),
    ("idle_b", "100style/Neutral/Neutral_ID", "loop", dict(period=True, min_T=3.0, max_T=6.0, lo=0.5, hi=0.95, head=H)),
    ("idle_c", "100style/Depressed/Depressed_ID", "loop", dict(period=True, min_T=3.0, max_T=6.0, head=8)),
    ("walk", "100style/Neutral/Neutral_FW", "loop", dict(warp=(1.6, 1.35, 2, 1.1), head=H)),
    ("run", "100style/Neutral/Neutral_FR", "loop", dict(warp=(3.5, 1.15, 6, 1.3), arms=1.3, head=H)),
    ("sprint", "100style/Neutral/Neutral_FR", "loop", dict(warp=(5.75, 1.55, 20, 1.7), arms=1.9, head=H + 8)),
    ("walk_back", "100style/Neutral/Neutral_BW", "loop", dict(face=True, want=(0, -1), warp=(1.2, 1.2, 0, 1.0, (0, -1)), head=H)),
    ("run_back", "100style/Neutral/Neutral_BR", "loop", dict(face=True, want=(0, -1), warp=(2.0, 1.15, 0, 1.0, (0, -1)), head=H)),
    ("strafe_right", "100style/Neutral/Neutral_SW", "loop", dict(face=True, want=(1, 0), warp=(1.0, 1.2, 0, 1.0, (1, 0)), head=H)),
    ("strafe_left", "100style/Neutral/Neutral_SW", "loop", dict(face=True, want=(-1, 0), foot="R", warp=(1.0, 1.2, 0, 1.0, (-1, 0)), head=H)),
    ("run_strafe_right", "100style/Neutral/Neutral_SR", "loop", dict(face=True, want=(1, 0), warp=(2.4, 1.15, 0, 1.0, (1, 0)), head=H)),
    ("run_strafe_left", "100style/Neutral/Neutral_SR", "loop", dict(face=True, want=(-1, 0), warp=(2.4, 1.15, 0, 1.0, (-1, 0)), head=H)),
    ("crouch_idle", "100style/Crouched/Crouched_ID", "loop", dict(period=True, min_T=2.5, max_T=5.0, head=H)),
    ("crouch_walk", "100style/Crouched/Crouched_FW", "loop", dict(warp=(1.5, 1.3, 0, 1.0), head=H)),
    ("turn_left_90", "cmu/69_13", "oneshot", dict(turn=90, src_max=60)),
    ("turn_right_90", "cmu/69_13", "oneshot", dict(turn=-90, src_max=60)),
]
UPPER_BODY = ["aim_pistol", "aim_rifle", "rifle_low", "rifle_sprint", "pistol_low", "fire_pistol", "fire_rifle", "reload_pistol",
              "reload_rifle", "draw_pistol", "draw_rifle", "holster", "holster_rifle", "melee_swing", "melee_heavy", "shove",
              "use_bandage", "eat", "drink"]

CLIPS = [  # name, duration s, fn, loop
    ("idle", 3.0, idle, True), ("walk", WALK["T"], lambda t: gait(t, WALK), True), ("run", RUN["T"], lambda t: gait(t, RUN), True),
    ("sprint", SPRINT["T"], lambda t: gait(t, SPRINT), True), ("crouch_idle", 2.0, crouch, True),
    ("crouch_walk", CWALK["T"], lambda t: gait(t, CWALK), True), ("jump", 0.6, jump, False), ("fall", 1.0, fall, True),
    ("land", 0.5, land, False), ("aim_pistol", 2.0, aim_pistol, True), ("aim_rifle", 2.0, aim_rifle, True),
    ("fire_pistol", 0.3, fire_pistol, False), ("fire_rifle", 0.25, fire_rifle, False), ("reload_pistol", 1.9, reload_pistol, False),
    ("reload_rifle", 2.4, reload_rifle, False), ("draw_pistol", 0.5, draw_pistol, False), ("holster", 0.5, holster, False),
    ("draw_rifle", 0.6, draw_rifle, False), ("holster_rifle", 0.6, holster_rifle, False), ("melee_swing", 0.7, melee_swing, False),
    ("melee_heavy", 1.1, melee_heavy, False), ("shove", 0.65, shove, False), ("hit_react", 0.45, hit_react, False),
    ("death", 1.8, death, False), ("drive_sit", 2.4, drive_sit, True), ("interact_search", 2.4, interact_search, True),
    ("rifle_low", 2.0, rifle_low, True), ("rifle_sprint", 2.0, rifle_sprint, True), ("pistol_low", 2.0, pistol_low, True),
    ("use_bandage", 2.0, use_bandage, False), ("eat", 2.0, eat, False), ("drink", 2.0, drink, False)]


def cyc(T, n=6):
    return [round(T * i / n, 4) for i in range(n)]


SHEETS = {  # `blender -b --python build.py -- --sheets 1` (Workbench, ~1 min)
    "turnaround": [(None, [0], y, 8, 3.3, 0.92) for y in (0, 90, 180, 35)] + [(None, [0], 25, 5, 0.9, 1.68), (None, [0], 0, 8, 3.3, 0.92, None, 1),
                                                                            (None, [0], 0, 8, 3.3, 0.92, None, 2), ("idle", [0], 180, 22, 2.6, 1.3)],
    "locomotion": [("jump", [0.12, 0.22, 0.36], 90, 8, 3.3, 0.9), ("fall", [0], 30, 8, 3.3, 0.9), ("land", [0.07, 0.2], 30, 8, 3.3, 0.9)],
    "carry": [("rifle_low", [0], y, 5, 2.4, 1.2, "rifle") for y in (35, 90, 180)] + [("rifle_sprint", [0], y, 5, 2.4, 1.2, "rifle") for y in (35, 90)]
             + [("pistol_low", [0], y, 5, 2.4, 1.2, "pistol") for y in (35, 90)] + [("aim_rifle", [0], 90, 5, 2.4, 1.2, "rifle")]
             + [("use_bandage", [0.3, 0.8, 1.3], 30, 5, 2.4, 1.2), ("eat", [0.6, 1.15], 30, 5, 2.4, 1.2), ("drink", [0.4, 1.0], 30, 5, 2.4, 1.2)],
    "weapons": [("aim_pistol", [0], y, 5, 2.2, 1.25, "pistol") for y in (35, 90, 180)] + [("aim_rifle", [0], y, 5, 2.2, 1.25, "rifle") for y in (35, 90, 180)]
               + [("fire_pistol", [0.035], 90, 5, 2.2, 1.25, "pistol"), ("fire_rifle", [0.03], 90, 5, 2.2, 1.25, "rifle"),
                  ("draw_pistol", [0.18, 0.32], 40, 5, 2.4, 1.1, "pistol"), ("draw_rifle", [0.2, 0.4], 40, 5, 2.4, 1.1, "rifle"),
                  ("reload_pistol", [0.3, 0.6, 0.95, 1.06, 1.35, 1.5], 40, 5, 2.2, 1.2, "pistol"),
                  ("reload_rifle", [0.35, 0.6, 1.0, 1.4, 1.52, 1.86], 40, 5, 2.2, 1.2, "rifle")],
    "actions": [("melee_swing", [0, 0.16, 0.27, 0.38], 40, 5, 2.4, 1.1, "knife"), ("melee_heavy", [0.38, 0.5, 0.58, 0.72], 40, 5, 2.6, 1.1, "bat"),
                ("shove", [0.15, 0.27], 90, 8, 3.3, 0.9), ("hit_react", [0.06], 30, 8, 3.3, 0.9), ("death", [0.18, 0.55, 0.9, 1.08, 1.8], 90, 15, 3.4, 0.6),
                ("drive_sit", [0], 90, 5, 3, 0.7), ("drive_sit", [0], 30, 5, 3, 0.7), ("interact_search", [0, 0.6], 90, 5, 3, 0.7)],
}

if __name__ == "__main__":
    import retarget  # noqa: E402
    MC = retarget.build_clips(vrig.ROOT, MOCAP)
    mocap_names = {m[0] for m in MC}
    for name, dur, fn, loop in CLIPS:
        if name not in mocap_names:  # mocap replaces the code-authored version of the same clip
            ch.clip(name, dur, fn, loop)
    for name, frames, loop, meta in MC:
        ch.clip_frames(name, frames, loop)
        print("MOCAP", name, meta)
    meta = {m[0]: m[3] for m in MC}
    for n in UPPER_BODY:
        meta.setdefault(n, {})["upperBody"] = True
    vrig.write_anim_meta(ch.id, meta)
    CLIPS = [c for c in CLIPS if c[0] not in mocap_names] + [
        (n, len(f) / 30, (lambda fr: lambda t: fr[round(t * 30) % len(fr)])(f), lp) for n, f, lp, _ in MC]
    if "--sheets" in sys.argv:
        vrig.preview_sheets(ch, CLIPS, SHEETS)
        vrig.preview_sheets(ch, CLIPS, vrig.mocap_sheets(MC), cols=10, size=240, main=False)
    ch.export()
    ch.report()
