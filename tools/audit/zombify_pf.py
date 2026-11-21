# blender --background --python zombify_pf.py -- <in_polyfork_char.glb> <out.glb> [seed] [grime 0..1]
# Turns a clean Polyfork civilian into a zombie by editing its vertex colours only (no geometry change):
#   * skin (base body Mesh_0 and the face part): pulled toward a grey-green corpse tone, darker around the eyes is left as is;
#   * clothes and hair: desaturated and darkened (dirt);
#   * held props (attach-righthand/lefthand) are removed;
#   * blood: a few clusters of dark-red faces on the clothes (more on the front and around the collar and hands).
#   * grime (optional, 0..1, default 0 = the original look exactly): dirtier, darker clothes, mud rising from the feet,
#     blotches of grime on clothes, rot patches on the skin and extra blood clusters. Uses its own RNG, so grime 0
#     gives the same colours as before.
import bpy, sys, random, colorsys
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]
random.seed(int(a[2]) if len(a) > 2 else 7)
G = max(0.0, min(1.0, float(a[3]))) if len(a) > 3 else 0.0
rg = random.Random((int(a[2]) if len(a) > 2 else 7) + 1000)  # grime only: keeps the main RNG sequence unchanged
SEED = int(a[2]) if len(a) > 2 else 7
# vertex colours are linear: these read as dark mud brown, near-black grime and a dull green-grey rot in sRGB
MUD = (0.045, 0.030, 0.016)
GRIME = (0.018, 0.015, 0.010)
ROT = (0.07, 0.085, 0.035)
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
if G > 0:  # extra blood clusters anywhere on the torso, front or back
    extra = [Vector((rg.uniform(-0.15, 0.15), rg.uniform(-0.25, 0.25), rg.uniform(0.7, 1.35))) for _ in range(round(5 * G))]
    seeds += extra
    radii += [rg.uniform(0.08, 0.16) for _ in extra]

def patch(p, size, salt):
    # 0..1 value that is constant over ~size-metre cells: grime comes in patches, not per-face noise
    k = (int((p.x + 9) / size), int((p.y + 9) / size), int((p.z + 9) / size), SEED, salt)
    return random.Random(hash(k)).random()

def dirty(rgb, p, skin):
    # grime on top of the base grade; p = world position (z up, metres, T-pose before any scale)
    if G <= 0: return rgb
    if skin:
        if patch(p, 0.06, 1) < 0.35 * G: rgb = mix(rgb, ROT, 0.55)
        return grade(rgb, 1.0, 1.0 - 0.15 * G)
    rgb = grade(rgb, 1.0 - 0.6 * G, 1.0 - 0.4 * G)
    if colorsys.rgb_to_hsv(*rgb)[1] > 0.35:  # loud colours (hi-vis vests, bright shirts) get grimed down harder
        rgb = mix(grade(rgb, 1.0 - 0.55 * G, 1.0 - 0.3 * G), MUD, 0.3 * G)
    if p.z < 0.9: rgb = mix(rgb, MUD, G * 0.85 * (1 - p.z / 0.9) ** 0.7)
    if patch(p, 0.1, 2) < 0.5 * G: rgb = mix(rgb, GRIME, 0.4 + 0.4 * patch(p, 0.1, 3))
    return rgb
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
            if blood is None and skin and G > 0 and rg.random() < 0.12 * G:  # skin wounds near the blood clusters
                for s, r in zip(seeds, radii):
                    if (centre - s).length < r * 1.2: blood = rg.choice(BLOOD); break
            # one grime roll per face, shared by its corners (faces stay flat-coloured like the source)
            state = rg.getstate()
            for li in poly.loop_indices:
                c = attr.data[li].color
                if blood and G <= 0: rgb = mix(c, blood, 0.85)
                else:
                    rgb = grade(mix(c, SKIN, 0.65), 0.7, 0.85) if skin else grade(c, 0.55, 0.78)
                    rg.setstate(state)
                    rgb = dirty(rgb, centre, skin)
                    # grimy blood: older and darker, laid over the dirtied colour so bright cloth does not show through
                    if blood:
                        # on near-black cloth (wetsuits) full-strength blood reads as red paint: soak it in instead
                        k = 0.85 + 0.1 * G if max(rgb) > 0.06 else 0.2
                        rgb = mix(rgb, tuple(x * (1 - 0.45 * G) for x in blood), k)
                attr.data[li].color = (*rgb, c[3])
    else:
        for v in me.vertices:
            c = attr.data[v.index].color
            rgb = grade(mix(c, SKIN, 0.65), 0.7, 0.85) if skin else grade(c, 0.55, 0.78)
            p = W @ v.co
            rgb = dirty(rgb, p, skin)
            if not skin and any((p - s).length < r for s, r in zip(seeds, radii)): rgb = mix(rgb, random.choice(BLOOD), 0.8)
            attr.data[v.index].color = (*rgb, c[3])
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_skins=True, export_vertex_color='ACTIVE')
print('ZOMBIFIED', out)
