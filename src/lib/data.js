import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';

// process.cwd() = project root (C:\code\books\books) in both dev and build.
// Using it here rather than import.meta.url because Vite transforms the latter
// to a bundled virtual path during astro build, breaking relative resolution.
const DATA_SRC = join(process.cwd(), 'data/src');

function listPersonSlugs() {
  if (!existsSync(DATA_SRC)) return [];
  return readdirSync(DATA_SRC).filter(s => statSync(join(DATA_SRC, s)).isDirectory());
}

export function getAuthors() {
  return listPersonSlugs().flatMap(slug => {
    const f = join(DATA_SRC, slug, 'author.yaml');
    return existsSync(f) ? YAML.parse(readFileSync(f, 'utf8')) : [];
  });
}

export function getContributors() {
  return listPersonSlugs().flatMap(slug => {
    const f = join(DATA_SRC, slug, 'contributor.yaml');
    return existsSync(f) ? YAML.parse(readFileSync(f, 'utf8')) : [];
  });
}

export function getBooks() {
  return listPersonSlugs().flatMap(personSlug => {
    const personDir = join(DATA_SRC, personSlug);
    return readdirSync(personDir)
      .filter(entry => statSync(join(personDir, entry)).isDirectory())
      .flatMap(bookSlug => {
        const f = join(personDir, bookSlug, 'book.yaml');
        return existsSync(f) ? YAML.parse(readFileSync(f, 'utf8')) : [];
      });
  });
}

/** One {book, person} pair per primary author and per contributor. Pre-sorted by lastName. */
export function getBookAuthorPairs() {
  const allPeople = {};
  for (const slug of listPersonSlugs()) {
    const dir = join(DATA_SRC, slug);
    const f = existsSync(join(dir, 'author.yaml'))
      ? join(dir, 'author.yaml')
      : existsSync(join(dir, 'contributor.yaml'))
        ? join(dir, 'contributor.yaml')
        : null;
    if (f) {
      const data = YAML.parse(readFileSync(f, 'utf8'));
      if (Array.isArray(data) && data[0]) allPeople[data[0].slug] = data[0];
    }
  }

  const pairs = [];
  const seen = new Set();
  for (const book of getBooks()) {
    for (const author of (book.authors || [])) {
      const key = `${book.path}::${author.slug}`;
      if (!seen.has(key)) { seen.add(key); pairs.push({ book, person: author }); }
    }
    for (const contribSlug of (book.contributors || [])) {
      const key = `${book.path}::${contribSlug}`;
      if (!seen.has(key)) {
        seen.add(key);
        const p = allPeople[contribSlug];
        if (p) pairs.push({ book, person: { slug: p.slug, firstName: p.firstName, lastName: p.lastName } });
      }
    }
  }

  return pairs.sort((a, b) => a.person.lastName.toLowerCase().localeCompare(b.person.lastName.toLowerCase()));
}

// ── template helpers ──────────────────────────────────────────────────────────

export function authorNames(authors) {
  if (!authors?.length) return '';
  return authors.map(a => `${a.firstName} ${a.lastName}`).join(', ');
}

export function linkify(text) {
  if (!text) return text;
  return text.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

export function newlineToBr(text) {
  if (!text) return text;
  return text.replace(/\n/g, '<br>\n');
}

/** Extract the book slug from its data path (/static/books/author/book → book) */
export function bookSlugFromPath(path) {
  return path.split('/').pop();
}
