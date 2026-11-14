// Records frames over 25 ms in the 30-zombie scene (aggressive horde, shooting) with the per-system timings at that moment.
import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 120000 });
await page.waitForTimeout(2500); await page.mouse.click(640, 360);
const gp = (f, a) => page.evaluate(f, a);
await gp(() => { const g = window.__gp; g.ctx.player.godMode = true; g.sandbox(); g.data.horde.passive = false; g.teleport(40, -3, 0); g.setLook(0, -0.1); g.spawn(30); window.__h = [{ mark: 'spawned', t: +(performance.now() / 1000).toFixed(1) }];
  let last = performance.now(); const tick = () => { const n = performance.now(), d = n - last; last = n; if (d > 25) { const p = window.__perf(); window.__h.push({ t: +(n / 1000).toFixed(1), ms: +d.toFixed(1), sys: Object.fromEntries(Object.entries(p.systems).filter(([, v]) => v > 1).map(([k, v]) => [k, +v.toFixed(1)])), heap: p.heapMB && +p.heapMB.toFixed(0) }); } requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
await page.waitForTimeout(4000); await gp(() => window.__h.push({ mark: 'shooting starts', t: +(performance.now() / 1000).toFixed(1) }));
for (let i = 0; i < 60; i++) { await gp(() => { const w = window.__gp.ctx.weapons; if (w.item?.mag && w.item.mag.rounds < 3) w.item.mag.rounds = 30; window.__gp.faceZombie(1.4); window.__gp.mouse(0, true); }); await page.waitForTimeout(110); await gp(() => window.__gp.mouse(0, false)); }
await page.waitForTimeout(8000); await gp(() => window.__h.push({ mark: 'shooting ends' }));
console.log(JSON.stringify(await gp(() => window.__h))); await browser.close();
