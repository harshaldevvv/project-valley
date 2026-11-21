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
  // Shotgun: a longer magazine tube (the shell carrier refills it). Hunting rifle: a detachable 10-round box in place of the
  // stripper clip. No revolver one: the cylinder holds six, so a bigger speedloader cannot exist.
  { id: 'mag_shotgun_ext', kind: 'magazine', w: 2, h: 1, stack: 1, ammo: 'ammo_12ga', capacity: 8, fits: ['shotgun_a'], model: 'wpn_mag_shotgun_a', rarity: 'uncommon', iconSwatch: '#a83a2e', value: 60 },
  { id: 'mag_bolt_ext', kind: 'magazine', w: 1, h: 1, stack: 1, ammo: 'ammo_308', capacity: 10, fits: ['bolt_a'], model: 'wpn_mag_bolt_a', rarity: 'rare', iconSwatch: '#8a7a50', value: 80 },
];
