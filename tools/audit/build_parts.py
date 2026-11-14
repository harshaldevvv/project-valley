# blender --background --python build_parts.py -- <hero_rigged.blend> <out.glb>
# Builds the wearable parts for the hero rig and exports them with the same armature (no clips) to one GLB:
#   shell parts (jacket, vest, pants, boots, gloves): faces of the hero body that sit on those bones, pushed out along the normal,
#     so they inherit the body's skin weights and follow every animation;
#   rigid parts (cap, helmet, glasses, backpack, pouch): small procedural meshes skinned 100% to one bone.
# Mesh names are `part_<id>`; the runtime (src/gameplay/outfit) rebinds them onto the live character's skeleton.
import bpy, bmesh, sys, math
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=a[0])
sc = bpy.context.scene
arm = next(o for o in sc.objects if o.type == 'ARMATURE')
body = next(o for o in sc.objects if o.type == 'MESH')
vg = {g.index: g.name for g in body.vertex_groups}
def dom(v):
    w = {}
    for g in v.groups: w[vg[g.group]] = w.get(vg[g.group], 0) + g.weight
    return w
BONES_OF = {}
for v in body.data.vertices: BONES_OF[v.index] = dom(v)
hv = [v.co for v in body.data.vertices if v.co.z > 1.55]
hx = max(abs(c.x) for c in hv); hy0 = min(c.y for c in hv); hy1 = max(c.y for c in hv)
print('HEAD x', round(hx, 3), 'y', round(hy0, 3), round(hy1, 3), 'top', round(max(c.z for c in hv), 3))

def mat(name, rgb, rough=0.8, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    return m

def shell(pid, bones, zr, push, rgb, xmax=9, minw=0.55):
    me = body.data.copy(); ob = body.copy(); ob.data = me; ob.name = 'part_' + pid; sc.collection.objects.link(ob)
    keep = set()
    for v in body.data.vertices:
        w = BONES_OF[v.index]; tot = sum(w.values()) or 1
        s = sum(x for n, x in w.items() if n in bones) / tot
        if 'Hips' in bones and 'Hips' not in ('x',) and False: pass
        if s >= minw and zr[0] <= v.co.z <= zr[1] and abs(v.co.x) <= xmax: keep.add(v.index)
    bm = bmesh.new(); bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    drop = [f for f in bm.faces if sum(v.index in keep for v in f.verts) < 2]
    bmesh.ops.delete(bm, geom=drop, context='FACES')
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)   # weld UV-seam duplicates so the push does not open cracks
    bm.normal_update(); bm.verts.ensure_lookup_table()
    for v in bm.verts: v.co += v.normal * push
    bm.to_mesh(me); bm.free()
    me.materials.clear(); me.materials.append(mat('m_' + pid, rgb))
    for p in me.polygons: p.use_smooth = True
    return ob

def rigid(pid, bone, build, rgb, rough=0.7, metal=0.0, bevel=0.0):
    me = bpy.data.meshes.new('part_' + pid); bm = bmesh.new(); build(bm)
    if bevel: bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affine='LINEAR' if False else 'LINEAR') if False else bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect='EDGES')
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new('part_' + pid, me); sc.collection.objects.link(ob)
    me.materials.append(mat('m_' + pid, rgb, rough, metal))
    g = ob.vertex_groups.new(name=bone)
    g.add(list(range(len(me.vertices))), 1.0, 'REPLACE')
    return ob

def sph(bm, c, r, sx=1, sy=1, sz=1, seg=14, ring=10, cut=None):
    r_ = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=ring, radius=1.0)
    for v in r_['verts']:
        v.co = Vector((c[0] + v.co.x * r * sx, c[1] + v.co.y * r * sy, c[2] + v.co.z * r * sz))
    if cut is not None:
        drop = [v for v in bm.verts if v.co.z < cut]
        bmesh.ops.delete(bm, geom=drop, context='VERTS')
def box(bm, c, s):
    r_ = bmesh.ops.create_cube(bm, size=1.0)
    for v in r_['verts']: v.co = Vector((c[0] + v.co.x * s[0], c[1] + v.co.y * s[1], c[2] + v.co.z * s[2]))
def tube(bm, c, r, h, axis='X', seg=12):
    r_ = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=h)
    for v in r_['verts']:
        p = v.co.copy()
        if axis == 'X': p = Vector((p.z, p.x, p.y))
        elif axis == 'Y': p = Vector((p.x, p.z, p.y))
        v.co = p + Vector(c)

HZ = 1.67
face = [v.co for v in body.data.vertices if abs(v.co.z - 1.645) < 0.012 and abs(v.co.x) < 0.05]
FY = max(c.y for c in face); print('FACE_FRONT_Y', round(FY, 3))
HY = (min(c.y for c in hv) + FY) / 2 - 0.01   # head centre y
parts = [
    shell('jacket', {'Spine', 'Spine1', 'Spine2', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'Hips'}, (0.90, 1.50), 0.024, (0.30, 0.34, 0.22)),
    shell('vest', {'Spine', 'Spine1', 'Spine2'}, (1.02, 1.46), 0.040, (0.16, 0.18, 0.2), xmax=0.19, minw=0.5),
    shell('pants', {'Hips', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg'}, (0.30, 1.04), 0.018, (0.42, 0.35, 0.24)),
    shell('boots', {'LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase', 'LeftLeg', 'RightLeg'}, (0.0, 0.26), 0.014, (0.28, 0.2, 0.14), minw=0.5),
    shell('gloves', {'LeftHand', 'RightHand'}, (0.0, 3.0), 0.010, (0.13, 0.13, 0.13)),
    rigid('cap', 'Head', lambda bm: sph(bm, (0, HY, HZ + 0.02), hx * 1.1, 1, 1.15, 0.85, cut=HZ + 0.06), (0.2, 0.24, 0.32)),
    rigid('helmet', 'Head', lambda bm: sph(bm, (0, HY, HZ + 0.015), hx * 1.22, 1, 1.22, 0.95, cut=HZ - 0.02), (0.25, 0.3, 0.2), 0.5, 0.2),
    rigid('glasses', 'Head', lambda bm: (tube(bm, (-0.036, FY + 0.004, 1.645), 0.026, 0.008, 'Y'), tube(bm, (0.036, FY + 0.004, 1.645), 0.026, 0.008, 'Y'), box(bm, (0, FY + 0.004, 1.65), (0.05, 0.008, 0.008)), box(bm, (-0.062, FY - 0.05, 1.65), (0.008, 0.11, 0.008)), box(bm, (0.062, FY - 0.05, 1.65), (0.008, 0.11, 0.008))), (0.04, 0.04, 0.05), 0.2, 0.3),
    rigid('backpack', 'Spine2', lambda bm: (box(bm, (0, -0.16, 1.26), (0.30, 0.15, 0.38)), box(bm, (0, -0.19, 1.14), (0.22, 0.12, 0.2)), box(bm, (-0.1, -0.02, 1.34), (0.035, 0.06, 0.04)), box(bm, (0.1, -0.02, 1.34), (0.035, 0.06, 0.04))), (0.24, 0.3, 0.2), 0.9, bevel=0.018),
    rigid('pouch', 'Hips', lambda bm: (box(bm, (0.17, 0.0, 0.97), (0.08, 0.1, 0.12)), box(bm, (-0.17, 0.0, 0.97), (0.08, 0.1, 0.12))), (0.3, 0.26, 0.2), 0.9, bevel=0.012),
]
for o in sc.objects: o.select_set(False)
for ob in parts:
    ob.parent = arm
    mod = ob.modifiers.new('Armature', 'ARMATURE'); mod.object = arm
    ob.select_set(True)
body.select_set(False); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=a[1], export_format='GLB', use_selection=True, export_animations=False, export_skins=True,
                          export_apply=False, export_image_format='JPEG')
print('PARTS_BUILT', [(o.name, len(o.data.polygons)) for o in parts])
