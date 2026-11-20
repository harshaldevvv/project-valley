import { describe, expect, it } from 'vitest';
import { hintText } from '../../content/text/tips';
import { fixedKeys, keyList, keyName } from './keys';
import craftSrc from '../../systems/installCraft.ts?raw';
import questsSrc from '../../systems/installQuests.ts?raw';
import flashSrc from '../../engine/flashlight.ts?raw';
import invSrc from '../inventory/screen.ts?raw';
import buildSrc from '../build/buildMode.ts?raw';

const SRC: Record<string, string> = {
  'src/systems/installCraft.ts': craftSrc,
  'src/systems/installQuests.ts': questsSrc,
  'src/engine/flashlight.ts': flashSrc,
  'src/ui/inventory/screen.ts': invSrc,
  'src/ui/build/buildMode.ts': buildSrc,
};

describe('menu key list', () => {
  it('fixed keys are still read where the list says', () => {
    for (const { code, file } of Object.values(fixedKeys)) expect(SRC[file], file).toContain(`'${code}'`);
  });
  it('names keys and lists the onboarding keys', () => {
    expect(keyName('KeyG')).toBe('G');
    expect(keyName('Mouse0')).toBe('LMB');
    const shown = Object.fromEntries(keyList().map(([, k]) => [k, true]));
    for (const k of ['G', 'J', 'N', 'M', 'Z', 'L', 'E', 'Tab']) expect(shown[k], k).toBe(true);
  });
  it('hints are one short line', () => {
    for (const t of Object.values(hintText)) expect(t.length).toBeLessThanOrEqual(110);
  });
});
