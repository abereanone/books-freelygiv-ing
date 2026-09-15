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

/**
 * The ways someone can be credited on a book, in display order. A person is one person with
 * one page at /people/<slug>/; roles aren't declared on the person — they fall out of the
 * `credits` lists in book.yaml.
 *
 * There are two kinds of credit, and a credit holds at most one of each:
 *  - a book credit, `role:` — author, contributor or foreword. Who made the book; true of
 *    any printing of it.
 *  - the edition credit, `prepared: true` — who made this free edition: digitizing,
 *    editing, typesetting, formatting. Deliberately one role, not a list of trades.
 *
 * `byline` is the phrase the book page puts before the names. `description` explains the
 * role to readers on the People page's filter buttons.
 */
export const ROLES = [
  {
    key: "author", label: "Author", plural: "Authors",
    booksHeading: "Books Written", byline: "by",
    description: "Wrote the book. A book with several authors was written by them together.",
  },
  {
    key: "contributor", label: "Contributor", plural: "Contributors",
    booksHeading: "Contributed To", byline: "with contributions by",
    description: "Wrote part of a book, such as a chapter, essay or section, alongside its authors.",
  },
  {
    key: "foreword", label: "Foreword", plural: "Foreword Writers",
    booksHeading: "Forewords", byline: "foreword by",
    description: "Wrote the foreword that introduces a book.",
  },
  {
    key: "preparer", label: "Preparer", plural: "Preparers",
    booksHeading: "Books Prepared", byline: "prepared by",
    description: "Prepared a free edition for this site: digitizing, editing, typesetting or formatting it so it can be freely given.",
  },
];

/** What the People page's "Everyone" filter describes. */
export const EVERYONE_DESCRIPTION = "Everyone credited on a book in this library, in any role.";

const BOOK_ROLES = new Set(["author", "contributor", "foreword"]);

/** Whether a credit carries a ROLES key — `preparer` is the `prepared` flag, the rest `role`. */
export function creditHasRole(credit, roleKey) {
  return roleKey === "preparer" ? credit.prepared : credit.role === roleKey;
}

/** A book's credits in one role, in the order book.yaml lists them. */
export function bookCredits(book, roleKey) {
  return (book.credits || []).filter((credit) => creditHasRole(credit, roleKey));
}

/** Where a person's photos are synced to by scripts/sync-assets.js. */
export function personImageDir(slug) {
  return `/static/images/people/${slug}`;
}

/** Each data/src/<slug>/person.yaml, with its photo filenames resolved to site paths. */
function readPeople() {
  return listPersonSlugs().flatMap((slug) => {
    const f = join(DATA_SRC, slug, "person.yaml");
    if (!existsSync(f)) return [];
    return readYamlArray(f).map((person) => {
      const resolve = (photo) =>
        typeof photo === "string" && !photo.startsWith("/")
          ? `${personImageDir(person.slug)}/${photo}`
          : photo;
      return {
        ...person,
        href: `/people/${person.slug}/`,
        photo: resolve(person.photo),
        photos: Array.isArray(person.photos) ? person.photos.map(resolve) : resolve(person.photos),
      };
    });
  });
}

function personBySlug(people) {
  return Object.fromEntries(people.map((person) => [person.slug, person]));
}

/**
 * One `credits` entry from book.yaml, resolved. `person: <slug>` links to a person.yaml;
 * `name: <text>` credits someone who has no page. An unknown slug is a typo, not a
 * name-only credit, so it warns at build time and falls back to showing the slug.
 */
function normalizeCredit(entry, peopleBySlug, bookSlug) {
  const person = entry.person ? peopleBySlug[entry.person] : null;
  if (entry.person && !person)
    console.warn(`[data] ${bookSlug}: no data/src/${entry.person}/person.yaml for credit`);
  if (entry.role && !BOOK_ROLES.has(entry.role))
    console.warn(`[data] ${bookSlug}: unknown credit role "${entry.role}"`);

  const name = person ? personName(person) : (entry.name ?? entry.person ?? "");
  return {
    slug: person?.slug ?? null,
    person: person ?? null,
    name,
    href: person?.href ?? null,
    role: entry.role ?? null,
    prepared: entry.prepared === true,
    note: entry.note ?? null,
  };
}

/** A credit as the author-shaped object BookItem, OG cards and book URLs expect. */
function creditAsAuthor(credit) {
  if (credit.person) return credit.person;
  const slug = credit.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return { slug, firstName: credit.name, lastName: "", href: null };
}

/** Every person, with `roles` — the ROLES keys they hold on at least one visible book. */
export function getPeople() {
  const books = getBooks();
  return readPeople().map((person) => ({
    ...person,
    roles: ROLES.map((role) => role.key).filter((key) =>
      books.some((book) => bookCredits(book, key).some((credit) => credit.slug === person.slug)),
    ),
  }));
}

export function getPeopleWithRole(roleKey) {
  return getPeople().filter((person) => person.roles.includes(roleKey));
}

/** "Author · Contributor" — a person's roles as a display string. */
export function personRoleLabel(person, separator = " · ") {
  return ROLES.filter((role) => person.roles?.includes(role.key))
    .map((role) => role.label)
    .join(separator);
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
  const peopleBySlug = personBySlug(readPeople());

  return getBookDirs().flatMap(({ bookSlug, bookDir }) => {
    const f = join(bookDir, "book.yaml");
    return existsSync(f)
      ? readYamlArray(f)
          .filter((book) => !book.hidden)
          .map((book) => {
            const credits = (book.credits || []).map((entry) =>
              normalizeCredit(entry, peopleBySlug, bookSlug),
            );
            return {
              ...book,
              path: book.path ?? `/static/books/${bookSlug}`,
              credits,
              // Derived, for everything that only wants the byline. The first author is the
              // primary one and supplies the book URL's [authorSlug].
              authors: credits.filter((credit) => credit.role === "author").map(creditAsAuthor),
            };
          })
      : [];
  });
}

/**
 * One {book, person} pair per person with a page who wrote any of a book — author,
 * contributor or foreword; preparers aren't the book's writers. Pre-sorted by lastName.
 */
export function getBookAuthorPairs() {
  const pairs = [];
  const seen = new Set();
  for (const book of getBooks()) {
    for (const credit of book.credits) {
      const key = `${book.path}::${credit.slug}`;
      if (!credit.person || !BOOK_ROLES.has(credit.role) || seen.has(key)) continue;
      seen.add(key);
      pairs.push({ book, person: credit.person });
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

/** Every person by slug, each carrying `href` (their /people/<slug>/ page) and `roles`. */
export function getPeopleBySlug() {
  return personBySlug(getPeople());
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
