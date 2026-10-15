"""zmb_soldier_a — soldier zombie: olive fatigues, tan plate carrier with pouches, helmet, black boots. Broad and
tall (rig scale 1.05) so it reads as the tougher one. Mesh-only: plays the shared zmb_shambler_a clips."""
import os
import sys

HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", "tools", "blender"))
sys.path.insert(0, os.path.join(HERE, "..", "_shared"))
import vrig  # noqa: E402
import zbody as Z  # noqa: E402
from zbody import R  # noqa: E402

ch = vrig.Character("zmb_soldier_a")
b = Z.build(ch, shirt="military_olive", pants="military_olive", shoes=("cloth_black", "cloth_black"), sleeves=(0.53, 0.3),
            pants_end=(0.22, 0.22), boot_top=0.27, belly=False, shoulder=1.1, hip=1.04, chest=1.06, hair="hair_dark", limb=1.18)
PC, POUCH = "military_tan", "cloth_khaki"
b.loft([R(1.08, 0.18, 0.13, 0.13, PC), R(1.08, 0.188, 0.14, 0.14, PC), R(1.17, 0.188, 0.14, 0.14, PC), R(1.17, 0.18, 0.13, 0.13, PC)],
       n=10, sq=3.0, w=Z.torso_w, cap0=False, cap1=False)  # cummerbund
for y in (0.142, -0.135):
    b.box((0, y, 1.3), (0.28, 0.045, 0.3), PC, Z.torso_w, bevel=0.012)  # plates
for x in (-0.085, 0.0, 0.085):
    b.box((x, 0.175, 1.2), (0.075, 0.04, 0.1), POUCH, Z.torso_w, bevel=0.008)  # mag pouches
for s in (1, -1):
    b.box((s * 0.1, 0.0, 1.452), (0.05, 0.24, 0.02), PC, Z.torso_w, bevel=0.006)  # shoulder straps
b.paint(lambda c, n: c.y > 0.1 and c.x < 0.03 and Z.h(c, 13) > 0.6, Z.BLOOD, only={PC})
Z.dome(b, (0, -0.006, 1.715), 0.098, 0.09, "military_olive", rim=0.01, y=0.008)
b.box((0, 0.08, 1.79), (0.05, 0.02, 0.03), "metal_dark", Z.HW)  # NVG mount
Z.finish_variant(ch, scale=1.05)
