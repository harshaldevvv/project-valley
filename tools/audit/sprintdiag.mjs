// node tools/audit/sprintdiag.mjs   headless: hold W+Shift on the outskirts road for 4 s; speed / gait / stamina every 250 ms
import { launch } from './browser.mjs';
const b = await launch(); const c = await b.newContext();
await c.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export const createHotContext=()=>({accept(){},on(){},dispose(){},prune(){},invalidate(){},data:{}});export const updateStyle=()=>{};export const removeStyle=()=>{};export const injectQuery=(u)=>u;' }));
const p = await c.newPage({ viewport: { width: 800, height: 450 } });
await p.goto('http://localhost:5188/?play'); await p.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await p.waitForTimeout(1500); await p.mouse.click(400, 225);
await p.evaluate(() => { const g = window.__gp, pl = g.ctx.player; pl.godMode = true; g.teleport(0, 130, Math.PI); g.setLook(Math.PI, 0);
  window.__out = []; setInterval(() => window.__out.push(`${Math.hypot(pl.vel.x, pl.vel.z).toFixed(1)}/${pl.gait}/${pl.stamina.value.toFixed(0)}`), 250); });
await p.keyboard.down('KeyW'); await p.keyboard.down('ShiftLeft'); await p.waitForTimeout(4200); await p.keyboard.up('ShiftLeft'); await p.keyboard.up('KeyW');
console.log(await p.evaluate(() => window.__out.slice(0, 16).join(' '))); await b.close();
