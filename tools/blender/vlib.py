"""Shared bpy helpers for Project Valley assets (art bible conventions).

Usage inside an asset's build.py:
    import vlib
    m = vlib.Builder("prop_crate_wood_a")
    m.box((0, 0.3, 0), (1.0, 0.6, 0.6), "wood_raw", bevel=0.015)
    m.finish(lods=[0.5, 0.2], collider="box")

Coordinates passed to the Builder are glTF-style: +Y up, front faces -Z, metres.
(They are converted to Blender's Z-up internally; the glTF exporter converts back.)

Pipeline per asset: build in one bmesh with a material slot per swatch -> LODs decimated with
material delimit -> palette UVs (swatch column, vertical gradient by height) -> single "palette"
material -> collider -> GLB export (no images; the runtime swaps in the shared palette material)
-> Workbench preview PNG.
"""
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PALETTE = json.load(open(os.path.join(ROOT, "src", "content", "data", "palette.json"), encoding="utf8"))
SWATCH_INDEX = {s["name"]: i for i, s in enumerate(PALETTE["swatches"])}
PALETTE_PNG = os.path.join(ROOT, "public", "assets", "textures", "palette.png")


def _args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = {}
    for i in range(0, len(argv) - 1, 2):
        out[argv[i].lstrip("-")] = argv[i + 1]
    return out


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def gl(v):
    """glTF (x, y-up, z) -> Blender (x, -z, y)."""
    x, y, z = v
    return Vector((x, -z, y))


def swatch_uv(name, h):
    """glTF-space UV (v down) inside swatch `name`; h=1 lit top, h=0 shaded bottom."""
    i = SWATCH_INDEX[name]
    g = PALETTE["grid"]
    cell = 1.0 / g
    col, row = i % g, i // g
    top = row * cell + cell * 0.125
    bottom = row * cell + cell * 0.875
    return (col + 0.5) * cell, bottom + (top - bottom) * h


class Builder:
    def __init__(self, asset_id, category=None):
        reset_scene()
        self.id = asset_id
        self.category = category or asset_id.split("_")[0]
        self.bm = bmesh.new()
        self.lod_bms = {}  # level -> hand-made bmesh (otherwise LODs are auto-decimated)
        self.swatches = []  # material slot index -> swatch name
        self.sockets = {}

    # ---------- primitives ----------
    def _slot(self, swatch):
        if swatch not in SWATCH_INDEX:
            raise KeyError(f"unknown swatch '{swatch}' (add it to palette.json)")
        if swatch not in self.swatches:
            self.swatches.append(swatch)
        return self.swatches.index(swatch)

    def box(self, center, size, swatch, bevel=0.0, rot=(0, 0, 0)):
        """Axis box (glTF coords), optional chamfer `bevel` metres, optional rotation in degrees (gl axes)."""
        tmp = bmesh.new()
        bmesh.ops.create_cube(tmp, size=1.0)
        sx, sy, sz = size
        bmesh.ops.scale(tmp, vec=Vector((sx, sz, sy)), verts=tmp.verts)
        if bevel > 0:
            bmesh.ops.bevel(tmp, geom=list(tmp.edges), offset=bevel, segments=1, affect="EDGES", profile=0.5)
        rx, ry, rz = (math.radians(a) for a in rot)
        # gl rotation (x, y-up, z) -> blender axes (x, z, -y)
        m = Matrix.Rotation(rx, 4, "X") @ Matrix.Rotation(-rz, 4, "Y") @ Matrix.Rotation(ry, 4, "Z")
        bmesh.ops.transform(tmp, matrix=Matrix.Translation(gl(center)) @ m, verts=tmp.verts)
        self._merge(tmp, swatch)

    def cylinder(self, center, radius, height, swatch, segments=8, axis="y", bevel=0.0):
        tmp = bmesh.new()
        bmesh.ops.create_cone(tmp, cap_ends=True, segments=segments, radius1=radius, radius2=radius, depth=height)
        if bevel > 0:
            bmesh.ops.bevel(tmp, geom=[e for e in tmp.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > 0.6],
                            offset=bevel, segments=1, affect="EDGES")
        rot = {"y": Matrix.Identity(4), "x": Matrix.Rotation(math.pi / 2, 4, "Y"), "z": Matrix.Rotation(math.pi / 2, 4, "X")}[axis]
        bmesh.ops.transform(tmp, matrix=Matrix.Translation(gl(center)) @ rot, verts=tmp.verts)
        self._merge(tmp, swatch)

    def lod(self, level):
        """Following primitives go into a hand-made LOD `level` (1, 2...). Use for assets made of many thin
        parts, where decimation would punch holes. lod(0) switches back to the main mesh."""
        self._target = self.lod_bms.setdefault(level, bmesh.new()) if level else None
        return self

    def _merge(self, tmp, swatch):
        slot = self._slot(swatch)
        for f in tmp.faces:
            f.material_index = slot
        me = bpy.data.meshes.new("tmp")
        tmp.to_mesh(me)
        tmp.free()
        (getattr(self, "_target", None) or self.bm).from_mesh(me)
        bpy.data.meshes.remove(me)

    def socket(self, name, pos):
        self.sockets[name] = pos

    # ---------- finishing ----------
    def _object(self, name, bm):
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        for s in self.swatches:
            mat = bpy.data.materials.get("pal:" + s) or bpy.data.materials.new("pal:" + s)
            me.materials.append(mat)
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob

    def finish(self, lods=(0.5, 0.2), collider="box", origin="base"):
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-5)
        root = bpy.data.objects.new(self.id, None)
        bpy.context.scene.collection.objects.link(root)

        lod0 = self._object(f"{self.id}_LOD0", self.bm)
        lod0.data.name = lod0.name
        objs = [lod0]
        for i, ratio in enumerate(lods, start=1):
            if i in self.lod_bms:
                ob = self._object(f"{self.id}_LOD{i}", self.lod_bms[i])
                ob.data.name = ob.name
                objs.append(ob)
                continue
            ob = lod0.copy()
            ob.data = lod0.data.copy()
            ob.name = ob.data.name = f"{self.id}_LOD{i}"
            bpy.context.scene.collection.objects.link(ob)
            mod = ob.modifiers.new("dec", "DECIMATE")
            mod.ratio = ratio
            mod.delimit = {"MATERIAL", "SHARP"}
            bpy.context.view_layer.objects.active = ob
            with bpy.context.temp_override(object=ob, active_object=ob):
                bpy.ops.object.modifier_apply(modifier="dec")
            objs.append(ob)

        lo, hi = self._bounds(lod0)
        for ob in objs:
            self._palette_uv(ob, lo.z, hi.z)
            ob.parent = root
        self.stats = {ob.name: sum(len(p.vertices) - 2 for p in ob.data.polygons) for ob in objs}

        if collider == "box":
            c = bpy.data.meshes.new(f"{self.id}_COL_box")
            bm = bmesh.new()
            bmesh.ops.create_cube(bm, size=1.0)
            bmesh.ops.scale(bm, vec=hi - lo, verts=bm.verts)
            bmesh.ops.translate(bm, vec=(hi + lo) / 2, verts=bm.verts)
            bm.to_mesh(c)
            bm.free()
            col = bpy.data.objects.new(f"{self.id}_COL_box", c)
            bpy.context.scene.collection.objects.link(col)
            col.parent = root
            col.display_type = "WIRE"

        for name, pos in self.sockets.items():
            e = bpy.data.objects.new(f"SOCKET_{name}", None)
            bpy.context.scene.collection.objects.link(e)
            e.location = gl(pos)
            e.parent = root
        self.root = root
        return self

    @staticmethod
    def _bounds(ob):
        vs = [ob.matrix_world @ v.co for v in ob.data.vertices]
        lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
        hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
        return lo, hi

    def _palette_uv(self, ob, zmin, zmax):
        me = ob.data
        uv = me.uv_layers.new(name="UVMap")
        span = max(zmax - zmin, 1e-6)
        for poly in me.polygons:
            sw = self.swatches[poly.material_index]
            for li in poly.loop_indices:
                z = me.vertices[me.loops[li].vertex_index].co.z
                u, v = swatch_uv(sw, (z - zmin) / span)
                uv.data[li].uv = (u, 1.0 - v)  # Blender UV v is up; glTF exporter flips it back
        me.materials.clear()
        me.materials.append(_palette_material())

    # ---------- output ----------
    def export(self):
        out_dir = os.path.join(ROOT, "public", "assets", "models", self.category)
        os.makedirs(out_dir, exist_ok=True)
        path = os.path.join(out_dir, f"{self.id}.glb")
        bpy.ops.object.select_all(action="DESELECT")
        for ob in bpy.context.scene.objects:
            ob.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=path, export_format="GLB", use_selection=True, export_apply=True,
            export_yup=True, export_image_format="NONE", export_extras=False,
        )
        self.glb = path
        return path

    def preview(self, size=512):
        scene = bpy.context.scene
        scene.render.engine = "BLENDER_WORKBENCH"
        scene.display.shading.light = "STUDIO"
        scene.display.shading.color_type = "TEXTURE"
        scene.display.shading.show_cavity = True
        scene.render.resolution_x = scene.render.resolution_y = size
        scene.render.film_transparent = True
        for ob in scene.objects:
            ob.hide_render = not ob.name.endswith("_LOD0")
        lod0 = bpy.data.objects[f"{self.id}_LOD0"]
        lo, hi = self._bounds(lod0)
        center = (lo + hi) / 2
        radius = (hi - lo).length / 2
        cam_data = bpy.data.cameras.new("cam")
        cam_data.lens = 50
        cam = bpy.data.objects.new("cam", cam_data)
        scene.collection.objects.link(cam)
        direction = Vector((1.0, 1.25, 0.8)).normalized()  # 3/4 front view (glTF front -Z = Blender +Y)
        dist = radius / math.sin(cam_data.angle / 2) * 1.15
        cam.location = center + direction * dist
        cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
        scene.camera = cam
        out = os.path.join(ROOT, "assets", "previews", f"{self.id}.png")
        scene.render.filepath = out
        bpy.ops.render.render(write_still=True)
        return out

    def report(self):
        print("ASSET_REPORT " + json.dumps({"id": self.id, "category": self.category, "glb": os.path.relpath(self.glb, ROOT).replace("\\", "/"), "tris": self.stats}))


def _palette_material():
    mat = bpy.data.materials.get("palette")
    if mat:
        return mat
    mat = bpy.data.materials.new("palette")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    img = bpy.data.images.load(PALETTE_PNG, check_existing=True)
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Closest"
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.85
    return mat
