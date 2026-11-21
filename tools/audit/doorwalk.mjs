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
  await page.waitForTimeout(700);
  // the yard doors are hinged and start closed: open the nearest one first (shop has an open doorway)
  await gp(([x, z]) => {
    const d = window.__gp.ctx.game.interact.all.find((i) => Math.hypot(i.position.x - x, i.position.z - z) < 5 && i.prompt() === 'Open door');
    d?.onInteract();
  }, [x, z]);
  await page.waitForTimeout(900); await page.keyboard.down('KeyW'); await page.waitForTimeout(4500); await page.keyboard.up('KeyW');
  const p = await gp(() => window.__gp.ctx.player.curr); out[name] = [+p.x.toFixed(1), +p.z.toFixed(1), room];
}
const bad = Object.entries(out).filter(([, [x, z, room]]) => !eval(room.replace(/^x/, String(x)).replace(/^z/, String(z))));
console.log(JSON.stringify(out), 'errors', errs, bad.length ? 'FAIL ' + bad.map(([n]) => n).join(',') : 'ALL OK');
await browser.close();
process.exit(bad.length || errs.length ? 1 : 0);
