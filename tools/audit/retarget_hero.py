# blender --background --python retarget_hero.py -- <hero_rigged.glb> <survivor_rig.glb (decoded)> <out.glb> <id>
# Moves every clip of the survivor rig onto the hero's skeleton (Mixamo-named, T-pose; the survivor rig rests in an A-pose).
#   * Both rigs face +Y, so no turn. Spine, neck, head and legs: world-space rotation delta (pose * rest^-1) applied to the
#     target's rest, which works whatever the bone roll is.
#   * Arm chain (shoulder, arm, forearm, hand): the survivor's rest is rotated to a virtual T-pose first (minimal rotation that
#     points each source bone along the target's rest direction), and the delta is taken against that reference, so
#     direction AND twist follow the source; this is what keeps a two-handed rifle hold correct.
#   * Hips translation is scaled by the hip-height ratio.
#   * SOCKET_hand_R / SOCKET_hand_L bones are added under the hands with the same world orientation the survivor's sockets
#     have in the posed hand, so every weapon clip and the first-person logic can use them unchanged.
#   * Meshes become <id>_LOD0/1/2; the armature is <id>_rig.
import bpy, sys, math
from mathutils import Matrix, Quaternion, Vector

a = sys.argv[sys.argv.index('--') + 1:]
tgt_glb, src_glb, out, nid = a[0], a[1], a[2], a[3]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

bpy.ops.import_scene.gltf(filepath=src_glb)
src = next(o for o in scene.objects if o.type == 'ARMATURE')
for o in list(scene.objects):
    if o.type == 'MESH': bpy.data.objects.remove(o, do_unlink=True)
src_actions = list(bpy.data.actions)
for x in src_actions: x.name = 'src_' + x.name

before = set(scene.objects); before_actions = set(bpy.data.actions)
bpy.ops.import_scene.gltf(filepath=tgt_glb)
new = [o for o in scene.objects if o not in before]
tgt = next(o for o in new if o.type == 'ARMATURE')
for x in set(bpy.data.actions) - before_actions: bpy.data.actions.remove(x)
tgt.animation_data_create()

MAP = {'hips': 'Hips', 'spine': 'Spine', 'chest': 'Spine2', 'neck': 'Neck', 'head': 'Head',
       'thigh_L': 'LeftUpLeg', 'shin_L': 'LeftLeg', 'foot_L': 'LeftFoot', 'toe_L': 'LeftToeBase',
       'thigh_R': 'RightUpLeg', 'shin_R': 'RightLeg', 'foot_R': 'RightFoot', 'toe_R': 'RightToeBase'}
LIMB = {}  # target bone -> source bone
for side, S in (('Left', 'L'), ('Right', 'R')):
    LIMB[side + 'Shoulder'] = 'shoulder_' + S; LIMB[side + 'Arm'] = 'upper_arm_' + S
    LIMB[side + 'ForeArm'] = 'forearm_' + S; LIMB[side + 'Hand'] = 'hand_' + S
EXTRA = {'Spine1': 'spine'}
Ws, Wt = src.matrix_world, tgt.matrix_world
Wsq, Wtq = Ws.to_quaternion(), Wt.to_quaternion()
sb = src.data.bones; tb = tgt.data.bones

def sq_rest(name): return (Ws @ sb[name].matrix_local).to_quaternion()
def tq_rest(name): return (Wt @ tb[name].matrix_local).to_quaternion()
def s_dir(name): return (Wsq @ (sb[name].tail_local - sb[name].head_local)).normalized()
def t_dir(name): return (Wtq @ (tb[name].tail_local - tb[name].head_local)).normalized()

# ---- sockets: orientation in the target's rest = (virtual-T reference of the hand) * (source hand rest)^-1 * (source socket rest)
bpy.context.view_layer.objects.active = tgt
bpy.ops.object.mode_set(mode='EDIT')
for side, S in (('Right', 'R'), ('Left', 'L')):
    hand_t = tgt.data.edit_bones[side + 'Hand']
    ref = s_dir('hand_' + S).rotation_difference(t_dir(side + 'Hand')) @ sq_rest('hand_' + S)
    Ksock = ref @ sq_rest('hand_' + S).inverted()
    Qsock = Ksock @ sq_rest('SOCKET_hand_' + S)
    # position: same offset from the wrist, measured in the source hand's frame, mapped through the same rotation
    off_s = Wsq.inverted() @ ((Ws @ sb['SOCKET_hand_' + S].head_local) - (Ws @ sb['hand_' + S].head_local))
    off_t = Ksock @ (Wsq @ off_s) if False else Ksock @ ((Ws @ sb['SOCKET_hand_' + S].head_local) - (Ws @ sb['hand_' + S].head_local))
    sk = tgt.data.edit_bones.new('SOCKET_hand_' + S)
    sk.parent = hand_t; sk.use_connect = False; sk.use_deform = False
    head = hand_t.head + off_t
    sk.head = head; sk.tail = head + Vector((0, 0.09, 0))
    sk.matrix = Matrix.Translation(head) @ Qsock.to_matrix().to_4x4()
    sk.length = 0.09
bpy.ops.object.mode_set(mode='OBJECT')
for pb in tgt.pose.bones: pb.rotation_mode = 'QUATERNION'

tgt_rest_w = {n: tq_rest(n) for n in list(MAP.values()) + list(EXTRA) + list(LIMB)}
tgt_rest_arm = {b.name: b.matrix_local.to_quaternion() for b in tb}
src_rest = {s: sq_rest(s) for s in list(MAP) + list(LIMB.values())}
ref_limb = {t: s_dir(s).rotation_difference(t_dir(t)) @ src_rest[s] for t, s in LIMB.items()}
src_hip_rest = (Ws @ sb['hips'].matrix_local).translation
tgt_hip_rest = (Wt @ tb['Hips'].matrix_local).translation
k_scale = tgt_hip_rest.z / max(src_hip_rest.z, 1e-3)
order = [b.name for b in tb]
inv = {v: k for k, v in MAP.items()}
created = []
for act in src_actions:
    src.animation_data_create(); src.animation_data.action = act
    f0, f1 = int(round(act.frame_range[0])), int(round(act.frame_range[1]))
    new_act = bpy.data.actions.new(act.name[4:]); new_act.use_fake_user = True; tgt.animation_data.action = new_act
    for f in range(f0, f1 + 1):
        scene.frame_set(f)
        pose_q = {s: (Ws @ src.pose.bones[s].matrix).to_quaternion() for s in src_rest}
        hp = (Ws @ src.pose.bones['hips'].matrix).translation - src_hip_rest
        hips_world = hp * k_scale
        absq = {}
        for name in order:
            bone = tb[name]
            if name in LIMB:
                s = LIMB[name]
                delta = pose_q[s] @ ref_limb[name].inverted()
                absq[name] = Wtq.inverted() @ (delta @ tgt_rest_w[name])
            elif name in inv:
                s = inv[name]; d = pose_q[s] @ src_rest[s].inverted()
                if s == 'spine': d = Quaternion().slerp(d, 0.5)
                absq[name] = Wtq.inverted() @ (d @ tgt_rest_w[name])
            elif name in EXTRA:
                d = pose_q[EXTRA[name]] @ src_rest[EXTRA[name]].inverted()
                absq[name] = Wtq.inverted() @ (d @ tgt_rest_w[name])
            elif bone.parent:
                absq[name] = absq[bone.parent.name] @ (tgt_rest_arm[bone.parent.name].inverted() @ tgt_rest_arm[name])
            else:
                absq[name] = tgt_rest_arm[name]
            pb = tgt.pose.bones[name]
            if bone.parent:
                p = bone.parent.name
                basis = (tgt_rest_arm[p].inverted() @ tgt_rest_arm[name]).inverted() @ absq[p].inverted() @ absq[name]
            else:
                basis = tgt_rest_arm[name].inverted() @ absq[name]
            pb.rotation_quaternion = basis
            pb.keyframe_insert('rotation_quaternion', frame=f)
            if name == 'Hips':
                pb.location = tgt_rest_arm[name].inverted() @ (Wtq.inverted() @ hips_world)
                pb.keyframe_insert('location', frame=f)
    created.append(new_act.name)
tgt.animation_data.action = None
bpy.data.objects.remove(src, do_unlink=True)
for x in src_actions: bpy.data.actions.remove(x)

meshes = [o for o in scene.objects if o.type == 'MESH']
for o in scene.objects: o.select_set(False)
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
lod0 = bpy.context.view_layer.objects.active
lod0.name = nid + '_LOD0'; lod0.data.name = nid + '_LOD0'
tri = lambda o: sum(len(p.vertices) - 2 for p in o.data.polygons)
def lod(name, ratio):
    c = lod0.copy(); c.data = lod0.data.copy(); c.name = name; c.data.name = name; scene.collection.objects.link(c)
    for x in scene.objects: x.select_set(False)
    bpy.context.view_layer.objects.active = c; c.select_set(True)
    d = c.modifiers.new('d', 'DECIMATE'); d.ratio = ratio
    bpy.ops.object.modifier_apply(modifier=d.name)
    return c
l1 = lod(nid + '_LOD1', 0.5); l2 = lod(nid + '_LOD2', 0.2)
tgt.name = nid + '_rig'
for act in bpy.data.actions: act.use_fake_user = True
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_animation_mode='ACTIONS',
                          export_skins=True, export_apply=False, export_image_format='JPEG', export_jpeg_quality=90)
print('RETARGET_HERO', nid, 'clips', len(created), 'tris', tri(lod0), tri(l1), tri(l2))
