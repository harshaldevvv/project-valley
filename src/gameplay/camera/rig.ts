import { MathUtils, Vector3 } from 'three';
import type { Ball } from '@dimforge/rapier3d-compat';
import { Group, groups } from '../../engine/physics';
import { cameraFeel as C, survivalFeel } from '../../content/data/player';
import type { Ctx } from '../ctx';

/**
 * Camera rig (principles §2, §4): over-shoulder third person with sphere-cast collision (snap in, ease out 300 ms),
 * shoulder swap, first person with FOV slider + head bob, ADS zoom, trauma shake (trauma² × noise), FOV kick,
 * view-punch spring (fixed step). Vehicles take over via `override`.
 */
const CAM_FILTER = Group.STATIC | Group.TERRAIN | Group.BUILD | Group.VEHICLE;
const _dir = new Vector3();
const _right = new Vector3();
const _pivot = new Vector3();
const _feet = new Vector3();
const _shoulder = new Vector3();
const _cam = new Vector3();
const _tmp = new Vector3();
const UP = new Vector3(0, 1, 0);

export class CameraRig {
  mode: 'tp' | 'fp' = 'tp';
  side = 1; // +1 right shoulder, -1 left
  sideT = 1; // eased -1..1
  arm = C.armHip; // current (collision-limited) arm length
  trauma = 0;
  fovKick = 0;
  punch = 0; // view punch, degrees (spring)
  private punchV = 0;
  private time = 0;
  private bobT = 0;
  private landDip = 0; // current landing dip amplitude (m)
  private landT = 9; // s since the landing
  private deathT = 0;
  /** Third person squeezed into first person by a wall (QA-001). */
  collapsed = false;
  /** True when the view is first person (chosen or forced by a wall). */
  get firstPerson() {
    return this.mode === 'fp' || this.collapsed;
  }
  /** Chase camera etc.; returns true if it positioned the camera. */
  override: ((dt: number) => boolean) | null = null;
  private ball: Ball;
  private ballSoft: Ball;
  private followY = 0;

  constructor(private ctx: Ctx) {
    this.ball = new ctx.game.phys.R.Ball(C.collisionRadius);
    this.ballSoft = new ctx.game.phys.R.Ball(C.collisionAnticipate);
    // Getting hit: a view punch (head snaps back) scaled by the damage; the HUD adds the trauma shake
    ctx.game.events.on('playerDamaged', ({ amount }) => this.kick(0, C.hurtPunchDeg * Math.min(1.5, 0.5 + amount / 30)));
  }

  addTrauma(t: number) {
    this.trauma = Math.min(1, this.trauma + t);
  }
  kick(fovDeg: number, punchDeg: number) {
    this.fovKick = Math.max(this.fovKick, fovDeg);
    this.punchV += punchDeg * 30;
  }

  step(dt: number) {
    const c = this.ctx.controls;
    if (!this.ctx.player.inVehicle) {
      if (c.pressed('camera')) this.mode = this.mode === 'tp' ? 'fp' : 'tp';
      if (c.pressed('shoulder')) this.side = -this.side;
    }
    const swap = (2 / C.shoulderSwap) * dt;
    this.sideT += MathUtils.clamp(this.side - this.sideT, -swap, swap);
    this.trauma = Math.max(0, this.trauma - C.traumaDecay * dt);
    this.fovKick = Math.max(0, this.fovKick - (this.fovKick / C.fovKickRecover) * dt * 2);
    // Spring: stiffness 300, damping 25 (principles §3 cosmetic view punch)
    this.punchV += (-300 * this.punch - 25 * this.punchV) * dt;
    this.punch += this.punchV * dt;
  }

  /** Shoulder pivot + collision-free camera position for a feet position (shared by aim ray and render). */
  private solve(feet: Vector3, eyeH: number, dir: Vector3, ads: number, out: Vector3, dt: number) {
    _pivot.set(feet.x, feet.y + eyeH, feet.z);
    if (this.mode === 'fp') return out.copy(_pivot);
    _right.crossVectors(dir, UP).normalize();
    _shoulder.copy(_pivot).addScaledVector(_right, (C.shoulderX + (C.shoulderXAds - C.shoulderX) * ads) * this.sideT).addScaledVector(UP, C.shoulderY);
    const want = C.armHip + (C.armAds - C.armHip) * ads;
    // Pivot -> shoulder, then shoulder -> back along the view (sphere-cast so the near plane never clips walls)
    const hitS = this.cast(_pivot, _tmp.subVectors(_shoulder, _pivot), 1);
    if (hitS < 1) _shoulder.lerpVectors(_pivot, _shoulder, Math.max(0, hitS - 0.05));
    const hit = this.cast(_shoulder, _tmp.copy(dir).multiplyScalar(-want), 1) * want;
    if (dt >= 0) {
      // A wider cast sees obstacles (posts, corners) a few frames before the real one binds: ease in toward it
      // (B2: a lamp post crossing the view used to snap the camera 0.66 m in one frame). The real cast still clamps
      // below, so the camera never enters geometry.
      const soft = Math.min(want, this.cast(_shoulder, _tmp.copy(dir).multiplyScalar(-want), 1, this.ballSoft) * want + (C.collisionAnticipate - C.collisionRadius));
      if (soft < this.arm) this.arm += (soft - this.arm) * (1 - Math.exp((-0.6931 * dt) / C.snapInHL)); // ease in
      else this.arm = Math.min(soft, this.arm + (want / C.easeOut) * dt); // ease out
      this.arm = Math.min(this.arm, want);
    }
    return out.copy(_shoulder).addScaledVector(dir, -Math.min(this.arm, hit));
  }

  private cast(from: Vector3, vel: Vector3, maxToi: number, ball = this.ball) {
    const { world, R } = this.ctx.game.phys;
    const hit = world.castShape(
      from, { x: 0, y: 0, z: 0, w: 1 }, vel, ball, 0, maxToi, true,
      R.QueryFilterFlags.EXCLUDE_SENSORS, groups(Group.PLAYER, CAM_FILTER), this.ctx.player.collider,
    );
    return hit ? hit.time_of_impact : maxToi;
  }

  /** Sim-side aim ray: camera position (no shake/punch) + look dir incl. recoil. Crosshair = truth. */
  aimRay(origin: Vector3, dir: Vector3) {
    const p = this.ctx.player;
    const w = this.ctx.weapons;
    p.lookDir(dir, w.recoilPitch, w.recoilYaw);
    this.solve(p.curr, p.eyeHeight, dir, w.adsEased, origin, -1);
    if (this.collapsed) origin.set(p.curr.x, p.curr.y + p.eyeHeight, p.curr.z);
    // Start the ray level with the player, so nothing behind the character can be hit
    if (this.mode === 'tp') {
      _pivot.set(p.curr.x, p.curr.y + p.eyeHeight, p.curr.z);
      const t = _tmp.subVectors(_pivot, origin).dot(dir);
      if (t > 0) origin.addScaledVector(dir, t);
    }
  }

  render(_alpha: number, dt: number) {
    const cam = this.ctx.game.camera;
    this.time += dt;
    if (this.override?.(dt)) return this.finish(dt);
    const p = this.ctx.player;
    const w = this.ctx.weapons;
    const ads = w.adsEased;
    p.lookDir(_dir, w.recoilPitch, w.recoilYaw);
    // TP: the pivot follows the feet's height through a short spring, so curbs, the 3 cm heightfield seam lift
    // and stair steps don't pop the view (B2); lag is capped so jumps and falls stay tight
    const dy = p.position.y - this.followY;
    if (this.mode !== 'tp' || p.inVehicle || p.dead || Math.abs(dy) > C.followYMaxLag * 4) this.followY = p.position.y;
    else {
      this.followY += dy * (1 - Math.exp((-0.6931 * dt) / C.followYHL));
      this.followY = Math.max(p.position.y - C.followYMaxLag, Math.min(p.position.y + C.followYMaxLag, this.followY));
    }
    _feet.set(p.position.x, this.followY, p.position.z);
    this.solve(_feet, p.eyeHeight, _dir, ads, _cam, dt);
    // QA-001: when a wall squeezes the arm under ~0.6 m the camera would sit in the head. Go to the eye
    // instead (body hidden, first-person viewmodel shown) until there is room again.
    _pivot.set(p.position.x, p.position.y + p.eyeHeight, p.position.z);
    const near = this.mode === 'tp' && !p.dead && _cam.distanceTo(_pivot) < (this.collapsed ? C.collapseOut : C.collapseIn);
    this.collapsed = near;
    if (near) _cam.copy(_pivot);
    if ((this.mode === 'fp' || near) && C.headBob && p.grounded) {
      const sp = Math.min(1.6, p.speed01);
      this.bobT = p.stepPhase;
      _cam.y += Math.sin(this.bobT * 2) * C.headBobAmp * sp * (1 - ads * 0.8);
      _cam.addScaledVector(_right.crossVectors(_dir, UP).normalize(), Math.cos(this.bobT) * C.headBobAmp * 0.5 * sp);
    }
    // Fracture limp: the camera dips on the injured leg's steps only (asymmetric bob)
    if (p.grounded && !p.dead && this.ctx.survival?.has('fracture')) {
      const sp = Math.min(1, p.speed01);
      _cam.y -= Math.pow(Math.max(0, Math.sin(p.stepPhase)), 2) * survivalFeel.limpDip * sp;
    }
    // Landing dip
    if (p.landed > 0) {
      this.landDip = Math.max(this.landDip * this.landShape(), p.landed * C.landDip);
      this.landT = 0;
      p.landed = 0;
    }
    this.landT += dt;
    // Eased down over landDipAttack, back up over the rest of landDipS (was a one-frame snap down; audit A10)
    _cam.y -= this.landDip * this.landShape();
    if (p.dead) {
      // QA-012: death camera rises over the body and looks down, out of the crowd
      this.deathT = Math.min(1, this.deathT + dt / 1.2);
      const k = 1 - (1 - this.deathT) ** 3;
      _tmp.set(p.position.x + Math.sin(p.yaw) * 2.5, p.position.y + C.deathCamHeight, p.position.z + Math.cos(p.yaw) * 2.5);
      cam.position.lerpVectors(_cam, _tmp, k);
      cam.lookAt(p.position.x, p.position.y + 0.3, p.position.z);
      return this.finish(dt, C.fovHip);
    }
    this.deathT = 0;
    cam.position.copy(_cam);
    cam.rotation.set(p.pitch + w.recoilPitch, p.yaw + w.recoilYaw, 0, 'YXZ');
    const base = this.firstPerson ? C.fovFp : C.fovHip;
    this.finish(dt, base + (base * (w.adsFovMul ?? C.fovAdsMul) - base) * ads);
  }

  /** Landing dip curve 0..1..0 over cameraFeel.landDipS. */
  private landShape() {
    const k = this.landT / C.landDipS, a = C.landDipAttack / C.landDipS;
    if (k >= 1) return 0;
    return k < a ? Math.sin((k / a) * Math.PI * 0.5) : 0.5 + 0.5 * Math.cos(((k - a) / (1 - a)) * Math.PI);
  }

  private finish(_dt: number, fov?: number) {
    const cam = this.ctx.game.camera;
    cam.rotation.x += MathUtils.degToRad(this.punch);
    // Shake: trauma² × smooth noise (sum of incommensurate sines ~ Perlin), up to maxShakeDeg
    const s = this.trauma * this.trauma * C.shake * MathUtils.degToRad(C.maxShakeDeg);
    if (s > 0) {
      const t = this.time * 22;
      cam.rotation.x += s * (Math.sin(t * 1.13) * 0.6 + Math.sin(t * 2.71) * 0.4);
      cam.rotation.y += s * (Math.sin(t * 1.37 + 1.7) * 0.6 + Math.sin(t * 3.1) * 0.4);
      cam.rotation.z += s * 0.6 * Math.sin(t * 1.9 + 4.1);
    }
    const f = (fov ?? cam.fov) + this.fovKick;
    if (fov !== undefined && Math.abs(cam.fov - f) > 1e-3) {
      cam.fov = f;
      cam.updateProjectionMatrix();
    }
  }
}

declare module '../ctx' {
  interface Ctx {
    rig: CameraRig;
  }
}
