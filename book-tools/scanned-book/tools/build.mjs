// Build Keeping the Heart from text/*.md:
//   dist/book.html                  Read Online edition (footnotes open in place when tapped)
//   dist/print.html + dist/*.pdf    print edition, 6 x 9 in, laid out by Paged.js in headless Chrome
// Usage: node tools/build.mjs          (HTML only)
//        node tools/build.mjs --pdf    (HTML + PDF; two layout passes so the contents get page numbers)
import fs from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import * as cheerio from 'cheerio';

const ROOT = path.resolve('.');
const DIST = path.join(ROOT, 'dist');
const wantPdf = process.argv.includes('--pdf');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TITLE = 'Keeping the Heart';
const SUBTITLE = 'or, The Saint Indeed';
const AUTHOR = 'John Flavel';

const md = new MarkdownIt({ html: true, linkify: false, typographer: false }).use(footnote);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function readMd(file) {
  const t = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const m = t.match(/^---\n([\s\S]*?)\n---\n?/);
  const fm = {};
  if (m) for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"(.*)"$/, '$1');
  }
  let body = m ? t.slice(m[0].length) : t;
  body = body.replace(/<!-- s\d+ -->\n/g, '');               // scan-page markers
  body = body.replace(/^(\d+)\. /gm, '$1\\. ');               // numbered paragraphs are Flavel's, not lists
  body = body.replace(/\b([123]) (?=(?:Kings|Sam|Samuel|Chron|Cor|Thess|Tim|Pet|Peter|John)\b)/g, '$1 '); // keep "2 Kings" together
  return { fm, body };
}

// markdown-it-footnote output -> notes in place (print: Paged.js floats; web: tap to open)
let fnSeq = 0;
function inlineFootnotes($, mode) {
  $('sup.footnote-ref').each((_, el) => {
    const a = $(el).find('a');
    const id = a.attr('href').slice(1);
    const li = $(`li#${id}`);
    li.find('a.footnote-backref').remove();
    const inner = (li.find('p').length === 1 ? li.find('p').html() : li.html()).trim();
    const n = a.text().replace(/[[\]]/g, '').replace(/:.*/, '');
    if (mode === 'print') {
      $(el).replaceWith(`<span class="fn-ref">${n}</span><span class="footnote"><span class="fn-mark">${n}.</span>${inner}</span>`);
    } else {
      const fid = `fn${++fnSeq}`;
      $(el).replaceWith(`<label class="fn-call" for="${fid}" title="Footnote ${n}">${n}</label><input type="checkbox" id="${fid}" class="fn-toggle"><span class="fn-body"><span class="fn-num">${n}</span> ${inner}</span>`);
    }
  });
  $('section.footnotes, hr.footnotes-sep').remove();
}

// the BSB's marked plural "you+" (Michael's revision, 2026-11-19): a small raised plus
function markPlural($) {
  $('p, li').each((_, el) => {
    const h = $(el).html();
    if (/[A-Za-z]\+/.test(h)) $(el).html(h.replace(/([A-Za-z])\+/g, '$1<span class="pl">+</span>'));
  });
}

function render(file, mode) {
  const { fm, body } = readMd(file);
  const $ = cheerio.load(md.render(body), null, false);
  inlineFootnotes($, mode);
  markPlural($);
  return { fm, $ };
}

const pg = (pages, id) => (pages && pages[id] ? `<span class="toc-pg">${pages[id]}</span>` : '');

function assemble(mode, pages) {
  fnSeq = 0;
  const files = fs.readdirSync('text').filter((f) => f.endsWith('.md')).sort();
  const sections = [];
  const toc = [];
  for (const f of files) {
    const slug = f.replace(/\.md$/, '').replace(/^\d+-/, '');
    const { fm, $ } = render(path.join('text', f), mode);
    if (slug === 'epistle-dedicatory') {
      const ps = $.root().children('p');
      ps.first().addClass('salutation');
      ps.slice(-3).addClass('signoff');
      sections.push(`<section class="matter epistle" id="${slug}"><h2 class="matter-title">${esc(fm.title)}</h2>${$.html()}</section>`);
    } else if (fm.chapter) {
      $('h3').each((i, h) => { $(h).attr('id', `${slug}-s${i + 1}`); });
      sections.push(`<section class="chapter" id="${slug}"><header class="chapter-head"><p class="chapter-num">Chapter ${fm.chapter}</p><h2 class="chapter-title">${esc(fm.title)}</h2></header><div class="chapter-body">${$.html()}</div></section>`);
      toc.push({ id: slug, label: `${fm.chapter}. ${fm.title}`, subs: $('h3').map((i, h) => ({ id: $(h).attr('id'), label: $(h).text() })).get() });
      continue;
    } else {
      sections.push(`<section class="matter ${slug}" id="${slug}"><h2 class="matter-title">${esc(fm.title)}</h2>${$.html()}</section>`);
    }
    toc.push({ id: slug, label: fm.title, subs: [] });
  }

  const tocHtml = `<nav class="toc" id="contents"><h2 class="matter-title">Contents</h2><ol class="toc-list">
${toc.map((t) => `<li class="toc-item"><a href="#${t.id}">${esc(t.label)}${pg(pages, t.id)}</a>${t.subs.length ? `<ol class="toc-subs">${t.subs.map((s) => `<li><a href="#${s.id}">${esc(s.label)}${pg(pages, s.id)}</a></li>`).join('')}</ol>` : ''}</li>`).join('\n')}
</ol></nav>`;

  const front = `
<section class="half-title"><p class="ht">${TITLE}</p></section>
<section class="title-page">
  <h1 class="tp-title">${TITLE}</h1>
  <p class="tp-sub">${SUBTITLE}</p>
  <p class="tp-author">${AUTHOR}</p>
</section>
<section class="copyright" id="copyright">${render('front/copyright.md', mode).$.html()}</section>
${tocHtml}`;

  const css = fs.readFileSync(path.join(ROOT, 'tools', 'book.css'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tools', mode === 'print' ? 'print.css' : 'web.css'), 'utf8');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${TITLE} — ${AUTHOR}</title>
<meta name="author" content="${AUTHOR}">
<style>
${css}
</style>
${mode === 'print' ? '<script src="paged.polyfill.js"></script>' : ''}
</head>
<body class="${mode}">
<div class="front">${front}</div>
<main class="body-matter">${sections.join('\n')}</main>
</body>
</html>`;
}

fs.mkdirSync(path.join(DIST, 'fonts'), { recursive: true });
for (const f of fs.readdirSync('front').filter((f) => /\.(svg|png|jpe?g)$/i.test(f))) fs.copyFileSync(path.join('front', f), path.join(DIST, f));
for (const f of ['latin-400-normal', 'latin-400-italic', 'latin-600-normal', 'latin-600-italic', 'latin-ext-400-normal', 'latin-ext-400-italic'])
  fs.copyFileSync(path.join(ROOT, 'node_modules/@fontsource/crimson-pro/files', `crimson-pro-${f}.woff2`), path.join(DIST, 'fonts', `crimson-pro-${f}.woff2`));

fs.writeFileSync(path.join(DIST, 'book.html'), assemble('web'), 'utf8');
console.log('dist/book.html');

if (wantPdf) {
  // Paged.js 0.4.3 drops a footnote whose call ends a justified line (its strict "left < right" test);
  // the same one-pixel patch as the Psalm 119 build (2026-11-15).
  let polyfill = fs.readFileSync(path.join(ROOT, 'node_modules/pagedjs/dist/paged.polyfill.js'), 'utf8');
  for (const [from, to] of [['if (left < right) {', 'if (left < right + 1) {'], ['noteCallBounds.left > right)', 'noteCallBounds.left > right + 1)']]) {
    if (polyfill.split(from).length !== 2) throw new Error(`paged.polyfill.js patch not found: ${from}`);
    polyfill = polyfill.replace(from, to);
  }
  fs.writeFileSync(path.join(DIST, 'paged.polyfill.js'), polyfill);
  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  await page.evaluateOnNewDocument(() => { window.PagedConfig = { auto: true, after: () => { window.__pagedDone = true; } }; });
  const layout = async (html) => {
    fs.writeFileSync(path.join(DIST, 'print.html'), html, 'utf8');
    await page.goto('file:///' + path.join(DIST, 'print.html').replace(/\\/g, '/'), { waitUntil: 'load', timeout: 0 });
    await page.waitForFunction(() => window.__pagedDone === true, { timeout: 0, polling: 500 });
  };
  await layout(assemble('print'));
  const pages = await page.evaluate(() => {
    const o = {};
    document.querySelectorAll('section[id], h3[id]').forEach((el) => {
      const p = el.closest('.pagedjs_page');
      if (p && el.id && !(el.id in o)) o[el.id] = +p.dataset.pageNumber;
    });
    return o;
  });
  await layout(assemble('print', pages));
  const fnProblems = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.pagedjs_page').forEach((pg) => {
      const n = pg.dataset.pageNumber;
      const calls = [...pg.querySelectorAll('.pagedjs_page_content .fn-ref')].map((e) => e.textContent.trim());
      const area = pg.querySelector('.pagedjs_footnote_area');
      const box = pg.querySelector('.pagedjs_pagebox')?.getBoundingClientRect() || null;
      const notes = {};
      pg.querySelectorAll('.pagedjs_footnote_area .footnote').forEach((f) => {
        const num = (f.querySelector('.fn-mark')?.textContent || '').replace('.', '').trim();
        notes[num] = !box || f.getBoundingClientRect().bottom <= box.bottom + 1;
      });
      for (const c of calls) {
        if (!(c in notes)) out.push(`page ${n}: footnote ${c} is called but its note is missing`);
        else if (!notes[c]) out.push(`page ${n}: footnote ${c} is cut off`);
      }
    });
    return out;
  });
  if (fnProblems.length) console.error(`FOOTNOTE PROBLEMS (${fnProblems.length}):\n  ` + fnProblems.join('\n  '));
  else console.log('footnotes: every call has its note on the same page');
  const total = await page.evaluate(() => document.querySelectorAll('.pagedjs_page').length);
  const pdfPath = path.join(DIST, 'Keeping-the-Heart-5x8.pdf');
  await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true, timeout: 0 });
  await browser.close();
  console.log(`${path.relative(ROOT, pdfPath)}  (${total} pages)`);
}
