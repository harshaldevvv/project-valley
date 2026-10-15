import { BufferAttribute, BufferGeometry } from 'three';
import { yard } from '../../../content/data/yard';
import type { Kit } from '../kit';
import { stationSign, textFlat } from '../signs';
import { trackLoop as L, yardSpawns } from '../spawns';
import { wedge } from './range';

const S = yard.stations.track;

/** Closed rounded-rectangle centreline, clockwise seen from above (x, z pairs). */
function loop(): [number, number][] {
  const pts: [number, number][] = [];
  const corners: [number, number, number][] = [
    [L.cx + L.hx - L.r, L.cz - L.hz + L.r, -Math.PI / 2], // NE
    [L.cx + L.hx - L.r, L.cz + L.hz - L.r, 0], // SE
    [L.cx - L.hx + L.r, L.cz + L.hz - L.r, Math.PI / 2], // SW
    [L.cx - L.hx + L.r, L.cz - L.hz + L.r, Math.PI], // NW
  ];
  for (const [cx, cz, a0] of corners)
    for (let i = 0; i <= 8; i++) {
      const a = a0 + (i / 8) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * L.r, cz + Math.sin(a) * L.r]);
    }
  return pts;
}

/** Flat closed ribbon between lateral offsets o0..o1 (outward +) of the loop, top at y. */
function ribbon(pts: [number, number][], o0: number, o1: number, y: number) {
  const n = pts.length;
  const off = pts.map((_, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz);
    return [-tz / l, tx / l]; // lateral (points inward on this loop)
  });
  const pos: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const v = (k: number, o: number) => [pts[k][0] + off[k][0] * o, y, pts[k][1] + off[k][1] * o];
    const a0 = v(i, o0), a1 = v(i, o1), b0 = v(j, o0), b1 = v(j, o1);
    pos.push(...a0, ...a1, ...b0, ...a1, ...b1, ...b0); // CCW from above -> normals up
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  return g;
}

export function buildTrack(kit: Kit) {
  const pts = loop();
  const hw = L.width / 2;
  kit.paint(ribbon(pts, -hw - 0.6, hw + 0.6, 0.02), 'dirt', 0.4); // gravel shoulder
  kit.paint(ribbon(pts, -hw, hw, 0.035), 'asphalt', 0.45);
  for (const o of [-hw + 0.35, hw - 0.35]) kit.paint(ribbon(pts, o - 0.08, o + 0.08, 0.045), 'road_paint_white', 0.8);

  // Corner furniture: tyre stacks on the outer apex, cones on the inner apex.
  for (const [sx, sz] of [[1, -1], [1, 1], [-1, 1], [-1, -1]]) {
    const cx = L.cx + sx * (L.hx - L.r), cz = L.cz + sz * (L.hz - L.r);
    for (const k of [-1, 0, 1]) {
      const a = Math.atan2(sz, sx) + k * 0.16;
      const ro = L.r + hw + 2;
      kit.place({ id: 'env_tire_stack_a', size: [0.8, 0.9, 0.8], x: cx + Math.cos(a) * ro, z: cz + Math.sin(a) * ro });
      const ri = L.r - hw - 0.8;
      kit.place({ id: 'env_cone_a', size: [0.35, 0.7, 0.35], x: cx + Math.cos(a) * ri, z: cz + Math.sin(a) * ri });
    }
  }

  // Jersey barriers along the outside of the east and south straights (the yard wall is close there).
  for (let i = -3; i <= 3; i++) {
    kit.place({ id: 'env_barrier_jersey_a', size: [2, 0.8, 0.6], x: L.cx + L.hx + hw + 1.5, z: L.cz + i * 2.2, yaw: Math.PI / 2 });
    kit.place({ id: 'env_barrier_jersey_a', size: [2, 0.8, 0.6], x: L.cx + i * 2.6, z: L.cz + L.hz + hw + 1.5 });
  }

  // Jump ramp on the north straight, rising eastward (cars run clockwise: north straight heads east).
  const rz = L.cz - L.hz, rx = L.cx + 4;
  const ramp = wedge(-2, 2, [[0, 0], [7, 0], [7, 1.1], [6.4, 1.1]]);
  ramp.rotateY(Math.PI / 2).translate(rx - 3.5, 0, rz); // profile ran along +Z; turn it to run along +X
  kit.hull(kit.paint(ramp, 'plywood'));
  kit.strip(rx + 3.2, rz - 2, rx + 3.2, rz + 2, 0.3, 1.12, 'hazard_yellow', 0.8);

  // Start box / parking spot under the car spawn: white outline + start line.
  const c = yardSpawns.car;
  const bw = 2.8, bl = 5.8;
  kit.strip(c.x - bw / 2, c.z - bl / 2, c.x - bw / 2, c.z + bl / 2, 0.12, 0.05, 'road_paint_white', 0.8);
  kit.strip(c.x + bw / 2, c.z - bl / 2, c.x + bw / 2, c.z + bl / 2, 0.12, 0.05, 'road_paint_white', 0.8);
  kit.strip(c.x - bw / 2, c.z + bl / 2, c.x + bw / 2, c.z + bl / 2, 0.12, 0.05, 'road_paint_white', 0.8);
  kit.strip(c.x - hw, c.z - bl / 2 - 0.3, c.x + hw, c.z - bl / 2 - 0.3, 0.4, 0.05, 'road_paint_white', 0.9);
  textFlat({ title: 'START', bg: '#4a4a4a', fg: '#e4e1d6' }, 3, 1.5, c.x, 0.05, c.z - bl / 2 - 1.8, 0);

  stationSign(kit, 'track', S.x - S.w / 2 - 1.5, S.z - S.d / 2 + 2);
}
