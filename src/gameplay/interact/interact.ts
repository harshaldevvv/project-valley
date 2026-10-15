import { Vector3 } from 'three';
import type { Interactable } from '../../core/contracts';
import type { Ctx } from '../ctx';

/**
 * "Press E" interactions: each tick pick the nearest valid Interactable (within its radius of the chest,
 * roughly in view), show its prompt, and call onInteract after holding E for holdSeconds.
 */
const VIEW_COS = Math.cos((65 * Math.PI) / 180);
const _chest = new Vector3();
const _to = new Vector3();

export class Interact {
  current: Interactable | null = null;
  promptText: string | null = null;
  progress = 0; // 0..1 hold ring
  private held = 0;
  private fired = false;

  constructor(private ctx: Ctx) {}

  step(dt: number) {
    const p = this.ctx.player;
    const c = this.ctx.controls;
    this.current = null;
    this.promptText = null;
    if (p.dead || p.inVehicle || this.ctx.game.input.blocked) {
      this.held = 0;
      this.progress = 0;
      return;
    }
    _chest.copy(p.curr).setY(p.curr.y + 1.2);
    let best = Infinity;
    let bestText: string | null = null;
    for (const i of this.ctx.game.interact.all) {
      const r = i.radius ?? 2;
      _to.subVectors(i.position, _chest);
      const d = _to.length();
      if (d > r) continue;
      // In view: angle to the look direction (generous when very close)
      const facing = d < 0.8 ? 1 : _to.dot(p.forward) / d;
      if (facing < VIEW_COS) continue;
      const text = i.prompt();
      if (!text) continue;
      // Aim decides first (what you look at), distance breaks ties: a dropped item in front of a crate wins
      const score = (1 - facing) * 4 + d * 0.3;
      if (score < best) {
        best = score;
        this.current = i;
        bestText = text;
      }
    }
    this.promptText = bestText;
    const cur = this.current;
    // A tap shorter than one tick still counts: latch the press for this tick
    const tap = c.pressed('interact');
    if (cur && tap && (cur.holdSeconds?.() ?? 0) === 0 && !this.fired) {
      this.fired = true;
      this.progress = 1;
      cur.onInteract();
      return;
    }
    if (!cur || !(c.down('interact') || tap)) {
      this.held = 0;
      this.progress = 0;
      this.fired = false;
      return;
    }
    const need = cur.holdSeconds?.() ?? 0;
    this.held += dt;
    this.progress = need > 0 ? Math.min(1, this.held / need) : 1;
    if (!this.fired && this.held >= need) {
      this.fired = true; // once per press
      cur.onInteract();
    }
  }
}

declare module '../ctx' {
  interface Ctx {
    interact: Interact;
  }
}
