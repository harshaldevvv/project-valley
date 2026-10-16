"""item_backpack_generic — generic dropped backpack (world pickup stand-in for every pack), 0.32 x 0.42 x 0.18 m,
lying slightly tipped back. Olive canvas; one model for all packs (tint per item in the engine if wanted)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

m = vlib.Builder("item_backpack_generic")
with m.xform((0, 0, 0.02), (-12, 0, 0)):  # tipped back against nothing, resting on its base
    m.box((0, 0.21, 0), (0.32, 0.42, 0.16), "cloth_olive", bevel=0.035)
    m.box((0, 0.13, -0.09), (0.24, 0.18, 0.05), "military_olive", bevel=0.015)  # front pocket
    m.box((0, 0.39, -0.03), (0.3, 0.07, 0.11), "military_olive", bevel=0.02)  # top lid
    for x in (-0.08, 0.08):
        m.box((x, 0.27, 0.09), (0.05, 0.34, 0.015), "cloth_black", bevel=0.004)  # shoulder straps
        m.box((x, 0.2, -0.117), (0.03, 0.02, 0.006), "metal_dark")  # buckles
    m.box((0, 0.44, 0.04), (0.07, 0.025, 0.02), "cloth_black", bevel=0.006)  # grab handle

m.finish(lods=[], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
