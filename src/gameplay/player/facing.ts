import { bodyFacing as BF } from '../../content/data/player';
import { animPost as AP } from '../../content/data/anim';
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
  /** Body turn rate (rad/s): accel-limited so turns ease in instead of starting at full speed (no snaps). */
  yawVel = 0;
  turningInPlace = false;
  /** +1 / -1: direction of the turn-in-place clip playing. */
  private turnDir = 0;

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
      this.yawVel = 0;
      return;
    }
    const sp = Math.hypot(p.vel.x, p.vel.z);
    if ((sp > 0.3 || this.aiming) && this.ctx.playerAnim?.turning) this.ctx.playerAnim.cancelFull();
    let target = this.yaw;
    let rate = BF.moveTurnDeg;
    if (this.aiming && !p.sprinting) {
      target = p.yaw;
      rate = BF.aimTurnDeg;
      this.turningInPlace = false;
    } else if (sp > 0.3 || p.wish.lengthSq() > 0) {
      // Velocity direction, or the keys' direction when they point well away from it (a 180° flick while jogging turns
      // the body at once instead of waiting ~9 frames for the velocity to pass through zero, B2)
      const w = p.wish;
      const along = sp > 0.3 ? (p.vel.x * w.x + p.vel.z * w.z) / sp : -1;
      target = w.lengthSq() > 0 && along < BF.wishTurnDot ? Math.atan2(-w.x, -w.z) : Math.atan2(-p.vel.x, -p.vel.z);
      this.turningInPlace = false;
    } else if (this.ctx.playerAnim?.has('turn_left_90')) {
      // Turn in place with the mocap clips (feet step); the clip's hip yaw feeds the body yaw frame by frame
      const anim = this.ctx.playerAnim;
      let diff = wrap(p.yaw - this.yaw);
      // The camera swung back the other way mid-turn: drop the clip (B2: it used to finish its 90° away from the view)
      if (anim.turning && diff * this.turnDir < -BF.inPlaceReverseDeg * DEG) anim.cancelFull();
      // Fast flicks: past inPlaceMaxLagDeg the body is dragged after the camera (accel-limited, so no one-frame jerk;
      // the clip keeps stepping underneath), and it never trails by more than inPlaceHardLagDeg
      const excess = Math.abs(diff) - BF.inPlaceMaxLagDeg * DEG;
      const want = excess > 0 ? Math.sign(diff) * Math.min(BF.inPlaceDragDeg * DEG, excess * BF.easing) : 0;
      const acc = BF.turnAccelDeg * DEG * dt;
      this.yawVel += Math.max(-acc, Math.min(acc, want - this.yawVel));
      if (excess <= 0 && this.yawVel * diff <= 0) this.yawVel = 0;
      let pull = this.yawVel * dt;
      const hard = Math.abs(diff - pull) - BF.inPlaceHardLagDeg * DEG;
      if (hard > 0) pull += Math.sign(diff) * hard;
      this.yaw = wrap(this.yaw + pull);
      diff -= pull;
      if (!anim.turning && Math.abs(diff) > AP.turnTriggerDeg * DEG) {
        anim.onTurnEnd = null;
        // Root motion arrives frame by frame from the clip (no end-of-clip snap, QA-084)
        anim.onTurnDelta = (rad) => {
          this.yaw = wrap(this.yaw + rad);
          this.prevYaw = wrap(this.prevYaw + rad);
        };
        this.turnDir = Math.sign(diff);
        // Faster for a bigger gap: 1.4x at 90°, up to 2.2x (B2: 0.97 s for 90° read as sluggish)
        const ts = Math.min(BF.inPlaceClipSpeedMax, BF.inPlaceClipSpeed * Math.abs(diff) / (90 * DEG));
        anim.oneshot(diff > 0 ? 'turn_left_90' : 'turn_right_90', 0.06, false, 0, Math.max(BF.inPlaceClipSpeed, ts));
      }
      this.turningInPlace = anim.turning;
      return;
    } else {
      const diff = Math.abs(wrap(p.yaw - this.yaw));
      if (!this.turningInPlace && diff > BF.inPlaceTriggerDeg * DEG) this.turningInPlace = true;
      if (this.turningInPlace) {
        target = p.yaw;
        rate = BF.inPlaceTurnDeg;
        if (diff < 5 * DEG) this.turningInPlace = false;
      }
    }
    // Wanted turn rate: exponential approach (easing), capped by the gait's max rate and by what can still brake
    // in time; the actual rate follows it with limited angular acceleration (ease-in, no frame-one jump).
    const d = wrap(target - this.yaw);
    const acc = (this.aiming && !p.sprinting ? BF.aimTurnAccelDeg : BF.turnAccelDeg) * DEG;
    const ad = Math.abs(d);
    const want = Math.sign(d) * Math.min(rate * DEG, ad * BF.easing, Math.sqrt(2 * acc * ad));
    this.yawVel += Math.max(-acc * dt, Math.min(acc * dt, want - this.yawVel));
    let step = this.yawVel * dt;
    if (step * d > 0 && Math.abs(step) >= ad) {
      step = d; // arrive exactly, never overshoot
      this.yawVel = want;
    }
    this.yaw = wrap(this.yaw + step);
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
