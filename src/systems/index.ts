import { Vector3 } from 'three';
import { BUILD } from '../content/data/build';
import { CONTAINERS } from '../content/data/containers';
import { INVENTORY, ITEMS } from '../content/data/items';
import { containerText } from '../content/text/containers';
import { inventoryText as T } from '../content/text/ui';
import type { Game } from '../core/game';
import { installBuildMode } from '../ui/build/buildMode';
import { createPickupView } from '../ui/inventory/pickups';
import { InventoryScreen, containerName, itemName } from '../ui/inventory/screen';
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

  // World containers placed by the environment team.
  for (const pl of game.places.containers) {
    const def = CONTAINERS[pl.type];
    if (!def) {
      console.warn(`systems: unknown container type "${pl.type}" (${pl.id})`);
      continue;
    }
    const c = lo.registerContainer(pl.id, pl.type);
    const name = containerName(pl.type);
    const verb = containerText[pl.type]?.searchVerb ?? 'Search';
    game.interact.register({
      position: pl.position,
      radius: 2.2,
      prompt: () => (c.searched || def.searchSeconds === 0 ? `${T.act.open} ${name}` : `${verb} ${name}`),
      holdSeconds: () => (c.searched ? 0 : def.searchSeconds),
      onInteract: () => {
        if (!c.searched) sfx('search_rustle', pl.position);
        game.inventory.openContainer(pl.id);
      },
    });
  }

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
