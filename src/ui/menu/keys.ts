import { keys } from '../../content/data/input';
import { BINOCULARS } from '../../content/data/tools';
import { keyLabels as L } from '../../content/text/tips';

/**
 * Keys that are bound outside the data/input table, with where they are read. keys.test.ts checks each code
 * still appears in its file, so this list cannot drift from the game.
 */
export const fixedKeys = {
  craft: { code: 'KeyG', file: 'src/systems/installCraft.ts' },
  journal: { code: 'KeyJ', file: 'src/systems/installQuests.ts' },
  map: { code: 'KeyK', file: 'src/systems/installMap.ts' },
  flashlight: { code: 'KeyL', file: 'src/engine/flashlight.ts' },
  inventory: { code: 'Tab', file: 'src/ui/inventory/screen.ts' },
  build: { code: 'KeyB', file: 'src/ui/build/buildMode.ts' },
} as const;

/** KeyboardEvent.code (or the Mouse0/Mouse2 pseudo-codes) as a short key name. */
export function keyName(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const named: Record<string, string> = { ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', Space: 'Space', Tab: 'Tab', Mouse0: 'LMB', Mouse2: 'RMB', Escape: 'Esc' };
  return named[code] ?? code;
}

/** The key list shown in Settings and on the pause card: [action label, key]. */
export function keyList(): [string, string][] {
  return [
    [L.move, [keys.forward, keys.left, keys.back, keys.right].map(keyName).join(' ')],
    [L.interact, keyName(keys.interact)],
    [L.inventory, keyName(fixedKeys.inventory.code)],
    [L.craft, keyName(fixedKeys.craft.code)],
    [L.journal, keyName(fixedKeys.journal.code)],
    [L.map, keyName(fixedKeys.map.code)],
    [L.throwAim, keyName(keys.throwAim)],
    [L.throwCycle, keyName(keys.throwCycle)],
    [L.binoculars, keyName(BINOCULARS.key)],
    [L.flashlight, keyName(fixedKeys.flashlight.code)],
    [L.vehicle, keyName(keys.vehicle)],
    [L.build, keyName(fixedKeys.build.code)],
    [L.help, keyName(keys.help)],
  ];
}
