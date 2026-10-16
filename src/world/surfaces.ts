/**
 * Surface tags for static colliders (impacts, footsteps, tyre sounds). Plain data, no three.js.
 *
 *   import { surfaceOf } from '../world/surfaces';
 *   const hit = world.castRay(...);  surfaceOf(hit.collider.handle, px, pz)  // -> 'concrete'
 *
 * Unknown handles (dynamic bodies, build pieces, zombies) return null, so the caller picks its own default.
 * The terrain collider resolves by position: painted pads/roads/lanes win over the base grass.
 */
/** 'chainlink' = see-through mesh panels: they block bodies (STATIC group) but bullets pass (QA-055). */
export type Surface = 'grass' | 'dirt' | 'concrete' | 'wood' | 'metal' | 'rubber' | 'chainlink';

const byHandle = new Map<number, Surface>();
let terrainHandle = -1;
/** Ground regions, last added wins. */
const regions: { test: (x: number, z: number) => boolean; s: Surface }[] = [];

export function surfaceOf(colliderHandle: number, x = 0, z = 0): Surface | null {
  if (colliderHandle === terrainHandle) {
    for (let i = regions.length - 1; i >= 0; i--) if (regions[i].test(x, z)) return regions[i].s;
    return 'grass';
  }
  return byHandle.get(colliderHandle) ?? null;
}

// --- world-side registration ---
export function tagCollider(handle: number, s: Surface) {
  byHandle.set(handle, s);
}
export function tagTerrain(handle: number) {
  terrainHandle = handle;
}
export function addGroundRegion(test: (x: number, z: number) => boolean, s: Surface) {
  regions.push({ test, s });
}

/** Palette swatch -> surface (for painted primitives). */
export function surfaceOfSwatch(swatch: string): Surface {
  if (/^(concrete|asphalt|tile|brick|road_paint|hazard)/.test(swatch)) return 'concrete';
  if (/^(wood|plywood|bark|cardboard)/.test(swatch)) return 'wood';
  if (/^(metal|rust|paint_)/.test(swatch)) return 'metal';
  if (/^(rubber|plastic)/.test(swatch)) return 'rubber';
  if (/^(dirt|mud|rock|sand)/.test(swatch)) return 'dirt';
  return 'grass';
}

/** Asset id -> surface for asset colliders. */
export const assetSurface: Record<string, Surface> = {
  env_wall_concrete_a: 'concrete',
  env_barrier_jersey_a: 'concrete',
  env_pedestal_a: 'concrete',
  env_fence_chainlink_a: 'chainlink',
  env_gate_chainlink_a: 'chainlink',
  env_light_pole_a: 'metal',
  prop_cabinet_metal_a: 'metal',
  prop_target_plate_a: 'metal',
  env_tire_stack_a: 'rubber',
  env_cone_a: 'rubber',
  env_sign_board_a: 'wood',
  env_bench_shooting_a: 'wood',
  prop_crate_wood_a: 'wood',
  prop_weapon_rack_a: 'wood',
  prop_target_dummy_a: 'wood',
  prop_duffel_bag_a: 'dirt', // soft thud
};
