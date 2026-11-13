import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1300,780'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 160))); page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto('http://localhost:5188/');
await page.waitForTimeout(7000);
await page.getByText('Settings', { exact: false }).first().click(); await page.waitForTimeout(800);
await page.screenshot({ path: 'docs/audit/screenshots/wip/96_settings.png' });
console.log('errors', errs.slice(0, 3)); await browser.close();
