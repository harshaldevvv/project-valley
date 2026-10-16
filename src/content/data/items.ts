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
  // Heavy tools that double as melee (meleeDefs in data/weapons.ts; break-in use later).
  { id: 'crowbar_a', kind: 'weapon', w: 1, h: 3, stack: 1, slots: ['melee'], iconSwatch: '#8a3a2e', value: 60, rarity: 'uncommon' },
  { id: 'hammer_a', kind: 'weapon', w: 1, h: 2, stack: 1, slots: ['melee'], iconSwatch: '#6e5a44', value: 35 },
  // Magazines: rounds live on the instance.
  { id: 'mag_pistol_a', kind: 'magazine', w: 1, h: 1, stack: 1, ammo: 'ammo_9mm', capacity: 15, fits: ['pistol_a'], iconSwatch: '#45494c', value: 25 },
  { id: 'mag_rifle_a', kind: 'magazine', w: 1, h: 2, stack: 1, ammo: 'ammo_762', capacity: 30, fits: ['rifle_a'], iconSwatch: '#4a4535', value: 45 },
  { id: 'ammo_9mm', kind: 'ammo', w: 1, h: 1, stack: 60, iconSwatch: '#a8873c', value: 1 },
  { id: 'ammo_762', kind: 'ammo', w: 1, h: 1, stack: 60, iconSwatch: '#9a6d35', value: 2 },
  // A sealed box: Unpack gives 50 loose rounds.
  { id: 'ammo_9mm_box', kind: 'ammo', w: 2, h: 1, stack: 1, unpack: { item: 'ammo_9mm', count: 50 }, iconSwatch: '#8f7330', value: 55, rarity: 'uncommon' },
  // Consumables.
  // Medical (principles §7: using one takes 2–5 s and can be interrupted).
  { id: 'bandage', kind: 'medical', w: 1, h: 1, stack: 4, iconSwatch: '#c9c2b0', value: 15, use: { seconds: 2.5, heal: 15, sound: 'search_rustle', cures: ['bleeding', 'heavy_bleeding'] } },
  { id: 'medkit', kind: 'medical', w: 2, h: 2, stack: 5, iconSwatch: '#b8443a', value: 90, use: { seconds: 5, heal: 50, sound: 'search_rustle', cures: ['bleeding', 'heavy_bleeding'] } },
  { id: 'splint', kind: 'medical', w: 1, h: 2, stack: 2, iconSwatch: '#a88c5c', value: 30, use: { seconds: 4, sound: 'search_rustle', cures: ['fracture'] } },
  { id: 'antibiotics', kind: 'medical', w: 1, h: 1, stack: 5, iconSwatch: '#d9d4c0', value: 45, use: { seconds: 2, sound: 'item_pickup', cures: ['infection'], infectionMaxStage: 2 } },
  { id: 'ifak', kind: 'medical', w: 2, h: 1, stack: 2, iconSwatch: '#5d6a48', value: 60, rarity: 'uncommon', use: { seconds: 3.5, heal: 25, sound: 'search_rustle', cures: ['bleeding', 'heavy_bleeding'] } },
  { id: 'painkillers', kind: 'medical', w: 1, h: 1, stack: 5, iconSwatch: '#e0e0d8', value: 25, use: { seconds: 2, heal: 5, stamina: 40, sound: 'item_pickup' } },
  { id: 'antiviral', kind: 'medical', w: 1, h: 1, stack: 1, iconSwatch: '#5fa3b8', value: 400, rarity: 'rare', use: { seconds: 3, sound: 'item_pickup', cures: ['infection'] } },
  // Food and drink.
  { id: 'canned_beans', kind: 'food', w: 1, h: 1, stack: 3, iconSwatch: '#8e4c3a', value: 12, use: { seconds: 3, food: 25, sound: 'item_pickup' } },
  { id: 'energy_bar', kind: 'food', w: 1, h: 1, stack: 5, iconSwatch: '#c9a04a', value: 8, use: { seconds: 2, food: 12, sound: 'item_pickup' } },
  { id: 'canned_soup', kind: 'food', w: 1, h: 1, stack: 3, iconSwatch: '#b36a3a', value: 14, use: { seconds: 3, food: 30, water: 10, sound: 'item_pickup' } },
  { id: 'canned_tuna', kind: 'food', w: 1, h: 1, stack: 3, iconSwatch: '#7a8fa0', value: 14, use: { seconds: 2.5, food: 22, sound: 'item_pickup' } },
  { id: 'mre', kind: 'food', w: 1, h: 2, stack: 3, iconSwatch: '#6b6a3e', value: 40, rarity: 'uncommon', use: { seconds: 4, food: 50, water: 25, stamina: 15, sound: 'item_pickup' } },
  { id: 'energy_drink', kind: 'drink', w: 1, h: 1, stack: 1, iconSwatch: '#3a8f5a', value: 15, use: { seconds: 2, water: 20, stamina: 60, sound: 'item_pickup' } },
  { id: 'canteen', kind: 'drink', w: 1, h: 2, stack: 1, iconSwatch: '#55603f', value: 30, use: { seconds: 2.5, water: 45, sound: 'item_pickup' } },
  { id: 'water_bottle', kind: 'drink', w: 1, h: 2, stack: 1, iconSwatch: '#5d86a0', value: 10, use: { seconds: 2, water: 35, sound: 'item_pickup' } },
  // Materials (building costs come from data/build.ts).
  { id: 'wood_planks', kind: 'material', w: 1, h: 2, stack: 20, iconSwatch: '#a7825a', value: 4 },
  { id: 'nails', kind: 'material', w: 1, h: 1, stack: 100, iconSwatch: '#9da1a3', value: 1 },
  { id: 'scrap_metal', kind: 'material', w: 1, h: 1, stack: 20, iconSwatch: '#8a5232', value: 5 },
  // Rags patch a light bleed in a pinch (research: rags 10 HP).
  { id: 'cloth_rag', kind: 'material', w: 1, h: 1, stack: 10, iconSwatch: '#b0a58c', value: 2, use: { seconds: 3, heal: 5, sound: 'search_rustle', cures: ['bleeding'] } },
  { id: 'cloth', kind: 'material', w: 1, h: 1, stack: 20, iconSwatch: '#8f8a78', value: 3 },
  { id: 'duct_tape', kind: 'material', w: 1, h: 1, stack: 5, iconSwatch: '#9da3a6', value: 8 },
  { id: 'rope', kind: 'material', w: 1, h: 2, stack: 3, iconSwatch: '#a8915e', value: 6 },
  { id: 'electronic_parts', kind: 'material', w: 1, h: 1, stack: 10, iconSwatch: '#3d6b4a', value: 15, rarity: 'uncommon' },
  { id: 'gunpowder', kind: 'material', w: 1, h: 1, stack: 50, iconSwatch: '#3b3b3b', value: 4, rarity: 'uncommon' },
  { id: 'metal_pipe', kind: 'material', w: 1, h: 3, stack: 5, iconSwatch: '#7c8084', value: 6 },
  // Tools (only need to be carried; mechanics consumes one to repair the car).
  { id: 'lockpick', kind: 'tool', w: 1, h: 1, stack: 10, iconSwatch: '#8f9aa0', value: 20 },
  { id: 'repair_kit', kind: 'tool', w: 2, h: 1, stack: 1, iconSwatch: '#b5523a', value: 120, rarity: 'uncommon' },
  { id: 'wrench', kind: 'tool', w: 1, h: 2, stack: 1, iconSwatch: '#8d9396', value: 25 },
  { id: 'flashlight_a', kind: 'tool', w: 1, h: 2, stack: 1, iconSwatch: '#2f3437', value: 35 },
  // Valuables.
  { id: 'cash', kind: 'valuable', w: 1, h: 1, stack: 5000, iconSwatch: '#5f8a4a', value: 1 },
  { id: 'wallet', kind: 'container', w: 1, h: 1, stack: 1, pockets: [{ w: 2, h: 3, accepts: ['valuable', 'tool'] }], iconSwatch: '#5a4030', value: 10 },
  // Small containers (footprint < storage; each only takes its own kind of goods).
  { id: 'lunchbox', kind: 'container', w: 2, h: 2, stack: 1, pockets: [{ w: 3, h: 3, accepts: ['food', 'drink'] }], iconSwatch: '#b5463a', value: 25 },
  { id: 'medical_bag', kind: 'container', w: 2, h: 2, stack: 1, pockets: [{ w: 4, h: 4, accepts: ['medical'] }], iconSwatch: '#c94a3f', value: 70, rarity: 'uncommon' },
  { id: 'ammo_tin', kind: 'container', w: 2, h: 2, stack: 1, pockets: [{ w: 3, h: 3, accepts: ['ammo', 'magazine'] }], iconSwatch: '#55603f', value: 45, rarity: 'uncommon' },
  // Wearables with storage.
  { id: 'jacket_field', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['torso'], grid: { w: 4, h: 2 }, iconSwatch: '#5d6a48', value: 140 },
  { id: 'hoodie', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['torso'], pockets: [{ w: 2, h: 1 }, { w: 2, h: 1 }], iconSwatch: '#5a5f6b', value: 60 },
  { id: 'military_jacket', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['torso'], pockets: [{ w: 2, h: 2 }, { w: 2, h: 2 }, { w: 1, h: 2 }, { w: 1, h: 2 }], iconSwatch: '#4f5a3a', value: 220, rarity: 'uncommon' },
  { id: 'cargo_pants', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['legs'], pockets: [{ w: 2, h: 2 }, { w: 2, h: 2 }], iconSwatch: '#6b6450', value: 90 },
  // Rig: four mag pouches that take magazines only, plus a small admin pouch.
  { id: 'tactical_vest', kind: 'clothing', w: 3, h: 3, stack: 1, slots: ['armor'], armour: 2, rarity: 'rare',
    pockets: [{ w: 1, h: 2, accepts: ['magazine'] }, { w: 1, h: 2, accepts: ['magazine'] }, { w: 1, h: 2, accepts: ['magazine'] }, { w: 1, h: 2, accepts: ['magazine'] }, { w: 2, h: 2 }],
    iconSwatch: '#3f4a32', value: 380 },
  // Headwear, face, eyes (worn; stats later except armour).
  { id: 'beanie', kind: 'clothing', w: 2, h: 1, stack: 1, slots: ['head'], iconSwatch: '#7a2f2a', value: 12 },
  { id: 'cap', kind: 'clothing', w: 2, h: 1, stack: 1, slots: ['head'], iconSwatch: '#2f4a6b', value: 10 },
  { id: 'helmet_military', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['head'], armour: 3, rarity: 'rare', iconSwatch: '#4a5238', value: 300 },
  { id: 'gas_mask', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['face'], rarity: 'uncommon', iconSwatch: '#33383a', value: 150 },
  { id: 'glasses', kind: 'clothing', w: 1, h: 1, stack: 1, slots: ['eyes'], iconSwatch: '#222628', value: 15 },
  { id: 'secure_pouch', kind: 'misc', w: 2, h: 2, stack: 1, slots: ['pouch'], grid: { w: 2, h: 2 }, iconSwatch: '#3f4a3a', value: 0 },
  // Backpacks: footprint < storage (research section 2). Alice has side pockets; the lab pack is rare.
  { id: 'backpack_small', kind: 'backpack', w: 3, h: 3, stack: 1, slots: ['backpack'], grid: { w: 4, h: 4 }, iconSwatch: '#6b5a3e', value: 180 },
  { id: 'school_bag', kind: 'backpack', w: 3, h: 3, stack: 1, slots: ['backpack'], grid: { w: 4, h: 4 }, iconSwatch: '#3a5f8a', value: 120 },
  { id: 'hiking_pack', kind: 'backpack', w: 3, h: 4, stack: 1, slots: ['backpack'], grid: { w: 5, h: 5 }, iconSwatch: '#8a5a2e', value: 260 },
  { id: 'military_pack', kind: 'backpack', w: 3, h: 4, stack: 1, slots: ['backpack'], grid: { w: 5, h: 6 }, rarity: 'uncommon', iconSwatch: '#4f5a3a', value: 340 },
  { id: 'alice_pack', kind: 'backpack', w: 4, h: 4, stack: 1, slots: ['backpack'], grid: { w: 6, h: 6 }, pockets: [{ w: 2, h: 4 }, { w: 2, h: 4 }], rarity: 'rare', iconSwatch: '#5d6a48', value: 520 },
  { id: 'large_hiking_pack', kind: 'backpack', w: 4, h: 5, stack: 1, slots: ['backpack'], grid: { w: 6, h: 7 }, rarity: 'rare', iconSwatch: '#6b3a2e', value: 600 },
  { id: 'laboratory_pack', kind: 'backpack', w: 5, h: 6, stack: 1, slots: ['backpack'], grid: { w: 7, h: 8 }, rarity: 'epic', iconSwatch: '#c9c4b0', value: 1100 },
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
  equip: { torso: 'jacket_field', backpack: 'backpack_small', melee: 'knife_a', pouch: 'secure_pouch' } as Record<string, string>,
  items: [
    { item: 'bandage', count: 3 },
    { item: 'canned_beans', count: 2 },
    { item: 'water_bottle', count: 2 },
    { item: 'splint', count: 1 },
    { item: 'wood_planks', count: 10 },
    { item: 'nails', count: 20 },
    { item: 'lockpick', count: 3 },
  ],
};
