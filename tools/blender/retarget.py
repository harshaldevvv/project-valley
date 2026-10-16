"""retarget.py - BVH mocap onto the vrig contract rig (docs/research/character-animation.md §2).

Used from an asset's build.py, inside the same Blender process as its vrig.Character:
    src = retarget.Source(path, mocap_maps.CMU)        # imports the BVH, samples at 30 fps, removes it again
    raw = src.frames(a, b)                             # [(Wq, hip_offset)] with root motion, heading = T-pose facing
    cyc = retarget.loop(raw)                           # seamless in-place cycle from left heel-strike, feet locked
    ch.clip_frames("walk", cyc.frames, loop=True)      # cyc.speed (m/s) and cyc.T go to src/content/data/anim.ts

Transfer: per mapped bone, world delta against a matched "same pose" reference. The source T-pose (cgspeed frame 0) is
matched by our rig with the arms raised 45 deg out of its A-pose:
    D = Q_src(t) * Q_src(Tpose)^-1      (re-expressed in our axes)      W_ours(t) = D * W_Tpose
Hips translation is scaled by leg length. Frames are (Wq, hip) where Wq[bone] is the world rotation relative to our
A-pose rest (vrig convention) and hip is the hips offset from rest, in metres.
"""
import math

import bpy
from mathutils import Quaternion, Vector

import vrig
from vrig import ANK, BONES, REST, SIDES, E, _frame, _two_bone, fk_positions

FPS = 30
LEG = (REST["thigh_R"][0] - REST["shin_R"][0]).length + (REST["shin_R"][0] - REST["foot_R"][0]).length
W_TPOSE = {f"{b}_{X}": E((0, -s * 45, 0)) for X, s in SIDES for b in ("upper_arm", "forearm", "hand")}


def _yaw(v):
    """Heading of a horizontal vector: 0 = +Y (forward), + = turned left."""
    return math.atan2(-v.x, v.y)


def _rz(a):
    return Quaternion((0, 0, 1), a)


def _mirror_q(q):
    return Quaternion((q.w, q.x, -q.y, -q.z))


class Source:
    def __init__(self, path, bmap):
        ft = next(float(line.split(":")[1]) for line in open(path) if line.startswith("Frame Time"))
        self.n_src = next(int(line.split(":")[1]) for line in open(path) if line.startswith("Frames"))
        self.step = max(1, round(1.0 / FPS / ft))
        before = set(bpy.data.objects)
        bpy.ops.import_anim.bvh(filepath=path, global_scale=1.0, use_fps_scale=False, rotate_mode="NATIVE",
                                axis_forward="-Z", axis_up="Y", update_scene_fps=False, update_scene_duration=False,
                                frame_start=0)
        self.ob = next(o for o in bpy.data.objects if o not in before)
        self.map = m = dict(bmap["bones"])
        bones = self.ob.data.bones
        a, b = bmap["leg"]  # knee, ankle joints: thigh + shin = leg length
        thigh = (bones[a].head_local - bones[a].parent.head_local).length
        self.s = LEG / (thigh + (bones[b].head_local - bones[a].head_local).length)
        rf = bmap.get("rest_frame", 0)
        self.rest = self._sample(rf)
        pr, pl = self._pos(rf, m["thigh_R"]), self._pos(rf, m["thigh_L"])
        fwd = Vector((0, 0, 1)).cross(pr - pl)
        self.A = _rz(-_yaw(fwd))  # source T-pose facing -> +Y
        self.zT = self._pos(rf, m["hips"]).z

    def _pos(self, f, name):
        """Joint position at BVH frame f (None = bind pose)."""
        if f is None:
            return self.ob.matrix_world @ self.ob.data.bones[name].head_local
        bpy.context.scene.frame_set(f)
        return self.ob.matrix_world @ self.ob.pose.bones[name].head

    def _sample(self, f):
        M = self.ob.matrix_world
        if f is None:  # bind pose: zero channel rotations (100STYLE's bind skeleton is a T-pose)
            bones = self.ob.data.bones
            q = {b: (M @ bones[n].matrix_local).to_3x3().normalized().to_quaternion() for b, n in self.map.items()}
            return q, M @ bones[self.map["hips"]].head_local
        bpy.context.scene.frame_set(f)
        q = {b: (M @ self.ob.pose.bones[n].matrix).to_3x3().normalized().to_quaternion() for b, n in self.map.items()}
        return q, M @ self.ob.pose.bones[self.map["hips"]].head

    def frames(self, a=1, b=None, step=None):
        """Retargeted frames for BVH frames a..b (inclusive) at 30 fps (or every `step` source frames)."""
        b = self.n_src - 1 if b is None else min(b, self.n_src - 1)
        out = []
        qr, _ = self.rest
        Ai = self.A.inverted()
        for f in range(a, b + 1, step or self.step):
            q, hp = self._sample(f)
            W = {}
            for bone in BONES:
                if bone not in q:
                    W[bone] = Quaternion()
                    continue
                D = self.A @ (q[bone] @ qr[bone].inverted()) @ Ai
                W[bone] = D @ W_TPOSE.get(bone, Quaternion())
            p = self.A @ (hp * self.s)
            hip = Vector((p.x, p.y, p.z - self.zT * self.s))
            out.append((W, hip))
        return out

    def close(self):
        ob = self.ob
        act = ob.animation_data.action if ob.animation_data else None
        arm = ob.data
        bpy.data.objects.remove(ob)
        bpy.data.armatures.remove(arm)
        if act:
            bpy.data.actions.remove(act)


# ------------------------------------------------------------------ frame-list processing (pure python)
def facing(W):
    return _yaw(W["hips"] @ Vector((0, 1, 0)))


def turn(frames, ang):
    """Rotate every frame about the vertical axis by ang (radians)."""
    q = _rz(ang)
    return [({b: q @ w for b, w in W.items()}, q @ h) for W, h in frames]


def align(frames, ref=None):
    """Turn so the mean hips facing (or `ref` heading) points +Y."""
    if ref is None:
        v = sum((W["hips"] @ Vector((0, 1, 0)) for W, _ in frames), Vector())
        ref = _yaw(v)
    return turn(frames, -ref)


def ankles(frames):
    out = []
    for W, h in frames:
        p = fk_positions(W, h)
        out.append({X: p[f"foot_{X}"] for X, _ in SIDES})
    return out


def ground(frames, pct=0.12):
    """Shift vertically so the planted ankle height equals our flat-foot ANK."""
    lows = sorted(min(a["L"].z, a["R"].z) for a in ankles(frames))
    dz = ANK - lows[int(len(lows) * pct)]
    return [(W, h + Vector((0, 0, dz))) for W, h in frames]


def contacts(frames, v=Vector((0, 0, 0)), zmax=ANK + 0.05, vmax=0.4, cyclic=False):
    """{X: [bool per frame]}: ankle low and moving with the ground (ground moves at -v in an in-place clip)."""
    an = ankles(frames)
    n = len(an)
    out = {}
    for X, _ in SIDES:
        c = []
        for i in range(n):
            j0, j1 = (i - 1) % n if cyclic else max(i - 1, 0), (i + 1) % n if cyclic else min(i + 1, n - 1)
            d = (an[j1][X] - an[j0][X]) * FPS / max(1, (j1 - j0) % n if cyclic else j1 - j0)
            sp = math.hypot(d.x + v.x, d.y + v.y)
            c.append(an[i][X].z < zmax and sp < vmax)
        # drop runs shorter than 3 frames
        for i in range(n):
            if c[i] and not any(c[(i + k) % n] if cyclic else (0 <= i + k < n and c[i + k]) for k in (-2, -1, 1, 2)):
                c[i] = False
        out[X] = c
    return out


def _locals(W):
    return {b: (W[REST[b][2]].inverted() @ W[b]) if REST[b][2] else W[b] for b in BONES}


def _worlds(L):
    W = {}
    for b in BONES:
        p = REST[b][2]
        W[b] = W[p] @ L[b] if p else L[b]
    return W


def _ang(a, b):
    """Rotation angle between two quaternions, sign-agnostic (q and -q are the same rotation)."""
    return 2 * math.acos(min(1.0, abs(a.dot(b))))


def pose_dist(fa, fb):
    la, lb = _locals(fa[0]), _locals(fb[0])
    d = sum(_ang(la[b], lb[b]) for b in BONES if b != "root")
    return d + 4 * abs(fa[1].z - fb[1].z) + abs(facing(fa[0]) - facing(fb[0]))


class Cycle:
    def __init__(self, frames, v, report):
        self.frames, self.v, self.report = frames, v, report
        self.T = len(frames) / FPS
        self.speed = v.length


def _travel_ok(frames, i, j, want):
    """Does the drift i->j point along `want` (x right, y forward, in the body frame at i)?"""
    if want is None:
        return True
    d = _rz(-facing(frames[i][0])) @ (frames[j][1] - frames[i][1])
    return d.xy.length > 1e-3 and d.xy.normalized().dot(Vector(want).normalized()) > 0.8


def loop(frames, min_T=0.5, max_T=2.4, lo=0.1, hi=0.9, foot="L", fixed=None, period=False, min_speed=0.0, face=False, want=None):
    """Cut the best seamless cycle between two `foot` heel-strikes, remove root drift, lock feet.
    fixed=(i, j): use these frame indices instead of searching. face: keep the hips facing +Y (strafe / backward
    clips) instead of turning the travel direction to +Y. want: required travel direction in the body frame."""
    frames = ground(frames)
    n0 = len(frames)
    if fixed:
        i, j = fixed
    else:
        c = contacts(frames)[foot]
        onsets = [k for k in range(1, n0) if c[k] and not c[k - 1] and lo * n0 <= k <= hi * n0]
        best = None
        for a_ in range(len(onsets) if not period else 0):
            for b_ in range(a_ + 1, len(onsets)):
                i, j = onsets[a_], onsets[b_]
                if not (min_T <= (j - i) / FPS <= max_T) or not _travel_ok(frames, i, j, want):
                    continue
                d = pose_dist(frames[i], frames[j])
                if best is None or d < best[0]:
                    best = (d, i, j)
        if not best:  # no clean heel-strikes (crawl, dragging foot): cut by pose periodicity instead
            step = 2
            for i in range(int(lo * n0), int(hi * n0), step):
                for j in range(i + int(min_T * FPS), min(int(hi * n0), i + int(max_T * FPS)) + 1):
                    if (frames[j][1] - frames[i][1]).xy.length < min_speed * (j - i) / FPS or not _travel_ok(frames, i, j, want):
                        continue
                    d = pose_dist(frames[i], frames[j])
                    if best is None or d < best[0]:
                        best = (d, i, j)
        if not best:
            raise RuntimeError(f"no cycle found (onsets {onsets})")
        _, i, j = best
    seg = frames[i:j + 1]
    n = j - i
    T = n / FPS
    d0 = seg[n][1] - seg[0][1]
    # face the travel direction (+Y) when there is travel, else the mean hips facing
    seg = align(seg, _yaw(Vector((d0.x, d0.y, 0))) if d0.xy.length > 0.1 * T and not face else None)
    drift = seg[n][1] - seg[0][1]
    v = Vector((drift.x, drift.y, 0)) / T
    # distribute the seam error over the cycle (rotations in parent space, hips linear)
    L0, Ln = _locals(seg[0][0]), _locals(seg[n][0])
    err = {b: L0[b] @ Ln[b].inverted() for b in BONES}
    out = []
    for f in range(n):
        u = f / n
        L = _locals(seg[f][0])
        L = {b: Quaternion().slerp(err[b], u) @ L[b] for b in BONES}
        out.append((_worlds(L), seg[f][1] - drift * u))
    mean = sum((h for _, h in out), Vector()) / n
    out = [(W, h - Vector((mean.x, mean.y, 0))) for W, h in out]
    out, rep = lock_feet(out, v, cyclic=True)
    rep["facing_vs_travel_deg"] = round(math.degrees(_yaw(sum((W["hips"] @ Vector((0, 1, 0)) for W, _ in out), Vector()))), 1)
    return Cycle(out, v, rep)


def lock_feet(frames, v=Vector((0, 0, 0)), cyclic=False, blend=3):
    """Hold each planted ankle on its ground track (moving at -v), re-solve thigh/shin with two-bone IK."""
    n = len(frames)
    con = contacts(frames, v, cyclic=cyclic)
    an = ankles(frames)
    targets = {X: [None] * n for X, _ in SIDES}
    weights = {X: [0.0] * n for X, _ in SIDES}
    slide = 0.0
    for X, _ in SIDES:
        c = con[X]
        if not any(c):
            continue
        if all(c):
            runs = [list(range(n))]
        else:
            start = next(k for k in range(n) if not c[k]) if cyclic else 0
            runs, cur = [], []
            for k in range(start, start + n if cyclic else n):
                kk = k % n
                if c[kk]:
                    cur.append(k)
                elif cur:
                    runs.append(cur)
                    cur = []
            if cur:
                runs.append(cur)
        for run in runs:
            # world-stationary point: ankle + v * t (unwrapped time)
            pts = [an[k % n][X] + v * (k / FPS) for k in run]
            anchor = sum(pts, Vector()) / len(pts)
            slide = max(slide, max((p - anchor).xy.length for p in pts))
            ext = list(range(run[0] - blend, run[-1] + blend + 1))
            for k in ext:
                kk = k % n if cyclic else k
                if not 0 <= kk < n:
                    continue
                w = 1.0 if run[0] <= k <= run[-1] else 1 - (min(abs(k - run[0]), abs(k - run[-1]))) / (blend + 1)
                if w > weights[X][kk]:
                    tgt = anchor - v * (k / FPS)
                    weights[X][kk] = smooth01(w)
                    targets[X][kk] = Vector((tgt.x, tgt.y, an[kk][X].z))
    out = []
    for f, (W, h) in enumerate(frames):
        W = dict(W)
        pos = fk_positions(W, h)
        for X, _ in SIDES:
            w = weights[X][f]
            if w <= 0:
                continue
            hipj, knee, ank = pos[f"thigh_{X}"], pos[f"shin_{X}"], pos[f"foot_{X}"]
            tgt = ank.lerp(targets[X][f], w)
            pole = knee - (hipj + ank) / 2
            if pole.length < 1e-3:
                pole = W["hips"] @ Vector((0, 1, 0))
            d1, d2, hinge = _two_bone(hipj, tgt, 0.425, 0.42, pole.normalized())
            rest = _frame(Vector((0, 0, -1)), Vector((1, 0, 0))).transposed()
            q1 = (_frame(d1, hinge) @ rest).to_quaternion()
            q2 = (_frame(d2, hinge) @ rest).to_quaternion()
            W[f"thigh_{X}"] = W[f"thigh_{X}"].slerp(q1, w)
            W[f"shin_{X}"] = W[f"shin_{X}"].slerp(q2, w)
        out.append((W, h))
    # residual slide after locking (m per frame)
    an2 = ankles(out)
    con2 = con
    res = 0.0
    for X, _ in SIDES:
        for f in range(1 if not cyclic else 0, n):
            g = f - 1
            if con2[X][f] and con2[X][g % n]:
                d = an2[f][X] - an2[g % n][X] + v / FPS
                res = max(res, d.xy.length)
    zmin = min(min(a["L"].z, a["R"].z) for a in an2) - ANK
    return out, dict(slide_before_m=round(slide, 3), slide_after_m_per_frame=round(res, 4), ankle_below_flat_m=round(zmin, 3),
                     contact_frac={X: round(sum(con[X]) / n, 2) for X, _ in SIDES})


def smooth01(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def oneshot(frames, inplace=True, lock=True, heading="start"):
    """One-shot clip: ground, face +Y at the start, optionally keep the root travel (inplace=False), lock planted feet."""
    frames = ground(frames)
    frames = align(frames, facing(frames[0][0]) if heading == "start" else None)
    h0 = frames[0][1]
    frames = [(W, h - Vector((h0.x, h0.y, 0))) for W, h in frames]
    if inplace:
        hn = frames[-1][1]
        n = len(frames) - 1
        frames = [(W, h - Vector((hn.x, hn.y, 0)) * (f / n)) for f, (W, h) in enumerate(frames)]
    rep = {}
    if lock:
        frames, rep = lock_feet(frames)
    return frames, rep


def mirror_frames(frames):
    """Left/right mirror of retargeted frames (swap sides, reflect across x = 0)."""
    sw = lambda b: b[:-1] + ("L" if b.endswith("R") else "R") if b[-2:] in ("_L", "_R") else b  # noqa: E731
    out = []
    for W, h in frames:
        # W is relative to our symmetric rest, so mirroring = reflect the rotation and swap the side
        out.append(({sw(b): _mirror_q(q) for b, q in W.items()}, Vector((-h.x, h.y, h.z))))
    return out


def _leg_ik(W, pos, X, tgt):
    hipj, knee, ank = pos[f"thigh_{X}"], pos[f"shin_{X}"], pos[f"foot_{X}"]
    pole = knee - (hipj + ank) / 2
    if pole.length < 1e-3:
        pole = W["hips"] @ Vector((0, 1, 0))
    d1, d2, hinge = _two_bone(hipj, tgt, 0.425, 0.42, pole.normalized())
    rest = _frame(Vector((0, 0, -1)), Vector((1, 0, 0))).transposed()
    W[f"thigh_{X}"] = (_frame(d1, hinge) @ rest).to_quaternion()
    W[f"shin_{X}"] = (_frame(d2, hinge) @ rest).to_quaternion()


def warp(cyc, speed, ts, lean=0.0, lift=1.0, direction=None):
    """Stride warp a forward in-place cycle to `speed` m/s: cadence x ts (resample), foot travel relative to the hips
    x k = speed / (v * ts) (planted feet then move at exactly -speed), pelvis lowered where the longer stride needs
    reach, legs re-solved with IK. lean: extra forward spine/chest pitch in degrees."""
    fr, n = cyc.frames, len(cyc.frames)
    n2 = max(4, round(n / ts))
    rs = []
    for f in range(n2):
        t = f * n / n2
        a, u = int(t) % n, t - int(t)
        b = (a + 1) % n
        (Wa, ha), (Wb, hb) = fr[a], fr[b]
        rs.append(({k: Wa[k].slerp(Wb[k], u) for k in Wa}, ha.lerp(hb, u)))
    k = speed / max(cyc.v.length * ts, 1e-6)
    u = cyc.v.normalized()  # travel direction (strafe / backward clips warp along their own direction)
    wd = Vector((*direction, 0)).normalized() if direction else u  # redirect foot travel exactly onto this direction
    an = ankles(rs)
    tg = {X: [] for X, _ in SIDES}
    for X, _ in SIDES:
        m = sum((a[X] for a in an), Vector()) / n2
        tg[X] = []
        for a in an:
            along = (a[X] - m).dot(u)
            p = a[X] - u * along + wd * (k * along)
            tg[X].append(Vector((p.x, p.y, ANK + max(a[X].z - ANK, 0) * lift)))
    # pelvis drop where the new ankle targets are out of reach
    L = LEG * 0.985
    dz = []
    for f, (W, h) in enumerate(rs):
        pos = fk_positions(W, h)
        need = 0.0
        for X, _ in SIDES:
            d = tg[X][f] - pos[f"thigh_{X}"]
            dh = d.xy.length
            reach = math.sqrt(max(L * L - dh * dh, 0.01))
            need = min(need, (tg[X][f].z + reach) - pos[f"thigh_{X}"].z)
        dz.append(need)
    dz = [sum(dz[(f + o) % n2] for o in (-2, -1, 0, 1, 2)) / 5 for f in range(n2)]  # smooth (cyclic)
    out = []
    for f, (W, h) in enumerate(rs):
        W, h = dict(W), h + Vector((0, 0, dz[f]))
        if lean:
            W = _lean(W, lean)
        pos = fk_positions(W, h)
        for X, _ in SIDES:
            _leg_ik(W, pos, X, tg[X][f])
        out.append((W, h))
    c = Cycle(out, wd * speed, dict(cyc.report, warp=dict(ts=round(ts, 3), stride_k=round(k, 3), pelvis_drop_max_m=round(-min(dz), 3))))
    return c


def _lean(W, deg):
    """Pitch the upper body forward by deg (spine 50%, chest 50%), children follow (world rotations re-derived)."""
    L = _locals(W)
    L["spine"] = E((-deg * 0.5, 0, 0)) @ L["spine"]
    L["chest"] = E((-deg * 0.5, 0, 0)) @ L["chest"]
    L["neck"] = E((deg * 0.4, 0, 0)) @ L["neck"]
    return _worlds(L)


def tweak(frames, head=0.0, neck=0.0, spine=0.0):
    """Add pitch (degrees, + = up / back) to head, neck, spine in parent space; children follow."""
    out = []
    for W, h in frames:
        L = _locals(W)
        for b, d in (("head", head), ("neck", neck), ("spine", spine)):
            if d:
                L[b] = E((d, 0, 0)) @ L[b]
        out.append((_worlds(L), h))
    return out


def build_clips(root, specs):
    """specs: [(name, source, kind, opt)] -> [(name, frames, loop, meta)].
    source: "cmu/104_41" or "100style/Neutral/Neutral_FW" (under assets/mocap/, .bvh). kind: "loop" | "oneshot".
    opt: loop() keys (min_T, max_T, lo, hi, foot, period, min_speed, face, want), range=(a, b) in 30 fps frames,
    warp=(speed, ts, lean, lift), mirror, head/neck/spine pitch tweak, src_max (seconds of source to read)."""
    import os

    import mocap_maps
    out = []
    cache = {}
    for name, source, kind, opt in specs:
        key = (source, opt.get("range"), opt.get("src_max", 40))
        if key not in cache:
            src = Source(os.path.join(root, "assets", "mocap", source + ".bvh"), mocap_maps.STYLE100 if source.startswith("100style") else mocap_maps.CMU)
            a, b = opt.get("range", (None, None))
            st = src.step
            cache[key] = src.frames((a or 0) * st + 1, b * st if b else int(opt.get("src_max", 40) * FPS * st))
            src.close()
        raw = cache[key]
        meta = dict(source=source)
        if kind == "loop":
            cyc = loop(raw, **{k: v for k, v in opt.items() if k in ("min_T", "max_T", "lo", "hi", "foot", "period", "min_speed", "face", "want")})
            if opt.get("face_blend"):  # turn the body part-way toward the travel direction, then send the feet straight
                dev = math.radians(cyc.report["facing_vs_travel_deg"]) * opt["face_blend"]
                cyc.frames = turn(cyc.frames, -dev)
                cyc.v = _rz(-dev) @ cyc.v
                cyc = warp(cyc, cyc.speed, 1.0, direction=(0, 1))
                cyc.report["facing_vs_travel_deg"] = round(math.degrees(_yaw(sum((W["hips"] @ Vector((0, 1, 0)) for W, _ in cyc.frames), Vector()))), 1)
            if "warp" in opt:
                cyc = warp(cyc, *opt["warp"])
            fr, v, rep = cyc.frames, cyc.v, cyc.report
            meta.update(speed=round(v.length, 3), cycle=round(len(fr) / FPS, 3),
                        dir=[round(v.x / max(v.length, 1e-6), 2), round(v.y / max(v.length, 1e-6), 2)])
        else:
            seg = raw
            if "turn" in opt:
                i, j = find_turn(raw, opt["turn"])
                seg = raw[max(0, i - 3):j + 4]
                meta["turn_deg"] = round(math.degrees(facing(raw[j][0]) - facing(raw[i][0])), 1)
            fr, rep = oneshot(seg, inplace=opt.get("inplace", True), lock=opt.get("lock", True))
            meta.update(duration=round((len(fr) - 1) / FPS, 3))
        if opt.get("arms"):
            fr = amp_arms(fr, opt["arms"])
        if any(opt.get(k) for k in ("head", "neck", "spine")):
            fr = tweak(fr, opt.get("head", 0), opt.get("neck", 0), opt.get("spine", 0))
        if opt.get("mirror"):
            fr = mirror_frames(fr)
            if "dir" in meta:
                meta["dir"][0] = -meta["dir"][0]
        meta.update(rep)
        if kind == "loop":  # seam pose jump vs a normal frame step (1.0 = invisible)
            steps = [pose_dist(fr[i], fr[i + 1]) for i in range(len(fr) - 1)]
            meta["seam_ratio"] = round(pose_dist(fr[-1], fr[0]) / max(sum(steps) / len(steps), 1e-6), 2)
            meta["seam_deg"] = round(math.degrees(pose_dist(fr[-1], fr[0])), 1)
        out.append((name, fr, kind == "loop", meta))
    return out


def find_turn(frames, deg, min_T=0.8, max_T=1.8):
    """(i, j) of the window whose hips yaw change is closest to `deg` (+ = left) with little travel and a calm
    start and end (low yaw rate). For turn-in-place clips."""
    yaw = [facing(W) for W, _ in frames]
    for k in range(1, len(yaw)):  # unwrap
        while yaw[k] - yaw[k - 1] > math.pi:
            yaw[k] -= 2 * math.pi
        while yaw[k] - yaw[k - 1] < -math.pi:
            yaw[k] += 2 * math.pi
    rate = [abs(yaw[min(k + 1, len(yaw) - 1)] - yaw[max(k - 1, 0)]) * FPS / 2 for k in range(len(yaw))]
    best = None
    want = math.radians(deg)
    for i in range(len(frames)):
        for j in range(i + int(min_T * FPS), min(len(frames), i + int(max_T * FPS))):
            travel = (frames[j][1] - frames[i][1]).xy.length
            cost = abs((yaw[j] - yaw[i]) - want) * 2 + travel + 0.5 * (rate[i] + rate[j])
            if best is None or cost < best[0]:
                best = (cost, i, j)
    return best[1], best[2]


def amp_arms(frames, k, bones=("upper_arm", "forearm")):
    """Scale each arm bone's swing about its cycle-mean local rotation by k (sprint arm pump from a jog)."""
    Ls = [_locals(W) for W, _ in frames]
    names = [f"{b}_{X}" for b in bones for X, _ in SIDES]
    mean = {}
    for b in names:
        acc = Quaternion((0, 0, 0, 0))
        ref = Ls[0][b]
        for L in Ls:
            q = L[b] if L[b].dot(ref) >= 0 else -L[b]
            acc = Quaternion([x + y for x, y in zip(acc, q)])
        mean[b] = acc.normalized()
    out = []
    for (W, h), L in zip(frames, Ls):
        for b in names:
            d = mean[b].inverted() @ L[b]
            ax, ang = d.to_axis_angle()
            if ang > math.pi:
                ang -= 2 * math.pi
            L[b] = mean[b] @ Quaternion(ax, ang * k)
        out.append((_worlds(L), h))
    return out
