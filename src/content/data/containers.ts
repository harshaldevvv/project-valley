import type { ContainerDef } from './types';

/** World container types (environment places these by `type`; mechanics registers the vehicle trunk). */
const list: ContainerDef[] = [
  { id: 'crate_wood', grid: { w: 6, h: 4 }, searchSeconds: 2.5, lootTable: 'crate_wood', lock: 0 },
  { id: 'cabinet_metal', grid: { w: 5, h: 6 }, searchSeconds: 3.5, lootTable: 'cabinet_metal', lock: 0 },
  { id: 'duffel', grid: { w: 6, h: 4 }, searchSeconds: 2, lootTable: 'duffel', lock: 0 },
  // Sandbox rack: fixed kit, refilled on every open (an M1-only faucet, never ship it to the real world).
  { id: 'weapon_rack', grid: { w: 8, h: 6 }, searchSeconds: 0, lootTable: 'weapon_rack', lock: 0, refillOnOpen: true },
  { id: 'trunk_pickup', grid: { w: 8, h: 5 }, searchSeconds: 0, lootTable: 'empty', lock: 0 },
];

export const CONTAINERS: Record<string, ContainerDef> = Object.fromEntries(list.map((d) => [d.id, d]));
