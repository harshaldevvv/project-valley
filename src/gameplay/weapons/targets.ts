import { Box3, Object3D, Quaternion, Vector3 } from 'three';
import { Group, groups } from '../../engine/physics';
import { yard } from '../../content/data/yard';
import type { Ctx, Hittable, Zone } from '../ctx';

/**
 * Range targets from game.places (environment places them): mechanics makes them hittable.
 * Plates ping and swing back, dummies wobble; both reset after 3 s. If no targets were placed (environment
 * still working), simple stand-ins appear at 5/25/80 m so the range is testable.
 */
const RESET_S = 3;
interface Target {
  id: string;
  object: Object3D;
  kind: 'plate' | 'dummy';
  distance: number;
  base: Quaternion;
  swing: number; // current angle
  vel: number;
  down: number; // s until reset
  hits: number;
}

export class Targets {
  list: Target[] = [];

  constructor(private ctx: Ctx) {}

  async init() {
    let places = this.ctx.game.places.targets;
    if (!places.length) places = await this.standIns();
    const { R, world } = this.ctx.game.phys;
    for (const t of places) {
      t.object.updateMatrixWorld(true);
      const box = new Box3().setFromObject(t.object);
      if (box.isEmpty()) continue;
      const c = box.getCenter(new Vector3());
      // Inflated 3 cm so it wins over the prop's own static collider
      const h = box.getSize(new Vector3()).multiplyScalar(0.5).addScalar(0.03);
      const col = world.createCollider(
        R.ColliderDesc.cuboid(Math.max(h.x, 0.02), Math.max(h.y, 0.02), Math.max(h.z, 0.02))
          .setTranslation(c.x, c.y, c.z)
          .setCollisionGroups(groups(Group.STATIC, 0xffff)),
      );
      const tg: Target = { id: t.id, object: t.object, kind: t.kind, distance: t.distance, base: t.object.quaternion.clone(), swing: 0, vel: 0, down: 0, hits: 0 };
      this.list.push(tg);
      const hittable: Hittable = {
        kind: 'target',
        surface: t.kind === 'plate' ? 'metal' : 'wood',
        zone: (_c, p): Zone => (t.kind === 'dummy' && p.y > box.max.y - 0.3 ? 'head' : 'body'),
        hit: (info) => {
          tg.hits++;
          tg.vel += (t.kind === 'plate' ? 9 : 4) * (info.zone === 'head' ? 1.5 : 1);
          tg.down = RESET_S;
          this.ctx.sfx(t.kind === 'plate' ? 'target_ping' : 'impact_wood', info.point, { pitchJitter: 0.05 });
          const mul = info.zone === 'head' ? info.headMul : 1;
          return { damage: info.damage * mul, kill: false, zone: info.zone };
        },
      };
      this.ctx.hits.set(col.handle, hittable);
    }
  }

  private async standIns() {
    const { BoxGeometry, Mesh } = await import('three');
    const { paintGeometry, paletteMaterial } = await import('../../engine/palette');
    const mat = await paletteMaterial();
    const r = yard.stations.range;
    return r.targetDistances.map((d, i) => {
      const plate = new Mesh(paintGeometry(new BoxGeometry(0.5, 0.5, 0.03).translate(0, -0.25, 0), 'metal_bare'), mat);
      plate.position.set(r.x + (i - 1) * 4, 1.6, r.z - d);
      plate.castShadow = true;
      this.ctx.game.scene.add(plate);
      return { id: `standin_${d}`, object: plate as Object3D, distance: d, kind: 'plate' as const };
    });
  }

  step(dt: number) {
    for (const t of this.list) {
      if (t.down > 0 && (t.down -= dt) <= 0) t.vel -= t.swing * 6; // reset nudge
      // Hinged plate: kicked downrange, swings on a spring and settles (environment hinge at its top edge).
      // Without a hinge (stand-ins) it tips back and resets after 3 s.
      const hinged = !!t.object.userData.hinge;
      const k = !hinged && t.down > 0 && t.kind === 'plate' ? 8 : hinged ? 30 : 60;
      const target = !hinged && t.down > 0 && t.kind === 'plate' ? 1.25 : 0;
      t.vel += (-(t.swing - target) * k - t.vel * (t.kind === 'plate' ? (hinged ? 2.5 : 4) : 8)) * dt;
      t.swing += t.vel * dt;
      if (hinged) t.swing = Math.min(t.swing, 1.1); // only the PLATE node swings on the gallows bar
    }
  }

  render() {
    for (const t of this.list) {
      const hinge = t.object.userData.hinge as Object3D | undefined;
      if (hinge) {
        hinge.rotation.x = -t.swing; // negative = bottom kicks away from the shooter
        continue;
      }
      t.object.quaternion.copy(t.base);
      t.object.rotateX(t.swing * (t.kind === 'plate' ? 1 : 0.25));
    }
  }
}

declare module '../ctx' {
  interface Ctx {
    targets: Targets;
  }
}
