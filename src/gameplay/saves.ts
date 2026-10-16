import { Vector3 } from 'three';
import { weaponSlots } from '../content/data/weapons';
import { zombieDefs } from '../content/data/zombies';
import { probe, type Ctx } from './ctx';

/**
 * M2 save sections owned by mechanics (game.save, systems). Plain JSON only.
 * - 'player': transform, look, hp, stamina, held slot, camera mode, crouch.
 * - 'vehicles': transform, HP (engine dead = HP 0). No fuel yet.
 * - 'corpses': position, variant, fall direction, time left (systems re-registers the searchable bodies from the
 *   zombieKilled events the restored corpses emit).
 * - 'zombies': intentionally empty. Principles §6/§12: nothing respawns on load, so the living zombies are not saved
 *   and a load leaves the pen empty (the F1 spawners refill it).
 * Loads teleport with zero velocities (no physics explosions) and reset transient gameplay state.
 */
interface PlayerSave { x: number; y: number; z: number; yaw: number; pitch: number; hp: number; stamina: number; slot: number; cam: 'tp' | 'fp'; crouched: boolean }
interface CarSave { id: string; p: [number, number, number]; q: [number, number, number, number]; hp: number }
interface CorpseSave { variant: string; x: number; y: number; z: number; fallDir: number; left: number }

export function installSaves(ctx: Ctx) {
  const game = ctx.game;
  const save = probe(game, 'save', 'section');
  // Transient state never survives a load (reloads in progress, melee/finisher, hitstop, driving)
  game.events.on('loaded', () => resetTransient(ctx));
  if (!save) return;

  save.section('player', {
    version: 1,
    save: (): PlayerSave => {
      const p = ctx.player;
      return { x: p.curr.x, y: p.curr.y, z: p.curr.z, yaw: p.yaw, pitch: p.pitch, hp: p.hp, stamina: p.stamina.value, slot: ctx.weapons.slot, cam: ctx.rig.mode, crouched: p.crouched };
    },
    load: (d) => {
      const s = d as PlayerSave;
      const p = ctx.player;
      if (p.inVehicle) ctx.vehicles.exit();
      p.dead = false;
      p.teleport(new Vector3(s.x, s.y + 0.05, s.z), s.yaw);
      p.setLook(s.yaw, s.pitch);
      p.hp = Math.max(1, Math.min(p.maxHp, s.hp));
      p.stamina.value = s.stamina;
      p.stamina.exhausted = false;
      ctx.rig.mode = s.cam;
      ctx.facing.yaw = ctx.facing.prevYaw = s.yaw;
      if (s.slot >= 0 && s.slot < weaponSlots.length && ctx.weapons.loadout.equipped(weaponSlots[s.slot])) ctx.weapons.select(s.slot);
    },
  });

  save.section('vehicles', {
    version: 1,
    save: (): CarSave[] =>
      ctx.vehicles.list.map((c) => {
        const t = c.body.translation();
        return { id: c.def.id, p: [t.x, t.y, t.z] as [number, number, number], q: [c.currQuat.x, c.currQuat.y, c.currQuat.z, c.currQuat.w] as [number, number, number, number], hp: c.hp };
      }),
    load: (d) => {
      const list = d as CarSave[];
      if (ctx.vehicles.driving) ctx.vehicles.exit();
      list.forEach((s, i) => {
        const car = ctx.vehicles.list[i]?.def.id === s.id ? ctx.vehicles.list[i] : ctx.vehicles.list.find((c) => c.def.id === s.id);
        if (!car) return;
        car.body.setTranslation({ x: s.p[0], y: s.p[1] + 0.05, z: s.p[2] }, true);
        car.body.setRotation({ x: s.q[0], y: s.q[1], z: s.q[2], w: s.q[3] }, true);
        car.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        car.hp = s.hp;
        car.steer = 0;
        ctx.vehicles.resync(car);
      });
    },
  });

  save.section('corpses', {
    version: 1,
    save: (): CorpseSave[] =>
      ctx.zombies.list.filter((z) => !z.alive && z.deadT > 0).map((z) => ({ variant: z.def.id, x: z.curr.x, y: z.curr.y, z: z.curr.z, fallDir: z.fallDir, left: z.deadT })),
    load: (d) => {
      ctx.zombies.clear(); // living zombies too: nothing respawns on load
      for (const c of d as CorpseSave[]) {
        if (!zombieDefs[c.variant]) continue;
        void ctx.zombies.spawn(new Vector3(c.x, c.y + 0.05, c.z), 0, c.variant).then((z) => {
          z.headKill = true; // drop straight into the held pose
          ctx.zombies.die(z, new Vector3(Math.sin(c.fallDir), 0, Math.cos(c.fallDir)), false, true);
          z.deadT = Math.max(2, c.left);
        });
      }
    },
  });

  save.section('zombies', { version: 1, save: () => [], load: () => {} });
}

export function resetTransient(ctx: Ctx) {
  ctx.weapons.cancelReload();
  ctx.melee.phase = 'idle';
  ctx.player.locked = false;
  ctx.player.vault = null;
  ctx.player.collider.setEnabled(!ctx.player.inVehicle);
  ctx.rig.trauma = 0;
  ctx.rig.override = ctx.player.inVehicle ? ctx.rig.override : null;
  for (const z of ctx.zombies.list) z.hitstop = 0;
}
