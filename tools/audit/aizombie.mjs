import { mkdirSync } from 'node:fs';
import { launch } from './browser.mjs';
const id = process.argv[2] ?? 'ai_civilian', OUT = 'docs/audit/screenshots/wip'; mkdirSync(OUT, { recursive: true });
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200))); page.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.goto('http://localhost:5188/?play' + (process.env.CHARS ? '&chars=' + process.env.CHARS : ''));
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 120000 });
await page.waitForTimeout(2000); await page.mouse.click(640, 360);
const gp = (f, a) => page.evaluate(f, a);
await gp(() => { const g = window.__gp; g.ctx.player.godMode = true; g.data.horde.passive = false; g.spawn(40); g.teleport(40, 2, 0); g.setLook(0, -0.02); });
await page.waitForTimeout(2500);
const found = await gp((id) => { const g = window.__gp.ctx; const i = g.zombies.list.findIndex((z) => z.def.id === id); window.__zi = i; return i; }, id);
console.log('found', found);
await gp(() => { const g = window.__gp.ctx; const cm = g.game.camera; g.rig.override = () => { const z = g.zombies.list[window.__zi]; if (!z) return false; const p = z.curr; cm.position.set(p.x + 2.2, p.y + 1.5, p.z + 3.0); cm.lookAt(p.x, p.y + 0.9, p.z); return true; }; });
await gp(() => { const g = window.__gp.ctx; const z = g.zombies.list[window.__zi]; z.sense.awareness = 'detected'; });
await gp(() => { const g = window.__gp.ctx; const cm = g.game.camera; g.rig.override = () => { const z = g.zombies.list[window.__zi]; if (!z) return false; const p = z.curr; cm.position.set(p.x + 1.8, p.y + 1.4, p.z + 2.4); cm.lookAt(p.x, p.y + 0.9, p.z); return true; }; });
for (let i = 0; i < 6; i++) { await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/31_${id}_${i}.png`, clip: { x: 340, y: 60, width: 600, height: 600 } }); }
console.log('errors', errs.slice(0, 5)); await browser.close();
