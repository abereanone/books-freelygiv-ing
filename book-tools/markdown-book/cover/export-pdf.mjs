// Lulu cover PDF: one page, (12.25 in + spine) x 9.25 in, flattened 300 dpi image (no live fonts or layers).
// English:  node cover/make-drafts.mjs burgundy               then  node cover/export-pdf.mjs
// Spanish:  node cover/make-drafts.mjs burgundy --lang=es --pages=280
//           then  node cover/export-pdf.mjs cover-es-burgundy --pages=280      (-> cover-es-burgundy-lulu.pdf)
// --pages must match the interior PDF; the spine is PAGES / 444 + 0.06 in, the same formula make-drafts.mjs uses.
import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url'; import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const name = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'cover-burgundy';
const PAGES = +(process.argv.find(a => a.startsWith('--pages='))?.slice(8) || 272);
const W_IN = Math.round((12.25 + PAGES / 444 + 0.06) * 1000) / 1000;   // 272 pages -> 12.923
const out = name === 'cover-burgundy' ? 'cover-lulu.pdf' : `${name}-lulu.pdf`;
const fwd = (f) => path.join(HERE, f).split(path.sep).join('/');
const br = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--allow-file-access-from-files'] });
const p = await br.newPage();
await p.setViewport({ width: Math.round(W_IN * 96), height: 888, deviceScaleFactor: 300 / 96 });
await p.goto(pathToFileURL(path.join(HERE, name + '.svg')).href); await new Promise(r => setTimeout(r, 800));
await p.evaluate(() => { document.documentElement.style.background = '#5A1626'; });
await p.screenshot({ path: path.join(HERE, '_cover300.png') });
await br.close();
execFileSync('python', ['-c', `
import pymupdf
d=pymupdf.open(); pg=d.new_page(width=${W_IN}*72,height=9.25*72)
pg.insert_image(pg.rect, filename=r'${fwd('_cover300.png')}')
d.save(r'${fwd(out)}', deflate=True)
`]);
console.log(`${out}: ${W_IN} x 9.25 in, ${PAGES} pages, spine ${(PAGES / 444 + 0.06).toFixed(3)} in`);
