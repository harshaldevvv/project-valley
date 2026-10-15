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

m = vlib.Builder("wpn_rifle_a")
rifle = lambda lod: wpnlib.rifle_body(m, lod)  # noqa: E731
C, BORE = wpnlib.C, wpnlib.RIFLE_BORE


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
