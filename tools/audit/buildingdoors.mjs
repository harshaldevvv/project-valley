// node tools/audit/buildingdoors.mjs [id,id]   headless: for every full-height opening of every enterable building (front/back/side doors and
// partition doorways), opens the hinged leaf if there is one, then walks in from 1.8 m outside to 2.2 m inside and back out with real key
// presses, logging stall ticks (body moved < 40% of its speed) and what was hit. Env ROUNDS=n repeats each door (catches flaky ones).
import { launch } from './browser.mjs';
const only = process.argv[2]?.split(',');
const rounds = +(process.env.ROUNDS ?? 1);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await page.routeWebSocket(/.*/, () => {});
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 240000 });
await page.waitForTimeout(2500);
await page.mouse.click(480, 270);
const doors = await page.evaluate(async (only) => {
  const { BUILDINGS } = await import('/src/content/data/outskirts.ts');
  const { buildingWorld } = await import('/src/content/data/pois.ts');
  const g = window.__gp, p = g.ctx.player;
  p.godMode = true;
  // no zombies: a streamed zombie standing in a doorway (collision group 8) blocks the god-mode player and reads as a blocked door
  const zs = g.ctx.zombies; zs.updatePoiSpawns = () => {}; zs.clear(); for (const zn of zs.poiZones) zn.list = [];
  window.__stalls = [];
  const orig = p.step.bind(p);
  p.step = (dt) => {
    const x0 = p.curr.x, z0 = p.curr.z;
    orig(dt);
    const sp = Math.hypot(p.vel.x, p.vel.z), d = Math.hypot(p.curr.x - x0, p.curr.z - z0);
    if (window.__walking && sp > 1.5 && d < sp * dt * 0.4) {
      const k = p.kcc, hits = [];
      for (let i = 0; i < k.numComputedCollisions(); i++) {
        const c = k.computedCollision(i);
        if (c && Math.abs(c.normal1.y) < 0.7) hits.push(`n(${c.normal1.x.toFixed(2)},${c.normal1.z.toFixed(2)}) y${c.witness1.y.toFixed(2)} at(${c.witness1.x.toFixed(2)},${c.witness1.z.toFixed(2)}) g${c.collider?.collisionGroups() >>> 16}`);
      }
      window.__stalls.push(`${p.curr.x.toFixed(2)},${p.curr.z.toFixed(2)} y${p.curr.y.toFixed(2)} ${hits.slice(0, 2).join(' ')}`);
    }
  };
  const out = [];
  for (const b of BUILDINGS) {
    if (b.kind === 'shed' || (only && !only.includes(b.id))) continue;
    const hw = b.w / 2, hd = b.d / 2;
    // [side, opening, centre u,v, inward unit (du,dv)]
    const sides = [['front', b.front, (o) => [o.u, hd], [0, -1]], ['back', b.back, (o) => [o.u, -hd], [0, 1]], ['left', b.left, (o) => [-hw, o.u], [1, 0]], ['right', b.right, (o) => [hw, o.u], [-1, 0]]];
    if (b.partition) sides.push(['partition', b.partition.open, (o) => [o.u, b.partition.v], [0, -1]]);
    for (const dv of b.dividers ?? []) sides.push(['divider', dv.open, (o) => [dv.u, o.u], [-1, 0]]);
    for (const [side, ops, at, inw] of sides) for (const o of ops ?? []) {
      if (o.sill !== 0) continue;
      const [u, v] = at(o);
      const c = buildingWorld(b, u, v), a = buildingWorld(b, u + inw[0], v + inw[1]);
      const ix = a.x - c.x, iz = a.z - c.z;
      out.push({ id: b.id, side, u: o.u, w: o.w, cx: c.x, cz: c.z, ix, iz });
    }
  }
  return out;
}, only);
console.log('openings', doors.length);
let last = '';
async function walk(x, z, maxMs = 6000) {
  const t0 = Date.now();
  await page.keyboard.down('KeyW');
  let r = 99;
  while (Date.now() - t0 < maxMs) {
    r = await page.evaluate(([x, z]) => { const p = window.__gp.ctx.player, dx = x - p.curr.x, dz = z - p.curr.z; window.__gp.setLook(Math.atan2(-dx, -dz), 0); return Math.hypot(dx, dz); }, [x, z]);
    if (r < 0.5) break;
    await page.waitForTimeout(60);
  }
  await page.keyboard.up('KeyW');
  last = await page.evaluate(() => { const p = window.__gp.ctx.player; return `${p.curr.x.toFixed(2)},${p.curr.z.toFixed(2)} y${p.curr.y.toFixed(2)}`; });
  return r;
}
let bad = 0, total = 0;
for (let rr = 0; rr < rounds; rr++) for (const d of doors) {
  const ox = d.cx - d.ix * 1.8, oz = d.cz - d.iz * 1.8, inx = d.cx + d.ix * 2.2, inz = d.cz + d.iz * 2.2;
  const opened = await page.evaluate(async ([ox, oz, cx, cz]) => {
    const g = window.__gp;
    g.teleport(ox, oz, 0);
    await new Promise((r) => setTimeout(r, 900));
    const door = g.ctx.game.interact.all.find((i) => Math.hypot(i.position.x - cx, i.position.z - cz) < 0.4 && /door/i.test(i.prompt()));
    if (!door) return 'no leaf';
    if (door.prompt() !== 'Close door') door.onInteract();
    return door.prompt();
  }, [ox, oz, d.cx, d.cz]);
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.__stalls = []; window.__walking = true; });
  const rIn = await walk(inx, inz);
  const endIn = last;
  const sIn = await page.evaluate(() => window.__stalls.splice(0));
  const rOut = await walk(ox, oz);
  const sOut = await page.evaluate(() => { window.__walking = false; return window.__stalls.splice(0); });
  // through = body at least 0.9 m past the wall line; furniture just inside (a counter, a parked car) may stop it short of the 2.2 m target
  const [ex, ez] = endIn.split(' ')[0].split(',').map(Number);
  const depth = (ex - d.cx) * d.ix + (ez - d.cz) * d.iz;
  const fail = (rIn >= 0.5 && depth < 0.9) || rOut >= 0.5 || sIn.length + sOut.length > 3;
  total++; if (fail) bad++;
  console.log(`${fail ? 'BAD ' : 'ok  '} ${d.id} ${d.side} u${d.u} w${d.w} door(${d.cx.toFixed(1)},${d.cz.toFixed(1)}) [${opened}] in ${rIn < 0.5 ? 'reached' : (depth >= 0.9 ? 'through (' + depth.toFixed(1) + ' m in, interior blocks the 2.2 m target)' : 'left ' + rIn.toFixed(1) + ' at ' + endIn + ' target ' + inx.toFixed(1) + ',' + inz.toFixed(1))} stalls ${sIn.length}, out ${rOut < 0.5 ? 'reached' : 'left ' + rOut.toFixed(1)} stalls ${sOut.length}`);
  if (fail) for (const s of [...new Set([...sIn, ...sOut])].slice(0, 4)) console.log('      ', s);
}
console.log(`doors ${total}, bad ${bad}`);
console.log('errors', JSON.stringify(errs.slice(0, 4)));
await browser.close();
