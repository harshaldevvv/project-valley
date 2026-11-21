import { BUILDINGS as ALL_BUILDINGS, CLEAR_RECTS as ALL_CLEAR, OUT, PADS as ALL_PADS, PLACED as ALL_PLACED, ROADS as ALL_ROADS, type Placed } from './outskirts';
import { LAKE_BUILDINGS, LAKE_CLEAR, LAKE_PADS, LAKE_PLACED, LAKE_ROADS } from './outskirts_lake';
import type { PoiContainer } from './pois';

/**
 * Filler for the open ground between the POIs: abandoned cars along the roads (some with a searchable trunk), a power line on
 * the main road, fences, rock clusters, debris, and the micro-POIs (broken-down bus, hunting stand, roadside memorial). Seeded,
 * so the layout is the same every run. Plain data; chunks are 60 m cells (one draw each, culled by distance).
 */
let seed = 20261120;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const range = (a: number, b: number) => a + (b - a) * rnd();
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

export const FILL: Placed[] = [];
export const FILL_SPOTS: (PoiContainer & { poi: string; id: string })[] = [];
// The fill is rolled as if the lake campground (outskirts_lake.ts, added later) were not there, so the seeded layout
// everywhere else stays exactly as tuned; whatever lands in the campground or on its track is dropped at the end of the file.
const notLake = <T,>(all: T[], lake: T[]) => all.filter((x) => !lake.includes(x));
const BUILDINGS = notLake(ALL_BUILDINGS, LAKE_BUILDINGS), CLEAR_RECTS = notLake(ALL_CLEAR, LAKE_CLEAR), PADS = notLake(ALL_PADS, LAKE_PADS);
const PLACED = notLake(ALL_PLACED, LAKE_PLACED), ROADS = notLake(ALL_ROADS, LAKE_ROADS);
const chunkOf = (x: number, z: number) => `fill_${Math.floor(x / 60)}_${Math.floor(z / 60)}`;

const segDist = (x: number, z: number, ax: number, az: number, bx: number, bz: number) => {
  const l2 = (bx - ax) ** 2 + (bz - az) ** 2;
  const t = Math.min(1, Math.max(0, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2));
  return Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t));
};
const roadClear = (x: number, z: number) => Math.min(...ROADS.map((r) => segDist(x, z, r.ax, r.az, r.bx, r.bz) - r.w / 2));
const inRect = (x: number, z: number, pad: number) => CLEAR_RECTS.some(([x0, x1, z0, z1]) => x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad);
const nearBuilding = (x: number, z: number, pad: number) => BUILDINGS.some((b) => Math.hypot(x - b.x, z - b.z) < Math.hypot(b.w, b.d) / 2 + pad);
const taken: { x: number; z: number; r: number }[] = [];
const free = (x: number, z: number, r: number, opts: { onRoad?: boolean; rect?: boolean } = {}) => {
  if (x < OUT.x0 + 8 || x > OUT.x1 - 8 || z < OUT.z0 + 8 || z > OUT.z1 - 8) return false;
  if (!opts.rect && inRect(x, z, 1)) return false;
  if (!opts.onRoad && roadClear(x, z) < r) return false;
  if (nearBuilding(x, z, r)) return false;
  if (PLACED.some((p) => Math.hypot(p.x - x, p.z - z) < r + 2.5)) return false;
  return !taken.some((t) => Math.hypot(t.x - x, t.z - z) < r + t.r);
};
const put = (k: string, x: number, z: number, yaw: number, r: number, o: Partial<Placed> = {}) => {
  taken.push({ x, z, r });
  FILL.push({ chunk: chunkOf(x, z), k, x, z, yaw, ...o });
};

// ---- abandoned cars on the shoulders, some with a searchable trunk
const CARS = ['boxy-sedan-70s', 'compact-hatchback', 'station-wagon-70s', 'family-crossover-suv', 'suburban-pickup-truck', 'marigold-pickup', 'delivery-truck', 'scout-jeep', 'ambulance-van', 'police-cruiser', 'garbage-truck', 'tow-truck', 'camper-van', 'team-minibus'];
for (const r of ROADS.filter((q) => q.kind === 'asphalt')) {
  const len = Math.hypot(r.bx - r.ax, r.bz - r.az);
  const dx = (r.bx - r.ax) / len, dz = (r.bz - r.az) / len;
  for (let t = 14; t < len - 8; t += range(20, 34)) {
    if (rnd() < 0.3) continue;
    const side = rnd() < 0.5 ? -1 : 1;
    const across = rnd() < 0.18; // slewed across a lane
    const off = across ? range(0, 1.2) : r.w / 2 + range(1.3, 3.2);
    const x = r.ax + dx * t - dz * side * off, z = r.az + dz * t + dx * side * off;
    if (z < 128 || !free(x, z, 3.2, { onRoad: true })) continue;
    const yaw = Math.atan2(dx, dz) + (rnd() < 0.5 ? Math.PI : 0) + (across ? range(0.6, 1.1) : range(-0.2, 0.2));
    put(pick(CARS), x, z, yaw, 3.2, { surf: 'metal' });
    if (rnd() < 0.4) FILL_SPOTS.push({ type: 'car_trunk', theme: 'road', x: x - Math.sin(yaw) * 2.2, z: z - Math.cos(yaw) * 2.2, yaw, model: null, poi: 'road', id: `road_car${FILL_SPOTS.length}` });
  }
}

// ---- power line along the main road's east verge (the pole is at one end of each 12.2 m run)
for (let z = 112; z < 262; z += 12.21) {
  if (inRect(7.4, z + 6, -4) && z < 240) continue; // the checkpoint, fuel stop and diner have their own lamps
  FILL.push({ chunk: chunkOf(7.4, z), k: 'railway-telegraph-pole-run', x: 7.4, z: z + 6.1, yaw: 0, solid: false, boxes: [[-0.75, 2, -5.9, 0.2, 2, 0.2]] });
}

// ---- field fences (barbed wire and chain link) and rock clusters in the open
for (let n = 0, tries = 0; n < 9 && tries < 200; tries++) {
  const x0 = range(OUT.x0 + 14, OUT.x1 - 14), z0 = range(OUT.z0 + 20, OUT.z1 - 14);
  const a = pick([0, Math.PI / 2, 0.3, -0.3, Math.PI / 2 + 0.25]);
  const key = rnd() < 0.6 ? 'barbed-wire-fence-section' : 'chain-link-fence-run';
  const pieces: [number, number][] = [];
  for (let i = 0; i < 9; i++) {
    const x = x0 + Math.cos(a) * 4 * i, z = z0 - Math.sin(a) * 4 * i;
    if (free(x, z, 2.2)) pieces.push([x, z]);
    else if (pieces.length > 2) break;
    else pieces.length = 0;
  }
  if (pieces.length < 4) continue;
  n++;
  for (const [x, z] of pieces) put(key, x, z, a, 2.2);
}
for (let n = 0, tries = 0; n < 12 && tries < 300; tries++) {
  const cx = range(OUT.x0 + 14, OUT.x1 - 14), cz = range(OUT.z0 + 20, OUT.z1 - 14);
  if (!free(cx, cz, 5)) continue;
  n++;
  const k = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < k; i++) {
    const a = rnd() * 6.28, d = range(0, 4.2);
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (!free(x, z, 1.4)) continue;
    put(pick(['large-boulder', 'rock-outcrop', 'field-rock', 'field-rock', 'stone-cairn']), x, z, rnd() * 6.28, 1.4, { s: range(0.8, 1.5) });
  }
}

// ---- small debris along the roads
const DEBRIS = ['tire', 'wooden-crate', 'oil-drum', 'collapse-rubble-mound', 'fallen-log', 'traffic-cone', 'metal-trash-can', 'salvage-crate', 'cardboard-delivery-box', 'abandoned-shopping-trolley', 'tyre-stack', 'hay-bale'];
const asphalt = ROADS.filter((q) => q.kind === 'asphalt');
for (let n = 0, tries = 0; n < 70 && tries < 600; tries++) {
  const r = pick(asphalt);
  const len = Math.hypot(r.bx - r.ax, r.bz - r.az);
  const t = range(6, len - 4), side = rnd() < 0.5 ? -1 : 1, off = r.w / 2 + range(0.6, 6);
  const dx = (r.bx - r.ax) / len, dz = (r.bz - r.az) / len;
  const x = r.ax + dx * t - dz * side * off, z = r.az + dz * t + dx * side * off;
  if (z < 128 || !free(x, z, 1.2)) continue;
  n++;
  const k = pick(DEBRIS);
  put(k, x, z, rnd() * 6.28, 1.2, /tire|cone|trolley/.test(k) ? { solid: false } : {});
}

// ---- micro-POIs (data/pois.ts lists their containers and zombies)
// broken-down bus on the crash-site road
put('city-bus', -22, 239.4, -1.47, 4, { surf: 'metal' });
put('team-minibus', -52, 258.4, 1.9, 4, { surf: 'metal' });
put('sleeping-bag', -19.5, 243.2, 0.4, 1, { solid: false });
put('wooden-crate', -26.5, 236.2, 0.3, 1);
put('tire', -15.4, 241, 0, 1, { solid: false });
// hunting stand: a hide on stilts with a camp at its foot
put('splay-leg-lookout-tower', -84, 231, 0.3, 3.2);
put('stone-fire-pit', -79.6, 233.6, 0, 1.2);
put('hearth-log-bench', -79.6, 231.4, 1.57, 1);
put('fallen-log', -88, 236, 0.8, 1.5);
put('sleeping-bag', -81.4, 235.6, 2.2, 1, { solid: false });
// roadside memorial on the main road
put('roadside-capilla-shrine', 10.4, 200, -Math.PI / 2, 2.4);
put('grave-cross', 9.4, 196.6, -1.4, 0.8, { solid: false });
put('grave-cross', 10.2, 195.8, -1.7, 0.8, { solid: false });
put('grave-cross', 8.9, 197.8, -1.2, 0.8, { solid: false });
put('stone-cairn', 11.6, 203.6, 0.3, 0.8);
put('camping-lantern', 8.2, 200.6, 0, 0.5, { solid: false });

// ================= Roadside set dressing, round 2 (D3): roadblocks, power lines on the side roads, mailboxes, signs,
// guardrails, bins, dead trees and small lootable spots (coolers, dropped bags). Same 60 m chunks, so most cells add no draw.
type Road = (typeof ROADS)[number];
/** point `off` metres to one side of road r at distance t along it; yaw = the road's heading (a model's +Z along the road) */
const along = (r: Road, t: number, side: number, off: number) => {
  const len = Math.hypot(r.bx - r.ax, r.bz - r.az), dx = (r.bx - r.ax) / len, dz = (r.bz - r.az) / len;
  return { x: r.ax + dx * t - dz * side * off, z: r.az + dz * t + dx * side * off, yaw: Math.atan2(dx, dz), len };
};
const spot = (type: string, x: number, z: number, yaw: number, id: string) => FILL_SPOTS.push({ type, theme: 'road', x, z, yaw, model: null, poi: 'road', id });
const roadAt = (ax: number, az: number, bx: number, bz: number) => {
  const r = ROADS.find((q) => q.ax === ax && q.az === az && q.bx === bx && q.bz === bz);
  if (!r) throw new Error(`outskirts_fill: no road ${ax},${az} -> ${bx},${bz}`);
  return r;
};
const MAIN = roadAt(0, 98, 0, 268), FARM = roadAt(0, 165, 100, 165), DINER = roadAt(0, 232, 70, 232), CRASH = roadAt(0, 244, -78, 252), MILL = roadAt(-72, 199, -72, 134);
// The POI clear zones (CLEAR_RECTS) cover most road frontage; roadside things may go inside them, but never on a pad
// (forecourts, aprons, the turnaround), near a building or on top of a placed model.
const onPad = (x: number, z: number, pad: number) => PADS.some((p) => Math.abs(x - p.x) < p.w / 2 + pad && Math.abs(z - p.z) < p.d / 2 + pad);
const freeR = (x: number, z: number, r: number, opts: { onRoad?: boolean } = {}) => !onPad(x, z, 0.5) && free(x, z, r, { ...opts, rect: true });

/** within 7 m of another road's edge: the mouth of a junction, kept clear so turning traffic (and the walk) gets through */
const inJunction = (x: number, z: number, self: Road) => ROADS.some((o) => o !== self && segDist(x, z, o.ax, o.az, o.bx, o.bz) < o.w / 2 + 7);
const SMALL_CARS = ['boxy-sedan-70s', 'compact-hatchback', 'station-wagon-70s', 'family-crossover-suv', 'suburban-pickup-truck', 'marigold-pickup', 'scout-jeep'];
// ---- roadblocks: barriers across both lanes with a ~3.4 m gap in the middle (people squeezed through), a car pushed
// against them, cones, and a bag someone dropped. Barriers' long side is their local X, so the road heading lays them across.
const ROADBLOCKS: [Road, number, 'police' | 'army' | 'civil'][] = [
  [MAIN, 122, 'police'], // between Maple Street and the diner road
  [MILL, 26, 'police'], // the edge of Dunmore
  [FARM, 70, 'army'], // short of the Camp Harlan track
  [CRASH, 46, 'civil'], // crash-site road
];
ROADBLOCKS.forEach(([r, t, kind], bi) => {
  const half = r.w / 2;
  const bar = kind === 'army' ? 'sandbag-wall-section' : kind === 'police' ? 'police-barricade' : 'field-barricade';
  const wide = kind === 'army' ? 4 : kind === 'police' ? 2.4 : 2;
  for (const side of [-1, 1]) {
    for (let o = 1.7 + wide / 2; o - wide / 2 < half; o += wide) {
      const p = along(r, t, side, o);
      put(bar, p.x, p.z, p.yaw + range(-0.06, 0.06), wide / 2);
    }
    const j = along(r, t + 2.8, side, 2.9 + range(0, 0.6));
    put('skated-jersey-barrier', j.x, j.z, j.yaw + range(-0.3, 0.3), 1.1);
  }
  const c = along(r, t - 7, 1, half + 1.4);
  put(kind === 'police' ? 'police-cruiser' : kind === 'army' ? 'scout-jeep' : pick(CARS), c.x, c.z, c.yaw + range(0.25, 0.5), 3, { surf: 'metal' });
  const c2 = along(r, t + 8, -1, half + 1.6);
  if (!inJunction(c2.x, c2.z, r) && freeR(c2.x, c2.z, 3, { onRoad: true })) {
    const yaw = c2.yaw + Math.PI + range(-0.4, -0.2);
    put(pick(CARS), c2.x, c2.z, yaw, 3, { surf: 'metal' });
    spot('car_trunk', c2.x - Math.sin(yaw) * 2.2, c2.z - Math.cos(yaw) * 2.2, yaw, `road_block${bi}_trunk`);
  }
  for (let i = 0; i < 3; i++) {
    const p = along(r, t - range(3, 5), rnd() < 0.5 ? -1 : 1, range(1.9, half));
    put('traffic-cone', p.x, p.z, rnd() * 6.28, 0.4, { solid: false });
  }
  const b = along(r, t + range(1.5, 3), -1, half + range(1.5, 2.5));
  if (freeR(b.x, b.z, 0.8, { onRoad: true })) {
    put('kit-bag', b.x, b.z, rnd() * 6.28, 0.8, { solid: false });
    spot('duffel', b.x, b.z, 0, `road_block${bi}_bag`);
  }
});

// ---- power lines on the side roads (the run model has its pole at local z = -5.9 and wires to the next pole)
for (const r of [FARM, DINER, CRASH, MILL]) {
  const L = Math.hypot(r.bx - r.ax, r.bz - r.az);
  for (let t = 14; t + 12.21 < L - 4; t += 12.21) {
    const p = along(r, t + 6.1, -1, r.w / 2 + 3.6);
    if (!freeR(p.x, p.z, 1, { onRoad: true })) continue;
    taken.push({ x: p.x, z: p.z, r: 0.6 });
    FILL.push({ chunk: chunkOf(p.x, p.z), k: 'railway-telegraph-pole-run', x: p.x, z: p.z, yaw: p.yaw, solid: false, boxes: [[-0.75, 2, -5.9, 0.2, 2, 0.2]] });
  }
}

// ---- mailboxes at the farm, ranger and camp drives (post collider), road signs at the junctions
const MAILBOXES: [number, number, number][] = [[86, 169.6, Math.PI], [96.5, 169.6, Math.PI], [74, 237.4, Math.PI], [4.5, 266.2, -Math.PI / 2], [-40, 191.6, 0]];
for (const [x, z, yaw] of MAILBOXES) if (freeR(x, z, 0.5, { onRoad: true })) put('mailbox', x, z, yaw, 0.5, { boxes: [[0, 0.6, 0, 0.12, 0.6, 0.12]] });
const SIGNS: [string, number, number, number][] = [
  ['speed-limit-sign', 5.6, 138, 0], ['route-shield-sign', -5.6, 176, Math.PI], ['speed-limit-sign', 12, 160.2, -Math.PI / 2],
  ['route-shield-sign', 5.4, 226, 0], ['speed-limit-sign', -66.8, 192, Math.PI], ['route-shield-sign', -8, 248.6, Math.PI / 2], ['speed-limit-sign', 64, 236, Math.PI / 2],
];
for (const [k, x, z, yaw] of SIGNS) if (freeR(x, z, 0.5, { onRoad: true })) put(k, x, z, yaw, 0.5, { boxes: [[0, 1.2, 0, 0.08, 1.2, 0.08]] });

// ---- guardrails (4 m sections, long side local X) on stretches past a ditch
const RAILS: [Road, number, number, number][] = [[DINER, 28, 6, 1], [CRASH, 56, 5, 1], [MAIN, 150, 4, -1]];
for (const [r, t0, n, side] of RAILS) {
  for (let i = 0; i < n; i++) {
    const p = along(r, t0 + i * 4, side, r.w / 2 + 1.1);
    if (freeR(p.x, p.z, 1.9, { onRoad: true })) put('guardrail-section', p.x, p.z, p.yaw + Math.PI / 2, 1.9, { shrink: 1, surf: 'metal' });
  }
}

// ---- more abandoned cars on the shoulders (the first pass above stays out of the POI zones, so most frontage was bare).
// A few sit half on the lane, never closer than 2 m to the centre line, so the roads stay walkable and drivable.
for (const r of asphalt) {
  const L = Math.hypot(r.bx - r.ax, r.bz - r.az);
  for (let t = 10; t < L - 8; t += range(9, 15)) {
    if (rnd() < 0.2) continue;
    const s0 = rnd() < 0.5 ? -1 : 1, lane = rnd() < 0.15, off = lane ? Math.max(3.1, r.w / 2 - 0.2) : r.w / 2 + range(1.4, 2.8);
    const p = [along(r, t, s0, off), along(r, t, -s0, off)].find((q) => q.z >= 128 && !inJunction(q.x, q.z, r) && freeR(q.x, q.z, 2.4, { onRoad: true }));
    if (!p) continue;
    const yaw = p.yaw + (rnd() < 0.5 ? Math.PI : 0) + range(-0.25, 0.25);
    put(pick(lane ? SMALL_CARS : CARS), p.x, p.z, yaw, 2.6, { surf: 'metal' });
    if (rnd() < 0.35) spot('car_trunk', p.x - Math.sin(yaw) * 2.2, p.z - Math.cos(yaw) * 2.2, yaw, `road_car2_${FILL_SPOTS.length}`);
  }
}

// ---- bins and drums at lay-bys, a dumpster every third
for (let n = 0, tries = 0; n < 10 && tries < 300; tries++) {
  const r = pick(asphalt);
  const p = along(r, range(8, Math.hypot(r.bx - r.ax, r.bz - r.az) - 8), rnd() < 0.5 ? -1 : 1, r.w / 2 + range(1.4, 2.6));
  if (p.z < 128 || !freeR(p.x, p.z, 1.8)) continue;
  n++;
  if (n % 3 === 0) { put('construction-dumpster', p.x, p.z, p.yaw + range(-0.2, 0.2), 1.8, { surf: 'metal' }); continue; }
  const k = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < k; i++) {
    const x = p.x + Math.cos(i * 2.1) * 0.9, z = p.z + Math.sin(i * 2.1) * 0.9;
    if (freeR(x, z, 0.45)) put(rnd() < 0.7 ? 'metal-trash-can' : 'oil-drum', x, z, rnd() * 6.28, 0.45, { surf: 'metal' });
  }
}

// ---- dead trees (trunk collider only) and stumps in the verges and the fields between the POIs
for (let n = 0, tries = 0; n < 34 && tries < 900; tries++) {
  let x: number, z: number;
  if (rnd() < 0.6) {
    const r = pick(ROADS);
    const p = along(r, range(4, Math.hypot(r.bx - r.ax, r.bz - r.az) - 4), rnd() < 0.5 ? -1 : 1, r.w / 2 + range(4, 12));
    x = p.x; z = p.z;
  } else { x = range(OUT.x0 + 16, OUT.x1 - 16); z = range(OUT.z0 + 24, OUT.z1 - 16); }
  if (z < 128 || !free(x, z, 2.6)) continue;
  n++;
  const s = range(0.85, 1.35);
  if (rnd() < 0.75) put('dead-tree', x, z, rnd() * 6.28, 2.6, { s, boxes: [[0, 1.4, 0, 0.22, 1.4, 0.22]], surf: 'wood' });
  else put('tree-stump', x, z, rnd() * 6.28, 1, { s, surf: 'wood' });
}

// ---- coolers people dropped by the road (searchable, food and water), one at the hunting camp
let coolers = 0;
for (let tries = 0; coolers < 7 && tries < 400; tries++) {
  const r = pick(asphalt);
  const p = along(r, range(10, Math.hypot(r.bx - r.ax, r.bz - r.az) - 10), rnd() < 0.5 ? -1 : 1, r.w / 2 + range(1.2, 3.5));
  if (p.z < 128 || !freeR(p.x, p.z, 0.9)) continue;
  const yaw = rnd() * 6.28;
  put('camp-cooler', p.x, p.z, yaw, 0.9, { surf: 'rubber' });
  spot('cooler', p.x, p.z, yaw, `road_cooler${coolers++}`);
}
put('camp-cooler', -78.2, 234.6, 0.6, 0.6, { surf: 'rubber' });
spot('cooler', -78.2, 234.6, 0.6, 'road_cooler_hunt');

// ---- drop fill that landed in the lake campground or on its track (see the note at the top)
{
  const inLake = (x: number, z: number) =>
    LAKE_CLEAR.some(([x0, x1, z0, z1]) => x > x0 - 2 && x < x1 + 2 && z > z0 - 2 && z < z1 + 2) ||
    LAKE_ROADS.some((r) => segDist(x, z, r.ax, r.az, r.bx, r.bz) < r.w / 2 + 3);
  for (const list of [FILL, FILL_SPOTS] as { x: number; z: number }[][]) {
    const keep = list.filter((p) => !inLake(p.x, p.z));
    list.splice(0, list.length, ...keep);
  }
}
