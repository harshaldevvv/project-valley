// node tools/audit/tpfire.mjs [tag] [guns] #here   headless third-person fire strip at 60 Hz, 960x540.
// Same frame-stepped loop as fpknife.mjs: one call = exactly one 1/60 s sim step + one render, then a screenshot.
// Per gun: 'hip' = tap fire from the low-ready carry (the first shot), 'ads' = RMB held until raised, then a tap.
// Writes docs/audit/screenshots/wip/tpfire_<tag>_<gun>_<seg>.png contact sheets and tpfire_<tag>.json, and prints per frame:
//   fired = shots fired so far, raise = carry raise 0..1, flash = flash mesh visible, muz = rendered TP muzzle on screen (px),
//   occ = the hero's skinned meshes cover the line camera -> muzzle (flash hidden behind the body).
// Env: SX / SY / ARM override cameraFeel.shoulderX / shoulderY / armHip for the run, PORT (default 5231), KEEP=1 keeps the single frames, N (frames per segment, default 16).
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { launch } from './browser.mjs';
const OUT = 'docs/audit/screenshots/wip';
const FR = `${OUT}/tpfire_frames`;
mkdirSync(FR, { recursive: true });
const tag = process.argv[2] ?? 'run';
const GUNS = (process.argv[3] || 'pistol_a,revolver_a,smg_a,rifle_a,shotgun_a,bolt_a').split(',');
const MAG = { pistol_a: 'mag_pistol_a', rifle_a: 'mag_rifle_a', shotgun_a: 'mag_shotgun_a', bolt_a: 'mag_bolt_a', revolver_a: 'mag_revolver_a', smg_a: 'mag_smg_a' };
const PORT = process.env.PORT ?? '5231';
const N = +(process.env.N ?? 16);
const W = 960, H = 540;
const browser = await launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await page.goto(`http://localhost:${PORT}/?play`);
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 240000 });
await page.waitForTimeout(2000);
const gp = (f, a) => page.evaluate(f, a);

await gp((v) => { window.__CF = v; }, { shoulderX: process.env.SX, shoulderY: process.env.SY, armHip: process.env.ARM });
await gp(() => {
  const g = window.__gp, c = g.ctx;
  c.player.godMode = true; g.data.horde.passive = true;
  g.sandbox(); c.rig.mode = 'tp';
  for (const [k, v] of Object.entries(window.__CF)) if (v) g.data.cameraFeel[k] = +v;
  g.teleport(0, 0, 0); g.setLook(0, -0.02);
  const lo = c.weapons.loadout, eq = lo.equipped.bind(lo);
  window.__held = null;
  lo.equipped = (k) => (k === 'secondary' && window.__held ? window.__held : eq(k));
  const cam = c.game.camera, V = cam.position.constructor;
  window.__probe = () => {
    const w = c.weapons, m = w.models.get(w.item?.defId);
    const r = { fired: w.shotsFired, raise: +w.raiseT.toFixed(2), ads: +w.adsT.toFixed(2), flash: c.fx.flash.visible };
    if (!m) return r;
    cam.updateMatrixWorld(true); c.playerChar.root.updateWorldMatrix(true, true);
    const muz = m.tp.muzzle.getWorldPosition(new V());
    const s = muz.clone().project(cam);
    r.muz = [Math.round((s.x * 0.5 + 0.5) * innerWidth), Math.round((-s.y * 0.5 + 0.5) * innerHeight)];
    // does the hero body cover the muzzle? ray camera -> muzzle against the skinned meshes (bounds refreshed per frame)
    const dir = muz.clone().sub(cam.position), dist = dir.length();
    dir.normalize();
    const RC = window.__RC;
    let occ = false;
    c.playerChar.root.traverse((o) => {
      if (occ || !o.isSkinnedMesh || !o.visible) return;
      o.computeBoundingSphere(); o.computeBoundingBox?.();
      const hits = [];
      RC.set(cam.position, dir); RC.far = dist - 0.02;
      o.raycast(RC, hits);
      if (hits.length) { const L = c.playerChar.root.worldToLocal(hits[0].point.clone()); occ = (o.name || 'mesh').replace('chr_hero_pf_', '') + '@' + L.toArray().map((x) => x.toFixed(2)).join(','); }
    });
    r.occ = occ;
    r.muzL = c.playerChar.root.worldToLocal(muz.clone()).toArray().map((x) => +x.toFixed(2));
    const rl = c.playerChar.root.worldToLocal(m.tp.root.getWorldPosition(new V())); r.gunDirDeg = +(Math.atan2(r.muzL[0] - rl.x, -(r.muzL[2] - rl.z)) * 57.3).toFixed(1); r.rootL = rl.toArray().map((x) => +x.toFixed(2));
    return r;
  };
});
// three's Raycaster from the page's module graph
await gp(async () => { const T = await import('/node_modules/three/build/three.webgpu.js'); window.__RC = new T.Raycaster(); });

async function equip(gun) {
  await gp(([gun, mag]) => {
    const c = window.__gp.ctx;
    window.__held = { uid: 9e6 + Math.floor(Math.random() * 1e5), defId: gun, count: 1, durability: 1, rounds: 1, mag: { uid: 9e6 + 5e5, defId: mag, count: 1, rounds: 30 } };
    c.weapons.select(0); c.weapons.select(1);
  }, [gun, MAG[gun]]);
  await page.waitForTimeout(2500); // draw + lower back to low-ready
}

let loopOn = false;
async function manual() {
  if (loopOn) return;
  loopOn = true;
  await gp(() => {
    const r = window.__gp.ctx.game.renderer, cb = window.__cb ?? r._animation._animationLoop;
    window.__cb = cb; r.setAnimationLoop(null);
    window.__t = Math.max(window.__t ?? 0, performance.now()); cb(window.__t);
    for (let k = 0, t0 = window.__gp.ctx.game.tick; k < 20 && window.__gp.ctx.game.tick === t0; k++) { window.__t += 1; cb(window.__t); }
    window.__step = () => { const t0 = window.__gp.ctx.game.tick; window.__t += 1000 / 60 + 0.001; window.__cb(window.__t); return window.__gp.ctx.game.tick - t0; };
  });
}
async function real() {
  if (!loopOn) return;
  loopOn = false;
  await gp(() => { const r = window.__gp.ctx.game.renderer; r.setAnimationLoop(window.__cb); });
}

const rows = [];
async function frames(gun, seg, count, before) {
  const files = [];
  for (let i = 0; i < count; i++) {
    if (before) await before(i);
    const steps = await gp(() => window.__step());
    await gp(() => new Promise((res) => requestAnimationFrame(() => res())));
    const pr = await gp(() => window.__probe());
    const file = `${FR}/${tag}_${gun}_${seg}_${String(i).padStart(3, '0')}.png`;
    await page.screenshot({ path: file });
    files.push(file);
    rows.push({ gun, seg, i, steps, ...pr });
  }
  execFileSync('python', ['tools/audit/sheet.py', `${OUT}/tpfire_${tag}_${gun}_${seg}.png`, '8', '0.5', ...files]);
  // close-up strip: the hero and the gun at full resolution (first 8 frames)
  if (count > 1) {
    const crops = [];
    for (const f of files.slice(0, 8)) { const c = f.replace('.png', '_c.png'); await sharp(f).extract({ left: 260, top: 170, width: 360, height: 300 }).toFile(c); crops.push(c); }
    execFileSync('python', ['tools/audit/sheet.py', `${OUT}/tpfire_${tag}_${gun}_${seg}_crop.png`, '8', '1', ...crops]);
  }
}
const press = (b) => gp((b) => window.__gp.mouse(b, true), b);
const release = (b) => gp((b) => window.__gp.mouse(b, false), b);

for (const gun of GUNS) {
  await real();
  await equip(gun);
  await manual();
  await frames(gun, 'hip', N, async (i) => { if (i === 0) await press(0); if (i === 1) await release(0); });
  // ADS: hold RMB ~0.5 s (raise + ads), then a tap
  await frames(gun, 'adsin', 1, async () => { await press(2); await gp(() => { window.__gp.ctx.weapons.cooldown = 0; }); for (let k = 0; k < 30; k++) await gp(() => window.__step()); });
  await frames(gun, 'ads', N, async (i) => { if (i === 0) await press(0); if (i === 1) await release(0); });
  await release(2);
  rmSync(`${OUT}/tpfire_${tag}_${gun}_adsin.png`, { force: true });
  await gp(() => { window.__gp.ctx.weapons.cooldown = 0; });
}
await real();
writeFileSync(`${OUT}/tpfire_${tag}.json`, JSON.stringify(rows));
console.log('gun seg i steps fired raise ads flash muz occ');
for (const r of rows) if (r.seg !== 'adsin') console.log(r.gun, r.seg, r.i, r.steps, r.fired, r.raise, r.ads, r.flash ? 'FLASH' : '-', r.muz?.join(','), r.occ || '-', 'muzL', r.muzL?.join(','), 'root', r.rootL?.join(','), 'yaw', r.gunDirDeg);
for (const gun of GUNS) for (const seg of ['hip', 'ads']) {
  const rs = rows.filter((r) => r.gun === gun && r.seg === seg);
  const before = rows[rows.indexOf(rs[0]) - 1]?.fired ?? 0;
  const shot = rs.findIndex((r) => r.fired > before);
  const fl = rs.filter((r) => r.flash), hid = fl.filter((r) => r.occ);
  console.log(`${gun} ${seg}: shot leaves on frame ${shot} (press on 0), flash frames ${fl.map((r) => r.i).join(' ')} hidden ${hid.length}/${fl.length}`);
}
console.log('frames without exactly one sim step:', rows.filter((r) => r.steps !== 1).length);
console.log('errors', JSON.stringify(errs.slice(0, 4)));
if (!process.env.KEEP) rmSync(FR, { recursive: true, force: true });
await browser.close();
