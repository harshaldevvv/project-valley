import type { ItemDef } from './types';

/**
 * Item table, attachments and extended magazines (spread into ITEMS by items.ts).
 * Rules: data/attachments.ts. Text: content/text/items_attach.ts. Loot: data/loot_attach.ts.
 */
export const ATTACH_ITEMS: ItemDef[] = [
  { id: 'red_dot', kind: 'misc', w: 1, h: 1, stack: 1, rarity: 'uncommon', iconSwatch: '#3a3e44', value: 140 },
  { id: 'scope_4x', kind: 'misc', w: 2, h: 1, stack: 1, rarity: 'rare', iconSwatch: '#2a2d31', value: 320 },
  { id: 'suppressor', kind: 'misc', w: 2, h: 1, stack: 1, rarity: 'rare', iconSwatch: '#33363a', value: 260 },
  { id: 'mag_rifle_ext', kind: 'magazine', w: 1, h: 2, stack: 1, ammo: 'ammo_762', capacity: 45, fits: ['rifle_a'], model: 'wpn_mag_rifle_a', rarity: 'uncommon', iconSwatch: '#4a4535', value: 90 },
  { id: 'mag_pistol_ext', kind: 'magazine', w: 1, h: 1, stack: 1, ammo: 'ammo_9mm', capacity: 25, fits: ['pistol_a'], model: 'wpn_mag_pistol_a', rarity: 'uncommon', iconSwatch: '#45494c', value: 55 },
  { id: 'mag_smg_ext', kind: 'magazine', w: 1, h: 2, stack: 1, ammo: 'ammo_9mm', capacity: 50, fits: ['smg_a'], model: 'wpn_mag_smg_a', rarity: 'uncommon', iconSwatch: '#3a3e44', value: 70 },
];
