// node tools/audit/outskirtswalk.mjs [zombies|walk|all]   headless: (1) walks the outskirts roads from the gate to every POI and logs stuck spots,
// opens a door, checks the container prompts at 3 places; (2) teleports to 3 POIs and counts the streamed-in zombies (never in view) with a perf snapshot.
import { launch } from './browser.mjs';
const mode = process.argv[2] ?? 'all';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('console', (m) => console.log('[c]', m.type(), m.text().slice(0, 160)));
page.on('framenavigated', (f) => console.log('[nav]', f.url()));
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.routeWebSocket(/.*/, () => {}); // swallow the vite HMR socket: other agents' edits must not reload this run
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 240000 });
await page.waitForTimeout(2500);
await page.mouse.click(640, 360);
const install = () => page.evaluate(() => {
  const g = window.__gp, p = g.ctx.player;
  p.godMode = true;
  window.__stalls = [];
  const orig = p.step.bind(p);
  p.step = (dt) => {
    const x0 = p.curr.x, z0 = p.curr.z;
    orig(dt);
    const sp = Math.hypot(p.vel.x, p.vel.z), d = Math.hypot(p.curr.x - x0, p.curr.z - z0);
    if (window.__walking && sp > 1.5 && d < sp * dt * 0.4) {
      const k = p.kcc, hits = [];
      for (let i = 0; i < k.numComputedCollisions(); i++) { const c = k.computedCollision(i); if (c) hits.push(`${c.normal1.y.toFixed(2)}:${c.collider?.collisionGroups() >>> 16}`); }
      window.__stalls.push([+p.curr.x.toFixed(1), +p.curr.z.toFixed(1), +sp.toFixed(1), p.grounded ? 'g' : 'air', +(d / dt).toFixed(1), hits.join('|')]);
    }
  };
});
const ev = async (f, a) => {
  for (let k = 0; k < 4; k++) {
    try { return await page.evaluate(f, a); } catch (e) {
      if (!/ctx|context was destroyed/.test(String(e))) throw e;
      console.log('[page reloaded by the dev server, recovering]');
      await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 240000 });
      await page.waitForTimeout(2500);
      await install();
    }
  }
  throw new Error('page keeps reloading');
};
await install();

async function walkTo(wps, label) {
  await ev(() => { window.__stalls = []; window.__walking = true; });
  let stuck = null;
  for (const [x, z] of wps) {
    const t0 = Date.now();
    await page.keyboard.down('KeyW');
    for (;;) {
      const r = await ev(([x, z]) => {
        const p = window.__gp.ctx.player, dx = x - p.curr.x, dz = z - p.curr.z;
        window.__gp.setLook(Math.atan2(-dx, -dz), 0);
        return Math.hypot(dx, dz);
      }, [x, z]);
      if (r < 2.5) break;
      if (Date.now() - t0 > 30000) { stuck = [x, z, r]; break; }
      await page.waitForTimeout(120);
    }
    await page.keyboard.up('KeyW');
    if (stuck) break;
  }
  await ev(() => { window.__walking = false; });
  const st = await ev(() => window.__stalls);
  const uniq = [];
  for (const s of st) if (!uniq.some((u) => Math.hypot(u[0] - s[0], u[1] - s[1]) < 3)) uniq.push(s);
  console.log(`${label}: ${stuck ? 'STUCK trying ' + JSON.stringify(stuck) : 'ok'}; stall ticks ${st.length}, spots ${JSON.stringify(uniq.slice(0, 6))}`);
}

if (mode === 'walk' || mode === 'all') {
  await ev(([z]) => window.__gp.teleport(0, z, Math.PI), [process.env.SKIP ? 198 : 92]);
  await page.waitForTimeout(1500);
  const R = [
    ['gate to fuel stop and Maple junction', [[0, 104], [0, 140], [0, 165], [0, 198]]],
    ['Maple Street to the school', [[-20, 198], [-60, 198], [-100, 198], [-128, 198]]],
    ['back to the main road, diner and crash road', [[-60, 198], [-8, 198], [0, 199], [0, 232], [20, 232], [0, 232], [0, 244], [-30, 247], [-60, 251]]],
    ['crash road back, camp track', [[-30, 247], [0, 246], [0, 262], [24, 258], [38, 266]]],
    ['camp back, farm road', [[24, 258], [0, 258], [0, 200], [0, 166], [30, 165], [80, 165], [112, 165]]],
  ];
  for (const [label, wps] of R.slice(+(process.env.SKIP ?? 0))) await walkTo(wps, label);
  // a door: walk to house A's front step, open with E, walk in
  await ev(() => window.__gp.teleport(-60.5, 192, 0));
  await page.waitForTimeout(800);
  await walkTo([[-60.5, 188.7]], 'to the house A step');
  await ev(() => window.__gp.teleport(-60.5, 188.7, 0));
  await page.waitForTimeout(600);
  const prompt = await ev(() => { const g = window.__gp.ctx.game, p = g.player.position; return g.interact.all.filter((i) => Math.hypot(i.position.x - p.x, i.position.y - (p.y + 1.2), i.position.z - p.z) < i.radius).map((i) => i.prompt()); });
  console.log('prompts at the door:', JSON.stringify(prompt));
  await page.keyboard.down('KeyE'); await page.waitForTimeout(500); await page.keyboard.up('KeyE');
  await page.waitForTimeout(900);
  await walkTo([[-60.5, 184.5], [-60.5, 181]], 'through the opened door into house A');
  // container prompts at three places
  for (const [name, x, z, yaw] of [['checkpoint footlocker', -21.4, 120.7, 3.14], ['house A kitchen', -59.5, 185.6, 0], ['fuel shop shelf', -30.3, 153.4, 1.57]]) {
    await ev(([x, z, yaw]) => window.__gp.teleport(x, z, yaw), [x, z, yaw]);
    await page.waitForTimeout(700);
    const ps = await ev(() => { const g = window.__gp.ctx.game, p = g.player.position; return g.interact.all.filter((i) => Math.hypot(i.position.x - p.x, i.position.y - (p.y + 1.2), i.position.z - p.z) < i.radius).map((i) => i.prompt()); });
    console.log('container prompts at', name, JSON.stringify(ps));
  }
}

if (mode === 'zombies' || mode === 'all') {
  await ev(() => {
    const z = window.__gp.ctx.zombies, cam = window.__gp.ctx.game.camera, p = window.__gp.ctx.player;
    window.__spawnLog = [];
    const orig = z.spawn.bind(z);
    z.spawn = async (at, yaw, id) => {
      const ndc = at.clone().setY(1).project(cam);
      window.__spawnLog.push({ x: +at.x.toFixed(1), z: +at.z.toFixed(1), dist: +Math.hypot(at.x - p.curr.x, at.z - p.curr.z).toFixed(1), inView: ndc.z < 1 && Math.abs(ndc.x) < 1.05 && Math.abs(ndc.y) < 1.05, id });
      return orig(at, yaw, id);
    };
  });
  for (const [name, x, z, yaw] of [['checkpoint', 0, 104, Math.PI], ['fuel stop', -8, 150, Math.PI / 2], ['Maple Street', -20, 198, Math.PI / 2], ['camp', 10, 252, -2.4]]) {
    await ev(([x, z, yaw]) => { window.__gp.teleport(x, z, yaw); window.__gp.setLook(yaw, 0); }, [x, z, yaw]);
    await page.waitForTimeout(14000);
    const r = await ev(() => { const zs = window.__gp.ctx.zombies, p = window.__gp.ctx.game.perf.snapshot(); return { alive: zs.alive, poiAlive: zs.poiAlive, draws: p.drawCalls, tris: Math.round(p.triangles / 1000), p95: +p.p95.toFixed(1) }; });
    console.log('zombies at', name, JSON.stringify(r));
  }
  const log = await ev(() => window.__spawnLog);
  console.log('spawns', log.length, 'in view', log.filter((l) => l.inView).length, 'closest', Math.min(...log.map((l) => l.dist)), 'variants', JSON.stringify([...new Set(log.map((l) => l.id))]));
}
console.log('errors', errs.slice(0, 6));
await browser.close();
