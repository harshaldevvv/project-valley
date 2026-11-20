import { Frustum, Matrix4, Sphere, Vector3 } from 'three';
import { HORDE_NIGHT as HN } from '../../content/data/zombie_arch';
import { horde as HD } from '../../content/data/zombies';
import { itemText } from '../../content/text/items';
import { hordeText as T } from '../../content/text/horde';
import { newItems } from '../../systems/inventory';
import type { Loadout } from '../../systems/loadout';
import { questBus } from '../../systems/questBus';
import type { Ctx } from '../ctx';
import { hordeSize, hordeStep, newHordeState, type HordeState } from './archetypes';
import type { Zombie, Zombies } from './zombies';

/**
 * Horde night lite: every HORDE_NIGHT.everyDays in-game days, from 22:00 until dawn, a horde of 15-25 appears around the
 * player (out of view) and converges on where the player is. A warning comes an in-game hour before (toast, banner); a toast
 * at the start and the end; surviving to dawn without dying gives a reward and fires 'horde_survived' on the quest bus.
 * The schedule is pure (archetypes.ts hordeStep); this module is the world side. Saved in the 'horde' section (version 1).
 */
export const HORDE_SAVE_VERSION = 1;
const _frustum = new Frustum();
const _m = new Matrix4();
const _s = new Sphere(new Vector3(), 1.5);

export class HordeNight {
  state: HordeState = newHordeState();
  members: Zombie[] = [];
  /** Zombies still to bring in this night. */
  private queue = 0;
  private acc = 0;
  private retarget = 0;
  private busy = false;
  private diedDuring = false;
  private normalCap = HD.maxAlive;
  private banner: HTMLElement;
  private bannerKey = '';

  constructor(private ctx: Ctx, private zombies: Zombies) {
    const b = document.createElement('div');
    b.style.cssText = 'position:fixed;left:50%;top:62px;transform:translateX(-50%);z-index:12;display:none;padding:6px 14px;border-radius:3px;pointer-events:none;background:rgba(40,8,6,.86);border-left:3px solid #e0402e;color:#ffd9d0;font:700 12px system-ui;letter-spacing:.14em';
    ctx.game.ui.appendChild(b);
    this.banner = b;
    ctx.game.events.on('playerDied', () => (this.diedDuring = true));
    try {
      ctx.game.save.section('horde', {
        version: HORDE_SAVE_VERSION,
        save: () => ({ phase: this.state.phase, day: this.state.day, done: [...this.state.done] }),
        load: (d) => {
          const v = d as HordeState;
          // a horde in progress when saved is over after a load (its zombies are not saved): count it as done
          this.state = { phase: 'idle', day: v.day ?? 0, done: [...(v.done ?? []), ...(v.phase === 'on' ? [v.day] : [])] };
          this.reset();
        },
      });
    } catch {
      /* no save system */
    }
  }

  get active() {
    return this.state.phase === 'on';
  }

  private time() {
    const t = this.ctx.game.time;
    return { day: t.day, hours: t.hours };
  }
  private toast(text: string, icon?: string) {
    this.ctx.game.events.emit('toast', { text, icon });
  }
  private hhmm(h: number) {
    return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  }
  private reset() {
    this.queue = 0;
    this.members = [];
    this.diedDuring = false;
    HD.maxAlive = this.normalCap;
    this.zombies.hordeOn = false;
  }

  /** Debug and tests: start a horde right now. */
  forceStart() {
    const t = this.time();
    this.state.phase = 'on';
    this.state.day = t.day;
    this.begin();
  }

  private begin() {
    this.queue = hordeSize(this.ctx.rand());
    this.acc = 1;
    this.retarget = 0;
    this.diedDuring = false;
    this.members = [];
    this.normalCap = HD.maxAlive;
    HD.maxAlive = HN.maxAlive;
    this.zombies.hordeOn = true; // streaming zones pause while a horde is on
    this.toast(T.start, undefined);
  }

  step(dt: number) {
    const t = this.time();
    const ev = hordeStep(this.state, t.day, t.hours);
    if (ev === 'warn') {
      this.toast(T.warn);
    } else if (ev === 'start') {
      this.begin();
    } else if (ev === 'end') {
      this.finish();
    }
    this.draw(t.hours);
    if (!this.active) return;
    this.members = this.members.filter((z) => z.alive);
    // bring them in a few at a time, out of sight
    if (this.queue > 0 && !this.busy && !this.ctx.player.dead) {
      this.acc += dt * HN.spawnPerS;
      if (this.acc >= 1 && this.zombies.alive < HD.maxAlive) {
        this.acc -= 1;
        this.spawnOne();
      }
    }
    // keep them coming at where the player is now
    if ((this.retarget -= dt) <= 0) {
      this.retarget = HN.retargetS;
      const p = this.ctx.player;
      if (!p.dead) {
        for (const z of this.members) {
          if (z.sense.awareness === 'detected') continue;
          z.sense.awareness = 'searching';
          z.sense.searchLeft = 600;
          z.sense.suspicion = Math.max(z.sense.suspicion, 0.6);
          z.lastKnown.copy(p.curr);
        }
      }
    }
  }

  private spawnOne() {
    const p = this.ctx.player;
    const cam = this.ctx.game.camera;
    cam.updateMatrixWorld();
    _frustum.setFromProjectionMatrix(_m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    for (let tries = 0; tries < 10; tries++) {
      const a = this.ctx.rand() * Math.PI * 2;
      const r = HN.ring[0] + this.ctx.rand() * (HN.ring[1] - HN.ring[0]);
      const x = p.curr.x + Math.cos(a) * r;
      const z = p.curr.z + Math.sin(a) * r;
      _s.center.set(x, 1, z);
      if (_frustum.intersectsSphere(_s) && tries < 9) continue; // never pop in view (the last try accepts it)
      this.busy = true;
      this.queue--;
      this.zombies
        .spawn(new Vector3(x, 0.05, z), this.ctx.rand() * Math.PI * 2, this.zombies.pickVariant(HN.tier, 1))
        .then((zb) => {
          zb.sense.awareness = 'searching';
          zb.sense.searchLeft = 600;
          zb.sense.suspicion = 0.6;
          zb.lastKnown.copy(p.curr);
          this.members.push(zb);
        })
        .catch(() => undefined)
        .finally(() => (this.busy = false));
      return;
    }
  }

  private finish() {
    const p = this.ctx.player;
    HD.maxAlive = this.normalCap;
    this.zombies.hordeOn = false;
    this.toast(T.end);
    // what is left of the horde burns off in the light, except what is close
    for (const z of this.members) if (z.alive && Math.hypot(z.curr.x - p.curr.x, z.curr.z - p.curr.z) > HN.dawnRemoveBeyond) this.zombies.dismiss(z);
    this.members = [];
    this.queue = 0;
    if (!this.diedDuring && !p.dead) {
      const lo = this.ctx.game.loadout as unknown as Loadout;
      for (const r of HN.reward) {
        for (const it of newItems(r.item, r.count)) lo.give(it);
        this.toast(T.reward(itemText[r.item]?.name ?? r.item, r.count), r.item);
      }
      this.toast(T.survived);
      questBus.emit('horde_survived', { day: this.state.done[this.state.done.length - 1] });
    } else this.toast(T.failed);
  }

  private draw(hours: number) {
    let key = '';
    if (this.state.phase === 'warned') key = T.warnBanner(this.hhmm(HN.startHour));
    else if (this.active) key = T.banner(this.members.length + this.queue);
    if (key !== this.bannerKey) {
      this.bannerKey = key;
      this.banner.textContent = key;
      this.banner.style.display = key ? 'block' : 'none';
    }
    void hours;
  }
}
