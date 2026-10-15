"""zmb_civilian_f_a — female civilian zombie: long matted hair, red short-sleeve top, denim shorts, bare legs,
white sneakers. Narrower shoulders, wider hips, rig scale 0.93. Mesh-only: plays the shared zmb_shambler_a clips."""
import os
import sys

HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", "tools", "blender"))
sys.path.insert(0, os.path.join(HERE, "..", "_shared"))
import vrig  # noqa: E402
import zbody as Z  # noqa: E402
from zbody import R  # noqa: E402

ch = vrig.Character("zmb_civilian_f_a")
b = Z.build(ch, shirt="cloth_red", pants="cloth_denim", shoes=("plastic_white", "plastic_white"), sleeves=(0.12, 0.1),
            pants_end=(0.66, 0.63), boot_top=0.12, belly=True, shoulder=0.9, hip=1.1, chest=0.94, bust=0.02,
            hair="hair_light", hair_style="long")
Z.finish_variant(ch, scale=0.93)
