import type { Game } from '../../core/game';
import { attachDefs } from '../../content/data/attachments';
import { keys } from '../../content/data/input';
import { ITEMS } from '../../content/data/items';
import { throwOrder } from '../../content/data/throwables';
import { hintText, type HintId } from '../../content/text/tips';
import { questBus } from '../../systems/questBus';
import { fixedKeys, keyName } from './keys';

/**
 * First-time one-line hints. Each fires once per browser (seen-set in localStorage 'pv.hints.v1') from what the player
 * just did: got materials (craft), got a quest (journal), picked up a throwable or a gun part, laid a campfire, opened
 * a trader, got into a car. Shown one at a time at the bottom of the screen, only while playing.
 *   const hints = installHints(game, () => menu.mode === 'playing');   hints.reset();
 */
const KEY = 'pv.hints.v1';
const SHOW_S = 7;
const POLL_S = 0.5;

const MATERIALS = Object.values(ITEMS).filter((d) => d.kind === 'material').map((d) => d.id);
const ATTACH = Object.keys(attachDefs);

export function hintLine(id: HintId): string {
  return hintText[id]
    .replace('{key}', keyName(
      id === 'craft' ? fixedKeys.craft.code
      : id === 'journal' ? fixedKeys.journal.code
      : id === 'throw' ? keys.throwAim
      : id === 'attachments' ? fixedKeys.inventory.code
      : keys.interact,
    ))
    .replace('{cycle}', keyName(keys.throwCycle));
}

export function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

export function installHints(game: Game, playing: () => boolean) {
  const seen = loadSeen();
  const queue: HintId[] = [];
  let showLeft = 0;
  const el = document.createElement('div');
  el.id = 'pv-hint';
  el.setAttribute('role', 'status');
  el.style.cssText = 'position:fixed;left:50%;bottom:118px;transform:translateX(-50%);z-index:13;display:none;max-width:min(560px,90vw);padding:7px 14px;border-radius:3px;pointer-events:none;background:rgba(14,16,18,.86);border-left:3px solid #d9a441;color:#efe6d2;font:600 13px system-ui;text-align:center';
  document.body.appendChild(el);
  // Hidden (and its timer held) behind the pause menu, any open screen (dialogue, journal, craft...) and the build bar:
  // it sits bottom centre, right where dialogue choices and build cards go.
  const open = new Set<string>();
  game.events.on('uiScreen', ({ name, open: o }) => (o ? open.add(name) : open.delete(name)));
  // ...and behind the death card: held (timer paused) from playerDied until respawn
  game.events.on('playerDied', () => open.add('dead'));
  game.events.on('playerRespawned', () => open.delete('dead'));
  const clear = () => {
    try {
      return playing() && open.size === 0 && !game.build?.active;
    } catch {
      return playing() && open.size === 0; // build not installed
    }
  };
  setInterval(() => (el.style.visibility = clear() ? 'visible' : 'hidden'), 200);

  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...seen]));
    } catch {
      /* storage blocked: hints repeat next visit */
    }
  };
  const fire = (id: HintId) => {
    if (seen.has(id) || queue.includes(id)) return;
    queue.push(id);
  };

  game.events.on('uiScreen', ({ name, open }) => open && name === 'npc' && fire('trader'));
  questBus.on((s) => (s.name === 'campfire_placed' || s.name === 'campfire_lit') && fire('campfire'));

  const has = (ids: readonly string[]) => ids.some((id) => (game.loadout?.count(id) ?? 0) > 0);
  let acc = 0;
  game.addSystem({
    name: 'hints',
    step(dt) {
      if ((acc += dt) < POLL_S) return;
      const step = acc;
      acc = 0;
      if (!seen.has('craft') && has(MATERIALS)) fire('craft');
      if (!seen.has('throw') && has(throwOrder)) fire('throw');
      if (!seen.has('attachments') && has(ATTACH)) fire('attachments');
      if (!seen.has('fuel') && game.player?.inVehicle) fire('fuel');
      if (!seen.has('journal')) {
        const q = (window as unknown as { __quests?: { quests?: { active?(): unknown[] } } }).__quests;
        if ((q?.quests?.active?.().length ?? 0) > 0) fire('journal');
      }
      // display
      if (showLeft > 0) {
        if (!clear()) return;
        showLeft -= step;
        if (showLeft <= 0) el.style.display = 'none';
        return;
      }
      if (!queue.length || !clear()) return;
      const id = queue.shift()!;
      seen.add(id);
      persist();
      el.textContent = hintLine(id);
      el.style.display = 'block';
      showLeft = SHOW_S;
    },
  });

  return {
    /** Forget every seen hint (Settings button). */
    reset() {
      seen.clear();
      persist();
    },
    seen,
  };
}
