"""chr_arms_fp — first-person viewmodel arms matching chr_survivor_a (olive sleeves, khaki-olive cuffs, skin_3 hands).
Run: blender --background --python build.py [-- --sheets 1]   (sheets = also render FP-camera preview sheets)

Space (this file): Blender, metres, origin = the eye (camera), +Y = view forward (glTF -Z), +Z up, +X right.
Exported: fp_root joint at the origin, so parenting the scene root to the camera puts the arms in view.

Hands: rest pose = arms straight forward, thumbs up, fingers curled into a grip around HOLE. Rigid finger blocks
(fingers_* proximal mitt, fingertips_* distal mitt, thumb_*), open = negative curl.
Sockets (non-deforming bones; glTF node -Z = forward, +Y = up, like the weapons):
  SOCKET_weapon (hand_R)    weapon SOCKET_grip goes here (identity) for guns; grip raked RAKE deg
  SOCKET_knife (hand_R)     knife SOCKET_grip goes here (blade out of the thumb side, edge toward the knuckles)
  SOCKET_support_L (hand_L) left fist pole axis (-Z along the thumb), clips put it on the rifle's SOCKET_support
  SOCKET_mag_L (hand_L)     a MAG node in the left hand: same frame as the weapon's SOCKET_mag at insertion
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "tools", "blender"))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Quaternion, Vector  # noqa: E402

import vlib  # noqa: E402
import vrig  # noqa: E402
from vrig import _frame, _two_bone, keys, smooth  # noqa: E402

ID = "chr_arms_fp"
SKIN, JACKET, TRIM = "skin_3", "cloth_olive", "military_olive"
FPS = 30
UA, FA = 0.31, 0.29  # a touch longer than chr_survivor_a (0.29/0.255): FP arms must reach the rifle handguard
SH = {"R": Vector((0.19, -0.07, -0.21)), "L": Vector((-0.19, -0.07, -0.21))}  # shoulder joints from the eye
S_ = {"R": 1, "L": -1}
RAKE = 16.0
C1, C2 = 70.0, 105.0  # rest finger curl at the knuckle / mid joint
HOLE = (0.066, 0.0, 0.027)  # grip pole centre in the hand frame (along a, t, p)
A0, T0 = Vector((0, 1, 0)), Vector((0, 0, 1))


def P0(X):
    return Vector((-S_[X], 0, 0))  # rest palm normal (right palm faces left)


def WR(X):
    return SH[X] + A0 * (UA + FA)  # rest wrist


def hv(X, da, dt, dp):
    return A0 * da + T0 * dt + P0(X) * dp


def qrot(axis, deg):
    return Quaternion(Vector(axis).normalized(), math.radians(deg))


# --------------------------------------------------------------------------------------- sockets (rest, wrist-relative)
def _gun_frame(X):
    r = math.radians(RAKE)
    return A0 * math.cos(r) + T0 * math.sin(r), T0 * math.cos(r) - A0 * math.sin(r)


SOCK = {}
_f, _u = _gun_frame("R")
SOCK["SOCKET_weapon"] = ("R", hv("R", *HOLE), _f, _u)
SOCK["SOCKET_knife"] = ("R", hv("R", *HOLE), T0, -A0)
SOCK["SOCKET_support_L"] = ("L", hv("L", *HOLE), T0, P0("L"))
_f, _u = _gun_frame("L")
SOCK["SOCKET_mag_L"] = ("L", hv("L", *HOLE) + _u * 0.06, _f, _u)


def hand_from(sock, pos, f, u):
    """Hand frame (wrist, a, t) that puts socket `sock` at pos with node -Z = f, +Y = u (any space)."""
    _, off, f0, u0 = SOCK[sock]
    qh = (_frame(Vector(f), Vector(u)) @ _frame(f0, u0).transposed()).to_quaternion()
    return tuple(Vector(pos) - qh @ off), tuple(qh @ A0), tuple(qh @ T0)


# --------------------------------------------------------------------------------------- skeleton
BONES = ["fp_root"]
SKEL = [("fp_root", None, Vector((0, 0, 0)), Vector((0, 0.1, 0)))]
for X in ("R", "L"):
    s, sh, w = S_[X], SH[X], WR(X)
    k = A0.cross(P0(X))
    K = w + hv(X, 0.086, 0, 0.002)
    J = K + (qrot(k, C1) @ A0) * 0.048
    T = J + (qrot(k, C1 + C2) @ A0) * 0.04
    SKEL += [(f"upper_arm_{X}", "fp_root", sh, sh + A0 * UA),
             (f"forearm_{X}", f"upper_arm_{X}", sh + A0 * UA, w),
             (f"hand_{X}", f"forearm_{X}", w, K),
             (f"fingers_{X}", f"hand_{X}", K, J),
             (f"fingertips_{X}", f"fingers_{X}", J, T),
             (f"thumb_{X}", f"hand_{X}", w + hv(X, 0.04, 0.032, 0.012), w + hv(X, 0.093, 0.044, 0.047))]
BONES = [b[0] for b in SKEL]
REST = {b[0]: (b[2], b[3], b[1]) for b in SKEL}


class FPBody(vrig.Body):
    def _vert(self, co, w):
        v = self.bm.verts.new(co)
        w = w(co) if callable(w) else w
        tot = sum(w.values())
        for b, x in w.items():
            if x > 1e-4:
                v[self.dl][BONES.index(b)] = x / tot
        return v


# --------------------------------------------------------------------------------------- mesh
def build_mesh(b):
    for X in ("R", "L"):
        sh, w = SH[X], WR(X)
        up, fo, ha = f"upper_arm_{X}", f"forearm_{X}", f"hand_{X}"

        def A(u):
            return tuple(sh + A0 * u)
        # sleeve: cut (capped) 0.14 above the elbow -> forearm -> cuff band -> wrist
        b.loft([dict(c=A(UA - 0.14), r=0.054, w={up: 1}), dict(c=A(UA - 0.07), r=(0.053, 0.052), w={up: 1}),
                dict(c=A(UA - 0.02), r=0.05, w={up: 0.65, fo: 0.35}), dict(c=A(UA + 0.025), r=0.049, w={up: 0.25, fo: 0.75}),
                dict(c=A(UA + 0.07), r=(0.052, 0.047), w={fo: 1}), dict(c=A(UA + 0.13), r=(0.05, 0.047), w={fo: 1}, jag=0.004),
                dict(c=A(UA + 0.19), r=(0.046, 0.044), w={fo: 1}),
                dict(c=A(UA + FA - 0.05), r=(0.044, 0.042), w={fo: 1}, sw=TRIM),
                dict(c=A(UA + FA - 0.018), r=(0.047, 0.045), w={fo: 1}, sw=TRIM),
                dict(c=A(UA + FA - 0.018), r=(0.03, 0.025), w={fo: 0.85, ha: 0.15}, sw=SKIN),
                dict(c=A(UA + FA + 0.006), r=(0.028, 0.022), w={fo: 0.4, ha: 0.6})],
               n=10, side=(1, 0, 0), fwd=(0, 0, 1), sw=JACKET, sq=2.3, cap1=False)
        hand(b, X)


def hand(b, X):
    w = WR(X)
    a, t, p = A0, T0, P0(X)
    ha, fi, ft, th = f"hand_{X}", f"fingers_{X}", f"fingertips_{X}", f"thumb_{X}"

    def P(da, dt, dp):
        return tuple(w + hv(X, da, dt, dp))
    # palm: width along t, thickness along p (palm side = +p)
    b.loft([dict(c=P(-0.012, 0, 0), r=(0.027, 0.018, 0.018), w={ha: 0.6, f"forearm_{X}": 0.4}),
            dict(c=P(0.02, 0.003, 0.0), r=(0.036, 0.016, 0.016)), dict(c=P(0.058, 0.0, 0.002), r=(0.042, 0.015, 0.014)),
            dict(c=P(0.09, -0.002, 0.003), r=(0.04, 0.0135, 0.013))],
           n=8, fwd=p, side=t, sw=SKIN, w={ha: 1}, sq=3.2, cap1=True)
    # thenar pad + 2-segment thumb (rigid on thumb_X), modelled wrapped around the grip
    b.loft([dict(c=P(0.008, 0.02, 0.004), r=0.016), dict(c=P(0.045, 0.032, 0.014), r=0.0145)],
           n=6, fwd=p, side=t, sw=SKIN, w={ha: 1}, cap0=0.006, cap1=0.004)
    b.loft([dict(c=P(0.04, 0.032, 0.013), r=0.0125), dict(c=P(0.068, 0.04, 0.031), r=0.0115),
            dict(c=P(0.093, 0.044, 0.047), r=0.0102)], n=6, fwd=p, side=t, sw=SKIN, w={th: 1}, cap1=0.007)
    # fingers: proximal + distal mitt blocks (4 fingers as one), curled C1 / C1+C2 toward the palm
    K, J, T = REST[fi][0], REST[fi][1], REST[ft][1]
    d1, d2 = (J - K).normalized(), (T - J).normalized()
    b.loft([dict(c=tuple(K - d1 * 0.01), r=(0.04, 0.0115)), dict(c=tuple(J + d1 * 0.004), r=(0.039, 0.011))],
           n=8, fwd=p, side=t, sw=SKIN, w={fi: 1}, sq=3.5)
    b.loft([dict(c=tuple(J - d2 * 0.008), r=(0.037, 0.0105)), dict(c=tuple(T), r=(0.034, 0.0095))],
           n=8, fwd=p, side=t, sw=SKIN, w={ft: 1}, sq=3.5, cap1=0.005)


# --------------------------------------------------------------------------------------- rig object
class Arms:
    def __init__(self):
        vlib.reset_scene()
        sc = bpy.context.scene
        sc.render.fps = FPS
        self.root = bpy.data.objects.new(ID, None)
        sc.collection.objects.link(self.root)
        arm = bpy.data.armatures.new(f"{ID}_rig")
        self.arm = bpy.data.objects.new(f"{ID}_rig", arm)
        sc.collection.objects.link(self.arm)
        self.arm.parent = self.root
        bpy.context.view_layer.objects.active = self.arm
        bpy.ops.object.mode_set(mode="EDIT")
        for name, par, h, t in SKEL:
            eb = arm.edit_bones.new(name)
            eb.head, eb.tail = h, t
            eb.align_roll(Vector((0, 0, 1)) if abs((t - h).normalized().z) < 0.7 else Vector((0, 1, 0)))
            if par:
                eb.parent = arm.edit_bones[par]
            eb.use_deform = name != "fp_root"
        for name, (X, off, f0, u0) in SOCK.items():
            eb = arm.edit_bones.new(name)
            eb.head = WR(X) + off
            eb.tail = eb.head + u0 * 0.05  # node +Y = up
            eb.align_roll(-f0)  # node -Z = forward
            eb.parent = arm.edit_bones[f"hand_{X}"]
            eb.use_deform = False
        bpy.ops.object.mode_set(mode="OBJECT")
        self.Rq = {bn.name: bn.matrix_local.to_quaternion() for bn in arm.bones}
        for pb in self.arm.pose.bones:
            pb.rotation_mode = "QUATERNION"
        self.clips = []
        self.err = 0.0

    def finish(self, body):
        me = bpy.data.meshes.new(f"{ID}_LOD0")
        body.bm.to_mesh(me)
        ob = bpy.data.objects.new(me.name, me)
        bpy.context.scene.collection.objects.link(ob)
        for bn in BONES:
            ob.vertex_groups.new(name=bn)
        uv = me.uv_layers.new(name="UVMap")
        for poly in me.polygons:
            u, v = vlib.swatch_uv(body.swatches[poly.material_index], 0.62)
            for li in poly.loop_indices:
                uv.data[li].uv = (u, 1.0 - v)
        me.materials.append(vlib._palette_material())
        for poly in me.polygons:
            poly.material_index = 0
        ob.parent = self.arm
        ob.modifiers.new("arm", "ARMATURE").object = self.arm
        self.mesh = ob
        self.tris = sum(len(p.vertices) - 2 for p in me.polygons)

    # ---------- solve: params -> basis rotations ----------
    def solve(self, P):
        """P: per side X in P (dict w=wrist, a, t, e=elbow pole, o=shoulder offset, c=(fingers, tips, thumb) curl deg)."""
        Wq, pos, out, loc = {"fp_root": Quaternion()}, {"fp_root": Vector()}, {}, {}
        for X in ("R", "L"):
            if X not in P:
                continue
            H = P[X]
            s = S_[X]
            a, t = Vector(H["a"]).normalized(), Vector(H["t"])
            qh = (_frame(a, t) @ _frame(A0, T0).transposed()).to_quaternion()
            off = Vector(H.get("o", (0, 0, 0)))
            sh = SH[X] + off
            wrist = Vector(H["w"])
            d1, d2, hinge = _two_bone(sh, wrist, UA, FA, Vector(H["e"]))
            self.err = max(self.err, (sh + d1 * UA + d2 * FA - wrist).length)
            hr = Vector((-1, 0, 0))
            q1 = (_frame(d1, hinge) @ _frame(A0, hr).transposed()).to_quaternion()
            q2 = (_frame(d2, hinge) @ _frame(A0, hr).transposed()).to_quaternion()
            rel = q2.inverted() @ qh  # share the wrist twist with the forearm (no candy-wrapper wrist)
            v = Vector(rel[1:]).project(A0)
            tw = Quaternion((rel[0], *v))
            if tw.magnitude > 1e-6:
                q2 = q2 @ Quaternion().slerp(tw.normalized(), 0.5)
            c = H.get("c", (0, 0, 0))
            k = A0.cross(P0(X))
            Wq[f"upper_arm_{X}"], Wq[f"forearm_{X}"], Wq[f"hand_{X}"] = q1, q2, qh
            Wq[f"fingers_{X}"] = qh @ qrot(k, c[0])
            Wq[f"fingertips_{X}"] = Wq[f"fingers_{X}"] @ qrot(k, c[1])
            Wq[f"thumb_{X}"] = qh @ qrot(A0 * s, -c[2])
            loc[f"upper_arm_{X}"] = self.Rq[f"upper_arm_{X}"].inverted() @ off
            for bn in (f"upper_arm_{X}", f"forearm_{X}", f"hand_{X}", f"fingers_{X}", f"fingertips_{X}", f"thumb_{X}"):
                par = REST[bn][2]
                R = self.Rq[bn]
                out[bn] = R.inverted() @ (Wq[par].inverted() @ Wq[bn]) @ R
        return out, loc

    def apply(self, P):
        rots, loc = self.solve(P)
        for pb in self.arm.pose.bones:
            pb.rotation_quaternion = rots.get(pb.name, Quaternion())
            pb.location = loc.get(pb.name, (0, 0, 0))

    def clip(self, name, dur, fn, loop=False):
        n = max(1, round(dur * FPS))
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        if not self.arm.animation_data:
            self.arm.animation_data_create()
        self.arm.animation_data.action = act
        prev = {}
        self.err = 0.0
        for f in range(n + 1):
            rots, loc = self.solve(fn((f % n if loop else f) / FPS))
            for bn, q in rots.items():
                if bn in prev and prev[bn].dot(q) < 0:
                    q = -q
                prev[bn] = q
                pb = self.arm.pose.bones[bn]
                pb.rotation_quaternion = q
                pb.keyframe_insert("rotation_quaternion", frame=f)
                if bn in loc:
                    pb.location = loc[bn]
                    pb.keyframe_insert("location", frame=f)
        act.use_frame_range = True
        act.frame_start, act.frame_end = 0, n
        act.use_cyclic = loop
        self.clips.append((name, n / FPS, loop, round(self.err, 4)))
        self.arm.animation_data.action = None

    def export(self):
        out_dir = os.path.join(vlib.ROOT, "public", "assets", "models", "chr")
        os.makedirs(out_dir, exist_ok=True)
        self.glb = os.path.join(out_dir, f"{ID}.glb")
        for pb in self.arm.pose.bones:
            pb.rotation_quaternion = Quaternion()
            pb.location = (0, 0, 0)
        bpy.ops.object.select_all(action="DESELECT")
        for ob in (self.root, self.arm, self.mesh):
            ob.hide_set(False)
            ob.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=self.glb, export_format="GLB", use_selection=True, export_yup=True, export_image_format="NONE",
            export_extras=False, export_animations=True, export_animation_mode="ACTIONS", export_force_sampling=False,
            export_def_bones=False, export_skins=True, export_all_influences=False,
            export_anim_slide_to_zero=True, export_optimize_animation_size=True, export_reset_pose_bones=True, export_apply=False)


# =============================================================================== weapons (read sockets from the GLBs)
WPN_DIR = os.path.join(vlib.ROOT, "public", "assets", "models", "wpn")


def import_weapon(wid):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(WPN_DIR, f"{wid}.glb"))
    new = set(bpy.data.objects) - before
    root = next(o for o in new if o.parent is None)
    socks = {o.name.split(".")[0][7:]: o for o in new if o.name.startswith("SOCKET_")}
    mag = next((o for o in new if o.name.startswith("MAG")), None)
    for o in new:
        o.hide_render = o.name.split(".")[0].endswith(("_LOD1", "_LOD2", "_COL_box"))
        if o.type == "MESH":
            o.data.materials.clear()
            o.data.materials.append(vlib._palette_material())
    bpy.context.view_layer.update()
    return dict(root=root, socks=socks, mag=mag, loc={k: tuple(v.matrix_local.translation) for k, v in socks.items()})


arms = Arms()
body = FPBody()
build_mesh(body)
arms.finish(body)
WPN = {k: import_weapon(f"wpn_{k}_a") for k in ("pistol", "rifle", "knife")}
for k in WPN:
    WPN[k]["root"].hide_set(True)


# =============================================================================== poses
class F:
    """Weapon frame: origin g (grip), f barrel forward, u up, r = f x u (right)."""

    def __init__(self, g, f, u):
        self.g = Vector(g)
        self.f = Vector(f).normalized()
        u = Vector(u)
        self.u = (u - self.f * u.dot(self.f)).normalized()
        self.r = self.f.cross(self.u)

    def pt(self, l):
        return self.g + self.r * l[0] + self.f * l[1] + self.u * l[2]

    def d(self, l):
        return self.r * l[0] + self.f * l[1] + self.u * l[2]

    def ipt(self, p):
        q = Vector(p) - self.g
        return (q.dot(self.r), q.dot(self.f), q.dot(self.u))

    def idir(self, d):
        d = Vector(d)
        return (d.dot(self.r), d.dot(self.f), d.dot(self.u))

    def k(self):
        return dict(g=tuple(self.g), f=tuple(self.f), u=tuple(self.u))

    def turned(self, axis_l, deg, pivot_l=(0, 0, 0), move=(0, 0, 0)):
        """Rotated about a local axis through a local pivot, then moved by a local offset."""
        q = qrot(self.d(axis_l), deg)
        pv = self.pt(pivot_l)
        g = pv + q @ (self.g - pv) + self.d(move)
        return F(g, q @ self.f, q @ self.u)


def nrm(*v):
    return tuple(Vector(v).normalized())


def Lsock(sock, pos_l, f_l, u_l, **kw):
    """Left-hand key in weapon-local coords from a socket placement given in weapon-local coords."""
    w, a, t = hand_from(sock, pos_l, f_l, u_l)
    return dict(Lw=w, La=a, Lt=t, **kw)


def Lcam(Wf, w, a, t, **kw):
    """Left-hand key given in camera space, stored weapon-local (relative to the key's weapon frame Wf)."""
    return dict(Lw=Wf.ipt(w), La=Wf.idir(a), Lt=Wf.idir(t), **kw)


def gun_pose(k, sockR="SOCKET_weapon", local=True):
    """keys output -> solver params. k has g/f/u (weapon frame) + Re/Ro/Rc and Lw/La/Lt/Le/Lo/Lc."""
    Wf = F(k["g"], k["f"], k["u"])
    w, a, t = hand_from(sockR, Wf.g, Wf.f, Wf.u)
    P = dict(R=dict(w=w, a=a, t=t, e=k.get("Re", (0.8, -0.2, -1)), o=k.get("Ro", (0, 0, 0)), c=k.get("Rc", (0, 0, 0))))
    if "Lw" in k:
        if local:
            L = dict(w=Wf.pt(k["Lw"]), a=Wf.d(k["La"]), t=Wf.d(k["Lt"]))
        else:
            L = dict(w=k["Lw"], a=k["La"], t=k["Lt"])
        L.update(e=k.get("Le", (-0.8, -0.2, -1)), o=k.get("Lo", (0, 0, 0)), c=k.get("Lc", (0, 0, 0)))
        P["L"] = L
    P["_W"] = Wf
    return P


S2, TAU = math.sin, 2 * math.pi
OPEN = (-62, -78, -30)
HALF = (-25, -30, -10)

# ---------------------------------------------------------------- pistol
PS = WPN["pistol"]["loc"]
P_HIP = F((0.135, 0.36, -0.165), nrm(-0.035, 1, 0.025), nrm(-0.1, 0, 1))
P_ADS_D = 0.40  # rear sight distance from the eye on the centre line
P_ADS = F((0, P_ADS_D - PS["sight"][1], -PS["sight"][2]), (0, 1, 0), (0, 0, 1))
# left hand wrapped under/around the right fist (thumb forward along the frame's left side)
P_SUP = Lsock("SOCKET_support_L", (-0.022, 0.012, -0.03), nrm(0.15, 1, 0.12), nrm(0.75, -0.1, 0.65),
              Le=(-0.5, -0.4, -1), Lo=(0.03, 0.04, 0), Lc=(8, 0, 0))
P_RE = (1, -0.3, -0.9)


def p_hold(Wf, **kw):
    return {**Wf.k(), **P_SUP, "Re": P_RE, **kw}


def pistol_idle(t):
    b, s = S2(TAU * t / 3), S2(TAU * t / 3 + 1.3)
    W = P_HIP.turned((1, 0, 0), 0.8 * b, move=(0.0015 * s, 0, 0.003 * b)).turned((0, 0, 1), 0.6 * s)
    return gun_pose(p_hold(W))


def pistol_ads(t):
    return gun_pose(p_hold(P_ADS, Ro=(-0.03, -0.03, 0.02), Re=(1, -0.6, -0.6), Lo=(0.04, 0.03, 0.02), Le=(-1, -0.6, -0.7)))


def kick(W, back, up, deg):
    return W.turned((1, 0, 0), deg, pivot_l=(0, 0, 0), move=(0, -back, up))


def pistol_fire(t):
    k = keys(t, [(0, p_hold(P_HIP), 0), (0.035, p_hold(kick(P_HIP, 0.035, 0.012, 9)), 0.3), (5 / 30, p_hold(P_HIP), 0)])
    return gun_pose(k)


P_DOWN = F((0.2, 0.2, -0.52), nrm(-0.1, 0.5, -0.85), nrm(0.1, 0.85, 0.5))
P_REL = F((0.08, 0.33, -0.16), nrm(-0.3, 1, 0.35), nrm(0.85, -0.2, 0.8))  # reload: tilted up, rolled right


def L_free(Wf, w, a, t, c=(0, 0, 0)):
    return Lcam(Wf, w, a, t, Lc=c, Le=(-0.8, -0.3, -0.6))


L_LOW = ((-0.24, 0.12, -0.6), nrm(0.2, 0.4, -1), nrm(0.3, -0.9, -0.1))  # left hand off-screen (belt)


def pistol_draw(t):  # weapon attached from t=0 (rises from below the screen)
    k = keys(t, [(0, {**P_DOWN.k(), "Re": P_RE, **L_free(P_DOWN, *L_LOW, c=HALF)}, 0),
                 (0.22, {**P_HIP.turned((1, 0, 0), -12, move=(0, -0.02, -0.06)).k(), "Re": P_RE}, 0.6),
                 (0.4, p_hold(P_HIP), 0)])
    return gun_pose(k)


def pistol_holster(t):  # engine hides/detaches the weapon at the end (0.35 s)
    k = keys(t, [(0, p_hold(P_HIP), 0), (0.12, {**P_HIP.turned((1, 0, 0), -10, move=(0, -0.02, -0.05)).k(), "Re": P_RE}, 0.6),
                 (10 / 30, {**P_DOWN.k(), "Re": P_RE, **L_free(P_DOWN, *L_LOW, c=HALF)}, 0)])
    return gun_pose(k)


def mag_frame(Wf_l, wid, drop=0.0, rock=0.0, back=0.0):
    """SOCKET_mag_L key (weapon-local) for a mag `drop` m below its seat along the weapon down axis, rocked `rock` deg."""
    m = WPN[wid]["loc"]["mag"]
    q = qrot((1, 0, 0), rock)
    return (m[0], m[1] - back, m[2] - drop), tuple(q @ Vector((0, 1, 0))), tuple(q @ Vector((0, 0, 1)))


P_EV = {"mag_out": 0.30, "mag_grab_L": 0.62, "mag_in": 1.08, "slide": 1.42}


def pistol_reload(t):
    R = P_REL
    R_bump = P_REL.turned((1, 0, 0), 2, move=(0, 0, 0.012))
    slide = lambda back: Lsock("SOCKET_support_L", (0.0, -0.005 - back, 0.064), (0, -1, 0.05), (0, 0, -1), Lc=(10, 10, 0),  # noqa: E731
                               Le=(-0.6, -0.5, -0.6), Lo=(0.05, 0.05, 0.02))
    k = keys(t, [
        (0.0, p_hold(P_HIP), 0),
        (0.24, {**R.k(), "Re": P_RE, **L_free(R, (-0.15, 0.3, -0.33), nrm(0.3, 0.6, -0.7), nrm(0.3, -0.6, 0.3), c=HALF)}, 0.6),
        (0.45, {**R.k(), **L_free(R, *L_LOW, c=HALF)}, 0.5),
        (0.66, {**R.k(), **L_free(R, (-0.2, 0.14, -0.55), nrm(0.2, 0.5, -0.8), nrm(0.3, -0.85, 0.2))}, 0.5),
        (0.88, {**R.k(), **Lsock("SOCKET_mag_L", *mag_frame(R, "pistol", drop=0.075)), "Le": (-0.7, -0.4, -0.8)}, 0.4),
        (0.98, {**R.k(), **Lsock("SOCKET_mag_L", *mag_frame(R, "pistol", drop=0.03))}, 0.6),
        (1.08, {**R_bump.k(), **Lsock("SOCKET_mag_L", *mag_frame(R, "pistol"))}, 0),
        (1.16, {**R.k(), **L_free(R, (-0.1, 0.3, -0.25), nrm(0.4, 0.8, -0.2), nrm(0.2, -0.3, 1), c=HALF)}, 0.6),
        (1.3, {**R.k(), **slide(0.0)}, 0),
        (1.42, {**R.turned((1, 0, 0), -2).k(), **slide(0.045)}, 0),
        (1.52, {**R.k(), **L_free(R, (-0.12, 0.3, -0.22), nrm(0.4, 0.8, -0.2), nrm(0.2, -0.3, 1), c=HALF)}, 0.6),
        (1.9, p_hold(P_HIP), 0)])
    return gun_pose(k)


# ---------------------------------------------------------------- rifle
RS = WPN["rifle"]["loc"]
R_HIP = F((0.15, 0.27, -0.205), nrm(-0.04, 1, 0.03), nrm(-0.12, 0, 1))
R_ADS_D = 0.30
R_ADS = F((0, R_ADS_D - RS["sight"][1], -RS["sight"][2]), (0, 1, 0), (0, 0, 1))
R_SUP = Lsock("SOCKET_support_L", RS["support"], (0, 1, 0), nrm(0.45, 0, 1), Le=(-0.6, -0.1, -1), Lo=(0.06, 0.1, 0.02), Lc=(-12, -18, -6))
R_RE = (1, -0.4, -0.7)


def r_hold(Wf, **kw):
    return {**Wf.k(), **R_SUP, "Re": R_RE, **kw}


def rifle_idle(t):
    b, s = S2(TAU * t / 3), S2(TAU * t / 3 + 1.3)
    W = R_HIP.turned((1, 0, 0), 0.6 * b, move=(0.0015 * s, 0, 0.003 * b)).turned((0, 0, 1), 0.5 * s)
    return gun_pose(r_hold(W))


def rifle_ads(t):
    return gun_pose(r_hold(R_ADS, Ro=(-0.02, -0.08, 0.04), Re=(1, -0.3, -0.45), Lo=(0.08, 0.1, 0.05), Le=(-0.5, -0.1, -1)))


def rifle_fire(t):
    k = keys(t, [(0, r_hold(R_HIP), 0), (0.03, r_hold(kick(R_HIP, 0.03, 0.006, 3.5)), 0.3), (4 / 30, r_hold(R_HIP), 0)])
    return gun_pose(k)


R_DOWN = F((0.22, 0.2, -0.55), nrm(-0.2, 0.6, -0.75), nrm(0.1, 0.75, 0.6))


def rifle_draw(t):
    k = keys(t, [(0, {**R_DOWN.k(), "Re": R_RE, **L_free(R_DOWN, *L_LOW, c=HALF)}, 0),
                 (0.28, {**R_HIP.turned((1, 0, 0), -10, move=(0, -0.03, -0.06)).k(), "Re": R_RE,
                         **Lsock("SOCKET_support_L", (0, RS["support"][1] - 0.04, RS["support"][2] - 0.05), (0, 1, 0), nrm(0.45, 0, 1), Lo=(0.06, 0.1, 0.02), Lc=HALF)}, 0.6),
                 (0.5, r_hold(R_HIP), 0)])
    return gun_pose(k)


def rifle_holster(t):
    k = keys(t, [(0, r_hold(R_HIP), 0),
                 (0.16, {**R_HIP.turned((1, 0, 0), -10, move=(0, -0.03, -0.06)).k(), "Re": R_RE,
                         **Lsock("SOCKET_support_L", (0, RS["support"][1] - 0.04, RS["support"][2] - 0.05), (0, 1, 0), nrm(0.45, 0, 1), Lo=(0.06, 0.1, 0.02), Lc=HALF)}, 0.6),
                 (0.4, {**R_DOWN.k(), "Re": R_RE, **L_free(R_DOWN, *L_LOW, c=HALF)}, 0)])
    return gun_pose(k)


R_REL = F((0.07, 0.3, -0.18), nrm(-0.3, 1, 0.35), nrm(1.0, -0.15, 0.75))
R_EV = {"mag_out": 0.50, "mag_drop": 0.78, "mag_grab_L": 1.02, "mag_in": 1.42, "bolt": 1.72}


def rifle_reload(t):
    R = R_REL
    LM = dict(Le=(-0.7, -0.3, -0.8), Lo=(0.05, 0.08, 0.02))
    handle = lambda back: Lsock("SOCKET_support_L", (0.012, 0.14 - back, 0.112), nrm(0, -1, 0.1), nrm(0.35, 0, -1), Lc=(6, 6, 0),  # noqa: E731
                                Le=(-0.5, -0.4, -0.5), Lo=(0.08, 0.1, 0.04))
    k = keys(t, [
        (0.0, r_hold(R_HIP), 0),
        (0.22, {**R.k(), "Re": R_RE, **Lsock("SOCKET_mag_L", *mag_frame(R, "rifle", drop=0.0)), **LM}, 0.5),
        (0.36, {**R.k(), **Lsock("SOCKET_mag_L", *mag_frame(R, "rifle", drop=0.0)), **LM}, 0),
        (0.5, {**R.k(), **Lsock("SOCKET_mag_L", *mag_frame(R, "rifle", drop=0.015, rock=-18, back=-0.01)), **LM}, 0.5),
        (0.64, {**R.k(), **Lsock("SOCKET_mag_L", *mag_frame(R, "rifle", drop=0.13, rock=-25, back=0.02)), **LM}, 0.6),
        (0.8, {**R.k(), **L_free(R, *L_LOW, c=(0, 0, 0))}, 0.5),
        (1.02, {**R.k(), **L_free(R, (-0.22, 0.14, -0.56), nrm(0.2, 0.5, -0.8), nrm(0.3, -0.85, 0.2))}, 0.5),
        (1.24, {**R.k(), **Lsock("SOCKET_mag_L", *mag_frame(R, "rifle", drop=0.05, rock=-14, back=-0.01)), **LM}, 0.4),
        (1.33, {**R.k(), **Lsock("SOCKET_mag_L", *mag_frame(R, "rifle", drop=0.008, rock=-14, back=-0.01)), **LM}, 0.3),
        (1.42, {**R.turned((1, 0, 0), 1.5, move=(0, 0, 0.008)).k(), **Lsock("SOCKET_mag_L", *mag_frame(R, "rifle")), **LM}, 0),
        (1.56, {**R.k(), **handle(0.0)}, 0),
        (1.72, {**R.turned((0, 0, 1), 2).k(), **handle(0.08)}, 0),
        (1.82, {**R.k(), **handle(0.0), "Lc": HALF}, 0.5),
        (2.05, r_hold(R), 0.4),
        (2.4, r_hold(R_HIP), 0)])
    return gun_pose(k)


# ---------------------------------------------------------------- knife (left hand free, camera space)
K_IDLE = F((0.17, 0.34, -0.2), nrm(-0.3, 1, 0.55), nrm(0.15, -0.5, 1))
L_GUARD = dict(Lw=(-0.18, 0.3, -0.27), La=nrm(0.3, 0.75, 0.6), Lt=nrm(0.45, -0.55, 0.7), Le=(-0.8, -0.2, -1), Lc=(0, 0, 0))
K_RE = (1, -0.3, -0.8)


def k_hold(Wf, **kw):
    return {**Wf.k(), **L_GUARD, "Re": K_RE, **kw}


def knife_pose(k):
    return gun_pose(k, sockR="SOCKET_knife", local=False)


def knife_idle(t):
    b, s = S2(TAU * t / 3), S2(TAU * t / 3 + 1.3)
    W = K_IDLE.turned((1, 0, 0), 1.0 * b, move=(0.002 * s, 0, 0.004 * b))
    return knife_pose(k_hold(W, Lw=(-0.18, 0.3, -0.27 + 0.003 * s)))


K_EV_LIGHT = {"hit": 0.2}
K_EV_HEAVY = {"hit": 0.55}


def knife_light(t):  # right-to-left slash, edge leading
    wind = F((0.3, 0.22, -0.05), nrm(0.15, 0.45, 1), nrm(0.9, -0.3, -0.1))
    mid = F((0.06, 0.5, -0.15), nrm(-0.55, 0.8, 0.15), (0.8, 0.5, 0.3))
    end = F((-0.14, 0.46, -0.28), nrm(-0.8, 0.5, -0.3), (0.5, 0.6, 0.6))
    k = keys(t, [(0, k_hold(K_IDLE), 0), (0.11, k_hold(wind, Re=(1, -0.6, -0.2)), 0), (0.2, k_hold(mid, Re=(1, -0.2, -0.6), Ro=(-0.03, 0.09, 0.02)), 1.0),
                 (0.28, k_hold(end, Re=(0.6, -0.4, -1), Ro=(-0.05, 0.08, 0.0)), 0), (14 / 30, k_hold(K_IDLE), 0)])
    return knife_pose(k)


def knife_heavy(t):  # overhead stab
    raise_ = F((0.16, 0.3, 0.02), nrm(-0.1, 1, 0.6), nrm(0.3, -0.4, 1))
    hit = F((0.06, 0.44, -0.17), nrm(-0.1, 0.75, -1), nrm(0.2, 0.9, 0.6))
    k = keys(t, [(0, k_hold(K_IDLE), 0), (0.3, k_hold(raise_, Re=(1, -0.5, 0.0), Lw=(-0.18, 0.31, -0.25)), 0),
                 (0.42, k_hold(raise_.turned((1, 0, 0), 6, move=(0, -0.02, 0.01)), Re=(1, -0.5, 0.0)), 0.2),
                 (0.55, k_hold(hit, Re=(1, -0.2, 0.3)), 0), (0.66, k_hold(hit.turned((1, 0, 0), 3, move=(0, -0.01, 0)), Re=(1, -0.2, 0.3)), 0),
                 (0.9, k_hold(K_IDLE), 0)])
    return knife_pose(k)


K_DOWN = F((0.26, 0.15, -0.55), nrm(0.1, 0.3, -1), nrm(0, 1, 0.3))


def knife_draw(t):
    k = keys(t, [(0, k_hold(K_DOWN, Lw=L_LOW[0], La=L_LOW[1], Lt=L_LOW[2]), 0), (0.25, k_hold(K_IDLE.turned((1, 0, 0), 15, move=(0, -0.03, -0.04))), 0.6),
                 (0.4, k_hold(K_IDLE), 0)])
    return knife_pose(k)


# ---------------------------------------------------------------- left-arm-only actions (layer over any idle)
def left_only(k):
    return dict(L=dict(w=k["Lw"], a=k["La"], t=k["Lt"], e=k.get("Le", (-0.8, -0.3, -0.8)), o=k.get("Lo", (0, 0, 0)), c=k.get("Lc", (0, 0, 0))))


SHOVE_EV = {"hit": 0.2}


def shove(t):  # open palm forward, fingers up, thumb toward the centre
    low = dict(Lw=L_LOW[0], La=L_LOW[1], Lt=L_LOW[2], Lc=HALF)
    cock = dict(Lw=(-0.17, 0.2, -0.26), La=nrm(0.1, 0.3, 1), Lt=nrm(1, 0, -0.1), Lc=OPEN, Le=(-1, -0.3, -0.6))
    push = dict(Lw=(-0.07, 0.55, -0.11), La=nrm(0.1, 0.15, 1), Lt=nrm(1, 0, -0.1), Lc=OPEN, Le=(-1, -0.2, -0.5), Lo=(0.05, 0.1, 0.02))
    return left_only(keys(t, [(0, low, 0), (0.12, cock, 0.5), (0.2, push, 0), (0.3, push, 0), (0.5, low, 0)]))


INTERACT_EV = {"grab": 0.4}


def interact(t):  # reach down-forward, grab, bring back
    low = dict(Lw=L_LOW[0], La=L_LOW[1], Lt=L_LOW[2], Lc=HALF)
    reach = dict(Lw=(-0.06, 0.46, -0.33), La=nrm(0.1, 1, -0.6), Lt=nrm(1, 0, 0.1), Lc=OPEN, Le=(-1, -0.2, -0.4), Lo=(0.04, 0.1, 0))
    grab = dict(reach, Lc=(0, 0, 0))
    return left_only(keys(t, [(0, low, 0), (0.3, reach, 0.5), (0.4, grab, 0), (0.5, grab, 0), (0.8, low, 0)]))


CLIPS = [  # name, duration, fn, loop, weapon, events
    ("fp_pistol_idle", 3.0, pistol_idle, True, "pistol", {}),
    ("fp_pistol_fire", 5 / 30, pistol_fire, False, "pistol", {"shot": 0.0}),
    ("fp_pistol_reload", 1.9, pistol_reload, False, "pistol", P_EV),
    ("fp_pistol_draw", 0.4, pistol_draw, False, "pistol", {"attach": 0.0}),
    ("fp_pistol_holster", 10 / 30, pistol_holster, False, "pistol", {"detach": 0.333}),
    ("fp_pistol_ads", 1.0, pistol_ads, True, "pistol", {}),
    ("fp_rifle_idle", 3.0, rifle_idle, True, "rifle", {}),
    ("fp_rifle_fire", 4 / 30, rifle_fire, False, "rifle", {"shot": 0.0}),
    ("fp_rifle_reload", 2.4, rifle_reload, False, "rifle", R_EV),
    ("fp_rifle_draw", 0.5, rifle_draw, False, "rifle", {"attach": 0.0}),
    ("fp_rifle_holster", 0.4, rifle_holster, False, "rifle", {"detach": 0.4}),
    ("fp_rifle_ads", 1.0, rifle_ads, True, "rifle", {}),
    ("fp_knife_idle", 3.0, knife_idle, True, "knife", {}),
    ("fp_knife_light", 14 / 30, knife_light, False, "knife", K_EV_LIGHT),
    ("fp_knife_heavy", 0.9, knife_heavy, False, "knife", K_EV_HEAVY),
    ("fp_knife_draw", 0.4, knife_draw, False, "knife", {"attach": 0.0}),
    ("fp_shove", 0.5, shove, False, None, SHOVE_EV),
    ("fp_interact", 0.8, interact, False, None, INTERACT_EV),
]


# =============================================================================== preview (Workbench, FP camera)
FOV = 85.0


def setup_preview():
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "TEXTURE"
    sc.display.shading.show_cavity = False
    sc.render.film_transparent = False
    sc.world = sc.world or bpy.data.worlds.new("w")
    sc.world.color = (0.55, 0.62, 0.7)
    cam = bpy.data.objects.new("_cam", bpy.data.cameras.new("_cam"))
    sc.collection.objects.link(cam)
    cam.data.sensor_fit = "VERTICAL"
    cam.data.angle_y = math.radians(FOV)
    cam.data.clip_start = 0.05
    cam.rotation_euler = (math.pi / 2, 0, 0)
    sc.camera = cam
    g = bpy.data.meshes.new("_ground")
    gb = bmesh.new()
    bmesh.ops.create_grid(gb, x_segments=2, y_segments=2, size=60.0)
    bmesh.ops.translate(gb, vec=(0, 0, -1.65), verts=gb.verts)
    gb.to_mesh(g)
    gm = bpy.data.materials.new("_g")
    gm.diffuse_color = (0.33, 0.27, 0.2, 1)
    g.materials.append(gm)
    sc.collection.objects.link(bpy.data.objects.new("_ground", g))
    # weapons on their sockets (bone parenting is relative to the tail; weapon Blender axes +Y barrel/+Z up -> bone +Y up/-Z fwd)
    fix = Matrix.Translation((0, -0.05, 0)) @ Matrix.Rotation(-math.pi / 2, 4, "X")
    for k, W in WPN.items():
        r = W["root"]
        r.hide_set(False)
        r.parent = arms.arm
        r.parent_type = "BONE"
        r.parent_bone = "SOCKET_knife" if k == "knife" else "SOCKET_weapon"
        r.matrix_parent_inverse = fix
        r.matrix_basis = Matrix.Identity(4)
        if W["mag"]:  # copy of the MAG for the left hand, positioned like at SOCKET_mag
            h = bpy.data.objects.new(f"_hmag_{k}", None)
            sc.collection.objects.link(h)
            h.parent = arms.arm
            h.parent_type = "BONE"
            h.parent_bone = "SOCKET_mag_L"
            h.matrix_parent_inverse = fix
            m = W["mag"].copy()
            sc.collection.objects.link(m)
            m.parent = h
            m.matrix_parent_inverse = Matrix.Identity(4)
            m.matrix_basis = W["socks"]["mag"].matrix_local.inverted() @ W["mag"].matrix_local
            W["hmag"] = m


def show(weapon, clip, t):
    ev = dict(next(c[5] for c in CLIPS if c[0] == clip)) if clip else {}
    for k, W in WPN.items():
        vis = k == weapon
        for o in [W["root"], *W["root"].children_recursive]:
            if not o.name.split(".")[0].endswith(("_LOD1", "_LOD2", "_COL_box")) and o.type == "MESH":
                o.hide_render = not vis
        if W["mag"]:
            out, inn = ev.get("mag_out", 9), ev.get("mag_in", 9)
            W["mag"].hide_render = not vis or out <= t < inn
            hand = (ev.get("mag_grab_L", 9) <= t < inn) or (k == "rifle" and out <= t < ev.get("mag_drop", 0))
            W["hmag"].hide_render = not (vis and hand)


def render(path, w, h):
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def grab(path, w, h, cross=True):
    import numpy as np
    img = bpy.data.images.load(path)
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    os.remove(path)
    a = a.reshape(h, w, 4)
    if cross:  # screen-centre crosshair
        cy, cx = h // 2, w // 2
        a[cy, cx - 6:cx + 7, :3] = (1, 0.1, 0.1)
        a[cy - 6:cy + 7, cx, :3] = (1, 0.1, 0.1)
    return a


def save(arr, out):
    im = bpy.data.images.new("sheet", arr.shape[1], arr.shape[0], alpha=True)
    im.pixels.foreach_set(arr.ravel())
    im.filepath_raw = out
    im.file_format = "PNG"
    im.save()
    bpy.data.images.remove(im)


def sheet(out, cells, cols, w=480, h=270):
    """cells: (weapon, clip name, fn, t)."""
    import numpy as np
    tmp = os.path.join(vlib.ROOT, "assets", "previews", "_tmp_fp.png")
    imgs = []
    cam = bpy.context.scene.camera
    for weapon, clip, fn, t, *view in cells:
        cam.data.angle_y = math.radians(FOV)
        cam.location, cam.rotation_euler = (0, 0, 0), (math.pi / 2, 0, 0)
        if view:  # debug orbit: (target, from)
            tgt, frm = Vector(view[0][0]), Vector(view[0][1])
            cam.location = frm
            cam.rotation_euler = (tgt - frm).to_track_quat("-Z", "Y").to_euler()
            cam.data.angle_y = math.radians(30)
        P = fn(t)
        if "R" not in P:  # left-only clip: right arm from the weapon idle
            P = {**(rifle_idle(0) if weapon == "rifle" else knife_idle(0) if weapon == "knife" else pistol_idle(0)), "L": P["L"]}
        arms.apply(P)
        show(weapon, clip, t)
        bpy.context.view_layer.update()
        render(tmp, w, h)
        imgs.append(grab(tmp, w, h))
    rows = (len(imgs) + cols - 1) // cols
    S = np.zeros((rows * h, cols * w, 4), dtype=np.float32)
    S[..., 3] = 1
    for i, a in enumerate(imgs):
        r, c = rows - 1 - i // cols, i % cols
        S[r * h:(r + 1) * h, c * w:(c + 1) * w] = a
        S[r * h:(r + 1) * h, c * w, :3] = 0  # cell borders
        S[r * h, c * w:(c + 1) * w, :3] = 0
    save(S, out)


def previews():
    setup_preview()
    out = os.path.join(vlib.ROOT, "assets", "previews")
    fns = {c[0]: c for c in CLIPS}
    only = vlib._args().get("only", "")
    # framing: hip/ADS per weapon at 1280x720 (one image) + the hero preview
    cells = [("pistol", "fp_pistol_idle", pistol_idle, 0), ("pistol", "fp_pistol_ads", pistol_ads, 0),
             ("rifle", "fp_rifle_idle", rifle_idle, 0), ("rifle", "fp_rifle_ads", rifle_ads, 0),
             ("knife", "fp_knife_idle", knife_idle, 0), ("pistol", "fp_shove", shove, 0.22)]
    sheet(os.path.join(out, f"{ID}_framing.png"), cells, 2, 640, 360)
    sheet(os.path.join(out, f"{ID}.png"), [("rifle", "fp_rifle_idle", rifle_idle, 0)], 1, 1280, 720)
    if only == "framing":
        return
    if only == "debug":
        V = [((0.05, 0.4, -0.15), (0.6, 0.35, 0.0)), ((0.05, 0.4, -0.15), (-0.5, 0.5, 0.1)), ((0.05, 0.4, -0.15), (0.1, 0.9, -0.3))]
        cells = []
        for w, n, f in (("pistol", "fp_pistol_idle", pistol_idle), ("rifle", "fp_rifle_idle", rifle_idle), ("knife", "fp_knife_idle", knife_idle)):
            cells += [(w, n, f, 0, v) for v in V]
        sheet(os.path.join(out, f"{ID}_debug.png"), cells, 3, 480, 360)
        return
    for name, dur, fn, loop, weapon, ev in CLIPS:
        if only and only not in name:
            continue
        evs = [v for v in ev.values() if 0 < v < dur]
        n = (6 if dur < 0.5 else 8) - (len(evs) + 1) // 2
        ts = sorted(set([round(dur * i / (n if loop else n - 1), 3) for i in range(n)] + [v for v in ev.values() if 0 < v < dur]))
        sheet(os.path.join(out, f"{ID}_{name}.png"), [(weapon or "pistol", name, fn, t) for t in ts], 4 if len(ts) <= 8 else 5)


if __name__ == "__main__":
    for name, dur, fn, loop, weapon, ev in CLIPS:
        arms.clip(name, dur, fn, loop)
    bad = [c for c in arms.clips if c[3] > 0.005]
    print("FP_REACH", json.dumps({c[0]: c[3] for c in arms.clips}))
    if "--sheets" in sys.argv:
        previews()
    for W in WPN.values():  # weapons were only for socket data / previews
        W["root"].hide_set(True)
    arms.export()
    print("ASSET_REPORT " + json.dumps({
        "id": ID, "category": "chr", "glb": os.path.relpath(arms.glb, vlib.ROOT).replace("\\", "/"), "tris": {f"{ID}_LOD0": arms.tris},
        "clips": {c[0]: round(c[1], 3) for c in arms.clips}, "events": {c[0]: c[5] for c in CLIPS if c[5]}}))
