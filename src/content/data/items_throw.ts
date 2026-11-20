import type { ItemDef } from './types';

/**
 * Item table, throwables (spread into ITEMS by items.ts) and the fuel can for molotovs.
 * Behaviour: data/throwables.ts. Text: content/text/items_throw.ts. Loot: data/loot_throw.ts.
 */
export const THROW_ITEMS: ItemDef[] = [
  { id: 'frag_grenade', kind: 'misc', w: 1, h: 1, stack: 3, rarity: 'rare', iconSwatch: '#4f5a35', value: 90 },
  { id: 'molotov', kind: 'misc', w: 1, h: 2, stack: 4, rarity: 'uncommon', iconSwatch: '#a8602a', value: 30 },
  { id: 'glass_bottle', kind: 'misc', w: 1, h: 2, stack: 6, iconSwatch: '#3f6a4a', value: 3 },
  { id: 'flare', kind: 'misc', w: 1, h: 2, stack: 4, rarity: 'uncommon', iconSwatch: '#c43a2a', value: 18 },
  { id: 'fuel_can', kind: 'material', w: 2, h: 2, stack: 1, rarity: 'uncommon', iconSwatch: '#b5342a', value: 30 },
];
