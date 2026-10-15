/**
 * Fixed-timestep loop (Fiedler, "Fix Your Timestep").
 * - `step(dt)` runs at exactly SIM_HZ; `render(alpha)` runs once per animation frame,
 *   alpha = how far we are between the last two sim states (for interpolation).
 * - Frame time is clamped (MAX_FRAME) and at most MAX_STEPS sim steps run per frame;
 *   beyond that time is dropped instead of spiralling.
 */
export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;
const MAX_FRAME = 0.25;
const MAX_STEPS = 4;

export interface LoopHooks {
  step(dt: number, tick: number): void;
  render(alpha: number, frameDt: number): void;
}

export class FixedLoop {
  tick = 0;
  private acc = 0;
  private last = -1;

  constructor(private hooks: LoopHooks) {}

  /** Call from requestAnimationFrame / renderer.setAnimationLoop with a ms timestamp. */
  frame(nowMs: number): void {
    if (this.last < 0) this.last = nowMs;
    const frameDt = Math.min((nowMs - this.last) / 1000, MAX_FRAME);
    this.last = nowMs;
    this.acc += frameDt;

    let steps = 0;
    while (this.acc >= SIM_DT && steps < MAX_STEPS) {
      this.hooks.step(SIM_DT, this.tick++);
      this.acc -= SIM_DT;
      steps++;
    }
    if (steps === MAX_STEPS && this.acc >= SIM_DT) this.acc = 0; // drop the backlog

    this.hooks.render(this.acc / SIM_DT, frameDt);
  }
}
