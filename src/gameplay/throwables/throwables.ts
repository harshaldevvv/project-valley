import { AdditiveBlending, BoxGeometry, BufferGeometry, Color, CylinderGeometry, Group as G3, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PointLight, RingGeometry, Vector3 } from 'three';
import type { Collider, RigidBody } from '@dimforge/rapier3d-compat';
import { Group, groups } from '../../engine/physics';
import { surfaceOf } from '../../world/surfaces';
import { throwDefs, throwOrder, throwTuning as T, type ThrowDef } from '../../content/data/throwables';
import { itemText } from '../../content/text/items';
import { throwText } from '../../content/text/throw';
import { probe, type Ctx } from '../ctx';
import { Zombie } from '../zombies/zombies';

/**
 * Throwables (M4): hold the throw key to aim (arc preview), release to throw the selected item; K cycles what you carry.
 * Rapier ball bodies bounce and roll. Frag grenades blow after a fuse; molotovs and bottles shatter on the first hard
 * impact (fire patch / noise lure); flares burn and lure. Everything audible goes through the 'noise' event, so the
 * zombie AI needs no special cases. Tuning: data/throwables.ts.
 */
const isMesh = (c: Collider) => (surfaceOf(c.handle) as string | null) === 'chainlink';
const notMesh = (c: Collider) => !isMesh(c);
const WORLD = Group.STATIC | Group.TERRAIN | Group.BUILD | Group.VEHICLE;
const UP = new Vector3(0, 1, 0);
const _o = new Vector3();
const _d = new Vector3();
const _r = new Vector3();
const _p = new Vector3();
const _v = new Vector3();
const _c = new Vector3();

interface Proj {
  def: ThrowDef;
  mesh: Object3D;
  body: RigidBody;
  collider: Collider;
  prevV: Vector3;
  age: number;
  fuse: number;
  burn: number; // flares: seconds left
  lure: number;
}
interface Fire {
  pos: Vector3;
  t: number;
  tick: number;
  flame: number;
}

/** Small pooled particle system for flames, fireballs and smoke (the shared fx smoke pool is too faint and too small for fire). */
class Particles {
  readonly mesh: InstancedMesh;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private size: Float32Array;
  private grow: Float32Array;
  private grav: Float32Array;
  private c0: Color[];
  private c1: Color[];
  private head = 0;
  private m = new Matrix4();
  private col = new Color();
  constructor(private n: number, additive: boolean, opacity: number) {
    this.mesh = new InstancedMesh(new IcosahedronGeometry(0.5, 1), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity, depthWrite: false, blending: additive ? AdditiveBlending : 1 }), n);
    this.mesh.frustumCulled = false;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n).fill(1);
    this.size = new Float32Array(n);
    this.grow = new Float32Array(n);
    this.grav = new Float32Array(n);
    this.c0 = Array.from({ length: n }, () => new Color());
    this.c1 = Array.from({ length: n }, () => new Color());
    const z = new Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) {
      this.mesh.setMatrixAt(i, z);
      this.mesh.setColorAt(i, this.col.set('#000000'));
    }
  }
  spawn(p: Vector3, vx: number, vy: number, vz: number, life: number, size: number, grow: number, grav: number, from: string, to: string) {
    const i = this.head;
    this.head = (this.head + 1) % this.n;
    this.pos[i * 3] = p.x;
    this.pos[i * 3 + 1] = p.y;
    this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.life[i] = this.max[i] = life;
    this.size[i] = size;
    this.grow[i] = grow;
    this.grav[i] = grav;
    this.c0[i].set(from);
    this.c1[i].set(to);
  }
  update(dt: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const t = Math.max(0, this.life[i] / this.max[i]); // 1 -> 0
      if (t <= 0) {
        this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
        continue;
      }
      const k = i * 3;
      this.vel[k + 1] += this.grav[i] * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      const s = this.size[i] * (1 + this.grow[i] * (1 - t)) * Math.min(1, t * 4);
      this.m.makeScale(s, s, s).setPosition(this.pos[k], this.pos[k + 1], this.pos[k + 2]);
      this.mesh.setMatrixAt(i, this.m);
      this.col.copy(this.c1[i]).lerp(this.c0[i], t);
      this.mesh.setColorAt(i, this.col);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

const mat = (c: string, rough = 0.6) => new MeshStandardMaterial({ color: c, roughness: rough, flatShading: true });
function look(def: ThrowDef): Object3D {
  const g = new G3();
  const add = (geo: BufferGeometry, m: MeshStandardMaterial, x = 0, y = 0, z = 0) => {
    const o = new Mesh(geo, m);
    o.position.set(x, y, z);
    g.add(o);
    return o;
  };
  if (def.look === 'grenade') {
    add(new IcosahedronGeometry(0.045, 1), mat('#4f5a35'));
    add(new BoxGeometry(0.012, 0.03, 0.05), mat('#8a8f93', 0.4), 0, 0.05, 0);
    add(new CylinderGeometry(0.014, 0.014, 0.02, 8), mat('#8a8f93', 0.4), 0, 0.047, 0);
  } else if (def.look === 'molotov') {
    add(new CylinderGeometry(0.03, 0.03, 0.15, 8), mat('#6a4a22', 0.3));
    add(new CylinderGeometry(0.012, 0.028, 0.06, 8), mat('#6a4a22', 0.3), 0, 0.105, 0);
    add(new BoxGeometry(0.03, 0.07, 0.012), mat('#e8dcc0', 0.9), 0.01, 0.16, 0);
  } else if (def.look === 'bottle') {
    add(new CylinderGeometry(0.028, 0.028, 0.15, 8), mat('#3f6a4a', 0.25));
    add(new CylinderGeometry(0.011, 0.026, 0.07, 8), mat('#3f6a4a', 0.25), 0, 0.11, 0);
  } else {
    add(new CylinderGeometry(0.016, 0.016, 0.22, 8), mat('#c43a2a'));
    add(new CylinderGeometry(0.014, 0.014, 0.03, 8), mat('#ffe9a0', 0.4), 0, 0.125, 0);
  }
  g.traverse((o) => ((o as Mesh).isMesh && (o.castShadow = false)));
  return g;
}

export class Throwables {
  sel = 0;
  aiming = false;
  private aimT = 0;
  private cd = 0;
  private pending: { id: string; t: number } | null = null;
  readonly projectiles: Proj[] = [];
  readonly fires: Fire[] = [];
  private ray;
  private dots: InstancedMesh;
  private marker: Mesh;
  private light: PointLight;
  private flashT = 0;
  private flashPos = new Vector3();
  private flames = new Particles(220, true, 0.9);
  private smoke = new Particles(90, false, 0.55);
  private sp = new Vector3();
  private sv = new Vector3();
  private st = new Vector3();
  private sd = new Vector3();
  private badge: HTMLDivElement | null = null;
  private badgeT = 0;
  private time = 0;
  /** Debug/test hook: last explosion summary. */
  lastBlast: { zombies: number; killed: number; playerHurt: number } | null = null;

  constructor(private ctx: Ctx) {
    const { R } = ctx.game.phys;
    this.ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    const n = T.previewSteps + 1;
    this.dots = new InstancedMesh(new IcosahedronGeometry(0.06, 1), new MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 1, depthTest: false }), n);
    this.dots.frustumCulled = false;
    this.dots.renderOrder = 20;
    this.dots.visible = false;
    this.marker = new Mesh(new RingGeometry(0.22, 0.3, 24).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: '#f2f0e0', transparent: true, opacity: 0.8, depthTest: false, side: 2 }));
    this.marker.frustumCulled = false;
    this.marker.renderOrder = 20;
    this.marker.visible = false;
    this.light = new PointLight('#ff8a30', 0, 14, 2);
    this.light.castShadow = false;
    ctx.game.scene.add(this.dots, this.marker, this.light, this.flames.mesh, this.smoke.mesh);
    ctx.game.events.on('playerDied', () => this.cancelAim());
    ctx.debug.watch('Throw', 'selected / live', () => `${this.current() ?? '-'} / ${this.projectiles.length}p ${this.fires.length}f`);
    for (const k of ['speed', 'upBias', 'windupS', 'cooldownS'] as const) ctx.debug.tune('Throw', T, k, 0, k === 'speed' ? 30 : 2, 0.01);
  }

  /** Throwable item ids the player carries, in cycle order. */
  available(): string[] {
    const lo = this.ctx.weapons.loadout;
    return throwOrder.filter((id) => {
      try {
        return lo.count(id) > 0;
      } catch {
        return false;
      }
    });
  }
  current(): string | null {
    const a = this.available();
    return a.length ? a[this.sel % a.length] : null;
  }
  private countOf(id: string) {
    try {
      return this.ctx.weapons.sandbox ? 99 : this.ctx.weapons.loadout.count(id);
    } catch {
      return 0;
    }
  }

  private cancelAim() {
    this.aiming = false;
    this.aimT = 0;
    this.pending = null;
    this.dots.visible = this.marker.visible = false;
  }

  private say(text: string) {
    this.ctx.game.events.emit('toast', { text });
  }
  private showBadge(text: string | null) {
    if (!this.badge) {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;right:28px;bottom:140px;padding:6px 12px;background:rgba(20,22,24,.72);border-left:3px solid #d9a441;color:#f0ead8;font:600 13px/1.2 system-ui,sans-serif;letter-spacing:.04em;pointer-events:none;z-index:30;display:none';
      document.body.appendChild(d);
      this.badge = d;
    }
    this.badge.style.display = text ? 'block' : 'none';
    if (text) this.badge.textContent = text;
  }

  private blocked() {
    const p = this.ctx.player;
    const b = probe(this.ctx.game, 'build', 'active');
    let building = false;
    try {
      building = !!b?.active;
    } catch {
      building = false;
    }
    return p.dead || p.inVehicle || p.usingItem || building || this.ctx.melee?.busy || !this.ctx.weapons.ready;
  }

  /** Launch position and velocity for the current view (shared by the preview and the throw). */
  private launch(def: ThrowDef, pos: Vector3, vel: Vector3) {
    const p = this.ctx.player;
    this.ctx.rig.aimRay(_o, _d);
    p.lookDir(_d); // plain look direction: no weapon recoil or sway on a throw
    _r.crossVectors(_d, UP).normalize();
    if (this.ctx.rig.firstPerson) pos.copy(_o).addScaledVector(_d, 0.45).addScaledVector(_r, 0.2).addScaledVector(UP, -0.14);
    else {
      p.lookDir(_p);
      _p.y = 0;
      _p.normalize();
      pos.set(p.curr.x, p.curr.y + p.eyeHeight - 0.15, p.curr.z).addScaledVector(_p, 0.55).addScaledVector(_r, 0.25);
    }
    vel.copy(_d).applyAxisAngle(_r, T.upBias).multiplyScalar(T.speed * def.speedMul);
  }

  private updatePreview(def: ThrowDef) {
    const { world } = this.ctx.game.phys;
    const pp = this.sp, vv = this.sv, step = this.st;
    this.launch(def, pp, vv);
    const n = T.previewSteps;
    const m = new Matrix4();
    let count = 0;
    let hit = false;
    for (let i = 0; i <= n; i++) {
      m.makeTranslation(pp.x, pp.y, pp.z);
      this.dots.setMatrixAt(count++, m);
      if (i === n) break;
      vv.y -= 9.81 * T.previewDt;
      step.copy(vv).multiplyScalar(T.previewDt);
      const len = step.length();
      this.ray.origin = pp;
      this.ray.dir = this.sd.copy(step).divideScalar(len);
      const h = world.castRay(this.ray, len, true, undefined, groups(Group.PROJECTILE, WORLD | Group.ZOMBIE), this.ctx.player.collider, undefined, notMesh);
      if (h) {
        pp.addScaledVector(this.sd, h.timeOfImpact);
        hit = true;
        break;
      }
      pp.add(step);
    }
    m.makeScale(0, 0, 0);
    for (let i = count; i <= n; i++) this.dots.setMatrixAt(i, m);
    this.dots.instanceMatrix.needsUpdate = true;
    this.dots.visible = true;
    this.marker.visible = hit;
    if (hit) this.marker.position.set(pp.x, pp.y + 0.03, pp.z);
  }

  step(dt: number) {
    this.time += dt;
    this.cd -= dt;
    const c = this.ctx.controls;
    const blocked = this.blocked();
    if (blocked) {
      if (this.aiming) this.cancelAim();
    } else {
      if (c.pressed('throwCycle')) {
        const a = this.available();
        if (!a.length) this.say(throwText.none);
        else {
          this.sel = (this.sel + 1) % a.length;
          const id = a[this.sel];
          this.say(throwText.selected(itemText[id]?.name ?? id, this.countOf(id)));
          this.badgeT = 2.5;
        }
      }
      const id = this.current();
      const want = c.down('throwAim') && this.cd <= 0 && !this.pending && !this.ctx.player.sprinting;
      if (want && id) {
        if (!this.aiming) this.aimT = 0;
        this.aiming = true;
        this.aimT += dt;
        this.updatePreview(throwDefs[id]);
      } else if (this.aiming) {
        this.aiming = false;
        this.dots.visible = this.marker.visible = false;
        if (id && this.aimT >= T.minAimS) this.startThrow(id);
        else if (!id) this.say(throwText.none);
        else this.say(throwText.tooShort);
        this.aimT = 0;
      } else if (c.down('throwAim') && !id && c.pressed('throwAim')) this.say(throwText.none);
    }
    // HUD badge: visible while aiming or briefly after switching
    this.badgeT -= dt;
    const cur = this.current();
    this.showBadge(cur && (this.aiming || this.badgeT > 0) ? throwText.hint(itemText[cur]?.name ?? cur, this.countOf(cur)) : null);

    if (this.pending && (this.pending.t -= dt) <= 0) {
      this.spawn(this.pending.id);
      this.pending = null;
    }
    this.stepProjectiles(dt);
    this.stepFires(dt);
    this.stepLight(dt);
    this.flames.update(dt);
    this.smoke.update(dt);
  }

  private rnd(a: number, b: number) {
    return a + this.ctx.rand() * (b - a);
  }
  /** A flame tongue at p: rises, shrinks, yellow to deep red. */
  private flame(p: Vector3, size: number, rise = 1.6) {
    this.flames.spawn(p, this.rnd(-0.25, 0.25), this.rnd(0.6, 1) * rise, this.rnd(-0.25, 0.25), this.rnd(0.45, 0.8), size * this.rnd(0.7, 1.2), -0.6, 0, '#ffd060', '#ff3a08');
  }
  private smokeBall(p: Vector3, size: number, life = 1.8, rise = 1.4) {
    this.smoke.spawn(p, this.rnd(-0.5, 0.5), this.rnd(0.5, 1) * rise, this.rnd(-0.5, 0.5), this.rnd(0.7, 1) * life, size, 1.4, 0.15, '#4a4540', '#1c1a19');
  }

  private startThrow(id: string) {
    const lo = this.ctx.weapons.loadout;
    let used = 0;
    try {
      used = lo.consume(id, 1);
    } catch {
      used = 0;
    }
    if (!used && !this.ctx.weapons.sandbox) return;
    this.cd = T.cooldownS;
    this.pending = { id, t: T.windupS };
    this.ctx.playerAnim?.oneshot('melee_swing', 0.08);
    this.ctx.weapons.vm.play('fp_shove', { timeScale: 1.5, leftOnly: true });
    this.ctx.sfx('melee_swing', this.ctx.player.curr, { volume: 0.7, pitchJitter: 0.1 });
    this.ctx.rig.kick(0, -0.5);
    if (this.countOf(id) <= 0) this.sel = 0;
  }

  /** Wire fences stop nothing a bullet passes: take them out of the thrown bodies' collision filter (cheap, idempotent). */
  private openFences() {
    const { world } = this.ctx.game.phys;
    world.forEachCollider((c) => {
      if (isMesh(c)) c.setCollisionGroups(c.collisionGroups() & ~Group.DEBRIS);
    });
  }

  private spawn(id: string) {
    const def = throwDefs[id];
    const { R, world } = this.ctx.game.phys;
    this.openFences();
    const sp = this.sp, sv = this.sv;
    this.launch(def, sp, sv);
    const body = world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(sp.x, sp.y, sp.z)
        .setLinvel(sv.x, sv.y, sv.z)
        .setAngvel({ x: (this.ctx.rand() - 0.5) * 18, y: (this.ctx.rand() - 0.5) * 6, z: (this.ctx.rand() - 0.5) * 18 })
        .setLinearDamping(0.04)
        .setAngularDamping(0.8)
        .setCcdEnabled(true),
    );
    const collider = world.createCollider(
      R.ColliderDesc.ball(def.radius).setRestitution(def.restitution).setFriction(0.9).setDensity(900).setCollisionGroups(groups(Group.DEBRIS, WORLD | Group.ZOMBIE)),
      body,
    );
    const mesh = look(def);
    mesh.position.copy(sp);
    this.ctx.game.scene.add(mesh);
    const pr: Proj = { def, mesh, body, collider, prevV: sv.clone(), age: 0, fuse: def.fuse ?? 0, burn: 0, lure: 0 };
    if (def.effect === 'flare') {
      pr.burn = T.flare.seconds;
      this.ctx.sfx('flare_ignite', sp);
    }
    this.projectiles.push(pr);
  }

  private remove(pr: Proj) {
    this.ctx.game.phys.world.removeRigidBody(pr.body);
    pr.mesh.removeFromParent();
    pr.mesh.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    const i = this.projectiles.indexOf(pr);
    if (i >= 0) this.projectiles.splice(i, 1);
  }

  private stepProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.age += dt;
      const t = pr.body.translation();
      const rot = pr.body.rotation();
      pr.mesh.position.set(t.x, t.y, t.z);
      pr.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      const lv = pr.body.linvel();
      _v.set(lv.x, lv.y, lv.z);
      const delta = _v.distanceTo(pr.prevV);
      pr.prevV.copy(_v);
      _p.set(t.x, t.y, t.z);
      const def = pr.def;
      if (t.y < -30 || (pr.age > T.maxLifeS && pr.burn <= 0)) {
        this.remove(pr);
        continue;
      }
      if (def.breaks && pr.age > 0.04 && delta > T.breakSpeed) {
        this.shatter(def, _p.clone());
        this.remove(pr);
        continue;
      }
      if (def.fuse !== null) {
        pr.fuse -= dt;
        // Blink toward the end of the fuse
        pr.mesh.visible = pr.fuse > 0.6 || Math.floor(pr.fuse * 10) % 2 === 0;
        if (pr.fuse <= 0) {
          this.explode(_p.clone());
          this.remove(pr);
          continue;
        }
      }
      if (def.effect === 'flare') {
        pr.burn -= dt;
        pr.lure -= dt;
        if (pr.lure <= 0) {
          pr.lure = T.flare.lureEveryS;
          this.ctx.game.events.emit('noise', { position: _p.clone(), radius: T.flare.lureRadius, source: 'flare' });
        }
        // red sparks and smoke
        if (this.ctx.rand() < dt * 18) this.ctx.fx.impact(_p, UP, 'metal', null, 0.25);
        if (this.ctx.rand() < dt * 5) this.smokeBall(_p, 0.18, 2.2, 0.7);
        this.flames.spawn(_p, this.rnd(-0.15, 0.15), this.rnd(0.4, 1), this.rnd(-0.15, 0.15), this.rnd(0.25, 0.45), 0.2 * this.rnd(0.7, 1.2), -0.5, 0, '#ffe8c0', '#ff2a10');
        if (pr.burn <= 0) this.remove(pr);
      }
    }
  }

  // ------------------------------------------------------------------ effects
  private noise(pos: Vector3, radius: number, source: string) {
    this.ctx.game.events.emit('noise', { position: pos.clone(), radius, source });
  }

  private shatter(def: ThrowDef, pos: Vector3) {
    if (def.effect === 'fire') {
      this.fires.push({ pos: pos.clone(), t: T.fire.seconds, tick: 0, flame: 0 });
      this.ctx.sfx('molotov_burst', pos);
      this.noise(pos, T.fire.noise, 'molotov');
      this.flash(pos, 0.5);
      for (let k = 0; k < 16; k++) {
        const a = this.rnd(0, Math.PI * 2), sp = this.rnd(1, 4);
        this.flames.spawn(_c.copy(pos).setY(pos.y + 0.1), Math.cos(a) * sp, this.rnd(0.5, 2.5), Math.sin(a) * sp, this.rnd(0.4, 0.8), this.rnd(0.4, 0.8), 0.6, 0, '#ffd060', '#ff3a08');
      }
    } else {
      this.ctx.sfx('glass_break', pos);
      this.noise(pos, T.noise.radius, 'bottle');
      this.ctx.fx.impact(pos, UP, 'metal', null, 0.8);
    }
  }

  private flash(pos: Vector3, s: number) {
    this.flashT = s;
    this.flashPos.copy(pos);
  }

  private los(from: Vector3, to: Vector3) {
    const { world } = this.ctx.game.phys;
    const d = _c.subVectors(to, from);
    const len = d.length();
    if (len < 0.1) return true;
    d.divideScalar(len);
    this.ray.origin = from;
    this.ray.dir = d;
    const h = world.castRay(this.ray, len, true, undefined, groups(Group.PROJECTILE, Group.STATIC | Group.TERRAIN | Group.BUILD), this.ctx.player.collider);
    return !h || h.timeOfImpact > len - 0.4;
  }

  private explode(pos: Vector3) {
    const F = T.frag;
    const ctx = this.ctx;
    const origin = pos.clone().setY(pos.y + 0.35);
    let hit = 0;
    let killed = 0;
    let hurt = 0;
    for (const z of ctx.zombies.list as Zombie[]) {
      if (!z.alive) continue;
      const chest = _p.set(z.curr.x, z.curr.y + 1, z.curr.z);
      const d = chest.distanceTo(origin);
      if (d > F.radius || !this.los(origin, chest)) continue;
      const frac = 1 - (1 - F.minFrac) * (d / F.radius);
      const dmg = F.damage * frac;
      const dir = _r.subVectors(chest, origin).setY(0.15).normalize();
      hit++;
      if (dmg >= z.hp) z.fling.set(dir.x, 0, dir.z).setLength(5 + 4 * frac).setY(2.5 + 2 * frac);
      const res = ctx.zombies.damage(z, { point: chest.clone(), dir: dir.clone(), zone: 'body', damage: dmg / z.def.zoneMul.body, headMul: 1, weaponId: 'frag_grenade', distance: d, melee: { stagger: F.stagger, push: F.push * frac, hitstop: 0 } });
      if (res?.kill) killed++;
    }
    const pd = _p.set(ctx.player.curr.x, ctx.player.curr.y + 1, ctx.player.curr.z).distanceTo(origin);
    if (pd < F.playerRadius && this.los(origin, _p)) {
      const frac = 1 - pd / F.playerRadius;
      ctx.player.damage(F.playerDamage * Math.max(0.15, frac), origin);
      hurt = F.playerDamage * Math.max(0.15, frac);
    }
    this.lastBlast = { zombies: hit, killed, playerHurt: hurt };
    ctx.sfx('explosion', pos, { twoD: false });
    this.noise(pos, F.noise, 'explosion');
    const cam = ctx.game.camera.position.distanceTo(pos);
    ctx.rig.addTrauma(F.trauma * Math.max(0, 1 - cam / 45));
    ctx.rig.kick(2 * Math.max(0, 1 - cam / 40), -2);
    this.flash(origin, 0.45);
    // Fireball: a filled, bright core that swells, flame blobs spread through the whole ball (not a shell), then a smoke column
    for (let k = 0; k < 6; k++) {
      this.flames.spawn(_c.set(origin.x + this.rnd(-0.3, 0.3), origin.y + this.rnd(0, 0.5), origin.z + this.rnd(-0.3, 0.3)), 0, this.rnd(0.5, 1.5), 0, this.rnd(0.45, 0.7), this.rnd(1.6, 2.4), 1.2, 0, '#fff6c0', '#ff9a30');
    }
    for (let k = 0; k < 70; k++) {
      const a = this.rnd(0, Math.PI * 2), r = Math.sqrt(this.ctx.rand()) * 1.5, e = this.rnd(0, 1.8);
      const sp = this.rnd(0.4, 2.2);
      this.flames.spawn(_c.set(origin.x + Math.cos(a) * r, origin.y + e * 0.6, origin.z + Math.sin(a) * r), Math.cos(a) * sp, this.rnd(0.6, 3), Math.sin(a) * sp, this.rnd(0.4, 0.95), this.rnd(0.7, 1.3), this.rnd(1, 1.9), 0, k % 3 ? '#ffc850' : '#ffe6a0', '#c8280a');
    }
    for (let k = 0; k < 22; k++) {
      const a = this.rnd(0, Math.PI * 2), sp = this.rnd(0.3, 2.5);
      this.smoke.spawn(_c.set(origin.x, origin.y + this.rnd(0.2, 1.2), origin.z), Math.cos(a) * sp, this.rnd(1.5, 4.5), Math.sin(a) * sp, this.rnd(1.8, 3.4), this.rnd(1.2, 2.6), 1.8, 0.2, '#585049', '#1c1a19');
    }
    ctx.fx.impact(origin, UP, 'metal', null, 3);
    ctx.fx.impact(origin, UP, 'dirt', null, 2.5);
    ctx.fx.freeze(0.04);
  }

  private stepFires(dt: number) {
    const F = T.fire;
    const ctx = this.ctx;
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.t -= dt;
      if (f.t <= 0) {
        this.fires.splice(i, 1);
        continue;
      }
      const fade = Math.min(1, f.t / 2); // dies down over the last 2 s
      // Flames (translucent orange puffs rising), a little dark smoke and sparks
      f.flame += dt * 22 * fade;
      while (f.flame >= 1) {
        f.flame -= 1;
        const a = ctx.rand() * Math.PI * 2;
        const r = Math.sqrt(ctx.rand()) * F.radius * 0.85;
        _p.set(f.pos.x + Math.cos(a) * r, f.pos.y + 0.05, f.pos.z + Math.sin(a) * r);
        this.flame(_p, 0.5 + ctx.rand() * 0.5, 1.2 + (1 - r / F.radius) * 1.2);
      }
      if (ctx.rand() < dt * 5) this.smokeBall(_p.set(f.pos.x + this.rnd(-1, 1), f.pos.y + 0.9, f.pos.z + this.rnd(-1, 1)), 0.7);
      if (ctx.rand() < dt * 6) ctx.fx.impact(_p.set(f.pos.x + (ctx.rand() - 0.5) * F.radius, f.pos.y + 0.1, f.pos.z + (ctx.rand() - 0.5) * F.radius), UP, 'metal', null, 0.2);
      f.tick -= dt;
      if (f.tick <= 0) {
        f.tick = F.tickS;
        for (const z of ctx.zombies.list as Zombie[]) {
          if (!z.alive) continue;
          if (Math.hypot(z.curr.x - f.pos.x, z.curr.z - f.pos.z) > F.radius || Math.abs(z.curr.y - f.pos.y) > 2.2) continue;
          _r.set(z.curr.x - f.pos.x, 0.2, z.curr.z - f.pos.z).normalize();
          ctx.zombies.damage(z, { point: _c.set(z.curr.x, z.curr.y + 1, z.curr.z).clone(), dir: _r.clone(), zone: 'body', damage: (F.dps * F.tickS) / z.def.zoneMul.body, headMul: 1, weaponId: 'molotov', distance: 0, melee: { stagger: F.stagger, push: 0, hitstop: 0 } });
        }
        const p = ctx.player;
        if (!p.dead && Math.hypot(p.curr.x - f.pos.x, p.curr.z - f.pos.z) < F.radius * 0.8 && Math.abs(p.curr.y - f.pos.y) < 1.6) p.hurt(F.playerDps * F.tickS, 'fire');
      }
    }
  }

  /** One shared PointLight lights the nearest burning thing (a new light per fire would recompile every shader). */
  private stepLight(dt: number) {
    let best: Vector3 | null = null;
    let bd = 1e9;
    let kind = 'flash' as 'fire' | 'flare' | 'flash';
    const cam = this.ctx.game.camera.position;
    const consider = (p: Vector3, k: 'fire' | 'flare') => {
      const d = p.distanceToSquared(cam);
      if (d < bd) {
        bd = d;
        best = p;
        kind = k;
      }
    };
    for (const f of this.fires) consider(f.pos, 'fire');
    for (const pr of this.projectiles) if (pr.def.effect === 'flare' && pr.burn > 0) consider(pr.mesh.position, 'flare');
    const L = this.light;
    const flick = 0.8 + 0.2 * Math.sin(this.time * 31) * Math.sin(this.time * 17 + 1);
    if (this.flashT > 0) {
      this.flashT -= dt;
      L.position.copy(this.flashPos);
      L.color.set('#ffb060');
      L.distance = 28;
      L.intensity = Math.max(0, (this.flashT / 0.45) * 14);
    } else if (best) {
      const p = best as Vector3;
      L.position.set(p.x, p.y + (kind === 'fire' ? 1.2 : 0.4), p.z);
      if (kind === 'fire') {
        L.color.set(T.fire.lightColor);
        L.distance = T.fire.lightRange;
        L.intensity = T.fire.lightIntensity * flick;
      } else {
        L.color.set(T.flare.lightColor);
        L.distance = T.flare.lightRange;
        L.intensity = T.flare.lightIntensity * flick;
      }
    } else L.intensity = 0;
  }
}

declare module '../ctx' {
  interface Ctx {
    throwables: Throwables;
  }
}
