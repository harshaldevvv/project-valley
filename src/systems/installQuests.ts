import { Vector3 } from 'three';
import { POIS } from '../content/data/pois';
import { QUEST_PLACED } from '../content/data/quests';
import { itemText } from '../content/text/items';
import { noteText, questUi as T } from '../content/text/quests';
import type { Game } from '../core/game';
import { QuestUi, textOf } from '../ui/quests/questUi';
import '../ui/inventory/craft.css';
import * as fuel from './fuel';
import { autoPlace, newItem, newItems } from './inventory';
import type { Loadout } from './loadout';
import { QUEST_SAVE_VERSION, Quests, type QuestSave } from './quests';
import { questBus } from './questBus';

/**
 * World side of quests v1: feeds the pure rules (systems/quests.ts) from game events and the quest bus, puts the quest
 * notes into their containers, shows the HUD tracker and the journal (J), toasts progress, and saves its slice 'quests'.
 */
export function installQuests(game: Game, lo: Loadout, deps: { sfx(id: string, at?: Vector3): void; toast(t: string, icon?: string): void; screens: Set<string> }) {
  const here = () => {
    try {
      const p = game.player.position;
      return { x: p.x, z: p.z };
    } catch {
      return { x: game.camera.position.x, z: game.camera.position.z };
    }
  };
  const quests = new Quests({
    pos: here,
    count: (item) => lo.countAll(item),
    fuel: () => fuel.carried(lo),
    hours: () => (game.time.day - 1) * 24 + game.time.hours,
    place: (id) => POIS.find((p) => p.id === id),
    give: (item, count) => {
      for (const it of newItems(item, count)) lo.give(it);
      deps.toast(T.rewardGiven(itemText[item]?.name ?? item, count), item);
    },
  });

  const ui = new QuestUi(
    quests,
    {
      sfx: deps.sfx,
      onOpenChange: (open) => game.events.emit('uiScreen', { name: 'quests', open }),
      pos: () => {
        try {
          const p = game.player.position;
          const f = game.player.forward;
          return { x: p.x, z: p.z, fx: f.x, fz: f.z };
        } catch {
          return null;
        }
      },
      readNote: (id) => showNote(id),
    },
    game.ui,
  );

  // ---------- notes ----------
  const card = document.createElement('div');
  card.className = 'note-card';
  game.ui.appendChild(card);
  let cardT = 0;
  function showNote(id: string) {
    const n = noteText[id];
    if (!n) return;
    card.textContent = '';
    const head = document.createElement('b');
    head.textContent = n.title;
    const body = document.createElement('div');
    body.textContent = n.body;
    card.append(head, body);
    card.classList.add('on');
    cardT = 14;
  }

  // ---------- feeding the rules ----------
  quests.on((e) => {
    if (e.type === 'started') deps.toast(T.newQuest(textOf(e.quest).title));
    else if (e.type === 'step') deps.toast(T.step(textOf(e.quest).objectives[e.index] ?? ''));
    else if (e.type === 'progress') deps.toast(`${textOf(e.quest).objectives[e.index] ?? ''} ${T.progress(e.n, e.of)}`);
    else if (e.type === 'done') {
      deps.toast(T.complete(textOf(e.quest).title));
      deps.sfx('item_pickup');
    }
    ui.refresh();
  });
  game.events.on('zombieKilled', ({ position }) => quests.report({ type: 'kill', x: position.x, z: position.z }));
  game.events.on('itemUsed', (e) => {
    const action = (e.use as { action?: string } | undefined)?.action;
    if (action === 'read') {
      const id = e.defId;
      showNote(id);
      quests.report({ type: 'note', id });
    }
    quests.report({ type: 'use', item: e.defId });
  });
  questBus.on((s) => {
    if (s.name === 'light_on') quests.report({ type: 'use', item: 'flashlight_a' });
    else if (s.name === 'craft') quests.report({ type: 'craft', recipe: String(s.data?.recipe) });
    else quests.report({ type: 'event', name: s.name, poi: s.data?.poi as string | undefined });
  });

  // ---------- quest items in their containers ----------
  /** Put the notes and key items into their containers unless the player has had them already. */
  function ensurePlaced() {
    for (const p of QUEST_PLACED) {
      const c = lo.containers.get(p.container);
      if (!c || quests.seen.has(p.item) || lo.countAll(p.item) > 0) continue;
      if (c.grid.contents.some((g) => g.item.defId === p.item)) continue;
      if (autoPlace(c.grid, newItem(p.item, p.count ?? 1)) === 0) lo.changed();
    }
  }
  ensurePlaced();

  // ---------- journal key, tick ----------
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && ui.isOpen) return ui.close();
    if (e.code !== 'KeyJ' || e.repeat) return;
    if (ui.isOpen) return ui.close();
    if (game.input.blocked || deps.screens.size > 0) return;
    cardT = 0;
    card.classList.remove('on'); // the note card would sit on top of the journal
    ui.open();
  });
  let acc = 0;
  game.addSystem({
    name: 'quests',
    step(dt) {
      if ((acc += dt) < 0.25) return;
      acc = 0;
      for (const it of QUEST_PLACED) if (!quests.seen.has(it.item) && lo.countAll(it.item) > 0) quests.markSeen(it.item);
      quests.tick();
    },
    render(_a, dt) {
      ui.update();
      if (cardT > 0 && (cardT -= dt) <= 0) card.classList.remove('on');
    },
  });
  game.events.on('playerDied', () => ui.close());

  const api = {
    quests,
    ui,
    showNote,
    ensurePlaced,
    serialize: (): QuestSave => quests.serialize(),
    load(d: QuestSave, v = QUEST_SAVE_VERSION) {
      quests.load(d, v);
      ensurePlaced();
      ui.refresh();
    },
  };
  try {
    const dbg = game.debug;
    dbg.action('Quests', 'Skip current objective', () => quests.tracked && quests.skip(quests.tracked));
    dbg.action('Quests', 'Reset all quests', () => api.load({ state: {}, tracked: null, notes: [], seen: [] }));
  } catch {
    /* debug menu not installed */
  }
  return api;
}
