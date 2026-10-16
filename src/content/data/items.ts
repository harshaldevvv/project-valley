import type { ItemDef } from './types';

/**
 * Item table. Footprints follow principles §8 (pistol 2x1, rifle 5x2, ammo/bandage/can 1x1).
 * Stacks follow the the reference game teardown (§2), ammo capped at 60 per principles §8.
 * A new item is a new row here plus its text in src/content/text/items.ts.
 */
const list: ItemDef[] = [
  // Weapons (stats live in the weapon table; here only inventory data).
  { id: 'pistol_a', kind: 'weapon', w: 2, h: 1, stack: 1, slots: ['sidearm'], iconSwatch: '#5b6166', value: 320 },
  { id: 'rifle_a', kind: 'weapon', w: 5, h: 2, stack: 1, slots: ['primary', 'secondary'], iconSwatch: '#5d5640', value: 950 },
  { id: 'knife_a', kind: 'weapon', w: 2, h: 1, stack: 1, slots: ['melee'], iconSwatch: '#7d8488', value: 40 },
  // Magazines: rounds live on the instance.
  { id: 'mag_pistol_a', kind: 'magazine', w: 1, h: 1, stack: 1, ammo: 'ammo_9mm', capacity: 15, fits: ['pistol_a'], iconSwatch: '#45494c', value: 25 },
  { id: 'mag_rifle_a', kind: 'magazine', w: 1, h: 2, stack: 1, ammo: 'ammo_762', capacity: 30, fits: ['rifle_a'], iconSwatch: '#4a4535', value: 45 },
  { id: 'ammo_9mm', kind: 'ammo', w: 1, h: 1, stack: 60, iconSwatch: '#a8873c', value: 1 },
  { id: 'ammo_762', kind: 'ammo', w: 1, h: 1, stack: 60, iconSwatch: '#9a6d35', value: 2 },
  // Consumables.
  { id: 'bandage', kind: 'medical', w: 1, h: 1, stack: 4, iconSwatch: '#c9c2b0', value: 15, use: { seconds: 2.5, heal: 15, sound: 'search_rustle' } },
  { id: 'canned_beans', kind: 'food', w: 1, h: 1, stack: 3, iconSwatch: '#8e4c3a', value: 12, use: { seconds: 3, food: 25, sound: 'item_pickup' } },
  { id: 'water_bottle', kind: 'drink', w: 1, h: 2, stack: 1, iconSwatch: '#5d86a0', value: 10, use: { seconds: 2, water: 35, sound: 'item_pickup' } },
  // Materials (building costs come from data/build.ts).
  { id: 'wood_planks', kind: 'material', w: 1, h: 2, stack: 20, iconSwatch: '#a7825a', value: 4 },
  { id: 'nails', kind: 'material', w: 1, h: 1, stack: 100, iconSwatch: '#9da1a3', value: 1 },
  { id: 'scrap_metal', kind: 'material', w: 1, h: 1, stack: 20, iconSwatch: '#8a5232', value: 5 },
  { id: 'cloth_rag', kind: 'material', w: 1, h: 1, stack: 10, iconSwatch: '#b0a58c', value: 2 },
  // Tools (only need to be carried; mechanics consumes one to repair the car).
  { id: 'lockpick', kind: 'tool', w: 1, h: 1, stack: 10, iconSwatch: '#8f9aa0', value: 20 },
  { id: 'repair_kit', kind: 'tool', w: 2, h: 1, stack: 1, iconSwatch: '#b5523a', value: 120 },
  // Wearables with storage.
  { id: 'jacket_field', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['torso'], grid: { w: 4, h: 2 }, iconSwatch: '#5d6a48', value: 140 },
  { id: 'backpack_small', kind: 'backpack', w: 3, h: 3, stack: 1, slots: ['backpack'], grid: { w: 4, h: 4 }, iconSwatch: '#6b5a3e', value: 180 },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map((d) => [d.id, d]));

/** Inventory rules (principles §8). Live-tunable from the debug menu. */
export const INVENTORY = {
  /** Backpack inside backpack ("bagception"): on by default. */
  bagception: true,
  /** Vicinity panel: shows ground items within this radius (m), laid out on a grid this wide. */
  vicinityRadius: 3,
  vicinityW: 8,
  /** Dropped items land this far in front of the player, m. */
  dropAhead: 0.7,
  /** Hotbar keys 5..9 bind consumables by item id (the reference game binds by type, not by instance). */
  hotbar: ['bandage', 'canned_beans', 'water_bottle', null, null] as (string | null)[],
  /** Order in which worn grids receive picked-up items. */
  fillOrder: ['torso', 'legs', 'armor', 'backpack'] as const,
};

/** M1 starting kit (worn items are equipped, the rest auto-placed). */
export const STARTING_KIT = {
  equip: { torso: 'jacket_field', backpack: 'backpack_small', melee: 'knife_a' } as Record<string, string>,
  items: [
    { item: 'bandage', count: 2 },
    { item: 'canned_beans', count: 1 },
    { item: 'water_bottle', count: 1 },
    { item: 'wood_planks', count: 10 },
    { item: 'nails', count: 20 },
    { item: 'lockpick', count: 3 },
  ],
};
