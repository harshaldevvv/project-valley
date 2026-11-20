import { attachDefs, type AttachDef, type AttachSlot } from '../content/data/attachments';
import type { ItemInstance } from '../content/data/types';
import { newItem } from './inventory';

/**
 * Attachment rules (data/attachments.ts). Pure functions on item instances so the inventory screen, the weapons runtime
 * and the tests share them. The attachment item is consumed on mounting and a fresh one is returned on removal.
 */
export const attachOf = (gun: ItemInstance | null | undefined, slot: AttachSlot): AttachDef | null => {
  const id = gun?.attach?.[slot];
  return id ? (attachDefs[id] ?? null) : null;
};

export const canMount = (gun: ItemInstance, attId: string) => !!attachDefs[attId]?.fits.includes(gun.defId);

/** Mount `attId` on the gun. Returns the id that was replaced in that slot (give it back), or null. */
export function mount(gun: ItemInstance, attId: string): string | null {
  const d = attachDefs[attId];
  if (!d || !d.fits.includes(gun.defId)) return null;
  gun.attach ??= {};
  const old = gun.attach[d.slot] ?? null;
  gun.attach[d.slot] = attId;
  return old;
}

/** Remove whatever is in `slot`; returns a new item for it (or null). */
export function unmount(gun: ItemInstance, slot: AttachSlot): ItemInstance | null {
  const id = gun.attach?.[slot];
  if (!id) return null;
  delete gun.attach![slot];
  if (!Object.keys(gun.attach!).length) delete gun.attach;
  return newItem(id);
}

/** All mounted attachment ids of a gun. */
export const mountedIds = (gun: ItemInstance): string[] => Object.values(gun.attach ?? {});
