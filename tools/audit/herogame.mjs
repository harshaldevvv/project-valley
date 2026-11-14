// node tools/audit/herogame.mjs <tag> [item,item,...]   the game with ?hero=1, wearables given, third person + first person shots
import { launch } from './browser.mjs';
const [tag = 'hg', items = ''] = process.argv.slice(2);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.goto('http://localhost:5188/?play&hero=1');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2000); await page.mouse.click(640, 360);
await page.evaluate(() => { window.__gp.ctx.player.godMode = true; });
for (const i of items.split(',').filter(Boolean)) await page.evaluate((i) => window.__gp.give(i), i);
await page.waitForTimeout(1500);
const sh = async (n) => page.screenshot({ path: `docs/audit/screenshots/wip/${tag}_${n}.png` });
await sh('tp');
await page.evaluate(() => { const c = window.__gp.ctx; c.rig.setMode?.('first'); }); await page.waitForTimeout(300);
await page.keyboard.press('v'); await page.waitForTimeout(1200); await sh('fp');
console.log('errors', errs.slice(0, 5)); await browser.close();
