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
    key: "translator", label: "Translator", plural: "Translators",
    booksHeading: "Books Translated", byline: "translated by",
    description: "Translated a book into another language. Credited on that translated edition's own page.",
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
// Every `role:` a credit may carry. A translator is credited on the translated edition but did
// not write the book, so they stay out of BOOK_ROLES (the library's By Author tab).
const CREDIT_ROLES = new Set([...BOOK_ROLES, "translator"]);

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
  if (entry.role && !CREDIT_ROLES.has(entry.role))
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

  const books = getBookDirs().flatMap(({ bookSlug, bookDir }) => {
    const f = join(bookDir, "book.yaml");
    return existsSync(f)
      ? readYamlArray(f)
          .filter((book) => !book.hidden)
          .map((book) => {
            const credits = (book.credits || []).map((entry) =>
              normalizeCredit(entry, peopleBySlug, bookSlug),
            );
            const lang = book.lang ?? "en";
            if (!LANGUAGES[lang]) console.warn(`[data] ${bookSlug}: unknown lang "${lang}" (add it to LANGUAGES)`);
            return {
              ...book,
              lang,
              path: book.path ?? `/static/books/${bookSlug}`,
              credits,
              // Derived, for everything that only wants the byline. The first author is the
              // primary one and supplies the book URL's [authorSlug].
              authors: credits.filter((credit) => credit.role === "author").map(creditAsAuthor),
            };
          })
      : [];
  });
  return withSets(books);
}

/**
 * Languages a book can be in. `lang` in book.yaml (default `en`) is the language of the
 * whole book. A translated edition is its own book page with `translationOf: <slug of the
 * original>`; every book in that family then lists the others ("Also available in Spanish").
 */
export const LANGUAGES = {
  // siteName: the site's name shown on that language's book pages (header, tab title, footer)
  // filter: the /library language button, written in that language; native: the card badge
  en: { name: "English", native: "English", filter: "English", siteName: "Freely Given Books" },
  es: { name: "Spanish", native: "Español", filter: "En español", siteName: "Libros Dados de Gracia" }, // Mt 10:8 RV1909 "dad de gracia"
};

/**
 * Book sets: books that belong together — the volumes of a multi-volume work, its modern
 * and classic versions, and its translations. Each book in a set sits at a point on three
 * axes, and the book page shows a switcher for every axis that varies within the set:
 *
 *   set: domestical-duties   # shared key; every book with the same key is in the set
 *   volume: 1                # position in a multi-volume work (number, for ordering)
 *   volumeLabel: Vol. I      # optional button text; default "Vol. <volume>"
 *   version: modern          # modern | classic (see VERSIONS)
 *   lang: es                 # the book's language (see LANGUAGES), default en
 *
 * `translationOf: <slug>` / `versionOf: <slug>` are shorthand for "in the same set as that
 * book", so the original needs no edit. A switcher button goes to the book with that value
 * that keeps the most of the current book's other axes (Vol. III stays in Spanish/modern
 * when that exists).
 */
export const VERSIONS = {
  classic: { name: "Classic" },
  modern: { name: "Modern" },
};

const SET_AXES = [
  { key: "volume", label: "Volume", value: (b) => b.volume, name: (b) => b.volumeLabel ?? `Vol. ${b.volume}` },
  { key: "version", label: "Version", value: (b) => b.version, name: (b) => VERSIONS[b.version]?.name ?? b.version },
  { key: "lang", label: "Language", value: (b) => b.lang, name: (b) => LANGUAGES[b.lang]?.native ?? b.lang },
];

function withSets(books) {
  const slugOf = (book) => bookSlugFromPath(book.path);
  const bySlug = new Map(books.map((book) => [slugOf(book), book]));
  for (const book of books) {
    for (const field of ["translationOf", "versionOf"]) {
      if (book[field] && !bySlug.has(book[field])) {
        console.warn(`[data] ${slugOf(book)}: ${field} "${book[field]}" is not a visible book`);
      }
    }
    if (book.version && !VERSIONS[book.version]) {
      console.warn(`[data] ${slugOf(book)}: unknown version "${book.version}" (${Object.keys(VERSIONS).join(", ")})`);
    }
  }
  // A book's set key: its own `set`, else the set of the book it translates or modernizes.
  const keyOf = (book, seen = new Set()) => {
    if (book.set) return book.set;
    const parent = bySlug.get(book.translationOf ?? book.versionOf);
    return parent && !seen.has(parent) ? keyOf(parent, seen.add(book)) : slugOf(book);
  };
  // versionOf with no version on the original: the original is the other one.
  const books2 = books.map((book) => {
    if (book.version) return book;
    const derived = books.find((other) => other.versionOf === slugOf(book) && VERSIONS[other.version]);
    return derived ? { ...book, version: derived.version === "modern" ? "classic" : "modern" } : book;
  });
  const sets = new Map();
  for (const book of books2) {
    const key = keyOf(book);
    if (!sets.has(key)) sets.set(key, []);
    sets.get(key).push(book);
  }
  return books2.map((book) => {
    const members = sets.get(keyOf(book));
    const setAxes = [];
    for (const axis of SET_AXES) {
      const values = [...new Set(members.map(axis.value).filter((v) => v !== undefined))];
      if (values.length < 2) continue;
      const order = { lang: Object.keys(LANGUAGES), version: Object.keys(VERSIONS) }[axis.key];
      values.sort(order ? (x, y) => order.indexOf(x) - order.indexOf(y) : (x, y) => x - y);
      const others = SET_AXES.filter((a) => a !== axis);
      const options = values.map((value) => {
        // The book with this value that keeps the most of the current book's other axes.
        const target = members
          .filter((m) => axis.value(m) === value)
          .map((m) => ({ m, score: others.filter((a) => a.value(m) === a.value(book)).length }))
          .sort((x, y) => y.score - x.score)[0].m;
        return {
          name: axis.name(target),
          lang: axis.key === "lang" ? value : undefined,
          current: value === axis.value(book),
          href: `/books/${bookAuthorSlug(target)}/${slugOf(target)}/`,
          title: target.title,
        };
      });
      setAxes.push({ key: axis.key, label: axis.label, options });
    }
    return { ...book, setAxes };
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
    /(https?:\/\/[^\s<]*[^\s<.,;:!?)])/g, // a full stop or comma after a URL stays outside the link
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

/**
 * The [authorSlug] segment of a book's URL. Normally the primary author, but a book can
 * have no author at all — a confession is issued by an assembly, not written by someone —
 * and then the first preparer stands in, so the URL still names a person with a page.
 * Both the route and BookItem read it from here; when they disagreed the listings linked
 * to a URL the build never generated.
 */
export function bookAuthorSlug(book) {
  return book.authors?.[0]?.slug ?? bookCredits(book, "preparer")[0]?.slug ?? "unknown";
}

// ── quote cards (/quotes/) ───────────────────────────────────────────────────
// Each book may have data/src/books/<slug>/quotes.yaml (see docs/QUOTES-SPEC.md). Every quote
// not marked `rejected` is public. Card images are rendered by scripts/quotes/render-cards.mjs:
// public/static/quotes/ in dev, R2 (files.books.freelygiv.ing/quotes/) in production.

const QUOTES_SRC = join(DATA_SRC, "quotes");

export const QUOTE_ERAS = {
  early: "Early Church",
  reformation: "Reformation",
  puritan: "Puritan",
  evangelical: "1700s–1800s",
  modern: "Modern",
};

/** Topic slug -> { label, about, mood }, in the order of topics.yaml. */
export function getQuoteTopics() {
  const f = join(QUOTES_SRC, "topics.yaml");
  const topics = existsSync(f) ? YAML.parse(readFileSync(f, "utf8")) || {} : {};
  // Alphabetical by label everywhere topics are listed (dropdown, topic list, pages),
  // ignoring a leading "The" as /library does with titles.
  const key = (t) => t.label.replace(/^The /, "");
  return Object.fromEntries(Object.entries(topics).sort(([, a], [, b]) => key(a).localeCompare(key(b))));
}

function quoteEras() {
  const f = join(QUOTES_SRC, "eras.yaml");
  return existsSync(f) ? YAML.parse(readFileSync(f, "utf8")) || {} : {};
}

/**
 * Every public quote, joined to its book and author: { id, text, words, topics, scripture,
 * tone, featured, added, chapter, author, authorName, authorHref, book, bookTitle, bookHref,
 * readUrl, era }. Quotes from hidden books are left out, like everything else about them.
 */
export function getQuotes() {
  const books = Object.fromEntries(getBooks().map((b) => [bookSlugFromPath(b.path), b]));
  const people = personBySlug(readPeople());
  const eras = quoteEras();
  const out = [];
  for (const [slug, book] of Object.entries(books)) {
    const f = join(BOOKS_SRC, slug, "quotes.yaml");
    if (!existsSync(f)) continue;
    const read = (book.mediaTypes || []).find((m) => m.type === "htmlBook")?.sources?.[0]?.url;
    for (const q of YAML.parse(readFileSync(f, "utf8")) || []) {
      if (q.status === "rejected") continue;
      const person = people[q.author];
      out.push({
        ...q,
        tone: ["light", "solid"].includes(q.tone) ? q.tone : "dark",
        added: String(q.added ?? ""),
        // `writtenBy` names a contributor whose chapter the quote comes from (e.g. the guest
        // writers in Our Sin, His Mercy); they have no person page, so no link.
        authorName: q.writtenBy || (person ? personName(person) : q.author),
        authorHref: q.writtenBy ? null : person?.href ?? null,
        // For the gallery's author filter: a guest writer is an author of their own there, and
        // names are listed "Last, First" in surname order.
        authorKey: q.writtenBy ? `by-${q.writtenBy.toLowerCase().replace(/[^a-z]+/g, "-")}` : q.author,
        authorSort: q.writtenBy
          ? q.writtenBy.replace(/^(.*) (\S+)$/, "$2, $1")
          : person?.lastName ? `${person.lastName}, ${person.firstName}` : person ? personName(person) : q.author,
        bookTitle: book.title,
        bookHref: `/books/${bookAuthorSlug(book)}/${slug}/`,
        readUrl: read ? `${read}${q.anchor ? `#${q.anchor}` : ""}` : null,
        era: eras[q.author] ?? null,
      });
    }
  }
  // Bible verse cards: the reference stands in for the author, the BSB for the book.
  const sf = join(QUOTES_SRC, "scripture.yaml");
  for (const q of existsSync(sf) ? YAML.parse(readFileSync(sf, "utf8")) || [] : []) {
    if (q.status === "rejected") continue;
    out.push({
      ...q,
      tone: ["light", "solid"].includes(q.tone) ? q.tone : "dark",
      added: String(q.added ?? ""),
      isScripture: true,
      author: "bible",
      authorKey: "bible",
      authorName: q.ref,
      authorSort: "Bible (BSB)",
      authorHref: null,
      book: "bsb",
      bookTitle: "Berean Standard Bible",
      bookHref: null,
      readUrl: null,
      scripture: [],
      era: null,
    });
  }
  return out;
}

/** URL of a card image. tone: "dark" | "light" (paintings) | "solid" (framed colour). size: "full" (1080 px) or "thumb" (480 px). Dev serves the local
 *  render; the built site points at R2, so upload the cards before pushing. */
let cardsVersion;
export function quoteImage(id, tone = "dark", size = "full") {
  const base = import.meta.env?.DEV ? "/static/quotes" : "https://files.books.freelygiv.ing/quotes";
  if (cardsVersion === undefined) {
    const f = join(QUOTES_SRC, "cards-version.txt");
    cardsVersion = existsSync(f) ? readFileSync(f, "utf8").trim() : "";
  }
  return `${base}/${id}-${["light", "solid"].includes(tone) ? tone : "dark"}${size === "thumb" ? "-480" : ""}.jpg${cardsVersion ? `?v=${cardsVersion}` : ""}`;
}
