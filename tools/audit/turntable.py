# blender --background --python turntable.py -- <model.glb> <out_prefix> [wire]
# Orthographic flat-texture renders from front, side, back, three-quarter, plus a wireframe pass when asked.
import bpy, sys, math
a = sys.argv[sys.argv.index('--') + 1:]
src, prefix = a[0], a[1]
wire = len(a) > 2 and a[2] == 'wire'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
meshes = [o for o in sc.objects if o.type == 'MESH' and not o.name.startswith('Icosphere')]
from mathutils import Vector
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))); hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
ctr = (lo + hi) / 2; size = max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = size * 1.12
sc.render.engine = 'BLENDER_WORKBENCH'
sh = sc.display.shading; sh.light = 'FLAT'; sh.color_type = 'TEXTURE'; sc.view_settings.view_transform = 'Standard'
sc.render.resolution_x = 700; sc.render.resolution_y = 900
sc.world = bpy.data.worlds.new('w'); sc.world.color = (0.8, 0.82, 0.85)
if wire:
    sh.light = 'STUDIO'; sh.color_type = 'SINGLE'; sh.single_color = (0.75, 0.75, 0.78); sc.display.shading.show_wire = True if hasattr(sc.display.shading, 'show_wire') else None
    for o in meshes:
        m = o.modifiers.new('w', 'WIREFRAME'); m.thickness = 0.002
views = {'front': (0, -1), 'side': (1, 0), 'back': (0, 1), 'q': (0.7, -0.7)}
for n, (x, y) in views.items():
    d = size * 3
    cam.location = (ctr.x + x * d, ctr.y + y * d, ctr.z)
    direction = ctr - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = f'{prefix}_{n}.png'
    bpy.ops.render.render(write_still=True)
print('TURNTABLE', [round(v, 2) for v in (hi - lo)], 'tris', sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons))
