/**
 * Copies book content files and person photos from books-data into public/.
 * Run automatically via `npm run dev` and `npm run build`.
 */
import { existsSync, readdirSync, statSync, mkdirSync, copyFileSync } from "fs";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_SRC = join(__dirname, "../data/src");
const BOOKS_SRC = join(DATA_SRC, "books");
const PUBLIC = join(__dirname, "../public");

const IMAGE_EXTS = new Set([".webp", ".jpg", ".jpeg", ".png", ".html"]);

function copyFile(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
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

    const contentDir = join(bookDir, "content");
    if (!existsSync(contentDir)) continue;

    const destDir = join(PUBLIC, "static", "books", bookSlug);
    for (const file of readdirSync(contentDir)) {
      if (IMAGE_EXTS.has(extname(file).toLowerCase())) {
        copyFile(join(contentDir, file), join(destDir, file));
        copied++;
      }
    }
  }
}

console.log(`[sync-assets] synced ${copied} items from books-data → public/`);
