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

m = vlib.Builder("wpn_pistol_a")
pistol = lambda lod: wpnlib.pistol_body(m, lod)  # noqa: E731
MUZ_Z, REAR_Z, SLIDE_Y1, BORE_Y = wpnlib.MUZ_Z, wpnlib.REAR_Z, wpnlib.SLIDE_Y1, wpnlib.BORE_Y


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
