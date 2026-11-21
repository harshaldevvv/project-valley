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
// Our rig names and Mixamo names (Polyfork hero chr_hero_pf, chr_body_a)
const UPPER = /^(spine|chest|neck|head|shoulder|upper_arm|forearm|hand|finger|thumb|SOCKET|Spine|Neck|Head|Face_|(Left|Right)(Shoulder|Arm|ForeArm|Hand))/;
/** Our bone name -> Mixamo bone name, for rigs that use Mixamo naming. */
const MIXAMO: Record<string, string> = {
  hips: 'Hips', spine: 'Spine', chest: 'Spine2', neck: 'Neck', head: 'Head',
  thigh_L: 'LeftUpLeg', shin_L: 'LeftLeg', foot_L: 'LeftFoot', toe_L: 'LeftToeBase',
  thigh_R: 'RightUpLeg', shin_R: 'RightLeg', foot_R: 'RightFoot', toe_R: 'RightToeBase',
  shoulder_L: 'LeftShoulder', upper_arm_L: 'LeftArm', forearm_L: 'LeftForeArm', hand_L: 'LeftHand',
  shoulder_R: 'RightShoulder', upper_arm_R: 'RightArm', forearm_R: 'RightForeArm', hand_R: 'RightHand',
};
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

const _hq = new Quaternion();
const _rq = new Quaternion();
const _hv = new Vector3();
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
    this.hips = ch.root.getObjectByName('hips') ?? ch.root.getObjectByName(MIXAMO.hips) ?? null; // Mixamo rigs: turn root motion
    const meta = clipMeta.chr_survivor_a;
    for (const [name, action] of ch.actions) {
      const clip = action.getClip();
      // Clip ground speeds are measured on the survivor rig; a rig with shorter legs covers less ground per cycle
      const k = A.strideScaleClip[ch.root.name]?.[name] ?? A.strideScale[ch.root.name] ?? 1;
      const m0 = meta[name] ?? A.nativeMeta[name] ?? {};
      const m = m0.speed !== undefined && k !== 1 ? { ...m0, speed: m0.speed * k } : m0;
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
    this.swapNodes();
  }

  /** Swap blend nodes for clips native to this model (anim.nodeSwap). */
  private swapNodes() {
    for (const [node, clip] of Object.entries(A.nodeSwap[this.ch.root.name] ?? {})) {
      const a = this.acts.get(clip);
      if (!a) continue;
      const old = this.acts.get(node);
      for (const x of [old?.lo, old?.up]) x?.setEffectiveWeight(0);
      this.acts.delete(clip);
      this.acts.set(node, a);
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
    const b = this.ch.root.getObjectByName(name) ?? (MIXAMO[name] ? this.ch.root.getObjectByName(MIXAMO[name]) : undefined) ?? null;
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
    if (a.meta.upperBody) (this.upperShot = name), (this.upperTS = timeScale), (this.pauseT = 0);
    else (this.lastFull = a), (this.full = { name, hold, holdAt: holdAtFrac > 0 ? holdAtFrac * (a.up ?? a.lo)!.getClip().duration : 0, onEnd });
  }

  /** Hitstop on the hero: the upper one-shot (melee swing) nearly stops for `seconds`, then resumes. */
  private pauseT = 0;
  private upperTS = 1;
  get paused() {
    return this.pauseT > 0;
  }
  hitPause(seconds: number) {
    this.pauseT = Math.max(this.pauseT, seconds);
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

  /**
   * QA-084: turn clips rotate the hips; move that yaw into the body yaw as it happens (onTurnDelta) and counter-rotate
   * the hips by what the root has already received, so the end of the clip has nothing left to snap.
   */
  private turnAccum = 0;
  private turnStart: number | null = null;
  onTurnDelta: ((rad: number) => void) | null = null;
  private turnRootMotion() {
    const turning = !!this.full && !!this.acts.get(this.full.name)?.meta.turn_deg;
    if (!turning || !this.hips) {
      this.turnStart = null;
      this.turnAccum = 0;
      return;
    }
    this.ch.root.updateMatrixWorld(true);
    this.hips.getWorldQuaternion(_hq);
    this.ch.root.getWorldQuaternion(_rq);
    _hq.premultiply(_rq.invert());
    _hv.set(0, 0, 1).applyQuaternion(_hq);
    const yaw = Math.atan2(_hv.x, _hv.z);
    if (this.turnStart === null) this.turnStart = yaw;
    const accum = Math.atan2(Math.sin(yaw - this.turnStart), Math.cos(yaw - this.turnStart));
    const already = this.turnAccum; // the root got this much before this frame's render
    this.onTurnDelta?.(accum - this.turnAccum);
    this.turnAccum = accum;
    // counter-rotate the hips (world up) by what the root already shows
    this.hips.parent!.getWorldQuaternion(_rq);
    _hv.set(0, 1, 0).applyQuaternion(_rq.invert());
    this.hips.quaternion.premultiply(_hq.setFromAxisAngle(_hv, -already));
  }
  private hips: Object3D | null = null;
  /** Orientation warp for the aimed 2D set (rad, world-up rotation of the hips; bodyPost applies it). */
  hipWarp = 0;
  private hipWarpT = 0;

  /** A full-body one-shot (jump, land, hit, turn…) owns the legs. */
  get fullBody() {
    return !!this.full || this.fullW > 0.05;
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
      // 2D, orientation warping: play the nearest cardinal clip (forward / back / left / right, short cross-fades only
      // near the sector edges) and twist the hips toward the travel direction by the rest (`hipWarp`, applied in
      // bodyPost; the spine counter-twists so the aim holds). Blending forward + strafe clips for a keyboard diagonal
      // skated ~1 m/s: the two clips plant the same foot at different phases.
      const th = Math.atan2(i.dirX, i.dirY); // 0 forward, + right
      const card = [0, Math.PI, -Math.PI / 2, Math.PI / 2]; // [fwd, back, left, right] like the clip sets
      const halfW = [A.warpFwdDeg, A.warpFwdDeg, 90 - A.warpFwdDeg, 90 - A.warpFwdDeg].map((d) => (d * Math.PI) / 180);
      const band = (A.warpBlendDeg * Math.PI) / 180;
      const d = [0, 0, 0, 0];
      const rel = [0, 0, 0, 0];
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        rel[k] = Math.atan2(Math.sin(th - card[k]), Math.cos(th - card[k]));
        d[k] = Math.max(0, Math.min(1, (halfW[k] + band / 2 - Math.abs(rel[k])) / band));
        sum += d[k];
      }
      let warp = 0;
      for (let k = 0; k < 4; k++) {
        d[k] /= sum || 1;
        warp += d[k] * rel[k];
      }
      this.hipWarpT = i.speed > 0.2 ? -warp : 0; // world-up rotation (+ = left) that maps the clip's direction onto travel
      const refOf = (set4: string[]) => d.reduce((acc, w, k) => acc + w * speedOf(set4[k]), 0);
      const walkRef = refOf(A.survivorStrafeWalk);
      const runRef = refOf(A.survivorStrafeRun);
      const W = { d };
      const R = { d };
      const move = Math.min(1, sp / Math.max(0.3, walkRef));
      // QA-087: walk and run back/strafe clips have different contact timings, so blending them mid-stride skates.
      // Use the walk set while it can be speed-matched (ts ≤ max), the run set once it can (ts ≥ min); blend only
      // across the gap between the two bands.
      const [lo, hi] = A.speedMatchClamp;
      const walkTop = walkRef * hi;
      const runBottom = runRef * lo;
      const r = runBottom > walkTop ? Math.max(0, Math.min(1, (sp - walkTop) / (runBottom - walkTop))) : sp >= (walkTop + runBottom) / 2 ? 1 : 0;
      set(A.survivorIdles[0], 1 - move);
      A.survivorStrafeWalk.forEach((c, k) => set(c, W.d[k] * move * (1 - r)));
      A.survivorStrafeRun.forEach((c, k) => set(c, R.d[k] * move * r));
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
    this.hipWarpT = 0;
    this.loco(loco, sp);
    this.hipWarp = spring(this.hipWarp, this.full ? 0 : this.hipWarpT, dt, 0.09);
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
      this.pauseT = Math.max(0, this.pauseT - dt);
      a.timeScale = this.pauseT > 0 ? this.upperTS * 0.05 : this.upperTS;
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
        if (f.name.startsWith('turn_')) this.onTurnEnd?.(0);
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
    // One time scale for the blend: actual speed / blended authored speed (clamped), so planted feet stay planted
    // Phase rate: each loop's own speed-matched rate, weighted (exact whenever one clip dominates)
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
    const turnLayer = !!this.lastFull && !!this.lastFull.meta.turn_deg;
    for (const a of this.acts.values()) {
      const m = a.meta;
      if (m.speed !== undefined) {
        const w = sumLoco > 0 ? a.w / sumLoco : 0;
        const time = m.speed < 0.05 ? this.idleT % (m.cycle ?? 3) : ((this.phase + (m.phase ?? 0)) % 1) * (m.cycle ?? 1);
        if (a.lo) (a.lo.time = time), a.lo.setEffectiveWeight(w * (1 - fW));
        if (a.up) (a.up.time = time), a.up.setEffectiveWeight(w * (turnLayer ? 1 - fW * (1 - uW) : 1 - fW) * (1 - uW));
      } else if (m.upperBody) {
        a.up?.setEffectiveWeight(sumUp > 0 ? (a.w / sumUp) * uW * (turnLayer ? 1 : 1 - fW) : 0);
      } else {
        const w = a === this.lastFull ? fW : 0; // the active (or fading-out) full-body clip
        a.lo?.setEffectiveWeight(w);
        a.up?.setEffectiveWeight(turnLayer ? w * (1 - uW) : w); // QA-084: hands stay on the gun while turning
      }
    }
    this.mixer.update(dt);
    this.turnRootMotion();
    for (const p of this.procedural) {
      p.q.copy(p.bone.quaternion);
      p.p.copy(p.bone.position);
    }
  }
}
