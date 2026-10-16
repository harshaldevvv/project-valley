import { yard } from '../../content/data/yard';
import { faceToward, type Placement } from './kit';
import { trackLoop as L } from './spawns';
import { CORNER_CLEAR } from './stations/track';

/**
 * Every env_light_pole_a in the Yard (plain data). Each pole's lamp arm points along its front (-Z),
 * toward the thing it lights. The engine lights the lamps at night from `lampHeads`.
 */
const P = (x: number, z: number, tx: number, tz: number): Placement => ({
  id: 'env_light_pole_a', size: [0.3, 6, 0.3], x, z, yaw: faceToward(x, z, tx, tz),
});
const s = yard.stations;
const ring = [2, 3, 4].map((k) => {
  // anim stand: 3 poles on the far (south) half only, so none stands between the viewing spot / approach
  // path from spawn and the pedestal (QA-067)
  const a = -Math.PI / 2 + (k * Math.PI) / 3;
  return P(s.anim.x + Math.cos(a) * 6.5, s.anim.z + Math.sin(a) * 6.5, s.anim.x, s.anim.z);
});
const trackR = CORNER_CLEAR + 2; // outside the straights' run-off (QA-040)

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
  // pen (QA-052): north + south sides and the east middle; nothing west of the fence, which is the
  // track's west-straight run-off (QA-040)
  ...[-1, 1].flatMap((sz) => [-0.75, 0.75].map((fx) =>
    P(s.pen.x + fx * (s.pen.w / 2), s.pen.z + sz * (s.pen.d / 2 + 1.5), s.pen.x, s.pen.z))),
  P(s.pen.x + s.pen.w / 2 + 1.5, s.pen.z, s.pen.x, s.pen.z),
  P(s.pen.x, s.pen.z + 0.85, s.pen.x, s.pen.z), // floodlight mast in the middle: its head is over the centre (QA-052)
  // build pad: two opposite corners
  P(s.build.x - s.build.w / 2 - 1.5, s.build.z - s.build.d / 2 - 1.5, s.build.x, s.build.z),
  P(s.build.x + s.build.w / 2 + 1.5, s.build.z + s.build.d / 2 + 1.5, s.build.x, s.build.z),
  // track: outside each corner, plus one over the start box
  ...[[1, -1], [1, 1], [-1, 1], [-1, -1]].map(([sx, sz]) => {
    const cx = L.cx + sx * (L.hx - L.r), cz = L.cz + sz * (L.hz - L.r);
    return P(cx + sx * trackR * Math.SQRT1_2, cz + sz * trackR * Math.SQRT1_2, cx, cz);
  }),
  P(L.cx - L.hx - L.width / 2 - 4, L.cz + 6, L.cx - L.hx, L.cz + 6),
  // track straights (QA-068): 3.5 m+ off the asphalt edge, beside the straights (not in any run-off band)
  ...[-10, 10].flatMap((dx) => [
    P(L.cx + dx, L.cz - L.hz - L.width / 2 - 3.5, L.cx + dx, L.cz - L.hz), // north straight
    P(L.cx + dx, L.cz + L.hz + L.width / 2 + 5.5, L.cx + dx, L.cz + L.hz), // south (behind the barriers)
  ]),
  P(L.cx + L.hx + L.width / 2 + 5.5, L.cz, L.cx + L.hx, L.cz), // east (behind the barriers)
  P(L.cx - L.hx - L.width / 2 - 3.5, L.cz - 6, L.cx - L.hx, L.cz - 6), // west
];

/** World positions of the lamp heads (arm tip, ~5.9 m up, 0.85 m in front of the pole). */
export const lampHeads = lightPoles.map((p) => ({
  x: p.x - Math.sin(p.yaw ?? 0) * 0.85,
  y: 5.9,
  z: p.z - Math.cos(p.yaw ?? 0) * 0.85,
}));
