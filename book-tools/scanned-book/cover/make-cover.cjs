// Lulu wrap cover for Keeping the Heart (design D + Michael's CROSSWORDS strip), 6 x 9 paperback.
// Writes cover/cover-wrap.html, cover-lulu.pdf (exact Lulu size), cover-wrap.png (preview),
// cover-front.jpg / cover-back.jpg / cover-spine.jpg (panels for the site).
// Usage, from the project root, after node tools/build.mjs --pdf: node cover/make-cover.cjs (--pages=N overrides)
const fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer-core');
const HERE = __dirname;
const PAGES = require('./interior-pages.cjs')();
const [TRIM_W, TRIM_H] = (process.argv.find((a) => a.startsWith('--trim='))?.slice(7) || '6x9').split('x').map(Number), BLEED = 0.125;
const K = TRIM_W / 6, FK = 1 - (1 - TRIM_W / 6) * 0.3;   // type shrinks far less than the layout (readability)   // the design was drawn for 6 x 9; smaller trims scale its type and insets by K
const SPINE = PAGES / 444 + 0.06;                     // Lulu's formula
const W = 2 * TRIM_W + SPINE + 2 * BLEED, H = TRIM_H + 2 * BLEED;
const sx = BLEED + TRIM_W, fx = sx + SPINE;           // spine and front left edges (in)
const GREEN = '#1F4A3B', GOLD = '#D9B65C', LIGHT = '#5C8F72', CREAM = '#F2EAD7';
const ALT = '#A9C9A4';   // pale tint of the book's colour: strip squares, border and back heading (less yellow, 2026-11-19)   // palette chosen 2026-11-19 to keep Michael's CROSSWORDS books distinct (see C:/code/crosswords-books.md)

// CROSSWORDS strip, as on Michael's other covers: 0.12 in squares, 5 rows, 1 cm above the trimmed bottom.
// CROSS runs down column 1 and WORDS across row 2, sharing the O; the mark sits on the back, spine and front.
const BLK = 0.12, ROWS = 5, STRIP = BLK * ROWS, GAP = 0.3937;
const BAND = H - BLEED - GAP - STRIP;
let seed = 1667;
const rng = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const LOGO = { '0,1': 'C', '1,1': 'R', '2,1': 'O', '3,1': 'S', '4,1': 'S', '2,0': 'W', '2,2': 'R', '2,3': 'D', '2,4': 'S' };
const logoX = sx + SPINE / 2 - 2.5 * BLK, MARG = 0.25, LOGO_W = 5 * BLK;
// Rule (Michael, 2026-11-19): the spine carries the CROSSWORDS logo (0.60 in wide) only when the spine is at least
// 0.67 in, about 271 pages: Psalm 119's 0.673 in spine prints it well. Thinner books carry it on the back and
// front only. See C:/code/crosswords-books.md.
const SPINE_LOGO_MIN = 0.67, SPINE_LOGO = SPINE >= SPINE_LOGO_MIN;
const logoXs = [logoX - BLK * Math.round((logoX - (BLEED + MARG)) / BLK), ...(SPINE_LOGO ? [logoX] : []), logoX + BLK * Math.round((W - BLEED - MARG - LOGO_W - logoX) / BLK)];
function strip() {
  const x0 = logoX - BLK * Math.ceil(logoX / BLK);
  const at = (x, r) => { for (const lx of logoXs) { const c = Math.round((x - lx) / BLK); if (c >= 0 && c < 5 && LOGO[`${r},${c}`]) return true; } return false; };
  let o = '';
  for (let x = x0; x < W; x += BLK) for (let r = 0; r < ROWS; r++) {
    const roll = rng();
    const nextToLetter = [[r - 1, 0], [r + 1, 0], [r, -1], [r, 1]].some(([a, d]) => at(x + d * BLK, a));
    o += `<rect x="${x.toFixed(4)}" y="${(BAND + r * BLK).toFixed(4)}" width="${BLK + 0.003}" height="${BLK + 0.003}" fill="${nextToLetter || roll >= 0.5 ? LIGHT : ALT}"/>`;
  }
  for (const lx of logoXs) for (const [k, ch] of Object.entries(LOGO)) {
    const [r, c] = k.split(',').map(Number), x = lx + c * BLK, y = BAND + r * BLK;
    o += `<rect x="${x + 0.0025}" y="${y + 0.0025}" width="${BLK - 0.005}" height="${BLK - 0.005}" fill="${ALT}" stroke="${LIGHT}" stroke-width="0.005"/>` +
         `<text x="${x + BLK / 2}" y="${y + BLK - 0.026}" text-anchor="middle" font-size="0.096" style="font-family:MRR;fill:${GREEN}">${ch}</text>`;
  }
  return `<svg class="strip" viewBox="0 0 ${W} ${H}" width="${W}in" height="${H}in">${o}</svg>`;
}

const backTop = BLEED + 0.55 * K, fold = (x) => `${x}IN`;   // IN: computed positions, left alone by the scaling below

// Corner brackets inside the box: a double L in each corner (Michael chose this, style C without diamonds, 2026-11-19).
function brackets() {
  const k = typeof K !== 'undefined' ? K : 1;
  const bx = fx + 0.45 * k, by = BLEED + 0.45 * k, bw = TRIM_W - 0.9 * k, bh = BAND - BLEED - 0.75 * k;
  const d = 0.18 * k, a = 0.66 * k, n = 0.096 * k, m = 0.18 * k, o = 0.02 * k, i = 0.01 * k;
  let p = '';
  for (const [x, y, sx, sy] of [[0, 0, 1, 1], [bw, 0, -1, 1], [0, bh, 1, -1], [bw, bh, -1, -1]]) {
    const px = x + sx * d, py = y + sy * d;
    p += `<path d="M${px} ${py + sy * a}V${py}H${px + sx * a}" stroke="${ALT}" stroke-width="${o}" fill="none"/>` +
         `<path d="M${px + sx * n} ${py + sy * (a - m)}V${py + sy * n}H${px + sx * (a - m)}" stroke="${ALT}" stroke-width="${i}" stroke-opacity=".6" fill="none"/>`;
  }
  return `<svg class="abs" style="left:${fold(bx)};top:${fold(by)};width:${fold(bw)};height:${fold(bh)};overflow:visible" viewBox="0 0 ${bw} ${bh}">${p}</svg>`;
}

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:CP;font-weight:400;src:url(assets/crimson-pro-latin-400-normal.woff2)}
@font-face{font-family:CP;font-weight:600;src:url(assets/crimson-pro-latin-600-normal.woff2)}
@font-face{font-family:CP;font-weight:400;font-style:italic;src:url(assets/crimson-pro-latin-400-italic.woff2)}
@font-face{font-family:MRR;src:url(assets/medium-rare-ribeye.ttf)}
@page{size:${W}IN ${H}IN;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}IN;height:${H}IN;overflow:hidden}
body{background:${GREEN};color:${CREAM};font-family:CP,serif;position:relative}
.abs{position:absolute}
.strip{position:absolute;left:0;top:0}
/* front: design D */
.box{left:${fold(fx + 0.45 * K)};top:${fold(BLEED + 0.45 * K)};width:${fold(TRIM_W - 0.9 * K)};height:${fold(BAND - BLEED - 0.75 * K)};border:0.02in solid ${ALT}}
.box::after{content:'';position:absolute;inset:0.06in;border:0.01in solid ${ALT}99}
.front{left:${fold(fx)};width:${fold(TRIM_W)};top:${fold(BLEED + 1.35 * K)};text-align:center}
.title{font-weight:600;font-size:64pt;line-height:.95}
.sub{font-style:italic;font-size:20pt;margin-top:.2in;color:#E8D9A8}
.orn{color:${GOLD};font-size:26pt;margin:.38in 0 .32in}
.verse{font-style:italic;font-size:17pt;line-height:1.35;padding:0 .9in}
.ref{font-size:12pt;letter-spacing:.2em;margin-top:.12in;color:${GOLD}}
.author{left:${fold(fx)};width:${fold(TRIM_W)};top:${fold(BAND - 1.05 * K)};text-align:center;font-weight:600;font-size:20pt;letter-spacing:.22em}
/* spine */
.spine{left:${fold(sx)};width:${fold(SPINE)};top:${fold(BLEED)};height:${fold(BAND - BLEED - 0.1)};display:flex;align-items:center;justify-content:space-between;writing-mode:vertical-rl;padding:.45in 0}
.spine .st{font-size:15pt;font-weight:600}
.spine .sa{font-size:12pt;letter-spacing:.18em;color:${GOLD}}
/* back */
.back{left:${fold(BLEED + 0.55 * K)};width:${fold(TRIM_W - 1.1 * K)};top:${fold(backTop)}}
.lead{font-family:MRR;color:${ALT};font-size:19pt;line-height:1.15;margin-bottom:.18in}
.back p{font-size:13pt;line-height:1.38;margin-bottom:.14in}
.bio{left:${fold(BLEED + 0.55 * K)};width:${fold(TRIM_W - 1.1 * K)};top:${fold(BAND - 2.55 * K)};display:flex;gap:.25in;align-items:center}
.bio img{width:1.45in;height:1.45in;border-radius:50%;flex:none}
.bio p{font-size:12.5pt;line-height:1.32}
.url{left:${fold(BLEED + 0.55 * K)};top:${fold(BAND - 0.62 * K)};font-family:MRR;color:${GOLD};font-size:16pt;letter-spacing:.06em}
.prep{left:${fold(BLEED + 0.55 * K)};top:${fold(BAND - 0.3 * K)};font-size:9.5pt;font-style:italic;color:#cfc4a8}
</style><body>
<div class="abs box"></div>
${brackets()}
<div class="abs front">
  <div class="title">Keeping<br>the Heart</div>
  <div class="sub">or, The Saint Indeed</div>
  <div class="orn">❦</div>
  <div class="verse">“Keep thy heart with all diligence;<br>for out of it are the issues of life.”</div>
  <div class="ref">PROVERBS 4:23</div>
</div>
<div class="abs author">JOHN FLAVEL</div>
<div class="abs spine"><span class="st">Keeping the Heart</span><span class="sa">FLAVEL</span></div>
<div class="abs back">
  <div class="lead">The greatest difficulty after conversion is to keep the heart with God.</div>
  <p>Flavel wrote this little book in 1667 for his flock at Dartmouth, when the law had shut him out of their pulpit. It shows what it is to keep the heart, why it is the great business of a Christian’s life, and how to keep it in twelve seasons that try every believer: prosperity and adversity, public danger and private want, injuries and provocations, temptation, spiritual darkness, suffering for Christ, and sickness and death.</p>
  <p>This edition follows the American Tract Society text, with footnotes and a glossary for old words.</p>
</div>
<div class="abs bio"><img src="assets/flavel-circle.jpg"><p><b>John Flavel</b> (1627–1691) was a Puritan minister at Dartmouth, Devon. Put out of his pulpit in 1662, he kept preaching to his people in private through years of persecution, and wrote for them what he could not always say in person.</p></div>
<div class="abs url">BOOKS.FREELY.GIVING</div>
${strip()}
</body>`;

// Scale the design's fixed sizes (pt and literal inches in the stylesheet) by K; computed positions (IN) stay.
function scaled(h) {
  const i = h.indexOf('<style>'), j = h.indexOf('</style>');
  let css = h.slice(i, j);
  if (K !== 1) css = css.replace(/(\d*\.?\d+)(pt|in)\b/g, (m, n, u) => (u === 'in' && /\d\.\d{3,}/.test(n) ? m : `${(+n * (u === 'pt' ? FK : K)).toFixed(3)}${u}`));
  return (h.slice(0, i) + css + h.slice(j)).replace(/(\d)IN\b/g, '$1in');
}

(async () => {
  fs.writeFileSync(path.join(HERE, 'cover-wrap.html'), scaled(html));
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage();
  const DPI = 200, px = (inch) => Math.round(inch * 96);
  await page.setViewport({ width: px(W), height: px(H), deviceScaleFactor: DPI / 96 });
  await page.goto('file:///' + path.join(HERE, 'cover-wrap.html').replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(HERE, 'cover-lulu.pdf'), width: `${W}in`, height: `${H}in`, printBackground: true, pageRanges: '1' });
  await page.screenshot({ path: path.join(HERE, 'cover-wrap.png') });
  const clip = (x, w) => ({ x: px(x), y: px(BLEED), width: px(w), height: px(TRIM_H) });
  await page.screenshot({ path: path.join(HERE, 'cover-front.jpg'), type: 'jpeg', quality: 92, clip: clip(fx, TRIM_W) });
  await page.screenshot({ path: path.join(HERE, 'cover-back.jpg'), type: 'jpeg', quality: 92, clip: clip(BLEED, TRIM_W) });
  await page.screenshot({ path: path.join(HERE, 'cover-spine.jpg'), type: 'jpeg', quality: 92, clip: clip(sx, SPINE) });
  await browser.close();
  console.log(`cover: ${W.toFixed(3)} x ${H.toFixed(3)} in, spine ${SPINE.toFixed(3)} in for ${PAGES} pages`);
})();
