// Build the book from front/, chapters/, back/:
//   dist/book.html                      web edition (footnotes open in place when tapped)
//   dist/print.html + dist/*.pdf        print edition, 5.5 x 8.5 in, laid out by Paged.js in headless Chrome
// Usage: node tools/build.mjs          (HTML only)
//        node tools/build.mjs --pdf    (HTML + PDF; two layout passes so the Scripture index gets page numbers)
import fs from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'node:url';
import { REF_RE, CHAPTER_RE, parseChain, exists, label, verse, BOOK_ORDER, BOOK_NAME, SINGLE_CHAPTER, config, UI, STANZA_NAMES, HTML_LANG } from './bible.mjs';
const BOOK_CODE = Object.fromEntries(Object.entries(BOOK_NAME).map(([c, n]) => [n, c]));

const ROOT = path.resolve('.'); // the book being built (content, dist/)
const TOOLS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // css, node_modules: shared by every language edition
const DIST = path.join(ROOT, 'dist');
const wantPdf = process.argv.includes('--pdf');
const refsOnly = process.argv.includes('--refs'); // Scripture footnotes: reference only, no verse text
// --trim 6x9 builds the PDF at another trim size (default 5.5 x 8.5 in, from print.css)
const trimArg = process.argv.includes('--trim') ? process.argv[process.argv.indexOf('--trim') + 1] : null;
const [trimW, trimH] = trimArg ? trimArg.split('x') : [];

const STANZAS = [
  ['א', 'Aleph'], ['ב', 'Beth'], ['ג', 'Gimel'], ['ד', 'Daleth'], ['ה', 'He'], ['ו', 'Waw'],
  ['ז', 'Zayin'], ['ח', 'Heth'], ['ט', 'Teth'], ['י', 'Yodh'], ['כ', 'Kaph'], ['ל', 'Lamedh'],
  ['מ', 'Mem'], ['נ', 'Nun'], ['ס', 'Samekh'], ['ע', 'Ayin'], ['פ', 'Pe'], ['צ', 'Tsadhe'],
  ['ק', 'Qoph'], ['ר', 'Resh'], ['ש', 'Shin'], ['ת', 'Taw'],
];

if (STANZA_NAMES) STANZAS.forEach((st, i) => { st[1] = STANZA_NAMES[i]; });
const md = new MarkdownIt({ html: true, linkify: false, typographer: false }).use(footnote);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function readMd(file) {
  const t = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = t.match(/^---\n([\s\S]*?)\n---\n?/);
  const fm = {};
  if (m) for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"');
  }
  return { fm, body: m ? t.slice(m[0].length) : t };
}

// ---- footnotes: markdown-it-footnote output -> inline notes ----
let fnSeq = 0;
function inlineFootnotes($, mode) {
  $('sup.footnote-ref').each((_, el) => {
    const a = $(el).find('a');
    const id = a.attr('href').slice(1);
    const li = $(`li#${id}`);
    li.find('a.footnote-backref').remove();
    let inner = li.find('p').length === 1 ? li.find('p').html() : li.html();
    inner = inner.trim();
    if (refsOnly) {
      const m = inner.match(/^((?:[123] ?)?[A-ZÁÉÍÓÚ][A-Za-zÁÉÍÓÚáéíóúñ]+(?: [A-Za-zÁÉÍÓÚáéíóúñ]+)* \d[\d:–,;\- A-Za-zÁÉÍÓÚáéíóúñ()]*?) — ([\s\S]*)$/);
      if (m) { const note = m[2].match(/ (\([^()]*\))\s*$/); inner = m[1] + (note ? ' ' + note[1] : ''); }
    }
    const n = a.text().replace(/[[\]]/g, '').replace(/:.*/, '');
    if (mode === 'print') {
      $(el).replaceWith(`<span class="fn-ref">${n}</span><span class="footnote"><span class="fn-mark">${n}.</span>${inner}</span>`);
    } else {
      const fid = `fn${++fnSeq}`;
      $(el).replaceWith(
        `<label class="fn-call" for="${fid}" title="${UI.footnote} ${n}">${n}</label><input type="checkbox" id="${fid}" class="fn-toggle"><span class="fn-body"><span class="fn-num">${n}</span> ${inner}</span>`,
      );
    }
  });
  $('section.footnotes, hr.footnotes-sep').remove();
}

// ---- scripture anchors for the index ----
const occurrences = []; // {id, refs:[...], chapter}
let refSeq = 0;
function anchorRefs($, scope, chapterLabel) {
  const walk = (node) => {
    if (node.type === 'text') {
      const t = node.data;
      // verse references, plus whole-chapter mentions ("Psalm 18", "Isaiah 53") except Psalm 119 itself
      const hits = [];
      for (const m of t.matchAll(new RegExp(REF_RE.source, 'gi'))) {
        const refs = parseChain(m[1]).filter(exists);
        if (refs.length) hits.push({ i: m.index, len: m[0].length, refs });
      }
      for (const m of t.matchAll(new RegExp(CHAPTER_RE.source, 'g'))) {
        if (hits.some((h) => m.index < h.i + h.len && h.i < m.index + m[0].length)) continue;
        const book = BOOK_CODE[/^(Psalms|Salmos)$/.test(m[1]) ? BOOK_NAME.psa : m[1].replace(/\s+/g, ' ')];
        const r = { book, ch: +m[2], v1: null, v2: null };
        if (!book || (book === 'psa' && r.ch === 119) || !exists(r)) continue;
        hits.push({ i: m.index, len: m[0].length, refs: [r] });
      }
      hits.sort((a, b) => a.i - b.i);
      let out = '';
      let last = 0;
      let hit = false;
      for (const h of hits) {
        const id = `r${++refSeq}`;
        occurrences.push({ id, refs: h.refs, chapter: chapterLabel });
        out += esc(t.slice(last, h.i)) + `<span class="sref" id="${id}">${esc(t.slice(h.i, h.i + h.len))}</span>`;
        last = h.i + h.len;
        hit = true;
      }
      if (hit) $(node).replaceWith(out + esc(t.slice(last)));
      return;
    }
    if (node.type !== 'tag') return;
    const cls = $(node).attr('class') || '';
    if (/\b(footnote|fn-body|fn-call|sref)\b/.test(cls) || node.name === 'label') return;
    for (const c of [...(node.children || [])]) walk(c);
  };
  scope.each((_, el) => walk(el));
}
// Psalm 119 verses each chapter is about; the index leaves out a chapter's references to its own verses
const ownVerses = {};
const isOwnVerse = (r, o) => {
  const own = ownVerses[o.chapter];
  return own && r.book === 'psa' && r.ch === 119 && r.v1 != null && r.v1 >= own[0] && (r.v2 ?? r.v1) <= own[1];
};
function addOccurrence(refs, chapterLabel) {
  const id = `r${++refSeq}`;
  occurrences.push({ id, refs, chapter: chapterLabel });
  return id;
}

// the BSB's marked plural "you+" (Michael's revision, 2026-11-19): a small raised plus
const PLUS = /([A-Za-z])\+/g;
const plusHtml = (h) => h.replace(PLUS, '$1<span class="pl">+</span>');
function markPlural($) {
  $('p, li').each((_, el) => {
    const h = $(el).html();
    if (PLUS.test(h)) $(el).html(plusHtml(h));
    PLUS.lastIndex = 0;
  });
}

// ---- assemble ----
function chapterHtml(file, mode) {
  const { fm, body } = readMd(file);
  const n = +fm.chapter;
  const [v1, v2] = fm.verses.replace('119:', '').split('-').map(Number);
  const $ = cheerio.load(md.render(body), null, false);
  inlineFootnotes($, mode);
  $('blockquote').each((_, bq) => { if ($(bq).find('cite').length) $(bq).addClass('scripture'); });
  const chLabel = `${UI.chapterShort} ${n}`;
  ownVerses[chLabel] = [v1, v2];
  anchorRefs($, $.root().children(), chLabel);
  markPlural($);
  const openerId = addOccurrence([{ book: 'psa', ch: 119, v1, v2 }], chLabel);
  const lines = [];
  for (let v = v1; v <= v2; v++) lines.push(`<p><sup>${v}</sup>${plusHtml(esc(verse('psa', 119, v)))}</p>`);
  return `
<section class="chapter" id="ch${n}">
  <header class="chapter-head">
    <p class="chapter-num">${UI.chapter} ${n}</p>
    <h2 class="chapter-title">${esc(fm.title)}</h2>
    <p class="chapter-ref" id="${openerId}">${BOOK_NAME.psa} 119:${v1}–${v2}</p>
  </header>
  <div class="opener">${lines.join('')}</div>
  <div class="chapter-body">${$.html()}</div>
</section>`;
}

function proseSection(file, cls, id, mode) {
  const { fm, body } = readMd(file);
  const $ = cheerio.load(md.render(body), null, false);
  inlineFootnotes($, mode);
  markPlural($);
  const html = $.html();
  return `<section class="${cls}" id="${id}">${fm.title ? `<h2 class="matter-title">${esc(fm.title)}</h2>` : ''}${html}</section>`;
}

function buildIndex(pages, mode) {
  // entries keyed by book, chapter, verse range
  const map = new Map();
  for (const o of occurrences) {
    for (const r of o.refs) {
      if (isOwnVerse(r, o)) continue;
      const key = `${String(BOOK_ORDER[r.book]).padStart(2, '0')}|${String(r.ch).padStart(3, '0')}|${String(r.v1 ?? 0).padStart(3, '0')}|${String(r.v2 ?? 0).padStart(3, '0')}`;
      if (!map.has(key)) map.set(key, { r, occ: [] });
      map.get(key).occ.push(o);
    }
  }
  // run-in layout: one paragraph per chapter, "verses locations; verses locations; …"
  const keys = [...map.keys()].sort();
  let html = '';
  let curBook = null;
  let curCh = null;
  const close = () => { if (curCh != null) html += '</p>'; };
  for (const k of keys) {
    const { r, occ } = map.get(k);
    const bookName = r.book === 'psa' ? UI.psalmsBook : esc(BOOK_NAME[r.book]);
    if (r.book !== curBook) {
      close();
      html += `<h3 class="ix-book">${bookName}</h3>`;
      curBook = r.book;
      curCh = null;
    }
    if (r.ch !== curCh) {
      close();
      const chn = SINGLE_CHAPTER.has(r.book) ? '' : `<span class="ix-chn">${r.ch}</span> `;
      html += `<p class="ix-ch" data-book="${bookName}">${chn}`;
      curCh = r.ch;
    } else html += '; ';
    const lab = r.v1 == null ? `<i>${UI.whole}</i>` : r.v1 === r.v2 ? `${r.v1}` : `${r.v1}–${r.v2}`;
    let locs;
    if (mode === 'print' && pages) {
      const ps = [...new Set(occ.map((o) => pages[o.id]).filter(Boolean))].sort((a, b) => a - b);
      locs = ps.join(', ');
    } else if (mode === 'print') {
      locs = occ.map((o) => `<a href="#${o.id}"></a>`).join(', ');
    } else {
      const seen = new Set();
      locs = occ.filter((o) => !seen.has(o.chapter) && seen.add(o.chapter)).map((o) => `<a href="#${o.id}">${o.chapter}</a>`).join(', ');
    }
    html += `<span class="ix-ref">${lab}</span>&nbsp;<span class="ix-locs">${locs}</span>`;
  }
  close();
  return `<section class="scripture-index" id="index"><h2 class="matter-title">${UI.scriptureIndex}</h2>${mode === 'web' ? `<p class="ix-note">${UI.ixNote}</p>` : ''}<div class="ix-cols">${html}</div></section>`;
}

const pg = (pages, id) => (pages && pages[id] ? `<span class="toc-pg">${pages[id]}</span>` : '');
function assemble(mode, pages) {
  occurrences.length = 0;
  refSeq = 0;
  fnSeq = 0;
  const chapters = fs.readdirSync('chapters').filter((f) => f.endsWith('.md')).sort();
  const parts = [];
  const toc = [];
  STANZAS.forEach(([glyph, name], i) => {
    const a = i * 8 + 1;
    const b = a + 7;
    const chs = chapters.filter((f) => {
      const { fm } = readMd(path.join('chapters', f));
      const v = +fm.verses.replace('119:', '').split('-')[0];
      return v >= a && v <= b;
    });
    const chHtml = chs.map((f) => chapterHtml(path.join('chapters', f), mode)).join('\n');
    const chMeta = chs.map((f) => readMd(path.join('chapters', f)).fm);
    toc.push({ glyph, name, a, b, i: i + 1, chMeta });
    parts.push(`
<section class="part" id="part${i + 1}">
  <p class="part-num">${UI.part} ${i + 1}</p>
  <p class="part-glyph" lang="he">${glyph}</p>
  <h1 class="part-title">${name}</h1>
  <p class="part-ref">${BOOK_NAME.psa} 119:${a}–${b}</p>
</section>
${chHtml}`);
  });

  const tocHtml = `<nav class="toc" id="contents"><h2 class="matter-title">${UI.contents}</h2><ol class="toc-list">
<li class="toc-matter"><a href="#introduction">${UI.introduction}${pg(pages, 'introduction')}</a></li>
${toc.map((p) => `<li class="toc-part"><a href="#part${p.i}"><span class="toc-glyph" lang="he">${p.glyph}</span> ${p.name} <span class="toc-vv">119:${p.a}–${p.b}</span></a>
  <ol>${p.chMeta.map((c) => `<li class="toc-ch"><a href="#ch${c.chapter}"><span class="toc-n">${c.chapter}.</span> ${esc(c.title)} <span class="toc-vv">${c.verses.replace('119:', '')}</span>${pg(pages, 'ch' + c.chapter)}</a></li>`).join('')}</ol></li>`).join('\n')}
<li class="toc-matter"><a href="#afterword">${UI.afterword}${pg(pages, 'afterword')}</a></li>
<li class="toc-matter"><a href="#about">${UI.aboutAuthor}${pg(pages, 'about')}</a></li>
<li class="toc-matter"><a href="#index">${UI.scriptureIndex}${pg(pages, 'index')}</a></li>
</ol></nav>`;

  const front = `
<section class="half-title"><p class="ht">${esc(config.title)}</p></section>
<section class="title-page">
  <p class="tp-glyph" lang="he">א</p>
  <h1 class="tp-title">${esc(config.title)}</h1>
  <p class="tp-author">${esc(config.author)}</p>
</section>
${proseSection('front/copyright.md', 'copyright', 'copyright')}
${proseSection('front/dedication.md', 'dedication', 'dedication')}
${tocHtml}
${proseSection('front/introduction.md', 'matter introduction', 'introduction', mode)}`;

  const back = `${proseSection('back/afterword.md', 'matter afterword', 'afterword')}
${proseSection('back/about-the-author.md', 'matter about', 'about')}`;
  const index = buildIndex(pages, mode);
  let css = fs.readFileSync(path.join(TOOLS_ROOT, 'tools', mode === 'print' ? 'print.css' : 'web.css'), 'utf8');
  if (mode === 'print' && trimArg) css = css.replace(/size: [\d.]+in [\d.]+in;/, `size: ${trimW}in ${trimH}in;`)
    .replace('html { font-size: 10.5pt; }', `html { font-size: ${+trimW >= 6 ? 11 : 10.5}pt; }`); // 11 pt on the wider page
  css = css.replace('content: "Meditations on Psalm 119"', `content: ${JSON.stringify(config.title)}`); // running head
  const shared = fs.readFileSync(path.join(TOOLS_ROOT, 'tools', 'book.css'), 'utf8');

  return `<!doctype html>
<html lang="${HTML_LANG}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(config.title)} — ${esc(config.author)}</title>
<meta name="author" content="${esc(config.author)}">
<style>
${shared}
${css}
</style>
${mode === 'print' ? '<script src="paged.polyfill.js"></script>' : ''}
</head>
<body class="${mode}">
<div class="front">${front}</div>
<main class="body-matter">${parts.join('\n')}</main>
<div class="back">${back}${index}</div>
</body>
</html>`;
}

// ---- output ----
fs.mkdirSync(path.join(DIST, 'fonts'), { recursive: true });
for (const f of fs.readdirSync('front').filter((f) => /\.(svg|png|jpe?g)$/i.test(f))) fs.copyFileSync(path.join('front', f), path.join(DIST, f));
const FONT_SRC = {
  'crimson-pro-latin-400-normal.woff2': '@fontsource/crimson-pro/files/crimson-pro-latin-400-normal.woff2',
  'crimson-pro-latin-400-italic.woff2': '@fontsource/crimson-pro/files/crimson-pro-latin-400-italic.woff2',
  'crimson-pro-latin-600-normal.woff2': '@fontsource/crimson-pro/files/crimson-pro-latin-600-normal.woff2',
  'crimson-pro-latin-600-italic.woff2': '@fontsource/crimson-pro/files/crimson-pro-latin-600-italic.woff2',
  'crimson-pro-latin-ext-400-normal.woff2': '@fontsource/crimson-pro/files/crimson-pro-latin-ext-400-normal.woff2',
  'crimson-pro-latin-ext-400-italic.woff2': '@fontsource/crimson-pro/files/crimson-pro-latin-ext-400-italic.woff2',
  'noto-serif-hebrew-400.woff2': '@fontsource/noto-serif-hebrew/files/noto-serif-hebrew-hebrew-400-normal.woff2',
};
for (const [dest, src] of Object.entries(FONT_SRC)) fs.copyFileSync(path.join(TOOLS_ROOT, 'node_modules', src), path.join(DIST, 'fonts', dest));

const web = assemble('web');
fs.writeFileSync(path.join(DIST, 'book.html'), web, 'utf8');
console.log(`dist/book.html  (${occurrences.length} scripture citations indexed)`);

if (wantPdf) {
  // Paged.js 0.4.3 drops a footnote whose call ends a justified line: the note sits exactly on the right edge
  // of the text, fails its strict "left < right" test, and is never moved to the footnote area (8 notes were
  // lost this way, e.g. 1 John 3:6 on page 67, 2026-11-15). Allow a pixel of slack in both tests.
  let polyfill = fs.readFileSync(path.join(TOOLS_ROOT, 'node_modules/pagedjs/dist/paged.polyfill.js'), 'utf8');
  for (const [from, to] of [['if (left < right) {', 'if (left < right + 1) {'], ['noteCallBounds.left > right)', 'noteCallBounds.left > right + 1)']]) {
    if (polyfill.split(from).length !== 2) throw new Error(`paged.polyfill.js patch not found: ${from}`);
    polyfill = polyfill.replace(from, to);
  }
  fs.writeFileSync(path.join(DIST, 'paged.polyfill.js'), polyfill);
  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.launch({ executablePath: config.browser, headless: true, args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  const render = async (html) => {
    fs.writeFileSync(path.join(DIST, 'print.html'), html, 'utf8');
    await page.goto('file:///' + path.join(DIST, 'print.html').replace(/\\/g, '/'), { waitUntil: 'load', timeout: 0 });
    await page.waitForFunction(() => window.__pagedDone === true, { timeout: 0, polling: 500 });
  };
  // flag when Paged.js finishes
  await page.evaluateOnNewDocument(() => {
    window.PagedConfig = { auto: true, after: () => { window.__pagedDone = true; } };
  });
  // pass 1: layout, read page numbers of every citation
  await render(assemble('print'));
  const pages = await page.evaluate(() => {
    const o = {};
    document.querySelectorAll('.sref, .chapter-ref, section[id], nav[id]').forEach((el) => {
      const pg = el.closest('.pagedjs_page');
      if (pg && el.id) o[el.id] = +pg.dataset.pageNumber;
    });
    return o;
  });
  // pass 2: same layout with the index filled in
  await render(assemble('print', pages));
  // label index columns that continue a book from the previous column: "Psalms (cont.)".
  // Each index page reserves an empty line above its columns (print.css), so the labels don't move any text.
  await page.evaluate((CONT) => {
    document.querySelectorAll('.pagedjs_page .ix-cols').forEach((cols) => {
      const box = cols.getBoundingClientRect();
      const mid = box.left + box.width / 2;
      const first = [null, null]; // per column: {top, el}
      cols.querySelectorAll('.ix-book, .ix-ch').forEach((el) => {
        for (const rc of el.getClientRects()) {
          const c = rc.left < mid ? 0 : 1;
          if (!first[c] || rc.top < first[c].top) first[c] = { top: rc.top, el };
        }
      });
      first.forEach((f, c) => {
        if (!f || f.el.classList.contains('ix-book')) return;
        const lab = document.createElement('div');
        lab.className = 'ix-cont';
        lab.textContent = `${f.el.dataset.book} (${CONT})`;
        lab.style.left = c ? '50%' : '0';
        cols.appendChild(lab);
      });
      // running head: the books on this page, e.g. "Psalms – Proverbs"
      const chs = cols.querySelectorAll('.ix-ch');
      if (chs.length) {
        const a = chs[0].dataset.book, b = chs[chs.length - 1].dataset.book;
        cols.closest('.pagedjs_page').style.setProperty('--pagedjs-string-first-ixbook', `"${a === b ? a : `${a} – ${b}`}"`);
      }
    });
  }, UI.cont);
  // Footnote check: every number called on a page must have its note on that page, and the note must not be
  // cut off. Paged.js silently drops notes that do not fit (it did on the last page of chapter 11, 2026-11-15).
  const fnProblems = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.pagedjs_page').forEach((pg) => {
      const n = pg.dataset.pageNumber;
      const calls = [...pg.querySelectorAll('.pagedjs_page_content .fn-ref')].map((e) => e.textContent.trim());
      const area = pg.querySelector('.pagedjs_footnote_area');
      const box = area ? area.getBoundingClientRect() : null;
      const notes = {};
      pg.querySelectorAll('.pagedjs_footnote_area .footnote').forEach((f) => {
        const num = (f.querySelector('.fn-mark')?.textContent || '').replace('.', '').trim();
        const r = f.getBoundingClientRect();
        notes[num] = !box || r.bottom <= box.bottom + 1;
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
  const pdfPath = path.join(DIST, `${config.title.replace(/\s+/g, '-')}${trimArg ? '-' + trimArg : ''}${refsOnly ? '-refs' : ''}.pdf`);
  await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true, timeout: 0 });
  await browser.close();
  console.log(`${path.relative(ROOT, pdfPath)}  (${total} pages)`);
}
