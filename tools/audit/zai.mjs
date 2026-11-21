// node tools/audit/zai.mjs <tag> [scenes]   headless zombie AI behaviour audit, frame-stepped at a fixed 60 Hz (same loop
// takeover as zfx.mjs). Prints numbers per scene and writes overhead / side strips to docs/audit/screenshots/wip/<tag>_*.png.
// scenes (comma list, default all): wall, crate, door, spread, gunshot, flashlight, screamer, brute, attack
import { execFileSync } from 'node:child_process';
import { launch } from './browser.mjs';
const [tag = 'zai', scenesArg = 'wall,crate,door,spread,gunshot,flashlight,screamer,brute,attack'] = process.argv.slice(2);
const scenes = scenesArg.split(',');
const out = 'docs/audit/screenshots/wip/';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2500);
const ev = (f, a) => page.evaluate(f, a);
const type = await ev(() => Object.keys(window.__gp.data.zombieDefs).find((k) => k.startsWith('pfz_')));
// an open patch of ground: the sandbox spawn point
const base = await ev(() => {
  const g = window.__gp;
  g.ctx.player.godMode = true;
  g.data.horde.passive = false;
  g.ctx.zombies.clear();
  g.sandbox();
  window.engine?.setTimeOfDay?.(13);
  const p = g.ctx.player.curr;
  return [p.x, p.z];
});
await ev(() => {
  const r = window.__gp.ctx.game.renderer;
  window.__cb = r._animation._animationLoop;
  r.setAnimationLoop(null);
  window.__ft = performance.now();
  window.__obs = [];
});
const advance = (ms) => ev(async (ms) => {
  const n = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < n; i++) {
    window.__ft += 1000 / 60;
    window.__cb(window.__ft);
    window.__rec?.();
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}, ms);
const shot = (name) => page.screenshot({ path: `${out}${tag}_${name}.png` });
const CROP_PY = `import sys
from PIL import Image
out,box,fs=sys.argv[1],[int(v) for v in sys.argv[2].split(",")],sys.argv[3:]
ims=[Image.open(f).convert("RGB").crop(box) for f in fs]
W,H=ims[0].size
s=Image.new("RGB",(W*len(ims),H))
for i,im in enumerate(ims): s.paste(im,(i*W,0))
s.save(out)`;
const sheet = (name, files, box = '180,0,780,540') => {
  try { execFileSync('python', ['-c', CROP_PY, `${out}${tag}_${name}.png`, box, ...files.map((f) => `${out}${tag}_${f}.png`)]); } catch (e) { console.log('sheet failed', String(e).slice(0, 120)); }
};
const strip = async (name, times, box) => {
  const files = [];
  let t0 = 0;
  for (const t of times) { await advance(t - t0); t0 = t; const f = `${name}_${t}`; await shot(f); files.push(f); }
  sheet(name, files, box);
};

/** Reset: no zombies, no test props, player at base + (dx,dz) facing -z, daytime, flashlight off. */
const reset = (o = {}) => ev(([x, z, o]) => {
  const g = window.__gp, { world } = g.ctx.game.phys;
  g.ctx.zombies.clear();
  for (const c of window.__props ?? []) { world.removeCollider(c.col, false); c.mesh.removeFromParent(); }
  window.__props = [];
  g.ctx.rig.override = null;
  g.teleport(x + (o.dx ?? 0), z + (o.dz ?? 0), o.yaw ?? 0);
  g.ctx.player.hp = 100;
  g.ctx.player.godMode = true;
  g.data.horde.passive = false;
  window.engine?.setTimeOfDay?.(o.hour ?? 13);
  if (g.flashlight) g.flashlight.on = !!o.light;
  window.__rec = null;
}, [...base, o]);
/** A static box prop (collider + grey mesh) centred at base + (dx, dz), half extents hx, hy, hz. */
const prop = (dx, dz, hx, hy, hz) => ev(async ([x, z, hx, hy, hz]) => {
  const g = window.__gp, { R, world } = g.ctx.game.phys;
  const col = world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, hy, z).setCollisionGroups((1 << 16) | 0xffff));
  let mesh = { removeFromParent() {} };
  let src = null;
  g.ctx.game.scene.traverse((o) => { if (!src && o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && o.material?.type === 'MeshStandardNodeMaterial' && o.geometry?.index) src = o; });
  if (src) {
    const Mesh = src.constructor, Geo = src.geometry.constructor;
    // a box from a plain BufferGeometry: 8 corners, 12 triangles
    const geo = new Geo();
    const p = [];
    for (const [a, b, c] of [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]) p.push(a * hx, b * hy, c * hz);
    const Attr = src.geometry.index.constructor;
    geo.setAttribute('position', new Attr(new Float32Array(p), 3));
    geo.setIndex([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 6, 2, 3, 7, 6, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5]);
    geo.computeVertexNormals();
    mesh = new Mesh(geo, new src.material.constructor({ color: 0x8a8f96, roughness: 0.9 }));
    mesh.position.set(x, hy, z);
    g.ctx.game.scene.add(mesh);
  }
  window.__props.push({ col, mesh });
}, [base[0] + dx, base[1] + dz, hx, hy, hz]);
/** Spawn `n` zombies of `t` at base + offsets; returns their indices. aw: forced awareness. */
const spawnAt = (list, t = type) => ev(async ([x, z, list, t]) => {
  const g = window.__gp;
  for (const s of list) {
    await g.ctx.zombies.spawn({ x: x + s[0], y: 0.05, z: z + s[1] }, s[2] ?? Math.PI, s[3] ?? t);
    const zz = g.ctx.zombies.list[g.ctx.zombies.list.length - 1];
    if (s[4]) { zz.sense.awareness = s[4]; zz.sense.suspicion = s[4] === 'detected' ? 1 : 0; zz.lastKnown.copy(g.ctx.player.curr); }
  }
}, [...base, list, t]);
/** Overhead camera above base + (dx, dz) at height h (looking straight down, -z up the screen). */
const topCam = (dx, dz, h = 16) => ev(([x, z, h]) => {
  const g = window.__gp, c = g.ctx.game.camera;
  g.ctx.rig.override = () => {
    c.position.set(x, h, z + 0.01);
    c.up.set(0, 0, -1);
    c.lookAt(x, 0, z);
    if (c.fov !== 50) { c.fov = 50; c.updateProjectionMatrix(); }
    return true;
  };
}, [base[0] + dx, base[1] + dz, h]);
const sideCamOn = (i, side = 4, h = 1.2, lookH = 1.0) => ev(([i, side, h, lookH]) => {
  const g = window.__gp, c = g.ctx.game.camera, z = g.ctx.zombies.list[i];
  g.ctx.rig.override = () => {
    c.up.set(0, 1, 0);
    const P = z.curr;
    c.position.set(P.x + side, P.y + h, P.z + 0.5);
    c.lookAt(P.x, P.y + lookH, P.z);
    if (c.fov !== 45) { c.fov = 45; c.updateProjectionMatrix(); }
    return true;
  };
}, [i, side, h, lookH]);
/** Per-step recorder: yaw flips (jitter), stuck time, closest approach, modes. */
const record = () => ev(() => {
  const g = window.__gp;
  window.__st = { steps: 0, flips: [], stuck: [], minD: [], modes: [], aw: [], reach: [], lastDy: [], prev: [] };
  window.__rec = () => {
    const S = window.__st, P = g.ctx.player.curr;
    S.steps++;
    g.ctx.zombies.list.forEach((z, i) => {
      const dy = Math.atan2(Math.sin(z.yaw - z.prevYaw), Math.cos(z.yaw - z.prevYaw));
      if (S.lastDy[i] !== undefined && Math.sign(dy) !== Math.sign(S.lastDy[i]) && Math.abs(dy) > 0.02 && Math.abs(S.lastDy[i]) > 0.02) S.flips[i] = (S.flips[i] ?? 0) + 1;
      S.lastDy[i] = dy;
      const q = (S.prev[i] ??= []);
      q.push([z.curr.x, z.curr.z]);
      if (q.length > 3) q.shift();
      const mv = Math.hypot(z.curr.x - q[0][0], z.curr.z - q[0][1]); // over 2 steps (far zombies step at 30 Hz)
      if (q.length === 3 && z.mode === 'move' && z.sense.awareness !== 'unaware' && z.reactT <= 0 && mv < 0.004) S.stuck[i] = (S.stuck[i] ?? 0) + 1;
      const d = Math.hypot(z.curr.x - P.x, z.curr.z - P.z);
      S.minD[i] = Math.min(S.minD[i] ?? 99, d);
      if (S.reach[i] === undefined && d < 2.2) S.reach[i] = S.steps / 60;
      const m = z.mode + ':' + z.sense.awareness;
      if (S.modes[i]?.at(-1)?.[1] !== m) (S.modes[i] ??= []).push([+(S.steps / 60).toFixed(2), m]);
    });
  };
});
const report = (label) => ev((label) => {
  const S = window.__st;
  return `${label}: ` + window.__gp.ctx.zombies.list.map((z, i) => `#${i} ${z.def.id} reach=${S.reach[i]?.toFixed(2) ?? 'never'}s minD=${S.minD[i]?.toFixed(2)} flips=${S.flips[i] ?? 0} stuck=${((S.stuck[i] ?? 0) / 60).toFixed(2)}s`).join(' | ');
}, label);
const modes = (i = 0) => ev((i) => JSON.stringify(window.__st.modes[i]), i);
/** Angular spread of living zombies around the player and their nearest-neighbour gap. */
const spread = () => ev(() => {
  const g = window.__gp, P = g.ctx.player.curr;
  const zs = g.ctx.zombies.list.filter((z) => z.alive);
  const ang = zs.map((z) => Math.atan2(z.curr.x - P.x, z.curr.z - P.z)).sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 0; i < ang.length; i++) maxGap = Math.max(maxGap, ((ang[(i + 1) % ang.length] - ang[i] + Math.PI * 2) % (Math.PI * 2)) || Math.PI * 2);
  let nn = 99;
  for (const a of zs) for (const b of zs) if (a !== b) nn = Math.min(nn, Math.hypot(a.curr.x - b.curr.x, a.curr.z - b.curr.z));
  const dist = zs.map((z) => Math.hypot(z.curr.x - P.x, z.curr.z - P.z).toFixed(1));
  return `covered arc=${(360 - (maxGap * 180) / Math.PI).toFixed(0)}deg nearest pair=${nn.toFixed(2)}m dists=[${dist}] tokens=${zs.filter((z) => z.token).length}`;
});

for (const sc of scenes) try {
  if (sc === 'wall') {
    // 6 m wide, 3 m high wall between a detected zombie and the player: it must walk round, not grind on it
    await reset({ dz: 0 });
    await prop(0, -5, 3, 1.5, 0.25);
    await spawnAt([[0.3, -10, Math.PI, undefined, 'detected']]);
    await record();
    await topCam(0, -5, 15);
    await strip('wall', [17, 1000, 2000, 3000, 4500, 6000]);
    await advance(4000);
    console.log(await report('wall'));
    console.log('wall modes', await modes());
  }
  if (sc === 'crate') {
    // two cars-width props in a row on the line: steer round, no sticking on the corner
    await reset();
    await prop(0, -4, 0.9, 0.6, 0.6);
    await prop(-0.2, -7.5, 1.2, 1.2, 0.5);
    await spawnAt([[0.1, -10.2, Math.PI, undefined, 'detected'], [-0.7, -10.6, Math.PI, undefined, 'detected']]);
    await record();
    await topCam(0, -6, 14);
    await strip('crate', [17, 1000, 2000, 3000, 4500, 6000]);
    await advance(3000);
    console.log(await report('crate'));
  }
  if (sc === 'door') {
    // the cabin's real hinged door (world/yard/doors.ts), shut; player 3 m inside, a hunting zombie 7 m outside and off to one side
    await reset();
    const dr = await ev(async () => {
      const d = window.__gp.ctx.zombies.doors[0];
      if (!d) return null;
      if (!d.closed()) d.force?.();
      window.__door = d;
      return { x: d.x, z: d.z, nx: d.nx, nz: d.nz, closed: d.closed() };
    });
    console.log('door', JSON.stringify(dr));
    if (dr) {
      await ev(([d, t]) => {
        const g = window.__gp;
        g.teleport(d.x - d.nx * 3, d.z - d.nz * 3, Math.atan2(-d.nx, -d.nz) + Math.PI);
      }, [dr, type]);
      await ev(async ([d, t]) => {
        const g = window.__gp;
        await g.ctx.zombies.spawn({ x: d.x + d.nx * 7 + d.nz * 3, y: 0.05, z: d.z + d.nz * 7 - d.nx * 3 }, 0, t);
        const zz = g.ctx.zombies.list.at(-1);
        zz.sense.awareness = 'detected'; zz.sense.suspicion = 1; zz.lastKnown.copy(g.ctx.player.curr);
        window.__doorLog = [];
      }, [dr, type]);
      await record();
      await ev(([d]) => {
        const g = window.__gp, c = g.ctx.game.camera;
        g.ctx.rig.override = () => { c.position.set(d.x + d.nx * 2.5, 13, d.z + d.nz * 2.5 + 0.01); c.up.set(0, 0, -1); c.lookAt(d.x + d.nx * 2.5, 0, d.z + d.nz * 2.5); if (c.fov !== 50) { c.fov = 50; c.updateProjectionMatrix(); } return true; };
        const r0 = window.__rec;
        window.__rec = () => { r0(); const z = g.ctx.zombies.list[0]; const l = window.__doorLog; const st = z.mode + (window.__door.closed() ? '/shut' : '/open'); if (l.at(-1)?.[1] !== st) l.push([+(window.__st.steps / 60).toFixed(2), st]); };
      }, [dr]);
      await strip('door', [17, 2000, 4000, 6000, 8000, 10000]);
      await advance(5000);
      console.log(await report('door'));
      console.log('door log', await ev(() => JSON.stringify(window.__doorLog)));
    }
  }
  if (sc === 'spread') {
    // 7 detected zombies all from one side: they should fan out round the player, not queue in one clump
    await reset();
    await spawnAt([[0, -9], [0.8, -10], [-0.8, -10], [0.3, -11.5], [-0.4, -12.5], [1.2, -12], [-1.3, -11.8]].map((s) => [...s, Math.PI, undefined, 'detected']));
    await ev(() => { window.__gp.ctx.player.godMode = true; });
    await record();
    await topCam(0, -3, 12);
    await strip('spread', [17, 2000, 4000, 6000, 8000, 10000]);
    console.log('spread t=10s', await spread());
    await advance(4000);
    console.log('spread t=14s', await spread());
    console.log(await report('spread'));
  }
  if (sc === 'gunshot') {
    // unaware zombies 25-40 m away facing away; a pistol shot: they turn and come to look
    await reset();
    await spawnAt([[0, -25, 0], [6, -32, 0], [-8, -38, 0]]);
    await record();
    await advance(500);
    await ev(() => { const g = window.__gp; g.ctx.game.events.emit('noise', { position: g.ctx.player.curr.clone(), radius: 45, source: 'shot' }); });
    await topCam(0, -18, 30);
    await strip('gunshot', [17, 1000, 2500, 5000, 8000, 12000], '180,0,780,540');
    console.log(await report('gunshot'));
    for (let i = 0; i < 3; i++) console.log('gunshot modes', i, await modes(i));
  }
  if (sc === 'flashlight') {
    // night, zombie 30 m away facing the player, player still and crouched: off vs on
    for (const light of [false, true]) {
      await reset({ hour: 1, light });
      await ev(() => { window.__gp.ctx.player.crouched = true; });
      await spawnAt([[0, -26, 0], [12, -20, Math.atan2(12, -20)]]); // #0 faces away (only the beam can tell it); #1 faces the player, 23 m off, outside the beam
      await record();
      await advance(8000);
      console.log(await report(`flashlight ${light ? 'ON' : 'off'}`));
      console.log('  modes', await modes(0), await modes(1));
      await ev(() => { window.__gp.ctx.player.crouched = false; });
    }
  }
  if (sc === 'screamer') {
    // a screamer 18 m away sees the player and screams; shamblers 30-45 m away (out of sight, behind) should come
    await reset();
    await spawnAt([[0, -18, Math.PI, 'screamer']]);
    await spawnAt([[10, 30, 0], [-12, 35, 0], [20, -40, Math.PI]]);
    await record();
    await sideCamOn(0, 3.5, 1.4, 1.2);
    await strip('screamer', [17, 300, 700, 1100, 1500, 2200]);
    await advance(6000);
    console.log(await report('screamer'));
    for (let i = 0; i < 4; i++) console.log('screamer modes', i, await modes(i));
  }
  if (sc === 'brute') {
    // brute 14 m away, detected: approach, telegraph, swing
    await reset();
    await reset({ dx: 8 });
    await spawnAt([[8, -14, Math.PI, 'brute', 'detected']]);
    await record();
    await ev(() => { const g = window.__gp; g.ctx.player.godMode = true; });
    await sideCamOn(0, 6.5, 1.8, 1.3);
    await strip('brute', [17, 1500, 3000, 4500, 6000, 7500]);
    await advance(4000);
    console.log(await report('brute'));
    console.log('brute modes', await modes(0));
  }
  if (sc === 'attack') {
    // 4 shamblers already at the player: windup start times and lengths, hits landed
    await reset();
    await ev(() => {
      const g = window.__gp, p = g.ctx.player;
      window.__hits = [];
      const orig = p.damage.bind(p);
      p.damage = (a, from) => { window.__hits.push([+(window.__st.steps / 60).toFixed(2), a]); return orig(a, from); };
    });
    await spawnAt([[0, -1.8], [1.6, -1], [-1.6, -1], [0, 2]].map((s) => [...s, Math.atan2(-s[0], -s[1]) + Math.PI, undefined, 'detected']));
    await record();
    await topCam(0, 0, 7);
    await strip('attack', [17, 400, 800, 1200, 1600, 2000]);
    await advance(6000);
    for (let i = 0; i < 4; i++) console.log('attack modes', i, (await modes(i)).slice(0, 300));
    console.log('hits', await ev(() => JSON.stringify(window.__hits)));
  }
} catch (e) { console.log(sc, 'FAILED', String(e).slice(0, 300)); }
console.log('errors', errs.slice(0, 6));
await browser.close();
