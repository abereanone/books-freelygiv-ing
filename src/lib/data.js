import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { join } from "path";
import YAML from "yaml";

// process.cwd() = project root (C:\code\books\books) in both dev and build.
// Using it here rather than import.meta.url because Vite transforms the latter
// to a bundled virtual path during astro build, breaking relative resolution.
const DATA_SRC = join(process.cwd(), "data/src");
const BOOKS_SRC = join(DATA_SRC, "books");

function listPersonSlugs() {
  if (!existsSync(DATA_SRC)) return [];
  return readdirSync(DATA_SRC).filter(
    (s) => s !== "books" && statSync(join(DATA_SRC, s)).isDirectory(),
  );
}

function readYamlArray(file) {
  const parsed = YAML.parse(readFileSync(file, "utf8"));
  return Array.isArray(parsed) ? parsed : [];
}

export function getAuthors() {
  return listPersonSlugs().flatMap((slug) => {
    const f = join(DATA_SRC, slug, "author.yaml");
    return existsSync(f) ? readYamlArray(f) : [];
  });
}

export function getContributors() {
  return listPersonSlugs().flatMap((slug) => {
    const f = join(DATA_SRC, slug, "contributor.yaml");
    return existsSync(f) ? readYamlArray(f) : [];
  });
}

function personBySlug(people) {
  return Object.fromEntries(people.map((person) => [person.slug, person]));
}

function normalizeAuthorRef(ref, authorsBySlug) {
  if (typeof ref === "string")
    return authorsBySlug[ref] ?? { slug: ref, firstName: ref, lastName: "" };
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
      if (
        statSync(bookDir).isDirectory() &&
        existsSync(join(bookDir, "book.yaml"))
      ) {
        dirs.push({ bookSlug: entry, bookDir });
      }
    }
  }

  return dirs;
}

/**
 * Every visible book. `hidden: true` in book.yaml drops the book from the whole site —
 * its own page, every listing, and the sitemap — while leaving the YAML in place. This
 * is the only place that filter lives, so nothing can accidentally leak a hidden book.
 */
export function getBooks() {
  const authorsBySlug = personBySlug(getAuthors());

  return getBookDirs().flatMap(({ bookSlug, bookDir }) => {
    const f = join(bookDir, "book.yaml");
    return existsSync(f)
      ? readYamlArray(f)
          .filter((book) => !book.hidden)
          .map((book) => ({
            ...book,
            path: book.path ?? `/static/books/${bookSlug}`,
            authors: (book.authors || [])
              .map((author) => normalizeAuthorRef(author, authorsBySlug))
              .filter(Boolean),
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
    for (const author of book.authors || []) {
      const key = `${book.path}::${author.slug}`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push({ book, person: author });
      }
    }
    for (const contribSlug of book.contributors || []) {
      const key = `${book.path}::${contribSlug}`;
      if (!seen.has(key)) {
        seen.add(key);
        const p = allPeople[contribSlug];
        if (p)
          pairs.push({
            book,
            person: {
              slug: p.slug,
              firstName: p.firstName,
              lastName: p.lastName,
            },
          });
      }
    }
  }

  return pairs.sort((a, b) =>
    a.person.lastName
      .toLowerCase()
      .localeCompare(b.person.lastName.toLowerCase()),
  );
}

// ── template helpers ──────────────────────────────────────────────────────────

export function authorNames(authors) {
  if (!authors?.length) return "";
  return authors.map(personName).join(", ");
}

export function personName(person) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(" ").trim();
}

export function linkify(text) {
  if (!text) return text;
  return text.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  );
}

export function newlineToBr(text) {
  if (!text) return text;
  // > folded scalar: paragraphs separated by \n (within-para breaks become spaces)
  // | literal scalar: paragraphs separated by \n\n (within-para breaks are \n)
  const separator = text.includes("\n\n") ? /\n\n+/ : /\n/;
  return text
    .split(separator)
    .map((para) => para.trim().replace(/\n/g, " "))
    .filter((para) => para.length > 0)
    .map((para) => `<p>${para}</p>`)
    .join("\n");
}

/**
 * Every person by slug, with the page to link them to.
 *
 * A person is just a person: they may be an author on one book and a contributor on
 * another, or both at once. The site still routes them to /authors/ or /contributors/
 * depending on which yaml they have, so resolve the link here rather than assuming —
 * hardcoding /authors/<slug>/ 404s for anyone defined only as a contributor.
 * When someone has both, the author page wins; it's the fuller one.
 */
export function getPeopleBySlug() {
  const map = {};
  for (const person of getContributors()) {
    map[person.slug] = { ...person, href: `/contributors/${person.slug}/` };
  }
  for (const person of getAuthors()) {
    map[person.slug] = { ...person, href: `/authors/${person.slug}/` };
  }
  return map;
}

/**
 * CSS object-position for a person's photo.
 *
 * The person templates crop to a square with `object-fit: cover`, which defaults to the
 * centre — on a tall head-and-shoulders portrait that centres on the chest and cuts the
 * top of the head off. Anchoring to the top fixes that, and is a no-op for square and
 * landscape photos, which lose nothing vertically. `photoCrop` (same field the OG cards
 * use) overrides it when a photo needs a specific focal point.
 */
export function personObjectPosition(person) {
  const spec = person?.photoCrop;
  if (typeof spec === "string") {
    const n = spec.match(/-?[\d.]+/g);
    if (n && n.length >= 2) return `${n[0]}% ${n[1]}%`;
  }
  return "center top";
}

/**
 * Square display copy of a person's photo, generated by scripts/build-og.js.
 *
 * The templates crop to a circle with `object-fit: cover`, which centres the crop and
 * cuts the top off a tall portrait. The avatar is pre-cropped by the same rules the OG
 * cards use, so the circle is already square and nothing is lost. Falls back to the
 * original if the avatar has not been generated yet.
 */
export function personAvatar(person) {
  if (!person?.slug) return personPhotos(person, 1)[0];
  const avatar = `/static/avatars/${person.slug}.jpg`;
  return existsSync(join(process.cwd(), "public", avatar))
    ? avatar
    : personPhotos(person, 1)[0];
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
  return path.split("/").pop();
}
