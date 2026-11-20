import { BUILDINGS, MAPLE_DZ as M, type BuildingDef } from './outskirts';

/**
 * Points of interest in the outskirts south of the Yard (plain data). Metres, north = -Z.
 * The world builder (src/world/outskirts) places every container listed here, indoors and out, and registers it in
 * game.places.containers, so the items agent only edits loot tables (data/loot.ts), never positions. Container `type`
 * is a data/containers.ts id; `theme` is a CONTAINER_THEMES key (what the spot is for), so a table can be re-pointed per theme.
 * Zombie zones are data only: the zombie system may read `poiZombieZones` to place hordes.
 */
export type PoiTheme = 'gas' | 'farm' | 'house' | 'police' | 'camp' | 'school' | 'medical' | 'diner' | 'ranger';
export interface PoiContainer {
  type: string;
  theme: string;
  x: number;
  z: number;
  yaw: number;
  y?: number;
  /** Polyfork model for the look (null = none, e.g. a car trunk uses the car itself) */
  model: string | null;
}
export interface PoiDef {
  id: string;
  theme: PoiTheme;
  /** loot / danger tier 1..3, rises with distance from the start (visible: wrecks, fences, warning signs) */
  tier: 1 | 2 | 3;
  x: number;
  z: number;
  radius: number;
  /** model key of the silhouette seen from far away */
  landmark: string;
  /** reason to visit */
  reason: string;
  /** outdoor containers (indoor ones come from the building defs) */
  containers: PoiContainer[];
  zombies: { x: number; z: number; radius: number; count: number }[];
}

const c = (type: string, theme: string, x: number, z: number, yaw: number, model: string | null, y?: number): PoiContainer => ({ type, theme, x, z, yaw, model, ...(y ? { y } : {}) });

export const POIS: PoiDef[] = [
  {
    id: 'checkpoint', theme: 'police', tier: 2, x: 4, z: 122, radius: 34, landmark: 'site-lighting-tower',
    reason: 'First military cache outside the walls: footlockers, a locked police locker and an ambulance full of supplies.',
    containers: [
      c('military_footlocker', 'military', -21.4, 119.4, 0.1, 'ammo-crate'),
      c('military_crate', 'military', 22.4, 130.6, 0.15, 'salvage-crate'),
      c('police_locker', 'police', -9.8, 131.2, Math.PI / 2, 'filing-cabinet'),
      c('car_trunk', 'police', 8.6, 122.7, 0.25, null),
      c('medical_cabinet', 'medical', 16.4, 139.4, -2.7, 'salvage-crate'),
    ],
    zombies: [{ x: 0, z: 126, radius: 14, count: 4 }, { x: 28, z: 124, radius: 8, count: 2 }],
  },
  {
    id: 'fuel', theme: 'gas', tier: 1, x: -30, z: 158, radius: 28, landmark: 'pump-island-canopy',
    reason: 'Fuel, food and tools: the shop shelves, a workshop with garage shelves and a wreck in the bay.',
    containers: [
      c('car_trunk', 'gas_station', -21.6, 160.2, 1.7, null),
      c('car_trunk', 'gas_station', -20.4, 143.8, -1.45, null),
      c('crate_wood', 'garage', -38.6, 156.2, 0.4, 'wooden-crate'),
    ],
    zombies: [{ x: -28, z: 156, radius: 14, count: 5 }, { x: -30, z: 172, radius: 8, count: 3 }],
  },
  {
    id: 'maple', theme: 'house', tier: 1, x: -70, z: 186 + M, radius: 62, landmark: 'two-storey-family-house',
    reason: 'A dead suburb: two furnished houses to search room by room, cars in the driveways, a school bus at the far end.',
    containers: [
      c('car_trunk', 'house', -48.6, 176.2 + M, 1.45, null),
      c('car_trunk', 'house', -22.1, 176.8 + M, 0.2, null),
      c('car_trunk', 'house', -53.6, 197.6 + M, 2.9, null),
      c('garage_shelf', 'garage', -62, 200.4 + M, Math.PI, 'back-bar-shelf-unit'),
    ],
    zombies: [{ x: -62, z: 186 + M, radius: 20, count: 4 }, { x: -100, z: 186 + M, radius: 20, count: 4 }, { x: -62, z: 172 + M, radius: 3, count: 1 }, { x: -36, z: 201 + M, radius: 3, count: 1 }],
  },
  {
    id: 'school', theme: 'school', tier: 2, x: -146, z: 186 + M, radius: 22, landmark: 'one-room-schoolhouse',
    reason: 'An evacuation point that never emptied: lockers and desks beside a stranded school bus.',
    containers: [
      c('school_locker', 'school', -143.2, 180.6 + M, Math.PI / 2, 'dorm-wardrobe'),
      c('school_locker', 'school', -143.2, 182.0 + M, Math.PI / 2, 'dorm-wardrobe'),
      c('office_desk', 'school', -143.4, 191.0 + M, Math.PI / 2, 'filing-cabinet'),
      c('car_trunk', 'school', -124.6, 192.6 + M, 1.75, null),
    ],
    zombies: [{ x: -146, z: 190 + M, radius: 12, count: 5 }],
  },
  {
    id: 'farm', theme: 'farm', tier: 2, x: 112, z: 168, radius: 56, landmark: 'rolled-plate-silo',
    reason: "The valley's food: a barn with silos, a hay shed with tools, a farmhouse pantry and fields to cross.",
    containers: [
      c('car_trunk', 'farm', 87.2, 170.4, 1.2, null),
      c('farm_shed', 'farm', 113.6, 152.2, 0.2, 'wooden-crate'),
      c('tool_box', 'farm', 121.6, 170.4, 0.3, 'wooden-crate'),
    ],
    zombies: [{ x: 112, z: 160, radius: 18, count: 5 }, { x: 134, z: 206, radius: 16, count: 4 }, { x: 90, z: 184, radius: 3, count: 1 }],
  },
  {
    id: 'diner', theme: 'diner', tier: 1, x: 36, z: 220, radius: 30, landmark: 'streamline-diner-car',
    reason: 'The crossroads diner: abandoned trucks, a stocked kitchen out back and the road to the camp, farm and ranger ridge.',
    containers: [
      c('kitchen_cupboard', 'office', 32.6, 223.4, 0, 'fridge-freezer'),
      c('office_desk', 'office', 48.0, 222.8, Math.PI, 'filing-cabinet'),
      c('car_trunk', 'diner', 30.6, 227.4, 0.3, null),
      c('car_trunk', 'diner', 50.6, 229.2, 1.6, null),
    ],
    zombies: [{ x: 36, z: 222, radius: 14, count: 4 }],
  },
  {
    id: 'camp', theme: 'camp', tier: 2, x: 40, z: 268, radius: 34, landmark: 'campground-pine-stand',
    reason: 'An abandoned campground in the pines: stashes, coolers and a camper van, far enough out to be dangerous at night.',
    containers: [
      c('camp_stash', 'camp', 44.6, 270.4, 0.4, 'camp-cooler'),
      c('camp_stash', 'camp', 30.8, 261.6, 0.2, 'camp-cooler'),
      c('duffel', 'camp', 33.4, 273.6, 0.8, 'kit-bag'),
      c('car_trunk', 'camp', 58.4, 278.4, 0.5, null),
      c('camp_stash', 'camp', 53.8, 262.2, 0.0, 'camp-cooler'),
    ],
    zombies: [{ x: 40, z: 268, radius: 16, count: 5 }],
  },
  {
    id: 'crash', theme: 'medical', tier: 3, x: -66, z: 262, radius: 34, landmark: 'air-ambulance-helicopter',
    reason: 'A crashed medevac helicopter and a field aid tent: the best medical and military loot in the valley, guarded.',
    containers: [
      c('medical_cabinet', 'medical', -57.8, 252.8, 0.2, 'salvage-crate'),
      c('pharmacy_shelf', 'medical', -53.0, 254.6, 0.1, 'back-bar-shelf-unit'),
      c('military_crate', 'military', -77.6, 264.0, 0.3, 'salvage-crate'),
      c('military_footlocker', 'military', -72.2, 268.2, 1.1, 'ammo-crate'),
    ],
    zombies: [{ x: -66, z: 262, radius: 16, count: 8 }, { x: -96, z: 246, radius: 8, count: 3 }],
  },
  {
    id: 'ranger', theme: 'ranger', tier: 3, x: 124, z: 262, radius: 30, landmark: 'fire-lookout-tower',
    reason: 'The ranger post and its fire lookout: the highest vantage in the valley, a sandbagged truck and locked footlockers.',
    containers: [
      c('military_footlocker', 'military', 121.6, 267.4, 0.3, 'ammo-crate'),
      c('office_desk', 'office', 127.0, 258.0, 0.3, 'filing-cabinet'),
      c('car_trunk', 'military', 138.0, 249.0, 2.2, null),
      c('military_crate', 'military', 116.0, 270.0, 0.0, 'salvage-crate'),
    ],
    zombies: [{ x: 124, z: 262, radius: 14, count: 6 }],
  },
];

/** Building-local (u, v) to world x, z (local +v is the front wall; yaw as in BuildingDef). */
export const buildingWorld = (b: BuildingDef, u: number, v: number) => ({
  x: b.x + u * Math.cos(b.yaw) + v * Math.sin(b.yaw),
  z: b.z - u * Math.sin(b.yaw) + v * Math.cos(b.yaw),
});

/** Every container spot, indoors and out, in world coordinates (what the builder places). */
export interface PoiSpot extends PoiContainer { poi: string; id: string; building?: string }
export const poiSpots: PoiSpot[] = [];
for (const p of POIS) p.containers.forEach((k, i) => poiSpots.push({ ...k, poi: p.id, id: `${p.id}_out${i}` }));
for (const b of BUILDINGS) {
  b.containers.forEach((k, i) => {
    const w = buildingWorld(b, k.u, k.v);
    poiSpots.push({ type: k.type, theme: k.theme, x: w.x, z: w.z, yaw: b.yaw + (k.yaw ?? 0), ...(k.y ? { y: k.y } : {}), model: k.model, poi: b.poi, id: `${b.id}_${i}`, building: b.id });
  });
}
export const poiById: Record<string, PoiDef> = Object.fromEntries(POIS.map((p) => [p.id, p]));
export const poiZombieZones = POIS.flatMap((p) => p.zombies.map((z) => ({ ...z, poi: p.id, tier: p.tier })));
