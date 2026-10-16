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
  private landDip = 0;
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

  constructor(private ctx: Ctx) {
    this.ball = new ctx.game.phys.R.Ball(C.collisionRadius);
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
      if (hit < this.arm) this.arm = hit; // snap in
      else this.arm = Math.min(hit, this.arm + (want / C.easeOut) * dt); // ease out
      this.arm = Math.min(this.arm, want);
    }
    return out.copy(_shoulder).addScaledVector(dir, -Math.min(this.arm, hit));
  }

  private cast(from: Vector3, vel: Vector3, maxToi: number) {
    const { world, R } = this.ctx.game.phys;
    const hit = world.castShape(
      from, { x: 0, y: 0, z: 0, w: 1 }, vel, this.ball, 0, maxToi, true,
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
    this.solve(p.position, p.eyeHeight, _dir, ads, _cam, dt);
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
      this.landDip = Math.max(this.landDip, p.landed * 0.12);
      p.landed = 0;
    }
    this.landDip = Math.max(0, this.landDip - dt * 0.6);
    _cam.y -= Math.sin(Math.min(1, this.landDip / 0.12) * Math.PI * 0.5) * this.landDip;
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
    this.finish(dt, base + (base * C.fovAdsMul - base) * ads);
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
