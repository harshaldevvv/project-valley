import { BoxGeometry, Vector3 } from 'three';
import type { Kit } from './kit';

/**
 * A ruined survivor cabin on the west lawn: walk-in interior with a door and windows, a half-collapsed roof, a wood
 * floor, and furniture (the AI-made sofa and crates are placed from genProps.ts). Built from the kit's boxes with
 * colliders, so it costs a handful of draws inside the one merged yard mesh.
 */
export const cabin = { x: -72, z: -36, w: 8, d: 6, h: 2.8, doorX: -68 };

const T = 0.2; // wall thickness
type Opening = { a: number; b: number; sill: number; top: number }; // along-wall span (m from wall start), vertical span

/** A wall from (x0,z0) running +u for `len` m; `alongX` picks the axis. Openings become gaps with sill and lintel pieces. */
function wall(kit: Kit, x0: number, z0: number, len: number, alongX: boolean, openings: Opening[], swatch = 'siding_green', H = cabin.h) {
  const at = (u: number) => (alongX ? [x0 + u, z0] : [x0, z0 + u]);
  const piece = (u0: number, u1: number, y0: number, y1: number) => {
    if (u1 - u0 < 0.01 || y1 - y0 < 0.01) return;
    const [cx, cz] = at((u0 + u1) / 2);
    kit.box(alongX ? u1 - u0 : T, y1 - y0, alongX ? T : u1 - u0, swatch, cx, y0, cz, 0, true, 0.55);
  };
  let u = 0;
  for (const o of [...openings].sort((p, q) => p.a - q.a)) {
    piece(u, o.a, 0, H);
    piece(o.a, o.b, 0, o.sill);
    piece(o.a, o.b, o.top, H);
    u = o.b;
  }
  piece(u, len, 0, H);
}

export async function buildCabin(kit: Kit) {
  const { x, z, w, d, h } = cabin;
  const x0 = x - w / 2, z0 = z - d / 2;
  // floor (visual pad on the ground; footing counts as wood)
  kit.pad(w, d, x, z, 'wood_weathered', 0.1, 0.45);
  // north and south walls (windows), west wall (solid), east wall (door facing the lawn, one window)
  wall(kit, x0, z0, w, true, [{ a: 1.4, b: 2.6, sill: 0.9, top: 2.1 }, { a: 5.2, b: 6.4, sill: 0.9, top: 2.1 }]);
  wall(kit, x0, z0 + d, w, true, [{ a: 2.9, b: 4.5, sill: 0.9, top: 2.1 }]);
  wall(kit, x0, z0, d, false, [{ a: 2.0, b: 3.4, sill: 1.0, top: 2.0 }]);
  wall(kit, x0 + w, z0, d, false, [{ a: 1.1, b: 2.1, sill: 0.0, top: 2.1 }, { a: 4.2, b: 5.2, sill: 0.9, top: 2.1 }]);
  // half-collapsed roof: two slabs on the south half, the north half open to the sky, fallen beams inside
  const slab = (cx: number, cz: number, sx: number, sz: number, tilt: number, tiltAxis: 'x' | 'z') => {
    const g = new BoxGeometry(sx, 0.12, sz);
    if (tiltAxis === 'x') g.rotateX(tilt); else g.rotateZ(tilt);
    kit.paint(g.translate(cx, h + 0.35, cz), 'plywood', 0.7);
  };
  slab(x - 2, z + 1.55, 4.3, 3.2, -0.22, 'x');
  slab(x + 2.2, z + 1.4, 3.6, 3.0, -0.18, 'x');
  // beams across the opening
  for (const [bx, bz, yaw] of [[x - 1, z - 1.2, 0.0], [x + 1.5, z - 0.6, 0.35]] as const) kit.box(5, 0.18, 0.18, 'wood_dark', bx, h - 0.12, bz, yaw, false, 0.5);
  // fallen rafters on the floor
  kit.box(3.2, 0.16, 0.16, 'wood_dark', x - 1.4, 0.1, z - 1.6, 0.6, true, 0.5);
  kit.box(2.4, 0.16, 0.16, 'wood_dark', x + 1.9, 0.1, z - 0.4, -0.35, true, 0.5);
  // furniture: table with two benches, shelf along the west wall
  kit.box(1.6, 0.08, 0.8, 'wood_raw', x + 0.8, 0.78, z + 0.9, 0.1, true, 0.5);
  for (const [lx, lz] of [[0.2, 0.55], [1.4, 0.55], [0.2, 1.25], [1.4, 1.25]]) kit.box(0.08, 0.78, 0.08, 'wood_dark', x + lx, 0, z + lz, 0, false, 0.5);
  kit.box(1.5, 0.06, 0.3, 'wood_weathered', x + 0.9, 0.42, z + 0.25, 0.1, true, 0.5);
  kit.box(0.4, 1.9, 2.0, 'wood_dark', x0 + 0.3, 0, z - 0.4, 0, true, 0.5);
  for (const sy of [0.5, 0.95, 1.4]) kit.box(0.46, 0.05, 2.0, 'wood_weathered', x0 + 0.3, sy, z - 0.4, 0, false, 0.5);
}

/** A searchable container inside a room (type = containers.ts id, model = a pipeline prop). */
async function loot(kit: Kit, type: string, id: string, size: [number, number, number], x: number, z: number, yaw: number, y = 0) {
  const object = await kit.one({ id, size, x, z, yaw, y });
  kit.game.places.containers.push({ id: `loot_${type}_${kit.game.places.containers.length}`, type, object, position: new Vector3(x, y, z) });
}

export async function buildCabinLoot(kit: Kit) {
  const { x, z } = cabin;
  await loot(kit, 'food_cupboard', 'prop_cabinet_metal_a', [0.9, 1.8, 0.5], x - 1.0, z + 2.6, Math.PI);
  await loot(kit, 'tool_box', 'prop_crate_wood_a', [1.08, 0.6, 0.62], x + 2.6, z - 2.5, 0.3);
}

/** Corner shop (gas-station style): a flat-roofed shop with a counter, shelf rows and a fuel canopy out front. */
export const shop = { x: 66, z: -62, w: 9, d: 6.5, h: 3.0 };
export async function buildShop(kit: Kit) {
  const { x, z, w, d, h } = shop;
  const x0 = x - w / 2, z0 = z - d / 2;
  kit.pad(w + 2, d + 2, x, z, 'tile_floor', 0.1, 0.55);
  const sw = 'paint_white_faded';
  wall(kit, x0, z0, w, true, [], sw, h); // north, solid back wall
  wall(kit, x0, z0 + d, w, true, [{ a: 1.3, b: 4.4, sill: 0.0, top: 2.4 }, { a: 5.6, b: 7.7, sill: 0.9, top: 2.3 }], sw, h); // south: wide shopfront gap + window (the glass is gone)
  wall(kit, x0, z0, d, false, [{ a: 2.2, b: 4.6, sill: 1.0, top: 2.3 }], sw, h);
  wall(kit, x0 + w, z0, d, false, [{ a: 2.6, b: 3.6, sill: 0.0, top: 2.1 }], sw, h); // side door
  // flat roof slab with a hole torn in it
  kit.box(w + 0.4, 0.2, 2.4, 'concrete_dark', x, h, z0 + 1.0, 0, false, 0.55);
  kit.box(3.4, 0.2, d + 0.4, 'concrete_dark', x0 + 1.4, h, z, 0, false, 0.55);
  kit.box(3.2, 0.2, d + 0.4, 'concrete_dark', x + w / 2 - 1.5, h, z, 0, false, 0.55);
  // fuel canopy in front on two posts, with a pump island
  kit.box(8.5, 0.25, 4.2, 'paint_red_faded', x, 3.6, z0 + d + 4.2, 0, false, 0.6);
  for (const dx of [-3.6, 3.6]) kit.box(0.35, 3.6, 0.35, 'metal_dark', x + dx, 0, z0 + d + 5.6, 0, true, 0.5);
  kit.box(3.2, 0.2, 1.0, 'concrete', x, 0, z0 + d + 4.2, 0, true, 0.55);
  for (const dx of [-0.9, 0.9]) { kit.box(0.5, 1.5, 0.4, 'paint_red_faded', x + dx, 0.2, z0 + d + 4.2, 0, true, 0.5); kit.box(0.4, 0.4, 0.3, 'glass_dirty', x + dx, 1.1, z0 + d + 4.4, 0, false, 0.5); }
  // interior: counter, three shelf rows
  kit.box(3.2, 1.0, 0.8, 'wood_dark', x - 1.6, 0, z0 + 1.6, 0, true, 0.5);
  kit.box(3.3, 0.06, 0.9, 'wood_weathered', x - 1.6, 1.0, z0 + 1.6, 0, false, 0.5);
  for (const sz of [z0 + 3.3, z0 + 4.6]) {
    kit.box(3.8, 1.7, 0.45, 'metal_dark', x - 0.6, 0, sz, 0, true, 0.5);
    for (const sy of [0.55, 1.0, 1.45]) kit.box(3.8, 0.04, 0.5, 'metal_bare', x - 0.6, sy, sz, 0, false, 0.6);
  }
  // fallen shelf and spilled stock
  kit.box(3.0, 0.12, 0.45, 'metal_dark', x + 2.5, 0.12, z + 1.0, 0.5, true, 0.5);
  await loot(kit, 'food_cupboard', 'prop_cabinet_metal_a', [0.9, 1.8, 0.5], x - 3.6, z0 + 0.5, 0);
  await loot(kit, 'medical_cabinet', 'prop_cabinet_metal_a', [0.9, 1.8, 0.5], x - 2.6, z0 + 0.5, 0);
  await loot(kit, 'tool_box', 'prop_crate_wood_a', [1.08, 0.6, 0.62], x + 3.3, z0 + 1.0, -0.3);
}

/** Farmhouse room: a stone-floored kitchen/living room with a low ceiling, door facing south and one window. */
export const farm = { x: -70, z: 62, w: 7, d: 6, h: 2.6 };
export async function buildFarm(kit: Kit) {
  const { x, z, w, d, h } = farm;
  const x0 = x - w / 2, z0 = z - d / 2;
  kit.pad(w, d, x, z, 'wood_painted_white', 0.1, 0.45);
  const sw = 'siding_yellow';
  wall(kit, x0, z0, w, true, [{ a: 2.5, b: 4.0, sill: 1.0, top: 2.1 }], sw, h);
  wall(kit, x0, z0 + d, w, true, [{ a: 2.9, b: 3.9, sill: 0.0, top: 2.1 }, { a: 5.3, b: 6.4, sill: 1.0, top: 2.1 }], sw, h); // south door
  wall(kit, x0, z0, d, false, [], sw, h);
  wall(kit, x0 + w, z0, d, false, [{ a: 2.0, b: 3.2, sill: 1.0, top: 2.1 }], sw, h);
  // intact flat plank ceiling over the back half, open to the sky at the front
  kit.box(w + 0.4, 0.15, 2.8, 'wood_dark', x, h, z0 + 1.2, 0, false, 0.5);
  // furniture: table + chairs, stove, bed frame, wardrobe
  kit.box(1.4, 0.07, 0.9, 'wood_raw', x + 0.2, 0.75, z - 0.2, 0, true, 0.5);
  for (const [lx, lz] of [[-0.55, -0.35], [0.55, -0.35], [-0.55, 0.35], [0.55, 0.35]]) kit.box(0.07, 0.75, 0.07, 'wood_dark', x + 0.2 + lx, 0, z - 0.2 + lz, 0, false, 0.5);
  kit.box(0.45, 0.45, 0.45, 'wood_weathered', x - 1.0, 0, z - 0.2, 0, true, 0.5);
  kit.box(0.45, 0.45, 0.45, 'wood_weathered', x + 1.4, 0, z - 0.4, 0.5, true, 0.5);
  kit.box(0.8, 0.9, 0.6, 'metal_dark', x - w / 2 + 0.6, 0, z0 + 0.6, 0, true, 0.5); // stove
  kit.box(0.14, 1.6, 0.16, 'metal_dark', x - w / 2 + 0.6, 0.9, z0 + 0.6, 0, false, 0.5);
  kit.box(2.0, 0.35, 1.0, 'wood_dark', x + w / 2 - 1.2, 0, z0 + 0.7, 0, true, 0.5); // bed frame
  kit.box(1.9, 0.12, 0.9, 'cloth_grey', x + w / 2 - 1.2, 0.35, z0 + 0.7, 0, false, 0.5);
  await loot(kit, 'wardrobe', 'prop_cabinet_metal_a', [0.9, 1.8, 0.5], x + 1.0, z0 + 0.45, 0);
  await loot(kit, 'food_cupboard', 'prop_cabinet_metal_a', [0.9, 1.8, 0.5], x - 0.2, z0 + 0.45, 0);
  await loot(kit, 'duffel', 'prop_duffel_bag_a', [0.8, 0.35, 0.4], x - 2.4, z + 1.8, 0.4, 0.04);
}
