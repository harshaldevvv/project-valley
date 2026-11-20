/**
 * Quests v1: a starter chain that tours the outskirts and teaches the systems (radio, crafting, fuel, medicine,
 * campfire, cooking, warmth). Plain data; the rules are in systems/quests.ts and the words in content/text/quests.ts.
 *
 * A quest is a list of objectives done IN ORDER (only the first unfinished one counts, so a player is never asked to
 * do something before being told). A quest starts when everything in `requires` is done. Rewards are items, given once.
 *
 * Faucets and sinks (principles §9): rewards are small, one-off and mostly supplies the quest itself asks you to spend
 * (rags for the bandage you must craft, soup for the pot you must boil). Nothing here repeats.
 */
export type Objective = { poi?: string } & (
  | { type: 'goto'; poi: string; radius?: number }
  | { type: 'collect'; item: string; count: number }
  /** Carry at least this many litres of fuel in jerrycans. */
  | { type: 'fuel'; liters: number }
  | { type: 'kill'; count: number }
  | { type: 'craft'; recipe: string }
  | { type: 'use'; item: string; count?: number }
  /** Stay alive for this many in-game hours from when the objective starts. */
  | { type: 'survive'; hours: number }
  /** Read a note item (the note is an item with use.action 'read'). */
  | { type: 'read'; note: string }
  /** A named signal from questBus ('refuel', 'campfire_lit', 'radio', ...). */
  | { type: 'event'; name: string }
);

export interface QuestDef {
  id: string;
  /** Quests that must be done first (empty = starts with the game). */
  requires: string[];
  objectives: Objective[];
  rewards: { item: string; count: number }[];
  /** Optional side quest: not needed for the main arc. */
  side?: boolean;
}

export const QUESTS: QuestDef[] = [
  {
    id: 'wake',
    requires: [],
    objectives: [{ type: 'use', item: 'flashlight_a' }],
    rewards: [{ item: 'radio_handheld', count: 1 }, { item: 'battery', count: 2 }, { item: 'cloth_rag', count: 6 }],
  },
  {
    id: 'listen',
    requires: ['wake'],
    objectives: [{ type: 'use', item: 'radio_handheld' }],
    rewards: [{ item: 'jerrycan', count: 1 }, { item: 'matches', count: 2 }],
  },
  {
    id: 'make_do',
    requires: ['listen'],
    objectives: [{ type: 'craft', recipe: 'bandage' }],
    rewards: [{ item: 'cooking_pot', count: 1 }, { item: 'canned_soup', count: 2 }, { item: 'purification_tablets', count: 2 }],
  },
  {
    id: 'route9',
    requires: ['make_do'],
    objectives: [
      { type: 'goto', poi: 'fuel' },
      { type: 'fuel', liters: 12 },
      { type: 'event', name: 'refuel' },
    ],
    rewards: [{ item: 'repair_kit', count: 1 }, { item: 'cash', count: 60 }],
  },
  {
    id: 'maple',
    requires: ['route9'],
    objectives: [
      { type: 'goto', poi: 'maple' },
      { type: 'read', note: 'note_maple_sick' },
      { type: 'collect', item: 'antibiotics', count: 1 },
    ],
    rewards: [{ item: 'first_aid_kit', count: 1 }, { item: 'tourniquet', count: 1 }, { item: 'canned_chili', count: 2 }],
  },
  {
    id: 'farm',
    requires: ['maple'],
    objectives: [
      { type: 'goto', poi: 'farm' },
      { type: 'craft', recipe: 'campfire_kit' },
      { type: 'event', name: 'campfire_lit' },
      { type: 'craft', recipe: 'hot_soup' },
      { type: 'use', item: 'hot_soup' },
    ],
    rewards: [{ item: 'thermos', count: 1 }, { item: 'canned_chili', count: 2 }, { item: 'wood_planks', count: 6 }],
  },
  {
    id: 'school',
    requires: ['farm'],
    side: true,
    objectives: [
      { type: 'goto', poi: 'school' },
      { type: 'read', note: 'note_school_roll' },
    ],
    rewards: [{ item: 'school_bag', count: 1 }, { item: 'whistle', count: 1 }],
  },
  {
    id: 'camp',
    requires: ['farm'],
    objectives: [
      { type: 'goto', poi: 'camp' },
      { type: 'read', note: 'note_camp_diary' },
      { type: 'survive', hours: 1.5 },
    ],
    rewards: [{ item: 'tarp', count: 1 }, { item: 'compass', count: 1 }, { item: 'hiking_boots', count: 1 }],
  },
  {
    id: 'crash',
    requires: ['camp'],
    objectives: [
      { type: 'goto', poi: 'crash' },
      { type: 'read', note: 'note_crash_log' },
      { type: 'kill', count: 4, poi: 'crash' },
      { type: 'collect', item: 'adrenaline_shot', count: 1 },
    ],
    rewards: [{ item: 'ifak', count: 2 }, { item: 'kevlar_vest', count: 1 }, { item: 'sterile_bandage', count: 2 }],
  },
  {
    id: 'ranger',
    requires: ['crash'],
    objectives: [
      { type: 'goto', poi: 'ranger' },
      { type: 'read', note: 'note_ranger_log' },
      { type: 'event', name: 'radio', poi: 'ranger' },
    ],
    rewards: [{ item: 'binoculars', count: 1 }, { item: 'plate_carrier', count: 1 }, { item: 'cash', count: 200 }],
  },
];

export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

/**
 * Note and quest items put into specific world containers so a quest can always be finished. Container ids are the ones
 * the world registers: `poi_` + the spot id from data/pois.ts (`<building id>_<index>` indoors, `<poi id>_out<index>` outside).
 * A missing container is skipped (the quest then finds the item the ordinary way).
 */
export const QUEST_PLACED: { container: string; item: string; count?: number }[] = [
  { container: 'poi_house_a_1', item: 'note_maple_sick' },
  { container: 'poi_house_b_3', item: 'antibiotics' },
  { container: 'poi_school_out2', item: 'note_school_roll' },
  { container: 'poi_camp_out0', item: 'note_camp_diary' },
  { container: 'poi_crash_out1', item: 'note_crash_log' },
  { container: 'poi_crash_out1', item: 'adrenaline_shot' },
  { container: 'poi_ranger_out1', item: 'note_ranger_log' },
];

export const QUEST = {
  /** Default radius of a "go to" objective, as a fraction of the place's own radius (the sign at the entrance). */
  gotoFraction: 0.8,
  /** A kill counts for an area objective inside radius x this. */
  killAreaFraction: 1.25,
  /** The HUD tracker shows at most this many objectives (finished ones fold away). */
  hudMaxLines: 4,
};
