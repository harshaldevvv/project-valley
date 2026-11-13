import { BoxGeometry } from 'three';
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
function wall(kit: Kit, x0: number, z0: number, len: number, alongX: boolean, openings: Opening[], swatch = 'siding_green') {
  const H = cabin.h;
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

export function buildCabin(kit: Kit) {
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
