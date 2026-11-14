# blender --background --python pose_test.py -- <rigged.blend> <out_prefix>
# Skinning check: renders the rig at rest and in five hard poses (arms forward, arms out, arms up, deep squat, spine bend + twist)
# from a front-left three-quarter camera. Look for stretched triangles, collapsed shoulders, torn knees or a pinched waist.
import bpy, sys, math
from mathutils import Matrix, Vector
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=a[0])
prefix = a[1]
sc = bpy.context.scene
arm = next(o for o in sc.objects if o.type == 'ARMATURE')
body = next(o for o in sc.objects if o.type == 'MESH')
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 2.9
sc.render.engine = 'BLENDER_WORKBENCH'
sh = sc.display.shading; sh.light = 'FLAT'; sh.color_type = 'TEXTURE'; sc.view_settings.view_transform = 'Standard'
sc.render.resolution_x = 520; sc.render.resolution_y = 640
sc.world = bpy.data.worlds.new('w'); sc.world.color = (0.8, 0.82, 0.85)
cam.location = (2.6, -3.6, 1.1); cam.rotation_euler = (Vector((0, 0, 0.95)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
arm.show_in_front = True
def rot(name, axis, deg):
    pb = arm.pose.bones[name]
    M = pb.matrix.copy(); head = M.translation.copy()
    R = Matrix.Translation(head) @ Matrix.Rotation(math.radians(deg), 4, axis) @ Matrix.Translation(-head)
    pb.matrix = R @ M
    bpy.context.view_layer.update()
def reset():
    for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
    bpy.context.view_layer.update()
POSES = {
    'rest': [],
    'armsfwd': [('RightArm', 'X', 90), ('LeftArm', 'X', 90)],
    'armsout': [('RightArm', 'Y', -85), ('LeftArm', 'Y', 85)],
    'armsup': [('RightArm', 'X', 170), ('LeftArm', 'X', 170)],
    'squat': [('Hips', 'X', 0), ('RightUpLeg', 'X', 95), ('LeftUpLeg', 'X', 95), ('RightLeg', 'X', -110), ('LeftLeg', 'X', -110)],
    'bend': [('Spine', 'X', 25), ('Spine1', 'X', 25), ('Spine2', 'Z', 35), ('Head', 'Z', 30), ('RightArm', 'X', 60), ('RightForeArm', 'X', 90)],
}
for n, steps in POSES.items():
    reset()
    for b, ax, d in steps:
        if d: rot(b, ax, d)
    sc.render.filepath = f'{prefix}_{n}.png'
    bpy.ops.render.render(write_still=True)
print('POSES_DONE')
