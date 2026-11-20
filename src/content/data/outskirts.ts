/**
 * The outskirts south of the Yard: plain data (no three.js). Metres, +Y up, north = -Z, yaw about +Y (radians).
 * A Polyfork model's front is its local +Z, so `face(x, z, tx, tz)` gives the yaw that turns a model's front toward a point.
 * Built by src/world/outskirts; POIs and loot spots are in pois.ts.
 *
 *   yard wall z=100 ... gate (0,100)
 *        |  checkpoint z 103..138
 *        |  fuel stop (-50..-4, 138..180) west          billboard east
 *        +--- RE z=165 -> farm (60..160, 138..230)
 *        +--- RW z=186 -> Maple Street (-135..-3), school at the west end
 *        |  diner / crossroads z~215
 *        |  crash site (-110..-40, 235..290)    camp (15..70, 246..290)    ranger ridge (120..155, 240..290)
 */
import { TOWN_BUILDINGS, TOWN_CLEAR, TOWN_PADS, TOWN_PLACED, TOWN_ROADS, TOWN_SIGNS } from './outskirts_town';
import { OUTPOST_BUILDINGS, OUTPOST_CLEAR, OUTPOST_PADS, OUTPOST_PLACED, OUTPOST_ROADS, OUTPOST_SIGNS } from './outskirts_outpost';
export type SurfaceTag = 'grass' | 'dirt' | 'concrete' | 'wood' | 'metal' | 'rubber' | 'chainlink';

/** The flat, playable plateau (terrain.ts blends the hills back in over `blend` m beyond it). */
export const OUT = { x0: -160, x1: 160, z0: 100, z1: 300, blend: 40 } as const;

/** Maple Street runs along z = 186 + MAPLE_DZ (shifted south so the fuel stop and the street do not overlap). */
export const MAPLE_DZ = 12;
export const face = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);

// ---------------------------------------------------------------- roads
export interface RoadSeg { ax: number; az: number; bx: number; bz: number; w: number; kind: 'asphalt' | 'dirt'; dashes?: boolean }
export const ROADS: RoadSeg[] = [
  { ax: 0, az: 98, bx: 0, bz: 268, w: 7, kind: 'asphalt', dashes: true }, // main road from the south gate
  { ax: 0, az: 186 + MAPLE_DZ, bx: -136, bz: 186 + MAPLE_DZ, w: 6.5, kind: 'asphalt', dashes: true }, // Maple Street
  { ax: 0, az: 165, bx: 100, bz: 165, w: 6.5, kind: 'asphalt', dashes: true }, // farm road
  { ax: 0, az: 232, bx: 70, bz: 232, w: 6, kind: 'asphalt', dashes: true }, // diner / ranger road east
  { ax: 0, az: 244, bx: -78, bz: 252, w: 6, kind: 'asphalt', dashes: true }, // crash-site road west
  { ax: 100, az: 165, bx: 118, bz: 165, w: 5, kind: 'dirt' }, // farm track
  { ax: 118, az: 165, bx: 118, bz: 146, w: 5, kind: 'dirt' },
  { ax: 70, az: 232, bx: 124, bz: 246, w: 4.5, kind: 'dirt' }, // ranger track
  { ax: 124, az: 246, bx: 136, bz: 270, w: 4.5, kind: 'dirt' },
  { ax: 0, az: 262, bx: 24, bz: 258, w: 4.5, kind: 'dirt' }, // camp track
  { ax: 24, az: 258, bx: 40, bz: 268, w: 4.5, kind: 'dirt' },
];
/** Rectangular pads (concrete aprons, farmyard dirt, scorched earth): x, z, w, d, swatch. */
export const PADS: { x: number; z: number; w: number; d: number; sw: string; y?: number }[] = [
  { x: -20, z: 152, w: 36, d: 24, sw: 'concrete' }, // fuel apron
  { x: -24, z: 172, w: 24, d: 14, sw: 'concrete' }, // workshop apron
  { x: 0, z: 262, w: 14, d: 10, sw: 'asphalt' }, // road turnaround
  { x: 112, z: 158, w: 40, d: 30, sw: 'dirt' }, // farmyard
  { x: -66, z: 262, w: 22, d: 18, sw: 'mud' }, // crash scorch
  { x: 40, z: 266, w: 22, d: 20, sw: 'dirt' }, // camp ground
  { x: 14, z: 118, w: 40, d: 22, sw: 'concrete' }, // checkpoint apron (east)
  { x: -18, z: 122, w: 24, d: 24, sw: 'concrete' }, // checkpoint apron (west)
  { x: 122, z: 262, w: 26, d: 20, sw: 'dirt' }, // ranger yard
  { x: 35, z: 224, w: 26, d: 14, sw: 'concrete' }, // diner lot
];

// ---------------------------------------------------------------- placed models
export interface Placed {
  chunk: string; // one merged mesh per chunk (one draw call, frustum culled)
  k: string; // Polyfork base name (modelFiles.ts)
  x: number;
  z: number;
  yaw: number;
  s?: number;
  y?: number;
  /** false = no collider; a number shrinks the bbox collider; boxes = [x,y,z,hx,hy,hz] in the model's own frame (centre of footprint, y up). */
  solid?: boolean;
  shrink?: number;
  boxes?: [number, number, number, number, number, number][];
  surf?: SurfaceTag;
  /** multiplies the model's vertex colours (a model that renders too dark) */
  lift?: number;
}
export const PLACED: Placed[] = [];
const add = (chunk: string, k: string, x: number, z: number, yaw = 0, o: Partial<Placed> = {}) => PLACED.push({ chunk, k, x, z, yaw, ...o });
/** A straight run of fence sections of length `len`, along the segment (x0,z0)-(x1,z1). Sections along the segment, `skip` indices left open (gaps). */
const run = (chunk: string, k: string, len: number, x0: number, z0: number, x1: number, z1: number, o: Partial<Placed> = {}, skip: number[] = []) => {
  const total = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(total / len));
  const dx = (x1 - x0) / total, dz = (z1 - z0) / total;
  const yaw = Math.atan2(-dz, dx);
  for (let i = 0; i < n; i++) {
    if (skip.includes(i)) continue;
    const t = ((i + 0.5) * total) / n;
    add(chunk, k, x0 + dx * t, z0 + dz * t, yaw, o);
  }
};
const rect = (chunk: string, k: string, len: number, x0: number, z0: number, x1: number, z1: number, o: Partial<Placed> = {}, skip: Record<string, number[]> = {}) => {
  run(chunk, k, len, x0, z0, x1, z0, o, skip.n); // north
  run(chunk, k, len, x1, z0, x1, z1, o, skip.e);
  run(chunk, k, len, x1, z1, x0, z1, o, skip.s);
  run(chunk, k, len, x0, z1, x0, z0, o, skip.w);
};

// ---- Gate checkpoint (military/police, tier 2)
{
  const c = 'checkpoint';
  add(c, 'security-gatehouse', -13, 125, Math.PI / 2);
  add(c, 'sandbag-wall-section', -6.6, 120, Math.PI / 2);
  add(c, 'sandbag-wall-section', -6.6, 130, Math.PI / 2);
  add(c, 'sandbag-wall-section', -8.4, 117.6, 0.3);
  add(c, 'military-cargo-truck', 9.6, 126, 0.25);
  add(c, 'ambulance-van', 15.5, 137, -2.7);
  add(c, 'soldiers-tent', -25, 113, 0.3);
  add(c, 'soldiers-tent', -25, 121, -0.2);
  add(c, 'field-hospital-marquee', 27, 122, 0.15);
  add(c, 'site-lighting-tower', 6.4, 114.6, 1.5);
  add(c, 'medium-tank', 25, 108, 2.9);
  add(c, 'czech-hedgehog', 1.8, 121, 0.4);
  add(c, 'czech-hedgehog', -1.6, 125.5, 1.1);
  add(c, 'czech-hedgehog', 2.6, 131, 2.0);
  add(c, 'crash-barrier-run', -11.5, 133.5, Math.PI / 2 + 0.1);
  add(c, 'crash-barrier-run', 6.2, 108.5, 0.15);
  run(c, 'mesh-site-fence-run', 4, 14, 134, 38, 134);
  run(c, 'mesh-site-fence-run', 4, 38, 134, 38, 112);
  for (const [x, z] of [[-4.6, 115], [-3.4, 117], [4.8, 117], [3.4, 119.5], [-1, 135.5]]) add(c, 'traffic-cone', x, z, 0, { solid: false });
  for (const z of [110, 116, 122]) add(c, 'minefield-warning-sign', -32, z, Math.PI / 2, { solid: false });
  add(c, 'oil-drum', -19, 126, 0);
  add(c, 'oil-drum', -18.3, 126.6, 0);
  add(c, 'salvage-crate', -21.4, 117.6, 0.3);
  add(c, 'ammo-crate', 22.4, 118.6, 0.2, { solid: false });
  add(c, 'ammo-crate', 22.7, 118.1, 0.7, { solid: false });
  add(c, 'metal-trash-can', -10.5, 119.6, 0);
}

// ---- Route 9 Fuel Stop (gas, tier 1)
{
  const c = 'fuel';
  // canopy long axis along the road; poles at local (+-2, +-3)
  add(c, 'pump-island-canopy', -14, 154, Math.PI / 2, { boxes: [[2, 2.7, 3, 0.25, 2.7, 0.25], [-2, 2.7, 3, 0.25, 2.7, 0.25], [2, 2.7, -3, 0.25, 2.7, 0.25], [-2, 2.7, -3, 0.25, 2.7, 0.25]] });
  for (const z of [152.4, 155.6]) {
    add(c, 'globe-gas-pump', -14.35, z, Math.PI / 2);
    add(c, 'gas-pump', -13.65, z, -Math.PI / 2);
  }
  add(c, 'auto-repair-garage', -51, 160, Math.PI / 2);
  add(c, 'depot-fuel-tank', -42, 141, 0);
  add(c, 'roadside-billboard', 11, 146, Math.PI);
  add(c, 'diner-sign', -6, 141, Math.PI);
  for (const [x, z, a] of [[-27.0, 146.8, 0.1], [-27.1, 146.2, 0.5]] as const) add(c, 'fuel-jerrycan', x, z, a, { solid: false });
  add(c, 'newspaper-box', -26.6, 145.4, Math.PI / 2);
  add(c, 'vending-machine', -29.5, 158.4, 0);
  add(c, 'soda-vending-machine', -31.5, 158.4, 0);
  add(c, 'pay-phone-booth', -25.5, 160.5, Math.PI / 2);
  add(c, 'fire-hydrant', -7.5, 162, 0);
  add(c, 'construction-dumpster', -38.5, 148, Math.PI / 2);
  add(c, 'tow-truck', -17, 175.5, 1.25);
  add(c, 'station-wagon-70s', -21, 163.5, 1.7);
  add(c, 'suburban-pickup-truck', -22, 142, -1.45);
  add(c, 'family-crossover-suv', -9.2, 188.4 + MAPLE_DZ, -0.5, { surf: 'metal' });
  add(c, 'campsite-picnic-table', -36.5, 163, 0.4);
  for (const [x, z, a] of [[-37.5, 168, 0], [-36.6, 168.7, 0.4], [-38.1, 169.2, 1]] as const) add(c, 'tire', x, z, a, { solid: false });
  add(c, 'oil-drum', -41.5, 152, 0);
  add(c, 'oil-drum', -40.8, 152.7, 0);
  add(c, 'oil-drum', -41.7, 153.2, 0);
  add(c, 'metal-trash-can', -26.4, 156.6, 0);
  add(c, 'traffic-cone', -9, 150, 0, { solid: false });
  add(c, 'traffic-cone', -9.2, 158, 0, { solid: false });
  add(c, 'street-lamp', -4.6, 150, -Math.PI / 2);
  add(c, 'route-shield-sign', 5.6, 139, -Math.PI / 2);
}

// ---- Maple Street (houses, tier 1) and the school at its west end
{
  const M = MAPLE_DZ;
  const addM = (chunk: string, k: string, x: number, z: number, yaw = 0, o: Partial<Placed> = {}) => add(chunk, k, x, z + M, yaw, o);
  const runM = (chunk: string, k: string, len: number, x0: number, z0: number, x1: number, z1: number, o: Partial<Placed> = {}, skip: number[] = []) => run(chunk, k, len, x0, z0 + M, x1, z1 + M, o, skip);
  const rectM = (chunk: string, k: string, len: number, x0: number, z0: number, x1: number, z1: number, o: Partial<Placed> = {}, skip: Record<string, number[]> = {}) => rect(chunk, k, len, x0, z0 + M, x1, z1 + M, o, skip);
  const c = 'maple';
  const n = 'maple_n', s = 'maple_s';
  addM(n, 'two-storey-family-house', -30, 171, 0);
  addM(n, 'single-storey-ranch-house', -94, 172, 0);
  addM(n, 'split-level-house', -122, 171, 0);
  addM(s, 'detached-garage', -62, 203, Math.PI);
  addM(s, 'backyard-garden-shed', -73.5, 209, Math.PI);
  addM(s, 'log-cabin', -93, 201, Math.PI);
  addM(s, 'detached-garage', -118, 202, Math.PI);
  // frontage fences with a gap at each driveway, side fences, back fences
  runM(n, 'picket-fence-run', 4, -42, 179.5, -22, 179.5, {}, []);
  runM(n, 'picket-fence-run', 4, -80, 179.5, -50, 179.5, {}, [1, 2, 4, 5]); // 1, 2: Mill Road crosses here
  runM(n, 'picket-fence-run', 4, -108, 179.5, -82, 179.5, {}, [3]);
  runM(n, 'picket-fence-run', 4, -134, 179.5, -110, 179.5, {}, [2]);
  runM(s, 'picket-fence-run', 4, -46, 193, -26, 193, {}, [2]);
  runM(s, 'picket-fence-run', 4, -80, 193, -56, 193, {}, [3, 4]);
  runM(s, 'picket-fence-run', 4, -104, 193, -84, 193, {}, [2]);
  runM(n, 'board-privacy-fence-run', 4, -44, 166, -44, 150, {}, []);
  runM(n, 'board-privacy-fence-run', 4, -76, 166, -76, 150, {}, []);
  runM(n, 'board-privacy-fence-run', 4, -106, 166, -106, 150, {}, []);
  runM(s, 'board-privacy-fence-run', 4, -48, 208, -48, 224, {}, []);
  runM(s, 'board-privacy-fence-run', 4, -80, 211, -80, 224, {}, []);
  runM(n, 'board-privacy-fence-run', 4, -44, 150, -76, 150, {}, [6, 7]);
  runM(n, 'board-privacy-fence-run', 4, -106, 150, -76, 150, {}, []);
  // cars and yard clutter
  addM(n, 'family-crossover-suv', -22.5, 174.5, 0.2);
  addM(n, 'station-wagon-70s', -48, 177, 1.45);
  addM(n, 'compact-hatchback', -100.5, 178, -0.15);
  addM(s, 'suburban-pickup-truck', -52.5, 198, 2.9);
  addM(s, 'boxy-sedan-70s', -86, 197.5, 3.4);
  addM(c, 'backyard-barbecue-grill', -39, 166, 0.5);
  addM(c, 'backyard-doghouse', -34, 161, 2.5);
  addM(c, 'backyard-barbecue-grill', -64, 213, 3.3);
  addM(c, 'wheelbarrow', -88, 213, 0.9);
  for (const x of [-24, -45, -66, -90, -112, -130]) addM(c, 'mailbox', x, 180.6, 0, { solid: false });
  for (const x of [-30, -54, -84, -112]) addM(c, 'metal-trash-can', x + 6, 181, 0.4, { solid: false });
  for (const x of [-18, -48, -78, -108]) addM(c, 'station-lamp-post', x, 180.8, 0);
  for (const x of [-30, -64, -98, -128]) addM(c, 'station-lamp-post', x, 191.4, Math.PI);
  addM(c, 'fire-hydrant', -38, 180.6, 0);
  addM(c, 'speed-limit-sign', -9, 180.4, Math.PI / 2);
  addM(c, 'collapse-rubble-mound', -112, 196, 0.4);
  // school at the west end of the street
  const sc = 'school';
  addM(sc, 'one-room-schoolhouse', -148, 186, Math.PI / 2);
  addM(sc, 'yellow-school-bus', -126, 197.5, 1.75);
  rectM(sc, 'chain-link-fence-run', 4, -156, 166, -138, 206, {}, { e: [3, 4] });
  addM(sc, 'street-tree', -146, 170, 0);
  addM(sc, 'street-tree', -145, 202, 0.6);
}

// ---- Hollow Creek Farm (tier 2): barn, silos, coop, paddock, fields
{
  const c = 'farm', cf = 'farm_field';
  add(c, 'red-barn', 118, 142, 0);
  add(c, 'rolled-plate-silo', 127, 140, 0);
  add(c, 'grain-silo', 132.5, 146, 0);
  add(c, 'chicken-coop', 113, 184, 0.3);
  add(c, 'windpump-tower', 107, 171, 0);
  add(c, 'water-trough', 122, 154, 0.1);
  add(c, 'stone-well', 99, 174, 0);
  add(c, 'roadside-farm-stand', 78, 171, Math.PI);
  add(c, 'greenhouse', 74, 188, 0);
  add(c, 'marigold-pickup', 86, 172, 1.2);
  add(c, 'riding-lawn-tractor', 101, 152, 2);
  add(c, 'wheelbarrow', 96, 178, 0.5);
  add(c, 'scarecrow', 134, 196, 0.2);
  add(c, 'scarecrow', 104, 208, 3.4);
  for (const [x, z, a] of [[129, 177, 0.3], [133, 179.5, 1.2], [126, 181.5, 2.4], [131, 184, 3.3]] as const) add(c, 'haystack', x, z, a);
  for (const [x, z, a] of [[111, 150, 0.2], [112.3, 150.6, 0.9], [111.6, 148.8, 0.5], [108.6, 149.5, 1.4]] as const) add(c, 'hay-bale', x, z, a);
  for (const [x, z, a] of [[96.5, 186.5, 0.4], [97.2, 187.2, 1.1]] as const) add(c, 'feed-sack', x, z, a, { solid: false });
  add(c, 'firewood-stack', 82, 181, 1.57);
  add(c, 'fallen-log', 136, 160, 0.6);
  add(c, 'hollow-log', 150, 205, 1.3);
  add(c, 'oil-drum', 120.5, 165.5, 0);
  add(c, 'oil-drum', 121.2, 166.1, 0);
  add(c, 'wooden-crate', 123, 168, 0.3);
  add(c, 'wooden-crate', 123.5, 169.2, 0.9);
  add(c, 'metal-trash-can', 94, 168.5, 0);
  add(c, 'mailbox', 88, 168.4, 0, { solid: false });
  // paddock: split-rail fence with a gate on the south side
  rect(c, 'split-rail-fence-run', 2, 126, 150, 150, 172, {}, { s: [5, 6] });
  add(c, 'farm-gate', 138, 172, 0, { solid: false });
  // farmhouse yard fence
  run(c, 'picket-fence-run', 4, 78, 176.5, 100, 176.5, {}, [2, 3]);
  // orchard
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) add(cf, 'orchard-apple-tree', 62 + i * 8 + ((j * 3) % 2), 200 + j * 8, i * 1.7 + j, { shrink: 0.2 });
  rect(cf, 'bocage-hedgerow-section', 4, 56, 196, 96, 232, {}, { n: [3, 4, 5], e: [0, 1] });
}

// ---- Pinewood Camp (tier 2): an abandoned campground
{
  const c = 'camp';
  add(c, 'soldiers-tent', 36, 258, 0.3);
  add(c, 'canvas-ridge-tent', 47, 255, -0.4);
  add(c, 'dome-tent', 29, 271, 1.2);
  add(c, 'camp-tent', 53, 267, 0.5);
  add(c, 'sideline-medical-tent', 22, 262, 0.2);
  add(c, 'camper-van', 58, 281, 0.5);
  add(c, 'rv-travel-trailer', 68, 271, -0.3);
  add(c, 'teardrop-trailer', 20, 279, 2.0);
  add(c, 'stone-fire-pit', 40, 266.5, 0);
  add(c, 'hearth-log-bench', 36.8, 266.8, 1.57);
  add(c, 'hearth-log-bench', 43.2, 266.4, -1.57);
  add(c, 'hearth-log-bench', 40, 270, 0.1);
  add(c, 'campsite-picnic-table', 47, 275, 0.2);
  add(c, 'campsite-picnic-table', 28, 264, -0.4);
  add(c, 'stone-fire-pit', 30, 278, 0);
  add(c, 'camp-water-jug', 45.4, 273.2, 0.4, { solid: false });
  add(c, 'camping-lantern', 47, 275, 0, { solid: false, y: 0.75 });
  add(c, 'two-burner-camp-stove', 28.3, 264, 0, { solid: false, y: 0.75 });
  add(c, 'hammock-on-posts', 50, 260, 0.4, { solid: false });
  add(c, 'forest-outhouse', 15, 270, 1.57);
  add(c, 'portable-toilet', 67, 258, -0.4);
  add(c, 'log-store', 58, 255, 0.1);
  add(c, 'trailhead-sign', 12, 259, -0.5);
  add(c, 'sleeping-bag', 33, 276.5, 0.3, { solid: false });
  add(c, 'firewood-stack', 62, 260, 0.2);
  add(c, 'campground-pine-stand', 14, 250, 0.2);
  add(c, 'campground-pine-stand', 66, 248, 1.1);
  add(c, 'campground-pine-stand', 10, 288, 0.4);
  add(c, 'campground-pine-stand', 40, 289, 2.4);
  add(c, 'campground-pine-stand', 74, 286, 1.9);
}

// ---- Crash site (medical wreck, tier 3)
{
  const c = 'crash';
  add(c, 'air-ambulance-helicopter', -66, 262, 0.5, { shrink: 0.3 });
  add(c, 'sideline-medical-tent', -52, 252, -0.3);
  add(c, 'salvage-crate', -58, 254.5, 0.4);
  add(c, 'salvage-crate', -57.8, 256, 1.0);
  add(c, 'loot-crate', -79, 266, 0.1);
  add(c, 'ammo-crate', -78.7, 267.4, 0.9, { solid: false });
  add(c, 'scrap-built-aeroplane', -98, 244, 2.2, { shrink: 0.3 });
  add(c, 'field-barricade', -48, 262, 1.4);
  add(c, 'field-barricade', -49, 268, 1.7);
  add(c, 'grave-cross', -46, 246, 0.2, { solid: false });
  add(c, 'grave-cross', -44.4, 246.6, 0.5, { solid: false });
  add(c, 'grave-cross', -42.8, 246, -0.1, { solid: false });
  add(c, 'collapse-rubble-mound', -74, 252, 0.8);
  add(c, 'minefield-warning-sign', -60, 248, 0, { solid: false });
  add(c, 'minefield-warning-sign', -75, 270, 2, { solid: false });
  add(c, 'minefield-warning-sign', -50, 275, 1, { solid: false });
  add(c, 'brass-water-tower', -122, 240, 0.4);
}

// ---- Roadside diner at the crossroads (tier 1), billboard and a gas-station wreck row
{
  const c = 'diner';
  add(c, 'streamline-diner-car', 40, 215, Math.PI);
  add(c, 'motel-sign', 12, 224, Math.PI / 2);
  add(c, 'suburban-pickup-truck', 30, 225, 0.3);
  add(c, 'garbage-truck', 52, 229, 1.6);
  add(c, 'newspaper-box', 24, 209, 0, { solid: false });
  add(c, 'metal-trash-can', 24.6, 210.2, 0.2, { solid: false });
  add(c, 'campsite-picnic-table', 54, 213, 0.1);
  add(c, 'campsite-picnic-table', 54, 218, -0.1);
  add(c, 'street-lamp', 8, 209, Math.PI);
  add(c, 'street-lamp', 8, 239, 0);
}

// ---- Ranger ridge (tier 3)
{
  const c = 'ranger';
  add(c, 'ranger-station', 124, 262, 0.3);
  add(c, 'fire-lookout-tower', 138, 270, 0.4);
  add(c, 'nissen-hut', 112, 274, -0.2);
  add(c, 'military-cargo-truck', 140, 252, 2.2);
  add(c, 'sandbag-wall-section', 134, 260, 0.3);
  add(c, 'sandbag-wall-section', 130.5, 259, -0.5);
  add(c, 'oil-drum', 120, 252, 0);
  add(c, 'wooden-crate', 130, 275, 0.5);
  add(c, 'trailhead-sign', 108, 252, 0.4);
  add(c, 'scout-jeep', 110, 258, 0.7);
}

// ---- Highway debris and landmarks along the roads
{
  const c = 'road';
  add(c, 'delivery-truck', 3.5, 203, 2.6, { surf: 'metal' });
  add(c, 'compact-hatchback', -3, 214, 0.2);
  add(c, 'police-cruiser', 5.5, 192.5, 1.4);
  add(c, 'tank-wagon', 17, 160, 0.1, { shrink: 0.9 });
  add(c, 'cattle-wagon', 29, 160, 0.05);
  add(c, 'guardrail-section', 4.5, 176, Math.PI / 2);
  add(c, 'guardrail-section', 4.5, 180, Math.PI / 2);
  add(c, 'guardrail-section', 4.5, 184, Math.PI / 2);
  add(c, 'route-shield-sign', -5.6, 222, Math.PI / 2);
  add(c, 'speed-limit-sign', 5.4, 130, -Math.PI / 2);
  add(c, 'large-boulder', 14, 244, 0.5);
  add(c, 'rock-outcrop', -20, 215, 1);
  add(c, 'field-rock', 11, 196, 0.2);
  add(c, 'large-boulder', 100, 130, 2);
  add(c, 'large-boulder', -100, 150, 0.8);
  add(c, 'rock-outcrop', 54, 244, 2.2);
  add(c, 'fallen-log', -30, 232, 0.4);
  add(c, 'hollow-log', 60, 200, 1.9);
  add(c, 'fire-lookout-tower', -138, 270, 2.2);
}

// ---------------------------------------------------------------- enterable buildings
export interface Opening { u: number; w: number; sill: number; top: number }
export interface Furn { k: string; u: number; v: number; yaw?: number; s?: number; y?: number; solid?: boolean }
export interface LocalContainer {
  type: string;
  theme: string;
  u: number;
  v: number;
  yaw?: number;
  y?: number;
  /** Polyfork model for the visual (merged into the building chunk); 'counter' and 'register' are drawn procedurally. */
  model: string;
}
export interface BuildingDef {
  id: string;
  chunk: string;
  poi: string;
  kind: 'house' | 'shop' | 'workshop' | 'shed';
  x: number;
  z: number;
  /** local +v is the front wall; yaw turns it (use face() toward the road) */
  yaw: number;
  w: number;
  d: number;
  h: number;
  wall: string;
  roof: string;
  trim: string;
  floor: string;
  floorSurface: SurfaceTag;
  /** openings per wall; for front/back `u` is local x, for left/right `u` is local v (from the wall centre) */
  front: Opening[];
  back: Opening[];
  left: Opening[];
  right: Opening[];
  partition?: { v: number; open: Opening[] };
  /** walls along local v at u (motel rooms) */
  dividers?: { u: number; open: Opening[] }[];
  /** shop counter; default for a 'shop' is at (2.9, -0.9), null = none */
  counter?: { u: number; v: number; w: number } | null;
  porch?: boolean;
  chimney?: [number, number];
  roofBreak?: { side: 'front' | 'back'; u0: number; u1: number };
  furniture: Furn[];
  containers: LocalContainer[];
}
const win = (u: number, w = 1.3): Opening => ({ u, w, sill: 0.9, top: 2.0 });
const door = (u: number, w = 1.1): Opening => ({ u, w, sill: 0, top: 2.1 });

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'house_a', chunk: 'house_a', poi: 'maple', kind: 'house', x: -62, z: 172 + MAPLE_DZ, yaw: 0, w: 9, d: 7, h: 2.7,
    wall: '#9fb4bf', roof: '#4d3b36', trim: '#e6e0d2', floor: '#8a6b4a', floorSurface: 'wood',
    front: [win(-3.0), win(-0.6), door(1.5), win(3.4, 1.0)],
    back: [door(-2.6, 1.0), win(2.2)],
    left: [win(-2.2, 1.2), win(1.6, 1.2)],
    right: [win(-1.2, 1.2), win(2.0, 1.2)],
    partition: { v: -0.8, open: [door(0.4, 1.0)] },
    porch: true, chimney: [-3.2, -2.2], roofBreak: { side: 'back', u0: -1.5, u1: 2.5 },
    furniture: [
      { k: 'sofa', u: -2.9, v: -0.1, yaw: 0 }, { k: 'area-rug', u: -2.2, v: 1.8, solid: false }, { k: 'bistro-table', u: -2.2, v: 1.9 },
      { k: 'dining-chair', u: -3.2, v: 2.1, yaw: 1.2 }, { k: 'dining-chair', u: -1.3, v: 1.9, yaw: -1.9 },
      { k: 'alcove-bookcase', u: -4.1, v: 3.0, yaw: Math.PI / 2 }, { k: 'arc-floor-lamp', u: -4.0, v: 0.3 }, { k: 'fridge-freezer', u: 3.95, v: -0.25, yaw: 0 },
      { k: 'cardboard-delivery-box', u: 3.8, v: 2.9, yaw: 0.4 }, { k: 'cardboard-delivery-box', u: 3.3, v: 3.1, yaw: 1.1 },
      { k: 'bed', u: 3.0, v: -2.2, yaw: 0 }, { k: 'dining-chair', u: -0.6, v: -1.6, yaw: 2.4 },
    ],
    containers: [
      { type: 'kitchen_cupboard', theme: 'house', u: 2.5, v: -0.4, yaw: 0, model: 'counter' },
      { type: 'nightstand', theme: 'house', u: 1.9, v: -3.1, yaw: 0, model: 'bedside-table' },
      { type: 'wardrobe', theme: 'house', u: -3.9, v: -3.0, yaw: 0, model: 'dorm-wardrobe' },
      { type: 'food_cupboard', theme: 'house', u: -0.8, v: -3.1, yaw: 0, model: 'alcove-bookcase' },
    ],
  },
  {
    id: 'house_b', chunk: 'house_b', poi: 'maple', kind: 'house', x: -36, z: 201 + MAPLE_DZ, yaw: Math.PI, w: 8.5, d: 7, h: 2.7,
    wall: '#c18f78', roof: '#3f4a52', trim: '#efe9dc', floor: '#7e6446', floorSurface: 'wood',
    front: [door(-1.4), win(-3.2, 1.2), win(0.8), win(3.0)],
    back: [win(-2.6), door(2.6, 1.0)],
    left: [win(-1.6, 1.2), win(2.0, 1.2)],
    right: [win(0.2, 1.2), win(2.4, 1.2)],
    partition: { v: -0.2, open: [door(-0.8, 1.0)] },
    porch: true, chimney: [3.0, -2.4], roofBreak: { side: 'front', u0: -1.0, u1: 3.0 },
    furniture: [
      { k: 'sofa', u: 2.4, v: 0.3, yaw: Math.PI }, { k: 'area-rug', u: 2.4, v: 1.5, solid: false }, { k: 'bistro-table', u: -2.6, v: 2.4 },
      { k: 'dining-chair', u: -3.3, v: 2.6, yaw: 1.4 }, { k: 'dining-chair', u: -1.9, v: 2.5, yaw: -1.7 }, { k: 'fridge-freezer', u: -3.9, v: 0.35, yaw: 0 },
      { k: 'arc-floor-lamp', u: 3.8, v: 3.1 }, { k: 'filing-cabinet', u: 3.9, v: 0.2, yaw: -Math.PI / 2 },
      { k: 'bed', u: -3.0, v: -2.2, yaw: 0 }, { k: 'bed', u: 0.9, v: -2.2, yaw: 0 }, { k: 'dining-chair', u: 3.2, v: -1.4, yaw: 3.3 },
    ],
    containers: [
      { type: 'kitchen_cupboard', theme: 'house', u: -2.0, v: 0.1, yaw: 0, model: 'counter' },
      { type: 'nightstand', theme: 'house', u: -1.7, v: -3.1, yaw: 0, model: 'bedside-table' },
      { type: 'wardrobe', theme: 'house', u: 3.7, v: -3.0, yaw: 0, model: 'dorm-wardrobe' },
      { type: 'bathroom_cabinet', theme: 'house', u: 2.4, v: -3.1, yaw: 0, model: 'medicine-cabinet' },
    ],
  },
  {
    id: 'farmhouse', chunk: 'farmhouse', poi: 'farm', kind: 'house', x: 90, z: 184, yaw: Math.PI, w: 9.5, d: 7.5, h: 2.8,
    wall: '#d9d2c0', roof: '#7a3b34', trim: '#f1ece0', floor: '#8c7352', floorSurface: 'wood',
    front: [door(0), win(-3.2), win(3.2), win(-1.6, 1.0)],
    back: [win(-2.0), door(3.0, 1.0), win(0.8)],
    left: [win(-1.8, 1.2), win(1.8, 1.2)],
    right: [win(-1.8, 1.2), win(1.8, 1.2)],
    partition: { v: -0.6, open: [door(-2.0, 1.0), door(2.4, 1.0)] },
    porch: true, chimney: [-3.4, 0.2], roofBreak: { side: 'back', u0: 0.5, u1: 3.5 },
    furniture: [
      { k: 'area-rug', u: 0, v: 1.6, solid: false }, { k: 'sofa', u: -3.0, v: 0.0, yaw: 0 }, { k: 'bistro-table', u: 1.6, v: 2.4 },
      { k: 'dining-chair', u: 0.9, v: 2.4, yaw: 1.5 }, { k: 'dining-chair', u: 2.3, v: 2.5, yaw: -1.6 }, { k: 'fridge-freezer', u: 4.0, v: 0.0, yaw: 0 },
      { k: 'alcove-bookcase', u: -4.4, v: 2.6, yaw: Math.PI / 2 }, { k: 'arc-floor-lamp', u: -3.9, v: 3.2 },
      { k: 'bed', u: -3.2, v: -2.6, yaw: 0 }, { k: 'bed', u: 3.4, v: -2.6, yaw: 0 }, { k: 'cardboard-delivery-box', u: 0.4, v: -2.9, yaw: 0.2 },
    ],
    containers: [
      { type: 'kitchen_cupboard', theme: 'farm', u: 2.9, v: 0.05, yaw: 0, model: 'counter' },
      { type: 'nightstand', theme: 'farm', u: -1.8, v: -3.3, yaw: 0, model: 'bedside-table' },
      { type: 'wardrobe', theme: 'farm', u: -0.4, v: -3.3, yaw: 0, model: 'dorm-wardrobe' },
      { type: 'nightstand', theme: 'farm', u: 1.5, v: -3.3, yaw: 0, model: 'bedside-table' },
    ],
  },
  {
    id: 'shop_gas', chunk: 'shop_gas', poi: 'fuel', kind: 'shop', x: -31, z: 152, yaw: Math.PI / 2, w: 9, d: 6.5, h: 3.2,
    wall: '#d8d2c4', roof: '#6c6a66', trim: '#b3433a', floor: '#a7aaa5', floorSurface: 'concrete',
    front: [{ u: -2.1, w: 3.6, sill: 0, top: 2.5 }, win(2.1, 1.6), door(3.8)],
    back: [door(3.0, 1.0), win(-2.0)],
    left: [win(-0.8, 1.2)],
    right: [win(1.6, 1.2)],
    furniture: [
      { k: 'glass-door-drinks-fridge', u: -3.4, v: -2.7, yaw: 0 }, { k: 'vending-machine', u: 3.7, v: -2.6, yaw: 0 }, { k: 'metal-trash-can', u: 1.2, v: 2.6 },
      { k: 'cardboard-delivery-box', u: -3.7, v: 2.5, yaw: 0.5 }, { k: 'cardboard-delivery-box', u: -3.2, v: 2.9, yaw: 1.3 },
    ],
    containers: [
      { type: 'gas_shelf', theme: 'gas_station', u: -1.4, v: -0.6, yaw: 0, model: 'back-bar-shelf-unit' },
      { type: 'gas_shelf', theme: 'gas_station', u: 0.9, v: 0.9, yaw: Math.PI, model: 'back-bar-shelf-unit' },
      { type: 'gas_register', theme: 'gas_station', u: 2.9, v: -0.9, yaw: 0, y: 1.0, model: 'register' },
    ],
  },
  {
    id: 'workshop_gas', chunk: 'workshop_gas', poi: 'fuel', kind: 'workshop', x: -31, z: 172, yaw: Math.PI / 2, w: 10, d: 7, h: 3.6,
    wall: '#8a908c', roof: '#5a5f60', trim: '#b8452f', floor: '#8f918c', floorSurface: 'concrete',
    front: [{ u: -1.2, w: 5.4, sill: 0, top: 3.0 }, door(3.9)],
    back: [win(-2.5), win(2.5)],
    left: [door(1.4, 1.0), win(-1.6, 1.4)],
    right: [win(0.6, 1.4)],
    furniture: [
      { k: 'compact-hatchback', u: -1.6, v: 0.4, yaw: 0.35 }, { k: 'tire', u: 3.6, v: 2.4, solid: false }, { k: 'tire', u: 3.7, v: 2.5, y: 0.3, solid: false },
      { k: 'oil-drum', u: 4.3, v: -0.6 }, { k: 'oil-drum', u: 4.4, v: 0.1 }, { k: 'fuel-jerrycan', u: 2.6, v: -3.1, yaw: 0.4, solid: false },
      { k: 'filing-cabinet', u: -4.5, v: -2.8, yaw: 0 },
    ],
    containers: [
      { type: 'garage_shelf', theme: 'garage', u: -3.4, v: -3.0, yaw: 0, model: 'back-bar-shelf-unit' },
      { type: 'garage_shelf', theme: 'garage', u: -1.0, v: -3.0, yaw: 0, model: 'back-bar-shelf-unit' },
      { type: 'tool_box', theme: 'garage', u: 2.6, v: -2.9, yaw: 0.2, model: 'wooden-crate' },
    ],
  },
  {
    id: 'shed_farm', chunk: 'shed_farm', poi: 'farm', kind: 'shed', x: 101, z: 142, yaw: 0, w: 10, d: 6, h: 3.2,
    wall: '#8a5a3c', roof: '#6b5a50', trim: '#5a4030', floor: '#7b6a4c', floorSurface: 'dirt',
    front: [{ u: 0, w: 8.6, sill: 0, top: 2.7 }],
    back: [],
    left: [],
    right: [{ u: 0, w: 3.4, sill: 0, top: 2.2 }],
    furniture: [
      { k: 'hay-bale', u: -3.8, v: -2.0, yaw: 0.2 }, { k: 'hay-bale', u: -3.7, v: -0.9, yaw: -0.1 }, { k: 'hay-bale', u: -3.8, v: -1.4, yaw: 0, y: 0.52 },
      { k: 'oil-drum', u: 4.0, v: -2.4 }, { k: 'wheelbarrow', u: 1.5, v: 1.4, yaw: 0.4 }, { k: 'wooden-crate', u: 4.0, v: 1.8, yaw: 0.3 },
    ],
    containers: [
      { type: 'farm_shed', theme: 'farm', u: -0.8, v: -2.7, yaw: 0, model: 'back-bar-shelf-unit' },
      { type: 'farm_shed', theme: 'farm', u: 1.4, v: -2.7, yaw: 0, model: 'back-bar-shelf-unit' },
      { type: 'tool_box', theme: 'farm', u: 3.1, v: -2.5, yaw: 0.1, model: 'wooden-crate' },
    ],
  },
];

// ---------------------------------------------------------------- fields (instanced crops on soil strips)
export interface Field { x: number; z: number; w: number; d: number; crop: 'corn' | 'wheat' | 'pumpkin' | 'sunflower'; step: number }
export const FIELDS: Field[] = [
  { x: 134, z: 210, w: 26, d: 18, crop: 'corn', step: 2.0 },
  { x: 100, z: 220, w: 15, d: 12, crop: 'wheat', step: 1.25 },
  { x: 150, z: 184, w: 9, d: 12, crop: 'sunflower', step: 2.4 },
  { x: 80, z: 214, w: 12, d: 8, crop: 'pumpkin', step: 2.4 },
];

// ---------------------------------------------------------------- scatter
/** Keep-clear zones for forest and grass scatter (rects x0,x1,z0,z1). */
export const CLEAR_RECTS: [number, number, number, number][] = [
  [-60, 40, 100, 140], // checkpoint
  [-58, 16, 138, 182], // fuel stop
  [-140, -4, 166 + MAPLE_DZ, 214 + MAPLE_DZ], // Maple Street lots
  [-160, -134, 160 + MAPLE_DZ, 215 + MAPLE_DZ], // school
  [56, 160, 134, 235], // farm and fields
  [4, 74, 204, 240], // diner
  [8, 80, 244, 296], // camp
  [-110, -36, 236, 296], // crash site
  [100, 156, 244, 290], // ranger
];

// ---------------------------------------------------------------- POI entrance signs
/** A sign board at x,z; the lettering faces `toward` (where the traveller comes from) and, on the back, the other way. */
export const POI_SIGNS: { poi: string; x: number; z: number; toward: [number, number] }[] = [
  { poi: 'checkpoint', x: 5.8, z: 106.5, toward: [5.8, 90] },
  { poi: 'fuel', x: -6.2, z: 135.5, toward: [-6.2, 110] },
  { poi: 'maple', x: -8.5, z: 192.4, toward: [10, 192.4] },
  { poi: 'school', x: -131.5, z: 192.6, toward: [-110, 192.6] },
  { poi: 'farm', x: 90, z: 159.4, toward: [60, 159.4] },
  { poi: 'diner', x: 14, z: 226.6, toward: [-6, 226.6] },
  { poi: 'camp', x: 8.2, z: 253, toward: [-6, 253] },
  { poi: 'crash', x: -34, z: 244.3, toward: [0, 244.3] },
  { poi: 'ranger', x: 82, z: 229.6, toward: [60, 229.6] },
];

// ---------------------------------------------------------------- the town (outskirts_town.ts)
ROADS.push(...TOWN_ROADS);
PADS.push(...TOWN_PADS);
PLACED.push(...TOWN_PLACED);
BUILDINGS.push(...TOWN_BUILDINGS);
POI_SIGNS.push(...TOWN_SIGNS);
CLEAR_RECTS.push(...TOWN_CLEAR);

// ---------------------------------------------------------------- the army outpost east of the farm (outskirts_outpost.ts)
ROADS.push(...OUTPOST_ROADS);
PADS.push(...OUTPOST_PADS);
PLACED.push(...OUTPOST_PLACED);
BUILDINGS.push(...OUTPOST_BUILDINGS);
POI_SIGNS.push(...OUTPOST_SIGNS);
CLEAR_RECTS.push(...OUTPOST_CLEAR);
