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
 * It never uploads. At the end it prints the `npm run upload -- ... --force`
 * line for the slugs whose PDF/EPUB/ZIP changed.
 *
 * Needs Node 22+ (zlib.crc32). GITHUB_TOKEN is optional (rate limits only).
 */

import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
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

/** The release's site.json and SHA256SUMS, from GitHub or a folder on disk. */
async function release() {
  if (fromDir) {
    const read = (n) => readFileSync(join(fromDir, n));
    return { site: JSON.parse(read("site.json")), sums: read("SHA256SUMS"), dir: fromDir };
  }
  const rel = await get(
    `https://api.github.com/repos/${REPO}/releases/${tagArg ? `tags/${tagArg}` : "latest"}`, true);
  const asset = (n) => rel.assets.find((a) => a.name === n);
  if (!asset("site.json"))
    throw new Error(`release ${rel.tag_name} has no site.json (it predates the sync)`);
  return { site: JSON.parse(await get(asset("site.json").browser_download_url)),
    sums: await get(asset("SHA256SUMS").browser_download_url) };
}

async function main() {
  const { site, sums: sumsFile, dir } = await release();
  if (site.schema !== 1) throw new Error(`site.json schema ${site.schema}: update this script`);
  const sums = Object.fromEntries(sumsFile.toString().trim().split("\n")
    .map((l) => l.split(/\s+/)).map(([h, n]) => [n, h]));

  const cache = dir ?? join(ROOT, "_downloads/freely-given", site.release);
  mkdirSync(cache, { recursive: true });
  async function fetchFile(name) {
    const p = join(cache, name);
    let buf = existsSync(p) ? readFileSync(p) : null;
    if (!buf || sha256(buf) !== sums[name]) {
      buf = await get(site.download + name);
      if (sha256(buf) !== sums[name]) throw new Error(`${name}: checksum does not match SHA256SUMS`);
      writeFileSync(p, buf);
    }
    return buf;
  }

  const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { editions: {} };
  const today = new Date().toISOString().slice(0, 10);
  const report = [], upload = [];
  console.log(`Freely Given Books release ${site.release}${dryRun ? " (dry run)" : ""}`);

  for (const book of site.books) {
    for (const ed of book.editions) {
      if (only.size && !only.has(ed.slug)) continue;
      const { slug, files: f } = ed;
      const dir = join(BOOKS, slug), content = join(dir, "content");
      const yamlPath = join(dir, "book.yaml");
      const isNew = !existsSync(yamlPath);
      const r2 = (name) => `${R2_BASE}/${slug}/${name}`;
      const page = (name) => `/static/books/${slug}/${name}`;

      // the site's files, from the release's
      const out = {};
      if (f.pdf) out[`${slug}.pdf`] = await fetchFile(f.pdf);
      if (f.epub) out[`${slug}.epub`] = await fetchFile(f.epub);
      if (f.pdf && f.cover)
        out["print-ready.zip"] = storedZip([
          { name: f.pdf, data: await fetchFile(f.pdf) },
          { name: f.cover, data: await fetchFile(f.cover) }]);
      const names = {};
      if (f.pdf) names[f.pdf] = r2(`${slug}.pdf`);
      if (f.epub) names[f.epub] = r2(`${slug}.epub`);
      if (f.reader) names[f.reader] = `${slug}.html`;
      if (f.compare) names[f.compare] = `${slug}-whats-new.html`;
      if (f.reader) out[`${slug}.html`] = Buffer.from(relink((await fetchFile(f.reader)).toString(), names));
      if (f.compare) out[`${slug}-whats-new.html`] = Buffer.from(relink((await fetchFile(f.compare)).toString(), names));
      if (f.front) out["cover.jpg"] = await sharp(await fetchFile(f.front)).flatten({ background: "#ffffff" })
        .jpeg({ quality: 90, mozjpeg: true }).toBuffer();

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
        const title = ed.volume ? `${book.title}, Volume ${roman(ed.volume)}` : book.title;
        const author = personSlug(book.author);
        b.set("title", title);
        b.set("sortTitle", sortTitle(title));
        b.set("hidden", true);
        b.set("credits", doc.createNode([author ? { person: author, role: "author" } : { name: book.author, role: "author" },
          { person: PREPARER, prepared: true }]));
        b.set("year", null);
        b.set("addedDate", today);
        b.set("pages", ed.pages);
        b.set("tags", doc.createNode(["classic"]));
        b.set("description", book.summary);
        b.set("license", "CC0");
        b.set("path", `/static/books/${slug}`);
        b.set("cover", "cover.jpg");
      } else if (ed.pages) {
        b.set("pages", ed.pages);
      }
      const credits = b.get("credits", true);
      if (credits && !credits.items.some((c) => c.get?.("person") === PREPARER && c.get?.("prepared")))
        credits.add(doc.createNode({ person: PREPARER, prepared: true }));
      if (f.front) b.set("cover", "cover.jpg");

      const want = {
        htmlBook: f.reader && button("htmlBook", "Read Online", "Read", page(`${slug}.html`)),
        whatsNew: f.compare && button("whatsNew", "What's New?", "Compare", page(`${slug}-whats-new.html`)),
        printBook: ed.lulu && button("printBook", "Book", "Lulu", ed.lulu),
        eBook: f.epub && button("eBook", "eBook", "Download", r2(`${slug}.epub`)),
        pdfBook: f.pdf && button("pdfBook", "PDF", "Download", r2(`${slug}.pdf`)),
        printReady: out["print-ready.zip"] && button("printReady", "Print Ready", "Download", r2("print-ready.zip")),
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
      report.push({
        slug, version: book.version, isNew, files: changedForReal, yamlChanged,
        others: others.map((m) => m.type), kept, note: book.note,
        line: isNew ? "NEW (hidden: fill in year, description, author; then remove hidden)"
          : changedForReal.length || yamlChanged ? "updated" : "unchanged",
      });
    }
  }

  for (const r of report) {
    console.log(`\n${r.slug} ${r.version}: ${r.line}`);
    if (r.files.length) console.log(`  files: ${r.files.join(", ")}`);
    if (r.yamlChanged && !r.isNew) console.log("  book.yaml updated");
    for (const k of r.kept) console.log(`  ${k}`);
    if (r.others.length) console.log(`  other buttons left as they are: ${r.others.join(", ")}`);
    if (r.note) console.log(`  NOTE from the editor: ${r.note}`);
  }
  if (!dryRun) {
    state.release = site.release;
    writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n");
  }
  console.log(upload.length
    ? `\nThen upload the changed files to R2 (the owner):\n  npm run upload -- ${upload.join(" ")} --force`
    : "\nNothing to upload to R2.");
}

main().catch((e) => { console.error(`sync: ${e.message}`); process.exit(1); });
