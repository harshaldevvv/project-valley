# blender --background --python bake_face.py -- <hero_rigged.blend> <front.png> <out_dir> [scale_px_per_m cx top_py]
# Orthographic front projection of the clean reference face/hair/neck onto the generated texture (the generated texture has
# blotchy eyes). Faces that look toward +Y above z=1.50 get texels sampled from front.png, blended out by normal angle.
import bpy, sys, os, math
import numpy as np
a = sys.argv[sys.argv.index('--')+1:]
blend, front, out = a[0], a[1], a[2]
S = float(a[3]) if len(a) > 3 else 712.0
CX = float(a[4]) if len(a) > 4 else 348.0
TOP = float(a[5]) if len(a) > 5 else 88.0
ZMIN = 1.50
bpy.ops.wm.open_mainfile(filepath=blend)
body = next(o for o in bpy.data.objects if o.type == 'MESH')
mesh = body.data
img = next(i for i in bpy.data.images if i.size[0] > 0 and i.name != 'Render Result')
W, H = img.size
tex = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)
fi = bpy.data.images.load(front)
fw, fh = fi.size
src = np.array(fi.pixels[:], dtype=np.float32).reshape(fh, fw, 4)   # row 0 = bottom
uv = mesh.uv_layers.active.data
mesh.calc_loop_triangles()
newtex = tex.copy()
done = np.zeros((H, W), dtype=np.float32)
def sample(p):
    px = CX - p.x * S
    py = TOP + (1.80 - p.z) * S          # rows from the top of the picture
    x = min(max(px, 0), fw - 1.001); y = min(max(fh - 1 - py, 0), fh - 1.001)
    x0, y0 = int(x), int(y); fx, fy = x - x0, y - y0
    c = (src[y0, x0] * (1-fx) * (1-fy) + src[y0, x0+1] * fx * (1-fy) + src[y0+1, x0] * (1-fx) * fy + src[y0+1, x0+1] * fx * fy)
    return c
n = 0
for t in mesh.loop_triangles:
    vs = [mesh.vertices[i].co for i in t.vertices]
    if min(v.z for v in vs) < ZMIN - 0.06: continue
    ny = t.normal.y
    if ny < 0.25: continue
    alpha_n = min(1.0, (ny - 0.25) / 0.35)
    uvs = [uv[l].uv for l in t.loops]
    pts = np.array([[u.x * W, u.y * H] for u in uvs])
    x0, x1 = int(max(pts[:,0].min()-1, 0)), int(min(pts[:,0].max()+1, W-1))
    y0, y1 = int(max(pts[:,1].min()-1, 0)), int(min(pts[:,1].max()+1, H-1))
    d = (pts[1,1]-pts[2,1])*(pts[0,0]-pts[2,0]) + (pts[2,0]-pts[1,0])*(pts[0,1]-pts[2,1])
    if abs(d) < 1e-9: continue
    for y in range(y0, y1+1):
        for x in range(x0, x1+1):
            px, py = x + 0.5, y + 0.5
            l0 = ((pts[1,1]-pts[2,1])*(px-pts[2,0]) + (pts[2,0]-pts[1,0])*(py-pts[2,1])) / d
            l1 = ((pts[2,1]-pts[0,1])*(px-pts[2,0]) + (pts[0,0]-pts[2,0])*(py-pts[2,1])) / d
            l2 = 1 - l0 - l1
            if l0 < -0.02 or l1 < -0.02 or l2 < -0.02: continue
            p = vs[0]*l0 + vs[1]*l1 + vs[2]*l2
            zf = min(1.0, max(0.0, (p.z - (ZMIN - 0.06)) / 0.06))
            al = alpha_n * zf
            if al <= done[y, x]: continue
            c = sample(p)
            if c[:3].min() > 0.45 and c[:3].max() - c[:3].min() < 0.06: continue   # reference background
            newtex[y, x, :3] = tex[y, x, :3] * (1-al) + c[:3] * al
            done[y, x] = al; n += 1
# red specks the generator left on hand tips: saturated bright red texels become skin tone
r, g, b = newtex[...,0], newtex[...,1], newtex[...,2]
red = (r > 0.3) & (g < 0.22 * r) & (b < 0.3 * r)
hand = np.zeros((H, W), dtype=bool)   # uv boxes of the hand triangles (T-pose: hands are the far-out |x| > 0.55)
for t in mesh.loop_triangles:
    if all(abs(mesh.vertices[i].co.x) > 0.55 for i in t.vertices):
        us = [uv[l].uv for l in t.loops]
        hand[max(int(min(u.y for u in us) * H) - 2, 0):int(max(u.y for u in us) * H) + 3, max(int(min(u.x for u in us) * W) - 2, 0):int(max(u.x for u in us) * W) + 3] = True
red |= hand & (r > 0.08) & (g < 0.42 * r) & (b < 0.42 * r)
print('RED_SPECKS', int(red.sum()))
newtex[red, 0] = 0.62; newtex[red, 1] = 0.34; newtex[red, 2] = 0.24
img.pixels = newtex.ravel().tolist()
img.pack()
os.makedirs(out, exist_ok=True)
# smooth shading: the decimated generated mesh is faceted; keep creases only past 55 degrees
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); bpy.context.view_layer.objects.active = body
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(55))
bpy.ops.object.select_all(action='DESELECT')
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body.select_set(True); arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=os.path.join(out, 'hero_rigged.glb'), export_format='GLB', use_selection=True, export_animations=False,
                          export_skins=True, export_apply=False, export_image_format='JPEG', export_jpeg_quality=92)
print('FACE_BAKED texels', n)
