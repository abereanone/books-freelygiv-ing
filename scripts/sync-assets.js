/**
 * Copies book content files and person photos from books-data into public/.
 * Run automatically via `npm run dev` and `npm run build`.
 */
import {
  existsSync,
  readdirSync,
  statSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";
import { parse } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_SRC = join(__dirname, "../data/src");
const BOOKS_SRC = join(DATA_SRC, "books");
const PUBLIC = join(__dirname, "../public");

const IMAGE_EXTS = new Set([".webp", ".jpg", ".jpeg", ".png", ".html"]);

function copyFile(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

/**
 * Every read-online and What's New? page gets a way back to the site.
 *
 * Done here rather than in the files themselves because they are build output:
 * Courtney's next release, or a rebuild of Morning and Evening, would overwrite
 * any hand edit. Lower left, because the reader and compare pages both carry a
 * fixed toolbar across the top.
 *
 * The href is absolute, not "/": these pages are self-contained and people save
 * them. The styles are scoped to one class, carry their own colours for light
 * and dark, and answer both the system setting and a data-theme attribute,
 * since the pages come from three different generators.
 */
const BACK_LINK_MARKER = "fgb-back";
const BACK_LINK = `
<a class="fgb-back" href="https://books.freely.giving/">&#8592;&#160;Back to Freely Given Books</a>
<style>
.fgb-back{position:fixed;left:14px;bottom:14px;z-index:9999;display:inline-block;margin:0;
padding:7px 13px;border:1px solid rgba(0,0,0,.18);border-radius:999px;
background:rgba(255,255,255,.93);color:#1a1a1a;text-decoration:none;
font:500 14px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
box-shadow:0 1px 5px rgba(0,0,0,.16);opacity:.85;transition:opacity .15s}
.fgb-back:hover,.fgb-back:focus{opacity:1;color:#1a1a1a;text-decoration:none}
@media (prefers-color-scheme:dark){html:not([data-theme="light"]) .fgb-back{
background:rgba(28,27,25,.93);color:#e9e5dc;border-color:rgba(255,255,255,.22);
box-shadow:0 1px 5px rgba(0,0,0,.5)}
html:not([data-theme="light"]) .fgb-back:hover,html:not([data-theme="light"]) .fgb-back:focus{color:#fff}}
html[data-theme="dark"] .fgb-back{background:rgba(28,27,25,.93);color:#e9e5dc;
border-color:rgba(255,255,255,.22);box-shadow:0 1px 5px rgba(0,0,0,.5)}
html[data-theme="dark"] .fgb-back:hover,html[data-theme="dark"] .fgb-back:focus{color:#fff}
@media print{.fgb-back{display:none}}
@media (max-width:480px){.fgb-back{left:8px;bottom:8px;padding:6px 10px;font-size:13px}}
</style>
`;

function withBackLink(html) {
  if (html.includes(BACK_LINK_MARKER)) return html;
  const i = html.toLowerCase().lastIndexOf("</body>");
  if (i === -1) return html + BACK_LINK; // no </body> to hook onto; append and let the parser cope
  return html.slice(0, i) + BACK_LINK + html.slice(i);
}

/**
 * `hidden: true` keeps a book off every page and out of the sitemap, but that
 * filter lives in getBooks() and says nothing about its files. Without this
 * check the book's read-online page still gets copied into public/ and
 * deployed — unlinked, but publicly reachable and indexable, which is exactly
 * what a book is hidden to avoid while its text is unfinished.
 */
function isHidden(bookDir) {
  const yaml = join(bookDir, "book.yaml");
  if (!existsSync(yaml)) return false;
  try {
    const parsed = parse(readFileSync(yaml, "utf8"));
    return Array.isArray(parsed) && parsed[0]?.hidden === true;
  } catch {
    return false; // a broken yaml is the build's problem to report, not ours to swallow
  }
}

function syncDir(srcDir, destDir) {
  if (!existsSync(srcDir)) return;
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir)) {
    const s = join(srcDir, entry);
    const d = join(destDir, entry);
    if (statSync(s).isDirectory()) {
      syncDir(s, d);
    } else {
      copyFile(s, d);
    }
  }
}

if (!existsSync(DATA_SRC)) {
  console.log("[sync-assets] books-data/data/src not found — skipping.");
  process.exit(0);
}

let copied = 0;

for (const personSlug of readdirSync(DATA_SRC)) {
  if (personSlug === "books") continue;

  const personDir = join(DATA_SRC, personSlug);
  if (!statSync(personDir).isDirectory()) continue;

  // One folder per person whatever their roles — personImageDir() in src/lib/data.js
  // resolves the photo filenames in person.yaml against it.
  for (const file of readdirSync(personDir)) {
    if (
      IMAGE_EXTS.has(extname(file).toLowerCase()) &&
      statSync(join(personDir, file)).isFile()
    ) {
      copyFile(join(personDir, file), join(PUBLIC, "static", "images", "people", personSlug, file));
      copied++;
    }
  }
}

// Copy only cover images from each book's content folder.
// epub/pdf/zip files are served from R2, not the site.
if (existsSync(BOOKS_SRC)) {
  for (const bookSlug of readdirSync(BOOKS_SRC)) {
    const bookDir = join(BOOKS_SRC, bookSlug);
    if (!statSync(bookDir).isDirectory()) continue;
    if (isHidden(bookDir)) {
      console.log(`[sync-assets] skipping hidden book: ${bookSlug}`);
      continue;
    }

    const contentDir = join(bookDir, "content");
    if (!existsSync(contentDir)) continue;

    const destDir = join(PUBLIC, "static", "books", bookSlug);
    for (const file of readdirSync(contentDir)) {
      const ext = extname(file).toLowerCase();
      if (!IMAGE_EXTS.has(ext)) continue;
      if (ext === ".html") {
        mkdirSync(destDir, { recursive: true }); // writeFileSync won't create it; copyFile does
        writeFileSync(
          join(destDir, file),
          withBackLink(readFileSync(join(contentDir, file), "utf8")),
        );
      } else {
        copyFile(join(contentDir, file), join(destDir, file));
      }
      copied++;
    }
  }
}

console.log(`[sync-assets] synced ${copied} items from books-data → public/`);
