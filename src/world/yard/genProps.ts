import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { gltfLoader } from '../../engine/assets';
import { assetUrl } from '../../engine/assetUrl';
import type { Surface } from '../surfaces';
import type { Kit } from './kit';

/**
 * Textured props made with local AI (z-image-turbo picture -> TRELLIS2 mesh -> Blender fit, see
 * tools/audit/ and docs/progress/2026-11-13-overnight.md). Unlike palette models they keep their own baked texture.
 * Each is a unique object with one box collider from its bounding box. A missing file is skipped, never fatal.
 */
interface Prop { id: string; x: number; z: number; yaw: number; surface: Surface; solid?: boolean; shrink?: number }
export const genProps: Prop[] = [
  // survivor camp between the spawn and the build pad
  { id: 'tent_military', x: -20, z: 13, yaw: 0.5, surface: 'wood', solid: true },
  { id: 'generator', x: -15.5, z: 16, yaw: -0.4, surface: 'metal', solid: true },
  { id: 'sandbag_wall', x: -12, z: 9, yaw: 0.2, surface: 'dirt', solid: true },
  { id: 'barrels', x: -24.5, z: 8.5, yaw: 1.1, surface: 'metal', solid: true },
  // junk corner east of the spawn
  { id: 'wreck_sedan', x: 22, z: 12, yaw: -0.6, surface: 'metal', solid: true },
  { id: 'dumpster', x: 29, z: 9.5, yaw: 0.15, surface: 'metal', solid: true },
  { id: 'pallet_stack', x: 15, z: 14.5, yaw: 0.3, surface: 'wood', solid: true },
  // lone dead trees on open lawn
  { id: 'dead_tree', x: -58, z: -52, yaw: 0, surface: 'wood', shrink: 0.4 },
  { id: 'dead_tree', x: 62, z: -62, yaw: 2, surface: 'wood', shrink: 0.4 },
  { id: 'dead_tree', x: -8, z: 62, yaw: 4, surface: 'wood', shrink: 0.4 },
];

export async function buildGenProps(kit: Kit) {
  const cache = new Map<string, Promise<{ scene: import('three').Group } | null>>();
  const load = (id: string) => {
    let p = cache.get(id);
    if (!p) cache.set(id, (p = gltfLoader.loadAsync(assetUrl(`assets/models/gen/${id}.glb`)).catch(() => { console.warn(`gen prop ${id} missing`); return null; })));
    return p;
  };
  for (const p of genProps) {
    const g = await load(p.id);
    if (!g) continue;
    const o = g.scene.clone(true);
    o.traverse((m) => {
      const mesh = m as Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as MeshStandardMaterial;
      mat.roughness = 0.88; mat.metalness = 0; mat.side = 0; // FrontSide
      mesh.castShadow = mesh.receiveShadow = true;
    });
    o.position.set(p.x, 0, p.z);
    o.rotation.y = p.yaw;
    kit.game.scene.add(o);
    o.updateMatrixWorld(true);
    if (p.solid) {
      const b = new Box3().setFromObject(o);
      const s = b.getSize(new Vector3()), c = b.getCenter(new Vector3());
      const k = p.shrink ?? 0.85;
      kit.cuboid((s.x / 2) * k, s.y / 2, (s.z / 2) * k, c.x, c.y, c.z, 0, p.surface);
    } else {
      // trunk only
      kit.cuboid(0.25, 1.5, 0.25, p.x, 1.5, p.z, 0, p.surface);
    }
  }
}
