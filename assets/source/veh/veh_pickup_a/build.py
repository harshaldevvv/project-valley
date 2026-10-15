"""veh_pickup_a — 2000s full-size regular-cab pickup (Silverado/F-150 class), 5.3 L x 1.9 H x 1.96 W m.
Faded blue paint, primer-white replacement hood, rust on arches/rockers/bed rails, chrome-ish bumpers.
Front = -Z. Wheelbase 3.4 m (axles z = -1.62 / +1.78), track 1.66 m, tyre radius 0.38 m.
Wheels are separate parts WHEEL_FL / WHEEL_FR / WHEEL_RL / WHEEL_RR, origin at the axle centre (spin about X;
front wheels steer about Y). Left = -X (driver side, LHD).
Sockets: driver (eye point), trunk (tailgate centre, outside), door_L (driver door handle).
Collider: lower-body box + cab box.
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

W = 1.96
HW = W / 2
WR = 0.38  # wheel radius
AXF, AXR = -1.62, 1.78
TRACK = 0.83  # wheel centre x
ARCH = 0.47
SILL = 0.5  # body bottom line
BELT = 1.22
PAINT, HOOD, TRIM = "paint_blue_faded", "paint_white_faded", "plastic_black"
m = vlib.Builder("veh_pickup_a")


def arch(zc, n=7):
    a0 = math.asin((SILL - WR) / ARCH)
    return [(zc + ARCH * math.cos(a0 + (math.pi - 2 * a0) * i / n), WR + ARCH * math.sin(a0 + (math.pi - 2 * a0) * i / n))
            for i in range(n + 1)]


FRONT = ([(0.45, SILL)] + arch(AXF) + [(-2.5, SILL - 0.02), (-2.6, 0.62), (-2.63, 1.04), (-2.56, 1.13),
                                        (-1.95, 1.17), (-1.08, 1.2), (-1.0, BELT), (0.45, BELT)])
BED = [(0.5, SILL)] + arch(AXR) + [(2.62, SILL), (2.62, BELT), (0.5, BELT)]
CAB = [(-1.05, BELT - 0.01), (-0.43, 1.82), (-0.36, 1.88), (0.36, 1.88), (0.43, 1.83), (0.45, BELT - 0.01)]


def body(lod):
    bev = 0.03 if lod == 0 else 0
    m.extrude(FRONT, W, PAINT, axis="x", bevel=bev)
    m.extrude(CAB, W - 0.24, PAINT, axis="x", bevel=0.03 if lod == 0 else 0)
    if lod == 2:
        m.extrude(BED, W, PAINT, axis="x")
        m.box((0, 1.55, -0.02), (W - 0.22, 0.42, 1.2), "glass_dirty")
        for z in (-2.66, 2.66):
            m.box((0, 0.58, z), (W, 0.2, 0.1), "metal_bare")
        return
    # bed: two side panels with the rear arch, floor, front wall, tailgate, rail caps, wheel tubs
    for s in (-1, 1):
        m.extrude(BED, 0.07, PAINT, axis="x", center=(s * (HW - 0.035), 0, 0), bevel=0.015 if lod == 0 else 0)
        m.box((s * (HW - 0.04), BELT + 0.015, 1.56), (0.1, 0.03, 2.1), TRIM)
        m.box((s * 0.75, 0.82, AXR), (0.3, 0.32, 1.0), PAINT, bevel=0.02 if lod == 0 else 0)  # wheel tub
    m.box((0, 0.62, 1.56), (W - 0.12, 0.06, 2.1), "metal_dark")
    m.box((0, 0.88, 0.53), (W - 0.12, 0.64, 0.06), PAINT)
    m.box((0, 0.88, 2.6), (W - 0.12, 0.64, 0.05), PAINT, bevel=0.01 if lod == 0 else 0)  # tailgate
    # glass: side band through the cab, windshield, rear window
    m.extrude([(-0.93, 1.27), (-0.45, 1.76), (-0.36, 1.81), (0.34, 1.82), (0.38, 1.27)], W - 0.22, "glass_dirty",
              axis="x")
    ang = math.degrees(math.atan2(1.8 - 1.25, 1.03 - 0.44))
    m.box((0, 1.52, -0.735), (W - 0.36, 0.02, math.hypot(0.59, 0.55)), "glass_dirty", rot=(-ang, 0, 0))
    m.box((0, 1.55, 0.452), (W - 0.6, 0.42, 0.02), "glass_dirty")
    # underbody: frame rails + wheel-well liners (no see-through)
    for s in (-1, 1):
        m.box((s * 0.48, 0.44, 0.1), (0.1, 0.14, 4.9), "metal_dark")
        for zc in (AXF, AXR):
            m.box((s * 0.66, 0.68, zc), (0.04, 0.36, 0.95), TRIM)
    m.box((0, 0.51, -0.9), (1.3, 0.02, 2.6), "metal_dark")
    # bumpers
    m.box((0, 0.58, -2.66), (W + 0.02, 0.2, 0.12), "metal_bare", bevel=0.03 if lod == 0 else 0)
    m.box((0, 0.58, 2.68), (W, 0.18, 0.12), "metal_bare", bevel=0.03 if lod == 0 else 0)
    # grille + headlights + taillights
    m.box((0, 0.86, -2.625), (1.1, 0.28, 0.04), TRIM)
    m.box((0, 0.86, -2.635), (1.16, 0.05, 0.03), "metal_bare")
    for s in (-1, 1):
        m.box((s * 0.73, 0.92, -2.62), (0.34, 0.18, 0.04), "glass")
        m.box((s * (HW - 0.01), 0.98, 2.61), (0.04, 0.32, 0.1), "paint_red_faded")


def details():
    # replacement primer hood + bulge, door seams/handles, mirrors, rust, fuel door, wipers, antenna
    m.extrude([(-2.55, 1.135), (-1.95, 1.175), (-1.1, 1.205), (-1.1, 1.215), (-1.95, 1.185), (-2.55, 1.145)],
              W - 0.12, HOOD, axis="x")
    m.extrude([(-2.4, 1.17), (-1.2, 1.215), (-1.2, 1.235), (-2.4, 1.19)], 0.5, HOOD, axis="x", bevel=0.005)
    for s in (-1, 1):
        x = s * (HW + 0.004)
        for z in (-1.02, 0.05):
            m.box((x, 0.88, z), (0.008, 0.68, 0.012), "metal_dark")  # door seams
        m.box((x, 1.08, -0.06), (0.012, 0.03, 0.12), TRIM)  # handle
        m.box((s * (HW + 0.09), 1.4, -0.9), (0.08, 0.2, 0.16), TRIM, bevel=0.01)  # mirror
        m.box((s * (HW + 0.03), 1.36, -0.92), (0.08, 0.03, 0.03), TRIM)
        m.box((x, 0.55, -0.45), (0.008, 0.08, 1.1), "rust")  # rocker rust
        for zc in (AXF, AXR):
            m.box((x, 0.56, zc + s * 0.5), (0.008, 0.1, 0.16), "rust_dark")
            m.box((x, 0.82, zc - 0.33), (0.008, 0.12, 0.1), "rust")
        m.box((s * (HW - 0.04), BELT + 0.032, 1.2), (0.1, 0.006, 0.5), "rust")  # bed rail wear
    m.box((HW + 0.004, 0.95, 0.9), (0.008, 0.14, 0.14), "metal_dark")  # fuel door (right)
    for x in (-0.35, 0.3):
        m.box((x, 1.24, -1.0), (0.5, 0.015, 0.02), TRIM, rot=(0, 8, 0))  # wipers
    m.cylinder((0.8, 1.45, -1.25), 0.004, 0.5, "metal_dark", segments=4)  # antenna
    m.box((0, 0.95, 2.627), (0.32, 0.06, 0.006), "metal_dark")  # tailgate handle
    m.box((0, 0.6, -2.73), (0.34, 0.1, 0.01), "paper")  # bent plate frame


def wheel(name, x, z):
    s = 1 if x > 0 else -1
    m.part(name, pivot=(x, WR, z))
    tyre = [(0.24, -0.12), (0.33, -0.13), (0.365, -0.12), (WR, -0.08), (WR, 0.08), (0.365, 0.12), (0.33, 0.13),
            (0.24, 0.12)]
    m.lathe(tyre, "rubber_black", center=(x, WR, z), segments=14, axis="x", closed=True)
    m.lathe([(0.0, -0.09), (0.245, -0.09), (0.245, 0.09), (0.0, 0.09)], "metal_bare", center=(x, WR, z),
            segments=10, axis="x")
    m.lathe([(0.0, 0.0), (0.075, 0.0), (0.06, 0.04), (0.0, 0.045)], "metal_dark", center=(x + s * 0.09, WR, z),
            segments=8, axis="x", rot=(0, 0 if s > 0 else 180, 0))  # hub cap
    for k in range(5):  # rim windows
        a = 2 * math.pi * k / 5
        m.box((x + s * 0.092, WR + 0.16 * math.sin(a), z + 0.16 * math.cos(a)), (0.006, 0.09, 0.06), "metal_dark",
              rot=(math.degrees(a), 0, 0))
    m.part(None)


body(0)
details()
for name, x, z in (("WHEEL_FL", -TRACK, AXF), ("WHEEL_FR", TRACK, AXF), ("WHEEL_RL", -TRACK, AXR),
                   ("WHEEL_RR", TRACK, AXR)):
    wheel(name, x, z)
m.lod(1)
body(1)
m.extrude([(-2.55, 1.135), (-1.95, 1.175), (-1.1, 1.205), (-1.1, 1.215), (-1.95, 1.185), (-2.55, 1.145)],
          W - 0.12, HOOD, axis="x")
m.lod(2)
body(2)
m.lod(0)

m.socket("driver", (-0.4, 1.45, -0.15))
m.socket("trunk", (0, 0.9, 2.67))
m.socket("door_L", (-HW - 0.02, 1.08, -0.06))
m.collider_box((0, 0.85, 0.01), (W, 0.7, 5.42))
m.collider_box((0, 1.55, -0.3), (W - 0.24, 0.66, 1.5))
m.finish(lods=[0.4, 0.1])
m.export()
m.preview()
m.sheet()
m.report()
