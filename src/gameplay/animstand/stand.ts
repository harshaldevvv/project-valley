import { LoopOnce, LoopRepeat, Object3D, SkeletonHelper, Vector3, type AnimationAction } from 'three';
import { Group, groups } from '../../engine/physics';
import { yard } from '../../content/data/yard';
import type { Ctx } from '../ctx';
import { makeWeaponModel } from '../weapons/models';
import { meleeDefs, weaponFeel } from '../../content/data/weapons';
import { applyPose, clipNames, makeCharacter, newPose, type Character } from './character';

/**
 * Animation stand (station 'anim'): a character on the pedestal. Debug group "Animation": one button per clip,
 * speed 0.1–2, loop, survivor/zombie switch, skeleton. Placeholder rigs get a procedural stand-in per clip.
 */
export const animStand = { speed: 1, loop: true, zombie: false, skeleton: false };

export class AnimStand {
  ch: Character | null = null;
  private kind: 'survivor' | 'zombie' = 'survivor';
  private clip = 'idle';
  private action: AnimationAction | null = null;
  private t = 0;
  private skel: SkeletonHelper | null = null;
  private base = new Vector3();
  private loading = false;

  constructor(private ctx: Ctx) {}

  async init() {
    const a = yard.stations.anim;
    this.base.set(a.x, 0.4, a.z); // pedestal height until the first physics step lets us measure it
    await this.load('survivor');
    const d = this.ctx.debug;
    d.tune('Animation', animStand, 'speed', 0.1, 2, 0.05);
    d.toggle('Animation', animStand, 'loop');
    d.toggle('Animation', animStand, 'skeleton');
    d.action('Animation', 'Switch survivor / zombie', () => void this.load(this.kind === 'survivor' ? 'zombie' : 'survivor'));
    d.watch('Animation', 'clip', () => `${this.kind}: ${this.clip}${this.ch?.skinned ? '' : ' (placeholder rig)'}`);
    for (const c of [...clipNames('survivor'), ...clipNames('zombie')]) d.action('Animation', c, () => this.play(c));
    // QA-078: first-person arms preview (switches to FP, draws the matching weapon, plays the clip)
    const fpClips = ['idle', 'fire', 'reload', 'draw', 'holster', 'ads'].flatMap((c) => [`fp_rifle_${c}`, `fp_pistol_${c}`]).concat(['fp_knife_idle', 'fp_knife_light', 'fp_knife_heavy', 'fp_knife_draw', 'fp_shove', 'fp_interact']);
    for (const c of fpClips)
      d.action('Stand: first-person view', c, () => {
        const w = this.ctx.weapons;
        this.ctx.rig.mode = 'fp';
        const slot = c.includes('rifle') ? 0 : c.includes('pistol') ? 2 : c.includes('knife') ? 3 : -1;
        if (slot >= 0 && w.slot !== slot) w.select(slot);
        setTimeout(() => (c.endsWith('_ads') ? this.ctx.game.events.emit('toast', { text: 'Hold RMB for the ADS pose' }) : w.vm.play(c, { leftOnly: c === 'fp_shove' || c === 'fp_interact' })), slot >= 0 && w.slot !== slot ? 900 : 0);
      });
  }

  private async load(kind: 'survivor' | 'zombie') {
    if (this.loading) return;
    this.loading = true;
    this.ch?.root.removeFromParent();
    this.skel?.removeFromParent();
    this.skel = null;
    this.kind = kind;
    animStand.zombie = kind === 'zombie';
    const ch = await makeCharacter(kind, kind === 'zombie' ? 'zmb_shambler_a' : 'chr_survivor_a');
    ch.root.position.copy(this.base);
    ch.root.rotation.y = 0; // faces north; the player arrives from spawn (south) — rotate to face them
    ch.root.rotation.y = Math.PI;
    this.ctx.game.scene.add(ch.root);
    this.ch = ch;
    if (kind === 'survivor') await this.attachWeapons(ch);
    this.loading = false;
    this.play(kind === 'zombie' ? 'z_idle' : 'idle');
  }

  /** QA-067: the stand holds the right weapon for gun and melee clips (models in SOCKET_hand_R, identity grip). */
  private weapons = new Map<string, Object3D>();
  private async attachWeapons(ch: Character) {
    for (const [id, kind] of [['pistol_a', 'pistol'], ['rifle_a', 'rifle'], ['knife_a', 'knife']] as const) {
      let w = this.weapons.get(kind);
      if (!w) {
        const model = weaponFeel[id]?.model ?? meleeDefs[id]?.model;
        w = (await makeWeaponModel(id, model, kind)).root;
        this.weapons.set(kind, w);
      }
      w.visible = false;
      ch.hand.add(w);
      if (!ch.skinned) w.rotation.set(-Math.PI / 2, 0, 0); // placeholder arm hangs down
    }
  }
  private showWeapon(clip: string) {
    const want = /pistol|^holster$/.test(clip) ? 'pistol' : /rifle/.test(clip) ? 'rifle' : /melee/.test(clip) ? 'knife' : '';
    for (const [k, w] of this.weapons) w.visible = this.kind === 'survivor' && k === want;
  }

  play(name: string) {
    const ch = this.ch;
    if (!ch) return;
    const isZ = name.startsWith('z_');
    if (isZ !== (this.kind === 'zombie')) {
      void this.load(isZ ? 'zombie' : 'survivor').then(() => this.play(name));
      return;
    }
    this.clip = name;
    this.showWeapon(name);
    this.t = 0;
    if (ch.mixer) {
      const a = ch.actions.get(name);
      if (!a) {
        this.ctx.game.events.emit('toast', { text: `Clip "${name}" not in the model yet` });
        return;
      }
      this.action?.fadeOut(0.15);
      a.reset().setLoop(animStand.loop ? LoopRepeat : LoopOnce, Infinity).fadeIn(0.15).play();
      a.clampWhenFinished = true;
      this.action = a;
    }
  }

  /** QA-010: colliders only answer queries after the first physics step, so measure the pedestal top lazily. */
  private measureBase() {
    const { R, world } = this.ctx.game.phys;
    const hit = world.castRay(new R.Ray({ x: this.base.x, y: 6, z: this.base.z }, { x: 0, y: -1, z: 0 }), 10, true, R.QueryFilterFlags.EXCLUDE_SENSORS, groups(Group.ZOMBIE, Group.STATIC | Group.TERRAIN | Group.BUILD));
    if (!hit) return;
    this.base.y = 6 - hit.timeOfImpact;
    this.measured = true;
  }
  private measured = false;

  render(_alpha: number, dt: number) {
    const ch = this.ch;
    if (!ch) return;
    if (!this.measured) this.measureBase();
    ch.root.position.copy(this.base);
    const sdt = dt * animStand.speed;
    this.t += sdt;
    if (ch.mixer) {
      if (this.action) this.action.loop = animStand.loop ? LoopRepeat : LoopOnce;
      ch.mixer.update(sdt);
      if (animStand.skeleton && !this.skel) {
        this.skel = new SkeletonHelper(ch.root);
        this.ctx.game.scene.add(this.skel);
      }
      if (this.skel) this.skel.visible = animStand.skeleton;
      return;
    }
    // Procedural stand-in so every clip button shows *something* on the placeholder rig
    const dur = 1.2;
    const t = animStand.loop ? this.t : Math.min(this.t, dur);
    const k = (t % dur) / dur;
    const p = Object.assign(ch.pose, newPose());
    const c = this.clip.replace(/^z_/, '');
    const move = (speed: number) => {
      p.speed01 = speed;
      p.walkPhase = t * speed * 7;
    };
    switch (c) {
      case 'walk': move(0.5); break;
      case 'run': move(1); break;
      case 'sprint': move(1.6); p.lean = 0.25; break;
      case 'crawl': move(0.4); p.crouch = 1; p.lean = 1.2; break;
      case 'crouch_idle': p.crouch = 1; break;
      case 'crouch_walk': p.crouch = 1; move(0.4); break;
      case 'jump': case 'fall': case 'land': p.crouch = c === 'land' ? Math.sin(k * Math.PI) * 0.6 : 0.2; p.armRaise = c === 'fall' ? 0.5 : 0; break;
      case 'aim_pistol': p.hold = 'pistol'; break;
      case 'aim_rifle': p.hold = 'rifle'; break;
      case 'fire_pistol': p.hold = 'pistol'; p.kick = Math.max(0, 1 - (t % 0.25) / 0.08); break;
      case 'fire_rifle': p.hold = 'rifle'; p.kick = Math.max(0, 1 - (t % 0.1) / 0.08); break;
      case 'reload_pistol': case 'reload_rifle': p.hold = c.endsWith('pistol') ? 'pistol' : 'rifle'; p.holster = Math.sin(k * Math.PI) * 0.4; break;
      case 'draw_pistol': case 'draw_rifle': case 'holster': p.hold = c === 'draw_rifle' ? 'rifle' : 'pistol'; p.holster = c === 'holster' ? k : 1 - k; break;
      case 'melee_swing': p.hold = 'knife'; p.swing = Math.sin(k * Math.PI * 2); break;
      case 'shove': case 'grab': p.armRaise = Math.sin(k * Math.PI); p.lean = 0.3 * Math.sin(k * Math.PI); break;
      case 'attack': p.armRaise = Math.min(1, k * 2); p.lean = k < 0.6 ? -0.2 : 0.4; break;
      case 'hit_react': case 'hit': p.flinch = Math.sin(k * 30) * (1 - k) * 0.4; p.headBack = (1 - k) * 0.5; break;
      case 'stagger': p.lean = -0.45 * Math.sin(k * Math.PI); p.flinch = Math.sin(k * 12) * 0.2; break;
      case 'death': p.fall = k; break;
      case 'drive_sit': p.crouch = 0.8; p.armRaise = 0.6; break;
      case 'interact_search': p.crouch = 0.6; p.armRaise = 0.4 + Math.sin(t * 6) * 0.1; break;
    }
    applyPose(ch);
    ch.root.rotation.set(0, Math.PI, 0);
    ch.root.position.copy(this.base);
    if (p.fall > 0) ch.root.rotateX(-p.fall * 1.5);
  }
}

declare module '../ctx' {
  interface Ctx {
    animStand: AnimStand;
  }
}
