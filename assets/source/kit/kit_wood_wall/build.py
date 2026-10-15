"""kit_wood_wall — framed plank wall, 3 x 3 x 0.2 m (posts make it 3.2 wide; see kitlib snap rules)."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", "tools", "blender"))
sys.path.insert(0, os.path.join(HERE, ".."))
import vlib  # noqa: E402
import kitlib as K  # noqa: E402

m = vlib.Builder("kit_wood_wall")
for lod in (0, 1, 2):
    m.lod(lod)
    K.wall(m, 3.0, lod=lod)
m.lod(0)
m.finish(lods=[0.5, 0.15], collider="box")

m.export()
m.preview()
m.sheet()
m.report()
