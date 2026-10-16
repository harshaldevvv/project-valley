import type { Vector3 } from 'three';

/**
 * Typed game events (principles §13: events are data, queued during the sim step, drained once per tick,
 * never fired synchronously from inside physics callbacks). Add new events here; payloads are plain data.
 */
export interface GameEvents {
  /** A weapon fired. `noise` = hearing radius in metres (principles §6). */
  shot: { by: 'player' | 'npc'; weaponId: string; origin: Vector3; dir: Vector3; noise: number };
  /** A bullet/melee hit something damageable. */
  hit: { targetId: number; point: Vector3; damage: number; zone: 'head' | 'body' | 'limb'; kill: boolean };
  /** Gameplay noise that AI can hear (footsteps, glass, car horn...). */
  noise: { position: Vector3; radius: number; source: string };
  /** Player took damage. `from` = world position of the attacker (for the direction wedge). */
  playerDamaged: { amount: number; from: Vector3 | null };
  /** Player died / respawned. UI screens (inventory, build mode) close on death. */
  playerDied: Record<string, never>;
  playerRespawned: Record<string, never>;
  /** A zombie died; its corpse stays at `position` until corpseRemoved (systems makes it a searchable body). */
  zombieKilled: { id: number; variant: string; position: Vector3 };
  corpseRemoved: { id: number };
  /** Inventory contents changed (UI refresh, weapon re-check). */
  inventoryChanged: Record<string, never>;
  /** A UI screen opened/closed (gameplay input pauses while any is open). */
  uiScreen: { name: string; open: boolean };
  /** A consumable was used (M2 survival stats hook in here). `use` mirrors ItemDef.use. */
  itemUsed: { defId: string; use: { seconds: number; heal?: number; food?: number; water?: number; sound?: string } | undefined };
  /** Free-form toast message for the HUD. */
  toast: { text: string };
}

type Handler<K extends keyof GameEvents> = (e: GameEvents[K]) => void;

export class EventBus {
  private queue: { k: keyof GameEvents; e: unknown }[] = [];
  private handlers = new Map<keyof GameEvents, Handler<keyof GameEvents>[]>();

  on<K extends keyof GameEvents>(k: K, h: Handler<K>) {
    const list = this.handlers.get(k) ?? [];
    list.push(h as Handler<keyof GameEvents>);
    this.handlers.set(k, list);
  }

  /** Queue an event; delivered on the next drain() (end of the sim tick). */
  emit<K extends keyof GameEvents>(k: K, e: GameEvents[K]) {
    this.queue.push({ k, e });
  }

  drain() {
    // Handlers may emit more events; they are delivered in the same drain, after the current ones.
    for (let i = 0; i < this.queue.length; i++) {
      const { k, e } = this.queue[i];
      for (const h of this.handlers.get(k) ?? []) h(e as never);
    }
    this.queue.length = 0;
  }
}
