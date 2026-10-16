"""item_bag_soft — generic soft pouch / cloth bundle (stand-in for clothing, pouches, cloth, rope), 0.26 x 0.1 x 0.2 m."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

m = vlib.Builder("item_bag_soft")
m.box((0, 0.045, 0), (0.26, 0.09, 0.2), "cloth_khaki", bevel=0.035)
m.box((0, 0.088, -0.02), (0.22, 0.02, 0.12), "cloth_khaki", bevel=0.009, rot=(0, 6, 0))  # bunched top
m.box((0, 0.09, 0.055), (0.24, 0.006, 0.012), "metal_dark")  # zip
m.box((0.11, 0.092, 0.055), (0.02, 0.006, 0.02), "metal_bare")  # zip pull
m.box((-0.13, 0.05, 0), (0.02, 0.03, 0.12), "cloth_black", bevel=0.005)  # side handle

m.finish(lods=[], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
