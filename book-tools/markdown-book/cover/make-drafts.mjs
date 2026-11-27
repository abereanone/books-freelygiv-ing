// Draft covers for Lulu, 6x9 paperback. Units: 1 unit = 0.01 in. Run: node cover/make-drafts.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { verse } from '../tools/bible.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const LANG = process.argv.find(a => a.startsWith('--lang='))?.slice(7);
const T = { title1: 'MEDITATIONS ON', title1Scale: 1, title2: 'PSALM', title3: '119', tagline: 'Forty-four weekly meditations', author: 'MICHAEL A. COUGHLIN', spine: 'Meditations on Psalm 119', invite: 'You are invited to memorize the Psalm.', backP1: 'Psalm 119 is 176 verses in 22 octets. Four verses a week: the whole psalm in a year, and a meditation on each set.', backP2: 'Read it, memorize it, and let it work on your heart.', bio: '<b>Michael A. Coughlin</b> is a particular Baptist preacher who has served Christ’s Church as pastor, evangelist, teacher, writer, and application developer. He lives in Ohio with his wife, Erin, and their two youngest boys.', url: 'BOOKS.FREELY.GIVING', pages: 272, ...(LANG ? JSON.parse(fs.readFileSync(path.join(HERE, `cover.${LANG}.json`), 'utf8')) : {}) };
const PAGES = +(process.argv.find(a => a.startsWith('--pages='))?.slice(8) || T.pages), TRIM_W = 6, TRIM_H = 9, BLEED = 0.125;
const spine = PAGES / 444 + 0.06;                       // Lulu formula (verify against Lulu's template)
const W = (2 * TRIM_W + spine + 2 * BLEED) * 100, H = (TRIM_H + 2 * BLEED) * 100;
const B = BLEED * 100, S = spine * 100;
const bx = B, sx = B + TRIM_W * 100, fx = sx + S;       // back, spine, front left edges
const PAL = process.argv[2] === 'burgundy'
  ? { NAVY: '#5A1626', GOLD: '#F2C230', SLATE: '#8E2C42', T3: '#74283B', T4: '#8A3347', tag: '-burgundy' }
  : { NAVY: '#14213D', GOLD: '#C9A24B', SLATE: '#4A6AA8', T3: '#22345c', T4: '#2f4577', tag: '' };
const { NAVY, GOLD, SLATE } = PAL, CREAM = '#F2EAD7';
const FA=process.argv.find(a=>a.startsWith('--font='))?.slice(7);
const TITLE_FONT=FA?`assets/fonts-try/${FA}.${fs.existsSync(path.join(HERE,'assets/fonts-try',FA+'.ttf'))?'ttf':'woff2'}`:'assets/medium-rare-ribeye.ttf';   // default: Medium Rare Ribeye (our modified Ribeye, SIL OFL)
const SZ=(process.argv.find(a=>a.startsWith('--sz='))?.slice(5)||(FA?'48,132,175':'46,118,160')).split(',').map(Number);
const BOLD=parseFloat(process.argv.find(a=>a.startsWith('--bold='))?.slice(7)||'0');   // thicken strokes: outline = size x BOLD
const WITH_BAND = !process.argv.includes('--noband');   // full-length block strip, on by default
const INV = +(process.argv.find(a => a.startsWith('--inv='))?.slice(6) || 24);
const SEED = +(process.argv.find(a => a.startsWith('--seed='))?.slice(7) || 119);
const BLK = 12, ROWS = 5, STRIP = BLK * ROWS, GAP = 39.37;   // 12-unit squares (0.12 in); strip is 5 squares high, 1 cm above the trimmed bottom edge
const BAND = H - B - GAP - STRIP;
const rng = (a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(SEED);
// CROSSWORDS mark: CROSS runs down column 1, WORDS runs across row 2; they share the O. Centered on the spine.
const LOGO = { '0,1': 'C', '1,1': 'R', '2,1': 'O', '3,1': 'S', '4,1': 'S', '2,0': 'W', '2,2': 'R', '2,3': 'D', '2,4': 'S' };
const logoX = sx + S / 2 - 2.5 * BLK;
// same mark at the far left (back cover) and far right (front cover), 0.25 in inside the trim, snapped to the block grid
const MARG = 25, LOGO_W = 5 * BLK;
// Rule (Michael, 2026-11-19): logo on the spine only when the spine is at least 0.67 in (about 271 pages);
// this book's 0.673 in spine prints it well. See C:/code/crosswords-books.md.
const SPINE_LOGO = spine >= 0.67;
const logoXs = [logoX - BLK * Math.round((logoX - (B + MARG)) / BLK), ...(SPINE_LOGO ? [logoX] : []), logoX + BLK * Math.round((W - B - MARG - LOGO_W - logoX) / BLK)];
const strip = () => {
  const x0 = logoX - BLK * Math.ceil(logoX / BLK); let o = '';
  const at = (x, r) => { for (const lx of logoXs) { const c = Math.round((x - lx) / BLK); if (c >= 0 && c < 5 && LOGO[`${r},${c}`]) return LOGO[`${r},${c}`]; } return null; };
  for (let x = x0; x < W; x += BLK) for (let r = 0; r < ROWS; r++) {
    const roll = rng();
    // a block touching a crossword letter square (side to side) is always the light burgundy: no yellow against yellow
    const nextToLetter = [[r - 1, 0], [r + 1, 0], [r, -1], [r, 1]].some(([a, d]) => at(x + d * BLK, a));
    o += `<rect x="${x.toFixed(2)}" y="${BAND + r * BLK}" width="${BLK + 0.3}" height="${BLK + 0.3}" fill="${nextToLetter || roll >= 0.5 ? SLATE : GOLD}"/>`;
  }
  for (const lx of logoXs) for (const [k, ch] of Object.entries(LOGO)) {
    const [r, c] = k.split(',').map(Number), x = lx + c * BLK, y = BAND + r * BLK;
    o += `<rect x="${x + 0.25}" y="${y + 0.25}" width="${BLK - 0.5}" height="${BLK - 0.5}" fill="${GOLD}" stroke="${SLATE}" stroke-width="0.5" stroke-linejoin="miter"/>` +
         `<text x="${x + BLK / 2}" y="${y + BLK - 2.6}" text-anchor="middle" font-size="9.6" style="font-family:MRR;fill:${NAVY};stroke:none;paint-order:normal">${ch}</text>`;
  }
  return o;
};
const head = `<defs><style>
@font-face{font-family:CP;font-weight:400;src:url(assets/crimson-pro-latin-400-normal.woff2)}
@font-face{font-family:CP;font-weight:600;src:url(assets/crimson-pro-latin-600-normal.woff2)}
@font-face{font-family:MRR;src:url(${TITLE_FONT})}
@font-face{font-family:CP;font-weight:400;font-style:italic;src:url(assets/crimson-pro-latin-400-italic.woff2)}
text{font-family:CP,serif;fill:${CREAM}}
</style>
<clipPath id="ph"><circle cx="${bx + 130}" cy="590" r="75"/></clipPath></defs>`;
const fo = (x, y, w, h, css, html) => `<foreignObject x="${x}" y="${y}" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:CP,serif;color:${CREAM};${css}">${html}</div></foreignObject>`;
const front = (cx) => `
<text x="${cx}" y="235" text-anchor="middle" font-size="${(SZ[0] * T.title1Scale).toFixed(1)}" letter-spacing="2" style="font-family:MRR;fill:${GOLD};stroke:${GOLD};stroke-width:${(SZ[0]*T.title1Scale*BOLD).toFixed(1)}px;stroke-linejoin:miter;stroke-miterlimit:3;paint-order:normal">${T.title1}</text>
<text x="${cx}" y="385" text-anchor="middle" font-size="${SZ[1]}" style="font-family:MRR;stroke:${CREAM};stroke-width:${(SZ[1]*BOLD).toFixed(1)}px;stroke-linejoin:miter;stroke-miterlimit:3;paint-order:normal">${T.title2}</text>
<text x="${cx}" y="592" text-anchor="middle" font-size="${SZ[2]}" style="font-family:MRR;stroke:${CREAM};stroke-width:${(SZ[2]*BOLD).toFixed(1)}px;stroke-linejoin:miter;stroke-miterlimit:3;paint-order:normal">${T.title3}</text>
<rect x="${cx - 60}" y="634" width="120" height="3" fill="${GOLD}"/>
<text x="${cx}" y="686" text-anchor="middle" font-size="28" font-style="italic">${T.tagline}</text>
<text x="${cx}" y="772" text-anchor="middle" font-size="34" letter-spacing="6" font-weight="600">${T.author}</text>`;
const spineTxt = `
<text transform="translate(${sx + S / 2 - 10},${B + 60}) rotate(90)" font-size="30" font-weight="600">${T.spine}</text>
<text transform="translate(${sx + S / 2 - 8},${BAND - 30}) rotate(90)" text-anchor="end" font-size="24" letter-spacing="3" style="fill:${GOLD}">${T.author}</text>`;
const back = `
<text id="invite" x="${bx + 50}" y="112" font-size="${INV}" style="font-family:MRR;fill:${GOLD}">${T.invite}</text>
${fo(bx + 50, 134, 500, 330, 'font-size:21px;line-height:1.38', `<p style="margin:0 0 14px">${T.backP1}</p><p style="margin:0">${T.backP2}</p>`)}
<image href="assets/author-circle.jpg" x="${bx + 55}" y="515" width="150" height="150" clip-path="url(#ph)"/>
${fo(bx + 235, 515, 305, 200, 'font-size:19px;line-height:1.3', T.bio)}
<text x="${bx + 50}" y="${BAND - 40}" font-size="24" letter-spacing="2" style="font-family:MRR;fill:${GOLD}">${T.url}</text>`;
const checks = !WITH_BAND ? '' : strip();
const all = Array.from({ length: 176 }, (_, i) => verse('psa', 119, i + 1)).filter(Boolean);
let verses = '';
const textBlock = (ext = '') => fo(0, 0, W, H, `font-size:21px;line-height:1.5;color:${PAL.T4};text-align:justify;padding:10px 30px;overflow:hidden;width:${W - 60}px${ext}`, verses);
const halo = `<style>text{paint-order:stroke;stroke:${NAVY};stroke-width:7px;stroke-linejoin:round}foreignObject div{text-shadow:0 0 6px ${NAVY},0 0 12px ${NAVY},0 0 18px ${NAVY}}</style>`;
const svg = (ext) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W / 100}in" height="${H / 100}in" viewBox="0 0 ${W} ${H}">${head}${halo}
<rect width="${W}" height="${H}" fill="${NAVY}"/>${textBlock(ext)}${checks}${back}${spineTxt}${front(fx + S * 0 + 300)}
<g fill="none" stroke="#ff4d4d" stroke-width="1" stroke-dasharray="6 4" opacity=".0"><rect x="${B}" y="${B}" width="${W - 2 * B}" height="${H - 2 * B}"/><line x1="${sx}" x2="${sx}" y1="0" y2="${H}"/><line x1="${fx}" x2="${fx}" y1="0" y2="${H}"/></g></svg>`;
const br = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--allow-file-access-from-files'] });
// fit: the most consecutive verses (from 119:1, each once) that fit on the wrap
const probe = await br.newPage();
const fits = async (n) => {
  verses = all.slice(0, n).join(' ');
  fs.writeFileSync(path.join(HERE, '_probe.svg'), svg(`;height:${H - 20}px`));
  await probe.goto(pathToFileURL(path.join(HERE, '_probe.svg')).href);
  return probe.evaluate(() => { const d = document.querySelector('foreignObject div'); return d.scrollHeight <= d.clientHeight; });
};
let lo = 1, hi = 176;
while (lo < hi) { const mid = (lo + hi + 1) >> 1; (await fits(mid)) ? (lo = mid) : (hi = mid - 1); }
verses = all.slice(0, lo).join(' ');
fs.unlinkSync(path.join(HERE, '_probe.svg'));
console.log(`texture: Psalm 119:1-${lo}`);
const name = 'cover' + (LANG ? '-' + LANG : '') + PAL.tag + (FA?'-'+FA:'')+(BOLD?'-b':'') + (WITH_BAND ? '' : '-noband');
fs.writeFileSync(path.join(HERE, name + '.svg'), svg(''));
const p = await br.newPage(); await p.setViewport({ width: Math.round(W / 100 * 96), height: Math.round(H / 100 * 96) });
await p.goto(pathToFileURL(path.join(HERE, name + '.svg')).href); await new Promise(r => setTimeout(r, 600));
await p.screenshot({ path: path.join(HERE, name + '.png') });
// report how far each spine line sits from the spine's center, in hundredths of an inch
const off = await p.evaluate(([sx, S]) => [...document.querySelectorAll('text[transform]')].map((t) => { const r = t.getBoundingClientRect(), k = 0.96; return +(((r.left + r.right) / 2 / k) - (sx + S / 2)).toFixed(1); }), [sx, S]);
console.log('spine text offset from center (units):', off.join(', '));
await br.close(); console.log(`wrap ${W / 100} x ${H / 100} in, spine ${spine.toFixed(3)} in`);
