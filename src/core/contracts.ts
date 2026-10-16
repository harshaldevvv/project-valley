import type { Object3D, Vector3 } from 'three';
import type { ItemInstance, SlotName } from '../content/data/types';

/**
 * Contracts between team folders. The lead owns this file; change it only by agreement.
 * Each API is implemented by exactly one owner and installed onto `game` during startup.
 */

/** engine-builder: F1 debug menu (teleport, actions, live-tuning of any data number). */
export interface DebugApi {
  /** Button in group `group`. */
  action(group: string, label: string, fn: () => void): void;
  /** Slider bound to `obj[key]` (a number in a data table). Changes apply live. */
  tune(group: string, obj: Record<string, unknown>, key: string, min: number, max: number, step?: number): void;
  /** Checkbox bound to `obj[key]` (a boolean). */
  toggle(group: string, obj: Record<string, unknown>, key: string): void;
  /** Read-only text line refreshed ~4x per second. */
  watch(group: string, label: string, get: () => string): void;
}

/** mechanics-builder: "press E" interactions. Anyone can register; mechanics shows the prompt and calls back. */
export interface Interactable {
  /** World position of the interaction point. */
  position: Vector3;
  /** Max distance from the player's chest, metres (default 2). */
  radius?: number;
  /** Prompt, e.g. "Search crate". Return null to hide (e.g. already looted). */
  prompt(): string | null;
  /** Hold time in seconds (0 = instant). Searching uses the container's search time. */
  holdSeconds?(): number;
  onInteract(): void;
}
/** Core (lead): the registry. mechanics-builder finds the nearest one, shows the prompt and calls onInteract. */
export interface InteractApi {
  register(i: Interactable): () => void; // returns unregister
  readonly all: readonly Interactable[];
}

/** engine-builder: Web Audio with CC0 sounds. Ids map to files in public/assets/audio (see data/sounds.ts). */
export interface AudioApi {
  /** One-shot. position = 3D (HRTF panner); omit for 2D UI sounds. Returns nothing; fire and forget. */
  play(id: string, position?: Vector3, opts?: { volume?: number; pitchJitter?: number }): void;
  /** Looping sound attached to an object (engine idle, zombie groan). Returns a handle to stop/adjust. */
  loop(id: string, follow: Object3D, opts?: { volume?: number }): { setVolume(v: number): void; setRate(r: number): void; stop(): void };
}

/** mechanics-builder: read-only view of the player for other teams. */
export interface PlayerView {
  readonly position: Vector3; // feet, interpolated
  readonly eye: Vector3; // camera/eye position
  readonly forward: Vector3; // look direction
  readonly inVehicle: boolean;
  teleport(p: Vector3, yaw?: number): void;
  /** God mode etc. are toggled through the debug menu. */
  godMode: boolean;
  /** M2: health lives with the player (mechanics); survival/status effects change it through these. */
  readonly hp: number;
  readonly maxHp: number;
  readonly dead: boolean;
  heal(amount: number): void;
  /** Non-directional damage (bleeding, starvation, infection). Respects godMode; can kill. */
  hurt(amount: number, cause: string): void;
}

/** M2, systems-builder: survival needs + status effects (principles §7). Pure data; mechanics/HUD read it. */
export type StatusId = 'bleeding' | 'heavy_bleeding' | 'fracture' | 'infection' | 'well_fed' | 'starving' | 'dehydrated' | 'exhausted';
export interface SurvivalApi {
  /** 0..100, 100 = full / rested. */
  readonly hunger: number;
  readonly thirst: number;
  readonly fatigue: number;
  /** Active statuses with optional stage (infection 1..4) and seconds left (null = until cured). */
  readonly statuses: ReadonlyMap<StatusId, { stage?: number; timeLeft: number | null }>;
  /** Multipliers mechanics applies to the player every tick (1 = normal). */
  readonly mods: { moveSpeed: number; sprintAllowed: boolean; staminaRegen: number; staminaCost: number; aimSway: number };
  addStatus(id: StatusId, opts?: { stage?: number; seconds?: number }): void;
  cure(id: StatusId): void;
  /** Mechanics calls this when a zombie hit lands: rolls bleeding / infection / fracture per data. */
  onZombieHit(info: { damage: number; zone: 'head' | 'body' | 'limb'; armour: number }): void;
  /** Debug / item use: change needs directly (clamped). */
  adjust(delta: { hunger?: number; thirst?: number; fatigue?: number }): void;
}

/** M2, systems-builder: versioned, atomic saves (principles §12). Every team registers its own state slice. */
export interface SaveSection {
  /** Bump when the shape changes; load() receives the stored version so it can migrate. */
  version: number;
  save(): unknown; // plain JSON-safe data only
  load(data: unknown, version: number): void;
}
export interface SaveSlotInfo {
  slot: string; // 'auto' | 'quick' | 'manual-1' | 'manual-2' | 'manual-3' | 'pre-horde'
  savedAt: number; // epoch ms
  gameDay: number;
  playtimeS: number;
  label: string;
}
export interface SaveApi {
  /** Register a slice by unique name ('player', 'world.time', 'build.pieces', 'containers', 'vehicles', ...). */
  section(name: string, s: SaveSection): void;
  save(slot: string): Promise<void>;
  /** Returns false if the slot is missing or every generation failed validation. */
  load(slot: string): Promise<boolean>;
  list(): Promise<SaveSlotInfo[]>;
  exportSlot(slot: string): Promise<Blob>;
  importSlot(slot: string, file: Blob): Promise<boolean>;
  /** True while a load is applying (systems skip side effects such as loot rolls). */
  readonly loading: boolean;
}

/** systems-builder: what the player carries. Mechanics reads weapons/ammo through this only. */
export interface LoadoutApi {
  /** The item in an equipment slot (weapons: primary, secondary, sidearm, melee). */
  equipped(slot: SlotName): ItemInstance | null;
  /** Remove and return the fullest compatible magazine (or loose rounds for tube/internal mags). */
  takeMagazine(weapon: ItemInstance): ItemInstance | null;
  /** Put an item back into the inventory (or drop it at the player's feet if full). */
  give(item: ItemInstance): void;
  /** Consume `n` items of a def (bandages etc.). Returns how many were consumed. */
  consume(defId: string, n: number): number;
  count(defId: string): number;
}

/** systems-builder: inventory screen and container looting UI. */
export interface InventoryUi {
  toggle(): void;
  /** Create a container instance (car trunk, dropped bag...) that can later be opened by id. */
  registerContainer(id: string, containerDefId: string): void;
  /** Open the inventory side by side with a container's grid (loot crates, car trunk, cabinets). */
  openContainer(containerId: string): void;
  readonly isOpen: boolean;
}

/** systems-builder: base building on the build pad. */
export interface BuildApi {
  /** Enter/leave build mode (B). Mechanics hides the weapon while building. */
  toggle(): void;
  readonly active: boolean;
  /** Programmatic placement (no cost, no validity check) — used by the world to spawn the prebuilt
   *  demo house, whose pieces the player can then remove (X) and rebuild like any built piece. */
  place(pieceDefId: string, position: Vector3, rotY: number): void;
}

/** Placed by environment-builder from `data/yard.ts`; consumed by the other teams at install time. */
export interface ContainerPlacement {
  id: string;
  type: string; // container def id in data/containers
  object: Object3D;
  position: Vector3;
}
export interface Places {
  containers: ContainerPlacement[];
  /** Static targets on the shooting range (mechanics makes them hittable). */
  targets: { id: string; object: Object3D; distance: number; kind: 'plate' | 'dummy' }[];
}
