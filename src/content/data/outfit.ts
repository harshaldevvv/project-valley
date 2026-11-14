/**
 * Wearable parts for the hero rig (meshes are built by tools/audit/build_parts.py into chr_hero_a_parts.glb).
 * A slot holds at most one part; each part may be recoloured with any swatch in its `tints`. Player-facing names live in
 * src/content/text/outfit.ts. Part ids are also the mesh names without the `part_` prefix.
 */
export type OutfitSlot = 'head' | 'eyes' | 'jacket' | 'armor' | 'legs' | 'feet' | 'hands' | 'pack' | 'pouch';

export interface OutfitPart {
  id: string;
  slot: OutfitSlot;
  tints: string[];      // swatches (css colours); the first one is the default
  rough: number;
  metal?: number;
}

export const OUTFIT_SLOTS: OutfitSlot[] = ['head', 'eyes', 'jacket', 'armor', 'legs', 'feet', 'hands', 'pack', 'pouch'];

const CLOTH = ['#4d5638', '#3a3f4a', '#6b5a3c', '#7a2e2a', '#d8d4c8', '#1d1f22'];
const LEATHER = ['#47321f', '#26211c', '#6a4a2a', '#2f3a2a'];
export const OUTFIT_PARTS: OutfitPart[] = [
  { id: 'cap', slot: 'head', tints: ['#33405a', '#7a2e2a', '#26211c', '#4d5638'], rough: 0.9 },
  { id: 'helmet', slot: 'head', tints: ['#4a5238', '#2a2d30', '#8a8d8f'], rough: 0.5, metal: 0.2 },
  { id: 'glasses', slot: 'eyes', tints: ['#0a0a0c', '#2a3a4a', '#7a5a1a'], rough: 0.2, metal: 0.3 },
  { id: 'jacket', slot: 'jacket', tints: CLOTH, rough: 0.9 },
  { id: 'vest', slot: 'armor', tints: ['#2a2d30', '#4a5238', '#3a3f4a'], rough: 0.8 },
  { id: 'pants', slot: 'legs', tints: ['#6b5a3c', '#3a3f4a', '#4d5638', '#1d1f22'], rough: 0.9 },
  { id: 'boots', slot: 'feet', tints: LEATHER, rough: 0.7 },
  { id: 'gloves', slot: 'hands', tints: ['#1d1f22', '#47321f', '#6b5a3c'], rough: 0.8 },
  { id: 'backpack', slot: 'pack', tints: ['#3d4a30', '#3a3f4a', '#6b5a3c', '#7a2e2a'], rough: 0.95 },
  { id: 'pouch', slot: 'pouch', tints: LEATHER, rough: 0.9 },
];

export const partsById = (id: string) => OUTFIT_PARTS.find((p) => p.id === id);

/** Ready-made looks: slot -> [part id, tint index]. */
export const OUTFIT_PRESETS: Record<string, Partial<Record<OutfitSlot, [string, number]>>> = {
  scavenger: { jacket: ['jacket', 0], legs: ['pants', 0], feet: ['boots', 0], hands: ['gloves', 0], pack: ['backpack', 0], head: ['cap', 1] },
  soldier: { head: ['helmet', 0], eyes: ['glasses', 0], jacket: ['jacket', 0], armor: ['vest', 0], legs: ['pants', 2], feet: ['boots', 1], hands: ['gloves', 0], pouch: ['pouch', 1], pack: ['backpack', 0] },
  drifter: { jacket: ['jacket', 2], legs: ['pants', 1], feet: ['boots', 2], eyes: ['glasses', 2], head: ['cap', 2] },
  medic: { jacket: ['jacket', 4], legs: ['pants', 3], feet: ['boots', 1], hands: ['gloves', 1], pack: ['backpack', 2], head: ['cap', 0] },
};

/** Inventory slot -> outfit slot, and which part (and tint) each worn item shows. Items missing here show nothing extra. */
export const SLOT_TO_OUTFIT: Record<string, OutfitSlot> = {
  head: 'head', eyes: 'eyes', torso: 'jacket', armor: 'armor', legs: 'legs', feet: 'feet', gloves: 'hands', backpack: 'pack', pouch: 'pouch',
};
export const ITEM_PARTS: Record<string, [string, number]> = {
  jacket_field: ['jacket', 0], hoodie: ['jacket', 1], military_jacket: ['jacket', 0],
  cargo_pants: ['pants', 0], tactical_vest: ['vest', 0],
  beanie: ['cap', 1], cap: ['cap', 0], helmet_military: ['helmet', 0], glasses: ['glasses', 0],
  secure_pouch: ['pouch', 0],
  backpack_small: ['backpack', 1], school_bag: ['backpack', 1], hiking_pack: ['backpack', 2], military_pack: ['backpack', 0],
  alice_pack: ['backpack', 0], large_hiking_pack: ['backpack', 3], laboratory_pack: ['backpack', 1],
};
