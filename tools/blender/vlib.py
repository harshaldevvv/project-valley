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
        self.parts = {}  # name -> {"pivot": gl xyz, "bm": bmesh}: separate child nodes (wheels, doors, mags)
        self.col_boxes = []  # explicit compound collider boxes (center, size, rot)
        self._target = None

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
        self._place(tmp, center, rot)
        self._merge(tmp, swatch)

    def _place(self, tmp, center, rot=(0, 0, 0)):
        """Rotate (degrees about glTF x, y-up, z) then move a temp bmesh to glTF `center`."""
        rx, ry, rz = (math.radians(a) for a in rot)
        # gl rotation (x, y-up, z) -> blender axes (x, z, -y)
        m = Matrix.Rotation(rx, 4, "X") @ Matrix.Rotation(-rz, 4, "Y") @ Matrix.Rotation(ry, 4, "Z")
        bmesh.ops.transform(tmp, matrix=Matrix.Translation(gl(center)) @ m, verts=tmp.verts)

    @staticmethod
    def _bevel(tmp, bevel, angle=0.6):
        if bevel > 0:
            edges = [e for e in tmp.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > angle]
            bmesh.ops.bevel(tmp, geom=edges, offset=bevel, segments=1, affect="EDGES", profile=0.5, clamp_overlap=True)

    def extrude(self, profile, depth, swatch, axis="x", center=(0, 0, 0), bevel=0.0, rot=(0, 0, 0)):
        """Extrude a 2D outline (convex or concave, any winding) by `depth` metres, centred on `center`.
        axis="x": points are (z, y), a side profile; axis="z": points are (x, y), a front profile;
        axis="y": points are (x, z), a floor plan. For weapons, car bodies, wedges, roofs, stair stringers."""
        tmp = bmesh.new()
        h = depth / 2
        to3 = {"x": lambda a, b, t: (t, b, a), "z": lambda a, b, t: (a, b, t), "y": lambda a, b, t: (a, t, b)}[axis]
        ring0 = [tmp.verts.new(gl(to3(a, b, -h))) for a, b in profile]
        ring1 = [tmp.verts.new(gl(to3(a, b, h))) for a, b in profile]
        tmp.faces.new(ring0)
        tmp.faces.new(list(reversed(ring1)))
        n = len(profile)
        for i in range(n):
            j = (i + 1) % n
            tmp.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
        bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces)
        # concave caps: triangulate now so bevel/export never guess
        bmesh.ops.triangulate(tmp, faces=[f for f in tmp.faces if len(f.verts) > 4])
        self._bevel(tmp, bevel)
        self._place(tmp, center, rot)
        self._merge(tmp, swatch)

    def lathe(self, profile, swatch, center=(0, 0, 0), segments=12, axis="y", closed=False, rot=(0, 0, 0), bevel=0.0,
              scale=(1, 1, 1)):
        """Revolve (radius, height) points around `axis` through `center`: tyres, cones, poles, lamp heads,
        pedestals. Radius 0 makes a single pole vertex. closed=True joins last point to first (tyre/torus).
        `scale` (glTF x, y, z) squashes the result before rotation/placement."""
        tmp = bmesh.new()
        rings = []
        for r, hgt in profile:
            if r < 1e-6:
                rings.append([tmp.verts.new((0, 0, hgt))])
            else:
                rings.append([tmp.verts.new((r * math.cos(2 * math.pi * k / segments),
                                             r * math.sin(2 * math.pi * k / segments), hgt)) for k in range(segments)])
        pairs = list(zip(rings, rings[1:])) + ([(rings[-1], rings[0])] if closed else [])
        for a, b in pairs:
            for k in range(segments):
                k1 = (k + 1) % segments
                quad = [a[k % len(a)], a[k1 % len(a)], b[k1 % len(b)], b[k % len(b)]]
                quad = [v for i, v in enumerate(quad) if v not in quad[:i]]
                if len(quad) >= 3:
                    tmp.faces.new(quad)
        if not closed:
            for ring in (rings[0], rings[-1]):
                if len(ring) > 2:
                    tmp.faces.new(ring)
        bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces)
        self._bevel(tmp, bevel)
        # built around Blender Z (= glTF y); orient to the requested glTF axis
        orient = {"y": Matrix.Identity(4), "x": Matrix.Rotation(math.pi / 2, 4, "Y"),
                  "z": Matrix.Rotation(math.pi / 2, 4, "X")}[axis]
        bmesh.ops.transform(tmp, matrix=orient, verts=tmp.verts)
        if tuple(scale) != (1, 1, 1):  # non-uniform scale in glTF axes (flattened bags, oval parts)
            bmesh.ops.scale(tmp, vec=Vector((scale[0], scale[2], scale[1])), verts=tmp.verts)
        self._place(tmp, center, rot)
        self._merge(tmp, swatch)

    def part(self, name, pivot=(0, 0, 0)):
        """Following primitives go into a separate child node `name` (own mesh, origin at glTF `pivot`) under the
        root: wheels, doors, magazines. Model it in asset space as usual. part(None) returns to the main mesh.
        Parts have no LODs and are not counted in LOD0 tris/budget."""
        if name is None:
            self._target = None
        else:
            self._target = self.parts.setdefault(name, {"pivot": pivot, "bm": bmesh.new()})["bm"]
        return self

    def collider_box(self, center, size, rot=(0, 0, 0)):
        """Add one box to a compound collider (exported as <id>_COL_box_N; put the largest first). If any are
        added, finish() uses them instead of the automatic bounding box. The runtime reads each as a world AABB."""
        self.col_boxes.append((center, size, rot))

    def lattice(self, x0, x1, y0, y1, z, spacing, thick, swatch, angle=45.0):
        """Diamond lattice of thin bars in the plane z (chain-link mesh, grilles): two families of bars at
        +/-angle degrees, `spacing` metres apart (perpendicular), clipped to the rectangle x0..x1, y0..y1."""
        for sgn in (1, -1):
            a = math.radians(angle) * sgn
            dx, dy = math.cos(a), math.sin(a)
            nx, ny = -dy, dx  # line normal; lines are n.p = c
            cs = [nx * x + ny * y for x in (x0, x1) for y in (y0, y1)]
            c = min(cs) + spacing / 2
            while c < max(cs):
                pts = []
                for x in (x0, x1):  # intersections with vertical edges
                    if abs(ny) > 1e-9:
                        y = (c - nx * x) / ny
                        if y0 - 1e-9 <= y <= y1 + 1e-9:
                            pts.append((x, y))
                for y in (y0, y1):
                    if abs(nx) > 1e-9:
                        x = (c - ny * y) / nx
                        if x0 - 1e-9 <= x <= x1 + 1e-9:
                            pts.append((x, y))
                if len(pts) >= 2:
                    p, q = min(pts), max(pts)
                    length = math.dist(p, q)
                    if length > thick:
                        ang = math.degrees(math.atan2(q[1] - p[1], q[0] - p[0]))
                        self.box(((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, z), (length, thick, thick), swatch, rot=(0, 0, ang))
                c += spacing

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
        (self._target if self._target is not None else self.bm).from_mesh(me)
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
        self.part_objs = []
        for name, p in self.parts.items():
            bmesh.ops.remove_doubles(p["bm"], verts=p["bm"].verts, dist=1e-5)
            ob = self._object(name, p["bm"])
            ob.data.name = name
            self._palette_uv(ob, lo.z, hi.z)  # in asset space, then move the origin to the pivot
            piv = gl(p["pivot"])
            ob.data.transform(Matrix.Translation(-piv))
            ob.location = piv
            ob.parent = root
            self.part_objs.append(ob)
            objs.append(ob)
        self.stats = {ob.name: sum(len(p.vertices) - 2 for p in ob.data.polygons) for ob in objs}

        for i, (c, sz, rot) in enumerate(self.col_boxes):
            bm = bmesh.new()
            bmesh.ops.create_cube(bm, size=1.0)
            bmesh.ops.scale(bm, vec=Vector((sz[0], sz[2], sz[1])), verts=bm.verts)
            self._place(bm, c, rot)
            me = bpy.data.meshes.new(f"{self.id}_COL_box_{i}")
            bm.to_mesh(me)
            bm.free()
            col = bpy.data.objects.new(me.name, me)
            bpy.context.scene.collection.objects.link(col)
            col.parent = root
            col.display_type = "WIRE"
        if self.col_boxes:
            collider = None

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
                u, v = swatch_uv(sw, min(1.0, max(0.0, (z - zmin) / span)))  # parts may poke outside LOD0
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

    def _shading(self, size):
        scene = bpy.context.scene
        scene.render.engine = "BLENDER_WORKBENCH"
        scene.display.shading.light = "STUDIO"
        scene.display.shading.color_type = "TEXTURE"
        scene.display.shading.show_cavity = True
        scene.view_settings.view_transform = "Standard"  # palette colours as authored (AgX crushed them)
        scene.render.resolution_x = scene.render.resolution_y = size
        scene.render.film_transparent = True
        return scene

    def sheet(self, tile=384, figure=True):
        """Multi-angle review sheet -> assets/previews/<id>_sheet.png, 3 x 2 tiles:
        front | back | side (-X)   /   3/4 top | 3/4 back-left low | eye level (1.8 m high, 3 m in front).
        Front/back/side are orthographic. figure=True adds a 1.8 m grey scale figure at +X (not exported)."""
        import numpy as np
        scene = self._shading(tile)
        parts = {ob.name for ob in getattr(self, "part_objs", [])}
        lod0 = bpy.data.objects[f"{self.id}_LOD0"]
        shown = [lod0] + [bpy.data.objects[n] for n in parts]
        los, his = zip(*(self._bounds(o) for o in shown))
        lo = Vector([min(v[i] for v in los) for i in range(3)])
        hi = Vector([max(v[i] for v in his) for i in range(3)])
        fig = None
        if figure:
            bm = bmesh.new()
            for c, s in (((0, 0, 0.75), (0.45, 0.25, 1.5)), ((0, 0, 1.66), (0.22, 0.24, 0.28))):
                t = bmesh.new()
                bmesh.ops.create_cube(t, size=1.0)
                bmesh.ops.scale(t, vec=Vector(s), verts=t.verts)
                bmesh.ops.translate(t, vec=Vector(c), verts=t.verts)
                me = bpy.data.meshes.new("t")
                t.to_mesh(me)
                bm.from_mesh(me)
                bpy.data.meshes.remove(me)
                t.free()
            me = bpy.data.meshes.new("scale_figure")
            bm.to_mesh(me)
            bm.free()
            uvl = me.uv_layers.new(name="UVMap")
            u, v = swatch_uv("cloth_grey", 0.5)
            for d in uvl.data:
                d.uv = (u, 1.0 - v)
            me.materials.append(_palette_material())
            fig = bpy.data.objects.new("scale_figure", me)
            fig.location = (hi.x + 0.45, 0, 0)
            scene.collection.objects.link(fig)
            hi.x += 0.7
            hi.z = max(hi.z, 1.8)
            lo.z = min(lo.z, 0)
        for ob in scene.objects:
            ob.hide_render = not (ob in shown or ob is fig)
        center = (lo + hi) / 2
        ext = hi - lo
        radius = ext.length / 2
        cam_data = bpy.data.cameras.new("sheetcam")
        cam = bpy.data.objects.new("sheetcam", cam_data)
        scene.collection.objects.link(cam)
        scene.camera = cam
        views = [  # (direction from centre in Blender axes, ortho half-extents used)
            (Vector((0, 1, 0.02)), (ext.x, ext.z)), (Vector((0, -1, 0.02)), (ext.x, ext.z)),
            (Vector((-1, 0, 0.02)), (ext.y, ext.z)), (Vector((1, 1.1, 1.3)), None),
            (Vector((-1, -0.9, 0.35)), None), ("eye" if figure else Vector((-1, 0.7, -0.35)), None)]  # small items: low 3/4 view
        tiles = []
        for i, (d, ortho) in enumerate(views):
            if d == "eye":
                cam_data.type = "PERSP"
                cam_data.lens = 28
                cam.location = Vector((center.x, hi.y + 3.0, 1.8))
                target = center
            elif ortho:
                cam_data.type = "ORTHO"
                cam_data.ortho_scale = max(ortho) * 1.15
                cam.location = center + d.normalized() * (radius * 3 + 1)
                target = center
            else:
                cam_data.type = "PERSP"
                cam_data.lens = 50
                cam.location = center + d.normalized() * (radius / math.sin(cam_data.angle / 2) * 1.1)
                target = center
            cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
            path = os.path.join(ROOT, "assets", "previews", f"{self.id}.sheet{i}.tmp.png")
            scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            img = bpy.data.images.load(path)
            px = np.empty(tile * tile * 4, dtype=np.float32)
            img.pixels.foreach_get(px)
            px = px.reshape(tile, tile, 4)
            bg = np.array([0.78, 0.79, 0.8] if i % 2 == 0 else [0.72, 0.74, 0.76], dtype=np.float32)
            rgb = px[..., :3] * px[..., 3:4] + bg * (1 - px[..., 3:4])
            tiles.append(rgb)
            bpy.data.images.remove(img)
            os.remove(path)
        sheet = np.ones((2 * tile, 3 * tile, 4), dtype=np.float32)
        for i, t in enumerate(tiles):
            r, c = 1 - i // 3, i % 3  # Blender pixel rows start at the bottom
            sheet[r * tile:(r + 1) * tile, c * tile:(c + 1) * tile, :3] = t
        out = bpy.data.images.new("sheet", 3 * tile, 2 * tile, alpha=True)
        out.pixels.foreach_set(sheet.ravel())
        out.filepath_raw = os.path.join(ROOT, "assets", "previews", f"{self.id}_sheet.png")
        out.file_format = "PNG"
        out.save()
        if fig:
            bpy.data.objects.remove(fig)
        return out.filepath_raw

    def preview(self, size=512):
        scene = self._shading(size)
        parts = {ob.name for ob in getattr(self, "part_objs", [])}
        for ob in scene.objects:
            ob.hide_render = not (ob.name.endswith("_LOD0") or ob.name in parts)
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
        # LOD check renders (git-ignored *.tmp.png), same camera: <id>.lod1.tmp.png / <id>.lod2.tmp.png
        for lvl in (1, 2):
            lod = bpy.data.objects.get(f"{self.id}_LOD{lvl}")
            if lod:
                for ob in scene.objects:
                    ob.hide_render = not (ob is lod or ob.name in parts)
                scene.render.filepath = os.path.join(ROOT, "assets", "previews", f"{self.id}.lod{lvl}.tmp.png")
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
