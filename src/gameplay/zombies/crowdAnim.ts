import type { Object3D } from 'three';
import type { Crowd } from '../../engine/crowd';

/**
 * Same surface as AnimationController (base / oneshot / update) over one engine crowd instance (GPU-baked clips,
 * QA-009). One-shots return to the base clip when finished unless held (death).
 */
export class CrowdAnim {
  private baseClip = '';
  private baseScale = 1;
  private shot = '';
  private hold = false;
  constructor(readonly crowd: Crowd, readonly i: number) {}

  base(name: string, fade = 0.2, timeScale = 1) {
    this.baseScale = timeScale;
    if (this.hold) return;
    if (this.shot) {
      this.baseClip = name;
      return;
    }
    // Same clip without restart only updates the rate
    this.crowd.play(this.i, name, { fade, loop: true, timeScale });
    this.baseClip = name;
  }

  oneshot(name: string, fade = 0.1, hold = false) {
    this.crowd.play(this.i, name, { fade, loop: false, restart: true });
    this.shot = name;
    this.hold = hold;
  }

  update() {
    if (this.shot && !this.hold && this.crowd.finished(this.i)) {
      this.shot = '';
      if (this.baseClip) this.crowd.play(this.i, this.baseClip, { fade: 0.15, loop: true, timeScale: this.baseScale });
    }
  }

  restoreBones() {}
  bone(): Object3D | null {
    return null;
  }
}
