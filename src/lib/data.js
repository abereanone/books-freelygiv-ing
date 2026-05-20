import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';

// process.cwd() = project root (C:\code\books\books) in both dev and build.
// Using it here rather than import.meta.url because Vite transforms the latter
// to a bundled virtual path during astro build, breaking relative resolution.
const DATA_SRC = join(process.cwd(), 'data/src');
const BOOKS_SRC = join(DATA_SRC, 'books');

function listPersonSlugs() {
  if (!existsSync(DATA_SRC)) return [];
  return readdirSync(DATA_SRC).filter(s => s !== 'books' && statSync(join(DATA_SRC, s)).isDirectory());
}

function readYamlArray(file) {
  const parsed = YAML.parse(readFileSync(file, 'utf8'));
  return Array.isArray(parsed) ? parsed : [];
}

export function getAuthors() {
  return listPersonSlugs().flatMap(slug => {
    const f = join(DATA_SRC, slug, 'author.yaml');
    return existsSync(f) ? readYamlArray(f) : [];
  });
}

export function getContributors() {
  return listPersonSlugs().flatMap(slug => {
    const f = join(DATA_SRC, slug, 'contributor.yaml');
    return existsSync(f) ? readYamlArray(f) : [];
  });
}

function personBySlug(people) {
  return Object.fromEntries(people.map(person => [person.slug, person]));
}

function normalizeAuthorRef(ref, authorsBySlug) {
  if (typeof ref === 'string') return authorsBySlug[ref] ?? { slug: ref, firstName: ref, lastName: '' };
  if (ref?.slug) return authorsBySlug[ref.slug] ?? ref;
  return ref;
}

function getBookDirs() {
  const dirs = [];

  if (existsSync(BOOKS_SRC)) {
    for (const bookSlug of readdirSync(BOOKS_SRC)) {
      const bookDir = join(BOOKS_SRC, bookSlug);
      if (statSync(bookDir).isDirectory()) dirs.push({ bookSlug, bookDir });
    }
  }

  for (const personSlug of listPersonSlugs()) {
    const personDir = join(DATA_SRC, personSlug);
    for (const entry of readdirSync(personDir)) {
      const bookDir = join(personDir, entry);
      if (statSync(bookDir).isDirectory() && existsSync(join(bookDir, 'book.yaml'))) {
        dirs.push({ bookSlug: entry, bookDir });
      }
    }
  }

  return dirs;
}

export function getBooks() {
  const authorsBySlug = personBySlug(getAuthors());

  return getBookDirs().flatMap(({ bookSlug, bookDir }) => {
    const f = join(bookDir, 'book.yaml');
    return existsSync(f)
      ? readYamlArray(f).map(book => ({
        ...book,
        path: book.path ?? `/static/books/${bookSlug}`,
        authors: (book.authors || []).map(author => normalizeAuthorRef(author, authorsBySlug)).filter(Boolean),
      }))
      : [];
  });
}

/** One {book, person} pair per primary author and per contributor. Pre-sorted by lastName. */
export function getBookAuthorPairs() {
  const allPeople = personBySlug([...getAuthors(), ...getContributors()]);

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
  // > folded scalar: paragraphs separated by \n (within-para breaks become spaces)
  // | literal scalar: paragraphs separated by \n\n (within-para breaks are \n)
  const separator = text.includes('\n\n') ? /\n\n+/ : /\n/;
  return text
    .split(separator)
    .map(para => para.trim().replace(/\n/g, ' '))
    .filter(para => para.length > 0)
    .map(para => `<p>${para}</p>`)
    .join('\n');
}

export function personPhotos(person, limit = 2) {
  const photos = Array.isArray(person?.photos)
    ? person.photos
    : person?.photos
      ? [person.photos]
      : person?.photo
        ? [person.photo]
        : [];

  return photos.filter(Boolean).slice(0, limit);
}

/** Extract the book slug from its data path (/static/books/book → book) */
export function bookSlugFromPath(path) {
  return path.split('/').pop();
}
