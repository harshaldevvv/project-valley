# blender --background --python smooth_arms.py -- <arms.glb (decoded)> <out.glb>
# Smooths the blocky first-person arms: one subdivision level on the skinned LOD0 mesh (weights interpolate), smooth
# shading with a crease angle. Rig, sockets and clips are left untouched.
import bpy, sys, math
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a[0])
sc = bpy.context.scene
for o in list(sc.objects):
    if o.type == 'MESH' and 'LOD0' in o.name:
        for x in sc.objects: x.select_set(False)
        bpy.context.view_layer.objects.active = o; o.select_set(True)
        before = len(o.data.polygons)
        m = o.modifiers.new('sub', 'SUBSURF'); m.levels = 1; m.render_levels = 1; m.subdivision_type = 'CATMULL_CLARK'; m.uv_smooth = 'NONE'  # UVs point into a palette swatch per face: no smoothing across faces
        # keep the modifier order: subsurf must come before the armature modifier (applied first)
        while o.modifiers.find('sub') > 0: bpy.ops.object.modifier_move_up(modifier='sub')
        bpy.ops.object.modifier_apply(modifier='sub')
        bpy.ops.object.shade_smooth()
        print('SMOOTH', o.name, before, '->', len(o.data.polygons))
for act in bpy.data.actions: act.use_fake_user = True
bpy.ops.export_scene.gltf(filepath=a[1], export_format='GLB', export_image_format='JPEG', export_animations=True, export_animation_mode='ACTIONS', export_apply=False, export_skins=True, export_normals=True)
print('EXPORTED', a[1])
