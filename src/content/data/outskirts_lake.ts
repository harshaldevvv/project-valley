import type { BuildingDef, Opening, Placed, RoadSeg } from './outskirts';

/**
 * Loon Lake Campground: a tier-2 lakeside campground in the plateau's south-west corner (plain data, merged into outskirts.ts).
 * A dirt track carries the crash-site road on west from (-78, 252), past the wreck, to a gravel car park at (-126, 254).
 * North of it: the camp office (enterable, camp store shelves, tackle locker, desk), two rental cabins (enterable) and the
 * old cabins along the north edge; the brass water tower stands by the office. South: the lake (nature.ts WATERS) with a
 * dock, a canoe rack and a beached skiff on the north-east shore, a wash house, and tent pitches round the west and east banks.
 * The lake itself is `LAKE` in data/nature.ts; everything here stays inside LAKE_CLEAR.
 */
const win = (u: number, w = 1.1): Opening => ({ u, w, sill: 0.9, top: 1.9 });
const door = (u: number, w = 1.0): Opening => ({ u, w, sill: 0, top: 2.1 });

export const LAKE_CLEAR: [number, number, number, number][] = [[-152, -111, 226, 293]];

export const LAKE_ROADS: RoadSeg[] = [
  { ax: -78, az: 252, bx: -112, bz: 254, w: 4.5, kind: 'dirt' },
  { ax: -112, az: 254, bx: -121, bz: 254, w: 4.5, kind: 'dirt' },
];
export const LAKE_PADS = [
  { x: -126, z: 254, w: 12, d: 8, sw: 'dirt', y: 0.035 }, // gravel car park
  { x: -132, z: 248.6, w: 3, d: 2, sw: 'dirt', y: 0.036 }, // path to the office door
];

export const LAKE_PLACED: Placed[] = [];
const C = 'lake';
const add = (k: string, x: number, z: number, yaw = 0, o: Partial<Placed> = {}) => LAKE_PLACED.push({ chunk: C, k, x, z, yaw, ...o });
/** rail fence sections (2 m) between two points */
const rail = (x0: number, z0: number, x1: number, z1: number) => {
  const total = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(total / 2));
  const dx = (x1 - x0) / total, dz = (z1 - z0) / total, yaw = Math.atan2(-dz, dx);
  for (let i = 0; i < n; i++) { const t = ((i + 0.5) * total) / n; add('campground-rail-fence-run', x0 + dx * t, z0 + dz * t, yaw, { s: total / n / 2 }); }
};

// the entrance: rail fences either side of the track, notice board and the self-registration post
rail(-111, 251.2, -119, 251.2);
rail(-111, 256.8, -117, 256.8);
add('camp-notice-board', -119.8, 250.2, Math.PI / 2 + 0.2, { boxes: [[0, 1.2, 0, 1.0, 1.2, 0.12]] });
add('self-registration-post', -117.6, 257.9, -Math.PI / 2);
// car park: a pop-top camper van (searchable, in pois.ts), a parked RV
add('pop-top-camper-van', -129.5, 256, Math.PI / 2 + 0.06);
add('rv-travel-trailer', -123.4, 257.2, -Math.PI / 2 - 0.05);
// the office porch: a bench under the window, firewood by the side wall
add('split-log-bench', -134.6, 248.2, 0);
add('cordwood-pile', -137.1, 244.5, Math.PI / 2);
// the old cabins along the north edge (closed up: solid blocks)
add('porch-log-cabin', -146, 233.4, 0);
add('a-frame-cabin', -134.5, 233, 0);
add('log-cabin', -122.8, 231.4, 0);
// rental cabins: cordwood and a hammock out back
add('cordwood-pile', -149.4, 245, Math.PI / 2);
add('hammock-on-posts', -149.6, 256, Math.PI / 2);
// wash house between the cabins and the lake
add('timber-wash-house', -146.2, 267, Math.PI / 2);
// north-east shore: dock, canoe rack, life jackets, a beached skiff; a canoe pulled up on the east bank
for (const z of [270.6, 273.0, 275.4]) add('lake-dock-run', -122, z, 0, { y: -0.75, boxes: [[0, 0.85, 0, 1.0, 0.1, 1.2]] }); // deck top 0.2 m: step on
add('canoe-rack', -115.2, 262.6, 0, { boxes: [[0, 0.8, 0, 2.3, 0.8, 0.9]] });
add('life-jacket-post', -119.4, 265.4, 0.3);
add('lake-rowing-skiff', -119.4, 271.8, 2.4, { shrink: 0.85 });
add('camp-canoe', -113.4, 279.4, 0.1, { shrink: 0.85 });
add('swim-raft', -125, 283.5, 0.3, { y: -0.6 });
add('propped-fishing-rod', -134.6, 281.5, 1.4, { solid: false });
// pitch 1, west bank: wall tent, fire ring, table, chairs
add('canvas-wall-tent', -148.2, 276, Math.PI / 2);
add('stone-ring-campfire', -143.4, 278.4, 0, { boxes: [[0, 0.2, 0, 0.7, 0.2, 0.7]] });
add('heavy-timber-picnic-table', -143, 273.8, 0.2);
add('folding-camp-chair', -142.1, 279.8, -2.6);
add('folding-camp-chair', -144.8, 279.9, 2.7);
// pitch 2, south-west bank: dome tent, fire ring, table, the kayak pulled up
add('dome-tent', -147.6, 286.2, Math.PI / 2 + 0.3);
add('stone-ring-campfire', -142.8, 287.2, 0, { boxes: [[0, 0.2, 0, 0.7, 0.2, 0.7]] });
add('heavy-timber-picnic-table', -143.4, 283.4, -0.15);
add('lake-kayak', -138.4, 284.4, 0.4, { shrink: 0.85 });
// pitch 3, east bank: ridge tent, fire ring, chairs
add('canvas-ridge-tent', -113.6, 270.4, -Math.PI / 2);
add('stone-ring-campfire', -116.8, 268.2, 0, { boxes: [[0, 0.2, 0, 0.7, 0.2, 0.7]] });
add('folding-camp-chair', -117.9, 266.9, 0.6);
add('camping-lantern', -116.2, 266.6, 0, { solid: false });

export const LAKE_BUILDINGS: BuildingDef[] = [
  {
    id: 'lake_office', chunk: 'lake_office', poi: 'lake', kind: 'shop', x: -132, z: 244.5, yaw: 0, w: 8, d: 5.5, h: 3.0,
    wall: '#7a5a3c', roof: '#3f4a3a', trim: '#d9c9a3', floor: '#8a6b4a', floorSurface: 'wood',
    front: [win(-2.4, 1.4), door(0)],
    back: [win(-1.5), win(2.0)],
    left: [win(-1.6)],
    right: [win(0.6)],
    counter: { u: 1.9, v: 0.4, w: 2.4 },
    furniture: [
      { k: 'metal-trash-can', u: -1.1, v: 2.1 }, { k: 'camp-cooler', u: 3.4, v: 2.3, yaw: 0.3 },
      { k: 'cardboard-delivery-box', u: 3.4, v: -0.8, yaw: 0.4 }, { k: 'dining-chair', u: 2.0, v: -1.2, yaw: Math.PI },
    ],
    containers: [
      { type: 'camp_store_shelf', theme: 'lake', u: -2.6, v: -2.25, yaw: 0, model: 'back-bar-shelf-unit' },
      { type: 'camp_store_shelf', theme: 'lake', u: -0.4, v: -2.25, yaw: 0, model: 'back-bar-shelf-unit' },
      { type: 'tackle_locker', theme: 'lake', u: -3.55, v: 0.6, yaw: Math.PI / 2, model: 'dorm-wardrobe' },
      { type: 'office_desk', theme: 'lake', u: 3.4, v: -2.2, yaw: 0, model: 'filing-cabinet' },
    ],
  },
  ...(['a', 'b'] as const).map((s, i): BuildingDef => ({
    id: `lake_cabin_${s}`, chunk: `lake_cabin_${s}`, poi: 'lake', kind: 'house', x: -145, z: 245 + i * 11, yaw: Math.PI / 2, w: 7, d: 5.5, h: 2.7,
    wall: i ? '#8c6a48' : '#6f5238', roof: '#4a3a30', trim: '#e0d6bf', floor: '#8a6b4a', floorSurface: 'wood',
    front: [win(-2.2), door(0.8)],
    back: [win(0)],
    left: [win(0, 1.0)],
    right: [win(0, 1.0)],
    porch: true, chimney: [-2.6, -1.8],
    furniture: [
      { k: 'bed', u: -2.2, v: -1.4, yaw: 0 }, { k: 'bistro-table', u: 1.9, v: -1.2 }, { k: 'dining-chair', u: 1.2, v: -1.3, yaw: 1.4 },
      { k: 'kit-bag', u: -0.9, v: -1.9, yaw: 0.5 }, { k: 'camping-lantern', u: 1.9, v: -1.2, y: 0.75, solid: false },
    ],
    containers: [
      { type: 'nightstand', theme: 'house', u: -0.8, v: -2.35, yaw: 0, model: 'bedside-table' },
      { type: 'wardrobe', theme: 'house', u: -3.0, v: 1.3, yaw: Math.PI / 2, model: 'dorm-wardrobe' },
      { type: i ? 'camp_stash' : 'kitchen_cupboard', theme: i ? 'camp' : 'house', u: 2.95, v: 1.2, yaw: -Math.PI / 2, model: i ? 'kit-bag' : 'counter' },
    ],
  })),
];

export const LAKE_SIGNS = [{ poi: 'lake', x: -84, z: 249.2, toward: [-60, 249.2] as [number, number] }];
