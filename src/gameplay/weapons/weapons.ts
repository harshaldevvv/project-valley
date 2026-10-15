import { MathUtils, Object3D, Vector3 } from 'three';
import type { Collider } from '@dimforge/rapier3d-compat';
import { Group, groups } from '../../engine/physics';
import type { ItemInstance, SlotName, WeaponDef } from '../../content/data/types';
import type { LoadoutApi } from '../../core/contracts';
import { ballistics as B, handling as H, meleeDefs, weaponDefs, weaponFeel, weaponSlots } from '../../content/data/weapons';
import { cameraFeel } from '../../content/data/player';
import { probe, type Ctx, type Surface } from '../ctx';
import { addBloom, decayBloom, easeOutCubic, falloffMul, recoilKick, recover, shotInterval, spreadDeg } from './math';
import { makeWeaponModel, type WeaponModel } from './models';

/**
 * Weapons runtime (principles §3/§4): fire (semi/auto, RPM cap), per-tick segment-raycast ballistics,
 * falloff, learnable recoil + recovery (fixed step), spread/bloom, ADS, tactical/empty reload with mag commit
 * at 70 %, dry fire, fire modes, switching 1–4 with holster/draw, durability, and the shot juice.
 */
const BULLET_FILTER = Group.STATIC | Group.TERRAIN | Group.ZOMBIE | Group.VEHICLE | Group.BUILD | Group.DEBRIS;
const MAX_BULLETS = 64;
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
  reload: { t: number; total: number; empty: boolean; committed: boolean; outPlayed: boolean } | null = null;
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
  private pendingTracer = false;
  private flashDir = new Vector3();
  private aimHit = new Vector3();
  private models = new Map<string, { tp: WeaponModel; fp: WeaponModel }>();
  readonly fpHolder = new Object3D(); // child of the camera
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
    if (!ctx.game.camera.parent) ctx.game.scene.add(ctx.game.camera);
  }

  async init(handSocket: Object3D) {
    const kinds: Record<string, 'pistol' | 'rifle' | 'knife'> = { pistol_a: 'pistol', rifle_a: 'rifle', knife_a: 'knife' };
    for (const id of Object.keys(kinds)) {
      const model = weaponFeel[id]?.model ?? meleeDefs[id]?.model;
      const [tp, fp] = await Promise.all([makeWeaponModel(id, model, kinds[id]), makeWeaponModel(id, model, kinds[id])]);
      tp.root.visible = fp.root.visible = false;
      fp.root.traverse((o) => (o.castShadow = false));
      handSocket.add(tp.root);
      this.fpHolder.add(fp.root);
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
    this.switchPhase = this.item ? 'holster' : 'draw';
    this.switchT = this.item ? H.holsterS : this.drawTotal;
    if (!this.item) {
      this.slot = i;
      this.equip();
      this.switchT = this.drawTotal;
    }
    this.ctx.sfx('reload_mag_out', undefined, { volume: 0.25, pitchJitter: 0.1 });
  }

  cancelReload() {
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
      if (c.pressed('fire')) this.semiBuffered = 0.12;
      else this.semiBuffered -= dt;
      const pull = auto ? c.down('fire') : this.semiBuffered > 0;
      const sprintOk = this.sinceSprint * 1000 >= def.sprintToFireMs;
      if (pull && this.cooldown <= 0 && this.ready && sprintOk && !p.sprinting) {
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
    this.reload = { t: 0, total: empty ? def.reloadEmptyS : def.reloadTacticalS, empty, committed: false, outPlayed: false };
    this.ctx.playerAnim?.overlay(`reload_${def.class === 'pistol' ? 'pistol' : 'rifle'}`, 1, true);
    this.adsT = Math.min(this.adsT, 0.3);
  }

  private stepReload(dt: number) {
    const r = this.reload;
    const it = this.item;
    if (!r || !it) return;
    r.t += dt;
    const k = r.t / r.total;
    if (!r.outPlayed && k > 0.15) {
      r.outPlayed = true;
      this.ctx.sfx('reload_mag_out', this.ctx.player.curr);
    }
    if (!r.committed && k >= B.magCommitAt) {
      r.committed = true;
      const fresh = this.loadout.takeMagazine(it);
      if (fresh) {
        if (it.mag) this.loadout.give(it.mag);
        it.mag = fresh;
      }
      this.ctx.sfx('reload_mag_in', this.ctx.player.curr);
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
    const hit = world.castRay(this.ray, B.maxRange, true, undefined, groups(Group.PROJECTILE, BULLET_FILTER), this.ctx.player.collider);
    return out.copy(o).addScaledVector(d, hit ? Math.max(hit.timeOfImpact, 1) : B.maxRange);
  }

  /** Sim-side muzzle position (the rendered model's muzzle is used for visuals). */
  muzzle(out: Vector3) {
    const p = this.ctx.player;
    p.lookDir(_d);
    _r.crossVectors(_d, UP).normalize();
    _u.crossVectors(_r, _d);
    out.set(p.curr.x, p.curr.y + p.eyeHeight, p.curr.z);
    if (this.ctx.rig.mode === 'fp') return out.addScaledVector(_r, 0.12 * (1 - this.adsEased)).addScaledVector(_u, -0.08).addScaledVector(_d, 0.5);
    return out.addScaledVector(_r, 0.28 * this.ctx.rig.sideT).addScaledVector(_u, -0.22).addScaledVector(_d, 0.65);
  }

  private isBlocked(muz: Vector3, aim: Vector3) {
    const dist = _p.subVectors(aim, muz).length();
    if (dist < 0.05) return false;
    const { world } = this.ctx.game.phys;
    this.ray.origin = muz;
    this.ray.dir = _p.divideScalar(dist);
    const hit = world.castRay(this.ray, dist, true, undefined, groups(Group.PROJECTILE, Group.STATIC | Group.TERRAIN | Group.BUILD | Group.VEHICLE), this.ctx.player.collider);
    return !!hit && hit.timeOfImpact < dist - 0.3 && hit.timeOfImpact < 3;
  }

  private fire(def: WeaponDef) {
    const it = this.item!;
    const p = this.ctx.player;
    if (!it.rounds) {
      this.ctx.sfx('dry_fire', p.curr);
      this.cooldown = 0.25;
      this.semiBuffered = 0;
      if ((it.mag?.rounds ?? 0) === 0) this.ctx.game.events.emit('toast', { text: 'Empty — press R' });
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
    this.pendingFlash = true;
    this.pendingTracer = def.class !== 'pistol';
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
    const hit = world.castRayAndGetNormal(this.ray, len, true, undefined, groups(Group.PROJECTILE, BULLET_FILTER), this.ctx.player.collider);
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
      fx.impact(point, normal, h.surface, h.surface === 'flesh' ? (zone === 'head' ? 1.6 : 1) : 1);
      if (h.surface === 'flesh') {
        // Blood decal on whatever is up to 3 m behind the target
        this.ray.origin = point;
        this.ray.dir = dir;
        const behind = ctx.game.phys.world.castRayAndGetNormal(this.ray, B.decalBehind, true, undefined, groups(Group.PROJECTILE, Group.STATIC | Group.TERRAIN | Group.BUILD), this.ctx.player.collider);
        if (behind) fx.decal(_p.copy(point).addScaledVector(dir, behind.timeOfImpact), _n.set(behind.normal.x, behind.normal.y, behind.normal.z), 'flesh', 0.35);
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
    const surface = this.surfaceOf(col);
    fx.impact(point, normal, surface);
    fx.decal(point, normal, surface);
    ctx.sfx(surface === 'metal' ? 'impact_metal' : surface === 'wood' ? 'impact_wood' : 'impact_dirt', point, { pitchJitter: 0.08 });
    this.lastShot = { distance: dist, zone: 'world', damage: 0, target: surface };
  }

  private surfaceOf(col: Collider): Surface {
    const member = col.collisionGroups() >>> 16;
    if (member & Group.TERRAIN) return 'dirt';
    if (member & Group.VEHICLE) return 'metal';
    if (member & Group.BUILD) return 'wood';
    return 'concrete'; // ponytail: static props have no material tag yet; add a surface map from environment when needed
  }

  // --------------------------------------------------------------- rendering
  render(_alpha: number, dt: number) {
    const ctx = this.ctx;
    const fp = ctx.rig.mode === 'fp' && !ctx.player.inVehicle;
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
      if (m.fp.mag) m.fp.mag.visible = m.tp.mag!.visible = !(r && rk > 0.2 && rk < B.magCommitAt);
      // FP viewmodel: hip/ADS lerp, sway lag (60–80 ms), walk bob, kick, holster dip, reload tilt
      const a = this.adsEased;
      const [hx, hy, hz] = H.fpHip;
      const [ax, ay, az] = H.fpAds;
      const v = m.fp.root;
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
      v.rotation.set(this.kickT * 0.08 - lower * 0.9 + reloadTilt * 0.35, this.swayLag.x * 2, reloadTilt * 0.6 + (p.sprinting ? 0.5 : 0));
      if (melee && this.isMelee) melee.poseViewmodel(v);
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

    // Visual muzzle flash/tracer/shell/smoke at the rendered muzzle
    if (this.pendingFlash && m) {
      this.pendingFlash = false;
      const muz = (fp ? m.fp : m.tp).muzzle;
      muz.getWorldPosition(_muz);
      ctx.fx.muzzle(_muz, this.flashDir, H.muzzleFlashSize * (this.def?.class === 'pistol' ? 0.8 : 1.2));
      ctx.fx.smoke(_muz, this.flashDir);
      _r.crossVectors(this.flashDir, UP).normalize();
      _u.crossVectors(_r, this.flashDir);
      (fp ? m.fp : m.tp).root.getWorldPosition(_p);
      ctx.fx.shell(_p.addScaledVector(UP, 0.06), _r, _u, this.def?.class !== 'pistol');
      if (this.pendingTracer) ctx.fx.tracer(_muz, _n.subVectors(this.aimHit, _muz).normalize(), _muz.distanceTo(this.aimHit));
    }
  }
}

declare module '../ctx' {
  interface Ctx {
    weapons: Weapons;
  }
}
