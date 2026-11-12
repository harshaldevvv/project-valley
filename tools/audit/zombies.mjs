import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
const tag = process.argv[2] ?? 'wip', OUT = `docs/audit/screenshots/${tag}`; mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1300,780'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 120000 });
await page.waitForTimeout(2000); await page.mouse.click(640, 360);
const gp = (f, a) => page.evaluate(f, a);
await gp(() => { window.__gp.ctx.player.godMode = true; window.__gp.data.horde.passive = true; window.__gp.spawn(6); window.__gp.teleport(40, -2, 0); window.__gp.setLook(0, -0.05); });
await page.waitForTimeout(2500); await page.screenshot({ path: `${OUT}/20_pen_zombies.png` });
for (let i = 0; i < 3; i++) {
  await gp((i) => { const g = window.__gp.ctx; const z = g.zombies.list[i]; if (!z) return; const p = z.curr; const cm = g.game.camera;
    g.rig.override = () => { cm.position.set(p.x + 1.6, p.y + 1.5, p.z + 2.2); cm.lookAt(p.x, p.y + 1.0, p.z); return true; }; }, i);
  await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/21_zombie_close_${i}.png` });
}
const info = await gp(() => { const z = window.__gp.ctx.zombies; return Object.keys(z).slice(0, 40).join(','); }); console.log(info);
await browser.close();
