"""wpn_mag_pistol_a — 15-round 9 mm magazine for wpn_pistol_a (standalone: reload, inventory, loot).
Origin = the magazine's top-centre, posed exactly as inserted (raked 16 deg), so it attaches to the pistol's
SOCKET_mag with no extra rotation.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", "tools", "blender"))
sys.path.insert(0, os.path.join(HERE, ".."))
import vlib  # noqa: E402
import wpnlib  # noqa: E402

m = vlib.Builder("wpn_mag_pistol_a")
wpnlib.pistol_mag(m, at=(0, 0, 0))
m.finish(lods=[], collider="box")
m.export()
m.preview()
m.sheet(figure=False)
m.report()
