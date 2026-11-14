# blender --background --python build_gear.py -- <rigged.blend (chr_body_a)> <out.glb>
# Wearables for the underwear base body, exported with the same armature (no clips) to one GLB of skinned meshes `part_<id>`:
#   shell parts (jacket, vest, pants, boots, gloves): faces of the base body on those bones, pushed out along the normal and smoothed,
#     so they inherit the body's skin weights and follow every animation (the runtime hides the body areas they cover);
#   rigid parts (helmets, cap, gas mask, glasses, goggles, backpacks, satchel): library (Polyfork, CC BY 4.0) or locally generated
#     meshes (SDXL picture -> TRELLIS.2) fitted to the head / torso / hip measured from the body, skinned 100% to one bone.
import bpy, bmesh, sys, math, os
from mathutils import Vector, Matrix
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=a[0])
sc = bpy.context.scene
ROOT = os.environ.get('ROOT', 'E:/Documents/GitHub/project-valley')
arm = next(o for o in sc.objects if o.type == 'ARMATURE')
body = next(o for o in sc.objects if o.type == 'MESH')
for o in list(sc.objects):
    if o.type not in ('ARMATURE', 'MESH'): bpy.data.objects.remove(o, do_unlink=True)
vg = {g.index: g.name for g in body.vertex_groups}
BW = {v.index: {vg[g.group]: g.weight for g in v.groups} for v in body.data.vertices}
ALLB = [b.name for b in arm.data.bones]
HANDB = {n for n in ALLB if 'Hand' in n}
WR = abs(arm.data.bones['RightForeArm'].tail_local.x)
V = [v.co.copy() for v in body.data.vertices]
head = [c for c in V if c.z > 1.52]
HW = (max(c.x for c in head) - min(c.x for c in head))             # head width incl. hair
HTOP = max(c.z for c in head)
EYEZ = HTOP - 0.150
face = [c for c in V if abs(c.z - EYEZ) < 0.012 and abs(c.x) < 0.05]
FY = max(c.y for c in face); BY = min(c.y for c in head)
HCY = (FY + BY) / 2
tor = [c for c in V if abs(c.z - 1.28) < 0.02 and abs(c.x) < 0.2]
TY0, TY1 = min(c.y for c in tor), max(c.y for c in tor)
print('MEASURED headW', round(HW, 3), 'top', round(HTOP, 3), 'eyeZ', round(EYEZ, 3), 'faceY', round(FY, 3), 'headCY', round(HCY, 3), 'torso y', round(TY0, 3), round(TY1, 3), 'wrist', round(WR, 3))

# A clean proxy of the body for the shells: the generated body has cracks along its UV seams and bumpy wrinkles, so voxel-remesh it
# (watertight, even), then pull the skin weights over from the real body by nearest surface point.
px = body.copy(); px.data = body.data.copy(); px.name = 'proxy'; sc.collection.objects.link(px)
for o in sc.objects: o.select_set(False)
bpy.context.view_layer.objects.active = px; px.select_set(True)
for g in list(px.vertex_groups): px.vertex_groups.remove(g)
rm = px.modifiers.new('rm', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = float(os.environ.get('VOXEL', 0.009)); rm.use_smooth_shade = True
bpy.ops.object.modifier_apply(modifier=rm.name)
for g in body.vertex_groups: px.vertex_groups.new(name=g.name)
dt = px.modifiers.new('dt', 'DATA_TRANSFER'); dt.object = body; dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}
dt.vert_mapping = 'POLYINTERP_NEAREST'
bpy.ops.object.modifier_apply(modifier=dt.name)
px.modifiers.clear()
print('PROXY verts', len(px.data.vertices), 'faces', len(px.data.polygons))

def mat(name, rgb, rough=0.8):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough
    return m

WELD = float(os.environ.get('WELD', 0.0005))
SMOOTH = int(os.environ.get('SMOOTH', 4))
def shell(pid, bones, zr, push, rgb, xmax=9, minw=0.55, cuts=(), xr=(0.0, 9.0), tris=6000):
    me = px.data.copy(); ob = px.copy(); ob.data = me; ob.name = 'part_' + pid; sc.collection.objects.link(ob)
    keep = set()
    # T-pose, so garments are cut by position (a weight test leaves holes where weights split between bones)
    for v in px.data.vertices:
        if zr[0] <= v.co.z <= zr[1] and xr[0] <= abs(v.co.x) <= xr[1]: keep.add(v.index)
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if sum(v.index in keep for v in f.verts) < 3], context='FACES')
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=WELD)
    for co, no in cuts:
        bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces), plane_co=Vector(co), plane_no=Vector(no), clear_inner=True)
    bm.normal_update(); bm.verts.ensure_lookup_table()
    inner = [v for v in bm.verts if not v.is_boundary]
    # the generated body is bumpy (wrinkles are geometry): flatten the shell first, then push out along the smoothed normals
    for _ in range(SMOOTH):   # Taubin (shrink then inflate) so the shell flattens without losing volume
        bmesh.ops.smooth_vert(bm, verts=inner, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
        bmesh.ops.smooth_vert(bm, verts=inner, factor=-0.53, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    for v in bm.verts: v.co += v.normal * push
    for _ in range(2): bmesh.ops.smooth_vert(bm, verts=inner, factor=0.4, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.to_mesh(me); bm.free()
    me.materials.clear(); me.materials.append(mat('m_' + pid, rgb))
    for p in me.polygons: p.use_smooth = True
    n_ = len(me.polygons)
    if n_ > tris:
        for o in sc.objects: o.select_set(False)
        bpy.context.view_layer.objects.active = ob; ob.select_set(True)
        dm = ob.modifiers.new('d', 'DECIMATE'); dm.ratio = tris / n_; bpy.ops.object.modifier_apply(modifier=dm.name)
    return ob

def fit(pid, path, bone, width=None, height=None, depth=None, center=(0, 0, 0), yaw=0.0, anchor='center', rgb=None):
    """import a GLB, rotate by yaw about Z, scale uniformly to the given width/height/depth, place its bbox per `anchor`
    ('center' = bbox centre at `center`, 'bottom' = bbox bottom-centre, 'front' = bbox front face (max y) centre) and skin to `bone`."""
    if not path: print('SKIP', pid, '(no mesh generated yet)'); return None
    before = set(sc.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in sc.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    for o in sc.objects: o.select_set(False)
    for o in meshes: o.parent = None
    for o in new:
        if o.type != 'MESH': bpy.data.objects.remove(o, do_unlink=True)
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(meshes) > 1: bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = 'part_' + pid; ob.data.name = 'part_' + pid
    ob.rotation_mode = 'XYZ'   # glTF imports use quaternions; euler writes are ignored otherwise
    ob.rotation_euler = (0, 0, math.radians(yaw)); bpy.ops.object.transform_apply(rotation=True)
    def bb():
        ws = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        return Vector([min(w[i] for w in ws) for i in range(3)]), Vector([max(w[i] for w in ws) for i in range(3)])
    lo, hi = bb(); dims = hi - lo
    k = (width / dims.x) if width else (height / dims.z) if height else (depth / dims.y)
    ob.scale = (k, k, k); bpy.ops.object.transform_apply(scale=True)
    lo, hi = bb()
    c = (lo + hi) / 2
    ref = Vector((c.x, c.y, c.z)) if anchor == 'center' else Vector((c.x, c.y, lo.z)) if anchor == 'bottom' else Vector((c.x, hi.y, c.z))
    ob.location = Vector(center) - ref; bpy.ops.object.transform_apply(location=True)
    n_ = len(ob.data.polygons)
    if n_ > 4000:
        dm = ob.modifiers.new('d', 'DECIMATE'); dm.ratio = 3500 / n_; bpy.ops.object.modifier_apply(modifier=dm.name)
    for g in list(ob.vertex_groups): ob.vertex_groups.remove(g)
    ob.vertex_groups.new(name=bone).add(list(range(len(ob.data.vertices))), 1.0, 'REPLACE')
    if rgb is not None:
        ob.data.materials.clear(); ob.data.materials.append(mat('m_' + pid, rgb))
    for p in ob.data.polygons: p.use_smooth = True
    return ob

G = ROOT + '/assets/gen/gear/'; L = ROOT + '/assets/gen/polyfork/gear/'
def gen(n):
    d = G + n + '_3d/'; fs = sorted(f for f in os.listdir(d) if f.endswith('.glb')) if os.path.isdir(d) else []
    return d + fs[0] if fs else None
YAW_GEN = float(os.environ.get('YAW_GEN', 180))     # TRELLIS meshes face -Y in Blender; the rig faces +Y
YAW_LIB = float(os.environ.get('YAW_LIB', 0))
parts = [
    shell('jacket', {n for n in ALLB if n.endswith(('Spine', 'Spine1', 'Spine2', 'Shoulder', 'Arm', 'ForeArm')) or n == 'Hips'}, (0.90, 1.50), 0.030, (0.30, 0.34, 0.22), xr=(0.0, WR + 0.02),
          cuts=[((0, 0, 0.96), (0, 0, 1)), ((0, 0, 1.47), (0, 0, -1)), ((WR - 0.01, 0, 0), (-1, 0, 0)), ((-(WR - 0.01), 0, 0), (1, 0, 0))]),
    shell('vest', {'Spine', 'Spine1', 'Spine2'}, (1.02, 1.46), 0.050, (0.16, 0.18, 0.2), xr=(0.0, 0.18), cuts=[((0, 0, 1.06), (0, 0, 1)), ((0, 0, 1.43), (0, 0, -1))]),
    shell('pants', {'Hips', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg'}, (0.27, 1.04), 0.024, (0.42, 0.35, 0.24), xr=(0.0, 0.4), cuts=[((0, 0, 0.99), (0, 0, -1)), ((0, 0, 0.27), (0, 0, 1))]),
    shell('boots', {'LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase', 'LeftLeg', 'RightLeg'}, (0.0, 0.28), 0.020, (0.28, 0.2, 0.14), xr=(0.0, 0.4), cuts=[((0, 0, 0.28), (0, 0, -1))]),
    shell('gloves', HANDB, (0.0, 3.0), 0.012, (0.13, 0.13, 0.13), xr=(WR - 0.005, 2.0)),
    fit('cap', gen('cap'), 'Head', width=HW * 1.2, center=(0, HCY + 0.012, HTOP - 0.04), yaw=float(os.environ.get('YAW_CAP', 180)), anchor='center'),
    fit('helmet_steel', L + 'steel-helmet-f5aa7d.glb', 'Head', width=HW * 1.12, center=(0, HCY, EYEZ + 0.0), yaw=YAW_LIB, anchor='bottom'),
    fit('gasmask', gen('gasmask'), 'Head', width=HW * 0.95, center=(0, FY - 0.02, EYEZ - 0.05), yaw=YAW_GEN, anchor='center'),
    fit('glasses', gen('glasses'), 'Head', width=0.158, center=(0, FY + 0.006, EYEZ - 0.014), yaw=float(os.environ.get('YAW_GL', 180)), anchor='front'),
    fit('goggles', gen('goggles'), 'Head', width=0.2, center=(0, FY + 0.0, EYEZ - 0.012), yaw=YAW_GEN, anchor='front'),
    fit('backpack_hiking', L + 'adventurer-s-backpack-b1365c.glb', 'Spine2', height=0.62, center=(0, TY0 + 0.01, 1.22), yaw=YAW_LIB, anchor='front'),
    fit('backpack_school', L + 'pupil-backpack-d9b5fb.glb', 'Spine2', height=0.46, center=(0, TY0 + 0.01, 1.22), yaw=YAW_LIB, anchor='front'),
    fit('backpack_kit', L + 'kit-bag-7d617f.glb', 'Spine2', width=0.42, center=(0, TY0 + 0.01, 1.2), yaw=YAW_LIB, anchor='front'),
    fit('satchel', L + 'leather-belt-satchel-5bb107.glb', 'Hips', width=0.17, center=(0.2, 0.0, 0.93), yaw=YAW_LIB, anchor='center'),
]
parts = [p for p in parts if p]
for o in sc.objects: o.select_set(False)
for ob in parts:
    ob.parent = arm
    ob.modifiers.new('Armature', 'ARMATURE').object = arm
    ob.select_set(True)
body.select_set(False); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=a[1], export_format='GLB', use_selection=True, export_animations=False, export_skins=True,
                          export_apply=False, export_image_format='JPEG', export_jpeg_quality=88)
print('GEAR_BUILT', [(o.name, len(o.data.polygons)) for o in parts])
