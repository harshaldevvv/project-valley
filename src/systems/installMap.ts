import { Vector3 } from 'three';
import { POIS } from '../content/data/pois';
import { mapText } from '../content/text/map';
import { poiText } from '../content/text/pois';
import type { Game } from '../core/game';
import { MapScreen } from '../ui/map/mapScreen';
import { textOf } from '../ui/quests/questUi';
import type { Quests } from './quests';

/** A place marks itself on the map once you come this close to its edge (metres). */
export const MAP_DISCOVER_MARGIN = 35;
export const MAP_SAVE_VERSION = 1;
export interface MapSave { found: string[] }

/**
 * World side of the map screen (K): discovers places as you get near them (toast once), feeds the screen the player
 * pose and the tracked quest target, and saves the found list as the 'map' slice.
 */
export function installMap(game: Game, quests: Quests, deps: { sfx(id: string, at?: Vector3): void; toast(t: string, icon?: string): void; screens: Set<string> }) {
  const found = new Set<string>();
  const pose = () => {
    try {
      const p = game.player.position;
      const f = game.player.forward;
      return { x: p.x, z: p.z, fx: f.x, fz: f.z };
    } catch {
      return null;
    }
  };
  const screen = new MapScreen(
    {
      sfx: deps.sfx,
      onOpenChange: (open) => game.events.emit('uiScreen', { name: 'map', open }),
      pos: pose,
      quest: () => {
        const id = quests.tracked;
        const t = id ? quests.target(id) : null;
        return id && t ? { title: textOf(id).title, poi: t.poi, x: t.x, z: t.z } : null;
      },
      discovered: () => found,
    },
    game.ui,
  );

  const discover = (ids: string[], quiet = false) => {
    let added = false;
    for (const id of ids) {
      if (found.has(id) || !POIS.some((p) => p.id === id)) continue;
      found.add(id);
      added = true;
      if (!quiet) deps.toast(mapText.discovered(poiText[id]?.name ?? id));
    }
    if (added) screen.refresh();
  };

  addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select')) return;
    if (screen.isOpen && e.code === 'Escape') return screen.close();
    if (screen.isOpen && screen.key(e.code)) return e.preventDefault();
    if (e.code !== 'KeyK' || e.repeat) return;
    if (screen.isOpen) return screen.close();
    if (game.input.blocked || deps.screens.size > 0) return;
    screen.open();
  });

  let acc = 0;
  let qKey = '';
  game.addSystem({
    name: 'map',
    step(dt) {
      if ((acc += dt) < 0.5) return;
      acc = 0;
      const p = pose();
      if (p) discover(POIS.filter((q) => Math.hypot(q.x - p.x, q.z - p.z) <= q.radius + MAP_DISCOVER_MARGIN).map((q) => q.id));
      // the tracked objective moved on while the map is open
      const k = `${quests.tracked}|${quests.tracked ? quests.target(quests.tracked)?.poi : ''}`;
      if (k !== qKey) ((qKey = k), screen.refresh());
    },
    render() {
      screen.update();
    },
  });
  game.events.on('playerDied', () => screen.close());

  return {
    screen,
    found,
    discover,
    serialize: (): MapSave => ({ found: [...found] }),
    load(d: MapSave) {
      found.clear();
      discover(d?.found ?? [], true);
      screen.refresh();
    },
  };
}
