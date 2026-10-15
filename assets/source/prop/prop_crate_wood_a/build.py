"""prop_crate_wood_a — military-style wooden loot crate, 1.0 x 0.6 x 0.6 m.
Slatted plank walls inside a chamfered frame, metal corner brackets, rope handles, stencil plate.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

W, H, D = 1.0, 0.6, 0.6  # x, y(up), z
F = 0.05  # frame thickness
m = vlib.Builder("prop_crate_wood_a")

# Planks: 4 horizontal boards per long side, 4 per short side, slightly inset with gaps.
board_h = (H - 2 * F) / 4
for i in range(4):
    y = F + board_h * (i + 0.5)
    for z in (-D / 2 + 0.012, D / 2 - 0.012):
        m.box((0, y, z), (W - 2 * F, board_h - 0.008, 0.024), "wood_raw")
    for x in (-W / 2 + 0.012, W / 2 - 0.012):
        m.box((x, y, 0), (0.024, board_h - 0.008, D - 2 * F), "wood_raw")

# Lid and base boards (3 wide planks each).
for i in range(3):
    z = -D / 2 + F + (D - 2 * F) / 3 * (i + 0.5)
    m.box((0, H - 0.012, z), (W - 2 * F, 0.024, (D - 2 * F) / 3 - 0.008), "wood_raw")
    m.box((0, 0.012, z), (W - 2 * F, 0.024, (D - 2 * F) / 3 - 0.008), "wood_dark")

# Frame: 12 chamfered edge beams in darker wood.
for y in (F / 2, H - F / 2):
    for z in (-D / 2 + F / 2, D / 2 - F / 2):
        m.box((0, y, z), (W, F, F), "wood_dark", bevel=0.008)
    for x in (-W / 2 + F / 2, W / 2 - F / 2):
        m.box((x, y, 0), (F, F, D - 2 * F), "wood_dark", bevel=0.008)
for x in (-W / 2 + F / 2, W / 2 - F / 2):
    for z in (-D / 2 + F / 2, D / 2 - F / 2):
        m.box((x, H / 2, z), (F, H - 2 * F, F), "wood_dark", bevel=0.008)

# Metal corner brackets (8 corners, L-shaped from two thin plates).
for x in (-1, 1):
    for y in (0, 1):
        for z in (-1, 1):
            cx, cy, cz = x * (W / 2 + 0.003), F if y == 0 else H - F, z * (D / 2 + 0.003)
            m.box((cx - x * 0.05, cy, cz), (0.1, 0.1, 0.006), "metal_dark")
            m.box((cx, cy, cz - z * 0.05), (0.006, 0.1, 0.1), "metal_dark")

# Rope handles on the short sides.
for x in (-1, 1):
    m.cylinder((x * (W / 2 + 0.03), H * 0.62, 0), 0.012, 0.18, "cloth_khaki", segments=6, axis="z")
    for z in (-0.08, 0.08):
        m.box((x * (W / 2 + 0.015), H * 0.62, z), (0.03, 0.03, 0.03), "metal_dark")

# Stencil plate on the front.
m.box((0.18, H * 0.55, -D / 2 - 0.004), (0.32, 0.12, 0.004), "stencil_white")
m.box((0.18, H * 0.55, -D / 2 - 0.007), (0.26, 0.04, 0.003), "military_olive")

# Hand-made LODs: decimating the thin planks punched see-through holes.
# LOD1 (~15-45 m): solid body + full frame + stencil. LOD2 (45 m+): body + corner posts + lid rim.
m.lod(1)
m.box((0, H / 2, 0), (W - 0.02, H - 0.02, D - 0.02), "wood_raw")
for y in (F / 2, H - F / 2):
    for z in (-D / 2 + F / 2, D / 2 - F / 2):
        m.box((0, y, z), (W, F, F), "wood_dark")
    for x in (-W / 2 + F / 2, W / 2 - F / 2):
        m.box((x, y, 0), (F, F, D - 2 * F), "wood_dark")
for x in (-W / 2 + F / 2, W / 2 - F / 2):
    for z in (-D / 2 + F / 2, D / 2 - F / 2):
        m.box((x, H / 2, z), (F, H - 2 * F, F), "wood_dark")
m.box((0.18, H * 0.55, -D / 2 - 0.004), (0.32, 0.12, 0.004), "stencil_white")
m.lod(2)
m.box((0, H / 2, 0), (W - 0.02, H - 0.02, D - 0.02), "wood_raw")
for x in (-W / 2 + F / 2, W / 2 - F / 2):
    for z in (-D / 2 + F / 2, D / 2 - F / 2):
        m.box((x, H / 2, z), (F + 0.01, H, F + 0.01), "wood_dark")
m.box((0, H - F / 2, 0), (W, F, D), "wood_dark")
m.lod(0)

m.finish(lods=[0.45, 0.15], collider="box")
m.export()
m.preview()
m.report()
