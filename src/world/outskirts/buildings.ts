import type { BufferGeometry } from 'three';
import { buildingWorld } from '../../content/data/pois';
import type { BuildingDef, Opening, Placed } from '../../content/data/outskirts';
import type { SurfaceTag } from '../../content/data/outskirts';
import { BUILDINGS } from '../../content/data/outskirts';
import type { DoorDef } from '../yard/doors';
import { boxG, GAIN, panelG, triG, xform } from './geo';

/**
 * Enterable buildings, generated from a BuildingDef (content/data/outskirts.ts): walls with door and window gaps (each gap keeps
 * a sill and a lintel), a floor, a roof with a hole torn in it so daylight reaches the rooms, and furniture. Everything is
 * vertex-coloured flat geometry in the local frame, then moved into place; walls get rotated box colliders. Furniture and the
 * Polyfork container models come back as `Placed` entries for the shared model pipeline.
 */
export interface BuildCtx {
  cuboid(hx: number, hy: number, hz: number, x: number, y: number, z: number, yaw: number, surface: SurfaceTag): void;
  region(test: (x: number, z: number) => boolean, surface: SurfaceTag): void;
}
export interface BuildResult { geos: BufferGeometry[]; items: Placed[] }

const T = 0.2; // wall thickness

export function buildBuilding(b: BuildingDef, ctx: BuildCtx): BuildResult {
  const geos: BufferGeometry[] = [];
  const items: Placed[] = [];
  const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
  const world = (u: number, v: number) => buildingWorld(b, u, v);
  /** box collider from a local box (centre u,v; half sizes along local u and v) */
  const col = (cu: number, cv: number, y0: number, y1: number, hu: number, hv: number, surf: SurfaceTag = 'wood') => {
    const w = world(cu, cv);
    ctx.cuboid(hu, (y1 - y0) / 2, hv, w.x, (y0 + y1) / 2, w.z, b.yaw, surf);
  };
  const hw = b.w / 2, hd = b.d / 2;

  // ---- floor
  geos.push(boxG(b.w - T, 0.08, b.d - T, 0, 0, 0, b.floor, { bottom: 0.9, gain: GAIN.floor }));
  ctx.region((x, z) => {
    const dx = x - b.x, dz = z - b.z;
    const u = dx * cs - dz * sn, v = dx * sn + dz * cs; // inverse of buildingWorld
    return Math.abs(u) <= hw && Math.abs(v) <= hd;
  }, b.floorSurface);

  // ---- walls
  const openWall = (axis: 'u' | 'v', fixed: number, from: number, to: number, openings: Opening[], H: number) => {
    const piece = (a: number, c: number, y0: number, y1: number) => {
      if (c - a < 0.02 || y1 - y0 < 0.02) return;
      const mid = (a + c) / 2, len = c - a;
      if (axis === 'u') { geos.push(boxG(len, y1 - y0, T, mid, y0, fixed, b.wall, { gain: GAIN.wall })); col(mid, fixed, y0, y1, len / 2, T / 2); }
      else { geos.push(boxG(T, y1 - y0, len, fixed, y0, mid, b.wall, { gain: GAIN.wall })); col(fixed, mid, y0, y1, T / 2, len / 2); }
    };
    let cur = from;
    for (const o of [...openings].sort((p, q) => p.u - q.u)) {
      const a = Math.max(from, o.u - o.w / 2), c = Math.min(to, o.u + o.w / 2);
      piece(cur, a, 0, H);
      piece(a, c, 0, o.sill);
      piece(a, c, o.top, H);
      cur = c;
    }
    piece(cur, to, 0, H);
  };
  openWall('u', hd - T / 2, -hw, hw, b.front, b.h);
  openWall('u', -hd + T / 2, -hw, hw, b.back, b.h);
  openWall('v', -hw + T / 2, -hd + T, hd - T, b.left, b.h);
  openWall('v', hw - T / 2, -hd + T, hd - T, b.right, b.h);
  if (b.partition) openWall('u', b.partition.v, -hw + T, hw - T, b.partition.open, b.h);
  for (const dv of b.dividers ?? []) openWall('v', dv.u, -hd + T, hd - T, dv.open, b.h);
  // corner posts in the trim colour
  for (const [u, v] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) geos.push(boxG(0.3, b.h + 0.05, 0.3, u, 0, v, b.trim, { bottom: 0.8 }));

  // ---- roof
  const roofH = 0.14;
  const brk = b.roofBreak;
  if (b.kind === 'house' || b.kind === 'shed') {
    const rise = hd * 0.5, over = 0.45, endOver = 0.4;
    const run = hd + over, ang = Math.atan2(rise + 0.08, run), L = Math.hypot(run, rise + 0.08);
    const cy = b.h + (rise - 0.08) / 2 + 0.04, cvv = run / 2;
    const spans: [number, number, number][] = []; // [u0, u1, side] side +1 front, -1 back
    for (const side of [1, -1]) {
      if (brk && ((side === 1 && brk.side === 'front') || (side === -1 && brk.side === 'back'))) {
        spans.push([-hw - endOver, brk.u0, side], [brk.u1, hw + endOver, side]);
      } else spans.push([-hw - endOver, hw + endOver, side]);
    }
    for (const [u0, u1, side] of spans) {
      if (u1 - u0 < 0.05) continue;
      geos.push(panelG(u1 - u0, roofH, L, (u0 + u1) / 2, cy, side * cvv, side * ang, b.roof));
      geos.push(panelG(u1 - u0 - 0.1, 0.05, L - 0.2, (u0 + u1) / 2, cy - 0.12, side * cvv, side * ang, '#d2d6de', 1, GAIN.ceiling)); // light ceiling underside
    }
    geos.push(boxG(b.w + 2 * endOver, 0.12, 0.34, 0, b.h + rise + 0.02, 0, b.trim, { bottom: 0.9 }));
    for (const u of [-hw + T / 2, hw - T / 2]) geos.push(triG([u, b.h, -hd], [u, b.h, hd], [u, b.h + rise, 0], b.wall));
    if (b.chimney) {
      geos.push(boxG(0.7, b.h + rise + 0.3, 0.7, b.chimney[0], 0, b.chimney[1], '#8a4b3a', { bottom: 0.7 }));
      col(b.chimney[0], b.chimney[1], 0, b.h + rise, 0.35, 0.35, 'concrete');
    }
    if (b.kind === 'shed') {
      // open-sided hay shed: posts under the eaves (the walls above are the back wall and one end)
      for (const u of [-hw + 0.3, 0, hw - 0.3]) for (const v of [hd - 0.3]) { geos.push(boxG(0.28, b.h, 0.28, u, 0, v, b.trim, { bottom: 0.7 })); col(u, v, 0, b.h, 0.14, 0.14); }
    }
  } else {
    // flat roof (shop) or lean-to (workshop: high at the front, 0.9 m lower at the back); a hole over part of the back half
    const lean = b.kind === 'workshop';
    const hole = brk ?? { side: 'back' as const, u0: -hw * 0.55, u1: hw * 0.05 };
    const W = hw + 0.35, D = hd + 0.35;
    const yAt = (v: number) => (lean ? b.h - 0.6 + 0.9 * ((v + D) / (2 * D)) : b.h); // lean-to: higher at the front (+v)
    const slab = (u0: number, u1: number, v0: number, v1: number) => {
      if (u1 - u0 < 0.05 || v1 - v0 < 0.05) return;
      const midV = (v0 + v1) / 2;
      const rot = lean ? -Math.atan2(0.9, 2 * D) : 0; // rotateX(+) lowers the +z end, so the front-high slope is negative
      geos.push(panelG(u1 - u0, 0.2, v1 - v0, (u0 + u1) / 2, yAt(midV) + 0.1, midV, rot, b.roof, 0.88));
      geos.push(panelG(u1 - u0 - 0.1, 0.05, v1 - v0 - 0.1, (u0 + u1) / 2, yAt(midV) - 0.03, midV, rot, '#d2d6de', 1, GAIN.ceiling)); // light ceiling underside
    };
    slab(-W, hole.u0, -D, D);
    slab(hole.u1, W, -D, D);
    if (hole.side === 'back') slab(hole.u0, hole.u1, 0, D); else slab(hole.u0, hole.u1, -D, 0);
    // parapet in the trim colour along the front edge
    geos.push(boxG(b.w + 0.6, 0.45, 0.2, 0, b.h + (lean ? 0.55 : 0.2), D, b.trim, { bottom: 0.85 }));
  }

  // ---- porch (houses): slab, two posts and a small roof over the front door
  if (b.kind === 'house' && b.porch) {
    const d0 = b.front.find((o) => o.sill === 0);
    if (d0) {
      geos.push(boxG(3.4, 0.14, 1.7, d0.u, 0, hd + 0.85, '#9d9a92', { bottom: 0.85 }));
      for (const du of [-1.55, 1.55]) { geos.push(boxG(0.16, 2.45, 0.16, d0.u + du, 0, hd + 1.55, b.trim, { bottom: 0.8 })); col(d0.u + du, hd + 1.55, 0, 2.45, 0.08, 0.08); }
      geos.push(boxG(3.7, 0.12, 1.9, d0.u, 2.45, hd + 0.95, b.roof, { bottom: 0.9 }));
    }
  }

  // ---- furniture (Polyfork models via the shared pipeline) and containers
  for (const f of b.furniture) {
    const w = world(f.u, f.v);
    items.push({ chunk: b.chunk, k: f.k, x: w.x, z: w.z, yaw: b.yaw + (f.yaw ?? 0), ...(f.s ? { s: f.s } : {}), ...(f.y ? { y: f.y } : {}), ...(f.solid === false ? { solid: false } : {}), surf: 'wood' });
  }
  for (const c of b.containers) {
    const w = world(c.u, c.v);
    if (c.model === 'counter') {
      // kitchen counter: carcass, worktop and two door panels on the front
      geos.push(boxG(1.5, 0.86, 0.6, c.u, 0, c.v, '#6f5236', { yaw: 0, bottom: 0.8 }));
      geos.push(boxG(1.58, 0.05, 0.66, c.u, 0.86, c.v, '#c9c6bb', { bottom: 1 }));
      for (const du of [-0.37, 0.37]) geos.push(boxG(0.66, 0.6, 0.03, c.u + du, 0.12, c.v + 0.3, '#4a3523', { bottom: 0.9 }));
      col(c.u, c.v, 0, 0.91, 0.79, 0.33);
    } else if (c.model === 'register') {
      geos.push(boxG(0.5, 0.22, 0.4, c.u, c.y ?? 1.0, c.v, '#38383a', { bottom: 0.9 }));
      geos.push(boxG(0.34, 0.16, 0.04, c.u, (c.y ?? 1.0) + 0.2, c.v - 0.1, '#5d7a6d', { bottom: 1, rotX: -0.3 }));
    } else {
      items.push({ chunk: b.chunk, k: c.model, x: w.x, z: w.z, yaw: b.yaw + (c.yaw ?? 0), ...(c.y ? { y: c.y } : {}), surf: 'wood' });
    }
  }
  const counter = b.counter === undefined ? (b.kind === 'shop' ? { u: 2.9, v: -0.9, w: 3 } : null) : b.counter;
  if (counter) {
    // shop counter (the register container sits on it)
    const { u: cu, v: cv, w: cw } = counter;
    geos.push(boxG(cw, 1.0, 0.8, cu, 0, cv, '#7b5b3a', { bottom: 0.8 }));
    geos.push(boxG(cw + 0.1, 0.06, 0.9, cu, 1.0, cv, '#b9b4a6', { bottom: 1 }));
    col(cu, cv, 0, 1.06, cw / 2 + 0.05, 0.45);
  }

  const m = xform(b.x, b.z, b.yaw);
  for (const g of geos) g.applyMatrix4(m);
  return { geos, items };
}

/** One hinged door per house, shop and workshop: the first full-height opening in the front wall, hinged on its left jamb, swinging out. */
export function buildingDoors(): DoorDef[] {
  const out: DoorDef[] = [];
  for (const b of BUILDINGS) {
    if (b.kind === 'shed') continue;
    for (const o of b.front.filter((f) => f.sill === 0 && f.w <= 1.2)) {
    const hinge = buildingWorld(b, o.u - o.w / 2 + 0.01, b.d / 2 - T / 2);
    out.push({ hx: hinge.x, hz: hinge.z, dx: Math.cos(b.yaw), dz: -Math.sin(b.yaw), ox: Math.sin(b.yaw), oz: Math.cos(b.yaw), w: o.w - 0.04 });
    }
  }
  return out;
}
