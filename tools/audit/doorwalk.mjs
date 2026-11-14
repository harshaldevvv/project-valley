// Walks the player through the door of each interior and reports the final position (must end inside the room).
import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 120000 });
await page.waitForTimeout(2000); await page.mouse.click(640, 360);
const gp = (f, a) => page.evaluate(f, a);
await gp(() => { window.__gp.ctx.player.godMode = true; });
const out = {};
for (const [name, x, z, yaw, room] of [['cabin', -66, -37.4, Math.PI / 2, 'x<-69'], ['shop', 63.4, -53, 0, 'z<-60'], ['farm', -70.1, 69, 0, 'z<63']]) {
  await gp(([x, z, yaw]) => { window.__gp.teleport(x, z, yaw); window.__gp.setLook(yaw, 0); }, [x, z, yaw]);
  await page.waitForTimeout(500); await page.keyboard.down('KeyW'); await page.waitForTimeout(4500); await page.keyboard.up('KeyW');
  const p = await gp(() => window.__gp.ctx.player.curr); out[name] = [+p.x.toFixed(1), +p.z.toFixed(1), room];
}
console.log(JSON.stringify(out), 'errors', errs); await browser.close();
