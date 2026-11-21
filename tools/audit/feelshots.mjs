// node tools/audit/feelshots.mjs   headless, slow motion (game clock ×SLOW): side-view frames of a running jump's landing
// and a knife hit on a zombie, into docs/audit/screenshots/wip/feel_<land|melee>_<n>.png, plus per-frame numbers
// (hips height, grounded, melee phase, hero swing hit-pause).
import { mkdirSync } from 'node:fs';
import { launch } from './browser.mjs';
const OUT = 'docs/audit/screenshots/wip';
mkdirSync(OUT, { recursive: true });
const SLOW = +(process.env.SLOW ?? 0.1);
const only = process.argv[2];
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
  const g = window.__gp; g.ctx.player.godMode = true; g.data.horde.passive = true;
  const root = g.ctx.playerChar.root;
  let hips = null; root.traverse((o) => { if (!hips && (o.name === 'Hips' || o.name === 'hips')) hips = o; });
  const V = root.position.constructor, v = new V();
  window.__fl = [];
  const tick = () => {
    const c = g.ctx, a = c.playerAnim;
    hips.getWorldPosition(v);
    window.__fl.push({ t: performance.now(), hy: +(v.y - root.position.y).toFixed(3), gr: c.player.grounded ? 1 : 0, mp: c.melee.phase, pause: +(a.pauseT ?? 0).toFixed(3) });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const slow = (k) => gp((k) => {
  const r = window.__gp.ctx.game.renderer, an = r._animation;
  if (!window.__loop) window.__loop = an._animationLoop;
  const cb = window.__loop;
  if (k === 1) { r.setAnimationLoop(cb); return; }
  const t0 = performance.now(); let base = null;
  r.setAnimationLoop((t) => { if (base === null) base = t; cb(base + (t - base) * k); });
}, k);
// side camera following the player at the start yaw
const cam = (az, dist, h = 1.0, look = 0.75) => gp(([az, dist, h, look]) => {
  const g = window.__gp; const rig = g.ctx.rig; if (!rig.__r) rig.__r = rig.render;
  const y0 = g.ctx.player.yaw;
  rig.render = () => {
    const p = g.ctx.player, c = g.ctx.game.camera, a = y0 + az;
    c.position.set(p.curr.x + Math.cos(a) * dist, p.curr.y + h, p.curr.z - Math.sin(a) * dist);
    c.lookAt(p.curr.x, p.curr.y + look, p.curr.z); c.updateMatrixWorld(true);
  };
}, [az, dist, h, look]);

if (!only || only === 'land') {
  await gp(() => { const g = window.__gp; g.teleport(0, 0, 20); g.setLook(Math.PI, 0); g.ctx.facing.yaw = g.ctx.facing.prevYaw = Math.PI; });
  await cam(0, 3.0, 0.8, 0.6);
  await page.keyboard.down('w');
  await page.waitForTimeout(1200);
  await page.keyboard.press('Space');
  // wait until airborne, then go slow
  await page.waitForFunction(() => !window.__gp.ctx.player.grounded, null, { timeout: 3000 });
  await slow(SLOW);
  await gp(() => { window.__fl.length = 0; });
  for (let i = 0; i < 26; i++) { await page.screenshot({ path: `${OUT}/feel_land_${String(i).padStart(2, '0')}.png` }); await page.waitForTimeout(110); }
  await slow(1);
  await page.keyboard.up('w');
  const d = await gp(() => window.__fl.slice());
  const li = d.findIndex((x, i) => i > 0 && x.gr && !d[i - 1].gr);
  console.log('land: hips height around touch-down (every 3rd frame):', d.slice(Math.max(0, li - 6), li + 60).filter((_, i) => i % 3 === 0).map((x) => `${x.gr ? 'G' : 'a'}${x.hy}`).join(' '));
  await page.waitForTimeout(600);
}

if (!only || only === 'melee') {
  await gp(async () => {
    const g = window.__gp, c = g.ctx;
    g.teleport(0, 0, 20); g.setLook(Math.PI, 0); c.facing.yaw = c.facing.prevYaw = Math.PI;
    if (!c.weapons.sandbox) g.sandbox();
    const p = c.player, at = p.position.clone();
    at.x += -Math.sin(p.yaw) * 1.4; at.z += -Math.cos(p.yaw) * 1.4;
    await c.zombies.spawn(at, p.yaw, 'shambler');
  });
  await page.keyboard.press('Digit4'); // knife
  await page.waitForTimeout(1500);
  await cam(Math.PI, 3.4, 1.2, 1.0);
  await page.waitForTimeout(300);
  await slow(SLOW);
  await gp(() => { window.__fl.length = 0; window.__gp.mouse(0, true); });
  await page.waitForTimeout(250);
  await gp(() => window.__gp.mouse(0, false));
  for (let i = 0; i < 26; i++) { await page.screenshot({ path: `${OUT}/feel_melee_${String(i).padStart(2, '0')}.png` }); await page.waitForTimeout(110); }
  await slow(1);
  const d = await gp(() => window.__fl.slice());
  const ph = []; let last = '';
  for (const x of d) { const k = `${x.mp}${x.pause > 0 ? '+PAUSE' : ''}`; if (k !== last) { ph.push(`${k}@${(x.t - d[0].t).toFixed(0)}`); last = k; } }
  console.log('melee phases (real ms, game = ×' + SLOW + '):', ph.join(' → '));
  console.log('weapon:', await gp(() => window.__gp.ctx.weapons.item?.defId), 'zombies hp:', await gp(() => window.__gp.ctx.zombies.list?.map?.((z) => z.hp).slice(0, 3)));
}
console.log('errors', JSON.stringify(errs.slice(0, 4)));
await browser.close();
