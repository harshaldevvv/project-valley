"""kit_wood_roof_flat — flat roof deck for one 3 x 3 cell, 3 x 0.2 x 3 m (origin at base = wall-top height).
Joisted like kit_wood_floor but topped with tar-paper roofing (roof_shingle) and a low drip edge.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

H = 0.2
m = vlib.Builder("kit_wood_roof_flat")


def body(lod):
    bev = 0.02 if lod == 0 else 0
    m.box((0, 0.13, 0), (3.0, 0.04, 3.0), "wood_dark")  # sheathing
    if lod < 2:
        for x in (-1.0, 0.0, 1.0):
            m.box((x, 0.055, 0), (0.1, 0.11, 2.8), "wood_dark", bevel=bev)
    for s in (-1, 1):
        m.box((0, 0.075, s * 1.45), (3.0, 0.15, 0.1), "wood_dark", bevel=bev)
        m.box((s * 1.45, 0.075, 0), (0.1, 0.15, 2.8), "wood_dark", bevel=bev)
    m.box((0, 0.17, 0), (3.0, 0.04, 3.0), "roof_shingle", bevel=0.01 if lod == 0 else 0)
    if lod == 0:  # tar-paper seams + drip edge battens on the low (+Z) side
        for z in (-0.75, 0.0, 0.75):
            m.box((0, 0.192, z), (3.0, 0.006, 0.05), "asphalt")
        m.box((0, 0.2 - 0.015, 1.47), (3.0, 0.03, 0.06), "wood_weathered")


for lod in (0, 1, 2):
    m.lod(lod)
    body(lod)
m.lod(0)
m.finish(lods=[0.5, 0.15], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
