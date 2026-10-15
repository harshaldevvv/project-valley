"""wpn_rifle_a — AK-pattern 7.62x39 rifle (AKM proportions: 0.88 m long, 0.415 m barrel), wood furniture,
stamped receiver with a rounded dust cover, slant muzzle brake, curved steel magazine.
Origin at the pistol-grip centre, barrel along -Z. Magazine is a separate part "MAG" (origin = SOCKET_mag);
wpn_mag_rifle_a is the same mesh standalone.
Sockets: muzzle, grip (origin), support (left hand on the lower handguard), mag, sight (rear-sight notch).
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", "tools", "blender"))
sys.path.insert(0, os.path.join(HERE, ".."))
import vlib  # noqa: E402
import wpnlib  # noqa: E402

GZ, GY = 0.037, -0.052  # raw position of the grip centre (raw: receiver bottom y = 0, receiver rear z = 0.08)
BORE = 0.062
GUN, WOOD, DARK = "metal_gun", "wood_raw", "metal_dark"
m = vlib.Builder("wpn_rifle_a")


def P(pts):
    return [(z - GZ, y - GY) for z, y in pts]


def C(x, y, z):
    return (x, y - GY, z - GZ)


def rifle(lod):
    b = 0.003 if lod == 0 else 0
    seg = 8 if lod == 0 else 5
    # receiver with rounded dust cover (front profile extruded along z)
    rec = [(-0.019, 0.0), (0.019, 0.0), (0.019, 0.07), (0.012, 0.088), (-0.012, 0.088), (-0.019, 0.07)]
    m.extrude([(x, y - GY) for x, y in rec], 0.245, GUN, axis="z", center=(0, 0, -0.0425 - GZ), bevel=b)
    # rear sight base + front trunnion ring
    m.box(C(0, 0.088, -0.142), (0.03, 0.026, 0.05), GUN, bevel=b)
    m.box(C(0, 0.048, -0.172), (0.044, 0.064, 0.02), DARK, bevel=b)
    # barrel, gas block, front sight, muzzle brake, cleaning rod
    m.cylinder(C(0, BORE, -0.36), 0.0105, 0.36, DARK, segments=seg, axis="z")
    m.box(C(0, 0.08, -0.405), (0.03, 0.06, 0.035), GUN, bevel=b)
    m.cylinder(C(0, 0.094, -0.383), 0.012, 0.02, GUN, segments=seg, axis="z")
    m.box(C(0, 0.07, -0.505), (0.026, 0.035, 0.03), GUN, bevel=b)
    m.extrude(P([(-0.515, 0.085), (-0.495, 0.085), (-0.5, 0.118), (-0.51, 0.118)]), 0.024, GUN, axis="x")  # sight ears
    m.cylinder(C(0, BORE, -0.545), 0.0135, 0.03, GUN, segments=seg, axis="z")
    if lod == 0:
        m.box(C(0, BORE + 0.01, -0.558), (0.02, 0.008, 0.006), DARK, rot=(25, 0, 0))  # slant
        m.cylinder(C(0, 0.04, -0.455), 0.0035, 0.13, DARK, segments=5, axis="z")  # cleaning rod
        m.box(C(0, 0.045, -0.5), (0.012, 0.02, 0.02), GUN)  # bayonet lug
    # furniture: lower handguard, upper handguard over the gas tube
    lower = [(-0.024, 0.03), (0.024, 0.03), (0.028, 0.06), (0.022, 0.076), (-0.022, 0.076), (-0.028, 0.06)]
    m.extrude([(x, y - GY) for x, y in lower], 0.21, WOOD, axis="z", center=(0, 0, -0.285 - GZ), bevel=b)
    upper = [(-0.017, 0.078), (0.017, 0.078), (0.017, 0.096), (0.009, 0.107), (-0.009, 0.107), (-0.017, 0.096)]
    m.extrude([(x, y - GY) for x, y in upper], 0.19, WOOD, axis="z", center=(0, 0, -0.275 - GZ), bevel=b)
    m.box(C(0, 0.055, -0.39), (0.05, 0.058, 0.012), DARK, bevel=0.002 if lod == 0 else 0)  # handguard retainer
    # pistol grip, trigger guard, trigger
    m.extrude(P([(0.0, 0.0), (0.04, 0.0), (0.075, -0.1), (0.072, -0.108), (0.035, -0.108), (0.003, -0.02)]), 0.03,
              "wood_dark", axis="x", bevel=0.004 if lod == 0 else 0)
    m.extrude(P([(-0.07, 0.0), (-0.062, -0.03), (0.0, -0.03), (0.006, 0.0), (0.0, 0.0), (-0.004, -0.022),
                 (-0.056, -0.022), (-0.062, 0.0)]), 0.012, GUN, axis="x")
    if lod == 0:
        m.box(C(0, -0.01, -0.03), (0.006, 0.026, 0.007), DARK, rot=(-12, 0, 0))
    # stock
    stock = [(0.08, 0.072), (0.305, 0.04), (0.31, 0.03), (0.31, -0.1), (0.302, -0.112), (0.2, -0.07),
             (0.12, -0.022), (0.08, 0.0)]
    m.extrude(P(stock), 0.042, WOOD, axis="x", bevel=0.005 if lod == 0 else 0)
    m.extrude(P([(0.31, 0.04), (0.322, 0.04), (0.322, -0.112), (0.31, -0.112)]), 0.044, DARK, axis="x")  # butt plate
    if lod == 0:
        # charging handle (right side), selector lever, rear sight leaf, sling loops
        m.cylinder(C(0.03, 0.055, -0.02), 0.006, 0.024, DARK, segments=6, axis="x")
        m.box(C(0.0205, 0.062, -0.07), (0.003, 0.014, 0.1), DARK, rot=(4, 0, 0))
        m.box(C(0, 0.104, -0.13), (0.018, 0.005, 0.06), DARK, rot=(-4, 0, 0))
        m.box(C(-0.022, 0.065, -0.41), (0.004, 0.02, 0.02), DARK)
        m.box(C(0, -0.03, 0.2), (0.046, 0.012, 0.03), DARK)


rifle(0)
m.part("MAG", pivot=wpnlib.RIFLE_MAG_TOP)
wpnlib.rifle_mag(m)
m.part(None)
m.lod(1)
rifle(1)
m.lod(0)
m.socket("muzzle", C(0, BORE, -0.561))
m.socket("grip", (0, 0, 0))
m.socket("support", C(0, 0.03, -0.29))
m.socket("mag", wpnlib.RIFLE_MAG_TOP)
m.socket("sight", C(0, 0.11, -0.14))
m.finish(lods=[0.4], collider="box")
m.export()
m.preview()
m.sheet(figure=False)
m.report()
