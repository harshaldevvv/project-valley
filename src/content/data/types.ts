/**
 * Shared data shapes. systems-builder owns this file (lead approves contract changes).
 * Every tunable number in the game lives in a data table typed by these shapes (principles §15).
 * Text (names, descriptions) lives in src/content/text/ keyed by the same ids.
 */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type SlotName =
  | 'head' | 'face' | 'eyes' | 'ears' | 'torso' | 'armor' | 'legs' | 'gloves' | 'feet' | 'backpack'
  | 'primary' | 'secondary' | 'sidearm' | 'melee';
export type Caliber = '9mm' | '.45acp' | '5.56' | '7.62' | '.308' | '12ga';

export interface ItemDef {
  id: string;
  kind: 'weapon' | 'magazine' | 'ammo' | 'medical' | 'food' | 'drink' | 'material' | 'tool' | 'clothing' | 'backpack' | 'misc';
  /** Grid footprint (cells). */
  w: number;
  h: number;
  stack: number;
  /** Equipment slot(s) it can go into. */
  slots?: SlotName[];
  /** Containers (backpacks, clothing with pockets): their inner grid. */
  grid?: { w: number; h: number };
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
  use?: { seconds: number; heal?: number; food?: number; water?: number; sound?: string };
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
  /** Containers/backpacks: their contents. */
  contents?: GridItem[];
  rarity?: Rarity;
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
  /** Sandbox only: contents are re-rolled every time it is opened (M1 weapon rack). */
  refillOnOpen?: boolean;
}

export interface LootTable {
  id: string;
  rolls: [number, number];
  entries: { item: string; weight: number; count: [number, number] }[];
  /** Always added, before the weighted rolls. `rounds` = -1 fills magazines to capacity. */
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
  kind: 'foundation' | 'floor' | 'wall' | 'doorway' | 'door' | 'window' | 'stairs' | 'roof';
  tier: 'wood' | 'reinforced' | 'scrap' | 'concrete' | 'steel';
  hp: number;
  /** Model size in metres (w, h, d), also the placeholder box size. Pieces snap on the build grid (data/build.ts). */
  size: [number, number, number];
  cost: { item: string; count: number }[];
}
