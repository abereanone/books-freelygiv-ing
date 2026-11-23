// Renders every public quote card (status not "rejected"), light and dark, at two sizes:
//   <id>-<tone>.jpg       1080x1080, for download, sharing and og:image
//   <id>-<tone>-480.jpg   480x480, for the /quotes/ grid
// into public/static/quotes/ (gitignored; `astro dev` serves it). Production serves the same
// files from R2: files.books.freelygiv.ing/quotes/ (node scripts/quotes/upload-cards.mjs).
// A card re-renders only when its text, author, book, painting or this template changes.
//   node scripts/quotes/render-cards.mjs [--force]
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createHash } from "crypto";
import { createRequire } from "module";
import YAML from "yaml";
import sharp from "sharp";
import { cardCss, cardHtml, FIT_JS, ART_DIR, FONT_DIR } from "./card.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const BOOKS = join(ROOT, "data/src/books");
const OUT = join(ROOT, "public/static/quotes");
const MANIFEST = join(OUT, "manifest.json");
const FORCE = process.argv.includes("--force");
mkdirSync(OUT, { recursive: true });

const require = createRequire(import.meta.url);
const puppeteer = require("C:/code/keeping-the-heart/node_modules/puppeteer-core");
const u = (p) => pathToFileURL(p).href;
const readY = (f) => YAML.parse(readFileSync(f, "utf8"));
const person = (slug) => { const p = readY(join(ROOT, "data/src", slug, "person.yaml"))[0]; return `${p.firstName} ${p.lastName}`; };
const templateSig = createHash("sha1").update(readFileSync(join(ROOT, "scripts/quotes/card.mjs"))).digest("hex").slice(0, 8);

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
const jobs = [];
for (const slug of readdirSync(BOOKS).filter((s) => existsSync(join(BOOKS, s, "quotes.yaml")))) {
  const title = readY(join(BOOKS, slug, "book.yaml"))[0].title;
  for (const q of readY(join(BOOKS, slug, "quotes.yaml"))) {
    if (q.status === "rejected") continue;
    for (const tone of ["dark", "light"]) {
      const bg = q.background?.[tone];
      if (!bg) { console.warn(`no ${tone} painting for ${q.id}; run the review pull first`); continue; }
      const key = `${q.id}-${tone}`;
      const sig = createHash("sha1").update([q.text, q.author, title, bg, templateSig].join("|")).digest("hex");
      if (!FORCE && manifest[key] === sig && existsSync(join(OUT, `${key}.jpg`))) continue;
      jobs.push({ key, sig, text: q.text, author: person(q.author), book: title, bg });
    }
  }
}

if (jobs.length) {
  const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--allow-file-access-from-files"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1080 });
  const tmp = join(OUT, "_card.html");
  for (const j of jobs) {
    writeFileSync(tmp, `<!doctype html><meta charset="utf-8"><style>body{margin:0}${cardCss(u(FONT_DIR) + "/")}</style>
${cardHtml({ text: j.text, author: j.author, book: j.book, bgUrl: u(join(ART_DIR, j.bg)) })}
<script>${FIT_JS};document.fonts.ready.then(()=>{fitCards(document);document.body.dataset.ready=1})</script>`);
    await page.goto(u(tmp));
    await page.waitForSelector("body[data-ready]");
    const png = await page.screenshot({ type: "png" });
    await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(join(OUT, `${j.key}.jpg`));
    await sharp(png).resize(480, 480).jpeg({ quality: 78, mozjpeg: true }).toFile(join(OUT, `${j.key}-480.jpg`));
    manifest[j.key] = j.sig;
  }
  unlinkSync(tmp);
  await browser.close();
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
}
const files = readdirSync(OUT).filter((f) => f.endsWith(".jpg"));
const mb = files.reduce((s, f) => s + statSync(join(OUT, f)).size, 0) / 1e6;
console.log(`${jobs.length} card(s) rendered; ${files.length} files, ${mb.toFixed(1)} MB in public/static/quotes/`);
