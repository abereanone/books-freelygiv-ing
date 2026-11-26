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
 *     alone. A book new to the site always gets `hidden: true` until the owner
 *     approves it (owner's decision 2026-11-26); updates to books already on
 *     the site go straight through.
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
import { spawnSync } from "child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
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

/** The sync report for the editor. A real sync publishes it on the site as /CourtneyHicks.md, where Courtney
 * (or his tools) can read it at any time; a dry run writes only the local copy in _downloads (untracked). */
const REPORT = join(ROOT, "_downloads/freely-given/for-courtney.md");
const PUBLISHED = join(ROOT, "public/CourtneyHicks.md");
const SITE_URL = "https://books.freely.giving";

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

/** How to mark volumes and modern/classic wordings in site.json; part of every report. */
const SETS_HELP = [
  "", "## Volumes, and modern and classic wordings", "",
  "The site links books that belong together and puts switch buttons on each book's page",
  "(Volume: Vol. I | Vol. II …; Version: Classic | Modern), so a reader can move between them.",
  "",
  "- **Volumes** work already: give each edition its `\"volume\"` (1, 2, …), as Of Domestical",
  "  Duties does. The volumes of one book are linked to each other.",
  "- **The same work in modern and classic wording** is two books in `site.json`, each with its",
  "  own `book`, `title` and edition `slug`s (the slugs must differ, e.g. `the-secret-key-of-heaven`",
  "  and `the-privie-key-of-heaven`). Give both books:",
  "  - `\"wording\"`: `\"modern\"` (spelling or grammar brought up to date) or `\"classic\"` (the",
  "    wording and spelling as first printed)",
  "  - `\"set\"`: the same short key on both, e.g. `\"secret-key-of-heaven\"`",
  "- A work in volumes in both wordings: the same `set` on both books and the same `volume`",
  "  numbers, so Vol. II modern switches to Vol. II classic.",
  "- One wording only for now: `wording` and `set` are still welcome; the switch appears once the",
  "  other wording is in a release.",
  "",
  "```json",
  "{ \"book\": \"thomas-brooks/the-secret-key-of-heaven\", \"title\": \"The Secret Key of Heaven\",",
  "  \"wording\": \"modern\", \"set\": \"secret-key-of-heaven\", \"editions\": [ { \"slug\": \"the-secret-key-of-heaven\", … } ] },",
  "{ \"book\": \"thomas-brooks/the-privie-key-of-heaven\", \"title\": \"The Privie Key of Heaven\",",
  "  \"wording\": \"classic\", \"set\": \"secret-key-of-heaven\", \"editions\": [ { \"slug\": \"the-privie-key-of-heaven\", … } ] }",
  "```",
];

/** The sync report for the editor, written every run (published on the site on a real sync). */
function editorReport(tag, report, general = [], { publish = false } = {}) {
  const bad = report.filter((r) => r.problems.length);
  const warned = report.filter((r) => !r.problems.length && r.warnings.length);
  const meta = report.filter((r) => !r.problems.length && r.missingMeta?.length);
  const today = new Date().toLocaleDateString("en-CA");
  const head = (r) => `### ${r.slug} (${r.title ?? "no title"}${r.version ? `, ${r.version}` : ""})`;
  const status = (r) =>
    r.problems.length ? (r.isNew ? "not imported (see below)" : "not updated (see below); the site keeps its previous version")
    : r.hidden ? "imported, hidden until the site owner finishes it"
    : "on the site";
  const live = report.filter((r) => !r.problems.length && !r.hidden).length;
  const L = [
    "# Sync report for Courtney Hicks",
    "",
    `This file is for Courtney Hicks and his tools. ${SITE_URL} rewrites it each time it syncs a`,
    "Freely Given Books release from https://github.com/freely-given-books/books. Read it after",
    "publishing a release to see what the site took, and anything to fix in the next release.",
    "Nothing in it needs a change on the site's side: fix things in the release and publish a new",
    "one, and the next sync picks it up.",
    "",
    `- Last sync: ${today}`,
    `- Release: ${tag}`,
    `- Editions in the release: ${report.length}; on the site: ${live}; hidden: ${report.filter((r) => !r.problems.length && r.hidden).length}; ` +
      `not imported or not updated: ${bad.length}`,
  ];
  if (general.length) L.push("", "## The release itself", "", ...general.map((g) => `- ${g}`));
  if (report.length) {
    L.push("", "## Editions", "", "| Edition | Version | Status | Page |", "| --- | --- | --- | --- |",
      ...report.map((r) => `| ${r.slug} | ${r.version ?? ""} | ${status(r)} | ${r.page && !r.problems.length && !r.hidden ? r.page : ""} |`));
  }
  L.push("", "## Not imported (fix and re-release)", "");
  if (bad.length) for (const r of bad) L.push(head(r), ...r.problems.map((p) => `- ${p}`), "");
  else L.push("None.");
  L.push("", "## Imported, but please check", "");
  if (warned.length) for (const r of warned) L.push(head(r), ...r.warnings.map((p) => `- ${p}`), "");
  else L.push("None.");
  if (meta.length) {
    L.push("", "## Optional: details that save the site owner work", "",
      "Every new book arrives hidden until the site owner approves it; one without a year or description also waits for them to be filled in by hand.",
      "If `site.json` carries them on each book (`\"year\": 1658`, a reader-facing `\"description\"`",
      "of a sentence or two, not the edition summary, and `\"tags\": [\"puritan\"]`) the sync uses",
      "them and nobody has to do it. Missing for:", "",
      ...meta.map((r) => `- ${r.slug}: ${r.missingMeta.join(", ")}${r.noLulu ? "; lulu (only if a print edition exists)" : ""}`));
  }
  L.push("", "## Question from the site owner: Calvin's Institutes (2026-11-26)", "",
    "Release 2026.11.24.3 brought `institutes-of-the-christian-religion-volume-1` to `-volume-6` (v1.1).",
    "They are on the site but hidden until these are answered:", "",
    "1. The site already has the Institutes as two books, `institutes-of-the-christian-religion-part-1`",
    "   and `-part-2` (Beveridge translation). Is your six-volume edition meant to replace those, or to",
    "   sit beside them? If it replaces them, say so in the editor's note and the site will retire them.",
    "2. What did you change from the CCEL text, beyond restoring it to the 1845 printing? A short list",
    "   (kinds of change, roughly how many) is enough.",
    "3. Your note says \"Calvin's Latin (1559) and French (1560) come as parallel pages beside the",
    "   English (Latin & French link)\". No Latin or French pages or links are in this release. Were",
    "   they left out on purpose? The site carries English only (see below), so please keep them out.",
    "4. What changed between v1 and v1.1?",
    "5. Please add `year` and a reader-facing `description` for the set in `site.json`.");
  L.push("", "## English only (site owner, 2026-11-26)", "",
    "This site carries English editions only. Please leave Latin, French and other-language texts,",
    "parallel pages and links out of what you release for it; ask the site owner first about any",
    "edition in another language.");
  L.push("", "## What the sync needs, per edition", "",
    "`slug`, `pages`, and `files` with `pdf`, `cover` (the Lulu cover PDF) and `front` (the front cover",
    "PNG). `epub` and `reader` (Read Online) are optional: an edition without them (a combined paperback,",
    "say) goes up with only the buttons it has. `compare` gives What's New?. Per book: `title`,",
    "`author`. Every file named must be attached to the release and listed in `SHA256SUMS`.");
  L.push(...SETS_HELP);
  const text = L.join("\n") + "\n";
  mkdirSync(dirname(REPORT), { recursive: true });
  writeFileSync(REPORT, text);
  if (publish) writeFileSync(PUBLISHED, text);
  return { file: publish ? PUBLISHED : REPORT, hasIssues: Boolean(general.length || bad.length || warned.length) };
}

/** Back cover and spine, cut from the print-ready wrap cover by scripts/cut-cover.py
 * (needs Python with PyMuPDF). Returns {back, spine} buffers; {problem} when the
 * editor's cover doesn't fit his interior (goes in his report); {note} when this
 * machine can't do it (console only). */
function cutCover(coverPath, interiorPath) {
  const dir = mkdtempSync(join(tmpdir(), "fgb-cut-"));
  try {
    let res;
    for (const py of ["python", "python3", "py"]) {
      res = spawnSync(py, [join(ROOT, "scripts/cut-cover.py"), coverPath, interiorPath, dir], { encoding: "utf8" });
      if (!res.error) break;
    }
    if (res.error) return { note: "back cover and spine not cut: Python was not found on this machine" };
    if (res.status === 2) return { problem: res.stderr.trim() };
    if (res.status !== 0)
      return { note: `back cover and spine not cut: ${res.stderr.trim().split("\n").pop()}` };
    return { back: readFileSync(join(dir, "back-cover.jpg")), spine: readFileSync(join(dir, "spine.jpg")) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
  const today = new Date().toLocaleDateString("en-CA"); // local date, YYYY-MM-DD
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
    // PDF, print cover and front cover are required. EPUB and Read Online are optional (owner, 2026-11-17):
    // an edition without them goes up with the buttons it has, and the report asks Courtney for the rest.
    const pdf = await need("pdf", isPdf), epub = await need("epub", isZip, true),
      cover = await need("cover", isPdf), front = await need("front"),
      reader = await need("reader", isHtml, true), compare = await need("compare", isHtml, true);
    // Not sent to Courtney: he leaves them out on purpose (e.g. a two-in-one paperback whose books have their own pages).
    if (!f.epub) r.kept.push("no EPUB in this release, so no eBook button");
    if (!f.reader) r.kept.push("no Read Online page in this release, so no Read Online button");
    let jpg = null;
    if (front) {
      try {
        jpg = await sharp(front).flatten({ background: "#ffffff" }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
      } catch (e) { r.problems.push(`front (${f.front}): not a readable image (${e.message})`); }
    }
    if (r.problems.length) return;

    // back cover and spine, cut from the wrap cover
    const cut = cutCover(join(cache, f.cover), join(cache, f.pdf));
    if (cut.problem) r.warnings.push(`cover (${f.cover}): ${cut.problem}. The back cover and spine on the site were not updated.`);
    else if (cut.note) r.kept.push(cut.note);

    const out = {};
    out[`${slug}.pdf`] = pdf;
    if (epub) out[`${slug}.epub`] = epub;
    out["print-ready.zip"] = storedZip([{ name: f.pdf, data: pdf }, { name: f.cover, data: cover }]);
    const names = { [f.pdf]: r2(`${slug}.pdf`) };
    if (epub) names[f.epub] = r2(`${slug}.epub`);
    if (reader) names[f.reader] = `${slug}.html`;
    if (compare) names[f.compare] = `${slug}-whats-new.html`;
    if (reader) out[`${slug}.html`] = Buffer.from(relink(reader.toString(), names));
    if (compare) out[`${slug}-whats-new.html`] = Buffer.from(relink(compare.toString(), names));
    out["cover.jpg"] = jpg;
    if (cut.back) { out["back-cover.jpg"] = cut.back; out["spine.jpg"] = cut.spine; }
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
      // a classic in modern wording is tagged "modernized" (owner, 2026-11-24)
      b.set("tags", doc.createNode(Array.isArray(book.tags) && book.tags.length ? book.tags
        : [(book.wording ?? book.edition) === "modern" ? "modernized" : "classic"]));
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
    if (cut.back) { b.set("backCover", "back-cover.jpg"); b.set("spine", "spine.jpg"); }

    // Book sets (CLAUDE.md "Book sets"): the volumes of a work, and its modern and classic
    // wordings, which are separate books in site.json sharing a "set". Filled in only
    // where book.yaml has none, so the owner's values win.
    // "edition" (with the shared "book" key) is how site.json marks wordings since 2026.11.22
    const wording = book.wording ?? book.edition;
    if (wording && !["modern", "classic"].includes(wording))
      r.warnings.push(`"wording" is "${wording}"; use "modern" or "classic"`);
    const bookKey = String(book.book ?? "").split("/").pop() || null;
    const setKey = book.set ?? (ed.volume || wording ? bookKey : null);
    if (wording && !setKey) r.warnings.push('"wording" is given but no "set": give both wordings the same "set" so the site links them');
    if (setKey && !b.has("set")) b.set("set", setKey);
    if (ed.volume && !b.has("volume")) { b.set("volume", ed.volume); b.set("volumeLabel", `Vol. ${roman(ed.volume)}`); }
    if (["modern", "classic"].includes(wording) && !b.has("version")) b.set("version", wording);

    // A new wording of a book already on the site takes the year, description and tags
    // the owner gave the other wording, where site.json has none and book.yaml still
    // holds the placeholder. Same work, same blurb.
    if (wording && book.book && (isNew || b.get("hidden") === true)) {
      const sib = site.books.filter((o) => o.book === book.book && o !== book)
        .flatMap((o) => o.editions ?? []).filter((e) => (e.volume ?? null) === (ed.volume ?? null))
        .map((e) => join(BOOKS, e.slug, "book.yaml")).find((p) => existsSync(p));
      const s = sib && YAML.parse(readFileSync(sib, "utf8"))?.[0];
      if (s && !s.hidden) {
        if (!book.year && b.get("year") == null && Number.isInteger(s.year)) b.set("year", s.year);
        if (!book.description && b.get("description") === (book.description || book.summary) && s.description)
          b.set("description", s.description);
        const yTags = b.get("tags")?.toJSON?.() ?? [];
        const placeholder = yTags.length === 1 && ["classic", "modernized"].includes(yTags[0]);
        if (!(Array.isArray(book.tags) && book.tags.length) && placeholder && s.tags?.length)
          b.set("tags", doc.createNode(s.tags.map((x) => (wording === "modern" && x === "classic" ? "modernized" : x))));
      }
    }

    // a book still hidden with a placeholder year/description/tags: Courtney
    // can supply them in site.json, so the report keeps asking until it's live
    if (isNew || b.get("hidden") === true) {
      const hasTags = Array.isArray(book.tags) && book.tags.length;
      const yTags = b.get("tags")?.toJSON?.() ?? [];
      r.missingMeta = [
        !book.year && b.get("year") == null && "year",
        !book.description && b.get("description") === book.summary && "description",
        !hasTags && yTags.length === 1 && ["classic", "modernized"].includes(yTags[0]) && "tags",
      ].filter(Boolean);
      r.noLulu = !ed.lulu;
    }
    // every new book stays hidden until the owner approves it (owner, 2026-11-26)

    const want = {
      htmlBook: reader && button("htmlBook", "Read Online", "Read", page(`${slug}.html`)),
      whatsNew: compare && button("whatsNew", "What's New?", "Compare", page(`${slug}-whats-new.html`)),
      printBook: ed.lulu && button("printBook", "Book", "Lulu", ed.lulu),
      eBook: epub && button("eBook", "eBook", "Download", r2(`${slug}.epub`)),
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
    // A release missing a file the site already offers keeps the site's existing button.
    if (!epub && had("eBook")) want.eBook = had("eBook");
    if (!reader && had("htmlBook")) want.htmlBook = had("htmlBook");
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
    const creditList = b.get("credits")?.toJSON?.() ?? [];
    const urlPerson = creditList.find((c) => c.role === "author" && c.person)?.person ?? creditList.find((c) => c.prepared && c.person)?.person;
    Object.assign(r, {
      hidden: b.get("hidden") === true,
      page: urlPerson ? `${SITE_URL}/books/${urlPerson}/${slug}/` : "",
      files: changedForReal, yamlChanged, others: others.map((m) => m.type), kept,
      line: isNew
        ? b.get("hidden") === true
          ? `NEW (hidden${r.missingMeta.length ? `; still needs ${r.missingMeta.join(", ")}` : ""}; waits for the owner's approval)`
          : "NEW (live)"
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

  const out = editorReport(site.release, report, [], { publish: !dryRun });
  console.log(dryRun
    ? `\nReport for Courtney (dry run, local copy only): ${out.file}`
    : `\nReport for Courtney written to ${out.file}; it is live at ${SITE_URL}/CourtneyHicks.md once pushed.` +
      (out.hasIssues ? " It lists things for him to fix." : ""));
  if (report.some((r) => r.problems.length)) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`sync: ${e.message}`);
  if (e instanceof EditorError) {
    const out = editorReport(e.release ?? tagArg ?? "latest", [], [e.message], { publish: !dryRun });
    console.error(`Report for Courtney: ${out.file}${dryRun ? "" : ` (live at ${SITE_URL}/CourtneyHicks.md once pushed)`}`);
  }
  process.exit(1);
});
