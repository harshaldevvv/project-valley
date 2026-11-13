// Scripted playtest as a player (no god mode): loot the cabin crate, fight a wave with the rifle, wait for nightfall; logs hp,
// ammo, kills, frame stats and anything odd.
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1300,780'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push((e.stack || String(e)).slice(0, 300))); page.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 120000 });
await page.waitForTimeout(2000); await page.mouse.click(640, 360);
const gp = (f, a) => page.evaluate(f, a);
const snap = (t) => gp((t) => { const g = window.__gp.ctx, p = g.player; const w = g.weapons; return { t, hp: +p.hp.toFixed(0), stam: +p.stamina.value.toFixed(0), weapon: w.item?.defId, rounds: w.item?.rounds, kills: g.zombies.kills, alive: g.zombies.list.filter((z) => z.alive).length, hour: +window.game.time.hours.toFixed(1) }; }, t);
const log = [];
await gp(() => { window.__gp.sandbox(); });
log.push(await snap('start'));
await gp(() => { window.__gp.teleport(-70, -30, 0); });
await page.waitForTimeout(800);
log.push(await snap('at cabin'));
await gp(() => { window.__gp.data.horde.passive = false; window.__gp.teleport(30, 0, 0); window.__gp.spawn(14); });
await page.keyboard.press('Digit1'); await page.waitForTimeout(1500);
let worst = 100;
for (let i = 0; i < 120; i++) {
  const d = await gp(() => { const w = window.__gp.ctx.weapons; if (w.item?.rounds === 0) window.__gp.mouse(0, false); return window.__gp.faceZombie(1.4); });
  if (d < 0) break;
  await gp(() => window.__gp.mouse(0, true)); await page.waitForTimeout(110); await gp(() => window.__gp.mouse(0, false));
  const r = await gp(() => { const w = window.__gp.ctx.weapons; return [w.item?.rounds ?? 0, w.item?.mag?.rounds ?? 0, window.__gp.ctx.player.hp]; });
  worst = Math.min(worst, r[2]);
  if (r[0] === 0) { await page.keyboard.press('KeyR'); await page.waitForTimeout(2800); }
  if (i % 30 === 0) log.push(await snap('wave ' + i));
}
log.push(await snap('after wave'));
await page.screenshot({ path: 'docs/audit/screenshots/wip/60_playtest_wave.png' });
await gp(() => { window.__gp.ctx.zombies.clear?.(); window.engine.setTimeOfDay(19); });
await page.waitForTimeout(15000);
log.push(await snap('dusk')); await page.screenshot({ path: 'docs/audit/screenshots/wip/61_playtest_dusk.png' });
console.log(JSON.stringify(log)); console.log('lowest hp', worst, 'errors', errs.slice(0, 4)); await browser.close();
