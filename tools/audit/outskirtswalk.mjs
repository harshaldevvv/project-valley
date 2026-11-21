// node tools/audit/outskirtswalk.mjs [zombies|walk|town|outpost|lake|all]   headless: (1) walks the outskirts roads from the gate to every POI and logs stuck spots,
// opens a door, checks the container prompts (incl. two roadside coolers; the routes pass the 4 roadblock gaps); (2) teleports to 3 POIs and counts the streamed-in zombies (never in view) with a perf snapshot.
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
// Walk legs run with no zombies: a streamed zombie in a doorway (collision group 8) blocks the god-mode player and reads as a stall
// (likely the grocery door's 985 ticks). The zombie leg puts the spawner back.
await ev(() => { const zs = window.__gp.ctx.zombies; window.__poiSpawn = zs.updatePoiSpawns; zs.updatePoiSpawns = () => {}; zs.clear(); for (const zn of zs.poiZones) zn.list = []; });

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

// Aim the camera through the door (the E target is picked by aim, and a car trunk sits next to the grocery door), press E until the
// door reads "Close door" (3 tries), so a door that failed to open shows as such instead of as a pile of stall ticks against its leaf.
async function openDoor(ix, iz) {
  const near = () => ev(() => { const g = window.__gp.ctx.game, p = g.player.position; return g.interact.all.filter((i) => Math.hypot(i.position.x - p.x, i.position.y - (p.y + 1.2), i.position.z - p.z) < i.radius).map((i) => i.prompt()); });
  let pr = [];
  for (let k = 0; k < 3; k++) {
    await ev(([x, z]) => { const p = window.__gp.ctx.player; window.__gp.setLook(Math.atan2(-(x - p.curr.x), -(z - p.curr.z)), 0); }, [ix, iz]);
    await page.waitForTimeout(300);
    await page.keyboard.down('KeyE'); await page.waitForTimeout(600); await page.keyboard.up('KeyE'); await page.waitForTimeout(1200);
    pr = await near();
    if (pr.includes('Close door')) return pr;
  }
  console.log('DOOR DID NOT OPEN, prompts', JSON.stringify(pr));
  return pr;
}

if (mode === 'walk' || mode === 'all') {
  await ev(([z]) => window.__gp.teleport(0, z, Math.PI), [process.env.SKIP ? 198 : 92]);
  await page.waitForTimeout(1500);
  const R = [
    ['gate to fuel stop and Maple junction', [[0, 104], [0, 140], [0, 165], [0, 198]]],
    ['Maple Street to the school', [[-20, 198], [-60, 198], [-100, 198], [-128, 198]]],
    ['back to the main road, diner and crash road', [[-60, 198], [-8, 198], [0, 199], [0, 232], [20, 232], [0, 232], [0, 244], [-30, 247], [-60, 251]]],
    ['crash road back, camp track', [[-30, 247], [0, 246], [0, 262], [24, 258], [38, 266]]],
    ['camp back, farm road', [[31, 259.5], [24, 258], [0, 258], [0, 200], [0, 166], [30, 165], [80, 165], [112, 165]]],
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
  for (let k = 0; k < 3; k++) { await page.keyboard.down('KeyE'); await page.waitForTimeout(600); await page.keyboard.up('KeyE'); await page.waitForTimeout(1100); const pr = await ev(() => { const g = window.__gp.ctx.game, p = g.player.position; return g.interact.all.filter((i) => Math.hypot(i.position.x - p.x, i.position.y - (p.y + 1.2), i.position.z - p.z) < i.radius).map((i) => i.prompt()); }); if (pr.includes('Close door')) break; }
  await page.waitForTimeout(900);
  await walkTo([[-60.5, 185.2], [-61.6, 184.4], [-61.6, 180.5]], 'through the opened door into house A');
  // container prompts at three places
  for (const [name, x, z, yaw] of [['checkpoint footlocker', -21.4, 120.7, 3.14], ['house A kitchen', -59.5, 185.6, 0], ['fuel shop shelf', -30.3, 153.4, 1.57], ['pharmacy shelf', -91.4, 121.0, 0], ['police locker', -124.1, 121.9, 4.71], ['armory footlocker', -123.6, 118.4, 0], ['roadside cooler (diner road)', 25.1, 236.5, 3.14], ['roadside cooler (farm road)', 67.6, 169.6, 0]]) {
    await ev(([x, z, yaw]) => window.__gp.teleport(x, z, yaw), [x, z, yaw]);
    await page.waitForTimeout(700);
    const ps = await ev(() => { const g = window.__gp.ctx.game, p = g.player.position; return g.interact.all.filter((i) => Math.hypot(i.position.x - p.x, i.position.y - (p.y + 1.2), i.position.z - p.z) < i.radius).map((i) => i.prompt()); });
    console.log('container prompts at', name, JSON.stringify(ps));
  }
}

if (mode === 'town' || mode === 'all') {
  await ev(() => window.__gp.teleport(-72, 202, 0));
  await page.waitForTimeout(1500);
  await walkTo([[-72, 180], [-72, 160], [-72, 138], [-90, 134], [-120, 134], [-140, 134]], 'Mill Road into Dunmore, Main Street to the church');
  const prompts = () => ev(() => { const g = window.__gp.ctx.game, p = g.player.position; return g.interact.all.filter((i) => Math.hypot(i.position.x - p.x, i.position.y - (p.y + 1.2), i.position.z - p.z) < i.radius).map((i) => i.prompt()); });
  for (const [name, dx, dz, ix, iz] of [['pharmacy', -88, 128.7, -88, 124], ['police station', -119, 128.7, -119, 124], ['grocery', -88, 139.3, -88, 143.5], ['motel room 1', -117.5, 139.3, -117.5, 143.5], ['hardware store', -99.3, 128.7, -99.3, 124]]) {
    await ev(([x, z, yaw]) => window.__gp.teleport(x, z, yaw), [dx, dz, name === 'grocery' || name.startsWith('motel') ? Math.PI : 0]);
    await page.waitForTimeout(700);
    const p0 = await prompts();
    const p1 = await openDoor(ix, iz);
    await walkTo([[ix, iz]], 'through the ' + name + ' door');
    console.log('door prompts', name, JSON.stringify(p0), '->', JSON.stringify(p1));
  }
}
if (mode === 'outpost' || mode === 'all') {
  await ev(() => window.__gp.teleport(93.5, 163, 0));
  await page.waitForTimeout(1500);
  await walkTo([[93.5, 140], [93.5, 118], [104, 118], [114, 118], [127, 116], [127, 114.2]], 'farm road to the outpost gate and the barracks');
  const prompts = () => ev(() => { const g = window.__gp.ctx.game, p = g.player.position; return g.interact.all.filter((i) => Math.hypot(i.position.x - p.x, i.position.y - (p.y + 1.2), i.position.z - p.z) < i.radius).map((i) => i.prompt()); });
  for (const [name, dx, dz, ix, iz] of [['outpost barracks', 127, 113.4, 126.4, 110.4], ['outpost armory', 141.6, 112.3, 141.6, 109]]) {
    await ev(([x, z]) => window.__gp.teleport(x, z, 0), [dx, dz]);
    await page.waitForTimeout(700);
    const p0 = await prompts();
    const p1 = await openDoor(ix, iz);
    await walkTo([[ix, iz]], 'through the ' + name + ' door');
    console.log('door prompts', name, JSON.stringify(p0), '->', JSON.stringify(p1));
  }
  await ev(() => window.__gp.teleport(143.6, 106.4, 0));
  await page.waitForTimeout(800);
  console.log('container prompts at the armory', JSON.stringify(await prompts()));
}
if (mode === 'lake' || mode === 'all') {
  // Loon Lake Campground (outskirts_lake.ts): the dirt track on from the crash road, the office and cabin doors, the lake shore, container prompts
  await ev(() => window.__gp.teleport(-60, 251, Math.PI / 2));
  await page.waitForTimeout(1500);
  await walkTo([[-78, 252], [-95, 253], [-112, 254], [-121, 254], [-127, 251.5], [-132, 249]], 'crash road on along the track to the lake car park and the office');
  const prompts = () => ev(() => { const g = window.__gp.ctx.game, p = g.player.position; return g.interact.all.filter((i) => Math.hypot(i.position.x - p.x, i.position.y - (p.y + 1.2), i.position.z - p.z) < i.radius).map((i) => i.prompt()); });
  for (const [name, dx, dz, ix, iz, yaw] of [['lake office', -132, 248.4, -132, 245.4, 0], ['lake cabin A', -140.4, 244.2, -144, 244.2, Math.PI / 2], ['lake cabin B', -140.4, 255.2, -144, 255.2, Math.PI / 2]]) {
    await ev(([x, z, yaw]) => window.__gp.teleport(x, z, yaw), [dx, dz, yaw]);
    await page.waitForTimeout(700);
    const p0 = await prompts();
    const p1 = await openDoor(ix, iz);
    await walkTo([[ix, iz]], 'through the ' + name + ' door');
    console.log('door prompts', name, JSON.stringify(p0), '->', JSON.stringify(p1));
  }
  await ev(() => window.__gp.teleport(-124, 258, Math.PI));
  await page.waitForTimeout(800);
  await walkTo([[-122, 262], [-122, 268.2], [-122, 275.6]], 'out along the dock');
  console.log('dock end player y', await ev(() => +window.__gp.ctx.game.player.position.y.toFixed(2)));
  await walkTo([[-122, 268.2], [-123, 268.4], [-130, 268.6], [-134.5, 266.4], [-134.8, 273], [-139.5, 274.6], [-139.5, 286]], 'lake shore: the dock end, the north bank, down the west pitches');
  for (const [name, x, z, yaw] of [['lake bear locker', -147.8, 280.6, Math.PI / 2], ['lake tackle locker', -114.6, 259.0, Math.PI], ['lake camp store shelf', -134.6, 243.6, 0]]) {
    await ev(([x, z, yaw]) => window.__gp.teleport(x, z, yaw), [x, z, yaw]);
    await page.waitForTimeout(700);
    console.log('container prompts at', name, JSON.stringify(await prompts()));
  }
}
if (mode === 'zombies' || mode === 'all') {
  await ev(() => {
    window.__gp.ctx.zombies.updatePoiSpawns = window.__poiSpawn;
    const z = window.__gp.ctx.zombies, cam = window.__gp.ctx.game.camera, p = window.__gp.ctx.player;
    window.__spawnLog = [];
    const orig = z.spawn.bind(z);
    z.spawn = async (at, yaw, id) => {
      const ndc = at.clone().setY(1).project(cam);
      window.__spawnLog.push({ x: +at.x.toFixed(1), z: +at.z.toFixed(1), dist: +Math.hypot(at.x - p.curr.x, at.z - p.curr.z).toFixed(1), inView: ndc.z < 1 && Math.abs(ndc.x) < 1.05 && Math.abs(ndc.y) < 1.05, id });
      return orig(at, yaw, id);
    };
  });
  for (const [name, x, z, yaw] of [['checkpoint', 0, 104, Math.PI], ['fuel stop', -8, 150, Math.PI / 2], ['Maple Street', -20, 198, Math.PI / 2], ['camp', 10, 252, -2.4], ['outpost', 96, 146, Math.PI], ['lake', -100, 253, -Math.PI / 2]]) {
    await ev(([x, z, yaw]) => { window.__gp.teleport(x, z, yaw); window.__gp.setLook(yaw, 0); }, [x, z, yaw]);
    await page.waitForTimeout(14000);
    const r = await ev(() => { const zs = window.__gp.ctx.zombies, p = window.__gp.ctx.game.perf.snapshot(); return { alive: zs.alive, poiAlive: zs.poiAlive, draws: p.drawCalls, tris: Math.round(p.triangles / 1000), p95: +p.p95.toFixed(1) }; });
    console.log('zombies at', name, JSON.stringify(r));
  }
  const log = await ev(() => window.__spawnLog);
  const op = log.filter((l) => l.x > 85 && l.z < 135);
  console.log('outpost spawns', op.length, 'soldiers', op.filter((l) => /soldier/.test(l.id)).length);
  console.log('spawns', log.length, 'in view', log.filter((l) => l.inView).length, 'closest', Math.min(...log.map((l) => l.dist)), 'variants', JSON.stringify([...new Set(log.map((l) => l.id))]));
}
console.log('errors', errs.slice(0, 6));
await browser.close();
