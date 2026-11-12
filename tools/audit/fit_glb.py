# blender --background --python fit_glb.py -- <in.glb> <out.glb> <target_height_m> <max_tris> [tex_px]
# Cleans an AI-generated GLB for the game: joins meshes, decimates, puts the origin at the base centre,
# scales to a real-world height, shrinks the textures and exports JPEG-textured GLB (+Y up).
import bpy, sys, math
a = sys.argv[sys.argv.index('--') + 1:]
src, dst, height, tris = a[0], a[1], float(a[2]), int(a[3]); px = int(a[4]) if len(a) > 4 else 512
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in bpy.context.scene.objects: o.select_set(o.type == 'MESH')
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
o = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
n = sum(len(p.vertices) - 2 for p in o.data.polygons)
if n > tris:
    m = o.modifiers.new('d', 'DECIMATE'); m.ratio = tris / n
    bpy.ops.object.modifier_apply(modifier=m.name)
# glTF import: Blender Z is up. Fit: height along Z, base centre at origin.
bb = [o.matrix_world @ __import__('mathutils').Vector(c) for c in o.bound_box]
zs = [v.z for v in bb]; xs = [v.x for v in bb]; ys = [v.y for v in bb]
s = height / (max(zs) - min(zs))
o.scale = (s, s, s); bpy.ops.object.transform_apply(scale=True)
bb = [o.matrix_world @ __import__('mathutils').Vector(c) for c in o.bound_box]
cx = (min(v.x for v in bb) + max(v.x for v in bb)) / 2; cy = (min(v.y for v in bb) + max(v.y for v in bb)) / 2
o.location = (-cx, -cy, -min(v.z for v in bb)); bpy.ops.object.transform_apply(location=True)
for img in bpy.data.images:
    if img.size[0] > px: img.scale(px, px)
for mat in bpy.data.materials:
    mat.use_backface_culling = False
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85, export_apply=True)
d = o.dimensions
print('FIT', dst, 'tris', sum(len(p.vertices) - 2 for p in o.data.polygons), 'dims', round(d.x, 2), round(d.y, 2), round(d.z, 2))
