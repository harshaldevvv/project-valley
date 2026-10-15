"""kit_wood_doorway — plank wall with a 1.0 x 2.1 m door opening centred at x = 0, 3 x 3 x 0.2 m.
Compound collider (left, right, header). SOCKET_door_hinge = where kit_wood_door's origin goes (hinge on -X,
door leaf extends toward +X, closed)."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", "tools", "blender"))
sys.path.insert(0, os.path.join(HERE, ".."))
import vlib  # noqa: E402
import kitlib as K  # noqa: E402

m = vlib.Builder("kit_wood_doorway")
OPEN = (-0.5, 0.5, 0.0, 2.1)
for lod in (0, 1, 2):
    m.lod(lod)
    cols = K.wall(m, 3.0, opening=OPEN, lod=lod)
m.lod(0)
for c, s in cols:
    m.collider_box(c, s)
m.socket("door_hinge", (-0.475, 0.02, 0.0))
m.finish(lods=[0.5, 0.15])

m.export()
m.preview()
m.sheet()
m.report()
