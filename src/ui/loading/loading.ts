import { Cache, FileLoader } from 'three';
import manifest from '../../../public/assets/models/manifest.json';
import { assetUrl } from '../../engine/assetUrl';
import { charSet } from '../../content/data/zombies';
import { genModelPath, genModels } from '../../world/yard/genModels';
import { loadingText as LT, loadingTips } from '../../content/text/tips';
import { menuText } from '../../content/text/ui';

/**
 * Boot loading screen. Markup and CSS live in index.html so it paints before any script runs; this module drives it.
 * Progress comes from real events only:
 * - model bytes: every manifest GLB is fetched in parallel through FileLoader (progress events, sizes from the manifest).
 *   THREE.Cache keeps the buffers, so the GLTF loads during the world build reuse them instead of downloading again;
 * - then named phases from main.ts (world build, shader warm-up), each set when that step actually starts.
 */
const root = document.getElementById('boot');
const fill = root?.querySelector<HTMLElement>('.bt-fill');
const pct = root?.querySelector<HTMLElement>('.bt-pct');
const status = root?.querySelector<HTMLElement>('.bt-status');
let shown = 0;

// one tip while the bar fills (the same pool as the title menu)
const tipEl = root?.querySelector<HTMLElement>('.bt-tip');
if (tipEl && loadingTips.length) {
  const b = document.createElement('b');
  b.textContent = menuText.tip;
  tipEl.replaceChildren(b, loadingTips[Math.floor(Math.random() * loadingTips.length)]);
}

function set(fraction: number, text: string) {
  shown = Math.max(shown, Math.min(1, fraction)); // never runs backwards
  if (fill) fill.style.transform = `scaleX(${shown})`;
  if (pct) pct.textContent = `${Math.round(shown * 100)}%`;
  if (status) status.textContent = text;
  root?.setAttribute('aria-valuenow', String(Math.round(shown * 100)));
}

const mb = (b: number) => (b / 1048576).toFixed(1);

/** Downloads every model in parallel (bar 0-85%). Resolves when all are in THREE.Cache or failed. */
export function prefetchModels(): Promise<void> {
  Cache.enabled = true;
  const list = [
    ...Object.entries(manifest as Record<string, { url: string; bytes?: number }>)
      .filter(([id]) => !/^zmb_(ai|pf|pfz)_/.test(id) || id.startsWith(`zmb_${charSet}_`)) // only download the zombie set being played
      .map(([, e]) => e),
    ...genModels.map(([id, bytes]) => ({ url: genModelPath(id), bytes })),
  ];
  const total = list.reduce((a, e) => a + (e.bytes ?? 0), 0) || 1;
  const got = new Map<string, number>();
  let done = 0;
  const update = () => {
    let bytes = 0;
    for (const b of got.values()) bytes += b;
    const text = done < list.length ? LT.models.replace('{n}', String(done)).replace('{total}', String(list.length)).replace('{mb}', mb(bytes)).replace('{totalMb}', mb(total)) : LT.engine;
    set(0.85 * Math.min(1, bytes / total), text);
  };
  update();
  return Promise.all(
    list.map(
      (e) =>
        new Promise<void>((resolve) => {
          const finish = () => (got.set(e.url, e.bytes ?? 0), done++, update(), resolve());
          // A failed prefetch is not fatal: the GLTF loader fetches the file again and falls back to its placeholder.
          new FileLoader().setResponseType('arraybuffer').load(assetUrl(e.url), finish, (ev) => (got.set(e.url, ev.loaded), update()), finish);
        }),
    ),
  ).then(() => undefined);
}

/** Lets the browser paint the current status before a long synchronous step (shader compile). */
export const nextPaint = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r)));

export const loading = {
  phase: set,
  done() {
    set(1, LT.ready);
    if (!root) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return root.remove();
    root.addEventListener('transitionend', () => root.remove(), { once: true });
    root.classList.add('bt-done');
  },
  fail(err: unknown) {
    root?.classList.add('bt-failed');
    if (status) status.textContent = LT.failed.replace('{err}', err instanceof Error ? err.message : String(err));
    console.error(err);
  },
};
