// Runs the M0 rendering spikes in a real, headed Chrome window on this machine's GPU
// (headless/SwiftShader numbers are meaningless — principles §13). Needs `npm run dev` running.
//   node tools/perf/run-spikes.mjs            -> prints JSON + writes artifacts/spikes.json
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:5188';
const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--disable-frame-rate-limit', '--disable-gpu-vsync', '--window-size=1300,780', '--force_high_performance_gpu'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => m.type() === 'error' && console.error('[page]', m.text()));

async function run(path) {
  await page.goto(BASE + path);
  await page.waitForFunction(() => document.title === 'DONE', null, { timeout: 120_000 });
  return page.evaluate(() => window.__spike);
}

const out = { objects: [], jitter: [] };

for (const n of [500, 1000, 2000]) {
  for (const mode of ['webgl', 'webgpu', 'webgpu-gl']) {
    const r = await run(`/spikes/objects.html?mode=${mode}&n=${n}`);
    console.log(JSON.stringify(r));
    out.objects.push(r);
  }
}
for (const q of ['', '?webgl']) {
  const r = await run(`/spikes/jitter.html${q}`);
  console.log(JSON.stringify(r));
  out.jitter.push(r);
}
await browser.close();
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/spikes.json', JSON.stringify(out, null, 2));
