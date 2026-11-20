import { BufferGeometry, Group, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Game } from '../../core/game';
import { CONTAINER_THEMES, CONTAINERS } from '../../content/data/containers';
import { BUILDINGS, FIELDS, OUT, PADS, PLACED, ROADS, type Placed, type SurfaceTag } from '../../content/data/outskirts';
import { poiSpots } from '../../content/data/pois';
import { pfWorldMaterial } from '../../engine/palette';
import { addGroundRegion } from '../surfaces';
import type { Kit } from '../yard/kit';
import { buildBuilding } from './buildings';
import { loadPfm } from './models';
import { footprints } from './footprints';
import { buildScatter } from './scatter';

/**
 * The outskirts south of the Yard (data: content/data/outskirts.ts and pois.ts). One merged mesh per chunk (a POI or a
 * building: one draw call, frustum culled), painted roads and pads in the yard kit, rotated box colliders for every
 * solid model, searchable containers registered in game.places, and the forest scatter (scatter.ts).
 */
const UP = new Vector3(0, 1, 0);
/** models whose open side is local -Z (the bar-back shelf: its black back panel is on +Z), turned round so yaw means "front toward" like the rest */
const FRONT_MINUS_Z = new Set(['back-bar-shelf-unit']);

const surfaceFor = (k: string): SurfaceTag => {
  if (/truck|van\b|car\b|suv|wagon|pickup|cruiser|jeep|tank|hatchback|sedan|trailer|bus$|helicopter|aeroplane|tower|lamp|pump|drum|barrier|gatehouse|canopy|dumpster|vending|booth|hydrant|trash|jerry|fence-run|ambulance|tractor|stove|cabinet|locker|filing|fridge|guardrail|crash/.test(k)) return 'metal';
  if (/barn|cabin|crate|bench|table|log|stand|coop|pole|shed|outhouse|hay|tent|sign|trough|bed|shelf|chair|sofa|wardrobe|bookcase|scarecrow|firewood|wheelbarrow|hammock|stump/.test(k)) return 'wood';
  if (/tire|cone/.test(k)) return 'rubber';
  return 'concrete';
};

export async function buildOutskirts(kit: Kit, game: Game) {
  const chunks = new Map<string, BufferGeometry[]>();
  const push = (chunk: string, g: BufferGeometry) => (chunks.get(chunk) ?? chunks.set(chunk, []).get(chunk)!).push(g);
  const ctx = {
    cuboid: (hx: number, hy: number, hz: number, x: number, y: number, z: number, yaw: number, s: SurfaceTag) => kit.cuboid(hx, hy, hz, x, y, z, yaw, s),
    region: (test: (x: number, z: number) => boolean, s: SurfaceTag) => addGroundRegion(test, s),
  };

  // ---- roads, shoulders, lane paint and pads (painted into the yard's merged kit mesh)
  const asphalt = ROADS.filter((r) => r.kind === 'asphalt');
  for (const r of ROADS) {
    if (r.kind === 'asphalt') {
      kit.strip(r.ax, r.az, r.bx, r.bz, r.w + 1.8, 0.02, 'rock', 0.4); // gravel shoulder
      kit.strip(r.ax, r.az, r.bx, r.bz, r.w, 0.03, 'asphalt', 0.5);
    } else kit.strip(r.ax, r.az, r.bx, r.bz, r.w, 0.03, 'dirt', 0.5);
  }
  for (const r of asphalt) {
    if (!r.dashes) continue;
    const len = Math.hypot(r.bx - r.ax, r.bz - r.az);
    const ux = (r.bx - r.ax) / len, uz = (r.bz - r.az) / len;
    const nearOther = (x: number, z: number) => asphalt.some((o) => {
      if (o === r) return false;
      const l2 = Math.hypot(o.bx - o.ax, o.bz - o.az);
      const t = Math.min(l2, Math.max(0, ((x - o.ax) * (o.bx - o.ax) + (z - o.az) * (o.bz - o.az)) / l2));
      return Math.hypot(x - (o.ax + ((o.bx - o.ax) / l2) * t), z - (o.az + ((o.bz - o.az) / l2) * t)) < o.w / 2 + 1.5;
    });
    for (let t = 3; t + 2 < len - 3; t += 6) {
      const x0 = r.ax + ux * t, z0 = r.az + uz * t, x1 = r.ax + ux * (t + 2.4), z1 = r.az + uz * (t + 2.4);
      if (z0 < 103 || nearOther(x0, z0) || nearOther(x1, z1)) continue;
      kit.strip(x0, z0, x1, z1, 0.16, 0.05, 'road_paint_yellow', 0.7);
    }
  }
  for (const p of PADS) kit.pad(p.w, p.d, p.x, p.z, p.sw, p.y ?? 0.04, 0.55);

  // ---- invisible boundary round the plateau (the trees and hills beyond are scenery)
  {
    const h = 6, w = 0.5;
    const cz = (OUT.z0 + OUT.z1) / 2, hz = (OUT.z1 - OUT.z0) / 2;
    kit.cuboid(w, h, hz, OUT.x0 - w, h, cz, 0, 'concrete');
    kit.cuboid(w, h, hz, OUT.x1 + w, h, cz, 0, 'concrete');
    kit.cuboid((OUT.x1 - OUT.x0) / 2 + 1, h, w, 0, h, OUT.z1 + w, 0, 'concrete');
    for (const sx of [-1, 1]) kit.cuboid(31, h, 0.5, sx * 130, h, OUT.z0 - 0.4, 0, 'concrete'); // east / west of the yard's south wall
  }

  // ---- model placement (merged per chunk) + colliders
  const placeModel = async (p: Placed) => {
    const m = await loadPfm(p.k);
    if (!m) return;
    const s = p.s ?? 1;
    const g = m.geo.clone();
    if (FRONT_MINUS_Z.has(p.k)) p = { ...p, yaw: p.yaw + Math.PI };
    if (p.lift) { const col = g.getAttribute('color'); for (let n = 0; n < col.count * 3; n++) (col.array as Float32Array)[n] *= p.lift; }
    g.applyMatrix4(new Matrix4().compose(new Vector3(p.x, p.y ?? 0, p.z), new Quaternion().setFromAxisAngle(UP, p.yaw), new Vector3(s, s, s)));
    push(p.chunk, g);
    if (Math.max(m.size.x, m.size.z) * s > 1.2) footprints.push({ x: p.x, z: p.z, r: (Math.hypot(m.size.x, m.size.z) / 2) * s * 0.85 });
    const surf = p.surf ?? surfaceFor(p.k);
    const auto = p.solid !== false && !/^(traffic-cone|fuel-jerrycan|minefield|camping-lantern|camp-water|two-burner|sleeping-bag|area-rug|tilled|grave-cross|feed-sack|pumpkin|sunflower|corn|wheat)/.test(p.k);
    if (p.boxes) {
      for (const [lx, ly, lz, hx, hy, hz] of p.boxes) {
        const c = new Vector3(lx * s, 0, lz * s).applyAxisAngle(UP, p.yaw);
        kit.cuboid(hx * s, hy * s, hz * s, p.x + c.x, (p.y ?? 0) + ly * s, p.z + c.z, p.yaw, surf);
      }
    } else if (auto) {
      const k = p.shrink ?? 0.9;
      const hx = (m.size.x / 2) * s * k, hy = (m.size.y / 2) * s, hz = (m.size.z / 2) * s * k;
      if (hx > 0.05 && hz > 0.05) kit.cuboid(hx, hy, hz, p.x, (p.y ?? 0) + hy, p.z, p.yaw, surf);
    }
  };

  const items: Placed[] = [...PLACED];
  for (const b of BUILDINGS) {
    footprints.push({ x: b.x, z: b.z, r: Math.hypot(b.w, b.d) / 2 + 2 });
    const r = buildBuilding(b, ctx);
    for (const g of r.geos) push(b.chunk, g);
    items.push(...r.items);
  }

  // containers: the visual is a model merged into the chunk (no draw call of its own); the placement is an empty group
  const POI_CHUNK: Record<string, string> = { checkpoint: 'checkpoint', fuel: 'fuel', maple: 'maple_s', school: 'school', farm: 'farm', diner: 'diner', camp: 'camp', crash: 'crash', ranger: 'ranger' };
  const containerType = (type: string, theme: string) => {
    if (CONTAINERS[type]) return type;
    const alt = (CONTAINER_THEMES[theme] ?? []).find((t) => CONTAINERS[t]);
    return alt ?? 'crate_wood';
  };
  const placedHeights = new Map<string, number>();
  for (const sp of poiSpots) {
    let top = 0.9;
    if (sp.model && !sp.building) {
      const m = await loadPfm(sp.model);
      if (m) top = m.size.y;
      items.push({ chunk: POI_CHUNK[sp.poi] ?? 'road', k: sp.model, x: sp.x, z: sp.z, yaw: sp.yaw, ...(sp.y ? { y: sp.y } : {}), surf: 'wood' });
    } else if (sp.model && sp.building) {
      const m = sp.model === 'counter' ? null : sp.model === 'register' ? null : await loadPfm(sp.model);
      top = m ? m.size.y : sp.model === 'register' ? 0.25 : 0.9;
    }
    placedHeights.set(sp.id, top);
  }
  for (const p of items) await placeModel(p);
  for (const sp of poiSpots) {
    const type = containerType(sp.type, sp.theme);
    const object = new Group();
    object.name = `container_${sp.id}`;
    const y = (sp.y ?? 0) + Math.min(1.0, (placedHeights.get(sp.id) ?? 0.9) * 0.8);
    object.position.set(sp.x, 0, sp.z);
    game.scene.add(object);
    game.places.containers.push({ id: `poi_${sp.id}`, type, object, position: new Vector3(sp.x, y, sp.z) });
  }

  // ---- fields: soil strips painted in the kit, crops instanced
  const mat = await pfWorldMaterial();
  for (const f of FIELDS) kit.pad(f.w, f.d, f.x, f.z, 'mud', 0.035, 0.45);
  const cropKey = { corn: 'corn-crop', wheat: 'wheat-crop', pumpkin: 'pumpkin-crop', sunflower: 'sunflower' } as const;
  for (const crop of ['corn', 'wheat', 'pumpkin', 'sunflower'] as const) {
    const fields = FIELDS.filter((f) => f.crop === crop);
    const m = await loadPfm(cropKey[crop]);
    if (!m || !fields.length) continue;
    const mats: Matrix4[] = [];
    const q = new Quaternion();
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const f of fields) {
      for (let x = -f.w / 2 + f.step / 2; x < f.w / 2; x += f.step) {
        for (let z = -f.d / 2 + f.step / 2; z < f.d / 2; z += f.step) {
          if (rnd() < 0.08) continue; // gaps
          q.setFromAxisAngle(UP, rnd() * 6.283);
          const sc = 0.85 + rnd() * 0.35;
          mats.push(new Matrix4().compose(new Vector3(f.x + x + (rnd() - 0.5) * 0.4, 0.03, f.z + z + (rnd() - 0.5) * 0.4), q, new Vector3(sc, sc * (0.9 + rnd() * 0.25), sc)));
        }
      }
    }
    const inst = new InstancedMesh(m.geo, mat, mats.length);
    mats.forEach((mm, i) => inst.setMatrixAt(i, mm));
    inst.name = `crop_${crop}_x${mats.length}`;
    inst.castShadow = false;
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    game.scene.add(inst);
  }

  // ---- build the chunk meshes
  for (const [name, geos] of chunks) {
    const merged = geos.length ? mergeGeometries(geos, false) : null;
    if (!merged) continue;
    const mesh = new Mesh(merged, mat);
    mesh.name = `outskirts_${name}`;
    mesh.castShadow = mesh.receiveShadow = true;
    game.scene.add(mesh);
  }

  await buildScatter(kit, game);
}
