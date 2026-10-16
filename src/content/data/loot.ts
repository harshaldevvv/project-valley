import type { LootTable, Rarity } from './types';

/**
 * Loot tables (principles §9): POI-themed, at least 60% of each table's weight is items specific to that kind of place;
 * the rest rolls the shared `common_junk` table. Item weights are scaled by rarity for the container's zone tier.
 * Container types point at these tables (data/containers.ts). Magazines rolled here spawn partly filled.
 */

/** Rarity % per zone tier (principles §9). World containers cap at Epic; legendaries come from bosses/quests. */
export const RARITY_BY_TIER: Record<number, Record<Rarity, number>> = {
  1: { common: 70, uncommon: 25, rare: 5, epic: 0, legendary: 0 },
  2: { common: 55, uncommon: 30, rare: 12, epic: 3, legendary: 0 },
  3: { common: 45, uncommon: 32, rare: 17, epic: 5.5, legendary: 0 },
  4: { common: 35, uncommon: 33, rare: 22, epic: 9, legendary: 0 },
  5: { common: 25, uncommon: 33, rare: 27, epic: 13, legendary: 0 },
};

/** Weight multiplier for an item of `rarity` in a tier-`tier` container (common = 1 at every tier). */
export function rarityMul(tier: number, rarity: Rarity = 'common') {
  const t = RARITY_BY_TIER[Math.min(5, Math.max(1, Math.round(tier)))];
  return t[rarity] / t.common;
}

/** Weight given to the shared junk table inside a themed table (keeps the themed share >= 60%). */
const JUNK = 25;

const list: LootTable[] = [
  { id: 'empty', rolls: [0, 0], entries: [] },
  {
    // Shared filler, rolled from inside the themed tables.
    id: 'common_junk',
    rolls: [1, 1],
    entries: [
      { item: 'cloth_rag', weight: 25, count: [1, 3] },
      { item: 'scrap_metal', weight: 20, count: [1, 3] },
      { item: 'duct_tape', weight: 10, count: [1, 1] },
      { item: 'cash', weight: 15, count: [5, 40] },
      { item: 'energy_bar', weight: 12, count: [1, 2] },
      { item: 'cloth', weight: 10, count: [1, 4] },
      { item: 'lockpick', weight: 8, count: [1, 1] },
    ],
  },
  {
    id: 'tool_box',
    tier: 1,
    rolls: [2, 4],
    entries: [
      { item: 'wood_planks', weight: 25, count: [2, 6] },
      { item: 'nails', weight: 25, count: [5, 20] },
      { item: 'scrap_metal', weight: 15, count: [1, 4] },
      { item: 'duct_tape', weight: 12, count: [1, 2] },
      { item: 'rope', weight: 8, count: [1, 1] },
      { item: 'metal_pipe', weight: 8, count: [1, 2] },
      { item: 'wrench', weight: 6, count: [1, 1] },
      { item: 'hammer_a', weight: 5, count: [1, 1] },
      { item: 'crowbar_a', weight: 4, count: [1, 1] },
      { item: 'electronic_parts', weight: 5, count: [1, 2] },
      { item: 'repair_kit', weight: 4, count: [1, 1] },
      { item: 'flashlight_a', weight: 4, count: [1, 1] },
      { item: 'lockpick', weight: 5, count: [1, 2] },
      { table: 'common_junk', weight: JUNK, count: [1, 1] },
    ],
  },
  {
    id: 'medical_cabinet',
    tier: 2,
    rolls: [2, 4],
    entries: [
      { item: 'bandage', weight: 30, count: [1, 3] },
      { item: 'painkillers', weight: 18, count: [1, 3] },
      { item: 'antibiotics', weight: 12, count: [1, 2] },
      { item: 'splint', weight: 10, count: [1, 1] },
      { item: 'ifak', weight: 8, count: [1, 1] },
      { item: 'medkit', weight: 6, count: [1, 1] },
      { item: 'medical_bag', weight: 4, count: [1, 1] },
      { item: 'antiviral', weight: 3, count: [1, 1] },
      { item: 'water_bottle', weight: 8, count: [1, 1] },
      { table: 'common_junk', weight: JUNK, count: [1, 1] },
    ],
  },
  {
    id: 'military_crate',
    tier: 3,
    rolls: [3, 5],
    entries: [
      { item: 'ammo_762', weight: 22, count: [15, 40] },
      { item: 'ammo_9mm', weight: 18, count: [15, 40] },
      { item: 'ammo_9mm_box', weight: 8, count: [1, 1] },
      { item: 'mag_rifle_a', weight: 12, count: [1, 1] },
      { item: 'mag_pistol_a', weight: 10, count: [1, 1] },
      { item: 'mre', weight: 10, count: [1, 2] },
      { item: 'ifak', weight: 8, count: [1, 1] },
      { item: 'gunpowder', weight: 6, count: [5, 20] },
      { item: 'ammo_tin', weight: 5, count: [1, 1] },
      { item: 'military_jacket', weight: 4, count: [1, 1] },
      { item: 'military_pack', weight: 4, count: [1, 1] },
      { item: 'tactical_vest', weight: 3, count: [1, 1] },
      { item: 'helmet_military', weight: 3, count: [1, 1] },
      { item: 'gas_mask', weight: 3, count: [1, 1] },
      { item: 'alice_pack', weight: 2, count: [1, 1] },
      { item: 'antiviral', weight: 1, count: [1, 1] },
      { item: 'pistol_a', weight: 3, count: [1, 1] },
      { table: 'common_junk', weight: JUNK, count: [1, 1] },
    ],
  },
  {
    id: 'civilian_wardrobe',
    tier: 1,
    rolls: [2, 3],
    entries: [
      { item: 'hoodie', weight: 15, count: [1, 1] },
      { item: 'cargo_pants', weight: 12, count: [1, 1] },
      { item: 'jacket_field', weight: 6, count: [1, 1] },
      { item: 'beanie', weight: 10, count: [1, 1] },
      { item: 'cap', weight: 10, count: [1, 1] },
      { item: 'glasses', weight: 6, count: [1, 1] },
      { item: 'school_bag', weight: 8, count: [1, 1] },
      { item: 'backpack_small', weight: 5, count: [1, 1] },
      { item: 'hiking_pack', weight: 5, count: [1, 1] },
      { item: 'large_hiking_pack', weight: 3, count: [1, 1] },
      { item: 'wallet', weight: 8, count: [1, 1] },
      { item: 'cash', weight: 8, count: [10, 120] },
      { item: 'cloth', weight: 10, count: [2, 6] },
      { table: 'common_junk', weight: JUNK, count: [1, 1] },
    ],
  },
  {
    id: 'food_cupboard',
    tier: 1,
    rolls: [2, 4],
    entries: [
      { item: 'canned_beans', weight: 20, count: [1, 3] },
      { item: 'canned_soup', weight: 18, count: [1, 2] },
      { item: 'canned_tuna', weight: 15, count: [1, 2] },
      { item: 'energy_bar', weight: 12, count: [1, 3] },
      { item: 'water_bottle', weight: 15, count: [1, 2] },
      { item: 'energy_drink', weight: 8, count: [1, 1] },
      { item: 'canteen', weight: 4, count: [1, 1] },
      { item: 'mre', weight: 3, count: [1, 1] },
      { item: 'lunchbox', weight: 5, count: [1, 1] },
      { table: 'common_junk', weight: JUNK, count: [1, 1] },
    ],
  },
  {
    id: 'car_trunk',
    tier: 1,
    rolls: [1, 3],
    entries: [
      { item: 'repair_kit', weight: 10, count: [1, 1] },
      { item: 'wrench', weight: 10, count: [1, 1] },
      { item: 'duct_tape', weight: 12, count: [1, 2] },
      { item: 'rope', weight: 10, count: [1, 1] },
      { item: 'water_bottle', weight: 12, count: [1, 2] },
      { item: 'flashlight_a', weight: 8, count: [1, 1] },
      { item: 'crowbar_a', weight: 5, count: [1, 1] },
      { item: 'energy_drink', weight: 8, count: [1, 1] },
      { item: 'metal_pipe', weight: 6, count: [1, 1] },
      { item: 'canteen', weight: 5, count: [1, 1] },
      { table: 'common_junk', weight: JUNK, count: [1, 1] },
    ],
  },
  {
    id: 'body_survivor',
    tier: 1,
    rolls: [2, 4],
    entries: [
      { item: 'bandage', weight: 20, count: [1, 2] },
      { item: 'mag_pistol_a', weight: 12, count: [1, 1] },
      { item: 'ammo_9mm', weight: 12, count: [5, 15] },
      { item: 'canned_beans', weight: 8, count: [1, 1] },
      { item: 'wallet', weight: 10, count: [1, 1] },
      { item: 'lockpick', weight: 8, count: [1, 2] },
      { item: 'painkillers', weight: 8, count: [1, 2] },
      { item: 'antibiotics', weight: 5, count: [1, 1] },
      { item: 'splint', weight: 5, count: [1, 1] },
      { item: 'repair_kit', weight: 4, count: [1, 1] },
      { table: 'common_junk', weight: JUNK, count: [1, 1] },
    ],
  },
  {
    // Zombie corpses: small and mostly junk (a bit of what they carried in life).
    id: 'body_zombie',
    tier: 1,
    rolls: [0, 2],
    entries: [
      { item: 'cloth_rag', weight: 30, count: [1, 2] },
      { item: 'cash', weight: 15, count: [2, 25] },
      { item: 'wallet', weight: 5, count: [1, 1] },
      { item: 'ammo_9mm', weight: 10, count: [3, 8] },
      { item: 'bandage', weight: 8, count: [1, 1] },
      { item: 'mag_pistol_a', weight: 3, count: [1, 1] },
      { table: 'common_junk', weight: 20, count: [1, 1] },
    ],
  },
  {
    id: 'body_zombie_soldier',
    tier: 2,
    rolls: [1, 2],
    entries: [
      { item: 'ammo_762', weight: 35, count: [5, 15] },
      { item: 'mag_rifle_a', weight: 12, count: [1, 1] },
      { item: 'ifak', weight: 8, count: [1, 1] },
      { item: 'mre', weight: 10, count: [1, 1] },
      { item: 'helmet_military', weight: 2, count: [1, 1] },
      { item: 'bandage', weight: 15, count: [1, 2] },
      { table: 'common_junk', weight: 20, count: [1, 1] },
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
