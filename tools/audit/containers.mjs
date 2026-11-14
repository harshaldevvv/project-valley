import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200))); page.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 120000 });
await page.waitForTimeout(2000); await page.mouse.click(640, 360);
const r = await page.evaluate(() => { const c = window.game.places.containers; const types = {}; c.forEach((x) => (types[x.type] = (types[x.type] || 0) + 1)); const inter = c.filter((x) => /loot_(food_cupboard|tool_box|medical_cabinet|wardrobe|duffel)/.test(x.id)).slice(-8).map((x) => [x.id, +x.position.x.toFixed(0), +x.position.z.toFixed(0)]); return { n: c.length, types, inter }; });
console.log(JSON.stringify(r));
// stand at the shop cabinet, look at it and hold E
const t = r.inter.find((x) => Math.abs(x[1] - 63) < 6 && Math.abs(x[2] + 65) < 4) || r.inter[0];
await page.evaluate(([x, z]) => { window.__gp.ctx.player.godMode = true; window.__gp.teleport(x, z + 1.6, 0); window.__gp.setLook(0, -0.1); }, [t[1], t[2]]);
await page.waitForTimeout(800); await page.keyboard.down('KeyE'); await page.waitForTimeout(4200); await page.keyboard.up('KeyE'); await page.waitForTimeout(500);
await page.screenshot({ path: 'docs/audit/screenshots/wip/57_loot_open.png' });
console.log('errors', errs); await browser.close();
