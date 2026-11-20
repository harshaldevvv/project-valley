/** Loading-screen tips. Each max 120 chars. */
export const loadingTips: string[] = [
  'Gunfire carries for a kilometre. Everything in that kilometre now knows your address.',
  'A shove buys you one second. Spend it backing up, not admiring the shove.',
  'Reload behind a wall, not in the middle of the road. The road does not care that you are busy.',
  'Search a container fully before you run. Half a backpack of beans is still half a backpack.',
  'Crouching is quieter. Creeping through a farmhouse kitchen is undignified, and alive.',
  'The Ledger buys anything with a serial number and asks nothing about where it came from.',
  'Wood walls hold the dead for a while. Scrap walls hold them longer. Nothing holds them forever.',
  'Lights, generators and engines draw a crowd. Cook in the dark if you want to eat alone.',
  'Warden checkpoints wave you through if your hands are empty. Keep them empty.',
  'If the radio reads out numbers after dark, write them down. Somebody in the Annex still counts.',
  'Bandage first, loot second. Bleeding out on a weapon crate is a common local tradition.',
  'Fennick still has a working church bell. Nobody rings it on purpose.',
];

/**
 * First-time hints (src/ui/menu/hints.ts): one line each, shown once per browser (seen-set in localStorage).
 * `{key}` is replaced with the bound key from the data tables.
 */
export const hintText = {
  craft: 'You have materials. Press {key} to craft.',
  journal: 'New task. Press {key} to open the journal.',
  throw: 'Hold {key} to aim a throwable, release to throw. {cycle} picks which one.',
  campfire: 'Campfire down. Look at it and press {key} to light it, then stand close to warm up.',
  trader: 'Traders buy loot for cash. Pick "trade" in the talk menu to swap.',
  fuel: 'Cars burn fuel. Fill a jerrycan at a pump, then press {key} at the car to pour it in.',
  attachments: 'Gun part found. Press {key}, then right click it in the bag to mount it on a gun.',
};
export type HintId = keyof typeof hintText;

/** Extra Settings rows and the key list (labels only; the keys come from the data tables). */
export const settingsText = {
  captureMouse: 'Capture mouse',
  hordeNight: 'Horde nights',
  hintsReset: 'Show first-time hints again',
  keysTitle: 'Keys',
};
export const keyLabels = {
  move: 'Move',
  interact: 'Interact / talk / refuel',
  inventory: 'Inventory',
  craft: 'Crafting',
  journal: 'Journal',
  throwAim: 'Aim and throw',
  throwCycle: 'Pick throwable',
  binoculars: 'Binoculars (hold)',
  flashlight: 'Flashlight',
  vehicle: 'Enter / exit vehicle',
  build: 'Build mode',
  help: 'Help overlay',
};

/** The short controls card on the pause menu. */
export const pauseCardTitle = 'Controls';
