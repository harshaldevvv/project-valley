import { MathUtils, Object3D, Vector3 } from 'three';
import type { Collider } from '@dimforge/rapier3d-compat';
import { Group, groups } from '../../engine/physics';
import type { ItemInstance, SlotName, WeaponDef } from '../../content/data/types';
import type { LoadoutApi } from '../../core/contracts';
import { ballistics as B, fpArms, handling as H, meleeDefs, weaponDefs, weaponFeel, weaponSlots } from '../../content/data/weapons';
import { impacts, weaponFx } from '../../content/data/fx';
import { surfaceOf as worldSurface } from '../../world/surfaces';
import { bodyFacing as BF, cameraFeel } from '../../content/data/player';
import { probe, type Ctx, type Surface } from '../ctx';
import { addBloom, decayBloom, easeOutCubic, falloffMul, recoilKick, recover, shotInterval, spreadDeg } from './math';
import { makeWeaponModel, type WeaponModel } from './models';
import { Viewmodel, type FpKind } from './viewmodel';

/**
 * Weapons runtime (principles §3/§4): fire (semi/auto, RPM cap), per-tick segment-raycast ballistics,
 * falloff, learnable recoil + recovery (fixed step), spread/bloom, ADS, tactical/empty reload with mag commit
 * at 70 %, dry fire, fire modes, switching 1–4 with holster/draw, durability, and the shot juice.
 */
const BULLET_FILTER = Group.STATIC | Group.TERRAIN | Group.ZOMBIE | Group.VEHICLE | Group.BUILD | Group.DEBRIS;
const MAX_BULLETS = 64;
const EMPTY_TOAST = 'Empty — press R';
/** Wire-mesh colliders (environment tags them 'chainlink'): bullets and the aim ray see through them. */
const isMesh = (c: Collider) => (worldSurface(c.handle) as string | null) === 'chainlink';
const notMesh = (c: Collider) => !isMesh(c);
const DEG = Math.PI / 180;

interface Bullet {
  alive: boolean;
  pos: Vector3;
  vel: Vector3;
  life: number;
  dist: number;
  def: WeaponDef;
}

/** Sandbox loadout when systems hasn't installed one: pistol + rifle + knife, infinite full mags. */
export function sandboxLoadout(): LoadoutApi {
  let uid = 1e6;
  const mag = (defId: string, n: number): ItemInstance => ({ uid: uid++, defId, count: 1, rounds: n });
  const gun = (defId: string, magId: string, n: number): ItemInstance => ({ uid: uid++, defId, count: 1, durability: 1, rounds: 1, mag: mag(magId, n - 1) });
  const slots: Partial<Record<SlotName, ItemInstance>> = {
    primary: gun('rifle_a', 'mag_rifle_a', 30),
    sidearm: gun('pistol_a', 'mag_pistol_a', 15),
    melee: { uid: uid++, defId: 'knife_a', count: 1, durability: 1 },
  };
  return {
    equipped: (s) => slots[s] ?? null,
    takeMagazine: (w) => mag(w.defId === 'rifle_a' ? 'mag_rifle_a' : 'mag_pistol_a', weaponFeel[w.defId]?.magSize ?? 15),
    give: () => {},
    consume: () => 0,
    count: () => 99,
  };
}

export interface ShotRecord {
  distance: number;
  zone: string;
  damage: number;
  target: string;
}

const _o = new Vector3();
const _d = new Vector3();
const _muz = new Vector3();
const _r = new Vector3();
const _u = new Vector3();
const _n = new Vector3();
const _p = new Vector3();
const UP = new Vector3(0, 1, 0);

export class Weapons {
  loadout: LoadoutApi;
  sandbox: boolean;
  slot = 0; // index into weaponSlots
  item: ItemInstance | null = null;
  def: WeaponDef | null = null;
  // handling state
  adsT = 0; // linear 0..1
  adsEased = 0;
  bloom = 0;
  private recoilP = 0; // rad, recovering offset
  private recoilY = 0;
  private swayP = 0;
  private swayY = 0;
  private shotIdx = 0;
  private sinceShot = 9;
  private cooldown = 0;
  private sinceSprint = 9;
  private semiBuffered = 0;
  switchT = 0; // >0 while holstering/drawing
  switchPhase: 'none' | 'holster' | 'draw' = 'none';
  private nextSlot = 0;
  drawTotal = 0.4;
  reload: { t: number; total: number; empty: boolean; committed: boolean; outPlayed: boolean; inPlayed: boolean } | null = null;
  readonly fireModes = new Map<number, 'semi' | 'auto'>();
  spread = 3; // current cone, degrees (HUD)
  blocked = false; // muzzle obstructed (HUD reticle)
  kickT = 0; // weapon model kick 0..1
  lastShot: ShotRecord | null = null;
  shotsFired = 0;
  private time = 0;
  private bullets: Bullet[] = [];
  private ray;
  private pendingFlash = false;
  private flashDir = new Vector3();
  private aimHit = new Vector3();
  private models = new Map<string, { tp: WeaponModel; fp: WeaponModel }>();
  readonly fpHolder = new Object3D(); // child of the camera (legacy viewmodel, no arms)
  readonly vm = new Viewmodel();
  private legacyDummy = new Object3D();
  private sprintT = 0;
  private trailOn = false;
  /** 0 = low-ready, 1 = raised to aim (third-person carry pose). */
  raiseT = 0;
  private aimMiss = false;
  private swayLag = new Vector3();
  private lastYaw = 0;
  private lastPitch = 0;

  constructor(private ctx: Ctx) {
    const real = probe(ctx.game, 'loadout', 'equipped');
    this.loadout = real ?? sandboxLoadout();
    this.sandbox = !real;
    const { R } = ctx.game.phys;
    this.ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
    for (let i = 0; i < MAX_BULLETS; i++)
      this.bullets.push({ alive: false, pos: new Vector3(), vel: new Vector3(), life: 0, dist: 0, def: weaponDefs.pistol_a });
    ctx.game.camera.add(this.fpHolder);
    // Respawn with the weapon you died holding (or the first filled slot) (QA-063)
    let heldSlot = 0;
    ctx.game.events.on('playerDied', () => (heldSlot = this.slot));
    ctx.game.events.on('playerRespawned', () => {
      for (const i of [heldSlot, 0, 2, 1, 3])
        if (this.loadout.equipped(weaponSlots[i])) {
          this.cancelReload();
          this.select(i);
          return;
        }
    });
    if (!ctx.game.camera.parent) ctx.game.scene.add(ctx.game.camera);
  }

  async init(handSocket: Object3D) {
    await this.vm.init(this.ctx.game.camera);
    const kinds: Record<string, 'pistol' | 'rifle' | 'knife'> = { pistol_a: 'pistol', rifle_a: 'rifle', knife_a: 'knife' };
    for (const id of Object.keys(kinds)) {
      const model = weaponFeel[id]?.model ?? meleeDefs[id]?.model;
      const [tp, fp] = await Promise.all([makeWeaponModel(id, model, kinds[id]), makeWeaponModel(id, model, kinds[id])]);
      tp.root.visible = fp.root.visible = false;
      fp.root.traverse((o) => (o.castShadow = false));
      handSocket.add(tp.root);
      if (this.vm.ready) this.vm.attach(id, kinds[id], fp);
      else this.fpHolder.add(fp.root); // legacy offsets until chr_arms_fp is built
      this.models.set(id, { tp, fp });
    }
    // Start with the first non-empty slot (primary, then sidearm…)
    const order = [0, 2, 1, 3];
    for (const i of order)
      if (this.loadout.equipped(weaponSlots[i])) {
        this.slot = this.nextSlot = i;
        break;
      }
    this.equip();
    this.switchPhase = 'draw';
    this.switchT = this.drawTotal;
  }

  get recoilPitch() {
    return this.recoilP + this.swayP;
  }
  get recoilYaw() {
    return this.recoilY + this.swayY;
  }
  /** Viewmodel clip family for the held item. */
  get fpKind(): FpKind {
    return this.isMelee ? 'knife' : this.def?.class === 'pistol' ? 'pistol' : 'rifle';
  }
  get isMelee() {
    return !!this.item && !!meleeDefs[this.item.defId];
  }
  get ready() {
    return this.switchPhase === 'none' && !this.reload;
  }
  fireMode(): 'semi' | 'auto' {
    if (!this.item || !this.def) return 'semi';
    return this.fireModes.get(this.item.uid) ?? this.def.fireModes[0];
  }
  /** Rounds in the magazine + chamber, and the reserve (HUD). */
  ammo(): { mag: number; chamber: number; reserve: number } | null {
    if (!this.item || !this.def) return null;
    const magId = Array.isArray(this.def.magazines) ? this.def.magazines[0] : '';
    let reserve = 0;
    try {
      reserve = this.sandbox ? Infinity : this.loadout.count(magId);
    } catch {
      reserve = 0;
    }
    return { mag: this.item.mag?.rounds ?? 0, chamber: this.item.rounds ?? 0, reserve };
  }

  private equip() {
    this.item = this.loadout.equipped(weaponSlots[this.slot]);
    this.def = this.item ? (weaponDefs[this.item.defId] ?? null) : null;
    if (this.item && this.item.durability === undefined) this.item.durability = 1;
    // Weapons found with a loaded mag come chambered (systems doesn't track the chamber)
    if (this.item && this.def && this.item.rounds === undefined) {
      this.item.rounds = 0;
      if (this.item.mag && (this.item.mag.rounds ?? 0) > 0) {
        this.item.mag.rounds!--;
        this.item.rounds = 1;
      }
    }
    const feel = this.item ? weaponFeel[this.item.defId] : null;
    this.drawTotal = feel ? feel.drawMs / 1000 : 0.35;
    for (const [id, m] of this.models) m.tp.root.visible = m.fp.root.visible = id === this.item?.defId;
    this.vm.setKind(this.fpKind);
    this.shotIdx = 0;
    this.bloom = 0;
  }

  /** Begin switching to slot index i (holster -> draw). */
  select(i: number) {
    if (i === this.slot && this.switchPhase === 'none' && this.item) return;
    if (!this.loadout.equipped(weaponSlots[i])) {
      this.ctx.game.events.emit('toast', { text: `Nothing in ${weaponSlots[i]}` });
      return;
    }
    this.cancelReload();
    this.nextSlot = i;
    if (this.def) this.ctx.playerAnim?.overlay(this.def.class === 'pistol' ? 'holster' : 'holster_rifle', 1, true);
    if (this.item && this.fpKind !== 'knife') this.vm.play(`fp_${this.fpKind}_holster`, { seconds: H.holsterS });
    this.switchPhase = this.item ? 'holster' : 'draw';
    this.switchT = this.item ? H.holsterS : this.drawTotal;
    if (!this.item) {
      this.slot = i;
      this.equip();
      this.switchT = this.drawTotal;
    }
    this.ctx.sfx('reload_mag_out', undefined, { volume: 0.25, pitchJitter: 0.1 });
  }

  /** Complete a reload now (getting into a car mid-reload finishes it instead of silently dropping it, QA-051). */
  finishReload() {
    const r = this.reload;
    if (!r) return;
    r.t = Math.max(r.t, r.total * B.magCommitAt);
    r.outPlayed = r.inPlayed = true;
    this.stepReload(0); // commits the magazine
    r.t = r.total;
    this.stepReload(0); // chambers if it was empty
    this.vm.stop();
  }

  cancelReload() {
    if (this.reload) this.vm.stop();
    this.reload = null;
  }

  step(dt: number) {
    const c = this.ctx.controls;
    const p = this.ctx.player;
    this.time += dt;
    const g = this.ctx.game;
    const building = this.isBuilding();
    const busy = p.dead || p.inVehicle || building || this.ctx.melee?.busy;

    // Equipment may change under us (inventory): re-read the slot item each tick.
    const cur = this.loadout.equipped(weaponSlots[this.slot]);
    if (cur !== this.item && this.switchPhase === 'none') this.equip();

    // Slot keys
    if (!p.inVehicle && !building) {
      if (c.pressed('primary')) this.select(0);
      if (c.pressed('secondary')) this.select(1);
      if (c.pressed('sidearm')) this.select(2);
      if (c.pressed('melee')) this.select(3);
    }
    if (this.switchPhase !== 'none') {
      this.switchT -= dt;
      if (this.switchT <= 0) {
        if (this.switchPhase === 'holster') {
          this.slot = this.nextSlot;
          this.equip();
          this.switchPhase = 'draw';
          this.switchT = this.drawTotal;
          if (this.def) this.ctx.playerAnim?.overlay(`draw_${this.def.class === 'pistol' ? 'pistol' : 'rifle'}`, 1, true);
          this.vm.play(`fp_${this.fpKind}_draw`, { seconds: this.drawTotal });
          this.ctx.sfx('bolt_rack', undefined, { volume: 0.35, pitchJitter: 0.1 });
        } else this.switchPhase = 'none';
      }
    }

    // Sprint bookkeeping (sprint-to-fire, sprint cancels ADS and reload)
    if (p.sprinting) {
      this.sinceSprint = 0;
      if (this.reload && !this.reload.committed) this.cancelReload();
    } else this.sinceSprint += dt;

    // ADS
    const def = this.def;
    const wantAds = !busy && !p.sprinting && c.down('aim') && !!def && !this.isMelee && this.switchPhase === 'none';
    // Carry pose: low-ready ↔ raised (third person). RMB, the trigger or a recent shot raise the gun.
    const wantRaise = !busy && !p.sprinting && !!def && !this.isMelee && (c.down('aim') || c.down('fire') || this.semiBuffered > 0 || this.sinceShot < BF.lowerDelay);
    this.raiseT = MathUtils.clamp(this.raiseT + (wantRaise ? dt / BF.raiseS : -dt / BF.lowerS), 0, 1);
    const adsTime = def ? def.adsMs / 1000 : 0.2;
    this.adsT = MathUtils.clamp(this.adsT + (wantAds ? dt : -dt) / adsTime, 0, 1);
    this.adsEased = easeOutCubic(this.adsT);
    p.speedMul = 1 + (0.6 - 1) * this.adsEased;
    p.blockSprint = false;

    // Recoil recovery + bloom decay + ADS sway (all fixed-step)
    if (def) {
      this.recoilP = recover(this.recoilP, def.recoverPerSec, dt);
      this.recoilY = recover(this.recoilY, def.recoverPerSec, dt);
    }
    this.bloom = decayBloom(this.bloom, B.bloomRecoverPerSec, dt);
    this.sinceShot += dt;
    if (this.sinceShot > B.shotResetS) this.shotIdx = 0;
    const swayAmp = H.adsSwayDeg * DEG * this.adsEased * (p.stamina.exhausted ? H.exhaustedSwayMul : 1);
    const w = this.time * Math.PI * 2 * H.adsSwayHz;
    this.swayY = Math.sin(w) * swayAmp;
    this.swayP = Math.sin(w * 2) * swayAmp * 0.5;
    this.cooldown -= dt;
    this.kickT = Math.max(0, this.kickT - dt / 0.08);

    if (def) {
      this.spread = spreadDeg(
        def,
        { ads: this.adsEased, bloom: this.bloom, speed01: p.speed01, sprinting: p.sprinting, airborne: !p.grounded, exhausted: p.stamina.exhausted },
        { sprint: B.sprintSpreadAdd, air: B.airSpreadAdd, move: B.moveSpreadAdd },
      );
    }

    // Aim point + blocked reticle
    this.ctx.rig.aimRay(_o, _d);
    this.aimPoint(_o, _d, this.aimHit);
    this.muzzle(_muz);
    this.blocked = this.isBlocked(_muz, this.aimHit);

    if (!busy && def && !this.isMelee) {
      // Fire mode
      if (c.pressed('fireMode') && def.fireModes.length > 1 && this.item) {
        const i = def.fireModes.indexOf(this.fireMode());
        const m = def.fireModes[(i + 1) % def.fireModes.length];
        this.fireModes.set(this.item.uid, m);
        this.ctx.sfx('dry_fire', undefined, { volume: 0.5 });
        g.events.emit('toast', { text: m === 'auto' ? 'Full auto' : 'Semi auto' });
      }
      // Reload
      if (c.pressed('reload')) this.startReload();
      this.stepReload(dt);
      // Trigger
      const auto = this.fireMode() === 'auto';
      if (c.pressed('fire')) this.semiBuffered = this.ctx.rig.firstPerson || this.raiseT >= BF.fireReady ? 0.12 : 0.25; // covers the raise
      else this.semiBuffered -= dt;
      const pull = auto ? c.down('fire') : this.semiBuffered > 0;
      const sprintOk = this.sinceSprint * 1000 >= def.sprintToFireMs;
      const raisedOk = this.ctx.rig.firstPerson || this.raiseT >= BF.fireReady; // TP: the barrel comes up first (~0.1 s)
      if (pull && this.cooldown <= 0 && this.ready && sprintOk && !p.sprinting && raisedOk) {
        this.semiBuffered = 0;
        this.fire(def);
      }
    } else if (this.reload && busy) this.cancelReload();

    this.stepBullets(dt);
  }

  private isBuilding() {
    const b = probe(this.ctx.game, 'build', 'active');
    try {
      return !!b?.active;
    } catch {
      return false;
    }
  }

  private startReload() {
    const it = this.item;
    const def = this.def;
    if (!it || !def || this.reload || !this.ready) return;
    const cap = weaponFeel[def.id]?.magSize ?? 30;
    if ((it.mag?.rounds ?? 0) >= cap - (it.rounds ? 0 : 1)) return; // full
    const magId = Array.isArray(def.magazines) ? def.magazines[0] : '';
    let have = 1;
    try {
      have = this.sandbox ? 1 : this.loadout.count(magId);
    } catch {
      have = 0;
    }
    if (!have) {
      this.ctx.game.events.emit('toast', { text: 'No magazines' });
      this.ctx.sfx('dry_fire');
      return;
    }
    const empty = !it.rounds;
    this.reload = { t: 0, total: empty ? def.reloadEmptyS : def.reloadTacticalS, empty, committed: false, outPlayed: false, inPlayed: false };
    this.ctx.playerAnim?.overlay(`reload_${def.class === 'pistol' ? 'pistol' : 'rifle'}`, 1, true);
    this.vm.play(`fp_${this.fpKind}_reload`, { seconds: this.reload.total });
    this.ctx.hud.clearToast(EMPTY_TOAST);
    this.adsT = Math.min(this.adsT, 0.3);
  }

  private stepReload(dt: number) {
    const r = this.reload;
    const it = this.item;
    if (!r || !it) return;
    r.t += dt;
    const k = r.t / r.total;
    // Sounds on the arms clip's events (fractions of the authored clip), so audio matches the hands
    const ev = fpArms.reloadEvents[this.fpKind];
    if (!r.outPlayed && k > (ev ? ev.magOut / ev.dur : 0.15)) {
      r.outPlayed = true;
      this.ctx.sfx('reload_mag_out', this.ctx.player.curr);
    }
    if (!r.inPlayed && k > (ev ? ev.magIn / ev.dur : 0.6)) {
      r.inPlayed = true;
      this.ctx.sfx('reload_mag_in', this.ctx.player.curr);
    }
    if (!r.committed && k >= B.magCommitAt) {
      r.committed = true;
      const fresh = this.loadout.takeMagazine(it);
      if (fresh) {
        if (it.mag) this.loadout.give(it.mag);
        it.mag = fresh;
      }
    }
    if (k >= 1) {
      if (!it.rounds && it.mag && (it.mag.rounds ?? 0) > 0) {
        it.mag.rounds!--;
        it.rounds = 1;
        this.ctx.sfx('bolt_rack', this.ctx.player.curr);
      }
      this.reload = null;
    }
  }

  /** Camera ray hit (or far point). */
  private aimPoint(o: Vector3, d: Vector3, out: Vector3) {
    const { world } = this.ctx.game.phys;
    this.ray.origin = o;
    this.ray.dir = d;
    const hit = world.castRay(this.ray, B.maxRange, true, undefined, groups(Group.PROJECTILE, BULLET_FILTER), this.ctx.player.collider, undefined, notMesh);
    this.aimMiss = !hit;
    return out.copy(o).addScaledVector(d, hit ? Math.max(hit.timeOfImpact, 1) : B.maxRange);
  }

  /** Sim-side muzzle position (the rendered model's muzzle is used for visuals). */
  muzzle(out: Vector3) {
    const p = this.ctx.player;
    p.lookDir(_d);
    _r.crossVectors(_d, UP).normalize();
    _u.crossVectors(_r, _d);
    out.set(p.curr.x, p.curr.y + p.eyeHeight, p.curr.z);
    if (this.ctx.rig.firstPerson) return out.addScaledVector(_r, 0.12 * (1 - this.adsEased)).addScaledVector(_u, -0.08).addScaledVector(_d, 0.5);
    return out.addScaledVector(_r, 0.28 * this.ctx.rig.sideT).addScaledVector(_u, -0.22).addScaledVector(_d, 0.65);
  }

  private isBlocked(muz: Vector3, aim: Vector3) {
    const dist = _p.subVectors(aim, muz).length();
    if (dist < 0.05) return false;
    const { world } = this.ctx.game.phys;
    this.ray.origin = muz;
    this.ray.dir = _p.divideScalar(dist);
    const hit = world.castRay(this.ray, dist, true, undefined, groups(Group.PROJECTILE, Group.STATIC | Group.TERRAIN | Group.BUILD | Group.VEHICLE), this.ctx.player.collider, undefined, notMesh);
    return !!hit && hit.timeOfImpact < dist - 0.3 && hit.timeOfImpact < 3;
  }

  private fire(def: WeaponDef) {
    const it = this.item!;
    const p = this.ctx.player;
    if (!it.rounds) {
      this.ctx.sfx('dry_fire', p.curr);
      this.cooldown = 0.25;
      this.semiBuffered = 0;
      if ((it.mag?.rounds ?? 0) === 0) this.ctx.game.events.emit('toast', { text: EMPTY_TOAST });
      return;
    }
    // Chamber -> fire -> chamber from mag
    it.rounds = 0;
    if (it.mag && (it.mag.rounds ?? 0) > 0) {
      it.mag.rounds!--;
      it.rounds = 1;
    }
    it.durability = Math.max(0, (it.durability ?? 1) - def.durabilityPerShot);
    this.cooldown = shotInterval(def.rpm);
    this.shotsFired++;
    // Nothing under the crosshair: the readout says "miss" now, not when the round expires (QA-073)
    if (this.aimMiss) this.lastShot = { distance: 0, zone: 'miss', damage: 0, target: '—' };
    const feel = weaponFeel[def.id];

    // Direction: muzzle -> camera-ray hit, then spread cone
    this.muzzle(_muz);
    _d.subVectors(this.aimHit, _muz).normalize();
    for (let k = 0; k < def.pellets; k++) {
      const cone = (this.spread * DEG) * Math.sqrt(this.ctx.rand());
      const a = this.ctx.rand() * Math.PI * 2;
      _r.crossVectors(_d, UP).normalize();
      _u.crossVectors(_r, _d);
      _n.copy(_d).addScaledVector(_r, Math.cos(a) * Math.tan(cone)).addScaledVector(_u, Math.sin(a) * Math.tan(cone)).normalize();
      this.spawnBullet(_muz, _n, def);
    }
    this.flashDir.copy(_d);

    // Recoil (learnable pattern; a share stays in the view, the rest recovers)
    const [kp, ky] = recoilKick(def, this.shotIdx++, this.ctx.rand);
    const keep = 1 - feel.recoverFrac;
    const adsMul = 1 - 0.25 * this.adsEased;
    this.recoilP += kp * DEG * adsMul * feel.recoverFrac;
    this.recoilY += ky * DEG * adsMul * feel.recoverFrac;
    p.pitch += kp * DEG * adsMul * keep;
    p.yaw += ky * DEG * adsMul * keep;
    this.bloom = addBloom(this.bloom, def);
    this.sinceShot = 0;

    // Juice: sound (+ mechanical layer), flash/light, shake, FOV kick, punch, model kick, shell, smoke
    this.ctx.sfx(feel.sound, _muz, { pitchJitter: 0.04, volume: 1 });
    this.ctx.rig.addTrauma(feel.trauma);
    this.ctx.rig.kick(feel.fovKick, feel.viewPunch);
    this.kickT = 1;
    this.ctx.playerAnim?.overlay(`fire_${def.class === 'pistol' ? 'pistol' : 'rifle'}`, 1, true);
    if (this.adsEased < 0.5) this.vm.play(`fp_${this.fpKind}_fire`); // ADS fire is code recoil only (arms contract)
    this.pendingFlash = true;
    this.ctx.game.events.emit('shot', { by: 'player', weaponId: def.id, origin: _muz.clone(), dir: _d.clone(), noise: def.noise });
    this.ctx.game.events.emit('noise', { position: _muz.clone(), radius: def.noise, source: 'shot' });
  }

  private spawnBullet(from: Vector3, dir: Vector3, def: WeaponDef) {
    let b: Bullet | null = null;
    for (const x of this.bullets) if (!x.alive) { b = x; break; }
    if (!b) return;
    b.alive = true;
    b.pos.copy(from);
    b.vel.copy(dir).multiplyScalar(def.muzzleVelocity);
    b.life = B.maxLife;
    b.dist = 0;
    b.def = def; // stepped later this same tick (fire runs before stepBullets)
  }

  private stepBullets(dt: number) {
    for (const b of this.bullets) if (b.alive) this.stepBullet(b, dt);
  }

  private stepBullet(b: Bullet, dt: number) {
    const { world } = this.ctx.game.phys;
    const len = b.vel.length() * dt;
    _n.copy(b.vel).normalize();
    this.ray.origin = b.pos;
    this.ray.dir = _n;
    // Chain-link is a wire mesh: bullets pass through (QA-055), with an occasional spark; walkers stay blocked
    const hit = world.castRayAndGetNormal(this.ray, len, true, undefined, groups(Group.PROJECTILE, BULLET_FILTER), this.ctx.player.collider, undefined, notMesh);
    if (this.ctx.rand() < B.meshSparkChance) {
      const wire = world.castRayAndGetNormal(this.ray, hit ? hit.timeOfImpact : len, true, undefined, groups(Group.PROJECTILE, Group.STATIC), this.ctx.player.collider, undefined, isMesh);
      if (wire) this.ctx.fx.impact(_p.copy(b.pos).addScaledVector(_n, wire.timeOfImpact), _u.set(wire.normal.x, wire.normal.y, wire.normal.z), 'metal', _n, 0.4);
    }
    if (hit) {
      b.alive = false;
      _p.copy(b.pos).addScaledVector(_n, hit.timeOfImpact);
      this.onHit(hit.collider, _p, _u.set(hit.normal.x, hit.normal.y, hit.normal.z), _n, b.dist + hit.timeOfImpact, b.def);
      return;
    }
    b.pos.addScaledVector(b.vel, dt);
    b.dist += len;
    b.vel.y -= 9.81 * dt;
    b.vel.multiplyScalar(1 - B.drag * dt);
    b.life -= dt;
    if (b.life <= 0 || b.dist > B.maxRange) {
      b.alive = false;
      this.lastShot = { distance: b.dist, zone: 'miss', damage: 0, target: '—' };
    }
  }

  private onHit(col: Collider, point: Vector3, normal: Vector3, dir: Vector3, dist: number, def: WeaponDef) {
    const ctx = this.ctx;
    const h = ctx.hits.get(col.handle);
    const fx = ctx.fx;
    if (h) {
      const zone = h.zone(col, point);
      const dmg = def.damage * falloffMul(dist, def.falloffStart, def.falloffMinMul);
      const res = h.hit({ point, dir, zone, damage: dmg, headMul: def.headMul, weaponId: def.id, distance: dist });
      const wfx = weaponFx[def.id];
      fx.impact(point, normal, h.surface, dir, (wfx?.impactScale ?? 1) * (h.surface === 'flesh' && zone === 'head' ? 1.8 : 1));
      if (h.surface === 'flesh') {
        // Blood decal on whatever is up to 3 m behind the target
        this.ray.origin = point;
        this.ray.dir = dir;
        const behind = ctx.game.phys.world.castRayAndGetNormal(this.ray, B.decalBehind, true, undefined, groups(Group.PROJECTILE, Group.STATIC | Group.TERRAIN | Group.BUILD), this.ctx.player.collider);
        if (behind) fx.decal(_p.copy(point).addScaledVector(dir, behind.timeOfImpact), _n.set(behind.normal.x, behind.normal.y, behind.normal.z), 'flesh');
      } else fx.decal(point, normal, h.surface);
      if (res) {
        ctx.hud.hitMarker(res.zone === 'head', res.kill);
        ctx.sfx(res.zone === 'head' ? 'hit_head' : 'hit_marker', undefined, { volume: 0.7 });
        if (res.kill) ctx.sfx('kill_confirm', undefined, { volume: 0.8 });
        ctx.game.events.emit('hit', { targetId: col.handle, point: point.clone(), damage: res.damage, zone: res.zone, kill: res.kill });
        this.lastShot = { distance: dist, zone: res.zone, damage: res.damage, target: h.kind };
      }
      return;
    }
    const surface = this.surfaceOf(col, point);
    fx.impact(point, normal, surface, dir, weaponFx[def.id]?.impactScale ?? 1);
    fx.decal(point, normal, surface);
    ctx.sfx(impacts[surface].sfx, point, { pitchJitter: 0.08 });
    this.lastShot = { distance: dist, zone: 'world', damage: 0, target: surface };
  }

  private surfaceOf(col: Collider, p: Vector3): Surface {
    const tagged = worldSurface(col.handle, p.x, p.z); // environment tags every static collider
    if (tagged) return tagged;
    const member = col.collisionGroups() >>> 16;
    if (member & Group.TERRAIN) return 'grass';
    if (member & Group.VEHICLE) return 'metal';
    return 'wood'; // build pieces
  }

  // --------------------------------------------------------------- rendering
  render(_alpha: number, dt: number) {
    const ctx = this.ctx;
    const fp = ctx.rig.firstPerson && !ctx.player.inVehicle;
    const m = this.item ? this.models.get(this.item.defId) : undefined;
    const p = ctx.player;
    const hidden = p.inVehicle || p.dead || this.isBuilding();
    for (const [, mm] of this.models) {
      mm.fp.root.visible = !hidden && fp && mm === m;
      mm.tp.root.visible = !hidden && !fp && mm === m;
    }
    // Switch/holster progress 0 drawn .. 1 lowered
    let lower = 0;
    if (this.switchPhase === 'holster') lower = 1 - this.switchT / H.holsterS;
    else if (this.switchPhase === 'draw') lower = this.switchT / Math.max(0.01, this.drawTotal);
    lower = easeOutCubic(lower);
    const r = this.reload;
    const rk = r ? r.t / r.total : 0;
    const reloadTilt = r ? Math.sin(Math.min(1, rk) * Math.PI) : 0;
    const melee = ctx.melee;

    if (m) {
      // Magazine hidden between mag-out and mag-in
      const magOut = !!r && rk > 0.2 && rk < B.magCommitAt;
      if (m.tp.mag) m.tp.mag.visible = !magOut;
      if (m.fp.mag && !this.vm.ready) m.fp.mag.visible = !magOut; // with arms, the reload clip events move the mag
      const a = this.adsEased;
      const dy0 = p.yaw - this.lastYaw;
      const dp0 = p.pitch - this.lastPitch;
      if (this.vm.ready) {
        // Arms rig: clips pose everything; code adds sway lag, walk bob, recoil kick and the sprint tuck
        this.lastYaw = p.yaw;
        this.lastPitch = p.pitch;
        const lagK = Math.min(1, dt / cameraFeel.swayLag);
        this.swayLag.x += (MathUtils.clamp(dy0 * 6, -fpArms.swayMax, fpArms.swayMax) - this.swayLag.x) * lagK;
        this.swayLag.y += (MathUtils.clamp(dp0 * 6, -fpArms.swayMax, fpArms.swayMax) - this.swayLag.y) * lagK;
        const bob = p.grounded ? Math.min(1.6, p.speed01) * (1 - a * 0.85) : 0;
        const tuck = p.sprinting && !this.isMelee ? 1 : 0;
        this.sprintT += (tuck - this.sprintT) * Math.min(1, dt * 8);
        const vp = this.vm.pivot;
        const ho = fpArms.hipOffset[this.fpKind] ?? [0, 0, 0];
        vp.position.set(
          ho[0] * (1 - a) + this.swayLag.x * 0.25 * (1 - a) + Math.cos(p.stepPhase) * fpArms.bob * bob,
          ho[1] * (1 - a) - this.swayLag.y * 0.25 * (1 - a) + Math.abs(Math.sin(p.stepPhase)) * fpArms.bob * bob - this.sprintT * 0.04,
          ho[2] * (1 - a) + this.kickT * fpArms.kickBack - a * (fpArms.adsForward[this.fpKind] ?? 0),
        );
        vp.rotation.set(this.kickT * fpArms.kickPitch - this.sprintT * fpArms.sprintTuck * 0.5, this.swayLag.x * (1 - a * 0.7) + this.sprintT * fpArms.sprintTuck, this.sprintT * 0.2);
        this.vm.pivot.visible = !hidden && fp;
        this.vm.update(dt, a, this.item?.defId ?? null);
      }
      // Legacy FP viewmodel (no arms asset): hip/ADS lerp, sway lag, bob, kick, holster dip, reload tilt
      const fpd = H.fp[this.isMelee ? 'knife' : this.def?.class === 'pistol' ? 'pistol' : 'rifle'];
      const [hx, hy, hz] = fpd.hip;
      const ax = 0;
      const ay = -m.fp.sightY;
      const az = fpd.adsZ;
      const v = this.vm.ready ? this.legacyDummy : m.fp.root;
      const dy = p.yaw - this.lastYaw;
      const dp = p.pitch - this.lastPitch;
      this.lastYaw = p.yaw;
      this.lastPitch = p.pitch;
      const lagK = Math.min(1, dt / cameraFeel.swayLag);
      this.swayLag.x += (MathUtils.clamp(dy * 6, -0.06, 0.06) - this.swayLag.x) * lagK;
      this.swayLag.y += (MathUtils.clamp(dp * 6, -0.06, 0.06) - this.swayLag.y) * lagK;
      const bob = p.grounded ? Math.min(1.6, p.speed01) * (1 - a * 0.85) : 0;
      v.position.set(
        hx + (ax - hx) * a + this.swayLag.x * 0.5 + Math.cos(p.stepPhase) * 0.012 * bob,
        hy + (ay - hy) * a - this.swayLag.y * 0.5 + Math.abs(Math.sin(p.stepPhase)) * 0.012 * bob - lower * 0.28 - reloadTilt * 0.06,
        hz + (az - hz) * a + this.kickT * (weaponFeel[this.item!.defId]?.kickBack ?? 0.03),
      );
      // Reload: cant the gun to show the mag well; sprint: tuck it across the chest
      const sprintT = p.sprinting && !this.isMelee ? 1 : 0;
      v.rotation.set(
        this.kickT * 0.08 - lower * 0.9 - reloadTilt * 0.2 - sprintT * 0.25,
        this.swayLag.x * 2 + reloadTilt * 0.45 + sprintT * 0.6,
        -reloadTilt * 0.5 + sprintT * 0.3,
      );
      if (melee && this.isMelee && !this.vm.ready) melee.poseViewmodel(v);
      // TP model sits in the hand; kick slides it back along the barrel
      if (ctx.playerChar.skinned) {
        m.tp.root.position.set(0, 0, this.kickT * 0.04);
        m.tp.root.rotation.set(H.gripRot[0] + this.kickT * 0.1, H.gripRot[1], H.gripRot[2]);
      } else {
        // Rifles slide back so the stock reaches the shoulder (placeholder rig has no elbows)
        m.tp.root.position.set(0, 0, this.kickT * 0.05 + (this.def?.class === 'pistol' || this.isMelee ? 0 : 0.28));
        m.tp.root.rotation.set(-Math.PI / 2 + this.kickT * 0.15, 0, 0); // arm hangs down (-Y); barrel (-Z) forward
      }
    }

    // Character pose for the TP body
    const pose = ctx.playerChar.pose;
    pose.hold = !this.item ? 'none' : this.isMelee ? 'knife' : this.def?.class === 'pistol' ? 'pistol' : 'rifle';
    pose.holster = Math.max(lower, p.sprinting && !this.isMelee ? 0.55 : 0, reloadTilt * 0.4);
    pose.kick = this.kickT;
    pose.aimPitch = p.pitch + this.recoilPitch;
    if (hidden) pose.hold = 'none';

    // Melee ribbon trail during the active window only (shows the real reach), blade base → tip
    if (m && this.isMelee && melee?.phase === 'active' && !hidden) {
      if (!this.trailOn) ctx.fx.trailBegin();
      this.trailOn = true;
      const km = fp ? m.fp : m.tp;
      km.muzzle.getWorldPosition(_muz);
      km.root.getWorldPosition(_p).lerp(_muz, 0.35);
      ctx.fx.trailSample(_p, _muz);
    } else if (this.trailOn) {
      ctx.fx.trailEnd();
      this.trailOn = false;
    }

    // Visual muzzle flash/tracer/shell/smoke at the rendered muzzle
    if (this.pendingFlash && m) {
      this.pendingFlash = false;
      const muz = (fp ? m.fp : m.tp).muzzle;
      muz.getWorldPosition(_muz);
      const wfx = weaponFx[this.item!.defId];
      const ads = fp && this.adsEased > 0.5;
      ctx.fx.muzzle(_muz, this.flashDir, (wfx?.flashLen ?? 0.3) * (fp ? 0.8 : 1.4), ads);
      // Smoke: every Nth shot of a burst, a little ahead of the barrel and never right in the lens
      _p.copy(_muz).addScaledVector(this.flashDir, 0.25);
      if (wfx && !ads && this.shotIdx % wfx.smokeEvery === 0 && _p.distanceTo(ctx.game.camera.position) > 1.0) ctx.fx.smokePuff(_p, this.flashDir, this.def?.class === 'pistol' ? 1 : 2);
      _r.crossVectors(this.flashDir, UP).normalize();
      _u.crossVectors(_r, this.flashDir);
      (fp ? m.fp : m.tp).root.getWorldPosition(_p);
      if (wfx?.casing) ctx.fx.casing(_p.addScaledVector(UP, 0.06).addScaledVector(this.flashDir, 0.12).addScaledVector(_r, 0.03), _r, _u, _n.copy(this.flashDir).negate(), p.curr.y, wfx.casing === 'hull');
      // Tracers: every Nth round and always the first shot of a burst
      if (wfx && wfx.tracerEvery > 0 && (this.shotIdx === 1 || this.shotsFired % wfx.tracerEvery === 0)) ctx.fx.tracer(_muz, this.aimHit, ctx.game.camera.position);
    }
  }
}

declare module '../ctx' {
  interface Ctx {
    weapons: Weapons;
  }
}
