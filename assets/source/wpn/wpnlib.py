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
