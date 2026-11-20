import type { ItemDef } from './types';

/**
 * Item table, part 2 (spread into ITEMS by items.ts): bags, wearables, food, drink, medicine, tools, materials.
 * Same rules as items.ts. Text for every id lives in src/content/text/items_more.ts.
 *
 * Balance anchors (principles §7, §8):
 *  - Hunger runs dry in 90 min, thirst in 60 min. A can is 20-30 points, a snack 6-15, a bottle 28-35.
 *  - Storage must beat the footprint: cells inside > cells outside. Total cells: waist 9, messenger 19, school/small 16,
 *    daypack 20, hiking 25, duffel 28, military 30, rucksack 48, alice 52, large hiking 42, lab 56.
 *  - Armour (ItemDef.armour): helmets cover the head zone, vests the body. 3 or more is infection-proof (data/survival).
 *    There is no warmth or limb-armour stat in the game yet, so boots/gloves/trousers/jackets carry pockets and value only.
 */
export const MORE_ITEMS: ItemDef[] = [
  // ---------- Backpacks (footprint < storage) ----------
  { id: 'waist_pack', kind: 'backpack', w: 2, h: 2, stack: 1, slots: ['backpack'], grid: { w: 3, h: 3 }, iconSwatch: '#4a4f55', value: 45 },
  { id: 'messenger_bag', kind: 'backpack', w: 3, h: 2, stack: 1, slots: ['backpack'], grid: { w: 5, h: 3 }, pockets: [{ w: 2, h: 2 }], iconSwatch: '#6a5a44', value: 110 },
  { id: 'daypack', kind: 'backpack', w: 3, h: 3, stack: 1, slots: ['backpack'], grid: { w: 4, h: 5 }, iconSwatch: '#2f5a6b', value: 150 },
  // Long and shallow: more cells than a hiking pack but a clumsy 4x2 grid is hard to pack tall things into.
  { id: 'duffel_bag', kind: 'backpack', w: 4, h: 2, stack: 1, slots: ['backpack'], grid: { w: 7, h: 4 }, rarity: 'uncommon', iconSwatch: '#3d4a5a', value: 220 },
  { id: 'rucksack_military', kind: 'backpack', w: 4, h: 4, stack: 1, slots: ['backpack'], grid: { w: 6, h: 6 }, pockets: [{ w: 2, h: 3 }, { w: 2, h: 3 }], rarity: 'rare', iconSwatch: '#45502f', value: 560 },

  // ---------- Small containers ----------
  { id: 'tackle_box', kind: 'container', w: 2, h: 2, stack: 1, pockets: [{ w: 4, h: 3, accepts: ['tool', 'material'] }], rarity: 'uncommon', iconSwatch: '#3a6a4a', value: 40 },
  { id: 'first_aid_pouch', kind: 'container', w: 2, h: 1, stack: 1, pockets: [{ w: 3, h: 2, accepts: ['medical'] }], rarity: 'uncommon', iconSwatch: '#a8453a', value: 35 },
  { id: 'mag_pouch', kind: 'container', w: 1, h: 2, stack: 1, pockets: [{ w: 2, h: 3, accepts: ['magazine', 'ammo'] }], iconSwatch: '#4a4f3a', value: 30 },
  { id: 'tool_roll', kind: 'container', w: 2, h: 1, stack: 1, pockets: [{ w: 4, h: 2, accepts: ['tool'] }], iconSwatch: '#7a5a38', value: 30 },

  // ---------- Vests and rigs (armor slot) ----------
  { id: 'hunting_vest', kind: 'clothing', w: 2, h: 3, stack: 1, slots: ['armor'], pockets: [{ w: 2, h: 2 }, { w: 2, h: 1 }, { w: 1, h: 1 }, { w: 1, h: 1 }], warmth: 1, iconSwatch: '#c9611f', value: 70 },
  { id: 'fishing_vest', kind: 'clothing', w: 2, h: 3, stack: 1, slots: ['armor'], pockets: [{ w: 2, h: 1, accepts: ['tool', 'material'] }, { w: 2, h: 1, accepts: ['tool', 'material'] }, { w: 2, h: 2 }], warmth: 1, rainproof: 0.1, iconSwatch: '#8a8a5a', value: 60 },
  { id: 'chest_rig', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['armor'], pockets: [{ w: 1, h: 2, accepts: ['magazine'] }, { w: 1, h: 2, accepts: ['magazine'] }, { w: 1, h: 2, accepts: ['magazine'] }, { w: 2, h: 1 }], rarity: 'uncommon', iconSwatch: '#4a4a3c', value: 150 },
  { id: 'stab_vest', kind: 'clothing', w: 3, h: 3, stack: 1, slots: ['armor'], armour: 1, pockets: [{ w: 2, h: 1 }, { w: 2, h: 1 }], rarity: 'uncommon', warmth: 1, iconSwatch: '#22262c', value: 180 },
  { id: 'kevlar_vest', kind: 'clothing', w: 3, h: 3, stack: 1, slots: ['armor'], armour: 2, pockets: [{ w: 2, h: 2 }], rarity: 'uncommon', warmth: 1, iconSwatch: '#2c3036', value: 260 },
  { id: 'plate_carrier', kind: 'clothing', w: 3, h: 3, stack: 1, slots: ['armor'], armour: 3, pockets: [{ w: 1, h: 2, accepts: ['magazine'] }, { w: 1, h: 2, accepts: ['magazine'] }, { w: 2, h: 1 }], rarity: 'epic', warmth: 1, iconSwatch: '#3a3d34', value: 700 },

  // ---------- Torso ----------
  { id: 'flannel_shirt', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['torso'], pockets: [{ w: 1, h: 1 }, { w: 1, h: 1 }], warmth: 3, iconSwatch: '#8a3a2e', value: 25 },
  { id: 'denim_jacket', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['torso'], pockets: [{ w: 2, h: 1 }, { w: 2, h: 1 }], warmth: 4, rainproof: 0.1, iconSwatch: '#44607a', value: 70 },
  { id: 'raincoat', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['torso'], pockets: [{ w: 2, h: 1 }], warmth: 3, rainproof: 0.75, iconSwatch: '#c9a52e', value: 50 },
  { id: 'puffer_jacket', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['torso'], pockets: [{ w: 2, h: 1 }, { w: 2, h: 1 }, { w: 1, h: 1 }, { w: 1, h: 1 }], rarity: 'uncommon', warmth: 10, rainproof: 0.2, iconSwatch: '#22262c', value: 120 },
  { id: 'leather_jacket', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['torso'], pockets: [{ w: 2, h: 1 }, { w: 1, h: 1 }], rarity: 'uncommon', warmth: 5, rainproof: 0.3, armour: 1, iconSwatch: '#2a1f1a', value: 150 },
  { id: 'hunting_jacket', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['torso'], pockets: [{ w: 2, h: 2 }, { w: 2, h: 1 }, { w: 2, h: 1 }], rarity: 'uncommon', warmth: 7, rainproof: 0.3, iconSwatch: '#5a6a3a', value: 130 },
  { id: 'police_jacket', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['torso'], pockets: [{ w: 2, h: 2 }, { w: 1, h: 2 }, { w: 1, h: 2 }], rarity: 'uncommon', warmth: 6, rainproof: 0.2, armour: 1, iconSwatch: '#26324a', value: 150 },

  // ---------- Legs ----------
  { id: 'track_pants', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['legs'], pockets: [{ w: 1, h: 1 }], warmth: 2, iconSwatch: '#2a2d30', value: 25 },
  { id: 'jeans', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['legs'], pockets: [{ w: 1, h: 2 }, { w: 1, h: 2 }], warmth: 2, iconSwatch: '#3a4f6b', value: 45 },
  { id: 'work_trousers', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['legs'], pockets: [{ w: 2, h: 1 }, { w: 2, h: 1 }, { w: 1, h: 2 }], warmth: 2, iconSwatch: '#6b5a3c', value: 50 },
  { id: 'tactical_pants', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['legs'], pockets: [{ w: 2, h: 2 }, { w: 2, h: 2 }, { w: 1, h: 2 }, { w: 1, h: 2 }], rarity: 'uncommon', warmth: 2, rainproof: 0.1, armour: 1, iconSwatch: '#4d5638', value: 140 },

  // ---------- Feet and hands ----------
  { id: 'sneakers', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['feet'], warmth: 1, iconSwatch: '#d8d4c8', value: 20 },
  { id: 'rubber_boots', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['feet'], warmth: 1, rainproof: 0.4, iconSwatch: '#2f4a2a', value: 35 },
  { id: 'hiking_boots', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['feet'], rarity: 'uncommon', warmth: 3, rainproof: 0.3, iconSwatch: '#6a4a2a', value: 90 },
  { id: 'combat_boots', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['feet'], rarity: 'uncommon', warmth: 3, rainproof: 0.2, armour: 1, iconSwatch: '#1d1f22', value: 130 },
  { id: 'gloves_winter', kind: 'clothing', w: 2, h: 1, stack: 1, slots: ['gloves'], warmth: 3, iconSwatch: '#5a2e3a', value: 20 },
  { id: 'gloves_leather', kind: 'clothing', w: 2, h: 1, stack: 1, slots: ['gloves'], warmth: 2, rainproof: 0.1, iconSwatch: '#47321f', value: 30 },
  { id: 'gloves_tactical', kind: 'clothing', w: 2, h: 1, stack: 1, slots: ['gloves'], rarity: 'uncommon', warmth: 1, iconSwatch: '#1d1f22', value: 80 },

  // ---------- Head, face, eyes, ears ----------
  { id: 'bucket_hat', kind: 'clothing', w: 2, h: 1, stack: 1, slots: ['head'], warmth: 1, rainproof: 0.3, iconSwatch: '#8f8a6a', value: 8 },
  { id: 'hunting_cap', kind: 'clothing', w: 2, h: 1, stack: 1, slots: ['head'], warmth: 1, rainproof: 0.1, iconSwatch: '#d9701f', value: 12 },
  { id: 'hard_hat', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['head'], armour: 1, rainproof: 0.2, iconSwatch: '#d9b22f', value: 30 },
  { id: 'bike_helmet', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['head'], armour: 1, iconSwatch: '#3a6a9a', value: 35 },
  { id: 'riot_helmet', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['head'], armour: 3, rarity: 'rare', warmth: 1, iconSwatch: '#1c2024', value: 320 },
  { id: 'bandana', kind: 'clothing', w: 1, h: 1, stack: 1, slots: ['face'], warmth: 1, iconSwatch: '#8a2e2a', value: 6 },
  { id: 'surgical_mask', kind: 'clothing', w: 1, h: 1, stack: 1, slots: ['face'], iconSwatch: '#9bc4d4', value: 5 },
  { id: 'balaclava', kind: 'clothing', w: 2, h: 1, stack: 1, slots: ['face'], warmth: 3, iconSwatch: '#1d1f22', value: 20 },
  { id: 'sunglasses', kind: 'clothing', w: 1, h: 1, stack: 1, slots: ['eyes'], iconSwatch: '#0d0d10', value: 15 },
  { id: 'safety_goggles', kind: 'clothing', w: 1, h: 1, stack: 1, slots: ['eyes'], iconSwatch: '#6c7074', value: 18 },
  { id: 'earmuffs', kind: 'clothing', w: 1, h: 1, stack: 1, slots: ['ears'], warmth: 2, iconSwatch: '#c9611f', value: 25 },

  // ---------- Food ----------
  { id: 'apple', kind: 'food', w: 1, h: 1, stack: 4, iconSwatch: '#b0332a', value: 4, use: { seconds: 1.5, food: 8, water: 6, sound: 'item_pickup' } },
  { id: 'crackers', kind: 'food', w: 1, h: 1, stack: 4, iconSwatch: '#c9a86a', value: 6, use: { seconds: 2, food: 14, sound: 'item_pickup' } },
  { id: 'chocolate_bar', kind: 'food', w: 1, h: 1, stack: 5, iconSwatch: '#5a3524', value: 6, use: { seconds: 1.5, food: 8, fatigue: 6, sound: 'item_pickup' } },
  { id: 'instant_noodles', kind: 'food', w: 1, h: 1, stack: 4, iconSwatch: '#d9a02f', value: 7, use: { seconds: 3, food: 20, sound: 'item_pickup' } },
  { id: 'bread_loaf', kind: 'food', w: 2, h: 1, stack: 1, iconSwatch: '#b58a54', value: 8, use: { seconds: 3, food: 24, sound: 'item_pickup' } },
  { id: 'cereal_box', kind: 'food', w: 1, h: 2, stack: 1, iconSwatch: '#d96a2f', value: 10, use: { seconds: 3, food: 28, sound: 'item_pickup' } },
  { id: 'canned_peaches', kind: 'food', w: 1, h: 1, stack: 3, iconSwatch: '#d98a4a', value: 11, use: { seconds: 3, food: 18, water: 8, sound: 'item_pickup' } },
  { id: 'canned_chili', kind: 'food', w: 1, h: 1, stack: 3, iconSwatch: '#8a3a22', value: 16, use: { seconds: 3.5, food: 32, sound: 'item_pickup' } },
  { id: 'peanut_butter', kind: 'food', w: 1, h: 1, stack: 2, iconSwatch: '#b5803a', value: 14, use: { seconds: 3, food: 30, sound: 'item_pickup' } },
  { id: 'beef_jerky', kind: 'food', w: 1, h: 1, stack: 5, rarity: 'uncommon', iconSwatch: '#6a2f22', value: 12, use: { seconds: 2, food: 15, sound: 'item_pickup' } },

  // ---------- Drink ----------
  { id: 'soda_can', kind: 'drink', w: 1, h: 1, stack: 1, iconSwatch: '#c92a2a', value: 6, use: { seconds: 1.5, water: 12, stamina: 20, fatigue: 4, sound: 'item_pickup' } },
  { id: 'juice_box', kind: 'drink', w: 1, h: 1, stack: 2, iconSwatch: '#e08a2f', value: 7, use: { seconds: 1.5, water: 14, food: 5, sound: 'item_pickup' } },
  { id: 'sports_drink', kind: 'drink', w: 1, h: 2, stack: 1, iconSwatch: '#2f8ad9', value: 12, use: { seconds: 2, water: 28, stamina: 35, sound: 'item_pickup' } },
  { id: 'thermos', kind: 'drink', w: 1, h: 2, stack: 1, rarity: 'uncommon', iconSwatch: '#7a8a8f', value: 22, use: { seconds: 3, water: 20, fatigue: 22, warmth: 15, sound: 'item_pickup' } },
  { id: 'water_jug', kind: 'drink', w: 2, h: 2, stack: 1, rarity: 'uncommon', iconSwatch: '#7ab0d4', value: 18, use: { seconds: 6, water: 80, sound: 'item_pickup' } },
  // Untreated: a gamble that gets worse the less you have (30% infection start; antiseptic and antibiotics fix an early one).
  { id: 'dirty_water', kind: 'drink', w: 1, h: 2, stack: 1, iconSwatch: '#6a5a3a', value: 4, use: { seconds: 2.5, water: 28, inflicts: { status: 'infection', chance: 0.3 }, sound: 'item_pickup' } },

  // ---------- Medical ----------
  { id: 'antiseptic', kind: 'medical', w: 1, h: 1, stack: 4, iconSwatch: '#9ac47a', value: 20, use: { seconds: 2.5, cures: ['infection'], infectionMaxStage: 1, sound: 'search_rustle' } },
  { id: 'tourniquet', kind: 'medical', w: 1, h: 1, stack: 3, rarity: 'uncommon', iconSwatch: '#2a2d30', value: 25, use: { seconds: 1.5, cures: ['bleeding', 'heavy_bleeding'], sound: 'search_rustle' } },
  { id: 'first_aid_kit', kind: 'medical', w: 2, h: 1, stack: 3, iconSwatch: '#c94a3f', value: 55, use: { seconds: 4, heal: 30, sound: 'search_rustle', cures: ['bleeding'] } },
  { id: 'saline_bag', kind: 'medical', w: 1, h: 2, stack: 2, rarity: 'uncommon', iconSwatch: '#cfe4ea', value: 40, use: { seconds: 4, heal: 12, water: 25, sound: 'search_rustle' } },
  { id: 'vitamins', kind: 'medical', w: 1, h: 1, stack: 5, iconSwatch: '#d9c42f', value: 10, use: { seconds: 1.5, food: 4, fatigue: 10, sound: 'item_pickup' } },
  { id: 'adrenaline_shot', kind: 'medical', w: 1, h: 1, stack: 2, rarity: 'rare', iconSwatch: '#d9482f', value: 140, use: { seconds: 1.2, heal: 10, stamina: 100, sound: 'item_pickup' } },

  // ---------- Tools (carried; mechanics and quests use them later) ----------
  { id: 'lighter', kind: 'tool', w: 1, h: 1, stack: 1, iconSwatch: '#c9611f', value: 10 },
  { id: 'matches', kind: 'tool', w: 1, h: 1, stack: 5, iconSwatch: '#b5342a', value: 5 },
  { id: 'can_opener', kind: 'tool', w: 1, h: 1, stack: 1, iconSwatch: '#9da3a6', value: 8 },
  { id: 'multitool', kind: 'tool', w: 1, h: 1, stack: 1, rarity: 'uncommon', iconSwatch: '#6a7074', value: 55 },
  { id: 'compass', kind: 'tool', w: 1, h: 1, stack: 1, iconSwatch: '#7a5a2e', value: 30 },
  { id: 'whistle', kind: 'tool', w: 1, h: 1, stack: 1, iconSwatch: '#c9c4b0', value: 4 },
  { id: 'sewing_kit', kind: 'tool', w: 1, h: 1, stack: 1, iconSwatch: '#8a4a6a', value: 14 },
  { id: 'road_flare', kind: 'tool', w: 1, h: 2, stack: 3, iconSwatch: '#d9322a', value: 12 },
  { id: 'radio_handheld', kind: 'tool', w: 1, h: 2, stack: 1, rarity: 'uncommon', iconSwatch: '#3a3f44', value: 70, use: { seconds: 1.5, keep: true, action: 'radio', sound: 'item_pickup' } },
  { id: 'binoculars', kind: 'tool', w: 2, h: 1, stack: 1, rarity: 'uncommon', iconSwatch: '#2a2d30', value: 80 },
  { id: 'bolt_cutters', kind: 'tool', w: 1, h: 3, stack: 1, rarity: 'uncommon', iconSwatch: '#b5342a', value: 90 },
  { id: 'jerrycan', kind: 'tool', w: 2, h: 3, stack: 1, iconSwatch: '#b5622a', value: 40 },
  { id: 'tarp', kind: 'tool', w: 2, h: 2, stack: 1, iconSwatch: '#3a6a8a', value: 15 },

  // ---------- Materials ----------
  { id: 'battery', kind: 'material', w: 1, h: 1, stack: 4, iconSwatch: '#c9a52e', value: 6 },
  { id: 'copper_wire', kind: 'material', w: 1, h: 1, stack: 10, iconSwatch: '#b5622a', value: 4 },
  { id: 'screws', kind: 'material', w: 1, h: 1, stack: 100, iconSwatch: '#8a8f92', value: 1 },
  { id: 'sheet_metal', kind: 'material', w: 2, h: 2, stack: 5, rarity: 'uncommon', iconSwatch: '#7c8084', value: 14 },

  // ---------- Ammo box ----------
  { id: 'ammo_762_box', kind: 'ammo', w: 2, h: 1, stack: 1, unpack: { item: 'ammo_762', count: 40 }, iconSwatch: '#6a5a2f', value: 85, rarity: 'uncommon' },

  // ---------- Melee (stats in data/melee_extra.ts; the hand model is a stand-in until the asset requests land) ----------
  { id: 'baseball_bat', kind: 'weapon', w: 1, h: 4, stack: 1, slots: ['melee'], iconSwatch: '#b58a54', value: 30 },
  { id: 'machete', kind: 'weapon', w: 1, h: 3, stack: 1, slots: ['melee'], rarity: 'uncommon', iconSwatch: '#8f9aa0', value: 70 },
  { id: 'fire_axe', kind: 'weapon', w: 2, h: 3, stack: 1, slots: ['melee'], rarity: 'rare', iconSwatch: '#b5342a', value: 120 },

  // ---------- Round 2: more packs, rigs, hats, food, light and first aid ----------
  { id: 'kids_backpack', kind: 'backpack', w: 2, h: 3, stack: 1, slots: ['backpack'], grid: { w: 3, h: 4 }, iconSwatch: '#d94a6a', value: 40 },
  { id: 'assault_pack', kind: 'backpack', w: 3, h: 4, stack: 1, slots: ['backpack'], grid: { w: 5, h: 5 }, pockets: [{ w: 2, h: 2 }, { w: 2, h: 2 }], rarity: 'uncommon', iconSwatch: '#3a3f34', value: 300 },
  { id: 'hydration_pack', kind: 'backpack', w: 3, h: 3, stack: 1, slots: ['backpack'], grid: { w: 4, h: 4 }, pockets: [{ w: 2, h: 2, accepts: ['drink'] }], rarity: 'uncommon', iconSwatch: '#2f8a9a', value: 200 },
  { id: 'bandolier', kind: 'clothing', w: 2, h: 1, stack: 1, slots: ['armor'], pockets: [{ w: 6, h: 1, accepts: ['ammo', 'magazine'] }], rarity: 'uncommon', iconSwatch: '#6a4a2a', value: 90 },
  { id: 'construction_vest', kind: 'clothing', w: 2, h: 3, stack: 1, slots: ['armor'], pockets: [{ w: 2, h: 1 }, { w: 1, h: 1 }, { w: 1, h: 1 }], iconSwatch: '#e0782a', value: 30 },
  { id: 'cowboy_hat', kind: 'clothing', w: 2, h: 1, stack: 1, slots: ['head'], warmth: 1, rainproof: 0.25, iconSwatch: '#8a6a3a', value: 20 },
  { id: 'motorcycle_helmet', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['head'], armour: 2, rarity: 'uncommon', warmth: 2, rainproof: 0.2, iconSwatch: '#22262c', value: 140 },
  { id: 'scarf', kind: 'clothing', w: 2, h: 1, stack: 1, slots: ['face'], warmth: 3, iconSwatch: '#8a3a2e', value: 10 },
  { id: 'canned_corn', kind: 'food', w: 1, h: 1, stack: 3, iconSwatch: '#d9b22f', value: 10, use: { seconds: 3, food: 20, water: 4, sound: 'item_pickup' } },
  { id: 'sardines', kind: 'food', w: 1, h: 1, stack: 4, iconSwatch: '#6a8aa0', value: 9, use: { seconds: 2, food: 16, sound: 'item_pickup' } },
  { id: 'trail_mix', kind: 'food', w: 1, h: 1, stack: 3, iconSwatch: '#9a6a3a', value: 9, use: { seconds: 2, food: 18, fatigue: 3, sound: 'item_pickup' } },
  { id: 'honey_jar', kind: 'food', w: 1, h: 1, stack: 2, rarity: 'uncommon', iconSwatch: '#d99a1f', value: 18, use: { seconds: 2.5, food: 22, fatigue: 8, sound: 'item_pickup' } },
  { id: 'energy_gel', kind: 'food', w: 1, h: 1, stack: 5, iconSwatch: '#c9d92f', value: 8, use: { seconds: 1.2, food: 6, stamina: 50, sound: 'item_pickup' } },
  { id: 'iced_tea', kind: 'drink', w: 1, h: 2, stack: 1, iconSwatch: '#b5622a', value: 8, use: { seconds: 2, water: 22, fatigue: 3, sound: 'item_pickup' } },
  { id: 'sterile_gauze', kind: 'medical', w: 1, h: 1, stack: 6, iconSwatch: '#e9e6dc', value: 9, use: { seconds: 2, heal: 8, cures: ['bleeding'], sound: 'search_rustle' } },
  { id: 'headlamp', kind: 'tool', w: 1, h: 1, stack: 1, rarity: 'uncommon', iconSwatch: '#2a2d30', value: 45 },
  { id: 'camping_lantern', kind: 'tool', w: 2, h: 2, stack: 1, rarity: 'uncommon', iconSwatch: '#c9a52e', value: 35 },
  { id: 'glow_stick', kind: 'tool', w: 1, h: 1, stack: 5, iconSwatch: '#5fe07a', value: 4 },

  // ---------- Crafting products and tools (data/crafting.ts) ----------
  { id: 'torch', kind: 'tool', w: 1, h: 2, stack: 3, iconSwatch: '#8a5a2a', value: 6 },
  { id: 'campfire_kit', kind: 'tool', w: 2, h: 2, stack: 1, iconSwatch: '#7a4a2a', value: 25, use: { seconds: 3, action: 'campfire', sound: 'search_rustle' } },
  { id: 'cooking_pot', kind: 'tool', w: 2, h: 1, stack: 1, rarity: 'uncommon', iconSwatch: '#5a5f63', value: 25 },
  { id: 'purification_tablets', kind: 'medical', w: 1, h: 1, stack: 10, iconSwatch: '#cfe4ea', value: 8 },
  { id: 'sterile_bandage', kind: 'medical', w: 1, h: 1, stack: 4, iconSwatch: '#eef2f4', value: 24, use: { seconds: 2.5, heal: 25, sound: 'search_rustle', cures: ['bleeding', 'heavy_bleeding'] } },
  { id: 'hot_soup', kind: 'food', w: 1, h: 1, stack: 1, iconSwatch: '#d9803a', value: 18, use: { seconds: 3, food: 36, water: 12, warmth: 22, fatigue: 6, sound: 'item_pickup' } },
  { id: 'hot_chili', kind: 'food', w: 1, h: 1, stack: 1, iconSwatch: '#a8452a', value: 20, use: { seconds: 3.5, food: 40, warmth: 20, sound: 'item_pickup' } },
  { id: 'hot_noodles', kind: 'food', w: 1, h: 1, stack: 1, iconSwatch: '#e0b040', value: 12, use: { seconds: 3, food: 34, water: 8, warmth: 22, sound: 'item_pickup' } },
  { id: 'spear', kind: 'weapon', w: 1, h: 4, stack: 1, slots: ['melee'], iconSwatch: '#a07a4a', value: 45 },
  { id: 'nail_bat', kind: 'weapon', w: 1, h: 4, stack: 1, slots: ['melee'], rarity: 'uncommon', iconSwatch: '#8a6a3a', value: 55 },
];
