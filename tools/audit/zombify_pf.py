# blender --background --python zombify_pf.py -- <in_polyfork_char.glb> <out.glb> [seed]
# Turns a clean Polyfork civilian into a zombie by editing its vertex colours only (no geometry change):
#   * skin (base body Mesh_0 and the face part): pulled toward a grey-green corpse tone, darker around the eyes is left as is;
#   * clothes and hair: desaturated and darkened (dirt);
#   * held props (attach-righthand/lefthand) are removed;
#   * blood: a few clusters of dark-red faces on the clothes (more on the front and around the collar and hands).
import bpy, sys, random, colorsys
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]
random.seed(int(a[2]) if len(a) > 2 else 7)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
SKIN = (0.50, 0.56, 0.42)
BLOOD = [(0.30, 0.03, 0.02), (0.22, 0.02, 0.02), (0.38, 0.06, 0.04)]

def mix(c, t, k): return tuple(c[i] * (1 - k) + t[i] * k for i in range(3))
def grade(c, sat, val):
    h, s, v = colorsys.rgb_to_hsv(*c[:3]); return colorsys.hsv_to_rgb(h, s * sat, v * val)

# held props (walker frames, tools, cups, rifles) make no sense on a zombie
for o in list(scene.objects):
    if o.type == 'MESH' and ('righthand' in o.name or 'lefthand' in o.name): bpy.data.objects.remove(o, do_unlink=True)
meshes = [o for o in scene.objects if o.type == 'MESH' and o.vertex_groups]
# blood seeds in world space: front torso, collar, one sleeve, one thigh
seeds = [Vector((random.uniform(-0.12, 0.12), random.uniform(-0.25, -0.1), random.uniform(0.95, 1.3))) for _ in range(3)]
seeds += [Vector((random.uniform(-0.1, 0.1), random.uniform(-0.2, 0.1), random.uniform(1.3, 1.42)))]
seeds += [Vector((random.choice([-1, 1]) * random.uniform(0.35, 0.6), random.uniform(-0.1, 0.1), random.uniform(1.25, 1.4)))]
seeds += [Vector((random.choice([-1, 1]) * random.uniform(0.05, 0.15), random.uniform(-0.15, 0.0), random.uniform(0.45, 0.8)))]
radii = [random.uniform(0.07, 0.14) for _ in seeds]
for o in meshes:
    me = o.data
    attr = me.color_attributes.get('Color') or (me.color_attributes[0] if me.color_attributes else None)
    if attr is None: continue
    skin = o.name.startswith('Mesh_0') or 'face' in o.name
    W = o.matrix_world
    if attr.domain == 'CORNER':
        for poly in me.polygons:
            centre = W @ poly.center
            blood = None
            if not skin or random.random() < 0.15:
                for s, r in zip(seeds, radii):
                    if (centre - s).length < r * random.uniform(0.6, 1.3): blood = random.choice(BLOOD); break
            for li in poly.loop_indices:
                c = attr.data[li].color
                if blood: rgb = mix(c, blood, 0.85)
                elif skin: rgb = grade(mix(c, SKIN, 0.65), 0.7, 0.85)
                else: rgb = grade(c, 0.55, 0.78)
                attr.data[li].color = (*rgb, c[3])
    else:
        for v in me.vertices:
            c = attr.data[v.index].color
            rgb = grade(mix(c, SKIN, 0.65), 0.7, 0.85) if skin else grade(c, 0.55, 0.78)
            p = W @ v.co
            if not skin and any((p - s).length < r for s, r in zip(seeds, radii)): rgb = mix(rgb, random.choice(BLOOD), 0.8)
            attr.data[v.index].color = (*rgb, c[3])
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_skins=True, export_vertex_color='ACTIVE')
print('ZOMBIFIED', out)
