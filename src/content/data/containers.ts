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
  // Themed types by place (see CONTAINER_THEMES). Locked ones need a lockpick or a crowbar (data/containers LOCKPICK).
  { id: 'gas_shelf', grid: { w: 5, h: 4 }, searchSeconds: 2, lootTable: 'gas_station_shelf', tier: 1, lock: 0 },
  { id: 'gas_register', grid: { w: 4, h: 2 }, searchSeconds: 1.5, lootTable: 'gas_station_register', tier: 2, lock: 1 },
  { id: 'farm_shed', grid: { w: 6, h: 4 }, searchSeconds: 2.5, lootTable: 'farm_barn', tier: 1, lock: 0 },
  { id: 'kitchen_cupboard', grid: { w: 5, h: 3 }, searchSeconds: 2, lootTable: 'house_kitchen', tier: 1, lock: 0 },
  { id: 'nightstand', grid: { w: 3, h: 3 }, searchSeconds: 1.5, lootTable: 'house_bedroom', tier: 1, lock: 0 },
  { id: 'bathroom_cabinet', grid: { w: 3, h: 3 }, searchSeconds: 1.5, lootTable: 'bathroom_cabinet', tier: 1, lock: 0 },
  { id: 'pharmacy_shelf', grid: { w: 6, h: 4 }, searchSeconds: 3, lootTable: 'pharmacy_shelf', tier: 2, lock: 0 },
  { id: 'police_locker', grid: { w: 4, h: 5 }, searchSeconds: 2.5, lootTable: 'police_locker', tier: 3, lock: 1 },
  { id: 'military_footlocker', grid: { w: 6, h: 3 }, searchSeconds: 3, lootTable: 'military_footlocker', tier: 3, lock: 2 },
  { id: 'camp_stash', grid: { w: 5, h: 4 }, searchSeconds: 2.5, lootTable: 'camp_stash', tier: 1, lock: 0 },
  { id: 'garage_shelf', grid: { w: 6, h: 4 }, searchSeconds: 2.5, lootTable: 'garage_shelf', tier: 1, lock: 0 },
  { id: 'school_locker', grid: { w: 3, h: 5 }, searchSeconds: 2, lootTable: 'school_locker', tier: 1, lock: 1 },
  { id: 'office_desk', grid: { w: 4, h: 3 }, searchSeconds: 2, lootTable: 'office_desk', tier: 1, lock: 0 },
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

/**
 * Which container types belong in which kind of place, so the environment can fill a POI from a theme tag.
 * Pick 1-2 of each listed type per room-sized area; the first entry is the common one, the last is the prize.
 */
export const CONTAINER_THEMES: Record<string, string[]> = {
  gas_station: ['gas_shelf', 'gas_register', 'car_trunk', 'garage_shelf'],
  farm: ['farm_shed', 'kitchen_cupboard', 'wardrobe', 'tool_box', 'car_trunk'],
  house: ['kitchen_cupboard', 'nightstand', 'wardrobe', 'bathroom_cabinet', 'food_cupboard'],
  police: ['police_locker', 'office_desk', 'cabinet_locked', 'car_trunk'],
  military: ['military_footlocker', 'military_crate', 'cabinet_locked'],
  camp: ['camp_stash', 'duffel', 'car_trunk'],
  medical: ['pharmacy_shelf', 'medical_cabinet', 'bathroom_cabinet'],
  garage: ['garage_shelf', 'tool_box', 'crate_wood', 'car_trunk'],
  school: ['school_locker', 'office_desk', 'food_cupboard'],
  office: ['office_desk', 'kitchen_cupboard', 'cabinet_metal'],
  road: ['car_trunk', 'duffel', 'crate_wood', 'camp_stash'],
  diner: ['kitchen_cupboard', 'food_cupboard', 'office_desk', 'car_trunk'],
  ranger: ['military_footlocker', 'office_desk', 'military_crate', 'car_trunk'],
};

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
