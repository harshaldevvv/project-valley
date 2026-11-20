import type { ItemDef } from './types';

/**
 * Item table, guns (spread into ITEMS by items.ts): the M4 gun-depth weapons, their magazines and ammo.
 * Weapon stats: data/weapons_guns.ts. Text: src/content/text/items_guns.ts. Models: tools/audit/build_guns.mjs.
 * Shell carrier, stripper clip and speedloader are magazine items so the existing reload flow works unchanged.
 */
export const GUN_ITEMS: ItemDef[] = [
  { id: 'shotgun_a', kind: 'weapon', w: 5, h: 2, stack: 1, slots: ['primary', 'secondary'], model: 'wpn_shotgun_a', rarity: 'uncommon', iconSwatch: '#4a4f5a', value: 650 },
  { id: 'bolt_a', kind: 'weapon', w: 6, h: 2, stack: 1, slots: ['primary', 'secondary'], model: 'wpn_bolt_a', rarity: 'rare', iconSwatch: '#7a5a34', value: 1100 },
  { id: 'smg_a', kind: 'weapon', w: 4, h: 2, stack: 1, slots: ['primary', 'secondary'], model: 'wpn_smg_a', rarity: 'rare', iconSwatch: '#2f3338', value: 820 },
  { id: 'revolver_a', kind: 'weapon', w: 2, h: 1, stack: 1, slots: ['sidearm'], model: 'wpn_revolver_a', rarity: 'uncommon', iconSwatch: '#6b6f75', value: 480 },
  { id: 'mag_shotgun_a', kind: 'magazine', w: 2, h: 1, stack: 1, ammo: 'ammo_12ga', capacity: 6, fits: ['shotgun_a'], model: 'wpn_mag_shotgun_a', iconSwatch: '#a83a2e', value: 20 },
  { id: 'mag_bolt_a', kind: 'magazine', w: 1, h: 1, stack: 1, ammo: 'ammo_308', capacity: 5, fits: ['bolt_a'], model: 'wpn_mag_bolt_a', iconSwatch: '#8a7a50', value: 18 },
  { id: 'mag_smg_a', kind: 'magazine', w: 1, h: 2, stack: 1, ammo: 'ammo_9mm', capacity: 30, fits: ['smg_a'], model: 'wpn_mag_smg_a', iconSwatch: '#3a3e44', value: 35 },
  { id: 'mag_revolver_a', kind: 'magazine', w: 1, h: 1, stack: 1, ammo: 'ammo_357', capacity: 6, fits: ['revolver_a'], model: 'wpn_mag_revolver_a', iconSwatch: '#55585e', value: 15 },
  { id: 'ammo_12ga', kind: 'ammo', w: 1, h: 1, stack: 40, iconSwatch: '#b83a2e', value: 2, rarity: 'uncommon' },
  { id: 'ammo_308', kind: 'ammo', w: 1, h: 1, stack: 40, iconSwatch: '#a8873c', value: 3, rarity: 'uncommon' },
  { id: 'ammo_357', kind: 'ammo', w: 1, h: 1, stack: 50, iconSwatch: '#b08a40', value: 2, rarity: 'uncommon' },
];
