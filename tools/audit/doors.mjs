import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1300,780'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200))); page.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 120000 });
await page.waitForTimeout(2000); await page.mouse.click(640, 360);
const gp = (f, a) => page.evaluate(f, a);
await gp(() => { window.__gp.ctx.player.godMode = true; });
const out = {};
for (const [name, x, z, yaw, along] of [['cabin', -66.2, -37.4, Math.PI / 2, 'x'], ['shop', 72.4, -62.15, Math.PI / 2, 'x'], ['farm', -70.1, 66.8, 0, 'z']]) {
  await gp(([x, z, yaw]) => { window.__gp.teleport(x, z, yaw); window.__gp.setLook(yaw, -0.05); }, [x, z, yaw]);
  await page.waitForTimeout(500);
  const closed0 = 0;
  const closed = await gp(() => { const p = window.__gp.ctx.player.curr; return [+p.x.toFixed(1), +p.z.toFixed(1)]; });
  const prompt = await gp(() => window.__gp.ctx.interact.promptText);
  if (name === 'cabin') await page.screenshot({ path: 'docs/audit/screenshots/wip/96_door_closed.png' });
  await page.keyboard.press('KeyE'); await page.waitForTimeout(1200);
  if (name === 'cabin') await page.screenshot({ path: 'docs/audit/screenshots/wip/97_door_open.png' });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(4500); await page.keyboard.up('KeyW');
  const open = await gp(() => { const p = window.__gp.ctx.player.curr; return [+p.x.toFixed(1), +p.z.toFixed(1)]; });
  out[name] = { prompt, blockedAt: closed, afterOpen: open };
}
console.log(JSON.stringify(out), 'errors', errs); await browser.close();
