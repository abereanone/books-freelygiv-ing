// Screenshot pages of dist/print.html as laid out by Paged.js: node tools/snap.mjs 1 5 40 ...
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const nums = process.argv.slice(2).map(Number);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1.5 });
await page.evaluateOnNewDocument(() => { window.PagedConfig = { auto: true, after: () => { window.__pagedDone = true; } }; });
await page.goto('file:///' + path.resolve('dist/print.html').replace(/\\/g, '/'), { waitUntil: 'load', timeout: 0 });
await page.waitForFunction(() => window.__pagedDone === true, { timeout: 0, polling: 500 });
for (const n of nums) {
  const el = await page.$(`.pagedjs_page[data-page-number="${n}"]`);
  if (el) { await el.screenshot({ path: `dist/snap-${n}.png` }); console.log('dist/snap-' + n + '.png'); }
}
await browser.close();
