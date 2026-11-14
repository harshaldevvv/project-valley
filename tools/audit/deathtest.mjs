import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1300,780'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push((e.stack || String(e)).slice(0, 300)));
await page.goto('http://localhost:5188/?play' + (process.env.CHARS ? '&chars=' + process.env.CHARS : ''));
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 120000 });
await page.waitForTimeout(2000); await page.mouse.click(640, 360);
const gp = (f, a) => page.evaluate(f, a);
await gp(() => { const g = window.__gp; g.ctx.player.godMode = true; g.data.horde.passive = true; g.sandbox(); g.spawn(12); g.teleport(40, -3.4, 0); });
await page.waitForTimeout(2500);
for (let i = 0; i < 60; i++) { await gp(() => { const w = window.__gp.ctx.weapons; if (w.item?.mag && w.item.mag.rounds < 3) w.item.mag.rounds = 30; window.__gp.faceZombie(1.0); window.__gp.mouse(0, true); }); await page.waitForTimeout(100); await gp(() => window.__gp.mouse(0, false)); }
await page.waitForTimeout(2500);
const r = await gp(() => window.__gp.ctx.zombies.list.filter((z) => !z.alive).map((z) => +(z.curr.y - z.groundY).toFixed(2)));
console.log('dead', r.length, 'y-above-ground', JSON.stringify(r), 'errors', errs); await browser.close();
