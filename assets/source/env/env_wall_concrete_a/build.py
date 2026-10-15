"""env_wall_concrete_a — precast concrete yard wall segment, 4 x 3 x 0.3 m.
Three stacked slabs slotted into an H-post at the +X end (segments tile every 4 m), slight top cap,
dark weathering band at the base.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

W, H, D = 4.0, 3.0, 0.3
PW = 0.3            # post width (x)
SX0, SX1 = -W / 2, W / 2 - PW + 0.02   # slab span (tucks 2 cm into the post)
T = 0.18            # slab thickness
CAP = 0.08
m = vlib.Builder("env_wall_concrete_a")

slab_h = (H - CAP) / 3
for i in range(3):
    y = slab_h * (i + 0.5)
    m.box(((SX0 + SX1) / 2, y, 0), (SX1 - SX0, slab_h - 0.01, T), "concrete", bevel=0.03)
# post: H-section column, full height + cap
px = W / 2 - PW / 2
m.box((px, (H + 0.04) / 2, 0), (PW, H + 0.04, D), "concrete", bevel=0.03)
m.box((px, H + 0.06, 0), (PW + 0.04, 0.06, D + 0.04), "concrete_dark", bevel=0.015)
# top cap over the slabs
m.box(((SX0 + SX1) / 2, H - CAP / 2, 0), (SX1 - SX0, CAP, T + 0.06), "concrete", bevel=0.02)
# base weathering band (splash zone) on both faces + footing strip
for z in (-1, 1):
    m.box(((SX0 + SX1) / 2, 0.14, z * (T / 2 + 0.002)), (SX1 - SX0 - 0.04, 0.26, 0.006), "concrete_dark")
    m.box((px, 0.16, z * (D / 2 + 0.002)), (PW - 0.04, 0.3, 0.006), "concrete_dark")
m.box(((SX0 + SX1) / 2, 0.03, 0), (SX1 - SX0, 0.06, T + 0.08), "concrete_dark", bevel=0.015)
# lifting anchors on the cap
for x in (-1.2, 0.6):
    m.box((x, H + 0.005, 0), (0.06, 0.02, 0.06), "rust_dark")

# Hand LODs: plain blocks (bevels on 4 m slabs are wasted far away).
m.lod(1)
m.box(((SX0 + SX1) / 2, (H - CAP) / 2, 0), (SX1 - SX0, H - CAP, T), "concrete")
m.box(((SX0 + SX1) / 2, H - CAP / 2, 0), (SX1 - SX0, CAP, T + 0.06), "concrete")
m.box((px, (H + 0.04) / 2, 0), (PW, H + 0.04, D), "concrete")
m.box((px, H + 0.06, 0), (PW + 0.04, 0.06, D + 0.04), "concrete_dark")
m.box(((SX0 + SX1) / 2, 0.14, 0), (SX1 - SX0, 0.28, T + 0.012), "concrete_dark")
m.lod(2)
m.box((-PW / 2 + 0.01, H / 2, 0), (W - PW + 0.02, H, T + 0.06), "concrete")
m.box((px, (H + 0.09) / 2, 0), (PW, H + 0.09, D), "concrete")
m.lod(0)

m.finish(lods=[0.4, 0.1], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
