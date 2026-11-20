# blender --background --python build_pf_parts.py -- <out.glb> <chars_dir> <spec.json>
# Wearable parts library for the Polyfork hero (chr_hero_pf): every Polyfork character shares one base body and skeleton, so a
# part (hat, coat, gloves, backpack...) taken from any of them fits the hero. Each listed part is turned 180 deg about Z and
# baked like retarget_pf_hero.py does for the hero, re-pointed to one shared armature and exported as a skinned mesh named
# pfpart_<id> (no animation). spec.json: [{"id": "hat_infantry", "char": "infantry-rifleman-c1c0a5", "mesh": "attach-hat-mesh"}, ...]
import bpy, sys, json, math
from mathutils import Matrix

a = sys.argv[sys.argv.index('--') + 1:]
out, chars_dir, spec_path = a[0], a[1], a[2]
spec = json.load(open(spec_path, encoding='utf-8'))
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
Rz = Matrix.Rotation(math.pi, 4, 'Z')
shared = None
made = []

def bake(objs, arm):
    for o in objs:
        if o.parent and o.parent != arm:
            mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    bpy.context.view_layer.update()
    for o in scene.objects: o.select_set(False)
    for o in objs:
        if o.parent is None: o.matrix_world = Rz @ o.matrix_world
        o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.context.view_layer.update()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

by_char = {}
for p in spec: by_char.setdefault(p['char'], []).append(p)
for char, parts in by_char.items():
    keep = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=f"{chars_dir}/{char}.glb")
    new = [o for o in scene.objects if o not in keep]
    for x in list(bpy.data.actions): bpy.data.actions.remove(x)
    arm = next(o for o in new if o.type == 'ARMATURE')
    wanted = {}
    for p in parts:
        m = next((o for o in new if o.type == 'MESH' and o.name.startswith(p['mesh'])), None)
        if m is None: print('MISSING', char, p['mesh']); continue
        wanted[m] = p['id']
    bake([arm] + list(wanted), arm)
    if shared is None:
        shared = arm; shared.name = 'pfparts_rig'
    for m, pid in wanted.items():
        for mod in m.modifiers:
            if mod.type == 'ARMATURE': mod.object = shared
        m.parent = shared
        m.name = 'pfpart_' + pid; m.data.name = 'pfpart_' + pid
        made.append((pid, len(m.data.polygons)))
    for o in new:
        if o not in wanted and o != shared: bpy.data.objects.remove(o, do_unlink=True)
for o in list(scene.objects):
    if o.type == 'EMPTY' and not o.children: bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=False, export_skins=True, export_apply=False,
                          export_vertex_color='ACTIVE')
print('PF_PARTS', len(made), ' '.join(f'{p}:{n}' for p, n in made))
