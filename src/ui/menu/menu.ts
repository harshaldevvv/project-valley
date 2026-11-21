import { pointerLock } from '../../content/data/input';
import { requestLock } from '../../engine/input';
import { CatmullRomCurve3, MathUtils, Quaternion, Vector3, Matrix4 } from 'three';
import type { Game } from '../../core/game';
import { yard } from '../../content/data/yard';
import { controlsHelp } from '../../content/text/controls';
import { loadingTips, pauseCardTitle, settingsText as ST } from '../../content/text/tips';
import { HORDE_NIGHT } from '../../content/data/zombie_arch';
import { installHints } from './hints';
import { keyList } from './keys';
import { applyPreset, difficulty, DIFFICULTY_PRESETS, type DeathPenalty } from '../../content/data/difficulty';
import { DEFAULT_SETTINGS, effectiveQuality, loadSettings, presetIntoSettings, saveSettings, type Settings } from './settings';
import { qualityText as QT } from '../../content/text/quality';
import { QUALITY, type QualityId } from '../../content/data/quality';
import { SAVE } from '../../content/data/save';
import type { SaveSlotInfo } from '../../core/contracts';
import { MENU_CSS } from './style';
import { menuText as T, saveText as SV } from '../../content/text/ui';

/**
 * Title + pause menu living in the demo world (no level load).
 *   installMenu(game, { applySettings, stations })   // from installEngine; wraps game.renderFrame
 * - Title: the Yard renders behind it from a slow closed-spline fly-over of the stations.
 * - Play / Jump to station: the camera blends from the fly-over into the player's live camera, input unblocks at once.
 * - Esc (or losing pointer lock) while playing opens the pause version: Resume / Settings / Controls / Quit to title.
 * - Emits uiScreen {name:'menu'} so gameplay input is blocked while it is open.
 * `?play` in the URL skips the title (perf runs, quick tests).
 */
export interface MenuStation {
  id: string;
  label: string;
  go(): void; // teleport the player there
}
type Mode = 'title' | 'playing' | 'paused';
type Page = 'main' | 'stations' | 'controls' | 'settings' | 'difficulty' | 'saves';

const BLEND_IN_S = 1.8;
const BLEND_OUT_S = 2.2;
const FLY_PERIOD_S = 150;
const TIP_MS = 8000;

export function installMenu(game: Game, opts: { applySettings(s: Settings): void; onQualityPicked?(q: Settings['quality']): void; stations: MenuStation[] }) {
  const style = document.createElement('style');
  style.textContent = MENU_CSS;
  document.head.appendChild(style);

  const settings = loadSettings();
  /** Settings the menu applies itself (data tables, not the render pipeline). `?lock=1/0` beats the saved choice. */
  const lockParam = new URLSearchParams(location.search).get('lock');
  const applyOwn = (s: Settings) => {
    if (lockParam === null) pointerLock.enabled = s.captureMouse;
    if (!pointerLock.enabled && document.pointerLockElement) document.exitPointerLock();
    HORDE_NIGHT.enabled = s.hordeNight;
  };
  const apply = (s: Settings) => {
    opts.applySettings(s);
    applyOwn(s);
  };
  apply(settings);

  const root = document.createElement('div');
  root.id = 'menu';
  root.innerHTML = `
    <div class="mn-vignette"></div>
    <div class="mn-left">
      <div class="mn-brand">
        <div class="mn-kicker"><span></span>${T.kicker}</div>
        <h1>${T.title.join('<br>')}</h1>
        <div class="mn-sub">${T.subtitle}</div>
        <div class="mn-paused">${T.paused}</div>
      </div>
      <nav class="mn-nav"></nav>
    </div>
    <section class="mn-panel" hidden><header><h2></h2><button class="mn-x" aria-label="${T.back}">&times;</button></header><div class="mn-body"></div><div class="mn-pkeys">${T.panelKeys}</div></section>
    <aside class="mn-card" aria-label="${pauseCardTitle}"><h3>${pauseCardTitle}</h3><div class="mn-krows"></div></aside>
    <footer class="mn-tip"><b>${T.tip}</b><span></span></footer>
    <div class="mn-ver">v0.0.1 &middot; ${game.backend.toUpperCase()}</div>`;
  document.body.appendChild(root);
  const nav = root.querySelector('.mn-nav') as HTMLElement;
  const panel = root.querySelector('.mn-panel') as HTMLElement;
  const panelTitle = panel.querySelector('h2') as HTMLElement;
  const body = panel.querySelector('.mn-body') as HTMLElement;
  const tipText = root.querySelector('.mn-tip span') as HTMLElement;
  const keyRows = (el: HTMLElement) => {
    for (const [action, key] of keyList()) {
      const r = document.createElement('div');
      r.className = 'krow';
      r.innerHTML = '<span></span><kbd></kbd>';
      r.querySelector('span')!.textContent = action;
      r.querySelector('kbd')!.textContent = key;
      el.append(r);
    }
  };
  keyRows(root.querySelector('.mn-card .mn-krows') as HTMLElement);

  const sfx = (id: string) => {
    try {
      game.audio.play(id);
    } catch {
      /* audio not installed */
    }
  };

  // --- tips ---------------------------------------------------------------------------------
  let tip = Math.floor(Math.random() * loadingTips.length);
  const showTip = () => {
    tipText.classList.remove('in');
    setTimeout(() => {
      tipText.textContent = loadingTips[tip++ % loadingTips.length] ?? '';
      tipText.classList.add('in');
    }, 350);
  };
  showTip();
  setInterval(() => mode !== 'playing' && showTip(), TIP_MS);

  // --- state --------------------------------------------------------------------------------
  let mode: Mode = 'title';
  let page: Page = 'main';

  /** `act` is a stable id for tests/automation (defaults to the label slug). */
  const button = (label: string, fn: (kbd: boolean) => void, cls = '', act?: string) => {
    const b = document.createElement('button');
    b.className = `mn-btn ${cls}`;
    b.innerHTML = '<span></span>';
    b.querySelector('span')!.textContent = label;
    b.dataset.act = act ?? label.toLowerCase().replace(/\s+/g, '-');
    b.onclick = (e) => {
      sfx('ui_click');
      fn(e.detail === 0); // keyboard Enter/Space clicks have detail 0
    };
    return b;
  };

  // --- saves (game.save is installed after the menu, so it is read lazily) --------------------
  const saveApi = () => (game as { save?: Game['save'] }).save;
  let slots: SaveSlotInfo[] = [];
  let loadFailed = false;
  const refreshSlots = async () => {
    try {
      slots = (await saveApi()?.list()) ?? [];
    } catch {
      slots = [];
    }
    if (mode === 'title') renderNav();
    if (page === 'saves' && mode !== 'playing') showPage('saves', { keep: true });
  };
  game.events.on('saved', () => void refreshSlots());
  const playtime = (sec: number) => {
    const m = Math.round(sec / 60);
    return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.max(1, m)} min`;
  };
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const when = (t: number) => {
    const min = Math.round((Date.now() - t) / 60000);
    if (min < 60) return rtf.format(-min, 'minute');
    if (min < 24 * 60) return rtf.format(-Math.round(min / 60), 'hour');
    return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  const slotName = (id: string) => SV.slots[id] ?? id;
  const loadSlot = async (slot: string) => {
    const ok = await (saveApi()?.load(slot) ?? Promise.resolve(false)).catch(() => false);
    if (ok) return play();
    loadFailed = true;
    showPage('saves', { keep: page === 'saves' });
  };

  const renderNav = () => {
    const had = (document.activeElement as HTMLElement | null)?.dataset?.act;
    nav.replaceChildren();
    const N = T.nav;
    const latest = slots[0];
    if (mode === 'title' && latest) {
      // a save exists: Continue (newest slot) leads; Play keeps the world that is running now
      const c = button(N.continue, () => void loadSlot(latest.slot), 'primary', 'continue');
      const sub = document.createElement('small');
      sub.textContent = T.continueSub.replace('{day}', String(latest.gameDay)).replace('{slot}', slotName(latest.slot)).replace('{when}', when(latest.savedAt));
      c.append(sub);
      nav.append(c, button(N.play, () => play(), '', 'play'));
    } else if (mode === 'title') nav.append(button(N.play, () => play(), 'primary', 'play'));
    else nav.append(button(N.resume, () => resume(), 'primary', 'resume'));
    const open = (p: Page) => (kbd: boolean) => showPage(p, { focus: kbd });
    nav.append(
      button(mode === 'title' ? N.saves : N.savesPaused, open('saves'), '', 'saves'),
      button(N.settings, open('settings'), '', 'settings'),
      button(N.controls, open('controls'), '', 'controls'),
      button(N.difficulty, open('difficulty'), '', 'difficulty'),
      button(N.stations, open('stations'), '', 'jump-to-station'),
    );
    if (mode === 'paused') nav.append(button(N.quit, () => quitToTitle(), 'quiet', 'quit-to-title'));
    root.classList.toggle('is-paused', mode === 'paused');
    for (const b of nav.querySelectorAll('.mn-btn')) b.classList.toggle('active', page !== 'main' && (b as HTMLElement).dataset.act === pageAct[page]);
    if (had) nav.querySelector<HTMLElement>(`[data-act="${had}"]`)?.focus();
  };

  /** Focusable controls in the open panel, top to bottom (a segmented control counts once: its checked radio). */
  const panelItems = () =>
    [...body.querySelectorAll<HTMLElement>('input[type=range], input[type=checkbox], .mn-seg input:checked, button:not(:disabled)')].filter(
      (e) => (e.matches('input') ? (e.closest('.row') as HTMLElement | null) : e)?.offsetParent !== null,
    );
  /**
   * focus: put keyboard focus on the first control (the page was opened from the keyboard).
   * keep: re-render in place (no slide-in; the scroll position and the focused control's index survive).
   */
  const showPage = (p: Page, o: { focus?: boolean; keep?: boolean } = {}) => {
    const prev = page;
    page = p;
    for (const b of nav.querySelectorAll('.mn-btn')) b.classList.toggle('active', (b as HTMLElement).dataset.act === pageAct[p]);
    if (p === 'main') {
      const wasIn = panel.contains(document.activeElement);
      panel.hidden = true;
      // hand focus back to the entry that opened the panel, so the arrows keep working
      if (wasIn && pageAct[prev]) nav.querySelector<HTMLElement>(`[data-act="${pageAct[prev]}"]`)?.focus({ focusVisible: true } as FocusOptions);
      return;
    }
    const keepAt = o.keep ? panelItems().indexOf(document.activeElement as HTMLElement) : -1;
    const scroll = o.keep ? body.scrollTop : 0;
    panel.hidden = false;
    if (!o.keep) {
      panel.classList.remove('in');
      void panel.offsetWidth; // restart the CSS transition
      panel.classList.add('in');
    }
    body.replaceChildren();
    fillPage(p);
    body.scrollTop = scroll;
    const items = panelItems();
    const f = keepAt >= 0 ? items[Math.min(keepAt, items.length - 1)] : o.focus ? items[0] : null;
    f?.focus({ focusVisible: true } as FocusOptions);
  };
  const fillPage = (p: Page) => {
    if (p === 'stations') {
      panelTitle.textContent = T.nav.stations;
      const grid = document.createElement('div');
      grid.className = 'mn-stations';
      for (const s of opts.stations) {
        const b = button(s.label, () => play(s), 'station');
        grid.append(b);
      }
      body.append(grid);
    } else if (p === 'controls') {
      panelTitle.textContent = T.nav.controls;
      const wrap = document.createElement('div');
      wrap.className = 'mn-controls';
      for (const g of controlsHelp) {
        const sec = document.createElement('div');
        sec.innerHTML = `<h3>${g.group}</h3>` + g.rows.map(([k, a]) => `<div class="row"><span>${a}</span><kbd>${k}</kbd></div>`).join('');
        wrap.append(sec);
      }
      body.append(wrap);
    } else if (p === 'settings') {
      panelTitle.textContent = T.nav.settings;
      body.append(settingsForm());
    } else if (p === 'difficulty') {
      panelTitle.textContent = T.nav.difficulty;
      body.append(difficultyForm());
    } else if (p === 'saves') {
      panelTitle.textContent = mode === 'title' ? T.nav.saves : T.nav.savesPaused;
      body.append(savesList());
    }
  };
  const pageAct: Record<Page, string> = { main: '', stations: 'jump-to-station', controls: 'controls', settings: 'settings', difficulty: 'difficulty', saves: 'saves' };

  /** Slot list. Title: the slots that exist, newest first. Paused: every slot, and the manual ones take saves. */
  const savesList = () => {
    const f = document.createElement('div');
    f.className = 'mn-saves';
    const canSave = mode === 'paused';
    const msg = (text: string, cls: string) => {
      const d = document.createElement('div');
      d.className = cls;
      d.textContent = text;
      f.append(d);
    };
    if (loadFailed) {
      msg(SV.failed, 'mn-empty bad');
      loadFailed = false;
    }
    if (!slots.length) msg(canSave ? SV.noneYetPaused : SV.noneYet, 'mn-empty');
    const byId = new Map(slots.map((s) => [s.slot, s]));
    const ids = canSave ? [...SAVE.slots, ...slots.map((s) => s.slot).filter((id) => !SAVE.slots.includes(id))] : slots.map((s) => s.slot);
    /** Two-press confirm: the first press relabels the button for 3 s, a second press inside that acts. */
    const confirm = (b: HTMLButtonElement, label: string, ask: string | null, act: () => void) => {
      let armed = -Infinity;
      b.textContent = label;
      b.onclick = () => {
        sfx('ui_click');
        if (!ask || performance.now() - armed < 3000) return act();
        armed = performance.now();
        b.classList.add('armed');
        b.textContent = ask;
        setTimeout(() => {
          b.classList.remove('armed');
          b.textContent = label;
        }, 3000);
      };
      return b;
    };
    const sbtn = () => Object.assign(document.createElement('button'), { className: 'mn-sbtn' });
    for (const id of ids) {
      const info = byId.get(id);
      const row = document.createElement('div');
      row.className = `mn-slot${info ? '' : ' empty'}`;
      row.innerHTML = '<div class="mn-slot-main"><b></b><span></span></div><time></time><div class="mn-slot-act"></div>';
      row.querySelector('b')!.textContent = slotName(id);
      row.querySelector('span')!.textContent = info ? `${SV.day.replace('{d}', String(info.gameDay))} · ${SV.played.replace('{t}', playtime(info.playtimeS))}` : SV.empty;
      if (info) {
        const t = row.querySelector('time')!;
        t.textContent = when(info.savedAt);
        t.dateTime = new Date(info.savedAt).toISOString();
        t.title = new Date(info.savedAt).toLocaleString();
      }
      const acts = row.querySelector('.mn-slot-act')!;
      if (info) acts.append(confirm(sbtn(), SV.load, canSave ? SV.confirmLoad : null, () => void loadSlot(id)));
      if (canSave && id.startsWith('manual-')) {
        // the 'saved' event refreshes the list
      acts.append(confirm(sbtn(), SV.save, info ? SV.overwrite : null, () => void saveApi()?.save(id).catch((e) => console.warn('save failed', e))));
      }
      f.append(row);
    }
    return f;
  };
  panel.querySelector('.mn-x')!.addEventListener('click', () => {
    sfx('ui_close');
    showPage('main');
  });

  const settingsForm = () => {
    const f = document.createElement('div');
    f.className = 'mn-settings';
    const commit = () => {
      apply(settings);
      saveSettings(settings);
    };
    // A player change to an option the preset writes takes over from Auto: Auto would otherwise overwrite it when it
    // steps down. The preset Auto had picked stays as the base.
    const PRESET_KEYS = ['renderScale', 'shadows', 'fxaa', 'look', 'ao', 'shafts'] as const;
    let autoTurnedOff = false;
    const touched = (key: string) => {
      if (!(PRESET_KEYS as readonly string[]).includes(key)) return;
      if (settings.quality === 'auto') {
        settings.quality = settings.autoQuality;
        autoTurnedOff = true;
        saveSettings(settings);
        opts.onQualityPicked?.(settings.quality);
      }
      paintQuality();
    };
    const sec = (title: string) => {
      const h = document.createElement('h3');
      h.className = 'mn-sec';
      h.textContent = title;
      f.append(h);
    };
    const slider = (key: 'fov' | 'sensitivity' | 'shake' | 'renderScale' | 'volume' | 'music' | 'ambience', label: string, min: number, max: number, step: number, fmt: (v: number) => string) => {
      const row = document.createElement('label');
      row.className = 'row';
      row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><output></output>`;
      const input = row.querySelector('input')!;
      const out = row.querySelector('output')!;
      input.value = String(settings[key]);
      out.textContent = fmt(settings[key]);
      input.oninput = () => {
        settings[key] = Number(input.value);
        out.textContent = fmt(settings[key]);
        commit();
        touched(key);
      };
      f.append(row);
    };
    const check = (key: 'shadows' | 'fxaa' | 'look' | 'ao' | 'shafts' | 'reduceFlashing' | 'bgMuted' | 'captureMouse' | 'hordeNight', label: string) => {
      const row = document.createElement('label');
      row.className = 'row toggle';
      row.innerHTML = `<span>${label}</span><input type="checkbox"><i></i>`;
      const input = row.querySelector('input')!;
      input.checked = settings[key];
      input.onchange = () => {
        settings[key] = input.checked;
        sfx('ui_click');
        commit();
        touched(key);
      };
      f.append(row);
    };
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const S = T.settings;
    sec(S.secControls);
    slider('fov', S.fov, 55, 95, 1, (v) => `${v}°`);
    slider('sensitivity', S.sensitivity, 0.25, 3, 0.05, (v) => `${v.toFixed(2)}×`);
    slider('shake', S.shake, 0, 1, 0.05, pct);
    check('captureMouse', ST.captureMouse);
    sec(S.secAudio);
    slider('volume', S.volume, 0, 1, 0.05, pct);
    slider('music', S.music, 0, 1, 0.05, pct);
    slider('ambience', S.ambience, 0, 1, 0.05, pct);
    check('bgMuted', S.bgMuted);
    sec(S.secGraphics);
    // graphics preset: Auto (measured, data/quality AUTO_QUALITY) or a fixed preset; writes render scale / shadows / effects
    const qRow = document.createElement('div');
    qRow.className = 'row mn-quality';
    qRow.innerHTML = `<span>${QT.label}</span><div class="mn-seg" role="radiogroup" aria-label="${QT.label}"></div>`;
    const qSeg = qRow.querySelector('.mn-seg')!;
    const qNote = document.createElement('div');
    qNote.className = 'mn-qnote';
    qNote.setAttribute('aria-live', 'polite');
    /** Marks the preset Auto picked and writes the note: Auto's pick / fixed preset / preset adjusted by the player. */
    const paintQuality = () => {
      const q = effectiveQuality(settings);
      const p = QUALITY[q];
      const adjusted = PRESET_KEYS.some((k) => settings[k] !== p[k]);
      for (const l of qSeg.querySelectorAll('label')) {
        const r = l.querySelector('input')!;
        const v = r.value;
        r.checked = settings.quality === v; // a manual change may just have turned Auto off
        const pick = settings.quality === 'auto' && v === settings.autoQuality;
        l.classList.toggle('auto-pick', pick);
        l.title = pick ? QT.autoPick : '';
      }
      const text = settings.quality === 'auto' ? QT.autoPicked : autoTurnedOff ? QT.autoOff : adjusted ? QT.custom : QT.manual;
      const [a, b = ''] = text.split('{q}');
      qNote.replaceChildren(a, Object.assign(document.createElement('b'), { textContent: QT[q] }), b);
    };
    for (const v of ['auto', 'low', 'medium', 'high'] as const) {
      const l = document.createElement('label');
      l.innerHTML = `<input type="radio" name="mn-quality" value="${v}"><span>${QT[v]}</span>`;
      const r = l.querySelector('input')!;
      r.checked = settings.quality === v;
      r.onchange = () => {
        settings.quality = v;
        if (v === 'auto') settings.autoQuality = 'high'; // measure again from the top
        presetIntoSettings(settings, effectiveQuality(settings));
        sfx('ui_click');
        commit();
        opts.onQualityPicked?.(v);
        showPage('settings', { keep: true }); // the sliders and toggles below show the preset's values
      };
      qSeg.append(l);
    }
    f.append(qRow, qNote);
    paintQuality();
    slider('renderScale', S.renderScale, 0.5, 1, 0.05, pct);
    check('shadows', S.shadows);
    check('fxaa', S.fxaa);
    check('look', S.look);
    check('ao', S.ao);
    check('shafts', S.shafts);
    sec(S.secGame);
    check('hordeNight', ST.hordeNight);
    check('reduceFlashing', S.reduceFlashing);
    {
      // segmented control (QA-048): native radios, styled; arrow keys work as usual
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<span>${S.gore}</span><div class="mn-seg" role="radiogroup" aria-label="${S.gore}"></div>`;
      const seg = row.querySelector('.mn-seg')!;
      for (const [v, label] of [['full', S.goreFull], ['reduced', S.goreReduced], ['off', S.goreOff]] as const) {
        const l = document.createElement('label');
        l.innerHTML = `<input type="radio" name="mn-gore" value="${v}"><span>${label}</span>`;
        const r = l.querySelector('input')!;
        r.checked = settings.gore === v;
        r.onchange = () => {
          settings.gore = v;
          sfx('ui_click');
          commit();
        };
        seg.append(l);
      }
      f.append(row);
    }
    const reset = button(S.reset, () => {
      Object.assign(settings, DEFAULT_SETTINGS);
      commit();
      opts.onQualityPicked?.(settings.quality); // back to Auto: measure again
      showPage('settings', { keep: true });
    }, 'quiet small', 'settings-reset');
    const btns = document.createElement('div');
    btns.className = 'mn-btns';
    btns.append(reset, button(ST.hintsReset, () => hints.reset(), 'quiet small', 'hints-reset'));
    f.append(btns);
    const keysBox = document.createElement('div');
    keysBox.className = 'mn-keys';
    keysBox.innerHTML = `<h3>${ST.keysTitle}</h3><div class="mn-krows"></div>`;
    keyRows(keysBox.querySelector('.mn-krows') as HTMLElement);
    f.append(keysBox);
    return f;
  };

  /** Difficulty lives in the save (systems' 'difficulty' section), not in localStorage; edits apply live. */
  const difficultyForm = () => {
    const f = document.createElement('div');
    f.className = 'mn-settings';
    const seg = (label: string, options: [string, string][], get: () => string, set: (v: string) => void) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<span>${label}</span><div class="mn-seg" role="radiogroup" aria-label="${label}"></div>`;
      const box = row.querySelector('.mn-seg')!;
      for (const [v, text] of options) {
        const l = document.createElement('label');
        l.innerHTML = `<input type="radio" name="mn-${label}" value="${v}"><span>${text}</span>`;
        const r = l.querySelector('input')!;
        r.checked = get() === v;
        r.onchange = () => {
          set(v);
          sfx('ui_click');
        };
        box.append(l);
      }
      f.append(row);
    };
    const custom = () => (difficulty.preset = 'custom');
    const D = T.difficulty;
    seg(D.preset, [['story', D.story], ['survivor', D.survivor], ['hardcore', D.hardcore]], () => difficulty.preset, (v) => {
      applyPreset(v as keyof typeof DIFFICULTY_PRESETS);
      showPage('difficulty', { keep: true }); // re-read every control
    });
    for (const [key, label] of [['hungerDrain', D.hungerDrain], ['thirstDrain', D.thirstDrain], ['fatigueDrain', D.fatigueDrain]] as const) {
      const row = document.createElement('label');
      row.className = 'row';
      row.innerHTML = `<span>${label}</span><input type="range" min="0" max="2" step="0.05"><output></output>`;
      const input = row.querySelector('input')!;
      const out = row.querySelector('output')!;
      input.value = String(difficulty[key]);
      out.textContent = `${Math.round(difficulty[key] * 100)}%`;
      input.oninput = () => {
        difficulty[key] = Number(input.value);
        out.textContent = `${Math.round(difficulty[key] * 100)}%`;
        custom();
      };
      f.append(row);
    }
    {
      // day length is pacing, not difficulty: changing it doesn't turn the preset into 'custom'
      const row = document.createElement('label');
      row.className = 'row';
      row.innerHTML = `<span>${D.dayLength}</span><input type="range" min="20" max="120" step="5"><output></output>`;
      const input = row.querySelector('input')!;
      const out = row.querySelector('output')!;
      const show = () => (out.textContent = `${difficulty.dayLengthMin} ${D.minutes}`);
      input.value = String(difficulty.dayLengthMin);
      show();
      input.oninput = () => {
        difficulty.dayLengthMin = Number(input.value);
        show();
      };
      f.append(row);
    }
    for (const [key, label] of [['infection', D.infection], ['starvationDamage', D.starvationDamage]] as const) {
      const row = document.createElement('label');
      row.className = 'row toggle';
      row.innerHTML = `<span>${label}</span><input type="checkbox"><i></i>`;
      const input = row.querySelector('input')!;
      input.checked = difficulty[key];
      input.onchange = () => {
        difficulty[key] = input.checked;
        sfx('ui_click');
        custom();
      };
      f.append(row);
    }
    seg(D.onDeath, [['story', D.keepAll], ['survivor', D.dropBag], ['hardcore', D.hardcore]], () => difficulty.deathPenalty, (v) => {
      difficulty.deathPenalty = v as DeathPenalty;
      custom();
    });
    if (difficulty.preset === 'custom') {
      const note = document.createElement('div');
      note.className = 'mn-note';
      note.textContent = D.custom;
      f.append(note);
    }
    return f;
  };

  const setOpen = (open: boolean) => {
    root.classList.toggle('hidden', !open);
    // Block input now, not at the next event drain: while game.paused the sim (and the drain) doesn't run, so the
    // pointer lock would stay held and clicks would never reach the menu (QA-014).
    if (open) game.input.blocked = true;
    game.events.emit('uiScreen', { name: 'menu', open });
    if (open) void refreshSlots();
  };

  // --- camera --------------------------------------------------------------------------------
  const { path, look } = flyPath();
  const cam = game.camera;
  const live = { pos: new Vector3(), quat: new Quaternion(), fov: 70 };
  const cine = { pos: new Vector3(), quat: new Quaternion(), fov: 55 };
  const from = { pos: new Vector3(), quat: new Quaternion(), fov: 70 };
  const shown = { pos: new Vector3(), quat: new Quaternion(), fov: 70 }; // what the last frame displayed
  const lookAt = new Vector3();
  const fwd = new Vector3();
  const m4 = new Matrix4();
  let blend: { start: number; dur: number; toCine: boolean } | null = null;
  const t0 = performance.now();

  const cinematic = (now: number) => {
    const u = (((now - t0) / 1000 / FLY_PERIOD_S) % 1 + 1) % 1;
    path.getPoint(u, cine.pos);
    look.getPoint(u, lookAt);
    m4.lookAt(cine.pos, lookAt, cam.up);
    cine.quat.setFromRotationMatrix(m4);
  };
  const capture = (dst: typeof from, src: { pos: Vector3; quat: Quaternion; fov: number }) => {
    dst.pos.copy(src.pos);
    dst.quat.copy(src.quat);
    dst.fov = src.fov;
  };

  const inner = game.renderFrame;
  game.renderFrame = () => {
    if (mode !== 'title' && !blend) return inner();
    const now = performance.now();
    live.pos.copy(cam.position);
    live.quat.copy(cam.quaternion);
    live.fov = cam.fov;
    cinematic(now);
    const target = mode === 'title' || blend?.toCine ? cine : live;
    if (blend) {
      const t = Math.min(1, (now - blend.start) / 1000 / blend.dur);
      const e = t * t * t * (t * (t * 6 - 15) + 10); // smootherstep
      cam.position.lerpVectors(from.pos, target.pos, e);
      cam.quaternion.slerpQuaternions(from.quat, target.quat, e);
      cam.fov = from.fov + (target.fov - from.fov) * e;
      if (t >= 1) {
        blend = null;
        document.body.classList.remove('mn-blend');
      }
    } else {
      cam.position.copy(target.pos);
      cam.quaternion.copy(target.quat);
      cam.fov = target.fov;
    }
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    capture(shown, { pos: cam.position, quat: cam.quaternion, fov: cam.fov });
    // shadow box (80 m) centred ~30 m ahead, on what the fly-over looks at
    fwd.set(0, 0, -1).applyQuaternion(cam.quaternion).setY(0).normalize();
    game.sun.target.position.set(cam.position.x + fwd.x * 30, 0, cam.position.z + fwd.z * 30);
    game.sun.position.copy(game.sun.target.position).addScaledVector(game.sunDir, 70);
    inner();
    // hand the camera back untouched to whoever drives it (player camera system)
    cam.position.copy(live.pos);
    cam.quaternion.copy(live.quat);
    cam.fov = live.fov;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  };

  // --- transitions ---------------------------------------------------------------------------
  const lock = () => {
    requestLock(game.renderer.domElement); // no-op while the dev pointer-lock switch is off
  };
  const play = (station?: MenuStation) => {
    if (station) station.go();
    if (mode === 'title') {
      capture(from, shown);
      blend = { start: performance.now(), dur: BLEND_IN_S, toCine: false };
      document.body.classList.add('mn-blend'); // HUD stays hidden until the camera lands (QA-017)
    }
    mode = 'playing';
    game.paused = false;
    showPage('main');
    setOpen(false);
    lock();
  };
  const resume = () => play();
  const pause = () => {
    if (mode !== 'playing') return;
    mode = 'paused';
    lockedThisPlay = false;
    game.paused = true; // freeze zombies/physics while the pause menu is up
    renderNav();
    showPage('main');
    setOpen(true);
    sfx('ui_open');
  };
  const quitToTitle = () => {
    capture(from, blend ? shown : { pos: cam.position, quat: cam.quaternion, fov: cam.fov });
    blend = { start: performance.now(), dur: BLEND_OUT_S, toCine: true };
    mode = 'title';
    game.paused = false; // the world stays alive behind the title fly-over
    renderNav();
    showPage('main');
    setOpen(true);
  };

  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || e.repeat) return;
    if (mode === 'playing') {
      if (!game.input.blocked) pause();
    } else if (page !== 'main') {
      sfx('ui_close');
      showPage('main');
    } else if (mode === 'paused') resume();
  });
  // Keyboard: Up/Down (or W/S) walk the menu entries, or the open panel's rows when focus is in it; Left/Right change
  // the focused slider or segment (native); Right from the menu enters the open panel, Left on a panel button leaves it;
  // Enter/Space press buttons and flip toggles.
  const focusV = (el: HTMLElement | undefined) => {
    el?.focus({ focusVisible: true } as FocusOptions);
    el?.scrollIntoView({ block: 'nearest' });
  };
  addEventListener('keydown', (e) => {
    if (mode === 'playing' || e.altKey || e.ctrlKey || e.metaKey) return;
    const a = document.activeElement as HTMLElement | null;
    const inPanel = !panel.hidden && !!a && body.contains(a);
    if (inPanel && e.code === 'Enter' && a.matches('input[type=checkbox]')) {
      e.preventDefault();
      a.click();
      return;
    }
    if (!panel.hidden && e.code === 'ArrowRight' && a && nav.contains(a)) {
      e.preventDefault();
      return focusV(panelItems()[0]);
    }
    if (inPanel && e.code === 'ArrowLeft' && a.matches('button')) {
      e.preventDefault();
      return focusV(nav.querySelector<HTMLElement>('.mn-btn.active') ?? undefined);
    }
    if (!['ArrowDown', 'ArrowUp', 'KeyS', 'KeyW'].includes(e.code)) return;
    const list = inPanel ? panelItems() : [...nav.querySelectorAll<HTMLElement>('.mn-btn')];
    if (!list.length) return;
    e.preventDefault(); // also keeps Up/Down from nudging a slider or flipping a segment
    const at = list.indexOf(a as HTMLElement);
    const step = e.code === 'ArrowDown' || e.code === 'KeyS' ? 1 : -1;
    focusV(list[at < 0 ? (step > 0 ? 0 : list.length - 1) : (at + step + list.length) % list.length]);
  });
  // Chrome eats the Esc that releases pointer lock, so losing the lock while playing also pauses.
  // Losing the lock pauses only if the lock was taken in this play session and held a moment. Within ~1 s of an Esc
  // unlock Chrome grants a new lock and revokes it ~15 ms later; that revoke used to re-pause Resume (QA-038).
  let lockedThisPlay = false;
  let lockedAt = 0;
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) {
      if (mode === 'playing') lockedThisPlay = true;
      lockedAt = performance.now();
      return;
    }
    const held = performance.now() - lockedAt;
    if (mode === 'playing' && lockedThisPlay && held > 300 && !game.input.blocked) pause();
    lockedThisPlay = false;
  });
  // When Chrome refuses the lock (re-lock cooldown after Esc, or Esc closing the debug panel — Esc is not a user
  // activation), say so; the next click on the canvas locks (Input does that) (QA-038, QA-054).
  const hint = document.createElement('div');
  hint.id = 'mn-lockhint';
  hint.textContent = T.captureMouse;
  hint.hidden = true;
  document.body.appendChild(hint);
  setInterval(() => {
    hint.hidden = !pointerLock.enabled || !(mode === 'playing' && !blend && !document.pointerLockElement && !game.input.blocked);
  }, 200);

  const hints = installHints(game, () => mode === 'playing' && !blend);

  renderNav();
  // game.save arrives with the systems, after the menu: pick up the slot list (and Continue) once it exists
  const waitSave = (n = 0) => (saveApi() ? void refreshSlots() : n < 240 && setTimeout(() => waitSave(n + 1), 250));
  waitSave();
  if (new URLSearchParams(location.search).has('play')) {
    mode = 'playing';
    root.classList.add('hidden');
  } else setOpen(true);

  /** One-time note on the menu (e.g. integrated-GPU hint); dismissing it remembers `key` in localStorage. */
  const showNote = (key: string, text: string) => {
    const k = `pv.note.${key}`;
    try {
      if (localStorage.getItem(k)) return;
    } catch {
      /* storage blocked: show it */
    }
    const note = document.createElement('div');
    note.className = 'mn-notice';
    note.innerHTML = `<span></span><button aria-label="${T.dismiss}">&times;</button>`;
    note.querySelector('span')!.textContent = text;
    note.querySelector('button')!.onclick = () => {
      sfx('ui_close');
      note.remove();
      try {
        localStorage.setItem(k, '1');
      } catch {
        /* ignore */
      }
    };
    root.append(note);
  };

  return {
    showNote,
    get settings(): Readonly<Settings> {
      return settings;
    },
    /** The auto-pick stepped down: save the new pick and its render scale / shadows / effects. */
    setAutoQuality(id: QualityId) {
      settings.autoQuality = id;
      presetIntoSettings(settings, id);
      apply(settings);
      saveSettings(settings);
      if (mode !== 'playing' && page === 'settings') showPage('settings', { keep: true });
    },
    get mode() {
      return mode;
    },
    play,
    pause,
    quitToTitle,
  };
}

/** Closed spline over the stations: camera points sit outside each station, looking at it. */
function flyPath() {
  const foci = Object.values(yard.stations).map((s) => {
    const f = new Vector3(s.x, 1, s.z);
    if ('targetDistances' in s) f.z -= s.d / 3; // range: look down the lane
    return f;
  });
  foci.sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  const cams: Vector3[] = [];
  const look: Vector3[] = [];
  const lim = yard.half - 8;
  foci.forEach((f, i) => {
    const out = new Vector3(f.x, 0, f.z).normalize();
    // a little behind (clockwise) and outside, alternating heights
    const side = new Vector3(-out.z, 0, out.x);
    const p = f.clone().addScaledVector(out, 26).addScaledVector(side, -14);
    p.set(MathUtils.clamp(p.x, -lim, lim), i % 2 ? 22 : 13, MathUtils.clamp(p.z, -lim, lim));
    cams.push(p);
    look.push(f);
  });
  return { path: new CatmullRomCurve3(cams, true, 'centripetal'), look: new CatmullRomCurve3(look, true, 'centripetal') };
}
