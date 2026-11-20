import { CONTAINERS } from '../content/data/containers';
import { ITEMS, ITEM_RENAMES } from '../content/data/items';
import type { GridItem, ItemInstance } from '../content/data/types';
import type { LoadoutSave } from './loadout';

/**
 * Keeps old saves loadable after the item table changes (a player must never lose a save because a designer renamed
 * or removed an item). Renamed ids are mapped through ITEM_RENAMES; items that still have no definition are removed
 * and reported (never thrown), as are containers whose type no longer exists.
 */
export interface RepairReport {
  renamed: number;
  dropped: string[];
}

export function repairLoadoutSave(s: LoadoutSave): RepairReport {
  const rep: RepairReport = { renamed: 0, dropped: [] };
  const fix = (it: ItemInstance | null | undefined): boolean => {
    if (!it) return true;
    const to = ITEM_RENAMES[it.defId];
    if (to && !ITEMS[it.defId]) {
      it.defId = to;
      rep.renamed++;
    }
    if (!ITEMS[it.defId]) {
      rep.dropped.push(it.defId);
      return false;
    }
    if (it.mag && !fix(it.mag)) it.mag = null;
    if (it.contents) it.contents = keep(it.contents);
    if (it.pockets) it.pockets = it.pockets.map(keep);
    return true;
  };
  const keep = (list: GridItem[]) => list.filter((g) => fix(g.item));
  for (const [slot, it] of Object.entries(s.equipment)) if (!fix(it)) delete s.equipment[slot as keyof typeof s.equipment];
  s.pickups = s.pickups.filter((p) => fix(p.item));
  s.containers = s.containers.filter((c) => {
    if (!CONTAINERS[c.defId]) {
      rep.dropped.push(`container:${c.defId}`);
      return false;
    }
    c.contents = keep(c.contents);
    return true;
  });
  s.hotbar = s.hotbar.map((id) => {
    const now = id && (ITEMS[id] ? id : ITEM_RENAMES[id]);
    return now && ITEMS[now] ? now : null;
  });
  return rep;
}
