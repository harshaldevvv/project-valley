import type { LootTable } from './types';

/**
 * Loot tables (principles §9). M1 tables are per container type; POI -> container -> category nesting
 * arrives with the open world (M3). Magazines rolled here spawn partly filled.
 */
const list: LootTable[] = [
  { id: 'empty', rolls: [0, 0], entries: [] },
  {
    id: 'crate_wood',
    rolls: [2, 4],
    entries: [
      { item: 'wood_planks', weight: 30, count: [2, 6] },
      { item: 'nails', weight: 30, count: [5, 20] },
      { item: 'scrap_metal', weight: 20, count: [1, 4] },
      { item: 'cloth_rag', weight: 15, count: [1, 3] },
      { item: 'canned_beans', weight: 10, count: [1, 2] },
    ],
  },
  {
    id: 'cabinet_metal',
    rolls: [2, 4],
    entries: [
      { item: 'bandage', weight: 25, count: [1, 3] },
      { item: 'ammo_9mm', weight: 25, count: [8, 24] },
      { item: 'ammo_762', weight: 15, count: [6, 18] },
      { item: 'mag_pistol_a', weight: 12, count: [1, 1] },
      { item: 'mag_rifle_a', weight: 6, count: [1, 1] },
      { item: 'water_bottle', weight: 12, count: [1, 1] },
      { item: 'scrap_metal', weight: 10, count: [1, 3] },
    ],
  },
  {
    id: 'duffel',
    rolls: [2, 3],
    entries: [
      { item: 'backpack_small', weight: 10, count: [1, 1] },
      { item: 'jacket_field', weight: 10, count: [1, 1] },
      { item: 'canned_beans', weight: 20, count: [1, 2] },
      { item: 'water_bottle', weight: 20, count: [1, 1] },
      { item: 'bandage', weight: 15, count: [1, 2] },
      { item: 'cloth_rag', weight: 15, count: [1, 4] },
      { item: 'pistol_a', weight: 4, count: [1, 1] },
    ],
  },
  {
    id: 'weapon_rack',
    rolls: [0, 0],
    entries: [],
    guaranteed: [
      { item: 'rifle_a', count: 1, rounds: -1 }, // loaded
      { item: 'pistol_a', count: 1, rounds: -1 },
      { item: 'mag_rifle_a', count: 3, rounds: -1 },
      { item: 'mag_pistol_a', count: 3, rounds: -1 },
      { item: 'ammo_762', count: 60 },
      { item: 'ammo_762', count: 60 },
      { item: 'ammo_9mm', count: 60 },
      { item: 'ammo_9mm', count: 60 },
    ],
  },
];

export const LOOT: Record<string, LootTable> = Object.fromEntries(list.map((t) => [t.id, t]));
