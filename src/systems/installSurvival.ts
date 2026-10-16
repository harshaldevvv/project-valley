import { CylinderGeometry, Mesh, MeshBasicMaterial, Object3D, Vector3, AdditiveBlending } from 'three';
import { DEATH, applyPreset, difficulty, DIFFICULTY_PRESETS } from '../content/data/difficulty';
import { SURVIVAL } from '../content/data/survival';
import type { ItemInstance, SlotName } from '../content/data/types';
import { survivalText as ST } from '../content/text/ui';
import type { StatusId } from '../core/contracts';
import type { Game } from '../core/game';
import { loadModel } from '../engine/models';
import { itemName } from '../ui/inventory/screen';
import { autoPlace, defOf } from './inventory';
import type { Loadout } from './loadout';
import { Survival } from './survival';

/**
 * M2 glue: survival needs/status (game.survival), timed item use, the death bag. Pure rules live in
 * survival.ts / loadout.ts; this file connects them to the player, events, the world and the debug menu.
 */
export interface DeathBag {
  id: string;
  x: number;
  y: number;
  z: number;
  /** In-game day (fractional, engine clock) when it disappears. */
  expiresAtDay: number;
}

export function installSurvival(
  game: Game,
  lo: Loadout,
  deps: { sfx(id: string, at?: Vector3): void; toast(t: string): void; containerInteract(id: string, type: string, at: Vector3, radius: number): () => void; closeContainer(id: string): void },
) {
  const player = () => {
    try {
      return game.player;
    } catch {
      return null;
    }
  };
  // Engine world clock (src/engine/clock.ts): day from 1, hours 0..24, night 0..1.
  const time = () => (game as unknown as { time?: { day?: number; hours?: number; night?: number } }).time;
  const isNight = () => (time()?.night ?? 0) > 0.5;
  const days = () => {
    const t = time();
    return t?.day !== undefined ? t.day - 1 + (t.hours ?? 0) / 24 : 0;
  };

  const survival = new Survival(game.rng, {
    maxHp: () => player()?.maxHp ?? 100,
    hp: () => player()?.hp ?? 100,
    hurt: (n, cause) => player()?.hurt(n, cause),
    heal: (n) => player()?.heal(n),
    isNight,
    days,
    statusChanged: (id, active, stage) => {
      game.events.emit('statusChanged', { id, active, stage });
      // Wounds announce themselves; derived needs states are for the HUD icons only.
      const loading = (() => { try { return game.save.loading; } catch { return false; } })();
      if (active && !loading && ['bleeding', 'heavy_bleeding', 'fracture', 'infection'].includes(id)) deps.toast(ST.status[id] ?? id);
    },
  });
  game.survival = survival;
  lo.useValidator = (item) => {
    const d = defOf(item);
    return d.use ? survival.useRefusal(d.use, d.kind) : null;
  };

  // ---------- timed item use ----------
  const bar = document.createElement('div');
  bar.className = 'use-bar';
  bar.hidden = true;
  bar.innerHTML = '<span></span><i><b></b></i>';
  game.ui.appendChild(bar);
  const style = document.createElement('style');
  style.textContent = `.use-bar{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:30;pointer-events:none;min-width:220px;
    padding:8px 12px;border-radius:5px;background:rgba(14,17,19,.86);border:1px solid rgba(255,255,255,.1);font:600 13px system-ui,'Segoe UI',sans-serif;
    color:#e4e8ea;text-align:center}.use-bar[hidden]{display:none}.use-bar i{display:block;margin-top:6px;height:5px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}
    .use-bar b{display:block;height:100%;width:0;background:#d9b25a}`;
  document.head.appendChild(style);

  game.events.on('playerDamaged', () => {
    if (lo.cancelUse()) deps.toast(ST.interrupted);
  });

  // ---------- death bag ----------
  const bags = new Map<string, { rec: DeathBag; root: Object3D; unreg: () => void }>();
  let bagN = 0;
  const beaconMat = new MeshBasicMaterial({ color: '#ffcf7a', transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false });
  const beaconGeo = new CylinderGeometry(0.06, 0.06, DEATH.beaconHeight, 6).translate(0, DEATH.beaconHeight / 2, 0);

  function spawnBag(rec: DeathBag) {
    const root = new Object3D();
    root.position.set(rec.x, rec.y, rec.z);
    root.name = rec.id;
    const beacon = new Mesh(beaconGeo, beaconMat);
    root.add(beacon);
    game.scene.add(root);
    void loadModel('prop_duffel_bag_a', [0.8, 0.35, 0.4]).then((m) => {
      if (!bags.has(rec.id)) return;
      const inst = m.create();
      inst.root.rotation.y = 0.6;
      root.add(inst.root);
    });
    lo.registerContainer(rec.id, 'death_bag');
    const unreg = deps.containerInteract(rec.id, 'death_bag', new Vector3(rec.x, rec.y + 0.3, rec.z), 1.9);
    bags.set(rec.id, { rec, root, unreg });
  }

  function removeBag(id: string) {
    const b = bags.get(id);
    if (!b) return;
    b.root.removeFromParent();
    b.unreg();
    bags.delete(id);
    deps.closeContainer(id);
    lo.removeContainer(id);
  }

  game.events.on('playerDied', () => {
    lo.cancelUse();
    const mode = difficulty.deathPenalty;
    if (mode === 'story') return;
    const p = player();
    const at = p ? p.position : new Vector3();
    // Survivor: backpack + the held weapon. Hardcore: everything but the secure pouch.
    let slots: SlotName[];
    if (mode === 'hardcore') slots = (Object.keys(lo.equipment) as SlotName[]).filter((s) => s !== 'pouch');
    else {
      const held = (p as unknown as { heldSlot?: SlotName } | null)?.heldSlot ?? (['primary', 'secondary', 'sidearm'] as SlotName[]).find((s) => lo.equipment[s]);
      slots = [...(DEATH.survivorDrops as SlotName[]), ...(held && held !== 'melee' ? [held] : [])];
    }
    const items = slots.map((s) => lo.equipment[s]).filter((x): x is ItemInstance => !!x);
    if (!items.length) return;
    const id = `deathbag_${Date.now().toString(36)}_${bagN++}`;
    const c = lo.registerContainer(id, 'death_bag');
    for (const s of slots) delete lo.equipment[s];
    for (const it of items) if (autoPlace(c.grid, it) > 0) lo.drop(it, at); // never lose an item
    c.searched = true;
    lo.changed();
    spawnBag({ id, x: at.x, y: at.y, z: at.z, expiresAtDay: days() + DEATH.bagDays[mode] });
    deps.toast(ST.bagDropped);
  });

  game.events.on('playerRespawned', () => survival.respawn());

  // Empty bags vanish once you've closed them; full ones expire after their in-game days.
  game.events.on('uiScreen', ({ name, open }) => {
    if (name !== 'inventory' || open) return;
    for (const [id] of bags) if (!lo.containers.get(id)?.grid.contents.length) removeBag(id);
  });

  // ---------- tick ----------
  const barText = bar.firstElementChild as HTMLElement;
  const barFill = bar.querySelector('b') as HTMLElement;
  game.addSystem({
    name: 'survival',
    step(dt) {
      const p = player();
      if (p && !p.dead) survival.step(dt);
      const done = lo.stepUse(dt);
      if (done) {
        survival.applyUse(done.use);
        game.events.emit('itemUsed', done);
        deps.sfx(done.use.sound ?? 'item_pickup');
        deps.toast(`${itemName(done.defId)} ✓`);
      }
      for (const [id, b] of bags) if (days() >= b.rec.expiresAtDay) removeBag(id);
      const u = lo.using;
      bar.hidden = !u;
      if (u) {
        barText.textContent = `${ST.using} ${itemName(u.item.defId)}`;
        barFill.style.width = `${Math.min(100, (u.t / u.seconds) * 100)}%`;
      }
    },
  });

  // ---------- debug ----------
  try {
    const d = game.debug;
    const s = survival as unknown as Record<string, unknown>;
    d.tune('Survival', s, 'hunger', 0, 100, 1);
    d.tune('Survival', s, 'thirst', 0, 100, 1);
    d.tune('Survival', s, 'fatigue', 0, 100, 1);
    d.tune('Survival', SURVIVAL as unknown as Record<string, unknown>, 'debugDrainMul', 1, 20, 1);
    d.action('Survival', 'Needs drain x10', () => (SURVIVAL.debugDrainMul = SURVIVAL.debugDrainMul === 10 ? 1 : 10));
    for (const id of ['bleeding', 'heavy_bleeding', 'fracture', 'infection'] as StatusId[]) {
      d.action('Survival', `+ ${ST.status[id]}`, () => survival.addStatus(id));
      d.action('Survival', `Cure ${ST.status[id]}`, () => survival.cure(id));
    }
    d.action('Survival', 'Infection: next stage', () => {
      const stage = Math.min(4, (survival.statuses.get('infection')?.stage ?? 0) + 1);
      survival.cure('infection');
      survival.addStatus('infection', { stage });
    });
    d.watch('Survival', 'needs', () => `food ${survival.hunger.toFixed(1)}  water ${survival.thirst.toFixed(1)}  rest ${survival.fatigue.toFixed(1)}  day ${survival.gameDay}`);
    d.watch('Survival', 'status', () => [...survival.statuses].map(([k, v]) => `${k}${v.stage ? ' ' + v.stage : ''}${v.timeLeft !== null ? ` ${v.timeLeft.toFixed(0)}s` : ''}`).join(', ') || '-');
    d.watch('Survival', 'mods', () => Object.entries(survival.mods).map(([k, v]) => `${k} ${typeof v === 'number' ? v.toFixed(2) : v}`).join('  '));
    const diff = difficulty as unknown as Record<string, unknown>;
    for (const name of Object.keys(DIFFICULTY_PRESETS) as (keyof typeof DIFFICULTY_PRESETS)[]) d.action('Difficulty', `Preset: ${name}`, () => applyPreset(name));
    for (const k of ['hungerDrain', 'thirstDrain', 'fatigueDrain']) d.tune('Difficulty', diff, k, 0, 2, 0.05);
    d.toggle('Difficulty', diff, 'infection');
    d.toggle('Difficulty', diff, 'starvationDamage');
    d.action('Difficulty', 'Death penalty: cycle', () => {
      const order = ['story', 'survivor', 'hardcore'] as const;
      difficulty.deathPenalty = order[(order.indexOf(difficulty.deathPenalty) + 1) % 3];
      difficulty.preset = 'custom';
      deps.toast(`Death penalty: ${difficulty.deathPenalty}`);
    });
    d.watch('Difficulty', 'preset', () => `${difficulty.preset} · death ${difficulty.deathPenalty}`);
  } catch (e) {
    console.warn('survival: debug menu not available', e);
  }

  // For the HUD's world/compass marker (mechanics): live bag positions. Not in SurvivalApi yet (lead).
  Object.assign(survival, { deathBags: () => [...bags.values()].map((b) => ({ id: b.rec.id, x: b.rec.x, y: b.rec.y, z: b.rec.z })) });

  return {
    survival,
    bags: {
      serialize: (): DeathBag[] => [...bags.values()].map((b) => ({ ...b.rec })),
      load(list: DeathBag[]) {
        for (const id of [...bags.keys()]) {
          const b = bags.get(id)!;
          b.root.removeFromParent();
          b.unreg();
          bags.delete(id);
        }
        for (const rec of list) spawnBag(rec);
      },
    },
  };
}

