# blender --background --python build_hero.py -- <hero.glb (Hunyuan output)> <out_dir> [tris]
# Fits the generated hero to the game: 1.80 m tall, feet on z = 0, facing +Y (this game's rig contract), decimated to
# `tris`, then builds a Mixamo-named armature at landmarks measured from the front reference image (A-pose, arms hanging),
# skins it with automatic weights and exports <out_dir>/hero_rigged.glb (mesh `chr_hero_a_LOD0` + armature `chr_hero_a_rig`,
# no clips yet) and a bone-overlay turntable for checking the joint placement.
import bpy, sys, math, os
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]
tris = int(a[2]) if len(a) > 2 else 9000
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in scene.objects if o.type == 'MESH']
for o in scene.objects: o.select_set(o.type == 'MESH')
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = 'chr_hero_a_LOD0'; body.data.name = 'chr_hero_a_LOD0'
body.parent = None
for o in list(scene.objects):
    if o is not body: bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def bbox(o):
    ws = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return Vector([min(v[i] for v in ws) for i in range(3)]), Vector([max(v[i] for v in ws) for i in range(3)])

# face +Y: the generated mesh faces -Y in Blender space
body.rotation_mode = 'XYZ'; body.rotation_euler = (0, 0, math.pi)
bpy.ops.object.transform_apply(rotation=True)
lo, hi = bbox(body)
s = 1.80 / (hi.z - lo.z)
body.scale = (s, s, s); bpy.ops.object.transform_apply(scale=True)
lo, hi = bbox(body)
# centre: x on the bbox centre, y on the middle of the torso depth (slice 1.0-1.4 m), feet on the floor
torso = [v.co for v in body.data.vertices if 1.0 < v.co.z - lo.z < 1.4]
cy = (min(v.y for v in torso) + max(v.y for v in torso)) / 2
body.location = (-(lo.x + hi.x) / 2, -cy, -lo.z); bpy.ops.object.transform_apply(location=True)
n = sum(len(p.vertices) - 2 for p in body.data.polygons)
if n > tris:
    m = body.modifiers.new('d', 'DECIMATE'); m.ratio = tris / n; bpy.ops.object.modifier_apply(modifier=m.name)

# ---- armature: joints in metres (right side +X), T-pose; arm and leg joints measured from the fitted mesh itself
vs = [v.co.copy() for v in body.data.vertices]
xmax = max(v.x for v in vs)                                                    # fingertip
arm_pts = [v for v in vs if v.x > 0.45]
armz = sorted(v.z for v in arm_pts)[len(arm_pts) // 2]                         # arm axis height
ank = [v.x for v in vs if 0.04 < v.z < 0.2 and v.x > 0.03]
ankx = sorted(ank)[len(ank) // 2]
print('MEASURED xmax', round(xmax, 3), 'armz', round(armz, 3), 'ankle x', round(ankx, 3))
S = 1.0
SH_X = 0.17
U = xmax - SH_X
elbow, wrist = SH_X + U * 0.42, SH_X + U * 0.74
kneex = (0.085 + ankx) / 2
J = {  # name: (head, tail, parent)
    'Hips': ((0, 0, 0.90), (0, 0, 1.00), None),
    'Spine': ((0, 0, 1.00), (0, 0, 1.12), 'Hips'),
    'Spine1': ((0, 0, 1.12), (0, 0, 1.26), 'Spine'),
    'Spine2': ((0, 0, 1.26), (0, 0, 1.42), 'Spine1'),
    'Neck': ((0, 0, 1.46), (0, 0, 1.56), 'Spine2'),
    'Head': ((0, 0, 1.56), (0, 0, 1.80), 'Neck'),
}
for side, sx in (('Right', 1), ('Left', -1)):
    J[f'{side}Shoulder'] = ((sx * 0.03, 0, armz + 0.02), (sx * SH_X, 0, armz), 'Spine2')
    J[f'{side}Arm'] = ((sx * SH_X, 0, armz), (sx * elbow, 0, armz), f'{side}Shoulder')
    J[f'{side}ForeArm'] = ((sx * elbow, 0, armz), (sx * wrist, 0, armz), f'{side}Arm')
    J[f'{side}Hand'] = ((sx * wrist, 0, armz), (sx * xmax, 0, armz), f'{side}ForeArm')
    J[f'{side}UpLeg'] = ((sx * 0.085, 0, 0.90), (sx * kneex, 0, 0.50), 'Hips')
    J[f'{side}Leg'] = ((sx * kneex, 0, 0.50), (sx * ankx, 0, 0.11), f'{side}UpLeg')
    J[f'{side}Foot'] = ((sx * ankx, 0, 0.11), (sx * ankx, 0.12, 0.04), f'{side}Leg')
    J[f'{side}ToeBase'] = ((sx * ankx, 0.12, 0.04), (sx * ankx, 0.22, 0.02), f'{side}Foot')
arm_data = bpy.data.armatures.new('chr_hero_a_rig')
arm = bpy.data.objects.new('chr_hero_a_rig', arm_data)
scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
for name, (h, t, p) in J.items():
    b = arm_data.edit_bones.new(name)
    b.head, b.tail = Vector(h) * S, Vector(t) * S
    if p: b.parent = arm_data.edit_bones[p]; b.use_connect = (Vector(h) - Vector(J[p][1])).length < 1e-4
bpy.ops.object.mode_set(mode='OBJECT')
for o in scene.objects: o.select_set(False)
body.select_set(True); arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_NAME')  # parent + empty vertex groups, weights computed below
body.name = 'chr_hero_a_LOD0'
import mathutils
BONES = {n: (Vector(h), Vector(t)) for n, (h, t, p) in J.items()}
LEFT = {n for n in J if n.startswith('Left')}; RIGHT = {n for n in J if n.startswith('Right')}
def seg_dist(p, h, t):
    d = t - h; L = d.length_squared
    u = max(0.0, min(1.0, (p - h).dot(d) / L)) if L > 0 else 0
    return (p - (h + d * u)).length
for n in J:
    if n not in body.vertex_groups: body.vertex_groups.new(name=n)
SIG = {'Hips': 0.085, 'Spine': 0.07, 'Spine1': 0.07, 'Spine2': 0.09, 'Neck': 0.05, 'Head': 0.09}
def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
raw = []
for v in body.data.vertices:
    p = v.co
    ws = {}
    for n, (h, t) in BONES.items():
        if n in LEFT and p.x > 0.06: continue   # a vertex well inside the other half never follows that side's bones
        if n in RIGHT and p.x < -0.06: continue
        d = seg_dist(p, h, t)
        sig = SIG.get(n, 0.06 if 'Hand' not in n else 0.045)
        w = math.exp(-(d / sig) ** 2)
        if n.endswith(('Arm', 'ForeArm', 'Hand')):
            w *= smoothstep(0.10, 0.19, abs(p.x))        # the torso never follows an arm (T-pose: arms are clear of it)
        if n.endswith('UpLeg') and p.z > 0.97: w *= smoothstep(1.06, 0.97, p.z)
        if w > 0.02: ws[n] = w
    if not ws:
        n = min(BONES, key=lambda k: seg_dist(p, *BONES[k])); ws[n] = 1.0
    wmax = max(ws.values())
    raw.append({n: w for n, w in ws.items() if w >= 0.3 * wmax})   # only near-ties blend
# smooth across the mesh so joints get gradual transitions (3 passes of neighbour averaging)
nbr = [[] for _ in body.data.vertices]
for e in body.data.edges:
    i, j = e.vertices; nbr[i].append(j); nbr[j].append(i)
for _ in range(3):
    nxt = []
    for i, w in enumerate(raw):
        acc = {n: x * 0.5 for n, x in w.items()}
        if nbr[i]:
            k = 0.5 / len(nbr[i])
            for j in nbr[i]:
                for n, x in raw[j].items(): acc[n] = acc.get(n, 0.0) + x * k
        nxt.append(acc)
    raw = nxt
for v, ws in zip(body.data.vertices, raw):
    top = sorted(ws.items(), key=lambda kv: -kv[1])[:4]
    tot = sum(w for _, w in top)
    for n, w in top: body.vertex_groups[n].add([v.index], w / tot, 'REPLACE')
groups = {g.name: 0 for g in body.vertex_groups}
for v in body.data.vertices:
    for g in v.groups:
        if g.weight > 0.01: groups[body.vertex_groups[g.group].name] += 1
print('WEIGHTS', {k: v for k, v in groups.items() if v < 40})
unw = sum(1 for v in body.data.vertices if not any(g.weight > 0.01 for g in v.groups))
print('UNWEIGHTED_VERTS', unw, 'of', len(body.data.vertices))
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); arm.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(out, 'hero_rigged.glb'), export_format='GLB', use_selection=True, export_animations=False,
                          export_skins=True, export_apply=False, export_image_format='JPEG', export_jpeg_quality=90)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, 'hero_rigged.blend'))
print('HERO_BUILT tris', sum(len(p.vertices) - 2 for p in body.data.polygons), 'height', round(bbox(body)[1].z - bbox(body)[0].z, 2))
