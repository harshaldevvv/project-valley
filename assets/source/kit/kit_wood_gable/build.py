"""kit_wood_gable — triangular plank infill that closes the side under kit_wood_roof, 3 x 1.5 x 0.2 m.
Sits on a wall top (origin at base centre). Height is 1.5 at local x = -1.5 (with a post there) and 0 at
x = +1.5, matching the roof's 1:2 slope. Rotate about Y so the tall end faces the roof's high (-Z) side;
Two of them (one per cell) fill a 2-cell ridge gable; a shed-roof front is closed with kit_wood_wall_half.
Collider: stepped boxes under the slope (runtime reads colliders as AABBs).
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", "tools", "blender"))
sys.path.insert(0, os.path.join(HERE, ".."))
import vlib  # noqa: E402
import kitlib as K  # noqa: E402

H, W = 1.5, 3.0
m = vlib.Builder("kit_wood_gable")


def h_at(x):  # top of the infill at x
    return (1.5 - x) * H / W


def gable(lod):
    bev = K.BEV if lod == 0 else 0
    m.box((-1.5, H / 2, 0), (K.POST, H, K.WALL_T), K.FRAME, bevel=bev)  # tall-end post
    m.box((0, 0.1, 0), (2.8, 0.2, K.WALL_T - 0.02), K.FRAME, bevel=bev)  # bottom plate
    # core triangle + sloped top rafter
    m.extrude([(-1.4, 0.2), (1.1, 0.2), (-1.4, h_at(-1.4) - 0.05)], K.CORE_T, K.CORE, axis="z")
    m.extrude([(-1.4, h_at(-1.4)), (-1.4, h_at(-1.4) - 0.16), (1.5, -0.16 + h_at(1.5) + 0.0), (1.5, 0.0)],
              K.WALL_T - 0.02, K.FRAME, axis="z", bevel=0.015 if lod == 0 else 0)
    if lod == 2:
        return
    for zs in (-1, 1):
        z = zs * (K.CORE_T / 2 + K.BOARD_T / 2)
        if lod == 1:
            m.extrude([(-1.4, 0.2), (1.1, 0.2), (-1.4, h_at(-1.4) - 0.05)], K.BOARD_T, K.BOARD, axis="z",
                      center=(0, 0, z))
            continue
        y = 0.2
        while True:
            top = y + K.ROW - 0.012
            x_end = 1.5 - (top + 0.12) * W / H  # stop under the rafter
            if x_end <= -1.3:
                break
            m.box(((-1.4 + x_end) / 2, (y + top) / 2, z), (x_end + 1.4, top - y, K.BOARD_T), K.BOARD)
            y += K.ROW


for lod in (0, 1, 2):
    m.lod(lod)
    gable(lod)
m.lod(0)
for i in range(4):
    x0, x1 = -1.6 + 3.1 * i / 4, -1.6 + 3.1 * (i + 1) / 4
    hh = min(H, h_at(x0))
    m.collider_box(((x0 + x1) / 2, hh / 2, 0), (x1 - x0, hh, K.WALL_T))
m.finish(lods=[0.5, 0.15])
m.export()
m.preview()
m.sheet()
m.report()
