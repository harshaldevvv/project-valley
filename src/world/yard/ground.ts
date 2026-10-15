import { BufferAttribute, BufferGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry } from 'three';
import { yard } from '../../content/data/yard';
import { createRng } from '../../engine/rng';
import { swatchUV } from '../../engine/palette';
import { Group, groups } from '../../engine/physics';
import type { Kit } from './kit';

const EXTENT = 300; // land out to ±300 m so the horizon isn't a void
const CELL = 5;

// --- tiny value noise (deterministic) ---
const hash = (x: number, z: number) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (t: number) => t * t * (3 - 2 * t);
function noise(x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const u = smooth(x - xi), v = smooth(z - zi);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x: number, z: number) => (noise(x, z) * 0.6 + noise(x * 2.1, z * 2.1) * 0.3 + noise(x * 4.3, z * 4.3) * 0.1);
const smoothstep = (a: number, b: number, x: number) => smooth(Math.min(1, Math.max(0, (x - a) / (b - a))));

/** Ground height: flat inside the walls (M1 has no navmesh), low rolling hills beyond. */
export function groundHeight(x: number, z: number) {
  const d = Math.max(Math.abs(x), Math.abs(z));
  return smoothstep(yard.half + 8, yard.half + 70, d) * (2 + 16 * fbm(x * 0.011 + 3, z * 0.011 + 7));
}

/** Per-face ground swatch: big low-frequency patches (low-poly look). */
function groundSwatch(x: number, z: number) {
  const n = fbm(x * 0.02, z * 0.02);
  const inside = Math.max(Math.abs(x), Math.abs(z)) < yard.half;
  return n > (inside ? 0.66 : 0.6) ? 'grass_dry' : 'grass';
}

export function buildGround(kit: Kit) {
  const n = (EXTENT * 2) / CELL;
  const row = n + 1;
  const heights = new Float32Array(row * row);
  const vx = (i: number) => -EXTENT + i * CELL;
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) heights[j * row + i] = groundHeight(vx(i), vx(j));

  // Render: non-indexed, one swatch per triangle, gradient shade from noise.
  const pos = new Float32Array(n * n * 18);
  const uv = new Float32Array(n * n * 12);
  let p = 0, q = 0;
  const vert = (i: number, j: number, sw: string) => {
    const x = vx(i), z = vx(j), y = heights[j * row + i];
    pos[p++] = x; pos[p++] = y; pos[p++] = z;
    const [u, v] = swatchUV(sw, 0.25 + 0.6 * noise(x * 0.15, z * 0.15));
    uv[q++] = u; uv[q++] = v;
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const cx = vx(i) + CELL / 2, cz = vx(j) + CELL / 2;
      const s1 = groundSwatch(cx - 1, cz - 1);
      const s2 = groundSwatch(cx + 1, cz + 1);
      vert(i, j, s1); vert(i, j + 1, s1); vert(i + 1, j, s1);
      vert(i + 1, j, s2); vert(i, j + 1, s2); vert(i + 1, j + 1, s2);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  kit.raw(geo);

  // Physics: one heightfield (TERRAIN). Rapier: rows along Z, cols along X, column-major heights.
  const { R, world } = kit.game.phys;
  const hf = new Float32Array(row * row);
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) hf[i * row + j] = heights[j * row + i];
  world.createCollider(
    R.ColliderDesc.heightfield(n, n, hf, { x: EXTENT * 2, y: 1, z: EXTENT * 2 }).setCollisionGroups(groups(Group.TERRAIN, 0xffff)),
  );

  buildTrees(kit);
}

/** Merged low-poly treeline on the hills outside the walls (no shadows: cheap horizon). */
function buildTrees(kit: Kit) {
  const rng = createRng(77);
  const tree = (x: number, z: number) => {
    const y = groundHeight(x, z) - 0.3;
    const s = rng.range(0.75, 1.35);
    const a = rng.range(0, Math.PI);
    if (rng.next() < 0.8) {
      kit.paint(new CylinderGeometry(0.18 * s, 0.28 * s, 2.5 * s, 5).translate(x, y + 1.25 * s, z), 'bark_dark', 0.5);
      for (let k = 0; k < 3; k++) {
        const r = (2.6 - k * 0.6) * s, h = (4.2 - k * 0.7) * s;
        kit.paint(new ConeGeometry(r, h, 7).rotateY(a + k).translate(x, y + (2.2 + k * 2.1) * s + h / 2, z), 'leaf_pine');
      }
    } else {
      const birch = rng.next() < 0.5;
      kit.paint(new CylinderGeometry(0.14 * s, 0.22 * s, 4 * s, 5).translate(x, y + 2 * s, z), birch ? 'bark_birch' : 'bark_dark', 0.6);
      kit.paint(new IcosahedronGeometry(2.4 * s, 0).scale(1, 1.25, 1).rotateY(a).translate(x, y + 5.3 * s, z), 'leaf_summer');
    }
  };

  // Treeline on the hills.
  for (let placed = 0, tries = 0; placed < 520 && tries < 6000; tries++) {
    const x = rng.range(-EXTENT + 10, EXTENT - 10), z = rng.range(-EXTENT + 10, EXTENT - 10);
    const d = Math.max(Math.abs(x), Math.abs(z));
    if (d < yard.half + 14) continue;
    if (fbm(x * 0.012 + 11, z * 0.012) < 0.42 - (d - 120) * 0.0012) continue; // clustered forest stands
    placed++;
    tree(x, z);
  }

  // A few overgrown trees along the inside of the wall (with trunk colliders), clear of stations and the gate.
  const clear = Object.values(yard.stations).map((st) => [st.x - st.w / 2 - 6, st.x + st.w / 2 + 6, st.z - st.d / 2 - 6, st.z + st.d / 2 + 6]);
  for (let placed = 0, tries = 0; placed < 28 && tries < 2000; tries++) {
    const x = rng.range(-yard.half + 4, yard.half - 4), z = rng.range(-yard.half + 4, yard.half - 4);
    if (Math.max(Math.abs(x), Math.abs(z)) < yard.half - 10) continue;
    if (clear.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1)) continue;
    if (z > 80 && Math.abs(x) < 12) continue; // gate approach
    if (fbm(x * 0.03, z * 0.03 + 5) < 0.45) continue; // clumps, not a hedge
    placed++;
    tree(x, z);
    kit.cuboid(0.25, 1.5, 0.25, x, 1.2, z);
  }
}
