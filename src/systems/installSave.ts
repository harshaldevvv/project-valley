import { SAVE } from '../content/data/save';
import { saveText } from '../content/text/ui';
import type { Game } from '../core/game';
import { SaveManager } from './save';
import { indexedKV } from './storage';

/**
 * Save glue: game.save (IndexedDB), autosave (5 min, on hide/pagehide, never mid-combat), F5 quick save,
 * F9 quick load, storage.persist() after 15 min, and the F1 "Save" group.
 */
export function installSave(game: Game, deps: { toast(t: string): void; info(): { gameDay: number; playtimeS: number } }) {
  const mgr = new SaveManager(indexedKV(), {
    toast: deps.toast,
    saved: (slot) => game.events.emit('saved', { slot }),
    loaded: (slot) => game.events.emit('loaded', { slot }),
    info: deps.info,
  });
  game.save = mgr;

  // Combat = took damage or fired recently (no mechanics flag needed).
  let lastFight = -Infinity;
  const now = () => performance.now() / 1000;
  game.events.on('playerDamaged', () => (lastFight = now()));
  game.events.on('shot', (e) => e.by === 'player' && (lastFight = now()));
  const inCombat = () => now() - lastFight < SAVE.combatWindowS;

  const quiet = (slot: string, announce = false) =>
    mgr.save(slot).then(
      () => announce && deps.toast(saveText.saved),
      (e) => console.warn('save failed', e),
    );

  // Autosave on a timer; waits out combat for up to combatDeferMaxS.
  let sinceAuto = 0;
  let deferred = 0;
  let played = 0;
  let persisted = false;
  game.addSystem({
    name: 'autosave',
    step(dt) {
      played += dt;
      if (!persisted && played >= SAVE.persistAfterS) {
        persisted = true;
        void navigator.storage?.persist?.();
      }
      if ((sinceAuto += dt) < SAVE.autosaveEveryS) return;
      if (inCombat() && (deferred += dt) < SAVE.combatDeferMaxS) return;
      sinceAuto = deferred = 0;
      void quiet('auto');
    },
  });
  // Leaving the tab: always write (the next chance may never come).
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && void quiet('auto'));
  addEventListener('pagehide', () => void quiet('auto'));

  addEventListener('keydown', (e) => {
    if (e.code !== 'F5' && e.code !== 'F9') return;
    e.preventDefault(); // F5 would reload the page
    if (e.repeat) return;
    if (e.code === 'F5') void quiet('quick', true);
    else void mgr.load('quick').then((ok) => deps.toast(ok ? saveText.loadedSlot : saveText.nothing));
  });

  try {
    const d = game.debug;
    d.action('Save', 'Quick save (F5)', () => void quiet('quick', true));
    d.action('Save', 'Quick load (F9)', () => void mgr.load('quick').then((ok) => deps.toast(ok ? saveText.loadedSlot : saveText.nothing)));
    for (const slot of ['manual-1', 'auto']) {
      d.action('Save', `Save ${slot}`, () => void quiet(slot, true));
      d.action('Save', `Load ${slot}`, () => void mgr.load(slot).then((ok) => deps.toast(ok ? saveText.loadedSlot : saveText.nothing)));
    }
    d.action('Save', 'Export quick (.zsave)', async () => {
      const blob = await mgr.exportSlot('quick');
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'project-valley-quick.zsave' });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    d.action('Save', 'Import .zsave to manual-3', () => {
      const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.zsave' });
      inp.onchange = async () => inp.files?.[0] && deps.toast((await mgr.importSlot('manual-3', inp.files[0])) ? saveText.saved : saveText.corrupt);
      inp.click();
    });
  } catch (e) {
    console.warn('save: debug menu not available', e);
  }
  return mgr;
}
