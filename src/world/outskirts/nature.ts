import { BufferGeometry, CircleGeometry, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { positionWorld, sin, time, vec3, mix } from 'three/tsl';
import type { Game } from '../../core/game';
import { OUT } from '../../content/data/outskirts';
import { CLUSTERS, NATURE_CELL as CELL, NATURE_PROPS, POND, type NatureProp } from '../../content/data/nature';
import { createRng } from '../../engine/rng';
import { pfWorldMaterial } from '../../engine/palette';
import type { Kit } from '../yard/kit';
import { fbm, groundHeight, nearTreeSpots } from '../yard/ground';
import { footprints, inClearRect, roadClearance } from './footprints';
import { loadPfm, type Pfm } from './models';

/** Distance to the plateau edge the forest belt hugs (same rule as scatter.ts). */
export const edgeDist = (x: number, z: number) => Math.min(x - OUT.x0, OUT.x1 - x, OUT.z1 - z, Math.abs(x) > 100 ? z - OUT.z0 : 999);
export const isBelt = (x: number, z: number) => edgeDist(x, z) < 32;
export const isClump = (x: number, z: number) => fbm(x * 0.028 + 70, z * 0.028 + 13) > 0.62;

/** The pond's own footprint, so trees, grass and props keep off the water (called before scatter and clutter). */
export function reservePond() {
  footprints.push({ x: POND.x, z: POND.z, r: POND.r - 1 });
}

/**
 * Rock clusters, fallen and hollow logs, stumps and ferns in the forest belt and clumps, plus the pond with reeds,
 * lily pads and shore rocks. All merged into one mesh per NATURE_CELL square (at most 4 draws on the plateau);
 * solid props near the play area get a box collider. Runs after scatter.ts so it can keep clear of the trees.
 */
export async function buildNature(kit: Kit, game: Game) {
  const rng = createRng(4242);
  const mat = await pfWorldMaterial();
  // tree trunks on the plateau, bucketed in 6 m cells, so props don't sit inside them
  const tcell = new Map<string, { x: number; z: number }[]>();
  const tk = (x: number, z: number) => `${Math.floor(x / 6)},${Math.floor(z / 6)}`;
  for (const t of nearTreeSpots) if (t.z > OUT.z0 - 4) (tcell.get(tk(t.x, t.z)) ?? tcell.set(tk(t.x, t.z), []).get(tk(t.x, t.z))!).push(t);
  const placed: { x: number; z: number; r: number }[] = [];
  const nearTree = (x: number, z: number, r: number) => {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (const t of tcell.get(`${Math.floor(x / 6) + i},${Math.floor(z / 6) + j}`) ?? []) if (Math.hypot(x - t.x, z - t.z) < r + 0.9) return true;
    }
    return false;
  };
  const free = (x: number, z: number, r: number) =>
    edgeDist(x, z) > 3 && !inClearRect(x, z, 1) && roadClearance(x, z) > 3 + r &&
    !footprints.some((f) => Math.hypot(x - f.x, z - f.z) < f.r + r + 0.5) &&
    !nearTree(x, z, r) && !placed.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + r);
  const inZone = (x: number, z: number, zone: NatureProp['zone']) =>
    zone === 'belt' ? isBelt(x, z) : zone === 'clump' ? isClump(x, z) : isBelt(x, z) || isClump(x, z);

  // cluster centres: rocks and logs gather in loose groups rather than an even sprinkle
  const centres: { x: number; z: number }[] = [];
  for (let tries = 0; centres.length < CLUSTERS.count && tries < 4000; tries++) {
    const x = rng.range(OUT.x0 + 6, OUT.x1 - 6), z = rng.range(OUT.z0 + 6, OUT.z1 - 6);
    if (!(isBelt(x, z) || isClump(x, z)) || !free(x, z, 2)) continue;
    if (centres.some((c) => Math.hypot(c.x - x, c.z - z) < 18)) continue;
    centres.push({ x, z });
  }

  const q = new Quaternion(), up = new Vector3(0, 1, 0);
  const solids = { colliders: 0 };
  // everything merges into one mesh per CELL x CELL m square (one draw each, same vertex-coloured material), named
  // outskirts_* so the distance cull (cull.ts) drops far cells; whole-plateau instanced meshes sat in every view's frustum
  const cells = new Map<string, BufferGeometry[]>();
  const add = (pf: Pfm, m: Matrix4, x: number, z: number) => {
    const k = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    (cells.get(k) ?? cells.set(k, []).get(k)!).push(pf.geo.clone().applyMatrix4(m));
  };
  const counts: Record<string, number> = {};
  for (const prop of NATURE_PROPS) {
    const pf = await loadPfm(prop.key);
    if (!pf) continue;
    let n = 0;
    const big = prop.solid && prop.minSolid === undefined; // logs, boulders: clustered, always solid
    for (let tries = 0; n < prop.count && tries < prop.count * 60; tries++) {
      let x: number, z: number;
      if (big || (prop.solid && rng.next() < 0.6)) {
        const c = centres[Math.floor(rng.next() * centres.length)];
        if (!c) break;
        const a = rng.range(0, Math.PI * 2), d = rng.range(0, CLUSTERS.spread);
        x = c.x + Math.cos(a) * d; z = c.z + Math.sin(a) * d;
      } else {
        x = rng.range(OUT.x0 + 4, OUT.x1 - 4); z = rng.range(OUT.z0 + 4, OUT.z1 - 4);
        if (!inZone(x, z, prop.zone)) continue;
      }
      const s = rng.range(prop.s[0], prop.s[1]);
      const span = Math.max(pf.size.x, pf.size.z) * s;
      if (!free(x, z, prop.solid ? span / 2 : 0.2)) continue;
      const yaw = rng.range(0, Math.PI * 2);
      const y = groundHeight(x, z) - (prop.sink ?? 0) * s;
      q.setFromAxisAngle(up, yaw);
      add(pf, new Matrix4().compose(new Vector3(x, y, z), q, new Vector3(s, s * rng.range(0.9, 1.1), s)), x, z);
      n++;
      if (prop.solid) placed.push({ x, z, r: span / 2 });
      else if (span > 0.8) placed.push({ x, z, r: 0.3 });
      if (prop.solid && span >= (prop.minSolid ?? 0)) {
        const hy = (pf.size.y * s) / 2;
        kit.cuboid((pf.size.x * s) / 2 * 0.85, hy, (pf.size.z * s) / 2 * 0.85, x, y + hy, z, yaw, prop.surface ?? 'concrete');
        solids.colliders++;
      }
    }
    counts[prop.key] = n;
  }

  await buildPond(game, rng, add);
  for (const [k, list] of cells) {
    const geo = mergeGeometries(list, false);
    if (!geo) continue;
    const mesh = new Mesh(geo, mat);
    mesh.name = `outskirts_nature_${k}`;
    mesh.receiveShadow = true; // no shadow pass: small props, and it would cost a draw per cascade per cell
    game.scene.add(mesh);
  }
  return { counts, colliders: solids.colliders, clusters: centres.length };
}

/** Water disc in the terrain dip (yard/ground.ts), reeds round the shallows, lily pads, a few shore rocks. No colliders: walk round or wade. */
async function buildPond(game: Game, rng: ReturnType<typeof createRng>, add: (pf: Pfm, m: Matrix4, x: number, z: number) => void) {
  const water = new MeshStandardNodeMaterial({ roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.86 });
  const ripple = sin(positionWorld.x.mul(0.9).add(time.mul(0.8))).mul(sin(positionWorld.z.mul(0.7).sub(time.mul(0.6)))).mul(0.5).add(0.5);
  water.colorNode = mix(vec3(0.11, 0.2, 0.19), vec3(0.17, 0.28, 0.26), ripple);
  // position baked into the geometry: cull.ts measures the geometry's own bounding sphere
  const disc = new Mesh(new CircleGeometry(POND.r, 28).rotateX(-Math.PI / 2).translate(POND.x, POND.water, POND.z), water);
  disc.name = 'pond_water'; // culled past 140 m (cull.ts)
  disc.receiveShadow = true;
  game.scene.add(disc);

  const q = new Quaternion(), up = new Vector3(0, 1, 0);
  const ring = async (key: string, n: number, r0: number, r1: number, s0: number, s1: number, yOf: (x: number, z: number) => number) => {
    const pf = await loadPfm(key);
    if (!pf) return;
    for (let i = 0; i < n; i++) {
      // reeds bunch on the west and south banks; leave the north-east open to walk down to the water
      let a = rng.range(0, Math.PI * 2);
      if (key === 'cattail-reed' && a > 0.2 && a < 1.5) a += 1.6;
      const d = rng.range(r0, r1);
      const x = POND.x + Math.cos(a) * d, z = POND.z + Math.sin(a) * d;
      const s = rng.range(s0, s1);
      q.setFromAxisAngle(up, rng.range(0, Math.PI * 2));
      add(pf, new Matrix4().compose(new Vector3(x, yOf(x, z), z), q, new Vector3(s, s * rng.range(0.85, 1.3), s)), x, z);
    }
  };
  const ground = (x: number, z: number) => Math.max(groundHeight(x, z), POND.water - 0.25) - 0.05;
  await ring('cattail-reed', POND.reeds, POND.r * 0.62, POND.r * 0.92, 0.9, 1.6, ground);
  await ring('lily-pad-cluster', POND.lilies, 1.5, POND.r * 0.5, 0.7, 1.1, () => POND.water - 0.03);
  await ring('field-rock', POND.rocks, POND.r * 0.82, POND.r * 1.0, 0.4, 0.9, (x, z) => groundHeight(x, z) - 0.08);
}
