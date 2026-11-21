/**
 * Friendly NPCs and their dialogue graphs (plain data). Words live in content/text/npc.ts under the same ids.
 *
 * NPCs are stationary Polyfork characters (models chr_npc_*, our survivor clips retargeted onto them with
 * tools/audit/retarget_pf_hero.py). They are NOT zombie targets for now: zombies do not sense them and bullets and melee
 * treat their collider as scenery. The only thing they do is idle, look at you when you are near, and talk.
 */
export interface NpcDef {
  id: string;
  model: string;
  role: 'trader' | 'survivor';
  /** Point of interest the NPC belongs to (data/pois.ts). */
  poi: string;
  /** World position (m) and yaw (radians; 0 faces -Z), or a spot in a building's local frame (data/outskirts.ts BUILDINGS). */
  at: { x: number; z: number; yaw: number } | { building: string; u: number; v: number };
  dialogue: string;
  /** Looped idle clips (a variant is picked at random each time) and rarer one-shot gestures. */
  idles: string[];
  gestures: string[];
}

export const NPCS: NpcDef[] = [
  { id: 'odell', model: 'chr_npc_trader', role: 'trader', poi: 'checkpoint', at: { x: -7.9, z: 125, yaw: -1.5708 }, dialogue: 'odell', idles: ['idle'], gestures: ['interact_search'] },
  { id: 'eli', model: 'chr_npc_eli', role: 'survivor', poi: 'maple', at: { building: 'house_a', u: -2.8, v: 4.8 }, dialogue: 'eli', idles: ['idle'], gestures: ['interact_search'] },
  { id: 'hollis', model: 'chr_npc_hollis', role: 'survivor', poi: 'farm', at: { building: 'farmhouse', u: -1.3, v: 6.2 }, dialogue: 'hollis', idles: ['idle'], gestures: ['interact_search'] },
  { id: 'wren', model: 'chr_npc_wren', role: 'survivor', poi: 'ranger', at: { x: 127.6, z: 255.4, yaw: 0 }, dialogue: 'wren', idles: ['idle'], gestures: ['interact_search'] },
];
export const NPC_BY_ID: Record<string, NpcDef> = Object.fromEntries(NPCS.map((n) => [n.id, n]));

export const NPC_FEEL = {
  /** Within this many metres the NPC turns its head toward you. */
  lookRadius: 9,
  /** Head turn limits (degrees, left-right and up-down), how fast it follows (1/s). */
  maxYawDeg: 65,
  maxPitchDeg: 22,
  follow: 6,
  /** Seconds between idle changes (random in range), and the share that are a gesture instead of another idle. */
  idleChangeS: [7, 16] as [number, number],
  gestureChance: 0.35,
  /** Interact reach (m) and hold time (s). */
  reach: 2.8,
  hold: 0,
  /** Capsule collider so you cannot walk through them. */
  radius: 0.34,
  height: 1.75,
  /** Visible only within this many metres (they are rendered while the player is near). */
  drawDistance: 140,
};

// ---------------------------------------------------------------- dialogue graph
export type Cond =
  | { has: { item: string; count: number } }
  /** A flag set earlier (by an effect). `not` inverts it. */
  | { flag: string; not?: boolean }
  | { quest: string; status: 'locked' | 'active' | 'done' }
  /** The quest's CURRENT objective is a 'give' to this NPC. */
  | { giving: string };
export type Effect =
  | { give: { item: string; count: number } }
  | { take: { item: string; count: number } }
  | { set: string }
  /** Hand an item to the NPC for a quest: takes it from the pack and tells the quest system. */
  | { hand: { item: string; count: number } }
  | { trade: true };

export interface Choice {
  id: string;
  when?: Cond[];
  effects?: Effect[];
  /** Node to go to, or 'end'. */
  next: string;
}
export interface DialogueDef {
  id: string;
  /** First matching entry (in order) is where the conversation starts. */
  entry: { when?: Cond[]; node: string }[];
  nodes: Record<string, { choices: Choice[] }>;
}

export const DIALOGUES: DialogueDef[] = [
  {
    id: 'odell',
    entry: [{ when: [{ flag: 'odell_met', not: true }], node: 'first' }, { node: 'hub' }],
    nodes: {
      first: { choices: [{ id: 'who', effects: [{ set: 'odell_met' }], next: 'who' }, { id: 'trade', effects: [{ set: 'odell_met' }, { trade: true }], next: 'hub' }, { id: 'leave', effects: [{ set: 'odell_met' }], next: 'end' }] },
      who: { choices: [{ id: 'trade', effects: [{ trade: true }], next: 'hub' }, { id: 'news', next: 'news' }, { id: 'leave', next: 'end' }] },
      hub: { choices: [{ id: 'trade', effects: [{ trade: true }], next: 'hub' }, { id: 'news', next: 'news' }, { id: 'prices', next: 'prices' }, { id: 'leave', next: 'end' }] },
      news: { choices: [{ id: 'back', next: 'hub' }, { id: 'leave', next: 'end' }] },
      prices: { choices: [{ id: 'back', next: 'hub' }, { id: 'leave', next: 'end' }] },
    },
  },
  {
    id: 'eli',
    entry: [
      { when: [{ quest: 'maple', status: 'done' }], node: 'after' },
      { when: [{ giving: 'eli' }, { has: { item: 'antibiotics', count: 1 } }], node: 'pills' },
      { when: [{ giving: 'eli' }], node: 'waiting' },
      { when: [{ flag: 'eli_met', not: true }], node: 'first' },
      { node: 'about' },
    ],
    nodes: {
      first: { choices: [{ id: 'danny', effects: [{ set: 'eli_met' }], next: 'danny' }, { id: 'leave', effects: [{ set: 'eli_met' }], next: 'end' }] },
      about: { choices: [{ id: 'danny', next: 'danny' }, { id: 'leave', next: 'end' }] },
      danny: { choices: [{ id: 'where', next: 'where' }, { id: 'leave', next: 'end' }] },
      where: { choices: [{ id: 'leave', next: 'end' }] },
      waiting: { choices: [{ id: 'where', next: 'where' }, { id: 'leave', next: 'end' }] },
      pills: { choices: [{ id: 'give', effects: [{ hand: { item: 'antibiotics', count: 1 } }, { set: 'eli_helped' }], next: 'thanks' }, { id: 'later', next: 'end' }] },
      thanks: { choices: [{ id: 'leave', next: 'end' }] },
      after: { choices: [{ id: 'leave', next: 'end' }] },
    },
  },
  {
    id: 'hollis',
    entry: [{ when: [{ flag: 'hollis_met', not: true }], node: 'first' }, { node: 'hub' }],
    nodes: {
      first: { choices: [{ id: 'hi', effects: [{ set: 'hollis_met' }], next: 'hub' }, { id: 'leave', effects: [{ set: 'hollis_met' }], next: 'end' }] },
      hub: {
        choices: [
          { id: 'food', when: [{ flag: 'hollis_food', not: true }], effects: [{ set: 'hollis_food' }, { give: { item: 'canned_corn', count: 2 } }], next: 'food' },
          { id: 'rags', when: [{ flag: 'hollis_rags', not: true }, { has: { item: 'cloth_rag', count: 3 } }], effects: [{ take: { item: 'cloth_rag', count: 3 } }, { set: 'hollis_rags' }, { give: { item: 'canned_tuna', count: 2 } }], next: 'rags' },
          { id: 'fire', next: 'fire' },
          { id: 'leave', next: 'end' },
        ],
      },
      food: { choices: [{ id: 'back', next: 'hub' }, { id: 'leave', next: 'end' }] },
      rags: { choices: [{ id: 'back', next: 'hub' }, { id: 'leave', next: 'end' }] },
      fire: { choices: [{ id: 'back', next: 'hub' }, { id: 'leave', next: 'end' }] },
    },
  },
  {
    id: 'wren',
    entry: [{ when: [{ flag: 'wren_met', not: true }], node: 'first' }, { node: 'hub' }],
    nodes: {
      first: { choices: [{ id: 'hi', effects: [{ set: 'wren_met' }], next: 'hub' }, { id: 'leave', effects: [{ set: 'wren_met' }], next: 'end' }] },
      hub: {
        choices: [
          { id: 'relay', next: 'relay' },
          { id: 'valley', next: 'valley' },
          { id: 'light', when: [{ flag: 'wren_light', not: true }], effects: [{ set: 'wren_light' }, { give: { item: 'glow_stick', count: 2 } }], next: 'light' },
          { id: 'leave', next: 'end' },
        ],
      },
      relay: { choices: [{ id: 'back', next: 'hub' }, { id: 'leave', next: 'end' }] },
      valley: { choices: [{ id: 'back', next: 'hub' }, { id: 'leave', next: 'end' }] },
      light: { choices: [{ id: 'back', next: 'hub' }, { id: 'leave', next: 'end' }] },
    },
  },
];
export const DIALOGUE_BY_ID: Record<string, DialogueDef> = Object.fromEntries(DIALOGUES.map((d) => [d.id, d]));
