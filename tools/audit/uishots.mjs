// node tools/audit/uishots.mjs [before|after] [port]   headless UI audit: inventory (Tab), tooltip, drag, crafting (G), map (K), HUD, dialogue + trade, note + radio cards, pause menu and death screen
// with a realistic loadout, at 1280x720 and 1920x1080. Writes docs/audit/screenshots/wip/ui_<stage>_<shot>_<w>.png and a
// contact sheet ui_<stage>_sheet_<w>.png. One headless browser, never visible, no pointer lock. Run your own dev server
// (npx vite --port 5195 --strictPort) so the owner's :5188 is untouched.
import { readFileSync, existsSync } from 'node:fs';
import { launch } from './browser.mjs';

const stage = process.argv[2] ?? 'after';
const port = process.argv[3] ?? '5195';
const out = 'docs/audit/screenshots/wip/';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.routeWebSocket(/.*/, () => {}); // other sessions' edits must not hot-reload this run
await page.goto(`http://localhost:${port}/?play`);
await page.waitForFunction(() => window.__gp && window.__craft && window.__gp.ctx.game.tick > 30, null, { timeout: 240000 });
await page.waitForTimeout(1500);

// ---------- realistic loadout: worn rucksack + vest, guns with mags, mixed stacks, damaged weapons ----------
console.log('loadout', await page.evaluate(() => {
  const g = window.__gp, lo = g.ctx.game.loadout;
  g.ctx.player.godMode = true;
  lo.equipment.backpack = null; // swap the starter pack for a real military rucksack (proper grids + pockets)
  g.give('rucksack_military');
  for (const id of ['flannel_shirt', 'rifle_a', 'pistol_a', 'crowbar_a']) g.give(id);
  const give = (id, n = 1) => { for (let i = 0; i < n; i++) g.give(id); };
  give('mag_rifle_a', 3); give('mag_pistol_a', 2); give('bandage', 3); give('cloth_rag', 7); give('canned_soup', 2);
  give('water_bottle', 2); give('dirty_water', 1); give('antiseptic', 1); give('nails', 14); give('wood_planks', 3);
  give('lighter', 1); give('battery', 2); give('flashlight_a', 1); give('baseball_bat', 1); give('hammer_a', 1);
  give('multitool', 1); give('purification_tablets', 2); give('radio_handheld', 1); give('binoculars', 1); give('knife_a', 1);
  // wear some weapons down so the tooltip and the repair recipe have something to show
  for (const { grid } of lo.playerGrids()) for (const { item: it } of grid.contents) if (it.defId === 'baseball_bat' || it.defId === 'pistol_a') it.durability = 0.42;
  for (const s of ['melee', 'sidearm']) if (lo.equipment[s]) lo.equipment[s].durability = 0.42;
  lo.changed();
  // a tracked quest that points at a place, for the map's quest marker
  const q = window.__quests?.quests;
  if (q) { q.state.maple = { ...(q.state.maple ?? {}), status: 'active', step: 0, n: 0 }; q.tracked = 'maple'; }
  return Object.entries(lo.equipment).filter(([, v]) => v).map(([k, v]) => `${k}:${v.defId}`).join(' ');
}));

const sizes = [[1280, 720], [1920, 1080]];
const shots = [];
const snap = async (name, w) => {
  const p = `${out}ui_${stage}_${name}_${w}.png`;
  await page.screenshot({ path: p });
  shots.push([name, w, p]);
};
const key = async (code) => { await page.keyboard.press(code); await page.waitForTimeout(450); };
const report = {};

for (const [w, h] of sizes) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(600);
  // ---- inventory
  await key('Tab');
  await snap('inv', w);
  const tile = await page.$('.inv-player .inv-item.has-icon');
  if (tile) {
    const b = await tile.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(250);
    await snap('inv_tip', w);
    // equipped weapon tooltip (durability row)
    const eq = await page.$('.inv-slot[data-slot="melee"] .inv-item');
    if (eq) {
      const e = await eq.boundingBox();
      await page.mouse.move(e.x + e.width / 2, e.y + e.height / 2);
      await page.waitForTimeout(250);
      await snap('inv_tip_eq', w);
    }
    // drag feedback: lift the item and hover it over an equipment slot it can't go into
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    const slot = await page.$('.inv-slot[data-slot="head"]');
    const sb = slot && (await slot.boundingBox());
    if (sb) await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2, { steps: 8 });
    await page.waitForTimeout(200);
    await snap('inv_drag', w);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await page.waitForTimeout(200);
  }
  report[`inv_overflow_${w}`] = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('.inv-root:not([hidden]) .inv-item .n, .inv-root:not([hidden]) h2, .inv-root:not([hidden]) h3')) {
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow !== 'ellipsis') bad.push(el.textContent.slice(0, 30));
    }
    const r = document.querySelector('.inv-root:not([hidden]) .inv-wrap')?.getBoundingClientRect();
    return { clipped: bad.slice(0, 8), wrapFits: r ? r.right <= innerWidth && r.bottom <= innerHeight : null };
  });
  await page.mouse.move(5, 5);
  if (await page.evaluate(() => !document.querySelector('.inv-root:not(.cr-root):not(.qj-root):not(.map-root)')?.hidden)) await key('Tab');

  // ---- crafting
  await key('KeyG');
  await snap('craft', w);
  // a recipe that can't be made yet: the disabled reason must read without hovering
  await page.evaluate(() => {
    const row = document.querySelector('.cr-row.no');
    row?.click();
  });
  await page.waitForTimeout(250);
  await snap('craft_missing', w);
  // keyboard: arrow down twice then Tab-category switch
  await key('ArrowDown');
  await key('ArrowDown');
  await key('KeyE');
  await snap('craft_keys', w);
  report[`craft_${w}`] = await page.evaluate(() => ({
    sel: document.querySelector('.cr-row.sel b')?.textContent,
    tab: document.querySelector('.cr-tabs button.on')?.textContent,
    reason: document.querySelector('.cr-why')?.textContent ?? null,
  }));
  await key('KeyG');

  // ---- map
  await page.evaluate(() => window.__map?.discover(['checkpoint', 'fuel', 'maple', 'school', 'farm', 'diner', 'bus', 'memorial']));
  await key('KeyK');
  await snap('map', w);
  report[`map_${w}`] = await page.evaluate(() => ({
    open: !!document.querySelector('.map-root:not([hidden])'),
    pois: document.querySelectorAll('.map-poi').length,
    quest: !!document.querySelector('.map-quest'),
    player: !!document.querySelector('.map-player'),
  }));
  if (report[`map_${w}`].open) await key('KeyK');

  // ---- HUD in play: hurt, tracked quest, toasts (pickup / refusal / plain), interaction prompt, hotbar
  await page.evaluate(() => {
    const c = window.__gp.ctx;
    c.player.hp = c.player.maxHp * 0.42;
    Object.defineProperty(c.interact, 'promptText', { configurable: true, get: () => 'Search kitchen cabinet', set() {} });
    const ev = c.game.events;
    ev.emit('toast', { text: '+ Bandage ×2', icon: 'bandage' });
    ev.emit('toast', { text: '+ Rifle magazine', icon: 'mag_rifle_a' });
    ev.emit('toast', { text: '✕ No room in your pack' });
    ev.emit('toast', { text: 'Nothing in secondary' });
  });
  await page.waitForTimeout(500);
  await snap('hud', w);
  report[`hud_${w}`] = await page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect();
    const hit = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const qt = r('.qt'), bars = r('.hud .bars'), ammo = r('.hud .ammo'), toasts = r('.hud .toasts'), hb = r('.hud .hb');
    return { trackerOverToasts: !!hit(qt, toasts), hotbar: !!hb, hotbarOverBars: !!hit(hb, bars), hotbarOverAmmo: !!hit(hb, ammo) };
  });
  await page.evaluate(() => {
    const c = window.__gp.ctx;
    delete c.interact.promptText;
    c.interact.promptText = null;
    c.player.hp = c.player.maxHp;
    for (const t of document.querySelectorAll('.hud .toasts > div')) t.remove();
  });

  // ---- dialogue (trader), hover on an answer, then the trade screen
  await page.evaluate(() => window.__npc?.talk('odell'));
  await page.waitForTimeout(400);
  const ch = await page.$('.dlg-choice');
  if (ch) {
    const b = await ch.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  }
  await page.waitForTimeout(200);
  await snap('dlg', w);
  await page.mouse.move(5, 5);
  report[`dlg_${w}`] = await page.evaluate(() => {
    const b = document.querySelector('.dlg:not([hidden]) .dlg-box')?.getBoundingClientRect();
    return { open: !!b, fits: b ? b.bottom <= innerHeight && b.top >= 0 : null, choices: document.querySelectorAll('.dlg-choice').length };
  });
  const tradeIdx = await page.evaluate(() => [...document.querySelectorAll('.dlg-choice')].findIndex((e) => /trade|buy|deal/i.test(e.textContent)));
  if (tradeIdx >= 0) await key(`Digit${tradeIdx + 1}`);
  else await page.evaluate(() => window.__npc?.ui.openTrade(window.__gp.ctx.game.loadout, window.__npc.trader));
  await page.waitForTimeout(300);
  const bb = await page.$('.tr-root:not([hidden]) .tr-btn:not(:disabled)');
  if (bb) {
    const b = await bb.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  }
  await page.waitForTimeout(200);
  await snap('trade', w);
  await page.mouse.move(5, 5);
  report[`trade_${w}`] = await page.evaluate(() => {
    const root = document.querySelector('.tr-root:not([hidden])');
    if (!root) return { open: false };
    const bad = [...root.querySelectorAll('.tr-name b, h2, .tr-btn')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow !== 'ellipsis').map((e) => e.textContent.slice(0, 30));
    const r = root.querySelector('.tr-wrap').getBoundingClientRect();
    return { open: true, clipped: bad.slice(0, 8), fits: r.right <= innerWidth && r.bottom <= innerHeight, rows: root.querySelectorAll('.tr-row').length };
  });
  await key('Escape');
  if (await page.evaluate(() => window.__npc?.ui.isOpen)) await page.evaluate(() => window.__npc.ui.closeAll());

  // ---- note card and radio card
  await page.evaluate(() => window.__gp.ctx.game.events.emit('itemUsed', { defId: 'note_maple_sick', use: { action: 'read' } }));
  await page.waitForTimeout(500);
  await snap('note', w);
  report[`note_${w}`] = await page.evaluate(() => {
    const b = document.querySelector('.note-card.on')?.getBoundingClientRect();
    return b ? { fits: b.bottom <= innerHeight, h: Math.round(b.height) } : { open: false };
  });
  await page.evaluate(() => document.querySelector('.note-card')?.classList.remove('on'));
  await page.evaluate(() => window.__gp.ctx.game.events.emit('itemUsed', { defId: 'radio_handheld', use: { action: 'radio' } }));
  await page.waitForTimeout(500);
  await snap('radio', w);
  await page.evaluate(() => document.querySelector('.radio-card')?.classList.remove('on'));

  // ---- pause menu (Esc), keyboard focus on the second entry
  await key('Escape');
  await key('ArrowDown');
  await snap('pause', w);
  report[`pause_${w}`] = await page.evaluate(() => ({
    open: !!document.querySelector('#menu.is-paused:not(.hidden)'),
    focused: document.activeElement?.dataset?.act ?? document.activeElement?.tagName,
  }));
  if (report[`pause_${w}`].open) await key('Escape');
  await page.waitForTimeout(300);
}

// ---------- death screen last (survivor mode drops the pack, which would change every shot after it) ----------
for (const [w, h] of sizes) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const p = window.__gp.ctx.player;
    p.godMode = false;
    p.damage(9999, null);
  });
  await page.waitForTimeout(1200);
  await snap('death', w);
  report[`death_${w}`] = await page.evaluate(() => ({ text: document.querySelector('.hud .dead')?.innerText.replace(/\s+/g, ' ') }));
  await page.waitForFunction(() => !window.__gp.ctx.player.dead, null, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => (window.__gp.ctx.player.godMode = true));
  await page.waitForTimeout(500);
}

// ---------- contact sheets (one per size) ----------
for (const [w] of sizes) {
  const mine = shots.filter((s) => s[1] === w && existsSync(s[2]));
  const cells = mine.map(([n, , p]) => `<figure><img src="data:image/png;base64,${readFileSync(p).toString('base64')}"><figcaption>${n} · ${w}</figcaption></figure>`).join('');
  const sheet = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await sheet.setContent(`<style>body{margin:0;background:#15181a;color:#e4e8ea;font:600 14px system-ui}main{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px}
    figure{margin:0}img{width:100%;display:block;border:1px solid #333}figcaption{padding:3px 0}</style><h3 style="margin:8px">UI ${stage} · ${w}</h3><main>${cells}</main>`);
  await sheet.screenshot({ path: `${out}ui_${stage}_sheet_${w}.png`, fullPage: true });
  await sheet.close();
}
console.log(JSON.stringify(report, null, 1));
console.log('errors', errs.length, errs.slice(0, 5));
await browser.close();
