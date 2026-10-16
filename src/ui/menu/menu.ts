import { CatmullRomCurve3, MathUtils, Quaternion, Vector3, Matrix4 } from 'three';
import type { Game } from '../../core/game';
import { yard } from '../../content/data/yard';
import { controlsHelp } from '../../content/text/controls';
import { loadingTips } from '../../content/text/tips';
import { applyPreset, difficulty, DIFFICULTY_PRESETS, type DeathPenalty } from '../../content/data/difficulty';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './settings';
import { MENU_CSS } from './style';

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
type Page = 'main' | 'stations' | 'controls' | 'settings' | 'difficulty';

const BLEND_IN_S = 1.8;
const BLEND_OUT_S = 2.2;
const FLY_PERIOD_S = 150;
const TIP_MS = 8000;

export function installMenu(game: Game, opts: { applySettings(s: Settings): void; stations: MenuStation[] }) {
  const style = document.createElement('style');
  style.textContent = MENU_CSS;
  document.head.appendChild(style);

  const settings = loadSettings();
  opts.applySettings(settings);

  const root = document.createElement('div');
  root.id = 'menu';
  root.innerHTML = `
    <div class="mn-vignette"></div>
    <div class="mn-left">
      <div class="mn-brand">
        <div class="mn-kicker"><span></span>M1 &middot; The Yard</div>
        <h1>Project<br>Valley</h1>
        <div class="mn-sub">Survival sandbox &mdash; every mechanic, one walled yard.</div>
        <div class="mn-paused">Paused</div>
      </div>
      <nav class="mn-nav"></nav>
    </div>
    <section class="mn-panel" hidden><header><h2></h2><button class="mn-x" aria-label="Back">&times;</button></header><div class="mn-body"></div></section>
    <footer class="mn-tip"><b>Tip</b><span></span></footer>
    <div class="mn-ver">v0.0.1 &middot; ${game.backend.toUpperCase()}</div>`;
  document.body.appendChild(root);
  const nav = root.querySelector('.mn-nav') as HTMLElement;
  const panel = root.querySelector('.mn-panel') as HTMLElement;
  const panelTitle = panel.querySelector('h2') as HTMLElement;
  const body = panel.querySelector('.mn-body') as HTMLElement;
  const tipText = root.querySelector('.mn-tip span') as HTMLElement;

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

  const button = (label: string, fn: () => void, cls = '') => {
    const b = document.createElement('button');
    b.className = `mn-btn ${cls}`;
    b.innerHTML = `<span>${label}</span>`;
    b.dataset.act = label.toLowerCase().replace(/\s+/g, '-');
    b.onclick = () => {
      sfx('ui_click');
      fn();
    };
    return b;
  };

  const renderNav = () => {
    nav.replaceChildren();
    if (mode === 'title') nav.append(button('Play', () => play(), 'primary'));
    else nav.append(button('Resume', () => resume(), 'primary'));
    nav.append(button('Jump to station', () => showPage('stations')), button('Controls', () => showPage('controls')), button('Settings', () => showPage('settings')), button('Difficulty', () => showPage('difficulty')));
    if (mode === 'paused') nav.append(button('Quit to title', () => quitToTitle(), 'quiet'));
    root.classList.toggle('is-paused', mode === 'paused');
  };

  const showPage = (p: Page) => {
    page = p;
    for (const b of nav.querySelectorAll('.mn-btn')) b.classList.toggle('active', (b as HTMLElement).dataset.act === pageAct[p]);
    if (p === 'main') {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    panel.classList.remove('in');
    void panel.offsetWidth; // restart the CSS transition
    panel.classList.add('in');
    body.replaceChildren();
    if (p === 'stations') {
      panelTitle.textContent = 'Jump to station';
      const grid = document.createElement('div');
      grid.className = 'mn-stations';
      for (const s of opts.stations) {
        const b = button(s.label, () => play(s), 'station');
        grid.append(b);
      }
      body.append(grid);
    } else if (p === 'controls') {
      panelTitle.textContent = 'Controls';
      const wrap = document.createElement('div');
      wrap.className = 'mn-controls';
      for (const g of controlsHelp) {
        const sec = document.createElement('div');
        sec.innerHTML = `<h3>${g.group}</h3>` + g.rows.map(([k, a]) => `<div class="row"><span>${a}</span><kbd>${k}</kbd></div>`).join('');
        wrap.append(sec);
      }
      body.append(wrap);
    } else if (p === 'settings') {
      panelTitle.textContent = 'Settings';
      body.append(settingsForm());
    } else if (p === 'difficulty') {
      panelTitle.textContent = 'Difficulty';
      body.append(difficultyForm());
    }
  };
  const pageAct: Record<Page, string> = { main: '', stations: 'jump-to-station', controls: 'controls', settings: 'settings', difficulty: 'difficulty' };
  panel.querySelector('.mn-x')!.addEventListener('click', () => {
    sfx('ui_close');
    showPage('main');
  });

  const settingsForm = () => {
    const f = document.createElement('div');
    f.className = 'mn-settings';
    const commit = () => {
      opts.applySettings(settings);
      saveSettings(settings);
    };
    const slider = (key: 'fov' | 'sensitivity' | 'shake' | 'renderScale' | 'volume', label: string, min: number, max: number, step: number, fmt: (v: number) => string) => {
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
      };
      f.append(row);
    };
    const check = (key: 'shadows' | 'fxaa' | 'reduceFlashing', label: string) => {
      const row = document.createElement('label');
      row.className = 'row toggle';
      row.innerHTML = `<span>${label}</span><input type="checkbox"><i></i>`;
      const input = row.querySelector('input')!;
      input.checked = settings[key];
      input.onchange = () => {
        settings[key] = input.checked;
        sfx('ui_click');
        commit();
      };
      f.append(row);
    };
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    slider('fov', 'Field of view', 55, 95, 1, (v) => `${v}°`);
    slider('sensitivity', 'Mouse sensitivity', 0.25, 3, 0.05, (v) => `${v.toFixed(2)}×`);
    slider('shake', 'Camera shake', 0, 1, 0.05, pct);
    slider('volume', 'Master volume', 0, 1, 0.05, pct);
    slider('renderScale', 'Render scale', 0.5, 1, 0.05, pct);
    check('shadows', 'Shadows');
    check('fxaa', 'Anti-aliasing (FXAA)');
    check('reduceFlashing', 'Reduce flashing');
    {
      // segmented control (QA-048): native radios, styled; arrow keys work as usual
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<span>Gore</span><div class="mn-seg" role="radiogroup" aria-label="Gore"></div>`;
      const seg = row.querySelector('.mn-seg')!;
      for (const [v, label] of [['full', 'Full'], ['reduced', 'Reduced'], ['off', 'Off']] as const) {
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
    const reset = button('Reset to defaults', () => {
      Object.assign(settings, DEFAULT_SETTINGS);
      commit();
      showPage('settings');
    }, 'quiet small');
    f.append(reset);
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
    seg('Preset', [['story', 'Story'], ['survivor', 'Survivor'], ['hardcore', 'Hardcore']], () => difficulty.preset, (v) => {
      applyPreset(v as keyof typeof DIFFICULTY_PRESETS);
      showPage('difficulty'); // re-read every control
    });
    for (const [key, label] of [['hungerDrain', 'Hunger drain'], ['thirstDrain', 'Thirst drain'], ['fatigueDrain', 'Fatigue drain']] as const) {
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
    for (const [key, label] of [['infection', 'Infection'], ['starvationDamage', 'Starvation damage']] as const) {
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
    seg('On death', [['story', 'Keep all'], ['survivor', 'Drop bag'], ['hardcore', 'Hardcore']], () => difficulty.deathPenalty, (v) => {
      difficulty.deathPenalty = v as DeathPenalty;
      custom();
    });
    if (difficulty.preset === 'custom') {
      const note = document.createElement('div');
      note.className = 'mn-note';
      note.textContent = 'Custom — saved with your game.';
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
    try {
      void game.renderer.domElement.requestPointerLock()?.catch?.(() => {});
    } catch {
      /* not allowed without a gesture; the canvas click locks later */
    }
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
  hint.textContent = 'Click to capture mouse';
  hint.hidden = true;
  document.body.appendChild(hint);
  setInterval(() => {
    hint.hidden = !(mode === 'playing' && !blend && !document.pointerLockElement && !game.input.blocked);
  }, 200);

  renderNav();
  if (new URLSearchParams(location.search).has('play')) {
    mode = 'playing';
    root.classList.add('hidden');
  } else setOpen(true);

  return {
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
