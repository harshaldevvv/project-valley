"""item_can — generic food/drink tin (world pickup stand-in for cans and tins), 0.075 dia x 0.11 m."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

m = vlib.Builder("item_can")
m.lathe([(0.0, 0.0), (0.036, 0.0), (0.038, 0.005), (0.036, 0.01), (0.036, 0.1), (0.038, 0.105), (0.036, 0.11),
         (0.0, 0.11)], "metal_bare", segments=12)
m.lathe([(0.0375, 0.018), (0.0375, 0.092)], "paint_red_faded", segments=12)
m.lathe([(0.0378, 0.042), (0.0378, 0.068)], "paper", segments=12)

m.finish(lods=[], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
