/**
 * Wearable parts for the Polyfork hero chr_hero_pf (library chr_hero_pf_parts.glb, built by tools/audit/build_pf_parts.py from
 * tools/audit/pf_parts.json). A part id starts with its slot (`hat_infantry` -> hat). Worn items pick a part through
 * PF_ITEM_PARTS; the hero's own mesh for that slot (chr_hero_pf_<MESH>) is hidden while a part is worn there.
 */
export type PfSlot = 'hat' | 'eyes' | 'coat' | 'top' | 'bottom' | 'feet' | 'hands' | 'belt' | 'neck' | 'back';

/** Inventory slots read for the hero's look (gear slots only). */
export const PF_INV_SLOTS = ['head', 'face', 'eyes', 'torso', 'armor', 'legs', 'gloves', 'feet', 'backpack', 'pouch'] as const;

/** Hero meshes hidden while a part is worn in the slot. */
export const PF_SLOT_HIDES: Record<PfSlot, string[]> = {
  hat: [], eyes: [], coat: ['COAT'], top: ['TOP'], bottom: ['BOTTOM'], feet: ['FEET'], hands: [], belt: [], neck: [], back: ['BACKPACK'],
};
/** Full-head helmets and beanies also hide the hair (it would poke through). */
export const PF_HIDES_HAIR = new Set(['hat_infantry', 'hat_firefighter', 'hat_medic', 'hat_beanie', 'hat_hardhat']);
/** The hero's own backpack mesh only shows when a backpack is worn and maps to it (back_school does). */
export const PF_DEFAULT_HIDDEN = ['BACKPACK'];

/** Item def id -> part id. Items without an entry change nothing visible. */
export const PF_ITEM_PARTS: Record<string, string> = {
  // backpacks
  backpack_small: 'back_school', school_bag: 'back_school', daypack: 'back_school', waist_pack: 'back_satchel', messenger_bag: 'back_satchel',
  hiking_pack: 'back_hiker', large_hiking_pack: 'back_big', military_pack: 'back_big', alice_pack: 'back_big', rucksack_military: 'back_big',
  duffel_bag: 'back_medic', laboratory_pack: 'back_medic',
  // head
  helmet_military: 'hat_infantry', hard_hat: 'hat_hardhat', riot_helmet: 'hat_firefighter', bike_helmet: 'hat_firefighter',
  cap: 'hat_trucker', hunting_cap: 'hat_trucker', beanie: 'hat_beanie', bucket_hat: 'hat_bucket',
  // eyes
  glasses: 'eyes_sunglasses', sunglasses: 'eyes_sunglasses', safety_goggles: 'eyes_workgoggles',
  // jackets
  jacket_field: 'coat_ranger', military_jacket: 'coat_ranger', hunting_jacket: 'coat_ranger', hoodie: 'coat_hoodie', raincoat: 'coat_hiker',
  puffer_jacket: 'coat_skier', leather_jacket: 'coat_duster', police_jacket: 'coat_police', flannel_shirt: 'coat_flannel', denim_jacket: 'coat_mountain',
  // vests and rigs
  tactical_vest: 'belt_webbing', chest_rig: 'belt_webbing', plate_carrier: 'belt_webbing', kevlar_vest: 'belt_webbing', stab_vest: 'belt_duty',
  hunting_vest: 'coat_fishvest', fishing_vest: 'coat_fishvest',
  // legs and feet
  cargo_pants: 'bottom_infantry', tactical_pants: 'bottom_infantry', work_trousers: 'bottom_work', jeans: 'bottom_jeans', track_pants: 'bottom_police',
  boots_work: 'feet_hiker', hiking_boots: 'feet_hiker', combat_boots: 'feet_combat', rubber_boots: 'feet_rubber',
  // gloves
  gloves_work: 'hands_work', gloves_leather: 'hands_work', gloves_tactical: 'hands_tactical', gloves_winter: 'hands_winter',
};

/** First-person arm colours by worn coat / gloves part (sleeve, hand); hero shirt and bare skin otherwise. */
export const PF_FP_COLOURS: Record<string, string> = {
  coat_mountain: '#2c3550', coat_ranger: '#5d6440', coat_hiker: '#b8382e', coat_skier: '#3b6fa8', coat_duster: '#8c7454',
  coat_police: '#2f3b5c', coat_hoodie: '#d9d2c4', coat_hivis: '#e0a020', coat_flannel: '#8a2a2a', coat_firefighter: '#4a4a3a',
  coat_fishvest: '#7fb0bd', hands_work: '#6e4a33', hands_winter: '#2a2a2e', hands_tactical: '#2b2b2b',
};
export const PF_FP_SKIN = '#d9a77f';
