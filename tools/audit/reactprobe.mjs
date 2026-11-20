// node tools/audit/reactprobe.mjs   headless: hit while jogging (flinch angle, camera trauma/punch, did the hit clip
// freeze the legs?), then jump while jogging (pelvis dip on landing). Screenshot mid-flinch into wip/anim_flinch.png.
import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2000);
await page.mouse.click(400, 300);
const gp = (f, a) => page.evaluate(f, a);
await gp(() => {
  const g = window.__gp; g.data.horde.passive = true; g.teleport(0, 0, 20); g.setLook(Math.PI, 0);
  const root = g.ctx.playerChar.root;
  const find = (n) => { let r = null; root.traverse((o) => { if (!r && o.name === n) r = o; }); return r; };
  const spine = find('Spine2') ?? find('chest'), hips = find('Hips') ?? find('hips');
  const Q = root.quaternion.constructor, V = root.position.constructor;
  const q = new Q(), rq = new Q(), v = new V();
  window.__rp = [];
  const tick = () => {
    spine.getWorldQuaternion(q); root.getWorldQuaternion(rq); q.premultiply(rq.invert());
    hips.getWorldPosition(v);
    const a = window.__gp.ctx;
    window.__rp.push([performance.now(), q.x, q.y, q.z, q.w, v.y - root.position.y, a.rig.trauma, a.rig.punch, a.playerAnim.fullBody ? 1 : 0, Math.hypot(a.player.vel.x, a.player.vel.z)]);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await page.keyboard.down('w');
await page.waitForTimeout(1200);
await gp(() => { window.__rp.length = 0; const p = window.__gp.ctx.player; p.godMode = false; p.invulnT = 0; const f = p.position.clone(); f.x += -Math.sin(p.yaw) * 2; f.z += -Math.cos(p.yaw) * 2; p.damage(15, f); p.godMode = true; });
await page.waitForTimeout(120);
await page.screenshot({ path: 'docs/audit/screenshots/wip/anim_flinch.png' });
await page.waitForTimeout(700);
const hit = await gp(() => window.__rp.slice());
const ang = (r, r0) => { const d = Math.abs(r[1] * r0[1] + r[2] * r0[2] + r[3] * r0[3] + r[4] * r0[4]); return (2 * Math.acos(Math.min(1, d)) * 180) / Math.PI; };
// flinch: spine deviation from its pre-hit pose cycle is hard to isolate while jogging; report max spine angle change vs the pose one gait cycle later
const maxT = Math.max(...hit.map((r) => r[6])), maxP = Math.max(...hit.map((r) => Math.abs(r[7])));
const full = hit.filter((r) => r[8]).length;
const devs = hit.slice(0, 30).map((r, i) => ang(r, hit[Math.min(hit.length - 1, i + 42)]));
console.log(`hit while jogging: camera trauma max ${maxT.toFixed(2)}, punch max ${maxP.toFixed(2)} deg, full-body clip frames ${full}/${hit.length}, spine dev vs +0.7s max ${Math.max(...devs).toFixed(1)} deg, speed ${hit[10]?.[9].toFixed(2)}`);
// landing dip
await gp(() => { window.__rp.length = 0; });
await page.keyboard.press('Space');
await page.waitForTimeout(1300);
const jl = await gp(() => window.__rp.slice());
await page.keyboard.up('w');
const hy = jl.map((r) => r[5]);
console.log(`jump while jogging: hips height min ${Math.min(...hy).toFixed(3)} median ${hy.slice().sort((a, b) => a - b)[hy.length >> 1].toFixed(3)} m, full-body frames ${jl.filter((r) => r[8]).length}/${jl.length}`);
console.log('errors', JSON.stringify(errs.slice(0, 4)));
await browser.close();
