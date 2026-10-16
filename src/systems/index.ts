import { Box3, Vector3 } from 'three';
import { BUILD } from '../content/data/build';
import { BODY_BY_VARIANT, CONTAINER_INTERACT, CONTAINERS } from '../content/data/containers';
import { INVENTORY, ITEMS } from '../content/data/items';
import { containerText } from '../content/text/containers';
import { inventoryText as T, lockpickText } from '../content/text/ui';
import type { Game } from '../core/game';
import { installBuildMode } from '../ui/build/buildMode';
import { createPickupView } from '../ui/inventory/pickups';
import { InventoryScreen, containerName, itemName } from '../ui/inventory/screen';
import { LockpickScreen } from '../ui/lockpick/lockpick';
import { newItem, newItems } from './inventory';
import { Loadout } from './loadout';

/** systems-builder: items, inventory + UI, loot containers, loadout, build mode. Fills game.loadout/inventory/build. */
export async function installSystems(game: Game): Promise<void> {
  // Engine APIs may still be stubs while the engine team works: never let audio/debug break systems.
  const sfx = (id: string, at?: Vector3) => {
    try {
      game.audio.play(id, at);
    } catch {
      /* audio not installed */
    }
  };
  const toast = (text: string) => game.events.emit('toast', { text });
  const feet = () => {
    try {
      const p = game.player.position;
      return { x: p.x, y: p.y, z: p.z };
    } catch {
      const c = game.camera.position;
      return { x: c.x, y: 0, z: c.z };
    }
  };

  const lo = new Loadout(game.rng, () => game.events.emit('inventoryChanged', {}));
  // Drops land a little ahead of the player, where the interact picker (and the eye) can see them.
  lo.dropPosition = () => {
    const f = feet();
    try {
      const fw = game.player.forward;
      const len = Math.hypot(fw.x, fw.z) || 1;
      return { x: f.x + (fw.x / len) * INVENTORY.dropAhead, y: f.y, z: f.z + (fw.z / len) * INVENTORY.dropAhead };
    } catch {
      return f;
    }
  };
  lo.giveStartingKit();

  const otherScreens = new Set<string>();
  game.events.on('uiScreen', ({ name, open }) => name !== 'inventory' && (open ? otherScreens.add(name) : otherScreens.delete(name)));
  const screen = new InventoryScreen(lo, {
    sfx,
    canOpen: () => otherScreens.size === 0,
    feet,
    toast,
    onOpenChange: (open) => game.events.emit('uiScreen', { name: 'inventory', open }),
  }, game.ui);

  const pickups = createPickupView(game, lo, (item, ok) => {
    sfx(ok ? 'item_pickup' : 'build_invalid');
    toast(ok ? itemName(item.defId) : T.full);
  });
  game.events.on('inventoryChanged', () => {
    pickups.sync();
    screen.refresh();
  });

  game.loadout = lo;
  game.inventory = {
    toggle: () => screen.toggle(),
    registerContainer: (id, defId) => void lo.registerContainer(id, defId),
    openContainer: (id) => {
      lo.openContainer(id);
      sfx('crate_open');
      screen.open(id);
    },
    get isOpen() {
      return screen.isOpen;
    },
  };

  // Lockpick minigame (locked containers).
  let picking: string | null = null;
  const lockpick = new LockpickScreen(game.rng, {
    sfx,
    onOpenChange: (open) => game.events.emit('uiScreen', { name: 'lockpick', open }),
    picks: () => lo.count('lockpick'),
    onBreak: () => lo.consume('lockpick', 1),
    onSuccess: () => {
      const c = picking && lo.containers.get(picking);
      if (!c) return;
      c.locked = false;
      toast(lockpickText.opened);
      game.inventory.openContainer(c.id);
    },
  }, game.ui);

  /** Container interaction: search (hold) / open, or pick the lock first. Returns unregister. */
  const containerInteract = (id: string, type: string, position: Vector3, radius: number) => {
    const def = CONTAINERS[type];
    const c = lo.registerContainer(id, type);
    const name = containerName(type);
    const verb = containerText[type]?.searchVerb ?? 'Search';
    return game.interact.register({
      position,
      radius,
      prompt: () => {
        if (c.locked) {
          const n = lo.count('lockpick');
          return n > 0 ? `${T.pickLock} (${T.lockpickWord} ×${n})` : T.locked;
        }
        return c.searched || def.searchSeconds === 0 ? `${T.act.open} ${name}` : `${verb} ${name}`;
      },
      holdSeconds: () => (c.locked || c.searched ? 0 : def.searchSeconds),
      onInteract: () => {
        if (c.locked) {
          if (lo.count('lockpick') <= 0) return sfx('build_invalid');
          picking = id;
          return lockpick.open(def.lock);
        }
        if (!c.searched) sfx('search_rustle', position);
        game.inventory.openContainer(id);
      },
    });
  };

  /** Chest-to-point radius that gives `bodyReach` metres of horizontal reach to a body on the ground. */
  const bodyRadius = (y: number) => Math.hypot(CONTAINER_INTERACT.bodyReach, CONTAINER_INTERACT.chestHeight - y);

  // World containers placed by the environment team. Interact point = top centre of the bounds (QA-061).
  const box = new Box3();
  const size = new Vector3();
  for (const pl of game.places.containers) {
    if (!CONTAINERS[pl.type]) {
      console.warn(`systems: unknown container type "${pl.type}" (${pl.id})`);
      continue;
    }
    let at = pl.position;
    let radius = pl.type.startsWith('body_') ? bodyRadius(pl.position.y) : CONTAINER_INTERACT.reach;
    if (!pl.type.startsWith('body_') && pl.object) {
      box.setFromObject(pl.object);
      if (!box.isEmpty()) {
        box.getSize(size);
        at = new Vector3((box.min.x + box.max.x) / 2, Math.min(box.max.y, CONTAINER_INTERACT.maxPointHeight), (box.min.z + box.max.z) / 2);
        radius += Math.max(size.x, size.z) / 2;
      }
    }
    containerInteract(pl.id, pl.type, at, radius);
  }

  // Zombie corpses become searchable bodies until they despawn.
  const bodies = new Map<number, () => void>();
  game.events.on('zombieKilled', ({ id, variant, position }) => {
    if (bodies.has(id)) return;
    const at = position.clone();
    at.y = Math.min(at.y, CONTAINER_INTERACT.bodyPointHeight); // torso on the ground, not chest height
    bodies.set(id, containerInteract(`zbody_${id}`, BODY_BY_VARIANT[variant] ?? 'body_zombie', at, bodyRadius(at.y)));
  });
  game.events.on('corpseRemoved', ({ id }) => {
    bodies.get(id)?.();
    bodies.delete(id);
    if (screen.container === `zbody_${id}`) screen.close();
    lo.removeContainer(`zbody_${id}`);
  });

  // Hotbar 5..9 (consumables, bound by item id).
  game.addSystem({
    name: 'hotbar',
    step() {
      if (game.build.active) return; // 1..8 pick build pieces
      for (let i = 0; i < 5; i++) {
        if (!game.input.justPressed(`Digit${i + 5}`)) continue;
        const r = lo.useHotbar(i);
        if (r?.use) {
          sfx(r.use.sound ?? 'item_pickup');
          toast(`${T.used} ${itemName(r.defId)}`);
        } else if (lo.hotbar[i]) toast(`${T.no} ${itemName(lo.hotbar[i]!)}`);
      }
    },
  });

  game.build = installBuildMode(game, lo, sfx);
  (window as unknown as { __lockpick: LockpickScreen }).__lockpick = lockpick; // Playwright/debug hook

  // Death closes every systems screen (QA-046/047): screen.close() emits uiScreen close, which releases Input.blocked.
  // Taking damage interrupts lockpicking (QA-071); the pick is not consumed.
  game.events.on('playerDamaged', () => {
    if (!lockpick.isOpen) return;
    lockpick.interrupt();
    toast(lockpickText.interrupted);
  });

  game.events.on('playerDied', () => {
    screen.close();
    lockpick.close();
    if (game.build.active) game.build.toggle();
  });

  // Debug menu (F1). The engine may not have installed it yet.
  try {
    const d = game.debug;
    for (const id of Object.keys(ITEMS)) {
      const def = ITEMS[id];
      d.action('Items', `+ ${itemName(id)}`, () => {
        const extra = def.kind === 'magazine' ? { rounds: def.capacity } : {};
        for (const it of newItems(id, def.stack > 1 ? def.stack : 1, extra)) lo.give(it);
      });
    }
    d.action('Items', 'Give full kit', () => {
      lo.give(newItem('rifle_a', 1, { mag: newItem('mag_rifle_a', 1, { rounds: 30 }) }));
      lo.give(newItem('pistol_a', 1, { mag: newItem('mag_pistol_a', 1, { rounds: 15 }) }));
      for (let i = 0; i < 2; i++) lo.give(newItem('mag_rifle_a', 1, { rounds: 30 }));
      for (let i = 0; i < 2; i++) lo.give(newItem('mag_pistol_a', 1, { rounds: 15 }));
      lo.give(newItem('ammo_762', 60));
      lo.give(newItem('ammo_9mm', 60));
    });
    d.action('Items', 'Give lockpicks', () => lo.give(newItem('lockpick', 10)));
    d.action('Items', 'Give building materials', () => {
      for (const it of [...newItems('wood_planks', 40), ...newItems('nails', 60)]) lo.give(it);
    });
    d.action('Items', 'Clear inventory', () => {
      lo.clear();
      lo.giveStartingKit();
    });
    d.action('Items', 'Refill containers', () => {
      for (const c of lo.containers.values()) {
        c.searched = false;
        c.grid.contents.length = 0;
      }
      lo.changed();
    });
    d.toggle('Items', INVENTORY as unknown as Record<string, unknown>, 'bagception');
    d.toggle('Build', BUILD as unknown as Record<string, unknown>, 'freeBuilding');
    d.tune('Build', BUILD as unknown as Record<string, unknown>, 'refund', 0, 1, 0.05);
    d.action('Build', 'Clear all pieces', () => game.build && (game.build as unknown as { clear(): void }).clear());
  } catch (e) {
    console.warn('systems: debug menu not available yet', e);
  }
}
