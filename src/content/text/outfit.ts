import type { OutfitSlot } from '../data/outfit';
export const OUTFIT_SLOT_NAMES: Record<OutfitSlot, string> = {
  head: 'Headgear', face: 'Face', eyes: 'Eyewear', jacket: 'Jacket', armor: 'Armour', legs: 'Trousers', feet: 'Boots', hands: 'Gloves', pack: 'Backpack', pouch: 'Belt satchel',
};
export const OUTFIT_PART_NAMES: Record<string, string> = {
  cap: 'Baseball cap', helmet_steel: 'Steel helmet', gasmask: 'Gas mask', glasses: 'Sunglasses', goggles: 'Tactical goggles',
  jacket: 'Field jacket', vest: 'Plate vest', pants: 'Cargo trousers', boots: 'Leather boots', gloves: 'Work gloves',
  backpack_hiking: 'Hiking pack', backpack_school: 'Day pack', backpack_kit: 'Kit bag', satchel: 'Belt satchel',
};
export const OUTFIT_PRESET_NAMES: Record<string, string> = { scavenger: 'Scavenger', soldier: 'Soldier', drifter: 'Drifter', medic: 'Medic' };
