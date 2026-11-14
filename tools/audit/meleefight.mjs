// Swaps weapons and fights zombies with the knife (light/heavy/shove), rifle and pistol; counts kills and errors.
import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push((e.stack || String(e)).slice(0, 300))); page.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 120000 });
await page.waitForTimeout(2000); await page.mouse.click(640, 360);
const gp = (f, a) => page.evaluate(f, a);
await gp(() => { const g = window.__gp; g.ctx.player.godMode = true; g.data.horde.passive = false; g.sandbox(); g.spawn(10); g.teleport(40, -3, 0); });
await page.keyboard.press('KeyT'); await page.waitForTimeout(2500);
const k0 = await gp(() => window.__gp.ctx.zombies.kills);
await page.keyboard.press('Digit4'); await page.waitForTimeout(900);
for (let i = 0; i < 14; i++) { await gp(() => window.__gp.faceZombie(1.2)); const d = await gp(() => window.__gp.faceZombie(1.2)); if (d > 1.7) { await page.keyboard.down('KeyW'); await page.waitForTimeout(350); await page.keyboard.up('KeyW'); } await gp((b) => window.__gp.mouse(b, true), i % 3 === 2 ? 2 : 0); await page.waitForTimeout(120); await gp(() => { window.__gp.mouse(0, false); window.__gp.mouse(2, false); }); await page.waitForTimeout(550); if (i % 5 === 1) await page.keyboard.press('KeyV'); if (i === 6) await page.screenshot({ path: 'docs/audit/screenshots/wip/95_fp_melee_zombie.png' }); }
const k1 = await gp(() => window.__gp.ctx.zombies.kills);
for (const slot of ['Digit1', 'Digit3', 'Digit4', 'Digit1', 'Digit3']) { await page.keyboard.press(slot); await page.waitForTimeout(450); }
await page.keyboard.press('Digit1'); await page.waitForTimeout(1300);
for (let i = 0; i < 25; i++) { await gp(() => { const w = window.__gp.ctx.weapons; if (w.item?.mag && w.item.mag.rounds < 3) w.item.mag.rounds = 30; window.__gp.faceZombie(1.4); window.__gp.mouse(0, true); }); await page.waitForTimeout(110); await gp(() => window.__gp.mouse(0, false)); }
const k2 = await gp(() => window.__gp.ctx.zombies.kills);
console.log('kills knife', k1 - k0, 'rifle', k2 - k1, 'errors', errs.slice(0, 3)); await browser.close();
