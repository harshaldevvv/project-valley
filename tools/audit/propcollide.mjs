// node tools/audit/propcollide.mjs [chunkRegex]   headless: every Placed model the outskirts builder places (PLACED, FILL, building
// furniture and container models) is probed against the Rapier world. The model's own triangles between 0.15 and 1.3 m (legs
// and hips) are binned into 0.3 m cells; a cell counts as covered when a static collider lies within 0.15 m of it. Lists props over
// 0.4 m tall with under 60% of cells covered (cov = covered/cells): what the player walks through. Then every full-height doorway
// (partitions too) gets a box 0.8 m deep each side, 0.25 m in from the jambs; any static collider in it is a blocked door lane.
// `node propcollide.mjs bld:` = building furniture only. Needs the dev server on 5188.
import { launch } from './browser.mjs';
const filter = process.argv[2] ?? '';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.routeWebSocket(/.*/, () => {});
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 240000 });
await page.waitForTimeout(1500);
const r = await page.evaluate(async (filter) => {
  const O = await import('/src/content/data/outskirts.ts');
  const { FILL } = await import('/src/content/data/outskirts_fill.ts');
  const { poiSpots } = await import('/src/content/data/pois.ts');
  const { buildBuilding } = await import('/src/world/outskirts/buildings.ts');
  const { loadPfm } = await import('/src/world/outskirts/models.ts');
  const items = [...O.PLACED.map((p) => ({ ...p, src: 'placed' })), ...FILL.map((p) => ({ ...p, src: 'fill' }))];
  const ctx = { cuboid() {}, region() {} };
  for (const b of O.BUILDINGS) for (const it of buildBuilding(b, ctx).items) items.push({ ...it, src: `bld:${b.id}` });
  for (const sp of poiSpots) if (sp.model && !sp.building) items.push({ chunk: sp.poi, k: sp.model, x: sp.x, z: sp.z, yaw: sp.yaw, y: sp.y, src: `spot:${sp.id}` });
  const { R, world } = window.__gp.ctx.game.phys;
  const rot = { x: 0, y: 0, z: 0, w: 1 };
  const isStatic = (c) => { const b = c.parent(); return !b || b.isFixed(); };
  // occupancy of a model in its own frame: points on its triangles between 0.15 and 1.3 m (the player's legs and hips), 0.3 m cells
  const occ = new Map();
  const cellsOf = (m) => {
    if (occ.has(m)) return occ.get(m);
    const pos = m.geo.getAttribute('position').array, cells = new Map();
    const put = (x, y, z) => { if (y < 0.15 || y > 1.3) return; const key = `${Math.round(x / 0.3)},${Math.round(z / 0.3)}`; const c = cells.get(key); if (c) c[3]++; else cells.set(key, [Math.round(x / 0.3) * 0.3, y, Math.round(z / 0.3) * 0.3, 1]); };
    for (let i = 0; i < pos.length; i += 9) {
      for (const [a, b, c] of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1 / 3, 1 / 3, 1 / 3], [0.5, 0.5, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.7, 0.15, 0.15], [0.15, 0.7, 0.15], [0.15, 0.15, 0.7]]) {
        put(a * pos[i] + b * pos[i + 3] + c * pos[i + 6], a * pos[i + 1] + b * pos[i + 4] + c * pos[i + 7], a * pos[i + 2] + b * pos[i + 5] + c * pos[i + 8]);
      }
    }
    const list = [...cells.values()];
    occ.set(m, list);
    return list;
  };
  const probe = new R.Ball(0.15);
  const near = (x, y, z) => { let hit = false; world.intersectionsWithShape({ x, y, z }, rot, probe, (c) => { if (isStatic(c) && !c.isSensor()) { hit = true; return false; } return true; }); return hit; };
  const out = [];
  const re = new RegExp(filter);
  for (const p of items) {
    if (filter && !re.test(p.chunk) && !re.test(p.src)) continue;
    const m = await loadPfm(p.k);
    if (!m) { out.push({ k: p.k, src: p.src, chunk: p.chunk, x: p.x, z: p.z, cov: -1, note: 'missing model' }); continue; }
    const s = p.s ?? 1, y0 = p.y ?? 0;
    if (m.size.y * s < 0.4 || Math.max(m.size.x, m.size.z) * s < 0.35) continue;
    const c = Math.cos(p.yaw), sn = Math.sin(p.yaw);
    const cells = cellsOf(m).filter((q) => q[1] * s >= 0.15 && q[1] * s <= 1.3);
    if (cells.length < 2) continue;
    let hit = 0;
    for (const [lx0, ly, lz0] of cells) {
      const lx = lx0 * s, lz = lz0 * s;
      if (near(p.x + lx * c + lz * sn, y0 + ly * s, p.z - lx * sn + lz * c)) hit++;
    }
    const cov = hit / cells.length;
    if (cov < 0.6) out.push({ k: p.k, src: p.src, chunk: p.chunk, x: +p.x.toFixed(1), z: +p.z.toFixed(1), h: +(m.size.y * s).toFixed(2), w: +(m.size.x * s).toFixed(2), d: +(m.size.z * s).toFixed(2), cov: +cov.toFixed(2), n: cells.length, solid: p.solid, boxes: !!p.boxes, shrink: p.shrink });
  }
  // door lanes: a box through every full-height opening (walls, partition, dividers), 0.8 m deep each side, inset 0.25 m from the jambs
  const { buildingWorld } = await import('/src/content/data/pois.ts');
  const doors = [];
  for (const b of O.BUILDINGS) {
    const hw = b.w / 2, hd = b.d / 2, T = 0.2;
    const lanes = [];
    for (const o of b.front) lanes.push(['front', o.u, hd - T / 2, 'u', o]);
    for (const o of b.back) lanes.push(['back', o.u, -hd + T / 2, 'u', o]);
    for (const o of b.left) lanes.push(['left', -hw + T / 2, o.u, 'v', o]);
    for (const o of b.right) lanes.push(['right', hw - T / 2, o.u, 'v', o]);
    if (b.partition) for (const o of b.partition.open) lanes.push(['partition', o.u, b.partition.v, 'u', o]);
    for (const dv of b.dividers ?? []) for (const o of dv.open) lanes.push(['divider', dv.u, o.u, 'v', o]);
    for (const [wall, cu, cv, along, o] of lanes) {
      if (o.sill > 0.05 || o.w < 0.8 || (b.kind === 'shed' && wall === 'front')) continue; // open-fronted sheds have eave posts
      const half = Math.min(o.w / 2 - 0.25, 1.2); // wide openings: check the middle 2.4 m
      const [hu, hv] = along === 'u' ? [half, 0.8] : [0.8, half];
      const w = buildingWorld(b, cu, cv);
      const q = { x: 0, y: Math.sin(b.yaw / 2), z: 0, w: Math.cos(b.yaw / 2) };
      const hits = [];
      world.intersectionsWithShape({ x: w.x, y: 0.9, z: w.z }, q, new R.Cuboid(hu, 0.6, hv), (c) => { if (isStatic(c) && !c.isSensor()) { const t = c.translation(), dx = t.x - b.x, dz = t.z - b.z; hits.push(`local (${(dx * Math.cos(b.yaw) - dz * Math.sin(b.yaw)).toFixed(2)}, ${(dx * Math.sin(b.yaw) + dz * Math.cos(b.yaw)).toFixed(2)})`); } return true; });
      if (hits.length) doors.push(`${b.id} ${wall} door u=${o.u} w=${o.w}: blocked by colliders at ${hits.slice(0, 4).join(' ')}`);
    }
  }
  return { total: items.length, out, doors };
}, filter);
console.log(`props checked: ${r.total}; walk-through candidates: ${r.out.length}`);
const by = {};
for (const o of r.out) (by[o.src.startsWith('bld:') ? o.src : o.chunk] ??= []).push(o);
for (const [g, list] of Object.entries(by)) {
  console.log(`== ${g}`);
  for (const o of list) console.log(`  ${o.k.padEnd(30)} (${o.x}, ${o.z}) h${o.h} ${o.w}x${o.d} cov ${o.cov}/${o.n}${o.shrink ? ' shrink' + o.shrink : ''}${o.solid === false ? ' solid:false' : ''}${o.boxes ? ' boxes' : ''}${o.note ? ' ' + o.note : ''}`);
}
console.log(`== blocked door lanes: ${r.doors.length}`);
for (const d of r.doors) console.log(`  ${d}`);
await browser.close();
