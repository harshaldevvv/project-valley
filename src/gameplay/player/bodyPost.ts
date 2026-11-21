import { Object3D, Quaternion, Vector3 } from 'three';
import { Group, groups } from '../../engine/physics';
import { animPost as P } from '../../content/data/anim';
import type { Ctx } from '../ctx';
import type { PlayerAnimator } from '../animstand/locomotion';

/**
 * Procedural pass after the mixer (research §3.3, 3.7, 3.8, 3.9), player only:
 * - aim offsets spread over spine / chest / neck (pitch always when raised, yaw when the body lags the camera);
 * - head look toward the camera when the gun is down (neck 0.4 / head 0.6);
 * - lean into turns and acceleration (hips 0.4 / spine 0.6), springed;
 * - two-bone foot IK with a pelvis offset on uneven ground and stairs (Rapier rays), off in the air / sprinting.
 * All rotations are applied about world axes converted into each bone's parent space, so the rig's local axis
 * conventions don't matter.
 */
const DEG = Math.PI / 180;
const UP = new Vector3(0, 1, 0);
const _q = new Quaternion();
const _pq = new Quaternion();
const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _lk = new Vector3();
const _lf0 = new Vector3();
const _lf1 = new Vector3();
const _fq = new Quaternion();
const _t = new Vector3();
const _v = new Vector3();
const _w = new Vector3();
const _r = new Vector3();
const _f = new Vector3();
const _rax = new Vector3();
const _ax = new Vector3();
const _e1 = new Vector3();
const _e2 = new Vector3();
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const spring = (x: number, t: number, dt: number, hl: number) => x + (t - x) * (1 - Math.exp((-0.6931 * dt) / hl));

/** Rotate a bone by `angle` about a world-space axis. */
function rotateWorld(bone: Object3D, axis: Vector3, angle: number) {
  if (!angle) return;
  bone.parent!.getWorldQuaternion(_pq);
  _rax.copy(axis).applyQuaternion(_q.copy(_pq).invert());
  bone.quaternion.premultiply(_q.setFromAxisAngle(_rax, angle));
  bone.updateMatrixWorld(true);
}

interface Leg {
  thigh: Object3D;
  shin: Object3D;
  foot: Object3D;
  /** Foot lock: lowest foot height seen (root space), pinned world point, blend weight. */
  minH: number;
  locked: boolean;
  lock: Vector3;
  w: number;
  /** Where the clip put the foot last frame (world) and how long the current lock has held (s). */
  prev: Vector3;
  age: number;
}

export class BodyPost {
  private hips: Object3D | null;
  private spine: Object3D | null;
  private chest: Object3D | null;
  private armR: Object3D | null;
  private swing = 0;
  private neck: Object3D | null;
  private head: Object3D | null;
  private legs: Leg[] = [];
  private roll = 0;
  private pitchLean = 0;
  private pelvis = 0;
  private lastYaw = 0;
  private lastSpeed = 0;
  private smoothSpeed = 0;
  private ray;
  // reaction springs: flinch (pitch back, roll) and landing dip, each [x, v]
  private flP = [0, 0];
  private flR = [0, 0];
  private dip = [0, 0];
  private airVy = 0;
  private wasGrounded = true;

  constructor(private ctx: Ctx, private root: Object3D, anim: PlayerAnimator) {
    this.hips = anim.bone('hips');
    this.spine = anim.bone('spine');
    this.chest = anim.bone('chest');
    this.armR = anim.bone('upper_arm_R');
    this.neck = anim.bone('neck');
    this.head = anim.bone('head');
    for (const s of ['L', 'R']) {
      const thigh = anim.bone(`thigh_${s}`);
      const shin = anim.bone(`shin_${s}`);
      const foot = anim.bone(`foot_${s}`);
      if (thigh && shin && foot) this.legs.push({ thigh, shin, foot, minH: Infinity, locked: false, lock: new Vector3(), w: 0, prev: new Vector3(), age: 0 });
    }
    this.ray = new ctx.game.phys.R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
    // Hit flinch: upper body snaps away from the hit direction (front hit → back, side hit → roll away)
    ctx.game.events.on('playerDamaged', ({ amount, from }) => {
      const pl = ctx.player;
      if (pl.dead || pl.inVehicle) return;
      const k = Math.min(1.6, 0.6 + amount / 25) * P.flinchDeg * DEG;
      let fx = 0;
      let fz = 1;
      if (from) {
        const dx = from.x - pl.position.x;
        const dz = from.z - pl.position.z;
        const y = root.rotation.y;
        const l = Math.hypot(dx, dz) || 1;
        fx = (dx * Math.cos(y) - dz * Math.sin(y)) / l; // hit source, body right
        fz = (-dx * Math.sin(y) - dz * Math.cos(y)) / l; // hit source, body forward
      }
      const w = 2 * Math.PI * P.reactHz;
      this.flP[1] += k * w * fz; // velocity impulse: peaks near k
      this.flR[1] -= k * w * fx * 0.7; // + roll about forward = lean right; lean away from the source
    });
  }

  private react(s: number[], dt: number) {
    const w = 2 * Math.PI * P.reactHz;
    s[1] += (-w * w * s[0] - 2 * P.reactDamping * w * s[1]) * dt;
    s[0] += s[1] * dt;
    if (Math.abs(s[0]) < 1e-5 && Math.abs(s[1]) < 1e-4) s[0] = s[1] = 0;
    return s[0];
  }

  /**
   * @param bodyYaw rendered body yaw  @param raise 0 low-ready .. 1 aimed  @param aimPitch camera pitch (rad)
   */
  apply(dt: number, bodyYaw: number, raise: number) {
    if (dt <= 0) return;
    const p = this.ctx.player;
    this.root.updateMatrixWorld(true);
    _r.set(Math.cos(bodyYaw), 0, -Math.sin(bodyYaw)); // body right
    _f.set(-Math.sin(bodyYaw), 0, -Math.cos(bodyYaw)); // body forward

    // ---- orientation warp (aimed diagonals): legs face the travel direction, spine + chest undo it for the torso
    const warp = this.ctx.playerAnim?.hipWarp ?? 0;
    if (Math.abs(warp) > 1e-4 && this.hips) {
      rotateWorld(this.hips, UP, warp);
      if (this.spine) rotateWorld(this.spine, UP, -warp * (this.chest ? 0.5 : 1));
      if (this.chest) rotateWorld(this.chest, UP, -warp * (this.spine ? 0.5 : 1));
    }

    // ---- lean (turn rate × speed → roll; acceleration → pitch)
    let dy = bodyYaw - this.lastYaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.lastYaw = bodyYaw;
    const sp = Math.hypot(p.vel.x, p.vel.z);
    // smooth first: the sim moves at 60 Hz, a faster display would see speed in steps (jittery lean)
    this.smoothSpeed = spring(this.smoothSpeed, sp, dt, P.accelSmoothHL);
    const acc = (this.smoothSpeed - this.lastSpeed) / dt;
    this.lastSpeed = this.smoothSpeed;
    const omega = dy / dt;
    this.roll = spring(this.roll, clamp(P.leanTurn * sp * omega, -P.leanMaxDeg * DEG, P.leanMaxDeg * DEG), dt, P.leanHalflife);
    this.pitchLean = spring(this.pitchLean, clamp(P.leanAccel * acc, -P.leanAccelMaxDeg * DEG, P.leanAccelMaxDeg * DEG), dt, P.leanHalflife);
    if (this.hips) {
      rotateWorld(this.hips, _f, -this.roll * 0.4);
      rotateWorld(this.hips, _r, -this.pitchLean * 0.4);
    }
    if (this.spine) {
      rotateWorld(this.spine, _f, -this.roll * 0.6);
      rotateWorld(this.spine, _r, -this.pitchLean * 0.6);
    }

    // ---- third-person melee swing: torso twist + right-arm arc on top of the clip, held during the hit pause
    const m = this.ctx.melee;
    const swinging = (m.phase === 'windup' || m.phase === 'active' || m.phase === 'recovery') && !p.dead;
    if (!this.ctx.playerAnim?.paused) this.swing = spring(this.swing, swinging ? m.swingVis : 0, dt, P.meleeSwingHL);
    if (Math.abs(this.swing) > 1e-3) {
      const tw = this.swing * (m.heavy ? P.meleeTwistHeavyDeg : P.meleeTwistDeg) * DEG; // + = toward the left (follow-through)
      if (this.spine) rotateWorld(this.spine, UP, tw * 0.4);
      if (this.chest) rotateWorld(this.chest, UP, tw * 0.6);
      if (this.armR) {
        rotateWorld(this.armR, UP, this.swing * P.meleeArmDeg * DEG);
        rotateWorld(this.armR, _r, -Math.max(0, this.swing) * P.meleeDropDeg * DEG);
      }
    }

    // ---- hit flinch (springed, overshoots a touch and settles)
    const sub = Math.min(dt, 1 / 30);
    const fp = this.react(this.flP, sub);
    const fr = this.react(this.flR, sub);
    if (fp || fr) {
      if (this.spine) {
        rotateWorld(this.spine, _r, fp * 0.55);
        rotateWorld(this.spine, _f, fr * 0.55);
      }
      if (this.chest) {
        rotateWorld(this.chest, _r, fp * 0.45);
        rotateWorld(this.chest, _f, fr * 0.45);
      }
    }

    // ---- aim offsets (gun up) / head look (gun down)
    let yawOff = Math.atan2(Math.sin(p.yaw - bodyYaw), Math.cos(p.yaw - bodyYaw));
    yawOff = clamp(yawOff, -P.aimYawMaxDeg * DEG, P.aimYawMaxDeg * DEG);
    const pitch = clamp(p.pitch, -P.aimPitchMaxDeg * DEG, P.aimPitchMaxDeg * DEG);
    const bones = [this.spine, this.chest, this.neck];
    for (let k = 0; k < 3; k++) {
      const b = bones[k];
      if (!b) continue;
      rotateWorld(b, UP, yawOff * P.aimYawSplit[k] * raise);
      _w.set(Math.cos(bodyYaw + yawOff * raise), 0, -Math.sin(bodyYaw + yawOff * raise));
      rotateWorld(b, _w, pitch * P.aimPitchSplit[k] * raise);
    }
    const look = 1 - raise;
    if (look > 0.01 && !p.dead) {
      const ly = clamp(yawOff, -P.headLookDeg * DEG, P.headLookDeg * DEG) * look;
      const lp = clamp(pitch, -P.headPitchDeg * DEG, P.headPitchDeg * DEG) * look;
      if (this.neck) rotateWorld(this.neck, UP, ly * 0.4);
      if (this.head) rotateWorld(this.head, UP, ly * 0.6);
      _w.set(Math.cos(bodyYaw + ly), 0, -Math.sin(bodyYaw + ly));
      if (this.head) rotateWorld(this.head, _w, lp * 0.6);
    }

    // ---- foot IK + pelvis, landing dip, then foot locking
    this.footIK(dt, sp);
    this.landDip(sub);
    this.footLock(dt, sp);
  }

  /** Pelvis dips on touch-down in proportion to the fall speed and springs back; knees bend to keep the feet. */
  private landDip(dt: number) {
    const p = this.ctx.player;
    if (!p.grounded) this.airVy = Math.min(this.airVy, p.vy);
    else if (!this.wasGrounded) {
      const fall = -this.airVy;
      if (fall > 1.5) this.dip[1] -= Math.min(P.landDipMax, fall * P.landDipPerMps) * 2 * Math.PI * P.reactHz;
      this.airVy = 0;
    }
    this.wasGrounded = p.grounded;
    const d = this.react(this.dip, dt);
    if (Math.abs(d) < 1e-4 || !this.hips || this.legs.length !== 2 || !p.grounded) return;
    const feet = [this.legs[0].foot.getWorldPosition(_lf0), this.legs[1].foot.getWorldPosition(_lf1)];
    this.hips.getWorldPosition(_a);
    _a.y += Math.max(-P.landDipMax * 1.2, Math.min(0.03, d));
    this.hips.position.copy(this.hips.parent!.worldToLocal(_a));
    this.hips.updateMatrixWorld(true);
    for (let k = 0; k < 2; k++) this.solve(this.legs[k], feet[k]);
  }

  /**
   * Pin each foot in the world from touch-down to lift-off and bend the leg to it, so feet never glide while the
   * clip's short contact window and the speed match disagree by a few cm. Weight springs in fast, out over ~3 frames.
   */
  private footLock(dt: number, sp: number) {
    const p = this.ctx.player;
    const anim = this.ctx.playerAnim;
    const on =
      P.footLock && this.legs.length === 2 && p.grounded && !p.vault && !p.dead && !p.inVehicle && !(anim?.fullBody ?? false) &&
      sp > P.footLockMinSpeed && sp < P.footLockMaxSpeed;
    const rootY = this.root.position.y;
    for (const L of this.legs) {
      L.foot.getWorldPosition(_t);
      const h = _t.y - rootY;
      // lowest height in the clip, relaxing slowly so a crouch / new clip re-learns it
      L.minH = Math.min(h, L.minH + dt * 0.01);
      // hysteresis: plant below enterH, lift above enterH + exitExtra (heel-toe roll raises the ankle mid-contact)
      const planted = h < L.minH + P.footLockEnterH + (L.locked ? P.footLockExitExtra : 0);
      // toe-off: once the lock has held a moment, the clip's foot starting to travel over the ground means lift-off
      // (the ankle rises only slowly while the toe pivots, so height alone releases late and the foot snaps)
      const clipSpeed = Math.hypot(_t.x - L.prev.x, _t.z - L.prev.z) / dt;
      L.prev.copy(_t);
      L.age = L.locked ? L.age + dt : 0;
      const liftOff = L.locked && L.age > P.footLockMinHold && clipSpeed > P.footLockReleaseSpeed;
      if (!on || !planted || liftOff) L.locked = false;
      else if (!L.locked) {
        L.locked = true;
        // re-plant where the foot is drawn now (still blending out of the last lock), so nothing pops
        L.lock.set(_t.x + (L.lock.x - _t.x) * L.w, _t.y, _t.z + (L.lock.z - _t.z) * L.w);
      }
      if (L.locked && Math.hypot(L.lock.x - _t.x, L.lock.z - _t.z) > P.footLockMaxErr) L.locked = false;
      L.w = spring(L.w, L.locked ? 1 : 0, dt, L.locked ? P.footLockInHL : P.footLockOutHL);
      if (L.w < 0.01) {
        if (!L.locked) L.w = 0;
        continue;
      }
      // keep the clip's height, pin the ground position
      _lk.set(_t.x + (L.lock.x - _t.x) * L.w, _t.y, _t.z + (L.lock.z - _t.z) * L.w);
      if (_lk.distanceToSquared(_t) < 1e-6) continue;
      L.foot.getWorldQuaternion(_fq); // the planted foot keeps the clip's orientation (no toe swing from the IK)
      this.solve(L, _lk);
      L.foot.parent!.getWorldQuaternion(_pq);
      L.foot.quaternion.copy(_pq.invert().multiply(_fq));
      L.foot.updateMatrixWorld(true);
    }
  }

  private footIK(dt: number, sp: number) {
    const p = this.ctx.player;
    const on = P.footIK && this.hips && this.legs.length === 2 && p.grounded && !p.vault && !p.dead && !p.inVehicle && sp < P.footIKMaxSpeed;
    const { world } = this.ctx.game.phys;
    const feetY = p.position.y;
    const offs = [0, 0];
    if (on) {
      for (let k = 0; k < 2; k++) {
        this.legs[k].foot.getWorldPosition(_a);
        this.ray.origin = { x: _a.x, y: _a.y + 0.5, z: _a.z };
        const hit = world.castRay(this.ray, 1.0 + P.footIKReach, true, undefined, groups(Group.PLAYER, Group.STATIC | Group.TERRAIN | Group.BUILD | Group.VEHICLE), p.collider);
        const g = hit ? _a.y + 0.5 - hit.timeOfImpact : feetY;
        offs[k] = clamp(g - feetY, -P.pelvisMax, P.pelvisMax);
      }
    }
    const pelvisT = on ? clamp(Math.min(offs[0], offs[1]), -P.pelvisMax, 0) : 0;
    this.pelvis = spring(this.pelvis, pelvisT, dt, P.pelvisHalflife);
    if (!on && Math.abs(this.pelvis) < 1e-3) return;
    // Lower the hips in world space
    const hips = this.hips!;
    hips.getWorldPosition(_a);
    _a.y += this.pelvis;
    hips.position.copy(hips.parent!.worldToLocal(_a));
    hips.updateMatrixWorld(true);
    if (!on) return;
    for (let k = 0; k < 2; k++) {
      const lift = offs[k] - this.pelvis;
      if (Math.abs(lift) < 0.005) continue;
      const L = this.legs[k];
      L.foot.getWorldPosition(_t);
      _t.y += lift;
      this.solve(L, _t);
    }
  }

  /** Analytic two-bone IK in world space: bend the knee to the needed angle, then aim the thigh at the target. */
  private solve(L: Leg, target: Vector3) {
    L.thigh.getWorldPosition(_a);
    L.shin.getWorldPosition(_b);
    L.foot.getWorldPosition(_c);
    const la = _a.distanceTo(_b);
    const lb = _b.distanceTo(_c);
    const d = clamp(_a.distanceTo(target), Math.abs(la - lb) + 1e-3, la + lb - 1e-3);
    const cur = _v.subVectors(_a, _b).normalize().dot(_w.subVectors(_c, _b).normalize());
    const want = (la * la + lb * lb - d * d) / (2 * la * lb);
    const delta = Math.acos(clamp(want, -1, 1)) - Math.acos(clamp(cur, -1, 1));
    const axis = _ax.crossVectors(_e1.subVectors(_b, _a), _e2.subVectors(_c, _b));
    if (axis.lengthSq() < 1e-8) axis.copy(_r);
    axis.normalize();
    const save = L.shin.quaternion.clone();
    rotateWorld(L.shin, axis, -delta);
    L.foot.getWorldPosition(_c);
    if (Math.abs(_a.distanceTo(_c) - d) > 0.01) {
      L.shin.quaternion.copy(save);
      L.shin.updateMatrixWorld(true);
      rotateWorld(L.shin, axis, delta);
      L.foot.getWorldPosition(_c);
    }
    // Aim the thigh so the foot lands on the target
    _v.subVectors(_c, _a).normalize();
    _w.subVectors(target, _a).normalize();
    _q.setFromUnitVectors(_v, _w);
    const angle = 2 * Math.acos(clamp(_q.w, -1, 1));
    if (angle > 1e-4) {
      _ax.set(_q.x, _q.y, _q.z).normalize();
      rotateWorld(L.thigh, _ax, angle);
    }
  }
}
