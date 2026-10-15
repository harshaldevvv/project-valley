import { yard } from '../../content/data/yard';
import { faceToward, type Placement } from './kit';
import { trackLoop as L } from './spawns';

/**
 * Every env_light_pole_a in the Yard (plain data). Each pole's lamp arm points along its front (-Z),
 * toward the thing it lights. The engine lights the lamps at night from `lampHeads`.
 */
const P = (x: number, z: number, tx: number, tz: number): Placement => ({
  id: 'env_light_pole_a', size: [0.3, 6, 0.3], x, z, yaw: faceToward(x, z, tx, tz),
});
const s = yard.stations;
const ring = Array.from({ length: 5 }, (_, k) => {
  // anim stand: 6-slot ring, the slot toward spawn (north) left open for the viewing spot
  const a = -Math.PI / 2 + ((k + 1) * Math.PI) / 3;
  return P(s.anim.x + Math.cos(a) * 5.2, s.anim.z + Math.sin(a) * 5.2, s.anim.x, s.anim.z);
});
const trackR = L.r + L.width / 2 + 6;

export const lightPoles: Placement[] = [
  ...ring,
  // spawn hub
  P(5, 3, 0, 0), P(-4.5, -5, 0, 0), // off the paths
  // loot: opposite corners of the pad
  P(s.loot.x + s.loot.w / 2 + 1.5, s.loot.z + s.loot.d / 2 + 1.5, s.loot.x, s.loot.z),
  P(s.loot.x - s.loot.w / 2 - 1.5, s.loot.z - s.loot.d / 2 - 1.5, s.loot.x, s.loot.z),
  // range: platform, mid lane and target end, outside the side walls
  ...[-1, 1].flatMap((sx) => [
    P(s.range.x + sx * 16.4, s.range.z + 4, s.range.x, s.range.z + 2),
    P(s.range.x + sx * 16.4, s.range.z - 26, s.range.x, s.range.z - 25),
    P(s.range.x + sx * 16.4, s.range.z - 77, s.range.x, s.range.z - 80),
  ]),
  // pen: four corners outside the fence
  ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) =>
    P(s.pen.x + sx * (s.pen.w / 2 + 1.5), s.pen.z + sz * (s.pen.d / 2 + 1.5), s.pen.x, s.pen.z)),
  // build pad: two opposite corners
  P(s.build.x - s.build.w / 2 - 1.5, s.build.z - s.build.d / 2 - 1.5, s.build.x, s.build.z),
  P(s.build.x + s.build.w / 2 + 1.5, s.build.z + s.build.d / 2 + 1.5, s.build.x, s.build.z),
  // track: outside each corner, plus one over the start box
  ...[[1, -1], [1, 1], [-1, 1], [-1, -1]].map(([sx, sz]) => {
    const cx = L.cx + sx * (L.hx - L.r), cz = L.cz + sz * (L.hz - L.r);
    return P(cx + sx * trackR * Math.SQRT1_2, cz + sz * trackR * Math.SQRT1_2, cx, cz);
  }),
  P(L.cx - L.hx - L.width / 2 - 2, L.cz + 6, L.cx - L.hx, L.cz + 6),
];

/** World positions of the lamp heads (arm tip, ~5.9 m up, 0.85 m in front of the pole). */
export const lampHeads = lightPoles.map((p) => ({
  x: p.x - Math.sin(p.yaw ?? 0) * 0.85,
  y: 5.9,
  z: p.z - Math.cos(p.yaw ?? 0) * 0.85,
}));
