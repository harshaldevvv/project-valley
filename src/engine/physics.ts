import type RAPIER from '@dimforge/rapier3d-compat';

export type Rapier = typeof RAPIER;

/** Collision groups (principles §13). Membership in the high 16 bits, filter in the low 16. */
export const Group = {
  STATIC: 1 << 0,
  TERRAIN: 1 << 1,
  PLAYER: 1 << 2,
  ZOMBIE: 1 << 3,
  VEHICLE: 1 << 4,
  PROJECTILE: 1 << 5,
  DEBRIS: 1 << 6,
  SENSOR: 1 << 7,
  BUILD: 1 << 8,
} as const;
export const groups = (member: number, filter: number) => ((member & 0xffff) << 16) | (filter & 0xffff);

/** Loads the Rapier WASM (dynamic import keeps it out of the entry chunk) and creates the world. */
export async function createPhysics() {
  const R: Rapier = (await import('@dimforge/rapier3d-compat')).default;
  await R.init();
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  return { R, world };
}
export type Physics = Awaited<ReturnType<typeof createPhysics>>;
