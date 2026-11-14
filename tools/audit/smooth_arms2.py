# blender --background --python smooth_arms2.py -- <arms.glb (decoded)> <palette.png> <out.glb>
# Smooth first-person arms without UVs: bake each face corner's palette colour into a colour attribute (skin swatches
# turned into a natural tone), subdivide once (colours interpolate smoothly, no checker), drop the UVs, export with vertex
# colours. Rig, sockets and clips are untouched.
import bpy, sys, math
a = sys.argv[sys.argv.index('--') + 1:]
src, atlas, dst = a
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
img = bpy.data.images.load(atlas)
W, H = img.size
px = list(img.pixels)
def sample(u, v):
    x = min(W - 1, max(0, int(u * W))); y = min(H - 1, max(0, int(v * H)))
    i = (y * W + x) * 4
    return px[i], px[i + 1], px[i + 2]
def natural(c):
    r, g, b = c
    skin = r - b > 0.12 and r - g > 0.03  # strongly orange-red pixels are the skin swatches
    if skin:
        l = 0.2126 * r + 0.7152 * g + 0.0722 * b
        k = l * 1.5 + 0.35
        return (0.36 * 0.6 * k + 0.1, 0.2 * 0.6 * k + 0.07, 0.14 * 0.6 * k + 0.05)
    return c
for o in list(bpy.context.scene.objects):
    if o.type != 'MESH' or 'LOD0' not in o.name: continue
    me = o.data
    uvl = me.uv_layers.active
    col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    for loop in me.loops:
        u, v = uvl.data[loop.index].uv
        r, g, b = natural(sample(u, v))
        col.data[loop.index].color = (r, g, b, 1.0)
    me.color_attributes.active_color = col
    me.color_attributes.render_color_index = me.color_attributes.find('Col')
    for x in bpy.context.scene.objects: x.select_set(False)
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    before = len(me.polygons)
    m = o.modifiers.new('sub', 'SUBSURF'); m.levels = 1; m.render_levels = 1
    while o.modifiers.find('sub') > 0: bpy.ops.object.modifier_move_up(modifier='sub')
    bpy.ops.object.modifier_apply(modifier='sub')
    while me.uv_layers: me.uv_layers.remove(me.uv_layers[0])
    bpy.ops.object.shade_smooth()
    print('SMOOTH2', o.name, before, '->', len(me.polygons))
for act in bpy.data.actions: act.use_fake_user = True
for mat in bpy.data.materials: mat.use_backface_culling = True
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_animations=True, export_animation_mode='ACTIONS', export_apply=False, export_skins=True, export_vertex_color='ACTIVE', export_normals=True)
print('EXPORTED2', dst)
