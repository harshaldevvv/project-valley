"""kit_wood_window — plank wall with a 1.2 x 1.0 m window opening (sill at 0.9 m), 3 x 3 x 0.2 m.
Compound collider (left, right, above, below) leaves the opening clear."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", "tools", "blender"))
sys.path.insert(0, os.path.join(HERE, ".."))
import vlib  # noqa: E402
import kitlib as K  # noqa: E402

m = vlib.Builder("kit_wood_window")
OPEN = (-0.6, 0.6, 0.9, 1.9)
for lod in (0, 1, 2):
    m.lod(lod)
    cols = K.wall(m, 3.0, opening=OPEN, sill_board=True, lod=lod)
m.lod(0)
for c, s in cols:
    m.collider_box(c, s)
m.finish(lods=[0.5, 0.15])

m.export()
m.preview()
m.sheet()
m.report()
