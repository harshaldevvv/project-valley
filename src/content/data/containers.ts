import type { ContainerDef } from './types';

/** World container types (environment places these by `type`; mechanics registers the vehicle trunk). */
const list: ContainerDef[] = [
  // Yard containers, each mapped to a POI-themed table and a zone tier (principles §9).
  { id: 'crate_wood', grid: { w: 6, h: 4 }, searchSeconds: 2.5, lootTable: 'tool_box', tier: 1, lock: 0 },
  { id: 'cabinet_metal', grid: { w: 5, h: 6 }, searchSeconds: 3.5, lootTable: 'medical_cabinet', tier: 2, lock: 0 },
  { id: 'duffel', grid: { w: 6, h: 4 }, searchSeconds: 2, lootTable: 'civilian_wardrobe', tier: 1, lock: 0 },
  { id: 'cabinet_locked', grid: { w: 5, h: 6 }, searchSeconds: 1.5, lootTable: 'military_crate', tier: 3, lock: 1 },
  // Themed types for the open world (environment places these; models can reuse crate/cabinet until new ones exist).
  { id: 'tool_box', grid: { w: 5, h: 3 }, searchSeconds: 2, lootTable: 'tool_box', tier: 1, lock: 0 },
  { id: 'medical_cabinet', grid: { w: 5, h: 5 }, searchSeconds: 3, lootTable: 'medical_cabinet', tier: 2, lock: 0 },
  { id: 'military_crate', grid: { w: 6, h: 4 }, searchSeconds: 3, lootTable: 'military_crate', tier: 3, lock: 0 },
  { id: 'wardrobe', grid: { w: 5, h: 7 }, searchSeconds: 3, lootTable: 'civilian_wardrobe', tier: 1, lock: 0 },
  { id: 'food_cupboard', grid: { w: 5, h: 4 }, searchSeconds: 2, lootTable: 'food_cupboard', tier: 1, lock: 0 },
  { id: 'car_trunk', grid: { w: 8, h: 5 }, searchSeconds: 2, lootTable: 'car_trunk', tier: 1, lock: 0 },
  // Sandbox rack: fixed kit, refilled on every open (an M1-only faucet, never ship it to the real world).
  { id: 'weapon_rack', grid: { w: 8, h: 6 }, searchSeconds: 0, lootTable: 'weapon_rack', lock: 0, refillOnOpen: true },
  // Bodies (searchable). Zombie corpses register at runtime from the zombieKilled event.
  { id: 'body_survivor', grid: { w: 5, h: 4 }, searchSeconds: 3, lootTable: 'body_survivor', lock: 0 },
  { id: 'body_zombie', grid: { w: 4, h: 3 }, searchSeconds: 2, lootTable: 'body_zombie', lock: 0 },
  { id: 'body_zombie_soldier', grid: { w: 4, h: 3 }, searchSeconds: 2, lootTable: 'body_zombie_soldier', lock: 0 },
  // Death bag (principles §12): what you lose on death waits at the spot.
  { id: 'death_bag', grid: { w: 10, h: 8 }, searchSeconds: 0, lootTable: 'empty', lock: 0 },
  // The player's pickup truck bed: storage, starts empty.
  { id: 'trunk_pickup', grid: { w: 8, h: 5 }, searchSeconds: 0, lootTable: 'empty', lock: 0 },
];

export const CONTAINERS: Record<string, ContainerDef> = Object.fromEntries(list.map((d) => [d.id, d]));

/** Interaction reach for containers (QA-061): measured from the player's chest to the container's top centre,
 *  plus half its footprint, so big and small containers feel the same. */
export const CONTAINER_INTERACT = {
  reach: 2.2,
  maxPointHeight: 1.2,
  /** Bodies lie on the ground among fights: a short reach from the torso so they don't steal nearby prompts (QA-070). */
  bodyReach: 1.4,
  /** Interact point height above the body's ground position, m. */
  bodyPointHeight: 0.3,
  /** The interact picker measures from the player's chest (gameplay/interact: feet + 1.2 m); bodyReach is horizontal. */
  chestHeight: 1.2,
};

/** Zombie variant -> body container type (variants not listed use body_zombie). */
export const BODY_BY_VARIANT: Record<string, string> = { soldier: 'body_zombie_soldier' };

/**
 * Lockpicking minigame (classic Skyrim-style). The pick angle is 0..180° across the top of the lock;
 * a hidden sweet spot per attempt. Closer to it = the cylinder turns further. Forcing it builds stress.
 */
export const LOCKPICK = {
  /** Half-width of the sweet spot in degrees, by lock difficulty (container `lock`). */
  sweetHalfDeg: { 1: 9, 2: 6, 3: 3.5 } as Record<number, number>,
  /** Beyond the sweet spot the allowed turn falls to 0 over this many degrees. */
  falloffDeg: 45,
  /** Seconds of forcing a stuck cylinder before the pick breaks. */
  stressSeconds: 1.2,
  /** Cylinder turn speed while held (fraction of a full turn per second) and spring-back speed. */
  turnSpeed: 1.1,
  returnSpeed: 2.5,
  /** Full turn, degrees (cylinder rotation that opens the lock). */
  fullTurnDeg: 90,
};
