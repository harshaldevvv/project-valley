import type { BuildingDef, Opening, Placed, RoadSeg } from './outskirts';

/**
 * Camp Harlan: a tier-3 army outpost east of Hollow Creek Farm (plain data, merged into outskirts.ts). A dirt track leaves the farm
 * road at (93.5, 165), runs north past the hay shed and turns east to the west gate at (108, 118). Inside the mesh fence
 * (x 108..156, z 104..130): watchtowers on three corners, a command cabin with a radio mast, an enterable barracks (bunks, lockers,
 * footlockers) and armory (locked gun cabinets, ammo crates), a helipad, and a motor pool with trucks, jeeps and a water bowser.
 */
const win = (u: number, w = 1.2): Opening => ({ u, w, sill: 1.0, top: 2.0 });
const door = (u: number, w = 1.1): Opening => ({ u, w, sill: 0, top: 2.1 });

export const OUTPOST = { x0: 108, x1: 156, z0: 104, z1: 130, gateZ: 118 } as const;

export const OUTPOST_ROADS: RoadSeg[] = [
  { ax: 93.5, az: 165, bx: 93.5, bz: 118, w: 4.5, kind: 'dirt' },
  { ax: 93.5, az: 118, bx: 112, bz: 118, w: 4.5, kind: 'dirt' },
];
export const OUTPOST_PADS = [
  { x: 132, z: 117, w: 47, d: 25, sw: 'dirt', y: 0.035 }, // compound ground
  { x: 118, z: 124, w: 10, d: 10, sw: 'concrete', y: 0.05 }, // helipad
  { x: 142, z: 122.5, w: 22, d: 13, sw: 'asphalt', y: 0.05 }, // motor pool
];
export const OUTPOST_CLEAR: [number, number, number, number][] = [[88, 160, 100, 134], [88, 99, 134, 162]];

export const OUTPOST_PLACED: Placed[] = [];
const C = 'outpost';
const add = (k: string, x: number, z: number, yaw = 0, o: Partial<Placed> = {}) => OUTPOST_PLACED.push({ chunk: C, k, x, z, yaw, ...o });
/** fence sections of length 4 between two points, `skip` indices left open */
const fence = (x0: number, z0: number, x1: number, z1: number) => {
  const total = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(total / 4));
  const dx = (x1 - x0) / total, dz = (z1 - z0) / total, yaw = Math.atan2(-dz, dx);
  for (let i = 0; i < n; i++) { const t = ((i + 0.5) * total) / n; add('mesh-site-fence-run', x0 + dx * t, z0 + dz * t, yaw, { s: total / n / 4 }); }
};
{
  const { x0, x1, z0, z1, gateZ } = OUTPOST;
  fence(x0, z0, x1, z0); // north
  fence(x1, z0, x1, z1); // east
  fence(x1, z1, x0, z1); // south
  fence(x0, z1, x0, gateZ + 3); // west, south of the 6 m gate opening
  fence(x0, gateZ - 3, x0, z0); // west, north of it
  add('field-barricade', x0 - 1.6, gateZ + 4.6, 0.35); // the gate barricade, dragged aside
}
// watchtowers on three corners (legs and stair only, so the space under the platform is open)
const towerBoxes: Placed['boxes'] = [[1, 3, 1, 0.2, 3, 0.2], [-1, 3, 1, 0.2, 3, 0.2], [1.2, 3, -1.2, 0.3, 3, 0.3], [-1, 3, -1.2, 0.2, 3, 0.3], [0, 1, 1.5, 0.6, 1, 0.3]];
add('lookout-watchtower', 110.6, 106.8, Math.PI * 0.75, { boxes: towerBoxes });
add('lookout-watchtower', 110.6, 127.2, Math.PI * 0.25, { boxes: towerBoxes });
add('lookout-watchtower', 153.4, 127.2, -Math.PI * 0.25, { boxes: towerBoxes });
// outside the gate: sandbags either side of the track, hedgehogs, a searchlight and warning signs
add('sandbag-wall-section', 104.5, 113.6, Math.PI / 2);
add('sandbag-wall-section', 104.5, 122.4, Math.PI / 2);
add('czech-hedgehog', 100.5, 113.2, 0.5);
add('czech-hedgehog', 99.8, 123.4, 1.3);
add('anti-aircraft-searchlight', 105.2, 126.8, -2.2);
for (const z of [108, 128]) add('minefield-warning-sign', 105.6, z, -Math.PI / 2, { boxes: [[0, 0.5, 0, 0.28, 0.5, 0.06]] });
// command post: site cabin, radio mast, a field radio on a crate, flagpole
add('site-cabin', 115, 111.2, Math.PI / 2);
add('antenna-mast', 120.2, 114.6, 0.3);
add('salvage-crate', 113.4, 114.6, 0.2);
add('field-radio-set', 113.4, 114.6, 0.4, { y: 0.8, solid: false });
add('flagpole', 136.8, 114.2, 0);
// between barracks and armory: latrines; tents along the east fence
add('portable-toilet', 136.4, 105.6, Math.PI);
add('portable-toilet', 137.8, 105.6, Math.PI);
add('soldiers-tent', 151.6, 106.6, Math.PI / 2);
add('soldiers-tent', 151.6, 111.4, Math.PI / 2);
add('ammo-crate', 138.6, 111.6, 0.2, { solid: false });
add('ammo-crate', 138.9, 112.3, 0.8, { solid: false });
add('oil-drum', 148.8, 105.2, 0);
add('oil-drum', 149.5, 105.7, 0);
// helipad
add('helipad-marking-decal', 118, 124, 0, { s: 4.4, y: 0.04, solid: false });
add('site-lighting-tower', 124.6, 128.4, Math.PI);
// motor pool: two trucks, two jeeps under a camo net, a water bowser and a ground power unit
add('military-cargo-truck', 134.2, 123.4, 0.05);
add('military-cargo-truck', 138.6, 123.6, -0.04);
add('scout-jeep', 143.6, 125, 0.08);
add('scout-jeep', 147.2, 124.8, -0.06);
add('camouflage-net-canopy', 145.4, 125, 0, { s: 1.05, boxes: [[-1.9, 1.2, -1.9, 0.08, 1.2, 0.08], [1.9, 1.2, -1.9, 0.08, 1.2, 0.08], [-1.9, 1.2, 1.9, 0.08, 1.2, 0.08], [1.9, 1.2, 1.9, 0.08, 1.2, 0.08], [-0.4, 0.6, 0.3, 0.8, 0.6, 0.9]] }); // poles, the kit stacked under it
add('water-bowser', 149.6, 120.4, Math.PI / 2 + 0.1);
add('ground-power-unit', 152.6, 116.4, Math.PI / 2);
add('salvage-crate', 131.2, 118.4, 0.4);
add('salvage-crate', 131.6, 119.3, 0.1);
for (const [x, z] of [[133, 117], [140, 117.4], [145.5, 117.2]] as const) add('traffic-cone', x, z, 0, { solid: false });

export const OUTPOST_BUILDINGS: BuildingDef[] = [
  {
    id: 'outpost_barracks', chunk: 'outpost_barracks', poi: 'outpost', kind: 'shop', x: 127, z: 108.6, yaw: 0, w: 14, d: 7, h: 3.2,
    wall: '#6e7457', roof: '#3d4135', trim: '#4a4f3a', floor: '#8f918c', floorSurface: 'concrete',
    front: [win(-5.2), win(-2.6), door(0), win(2.6), win(5.2)],
    back: [win(-4, 1.0), win(0, 1.0), win(4, 1.0)],
    left: [win(0.4, 1.0)],
    right: [],
    counter: null,
    furniture: [
      ...[-5.7, -3.6, -1.5, 1.5, 3.6, 5.7].map((u) => ({ k: 'bed', u, v: -2.2 })),
      { k: 'bistro-table', u: -2.6, v: 1.6 }, { k: 'dining-chair', u: -3.3, v: 1.6, yaw: 1.5 }, { k: 'dining-chair', u: -1.9, v: 1.7, yaw: -1.6 },
      { k: 'metal-trash-can', u: 1.4, v: 2.9 },
    ],
    containers: [
      ...[-5.7, -1.5, 1.5, 5.7].map((u) => ({ type: 'military_footlocker', theme: 'military', u, v: -0.6, yaw: 0, model: 'salvage-crate' })),
      { type: 'police_locker', theme: 'military', u: -6.55, v: 1.2, yaw: Math.PI / 2, model: 'dorm-wardrobe' },
      { type: 'police_locker', theme: 'military', u: -6.55, v: 2.4, yaw: Math.PI / 2, model: 'dorm-wardrobe' },
      { type: 'police_locker', theme: 'military', u: 6.55, v: 1.2, yaw: -Math.PI / 2, model: 'dorm-wardrobe' },
      { type: 'police_locker', theme: 'military', u: 6.55, v: 2.4, yaw: -Math.PI / 2, model: 'dorm-wardrobe' },
    ],
  },
  {
    id: 'outpost_armory', chunk: 'outpost_armory', poi: 'outpost', kind: 'shop', x: 144, z: 108, yaw: 0, w: 8, d: 6, h: 3.2,
    wall: '#7c7f6c', roof: '#3d4135', trim: '#8a3a2a', floor: '#8f918c', floorSurface: 'concrete',
    front: [door(-2.4), win(1.8, 1.0)],
    back: [],
    left: [],
    right: [],
    counter: null,
    furniture: [
      { k: 'oil-drum', u: -3.3, v: 2.3 }, { k: 'ammo-crate', u: -3.2, v: 0.4, yaw: 0.3, solid: false }, { k: 'ammo-crate', u: -3.0, v: 0.9, yaw: 1.2, solid: false },
      { k: 'bistro-table', u: 0.6, v: 0.4 }, { k: 'field-radio-set', u: 0.6, v: 0.4, y: 0.75, solid: false },
    ],
    containers: [
      { type: 'cabinet_locked', theme: 'military', u: -2.6, v: -2.55, yaw: 0, model: 'back-bar-shelf-unit' },
      { type: 'cabinet_locked', theme: 'military', u: -0.4, v: -2.55, yaw: 0, model: 'back-bar-shelf-unit' },
      { type: 'cabinet_locked', theme: 'military', u: 1.8, v: -2.55, yaw: 0, model: 'back-bar-shelf-unit' },
      { type: 'military_crate', theme: 'military', u: 3.2, v: 0.2, yaw: Math.PI / 2, model: 'ammo-crate' },
      { type: 'military_crate', theme: 'military', u: 3.2, v: 1.4, yaw: Math.PI / 2, model: 'ammo-crate' },
      { type: 'military_footlocker', theme: 'military', u: 3.3, v: -1.1, yaw: 0, model: 'salvage-crate' },
    ],
  },
];

export const OUTPOST_SIGNS = [{ poi: 'outpost', x: 89.4, z: 153.6, toward: [89.4, 170] as [number, number] }];
