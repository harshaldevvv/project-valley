import { Box3, Object3D, Mesh, Vector3 } from 'three';
import { pfWorldMaterial } from '../../engine/palette';
import { loadPf } from './pfModels';
import type { Surface } from '../surfaces';
import { groundHeight } from './ground';
import type { Kit } from './kit';

/**
 * Props and buildings from the Polyfork catalog (CC BY 4.0, credited in CREDITS.md; see pfModels.ts). The old local-AI-generated
 * ones were dropped on 2026-11-13. Each is a unique object with one box collider from its bounding box.
 * A missing file is skipped, never fatal.
 */
interface Prop { id: string; x: number; z: number; yaw: number; surface: Surface; solid?: boolean; shrink?: number; r?: number; noCollide?: boolean }
export const genProps: Prop[] = [
  // survivor camp between the spawn and the build pad
  { id: 'tent_military', x: -20, z: 13, yaw: 0.5, surface: 'wood', solid: true },
  { id: 'generator', x: -15.5, z: 16, yaw: -0.4, surface: 'metal', solid: true },
  { id: 'sandbag_wall', x: -27, z: 14, yaw: 0.6, surface: 'dirt', solid: true },
  { id: 'barrels', x: -24.5, z: 8.5, yaw: 1.1, surface: 'metal', solid: true },
  // junk corner east of the spawn
  { id: 'wreck_sedan', x: 22, z: 12, yaw: -0.6, surface: 'metal', solid: true, r: 3.4 },
  { id: 'dumpster', x: 29, z: 9.5, yaw: 0.15, surface: 'metal', solid: true },
  { id: 'pallet_stack', x: 18, z: 15, yaw: 0.3, surface: 'wood', solid: true },
  // second batch: camp dressing, junk, a container and tower along the walls, overgrown bushes
  { id: 'campfire', x: -15.5, z: 11.5, yaw: 0, surface: 'dirt', solid: true, shrink: 0.5, r: 1.6 },
  { id: 'crate_stack', x: -22.5, z: 17.5, yaw: -0.3, surface: 'wood', solid: true },
  { id: 'tire_pile', x: 26, z: 17.5, yaw: 0.8, surface: 'rubber', solid: true },
  { id: 'sofa_junk', x: 13, z: 19.5, yaw: 2.6, surface: 'wood', solid: true },
  { id: 'burned_van', x: 66, z: 6, yaw: -0.35, surface: 'metal', solid: true, r: 3.8 },
  { id: 'shipping_container', x: -72, z: 8, yaw: Math.PI / 2, surface: 'metal', solid: true, r: 4.2 },
  { id: 'shipping_container', x: 82, z: -12, yaw: 0.1, surface: 'metal', solid: true, r: 4.2 },
  { id: 'watchtower', x: -78, z: -62, yaw: 0.4, surface: 'wood', solid: true, shrink: 0.45, r: 2.2 },
  ...[[-91, -35], [-88, 52], [-60, 91], [30, 92], [91, 8], [88, -55], [-30, -91], [44, -90], [-91, 20], [60, 91], [-6, 88], [74, 35]].map(([x, z], i): Prop => ({ id: 'bush_overgrown', x, z, yaw: i * 1.7, surface: 'grass', noCollide: true, r: 1.4 })),
  // distant points of interest on the hills outside the walls (no colliders; they sit on the terrain)
  { id: 'barn', x: 150, z: -70, yaw: 2.2, surface: 'wood', noCollide: true, r: 0 },
  { id: 'ruined_house', x: -140, z: 78, yaw: -0.9, surface: 'wood', noCollide: true, r: 0 },
  { id: 'ruined_house', x: 168, z: 52, yaw: 1.9, surface: 'wood', noCollide: true, r: 0 },
  { id: 'gas_station', x: -22, z: 142, yaw: Math.PI, surface: 'concrete', noCollide: true, r: 0 },
  { id: 'small_church', x: -128, z: -125, yaw: 0.8, surface: 'wood', noCollide: true, r: 0 },
  { id: 'water_tower', x: 128, z: 138, yaw: 0.3, surface: 'metal', noCollide: true, r: 0 },
  { id: 'farm_silo', x: -158, z: -28, yaw: 1.1, surface: 'metal', noCollide: true, r: 0 },
  // inside the ruined cabin (cabin.ts)
  { id: 'sofa_junk', x: -74.2, z: -34.4, yaw: 1.7, surface: 'wood', solid: true, r: 1.6 },
  { id: 'crate_stack', x: -69.2, z: -37.6, yaw: 0.4, surface: 'wood', solid: true, r: 1.0 },
  { id: 'barrels', x: -74.3, z: -38.0, yaw: 0.2, surface: 'metal', solid: true, r: 1.2 },
  // lone dead trees on open lawn
  { id: 'dead_tree', x: -58, z: -52, yaw: 0, surface: 'wood', shrink: 0.4 },
  { id: 'dead_tree', x: 84, z: -76, yaw: 2, surface: 'wood', shrink: 0.4 },
  { id: 'dead_tree', x: -8, z: 62, yaw: 4, surface: 'wood', shrink: 0.4 },
];

/** True when x,z is under a prop's footprint (scatter code keeps grass out of them). */
export const underGenProp = (x: number, z: number, pad = 0.4) => genProps.some((p) => Math.hypot(x - p.x, z - p.z) < (p.r ?? (p.solid ? 2.4 : 0.6)) + pad);

export async function buildGenProps(kit: Kit) {
  const cache = new Map<string, Promise<Object3D | null>>();
  const load = (id: string) => {
    let p = cache.get(id);
    if (!p) cache.set(id, (p = loadPf(id)));
    return p;
  };
  const detailMat = await pfWorldMaterial();
  await Promise.all([...new Set(genProps.map((p) => p.id))].map(load)); // fetch all models in parallel, place them in order below
  for (const p of genProps) {
    const g = await load(p.id);
    if (!g) continue;
    const o = g.clone(true);
    o.traverse((m) => {
      const mesh = m as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = mesh.receiveShadow = true;
      if ((mesh.material as { vertexColors?: boolean }).vertexColors) mesh.material = detailMat;
    });
    o.updateMatrixWorld(true);
    const local = new Box3().setFromObject(o); // un-rotated, at the origin
    o.position.set(p.x, p.noCollide && Math.max(Math.abs(p.x), Math.abs(p.z)) > 105 ? groundHeight(p.x, p.z) - 0.2 : 0, p.z);
    o.rotation.y = p.yaw;
    kit.game.scene.add(o);
    if (p.solid) {
      const s = local.getSize(new Vector3()), c = local.getCenter(new Vector3()).applyAxisAngle(new Vector3(0, 1, 0), p.yaw);
      const k = p.shrink ?? 0.85;
      kit.cuboid((s.x / 2) * k, s.y / 2, (s.z / 2) * k, p.x + c.x, c.y, p.z + c.z, p.yaw, p.surface);
    } else if (!p.noCollide) {
      // trunk only
      kit.cuboid(0.25, 1.5, 0.25, p.x, 1.5, p.z, 0, p.surface);
    }
  }
}
