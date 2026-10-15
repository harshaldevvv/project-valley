"""wpn_pistol_a — 9 mm service pistol with Beretta 92 / M9 proportions (0.217 m long, 0.14 m tall, 0.038 wide).
Open-top slide exposing the barrel, raked grip with plastic panels, rounded trigger guard, exposed hammer.
Origin at the grip centre, barrel along -Z. The magazine is a separate part "MAG" (origin = SOCKET_mag)
so it can be hidden/animated on reload; wpn_mag_pistol_a is the same mesh as a standalone asset.
Sockets: muzzle, grip (origin), mag, sight (rear-sight notch, for ADS alignment).
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", "tools", "blender"))
sys.path.insert(0, os.path.join(HERE, ".."))
import vlib  # noqa: E402
import wpnlib  # noqa: E402

GUN, GRIP = "metal_gun", "plastic_black"
MUZ_Z, REAR_Z = -0.18, 0.037
SLIDE_Y0, SLIDE_Y1 = 0.045, 0.08
BORE_Y = 0.068
m = vlib.Builder("wpn_pistol_a")


def pistol(lod):
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


pistol(0)
m.part("MAG", pivot=wpnlib.PISTOL_MAG_TOP)
wpnlib.pistol_mag(m)
m.part(None)
m.lod(1)
pistol(1)
m.lod(0)
m.socket("muzzle", (0, BORE_Y, MUZ_Z - 0.001))
m.socket("grip", (0, 0, 0))
m.socket("mag", wpnlib.PISTOL_MAG_TOP)
m.socket("sight", (0, SLIDE_Y1 + 0.006, REAR_Z - 0.008))
m.finish(lods=[0.4], collider="box")
m.export()
m.preview()
m.sheet(figure=False)
m.report()
