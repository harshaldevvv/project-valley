"""Inventory item icons (QA-023): one transparent PNG per item id in src/content/data/items.ts.
Run: blender --background --python assets/source/icons/build.py [-- --only <itemId>]

Items with a game model render from that GLB; the rest get a tiny icon-only model built here (palette swatches,
chamfered, same style as the props). Workbench: studio light, cavity + object outline, transparent film,
orthographic. Weapons in side profile (muzzle right), everything else at a 3/4 view.
Output: public/assets/icons/<id>.png (128 px on the longest side, tight crop, long axis matching the item's w x h
grid shape), public/assets/icons/index.json, assets/previews/icons_sheet.png (128 px row + 56 px row on tile colour).
"""
import json
import math
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "tools", "blender"))
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

import vlib  # noqa: E402

SIZE, RENDER = 128, 512
OUT = os.path.join(vlib.ROOT, "public", "assets", "icons")
WPN = os.path.join(vlib.ROOT, "public", "assets", "models", "wpn")
GLB = {"pistol_a": "wpn_pistol_a", "rifle_a": "wpn_rifle_a", "knife_a": "wpn_knife_a",
       "mag_pistol_a": "wpn_mag_pistol_a", "mag_rifle_a": "wpn_mag_rifle_a"}
SIDE = {"pistol_a", "rifle_a", "knife_a"}  # side profile


def items():
    src = open(os.path.join(vlib.ROOT, "src", "content", "data", "items.ts"), encoding="utf8").read()
    return [(m[0], int(m[1]), int(m[2])) for m in re.findall(r"id: '([a-z0-9_]+)',[^}]*?\bw: (\d+), h: (\d+)", src)]


# ------------------------------------------------------------------------------- icon-only models (glTF coords, y up)
def ammo_9mm(m):  # open cardboard box of brass rounds
    m.box((0, 0.02, 0), (0.12, 0.04, 0.08), "cardboard", bevel=0.003)
    m.box((0, 0.018, 0), (0.122, 0.018, 0.082), "paper", bevel=0.001)  # label band
    m.box((0, 0.045, -0.055), (0.12, 0.003, 0.05), "cardboard", rot=(-35, 0, 0))  # open lid
    for i in range(5):
        for j in range(3):
            c = (-0.044 + i * 0.022, 0.04, -0.022 + j * 0.022)
            m.lathe([(0.0085, 0.0), (0.0085, 0.008), (0.0065, 0.014), (0.0, 0.018)], "paint_yellow_faded",
                    center=c, segments=8)


def ammo_762(m):  # olive ammo can with a yellow stripe and a carry handle
    m.box((0, 0.045, 0), (0.15, 0.09, 0.08), "military_olive", bevel=0.005)
    m.box((0, 0.093, 0), (0.156, 0.01, 0.086), "metal_dark", bevel=0.002)  # lid
    m.box((0, 0.055, 0), (0.152, 0.016, 0.082), "paint_yellow_faded")  # stripe
    m.box((0.035, 0.03, 0.041), (0.05, 0.016, 0.003), "stencil_white")  # stencil plate
    m.box((0, 0.106, 0), (0.07, 0.008, 0.012), "metal_dark", bevel=0.002)  # handle
    for x in (-0.034, 0.034):
        m.box((x, 0.101, 0), (0.008, 0.012, 0.012), "metal_dark")


def bandage(m):  # rolled bandage with a loose tail and a red stripe
    m.lathe([(0.0, -0.025), (0.028, -0.025), (0.031, -0.021), (0.032, 0.0), (0.031, 0.021), (0.028, 0.025),
             (0.0, 0.025)], "stencil_white", center=(0, 0.032, 0), segments=12, axis="x")
    m.lathe([(0.0, -0.0255), (0.009, -0.0255)], "wood_weathered", center=(0, 0.032, 0), segments=8, axis="x")  # core
    m.lathe([(0.0323, -0.017), (0.0323, -0.008)], "paint_red_faded", center=(0, 0.032, 0), segments=12, axis="x")
    m.box((0, 0.002, 0.045), (0.048, 0.003, 0.08), "stencil_white")  # tail unrolled on the ground


def canned_beans(m):
    m.lathe([(0.0, 0.0), (0.036, 0.0), (0.038, 0.004), (0.036, 0.008), (0.036, 0.092), (0.038, 0.096),
             (0.036, 0.1), (0.0, 0.1)], "metal_bare", center=(0, 0, 0), segments=14)
    m.lathe([(0.0375, 0.016), (0.0375, 0.084)], "paint_red_faded", center=(0, 0, 0), segments=14)  # label
    m.lathe([(0.0378, 0.038), (0.0378, 0.062)], "paper", center=(0, 0, 0), segments=14, rot=(0, 0, 0))
    m.box((0, 0.05, 0.0375), (0.03, 0.02, 0.004), "rust")  # beans picture on the label


def water_bottle(m):
    m.lathe([(0.0, 0.0), (0.03, 0.0), (0.033, 0.006), (0.033, 0.15), (0.029, 0.17), (0.013, 0.195),
             (0.013, 0.205), (0.0, 0.205)], "glass", segments=12)
    m.lathe([(0.0336, 0.06), (0.0336, 0.115)], "paint_blue_faded", segments=12)  # label
    m.lathe([(0.0, 0.2), (0.015, 0.2), (0.015, 0.222), (0.0, 0.222)], "plastic_white", segments=10)  # cap


def wood_planks(m):  # two planks side by side, a third laid across them at a slight angle
    for sw, x, y, ry in (("wood_raw", -0.056, 0.011, 0), ("wood_weathered", 0.056, 0.011, 0), ("plywood", 0.0, 0.032, 7)):
        m.box((x, y, 0), (0.1, 0.02, 0.6), sw, bevel=0.003, rot=(0, ry, 0))
        for dz, dx in ((0.12, 0.02), (-0.15, -0.025)):
            m.box((x + dx, y + 0.0105, dz), (0.006, 0.002, 0.12), "wood_dark", rot=(0, ry, 0))  # grain


def nails(m):  # small blue-labelled box, nails standing in it and a few loose ones
    m.box((0, 0.025, 0), (0.08, 0.05, 0.06), "cardboard", bevel=0.003)
    m.box((0, 0.025, 0), (0.082, 0.026, 0.062), "paint_blue_faded")
    for i, (x, z, tilt) in enumerate(((-0.022, -0.012, 8), (0.0, 0.01, -6), (0.02, -0.008, 12), (-0.01, 0.014, -14),
                                      (0.025, 0.016, 4), (-0.026, 0.012, -4))):
        m.cylinder((x, 0.06, z), 0.0025, 0.05, "metal_bare", segments=5)
        m.cylinder((x, 0.086, z), 0.006, 0.003, "metal_bare", segments=8)
    for x, z, r in ((0.07, 0.02, 30), (0.06, -0.04, -60)):
        m.box((x, 0.003, z), (0.004, 0.004, 0.06), "metal_bare", rot=(0, r, 0))
        m.box((x - 0.028 * math.sin(math.radians(r)), 0.003, z - 0.028 * math.cos(math.radians(r))),
              (0.011, 0.003, 0.011), "metal_bare", rot=(0, r, 0))


def scrap_metal(m):  # bent rusty sheet, a blue-painted offcut and a pipe stub
    m.box((-0.03, 0.006, 0), (0.12, 0.004, 0.14), "rust", rot=(0, 0, 4))
    m.box((0.055, 0.03, 0), (0.07, 0.004, 0.14), "rust", rot=(0, 0, 40))  # bent flap
    m.box((-0.01, 0.022, 0.03), (0.09, 0.004, 0.08), "paint_blue_faded", rot=(8, 25, -6))
    m.box((-0.03, 0.03, -0.03), (0.07, 0.004, 0.05), "metal_bare", rot=(-12, -20, 10))
    m.cylinder((0.0, 0.016, -0.075), 0.012, 0.1, "metal_dark", segments=8, axis="x")


def backpack_small(m):
    m.box((0, 0.17, 0), (0.28, 0.34, 0.13), "cloth_khaki", bevel=0.03)  # body
    m.box((0, 0.1, -0.075), (0.2, 0.15, 0.04), "leather_brown", bevel=0.012)  # front pocket
    m.box((0, 0.3, -0.035), (0.27, 0.1, 0.08), "leather_brown", bevel=0.015, rot=(-12, 0, 0))  # top flap
    for x in (-0.06, 0.06):
        m.box((x, 0.21, -0.07), (0.022, 0.18, 0.012), "cloth_black")  # flap straps
        m.box((x, 0.165, -0.077), (0.03, 0.02, 0.006), "metal_bare")  # buckles
    for x in (-0.155, 0.155):
        m.box((x, 0.1, 0), (0.04, 0.14, 0.09), "cloth_khaki", bevel=0.01)  # side pockets
    m.box((0, 0.36, 0.04), (0.06, 0.03, 0.02), "cloth_black", bevel=0.005)  # grab handle


def jacket_field(m):  # folded olive field jacket
    m.box((0, 0.03, 0), (0.32, 0.06, 0.36), "cloth_olive", bevel=0.015)
    m.box((0, 0.066, -0.15), (0.22, 0.016, 0.07), "military_olive", bevel=0.006)  # collar
    m.box((0, 0.062, 0.02), (0.018, 0.004, 0.3), "military_olive")  # placket
    for x in (-0.075, 0.075):
        m.box((x, 0.064, -0.06), (0.09, 0.006, 0.07), "military_olive", bevel=0.003)  # chest pockets
        m.box((x, 0.068, -0.085), (0.092, 0.004, 0.024), "cloth_olive", bevel=0.002)  # pocket flaps
        m.cylinder((x, 0.071, -0.085), 0.005, 0.003, "military_tan", segments=6)  # buttons
    m.box((-0.06, 0.064, 0.11), (0.2, 0.012, 0.05), "military_olive", bevel=0.005, rot=(0, 25, 0))  # folded sleeve


def cloth_rag(m):  # crumpled rag with a folded corner
    m.box((0, 0.004, 0), (0.17, 0.006, 0.13), "cloth_khaki", bevel=0.002, rot=(0, 8, 0))  # flat sheet
    m.box((0.035, 0.012, 0.035), (0.11, 0.006, 0.06), "cloth_khaki", bevel=0.002, rot=(0, -14, 4))  # fold over
    m.box((-0.05, 0.014, -0.03), (0.06, 0.012, 0.08), "cloth_khaki", bevel=0.005, rot=(0, 30, -12))  # bunched end
    m.box((0, 0.0075, 0), (0.172, 0.002, 0.03), "cloth_red", rot=(0, 8, 0))  # woven stripe
    m.box((0.075, 0.02, 0.05), (0.035, 0.004, 0.03), "cloth_grey", bevel=0.001, rot=(25, 40, 20))  # torn corner


def repair_kit(m):  # red metal toolbox, carry handle, two latches, a wrench laid across the lid
    m.box((0, 0.05, 0), (0.3, 0.1, 0.13), "paint_red_faded", bevel=0.006)  # body
    m.box((0, 0.106, 0), (0.306, 0.016, 0.136), "paint_red_faded", bevel=0.004)  # lid
    m.box((0, 0.098, 0), (0.308, 0.004, 0.138), "metal_dark")  # lid seam
    for x in (-0.1, 0.1):
        m.box((x, 0.09, -0.067), (0.026, 0.03, 0.006), "metal_bare", bevel=0.002)  # latches
        m.box((x * 0.55, 0.124, 0), (0.012, 0.02, 0.014), "metal_dark")  # handle posts
    m.box((0, 0.136, 0), (0.13, 0.012, 0.016), "metal_dark", bevel=0.003)  # handle grip
    m.box((0.02, 0.118, 0.035), (0.22, 0.006, 0.018), "metal_bare", bevel=0.002, rot=(0, 12, 0))  # wrench shaft
    for dx, r in ((-0.11, 12), (0.15, 12)):
        m.cylinder((0.02 + dx * math.cos(math.radians(r)), 0.118, 0.035 + dx * math.sin(math.radians(r))),
                   0.02, 0.006, "metal_bare", segments=8)  # wrench heads


MODELS = {f.__name__: f for f in (repair_kit, ammo_9mm, ammo_762, bandage, canned_beans, water_bottle, wood_planks, nails,
                                  scrap_metal, backpack_small, jacket_field, cloth_rag)}


def build(item):
    """Fresh scene with the item's visible meshes; returns them."""
    if item in GLB:
        vlib.reset_scene()
        bpy.ops.import_scene.gltf(filepath=os.path.join(WPN, f"{GLB[item]}.glb"))
        for mat in bpy.data.materials:  # the GLB's untextured "palette" would shadow vlib's textured one
            mat.name = "_imported_" + mat.name
        obs = []
        for o in bpy.context.scene.objects:
            n = o.name.split(".")[0]
            if o.type != "MESH" or n.endswith(("_LOD1", "_LOD2")) or "_COL" in n:
                o.hide_render = True
                continue
            o.data.materials.clear()
            o.data.materials.append(vlib._palette_material())
            obs.append(o)
        return obs
    if item not in MODELS:
        print(f"ICON_SKIP {item}: no model or icon builder")
        return []
    m = vlib.Builder(f"icon_{item}", category="icon")
    MODELS[item](m)
    m.finish(lods=(), collider=None)
    return [bpy.data.objects[f"icon_{item}_LOD0"]]


# ------------------------------------------------------------------------------- render
def shade():
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sh = sc.display.shading
    sh.light, sh.color_type = "STUDIO", "TEXTURE"
    sh.show_cavity, sh.cavity_type = True, "BOTH"
    sh.cavity_ridge_factor, sh.cavity_valley_factor = 1.2, 1.4
    sh.curvature_ridge_factor, sh.curvature_valley_factor = 0.9, 1.2
    sh.show_object_outline, sh.object_outline_color = True, (0.05, 0.05, 0.05)
    sh.show_specular_highlight = True
    sc.display.render_aa = "32"
    sc.view_settings.view_transform = "Standard"
    sc.render.film_transparent = True
    sc.render.resolution_percentage = 100
    sc.render.image_settings.color_mode = "RGBA"
    return sc


def render(item, obs):
    sc = shade()
    side = item in SIDE
    d = Vector((1, 0, 0.09) if side else (0.75, -1.0, 0.85)).normalized()  # from the target toward the camera
    cam = bpy.data.objects.new("_cam", bpy.data.cameras.new("_cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = "ORTHO"
    rot = (-d).to_track_quat("-Z", "Z")
    bpy.context.view_layer.update()
    vs = [o.matrix_world @ v.co for o in obs for v in o.data.vertices]
    R = rot.to_matrix()
    loc = [R.transposed() @ v for v in vs]  # camera-aligned coords (x right, y up)
    lo = Vector([min(p[i] for p in loc) for i in range(3)])
    hi = Vector([max(p[i] for p in loc) for i in range(3)])
    ex, ey = hi.x - lo.x, hi.y - lo.y
    c = R @ Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, hi.z + 1.0))
    cam.location, cam.rotation_euler = c, rot.to_euler()
    cam.data.clip_end = (hi.z - lo.z) + 2.0
    span = max(ex, ey) * 1.06
    cam.data.ortho_scale = span
    sc.render.resolution_x = max(16, round(RENDER * ex * 1.06 / span))
    sc.render.resolution_y = max(16, round(RENDER * ey * 1.06 / span))
    tmp = os.path.join(OUT, f"_tmp_{item}.png")
    sc.render.filepath = tmp
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(tmp)
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    os.remove(tmp)
    return a.reshape(h, w, 4)


def crop_fit(a, w_cells, h_cells):
    ys, xs = np.nonzero(a[..., 3] > 0.02)
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    if w_cells != h_cells and (a.shape[1] > a.shape[0]) != (w_cells > h_cells):
        a = np.rot90(a)  # long axis follows the item's grid shape (bottom-up rows: rot90 = clockwise on screen)
    return np.ascontiguousarray(a)


def resize(a, longest):
    h, w = a.shape[:2]
    s = longest / max(w, h)
    nw, nh = max(1, round(w * s)), max(1, round(h * s))
    im = bpy.data.images.new("_r", w, h, alpha=True)
    im.pixels.foreach_set(a.ravel())
    im.scale(nw, nh)
    b = np.empty(nw * nh * 4, dtype=np.float32)
    im.pixels.foreach_get(b)
    bpy.data.images.remove(im)
    return b.reshape(nh, nw, 4)


def halo(a, col=(0.82, 0.83, 0.85), alpha=0.45):
    """1 px light rim under the icon so dark guns still separate from dark inventory tiles."""
    al = a[..., 3]
    d = al.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
        d = np.maximum(d, np.roll(np.roll(al, dy, 0), dx, 1))
    rim = np.clip(d - al, 0, 1) * alpha
    out = a.copy()
    out[..., 3] = al + rim
    w = np.where(out[..., 3] > 0, al / np.maximum(out[..., 3], 1e-6), 1)[..., None]
    out[..., :3] = a[..., :3] * w + np.array(col) * (1 - w)
    return out


def save(a, path):
    im = bpy.data.images.new("_s", a.shape[1], a.shape[0], alpha=True)
    im.pixels.foreach_set(np.clip(a, 0, 1).ravel())
    im.filepath_raw = path
    im.file_format = "PNG"
    im.save()
    bpy.data.images.remove(im)


def contact_sheet(icons, path):
    """Row per size: 128 px cells, then the same icons at 56 px (inventory scale), on the inventory tile colour."""
    n = len(icons)
    cols = 8
    rows = (n + cols - 1) // cols
    big, small, pad = 136, 64, 4
    H = rows * big + rows * small
    S = np.zeros((H, cols * big, 4), dtype=np.float32)
    S[..., :3], S[..., 3] = (0.16, 0.17, 0.18), 1.0
    for i, (_, a) in enumerate(icons):
        r, c = i // cols, i % cols
        for cell, y0, im in ((big, r * big, a), (small, rows * big + r * small, resize(a, small - 2 * pad))):
            x0 = c * big
            S[H - y0 - cell:H - y0, x0 + 1:x0 + cell - 1, :3] = (0.22, 0.23, 0.25)  # tile (rows are bottom-up)
            h, w = im.shape[:2]
            yy, xx = H - y0 - cell + (cell - h) // 2, x0 + (cell - w) // 2
            al = im[..., 3:4]
            S[yy:yy + h, xx:xx + w, :3] = im[..., :3] * al + S[yy:yy + h, xx:xx + w, :3] * (1 - al)
    save(S, path)


def main():
    os.makedirs(OUT, exist_ok=True)
    only = vlib._args().get("only")
    done = []
    for item, w, h in items():
        if only and item != only:
            continue
        obs = build(item)
        if not obs:
            continue
        a = resize(crop_fit(render(item, obs), w, h), SIZE - 2)
        a = halo(np.pad(a, ((1, 1), (1, 1), (0, 0))))
        save(a, os.path.join(OUT, f"{item}.png"))
        done.append((item, a))
        print(f"ICON {item} {a.shape[1]}x{a.shape[0]}")
    if not only:
        json.dump({"size": SIZE, "ids": [i for i, _ in done]}, open(os.path.join(OUT, "index.json"), "w"), indent=1)
        contact_sheet(done, os.path.join(vlib.ROOT, "assets", "previews", "icons_sheet.png"))


main()
