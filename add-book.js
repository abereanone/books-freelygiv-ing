#!/usr/bin/env node
/**
 * Interactive CLI for adding a book to books-data.
 * Run: node add-book.js
 */

import { createInterface } from 'readline';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_SRC = join(__dirname, 'data', 'src');
const BOOKS_SRC = join(DATA_SRC, 'books');

// ── helpers ──────────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question, defaultValue = '') {
  return new Promise(resolve => {
    const hint = defaultValue ? ` [${defaultValue}]` : '';
    rl.question(`${question}${hint}: `, answer => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

function askMultiChoice(question, choices) {
  console.log(`\n${question}`);
  choices.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  return new Promise(resolve => {
    rl.question('Enter numbers separated by commas (e.g. 1,3): ', answer => {
      const selected = answer.split(',')
        .map(s => parseInt(s.trim(), 10) - 1)
        .filter(i => i >= 0 && i < choices.length)
        .map(i => choices[i]);
      resolve(selected);
    });
  });
}

function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/[''']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

// ── author YAML ───────────────────────────────────────────────────────────────

function buildAuthorYaml({ firstName, lastName, slug, photoExt, description, donateUrl }) {
  const ext = photoExt || 'jpg';
  return `- firstName: "${firstName}"
  lastName: "${lastName}"
  slug: "${slug}"
  photo: "/static/images/authors/${slug}/${slug}.${ext}"
  description: >
    ${description}
  donateUrl: "${donateUrl || ''}"
`;
}

// ── book YAML ─────────────────────────────────────────────────────────────────

const R2_BASE = 'https://files.books.freelygiv.ing';

function buildBookYaml({ title, sortTitle, authorSlugs, year, pages, tag, description, license, contributors, formats }) {
  const bookSlug = toSlug(title);
  const sitePath = `/static/books/${bookSlug}`;
  const r2Path   = `${R2_BASE}/${bookSlug}`;

  const authorsYaml = authorSlugs.map(slug => `    - ${slug}`).join('\n');

  const contributorsYaml = contributors.length > 0
    ? contributors.map(c => `    - ${c}`).join('\n')
    : '    []';

  const mediaTypeEntries = [];

  if (formats.includes('ePub')) {
    mediaTypeEntries.push(`    - type: eBook
      label: eBook
      sources:
        - name: Download
          url: "${r2Path}/${bookSlug}.epub"`);
  }

  if (formats.includes('PDF')) {
    mediaTypeEntries.push(`    - type: pdfBook
      label: PDF
      sources:
        - name: Download
          url: "${r2Path}/${bookSlug}.pdf"`);
  }

  if (formats.includes('Print/Amazon')) {
    mediaTypeEntries.push(`    - type: printBook
      label: Book
      sources:
        - name: Amazon
          url: ""`);
  }

  if (formats.includes('Print-Ready ZIP')) {
    mediaTypeEntries.push(`    - type: printReady
      label: Print Ready
      sources:
        - name: Download
          url: "${r2Path}/print-ready.zip"`);
  }

  // sitePath is used only for the cover image (served from Cloudflare Pages)
  const basePath = sitePath;

  return `- title: "${title}"
  sortTitle: "${sortTitle}"
  authors:
${authorsYaml}
  year: ${year}${pages ? `\n  pages: ${pages}` : ''}
  tags:
    - ${tag}
  contributors:
${contributorsYaml}
  description: >
    ${description}
  license: ${license}
  path: ${basePath}
  cover: cover.jpg
  mediaTypes:
${mediaTypeEntries.join('\n')}
`;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n📚  Add a book to books-data\n');
  ensureDir(DATA_SRC);
  ensureDir(BOOKS_SRC);

  // ── author ──
  console.log('── Author ───────────────────────────────');
  const firstName = await ask('First name');
  const lastName  = await ask('Last name');
  const authorSlug = toSlug(`${firstName} ${lastName}`);
  console.log(`  → slug: ${authorSlug}`);

  const authorDir  = join(DATA_SRC, authorSlug);
  const authorFile = join(authorDir, 'author.yaml');
  let authorExists = existsSync(authorFile);
  let photoExt = 'jpg';

  if (authorExists) {
    console.log(`  ✓ Author folder already exists — skipping author.yaml creation.`);
  } else {
    ensureDir(authorDir);
    console.log('\n  (Leave bio blank to edit the YAML file manually afterward)');
    const description = await ask('Bio / description (one paragraph)');
    const donateUrl   = await ask('Donate URL (optional)', '');
    photoExt = await ask('Photo file extension', 'jpg');

    writeFileSync(authorFile, buildAuthorYaml({ firstName, lastName, slug: authorSlug, photoExt, description, donateUrl }));
    console.log(`  ✓ Written: ${authorFile}`);
  }

  const extraAuthorInput = await ask('Additional author slugs (comma-separated, or blank)', '');
  const authorSlugs = [
    authorSlug,
    ...(extraAuthorInput ? extraAuthorInput.split(',').map(s => s.trim()).filter(Boolean) : []),
  ];

  // ── book ──
  console.log('\n── Book ─────────────────────────────────');
  const title     = await ask('Title');
  const sortTitle = await ask('Sort title (omit leading "The", "A", etc.)', title);
  const bookSlug  = toSlug(title);
  console.log(`  → slug: ${bookSlug}`);

  const year        = await ask('Year published');
  const pagesInput  = await ask('Page count (blank to skip)', '');
  const pages       = pagesInput ? parseInt(pagesInput, 10) : null;
  const tagChoice   = await ask('Tag (classic / modern)', 'classic');
  const tag         = tagChoice === 'modern' ? 'modern' : 'classic';
  const license     = await ask('License', 'CC0');
  const description = await ask('Description (one paragraph)');

  const contribInput = await ask('Contributor slugs (comma-separated, or blank)', '');
  const contributors = contribInput
    ? contribInput.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const availableFormats = ['ePub', 'PDF', 'Print/Amazon', 'Print-Ready ZIP'];
  const formats = await askMultiChoice('Which formats exist?', availableFormats);

  // ── write files ──
  const bookDir     = join(BOOKS_SRC, bookSlug);
  const contentDir  = join(bookDir, 'content');
  const bookFile    = join(bookDir, 'book.yaml');

  ensureDir(contentDir);
  writeFileSync(bookFile, buildBookYaml({
    title, sortTitle, authorSlugs,
    year, pages, tag, description, license, contributors, formats
  }));

  console.log(`\n✅  Done!\n`);
  console.log(`  Written: ${bookFile}`);
  console.log(`  Content folder: ${contentDir}\n`);
  console.log('── Copy these files into the content folder ──────────────────');
  console.log(`  content/cover.jpg`);
  if (formats.includes('ePub'))          console.log(`  content/${bookSlug}.epub`);
  if (formats.includes('PDF'))           console.log(`  content/${bookSlug}.pdf`);
  if (formats.includes('Print-Ready ZIP')) console.log(`  content/print-ready.zip`);
  if (formats.includes('Print/Amazon'))  console.log(`\n  ⚠  Update the Amazon URL in:\n     ${bookFile}`);
  if (!authorExists) {
    console.log(`\n  Also copy author photo to:\n     ${join(authorDir, `${authorSlug}.${photoExt}`)}`);
  }
  console.log('');

  rl.close();
}

main().catch(err => {
  console.error(err);
  rl.close();
  process.exit(1);
});
