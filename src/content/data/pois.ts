import { BUILDINGS, MAPLE_DZ as M, type BuildingDef } from './outskirts';
import { FILL_SPOTS } from './outskirts_fill';

/**
 * Points of interest in the outskirts south of the Yard (plain data). Metres, north = -Z.
 * The world builder (src/world/outskirts) places every container listed here, indoors and out, and registers it in
 * game.places.containers, so the items agent only edits loot tables (data/loot.ts), never positions. Container `type`
 * is a data/containers.ts id; `theme` is a CONTAINER_THEMES key (what the spot is for), so a table can be re-pointed per theme.
 * Zombie zones are data only: the zombie system may read `poiZombieZones` to place hordes.
 */
export type PoiTheme = 'gas' | 'farm' | 'house' | 'police' | 'camp' | 'school' | 'medical' | 'diner' | 'ranger' | 'road' | 'town' | 'military';
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
  /** `soldier` (0..1): share of a zone's zombies that are dead soldiers (army sites) */
  zombies: { x: number; z: number; radius: number; count: number; soldier?: number }[];
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
      c('school_locker', 'school', -142.3, 180.6 + M, Math.PI / 2, 'dorm-wardrobe'),
      c('school_locker', 'school', -142.3, 182.0 + M, Math.PI / 2, 'dorm-wardrobe'),
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

  // Dunmore, the town (buildings in outskirts_town.ts; the police station is its own tier-3 POI)
  {
    id: 'town', theme: 'town', tier: 2, x: -105, z: 135, radius: 40, landmark: 'brick-church',
    reason: 'Main Street: a pharmacy (medical), hardware store (tools), grocery (food) and a motel strip with bedrooms to search, under a church and clock tower.',
    containers: [
      c('car_trunk', 'town', -85.6, 138.8, 1.6, null),
      c('car_trunk', 'town', -97.4, 131.6, 1.5, null),
      c('car_trunk', 'town', -131.6, 131.4, 1.4, null),
    ],
    zombies: [{ x: -105, z: 134, radius: 18, count: 6 }, { x: -88, z: 122, radius: 3, count: 1 }, { x: -101.5, z: 122, radius: 3, count: 1 }, { x: -88, z: 146, radius: 3, count: 1 }, { x: -130, z: 144.5, radius: 3, count: 2 }, { x: -143, z: 134, radius: 5, count: 2 }],
  },
  {
    id: 'police', theme: 'police', tier: 3, x: -119, z: 124, radius: 14, landmark: 'department-store',
    reason: 'The town police station: lockers, desks and a locked armory with the best guns and ammo outside the army sites.',
    containers: [c('car_trunk', 'police', -122.4, 134.6, -1.5, null), c('car_trunk', 'police', -125.2, 133.6, 1.9, null)],
    zombies: [{ x: -119, z: 122, radius: 3, count: 3 }, { x: -119, z: 135, radius: 8, count: 3 }],
  },
  // Camp Harlan, the army outpost east of the farm (outskirts_outpost.ts)
  {
    id: 'outpost', theme: 'military', tier: 3, x: 132, z: 117, radius: 28, landmark: 'watchtower',
    reason: 'An overrun army outpost: barracks footlockers, a locked armory, and the motor pool. Its garrison still walks the fence.',
    containers: [
      c('car_trunk', 'military', 134.2, 126.6, 0.05, null),
      c('car_trunk', 'military', 143.6, 127, 0.08, null),
      c('military_crate', 'military', 131.4, 118.8, 0.3, null),
      c('military_footlocker', 'military', 113.4, 114.6, 0.2, null),
    ],
    zombies: [
      { x: 132, z: 118, radius: 16, count: 6, soldier: 0.75 },
      { x: 127, z: 108.6, radius: 3, count: 3, soldier: 0.9 },
      { x: 144, z: 108, radius: 2.2, count: 2, soldier: 1 },
      { x: 100, z: 118, radius: 6, count: 2, soldier: 0.5 },
    ],
  },
  // micro-POIs (models in outskirts_fill.ts)
  {
    id: 'bus', theme: 'road', tier: 1, x: -22, z: 240, radius: 9, landmark: 'city-bus',
    reason: 'A city bus that broke down on the crash-site road: luggage and a cooler left behind.',
    containers: [c('camp_stash', 'camp', -20.8, 242.4, 0.4, 'camp-cooler'), c('duffel', 'camp', -24.5, 236.4, 0.8, 'kit-bag'), c('car_trunk', 'road', -16.3, 239.6, 1.6, null)],
    zombies: [{ x: -22, z: 240, radius: 6, count: 3 }],
  },
  {
    id: 'stand', theme: 'camp', tier: 1, x: -84, z: 231, radius: 9, landmark: 'splay-leg-lookout-tower',
    reason: 'A hunting stand with a cold camp at its foot: a stash and a duffel, and a view over the whole west side.',
    containers: [c('camp_stash', 'camp', -82.4, 232.4, 0.3, 'camp-cooler'), c('duffel', 'camp', -85.4, 229.6, 1.1, 'kit-bag')],
    zombies: [{ x: -84, z: 232, radius: 7, count: 2 }],
  },
  {
    id: 'memorial', theme: 'road', tier: 1, x: 10, z: 199, radius: 8, landmark: 'roadside-capilla-shrine',
    reason: 'A roadside shrine with offerings left in a bag: someone still comes here, or someone did.',
    containers: [c('duffel', 'camp', 8.0, 203.4, 0.4, 'kit-bag'), c('camp_stash', 'camp', 12.6, 198.4, 0.2, 'camp-cooler')],
    zombies: [{ x: 10, z: 199, radius: 5, count: 2 }],
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
for (const f of FILL_SPOTS) poiSpots.push(f);
export const poiById: Record<string, PoiDef> = Object.fromEntries(POIS.map((p) => [p.id, p]));
export const poiZombieZones = POIS.flatMap((p) => p.zombies.map((z) => ({ ...z, poi: p.id, tier: p.tier })));

/** Streaming zombie population for the outskirts zones (read by gameplay/zombies Zombies.updatePoiSpawns). */
export const POI_SPAWN = {
  /** a zone fills when the player is within this + its radius (m) */
  activate: 85,
  /** beyond this distance an unseen zone is emptied again (the zombies go back to nothing; corpses stay) */
  despawn: 160,
  /** never closer to the player than this, never inside the camera frustum */
  minFromPlayer: 24,
  /** tier 1..3 multiplies a zone's `count` (danger rises with distance from the start) */
  tierScale: { 1: 0.7, 2: 1, 3: 1.5 } as Record<number, number>,
  /** alive outskirts zombies at once (the yard's own cap, horde.maxAlive, still applies) */
  cap: 22,
  /** seconds between spawn checks */
  interval: 0.7,
  /** a zone that was cleared stays empty until the player has left and this many seconds passed */
  respawnS: 240,
};
