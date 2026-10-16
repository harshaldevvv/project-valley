"""Bone maps: our contract bone <- source BVH joint. Extra source joints (CMU LHipJoint/Neck1/fingers, Xsens extra
spine) are skipped: the transfer is per-bone world delta, so a skipped joint's rotation lands in its mapped child.
`rest_frame`: BVH frame (0-based) holding the T-pose reference, or None to use the BVH bind pose (zero rotations)."""

_SIDE = {"L": "Left", "R": "Right"}


def _limbs(fmt):
    m = {}
    for X, S in _SIDE.items():
        for ours, theirs in fmt.items():
            m[f"{ours}_{X}"] = theirs.format(S=S)
    return m


# cgspeed CMU BVH (MotionBuilder-style names, frame 0 = T-pose)
CMU = {
    "rest_frame": 0,
    "bones": {"hips": "Hips", "spine": "Spine", "chest": "Spine1", "neck": "Neck", "head": "Head",
              **_limbs({"shoulder": "{S}Shoulder", "upper_arm": "{S}Arm", "forearm": "{S}ForeArm", "hand": "{S}Hand",
                        "thigh": "{S}UpLeg", "shin": "{S}Leg", "foot": "{S}Foot", "toe": "{S}ToeBase"})},
    "leg": ("LeftLeg", "LeftFoot"),  # joints whose rest offsets sum to the leg length (thigh + shin)
}

# 100STYLE (Xsens 28-bone export, 60 fps, cm). Bind pose = T-pose facing +Z (BVH), so rest_frame None.
STYLE100 = {
    "rest_frame": None,
    "bones": {"hips": "Hips", "spine": "Chest2", "chest": "Chest4", "neck": "Neck", "head": "Head",
              **_limbs({"shoulder": "{S}Collar", "upper_arm": "{S}Shoulder", "forearm": "{S}Elbow", "hand": "{S}Wrist",
                        "thigh": "{S}Hip", "shin": "{S}Knee", "foot": "{S}Ankle", "toe": "{S}Toe"})},
    "leg": ("LeftKnee", "LeftAnkle"),
}
