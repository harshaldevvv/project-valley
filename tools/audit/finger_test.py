# blender --background --python finger_test.py -- <rigged.blend> <out_prefix>
# Curls the right hand's fingers/thumb to several amounts and renders close-ups of the hand (view from the front, then from below).
import bpy, sys, math, os
SIDE = os.environ.get('SIDE', 'Right'); SG = 1 if SIDE == 'Right' else -1
from mathutils import Matrix, Vector
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=a[0]); prefix = a[1]
sc = bpy.context.scene
arm = next(o for o in sc.objects if o.type == 'ARMATURE')
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 0.32
sc.render.engine = 'BLENDER_WORKBENCH'
sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'; sc.view_settings.view_transform = 'Standard'
sc.render.resolution_x = 700; sc.render.resolution_y = 500
sc.world = bpy.data.worlds.new('w'); sc.world.color = (0.85, 0.87, 0.9)
def rot(name, axis, deg):
    pb = arm.pose.bones[name]; M = pb.matrix.copy(); head = M.translation.copy()
    pb.matrix = Matrix.Translation(head) @ Matrix.Rotation(math.radians(deg), 4, axis) @ Matrix.Translation(-head) @ M
    bpy.context.view_layer.update()
def reset():
    for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
    bpy.context.view_layer.update()
def view(loc, tgt):
    cam.location = loc; cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
for name, amt in (('open', 0), ('half', 1), ('fist', 2)):
    reset()
    for f in ('Index', 'Middle', 'Ring', 'Pinky'):
        for k, d in enumerate((50, 70, 50)):                       # proximal, middle, distal flexion
            rot(f'{SIDE}Hand{f}{k+1}', 'Y', SG * d * amt / 2)           # sign checked by eye in the render
    for k, d in enumerate((20, 30, 30)): rot(f'{SIDE}HandThumb{k+1}', 'Z', -SG * d * amt / 2)
    for vn, loc in (('front', (SG * 0.76, 1.5, 1.39)), ('below', (SG * 0.76, -0.045, 0.5))):
        view(loc, (SG * 0.76, -0.045, 1.39))
        sc.render.filepath = f'{prefix}_{name}_{vn}.png'; bpy.ops.render.render(write_still=True)
print('FINGERS_DONE')
