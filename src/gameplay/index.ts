import { Box3, BoxGeometry, Mesh, Quaternion, Vector3, type Material } from 'three';
import { BodyFacing } from './player/facing';
import { bodyFacing as BF } from '../content/data/player';
import type { Game } from '../core/game';
import { cameraFeel, health, movement, stamina } from '../content/data/player';
import { ballistics, meleeDefs, shove, weaponDefs } from '../content/data/weapons';
import { horde, senses, zombieDefs } from '../content/data/zombies';
import { fxTuning } from '../content/data/fx';
import { surfaceOf } from '../world/surfaces';
import { vehicles as vehicleDefs } from '../content/data/vehicles';
import { Hud } from '../ui/hud/hud';
import { AnimationController, applyPose, makeCharacter } from './animstand/character';
import { AnimStand } from './animstand/stand';
import { CameraRig } from './camera/rig';
import { createCtx, type Ctx } from './ctx';
import { Fx } from './fx/fx';
import { Interact } from './interact/interact';
import { Melee } from './melee/melee';
import { Player } from './player/player';
import { Vehicles } from './vehicles/vehicles';
import { Targets } from './weapons/targets';
import { sandboxLoadout, Weapons } from './weapons/weapons';
import { Zombies } from './zombies/zombies';

const _cq = new Quaternion();
const _q1 = new Quaternion();
const _q2 = new Quaternion();
const _ax = new Vector3();
const DEG2 = Math.PI / 180;
const easeInOut = (t: number) => t * t * (3 - 2 * t);

/** mechanics-builder: player controller + camera, weapons, melee, zombies, vehicles, interactions, HUD. Fills game.player. */
export async function installGameplay(game: Game): Promise<void> {
  const ctx = createCtx(game) as Ctx;
  ctx.fx = new Fx(game.scene);
  ctx.player = new Player(ctx);
  game.player = ctx.player;
  ctx.rig = new CameraRig(ctx);
  ctx.weapons = new Weapons(ctx);
  ctx.melee = new Melee(ctx);
  ctx.interact = new Interact(ctx);
  ctx.zombies = new Zombies(ctx);
  ctx.vehicles = new Vehicles(ctx);
  ctx.targets = new Targets(ctx);
  ctx.animStand = new AnimStand(ctx);
  ctx.facing = new BodyFacing(ctx);
  ctx.hud = new Hud(ctx);

  // Player body (third person)
  const body = await makeCharacter('survivor', 'chr_survivor_a');
  ctx.playerChar = body;
  game.scene.add(body.root);
  const bodyAnim = body.skinned ? new AnimationController(body) : null;
  ctx.playerAnim = bodyAnim;
  const chest = bodyAnim?.bone('chest') ?? null;
  const head = bodyAnim?.bone('head') ?? null;
  const shoulderL = bodyAnim?.bone('shoulder_L') ?? null;
  const shoulderR = bodyAnim?.bone('shoulder_R') ?? null;
  // Near-body fade (QA-064): a dithered (alphaHash, stays in the opaque pass) copy of each body material. A hidden
  // warm-up mesh keeps it in the scene so game.start()'s compileAsync builds the pipeline (no first-use hitch).
  const fadeMats = new Map<Material, Material>();
  const bodyMeshes: Mesh[] = [];
  body.root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    let f = fadeMats.get(m.material);
    if (!f) {
      f = m.material.clone();
      Object.assign(f, { alphaHash: true, opacity: cameraFeel.bodyFadeOpacity });
      fadeMats.set(m.material, f);
    }
    bodyMeshes.push(m);
    m.userData.solid = m.material;
    m.userData.faded = f;
  });
  for (const f of fadeMats.values()) {
    const warm = new Mesh(new BoxGeometry(0.01, 0.01, 0.01), f);
    warm.position.set(0, -50, 0);
    game.scene.add(warm);
  }
  let faded = false;
  await ctx.weapons.init(body.hand);
  await Promise.all([ctx.targets.init(), ctx.vehicles.init(), ctx.animStand.init()]);

  const perf = game.perf;
  let wasDead = false;
  game.addSystem({
    name: 'sim',
    step(dt) {
      if (game.input.justPressed('F1') || game.input.justPressed('Escape')) ctx.hud.helpOpen = false;
      ctx.player.step(dt);
      ctx.rig.step(dt);
      ctx.melee.step(dt);
      ctx.weapons.step(dt);
      ctx.facing.step(dt);
      ctx.interact.step(dt);
      ctx.vehicles.step(dt);
      ctx.targets.step(dt);
      ctx.hud.step();
    },
  });
  game.addSystem({
    name: 'ai',
    step(dt) {
      ctx.zombies.step(dt);
      ctx.controls.endTick();
    },
    render(alpha, dt) {
      perf.begin('anim');
      ctx.player.render(alpha);
      ctx.vehicles.render(alpha);
      ctx.rig.render(alpha, dt);
      ctx.weapons.render(alpha, dt);
      ctx.zombies.render(alpha, dt);
      ctx.targets.render();
      ctx.animStand.render(alpha, dt);
      perf.end('anim');
      perf.begin('fx');
      ctx.fx.update(dt, game.camera.position);
      perf.end('fx');
      perf.begin('anim');
      // Player body
      const p = ctx.player;
      body.root.visible = !p.inVehicle && !ctx.rig.firstPerson;
      const near = body.root.visible && game.camera.position.distanceTo(p.eye) < cameraFeel.bodyFadeDist;
      if (near !== faded) {
        faded = near;
        for (const m of bodyMeshes) m.material = m.userData[near ? 'faded' : 'solid'];
      }
      body.root.position.copy(p.position);
      body.root.rotation.set(0, ctx.facing.render(alpha), 0);
      const pose = body.pose;
      pose.walkPhase = p.stepPhase;
      pose.speed01 = p.speed01;
      pose.crouch = p.crouchT;
      pose.lean = p.sprinting ? 0.2 : 0;
      pose.swing = ctx.melee.swingVis * (ctx.melee.phase === 'idle' ? 0 : 1);
      pose.armRaise = ctx.melee.phase === 'shove' ? Math.max(0, ctx.melee.swingVis) : 0;
      if (p.dead && !wasDead) bodyAnim?.oneshot('death', 0.1, true);
      if (!p.dead && wasDead) bodyAnim?.base('idle', 0.1, 1, true);
      wasDead = p.dead;
      if (p.dead && !bodyAnim) {
        body.root.rotateX(-1.4);
        pose.hold = 'none';
      }
      if (bodyAnim) {
        // Locomotion clip by gait, playback rate matched to ground speed (no foot sliding)
        const sp = p.speed01 * movement.jog;
        const [clip, ref] = p.crouched ? (p.gait === 'idle' ? ['crouch_idle', 0] : ['crouch_walk', movement.crouch]) : p.gait === 'sprint' ? ['sprint', movement.sprint] : p.gait === 'jog' ? ['run', movement.jog] : p.gait === 'walk' ? ['walk', movement.walk] : ['idle', 0];
        bodyAnim.base(clip as string, 0.2, ref ? Math.max(0.5, Math.min(1.5, sp / (ref as number))) : 1);
        const w = ctx.weapons;
        const cls = w.def?.class === 'pistol' ? 'pistol' : 'rifle';
        const gun = !!w.item && !w.isMelee && !p.dead;
        const raise = gun ? easeInOut(w.raiseT) : 0;
        // Rifle low-ready keeps the two-handed aim pose and swings it down; the pistol drops to the side (one hand)
        bodyAnim.overlay(`aim_${cls}`, gun ? (cls === 'pistol' ? raise : 1) * (1 - pose.holster) : 0);
        bodyAnim.update(dt);
        // Upper body follows the aim pitch only when raised (clips are authored level)
        if (chest && gun) chest.rotation.x -= p.pitch * 0.7 * raise * (1 - pose.holster);
        if (gun && chest && shoulderL && shoulderR && raise < 1) {
          const low = 1 - raise;
          const yaw = body.root.rotation.y;
          chest.updateWorldMatrix(true, false);
          chest.getWorldQuaternion(_cq).invert();
          // Rotating both shoulders about the same body axis keeps the two-handed grip rigid
          _ax.set(Math.cos(yaw), 0, -Math.sin(yaw)).applyQuaternion(_cq); // body right, in chest space
          const down = (cls === 'pistol' ? BF.pistolLowDeg : BF.lowReadyDeg) * DEG2;
          _q1.setFromAxisAngle(_ax, -down * low);
          if (cls === 'rifle') {
            _ax.set(0, 1, 0).applyQuaternion(_cq); // tuck across the body (toward the left)
            _q1.premultiply(_q2.setFromAxisAngle(_ax, BF.lowReadyTuckDeg * DEG2 * low));
            shoulderL.quaternion.premultiply(_q1);
          }
          shoulderR.quaternion.premultiply(_q1);
        }
        // Head looks toward the camera when the body doesn't follow it
        if (head && !p.dead) head.rotation.y += ctx.facing.headYaw() * (1 - raise) * 0.85;
      } else applyPose(body);
      perf.end('anim');
      perf.begin('ui');
      ctx.hud.render(dt);
      perf.end('ui');
    },
  });

  // Casing tink on first ground contact (fx data), FX accessibility settings (menu settings if present)
  ctx.fx.onCasingLand = (p) => ctx.sfx(fxTuning.casingSound, p, { volume: fxTuning.casingVolume, pitchJitter: 0.06 });
  try {
    const st = JSON.parse(localStorage.getItem('pv.settings.v1') ?? '{}') as { reduceFlashing?: boolean; gore?: 'full' | 'reduced' | 'off' };
    if (st.reduceFlashing !== undefined) fxTuning.reduceFlashing = st.reduceFlashing;
    if (st.gore) fxTuning.gore = st.gore;
  } catch {
    /* storage unavailable: defaults */
  }
  installDebug(ctx);
  // Playwright / console hooks (pointer lock may not engage under automation)
  (window as unknown as { __gp: unknown }).__gp = {
    ctx,
    /** Live data tables (the same module instances the game uses, also after HMR). */
    data: { horde, zombieDefs, senses, fxTuning, cameraFeel, movement },
    surfaceOf,
    setLook: (yaw: number, pitch: number) => ctx.player.setLook(yaw, pitch),
    look: (dx: number, dy: number) => ((ctx.controls.lookDx += dx), (ctx.controls.lookDy += dy)),
    mouse: (button: 0 | 2, held: boolean) => ctx.controls.press('Mouse' + button, held),
    spawn: (n: number) => ctx.zombies.spawnInPen(n),
    sandbox: () => {
      ctx.weapons.loadout = sandboxLoadout();
      ctx.weapons.sandbox = true;
      ctx.weapons.select(0);
    },
    /** Aim the camera ray at a world point (yaw/pitch from the camera position). */
    aimAt: (x: number, y: number, z: number) => {
      const o = new Vector3();
      const d = new Vector3();
      for (let i = 0; i < 4; i++) {
        ctx.rig.aimRay(o, d);
        const dx = x - o.x, dy = y - o.y, dz = z - o.z;
        ctx.player.setLook(Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
      }
    },
    /** Look at the nearest living zombie (head height `h`). Returns its distance. */
    faceZombie: (h = 1.2) => {
      const pc = ctx.player.curr;
      let best: (typeof ctx.zombies.list)[number] | null = null;
      for (const z of ctx.zombies.list) if (z.alive && (!best || z.curr.distanceTo(pc) < best.curr.distanceTo(pc))) best = z;
      if (!best) return -1;
      (window as unknown as { __gp: { aimAt(x: number, y: number, z: number): void } }).__gp.aimAt(best.curr.x, best.curr.y + h, best.curr.z);
      return best.curr.distanceTo(pc);
    },
    targets: () => ctx.targets.list.map((t) => ({ id: t.id, d: t.distance, kind: t.kind, pos: new Box3().setFromObject(t.object).getCenter(new Vector3()).toArray() })),
    teleport: (x: number, z: number, yaw = 0) => ctx.player.teleport(new Vector3(x, 0.1, z), yaw),
    state: () => ({
      pos: ctx.player.curr.toArray(),
      hp: ctx.player.hp,
      stamina: ctx.player.stamina.value,
      weapon: ctx.weapons.item?.defId,
      ammo: ctx.weapons.ammo(),
      last: ctx.weapons.lastShot,
      zombies: ctx.zombies.list.map((z) => ({ id: z.id, alive: z.alive, hp: z.hp, aw: z.sense.awareness, mode: z.mode, pos: z.curr.toArray() })),
      car: ctx.vehicles.list[0] ? { pos: ctx.vehicles.list[0].currPos.toArray(), speed: ctx.vehicles.list[0].speed } : null,
      inVehicle: ctx.player.inVehicle,
      cam: ctx.rig.mode,
    }),
  };
}

function installDebug(ctx: Ctx) {
  const d = ctx.debug;
  const p = ctx.player;
  d.toggle('Player', p as unknown as Record<string, unknown>, 'godMode');
  d.action('Player', 'Heal', () => (p.hp = health.max));
  d.action('Player', 'Respawn', () => p.respawn());
  for (const k of ['jog', 'sprint', 'crouch', 'accelTime', 'stopTime', 'sprintRamp', 'airControl', 'jumpVelocity', 'gravity', 'vaultTime'] as const)
    d.tune('Player', movement, k, 0, k === 'gravity' ? 40 : k.endsWith('Time') || k === 'sprintRamp' || k === 'airControl' ? 1 : 12, 0.01);
  for (const k of ['sprintPerSec', 'regenPerSec', 'regenDelay', 'exhaustedUntil'] as const) d.tune('Player', stamina, k, 0, 60, 0.5);
  d.watch('Player', 'state', () => `${p.gait} ${p.grounded ? 'ground' : 'air'} ${p.speed01.toFixed(2)}×jog st ${p.stamina.value.toFixed(0)}${p.stamina.exhausted ? ' EXH' : ''}`);

  d.action('Camera', 'Toggle first / third person', () => (ctx.rig.mode = ctx.rig.mode === 'tp' ? 'fp' : 'tp'));
  d.tune('Camera', cameraFeel, 'fovFp', 70, 100, 1);
  d.tune('Camera', cameraFeel, 'fovHip', 55, 90, 1);
  d.tune('Camera', cameraFeel, 'armHip', 1, 5, 0.05);
  d.tune('Camera', cameraFeel, 'armAds', 0.5, 3, 0.05);
  d.tune('Camera', cameraFeel, 'shoulderX', 0, 1, 0.01);
  d.tune('Camera', cameraFeel, 'shake', 0, 1, 0.05);
  d.toggle('Camera', cameraFeel, 'headBob');
  d.tune('Camera', cameraFeel, 'swayLag', 0.01, 0.2, 0.005);

  const w = ctx.weapons;
  d.action('Weapons', 'Sandbox loadout (infinite mags)', () => {
    w.loadout = sandboxLoadout();
    w.sandbox = true;
    w.select(0);
  });
  d.watch('Weapons', 'held', () => `${w.item?.defId ?? 'empty'} ${w.fireMode()} spread ${w.spread.toFixed(2)}° ${w.sandbox ? '(sandbox)' : ''}`);
  for (const id of Object.keys(weaponDefs)) {
    const def = weaponDefs[id] as unknown as Record<string, unknown>;
    const g = `Weapon ${id}`;
    d.tune(g, def, 'rpm', 60, 1000, 10);
    d.tune(g, def, 'damage', 5, 150, 1);
    d.tune(g, def, 'headMul', 1, 6, 0.1);
    d.tune(g, def, 'muzzleVelocity', 100, 1000, 5);
    d.tune(g, def.recoilPitch as unknown as Record<string, unknown>, '0', 0, 3, 0.05);
    d.tune(g, def.recoilPitch as unknown as Record<string, unknown>, '1', 0, 3, 0.05);
    d.tune(g, def, 'recoilYaw', 0, 1, 0.01);
    d.tune(g, def, 'recoverPerSec', 1, 30, 0.2);
    d.tune(g, def, 'hipSpread', 0, 8, 0.1);
    d.tune(g, def, 'adsSpread', 0, 2, 0.05);
    d.tune(g, def, 'bloomPerShot', 0, 2, 0.05);
    d.tune(g, def, 'adsMs', 50, 600, 10);
    d.tune(g, def, 'reloadTacticalS', 0.5, 4, 0.05);
    d.tune(g, def, 'reloadEmptyS', 0.5, 4, 0.05);
  }
  d.tune('Weapons', ballistics, 'drag', 0, 0.5, 0.01);
  d.tune('Weapons', ballistics, 'bloomRecoverPerSec', 1, 30, 0.5);
  for (const k of ['damage', 'reach', 'windup', 'active', 'recovery', 'hitstopLight', 'hitstopHeavy'] as const) d.tune('Melee', meleeDefs.knife_a as unknown as Record<string, unknown>, k, 0, k === 'damage' ? 150 : 2.5, 0.01);
  d.tune('Melee', shove, 'range', 0.5, 4, 0.1);
  d.toggle('FX', fxTuning as unknown as Record<string, unknown>, 'reduceFlashing');
  d.action('FX', 'Gore: full / reduced / off', () => {
    fxTuning.gore = fxTuning.gore === 'full' ? 'reduced' : fxTuning.gore === 'reduced' ? 'off' : 'full';
    ctx.game.events.emit('toast', { text: `Gore: ${fxTuning.gore}` });
  });
  d.tune('FX', fxTuning as unknown as Record<string, unknown>, 'lightPeak', 0, 8, 0.1);
  d.tune('FX', fxTuning as unknown as Record<string, unknown>, 'tracerSpeed', 100, 600, 10);
  d.tune('Melee', shove, 'coneDeg', 30, 180, 5);

  const z = ctx.zombies;
  d.action('Zombies', 'Spawn 1', () => void z.spawnInPen(1));
  d.action('Zombies', 'Spawn 5', () => void z.spawnInPen(5));
  d.action('Zombies', 'Spawn 20', () => void z.spawnInPen(20));
  d.action('Zombies', 'Kill all', () => z.killAll());
  d.action('Zombies', 'Clear (incl. corpses)', () => z.clear());
  d.toggle('Zombies', horde, 'passive');
  d.toggle('Zombies', horde, 'showSenses');
  d.tune('Zombies', horde, 'attackTokens', 1, 6, 1);
  const zd = zombieDefs.shambler as unknown as Record<string, unknown>;
  d.tune('Zombies', zd, 'chase', 0.5, 5, 0.1);
  d.tune('Zombies', zd, 'hp', 20, 400, 5);
  d.tune('Zombies', zd, 'attackWindup', 0.2, 1.5, 0.05);
  d.tune('Zombies', zd, 'attackDamage', 0, 60, 1);
  d.tune('Zombies', senses, 'coneDeg', 30, 180, 5);
  d.tune('Zombies', senses, 'rangeDay', 5, 60, 1);
  d.watch('Zombies', 'alive', () => `${z.alive} alive, ${z.kills} killed`);

  const v = ctx.vehicles;
  d.action('Vehicle', 'Go to car', () => {
    const car = v.list[0];
    // A step out from the door, so the capsule never pokes into the body
    if (car) p.teleport(car.doorPos.clone().sub(car.currPos).setY(0).setLength(1.8).add(car.currPos).setY(car.currPos.y + 0.1), 0);
  });
  d.action('Vehicle', 'Flip / reset car', () => v.list[0] && v.flipReset(v.list[0]));
  d.action('Vehicle', 'Repair car', () => v.list.forEach((c) => (c.hp = c.def.hp)));
  d.watch('Vehicle', 'car hp', () => v.list.map((c) => `${c.def.id} ${Math.ceil(c.hp)}`).join(', '));
  for (const def of Object.values(vehicleDefs)) {
    const r = def as unknown as Record<string, unknown>;
    for (const k of ['engineForce', 'brakeForce', 'frictionSlip', 'suspensionStiffness', 'suspensionDamping', 'maxSteerDeg', 'steerAtSpeed', 'topSpeedKmh', 'camDist', 'camHeight'] as const)
      d.tune(`Vehicle ${def.id}`, r, k, 0, k === 'engineForce' ? 20000 : k === 'brakeForce' ? 400 : k === 'topSpeedKmh' ? 200 : k === 'steerAtSpeed' ? 1 : 60, 0.05);
  }
  // Station teleports live in the engine's F1 → Teleport group (QA-025: no duplicates here)
}

declare module './ctx' {
  interface Ctx {
    playerChar: import('./animstand/character').Character;
    playerAnim: AnimationController | null;
  }
}
