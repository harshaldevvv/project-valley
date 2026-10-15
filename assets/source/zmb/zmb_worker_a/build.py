"""zmb_worker_a — road/construction worker zombie: hi-vis vest, rolled sleeves, khaki work pants, work boots, hard hat.
Mesh-only: plays the shared zmb_shambler_a clips (identical skeleton). Rig scale 1.02."""
import os
import sys

HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", "tools", "blender"))
sys.path.insert(0, os.path.join(HERE, "..", "_shared"))
import vrig  # noqa: E402
import zbody as Z  # noqa: E402
from zbody import R  # noqa: E402

ch = vrig.Character("zmb_worker_a")
b = Z.build(ch, shirt="cloth_grey", pants="cloth_khaki", shoes=("leather_brown", "leather_brown"), sleeves=(0.36, 0.42),
            pants_end=(0.2, 0.2), boot_top=0.24, belly=False, shoulder=1.04, hip=1.02, hair="hair_light", limb=1.07)
VEST, STRIPE = "hazard_yellow", "road_paint_white"
b.loft([R(1.0, 0.168, 0.106, 0.114, VEST), R(1.1, 0.162, 0.108, 0.112, STRIPE), R(1.13, 0.164, 0.11, 0.112, VEST),
        R(1.26, 0.176, 0.118, 0.112, STRIPE), R(1.29, 0.18, 0.12, 0.11, VEST), R(1.44, 0.168, 0.106, 0.1, VEST),
        R(1.49, 0.12, 0.08, 0.084, VEST)], n=10, sq=2.5, w=Z.torso_w, cap0=False, cap1=False)
b.paint(lambda c, n: c.y > 0.05 and c.x > 0.0 and 1.0 < c.z < 1.2 and Z.h(c, 9) > 0.55, Z.BLOOD, only={VEST})
Z.dome(b, (0, 0.0, 1.735), 0.088, 0.075, "paint_yellow_faded", rim=0.018, y=0.01)
Z.finish_variant(ch, scale=1.02)
