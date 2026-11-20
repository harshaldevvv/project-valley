/** Crafting panel and tool-use text. Recipe names come from their output item (or the keys below). */
export const craftText = {
  title: 'Crafting',
  hint: 'G close · pick a recipe, then Craft',
  categories: { medical: 'Medical', survival: 'Survival', cooking: 'Cooking', weapons: 'Weapons', gear: 'Gear' } as Record<string, string>,
  /** Names for recipes whose output is not what the player thinks of (repair, rags). */
  names: {
    repair_weapon: 'Repair a weapon',
    rags_flannel: 'Rags from a flannel shirt',
    rags_hoodie: 'Rags from a hoodie',
    rags_track_pants: 'Rags from track pants',
    rags_denim: 'Rags from a denim jacket',
    boil_water: 'Boil water',
    purify_water: 'Purify water',
  } as Record<string, string>,
  needs: 'Needs',
  tools: 'Tools (kept)',
  station: { campfire: 'Lit campfire nearby', workbench: 'Workbench nearby' } as Record<string, string>,
  makes: 'Makes',
  time: (s: number) => `${s} s`,
  craft: 'Craft',
  cantCraft: 'Missing something',
  pickWeapon: 'Pick a weapon to repair',
  noDamaged: 'Nothing needs repair',
  durability: (pct: number) => `${pct}%`,
  empty: 'Nothing to make here yet',
  crafting: 'Crafting',
  made: (name: string) => `Made ${name}`,
  repaired: (name: string) => `Repaired ${name}`,
  interrupted: 'Crafting interrupted',
  noStation: 'You need a lit campfire close by',
};

export const campText = {
  name: 'Campfire',
  light: 'Light the campfire',
  lightWith: (item: string) => `Light the campfire (${item})`,
  noLight: 'Campfire (you need a lighter, matches or a torch)',
  addPlank: 'Add a plank to the fire',
  burning: 'Campfire (burning)',
  full: 'The fire is already well fed',
  placed: 'You lay a campfire',
  lit: 'The fire catches',
  died: 'The campfire burns out',
  warm: 'You warm up by the fire',
  tooFar: 'Not enough room to lay a fire here',
};

export const toolText = {
  cutLock: 'Cut the lock',
  cutLockHold: (n: string) => `Cut the lock (${n})`,
  cut: 'Snap',
  binoculars: 'Binoculars',
  noRadio: 'Static',
};
