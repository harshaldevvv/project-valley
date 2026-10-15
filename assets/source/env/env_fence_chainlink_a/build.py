"""env_fence_chainlink_a — galvanised chain-link fence panel, 3 x 2.2 x 0.08 m.
Line posts centred on x = +/-1.5 (adjacent panels share the post position), top rail, bottom tension
wire, and the mesh faked as a coarse diamond lattice of thin wires (reads as chain-link from 5 m).
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

W, H = 3.0, 2.2
m = vlib.Builder("env_fence_chainlink_a")


def frame(seg_post=8, seg_rail=6, caps=True):
    for x in (-W / 2, W / 2):
        m.cylinder((x, (H - 0.03) / 2, 0), 0.03, H - 0.03, "metal_bare", segments=seg_post)
        if caps:  # dome-ish post cap
            m.lathe([(0.036, H - 0.04), (0.036, H - 0.01), (0.02, H), (0, H + 0.005)], "metal_bare",
                    center=(x, 0, 0), segments=seg_post)
    m.cylinder((0, H - 0.08, 0.035), 0.021, W, "metal_bare", segments=seg_rail, axis="x")  # top rail (behind mesh)
    m.cylinder((0, 0.07, 0.01), 0.006, W, "metal_dark", segments=4, axis="x")  # bottom tension wire


frame()
# mesh: twisted top selvage line + lattice
m.lattice(-W / 2 + 0.03, W / 2 - 0.03, 0.06, H - 0.06, 0.012, 0.16, 0.01, "metal_bare")
for x in (-W / 2 + 0.05, W / 2 - 0.05):  # tension bars
    m.box((x, H / 2, 0.012), (0.016, H - 0.12, 0.006), "metal_dark")
for y in (0.3, 1.0, 1.7):  # tension bands holding the bars to the posts
    for x in (-W / 2 + 0.02, W / 2 - 0.02):
        m.box((x, y, 0.0), (0.07, 0.025, 0.07), "metal_dark")

m.lod(1)
frame(6, 4, caps=False)
m.lattice(-W / 2 + 0.03, W / 2 - 0.03, 0.06, H - 0.06, 0.012, 0.32, 0.014, "metal_bare")
m.lod(2)
for x in (-W / 2, W / 2):
    m.box((x, H / 2, 0), (0.06, H, 0.06), "metal_bare")
m.box((0, H - 0.08, 0.03), (W, 0.04, 0.04), "metal_bare")
m.box((0, 0.07, 0.01), (W, 0.015, 0.015), "metal_dark")
m.lattice(-W / 2 + 0.03, W / 2 - 0.03, 0.06, H - 0.06, 0.012, 0.6, 0.025, "metal_bare")
m.lod(0)

m.finish(lods=[0.4, 0.1], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
