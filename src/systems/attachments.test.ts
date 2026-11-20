import { describe, expect, it } from 'vitest';
import { attachDefs } from '../content/data/attachments';
import { ITEMS } from '../content/data/items';
import { itemText } from '../content/text/items';
import { weaponDefs } from '../content/data/weapons';
import { attachOf, canMount, mount, unmount } from './attachments';
import { newItem } from './inventory';

describe('weapon attachments', () => {
  it('every attachment is an item with text, and fits only real weapons', () => {
    for (const d of Object.values(attachDefs)) {
      expect(ITEMS[d.id], d.id).toBeTruthy();
      expect(itemText[d.id], d.id + ' text').toBeTruthy();
      for (const w of d.fits) expect(weaponDefs[w], `${d.id} fits ${w}`).toBeTruthy();
    }
  });

  it('mounts, replaces and removes; the gun record carries the ids', () => {
    const rifle = newItem('rifle_a');
    expect(canMount(rifle, 'scope_4x')).toBe(true);
    expect(canMount(newItem('pistol_a'), 'scope_4x')).toBe(false);
    expect(mount(rifle, 'red_dot')).toBeNull();
    expect(mount(rifle, 'scope_4x')).toBe('red_dot'); // same slot: the old one comes back
    expect(attachOf(rifle, 'optic')?.id).toBe('scope_4x');
    mount(rifle, 'suppressor');
    expect(rifle.attach).toEqual({ optic: 'scope_4x', muzzle: 'suppressor' });
    expect(JSON.parse(JSON.stringify(rifle)).attach.muzzle).toBe('suppressor'); // survives a save round trip
    expect(unmount(rifle, 'muzzle')?.defId).toBe('suppressor');
    expect(unmount(rifle, 'muzzle')).toBeNull();
    unmount(rifle, 'optic');
    expect(rifle.attach).toBeUndefined();
  });

  it('a suppressor shrinks the shot noise and has sounds; extended mags beat the standard ones', () => {
    expect(attachDefs.suppressor.noiseMul).toBeLessThan(0.5);
    expect(attachDefs.scope_4x.fovMul).toBeLessThan(attachDefs.red_dot.fovMul!);
    for (const [ext, base] of [['mag_rifle_ext', 'mag_rifle_a'], ['mag_pistol_ext', 'mag_pistol_a'], ['mag_smg_ext', 'mag_smg_a']]) {
      expect(ITEMS[ext].capacity!).toBeGreaterThan(ITEMS[base].capacity!);
      expect(ITEMS[ext].fits).toEqual(ITEMS[base].fits);
      for (const w of ITEMS[ext].fits!) expect(weaponDefs[w].magazines).toContain(ext);
    }
  });
});
