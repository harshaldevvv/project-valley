// node tools/audit/animshots.mjs   headless: side/three-quarter screenshots of the hero mid-gait (jog, aimed diagonal,
// aimed back-diagonal, a stop) into docs/audit/screenshots/wip/anim_<case>_<n>.png. Camera follows the player.
import { mkdirSync } from 'node:fs';
import { launch } from './browser.mjs';
const OUT = 'docs/audit/screenshots/wip';
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2000);
await page.mouse.click(400, 300);
const gp = (f, a) => page.evaluate(f, a);
await gp(() => { const g = window.__gp; g.ctx.player.godMode = true; g.data.horde.passive = true; });
// camera at a fixed angle `az` (rad, 0 = player's right side) around the player, world-fixed relative to the start yaw
const cam = (az, dist = 3.2) => gp(([az, dist]) => {
  const g = window.__gp; const rig = g.ctx.rig; if (!rig.__r) rig.__r = rig.render;
  const y0 = g.ctx.player.yaw;
  rig.render = () => {
    const p = g.ctx.player, c = g.ctx.game.camera, a = y0 + az;
    const rx = Math.cos(a), rz = -Math.sin(a);
    c.position.set(p.curr.x + rx * dist, p.curr.y + 1.0, p.curr.z + rz * dist);
    c.lookAt(p.curr.x, p.curr.y + 0.75, p.curr.z); c.updateMatrixWorld(true);
  };
}, [az, dist]);
const reset = (armed) => gp(async (armed) => {
  const g = window.__gp; g.teleport(0, 0, 20); g.setLook(Math.PI, 0);
  g.ctx.facing.yaw = g.ctx.facing.prevYaw = Math.PI;
  if (armed && !g.ctx.weapons.sandbox) { g.sandbox(); await new Promise((r) => setTimeout(r, 1200)); }
}, armed);
async function shoot(name, opts) {
  if (process.env.ONLY && !process.env.ONLY.split(',').includes(name)) return;
  return shoot1(name, opts);
}
async function shoot1(name, { keys, armed = false, rmb = false, az = 0, n = 4, every = 110, lead = 1200, release = false }) {
  try {
    await reset(armed);
    await cam(az);
    if (rmb) await gp(() => window.__gp.mouse(2, true));
    await page.waitForTimeout(400);
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(lead);
    if (release) for (const k of keys) await page.keyboard.up(k);
    for (let i = 0; i < n; i++) { await page.screenshot({ path: `${OUT}/anim_${name}_${i}.png` }); await page.waitForTimeout(every); }
    if (!release) for (const k of keys) await page.keyboard.up(k);
    if (rmb) await gp(() => window.__gp.mouse(2, false));
    await page.waitForTimeout(500);
  } catch (e) { console.log(name, 'failed', String(e).slice(0, 100)); await page.waitForTimeout(3000); }
}
await shoot('jog', { keys: ['w'], az: 0 });
await shoot('sprint', { keys: ['Shift', 'w'], az: 0, n: 6, every: 60 });
await shoot('stop', { keys: ['w'], az: 0, release: true, n: 4, every: 120 });
await shoot('aimdiag', { keys: ['w', 'a'], armed: true, rmb: true, az: Math.PI * 0.25 });
await shoot('aimbackdiag', { keys: ['s', 'd'], armed: true, rmb: true, az: -Math.PI * 0.25 });
console.log('errors', JSON.stringify(errs.slice(0, 4)));
await browser.close();
