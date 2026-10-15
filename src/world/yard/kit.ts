import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Mesh,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Game } from '../../core/game';
import { loadAsset } from '../../engine/assets';
import { placeStatic } from '../../engine/instancing';
import { paletteMaterial, swatchUV } from '../../engine/palette';
import { Group, groups } from '../../engine/physics';

/** One asset placement. Placements are plain data so the lead can swap the instancing backend in one place. */
export interface Placement {
  id: string;
  /** Placeholder size [w,h,d] m, used until the GLB exists. */
  size: [number, number, number];
  x: number;
  z: number;
  y?: number;
  /** Radians about +Y. 0 = the asset's front (-Z) faces north. */
  yaw?: number;
}

/** Yaw that turns an asset's front (-Z) to look from (x,z) toward (tx,tz). */
export const faceToward = (x: number, z: number, tx: number, tz: number) => Math.atan2(-(tx - x), -(tz - z));

const STATIC_GROUPS = groups(Group.STATIC, 0xffff);
const UP = new Vector3(0, 1, 0);

/**
 * Collects everything the Yard places:
 *  - procedural palette geometry -> merged into ONE mesh (one draw call),
 *  - repeated assets (`statics`) -> engine placeStatic (instanced LODs + colliders) per asset id,
 *  - unique interactive objects (`one`) -> a LOD clone each (containers/targets need their own Object3D).
 */
export class Kit {
  private geos: BufferGeometry[] = [];
  readonly statics: Placement[] = [];
  constructor(readonly game: Game) {}

  /** Adds painted geometry. `h` (0 shade .. 1 lit) pins the swatch gradient; omit to follow height. */
  paint(geo: BufferGeometry, swatch: string, h?: number) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const pos = g.getAttribute('position');
    g.computeBoundingBox();
    const { min, max } = g.boundingBox!;
    const span = Math.max(max.y - min.y, 1e-6);
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const [u, v] = swatchUV(swatch, h ?? (pos.getY(i) - min.y) / span);
      uv[i * 2] = u;
      uv[i * 2 + 1] = v;
    }
    g.setAttribute('uv', new BufferAttribute(uv, 2));
    this.geos.push(g);
    return g;
  }

  /** Adds geometry that already has position/normal/uv (non-indexed). */
  raw(geo: BufferGeometry) {
    this.geos.push(geo);
  }

  /** Box sitting on y (its base), centred at x,z, rotated by yaw. */
  box(w: number, h: number, d: number, swatch: string, x: number, y: number, z: number, yaw = 0, collide = false, shade?: number) {
    this.paint(new BoxGeometry(w, h, d).translate(0, h / 2, 0).rotateY(yaw).translate(x, y, z), swatch, shade);
    if (collide) this.cuboid(w / 2, h / 2, d / 2, x, y + h / 2, z, yaw);
  }

  /** Thin flat pad (concrete/dirt) centred at x,z, top at y. Visual only: the ground collider stays at y=0. */
  pad(w: number, d: number, x: number, z: number, swatch = 'concrete', y = 0.04, shade = 0.6) {
    this.box(w, 0.06, d, swatch, x, y - 0.06, z, 0, false, shade);
  }

  /** Flat painted strip from (ax,az) to (bx,bz), top at y (overlays for paths/lines). */
  strip(ax: number, az: number, bx: number, bz: number, width: number, y: number, swatch: string, shade = 0.5) {
    const len = Math.hypot(bx - ax, bz - az);
    this.box(width, 0.02, len, swatch, (ax + bx) / 2, y - 0.02, (az + bz) / 2, Math.atan2(bx - ax, bz - az), false, shade);
  }

  cuboid(hx: number, hy: number, hz: number, x: number, y: number, z: number, yaw = 0) {
    const { R, world } = this.game.phys;
    const q = new Quaternion().setFromAxisAngle(UP, yaw);
    world.createCollider(
      R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRotation(q).setCollisionGroups(STATIC_GROUPS),
    );
  }

  /** Convex-hull collider from already-placed geometry (ramps, berms). */
  hull(geo: BufferGeometry) {
    const { R, world } = this.game.phys;
    const desc = R.ColliderDesc.convexHull(geo.getAttribute('position').array as Float32Array);
    if (desc) world.createCollider(desc.setCollisionGroups(STATIC_GROUPS));
  }

  /** Queue a repeated static asset (instanced in finish()). */
  place(p: Placement) {
    this.statics.push(p);
  }

  /** A unique asset instance with its own Object3D and colliders. */
  async one(p: Placement): Promise<Object3D> {
    const proto = await loadAsset(p.id, p.size);
    const o = proto.lod.clone();
    o.name = p.id;
    o.position.set(p.x, p.y ?? 0, p.z);
    o.rotation.y = p.yaw ?? 0;
    o.updateMatrixWorld(true);
    this.game.scene.add(o);
    this.colliders(proto.colliders, p);
    return o;
  }

  private colliders(boxes: { min: Vector3; max: Vector3 }[], p: Placement) {
    const c = new Vector3();
    for (const b of boxes) {
      c.addVectors(b.min, b.max).multiplyScalar(0.5).applyAxisAngle(UP, p.yaw ?? 0);
      this.cuboid(
        (b.max.x - b.min.x) / 2, (b.max.y - b.min.y) / 2, (b.max.z - b.min.z) / 2,
        p.x + c.x, (p.y ?? 0) + c.y, p.z + c.z, p.yaw ?? 0,
      );
    }
  }

  /** Builds the merged palette mesh and one InstancedMesh per repeated asset. */
  async finish() {
    const mat = await paletteMaterial();
    const merged = new Mesh(mergeGeometries(this.geos), mat);
    merged.name = 'yard_static';
    merged.castShadow = merged.receiveShadow = true;
    this.game.scene.add(merged);

    const byId = new Map<string, Placement[]>();
    for (const p of this.statics) (byId.get(p.id) ?? byId.set(p.id, []).get(p.id)!).push(p);
    await Promise.all([...byId].map(([id, list]) => placeStatic(this.game, id, list, { fallbackSize: list[0].size })));
  }
}
