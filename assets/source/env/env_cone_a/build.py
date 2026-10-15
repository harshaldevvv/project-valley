"""env_cone_a — traffic cone, 0.35 m square base x 0.7 m, faded orange with two white bands."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

B, H, Y0 = 0.35, 0.7, 0.03
R0, R1 = 0.135, 0.028
m = vlib.Builder("env_cone_a")


def r(y):
    return R0 + (R1 - R0) * (y - Y0) / (H - Y0)


def cone(seg, bands=True):
    m.box((0, Y0 / 2, 0), (B, Y0, B), "rubber_black", bevel=0.012 if bands else 0)
    cuts = [Y0, 0.3, 0.38, 0.47, 0.53, H] if bands else [Y0, H]
    for i, (a, b) in enumerate(zip(cuts, cuts[1:])):
        prof = [(r(a), a), (r(b), b)] + ([(0, b)] if b == H else [])
        sw = "plastic_white" if bands and i in (1, 3) else "fabric_orange"
        m.lathe(prof, sw, segments=seg)


cone(12)
m.lod(1)
cone(8)
m.lod(2)
cone(6, bands=False)
m.lod(0)

m.finish(lods=[0.5, 0.15], collider="box")
m.export()
m.preview()
m.sheet()
m.report()
