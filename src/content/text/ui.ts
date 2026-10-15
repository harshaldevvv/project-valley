/** Inventory screen chrome (systems-builder; narrative may reword). */
export const inventoryText = {
  equipment: 'Equipment', weapons: 'Weapons', hotbar: 'Hotbar', inventory: 'Inventory', vicinity: 'Ground',
  noStorage: 'No storage. Equip a jacket or a backpack.',
  hint: '<kbd>Tab</kbd> close <kbd>R</kbd> rotate <kbd>Ctrl</kbd>+click quick move <kbd>Shift</kbd>+click split <kbd>RMB</kbd> actions · drag outside to drop',
  takeAll: 'Take all', sort: 'Sort',
  slot: { head: 'Head', face: 'Face', eyes: 'Eyes', ears: 'Ears', torso: 'Torso', armor: 'Armor', legs: 'Legs', gloves: 'Gloves', feet: 'Feet', backpack: 'Backpack', primary: 'Primary', secondary: 'Secondary', sidearm: 'Sidearm', melee: 'Melee' } as Record<string, string>,
  kind: { weapon: 'Weapon', magazine: 'Magazine', ammo: 'Ammo', medical: 'Medical', food: 'Food', drink: 'Drink', material: 'Material', tool: 'Tool', clothing: 'Clothing', backpack: 'Backpack', misc: 'Misc' } as Record<string, string>,
  act: { use: 'Use', equip: 'Equip', unequip: 'Unequip', open: 'Open', load: 'Load ammo', unload: 'Unload magazine', unmag: 'Remove magazine', bind: 'Bind to hotbar', split: 'Split stack', drop: 'Drop', take: 'Take' },
  stat: { stack: 'Stack', rounds: 'Rounds', ammo: 'Ammo', caliber: 'Caliber', damage: 'Damage', rpm: 'Fire rate', magazine: 'Magazine', none: 'none', storage: 'Storage', items: 'items', heals: 'Heals', food: 'Food', water: 'Water', size: 'Size', value: 'Value', vsEquipped: 'vs equipped' },
  used: 'Used', full: 'No room', pickUp: 'Pick up', no: 'No',
};
