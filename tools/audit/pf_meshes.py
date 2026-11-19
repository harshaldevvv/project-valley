# blender --background --python pf_meshes.py -- <glb>...   prints mesh part names, triangle counts and z range of Polyfork characters
import bpy, sys
from mathutils import Vector
for f in sys.argv[sys.argv.index('--') + 1:]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=f)
    out = []
    for o in bpy.context.scene.objects:
        if o.type == 'MESH':
            bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
            out.append(f"{o.name}:{len(o.data.polygons)}[{min(v.z for v in bb):.2f}-{max(v.z for v in bb):.2f}]")
    print('PFMESH', f.split('/')[-1], ' '.join(out))
