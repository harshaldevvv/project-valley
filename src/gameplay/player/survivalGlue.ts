import { Vector3 } from 'three';
import { survivalFeel as SF } from '../../content/data/player';
import { survivalText } from '../../content/text/ui';
import type { SurvivalApi } from '../../core/contracts';
import { probe, type Ctx } from '../ctx';

/**
 * M2 glue between systems' survival/use state and the player (mechanics side):
 * survival.mods → speed, sprint, stamina, sway; timed item use → walk speed, no sprint, animation, cancel on sprint /
 * weapon swap; sprint exertion → fatigue; bleeding drips on the ground. systems owns consume + effects.
 */
type Using = { item: { defId: string }; seconds: number; t: number } | null;
const _p = new Vector3();
const UP = new Vector3(0, 1, 0);

export class SurvivalGlue {
  survival: SurvivalApi | null;
  private wasUsing = false;
  private dripT = 0;

  constructor(private ctx: Ctx) {
    this.survival = probe(ctx.game, 'survival', 'mods');
  }

  get using(): Using {
    const lo = probe(this.ctx.game, 'loadout', 'equipped') as unknown as { using?: Using } | null;
    return lo?.using ?? null;
  }
  private cancelUse() {
    const lo = probe(this.ctx.game, 'loadout', 'equipped') as unknown as { cancelUse?: () => boolean } | null;
    if (lo?.cancelUse?.()) this.ctx.game.events.emit('toast', { text: survivalText.interrupted });
  }

  has(id: string) {
    return !!this.survival?.statuses.has(id as never);
  }

  /** Before the player steps: apply mods and the item-use state. */
  step(dt: number) {
    const p = this.ctx.player;
    const s = this.survival;
    const c = this.ctx.controls;
    if (s && !p.dead) {
      const m = s.mods;
      p.survivalSpeed = m.moveSpeed * (this.has('fracture') ? SF.limpSpeedMul : 1);
      p.sprintAllowed = m.sprintAllowed;
      p.stamina.regenMul = m.staminaRegen;
      p.stamina.costMul = m.staminaCost;
      this.ctx.weapons.swayMul = m.aimSway;
      if (p.sprinting) s.adjust({ fatigue: -SF.sprintFatiguePerSec * dt });
    }
    const u = this.using;
    p.usingItem = !!u;
    if (u) {
      if (c.down('sprint') && c.down('forward')) this.cancelUse();
      else if (c.pressed('primary') || c.pressed('secondary') || c.pressed('sidearm') || c.pressed('melee')) this.cancelUse();
    }
    if (u && !this.wasUsing) {
      // Use animation: survivor search/bandage motion in TP, left hand in FP
      this.ctx.playerAnim?.oneshot('interact_search', 0.12);
      this.ctx.weapons.vm.play('fp_interact', { seconds: Math.max(0.6, u.seconds), leftOnly: true });
      this.ctx.weapons.cancelReload();
    }
    if (!u && this.wasUsing) this.ctx.weapons.vm.stop();
    this.wasUsing = !!u;
    // Bleeding: drops of blood on the ground behind you
    if (s && !p.inVehicle && !p.dead && (this.has('bleeding') || this.has('heavy_bleeding'))) {
      this.dripT -= dt * (this.has('heavy_bleeding') ? 2 : 1);
      if (this.dripT <= 0) {
        this.dripT = SF.bleedDripEvery * (0.7 + this.ctx.rand() * 0.6);
        _p.set(p.curr.x + (this.ctx.rand() - 0.5) * 0.4, p.curr.y + 0.01, p.curr.z + (this.ctx.rand() - 0.5) * 0.4);
        this.ctx.fx.decal(_p, UP, 'flesh', 0.08 + this.ctx.rand() * 0.06);
      }
    }
  }

  /** A zombie hit landed: systems rolls bleeding / infection / fracture. */
  zombieHit(damage: number, zone: 'head' | 'body' | 'limb') {
    try {
      this.survival?.onZombieHit({ damage, zone, armour: 0 });
    } catch (e) {
      console.warn('onZombieHit', e);
    }
  }

  /** Live death bags (systems), for the HUD marker. */
  bags(): { id: string; x: number; y: number; z: number }[] {
    const f = (this.survival as unknown as { deathBags?: () => { id: string; x: number; y: number; z: number }[] } | null)?.deathBags;
    try {
      return f ? f.call(this.survival) : [];
    } catch {
      return [];
    }
  }
}

declare module '../ctx' {
  interface Ctx {
    survival: SurvivalGlue;
  }
}
