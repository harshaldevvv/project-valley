import type { RecipeDef } from './types';

/**
 * Crafting v1 (principles §9: every faucet has a sink). Rules the tests enforce:
 *  - every id exists, and the recipe graph has no cycle (nothing can be turned back into its own ingredients);
 *  - outputs are worth at most ~4x their inputs (labour margin), so crafting never mints money out of junk;
 *  - rags come only from clothes (a finite item), so bandages stay limited by what you find and wear out.
 * Not here on purpose: arrows (no bow), cooking raw meat (no raw food exists yet), workbench
 * recipes (no workbench in the world), barricades (build mode already builds them from planks and nails).
 */
const CUT = ['knife_a', 'multitool', 'machete'];
const HIT = ['hammer_a', 'crowbar_a', 'wrench'];

const list: RecipeDef[] = [
  // ---- medical ----
  { id: 'bandage', category: 'medical', inputs: [{ item: 'cloth_rag', count: 4 }], seconds: 4, outputs: [{ item: 'bandage', count: 1 }] },
  { id: 'sterile_bandage', category: 'medical', inputs: [{ item: 'cloth_rag', count: 3 }, { item: 'antiseptic', count: 1 }], seconds: 4, outputs: [{ item: 'sterile_bandage', count: 1 }] },
  { id: 'splint', category: 'medical', inputs: [{ item: 'wood_planks', count: 2 }, { item: 'cloth_rag', count: 2 }], seconds: 5, outputs: [{ item: 'splint', count: 1 }] },
  { id: 'first_aid_kit', category: 'medical', inputs: [{ item: 'bandage', count: 2 }, { item: 'antiseptic', count: 1 }, { item: 'cloth_rag', count: 1 }], seconds: 5, outputs: [{ item: 'first_aid_kit', count: 1 }] },
  // ---- rags from clothes ----
  { id: 'rags_flannel', category: 'medical', inputs: [{ item: 'flannel_shirt', count: 1 }], tools: [CUT], seconds: 3, outputs: [{ item: 'cloth_rag', count: 4 }] },
  { id: 'rags_hoodie', category: 'medical', inputs: [{ item: 'hoodie', count: 1 }], tools: [CUT], seconds: 3, outputs: [{ item: 'cloth_rag', count: 4 }] },
  { id: 'rags_track_pants', category: 'medical', inputs: [{ item: 'track_pants', count: 1 }], tools: [CUT], seconds: 3, outputs: [{ item: 'cloth_rag', count: 3 }] },
  { id: 'rags_denim', category: 'medical', inputs: [{ item: 'denim_jacket', count: 1 }], tools: [CUT], seconds: 4, outputs: [{ item: 'cloth_rag', count: 5 }] },
  // ---- survival ----
  { id: 'campfire_kit', category: 'survival', inputs: [{ item: 'wood_planks', count: 4 }, { item: 'cloth_rag', count: 1 }], seconds: 6, outputs: [{ item: 'campfire_kit', count: 1 }] },
  { id: 'torch', category: 'survival', inputs: [{ item: 'wood_planks', count: 1 }, { item: 'cloth_rag', count: 2 }, { item: 'duct_tape', count: 1 }], seconds: 4, outputs: [{ item: 'torch', count: 1 }] },
  { id: 'purify_water', category: 'survival', inputs: [{ item: 'dirty_water', count: 1 }, { item: 'purification_tablets', count: 1 }], seconds: 5, outputs: [{ item: 'water_bottle', count: 1 }] },
  { id: 'boil_water', category: 'survival', inputs: [{ item: 'dirty_water', count: 1 }], tools: [['cooking_pot']], station: 'campfire', seconds: 8, outputs: [{ item: 'water_bottle', count: 1 }] },
  { id: 'rope', category: 'survival', inputs: [{ item: 'cloth', count: 3 }], tools: [CUT], seconds: 5, outputs: [{ item: 'rope', count: 1 }] },
  { id: 'sheet_metal', category: 'survival', inputs: [{ item: 'scrap_metal', count: 3 }], tools: [HIT], seconds: 6, outputs: [{ item: 'sheet_metal', count: 1 }] },
  // ---- cooking (campfire + pot) ----
  { id: 'hot_soup', category: 'cooking', inputs: [{ item: 'canned_soup', count: 1 }], tools: [['cooking_pot']], station: 'campfire', seconds: 6, outputs: [{ item: 'hot_soup', count: 1 }] },
  { id: 'hot_chili', category: 'cooking', inputs: [{ item: 'canned_chili', count: 1 }], tools: [['cooking_pot']], station: 'campfire', seconds: 6, outputs: [{ item: 'hot_chili', count: 1 }] },
  { id: 'hot_noodles', category: 'cooking', inputs: [{ item: 'instant_noodles', count: 1 }, { item: 'water_bottle', count: 1 }], tools: [['cooking_pot']], station: 'campfire', seconds: 8, outputs: [{ item: 'hot_noodles', count: 1 }] },
  // ---- weapons ----
  { id: 'spear', category: 'weapons', inputs: [{ item: 'wood_planks', count: 2 }, { item: 'knife_a', count: 1 }, { item: 'duct_tape', count: 1 }], seconds: 8, outputs: [{ item: 'spear', count: 1 }] },
  { id: 'nail_bat', category: 'weapons', inputs: [{ item: 'baseball_bat', count: 1 }, { item: 'nails', count: 8 }], tools: [HIT], seconds: 8, outputs: [{ item: 'nail_bat', count: 1 }] },
  { id: 'repair_weapon', category: 'weapons', inputs: [{ item: 'scrap_metal', count: 1 }, { item: 'cloth_rag', count: 1 }], tools: [['multitool', 'wrench', 'repair_kit']], seconds: 6, outputs: [], repair: { amount: 0.35 } },
  { id: 'molotov', category: 'weapons', inputs: [{ item: 'glass_bottle', count: 2 }, { item: 'cloth_rag', count: 2 }, { item: 'fuel_can', count: 1 }], seconds: 6, outputs: [{ item: 'molotov', count: 2 }] },
  // ---- gear ----
  { id: 'lockpick', category: 'gear', inputs: [{ item: 'copper_wire', count: 2 }, { item: 'scrap_metal', count: 1 }], tools: [['multitool', 'knife_a']], seconds: 6, outputs: [{ item: 'lockpick', count: 2 }] },
  { id: 'bandana', category: 'gear', inputs: [{ item: 'cloth_rag', count: 2 }], seconds: 3, outputs: [{ item: 'bandana', count: 1 }] },
  { id: 'scarf', category: 'gear', inputs: [{ item: 'cloth', count: 3 }], tools: [['sewing_kit']], seconds: 6, outputs: [{ item: 'scarf', count: 1 }] },
  { id: 'waist_pack', category: 'gear', inputs: [{ item: 'tarp', count: 1 }, { item: 'rope', count: 1 }], tools: [['sewing_kit']], seconds: 8, outputs: [{ item: 'waist_pack', count: 1 }] },
  { id: 'tool_roll', category: 'gear', inputs: [{ item: 'cloth', count: 2 }, { item: 'rope', count: 1 }], tools: [['sewing_kit']], seconds: 6, outputs: [{ item: 'tool_roll', count: 1 }] },
  { id: 'tarp', category: 'gear', inputs: [{ item: 'cloth', count: 4 }, { item: 'duct_tape', count: 1 }], seconds: 6, outputs: [{ item: 'tarp', count: 1 }] },
];

export const RECIPES: RecipeDef[] = list;
export const RECIPE_BY_ID: Record<string, RecipeDef> = Object.fromEntries(list.map((r) => [r.id, r]));
export const RECIPE_CATEGORIES: RecipeDef['category'][] = ['medical', 'survival', 'cooking', 'weapons', 'gear'];
