import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 120000 });
await page.waitForTimeout(2000); await page.mouse.click(640, 360);
const gp = (f, a) => page.evaluate(f, a);
await gp(() => { window.__gp.ctx.player.godMode = true; window.__gp.teleport(-67.3, -37.4, Math.PI / 2); window.__gp.setLook(Math.PI / 2, -0.05); });
await page.waitForTimeout(600);
const pos = () => gp(() => { const p = window.__gp.ctx.player.curr; return [+p.x.toFixed(2), +p.z.toFixed(2)]; });
const a = await pos(); await page.keyboard.press('KeyE'); await page.waitForTimeout(1300); const b = await pos();
await page.keyboard.down('KeyW'); await page.waitForTimeout(3500); await page.keyboard.up('KeyW'); const c = await pos();
// close the door while standing in its path (step back to the doorway first)
await gp(() => { window.__gp.teleport(-67.6, -37.4, Math.PI / 2); }); await page.waitForTimeout(400);
await page.keyboard.press('KeyE'); await page.waitForTimeout(1300); const d = await pos();
await page.keyboard.down('KeyW'); await page.waitForTimeout(2500); await page.keyboard.up('KeyW'); const e = await pos();
console.log(JSON.stringify({ stood: a, afterOpen: b, walkedIn: c, closeOnPlayer: d, thenWalk: e }), 'errors', errs); await browser.close();
