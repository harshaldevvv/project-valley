"""Shared weapon geometry (not an asset). Weapons: origin at the grip centre, barrel along -Z, +Y up.
Magazines are modelled in their inserted pose relative to the gun's SOCKET_mag (= the mag's origin, at the
top-centre of the mag where it enters the well), so the standalone mag assets attach with no rotation.
"""
import math

# Beretta 92-like pistol: magazine top-centre in pistol space and grip rake
PISTOL_MAG_TOP = (0.0, 0.055, 0.004)
PISTOL_RAKE = -16.0  # degrees about X (bottom of the grip swept back toward +Z)
# AK-pattern rifle: magazine top-centre in rifle space
RIFLE_MAG_TOP = (0.0, 0.072, -0.162)


def _rot_x(p, deg):
    y, z = p
    a = math.radians(deg)
    return (y * math.cos(a) - z * math.sin(a), y * math.sin(a) + z * math.cos(a))


def pistol_mag(m, at=PISTOL_MAG_TOP, lod=0):
    """Double-stack 9 mm magazine, 0.022 wide, ~0.125 long (incl. base plate), raked with the grip."""
    x0, y0, z0 = at
    # body as a side profile (z, y) in mag space (top at 0), then raked
    body = [(-0.016, 0.0), (0.017, 0.0), (0.017, -0.118), (-0.016, -0.118)]
    pts = []
    for z, y in body:
        ry, rz = _rot_x((y, z), PISTOL_RAKE)
        pts.append((z0 + rz, y0 + ry))
    m.extrude(pts, 0.021, "metal_gun", axis="x", center=(x0, 0, 0), bevel=0.001 if lod == 0 else 0)
    base = [(-0.019, -0.116), (0.02, -0.116), (0.021, -0.128), (-0.017, -0.128)]
    pts = []
    for z, y in base:
        ry, rz = _rot_x((y, z), PISTOL_RAKE)
        pts.append((z0 + rz, y0 + ry))
    m.extrude(pts, 0.026, "plastic_black", axis="x", center=(x0, 0, 0), bevel=0.0015 if lod == 0 else 0)
    if lod == 0:  # follower + top round peeking out of the lips
        ry, rz = _rot_x((-0.003, 0.0), PISTOL_RAKE)
        m.cylinder((x0, y0 + ry + 0.002, z0 + rz - 0.004), 0.0045, 0.02, "paint_yellow_faded", segments=6, axis="z")


def rifle_mag(m, at=RIFLE_MAG_TOP, lod=0):
    """Curved 30-round 7.62x39 steel magazine with reinforcing ribs, top-centre at `at`."""
    x0, y0, z0 = at
    # curved side profile (z, y) relative to the top-centre; the mag curves forward (-Z)
    front = [(-0.03, 0.0), (-0.042, -0.06), (-0.062, -0.12), (-0.092, -0.175), (-0.128, -0.222)]
    rear = [(0.03, 0.0), (0.024, -0.06), (0.008, -0.12), (-0.018, -0.178), (-0.05, -0.232)]
    prof = [(z0 + z, y0 + y) for z, y in rear] + [(z0 + z, y0 + y) for z, y in reversed(front)]
    m.extrude(prof, 0.026, "metal_gun", axis="x", center=(x0, 0, 0), bevel=0.0015 if lod == 0 else 0)
    # floor plate
    m.extrude([(z0 - 0.132, y0 - 0.218), (z0 - 0.046, y0 - 0.238), (z0 - 0.05, y0 - 0.248),
               (z0 - 0.137, y0 - 0.228)], 0.03, "metal_dark", axis="x", center=(x0, 0, 0))
    if lod == 0:  # stamped side panel (reads as the ribs), front lug, top round
        rows = list(zip(front, rear))[1:]
        inner = [(fz + (rz - fz) * 0.3, fy + (ry - fy) * 0.3) for (fz, fy), (rz, ry) in rows]
        outer = [(fz + (rz - fz) * 0.7, fy + (ry - fy) * 0.7) for (fz, fy), (rz, ry) in rows]
        prof = [(z0 + z, y0 + y + 0.02) for z, y in outer[:-1]] + [(z0 + z, y0 + y + 0.02) for z, y in reversed(inner[:-1])]
        m.extrude(prof, 0.03, "metal_dark", axis="x", center=(x0, 0, 0))
        m.box((x0, y0 - 0.006, z0 - 0.036), (0.012, 0.012, 0.012), "metal_gun")  # front locking lug
        m.cylinder((x0, y0 + 0.006, z0 - 0.002), 0.0055, 0.038, "paint_yellow_faded", segments=6, axis="z")


# ---------------- pistol body (Beretta 92 proportions) ----------------
GUN, GRIP = "metal_gun", "plastic_black"
MUZ_Z, REAR_Z = -0.18, 0.037
SLIDE_Y0, SLIDE_Y1 = 0.045, 0.08
BORE_Y = 0.068


def pistol_body(m, lod=0):
    """Pistol frame/slide/barrel/grip (no magazine). lod=1: no small parts."""
    b = 0.002 if lod == 0 else 0
    # slide: rear full-height section with a rounded top (front profile extruded along z)
    top = [(-0.0145, SLIDE_Y0), (0.0145, SLIDE_Y0), (0.0145, SLIDE_Y1 - 0.007), (0.009, SLIDE_Y1),
           (-0.009, SLIDE_Y1), (-0.0145, SLIDE_Y1 - 0.007)]
    m.extrude(top, REAR_Z + 0.062, GUN, axis="z", center=(0, 0, (REAR_Z - 0.062) / 2), bevel=b)
    # slide front: lower "wings" with the open top cut-out, barrel exposed on top
    wing = [(-0.0145, SLIDE_Y0), (0.0145, SLIDE_Y0), (0.0145, 0.063), (-0.0145, 0.063)]
    m.extrude(wing, -0.062 - MUZ_Z, GUN, axis="z", center=(0, 0, (MUZ_Z - 0.062) / 2), bevel=b)
    m.cylinder((0, BORE_Y, -0.12), 0.0105, 0.12, "metal_dark", segments=10 if lod == 0 else 6, axis="z")
    m.box((0, 0.07, MUZ_Z + 0.006), (0.029, 0.014, 0.012), GUN, bevel=b)  # slide nose around the muzzle
    # frame: dust cover, trigger guard, grip
    m.extrude([(MUZ_Z + 0.012, 0.045), (-0.02, 0.045), (-0.02, 0.03), (-0.07, 0.03), (MUZ_Z + 0.03, 0.035)],
              0.026, GUN, axis="x", bevel=b)
    guard = [(-0.07, 0.03), (-0.064, 0.0), (-0.05, -0.012), (-0.01, -0.012), (-0.004, 0.0), (-0.004, 0.006),
             (-0.012, 0.006), (-0.015, -0.003), (-0.048, -0.003), (-0.056, 0.004), (-0.06, 0.03)]
    m.extrude(guard, 0.012, GUN, axis="x", bevel=0.001 if lod == 0 else 0)
    grip = [(-0.016, 0.045), (0.032, 0.045), (0.046, 0.056), (0.05, 0.045), (0.043, 0.02), (0.05, -0.058),
            (0.014, -0.06), (-0.004, 0.0), (-0.016, 0.03)]
    m.extrude(grip, 0.028, GUN, axis="x", bevel=b)
    m.extrude([(-0.005, 0.03), (0.034, 0.03), (0.043, -0.05), (0.016, -0.052), (0.0, 0.0)], 0.034, GRIP,
              axis="x", bevel=0.003 if lod == 0 else 0)  # grip panels
    if lod == 0:
        m.box((0, 0.004, -0.032), (0.006, 0.026, 0.007), GUN, rot=(-15, 0, 0))  # trigger
        m.box((0, 0.068, REAR_Z + 0.004), (0.01, 0.02, 0.012), "metal_dark", rot=(-20, 0, 0))  # hammer
        m.box((0, SLIDE_Y1 + 0.003, REAR_Z - 0.008), (0.016, 0.006, 0.008), "metal_dark")  # rear sight
        m.box((0, BORE_Y + 0.015, MUZ_Z + 0.012), (0.004, 0.006, 0.008), "metal_dark")  # front sight
        for i in range(5):  # rear slide serrations
            m.box((0, 0.064, REAR_Z - 0.008 - i * 0.005), (0.031, 0.022, 0.0018), "metal_dark")
        for sx in (-1, 1):  # safety/decocker levers + slide stop
            m.box((sx * 0.0155, 0.07, REAR_Z - 0.016), (0.004, 0.006, 0.014), "metal_dark")
        m.box((-0.0145, 0.04, -0.03), (0.003, 0.006, 0.03), "metal_dark")
        m.cylinder((0, 0.035, -0.083), 0.004, 0.032, "metal_dark", segments=6, axis="x")  # takedown pin
        m.box((0, -0.04, 0.047), (0.006, 0.006, 0.006), "metal_dark")  # lanyard loop



# ---------------- rifle body (AKM proportions) ----------------
GZ, GY = 0.037, -0.052  # raw position of the grip centre (raw: receiver bottom y = 0, receiver rear z = 0.08)
RIFLE_BORE = 0.062
WOOD, DARK = "wood_raw", "metal_dark"


def P(pts):
    return [(z - GZ, y - GY) for z, y in pts]


def C(x, y, z):
    return (x, y - GY, z - GZ)


def rifle_body(m, lod=0):
    """Rifle without the magazine. lod=1: no small parts."""
    b = 0.003 if lod == 0 else 0
    seg = 8 if lod == 0 else 5
    # receiver with rounded dust cover (front profile extruded along z)
    rec = [(-0.019, 0.0), (0.019, 0.0), (0.019, 0.07), (0.012, 0.088), (-0.012, 0.088), (-0.019, 0.07)]
    m.extrude([(x, y - GY) for x, y in rec], 0.245, GUN, axis="z", center=(0, 0, -0.0425 - GZ), bevel=b)
    # rear sight base + front trunnion ring
    m.box(C(0, 0.088, -0.142), (0.03, 0.026, 0.05), GUN, bevel=b)
    m.box(C(0, 0.048, -0.172), (0.044, 0.064, 0.02), DARK, bevel=b)
    # barrel, gas block, front sight, muzzle brake, cleaning rod
    m.cylinder(C(0, RIFLE_BORE, -0.36), 0.0105, 0.36, DARK, segments=seg, axis="z")
    m.box(C(0, 0.08, -0.405), (0.03, 0.06, 0.035), GUN, bevel=b)
    m.cylinder(C(0, 0.094, -0.383), 0.012, 0.02, GUN, segments=seg, axis="z")
    m.box(C(0, 0.07, -0.505), (0.026, 0.035, 0.03), GUN, bevel=b)
    m.extrude(P([(-0.515, 0.085), (-0.495, 0.085), (-0.5, 0.118), (-0.51, 0.118)]), 0.024, GUN, axis="x")  # sight ears
    m.cylinder(C(0, RIFLE_BORE, -0.545), 0.0135, 0.03, GUN, segments=seg, axis="z")
    if lod == 0:
        m.box(C(0, RIFLE_BORE + 0.01, -0.558), (0.02, 0.008, 0.006), DARK, rot=(25, 0, 0))  # slant
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


