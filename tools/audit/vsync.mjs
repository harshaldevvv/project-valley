// Measures the browser's bare requestAnimationFrame period on an empty page (no game): the vsync floor of this PC right now.
import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('about:blank');
const r = await page.evaluate(() => new Promise((res) => { const t = []; let last = performance.now(); const f = () => { const n = performance.now(); t.push(n - last); last = n; if (t.length < 300) requestAnimationFrame(f); else { t.sort((a, b) => a - b); res({ p50: +t[150].toFixed(2), p95: +t[285].toFixed(2), dpr: devicePixelRatio, hz: screen.availWidth }); } }; requestAnimationFrame(f); }));
console.log(JSON.stringify(r)); await browser.close();
