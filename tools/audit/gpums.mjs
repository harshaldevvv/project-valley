// node tools/audit/gpums.mjs  -> GPU ms per frame (timestamp queries) with the look features on/off. Needs dev server on 5188.
import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 160))); page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto('http://localhost:5188/?play&gputime');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 120000 });
await page.waitForTimeout(2500); await page.mouse.click(640, 360);
const gp = (f, a) => page.evaluate(f, a);
const gpu = async () => { await page.waitForTimeout(2500); const v = []; for (let i = 0; i < 8; i++) { v.push(+(await gp(() => window.__gp.ctx.game.perf.extra.gpuMs ?? 0))); await page.waitForTimeout(400); } return +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2); };
await gp(() => { window.__gp.teleport(-17, 2, Math.PI); window.__gp.setLook(Math.PI, -0.05); });
const R = {};
R.full = await gpu();
await gp(() => { window.engine.post.look.aoMix.value = 0; }); R.ao_mix0_still_computed = await gpu();
await gp(() => { window.engine.post.settings.look = false; window.engine.post.apply(); }); R.look_off = await gpu();
console.log(JSON.stringify(R), errs.slice(0, 5)); await browser.close();
