import type { OutfitSlot } from '../data/outfit';
export const OUTFIT_SLOT_NAMES: Record<OutfitSlot, string> = {
  head: 'Headgear', eyes: 'Eyewear', jacket: 'Jacket', armor: 'Armour', legs: 'Trousers', feet: 'Boots', hands: 'Gloves', pack: 'Backpack', pouch: 'Belt pouches',
};
export const OUTFIT_PART_NAMES: Record<string, string> = {
  cap: 'Baseball cap', helmet: 'Field helmet', glasses: 'Sunglasses', jacket: 'Field jacket', vest: 'Plate vest', pants: 'Cargo trousers',
  boots: 'Leather boots', gloves: 'Work gloves', backpack: 'Rucksack', pouch: 'Belt pouches',
};
export const OUTFIT_PRESET_NAMES: Record<string, string> = { scavenger: 'Scavenger', soldier: 'Soldier', drifter: 'Drifter', medic: 'Medic' };
