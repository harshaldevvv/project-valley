// node tools/audit/fphandprobe.mjs <gunDefId> #here   headless: first-person left hand vs the gun's support socket (camera space, m),
// then the same view with the gun meshes hidden -> docs/audit/screenshots/wip/probe_fp_on.png / probe_fp_off.png
import { launch } from './browser.mjs';
const gun = process.argv[2] || 'rifle_a';
const MAG = { pistol_a: 'mag_pistol_a', rifle_a: 'mag_rifle_a', shotgun_a: 'mag_shotgun_a', bolt_a: 'mag_bolt_a', revolver_a: 'mag_revolver_a', smg_a: 'mag_smg_a' };
const b = await launch();
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2000);
if (process.env.NOIK) await page.evaluate(() => { window.__noIK = 1; });
await page.evaluate(([gun, mag]) => {
  const g = window.__gp; g.ctx.player.godMode = true; g.sandbox(); if (window.__noIK) { const vm = g.ctx.weapons.vm; vm.__lh = vm.leftHand; vm.leftHand = () => {}; }
  const lo = g.ctx.weapons.loadout, eq = lo.equipped;
  const it = { uid: 9e6, defId: gun, count: 1, durability: 1, rounds: 1, mag: { uid: 9e6 + 1, defId: mag, count: 1, rounds: 5 } };
  lo.equipped = (k) => (k === 'secondary' ? it : eq(k));
  g.ctx.weapons.select(1); g.ctx.rig.mode = 'fp'; g.teleport(0, 0, 0); g.setLook(0, -0.05);
}, [gun, MAG[gun]]);
await page.waitForTimeout(2200);
const D = 'docs/audit/screenshots/wip/';
await page.screenshot({ path: D + 'probe_fp_on.png' });
console.log(JSON.stringify(await page.evaluate((id) => {
  const vm = window.__gp.ctx.weapons.vm, cam = window.__gp.ctx.game.camera, V = cam.position.constructor;
  const loc = (o) => { const v = o.getWorldPosition(new V()); cam.worldToLocal(v); return v.toArray().map((x) => +x.toFixed(3)); };
  const sl = vm.sockets.get('support_L'), root = vm.weaponRoots.get(id), s = vm.support.get(id);
  const r = { held: window.__gp.ctx.weapons.item?.defId, kind: vm.kind, supportL: loc(sl), handL: loc(sl.parent), elbowL: loc(sl.parent.parent), gunSupport: s ? loc(s) : null, grip: root ? loc(root) : null, shot: vm.shot?.getClip().name ?? null, shotW: +vm.shotW.toFixed(2), leftOnly: vm.leftOnly, idleW: vm.idle?.getEffectiveWeight(), idleNoLW: vm.idleNoL?.getEffectiveWeight(), hasSupport: !!s };
  r.tracks = vm.clips.get('fp_rifle_idle').tracks.map((t) => t.name).filter((n) => /_L/.test(n)).join(' '); r.active = vm.mixer._actions.filter((a) => a.isRunning() && a.getEffectiveWeight() > 0.001).map((a) => a.getClip().name + ':' + a.getEffectiveWeight().toFixed(2) + '@' + a.time.toFixed(2)); vm.mixer.update(0); r.clipHand = loc(sl.parent); r.clipSup = loc(sl); (vm.__lh ?? vm.leftHand).call(vm, id, 0); r.ikHand = loc(sl.parent); const dd = vm.dbg; if (dd) { const tl = dd.target.clone(); cam.worldToLocal(tl); r.dbgTarget = tl.toArray().map((x) => +x.toFixed(3)); r.dbgShift = dd.shift.toArray().map((x) => +x.toFixed(3)); } r.ikSup = loc(sl); r.ikElbow = loc(sl.parent.parent); r.shoulder = loc(sl.parent.parent.parent);
  const rs = root.getWorldScale(new V()); r.rootScale = rs.toArray().map((x) => +x.toFixed(3));
  const rp = new V(0, 0.082, -0.327).applyMatrix4(root.matrixWorld); cam.worldToLocal(rp); r.refPt = rp.toArray().map((x) => +x.toFixed(3));
  const ax = new V(0, 0, -1).transformDirection(root.matrixWorld).transformDirection(cam.matrixWorldInverse); r.rootFwd = ax.toArray().map((x) => +x.toFixed(2));
  vm.pivot.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) o.visible = false; });
  return r;
}, gun)));
await page.waitForTimeout(200);
await page.screenshot({ path: D + 'probe_fp_off.png' });
console.log('errors', JSON.stringify(errs.slice(0, 4)));
await b.close();
