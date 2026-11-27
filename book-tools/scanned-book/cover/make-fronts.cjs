// Front-cover options for Keeping the Heart, 6 x 9 in. Renders option-*.png at 200 dpi (1200 x 1800).
// Run from this folder: node make-fronts.cjs
const fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer-core');
const HERE = __dirname;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const T = {
  title: 'Keeping<br>the Heart',
  sub: 'or, The Saint Indeed',
  author: 'JOHN FLAVEL',
  verse: '“Keep thy heart with all diligence;<br>for out of it are the issues of life.”',
  ref: 'PROVERBS 4:23',
};

const base = `
@font-face{font-family:CP;font-weight:400;src:url(assets/crimson-pro-latin-400-normal.woff2)}
@font-face{font-family:CP;font-weight:600;src:url(assets/crimson-pro-latin-600-normal.woff2)}
@font-face{font-family:CP;font-weight:400;font-style:italic;src:url(assets/crimson-pro-latin-400-italic.woff2)}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:6in;height:9in;overflow:hidden}
body{font-family:CP,serif;position:relative;color:#F2EAD7}
.title{font-weight:600;line-height:.95;text-align:center}
.sub{font-style:italic;text-align:center}
.author{font-weight:600;letter-spacing:.22em;text-align:center}
.verse{font-style:italic;text-align:center;line-height:1.35}
.ref{letter-spacing:.2em;text-align:center}
.rule{height:2px;margin:0 auto}
`;

const options = {
  // A: Ruisdael, full bleed; title over the sky, author at the foot
  'A-ruisdael': `
    body{background:#222 url(assets/ruisdael.jpg) center/cover}
    .shade-top{position:absolute;inset:0 0 auto 0;height:4.2in;background:linear-gradient(rgba(20,18,14,.78),rgba(20,18,14,.45) 70%,rgba(20,18,14,0))}
    .shade-bot{position:absolute;inset:auto 0 0 0;height:2in;background:linear-gradient(rgba(14,12,10,0),rgba(14,12,10,.85))}
    .top{position:absolute;top:.75in;left:0;right:0}
    .title{font-size:62pt}
    .sub{font-size:19pt;margin-top:.14in;color:#E8D9A8}
    .author{position:absolute;bottom:.6in;left:0;right:0;font-size:19pt}
  |<div class="shade-top"></div><div class="shade-bot"></div>
   <div class="top"><div class="title">${T.title}</div><div class="sub">${T.sub}</div></div>
   <div class="author">${T.author}</div>`,

  // B: Courbet, The Source of the Loue; painting below a dark title panel
  'B-courbet': `
    body{background:#1d1b17}
    .art{position:absolute;left:0;right:0;bottom:0;height:5.6in;background:url(assets/courbet.jpg) center 62%/cover}
    .art::before{content:'';position:absolute;inset:0 0 auto 0;height:1in;background:linear-gradient(#1d1b17,rgba(29,27,23,0))}
    .top{position:absolute;top:.6in;left:0;right:0}
    .title{font-size:58pt}
    .rule{width:1.1in;background:#C9A24B;margin-top:.18in}
    .sub{font-size:18pt;margin-top:.14in;color:#E8D9A8}
    .author{margin-top:.2in;font-size:17pt}
  |<div class="art"></div>
   <div class="top"><div class="title">${T.title}</div><div class="rule"></div><div class="sub">${T.sub}</div><div class="author">${T.author}</div></div>`,

  // C: the 1691 engraved portrait on a burgundy field
  'C-portrait': `
    body{background:#4A1420}
    .frame{position:absolute;left:1.35in;right:1.35in;top:2.55in;height:5.1in;background:#efe9dc url(assets/flavel.jpg) center/contain no-repeat;outline:2px solid #C9A24B;outline-offset:6px}
    .top{position:absolute;top:.5in;left:0;right:0}
    .title{font-size:50pt;color:#F2C230}
    .sub{font-size:17pt;margin-top:.1in}
    .author{position:absolute;bottom:.55in;left:0;right:0;font-size:19pt}
  |<div class="top"><div class="title">${T.title}</div><div class="sub">${T.sub}</div></div>
   <div class="frame"></div>
   <div class="author">${T.author}</div>`,

  // D: type only; deep green, gold rules, the text from Proverbs
  'D-type': `
    body{background:#16302A}
    .box{position:absolute;inset:.45in;border:2px solid #C9A24B}
    .box::after{content:'';position:absolute;inset:6px;border:1px solid rgba(201,162,75,.6)}
    .top{position:absolute;top:1.55in;left:0;right:0}
    .title{font-size:64pt}
    .sub{font-size:20pt;margin-top:.2in;color:#E8D9A8}
    .orn{text-align:center;color:#C9A24B;font-size:26pt;margin:.45in 0 .4in}
    .verse{font-size:16pt;padding:0 .9in}
    .ref{font-size:11pt;margin-top:.12in;color:#C9A24B}
    .author{position:absolute;bottom:1.1in;left:0;right:0;font-size:20pt}
  |<div class="box"></div>
   <div class="top"><div class="title">${T.title}</div><div class="sub">${T.sub}</div>
   <div class="orn">❦</div><div class="verse">${T.verse}</div><div class="ref">${T.ref}</div></div>
   <div class="author">${T.author}</div>`,
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 576, height: 864, deviceScaleFactor: 1200 / 576 });
  for (const [name, spec] of Object.entries(options)) {
    const [css, html] = spec.split('|');
    const file = path.join(HERE, `_${name}.html`);
    fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><style>${base}${css}</style><body>${html}</body>`);
    await page.goto('file:///' + file.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(HERE, `option-${name}.png`) });
    console.log('wrote option-' + name + '.png');
  }
  await browser.close();
})();
