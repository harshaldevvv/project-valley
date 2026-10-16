import { Vector3 } from 'three';
import type { Interactable } from '../../core/contracts';
import { Group, groups } from '../../engine/physics';
import { lockpickText } from '../../content/text/ui';
import type { Ctx } from '../ctx';

/**
 * "Press E" interactions: each tick pick the valid Interactable the player is aiming at most directly (within its
 * radius of the chest, in view, with line of sight), show its prompt, and call onInteract after holding E.
 * - QA-070: the camera ray hitting a car makes its prompts win over nearby bodies.
 * - QA-072: nothing is offered through walls (two-sided ray: a point inside its own object still counts).
 * - QA-071: taking damage cancels a hold until E is released.
 */
const VIEW_COS = Math.cos((65 * Math.PI) / 180);
const LOS_FILTER = groups(Group.PLAYER, Group.STATIC | Group.BUILD | Group.TERRAIN);
const _chest = new Vector3();
const _eye = new Vector3();
const _to = new Vector3();
const _o = new Vector3();
const _d = new Vector3();

export class Interact {
  current: Interactable | null = null;
  promptText: string | null = null;
  progress = 0; // 0..1 hold ring
  private held = 0;
  private fired = false;
  private interrupted = false;
  private ray;

  constructor(private ctx: Ctx) {
    this.ray = new ctx.game.phys.R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    ctx.game.events.on('playerDamaged', () => {
      if (this.held > 0 && !this.fired) {
        this.interrupted = true;
        this.held = 0;
        this.progress = 0;
        ctx.weapons.vm.stop();
        ctx.game.events.emit('toast', { text: lockpickText.interrupted });
      }
    });
  }

  /** Line of sight from the eye to an interaction point (walls block; the point's own object doesn't). */
  private visible(p: Vector3) {
    const { world } = this.ctx.game.phys;
    _to.subVectors(p, _eye);
    const d = _to.length();
    if (d < 0.3) return true;
    _to.divideScalar(d);
    this.ray.origin = _eye;
    this.ray.dir = _to;
    const fwd = world.castRay(this.ray, d, true, undefined, LOS_FILTER, this.ctx.player.collider);
    if (!fwd || fwd.timeOfImpact > d - 0.05) return true;
    // Something in between: is the point inside that object (crate, door), or behind it (wall)?
    _to.negate();
    this.ray.origin = p;
    this.ray.dir = _to;
    const back = world.castRay(this.ray, d, true, undefined, LOS_FILTER, this.ctx.player.collider);
    return !back || back.timeOfImpact < 0.02;
  }

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
    _eye.copy(p.curr).setY(p.curr.y + p.eyeHeight);
    // What the crosshair is on (within reach): a car makes vehicle prompts win
    this.ctx.rig.aimRay(_o, _d);
    this.ray.origin = _o;
    this.ray.dir = _d;
    const aimHit = this.ctx.game.phys.world.castRay(this.ray, 6, true, undefined, groups(Group.PLAYER, Group.STATIC | Group.VEHICLE | Group.BUILD), p.collider);
    const onCar = !!aimHit && this.ctx.hits.get(aimHit.collider.handle)?.kind === 'vehicle';
    let best = Infinity;
    let bestText: string | null = null;
    for (const i of this.ctx.game.interact.all) {
      const r = i.radius ?? 2;
      _to.subVectors(i.position, _chest);
      const d = _to.length();
      if (d > r) continue;
      // Aim: angle between the camera ray and the direction to the point (generous when very close)
      _to.subVectors(i.position, _o);
      const da = _to.length();
      const facing = d < 0.8 ? 1 : _to.dot(_d) / Math.max(1e-3, da);
      if (facing < VIEW_COS) continue;
      const text = i.prompt();
      if (!text) continue;
      let score = Math.acos(Math.min(1, facing)) * 3 + d * 0.15;
      if (onCar && this.ctx.vehicles.prompts.has(i)) score -= 10;
      if (score >= best || !this.visible(i.position)) continue;
      best = score;
      this.current = i;
      bestText = text;
    }
    this.promptText = bestText;
    const cur = this.current;
    // A tap shorter than one tick still counts: latch the press for this tick
    const tap = c.pressed('interact');
    if (!c.down('interact') && !tap) this.interrupted = false;
    if (cur && tap && (cur.holdSeconds?.() ?? 0) === 0 && !this.fired) {
      this.fired = true;
      this.progress = 1;
      cur.onInteract();
      return;
    }
    if (!cur || this.interrupted || !(c.down('interact') || tap)) {
      this.held = 0;
      this.progress = 0;
      this.fired = false;
      return;
    }
    const need = cur.holdSeconds?.() ?? 0;
    if (this.held === 0 && need > 0) this.ctx.weapons.vm.play('fp_interact', { seconds: Math.min(need, 0.8), leftOnly: true });
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
