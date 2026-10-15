"""wpn_mag_rifle_a — curved 30-round 7.62x39 steel magazine for wpn_rifle_a (standalone).
Origin = the magazine's top-centre, posed as inserted (curving forward along -Z), so it attaches to the
rifle's SOCKET_mag with no extra rotation.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", "tools", "blender"))
sys.path.insert(0, os.path.join(HERE, ".."))
import vlib  # noqa: E402
import wpnlib  # noqa: E402

m = vlib.Builder("wpn_mag_rifle_a")
wpnlib.rifle_mag(m, at=(0, 0, 0))
m.finish(lods=[], collider="box")
m.export()
m.preview()
m.sheet(figure=False)
m.report()
