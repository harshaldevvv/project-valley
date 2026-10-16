import { AnimationAction, AnimationClip, AnimationMixer, LoopOnce, LoopRepeat, Object3D, Quaternion, Vector3 } from 'three';
import { anim as A, clipMeta, type ClipMeta } from '../../content/data/anim';
import type { Character } from './character';

/**
 * Player animation runtime (docs/research/character-animation.md §3), on three.js AnimationMixer:
 * - every clip is split into a LOWER (hips, legs) and an UPPER (spine and up) half, so layers can own body parts;
 * - locomotion: 1D forward (idle → walk → run → sprint), crouch, 2D strafe set while aiming; all moving loops share one
 *   phase φ (feet stay in step) and play at speed / authoredSpeed (clamped) so planted feet don't skate;
 * - upper layer: carry pose (rifle_low / pistol_low / aim_* / rifle_sprint) + upper one-shots (fire, reload, draw, melee…);
 * - full-body one-shots (jump, land, hit, death, turn-in-place) override both halves;
 * - transitions: every action weight follows a critically damped spring (no linear 0.2 s crossfades) and each group is
 *   renormalised so weights always sum to 1 per body part (no bind-pose mush).
 * Same method names as the old AnimationController (oneshot / overlay / base / bone / update) for the callers.
 */
const UPPER = /^(spine|chest|neck|head|shoulder|upper_arm|forearm|hand|finger|thumb|SOCKET)/;
const half = (clip: AnimationClip, upper: boolean) => {
  const c = clip.clone();
  c.tracks = c.tracks.filter((t) => UPPER.test(t.name.split('.')[0]) === upper);
  return c;
};

export interface LocoInput {
  speed: number; // horizontal m/s
  /** Velocity direction in the body frame: x right, y forward (unit or zero). */
  dirX: number;
  dirY: number;
  crouched: boolean;
  sprinting: boolean;
  strafe: boolean; // aiming: 2D strafe set
  carry: 'none' | 'rifle' | 'pistol';
  raise: number; // 0 low-ready .. 1 aimed
}

interface Act {
  lo: AnimationAction | null;
  up: AnimationAction | null;
  meta: ClipMeta;
  w: number; // current (springed) weight
  t: number; // target
}

const spring = (w: number, t: number, dt: number, halflife: number) => w + (t - w) * (1 - Math.exp((-0.6931 * dt) / Math.max(1e-3, halflife)));

export class PlayerAnimator {
  private acts = new Map<string, Act>();
  private mixer: AnimationMixer;
  private phase = 0;
  private idleT = 0;
  private full: { name: string; hold: boolean; holdAt: number; onEnd?: () => void } | null = null;
  private upperShot: string | null = null;
  private fullW = 0;
  private upperW = 0;
  private locoT = new Map<string, number>();
  private carryT = new Map<string, number>();
  private lastFull: Act | null = null;
  private procedural: { bone: Object3D; q: Quaternion; p: Vector3 }[] = [];
  input: LocoInput = { speed: 0, dirX: 0, dirY: 1, crouched: false, sprinting: false, strafe: false, carry: 'none', raise: 0 };
  /** Fired when a turn-in-place clip finishes (degrees, + = left). */
  onTurnEnd: ((deg: number) => void) | null = null;

  constructor(private ch: Character) {
    this.mixer = ch.mixer!;
    const meta = clipMeta.chr_survivor_a;
    for (const [name, action] of ch.actions) {
      const clip = action.getClip();
      const m = meta[name] ?? {};
      const lo = m.upperBody ? null : this.mixer.clipAction(half(clip, false));
      const up = this.mixer.clipAction(half(clip, true));
      for (const a of [lo, up]) {
        if (!a) continue;
        a.play();
        a.setEffectiveWeight(0);
        if (m.speed !== undefined) {
          a.setLoop(LoopRepeat, Infinity);
          a.timeScale = 0; // loco time is driven by the shared phase
        } else {
          a.setLoop(LoopOnce, 1);
          a.clampWhenFinished = true;
          a.paused = true;
        }
      }
      this.acts.set(name, { lo, up, meta: m, w: 0, t: 0 });
    }
  }

  duration(name: string) {
    const a = this.acts.get(name);
    return a ? (a.up ?? a.lo)!.getClip().duration : 0;
  }

  has(name: string) {
    return this.acts.has(name);
  }

  /** Bone that gameplay rotates after the mixer (restored before each update). */
  bone(name: string): Object3D | null {
    const b = this.ch.root.getObjectByName(name) ?? null;
    if (b) this.procedural.push({ bone: b, q: b.quaternion.clone(), p: b.position.clone() });
    return b;
  }
  restoreBones() {
    for (const p of this.procedural) {
      p.bone.quaternion.copy(p.q);
      p.bone.position.copy(p.p);
    }
  }

  private start(name: string, timeScale: number) {
    const a = this.acts.get(name)!;
    for (const x of [a.lo, a.up]) {
      if (!x) continue;
      x.reset();
      x.paused = false;
      x.timeScale = timeScale;
      x.setLoop(LoopOnce, 1);
      x.clampWhenFinished = true;
      x.play();
    }
  }

  /** One-shot: upper-body clips go to the upper layer, the rest override the whole body. */
  oneshot(name: string, _fade = 0.1, hold = false, holdAtFrac = 0, timeScale = 1, onEnd?: () => void) {
    const a = this.acts.get(name);
    if (!a) return;
    this.start(name, timeScale);
    if (a.meta.upperBody) this.upperShot = name;
    else (this.lastFull = a), (this.full = { name, hold, holdAt: holdAtFrac > 0 ? holdAtFrac * (a.up ?? a.lo)!.getClip().duration : 0, onEnd });
  }

  /** Old overlay API: restart = upper one-shot (fire, reload, draw, holster); weights are owned by the carry layer. */
  overlay(name: string, _weight: number, restart = false) {
    if (restart) this.oneshot(name);
  }

  /** Back to locomotion (respawn): drops a held full-body pose. */
  base(_name: string, _fade = 0.2, _timeScale = 1, force = false) {
    if (force) this.full = null;
  }

  /** Drop the current full-body one-shot (a turn interrupted by moving or aiming). */
  cancelFull() {
    this.full = null;
  }

  get turning() {
    return !!this.full && this.full.name.startsWith('turn_');
  }

  private loco(targets: Map<string, number>, sp: number) {
    const i = this.input;
    const set = (n: string, w: number) => w > 0 && this.acts.has(n) && targets.set(n, (targets.get(n) ?? 0) + w);
    const speedOf = (n: string) => this.acts.get(n)?.meta.speed ?? 1;
    if (i.crouched) {
      const k = Math.min(1, sp / speedOf('crouch_walk'));
      set('crouch_idle', 1 - k);
      set('crouch_walk', k);
      return;
    }
    if (i.strafe && !i.sprinting) {
      // 2D: cardinal weights from the body-frame direction, walk set ↔ run set by speed, idle below walking speed
      const cx = Math.abs(i.dirX);
      const cy = Math.abs(i.dirY);
      const n = cx + cy || 1;
      const dirs = [i.dirY > 0 ? cy / n : 0, i.dirY < 0 ? cy / n : 0, i.dirX < 0 ? cx / n : 0, i.dirX > 0 ? cx / n : 0];
      const walkRef = dirs[0] * speedOf('walk') + dirs[1] * speedOf('walk_back') + dirs[2] * speedOf('strafe_left') + dirs[3] * speedOf('strafe_right');
      const move = Math.min(1, sp / Math.max(0.3, walkRef));
      const r = Math.max(0, Math.min(1, (sp - walkRef) / Math.max(0.3, walkRef)));
      set(A.survivorIdles[0], 1 - move);
      A.survivorStrafeWalk.forEach((c, k) => set(c, dirs[k] * move * (1 - r)));
      A.survivorStrafeRun.forEach((c, k) => set(c, dirs[k] * move * r));
      return;
    }
    // 1D forward: linear between the two neighbouring nodes
    const nodes = A.survivorForward;
    const sp0 = (k: number) => (k === 0 ? 0 : speedOf(nodes[k]));
    let k = 0;
    while (k < nodes.length - 1 && sp > sp0(k + 1)) k++;
    if (k >= nodes.length - 1) set(nodes[nodes.length - 1], 1);
    else {
      const f = (sp - sp0(k)) / Math.max(1e-3, sp0(k + 1) - sp0(k));
      set(nodes[k], 1 - f);
      set(nodes[k + 1], f);
    }
  }

  update(dt: number) {
    this.restoreBones();
    const i = this.input;
    const sp = i.speed;
    // ---- targets
    const loco = this.locoT;
    loco.clear();
    this.loco(loco, sp);
    const carry = this.carryT;
    carry.clear();
    if (i.carry !== 'none') {
      if (i.sprinting && i.carry === 'rifle' && this.acts.has('rifle_sprint')) carry.set('rifle_sprint', 1);
      else {
        carry.set(i.carry === 'rifle' ? 'rifle_low' : 'pistol_low', 1 - i.raise);
        carry.set(i.carry === 'rifle' ? 'aim_rifle' : 'aim_pistol', i.raise);
      }
    }
    // Upper one-shot finished?
    if (this.upperShot) {
      const a = this.acts.get(this.upperShot)!.up!;
      if (a.time >= a.getClip().duration - 1e-3 || !a.isRunning()) this.upperShot = null;
    }
    // Full one-shot finished / held?
    if (this.full) {
      const a = this.acts.get(this.full.name)!;
      const x = (a.lo ?? a.up)!;
      if (this.full.hold && this.full.holdAt > 0 && x.time >= this.full.holdAt) {
        if (a.lo) a.lo.paused = true;
        if (a.up) a.up.paused = true;
      }
      if (!this.full.hold && x.time >= x.getClip().duration - 1e-3) {
        const f = this.full;
        this.full = null;
        if (f.name.startsWith('turn_')) this.onTurnEnd?.(a.meta.turn_deg ?? 0);
        f.onEnd?.();
      }
    }
    const hlLoco = 0.12;
    const hlUp = 0.08;
    this.fullW = spring(this.fullW, this.full ? 1 : 0, dt, this.full?.name.startsWith('turn_') ? 0.06 : 0.08);
    if (this.full?.name.startsWith('turn_') && this.fullW > 0.9) this.fullW = 1; // turn clips own the body (feet planted)
    this.upperW = spring(this.upperW, i.carry !== 'none' || this.upperShot ? 1 : 0, dt, hlUp);

    // ---- per-action springs, then renormalise per group
    let sumLoco = 0;
    let sumUp = 0;
    for (const [name, a] of this.acts) {
      if (a.meta.speed !== undefined) a.t = loco.get(name) ?? 0;
      else if (a.meta.upperBody) a.t = this.upperShot ? (name === this.upperShot ? 1 : 0) : (carry.get(name) ?? 0);
      else a.t = this.full?.name === name ? 1 : 0;
      a.w = spring(a.w, a.t, dt, a.meta.upperBody ? hlUp : hlLoco);
      if (a.w < 1e-3 && a.t === 0) a.w = 0;
      if (a.meta.speed !== undefined) sumLoco += a.w;
      else if (a.meta.upperBody) sumUp += a.w;
    }
    // ---- shared phase for moving loops (φ advances by the weighted cadence)
    let cadence = 0;
    let movingW = 0;
    for (const a of this.acts.values()) {
      const m = a.meta;
      if (m.speed === undefined || m.speed < 0.05 || !a.w) continue;
      const ts = Math.max(A.speedMatchClamp[0], Math.min(A.speedMatchClamp[1], sp / m.speed));
      cadence += (a.w * ts) / (m.cycle ?? 1);
      movingW += a.w;
    }
    if (movingW > 0) this.phase = (this.phase + (dt * cadence) / movingW) % 1;
    this.idleT += dt;

    // ---- apply
    const fW = this.fullW;
    const uW = this.upperW;
    for (const a of this.acts.values()) {
      const m = a.meta;
      if (m.speed !== undefined) {
        const w = sumLoco > 0 ? a.w / sumLoco : 0;
        const time = m.speed < 0.05 ? this.idleT % (m.cycle ?? 3) : this.phase * (m.cycle ?? 1);
        if (a.lo) (a.lo.time = time), a.lo.setEffectiveWeight(w * (1 - fW));
        if (a.up) (a.up.time = time), a.up.setEffectiveWeight(w * (1 - fW) * (1 - uW));
      } else if (m.upperBody) {
        a.up?.setEffectiveWeight(sumUp > 0 ? (a.w / sumUp) * uW * (1 - fW) : 0);
      } else {
        const w = a === this.lastFull ? fW : 0; // the active (or fading-out) full-body clip
        a.lo?.setEffectiveWeight(w);
        a.up?.setEffectiveWeight(w);
      }
    }
    this.mixer.update(dt);
    for (const p of this.procedural) {
      p.q.copy(p.bone.quaternion);
      p.p.copy(p.bone.position);
    }
  }
}
