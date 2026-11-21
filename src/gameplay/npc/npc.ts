import { Group, Object3D, Quaternion, Vector3, type AnimationAction, LoopOnce, LoopRepeat } from 'three';
import { NPCS, NPC_FEEL, type NpcDef } from '../../content/data/npc';
import { BUILDINGS } from '../../content/data/outskirts';
import { buildingWorld } from '../../content/data/pois';
import { itemText } from '../../content/text/items';
import { npcName, npcUi, tradeUi } from '../../content/text/npc';
import { loadModel } from '../../engine/models';
import { Group as PGroup, groups } from '../../engine/physics';
import { Dialogue, type DialogueEnv } from '../../systems/dialogue';
import { newItems } from '../../systems/inventory';
import type { Loadout } from '../../systems/loadout';
import { buy, newTraderState, refresh, sell, type TraderState } from '../../systems/trade';
import { worldHooks } from '../../systems/worldHooks';
import { NpcUi } from '../../ui/npc/npcUi';
import type { Ctx } from '../ctx';

/**
 * Friendly NPCs (data/npc.ts): stationary Polyfork characters playing our survivor idle clips, head turning toward the
 * player when near, a conversation on E and, for the trader, a trade screen. NPCs are NOT zombie targets for now:
 * they register nothing with the zombie senses and nothing in `ctx.hits`, so zombies ignore them, and bullets and
 * blades treat their collider like scenery. Their state (dialogue flags, the trader's stock and till) is saved in the
 * 'npc' section (version 1).
 *
 * Models: chr_npc_<name>, built with tools/audit/retarget_pf_hero.py from the Polyfork characters credited in CREDITS.md.
 * A model that is not built yet is skipped (the NPC is simply not there), so the game still runs.
 */
export interface NpcSave {
  flags: string[];
  trader: TraderState;
}
export const NPC_SAVE_VERSION = 1;

interface Live {
  def: NpcDef;
  root: Group;
  mixer: import('three').AnimationMixer;
  actions: Map<string, AnimationAction>;
  idle: AnimationAction | null;
  head: Object3D | null;
  yaw: number;
  pitch: number;
  nextIdle: number;
  snapped: boolean;
  pos: Vector3;
  baseYaw: number;
  /** A gesture playing: the idle comes back when `t` runs out. */
  back: { gesture: AnimationAction; t: number } | null;
  /** Talk loop, and whether the talk pose is on. */
  talkA: AnimationAction | null;
  talking: boolean;
}

const _q = new Quaternion();
const _q2 = new Quaternion();
const _v = new Vector3();
const _w = new Vector3();
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function spot(def: NpcDef) {
  if ('building' in def.at) {
    const b = BUILDINGS.find((x) => x.id === (def.at as { building: string }).building)!;
    const w = buildingWorld(b, def.at.u, def.at.v);
    return { x: w.x, z: w.z, yaw: b.yaw + Math.PI }; // faces out of the front wall
  }
  return def.at;
}

export async function installNpcs(ctx: Ctx) {
  const game = ctx.game;
  const lo = () => game.loadout as unknown as Loadout;
  const flags = new Set<string>();
  const trader = newTraderState();
  const live: Live[] = [];
  let talkingTo: string | null = null;

  // ---------------- UI and conversation ----------------
  const toast = (text: string, icon?: string) => game.events.emit('toast', { text, icon });
  const envFor = (_npc: string): DialogueEnv => ({
    count: (i) => lo().countAll(i),
    take: (i, n) => {
      lo().consume(i, n);
      toast(npcUi.gave(itemText[i]?.name ?? i, n));
    },
    give: (i, n) => {
      for (const it of newItems(i, n)) lo().give(it);
      toast(npcUi.got(itemText[i]?.name ?? i, n), i);
    },
    flag: (f) => flags.has(f),
    setFlag: (f) => void flags.add(f),
    questStatus: (id) => worldHooks.quests?.status(id) ?? 'locked',
    objectives: () => worldHooks.quests?.objectives() ?? [],
    hand: (n, item) => worldHooks.quests?.report({ type: 'give', npc: n, item }),
    openTrade: () => {
      refresh(trader, game.time.day);
      ui.openTrade(lo(), trader);
    },
  });
  const ui = new NpcUi(
    {
      sfx: (id) => ctx.sfx(id),
      onOpenChange: (open) => game.events.emit('uiScreen', { name: 'npc', open }),
      onClosed: () => (talkingTo = null),
      buy: (i, qty) => {
        const name = itemText[trader.stock[i]?.defId]?.name ?? '';
        const r = buy(lo(), trader, i, qty);
        if (!r.ok) return tradeUi.reasons[r.reason];
        ctx.sfx('item_pickup');
        toast(tradeUi.bought(name, qty, r.paid));
        return null;
      },
      sell: (item, qty) => {
        const name = itemText[item.defId]?.name ?? '';
        const r = sell(lo(), trader, item, qty);
        if (!r.ok) return tradeUi.reasons[r.reason];
        ctx.sfx('item_pickup');
        toast(tradeUi.sold(name, qty, r.paid));
        return null;
      },
    },
    game.ui,
  );
  // The trade screen closing returns to the conversation; patch the Esc path so Esc inside a trade leaves it all
  game.events.on('inventoryChanged', () => ui.refresh());
  game.events.on('playerDied', () => ui.closeAll());

  function talk(def: NpcDef) {
    if (game.input.blocked || ui.isOpen) return;
    talkingTo = def.id;
    ui.startTalk(def.id, new Dialogue(def.id, def.dialogue, envFor(def.id)));
  }

  // ---------------- the characters ----------------
  const feet = ctx.player;
  const downRay = new game.phys.R.Ray({ x: 0, y: 60, z: 0 }, { x: 0, y: -1, z: 0 });
  const groundY = (x: number, z: number) => {
    try {
      downRay.origin = { x, y: 60, z };
      const hit = game.phys.world.castRay(downRay, 120, true, undefined, groups(PGroup.PLAYER, PGroup.TERRAIN));
      return hit ? 60 - hit.timeOfImpact : null;
    } catch {
      return null;
    }
  };

  for (const def of NPCS) {
    const proto = await loadModel(def.model);
    if (proto.placeholder) {
      console.warn(`npc: model ${def.model} is not built yet; ${def.id} is skipped`);
      continue;
    }
    const inst = proto.create();
    const where = spot(def);
    const root = new Group();
    root.name = `npc_${def.id}`;
    root.add(inst.root);
    root.position.set(where.x, 0, where.z);
    root.rotation.y = where.yaw;
    root.traverse((o) => ((o as { frustumCulled?: boolean }).frustumCulled = false));
    game.scene.add(root);
    let head: Object3D | null = null;
    inst.root.traverse((o) => {
      if (!head && /(^|[:_ ])head$/i.test(o.name.replace(/^mixamorig/i, ''))) head = o;
    });
    const idle = inst.actions.get(def.idles[0]) ?? null;
    if (idle) {
      idle.setLoop(LoopRepeat, Infinity).play();
      idle.time = rnd(0, idle.getClip().duration);
    }
    // Interact point at chest height; collider so the player cannot walk through
    const pos = new Vector3(where.x, 1.1, where.z);
    game.interact.register({
      position: pos,
      radius: NPC_FEEL.reach,
      prompt: () => (ui.isOpen ? null : def.role === 'trader' ? npcUi.trade(npcName[def.id].name) : npcUi.talk(npcName[def.id].name)),
      holdSeconds: () => NPC_FEEL.hold,
      onInteract: () => talk(def),
    });
    const { R, world } = game.phys;
    const col = world.createCollider(
      R.ColliderDesc.capsule((NPC_FEEL.height - NPC_FEEL.radius * 2) / 2, NPC_FEEL.radius)
        .setTranslation(where.x, 0.9, where.z)
        .setCollisionGroups(groups(PGroup.STATIC, 0xffff)),
    );
    live.push({ def, root, mixer: inst.mixer, actions: inst.actions, idle, head, yaw: 0, pitch: 0, nextIdle: rnd(...NPC_FEEL.idleChangeS), snapped: false, pos, baseYaw: where.yaw, back: null, talkA: inst.actions.get(def.talk ?? NPC_FEEL.talkClip) ?? null, talking: false });
    (live[live.length - 1] as Live & { col?: unknown }).col = col;
  }

  // Each frame: animate NPCs near the player, snap them to the ground the first time they are close, turn the head.
  const playerPos = () => {
    try {
      return game.player.position;
    } catch {
      return game.camera.position;
    }
  };
  void feet;
  game.addSystem({
    name: 'npc',
    render(_a, dt) {
      const p = playerPos();
      for (const n of live) {
        const d2 = (n.root.position.x - p.x) ** 2 + (n.root.position.z - p.z) ** 2;
        const near = d2 < NPC_FEEL.drawDistance ** 2;
        n.root.visible = near;
        if (!near) continue;
        if (!n.snapped && d2 < 80 * 80) {
          const y = groundY(n.root.position.x, n.root.position.z);
          if (y !== null) {
            n.root.position.y = y;
            n.pos.y = y + 1.1;
            const col = (n as unknown as { col: { setTranslation(v: { x: number; y: number; z: number }): void } }).col;
            col.setTranslation({ x: n.root.position.x, y: y + 0.9, z: n.root.position.z });
          }
          n.snapped = true;
        }
        n.mixer.update(dt);
        // talk pose: loop the talk clip and turn the body to face the player; back to the idle and the spot's facing after
        const talking = talkingTo === n.def.id;
        if (talking !== n.talking) {
          n.talking = talking;
          const from = n.back?.gesture ?? (talking ? n.idle : n.talkA);
          const to = talking ? n.talkA : n.idle;
          if (from && to && from !== to) {
            to.reset().play();
            from.crossFadeTo(to, NPC_FEEL.talkBlend, false);
          }
          n.back = null;
          n.nextIdle = rnd(...NPC_FEEL.idleChangeS);
        }
        {
          const want = talking ? Math.atan2(-(p.x - n.root.position.x), -(p.z - n.root.position.z)) : n.baseYaw;
          let d = want - n.root.rotation.y;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          if (Math.abs(d) > 1e-3) n.root.rotation.y += d * (1 - Math.exp(-NPC_FEEL.talkTurn * dt));
        }
        if (n.back && (n.back.t -= dt) <= 0 && n.idle) {
          n.idle.reset().play();
          n.back.gesture.crossFadeTo(n.idle, 0.4, false);
          n.back = null;
        }
        // idle variety: now and then a gesture (one shot) and back to the idle loop
        if (!talking && (n.nextIdle -= dt) <= 0) {
          n.nextIdle = rnd(...NPC_FEEL.idleChangeS);
          const g = Math.random() < NPC_FEEL.gestureChance ? n.def.gestures[Math.floor(Math.random() * n.def.gestures.length)] : null;
          const a = g ? n.actions.get(g) : null;
          if (a && n.idle) {
            a.reset().setLoop(LoopOnce, 1);
            a.clampWhenFinished = false;
            a.play();
            n.idle.crossFadeTo(a, 0.4, false);
            n.nextIdle = Math.max(n.nextIdle, a.getClip().duration + 1);
            n.back = { gesture: a, t: Math.max(0.5, a.getClip().duration - 0.4) };
          } else if (n.def.idles.length > 1) {
            const next = n.actions.get(n.def.idles[Math.floor(Math.random() * n.def.idles.length)]);
            if (next && n.idle && next !== n.idle) {
              next.reset().play();
              n.idle.crossFadeTo(next, 0.5, false);
              n.idle = next;
            }
          }
        }
        // head: turn toward the player (yaw and pitch relative to where the body faces), smoothly and within limits
        if (n.head) {
          const toX = p.x - n.root.position.x;
          const toZ = p.z - n.root.position.z;
          const dist = Math.hypot(toX, toZ);
          let wantYaw = 0;
          let wantPitch = 0;
          if (dist < NPC_FEEL.lookRadius) {
            // body faces -Z at rotation 0: its forward is (-sin r, -cos r)
            const bodyAngle = Math.atan2(-Math.sin(n.root.rotation.y), -Math.cos(n.root.rotation.y));
            const toAngle = Math.atan2(toX, toZ);
            let dy = toAngle - bodyAngle;
            dy = Math.atan2(Math.sin(dy), Math.cos(dy));
            const lim = (NPC_FEEL.maxYawDeg * Math.PI) / 180;
            wantYaw = Math.max(-lim, Math.min(lim, dy));
            wantPitch = Math.max(-1, Math.min(1, ((p.y + 1.6) - (n.root.position.y + 1.6)) / Math.max(dist, 0.5))) * ((NPC_FEEL.maxPitchDeg * Math.PI) / 180);
          }
          const k = 1 - Math.exp(-NPC_FEEL.follow * dt);
          n.yaw += (wantYaw - n.yaw) * k;
          n.pitch += (wantPitch - n.pitch) * k;
          if (Math.abs(n.yaw) + Math.abs(n.pitch) > 1e-3) {
            // world-space delta applied on top of the animated head: yaw about the world up, pitch about the body's side axis
            n.head.updateWorldMatrix(true, false);
            n.head.getWorldQuaternion(_q);
            // desired facing minus the body's own facing = a yaw about world Y and a pitch about the body's right axis
            _q2.setFromAxisAngle(_v.set(0, 1, 0), n.yaw);
            _q.premultiply(_q2);
            _w.set(Math.cos(n.root.rotation.y), 0, -Math.sin(n.root.rotation.y));
            _q2.setFromAxisAngle(_w, n.pitch);
            _q.premultiply(_q2);
            const parent = n.head.parent;
            if (parent) {
              parent.getWorldQuaternion(_q2).invert();
              n.head.quaternion.copy(_q2.multiply(_q));
            }
          }
        }
      }
    },
  });

  // ---------------- saves ----------------
  const api = {
    flags,
    trader,
    live,
    ui,
    talkingTo: () => talkingTo,
    talk: (id: string) => talk(NPCS.find((n) => n.id === id)!),
    serialize: (): NpcSave => ({ flags: [...flags], trader: structuredClone(trader) }),
    load(d: NpcSave, _v = NPC_SAVE_VERSION) {
      flags.clear();
      for (const f of d.flags ?? []) flags.add(f);
      const t = d.trader ?? newTraderState();
      trader.day = t.day ?? 0;
      trader.cash = t.cash ?? 0;
      trader.stock = t.stock ?? [];
      // keep item uids unique: the loadout save sets its own counter, ours only has to stay below it
    },
  };
  try {
    game.save.section('npc', { version: NPC_SAVE_VERSION, save: () => api.serialize(), load: (d, v) => api.load(d as NpcSave, v) });
  } catch (e) {
    console.warn('npc: saves not available', e);
  }
  (window as unknown as { __npc: typeof api }).__npc = api; // Playwright/debug hook
  return api;
}
