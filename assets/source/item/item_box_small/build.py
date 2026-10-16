"""item_box_small — generic small cardboard box (stand-in for boxed items, kits and tins), 0.16 x 0.1 x 0.11 m."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

m = vlib.Builder("item_box_small")
m.box((0, 0.05, 0), (0.16, 0.1, 0.11), "cardboard", bevel=0.004)
m.box((0, 0.101, 0), (0.162, 0.003, 0.03), "paper")  # tape across the lid
m.box((0, 0.05, -0.056), (0.09, 0.04, 0.003), "paper")  # label
m.box((-0.02, 0.05, -0.0575), (0.04, 0.012, 0.002), "paint_red_faded")

m.finish(lods=[], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
