# blender --background --python retarget_pf.py -- <polyfork_char.glb> <our_zombie_rig.glb (decoded)> <out.glb> <new_id>
# Puts this game's 23 zombie clips on a Polyfork character (Mixamo-named skeleton):
#   * world-space rotation transfer (pose * rest^-1, turned 180 deg because the two rigs face opposite ways), so the
#     different bone roll and rest pose do not matter; both rigs are T-posed with arms along X;
#   * hips translation scaled by the hip-height ratio;
#   * our spine drives Spine (half) and Spine1 (full), our chest drives Spine2; face bones stay in rest pose;
#   * the character's own meshes are joined into <id>_LOD0 (+ LOD1/LOD2 by decimation), weights untouched.
import bpy, sys, math
from mathutils import Quaternion, Vector

a = sys.argv[sys.argv.index('--') + 1:]
tgt_glb, src_glb, out, nid = a[0], a[1], a[2], a[3]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

bpy.ops.import_scene.gltf(filepath=src_glb)
src = next(o for o in scene.objects if o.type == 'ARMATURE')
for o in list(scene.objects):
    if o.type == 'MESH': bpy.data.objects.remove(o, do_unlink=True)
src_actions = [x for x in bpy.data.actions]
src_names = [x.name for x in src_actions]
for x in src_actions: x.name = 'src_' + x.name  # free the clip names for the retargeted copies

before = set(scene.objects)
before_actions = set(bpy.data.actions)
bpy.ops.import_scene.gltf(filepath=tgt_glb)
new = [o for o in scene.objects if o not in before]
tgt = next(o for o in new if o.type == 'ARMATURE')
for x in set(bpy.data.actions) - before_actions: bpy.data.actions.remove(x)  # the character's own Idle/Walk/Run
for o in new:
    if o.type == 'MESH' and not o.vertex_groups: bpy.data.objects.remove(o, do_unlink=True)  # bone-shape helper
tgt.animation_data_create()

MAP = {'hips': 'Hips', 'spine': 'Spine', 'chest': 'Spine2', 'neck': 'Neck', 'head': 'Head',
       'shoulder_L': 'LeftShoulder', 'upper_arm_L': 'LeftArm', 'forearm_L': 'LeftForeArm', 'hand_L': 'LeftHand',
       'shoulder_R': 'RightShoulder', 'upper_arm_R': 'RightArm', 'forearm_R': 'RightForeArm', 'hand_R': 'RightHand',
       'thigh_L': 'LeftUpLeg', 'shin_L': 'LeftLeg', 'foot_L': 'LeftFoot', 'toe_L': 'LeftToeBase',
       'thigh_R': 'RightUpLeg', 'shin_R': 'RightLeg', 'foot_R': 'RightFoot', 'toe_R': 'RightToeBase'}
# Arm chain: our rig rests in an A-pose (arms ~45 deg down), Polyfork's in a T-pose, so rotation deltas cannot transfer.
# These target bones are aimed so each points where the matching source bone points (absolute direction, minimal twist).
# (target bone, source bone, target child bone whose head marks the bone's end; None = continue the parent's direction)
LIMBDIR = {}
for side, S in (('Left', 'L'), ('Right', 'R')):
    LIMBDIR[side + 'Shoulder'] = ('shoulder_' + S, side + 'Arm')
    LIMBDIR[side + 'Arm'] = ('upper_arm_' + S, side + 'ForeArm')
    LIMBDIR[side + 'ForeArm'] = ('forearm_' + S, side + 'Hand')
    LIMBDIR[side + 'Hand'] = ('hand_' + S, None)
EXTRA = {'Spine1': 'spine'}  # target bones driven by a source bone in addition to the mapped one
R = Quaternion((0, 0, 1), math.pi)
Ws, Wt = src.matrix_world, tgt.matrix_world
Wtq = Wt.to_quaternion()

def rest_q(arm, W, name): return (W @ arm.data.bones[name].matrix_local).to_quaternion()
src_rest = {s: rest_q(src, Ws, s) for s in MAP}
tgt_rest_w = {t: rest_q(tgt, Wt, t) for t in list(MAP.values()) + list(EXTRA)}
tgt_rest_arm = {b.name: b.matrix_local.to_quaternion() for b in tgt.data.bones}
def rest_dir_t(name):
    b = tgt.data.bones[name]
    child = LIMBDIR[name][1]
    if child is None:  # hand: continue the forearm
        b = b.parent; child = b.name.replace('Arm', 'Arm')
        ch = tgt.data.bones[name]
        v = ch.head_local - b.head_local
    else:
        v = tgt.data.bones[child].head_local - b.head_local
    return (Wtq @ v).normalized()
tgt_dir_rest = {n: rest_dir_t(n) for n in LIMBDIR}
src_hip_rest = (Ws @ src.data.bones['hips'].matrix_local).translation
tgt_hip_rest = (Wt @ tgt.data.bones['Hips'].matrix_local).translation
k_scale = tgt_hip_rest.z / max(src_hip_rest.z, 1e-3)
order = [b.name for b in tgt.data.bones]  # parents before children
inv = {v: k for k, v in MAP.items()}
for pb in tgt.pose.bones: pb.rotation_mode = 'QUATERNION'

created = []
for act in src_actions:
    src.animation_data_create(); src.animation_data.action = act
    f0, f1 = int(round(act.frame_range[0])), int(round(act.frame_range[1]))
    new_act = bpy.data.actions.new(act.name[4:]); new_act.use_fake_user = True; tgt.animation_data.action = new_act
    for f in range(f0, f1 + 1):
        scene.frame_set(f)
        delta = {}
        for s in MAP:
            pq = (Ws @ src.pose.bones[s].matrix).to_quaternion()
            delta[s] = R @ (pq @ src_rest[s].inverted()) @ R.inverted()
        hp = (Ws @ src.pose.bones['hips'].matrix).translation - src_hip_rest
        hips_world = R @ hp * k_scale
        absq = {}
        for name in order:
            bone = tgt.data.bones[name]
            drv = inv.get(name)
            frac = None
            if name in LIMBDIR:
                sb = src.pose.bones[LIMBDIR[name][0]]
                dv = (R @ (Ws.to_quaternion() @ (sb.tail - sb.head))).normalized()
                absq[name] = (Wtq.inverted() @ (tgt_dir_rest[name].rotation_difference(dv) @ tgt_rest_w[name]))
            elif drv:
                d = delta[drv]
                if drv == 'spine': d = Quaternion().slerp(d, 0.5)
                frac = d
            elif name in EXTRA:
                frac = delta[EXTRA[name]]
            if name in LIMBDIR:
                pass
            elif frac is not None:
                absq[name] = Wtq.inverted() @ (frac @ tgt_rest_w[name])
            elif bone.parent:
                absq[name] = absq[bone.parent.name] @ (tgt_rest_arm[bone.parent.name].inverted() @ tgt_rest_arm[name])
            else:
                absq[name] = tgt_rest_arm[name]
            if bone.parent:
                p = bone.parent.name
                basis = (tgt_rest_arm[p].inverted() @ tgt_rest_arm[name]).inverted() @ absq[p].inverted() @ absq[name]
            else:
                basis = tgt_rest_arm[name].inverted() @ absq[name]
            pb = tgt.pose.bones[name]
            pb.rotation_quaternion = basis
            pb.keyframe_insert('rotation_quaternion', frame=f)
            if name == 'Hips':
                pb.location = tgt_rest_arm[name].inverted() @ (Wtq.inverted() @ hips_world)
                pb.keyframe_insert('location', frame=f)
    created.append(new_act.name)
tgt.animation_data.action = None
bpy.data.objects.remove(src, do_unlink=True)
for x in src_actions: bpy.data.actions.remove(x)

# join the character's meshes into LOD0..LOD2
meshes = [o for o in scene.objects if o.type == 'MESH']
for o in scene.objects: o.select_set(False)
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
lod0 = bpy.context.view_layer.objects.active
lod0.name = nid + '_LOD0'; lod0.data.name = nid + '_LOD0'
tri = lambda o: sum(len(p.vertices) - 2 for p in o.data.polygons)
def lod(name, ratio):
    c = lod0.copy(); c.data = lod0.data.copy(); c.name = name; scene.collection.objects.link(c)
    for x in scene.objects: x.select_set(False)
    bpy.context.view_layer.objects.active = c; c.select_set(True)
    d = c.modifiers.new('d', 'DECIMATE'); d.ratio = ratio
    bpy.ops.object.modifier_apply(modifier=d.name)
    return c
l1 = lod(nid + '_LOD1', 0.5); l2 = lod(nid + '_LOD2', 0.2)
l1.data.name = nid + '_LOD1'; l2.data.name = nid + '_LOD2'
tgt.name = nid + '_rig'
bb = [lod0.matrix_world @ Vector(c) for c in lod0.bound_box]
height = max(v.z for v in bb) - min(v.z for v in bb)
for act in bpy.data.actions: act.use_fake_user = True
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_animation_mode='ACTIONS',
                          export_skins=True, export_apply=False, export_vertex_color='ACTIVE', export_image_format='JPEG')
print('RETARGET_PF', nid, 'clips', len(created), 'tris', tri(lod0), tri(l1), tri(l2), 'height', round(height, 2))
