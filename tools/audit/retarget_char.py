# blender --background --python retarget_char.py -- <rig.glb (decompressed zmb_shambler_a)> <ai_mesh.glb> <out.glb> <new_id> <height_m> [yaw_flip_deg] [lod0_tris]
# Takes an AI-generated A-pose character mesh and skins it to the game's existing zombie rig:
#   fit to the rig's proportions, copy skin weights from the original mesh by nearest surface, build LOD0/1/2 and
#   a collision box, export a GLB the crowd renderer accepts (clips are borrowed from zmb_shambler_a by bone name).
import bpy, sys, math, mathutils
a = sys.argv[sys.argv.index('--') + 1:]
rig_glb, ai_glb, out, nid, height = a[0], a[1], a[2], a[3], float(a[4])
flip = float(a[5]) if len(a) > 5 else 180.0
tris0 = int(a[6]) if len(a) > 6 else 3500
keep = a[7] if len(a) > 7 and a[7] != '-' else None   # keep meshes whose name contains this (e.g. BACKPACK)
anims = len(a) > 8 and a[8] == '1'                       # export the rig's clips too (the player model owns its clips)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=rig_glb)
scene = bpy.context.scene
arm = next(o for o in scene.objects if o.type == 'ARMATURE')
old = next(o for o in scene.objects if o.type == 'MESH' and o.name.endswith('_LOD0'))
root = next(o for o in scene.objects if o.type == 'EMPTY' and o.parent is None)
col_old = next((o for o in scene.objects if '_COL_' in o.name), None)
for o in list(scene.objects):
    if o.type == 'MESH' and o is not old and o is not col_old and not (keep and keep in o.name): bpy.data.objects.remove(o, do_unlink=True)
old_h = old.dimensions.z
before = set(scene.objects)
bpy.ops.import_scene.gltf(filepath=ai_glb)
new_objs = [o for o in scene.objects if o not in before and o.type == 'MESH']
for o in scene.objects: o.select_set(False)
for o in new_objs: o.select_set(True)
bpy.context.view_layer.objects.active = new_objs[0]
if len(new_objs) > 1: bpy.ops.object.join()
nm = bpy.context.view_layer.objects.active
nm.parent = None
def only(o):
    for x in scene.objects: x.select_set(x is o)
    bpy.context.view_layer.objects.active = o
only(nm)
for o in list(scene.objects):  # drop the import's empties/armatures
    if o.type in ('EMPTY',) and o is not root and o not in (nm,): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
nm.rotation_mode = 'XYZ'; nm.rotation_euler = (0, 0, math.radians(flip)); only(nm); bpy.ops.object.transform_apply(rotation=True)
# decimate the AI mesh first (cheaper everything after)
n = sum(len(p.vertices) - 2 for p in nm.data.polygons)
if n > tris0:
    m = nm.modifiers.new('d', 'DECIMATE'); m.ratio = tris0 / n; bpy.ops.object.modifier_apply(modifier=m.name)
# fit: feet on z=0, height = rig height, centred in x/y; arm span matched to the rig's hands
def bbox(o):
    ws = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    return [min(v[i] for v in ws) for i in range(3)], [max(v[i] for v in ws) for i in range(3)]
lo, hi = bbox(nm)
s = height / (hi[2] - lo[2])
nm.scale = (s, s, s); only(nm); bpy.ops.object.transform_apply(scale=True)
lo, hi = bbox(nm); olo, ohi = bbox(old)
sx = (ohi[0] - olo[0]) / max(hi[0] - lo[0], 1e-6)
sx = min(1.15, max(0.75, sx))
nm.scale = (sx, sx, 1); only(nm); bpy.ops.object.transform_apply(scale=True)
lo, hi = bbox(nm)
nm.location = (-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]); only(nm); bpy.ops.object.transform_apply(location=True)
# skin: vertex groups for every bone, weights from the original mesh by nearest surface
for b in arm.data.bones:
    if b.use_deform and b.name not in nm.vertex_groups: nm.vertex_groups.new(name=b.name)
dt = nm.modifiers.new('wt', 'DATA_TRANSFER')
dt.object = old; dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}
dt.vert_mapping = 'POLYINTERP_NEAREST'; dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
bpy.context.view_layer.objects.active = nm
bpy.ops.object.modifier_apply(modifier=dt.name)
bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
# AI bodies come with oversized heads: shrink everything mostly weighted to the head bone about the neck joint
import os
hs = float(os.environ.get('HEAD_SCALE', '0.84'))
if hs != 1.0 and 'head' in nm.vertex_groups:
    gi = nm.vertex_groups['head'].index
    pivot = arm.matrix_world @ arm.data.bones['head'].head_local
    inv = nm.matrix_world.inverted()
    pl = inv @ pivot
    for v in nm.data.vertices:
        w = next((g.weight for g in v.groups if g.group == gi), 0.0)
        if w > 0.15:
            k = 1 + (hs - 1) * min(1.0, w * 1.4)
            v.co = pl + (v.co - pl) * k
am = nm.modifiers.new('Armature', 'ARMATURE'); am.object = arm
nm.parent = arm
# UVs untouched; texture shrunk
for img in bpy.data.images:
    if img.size[0] > 1024: img.scale(1024, 1024)
for mat in bpy.data.materials: mat.use_backface_culling = True
# LODs
def lod(name, ratio):
    c = nm.copy(); c.data = nm.data.copy(); c.name = name; scene.collection.objects.link(c); c.parent = arm
    for md in list(c.modifiers):
        if md.type == 'ARMATURE': md.object = arm
    d = c.modifiers.new('d', 'DECIMATE'); d.ratio = ratio
    bpy.context.view_layer.objects.active = c; bpy.ops.object.modifier_apply(modifier=d.name)
    return c
nm.name = nid + '_LOD0'; nm.data.name = nid + '_LOD0'
l1 = lod(nid + '_LOD1', 0.5); l2 = lod(nid + '_LOD2', 0.2)
if col_old: col_old.name = nid + '_COL_box'
root.name = nid; arm.name = nid + '_rig'
bpy.data.objects.remove(old, do_unlink=True)
# zombies export without animations (the game borrows clips from zmb_shambler_a by bone name); the player keeps its own
if keep:
    for o in scene.objects:
        if keep in o.name: o.name = nid + '_' + keep
if not anims:
    for act in list(bpy.data.actions): bpy.data.actions.remove(act)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85, export_animations=False, export_apply=False, export_skins=True)
else:
    for act in bpy.data.actions: act.use_fake_user = True
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85, export_animations=True, export_animation_mode='ACTIONS', export_apply=False, export_skins=True)
cnt = lambda o: sum(len(p.vertices) - 2 for p in o.data.polygons)
print('NODE_XFORM', tuple(round(v,3) for v in nm.matrix_world.translation), tuple(round(v,3) for v in nm.rotation_euler), tuple(round(v,3) for v in nm.scale))
print('RETARGET', nid, 'tris', cnt(nm), cnt(l1), cnt(l2), 'height', round(nm.dimensions.z, 2))
