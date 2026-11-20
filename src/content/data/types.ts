/**
 * Shared data shapes. systems-builder owns this file (lead approves contract changes).
 * Every tunable number in the game lives in a data table typed by these shapes (principles §15).
 * Text (names, descriptions) lives in src/content/text/ keyed by the same ids.
 */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type SlotName =
  | 'head' | 'face' | 'eyes' | 'ears' | 'torso' | 'armor' | 'legs' | 'gloves' | 'feet' | 'backpack'
  | 'primary' | 'secondary' | 'sidearm' | 'melee'
  /** M2: secure pouch (kept on death). */
  | 'pouch';
export type Caliber = '9mm' | '.45acp' | '5.56' | '7.62' | '.308' | '12ga' | '.357';

export interface ItemDef {
  id: string;
  kind: 'weapon' | 'magazine' | 'ammo' | 'medical' | 'food' | 'drink' | 'material' | 'tool' | 'clothing' | 'backpack' | 'misc' | 'valuable' | 'container';
  /** Grid footprint (cells). */
  w: number;
  h: number;
  stack: number;
  /** Equipment slot(s) it can go into. */
  slots?: SlotName[];
  /** Containers (backpacks, clothing with pockets): their inner grid. */
  grid?: { w: number; h: number };
  /** Extra sub-grids (side pockets, mag pouches). `accepts` limits which item kinds fit. Stored in ItemInstance.pockets. */
  pockets?: { w: number; h: number; accepts?: ItemDef['kind'][] }[];
  /** Fuel cans: litres a full one holds. */
  fuelCapacity?: number;
  /** Armour rating of worn gear (helmet 3 = infection-proof head, principles §7). */
  armour?: number;
  /** Worn warmth in comfort degrees (data/survival.ts WARMTH): jackets 3-10, hats and gloves 1-3. */
  warmth?: number;
  /** Worn rain protection 0..1; the sum over worn items (capped at 1) cancels that share of the rain chill. */
  rainproof?: number;
  /** Loot rarity (principles §9 tier weights). Default common. */
  rarity?: Rarity;
  /** Boxed goods: "Unpack" turns one into `count` of `item` (an ammo box into loose rounds). */
  unpack?: { item: string; count: number };
  /** Optional 3D model id from the asset manifest (world/hand model). */
  model?: string;
  /** Icon colour swatch for the placeholder icon until real icons exist. */
  iconSwatch?: string;
  value: number; // trader value, $
  /** Magazines and internal-mag weapons: the ammo item they load, and how many rounds fit. */
  ammo?: string;
  capacity?: number;
  /** Magazines: weapon item ids this magazine fits. */
  fits?: string[];
  /** Consumables: what using one does (survival stats arrive in M2; M1 only consumes it). */
  use?: {
    seconds: number; heal?: number; food?: number; water?: number; sound?: string;
    /** M2: statuses this item ends (StatusId values). */
    cures?: string[];
    /** M2: cures infection only up to this stage (antibiotics 2); omit = any stage when 'infection' is in cures. */
    infectionMaxStage?: number;
    /** Stamina boost (energy drink, painkillers); mechanics applies it from the itemUsed event. */
    stamina?: number;
    /** Rest restored, 0..100 points (coffee, soda, chocolate). */
    fatigue?: number;
    /** A risk taken by using it (dirty water): `chance` 0..1 of gaining `status` (infection starts at stage 1). */
    inflicts?: { status: string; chance: number };
    /** Instant body warmth, 0..100 points (hot food and drink). It fades back toward what the weather and clothes allow. */
    warmth?: number;
    /** Custom effect run by the world layer when the timer completes: 'radio' plays a broadcast, 'campfire' places a camp. */
    action?: 'radio' | 'campfire' | 'light' | 'read';
    /** Not consumed by use (the radio). */
    keep?: boolean;
  };
}

export interface WeaponDef {
  id: string; // same id as its ItemDef
  class: 'pistol' | 'smg' | 'rifle' | 'shotgun' | 'bolt' | 'lmg';
  caliber: Caliber;
  fireModes: ('semi' | 'auto')[];
  rpm: number;
  damage: number; // base damage per bullet/pellet
  pellets: number;
  muzzleVelocity: number; // m/s
  falloffStart: number; // R1, m (full damage until here)
  falloffMinMul: number; // damage multiplier at 2.5 * R1
  headMul: number; // vs zombies
  adsMs: number;
  sprintToFireMs: number;
  recoilPitch: [number, number]; // degrees per shot (min,max)
  recoilYaw: number; // ± degrees per shot
  recoverPerSec: number; // exponential recovery rate
  hipSpread: number; // degrees
  adsSpread: number;
  bloomPerShot: number;
  bloomMax: number;
  reloadTacticalS: number;
  reloadEmptyS: number;
  /** Magazine item ids that fit, or 'internal' for tube/internal magazines loaded from loose ammo. */
  magazines: string[] | 'internal';
  internalCapacity?: number;
  noise: number; // hearing radius, m
  durabilityPerShot: number;
}

export interface ItemInstance {
  uid: number;
  defId: string;
  count: number;
  /** 0..1 */
  durability?: number;
  /** Rounds loaded (magazines, internal-mag weapons). */
  rounds?: number;
  /** Weapons: the inserted magazine. */
  mag?: ItemInstance | null;
  /** Weapons: mounted attachments by slot (item ids; data/attachments.ts). */
  attach?: Record<string, string>;
  /** Containers/backpacks: their contents. */
  contents?: GridItem[];
  /** Sub-grid contents, one array per ItemDef.pockets entry. */
  pockets?: GridItem[][];
  rarity?: Rarity;
  /** Fuel cans: litres inside (absent = empty). */
  fuel?: number;
}

export interface GridItem {
  item: ItemInstance;
  x: number;
  y: number;
  rotated: boolean;
}

export interface ContainerDef {
  id: string;
  grid: { w: number; h: number };
  searchSeconds: number;
  lootTable: string;
  /** Lock difficulty 0 = unlocked. */
  lock: number;
  /** Zone tier 1..5 for rarity weighting (overrides the table's tier). */
  tier?: number;
  /** Sandbox only: contents are re-rolled every time it is opened (M1 weapon rack). */
  refillOnOpen?: boolean;
}

export interface LootTable {
  id: string;
  rolls: [number, number];
  /** Entries roll an item, or (with `table`) a nested shared table. */
  entries: { item?: string; table?: string; weight: number; count: [number, number] }[];
  /** Zone tier 1..5: scales entry weights by item rarity (principles §9). */
  tier?: number;
  /** Always added, before the weighted rolls. `rounds` = -1: magazines full, weapons loaded with a full magazine. */
  guaranteed?: { item: string; count: number; rounds?: number }[];
}

export interface VehicleDef {
  id: string;
  model: string; // asset id; wheels are separate nodes named WHEEL_FL/FR/RL/RR
  massKg: number;
  /** Chassis collider half-extents (m). */
  halfExtents: [number, number, number];
  wheelRadius: number;
  suspensionRest: number;
  suspensionStiffness: number;
  suspensionDamping: number;
  frictionSlip: number;
  engineForce: number;
  brakeForce: number;
  maxSteerDeg: number;
  topSpeedKmh: number;
  trunk: { w: number; h: number };
  fuelLiters: number;
  hp: number;
}

export interface BuildPieceDef {
  id: string;
  model: string;
  kind: 'foundation' | 'floor' | 'wall' | 'doorway' | 'door' | 'window' | 'stairs' | 'roof' | 'gable';
  tier: 'wood' | 'reinforced' | 'scrap' | 'concrete' | 'steel';
  hp: number;
  /** Model size in metres (w, h, d), also the placeholder box size. Pieces snap on the build grid (data/build.ts). */
  size: [number, number, number];
  cost: { item: string; count: number }[];
}

/** One crafting recipe (data/crafting.ts). Inputs are consumed, tools only have to be carried, a station has to be near. */
export interface RecipeDef {
  id: string;
  category: 'medical' | 'survival' | 'cooking' | 'weapons' | 'gear';
  inputs: { item: string; count: number }[];
  /** Each entry is a set of alternatives: carrying any one of them satisfies it (hammer OR crowbar). Not consumed. */
  tools?: string[][];
  /** Station that must be close: a lit campfire. 'workbench' is reserved (no workbench exists in the world yet). */
  station?: 'campfire' | 'workbench' | null;
  /** Seconds to craft (interrupted by damage). */
  seconds: number;
  outputs: { item: string; count: number }[];
  /** Repairs the item picked in the panel instead of producing outputs: `amount` of durability (0..1) on weapons. */
  repair?: { amount: number };
}
