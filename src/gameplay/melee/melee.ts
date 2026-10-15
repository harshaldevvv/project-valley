import { Object3D, Vector3 } from 'three';
import { Group, groups } from '../../engine/physics';
import { stamina as SD } from '../../content/data/player';
import { finisher as FIN, meleeDefs, shove as SH, type MeleeDef } from '../../content/data/weapons';
import type { Ctx } from '../ctx';
import type { Zombie } from '../zombies/zombies';

/**
 * Melee (principles §5): knife light (LMB) / heavy (RMB) swings with windup → active arc raycasts → recovery,
 * buffered next swing, hitstop on the target only; shove (V) staggers up to 3 in a 100° cone;
 * finisher on a staggered zombie (knife attack) — 0.8 s, invulnerable.
 */
type Phase = 'idle' | 'windup' | 'active' | 'recovery' | 'shove' | 'finisher';
const HIT_FILTER = Group.ZOMBIE | Group.STATIC | Group.BUILD | Group.VEHICLE;
const _o = new Vector3();
const _d = new Vector3();
const _p = new Vector3();
const _n = new Vector3();

export class Melee {
  phase: Phase = 'idle';
  t = 0;
  heavy = false;
  private buffered: 'light' | 'heavy' | null = null;
  private raysDone = 0;
  private hitThisSwing = new Set<number>();
  private target: Zombie | null = null;
  swingVis = 0; // -1..1 for poses
  constructor(private ctx: Ctx) {}

  get busy() {
    return this.phase !== 'idle' && this.phase !== 'recovery';
  }
  get invulnerable() {
    return this.phase === 'finisher';
  }
  private get def(): MeleeDef | null {
    const w = this.ctx.weapons;
    return w.item ? (meleeDefs[w.item.defId] ?? null) : null;
  }

  step(dt: number) {
    const c = this.ctx.controls;
    const p = this.ctx.player;
    const w = this.ctx.weapons;
    if (p.dead || p.inVehicle) {
      this.phase = 'idle';
      p.locked = false;
      return;
    }
    const def = this.def;
    // Input (melee weapon in hand + ready), with a buffer during the end of recovery
    if (def && w.switchPhase === 'none') {
      const want = c.pressed('fire') ? 'light' : c.pressed('aim') ? 'heavy' : null;
      if (want) {
        if (this.phase === 'idle') this.start(want, def);
        else if (this.phase === 'recovery' && this.t <= def.bufferWindow) this.buffered = want;
        else if (this.phase === 'recovery') this.buffered = null;
      }
    }
    if (c.pressed('shove') && (this.phase === 'idle' || (this.phase === 'recovery' && this.hitThisSwing.size > 0)) && w.switchPhase === 'none') this.startShove();

    this.t -= dt;
    switch (this.phase) {
      case 'windup':
        this.swingVis = -1 + 0.2 * (1 - this.t / (this.heavy ? def!.heavyWindup : def!.windup));
        if (this.t <= 0) {
          this.phase = 'active';
          this.t = def!.active;
          this.raysDone = 0;
          this.hitThisSwing.clear();
          this.ctx.sfx('melee_swing', p.curr, { pitchJitter: 0.1, volume: this.heavy ? 1 : 0.8 });
        }
        break;
      case 'active': {
        const k = 1 - Math.max(0, this.t) / def!.active;
        this.swingVis = -1 + 2 * k;
        // Sweep the arc right -> left; cast the rays whose turn has come this tick
        const due = Math.min(def!.rays, Math.ceil(k * def!.rays));
        while (this.raysDone < due) this.swingRay(def!, this.raysDone++);
        if (this.t <= 0) {
          this.phase = 'recovery';
          this.t = this.heavy ? def!.heavyRecovery : def!.recovery;
        }
        break;
      }
      case 'recovery':
        this.swingVis *= 0.85;
        if (this.t <= 0) {
          this.phase = 'idle';
          const b = this.buffered;
          this.buffered = null;
          if (b && def) this.start(b, def);
        }
        break;
      case 'shove':
        this.swingVis = Math.sin((1 - this.t / SH.duration) * Math.PI);
        if (this.t <= SH.duration * 0.6 && this.raysDone === 0) {
          this.raysDone = 1;
          this.doShove();
        }
        if (this.t <= 0) this.phase = 'idle';
        break;
      case 'finisher': {
        const z = this.target;
        this.swingVis = Math.sin((1 - this.t / FIN.duration) * Math.PI * 3);
        if (z && z.alive) {
          z.mode = 'stagger';
          z.modeT = 0.2;
        }
        if (this.t <= 0) {
          p.locked = false;
          this.phase = 'idle';
          if (z && z.alive) {
            _d.subVectors(z.curr, p.curr).setY(0).normalize();
            z.hitstop = def ? def.hitstopKill : 0.13;
            this.ctx.zombies.die(z, _d, true);
            this.ctx.hud.hitMarker(true, true);
            this.ctx.sfx('melee_hit', z.curr);
            this.ctx.sfx('kill_confirm');
            this.ctx.rig.addTrauma(0.35);
            _p.copy(z.curr).setY(z.curr.y + 1.2);
            this.ctx.fx.impact(_p, _n.copy(_d).negate(), 'flesh', 2);
          }
          this.target = null;
        }
        break;
      }
    }
  }

  private start(kind: 'light' | 'heavy', def: MeleeDef) {
    // Finisher: a knife attack on a staggered zombie right in front
    const z = this.finisherTarget();
    if (z) {
      this.phase = 'finisher';
      this.t = FIN.duration;
      this.target = z;
      this.ctx.player.locked = true;
      this.ctx.player.invulnT = FIN.duration;
      this.ctx.sfx('melee_swing', this.ctx.player.curr);
      return;
    }
    if (!this.ctx.player.stamina.spend(kind === 'heavy' ? SD.melee * 1.5 : SD.melee)) {
      this.ctx.game.events.emit('toast', { text: 'Too tired' });
      return;
    }
    this.heavy = kind === 'heavy';
    this.ctx.playerAnim?.oneshot(this.heavy ? 'melee_heavy' : 'melee_swing', 0.08);
    this.phase = 'windup';
    this.t = this.heavy ? def.heavyWindup : def.windup;
  }

  private finisherTarget(): Zombie | null {
    const p = this.ctx.player;
    let best: Zombie | null = null;
    let bd = FIN.range;
    for (const z of this.ctx.zombies.list) {
      if (!z.alive || !z.staggered) continue;
      _d.subVectors(z.curr, p.curr).setY(0);
      const d = _d.length();
      if (d > bd) continue;
      const fx = -Math.sin(p.yaw);
      const fz = -Math.cos(p.yaw);
      if ((fx * _d.x + fz * _d.z) / Math.max(d, 1e-3) < 0.5) continue;
      best = z;
      bd = d;
    }
    return best;
  }

  private swingRay(def: MeleeDef, i: number) {
    const p = this.ctx.player;
    const { R, world } = this.ctx.game.phys;
    const off = ((i / Math.max(1, def.rays - 1)) - 0.5) * -((def.arcDeg * Math.PI) / 180); // right -> left
    _o.copy(p.curr).setY(p.curr.y + p.eyeHeight - 0.25);
    _d.set(-Math.sin(p.yaw + off) * Math.cos(p.pitch), Math.sin(p.pitch) * 0.6, -Math.cos(p.yaw + off) * Math.cos(p.pitch)).normalize();
    const hit = world.castRayAndGetNormal(new R.Ray(_o, _d), def.reach, true, undefined, groups(Group.PROJECTILE, HIT_FILTER), p.collider);
    if (!hit) return;
    const h = this.ctx.hits.get(hit.collider.handle);
    _p.copy(_o).addScaledVector(_d, hit.timeOfImpact);
    _n.set(hit.normal.x, hit.normal.y, hit.normal.z);
    if (!h) {
      if (this.hitThisSwing.has(-1)) return;
      this.hitThisSwing.add(-1);
      this.ctx.fx.impact(_p, _n, 'concrete', 0.6);
      this.ctx.sfx('impact_wood', _p, { volume: 0.6 });
      this.ctx.rig.addTrauma(0.15);
      return;
    }
    // One hit per target per swing (head + body colliders share one hittable)
    const key = h.kind === 'zombie' ? -2 - (this.ctx.zombies.list.findIndex((z) => z.capsule === hit.collider || z.head === hit.collider)) : hit.collider.handle;
    if (this.hitThisSwing.has(key)) return;
    this.hitThisSwing.add(key);
    const zone = h.zone(hit.collider, _p);
    const res = h.hit({
      point: _p, dir: _d, zone, damage: def.damage * (this.heavy ? def.heavyDamageMul : 1), headMul: 1.5, weaponId: def.id, distance: hit.timeOfImpact,
      melee: { stagger: this.heavy || def.staggerOnHit === 1 ? 0.9 : 0, push: this.heavy ? 0.6 : 0, hitstop: this.heavy ? def.hitstopHeavy : def.hitstopLight },
    });
    this.ctx.fx.impact(_p, _n, h.surface, 1.2);
    this.ctx.sfx('melee_hit', _p, { pitchJitter: 0.08 });
    this.ctx.rig.addTrauma(this.heavy ? 0.3 : 0.18);
    this.ctx.rig.kick(0, this.heavy ? -1.5 : -0.8);
    const w = this.ctx.weapons.item;
    if (w) w.durability = Math.max(0, (w.durability ?? 1) - def.durabilityPerHit);
    if (res) {
      this.ctx.hud.hitMarker(res.zone === 'head', res.kill);
      if (res.kill) this.ctx.sfx('kill_confirm', undefined, { volume: 0.8 });
      this.ctx.weapons.lastShot = { distance: hit.timeOfImpact, zone: res.zone, damage: res.damage, target: h.kind };
    }
  }

  private startShove() {
    if (!this.ctx.player.stamina.spend(SD.shove)) {
      this.ctx.game.events.emit('toast', { text: 'Too tired to shove' });
      return;
    }
    this.phase = 'shove';
    this.ctx.playerAnim?.oneshot('shove', 0.08);
    this.t = SH.duration;
    this.raysDone = 0;
    this.ctx.weapons.cancelReload();
    this.ctx.sfx('melee_swing', this.ctx.player.curr, { pitchJitter: 0.15, volume: 0.6 });
  }

  private doShove() {
    const p = this.ctx.player;
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    const cosHalf = Math.cos(((SH.coneDeg / 2) * Math.PI) / 180);
    let n = 0;
    // Closest first
    const cands = this.ctx.zombies.list
      .filter((z) => z.alive)
      .map((z) => ({ z, d: Math.hypot(z.curr.x - p.curr.x, z.curr.z - p.curr.z) }))
      .filter((c) => c.d <= SH.range + 0.3)
      .sort((a, b) => a.d - b.d);
    for (const { z, d } of cands) {
      if (n >= SH.maxTargets) break;
      const dx = (z.curr.x - p.curr.x) / Math.max(d, 1e-3);
      const dz = (z.curr.z - p.curr.z) / Math.max(d, 1e-3);
      if (dx * fx + dz * fz < cosHalf) continue;
      n++;
      _d.set(dx, 0, dz);
      this.ctx.zombies.stagger(z, SH.stagger);
      z.push.copy(_d).multiplyScalar(SH.push / 0.25);
      z.flinch = 0.2;
      _p.copy(z.curr).setY(z.curr.y + 1.2);
      this.ctx.fx.impact(_p, _n.copy(_d).negate(), 'dirt', 0.4);
    }
    if (n) {
      this.ctx.sfx('melee_hit', p.curr, { volume: 0.7, pitchJitter: 0.1 });
      this.ctx.rig.addTrauma(0.2);
      this.ctx.rig.kick(0, -1);
      this.ctx.hud.hitMarker(false, false);
    }
  }

  /** Knife viewmodel arc (FP). */
  poseViewmodel(v: Object3D) {
    const s = this.swingVis;
    if (this.phase === 'idle') return;
    if (this.phase === 'shove') {
      v.position.z -= s * 0.18;
      v.position.x -= s * 0.1;
      return;
    }
    v.position.x += -s * 0.22;
    v.position.y += (1 - Math.abs(s)) * 0.06;
    v.position.z -= (1 - Math.abs(s)) * 0.12;
    v.rotation.y += s * 0.9;
    v.rotation.z += -s * 0.6 + (this.heavy ? 0.4 : 0);
    v.rotation.x += -0.4 * (1 - Math.abs(s));
  }
}

declare module '../ctx' {
  interface Ctx {
    melee: Melee;
  }
}
