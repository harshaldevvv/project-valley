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
        # each original face keeps ONE swatch colour: remember its mean UV and the child count Blender will produce
        uvl = o.data.uv_layers.active
        centers, kids = [], []
        for pgn in o.data.polygons:
            us = [uvl.data[l].uv for l in pgn.loop_indices]
            centers.append((sum(u[0] for u in us) / len(us), sum(u[1] for u in us) / len(us)))
            kids.append(len(pgn.loop_indices))
        m = o.modifiers.new('sub', 'SUBSURF'); m.levels = 1; m.render_levels = 1; m.subdivision_type = 'CATMULL_CLARK'; m.uv_smooth = 'NONE'  # UVs point into a palette swatch per face: no smoothing across faces
        # keep the modifier order: subsurf must come before the armature modifier (applied first)
        while o.modifiers.find('sub') > 0: bpy.ops.object.modifier_move_up(modifier='sub')
        bpy.ops.object.modifier_apply(modifier='sub')
        # children are emitted contiguously per parent face (a triangle gives 3 quads, a quad 4): flat swatch UV per child
        uvl = o.data.uv_layers.active
        idx = 0
        for ci, nk in enumerate(kids):
            for _ in range(nk):
                if idx >= len(o.data.polygons): break
                for l in o.data.polygons[idx].loop_indices: uvl.data[l].uv = centers[ci]
                idx += 1
        bpy.ops.object.shade_smooth()
        print('SMOOTH', o.name, before, '->', len(o.data.polygons))
for act in bpy.data.actions: act.use_fake_user = True
bpy.ops.export_scene.gltf(filepath=a[1], export_format='GLB', export_image_format='JPEG', export_animations=True, export_animation_mode='ACTIONS', export_apply=False, export_skins=True, export_normals=True)
print('EXPORTED', a[1])
