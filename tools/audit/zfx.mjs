// node tools/audit/zfx.mjs <tag> [scenes]   headless zombie combat feel + effects audit, frame-stepped (the game's own
// animation loop is stopped and driven at a fixed 60 Hz from here, so "+100 ms" is exactly 6 sim steps).
// scenes (comma list, default all): react, death, shoot, knife, hurt
// Writes docs/audit/screenshots/wip/<tag>_<scene>_<case>_<n>.png and a contact sheet per case <tag>_<scene>_<case>.png.
import { execFileSync } from 'node:child_process';
import { launch } from './browser.mjs';
const [tag = 'zfx', scenesArg = 'react,death,shoot,knife,hurt'] = process.argv.slice(2);
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
await page.mouse.click(480, 270);
const ev = (f, a) => page.evaluate(f, a);
const type = await ev(() => Object.keys(window.__gp.data.zombieDefs).find((k) => k.startsWith('pfz_')));
const base = await ev(() => {
  const g = window.__gp;
  g.ctx.player.godMode = true;
  g.data.horde.passive = true;
  g.ctx.zombies.clear();
  g.sandbox();
  const p = g.ctx.player.curr;
  return [p.x, p.z];
});
// Take over the loop: fixed steps, one render per step
await ev(() => {
  const r = window.__gp.ctx.game.renderer;
  window.__cb = r._animation._animationLoop;
  r.setAnimationLoop(null);
  window.__ft = performance.now();
});
const advance = (ms) => ev(async (ms) => {
  const n = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < n; i++) { window.__ft += 1000 / 60; window.__cb(window.__ft); }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}, ms);
const shot = (name) => page.screenshot({ path: `${out}${tag}_${name}.png` });
// sheet of crops (box x0,y0,x1,y1 in the 960x540 frame), one row
const CROP_PY = `import sys
from PIL import Image
out,box,fs=sys.argv[1],[int(v) for v in sys.argv[2].split(",")],sys.argv[3:]
ims=[Image.open(f).convert("RGB").crop(box) for f in fs]
W,H=ims[0].size
s=Image.new("RGB",(W*len(ims),H))
for i,im in enumerate(ims): s.paste(im,(i*W,0))
s.save(out)`;
const sheet = (name, files, box = '300,40,660,500') => {
  try { execFileSync('python', ['-c', CROP_PY, `${out}${tag}_${name}.png`, box, ...files.map((f) => `${out}${tag}_${f}.png`)]); } catch (e) { console.log('sheet failed', String(e).slice(0, 120)); }
};
/** Fresh zombie `dist` m in front of the player (player faces -z), standing idle. */
const fresh = (dist = 5, extra = {}) => ev(async ([t, x, z, dist, extra]) => {
  const g = window.__gp;
  g.ctx.zombies.clear();
  g.ctx.rig.override = null;
  g.teleport(x, z, 0);
  g.ctx.player.hp = 100;
  const zb = await g.ctx.zombies.spawn({ x, y: 0.05, z: z - dist }, Math.PI, t); // yaw PI: faces +z, toward the player
  const zz = g.ctx.zombies.list[g.ctx.zombies.list.length - 1];
  Object.assign(zz, extra);
  return !!zb;
}, [type, ...base, dist, extra]);
const sideCam = (side = 3.6, h = 1.0, lookH = 0.9, fwd = 0) => ev(([side, h, lookH, fwd]) => {
  const g = window.__gp, c = g.ctx.game.camera, z = g.ctx.zombies.list[0];
  const P = z.curr.clone();
  g.ctx.rig.override = () => {
    c.position.set(P.x + side, P.y + h, P.z + fwd);
    c.lookAt(P.x, P.y + lookH, P.z + fwd);
    if (c.fov !== 45) { c.fov = 45; c.updateProjectionMatrix(); }
    return true;
  };
}, [side, h, lookH, fwd]);
const hit = (zone, damage, extra = {}) => ev(([zone, damage, extra]) => {
  const g = window.__gp, z = g.ctx.zombies.list[0];
  const V = z.curr.constructor;
  z.yaw = z.prevYaw = Math.PI; // face the shooter (passive zombies wander)
  const h = zone === 'head' ? 1.62 : zone === 'limb' ? 0.55 : 1.15;
  const point = new V(z.curr.x + (extra.dx ?? 0), z.curr.y + h, z.curr.z + 0.15);
  const dir = new V(extra.dx ? -extra.dx : 0, 0, -1).normalize();
  const info = { point, dir, zone, damage, headMul: 1, weaponId: 'pistol_a', distance: extra.distance ?? 5, melee: extra.melee };
  g.ctx.fx.impact(point, dir.clone().negate(), 'flesh', dir, 1);
  return JSON.stringify(g.ctx.zombies.damage(z, info));
}, [zone, damage, extra]);
const strip = async (name, times) => {
  const files = [];
  let t0 = 0;
  for (const t of times) { await advance(t - t0); t0 = t; const f = `${name}_${t}`; await shot(f); files.push(f); }
  sheet(name, files);
};

for (const sc of scenes) try {
  if (sc === 'react') {
    for (const [name, zone, dmg, extra] of [
      ['body', 'body', 20, {}], ['bodyL', 'body', 20, { dx: 0.25 }], ['limb', 'limb', 20, {}], ['head', 'head', 30, {}], ['heavy', 'body', 45, {}],
      ['melee', 'body', 20, { melee: { stagger: 0, push: 0.3, hitstop: 0.05 }, distance: 1 }],
    ]) {
      await fresh(5); await advance(600); await sideCam();
      await advance(50);
      console.log('react', name, await hit(zone, dmg, extra));
      await strip(`react_${name}`, [17, 67, 133, 250, 400, 700]);
    }
  }
  if (sc === 'death') {
    for (const [name, zone, dist] of [['head', 'head', 5], ['body', 'body', 30], ['close', 'body', 5]]) {
      await fresh(5); await advance(600); await sideCam(4.2, 1.0, 0.6);
      await advance(50);
      if (name === 'close') await ev(() => { window.__gp.ctx.rand = ((r) => () => 0.1)(); }); // force the fling roll
      console.log('death', name, await hit(zone, 999, { distance: dist }));
      await strip(`death_${name}`, [50, 150, 300, 600, 1000, 2000]);
      await sideCam(2.2, 0.25, 0.15, -0.6); await advance(17); await shot(`death_${name}_low`);
    }
  }
  if (sc === 'shoot') {
    for (const mode of ['tp', 'fp']) for (const [slot, gun] of [[2, 'pistol'], [0, 'rifle']]) {
      await fresh(7); await ev(([mode, slot]) => { const g = window.__gp; g.ctx.rig.mode = mode; g.ctx.weapons.select(slot); }, [mode, slot]);
      await advance(900);
      await ev(() => window.__gp.faceZombie(1.2));
      await advance(50);
      await ev(() => window.__gp.mouse(0, true));
      const files = [];
      for (const t of [17, 33, 67, 133, 250]) { await advance(t === 17 ? 17 : t - [17, 33, 67, 133, 250][[17, 33, 67, 133, 250].indexOf(t) - 1]); const f = `shoot_${mode}_${gun}_${t}`; await shot(f); files.push(f); }
      await ev(() => window.__gp.mouse(0, false));
      // a few more shots, then look at the zombie's chest (wounds / decals) and the ground beside the player (casings)
      for (let i = 0; i < 4; i++) { await ev(() => { window.__gp.faceZombie(1.1); window.__gp.mouse(0, true); }); await advance(100); await ev(() => window.__gp.mouse(0, false)); await advance(150); }
      console.log(mode, gun, 'casings', await ev(() => { const g = window.__gp, c = g.ctx.fx.casings, py = g.ctx.player.curr.y, P = g.ctx.player.curr; const r = []; for (let i = 0; i < c.n; i++) if (c.life[i] > 0) r.push([+(c.pos[i * 3 + 1] - py).toFixed(3), +Math.hypot(c.pos[i * 3] - P.x, c.pos[i * 3 + 2] - P.z).toFixed(2)]); return JSON.stringify(r.slice(-6)); }));
      await advance(600);
      const f2 = `shoot_${mode}_${gun}_after`; await shot(f2); files.push(f2);
      sheet(`shoot_${mode}_${gun}`, files, '280,140,860,540');
      if (mode === 'tp') {
        await ev(() => { const g = window.__gp, c = g.ctx.game.camera, P = g.ctx.player.curr.clone(); g.ctx.rig.override = () => { c.position.set(P.x + 1.2, P.y + 1.6, P.z + 1.2); c.lookAt(P.x + 0.6, P.y, P.z); return true; }; });
        await advance(17); await shot(`shoot_${gun}_casings`);
        await ev(() => { window.__gp.ctx.rig.override = null; });
      }
    }
    await ev(() => { window.__gp.ctx.rig.mode = 'tp'; });
  }
  if (sc === 'knife') {
    for (const mode of ['tp', 'fp']) {
      await fresh(1.5); await ev((mode) => { const g = window.__gp; g.ctx.rig.mode = mode; g.ctx.weapons.select(3); }, mode);
      await advance(900); await ev(() => window.__gp.faceZombie(1.2)); await advance(50);
      await ev(() => window.__gp.mouse(0, true)); await advance(17); await ev(() => window.__gp.mouse(0, false));
      await strip(`knife_${mode}`, [100, 200, 267, 333, 450, 650]);
    }
    await ev(() => { window.__gp.ctx.rig.mode = 'tp'; });
  }
  if (sc === 'hurt') {
    for (const mode of ['tp', 'fp']) {
      await fresh(9); await ev((mode) => { const g = window.__gp; g.ctx.rig.mode = mode; g.ctx.weapons.select(0); }, mode);
      await advance(900);
      await ev(() => { const p = window.__gp.ctx.player; p.godMode = false; p.invulnT = 0; const f = p.position.clone(); f.x += 1.5; f.z -= 0.5; p.damage(20, f); p.godMode = true; });
      await strip(`hurt_${mode}`, [17, 100, 250, 500, 900]);
      await ev(() => { const p = window.__gp.ctx.player; p.godMode = false; p.hp = 18; p.invulnT = 0; const f = p.position.clone(); f.z -= 1; p.damage(5, f); p.godMode = true; });
      await advance(400); await shot(`hurt_${mode}_low`);
    }
    await ev(() => { window.__gp.ctx.rig.mode = 'tp'; window.__gp.ctx.player.hp = 100; });
  }
} catch (e) { console.log(sc, 'failed', String(e).slice(0, 300)); }
console.log('errors', JSON.stringify(errs.slice(0, 6)));
await browser.close();
