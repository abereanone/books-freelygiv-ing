// Crop front, back and spine (trimmed, no bleed) from a draft SVG: node cover/export-panels.mjs cover-burgundy
import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url'; import puppeteer from 'puppeteer-core';
const HERE = path.dirname(fileURLToPath(import.meta.url)), name = process.argv[2] || 'cover-burgundy';
const PAGES = +(process.argv.find((a) => a.startsWith('--pages='))?.slice(8) || 272); // spine from page count
const S = (PAGES / 444 + 0.06) * 100, B = 12.5, W = 1200 + S + 2 * B, H = 925, k = 0.96; // units -> CSS px
const sx = B + 600, fx = sx + S;
const br = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--allow-file-access-from-files'] });
const p = await br.newPage(); await p.setViewport({ width: Math.round(W * k) + 2, height: Math.round(H * k) + 2, deviceScaleFactor: 2 });
await p.goto(pathToFileURL(path.join(HERE, name + '.svg')).href); await new Promise(r => setTimeout(r, 600));
const clip = (x0, x1) => ({ x: x0 * k, y: B * k, width: (x1 - x0) * k, height: (H - 2 * B) * k });
for (const [n, a, b] of [['front', fx, W - B], ['back', B, sx], ['spine', sx, fx]])
  await p.screenshot({ path: path.join(HERE, `${name}-${n}.png`), clip: clip(a, b) });
await br.close();
