// node tools/audit/zmbshots.mjs <tag> [chars]   headless: spawn zombies in the pen, look at them from close range
import { launch } from './browser.mjs';
const [tag = 'zs', chars = ''] = process.argv.slice(2);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await page.goto('http://localhost:5188/?play' + (chars ? '&chars=' + chars : ''));
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2000);
await page.mouse.click(640, 360);
const gp = (f, a) => page.evaluate(f, a);
await gp(() => { const g = window.__gp; g.ctx.player.godMode = true; g.data.horde.passive = true; g.spawn(8); g.teleport(40, -2.5, 0); g.setLook(0, -0.05); });
await page.waitForTimeout(3500);
await gp(() => window.__gp.faceZombie(1.0));
await page.waitForTimeout(400);
await page.screenshot({ path: `docs/audit/screenshots/wip/${tag}.png` });
console.log('errors', JSON.stringify(errs.slice(0, 4)));
await browser.close();
