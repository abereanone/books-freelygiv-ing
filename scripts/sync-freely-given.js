/**
 * Pull Courtney Hicks's Freely Given Books editions into this site, straight
 * from a GitHub release of freely-given-books/books.
 *
 *   npm run sync:fgb -- --dry-run            # what the newest release would change
 *   npm run sync:fgb                         # stage it: files in content/, book.yaml
 *   npm run sync:fgb -- the-pilgrims-progress all-of-grace   # only these slugs
 *   npm run sync:fgb -- --release 2026.11.03 # a particular release
 *   npm run sync:fgb -- --from DIR           # a release folder on disk (Courtney's
 *                                            # dist/release/<tag>/, before publishing)
 *
 * The release's site.json says, per site page (one per volume for a book in
 * volumes): the slug, the Lulu link, the page count and the release's files.
 * For each one this script:
 *
 *   - downloads the files into _downloads/freely-given/<release>/ and checks
 *     them against the release's SHA256SUMS
 *   - writes them into data/src/books/<slug>/content/ under the site's stable
 *     names, so the R2 URLs never change:
 *       <slug>.pdf, <slug>.epub, print-ready.zip (interior + Lulu cover),
 *       <slug>.html (Read Online), <slug>-whats-new.html (What's New?),
 *       cover.jpg (the front cover)
 *     and points the two HTML pages' links at those names
 *   - updates book.yaml: pages, and the Read Online, What's New?, eBook, PDF
 *     and Print Ready buttons, and a Book (Lulu) button where there is none
 *     (an existing one is the owner's and stays); the Courtney Hicks "prepared" credit.
 *     Title, description, tags, year, dates and any other buttons are left
 *     alone. A book new to the site gets a book.yaml with `hidden: true`, to
 *     fill in (year, description, author) before it goes live.
 *   - records what it synced in data/freely-given-sync.json
 *
 * Each edition is checked first (files present, valid, in SHA256SUMS; title and
 * slug sane). An edition with a problem is skipped whole and the rest still
 * sync; the problems go to _downloads/freely-given/for-courtney.md, a file to
 * send back to the editor. It never uploads. At the end it prints the `npm run upload -- ... --force`
 * line for the slugs whose PDF/EPUB/ZIP changed.
 *
 * Needs Node 22+ (zlib.crc32). GITHUB_TOKEN is optional (rate limits only).
 */

import { createHash } from "crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { crc32 } from "zlib";
import sharp from "sharp";
import YAML from "yaml";

const REPO = "freely-given-books/books";
const R2_BASE = "https://files.books.freelygiv.ing";
const PREPARER = "courtney-hicks";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOOKS = join(ROOT, "data/src/books");
const STATE = join(ROOT, "data/freely-given-sync.json");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const tagArg = opt("--release");
const fromDir = opt("--from");
const only = new Set(args.filter((a, i) => !a.startsWith("--") &&
  !["--release", "--from"].includes(args[i - 1])));

// The buttons this script owns, in the order Pilgrim's Progress shows them.
const BUTTONS = ["htmlBook", "whatsNew", "printBook", "eBook", "pdfBook", "printReady"];

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const roman = (n) =>
  [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]].reduce(
    (s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, "");

async function get(url, json = false) {
  const headers = { "User-Agent": "books-freelygiv-ing sync" };
  if (process.env.GITHUB_TOKEN && url.startsWith("https://api.github.com"))
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return json ? res.json() : Buffer.from(await res.arrayBuffer());
}

/** A ZIP with its files stored (PDFs don't compress), fixed times so the same
 * inputs give the same bytes. */
function storedZip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  const DOS_TIME = 0, DOS_DATE = (2020 - 1980) << 9 | 1 << 5 | 1;
  for (const { name, data } of entries) {
    const fn = Buffer.from(name), crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4);
    head.writeUInt16LE(DOS_TIME, 10); head.writeUInt16LE(DOS_DATE, 12);
    head.writeUInt32LE(crc, 14); head.writeUInt32LE(data.length, 18);
    head.writeUInt32LE(data.length, 22); head.writeUInt16LE(fn.length, 26);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(DOS_TIME, 12); cen.writeUInt16LE(DOS_DATE, 14);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(fn.length, 28);
    cen.writeUInt32LE(offset, 42);
    locals.push(head, fn, data);
    centrals.push(cen, fn);
    offset += 30 + fn.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

/** Point a reader/compare page's links at the site's names for the same files. */
function relink(html, names) {
  for (const [from, to] of Object.entries(names))
    html = html.split(`"${from}"`).join(`"${to}"`);
  return html;
}

function button(type, label, name, url) {
  return { type, label, sources: [{ name, url }] };
}

function sortTitle(title) {
  return title.replace(/^(The|A|An)\s+/i, "");
}

function personSlug(author) {
  const slug = author.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "")
    .trim().replace(/\s+/g, "-");
  return existsSync(join(ROOT, "data/src", slug, "person.yaml")) ? slug : null;
}

/** Something wrong in what the editor published (not in this script): it goes
 * in the report to send back, not just the console. */
class EditorError extends Error {}

/** Where the report to send back to the editor is written (untracked). */
const REPORT = join(ROOT, "_downloads/freely-given/for-courtney.md");

const isPdf = (b) => (b.subarray(0, 5).toString() === "%PDF-" ? null : "not a PDF file");
const isZip = (b) => (b[0] === 0x50 && b[1] === 0x4b ? null : "not a valid EPUB (ZIP) file");
const isHtml = (b) => (/<html/i.test(b.subarray(0, 4000).toString()) ? null : "not an HTML page");
// UTF-8 read as Windows-1252: a-circumflex + euro sign, A-tilde + 80-BF, A-circumflex + A0-BF
const MOJIBAKE = /â€|Ã[\u0080-¿]|Â[ -¿]/;
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Relative links in a staged HTML page to files that aren't staged. */
function strayLinks(html, staged) {
  const bad = new Set();
  const re = /(?:href|src)="((?![a-z][a-z0-9+.-]*:|\/|#)[^"#?]+\.(?:pdf|epub|zip|png|jpe?g|gif|svg|html?))"/gi;
  for (const [, u] of html.matchAll(re)) if (!staged.has(u)) bad.add(u);
  return [...bad];
}

/** normalized title -> slug, for the books already on the site. */
function existingTitles() {
  const m = new Map();
  if (!existsSync(BOOKS)) return m;
  for (const d of readdirSync(BOOKS)) {
    const p = join(BOOKS, d, "book.yaml");
    if (!existsSync(p)) continue;
    try {
      const t = YAML.parse(readFileSync(p, "utf8"))?.[0]?.title;
      if (t) m.set(norm(String(t)), d);
    } catch { /* an unreadable book.yaml is not this script's business */ }
  }
  return m;
}

/** The release's site.json and SHA256SUMS, from GitHub or a folder on disk. */
async function release() {
  if (fromDir) {
    const read = (n) => {
      if (!existsSync(join(fromDir, n))) throw new EditorError(`${n} is missing from ${fromDir}`);
      return readFileSync(join(fromDir, n));
    };
    return { site: parseSite(read("site.json")), sums: read("SHA256SUMS"), dir: fromDir };
  }
  const rel = await get(
    `https://api.github.com/repos/${REPO}/releases/${tagArg ? `tags/${tagArg}` : "latest"}`, true);
  const asset = (n) => rel.assets.find((a) => a.name === n);
  for (const n of ["site.json", "SHA256SUMS"])
    if (!asset(n)) {
      const e = new EditorError(`release ${rel.tag_name} has no ${n}${n === "site.json" ? " (it predates the sync)" : ""}`);
      e.release = rel.tag_name;
      throw e;
    }
  return { site: parseSite(await get(asset("site.json").browser_download_url)),
    sums: await get(asset("SHA256SUMS").browser_download_url) };
}

function parseSite(buf) {
  let site;
  try { site = JSON.parse(buf); } catch (e) { throw new EditorError(`site.json is not valid JSON (${e.message})`); }
  if (site.schema !== 1) throw new Error(`site.json schema ${site.schema}: update this script`);
  if (!Array.isArray(site.books) || !site.books.length) throw new EditorError("site.json has no books list");
  return site;
}

/** The file to send back to the editor, or null (and no stale file) when there is nothing to say. */
function editorReport(tag, report, general = []) {
  const bad = report.filter((r) => r.problems.length);
  const warned = report.filter((r) => !r.problems.length && r.warnings.length);
  const meta = report.filter((r) => !r.problems.length && r.missingMeta?.length);
  if (!general.length && !bad.length && !warned.length && !meta.length) {
    if (existsSync(REPORT)) unlinkSync(REPORT);
    return null;
  }
  const head = (r) => `### ${r.slug} (${r.title ?? "no title"}${r.version ? `, ${r.version}` : ""})`;
  const L = [
    `# books.freely.giving: sync report for release ${tag}`,
    "",
    "The site's sync script (`npm run sync:fgb`) read this release and found the items below.",
    "Nothing needs to change on the site's side: fix these in the release, publish a new one,",
    "and the next sync picks it up. Editions not listed here synced fine.",
  ];
  if (general.length) L.push("", "## The release itself", "", ...general.map((g) => `- ${g}`));
  if (bad.length) {
    L.push("", "## Not imported (fix and re-release)", "");
    for (const r of bad) L.push(head(r), ...r.problems.map((p) => `- ${p}`), "");
  }
  if (warned.length) {
    L.push("", "## Imported, but please check", "");
    for (const r of warned) L.push(head(r), ...r.warnings.map((p) => `- ${p}`), "");
  }
  if (meta.length) {
    L.push("", "## Requests that make the next sync hands-free", "",
      "New books arrive hidden until the site owner fills in a year, description and tags by hand.",
      "If `site.json` carries them on each book (`\"year\": 1658`, a reader-facing `\"description\"`",
      "of a sentence or two, not the edition summary, and `\"tags\": [\"puritan\"]`) the sync uses",
      "them and nobody has to do it. Missing for:", "",
      ...meta.map((r) => `- ${r.slug}: ${r.missingMeta.join(", ")}${r.noLulu ? "; lulu (only if a print edition exists)" : ""}`), "");
  }
  L.push("", "## What the sync needs, per edition", "",
    "`slug`, `pages`, and `files` with `pdf`, `epub`, `cover` (the Lulu cover PDF), `front` (the front",
    "cover PNG) and `reader`, plus `compare` for What's New?. Per book: `title`, `author`. Every file",
    "named must be attached to the release and listed in `SHA256SUMS`.");
  mkdirSync(dirname(REPORT), { recursive: true });
  writeFileSync(REPORT, L.join("\n") + "\n");
  return REPORT;
}

async function main() {
  const { site, sums: sumsFile, dir } = await release();
  const sums = Object.fromEntries(sumsFile.toString().trim().split("\n")
    .map((l) => l.trim().split(/\s+/)).filter((p) => p.length === 2).map(([h, n]) => [n, h]));

  const cache = dir ?? join(ROOT, "_downloads/freely-given", site.release);
  mkdirSync(cache, { recursive: true });
  async function fetchFile(name) {
    const p = join(cache, name);
    let buf = existsSync(p) ? readFileSync(p) : null;
    if (!buf || sha256(buf) !== sums[name]) {
      buf = await get(site.download + name);
      if (sha256(buf) !== sums[name]) throw new Error("checksum does not match SHA256SUMS");
      writeFileSync(p, buf);
    }
    return buf;
  }

  const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { editions: {} };
  const today = new Date().toISOString().slice(0, 10);
  const report = [], upload = [], seen = new Set(), titles = existingTitles();
  console.log(`Freely Given Books release ${site.release}${dryRun ? " (dry run)" : ""}`);

  /** One site page. Problems (r.problems) mean nothing is written for it;
   * warnings (r.warnings) are written but reported. */
  async function doEdition(book, ed, r) {
    const { slug, files: f = {} } = ed;
    if (!slug) { r.problems.push('site.json gives this edition no "slug"'); return; }
    if (seen.has(slug)) { r.problems.push(`slug "${slug}" is used by more than one edition in site.json`); return; }
    seen.add(slug);
    const dir = join(BOOKS, slug), content = join(dir, "content");
    const yamlPath = join(dir, "book.yaml");
    const isNew = !existsSync(yamlPath);
    r.isNew = isNew;
    const r2 = (name) => `${R2_BASE}/${slug}/${name}`;
    const page = (name) => `/static/books/${slug}/${name}`;

    // the metadata
    const title = ed.volume && book.title ? `${book.title}, Volume ${roman(ed.volume)}` : book.title;
    if (isNew && !book.title) r.problems.push('site.json gives this book no "title"');
    if (isNew && !book.author) r.problems.push('site.json gives this book no "author"');
    for (const [k, v] of [["title", book.title], ["author", book.author], ["summary", book.summary]])
      if (v && MOJIBAKE.test(v))
        (isNew && k !== "summary" ? r.problems : r.warnings).push(
          `${k} has garbled characters, as if UTF-8 was read as Windows-1252: "${v.slice(0, 80)}"`);
    if (!Number.isInteger(ed.pages) || ed.pages < 1) r.warnings.push('"pages" is missing or not a whole number');
    if (isNew && title) {
      const hit = titles.get(norm(title));
      if (hit && hit !== slug)
        r.problems.push(`the site already has this book as "${hit}", but site.json gives the slug "${slug}". ` +
          `If it is the same book, set slug = "${hit}" in its publishing.toml. Not imported, so no duplicate page is made.`);
    }

    // the files
    const need = async (key, check, optional) => {
      const name = f[key];
      if (!name) {
        if (!optional) r.problems.push(`site.json lists no "${key}" file for this edition`);
        return null;
      }
      try {
        if (!(name in sums)) throw new Error("not listed in SHA256SUMS");
        const buf = await fetchFile(name);
        const bad = check?.(buf);
        if (bad) throw new Error(bad);
        return buf;
      } catch (e) {
        r.problems.push(`${key} (${name}): ${e.message}`);
        return null;
      }
    };
    const pdf = await need("pdf", isPdf), epub = await need("epub", isZip),
      cover = await need("cover", isPdf), front = await need("front"),
      reader = await need("reader", isHtml), compare = await need("compare", isHtml, true);
    let jpg = null;
    if (front) {
      try {
        jpg = await sharp(front).flatten({ background: "#ffffff" }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
      } catch (e) { r.problems.push(`front (${f.front}): not a readable image (${e.message})`); }
    }
    if (r.problems.length) return;

    const out = {};
    out[`${slug}.pdf`] = pdf;
    out[`${slug}.epub`] = epub;
    out["print-ready.zip"] = storedZip([{ name: f.pdf, data: pdf }, { name: f.cover, data: cover }]);
    const names = { [f.pdf]: r2(`${slug}.pdf`), [f.epub]: r2(`${slug}.epub`), [f.reader]: `${slug}.html` };
    if (compare) names[f.compare] = `${slug}-whats-new.html`;
    out[`${slug}.html`] = Buffer.from(relink(reader.toString(), names));
    if (compare) out[`${slug}-whats-new.html`] = Buffer.from(relink(compare.toString(), names));
    out["cover.jpg"] = jpg;
    const staged = new Set([`${slug}.html`, `${slug}-whats-new.html`]);
    for (const [n, src] of [[`${slug}.html`, f.reader], [`${slug}-whats-new.html`, f.compare]]) {
      const stray = out[n] ? strayLinks(out[n].toString(), staged) : [];
      if (stray.length)
        r.warnings.push(`${src} links to files that are not in the release, so they would be dead links on the site: ` +
          `${stray.slice(0, 5).join(", ")}${stray.length > 5 ? ` (and ${stray.length - 5} more)` : ""}`);
    }

    // changed: against what the last sync wrote (data/freely-given-sync.json),
    // or the file in content/ when there is no record (PDFs are not in git)
    const before = state.editions[slug]?.files ?? {};
    const hashOf = (n) => (n === "cover.jpg" ? sums[f.front] : sha256(out[n]));
    const changedForReal = Object.keys(out).filter((n) => {
      if (before[n]) return before[n] !== hashOf(n);
      const p = join(content, n);
      return !existsSync(p) || sha256(readFileSync(p)) !== sha256(out[n]);
    });
    const toR2 = changedForReal.filter((n) => /\.(pdf|epub|zip)$/.test(n));

    // book.yaml
    const doc = isNew ? new YAML.Document([{}]) : YAML.parseDocument(readFileSync(yamlPath, "utf8"));
    const b = doc.get(0, true);
    if (isNew) {
      const author = personSlug(book.author);
      b.set("title", title);
      b.set("sortTitle", sortTitle(title));
      b.set("hidden", true);
      b.set("credits", doc.createNode([author ? { person: author, role: "author" } : { name: book.author, role: "author" },
        { person: PREPARER, prepared: true }]));
      b.set("year", Number.isInteger(book.year) ? book.year : null);
      b.set("addedDate", today);
      b.set("pages", ed.pages);
      b.set("tags", doc.createNode(Array.isArray(book.tags) && book.tags.length ? book.tags : ["classic"]));
      b.set("description", book.description || book.summary);
      b.set("license", "CC0");
      b.set("path", `/static/books/${slug}`);
      b.set("cover", "cover.jpg");
    } else if (Number.isInteger(ed.pages) && ed.pages > 0) {
      b.set("pages", ed.pages);
    }
    const credits = b.get("credits", true);
    if (credits && !credits.items.some((c) => c.get?.("person") === PREPARER && c.get?.("prepared")))
      credits.add(doc.createNode({ person: PREPARER, prepared: true }));
    b.set("cover", "cover.jpg");

    // a book still hidden with a placeholder year/description/tags: Courtney
    // can supply them in site.json, so the report keeps asking until it's live
    if (isNew || b.get("hidden") === true) {
      const hasTags = Array.isArray(book.tags) && book.tags.length;
      const yTags = b.get("tags")?.toJSON?.() ?? [];
      r.missingMeta = [
        !book.year && (isNew || b.get("year") == null) && "year",
        !book.description && (isNew || b.get("description") === book.summary) && "description",
        !hasTags && (isNew || (yTags.length === 1 && yTags[0] === "classic")) && "tags",
      ].filter(Boolean);
      r.noLulu = !ed.lulu;
    }

    const want = {
      htmlBook: button("htmlBook", "Read Online", "Read", page(`${slug}.html`)),
      whatsNew: compare && button("whatsNew", "What's New?", "Compare", page(`${slug}-whats-new.html`)),
      printBook: ed.lulu && button("printBook", "Book", "Lulu", ed.lulu),
      eBook: button("eBook", "eBook", "Download", r2(`${slug}.epub`)),
      pdfBook: button("pdfBook", "PDF", "Download", r2(`${slug}.pdf`)),
      printReady: button("printReady", "Print Ready", "Download", r2("print-ready.zip")),
    };
    const old = (b.get("mediaTypes", true)?.items ?? []).map((n) => n.toJSON());
    const others = old.filter((m) => !BUTTONS.includes(m.type));
    // the owner's choices win: a Read Online elsewhere (another site's
    // reader), and any Book (Lulu) button the site already has; the
    // release's Lulu link only fills in a missing one
    const kept = [];
    const had = (t) => old.find((m) => m.type === t);
    const url = (m) => m?.sources?.[0]?.url ?? "";
    if (had("htmlBook") && /^https?:/.test(url(had("htmlBook")))) {
      want.htmlBook = had("htmlBook");
      kept.push(`Read Online stays at ${url(had("htmlBook"))} (<slug>.html is staged, not linked)`);
    }
    if (had("printBook")) want.printBook = had("printBook");
    b.set("mediaTypes", doc.createNode([...BUTTONS.map((t) => want[t]).filter(Boolean), ...others]));
    const yamlOut = doc.toString({ lineWidth: 0 });
    const yamlChanged = isNew || yamlOut !== readFileSync(yamlPath, "utf8");

    if (!dryRun) {
      mkdirSync(content, { recursive: true });
      for (const n of changedForReal) writeFileSync(join(content, n), out[n]);
      if (yamlChanged) writeFileSync(yamlPath, yamlOut);
      state.editions[slug] = {
        book: book.book, version: book.version, release: site.release, synced: today,
        files: Object.fromEntries(Object.keys(out).map((n) => [n, hashOf(n)])),
      };
    }
    if (toR2.length) upload.push(slug);
    Object.assign(r, {
      files: changedForReal, yamlChanged, others: others.map((m) => m.type), kept,
      line: isNew
        ? `NEW (hidden${r.missingMeta.length ? `; still needs ${r.missingMeta.join(", ")}` : ""}; check the author page, then remove hidden)`
        : changedForReal.length || yamlChanged ? "updated" : "unchanged",
    });
  }

  for (const book of site.books) {
    for (const ed of book.editions ?? []) {
      if (only.size && !only.has(ed.slug)) continue;
      const r = { slug: ed.slug ?? "(no slug)", title: book.title, version: book.version, note: book.note,
        problems: [], warnings: [], files: [], others: [], kept: [], missingMeta: [] };
      try { await doEdition(book, ed, r); }
      catch (e) { r.problems.push(`unexpected error: ${e.message}`); }
      report.push(r);
    }
  }

  for (const r of report) {
    if (r.problems.length) {
      console.log(`\n${r.slug} ${r.version ?? ""}: NOT IMPORTED`);
      for (const p of r.problems) console.log(`  PROBLEM: ${p}`);
    } else {
      console.log(`\n${r.slug} ${r.version}: ${r.line}`);
      if (r.files.length) console.log(`  files: ${r.files.join(", ")}`);
      if (r.yamlChanged && !r.isNew) console.log("  book.yaml updated");
      for (const k of r.kept) console.log(`  ${k}`);
      if (r.others.length) console.log(`  other buttons left as they are: ${r.others.join(", ")}`);
      if (r.note) console.log(`  NOTE from the editor: ${r.note}`);
    }
    for (const w of r.warnings) console.log(`  CHECK: ${w}`);
  }
  if (!dryRun) {
    state.release = site.release;
    writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n");
  }
  console.log(upload.length
    ? `\nThen upload the changed files to R2 (the owner):\n  npm run upload -- ${upload.join(" ")} --force`
    : "\nNothing to upload to R2.");

  const hasIssues = report.some((r) => r.problems.length || r.warnings.length);
  const file = editorReport(site.release, report);
  if (file) console.log(`\n${hasIssues ? "FILE TO SEND BACK TO COURTNEY (issues found)" : "Optional note for Courtney"}: ${file}`);
  if (report.some((r) => r.problems.length)) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`sync: ${e.message}`);
  if (e instanceof EditorError) {
    const file = editorReport(e.release ?? tagArg ?? "latest", [], [e.message]);
    if (file) console.error(`FILE TO SEND BACK TO COURTNEY: ${file}`);
  }
  process.exit(1);
});
