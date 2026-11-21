import './melee_extra';
import { MORE_ITEMS } from './items_more';
import { GUN_ITEMS } from './items_guns';
import { THROW_ITEMS } from './items_throw';
import { ATTACH_ITEMS } from './items_attach';
import type { ItemDef } from './types';

/**
 * Item table. Footprints follow principles §8 (pistol 2x1, rifle 5x2, ammo/bandage/can 1x1).
 * Stacks follow genre-standard sizes, ammo capped at 60 per principles §8.
 * A new item is a new row here plus its text in src/content/text/items.ts.
 */
const list: ItemDef[] = [
  // Weapons (stats live in the weapon table; here only inventory data).
  { id: 'pistol_a', kind: 'weapon', w: 2, h: 1, stack: 1, slots: ['sidearm'], model: 'wpn_pistol_a', iconSwatch: '#5b6166', value: 320 },
  { id: 'rifle_a', kind: 'weapon', w: 5, h: 2, stack: 1, slots: ['primary', 'secondary'], model: 'wpn_rifle_a', iconSwatch: '#5d5640', value: 950 },
  { id: 'knife_a', kind: 'weapon', w: 2, h: 1, stack: 1, slots: ['melee'], model: 'wpn_knife_a', iconSwatch: '#7d8488', value: 40 },
  // Heavy tools that double as melee (meleeDefs in data/weapons.ts; break-in use later).
  { id: 'crowbar_a', kind: 'weapon', w: 1, h: 3, stack: 1, slots: ['melee'], model: 'wpn_crowbar_a', iconSwatch: '#8a3a2e', value: 60, rarity: 'uncommon' },
  { id: 'hammer_a', kind: 'weapon', w: 1, h: 2, stack: 1, slots: ['melee'], model: 'wpn_hammer_a', iconSwatch: '#6e5a44', value: 35 },
  // Magazines: rounds live on the instance.
  { id: 'mag_pistol_a', kind: 'magazine', w: 1, h: 1, stack: 1, ammo: 'ammo_9mm', capacity: 15, fits: ['pistol_a'], model: 'wpn_mag_pistol_a', iconSwatch: '#45494c', value: 25 },
  { id: 'mag_rifle_a', kind: 'magazine', w: 1, h: 2, stack: 1, ammo: 'ammo_762', capacity: 30, fits: ['rifle_a'], model: 'wpn_mag_rifle_a', iconSwatch: '#4a4535', value: 45 },
  { id: 'ammo_9mm', kind: 'ammo', w: 1, h: 1, stack: 60, iconSwatch: '#a8873c', value: 1 },
  { id: 'ammo_762', kind: 'ammo', w: 1, h: 1, stack: 60, iconSwatch: '#9a6d35', value: 2 },
  // A sealed box: Unpack gives 50 loose rounds.
  { id: 'ammo_9mm_box', kind: 'ammo', w: 2, h: 1, stack: 1, unpack: { item: 'ammo_9mm', count: 50 }, iconSwatch: '#8f7330', value: 55, rarity: 'uncommon' },
  // Consumables.
  // Medical (principles §7: using one takes 2–5 s and can be interrupted).
  { id: 'bandage', kind: 'medical', w: 1, h: 1, stack: 4, iconSwatch: '#c9c2b0', value: 15, use: { seconds: 2.5, heal: 15, sound: 'search_rustle', cures: ['bleeding', 'heavy_bleeding'] } },
  { id: 'medkit', kind: 'medical', w: 2, h: 2, stack: 5, iconSwatch: '#b8443a', value: 90, use: { seconds: 5, heal: 50, sound: 'search_rustle', cures: ['bleeding', 'heavy_bleeding'] } },
  { id: 'splint', kind: 'medical', w: 1, h: 2, stack: 2, iconSwatch: '#a88c5c', value: 30, use: { seconds: 4, sound: 'search_rustle', cures: ['fracture'] } },
  { id: 'antibiotics', kind: 'medical', w: 1, h: 1, stack: 5, iconSwatch: '#d9d4c0', value: 45, use: { seconds: 2, sound: 'item_pickup', cures: ['infection'], infectionMaxStage: 2 } },
  { id: 'ifak', kind: 'medical', w: 2, h: 1, stack: 2, iconSwatch: '#5d6a48', value: 60, rarity: 'uncommon', use: { seconds: 3.5, heal: 25, sound: 'search_rustle', cures: ['bleeding', 'heavy_bleeding'] } },
  { id: 'painkillers', kind: 'medical', w: 1, h: 1, stack: 5, iconSwatch: '#e0e0d8', value: 25, use: { seconds: 2, heal: 5, stamina: 40, sound: 'item_pickup' } },
  { id: 'antiviral', kind: 'medical', w: 1, h: 1, stack: 1, iconSwatch: '#5fa3b8', value: 400, rarity: 'rare', use: { seconds: 3, sound: 'item_pickup', cures: ['infection'] } },
  // Food and drink.
  { id: 'canned_beans', kind: 'food', w: 1, h: 1, stack: 3, iconSwatch: '#8e4c3a', value: 12, use: { seconds: 3, food: 25, sound: 'item_pickup' } },
  { id: 'energy_bar', kind: 'food', w: 1, h: 1, stack: 5, iconSwatch: '#c9a04a', value: 8, use: { seconds: 2, food: 12, sound: 'item_pickup' } },
  { id: 'canned_soup', kind: 'food', w: 1, h: 1, stack: 3, iconSwatch: '#b36a3a', value: 14, use: { seconds: 3, food: 30, water: 10, sound: 'item_pickup' } },
  { id: 'canned_tuna', kind: 'food', w: 1, h: 1, stack: 3, iconSwatch: '#7a8fa0', value: 14, use: { seconds: 2.5, food: 22, sound: 'item_pickup' } },
  { id: 'mre', kind: 'food', w: 1, h: 2, stack: 3, iconSwatch: '#6b6a3e', value: 40, rarity: 'uncommon', use: { seconds: 4, food: 50, water: 25, stamina: 15, sound: 'item_pickup' } },
  { id: 'energy_drink', kind: 'drink', w: 1, h: 1, stack: 1, iconSwatch: '#3a8f5a', value: 15, use: { seconds: 2, water: 20, stamina: 60, sound: 'item_pickup' } },
  { id: 'canteen', kind: 'drink', w: 1, h: 2, stack: 1, iconSwatch: '#55603f', value: 30, use: { seconds: 2.5, water: 45, sound: 'item_pickup' } },
  { id: 'water_bottle', kind: 'drink', w: 1, h: 2, stack: 1, iconSwatch: '#5d86a0', value: 10, use: { seconds: 2, water: 35, sound: 'item_pickup' } },
  // Materials (building costs come from data/build.ts).
  { id: 'wood_planks', kind: 'material', w: 1, h: 2, stack: 20, iconSwatch: '#a7825a', value: 4 },
  { id: 'nails', kind: 'material', w: 1, h: 1, stack: 100, iconSwatch: '#9da1a3', value: 1 },
  { id: 'scrap_metal', kind: 'material', w: 1, h: 1, stack: 20, iconSwatch: '#8a5232', value: 5 },
  // Rags patch a light bleed in a pinch (research: rags 10 HP).
  { id: 'cloth_rag', kind: 'material', w: 1, h: 1, stack: 10, iconSwatch: '#b0a58c', value: 2, use: { seconds: 3, heal: 5, sound: 'search_rustle', cures: ['bleeding'] } },
  { id: 'cloth', kind: 'material', w: 1, h: 1, stack: 20, iconSwatch: '#8f8a78', value: 3 },
  { id: 'duct_tape', kind: 'material', w: 1, h: 1, stack: 5, iconSwatch: '#9da3a6', value: 8 },
  { id: 'rope', kind: 'material', w: 1, h: 2, stack: 3, iconSwatch: '#a8915e', value: 6 },
  { id: 'electronic_parts', kind: 'material', w: 1, h: 1, stack: 10, iconSwatch: '#3d6b4a', value: 15, rarity: 'uncommon' },
  { id: 'gunpowder', kind: 'material', w: 1, h: 1, stack: 50, iconSwatch: '#3b3b3b', value: 4, rarity: 'uncommon' },
  { id: 'metal_pipe', kind: 'material', w: 1, h: 3, stack: 5, iconSwatch: '#7c8084', value: 6 },
  // Tools (only need to be carried; mechanics consumes one to repair the car).
  { id: 'lockpick', kind: 'tool', w: 1, h: 1, stack: 10, iconSwatch: '#8f9aa0', value: 20 },
  { id: 'repair_kit', kind: 'tool', w: 2, h: 1, stack: 1, iconSwatch: '#b5523a', value: 120, rarity: 'uncommon' },
  { id: 'wrench', kind: 'tool', w: 1, h: 2, stack: 1, iconSwatch: '#8d9396', value: 25 },
  { id: 'flashlight_a', kind: 'tool', w: 1, h: 2, stack: 1, iconSwatch: '#2f3437', value: 35, use: { seconds: 0.3, keep: true, action: 'light' } },
  // Valuables.
  { id: 'cash', kind: 'valuable', w: 1, h: 1, stack: 5000, iconSwatch: '#5f8a4a', value: 1 },
  { id: 'wallet', kind: 'container', w: 1, h: 1, stack: 1, pockets: [{ w: 2, h: 3, accepts: ['valuable', 'tool'] }], iconSwatch: '#5a4030', value: 10 },
  // Small containers (footprint < storage; each only takes its own kind of goods).
  { id: 'lunchbox', kind: 'container', w: 2, h: 2, stack: 1, pockets: [{ w: 3, h: 3, accepts: ['food', 'drink'] }], iconSwatch: '#b5463a', value: 25 },
  { id: 'medical_bag', kind: 'container', w: 2, h: 2, stack: 1, pockets: [{ w: 4, h: 4, accepts: ['medical'] }], iconSwatch: '#c94a3f', value: 70, rarity: 'uncommon' },
  { id: 'ammo_tin', kind: 'container', w: 2, h: 2, stack: 1, pockets: [{ w: 3, h: 3, accepts: ['ammo', 'magazine'] }], iconSwatch: '#55603f', value: 45, rarity: 'uncommon' },
  // Wearables with storage.
  { id: 'jacket_field', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['torso'], grid: { w: 4, h: 2 }, warmth: 6, iconSwatch: '#5d6a48', value: 140 },
  { id: 'hoodie', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['torso'], pockets: [{ w: 2, h: 1 }, { w: 2, h: 1 }], warmth: 5, rainproof: 0.1, iconSwatch: '#5a5f6b', value: 60 },
  { id: 'military_jacket', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['torso'], pockets: [{ w: 2, h: 2 }, { w: 2, h: 2 }, { w: 1, h: 2 }, { w: 1, h: 2 }], warmth: 7, rainproof: 0.2, armour: 1, iconSwatch: '#4f5a3a', value: 220, rarity: 'uncommon' },
  { id: 'cargo_pants', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['legs'], pockets: [{ w: 2, h: 2 }, { w: 2, h: 2 }], warmth: 2, iconSwatch: '#6b6450', value: 90 },
  // Rig: four mag pouches that take magazines only, plus a small admin pouch.
  { id: 'tactical_vest', kind: 'clothing', w: 3, h: 3, stack: 1, slots: ['armor'], armour: 2, rarity: 'rare',
    pockets: [{ w: 1, h: 2, accepts: ['magazine'] }, { w: 1, h: 2, accepts: ['magazine'] }, { w: 1, h: 2, accepts: ['magazine'] }, { w: 1, h: 2, accepts: ['magazine'] }, { w: 2, h: 2 }],
    iconSwatch: '#3f4a32', value: 380 },
  // Headwear, face, eyes (worn; stats later except armour).
  { id: 'boots_work', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['feet'], warmth: 2, rainproof: 0.1, iconSwatch: '#47321f', value: 70 },
  { id: 'gloves_work', kind: 'clothing', w: 2, h: 1, stack: 1, slots: ['gloves'], warmth: 1, iconSwatch: '#26211c', value: 25 },
  { id: 'beanie', kind: 'clothing', w: 2, h: 1, stack: 1, slots: ['head'], warmth: 3, iconSwatch: '#7a2f2a', value: 12 },
  { id: 'cap', kind: 'clothing', w: 2, h: 1, stack: 1, slots: ['head'], warmth: 1, rainproof: 0.1, iconSwatch: '#2f4a6b', value: 10 },
  { id: 'helmet_military', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['head'], armour: 3, rarity: 'rare', warmth: 1, iconSwatch: '#4a5238', value: 300 },
  { id: 'gas_mask', kind: 'clothing', w: 2, h: 2, stack: 1, slots: ['face'], rarity: 'uncommon', warmth: 1, iconSwatch: '#33383a', value: 150 },
  { id: 'glasses', kind: 'clothing', w: 1, h: 1, stack: 1, slots: ['eyes'], iconSwatch: '#222628', value: 15 },
  { id: 'secure_pouch', kind: 'misc', w: 2, h: 2, stack: 1, slots: ['pouch'], grid: { w: 2, h: 2 }, iconSwatch: '#3f4a3a', value: 0 },
  // Backpacks: footprint < storage (research section 2). Alice has side pockets; the lab pack is rare.
  { id: 'backpack_small', kind: 'backpack', w: 3, h: 3, stack: 1, slots: ['backpack'], grid: { w: 4, h: 4 }, iconSwatch: '#6b5a3e', value: 180 },
  { id: 'school_bag', kind: 'backpack', w: 3, h: 3, stack: 1, slots: ['backpack'], grid: { w: 4, h: 4 }, iconSwatch: '#3a5f8a', value: 120 },
  { id: 'hiking_pack', kind: 'backpack', w: 3, h: 4, stack: 1, slots: ['backpack'], grid: { w: 5, h: 5 }, iconSwatch: '#8a5a2e', value: 260 },
  { id: 'military_pack', kind: 'backpack', w: 3, h: 4, stack: 1, slots: ['backpack'], grid: { w: 5, h: 6 }, rarity: 'uncommon', iconSwatch: '#4f5a3a', value: 340 },
  { id: 'alice_pack', kind: 'backpack', w: 4, h: 4, stack: 1, slots: ['backpack'], grid: { w: 6, h: 6 }, pockets: [{ w: 2, h: 4 }, { w: 2, h: 4 }], rarity: 'rare', iconSwatch: '#5d6a48', value: 520 },
  { id: 'large_hiking_pack', kind: 'backpack', w: 4, h: 5, stack: 1, slots: ['backpack'], grid: { w: 6, h: 7 }, rarity: 'rare', iconSwatch: '#6b3a2e', value: 600 },
  { id: 'laboratory_pack', kind: 'backpack', w: 5, h: 6, stack: 1, slots: ['backpack'], grid: { w: 7, h: 8 }, rarity: 'epic', iconSwatch: '#c9c4b0', value: 1100 },
  ...MORE_ITEMS,
  ...GUN_ITEMS,
  ...THROW_ITEMS,
  ...ATTACH_ITEMS,
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map((d) => [d.id, d]));

/** Old item id -> current id. Add a row whenever an id is renamed so existing saves keep their items (systems/saveRepair.ts). */
export const ITEM_RENAMES: Record<string, string> = {};

/**
 * World models for dropped items: the item's own `model` wins (weapons, magazines), then a per-item generic,
 * then one by kind. Backpacks are tinted with their iconSwatch so different packs read apart on the ground.
 */
export const PICKUP_MODELS = {
  byItem: {
    water_bottle: 'item_bottle', canteen: 'item_bottle', painkillers: 'item_bottle', antibiotics: 'item_box_small',
    energy_drink: 'item_can', canned_beans: 'item_can', canned_soup: 'item_can', canned_tuna: 'item_can',
    mre: 'item_bag_soft', ifak: 'item_bag_soft', medical_bag: 'item_bag_soft', cloth: 'item_bag_soft', cloth_rag: 'item_bag_soft',
    rope: 'item_bag_soft', wallet: 'item_bag_soft', secure_pouch: 'item_bag_soft', lunchbox: 'item_box_small',
    // Part 2 (items_more.ts): packaged goods reuse the box or bag, bottles the bottle; the rest has its own model or the kind default.
    crackers: 'item_box_small', cereal_box: 'item_box_small', instant_noodles: 'item_box_small', vitamins: 'item_bottle', antiseptic: 'item_bottle',
    sports_drink: 'item_bottle', thermos: 'item_bottle', dirty_water: 'item_bottle', juice_box: 'item_box_small', peanut_butter: 'item_bottle',
    tourniquet: 'item_bag_soft', saline_bag: 'item_bag_soft', first_aid_pouch: 'item_bag_soft', mag_pouch: 'item_bag_soft', tool_roll: 'item_bag_soft',
    tackle_box: 'item_box_small', battery: 'item_box_small', matches: 'item_box_small', screws: 'item_box_small', sheet_metal: 'item_box_small',
    ammo_762_box: 'item_box_small', sterile_gauze: 'item_box_small', energy_gel: 'item_bag_soft', trail_mix: 'item_bag_soft', sardines: 'item_can', canned_corn: 'item_can',
    honey_jar: 'item_bottle', iced_tea: 'item_bottle', glow_stick: 'item_bottle', headlamp: 'item_bag_soft', bandolier: 'item_bag_soft', scarf: 'item_bag_soft',
    canned_peaches: 'item_can', canned_chili: 'item_can', purification_tablets: 'item_bottle',
  } as Record<string, string>,
  /**
   * Own world models (Polyfork, CC BY 4.0, credited in CREDITS.md), loaded straight from public/assets/models/item/<file>.glb.
   * `size` is the longest side in metres; `upright` keeps it standing instead of lying flat.
   */
  files: {
    apple: { file: 'apple-b15012', size: 0.09, upright: true },
    bread_loaf: { file: 'bread-loaf-0e0ab5', size: 0.24, upright: true },
    chocolate_bar: { file: 'chocolate-bar-284f07', size: 0.15 },
    soda_can: { file: 'energy-drink-can-c47bcf', size: 0.13, upright: true },
    energy_drink: { file: 'energy-drink-can-c47bcf', size: 0.14, upright: true },
    first_aid_kit: { file: 'first-aid-bag-8a7f09', size: 0.3 },
    medical_bag: { file: 'first-aid-bag-8a7f09', size: 0.34 },
    water_jug: { file: 'camp-water-jug-1aba54', size: 0.36, upright: true },
    jerrycan: { file: 'fuel-jerrycan-6f1d85', size: 0.42 },
    fire_axe: { file: 'axe-b545d6', size: 0.75 },
    compass: { file: 'compass-d16dde', size: 0.08, upright: true },
    duffel_bag: { file: 'kit-bag-7d617f', size: 0.75 },
    daypack: { file: 'adventurer-s-backpack-b1365c', size: 0.6 },
    messenger_bag: { file: 'leather-belt-satchel-5bb107', size: 0.34, upright: true },
    waist_pack: { file: 'leather-belt-satchel-5bb107', size: 0.26, upright: true },
    bike_helmet: { file: 'skate-helmet-cf1e6e', size: 0.27, upright: true },
    helmet_military: { file: 'steel-helmet-f5aa7d', size: 0.3, upright: true },
    riot_helmet: { file: 'steel-helmet-f5aa7d', size: 0.3, upright: true },
    radio_handheld: { file: 'field-radio-set-b6f3fd', size: 0.3 },
    tackle_box: { file: 'tool-case-d92909', size: 0.4 },
    camping_lantern: { file: 'camping-lantern-21d14b', size: 0.26, upright: true },
    // E4 (gun polish session): more own pickup models; notes share the notebook, molotov the bottle
    wrench: { file: 'wrench-390c5f', size: 0.26 },
    cash: { file: 'banded-cash-bundle-7da278', size: 0.16 },
    tarp: { file: 'rolled-pitch-tarpaulin-c8a93f', size: 0.6 },
    rope: { file: 'rope-coil-776dcc', size: 0.32 },
    copper_wire: { file: 'decorative-wire-coil-50561a', size: 0.2 },
    note_maple_sick: { file: 'lab-notebook-e60f7a', size: 0.2 },
    note_school_roll: { file: 'lab-notebook-e60f7a', size: 0.2 },
    note_camp_diary: { file: 'lab-notebook-e60f7a', size: 0.2 },
    note_crash_log: { file: 'lab-notebook-e60f7a', size: 0.2 },
    note_ranger_log: { file: 'lab-notebook-e60f7a', size: 0.2 },
    note_lake_scanner: { file: 'lab-notebook-e60f7a', size: 0.2 },
    note_harlan_medic: { file: 'lab-notebook-e60f7a', size: 0.2 },
    field_manual: { file: 'lab-notebook-e60f7a', size: 0.24 },
    radio_crystal: { file: 'decorative-wire-coil-50561a', size: 0.12 },
    earmuffs: { file: 'headphones-d3e940', size: 0.2 },
    campfire_kit: { file: 'firewood-stack-810f49', size: 0.45 },
    torch: { file: 'pitch-torch-79d752', size: 0.5 },
    spear: { file: 'spear-e9824e', size: 1.5 },
    scope_4x: { file: 'weapon-scope-6b43b2', size: 0.3 },
    ammo_tin: { file: 'ammo-crate-ee3ec0', size: 0.3 },
    glass_bottle: { file: 'bottle-ca0f79', size: 0.25, upright: true },
    molotov: { file: 'bottle-ca0f79', size: 0.25, upright: true },
    medkit: { file: 'first-aid-bag-8a7f09', size: 0.3 },
    fuel_can: { file: 'fuel-jerrycan-6f1d85', size: 0.42 },
    repair_kit: { file: 'tool-case-d92909', size: 0.4 },
  } as Record<string, { file: string; size: number; upright?: boolean }>,
  /**
   * E4 round 2: code-built low-poly models (ui/inventory/pickupShapes.ts, own work) for items with no catalog match.
   * Item id -> shape key; clothing and packs share a shape per cut and are told apart by their iconSwatch.
   */
  shapes: {
    baseball_bat: 'bat', nail_bat: 'bat_nails', machete: 'machete', frag_grenade: 'grenade', flare: 'flare', road_flare: 'road_flare',
    binoculars: 'binoculars', lockpick: 'lockpick', duct_tape: 'duct_tape', multitool: 'multitool', bolt_cutters: 'bolt_cutters',
    can_opener: 'can_opener', lighter: 'lighter', whistle: 'whistle', sewing_kit: 'sewing_kit', flashlight_a: 'flashlight', cooking_pot: 'pot',
    hot_soup: 'bowl', hot_chili: 'bowl', hot_noodles: 'bowl',
    bandage: 'bandage', sterile_bandage: 'sterile_pack', splint: 'splint', antiviral: 'injector', adrenaline_shot: 'injector',
    energy_bar: 'wrapper_bar', beef_jerky: 'snack_bag',
    red_dot: 'red_dot', suppressor: 'suppressor',
    ammo_9mm: 'ammo_9mm', ammo_9mm_box: 'ammo_9mm_box', ammo_762: 'ammo_762', ammo_12ga: 'ammo_12ga', ammo_308: 'ammo_308', ammo_357: 'ammo_357',
    nails: 'nails', scrap_metal: 'scrap_metal', electronic_parts: 'electronics', gunpowder: 'gunpowder', metal_pipe: 'pipe', wood_planks: 'planks',
    // clothing by cut
    jacket_field: 'jacket', military_jacket: 'jacket', denim_jacket: 'jacket', raincoat: 'jacket', leather_jacket: 'jacket', hunting_jacket: 'jacket',
    police_jacket: 'jacket', hoodie: 'hoodie', flannel_shirt: 'shirt', puffer_jacket: 'puffer',
    cargo_pants: 'pants', track_pants: 'pants', jeans: 'pants', work_trousers: 'pants', tactical_pants: 'pants',
    hunting_vest: 'vest', fishing_vest: 'vest', construction_vest: 'hiviz_vest', chest_rig: 'chest_rig',
    tactical_vest: 'armor_vest', stab_vest: 'armor_vest', kevlar_vest: 'armor_vest', plate_carrier: 'armor_vest',
    boots_work: 'boots', hiking_boots: 'boots', combat_boots: 'boots', sneakers: 'sneakers', rubber_boots: 'tall_boots',
    gloves_work: 'gloves', gloves_winter: 'gloves', gloves_leather: 'gloves', gloves_tactical: 'gloves',
    cap: 'cap', hunting_cap: 'cap', beanie: 'beanie', bucket_hat: 'bucket_hat', cowboy_hat: 'cowboy_hat', hard_hat: 'hard_hat',
    motorcycle_helmet: 'moto_helmet', gas_mask: 'gas_mask', glasses: 'glasses', sunglasses: 'sunglasses', safety_goggles: 'goggles',
    surgical_mask: 'surgical_mask', bandana: 'bandana', balaclava: 'balaclava',
    // backpacks by build
    backpack_small: 'pack_small', school_bag: 'pack_school', kids_backpack: 'pack_kids', hiking_pack: 'pack_hiking',
    large_hiking_pack: 'pack_hiking_large', military_pack: 'pack_military', rucksack_military: 'pack_military', alice_pack: 'pack_alice',
    assault_pack: 'pack_assault', hydration_pack: 'pack_hydration', laboratory_pack: 'pack_lab',
  } as Record<string, string>,
  byKind: {
    backpack: 'item_backpack_generic', clothing: 'item_bag_soft', food: 'item_can', drink: 'item_can',
  } as Record<string, string>,
  fallback: 'item_box_small',
  tintKinds: ['backpack'] as string[],
  /** Generic models are tinted with the item's iconSwatch so different goods read apart on the ground. */
  tintModels: ['item_backpack_generic', 'item_bag_soft', 'item_bottle', 'item_box_small', 'item_can'] as string[],
};

/** Inventory rules (principles §8). Live-tunable from the debug menu. */
export const INVENTORY = {
  /** Backpack inside backpack ("bagception"): on by default. */
  bagception: true,
  /** Vicinity panel: shows ground items within this radius (m), laid out on a grid this wide. */
  vicinityRadius: 3,
  vicinityW: 8,
  /** Dropped items land this far in front of the player, m. */
  dropAhead: 0.7,
  /** Each new ground item is snapped onto the surface under it: ray from this far above its drop height down to this far below (m). */
  dropSnapUp: 0.6,
  dropSnapDown: 3,
  /** Hotbar keys 5..9 bind consumables by item id (by type, not by instance). */
  hotbar: ['bandage', 'canned_beans', 'water_bottle', 'flashlight_a', null] as (string | null)[],
  /** Order in which worn grids receive picked-up items. */
  fillOrder: ['torso', 'legs', 'armor', 'backpack'] as const,
};

/** M1 starting kit (worn items are equipped, the rest auto-placed). */
export const STARTING_KIT = {
  equip: { torso: 'jacket_field', backpack: 'backpack_small', melee: 'knife_a', pouch: 'secure_pouch', feet: 'boots_work', gloves: 'gloves_work' } as Record<string, string>,
  items: [
    { item: 'bandage', count: 3 },
    { item: 'canned_beans', count: 2 },
    { item: 'water_bottle', count: 2 },
    { item: 'splint', count: 1 },
    { item: 'wood_planks', count: 10 },
    { item: 'nails', count: 20 },
    { item: 'lockpick', count: 3 },
    { item: 'flashlight_a', count: 1 },
    { item: 'battery', count: 2 },
  ],
};
