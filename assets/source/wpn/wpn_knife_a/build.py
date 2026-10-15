"""wpn_knife_a — fixed-blade combat knife (KA-BAR-like): 0.30 m overall, 0.18 m clip-point blade.
Origin at the grip centre, blade along -Z, edge down (-Y). Stacked-leather grip, steel guard and pommel.
Sockets: grip (origin), tip (blade point, for melee traces).
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", "tools", "blender"))
import vlib  # noqa: E402

m = vlib.Builder("wpn_knife_a")
G0 = -0.058  # guard position (z)

# blade: spine (thicker, dark) + ground edge (thinner, bare steel) as two extrusions of the side profile
spine = [(G0, 0.012), (G0 - 0.12, 0.012), (G0 - 0.155, 0.004), (G0 - 0.18, 0.0), (G0 - 0.17, -0.004),
         (G0 - 0.12, -0.004), (G0, -0.004)]
edge = [(G0, -0.003), (G0 - 0.12, -0.003), (G0 - 0.168, -0.003), (G0 - 0.18, 0.0), (G0 - 0.168, -0.01),
        (G0 - 0.13, -0.016), (G0 - 0.02, -0.016), (G0 - 0.006, -0.012)]
m.extrude(spine, 0.006, "metal_gun", axis="x", bevel=0.001)
m.extrude(edge, 0.0035, "metal_bare", axis="x")
m.box((0, 0.002, G0 - 0.07), (0.0065, 0.004, 0.09), "metal_dark")  # fuller
# guard
m.box((0, -0.003, G0 + 0.004), (0.018, 0.05, 0.008), "metal_dark", bevel=0.002)
# grip: ridged stacked-leather washers, oval section
prof = [(0.0, 0.0)]
z = 0.0
for i in range(6):
    prof += [(0.0135, z + 0.003), (0.0145, z + 0.009), (0.0135, z + 0.016)]
    z += 0.0175
prof.append((0.0, z))
m.lathe(prof, "leather_brown", center=(0, -0.002, G0 + 0.008), segments=8, axis="z", scale=(0.75, 1, 1))
# pommel
m.lathe([(0.0, 0.0), (0.012, 0.0), (0.014, 0.008), (0.011, 0.016), (0.0, 0.018)], "metal_dark",
        center=(0, -0.002, G0 + 0.008 + z), segments=8, axis="z", scale=(0.8, 1, 1))
m.socket("grip", (0, 0, 0))
m.socket("tip", (0, 0, G0 - 0.18))
m.finish(lods=[0.5], collider="box")
m.export()
m.preview()
m.sheet(figure=False)
m.report()
