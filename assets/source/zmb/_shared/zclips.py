"""Shared zombie clips (z_*), authored once on the contract rig and exported only in zmb_shambler_a.
Every zmb_* variant uses the identical skeleton, so these clips play on any variant by bone name."""
import math

from vrig import ANK, gait, keys, smooth, stance  # noqa: F401

# =============================================================================== clips (z_*)
S2 = math.sin
TAU = 2 * math.pi


def z_idle(t):
    b_, s_ = S2(TAU * t / 3), S2(TAU * t / 3 + 0.8)
    P = stance(dx=0.02 * s_, stagger=0.12, z=-0.06, w=0.13, toe_out=14)
    P.update(fRy=-4, hipR=(-8, 3 * s_, 4 * s_), spine=(-14, 0, 3 * s_), chest=(-12 + 1.5 * b_, 4, -3 * s_), neck=(8, 0, 0),
             head=(16 + 3 * b_, 14 + 4 * s_, 6 * S2(TAU * t / 1.5)), shR=(0, 7, 0), shL=(0, -3, 6),
             aR=(10 + 3 * s_, 6, 25 + 4 * b_), aL=(22 - 3 * s_, 10, 38 + 3 * b_))
    return P


ZWALK = dict(v=1.2, T=1.0, duty=0.6, duty_R=0.66, duty_L=0.58, off_L=0.55, w=0.11, lift=0.09, lift_R=0.025, drag_R=1.0,
             reach=0.03, hs=10, hs_R=0.0, to=18, to_R=8, hip_z=-0.07, lean=30, roll=7, yaw=8, sway=0.045, nod=3,
             arms=(30, 8, 30, 10, 12))
ZRUN = dict(v=4.5, T=19 / 30, duty=0.32, w=0.1, lift=0.28, lpk=0.4, k0=0.15, reach=0.02, hs=4, to=22, hip_z=-0.07, comp=0.03,
            lean=30, roll=6, yaw=12, sway=0.02, nod=2, arms=(55, 25, 30, 20, 20))


def z_walk(t):
    P = gait(t, ZWALK)
    ph = TAU * t / ZWALK["T"]
    P["aR"] = (55 + 6 * S2(ph), 8, 18, 0)  # right arm reaching
    P["aL"] = (8 - 14 * math.cos(ph - 0.6), 10, 30 + 10 * S2(ph - 1.0))  # left arm dangling, lagging swing
    P["head"] = (P["head"][0] + 10, 12 + 6 * S2(ph), 6 * S2(ph + 0.5))
    P["shR"] = (0, -4, 8)
    return P


def z_run(t):
    P = gait(t, ZRUN)
    ph = TAU * t / ZRUN["T"]
    P["aR"] = (70 + 22 * math.cos(ph), 18, 25 + 15 * S2(ph))
    P["aL"] = (75 - 22 * math.cos(ph + 0.4), 22, 30 - 15 * S2(ph))
    P["head"] = (P["head"][0] + 14, 6 * S2(ph), 0)
    return P


IDLE0 = z_idle(0)


def z_attack(t):  # 0.6 s telegraphed wind-up, swipe lands ~0.72 s
    up = dict(aR=(150, 30, 70), aL=(140, 34, 75), chest=(12, 0, -14), spine=(6, 0, -6), head=(4, 8, 0), hip=(0, -0.06, -0.08))
    return {**IDLE0, **keys(t, [
        (0.0, {k: IDLE0[k] for k in ("aR", "aL", "chest", "spine", "head", "hip")}, 0),
        (0.45, up, 0.3),
        (0.6, {**up, "aR": (158, 32, 72), "chest": (14, 0, -16)}, 0),
        (0.72, dict(aR=(35, 8, 12), aL=(55, 14, 20), chest=(-32, 0, 18), spine=(-16, 0, 8), head=(24, 4, 0), hip=(0, 0.1, -0.12)), 0),
        (0.82, dict(aR=(5, 12, 30), aL=(25, 16, 30), chest=(-30, 0, 22), spine=(-16, 0, 10), head=(22, 6, 0), hip=(0, 0.1, -0.12)), 0),
        (1.1, {k: IDLE0[k] for k in ("aR", "aL", "chest", "spine", "head", "hip")}, 0)])}


def z_grab(t):  # lunge, clutch, bite
    base = {k: IDLE0[k] for k in ("aR", "aL", "chest", "spine", "neck", "head", "hip")}
    reach = dict(aR=(88, 6, 8, 0), aL=(88, 6, 8, 0), chest=(-22, 0, 0), spine=(-14, 0, 0), neck=(10, 0, 0), head=(16, 0, 0), hip=(0, 0.1, -0.1))
    clutch = dict(aR=(72, -6, 80, 30), aL=(72, -6, 80, 30), chest=(-20, 0, 0), spine=(-12, 0, 0), neck=(14, 0, 0), head=(14, 0, 0), hip=(0, 0.08, -0.1))
    bite = {**clutch, "chest": (-30, 0, 0), "neck": (24, 0, 0), "head": (24, 0, 0), "hip": (0, 0.12, -0.12)}
    return {**IDLE0, **keys(t, [(0.0, {**base, "aR": (*base["aR"], 0), "aL": (*base["aL"], 0)}, 0), (0.25, reach, 0.4), (0.45, clutch, 0),
                                (0.7, bite, 0), (0.8, {**bite, "head": (26, 0, 10)}), (0.9, {**bite, "head": (26, 0, -10)}),
                                (1.2, {**base, "aR": (*base["aR"], 0), "aL": (*base["aL"], 0)}, 0)])}


def z_hit(t):
    base = {k: IDLE0[k] for k in ("chest", "spine", "head", "hip", "aR", "aL")}
    hit = dict(chest=(4, 6, 10), spine=(0, 0, 4), head=(-14, 20, -12), hip=(0, -0.05, -0.07), aR=(25, 30, 40), aL=(30, 28, 45))
    return {**IDLE0, **keys(t, [(0.0, base, 0), (0.07, hit, 0), (0.4, base, 0)])}


def z_stagger(t):
    base = {k: IDLE0[k] for k in ("chest", "spine", "head", "hip", "aR", "aL", "fR", "fL", "fRp", "fLp")}
    back = dict(chest=(18, 0, 6), spine=(10, 0, 0), head=(-10, 18, 0), hip=(0, -0.1, -0.05), aR=(55, 45, 30), aL=(40, 50, 40))
    step1 = {**back, "fR": (0.13, -0.22, ANK + 0.08), "fRp": 10, "hip": (0, -0.14, -0.06)}
    step1b = {**back, "fR": (0.13, -0.3, ANK), "fRp": 0, "hip": (0, -0.16, -0.08), "chest": (8, 0, 4)}
    step2 = {**step1b, "fL": (-0.13, -0.18, ANK + 0.07), "fLp": 8, "chest": (-4, 0, 0), "aR": (30, 30, 30)}
    return {**IDLE0, **keys(t, [(0.0, base, 0), (0.12, back, 0.4), (0.3, step1, 0.5), (0.42, step1b, 0), (0.6, step2, 0.5),
                                (0.75, {**step2, "fL": (-0.13, -0.26, ANK), "fLp": 0}, 0), (1.0, base, 0)])}


def z_death(t):  # buckle to the knees, topple face down
    return keys(t, [
        (0.0, dict(hip=(0, 0, -0.06), hipR=(-8, 0, 0), spine=(-14, 0, 0), chest=(-12, 4, 0), neck=(8, 0, 0), head=(16, 14, 0),
                   lR=(4, 4, 8, -4), lL=(-4, 4, 8, -4), aR=(10, 6, 25), aL=(22, 10, 38)), 0),
        (0.35, dict(hip=(0, -0.05, -0.42), hipR=(-5, 0, 6), spine=(-6, 0, 0), chest=(-4, 0, 0), head=(-10, 20, 0),
                    lR=(10, 6, 115, 20), lL=(4, 8, 118, 22), aR=(5, 15, 15), aL=(8, 15, 20))),
        (0.5, dict(hip=(0, -0.02, -0.5), hipR=(-15, 0, 8), lR=(18, 6, 125, 30), lL=(10, 8, 128, 30), aR=(20, 20, 20), aL=(25, 18, 25)), 0.6),
        (0.9, dict(hip=(0, 0.25, -0.75), hipR=(-60, 4, 12), spine=(-6, 0, 0), chest=(-4, 0, 0), head=(10, 10, 0), lR=(-20, 8, 70, 30), lL=(-25, 10, 75, 30),
                   aR=(60, 30, 30), aL=(65, 28, 35)), 0.8),
        (1.1, dict(hip=(0, 0.42, -0.84), hipR=(-88, 4, 12), spine=(0, 0, 0), chest=(0, 0, 0), head=(20, 0, 30), lR=(-4, 8, 3, 60), lL=(-6, 10, 6, 60),
                   aR=(10, 70, 30), aL=(20, 60, 50)), 0),
        (1.22, dict(hip=(0, 0.42, -0.82), head=(16, 0, 34)), 0.5),
        (1.5, dict(hip=(0, 0.42, -0.84), head=(20, 0, 40), aR=(8, 75, 35), aL=(18, 62, 55)), 0)])


CRAWL_T, CRAWL_V = 1.6, 0.6


def z_crawl(t):  # prone, dragging itself with the arms; hands planted move back at CRAWL_V (no sliding)
    ph = (t / CRAWL_T) % 1.0
    P = dict(space="world", hip=(0, -0.38, -0.8), hipR=(-84, 0, 4 * math.cos(TAU * ph)), spine=(10, 0, -4 * math.cos(TAU * ph)),
             chest=(10 + 2 * S2(TAU * ph), 4 * S2(TAU * ph), -4 * math.cos(TAU * ph)), neck=(25, 0, 0), head=(32, 8 * S2(TAU * ph), 0),
             lR=(-6, 8, 2 + 3 * S2(TAU * ph), 60), lL=(-6, 10, 4 - 3 * S2(TAU * ph), 60))
    duty = 0.6
    y0, y1 = 0.62, 0.62 - CRAWL_V * duty * CRAWL_T
    for X, s, off in (("R", 1, 0.0), ("L", -1, 0.5)):
        psi = (ph - off) % 1.0
        if psi < duty:
            y, z = y0 + (y1 - y0) * psi / duty, 0.045
        else:
            u = (psi - duty) / (1 - duty)
            y, z = y1 + (y0 - y1) * smooth(u), 0.045 + 0.16 * S2(math.pi * u)
        P.update({"g" + X: (s * 0.24, y, z), "g" + X + "f": (s * 0.3, 1, -0.4), "g" + X + "u": (-s, 0, 0.3), "e" + X: (s, -0.3, 0.6)})
    return P


CLIPS = [("z_idle", 3.0, z_idle, True), ("z_walk", ZWALK["T"], z_walk, True), ("z_run", ZRUN["T"], z_run, True),
         ("z_attack", 1.1, z_attack, False), ("z_grab", 1.2, z_grab, False), ("z_hit", 0.4, z_hit, False),
         ("z_stagger", 1.0, z_stagger, False), ("z_death", 1.5, z_death, False), ("z_crawl", CRAWL_T, z_crawl, True)]


def cyc(T, n=6):
    return [round(T * i / n, 4) for i in range(n)]


SHEETS = {  # `blender -b --python build.py -- --sheets 1`
    "turnaround": [(None, [0], y, 8, 3.3, 0.92) for y in (0, 90, 180, 35)] + [(None, [0], 25, 5, 0.9, 1.68), (None, [0], 0, 8, 3.3, 0.92, None, 1),
                                                                            (None, [0], 0, 8, 3.3, 0.92, None, 2), ("z_idle", [0], 180, 22, 2.6, 1.3)],
    "clips": [("z_idle", [0, 1.5], 30, 8, 3.3, 0.9), ("z_walk", cyc(ZWALK["T"]), 90, 8, 3.3, 0.9), ("z_walk", cyc(ZWALK["T"], 3), 0, 8, 3.3, 0.9),
              ("z_run", cyc(ZRUN["T"]), 90, 8, 3.3, 0.9), ("z_attack", [0.3, 0.6, 0.72, 0.82], 40, 8, 3.3, 0.9),
              ("z_grab", [0.25, 0.45, 0.7], 90, 8, 3.3, 0.9), ("z_hit", [0.07], 30, 8, 3.3, 0.9), ("z_stagger", [0.12, 0.3, 0.6], 90, 8, 3.3, 0.9),
              ("z_death", [0.35, 0.5, 0.9, 1.5], 90, 15, 3.4, 0.6), ("z_crawl", cyc(CRAWL_T, 4), 90, 15, 3.4, 0.4)],
}



# =============================================================================== mocap clips (retarget.build_clips)
# name, source under assets/mocap/ (100STYLE CC BY 4.0, CMU via cgspeed BVH), kind, options. Native paces fit the game's
# zombie speeds (wander ~0.5, chase ~1.3 m/s); play at authored speed x timeScale (anim/zmb_shambler_a.json).
S100 = "100style/{0}/{0}_{1}"
MOCAP = [
    ("z_walk", S100.format("Zombie", "FW"), "loop", dict(max_T=3)),          # 100STYLE Zombie
    ("z_walk_b", "cmu/104_41", "loop", {}),                                  # CMU 104_41 ZombieWalk: arms raised
    ("z_walk_c", "cmu/120_22", "loop", dict(foot="R", face_blend=0.6)),  # CMU 120_22 hunched
    ("z_walk_d", "cmu/104_03", "loop", {}),                                  # CMU 104_03 Frankenstein walk
    ("z_walk_limp", S100.format("LimpLeft", "FW"), "loop", dict(max_T=3)),
    ("z_walk_limp_r", S100.format("LimpRight", "FW"), "loop", dict(max_T=3)),
    ("z_walk_drag", S100.format("DragLeftLeg", "FW"), "loop", dict(max_T=3, face_blend=0.6)),
    ("z_walk_drag_r", S100.format("DragRightLeg", "FW"), "loop", dict(max_T=3, face_blend=0.6)),
    ("z_walk_drunk", S100.format("Drunk", "FW"), "loop", dict(max_T=3)),
    ("z_walk_old", S100.format("Old", "FW"), "loop", dict(max_T=3)),
    ("z_walk_bent", S100.format("BentForward", "FW"), "loop", dict(max_T=3)),
    ("z_run", S100.format("Zombie", "FR"), "loop", {}),                      # lurching chase
    ("z_run_b", S100.format("Drunk", "FR"), "loop", dict(face_blend=0.6)),
    ("z_idle", S100.format("Zombie", "ID"), "loop", dict(period=True, min_T=3.0, max_T=6.0)),
    ("z_idle_b", S100.format("Depressed", "ID"), "loop", dict(period=True, min_T=3.0, max_T=6.0)),
    ("z_idle_c", S100.format("Old", "ID"), "loop", dict(period=True, min_T=3.0, max_T=6.0)),
    ("z_crawl_b", "cmu/111_03", "loop", dict(face_blend=1.0, period=True, min_T=1.0, max_T=3.0, lo=0.15, hi=0.6, min_speed=0.12)),  # hands and knees
    ("z_stagger", "cmu/105_59", "oneshot", dict(range=(12, 62))),            # CMU 105_59 small stumble
]


def mocap_clips(root):
    import os
    import sys
    sys.path.insert(0, os.path.join(root, "tools", "blender"))
    import retarget
    return retarget.build_clips(root, MOCAP)
