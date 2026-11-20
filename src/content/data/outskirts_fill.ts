import { BUILDINGS, CLEAR_RECTS, OUT, PLACED, ROADS, type Placed } from './outskirts';
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
