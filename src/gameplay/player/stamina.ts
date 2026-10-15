import { stamina as S } from '../../content/data/player';

/** Stamina pool (principles §2): sprint drain, regen after a delay, exhausted at 0 until back to 30. Pure. */
export class Stamina {
  value = S.max;
  exhausted = false;
  private sinceUse = 99;

  /** Try to spend `n`; returns false (and spends nothing) if not enough. */
  spend(n: number) {
    if (this.value < n && n > 0) return false;
    this.use(n);
    return true;
  }

  /** Continuous drain (sprinting): always applied. */
  drain(perSec: number, dt: number) {
    this.use(perSec * dt);
  }

  private use(n: number) {
    this.value = Math.max(0, this.value - n);
    this.sinceUse = 0;
    if (this.value <= 0) this.exhausted = true;
  }

  step(dt: number) {
    this.sinceUse += dt;
    if (this.sinceUse >= S.regenDelay) this.value = Math.min(S.max, this.value + S.regenPerSec * dt);
    if (this.exhausted && this.value >= S.exhaustedUntil) this.exhausted = false;
  }

  get canSprint() {
    return !this.exhausted && this.value > 0;
  }
}
