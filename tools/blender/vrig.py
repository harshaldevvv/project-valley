"""vrig — procedural low-poly humanoids for Project Valley: skinned mesh + contract armature + code-authored clips.

Space (everything in this file): Blender armature space, metres. +X = character right, +Y = character forward
(exported as glTF -Z), +Z up. Feet on z=0, origin between the feet. Rest pose = A-pose (arms 45 deg down).

Mesh: `Body` lofts chamfered ring sections along paths; every vertex carries bone weights (set per ring, with
blends at joints), every face a palette swatch. Flat shaded, UV'd into vlib's palette atlas, one material.

Animation: a clip is a function t -> params dict (see STAND); `Rig.solve` turns params into bone rotations:
- torso / clavicles: local Euler degrees (x = pitch, + leans BACK; y = roll, + tilts to the right; z = yaw, + turns left).
  Left-side params use the mirrored convention, so the same numbers on R and L give a symmetric pose.
- arms: FK `aR=(flex, abd, elbow)` (degrees, relative to the chest) or IK `gR` grip point + `gRf` (fingers /
  barrel dir) + `gRu` (thumb dir) + `eR` elbow pole, given in chest-rest space (they ride with the chest),
  or in world space when P['space'] == 'world'.
- legs: IK `fR` ankle position + `fRp` foot pitch (+ toe up) + `fRy` yaw + `tRp` toe pitch (world),
  or FK `lR=(flex, abd, knee, ankle)` relative to the hips.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vlib  # noqa: E402

ROOT = vlib.ROOT
FPS = 30
ANK = 0.085  # ankle joint height with the foot flat
_A = math.radians(45)
UA, FA, HA = 0.29, 0.255, 0.16


def _arm(s):
    d = Vector((s * math.cos(_A), 0, -math.sin(_A)))
    sh = Vector((s * 0.185, 0, 1.455))
    return sh, sh + d * UA, sh + d * (UA + FA), sh + d * (UA + FA + HA)


SKELETON = [("root", None, (0, 0, 0), (0, 0.2, 0)),
            ("hips", "root", (0, 0, 0.97), (0, 0, 1.07)),
            ("spine", "hips", (0, 0, 1.07), (0, 0, 1.24)),
            ("chest", "spine", (0, 0, 1.24), (0, 0, 1.50)),
            ("neck", "chest", (0, 0, 1.50), (0, 0.015, 1.61)),
            ("head", "neck", (0, 0.015, 1.61), (0, 0.015, 1.80))]
for _s, _X in ((1, "R"), (-1, "L")):
    _sh, _el, _wr, _tip = _arm(_s)
    SKELETON += [(f"shoulder_{_X}", "chest", (_s * 0.03, 0, 1.44), (_s * 0.17, 0, 1.455)),
                 (f"upper_arm_{_X}", f"shoulder_{_X}", tuple(_sh), tuple(_el)),
                 (f"forearm_{_X}", f"upper_arm_{_X}", tuple(_el), tuple(_wr)),
                 (f"hand_{_X}", f"forearm_{_X}", tuple(_wr), tuple(_tip)),
                 (f"thigh_{_X}", "hips", (_s * 0.095, 0, 0.93), (_s * 0.095, 0, 0.505)),
                 (f"shin_{_X}", f"thigh_{_X}", (_s * 0.095, 0, 0.505), (_s * 0.095, 0, ANK)),
                 (f"foot_{_X}", f"shin_{_X}", (_s * 0.095, 0, ANK), (_s * 0.095, 0.13, 0.025)),
                 (f"toe_{_X}", f"foot_{_X}", (_s * 0.095, 0.13, 0.025), (_s * 0.095, 0.205, 0.02))]
BONES = [b[0] for b in SKELETON]
REST = {b[0]: (Vector(b[2]), Vector(b[3]), b[1]) for b in SKELETON}
SIDES = (("R", 1), ("L", -1))


def hand_frame(s):
    """Rest hand axes for side s: a (wrist->knuckles), t (thumb), p (out of the palm)."""
    a = (REST[f"hand_{'R' if s > 0 else 'L'}"][1] - REST[f"hand_{'R' if s > 0 else 'L'}"][0]).normalized()
    t = Vector((0, 1, 0))
    return a, t, -s * a.cross(t)


def grip_rest(s):
    """Weapon grip point (fist centre) in rest pose; also the SOCKET_hand_* position."""
    X = "R" if s > 0 else "L"
    a, t, p = hand_frame(s)
    return REST[f"hand_{X}"][0] + a * 0.085 + p * 0.022


# --------------------------------------------------------------------------------------- mesh
def W(**kw):
    return kw


class Body:
    """bmesh with per-vertex bone weights and per-face swatch slots."""

    def __init__(self):
        self.bm = bmesh.new()
        self.dl = self.bm.verts.layers.deform.verify()
        self.swatches = []

    def slot(self, sw):
        if sw not in vlib.SWATCH_INDEX:
            raise KeyError(sw)
        if sw not in self.swatches:
            self.swatches.append(sw)
        return self.swatches.index(sw)

    def _vert(self, co, w):
        v = self.bm.verts.new(co)
        w = w(co) if callable(w) else w
        tot = sum(w.values())
        for b, x in w.items():
            if x > 1e-4:
                v[self.dl][BONES.index(b)] = x / tot
        return v

    def _face(self, vs, sw, out):
        f = self.bm.faces.new(vs)
        f.material_index = self.slot(sw)
        f.normal_update()
        if f.normal.dot(out) < 0:
            f.normal_flip()
        return f

    def loft(self, rings, n=8, fwd=(0, 1, 0), side=(1, 0, 0), rot=None, sq=2.0, sw=None, w=None, cap0=True, cap1=True):
        """rings: dicts c (centre), r (scalar | (rx, rf) | (rx, rf, rb)), optional sw, w, sq, jag, rot.
        Cross-section x runs along `side`, front (rf) along `fwd`, both made perpendicular to the path."""
        cs = [Vector(r["c"]) for r in rings]
        span = (cs[-1] - cs[0]).normalized()
        side = Vector(side)
        fwd = Vector(fwd) if fwd is not None else None
        loops = []
        for i, R in enumerate(rings):
            ax = cs[min(i + 1, len(cs) - 1)] - cs[max(i - 1, 0)]
            ax = ax.normalized() if ax.length > 1e-6 else span
            f = (fwd - ax * fwd.dot(ax)).normalized() if fwd is not None else side.cross(ax).normalized()
            x = f.cross(ax).normalized()
            if x.dot(side) < 0:
                x = -x
            r = R["r"]
            rx, rf, rb = (r, r, r) if isinstance(r, (int, float)) else (r[0], r[1], r[1]) if len(r) == 2 else r
            e = 2.0 / R.get("sq", sq)
            off = R.get("rot", rot if rot is not None else math.pi / n)
            jag = R.get("jag", 0.0)
            ring = []
            for k in range(n):
                th = off + 2 * math.pi * k / n
                c, s_ = math.cos(th), math.sin(th)
                px = math.copysign(abs(c) ** e, c) * rx
                pz = math.copysign(abs(s_) ** e, s_) * (rf if s_ > 0 else rb)
                j = jag * (((k * 7919 + i * 104729) % 13) / 6.0 - 1.0) if jag else 0.0
                ring.append(self._vert(cs[i] + x * px + f * pz + ax * j, R.get("w", w)))
            loops.append((ring, ax))
        for i in range(len(loops) - 1):
            a, b = loops[i][0], loops[i + 1][0]
            s = rings[i].get("sw", sw)
            for k in range(n):
                q = (a[k], a[(k + 1) % n], b[(k + 1) % n], b[k])
                ctr = sum((v.co for v in q), Vector()) / 4
                self._face(q, s, ctr - (cs[i] + cs[i + 1]) / 2)
        for ring, ax, cap, sgn, idx in ((loops[0][0], loops[0][1], cap0, -1, 0), (loops[-1][0], loops[-1][1], cap1, 1, -1)):
            if not cap:
                continue
            s = rings[idx].get("sw", sw) if idx == 0 else rings[-2].get("sw", sw) if len(rings) > 1 else sw
            s = rings[idx].get("capsw", s)
            if cap is True:
                self._face(ring, s, ax * sgn)
            else:  # dome: centre vertex pushed out by `cap` metres
                c = self._vert(cs[idx] + ax * sgn * cap, rings[idx].get("w", w))
                for k in range(n):
                    self._face((ring[k], ring[(k + 1) % n], c), s, ax * sgn)

    def box(self, c, size, sw, w, axes=None, bevel=0.0):
        """Chamfered box centred at c; size along axes (default world x, y, z)."""
        tmp = bmesh.new()
        bmesh.ops.create_cube(tmp, size=1.0)
        bmesh.ops.scale(tmp, vec=Vector(size), verts=tmp.verts)
        if bevel:
            bmesh.ops.bevel(tmp, geom=list(tmp.edges), offset=bevel, segments=1, affect="EDGES", profile=0.5)
        m = Matrix.Identity(3) if axes is None else Matrix([list(a) for a in axes]).transposed()
        bmesh.ops.transform(tmp, matrix=Matrix.Translation(Vector(c)) @ m.to_4x4(), verts=tmp.verts)
        vm = {v: self._vert(v.co.copy(), w) for v in tmp.verts}
        for f in tmp.faces:
            nf = self.bm.faces.new([vm[v] for v in f.verts])
            nf.material_index = self.slot(sw)
        tmp.free()

    def paint(self, pred, sw, only=None):
        """Re-swatch faces whose centre/normal satisfy pred(c, n) (blood, bruises, hair lines...)."""
        for f in self.bm.faces:
            if only and self.swatches[f.material_index] not in only:
                continue
            if pred(f.calc_center_median(), f.normal):
                f.material_index = self.slot(sw)


def blend(z, table):
    """Piecewise-linear weights by a coordinate: table = [(z, {bone: w}), ...] sorted by z."""
    if z <= table[0][0]:
        return dict(table[0][1])
    for (z0, w0), (z1, w1) in zip(table, table[1:]):
        if z <= z1:
            t = (z - z0) / (z1 - z0)
            return {b: w0.get(b, 0) * (1 - t) + w1.get(b, 0) * t for b in set(w0) | set(w1)}
    return dict(table[-1][1])


def hand(body, s, sw_skin, sw_cuff=None):
    """Low-poly fist (curled fingers, thumb) in the rest hand frame; grip hole at grip_rest(s)."""
    X = "R" if s > 0 else "L"
    a, t, p = hand_frame(s)
    o = REST[f"hand_{X}"][0]
    w = {f"hand_{X}": 1.0}

    def P(da, dt, dp):
        return o + a * da + t * dt + p * dp

    body.loft([dict(c=P(-0.015, 0, 0), r=(0.03, 0.02, 0.018), w={f"hand_{X}": 0.5, f"forearm_{X}": 0.5}),
               dict(c=P(0.04, 0.0, 0.0), r=(0.043, 0.022, 0.018)),
               dict(c=P(0.085, 0.0, 0.012), r=(0.045, 0.032, 0.02)),
               dict(c=P(0.115, -0.002, 0.022), r=(0.04, 0.03, 0.02))],
              n=8, fwd=p, side=t, sw=sw_skin, w=w, cap1=0.012, sq=3.0)
    body.loft([dict(c=P(0.02, 0.03, 0.012), r=0.012), dict(c=P(0.06, 0.05, 0.03), r=0.012),
               dict(c=P(0.09, 0.035, 0.045), r=0.01)], n=5, fwd=p, side=t, sw=sw_skin, w=w, cap1=0.006)


def boot(body, s, sw, sw_sole, top=0.2, r_top=0.062):
    X = "R" if s > 0 else "L"
    x = s * 0.095
    wf = {f"foot_{X}": 1.0}
    body.loft([dict(c=(x, 0.0, top), r=r_top, w={f"shin_{X}": 1.0}), dict(c=(x, 0.0, 0.09), r=(0.052, 0.058), w={f"shin_{X}": 0.5, f"foot_{X}": 0.5})],
              n=8, sw=sw, cap0=False, cap1=False)
    # foot: lofted heel -> toe, cross-section x = width, front = up
    body.loft([dict(c=(x, -0.065, 0.055), r=(0.045, 0.04, 0.045), w=wf),
               dict(c=(x, 0.0, 0.06), r=(0.052, 0.05, 0.055), w=wf),
               dict(c=(x + s * 0.004, 0.11, 0.045), r=(0.05, 0.035, 0.04), w={f"foot_{X}": 0.5, f"toe_{X}": 0.5}),
               dict(c=(x + s * 0.004, 0.19, 0.04), r=(0.04, 0.025, 0.035), w={f"toe_{X}": 1.0})],
              n=8, fwd=(0, 0, 1), side=(1, 0, 0), sw=sw, cap1=0.02, sq=3.0)
    body.box((x + s * 0.003, 0.06, 0.0125), (0.112, 0.29, 0.025), sw_sole,
             lambda c: {f"foot_{X}": 1.0} if c.y < 0.1 else {f"toe_{X}": 1.0}, bevel=0.008)


# ---------------------------------------------------------------------------------- character
class Character:
    def __init__(self, asset_id):
        vlib.reset_scene()
        sc = bpy.context.scene
        sc.render.fps = FPS
        self.id = asset_id
        self.cat = asset_id.split("_")[0]
        self.body = Body()
        self.root = bpy.data.objects.new(asset_id, None)
        sc.collection.objects.link(self.root)
        arm = bpy.data.armatures.new(f"{asset_id}_rig")
        self.arm = bpy.data.objects.new(f"{asset_id}_rig", arm)
        sc.collection.objects.link(self.arm)
        self.arm.parent = self.root
        bpy.context.view_layer.objects.active = self.arm
        bpy.ops.object.mode_set(mode="EDIT")
        for name, parent, h, t in SKELETON:
            eb = arm.edit_bones.new(name)
            eb.head, eb.tail = h, t
            eb.align_roll(Vector((0, 0, 1)) if abs(Vector(t)[2] - Vector(h)[2]) < 0.5 * (Vector(t) - Vector(h)).length else Vector((0, 1, 0)))
            if parent:
                eb.parent = arm.edit_bones[parent]
            eb.use_deform = name != "root"
        # weapon sockets as non-deforming bones (skin joints survive gltf-transform prune; empties would not).
        # glTF node axes: -Z = fingers / barrel, +Y = thumb / top of the weapon.
        for X, s in SIDES:
            a, t, _ = hand_frame(s)
            eb = arm.edit_bones.new(f"SOCKET_hand_{X}")
            eb.head = grip_rest(s)
            eb.tail = grip_rest(s) + t * 0.08  # the glTF exporter keeps bone +Y as node +Y
            eb.align_roll(-a)
            eb.parent = arm.edit_bones[f"hand_{X}"]
            eb.use_deform = False
        bpy.ops.object.mode_set(mode="OBJECT")
        self.Rq = {b.name: b.matrix_local.to_quaternion() for b in arm.bones}
        for pb in self.arm.pose.bones:
            pb.rotation_mode = "QUATERNION"
        self.clips = []

    # ---------- mesh finishing ----------
    def _mesh_object(self, name, bm):
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        for b in BONES:
            ob.vertex_groups.new(name=b)
        for s in self.body.swatches:
            me.materials.append(bpy.data.materials.get("pal:" + s) or bpy.data.materials.new("pal:" + s))
        return ob

    def finish(self, lods=(0.5, 0.2)):
        bm = self.body.bm
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        lod0 = self._mesh_object(f"{self.id}_LOD0", bm)
        objs = [lod0]
        for i, ratio in enumerate(lods, 1):
            ob = lod0.copy()
            ob.data = lod0.data.copy()
            ob.name = ob.data.name = f"{self.id}_LOD{i}"
            bpy.context.scene.collection.objects.link(ob)
            mod = ob.modifiers.new("dec", "DECIMATE")
            mod.ratio = ratio
            mod.delimit = {"MATERIAL"}
            with bpy.context.temp_override(object=ob, active_object=ob):
                bpy.ops.object.modifier_apply(modifier="dec")
            objs.append(ob)
        for ob in objs:
            me = ob.data
            uv = me.uv_layers.new(name="UVMap")
            for poly in me.polygons:
                sw = self.body.swatches[poly.material_index]
                for li in poly.loop_indices:
                    z = me.vertices[me.loops[li].vertex_index].co.z
                    u, v = vlib.swatch_uv(sw, min(max(0.25 + z / 2.4, 0), 1))
                    uv.data[li].uv = (u, 1.0 - v)
            me.materials.clear()
            me.materials.append(vlib._palette_material())
            ob.parent = self.arm
            ob.modifiers.new("arm", "ARMATURE").object = self.arm
        self.stats = {ob.name: sum(len(p.vertices) - 2 for p in ob.data.polygons) for ob in objs}
        # collider: standing capsule-ish box (the controller uses its own capsule; this is for picking/LOD sizing)
        c = bpy.data.meshes.new(f"{self.id}_COL_box")
        cb = bmesh.new()
        bmesh.ops.create_cube(cb, size=1.0)
        bmesh.ops.scale(cb, vec=(0.6, 0.4, 1.8), verts=cb.verts)
        bmesh.ops.translate(cb, vec=(0, 0, 0.9), verts=cb.verts)
        cb.to_mesh(c)
        col = bpy.data.objects.new(c.name, c)
        bpy.context.scene.collection.objects.link(col)
        col.parent = self.root
        col.display_type = "WIRE"
        return self

    # ---------- posing ----------
    def solve(self, P):
        """params -> {bone: basis quaternion}, hips basis location."""
        P = {**STAND, **P}
        Wq, pos = {}, {}

        def fk(name, q_local=None, q_world=None):
            h, _, par = REST[name]
            if par:
                pos[name] = pos[par] + Wq[par] @ (h - REST[par][0])
                Wq[name] = q_world if q_world is not None else Wq[par] @ q_local
            else:
                pos[name], Wq[name] = h.copy(), Quaternion()

        fk("root")
        h0 = REST["hips"][0]
        Wq["hips"] = E(P["hipR"])
        pos["hips"] = h0 + Vector(P["hip"])
        for b in ("spine", "chest", "neck", "head"):
            fk(b, E(P[b]))
        cw = Wq["chest"]

        def to_world(p, d=False):
            if P.get("space") == "world":
                return Vector(p)
            return cw @ Vector(p) if d else pos["chest"] + cw @ (Vector(p) - REST["chest"][0])

        for X, s in SIDES:
            fk(f"shoulder_{X}", E(mir(P["sh" + X], s)))
            fk(f"upper_arm_{X}", Quaternion())
            a_r, t_r, p_r = hand_frame(s)
            sh = pos[f"upper_arm_{X}"]
            h_rest = a_r.cross(Vector((0, -1, 0))).normalized()
            if "g" + X in P:  # IK to a grip
                f = to_world(P["g" + X + "f"], True).normalized()
                u = to_world(P["g" + X + "u"], True)
                u = (u - f * u.dot(f)).normalized()
                qh = (_frame(f, u) @ _frame(a_r, t_r).transposed()).to_quaternion()
                wrist = to_world(P["g" + X]) - qh @ (grip_rest(s) - REST[f"hand_{X}"][0])
                d1, d2, hinge = _two_bone(sh, wrist, UA, FA, to_world(P["e" + X], True))
            else:  # FK angles relative to the chest
                fl, ab, el = P["a" + X][:3]
                tw = P["a" + X][3] if len(P["a" + X]) > 3 else 0
                q = cw @ E((fl, -s * ab, 0))
                d1 = q @ Vector((0, 0, -1))
                ff = q @ Vector((0, 1, 0))
                ax = d1.cross(ff).normalized()
                ax = Quaternion(d1, math.radians(s * tw)) @ ax
                d2 = Quaternion(ax, math.radians(el)) @ d1
                hinge = _hinge(d1, d2, d1.cross(-ff))
                qh = None
            q1 = (_frame(d1, hinge) @ _frame(a_r, h_rest).transposed()).to_quaternion()
            q2 = (_frame(d2, hinge) @ _frame(a_r, h_rest).transposed()).to_quaternion()
            if qh is None:
                qh = q2 @ E(mir(P.get("w" + X, (0, 0, 0)), s))
            else:  # share the wrist twist with the forearm (no candy-wrapper wrists)
                rel = q2.inverted() @ qh
                v = Vector(rel[1:]).project(a_r)
                tw = Quaternion((rel[0], *v))
                if tw.magnitude > 1e-6:
                    q2 = q2 @ Quaternion().slerp(tw.normalized(), 0.5)
            fk(f"upper_arm_{X}", q_world=q1)
            fk(f"forearm_{X}", q_world=q2)
            fk(f"hand_{X}", q_world=qh)

            # legs
            fk(f"thigh_{X}", Quaternion())
            hip = pos[f"thigh_{X}"]
            if "l" + X in P:
                fl, ab, kn, an = P["l" + X]
                q = Wq["hips"] @ E((fl, -s * ab, 0))
                d1 = q @ Vector((0, 0, -1))
                ff = q @ Vector((0, 1, 0))
                ax = d1.cross(ff).normalized()
                d2 = Quaternion(ax, math.radians(-kn)) @ d1
                hinge = _hinge(d1, d2, ax)
                q1 = (_frame(d1, hinge) @ _frame(Vector((0, 0, -1)), Vector((1, 0, 0))).transposed()).to_quaternion()
                q2 = (_frame(d2, hinge) @ _frame(Vector((0, 0, -1)), Vector((1, 0, 0))).transposed()).to_quaternion()
                qf = q2 @ E((an, 0, 0))
                qt = qf @ E((P.get("t" + X + "p", 0), 0, 0))
            else:
                yaw = P["f" + X + "y"]
                pole = Quaternion((0, 0, 1), math.radians(yaw)) @ Vector((s * 0.15, 1, 0))
                d1, d2, hinge = _two_bone(hip, Vector(P["f" + X]), 0.425, 0.42, pole)
                q1 = (_frame(d1, hinge) @ _frame(Vector((0, 0, -1)), Vector((1, 0, 0))).transposed()).to_quaternion()
                q2 = (_frame(d2, hinge) @ _frame(Vector((0, 0, -1)), Vector((1, 0, 0))).transposed()).to_quaternion()
                qy = E((0, 0, yaw))
                qf = qy @ E((P["f" + X + "p"], 0, 0))
                qt = qy @ E((P["t" + X + "p"], 0, 0))
            fk(f"thigh_{X}", q_world=q1)
            fk(f"shin_{X}", q_world=q2)
            fk(f"foot_{X}", q_world=qf)
            fk(f"toe_{X}", q_world=qt)

        out = {}
        for name in BONES:
            par = REST[name][2]
            loc = Wq[par].inverted() @ Wq[name] if par else Wq[name]
            R = self.Rq[name]
            out[name] = R.inverted() @ loc @ R
        hl = self.Rq["hips"].inverted() @ Vector(P["hip"])
        return out, hl, pos

    def arm_ik(self, P, X):
        """IK params (chest-rest space) reproducing side X's arm in pose P — lets IK clips start/end on FK poses."""
        s = 1 if X == "R" else -1
        Pw = {**P}
        rots, _, pos = self.solve(Pw)
        # rebuild world rotations from basis rotations
        Wq = {}
        for name in BONES:
            par = REST[name][2]
            R = self.Rq[name]
            loc = R @ rots[name] @ R.inverted()
            Wq[name] = Wq[par] @ loc if par else loc
        a_r, t_r, _ = hand_frame(s)
        qh = Wq[f"hand_{X}"]
        g = pos[f"hand_{X}"] + qh @ (grip_rest(s) - REST[f"hand_{X}"][0])
        ci = Wq["chest"].inverted()
        back = lambda p: tuple(ci @ (p - pos["chest"]) + REST["chest"][0])  # noqa: E731
        el = pos[f"forearm_{X}"]
        mid = (pos[f"upper_arm_{X}"] + pos[f"hand_{X}"]) / 2
        return {"g" + X: back(g), "g" + X + "f": tuple(ci @ (qh @ a_r)), "g" + X + "u": tuple(ci @ (qh @ t_r)),
                "e" + X: tuple(ci @ (el - mid).normalized())}

    def apply(self, P):
        rots, hl, _ = self.solve(P)
        for name, q in rots.items():
            self.arm.pose.bones[name].rotation_quaternion = q
        self.arm.pose.bones["hips"].location = hl

    def clip(self, name, dur, fn, loop=False):
        """Bake fn(t)->params at 30 fps into action `name`. Loops: last frame == first."""
        n = max(1, round(dur * FPS))
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        if not self.arm.animation_data:
            self.arm.animation_data_create()
        self.arm.animation_data.action = act
        prev = {}
        for f in range(n + 1):
            t = (f % n if loop else f) / FPS
            rots, hl, _ = self.solve(fn(t))
            for b, q in rots.items():
                if b in prev and prev[b].dot(q) < 0:
                    q = -q
                prev[b] = q
                pb = self.arm.pose.bones[b]
                pb.rotation_quaternion = q
                pb.keyframe_insert("rotation_quaternion", frame=f)
            pb = self.arm.pose.bones["hips"]
            pb.location = hl
            pb.keyframe_insert("location", frame=f)
        act.use_frame_range = True
        act.frame_start, act.frame_end = 0, n
        act.use_cyclic = loop
        self.clips.append((name, n / FPS, loop))
        self.arm.animation_data.action = None
        return act

    # ---------- output ----------
    def export(self):
        out_dir = os.path.join(ROOT, "public", "assets", "models", self.cat)
        os.makedirs(out_dir, exist_ok=True)
        path = os.path.join(out_dir, f"{self.id}.glb")
        for pb in self.arm.pose.bones:
            pb.rotation_quaternion = Quaternion()
            pb.location = (0, 0, 0)
        bpy.ops.object.select_all(action="DESELECT")
        for ob in bpy.context.scene.objects:
            ob.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_image_format="NONE",
            export_extras=False, export_animations=True, export_animation_mode="ACTIONS", export_force_sampling=True,
            export_frame_step=1, export_def_bones=False, export_skins=True, export_all_influences=False,
            export_anim_slide_to_zero=True, export_optimize_animation_size=True, export_reset_pose_bones=True,
            export_apply=False)
        self.glb = path
        return path

    def report(self):
        print("ASSET_REPORT " + __import__("json").dumps({
            "id": self.id, "category": self.cat, "glb": os.path.relpath(self.glb, ROOT).replace("\\", "/"),
            "tris": self.stats, "clips": {n: round(d, 3) for n, d, _ in self.clips}}))

    # ---------- previews (Workbench) ----------
    def _render(self, path, view, lod=0, size=360, ortho=None):
        sc = bpy.context.scene
        sc.render.engine = "BLENDER_WORKBENCH"
        sc.display.shading.light = "STUDIO"
        sc.display.shading.color_type = "TEXTURE"
        sc.display.shading.show_cavity = False
        sc.render.resolution_x = sc.render.resolution_y = size
        sc.render.film_transparent = False
        sc.world = sc.world or bpy.data.worlds.new("w")
        sc.world.color = (0.32, 0.34, 0.36)
        for ob in sc.objects:
            if not ob.name.startswith("_proxy"):
                ob.hide_render = not ob.name.endswith(f"_LOD{lod}") and ob.name != "_ground"
        cam = bpy.data.objects.get("_cam")
        if not cam:
            cam = bpy.data.objects.new("_cam", bpy.data.cameras.new("_cam"))
            sc.collection.objects.link(cam)
            g = bpy.data.meshes.new("_ground")
            gb = bmesh.new()
            bmesh.ops.create_grid(gb, x_segments=8, y_segments=8, size=4.0)
            gb.to_mesh(g)
            go = bpy.data.objects.new("_ground", g)
            sc.collection.objects.link(go)
            gm = bpy.data.materials.new("_g")
            gm.diffuse_color = (0.2, 0.2, 0.2, 1)
            g.materials.append(gm)
        tgt, d, el = view
        tgt = Vector(tgt)
        cam.data.lens = 50
        cam.data.type = "ORTHO" if ortho else "PERSP"
        if ortho:
            cam.data.ortho_scale = ortho
        yaw, pitch, dist = d
        dirv = Vector((math.sin(math.radians(yaw)) * math.cos(math.radians(pitch)),
                       math.cos(math.radians(yaw)) * math.cos(math.radians(pitch)), math.sin(math.radians(pitch))))
        cam.location = tgt + dirv * dist
        cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.camera = cam
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)

    def _proxies(self):
        if not hasattr(self, "_px"):
            self._px = {}
            for k, v in PROXY.items():
                ob = _proxy_mesh("_proxy_" + k, v, self.arm)
                ob.parent_type = "BONE"
                ob.parent_bone = "SOCKET_hand_R"
                # bone parenting is relative to the tail; proxy coords (+Y barrel, +Z top) -> bone (+Y top, -Z barrel)
                ob.matrix_parent_inverse = Matrix.Translation((0, -0.08, 0)) @ Matrix.Rotation(-math.pi / 2, 4, "X")
                self._px[k] = ob
        return self._px

    def sheet(self, out, cells, cols, size=360):
        """cells: list of (clip or None, time, view, lod). view = (target, (yaw, pitch, dist), _).
        yaw 0 = camera in front of the character (on +Y), 180 = behind."""
        import numpy as np
        tmpdir = os.path.join(ROOT, "assets", "previews", "_tmp")
        os.makedirs(tmpdir, exist_ok=True)
        imgs = []
        for i, cell in enumerate(cells):
            clip, t, view, lod = cell[:4]
            for pr in self._proxies().values():
                pr.hide_render = True
            if len(cell) > 4 and cell[4]:
                self._proxies()[cell[4]].hide_render = False
            if clip:
                self.apply(clip(t) if callable(clip) else clip)
            else:
                for pb in self.arm.pose.bones:
                    pb.rotation_quaternion = Quaternion()
                    pb.location = (0, 0, 0)
            bpy.context.view_layer.update()
            p = os.path.join(tmpdir, f"{self.id}_{i}.png")
            self._render(p, view, lod, size)
            img = bpy.data.images.load(p)
            a = np.empty(size * size * 4, dtype=np.float32)
            img.pixels.foreach_get(a)
            imgs.append(a.reshape(size, size, 4))
            bpy.data.images.remove(img)
            os.remove(p)
        rows = (len(imgs) + cols - 1) // cols
        S = np.zeros((rows * size, cols * size, 4), dtype=np.float32)
        S[..., 3] = 1
        for i, a in enumerate(imgs):
            r, c = rows - 1 - i // cols, i % cols  # image rows are bottom-up
            S[r * size:(r + 1) * size, c * size:(c + 1) * size] = a
        im = bpy.data.images.new("sheet", cols * size, rows * size, alpha=True)
        im.pixels.foreach_set(S.ravel())
        im.filepath_raw = out
        im.file_format = "PNG"
        im.save()
        try:
            os.rmdir(tmpdir)
        except OSError:
            pass


# preview-only weapon proxies in SOCKET_hand_R space (Blender local: +Y barrel/fingers, +Z top/thumb)
PROXY = {
    "pistol": [((0, -0.012, -0.02), (0.03, 0.045, 0.11), -12), ((0, 0.055, 0.06), (0.032, 0.2, 0.038), 0)],
    "rifle": [((0, -0.01, -0.03), (0.03, 0.04, 0.1), -15), ((0, 0.09, 0.05), (0.05, 0.3, 0.07), 0),
              ((0, 0.42, 0.06), (0.025, 0.4, 0.025), 0), ((0, 0.3, 0.035), (0.055, 0.2, 0.06), 0),
              ((0, -0.17, 0.035), (0.04, 0.28, 0.08), 0), ((0, 0.12, -0.08), (0.035, 0.07, 0.16), 15)],
    "knife": [((0, 0, 0.0), (0.03, 0.03, 0.11), 0), ((0, 0, 0.16), (0.006, 0.035, 0.19), 0)],
    "bat": [((0, 0, 0.05), (0.035, 0.035, 0.3), 0), ((0, 0, 0.45), (0.06, 0.06, 0.55), 0)],
}


def _proxy_mesh(name, parts, parent):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    for c, sz, rx in parts:
        m = Matrix.Translation(c) @ Matrix.Rotation(math.radians(rx), 4, "X") @ Matrix.Diagonal((*sz, 1))
        bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    bm.to_mesh(me)
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (0.85, 0.25, 0.05, 1)
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.parent = parent
    return ob


def preview_sheets(ch, clips, sheets, size=300, cols=6):
    """Render assets/previews/<id>.png (idle 3/4) plus <id>_<name>.png strips.
    sheets: {name: [(clip, [times], yaw, pitch, dist, target_z, prop), ...]}; clip None = rest pose."""
    fns = {c[0]: c[2] for c in clips}
    out = os.path.join(ROOT, "assets", "previews")
    first = clips[0]
    ch.sheet(os.path.join(out, f"{ch.id}.png"), [(fns[first[0]], 0.0, ((0, 0, 0.9), (35, 8, 3.3), 0), 0)], 1, 512)
    for name, rows in sheets.items():
        cells = []
        for clip, times, yaw, pitch, dist, tz, *rest in rows:
            prop = rest[0] if rest else None
            lod = rest[1] if len(rest) > 1 else 0
            for t in times:
                cells.append((fns[clip] if clip else None, t, ((0, 0, tz), (yaw, pitch, dist), 0), lod, prop))
        ch.sheet(os.path.join(out, f"{ch.id}_{name}.png"), cells, cols, size)


def _frame(a, h):
    a = a.normalized()
    h = (h - a * h.dot(a)).normalized()
    return Matrix((a, h, a.cross(h))).transposed()


def _hinge(d1, d2, fallback):
    c = d2.cross(d1)
    return c.normalized() if c.length > 0.05 else fallback.normalized()


def _two_bone(root, target, l1, l2, pole):
    d = target - root
    D = min(max(d.length, abs(l1 - l2) + 1e-3), (l1 + l2) * 0.9995)
    n = d.normalized()
    u = pole - n * pole.dot(n)
    u = u.normalized() if u.length > 1e-5 else n.orthogonal().normalized()
    ca = (l1 * l1 + D * D - l2 * l2) / (2 * l1 * D)
    mid = root + (n * ca + u * math.sqrt(max(0.0, 1 - ca * ca))) * l1
    d1 = (mid - root).normalized()
    d2 = (root + n * D - mid).normalized()
    return d1, d2, n.cross(u).normalized()


def E(r):
    return Euler([math.radians(a) for a in r], "XYZ").to_quaternion()


def mir(r, s):
    return r if s > 0 else (r[0], -r[1], -r[2])


STAND = dict(hip=(0, 0, -0.012), hipR=(0, 0, 0), spine=(0, 0, 0), chest=(0, 0, 0), neck=(0, 0, 0), head=(0, 0, 0),
             shR=(0, 0, 0), shL=(0, 0, 0), aR=(4, 9, 12), aL=(4, 9, 12),
             fR=(0.11, -0.01, ANK), fL=(-0.11, 0.03, ANK), fRp=0, fLp=0, fRy=-6, fLy=6, tRp=0, tLp=0)


# ------------------------------------------------------------------------- motion helpers
def smooth(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def _lerp(a, b, t):
    if isinstance(a, (int, float)):
        return a + (b - a) * t
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def _ax(a, b, k):  # a + b*k elementwise
    if isinstance(a, (int, float)):
        return a + b * k
    return tuple(x + y * k for x, y in zip(a, b))


def _sub(a, b):
    return _ax(a, b, -1)


def keys(t, ks, loop=None):
    """Hermite-interpolate key dicts. ks = [(time, {param: value}, ease?)]; a param interpolates between the
    keys that set it. ease 0 = stop at the key (pose hold), 1 = Catmull-Rom flow-through. loop = period."""
    names = []
    for k in ks:
        for n in k[1]:
            if n not in names:
                names.append(n)
    out = {}
    for n in names:
        pts = [(k[0], k[1][n], k[2] if len(k) > 2 else 0.6) for k in ks if n in k[1]]
        if loop:  # two wrapped keys each side so tangents flow across the seam
            if pts[-1][0] >= loop:
                pts = pts[:-1]
            pre = [(p[0] - loop, p[1], p[2]) for p in pts[-2:]]
            post = [(p[0] + loop, p[1], p[2]) for p in pts[:2]]
            pts = pre + pts + post
        if t <= pts[0][0]:
            out[n] = pts[0][1]
            continue
        if t >= pts[-1][0]:
            out[n] = pts[-1][1]
            continue
        i = max(j for j in range(len(pts) - 1) if pts[j][0] <= t)
        (t0, p0, e0), (t1, p1, e1) = pts[i], pts[i + 1]

        def tan(j):
            if j <= 0 or j >= len(pts) - 1:
                return _sub(pts[j][1], pts[j][1])
            a, b = pts[j - 1], pts[j + 1]
            return tuple_scale(_sub(b[1], a[1]), pts[j][2] / (b[0] - a[0]))

        h = t1 - t0
        u = (t - t0) / h
        h00, h10, h01, h11 = 2 * u ** 3 - 3 * u ** 2 + 1, u ** 3 - 2 * u ** 2 + u, -2 * u ** 3 + 3 * u ** 2, u ** 3 - u ** 2
        v = tuple_scale(p0, h00)
        v = _ax(v, tan(i), h10 * h)
        v = _ax(v, p1, h01)
        v = _ax(v, tan(i + 1), h11 * h)
        out[n] = v
    return out


def tuple_scale(a, k):
    return a * k if isinstance(a, (int, float)) else tuple(x * k for x in a)


def ankle_at(x, y, pitch, yaw=0.0):
    """Ankle position for a foot whose flat-stance ground point is (x, y): pitch>0 pivots on the heel,
    pitch<0 on the ball (heel lift), so the contact point never slides."""
    q = E((0, 0, yaw)) @ E((pitch, 0, 0))
    qy = E((0, 0, yaw))
    piv = Vector((0, -0.06, -ANK)) if pitch > 0 else Vector((0, 0.13, -ANK))
    ground = Vector((x, y, 0)) + qy @ Vector((0, piv.y, 0))
    return tuple(ground - q @ piv)


def softmin(a, b, k=0.03):
    h = max(k - abs(a - b), 0) / k
    return min(a, b) - h * h * k * 0.25


def gait(t, c):
    """Locomotion params at time t. c: v speed, T period, duty, w half foot spacing, lift, reach (stance centre y),
    hs heel-strike pitch, to toe-off pitch, hip_z, comp, lean, arms (af, aa, eb, ea, ab), yaw, roll, sway.
    Per-leg overrides: duty_R/duty_L, lift_R, drag_R (toe drag), off_L (phase of left leg, default 0.5)."""
    T, v = c["T"], c["v"]
    ph = (t / T) % 1.0
    P = {}
    hz_lim = []
    comp = 0.0
    for X, s in SIDES:
        duty = c.get("duty_" + X, c["duty"])
        psi = (ph - (0.0 if X == "R" else c.get("off_L", 0.5))) % 1.0
        d = v * duty * T
        y0, y1 = c["reach"] + d / 2, c["reach"] - d / 2
        hs, to = c.get("hs_" + X, c["hs"]), c.get("to_" + X, c["to"])
        if psi < duty:
            u = psi / duty
            gy = y0 + (y1 - y0) * u
            heel = c.get("heel", 0.6)
            pitch = hs * (1 - smooth(u / 0.18)) - to * smooth((u - heel) / (1 - heel))
            toe = max(pitch, 0.0)
            lift = 0.0
            comp += math.sin(math.pi * u)
        else:
            u = (psi - duty) / (1 - duty)
            Ts = (1 - duty) * T
            m0, m1 = -v * Ts * c.get("k0", 0.7), -v * Ts * 0.25
            h00, h10, h01, h11 = 2 * u ** 3 - 3 * u ** 2 + 1, u ** 3 - 2 * u ** 2 + u, -2 * u ** 3 + 3 * u ** 2, u ** 3 - u ** 2
            gy = h00 * y1 + h10 * m0 + h01 * y0 + h11 * m1
            drag = c.get("drag_" + X, 0.0)
            pitch = _lerp(-to, hs, smooth(u)) + c.get("swp", 8) * math.sin(math.pi * u) * (1 - drag) - drag * 25 * math.sin(math.pi * u)
            toe = _lerp(0.0, max(hs, 0), smooth(u))
            lift = c.get("lift_" + X, c["lift"]) * math.sin(math.pi * min(1.0, u ** c.get("lpk", 0.8)))
        yaw = -s * c.get("toe_out", 6)
        ax, ay, az = ankle_at(s * c["w"], gy, pitch, yaw)
        az += lift
        P["f" + X], P["f" + X + "p"], P["f" + X + "y"], P["t" + X + "p"] = (ax, ay, az), pitch, yaw, toe
        dh = math.hypot(ay, ax - s * 0.095)
        L = 0.845 * 0.985
        if lift == 0.0 or u < 0.15:  # only feet on (or just leaving) the ground limit the pelvis height
            hz_lim.append(az + math.sqrt(max(L * L - dh * dh, 0.0)) + 0.04 - 0.97)
    w2 = 2 * math.pi * ph
    hip_z = c["hip_z"] - c.get("comp", 0.0) * comp + c.get("fly", 0.0) * max(0.0, 1 - comp)
    for lim in hz_lim:
        hip_z = softmin(hip_z, lim)
    hyaw = c.get("yaw", 6) * math.cos(w2)
    roll = -c.get("roll", 3) * math.sin(w2)
    lean = c.get("lean", 3)
    P["hip"] = (c.get("sway", 0.02) * math.sin(w2), c.get("hip_y", 0.0), hip_z)
    P["hipR"] = (-lean * 0.3, roll, hyaw)
    P["spine"] = (-lean * 0.35, -roll * 0.6, -hyaw * 0.6)
    P["chest"] = (-lean * 0.35 + c.get("breath", 0.0), -roll * 0.4, -hyaw * 0.6)
    nod = c.get("nod", 1.5) * math.cos(2 * w2)
    P["neck"] = (lean * 0.45, 0, hyaw * 0.1)
    P["head"] = (lean * 0.5 + nod, 0, hyaw * 0.1)
    af, aa, eb, ea, ab = c.get("arms", (2, 18, 15, 20, 9))
    lag = c.get("alag", 0.04)
    sw_ = math.cos(2 * math.pi * (ph - lag))
    el = 0.5 * (1 - math.cos(2 * math.pi * (ph - lag - 0.06)))
    P["aR"] = (af - aa * sw_, ab, eb + ea * el, c.get("ain", 0))
    P["aL"] = (af + aa * sw_, ab, eb + ea * (1 - el), c.get("ain", 0))
    P["shR"] = (0, 0, 3 * -sw_ * aa / 18)
    P["shL"] = (0, 0, 3 * sw_ * aa / 18)
    return P


def stance(dx=0.0, stagger=0.0, z=-0.012, w=0.11, toe_out=6):
    """Planted feet params: left foot `stagger` m ahead, hips shifted dx."""
    return dict(fR=ankle_at(w, -stagger / 2, 0), fL=ankle_at(-w, stagger / 2, 0), fRy=-toe_out, fLy=toe_out,
                fRp=0, fLp=0, tRp=0, tLp=0, hip=(dx, 0, z))


def wpt(g, f, u, local):
    """Point in a weapon frame (grip g, barrel f, up u) -> same space as g. local = (right, fwd, up)."""
    g, f, u = Vector(g), Vector(f).normalized(), Vector(u).normalized()
    r = f.cross(u)
    return tuple(g + r * local[0] + f * local[1] + u * local[2])
