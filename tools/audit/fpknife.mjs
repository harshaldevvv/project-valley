// node tools/audit/fpknife.mjs [tag] #here   headless first-person knife strip at 60 Hz.
// The render loop is taken off requestAnimationFrame and driven by hand: one call = exactly one 1/60 s sim step + one
// render, then a screenshot. Sequence: idle, a light swing at the air, a light swing on a zombie (hit + hitstop), then
// (HEAVY=1) a heavy swing on it. Writes docs/audit/screenshots/wip/fpknife_<tag>_<seg>.png contact sheets and
// fpknife_<tag>.json per-frame numbers (camera space, m; -z forward):
//   tip / butt = blade point and grip end, edge = blade edge direction (unit), near = camera near plane,
//   minZ = closest knife / arm vertex to the eye (-z, must stay > near), clip = verts in front of the eye closer than near
//   inside the view, shot = one-shot clip @ authored time, phase = melee phase.
// Env: PORT (default 5214), HEAVY=1, KEEP=1 keeps the single frames.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { launch } from './browser.mjs';
const OUT = 'docs/audit/screenshots/wip';
const FR = `${OUT}/fpknife_frames`;
mkdirSync(FR, { recursive: true });
const tag = process.argv[2] ?? 'run';
const PORT = process.env.PORT ?? '5214';
const W = 640, H = 360;
const browser = await launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await page.goto(`http://localhost:${PORT}/?play`);
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 240000 });
await page.waitForTimeout(2000);
const gp = (f, a) => page.evaluate(f, a);

await gp(async () => {
  const g = window.__gp, c = g.ctx;
  c.player.godMode = true; g.data.horde.passive = true;
  g.sandbox(); c.rig.mode = 'fp';
  g.teleport(0, 0, 0); g.setLook(0, -0.05);
  c.weapons.select(3); // knife (sandbox slot 3)
  const cam = c.game.camera, V = cam.position.constructor;
  const vm = c.weapons.vm;
  // knife model root = child of SOCKET_knife; blade axis/edge from its geometry in root space
  const sock = vm.socket('knife');
  window.__kn = { sock, V };
  window.__probe = () => {
    const root = sock.children[0];
    const r = { phase: c.melee.phase, shot: vm.shot ? vm.shot.getClip().name.replace('fp_knife_', '') + '@' + vm.shot.time.toFixed(3) : '-', near: cam.near };
    if (!root) return r;
    root.updateWorldMatrix(true, true); cam.updateMatrixWorld(true);
    const inv = cam.matrixWorldInverse, v = new V();
    // knife verts in root space: farthest from the origin = tip; blade axis = tip dir; edge = thin side extreme
    if (!window.__kn.local) {
      const pts = [];
      root.traverse((o) => { if (o.isMesh) { const p = o.geometry.attributes.position; const m = o.matrixWorld.clone().premultiply(root.matrixWorld.clone().invert()); for (let i = 0; i < p.count; i++) pts.push(new V().fromBufferAttribute(p, i).applyMatrix4(m)); } });
      let tip = pts[0]; for (const p of pts) if (p.length() > tip.length()) tip = p;
      const ax = tip.clone().normalize();
      let butt = pts[0]; for (const p of pts) if (p.dot(ax) < butt.dot(ax)) butt = p;
      // blade = points past 40 % of the length; its cross-section: the long side is the edge-to-spine direction
      const L = tip.dot(ax), blade = pts.filter((p) => p.dot(ax) > 0.4 * L);
      const perp = (p) => p.clone().addScaledVector(ax, -p.dot(ax));
      let best = null, bl = 0;
      for (const d of [new V(1, 0, 0), new V(0, 1, 0), new V(0, 0, 1)]) { const q = perp(d); if (q.length() < 0.5) continue; q.normalize(); let lo = 1e9, hi = -1e9; for (const p of blade) { const s = p.dot(q); lo = Math.min(lo, s); hi = Math.max(hi, s); } if (hi - lo > bl) { bl = hi - lo; best = { q, lo, hi }; } }
      // the edge is the side where the blade is thin (fewer, sharper points): compare the cross width near each extreme
      const nrm = new V().crossVectors(ax, best.q).normalize();
      const width = (side) => { const s0 = side > 0 ? best.hi : best.lo, sel = blade.filter((p) => Math.abs(p.dot(best.q) - s0) < 0.25 * (best.hi - best.lo)); let a = 1e9, b = -1e9; for (const p of sel) { const s = p.dot(nrm); a = Math.min(a, s); b = Math.max(b, s); } return b - a; };
      const edge = width(1) < width(-1) ? best.q.clone() : best.q.clone().negate();
      window.__kn.local = { tip, butt, edge, len: L, pts: pts.length, wHi: width(1), wLo: width(-1), axis: ax.toArray().map((x) => +x.toFixed(2)) };
    }
    const K = window.__kn.local;
    const toCam = (p) => p.clone().applyMatrix4(root.matrixWorld).applyMatrix4(inv);
    const tip = toCam(K.tip), butt = toCam(K.butt);
    const edge = K.edge.clone().transformDirection(root.matrixWorld).transformDirection(inv);
    const f = (a) => a.toArray().map((x) => +x.toFixed(3));
    r.tip = f(tip); r.butt = f(butt); r.edge = edge.toArray().map((x) => +x.toFixed(2));
    // closest knife + arm vertex (skinned) to the eye, and near-plane clipping inside the frustum
    const tanY = Math.tan((cam.fov * Math.PI) / 360), tanX = tanY * cam.aspect;
    let minZ = 1e9, clip = 0, minArm = 1e9, armClip = 0;
    const test = (p, arm) => { const z = -p.z; if (z <= 0) return; const inView = Math.abs(p.x) < z * tanX * 1.02 + cam.near * tanX && Math.abs(p.y) < z * tanY * 1.02 + cam.near * tanY; if (!inView) return; if (arm) { minArm = Math.min(minArm, z); if (z < cam.near) armClip++; } else { minZ = Math.min(minZ, z); if (z < cam.near) clip++; } };
    root.traverse((o) => { if (o.isMesh) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) test(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv), false); } });
    vm.pivot.traverse((o) => { if (o.isSkinnedMesh && o.visible) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 2) { o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld).applyMatrix4(inv); test(v, true); } } });
    r.minZ = +minZ.toFixed(3); r.clip = clip; r.minArm = +minArm.toFixed(3); r.armClip = armClip;
    return r;
  };
});
await page.waitForTimeout(2500); // draw finishes

// manual loop: one frame = 1000/60 ms (+1 µs so float drift never drops a step) -> exactly one sim step per render
await gp(() => {
  const r = window.__gp.ctx.game.renderer, cb = r._animation._animationLoop;
  window.__cb = cb; r.setAnimationLoop(null);
  window.__t = performance.now(); cb(window.__t);
  // drain the accumulator's leftover from the last real frame: 1 ms nudges until a step lands (leftover then < 1 ms)
  for (let k = 0, t0 = window.__gp.ctx.game.tick; k < 20 && window.__gp.ctx.game.tick === t0; k++) { window.__t += 1; cb(window.__t); }
  window.__step = () => { const t0 = window.__gp.ctx.game.tick; window.__t += 1000 / 60 + 0.001; window.__cb(window.__t); return window.__gp.ctx.game.tick - t0; };
});

const rows = [];
let n = 0;
async function frames(seg, count, before) {
  const files = [];
  for (let i = 0; i < count; i++) {
    if (before) await before(i);
    const steps = await gp(() => window.__step());
    await gp(() => new Promise((res) => requestAnimationFrame(() => res()))); // let the canvas present
    const pr = await gp(() => window.__probe());
    const file = `${FR}/${tag}_${seg}_${String(i).padStart(3, '0')}.png`;
    await page.screenshot({ path: file });
    files.push(file);
    rows.push({ n: n++, seg, i, steps, ...pr });
  }
  execFileSync('python', ['tools/audit/sheet.py', `${OUT}/fpknife_${tag}_${seg}.png`, '8', '0.5', ...files]);
}
const press = (b) => gp((b) => window.__gp.mouse(b, true), b);
const release = (b) => gp((b) => window.__gp.mouse(b, false), b);
await frames('idle', 8);
await frames('air', 48, async (i) => { if (i === 0) await press(0); if (i === 1) await release(0); });
// zombie 1.1 m ahead, facing the player
await gp(async () => {
  const g = window.__gp, c = g.ctx, p = c.player, at = p.curr.clone();
  at.x += -Math.sin(p.yaw) * 1.1; at.z += -Math.cos(p.yaw) * 1.1;
  const z = await c.zombies.spawn(at, p.yaw + Math.PI, 'shambler');
  window.__z = z;
});
await frames('settle', 1);
await gp(() => { window.__gp.faceZombie(1.3); });
await frames('hit', 56, async (i) => { if (i === 0) await press(0); if (i === 1) await release(0); });
if (process.env.HEAVY) await frames('heavy', 72, async (i) => { if (i === 0) await press(2); if (i === 1) await release(2); });

const K = await gp(() => ({ ...window.__kn.local, tip: window.__kn.local.tip.toArray(), butt: window.__kn.local.butt.toArray(), edge: window.__kn.local.edge.toArray() }));
writeFileSync(`${OUT}/fpknife_${tag}.json`, JSON.stringify({ knife: K, rows }, null, 0));
console.log('knife (root space):', JSON.stringify(K));
console.log('n seg i steps phase shot | tip(x,y,z) | edge | minZ knife/arm | clip knife/arm');
for (const r of rows) console.log(r.n, r.seg, r.i, r.steps, r.phase, r.shot, '|', r.tip?.join(','), '|', r.edge?.join(','), '|', r.minZ, r.minArm, 'near', r.near, '|', r.clip, r.armClip);
const bad = rows.filter((r) => r.steps !== 1);
console.log('frames without exactly one sim step:', bad.length, 'clipping frames:', rows.filter((r) => r.clip || r.armClip).length);
console.log('errors', JSON.stringify(errs.slice(0, 4)));
if (!process.env.KEEP) rmSync(FR, { recursive: true, force: true });
await browser.close();
