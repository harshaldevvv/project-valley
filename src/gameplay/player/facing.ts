import { bodyFacing as BF } from '../../content/data/player';
import type { Ctx } from '../ctx';

const DEG = Math.PI / 180;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Third-person body yaw, separate from the camera yaw (user playtest). Plain sim state, stepped at 60 Hz:
 * - aiming / firing / melee → orient to the camera (fast);
 * - moving (or sprinting) → orient to the movement direction (540°/s, eased);
 * - standing → stay put; once the camera is > 100° away, a turn-in-place step brings the body round.
 * First person and driving: the body simply follows the camera.
 */
export class BodyFacing {
  yaw = 0;
  prevYaw = 0;
  turningInPlace = false;

  constructor(private ctx: Ctx) {
    this.yaw = this.prevYaw = ctx.player.yaw;
  }

  /** True while the body should face where the camera looks. */
  get aiming() {
    const w = this.ctx.weapons;
    return w.raiseT > 0.05 || w.adsT > 0 || this.ctx.melee.phase !== 'idle';
  }

  step(dt: number) {
    const p = this.ctx.player;
    this.prevYaw = this.yaw;
    if (this.ctx.rig.firstPerson || p.inVehicle || p.dead || p.locked && this.ctx.melee.phase !== 'finisher') {
      if (!p.dead) this.yaw = p.yaw;
      this.prevYaw = this.yaw;
      return;
    }
    const sp = Math.hypot(p.vel.x, p.vel.z);
    let target = this.yaw;
    let rate = BF.moveTurnDeg;
    if (this.aiming && !p.sprinting) {
      target = p.yaw;
      rate = BF.aimTurnDeg;
      this.turningInPlace = false;
    } else if (sp > 0.3) {
      target = Math.atan2(-p.vel.x, -p.vel.z);
      this.turningInPlace = false;
    } else {
      const diff = Math.abs(wrap(p.yaw - this.yaw));
      if (!this.turningInPlace && diff > BF.inPlaceTriggerDeg * DEG) this.turningInPlace = true;
      if (this.turningInPlace) {
        target = p.yaw;
        rate = BF.inPlaceTurnDeg;
        if (diff < 5 * DEG) this.turningInPlace = false;
      }
    }
    const d = wrap(target - this.yaw);
    const eased = d * Math.min(1, BF.easing * dt);
    const max = rate * DEG * dt;
    this.yaw = wrap(this.yaw + Math.max(-max, Math.min(max, eased)));
  }

  /** Interpolated yaw for rendering. */
  render(alpha: number) {
    return this.prevYaw + wrap(this.yaw - this.prevYaw) * alpha;
  }

  /** Head look-at offset toward the camera, clamped (rad). */
  headYaw() {
    const lim = BF.headLookDeg * DEG;
    return Math.max(-lim, Math.min(lim, wrap(this.ctx.player.yaw - this.yaw)));
  }
}

declare module '../ctx' {
  interface Ctx {
    facing: BodyFacing;
  }
}
