import type { BuildingDef, Opening, Placed, RoadSeg } from './outskirts';

/**
 * Dunmore: the small town north-west of Maple Street. Mill Road runs north from Maple Street (x = -72) to Main Street (z = 134),
 * which runs west to the church at the end. North side (front faces south): pharmacy, hardware store, police station, post office.
 * South side (front faces north): grocery, shop row, motel strip, clock tower. A department store towers behind the police station.
 * Plain data, merged into outskirts.ts. Enterable: pharmacy, hardware, police (locked armory behind the front office), grocery, motel (4 rooms).
 */
const win = (u: number, w = 1.3): Opening => ({ u, w, sill: 0.9, top: 2.1 });
const wide = (u: number, w: number): Opening => ({ u, w, sill: 0.9, top: 2.5 });
const door = (u: number, w = 1.2): Opening => ({ u, w, sill: 0, top: 2.1 });

export const TOWN_ROADS: RoadSeg[] = [
  { ax: -72, az: 199, bx: -72, bz: 134, w: 6, kind: 'asphalt', dashes: true }, // Mill Road
  { ax: -72, az: 134, bx: -146, bz: 134, w: 8, kind: 'asphalt', dashes: true }, // Main Street
];
export const TOWN_PADS = [
  { x: -111, z: 128.5, w: 78, d: 3, sw: 'concrete' }, // north sidewalk
  { x: -111, z: 139.5, w: 78, d: 3, sw: 'concrete' }, // south sidewalk
  { x: -148, z: 134, w: 8, d: 12, sw: 'concrete' }, // church forecourt
];
export const TOWN_CLEAR: [number, number, number, number][] = [[-160, -72, 104, 158]];

export const TOWN_PLACED: Placed[] = [];
const add = (k: string, x: number, z: number, yaw = 0, o: Partial<Placed> = {}) => TOWN_PLACED.push({ chunk: 'town', k, x, z, yaw, ...o });
// landmarks and decor buildings
add('brick-church', -151, 134, Math.PI / 2);
add('clock-tower', -141, 143.5, Math.PI);
add('department-store', -130, 109.5, 0);
add('one-storey-shop-row', -102, 145.5, Math.PI);
add('telegraph-and-post-office', -79.5, 122, 0);
// street life: lamps, benches, planters, hydrants, a newsstand, a bus shelter
for (const x of [-80, -95, -110, -125, -139]) { add('street-lamp', x, 129.4, 0); add('street-lamp', x - 6, 138.8, Math.PI); }
for (const x of [-84, -97.5, -112]) add('park-bench', x, 129.4, 0);
for (const x of [-92, -108, -122]) add('park-bench', x, 138.7, Math.PI);
for (const x of [-86.5, -99.5, -111.5, -123]) add('flower-planter', x, 128.5, 0, { solid: false });
add('newsstand', -81.4, 129.6, 0);
add('bus-shelter', -78, 139.4, Math.PI);
add('fire-hydrant', -104, 129.2, 0);
add('fire-hydrant', -91, 138.9, 0);
add('metal-trash-can', -93.6, 129.2, 0.3);
add('metal-trash-can', -106, 138.9, 0.5);
add('pay-phone-booth', -115.5, 129.4, 0);
add('vending-machine', -83, 139.6, Math.PI);
add('mailbox', -126, 129.2, 0, { solid: false });
// parked and wrecked cars
add('boxy-sedan-70s', -86, 136.6, Math.PI / 2 + 0.05);
add('police-cruiser', -122, 132.4, -Math.PI / 2 + 0.1);
add('police-cruiser', -126, 135.8, Math.PI / 2 + 0.2);
add('suburban-pickup-truck', -99, 131.6, Math.PI / 2 - 0.1);
add('compact-hatchback', -112, 136.8, -Math.PI / 2 + 0.15);
add('delivery-truck', -134, 131.8, 1.4);
add('ambulance-van', -80, 133.4, 2.6);
add('police-barricade', -144, 131.2, 0.1);
add('police-barricade', -144, 137, -0.1);
add('traffic-cone', -141, 134, 0, { solid: false });
add('collapse-rubble-mound', -139, 150, 0.4);
add('oil-drum', -82, 146, 0);
add('construction-dumpster', -112, 151.5, 0.1);
add('wooden-crate', -96.5, 151, 0.4);
// fences round the back lots, north of the north row and south of the south row
for (const x of [-80, -86, -92]) add('board-privacy-fence-run', x, 152.6, 0);
for (const x of [-141, -145, -149]) add('board-privacy-fence-run', x, 117, 0);

export const TOWN_BUILDINGS: BuildingDef[] = [
  {
    id: 'pharmacy', chunk: 'pharmacy', poi: 'town', kind: 'shop', x: -88, z: 122, yaw: 0, w: 10, d: 10, h: 3.4,
    wall: '#cfd8d4', roof: '#6c6a66', trim: '#2f7d6a', floor: '#c9ccc6', floorSurface: 'concrete',
    front: [wide(-3.2, 2.6), door(0), wide(3.2, 2.6)],
    back: [door(3.6, 1.0), win(-2.5)],
    left: [win(1.5)],
    right: [win(1.5)],
    partition: { v: -3.0, open: [door(-2.0, 1.0)] },
    counter: { u: 3.0, v: 1.2, w: 3 },
    furniture: [
      { k: 'metal-trash-can', u: -4.3, v: 4.0 }, { k: 'cardboard-delivery-box', u: -4.2, v: -4.2, yaw: 0.5 }, { k: 'cardboard-delivery-box', u: 4.2, v: -4.3, yaw: 1 },
      { k: 'dining-chair', u: -0.5, v: -4.0, yaw: 0.4 }, { k: 'bistro-table', u: 0.8, v: -4.0 },
    ],
    containers: [
      { type: 'pharmacy_shelf', theme: 'medical', u: -3.4, v: -2.4, yaw: 0, model: 'back-bar-shelf-unit' },
      { type: 'pharmacy_shelf', theme: 'medical', u: -1.0, v: -2.4, yaw: 0, model: 'back-bar-shelf-unit' },
      { type: 'pharmacy_shelf', theme: 'medical', u: 1.4, v: -2.4, yaw: 0, model: 'back-bar-shelf-unit' },
      { type: 'medical_cabinet', theme: 'medical', u: -3.8, v: -4.3, yaw: 0, model: 'dorm-wardrobe' },
      { type: 'bathroom_cabinet', theme: 'medical', u: 3.9, v: -4.3, yaw: 0, model: 'medicine-cabinet' },
      { type: 'office_desk', theme: 'office', u: 4.3, v: 0.3, yaw: -Math.PI / 2, model: 'filing-cabinet' },
    ],
  },
  {
    id: 'hardware', chunk: 'hardware', poi: 'town', kind: 'shop', x: -101.5, z: 122, yaw: 0, w: 11, d: 10, h: 3.6,
    wall: '#a8704a', roof: '#555b5e', trim: '#e0b04a', floor: '#8f918c', floorSurface: 'concrete',
    front: [{ u: -2.6, w: 3.6, sill: 0, top: 2.6 }, door(2.2), win(4.2, 1.0)],
    back: [door(-3.5, 1.0), win(2.5)],
    left: [win(0.5, 1.4)],
    right: [win(-1.5, 1.4)],
    counter: null,
    furniture: [
      { k: 'material-pallet', u: -4.2, v: 2.0, yaw: 0.2 }, { k: 'material-pallet', u: -4.3, v: 3.4, yaw: -0.1 }, { k: 'oil-drum', u: 4.8, v: 2.4 }, { k: 'oil-drum', u: 4.9, v: 3.0 },
      { k: 'tire', u: 4.6, v: -0.2, solid: false }, { k: 'fuel-jerrycan', u: 3.9, v: 3.6, yaw: 0.4, solid: false }, { k: 'wheelbarrow', u: -0.4, v: 2.4, yaw: 0.8 },
    ],
    containers: [
      { type: 'garage_shelf', theme: 'garage', u: -3.6, v: -4.1, yaw: 0, model: 'back-bar-shelf-unit' },
      { type: 'garage_shelf', theme: 'garage', u: -1.2, v: -4.1, yaw: 0, model: 'back-bar-shelf-unit' },
      { type: 'garage_shelf', theme: 'garage', u: 1.2, v: -4.1, yaw: 0, model: 'back-bar-shelf-unit' },
      { type: 'tool_box', theme: 'garage', u: 4.3, v: -3.8, yaw: 0.2, model: 'wooden-crate' },
      { type: 'tool_box', theme: 'garage', u: -4.6, v: 0.0, yaw: 1.5, model: 'wooden-crate' },
      { type: 'crate_wood', theme: 'garage', u: 4.5, v: -1.2, yaw: 0.3, model: 'salvage-crate' },
    ],
  },
  {
    id: 'police_station', chunk: 'police_station', poi: 'police', kind: 'shop', x: -119, z: 121.5, yaw: 0, w: 14, d: 11, h: 3.4,
    wall: '#7a8794', roof: '#3b4148', trim: '#2b4a8a', floor: '#8f918c', floorSurface: 'concrete',
    front: [win(-5.2, 1.6), win(-2.8, 1.6), door(0), win(2.8, 1.6), win(5.2, 1.6)],
    back: [door(-5.5, 1.0), win(0)],
    left: [win(1.0, 1.2)],
    right: [win(1.0, 1.2)],
    partition: { v: -2.4, open: [door(4.2, 1.0)] },
    counter: { u: -2.6, v: 2.6, w: 3.4 },
    furniture: [
      { k: 'sofa', u: 4.2, v: 4.0, yaw: Math.PI }, { k: 'bistro-table', u: -5.0, v: -1.0 }, { k: 'dining-chair', u: -5.6, v: -0.8, yaw: 1.4 }, { k: 'dining-chair', u: -4.4, v: -1.0, yaw: -1.6 },
      { k: 'metal-trash-can', u: 6.0, v: 4.6 }, { k: 'arc-floor-lamp', u: -6.2, v: 4.6 },
    ],
    containers: [
      { type: 'police_locker', theme: 'police', u: -6.4, v: 0.4, yaw: Math.PI / 2, model: 'dorm-wardrobe' },
      { type: 'police_locker', theme: 'police', u: -6.4, v: 1.8, yaw: Math.PI / 2, model: 'dorm-wardrobe' },
      { type: 'office_desk', theme: 'office', u: 2.4, v: -1.6, yaw: 0, model: 'filing-cabinet' },
      { type: 'office_desk', theme: 'office', u: -1.4, v: -1.6, yaw: 0, model: 'filing-cabinet' },
      // the armory behind the office: footlockers and locked gun cabinets (the doorway is at u = 4.2)
      { type: 'military_footlocker', theme: 'military', u: -4.6, v: -4.5, yaw: 0, model: 'salvage-crate' },
      { type: 'military_footlocker', theme: 'military', u: -2.2, v: -4.5, yaw: 0, model: 'salvage-crate' },
      { type: 'cabinet_locked', theme: 'military', u: 0.2, v: -4.6, yaw: 0, model: 'back-bar-shelf-unit' },
      { type: 'cabinet_locked', theme: 'military', u: 2.4, v: -4.6, yaw: 0, model: 'back-bar-shelf-unit' },
    ],
  },
  {
    id: 'grocery', chunk: 'grocery', poi: 'town', kind: 'shop', x: -88, z: 146, yaw: Math.PI, w: 10, d: 10, h: 3.4,
    wall: '#e3d8b8', roof: '#6c6a66', trim: '#c0392b', floor: '#b8bab4', floorSurface: 'concrete',
    front: [wide(-3.2, 2.6), door(0), wide(3.2, 2.6)],
    back: [door(3.6, 1.0), win(-2.5)],
    left: [win(0.5)],
    right: [win(0.5)],
    counter: { u: 3.2, v: 2.3, w: 3 },
    furniture: [
      { k: 'glass-door-drinks-fridge', u: -3.8, v: -4.3, yaw: 0 }, { k: 'glass-door-drinks-fridge', u: -2.6, v: -4.3, yaw: 0 }, { k: 'vending-machine', u: 4.0, v: -4.2, yaw: 0 },
      { k: 'abandoned-shopping-trolley', u: -1.0, v: 3.2, yaw: 0.6, solid: false }, { k: 'cardboard-delivery-box', u: 4.3, v: 4.0, yaw: 0.3 },
    ],
    containers: [
      { type: 'food_cupboard', theme: 'house', u: -3.5, v: -1.6, yaw: 0, model: 'back-bar-shelf-unit' },
      { type: 'food_cupboard', theme: 'house', u: -1.1, v: -1.6, yaw: 0, model: 'back-bar-shelf-unit' },
      { type: 'food_cupboard', theme: 'house', u: 1.3, v: -1.6, yaw: 0, model: 'back-bar-shelf-unit' },
      { type: 'kitchen_cupboard', theme: 'house', u: 3.9, v: -2.0, yaw: 0, model: 'counter' },
      { type: 'gas_register', theme: 'gas_station', u: 3.2, v: 2.3, yaw: 0, y: 1.0, model: 'register' },
    ],
  },
  {
    id: 'motel', chunk: 'motel', poi: 'town', kind: 'house', x: -125, z: 144.5, yaw: Math.PI, w: 20, d: 7, h: 3.0,
    wall: '#d9c9a0', roof: '#7a4a3a', trim: '#2f7a8a', floor: '#7e6446', floorSurface: 'wood',
    front: [door(-7.5, 1.1), win(-6, 1.0), door(-2.5, 1.1), win(-1, 1.0), door(2.5, 1.1), win(4, 1.0), door(7.5, 1.1), win(9, 1.0)],
    back: [win(-7.5, 0.9), win(-2.5, 0.9), win(2.5, 0.9), win(7.5, 0.9)],
    left: [],
    right: [],
    dividers: [{ u: -5, open: [] }, { u: 0, open: [] }, { u: 5, open: [] }],
    roofBreak: { side: 'back', u0: -4, u1: 4 },
    furniture: [-7.5, -2.5, 2.5, 7.5].flatMap((c) => [
      { k: 'bed', u: c - 1.4, v: -2.4, yaw: 0 }, { k: 'dining-chair', u: c + 1.3, v: -0.8, yaw: 3.0 }, { k: 'area-rug', u: c, v: 0.5, solid: false },
    ]),
    containers: [-7.5, -2.5, 2.5, 7.5].flatMap((c, i) => [
      { type: 'nightstand', theme: 'house', u: c + 0.2, v: -3.0, yaw: 0, model: 'bedside-table' },
      ...(i % 2 === 0 ? [{ type: 'wardrobe', theme: 'house', u: c + 1.7, v: -3.1, yaw: 0, model: 'dorm-wardrobe' }] : []),
    ]),
  },
];

export const TOWN_SIGNS = [
  { poi: 'town', x: -67.4, z: 158, toward: [-67.4, 185] as [number, number] },
  { poi: 'police', x: -109.6, z: 129, toward: [-85, 129] as [number, number] },
];
