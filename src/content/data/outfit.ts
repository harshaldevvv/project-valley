/**
 * Wearable parts for the hero rig (meshes are built by tools/audit/build_parts.py into chr_hero_a_parts.glb).
 * A slot holds at most one part; each part may be recoloured with any swatch in its `tints`. Player-facing names live in
 * src/content/text/outfit.ts. Part ids are also the mesh names without the `part_` prefix.
 */
export type OutfitSlot = 'head' | 'face' | 'eyes' | 'jacket' | 'armor' | 'legs' | 'feet' | 'hands' | 'pack' | 'pouch';
/** Body areas a garment can cover; the base body hides these while the garment is worn so skin never shows through. */
export type BodyRegion = 'head' | 'torso' | 'arms' | 'hands' | 'legs' | 'feet';

export interface OutfitPart {
  id: string;
  slot: OutfitSlot;
  tints: string[];      // swatches (css colours); the first one is the default. Textured parts only multiply, so the first is white.
  rough: number;
  metal?: number;
  hides?: BodyRegion[];
}

export const OUTFIT_SLOTS: OutfitSlot[] = ['head', 'face', 'eyes', 'jacket', 'armor', 'legs', 'feet', 'hands', 'pack', 'pouch'];

const CLOTH = ['#4d5638', '#3a3f4a', '#6b5a3c', '#7a2e2a', '#d8d4c8', '#1d1f22'];
const LEATHER = ['#47321f', '#26211c', '#6a4a2a', '#2f3a2a'];
const TEX = ['#ffffff', '#c8b89a', '#8a98a8', '#a8a090'];   // light multiplies for textured / vertex coloured parts
export const OUTFIT_PARTS: OutfitPart[] = [
  { id: 'cap', slot: 'head', tints: TEX, rough: 0.9 },
  { id: 'helmet_steel', slot: 'head', tints: TEX, rough: 0.5, metal: 0.2 },
  { id: 'gasmask', slot: 'face', tints: TEX, rough: 0.6 },
  { id: 'glasses', slot: 'eyes', tints: TEX, rough: 0.3 },
  { id: 'goggles', slot: 'eyes', tints: TEX, rough: 0.4 },
  { id: 'jacket', slot: 'jacket', tints: CLOTH, rough: 0.9, hides: ['torso', 'arms'] },
  { id: 'vest', slot: 'armor', tints: ['#2a2d30', '#4a5238', '#3a3f4a'], rough: 0.8 },
  { id: 'pants', slot: 'legs', tints: ['#6b5a3c', '#3a3f4a', '#4d5638', '#1d1f22'], rough: 0.9, hides: ['legs'] },
  { id: 'boots', slot: 'feet', tints: LEATHER, rough: 0.7, hides: ['feet'] },
  { id: 'gloves', slot: 'hands', tints: ['#1d1f22', '#47321f', '#6b5a3c'], rough: 0.8, hides: ['hands'] },
  { id: 'backpack_hiking', slot: 'pack', tints: TEX, rough: 0.95 },
  { id: 'backpack_school', slot: 'pack', tints: TEX, rough: 0.95 },
  { id: 'backpack_kit', slot: 'pack', tints: TEX, rough: 0.95 },
  { id: 'satchel', slot: 'pouch', tints: TEX, rough: 0.9 },
];

export const partsById = (id: string) => OUTFIT_PARTS.find((p) => p.id === id);

/** Ready-made looks: slot -> [part id, tint index]. */
export const OUTFIT_PRESETS: Record<string, Partial<Record<OutfitSlot, [string, number]>>> = {
  scavenger: { jacket: ['jacket', 0], legs: ['pants', 0], feet: ['boots', 0], hands: ['gloves', 0], pack: ['backpack_hiking', 0], head: ['cap', 0] },
  soldier: { head: ['helmet_steel', 0], eyes: ['goggles', 0], jacket: ['jacket', 0], armor: ['vest', 0], legs: ['pants', 2], feet: ['boots', 1], hands: ['gloves', 0], pouch: ['satchel', 0], pack: ['backpack_kit', 0] },
  drifter: { jacket: ['jacket', 2], legs: ['pants', 1], feet: ['boots', 2], eyes: ['glasses', 0], head: ['cap', 2] },
  medic: { jacket: ['jacket', 4], legs: ['pants', 3], feet: ['boots', 1], hands: ['gloves', 1], pack: ['backpack_school', 0], face: ['gasmask', 0] },
};

/** Inventory slot -> outfit slot, and which part (and tint) each worn item shows. Items missing here show nothing extra. */
export const SLOT_TO_OUTFIT: Record<string, OutfitSlot> = {
  head: 'head', face: 'face', eyes: 'eyes', torso: 'jacket', armor: 'armor', legs: 'legs', feet: 'feet', gloves: 'hands', backpack: 'pack', pouch: 'pouch',
};
export const ITEM_PARTS: Record<string, [string, number]> = {
  jacket_field: ['jacket', 0], hoodie: ['jacket', 1], military_jacket: ['jacket', 0],
  cargo_pants: ['pants', 0], tactical_vest: ['vest', 0],
  beanie: ['cap', 2], cap: ['cap', 0], helmet_military: ['helmet_steel', 0], gas_mask: ['gasmask', 0], glasses: ['glasses', 0],
  secure_pouch: ['satchel', 0], boots_work: ['boots', 0], gloves_work: ['gloves', 0],
  backpack_small: ['backpack_school', 0], school_bag: ['backpack_school', 0], hiking_pack: ['backpack_hiking', 0], military_pack: ['backpack_kit', 0],
  alice_pack: ['backpack_kit', 0], large_hiking_pack: ['backpack_hiking', 0], laboratory_pack: ['backpack_kit', 0],
};
