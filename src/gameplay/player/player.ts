import { Vector3 } from 'three';
import type { Collider, KinematicCharacterController, RigidBody } from '@dimforge/rapier3d-compat';
import { Group, groups } from '../../engine/physics';
import { health as HD, movement as M, stamina as SD } from '../../content/data/player';
import { animPost as AP } from '../../content/data/anim';
import { look as L } from '../../content/data/input';
import { hurtMuffle as HM } from '../../content/data/sounds';
import { yard } from '../../content/data/yard';
import type { PlayerView } from '../../core/contracts';
import type { Ctx } from '../ctx';
import { Stamina } from './stamina';
import { weaponSlots } from '../../content/data/weapons';
import { surfaceOf } from '../../world/surfaces';

/**
 * Player controller v1 (principles §2): Rapier kinematic capsule with our own velocity state,
 * acceleration curves, stamina, crouch, coyote/buffered jump, context vault, footstep noise, health/respawn.
 * Sim runs in step(); render() only interpolates.
 */
const WORLD_FILTER = Group.STATIC | Group.TERRAIN | Group.ZOMBIE | Group.VEHICLE | Group.BUILD | Group.DEBRIS;
const _v = new Vector3();
const _w = new Vector3();

export type Gait = 'idle' | 'walk' | 'jog' | 'sprint' | 'crouch';

export class Player implements PlayerView {
  // --- PlayerView ---
  readonly position = new Vector3(); // interpolated feet
  readonly eye = new Vector3();
  readonly forward = new Vector3(0, 0, -1);
  inVehicle = false;
  godMode = false;

  // --- sim state (plain data) ---
  readonly prev = new Vector3();
  readonly curr = new Vector3(); // feet
  readonly vel = new Vector3(); // horizontal m/s
  vy = 0;
  yaw = 0;
  pitch = -0.1;
  grounded = true;
  crouched = false;
  crouchT = 0; // 0..1 eased, for eye height + visuals
  sprinting = false;
  gait: Gait = 'idle';
  hp = HD.max;
  dead = false;
  deadT = 0;
  invulnT = 0;
  readonly stamina = new Stamina();
  /** Set by weapons each tick (ADS slow-down, reload). */
  speedMul = 1;
  /** Movement locked (finisher, vehicle). */
  locked = false;
  /** True while sprint input should be ignored (ADS etc. set by weapons). */
  blockSprint = false;
  /** M2 survival: move-speed multiplier and sprint permission (fracture), set every tick by SurvivalGlue. */
  survivalSpeed = 1;
  sprintAllowed = true;
  /** Using an item (bandage, food): walk speed, no sprint. */
  usingItem = false;
  /** Weapon slot in hand (systems' death bag reads this). */
  get heldSlot() {
    return this.ctx.weapons ? weaponSlots[this.ctx.weapons.slot] : 'primary';
  }
  vault: { t: number; from: Vector3; to: Vector3; peak: number } | null = null;
  landed = 0; // landing dip impulse (camera), 0..1
  stepPhase = 0; // walk cycle (rad) for bob/legs
  lastFall = 0;
  private sinceGround = 0;
  private sinceJumpPress = 9;
  private strideAcc = 0;

  readonly body: RigidBody;
  readonly collider: Collider;
  private kcc: KinematicCharacterController;

  constructor(private ctx: Ctx) {
    const { R, world } = ctx.game.phys;
    const s = yard.spawn;
    this.curr.set(s.x, 0.05, s.z);
    this.prev.copy(this.curr);
    this.yaw = s.yaw;
    this.body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(s.x, M.halfHeight + M.radius, s.z));
    this.collider = world.createCollider(
      R.ColliderDesc.capsule(M.halfHeight, M.radius).setCollisionGroups(groups(Group.PLAYER, WORLD_FILTER | Group.PROJECTILE)),
      this.body,
    );
    this.kcc = world.createCharacterController(0.02);
    this.kcc.enableAutostep(M.stepHeight, 0.2, false);
    this.kcc.enableSnapToGround(0.3);
    this.kcc.setMaxSlopeClimbAngle((M.maxSlopeDeg * Math.PI) / 180);
    this.kcc.setApplyImpulsesToDynamicBodies(true);
  }

  get halfHeight() {
    return this.crouched ? M.crouchHalfHeight : M.halfHeight;
  }
  get eyeHeight() {
    return M.eyeStand + (M.eyeCrouch - M.eyeStand) * this.crouchT;
  }
  /** Horizontal speed / jog speed. */
  get speed01() {
    return Math.hypot(this.vel.x, this.vel.z) / M.jog;
  }

  // --- PlayerView API ---
  teleport(p: Vector3, yaw?: number) {
    this.curr.copy(p);
    this.prev.copy(p);
    this.position.copy(p);
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.vault = null;
    if (yaw !== undefined) this.yaw = yaw;
    this.syncBody();
    this.body.setTranslation(this.body.translation(), true);
  }
  setLook(yaw: number, pitch: number) {
    this.yaw = yaw;
    this.pitch = Math.max(L.pitchMin, Math.min(L.pitchMax, pitch));
  }
  /** Look direction from yaw/pitch (+ optional recoil offsets, radians). */
  lookDir(out: Vector3, pitchAdd = 0, yawAdd = 0) {
    const p = this.pitch + pitchAdd;
    const y = this.yaw + yawAdd;
    return out.set(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
  }

  damage(amount: number, from: Vector3 | null) {
    if (this.dead || this.godMode || this.invulnT > 0 || this.inVehicle) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnT = HD.hitIframes;
    // Moving: the procedural flinch (bodyPost) reads alone; the full-body clip would freeze the running legs
    if (this.hp > 0 && Math.hypot(this.vel.x, this.vel.z) < AP.hitClipMaxSpeed) this.ctx.playerAnim?.oneshot('hit_react', 0.05);
    this.ctx.game.events.emit('playerDamaged', { amount, from: from ? from.clone() : null });
    if (amount >= HM.minDamage) this.ctx.game.audio.muffle(HM.hz, HM.holdS, HM.releaseS);
    if (this.hp <= 0) {
      this.dead = true;
      this.deadT = HD.respawnDelay;
      this.ctx.game.events.emit('playerDied', { cause: 'attack' }); // the HUD death card says it (no toast)
    }
    return true;
  }

  get maxHp() {
    return HD.max;
  }

  heal(amount: number) {
    if (this.dead) return;
    this.hp = Math.min(HD.max, this.hp + amount);
  }

  /** Non-directional damage (bleeding, starvation, infection): no i-frames, no hit flinch. */
  hurt(amount: number, cause: string) {
    if (this.dead || this.godMode || amount <= 0) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.dead = true;
      this.deadT = HD.respawnDelay;
      this.ctx.game.events.emit('playerDied', { cause });
    }
  }

  syncBody() {
    const hh = this.halfHeight;
    this.body.setNextKinematicTranslation({ x: this.curr.x, y: this.curr.y + hh + M.radius, z: this.curr.z });
  }

  step(dt: number) {
    const c = this.ctx.controls;
    this.prev.copy(this.curr);
    if (this.invulnT > 0) this.invulnT -= dt;

    // Look (always, even dead, so the camera stays alive)
    const [mx, my] = c.takeLook();
    const sens = L.sensitivity * this.lookSensMul;
    this.yaw -= mx * sens;
    this.pitch = Math.max(L.pitchMin, Math.min(L.pitchMax, this.pitch - my * sens));
    this.lookDir(this.forward);

    if (this.dead) {
      this.vel.set(0, 0, 0);
      if ((this.deadT -= dt) <= 0) this.respawn();
      return;
    }
    if (this.inVehicle || this.locked) {
      this.vel.multiplyScalar(0);
      this.stamina.step(dt);
      if (!this.inVehicle) this.syncBody();
      return;
    }
    if (this.vault) return this.stepVault(dt);

    // Crouch toggle (stand only when there's headroom)
    if (c.pressed('crouch')) {
      if (!this.crouched) this.setCrouch(true);
      else if (this.headroom()) this.setCrouch(false);
    }
    this.crouchT += ((this.crouched ? 1 : 0) - this.crouchT) * Math.min(1, dt * 12);

    // Desired velocity
    const f = (c.down('forward') ? 1 : 0) - (c.down('back') ? 1 : 0);
    const s = (c.down('right') ? 1 : 0) - (c.down('left') ? 1 : 0);
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    _v.set(-sin * f + cos * s, 0, -cos * f - sin * s);
    const moving = _v.lengthSq() > 0;
    if (moving) _v.normalize();
    const wantSprint = c.down('sprint') && f > 0 && !this.crouched && !this.blockSprint && this.sprintAllowed && !this.usingItem && this.stamina.canSprint;
    if (wantSprint && this.crouched) this.setCrouch(false);
    this.sprinting = wantSprint && moving && this.grounded;
    let speed = this.crouched ? M.crouch : this.sprinting ? M.sprint : M.jog;
    if (f < 0 && !this.crouched) speed *= 0.8; // backpedal
    speed *= this.speedMul * this.survivalSpeed;
    if (this.usingItem) speed = Math.min(speed, M.walk);
    if (f < 0 && this.speedMul < 0.95) speed = Math.min(speed, M.backAimMax);
    _v.multiplyScalar(moving ? speed : 0);

    // Accelerate toward desired (separate up/down rates, sprint ramp, air control)
    const cur = Math.hypot(this.vel.x, this.vel.z);
    const target = _v.length();
    let rate = target >= cur ? (target > M.jog ? (M.sprint - M.jog) / M.sprintRamp + M.jog / M.accelTime : M.jog / M.accelTime) : M.jog / M.stopTime;
    if (!this.grounded) rate *= M.airControl;
    _w.subVectors(_v, this.vel);
    const dv = _w.length();
    const maxDv = rate * dt;
    if (dv > maxDv) _w.multiplyScalar(maxDv / dv);
    this.vel.add(_w);

    if (this.sprinting) this.stamina.drain(SD.sprintPerSec, dt);
    this.stamina.step(dt);

    // Jump / vault (buffer + coyote)
    this.sinceGround = this.grounded ? 0 : this.sinceGround + dt;
    this.sinceJumpPress = c.pressed('jump') ? 0 : this.sinceJumpPress + dt;
    if (this.sinceJumpPress <= M.jumpBuffer && this.sinceGround <= M.coyote) {
      this.sinceJumpPress = 9;
      if (!this.tryVault() && this.stamina.spend(SD.jump)) {
        if (this.crouched && this.headroom()) this.setCrouch(false);
        this.vy = M.jumpVelocity;
        this.ctx.playerAnim?.oneshot('jump', 0.08);
        this.sinceGround = 9;
        this.grounded = false;
        this.ctx.sfx('footstep_concrete', this.curr, { volume: 0.6 });
      }
      if (this.vault) return;
    }
    this.vy -= M.gravity * dt;
    if (this.vy < -40) this.vy = -40;

    // Move with the KCC
    _w.set(this.vel.x * dt, this.vy * dt, this.vel.z * dt);
    const wasGrounded = this.grounded;
    const { QueryFilterFlags } = this.ctx.game.phys.R;
    const filt = groups(Group.PLAYER, WORLD_FILTER);
    this.kcc.computeColliderMovement(this.collider, _w, QueryFilterFlags.EXCLUDE_SENSORS, filt);
    let m = this.kcc.computedMovement();
    // Rapier quirk: at heightfield cell edges the controller sometimes returns ~zero horizontal movement while the only
    // contact is flat floor, a one-tick stop every few metres. Retry once with a small lift (snap-to-ground lands it).
    const want = Math.hypot(_w.x, _w.z);
    if (want > 1e-4 && Math.hypot(m.x, m.z) < want * 0.25 && this.grounded) {
      let floorOnly = this.kcc.numComputedCollisions() > 0;
      for (let i = 0; i < this.kcc.numComputedCollisions(); i++) {
        const col = this.kcc.computedCollision(i);
        if (col && col.normal1.y <= M.wallNormalY) floorOnly = false;
      }
      if (floorOnly) {
        _w.y = Math.max(_w.y, 0) + M.seamLift;
        this.kcc.computeColliderMovement(this.collider, _w, QueryFilterFlags.EXCLUDE_SENSORS, filt);
        m = this.kcc.computedMovement();
      }
    }
    this.curr.x += m.x;
    this.curr.y += m.y;
    this.curr.z += m.z;
    this.grounded = this.kcc.computedGrounded();
    // Bonk head; walls: remove only the velocity component pushing into steep contacts (slide along them).
    // The old rule scaled velocity by moved/desired per axis, so one tick of a trimesh seam, an autostep probe or a
    // snap-to-ground correction zeroed the speed and the player stopped dead on flat ground, then re-accelerated.
    if (dt > 0) {
      if (m.y < this.vy * dt * 0.5 && this.vy > 0) this.vy = 0;
      const n = this.kcc.numComputedCollisions();
      for (let i = 0; i < n; i++) {
        const col = this.kcc.computedCollision(i);
        if (!col) continue;
        const { x: nx, y: ny, z: nz } = col.normal1; // outward normal of the obstacle
        if (ny > M.wallNormalY) continue; // ground, ramps, step edges
        const hl = Math.hypot(nx, nz);
        if (hl < 1e-4) continue;
        const ux = nx / hl;
        const uz = nz / hl;
        const into = this.vel.x * ux + this.vel.z * uz;
        if (into < 0) {
          this.vel.x -= ux * into;
          this.vel.z -= uz * into;
        }
      }
    }
    if (this.grounded) {
      if (!wasGrounded && this.vy < -2) this.land(-this.vy);
      if (this.vy < 0) this.vy = 0;
    }
    if (this.curr.y < -20) this.respawn(); // fell out of the world
    this.syncBody();

    // Gait + footsteps (sound + AI noise)
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.gait = sp < 0.3 ? 'idle' : this.crouched ? 'crouch' : this.sprinting ? 'sprint' : sp < 2.2 ? 'walk' : 'jog';
    this.stepPhase += (sp / M.stride) * Math.PI * dt;
    if (this.grounded && sp > 0.3) {
      this.strideAcc += sp * dt;
      const stride = M.stride * (this.sprinting ? 1.25 : this.crouched ? 0.7 : 1);
      if (this.strideAcc >= stride) {
        this.strideAcc = 0;
        this.footstep();
      }
    }
  }

  private get lookSensMul() {
    const w = this.ctx.weapons;
    if (!w) return 1;
    // Magnified optics (4x scope, red dot) slow the look in proportion to the zoom, so aim feels the same at any FOV
    const optic = 1 + ((w.adsFovMul ?? 1) - 1) * w.adsEased;
    return (1 + (L.adsSensitivityMul - 1) * w.adsEased) * optic;
  }

  private footstep() {
    const radius =
      this.gait === 'sprint' ? M.noiseSprint : this.gait === 'jog' ? M.noiseJog : this.gait === 'crouch' ? M.noiseCrouch : M.noiseWalk;
    const vol = this.gait === 'crouch' ? 0.25 : this.gait === 'sprint' ? 0.9 : 0.55;
    this.ctx.sfx(this.surfaceBelow() === 'grass' ? 'footstep_grass' : 'footstep_concrete', this.curr, { volume: vol, pitchJitter: 0.08 });
    this.ctx.game.events.emit('noise', { position: this.curr.clone(), radius, source: 'footstep' });
    if (this.gait === 'sprint' || this.gait === 'jog') this.ctx.fx.footDust(this.curr, this.gait === 'sprint' ? 1 : 0.5, this.surfaceBelow() === 'grass');
  }

  private land(speed: number) {
    this.lastFall = speed;
    this.landed = Math.min(1, speed / 12);
    if (speed > AP.landClipMinFall && Math.hypot(this.vel.x, this.vel.z) < AP.landClipMaxSpeed) this.ctx.playerAnim?.oneshot('land', 0.05); // running on: bodyPost's dip only
    this.ctx.sfx('jump_land', this.curr, { volume: Math.min(1, 0.3 + speed / 12) });
    if (speed > 3) this.ctx.fx.footDust(this.curr, Math.min(1, speed / 8), this.surfaceBelow() === 'grass');
    if (speed > M.hardLandSpeed) this.ctx.game.events.emit('noise', { position: this.curr.clone(), radius: M.landNoise, source: 'land' });
  }

  surfaceBelow(): 'grass' | 'concrete' {
    const { R, world } = this.ctx.game.phys;
    const hit = world.castRay(
      new R.Ray({ x: this.curr.x, y: this.curr.y + 0.3, z: this.curr.z }, { x: 0, y: -1, z: 0 }),
      1,
      true,
      undefined,
      groups(Group.PLAYER, Group.STATIC | Group.TERRAIN | Group.BUILD | Group.VEHICLE),
    );
    if (!hit) return 'grass';
    // Environment surface tags: soft ground (grass/dirt) vs hard (concrete, wood, metal…)
    const s = surfaceOf(hit.collider.handle, this.curr.x, this.curr.z);
    if (s) return s === 'grass' || s === 'dirt' ? 'grass' : 'concrete';
    return (hit.collider.collisionGroups() >>> 16) & Group.TERRAIN ? 'grass' : 'concrete';
  }

  private setCrouch(on: boolean) {
    this.crouched = on;
    this.collider.setHalfHeight(this.halfHeight);
    this.syncBody();
  }

  private headroom() {
    const { R, world } = this.ctx.game.phys;
    const hit = world.castRay(
      new R.Ray({ x: this.curr.x, y: this.curr.y + M.crouchHalfHeight * 2 + M.radius * 2 - 0.05, z: this.curr.z }, { x: 0, y: 1, z: 0 }),
      (M.halfHeight - M.crouchHalfHeight) * 2 + 0.1,
      true,
      undefined,
      groups(Group.PLAYER, WORLD_FILTER),
      this.collider,
    );
    return !hit;
  }

  /** Context vault (principles §2): obstacle 0.5–1.3 m tall, ≤ 0.6 m thick, ahead within reach. */
  private tryVault(): boolean {
    const { R, world } = this.ctx.game.phys;
    const filt = groups(Group.PLAYER, Group.STATIC | Group.BUILD | Group.VEHICLE | Group.DEBRIS);
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp < 0.5) return false;
    // Several heights: tables and fences are open underneath
    let d = Infinity;
    for (const hy of [0.3, 0.6, 0.9, 1.2]) {
      const hit = world.castRay(new R.Ray({ x: this.curr.x, y: this.curr.y + hy, z: this.curr.z }, { x: fx, y: 0, z: fz }), M.vaultReach + M.radius, true, undefined, filt, this.collider);
      if (hit && hit.timeOfImpact < d) d = hit.timeOfImpact;
    }
    if (d === Infinity) return false;
    // Top of the obstacle just past the hit face
    const px = this.curr.x + fx * (d + 0.12);
    const pz = this.curr.z + fz * (d + 0.12);
    const top = world.castRay(new R.Ray({ x: px, y: this.curr.y + M.vaultMax + 0.5, z: pz }, { x: 0, y: -1, z: 0 }), M.vaultMax + 0.5, true, undefined, filt);
    if (!top) return false;
    const topY = this.curr.y + M.vaultMax + 0.5 - top.timeOfImpact;
    const h = topY - this.curr.y;
    if (h < M.vaultMin - 0.05 || h > M.vaultMax + 0.05) return false;
    // Headroom above the obstacle (crouched capsule must fit)
    const above = world.castRay(new R.Ray({ x: px, y: topY + 0.05, z: pz }, { x: 0, y: 1, z: 0 }), 1.2, true, undefined, filt);
    if (above) return false;
    // Thin? land on the far side; thick -> mantle onto the top.
    const farD = d + M.vaultMaxThick + M.radius + 0.25;
    const fxp = this.curr.x + fx * farD;
    const fzp = this.curr.z + fz * farD;
    const far = world.castRay(new R.Ray({ x: fxp, y: topY + 0.2, z: fzp }, { x: 0, y: -1, z: 0 }), 6, true, undefined, groups(Group.PLAYER, filt | Group.TERRAIN));
    const farY = far ? topY + 0.2 - far.timeOfImpact : this.curr.y;
    const thin = farY < topY - 0.3;
    if (!this.stamina.spend(SD.vault)) return false;
    const to = thin ? new Vector3(fxp, farY + 0.02, fzp) : new Vector3(px + fx * 0.3, topY + 0.02, pz + fz * 0.3);
    this.vault = { t: 0, from: this.curr.clone(), to, peak: topY + 0.15 };
    this.ctx.playerAnim?.oneshot('jump', 0.05);
    this.collider.setEnabled(false);
    this.vy = 0;
    this.ctx.sfx('jump_land', this.curr, { volume: 0.5, pitchJitter: 0.1 });
    this.ctx.game.events.emit('noise', { position: this.curr.clone(), radius: M.noiseJog, source: 'vault' });
    return true;
  }

  private stepVault(dt: number) {
    const v = this.vault!;
    v.t += dt / M.vaultTime;
    const t = Math.min(1, v.t);
    this.curr.lerpVectors(v.from, v.to, t);
    // Up-and-over arc: fast rise (sqrt of a sine), peak mid-way just above the obstacle top
    const mid = (v.from.y + v.to.y) / 2;
    this.curr.y += (v.peak - mid) * Math.sqrt(Math.sin(Math.PI * t));
    this.syncBody();
    this.stamina.step(dt);
    if (t >= 1) {
      this.vault = null;
      this.collider.setEnabled(true);
      this.grounded = true;
      this.land(3);
    }
  }

  respawn() {
    if (this.dead) this.ctx.game.events.emit('playerRespawned', {});
    this.dead = false;
    this.hp = HD.max;
    this.stamina.value = SD.max;
    this.stamina.exhausted = false;
    this.invulnT = 1;
    if (this.crouched) this.setCrouch(false);
    this.teleport(new Vector3(yard.spawn.x, 0.05, yard.spawn.z), yard.spawn.yaw);
    this.pitch = 0; // level view after the death cam (QA-063)
  }

  /** Interpolate for rendering. */
  render(alpha: number) {
    this.position.lerpVectors(this.prev, this.curr, alpha);
    this.eye.copy(this.position).setY(this.position.y + this.eyeHeight);
  }
}

declare module '../ctx' {
  interface Ctx {
    player: Player;
  }
}
