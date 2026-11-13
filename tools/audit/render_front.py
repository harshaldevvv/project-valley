# blender --background --python render_front.py -- <char.glb> <out.png> [view: front|side]
# Flat (unlit) orthographic render of the character's LOD0 with its baked texture: the input to the face repaint.
import bpy, sys, math
a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
meshes = [o for o in sc.objects if o.type == 'MESH']
lod0 = next(o for o in meshes if 'LOD0' in o.name and 'BACKPACK' not in o.name)
for o in meshes:
    o.hide_render = o is not lod0 and 'BACKPACK' not in o.name
    if 'LOD1' in o.name or 'LOD2' in o.name or '_COL_' in o.name: o.hide_render = True
dims = lod0.dimensions
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = dims.z * 1.15
cam.location = (0, 6, dims.z / 2); cam.rotation_euler = (math.radians(90), 0, math.radians(180))
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'FLAT'; sc.display.shading.color_type = 'TEXTURE'
sc.render.resolution_x = 768; sc.render.resolution_y = 1024
sc.render.film_transparent = False
sc.world = bpy.data.worlds.new('w'); sc.world.color = (1, 1, 1)
sc.view_settings.view_transform = 'Standard'
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('RENDERED', out, 'dims', [round(d, 2) for d in dims])
