import { CylinderGeometry, Mesh, Object3D, Vector3 } from 'three';
import { paintGeometry, paletteMaterial } from '../../engine/palette';
import { survivalFeel as SF } from '../../content/data/player';
import { survivalText } from '../../content/text/ui';
import type { SurvivalApi } from '../../core/contracts';
import { probe, type Ctx } from '../ctx';
import { ITEMS } from '../../content/data/items';

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
  private props: Map<string, { tp: Object3D; fp: Object3D }> | null = null;

  constructor(private ctx: Ctx) {
    this.survival = probe(ctx.game, 'survival', 'mods');
    // Painkillers / energy drink: use.stamina is a stamina boost (systems ignores it)
    ctx.game.events.on('itemUsed', (e) => {
      const st = (e.use as { stamina?: number } | undefined)?.stamina;
      if (st) {
        const s = ctx.player.stamina;
        s.value = Math.min(100, s.value + st);
        if (s.value >= 30) s.exhausted = false;
      }
    });
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
      // Use clip by item kind (mocap): bandage / eat / drink, scaled to the use time
      const kind = ITEMS[u.item.defId]?.kind;
      const clip = kind === 'food' ? 'eat' : kind === 'drink' ? 'drink' : 'use_bandage';
      const anim = this.ctx.playerAnim;
      if (anim?.has(clip)) anim.oneshot(clip, 0.1, false, 0, (anim.duration(clip) || u.seconds) / Math.max(0.5, u.seconds));
      else anim?.oneshot('interact_search', 0.12);
      this.ctx.weapons.vm.play('fp_interact', { seconds: Math.max(0.6, u.seconds), leftOnly: true });
      this.ctx.weapons.cancelReload();
    }
    if (!u && this.wasUsing) this.ctx.weapons.vm.stop();
    // QA-083: the item is in the hand (TP right hand, FP weapon socket) while it's used; the weapon is put away
    const kind = u ? (ITEMS[u.item.defId]?.kind === 'food' ? 'food' : ITEMS[u.item.defId]?.kind === 'drink' ? 'drink' : 'med') : null;
    this.props ??= makeProps(this.ctx);
    for (const [k, pr] of this.props) {
      pr.tp.visible = k === kind && !this.ctx.rig.firstPerson;
      pr.fp.visible = k === kind && this.ctx.rig.firstPerson;
    }
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

  /** Armour rating covering a hit zone: helmet for the head, rig/vest for the body (ItemDef.armour). */
  private armour(zone: 'head' | 'body' | 'limb') {
    const lo = probe(this.ctx.game, 'loadout', 'equipped');
    const it = zone === 'head' ? lo?.equipped('head') : zone === 'body' ? lo?.equipped('armor') : null;
    return it ? (ITEMS[it.defId]?.armour ?? 0) : 0;
  }

  /** A zombie hit landed: systems rolls bleeding / infection / fracture. */
  zombieHit(damage: number, zone: 'head' | 'body' | 'limb') {
    try {
      this.survival?.onZombieHit({ damage, zone, armour: this.armour(zone) });
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

/** Held-item props (low-poly placeholders until item models exist): bandage roll, food can, water bottle. */
function makeProps(ctx: Ctx) {
  const props = new Map<string, { tp: Object3D; fp: Object3D }>();
  const geos: Record<string, () => import('three').BufferGeometry> = {
    med: () => paintGeometry(new CylinderGeometry(0.035, 0.035, 0.07, 10).rotateZ(Math.PI / 2), 'paper'),
    food: () => paintGeometry(new CylinderGeometry(0.038, 0.038, 0.1, 10), 'metal_bare'),
    drink: () => paintGeometry(new CylinderGeometry(0.03, 0.033, 0.22, 10), 'plastic_white'),
  };
  void paletteMaterial().then((mat) => {
    for (const [k, g] of Object.entries(geos)) {
      const tp = new Mesh(g(), mat);
      const fp = new Mesh(g(), mat);
      tp.visible = fp.visible = false;
      fp.castShadow = false;
      tp.castShadow = true;
      ctx.playerChar.hand.add(tp);
      (ctx.weapons.vm.socket('weapon') ?? ctx.weapons.fpHolder).add(fp);
      props.set(k, { tp, fp });
    }
  });
  return props;
}

declare module '../ctx' {
  interface Ctx {
    survival: SurvivalGlue;
  }
}
