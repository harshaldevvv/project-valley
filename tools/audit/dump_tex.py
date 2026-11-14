import bpy, sys
a = sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a[0])
for im in bpy.data.images:
    print('IMG', im.name, im.size[:])
    im.filepath_raw = a[1]; im.file_format='PNG'; im.save(); break
