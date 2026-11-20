// node tools/audit/quest_shot.mjs #here   headless: quest HUD tracker with direction arrow, journal (J), a note card, quest items in containers.
import { launch } from './browser.mjs';
const out = 'docs/audit/screenshots/wip/';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__quests && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: out + 'quest_hud_start.png' });
console.log('start', await page.evaluate(() => window.__quests.quests.tracked));
// the L key lights the flashlight: counts as the first objective
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL' })));
await page.waitForTimeout(700);
console.log('after L', await page.evaluate(() => JSON.stringify(window.__quests.quests.state.wake) + ' ' + window.__quests.quests.tracked));
// skip to Route 9 and look at the arrow
await page.evaluate(() => { const q = window.__quests.quests; for (const id of ['listen', 'make_do']) for (let i = 0; i < 4; i++) q.skip(id); });
await page.waitForTimeout(500);
await page.evaluate(() => window.__gp.setLook(0, 0));
await page.waitForTimeout(500);
await page.screenshot({ path: out + 'quest_hud_route9.png' });
// quest items placed in the world containers
console.log('placed', await page.evaluate(() => {
  const lo = window.__gp.ctx.game.loadout;
  return ['poi_house_a_1', 'poi_house_b_3', 'poi_school_out2', 'poi_camp_out0', 'poi_crash_out1', 'poi_ranger_out1'].map((id) => {
    const c = lo.containers.get(id);
    return id + ':' + (c ? c.grid.contents.map((g) => g.item.defId).filter((d) => d.startsWith('note_') || d === 'antibiotics' || d === 'adrenaline_shot').join('+') : 'MISSING');
  }).join(' ');
}));
// read a note from the pack through the real use path, then open the journal
await page.evaluate(async () => {
  const g = window.__gp, lo = g.ctx.game.loadout;
  g.give('note_maple_sick');
  let n = null;
  for (const { grid } of lo.playerGrids()) for (const gi of grid.contents) if (gi.item.defId === 'note_maple_sick') n = gi.item;
  lo.beginUse(n);
  await new Promise((r) => setTimeout(r, 2000));
});
await page.screenshot({ path: out + 'quest_note.png' });
await page.waitForTimeout(500);
await page.keyboard.press('KeyJ');
await page.waitForTimeout(600);
await page.screenshot({ path: out + 'quest_journal.png' });
await page.getByRole('button', { name: 'Notes' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: out + 'quest_journal_notes.png' });
await page.keyboard.press('KeyJ');
console.log('notes', await page.evaluate(() => JSON.stringify(window.__quests.quests.notes)));
console.log('errors', JSON.stringify(errs.slice(0, 6)));
await browser.close();
