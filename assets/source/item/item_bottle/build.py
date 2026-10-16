"""item_bottle — generic plastic bottle (world pickup stand-in for bottles, pill jars, canteens), 0.07 dia x 0.23 m,
lying on its side."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

m = vlib.Builder("item_bottle")
with m.xform((0, 0.034, 0), (0, 25, 90)):
    m.lathe([(0.0, -0.11), (0.031, -0.11), (0.034, -0.104), (0.034, 0.04), (0.03, 0.06), (0.013, 0.085),
             (0.013, 0.095), (0.0, 0.095)], "glass", segments=10)
    m.lathe([(0.0345, -0.06), (0.0345, 0.0)], "paint_blue_faded", segments=10)
    m.lathe([(0.0, 0.09), (0.015, 0.09), (0.015, 0.112), (0.0, 0.112)], "plastic_white", segments=8)

m.finish(lods=[], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
