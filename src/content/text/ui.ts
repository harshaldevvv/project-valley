/** Inventory screen chrome (systems-builder; narrative may reword). */
export const inventoryText = {
  equipment: 'Equipment', weapons: 'Weapons', hotbar: 'Hotbar', inventory: 'Inventory', vicinity: 'Ground',
  noStorage: 'No storage. Equip a jacket or a backpack.',
  hint: '<kbd>Tab</kbd> close <kbd>R</kbd> rotate <kbd>Ctrl</kbd>+click quick move <kbd>Shift</kbd>+click split <kbd>RMB</kbd> actions · drag outside to drop',
  takeAll: 'Take all', sort: 'Sort',
  slot: { head: 'Head', face: 'Face', eyes: 'Eyes', ears: 'Ears', torso: 'Torso', armor: 'Armor', legs: 'Legs', gloves: 'Gloves', feet: 'Feet', backpack: 'Backpack', pouch: 'Pouch', primary: 'Primary', secondary: 'Secondary', sidearm: 'Sidearm', melee: 'Melee' } as Record<string, string>,
  kind: { weapon: 'Weapon', magazine: 'Magazine', ammo: 'Ammo', medical: 'Medical', food: 'Food', drink: 'Drink', material: 'Material', tool: 'Tool', clothing: 'Clothing', backpack: 'Backpack', misc: 'Misc', valuable: 'Valuable', container: 'Container' } as Record<string, string>,
  act: { use: 'Use', equip: 'Equip', unequip: 'Unequip', open: 'Open', load: 'Load ammo', unload: 'Unload magazine', unmag: 'Remove magazine', bind: 'Bind to hotbar', split: 'Split stack', drop: 'Drop', take: 'Take', unpack: 'Unpack' },
  stat: { stack: 'Stack', rounds: 'Rounds', ammo: 'Ammo', caliber: 'Caliber', damage: 'Damage', rpm: 'Fire rate', magazine: 'Magazine', none: 'none', storage: 'Storage', only: 'Holds only', items: 'items', heals: 'Heals', food: 'Food', water: 'Water', size: 'Size', value: 'Value', vsEquipped: 'vs equipped' },
  used: 'Used', full: 'No room', pickUp: 'Pick up', no: 'No',
  pickLock: 'Pick lock', lockpickWord: 'lockpick', locked: 'Locked — needs a lockpick',
};

/** Lockpick minigame text. */
export const lockpickText = {
  title: 'Pick the lock',
  hint: '<kbd>Mouse</kbd> move the pick <kbd>A</kbd>/<kbd>D</kbd> or <kbd>LMB</kbd> turn <kbd>Esc</kbd> cancel',
  picks: 'Lockpicks',
  broke: 'The pick snapped',
  none: 'Out of lockpicks',
  opened: 'Unlocked',
  interrupted: 'Interrupted!',
  difficulty: ['', 'Simple lock', 'Average lock', 'Hard lock'],
};

/** Save/load messages. */
export const saveText = {
  saved: 'Game saved',
  loadedSlot: 'Game loaded',
  fellBack: 'The latest save was damaged. Loaded the previous copy.',
  corrupt: 'Save could not be loaded',
  nothing: 'No save in that slot',
};

/** Survival / death text. */
export const survivalText = {
  recoverBag: 'Recover your bag',
  bagName: 'Your Bag',
  bagDropped: 'Your bag stayed where you fell',
  using: 'Using',
  interrupted: 'Interrupted',
  status: {
    bleeding: 'Bleeding', heavy_bleeding: 'Heavy bleeding', fracture: 'Fracture', infection: 'Infection',
    well_fed: 'Well fed', starving: 'Starving', dehydrated: 'Dehydrated', exhausted: 'Exhausted',
  } as Record<string, string>,
};

/** Why a consumable was not used (QA-085). {stage} = infection stage. */
export const useText = {
  nothing: 'Nothing to treat',
  full: "You're not hungry",
  notThirsty: "You're not thirsty",
  tooFarGone: "Antibiotics can't stop a stage {stage} infection. You need an antiviral.",
};

/** Small world prompts (world-builder uses these; text lives here). */
export const worldText = {
  gateOpen: 'Open gate',
  gateClose: 'Close gate',
};

/** Title / pause menu (engine-builder's src/ui/menu; narrative may reword). */
export const menuText = {
  kicker: 'M2 · The Yard',
  title: ['Project', 'Valley'],
  subtitle: 'Survival sandbox — every mechanic, one walled yard.',
  paused: 'Paused',
  tip: 'Tip',
  back: 'Back',
  captureMouse: 'Click to capture mouse',
  nav: { play: 'Play', resume: 'Resume', stations: 'Jump to station', controls: 'Controls', settings: 'Settings', difficulty: 'Difficulty', quit: 'Quit to title' },
  settings: {
    fov: 'Field of view', sensitivity: 'Mouse sensitivity', shake: 'Camera shake', volume: 'Master volume', renderScale: 'Render scale',
    shadows: 'Shadows', fxaa: 'Anti-aliasing (FXAA)', reduceFlashing: 'Reduce flashing',
    gore: 'Gore', goreFull: 'Full', goreReduced: 'Reduced', goreOff: 'Off', reset: 'Reset to defaults',
  },
  difficulty: {
    preset: 'Preset', story: 'Story', survivor: 'Survivor', hardcore: 'Hardcore',
    hungerDrain: 'Hunger drain', thirstDrain: 'Thirst drain', fatigueDrain: 'Fatigue drain',
    infection: 'Infection', starvationDamage: 'Starvation damage',
    onDeath: 'On death', keepAll: 'Keep all', dropBag: 'Drop bag',
    dayLength: 'Day length', minutes: 'min',
    custom: 'Custom — saved with your game.',
  },
};
